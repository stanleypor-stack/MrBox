<template>
  <div class="gx gx-tower">
    <div class="gx-row">
      <MbControlesDeJuego
        v-model="apuesta" :auto="auto" :cuantas="cuantas" :trabado="trabado"
        :sin-jugar="sinJugar" :etiqueta="etiquetaDelBoton" :rojo="abierta"
        :error="error" :maximo-sc="maximoSc" :saldo-sc="saldoSc"
        @auto="auto = $event" @cuantas="cuantas = $event" @jugar="jugar"
      >
        <template v-if="abierta">
          <div class="gx-title">{{ $t('games.nextProfit') }}</div>
          <div class="gx-profit">
            <span>{{ plata(siguiente) }}</span>
            <span class="mb-sc" style="width: 20px; height: 20px; font-size: 8px" aria-hidden="true">SC</span>
          </div>
        </template>

        <div style="margin-top: 10px">
          <div class="gx-dd">
            <!-- `gx-dd-btn` le da la caja: ver el comentario en Plinko. -->
            <button
              type="button" :class="['gx-dd-btn', { open: menuAbierto }]" :disabled="abierta"
              @click="menuAbierto = !menuAbierto"
            >
              {{ nombreDelRiesgo }}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#626c7e"
                   stroke-width="3" stroke-linecap="round" aria-hidden="true">
                <path d="m6 9 6 6 6-6"></path>
              </svg>
            </button>
            <div v-if="menuAbierto" class="gx-dd-menu">
              <button
                v-for="r in riesgos" :key="r.id" type="button"
                :class="{ on: r.id === riesgo }" @click="elegirRiesgo(r.id)"
              >{{ r.texto }}</button>
            </div>
          </div>
        </div>
      </MbControlesDeJuego>

      <div class="gx-tgame">
        <div class="gx-tgrid" :style="{ gridTemplateColumns: columnas }">
          <div
            v-for="c in celdas" :key="c.id" :class="c.cls"
            @click="pisar(c.piso, c.baldosa)"
          >
            <img :src="c.img" alt="" :style="{ display: c.img ? 'block' : 'none' }">
          </div>
        </div>

        <div v-if="terminada && pagoSc > 0" class="gx-result">
          <small>{{ $t('games.youWon') }}</small>
          <b>{{ multiplicador.toFixed(2) }}x</b>
          <span class="amt">
            <span class="mb-sc" style="width: 18px; height: 18px; font-size: 7px" aria-hidden="true">SC</span>
            <em>{{ plata(pagoSc) }}</em>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import MbControlesDeJuego from "./MbControlesDeJuego.vue";
import jugar from "./jugar";

/**
 * DRAGON'S TOWER.
 *
 * Nueve pisos. En cada uno una baldosa esconde un dragón --o varias,
 * según la dificultad-- y acertar sube un escalón.
 *
 * LA TORRE SE DIBUJA DE ARRIBA HACIA ABAJO
 *
 * La fila de arriba es el piso 8 y la de abajo el 0, que es como lo
 * dibuja el diseño: se sube, así que el piso donde estás parado está
 * abajo y lo que falta queda arriba.
 *
 * LO QUE HAY DEBAJO NO SE SABE HASTA EL FINAL
 *
 * El servidor sortea la torre entera al abrir y no manda dónde están
 * los dragones hasta que la ronda termina. Esta pantalla solo sabe
 * lo que ya se pisó.
 */

/* Las mismas cinco de BetSweeps, con sus columnas. */
const DIFICULTADES = {
  easy: { baldosas: 4, dragones: 1 },
  med: { baldosas: 3, dragones: 1 },
  hard: { baldosas: 2, dragones: 1 },
  insane: { baldosas: 3, dragones: 2 },
  ultraInsane: { baldosas: 4, dragones: 3 },
};

const PISOS = 9;

export default {
  name: "MbJuegoTowers",

  components: { MbControlesDeJuego },

  mixins: [jugar],

  props: {
    maximoSc: { type: Number, default: 0 },
    saldoSc: { type: Number, default: 0 },
  },

  data() {
    return {
      riesgo: "med",
      menuAbierto: false,
      abierta: false,
      subidos: 0,
      elegidas: [],
      dragones: [],
      terminada: false,
      quemo: false,
      multiplicador: 0,
      pagoSc: 0,
    };
  },

  computed: {
    cfg() { return DIFICULTADES[this.riesgo]; },

    columnas() { return `repeat(${this.cfg.baldosas}, 1fr)`; },

    riesgos() {
      return [
        { id: "easy", texto: this.$t("games.riskEasy") },
        { id: "med", texto: this.$t("games.riskMedium") },
        { id: "hard", texto: this.$t("games.riskHard") },
        { id: "insane", texto: this.$t("games.riskInsane") },
        { id: "ultraInsane", texto: this.$t("games.riskUltra") },
      ];
    },

    nombreDelRiesgo() {
      return (this.riesgos.find((r) => r.id === this.riesgo) || {}).texto || "";
    },

    /** Lo que se llevaría si sube un piso más. */
    siguiente() {
      return (parseFloat(this.apuesta) || 0) * this.multDe(this.subidos + 1);
    },

    /* De arriba hacia abajo: la primera fila dibujada es el piso 8. */
    celdas() {
      const out = [];
      for (let piso = PISOS - 1; piso >= 0; piso -= 1) {
        for (let b = 0; b < this.cfg.baldosas; b += 1) {
          let cls = "gx-tcell";
          let img = "";

          const esElDeAhora = this.abierta && this.subidos === piso;
          if (esElDeAhora) cls += " picked";

          const pisada = piso < this.elegidas.length && this.elegidas[piso] === b;
          if (pisada) cls += " clicked";

          /* Lo de abajo del piso actual ya se jugó; lo de arriba, no
             --y al terminar se muestra todo. */
          const visible = this.terminada || piso < this.subidos;
          if (visible && this.dragones.length) {
            const malo = (this.dragones[piso] || []).includes(b);
            if (malo) {
              if (pisada) { cls += " mine"; img = "/img/juegos/torre-dragon.png"; }
            } else {
              cls += " safe";
              img = "/img/juegos/torre-moneda.png";
            }
          } else if (pisada && piso < this.subidos) {
            cls += " safe";
            img = "/img/juegos/torre-moneda.png";
          }

          out.push({ id: piso + "-" + b, piso, baldosa: b, cls, img });
        }
      }
      return out;
    },

    sinJugar() {
      if (this.girando) return true;
      if (this.abierta) return this.subidos <= 0;
      return (parseFloat(this.apuesta) || 0) <= 0;
    },

    etiquetaDelBoton() {
      if (this.girando) return this.$t("common.loading");
      /* Igual que en Mines: con la torre empezada, el boton dice
         cuanto se lleva si baja ahora. */
      if (this.abierta) {
        return this.$t("games.collectAmt", { amount: this.plata(this.cobraAhora) });
      }
      return this.$t("games.play");
    },

    /** Lo que se lleva si cobra desde el piso donde esta parado. */
    cobraAhora() {
      return (parseFloat(this.apuesta) || 0) * this.multDe(this.subidos);
    },

    trabado() { return this.girando || this.abierta; },
  },

  methods: {
    /* La misma cuenta que el servidor; el que paga es él. */
    multDe(piso) {
      if (piso <= 0) return 0;
      const porPiso = this.cfg.baldosas / (this.cfg.baldosas - this.cfg.dragones);
      return Math.max(1, 0.94 * Math.pow(porPiso, piso));
    },

    elegirRiesgo(id) {
      if (this.abierta) return;
      this.riesgo = id;
      this.menuAbierto = false;
      this.limpiar();
    },

    limpiar() {
      this.subidos = 0;
      this.elegidas = [];
      this.dragones = [];
      this.terminada = false;
      this.quemo = false;
      this.multiplicador = 0;
      this.pagoSc = 0;
    },

    async jugar() {
      if (this.abierta) return this.cobrar();

      this.limpiar();
      const d = await this.unaJugada("/games/towers/open", { riesgo: this.riesgo });
      if (!d) return;
      this.abierta = true;
    },

    async pisar(piso, baldosa) {
      if (!this.abierta || this.girando) return;
      /* Solo se puede pisar el piso donde estás parado. */
      if (piso !== this.subidos) return;

      const d = await this.unaJugada("/games/towers/tile", { baldosa });
      if (!d) return;

      this.subidos = d.subidos || 0;
      this.elegidas = d.elegidas || [];

      /* Un piso mas: la moneda. El dragon lo pone el final. */
      if (!d.termino) this.sonar("pop");

      if (d.termino) {
        if (d.quemo) this.sonar("boom");
        this.abierta = false;
        this.terminada = true;
        this.quemo = !!d.quemo;
        this.dragones = d.dragones || [];
        this.multiplicador = d.multiplicador || 0;
        this.pagoSc = d.pagoSc || 0;
        this.anotar({ v: d.quemo ? "✕" : this.multiplicador.toFixed(2) + "x", gano: !d.quemo });
      }
    },

    async cobrar() {
      const d = await this.unaJugada("/games/towers/cashout", {});
      if (!d) return;

      this.abierta = false;
      this.terminada = true;
      this.dragones = d.dragones || [];
      this.multiplicador = d.multiplicador || 0;
      this.pagoSc = d.pagoSc || 0;
      this.sonar("cash");
      this.anotar({ v: this.multiplicador.toFixed(2) + "x", gano: true });
    },
  },
};
</script>
