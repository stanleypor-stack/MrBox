<template>
  <div class="mb-vip">
    <!-- ── El cartel ────────────────────────────────────────────── -->
    <section class="mb-vcartel">
      <span class="mb-vcartel__luna" aria-hidden="true"></span>

      <div class="mb-vcartel__texto">
        <h1>MR BOX <span>{{ $t('nav.vip') }}</span></h1>
        <p>{{ $t('vip.sub') }}</p>

        <div v-if="miRango" class="mb-vcartel__caja">
          <div class="mb-vcartel__quien">
            <span class="mb-vcartel__avatar">{{ inicial }}</span>
            <span class="mb-vcartel__nombre">
              <b>{{ (usuario && usuario.username) || $t('nav.vip') }}</b>
              <span :style="{ color: miRango.color }">{{ miRango.nombre }}</span>
            </span>
            <span class="mb-vcartel__pct">{{ miRango.progreso }}%</span>
          </div>

          <div class="mb-vcartel__barra"><div :style="{ width: miRango.progreso + '%' }"></div></div>

          <div class="mb-vcartel__fila mb-tenue">
            <span>{{ $t('vip.played', { amount: plata(jugado) }) }}</span>
            <span v-if="miRango.faltaPara">{{ $t('vip.nextAt', { amount: corto(miRango.faltaPara), rango: miRango.siguiente }) }}</span>
            <span v-else>{{ $t('vip.topTier') }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- ── Las dos pestañas ─────────────────────────────────────── -->
    <div class="mb-vtabs" role="tablist" :aria-label="$t('nav.vip')">
      <button
        type="button" role="tab" :aria-selected="pestana === 'rangos' ? 'true' : 'false'"
        :class="{ 'is-activa': pestana === 'rangos' }" @click="pestana = 'rangos'"
      >{{ $t('vip.statuses') }}</button>
      <button
        type="button" role="tab" :aria-selected="pestana === 'explicado' ? 'true' : 'false'"
        :class="{ 'is-activa': pestana === 'explicado' }" @click="pestana = 'explicado'"
      >{{ $t('vip.explained') }}</button>
    </div>

    <!-- ── Los nueve rangos ─────────────────────────────────────── -->
    <section v-if="pestana === 'rangos'" class="mb-rangos">
      <div class="mb-rangos__cabeza">
        <div>
          <h2>{{ $t('vip.rankSystem') }}</h2>
          <p>{{ $t('vip.rankSystemSub') }}</p>
        </div>
        <div class="mb-flechas">
          <button type="button" :aria-label="$t('common.previous')" @click="correr(-1)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 6-6 6 6 6" /></svg>
          </button>
          <span aria-hidden="true"></span>
          <button type="button" :aria-label="$t('common.next')" @click="correr(1)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
          </button>
        </div>
      </div>

      <div ref="tira" class="mb-row mb-rangos__tira">
        <article
          v-for="r in rangos" :key="r.numero" class="mb-rango"
          :class="{ 'is-mio': miRango && miRango.numero === r.numero }"
        >
          <div class="mb-rango__alto" :style="{ background: r.color }">
            <span class="mb-rango__gema" aria-hidden="true">
              <!-- La gema del prototipo: cuatro caras con los colores
                   de su rango. Dibujada y no una imagen, asi pesa cero
                   y se ve nitida en cualquier pantalla. -->
              <svg width="50" height="50" viewBox="0 0 64 64">
                <ellipse cx="32" cy="58" rx="16" ry="3" fill="rgba(0,0,0,.35)" />
                <polygon points="20,12 44,12 54,25 32,57 10,25" :fill="gema(r)[3]" />
                <polygon points="22,14 42,14 38,25 26,25" :fill="gema(r)[0]" />
                <polygon points="12,25 22,14 26,25" :fill="gema(r)[1]" />
                <polygon points="42,14 52,25 38,25" :fill="gema(r)[2]" />
                <polygon points="12,25 26,25 32,55" :fill="gema(r)[1]" />
                <polygon points="26,25 38,25 32,55" :fill="gema(r)[0]" opacity=".9" />
                <polygon points="38,25 52,25 32,55" :fill="gema(r)[2]" />
                <polyline points="12,25 52,25" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1.2" />
                <polygon points="20,12 44,12 54,25 32,57 10,25" fill="none" :stroke="gema(r)[3]" stroke-width="2" stroke-linejoin="round" />
                <polygon points="24,16 31,16 28,22 22,22" fill="#ffffff" opacity=".75" />
                <path d="M50 6l1.6 3.6L55 11l-3.4 1.4L50 16l-1.6-3.6L45 11l3.4-1.4z" fill="#ffffff" opacity=".9" />
              </svg>
            </span>
            <span class="mb-rango__quien">
              <span class="mb-rango__n">{{ String(r.numero).padStart(2, '0') }}</span>
              <span class="mb-rango__nombre">{{ r.nombre }}</span>
              <span class="mb-rango__desde">
                {{ r.desde === 0 ? $t('vip.startingTier') : $t('vip.fromPlayed', { amount: corto(r.desde) }) }}
              </span>
            </span>
          </div>

          <ul class="mb-rango__lista">
            <li v-for="(b, k) in r.beneficios" :key="b.clave" :class="{ 'is-si': b.tiene }">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path :d="b.tiene ? 'm5 12 5 5 9-10' : 'M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z'" />
              </svg>
              {{ $t('vip.perk.' + b.clave) }}
              <!-- El que ESTE rango agrega, como en el prototipo. -->
              <span v-if="esNuevo(r, k)" class="mb-rango__nuevo">{{ $t('vip.new') }}</span>
            </li>
          </ul>

          <div class="mb-rango__pie">
            {{ r.desde === 0 ? $t('vip.everyoneStarts') : $t('vip.reachPlayed', { amount: corto(r.desde) }) }}
          </div>
        </article>
      </div>
    </section>

    <!-- ── Como funciona y los beneficios ───────────────────────── -->
    <section v-else class="mb-vcomo">
      <div class="mb-vcomo__parte">
        <h2>{{ $t('vip.howTitle') }}</h2>
        <div class="mb-vcomo__pasos">
          <div v-for="n in 3" :key="n" class="mb-vpaso">
            <span class="mb-vpaso__n">{{ n }}</span>
            <span class="mb-vpaso__t">{{ $t('vip.step' + n) }}</span>
            <span class="mb-vpaso__s">{{ $t('vip.step' + n + 'Sub') }}</span>
          </div>
        </div>
      </div>

      <div class="mb-vcomo__parte">
        <h2>{{ $t('vip.benefitsTitle') }}</h2>
        <p class="mb-tenue">{{ $t('vip.benefitsSub') }}</p>

        <div class="mb-vcomo__benes">
          <div v-for="b in BENEFICIOS" :key="b.id" class="mb-vbene">
            <span class="mb-vbene__ico" :style="{ background: b.tinte }" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2"
                   stroke-linecap="round" stroke-linejoin="round"><path :d="b.icono" /></svg>
            </span>
            <span class="mb-vbene__t">{{ $t('vip.bene.' + b.id) }}</span>
            <span class="mb-vbene__s">{{ $t('vip.beneSub.' + b.id) }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- ── A subir ──────────────────────────────────────────────── -->
    <div class="mb-vsubir">
      <router-link :to="entro ? '/boxes' : '/signup'">{{ $t('vip.levelUp') }}</router-link>
    </div>

    <!-- ── Las preguntas, por grupo ─────────────────────────────── -->
    <section class="mb-vfaq">
      <h2 class="mb-vfaq__titulo">{{ $t('home.faqTitle') }}</h2>
      <div class="mb-vfaq__grupos" role="tablist" :aria-label="$t('home.faqTitle')">
        <button
          v-for="g in GRUPOS" :key="g.id" type="button" role="tab"
          :aria-selected="grupo === g.id ? 'true' : 'false'"
          :class="{ 'is-activo': grupo === g.id }"
          @click="grupo = g.id; abierta = -1"
        >{{ $t('vipFaq.g.' + g.id) }}</button>
      </div>

      <div
        v-for="(q, i) in preguntas" :key="q" class="mb-vfaq__item"
        :class="{ 'is-abierta': abierta === i }"
      >
        <button type="button" :aria-expanded="abierta === i ? 'true' : 'false'" @click="abierta = abierta === i ? -1 : i">
          {{ $t('vipFaq.' + q + '.q') }}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.8"
               stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
               :style="{ transform: abierta === i ? 'rotate(180deg)' : 'rotate(0deg)' }">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        <p v-if="abierta === i">{{ $t('vipFaq.' + q + '.a') }}</p>
      </div>

    </section>

    <!--
      EL TRASLADO DE RANGO.

      El cartel del prototipo, abajo de todo y siempre a la vista. El
      boton abre el chat de soporte con el mensaje empezado: del otro
      lado lo contesta una persona que tiene que mirar una captura, y
      eso ya es soporte.
    -->
    <section class="mb-vmatch">
      <div class="mb-vmatch__texto">
        <h2>{{ $t('vip.matchTitle') }}</h2>
        <p>{{ $t('vip.matchSub') }}</p>
      </div>

      <button type="button" class="mb-vmatch__b" @click="pedirTraslado">
        {{ $t('vip.matchCta') }}
      </button>
    </section>
  </div>
</template>

<script>
import { mapState, mapGetters } from "vuex";
import api from "@/api";

/*
  LAS PREGUNTAS, EN LOS CUATRO GRUPOS DEL DISENO.

  Antes eran cuatro sueltas. Separadas en grupos se pueden contestar
  cosas distintas sin hacer una lista de veinte: el que viene a preguntar
  por el traslado de rango no tiene que leer cuatro respuestas sobre como
  se sube.
*/
/*
  LOS SEIS BENEFICIOS, los del prototipo. El texto vive en los idiomas;
  acá solo están el color y el dibujo, que no se traducen.
*/
const BENEFICIOS = [
  { id: "boost", tinte: "#3f7cf0", icono: "M13 2 4 14h7l-1 8 9-12h-7z" },
  { id: "coinBack", tinte: "#16936d", icono: "M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" },
  { id: "levelBox", tinte: "#d27d16", icono: "M12 19V5M5 12l7-7 7 7" },
  { id: "topUp", tinte: "#b8862a", icono: "M12 5v14M5 12h14" },
  { id: "manager", tinte: "#c42a45", icono: "M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 21a8 8 0 0 1 16 0" },
  { id: "vipBoxes", tinte: "#7a5af5", icono: "M3 8l4 4 5-7 5 7 4-4-2 11H5z" },
];

/*
  LOS COLORES DE CADA GEMA, los del prototipo: cara clara, media,
  oscura y el contorno. Uno por rango, en orden.
*/
const GEMAS = [
  ["#ffd2a6", "#e0954f", "#a65f28", "#5e3414"],
  ["#ffffff", "#d3dae6", "#97a4ba", "#4f5b70"],
  ["#fff3a6", "#ffd04a", "#dc9c1c", "#7a4c06"],
  ["#b9dbff", "#5b98ff", "#2058d0", "#0e2b70"],
  ["#b4ffe0", "#3ddca0", "#11a171", "#06513a"],
  ["#ffc0cc", "#ff5574", "#cc2747", "#6a0a1d"],
  ["#ffffff", "#c6f3ff", "#6acdf4", "#1f6f9c"],
  ["#a9b1c2", "#646d82", "#30353f", "#0d0f14"],
  ["#ffe6fb", "#d2bdff", "#9270ff", "#4a2fb0"],
];

const GRUPOS = [
  { id: "general", preguntas: ["counts", "lose", "signup", "purchase"] },
  { id: "benefits", preguntas: ["rakeback", "boost", "levelUp"] },
  { id: "transfer", preguntas: ["match", "proof"] },
  { id: "managers", preguntas: ["manager", "reload"] },
];

/**
 * EL CLUB VIP.
 *
 * Nueve rangos. Se sube JUGANDO y no gastando, y el rango no se pierde
 * nunca: ni dejando de jugar seis meses.
 *
 * Esa diferencia no es un detalle de redacción. Un club que se mide por
 * lo depositado premia al que pone plata; uno que se mide por lo jugado
 * premia al que se queda. Son dos negocios distintos.
 */
export default {
  name: "VipView",

  data() {
    return {
      GRUPOS, BENEFICIOS,
      rangos: [], miRango: null, pestana: "rangos", grupo: "general", abierta: -1,
    };
  },

  computed: {
    ...mapState(["usuario"]),
    ...mapGetters(["entro"]),

    inicial() {
      return String((this.usuario && this.usuario.username) || "?").charAt(0).toUpperCase();
    },
    jugado() { return (this.usuario && this.usuario.jugadoSc) || 0; },

    preguntas() {
      const g = this.GRUPOS.find((x) => x.id === this.grupo);
      return g ? g.preguntas : [];
    },
  },

  methods: {
    plata(n) {
      return Number(n || 0).toLocaleString("en-US", {
        minimumFractionDigits: 2, maximumFractionDigits: 2,
      });
    },

    /** "25K", "1.5M": en una tarjeta de 250px no entra "1,500,000.00". */
    corto(n) {
      if (n >= 1000000) return (n / 1000000).toFixed(n % 1000000 ? 1 : 0) + "M";
      if (n >= 1000) return Math.round(n / 1000) + "K";
      return String(n);
    },

    /**
     * Pedir el traslado de rango.
     *
     * Abre el chat de soporte con el mensaje empezado. No hay una
     * pantalla aparte a proposito: del otro lado lo contesta una
     * persona que tiene que mirar una captura, y eso ya es soporte.
     */
    pedirTraslado() {
      if (!this.$store.getters.entro) {
        this.$router.push("/login");
        return;
      }
      this.$store.dispatch("pedirSoporte", this.$t("vip.matchMessage"));
    },

    /**
     * El beneficio que ESTE rango agrega.
     *
     * Es el último que tiene y el anterior no: el prototipo le pone la
     * chapita NUEVO. Se calcula mirando el rango de antes en vez de
     * guardarlo, así el día que se corra un beneficio de rango la
     * chapita se mueve sola.
     */
    gema(rango) { return GEMAS[(rango.numero || 1) - 1] || GEMAS[0]; },

    esNuevo(rango, i) {
      if (rango.numero <= 1) return false;
      const antes = this.rangos[rango.numero - 2];
      if (!antes) return false;
      return rango.beneficios[i].tiene && !antes.beneficios[i].tiene;
    },

    correr(hacia) {
      const tira = this.$refs.tira;
      if (!tira) return;
      tira.scrollBy({ left: hacia * Math.max(264, tira.clientWidth - 264), behavior: "smooth" });
    },

    async traer() {
      try {
        const { data } = await api.get("/vip");
        this.rangos = data.data.rangos;
        this.miRango = data.data.miRango;
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      }
    },
  },

  created() { this.traer(); },
  watch: { usuario() { this.traer(); } },
};
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

.mb-vip { display: flex; flex-direction: column; gap: 28px; }

/* ── El cartel ────────────────────────────────────────────────────── */

.mb-vcartel {
  position: relative;
  overflow: hidden;
  border-radius: 22px;
  background: #1b2f6e;
  border: 1px solid #2f4fa0;
  min-height: 230px;
  display: flex;
  align-items: center;
}

.mb-vcartel__luna {
  position: absolute;
  right: -60px;
  top: -80px;
  width: 380px;
  height: 380px;
  border-radius: 50%;
  background: $azul;
  opacity: .35;
}

.mb-vcartel__texto {
  position: relative;
  padding: 28px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: min(560px, 100%);

  h1 {
    margin: 0;
    font-family: $fuente-cartel;
    font-weight: 400;
    font-size: clamp(1.8rem, 4.4vw, 2.75rem);
    line-height: 1.05;
    text-shadow: 0 4px 0 $azul-hondo, 0 7px 0 $azul-tinta;
    span { color: $amarillo-v; }
  }

  p { margin: 0; font-size: 15px; line-height: 1.5; color: #d4e0fb; }
}

.mb-vcartel__caja {
  width: min(100%, 480px);
  box-sizing: border-box;
  border-radius: 16px;
  background: rgba(8, 14, 30, .78);
  border: 1px solid rgba(255, 255, 255, .14);
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.mb-vcartel__fila { display: flex; justify-content: space-between; gap: 10px; font-size: 13px; font-weight: 700; }

.mb-vcartel__quien { display: flex; align-items: center; gap: 12px; }

.mb-vcartel__avatar {
  width: 44px;
  height: 44px;
  flex: none;
  border-radius: 12px;
  background: $azul;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: $fuente-cartel;
  font-size: 20px;
}

.mb-vcartel__nombre {
  display: flex;
  flex-direction: column;
  min-width: 0;
  b { font-weight: 900; font-size: 16px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  span { font-weight: 800; font-size: 13px; }
}

.mb-vcartel__pct { margin-left: auto; font-weight: 900; font-size: 20px; }

.mb-vcartel__barra {
  height: 8px;
  border-radius: 4px;
  background: #0b1730;
  overflow: hidden;
  div { height: 100%; background: $amarillo-v; }
}

.mb-tenue { color: $texto-3; }

/* ── Las pestañas ─────────────────────────────────────────────────── */

.mb-vtabs {
  align-self: center;
  display: flex;
  gap: 4px;
  padding: 5px;
  border-radius: 14px;
  background: $panel-alto;
  border: 1px solid $borde;

  button {
    height: 44px;
    padding: 0 20px;
    border-radius: 10px;
    border: 0;
    background: transparent;
    color: #fff;
    font-family: inherit;
    font-weight: 800;
    font-size: 15px;
    cursor: pointer;
    @include foco;
    &.is-activa { background: $azul; }
  }
}

/* ── Los rangos ───────────────────────────────────────────────────── */

.mb-rangos { display: flex; flex-direction: column; gap: 16px; }

.mb-rangos__cabeza {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;

  h2 { margin: 0; font-weight: 800; font-size: 28px; }
  p { margin: 6px 0 0; max-width: 640px; font-size: 15px; line-height: 1.5; color: $texto-3; }
}

.mb-flechas {
  display: flex;
  border-radius: 12px;
  overflow: hidden;
  background: #1d3354;

  button {
    width: 48px;
    height: 44px;
    border: 0;
    background: transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    @include foco;
    &:hover { background: $lateral-hover; }
  }

  span { width: 1px; background: #2c4670; }
}

.mb-rangos__tira { display: flex; gap: 14px; overflow-x: auto; scroll-behavior: smooth; padding-bottom: 4px; }

.mb-rango {
  flex: none;
  width: 250px;
  border-radius: 18px;
  overflow: hidden;
  background: $panel-alto;
  border: 1px solid $borde;
  display: flex;
  flex-direction: column;

  &.is-mio { border-color: $amarillo-v; }
}

.mb-rango__alto { padding: 18px; display: flex; align-items: center; gap: 14px; }

.mb-rango__gema {
  width: 60px;
  height: 60px;
  flex: none;
  border-radius: 16px;
  background: radial-gradient(circle at 50% 40%, rgba(255, 255, 255, .35), rgba(255, 255, 255, .06) 70%);
  border: 2px solid rgba(255, 255, 255, .4);
  display: flex;
  align-items: center;
  justify-content: center;
}

.mb-rango__quien { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.mb-rango__n { font-family: $fuente-cartel; font-size: 13px; opacity: .8; }
.mb-rango__nombre { font-weight: 900; font-size: 18px; }
.mb-rango__desde { font-size: 12px; opacity: .85; }

.mb-rango__lista {
  margin: 0;
  padding: 14px 16px;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;

  li {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 700;
    color: $placeholder;
    &.is-si { color: #fff; }
  }
}

.mb-rango__pie {
  padding: 12px 18px;
  border-top: 1px solid $borde;
  text-align: center;
  font-weight: 800;
  font-size: 13px;
  color: $texto-4;
}

.mb-rango__nuevo {
  margin-left: auto;
  padding: 2px 7px;
  border-radius: 6px;
  background: $amarillo-v;
  color: $azul-tinta;
  font-weight: 900;
  font-size: 10px;
  letter-spacing: .06em;
}

/* ── Como funciona y los beneficios ───────────────────────────────── */

.mb-vcomo { display: flex; flex-direction: column; gap: 24px; }
.mb-vcomo__parte { display: flex; flex-direction: column; gap: 14px; h2 { margin: 0; font-weight: 800; font-size: 28px; } p { margin: -8px 0 0; font-size: 15px; } }

.mb-vcomo__pasos { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: 14px; }

.mb-vpaso {
  border-radius: 18px;
  background: $panel-alto;
  border: 1px solid $borde;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.mb-vpaso__n {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: $azul;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: $fuente-cartel;
  font-size: 20px;
}

.mb-vpaso__t { font-weight: 900; font-size: 19px; }
.mb-vpaso__s { font-size: 15px; line-height: 1.5; color: $texto-3; }

.mb-vcomo__benes { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr)); gap: 14px; }

.mb-vbene {
  border-radius: 18px;
  background: $panel-alto;
  border: 1px solid $borde;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.mb-vbene__ico {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mb-vbene__t { font-weight: 900; font-size: 18px; }
.mb-vbene__s { font-size: 14px; line-height: 1.55; color: $texto-3; }

/* ── El boton de subir ────────────────────────────────────────────── */

.mb-vsubir {
  display: flex;
  justify-content: center;

  a {
    padding: 16px 32px;
    border-radius: 14px;
    background: $azul;
    box-shadow: 0 5px 0 $azul-hondo;
    text-decoration: none;
    color: #fff;
    font-family: $fuente-cartel;
    font-size: 22px;
    @include foco;
    &:hover { color: #fff; filter: brightness(1.06); }
  }
}

/* ── Las preguntas ────────────────────────────────────────────────── */

.mb-vfaq { display: flex; flex-direction: column; gap: 10px; }
.mb-vfaq__titulo { margin: 0 0 4px; font-weight: 800; font-size: 28px; }

.mb-vfaq__grupos {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 4px;

  button {
    height: 40px;
    padding: 0 16px;
    border-radius: 12px;
    border: 1px solid $borde-fuerte;
    background: $panel;
    color: $texto-2;
    font-family: inherit;
    font-weight: 800;
    font-size: 14px;
    cursor: pointer;
    @include foco;

    &:hover { background: $panel-hover; color: #fff; }
    &.is-activo { background: $azul; border-color: $azul; color: #fff; }
  }
}

/* El cartel del traslado de rango, abajo de todo. */
.mb-vmatch {
  position: relative;
  overflow: hidden;
  border-radius: 22px;
  background: #173262;
  border: 1px solid #2a4a85;
  padding: 26px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 18px;

  h2 {
    margin: 0 0 8px;
    font-family: $fuente-cartel;
    font-weight: 400;
    font-size: 28px;
    line-height: 1.1;
  }

  p { margin: 0; font-size: 15px; line-height: 1.55; color: #d4e0fb; }
}

.mb-vmatch__texto { flex: 1 1 280px; min-width: 0; }

.mb-vmatch__b {
  flex: none;
  padding: 15px 26px;
  border-radius: 14px;
  border: 0;
  background: $amarillo-v;
  box-shadow: 0 5px 0 #c9921a;
  color: $azul-tinta;
  font-family: inherit;
  font-weight: 900;
  font-size: 16px;
  cursor: pointer;
  @include foco;
  &:hover { filter: brightness(1.04); }
}


.mb-vfaq__item {
  border-radius: 10px;
  background: $panel-alto;
  overflow: hidden;
  transition: background .2s ease;

  &.is-abierta { background: #1a3358; }

  button {
    width: 100%;
    min-height: 60px;
    padding: 0 20px;
    border: 0;
    background: transparent;
    color: #fff;
    font-family: inherit;
    font-weight: 800;
    font-size: 16px;
    text-align: left;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    @include foco;
    svg { flex: none; transition: transform .2s ease; }
  }

  p { margin: 0; padding: 0 20px 18px; font-size: 14px; line-height: 1.6; color: $texto-3; }
}
</style>
