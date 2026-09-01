import React from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { localized, type FormField } from '../schema/types';
import { useI18n } from '../i18n';
import { SignaturePad } from './SignaturePad';
import { color, radius, space, TOUCH, type } from './theme';

export interface FieldProps {
  field: FormField;
  value: unknown;
  error?: string;
  onChange: (value: unknown) => void;
}

export function Field({ field, value, error, onChange }: FieldProps) {
  const { t, locale } = useI18n();
  const label = localized(field.label, field.labels, locale) ?? field.label;
  const help = localized(field.help, field.helps, locale);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>
        {label}
        {field.required ? <Text style={styles.required}> {t('form.required')}</Text> : null}
      </Text>
      {help ? <Text style={styles.help}>{help}</Text> : null}

      <Control field={field} value={value} error={error} onChange={onChange} />

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

function Control({ field, value, error, onChange }: FieldProps) {
  const { t, locale } = useI18n();
  const invalid = Boolean(error);
  const label = localized(field.label, field.labels, locale) ?? field.label;
  const placeholder = localized(field.placeholder, field.placeholders, locale);

  switch (field.type) {
    case 'text':
    case 'longtext':
      return (
        <TextInput
          style={[
            styles.input,
            field.type === 'longtext' && styles.inputMultiline,
            invalid && styles.inputInvalid,
          ]}
          value={(value as string) ?? ''}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={color.inkFaint}
          multiline={field.type === 'longtext'}
          textAlignVertical={field.type === 'longtext' ? 'top' : 'center'}
          accessibilityLabel={label}
        />
      );

    case 'number':
      return (
        <View style={styles.numberRow}>
          <TextInput
            style={[styles.input, styles.numberInput, invalid && styles.inputInvalid]}
            value={value === undefined || value === null ? '' : String(value)}
            onChangeText={(text) => onChange(text === '' ? undefined : text)}
            keyboardType="numbers-and-punctuation"
            placeholder={placeholder}
            placeholderTextColor={color.inkFaint}
            accessibilityLabel={label}
          />
          {field.unit ? <Text style={styles.unit}>{field.unit}</Text> : null}
        </View>
      );

    case 'boolean':
      return (
        <Pressable
          style={styles.switchRow}
          onPress={() => onChange(!value)}
          accessibilityRole="switch"
          accessibilityState={{ checked: Boolean(value) }}
          accessibilityLabel={label}
        >
          <Text style={styles.switchText}>{value ? t('common.yes') : t('common.no')}</Text>
          <Switch
            value={Boolean(value)}
            onValueChange={onChange}
            trackColor={{ true: color.synced, false: color.line }}
          />
        </Pressable>
      );

    case 'select':
      return (
        <View style={styles.options}>
          {(field.options ?? []).map((opt) => {
            const on = value === opt.value;
            return (
              <Pressable
                key={opt.value}
                style={[styles.option, on && styles.optionOn]}
                onPress={() => onChange(on ? undefined : opt.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
              >
                <Text style={[styles.optionText, on && styles.optionTextOn]}>
                  {localized(opt.label, opt.labels, locale)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      );

    case 'multiselect': {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <View style={styles.options}>
          {(field.options ?? []).map((opt) => {
            const on = selected.includes(opt.value);
            return (
              <Pressable
                key={opt.value}
                style={[styles.option, on && styles.optionOn]}
                onPress={() =>
                  onChange(on ? selected.filter((v) => v !== opt.value) : [...selected, opt.value])
                }
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
              >
                <Text style={[styles.optionText, on && styles.optionTextOn]}>
                  {localized(opt.label, opt.labels, locale)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      );
    }

    case 'date':
      // Typed rather than picker-driven on purpose: a tech entering twelve of
      // these in a row is faster on the keypad than in a wheel.
      return (
        <TextInput
          style={[styles.input, invalid && styles.inputInvalid]}
          value={(value as string) ?? ''}
          onChangeText={onChange}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={color.inkFaint}
          keyboardType="numbers-and-punctuation"
          accessibilityLabel={label}
        />
      );

    case 'photo':
      return <PhotoField field={field} value={value} onChange={onChange} />;

    case 'barcode':
      return (
        <TextInput
          style={[styles.input, invalid && styles.inputInvalid]}
          value={(value as string) ?? ''}
          onChangeText={onChange}
          placeholder={t('form.typeTag')}
          placeholderTextColor={color.inkFaint}
          autoCapitalize="characters"
          accessibilityLabel={label}
        />
      );

    case 'signature':
      return (
        <SignaturePad
          label={label}
          value={value}
          onChange={onChange}
          signHereText={t('sig.signHere')}
          clearText={t('sig.clear')}
          doneText={t('sig.done')}
          cancelText={t('sig.cancel')}
        />
      );

    default:
      return <Text style={styles.help}>{t('form.unsupported', { type: field.type })}</Text>;
  }
}

function PhotoField({ field, value, onChange }: Omit<FieldProps, 'error'>) {
  const { t } = useI18n();
  const uris = Array.isArray(value) ? (value as string[]) : [];
  const max = field.maxPhotos ?? 6;

  async function capture() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.6,
      exif: false,
    });
    if (!result.canceled && result.assets[0]) {
      onChange([...uris, result.assets[0].uri]);
    }
  }

  return (
    <View>
      {uris.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbRow}>
          {uris.map((uri) => (
            <Pressable
              key={uri}
              onPress={() => onChange(uris.filter((u) => u !== uri))}
              style={styles.thumbWrap}
            >
              <Image source={{ uri }} style={styles.thumb} />
              <Text style={styles.thumbRemove}>{t('form.remove')}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {uris.length < max ? (
        <Pressable style={styles.photoButton} onPress={capture}>
          <Text style={styles.photoButtonText}>
            {uris.length > 0
              ? t('form.photoCount', { n: uris.length, max })
              : t('form.takePhoto')}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space.xl },
  label: { ...type.label, color: color.ink, marginBottom: space.xs },
  required: { ...type.meta, color: color.inkFaint, fontWeight: '500' },
  help: { ...type.help, color: color.inkMuted, marginBottom: space.sm },
  error: { ...type.help, color: color.conflict, marginTop: space.xs },

  input: {
    ...type.input,
    minHeight: TOUCH,
    borderWidth: 1.5,
    borderColor: color.line,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    color: color.ink,
  },
  inputMultiline: { minHeight: TOUCH * 2.5 },
  inputInvalid: { borderColor: color.conflict, backgroundColor: color.dangerBg },

  numberRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  numberInput: { flex: 1 },
  unit: { ...type.body, color: color.inkMuted, minWidth: 40 },

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: TOUCH,
    borderWidth: 1.5,
    borderColor: color.line,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    paddingHorizontal: space.lg,
  },
  switchText: { ...type.input, color: color.ink },

  options: { gap: space.sm },
  option: {
    minHeight: TOUCH,
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: color.line,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    paddingHorizontal: space.lg,
  },
  optionOn: { borderColor: color.brand, borderWidth: 2.5, backgroundColor: color.brandTint },
  optionText: { ...type.body, color: color.ink },
  optionTextOn: { fontWeight: '600' },

  thumbRow: { marginBottom: space.md },
  thumbWrap: { marginRight: space.md, alignItems: 'center' },
  thumb: { width: 96, height: 96, borderRadius: radius.sm, backgroundColor: color.canvas },
  thumbRemove: { ...type.meta, color: color.conflict, marginTop: space.xs },

  photoButton: {
    minHeight: TOUCH,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: color.inkFaint,
    borderRadius: radius.md,
  },
  photoButtonText: { ...type.label, color: color.ink },
});
