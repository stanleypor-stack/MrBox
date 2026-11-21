<template>
  <div class="mb-auth">
    <!-- El fondo entero vuelve al sitio, como en el diseño. -->
    <router-link to="/" class="mb-auth__fuga" :aria-label="$t('auth.back')"></router-link>

    <div role="dialog" aria-modal="true" :aria-label="titulo" class="mb-auth__caja">
      <!-- ── La mitad del cartel ──────────────────────────────────── -->
      <!--
        EL CARTEL ES SOLO DE PC.

        Va el poster como lo mando Dani, entero y sin tocar: trae su
        propio titulo dibujado, asi que no hay nada que escribirle
        encima. En el telefono no hay cartel --se esconde entero, ver
        el `en-celular` de abajo-- igual que en mrloot: ahi la pantalla
        es el formulario y nada mas.
      -->
      <div class="mb-auth__cartel" aria-hidden="true">
        <img class="mb-auth__arte" src="/img/registro-pc.webp" alt="">
      </div>

      <!-- ── La mitad del formulario ──────────────────────────────── -->
      <form class="mb-auth__forma" @submit.prevent="enviar">
        <!-- Solo en el telefono: en PC el logo ya esta en el poster. -->
        <span class="mb-auth__logo" aria-hidden="true">
          <svg width="200" height="52" viewBox="0 0 1000 260" role="img" aria-label="MR BOX">
            <defs>
              <linearGradient id="rgFace" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#ffffff" />
                <stop offset="1" stop-color="#b9cff5" />
              </linearGradient>
              <text
                id="rgWord" x="490" y="185" text-anchor="middle"
                font-family="Titan One, sans-serif" font-size="170"
                letter-spacing="2" transform="skewX(-8) translate(26 0)"
              >MR BOX</text>
            </defs>
            <use href="#rgWord" transform="translate(16 16)" fill="#0b2266" stroke="#0b2266" stroke-width="10" stroke-linejoin="round" />
            <use href="#rgWord" transform="translate(5 5)" fill="#2c66dc" stroke="#2c66dc" stroke-width="14" stroke-linejoin="round" />
            <use href="#rgWord" transform="translate(10 10)" fill="#2c66dc" stroke="#2c66dc" stroke-width="14" stroke-linejoin="round" />
            <use href="#rgWord" fill="none" stroke="#0b2266" stroke-width="7" stroke-linejoin="round" />
            <use href="#rgWord" fill="url(#rgFace)" />
          </svg>
        </span>

        <router-link to="/" class="mb-auth__cerrar" :aria-label="$t('common.close')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff"
               stroke-width="3" stroke-linecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </router-link>

        <div class="mb-auth__encabezado">
          <h1>{{ titulo }}</h1>
          <p>
            {{ esRegistro ? $t('auth.haveAccount') : $t('auth.newHere') }}
            <button type="button" class="mb-auth__cambiar" @click="cambiarModo">
              {{ esRegistro ? $t('action.signIn') : $t('auth.createAccount') }}
            </button>
          </p>
        </div>

        <!--
          GOOGLE Y FACEBOOK.

          Steam quedo afuera: es una tienda de juegos, y entrar con
          Steam tiene sentido en un sitio de skins, no en uno que manda
          zapatillas a una casa. Los dos que usa la gente para
          registrarse son estos.

          Todavia no hay nada detras --faltan las claves de cada uno--
          asi que avisan en vez de no hacer nada: un boton que al
          tocarlo no pasa NADA hace creer que el sitio esta roto.
        -->
        <div class="mb-auth__sociales">
          <!--
            EL DE GOOGLE VA ENCIMA, INVISIBLE.

            Google no deja disparar su dialogo desde un boton nuestro.
            Lo que deja es dibujar el suyo, asi que el suyo se apoya
            arriba del nuestro: se ve el nuestro y el click lo recibe
            el de ellos.
          -->
          <div class="mb-auth__google">
            <div ref="gsi" class="mb-auth__gsi"></div>

            <button
              type="button" class="mb-auth__social" tabindex="-1" aria-hidden="true"
              :disabled="entrandoConGoogle"
            >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285f4" d="M21.6 12.2c0-.7-.1-1.3-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.4z" />
              <path fill="#34a853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z" />
              <path fill="#fbbc05" d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1a10 10 0 0 0 0 9.2z" />
              <path fill="#ea4335" d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.8-2.8A10 10 0 0 0 3.1 7.4L6.4 10c.8-2.3 3-4.1 5.6-4.1z" />
            </svg>
              {{ entrandoConGoogle ? $t('common.loading') : 'Google' }}
            </button>
          </div>
          <button type="button" class="mb-auth__social" @click="avisarPendiente">
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#1877f2" d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12z" />
            </svg>
            Facebook
          </button>
        </div>

        <div class="mb-auth__o">
          <span></span>{{ $t('auth.orContinue') }}<span></span>
        </div>

        <div v-if="esRegistro" class="mb-campo">
          <label for="rg-user">{{ $t('auth.username') }}</label>
          <input
            id="rg-user" v-model="form.username" class="mb-in" type="text"
            autocomplete="username" :placeholder="$t('auth.username')" required
          >
        </div>

        <div class="mb-campo">
          <label for="rg-email">{{ esRegistro ? $t('auth.email') : $t('auth.emailOrUser') }}</label>
          <!--
            AL ENTRAR NO ES `type="email"`.

            El rotulo dice "email o nombre de usuario" y el servidor
            acepta los dos, pero con `type="email"` el navegador exige
            una arroba y NO DEJA MANDAR EL FORMULARIO: el que entra con
            su nombre de usuario veia "incluí un signo @" y no habia
            forma de pasar de ahi. Al registrarse si es un email, y ahi
            la validacion del navegador suma.
          -->
          <input
            id="rg-email" v-model="form.email" class="mb-in"
            :type="esRegistro ? 'email' : 'text'" inputmode="email"
            :autocomplete="esRegistro ? 'email' : 'username'"
            :placeholder="esRegistro ? $t('auth.email') : $t('auth.emailOrUser')" required
          >
        </div>

        <div class="mb-campo">
          <div class="mb-campo__fila">
            <label for="rg-pass">{{ $t('auth.password') }}</label>
            <a v-if="!esRegistro" href="#" @click.prevent="avisarPendiente">{{ $t('auth.forgot') }}</a>
          </div>
          <div class="mb-campo__ojo">
            <input
              id="rg-pass" v-model="form.password" class="mb-in"
              :class="{ 'is-mal': claveCorta }" :type="verClave ? 'text' : 'password'"
              :autocomplete="esRegistro ? 'new-password' : 'current-password'"
              :placeholder="$t('auth.password')"
              :aria-invalid="String(claveCorta)"
              :aria-describedby="claveCorta ? 'rg-pass-mal' : null"
              required @blur="miroLaClave = true"
            >
            <button
              type="button" class="mb-campo__ojo-b"
              :aria-label="verClave ? $t('auth.hidePassword') : $t('auth.showPassword')"
              @click="verClave = !verClave"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8ea3c7"
                   stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path :d="verClave
                  ? 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'
                  : 'M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7c1.8 0 3.3-.5 4.6-1.2M9.9 9.9a3 3 0 0 0 4.2 4.2'" />
              </svg>
            </button>
          </div>

          <!-- El aviso, debajo del campo y en rojo: el servidor la
               rebota igual, pero enterarse despues de apretar el boton
               es enterarse tarde. -->
          <p v-if="claveCorta" id="rg-pass-mal" class="mb-campo__mal">
            {{ $t('auth.passwordShort', { n: CLAVE_MINIMA }) }}
          </p>
        </div>

        <div v-if="esRegistro" class="mb-auth__extras">
          <label class="mb-auth__check">
            <input v-model="conCodigo" class="mb-chk" type="checkbox">
            {{ $t('auth.codeOptional') }}
          </label>

          <input
            v-if="conCodigo" v-model="form.affiliateCode" class="mb-in" type="text"
            :aria-label="$t('auth.referralCode')" :placeholder="$t('auth.enterCode')"
          >

          <label class="mb-auth__check mb-auth__check--terminos">
            <input v-model="aceptaTerminos" class="mb-chk" type="checkbox">
            <span v-html="$t('auth.terms')"></span>
          </label>
        </div>

        <div v-if="sitioCaptcha" ref="captcha" class="mb-auth__captcha"></div>

        <p v-if="error" class="mb-auth__error">{{ error }}</p>

        <button
          type="submit" class="mb-auth__enviar"
          :disabled="!listo || enviando"
          :style="{ borderColor: listo ? '#9cc4ff' : '#3f7cf0', opacity: listo ? 1 : .6 }"
        >{{ esRegistro ? $t('auth.signUpBig') : $t('auth.logInBig') }}</button>

        <p class="mb-auth__legal" v-html="$t('auth.captchaNote')"></p>
      </form>
    </div>
  </div>
</template>

<script>
/**
 * ENTRAR Y REGISTRARSE.
 *
 * Portado del prototipo del dueno: el cartel con el arcoiris y las cajas
 * flotando de un lado, el formulario del otro, y las dos pantallas en
 * una sola --el boton del encabezado cambia de modo sin recargar.
 *
 * LO QUE EL DISENO YA RESOLVIA Y SE RESPETA
 *
 * El boton grande queda apagado hasta que el formulario sirve. En el
 * registro eso incluye haber aceptado los terminos: no es un detalle
 * legal nada mas, es que nadie se registre sin haber visto que hay algo
 * que aceptar.
 */
import api from "@/api";

/* Lo mismo que exige el servidor (`routes/auth/index.js`). Si cambia
   alla, cambia aca: un minimo distinto en cada lado es un formulario
   que deja mandar algo que va a rebotar. */
const CLAVE_MINIMA = 8;

/*
  LA LIBRERIA DE GOOGLE, UNA SOLA VEZ.

  Se guarda la promesa y no una bandera: si alguien toca el boton dos
  veces seguidas, el segundo se cuelga de la misma carga en vez de
  meter un segundo <script>.
*/
let cargandoGoogle = null;

function cargarGoogle() {
  if (window.google && window.google.accounts) return Promise.resolve();

  if (!cargandoGoogle) {
    cargandoGoogle = new Promise((listo, falla) => {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.defer = true;
      s.onload = listo;
      s.onerror = () => {
        /* Si no cargó, la próxima vez se vuelve a intentar: dejar la
           promesa rechazada guardada romperia el boton para siempre. */
        cargandoGoogle = null;
        falla(new Error("no pude cargar google"));
      };
      document.head.appendChild(s);
    });
  }

  return cargandoGoogle;
}

export default {
  name: "AuthView",

  data() {
    return {

      form: {
        username: "",
        email: "",
        password: "",
        affiliateCode: "",
      },
      verClave: false,
      /* Mientras Google contesta: el boton se apaga para que no se
         abran dos dialogos. */
      entrandoConGoogle: false,
      /* Si ya salio del campo o intento mandar: ver `claveCorta`. */
      miroLaClave: false,
      CLAVE_MINIMA,
      conCodigo: false,
      aceptaTerminos: false,
      enviando: false,
      error: "",
      sitioCaptcha: process.env.VUE_APP_TURNSTILE_SITE_KEY || "",
      widgetCaptcha: null,
    };
  },

  computed: {
    /*
      LA CLAVE ES CORTA Y YA LA MIRO.

      No salta con la primera letra: espera a que salga del campo o a
      que haya intentado mandar. Un cartel rojo apenas tocas el campo
      es ansiedad, no ayuda.
    */
    claveCorta() {
      return this.esRegistro
        && this.miroLaClave
        && this.form.password.length > 0
        && this.form.password.length < CLAVE_MINIMA;
    },

    esRegistro() { return this.$route.name === "signup"; },
    titulo() {
      return this.esRegistro ? this.$t("auth.createTitle") : this.$t("auth.welcomeBack");
    },
    listo() {
      const f = this.form;
      if (!this.esRegistro) return !!(f.email.trim() && f.password);
      return !!(
        f.username.trim() && f.email.trim()
        && f.password.length >= CLAVE_MINIMA
        && this.aceptaTerminos
      );
    },
  },

  methods: {
    /* La posicion en la lamina de cajas: grilla de 14x14. */
    arte(i) {
      return `${((i % 14) / 13 * 100).toFixed(4)}% ${(Math.floor(i / 14) / 13 * 100).toFixed(4)}%`;
    },
    /* La de premios: 4x4. */
    premio(i) {
      return `${((i % 4) / 3 * 100)}% ${(Math.floor(i / 4) / 3 * 100)}%`;
    },

    /**
     * ENTRAR CON GOOGLE.
     *
     * Abre el diálogo de Google, recibe el token firmado y se lo manda
     * al servidor, que decide si la persona entra o se registra. Acá
     * no se decide nada: lo único que se hace es llevar el token.
     *
     * Se carga la librería de Google RECIÉN AL TOCAR EL BOTÓN, no al
     * abrir la página: la mayoría entra con su contraseña y no tiene
     * por qué bajar un script de Google ni avisarle que estuvo acá.
     */
    /**
     * DIBUJA EL BOTON DE GOOGLE ENCIMA DEL NUESTRO.
     *
     * Google no deja disparar su diálogo desde un botón propio: la
     * única manera soportada es que dibuje el suyo. Así que el suyo
     * va arriba del nuestro, invisible y del mismo tamaño.
     *
     * Si falla, no se avisa nada: el botón simplemente no está. Un
     * cartel de error al entrar a la pantalla, por algo que la
     * persona no hizo, no ayuda a nadie.
     */
    async prepararGoogle() {
      const clientId = process.env.VUE_APP_GOOGLE_CLIENT_ID;
      if (!clientId || !this.$refs.gsi) return;

      try {
        await cargarGoogle();

        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (r) => this.recibirDeGoogle(r),
          /* Sin "seguís siendo vos": entrar es una decisión, no algo
             que pase solo al abrir la pantalla. */
          auto_select: false,
        });

        window.google.accounts.id.renderButton(this.$refs.gsi, {
          type: "standard",
          theme: "filled_black",
          size: "large",
          text: this.esRegistro ? "signup_with" : "signin_with",
          /* Del ancho del nuestro, para que el click caiga siempre
             sobre el de ellos y nunca al costado. */
          width: Math.round(this.$refs.gsi.parentElement.offsetWidth) || 200,
        });
      } catch {
        /* Sin el script de Google no hay botón. El resto de la
           pantalla --el formulario de siempre-- anda igual. */
      }
    },

    /** Lo que devuelve el botón de Google: el token, y a entrar. */
    async recibirDeGoogle(respuesta) {
      if (!respuesta || !respuesta.credential || this.entrandoConGoogle) return;

      this.entrandoConGoogle = true;
      this.error = "";

      try {
        await this.$store.dispatch("conGoogle", {
          credential: respuesta.credential,
          affiliateCode: this.conCodigo ? this.form.affiliateCode : undefined,
        });

        this.$router.push("/");
      } catch (err) {
        this.$store.dispatch("avisar", {
          texto: (err && err.textoParaElJugador) || this.$t("auth.googleFailed"),
          tono: "error",
        });
      } finally {
        this.entrandoConGoogle = false;
      }
    },

    avisarPendiente() {
      this.$store.dispatch("avisar", { texto: this.$t("auth.soon") });
    },

    cambiarModo() {
      this.error = "";
      this.$router.push({ name: this.esRegistro ? "login" : "signup" });
    },

    dibujarCaptcha() {
      if (!this.sitioCaptcha || !this.$refs.captcha) return;
      const pintar = () => {
        if (!window.turnstile || !this.$refs.captcha) return;
        this.$refs.captcha.innerHTML = "";
        this.widgetCaptcha = window.turnstile.render(this.$refs.captcha, {
          sitekey: this.sitioCaptcha, theme: "dark",
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
      try { return window.turnstile.getResponse(this.widgetCaptcha) || ""; } catch { return ""; }
    },

    async enviar() {
      /* Intentar mandar cuenta como haber mirado el campo. */
      this.miroLaClave = true;
      if (this.claveCorta) return;

      if (!this.listo) return;
      this.enviando = true;
      this.error = "";
      try {
        const captchaToken = this.tokenDelCaptcha();
        if (this.esRegistro) {
          const datos = { ...this.form, captchaToken };
          if (!this.conCodigo) delete datos.affiliateCode;
          const r = await this.$store.dispatch("registrarse", datos);
          /* Si puso un código que no existe, se lo decimos: se registró
             igual, pero tiene que saber que no le quedó aplicado. */
          if (r.affiliate && r.affiliate.invalido) {
            this.$store.dispatch("avisar", {
              texto: this.$t("auth.codeIgnored", { code: r.affiliate.invalido }),
              tono: "error",
            });
          }
        } else {
          await this.$store.dispatch("entrar", {
            email: this.form.email, password: this.form.password, captchaToken,
          });
        }
        this.$router.push("/");
      } catch (err) {
        this.error = err.textoParaElJugador;
        /* Un token de Turnstile sirve una sola vez. */
        if (this.sitioCaptcha && window.turnstile) {
          try { window.turnstile.reset(this.widgetCaptcha); } catch { /* ya no está */ }
        }
      } finally {
        this.enviando = false;
      }
    },

  },

  watch: {
    /* Al cambiar de modo hay que volver a pedir un captcha. */
    "$route.name"() { this.$nextTick(this.dibujarCaptcha); },
  },

  created() {

    /*
      EL CODIGO QUE VIENE EN EL ENLACE DEL SOCIO (/r/SUCODIGO).

      Llega puesto y con la casilla marcada: el que entra por el enlace
      de alguien no tiene que acordarse de nada. Igual lo puede borrar,
      porque es su cuenta.
    */
    const ref = String(this.$route.query.ref || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 16);
    if (ref) {
      this.form.affiliateCode = ref.toUpperCase();
      this.conCodigo = true;
    }
  },

  mounted() {
    this.dibujarCaptcha();
    this.prepararGoogle();
  },
};
</script>

<style lang="scss" scoped>
/* El campo en rojo y el motivo debajo: lo del diseno. */
.mb-in.is-mal {
  border-color: #ff5f78;
  box-shadow: 0 0 0 1px rgba(255, 95, 120, .35);
}

.mb-campo__mal {
  margin: 7px 0 0;
  font-size: 12.5px;
  font-weight: 700;
  line-height: 1.35;
  color: #ff5f78;
}

@import "@/styles/tokens";

.mb-auth {
  position: relative;
  min-height: 100vh;
  background: #070d18;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  box-sizing: border-box;
  @include en-celular { padding: 0; }
}

/* Tocar el fondo vuelve al sitio, como en el diseño. */
.mb-auth__fuga { position: absolute; inset: 0; }

.mb-auth__caja {
  position: relative;
  width: 100%;
  max-width: 820px;
  border-radius: 24px;
  overflow: hidden;
  background: #0e1a2e;
  border: 2px solid #fff;
  display: flex;
  flex-wrap: wrap;
  box-shadow: 0 30px 80px rgba(0, 0, 0, .6);
  @include en-celular { border-radius: 0; border: 0; min-height: 100vh; }
}

/* ── El cartel ────────────────────────────────────────────────────── */

.mb-auth__cartel {
  position: relative;
  flex: 1 1 320px;

  /*
    EL FONDO CONTINUA EL BORDE DE ARRIBA DEL POSTER.

    En PC el poster va entero --`contain`, ver abajo-- y el carton es
    un poco mas alto que el. Esa sobra se manda toda arriba, y este es
    el color del borde superior del poster, medido: #2a0475. Asi no se
    ve una franja, se ve el cielo un poco mas largo.
  */
  background: #2a0475;
  min-height: 620px;
  overflow: hidden;

  /* El alto en el telefono lo fija el bloque de abajo, que es el
     ultimo y por lo tanto el que gana. */
  @include en-celular { flex: 1 1 100%; }
}

/*
  EL POSTER.

  Va entero, no recortado: `contain` y no `cover`. Con `cover` el
  carton le comia una franja de cada lado, y cuanto se comia dependia
  de la pantalla --el alto del carton lo decide el formulario, que es
  mas alto en registrarse que en entrar, asi que no hay un ancho fijo
  que acierte siempre--.

  Y pegado abajo, asi lo que sobra queda todo arriba. Centrado, la
  sobra se parte en dos y la de abajo se notaba: el borde inferior del
  poster es asfalto rosa con textura y debajo aparecia una franja lisa
  que se leia como un bloque aparte. El borde de ARRIBA en cambio es
  violeta liso --#2a0475, medido-- y el carton usa ese mismo color de
  fondo: no se ve una franja, se ve el cielo un poco mas largo.
*/
.mb-auth__arte {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center bottom;
}


@include en-celular {
  /*
    EN EL TELEFONO NO HAY CARTEL.

    Como en mrloot: la pantalla es el formulario y nada mas. Antes el
    arte se achicaba y se le escribia el titulo encima, y en 375px de
    ancho el texto se comia la imagen o la imagen tapaba el texto; las
    dos cosas se vieron.

    El logo no se pierde: pasa adentro del formulario, arriba a la
    izquierda, enfrentado a la cruz de cerrar.
  */
  .mb-auth__cartel { display: none; }
}

/* ── El formulario ────────────────────────────────────────────────── */

.mb-auth__forma {
  position: relative;
  flex: 1 1 380px;
  box-sizing: border-box;
  padding: 30px 32px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  @include en-celular { padding: 24px 18px 36px; }
}

/*
  EL LOGO, SOLO EN EL TELEFONO.

  En PC esta dibujado adentro del poster, asi que aca sobraria. En el
  telefono no hay poster --mrloot tampoco tiene-- y sin esto la
  pantalla arrancaria directo en "Crea tu cuenta", sin decir de que
  sitio es.

  Va arriba a la izquierda, enfrentado a la cruz de cerrar, y con el
  mismo alto que ella para que los dos queden en la misma linea.
*/
.mb-auth__logo {
  display: none;

  @include en-celular {
    display: flex;
    align-items: center;
    height: 44px;
    /* El titulo viene despues y trae su propio aire. */
    margin-bottom: -4px;

    svg {
      width: 150px;
      height: auto;
      /* La cruz mide 44 y empieza a 16 del borde: dejarle lugar para
         que el logo no se le meta abajo en una pantalla angosta. */
      max-width: calc(100% - 56px);
    }
  }
}

.mb-auth__cerrar {
  position: absolute;
  right: 16px;
  top: 16px;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: #1d3354;
  display: flex;
  align-items: center;
  justify-content: center;
  @include foco;
  &:hover { background: #22406f; }
}

.mb-auth__encabezado {
  display: flex;
  flex-direction: column;
  gap: 4px;

  h1 { margin: 0; font-weight: 900; font-size: 26px; }
  p { margin: 0; font-size: 14px; color: #a9bbe6; }
}

.mb-auth__cambiar {
  padding: 0;
  border: 0;
  background: transparent;
  color: #6bb4ff;
  font-family: inherit;
  font-weight: 800;
  font-size: 14px;
  cursor: pointer;
  @include foco;
  &:hover { color: #fff; }
}

.mb-auth__sociales { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }

/*
  EL BOTON DE GOOGLE, ENCIMA DEL NUESTRO.

  Se ve el nuestro --la letra y el color del sitio-- y el click lo
  recibe el de ellos, que esta arriba con opacidad cero. Es la unica
  manera soportada: Google no deja disparar su dialogo desde un boton
  propio.

  `opacity: 0` y no `visibility: hidden` ni `display: none`: lo que no
  se dibuja tampoco recibe clicks.
*/
.mb-auth__google { position: relative; }

.mb-auth__gsi {
  position: absolute;
  inset: 0;
  z-index: 2;
  opacity: 0;
  overflow: hidden;

  /* El iframe que mete Google adentro: que ocupe todo, asi no queda
     una esquina del boton nuestro que no haga nada. */
  > * { width: 100% !important; height: 100% !important; }
}

/* El nuestro es decoracion: el que se toca es el de arriba. */
.mb-auth__google .mb-auth__social { width: 100%; pointer-events: none; }

.mb-auth__social {
  height: 46px;
  border-radius: 12px;
  border: 1px solid #2a4170;
  background: #16253f;
  color: #fff;
  font-family: inherit;
  font-weight: 800;
  font-size: 15px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  @include foco;
  &:hover { background: #1d3354; }
}

.mb-auth__o {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #8ea3c7;
  font-weight: 700;
  font-size: 13px;
  span { flex: 1; height: 1px; background: #24365c; }
}

.mb-campo {
  display: flex;
  flex-direction: column;
  gap: 6px;

  label { font-weight: 800; font-size: 14px; }
}

.mb-campo__fila {
  display: flex;
  align-items: center;
  justify-content: space-between;
  a { font-weight: 700; font-size: 13px; color: #6bb4ff; }
}

.mb-campo__ojo { position: relative; }

.mb-campo__ojo-b {
  position: absolute;
  right: 2px;
  top: 2px;
  width: 44px;
  height: 44px;
  border: 0;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  @include foco;
}

.mb-in {
  width: 100%;
  box-sizing: border-box;
  height: 48px;
  padding: 0 14px;
  border-radius: 12px;
  border: 1px solid #2a4170;
  background: #0e1a2e;
  color: #fff;
  font-family: inherit;
  font-size: 15px;
  font-weight: 600;

  &::placeholder { color: #6f84ab; }
  &:focus { outline: none; border-color: $azul; }
}

.mb-campo__ojo .mb-in { padding-right: 52px; }

.mb-auth__extras { display: flex; flex-direction: column; gap: 12px; }

.mb-auth__check {
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: 700;
  font-size: 14px;
  cursor: pointer;

  &--terminos {
    align-items: flex-start;
    font-weight: 600;
    line-height: 1.45;
    color: #c9d7f7;
  }
}

/*
  La casilla del diseño. Se dibuja a mano porque la del navegador no se
  puede pintar; `appearance: none` la deja en blanco y el tilde es un
  borde girado 45 grados, que es el truco de siempre.
*/
.mb-chk {
  appearance: none;
  -webkit-appearance: none;
  width: 22px;
  height: 22px;
  flex: none;
  margin: 0;
  border-radius: 6px;
  border: 2px solid #3a5687;
  background: #0e1a2e;
  cursor: pointer;
  display: grid;
  place-content: center;
  @include foco;

  &:checked { background: $azul; border-color: $azul; }
  &:checked::after {
    content: "";
    width: 6px;
    height: 11px;
    border: solid #fff;
    border-width: 0 3px 3px 0;
    transform: translateY(-1px) rotate(45deg);
  }
}

/*
  EL CAPTCHA, CENTRADO.

  Cloudflare dibuja su cuadro con un ancho fijo de 300px: suelto en una
  columna de 400 queda pegado a la izquierda, como si se hubiera caido
  ahi. Centrado se ve como parte del formulario.
*/
.mb-auth__captcha {
  min-height: 65px;
  display: flex;
  justify-content: center;

  iframe { margin: 0 auto; }
}

.mb-auth__error {
  margin: 0;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(255, 91, 107, .14);
  color: #ff9aa5;
  font-weight: 700;
  font-size: 13px;
}

.mb-auth__enviar {
  height: 56px;
  border-radius: 14px;
  border: 2px solid $azul;
  background: $azul;
  box-shadow: 0 5px 0 #1c4fc4;
  color: #fff;
  font-family: $fuente-cartel;
  font-size: 22px;
  letter-spacing: .02em;
  cursor: pointer;
  @include foco;

  &:hover:not(:disabled) { filter: brightness(1.08); }
  &:disabled { cursor: not-allowed; }
}

.mb-auth__legal {
  margin: 0;
  text-align: center;
  font-size: 12px;
  line-height: 1.5;
  color: #7f93b8;
  ::v-deep a { color: #a9bbe6; }
}
</style>
