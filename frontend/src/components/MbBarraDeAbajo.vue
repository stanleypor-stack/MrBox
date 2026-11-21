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

    <!-- Billetera e inventario, solo con sesion. -->
    <button v-if="entro" type="button" :class="{ 'is-activo': abierto.wallet }" @click="alternar('wallet')">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M3 7a2 2 0 0 1 2-2h12v4M3 7v10a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2zM16 14h.01" />
      </svg>{{ $t('nav.wallet') }}
    </button>

    <button v-if="entro" type="button" :class="{ 'is-activo': $route.path === '/inventory' }" @click="ir('/inventory')">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M3 9h18v11H3zM2 5l5-2 5 2-5 2zM22 5l-5-2-5 2 5 2zM10 13h4" />
      </svg>{{ $t('nav.inventory') }}
    </button>

    <!--
      LOS DOS QUE REEMPLAZAN A BILLETERA E INVENTARIO.

      Las dos pantallas que puede mirar sin cuenta: las cajas y las
      promociones. Asi la barra sigue teniendo cinco botones --como la
      de mrloot-- en vez de cuatro y un hueco.
    -->
    <button v-if="!entro" type="button" :class="{ 'is-activo': $route.path === '/boxes' }" @click="ir('/boxes')">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M3 9h18v11H3zM2 5l5-2 5 2-5 2zM22 5l-5-2-5 2 5 2zM12 9v11" />
      </svg>{{ $t('nav.boxes') }}
    </button>

    <button v-if="!entro" type="button" :class="{ 'is-activo': $route.path === '/promotions' }" @click="ir('/promotions')">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M20 12v9H4v-9M2 7h20v5H2zM12 21V7M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7M12 7h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7" />
      </svg>{{ $t('nav.promotions') }}
    </button>

    <button
      v-if="entro" type="button" :class="{ 'is-activo': abierto.cuenta }"
      :aria-expanded="abierto.cuenta ? 'true' : 'false'" @click="alternar('cuenta')"
    >
      <!-- La foto si la subio, la inicial si no. -->
      <img
        v-if="usuario && usuario.avatarUrl" class="mb-abajo__yo mb-abajo__yo--foto"
        :src="usuario.avatarUrl" alt=""
      >
      <span v-else class="mb-abajo__yo">{{ inicial }}</span>{{ $t('header.account') }}
    </button>

    <button v-else type="button" class="mb-abajo__alta" @click="ir('/signup')">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M19 8v6M22 11h-6" />
      </svg>{{ $t('action.signUp') }}
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
  /*
    FIJA A LA PANTALLA, NO `sticky`.

    Era `sticky` y desaparecio el dia que `html, body` recibieron
    `overflow-x: hidden` para que nada se saliera de costado: ese
    overflow convierte al body en un contenedor de scroll, y un
    elemento `sticky` adentro deja de pegarse a la pantalla.

    Fija no depende de nada de eso. Es lo que de verdad queria ser: una
    barra que esta siempre ahi abajo.
  */
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  /* Por ENCIMA del cajon del menu (z 20): es el mismo boton que lo
     abrio el que tiene que poder cerrarlo. Tapado, la unica salida
     seria tocar el velo, que nadie adivina. */
  z-index: 30;
  height: 72px;
  box-sizing: border-box;
  /* El relleno de abajo es más grande para dejar lugar a la barra del
     sistema en los teléfonos que la tienen pegada al borde. */
  padding: 8px 6px calc(12px + env(safe-area-inset-bottom, 0px));
  background: $panel;
  border-top: 1px solid #1a2a45;
  display: grid;
  /*
    LAS COLUMNAS QUE HAYA, NO CINCO SIEMPRE.

    Era `repeat(5, 1fr)`. Con sesion hay cinco botones y cerraba; sin
    sesion hay cuatro y la quinta columna quedaba vacia: todo corrido
    a la izquierda y 71px de nada contra el borde.
  */
  grid-auto-flow: column;
  grid-auto-columns: minmax(0, 1fr);
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
    /*
      EL ROTULO NO PUEDE ROMPER LA FILA.

      "Promociones" mide 70px en una celda de 71: en castellano entra
      por un pelo y en otro idioma no tiene por que. Cortado con
      puntos suspensivos, la barra queda igual en los nueve.
    */
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    @include foco;

    &.is-activo { color: #fff; }
  }
}

/*
  El unico boton de la barra que no es navegacion.

  Al visitante le quedan cinco: cuatro lo mueven por el sitio y este
  lo convierte en jugador. Pintado igual que los otros no se distingue
  de una pestana mas.
*/
.mb-abajo__alta {
  color: #7fc2ff !important;
  font-weight: 900;
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

/* La foto, recortada al mismo circulo que la inicial. */
.mb-abajo__yo--foto {
  object-fit: cover;
  display: block;
}
</style>
