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
import { useAssignments } from '@/hooks/useAssignments';
import { useRequests } from '@/hooks/useRequests';
import { StatCard } from '@/components/StatCard';
import { AssignmentCard } from '@/components/AssignmentCard';
import { colors, borderRadius, spacing, fontSize, shadows } from '@/lib/theme';

export default function HomeScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { activeAssignments, completedAssignments, loading, refreshing, refresh } = useAssignments();
  const { requests } = useRequests();

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'Responder';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

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
      {/* Welcome */}
      <View style={styles.welcomeSection}>
        <View style={styles.welcomeLeft}>
          <Text style={styles.greetingLabel}>{greeting}</Text>
          <Text style={styles.greeting}>{displayName}</Text>
        </View>
        <View style={styles.avatarWrap}>
          <Ionicons name="shield-checkmark" size={22} color={colors.primary} />
        </View>
      </View>

      {/* Status banner */}
      <View style={[styles.statusBanner, shadows.sm]}>
        <View style={[styles.statusDot, {
          backgroundColor: activeAssignments.length > 0 ? colors.warning : colors.success,
        }]} />
        <Text style={styles.statusText}>
          {activeAssignments.length > 0
            ? `${activeAssignments.length} active assignment${activeAssignments.length > 1 ? 's' : ''}`
            : 'Standing by — no active assignments'}
        </Text>
        <View style={[styles.roleBadge]}>
          <Text style={styles.roleText}>RESPONDER</Text>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <StatCard
          icon="flash"
          label="Pending"
          value={requests.length}
          color={colors.warning}
        />
        <StatCard
          icon="navigate"
          label="Active"
          value={activeAssignments.length}
          color={colors.info}
        />
      </View>
      <View style={styles.statsRow}>
        <StatCard
          icon="checkmark-circle"
          label="Completed"
          value={completedAssignments.length}
          color={colors.success}
        />
        <StatCard
          icon="trophy"
          label="Total"
          value={activeAssignments.length + completedAssignments.length}
          color={colors.primary}
        />
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsRow}>
          <Pressable
            style={({ pressed }) => [styles.actionCard, shadows.sm, pressed && styles.actionPressed]}
            onPress={() => router.push('/(tabs)/requests')}
          >
            <View style={[styles.actionIcon, { backgroundColor: colors.warningMuted }]}>
              <Ionicons name="flash" size={22} color={colors.warning} />
            </View>
            <Text style={styles.actionLabel}>Requests</Text>
            {requests.length > 0 && (
              <View style={styles.actionBadge}>
                <Text style={styles.actionBadgeText}>{requests.length}</Text>
              </View>
            )}
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.actionCard, shadows.sm, pressed && styles.actionPressed]}
            onPress={() => router.push('/(tabs)/jobs')}
          >
            <View style={[styles.actionIcon, { backgroundColor: colors.infoMuted }]}>
              <Ionicons name="briefcase" size={22} color={colors.info} />
            </View>
            <Text style={styles.actionLabel}>My Jobs</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.actionCard, shadows.sm, pressed && styles.actionPressed]}
            onPress={() => router.push('/(tabs)/profile')}
          >
            <View style={[styles.actionIcon, { backgroundColor: colors.successMuted }]}>
              <Ionicons name="location" size={22} color={colors.success} />
            </View>
            <Text style={styles.actionLabel}>Location</Text>
          </Pressable>
        </View>
      </View>

      {/* Active Assignments */}
      {activeAssignments.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Active Assignments</Text>
            <Pressable
              style={styles.seeAllBtn}
              onPress={() => router.push('/(tabs)/jobs')}
            >
              <Text style={styles.seeAllLink}>See All</Text>
              <Ionicons name="arrow-forward" size={14} color={colors.primary} />
            </Pressable>
          </View>

          {activeAssignments.slice(0, 3).map((assignment) => (
            <AssignmentCard
              key={assignment.id}
              assignment={assignment}
              onPress={() => router.push(`/assignment/${assignment.id}`)}
            />
          ))}
        </View>
      )}

      {/* Empty state */}
      {!loading && activeAssignments.length === 0 && requests.length === 0 && (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="shield-checkmark-outline" size={48} color={colors.textDim} />
          </View>
          <Text style={styles.emptyTitle}>All Clear</Text>
          <Text style={styles.emptyText}>
            No active assignments or pending requests. You'll be notified when a new snake detection needs your response.
          </Text>
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
  },
  statusText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  roleBadge: {
    backgroundColor: colors.primaryMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  roleText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 1,
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
  actionBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: colors.danger,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  actionBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  emptyCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    borderWidth: 1.5,
    borderColor: colors.primary + '20',
    padding: spacing.xxl,
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  emptyText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: spacing.md,
  },
  bottomSpacer: {
    height: 40,
  },
});
