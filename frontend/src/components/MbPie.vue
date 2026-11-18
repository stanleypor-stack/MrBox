<template>
  <footer class="mb-pie">
    <div class="mb-pie__arriba">
      <!-- ── Quiénes somos ────────────────────────────────────────── -->
      <div class="mb-pie__marca">
        <svg width="160" height="42" viewBox="0 0 1000 260" role="img" aria-label="MR BOX">
          <defs>
            <linearGradient id="ft2F" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#ffffff" />
              <stop offset=".55" stop-color="#e3eeff" />
              <stop offset="1" stop-color="#9fc3f7" />
            </linearGradient>
            <text
              id="ft2W" x="490" y="190" text-anchor="middle"
              font-family="Titan One, sans-serif" font-size="176"
              letter-spacing="-4" transform="skewX(-7) translate(22 0)"
            >MR BOX</text>
            <clipPath id="ft2C"><rect x="0" y="40" width="1100" height="78" /></clipPath>
          </defs>
          <use href="#ft2W" transform="translate(16 18)" fill="#06143a" stroke="#06143a" stroke-width="22" stroke-linejoin="round" opacity=".55" />
          <use href="#ft2W" transform="translate(14 14)" fill="#0b2266" stroke="#0b2266" stroke-width="16" stroke-linejoin="round" />
          <use href="#ft2W" transform="translate(12 12)" fill="#1a4fc0" stroke="#1a4fc0" stroke-width="12" stroke-linejoin="round" />
          <use href="#ft2W" transform="translate(8 8)" fill="#2a6fe6" stroke="#2a6fe6" stroke-width="12" stroke-linejoin="round" />
          <use href="#ft2W" transform="translate(4 4)" fill="#4a8ff5" stroke="#4a8ff5" stroke-width="12" stroke-linejoin="round" />
          <use href="#ft2W" fill="none" stroke="#0b2266" stroke-width="10" stroke-linejoin="round" />
          <use href="#ft2W" fill="url(#ft2F)" />
          <use href="#ft2W" fill="#ffffff" opacity=".55" clip-path="url(#ft2C)" />
        </svg>

        <p>{{ $t('foot.about') }}</p>

        <div class="mb-pie__edad">
          <span class="mb-pie__18">18+</span>
          <span>{{ $t('foot.age') }}</span>
        </div>
      </div>

      <!-- ── Las columnas ─────────────────────────────────────────── -->
      <div class="mb-pie__cols">
        <nav v-for="c in columnas" :key="c.titulo" :aria-label="$t(c.titulo)">
          <span class="mb-pie__titulo">{{ $t(c.titulo) }}</span>
          <router-link v-for="l in c.enlaces" :key="l.texto" :to="l.a">{{ $t(l.texto) }}</router-link>
        </nav>

        <nav :aria-label="$t('foot.support')">
          <span class="mb-pie__titulo">{{ $t('foot.support') }}</span>
          <button type="button" @click="$emit('soporte')">{{ $t('foot.liveChat') }}</button>
          <button type="button" @click="$emit('soporte')">{{ $t('foot.helpCenter') }}</button>
          <router-link to="/profile?tab=refer">{{ $t('foot.partner') }}</router-link>
        </nav>

        <div class="mb-pie__idioma">
          <span class="mb-pie__titulo">{{ $t('common.language') }}</span>
          <mb-selector-de-idioma />
        </div>
      </div>
    </div>

    <!-- ── La letra chica ───────────────────────────────────────── -->
    <div class="mb-pie__chica">
      <p>{{ $t('foot.legal1') }}</p>
      <p>{{ $t('foot.legal2') }}</p>
      <p>{{ $t('foot.legal3') }}</p>
      <p class="mb-pie__copy">{{ $t('foot.copy', { anio: anio }) }}</p>
    </div>
  </footer>
</template>

<script>
import MbSelectorDeIdioma from "@/components/MbSelectorDeIdioma.vue";

/*
  LAS CUATRO COLUMNAS DEL DISEÑO.

  Legal, Explorar, Ganar más y Soporte. Todas llevan a pantallas que
  existen: un pie lleno de enlaces muertos es peor que un pie corto.
*/
const COLUMNAS = [
  {
    titulo: "foot.legal",
    enlaces: [
      { texto: "foot.terms", a: "/legal/terms" },
      { texto: "foot.rules", a: "/legal/rules" },
      { texto: "foot.responsible", a: "/legal/responsible" },
      { texto: "foot.privacy", a: "/legal/privacy" },
      { texto: "foot.acceptance", a: "/legal/acceptance" },
    ],
  },
  {
    titulo: "foot.explore",
    enlaces: [
      { texto: "nav.boxes", a: "/boxes" },
      { texto: "boxes.allBoxes", a: "/boxes" },
      { texto: "nav.community", a: "/community" },
      { texto: "nav.deals", a: "/deals" },
      { texto: "nav.createBox", a: "/create" },
    ],
  },
  {
    titulo: "foot.earn",
    enlaces: [
      { texto: "races.weeklyShort", a: "/races/weekly" },
      { texto: "nav.promotions", a: "/promotions" },
      { texto: "nav.challenges", a: "/challenges" },
      { texto: "nav.rewards", a: "/rewards" },
      { texto: "nav.vip", a: "/vip" },
      { texto: "nav.affiliates", a: "/affiliates" },
    ],
  },
];

/**
 * EL PIE.
 *
 * Lo que está abajo de todo: quiénes somos, los enlaces, el selector de
 * idioma y la letra chica.
 *
 * LA LETRA CHICA NO ES RELLENO
 *
 * Los tres párrafos de abajo son los que dicen que no somos Pokémon ni
 * Nintendo ni Rolex, que esto es un sorteo y no una compra, y que hay
 * que ser mayor de edad. Son lo que separa un sitio de cajas de un
 * problema legal, y por eso están en todas las pantallas.
 */
export default {
  name: "MbPie",
  components: { MbSelectorDeIdioma },

  data() { return { columnas: COLUMNAS, anio: new Date().getFullYear() }; },
};
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

.mb-pie {
  margin-top: 64px;
  padding-top: 36px;
  border-top: 1px solid #1a2a45;
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.mb-pie__arriba { display: flex; flex-wrap: wrap; gap: 36px; }

.mb-pie__marca {
  flex: 1 1 260px;
  max-width: 340px;
  display: flex;
  flex-direction: column;
  gap: 14px;

  p { margin: 0; font-size: 14px; line-height: 1.6; color: $texto-3; }
}

.mb-pie__edad { display: flex; align-items: center; gap: 12px; font-size: 13px; line-height: 1.5; color: $texto-4; }

.mb-pie__18 {
  width: 40px;
  height: 40px;
  flex: none;
  border-radius: 50%;
  border: 2px solid #ff5b6b;
  color: #ff5b6b;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 900;
  font-size: 13px;
}

.mb-pie__cols {
  flex: 999 1 520px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 26px 20px;

  nav, .mb-pie__idioma { display: flex; flex-direction: column; gap: 10px; align-items: flex-start; }

  a, button {
    font-weight: 500;
    font-size: 14px;
    text-decoration: none;
    color: $texto-4;
    background: none;
    border: 0;
    padding: 0;
    font-family: inherit;
    text-align: left;
    cursor: pointer;
    @include foco;
    &:hover { color: #fff; }
  }
}

.mb-pie__titulo { font-weight: 900; font-size: 13px; letter-spacing: .1em; color: #fff; }

.mb-pie__chica {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 22px;
  border-top: 1px solid #1a2a45;
  font-size: 12px;
  line-height: 1.6;
  color: #6f84ab;

  p { margin: 0; }
}

.mb-pie__copy { color: $texto-4; }
</style>
