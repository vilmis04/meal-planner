<script setup lang="ts">
const { t } = useI18n();
const { household, loadFailed } = useHousehold();
</script>

<template>
  <template v-if="!loadFailed">
    <v-card v-if="household" to="/household" variant="flat" border :class="$style.card">
      <div :class="$style.row">
        <v-avatar color="primary" variant="tonal" rounded="lg">
          <v-icon icon="mdi-home-account" />
        </v-avatar>
        <div :class="$style.text">
          <span :class="$style.title">{{ household.name }}</span>
          <span :class="$style.hint">
            {{ t("household.overview.memberCount", household.members.length) }}
          </span>
        </div>
        <v-icon icon="mdi-chevron-right" :aria-label="t('household.homeCard.open')" />
      </div>
    </v-card>

    <v-card v-else variant="flat" border :class="$style.card">
      <div :class="$style.row">
        <v-avatar color="primary" variant="tonal" rounded="lg">
          <v-icon icon="mdi-home-heart" />
        </v-avatar>
        <div :class="$style.text">
          <span :class="$style.title">{{ t("household.homeCard.createTitle") }}</span>
          <span :class="$style.hint">{{ t("household.homeCard.createHint") }}</span>
        </div>
      </div>
      <v-btn to="/household" color="primary" size="large" block>
        {{ t("household.homeCard.createAction") }}
      </v-btn>
    </v-card>
  </template>
</template>

<style module>
.card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-3);
  border-radius: var(--radius-lg);
}

.row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.text {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
}

.title {
  font-size: 16px;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.hint {
  color: var(--color-muted);
  font-size: 13px;
}
</style>
