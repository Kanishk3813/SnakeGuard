import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Pressable,
  ScrollView,
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
      {/* Summary stats */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{detections.length}</Text>
          <Text style={styles.summaryLabel}>Total</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: colors.danger }]}>
            {detections.filter((d) => d.risk_level === 'critical' || d.risk_level === 'high').length}
          </Text>
          <Text style={styles.summaryLabel}>High Risk</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: colors.primary }]}>
            {detections.filter((d) => d.venomous === false).length}
          </Text>
          <Text style={styles.summaryLabel}>Non-venom</Text>
        </View>
      </View>

      {/* Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterScroll}
      >
        {RISK_FILTERS.map((filter) => {
          const isActive = selectedFilter === filter;
          const chipColor =
            filter === 'all' ? colors.primary : colors.risk[filter] || colors.primary;

          return (
            <Pressable
              key={filter}
              style={[
                styles.filterChip,
                isActive && { backgroundColor: chipColor + '20', borderColor: chipColor },
              ]}
              onPress={() => setSelectedFilter(filter)}
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
              {isActive && (
                <Text style={[styles.filterCount, { color: chipColor }]}>
                  {filteredDetections.length}
                </Text>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  const renderEmpty = () =>
    !loading ? (
      <View style={styles.emptyState}>
        <View style={styles.emptyIconWrap}>
          <Ionicons name="search-outline" size={48} color={colors.textDim} />
        </View>
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

  // Summary
  summaryRow: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: fontSize.xxl,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  summaryLabel: {
    fontSize: fontSize.xs,
    color: colors.textDim,
    fontWeight: '600',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: colors.cardBorder,
    marginVertical: 4,
  },

  // Filters
  filterScroll: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
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
  filterCount: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    marginLeft: 2,
  },

  // Empty
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
