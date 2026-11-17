<template>
  <div class="mb-caja-pag">
    <p v-if="cargando" class="mb-vacio">{{ $t('common.loading') }}</p>

    <template v-else-if="caja">
      <!-- ── Arriba: la caja y el botón de abrir ─────────────────── -->
      <section class="mb-cabeza">
        <div class="mb-cabeza__tapa" :style="estiloTapa">
          <img v-if="caja.imageUrl" :src="caja.imageUrl" :alt="caja.name">
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"
               stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 2.5 21 7v10l-9 4.5L3 17V7zM3 7l9 4.5L21 7M12 11.5v10" />
          </svg>
        </div>

        <div class="mb-cabeza__datos">
          <h1 class="mb-cabeza__nombre">{{ caja.name }}</h1>

          <div class="mb-cabeza__meta">
            <span>{{ $t('box.items', { n: caja.prizes.length }) }}</span>
            <span class="mb-punto" aria-hidden="true">·</span>
            <span>{{ $t('box.returnLabel') }} <b>{{ caja.retornoMostrado }}%</b></span>
          </div>

          <!-- x1 a x4 -->
          <div class="mb-veces" role="group" :aria-label="$t('action.open')">
            <button
              v-for="n in caja.maximoALaVez" :key="n" type="button"
              class="mb-veces__b" :class="{ 'is-activo': veces === n }"
              :aria-pressed="veces === n ? 'true' : 'false'"
              @click="veces = n"
            >x{{ n }}</button>
          </div>

          <div class="mb-cabeza__acciones">
            <button
              type="button" class="mb-boton mb-boton--primario"
              :disabled="abriendo" @click="abrir"
            >
              <span v-if="usaGratis" class="mb-boton__gratis">{{ $t('box.freeOpenUsed') }}</span>
              <template v-else>{{ $t('box.openFor', { price: totalTexto }) }}</template>
            </button>

            <button type="button" class="mb-boton" :disabled="abriendo" @click="probar">
              {{ $t('box.demo') }}
            </button>
          </div>

          <p class="mb-cabeza__fair">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M12 3l7 4v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V7z" /><path d="M9 12l2 2 4-4" />
            </svg>
            {{ $t('box.provablyFair') }}
          </p>
        </div>
      </section>

      <!-- ── Lo que puede salir, con sus chances ─────────────────── -->
      <section class="mb-premios">
        <h2 class="mb-premios__titulo">{{ $t('box.chances') }}</h2>
        <ul class="mb-premios__lista">
          <li
            v-for="(p, i) in premiosOrdenados" :key="i"
            class="mb-premio" :style="{ borderLeftColor: color(p.rarity) }"
          >
            <span class="mb-premio__nombre">{{ p.name }}</span>
            <span class="mb-premio__valor">
              <span class="mb-sc" aria-hidden="true">SC</span>{{ plata(p.valueSc) }}
            </span>
            <span class="mb-premio__chance">{{ chance(p.chance) }}</span>
          </li>
        </ul>
      </section>
    </template>

    <!-- ── El resultado ────────────────────────────────────────────── -->
    <div v-if="resultado" class="mb-resultado" role="dialog" aria-modal="true" :aria-label="$t('box.youWon')">
      <div class="mb-resultado__caja">
        <p class="mb-resultado__titulo">{{ $t('box.youWon') }}</p>

        <ul class="mb-resultado__items">
          <li
            v-for="r in resultado.resultados" :key="r.premio._id || r.premio.name + Math.random()"
            class="mb-ganado" :style="{ borderColor: color(r.premio.rarity) }"
          >
            <span class="mb-ganado__nombre">{{ r.premio.name }}</span>
            <span class="mb-ganado__valor">
              <span class="mb-sc" aria-hidden="true">SC</span>{{ plata(r.premio.valueSc) }}
            </span>
          </li>
        </ul>

        <p v-if="resultado.demo" class="mb-resultado__demo">{{ $t('box.demoNote') }}</p>

        <div class="mb-resultado__acciones">
          <button
            v-if="!resultado.demo && vendible > 0"
            type="button" class="mb-boton mb-boton--primario"
            :disabled="vendiendo" @click="venderTodo"
          >{{ $t('box.sellFor', { amount: 'SC ' + plata(vendible) }) }}</button>

          <button type="button" class="mb-boton" @click="resultado = null">
            {{ resultado.demo ? $t('common.close') : $t('box.keep') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import api from "@/api";

const COLORES = {
  blue: "#3f7cf0", purple: "#8b4fe0", pink: "#e0418f", red: "#e2424b", gold: "#f5b80a",
};

/**
 * ABRIR UNA CAJA.
 *
 * LAS CHANCES ESTAN A LA VISTA, SIEMPRE
 *
 * No escondidas detrás de un "ver detalles". Es la diferencia entre esto
 * y una maquinita: el jugador ve qué puede salir y con qué probabilidad
 * ANTES de poner un peso. Es también lo que hace que el sorteo
 * verificable signifique algo.
 *
 * EL SALDO NO SE TOCA ACA
 *
 * La respuesta de abrir trae el saldo nuevo y se guarda ese. Restar el
 * precio en el navegador "para que se vea rápido" es cómo se termina
 * mostrando un saldo que no existe cuando algo falla a mitad de camino.
 */
export default {
  name: "BoxView",

  data() {
    return {
      caja: null,
      cargando: true,
      veces: 1,
      abriendo: false,
      vendiendo: false,
      resultado: null,
    };
  },

  computed: {
    premiosOrdenados() {
      /* De lo más caro a lo más barato: lo que el jugador quiere ver
         primero es lo grande. */
      return [...(this.caja.prizes || [])].sort((a, b) => b.valueSc - a.valueSc);
    },
    totalSc() {
      return Math.round((this.caja ? this.caja.priceSc : 0) * this.veces * 100) / 100;
    },
    totalTexto() {
      return "SC " + this.plata(this.totalSc);
    },
    /* Si le quedan gratis, la próxima no se cobra. */
    usaGratis() {
      return this.$store.getters.aperturasGratis > 0;
    },
    vendible() {
      if (!this.resultado || this.resultado.demo) return 0;
      return Math.round(
        this.resultado.resultados.reduce((a, r) => a + r.premio.valueSc, 0) * 100
      ) / 100;
    },
    estiloTapa() {
      const mejor = this.premiosOrdenados[0];
      const c = COLORES[(mejor && mejor.rarity) || "blue"] || COLORES.blue;
      return { background: `radial-gradient(circle at 50% 40%, ${c}3a 0%, #0e1a2e 72%)` };
    },
  },

  methods: {
    color(r) { return COLORES[r] || COLORES.blue; },

    plata(n) {
      return Number(n || 0).toLocaleString("en-US", {
        minimumFractionDigits: 2, maximumFractionDigits: 2,
      });
    },

    /**
     * La chance, en palabras que se entiendan.
     *
     * Un 0,0002 mostrado como "0.02%" no le dice nada a nadie. Abajo de
     * un décimo de porciento se muestra como "1 de cada N", que es como
     * la gente piensa la suerte.
     */
    chance(c) {
      const pct = c * 100;
      if (pct >= 0.1) return pct.toFixed(2) + "%";
      return "1 / " + Math.round(1 / c).toLocaleString("en-US");
    },

    async traer() {
      this.cargando = true;
      try {
        const { data } = await api.get(`/boxes/${this.$route.params.slug}`);
        this.caja = data.data;
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
        this.$router.push("/boxes");
      } finally {
        this.cargando = false;
      }
    },

    async abrir() {
      if (!this.$store.getters.entro) {
        this.$store.dispatch("avisar", { texto: this.$t("error.NOT_LOGGED_IN"), tono: "error" });
        return;
      }
      this.abriendo = true;
      try {
        const { data } = await api.post(`/boxes/${this.caja.slug}/open`, { veces: this.veces });
        this.resultado = data.data;
        this.$store.commit("saldo", data.data);
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      } finally {
        this.abriendo = false;
      }
    },

    async probar() {
      this.abriendo = true;
      try {
        const { data } = await api.post(`/boxes/${this.caja.slug}/demo`, { veces: this.veces });
        this.resultado = data.data;
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      } finally {
        this.abriendo = false;
      }
    },

    async venderTodo() {
      this.vendiendo = true;
      try {
        const ids = this.resultado.resultados.map((r) => r.premio._id).filter(Boolean);
        const { data } = await api.post("/inventory/sell-many", { ids });
        this.$store.commit("saldo", data.data);
        this.$store.dispatch("avisar", {
          texto: this.$t("box.sellFor", { amount: "SC " + this.plata(data.data.totalSc) }),
        });
        this.resultado = null;
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      } finally {
        this.vendiendo = false;
      }
    },
  },

  created() { this.traer(); },

  watch: {
    /* Si se navega de una caja a otra sin pasar por la grilla. */
    "$route.params.slug"() { this.resultado = null; this.veces = 1; this.traer(); },
  },
};
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

.mb-caja-pag {
  padding: 24px 28px 48px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  @include en-celular { padding: 16px; }
}

.mb-vacio { color: $texto-4; text-align: center; margin: 40px 0; }

/* ── Arriba ───────────────────────────────────────────────────────── */

.mb-cabeza {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  padding: 20px;
  border: 1px solid $borde;
  border-radius: $radio-panel;
  background: $panel;
}

.mb-cabeza__tapa {
  flex: 0 0 220px;
  aspect-ratio: 1 / 1;
  border-radius: $radio-tarjeta;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, .2);

  img { width: 100%; height: 100%; object-fit: contain; }
  svg { width: 44%; height: auto; }

  @include en-celular { flex: 1 1 100%; }
}

.mb-cabeza__datos {
  flex: 1 1 320px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.mb-cabeza__nombre {
  margin: 0;
  font-family: $fuente-titulo;
  font-size: 30px;
  font-weight: 400;
  letter-spacing: .5px;
}

.mb-cabeza__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  color: $texto-3;
  font-weight: 700;
  b { color: $texto; }
}

.mb-punto { color: $texto-4; }

.mb-veces { display: flex; gap: 8px; }

.mb-veces__b {
  width: 52px;
  height: 40px;
  border: 1px solid $borde-fuerte;
  border-radius: $radio-chico;
  background: $panel-alto;
  color: $texto-2;
  font-family: inherit;
  font-weight: 900;
  cursor: pointer;
  @include foco;

  &:hover { background: $lateral-hover; color: $texto; }
  &.is-activo { background: $azul; border-color: $azul; color: #fff; }
}

.mb-cabeza__acciones { display: flex; flex-wrap: wrap; gap: 10px; }

.mb-boton {
  min-height: 48px;
  padding: 0 20px;
  border: 1px solid $borde-fuerte;
  border-radius: $radio;
  background: $panel-alto;
  color: $texto;
  font-family: inherit;
  font-weight: 900;
  font-size: 15px;
  cursor: pointer;
  @include foco;

  &:hover:not(:disabled) { background: $lateral-hover; }
  &:disabled { opacity: .5; cursor: default; }

  &--primario {
    background: $azul;
    border-color: $azul;
    color: #fff;
    &:hover:not(:disabled) { background: $azul-medio; }
  }
}

.mb-boton__gratis { color: #06301d; }
.mb-boton--primario .mb-boton__gratis { color: #fff; }

.mb-cabeza__fair {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  color: $verde;
  font-weight: 800;
  font-size: 12px;
}

/* ── Los premios ──────────────────────────────────────────────────── */

.mb-premios {
  border: 1px solid $borde;
  border-radius: $radio-panel;
  background: $panel;
  overflow: hidden;
}

.mb-premios__titulo {
  margin: 0;
  padding: 16px 20px;
  border-bottom: 1px solid $borde;
  font-size: 15px;
  font-weight: 900;
}

.mb-premios__lista { margin: 0; padding: 0; list-style: none; }

.mb-premio {
  display: grid;
  grid-template-columns: 1fr auto 92px;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  border-bottom: 1px solid rgba(31, 51, 85, .6);
  border-left: 3px solid transparent;

  &:last-child { border-bottom: 0; }
  &:hover { background: $panel-hover; }

  @include en-celular {
    grid-template-columns: 1fr auto;
    row-gap: 4px;
  }
}

.mb-premio__nombre {
  font-weight: 700;
  @include en-celular { grid-column: 1 / -1; }
}

.mb-premio__valor {
  display: flex;
  align-items: center;
  gap: 5px;
  font-weight: 900;
}

.mb-premio__chance {
  text-align: right;
  color: $texto-3;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

/* ── El resultado ─────────────────────────────────────────────────── */

.mb-resultado {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(5, 9, 17, .78);
}

.mb-resultado__caja {
  width: 100%;
  max-width: 440px;
  max-height: 86vh;
  overflow-y: auto;
  padding: 24px;
  border: 1px solid $borde-fuerte;
  border-radius: $radio-panel;
  background: $panel;
  box-shadow: $sombra-tarjeta;
}

.mb-resultado__titulo {
  margin: 0 0 16px;
  text-align: center;
  font-family: $fuente-cartel;
  font-size: 26px;
  letter-spacing: 1px;
}

.mb-resultado__items {
  margin: 0 0 16px;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mb-ganado {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border: 2px solid;
  border-radius: $radio;
  background: $panel-alto;
}

.mb-ganado__nombre { font-weight: 800; }
.mb-ganado__valor { display: flex; align-items: center; gap: 5px; font-weight: 900; }

.mb-resultado__demo {
  margin: 0 0 16px;
  padding: 10px 12px;
  border-radius: $radio-chico;
  background: rgba(255, 211, 90, .12);
  color: $amarillo;
  font-size: 12px;
  font-weight: 700;
  text-align: center;
}

.mb-resultado__acciones {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  > * { flex: 1 1 140px; }
}

.mb-sc {
  display: inline-flex;
  flex: none;
  width: 18px;
  height: 18px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: linear-gradient($sc-verde-claro, $sc-verde);
  color: $sc-texto;
  font-weight: 900;
  font-size: 8px;
  line-height: 1;
}
</style>
