<template>
  <div class="mb-carrera">
    <p v-if="!carrera" class="mb-vacio">{{ $t('common.loading') }}</p>

    <template v-else>
      <!-- ── El cartel ────────────────────────────────────────────── -->
      <section class="mb-cartel">
        <span class="mb-cartel__halo" aria-hidden="true"></span>
        <span class="mb-cartel__rayos" aria-hidden="true"></span>
        <span class="mb-cartel__lineas" aria-hidden="true"></span>
        <span class="mb-cartel__foto" aria-hidden="true"></span>

        <h1>
          <span class="mb-cartel__pozo">{{ pozoCorto }}</span>
          <span class="mb-cartel__tipo">{{ $t('races.' + tipo) }}</span>
        </h1>

        <span class="mb-cartel__raya" aria-hidden="true"></span>
        <span class="mb-cartel__rotulo">{{ $t('races.endsIn') }}</span>

        <div class="mb-reloj">
          <div v-for="c in reloj" :key="c.l" class="mb-reloj__parte">
            <span class="mb-reloj__n">{{ c.v }}</span>
            <span class="mb-reloj__l">{{ $t('races.' + c.l) }}</span>
          </div>
        </div>

        <div class="mb-cartel__pie">
          <div class="mb-cartel__tabs" role="tablist" :aria-label="$t('nav.races')">
            <router-link
              v-for="t in TIPOS" :key="t" :to="`/races/${t}`" role="tab"
              :aria-selected="tipo === t ? 'true' : 'false'"
              :class="{ 'is-activa': tipo === t }"
            >{{ $t('races.' + t + 'Short') }}</router-link>
          </div>

          <button type="button" :aria-expanded="comoAbierto ? 'true' : 'false'" @click="comoAbierto = !comoAbierto">
            {{ $t('races.howItWorks') }}
          </button>
        </div>
      </section>

      <div v-if="comoAbierto" class="mb-como-va">
        <div v-for="(p, i) in [1, 2, 3]" :key="i">
          <span class="mb-como-va__t">{{ i + 1 }}. {{ $t('races.step' + (i + 1)) }}</span>
          <span class="mb-como-va__s">{{ $t('races.step' + (i + 1) + 'Sub') }}</span>
        </div>
      </div>

      <!-- ── El podio ─────────────────────────────────────────────── -->
      <section class="mb-podio" :aria-label="$t('races.top3')">
        <div
          v-for="p in podio" :key="p.puesto" class="mb-podio__lugar"
          :class="{ 'is-vacio': !p.username }"
        >
          <span class="mb-podio__premio">
            <span class="mb-sc mb-sc--16" aria-hidden="true">SC</span>{{ plata(p.premioSc) }}
          </span>
          <span class="mb-podio__nombre">{{ p.username || '—' }}</span>

          <span class="mb-podio__avatar" :style="{ background: p.fondo, borderColor: p.anillo }">
            {{ p.inicial }}
            <!-- Los laureles del prototipo, a los costados del primero. -->
            <span v-if="p.puesto === 1" class="mb-podio__laurel" aria-hidden="true">
              <svg width="26" height="34" viewBox="0 0 26 34" fill="none" :stroke="p.anillo" stroke-width="2" stroke-linecap="round">
                <path d="M22 4C12 7 6 14 5 24M20 9c-6 2-10 7-11 14M18 15c-4 2-7 5-8 10" />
              </svg>
            </span>
          </span>

          <div class="mb-podio__base" :style="{ height: p.alto, borderColor: p.anillo }">
            <span class="mb-podio__puesto" :style="{ color: p.anillo }">{{ $t('races.place' + p.puesto) }}</span>
            <span class="mb-podio__jugado">
              <span class="mb-sc mb-sc--13" aria-hidden="true">SC</span>{{ plata(p.jugadoSc) }}
              {{ $t('races.wagered') }}
            </span>
          </div>
        </div>
      </section>

      <!-- ── Lo mío ───────────────────────────────────────────────── -->
      <div class="mb-mio">
        <div class="mb-mio__dato">
          <span>{{ $t('races.yourWager') }}</span>
          <b>{{ carrera.yo && carrera.yo.jugadoSc ? plata(carrera.yo.jugadoSc) : '—' }}</b>
        </div>
        <div class="mb-mio__dato">
          <span>{{ $t('races.yourPosition') }}</span>
          <b>{{ carrera.yo && carrera.yo.puesto ? '#' + carrera.yo.puesto : '—' }}</b>
        </div>
      </div>

      <!-- ── La tabla ─────────────────────────────────────────────── -->
      <div class="mb-tabla-c">
        <div class="mb-tabla-c__cabeza">
          <span>#</span>
          <span>{{ $t('races.player') }}</span>
          <span>{{ $t('races.wageredShort') }}</span>
          <span>{{ $t('races.prize') }}</span>
        </div>

        <p v-if="!carrera.filas.length" class="mb-tabla-c__vacio">{{ $t('races.nobodyYet') }}</p>

        <div
          v-for="f in carrera.filas" :key="f.puesto"
          class="mb-tabla-c__fila" :class="{ 'is-yo': f.soyYo }"
        >
          <span class="mb-tenue">{{ f.puesto }}</span>
          <span class="mb-tabla-c__quien">{{ f.username }}</span>
          <span class="mb-der">{{ plata(f.jugadoSc) }}</span>
          <span class="mb-der" :class="f.premioSc > 0 ? 'mb-verde' : 'mb-tenue'">
            {{ f.premioSc > 0 ? plata(f.premioSc) : '—' }}
          </span>
        </div>
      </div>

      <!-- ── Las que ya cerraron ──────────────────────────────────── -->
      <section v-if="pasadas.length" class="mb-pasadas">
        <h2>{{ $t('races.past') }}</h2>
        <div v-for="c in pasadas" :key="c._id" class="mb-pasada">
          <div class="mb-pasada__cabeza">
            <span>{{ fecha(c.desde) }} – {{ fecha(c.hasta) }}</span>
            <span class="mb-pasada__pozo">
              <span class="mb-sc mb-sc--16" aria-hidden="true">SC</span>{{ plata(c.premioTotalSc) }}
            </span>
          </div>
          <ol class="mb-pasada__lista">
            <li v-for="g in c.ganadores.slice(0, 3)" :key="g.puesto">
              <b>{{ g.username }}</b>
              <span class="mb-verde">{{ plata(g.premioSc) }}</span>
            </li>
          </ol>
        </div>
      </section>
    </template>
  </div>
</template>

<script>
import api from "@/api";

const TIPOS = ["daily", "weekly", "monthly"];

/* Los tres colores del podio: oro, plata y bronce. */
const PODIO = [
  { anillo: "#ffd35a", fondo: "#8a6a1a", alto: "120px" },
  { anillo: "#c9d7f7", fondo: "#51607e", alto: "96px" },
  { anillo: "#d8974a", fondo: "#7a5126", alto: "78px" },
];

/**
 * UNA CARRERA.
 *
 * El cartel con el pozo y el reloj, el podio de tres, la tabla de
 * cincuenta y las que ya cerraron.
 *
 * EL RELOJ CORRE ACA, PERO LA HORA LA DICE EL SERVIDOR
 *
 * Lo que llega es el momento exacto en que cierra. El segundero de esta
 * pantalla solo lo dibuja. Si contara desde "ahora" del navegador, un
 * teléfono con el reloj atrasado mostraría que faltan dos horas cuando
 * ya cerró.
 */
export default {
  name: "RaceView",

  data() {
    return {
      TIPOS,
      carrera: null,
      pasadas: [],
      comoAbierto: false,
      ahora: Date.now(),
      reloj_: null,
      refresco: null,
    };
  },

  computed: {
    tipo() { return TIPOS.includes(this.$route.params.tipo) ? this.$route.params.tipo : "weekly"; },

    /* "$10K" como en el diseño, no "SC 10,000.00". */
    pozoCorto() {
      const v = this.carrera ? this.carrera.premioTotalSc : 0;
      if (v >= 1000) return "$" + Math.round(v / 1000) + "K";
      return "$" + Math.round(v);
    },

    /** Lo que falta, partido en días, horas, minutos y segundos. */
    reloj() {
      if (!this.carrera) return [];
      const falta = Math.max(0, new Date(this.carrera.hasta).getTime() - this.ahora);
      const s = Math.floor(falta / 1000);

      return [
        { l: "days", v: String(Math.floor(s / 86400)).padStart(2, "0") },
        { l: "hours", v: String(Math.floor((s % 86400) / 3600)).padStart(2, "0") },
        { l: "minutes", v: String(Math.floor((s % 3600) / 60)).padStart(2, "0") },
        { l: "seconds", v: String(s % 60).padStart(2, "0") },
      ];
    },

    /**
     * EL PODIO SIEMPRE TIENE TRES LUGARES.
     *
     * Aunque haya jugado una sola persona. Un podio de un escalón no se
     * lee como un podio, y además los otros dos lugares dicen cuánto
     * paga el segundo y el tercero, que es justo lo que mira el que
     * está pensando en entrar.
     *
     * El segundo va a la izquierda y el primero al medio: 2, 1, 3.
     */
    podio() {
      if (!this.carrera) return [];

      return [1, 0, 2].map((i) => {
        const f = this.carrera.filas[i];
        const puesto = i + 1;

        /* `reparto` son PORCENTAJES del pozo, no plata: el lugar vacio
           muestra lo que pagaria ese puesto. */
        const pct = (this.carrera.reparto || [])[i] || 0;
        const delPuesto = Math.round((this.carrera.premioTotalSc * pct) / 100 * 100) / 100;

        return {
          puesto,
          ...PODIO[i],
          username: f ? f.username : "",
          jugadoSc: f ? f.jugadoSc : 0,
          premioSc: f ? f.premioSc : delPuesto,
          inicial: f ? String(f.username || "?").charAt(0).toUpperCase() : "?",
        };
      });
    },
  },

  watch: {
    "$route.params.tipo"() { this.traer(); },
  },

  methods: {
    plata(n) {
      return Number(n || 0).toLocaleString("en-US", {
        minimumFractionDigits: 2, maximumFractionDigits: 2,
      });
    },

    fecha(d) {
      return new Date(d).toLocaleDateString(this.$i18n.locale, { day: "2-digit", month: "short" });
    },

    async traer() {
      try {
        const [c, p] = await Promise.all([
          api.get(`/races/${this.tipo}`),
          api.get("/races/past", { params: { tipo: this.tipo } }),
        ]);
        this.carrera = c.data.data;
        this.pasadas = p.data.data.items;
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      }
    },
  },

  created() {
    this.traer();
    /* El segundero, y un refresco de la tabla cada medio minuto: es una
       carrera, tiene que moverse sola. */
    this.reloj_ = window.setInterval(() => { this.ahora = Date.now(); }, 1000);
    this.refresco = window.setInterval(() => this.traer(), 30000);
  },

  beforeDestroy() {
    window.clearInterval(this.reloj_);
    window.clearInterval(this.refresco);
  },
};
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

.mb-carrera { display: flex; flex-direction: column; gap: 26px; }
.mb-vacio { margin: 40px 0; text-align: center; color: $texto-4; }

/* ── El cartel ────────────────────────────────────────────────────── */

.mb-cartel {
  position: relative;
  overflow: hidden;
  border-radius: 22px;
  background: #0e3a8c;
  border: 1px solid #2a5bd0;
  min-height: 330px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 28px 16px;
  text-align: center;

  > * { position: relative; }

  /*
    EN LA COMPUTADORA, EL TEXTO A LA IZQUIERDA.

    El arte que mando Dani trae las banderas a la derecha y el hueco a
    la izquierda: el texto va en ese hueco, que es para lo que el hueco
    esta. Centrado como estaba, el titulo y el reloj caian encima de
    las banderas y no se leia ni una cosa ni la otra.

    En el telefono sigue centrado: ahi la foto se recorta y no quedan
    dos mitades que respetar.
  */
  @include en-escritorio {
    align-items: flex-start;
    text-align: left;
    padding: 30px 44px;

    h1,
    .mb-cartel__raya,
    .mb-cartel__rotulo,
    .mb-reloj,
    .mb-cartel__pie { max-width: 52%; }

    h1 { justify-content: flex-start; }
    .mb-cartel__pie { justify-content: flex-start; }
    .mb-cartel__raya { width: min(380px, 100%); }
  }
}

.mb-cartel__halo {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 50% 45%, #2f6fe0 0%, #123f96 45%, #0a2560 100%);
}

.mb-cartel__rayos {
  position: absolute;
  inset: 0;
  background: repeating-conic-gradient(from 0deg at 50% 45%, rgba(255, 255, 255, .07) 0deg 4deg, rgba(255, 255, 255, 0) 4deg 14deg);
}

.mb-cartel__lineas {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(100deg, rgba(255, 255, 255, 0) 0 70px, rgba(255, 255, 255, .07) 70px 73px, rgba(255, 255, 255, 0) 73px 160px);
}

/*
  EL FONDO QUE MANDO DANI.

  Va arriba del halo y de los rayos y abajo del texto. Es la misma
  imagen que mando, con una sola cosa cambiada: el tono, del violeta al
  azul del sitio. No se le agrego ni se le saco nada.

  `cover` recorta arriba y abajo --la imagen es 2,6 y el cartel 3,5--,
  que es justo donde no hay nada.
*/
.mb-cartel__foto {
  position: absolute;
  inset: 0;
  background: url("/img/carreras/fondo.webp") center / cover no-repeat;

  /*
    EN EL TELEFONO, A MEDIA LUZ.

    Ahi el cartel es casi cuadrado: el texto lo llena entero y no queda
    mitad libre donde poner las banderas. A luz entera, "HS", "MIN" y
    "SEG" caian sobre el blanco de una bandera y no se leian.

    A la mitad la imagen se vuelve textura: se sigue viendo el arte y
    se lee todo. El 62% corre el encuadre para que entren las dos
    banderas y no el palo solo.
  */
  @include en-celular {
    opacity: .5;
    background-position: 62% center;
  }
}

.mb-cartel h1 {
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: center;
  gap: 0 14px;
  font-family: $fuente-cartel;
  font-weight: 400;
  line-height: 1;
  color: $amarillo;
  text-shadow: 0 3px 0 #a86a12, 0 6px 14px rgba(0, 0, 0, .35);
}

.mb-cartel__pozo { font-size: clamp(40px, 7vw, 68px); font-style: italic; }
.mb-cartel__tipo { font-size: clamp(30px, 5vw, 52px); }

.mb-cartel__raya {
  width: min(380px, 70%);
  height: 3px;
  border-radius: 2px;
  background: linear-gradient(90deg, rgba(255, 211, 90, 0), $amarillo, rgba(255, 211, 90, 0));
}

.mb-cartel__rotulo { font-weight: 900; font-size: 13px; letter-spacing: .14em; color: $amarillo; }

.mb-reloj { display: flex; gap: 10px; }
.mb-reloj__parte { display: flex; flex-direction: column; align-items: center; gap: 6px; }

.mb-reloj__n {
  width: clamp(50px, 7vw, 62px);
  height: clamp(50px, 7vw, 62px);
  border-radius: 12px;
  background: rgba(6, 18, 48, .72);
  border: 1px solid rgba(255, 211, 90, .55);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 900;
  font-size: clamp(20px, 3vw, 26px);
  font-variant-numeric: tabular-nums;
}

.mb-reloj__l { font-weight: 900; font-size: 11px; letter-spacing: .1em; color: #9cc4ff; }

.mb-cartel__pie {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  margin-top: 6px;

  button {
    height: 48px;
    padding: 0 18px;
    border-radius: 12px;
    border: 1px solid #2a5bd0;
    background: rgba(6, 18, 48, .72);
    color: #fff;
    font-family: inherit;
    font-weight: 700;
    font-size: 14px;
    cursor: pointer;
    @include foco;
  }
}

.mb-cartel__tabs {
  display: flex;
  gap: 4px;
  padding: 4px;
  border-radius: 12px;
  background: rgba(6, 18, 48, .72);
  border: 1px solid #2a5bd0;

  a {
    height: 40px;
    padding: 0 16px;
    border-radius: 9px;
    color: #fff;
    font-weight: 700;
    font-size: 14px;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    @include foco;
    &.is-activa { background: $azul; }
    &:hover { color: #fff; }
  }
}

.mb-como-va {
  padding: 18px 20px;
  border-radius: 16px;
  background: $panel-alto;
  border: 1px solid $borde;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
  gap: 16px;

  > div { display: flex; flex-direction: column; gap: 6px; }
}

.mb-como-va__t { font-weight: 900; font-size: 16px; }
.mb-como-va__s { font-size: 14px; line-height: 1.5; color: $texto-3; }

/* ── El podio ─────────────────────────────────────────────────────── */

.mb-podio {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: clamp(8px, 2vw, 18px);
  align-items: end;
  max-width: 760px;
  width: 100%;
  margin: 0 auto;
}

.mb-podio__lugar { display: flex; flex-direction: column; align-items: center; gap: 8px; min-width: 0; }
.mb-podio__lugar.is-vacio { opacity: .45; }

.mb-podio__laurel {
  position: absolute;
  left: -22px;
  top: 50%;
  transform: translateY(-50%);

  /* El de la derecha es el mismo dibujo, espejado. */
  &::after {
    content: "";
    position: absolute;
    left: 100%;
    top: 0;
    width: 26px;
    height: 34px;
    background: inherit;
  }
}

.mb-podio__premio { display: flex; align-items: center; gap: 5px; font-weight: 900; font-size: clamp(16px, 2.6vw, 24px); }

.mb-podio__nombre {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 700;
  font-size: clamp(11px, 1.6vw, 14px);
}

.mb-podio__avatar {
  position: relative;
  width: clamp(44px, 7vw, 64px);
  height: clamp(44px, 7vw, 64px);
  border-radius: 50%;
  border: 3px solid;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 900;
  font-size: clamp(14px, 2vw, 20px);
}

.mb-podio__base {
  width: 100%;
  border-radius: 16px 16px 0 0;
  background: $panel-alto;
  border: 1px solid;
  border-bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 6px;
  padding-top: 18px;
  box-sizing: border-box;
}

.mb-podio__puesto { font-family: $fuente-cartel; font-size: clamp(22px, 3.4vw, 32px); }
.mb-podio__jugado { font-weight: 700; font-size: clamp(10px, 1.4vw, 12px); color: $texto-4; text-align: center; }

/* ── Lo mío y la tabla ────────────────────────────────────────────── */

.mb-mio { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }

.mb-mio__dato {
  padding: 14px 18px;
  border-radius: 14px;
  background: $panel-alto;
  border: 1px solid $borde;
  display: flex;
  flex-direction: column;
  gap: 4px;

  span { font-weight: 900; font-size: 11px; letter-spacing: .1em; color: $texto-4; text-transform: uppercase; }
  b { font-weight: 900; font-size: 20px; }
}

.mb-tabla-c { border-radius: 16px; overflow: hidden; border: 1px solid $borde; }

.mb-tabla-c__cabeza, .mb-tabla-c__fila {
  display: grid;
  grid-template-columns: 48px minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr);
  gap: 8px;
  padding: 13px 16px;
}

.mb-tabla-c__cabeza {
  background: $panel;
  font-weight: 900;
  font-size: 11px;
  letter-spacing: .1em;
  color: $texto-4;
  text-transform: uppercase;
  padding: 12px 16px;
  span:nth-child(3), span:nth-child(4) { text-align: right; }
}

.mb-tabla-c__fila {
  border-top: 1px solid #1a2a45;
  font-weight: 700;
  font-size: 14px;
  background: $panel-alto;

  /* La fila del que mira, marcada: en una tabla de cincuenta, encontrar
     la propia sin esto es imposible. */
  &.is-yo { background: #1a3358; }
}

.mb-tabla-c__quien { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mb-tabla-c__vacio { margin: 0; padding: 30px; text-align: center; color: $texto-4; background: $panel-alto; }

.mb-der { text-align: right; font-variant-numeric: tabular-nums; }
.mb-tenue { color: $texto-4; }
.mb-verde { color: $verde; }

/* ── Las que ya cerraron ──────────────────────────────────────────── */

.mb-pasadas { display: flex; flex-direction: column; gap: 12px; h2 { margin: 0; font-weight: 900; font-size: 20px; } }

.mb-pasada {
  border-radius: 14px;
  background: $panel-alto;
  border: 1px solid $borde;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mb-pasada__cabeza { display: flex; justify-content: space-between; gap: 10px; font-size: 13px; color: $texto-3; }
.mb-pasada__pozo { display: flex; align-items: center; gap: 5px; font-weight: 900; color: #fff; }

.mb-pasada__lista {
  margin: 0;
  padding-left: 20px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 14px;

  li { display: flex; justify-content: space-between; gap: 10px; }
}
</style>
