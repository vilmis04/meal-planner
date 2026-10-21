<script setup lang="ts" generic="TValue extends string">
interface ChoiceOption {
  value: TValue;
  label: string;
  icon?: string;
}

const { title, options, selected } = defineProps<{
  title: string;
  options: ChoiceOption[];
  selected: TValue;
}>();

const emit = defineEmits<{ select: [value: TValue] }>();

function handleUpdate(value: TValue) {
  if (value !== selected) {
    emit("select", value);
  }
}
</script>

<template>
  <section :class="$style.section">
    <h2 :class="$style.title">{{ title }}</h2>
    <v-btn-toggle
      :model-value="selected"
      :class="$style.toggle"
      color="primary"
      variant="outlined"
      rounded="lg"
      divided
      mandatory
      @update:model-value="handleUpdate"
    >
      <v-btn
        v-for="option in options"
        :key="option.value"
        :value="option.value"
        :prepend-icon="option.icon"
      >
        {{ option.label }}
      </v-btn>
    </v-btn-toggle>
  </section>
</template>

<style module>
.section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.title {
  margin: 0;
  padding-inline: var(--space-1);
  font-size: 17px;
  font-weight: 700;
}

.toggle {
  width: 100%;
}

/* Equal-width options that still fit icon + label in a third of a 390px screen. */
.toggle :global(.v-btn) {
  flex: 1 1 0;
  min-width: 0;
  padding-inline: var(--space-2);
}
</style>
