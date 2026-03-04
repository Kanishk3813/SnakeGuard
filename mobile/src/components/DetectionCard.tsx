import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { colors, borderRadius, spacing, fontSize } from '@/lib/theme';
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
        <View style={[styles.riskDot, { backgroundColor: riskColor }]} />
        <View style={styles.compactContent}>
          <Text style={styles.compactSpecies} numberOfLines={1}>
            {detection.species || 'Snake Detected'}
          </Text>
          <Text style={styles.compactTime}>{formatTime(detection.timestamp)}</Text>
        </View>
        <Text style={styles.compactConfidence}>
          {(detection.confidence * 100).toFixed(0)}%
        </Text>
        <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
      </Pressable>
    );
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={onPress}
    >
      {detection.image_url ? (
        <Image
          source={{ uri: detection.image_url }}
          style={styles.image}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <View style={[styles.image, styles.placeholderImage]}>
          <Ionicons name="image-outline" size={32} color={colors.textDim} />
        </View>
      )}

      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.species} numberOfLines={1}>
            {detection.species || 'Unclassified Detection'}
          </Text>
          <View style={[styles.riskBadge, { backgroundColor: riskBg }]}>
            <Text style={[styles.riskText, { color: riskColor }]}>
              {riskLevel.toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="analytics-outline" size={13} color={colors.textMuted} />
            <Text style={styles.metaText}>
              {(detection.confidence * 100).toFixed(1)}% confidence
            </Text>
          </View>
          {detection.venomous !== undefined && (
            <View style={styles.metaItem}>
              <Ionicons
                name={detection.venomous ? 'warning' : 'shield-checkmark'}
                size={13}
                color={detection.venomous ? colors.danger : colors.primary}
              />
              <Text
                style={[
                  styles.metaText,
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
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.985 }],
  },
  image: {
    width: '100%',
    height: 180,
    backgroundColor: colors.surface,
  },
  placeholderImage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  species: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
    marginRight: spacing.sm,
  },
  riskBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  riskText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  metaRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing.sm,
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
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  riskDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  compactContent: {
    flex: 1,
  },
  compactSpecies: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  compactTime: {
    fontSize: fontSize.xs,
    color: colors.textDim,
    marginTop: 2,
  },
  compactConfidence: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});
