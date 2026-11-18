<template>
  <nav class="mb-abajo" :aria-label="$t('header.mainNav')">
    <button type="button" :class="{ 'is-activo': abierto.cajon }" @click="alternar('cajon')">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M4 7h16M4 12h10M4 17h16M18 10l3 2-3 2" />
      </svg>{{ $t('nav.menu') }}
    </button>

    <button type="button" :class="{ 'is-activo': esPortada }" @click="ir('/')">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2" aria-hidden="true">
        <circle cx="12" cy="12" r="9" :fill="esPortada ? '#2f6fe0' : 'none'"
                :stroke="esPortada ? '#2f6fe0' : 'currentColor'" />
        <path d="M8 12.5 12 9l4 3.5V16h-2.6v-2.4h-2.8V16H8z"
              :fill="esPortada ? '#ffffff' : 'currentColor'" stroke="none" />
      </svg>{{ $t('nav.home') }}
    </button>

    <button type="button" :class="{ 'is-activo': abierto.wallet }" @click="alternar('wallet')">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M3 7a2 2 0 0 1 2-2h12v4M3 7v10a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2zM16 14h.01" />
      </svg>{{ $t('nav.wallet') }}
    </button>

    <button type="button" :class="{ 'is-activo': $route.path === '/inventory' }" @click="ir('/inventory')">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M3 9h18v11H3zM2 5l5-2 5 2-5 2zM22 5l-5-2-5 2 5 2zM10 13h4" />
      </svg>{{ $t('nav.inventory') }}
    </button>

    <button
      type="button" :class="{ 'is-activo': abierto.cuenta }"
      :aria-expanded="abierto.cuenta ? 'true' : 'false'" @click="alternar('cuenta')"
    >
      <span class="mb-abajo__yo">{{ inicial }}</span>{{ $t('header.account') }}
    </button>
  </nav>
</template>

<script>
import { mapState, mapGetters } from "vuex";

/**
 * LA BARRA DE ABAJO DEL CELULAR.
 *
 * Cinco botones fijos al pie: el menú, la portada, la billetera, el
 * inventario y la cuenta. Es la navegación de celular del diseño.
 *
 * POR QUE ABAJO Y NO ARRIBA
 *
 * Porque un pulgar llega. El menú lateral del escritorio, convertido en
 * una fila que se desliza arriba de todo, obliga a estirar la mano
 * hasta la mitad de la pantalla para cambiar de sección, y encima
 * empuja el contenido hacia abajo en la única pantalla donde el alto es
 * lo que escasea.
 *
 * Solo se dibuja en celular: en escritorio la barra lateral está
 * siempre a la vista y esto sería una segunda navegación compitiendo
 * con la primera.
 */
export default {
  name: "MbBarraDeAbajo",

  computed: {
    ...mapState(["usuario", "abierto"]),
    ...mapGetters(["entro"]),

    esPortada() { return this.$route.path === "/"; },

    inicial() {
      return String((this.usuario && this.usuario.username) || "?").charAt(0).toUpperCase();
    },
  },

  methods: {
    alternar(cual) { this.$store.commit("alternar", cual); },

    ir(donde) {
      this.$store.commit("abrir", null);
      if (this.$route.path !== donde) this.$router.push(donde);
      window.scrollTo({ top: 0 });
    },
  },
};
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

.mb-abajo {
  position: sticky;
  bottom: 0;
  /* Por ENCIMA del cajon del menu (z 20): es el mismo boton que lo
     abrio el que tiene que poder cerrarlo. Tapado, la unica salida
     seria tocar el velo, que nadie adivina. */
  z-index: 30;
  /* Se monta sobre los ultimos 72px de la pagina en vez de agregarlos
     al final: asi el fondo no queda con una franja vacia abajo cuando
     la pagina es corta. El relleno de `.mb-contenido` ya deja el lugar. */
  margin-top: -72px;
  height: 72px;
  box-sizing: border-box;
  /* El relleno de abajo es más grande para dejar lugar a la barra del
     sistema en los teléfonos que la tienen pegada al borde. */
  padding: 8px 6px calc(12px + env(safe-area-inset-bottom, 0px));
  background: $panel;
  border-top: 1px solid #1a2a45;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 2px;

  @include en-escritorio { display: none; }

  button {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 5px;
    border: 0;
    background: transparent;
    color: $texto-3;
    font-family: inherit;
    font-weight: 800;
    font-size: 11px;
    cursor: pointer;
    @include foco;

    &.is-activo { color: #fff; }
  }
}

.mb-abajo__yo {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #2f6fe0;
  border: 2px solid $texto-2;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: $fuente-cartel;
  font-size: 11px;
  color: #fff;
}
</style>
