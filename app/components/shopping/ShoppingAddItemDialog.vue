<script setup lang="ts">
import type { NewShoppingItem } from "#shared/utils/shoppingItemEdit.types";
import type { IngredientCategory } from "#shared/utils/shoppingList.types";

// Adding a line of one's own to the list (G4): a name, a category and, if wanted, an amount.
const isOpen = defineModel<boolean>({ required: true });
const emit = defineEmits<{ save: [item: NewShoppingItem] }>();

const { t } = useI18n();

const DEFAULT_CATEGORY: IngredientCategory = "other";
const DEFAULT_UNIT = "g";

const name = ref("");
const category = ref<IngredientCategory>(DEFAULT_CATEGORY);
const amountText = ref("");
const unit = ref<string | null>(DEFAULT_UNIT);
const form = useTemplateRef("form");

const categoryItems = computed(() =>
  INGREDIENT_CATEGORIES.map((value) => ({ value, title: t(`shoppingList.category.${value}`) })),
);

const nameRules = [
  (value: string): true | string => normaliseItemName(value) !== "" || t("shoppingList.validation.nameRequired"),
  (value: string): true | string =>
    normaliseItemName(value).length <= MAX_ITEM_NAME_LENGTH ||
    t("shoppingList.validation.nameTooLong", { max: MAX_ITEM_NAME_LENGTH }),
];

// Each opening starts empty.
watch(isOpen, (isNowOpen) => {
  if (isNowOpen) {
    name.value = "";
    category.value = DEFAULT_CATEGORY;
    amountText.value = "";
    unit.value = DEFAULT_UNIT;
  }
});

async function save() {
  const validation = await form.value?.validate();
  if (!validation?.valid) {
    return;
  }
  const result = newShoppingItemSchema.safeParse({
    name: name.value,
    category: category.value,
    amountText: amountText.value,
    unit: unit.value,
  });
  if (!result.success) {
    return;
  }
  emit("save", result.data);
  isOpen.value = false;
}
</script>

<template>
  <v-dialog v-model="isOpen" max-width="440">
    <v-card :class="$style.card" data-testid="shopping-add-dialog">
      <h2 :class="$style.title">{{ t("shoppingList.addItem.title") }}</h2>
      <v-form ref="form" :class="$style.form" @submit.prevent="save">
        <v-text-field
          v-model="name"
          :label="t('shoppingList.addItem.name')"
          :rules="nameRules"
          :counter="MAX_ITEM_NAME_LENGTH"
          autofocus
          autocomplete="off"
          data-testid="shopping-add-name"
        />
        <v-select
          v-model="category"
          :items="categoryItems"
          :label="t('shoppingList.addItem.category')"
          data-testid="shopping-add-category"
        />
        <ShoppingAmountFields
          v-model:amount-text="amountText"
          v-model:unit="unit"
          :unit-choices="MANUAL_ITEM_UNITS"
          :amount-label="t('shoppingList.addItem.amount')"
          :is-amount-required="false"
        />
        <div :class="$style.actions">
          <v-btn variant="text" color="primary" size="large" @click="isOpen = false">
            {{ t("shoppingList.addItem.cancel") }}
          </v-btn>
          <v-btn type="submit" variant="flat" color="primary" size="large" data-testid="shopping-add-save">
            {{ t("shoppingList.addItem.save") }}
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
  gap: var(--space-3);
  padding: var(--space-4);
  border-radius: 24px;
}

.title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
}

.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--space-2);
}
</style>
