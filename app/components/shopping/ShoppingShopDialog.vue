<script setup lang="ts">
import type { Shop } from "#shared/utils/shop.types";

// Picking or typing a shop (G7): for a bought line, or as the shop the viewer is shopping at. Tapping one of the
// household's shops saves it at once, so recording a shop takes one tap; a new one is typed and saved.
const props = defineProps<{
  title: string;
  hint: string | null;
  shops: readonly Shop[];
  currentName: string | null;
  clearLabel: string;
  // For a bought line: whether to keep the shop for the next lines ticked (on unless turned off).
  isRememberOffered: boolean;
}>();
const isOpen = defineModel<boolean>({ required: true });
const emit = defineEmits<{ save: [name: string, isRemembered: boolean]; clear: [] }>();

const { t } = useI18n();

const name = ref("");
const isRemembered = ref(true);
const form = useTemplateRef("form");

const nameRules = [
  (value: string): true | string =>
    normaliseItemName(value) !== "" || t("shoppingList.validation.shopNameRequired"),
  (value: string): true | string =>
    normaliseItemName(value).length <= SHOP_NAME_MAX_LENGTH ||
    t("shoppingList.validation.nameTooLong", { max: SHOP_NAME_MAX_LENGTH }),
];

// Each opening starts from the shop recorded now, if any.
watch(isOpen, (isNowOpen) => {
  if (isNowOpen) {
    name.value = props.currentName ?? "";
    isRemembered.value = true;
  }
});

const isCurrent = (shop: Shop): boolean =>
  props.currentName !== null && getShopNameKey(shop.name) === getShopNameKey(props.currentName);

function pick(shop: Shop) {
  emit("save", shop.name, isRemembered.value);
  isOpen.value = false;
}

async function save() {
  const validation = await form.value?.validate();
  const result = shopNameSchema.safeParse(name.value);
  if (!validation?.valid || !result.success) {
    return;
  }
  emit("save", result.data, isRemembered.value);
  isOpen.value = false;
}

function clear() {
  emit("clear");
  isOpen.value = false;
}
</script>

<template>
  <v-dialog v-model="isOpen" max-width="440">
    <v-card :class="$style.card" data-testid="shopping-shop-dialog">
      <h2 :class="$style.title">{{ title }}</h2>
      <p v-if="hint" :class="$style.hint">{{ hint }}</p>
      <v-form ref="form" :class="$style.form" @submit.prevent="save">
        <div v-if="shops.length > 0" role="group" :aria-label="t('shoppingList.shop.choices')" :class="$style.choices">
          <button
            v-for="shop in shops"
            :key="shop.id"
            type="button"
            :class="$style.choice"
            :aria-pressed="isCurrent(shop)"
            data-testid="shopping-shop-choice"
            @click="pick(shop)"
          >
            <v-icon :icon="isCurrent(shop) ? 'mdi-check' : 'mdi-storefront-outline'" size="16" aria-hidden="true" />
            {{ shop.name }}
          </button>
        </div>
        <v-text-field
          v-model="name"
          :label="shops.length > 0 ? t('shoppingList.shop.otherName') : t('shoppingList.shop.name')"
          :rules="nameRules"
          :counter="SHOP_NAME_MAX_LENGTH"
          autocomplete="off"
          data-testid="shopping-shop-name"
        />
        <v-checkbox
          v-if="isRememberOffered"
          v-model="isRemembered"
          :label="t('shoppingList.shop.remember')"
          density="comfortable"
          hide-details
          data-testid="shopping-shop-remember"
        />
        <div :class="$style.actions">
          <v-btn
            v-if="currentName !== null"
            variant="text"
            color="primary"
            size="large"
            :class="$style.clear"
            data-testid="shopping-shop-clear"
            @click="clear"
          >
            {{ clearLabel }}
          </v-btn>
          <v-btn variant="text" color="primary" size="large" data-testid="shopping-shop-cancel" @click="isOpen = false">
            {{ isRememberOffered ? t("shoppingList.shop.skip") : t("shoppingList.shop.cancel") }}
          </v-btn>
          <v-btn type="submit" variant="flat" color="primary" size="large" data-testid="shopping-shop-save">
            {{ t("shoppingList.shop.save") }}
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
  overflow-wrap: anywhere;
}

.hint {
  margin: 0;
  font-size: 14px;
  color: var(--color-muted);
}

.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.choices {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

/* A pill like the list's chips, with a touch target of at least 44 px. */
.choice {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  min-height: var(--touch-target);
  padding: 0 14px;
  border: 1px solid color-mix(in srgb, var(--color-muted) 55%, transparent);
  border-radius: 22px;
  background: none;
  color: inherit;
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  overflow-wrap: anywhere;
  text-align: left;
  cursor: pointer;
}

.choice[aria-pressed="true"] {
  border-color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 12%, transparent);
}

.choice:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--space-2);
}

.clear {
  margin-right: auto;
}
</style>
