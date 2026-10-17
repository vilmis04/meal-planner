import type { AuthError } from "@supabase/supabase-js";

// Maps a Supabase auth error to a translation key so messages are never shown in raw English.
export function useAuthErrorKey() {
  return (error: AuthError): string => {
    switch (error.code) {
      case "invalid_credentials":
        return "auth.errors.invalidCredentials";
      case "email_not_confirmed":
        return "auth.errors.emailNotConfirmed";
      case "user_already_exists":
      case "email_exists":
        return "auth.errors.userAlreadyExists";
      case "weak_password":
        return "auth.errors.weakPassword";
      case "validation_failed":
        return "auth.errors.invalidEmail";
      default:
        return "auth.errors.generic";
    }
  };
}
