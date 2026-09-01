import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DEMO_ACCOUNTS, useAuth, type Account } from '../src/auth/session';
import { useI18n } from '../src/i18n';
import { color, radius, shadow, space, TOUCH, type } from '../src/components/theme';

export default function Login() {
  const { signIn } = useAuth();
  const { t, locale, setLocale } = useI18n();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<Account | null>(null);
  const [pin, setPin] = useState('');
  const [failed, setFailed] = useState(false);

  async function handleSignIn() {
    if (!selected) return;
    const ok = await signIn(selected.id, pin);
    if (!ok) {
      setFailed(true);
      setPin('');
    }
  }

  return (
    <View style={[styles.flex, { paddingTop: insets.top + space.xxl }]}>
      <Pressable
        style={styles.langSwitch}
        onPress={() => setLocale(locale === 'en' ? 'es' : 'en')}
      >
        <Text style={styles.langText}>{locale === 'en' ? 'Español' : 'English'}</Text>
      </Pressable>

      <Text style={styles.brand}>Fieldkit</Text>
      <Text style={styles.title}>{t('login.title')}</Text>
      <Text style={styles.subtitle}>{t('login.subtitle')}</Text>

      <View style={styles.accounts}>
        {DEMO_ACCOUNTS.map((account) => {
          const on = selected?.id === account.id;
          return (
            <Pressable
              key={account.id}
              style={[styles.account, on && styles.accountOn]}
              onPress={() => {
                setSelected(account);
                setFailed(false);
              }}
            >
              <Text style={[styles.accountName, on && styles.accountNameOn]}>{account.name}</Text>
              <Text style={styles.accountRole}>{t(`role.${account.role}`)}</Text>
            </Pressable>
          );
        })}
      </View>

      {selected ? (
        <View style={styles.pinRow}>
          <TextInput
            style={[styles.pinInput, failed && styles.pinInvalid]}
            value={pin}
            onChangeText={(next) => {
              setPin(next);
              setFailed(false);
            }}
            placeholder={t('login.pin')}
            placeholderTextColor={color.inkFaint}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
            accessibilityLabel={t('login.pin')}
          />
          <Pressable style={styles.signIn} onPress={handleSignIn}>
            <Text style={styles.signInText}>{t('login.signIn')}</Text>
          </Pressable>
        </View>
      ) : null}

      {failed ? <Text style={styles.error}>{t('login.wrongPin')}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: color.canvas, padding: space.xl, gap: space.md },

  langSwitch: { alignSelf: 'flex-end' },
  langText: { ...type.label, color: color.brand },

  brand: { ...type.title, color: color.brand },
  title: { ...type.title, fontSize: 24, color: color.ink },
  subtitle: { ...type.help, color: color.inkMuted, marginBottom: space.md },

  accounts: { gap: space.md },
  account: {
    minHeight: TOUCH + 8,
    justifyContent: 'center',
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: color.line,
    paddingHorizontal: space.lg,
    gap: 2,
    ...shadow.card,
  },
  accountOn: { borderColor: color.brand, borderWidth: 2.5, backgroundColor: color.brandTint },
  accountName: { ...type.label, color: color.ink },
  accountNameOn: { color: color.brand },
  accountRole: { ...type.meta, color: color.inkMuted },

  pinRow: { flexDirection: 'row', gap: space.md, marginTop: space.md },
  pinInput: {
    ...type.input,
    flex: 1,
    minHeight: TOUCH,
    borderWidth: 1.5,
    borderColor: color.line,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    paddingHorizontal: space.lg,
    color: color.ink,
    letterSpacing: 8,
  },
  pinInvalid: { borderColor: color.conflict, backgroundColor: color.dangerBg },
  signIn: {
    minHeight: TOUCH,
    borderRadius: radius.md,
    backgroundColor: color.brand,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xl,
  },
  signInText: { ...type.label, fontSize: 19, color: color.surface },

  error: { ...type.body, color: color.conflict },
});
