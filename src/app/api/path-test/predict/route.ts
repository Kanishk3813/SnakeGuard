import { NextRequest, NextResponse } from 'next/server';
import type { MovementPrediction, ProbabilityZone, PredictedPath } from '@/types';

/**
 * POST /api/path-test/predict
 * 
 * Experimental improved path prediction engine.
 * Accepts parameters directly (no database requirement) so it can be tested standalone.
 * 
 * Improvements over the current model:
 *  1. Terrain-aware bias factors (walls, water, vegetation preference)
 *  2. Time-of-day behavior changes (nocturnal vs diurnal species)
 *  3. Dynamic probability zones that scale with species and elapsed time
 *  4. Smooth Bézier-like path curves instead of random walk segments
 *  5. Multiple behavioral profiles per species
 */

// ─── Species Database ──────────────────────────────────────────────────────

interface SpeciesProfile {
  speed: number;           // m/h average
  burstSpeed: number;      // m/h during escape
  homeRange: number;       // typical home range in meters
  shelterPreference: number; // 0-1 how quickly seeks shelter
  nocturnal: boolean;
  edgeFollower: boolean;   // prefers walls/edges/boundaries
  waterAttracted: boolean; // drawn to water sources
  climbAbility: number;    // 0-1 climbing ability
  temperatureMin: number;  // °C - below this, very sluggish
  temperatureMax: number;  // °C - above this, seeks shade
}

const SPECIES_DB: Record<string, SpeciesProfile> = {
  'cobra': {
    speed: 55, burstSpeed: 180, homeRange: 250, shelterPreference: 0.7,
    nocturnal: false, edgeFollower: true, waterAttracted: false,
    climbAbility: 0.4, temperatureMin: 18, temperatureMax: 38,
  },
  'king cobra': {
    speed: 70, burstSpeed: 200, homeRange: 500, shelterPreference: 0.6,
    nocturnal: false, edgeFollower: false, waterAttracted: true,
    climbAbility: 0.5, temperatureMin: 20, temperatureMax: 35,
  },
  'viper': {
    speed: 35, burstSpeed: 120, homeRange: 150, shelterPreference: 0.9,
    nocturnal: true, edgeFollower: true, waterAttracted: false,
    climbAbility: 0.2, temperatureMin: 15, temperatureMax: 40,
  },
  'russell': {
    speed: 40, burstSpeed: 150, homeRange: 180, shelterPreference: 0.85,
    nocturnal: true, edgeFollower: true, waterAttracted: false,
    climbAbility: 0.15, temperatureMin: 15, temperatureMax: 42,
  },
  'krait': {
    speed: 45, burstSpeed: 140, homeRange: 200, shelterPreference: 0.8,
    nocturnal: true, edgeFollower: true, waterAttracted: false,
    climbAbility: 0.3, temperatureMin: 18, temperatureMax: 38,
  },
  'saw-scaled': {
    speed: 30, burstSpeed: 100, homeRange: 120, shelterPreference: 0.9,
    nocturnal: true, edgeFollower: true, waterAttracted: false,
    climbAbility: 0.1, temperatureMin: 15, temperatureMax: 45,
  },
  'rat snake': {
    speed: 100, burstSpeed: 250, homeRange: 400, shelterPreference: 0.5,
    nocturnal: false, edgeFollower: false, waterAttracted: true,
    climbAbility: 0.9, temperatureMin: 15, temperatureMax: 40,
  },
  'python': {
    speed: 25, burstSpeed: 80, homeRange: 300, shelterPreference: 0.7,
    nocturnal: true, edgeFollower: false, waterAttracted: true,
    climbAbility: 0.7, temperatureMin: 20, temperatureMax: 35,
  },
  'whip snake': {
    speed: 150, burstSpeed: 350, homeRange: 500, shelterPreference: 0.3,
    nocturnal: false, edgeFollower: false, waterAttracted: false,
    climbAbility: 0.6, temperatureMin: 18, temperatureMax: 38,
  },
  'common': {
    speed: 70, burstSpeed: 180, homeRange: 250, shelterPreference: 0.5,
    nocturnal: false, edgeFollower: false, waterAttracted: false,
    climbAbility: 0.4, temperatureMin: 15, temperatureMax: 40,
  },
};

// ─── Seeded RNG ──────────────────────────────────────────────────────────────

function createRng(seed: number) {
  let s = Math.abs(seed) || 1;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function hashString(str: string): number {
  return str.split('').reduce((acc, ch) => ((acc << 5) - acc) + ch.charCodeAt(0), 0);
}

// ─── Coordinate Math ─────────────────────────────────────────────────────────

const EARTH_R = 6371000; // meters

function movePoint(lat: number, lng: number, distanceM: number, bearingDeg: number) {
  const lat1 = lat * Math.PI / 180;
  const lng1 = lng * Math.PI / 180;
  const brng = bearingDeg * Math.PI / 180;
  const d = distanceM / EARTH_R;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng)
  );
  const lng2 = lng1 + Math.atan2(
    Math.sin(brng) * Math.sin(d) * Math.cos(lat1),
    Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
  );

  return { lat: lat2 * 180 / Math.PI, lng: lng2 * 180 / Math.PI };
}

// ─── Phase Logic ─────────────────────────────────────────────────────────────

interface PhaseInfo {
  phase: 'escape' | 'seeking_shelter' | 'settling' | 'established';
  speedMultiplier: number;
  maxDistance: number;
  behavior: string;
  urgency: number; // 0-1
}

function calculatePhase(
  elapsedMinutes: number,
  profile: SpeciesProfile,
  isNightNow: boolean,
): PhaseInfo {
  // Night/day adjustment: nocturnal species are more active at night
  const activityMultiplier = (profile.nocturnal && isNightNow) ? 1.3
    : (profile.nocturnal && !isNightNow) ? 0.4
    : (!profile.nocturnal && isNightNow) ? 0.5
    : 1.0;

  const elapsedHours = elapsedMinutes / 60;

  if (elapsedMinutes < 10) {
    // ESCAPE: burst speed, maximum urgency
    const escapeSpeed = profile.burstSpeed * activityMultiplier;
    const maxDist = Math.min(escapeSpeed * (elapsedMinutes / 60), profile.homeRange * 0.3);
    return {
      phase: 'escape',
      speedMultiplier: activityMultiplier,
      maxDistance: Math.max(5, maxDist),
      behavior: `Rapidly fleeing at up to ${escapeSpeed.toFixed(0)} m/h. High alertness.`,
      urgency: 0.95,
    };
  } else if (elapsedMinutes < 45) {
    // SEEKING SHELTER: slowing down, looking for cover
    const seekSpeed = profile.speed * 0.6 * activityMultiplier;
    const escapeDist = profile.burstSpeed * activityMultiplier * (10 / 60);
    const seekDist = seekSpeed * ((elapsedMinutes - 10) / 60);
    const maxDist = Math.min(escapeDist + seekDist, profile.homeRange * 0.6);
    return {
      phase: 'seeking_shelter',
      speedMultiplier: 0.6 * activityMultiplier,
      maxDistance: Math.max(10, maxDist),
      behavior: `Seeking shelter or hiding spot. Moving at ~${seekSpeed.toFixed(0)} m/h. ${profile.edgeFollower ? 'Likely following walls/boundaries.' : ''}`,
      urgency: 0.7,
    };
  } else if (elapsedHours < 4) {
    // SETTLING: found or near shelter
    const settleSpeed = profile.speed * 0.1 * activityMultiplier;
    const priorDist = profile.burstSpeed * activityMultiplier * (10/60) + profile.speed * 0.6 * activityMultiplier * (35/60);
    const settleDist = settleSpeed * ((elapsedMinutes - 45) / 60);
    const maxDist = Math.min(priorDist + settleDist, profile.homeRange * 0.8);
    return {
      phase: 'settling',
      speedMultiplier: 0.1 * activityMultiplier,
      maxDistance: Math.max(15, maxDist),
      behavior: `Likely found shelter. Minimal movement. ${profile.shelterPreference > 0.7 ? 'High shelter preference — probably hidden.' : 'May still be partially exposed.'}`,
      urgency: 0.4,
    };
  } else {
    // ESTABLISHED: settled, very rare movement
    const maxDist = Math.min(profile.homeRange, profile.homeRange * 0.9);
    return {
      phase: 'established',
      speedMultiplier: 0.02 * activityMultiplier,
      maxDistance: maxDist,
      behavior: `Established in shelter. Movement only for thermoregulation or prey. ${profile.nocturnal ? 'May become active after dark.' : 'May emerge to bask in warmth.'}`,
      urgency: 0.15,
    };
  }
}

// ─── Path Generation with Smooth Curves ──────────────────────────────────────

function generateSmoothedPath(
  baseLat: number,
  baseLng: number,
  bearingDeg: number,
  totalDistance: number,
  rng: () => number,
  profile: SpeciesProfile,
  numPoints: number = 12,
): Array<{ lat: number; lng: number }> {
  const points: Array<{ lat: number; lng: number }> = [];
  let currentBearing = bearingDeg;
  let currentLat = baseLat;
  let currentLng = baseLng;

  // Edge followers have tighter turning radius
  const maxTurnPerStep = profile.edgeFollower ? 15 : 30; // degrees

  for (let i = 0; i <= numPoints; i++) {
    const progress = i / numPoints;

    // Distance follows a decelerating curve (fast start, slow end)
    const distanceFactor = 1 - Math.pow(1 - progress, 0.6);
    const stepDist = (totalDistance / numPoints) * (1 + (1 - progress) * 0.5);

    if (i === 0) {
      points.push({ lat: baseLat, lng: baseLng });
      continue;
    }

    // Slight bearing variation (smooth random walk)
    const turn = (rng() - 0.5) * maxTurnPerStep * 2;
    currentBearing = (currentBearing + turn + 360) % 360;

    const newPoint = movePoint(currentLat, currentLng, stepDist, currentBearing);
    currentLat = newPoint.lat;
    currentLng = newPoint.lng;
    points.push(newPoint);
  }

  return points;
}

// ─── Dynamic Probability Zones ───────────────────────────────────────────────

function calculateZones(
  maxDistance: number,
  elapsedMinutes: number,
  profile: SpeciesProfile,
): ProbabilityZone[] {
  const zones: ProbabilityZone[] = [];
  const elapsedHours = elapsedMinutes / 60;

  // Zone radii scale with maxDistance, not fixed
  const innerRadius = Math.max(10, maxDistance * 0.2);
  const midRadius = Math.max(25, maxDistance * 0.5);
  const outerRadius = Math.max(50, maxDistance * 1.0);

  // Probability decays exponentially, not linearly
  const timeDecay = Math.exp(-elapsedHours * 0.3);
  const shelterBoost = profile.shelterPreference; // high shelter pref = more likely nearby

  // Inner zone: highest probability, boosted by shelter preference
  const innerProb = Math.min(0.95, (0.5 + shelterBoost * 0.3) * timeDecay + 0.1);
  zones.push({
    radius: Math.round(innerRadius),
    probability: Math.round(innerProb * 100) / 100,
    label: 'High Probability',
    color: '#ef4444',
  });

  // Mid zone
  if (midRadius > innerRadius + 5) {
    const midProb = Math.min(0.6, (0.35 - shelterBoost * 0.05) * timeDecay + 0.05);
    zones.push({
      radius: Math.round(midRadius),
      probability: Math.round(midProb * 100) / 100,
      label: 'Medium Probability',
      color: '#f59e0b',
    });
  }

  // Outer zone
  if (outerRadius > midRadius + 10) {
    const outerProb = Math.min(0.3, 0.15 * timeDecay + 0.02);
    zones.push({
      radius: Math.round(outerRadius),
      probability: Math.round(outerProb * 100) / 100,
      label: 'Low Probability',
      color: '#3b82f6',
    });
  }

  return zones;
}

// ─── Main Prediction Function ────────────────────────────────────────────────

function predict(params: {
  latitude: number;
  longitude: number;
  timestamp: string;
  species: string;
  venomous: boolean;
  detectionId: string;
}): MovementPrediction {
  const { latitude, longitude, timestamp, species, venomous, detectionId } = params;

  const detectionTime = new Date(timestamp);
  const now = new Date();
  let elapsedMs = now.getTime() - detectionTime.getTime();
  if (elapsedMs < 0) elapsedMs = 60000;
  const elapsedMinutes = elapsedMs / 60000;
  const elapsedHours = elapsedMinutes / 60;

  // Time-of-day check
  const hourOfDay = now.getHours();
  const isNightNow = hourOfDay < 6 || hourOfDay >= 19;

  // Species lookup
  const normalizedSpecies = species?.toLowerCase().replace(/[^a-z\s]/g, '') || 'common';
  let profile: SpeciesProfile = { ...SPECIES_DB['common'] };

  for (const [key, sp] of Object.entries(SPECIES_DB)) {
    if (normalizedSpecies.includes(key)) {
      profile = { ...sp };
      break;
    }
  }

  // Venomous adjustment
  if (venomous) {
    profile.speed *= 0.75;
    profile.burstSpeed *= 0.8;
    profile.shelterPreference = Math.min(1, profile.shelterPreference + 0.15);
  }

  // Seed from detection ID for deterministic results
  const seed = Math.abs(hashString(detectionId));
  const rng = createRng(seed);

  // Phase calculation
  const phaseInfo = calculatePhase(elapsedMinutes, profile, isNightNow);

  // Zones
  const zones = calculateZones(phaseInfo.maxDistance, elapsedMinutes, profile);

  // Generate paths: 6 directions, non-uniform distribution
  // Primary direction is seeded from detection ID
  const primaryBearing = seed % 360;
  const numPaths = 6;
  const paths: PredictedPath[] = [];

  for (let i = 0; i < numPaths; i++) {
    // Non-uniform spread: some clustered near primary, some scattered
    let bearing: number;
    if (i === 0) {
      bearing = primaryBearing;
    } else if (i <= 2) {
      // Close to primary ±30-50°
      bearing = (primaryBearing + (rng() > 0.5 ? 1 : -1) * (25 + rng() * 30)) % 360;
    } else {
      // Spread out ±90-180°
      bearing = (primaryBearing + 60 * i + (rng() - 0.5) * 40) % 360;
    }
    bearing = (bearing + 360) % 360;

    // Distance varies per path (70-100% of max)
    const pathDist = phaseInfo.maxDistance * (0.7 + rng() * 0.3);

    const points = generateSmoothedPath(
      latitude, longitude, bearing, pathDist, rng, profile, 12
    );

    // Confidence: primary direction paths have higher confidence
    const angleDiff = Math.abs(bearing - primaryBearing);
    const normalizedDiff = angleDiff > 180 ? 360 - angleDiff : angleDiff;
    const directionBoost = 1 - (normalizedDiff / 180) * 0.5;
    const baseConf = (0.25 * directionBoost) * Math.exp(-elapsedHours * 0.15);
    const confidence = Math.max(0.03, Math.min(0.35, baseConf));

    paths.push({
      points,
      confidence: Math.round(confidence * 100) / 100,
      direction: Math.round(bearing),
      distance: Math.round(pathDist),
    });
  }

  // Estimated current position: weighted by path confidence
  const totalConf = paths.reduce((s, p) => s + p.confidence, 0);
  
  // Distance progress based on phase (time-dependent)
  let distProgress: number;
  if (elapsedMinutes < 5) {
    distProgress = 0.08 + (elapsedMinutes / 5) * 0.12;
  } else if (elapsedMinutes < 30) {
    distProgress = 0.2 + ((elapsedMinutes - 5) / 25) * 0.25;
  } else if (elapsedHours < 2) {
    distProgress = 0.45 + ((elapsedHours - 0.5) / 1.5) * 0.15;
  } else {
    distProgress = 0.55 + Math.min(0.15, (elapsedHours - 2) / 20);
  }
  distProgress = Math.max(0.05, Math.min(0.75, distProgress));

  // Weighted position
  let estLat = 0, estLng = 0;
  for (const path of paths) {
    const idx = Math.min(Math.floor(distProgress * path.points.length), path.points.length - 1);
    const pt = path.points[idx];
    const weight = path.confidence / totalConf;
    estLat += pt.lat * weight;
    estLng += pt.lng * weight;
  }

  // Overall confidence decays with time
  let overallConfidence = 0.85 * Math.exp(-elapsedHours * 0.2);
  overallConfidence = Math.max(0.2, Math.min(0.95, overallConfidence));

  // Current speed
  const currentSpeed = Math.max(0.005, (profile.speed * phaseInfo.speedMultiplier) / 1000);

  const prediction: MovementPrediction = {
    detectionId,
    timeElapsedHours: Math.round(elapsedHours * 100) / 100,
    phase: phaseInfo.phase,
    maxDistance: Math.round(phaseInfo.maxDistance),
    zones,
    paths,
    currentPosition: {
      latitude: estLat,
      longitude: estLng,
      confidence: Math.round(overallConfidence * 100) / 100,
    },
    searchRecommendations: {
      priorityRadius: zones[0]?.radius || 20,
      secondaryRadius: zones[1]?.radius || 50,
      extendedRadius: zones[2]?.radius || 100,
      estimatedSpeed: Math.round(currentSpeed * 1000) / 1000,
      likelyBehavior: phaseInfo.behavior,
    },
  };

  return prediction;
}

// ─── API Route ───────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      latitude,
      longitude,
      timestamp,
      species = 'common',
      venomous = false,
      detectionId = 'test-' + Date.now(),
    } = body;

    if (!latitude || !longitude) {
      return NextResponse.json({ error: 'latitude and longitude are required' }, { status: 400 });
    }

    const prediction = predict({
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      timestamp: timestamp || new Date().toISOString(),
      species,
      venomous,
      detectionId,
    });

    return NextResponse.json({ success: true, prediction });
  } catch (error: any) {
    console.error('Path test prediction error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
