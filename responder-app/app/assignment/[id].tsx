import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { apiGet, apiPatch } from '@/hooks/useApi';
import { supabase } from '@/lib/supabase';
import { ResponderAssignment, IncidentAssignment } from '@/lib/types';
import { colors, borderRadius, spacing, fontSize, shadows } from '@/lib/theme';

export default function AssignmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [assignment, setAssignment] = useState<ResponderAssignment | null>(null);
  const [incident, setIncident] = useState<IncidentAssignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    fetchAssignment();
  }, [id]);

  const fetchAssignment = async () => {
    try {
      // Fetch assignment details using user-scoped query
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      
      const data = await apiGet(`/api/responders/assignments?responder_id=${session.user.id}`);
      const found = (data.assignments || []).find(
        (a: ResponderAssignment) => a.id === id
      );
      if (found) {
        setAssignment(found);
        // Try to fetch incident/playbook for this detection
        try {
          const incidentData = await apiGet(`/api/incidents?detection_id=${found.detection_id}`);
          if (incidentData.incidents?.[0]) {
            setIncident(incidentData.incidents[0]);
          }
        } catch {
          // Incident may not exist, that's okay
        }
      }
    } catch (err: any) {
      console.error('Error fetching assignment:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (newStatus: string) => {
    if (!assignment) return;

    const statusMessages: Record<string, string> = {
      in_progress: 'Mark as En Route? This tells the system you\'re heading to the location.',
      completed: 'Mark as Completed? This indicates the snake has been handled.',
      cancelled: 'Cancel this assignment? It may be reassigned to another responder.',
    };

    Alert.alert(
      'Update Status',
      statusMessages[newStatus] || 'Update the assignment status?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: newStatus === 'cancelled' ? 'destructive' : 'default',
          onPress: async () => {
            try {
              setUpdatingStatus(true);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              await apiPatch(`/api/responders/assignments/${assignment.id}`, {
                status: newStatus,
              });
              setAssignment(prev => prev ? { ...prev, status: newStatus as any } : null);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to update status');
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            } finally {
              setUpdatingStatus(false);
            }
          },
        },
      ]
    );
  };

  const openMaps = () => {
    if (!assignment?.detection) return;
    const { latitude, longitude } = assignment.detection;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
    Linking.openURL(url);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!assignment) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.textDim} />
        <Text style={styles.errorText}>Assignment not found</Text>
      </View>
    );
  }

  const det = assignment.detection;
  const riskLevel = det?.risk_level || 'medium';
  const riskColor = colors.risk[riskLevel] || colors.primary;
  const statusColor = colors.status[assignment.status] || colors.textMuted;

  const statusLabels: Record<string, string> = {
    assigned: 'Assigned',
    in_progress: 'En Route',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Detection Image */}
      {det?.image_url && (
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: det.image_url }}
            style={styles.detectionImage}
            contentFit="cover"
            transition={300}
          />
          <View style={[styles.riskOverlay, { backgroundColor: riskColor + '20' }]}>
            <View style={[styles.riskDot, { backgroundColor: riskColor }]} />
            <Text style={[styles.riskOverlayText, { color: riskColor }]}>
              {riskLevel.toUpperCase()} RISK
            </Text>
          </View>
        </View>
      )}

      {/* Status Card */}
      <View style={[styles.statusCard, shadows.md]}>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Current Status</Text>
          <View style={[styles.statusBadge, { backgroundColor: colors.statusBg[assignment.status] }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusBadgeText, { color: statusColor }]}>
              {statusLabels[assignment.status]}
            </Text>
          </View>
        </View>

        {/* Status action buttons */}
        <View style={styles.statusActions}>
          {assignment.status === 'assigned' && (
            <Pressable
              style={({ pressed }) => [
                styles.statusBtn,
                { backgroundColor: colors.info },
                shadows.glow(colors.info),
                pressed && styles.statusBtnPressed,
                updatingStatus && styles.btnDisabled,
              ]}
              onPress={() => updateStatus('in_progress')}
              disabled={updatingStatus}
            >
              <Ionicons name="navigate" size={18} color="#fff" />
              <Text style={styles.statusBtnText}>Start — En Route</Text>
            </Pressable>
          )}

          {assignment.status === 'in_progress' && (
            <Pressable
              style={({ pressed }) => [
                styles.statusBtn,
                { backgroundColor: colors.success },
                shadows.glow(colors.success),
                pressed && styles.statusBtnPressed,
                updatingStatus && styles.btnDisabled,
              ]}
              onPress={() => updateStatus('completed')}
              disabled={updatingStatus}
            >
              <Ionicons name="checkmark-circle" size={18} color="#fff" />
              <Text style={styles.statusBtnText}>Mark Completed</Text>
            </Pressable>
          )}

          {(assignment.status === 'assigned' || assignment.status === 'in_progress') && (
            <Pressable
              style={({ pressed }) => [
                styles.cancelBtn,
                pressed && { opacity: 0.7 },
                updatingStatus && styles.btnDisabled,
              ]}
              onPress={() => updateStatus('cancelled')}
              disabled={updatingStatus}
            >
              <Text style={styles.cancelBtnText}>Cancel Assignment</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Species Info */}
      <View style={[styles.infoCard, shadows.sm]}>
        <Text style={styles.cardTitle}>Species Information</Text>

        <View style={styles.infoGrid}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Species</Text>
            <Text style={styles.infoValue}>{det?.species || 'Unknown'}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Venomous</Text>
            <Text style={[styles.infoValue, { color: det?.venomous ? colors.danger : colors.success }]}>
              {det?.venomous ? 'Yes — Caution!' : 'Non-venomous'}
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Confidence</Text>
            <Text style={styles.infoValue}>
              {det?.confidence ? `${(det.confidence * 100).toFixed(0)}%` : 'N/A'}
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Risk Level</Text>
            <Text style={[styles.infoValue, { color: riskColor }]}>
              {riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)}
            </Text>
          </View>
        </View>

        {det?.classification_description && (
          <View style={styles.descriptionBox}>
            <Text style={styles.descriptionLabel}>Description</Text>
            <Text style={styles.descriptionText}>{det.classification_description}</Text>
          </View>
        )}
      </View>

      {/* First Aid */}
      {det?.classification_first_aid && (
        <View style={[styles.firstAidCard, shadows.sm]}>
          <View style={styles.firstAidHeader}>
            <Ionicons name="medkit" size={20} color={colors.danger} />
            <Text style={styles.firstAidTitle}>First Aid Information</Text>
          </View>
          <Text style={styles.firstAidText}>{det.classification_first_aid}</Text>
        </View>
      )}

      {/* Navigate button */}
      {det?.latitude && det?.longitude && (
        <Pressable
          style={({ pressed }) => [
            styles.navigateBtn,
            shadows.glow(colors.info),
            pressed && styles.statusBtnPressed,
          ]}
          onPress={openMaps}
        >
          <Ionicons name="navigate" size={20} color="#fff" />
          <Text style={styles.navigateBtnText}>Navigate to Location</Text>
          <Text style={styles.navigateCoords}>
            {det.latitude.toFixed(4)}, {det.longitude.toFixed(4)}
          </Text>
        </Pressable>
      )}

      {/* Playbook Checklist */}
      {incident?.playbook && (
        <View style={[styles.infoCard, shadows.sm]}>
          <View style={styles.playbookHeader}>
            <Ionicons name="clipboard" size={20} color={colors.primary} />
            <Text style={styles.cardTitle}>{incident.playbook.title}</Text>
          </View>

          {incident.steps_state?.map((step, i) => (
            <View key={step.id} style={[styles.checklistItem, step.completed && styles.checklistDone]}>
              <View style={[styles.checkCircle, step.completed && styles.checkCircleDone]}>
                {step.completed ? (
                  <Ionicons name="checkmark" size={14} color="#fff" />
                ) : (
                  <Text style={styles.checkNum}>{i + 1}</Text>
                )}
              </View>
              <Text style={[styles.checkText, step.completed && styles.checkTextDone]}>
                {step.title}
              </Text>
            </View>
          ))}

          {/* Emergency contacts */}
          {incident.playbook.contacts?.length > 0 && (
            <View style={styles.contactsSection}>
              <Text style={styles.contactsTitle}>Emergency Contacts</Text>
              {incident.playbook.contacts.map(contact => (
                <View key={contact.id} style={styles.contactRow}>
                  <View style={styles.contactInfo}>
                    <Text style={styles.contactName}>{contact.name}</Text>
                    {contact.role && <Text style={styles.contactRole}>{contact.role}</Text>}
                  </View>
                  {contact.phone && (
                    <Pressable
                      style={styles.callBtn}
                      onPress={() => Linking.openURL(`tel:${contact.phone}`)}
                    >
                      <Ionicons name="call" size={16} color={colors.success} />
                    </Pressable>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      <View style={{ height: 60 }} />
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
  imageContainer: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    marginBottom: spacing.lg,
    position: 'relative',
  },
  detectionImage: {
    width: '100%',
    height: 220,
  },
  riskOverlay: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  riskDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  riskOverlayText: {
    fontSize: fontSize.xs,
    fontWeight: '800',
    letterSpacing: 1,
  },
  statusCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  statusLabel: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  statusActions: {
    gap: spacing.sm,
  },
  statusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 52,
    borderRadius: borderRadius.lg,
  },
  statusBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  statusBtnText: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: '#fff',
  },
  cancelBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.dangerMuted,
    borderWidth: 1,
    borderColor: colors.danger + '20',
  },
  cancelBtnText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.danger,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  cardTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  infoItem: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoLabel: {
    fontSize: fontSize.xs,
    color: colors.textDim,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  descriptionBox: {
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  descriptionLabel: {
    fontSize: fontSize.xs,
    color: colors.textDim,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  descriptionText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  firstAidCard: {
    backgroundColor: colors.dangerMuted,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.danger + '20',
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  firstAidHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  firstAidTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.danger,
  },
  firstAidText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  navigateBtn: {
    backgroundColor: colors.info,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  navigateBtnText: {
    flex: 1,
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: '#fff',
  },
  navigateCoords: {
    fontSize: fontSize.xs,
    color: 'rgba(255,255,255,0.7)',
    fontVariant: ['tabular-nums'],
  },
  playbookHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  checklistDone: {
    backgroundColor: colors.successMuted,
    borderColor: colors.success + '30',
  },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.textDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleDone: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  checkNum: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.textDim,
  },
  checkText: {
    flex: 1,
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  checkTextDone: {
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  contactsSection: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  contactsTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.md,
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
    color: colors.textMuted,
  },
  callBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.successMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.success + '30',
  },
});
