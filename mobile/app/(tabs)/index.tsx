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
import { colors, borderRadius, spacing, fontSize, shadows } from '@/lib/theme';

export default function HomeScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { detections, loading, refreshing, refresh, stats } = useDetections(10);
  const { devices } = useDevices();

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'User';
  const hour = new Date().getHours();
  const greetingText = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

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
        <View style={styles.welcomeLeft}>
          <Text style={styles.greetingLabel}>{greetingText}</Text>
          <Text style={styles.greeting}>{displayName}</Text>
        </View>
        <View style={styles.avatarWrap}>
          <Text style={styles.avatarText}>
            {displayName[0].toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Status banner */}
      <View style={[styles.statusBanner, shadows.sm]}>
        <View style={styles.statusDot} />
        <Text style={styles.statusText}>System monitoring active</Text>
        <Text style={styles.statusDate}>
          {new Date().toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })}
        </Text>
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
            style={({ pressed }) => [styles.actionCard, shadows.sm, pressed && styles.actionPressed]}
            onPress={() => router.push('/(tabs)/feed')}
          >
            <View style={[styles.actionIcon, { backgroundColor: colors.primaryMuted }]}>
              <Ionicons name="videocam" size={22} color={colors.primary} />
            </View>
            <Text style={styles.actionLabel}>Live Feed</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.actionCard, shadows.sm, pressed && styles.actionPressed]}
            onPress={() => router.push('/(tabs)/identify')}
          >
            <View style={[styles.actionIcon, { backgroundColor: colors.infoMuted }]}>
              <Ionicons name="scan" size={22} color={colors.info} />
            </View>
            <Text style={styles.actionLabel}>Identify</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.actionCard, shadows.sm, pressed && styles.actionPressed]}
            onPress={() => router.push('/devices')}
          >
            <View style={[styles.actionIcon, { backgroundColor: colors.accentMuted }]}>
              <Ionicons name="hardware-chip" size={22} color={colors.accent} />
            </View>
            <Text style={styles.actionLabel}>Devices</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.actionCard, shadows.sm, pressed && styles.actionPressed]}
            onPress={() => router.push('/(tabs)/alerts')}
          >
            <View style={[styles.actionIcon, { backgroundColor: colors.dangerMuted }]}>
              <Ionicons name="notifications" size={22} color={colors.danger} />
            </View>
            <Text style={styles.actionLabel}>Alerts</Text>
          </Pressable>
        </View>
      </View>

      {/* No Devices Prompt */}
      {devices.length === 0 && !loading && (
        <Pressable
          style={({ pressed }) => [styles.emptyCard, pressed && { opacity: 0.85 }]}
          onPress={() => router.push('/devices/add')}
        >
          <View style={styles.emptyIconWrap}>
            <Ionicons name="add-circle-outline" size={36} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>No Devices Registered</Text>
          <Text style={styles.emptyText}>
            Register your Raspberry Pi camera to start monitoring for snakes.
          </Text>
          <View style={styles.emptyButton}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.emptyButtonText}>Register Device</Text>
          </View>
        </Pressable>
      )}

      {/* Recent Detections */}
      {detections.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Detections</Text>
            <Pressable
              style={styles.seeAllBtn}
              onPress={() => router.push('/(tabs)/detections')}
            >
              <Text style={styles.seeAllLink}>See All</Text>
              <Ionicons name="arrow-forward" size={14} color={colors.primary} />
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

  // Welcome
  welcomeSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  welcomeLeft: {
    flex: 1,
  },
  greetingLabel: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontWeight: '500',
    marginBottom: 2,
  },
  greeting: {
    fontSize: fontSize.xxl,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  avatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.primary + '40',
  },
  avatarText: {
    fontSize: fontSize.lg,
    fontWeight: '800',
    color: colors.primary,
  },

  // Status banner
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  statusText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  statusDate: {
    fontSize: fontSize.xs,
    color: colors.textDim,
    fontWeight: '600',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },

  // Section
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
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: spacing.md,
  },
  seeAllLink: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.primary,
  },

  // Actions – 4 column grid
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    gap: spacing.sm,
  },
  actionPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.95 }],
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // Empty state
  emptyCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    borderWidth: 1.5,
    borderColor: colors.primary + '30',
    borderStyle: 'dashed',
    padding: spacing.xxl,
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  emptyText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
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
