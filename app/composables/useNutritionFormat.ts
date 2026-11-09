import type { MealNutrition, Nutrition } from "#shared/utils/nutrition.types";

// Calories and grams as the screens show them (F1): whole numbers in the viewer's language ("1,920" or "1 920"),
// and a dash for a value the recipe does not give.
export function useNutritionFormat() {
  const { t, locale } = useI18n();

  const numberFormat = computed(() => new Intl.NumberFormat(locale.value, { maximumFractionDigits: 0 }));

  const formatNumber = (value: number | null): string =>
    value === null ? t("nutrition.missingValue") : numberFormat.value.format(value);

  const formatKcal = (value: number | null): string =>
    value === null ? t("nutrition.missingValue") : t("nutrition.kcalValue", { value: formatNumber(value) });

  const formatGrams = (value: number | null): string =>
    value === null ? t("nutrition.missingValue") : t("nutrition.gramsValue", { value: formatNumber(value) });

  // "C 62 · P 14 · F 9", as in the nutrition design.
  const formatMacroLine = (nutrition: Nutrition): string =>
    t("nutrition.macroLine", {
      carbohydrates: formatNumber(nutrition.carbohydrates),
      protein: formatNumber(nutrition.protein),
      fat: formatNumber(nutrition.fat),
    });

  // What a screen reader hears for the short line: every value spelled out.
  const formatNutritionLabel = (nutrition: Nutrition): string =>
    t("nutrition.macroLineLabel", {
      kcal: formatNumber(nutrition.caloriesKcal),
      carbohydrates: formatNumber(nutrition.carbohydrates),
      protein: formatNumber(nutrition.protein),
      fat: formatNumber(nutrition.fat),
    });

  // A planned meal's line: its macros, marked when approximate; or that the recipe gives none.
  const formatMealLine = (meal: MealNutrition): string => {
    if (Object.values(meal.nutrition).every((value) => value === null)) {
      return t("nutrition.noData");
    }
    const line = formatMacroLine(meal.nutrition);
    return meal.isApproximate ? `${line} · ${t("nutrition.approximate")}` : line;
  };

  return { formatNumber, formatKcal, formatGrams, formatMacroLine, formatNutritionLabel, formatMealLine };
}
