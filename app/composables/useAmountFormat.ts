// How amounts read with their units, in the viewer's language (G2, G4, X1b): "6 pcs", "2 cloves", "1.5 kg".
export function useAmountFormat() {
  const { t, locale } = useI18n();

  // A unit on its own (a unit picker's choice) reads as for one; with an amount it takes that amount's plural form.
  const unitLabel = (unit: string, amount = 1): string => {
    const labelKey = getUnitLabelKey(unit);
    return labelKey === null ? unit : t(labelKey, amount);
  };

  // An amount as written, in its own unit: a recipe's line (per person's portion).
  const formatAmountWithUnit = (amount: number, unit: string): string =>
    `${formatAmount(amount, locale.value)} ${unitLabel(unit, amount)}`;

  // Shopping list amounts are stored in base units (g, ml) and read in the larger one from 1000 (1.5 kg).
  const formatQuantity = (amount: number, unit: string): string => {
    const quantity = toDisplayQuantity({ amount, unit });
    return formatAmountWithUnit(quantity.amount, quantity.unit);
  };

  return { unitLabel, formatAmountWithUnit, formatQuantity };
}
