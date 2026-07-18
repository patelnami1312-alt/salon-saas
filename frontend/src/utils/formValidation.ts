/** Shared field validators used across all forms */

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_RE = /^[+\d\s\-().]{7,20}$/;
export const TIME_RE  = /^([01]\d|2[0-3]):[0-5]\d$/;

export const v = {
  required: (val: string, label = 'This field') =>
    !val?.trim() ? `${label} is required.` : '',

  minLen: (val: string, min: number, label = 'Value') =>
    val?.trim().length < min ? `${label} must be at least ${min} characters.` : '',

  maxLen: (val: string, max: number, label = 'Value') =>
    val?.trim().length > max ? `${label} cannot exceed ${max} characters.` : '',

  email: (val: string) =>
    val && !EMAIL_RE.test(val.trim()) ? 'Enter a valid email address.' : '',

  phone: (val: string) =>
    val && !PHONE_RE.test(val.trim()) ? 'Enter a valid phone number (7–20 digits).' : '',

  positiveNumber: (val: string | number, label = 'Value') => {
    const n = Number(val);
    return isNaN(n) || n <= 0 ? `${label} must be greater than 0.` : '';
  },

  nonNegative: (val: string | number, label = 'Value') => {
    const n = Number(val);
    return isNaN(n) || n < 0 ? `${label} cannot be negative.` : '';
  },

  range: (val: string | number, min: number, max: number, label = 'Value') => {
    const n = Number(val);
    if (isNaN(n)) return `${label} must be a number.`;
    if (n < min) return `${label} must be at least ${min}.`;
    if (n > max) return `${label} cannot exceed ${max}.`;
    return '';
  },

  percent: (val: string | number, label = 'Tax') =>
    v.range(val, 0, 100, label),

  minSelect: (val: string | number | null | undefined, label = 'Selection') =>
    !val ? `Please select a ${label}.` : '',

  passwordMin: (val: string) =>
    val && val.length < 8 ? 'Password must be at least 8 characters.' : '',

  passwordMatch: (val: string, confirm: string) =>
    val && confirm && val !== confirm ? 'Passwords do not match.' : '',

  integerPositive: (val: string | number, label = 'Value') => {
    const n = Number(val);
    return !Number.isInteger(n) || n <= 0 ? `${label} must be a positive whole number.` : '';
  },
};

/** Returns true if every value in the errors object is an empty string */
export const hasNoErrors = (errors: Record<string, string>) =>
  Object.values(errors).every((e) => !e);

/** Maps a backend detail string/array to field errors where possible */
export function mapBackendError(
  err: any,
  fieldMap: Record<string, string>,   // backend field name -> local field name
): { fieldErrors: Record<string, string>; general: string } {
  const detail = err?.data?.detail;
  const fieldErrors: Record<string, string> = {};
  let general = '';

  if (typeof detail === 'string') {
    const low = detail.toLowerCase();
    let matched = false;
    for (const [keyword, field] of Object.entries(fieldMap)) {
      if (low.includes(keyword)) {
        fieldErrors[field] = detail;
        matched = true;
        break;
      }
    }
    if (!matched) general = detail || 'Something went wrong. Please try again.';
  } else if (Array.isArray(detail)) {
    const unmatched: string[] = [];
    detail.forEach((d: any) => {
      const backendField = d.loc?.[d.loc.length - 1] as string;
      const localField = backendField && fieldMap[backendField];
      if (localField) fieldErrors[localField] = d.msg;
      else unmatched.push(d.msg);
    });
    if (unmatched.length) general = unmatched.join('. ');
  } else {
    general = 'Something went wrong. Please try again.';
  }

  return { fieldErrors, general };
}
