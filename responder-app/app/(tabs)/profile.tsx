import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useAuth } from '@/contexts/AuthContext';
import { apiGet, apiPost } from '@/hooks/useApi';
import { colors, borderRadius, spacing, fontSize, shadows } from '@/lib/theme';

export default function ProfileScreen() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const [location, setLocation] = useState<{ lat: number; lng: number; updated_at?: string } | null>(null);
  const [updatingLocation, setUpdatingLocation] = useState(false);
  const [loadingLocation, setLoadingLocation] = useState(true);

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'Responder';

  useEffect(() => {
    fetchSavedLocation();
  }, []);

  const fetchSavedLocation = async () => {
    try {
      const data = await apiGet('/api/responders/location');
      setLocation(data.location);
    } catch (err) {
      console.error('Error fetching location:', err);
    } finally {
      setLoadingLocation(false);
    }
  };

  const updateLocation = async () => {
    try {
      setUpdatingLocation(true);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to update your position.');
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const result = await apiPost('/api/responders/location', {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });

      setLocation(result.location);
      Alert.alert('Success', 'Your location has been updated successfully.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update location');
    } finally {
      setUpdatingLocation(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: signOut },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile Header */}
      <View style={[styles.profileCard, shadows.md]}>
        <View style={styles.avatarLarge}>
          <Ionicons name="shield-checkmark" size={36} color={colors.primary} />
        </View>
        <Text style={styles.name}>{displayName}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <View style={styles.responderBadge}>
          <Ionicons name="flash" size={12} color={colors.primary} />
          <Text style={styles.badgeText}>ACTIVE RESPONDER</Text>
        </View>
      </View>

      {/* Location Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="location" size={20} color={colors.primary} />
          <Text style={styles.sectionTitle}>My Location</Text>
        </View>

        <View style={[styles.locationCard, shadows.sm]}>
          {loadingLocation ? (
            <ActivityIndicator color={colors.primary} />
          ) : location ? (
            <>
              <View style={styles.locationRow}>
                <View style={styles.coordBox}>
                  <Text style={styles.coordLabel}>Latitude</Text>
                  <Text style={styles.coordValue}>{location.lat.toFixed(6)}</Text>
                </View>
                <View style={styles.coordBox}>
                  <Text style={styles.coordLabel}>Longitude</Text>
                  <Text style={styles.coordValue}>{location.lng.toFixed(6)}</Text>
                </View>
              </View>
              {location.updated_at && (
                <Text style={styles.locationUpdated}>
                  Updated {new Date(location.updated_at).toLocaleString()}
                </Text>
              )}
            </>
          ) : (
            <View style={styles.noLocation}>
              <Ionicons name="location-outline" size={32} color={colors.textDim} />
              <Text style={styles.noLocationText}>No location set</Text>
              <Text style={styles.noLocationHint}>
                Update your location so nearby detections can be assigned to you.
              </Text>
            </View>
          )}

          <Pressable
            style={({ pressed }) => [
              styles.updateLocationBtn,
              shadows.glow(colors.primary),
              pressed && styles.btnPressed,
              updatingLocation && styles.btnDisabled,
            ]}
            onPress={updateLocation}
            disabled={updatingLocation}
          >
            {updatingLocation ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="navigate" size={18} color="#fff" />
                <Text style={styles.updateLocationText}>
                  {location ? 'Update Location' : 'Set My Location'}
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </View>

      {/* Info Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="information-circle" size={20} color={colors.info} />
          <Text style={styles.sectionTitle}>How It Works</Text>
        </View>

        <View style={[styles.infoCard, shadows.sm]}>
          {[
            { icon: 'flash', text: 'Receive assignment requests when a snake is detected near you', color: colors.warning },
            { icon: 'checkmark-circle', text: 'Accept to claim the assignment and view full details', color: colors.success },
            { icon: 'navigate', text: 'Navigate to the detection location using maps', color: colors.info },
            { icon: 'clipboard', text: 'Follow the safety checklist and update your status', color: colors.primary },
          ].map((item, i) => (
            <View key={i} style={styles.infoRow}>
              <View style={[styles.infoIconWrap, { backgroundColor: item.color + '18' }]}>
                <Ionicons name={item.icon as any} size={16} color={item.color} />
              </View>
              <Text style={styles.infoRowText}>{item.text}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Sign out */}
      <Pressable
        style={({ pressed }) => [styles.signOutBtn, pressed && { opacity: 0.8 }]}
        onPress={handleSignOut}
      >
        <Ionicons name="log-out-outline" size={20} color={colors.danger} />
        <Text style={styles.signOutText}>Sign Out</Text>
      </Pressable>

      <Text style={styles.version}>SnakeGuard Responder v1.0.0</Text>

      <View style={{ height: 40 }} />
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
  profileCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xxl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.xxl,
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  avatarLarge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.primary + '40',
    marginBottom: spacing.sm,
  },
  name: {
    fontSize: fontSize.xxl,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  email: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  responderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primaryMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  badgeText: {
    fontSize: fontSize.xs,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 1,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  locationCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.lg,
  },
  locationRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  coordBox: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  coordLabel: {
    fontSize: fontSize.xs,
    color: colors.textDim,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  coordValue: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  locationUpdated: {
    fontSize: fontSize.xs,
    color: colors.textDim,
    marginBottom: spacing.md,
  },
  noLocation: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  noLocationText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.textMuted,
  },
  noLocationHint: {
    fontSize: fontSize.sm,
    color: colors.textDim,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: spacing.md,
  },
  updateLocationBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  updateLocationText: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: '#fff',
  },
  btnPressed: {
    backgroundColor: colors.primaryDark,
    transform: [{ scale: 0.98 }],
  },
  btnDisabled: {
    opacity: 0.7,
  },
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.lg,
    gap: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  infoIconWrap: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoRowText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.dangerMuted,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.danger + '20',
    height: 48,
    marginTop: spacing.md,
  },
  signOutText: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.danger,
  },
  version: {
    fontSize: fontSize.xs,
    color: colors.textDim,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
