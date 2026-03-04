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
import { useDetections } from '@/hooks/useDetections';
import { DetectionCard } from '@/components/DetectionCard';
import { colors, borderRadius, spacing, fontSize } from '@/lib/theme';
import { SnakeDetection } from '@/lib/types';

const RISK_FILTERS = ['all', 'critical', 'high', 'medium', 'low'] as const;

export default function DetectionsScreen() {
  const router = useRouter();
  const { detections, loading, refreshing, refresh } = useDetections(100);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');

  const filteredDetections =
    selectedFilter === 'all'
      ? detections
      : detections.filter((d) => d.risk_level === selectedFilter);

  const renderItem = ({ item }: { item: SnakeDetection }) => (
    <DetectionCard
      detection={item}
      onPress={() => router.push(`/detection/${item.id}`)}
    />
  );

  const renderHeader = () => (
    <View style={styles.header}>
      {/* Risk Level Filters */}
      <ScrollableFilters selected={selectedFilter} onSelect={setSelectedFilter} />

      <Text style={styles.resultCount}>
        {filteredDetections.length} detection{filteredDetections.length !== 1 ? 's' : ''}
      </Text>
    </View>
  );

  const renderEmpty = () =>
    !loading ? (
      <View style={styles.emptyState}>
        <Ionicons name="search-outline" size={56} color={colors.textDim} />
        <Text style={styles.emptyTitle}>No Detections</Text>
        <Text style={styles.emptyText}>
          {selectedFilter !== 'all'
            ? `No ${selectedFilter} risk detections found. Try a different filter.`
            : 'Detections from your cameras will appear here.'}
        </Text>
      </View>
    ) : null;

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredDetections}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
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

function ScrollableFilters({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (f: string) => void;
}) {
  return (
    <View style={styles.filterRow}>
      {RISK_FILTERS.map((filter) => {
        const isActive = selected === filter;
        const chipColor =
          filter === 'all' ? colors.primary : colors.risk[filter] || colors.primary;

        return (
          <Pressable
            key={filter}
            style={[
              styles.filterChip,
              isActive && { backgroundColor: chipColor + '25', borderColor: chipColor },
            ]}
            onPress={() => onSelect(filter)}
          >
            {filter !== 'all' && (
              <View
                style={[styles.filterDot, { backgroundColor: chipColor }]}
              />
            )}
            <Text
              style={[
                styles.filterText,
                isActive && { color: chipColor, fontWeight: '700' },
              ]}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </Text>
          </Pressable>
        );
      })}
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
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  filterDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  filterText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontWeight: '500',
  },
  resultCount: {
    fontSize: fontSize.xs,
    color: colors.textDim,
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
});
