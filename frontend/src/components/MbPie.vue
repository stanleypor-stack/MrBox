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

        <!-- ── Las redes ──────────────────────────────────────── -->
        <nav class="mb-pie__redes" :aria-label="$t('foot.follow')">
          <a
            v-for="r in redes" :key="r.nombre" :href="r.a"
            class="mb-pie__red" target="_blank" rel="noopener noreferrer"
            :aria-label="`${r.nombre} @${CUENTA}`" :title="`@${CUENTA}`"
          >
            <svg width="19" height="19" viewBox="0 0 24 24" :fill="r.relleno ? 'currentColor' : 'none'"
                 :stroke="r.relleno ? 'none' : 'currentColor'" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path v-for="(d, i) in r.dibujo" :key="i" :d="d" />
              <circle v-if="r.circulo" :cx="r.circulo[0]" :cy="r.circulo[1]" :r="r.circulo[2]" />
            </svg>
          </a>
        </nav>

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
          <!--
            El centro de ayuda lleva a Controles, que es donde estan
            los limites y la pausa. Antes abria el mismo chat que el
            boton de arriba: dos botones pegados que hacian lo mismo.

            "Programa de socios" salio de aca: el programa se maneja
            desde Refer & Earn y el pie lo anunciaba dos veces.
          -->
          <router-link to="/profile?tab=controles">{{ $t('foot.helpCenter') }}</router-link>
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
      { texto: "foot.fair", a: "/legal/fair" },
      { texto: "foot.shipping", a: "/legal/shipping" },
      { texto: "foot.refunds", a: "/legal/refunds" },
      { texto: "foot.responsible", a: "/legal/responsible" },
      { texto: "foot.privacy", a: "/legal/privacy" },
      { texto: "foot.cookies", a: "/legal/cookies" },
      { texto: "foot.aml", a: "/legal/aml" },
    ],
  },
  {
    titulo: "foot.explore",
    enlaces: [
      { texto: "side.allBoxes", a: "/boxes" },
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

/*
  LAS REDES.

  El mismo nombre en las cuatro, asi que la cuenta va aparte y las
  direcciones se arman con ella: cambiarla es cambiar un renglon.
*/
const CUENTA = "mrboxgg";

const REDES = [
  {
    nombre: "Instagram",
    a: `https://instagram.com/${CUENTA}`,
    circulo: [12, 12, 4],
    dibujo: [
      "M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5z",
      "M17.5 6.5h.01",
    ],
  },
  {
    /* La X de Twitter, rellena: en trazo no se lee a 19px. */
    nombre: "Twitter",
    a: `https://x.com/${CUENTA}`,
    relleno: true,
    dibujo: [
      "M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.65l-5.22-6.82-5.97 6.82H1.66l7.73-8.84L1.25 2.25h6.82l4.71 6.23zm-1.16 17.52h1.83L7.08 4.13H5.11z",
    ],
  },
  {
    nombre: "Telegram",
    a: `https://t.me/${CUENTA}`,
    relleno: true,
    dibujo: [
      "M21.94 4.3 2.9 11.64c-1.3.52-1.29 1.25-.24 1.57l4.89 1.53 1.88 5.77c.23.63.11.88.77.88.51 0 .74-.23 1.03-.51l2.37-2.3 4.93 3.64c.91.5 1.56.24 1.79-.84l3.24-15.27c.33-1.33-.5-1.93-1.62-1.42z",
    ],
  },
  {
    /* La K de Kick, rellena: es un logotipo, no un trazo. */
    nombre: "Kick",
    a: `https://kick.com/${CUENTA}`,
    relleno: true,
    dibujo: [
      "M3 3h5.4v5.4h2.7V5.7h2.7V3H21v7.5h-2.7v3h2.7V21h-7.2v-2.7h-2.7v-2.7H8.4V21H3z",
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

  data() {
    return {
      columnas: COLUMNAS,
      redes: REDES,
      CUENTA,
      anio: new Date().getFullYear(),
    };
  },
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

/* ── Las redes ────────────────────────────────────────────────────── */

.mb-pie__redes {
  display: flex;
  gap: 10px;
  margin-top: 16px;
}

.mb-pie__red {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 12px;
  border: 1px solid #24365c;
  background: #0e1a2e;
  color: #a9bbe6;
  text-decoration: none;
  transition: background .15s, color .15s;
  @include foco;

  &:hover {
    background: #16253f;
    color: #fff;
  }
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
