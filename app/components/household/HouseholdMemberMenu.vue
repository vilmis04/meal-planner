<script setup lang="ts">
defineProps<{ memberName: string }>();
defineEmits<{ makeOwner: []; remove: [] }>();

const { t } = useI18n();
</script>

<template>
  <v-menu location="bottom end">
    <template #activator="{ props: activatorProps }">
      <v-btn
        v-bind="activatorProps"
        icon="mdi-dots-vertical"
        variant="text"
        color="muted"
        :class="$style.trigger"
        :aria-label="t('household.members.actions', { name: memberName })"
      />
    </template>
    <v-list density="comfortable">
      <v-list-item
        prepend-icon="mdi-crown-outline"
        :title="t('household.members.makeOwner')"
        @click="$emit('makeOwner')"
      />
      <v-list-item
        prepend-icon="mdi-account-remove-outline"
        base-color="error"
        :title="t('household.members.remove')"
        @click="$emit('remove')"
      />
    </v-list>
  </v-menu>
</template>

<style module>
/* A touch target of at least 44 px. */
.trigger {
  width: 44px;
  height: 44px;
}
</style>
