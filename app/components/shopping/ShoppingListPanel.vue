<script setup lang="ts">
import type { Shop } from "#shared/utils/shop.types";
import type { NewShoppingItem, ShoppingItemAmountChange } from "#shared/utils/shoppingItemEdit.types";
import type { ShoppingItem, ShoppingListGroupKey } from "#shared/utils/shoppingList.types";
import type {
  ShoppingItemEditResult,
  ShoppingItemShopHint,
  ShoppingListPageGroupKey,
  ShoppingListShopGroup,
} from "~/types/shoppingList.types";

// A plan's shopping list (G2–G7, I1a): its own page on phones and tablets, and the pane beside the plan from 1280px
// (X4). As a pane it has a smaller heading and a link to the full page; adding a line is a form in place from 960px,
// where phones open a dialog.
const { planId, isPane = false, sourceVersion = 0 } = defineProps<{
  planId: string;
  isPane?: boolean;
  // Goes up whenever the page beside the pane saved a change to the plan's meals, people or snack options, so the
  // list catches up at once instead of waiting for the live update.
  sourceVersion?: number;
}>();

const { t, locale } = useI18n();
const { loadPlan } = useMealPlans();
const { refresh, load } = useShoppingList();
const { household, load: loadHousehold } = useHousehold();
const { profile } = useProfile();
const user = useSupabaseUser();
const { show } = useAppSnackbar();

const id = planId;
const isWide = useBreakpointUp("md");

// The lines as this page shows them: the loaded list, with this viewer's changes applied before the database confirms
// them (G4) and other members' changes as they happen (G6).
const items = ref<ShoppingItem[]>([]);
const {
  addItem,
  setAmount,
  setState,
  markBought,
  setShop,
  removeItem,
  restoreItem,
  applyRemoteChange,
  countRemoteChanges,
  applyStoredItems,
} = useShoppingItemEdits(items);
const { shops, loadShops, reloadShops, addShop } = useShops();
const { load: loadIngredientNames, getIngredientName } = useIngredientNames();
const { load: loadSwapItemNames, getSwapItemName } = useSwapItemNames();
const { defaultShopName, setDefaultShopName } = useShoppingDefaultShop();

// The list is brought up to date with the plan first (the server rebuilds it only when the plan changed), then read.
// The plan gives the header; the household gives names for "Swap for Monika"; the shops name where lines were bought. How many live changes had arrived when
// the read started is kept, so the ones that arrive while it runs are applied again on top of it (G6).
const loadList = async () => {
  const remoteChangesBefore = countRemoteChanges();
  const isUpToDate = await refresh(id);
  return { isUpToDate, remoteChangesBefore, result: await load(id) };
};
const [{ data: planResult }, { data: listResult, refresh: reloadList, status: listStatus }, , { data: shopsResult }] =
  await Promise.all([
    useAsyncData(`plan-${id}`, () => loadPlan(id)),
    useAsyncData(`shopping-list-${id}`, loadList),
    callOnce("household", loadHousehold, { mode: "navigation" }),
    useAsyncData(`shops-${id}`, loadShops),
    // Generated lines are named through their ingredient in the viewer's language (X1b).
    loadIngredientNames(),
  ]);
watch(
  shopsResult,
  (loaded) => {
    if (loaded) {
      shops.value = loaded;
    }
  },
  { immediate: true },
);

const plan = computed(() => (planResult.value?.status === "found" ? planResult.value.plan : null));
const list = computed(() => (listResult.value?.result.status === "found" ? listResult.value.result.list : null));
// Every read (the first, Try again, catching up) goes through here; what this viewer has on the way is kept.
watch(
  listResult,
  (current) => {
    if (current?.result.status === "found") {
      applyStoredItems(current.result.list.items, current.remoteChangesBefore);
    } else {
      items.value = [];
    }
  },
  { immediate: true },
);
const { isBoughtLast, setBoughtLast } = useShoppingListBoughtLast();
// A generated line without an ingredient is a protein swap's replacement (G1 maps every recipe item); its name in the
// viewer's language comes from the swap's translations (X1c), read in the browser once the page is up.
const isUnmatchedGeneratedLine = (item: Pick<ShoppingItem, "source" | "ingredientId">) =>
  item.source === "generated" && item.ingredientId === null;
const unmatchedNames = computed(() => items.value.filter(isUnmatchedGeneratedLine).map((item) => item.name));
onMounted(() => {
  watch(unmatchedNames, (names) => loadSwapItemNames(names), { immediate: true });
});
// The lines as shown: a generated line named in the viewer's language through its ingredient (X1b) or its swap's
// translation (X1c), following a switch of language at once; manual lines keep their own name. Changes still go to items.
const shownItems = computed(() =>
  items.value.map((item) => {
    if (item.ingredientId !== null) {
      return { ...item, name: getIngredientName(item.ingredientId, item.name) };
    }
    return isUnmatchedGeneratedLine(item) ? { ...item, name: getSwapItemName(item.name) } : item;
  }),
);
const view = computed(() =>
  list.value
    ? getShoppingListView(shownItems.value, { isBoughtLast: isBoughtLast.value, locale: locale.value })
    : null,
);
const { isGroupExpanded, setGroupExpanded } = useShoppingListGroupExpansion(() => list.value?.id ?? null);

// Store recommendations (I1a): "Usually bought at Lidl" on lines to buy, read after the list and never in the way of a
// tick. The viewer can hide them, or group the list by recommended shop, the shop they are shopping at first. The chips
// show only once there is a hint.
const { hints: shopHints } = useShoppingListShopHints(
  () => list.value?.id ?? null,
  () => items.value.map((item) => item.id),
);
const { areHintsShown, isGroupedByShop, setHintsShown, setGroupedByShop } = useShoppingListShopHintPreferences();
const NO_SHOP_HINTS: ReadonlyMap<string, ShoppingItemShopHint> = new Map();
const hasShopHints = computed(() => shopHints.value.size > 0);
const shownShopHints = computed(() => (areHintsShown.value ? shopHints.value : NO_SHOP_HINTS));
const isShopView = computed(() => isGroupedByShop.value && areHintsShown.value && hasShopHints.value);

// Catching up after changes may have been missed (G6): the lines are read again, and when the plan changed meanwhile
// the list is first brought up to date, as on opening it. Losing access (left the household) shows "not found".
const catchUp = createCoalescedRunner(async () => {
  const remoteChangesBefore = countRemoteChanges();
  const result = await load(id);
  if (result.status === "failed") {
    return;
  }
  if (result.status === "found" && result.list.generatedVersion < result.list.sourceVersion) {
    await reloadList();
    return;
  }
  listResult.value = { isUpToDate: true, remoteChangesBefore, result };
});
watch(
  () => sourceVersion,
  () => catchUp(),
);
const { status: liveStatus } = useShoppingListLive(() => list.value?.id ?? null, {
  onItemChange: applyRemoteChange,
  onListChange: (change) => {
    if (isShoppingListCatchUpNeeded(change, list.value?.missingSwapCount ?? 0)) {
      catchUp();
    }
  },
  onCatchUp: catchUp,
});

// Shops (G7): their names for "Bought at Lidl", and the ones to pick from. A line can name a shop this page does not
// know yet (another member just added it), so the shops are read again then, once per such shop.
const shopNames = computed(() => new Map(shops.value.map((shop) => [shop.id, shop.name])));
const shopChoices = computed(() => getShopChoices(shops.value, locale.value));
const requestedShopIds = new Set<string>();
watch(
  () => items.value.flatMap((item) => (item.shopId !== null && !shopNames.value.has(item.shopId) ? [item.shopId] : [])),
  (unknownShopIds) => {
    const newShopIds = unknownShopIds.filter((shopId) => !requestedShopIds.has(shopId));
    if (newShopIds.length > 0) {
      newShopIds.forEach((shopId) => requestedShopIds.add(shopId));
      reloadShops();
    }
  },
);

// The shop with this name: the household's, or a new one shown at once with an id suggested here (the database keeps
// it, or the household's shop of that name if someone added one meanwhile; the shops are read again after the call).
const toShop = (name: string): { shop: Shop; isNew: boolean } => {
  const known = findShopByName(shops.value, name);
  if (known !== null) {
    return { shop: known, isNew: false };
  }
  const shop = { id: crypto.randomUUID(), name: normaliseItemName(name) };
  addShop(shop);
  return { shop, isNew: true };
};

// The shop a bought line was bought at, so an undo that buys it again keeps it.
const getItemShop = (item: ShoppingItem): Shop | null => {
  const shopName = item.shopId === null ? undefined : shopNames.value.get(item.shopId);
  return item.shopId === null || shopName === undefined ? null : { id: item.shopId, name: shopName };
};

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
// The groups by recommended shop (I1a): each shop by its name, then the lines without a hint, then "Have at home".
const getShopGroupHeading = (group: ShoppingListShopGroup) => {
  if (group.key === HAVE_AT_HOME_GROUP_KEY) {
    return getGroupHeading(HAVE_AT_HOME_GROUP_KEY);
  }
  if (group.shopName === null) {
    return { title: t("shoppingList.shopHints.noHintGroup"), hint: t("shoppingList.shopHints.noHintGroupHint"), icon: undefined };
  }
  return { title: group.shopName, hint: undefined, icon: "mdi-storefront-outline" };
};
// Groups to shop from count "3 of 7" bought (G5); "Have at home" counts its lines, as nothing there is bought.
const getGroupCount = (key: ShoppingListPageGroupKey, boughtCount: number, itemCount: number) => {
  if (key === HAVE_AT_HOME_GROUP_KEY) {
    return { countLabel: String(itemCount), countDescription: t("shoppingList.itemCount", itemCount) };
  }
  return {
    countLabel: t("shoppingList.groupProgress", { bought: boughtCount, count: itemCount }),
    countDescription: t("shoppingList.groupProgressDescription", { bought: boughtCount, count: itemCount }),
  };
};
const shownGroups = computed(() => {
  if (view.value === null) {
    return [];
  }
  if (isShopView.value) {
    const shopGroups = getShoppingListShopGroups(view.value, shopHints.value, {
      isBoughtLast: isBoughtLast.value,
      firstShopName: defaultShopName.value,
    });
    return shopGroups.map((group) => ({ ...group, ...getShopGroupHeading(group) }));
  }
  return view.value.groups.map((group) => ({ ...group, ...getGroupHeading(group.key) }));
});
const groups = computed(() =>
  shownGroups.value.map((group) => ({
    ...group,
    ...getGroupCount(group.key, group.boughtCount, group.itemCount),
    isExpanded: isGroupExpanded(group.key),
  })),
);
// "12 of 31 bought" and its bar, as in the shopping list design.
const progressPercent = computed(() =>
  view.value && view.value.totalCount > 0 ? Math.round((view.value.boughtCount / view.value.totalCount) * 100) : 0,
);

const isAddOpen = ref(false);
const isAddInlineOpen = ref(false);

function openAdd() {
  if (isWide.value) {
    isAddInlineOpen.value = true;
  } else {
    isAddOpen.value = true;
  }
}

// The form in place stays open for the next line, as a shopper adds several at once.
const handleInlineAdd = (newItem: NewShoppingItem) => handleAdd(newItem);
const amountItem = ref<ShoppingItem | null>(null);
const isAmountOpen = ref(false);
// The last change that can be undone, offered in the snackbar until it closes.
const undoOffer = ref<{ text: string; undo: () => Promise<ShoppingItemEditResult> } | null>(null);
const isUndoOpen = ref(false);
// "Onion bought · Add shop" (G7): the line just ticked without a shop. One message shows at a time.
const shopPromptItem = ref<ShoppingItem | null>(null);
const isShopPromptOpen = ref(false);
// What the shop dialog sets: the shop the viewer is shopping at, or a bought line's shop.
const shopDialogTarget = ref<{ kind: "default" } | { kind: "item"; itemId: string } | null>(null);
const isShopDialogOpen = ref(false);

const reportFailure = (result: ShoppingItemEditResult): void => {
  if (!result.isSaved) {
    isUndoOpen.value = false;
    show(result.errorKey, "error");
  }
};

const offerUndo = (text: string, undo: () => Promise<ShoppingItemEditResult>): void => {
  isShopPromptOpen.value = false;
  undoOffer.value = { text, undo };
  isUndoOpen.value = true;
};

const offerShop = (item: ShoppingItem): void => {
  isUndoOpen.value = false;
  shopPromptItem.value = item;
  isShopPromptOpen.value = true;
};

async function handleAdd(newItem: NewShoppingItem) {
  const listId = list.value?.id;
  if (listId === undefined) {
    return;
  }
  // The new line shows in its group, which opens if it was closed; by shop, it has no hint yet.
  const groupKey = isShopView.value ? NO_SHOP_HINT_GROUP_KEY : newItem.category;
  if (!isGroupExpanded(groupKey)) {
    setGroupExpanded(groupKey, true);
  }
  reportFailure(await addItem(listId, newItem));
}

// The one place a line is ticked bought or back (G5). With a shop the viewer is shopping at, the tick records it there
// in the same call (G7); without one, a saved tick offers to add a shop, which may be ignored. Unticking deletes the
// purchase with it.
async function handleToggleBought(item: ShoppingItem) {
  if (item.state === "bought") {
    reportFailure(await setState(item.id, "to_buy"));
    return;
  }
  const defaultShop = defaultShopName.value === null ? null : toShop(defaultShopName.value);
  const result = await markBought(item, defaultShop?.shop ?? null);
  if (defaultShop?.isNew) {
    reloadShops();
  }
  if (result.isSaved && defaultShop === null) {
    offerShop(item);
  }
  reportFailure(result);
}

async function handleToggleAtHome(item: ShoppingItem) {
  const isGoingHome = item.state !== "have_at_home";
  const previousShop = getItemShop(item);
  const undo = () => (item.state === "bought" ? markBought(item, previousShop) : setState(item.id, "to_buy"));
  const result = await setState(item.id, isGoingHome ? "have_at_home" : "to_buy");
  if (result.isSaved && isGoingHome) {
    offerUndo(t("shoppingList.undo.movedHome", { name: item.name }), undo);
  }
  reportFailure(result);
}

async function handleRemove(item: ShoppingItem) {
  const listId = list.value?.id;
  const shop = getItemShop(item);
  const result = await removeItem(item);
  if (result.isSaved && listId !== undefined) {
    offerUndo(t("shoppingList.undo.removed", { name: item.name }), () => restoreItem(listId, item, shop));
  }
  reportFailure(result);
}

function openDefaultShop() {
  shopDialogTarget.value = { kind: "default" };
  isShopDialogOpen.value = true;
}

function openItemShop(item: ShoppingItem) {
  shopDialogTarget.value = { kind: "item", itemId: item.id };
  isShopDialogOpen.value = true;
}

function handleShopPromptChoose() {
  if (shopPromptItem.value !== null) {
    openItemShop(shopPromptItem.value);
  }
}

// The dialog's title and choices for what it sets; the line as it is now, which may have changed since it opened.
const shopDialogItem = computed(() => {
  const target = shopDialogTarget.value;
  return target?.kind === "item" ? (shownItems.value.find((item) => item.id === target.itemId) ?? null) : null;
});
const shopDialog = computed(() => {
  const item = shopDialogItem.value;
  if (item === null) {
    return {
      title: t("shoppingList.shop.defaultTitle"),
      hint: t("shoppingList.shop.defaultHint"),
      currentName: defaultShopName.value,
      clearLabel: t("shoppingList.shop.clearDefault"),
      isRememberOffered: false,
    };
  }
  return {
    title: t("shoppingList.shop.itemTitle", { name: item.name }),
    hint: null,
    currentName: getItemShop(item)?.name ?? null,
    clearLabel: t("shoppingList.shop.clearItem"),
    isRememberOffered: true,
  };
});

// A picked or typed shop: the one the viewer is shopping at from now on, or the line's (and, unless turned off, the
// one for the next lines too).
async function handleShopSave(name: string, isRemembered: boolean) {
  const target = shopDialogTarget.value;
  if (target?.kind === "default") {
    setDefaultShopName(findShopByName(shops.value, name)?.name ?? name);
    return;
  }
  if (target?.kind !== "item") {
    return;
  }
  const { shop, isNew } = toShop(name);
  if (isRemembered) {
    setDefaultShopName(shop.name);
  }
  const result = await setShop(target.itemId, shop);
  if (isNew) {
    reloadShops();
  }
  reportFailure(result);
}

async function handleShopClear() {
  const target = shopDialogTarget.value;
  if (target?.kind === "default") {
    setDefaultShopName(null);
  } else if (target?.kind === "item") {
    reportFailure(await setShop(target.itemId, null));
  }
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
  <div :class="[$style.panel, isPane && $style.pane]" data-testid="shopping-list-panel">
    <template v-if="list && view">
      <header :class="$style.header">
        <span v-if="subtitle && !isPane" :class="$style.subtitle" data-testid="shopping-list-plan">{{ subtitle }}</span>
        <div :class="$style.titleRow">
          <h2 v-if="isPane" :class="[$style.title, $style.paneTitle]">{{ t("shoppingList.title") }}</h2>
          <h1 v-else :class="$style.title">{{ t("shoppingList.title") }}</h1>
          <ShoppingListLiveStatus :status="liveStatus" :class="$style.liveStatus" />
          <v-btn
            v-if="isPane"
            :to="`/plans/${id}/list`"
            icon="mdi-open-in-new"
            variant="text"
            :aria-label="t('shoppingList.openFull')"
            data-testid="shopping-list-open-full"
          />
        </div>
      </header>

      <div :class="$style.progress">
        <span :class="$style.counts">
          <i18n-t
            v-if="view.totalCount > 0"
            keypath="shoppingList.progress.summary"
            tag="span"
            scope="global"
            :class="$style.summary"
            data-testid="shopping-list-progress"
          >
            <template #bought>
              <b>{{ view.boughtCount }}</b>
            </template>
            <template #total>{{ view.totalCount }}</template>
          </i18n-t>
          <span v-else data-testid="shopping-list-progress">{{ t("shoppingList.progress.nothingToBuy") }}</span>
          <span v-if="view.atHomeCount > 0" data-testid="shopping-list-at-home-count">
            {{ t("shoppingList.atHomeCount", { count: view.atHomeCount }) }}
          </span>
        </span>
        <div
          v-if="view.totalCount > 0"
          role="progressbar"
          :aria-label="t('shoppingList.progress.label')"
          aria-valuemin="0"
          :aria-valuemax="view.totalCount"
          :aria-valuenow="view.boughtCount"
          :aria-valuetext="t('shoppingList.progress.valueText', { bought: view.boughtCount, total: view.totalCount })"
          :class="$style.track"
          data-testid="shopping-list-progress-bar"
        >
          <div :class="$style.bar" :style="{ width: `${progressPercent}%` }" />
        </div>
      </div>

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

      <div v-if="view.totalCount > 0" :class="$style.chips">
        <button
          type="button"
          :class="[$style.chip, $style.shopChip]"
          aria-haspopup="dialog"
          data-testid="shopping-list-shop"
          @click="openDefaultShop"
        >
          <v-icon icon="mdi-storefront-outline" size="16" aria-hidden="true" />
          <span :class="$style.chipText">
            {{ defaultShopName === null ? t("shoppingList.shop.chipNone") : t("shoppingList.shop.chip", { shop: defaultShopName }) }}
          </span>
          <v-icon icon="mdi-menu-down" size="16" aria-hidden="true" />
        </button>
        <button
          type="button"
          :class="$style.chip"
          :aria-pressed="isBoughtLast"
          data-testid="shopping-list-bought-last"
          @click="setBoughtLast(!isBoughtLast)"
        >
          <v-icon :icon="isBoughtLast ? 'mdi-check' : 'mdi-sort'" size="16" aria-hidden="true" />
          {{ t("shoppingList.boughtLast") }}
        </button>
        <button
          v-if="hasShopHints"
          type="button"
          :class="$style.chip"
          :aria-pressed="areHintsShown"
          data-testid="shopping-list-shop-hints"
          @click="setHintsShown(!areHintsShown)"
        >
          <v-icon :icon="areHintsShown ? 'mdi-check' : 'mdi-lightbulb-outline'" size="16" aria-hidden="true" />
          {{ t("shoppingList.shopHints.toggle") }}
        </button>
        <button
          v-if="hasShopHints && areHintsShown"
          type="button"
          :class="$style.chip"
          :aria-pressed="isGroupedByShop"
          data-testid="shopping-list-by-shop"
          @click="setGroupedByShop(!isGroupedByShop)"
        >
          <v-icon :icon="isGroupedByShop ? 'mdi-check' : 'mdi-storefront-outline'" size="16" aria-hidden="true" />
          {{ t("shoppingList.shopHints.groupByShop") }}
        </button>
      </div>

      <!-- From 960px "Add item" opens a form in place; phones get the round button and a dialog. -->
      <ShoppingAddItemForm
        v-if="isWide && isAddInlineOpen"
        is-inline
        :class="$style.addForm"
        @save="handleInlineAdd"
        @cancel="isAddInlineOpen = false"
      />
      <button
        v-else
        type="button"
        :class="$style.addInline"
        data-testid="shopping-add-open"
        @click="openAdd"
      >
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
            :shop-names="shopNames"
            :shop-hints="shownShopHints"
            @toggle-bought="handleToggleBought"
            @toggle-at-home="handleToggleAtHome"
            @edit-amount="openAmount"
            @choose-shop="openItemShop"
            @remove="handleRemove"
          />
        </ShoppingItemGroup>
      </div>

      <LayoutActionBar v-if="!isPane" is-hidden-from-md>
        <v-btn
          icon="mdi-plus"
          color="primary"
          size="x-large"
          rounded="lg"
          :aria-label="t('shoppingList.addItem.open')"
          data-testid="shopping-add-fab"
          @click="isAddOpen = true"
        />
      </LayoutActionBar>
      <ShoppingAddItemDialog v-model="isAddOpen" @save="handleAdd" />
      <ShoppingAmountDialog v-model="isAmountOpen" :item="amountItem" @save="handleAmount" />
      <ShoppingUndoSnackbar v-model="isUndoOpen" :text="undoOffer?.text ?? ''" @undo="handleUndo" />
      <ShoppingShopPrompt
        v-model="isShopPromptOpen"
        :text="shopPromptItem ? t('shoppingList.shop.prompt', { name: shopPromptItem.name }) : ''"
        @choose="handleShopPromptChoose"
      />
      <ShoppingShopDialog
        v-model="isShopDialogOpen"
        :title="shopDialog.title"
        :hint="shopDialog.hint"
        :shops="shopChoices"
        :current-name="shopDialog.currentName"
        :clear-label="shopDialog.clearLabel"
        :is-remember-offered="shopDialog.isRememberOffered"
        @save="handleShopSave"
        @clear="handleShopClear"
      />
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
.panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

/* Beside the plan: a surface of its own, as in the desktop design. */
.pane {
  padding: var(--space-4) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background-color: var(--color-surface);
}

.paneTitle {
  flex: 1 1 0;
  min-width: 0;
  font-size: 18px;
}

/* In the narrow pane the live status goes below the title and its link. */
.pane .liveStatus {
  flex-basis: 100%;
  order: 1;
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

.titleRow {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
}

.progress {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.counts {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: var(--space-2);
  font-size: 14px;
  color: var(--color-muted);
}

.summary {
  color: var(--color-on-background);
}

.track {
  height: 8px;
  overflow: hidden;
  border-radius: 4px;
  background: color-mix(in srgb, var(--color-muted) 22%, transparent);
}

.bar {
  height: 100%;
  border-radius: 4px;
  background: var(--color-primary);
  transition: width 0.2s ease;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

/* A pill as in the design, with a touch target of at least 44 px. */
.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: var(--touch-target);
  padding: 0 14px;
  border: 1px solid color-mix(in srgb, var(--color-muted) 55%, transparent);
  border-radius: 22px;
  background: none;
  color: inherit;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}

/* The design's "Shopping at Lidl": bold, and a long shop name is cut short rather than pushing the row wider. */
.shopChip {
  max-width: 100%;
  font-weight: 600;
}

.chipText {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chip[aria-pressed="true"] {
  border-color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 12%, transparent);
  font-weight: 600;
}

.chip:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .bar {
    transition: none;
  }
}

/* "Add item" as a dashed row above the groups on wider screens, as in the plan screen's list; phones get the round
   button above the navigation bar instead, as in the shopping list design. */
.addInline {
  display: none;
  align-items: center;
  gap: var(--space-2);
  min-height: var(--touch-target);
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

.addForm {
  padding: var(--space-3);
  border: 1px dashed color-mix(in srgb, var(--color-muted) 45%, transparent);
  border-radius: 10px;
}

@media (min-width: 960px) {
  .addInline {
    display: flex;
  }
}

/* A pane is only ever beside the plan on a wide screen. */
.pane .addInline {
  display: flex;
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
