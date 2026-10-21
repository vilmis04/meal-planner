import type { Profile, ProfileChanges } from "~/types/profile.types";

export function useProfile() {
  const supabase = useSupabaseClient();
  const profile = useState<Profile | null>("profile", () => null);

  // Leaves the profile empty on failure; callers render without it rather than failing the page.
  async function load(userId: string): Promise<void> {
    const { data, error } = await supabase
      .from("profiles")
      .select(PROFILE_COLUMNS)
      .eq("id", userId)
      .single();

    profile.value = error ? null : parseProfile(data);
    if (error) {
      console.error("Loading the profile failed", error);
    }
  }

  // Resolves to false when nothing was saved, so callers can revert what they applied optimistically.
  async function update(changes: ProfileChanges): Promise<boolean> {
    if (!profile.value) {
      return false;
    }

    const { data, error } = await supabase
      .from("profiles")
      .update({
        display_name: changes.displayName,
        locale: changes.locale,
        theme: changes.theme,
      })
      .eq("id", profile.value.id)
      .select(PROFILE_COLUMNS)
      .single();

    const updatedProfile = error ? null : parseProfile(data);
    if (!updatedProfile) {
      console.error("Saving the profile failed", error);
      return false;
    }

    profile.value = updatedProfile;
    return true;
  }

  function clear(): void {
    profile.value = null;
  }

  return { profile: readonly(profile), load, update, clear };
}

function parseProfile(row: unknown): Profile | null {
  const result = profileRowSchema.safeParse(row);
  if (!result.success) {
    console.error("Unexpected profile row", result.error);
    return null;
  }
  return result.data;
}
