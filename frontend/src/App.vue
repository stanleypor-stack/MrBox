<template>
  <div class="mb-app">
    <!--
      Registrarse y entrar ocupan la pantalla entera, sin cabecera ni
      barra lateral: en el diseño son una tarjeta sola, centrada sobre
      un fondo oscuro. Con el armazón alrededor dejarían de serlo.
    -->
    <router-view v-if="sinArmazon" />

    <template v-else>
      <MbCabecera
        @depositar="abrirCaja('in')"
        @retirar="abrirCaja('out')"
        @canjear="codigoAbierto = true"
        @soporte="pedirSoporte"
      />

      <!--
        El cuerpo: barra lateral y contenido, uno al lado del otro. La
        cabecera va ARRIBA de los dos porque su degradé azul tiene que
        cruzar todo el ancho, como en el diseño.
      -->
      <div class="mb-cuerpo">
        <MbLateral class="mb-cuerpo__lateral" />
        <main class="mb-contenido">
          <router-view />

          <!--
            EL PIE VA ADENTRO DEL CONTENIDO, NO ABAJO DEL CUERPO.

            Asi queda alineado con la columna de la pantalla y no cruza
            por debajo de la barra lateral, que es como lo dibuja el
            diseno.
          -->
          <MbPie @soporte="pedirSoporte" />
        </main>
      </div>

      <!-- ── Lo que solo existe en celular ────────────────────────── -->

      <!-- El menú, de cajón. Tapa la página pero deja la cabecera y la
           barra de abajo a la vista, para poder cerrarlo desde el mismo
           botón que lo abrió. -->
      <div v-if="abierto.cajon" class="mb-cajon">
        <button type="button" class="mb-cajon__fondo" :aria-label="$t('header.closeMenu')" @click="cerrar"></button>
        <MbLateral cajon @click.native="talVezCerrar" />
      </div>

      <MbMenuDeCuenta v-if="abierto.cuenta" @soporte="pedirSoporte" />

      <MbBarraDeAbajo />

      <!-- El globito de soporte: en todas las pantallas del sitio,
           nunca en el panel, que tiene su propia bandeja. -->
      <MbSoporte :abrir="soporte.pedidos" :mensaje-inicial="soporte.borrador" />

      <!--
        LA CAJA.

        Comprar SC y canjearlos, en la ventana del prototipo. Se dibuja
        solo cuando se abre: adentro hay un QR y una librería para
        dibujarlo que no tiene por qué bajarse quien nunca la abre.
      -->
      <MbBilletera v-if="caja" :modo="caja" @cerrar="caja = ''" />

      <!--
        CANJEAR UN CODIGO.

        "Redeem" es cambiar un codigo por saldo o por cajas, no sacar
        plata: para eso esta "Withdraw". Hasta ahora los dos botones
        abrian lo mismo, que es justo lo contrario de lo que dice la
        palabra.
      -->
      <MbCanjearCodigo v-if="codigoAbierto" @cerrar="codigoAbierto = false" />
    </template>

    <output v-if="aviso" class="mb-aviso" :class="'mb-aviso--' + aviso.tono" aria-live="polite">
      {{ aviso.texto }}
    </output>
  </div>
</template>

<script>
import { mapState } from "vuex";
import MbCabecera from "@/components/MbCabecera.vue";
import MbLateral from "@/components/MbLateral.vue";
import MbBarraDeAbajo from "@/components/MbBarraDeAbajo.vue";
import MbMenuDeCuenta from "@/components/MbMenuDeCuenta.vue";
import MbPie from "@/components/MbPie.vue";
import MbSoporte from "@/components/MbSoporte.vue";
import MbBilletera from "@/components/MbBilletera.vue";
import MbCanjearCodigo from "@/components/MbCanjearCodigo.vue";

/**
 * EL ARMAZON DEL SITIO.
 *
 * Cabecera arriba --su degradé azul tiene que cruzar todo el ancho--,
 * barra lateral y contenido abajo, uno al lado del otro.
 *
 * EN CELULAR EL ARMAZON ES OTRO
 *
 * La barra lateral desaparece y en su lugar hay cinco botones fijos al
 * pie: menú, portada, billetera, inventario y cuenta. El menú abre la
 * MISMA barra lateral, de cajón.
 *
 * No es una decisión de estilo: en un teléfono el alto es lo que
 * escasea, y un menú de doscientos pixeles arriba de todo se come la
 * primera pantalla entera. Abajo, además, llega el pulgar.
 *
 * REGISTRARSE Y ENTRAR NO VIVEN ACA
 *
 * Son pantallas con dirección propia, `/signup` y `/login`, portadas del
 * diseño. En una ventanita flotante no entraba el cartel del arcoíris,
 * que es la mitad de esa pantalla. Y como son pantallas, se puede mandar
 * el link de registro en una campaña y el botón de atrás funciona.
 */
export default {
  name: "App",
  components: {
    MbCabecera, MbLateral, MbBarraDeAbajo, MbMenuDeCuenta, MbPie, MbSoporte, MbBilletera,
    MbCanjearCodigo,
  },

  /* "in" deposita, "out" canjea, vacio es cerrada. */
  data() { return { caja: "", codigoAbierto: false }; },



  computed: {
    ...mapState(["aviso", "abierto", "soporte"]),

    /**
     * Las pantallas que se dibujan solas, sin cabecera ni lateral.
     *
     * Registrarse y entrar, que en el diseño son una tarjeta sola; y el
     * PANEL entero, que tiene su propio armazón: con la cabecera del
     * sitio arriba quedarían dos barras, dos menúes y dos buscadores.
     */
    sinArmazon() {
      return ["signup", "login"].includes(this.$route.name)
        || this.$route.path.startsWith("/admin");
    },
  },

  watch: {
    /* Cambiar de pantalla cierra todo lo que esté abierto encima. */
    $route() { this.cerrar(); },

    "abierto.cajon": function (v) { this.trabarElFondo(v); },
  },

  beforeDestroy() { this.trabarElFondo(false); },

  methods: {
    cerrar() { this.$store.commit("abrir", null); },

    /**
     * Con el cajon abierto, la pagina de atras se queda quieta.
     *
     * Sin esto, el dedo que quiere deslizar el menu termina moviendo
     * el catalogo que esta abajo, y al cerrar el menu la pagina quedo
     * en otro lado.
     */
    trabarElFondo(trabar) {
      if (typeof document === "undefined") return;
      document.body.style.overflow = trabar ? "hidden" : "";
    },

    /**
     * Tocar un enlace del cajón lo cierra.
     *
     * Se mira el evento en vez de ponerle un `@click` a cada enlace
     * porque la barra tiene más de veinte --las categorías salen de la
     * base-- y uno que se olvide deja el cajón abierto encima de la
     * pantalla a la que acaba de llevar.
     */
    talVezCerrar(e) {
      if (e.target.closest("a, button")) this.cerrar();
    },

    /* Cabecera, pie y menú de cuenta abren el mismo globito. */
    pedirSoporte() { this.$store.dispatch("pedirSoporte"); },

    /**
     * Abrir la caja.
     *
     * Sin sesión no tiene sentido --no hay a quién acreditarle ni de
     * dónde sacar-- así que manda a entrar, que es lo que hace falta.
     */
    abrirCaja(modo) {
      this.cerrar();
      if (!this.$store.getters.entro) { this.$router.push("/login"); return; }
      this.caja = modo;
    },

    /* Lo que todavía no está: se avisa, en vez de un botón mudo. */
    avisarPendiente(clave) {
      this.$store.dispatch("avisar", { texto: this.$t(clave) });
      this.cerrar();
    },
  },
};
</script>

<style lang="scss">
@import "@/styles/tokens";

.mb-app {
  /*
    LA ESCALA DEL SITIO EN LA PC.

    A 1.366px, el diseño del prototipo --dibujado a 1.440-- entraba un
    quinto más grande de lo que debía: ocho tarjetas de Live Pulls
    donde mrloot muestra doce, el banner altísimo y la barra lateral
    comiéndose la pantalla.

    `zoom` y no `transform: scale()`: zoom cambia el tamaño de la caja,
    así que el resto de la página se reacomoda sola y las medidas de
    `100vh` y las barras fijas siguen cayendo donde tienen que caer.
    Con `scale` el contenido se achica pero deja el hueco del tamaño
    viejo.

    En el teléfono queda en 1: ahí el diseño ya entra como debe.
  */
  /*
    Y la escala tambien como NUMERO, porque adentro de un `zoom` una
    medida de pantalla deja de ser la pantalla: `100vh` se dibuja al
    84% y abajo de la barra lateral quedaba una franja del fondo de la
    pagina. Dividiendo por la escala, `100vh` vuelve a ser la pantalla
    entera.
  */
  --escala: 1;
  @media (min-width: 1100px) { zoom: .84; --escala: .84; }

  min-height: calc(100vh / var(--escala));
  background: $fondo;
  /* Para que el cajón se pueda plantar sobre el cuerpo sin tapar la
     cabecera ni la barra de abajo. */
  display: flex;
  flex-direction: column;
}

.mb-cuerpo {
  position: relative;
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
}

.mb-cuerpo__lateral { @include en-celular { display: none; } }

.mb-contenido {
  flex: 999 1 560px;
  min-width: 0;
  box-sizing: border-box;
  /*
    62 y no 24: mrloot deja unos 53 px de aire a cada lado de la
    columna y nosotros llegabamos casi al borde de la pantalla. Como
    la aplicacion se dibuja a ~0,84, 62 de maquetado son esos 53 que
    se ven.
  */
  padding: 20px 62px 64px;
  /* En celular el relleno de abajo deja lugar a la barra de cinco
     botones, que flota sobre el final de la página. */
  @include en-celular { padding: 14px 14px 110px; }
}

/* ── El cajón del menú ────────────────────────────────────────────── */

/*
  EL CAJON VA FIJO A LA PANTALLA, NO AL LARGO DE LA PAGINA.

  Estaba `absolute` adentro del cuerpo, que mide lo que mida el
  contenido. En una pagina larga el cajon medía dos mil pixeles: su
  propio scroll no servia para nada, y al bajar aparecia la pagina de
  atras debajo del menu.

  Fijo al hueco entre la cabecera y la barra de abajo, siempre tapa lo
  que tiene que tapar y se desliza solo.
*/
.mb-cajon {
  position: fixed;
  top: 72px;
  bottom: 72px;
  left: 50%;
  width: min(480px, 100%);
  transform: translateX(-50%);
  z-index: 20;

  /*
    EL QUE SE DESLIZA ES EL CAJON.

    Antes se deslizaba la barra de adentro: quedaba `absolute` contra
    el cajon y, con el menu entero midiendo mil quinientos pixeles,
    simplemente se cortaba a la mitad --en el telefono no habia forma
    de llegar a "Afiliados" ni al selector de idioma.

    `overscroll-behavior: contain` es para que al llegar al final no
    empiece a moverse la pagina de atras.
  */
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }

  @include en-escritorio { display: none; }
}

/* El velo NO se desliza con el menu: tapa siempre lo mismo. */
.mb-cajon__fondo {
  position: fixed;
  top: 72px;
  bottom: 72px;
  left: 0;
  right: 0;
  border: 0;
  background: rgba(4, 9, 20, .7);
  cursor: pointer;
}

/* ── El cartel que avisa ──────────────────────────────────────────── */

.mb-aviso {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 300;
  max-width: 340px;
  padding: 14px 18px;
  border: 2px solid #fff;
  border-radius: 14px;
  background: #12213a;
  color: #fff;
  font-weight: 700;
  box-shadow: 0 14px 34px rgba(0, 0, 0, .5);

  &--error { border-color: #ff5b6b; color: #ff9aa5; }

  /* En celular sube por encima de la barra de abajo: si no, el cartel
     queda justo debajo de los cinco botones y no se lee. */
  @include en-celular { right: 12px; left: 12px; bottom: 84px; max-width: none; }
}
</style>
