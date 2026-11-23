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
              <!--
                `gx-dd-btn` es lo que le da la caja: sin esa clase el
                desplegable sale como un numerito suelto con una
                flechita al lado, que es como se veia.
              -->
              <button
                type="button" :class="['gx-dd-btn', { open: menuAbierto }]" :disabled="trabado"
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
          <!--
            EL DESTELLO LO HACE EL CSS, NO VUE.

            El `:key` con el contador es lo que lo dispara: cuando el
            clavo se vuelve a golpear cambia la llave, Vue repone el
            elemento y la animacion empieza de nuevo. Antes esto era
            una opacidad recalculada 25 veces por segundo para CADA
            clavo --y hay mas de cien-- y eso era el tironeo.
          -->
          <div
            v-for="p in clavos" :key="p.id" class="gx-pin"
            :style="{ left: p.x, top: p.y, width: p.s, height: p.s }"
          >
            <i v-if="golpeados[p.id]" :key="golpeados[p.id]" class="pega"></i>
          </div>

          <div
            v-for="m in casilleros" :key="'m' + m.id" class="gx-pm"
            :style="{ left: m.x, top: m.y, width: m.w, height: m.h, fontSize: m.fs }"
          >
            {{ m.t }}<i v-if="prendidas[m.id]" :key="prendidas[m.id]" class="pega">{{ m.t }}</i>
          </div>

          <!--
            Y la bola va con `transition`: se le dice a donde tiene
            que llegar y en cuanto, y el navegador dibuja el camino a
            los cuadros por segundo que tenga la pantalla. Poniendole
            la posicion a mano nunca pasaba de 25.
          -->
          <div
            v-for="b in bolas" :key="b.id" class="gx-pball"
            :style="{ left: b.x, top: b.y, width: b.s, aspectRatio: '1 / 1', transition: b.tr }"
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

/*
  LAS DOS CURVAS DEL REBOTE.

  El diseno acelera al caer (u al cuadrado) y frena al subir. En CSS
  eso son estas dos bezier, que es la forma de que la curva la dibuje
  el navegador en vez de calcularla cuadro a cuadro.
*/
const CAE = "cubic-bezier(.55,.085,.68,.53)";
const SUBE = "cubic-bezier(.25,.46,.45,.94)";

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
      /* Cuantas veces se golpeo cada clavo y se prendio cada casilla.
         El numero no se muestra: solo sirve para que el CSS repita el
         destello cuando vuelve a pasar. */
      golpeados: {},
      prendidas: {},
      /* El brillo de la casilla donde acaba de caer una. */
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
          out.push({
            id: i + "-" + j,
            x: ((x + this.ancho / 2) / this.ancho) * 100 + "%",
            y: (y / this.alto) * 100 + "%",
            s: (6 / this.ancho) * 100 + "cqw",
          });
        }
      }
      return out;
    },

    casilleros() {
      const y = this.alto - 36 - 10;
      return this.tabla.map((v, i) => {
        const x = -((this.filas + 1) / 2 - i) * SALTO + (SALTO - 40) / 2;
        return {
          id: i,
          x: ((x + this.ancho / 2) / this.ancho) * 100 + "%",
          y: (y / this.alto) * 100 + "%",
          w: (40 / this.ancho) * 100 + "%",
          h: (36 / this.alto) * 100 + "%",
          fs: (10 / this.ancho) * 100 + "cqw",
          t: Number(v).toFixed(2) + " x",
        };
      });
    },

    /*
      LA BOLA: A DONDE VA Y EN CUANTO TIEMPO.

      No se le calcula la posicion cuadro a cuadro: se le da el
      destino del tramo y el navegador lo dibuja. Cae acelerando y
      sube frenando --las dos curvas del diseno-- y eso en CSS son las
      dos bezier de arriba.

      Si un tramo se adelanta tarde, la transicion arranca desde donde
      la bola ESTA dibujada, asi que no salta: se acomoda sola.
    */
    bolas() {
      return this.cayendo
        .filter((b) => b.filas === this.filas)
        .map((b) => {
          const k = Math.min(b.paso, b.cuadros.length - 1);
          const a = b.cuadros[Math.max(0, k - 1)];
          const c = b.cuadros[k];
          const dura = Math.max(0, c.t - a.t);
          const cae = c.y > a.y;
          return {
            id: b.id,
            x: c.x + "%",
            y: c.y + "%",
            s: (16 / this.ancho) * 100 + "%",
            tr: k === 0 ? "none" : "left " + dura + "ms linear, top " + dura + "ms " + (cae ? CAE : SUBE),
          };
        });
    },

    sinJugar() {
      return this.girando || (parseFloat(this.apuesta) || 0) <= 0;
    },
  },

  created() { this.traerPagos(); },

  mounted() {
    /*
      UN SOLO RELOJ, Y SOLO PARA CAMBIAR DE TRAMO.

      Antes este reloj redibujaba el tablero entero 25 veces por
      segundo. Ahora solo adelanta el tramo de cada bola y prende los
      destellos; el dibujo lo hace el navegador, que va a los cuadros
      por segundo de la pantalla y no a los de este reloj.

      Uno para todas las bolas: uno por bola serian diez relojes
      corriendo cuando alguien pone el automatico.
    */
    this.reloj = window.setInterval(() => {
      const ahora = Date.now();

      for (const b of this.cayendo) {
        const paso = ahora - b.desde;
        while (b.paso < b.cuadros.length - 1 && b.cuadros[b.paso].t <= paso) b.paso += 1;
        while (b.golpe < b.golpes.length && b.golpes[b.golpe].t <= paso) {
          const id = b.golpes[b.golpe].id;
          this.$set(this.golpeados, id, (this.golpeados[id] || 0) + 1);
          b.golpe += 1;
        }
      }

      this.cayendo = this.cayendo.filter((b) => {
        if (ahora - b.desde < b.fin) return true;
        this.$set(this.prendidas, b.casilla, (this.prendidas[b.casilla] || 0) + 1);
        return false;
      });
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
        /* En que tramo va y cuantos clavos ya golpeo. */
        paso: 0,
        golpe: 0,
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

        /*
          EL SONIDO VA CUANDO LA BOLITA LLEGA, NO CUANDO SALE.

          Lo que decide la jugada ya esta decidido, pero el jugador
          todavia la ve cayendo: que suene al soltarla seria cantarle
          el resultado antes de verlo.
        */
        window.setTimeout(() => {
          this.sonar("plinko");
          this.anotar({
            v: Number(d.multiplicador).toFixed(2) + "x", gano: d.multiplicador > 1,
          });
        }, Math.max(0, dura - 120));

        /* La próxima bola espera a que ésta termine de caer: dos
           bolas superpuestas en automático no se entienden. */
        await new Promise((r) => setTimeout(r, Math.min(dura, 2200)));
        return true;
      });
    },
  },
};
</script>
