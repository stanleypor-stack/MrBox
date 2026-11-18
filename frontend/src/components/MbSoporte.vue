<template>
  <div class="mb-sop">
    <!-- ── El globito ───────────────────────────────────────────── -->
    <button
      type="button" class="mb-sop__globo" :aria-expanded="String(abierto)"
      :aria-label="abierto ? $t('support.closeChat') : $t('support.openChat')"
      @click="alternar"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2"
           stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path :d="abierto ? 'M6 6l12 12M18 6 6 18' : 'M4 5h16v11H9l-5 4z'" />
      </svg>
      <span v-if="!abierto && sinLeer" class="mb-sop__punto" aria-hidden="true"></span>
    </button>

    <!-- ── La ventana ───────────────────────────────────────────── -->
    <div v-if="abierto" class="mb-sop__caja" role="dialog" :aria-label="$t('support.title')">
      <header class="mb-sop__cabeza">
        <span>{{ $t('support.title') }}</span>
        <button type="button" class="mb-sop__x" :aria-label="$t('support.closeChat')" @click="alternar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.8"
               stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </header>

      <div ref="cuerpo" class="mb-sop__cuerpo mb-snap">
        <!-- Inicio -->
        <div v-if="solapa === 'home'" class="mb-sop__col">
          <span class="mb-sop__hola" v-html="saludo"></span>

          <button type="button" class="mb-sop__opcion" @click="nueva(false)">
            <span class="mb-sop__opcion-t">
              <span class="mb-sop__opcion-a">{{ $t('support.sendUs') }}</span>
              <span class="mb-sop__opcion-b">{{ $t('support.sendUsSub') }}</span>
            </span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6bb4ff" stroke-width="2.6"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </button>

          <button type="button" class="mb-sop__opcion mb-sop__opcion--chica" @click="solapa = 'help'">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8ea3c7" stroke-width="2.4"
                 stroke-linecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
            </svg>
            <span class="mb-sop__opcion-b">{{ $t('support.searchHelp') }}</span>
          </button>

        </div>

        <!-- Mis conversaciones -->
        <div v-else-if="solapa === 'msgs'" class="mb-sop__col">
          <div class="mb-sop__fila">
            <span class="mb-sop__titulo">{{ $t('support.messages') }}</span>
            <button type="button" class="mb-sop__nueva" @click="nueva(true)">+ {{ $t('support.new') }}</button>
          </div>

          <p v-if="!entro" class="mb-sop__vacio">{{ $t('support.signInToWrite') }}</p>
          <p v-else-if="!hilos.length" class="mb-sop__vacio">{{ $t('support.empty') }}</p>

          <button
            v-for="h in hilos" :key="h._id" type="button" class="mb-sop__hilo"
            @click="abrirHilo(h._id)"
          >
            <span class="mb-sop__hilo-a">
              <span class="mb-sop__hilo-t">{{ h.asunto }}</span>
              <span class="mb-sop__hilo-f">{{ fecha(h.ultimoMensajeEl) }}</span>
            </span>
            <span class="mb-sop__hilo-u">{{ textoDe(h.ultimo) }}</span>
            <span class="mb-sop__chapa" :class="'is-' + h.estado">{{ $t('support.state.' + h.estado) }}</span>
          </button>
        </div>

        <!-- La conversación -->
        <div v-else-if="solapa === 'chat'" class="mb-sop__col mb-sop__chat">
          <button type="button" class="mb-sop__atras" @click="volver">‹ {{ $t('support.messages') }}</button>

          <div v-for="m in mensajes" :key="m._id" class="mb-sop__msg" :class="{ 'is-mio': !m.deAdmin }">
            <span v-if="m.deAdmin && m.nombre" class="mb-sop__quien">{{ m.nombre }}</span>
            {{ textoDe(m) }}
          </div>

          <p v-if="!mensajes.length" class="mb-sop__vacio">{{ $t('support.greeting') }}</p>
        </div>

        <!-- Ayuda -->
        <div v-else class="mb-sop__col">
          <span class="mb-sop__titulo">{{ $t('support.help') }}</span>

          <label class="mb-sop__buscar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8ea3c7" stroke-width="2.4"
                 stroke-linecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
            </svg>
            <input v-model="busqueda" type="search" :placeholder="$t('support.searchHelp')" :aria-label="$t('support.searchHelp')">
          </label>

          <div v-for="g in ayuda" :key="g.id" class="mb-sop__grupo">
            <span class="mb-sop__grupo-t">{{ $t('support.' + g.id) }}</span>

            <div v-for="q in g.items" :key="q" class="mb-sop__q">
              <button type="button" :aria-expanded="String(abierta === q)" @click="abierta = abierta === q ? '' : q">
                {{ $t('support.q' + q) }}
              </button>
              <p v-if="abierta === q">{{ $t('support.a' + q) }}</p>
            </div>
          </div>

          <p v-if="!ayuda.length" class="mb-sop__vacio">{{ $t('support.noHelp') }}</p>
        </div>
      </div>

      <!-- El cuadro de escribir, solo en la conversación -->
      <form v-if="solapa === 'chat'" class="mb-sop__escribir" @submit.prevent="mandar">
        <input
          v-model="borrador" :placeholder="$t('support.placeholder')" :aria-label="$t('support.placeholder')"
          :disabled="!entro || mandando"
        >
        <button type="submit" class="mb-sop__mandar" :aria-label="$t('support.send')" :disabled="!entro || !borrador.trim() || mandando">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
            <path d="M3 20.5 21 12 3 3.5v6.6l12 1.9-12 1.9z" />
          </svg>
        </button>
      </form>

      <nav class="mb-sop__solapas">
        <button
          v-for="s in SOLAPAS" :key="s.id" type="button"
          :aria-current="String(solapa === s.id || (s.id === 'msgs' && solapa === 'chat'))"
          :class="{ 'is-activa': solapa === s.id || (s.id === 'msgs' && solapa === 'chat') }"
          @click="irA(s.id)"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="s.icono" /></svg>
          {{ $t('support.' + s.id) }}
          <span v-if="s.id === 'msgs' && sinLeer" class="mb-sop__punto mb-sop__punto--chico" aria-hidden="true"></span>
        </button>
      </nav>
    </div>
  </div>
</template>

<script>
import { mapGetters, mapState } from "vuex";
import api from "@/api";

/* Las tres solapas de abajo, como el prototipo. */
const SOLAPAS = [
  { id: "home", icono: "M3 11 12 4l9 7v9h-6v-6H9v6H3z" },
  { id: "msgs", icono: "M4 5h16v11H9l-5 4z" },
  { id: "help", icono: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-.9.8-.9 1.4v.3M12 17h.01" },
];

/* Las ocho preguntas del prototipo, en sus tres grupos. */
const AYUDA = [
  { id: "g1", items: [1, 2, 3] },
  { id: "g2", items: [4, 5, 6] },
  { id: "g3", items: [7, 8] },
];

/**
 * EL SOPORTE DEL SITIO.
 *
 * El globito de abajo a la derecha, tal cual el prototipo: inicio,
 * mis conversaciones, la conversación abierta y la ayuda.
 *
 * LA AYUDA FUNCIONA SIN CUENTA
 *
 * Escribir pide sesión --una conversación sin cuenta no se le puede
 * contestar a nadie-- pero leer la ayuda no. Casi todo lo que alguien
 * pregunta antes de registrarse está en esas ocho preguntas, y hacerle
 * abrir una cuenta para leerlas es perder a esa persona.
 *
 * EL CHAT PREGUNTA SOLO MIENTRAS ESTA ABIERTO
 *
 * Mientras la ventana está abierta pregunta cada ocho segundos. Cerrada,
 * una vez por minuto, y solo si hay sesión: es lo que enciende el
 * puntito del globito. Con la pestaña escondida, nada.
 */
export default {
  name: "MbSoporte",

  props: {
    /* App.vue la abre desde la cabecera, el pie y el menú de cuenta. */
    abrir: { type: Number, default: 0 },

    /* Un mensaje ya empezado, para los botones que piden algo concreto. */
    mensajeInicial: { type: String, default: "" },
  },

  data() {
    return {
      SOLAPAS,
      abierto: false,
      solapa: "home",
      hilos: [],
      hiloId: "",
      forzarNueva: false,
      mensajes: [],
      borrador: "",
      mandando: false,
      sinLeer: 0,
      horario: "24/7",
      busqueda: "",
      abierta: "",
      reloj: null,
    };
  },

  computed: {
    ...mapGetters(["entro"]),
    ...mapState(["usuario"]),

    saludo() {
      const nombre = (this.usuario && this.usuario.username) || "";
      return nombre
        ? this.$t("support.hiName", { nombre })
        : this.$t("support.hiAnon");
    },

    /** La ayuda, filtrada por lo que se escribió en el buscador. */
    ayuda() {
      const q = this.busqueda.trim().toLowerCase();
      if (!q) return AYUDA;

      return AYUDA
        .map((g) => ({
          id: g.id,
          items: g.items.filter((n) => (
            this.$t("support.q" + n).toLowerCase().includes(q)
            || this.$t("support.a" + n).toLowerCase().includes(q)
          )),
        }))
        .filter((g) => g.items.length);
    },
  },

  watch: {
    /* Cada vez que sube, alguien tocó "Soporte" en otro lado. */
    abrir() {
      this.abierto = true;

      /* Con un mensaje empezado va derecho al chat: quien toco "pedir
         el traslado" quiere escribir, no leer la lista. */
      if (this.mensajeInicial) {
        this.nueva(true);
        this.borrador = this.mensajeInicial;
      } else {
        this.solapa = this.hilos.length ? "msgs" : "home";
      }

      this.traerHilos();
    },

    abierto(v) {
      this.marcarReloj();
      if (v) this.traerHilos();
    },
  },

  methods: {
    fecha(d) {
      return d ? new Date(d).toLocaleDateString(this.$i18n.locale, { day: "2-digit", month: "short" }) : "";
    },

    /**
     * El texto de un mensaje.
     *
     * Los que escribe una persona vienen con su texto. La respuesta
     * automática viene como CODIGO y se dice en el idioma de quien
     * mira: una respuesta automática en un idioma que no es el tuyo
     * ya avisa que del otro lado no hay nadie.
     */
    textoDe(m) {
      if (!m) return "";
      if (m.codigo === "SUPPORT_AUTO_REPLY") return this.$t("support.autoReply");
      return m.texto;
    },

    alternar() { this.abierto = !this.abierto; },

    irA(id) {
      this.solapa = id;
      if (id === "msgs") this.traerHilos();
    },

    volver() {
      this.solapa = "msgs";
      this.traerHilos();
    },

    /**
     * Empezar a escribir.
     *
     * Desde el inicio ("Escribinos") sigue la conversación abierta si
     * hay una: el que escribe desde ahí casi siempre está insistiendo
     * por lo mismo, y su respuesta tiene que llegarle donde ya está
     * mirando. Desde "+ Nueva" de la lista, una nueva de verdad.
     */
    nueva(forzar) {
      const abierta = this.hilos.find((h) => h.estado !== "closed");
      if (!forzar && abierta) { this.abrirHilo(abierta._id); return; }

      this.hiloId = "";
      this.forzarNueva = !!forzar;
      this.mensajes = [];
      this.solapa = "chat";
      this.$nextTick(this.alFondo);
    },

    alFondo() {
      const c = this.$refs.cuerpo;
      if (c) c.scrollTop = c.scrollHeight;
    },

    async traerHilos() {
      if (!this.entro) { this.hilos = []; this.sinLeer = 0; return; }
      try {
        const { data } = await api.get("/support/threads");
        this.hilos = data.data.items;
        this.sinLeer = data.data.sinLeer;

        /* Si la conversación abierta tiene algo nuevo, se refresca. */
        if (this.solapa === "chat" && this.hiloId) await this.abrirHilo(this.hiloId, true);
      } catch (err) {
        /* El globito no interrumpe a nadie con un cartel rojo. */
      }
    },

    async abrirHilo(id, enSilencio) {
      try {
        const { data } = await api.get(`/support/threads/${id}`);
        this.hiloId = id;
        this.forzarNueva = false;
        this.mensajes = data.data.mensajes;
        if (!enSilencio) this.solapa = "chat";
        this.$nextTick(this.alFondo);
      } catch (err) {
        if (!enSilencio) this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      }
    },

    async mandar() {
      const texto = this.borrador.trim();
      if (!texto || !this.entro) return;

      this.mandando = true;
      try {
        const { data } = await api.post("/support/threads", {
          texto,
          hilo: this.hiloId || undefined,
          nueva: !this.hiloId && this.forzarNueva,
        });
        this.forzarNueva = false;
        this.hiloId = data.data._id;
        this.mensajes = data.data.mensajes;
        this.borrador = "";
        this.$nextTick(this.alFondo);
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      } finally {
        this.mandando = false;
      }
    },

    /** Abierta, cada ocho segundos; cerrada, cada sesenta. */
    marcarReloj() {
      window.clearInterval(this.reloj);
      const cada = this.abierto ? 8000 : 60000;
      this.reloj = window.setInterval(() => {
        if (!document.hidden && this.entro) this.traerHilos();
      }, cada);
    },

    async traerConfig() {
      try {
        const { data } = await api.get("/support/config");
        this.horario = data.data.horario;
      } catch (err) {
        /* Se queda con 24/7, que es lo que dice el diseño. */
      }
    },
  },

  created() {
    this.traerConfig();
    this.traerHilos();
    this.marcarReloj();
  },

  beforeDestroy() { window.clearInterval(this.reloj); },
};
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

/* ── El globito ───────────────────────────────────────────────────── */

.mb-sop__globo {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 97;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: 0;
  background: linear-gradient(180deg, #4fa2ff, #2f6fe0);
  box-shadow: 0 6px 18px rgba(0, 0, 0, .45);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  @include foco;

  /* Arriba de la barra de abajo, que mide 72 y es fija. */
  @include en-celular { right: 14px; bottom: 84px; width: 50px; height: 50px; }
}

.mb-sop__punto {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #ff5b6b;
  border: 2px solid #0b1424;

  &--chico { position: static; width: 8px; height: 8px; border: 0; }
}

/* ── La ventana ───────────────────────────────────────────────────── */

.mb-sop__caja {
  position: fixed;
  right: 20px;
  bottom: 90px;
  z-index: 97;
  width: 380px;
  height: min(560px, calc(100vh / var(--escala, 1) - 120px));
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 18px;
  border: 1px solid $borde-fuerte;
  background: $panel;
  box-shadow: 0 24px 60px rgba(0, 0, 0, .6);

  /*
    En el telefono ocupa casi toda la pantalla: una ventanita de 380 en
    un telefono de 390 deja ocho pixeles de aire a cada lado y se ve
    como un error, y mas angosta no entra una conversacion.
  */
  @include en-celular {
    left: 8px;
    right: 8px;
    top: 80px;
    bottom: 146px;
    width: auto;
    height: auto;
  }
}

.mb-sop__cabeza {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid $borde;
  font-weight: 900;
  font-size: 18px;
}

.mb-sop__x {
  width: 34px;
  height: 34px;
  border-radius: 9px;
  border: 0;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  @include foco;
}

.mb-sop__cuerpo { flex: 1; overflow-y: auto; padding: 16px; }
.mb-sop__col { display: flex; flex-direction: column; gap: 12px; }
.mb-sop__chat { min-height: 100%; gap: 10px; }

.mb-sop__hola { font-family: $fuente-cartel; font-size: 26px; line-height: 1.1; }
.mb-sop__titulo { font-weight: 900; font-size: 18px; }
.mb-sop__fila { display: flex; align-items: center; justify-content: space-between; gap: 10px; }

.mb-sop__opcion {
  text-align: left;
  padding: 14px;
  border-radius: 14px;
  border: 1px solid $borde-fuerte;
  background: $panel-alto;
  color: #fff;
  font-family: inherit;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  @include foco;
  &:hover { background: $panel-hover; }

  &--chica { justify-content: flex-start; }
}

.mb-sop__opcion-t { display: flex; flex-direction: column; gap: 3px; }
.mb-sop__opcion-a { font-weight: 900; font-size: 15px; }
.mb-sop__opcion-b { font-size: 13px; color: $texto-4; }

.mb-sop__horario { margin: 0; font-size: 12px; color: $texto-4; }

.mb-sop__nueva {
  height: 32px;
  padding: 0 12px;
  border-radius: 9px;
  border: 0;
  background: $azul;
  color: #fff;
  font-family: inherit;
  font-weight: 800;
  font-size: 13px;
  cursor: pointer;
  @include foco;
}

.mb-sop__vacio { margin: 10px 0; font-size: 13px; line-height: 1.5; color: $texto-3; }

/* ── Una conversación en la lista ─────────────────────────────────── */

.mb-sop__hilo {
  text-align: left;
  padding: 12px;
  border-radius: 12px;
  border: 0;
  background: $panel-hover;
  color: #fff;
  font-family: inherit;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 4px;
  @include foco;
  &:hover { filter: brightness(1.1); }
}

.mb-sop__hilo-a { display: flex; justify-content: space-between; gap: 10px; }
.mb-sop__hilo-t { font-weight: 900; font-size: 14px; }
.mb-sop__hilo-f { font-size: 12px; color: $texto-4; }

.mb-sop__hilo-u {
  font-size: 13px;
  color: $texto-3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mb-sop__chapa {
  align-self: flex-start;
  padding: 2px 8px;
  border-radius: 6px;
  background: #24365e;
  color: $texto-3;
  font-weight: 900;
  font-size: 10px;
  letter-spacing: .06em;

  &.is-waiting_us { background: rgba(255, 211, 90, .16); color: $amarillo; }
  &.is-waiting_player { background: rgba(63, 124, 240, .18); color: #9fc0ff; }
}

/* ── Los mensajes ─────────────────────────────────────────────────── */

.mb-sop__atras {
  align-self: flex-start;
  height: 30px;
  padding: 0 8px;
  border: 0;
  background: transparent;
  color: $texto-3;
  font-family: inherit;
  font-weight: 800;
  font-size: 13px;
  cursor: pointer;
  @include foco;
}

.mb-sop__msg {
  align-self: flex-start;
  max-width: 80%;
  padding: 10px 12px;
  border-radius: 14px;
  background: $panel-hover;
  font-size: 14px;
  line-height: 1.45;
  overflow-wrap: anywhere;

  &.is-mio { align-self: flex-end; background: #2f6fe0; }
}

.mb-sop__quien { display: block; font-weight: 800; font-size: 11px; color: #9fc0ff; }

.mb-sop__escribir {
  display: flex;
  gap: 8px;
  padding: 10px 12px;
  border-top: 1px solid $borde;

  input {
    flex: 1;
    min-width: 0;
    height: 42px;
    padding: 0 12px;
    border-radius: 10px;
    border: 1px solid $borde-fuerte;
    background: $panel-alto;
    color: #fff;
    font-family: inherit;
    font-size: 14px;
    &:focus { outline: none; border-color: $azul; }
  }
}

.mb-sop__mandar {
  width: 42px;
  height: 42px;
  flex: none;
  border-radius: 10px;
  border: 0;
  background: $azul;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  @include foco;
  &:disabled { opacity: .5; cursor: default; }
}

/* ── La ayuda ─────────────────────────────────────────────────────── */

.mb-sop__buscar {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 42px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid $borde-fuerte;
  background: $panel-alto;

  input {
    flex: 1;
    min-width: 0;
    border: 0;
    outline: none;
    background: transparent;
    color: #fff;
    font-family: inherit;
    font-size: 14px;
  }
}

.mb-sop__grupo { display: flex; flex-direction: column; gap: 6px; }

.mb-sop__grupo-t {
  margin-top: 6px;
  font-weight: 900;
  font-size: 11px;
  letter-spacing: .1em;
  color: $texto-4;
}

.mb-sop__q {
  border-radius: 10px;
  background: $panel-hover;
  overflow: hidden;

  button {
    width: 100%;
    min-height: 40px;
    padding: 8px 12px;
    border: 0;
    background: transparent;
    color: #fff;
    font-family: inherit;
    font-weight: 700;
    font-size: 14px;
    text-align: left;
    cursor: pointer;
    @include foco;
  }

  p { margin: 0; padding: 0 12px 12px; font-size: 13px; line-height: 1.5; color: $texto-3; }
}

/* ── Las solapas ──────────────────────────────────────────────────── */

.mb-sop__solapas {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border-top: 1px solid $borde;
  background: $fondo;

  button {
    position: relative;
    height: 62px;
    border: 0;
    background: transparent;
    color: $texto-4;
    font-family: inherit;
    font-weight: 800;
    font-size: 12px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 5px;
    @include foco;

    &.is-activa { color: #fff; }
  }
}
</style>
