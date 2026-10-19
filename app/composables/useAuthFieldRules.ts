const MIN_PASSWORD_LENGTH = 8;

// Matches "ana@example.com" and "ana.b+meals@mail.co.uk";
// rejects "ana@", "ana example.com" and "ana@example".
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function useAuthFieldRules() {
  const { t } = useI18n();

  return {
    required: (value: string) => Boolean(value) || t("auth.validation.required"),
    email: (value: string) => EMAIL_REGEX.test(value) || t("auth.validation.email"),
    minPasswordLength: (value: string) =>
      value.length >= MIN_PASSWORD_LENGTH ||
      t("auth.validation.passwordMinLength", { min: MIN_PASSWORD_LENGTH }),
    matches: (getExpected: () => string) => (value: string) =>
      value === getExpected() || t("auth.validation.passwordsMatch"),
  };
}
