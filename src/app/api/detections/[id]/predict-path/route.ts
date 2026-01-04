import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { MovementPrediction, ProbabilityZone, PredictedPath } from '@/types';

/**
 * GET /api/detections/[id]/predict-path
 * Calculate predicted movement path and probability zones for a snake detection
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const detectionId = id;
    const supabaseAdmin = getSupabaseAdminClient();

    // Get detection details
    const { data: detection, error: detectionError } = await supabaseAdmin
      .from('snake_detections')
      .select('id, latitude, longitude, timestamp, species, venomous, risk_level, status')
      .eq('id', detectionId)
      .single();

    if (detectionError || !detection) {
      return NextResponse.json(
        { error: 'Detection not found' },
        { status: 404 }
      );
    }

    if (detection.status === 'captured') {
      return NextResponse.json(
        { error: 'Snake already captured' },
        { status: 400 }
      );
    }

    if (!detection.latitude || !detection.longitude) {
      return NextResponse.json(
        { error: 'Detection has no location data' },
        { status: 400 }
      );
    }

    const baseLat = detection.latitude;
    const baseLng = detection.longitude;
    const detectionTime = new Date(detection.timestamp);
    const now = new Date();
    let timeElapsedMs = now.getTime() - detectionTime.getTime();
    
    // Handle edge case: if detection timestamp is in the future, treat as just detected
    if (timeElapsedMs < 0) {
      console.warn(`Detection ${detectionId} has future timestamp, treating as just detected`);
      // Set to 1 minute elapsed to avoid division issues
      timeElapsedMs = 60000;
    }
    
    const timeElapsedHours = timeElapsedMs / (1000 * 60 * 60);
    const timeElapsedMinutes = timeElapsedMs / (1000 * 60);

    // Species-specific parameters (meters per hour)
    const speciesParams: Record<string, { speed: number; homeRange: number }> = {
      'cobra': { speed: 50, homeRange: 200 },
      'viper': { speed: 40, homeRange: 180 },
      'krait': { speed: 45, homeRange: 200 },
      'russell': { speed: 40, homeRange: 180 },
      'saw-scaled': { speed: 35, homeRange: 150 },
      'rat snake': { speed: 100, homeRange: 300 },
      'python': { speed: 30, homeRange: 150 },
      'whip snake': { speed: 150, homeRange: 400 },
      'common': { speed: 80, homeRange: 250 },
    };

    // Normalize species name for lookup
    const normalizedSpecies = detection.species?.toLowerCase().replace(/[^a-z0-9\s]/g, '') || 'unknown';
    let speciesSpeed = 60; // default
    let homeRange = 200; // default

    for (const [key, params] of Object.entries(speciesParams)) {
      if (normalizedSpecies.includes(key)) {
        speciesSpeed = params.speed;
        homeRange = params.homeRange;
        break;
      }
    }

    // Adjust for venomous (more cautious, slower)
    if (detection.venomous) {
      speciesSpeed *= 0.7;
      homeRange *= 0.8;
    }

    // Determine movement phase
    let phase: 'escape' | 'seeking_shelter' | 'settling' | 'established';
    let speedMultiplier: number;
    let maxDistance: number;
    let likelyBehavior: string;

    if (timeElapsedMinutes < 15) {
      phase = 'escape';
      speedMultiplier = 0.9;
      // Scale maxDistance based on actual elapsed time, capped at 15 minutes worth
      const escapeTimeHours = Math.min(timeElapsedHours, 0.25); // Cap at 15 min = 0.25 hours
      maxDistance = Math.min(30, speciesSpeed * speedMultiplier * escapeTimeHours);
      likelyBehavior = 'Rapidly moving away from disturbance';
    } else if (timeElapsedMinutes < 60) {
      phase = 'seeking_shelter';
      speedMultiplier = 0.5;
      // Scale from 15 min to 60 min
      const seekingTimeHours = Math.min(timeElapsedHours, 1.0);
      maxDistance = Math.min(80, speciesSpeed * speedMultiplier * seekingTimeHours);
      likelyBehavior = 'Seeking cover or shelter, movement slowing';
    } else if (timeElapsedHours < 4) {
      phase = 'settling';
      speedMultiplier = 0.15;
      // Scale from 1 hour to 4 hours
      const settlingTimeHours = Math.min(timeElapsedHours, 4.0);
      maxDistance = Math.min(150, speciesSpeed * speedMultiplier * settlingTimeHours);
      likelyBehavior = 'Likely found shelter, minimal movement';
    } else {
      phase = 'established';
      speedMultiplier = 0.05;
      // For established phase, use home range but scale with time (capped)
      const establishedTimeHours = Math.min(timeElapsedHours, 24.0); // Cap at 24 hours
      maxDistance = Math.min(homeRange, speciesSpeed * speedMultiplier * establishedTimeHours);
      likelyBehavior = 'Probably settled in shelter, very limited movement';
    }

    // Calculate probability zones
    const zones: ProbabilityZone[] = [];
    
    const zoneRadii = [50, 150, 300];
    for (const radius of zoneRadii) {
      if (radius > maxDistance) break;

      let probability: number;
      if (radius <= 50) {
        // High probability zone
        probability = Math.max(0.3, 0.8 - (timeElapsedHours * 0.1));
      } else if (radius <= 150) {
        // Medium probability zone
        probability = Math.max(0.1, 0.4 - (timeElapsedHours * 0.05));
      } else {
        // Low probability zone
        probability = Math.max(0.05, 0.2 - (timeElapsedHours * 0.03));
      }

      // Adjust based on phase
      if (phase === 'established') {
        probability *= 0.6; // Lower probability in outer zones if settled
      }

      let label: string;
      let color: string;
      if (radius <= 50) {
        label = 'High Probability';
        color = '#ef4444'; // red
      } else if (radius <= 150) {
        label = 'Medium Probability';
        color = '#f59e0b'; // amber
      } else {
        label = 'Low Probability';
        color = '#3b82f6'; // blue
      }

      zones.push({ radius, probability, label, color });
    }

    // Generate unique seed from detection ID for deterministic but varied paths
    // This ensures each snake has different paths, but they're consistent on refresh
    const detectionIdHash = detectionId.split('').reduce((acc, char) => {
      return ((acc << 5) - acc) + char.charCodeAt(0);
    }, 0);
    const seed = Math.abs(detectionIdHash);
    
    // Simple seeded random number generator
    let seedValue = seed;
    const seededRandom = () => {
      seedValue = (seedValue * 9301 + 49297) % 233280;
      return seedValue / 233280;
    };
    
    // Generate varied base direction based on detection characteristics
    // Use detection ID and timestamp to create unique starting direction
    const baseDirection = (seed % 360); // 0-360 degrees, unique per detection
    const pathDirections = [
      baseDirection,
      (baseDirection + 72) % 360,
      (baseDirection + 144) % 360,
      (baseDirection + 216) % 360,
      (baseDirection + 288) % 360
    ]; // 5 directions, 72° apart, but rotated based on detection

    // Generate predicted paths (fan pattern - 5 directions)
    const paths: PredictedPath[] = [];

    for (let pathIdx = 0; pathIdx < pathDirections.length; pathIdx++) {
      const directionDeg = pathDirections[pathIdx];
      const pathPoints: Array<{ lat: number; lng: number }> = [];
      const directionRad = (directionDeg * Math.PI) / 180;
      
      // Vary path distance based on seed (70-100% of max, but unique per path)
      const pathDistanceVariation = 0.7 + (seededRandom() * 0.3);
      const pathDistance = maxDistance * pathDistanceVariation;
      const numPoints = 10;
      
      for (let i = 0; i <= numPoints; i++) {
        const progress = i / numPoints;
        const distance = pathDistance * progress;
        
        // Add slight curve (random walk component, but seeded)
        const curveVariation = (seededRandom() - 0.5) * 0.3; // ±15° variation
        const curveAngle = directionRad + curveVariation;
        
        // Convert distance and direction to coordinates
        const R = 6371000; // Earth radius in meters
        const lat1 = baseLat * Math.PI / 180;
        const lng1 = baseLng * Math.PI / 180;
        
        const lat2 = Math.asin(
          Math.sin(lat1) * Math.cos(distance / R) +
          Math.cos(lat1) * Math.sin(distance / R) * Math.cos(curveAngle)
        );
        
        const lng2 = lng1 + Math.atan2(
          Math.sin(curveAngle) * Math.sin(distance / R) * Math.cos(lat1),
          Math.cos(distance / R) - Math.sin(lat1) * Math.sin(lat2)
        );
        
        pathPoints.push({
          lat: lat2 * 180 / Math.PI,
          lng: lng2 * 180 / Math.PI
        });
      }

      // Calculate confidence for this path (vary slightly based on direction)
      // Paths closer to "escape direction" have higher confidence
      const directionFromBase = Math.abs(directionDeg - baseDirection);
      const directionFactor = directionFromBase > 180 ? 360 - directionFromBase : directionFromBase;
      const directionBonus = 1 - (directionFactor / 180) * 0.3; // Up to 30% bonus for primary direction
      
      const baseConfidence = 0.2 * directionBonus; // Each path has varied base chance
      const confidence = Math.max(0.05, baseConfidence - (timeElapsedHours * 0.02));

      paths.push({
        points: pathPoints,
        confidence,
        direction: directionDeg,
        distance: pathDistance
      });
    }

    // Calculate most likely current position
    // Weighted average of all paths, biased toward higher confidence paths
    // Use seeded random to vary the primary direction, not always south
    const primaryPathIndex = Math.floor(seededRandom() * paths.length);
    const primaryPath = paths[primaryPathIndex];
    
    // Calculate distance based on time elapsed and phase
    // For very new detections (< 5 min), snake is likely very close to detection point
    // As time passes, the snake moves further away, but the rate decreases
    let distanceProgress: number;
    if (timeElapsedMinutes < 5) {
      // Very new: 5-15% of maxDistance (snake just detected, likely nearby)
      distanceProgress = 0.05 + (timeElapsedMinutes / 5) * 0.1; // 5% to 15%
    } else if (timeElapsedMinutes < 30) {
      // Early phase: 15-40% of maxDistance (snake moving away)
      distanceProgress = 0.15 + ((timeElapsedMinutes - 5) / 25) * 0.25; // 15% to 40%
    } else if (timeElapsedHours < 2) {
      // Mid phase: 40-60% of maxDistance (snake settling)
      distanceProgress = 0.4 + ((timeElapsedHours - 0.5) / 1.5) * 0.2; // 40% to 60%
    } else {
      // Established phase: 50-70% of maxDistance (snake likely settled somewhere)
      // Add slight variation based on seed for uniqueness
      const seedVariation = (seededRandom() - 0.5) * 0.2; // ±10% variation
      distanceProgress = 0.5 + seedVariation + Math.min(0.2, (timeElapsedHours - 2) / 20); // 50-70%
    }
    
    // Ensure distance progress is within reasonable bounds
    distanceProgress = Math.max(0.05, Math.min(0.75, distanceProgress));
    const avgDistance = maxDistance * distanceProgress;
    const avgDirection = primaryPath.direction; // Use the primary path direction, not hardcoded south
    
    const R = 6371000;
    const lat1 = baseLat * Math.PI / 180;
    const lng1 = baseLng * Math.PI / 180;
    const directionRad = (avgDirection * Math.PI) / 180;
    
    const currentLat = Math.asin(
      Math.sin(lat1) * Math.cos(avgDistance / R) +
      Math.cos(lat1) * Math.sin(avgDistance / R) * Math.cos(directionRad)
    ) * 180 / Math.PI;
    
    const currentLng = (lng1 + Math.atan2(
      Math.sin(directionRad) * Math.sin(avgDistance / R) * Math.cos(lat1),
      Math.cos(avgDistance / R) - Math.sin(lat1) * Math.sin(currentLat * Math.PI / 180)
    )) * 180 / Math.PI;

    // Calculate overall confidence
    let overallConfidence = 0.7;
    if (timeElapsedHours > 2) overallConfidence *= 0.8;
    if (timeElapsedHours > 4) overallConfidence *= 0.6;
    if (timeElapsedHours > 8) overallConfidence *= 0.4;
    overallConfidence = Math.max(0.3, Math.min(0.95, overallConfidence));

    const prediction: MovementPrediction = {
      detectionId,
      timeElapsedHours,
      phase,
      maxDistance,
      zones,
      paths,
      currentPosition: {
        latitude: currentLat,
        longitude: currentLng,
        confidence: overallConfidence
      },
      searchRecommendations: {
        priorityRadius: Math.min(50, maxDistance),
        secondaryRadius: Math.min(150, maxDistance),
        extendedRadius: Math.min(300, maxDistance),
        estimatedSpeed: Math.max(0.01, (speciesSpeed * speedMultiplier) / 1000), // Convert m/h to km/h, min 0.01 km/h for display
        likelyBehavior
      }
    };

    return NextResponse.json({
      success: true,
      prediction
    });

  } catch (error: any) {
    console.error('Path prediction error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

