import React from 'react';
import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../../src/auth/session';
import { useI18n } from '../../src/i18n';
import { color, type } from '../../src/components/theme';

export default function TabsLayout() {
  const { user } = useAuth();
  const { t } = useI18n();
  const staff = user?.role === 'supervisor' || user?.role === 'manager';

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: color.surface },
        headerTitleStyle: { ...type.label },
        headerTintColor: color.ink,
        sceneStyle: { backgroundColor: color.canvas },
        tabBarActiveTintColor: color.brand,
        tabBarInactiveTintColor: color.inkFaint,
        tabBarStyle: { backgroundColor: color.surface },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ color: tint, size }) => (
            <Ionicons name="home-outline" size={size} color={tint} />
          ),
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          title: t('tabs.jobs'),
          href: staff ? '/jobs' : null,
          tabBarIcon: ({ color: tint, size }) => (
            <Ionicons name="clipboard-outline" size={size} color={tint} />
          ),
        }}
      />
      <Tabs.Screen
        name="issues"
        options={{
          title: t('tabs.issues'),
          href: staff ? '/issues' : null,
          tabBarIcon: ({ color: tint, size }) => (
            <Ionicons name="alert-circle-outline" size={size} color={tint} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: t('tabs.chat'),
          href: staff ? '/chat' : null,
          tabBarIcon: ({ color: tint, size }) => (
            <Ionicons name="chatbubbles-outline" size={size} color={tint} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
          tabBarIcon: ({ color: tint, size }) => (
            <Ionicons name="settings-outline" size={size} color={tint} />
          ),
        }}
      />
    </Tabs>
  );
}
