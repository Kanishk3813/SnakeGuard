import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Linking,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { SnakeDetection, IncidentAssignment } from '@/lib/types';
import { colors, borderRadius, spacing, fontSize } from '@/lib/theme';

export default function DetectionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [detection, setDetection] = useState<SnakeDetection | null>(null);
  const [assignment, setAssignment] = useState<IncidentAssignment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDetection();
  }, [id]);

  const fetchDetection = async () => {
    if (!id) return;

    const { data, error } = await supabase
      .from('snake_detections')
      .select('*')
      .eq('id', id)
      .single();

    if (!error && data) {
      setDetection(data);

      // Try to fetch incident assignment
      const { data: assignmentData } = await supabase
        .from('incident_assignments')
        .select('*, playbook:incident_playbooks(*)')
        .eq('detection_id', id)
        .maybeSingle();

      if (assignmentData) {
        setAssignment(assignmentData);
      }
    }

    setLoading(false);
  };

  const openMaps = () => {
    if (!detection?.latitude || !detection?.longitude) return;
    const url = `https://maps.google.com/?q=${detection.latitude},${detection.longitude}`;
    Linking.openURL(url);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!detection) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.textDim} />
        <Text style={styles.errorText}>Detection not found</Text>
      </View>
    );
  }

  const riskLevel = detection.risk_level || 'low';
  const riskColor = colors.risk[riskLevel] || colors.risk.low;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Detection Image */}
      {detection.image_url ? (
        <Image
          source={{ uri: detection.image_url }}
          style={styles.heroImage}
          contentFit="cover"
          transition={300}
        />
      ) : (
        <View style={[styles.heroImage, styles.placeholderImage]}>
          <Ionicons name="image-outline" size={48} color={colors.textDim} />
        </View>
      )}

      {/* Main Info Card */}
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={styles.speciesName}>
              {detection.species || 'Unclassified Snake'}
            </Text>
            <View style={[styles.riskBadge, { backgroundColor: riskColor + '20' }]}>
              <View style={[styles.riskDot, { backgroundColor: riskColor }]} />
              <Text style={[styles.riskLabel, { color: riskColor }]}>
                {riskLevel.toUpperCase()} RISK
              </Text>
            </View>
          </View>
          {detection.venomous !== undefined && (
            <View
              style={[
                styles.venomBadge,
                {
                  backgroundColor: detection.venomous
                    ? colors.dangerMuted
                    : colors.primaryMuted,
                },
              ]}
            >
              <Ionicons
                name={detection.venomous ? 'warning' : 'shield-checkmark'}
                size={16}
                color={detection.venomous ? colors.danger : colors.primary}
              />
              <Text
                style={[
                  styles.venomText,
                  { color: detection.venomous ? colors.danger : colors.primary },
                ]}
              >
                {detection.venomous ? 'Venomous' : 'Non-venomous'}
              </Text>
            </View>
          )}
        </View>

        {/* Stats Row */}
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {(detection.confidence * 100).toFixed(1)}%
            </Text>
            <Text style={styles.statLabel}>Confidence</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {new Date(detection.timestamp).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
            <Text style={styles.statLabel}>Time</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {new Date(detection.timestamp).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}
            </Text>
            <Text style={styles.statLabel}>Date</Text>
          </View>
        </View>
      </View>

      {/* Location Card */}
      {detection.latitude && detection.longitude && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="location" size={18} color={colors.primary} />
            <Text style={styles.cardTitle}>Location</Text>
          </View>
          <Text style={styles.coordsText}>
            {detection.latitude.toFixed(6)}, {detection.longitude.toFixed(6)}
          </Text>
          <Pressable
            style={({ pressed }) => [styles.mapButton, pressed && { opacity: 0.8 }]}
            onPress={openMaps}
          >
            <Ionicons name="map-outline" size={16} color={colors.primary} />
            <Text style={styles.mapButtonText}>Open in Maps</Text>
          </Pressable>
        </View>
      )}

      {/* Description */}
      {detection.classification_description && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="information-circle" size={18} color={colors.primaryLight} />
            <Text style={styles.cardTitle}>About This Species</Text>
          </View>
          <Text style={styles.descriptionText}>
            {detection.classification_description}
          </Text>
        </View>
      )}

      {/* First Aid */}
      {detection.classification_first_aid && (
        <View style={[styles.card, styles.firstAidCard]}>
          <View style={styles.cardHeader}>
            <Ionicons name="medkit" size={18} color={colors.danger} />
            <Text style={[styles.cardTitle, { color: colors.danger }]}>First Aid</Text>
          </View>
          <Text style={styles.firstAidText}>
            {detection.classification_first_aid}
          </Text>
        </View>
      )}

      {/* Incident Playbook */}
      {assignment?.playbook && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="clipboard" size={18} color={colors.accent} />
            <Text style={styles.cardTitle}>Response Playbook</Text>
          </View>
          <Text style={styles.playbookTitle}>{assignment.playbook.title}</Text>

          {assignment.steps_state && assignment.steps_state.length > 0 && (
            <View style={styles.checklist}>
              {assignment.steps_state.map((step, idx) => (
                <View key={step.id} style={styles.checkItem}>
                  <Ionicons
                    name={step.completed ? 'checkmark-circle' : 'ellipse-outline'}
                    size={20}
                    color={step.completed ? colors.primary : colors.textDim}
                  />
                  <Text
                    style={[
                      styles.checkText,
                      step.completed && styles.checkTextDone,
                    ]}
                  >
                    {step.title}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Emergency Contacts */}
          {assignment.playbook.contacts && assignment.playbook.contacts.length > 0 && (
            <View style={styles.contactsSection}>
              <Text style={styles.contactsTitle}>Emergency Contacts</Text>
              {assignment.playbook.contacts.map((contact) => (
                <View key={contact.id} style={styles.contactRow}>
                  <View style={styles.contactInfo}>
                    <Text style={styles.contactName}>{contact.name}</Text>
                    {contact.role && (
                      <Text style={styles.contactRole}>{contact.role}</Text>
                    )}
                  </View>
                  {contact.phone && (
                    <Pressable
                      style={styles.callButton}
                      onPress={() => Linking.openURL(`tel:${contact.phone}`)}
                    >
                      <Ionicons name="call" size={16} color={colors.primary} />
                    </Pressable>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Status */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="flag" size={18} color={colors.textMuted} />
          <Text style={styles.cardTitle}>Status</Text>
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Processing:</Text>
          <Text style={[styles.statusValue, { color: detection.processed ? colors.primary : colors.accent }]}>
            {detection.processed ? 'Completed' : 'Pending'}
          </Text>
        </View>
        {detection.status && (
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Review:</Text>
            <Text style={styles.statusValue}>{detection.status}</Text>
          </View>
        )}
      </View>

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
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    gap: spacing.md,
  },
  errorText: {
    fontSize: fontSize.md,
    color: colors.textMuted,
  },
  heroImage: {
    width: '100%',
    height: 260,
    backgroundColor: colors.surface,
  },
  placeholderImage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.xl,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  headerLeft: {
    flex: 1,
  },
  speciesName: {
    fontSize: fontSize.xxl,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  riskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
  },
  riskDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  riskLabel: {
    fontSize: fontSize.xs,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  venomBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  venomText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  statsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: colors.textDim,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  coordsText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontFamily: 'monospace',
    marginBottom: spacing.md,
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary + '40',
    alignSelf: 'flex-start',
  },
  mapButtonText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.primary,
  },
  descriptionText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  firstAidCard: {
    borderColor: colors.danger + '30',
  },
  firstAidText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  playbookTitle: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  checklist: {
    gap: spacing.md,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  checkText: {
    fontSize: fontSize.md,
    color: colors.textPrimary,
    flex: 1,
  },
  checkTextDone: {
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  contactsSection: {
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  contactsTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.textMuted,
    marginBottom: spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  contactRole: {
    fontSize: fontSize.xs,
    color: colors.textDim,
    marginTop: 2,
  },
  callButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  statusLabel: {
    fontSize: fontSize.sm,
    color: colors.textDim,
  },
  statusValue: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'capitalize',
  },
});
