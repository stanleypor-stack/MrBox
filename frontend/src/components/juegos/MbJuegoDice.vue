<template>
  <div class="gx gx-dice">
    <div class="gx-row">
      <MbControlesDeJuego
        v-model="apuesta" :auto="auto" :cuantas="cuantas" :trabado="trabado"
        :sin-jugar="sinJugar" :etiqueta="etiquetaDelBoton" :rojo="quedan > 0"
        :error="error" :maximo-sc="maximoSc" :saldo-sc="saldoSc" compacto
        @auto="auto = $event" @cuantas="cuantas = $event" @jugar="jugar"
      >
        <div class="gx-title">{{ $t('games.winAmount') }}</div>
        <div class="gx-profit">
          <span>{{ plata(ganancia) }}</span>
          <span class="mb-sc" style="width: 20px; height: 20px; font-size: 8px" aria-hidden="true">SC</span>
        </div>

        <div class="gx-seg4">
          <button
            v-for="m in modos" :key="m.id" type="button"
            :class="{ on: modo === m.id }" :aria-label="m.id"
            :disabled="trabado" @click="elegirModo(m.id)"
          >
            <img :src="m.img" alt="">
          </button>
        </div>
      </MbControlesDeJuego>

      <div class="gx-game">
        <div class="gx-dhist">
          <div v-for="(h, i) in historial" :key="i" :class="h.gano ? 'gx-chip w' : 'gx-chip'">
            {{ h.v }}
          </div>
        </div>

        <div class="gx-dw1">
          <div class="gx-dw">
            <div
              ref="pista" class="gx-dtrack"
              :style="{ background: modo === 'outside' ? 'var(--win)' : 'var(--loss)' }"
              @pointerdown="tocarPista"
            >
              <div
                class="gx-dfill"
                :style="{
                  left: dos ? t1 + '%' : '0%',
                  width: dos ? (t2 - t1) + '%' : t1 + '%',
                  background: modo === 'outside' ? 'var(--loss)' : 'var(--win)',
                }"
              ></div>

              <div
                class="gx-dres"
                :style="{ left: (resultado ? resultado.numero : 50) + '%', opacity: resultado ? 1 : 0 }"
              >
                <span :style="{ color: resultado && resultado.gano ? 'var(--win)' : 'var(--loss)' }">
                  {{ resultado ? resultado.numero.toFixed(2) : '' }}
                </span>
              </div>

              <div class="gx-dhandle" :style="{ left: t1 + '%' }" @pointerdown.stop="agarrar(1, $event)">
                <span class="gx-dtip">{{ dos ? '' : t1 }}</span>
              </div>
              <div v-if="dos" class="gx-dhandle" :style="{ left: t2 + '%' }" @pointerdown.stop="agarrar(2, $event)"></div>
            </div>
          </div>
        </div>

        <div class="gx-dfoot">
          <div>
            <div class="gx-dhead">{{ $t('games.multiplier') }}</div>
            <div class="gx-iconbox">
              <input type="text" readonly :value="multiplicador.toFixed(2)" style="max-width: 60px">
              <img src="/img/juegos/multi.svg" alt="">
            </div>
          </div>
          <div>
            <div class="gx-dhead">{{ modo }}</div>
            <div class="gx-iconbox">
              <input type="text" inputmode="numeric" :value="t1" :disabled="trabado" @change="escribirT1">
              <template v-if="dos">
                <span style="margin: 0 6px">-</span>
                <input type="text" inputmode="numeric" :value="t2" :disabled="trabado" @change="escribirT2">
              </template>
              <img src="/img/juegos/lowhigh.svg" alt="">
            </div>
          </div>
          <div>
            <div class="gx-dhead">{{ $t('games.chance') }}</div>
            <div class="gx-iconbox">
              <input type="text" readonly :value="chance + '%'" style="max-width: 60px">
              <img src="/img/juegos/chance.svg" alt="">
            </div>
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
 * DICE.
 *
 * Sale un número de 0 a 99 y el jugador apuesta a dónde cae. Cuatro
 * modos: menor, mayor, adentro y afuera.
 *
 * LO QUE SE CALCULA ACA NO DECIDE NINGUN PAGO
 *
 * El multiplicador y la chance se muestran para que el jugador sepa a
 * qué juega antes de apretar, pero el servidor los vuelve a calcular
 * con su margen y paga por los suyos. Tocar estos números en el
 * navegador no cambia un peso: ver `backend/services/games/dice.js`.
 *
 * EL NUMERO SE ESCRIBE CON DOS DECIMALES, COMO EN EL DISEÑO
 *
 * El sorteo da un entero de 0 a 99 --es la regla de BetSweeps y de
 * ahí sale el 94%-- y el diseño lo dibuja con dos decimales. El
 * entero es el que decide; el `.00` es cómo se escribe.
 */
export default {
  name: "MbJuegoDice",

  components: { MbControlesDeJuego },

  mixins: [jugar],

  props: {
    maximoSc: { type: Number, default: 0 },
    saldoSc: { type: Number, default: 0 },
  },

  data() {
    return {
      modo: "under",
      t1: 50,
      t2: 85,
      resultado: null,
      arrastrando: 0,
    };
  },

  computed: {
    modos() {
      return [
        { id: "under", img: "/img/juegos/dice-under.svg" },
        { id: "over", img: "/img/juegos/dice-over.svg" },
        { id: "between", img: "/img/juegos/dice-inside.svg" },
        { id: "outside", img: "/img/juegos/dice-outside.svg" },
      ];
    },

    dos() { return this.modo === "between" || this.modo === "outside"; },

    chance() {
      if (this.modo === "over") return 99 - this.t1;
      if (this.modo === "under") return this.t1;
      if (this.modo === "between") return this.t2 - this.t1 - 1;
      return 99 - (this.t2 - this.t1);
    },

    multiplicador() {
      return this.chance > 0 ? (100 - 6) / this.chance : 0;
    },

    ganancia() {
      return (parseFloat(this.apuesta) || 0) * this.multiplicador;
    },

    sinJugar() {
      return this.girando || (parseFloat(this.apuesta) || 0) <= 0 || this.chance <= 0;
    },
  },

  beforeDestroy() { this.soltar(); },

  methods: {
    elegirModo(id) {
      if (this.trabado) return;
      const eraDoble = this.dos;
      this.modo = id;
      if (this.dos && !eraDoble) { this.t1 = 35; this.t2 = 85; }
      if (!this.dos && eraDoble) { this.t1 = 50; }
    },

    escribirT1(e) {
      const v = parseInt(e.target.value, 10);
      if (Number.isNaN(v) || v < 1 || v > 99) return;
      this.t1 = this.dos ? Math.max(4, Math.min(this.t2 - 3, v)) : Math.max(4, Math.min(95, v));
    },

    escribirT2(e) {
      const v = parseInt(e.target.value, 10);
      if (Number.isNaN(v) || v < 1 || v > 99) return;
      this.t2 = Math.min(96, Math.max(this.t1 + 3, v));
    },

    /*
      ARRASTRAR LAS MANIJAS.

      Con eventos de puntero y `setPointerCapture`: es lo que hace que
      el dedo siga mandando aunque se salga de la barra. Con
      `mousemove` suelto, arrastrar rápido en un celular pierde el
      control a mitad de camino.
    */
    agarrar(cual, e) {
      if (this.trabado) return;
      this.arrastrando = cual;
      try { e.target.setPointerCapture(e.pointerId); } catch (err) { /* da igual */ }
      window.addEventListener("pointermove", this.mover);
      window.addEventListener("pointerup", this.soltar);
      this.mover(e);
    },

    mover(e) {
      if (!this.arrastrando || !this.$refs.pista) return;
      const caja = this.$refs.pista.getBoundingClientRect();
      const pct = Math.round(((e.clientX - caja.left) / caja.width) * 100);

      if (this.arrastrando === 1) {
        this.t1 = this.dos
          ? Math.max(4, Math.min(this.t2 - 3, pct))
          : Math.max(4, Math.min(95, pct));
      } else {
        this.t2 = Math.min(96, Math.max(this.t1 + 3, pct));
      }
    },

    soltar() {
      this.arrastrando = 0;
      window.removeEventListener("pointermove", this.mover);
      window.removeEventListener("pointerup", this.soltar);
    },

    tocarPista(e) {
      if (this.trabado || !this.$refs.pista) return;
      const caja = this.$refs.pista.getBoundingClientRect();
      const pct = Math.round(((e.clientX - caja.left) / caja.width) * 100);
      const cual = this.dos && Math.abs(pct - this.t2) < Math.abs(pct - this.t1) ? 2 : 1;
      this.agarrar(cual, e);
    },

    jugar() {
      return this.apretar(async () => {
        const d = await this.unaJugada("/games/dice/play", {
          modo: this.modo,
          desde: this.t1,
          hasta: this.dos ? this.t2 : undefined,
        });
        if (!d) return false;

        this.resultado = { numero: d.numero, gano: d.gano };
        this.anotar({ v: d.numero.toFixed(2), gano: d.gano });
        return true;
      });
    },
  },
};
</script>
