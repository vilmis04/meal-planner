import type { User } from "@supabase/supabase-js";

export function useSupabaseUser() {
  return useState<User | null>("supabase-user", () => null);
}
