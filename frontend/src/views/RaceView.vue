<template>
  <div class="mb-carrera">
    <p v-if="!carrera" class="mb-vacio">{{ $t('common.loading') }}</p>

    <template v-else>
      <!-- ── El cartel ────────────────────────────────────────────── -->
      <section class="mb-cartel">
        <span class="mb-cartel__bandera" aria-hidden="true"></span>

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

      </section>

      <!--
        LOS BOTONES VAN ABAJO DEL CARTEL, NO ADENTRO.

        Como en mrloot. Adentro ocupaban dos renglones en el telefono y
        empujaban el cartel a los 330px de alto; afuera el cartel queda
        del tamano del titulo y el reloj, que es lo que tiene que
        mostrar.
      -->
      <div class="mb-cartel__pie">
        <div class="mb-cartel__tabs" role="tablist" :aria-label="$t('nav.races')">
          <router-link
            v-for="t in TIPOS" :key="t" :to="`/races/${t}`" role="tab"
            :aria-selected="tipo === t ? 'true' : 'false'"
            :class="{ 'is-activa': tipo === t }"
          >{{ $t('races.' + t + 'Short') }}</router-link>
        </div>

        <!-- Una rueda con un signo de pregunta, como la de ellos. El
             texto sigue estando para quien no ve el dibujo. -->
        <button
          type="button" class="mb-cartel__ayuda"
          :aria-expanded="comoAbierto ? 'true' : 'false'"
          :aria-label="$t('races.howItWorks')" :title="$t('races.howItWorks')"
          @click="comoAbierto = !comoAbierto"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M9.4 9.2a2.7 2.7 0 0 1 5.2.9c0 1.8-2.6 2.2-2.6 3.9M12 17.4h.01" />
          </svg>
        </button>
      </div>

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

    /*
      SOLO LA CARRERA EN CURSO.

      Antes se pedia tambien `/races/past`. Esa lista no se muestra mas
      --Dani no la quiere-- y el pedido se va con ella: esconder el
      bloque y seguir pidiendola seria traer, dos veces por minuto y en
      cada visita, algo que nadie mira.
    */
    async traer() {
      try {
        const { data } = await api.get(`/races/${this.tipo}`);
        this.carrera = data.data;
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
  /*
    EL MISMO DEGRADE QUE LA FOTO, PARA QUE NO HAYA COSTURA.

    Estaba en un #1c242c liso. Ese numero salio de medir la foto en
    cinco puntos, y la medicion fue pobre: la foto NO es lisa, tiene un
    degrade vertical que va de un azul casi negro arriba a un azul
    medio abajo. El liso empataba solo con la franja de arriba, asi que
    la mitad izquierda se veia apagada y aparecia una linea donde
    empezaba la foto.

    Estos nueve pasos son el borde izquierdo de la foto medido cada
    12,5% de alto. Con el degrade igual, el azul cruza el cartel entero
    y no se ve donde termina el fondo y empieza la imagen.

    Antes de todo esto habia un degrade azul fuerte con rayos en
    abanico. Era del cartel viejo, cuando el cartel era todo fondo.
  */
  background:
    /*
      EL RESPLANDOR DE LA FOTO, SEGUIDO HACIA LA IZQUIERDA.

      La foto tiene un halo azul detras de las banderas --#5398f7, lo
      mas fuerte a un 80% de su ancho-- y se cortaba justo donde
      terminaba la imagen. Repetirlo en el fondo, centrado un poco mas
      adentro, hace que el azul cruce el cartel entero en vez de
      quedarse de un lado.
    */
    radial-gradient(125% 150% at 64% 26%,
      rgba(83, 152, 247, .40) 0%,
      rgba(83, 152, 247, .16) 44%,
      rgba(83, 152, 247, 0) 72%),
    /* Y abajo el borde izquierdo de la foto, medido cada 12,5% de
       alto, para que el empalme no se note a ninguna altura. */
    linear-gradient(
      180deg,
      #1d2737 0%,
      #1e2833 12.5%,
      #202c38 25%,
      #233043 37.5%,
      #253a55 50%,
      #2c466b 62.5%,
      #2f517e 75%,
      #335a8f 87.5%,
      #37629e 100%
    );
  border: 1px solid rgba(255, 255, 255, .07);
  /* 214px en pantalla, que es el alto del de mrloot. Medido en el
     suyo, al lado del nuestro. El nuestro media 330. */
  min-height: calc(214px / var(--escala, 1));
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  /* Justo: con 14 de aire y 30 de relleno el cartel se iba a 232 y el
     de ellos mide 214. */
  gap: 10px;

  /*
    EL TEXTO A LA IZQUIERDA Y LA BANDERA AL COSTADO, COMO MRLOOT.

    El texto se queda en su columna --poco mas de la mitad-- y la
    bandera vive en el resto. Centrado, el titulo y el reloj le pasaban
    por encima.
  */
  align-items: flex-start;
  text-align: left;
  padding: 24px 44px;

  > * { position: relative; }

  h1, .mb-cartel__raya, .mb-cartel__rotulo, .mb-reloj { max-width: 52%; }
  .mb-cartel__raya { width: min(380px, 100%); }
  .mb-cartel__pie { justify-content: flex-start; }

  /*
    EN EL TELEFONO, MAS JUNTO.

    La columna de la izquierda tiene 64% de 345px: ahi adentro el
    titulo de 68 y las cajas de 62 del escritorio no entran ni de
    casualidad. Se achican, y los botones se van abajo de todo a lo
    ancho, que es donde los pone mrloot.
  */
  @include en-celular {
    /* El alto lo pone el contenido: titulo, reloj y nada mas. */
    min-height: 0;
    padding: 18px 16px;
    gap: 8px;

    h1, .mb-cartel__raya, .mb-cartel__rotulo, .mb-reloj { max-width: 62%; }

    .mb-cartel__pozo { font-size: 34px; }
    .mb-cartel__tipo { font-size: 22px; }
    .mb-cartel__rotulo { font-size: 11px; }

    .mb-reloj { gap: 6px; }
    .mb-reloj__n { width: 44px; height: 44px; font-size: 19px; border-radius: 10px; }
    .mb-reloj__l { font-size: 9px; }
  }
}

/*
  LA FOTO DE DANI, POR LA DERECHA.

  Primero la puse de fondo a pantalla completa y tapaba el azul del
  sitio; despues dibuje una bandera en SVG y, al lado de un render con
  brillos y sombras, se notaba plana. Esto es lo que queda: la foto de
  el, recortada a las banderas, ocupando la mitad derecha.

  El `mask-image` es lo que la hace entrar sin costura: la foto se
  desvanece hacia la izquierda y el azul del cartel aparece por debajo,
  justo donde va el texto. Sin eso se ve el borde de la foto como una
  linea vertical en el medio del cartel.
*/
.mb-cartel__bandera {
  position: absolute;
  top: 0;
  bottom: 0;
  right: 0;
  width: 46%;
  background: url("/img/carreras/banderas.webp") right center / cover no-repeat;

  mask-image: linear-gradient(90deg, transparent 0%, #000 36%, #000 100%);
  -webkit-mask-image: linear-gradient(90deg, transparent 0%, #000 36%, #000 100%);

  /*
    En el telefono la foto entra mas tarde: el reloj llega hasta el 62%
    del ancho y el asta de la bandera le cruzaba por encima al ultimo
    casillero. Con el desvanecido hasta el 46% de la capa, la foto
    empieza a verse recien pasado el reloj.
  */
  @include en-celular {
    width: 52%;
    mask-image: linear-gradient(90deg, transparent 0%, #000 46%, #000 100%);
    -webkit-mask-image: linear-gradient(90deg, transparent 0%, #000 46%, #000 100%);
  }
}

.mb-cartel h1 {
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  /* A la izquierda, como el resto del cartel: el titulo arranca donde
     arrancan el reloj y los botones. */
  justify-content: flex-start;
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

/*
  EL PIE, ABAJO DEL CARTEL.

  Era parte del cartel y ahora es una fila suya, pegada a la izquierda
  igual que el titulo. Es como esta en mrloot, y de paso el cartel se
  queda solo con lo que importa.
*/
.mb-cartel__pie {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 14px;

  @include en-celular { margin-top: 10px; gap: 8px; }
}

/* La rueda del signo de pregunta. */
.mb-cartel__ayuda {
  width: 48px;
  height: 48px;
  flex: none;
  border-radius: 50%;
  border: 1px solid #2a5bd0;
  background: $panel-alto;
  color: #c9d7f7;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  @include foco;

  &:hover { color: #fff; border-color: #3f7ae6; }
  @include en-celular { width: 42px; height: 42px; }
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
</style>
