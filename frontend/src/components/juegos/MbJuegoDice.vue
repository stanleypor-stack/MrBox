<template>
  <div class="gx gx-dice">
    <div class="gx-row">
      <!-- ── La columna de controles ───────────────────────────── -->
      <div class="gx-ctl">
        <div class="gx-mode">
          <button type="button" :class="{ on: !auto }" @click="auto = false">Manual</button>
          <button type="button" :class="{ on: auto }" @click="auto = true">Auto</button>
        </div>

        <div class="gx-main p25">
          <div class="gx-betamt">
            <div class="gx-title">{{ $t('games.playAmount') }}</div>
            <div :class="['gx-amt', { err: !!errorApuesta }]">
              <input
                type="text" inputmode="decimal" :placeholder="$t('games.amount')"
                :aria-label="$t('games.playAmount')" :value="apuesta"
                :disabled="girando" @input="escribirApuesta" @blur="redondearApuesta"
              >
              <span class="mb-sc" style="width: 20px; height: 20px; font-size: 8px" aria-hidden="true">SC</span>
              <div class="gx-hx">
                <button type="button" @click="mitad">&#189;</button>
                <button type="button" @click="doble">2x</button>
              </div>
            </div>
            <p v-if="errorApuesta" class="gx-errtxt">{{ errorApuesta }}</p>
          </div>

          <div class="gx-title">{{ $t('games.winAmount') }}</div>
          <div class="gx-profit">
            <span>{{ plata(ganancia) }}</span>
            <span class="mb-sc" style="width: 20px; height: 20px; font-size: 8px" aria-hidden="true">SC</span>
          </div>

          <div class="gx-seg4">
            <button
              v-for="m in modos" :key="m.id" type="button"
              :class="{ on: modo === m.id }" :aria-label="m.id" @click="elegirModo(m.id)"
            >
              <img :src="m.img" alt="">
            </button>
          </div>

          <div v-if="auto" class="gx-count">
            <div class="gx-title">{{ $t('games.numberOfPlays') }}</div>
            <div class="gx-countbox">
              <input
                type="text" inputmode="numeric" :aria-label="$t('games.numberOfPlays')"
                :value="cuantas" @input="escribirCuantas"
              >
              <img v-show="!Number(cuantas)" src="/img/juegos/infinito.svg" alt="" style="width: 22px">
            </div>
          </div>

          <div class="gx-bet">
            <button
              type="button" :class="['gx-btn', { red: auto && quedan > 0 }]"
              :disabled="noSePuedeJugar" @click="jugar"
            >
              <span class="edge"></span>
              <span class="front">{{ etiquetaDelBoton }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- ── El tablero ────────────────────────────────────────── -->
      <div class="gx-game">
        <div class="gx-dhist">
          <div v-for="(h, i) in historial" :key="i" :class="h.gano ? 'gx-chip w' : 'gx-chip'">
            {{ h.v }}
          </div>
        </div>

        <div class="gx-dw1">
          <div class="gx-dw">
            <div
              ref="pista" class="gx-dtrack" :style="{ background: pistaVerde ? 'var(--win)' : 'var(--loss)' }"
              @pointerdown="tocarPista"
            >
              <div
                class="gx-dfill"
                :style="{ left: dos ? t1 + '%' : '0%', width: dos ? (t2 - t1) + '%' : t1 + '%',
                          background: pistaVerde ? 'var(--loss)' : 'var(--win)' }"
              ></div>

              <div class="gx-dres" :style="{ left: (resultado ? resultado.numero : 50) + '%', opacity: resultado ? 1 : 0 }">
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
              <input type="text" inputmode="numeric" :value="t1" @change="escribirT1">
              <template v-if="dos">
                <span style="margin: 0 6px">-</span>
                <input type="text" inputmode="numeric" :value="t2" @change="escribirT2">
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
import api from "@/api";

/**
 * DICE.
 *
 * La pantalla es la del diseño, calcada: las mismas clases, el mismo
 * CSS (`styles/_juegos.scss`) y los mismos dibujos. Lo que cambia es
 * de dónde sale el resultado: acá lo decide el SERVIDOR.
 *
 * NADA DE LO QUE SE CALCULA ACA DECIDE UN PAGO
 *
 * El multiplicador y la chance se muestran para que el jugador sepa a
 * qué está jugando antes de apretar, pero el servidor los vuelve a
 * calcular con su propio margen y paga por los suyos. Si alguien toca
 * estos números en el navegador, lo único que logra es mentirse a sí
 * mismo: ver `backend/services/games/dice.js`.
 *
 * EL NUMERO SE MUESTRA CON DOS DECIMALES, COMO EN EL DISEÑO
 *
 * El sorteo da un entero de 0 a 99 --es la regla de BetSweeps y es de
 * donde sale el 94%-- y el diseño lo dibuja con dos decimales. Las
 * dos cosas conviven: el entero es el que decide y el `.00` es cómo
 * se escribe.
 */
export default {
  name: "MbJuegoDice",

  props: {
    /* El tope de apuesta y el saldo vienen de arriba: son del sitio,
       no de este juego. */
    maximoSc: { type: Number, default: 0 },
    saldoSc: { type: Number, default: 0 },
  },

  data() {
    return {
      auto: false,
      apuesta: "1.00",
      cuantas: "0",
      modo: "under",
      t1: 50,
      t2: 85,
      girando: false,
      resultado: null,
      historial: [],
      errorApuesta: "",
      arrastrando: 0,
      quedan: 0,
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

    /* Cuántos de los 100 números pagan. La MISMA cuenta que el
       servidor; ver el comentario de arriba sobre quién manda. */
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

    /* La franja pintada es la que PIERDE en `outside`, al revés que en
       los otros tres: es lo que hace el diseño. */
    pistaVerde() { return this.modo === "outside"; },

    noSePuedeJugar() {
      if (this.girando) return true;
      const n = parseFloat(this.apuesta) || 0;
      return n <= 0 || this.chance <= 0;
    },

    etiquetaDelBoton() {
      if (this.girando) return this.$t("common.loading");
      if (this.auto && this.quedan > 0) return this.$t("games.stop");
      return this.auto ? this.$t("games.startAuto") : this.$t("games.play");
    },
  },

  beforeDestroy() {
    this.soltar();
    this.quedan = 0;
  },

  methods: {
    plata(n) {
      return Number(n || 0).toLocaleString("en-US", {
        minimumFractionDigits: 2, maximumFractionDigits: 2,
      });
    },

    /* ── La apuesta ───────────────────────────────────────────── */

    escribirApuesta(e) {
      let v = String(e.target.value).replace(",", ".").replace(/[^\d.]/g, "");
      const i = v.indexOf(".");
      if (i >= 0) v = v.slice(0, i + 1) + v.slice(i + 1).replace(/\./g, "").slice(0, 2);
      this.apuesta = v;
      this.errorApuesta = "";
    },

    redondearApuesta() {
      const n = parseFloat(this.apuesta) || 0;
      this.apuesta = this.plata(n > 0 ? this.acotar(n) : 0);
    },

    /* Nunca más que el saldo ni que el tope del sitio: apretar y que
       rebote por algo que la pantalla ya sabía es una molestia
       evitable. */
    acotar(n) {
      let x = Math.max(0.01, n);
      if (this.maximoSc > 0) x = Math.min(x, this.maximoSc);
      if (this.saldoSc > 0) x = Math.min(x, this.saldoSc);
      return x;
    },

    mitad() {
      if (this.girando) return;
      this.apuesta = this.plata(this.acotar((parseFloat(this.apuesta) || 0) / 2));
    },

    doble() {
      if (this.girando) return;
      this.apuesta = this.plata(this.acotar((parseFloat(this.apuesta) || 0) * 2));
    },

    escribirCuantas(e) {
      this.cuantas = String(e.target.value).replace(/[^\d]/g, "").slice(0, 4);
    },

    /* ── El objetivo ──────────────────────────────────────────── */

    elegirModo(id) {
      if (this.girando) return;
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

      Con eventos de puntero y `setPointerCapture`, que es lo que hace
      que el dedo siga mandando aunque se salga de la barra. Con
      `mousemove` suelto, arrastrar rápido en un celular pierde el
      control a mitad de camino.
    */
    agarrar(cual, e) {
      if (this.girando) return;
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

    /* Tocar la barra mueve la manija más cercana. */
    tocarPista(e) {
      if (this.girando || !this.$refs.pista) return;
      const caja = this.$refs.pista.getBoundingClientRect();
      const pct = Math.round(((e.clientX - caja.left) / caja.width) * 100);
      const cual = this.dos && Math.abs(pct - this.t2) < Math.abs(pct - this.t1) ? 2 : 1;
      this.agarrar(cual, e);
    },

    /* ── Jugar ────────────────────────────────────────────────── */

    async jugar() {
      /* En automático, el botón para. */
      if (this.auto && this.quedan > 0) { this.quedan = 0; return; }

      if (this.auto) {
        const n = parseInt(this.cuantas, 10) || 0;
        /* Cero quiere decir "hasta que lo pare", que es lo que dibuja
           el infinito al lado del campo. */
        this.quedan = n > 0 ? n : Infinity;
      }

      await this.unaTirada();

      while (this.auto && this.quedan > 0) {
        this.quedan -= 1;
        if (this.quedan <= 0) break;
        await new Promise((r) => setTimeout(r, 420));
        if (!this.auto || this.quedan <= 0) break;
        const sigue = await this.unaTirada();
        if (!sigue) break;
      }
      this.quedan = 0;
    },

    async unaTirada() {
      this.girando = true;
      this.errorApuesta = "";
      try {
        const { data } = await api.post("/games/dice/play", {
          apuestaSc: parseFloat(this.apuesta) || 0,
          modo: this.modo,
          desde: this.t1,
          hasta: this.dos ? this.t2 : undefined,
        });

        const d = data.data;
        this.$store.commit("saldo", d);
        this.resultado = { numero: d.numero, gano: d.gano };

        /* Los últimos diez, como en el diseño. */
        this.historial.unshift({ v: d.numero.toFixed(2), gano: d.gano });
        this.historial = this.historial.slice(0, 10);

        this.$emit("ronda", d);
        return true;
      } catch (err) {
        this.errorApuesta = err.textoParaElJugador || "";
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
        return false;
      } finally {
        this.girando = false;
      }
    },
  },
};
</script>
