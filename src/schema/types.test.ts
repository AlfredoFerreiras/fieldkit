import { isVisible, validate } from '@/schema/types';
import type { FormField, FormSchema } from '@/schema/types';

const field = (overrides: Partial<FormField>): FormField => ({
  id: 'f',
  type: 'text',
  label: 'Field',
  ...overrides,
});

describe('isVisible', () => {
  it('shows a field with no rule', () => {
    expect(isVisible(field({}), {})).toBe(true);
  });

  it('hides a field whose equals rule does not match', () => {
    const f = field({ visibleWhen: { field: 'other', equals: true } });
    expect(isVisible(f, { other: false })).toBe(false);
    expect(isVisible(f, { other: true })).toBe(true);
  });
});

describe('validate', () => {
  const schema: FormSchema = {
    id: 's',
    version: 1,
    title: 'S',
    sections: [{ id: 'sec', title: 'Sec', fields: [field({ id: 'name', required: true })] }],
  };

  it('flags a missing required field', () => {
    expect(validate(schema, {})).toEqual([{ fieldId: 'name', message: 'Field is required' }]);
  });

  it('passes when the required field is filled', () => {
    expect(validate(schema, { name: 'x' })).toEqual([]);
  });
});
