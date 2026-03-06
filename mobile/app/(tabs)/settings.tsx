import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useDevices } from '@/hooks/useDevices';
import { colors, borderRadius, spacing, fontSize, shadows } from '@/lib/theme';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, profile, signOut } = useAuth();
  const { devices } = useDevices();

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  };

  const displayName = profile?.full_name || 'User';
  const initial = (displayName[0] || '?').toUpperCase();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Profile Card */}
      <View style={[styles.profileCard, shadows.md]}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{displayName}</Text>
          <Text style={styles.profileEmail}>{user?.email}</Text>
          {profile?.is_responder && (
            <View style={styles.responderBadge}>
              <Ionicons name="shield-checkmark" size={12} color={colors.primary} />
              <Text style={styles.responderText}>Responder</Text>
            </View>
          )}
        </View>
      </View>

      {/* Devices Section */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>DEVICES</Text>
        <View style={styles.sectionCard}>
          <SettingsRow
            icon="hardware-chip-outline"
            iconColor={colors.accent}
            label="My Devices"
            value={`${devices.length} registered`}
            onPress={() => router.push('/devices')}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="add-circle-outline"
            iconColor={colors.primary}
            label="Register New Device"
            onPress={() => router.push('/devices/add')}
          />
        </View>
      </View>

      {/* Notifications Section */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>NOTIFICATIONS</Text>
        <View style={styles.sectionCard}>
          <SettingsRow
            icon="notifications-outline"
            iconColor={colors.info}
            label="Push Notifications"
            value="Enabled"
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="mail-outline"
            iconColor={colors.primaryLight}
            label="Email Alerts"
            value="Enabled"
          />
        </View>
      </View>

      {/* About Section */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>ABOUT</Text>
        <View style={styles.sectionCard}>
          <SettingsRow
            icon="information-circle-outline"
            iconColor={colors.textMuted}
            label="App Version"
            value="1.0.0"
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="shield-checkmark-outline"
            iconColor={colors.textMuted}
            label="Privacy Policy"
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="document-text-outline"
            iconColor={colors.textMuted}
            label="Terms of Service"
          />
        </View>
      </View>

      {/* Sign Out */}
      <Pressable
        style={({ pressed }) => [styles.signOutButton, pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] }]}
        onPress={handleSignOut}
      >
        <Ionicons name="log-out-outline" size={20} color={colors.danger} />
        <Text style={styles.signOutText}>Sign Out</Text>
      </Pressable>

      <Text style={styles.footerText}>SnakeGuard © 2026</Text>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function SettingsRow({
  icon,
  iconColor,
  label,
  value,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  label: string;
  value?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && onPress && styles.rowPressed]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={[styles.rowIconWrap, { backgroundColor: (iconColor || colors.textMuted) + '15' }]}>
        <Ionicons name={icon} size={18} color={iconColor || colors.textMuted} />
      </View>
      <Text style={styles.rowLabel}>{label}</Text>
      {value && <Text style={styles.rowValue}>{value}</Text>}
      {onPress && (
        <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
      )}
    </Pressable>
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

  // Profile
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.xl,
    marginBottom: spacing.xxl,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.primary + '40',
  },
  avatarText: {
    fontSize: fontSize.xxl,
    fontWeight: '800',
    color: colors.primary,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: fontSize.xl,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  profileEmail: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
  responderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primaryMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
  },
  responderText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.primary,
  },

  // Sections
  section: {
    marginBottom: spacing.xl,
  },
  sectionLabel: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.textDim,
    letterSpacing: 1.2,
    marginBottom: spacing.sm,
    marginLeft: 4,
  },
  sectionCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
  },
  divider: {
    height: 1,
    backgroundColor: colors.cardBorder,
    marginLeft: 56,
  },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  rowPressed: {
    backgroundColor: colors.surface,
  },
  rowIconWrap: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  rowValue: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },

  // Sign out
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.dangerMuted,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.danger + '20',
    paddingVertical: spacing.lg,
    marginTop: spacing.md,
  },
  signOutText: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.danger,
  },

  footerText: {
    textAlign: 'center',
    fontSize: fontSize.xs,
    color: colors.textDim,
    marginTop: spacing.xxl,
  },
});
