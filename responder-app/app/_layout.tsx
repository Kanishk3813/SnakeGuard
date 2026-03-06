import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { colors } from '@/lib/theme';
import { addNotificationResponseListener } from '@/lib/notifications';

function RootLayoutNav() {
  const { user, loading, profile } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (user && profile?.is_responder && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [user, loading, segments, profile]);

  // Handle notification taps — navigate to assignment detail
  useEffect(() => {
    const subscription = addNotificationResponseListener((response) => {
      const detectionId = response.notification.request.content.data?.detectionId;
      if (detectionId) {
        router.push(`/assignment/${detectionId}`);
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
          name="assignment/[id]"
          options={{
            headerShown: true,
            headerTitle: 'Assignment Details',
            headerStyle: { backgroundColor: colors.backgroundLight },
            headerTintColor: colors.textPrimary,
            headerTitleStyle: { fontWeight: '600' },
            presentation: 'card',
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
