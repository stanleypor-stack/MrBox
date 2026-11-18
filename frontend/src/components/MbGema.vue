<template>
  <svg class="mb-gema" :width="lado" :height="lado" viewBox="0 0 64 64" aria-hidden="true">
    <polygon points="20,12 44,12 54,25 32,57 10,25" :fill="c[3]" />
    <polygon points="22,14 42,14 38,25 26,25" :fill="c[0]" />
    <polygon points="12,25 22,14 26,25" :fill="c[1]" />
    <polygon points="42,14 52,25 38,25" :fill="c[2]" />
    <polygon points="12,25 26,25 32,55" :fill="c[1]" />
    <polygon points="26,25 38,25 32,55" :fill="c[0]" opacity=".9" />
    <polygon points="38,25 52,25 32,55" :fill="c[2]" />
    <polygon
      points="20,12 44,12 54,25 32,57 10,25" fill="none"
      :stroke="c[3]" stroke-width="2" stroke-linejoin="round"
    />
  </svg>
</template>

<script>
import { gemaDe } from "@/utils/gemas";

/** La piedra de un rango VIP. La misma en el sitio y en el panel. */
export default {
  name: "MbGema",

  props: {
    numero: { type: Number, default: 1 },
    lado: { type: [Number, String], default: 28 },
  },

  computed: {
    c() { return gemaDe(this.numero); },
  },
};
</script>

<style lang="scss" scoped>
.mb-gema { flex: none; display: block; }
</style>
