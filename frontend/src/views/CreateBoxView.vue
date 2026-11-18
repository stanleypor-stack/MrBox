<template>
  <div class="mb-crear">
    <h1>{{ $t('nav.createBox') }}</h1>

    <!-- ── 1. La caja ───────────────────────────────────────────── -->
    <div class="mb-paso"><span>1</span>{{ $t('create.step1') }}</div>

    <div class="mb-crear__arriba">
      <!-- La vista previa, que es la caja de verdad. -->
      <div class="mb-vista">
        <div class="mb-vista__tarjeta">
          <mb-caja-dibujada
            :color="color" :estilo="estilo" :portada="asoman"
            :posiciones="posiciones" :logo-izquierdo="logoIzq" :logo-derecho="logoDer"
            arrastrable @mover="mover"
          />
          <span class="mb-vista__nombre">{{ nombre || $t('create.namePlaceholder') }}</span>
          <span class="mb-vista__cat">{{ $t('nav.community') }}</span>
          <span class="mb-vista__precio">
            <span class="mb-sc mb-sc--18" aria-hidden="true">SC</span>{{ plata(precio) }}
          </span>
        </div>
        <span class="mb-vista__ayuda">{{ $tc('create.coverCount', asoman.length, { n: asoman.length }) }}</span>
        <button type="button" class="mb-mini" @click="posiciones = {}">{{ $t('create.resetPositions') }}</button>
      </div>

      <div class="mb-crear__campos">
        <label class="mb-campo">
          <span>{{ $t('create.name') }}</span>
          <span class="mb-campo__caja">
            <input v-model="nombre" maxlength="18" :placeholder="$t('create.namePlaceholder')">
            <span class="mb-campo__cuenta">{{ nombre.length }}/18</span>
          </span>
        </label>

        <label class="mb-campo">
          <span>{{ $t('create.description') }} <em>{{ $t('create.optional') }}</em></span>
          <span class="mb-campo__caja">
            <textarea v-model="descripcion" maxlength="240" :placeholder="$t('create.descPlaceholder')"></textarea>
            <span class="mb-campo__cuenta mb-campo__cuenta--abajo">{{ descripcion.length }}/240</span>
          </span>
        </label>

        <div class="mb-crear__dos">
          <div class="mb-crear__col">
            <span class="mb-rotulo">{{ $t('create.boxColour') }}</span>
            <div class="mb-colores">
              <button
                v-for="c in COLORES" :key="c" type="button"
                :aria-label="$t('create.colourAria', { c })" :aria-pressed="color === c ? 'true' : 'false'"
                :style="{ background: c, borderColor: color === c ? '#ffffff' : 'transparent' }"
                @click="color = c"
              ></button>
            </div>
          </div>

          <div class="mb-crear__col">
            <span class="mb-rotulo">{{ $t('create.boxStyle') }}</span>
            <div class="mb-estilos">
              <button
                v-for="(e, i) in ESTILOS" :key="e" type="button"
                :aria-pressed="estilo === i ? 'true' : 'false'"
                :class="{ 'is-activo': estilo === i }" @click="estilo = i; posiciones = {}"
              >{{ $t('create.style.' + e) }}</button>
            </div>
            <span class="mb-ayuda">{{ $t('create.styleHelp.' + ESTILOS[estilo]) }}</span>
          </div>
        </div>

        <div class="mb-crear__col">
          <span class="mb-rotulo">{{ $t('create.logos') }} <em>{{ $t('create.optional') }}</em></span>
          <div class="mb-logos">
            <div v-for="lado in ['izq', 'der']" :key="lado" class="mb-logo">
              <span class="mb-logo__caja">
                <img v-if="lado === 'izq' ? logoIzq : logoDer" :src="lado === 'izq' ? logoIzq : logoDer" alt="">
                <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5d7096"
                     stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="16" rx="2" /><path d="m4 16 5-5 4 4 3-3 4 4" />
                </svg>
              </span>
              <span class="mb-logo__texto">
                <span>{{ $t(lado === 'izq' ? 'create.leftSide' : 'create.rightSide') }}</span>
                <label class="mb-logo__subir">
                  {{ $t('create.upload') }}
                  <input type="file" accept="image/png,image/jpeg,image/webp" @change="subirLogo($event, lado)">
                </label>
              </span>
            </div>
          </div>
          <span class="mb-ayuda">{{ $t('create.logoHelp') }}</span>
        </div>

        <div class="mb-crear__col">
          <span class="mb-rotulo">{{ $t('create.whatYouEarn') }}</span>
          <p class="mb-gana" v-html="$t('create.earnText')"></p>
        </div>
      </div>
    </div>

    <!-- ── 2. Los objetos ───────────────────────────────────────── -->
    <div class="mb-crear__abajo">
      <section class="mb-catalogo">
        <div class="mb-paso"><span>2</span>{{ $t('create.step2') }}</div>

        <div class="mb-catalogo__filtros">
          <label class="mb-buscar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8ea3c7"
                 stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
            </svg>
            <input v-model="busqueda" type="search" :placeholder="$t('create.searchCatalogue')">
          </label>

          <span class="mb-rango">
            <input v-model="minimo" inputmode="decimal" :aria-label="$t('create.minValue')" :placeholder="$t('deals.min')">
            <span>–</span>
            <input v-model="maximo" inputmode="decimal" :aria-label="$t('create.maxValue')" :placeholder="$t('deals.max')">
          </span>

          <label class="mb-orden">
            <span class="mb-oculto">{{ $t('boxes.sort') }}</span>
            <select v-model="orden">
              <option value="desc">{{ $t('boxes.sortExpensive') }}</option>
              <option value="asc">{{ $t('boxes.sortCheap') }}</option>
            </select>
          </label>
        </div>

        <span class="mb-ayuda">{{ $t('create.catCount', { n: total }) }}</span>

        <div class="mb-catalogo__grilla">
          <button
            v-for="o in catalogo" :key="o._id" type="button"
            class="mb-cobj" :class="{ 'is-elegido': !!elegidos[o._id] }"
            :aria-pressed="elegidos[o._id] ? 'true' : 'false'" @click="alternar(o)"
          >
            <span class="mb-cobj__marco" :style="{ background: fondoDe(o.rarity) }">
              <span v-if="arte(o)" class="mb-cobj__foto" :class="arte(o).clase" :style="arte(o).estilo" aria-hidden="true"></span>
              <img v-else class="mb-cobj__foto" :src="o.imageUrl" alt="">
            </span>
            <span class="mb-cobj__nombre">{{ o.name }}</span>
            <span class="mb-cobj__valor">
              <span class="mb-sc mb-sc--14" aria-hidden="true">SC</span>{{ plata(o.valueSc) }}
            </span>
            <span class="mb-cobj__punto" :class="{ 'is-elegido': !!elegidos[o._id] }" aria-hidden="true">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"
                   stroke-linecap="round" stroke-linejoin="round">
                <path :d="elegidos[o._id] ? 'M20 6 9 17l-5-5' : 'M12 5v14M5 12h14'" />
              </svg>
            </span>
          </button>
        </div>

        <button
          v-if="pagina < paginas" type="button" class="mb-com__mas"
          :disabled="cargando" @click="traerCatalogo(pagina + 1)"
        >{{ cargando ? $t('common.loading') : $t('create.showMoreItems') }}</button>
      </section>

      <!-- ── 3. Las chances ─────────────────────────────────────── -->
      <section class="mb-odds">
        <div class="mb-paso">
          <span>3</span>{{ $t('create.step3') }}
          <span class="mb-odds__cuantos">{{ lista.length }}/{{ MAXIMO }}</span>
        </div>

        <p class="mb-ayuda">{{ $t('create.oddsHelp', { min: MINIMO }) }}</p>

        <p v-if="!lista.length" class="mb-odds__vacio">{{ $t('create.noItemsYet') }}</p>

        <div class="mb-odds__lista">
          <div v-for="o in lista" :key="o._id" class="mb-odd">
            <span v-if="arte(o)" class="mb-odd__foto" :class="arte(o).clase" :style="arte(o).estilo" aria-hidden="true"></span>
            <span class="mb-odd__texto">
              <span class="mb-odd__nombre">{{ o.name }}</span>
              <span class="mb-odd__datos">
                <span class="mb-sc mb-sc--13" aria-hidden="true">SC</span>{{ plata(o.valueSc) }}
                · {{ $t('create.payout', { amount: plata(o.valueSc * (chances[String(o._id)] || 0)) }) }}
              </span>
            </span>
            <span class="mb-odd__pct">
              <input
                :value="pctDe(o)" inputmode="decimal"
                :aria-label="$t('create.chanceFor', { name: o.name })"
                @change="ponerChance(o, $event.target.value)"
              >
              <span aria-hidden="true">%</span>
            </span>
            <button type="button" class="mb-odd__sacar" :aria-label="$t('create.remove', { name: o.name })" @click="sacar(o)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8ea3c7"
                   stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </div>
        </div>

        <div class="mb-precio">
          <span class="mb-rotulo">{{ $t('create.boxPrice') }}</span>
          <span class="mb-precio__num">
            <span class="mb-sc mb-sc--26" aria-hidden="true">SC</span>{{ plata(precio) }}
          </span>
          <span class="mb-ayuda">{{ $t('create.priceNote') }}</span>
        </div>

        <p v-for="(e, i) in errores" :key="i" class="mb-error">{{ e }}</p>

        <button
          v-if="entro" type="button" class="mb-publicar" :disabled="!sePuedeGuardar || guardando"
          @click="publicar"
        >{{ guardando ? $t('common.loading') : $t('create.publish') }}</button>
        <router-link v-else to="/signup" class="mb-publicar">{{ $t('create.signUpToPublish') }}</router-link>

        <span class="mb-ayuda">{{ $t('create.reviewNote') }}</span>
      </section>
    </div>
  </div>
</template>

<script>
import { mapGetters } from "vuex";
import api from "@/api";
import { sprite } from "@/utils/sprite";
import MbCajaDibujada from "@/components/MbCajaDibujada.vue";

const COLORES = [
  "#9b30ff", "#ffc21a", "#7be22b", "#ff6a3d", "#3fa9ff", "#e83b4f",
  "#ff4fa3", "#16c79a", "#ff9a1a", "#8e9bb3", "#2f6fe0",
];

const ESTILOS = ["hero", "trio", "spread"];

const FONDOS = {
  blue: "radial-gradient(circle at 50% 55%, #3f7cf055 0%, #12213a 75%)",
  purple: "radial-gradient(circle at 50% 55%, #8b4fe055 0%, #12213a 75%)",
  pink: "radial-gradient(circle at 50% 55%, #e0418f55 0%, #12213a 75%)",
  red: "radial-gradient(circle at 50% 55%, #e2424b55 0%, #12213a 75%)",
  gold: "radial-gradient(circle at 50% 55%, #f5b80a55 0%, #12213a 75%)",
};

const MINIMO = 5;
const MAXIMO = 20;

/**
 * ARMAR UNA CAJA.
 *
 * Tres pasos: cómo se ve, qué tiene adentro y cada cuánto sale cada
 * cosa.
 *
 * EL PRECIO NO SE ESCRIBE, SE CALCULA
 *
 * Sale de lo que puso adentro, igual que en una caja de la casa. Si se
 * pudiera elegir, cualquiera pondría un iPhone al 50% y la caja a
 * SC 10. El creador decide QUE hay y CADA CUANTO sale; cuánto cuesta es
 * una consecuencia.
 *
 * EL PRECIO LO DICE EL SERVIDOR
 *
 * Se pide en cada cambio. Podría calcularse acá --la fórmula son dos
 * líneas-- pero entonces habría dos lugares donde vive la regla del
 * 92%, y el día que cambie uno, el creador vería un precio y le
 * cobrarían otro.
 */
export default {
  name: "CreateBoxView",
  components: { MbCajaDibujada },

  data() {
    return {
      COLORES,
      ESTILOS,
      MINIMO,
      MAXIMO,

      nombre: "",
      descripcion: "",
      color: "#9b30ff",
      estilo: 2,
      posiciones: {},
      logoIzq: "",
      logoDer: "",

      catalogo: [],
      total: 0,
      pagina: 1,
      paginas: 0,
      cargando: true,
      busqueda: "",
      minimo: "",
      maximo: "",
      orden: "desc",

      /* Lo elegido, por id, con su peso. */
      elegidos: {},
      orden_: [],

      precio: 0,
      chances: {},
      errores: [],
      guardando: false,
      reloj: null,
    };
  },

  computed: {
    ...mapGetters(["entro"]),

    /** Lo elegido, en el orden en que lo fue eligiendo. */
    lista() { return this.orden_.map((id) => this.elegidos[id]).filter(Boolean); },

    /** Los tres que asoman de la caja: los más caros de los elegidos. */
    asoman() {
      return this.lista
        .slice()
        .sort((a, b) => b.valueSc - a.valueSc)
        .slice(0, 3)
        .map((o) => ({ clave: String(o._id), imageUrl: o.imageUrl }));
    },

    sePuedeGuardar() {
      return this.nombre.trim().length >= 3
        && this.lista.length >= MINIMO
        && this.lista.length <= MAXIMO
        && !this.errores.length;
    },
  },

  watch: {
    busqueda() { this.conRetraso(); },
    minimo() { this.conRetraso(); },
    maximo() { this.conRetraso(); },
    orden() { this.traerCatalogo(1); },
    lista() { this.cotizar(); },
  },

  methods: {
    plata(n) {
      return Number(n || 0).toLocaleString("en-US", {
        minimumFractionDigits: 2, maximumFractionDigits: 2,
      });
    },

    arte(o) { return sprite(o.imageUrl); },
    fondoDe(r) { return FONDOS[r] || FONDOS.blue; },

    /** La chance de un objeto, como numero para el campo. */
    pctDe(o) {
      const c = this.chances[String(o._id)];
      if (c == null) return "";
      const pct = c * 100;
      /* Cuatro decimales abajo del 0,1%: un premio de SC 300.000 vive
         en 0,0002% y con dos decimales se ve como un cero. */
      return pct < 0.1 ? pct.toFixed(4) : pct.toFixed(2);
    },

    /**
     * PONER UNA CHANCE A MANO.
     *
     * El jugador escribe "0,05%" para el auto y el resto se reparte lo
     * que queda, manteniendo las proporciones entre ellos.
     *
     * Por dentro se siguen guardando PESOS --que es lo que no se
     * desarma al agregar o sacar un objeto-- pero nadie piensa en
     * pesos. Piensa en "una de cada dos mil".
     */
    ponerChance(o, valor) {
      const pct = Number(String(valor).replace(",", ".")) / 100;
      const id = String(o._id);

      /* Entre un diezmilesimo de punto y el 99%: al 100% no hay caja,
         hay una compra. */
      if (!Number.isFinite(pct) || pct <= 0 || pct >= 0.99) {
        this.$forceUpdate();
        return;
      }

      const otros = this.lista.filter((x) => String(x._id) !== id);
      const sumaOtros = otros.reduce((a, x) => a + x.peso, 0);
      if (!otros.length || sumaOtros <= 0) return;

      /* peso / (peso + resto) = pct  →  peso = pct × resto / (1 − pct) */
      const peso = (pct * sumaOtros) / (1 - pct);
      this.$set(this.elegidos, id, {
        ...this.elegidos[id],
        peso: Math.max(0.0001, Math.min(1e6, Math.round(peso * 10000) / 10000)),
      });
      this.cotizar();
    },

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
        /* El mínimo lo filtra la pantalla: el catálogo del servidor ya
           tiene bastantes parámetros y este es solo para mirar. */
        const piso = parseFloat(this.minimo);
        const items = Number.isFinite(piso)
          ? data.data.items.filter((o) => o.valueSc >= piso)
          : data.data.items;

        this.catalogo = pagina === 1 ? items : this.catalogo.concat(items);
        this.pagina = data.data.page;
        this.paginas = data.data.pages;
        this.total = data.data.total;
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      } finally {
        this.cargando = false;
      }
    },

    alternar(o) {
      const id = String(o._id);
      if (this.elegidos[id]) return this.sacar(o);
      if (this.lista.length >= MAXIMO) {
        return this.$store.dispatch("avisar", {
          texto: this.$t("create.tooMany", { max: MAXIMO }), tono: "error",
        });
      }
      /* El peso arranca en 1 para todos: así la primera cotización ya
         dice algo, y de ahí el creador lo mueve. */
      this.$set(this.elegidos, id, { ...o, peso: 1 });
      this.orden_.push(id);
      return undefined;
    },

    sacar(o) {
      const id = String(o._id);
      this.$delete(this.elegidos, id);
      this.orden_ = this.orden_.filter((x) => x !== id);
    },

    mover({ clave, posicion }) { this.$set(this.posiciones, clave, posicion); },

    async subirLogo(e, lado) {
      const archivo = e.target.files && e.target.files[0];
      if (!archivo) return;

      if (archivo.size > 2 * 1024 * 1024) {
        this.$store.dispatch("avisar", { texto: this.$t("create.logoTooBig"), tono: "error" });
        e.target.value = "";
        return;
      }

      const leido = await new Promise((listo) => {
        const lector = new FileReader();
        lector.onload = () => listo(String(lector.result || ""));
        lector.onerror = () => listo("");
        lector.readAsDataURL(archivo);
      });

      if (lado === "izq") this.logoIzq = leido; else this.logoDer = leido;
      e.target.value = "";
    },

    /** El precio y las chances, calculados por el servidor. */
    async cotizar() {
      if (this.lista.length < MINIMO) {
        this.precio = 0;
        this.chances = {};
        this.errores = [];
        return;
      }
      try {
        const { data } = await api.post("/community/quote", {
          premios: this.lista.map((o) => ({ itemId: o._id, peso: o.peso })),
        });
        this.precio = data.data.priceSc;
        this.errores = data.data.errores || [];
        const mapa = {};
        for (const p of data.data.premios) mapa[String(p.item)] = p.chance;
        this.chances = mapa;
      } catch (err) {
        this.errores = [err.textoParaElJugador];
      }
    },

    async publicar() {
      this.guardando = true;
      try {
        const cuerpo = {
          name: this.nombre.trim(),
          description: this.descripcion.trim(),
          premios: this.lista.map((o) => ({ itemId: o._id, peso: o.peso })),
          portada: {
            color: this.color,
            estilo: this.estilo,
            /* Los que asoman, por su posición en la lista de premios. */
            asoman: this.asoman
              .map((a) => this.lista.findIndex((o) => String(o._id) === a.clave))
              .filter((i) => i >= 0),
            posiciones: this.posiciones,
            logoIzquierdo: this.logoIzq,
            logoDerecho: this.logoDer,
          },
        };

        const { data } = await api.post("/community", cuerpo);
        await api.post(`/community/${data.data._id}/submit`, {});
        this.$store.dispatch("avisar", { texto: this.$t("create.sentForReview") });
        this.$router.push("/dashboard");
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      } finally {
        this.guardando = false;
      }
    },
  },

  created() { this.traerCatalogo(1); },
  beforeDestroy() { window.clearTimeout(this.reloj); },
};
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

.mb-crear { display: flex; flex-direction: column; gap: 22px; }
.mb-crear h1 { margin: 0; font-weight: 900; font-size: clamp(26px, 3.6vw, 34px); }

.mb-paso {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 900;
  font-size: 19px;

  > span:first-child {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: #1d3354;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
  }
}

.mb-crear__arriba, .mb-crear__abajo { display: flex; flex-wrap: wrap; gap: 20px; align-items: flex-start; }

/* ── La vista previa ──────────────────────────────────────────────── */

.mb-vista { flex: 1 1 260px; max-width: 340px; display: flex; flex-direction: column; gap: 8px; }

.mb-vista__tarjeta {
  border-radius: 16px;
  background: $panel-alto;
  border: 1px solid $borde;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mb-vista__nombre { font-weight: 900; font-size: 14px; }
.mb-vista__cat { font-size: 12px; color: $texto-4; }
.mb-vista__precio { display: flex; align-items: center; gap: 6px; font-weight: 900; }
.mb-vista__ayuda { font-size: 12px; color: $texto-4; }

.mb-mini {
  align-self: flex-start;
  height: 34px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid #2a4170;
  background: transparent;
  color: $texto-3;
  font-family: inherit;
  font-weight: 700;
  font-size: 12px;
  cursor: pointer;
  @include foco;
}

/* ── Los campos ───────────────────────────────────────────────────── */

.mb-crear__campos { flex: 999 1 360px; min-width: 0; display: flex; flex-direction: column; gap: 16px; }
.mb-crear__dos { display: flex; flex-wrap: wrap; gap: 20px; }

/*
  `flex: 1 1 260px` NO.

  Esta clase se usa adentro de `.mb-crear__dos`, que es una fila, y
  tambien suelta adentro de `.mb-crear__campos`, que es una COLUMNA.
  En la columna, `flex-grow: 1` la hacia crecer a lo alto y dejaba un
  hueco de doscientos pixeles entre los logos y lo que se gana.

  Crece solo cuando esta en la fila, que es donde tiene sentido.
*/
.mb-crear__col { display: flex; flex-direction: column; gap: 8px; }
.mb-crear__dos > .mb-crear__col { flex: 1 1 260px; }

.mb-rotulo {
  font-weight: 900;
  font-size: 11px;
  letter-spacing: .1em;
  color: $texto-3;
  text-transform: uppercase;
  em { color: #6bb4ff; font-weight: 700; letter-spacing: 0; font-style: normal; text-transform: none; }
}

.mb-campo {
  display: flex;
  flex-direction: column;
  gap: 6px;

  > span:first-child {
    font-weight: 900;
    font-size: 11px;
    letter-spacing: .1em;
    color: $texto-3;
    text-transform: uppercase;
    em { color: #6bb4ff; font-weight: 700; letter-spacing: 0; font-style: normal; text-transform: none; }
  }
}

.mb-campo__caja {
  position: relative;
  display: flex;

  input, textarea {
    flex: 1;
    min-width: 0;
    border-radius: 12px;
    border: 1px solid #2a4170;
    background: $panel;
    color: #fff;
    font-family: inherit;
    font-size: 15px;
    &:focus { outline: none; border-color: $azul; }
  }

  input { height: 48px; padding: 0 60px 0 14px; }
  textarea { height: 84px; padding: 12px 14px 26px; resize: none; }
}

.mb-campo__cuenta {
  position: absolute;
  right: 14px;
  top: 15px;
  font-size: 12px;
  color: $texto-4;
  &--abajo { top: auto; bottom: 10px; }
}

.mb-colores { display: flex; flex-wrap: wrap; gap: 8px; }

.mb-colores button {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 3px solid transparent;
  padding: 0;
  cursor: pointer;
  @include foco;
}

.mb-estilos {
  display: flex;
  gap: 4px;
  padding: 4px;
  border-radius: 12px;
  background: $panel;
  align-self: flex-start;

  button {
    height: 38px;
    padding: 0 14px;
    border-radius: 9px;
    border: 0;
    background: transparent;
    color: #fff;
    font-family: inherit;
    font-weight: 800;
    font-size: 13px;
    cursor: pointer;
    @include foco;
    &.is-activo { background: $azul; }
  }
}

.mb-ayuda { font-size: 12px; color: $texto-4; line-height: 1.5; }

.mb-logos { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; }
.mb-logo { display: flex; align-items: center; gap: 12px; }

.mb-logo__caja {
  width: 56px;
  height: 56px;
  flex: none;
  border-radius: 12px;
  background: $panel;
  border: 1px solid #2a4170;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  img { max-width: 100%; max-height: 100%; }
}

.mb-logo__texto { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: $texto-3; }

.mb-logo__subir {
  height: 36px;
  padding: 0 14px;
  border-radius: 10px;
  background: #1d3354;
  color: #fff;
  display: flex;
  align-items: center;
  font-weight: 800;
  font-size: 13px;
  cursor: pointer;
  input { position: absolute; width: 1px; height: 1px; opacity: 0; }
}

.mb-gana {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: $texto-2;
  ::v-deep strong { color: #fff; }
}

/* ── El catálogo ──────────────────────────────────────────────────── */

.mb-catalogo { flex: 999 1 420px; min-width: 0; display: flex; flex-direction: column; gap: 14px; }
.mb-catalogo__filtros { display: flex; flex-wrap: wrap; gap: 10px; }

.mb-buscar, .mb-rango, .mb-orden {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 46px;
  padding: 0 14px;
  border-radius: 12px;
  border: 1px solid #2a4170;
  background: $panel;
}

.mb-buscar { flex: 2 1 200px; }
.mb-rango { flex: 1 1 160px; padding: 0; overflow: hidden; span { color: $placeholder; } }
.mb-orden { position: relative; padding: 0; }

.mb-buscar input, .mb-rango input {
  flex: 1;
  min-width: 0;
  height: 100%;
  border: 0;
  outline: none;
  background: transparent;
  color: #fff;
  font-family: inherit;
  font-size: 14px;
}

.mb-rango input { width: 50%; padding: 0 12px; }

.mb-orden select {
  height: 100%;
  padding: 0 30px 0 12px;
  border: 0;
  background: transparent;
  color: #fff;
  font-family: inherit;
  font-weight: 700;
  font-size: 14px;
  appearance: none;
  -webkit-appearance: none;
  cursor: pointer;
}

.mb-catalogo__grilla {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(46%, 140px), 1fr));
  gap: 10px;
}

.mb-cobj {
  position: relative;
  min-width: 0;
  text-align: left;
  border-radius: 14px;
  border: 2px solid $borde;
  background: $panel-alto;
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

.mb-cobj__marco { border-radius: 10px; display: flex; align-items: center; justify-content: center; }
.mb-cobj__foto { width: 90%; aspect-ratio: 1 / 1; object-fit: contain; }
.mb-cobj__nombre { font-weight: 800; font-size: 12px; line-height: 1.25; height: 30px; overflow: hidden; }
.mb-cobj__valor { display: flex; align-items: center; gap: 4px; font-weight: 900; font-size: 13px; }

.mb-cobj__punto {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: #2a4170;
  display: flex;
  align-items: center;
  justify-content: center;
  &.is-elegido { background: #2fd47a; }
}

/* ── Las chances ──────────────────────────────────────────────────── */

.mb-odds {
  flex: 1 1 300px;
  max-width: 400px;
  border-radius: 18px;
  background: $panel-alto;
  border: 1px solid #23397a;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.mb-odds__cuantos {
  margin-left: auto;
  padding: 3px 9px;
  border-radius: 8px;
  background: #1d3354;
  font-weight: 900;
  font-size: 12px;
}

.mb-odds__vacio {
  margin: 0;
  padding: 16px;
  border-radius: 12px;
  border: 1px dashed #2a4170;
  text-align: center;
  font-size: 13px;
  color: $texto-4;
}

.mb-odds__lista { display: flex; flex-direction: column; gap: 8px; }

.mb-odd {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px;
  border-radius: 12px;
  background: $panel;
}

.mb-odd__foto { width: 40px; height: 40px; flex: none; }
.mb-odd__texto { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.mb-odd__nombre { font-weight: 800; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.mb-odd__datos {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: $texto-4;
  white-space: nowrap;
}

.mb-odd__pct {
  display: flex;
  align-items: center;
  gap: 2px;
  height: 34px;
  padding: 0 8px;
  border-radius: 8px;
  border: 1px solid #2a4170;
  background: $panel-alto;
  font-size: 13px;
  color: $texto-4;

  input {
    width: 62px;
    height: 100%;
    padding: 0;
    border: 0;
    outline: none;
    background: transparent;
    color: #fff;
    font-family: inherit;
    font-size: 13px;
    text-align: right;
  }

  &:focus-within { border-color: $azul; }
}

.mb-odd__sacar {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  border: 0;
  background: transparent;
  cursor: pointer;
  @include foco;
}

.mb-precio {
  border-radius: 14px;
  background: $panel;
  border: 1px solid #23397a;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.mb-precio__num { display: flex; align-items: center; gap: 8px; font-weight: 900; font-size: 26px; }

.mb-error {
  margin: 0;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(255, 91, 107, .12);
  border: 1px solid #ff5b6b;
  color: #ff9aa5;
  font-size: 13px;
}

.mb-publicar {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 50px;
  border: 0;
  border-radius: 14px;
  background: $azul;
  box-shadow: 0 4px 0 $azul-hondo;
  color: #fff;
  font-family: inherit;
  font-weight: 900;
  font-size: 15px;
  text-decoration: none;
  cursor: pointer;
  @include foco;
  &:hover { color: #fff; filter: brightness(1.06); }
  &:disabled { opacity: .5; cursor: default; filter: none; }
}

.mb-com__mas {
  align-self: center;
  height: 46px;
  padding: 0 22px;
  border-radius: 12px;
  border: 0;
  background: #1d3354;
  color: #fff;
  font-family: inherit;
  font-weight: 800;
  font-size: 14px;
  cursor: pointer;
  @include foco;
}

.mb-oculto { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
</style>
