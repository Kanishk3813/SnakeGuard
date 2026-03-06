import React from 'react';
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
import { useRealtimeAlerts } from '@/hooks/useRealtimeAlerts';
import { AlertItem } from '@/components/AlertItem';
import { colors, borderRadius, spacing, fontSize, shadows } from '@/lib/theme';
import { Alert } from '@/lib/types';

export default function AlertsScreen() {
  const router = useRouter();
  const { alerts, unreadCount, markAsRead, markAllRead } = useRealtimeAlerts();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise((r) => setTimeout(r, 500));
    setRefreshing(false);
  };

  const handleAlertPress = (alert: Alert) => {
    markAsRead(alert.id);
    router.push(`/detection/${alert.detection.id}`);
  };

  const renderItem = ({ item }: { item: Alert }) => (
    <AlertItem alert={item} onPress={() => handleAlertPress(item)} />
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.headerTitle}>Snake Alerts</Text>
          <Text style={styles.headerSubtitle}>
            {unreadCount > 0
              ? `${unreadCount} unread alert${unreadCount !== 1 ? 's' : ''}`
              : 'All caught up ✓'}
          </Text>
        </View>
        {unreadCount > 0 && (
          <Pressable
            style={({ pressed }) => [styles.markAllButton, pressed && { opacity: 0.7 }]}
            onPress={markAllRead}
          >
            <Ionicons name="checkmark-done" size={16} color={colors.primary} />
            <Text style={styles.markAllText}>Mark All Read</Text>
          </Pressable>
        )}
      </View>

      {/* Live indicator */}
      <View style={[styles.liveBar, shadows.sm]}>
        <View style={styles.livePulseOuter}>
          <View style={styles.liveDot} />
        </View>
        <Text style={styles.liveText}>Realtime monitoring active</Text>
        <View style={styles.liveCountWrap}>
          <Text style={styles.liveCount}>{alerts.length}</Text>
          <Text style={styles.liveCountLabel}>total</Text>
        </View>
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name="notifications-off-outline" size={48} color={colors.textDim} />
      </View>
      <Text style={styles.emptyTitle}>No Alerts Yet</Text>
      <Text style={styles.emptyText}>
        When a snake is detected by your cameras, you'll be alerted here instantly.
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={alerts}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
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
  },
  markAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  markAllText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.primary,
  },
  liveBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  livePulseOuter: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  liveText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  liveCountWrap: {
    alignItems: 'center',
  },
  liveCount: {
    fontSize: fontSize.lg,
    fontWeight: '800',
    color: colors.textPrimary,
    lineHeight: 20,
  },
  liveCountLabel: {
    fontSize: 9,
    color: colors.textDim,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
