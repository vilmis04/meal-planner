<script setup lang="ts">
interface NavItem {
  key: string;
  // Null while the page does not exist yet: the item is shown but cannot be opened.
  to: string | null;
  icon: string;
  activeIcon: string;
}

const NAV_ITEMS: readonly NavItem[] = [
  { key: "home", to: "/", icon: "mdi-home-outline", activeIcon: "mdi-home" },
  { key: "plan", to: null, icon: "mdi-calendar-week", activeIcon: "mdi-calendar-week" },
  { key: "list", to: null, icon: "mdi-cart-outline", activeIcon: "mdi-cart" },
  { key: "recipes", to: null, icon: "mdi-book-open-variant", activeIcon: "mdi-book-open-variant" },
  { key: "me", to: "/me", icon: "mdi-account-circle-outline", activeIcon: "mdi-account-circle" },
];

const { t } = useI18n();
const route = useRoute();

const isActive = ({ to }: NavItem): boolean =>
  to === "/" ? route.path === "/" : to !== null && route.path.startsWith(to);
</script>

<template>
  <nav :class="$style.nav" :aria-label="t('nav.label')">
    <template v-for="item in NAV_ITEMS" :key="item.key">
      <NuxtLink
        v-if="item.to"
        :to="item.to"
        :class="[$style.item, isActive(item) && $style.active]"
        :aria-current="isActive(item) ? 'page' : undefined"
      >
        <span :class="$style.icon">
          <v-icon :icon="isActive(item) ? item.activeIcon : item.icon" size="22" />
        </span>
        <span :class="$style.label">{{ t(`nav.${item.key}`) }}</span>
      </NuxtLink>
      <span v-else :class="[$style.item, $style.disabled]" aria-disabled="true">
        <span :class="$style.icon">
          <v-icon :icon="item.icon" size="22" />
        </span>
        <span :class="$style.label">{{ t(`nav.${item.key}`) }}</span>
      </span>
    </template>
  </nav>
</template>

<style module>
/* Phones: a bar along the bottom edge. */
.nav {
  position: fixed;
  inset: auto 0 0;
  z-index: 1005;
  display: flex;
  height: var(--nav-height);
  padding-inline: var(--space-2);
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
  min-width: 44px;
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
  font-size: 12px;
  font-weight: 500;
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

.disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* 960px is --breakpoint-md; custom properties cannot be used in media queries. */
@media (min-width: 960px) {
  /* Desktop: a rail down the left edge, below the app bar. */
  .nav {
    inset: 64px auto 0 0;
    flex-direction: column;
    justify-content: flex-start;
    gap: var(--space-2);
    width: var(--nav-rail-width);
    height: auto;
    padding: var(--space-3) var(--space-2);
    border-top: 0;
    border-right: 1px solid var(--color-border);
  }

  .item {
    flex: 0 0 auto;
    min-height: 56px;
  }
}
</style>
