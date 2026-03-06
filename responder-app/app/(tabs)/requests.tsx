import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRequests } from '@/hooks/useRequests';
import { RequestCard } from '@/components/RequestCard';
import { AssignmentRequest } from '@/lib/types';
import { colors, borderRadius, spacing, fontSize, shadows } from '@/lib/theme';

export default function RequestsScreen() {
  const router = useRouter();
  const { requests, loading, refreshing, refresh, acceptRequest, rejectRequest } = useRequests();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<'accept' | 'reject' | null>(null);

  const handleAccept = async (request: AssignmentRequest) => {
    try {
      setProcessingId(request.id);
      setActionType('accept');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const result = await acceptRequest(request.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Navigate to the assignment detail
      if (result?.assignment?.id) {
        router.push(`/assignment/${result.assignment.id}`);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to accept request');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setProcessingId(null);
      setActionType(null);
    }
  };

  const handleReject = async (request: AssignmentRequest) => {
    Alert.alert(
      'Decline Assignment',
      'Are you sure you want to decline this assignment? It will be offered to the next responder.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            try {
              setProcessingId(request.id);
              setActionType('reject');
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              await rejectRequest(request.id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to decline request');
            } finally {
              setProcessingId(null);
              setActionType(null);
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: AssignmentRequest }) => (
    <RequestCard
      request={item}
      onAccept={() => handleAccept(item)}
      onReject={() => handleReject(item)}
      accepting={processingId === item.id && actionType === 'accept'}
      rejecting={processingId === item.id && actionType === 'reject'}
    />
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.headerTitle}>Incoming Requests</Text>
          <Text style={styles.headerSubtitle}>
            {requests.length > 0
              ? `${requests.length} pending request${requests.length > 1 ? 's' : ''}`
              : 'No pending requests'}
          </Text>
        </View>
      </View>

      <View style={[styles.infoBar, shadows.sm]}>
        <View style={styles.infoPulseOuter}>
          <View style={styles.infoDot} />
        </View>
        <Text style={styles.infoText}>
          Requests auto-refresh every 30 seconds
        </Text>
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name="flash-off-outline" size={48} color={colors.textDim} />
      </View>
      <Text style={styles.emptyTitle}>No Pending Requests</Text>
      <Text style={styles.emptyText}>
        When a snake is detected near your location, you'll receive an assignment request here.
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={requests}
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
  headerRow: {
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
  infoBar: {
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
  infoPulseOuter: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  infoText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontWeight: '500',
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
