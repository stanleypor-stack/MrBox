<template>
  <div class="mb-app">
    <MbCabecera
      @entrar="abrirEntrada"
      @depositar="avisarPendiente('wallet.depositSoon')"
      @retirar="avisarPendiente('wallet.withdrawSoon')"
      @canjear="avisarPendiente('wallet.redeemSoon')"
      @soporte="avisarPendiente('support.soon')"
    />

    <!--
      El cuerpo: barra lateral y contenido, uno al lado del otro. El
      header queda ARRIBA de los dos porque su degradé azul tiene que
      cruzar todo el ancho, como en el diseño.
    -->
    <div class="mb-cuerpo">
      <MbLateral />
      <main class="mb-contenido">
        <router-view />
      </main>
    </div>

    <!-- ── Entrar / Registrarse ──────────────────────────────────── -->
    <div v-if="entrada" class="mb-modal" role="dialog" aria-modal="true" :aria-label="tituloEntrada">
      <form class="mb-modal__caja" @submit.prevent="enviarEntrada">
        <h2 class="mb-modal__titulo">{{ tituloEntrada }}</h2>

        <label v-if="entrada === 'register'" class="mb-campo">
          <span>{{ $t('auth.username') }}</span>
          <input v-model="form.username" type="text" autocomplete="username" required>
        </label>

        <label class="mb-campo">
          <span>{{ $t('auth.email') }}</span>
          <input v-model="form.email" type="email" autocomplete="email" required>
        </label>

        <label class="mb-campo">
          <span>{{ $t('auth.password') }}</span>
          <input
            v-model="form.password" type="password" required
            :autocomplete="entrada === 'register' ? 'new-password' : 'current-password'"
          >
        </label>

        <label v-if="entrada === 'register'" class="mb-campo">
          <span>{{ $t('auth.referralCode') }}</span>
          <input v-model="form.affiliateCode" type="text" autocomplete="off">
        </label>

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

    <output v-if="aviso" class="mb-aviso" :class="'mb-aviso--' + aviso.tono" aria-live="polite">
      {{ aviso.texto }}
    </output>
  </div>
</template>

<script>
import { mapState } from "vuex";
import MbCabecera from "@/components/MbCabecera.vue";
import MbLateral from "@/components/MbLateral.vue";

export default {
  name: "App",
  components: { MbCabecera, MbLateral },

  data() {
    return {
      entrada: null,
      enviando: false,
      errorEntrada: "",
      form: { username: "", email: "", password: "", affiliateCode: "" },
      sitioCaptcha: process.env.VUE_APP_TURNSTILE_SITE_KEY || "",
      widgetCaptcha: null,
    };
  },

  computed: {
    ...mapState(["aviso"]),
    tituloEntrada() {
      return this.entrada === "register" ? this.$t("action.signUp") : this.$t("action.signIn");
    },
  },

  methods: {
    /* Lo que todavía no está: se dice, en vez de un botón que no hace nada. */
    avisarPendiente(clave) {
      this.$store.dispatch("avisar", { texto: this.$t(clave) });
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
     * El widget de Turnstile.
     *
     * El script se baja una sola vez y recién cuando hace falta: quien
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
        /* Un token de Turnstile sirve UNA vez: si el intento falló hay
           que pedir otro, o el siguiente falla aunque los datos estén
           bien. */
        if (this.sitioCaptcha && window.turnstile) {
          try { window.turnstile.reset(this.widgetCaptcha); } catch { /* ya no está */ }
        }
      } finally {
        this.enviando = false;
      }
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

/* ── Entrar / Registrarse ─────────────────────────────────────────── */

.mb-modal {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(5, 9, 17, .8);
}

.mb-modal__caja {
  width: 100%;
  max-width: 400px;
  max-height: 90vh;
  overflow-y: auto;
  padding: 24px;
  border: 2px solid #fff;
  border-radius: 22px;
  background: #12213a;
  display: flex;
  flex-direction: column;
  gap: 14px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, .55);
}

.mb-modal__titulo {
  margin: 0;
  font-family: $fuente-cartel;
  font-size: 26px;
  font-weight: 400;
  letter-spacing: .5px;
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
    height: 46px;
    padding: 0 14px;
    border: 1px solid #22385c;
    border-radius: 12px;
    background: #0e1a2e;
    color: #fff;
    font-family: inherit;
    font-size: 14px;
    &:focus { outline: none; border-color: $azul; }
  }
}

.mb-captcha { min-height: 65px; }

.mb-error {
  margin: 0;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(255, 91, 107, .14);
  color: #ff9aa5;
  font-weight: 700;
  font-size: 13px;
}

.mb-modal__acciones { display: flex; gap: 10px; > * { flex: 1; } }

.mb-boton {
  min-height: 48px;
  padding: 0 18px;
  border: 1px solid #22385c;
  border-radius: 14px;
  background: #1a2d4d;
  color: #fff;
  font-family: inherit;
  font-weight: 900;
  font-size: 15px;
  cursor: pointer;
  @include foco;

  &:hover:not(:disabled) { background: #22406f; }
  &:disabled { opacity: .5; cursor: default; }

  &--primario {
    background: linear-gradient(180deg, #ffd65a 0%, #f2a91c 100%);
    border-color: #fff;
    border-width: 2px;
    color: $azul-tinta;
    box-shadow: 0 4px 0 #b9780c;
    &:hover:not(:disabled) { filter: brightness(1.06); }
  }
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
  border: 2px solid #fff;
  border-radius: 14px;
  background: #12213a;
  color: #fff;
  font-weight: 700;
  box-shadow: 0 14px 34px rgba(0, 0, 0, .5);

  &--error { border-color: #ff5b6b; color: #ff9aa5; }
}
</style>
