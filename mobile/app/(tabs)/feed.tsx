import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useDevices } from '@/hooks/useDevices';
import { LiveStreamView } from '@/components/LiveStreamView';
import { colors, borderRadius, spacing, fontSize } from '@/lib/theme';
import { Device } from '@/lib/types';

export default function FeedScreen() {
  const router = useRouter();
  const { devices, loading, fetchDevices } = useDevices();
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDevices();
    setRefreshing(false);
  };

  const onlineDevices = devices.filter((d) => d.status === 'online');
  const offlineDevices = devices.filter((d) => d.status !== 'online');

  // Full-screen stream view for selected device
  if (selectedDevice) {
    const streamUrl =
      selectedDevice.stream_url ||
      `http://${selectedDevice.device_id}:${selectedDevice.stream_port || 8000}/stream.mjpg`;

    return (
      <View style={styles.streamFullScreen}>
        <LiveStreamView streamUrl={streamUrl} deviceName={selectedDevice.name} />
        <Pressable
          style={styles.backButton}
          onPress={() => setSelectedDevice(null)}
        >
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          <Text style={styles.backButtonText}>Back to Devices</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Empty State */}
      {devices.length === 0 && !loading && (
        <View style={styles.emptyState}>
          <Ionicons name="videocam-off-outline" size={56} color={colors.textDim} />
          <Text style={styles.emptyTitle}>No Cameras</Text>
          <Text style={styles.emptyText}>
            Register your Raspberry Pi device to view live camera feeds.
          </Text>
          <Pressable
            style={styles.addButton}
            onPress={() => router.push('/devices/add')}
          >
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.addButtonText}>Register Device</Text>
          </Pressable>
        </View>
      )}

      {/* Online Devices */}
      {onlineDevices.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.statusIndicator}>
              <View style={[styles.statusDot, { backgroundColor: colors.primary }]} />
              <Text style={styles.sectionTitle}>
                Online ({onlineDevices.length})
              </Text>
            </View>
          </View>

          {onlineDevices.map((device) => (
            <Pressable
              key={device.id}
              style={({ pressed }) => [styles.deviceCard, pressed && styles.devicePressed]}
              onPress={() => setSelectedDevice(device)}
            >
              <View style={styles.deviceRow}>
                <View style={[styles.deviceIcon, { backgroundColor: colors.primaryMuted }]}>
                  <Ionicons name="videocam" size={24} color={colors.primary} />
                </View>
                <View style={styles.deviceInfo}>
                  <Text style={styles.deviceName}>{device.name}</Text>
                  <Text style={styles.deviceId}>
                    {device.stream_url || `Port ${device.stream_port || 8000}`}
                  </Text>
                </View>
                <View style={styles.playButton}>
                  <Ionicons name="play" size={20} color={colors.primary} />
                </View>
              </View>

              {/* Preview placeholder */}
              <View style={styles.previewContainer}>
                <Ionicons name="tv-outline" size={36} color={colors.textDim} />
                <Text style={styles.previewText}>Tap to view live stream</Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}

      {/* Offline Devices */}
      {offlineDevices.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.statusIndicator}>
              <View style={[styles.statusDot, { backgroundColor: colors.textDim }]} />
              <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
                Offline ({offlineDevices.length})
              </Text>
            </View>
          </View>

          {offlineDevices.map((device) => (
            <View key={device.id} style={[styles.deviceCard, styles.deviceOffline]}>
              <View style={styles.deviceRow}>
                <View style={[styles.deviceIcon, { backgroundColor: colors.surface }]}>
                  <Ionicons name="videocam-off" size={22} color={colors.textDim} />
                </View>
                <View style={styles.deviceInfo}>
                  <Text style={[styles.deviceName, { color: colors.textMuted }]}>
                    {device.name}
                  </Text>
                  <Text style={styles.deviceId}>
                    Last seen:{' '}
                    {device.last_seen
                      ? new Date(device.last_seen).toLocaleDateString()
                      : 'Never'}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
  },
  streamFullScreen: {
    flex: 1,
    backgroundColor: '#000',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  backButtonText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    gap: spacing.md,
  },
  emptyTitle: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: spacing.md,
  },
  emptyText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.xxxl,
    lineHeight: 20,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    marginTop: spacing.md,
  },
  addButtonText: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: '#fff',
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    marginBottom: spacing.md,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  deviceCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  deviceOffline: {
    opacity: 0.6,
  },
  devicePressed: {
    opacity: 0.85,
    transform: [{ scale: 0.985 }],
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  deviceIcon: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  deviceId: {
    fontSize: fontSize.xs,
    color: colors.textDim,
    marginTop: 2,
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewContainer: {
    marginTop: spacing.md,
    height: 140,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  previewText: {
    fontSize: fontSize.sm,
    color: colors.textDim,
  },
});
