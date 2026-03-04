import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, borderRadius, spacing, fontSize } from '@/lib/theme';
import { Device } from '@/lib/types';

interface DeviceCardProps {
  device: Device;
  onPress?: () => void;
  onStreamPress?: () => void;
}

const statusConfig: Record<string, { color: string; label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  online: { color: colors.primary, label: 'Online', icon: 'radio-button-on' },
  offline: { color: colors.textDim, label: 'Offline', icon: 'radio-button-off' },
  maintenance: { color: colors.accent, label: 'Maintenance', icon: 'construct' },
  error: { color: colors.danger, label: 'Error', icon: 'alert-circle' },
};

export function DeviceCard({ device, onPress, onStreamPress }: DeviceCardProps) {
  const status = statusConfig[device.status] || statusConfig.offline;

  const formatLastSeen = (ts?: string | null) => {
    if (!ts) return 'Never';
    const d = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(diff / 3600000);
    if (hours < 24) return `${hours}h ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={onPress}
    >
      <View style={styles.row}>
        <View style={[styles.statusIcon, { backgroundColor: status.color + '20' }]}>
          <Ionicons name="videocam" size={22} color={status.color} />
        </View>

        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {device.name}
          </Text>
          <Text style={styles.deviceId} numberOfLines={1}>
            ID: {device.device_id}
          </Text>
        </View>

        <View style={styles.statusBadge}>
          <View style={[styles.statusDot, { backgroundColor: status.color }]} />
          <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>

      <View style={styles.details}>
        <View style={styles.detailItem}>
          <Ionicons name="time-outline" size={13} color={colors.textDim} />
          <Text style={styles.detailText}>Last seen: {formatLastSeen(device.last_seen)}</Text>
        </View>

        {device.latitude && device.longitude ? (
          <View style={styles.detailItem}>
            <Ionicons name="location-outline" size={13} color={colors.textDim} />
            <Text style={styles.detailText}>
              {device.latitude.toFixed(4)}, {device.longitude.toFixed(4)}
            </Text>
          </View>
        ) : null}
      </View>

      {device.status === 'online' && device.stream_url && (
        <Pressable
          style={({ pressed }) => [styles.streamButton, pressed && styles.streamButtonPressed]}
          onPress={onStreamPress}
        >
          <Ionicons name="play-circle" size={18} color={colors.primary} />
          <Text style={styles.streamButtonText}>View Live Feed</Text>
        </Pressable>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  pressed: {
    opacity: 0.85,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  statusIcon: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  deviceId: {
    fontSize: fontSize.xs,
    color: colors.textDim,
    marginTop: 2,
    fontFamily: 'monospace',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  details: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: fontSize.xs,
    color: colors.textDim,
  },
  streamButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary + '40',
    backgroundColor: colors.primaryMuted,
  },
  streamButtonPressed: {
    backgroundColor: colors.primary + '30',
  },
  streamButtonText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.primary,
  },
});
