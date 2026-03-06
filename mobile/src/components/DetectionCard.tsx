import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { colors, borderRadius, spacing, fontSize, shadows } from '@/lib/theme';
import { SnakeDetection } from '@/lib/types';

interface DetectionCardProps {
  detection: SnakeDetection;
  onPress?: () => void;
  compact?: boolean;
}

export function DetectionCard({ detection, onPress, compact = false }: DetectionCardProps) {
  const riskLevel = detection.risk_level || 'low';
  const riskColor = colors.risk[riskLevel] || colors.risk.low;
  const riskBg = colors.riskBg[riskLevel] || colors.riskBg.low;

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (compact) {
    return (
      <Pressable
        style={({ pressed }) => [styles.compactCard, pressed && styles.pressed]}
        onPress={onPress}
      >
        <View style={[styles.riskStripe, { backgroundColor: riskColor }]} />
        <View style={styles.compactContent}>
          <Text style={styles.compactSpecies} numberOfLines={1}>
            {detection.species || 'Snake Detected'}
          </Text>
          <View style={styles.compactMeta}>
            <Ionicons name="time-outline" size={11} color={colors.textDim} />
            <Text style={styles.compactTime}>{formatTime(detection.timestamp)}</Text>
          </View>
        </View>
        <View style={styles.compactRight}>
          <Text style={[styles.compactConfidence, { color: riskColor }]}>
            {(detection.confidence * 100).toFixed(0)}%
          </Text>
          <Ionicons name="chevron-forward" size={14} color={colors.textDim} />
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.card, shadows.sm, pressed && styles.pressed]}
      onPress={onPress}
    >
      {/* Image */}
      {detection.image_url ? (
        <View style={styles.imageWrap}>
          <Image
            source={{ uri: detection.image_url }}
            style={styles.image}
            contentFit="cover"
            transition={200}
          />
          {/* Risk badge overlay */}
          <View style={[styles.overlayBadge, { backgroundColor: riskColor }]}>
            <Text style={styles.overlayBadgeText}>{riskLevel.toUpperCase()}</Text>
          </View>
        </View>
      ) : (
        <View style={[styles.image, styles.placeholderImage]}>
          <Ionicons name="image-outline" size={32} color={colors.textDim} />
          <View style={[styles.overlayBadge, { backgroundColor: riskColor, top: spacing.sm, right: spacing.sm }]}>
            <Text style={styles.overlayBadgeText}>{riskLevel.toUpperCase()}</Text>
          </View>
        </View>
      )}

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.species} numberOfLines={1}>
          {detection.species || 'Unclassified Detection'}
        </Text>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="analytics-outline" size={13} color={colors.textMuted} />
            <Text style={styles.metaText}>
              {(detection.confidence * 100).toFixed(1)}%
            </Text>
          </View>
          {detection.venomous !== undefined && (
            <View
              style={[
                styles.venomPill,
                {
                  backgroundColor: detection.venomous
                    ? colors.dangerMuted
                    : colors.primaryMuted,
                },
              ]}
            >
              <Ionicons
                name={detection.venomous ? 'warning' : 'shield-checkmark'}
                size={11}
                color={detection.venomous ? colors.danger : colors.primary}
              />
              <Text
                style={[
                  styles.venomPillText,
                  { color: detection.venomous ? colors.danger : colors.primary },
                ]}
              >
                {detection.venomous ? 'Venomous' : 'Non-venomous'}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.footer}>
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={12} color={colors.textDim} />
            <Text style={styles.timeText}>{formatTime(detection.timestamp)}</Text>
          </View>
          {detection.latitude && detection.longitude && (
            <View style={styles.metaItem}>
              <Ionicons name="location-outline" size={12} color={colors.textDim} />
              <Text style={styles.timeText}>
                {detection.latitude.toFixed(4)}, {detection.longitude.toFixed(4)}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.985 }],
  },
  imageWrap: {
    position: 'relative',
  },
  image: {
    width: '100%',
    height: 190,
    backgroundColor: colors.surface,
  },
  placeholderImage: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  overlayBadge: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.xs,
  },
  overlayBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  content: {
    padding: spacing.lg,
  },
  species: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  venomPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  venomPillText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    paddingTop: spacing.sm,
  },
  timeText: {
    fontSize: fontSize.xs,
    color: colors.textDim,
  },

  // Compact variant
  compactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingVertical: spacing.md,
    paddingRight: spacing.md,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  riskStripe: {
    width: 3,
    alignSelf: 'stretch',
    marginRight: spacing.md,
  },
  compactContent: {
    flex: 1,
  },
  compactSpecies: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  compactMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  compactTime: {
    fontSize: fontSize.xs,
    color: colors.textDim,
  },
  compactRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  compactConfidence: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
});
