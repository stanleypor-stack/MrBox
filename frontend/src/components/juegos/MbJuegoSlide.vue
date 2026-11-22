<template>
  <div class="gx gx-slide">
    <div class="gx-sbox">
      <div class="gx-shead">
        <div>
          <span>{{ $t('games.last100') }}</span>
          <div class="gx-stats">
            <div v-for="s in cuentas" :key="s.color" class="gx-stat">
              <div :class="'gx-stile ' + s.color"></div>{{ s.n }}
            </div>
          </div>
        </div>
        <div>
          <span>{{ $t('games.previousRolls') }}</span>
          <div class="gx-shist">
            <div v-for="(h, i) in ultimas" :key="i" :class="'gx-stile ' + h"></div>
          </div>
        </div>
      </div>

      <div class="gx-sgame">
        <div v-if="estado === 'apostando'" class="gx-sinfo">
          {{ $t('games.starting') }}
          <div class="gx-scd">
            <span>{{ reloj[0] }}</span>
            <span>{{ reloj[1] }}</span>
            <span class="dot">.</span>
            <span>{{ reloj[2] }}</span>
            <span>{{ reloj[3] }}</span>
          </div>
        </div>

        <div class="gx-ssel" :style="{ display: estado === 'apostando' ? 'none' : 'block' }">
          <img class="t" src="/img/juegos/slide-marca-arriba.png" alt="">
          <img class="b" src="/img/juegos/slide-marca-abajo.png" alt="">
        </div>

        <div
          :class="estado === 'apostando' ? 'gx-sreel shadow' : 'gx-sreel'"
          :style="{ transform: cinta.transform, transition: cinta.transition }"
        >
          <img v-for="t in fichas" :key="t.k" :src="t.src" alt="">
        </div>
      </div>

      <div class="gx-sbottom">
        <div class="gx-samt">
          <div class="gx-sinput">
            <input
              type="text" inputmode="decimal" :aria-label="$t('games.playAmount')"
              :value="apuesta" @input="escribir"
            >
            <span class="mb-sc" style="width: 20px; height: 20px; font-size: 8px" aria-hidden="true">SC</span>
          </div>
          <div class="gx-sbtns">
            <button v-for="b in atajos" :key="b.k" type="button" @click="atajo(b.k)">
              {{ b.l }}
            </button>
          </div>
        </div>

        <div class="gx-scols">
          <div v-for="c in columnas" :key="c.color" class="gx-scol">
            <div class="gx-ssec">
              <button type="button" :disabled="c.trabado" @click="apostar(c.color)">
                <span class="bi"><img :src="c.img" alt="">{{ $t('games.playUp') }}</span>
                <span class="bm">{{ c.paga }}x</span>
              </button>
            </div>

            <div :class="c.cls">
              <div class="gx-sbinfo">
                <span>{{ $t('games.betsTotal', { n: c.lista.length }) }}</span>
                <b style="display: flex; align-items: center">
                  <span class="mb-sc" style="width: 16px; height: 16px; font-size: 7px" aria-hidden="true">SC</span>
                  {{ plata(c.total) }}
                </b>
              </div>
              <div :style="{ display: c.lista.length ? 'block' : 'none' }">
                <div class="gx-sbline"></div>
                <div v-for="(b, i) in c.lista.slice(0, 8)" :key="i" class="gx-sbe">
                  <span class="u"><i>{{ b.inicial }}</i>{{ b.jugador }}</span>
                  <span class="v">
                    <span class="mb-sc" style="width: 16px; height: 16px; font-size: 7px" aria-hidden="true">SC</span>
                    {{ plata(b.apuestaSc) }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import api from "@/api";

/**
 * SLIDE.
 *
 * Una rueda de quince casillas, compartida: todos apuestan a la misma
 * y gira cada trece segundos. El amarillo paga 14x y sale una vez de
 * quince; rojo y violeta pagan 2x y salen siete cada uno. Los tres
 * devuelven lo mismo en el largo plazo.
 *
 * LA RONDA LA LLEVA EL SERVIDOR
 *
 * Esta pantalla no decide cuándo gira ni qué sale: pregunta. Mientras
 * se apuesta viaja el hash de la semilla y nada más; la casilla
 * aparece recién cuando la rueda arrancó, que es cuando la cinta
 * necesita saber a dónde ir y cuando ya no hay nada que decidir.
 *
 * SE PREGUNTA, NO SE ESCUCHA
 *
 * Cada medio segundo mientras se apuesta, y más seguido mientras
 * gira. Para rondas de trece segundos alcanza de sobra y no deja una
 * conexión abierta por jugador, que es lo que costaría con
 * websockets. El día que haga falta se cambia acá adentro y el resto
 * del juego no se entera.
 *
 * SE PUEDE APOSTAR A VARIOS COLORES
 *
 * Como en el diseño y como en BetSweeps: la rueda es una sola, así
 * que ir al rojo y al amarillo de la misma vuelta es una jugada
 * legítima. Cada apuesta es su propia fila en el servidor y se paga
 * sola.
 */

/*
  EL ORDEN DE LA RUEDA, EL DEL DISEÑO.

  El amarillo está en el medio --casilla 7-- y a los costados alternan
  rojo y violeta. Es el MISMO orden que tiene el servidor en
  services/games/slide.js: la cinta frena en la casilla que él dice,
  así que si acá dijera otra cosa, pararía en un color y el resultado
  diría otro.
*/
const RUEDA = [
  "red", "purple", "red", "purple", "red", "purple", "red",
  "yellow",
  "purple", "red", "purple", "red", "purple", "red", "purple",
];

const IMG = {
  red: "/img/juegos/slide-rojo.png",
  purple: "/img/juegos/slide-violeta.png",
  yellow: "/img/juegos/slide-amarillo.png",
};

/* Lo que mide cada ficha con su separación, del diseño: 100 + 25. */
const FICHA = 125;

/* Lo que tarda la cinta en frenar, también del diseño. */
const GIRO_MS = 5500;

export default {
  name: "MbJuegoSlide",

  props: {
    maximoSc: { type: Number, default: 0 },
    saldoSc: { type: Number, default: 0 },
  },

  data() {
    return {
      apuesta: "1.00",
      estado: "apostando",
      numero: 0,
      faltaMs: 0,
      transcurridoMs: 0,
      casilla: null,
      historial: [],
      apuestas: [],
      cuenta: { red: 0, purple: 0, yellow: 0 },
      /* Dónde quedó la cinta la vuelta pasada, para no arrancar
         siempre del mismo lugar. */
      anterior: 3,
      mandando: false,
      latido: null,
    };
  },

  computed: {
    /* Los cuatro dígitos del reloj: centésimas, como en el diseño. */
    reloj() {
      const t = String(Math.floor(Math.max(0, this.faltaMs) / 10)).padStart(4, "0").slice(-4);
      return [t[0], t[1], t[2], t[3]];
    },

    cuentas() {
      return [
        { color: "red", n: this.cuenta.red || 0 },
        { color: "purple", n: this.cuenta.purple || 0 },
        { color: "yellow", n: this.cuenta.yellow || 0 },
      ];
    },

    ultimas() {
      return this.historial.slice(0, 7).map((h) => (h.resultadoVisible || {}).color || "red");
    },

    /* Ocho vueltas de rueda: la cinta tiene que tener de dónde correr. */
    fichas() {
      const out = [];
      for (let v = 0; v < 8; v += 1) {
        RUEDA.forEach((c, i) => out.push({ k: `${v}-${i}`, src: IMG[c] }));
      }
      return out;
    },

    /*
      DONDE ESTA LA CINTA.

      Mientras se apuesta queda a la derecha, en la casilla de la vuelta
      pasada. Cuando arranca, corre hasta la que salió y frena ahí.

      Si alguien entra a mitad de la vuelta, la animación dura lo que
      le queda --no los 5,5 segundos enteros-- así que llega justo y no
      sigue girando con el resultado ya puesto.
    */
    cinta() {
      if (this.estado === "apostando" || this.casilla === null) {
        return {
          transform: `translate(${5575 - FICHA * this.anterior}px, -50%)`,
          transition: "none",
        };
      }

      const queda = GIRO_MS - this.transcurridoMs;
      return {
        transform: `translate(${1075 - FICHA * this.casilla}px, -50%)`,
        transition: queda > 60
          ? `transform ${Math.round(queda)}ms cubic-bezier(0.12, 0.8, 0.32, 1)`
          : "none",
      };
    },

    monto() {
      return Math.round((parseFloat(this.apuesta) || 0) * 100) / 100;
    },

    /* El color que salió, mientras se está viendo el resultado. */
    salio() {
      return this.casilla === null ? "" : RUEDA[this.casilla];
    },

    columnas() {
      const paga = { red: 2, purple: 2, yellow: 14 };
      const mostrando = this.estado === "mostrando";

      return ["red", "purple", "yellow"].map((color) => {
        const lista = this.apuestas.filter((a) => a.color === color);
        return {
          color,
          img: IMG[color],
          paga: paga[color],
          lista,
          total: lista.reduce((a, b) => a + (b.apuestaSc || 0), 0),
          trabado: this.estado !== "apostando" || !this.monto
            || this.monto > this.saldoSc || this.mandando,
          cls: "gx-sbets" + (mostrando ? (this.salio === color ? " won" : " lose") : ""),
        };
      });
    },

    atajos() {
      return [
        { k: "clear", l: this.$t("games.clear") },
        { k: "+1", l: "+1" },
        { k: "+10", l: "+10" },
        { k: "+100", l: "+100" },
        { k: "1/2", l: "1/2" },
        { k: "x2", l: "x2" },
        { k: "max", l: "MAX" },
      ];
    },
  },

  created() { this.mirar(); },

  mounted() { this.latido = window.setInterval(this.mirar, 500); },

  beforeDestroy() {
    if (this.latido) window.clearInterval(this.latido);
  },

  methods: {
    plata(n) {
      return Number(n || 0).toLocaleString("en-US", {
        minimumFractionDigits: 2, maximumFractionDigits: 2,
      });
    },

    escribir(e) {
      let v = String(e.target.value).replace(",", ".").replace(/[^\d.]/g, "");
      const i = v.indexOf(".");
      if (i >= 0) v = v.slice(0, i + 1) + v.slice(i + 1).replace(/\./g, "").slice(0, 2);
      this.apuesta = v;
    },

    atajo(k) {
      const v = this.monto;
      let n = v;
      if (k === "clear") n = 0;
      else if (k === "+1") n = v + 1;
      else if (k === "+10") n = v + 10;
      else if (k === "+100") n = v + 100;
      else if (k === "1/2") n = v / 2;
      else if (k === "x2") n = v * 2;
      else if (k === "max") n = Math.min(this.maximoSc || 0, this.saldoSc);

      /* El tope de la casa y el saldo, los dos. El servidor los vuelve
         a mirar: esto es para que el botón no rebote por algo que la
         pantalla ya sabía. */
      if (this.maximoSc > 0) n = Math.min(n, this.maximoSc);
      n = Math.min(n, this.saldoSc);
      this.apuesta = this.plata(Math.max(0, n));
    },

    async mirar() {
      try {
        const { data } = await api.get("/games/slide/estado");
        const d = data.data;

        /* Vuelta nueva: la de antes queda como punto de partida. */
        if (d.numero !== this.numero) {
          if (this.casilla !== null) this.anterior = this.casilla;
          else {
            /*
              Recién abierta la pantalla no hay "la de antes", así que
              se toma la última del historial: si no, la cinta
              arrancaría siempre del mismo lugar y la primera vuelta
              se vería distinta a todas las demás.
            */
            const vieja = (d.historial || [])[0];
            const casilla = vieja && (vieja.resultadoVisible || {}).casilla;
            if (typeof casilla === "number") this.anterior = casilla;
          }
          this.numero = d.numero;
          this.casilla = null;
        }

        this.estado = d.estado;
        this.faltaMs = d.faltaMs || 0;
        this.historial = d.historial || [];
        this.apuestas = (d.apuestas || []).map((a) => ({
          ...a,
          inicial: String(a.jugador || "?").slice(0, 1).toUpperCase(),
        }));
        if (d.estadisticas) this.cuenta = d.estadisticas;

        if (d.resultado && typeof d.resultado.casilla === "number") {
          /* `transcurridoMs` solo llega mientras gira; cuando ya se
             está viendo el resultado, la cinta tiene que estar quieta
             en su lugar. */
          this.transcurridoMs = d.estado === "girando" ? (d.transcurridoMs || 0) : GIRO_MS;
          this.casilla = d.resultado.casilla;
        }
      } catch (err) {
        /* Una consulta perdida la arregla la siguiente: el juego no se
           corta por un pedido que no llegó. */
      }
    },

    async apostar(color) {
      if (this.estado !== "apostando" || this.mandando) return;
      this.mandando = true;
      try {
        const { data } = await api.post("/games/slide/bet", {
          apuestaSc: this.monto,
          color,
        });
        this.$store.commit("saldo", data.data);
        this.apuestas = (data.data.apuestas || []).map((a) => ({
          ...a,
          inicial: String(a.jugador || "?").slice(0, 1).toUpperCase(),
        }));
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      } finally {
        this.mandando = false;
      }
    },
  },
};
</script>
