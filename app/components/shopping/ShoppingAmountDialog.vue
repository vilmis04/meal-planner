<script setup lang="ts">
import type { ShoppingItemAmountChange } from "#shared/utils/shoppingItemEdit.types";
import type { ShoppingItem } from "#shared/utils/shoppingList.types";

// Changing a line's amount (G4). A generated line keeps its unit (g or kg for grams) and may go back to the plan's
// amount; a manual line takes any manual unit, or no amount.
const props = defineProps<{ item: ShoppingItem | null }>();
const isOpen = defineModel<boolean>({ required: true });
const emit = defineEmits<{ save: [item: ShoppingItem, change: ShoppingItemAmountChange] }>();

const { t, locale } = useI18n();
const { formatQuantity } = useShoppingAmountFormat();

const amountText = ref("");
const unit = ref<string | null>(null);
const form = useTemplateRef("form");

const unitChoices = computed(() => (props.item ? getAmountUnitChoices(props.item) : []));
const isGenerated = computed(() => props.item?.source === "generated");
const planHint = computed(() => {
  const item = props.item;
  if (item === null || item.source !== "generated" || item.amount === null || item.unit === null) {
    return null;
  }
  return t("shoppingList.amount.planHint", { amount: formatQuantity(item.amount, item.unit) });
});
const hasOverride = computed(() => props.item?.amountOverride != null);

// Each opening starts from what the line holds now, in the unit it reads in.
watch(
  () => [isOpen.value, props.item] as const,
  ([isNowOpen, item]) => {
    if (isNowOpen && item) {
      const input = getAmountInput(item, locale.value);
      amountText.value = input.amountText;
      unit.value = input.unit ?? unitChoices.value[0] ?? null;
    }
  },
  { immediate: true },
);

async function save() {
  const item = props.item;
  const validation = await form.value?.validate();
  if (item === null || !validation?.valid) {
    return;
  }
  const result = readAmountInput({ amountText: amountText.value, unit: unit.value }, unitChoices.value);
  if (result.status === "invalid") {
    return;
  }
  emit("save", item, result.change);
  isOpen.value = false;
}

function usePlanAmount() {
  if (props.item) {
    emit("save", props.item, { amount: null, unit: null });
  }
  isOpen.value = false;
}
</script>

<template>
  <v-dialog v-model="isOpen" max-width="400">
    <v-card :class="$style.card" data-testid="shopping-amount-dialog">
      <h2 :class="$style.title">{{ t("shoppingList.amount.title") }}</h2>
      <p v-if="item" :class="$style.name">{{ item.name }}</p>
      <v-form ref="form" :class="$style.form" @submit.prevent="save">
        <ShoppingAmountFields
          v-model:amount-text="amountText"
          v-model:unit="unit"
          :unit-choices="unitChoices"
          :amount-label="t('shoppingList.amount.label')"
          :is-amount-required="isGenerated"
        />
        <p v-if="planHint" :class="$style.hint" data-testid="shopping-amount-plan-hint">{{ planHint }}</p>
        <v-btn
          v-if="hasOverride"
          variant="text"
          color="primary"
          prepend-icon="mdi-restore"
          :class="$style.reset"
          data-testid="shopping-amount-use-plan"
          @click="usePlanAmount"
        >
          {{ t("shoppingList.amount.usePlan") }}
        </v-btn>
        <div :class="$style.actions">
          <v-btn variant="text" color="primary" size="large" @click="isOpen = false">
            {{ t("shoppingList.amount.cancel") }}
          </v-btn>
          <v-btn type="submit" variant="flat" color="primary" size="large" data-testid="shopping-amount-save">
            {{ t("shoppingList.amount.save") }}
          </v-btn>
        </div>
      </v-form>
    </v-card>
  </v-dialog>
</template>

<style module>
.card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-4);
  border-radius: 24px;
}

.title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
}

.name {
  margin: 0;
  color: var(--color-muted);
  overflow-wrap: anywhere;
}

.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.hint {
  margin: 0;
  font-size: 13px;
  color: var(--color-muted);
}

.reset {
  align-self: flex-start;
  min-height: 44px;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--space-2);
}
</style>
