import React, { useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { colors, borderRadius, spacing, fontSize } from '@/lib/theme';

interface LiveStreamViewProps {
  streamUrl: string;
  deviceName: string;
  onError?: () => void;
}

export function LiveStreamView({ streamUrl, deviceName, onError }: LiveStreamViewProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // MJPEG streams are displayed via an HTML img tag in a WebView
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          background: #0F1A15;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100vh;
          overflow: hidden;
        }
        img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }
        .error {
          color: #6B8F7B;
          text-align: center;
          font-family: system-ui;
          font-size: 14px;
          padding: 20px;
        }
      </style>
    </head>
    <body>
      <img
        src="${streamUrl}"
        alt="Live Feed"
        onerror="document.body.innerHTML='<div class=\\'error\\'>Stream unavailable.<br>Check device connection.</div>'; window.ReactNativeWebView.postMessage('error');"
        onload="window.ReactNativeWebView.postMessage('loaded');"
      />
    </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.liveIndicator}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
        <Text style={styles.deviceName} numberOfLines={1}>
          {deviceName}
        </Text>
      </View>

      <View style={styles.streamContainer}>
        {loading && !error && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Connecting to stream...</Text>
          </View>
        )}

        {error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="videocam-off" size={48} color={colors.textDim} />
            <Text style={styles.errorTitle}>Stream Unavailable</Text>
            <Text style={styles.errorText}>
              Make sure your device is online and the stream server is running.
            </Text>
          </View>
        ) : (
          <WebView
            source={{ html }}
            style={styles.webview}
            scrollEnabled={false}
            javaScriptEnabled={true}
            onMessage={(event) => {
              if (event.nativeEvent.data === 'loaded') {
                setLoading(false);
              } else if (event.nativeEvent.data === 'error') {
                setLoading(false);
                setError(true);
                onError?.();
              }
            }}
            onError={() => {
              setLoading(false);
              setError(true);
              onError?.();
            }}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.dangerMuted,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.danger,
  },
  liveText: {
    fontSize: fontSize.xs,
    fontWeight: '800',
    color: colors.danger,
    letterSpacing: 1,
  },
  deviceName: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
  },
  streamContainer: {
    flex: 1,
    backgroundColor: '#000',
    position: 'relative',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    zIndex: 10,
  },
  loadingText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: spacing.md,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxxl,
  },
  errorTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: spacing.lg,
  },
  errorText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 20,
  },
});
