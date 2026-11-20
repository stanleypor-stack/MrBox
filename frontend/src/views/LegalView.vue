<template>
  <div class="mb-legal">
    <nav class="mb-legal__lista" :aria-label="$t('legal.index')">
      <router-link
        v-for="p in paginas" :key="p.id" :to="`/legal/${p.id}`"
        class="mb-legal__link" :class="{ 'is-aca': p.id === cual }"
      >{{ $t(p.titulo) }}</router-link>
    </nav>

    <article class="mb-legal__hoja">
      <h1>{{ $t(actual.titulo) }}</h1>
      <p class="mb-legal__sub">{{ $t(actual.sub) }}</p>

      <div class="mb-legal__aviso">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffd35a"
             stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
        </svg>
        <span>{{ $t('legal.pending') }}</span>
      </div>

      <p class="mb-legal__cierre">
        {{ $t('legal.askUs') }}
        <button type="button" class="mb-legal__soporte" @click="abrirSoporte">
          {{ $t('legal.contactSupport') }}
        </button>
      </p>
    </article>
  </div>
</template>

<script>
/**
 * LAS PAGINAS LEGALES.
 *
 * Los cinco enlaces del pie --terminos, reglas del sorteo, juego
 * responsable, privacidad y aceptacion de clientes-- apuntaban a
 * `/legal/*`, que no existia: el comodin del router los mandaba al
 * catalogo de cajas. El que tocaba "Reglas del sorteo" terminaba
 * mirando cajas, y el mismo pie dice que los premios se canjean "segun
 * las reglas oficiales".
 *
 * El texto de cada una lo escribe el equipo; esto es la pantalla que
 * lo va a sostener, con el aviso de que todavia no esta. Una pagina
 * que dice la verdad es mejor que un enlace que no lleva a ningun
 * lado.
 */
const PAGINAS = [
  { id: "terms", titulo: "foot.terms", sub: "legal.termsSub" },
  { id: "rules", titulo: "foot.rules", sub: "legal.rulesSub" },
  { id: "responsible", titulo: "foot.responsible", sub: "legal.responsibleSub" },
  { id: "privacy", titulo: "foot.privacy", sub: "legal.privacySub" },
  { id: "acceptance", titulo: "foot.acceptance", sub: "legal.acceptanceSub" },
];

export default {
  name: "LegalView",

  data() {
    return { paginas: PAGINAS };
  },

  computed: {
    cual() {
      const pedida = String(this.$route.params.pagina || "");
      return PAGINAS.some((p) => p.id === pedida) ? pedida : PAGINAS[0].id;
    },

    actual() {
      return PAGINAS.find((p) => p.id === this.cual) || PAGINAS[0];
    },
  },

  methods: {
    abrirSoporte() { this.$store.dispatch("pedirSoporte", ""); },
  },

  metaInfo() { return {}; },
};
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

.mb-legal {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 18px;
  align-items: start;
  padding: 18px 0 40px;
}

.mb-legal__lista {
  display: grid;
  gap: 4px;
  position: sticky;
  top: calc(var(--alto-cabecera, 72px) + 12px);
  border: 1px solid $borde;
  border-radius: 14px;
  background: $panel;
  padding: 8px;
}

.mb-legal__link {
  display: block;
  padding: 9px 11px;
  border-radius: 9px;
  font-weight: 800;
  font-size: 13.5px;
  color: $texto-3;
  text-decoration: none;

  &:hover { background: $panel-hover; color: $texto; }
  &.is-aca { background: $azul-activo; color: $texto; }
}

.mb-legal__hoja {
  border: 1px solid $borde;
  border-radius: 16px;
  background: $panel;
  padding: 24px;
  min-width: 0;

  h1 {
    margin: 0 0 6px;
    font-size: clamp(22px, 4vw, 28px);
    font-weight: 900;
    text-wrap: balance;
  }
}

.mb-legal__sub {
  margin: 0 0 20px;
  color: $texto-4;
  font-size: 14.5px;
  line-height: 1.5;
  max-width: 62ch;
}

.mb-legal__aviso {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 14px 16px;
  border-radius: 12px;
  border: 1px dashed rgba(255, 211, 90, .45);
  background: rgba(255, 211, 90, .07);
  color: $texto-2;
  font-size: 14px;
  line-height: 1.5;

  svg { flex: none; margin-top: 1px; }
}

.mb-legal__cierre {
  margin: 20px 0 0;
  color: $texto-4;
  font-size: 13.5px;
}

.mb-legal__soporte {
  font: inherit;
  font-weight: 800;
  color: $enlace;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  text-decoration: underline;

  &:hover { color: $texto; }
}

@media (max-width: 760px) {
  .mb-legal { grid-template-columns: minmax(0, 1fr); gap: 12px; }

  .mb-legal__lista {
    position: static;
    display: flex;
    gap: 6px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .mb-legal__link { flex: none; white-space: nowrap; }
  .mb-legal__hoja { padding: 18px; }
}
</style>
