<script setup lang="ts">
interface NavItem {
  key: string;
  to: string;
  icon: string;
  activeIcon: string;
}

const NAV_ITEMS: readonly NavItem[] = [
  { key: "home", to: "/", icon: "mdi-home-outline", activeIcon: "mdi-home" },
  { key: "plan", to: "/plans", icon: "mdi-calendar-week", activeIcon: "mdi-calendar-week" },
  { key: "list", to: "/list", icon: "mdi-cart-outline", activeIcon: "mdi-cart" },
  { key: "recipes", to: "/recipes", icon: "mdi-book-open-variant", activeIcon: "mdi-book-open-variant" },
  { key: "me", to: "/me", icon: "mdi-account-circle-outline", activeIcon: "mdi-account-circle" },
];

// A plan's shopping list lives under its plan but belongs to "List", e.g. "/plans/0b6f…/list".
const SHOPPING_LIST_PATH_REGEX = /^\/plans\/[^/]+\/list\/?$/;

const { t } = useI18n();
const route = useRoute();
const { profile } = useProfile();

// The rail's profile button shows the first letter of the name, as in the desktop design.
const initial = computed(() => profile.value?.displayName.trim().charAt(0).toLocaleUpperCase() || null);

const isActive = ({ key, to }: NavItem): boolean => {
  const isShoppingList = SHOPPING_LIST_PATH_REGEX.test(route.path);
  switch (key) {
    case "home":
      return route.path === "/";
    case "list":
      return isShoppingList || route.path.startsWith(to);
    case "plan":
      return !isShoppingList && route.path.startsWith(to);
    default:
      return route.path.startsWith(to);
  }
};
</script>

<template>
  <!-- Phones: the navigation is a bar along the bottom edge and the rest of the rail is left out. From 960px it is a
       rail down the left edge with the app's mark on top and the language, theme and profile at its foot (X4). -->
  <div :class="$style.rail">
    <NuxtLink to="/" :class="$style.brand" :aria-label="t('nav.brand')">
      <v-icon icon="mdi-silverware-fork-knife" size="22" aria-hidden="true" />
    </NuxtLink>
    <nav :class="$style.nav" :aria-label="t('nav.label')">
    <NuxtLink
      v-for="item in NAV_ITEMS"
      :key="item.key"
      :to="item.to"
      :class="[$style.item, isActive(item) && $style.active]"
      :aria-current="isActive(item) ? 'page' : undefined"
    >
      <span :class="$style.icon">
        <v-icon :icon="isActive(item) ? item.activeIcon : item.icon" size="22" />
      </span>
      <span :class="$style.label">{{ t(`nav.${item.key}`) }}</span>
    </NuxtLink>
    </nav>
    <div :class="$style.foot">
      <AppLanguageSwitcher menu-location="end bottom" />
      <AppThemeToggle />
      <NuxtLink to="/me" :class="$style.profile" :aria-label="t('profile.open')" data-testid="rail-profile">
        <span v-if="initial" :class="$style.avatar" aria-hidden="true">{{ initial }}</span>
        <v-icon v-else icon="mdi-account-circle" size="28" aria-hidden="true" />
      </NuxtLink>
    </div>
  </div>
</template>

<style module>
/* Phones: only the bottom bar shows. */
.rail {
  display: contents;
}

.brand,
.foot {
  display: none;
}

.nav {
  position: fixed;
  inset: auto 0 0;
  z-index: 1005;
  display: flex;
  height: calc(var(--nav-height) + env(safe-area-inset-bottom, 0px));
  padding-inline: var(--space-2);
  padding-bottom: env(safe-area-inset-bottom, 0px);
  border-top: 1px solid var(--color-border);
  background-color: var(--color-surface);
}

.item {
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-width: var(--touch-target);
  color: var(--color-muted);
  text-decoration: none;
}

.icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 30px;
  border-radius: 15px;
}

.label {
  max-width: 100%;
  overflow: hidden;
  font-size: 12px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.active {
  color: var(--color-primary);
}

.active .icon {
  background-color: color-mix(in srgb, var(--color-primary) 14%, transparent);
}

.active .label {
  font-weight: 600;
}

.item:focus-visible,
.brand:focus-visible,
.profile:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
  border-radius: var(--radius-md);
}

/* Desktop: a rail the full height of the window, as in the desktop design. */
@media (min-width: 960px) {
  .rail {
    position: fixed;
    inset: 0 auto 0 0;
    z-index: 1005;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-3);
    width: var(--nav-rail-width);
    padding: var(--space-3) var(--space-2);
    overflow-y: auto;
    border-right: 1px solid var(--color-border);
    background-color: var(--color-surface);
  }

  .brand {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    width: var(--touch-target);
    height: var(--touch-target);
    border-radius: 12px;
    background-color: var(--color-hero);
    color: var(--color-on-hero);
  }

  .nav {
    position: static;
    flex-direction: column;
    gap: var(--space-2);
    width: 100%;
    height: auto;
    padding: 0;
    border-top: 0;
    background: none;
  }

  .item {
    flex: 0 0 auto;
    min-height: 56px;
  }

  .foot {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    margin-top: auto;
  }

  .profile {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--touch-target);
    height: var(--touch-target);
    color: var(--color-muted);
    text-decoration: none;
  }

  .avatar {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background-color: var(--color-primary);
    color: rgb(var(--v-theme-on-primary));
    font-size: 13px;
    font-weight: 700;
  }
}
</style>
