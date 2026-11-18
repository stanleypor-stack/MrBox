<template>
  <div class="mb-vip">
    <!-- ── El cartel ────────────────────────────────────────────── -->
    <section class="mb-vcartel">
      <span class="mb-vcartel__luna" aria-hidden="true"></span>

      <div class="mb-vcartel__texto">
        <h1>MR BOX <span>{{ $t('nav.vip') }}</span></h1>
        <p>{{ $t('vip.sub') }}</p>

        <div v-if="miRango" class="mb-vcartel__caja">
          <div class="mb-vcartel__fila">
            <span class="mb-vcartel__ahora" :style="{ color: miRango.color }">{{ miRango.nombre }}</span>
            <span v-if="miRango.siguiente" class="mb-tenue">
              {{ $t('vip.nextIs', { rango: miRango.siguiente }) }}
            </span>
            <span v-else class="mb-tenue">{{ $t('vip.topTier') }}</span>
          </div>

          <div class="mb-vcartel__barra"><div :style="{ width: miRango.progreso + '%' }"></div></div>

          <div class="mb-vcartel__fila mb-tenue">
            <span>{{ $t('vip.played', { amount: plata(jugado) }) }}</span>
            <span v-if="miRango.faltaPara">{{ plata(miRango.faltaPara) }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- ── Las dos pestañas ─────────────────────────────────────── -->
    <div class="mb-vtabs" role="tablist" :aria-label="$t('nav.vip')">
      <button
        type="button" role="tab" :aria-selected="pestana === 'rangos' ? 'true' : 'false'"
        :class="{ 'is-activa': pestana === 'rangos' }" @click="pestana = 'rangos'"
      >{{ $t('vip.rankSystem') }}</button>
      <button
        type="button" role="tab" :aria-selected="pestana === 'preguntas' ? 'true' : 'false'"
        :class="{ 'is-activa': pestana === 'preguntas' }" @click="pestana = 'preguntas'"
      >{{ $t('home.faqTitle') }}</button>
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
            <span class="mb-rango__gema" aria-hidden="true"></span>
            <span class="mb-rango__quien">
              <span class="mb-rango__n">{{ String(r.numero).padStart(2, '0') }}</span>
              <span class="mb-rango__nombre">{{ r.nombre }}</span>
              <span class="mb-rango__desde">
                {{ r.desde === 0 ? $t('vip.startingTier') : $t('vip.fromPlayed', { amount: corto(r.desde) }) }}
              </span>
            </span>
          </div>

          <ul class="mb-rango__lista">
            <li v-for="b in r.beneficios" :key="b.clave" :class="{ 'is-si': b.tiene }">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path :d="b.tiene ? 'm5 12 5 5 9-10' : 'M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z'" />
              </svg>
              {{ $t('vip.perk.' + b.clave) }}
            </li>
          </ul>

          <div class="mb-rango__rake">
            <span>{{ $t('vip.rakeback') }}</span>
            <b>{{ (r.rakeback.monthly * 100).toFixed(2) }}%</b>
          </div>
        </article>
      </div>
    </section>

    <!-- ── Las preguntas, por grupo ─────────────────────────────── -->
    <section v-else class="mb-vfaq">
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

      <!--
        EL TRASLADO DE RANGO.

        El diseno lo cuenta en una pregunta: "mandale a soporte la
        prueba de tu rango en otro lado". Como el chat de soporte ya
        existe, el boton lo ABRE con el mensaje empezado en vez de
        dejar a la persona redactandolo de cero.
      -->
      <div v-if="grupo === 'transfer'" class="mb-vmatch">
        <div class="mb-vmatch__texto">
          <h2>{{ $t('vip.matchTitle') }}</h2>
          <p>{{ $t('vip.matchSub') }}</p>
          <ul>
            <li v-for="n in [1, 2, 3]" :key="n">{{ $t('vip.matchStep' + n) }}</li>
          </ul>
        </div>

        <button type="button" class="mb-vmatch__b" @click="pedirTraslado">
          {{ $t('vip.matchCta') }}
        </button>
      </div>
    </section>
  </div>
</template>

<script>
import { mapState } from "vuex";
import api from "@/api";

/*
  LAS PREGUNTAS, EN LOS CUATRO GRUPOS DEL DISENO.

  Antes eran cuatro sueltas. Separadas en grupos se pueden contestar
  cosas distintas sin hacer una lista de veinte: el que viene a preguntar
  por el traslado de rango no tiene que leer cuatro respuestas sobre como
  se sube.
*/
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
    return { GRUPOS, rangos: [], miRango: null, pestana: "rangos", grupo: "general", abierta: -1 };
  },

  computed: {
    ...mapState(["usuario"]),
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
.mb-vcartel__ahora { font-weight: 900; font-size: 18px; }

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

.mb-rango__rake {
  padding: 12px 16px;
  border-top: 1px solid $borde;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  color: $texto-3;
  b { font-size: 16px; color: $verde; }
}

/* ── Las preguntas ────────────────────────────────────────────────── */

.mb-vfaq { display: flex; flex-direction: column; gap: 10px; }

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

/* El traslado de rango, abajo de su grupo de preguntas. */
.mb-vmatch {
  margin-top: 6px;
  padding: 20px;
  border-radius: 18px;
  background: $panel-alto;
  border: 1px solid $borde-fuerte;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 18px;

  h2 { margin: 0 0 6px; font-weight: 900; font-size: 18px; }
  p { margin: 0 0 10px; font-size: 14px; line-height: 1.5; color: $texto-3; }
  ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: $texto-2; }
}

.mb-vmatch__texto { flex: 1 1 280px; min-width: 0; }

.mb-vmatch__b {
  flex: none;
  height: 50px;
  padding: 0 24px;
  border-radius: 25px;
  border: 2px solid #fff;
  background: linear-gradient(180deg, #4fa2ff, #2f6fe0);
  color: #fff;
  font-family: inherit;
  font-weight: 900;
  font-size: 15px;
  cursor: pointer;
  @include foco;
  &:hover { filter: brightness(1.06); }
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
