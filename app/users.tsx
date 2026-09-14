import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { useAuth } from '../src/auth/session';
import { useI18n } from '../src/i18n';
import { AccountForm } from '../src/components/AccountForm';
import { color, radius, shadow, space, type } from '../src/components/theme';

/** Supervisor-only user management: see every account on the device and add
 *  staff or customer accounts with a PIN of their own. */
export default function Users() {
  const { user, accounts, addAccount } = useAuth();
  const { t } = useI18n();
  const [savedName, setSavedName] = useState<string | null>(null);

  if (user?.role !== 'supervisor') return <View style={styles.flex} />;

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: t('users.title') }} />

      <View style={styles.card}>
        {accounts.map((account, i) => (
          <View key={account.id} style={[styles.row, i > 0 && styles.rowDivider]}>
            <View style={styles.rowMain}>
              <Text style={styles.rowName}>{account.name}</Text>
              <Text style={styles.rowMeta}>
                {t(`role.${account.role}`)}
                {account.phone ? ` · ${account.phone}` : ''}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <Text style={styles.sectionLabel}>{t('users.add')}</Text>
      {savedName ? <Text style={styles.saved}>{t('users.saved')}</Text> : null}
      <AccountForm
        key={savedName ?? 'first'}
        roles={['manager', 'customer', 'supervisor']}
        submitLabel={t('users.add')}
        onSubmit={async (input) => {
          await addAccount(input);
          setSavedName(input.name);
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: color.canvas },
  content: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },

  card: {
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.line,
    ...shadow.card,
  },
  row: {
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  rowDivider: { borderTopWidth: 1, borderTopColor: color.line },
  rowMain: { gap: 2 },
  rowName: { ...type.label, color: color.ink },
  rowMeta: { ...type.meta, color: color.inkMuted },

  sectionLabel: {
    ...type.section,
    color: color.inkMuted,
    textTransform: 'uppercase',
    marginTop: space.md,
  },
  saved: { ...type.help, color: color.synced },
});
