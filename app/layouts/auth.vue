<template>
  <v-app>
    <v-main>
      <header :class="$style.hero">
        <div :class="$style.toolbar">
          <AppThemeToggle />
        </div>
        <div :class="$style.brand">
          <div :class="$style.logo">
            <v-icon icon="mdi-silverware-fork-knife" size="28" />
          </div>
          <h1 :class="$style.title">{{ t("app.name") }}</h1>
          <p :class="$style.tagline">{{ t("auth.hero.tagline") }}</p>
        </div>
      </header>

      <div :class="$style.content">
        <slot />
      </div>
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
const { t } = useI18n();
</script>

<style module>
.hero {
  background-color: var(--color-hero);
  color: var(--color-on-hero);
  padding: var(--space-2) var(--space-3) 64px;
}

.toolbar {
  display: flex;
  justify-content: flex-end;
  max-width: var(--auth-max-width);
  margin-inline: auto;
}

.brand {
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-width: var(--auth-max-width);
  margin-inline: auto;
  padding: var(--space-4) var(--space-2) 0;
}

.logo {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: var(--radius-lg);
  background-color: rgb(255 255 255 / 14%);
}

.title {
  margin: 0;
  font-size: 32px;
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -0.02em;
}

.tagline {
  margin: 0;
  font-size: 16px;
  line-height: 1.45;
  opacity: 0.85;
}

.content {
  max-width: var(--auth-max-width);
  margin: -40px auto 0;
  padding: 0 var(--space-3) var(--space-5);
}
</style>
