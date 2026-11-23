<template>
  <div class="gx gx-keno">
    <div class="gx-row">
      <MbControlesDeJuego
        v-model="apuesta" :auto="auto" :cuantas="cuantas" :trabado="trabado"
        :sin-jugar="sinJugar" :etiqueta="etiquetaDelBoton" :rojo="quedan > 0"
        :error="error" :maximo-sc="maximoSc" :saldo-sc="saldoSc" compacto
        @auto="auto = $event" @cuantas="cuantas = $event" @jugar="jugar"
      >
        <div class="gx-kbtns">
          <button type="button" :disabled="trabado" @click="alAzar">
            <img src="/img/juegos/magico.svg" alt="">{{ $t('games.pick') }}
          </button>
          <button type="button" :disabled="trabado" @click="limpiar">{{ $t('games.clear') }}</button>
        </div>
      </MbControlesDeJuego>

      <!-- La fila compacta de multiplicadores, que el diseño muestra
           arriba del tablero cuando la pantalla es angosta. -->
      <div class="gx-kmm">
        <div v-for="(m, i) in tabla" :key="i" :class="{ on: i === aciertos }">{{ m }}x</div>
      </div>

      <div class="gx-game">
        <div class="gx-kwrap">
          <div class="gx-kgrid">
            <div
              v-for="n in 40" :key="n"
              :class="claseDe(n)" @click="tocar(n)"
            >
              <span>{{ n }}</span>
            </div>
          </div>
        </div>

        <div class="gx-kmult">
          <div v-for="(m, i) in tabla" :key="i" :class="{ on: i === aciertos }">
            <span>{{ m }}x</span>
            <span>{{ i }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import MbControlesDeJuego from "./MbControlesDeJuego.vue";
import jugar from "./jugar";

/**
 * KENO.
 *
 * Un tablero de 40. El jugador elige hasta 10 y la casa saca 10.
 * Cuantos más coincidan, más paga.
 *
 * LA TABLA DE PAGOS SE DIBUJA, NO SE INVENTA
 *
 * Son los mismos números que paga el servidor, calculados con la
 * misma cuenta: los pagos justos de BetSweeps por (1 - margen). Si
 * algún día el margen cambia desde el panel, esta tabla cambia con
 * él, porque sale de la misma fórmula.
 *
 * La clase `a` es "elegida por el jugador" y `d` es "salió en el
 * sorteo", igual que en el diseño. Una casilla con las dos es un
 * acierto.
 */

/* Los pagos justos, los mismos que `backend/services/games/keno.js`. */
const PAGOS_JUSTOS = {
  1: [0.405, 2.784],
  2: [0, 1.825, 5.172],
  3: [0, 0, 2.835, 50.63],
  4: [0, 0, 1.74, 10.23, 102.35],
  5: [0, 0, 1.41, 4.05, 14.18, 395.12],
  6: [0, 0, 0, 3.04, 9.13, 182.71, 720.7],
  7: [0, 0, 0, 2.02, 7.08, 30.34, 404.64, 809.29],
  8: [0, 0, 0, 2.02, 4.04, 11.13, 67.81, 404.85, 910.92],
  9: [0, 0, 0, 2.02, 2.52, 5.05, 15.17, 101.19, 505.98, 1011.96],
  10: [0, 0, 0, 1.61, 2.02, 4.04, 7.07, 26.28, 101.08, 505.42, 1010.84],
};

export default {
  name: "MbJuegoKeno",

  components: { MbControlesDeJuego },

  mixins: [jugar],

  props: {
    maximoSc: { type: Number, default: 0 },
    saldoSc: { type: Number, default: 0 },
    /* El margen que el servidor publica, para que la tabla diga lo
       que de verdad se paga. */
    margen: { type: Number, default: 6 },
  },

  data() {
    return {
      elegidas: [],
      salieron: [],
      aciertos: -1,
    };
  },

  computed: {
    tabla() {
      const justos = PAGOS_JUSTOS[this.elegidas.length] || [0];
      const f = (100 - this.margen) / 100;
      return justos.map((x) => (Math.round(x * f * 100) / 100).toFixed(2));
    },

    sinJugar() {
      return this.girando || !this.elegidas.length || (parseFloat(this.apuesta) || 0) <= 0;
    },
  },

  methods: {
    claseDe(n) {
      const elegida = this.elegidas.includes(n);
      const salio = this.salieron.includes(n);
      return (elegida ? "a " : "") + (salio ? "d" : "");
    },

    tocar(n) {
      if (this.trabado) return;
      const i = this.elegidas.indexOf(n);
      if (i >= 0) this.elegidas.splice(i, 1);
      else if (this.elegidas.length < 10) this.elegidas.push(n);
      /* Tocar el tablero borra lo del sorteo anterior: si no, queda
         una mezcla de las bolillas viejas con las elegidas nuevas. */
      this.salieron = [];
      this.aciertos = -1;
    },

    /** Diez al azar, que es lo que hace el botón de la varita. */
    alAzar() {
      if (this.trabado) return;
      const bolsa = Array.from({ length: 40 }, (_, i) => i + 1);
      const sacadas = [];
      for (let i = 0; i < 10; i += 1) {
        sacadas.push(...bolsa.splice(Math.floor(Math.random() * bolsa.length), 1));
      }
      this.elegidas = sacadas.sort((a, b) => a - b);
      this.salieron = [];
      this.aciertos = -1;
    },

    limpiar() {
      if (this.trabado) return;
      this.elegidas = [];
      this.salieron = [];
      this.aciertos = -1;
    },

    jugar() {
      return this.apretar(async () => {
        const d = await this.unaJugada("/games/keno/play", { elegidas: this.elegidas });
        if (!d) return false;

        this.salieron = d.salieron;
        this.aciertos = d.aciertos;
        if (d.aciertos > 0) this.sonar("pop");
        this.anotar({ v: String(d.aciertos), gano: d.gano });
        return true;
      });
    },
  },
};
</script>
