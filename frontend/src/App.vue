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
      @depositar="avisarPendiente('wallet.depositSoon')"
      @retirar="avisarPendiente('wallet.withdrawSoon')"
      @canjear="avisarPendiente('wallet.redeemSoon')"
      @soporte="avisarPendiente('support.soon')"
    />

    <!--
      El cuerpo: barra lateral y contenido, uno al lado del otro. La
      cabecera va ARRIBA de los dos porque su degradé azul tiene que
      cruzar todo el ancho, como en el diseño.
    -->
    <div class="mb-cuerpo">
      <MbLateral />
      <main class="mb-contenido">
        <router-view />
      </main>
    </div>

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

/**
 * EL ARMAZON DEL SITIO.
 *
 * Cabecera arriba --su degradé azul tiene que cruzar todo el ancho--,
 * barra lateral y contenido abajo, uno al lado del otro.
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
  components: { MbCabecera, MbLateral },

  computed: {
    ...mapState(["aviso"]),

    /** Las pantallas que se dibujan solas, sin cabecera ni lateral. */
    sinArmazon() {
      return ["signup", "login"].includes(this.$route.name);
    },
  },

  methods: {
    /* Lo que todavía no está: se avisa, en vez de un botón mudo. */
    avisarPendiente(clave) {
      this.$store.dispatch("avisar", { texto: this.$t(clave) });
    },
  },
};
</script>

<style lang="scss">
@import "@/styles/tokens";

.mb-app { min-height: 100vh; background: $fondo; }

.mb-cuerpo {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
}

.mb-contenido {
  flex: 999 1 560px;
  min-width: 0;
  box-sizing: border-box;
  padding: 20px 24px 64px;
  @include en-celular { padding: 16px 14px 48px; }
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
}
</style>
