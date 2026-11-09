// Whether the signed-in user has asked to see calories and macros (F1). Off by default and saved on the profile, so
// it follows the user to every device. A change shows at once; a failed save puts the previous value back.
export function useNutritionVisibility() {
  const { profile, update } = useProfile();
  // The value being saved, while the save runs.
  const pendingValue = useState<boolean | null>("nutrition-visibility-pending", () => null);

  const isNutritionShown = computed(() => pendingValue.value ?? profile.value?.showNutrition ?? false);

  // Resolves to false when nothing was saved.
  const setNutritionShown = async (next: boolean): Promise<boolean> => {
    pendingValue.value = next;
    const isSaved = await update({ showNutrition: next });
    pendingValue.value = null;
    return isSaved;
  };

  return { isNutritionShown, setNutritionShown };
}
