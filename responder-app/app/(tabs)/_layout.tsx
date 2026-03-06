import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { colors, fontSize } from '@/lib/theme';
import { useRequests } from '@/hooks/useRequests';

function TabBarIcon({
  name,
  color,
  focused,
}: {
  name: keyof typeof Ionicons.glyphMap;
  color: string;
  focused: boolean;
}) {
  return (
    <View style={styles.iconContainer}>
      <Ionicons name={name} size={22} color={color} />
      {focused && <View style={[styles.activeIndicator, { backgroundColor: color }]} />}
    </View>
  );
}

function RequestsTabIcon({ color, focused }: { color: string; focused: boolean }) {
  const { requests } = useRequests();
  const count = requests.length;

  return (
    <View style={styles.iconContainer}>
      <View>
        <Ionicons name={focused ? 'flash' : 'flash-outline'} size={22} color={color} />
        {count > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{count > 9 ? '9+' : count}</Text>
          </View>
        )}
      </View>
      {focused && <View style={[styles.activeIndicator, { backgroundColor: color }]} />}
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textDim,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.tabBarBorder,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 88 : 64,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: fontSize.xs,
          fontWeight: '600',
          letterSpacing: 0.2,
        },
        headerStyle: {
          backgroundColor: colors.backgroundLight,
          shadowColor: 'transparent',
          elevation: 0,
          borderBottomWidth: 1,
          borderBottomColor: colors.tabBarBorder,
        },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: {
          fontWeight: '700',
          fontSize: fontSize.lg,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerTitle: 'SnakeGuard Responder',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name={focused ? 'home' : 'home-outline'} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="requests"
        options={{
          title: 'Requests',
          headerTitle: 'Assignment Requests',
          tabBarIcon: ({ color, focused }) => (
            <RequestsTabIcon color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          title: 'My Jobs',
          headerTitle: 'My Assignments',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              name={focused ? 'briefcase' : 'briefcase-outline'}
              color={color}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          headerTitle: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              name={focused ? 'person' : 'person-outline'}
              color={color}
              focused={focused}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  activeIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    backgroundColor: colors.danger,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: colors.tabBar,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },
});
