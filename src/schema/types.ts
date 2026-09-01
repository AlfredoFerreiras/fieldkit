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
}

export interface FormField {
  /** Stable key. Never reuse across versions with a different meaning. */
  id: string;
  type: FieldType;
  label: string;
  help?: string;
  required?: boolean;
  placeholder?: string;

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
  description?: string;
  fields: FormField[];
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

/**
 * Validation runs against visible fields only. A hidden required field must
 * never block submission, otherwise conditional logic creates dead ends.
 */
export function validate(schema: FormSchema, values: FormValues): FieldError[] {
  const errors: FieldError[] = [];

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
        errors.push({ fieldId: field.id, message: `${field.label} is required` });
        continue;
      }
      if (empty) continue;

      if (field.type === 'number') {
        const n = Number(value);
        if (Number.isNaN(n)) {
          errors.push({ fieldId: field.id, message: 'Enter a number' });
        } else if (field.min !== undefined && n < field.min) {
          errors.push({ fieldId: field.id, message: `Must be at least ${field.min}` });
        } else if (field.max !== undefined && n > field.max) {
          errors.push({ fieldId: field.id, message: `Must be at most ${field.max}` });
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
