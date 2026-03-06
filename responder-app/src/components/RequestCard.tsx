import React from 'react';
import { View, Text, StyleSheet, Pressable, DimensionValue } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { AssignmentRequest } from '@/lib/types';
import { colors, borderRadius, spacing, fontSize, shadows } from '@/lib/theme';

interface RequestCardProps {
  request: AssignmentRequest;
  onAccept: () => void;
  onReject: () => void;
  accepting?: boolean;
  rejecting?: boolean;
}

export function RequestCard({
  request,
  onAccept,
  onReject,
  accepting,
  rejecting,
}: RequestCardProps) {
  const detection = request.detection;
  const riskLevel = detection?.risk_level || 'medium';
  const riskColor = colors.risk[riskLevel] || colors.primary;
  const timeAgo = getTimeAgo(request.requested_at);
  const expiresIn = getExpiresIn(request.expires_at);

  return (
    <View style={[styles.card, shadows.md]}>
      {/* Urgency bar */}
      <View style={[styles.urgencyBar, { backgroundColor: riskColor }]} />

      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.riskBadge, { backgroundColor: colors.riskBg[riskLevel] }]}>
            <View style={[styles.riskDot, { backgroundColor: riskColor }]} />
            <Text style={[styles.riskText, { color: riskColor }]}>
              {riskLevel.toUpperCase()}
            </Text>
          </View>
          <Text style={styles.timeAgo}>{timeAgo}</Text>
        </View>

        {/* Detection info */}
        <View style={styles.detectionInfo}>
          {detection?.image_url ? (
            <Image
              source={{ uri: detection.image_url }}
              style={styles.thumbnail}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <View style={styles.thumbnailPlaceholder}>
              <Ionicons name="image-outline" size={24} color={colors.textDim} />
            </View>
          )}

          <View style={styles.infoText}>
            <Text style={styles.species} numberOfLines={1}>
              {detection?.species || 'Unidentified Snake'}
            </Text>
            <View style={styles.infoRow}>
              <Ionicons name="navigate-outline" size={12} color={colors.textMuted} />
              <Text style={styles.distance}>
                {request.distance_km.toFixed(1)} km away
              </Text>
            </View>
            {detection?.venomous && (
              <View style={styles.venomousBadge}>
                <Ionicons name="warning" size={10} color={colors.danger} />
                <Text style={styles.venomousText}>Venomous</Text>
              </View>
            )}
          </View>
        </View>

        {/* Confidence bar */}
        {detection?.confidence && (
          <View style={styles.confidenceRow}>
            <Text style={styles.confidenceLabel}>Confidence</Text>
            <View style={styles.confidenceBar}>
              <View
                style={[
                  styles.confidenceFill,
                  {
                    width: `${(detection.confidence * 100).toFixed(0)}%` as DimensionValue,
                    backgroundColor: riskColor,
                  },
                ]}
              />
            </View>
            <Text style={[styles.confidenceValue, { color: riskColor }]}>
              {(detection.confidence * 100).toFixed(0)}%
            </Text>
          </View>
        )}

        {/* Expires timer */}
        <View style={styles.expiresRow}>
          <Ionicons name="time-outline" size={14} color={colors.textDim} />
          <Text style={styles.expiresText}>Expires {expiresIn}</Text>
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [
              styles.rejectButton,
              pressed && styles.buttonPressed,
              rejecting && styles.buttonDisabled,
            ]}
            onPress={onReject}
            disabled={accepting || rejecting}
          >
            <Ionicons name="close" size={20} color={colors.danger} />
            <Text style={styles.rejectText}>Decline</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.acceptButton,
              shadows.glow(colors.accent),
              pressed && styles.acceptPressed,
              accepting && styles.buttonDisabled,
            ]}
            onPress={onAccept}
            disabled={accepting || rejecting}
          >
            <Ionicons name="checkmark" size={20} color="#fff" />
            <Text style={styles.acceptText}>
              {accepting ? 'Accepting...' : 'Accept'}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function getExpiresIn(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return 'expired';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `in ${mins}m`;
  const hrs = Math.floor(mins / 60);
  return `in ${hrs}h ${mins % 60}m`;
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
  urgencyBar: {
    height: 3,
    width: '100%',
  },
  content: {
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  riskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  riskDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  riskText: {
    fontSize: fontSize.xs,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  timeAgo: {
    fontSize: fontSize.xs,
    color: colors.textDim,
    fontWeight: '500',
  },
  detectionInfo: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  thumbnail: {
    width: 72,
    height: 72,
    borderRadius: borderRadius.md,
  },
  thumbnailPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoText: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.xs,
  },
  species: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  distance: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontWeight: '500',
  },
  venomousBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.dangerMuted,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
  },
  venomousText: {
    fontSize: fontSize.xs,
    color: colors.danger,
    fontWeight: '700',
  },
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  confidenceLabel: {
    fontSize: fontSize.xs,
    color: colors.textDim,
    fontWeight: '500',
    width: 72,
  },
  confidenceBar: {
    flex: 1,
    height: 4,
    backgroundColor: colors.surface,
    borderRadius: 2,
  },
  confidenceFill: {
    height: 4,
    borderRadius: 2,
  },
  confidenceValue: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    width: 36,
    textAlign: 'right',
  },
  expiresRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.lg,
  },
  expiresText: {
    fontSize: fontSize.xs,
    color: colors.textDim,
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 48,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.dangerMuted,
    borderWidth: 1,
    borderColor: colors.danger + '30',
  },
  rejectText: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.danger,
  },
  acceptButton: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 48,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.accent,
  },
  acceptPressed: {
    backgroundColor: '#059669',
    transform: [{ scale: 0.98 }],
  },
  acceptText: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: '#fff',
  },
  buttonPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
