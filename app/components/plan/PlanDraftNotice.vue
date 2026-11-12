<script setup lang="ts">
// "Your next draft is ready" (H3): one notice per plan the scheduled job made for the viewer that they have not opened
// yet. Opening the plan marks it read. Nothing is shown when the notices could not be read.
const { t, locale } = useI18n();
const today = useToday();
const { loadUnread } = usePlanNotifications();
const { data: result } = await useAsyncData("plan-notifications", () => loadUnread(today.value), { watch: [today] });

const notices = computed(() => {
  if (result.value?.status !== "loaded") {
    return [];
  }
  return result.value.notifications.map((notification) => ({
    id: notification.id,
    to: `/plans/${notification.planId}`,
    text: t("plan.draftNotice.text", {
      range: formatPlanRange(notification.startDate, notification.endDate, locale.value),
      kind: t(`plan.kind.${notification.planKind}`),
    }),
  }));
});
</script>

<template>
  <div v-for="notice in notices" :key="notice.id" :class="$style.notice" data-testid="plan-draft-notice">
    <v-icon icon="mdi-calendar-clock" size="22" :class="$style.icon" aria-hidden="true" />
    <div :class="$style.body">
      <p :class="$style.text">
        <strong>{{ t("plan.draftNotice.title") }}</strong>
        {{ notice.text }}
      </p>
      <NuxtLink :to="notice.to" :class="$style.action" data-testid="plan-draft-notice-action">
        {{ t("plan.draftNotice.action") }}
      </NuxtLink>
    </div>
  </div>
</template>

<style module>
.notice {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: 14px var(--space-3) var(--space-1);
  border-radius: var(--radius-lg);
  background-color: color-mix(in srgb, var(--color-secondary) 12%, transparent);
}

.icon {
  flex: 0 0 auto;
  color: var(--color-secondary);
}

.body {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
}

.text {
  margin: 0;
  font-size: 14px;
  line-height: 1.45;
}

/* At least 44px tall to tap, while reading as the design's bold text link. */
.action {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  min-height: var(--touch-target);
  color: var(--color-secondary);
  font-size: 14px;
  font-weight: 700;
  text-decoration: none;
}

.action:hover {
  text-decoration: underline;
}

.action:focus-visible {
  outline: 2px solid currentcolor;
  outline-offset: 2px;
}
</style>
