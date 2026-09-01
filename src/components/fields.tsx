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
import type { FormField } from '../schema/types';
import { color, radius, space, TOUCH, type } from './theme';

export interface FieldProps {
  field: FormField;
  value: unknown;
  error?: string;
  onChange: (value: unknown) => void;
}

export function Field({ field, value, error, onChange }: FieldProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>
        {field.label}
        {field.required ? <Text style={styles.required}> Required</Text> : null}
      </Text>
      {field.help ? <Text style={styles.help}>{field.help}</Text> : null}

      <Control field={field} value={value} error={error} onChange={onChange} />

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

function Control({ field, value, error, onChange }: FieldProps) {
  const invalid = Boolean(error);

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
          placeholder={field.placeholder}
          placeholderTextColor={color.inkFaint}
          multiline={field.type === 'longtext'}
          textAlignVertical={field.type === 'longtext' ? 'top' : 'center'}
          accessibilityLabel={field.label}
        />
      );

    case 'number':
      return (
        <View style={styles.numberRow}>
          <TextInput
            style={[styles.input, styles.numberInput, invalid && styles.inputInvalid]}
            value={value === undefined || value === null ? '' : String(value)}
            onChangeText={(t) => onChange(t === '' ? undefined : t)}
            keyboardType="numbers-and-punctuation"
            placeholder={field.placeholder}
            placeholderTextColor={color.inkFaint}
            accessibilityLabel={field.label}
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
          accessibilityLabel={field.label}
        >
          <Text style={styles.switchText}>{value ? 'Yes' : 'No'}</Text>
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
                <Text style={[styles.optionText, on && styles.optionTextOn]}>{opt.label}</Text>
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
                <Text style={[styles.optionText, on && styles.optionTextOn]}>{opt.label}</Text>
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
          accessibilityLabel={field.label}
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
          placeholder="Type the tag number"
          placeholderTextColor={color.inkFaint}
          autoCapitalize="characters"
          accessibilityLabel={field.label}
        />
      );

    case 'signature':
      return (
        <Pressable
          style={styles.stub}
          onPress={() => onChange(value ? undefined : `signed:${Date.now()}`)}
        >
          <Text style={styles.stubText}>{value ? 'Signed. Tap to clear.' : 'Tap to sign'}</Text>
        </Pressable>
      );

    default:
      return <Text style={styles.help}>Unsupported field type: {field.type}</Text>;
  }
}

function PhotoField({ field, value, onChange }: Omit<FieldProps, 'error'>) {
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
              <Text style={styles.thumbRemove}>Remove</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {uris.length < max ? (
        <Pressable style={styles.photoButton} onPress={capture}>
          <Text style={styles.photoButtonText}>
            Take photo{uris.length > 0 ? ` (${uris.length} of ${max})` : ''}
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
  optionOn: { borderColor: color.ink, borderWidth: 2.5, backgroundColor: color.canvas },
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

  stub: {
    minHeight: TOUCH * 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: color.inkFaint,
    borderRadius: radius.md,
  },
  stubText: { ...type.body, color: color.inkMuted },
});
