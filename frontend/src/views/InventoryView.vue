<template>
  <div class="mb-inv">
    <h1 class="mb-inv__titulo">{{ $t('inventory.title') }}</h1>

    <div class="mb-inv__cols">
      <!-- ── La grilla ────────────────────────────────────────────── -->
      <div class="mb-inv__izq">
        <div class="mb-inv__barra">
          <label class="mb-buscar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8ea3c7"
                 stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
            </svg>
            <span class="mb-oculto">{{ $t('action.search') }}</span>
            <input v-model="busqueda" type="search" :placeholder="$t('inventory.searchItems')">
          </label>

          <label class="mb-sel">
            <span class="mb-oculto">{{ $t('boxes.sort') }}</span>
            <select v-model="orden">
              <option value="nuevo">{{ $t('boxes.sortNew') }}</option>
              <option value="caro">{{ $t('inventory.highestValue') }}</option>
              <option value="barato">{{ $t('boxes.sortCheap') }}</option>
            </select>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8ea3c7"
                 stroke-width="2.6" stroke-linecap="round" aria-hidden="true">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </label>

          <div class="mb-inv__pestanas">
            <span class="mb-pestana is-activa">
              <span>{{ $t('wallet.items') }}</span>
              <span class="mb-pestana__n">{{ resumen.cuantos }}</span>
            </span>
            <span class="mb-pestana">
              <span>{{ $t('nav.boxes') }}</span>
              <span class="mb-pestana__n">{{ aperturasGratis }}</span>
            </span>
          </div>
        </div>

        <p v-if="cargando" class="mb-vacio">{{ $t('common.loading') }}</p>

        <!-- El vacío del diseño: arte, explicación y un botón que
             lleva a abrir una caja. Un vacío que no ofrece salida es
             una pantalla muerta. -->
        <div v-else-if="!visibles.length" class="mb-nada">
          <div class="mb-art mb-nada__arte" :style="arteVacio" aria-hidden="true"></div>
          <span class="mb-nada__titulo">{{ $t('inventory.emptyTitle') }}</span>
          <span class="mb-nada__sub">{{ $t('inventory.emptySub') }}</span>
          <router-link to="/boxes" class="mb-nada__b">{{ $t('inventory.openABox') }}</router-link>
        </div>

        <div v-else class="mb-inv__grilla">
          <button
            v-for="o in visibles" :key="o._id" type="button"
            class="mb-obj" :aria-pressed="elegidos.includes(o._id) ? 'true' : 'false'"
            :style="estiloObjeto(o)"
            @click="alternar(o._id)"
          >
            <span v-if="spr(o)" class="mb-prod mb-obj__foto" :style="spr(o)" aria-hidden="true"></span>
            <span class="mb-obj__nombre">{{ o.name }}</span>
            <span class="mb-obj__valor">
              <span class="mb-sc mb-sc--16" aria-hidden="true">SC</span>{{ plata(o.valueSc) }}
            </span>
          </button>
        </div>
      </div>

      <!-- ── El panel de la derecha ───────────────────────────────── -->
      <aside class="mb-invside">
        <div class="mb-panelito">
          <div class="mb-panelito__cifras">
            <div class="mb-cifra">
              <span class="mb-cifra__rot">{{ $t('inventory.portfolio') }}</span>
              <span class="mb-cifra__val">
                <span class="mb-sc mb-sc--18" aria-hidden="true">SC</span>{{ plata(resumen.valorSc) }}
              </span>
            </div>
            <div class="mb-cifra mb-cifra--der">
              <span class="mb-cifra__rot">{{ $t('wallet.items') }}</span>
              <span class="mb-cifra__val">{{ resumen.cuantos }}</span>
            </div>
          </div>

          <div class="mb-panelito__acciones">
            <button
              type="button" class="mb-azul" :disabled="!elegidos.length || vendiendo"
              @click="venderElegidos"
            >
              {{ elegidos.length
                ? $t('inventory.sellN', { n: elegidos.length, amount: 'SC ' + plata(totalElegido) })
                : $t('inventory.sellSelected') }}
            </button>

            <div class="mb-panelito__fila">
              <button type="button" class="mb-chico" @click="elegirTodo">
                {{ todoElegido ? $t('inventory.clear') : $t('inventory.selectAll') }}
              </button>
              <button
                type="button" class="mb-chico"
                :disabled="!elegidos.length" @click="pedirEnvio"
              >{{ $t('action.ship') }}</button>
            </div>
          </div>
        </div>

        <!-- Por qué no se puede enviar algo de lo elegido. -->
        <div v-if="trabas.length" class="mb-trabas">
          <p v-for="(t, i) in trabas" :key="i" class="mb-trabas__linea">{{ t }}</p>
        </div>
      </aside>
    </div>
  </div>
</template>

<script>
import { mapGetters } from "vuex";
import api from "@/api";
import { sprite } from "@/utils/sprite";

const COLORES = {
  blue: "#3f7cf0", purple: "#8b4fe0", pink: "#e0418f", red: "#e2424b", gold: "#f5b80a",
};

/**
 * EL INVENTARIO.
 *
 * Portado del prototipo: la grilla con el resplandor del color de la
 * rareza detras de cada objeto, el buscador y el orden, el panel de la
 * derecha con el valor de la cartera, y el vacio con su arte.
 *
 * SE ELIGE Y SE VENDE DE A MUCHOS
 *
 * Despues de abrir veinte cajas uno queda con un monton de cosas de
 * SC 1, y venderlas de a una es insoportable. Por eso cada objeto es un
 * boton que se marca, y el panel vende todo lo marcado junto.
 *
 * EL FILTRO ES LOCAL
 *
 * Buscar y ordenar se hacen sobre lo que ya se bajo. El inventario de
 * alguien entra comodo en una pantalla y pedirle al servidor en cada
 * tecla seria castigarlo sin motivo.
 */
export default {
  name: "InventoryView",

  data() {
    return {
      items: [],
      resumen: { cuantos: 0, valorSc: 0 },
      cargando: true,
      vendiendo: false,
      elegidos: [],
      busqueda: "",
      orden: "nuevo",
    };
  },

  computed: {
    ...mapGetters(["aperturasGratis"]),

    visibles() {
      const q = this.busqueda.trim().toLowerCase();
      const lista = q ? this.items.filter((o) => o.name.toLowerCase().includes(q)) : [...this.items];
      const ORDEN = {
        caro: (a, b) => b.valueSc - a.valueSc,
        barato: (a, b) => a.valueSc - b.valueSc,
        nuevo: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
      };
      return lista.sort(ORDEN[this.orden] || ORDEN.nuevo);
    },

    totalElegido() {
      return Math.round(
        this.items.filter((o) => this.elegidos.includes(o._id))
          .reduce((a, o) => a + o.seVendePorSc, 0) * 100
      ) / 100;
    },

    todoElegido() {
      return this.visibles.length > 0 && this.elegidos.length === this.visibles.length;
    },

    /** El arte del vacío: una caja cualquiera, para que no sea un hueco. */
    arteVacio() {
      return { backgroundPosition: "0% 0%" };
    },

    /** Los motivos por los que algo de lo elegido no se puede enviar. */
    trabas() {
      const claves = {
        ITEM_NOT_SHIPPABLE: "inventory.notShippable",
        NECESITA_NIVEL_2: "inventory.needLevel2",
        NECESITA_NIVEL_3: "inventory.needLevel3",
      };
      const vistos = new Set();
      for (const o of this.items) {
        if (this.elegidos.includes(o._id) && o.porQueNoSeEnvia) vistos.add(o.porQueNoSeEnvia);
      }
      return [...vistos].map((k) => this.$t(claves[k] || "inventory.notShippable"));
    },
  },

  methods: {
    plata(n) {
      return Number(n || 0).toLocaleString("en-US", {
        minimumFractionDigits: 2, maximumFractionDigits: 2,
      });
    },
    spr(o) {
      const s = sprite(o.imageUrl);
      return s ? s.estilo : null;
    },

    /* El resplandor y el borde salen de la rareza, como el diseño. */
    estiloObjeto(o) {
      const c = COLORES[o.rarity] || COLORES.blue;
      const elegido = this.elegidos.includes(o._id);
      return {
        borderColor: elegido ? "#fff" : c + "66",
        background: `radial-gradient(circle at 50% 36%, ${c}3d 0%, #142645 62%)`,
        boxShadow: `inset 0 -3px 0 ${c}`,
      };
    },

    alternar(id) {
      const i = this.elegidos.indexOf(id);
      if (i === -1) this.elegidos.push(id);
      else this.elegidos.splice(i, 1);
    },

    elegirTodo() {
      this.elegidos = this.todoElegido ? [] : this.visibles.map((o) => o._id);
    },

    pedirEnvio() {
      this.$store.dispatch("avisar", { texto: this.$t("inventory.shipSoon") });
    },

    async traer() {
      this.cargando = true;
      try {
        const { data } = await api.get("/inventory", { params: { perPage: 100 } });
        this.items = data.data.items;
        this.resumen = data.data.resumen;
        const vivos = new Set(this.items.map((o) => o._id));
        this.elegidos = this.elegidos.filter((id) => vivos.has(id));
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      } finally {
        this.cargando = false;
      }
    },

    async venderElegidos() {
      if (!this.elegidos.length) return;
      this.vendiendo = true;
      try {
        const { data } = await api.post("/inventory/sell-many", { ids: this.elegidos });
        this.$store.commit("saldo", data.data);
        this.$store.dispatch("avisar", {
          texto: this.$t("inventory.sold", { n: data.data.vendidos, amount: "SC " + this.plata(data.data.totalSc) }),
        });
        this.elegidos = [];
        await this.traer();
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      } finally {
        this.vendiendo = false;
      }
    },
  },

  created() { this.traer(); },
};
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

.mb-inv { display: flex; flex-direction: column; gap: 16px; }

.mb-inv__titulo {
  margin: 0;
  font-weight: 900;
  font-size: clamp(26px, 3.6vw, 34px);
}

.mb-inv__cols { display: flex; flex-wrap: wrap; gap: 18px; align-items: flex-start; }
.mb-inv__izq { flex: 999 1 460px; min-width: 0; display: flex; flex-direction: column; gap: 18px; }

.mb-inv__barra {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 14px;
  border-radius: 18px;
  background: #12213a;
}

.mb-buscar {
  flex: 1 1 220px;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 46px;
  padding: 0 14px;
  border-radius: 12px;
  border: 1px solid #2a4170;
  background: #0e1a2e;

  input {
    flex: 1;
    min-width: 0;
    border: 0;
    outline: none;
    background: transparent;
    color: #fff;
    font-family: inherit;
    font-size: 14px;
    &::placeholder { color: #6f84ab; }
  }
}

.mb-sel {
  position: relative;
  display: flex;
  align-items: center;
  height: 46px;
  border-radius: 12px;
  border: 1px solid #2a4170;
  background: #0e1a2e;

  select {
    height: 100%;
    padding: 0 34px 0 14px;
    border: 0;
    background: transparent;
    color: #fff;
    font-family: inherit;
    font-weight: 800;
    font-size: 14px;
    appearance: none;
    -webkit-appearance: none;
    cursor: pointer;
    @include foco;
  }

  svg { position: absolute; right: 12px; pointer-events: none; }
}

.mb-inv__pestanas {
  flex: 1 1 300px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.mb-pestana {
  position: relative;
  overflow: hidden;
  height: 50px;
  border-radius: 12px;
  border: 1px solid #2a4170;
  background: #13285a;
  padding: 6px 10px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: center;
  color: $texto-2;

  &.is-activa { border: 2px solid #fff; background: #173468; color: #fff; }
  span { font-weight: 900; font-size: 15px; }
}

.mb-pestana__n { font-size: 12px !important; opacity: .75; }

/* ── La grilla ────────────────────────────────────────────────────── */

.mb-inv__grilla {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(46%, 150px), 1fr));
  gap: 12px;
}

.mb-obj {
  min-width: 0;
  text-align: left;
  border-radius: 14px;
  border: 2px solid;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  color: #fff;
  font-family: inherit;
  cursor: pointer;
  @include foco;

  &:hover { transform: translateY(-2px); }
}

.mb-obj__foto { width: 100%; aspect-ratio: 1 / 1; }

.mb-obj__nombre {
  font-weight: 800;
  font-size: 12px;
  line-height: 1.2;
  height: 29px;
  overflow: hidden;
}

.mb-obj__valor {
  font-weight: 900;
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}

/* ── El vacío ─────────────────────────────────────────────────────── */

.mb-nada {
  padding: 30px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  text-align: center;
}

.mb-nada__arte { width: 180px; height: 180px; }
.mb-nada__titulo { font-weight: 900; font-size: 22px; }
.mb-nada__sub { font-size: 15px; color: $texto-4; }

.mb-nada__b {
  margin-top: 10px;
  height: 52px;
  padding: 0 40px;
  border-radius: 26px;
  border: 3px solid #fff;
  background: linear-gradient(180deg, #3fa9ff 0%, #2f6fe0 100%);
  color: #fff;
  font-weight: 900;
  font-size: 16px;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  @include foco;
  &:hover { color: #fff; filter: brightness(1.06); }
}

/* ── El panel ─────────────────────────────────────────────────────── */

.mb-invside {
  flex: 1 1 300px;
  max-width: 380px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  @include en-celular { max-width: none; order: -1; }
}

.mb-panelito {
  border-radius: 18px;
  background: #12213a;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.mb-panelito__cifras { display: flex; gap: 24px; }

.mb-cifra {
  display: flex;
  flex-direction: column;
  gap: 2px;
  &--der { padding-left: 20px; border-left: 1px solid $borde; }
}

.mb-cifra__rot { font-weight: 900; font-size: 11px; letter-spacing: .1em; color: $texto-4; }
.mb-cifra__val { display: flex; align-items: center; gap: 6px; font-weight: 900; font-size: 20px; }

.mb-panelito__acciones { display: flex; flex-direction: column; gap: 8px; }
.mb-panelito__fila { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }

.mb-azul {
  height: 50px;
  border-radius: 25px;
  border: 3px solid #fff;
  background: linear-gradient(180deg, #5b9bff 0%, #2f6fe0 100%);
  color: #fff;
  font-family: $fuente-cartel;
  font-size: 17px;
  cursor: pointer;
  box-shadow: 0 4px 0 #1c4fc4;
  @include foco;
  &:hover:not(:disabled) { filter: brightness(1.07); }
  &:disabled { opacity: .45; cursor: default; }
}

.mb-chico {
  height: 42px;
  border-radius: 12px;
  border: 1px solid #2a4170;
  background: #16253f;
  color: #fff;
  font-family: inherit;
  font-weight: 800;
  font-size: 13px;
  cursor: pointer;
  @include foco;
  &:hover:not(:disabled) { background: #1d3354; }
  &:disabled { opacity: .45; cursor: default; }
}

.mb-trabas {
  padding: 14px 16px;
  border-radius: 14px;
  border: 1px solid rgba(255, 211, 90, .35);
  background: rgba(255, 211, 90, .08);
}

.mb-trabas__linea { margin: 0 0 6px; color: $amarillo; font-size: 13px; font-weight: 700; &:last-child { margin: 0; } }

.mb-vacio { margin: 30px 0; text-align: center; color: $texto-4; }

.mb-oculto { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
</style>
