import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/theme';
import { useUpdateStore } from '@/updates/store';

export default function TabsLayout() {
  const hasUpdate = useUpdateStore(
    (state) => state.status === 'available' || state.status === 'ready'
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '700',
          marginBottom: 2,
        },
        tabBarIconStyle: { marginTop: 2 },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Сегодня',
          tabBarAccessibilityLabel: 'Сегодня',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'today' : 'today-outline'} size={26} color={typeof color === 'string' ? color : colors.textMuted} />
          ),
        }}
      />
      <Tabs.Screen
        name="meds"
        options={{
          title: 'Лекарства',
          tabBarAccessibilityLabel: 'Лекарства',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'medkit' : 'medkit-outline'}
              size={26}
              color={typeof color === 'string' ? color : colors.textMuted}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'История',
          tabBarAccessibilityLabel: 'История',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'stats-chart' : 'stats-chart-outline'}
              size={25}
              color={typeof color === 'string' ? color : colors.textMuted}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Настройки',
          tabBarAccessibilityLabel: 'Настройки',
          tabBarBadge: hasUpdate ? '•' : undefined,
          tabBarBadgeStyle: {
            backgroundColor: colors.warning,
            color: colors.white,
            fontSize: 14,
            minWidth: 18,
            height: 18,
            lineHeight: 17,
            borderRadius: 9,
          },
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'settings' : 'settings-outline'}
              size={26}
              color={typeof color === 'string' ? color : colors.textMuted}
            />
          ),
        }}
      />
    </Tabs>
  );
}


