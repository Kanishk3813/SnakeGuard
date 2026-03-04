import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useDetections } from '@/hooks/useDetections';
import { useDevices } from '@/hooks/useDevices';
import { StatCard } from '@/components/StatCard';
import { DetectionCard } from '@/components/DetectionCard';
import { colors, borderRadius, spacing, fontSize } from '@/lib/theme';

export default function HomeScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { detections, loading, refreshing, refresh, stats } = useDetections(10);
  const { devices } = useDevices();

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'User';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refresh}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Welcome Header */}
      <View style={styles.welcomeSection}>
        <View>
          <Text style={styles.greeting}>Hello, {displayName} 👋</Text>
          <Text style={styles.date}>
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </Text>
        </View>
      </View>

      {/* Stats Grid */}
      <View style={styles.statsRow}>
        <StatCard
          icon="pulse"
          label="Detections"
          value={stats.totalDetections}
          color={colors.primary}
        />
        <StatCard
          icon="videocam"
          label="Devices"
          value={stats.activeDevices}
          color={colors.accent}
          subtitle={`${devices.length} total`}
        />
      </View>
      <View style={styles.statsRow}>
        <StatCard
          icon="alert-circle"
          label="24h Alerts"
          value={stats.recentAlerts}
          color={colors.danger}
        />
        <StatCard
          icon="analytics"
          label="Avg Conf."
          value={`${(stats.avgConfidence * 100).toFixed(0)}%`}
          color={colors.primaryLight}
        />
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsRow}>
          <Pressable
            style={({ pressed }) => [styles.actionCard, pressed && styles.actionPressed]}
            onPress={() => router.push('/(tabs)/feed')}
          >
            <View style={[styles.actionIcon, { backgroundColor: colors.primaryMuted }]}>
              <Ionicons name="videocam" size={24} color={colors.primary} />
            </View>
            <Text style={styles.actionLabel}>Live Feed</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.actionCard, pressed && styles.actionPressed]}
            onPress={() => router.push('/devices')}
          >
            <View style={[styles.actionIcon, { backgroundColor: colors.accent + '20' }]}>
              <Ionicons name="hardware-chip" size={24} color={colors.accent} />
            </View>
            <Text style={styles.actionLabel}>Devices</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.actionCard, pressed && styles.actionPressed]}
            onPress={() => router.push('/(tabs)/alerts')}
          >
            <View style={[styles.actionIcon, { backgroundColor: colors.dangerMuted }]}>
              <Ionicons name="notifications" size={24} color={colors.danger} />
            </View>
            <Text style={styles.actionLabel}>Alerts</Text>
          </Pressable>
        </View>
      </View>

      {/* No Devices Prompt */}
      {devices.length === 0 && !loading && (
        <Pressable
          style={styles.emptyCard}
          onPress={() => router.push('/devices/add')}
        >
          <Ionicons name="add-circle-outline" size={40} color={colors.primary} />
          <Text style={styles.emptyTitle}>No Devices Registered</Text>
          <Text style={styles.emptyText}>
            Register your Raspberry Pi camera to start monitoring for snakes.
          </Text>
          <View style={styles.emptyButton}>
            <Text style={styles.emptyButtonText}>Register Device</Text>
          </View>
        </Pressable>
      )}

      {/* Recent Detections */}
      {detections.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Detections</Text>
            <Pressable onPress={() => router.push('/(tabs)/detections')}>
              <Text style={styles.seeAllLink}>See All</Text>
            </Pressable>
          </View>

          {detections.slice(0, 5).map((detection) => (
            <DetectionCard
              key={detection.id}
              detection={detection}
              compact
              onPress={() => router.push(`/detection/${detection.id}`)}
            />
          ))}
        </View>
      )}

      <View style={styles.bottomSpacer} />
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
  welcomeSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  greeting: {
    fontSize: fontSize.xxl,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  date: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  section: {
    marginTop: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  seeAllLink: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: spacing.md,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  actionPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  emptyCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.primary + '40',
    borderStyle: 'dashed',
    padding: spacing.xxl,
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  emptyTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  emptyText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    marginTop: spacing.md,
  },
  emptyButtonText: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: '#fff',
  },
  bottomSpacer: {
    height: 40,
  },
});
