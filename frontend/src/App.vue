<template>
  <div class="mb-app">
    <nav class="mb-side" :aria-label="$t('nav.boxes')">
      <router-link to="/boxes" class="mb-side__logo" :aria-label="'MR BOX'">
        <svg viewBox="0 0 1000 260" role="img" aria-label="MR BOX" class="mb-logo">
          <defs>
            <linearGradient id="mbCara" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#ffffff" />
              <stop offset="1" stop-color="#b9cff5" />
            </linearGradient>
            <text
              id="mbPalabra" x="490" y="185" text-anchor="middle"
              font-family="Titan One, sans-serif" font-size="170"
              letter-spacing="2" transform="skewX(-8) translate(26 0)"
            >MR BOX</text>
          </defs>
          <use href="#mbPalabra" transform="translate(16 16)" fill="#0b2266" stroke="#0b2266" stroke-width="10" stroke-linejoin="round" />
          <use href="#mbPalabra" transform="translate(5 5)" fill="#2c66dc" stroke="#2c66dc" stroke-width="14" stroke-linejoin="round" />
          <use href="#mbPalabra" transform="translate(10 10)" fill="#2c66dc" stroke="#2c66dc" stroke-width="14" stroke-linejoin="round" />
          <use href="#mbPalabra" fill="none" stroke="#0b2266" stroke-width="7" stroke-linejoin="round" />
          <use href="#mbPalabra" fill="url(#mbCara)" />
        </svg>
      </router-link>

      <ul class="mb-side__menu">
        <li v-for="item in menu" :key="item.clave">
          <router-link :to="item.a" class="mb-side__item" active-class="is-activo">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path :d="item.icono" />
            </svg>
            <span>{{ $t('nav.' + item.clave) }}</span>
          </router-link>
        </li>
      </ul>

      <div class="mb-side__pie">
        <MbSelectorDeIdioma />
      </div>
    </nav>

    <div class="mb-main">
      <header class="mb-head">
        <span v-if="entro" class="mb-saldo">
          <span class="mb-sc" aria-hidden="true">SC</span>
          <b>{{ plata(saldo) }}</b>
          <!-- Las aperturas de REGALO, que no son la demo: la demo no da
               nada y esto si. Decirles "demo" confunde justo donde no
               conviene. -->
          <span v-if="aperturasGratis" class="mb-gratis">
            +{{ aperturasGratis }} {{ $t('common.freeOpens') }}
          </span>
        </span>

        <span class="mb-head__espacio"></span>

        <template v-if="cargandoUsuario">
          <span class="mb-tenue">{{ $t('common.loading') }}</span>
        </template>

        <template v-else-if="entro">
          <router-link to="/profile" class="mb-usuario">{{ usuario.username }}</router-link>
          <button type="button" class="mb-boton" @click="salir">{{ $t('action.logOut') }}</button>
        </template>

        <template v-else>
          <button type="button" class="mb-boton" @click="abrirEntrada('login')">
            {{ $t('action.signIn') }}
          </button>
          <button type="button" class="mb-boton mb-boton--primario" @click="abrirEntrada('register')">
            {{ $t('action.signUp') }}
          </button>
        </template>
      </header>

      <main class="mb-cuerpo">
        <router-view />
      </main>
    </div>

    <!-- ── Entrar / Registrarse ──────────────────────────────────── -->
    <div v-if="entrada" class="mb-modal" role="dialog" aria-modal="true" :aria-label="tituloEntrada">
      <form class="mb-modal__caja" @submit.prevent="enviarEntrada">
        <h2 class="mb-modal__titulo">{{ tituloEntrada }}</h2>

        <label v-if="entrada === 'register'" class="mb-campo">
          <span>{{ $t('profile.code') }}</span>
          <input v-model="form.username" type="text" autocomplete="username" required>
        </label>

        <label class="mb-campo">
          <span>Email</span>
          <input v-model="form.email" type="email" autocomplete="email" required>
        </label>

        <label class="mb-campo">
          <span>{{ entrada === 'register' ? $t('action.signUp') : $t('action.signIn') }}</span>
          <input
            v-model="form.password" type="password" required
            :autocomplete="entrada === 'register' ? 'new-password' : 'current-password'"
          >
        </label>

        <label v-if="entrada === 'register'" class="mb-campo">
          <span>{{ $t('profile.code') }} ({{ $t('profile.affiliate') }})</span>
          <input v-model="form.affiliateCode" type="text" autocomplete="off">
        </label>

        <!--
          EL CAPTCHA.

          El widget de Cloudflare se dibuja acá cuando hay clave
          configurada. Sin clave --desarrollo-- no aparece y el servidor
          tampoco lo exige, así que el proyecto se puede levantar sin
          tener cuenta de Cloudflare.
        -->
        <div v-if="sitioCaptcha" ref="captcha" class="mb-captcha"></div>

        <p v-if="errorEntrada" class="mb-error">{{ errorEntrada }}</p>

        <div class="mb-modal__acciones">
          <button type="submit" class="mb-boton mb-boton--primario" :disabled="enviando">
            {{ tituloEntrada }}
          </button>
          <button type="button" class="mb-boton" @click="entrada = null">
            {{ $t('action.cancel') }}
          </button>
        </div>

        <button type="button" class="mb-enlace" @click="alternarEntrada">
          {{ entrada === 'login' ? $t('action.signUp') : $t('action.signIn') }}
        </button>
      </form>
    </div>

    <!-- ── El cartel ─────────────────────────────────────────────── -->
    <output v-if="aviso" class="mb-aviso" :class="'mb-aviso--' + aviso.tono" aria-live="polite">
      {{ aviso.texto }}
    </output>
  </div>
</template>

<script>
import { mapState, mapGetters } from "vuex";
import MbSelectorDeIdioma from "@/components/MbSelectorDeIdioma.vue";

export default {
  name: "App",
  components: { MbSelectorDeIdioma },

  data() {
    return {
      entrada: null,
      enviando: false,
      errorEntrada: "",
      form: { username: "", email: "", password: "", affiliateCode: "" },
      sitioCaptcha: process.env.VUE_APP_TURNSTILE_SITE_KEY || "",
      widgetCaptcha: null,

      menu: [
        { clave: "boxes", a: "/boxes", icono: "M12 2.5 21 7v10l-9 4.5L3 17V7zM3 7l9 4.5L21 7M12 11.5v10" },
        { clave: "inventory", a: "/inventory", icono: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" },
        { clave: "profile", a: "/profile", icono: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a6 6 0 0 1 12 0M17 11a2.5 2.5 0 1 0 0-5M16 14.5a5 5 0 0 1 5 5.5" },
      ],
    };
  },

  computed: {
    ...mapState(["usuario", "cargandoUsuario", "aviso"]),
    ...mapGetters(["entro", "saldo", "aperturasGratis"]),
    tituloEntrada() {
      return this.entrada === "register" ? this.$t("action.signUp") : this.$t("action.signIn");
    },
  },

  methods: {
    plata(n) {
      return Number(n || 0).toLocaleString("en-US", {
        minimumFractionDigits: 2, maximumFractionDigits: 2,
      });
    },

    abrirEntrada(cual) {
      this.entrada = cual;
      this.errorEntrada = "";
      this.$nextTick(this.dibujarCaptcha);
    },

    alternarEntrada() {
      this.entrada = this.entrada === "login" ? "register" : "login";
      this.errorEntrada = "";
      this.$nextTick(this.dibujarCaptcha);
    },

    /**
     * Dibuja el widget de Turnstile.
     *
     * El script se carga una sola vez y recién cuando hace falta: quien
     * nunca abre el formulario no se baja nada de Cloudflare.
     */
    dibujarCaptcha() {
      if (!this.sitioCaptcha || !this.$refs.captcha) return;

      const pintar = () => {
        if (!window.turnstile || !this.$refs.captcha) return;
        this.$refs.captcha.innerHTML = "";
        this.widgetCaptcha = window.turnstile.render(this.$refs.captcha, {
          sitekey: this.sitioCaptcha,
          theme: "dark",
        });
      };

      if (window.turnstile) return pintar();

      if (!document.getElementById("mb-turnstile")) {
        const s = document.createElement("script");
        s.id = "mb-turnstile";
        s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        s.async = true;
        s.onload = pintar;
        document.head.appendChild(s);
      } else {
        setTimeout(pintar, 300);
      }
    },

    tokenDelCaptcha() {
      if (!this.sitioCaptcha || !window.turnstile) return "";
      try {
        return window.turnstile.getResponse(this.widgetCaptcha) || "";
      } catch {
        return "";
      }
    },

    async enviarEntrada() {
      this.enviando = true;
      this.errorEntrada = "";
      try {
        const captchaToken = this.tokenDelCaptcha();
        if (this.entrada === "register") {
          await this.$store.dispatch("registrarse", { ...this.form, captchaToken });
        } else {
          await this.$store.dispatch("entrar", {
            email: this.form.email, password: this.form.password, captchaToken,
          });
        }
        this.entrada = null;
        this.form = { username: "", email: "", password: "", affiliateCode: "" };
      } catch (err) {
        this.errorEntrada = err.textoParaElJugador;
        /* Un token de Turnstile sirve UNA vez. Si falló, hay que pedir
           otro o el siguiente intento falla aunque los datos estén bien. */
        if (this.sitioCaptcha && window.turnstile) {
          try { window.turnstile.reset(this.widgetCaptcha); } catch { /* ya no está */ }
        }
      } finally {
        this.enviando = false;
      }
    },

    salir() {
      this.$store.dispatch("salir");
      if (this.$route.path !== "/boxes") this.$router.push("/boxes");
    },
  },
};
</script>

<style lang="scss">
@import "@/styles/tokens";

.mb-app {
  min-height: 100vh;
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  background: $fondo;
}

/* ── Barra lateral ────────────────────────────────────────────────── */

.mb-side {
  flex: 1 1 248px;
  max-width: 264px;
  padding: 0 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  background: $panel;
  border-right: 1px solid $borde;

  @include en-escritorio {
    position: sticky;
    top: 0;
    height: 100vh;
    overflow-y: auto;
    align-self: flex-start;
    scrollbar-width: none;
    &::-webkit-scrollbar { display: none; }
  }

  @include en-celular {
    max-width: none;
    border-right: 0;
    border-bottom: 1px solid $borde;
  }
}

.mb-side__logo {
  height: 68px;
  display: flex;
  align-items: center;
  @include foco;
}

.mb-logo { width: 132px; height: 34px; }

.mb-side__menu {
  flex: 1;
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 2px;

  @include en-celular {
    flex-direction: row;
    overflow-x: auto;
    scrollbar-width: none;
    &::-webkit-scrollbar { display: none; }
  }
}

.mb-side__item {
  height: 40px;
  padding: 0 10px;
  display: flex;
  align-items: center;
  gap: 10px;
  border-radius: 9px;
  color: $texto-2;
  font-weight: 700;
  font-size: 14px;
  text-decoration: none;
  white-space: nowrap;
  @include foco;

  &:hover { background: $lateral-hover; color: $texto; }
  &.is-activo { background: $azul-activo; color: $texto; }
}

.mb-side__pie { @include en-celular { display: none; } }

/* ── Cabecera ─────────────────────────────────────────────────────── */

.mb-main {
  flex: 999 1 560px;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.mb-head {
  min-height: 68px;
  padding: 12px 28px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid $borde;
  @include en-celular { padding: 10px 16px; }
}

.mb-head__espacio { flex: 1; }

.mb-saldo {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 44px;
  padding: 0 14px;
  border: 1px solid $borde-fuerte;
  border-radius: $radio;
  background: $panel-alto;
  font-weight: 900;
  font-variant-numeric: tabular-nums;
}

.mb-gratis {
  padding: 2px 7px;
  border-radius: 6px;
  background: $verde;
  color: #06301d;
  font-size: 11px;
  font-weight: 900;
}

.mb-usuario {
  color: $texto-2;
  font-weight: 800;
  text-decoration: none;
  @include foco;
  &:hover { color: $texto; }
}

.mb-cuerpo { flex: 1; min-width: 0; }

/* ── Botones ──────────────────────────────────────────────────────── */

.mb-boton {
  min-height: 44px;
  padding: 0 16px;
  border: 1px solid $borde-fuerte;
  border-radius: $radio;
  background: $panel-alto;
  color: $texto;
  font-family: inherit;
  font-weight: 900;
  font-size: 14px;
  cursor: pointer;
  @include foco;

  &:hover:not(:disabled) { background: $lateral-hover; }
  &:disabled { opacity: .5; cursor: default; }

  &--primario {
    background: $azul;
    border-color: $azul;
    color: #fff;
    &:hover:not(:disabled) { background: $azul-medio; }
  }
}

/* ── Entrar / Registrarse ─────────────────────────────────────────── */

.mb-modal {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(5, 9, 17, .78);
}

.mb-modal__caja {
  width: 100%;
  max-width: 400px;
  max-height: 90vh;
  overflow-y: auto;
  padding: 24px;
  border: 1px solid $borde-fuerte;
  border-radius: $radio-panel;
  background: $panel;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.mb-modal__titulo {
  margin: 0;
  font-family: $fuente-titulo;
  font-size: 24px;
  font-weight: 400;
}

.mb-campo {
  display: flex;
  flex-direction: column;
  gap: 6px;

  span {
    color: $texto-4;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: .06em;
    text-transform: uppercase;
  }

  input {
    height: 44px;
    padding: 0 12px;
    border: 1px solid $borde-fuerte;
    border-radius: $radio;
    background: $panel-alto;
    color: $texto;
    font-family: inherit;
    font-size: 14px;
    &:focus { outline: none; border-color: $azul; }
  }
}

.mb-captcha { min-height: 65px; }

.mb-error {
  margin: 0;
  padding: 10px 12px;
  border-radius: $radio-chico;
  background: rgba(255, 154, 165, .12);
  color: $rojo;
  font-weight: 700;
  font-size: 13px;
}

.mb-modal__acciones {
  display: flex;
  gap: 10px;
  > * { flex: 1; }
}

.mb-enlace {
  border: 0;
  background: none;
  color: $enlace;
  font-family: inherit;
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
  text-decoration: underline;
  @include foco;
}

/* ── El cartel ────────────────────────────────────────────────────── */

.mb-aviso {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 300;
  max-width: 340px;
  padding: 14px 18px;
  border: 1px solid $borde-fuerte;
  border-radius: $radio;
  background: $panel-alto;
  color: $texto;
  font-weight: 700;
  box-shadow: $sombra-tarjeta;

  &--error { border-color: $rojo; color: $rojo; }
}

.mb-tenue { color: $texto-4; }

.mb-sc {
  display: inline-flex;
  flex: none;
  width: 20px;
  height: 20px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: linear-gradient($sc-verde-claro, $sc-verde);
  color: $sc-texto;
  font-weight: 900;
  font-size: 8px;
  line-height: 1;
}
</style>
