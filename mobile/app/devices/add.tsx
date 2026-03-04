import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useDevices } from '@/hooks/useDevices';
import { colors, borderRadius, spacing, fontSize } from '@/lib/theme';

export default function AddDeviceScreen() {
  const router = useRouter();
  const { addDevice } = useDevices();

  const [deviceId, setDeviceId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [streamUrl, setStreamUrl] = useState('');
  const [streamPort, setStreamPort] = useState('8000');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!deviceId.trim()) {
      setError('Device ID is required');
      return;
    }
    if (!name.trim()) {
      setError('Device name is required');
      return;
    }

    setError('');
    setLoading(true);

    const deviceData: any = {
      device_id: deviceId.trim(),
      name: name.trim(),
    };

    if (description.trim()) deviceData.description = description.trim();
    if (latitude.trim()) deviceData.latitude = parseFloat(latitude);
    if (longitude.trim()) deviceData.longitude = parseFloat(longitude);
    if (streamUrl.trim()) deviceData.stream_url = streamUrl.trim();
    if (streamPort.trim()) deviceData.stream_port = parseInt(streamPort, 10);

    const result = await addDevice(deviceData);

    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      Alert.alert('Success', 'Device registered successfully!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <Ionicons name="information-circle" size={20} color={colors.primary} />
          <Text style={styles.infoText}>
            Enter the Device ID shown on your Raspberry Pi. You can find it by running
            the registration script on your Pi.
          </Text>
        </View>

        {error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={16} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Required Fields */}
        <Text style={styles.sectionLabel}>REQUIRED</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Device ID</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="hardware-chip-outline" size={18} color={colors.textDim} />
            <TextInput
              style={styles.input}
              placeholder="e.g. aa:bb:cc:dd:ee:ff"
              placeholderTextColor={colors.textDim}
              value={deviceId}
              onChangeText={setDeviceId}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <Text style={styles.inputHint}>
            MAC address or hostname from your Raspberry Pi
          </Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Device Name</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="text-outline" size={18} color={colors.textDim} />
            <TextInput
              style={styles.input}
              placeholder="e.g. Front Yard Camera"
              placeholderTextColor={colors.textDim}
              value={name}
              onChangeText={setName}
            />
          </View>
        </View>

        {/* Optional Fields */}
        <Text style={[styles.sectionLabel, { marginTop: spacing.xxl }]}>OPTIONAL</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Description</Text>
          <View style={[styles.inputContainer, { height: 80, alignItems: 'flex-start', paddingTop: spacing.md }]}>
            <Ionicons name="document-text-outline" size={18} color={colors.textDim} style={{ marginTop: 2 }} />
            <TextInput
              style={[styles.input, { textAlignVertical: 'top' }]}
              placeholder="Optional description..."
              placeholderTextColor={colors.textDim}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
            />
          </View>
        </View>

        {/* Location */}
        <View style={styles.inputRow}>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.inputLabel}>Latitude</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="e.g. 28.6139"
                placeholderTextColor={colors.textDim}
                value={latitude}
                onChangeText={setLatitude}
                keyboardType="decimal-pad"
              />
            </View>
          </View>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.inputLabel}>Longitude</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="e.g. 77.2090"
                placeholderTextColor={colors.textDim}
                value={longitude}
                onChangeText={setLongitude}
                keyboardType="decimal-pad"
              />
            </View>
          </View>
        </View>

        {/* Stream Settings */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Stream URL</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="videocam-outline" size={18} color={colors.textDim} />
            <TextInput
              style={styles.input}
              placeholder="e.g. http://192.168.1.100:8000/stream.mjpg"
              placeholderTextColor={colors.textDim}
              value={streamUrl}
              onChangeText={setStreamUrl}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <Text style={styles.inputHint}>
            MJPEG stream URL from your Pi's stream server
          </Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Stream Port</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="globe-outline" size={18} color={colors.textDim} />
            <TextInput
              style={styles.input}
              placeholder="8000"
              placeholderTextColor={colors.textDim}
              value={streamPort}
              onChangeText={setStreamPort}
              keyboardType="number-pad"
            />
          </View>
        </View>

        {/* Submit Button */}
        <Pressable
          style={({ pressed }) => [
            styles.submitButton,
            pressed && styles.submitPressed,
            loading && styles.submitDisabled,
          ]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="add-circle" size={20} color="#fff" />
              <Text style={styles.submitText}>Register Device</Text>
            </>
          )}
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  infoBanner: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.primaryMuted,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  infoText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.dangerMuted,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  errorText: {
    fontSize: fontSize.sm,
    color: colors.danger,
    flex: 1,
  },
  sectionLabel: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.textDim,
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  inputLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    paddingHorizontal: spacing.lg,
    height: 52,
    gap: spacing.md,
  },
  input: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.textPrimary,
  },
  inputHint: {
    fontSize: fontSize.xs,
    color: colors.textDim,
    marginTop: 4,
    marginLeft: 4,
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    height: 52,
    marginTop: spacing.lg,
  },
  submitPressed: {
    backgroundColor: colors.primaryDark,
  },
  submitDisabled: {
    opacity: 0.7,
  },
  submitText: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: '#fff',
  },
});
