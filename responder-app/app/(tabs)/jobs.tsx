import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAssignments } from '@/hooks/useAssignments';
import { AssignmentCard } from '@/components/AssignmentCard';
import { ResponderAssignment } from '@/lib/types';
import { colors, borderRadius, spacing, fontSize } from '@/lib/theme';

type FilterType = 'all' | 'active' | 'completed';

export default function JobsScreen() {
  const router = useRouter();
  const { assignments, loading, refreshing, refresh } = useAssignments();
  const [filter, setFilter] = useState<FilterType>('all');

  const filteredJobs = assignments.filter((a) => {
    if (filter === 'active') return a.status === 'assigned' || a.status === 'in_progress';
    if (filter === 'completed') return a.status === 'completed';
    return true;
  });

  const filters: { key: FilterType; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: assignments.length },
    {
      key: 'active',
      label: 'Active',
      count: assignments.filter(a => a.status === 'assigned' || a.status === 'in_progress').length,
    },
    {
      key: 'completed',
      label: 'Done',
      count: assignments.filter(a => a.status === 'completed').length,
    },
  ];

  const renderItem = ({ item }: { item: ResponderAssignment }) => (
    <AssignmentCard
      assignment={item}
      onPress={() => router.push(`/assignment/${item.id}`)}
    />
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>My Assignments</Text>
      <Text style={styles.headerSubtitle}>
        {assignments.length} total assignment{assignments.length !== 1 ? 's' : ''}
      </Text>

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {filters.map(f => (
          <Pressable
            key={f.key}
            style={[
              styles.filterTab,
              filter === f.key && styles.filterTabActive,
            ]}
            onPress={() => setFilter(f.key)}
          >
            <Text
              style={[
                styles.filterText,
                filter === f.key && styles.filterTextActive,
              ]}
            >
              {f.label}
            </Text>
            <View
              style={[
                styles.filterCount,
                filter === f.key && styles.filterCountActive,
              ]}
            >
              <Text
                style={[
                  styles.filterCountText,
                  filter === f.key && styles.filterCountTextActive,
                ]}
              >
                {f.count}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name="briefcase-outline" size={48} color={colors.textDim} />
      </View>
      <Text style={styles.emptyTitle}>
        {filter === 'active' ? 'No Active Jobs' : filter === 'completed' ? 'No Completed Jobs' : 'No Assignments Yet'}
      </Text>
      <Text style={styles.emptyText}>
        {filter === 'active'
          ? 'Accept an assignment from the Requests tab to begin.'
          : filter === 'completed'
            ? 'Completed assignments will appear here.'
            : 'Your assignment history will appear here once you start responding to detections.'}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredJobs}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={!loading ? renderEmpty : null}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: 40,
  },
  header: {
    marginBottom: spacing.lg,
  },
  headerTitle: {
    fontSize: fontSize.xxl,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: 4,
    marginBottom: spacing.lg,
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  filterTabActive: {
    backgroundColor: colors.primaryMuted,
    borderColor: colors.primary + '40',
  },
  filterText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textMuted,
  },
  filterTextActive: {
    color: colors.primary,
  },
  filterCount: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
    minWidth: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  filterCountActive: {
    backgroundColor: colors.primary + '25',
  },
  filterCountText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textDim,
  },
  filterCountTextActive: {
    color: colors.primary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    gap: spacing.md,
  },
  emptyIconWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
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
    paddingHorizontal: spacing.xxxl,
    lineHeight: 20,
  },
});
