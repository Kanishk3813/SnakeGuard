import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useDevices } from '@/hooks/useDevices';
import { DeviceCard } from '@/components/DeviceCard';
import { colors, borderRadius, spacing, fontSize } from '@/lib/theme';
import { Device } from '@/lib/types';

export default function DevicesScreen() {
  const router = useRouter();
  const { devices, loading, fetchDevices, removeDevice } = useDevices();

  const handleRemoveDevice = (device: Device) => {
    Alert.alert(
      'Remove Device',
      `Are you sure you want to remove "${device.name}"? This won't delete detection history.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const result = await removeDevice(device.id);
            if (result.error) {
              Alert.alert('Error', result.error);
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: Device }) => (
    <DeviceCard
      device={item}
      onPress={() => handleRemoveDevice(item)}
      onStreamPress={() => {
        router.push('/(tabs)/feed');
      }}
    />
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.headerSubtitle}>
        {devices.length} device{devices.length !== 1 ? 's' : ''} registered
      </Text>
    </View>
  );

  const renderEmpty = () =>
    !loading ? (
      <View style={styles.emptyState}>
        <Ionicons name="hardware-chip-outline" size={56} color={colors.textDim} />
        <Text style={styles.emptyTitle}>No Devices</Text>
        <Text style={styles.emptyText}>
          Register your Raspberry Pi camera to start monitoring for snakes.
        </Text>
      </View>
    ) : null;

  return (
    <View style={styles.container}>
      <FlatList
        data={devices}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      {/* FAB */}
      <Pressable
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        onPress={() => router.push('/devices/add')}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>
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
    paddingBottom: 100,
  },
  header: {
    marginBottom: spacing.md,
  },
  headerSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
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
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  fabPressed: {
    transform: [{ scale: 0.92 }],
    backgroundColor: colors.primaryDark,
  },
});
