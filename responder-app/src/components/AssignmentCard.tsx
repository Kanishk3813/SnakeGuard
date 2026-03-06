import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { ResponderAssignment } from '@/lib/types';
import { colors, borderRadius, spacing, fontSize, shadows } from '@/lib/theme';

interface AssignmentCardProps {
  assignment: ResponderAssignment;
  onPress?: () => void;
  compact?: boolean;
}

export function AssignmentCard({ assignment, onPress, compact }: AssignmentCardProps) {
  const det = assignment.detection;
  const riskLevel = det?.risk_level || 'medium';
  const riskColor = colors.risk[riskLevel] || colors.primary;
  const statusColor = colors.status[assignment.status] || colors.textMuted;
  const statusBg = colors.statusBg[assignment.status] || colors.surface;

  const statusLabels: Record<string, string> = {
    assigned: 'Assigned',
    in_progress: 'En Route',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };

  const statusIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
    assigned: 'flag',
    in_progress: 'navigate',
    completed: 'checkmark-circle',
    cancelled: 'close-circle',
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        shadows.sm,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
    >
      {/* Status stripe */}
      <View style={[styles.statusStripe, { backgroundColor: statusColor }]} />

      <View style={styles.content}>
        {/* Top row: status + time */}
        <View style={styles.topRow}>
          <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
            <Ionicons
              name={statusIcons[assignment.status] || 'ellipse'}
              size={12}
              color={statusColor}
            />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {statusLabels[assignment.status] || assignment.status}
            </Text>
          </View>
          <Text style={styles.timestamp}>
            {new Date(assignment.assigned_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>

        {/* Main content */}
        <View style={styles.main}>
          {!compact && det?.image_url ? (
            <Image
              source={{ uri: det.image_url }}
              style={styles.image}
              contentFit="cover"
              transition={200}
            />
          ) : null}

          <View style={styles.info}>
            <Text style={styles.species} numberOfLines={1}>
              {det?.species || 'Unidentified Snake'}
            </Text>

            <View style={styles.metaRow}>
              {det?.venomous && (
                <View style={styles.venomousPill}>
                  <Ionicons name="warning" size={10} color={colors.danger} />
                  <Text style={styles.venomousLabel}>Venomous</Text>
                </View>
              )}
              <View style={[styles.riskPill, { backgroundColor: colors.riskBg[riskLevel] }]}>
                <Text style={[styles.riskLabel, { color: riskColor }]}>
                  {riskLevel.toUpperCase()}
                </Text>
              </View>
            </View>

            {det?.confidence && (
              <Text style={styles.confidence}>
                {(det.confidence * 100).toFixed(0)}% confidence
              </Text>
            )}
          </View>

          <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
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
    marginBottom: spacing.md,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  statusStripe: {
    height: 3,
    width: '100%',
  },
  content: {
    padding: spacing.lg,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  statusText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  timestamp: {
    fontSize: fontSize.xs,
    color: colors.textDim,
    fontWeight: '500',
  },
  main: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  image: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.md,
  },
  info: {
    flex: 1,
    gap: spacing.xs,
  },
  species: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  venomousPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.dangerMuted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  venomousLabel: {
    fontSize: 10,
    color: colors.danger,
    fontWeight: '700',
  },
  riskPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  riskLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  confidence: {
    fontSize: fontSize.xs,
    color: colors.textDim,
    fontWeight: '500',
  },
});
