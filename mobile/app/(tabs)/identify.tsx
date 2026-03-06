import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { colors, spacing, borderRadius, fontSize } from '@/lib/theme';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

interface ClassificationResult {
  species: string;
  venomous: boolean;
  confidence: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  description?: string;
  firstAid?: string;
}

export default function IdentifyScreen() {
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [classifying, setClassifying] = useState(false);
  const [result, setResult] = useState<ClassificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Launch camera ─────────────────────────────────────────────────────
  const openCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Camera Permission Needed',
        'Please grant camera access in your device settings to use this feature.'
      );
      return;
    }

    const pickerResult = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: false,
    });

    if (!pickerResult.canceled && pickerResult.assets[0]) {
      setCapturedUri(pickerResult.assets[0].uri);
      setResult(null);
      setError(null);
    }
  };

  // ── Pick from gallery ────────────────────────────────────────────────
  const openGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Gallery Permission Needed',
        'Please grant photo library access in your device settings.'
      );
      return;
    }

    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: false,
    });

    if (!pickerResult.canceled && pickerResult.assets[0]) {
      setCapturedUri(pickerResult.assets[0].uri);
      setResult(null);
      setError(null);
    }
  };

  // ── Classify the captured image ──────────────────────────────────────
  const classifyImage = async () => {
    if (!capturedUri) return;
    setClassifying(true);
    setError(null);

    try {
      // Resize and compress to reduce upload size
      const manipulated = await ImageManipulator.manipulateAsync(
        capturedUri,
        [{ resize: { width: 800 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );

      if (!manipulated.base64) {
        throw new Error('Failed to encode image');
      }

      const res = await fetch(`${API_URL}/api/classify-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: manipulated.base64,
          mimeType: 'image/jpeg',
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || 'Classification failed');
      }

      setResult(data.classification);
    } catch (e: any) {
      console.error('Classification error:', e);
      setError(e.message || 'Something went wrong. Please try again.');
    } finally {
      setClassifying(false);
    }
  };

  // ── Reset ────────────────────────────────────────────────────────────
  const resetScreen = () => {
    setCapturedUri(null);
    setResult(null);
    setError(null);
  };

  // ── Result view ─────────────────────────────────────────────────────
  if (result) {
    const riskColor = colors.risk[result.riskLevel] || colors.risk.low;
    const riskBgColor = colors.riskBg[result.riskLevel] || colors.riskBg.low;

    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Captured image */}
        {capturedUri && (
          <Image
            source={{ uri: capturedUri }}
            style={styles.resultImage}
            contentFit="cover"
            transition={200}
          />
        )}

        {/* Main result card */}
        <View style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <Text style={styles.resultSpecies}>{result.species}</Text>
            <View style={[styles.riskBadge, { backgroundColor: riskBgColor }]}>
              <View style={[styles.riskDot, { backgroundColor: riskColor }]} />
              <Text style={[styles.riskLabel, { color: riskColor }]}>
                {result.riskLevel.toUpperCase()} RISK
              </Text>
            </View>
          </View>

          {/* Venom badge */}
          <View
            style={[
              styles.venomBadge,
              {
                backgroundColor: result.venomous
                  ? colors.dangerMuted
                  : colors.primaryMuted,
              },
            ]}
          >
            <Ionicons
              name={result.venomous ? 'warning' : 'shield-checkmark'}
              size={18}
              color={result.venomous ? colors.danger : colors.primary}
            />
            <Text
              style={[
                styles.venomText,
                { color: result.venomous ? colors.danger : colors.primary },
              ]}
            >
              {result.venomous ? 'Venomous' : 'Non-venomous'}
            </Text>
          </View>

          {/* Confidence */}
          <View style={styles.confidenceRow}>
            <Text style={styles.confLabel}>AI Confidence</Text>
            <View style={styles.confBarOuter}>
              <View
                style={[
                  styles.confBarInner,
                  {
                    width: `${Math.round(result.confidence * 100)}%`,
                    backgroundColor:
                      result.confidence > 0.7
                        ? colors.primary
                        : result.confidence > 0.4
                        ? colors.accent
                        : colors.danger,
                  },
                ]}
              />
            </View>
            <Text style={styles.confValue}>
              {(result.confidence * 100).toFixed(0)}%
            </Text>
          </View>
        </View>

        {/* Description */}
        {result.description && (
          <View style={styles.infoCard}>
            <View style={styles.infoCardHeader}>
              <Ionicons name="information-circle" size={18} color={colors.primaryLight} />
              <Text style={styles.infoCardTitle}>About This Species</Text>
            </View>
            <Text style={styles.infoCardText}>{result.description}</Text>
          </View>
        )}

        {/* First Aid */}
        {result.firstAid && result.firstAid.length > 0 && (
          <View style={[styles.infoCard, styles.firstAidCard]}>
            <View style={styles.infoCardHeader}>
              <Ionicons name="medkit" size={18} color={colors.danger} />
              <Text style={[styles.infoCardTitle, { color: colors.danger }]}>
                First Aid
              </Text>
            </View>
            <Text style={styles.infoCardText}>{result.firstAid}</Text>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actionRow}>
          <Pressable
            style={({ pressed }) => [styles.actionBtn, styles.secondaryBtn, pressed && { opacity: 0.8 }]}
            onPress={resetScreen}
          >
            <Ionicons name="camera" size={20} color={colors.primary} />
            <Text style={[styles.actionBtnText, { color: colors.primary }]}>Identify Another</Text>
          </Pressable>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    );
  }

  // ── Preview captured image (before classify) ────────────────────────
  if (capturedUri) {
    return (
      <View style={styles.container}>
        <Image
          source={{ uri: capturedUri }}
          style={styles.previewImage}
          contentFit="cover"
          transition={200}
        />

        {/* Error message */}
        {error && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={18} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Bottom panel */}
        <View style={styles.previewPanel}>
          <Text style={styles.previewTitle}>Ready to identify?</Text>
          <Text style={styles.previewSubtitle}>
            Our AI will analyze this image and identify the snake species, venomous status, and risk level.
          </Text>
          <View style={styles.previewActions}>
            <Pressable
              style={({ pressed }) => [styles.actionBtn, styles.secondaryBtn, pressed && { opacity: 0.8 }]}
              onPress={resetScreen}
              disabled={classifying}
            >
              <Ionicons name="close" size={20} color={colors.textSecondary} />
              <Text style={[styles.actionBtnText, { color: colors.textSecondary }]}>Retake</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.actionBtn,
                styles.primaryBtn,
                pressed && { opacity: 0.8 },
                classifying && { opacity: 0.6 },
              ]}
              onPress={classifyImage}
              disabled={classifying}
            >
              {classifying ? (
                <>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.primaryBtnText}>Classifying…</Text>
                </>
              ) : (
                <>
                  <Ionicons name="search" size={20} color="#fff" />
                  <Text style={styles.primaryBtnText}>Identify Snake</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  // ── Landing / picker screen ─────────────────────────────────────────
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.landingContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero area */}
      <View style={styles.heroArea}>
        <View style={styles.heroIconWrap}>
          <Ionicons name="scan" size={48} color={colors.primary} />
        </View>
        <Text style={styles.heroTitle}>Identify a Snake</Text>
        <Text style={styles.heroSubtitle}>
          Take a photo or pick one from your gallery. Our AI will identify the species, determine if it's venomous, and provide safety guidance.
        </Text>
      </View>

      {/* Action buttons */}
      <View style={styles.landingActions}>
        <Pressable
          style={({ pressed }) => [styles.bigBtn, styles.bigBtnPrimary, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
          onPress={openCamera}
        >
          <View style={styles.bigBtnIcon}>
            <Ionicons name="camera" size={28} color="#fff" />
          </View>
          <View style={styles.bigBtnContent}>
            <Text style={styles.bigBtnTitle}>Take a Photo</Text>
            <Text style={styles.bigBtnSubtitle}>Use your phone camera</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.6)" />
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.bigBtn, styles.bigBtnSecondary, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
          onPress={openGallery}
        >
          <View style={[styles.bigBtnIcon, { backgroundColor: colors.primaryMuted }]}>
            <Ionicons name="images" size={28} color={colors.primary} />
          </View>
          <View style={styles.bigBtnContent}>
            <Text style={[styles.bigBtnTitle, { color: colors.textPrimary }]}>Pick from Gallery</Text>
            <Text style={[styles.bigBtnSubtitle, { color: colors.textMuted }]}>Choose an existing photo</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textDim} />
        </Pressable>
      </View>

      {/* Safety tip */}
      <View style={styles.safetyCard}>
        <View style={styles.safetyHeader}>
          <Ionicons name="warning" size={18} color={colors.accent} />
          <Text style={styles.safetyTitle}>Safety First</Text>
        </View>
        <Text style={styles.safetyText}>
          • Always maintain a safe distance (at least 2 meters){'\n'}
          • Do not attempt to handle or provoke the snake{'\n'}
          • Use zoom if you need a closer shot{'\n'}
          • If bitten, seek medical help immediately
        </Text>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  landingContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: 40,
  },

  // ── Hero ──
  heroArea: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
  },
  heroIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  heroTitle: {
    fontSize: fontSize.xxl,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: spacing.lg,
  },

  // ── Big action buttons ──
  landingActions: {
    gap: spacing.md,
    marginBottom: spacing.xxl,
  },
  bigBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    gap: spacing.md,
  },
  bigBtnPrimary: {
    backgroundColor: colors.primary,
  },
  bigBtnSecondary: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  bigBtnIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigBtnContent: {
    flex: 1,
  },
  bigBtnTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  bigBtnSubtitle: {
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.7)',
  },

  // ── Safety card ──
  safetyCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.accent + '30',
    padding: spacing.xl,
  },
  safetyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  safetyTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.accent,
  },
  safetyText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    lineHeight: 22,
  },

  // ── Preview ──
  previewImage: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  previewPanel: {
    backgroundColor: colors.card,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.xxl,
    paddingTop: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  previewTitle: {
    fontSize: fontSize.xl,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  previewSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    lineHeight: 20,
    marginBottom: spacing.xl,
  },
  previewActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: borderRadius.md,
  },
  secondaryBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
  },
  actionBtnText: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  primaryBtnText: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: '#fff',
  },
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
    gap: spacing.md,
  },

  // ── Error ──
  errorBanner: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 10,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.dangerMuted,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.danger + '40',
  },
  errorText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.danger,
    fontWeight: '500',
  },

  // ── Result ──
  resultImage: {
    width: '100%',
    height: 250,
    backgroundColor: colors.surface,
  },
  resultCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.xl,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  resultHeader: {
    marginBottom: spacing.md,
  },
  resultSpecies: {
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
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    alignSelf: 'flex-start',
    marginBottom: spacing.lg,
  },
  venomText: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  confLabel: {
    fontSize: fontSize.xs,
    color: colors.textDim,
    fontWeight: '600',
    width: 70,
  },
  confBarOuter: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  confBarInner: {
    height: '100%',
    borderRadius: 3,
  },
  confValue: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.textPrimary,
    width: 36,
    textAlign: 'right',
  },

  infoCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.xl,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  firstAidCard: {
    borderColor: colors.danger + '30',
  },
  infoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  infoCardTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  infoCardText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    lineHeight: 22,
  },
});
