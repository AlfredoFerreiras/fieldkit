import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { FieldError, FormSchema, FormValues } from '../schema/types';
import { isVisible, validate } from '../schema/types';
import { Field } from './fields';
import { color, radius, space, TOUCH, type } from './theme';

interface Props {
  schema: FormSchema;
  initialValues: FormValues;
  submitLabel?: string;
  /** Fires on every keystroke, debounced. Writes to SQLite, never the network. */
  onAutosave: (values: FormValues) => void;
  onSubmit: (values: FormValues) => void;
}

const AUTOSAVE_MS = 600;

export function FormRenderer({
  schema,
  initialValues,
  submitLabel = 'Submit',
  onAutosave,
  onSubmit,
}: Props) {
  const [values, setValues] = useState<FormValues>(initialValues);
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [touched, setTouched] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const errorFor = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of errors) if (!map.has(e.fieldId)) map.set(e.fieldId, e.message);
    return map;
  }, [errors]);

  const setValue = useCallback(
    (fieldId: string, value: unknown) => {
      setValues((prev) => {
        const next = { ...prev, [fieldId]: value };

        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => onAutosave(next), AUTOSAVE_MS);

        // Only re-validate once the tech has tried to submit. Nagging while
        // someone is still typing the first character is hostile.
        if (touched) setErrors(validate(schema, next));

        return next;
      });
    },
    [onAutosave, schema, touched],
  );

  const handleSubmit = useCallback(() => {
    setTouched(true);
    const found = validate(schema, values);
    setErrors(found);
    if (found.length === 0) onSubmit(values);
  }, [onSubmit, schema, values]);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {schema.sections.map((section) => {
          const visible = section.fields.filter((f) => isVisible(f, values));
          if (visible.length === 0) return null;

          return (
            <View key={section.id} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              {section.description ? (
                <Text style={styles.sectionDesc}>{section.description}</Text>
              ) : null}

              {visible.map((field) => (
                <Field
                  key={field.id}
                  field={field}
                  value={values[field.id]}
                  error={errorFor.get(field.id)}
                  onChange={(v) => setValue(field.id, v)}
                />
              ))}
            </View>
          );
        })}

        {touched && errors.length > 0 ? (
          <Text style={styles.summary}>
            {errors.length} {errors.length === 1 ? 'field needs' : 'fields need'} attention above.
          </Text>
        ) : null}

        <Pressable style={styles.submit} onPress={handleSubmit} accessibilityRole="button">
          <Text style={styles.submitText}>{submitLabel}</Text>
        </Pressable>

        <Text style={styles.footnote}>
          Saved on this phone. It sends itself when you have signal.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: space.lg, paddingBottom: space.xxl * 2 },

  section: { marginBottom: space.xl },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
    color: color.ink,
    marginBottom: space.md,
    paddingBottom: space.sm,
    borderBottomWidth: 2,
    borderBottomColor: color.ink,
  },
  sectionDesc: { ...type.help, color: color.inkMuted, marginBottom: space.lg },

  summary: { ...type.body, color: color.conflict, marginBottom: space.lg },

  submit: {
    minHeight: TOUCH + 4,
    borderRadius: radius.md,
    backgroundColor: color.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: { ...type.label, fontSize: 19, color: color.surface },

  footnote: {
    ...type.help,
    color: color.inkFaint,
    textAlign: 'center',
    marginTop: space.md,
  },
});
