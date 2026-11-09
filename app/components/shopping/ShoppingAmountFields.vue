<script setup lang="ts">
import type { AmountInputError } from "#shared/utils/shoppingItemEdit.types";

// An amount and its unit, as typed (G4). The amount may be left empty unless isAmountRequired; then no unit is needed.
const props = defineProps<{
  unitChoices: readonly string[];
  amountLabel: string;
  isAmountRequired: boolean;
}>();

const amountText = defineModel<string>("amountText", { required: true });
const unit = defineModel<string | null>("unit", { required: true });

const { t } = useI18n();
const { unitLabel } = useShoppingAmountFormat();

const ERROR_KEYS: Readonly<Record<AmountInputError, string>> = {
  not_a_number: "shoppingList.validation.notANumber",
  missing_unit: "shoppingList.validation.missingUnit",
  out_of_range: "shoppingList.validation.outOfRange",
};

const unitItems = computed(() => props.unitChoices.map((choice) => ({ value: choice, title: unitLabel(choice) })));

const amountRules = [
  (value: string): true | string => {
    if (props.isAmountRequired && value.trim() === "") {
      return t("shoppingList.validation.amountRequired");
    }
    const result = readAmountInput({ amountText: value, unit: unit.value }, props.unitChoices);
    return result.status === "valid" || t(ERROR_KEYS[result.error]);
  },
];
</script>

<template>
  <div :class="$style.fields">
    <v-text-field
      v-model="amountText"
      :label="amountLabel"
      inputmode="decimal"
      autocomplete="off"
      :rules="amountRules"
      :class="$style.amount"
      data-testid="shopping-amount-input"
    />
    <v-select
      v-model="unit"
      :items="unitItems"
      :label="t('shoppingList.addItem.unit')"
      :disabled="unitChoices.length === 1"
      :class="$style.unit"
      data-testid="shopping-unit-select"
    />
  </div>
</template>

<style module>
.fields {
  display: flex;
  gap: var(--space-2);
}

.amount {
  flex: 1 1 60%;
  min-width: 0;
}

.unit {
  flex: 1 1 40%;
  min-width: 0;
}
</style>
