/*
 * Lithuanian has three plural forms for whole numbers, chosen by the last digits: 1, 21, 31 ("one": 1 diena),
 * 2–9, 22–29 ("few": 2 dienos) and 0, 10–20, 30 ("other": 10 dienų). vue-i18n's default rule only knows English
 * (one form for 1, another for the rest), so Lithuanian messages are written as "one | few | other", or
 * "zero | one | few | other" where English has a zero form. A message with one form reads the same for every number.
 */
const LITHUANIAN_PLURAL_RULES = new Intl.PluralRules("lt");

export function selectLithuanianPluralForm(choice: number, choicesLength: number): number {
  const count = Math.abs(choice);
  if (choicesLength === 1) {
    return 0;
  }
  if (choicesLength === 2) {
    // The locale check refuses two Lithuanian forms; should one slip in, it reads like English.
    return count === 1 ? 0 : 1;
  }
  const hasZeroForm = choicesLength >= 4;
  if (hasZeroForm && count === 0) {
    return 0;
  }
  const offset = hasZeroForm ? 1 : 0;
  // "many" is for fractions (1,5 dienos), which read like "few".
  const category = LITHUANIAN_PLURAL_RULES.select(count);
  if (category === "one") {
    return offset;
  }
  if (category === "few" || category === "many") {
    return offset + 1;
  }
  return offset + 2;
}
