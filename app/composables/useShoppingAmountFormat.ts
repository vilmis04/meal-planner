// Units are stored as the recipes write them (vnt., pakuotė); these two read in the viewer's language ("6 pcs", as in
// the shopping list design). Every other unit (g, kg, skiltelė) is shown as stored.
const UNIT_LABEL_KEYS: ReadonlyMap<string, string> = new Map([
  ["vnt.", "shoppingList.units.pieces"],
  ["pakuotė", "shoppingList.units.pack"],
]);

// How shopping list amounts read (G2, G4).
export function useShoppingAmountFormat() {
  const { t, locale } = useI18n();

  const unitLabel = (unit: string): string => {
    const labelKey = UNIT_LABEL_KEYS.get(unit);
    return labelKey === undefined ? unit : t(labelKey);
  };

  // Amounts are stored in base units (g, ml) and read in the larger one from 1000 (1.5 kg).
  const formatQuantity = (amount: number, unit: string): string => {
    const quantity = toDisplayQuantity({ amount, unit });
    return `${formatAmount(quantity.amount, locale.value)} ${unitLabel(quantity.unit)}`;
  };

  return { unitLabel, formatQuantity };
}
