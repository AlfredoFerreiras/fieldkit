import React from 'react';
import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../../src/auth/session';
import { useI18n } from '../../src/i18n';
import { BadgeProvider, badgeLabel, useBadges } from '../../src/notifications/badges';
import { color, type } from '../../src/components/theme';

export default function TabsLayout() {
  return (
    <BadgeProvider>
      <TabsInner />
    </BadgeProvider>
  );
}

function TabsInner() {
  const { user } = useAuth();
  const { t } = useI18n();
  const { unreadChat, openIssues, conflicts } = useBadges();
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
        tabBarBadgeStyle: {
          backgroundColor: color.conflict,
          color: color.surface,
          fontSize: 12,
          fontWeight: '700',
        },
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
          tabBarBadge: badgeLabel(conflicts),
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
          tabBarBadge: badgeLabel(openIssues),
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
          tabBarBadge: badgeLabel(unreadChat),
          tabBarBadgeStyle: {
            backgroundColor: color.brand,
            color: color.surface,
            fontSize: 12,
            fontWeight: '700',
          },
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
