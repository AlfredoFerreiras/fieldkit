/**
 * Fieldkit form schema.
 *
 * The whole point of the app: one binary, many customers. A customer publishes
 * a schema, the app renders it. No app update needed to change a form.
 *
 * Schemas are versioned and immutable. Editing a form publishes a new version.
 * Records pin the version they were captured against, so a record written
 * against v3 still renders correctly after v4 ships.
 */

export type FieldType =
  | 'text'
  | 'longtext'
  | 'number'
  | 'boolean'
  | 'select'
  | 'multiselect'
  | 'date'
  | 'photo'
  | 'barcode'
  | 'signature';

/** Show this field only when another field holds a given value. */
export interface VisibilityRule {
  field: string;
  /** Field is visible when the referenced field equals this value. */
  equals?: string | number | boolean;
  /** Field is visible when the referenced field holds any of these values. */
  oneOf?: (string | number | boolean)[];
  /** Field is visible when the referenced field has any value at all. */
  isSet?: boolean;
}

export interface SelectOption {
  value: string;
  label: string;
  /** Optional translations keyed by locale, e.g. { "es": "Cocina" }. */
  labels?: Record<string, string>;
}

export interface FormField {
  /** Stable key. Never reuse across versions with a different meaning. */
  id: string;
  type: FieldType;
  label: string;
  /** Optional translations keyed by locale, e.g. { "es": "Fotos" }. */
  labels?: Record<string, string>;
  help?: string;
  helps?: Record<string, string>;
  required?: boolean;
  placeholder?: string;
  placeholders?: Record<string, string>;

  /** select / multiselect */
  options?: SelectOption[];

  /** number */
  min?: number;
  max?: number;
  unit?: string;

  /** photo */
  maxPhotos?: number;

  visibleWhen?: VisibilityRule;
}

export interface FormSection {
  id: string;
  title: string;
  titles?: Record<string, string>;
  description?: string;
  descriptions?: Record<string, string>;
  fields: FormField[];
}

/** Schemas carry their own translations because the customer owns the form;
 *  the app cannot know what "Areas affected" is in Spanish for every customer. */
export function localized(
  base: string | undefined,
  translations: Record<string, string> | undefined,
  locale: string,
): string | undefined {
  return translations?.[locale] ?? base;
}

export interface FormSchema {
  id: string;
  version: number;
  title: string;
  /** Shown in the job list as the secondary line, templated with field ids. */
  summaryTemplate?: string;
  sections: FormSection[];
}

/** Values keyed by field id. Photos hold attachment ids, not file paths. */
export type FormValues = Record<string, unknown>;

export function isVisible(field: FormField, values: FormValues): boolean {
  const rule = field.visibleWhen;
  if (!rule) return true;

  const other = values[rule.field];

  if (rule.isSet !== undefined) {
    const present = other !== undefined && other !== null && other !== '';
    return rule.isSet ? present : !present;
  }
  // A multiselect holds an array. "oneOf" then means intersection, which is
  // what "show this when the tech ticked refrigerant_leak" needs to mean.
  if (rule.oneOf) {
    if (Array.isArray(other)) return other.some((v) => rule.oneOf!.includes(v));
    return rule.oneOf.includes(other as string);
  }
  if (rule.equals !== undefined) {
    if (Array.isArray(other)) return other.includes(rule.equals);
    return other === rule.equals;
  }
  return true;
}

export interface FieldError {
  fieldId: string;
  message: string;
}

const validationText = {
  en: {
    required: (label: string) => `${label} is required`,
    number: () => 'Enter a number',
    min: (n: number) => `Must be at least ${n}`,
    max: (n: number) => `Must be at most ${n}`,
  },
  es: {
    required: (label: string) => `${label} es obligatorio`,
    number: () => 'Escriba un número',
    min: (n: number) => `Debe ser al menos ${n}`,
    max: (n: number) => `Debe ser máximo ${n}`,
  },
} as const;

export type SchemaLocale = keyof typeof validationText;

/**
 * Validation runs against visible fields only. A hidden required field must
 * never block submission, otherwise conditional logic creates dead ends.
 */
export function validate(
  schema: FormSchema,
  values: FormValues,
  locale: SchemaLocale = 'en',
): FieldError[] {
  const errors: FieldError[] = [];
  const text = validationText[locale];

  for (const section of schema.sections) {
    for (const field of section.fields) {
      if (!isVisible(field, values)) continue;

      const value = values[field.id];
      const empty =
        value === undefined ||
        value === null ||
        value === '' ||
        (Array.isArray(value) && value.length === 0);

      if (field.required && empty) {
        const label = localized(field.label, field.labels, locale) ?? field.label;
        errors.push({ fieldId: field.id, message: text.required(label) });
        continue;
      }
      if (empty) continue;

      if (field.type === 'number') {
        const n = Number(value);
        if (Number.isNaN(n)) {
          errors.push({ fieldId: field.id, message: text.number() });
        } else if (field.min !== undefined && n < field.min) {
          errors.push({ fieldId: field.id, message: text.min(field.min) });
        } else if (field.max !== undefined && n > field.max) {
          errors.push({ fieldId: field.id, message: text.max(field.max) });
        }
      }
    }
  }

  return errors;
}

/** Render the schema's summary template against a record's values, e.g.
 *  "{client_name} · {property_address}". Falls back to the schema title when
 *  the referenced fields are still blank. */
export function summaryFor(schema: FormSchema, values: FormValues): string {
  if (!schema.summaryTemplate) return schema.title;
  const rendered = schema.summaryTemplate
    .replace(/\{(\w+)\}/g, (_, id: string) => {
      const v = values[id];
      return v === undefined || v === null || v === '' ? '' : String(v);
    })
    .replace(/^[\s·,-]+|[\s·,-]+$/g, '')
    .trim();
  return rendered || schema.title;
}

/** Strip values belonging to fields that are hidden, so payloads stay clean. */
export function pruneHidden(schema: FormSchema, values: FormValues): FormValues {
  const out: FormValues = {};
  for (const section of schema.sections) {
    for (const field of section.fields) {
      if (isVisible(field, values) && values[field.id] !== undefined) {
        out[field.id] = values[field.id];
      }
    }
  }
  return out;
}
