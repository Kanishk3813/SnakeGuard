import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { colors } from '@/lib/theme';
import {
  addNotificationResponseListener,
} from '@/lib/notifications';

function RootLayoutNav() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [user, loading, segments]);

  // Handle notification taps — navigate to detection detail
  useEffect(() => {
    const subscription = addNotificationResponseListener((response) => {
      const detectionId = response.notification.request.content.data?.detectionId;
      if (detectionId) {
        router.push(`/detection/${detectionId}`);
      }
    });

    return () => subscription.remove();
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="detection/[id]"
          options={{
            headerShown: true,
            headerTitle: 'Detection Details',
            headerStyle: { backgroundColor: colors.card },
            headerTintColor: colors.textPrimary,
            headerTitleStyle: { fontWeight: '600' },
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="devices/index"
          options={{
            headerShown: true,
            headerTitle: 'My Devices',
            headerStyle: { backgroundColor: colors.card },
            headerTintColor: colors.textPrimary,
            headerTitleStyle: { fontWeight: '600' },
          }}
        />
        <Stack.Screen
          name="devices/add"
          options={{
            headerShown: true,
            headerTitle: 'Register Device',
            headerStyle: { backgroundColor: colors.card },
            headerTintColor: colors.textPrimary,
            headerTitleStyle: { fontWeight: '600' },
            presentation: 'modal',
          }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}
