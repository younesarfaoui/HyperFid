/**
 * Result of a form Server Action. React resets uncontrolled forms after every
 * action, so failures echo back the submitted (non-secret) fields for the form
 * to use as default values — users never retype everything after an error.
 */
export type FormState = { ok: boolean; message: string; fields?: Record<string, string> } | null;

export function failure(message: string, formData?: FormData, keys: readonly string[] = []): FormState {
  const fields: Record<string, string> = {};
  for (const key of keys) {
    const value = formData?.get(key);
    if (typeof value === "string") fields[key] = value;
  }
  return { ok: false, message, fields };
}

export function success(message: string): FormState {
  return { ok: true, message };
}
