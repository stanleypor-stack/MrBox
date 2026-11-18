<template>
  <header class="mb-head">
    <div class="mb-head__fila">
      <!-- ── El logo ──────────────────────────────────────────────── -->
      <router-link to="/" aria-label="MR BOX" class="mb-head__logo">
        <svg width="240" height="62" viewBox="0 0 1000 260" role="img" aria-label="MR BOX">
          <defs>
            <linearGradient id="hd2F" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#ffffff" />
              <stop offset=".55" stop-color="#e3eeff" />
              <stop offset="1" stop-color="#9fc3f7" />
            </linearGradient>
            <text
              id="hd2W" x="490" y="190" text-anchor="middle"
              font-family="Titan One, sans-serif" font-size="176"
              letter-spacing="-4" transform="skewX(-7) translate(22 0)"
            >MR BOX</text>
            <clipPath id="hd2C"><rect x="0" y="40" width="1100" height="78" /></clipPath>
          </defs>
          <!-- Las nueve capas que le dan el relieve. Van de la sombra
               mas honda a la cara, cada una un poco mas clara. -->
          <use href="#hd2W" transform="translate(16 18)" fill="#06143a" stroke="#06143a" stroke-width="22" stroke-linejoin="round" opacity=".55" />
          <use href="#hd2W" transform="translate(14 14)" fill="#0b2266" stroke="#0b2266" stroke-width="16" stroke-linejoin="round" />
          <use href="#hd2W" transform="translate(14 14)" fill="#123a9e" stroke="#123a9e" stroke-width="12" stroke-linejoin="round" />
          <use href="#hd2W" transform="translate(12 12)" fill="#1a4fc0" stroke="#1a4fc0" stroke-width="12" stroke-linejoin="round" />
          <use href="#hd2W" transform="translate(10 10)" fill="#2260d6" stroke="#2260d6" stroke-width="12" stroke-linejoin="round" />
          <use href="#hd2W" transform="translate(8 8)" fill="#2a6fe6" stroke="#2a6fe6" stroke-width="12" stroke-linejoin="round" />
          <use href="#hd2W" transform="translate(6 6)" fill="#3a80f0" stroke="#3a80f0" stroke-width="12" stroke-linejoin="round" />
          <use href="#hd2W" transform="translate(4 4)" fill="#4a8ff5" stroke="#4a8ff5" stroke-width="12" stroke-linejoin="round" />
          <use href="#hd2W" fill="none" stroke="#0b2266" stroke-width="10" stroke-linejoin="round" />
          <use href="#hd2W" fill="url(#hd2F)" />
          <use href="#hd2W" fill="#ffffff" opacity=".55" clip-path="url(#hd2C)" />
        </svg>

        <!--
          EL LOGO DE CELULAR: "MR" ARRIBA DE "BOX".

          A 375px de ancho, el logo de una linea ocupa la mitad de la
          cabecera y no queda lugar para la billetera. Apilado mide 70
          de ancho en vez de 240 y se lee igual de bien.

          Son dos SVG y no uno escalado porque las dos formas son
          distintas de verdad: la de dos renglones tiene su propio
          recorte de brillo, no es la otra achicada.
        -->
        <svg class="mb-head__logo--celu" width="70" height="55" viewBox="0 0 560 440" role="img" aria-label="MR BOX">
          <defs>
            <linearGradient id="hm3F" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#ffffff" />
              <stop offset=".55" stop-color="#e3eeff" />
              <stop offset="1" stop-color="#9fc3f7" />
            </linearGradient>
            <g
              id="hm3W" font-family="Titan One, sans-serif" font-size="200"
              text-anchor="middle" letter-spacing="-4" transform="skewX(-7) translate(36 0)"
            >
              <text x="270" y="200">MR</text>
              <text x="270" y="400">BOX</text>
            </g>
            <clipPath id="hm3C">
              <rect x="0" y="40" width="600" height="80" />
              <rect x="0" y="240" width="600" height="80" />
            </clipPath>
          </defs>
          <use href="#hm3W" transform="translate(16 18)" fill="#06143a" stroke="#06143a" stroke-width="22" stroke-linejoin="round" opacity=".55" />
          <use href="#hm3W" transform="translate(14 14)" fill="#0b2266" stroke="#0b2266" stroke-width="16" stroke-linejoin="round" />
          <use href="#hm3W" transform="translate(14 14)" fill="#123a9e" stroke="#123a9e" stroke-width="12" stroke-linejoin="round" />
          <use href="#hm3W" transform="translate(12 12)" fill="#1a4fc0" stroke="#1a4fc0" stroke-width="12" stroke-linejoin="round" />
          <use href="#hm3W" transform="translate(10 10)" fill="#2260d6" stroke="#2260d6" stroke-width="12" stroke-linejoin="round" />
          <use href="#hm3W" transform="translate(8 8)" fill="#2a6fe6" stroke="#2a6fe6" stroke-width="12" stroke-linejoin="round" />
          <use href="#hm3W" transform="translate(6 6)" fill="#3a80f0" stroke="#3a80f0" stroke-width="12" stroke-linejoin="round" />
          <use href="#hm3W" transform="translate(4 4)" fill="#4a8ff5" stroke="#4a8ff5" stroke-width="12" stroke-linejoin="round" />
          <use href="#hm3W" fill="none" stroke="#0b2266" stroke-width="10" stroke-linejoin="round" />
          <use href="#hm3W" fill="url(#hm3F)" />
          <use href="#hm3W" fill="#ffffff" opacity=".55" clip-path="url(#hm3C)" />
        </svg>
      </router-link>

      <!-- ── La billetera ─────────────────────────────────────────── -->
      <div class="mb-head__centro">
        <div class="mb-wallet" v-click-fuera="cerrarWallet">
          <button
            type="button" class="mb-wallet__saldo"
            :aria-expanded="walletAbierta ? 'true' : 'false'" aria-label="Wallet"
            @click="walletAbierta = !walletAbierta"
          >
            <span class="mb-sc mb-sc--20" aria-hidden="true">SC</span>{{ plata(saldo) }}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c9d7f7"
                 stroke-width="2.6" stroke-linecap="round" aria-hidden="true">
              <path :d="walletAbierta ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'" />
            </svg>
          </button>

          <button
            type="button" class="mb-wallet__mas" aria-label="Deposit"
            @click="$emit('depositar')"
          >
            <span class="mb-wallet__brillo" aria-hidden="true"></span>
            <svg style="position: relative" width="16" height="16" viewBox="0 0 24 24"
                 fill="none" stroke="#ffffff" stroke-width="3.2" stroke-linecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>

          <div v-if="walletAbierta" role="dialog" aria-label="Wallet" class="mb-wallet__panel">
            <div class="mb-wallet__total">
              <span class="mb-wallet__rotulo">{{ $t('wallet.total') }}</span>
              <span class="mb-wallet__cifra">
                <span class="mb-sc mb-sc--26" aria-hidden="true">SC</span>{{ plata(total) }}
              </span>
            </div>

            <div class="mb-wallet__acciones">
              <button type="button" class="mb-wallet__accion" @click="$emit('depositar')">
                <span class="mb-wallet__icono">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff"
                       stroke-width="2.4" stroke-linecap="round" aria-hidden="true">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </span>{{ $t('action.deposit') }}
              </button>
              <button type="button" class="mb-wallet__accion" @click="$emit('retirar')">
                <span class="mb-wallet__icono">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff"
                       stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M12 5v14M6 13l6 6 6-6" />
                  </svg>
                </span>{{ $t('wallet.withdraw') }}
              </button>
              <button type="button" class="mb-wallet__accion" @click="$emit('canjear')">
                <span class="mb-wallet__icono">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff"
                       stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M3 12V4h8l10 10-8 8zM7.5 7.5h.01" />
                  </svg>
                </span>{{ $t('wallet.redeem') }}
              </button>
            </div>

            <div class="mb-wallet__lista">
              <router-link to="/profile" class="mb-wallet__linea" @click.native="walletAbierta = false">
                <span class="mb-wallet__linea-izq">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#a9bbe6" aria-hidden="true">
                    <path d="M3 7a2 2 0 0 1 2-2h13v4h3v10H5a2 2 0 0 1-2-2z" />
                  </svg>{{ $t('common.balance') }}
                </span>
                <span class="mb-wallet__linea-der">
                  <span class="mb-sc mb-sc--16" aria-hidden="true">SC</span>{{ plata(saldo) }}
                </span>
              </router-link>

              <router-link to="/inventory" class="mb-wallet__linea" @click.native="walletAbierta = false">
                <span class="mb-wallet__linea-izq">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#a9bbe6" aria-hidden="true">
                    <path d="M4 8h16v12H4zM2 4h20v4H2z" />
                  </svg>{{ $t('wallet.items') }}
                  <span class="mb-wallet__cuenta">{{ inventario.cuantos }}</span>
                </span>
                <span class="mb-wallet__linea-der">
                  <span class="mb-sc mb-sc--16" aria-hidden="true">SC</span>{{ plata(inventario.valorSc) }}
                </span>
              </router-link>

              <div class="mb-wallet__linea mb-wallet__linea--quieta">
                <span class="mb-wallet__linea-izq">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#a9bbe6" aria-hidden="true">
                    <path d="M3 13h8v8H3zM13 13h8v8h-8zM8 3h8v8H8z" />
                  </svg>{{ $t('nav.boxes') }}
                </span>
                <span class="mb-wallet__linea-der mb-wallet__linea-der--sola">{{ aperturasGratis }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ── La derecha ───────────────────────────────────────────── -->
      <div class="mb-head__der">
        <router-link to="/boxes" class="mb-redondo" :aria-label="$t('action.search')">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff"
               stroke-width="2.6" stroke-linecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
          </svg>
        </router-link>

        <div class="mb-iconos" v-click-fuera="cerrarAvisos">
          <div class="mb-iconos__caja">
            <button
              type="button" :aria-label="$t('header.notifications')"
              :aria-expanded="avisosAbiertos ? 'true' : 'false'"
              class="mb-iconos__b" :class="{ 'is-on': avisosAbiertos }"
              @click="avisosAbiertos = !avisosAbiertos"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
                <path d="M12 2a1.6 1.6 0 0 0-1.6 1.6v.6A6.5 6.5 0 0 0 5.5 10.6V15l-1.8 2.3c-.4.5 0 1.2.6 1.2h15.4c.6 0 1-.7.6-1.2L18.5 15v-4.4a6.5 6.5 0 0 0-4.9-6.4v-.6A1.6 1.6 0 0 0 12 2zm-2.6 18a2.6 2.6 0 0 0 5.2 0z" />
              </svg>
            </button>
            <span class="mb-iconos__raya" aria-hidden="true"></span>
            <router-link to="/profile" class="mb-iconos__b" :aria-label="$t('nav.rewards')">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
                <path d="M20.5 7h-2.4c.3-.5.4-1 .4-1.5A3.5 3.5 0 0 0 12 3.4 3.5 3.5 0 0 0 5.5 5.5c0 .5.1 1 .4 1.5H3.5A1.5 1.5 0 0 0 2 8.5v2A1.5 1.5 0 0 0 3.5 12H11V7h2v5h7.5a1.5 1.5 0 0 0 1.5-1.5v-2A1.5 1.5 0 0 0 20.5 7zM9 7a1.5 1.5 0 1 1 0-3c1.2 0 1.8 1.7 2 3zm6 0h-2c.2-1.3.8-3 2-3a1.5 1.5 0 1 1 0 3zM3.5 13.5V20A2 2 0 0 0 5.5 22H11v-8.5zM13 22h5.5a2 2 0 0 0 2-2v-6.5H13z" />
              </svg>
            </router-link>
            <span class="mb-iconos__raya" aria-hidden="true"></span>
            <router-link to="/inventory" class="mb-iconos__b" :aria-label="$t('nav.inventory')">
              <svg width="19" height="17" viewBox="0 0 26 22" fill="#fff" aria-hidden="true">
                <path d="M3 9h20v10.5A1.5 1.5 0 0 1 21.5 21h-17A1.5 1.5 0 0 1 3 19.5zM1 5.5 7 2l6 3.5L7 9zM25 5.5 19 2l-6 3.5L19 9zM10 12.5h6v2h-6z" />
              </svg>
            </router-link>
          </div>

          <div v-if="avisosAbiertos" role="dialog" :aria-label="$t('header.notifications')" class="mb-avisos">
            <div class="mb-avisos__cabeza">
              <span class="mb-avisos__titulo">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff"
                     stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0" />
                </svg>{{ $t('header.notifications') }}
              </span>
              <button type="button" class="mb-avisos__cerrar" :aria-label="$t('common.close')"
                      @click="avisosAbiertos = false">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff"
                     stroke-width="3" stroke-linecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
            <div class="mb-avisos__vacio">{{ $t('header.allCaughtUp') }}</div>
          </div>
        </div>

        <!-- ── La cuenta ──────────────────────────────────────────── -->
        <div class="mb-cuenta" v-click-fuera="cerrarCuenta">
          <button
            v-if="entro" type="button" class="mb-cuenta__b"
            :aria-expanded="cuentaAbierta ? 'true' : 'false'" :aria-label="$t('header.account')"
            @click="cuentaAbierta = !cuentaAbierta"
          >
            <span class="mb-cuenta__avatar">{{ inicial }}</span>
            <span class="mb-cuenta__datos">
              <span class="mb-cuenta__nombre">{{ usuario.username }}</span>
              <!-- La barra de progreso al rango siguiente. -->
              <span class="mb-cuenta__xp"><span :style="{ width: xpPct }"></span></span>
            </span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c9d7f7"
                 stroke-width="2.6" stroke-linecap="round" aria-hidden="true">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>

          <div v-else class="mb-cuenta__entrar">
            <router-link to="/login" class="mb-entrar">{{ $t('action.signIn') }}</router-link>
            <router-link to="/signup" class="mb-entrar mb-entrar--fuerte">{{ $t('action.signUp') }}</router-link>
          </div>

          <div v-if="cuentaAbierta && entro" role="menu" :aria-label="$t('header.account')" class="mb-menu">
            <div class="mb-menu__grupo">
              <router-link
                v-for="m in menuCuenta" :key="m.a" :to="m.a" role="menuitem"
                class="mb-menu__item" @click.native="cuentaAbierta = false"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c9d7f7"
                     stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path :d="m.icono" />
                </svg>{{ $t(m.texto) }}
              </router-link>
            </div>
            <button type="button" role="menuitem" class="mb-menu__pie" @click="$emit('soporte')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c9d7f7"
                   stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
                <path d="M4 14v-2a8 8 0 0 1 16 0v2M4 14h3v6H4zM17 14h3v6h-3z" />
              </svg>{{ $t('support.title') }}
            </button>
            <button type="button" role="menuitem" class="mb-menu__pie" @click="salir">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c9d7f7"
                   stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" />
              </svg>{{ $t('action.logOut') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>

<script>
import { mapState, mapGetters } from "vuex";
import api from "@/api";

/**
 * LA CABECERA DEL DISENO.
 *
 * Portada del prototipo del dueno, capa por capa: el degradé azul que
 * cae hasta el fondo de la página, el logo en nueve capas, la píldora de
 * la billetera con el botón de depositar, los tres redondos y el menú de
 * la cuenta con su barra de progreso.
 *
 * Los estilos están en una hoja aparte y no en línea como el prototipo,
 * pero los VALORES son los mismos. El prototipo los tenía en línea
 * porque el editor de diseño los edita ahí; acá no hace falta y leerlos
 * agrupados es mucho más fácil.
 */
export default {
  name: "MbCabecera",

  directives: {
    /*
      Cerrar al tocar afuera. Los tres desplegables de la cabecera lo
      necesitan, así que es una directiva y no tres copias del mismo
      oyente. Se limpia sola al desmontarse: un oyente en `document` que
      queda vivo es una pérdida de memoria de las que no avisan.
    */
    "click-fuera": {
      bind(el, binding) {
        el.__fuera = (e) => { if (!el.contains(e.target)) binding.value(); };
        document.addEventListener("click", el.__fuera);
      },
      unbind(el) {
        document.removeEventListener("click", el.__fuera);
      },
    },
  },

  data() {
    return {
      walletAbierta: false,
      avisosAbiertos: false,
      cuentaAbierta: false,
      inventario: { cuantos: 0, valorSc: 0 },
      menuCuenta: [
        { a: "/profile", texto: "nav.profile", icono: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a6 6 0 0 1 12 0M17 11a2.5 2.5 0 1 0 0-5M16 14.5a5 5 0 0 1 5 5.5" },
        { a: "/inventory", texto: "nav.inventory", icono: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" },
      ],
    };
  },

  computed: {
    ...mapState(["usuario", "abierto"]),
    ...mapGetters(["entro", "saldo", "aperturasGratis"]),

    inicial() {
      return (this.usuario && this.usuario.username || "?").charAt(0).toUpperCase();
    },

    /** Saldo más lo que vale el inventario: lo que de verdad tiene. */
    total() {
      return Math.round((this.saldo + this.inventario.valorSc) * 100) / 100;
    },

    /**
     * La barra de progreso.
     *
     * Por ahora mide contra SC 25.000, que es donde empieza el segundo
     * rango. Cuando estén los nueve rangos sale del rango de verdad.
     */
    xpPct() {
      const jugado = (this.usuario && this.usuario.jugadoSc) || 0;
      return Math.max(6, Math.min(100, (jugado / 25000) * 100)).toFixed(1) + "%";
    },
  },

  watch: {
    /* Al entrar o salir, el inventario del encabezado cambia. */
    entro: "traerInventario",
  },

  watch: {
    /*
      LA BILLETERA LA PUEDE ABRIR LA BARRA DE ABAJO.

      En celular, el tercer boton de la barra abre esta misma billetera.
      Son dos componentes hermanos que no se ven, asi que la bandera
      vive en el estado compartido y cada uno la mira.
    */
    "abierto.wallet": function (v) { this.walletAbierta = v; },
  },

  methods: {
    plata(n) {
      return Number(n || 0).toLocaleString("en-US", {
        minimumFractionDigits: 2, maximumFractionDigits: 2,
      });
    },

    cerrarWallet() {
      this.walletAbierta = false;
      if (this.abierto.wallet) this.$store.commit("abrir", null);
    },
    cerrarAvisos() { this.avisosAbiertos = false; },
    cerrarCuenta() { this.cuentaAbierta = false; },

    async traerInventario() {
      if (!this.entro) {
        this.inventario = { cuantos: 0, valorSc: 0 };
        return;
      }
      try {
        const { data } = await api.get("/inventory", { params: { perPage: 1 } });
        this.inventario = data.data.resumen;
      } catch {
        /* El encabezado no puede romperse porque el inventario no
           contestó: se queda en cero y listo. */
      }
    },

    salir() {
      this.cuentaAbierta = false;
      this.$store.dispatch("salir");
      if (this.$route.path !== "/") this.$router.push("/");
    },
  },

  created() { this.traerInventario(); },
};
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

/* ── El marco ─────────────────────────────────────────────────────── */

.mb-head {
  position: relative;
  z-index: 30;
  // El degradé del diseño: azul fuerte arriba que cae al fondo de la
  // página. Es lo que le da el aire de portada.
  background: radial-gradient(ellipse 50% 170% at 50% 0%, #3a8dff 0%, #1d5fd0 32%, #0f2c66 66%, #0b1424 100%);
}

.mb-head__fila {
  padding: 10px 20px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 12px;

  /*
    EN CELULAR ES UNA SOLA FILA.

    Logo, billetera y dos botones, como el diseno de celular. La
    grilla de tres columnas del escritorio ahi no entra: la billetera
    terminaba en un segundo renglon y el boton de entrar se iba de la
    pantalla.
  */
  @include en-celular {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
  }
}

.mb-head__logo {
  display: flex;
  align-items: center;
  @include foco;
  flex: none;
  svg { width: 240px; height: 62px; }
  .mb-head__logo--celu { display: none; width: 70px; height: 55px; }

  @include en-celular {
    svg { display: none; }
    .mb-head__logo--celu { display: block; }
  }
}

.mb-head__centro {
  margin: 0 auto;
  /* En celular la billetera se estira y ocupa el hueco del medio. */
  @include en-celular { flex: 1; min-width: 0; margin: 0; }
}

.mb-head__der {
  display: flex;
  align-items: center;
  gap: 10px;
  justify-self: end;
  @include en-celular { gap: 8px; }
}

/*
  LO QUE NO VA EN LA CABECERA DE CELULAR.

  El buscador, la chapa de la cuenta y los botones de entrar y
  registrarse. No es que sobren: estan abajo, en la barra de cinco
  botones, que es donde llega el pulgar. Tenerlos dos veces solo
  empujaba la billetera a un segundo renglon.
*/
@include en-celular {
  .mb-head__der > .mb-redondo,
  .mb-cuenta { display: none; }

  /*
    LOS ICONOS, SUELTOS Y CUADRADOS.

    En escritorio los tres viven dentro de una pastilla con borde
    blanco. A 375px esa pastilla no entra al lado de la billetera, asi
    que se desarma en botones de 38 como en el diseno de celular.
  */
  .mb-iconos__caja {
    border: 0;
    background: transparent;
    padding: 0;
    gap: 8px;
    height: auto;
  }

  .mb-iconos__raya { display: none; }

  .mb-iconos__b {
    width: 38px;
    height: 38px;
    border-radius: 10px;
    background: #16253f;
  }
}

/* ── La billetera ─────────────────────────────────────────────────── */

.mb-wallet {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 46px;
  padding: 0 5px 0 14px;
  border-radius: 23px;
  background: #0a1630;
  border: 2px solid #1d3a70;
  box-shadow: 0 6px 18px rgba(0, 0, 0, .35);
}

.mb-wallet__saldo {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #fff;
  font-family: inherit;
  font-weight: 900;
  font-size: 16px;
  cursor: pointer;
  @include foco;
}

.mb-wallet__mas {
  position: relative;
  overflow: hidden;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 3px solid #fff;
  background: radial-gradient(circle at 50% 28%, #9fd2ff 0%, #4a94f5 42%, #1f4fc6 100%);
  box-shadow: 0 0 0 2px #1c4fc4, 0 4px 14px rgba(63, 124, 240, .65);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  @include foco;
}

// El reflejo del botón, que es lo que lo hace parecer una pelotita.
.mb-wallet__brillo {
  position: absolute;
  left: 22%;
  top: 8%;
  width: 46%;
  height: 30%;
  border-radius: 50%;
  background: rgba(255, 255, 255, .55);
  transform: rotate(-18deg);
}

.mb-wallet__panel {
  position: absolute;
  left: 50%;
  top: 54px;
  transform: translateX(-50%);
  z-index: 50;
  width: min(320px, 92vw);
  box-sizing: border-box;
  padding: 18px;
  border-radius: 22px;
  border: 2px solid #fff;
  background: #12213a;
  box-shadow: 0 20px 50px rgba(0, 0, 0, .55);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.mb-wallet__total { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.mb-wallet__rotulo { font-size: 13px; color: #a9bbe6; }
.mb-wallet__cifra { display: flex; align-items: center; gap: 8px; font-weight: 900; font-size: 32px; }

.mb-wallet__acciones { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }

.mb-wallet__accion {
  border: 0;
  background: transparent;
  color: #fff;
  font-family: inherit;
  font-weight: 800;
  font-size: 13px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  @include foco;
}

.mb-wallet__icono {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: #1d3354;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mb-wallet__lista {
  border-radius: 16px;
  background: #0e1a2e;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.mb-wallet__linea {
  height: 46px;
  padding: 0 14px;
  border-radius: 12px;
  background: #16253f;
  color: #fff;
  font-weight: 800;
  font-size: 15px;
  text-decoration: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  @include foco;

  &:hover { color: #fff; background: #1d3354; }
  &--quieta { cursor: default; &:hover { background: #16253f; } }
}

.mb-wallet__linea-izq { display: flex; align-items: center; gap: 10px; }
.mb-wallet__linea-der { display: flex; align-items: center; gap: 6px; font-weight: 900; }
.mb-wallet__linea-der--sola { gap: 0; }
.mb-wallet__cuenta { color: #8ea3c7; }

/* ── Los redondos ─────────────────────────────────────────────────── */

.mb-redondo {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  border: 2px solid #fff;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  @include foco;
  @include en-celular { display: none; }
}

.mb-iconos { position: relative; }

.mb-iconos__caja {
  display: flex;
  align-items: center;
  height: 46px;
  padding: 3px;
  box-sizing: border-box;
  border-radius: 23px;
  border: 2px solid #fff;
  background: #0b1424;
}

.mb-iconos__b {
  width: 46px;
  height: 36px;
  border: 0;
  border-radius: 18px;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  @include foco;

  &.is-on { background: #1d3354; }
  &:hover { background: #16294a; }
}

.mb-iconos__raya { width: 1px; height: 20px; background: #3a5687; }

.mb-avisos {
  position: absolute;
  right: 0;
  top: 56px;
  z-index: 60;
  width: 330px;
  height: 430px;
  box-sizing: border-box;
  border-radius: 22px;
  border: 2px solid #fff;
  background: #0e2448;
  box-shadow: 0 20px 50px rgba(0, 0, 0, .55);
  display: flex;
  flex-direction: column;
}

.mb-avisos__cabeza {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
}

.mb-avisos__titulo { display: flex; align-items: center; gap: 8px; font-weight: 900; font-size: 16px; }

.mb-avisos__cerrar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 0;
  background: #16294a;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  @include foco;
}

.mb-avisos__vacio {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #8ea3c7;
  font-weight: 700;
  font-size: 14px;
}

/* ── La cuenta ────────────────────────────────────────────────────── */

.mb-cuenta { position: relative; }

.mb-cuenta__b {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 52px;
  padding: 0 12px 0 6px;
  border-radius: 26px;
  border: 0;
  background: #0b1424;
  color: #fff;
  font-family: inherit;
  cursor: pointer;
  @include foco;
}

.mb-cuenta__avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #2f6fe0;
  border: 2px solid #c9d7f7;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: $fuente-cartel;
  font-size: 18px;
}

.mb-cuenta__datos {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  @include en-celular { display: none; }
}

.mb-cuenta__nombre { font-weight: 800; font-size: 14px; }

.mb-cuenta__xp {
  width: 70px;
  height: 4px;
  border-radius: 2px;
  background: #22385c;
  overflow: hidden;
  span { display: block; min-width: 6%; height: 100%; background: #fff; }
}

.mb-cuenta__entrar { display: flex; gap: 8px; }

.mb-entrar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 46px;
  padding: 0 16px;
  text-decoration: none;
  border-radius: 23px;
  border: 2px solid #fff;
  background: transparent;
  color: #fff;
  font-family: inherit;
  font-weight: 900;
  font-size: 14px;
  cursor: pointer;
  white-space: nowrap;
  @include foco;

  &:hover { background: rgba(255, 255, 255, .12); }

  &--fuerte {
    background: #fff;
    color: $azul-tinta;
    &:hover { background: #e3eeff; }
  }
}

.mb-menu {
  position: absolute;
  right: 0;
  top: 60px;
  z-index: 70;
  width: 210px;
  box-sizing: border-box;
  padding: 8px;
  border-radius: 18px;
  border: 2px solid #fff;
  background: #0e2448;
  box-shadow: 0 20px 50px rgba(0, 0, 0, .55);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.mb-menu__grupo {
  border-radius: 12px;
  background: #12305e;
  padding: 4px;
  display: flex;
  flex-direction: column;
}

.mb-menu__item {
  height: 40px;
  padding: 0 10px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: #fff;
  font-family: inherit;
  font-weight: 800;
  font-size: 14px;
  text-decoration: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  @include foco;
  &:hover { background: #1b4287; color: #fff; }
}

.mb-menu__pie {
  height: 44px;
  padding: 0 14px;
  border: 0;
  border-radius: 12px;
  background: #12305e;
  color: #fff;
  font-family: inherit;
  font-weight: 800;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  @include foco;
  &:hover { background: #1b4287; }
}
</style>
