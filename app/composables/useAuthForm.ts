import type { AuthError } from "@supabase/supabase-js";

interface AuthResponse {
  error: AuthError | null;
}

export function useAuthForm() {
  const isSubmitting = ref(false);
  const errorKey = ref<string | null>(null);

  // Resolves to the response on success and to null when Supabase returned an error.
  async function submit<TResponse extends AuthResponse>(
    action: () => Promise<TResponse>,
  ): Promise<TResponse | null> {
    errorKey.value = null;
    isSubmitting.value = true;

    try {
      const response = await action();

      if (response.error) {
        errorKey.value = getAuthErrorKey(response.error);
        return null;
      }

      return response;
    } finally {
      isSubmitting.value = false;
    }
  }

  return { isSubmitting, errorKey, submit };
}
