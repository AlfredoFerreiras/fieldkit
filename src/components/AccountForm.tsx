import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useI18n } from '../i18n';
import type { NewAccount, Role } from '../auth/accounts';
import { color, radius, space, TOUCH, type } from './theme';

/**
 * Shared create-account form: customers self-registering on the login screen
 * and the supervisor adding staff in settings fill in the same fields; only
 * whether the role is choosable differs.
 */
export function AccountForm({
  roles,
  fixedRole,
  submitLabel,
  onSubmit,
}: {
  /** Choosable roles; omit to lock the role to fixedRole. */
  roles?: Role[];
  fixedRole?: Role;
  submitLabel: string;
  onSubmit: (input: NewAccount) => Promise<void>;
}) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [role, setRole] = useState<Role>(roles?.[0] ?? fixedRole ?? 'customer');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit() {
    if (name.trim() === '') {
      setError(t('login.nameRequired'));
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      setError(t('login.pinLength'));
      return;
    }
    if (pin !== confirm) {
      setError(t('login.pinMismatch'));
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await onSubmit({ name, role, pin, phone, email });
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.form}>
      {roles && roles.length > 1 ? (
        <View>
          <Text style={styles.fieldLabel}>{t('users.role')}</Text>
          <View style={styles.roleRow}>
            {roles.map((r) => {
              const on = role === r;
              return (
                <Pressable
                  key={r}
                  style={[styles.roleChip, on && styles.roleChipOn]}
                  onPress={() => setRole(r)}
                >
                  <Text style={[styles.roleText, on && styles.roleTextOn]}>{t(`role.${r}`)}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder={t('login.name')}
        placeholderTextColor={color.inkFaint}
        autoCapitalize="words"
        accessibilityLabel={t('login.name')}
      />
      <TextInput
        style={styles.input}
        value={phone}
        onChangeText={setPhone}
        placeholder={t('login.phone')}
        placeholderTextColor={color.inkFaint}
        keyboardType="phone-pad"
        accessibilityLabel={t('login.phone')}
      />
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder={t('login.email')}
        placeholderTextColor={color.inkFaint}
        keyboardType="email-address"
        autoCapitalize="none"
        accessibilityLabel={t('login.email')}
      />
      <View style={styles.pinRow}>
        <TextInput
          style={[styles.input, styles.pin]}
          value={pin}
          onChangeText={setPin}
          placeholder={t('login.choosePin')}
          placeholderTextColor={color.inkFaint}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={4}
          accessibilityLabel={t('login.choosePin')}
        />
        <TextInput
          style={[styles.input, styles.pin]}
          value={confirm}
          onChangeText={setConfirm}
          placeholder={t('login.confirmPin')}
          placeholderTextColor={color.inkFaint}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={4}
          accessibilityLabel={t('login.confirmPin')}
        />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        style={[styles.submit, busy && styles.submitBusy]}
        onPress={handleSubmit}
        disabled={busy}
      >
        <Text style={styles.submitText}>{submitLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.md },

  fieldLabel: { ...type.section, color: color.inkMuted, textTransform: 'uppercase' },
  roleRow: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  roleChip: {
    flex: 1,
    minHeight: TOUCH - 12,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: color.line,
    backgroundColor: color.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.sm,
  },
  roleChipOn: { backgroundColor: color.brand, borderColor: color.brand },
  roleText: { ...type.meta, color: color.inkMuted },
  roleTextOn: { color: color.surface },

  input: {
    ...type.input,
    minHeight: TOUCH,
    borderWidth: 1.5,
    borderColor: color.line,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    paddingHorizontal: space.lg,
    color: color.ink,
  },
  pinRow: { flexDirection: 'row', gap: space.md },
  pin: { flex: 1, fontSize: 16 },

  error: { ...type.body, color: color.conflict },

  submit: {
    minHeight: TOUCH,
    borderRadius: radius.md,
    backgroundColor: color.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBusy: { backgroundColor: color.inkFaint },
  submitText: { ...type.label, fontSize: 18, color: color.surface },
});
