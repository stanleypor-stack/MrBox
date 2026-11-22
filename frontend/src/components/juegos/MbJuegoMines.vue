<template>
  <div class="gx gx-mines">
    <div class="gx-row">
      <MbControlesDeJuego
        v-model="apuesta" :auto="auto" :cuantas="cuantas" :trabado="trabado"
        :sin-jugar="sinJugar" :etiqueta="etiquetaDelBoton" :rojo="abierta"
        :error="error" :maximo-sc="maximoSc" :saldo-sc="saldoSc"
        @auto="auto = $event" @cuantas="cuantas = $event" @jugar="jugar"
      >
        <div style="padding-bottom: 10px">
          <div class="gx-title">{{ $t('games.gridSize') }}</div>
          <div class="gx-seg4">
            <button
              v-for="t in tableros" :key="t" type="button"
              :class="{ on: tablero === t }" :disabled="abierta" @click="elegirTablero(t)"
            >{{ Math.round(Math.sqrt(t)) }}</button>
          </div>
        </div>

        <div style="padding-bottom: 10px">
          <div class="gx-title">{{ $t('games.mineCount') }}</div>
          <div class="gx-mcount">
            <span class="bi">
              <input
                type="text" inputmode="numeric" :aria-label="$t('games.mineCount')"
                :value="minas" :disabled="abierta" @change="escribirMinas"
              >
              <img src="/img/juegos/mina-icono.svg" alt="">
            </span>
            <span class="gx-updown">
              <button type="button" :disabled="abierta" @click="cambiarMinas(1)">
                <img src="/img/juegos/mas.png" alt="">
              </button>
              <button type="button" :disabled="abierta" @click="cambiarMinas(-1)">
                <img src="/img/juegos/menos.png" alt="">
              </button>
            </span>
          </div>
        </div>
      </MbControlesDeJuego>

      <div class="gx-mgame">
        <div v-if="terminada && pagoSc > 0" class="gx-result">
          <small>{{ $t('games.youWon') }}</small>
          <b>{{ multiplicador.toFixed(2) }}x</b>
          <span class="amt">
            <span class="mb-sc" style="width: 18px; height: 18px; font-size: 7px" aria-hidden="true">SC</span>
            <em>{{ plata(pagoSc) }}</em>
          </span>
        </div>

        <div class="gx-mgrid" :style="{ gridTemplateColumns: columnas }">
          <div v-for="i in tablero" :key="i - 1" :class="claseDe(i - 1)">
            <div class="gx-tin">
              <div class="gx-tf">
                <div :style="{ display: caraDe(i - 1) ? 'flex' : 'none' }">
                  <img :src="caraDe(i - 1)" alt="" :style="{ width: esMina(i - 1) ? '90%' : '80%' }">
                </div>
              </div>
              <div class="gx-tb">
                <button
                  type="button" :class="{ on: abierta }"
                  :aria-label="$t('games.reveal')" @click="destapar(i - 1)"
                ></button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="gx-mmw">
        <div class="ar up" @click="correr(-1)"><img src="/img/juegos/chevron.png" alt=""></div>
        <div class="gx-mml">
          <div v-for="m in escalera" :key="m.k" :class="{ on: m.actual }">
            <span>{{ m.x }}</span>
            <span>{{ m.k }}</span>
          </div>
        </div>
        <div class="ar" @click="correr(1)"><img src="/img/juegos/chevron.png" alt=""></div>
      </div>
    </div>
  </div>
</template>

<script>
import MbControlesDeJuego from "./MbControlesDeJuego.vue";
import jugar from "./jugar";

/**
 * MINES.
 *
 * Un tablero con minas escondidas. Cada casilla limpia sube el
 * multiplicador; la primera mina termina la ronda.
 *
 * LA RONDA VIVE EN EL SERVIDOR, NO ACA
 *
 * La pantalla no sabe dónde están las minas y no puede saberlo: el
 * servidor las sortea al abrir y no las manda hasta que la ronda
 * termina. Cada click es un pedido; lo que vuelve dice si esa casilla
 * estaba limpia y cuánto se lleva si cobra ahora.
 *
 * Por eso el botón de abajo cambia de sentido: antes de abrir dice
 * "jugar" y, con la ronda abierta, "cobrar".
 */
export default {
  name: "MbJuegoMines",

  components: { MbControlesDeJuego },

  mixins: [jugar],

  props: {
    maximoSc: { type: Number, default: 0 },
    saldoSc: { type: Number, default: 0 },
  },

  data() {
    return {
      tableros: [25, 36, 49, 64],
      tablero: 25,
      minas: 3,
      abierta: false,
      destapadas: [],
      minadas: [],
      ultima: null,
      terminada: false,
      exploto: false,
      multiplicador: 0,
      pagoSc: 0,
      corrimiento: 0,
    };
  },

  computed: {
    columnas() {
      return `repeat(${Math.round(Math.sqrt(this.tablero))}, auto)`;
    },

    tamano() {
      return { 25: "t5", 36: "t6", 49: "t7", 64: "t8" }[this.tablero] || "t8";
    },

    /** Lo que paga cada cantidad de destapadas, para la escalera. */
    escalera() {
      const limpias = this.tablero - this.minas;
      const todas = [];
      for (let d = 1; d <= limpias; d += 1) {
        todas.push({ k: d, x: this.multDe(d).toFixed(2) + "x", actual: this.abierta && d === this.destapadas.length });
      }
      return todas.slice(this.corrimiento, this.corrimiento + 7);
    },

    sinJugar() {
      if (this.girando) return true;
      /* Con la ronda abierta el botón cobra, y cobrar sin haber
         destapado nada no se puede. */
      if (this.abierta) return !this.destapadas.length;
      return (parseFloat(this.apuesta) || 0) <= 0;
    },

    etiquetaDelBoton() {
      if (this.girando) return this.$t("common.loading");
      if (this.abierta) return this.$t("games.collect");
      return this.$t("games.play");
    },

    trabado() { return this.girando || this.abierta; },
  },

  methods: {
    /* La misma cuenta que el servidor; ver el comentario de arriba
       sobre quién manda. */
    combinaciones(n, k) {
      if (k < 0 || k > n) return 0;
      let r = 1;
      for (let i = 0; i < k; i += 1) r = (r * (n - i)) / (i + 1);
      return r;
    },

    multDe(destapadas) {
      if (destapadas <= 0) return 0;
      const justo = this.combinaciones(this.tablero, destapadas)
        / this.combinaciones(this.tablero - this.minas, destapadas);
      return Math.max(1, 0.94 * justo);
    },

    claseDe(i) {
      const rev = this.destapadas.includes(i);
      return `gx-tile ${this.tamano}${rev || (this.terminada && this.minadas.includes(i)) ? " rv" : ""}${this.terminada ? " cp" : ""}`;
    },

    esMina(i) { return this.minadas.includes(i); },

    caraDe(i) {
      const rev = this.destapadas.includes(i);
      const mina = this.minadas.includes(i);

      if (mina && (this.terminada || this.ultima === i)) {
        return this.ultima === i ? "/img/juegos/mina-explota.webp" : "/img/juegos/mina.png";
      }
      if (rev) {
        return this.ultima === i && !this.terminada
          ? "/img/juegos/gema-gana.webp"
          : "/img/juegos/gema.png";
      }
      return "";
    },

    elegirTablero(t) {
      if (this.abierta) return;
      this.tablero = t;
      this.minas = Math.min(this.minas, t - 1);
      this.limpiar();
    },

    escribirMinas(e) {
      const v = parseInt(e.target.value, 10);
      if (Number.isNaN(v)) return;
      this.minas = Math.max(1, Math.min(this.tablero - 1, v));
    },

    cambiarMinas(d) {
      if (this.abierta) return;
      this.minas = Math.max(1, Math.min(this.tablero - 1, this.minas + d));
    },

    correr(d) {
      const limpias = this.tablero - this.minas;
      this.corrimiento = Math.max(0, Math.min(Math.max(0, limpias - 7), this.corrimiento + d));
    },

    limpiar() {
      this.destapadas = [];
      this.minadas = [];
      this.ultima = null;
      this.terminada = false;
      this.exploto = false;
      this.multiplicador = 0;
      this.pagoSc = 0;
    },

    async jugar() {
      if (this.abierta) return this.cobrar();

      this.limpiar();
      const d = await this.unaJugada("/games/mines/open", {
        tablero: this.tablero,
        minas: this.minas,
      });
      if (!d) return;
      this.abierta = true;
      this.corrimiento = 0;
    },

    async destapar(i) {
      if (!this.abierta || this.girando) return;
      if (this.destapadas.includes(i)) return;

      const d = await this.unaJugada("/games/mines/tile", { casilla: i });
      if (!d) return;

      this.destapadas = d.destapadas || [];
      this.ultima = d.casilla;
      this.multiplicador = d.multiplicador || 0;

      if (d.termino) {
        this.abierta = false;
        this.terminada = true;
        this.exploto = !!d.exploto;
        this.minadas = d.minadas || [];
        this.pagoSc = d.pagoSc || 0;
        this.anotar({ v: d.exploto ? "✕" : this.multiplicador.toFixed(2) + "x", gano: !d.exploto });
      }
    },

    async cobrar() {
      const d = await this.unaJugada("/games/mines/cashout", {});
      if (!d) return;

      this.abierta = false;
      this.terminada = true;
      this.minadas = d.minadas || [];
      this.multiplicador = d.multiplicador || 0;
      this.pagoSc = d.pagoSc || 0;
      this.anotar({ v: this.multiplicador.toFixed(2) + "x", gano: true });
    },
  },
};
</script>
