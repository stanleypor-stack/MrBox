<template>
  <div class="mb-idioma" ref="raiz">
    <!-- El botón que muestra en qué idioma estás. -->
    <button
      ref="boton"
      type="button"
      class="mb-idioma__boton"
      :aria-expanded="abierto ? 'true' : 'false'"
      aria-haspopup="listbox"
      :aria-label="$t('common.language')"
      @click="alternar"
      @keydown.down.prevent="abrirYMover(1)"
      @keydown.up.prevent="abrirYMover(-1)"
    >
      <span class="mb-flag" :class="'mb-flag--' + actual.bandera" aria-hidden="true"></span>
      <span class="mb-idioma__nombre">{{ actual.nombre }}</span>
      <svg
        class="mb-idioma__flecha" :class="{ 'is-abierto': abierto }"
        width="16" height="16" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="2.5" stroke-linecap="round"
        stroke-linejoin="round" aria-hidden="true"
      >
        <path d="M6 15l6-6 6 6" />
      </svg>
    </button>

    <!--
      La lista se abre HACIA ARRIBA porque el selector vive abajo de todo
      en la barra lateral, igual que en el diseño. Abriendo para abajo
      quedaría cortada por el borde de la ventana.
    -->
    <ul
      v-if="abierto"
      ref="lista"
      class="mb-idioma__lista"
      role="listbox"
      :aria-label="$t('common.language')"
      :aria-activedescendant="'mb-idioma-' + idiomas[marcado].code"
      tabindex="-1"
      @keydown.down.prevent="mover(1)"
      @keydown.up.prevent="mover(-1)"
      @keydown.home.prevent="marcado = 0"
      @keydown.end.prevent="marcado = idiomas.length - 1"
      @keydown.enter.prevent="elegir(idiomas[marcado].code)"
      @keydown.space.prevent="elegir(idiomas[marcado].code)"
      @keydown.esc="cerrar(true)"
      @keydown.tab="cerrar(false)"
    >
      <li
        v-for="(idioma, i) in idiomas"
        :id="'mb-idioma-' + idioma.code"
        :key="idioma.code"
        class="mb-idioma__opcion"
        :class="{ 'is-marcado': i === marcado, 'is-elegido': idioma.code === locale }"
        role="option"
        :aria-selected="idioma.code === locale ? 'true' : 'false'"
        @click="elegir(idioma.code)"
        @mousemove="marcado = i"
      >
        <span class="mb-flag" :class="'mb-flag--' + idioma.bandera" aria-hidden="true"></span>
        <span class="mb-idioma__nombre">{{ idioma.nombre }}</span>
        <svg
          v-if="idioma.code === locale"
          class="mb-idioma__tilde" width="16" height="16" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" stroke-width="3"
          stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
        >
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </li>
    </ul>
  </div>
</template>

<script>
/**
 * EL SELECTOR DE IDIOMA.
 *
 * Es una lista nuestra y no un `<select>` del navegador. No es capricho:
 * el `<select>` abierto lo dibuja el sistema operativo, con su resaltado
 * azul de Windows, y no deja poner una bandera adentro de cada opción.
 * El menú del diseño tiene bandera, nombre y tilde en el elegido, y eso
 * con un `<select>` no se puede.
 *
 * Lo que sí hay que devolver a mano, porque el `<select>` lo traía gratis:
 * las flechas para recorrer, Enter para elegir, Escape para salir, y que
 * el lector de pantalla entienda que esto es una lista de opciones. Está
 * todo abajo.
 */
import { IDIOMAS } from "@/i18n/idiomas";
import { cambiarIdioma } from "@/i18n";

export default {
  name: "MbSelectorDeIdioma",

  data() {
    return {
      abierto: false,
      /* Cuál está resaltado con el teclado. No es el elegido. */
      marcado: 0,
      idiomas: IDIOMAS,
    };
  },

  computed: {
    locale() {
      return this.$i18n.locale;
    },
    actual() {
      return this.idiomas.find((i) => i.code === this.locale) || this.idiomas[0];
    },
  },

  methods: {
    alternar() {
      if (this.abierto) this.cerrar(true);
      else this.abrir();
    },

    abrir() {
      /* Arranca marcado el que ya está puesto, no el primero. */
      this.marcado = Math.max(0, this.idiomas.findIndex((i) => i.code === this.locale));
      this.abierto = true;
      this.$nextTick(() => this.$refs.lista && this.$refs.lista.focus());
    },

    /**
     * Cierra. `devolverFoco` en `true` manda el foco de vuelta al botón.
     *
     * Importa la diferencia: al salir con Escape el foco tiene que volver
     * al botón, porque si no quien usa teclado queda flotando en ningún
     * lado. Al salir con Tab, no: el foco ya se fue al siguiente.
     */
    cerrar(devolverFoco) {
      this.abierto = false;
      if (devolverFoco) this.$nextTick(() => this.$refs.boton && this.$refs.boton.focus());
    },

    mover(paso) {
      const n = this.idiomas.length;
      this.marcado = (this.marcado + paso + n) % n;
    },

    abrirYMover(paso) {
      this.abrir();
      this.$nextTick(() => this.mover(paso));
    },

    elegir(code) {
      cambiarIdioma(code);
      this.cerrar(true);
      this.$emit("cambio", code);
    },

    alClicAfuera(e) {
      if (this.abierto && this.$refs.raiz && !this.$refs.raiz.contains(e.target)) {
        this.abierto = false;
      }
    },
  },

  mounted() {
    document.addEventListener("click", this.alClicAfuera);
  },

  beforeDestroy() {
    /* Si esto no se saca, el oyente queda vivo para siempre. */
    document.removeEventListener("click", this.alClicAfuera);
  },
};
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

.mb-idioma {
  position: relative;
  width: 100%;
}

.mb-idioma__boton {
  width: 100%;
  height: 44px; // el mínimo para que un dedo le pegue
  padding: 0 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid $borde-fuerte;
  border-radius: $radio;
  background: $panel-alto;
  color: $texto;
  font-family: inherit;
  font-weight: 800;
  font-size: 14px;
  cursor: pointer;
  @include foco;

  &:hover { background: $lateral-hover; }
}

.mb-idioma__nombre {
  flex: 1;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mb-idioma__flecha {
  flex: none;
  color: $texto-3;
  transition: transform .15s ease;

  &.is-abierto { transform: rotate(180deg); }
}

.mb-idioma__lista {
  position: absolute;
  left: 0;
  right: 0;
  bottom: calc(100% + 8px);
  z-index: 60;
  margin: 0;
  padding: 6px;
  list-style: none;
  // Nueve idiomas no entran en una pantalla baja: se desliza.
  max-height: 320px;
  overflow-y: auto;
  border: 1px solid $borde-fuerte;
  border-radius: $radio-tarjeta;
  background: $panel;
  box-shadow: $sombra-tarjeta;
  @include foco;
}

.mb-idioma__opcion {
  height: 40px;
  padding: 0 10px;
  display: flex;
  align-items: center;
  gap: 10px;
  border-radius: $radio-chico;
  color: $texto-2;
  font-weight: 700;
  font-size: 14px;
  cursor: pointer;

  // Resaltado del teclado y del mouse: el mismo, así no hay dos cosas
  // marcadas a la vez diciendo cosas distintas.
  &.is-marcado {
    background: $azul-activo;
    color: $texto;
  }

  &.is-elegido { color: $texto; }
}

.mb-idioma__tilde {
  flex: none;
  color: $amarillo-v;
}
</style>
