<script setup lang="ts">
import type { NewShoppingItem, ShoppingItemAmountChange } from "#shared/utils/shoppingItemEdit.types";
import type { ShoppingItem, ShoppingListGroupKey } from "#shared/utils/shoppingList.types";
import type { ShoppingItemEditResult } from "~/types/shoppingList.types";

defineOptions({ name: "ShoppingListPage" });

const { t, locale } = useI18n();
const route = useRoute();
const { loadPlan } = useMealPlans();
const { refresh, load } = useShoppingList();
const { household, load: loadHousehold } = useHousehold();
const { profile } = useProfile();
const user = useSupabaseUser();
const { show } = useAppSnackbar();

const id = String(route.params.id);

// The list is brought up to date with the plan first (the server rebuilds it only when the plan changed), then read.
// The plan gives the header; the household gives names for "Swap for Monika".
const loadList = async () => {
  const isUpToDate = await refresh(id);
  return { isUpToDate, result: await load(id) };
};
const [{ data: planResult }, { data: listResult, refresh: reloadList, status: listStatus }] = await Promise.all([
  useAsyncData(`plan-${id}`, () => loadPlan(id)),
  useAsyncData(`shopping-list-${id}`, loadList),
  callOnce("household", loadHousehold, { mode: "navigation" }),
]);

const plan = computed(() => (planResult.value?.status === "found" ? planResult.value.plan : null));
const list = computed(() => (listResult.value?.result.status === "found" ? listResult.value.result.list : null));
// The lines as this page shows them: the loaded list, with this viewer's changes applied before the database confirms
// them (G4). A reload (Try again) starts from what is stored.
const items = ref<ShoppingItem[]>([]);
watch(list, (current) => (items.value = current ? [...current.items] : []), { immediate: true });
const view = computed(() => (list.value ? getShoppingListView(items.value) : null));
const { isGroupExpanded, setGroupExpanded } = useShoppingListGroupExpansion(() => list.value?.id ?? null);
const { addItem, setAmount, setState, removeItem, restoreItem } = useShoppingItemEdits(items);

// The groups as their headers show them. Extras and "Have at home" are titled apart from the categories.
const getGroupHeading = (key: ShoppingListGroupKey) => {
  if (key === EXTRAS_GROUP_KEY) {
    return { title: t("shoppingList.extras.title"), hint: t("shoppingList.extras.hint"), icon: undefined };
  }
  if (key === HAVE_AT_HOME_GROUP_KEY) {
    return { title: t("shoppingList.haveAtHome.title"), hint: undefined, icon: "mdi-home-outline" };
  }
  return { title: t(`shoppingList.category.${key}`), hint: undefined, icon: undefined };
};
const groups = computed(() =>
  (view.value?.groups ?? []).map((group) => ({
    ...group,
    ...getGroupHeading(group.key),
    countLabel: String(group.itemCount),
    countDescription: t("shoppingList.itemCount", group.itemCount),
    isExpanded: isGroupExpanded(group.key),
  })),
);

const isAddOpen = ref(false);
const amountItem = ref<ShoppingItem | null>(null);
const isAmountOpen = ref(false);
// The last change that can be undone, offered in the snackbar until it closes.
const undoOffer = ref<{ text: string; undo: () => Promise<ShoppingItemEditResult> } | null>(null);
const isUndoOpen = ref(false);

const reportFailure = (result: ShoppingItemEditResult): void => {
  if (!result.isSaved) {
    isUndoOpen.value = false;
    show(result.errorKey, "error");
  }
};

const offerUndo = (text: string, undo: () => Promise<ShoppingItemEditResult>): void => {
  undoOffer.value = { text, undo };
  isUndoOpen.value = true;
};

async function handleAdd(newItem: NewShoppingItem) {
  const listId = list.value?.id;
  if (listId === undefined) {
    return;
  }
  // The new line shows in its group, which opens if it was closed.
  if (!isGroupExpanded(newItem.category)) {
    setGroupExpanded(newItem.category, true);
  }
  reportFailure(await addItem(listId, newItem));
}

async function handleToggleAtHome(item: ShoppingItem) {
  const isGoingHome = item.state !== "have_at_home";
  const previousState = item.state;
  const result = await setState(item.id, isGoingHome ? "have_at_home" : "to_buy");
  if (result.isSaved && isGoingHome) {
    offerUndo(t("shoppingList.undo.movedHome", { name: item.name }), () => setState(item.id, previousState));
  }
  reportFailure(result);
}

async function handleRemove(item: ShoppingItem) {
  const listId = list.value?.id;
  const result = await removeItem(item);
  if (result.isSaved && listId !== undefined) {
    offerUndo(t("shoppingList.undo.removed", { name: item.name }), () => restoreItem(listId, item));
  }
  reportFailure(result);
}

function openAmount(item: ShoppingItem) {
  amountItem.value = item;
  isAmountOpen.value = true;
}

async function handleAmount(item: ShoppingItem, change: ShoppingItemAmountChange) {
  reportFailure(await setAmount(item, change));
}

async function handleUndo() {
  const offer = undoOffer.value;
  undoOffer.value = null;
  if (offer) {
    reportFailure(await offer.undo());
  }
}
const isRefreshFailed = computed(() => listResult.value?.isUpToDate === false);

const range = computed(() => (plan.value ? formatPlanRange(plan.value.startDate, plan.value.endDate, locale.value) : ""));
useHead({ title: () => (range.value ? `${t("shoppingList.pageTitle")} · ${range.value}` : t("shoppingList.pageTitle")) });

// "20 – 26 Oct · 2 people", as in the shopping list design.
const subtitle = computed(() =>
  plan.value ? `${range.value} · ${t("plan.detail.people", getPlanServings(plan.value.participantIds))}` : "",
);
const hasNoParticipants = computed(() => plan.value !== null && getPlanServings(plan.value.participantIds) === 0);
const areSnacksOff = computed(() => plan.value !== null && plan.value.includeSnacks && !plan.value.snacksOnList);

const participantNames = computed(() => {
  const names = new Map((household.value?.members ?? []).map((member) => [member.userId, member.displayName]));
  if (profile.value) {
    names.set(profile.value.id, profile.value.displayName);
  }
  return names;
});
</script>

<template>
  <div :class="$style.page">
    <v-btn
      :to="`/plans/${id}`"
      exact
      variant="text"
      prepend-icon="mdi-arrow-left"
      :class="$style.back"
      data-testid="shopping-list-back"
    >
      {{ t("shoppingList.back") }}
    </v-btn>

    <template v-if="list && view">
      <header :class="$style.header">
        <span v-if="subtitle" :class="$style.subtitle" data-testid="shopping-list-plan">{{ subtitle }}</span>
        <h1 :class="$style.title">{{ t("shoppingList.title") }}</h1>
        <span :class="$style.counts">
          <span data-testid="shopping-list-count">{{ t("shoppingList.toBuyCount", view.toBuyCount) }}</span>
          <span v-if="view.atHomeCount > 0" data-testid="shopping-list-at-home-count">
            {{ t("shoppingList.atHomeCount", { count: view.atHomeCount }) }}
          </span>
        </span>
      </header>

      <v-alert v-if="isRefreshFailed" type="warning" variant="tonal" density="compact" data-testid="shopping-list-stale">
        {{ t("shoppingList.refreshFailed") }}
        <template #append>
          <v-btn variant="text" size="small" :loading="listStatus === 'pending'" @click="reloadList()">
            {{ t("shoppingList.retry") }}
          </v-btn>
        </template>
      </v-alert>
      <v-alert v-if="hasNoParticipants" type="warning" variant="tonal" density="compact" data-testid="shopping-list-no-participants">
        {{ t("shoppingList.noParticipants") }}
      </v-alert>
      <v-alert v-if="list.missingSwapCount > 0" type="info" variant="tonal" density="compact" data-testid="shopping-list-missing-swaps">
        {{ t("shoppingList.missingSwaps") }}
      </v-alert>
      <v-alert v-if="areSnacksOff" type="info" variant="tonal" density="compact" data-testid="shopping-list-snacks-off">
        {{ t("shoppingList.snacksOff") }}
      </v-alert>

      <p v-if="view.groups.length === 0 && !hasNoParticipants" :class="$style.empty" data-testid="shopping-list-empty">
        {{ t("shoppingList.empty") }}
      </p>

      <button type="button" :class="$style.addInline" data-testid="shopping-add-open" @click="isAddOpen = true">
        <v-icon icon="mdi-plus" size="20" aria-hidden="true" />
        {{ t("shoppingList.addItem.open") }}
      </button>

      <div :class="$style.groups">
        <ShoppingItemGroup
          v-for="group in groups"
          :key="group.key"
          :title="group.title"
          :hint="group.hint"
          :count-label="group.countLabel"
          :count-description="group.countDescription"
          :icon="group.icon"
          :expanded="group.isExpanded"
          :data-testid="`shopping-group-${group.key}`"
          @update:expanded="setGroupExpanded(group.key, $event)"
        >
          <ShoppingItemList
            :items="group.items"
            :participant-names="participantNames"
            :current-user-id="user?.id ?? null"
            @toggle-at-home="handleToggleAtHome"
            @edit-amount="openAmount"
            @remove="handleRemove"
          />
        </ShoppingItemGroup>
      </div>

      <v-btn
        icon="mdi-plus"
        color="primary"
        size="x-large"
        rounded="lg"
        :class="$style.fab"
        :aria-label="t('shoppingList.addItem.open')"
        data-testid="shopping-add-fab"
        @click="isAddOpen = true"
      />
      <ShoppingAddItemDialog v-model="isAddOpen" @save="handleAdd" />
      <ShoppingAmountDialog v-model="isAmountOpen" :item="amountItem" @save="handleAmount" />
      <ShoppingUndoSnackbar v-model="isUndoOpen" :text="undoOffer?.text ?? ''" @undo="handleUndo" />
    </template>
    <v-alert
      v-else-if="listResult?.result.status === 'not-found' || planResult?.status === 'not-found'"
      type="warning"
      variant="tonal"
      data-testid="shopping-list-not-found"
    >
      {{ t("shoppingList.notFound") }}
    </v-alert>
    <v-alert v-else type="error" variant="tonal" data-testid="shopping-list-load-failed">
      {{ t("shoppingList.loadFailed") }}
    </v-alert>
  </div>
</template>

<style module>
.page {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  max-width: 720px;
}

.back {
  align-self: flex-start;
  min-height: 44px;
  margin-left: calc(-1 * var(--space-2));
}

.header {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.subtitle {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-muted);
}

.title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
}

.counts {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: var(--space-2);
  font-size: 14px;
  color: var(--color-muted);
}

/* "Add item" as a dashed row above the groups on wider screens, as in the plan screen's list; phones get the round
   button above the navigation bar instead, as in the shopping list design. */
.addInline {
  display: none;
  align-items: center;
  gap: var(--space-2);
  min-height: 44px;
  padding: 0 12px;
  border: 1px dashed color-mix(in srgb, var(--color-muted) 45%, transparent);
  border-radius: 10px;
  background: none;
  color: var(--color-muted);
  font: inherit;
  font-size: 14px;
  text-align: left;
  cursor: pointer;
}

.addInline:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.fab {
  position: fixed;
  right: 16px;
  bottom: calc(var(--nav-height) + 16px);
  z-index: 5;
}

/* Room below the last group, so its lines can scroll above the add button. */
@media (max-width: 959.98px) {
  .page {
    padding-bottom: 80px;
  }
}

@media (min-width: 960px) {
  .addInline {
    display: flex;
  }

  .fab {
    display: none;
  }
}

.empty {
  margin: 0;
  color: var(--color-muted);
}

.groups {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>
