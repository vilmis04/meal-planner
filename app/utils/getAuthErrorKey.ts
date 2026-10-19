import type { AuthError } from "@supabase/supabase-js";

const GENERIC_AUTH_ERROR_KEY = "auth.errors.generic";

// Codes from https://supabase.com/docs/guides/auth/debugging/error-codes
const ERROR_KEY_BY_CODE: Partial<Record<string, string>> = {
  invalid_credentials: "auth.errors.invalidCredentials",
  user_already_exists: "auth.errors.userAlreadyExists",
  email_exists: "auth.errors.userAlreadyExists",
  weak_password: "auth.errors.weakPassword",
  email_address_invalid: "auth.errors.invalidEmail",
  validation_failed: "auth.errors.invalidEmail",
  over_request_rate_limit: "auth.errors.rateLimited",
  over_email_send_rate_limit: "auth.errors.rateLimited",
  signup_disabled: "auth.errors.signUpDisabled",
};

export function getAuthErrorKey({ code }: AuthError): string {
  return (code && ERROR_KEY_BY_CODE[code]) || GENERIC_AUTH_ERROR_KEY;
}
