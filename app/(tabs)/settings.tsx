import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useDb } from '../../src/db/context';
import { useAuth } from '../../src/auth/session';
import { useI18n, type Locale } from '../../src/i18n';
import { color, radius, shadow, space, TOUCH, type } from '../../src/components/theme';

export default function Settings() {
  const { pending } = useDb();
  const { user, signOut } = useAuth();
  const { t, locale, setLocale } = useI18n();
  const router = useRouter();

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.cardLabel}>{t('settings.signedInAs')}</Text>
        <Text style={styles.cardValue}>{user?.name}</Text>
        <Text style={styles.cardMeta}>{user ? t(`role.${user.role}`) : ''}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>{t('settings.language')}</Text>
        <View style={styles.langRow}>
          <LangButton current={locale} value="en" label="English" onSelect={setLocale} />
          <LangButton current={locale} value="es" label="Español" onSelect={setLocale} />
        </View>
      </View>

      {user?.role === 'supervisor' ? (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>{t('settings.team')}</Text>
          <Pressable style={styles.manage} onPress={() => router.push('/users')}>
            <Text style={styles.manageText}>{t('settings.manageUsers')}</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardValue}>
          {pending > 0 ? t('settings.pendingRows', { n: pending }) : t('settings.nothingPending')}
        </Text>
      </View>

      <Pressable style={styles.signOut} onPress={() => void signOut()}>
        <Text style={styles.signOutText}>{t('settings.signOut')}</Text>
      </Pressable>
    </ScrollView>
  );
}

function LangButton({
  current,
  value,
  label,
  onSelect,
}: {
  current: Locale;
  value: Locale;
  label: string;
  onSelect: (locale: Locale) => void;
}) {
  const on = current === value;
  return (
    <Pressable style={[styles.lang, on && styles.langOn]} onPress={() => onSelect(value)}>
      <Text style={[styles.langText, on && styles.langTextOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: color.canvas },
  content: { padding: space.lg, gap: space.md },

  card: {
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.line,
    padding: space.lg,
    gap: space.xs,
    ...shadow.card,
  },
  cardLabel: { ...type.section, color: color.inkMuted, textTransform: 'uppercase' },
  cardValue: { ...type.label, fontSize: 20, color: color.ink },
  cardMeta: { ...type.meta, color: color.inkMuted },

  manage: {
    minHeight: TOUCH,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: color.brand,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.sm,
  },
  manageText: { ...type.label, color: color.brand },

  langRow: { flexDirection: 'row', gap: space.md, marginTop: space.sm },
  lang: {
    flex: 1,
    minHeight: TOUCH,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: color.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langOn: { borderColor: color.brand, borderWidth: 2.5, backgroundColor: color.brandTint },
  langText: { ...type.label, color: color.ink },
  langTextOn: { color: color.brand },

  signOut: {
    minHeight: TOUCH,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: color.conflict,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.md,
  },
  signOutText: { ...type.label, fontSize: 19, color: color.conflict },
});
