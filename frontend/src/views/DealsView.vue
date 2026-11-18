<template>
  <div class="mb-deals">
    <!-- ── El catálogo ──────────────────────────────────────────── -->
    <section class="mb-dlista" :aria-label="$t('deals.availableItems')">
      <h2>{{ $t('deals.availableItems') }}</h2>

      <label class="mb-dcampo">
        {{ $t('action.search') }}
        <input v-model="busqueda" type="search" :placeholder="$t('deals.searchItems')">
      </label>

      <div class="mb-dcampo-par">
        <label class="mb-dcampo">
          {{ $t('deals.priceMax') }}
          <input v-model="maximo" inputmode="decimal" :placeholder="$t('deals.any')">
        </label>
        <span class="mb-dcampo mb-dcampo--sel">
          {{ $t('deals.orderBy') }}
          <MbElegir v-model="orden" :opciones="ordenes" chico />
        </span>
      </div>

      <div class="mb-dgrilla">
        <button
          v-for="o in catalogo" :key="o._id" type="button"
          class="mb-dobj" :class="{ 'is-elegido': elegido && elegido._id === o._id }"
          :aria-pressed="elegido && elegido._id === o._id ? 'true' : 'false'"
          @click="elegir(o)"
        >
          <span class="mb-dobj__marco" :style="{ background: fondoDe(o.rarity) }">
            <span v-if="arte(o)" class="mb-dobj__foto" :class="arte(o).clase" :style="arte(o).estilo" aria-hidden="true"></span>
            <img v-else class="mb-dobj__foto" :src="o.imageUrl" alt="">
          </span>
          <span class="mb-dobj__nombre">{{ o.name }}</span>
          <span class="mb-dobj__valor">
            <span class="mb-sc mb-sc--14" aria-hidden="true">SC</span>{{ plata(o.valueSc) }}
          </span>
          <span class="mb-dobj__tilde" aria-hidden="true"></span>
        </button>

        <p v-if="!cargando && !catalogo.length" class="mb-dvacio">{{ $t('boxes.empty') }}</p>
      </div>

      <button
        v-if="hayMas" type="button" class="mb-dmas" :disabled="cargando"
        @click="traerCatalogo(pagina + 1)"
      >{{ cargando ? $t('common.loading') : $t('deals.showMore') }}</button>
    </section>

    <!-- ── La rueda y los controles ─────────────────────────────── -->
    <section class="mb-drueda" :aria-label="$t('nav.deals')">
      <mb-rueda-de-deal
        ref="rueda" :objeto="elegido" :chance="chance" :rapido="rapido"
      />

      <div class="mb-dbotones">
        <button
          type="button" class="mb-dgo" :disabled="!sePuede"
          @click="jugar(false)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff"
               stroke-width="3" aria-hidden="true"><circle cx="12" cy="12" r="8" /></svg>
          {{ $t('deals.dealFor') }}
          <span class="mb-sc mb-sc--18" aria-hidden="true">SC</span>{{ plata(apuesta) }}
        </button>
        <button type="button" class="mb-dgratis" :disabled="!sePuede" @click="jugar(true)">
          {{ $t('deals.freeTry') }}
        </button>
      </div>

      <div class="mb-dpanel">
        <div class="mb-dpanel__fila">
          <div class="mb-dcuantos" role="radiogroup" :aria-label="$t('deals.howManyDeals')">
            <button
              v-for="n in [1, 2, 3, 4]" :key="n" type="button" role="radio"
              :aria-checked="veces === n ? 'true' : 'false'"
              :class="{ 'is-activo': veces === n }" @click="veces = n"
            >{{ n }}</button>
          </div>

          <button
            type="button" role="switch" class="mb-dspeed"
            :aria-checked="rapido ? 'true' : 'false'" @click="rapido = !rapido"
          >
            {{ $t('deals.speedrun') }}
            <span class="mb-dspeed__riel" :class="{ 'is-on': rapido }" aria-hidden="true"><span></span></span>
          </button>
        </div>

        <label class="mb-dcampo">
          {{ $t('deals.price') }}
          <span class="mb-dprecio">
            <span class="mb-sc mb-sc--18" aria-hidden="true">SC</span>
            <input v-model="apuestaEscrita" inputmode="decimal" @change="desdeLaApuesta">
            <button type="button" @click="chanceEn(limites.max)">{{ $t('deals.max') }}</button>
          </span>
        </label>

        <div class="mb-dchance">
          <span class="mb-dchance__rot">{{ $t('common.chance') }}</span>
          <input
            type="range" :min="limites.min * 100" :max="limites.max * 100" step="0.5"
            :value="chance * 100" :aria-label="$t('deals.chanceToWin')"
            :disabled="!elegido" @input="chanceEn($event.target.value / 100)"
          >
          <div class="mb-dchance__pie">
            <span class="mb-dchance__num">{{ (chance * 100).toFixed(2) }}%</span>
            <button
              v-for="a in atajos" :key="a.rotulo" type="button"
              :class="{ 'is-activo': Math.abs(chance - a.valor) < 0.0001 }"
              @click="chanceEn(a.valor)"
            >{{ a.rotulo }}</button>
          </div>
        </div>

        <!-- El 92% no se esconde. Es el mismo de las cajas. -->
        <p class="mb-dnota">
          {{ $t('deals.returnNote', { pct: '92' }) }}
          <template v-if="elegido && limites.min > 0.01">
            {{ $t('deals.minStakeNote', { amount: plata(minimoSc), pct: (limites.min * 100).toFixed(2) }) }}
          </template>
        </p>
      </div>
    </section>
  </div>
</template>

<script>
import MbElegir from "@/components/MbElegir.vue";
import { mapGetters } from "vuex";
import api from "@/api";
import { sprite } from "@/utils/sprite";
import MbRuedaDeDeal from "@/components/MbRuedaDeDeal.vue";

const RETORNO = 0.92;

const FONDOS = {
  blue: "radial-gradient(circle at 50% 55%, #3f7cf055 0%, #16294a 72%)",
  purple: "radial-gradient(circle at 50% 55%, #8b4fe055 0%, #16294a 72%)",
  pink: "radial-gradient(circle at 50% 55%, #e0418f55 0%, #16294a 72%)",
  red: "radial-gradient(circle at 50% 55%, #e2424b55 0%, #16294a 72%)",
  gold: "radial-gradient(circle at 50% 55%, #f5b80a55 0%, #16294a 72%)",
};

/**
 * DEALS.
 *
 * El jugador elige UN objeto del catálogo y después elige cuánta chance
 * quiere de llevárselo. La rueda muestra la franja verde del tamaño de
 * esa chance y la aguja cae adentro o afuera.
 *
 * LA CUENTA SE HACE EN LOS DOS LADOS, Y ESO ES A PROPOSITO
 *
 * Acá, para que la barra se mueva sin esperar a nadie; y en el
 * servidor, que es el que cobra. Si alguna vez dieran distinto, manda
 * el servidor: lo que vuelve de `/deals/play` reemplaza lo de acá.
 *
 * Se repite la fórmula en vez de pedirle el precio al servidor en cada
 * movimiento de la barra porque son sesenta pedidos por segundo de
 * arrastre, y porque la fórmula es una línea que se puede leer.
 */
export default {
  name: "DealsView",
  components: { MbElegir, MbRuedaDeDeal },

  data() {
    return {
      catalogo: [],
      pagina: 1,
      paginas: 0,
      cargando: false,
      busqueda: "",
      maximo: "",
      orden: "desc",

      elegido: null,
      chance: 0.1,
      limites: { min: 0.01, max: 0.8 },
      minimoSc: 0.5,
      apuestaEscrita: "",

      veces: 1,
      rapido: false,
      jugando: false,

      reloj: null,
    };
  },

  computed: {
    ordenes() {
      return [
        { valor: "desc", texto: this.$t("boxes.sortExpensive") },
        { valor: "asc", texto: this.$t("boxes.sortCheap") },
      ];
    },

    ...mapGetters(["entro", "saldo"]),

    hayMas() { return this.pagina < this.paginas; },

    /** Lo que cuesta un tiro. La misma cuenta que hace el servidor. */
    apuesta() {
      if (!this.elegido) return 0;
      return Math.ceil(((this.elegido.valueSc * this.chance) / RETORNO) * 100) / 100;
    },

    sePuede() { return !!this.elegido && !this.jugando; },

    atajos() {
      return [
        { rotulo: this.$t("deals.min"), valor: this.limites.min },
        { rotulo: "10%", valor: 0.1 },
        { rotulo: "25%", valor: 0.25 },
        { rotulo: "50%", valor: 0.5 },
        { rotulo: this.$t("deals.max"), valor: this.limites.max },
      ].filter((a) => a.valor >= this.limites.min && a.valor <= this.limites.max);
    },
  },

  watch: {
    busqueda() { this.conRetraso(); },
    maximo() { this.conRetraso(); },
    orden() { this.traerCatalogo(1); },
    apuesta(v) { this.apuestaEscrita = v.toFixed(2); },
  },

  methods: {
    plata(n) {
      return Number(n || 0).toLocaleString("en-US", {
        minimumFractionDigits: 2, maximumFractionDigits: 2,
      });
    },

    arte(o) { return sprite(o.imageUrl); },
    fondoDe(rareza) { return FONDOS[rareza] || FONDOS.blue; },

    /* Escribir en el buscador no puede ser un pedido por tecla. */
    conRetraso() {
      window.clearTimeout(this.reloj);
      this.reloj = window.setTimeout(() => this.traerCatalogo(1), 320);
    },

    async traerCatalogo(pagina) {
      this.cargando = true;
      try {
        const { data } = await api.get("/deals/items", {
          params: {
            page: pagina,
            perPage: 30,
            q: this.busqueda || undefined,
            max: this.maximo || undefined,
            sort: this.orden,
          },
        });
        this.catalogo = pagina === 1 ? data.data.items : this.catalogo.concat(data.data.items);
        this.pagina = data.data.page;
        this.paginas = data.data.pages;
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      } finally {
        this.cargando = false;
      }
    },

    /**
     * Elegir un objeto.
     *
     * El piso de la chance lo pone el servidor, porque depende de la
     * apuesta mínima: con un objeto de SC 7,81 el 1% costaría nueve
     * centavos, y a esa escala el redondeo al centavo se comería cinco
     * puntos del retorno. Se pregunta, no se adivina.
     */
    async elegir(o) {
      this.elegido = o;
      if (this.$refs.rueda) this.$refs.rueda.limpiar();

      try {
        const { data } = await api.get("/deals/quote", {
          params: { itemId: o._id, chance: this.chance },
        });
        this.limites = { min: data.data.chanceMin, max: data.data.chanceMax };
        this.minimoSc = data.data.apuestaMinimaSc;
        this.chance = data.data.chance;
      } catch {
        /* Sin cotización se sigue con los límites de siempre: lo que
           cobra es el servidor, y si no alcanza lo va a decir él. */
        this.chance = Math.max(this.limites.min, Math.min(this.limites.max, this.chance));
      }
      this.apuestaEscrita = this.apuesta.toFixed(2);
    },

    chanceEn(valor) {
      const n = Number(valor);
      if (!Number.isFinite(n)) return;
      this.chance = Math.round(
        Math.max(this.limites.min, Math.min(this.limites.max, n)) * 10000
      ) / 10000;
      if (this.$refs.rueda) this.$refs.rueda.limpiar();
    },

    /** El camino de vuelta: el jugador escribe el precio. */
    desdeLaApuesta() {
      if (!this.elegido) return;
      const puesto = parseFloat(String(this.apuestaEscrita).replace(/,/g, ""));
      if (!Number.isFinite(puesto) || puesto <= 0) {
        this.apuestaEscrita = this.apuesta.toFixed(2);
        return;
      }
      this.chanceEn((puesto * RETORNO) / this.elegido.valueSc);
      this.apuestaEscrita = this.apuesta.toFixed(2);
    },

    async jugar(demo) {
      if (!this.sePuede) return;
      if (!demo && !this.entro) {
        this.$router.push({ path: "/signup", query: { next: "/deals" } });
        return;
      }

      this.jugando = true;
      try {
        const { data } = await api.post(demo ? "/deals/demo" : "/deals/play", {
          itemId: this.elegido._id,
          chance: this.chance,
          veces: this.veces,
        });
        const salida = data.data;

        /* El servidor manda: su chance y su precio reemplazan los de
           acá antes de dibujar nada. */
        this.chance = salida.chance;
        this.apuestaEscrita = salida.apuestaSc ? salida.apuestaSc.toFixed(2) : this.apuesta.toFixed(2);

        /* Los tiros se muestran de a uno, como en el diseño. */
        for (const tiro of salida.tiros) {
          await this.$refs.rueda.girar({ ...tiro, demo: salida.demo });
        }

        if (!salida.demo) {
          this.$store.commit("saldo", salida);
          const ganados = salida.tiros.filter((t) => t.gano).length;
          if (ganados) {
            this.$store.dispatch("avisar", {
              texto: this.$tc("deals.wonN", ganados, { n: ganados, amount: this.plata(salida.ganadoSc) }),
            });
          }
        }
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      } finally {
        this.jugando = false;
      }
    },
  },

  created() { this.traerCatalogo(1); },
  beforeDestroy() { window.clearTimeout(this.reloj); },
};
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

.mb-deals { display: flex; flex-wrap: wrap; gap: 20px; align-items: flex-start; }

/* ── El catálogo ──────────────────────────────────────────────────── */

.mb-dlista {
  flex: 1 1 340px;
  max-width: 520px;
  min-width: 0;
  order: -1;
  border-radius: 18px;
  background: $panel-alto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;

  h2 { margin: 0; font-weight: 900; font-size: 20px; }

  @include en-celular { max-width: none; order: 0; }
}

.mb-dcampo {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-weight: 900;
  font-size: 11px;
  letter-spacing: .1em;
  color: $texto-4;
  text-transform: uppercase;

  input, select {
    height: 44px;
    padding: 0 12px;
    border-radius: 10px;
    border: 1px solid #2a4170;
    background: $panel;
    color: #fff;
    font-family: inherit;
    font-size: 14px;
    letter-spacing: 0;
    &:focus { outline: none; border-color: $azul; }
  }

  &--sel {
    position: relative;
    select { padding-right: 30px; appearance: none; -webkit-appearance: none; font-weight: 700; cursor: pointer; }
    svg { position: absolute; right: 12px; bottom: 16px; pointer-events: none; }
  }
}

.mb-dcampo-par { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }

.mb-dgrilla {
  max-height: 620px;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 10px;
  padding: 2px;
  scrollbar-width: thin;
}

.mb-dobj {
  position: relative;
  min-width: 0;
  text-align: left;
  border-radius: 12px;
  border: 2px solid $borde;
  background: $panel;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: #fff;
  font-family: inherit;
  cursor: pointer;
  @include foco;

  &:hover { border-color: #3a5687; }
  &.is-elegido { border-color: $azul; }
}

.mb-dobj__marco {
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mb-dobj__foto { width: 88%; aspect-ratio: 1 / 1; object-fit: contain; }

.mb-dobj__nombre { font-weight: 900; font-size: 12px; line-height: 1.25; height: 30px; overflow: hidden; }

.mb-dobj__valor {
  align-self: flex-start;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 3px 7px;
  border-radius: 6px;
  background: $panel-hover;
  font-weight: 900;
  font-size: 12px;
}

.mb-dobj__tilde {
  position: absolute;
  right: 12px;
  top: 12px;
  width: 18px;
  height: 18px;
  border-radius: 5px;
  border: 2px solid #3a5687;
  background: transparent;

  .mb-dobj.is-elegido & { border-color: $azul; background: $azul; }
}

.mb-dvacio { grid-column: 1 / -1; margin: 20px 0; text-align: center; color: $texto-4; }

.mb-dmas {
  height: 42px;
  border-radius: 10px;
  border: 0;
  background: #1d3354;
  color: #fff;
  font-family: inherit;
  font-weight: 800;
  font-size: 14px;
  cursor: pointer;
  @include foco;
  &:disabled { opacity: .5; cursor: default; }
}

/* ── La rueda ─────────────────────────────────────────────────────── */

.mb-drueda {
  flex: 999 1 380px;
  min-width: 0;
  order: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
}

.mb-dbotones { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; }

.mb-dgo {
  height: 54px;
  padding: 0 26px;
  border-radius: 27px;
  border: 3px solid #fff;
  background: linear-gradient(180deg, #4fa2ff 0%, #2f6fe0 100%);
  color: #fff;
  font-family: inherit;
  font-weight: 900;
  font-size: 17px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  @include foco;

  &:hover:not(:disabled) { filter: brightness(1.07); }
  &:disabled { opacity: .5; cursor: default; }
}

.mb-dgratis {
  height: 54px;
  padding: 0 20px;
  border-radius: 27px;
  border: 2px solid #3a5687;
  background: $panel-alto;
  color: #fff;
  font-family: inherit;
  font-weight: 800;
  font-size: 15px;
  cursor: pointer;
  @include foco;
  &:disabled { opacity: .5; cursor: default; }
}

.mb-dpanel {
  width: min(560px, 100%);
  border-radius: 18px;
  background: $panel-alto;
  padding: 16px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.mb-dpanel__fila {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.mb-dcuantos {
  display: flex;
  gap: 2px;
  padding: 4px;
  border-radius: 12px;
  background: $panel;

  button {
    width: 40px;
    height: 36px;
    border-radius: 9px;
    border: 0;
    background: transparent;
    color: $texto-4;
    font-family: inherit;
    font-weight: 900;
    font-size: 14px;
    cursor: pointer;
    @include foco;
    &.is-activo { background: #24365e; color: #fff; }
  }
}

.mb-dspeed {
  height: 40px;
  padding: 0 12px;
  border-radius: 10px;
  border: 0;
  background: $panel;
  color: #fff;
  font-family: inherit;
  font-weight: 900;
  font-size: 12px;
  letter-spacing: .08em;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  @include foco;
}

.mb-dspeed__riel {
  position: relative;
  width: 36px;
  height: 20px;
  border-radius: 10px;
  background: #2a3d5e;
  transition: background .2s ease;

  span {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #fff;
    transition: left .2s ease;
  }

  &.is-on { background: #2fd47a; span { left: 19px; } }
}

.mb-dprecio {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 48px;
  padding: 0 6px 0 12px;
  border-radius: 12px;
  border: 1px solid #2a4170;
  background: $panel;

  input {
    flex: 1;
    min-width: 0;
    height: auto;
    padding: 0;
    border: 0;
    outline: none;
    background: transparent;
    color: #fff;
    font-family: inherit;
    font-weight: 900;
    font-size: 17px;
    letter-spacing: 0;
  }

  button {
    height: 34px;
    padding: 0 12px;
    border-radius: 8px;
    border: 0;
    background: #1d3354;
    color: #fff;
    font-family: inherit;
    font-weight: 800;
    font-size: 12px;
    letter-spacing: 0;
    cursor: pointer;
    @include foco;
  }
}

.mb-dchance { display: flex; flex-direction: column; gap: 8px; }

.mb-dchance__rot {
  font-weight: 900;
  font-size: 11px;
  letter-spacing: .1em;
  color: $texto-4;
  text-transform: uppercase;
}

.mb-dchance input[type="range"] { width: 100%; accent-color: #2fd47a; }

.mb-dchance__pie {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;

  button {
    height: 34px;
    padding: 0 10px;
    border-radius: 8px;
    border: 0;
    background: #1d3354;
    color: #fff;
    font-family: inherit;
    font-weight: 800;
    font-size: 12px;
    cursor: pointer;
    @include foco;
    &.is-activo { background: $azul; }
  }
}

.mb-dchance__num { flex: 1; min-width: 70px; font-weight: 900; font-size: 22px; color: #2fd47a; }

.mb-dnota { margin: 0; font-size: 12px; line-height: 1.5; color: $texto-4; }
</style>
