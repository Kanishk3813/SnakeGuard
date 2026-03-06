import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, borderRadius, spacing, fontSize, shadows } from '@/lib/theme';
import { Alert } from '@/lib/types';

interface AlertItemProps {
  alert: Alert;
  onPress?: () => void;
}

export function AlertItem({ alert, onPress }: AlertItemProps) {
  const { detection, read, timestamp } = alert;
  const riskLevel = detection.risk_level || 'low';
  const riskColor = colors.risk[riskLevel] || colors.risk.low;

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(diff / 3600000);
    if (hours < 24) return `${hours}h ago`;
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        shadows.sm,
        !read && styles.unread,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
    >
      {/* Left accent */}
      {!read && <View style={[styles.unreadStripe, { backgroundColor: riskColor }]} />}

      <View style={styles.row}>
        <View style={[styles.iconWrap, { backgroundColor: riskColor + '18' }]}>
          <Ionicons
            name={riskLevel === 'critical' || riskLevel === 'high' ? 'warning' : 'alert-circle'}
            size={22}
            color={riskColor}
          />
        </View>

        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, !read && styles.titleUnread]} numberOfLines={1}>
              {detection.species || 'Snake Detected'}
            </Text>
            {!read && <View style={[styles.unreadDot, { backgroundColor: riskColor }]} />}
          </View>

          <Text style={styles.body} numberOfLines={2}>
            {detection.venomous ? '⚠️ Venomous' : '✓ Non-venomous'} ·{' '}
            {(detection.confidence * 100).toFixed(0)}% confidence
            {detection.classification_description
              ? ` · ${detection.classification_description.substring(0, 50)}…`
              : ''}
          </Text>

          <View style={styles.footer}>
            <View style={styles.timeRow}>
              <Ionicons name="time-outline" size={11} color={colors.textDim} />
              <Text style={styles.time}>{formatTime(timestamp)}</Text>
            </View>
            <View style={[styles.riskPill, { backgroundColor: riskColor + '18' }]}>
              <View style={[styles.riskPillDot, { backgroundColor: riskColor }]} />
              <Text style={[styles.riskPillText, { color: riskColor }]}>
                {riskLevel.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  unread: {
    backgroundColor: colors.cardElevated,
    borderColor: colors.borderLight,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.985 }],
  },
  unreadStripe: {
    height: 3,
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
  },
  titleUnread: {
    fontWeight: '800',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  body: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: 4,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  time: {
    fontSize: fontSize.xs,
    color: colors.textDim,
  },
  riskPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  riskPillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  riskPillText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
