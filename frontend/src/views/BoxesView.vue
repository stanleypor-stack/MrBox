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
        >{{ c.texto }}</button>
      </div>

      <label class="mb-orden">
        <span class="mb-oculto">{{ $t('boxes.sort') }}</span>
        <select v-model="orden" class="mb-in mb-orden__select">
          <option value="popular">{{ $t('boxes.sortPopular') }}</option>
          <option value="nuevas">{{ $t('boxes.sortNew') }}</option>
          <option value="baratas">{{ $t('boxes.sortCheap') }}</option>
          <option value="caras">{{ $t('boxes.sortExpensive') }}</option>
        </select>
      </label>
    </div>

    <!-- Mientras carga se dibujan tarjetas vacías del mismo tamaño que
         las de verdad. Sin esto la página salta cuando llegan los datos
         y el dedo termina tocando otra cosa. -->
    <div v-if="cargando" class="mb-grilla" aria-hidden="true">
      <div v-for="n in 12" :key="n" class="mb-fantasma"></div>
    </div>

    <p v-else-if="!cajas.items.length" class="mb-vacio">{{ $t('boxes.empty') }}</p>

    <div v-else class="mb-grilla">
      <MbTarjetaDeCaja v-for="c in cajas.items" :key="c._id" :caja="c" />
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
import { mapState } from "vuex";
import MbTarjetaDeCaja from "@/components/MbTarjetaDeCaja.vue";

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
  components: { MbTarjetaDeCaja },

  data() {
    return {
      busqueda: "",
      categoria: "",
      orden: "popular",
      pagina: 1,
      reloj: null,
      ultimoPedido: 0,
    };
  },

  computed: {
    ...mapState({ cajas: "cajas", cargando: "cargandoCajas", categorias: "categorias" }),

    categoriasConTodas() {
      return [
        { valor: "", texto: this.$t("boxes.allCategories") },
        ...this.categorias.map((c) => ({ valor: c, texto: c })),
      ];
    },
  },

  watch: {
    busqueda() { this.pagina = 1; this.pedirConEspera(); },
    categoria() { this.pagina = 1; this.pedir(); },
    orden() { this.pagina = 1; this.pedir(); },
    pagina() { this.pedir(); },
  },

  methods: {
    pedirConEspera() {
      clearTimeout(this.reloj);
      this.reloj = setTimeout(this.pedir, 350);
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
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
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
