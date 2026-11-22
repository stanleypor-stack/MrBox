<template>
  <div class="gx gx-plinko">
    <div class="gx-row">
      <MbControlesDeJuego
        v-model="apuesta" :auto="auto" :cuantas="cuantas" :trabado="trabado"
        :sin-jugar="sinJugar" :etiqueta="etiquetaDelBoton" :rojo="quedan > 0"
        :error="error" :maximo-sc="maximoSc" :saldo-sc="saldoSc"
        @auto="auto = $event" @cuantas="cuantas = $event" @jugar="jugar"
      >
        <div style="width: 100%">
          <div class="gx-title">{{ $t('games.rows') }}</div>
          <div style="margin-top: 12px">
            <div class="gx-dd">
              <button
                type="button" :class="{ on: menuAbierto }" :disabled="trabado"
                @click="menuAbierto = !menuAbierto"
              >
                {{ filas }}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#626c7e"
                     stroke-width="3" stroke-linecap="round" aria-hidden="true">
                  <path d="m6 9 6 6 6-6"></path>
                </svg>
              </button>
              <div v-if="menuAbierto" class="gx-dd-menu">
                <button
                  v-for="n in opcionesDeFilas" :key="n" type="button"
                  :class="{ on: n === filas }" @click="elegirFilas(n)"
                >{{ n }}</button>
              </div>
            </div>
          </div>
        </div>

        <div class="gx-prisk">
          <button
            v-for="r in riesgos" :key="r.id" type="button"
            :class="{ on: riesgo === r.id }" :disabled="trabado" @click="riesgo = r.id"
          >{{ r.texto }}</button>
        </div>
      </MbControlesDeJuego>

      <div class="gx-game">
        <div class="gx-phist">
          <div v-for="(h, i) in historial" :key="i" :class="h.gano ? 'gx-chip w' : 'gx-chip'">
            {{ h.v }}
          </div>
        </div>

        <div class="gx-pboard" :style="{ aspectRatio: ancho + ' / ' + alto }">
          <div
            v-for="p in clavos" :key="p.id" class="gx-pin"
            :style="{ left: p.x, top: p.y, width: p.s, height: p.s }"
          >
            <i :style="{ opacity: p.bo, transform: p.bs }"></i>
          </div>

          <div
            v-for="m in casilleros" :key="'m' + m.id" class="gx-pm"
            :style="{ left: m.x, top: m.y, width: m.w, height: m.h, fontSize: m.fs }"
          >
            {{ m.t }}<i :style="{ opacity: m.o }">{{ m.t }}</i>
          </div>

          <div
            v-for="b in bolas" :key="b.id" class="gx-pball"
            :style="{ left: b.x, top: b.y, width: b.s, aspectRatio: '1 / 1' }"
          ></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import api from "@/api";
import MbControlesDeJuego from "./MbControlesDeJuego.vue";
import jugar from "./jugar";

/**
 * PLINKO.
 *
 * Cae una bola y rebota fila por fila hasta una casilla. Dónde cae lo
 * decide el SERVIDOR: manda el camino --un lado por fila-- y acá solo
 * se dibuja esa caída.
 *
 * LA ANIMACION NO DECIDE NADA
 *
 * Esto es importante y es al revés de como parece. La bola no "cae
 * donde la física la lleve": el resultado ya está sorteado y firmado
 * cuando la animación empieza, y la animación lo representa. Si fuera
 * al revés, el resultado dependería de la máquina del jugador.
 *
 * LA GEOMETRIA ES LA DEL DISEÑO, NUMERO POR NUMERO
 *
 * Las separaciones (44), el alto del arranque (32) y el tamaño de las
 * casillas (40x36) salen del artifact. Todo se expresa en porcentaje
 * del tablero, que tiene `aspect-ratio` fijo: así la misma cuenta
 * sirve en el celular y en la computadora.
 */

/* Las medidas del diseño. */
const SALTO = 44;
const ARRANQUE = 32;

export default {
  name: "MbJuegoPlinko",

  components: { MbControlesDeJuego },

  mixins: [jugar],

  props: {
    maximoSc: { type: Number, default: 0 },
    saldoSc: { type: Number, default: 0 },
    margen: { type: Number, default: 6 },
  },

  data() {
    return {
      filas: 12,
      riesgo: "medium",
      menuAbierto: false,
      /* Las bolas que están cayendo ahora mismo. */
      cayendo: [],
      /* El brillo de la casilla donde acaba de caer una. */
      destellos: [],
      ahora: Date.now(),
      reloj: null,
      pagos: {},
    };
  },

  computed: {
    opcionesDeFilas() {
      return [8, 9, 10, 11, 12, 13, 14, 15, 16];
    },

    riesgos() {
      return [
        { id: "low", texto: this.$t("games.riskLow") },
        { id: "medium", texto: this.$t("games.riskMedium") },
        { id: "high", texto: this.$t("games.riskHigh") },
      ];
    },

    ancho() { return SALTO * (4 + this.filas); },
    alto() { return ARRANQUE + SALTO * (this.filas - 1) + 36 * 1.75 + 20; },

    /** Los pagos de la fila y el riesgo elegidos, como los dibuja el pie. */
    tabla() {
      const t = (this.pagos[this.riesgo] || {})[this.filas];
      return t || new Array(this.filas + 1).fill(0);
    },

    clavos() {
      const out = [];
      for (let i = 0; i < this.filas; i += 1) {
        const linea = 3 + i;
        for (let j = 0; j < linea; j += 1) {
          const y = 8 + ARRANQUE + 3 + i * SALTO;
          const x = -((linea - 1) / 2 - j) * SALTO;
          const golpe = this.golpes[i + "-" + j];
          out.push({
            id: i + "-" + j,
            x: ((x + this.ancho / 2) / this.ancho) * 100 + "%",
            y: (y / this.alto) * 100 + "%",
            s: (6 / this.ancho) * 100 + "cqw",
            bo: golpe === undefined ? "0" : String(1 - golpe),
            bs: golpe === undefined ? "scale(1)" : `scale(${1 + (1 - golpe) * 0.8})`,
          });
        }
      }
      return out;
    },

    /** Qué clavos están iluminados ahora, por una bola que pasó. */
    golpes() {
      const m = {};
      for (const b of this.cayendo) {
        if (b.filas !== this.filas) continue;
        for (const h of b.golpes) {
          const dt = this.ahora - b.desde - h.t;
          if (dt >= 0 && dt < 200) m[h.id] = dt / 200;
        }
      }
      return m;
    },

    casilleros() {
      const y = this.alto - 36 - 10;
      return this.tabla.map((v, i) => {
        const x = -((this.filas + 1) / 2 - i) * SALTO + (SALTO - 40) / 2;
        const d = this.destellos.find((f) => f.casilla === i && f.filas === this.filas);
        let o = 0;
        if (d) {
          const dt = this.ahora - d.t;
          o = dt < 400 ? dt / 400 : dt < 600 ? 1 : Math.max(0, 1 - (dt - 600) / 400);
        }
        return {
          id: i,
          x: ((x + this.ancho / 2) / this.ancho) * 100 + "%",
          y: (y / this.alto) * 100 + "%",
          w: (40 / this.ancho) * 100 + "%",
          h: (36 / this.alto) * 100 + "%",
          fs: (10 / this.ancho) * 100 + "cqw",
          t: Number(v).toFixed(2) + " x",
          o: String(o),
        };
      });
    },

    bolas() {
      return this.cayendo
        .filter((b) => b.filas === this.filas)
        .map((b) => {
          const el = this.ahora - b.desde;
          let k = 1;
          while (k < b.cuadros.length - 1 && b.cuadros[k].t < el) k += 1;
          const a = b.cuadros[k - 1];
          const c = b.cuadros[k];
          const u = c.t === a.t ? 1 : Math.max(0, Math.min(1, (el - a.t) / (c.t - a.t)));
          /* Cae acelerando y sube frenando, que es lo que hace un rebote. */
          const ey = c.y > a.y ? u * u : 1 - (1 - u) * (1 - u);
          return {
            id: b.id,
            x: a.x + (c.x - a.x) * u + "%",
            y: a.y + (c.y - a.y) * ey + "%",
            s: (16 / this.ancho) * 100 + "%",
          };
        });
    },

    sinJugar() {
      return this.girando || (parseFloat(this.apuesta) || 0) <= 0;
    },
  },

  created() { this.traerPagos(); },

  mounted() {
    /* Un solo reloj para todas las bolas: uno por bola serían diez
       relojes corriendo cuando alguien pone el automático. */
    this.reloj = window.setInterval(() => {
      this.ahora = Date.now();
      this.cayendo = this.cayendo.filter((b) => {
        if (this.ahora - b.desde < b.fin) return true;
        this.destellos.push({ casilla: b.casilla, t: this.ahora, filas: b.filas });
        return false;
      });
      this.destellos = this.destellos.filter((f) => this.ahora - f.t < 1000);
    }, 40);
  },

  beforeDestroy() {
    if (this.reloj) window.clearInterval(this.reloj);
  },

  methods: {
    async traerPagos() {
      try {
        const { data } = await api.get("/games/plinko/pagos");
        this.pagos = data.data.pagos;
      } catch (err) {
        /* Sin la tabla el juego anda igual: lo que paga lo dice el
           servidor al jugar. Solo no se dibujan los numeritos. */
      }
    },

    elegirFilas(n) {
      if (this.trabado) return;
      this.filas = n;
      this.menuAbierto = false;
    },

    /**
     * SUELTA LA BOLA POR EL CAMINO QUE DIJO EL SERVIDOR.
     *
     * Los tiempos y los rebotes son los del diseño: 100 ms hasta el
     * primer clavo y 250 por fila, con el pico del rebote a los 50.
     */
    soltar(camino, filas) {
      const W = SALTO * (4 + filas);
      const H = ARRANQUE + SALTO * (filas - 1) + 36 * 1.75 + 20;
      const px = (x) => ((x + W / 2) / W) * 100;
      const py = (y) => (y / H) * 100;

      const cuadros = [{ t: 0, x: px(0), y: py(0) }, { t: 100, x: px(0), y: py(ARRANQUE - 3) }];
      const golpes = [];
      let j = 1;
      let t = 100;

      camino.forEach((paso, r) => {
        const izquierda = paso === 0;
        const linea = 3 + r;
        const x = -SALTO * ((linea - 1) / 2 - j);
        const y = ARRANQUE + SALTO * r + 8;
        const dx = (SALTO / 2) * (izquierda ? -1 : 1);
        const dy = (SALTO - 6) * (0.3 + 0.2 * Math.random());

        golpes.push({ id: r + "-" + j, t });
        cuadros.push({ t: t + 50, x: px(x + dx * 0.4), y: py(y - dy) });
        cuadros.push({ t: t + 250, x: px(x + dx), y: py(y + SALTO) });
        t += 250;
        j += izquierda ? 0 : 1;
      });

      this.cayendo.push({
        id: Date.now() + Math.random(),
        desde: Date.now(),
        cuadros,
        golpes,
        fin: t,
        casilla: j - 1,
        filas,
      });

      return t;
    },

    jugar() {
      return this.apretar(async () => {
        const d = await this.unaJugada("/games/plinko/play", {
          riesgo: this.riesgo,
          filas: this.filas,
        });
        if (!d) return false;

        const dura = this.soltar(d.camino, this.filas);
        this.anotar({ v: Number(d.multiplicador).toFixed(2) + "x", gano: d.multiplicador > 1 });

        /* La próxima bola espera a que ésta termine de caer: dos
           bolas superpuestas en automático no se entienden. */
        await new Promise((r) => setTimeout(r, Math.min(dura, 2200)));
        return true;
      });
    },
  },
};
</script>
