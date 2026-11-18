<template>
  <div class="mb-cajas">
    <div class="mb-cajas__barra">
      <div class="mb-buscador">
        <label for="mb-buscar" class="mb-oculto">{{ $t('action.search') }}</label>
        <svg class="mb-buscador__lupa" width="17" height="17" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
        </svg>
        <input
          id="mb-buscar" v-model="busqueda" type="search" class="mb-in"
          :placeholder="$t('boxes.searchPlaceholder')"
        >
      </div>

      <div class="mb-cajas__filtros">
        <button
          v-for="c in categoriasConTodas" :key="c.valor" type="button"
          class="mb-chip" :class="{ 'is-activo': categoria === c.valor }"
          :aria-pressed="categoria === c.valor ? 'true' : 'false'"
          @click="categoria = c.valor"
        >{{ c.texto }}<span v-if="c.cuenta" class="mb-chip__cuenta">{{ c.cuenta }}</span></button>
      </div>

      <div class="mb-orden">
        <span class="mb-oculto">{{ $t('boxes.sort') }}</span>
        <MbElegir v-model="orden" :opciones="ordenes" chico />
      </div>
    </div>

    <!-- Mientras carga se dibujan tarjetas vacías del mismo tamaño que
         las de verdad. Sin esto la página salta cuando llegan los datos
         y el dedo termina tocando otra cosa. -->
    <div v-if="cargando" class="mb-grilla" aria-hidden="true">
      <div v-for="n in 12" :key="n" class="mb-fantasma"></div>
    </div>

    <p v-else-if="!cajas.items.length" class="mb-vacio">{{ $t('boxes.empty') }}</p>

    <div v-else class="mb-grilla">
      <MbCajaEnGrilla v-for="c in cajas.items" :key="c._id" :caja="c" />
    </div>

    <nav v-if="cajas.pages > 1" class="mb-paginas" :aria-label="$t('boxes.title')">
      <button type="button" class="mb-chip" :disabled="pagina <= 1" @click="pagina -= 1">
        {{ $t('common.previous') }}
      </button>
      <span class="mb-paginas__cuenta">{{ pagina }} / {{ cajas.pages }}</span>
      <button type="button" class="mb-chip" :disabled="pagina >= cajas.pages" @click="pagina += 1">
        {{ $t('common.next') }}
      </button>
    </nav>
  </div>
</template>

<script>
import MbElegir from "@/components/MbElegir.vue";
import { mapState } from "vuex";
import MbCajaEnGrilla from "@/components/MbCajaEnGrilla.vue";

/**
 * EL CATALOGO.
 *
 * Buscar, filtrar por categoría, ordenar y pasar de página.
 *
 * LO QUE SE ESCRIBE NO SE MANDA EN CADA TECLA
 *
 * Hay una espera de 350 ms. Sin ella, escribir "pokemon" son siete
 * pedidos y los primeros seis no le sirven a nadie: cargan el servidor
 * y encima pueden llegar desordenados, dejando la pantalla mostrando el
 * resultado de "poke" después del de "pokemon".
 *
 * Y por las dudas, cada respuesta trae su número de pedido: si llega una
 * vieja, se descarta. La espera hace que pase poco; esto hace que, si
 * pasa, no se vea.
 */
export default {
  name: "BoxesView",
  components: { MbElegir, MbCajaEnGrilla },

  data() {
    /* Lo que se esta tecleando vive aca hasta que se calma; lo demas
       vive en la direccion (ver el comentario de abajo). */
    return { busqueda: this.$route.query.search || "", reloj: null, ultimoPedido: 0 };
  },

  computed: {
    /* Las cuatro maneras de ordenar, para el selector. */
    ordenes() {
      return [
        { valor: "popular", texto: this.$t("boxes.sortPopular") },
        { valor: "nuevas", texto: this.$t("boxes.sortNew") },
        { valor: "baratas", texto: this.$t("boxes.sortCheap") },
        { valor: "caras", texto: this.$t("boxes.sortExpensive") },
      ];
    },

    ...mapState({ cajas: "cajas", cargando: "cargandoCajas", categorias: "categorias" }),

    /*
      LA DIRECCION MANDA.

      Categoria, orden y pagina salen de `?category=`, `?sort=` y
      `?page=`, y tocar un chip cambia la direccion. Antes vivian
      adentro de la pantalla, y por eso /boxes?category=Cookware --el
      enlace de la barra lateral, el del pie y el de los banners--
      mostraba TODAS las cajas: la pantalla ni miraba la direccion.

      Con la direccion mandando, ademas, el boton de atras funciona y un
      filtro se puede mandar por mensaje.
    */
    categoria: {
      get() { return this.$route.query.category || ""; },
      set(v) { this.irA({ category: v || undefined, page: undefined }); },
    },

    orden: {
      get() { return this.$route.query.sort || "popular"; },
      set(v) { this.irA({ sort: v === "popular" ? undefined : v, page: undefined }); },
    },

    pagina: {
      get() { return Math.max(1, Number(this.$route.query.page) || 1); },
      set(v) { this.irA({ page: v > 1 ? String(v) : undefined }); },
    },

    categoriasConTodas() {
      /*
        El servidor manda `{ name, count }` desde que la barra lateral
        necesita el conteo. Se arma el texto del chip con los dos, que
        de paso es mas util: "Mix 107" dice cuanto hay antes de tocar.
      */
      return [
        { valor: "", texto: this.$t("boxes.allCategories"), cuenta: this.cajas.total || 0 },
        ...this.categorias.map((c) => ({ valor: c.name, texto: c.name, cuenta: c.count })),
      ];
    },
  },

  watch: {
    busqueda() { this.pedirConEspera(); },

    /* Un cambio de direccion --un chip, el boton de atras, un enlace
       de la barra lateral-- es lo que dispara el pedido. */
    "$route.query": function () {
      const q = this.$route.query.search || "";
      if (q !== this.busqueda) this.busqueda = q;
      this.pedir();
    },
  },

  methods: {
    /**
     * Cambia la direccion sin apilar una entrada por tecla.
     *
     * `replace` y no `push` para lo que se teclea: con `push`, volver
     * atras despues de escribir "rolex" serian cinco pasos, uno por
     * letra.
     */
    irA(cambios, reemplazar) {
      const query = { ...this.$route.query, ...cambios };
      for (const k of Object.keys(query)) if (query[k] === undefined) delete query[k];

      const igual = JSON.stringify(query) === JSON.stringify(this.$route.query);
      if (igual) return;

      const ir = reemplazar ? this.$router.replace : this.$router.push;
      ir.call(this.$router, { query }).catch(() => {});
    },

    pedirConEspera() {
      clearTimeout(this.reloj);
      this.reloj = setTimeout(() => {
        this.irA({ search: this.busqueda || undefined, page: undefined }, true);
        /* Si la direccion no cambio --se borro y se volvio a escribir
           lo mismo-- el watch no corre: se pide igual. */
        this.pedir();
      }, 350);
    },

    async pedir() {
      const mio = ++this.ultimoPedido;
      try {
        await this.$store.dispatch("traerCajas", {
          search: this.busqueda || undefined,
          category: this.categoria || undefined,
          sort: this.orden,
          page: this.pagina,
        });
        if (mio !== this.ultimoPedido) return;
      } catch (err) {
        if (mio !== this.ultimoPedido) return;
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      }
    },
  },

  created() {
    this.pedir();
    this.$store.dispatch("traerCategorias");
  },

  beforeDestroy() {
    clearTimeout(this.reloj);
  },
};
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

.mb-cajas {
  padding: 24px 28px 48px;
  display: flex;
  flex-direction: column;
  gap: 20px;

  @include en-celular { padding: 16px; }
}

/* ── La barra de arriba ───────────────────────────────────────────── */

.mb-cajas__barra {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.mb-buscador {
  position: relative;
  flex: 1 1 260px;
  max-width: 420px;
}

.mb-buscador__lupa {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: $texto-4;
  pointer-events: none;
}

.mb-in {
  width: 100%;
  height: 44px;
  padding: 0 14px 0 36px;
  border: 1px solid $borde-fuerte;
  border-radius: $radio;
  background: $panel;
  color: $texto;
  font-family: inherit;
  font-size: 14px;

  &::placeholder { color: $placeholder; }
  &:focus { outline: none; border-color: $azul; }
}

.mb-cajas__filtros {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
}

.mb-chip {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 36px;
  padding: 0 14px;
  border: 1px solid $borde-fuerte;
  border-radius: 999px;
  background: $panel-alto;
  color: $texto-2;
  font-family: inherit;
  font-weight: 800;
  font-size: 13px;
  white-space: nowrap;
  cursor: pointer;
  @include foco;

  &:hover:not(:disabled) { background: $lateral-hover; color: $texto; }
  &.is-activo { background: $azul; border-color: $azul; color: #fff; }
  &:disabled { opacity: .4; cursor: default; }
}

.mb-chip__cuenta {
  color: $texto-4;
  font-size: 11px;
  font-weight: 800;
}

.is-activo .mb-chip__cuenta { color: rgba(255, 255, 255, .78); }

.mb-orden__select {
  width: auto;
  padding: 0 12px;
  height: 44px;
  font-weight: 700;
  cursor: pointer;
}

/* ── La grilla ────────────────────────────────────────────────────── */

.mb-grilla {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 14px;

  @include en-celular {
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 10px;
  }
}

.mb-fantasma {
  aspect-ratio: 1 / 1.32;
  border-radius: $radio-tarjeta;
  background: linear-gradient(100deg, $panel 30%, $panel-alto 50%, $panel 70%);
  background-size: 300% 100%;
  animation: mbBrillo 1.2s ease-in-out infinite;
}

@keyframes mbBrillo {
  0% { background-position: 100% 0; }
  100% { background-position: -100% 0; }
}

.mb-vacio {
  margin: 40px 0;
  text-align: center;
  color: $texto-4;
}

/* ── Las páginas ──────────────────────────────────────────────────── */

.mb-paginas {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.mb-paginas__cuenta {
  color: $texto-3;
  font-weight: 800;
}

/* Para el lector de pantalla, invisible para el ojo. */
.mb-oculto {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}
</style>
