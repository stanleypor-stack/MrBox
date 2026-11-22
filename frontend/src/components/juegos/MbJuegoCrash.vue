<template>
  <div class="gx gx-crash">
    <div class="gx-row">
      <div class="gx-cctl">
        <div class="gx-mode">
          <button type="button" :class="{ on: !auto }" @click="auto = false">
            {{ $t('games.manual') }}
          </button>
          <button type="button" :class="{ on: auto }" @click="auto = true">
            {{ $t('games.auto') }}
          </button>
        </div>

        <div class="gx-main gx-cmain">
          <div class="gx-betamt">
            <div class="gx-title">{{ $t('games.playAmount') }}</div>
            <div :class="['gx-amt', { err: !!error }]">
              <input
                type="text" inputmode="decimal" :placeholder="$t('games.amount')"
                :aria-label="$t('games.playAmount')" :value="apuesta"
                :disabled="trabado" @input="escribir" @blur="redondear"
              >
              <span class="mb-sc" style="width: 20px; height: 20px; font-size: 8px" aria-hidden="true">SC</span>
              <div class="gx-hx">
                <button type="button" :disabled="trabado" @click="mitad">&#189;</button>
                <button type="button" :disabled="trabado" @click="doble">2x</button>
              </div>
            </div>
            <p v-if="error" class="gx-errtxt">{{ error }}</p>
          </div>

          <div class="gx-ctitle" style="margin-top: 5px">{{ $t('games.collectAt') }}</div>
          <div class="gx-cbox">
            <input
              type="text" inputmode="decimal" :placeholder="$t('games.multiplier')"
              :aria-label="$t('games.collectAt')" :value="cobrarEn"
              @input="escribirAuto" @blur="redondearAuto"
            >
            <div class="ud">
              <button type="button" @click="moverAuto(0.1)">
                <img src="/img/juegos/mas.png" alt="up">
              </button>
              <button type="button" @click="moverAuto(-0.1)">
                <img src="/img/juegos/menos.png" alt="down">
              </button>
            </div>
          </div>

          <div class="gx-cplay">
            <button
              type="button" :class="{ red: boton.rojo }" :disabled="boton.trabado"
              @click="boton.hacer()"
            >
              {{ boton.texto }}
            </button>
          </div>

          <div class="gx-cbets">
            <div v-for="(b, i) in apuestas.slice(0, 12)" :key="i" class="gx-cbe">
              <span class="u">{{ b.jugador }}</span>
              <span class="r">
                <b :style="{ display: b.multiplicador > 0 ? 'inline' : 'none' }">
                  {{ (b.multiplicador || 0).toFixed(2) }}x
                </b>
                <span>
                  <span class="mb-sc" style="width: 16px; height: 16px; font-size: 7px" aria-hidden="true">SC</span>
                  {{ plata(b.apuestaSc) }}
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <div class="gx-cleft">
        <div class="gx-cgame">
          <canvas ref="lienzo" aria-label="Crash graph"></canvas>

          <div class="gx-chist">
            <div v-for="(h, i) in ultimos" :key="i" :class="h.alto ? 'h' : ''">{{ h.texto }}</div>
          </div>

          <div class="gx-cinfo"><i></i><span>{{ $t('games.networkStatus') }}</span></div>

          <div class="gx-cinner">
            <div v-if="estado === 'mostrando'" class="gx-cbig">{{ punto.toFixed(2) }}</div>

            <template v-if="estado === 'girando'">
              <div class="gx-cbig g">{{ multiplicador.toFixed(2) }}x</div>
              <div v-if="cobrando" class="gx-cwin">
                <span class="mb-sc" style="width: 26px; height: 26px; font-size: 9px" aria-hidden="true">SC</span>
                +{{ plata(mia.apuestaSc * multiplicador) }}
              </div>
            </template>

            <div v-if="estado === 'apostando'" class="gx-cwait">
              {{ $t('games.startingIn', { s: (faltaMs / 1000).toFixed(1) }) }}
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
 * CRASH.
 *
 * Un avión que sube y en algún momento revienta. Se apuesta antes de
 * que arranque y se cobra en vuelo: el multiplicador de cuando se
 * apretó es lo que se paga. Si revienta antes, la apuesta queda.
 *
 * EL RELOJ ES EL DEL SERVIDOR
 *
 * Esta pantalla dibuja, no decide. El multiplicador que se ve sale de
 * cuánto hace que arrancó la ronda --dato que manda el servidor-- y
 * lo que se paga al cobrar lo vuelve a calcular él con SU reloj. Lo
 * que diga el navegador no entra en la cuenta.
 *
 * POR DONDE REVIENTA NO SE SABE HASTA QUE REVIENTA
 *
 * Mientras vuela, el servidor manda solamente cuánto hace que
 * arrancó: ni el punto, ni cuánto falta para el final. Si mandara
 * cualquiera de los dos, una resta daría el punto y cobrar un
 * milisegundo antes dejaría de ser suerte. Por eso el número grande
 * sigue subiendo hasta que la respuesta siguiente dice que ya
 * reventó: el número puede pasarse por lo que tarda una consulta, la
 * plata nunca, porque la decide el servidor.
 *
 * EL GRAFICO ES EL DEL DISEÑO, CALCADO
 *
 * Las cuentas del canvas --la escala, las marcas, la curva, el
 * relleno-- están tal cual el prototipo. Lo único que cambia es de
 * dónde sale el tiempo: de la ronda compartida y no de un reloj
 * propio.
 */

/* La curva, la misma que el servidor: e^(0,00006 t). */
const RITMO = 0.00006;

/* Cada cuánto se pregunta. Mientras vuela, seguido: lo que tarda una
   consulta es lo que puede pasarse el número de la pantalla. */
const LATIDO_VUELO_MS = 300;
const LATIDO_QUIETO_MS = 700;

export default {
  name: "MbJuegoCrash",

  props: {
    maximoSc: { type: Number, default: 0 },
    saldoSc: { type: Number, default: 0 },
  },

  data() {
    return {
      apuesta: "1.00",
      cobrarEn: "2.00",
      auto: false,
      error: "",

      estado: "apostando",
      numero: 0,
      faltaMs: 0,
      punto: 1,
      historial: [],
      apuestas: [],
      mia: null,

      /* Lo que hace que arrancó, según el servidor, y cuándo se supo:
         entre consulta y consulta el tiempo se sigue solo. */
      base: { ms: 0, cuando: 0 },
      multiplicador: 1,

      mandando: false,
      /* Apretó Play con la ronda ya en vuelo: entra en la que sigue. */
      enEspera: false,

      latido: null,
      cadaCuanto: 0,
      cuadro: null,
      vivo: true,
    };
  },

  computed: {
    monto() {
      return Math.round((parseFloat(this.apuesta) || 0) * 100) / 100;
    },

    autoNum() {
      return Math.max(1.01, parseFloat(this.cobrarEn) || 2);
    },

    /* Mientras hay plata jugada en esta ronda no se cambia el monto. */
    trabado() {
      return this.mandando || !!this.mia || this.enEspera;
    },

    /** La apuesta propia sigue viva y se puede cobrar. */
    cobrando() {
      return this.estado === "girando" && !!this.mia
        && !this.mia.multiplicador && this.mia.abierta && !this.enEspera;
    },

    /*
      EL BOTON, CON LOS TRES ESTADOS DEL DISEÑO.

      Play cuando no hay nada jugado; "Starting..." cuando ya se
      apostó y la ronda todavía no arrancó --o se apostó para la que
      viene--; Collect mientras el avión vuela con plata adentro.
    */
    boton() {
      if (this.mandando) {
        return { texto: this.$t("common.loading"), trabado: true, rojo: false, hacer: () => {} };
      }

      if (this.cobrando) {
        return {
          texto: this.$t("games.collect"),
          trabado: false,
          rojo: true,
          hacer: this.cobrar,
        };
      }

      if (this.enEspera || (this.mia && this.estado === "apostando")) {
        return {
          texto: this.$t("games.startingDots"), trabado: true, rojo: false, hacer: () => {},
        };
      }

      return {
        texto: this.$t("games.play"),
        trabado: this.monto <= 0 || this.monto > this.saldoSc,
        rojo: false,
        hacer: this.apostar,
      };
    },

    ultimos() {
      return this.historial.slice(0, 14).map((h) => {
        const p = Number((h.resultadoVisible || {}).punto) || 1;
        return { texto: p.toFixed(2) + "x", alto: p >= 2 };
      });
    },
  },

  created() { this.mirar(); },

  mounted() {
    this.latido = window.setInterval(this.mirar, LATIDO_QUIETO_MS);
    this.cuadro = window.requestAnimationFrame(this.pintar);
  },

  beforeDestroy() {
    /*
      SE APAGA TODO AL SALIR.

      El automático no puede quedar apostando en una pantalla que ya
      no se ve, y el dibujo no puede seguir pidiendo cuadros.
    */
    this.vivo = false;
    this.auto = false;
    if (this.latido) window.clearInterval(this.latido);
    if (this.cuadro) window.cancelAnimationFrame(this.cuadro);
  },

  methods: {
    plata(n) {
      return Number(n || 0).toLocaleString("en-US", {
        minimumFractionDigits: 2, maximumFractionDigits: 2,
      });
    },

    /* ── El monto ──────────────────────────────────────────────── */

    escribir(e) {
      let v = String(e.target.value).replace(",", ".").replace(/[^\d.]/g, "");
      const i = v.indexOf(".");
      if (i >= 0) v = v.slice(0, i + 1) + v.slice(i + 1).replace(/\./g, "").slice(0, 2);
      this.apuesta = v;
    },

    acotar(n) {
      let x = Math.max(0.01, n);
      if (this.maximoSc > 0) x = Math.min(x, this.maximoSc);
      if (this.saldoSc > 0) x = Math.min(x, this.saldoSc);
      return x;
    },

    redondear() {
      const n = parseFloat(this.apuesta) || 0;
      this.apuesta = this.plata(n > 0 ? this.acotar(n) : 0);
    },

    mitad() { this.apuesta = this.plata(this.acotar(this.monto / 2)); },
    doble() { this.apuesta = this.plata(this.acotar(this.monto * 2)); },

    /* ── El cobro automático ───────────────────────────────────── */

    escribirAuto(e) {
      this.cobrarEn = String(e.target.value).replace(/[^\d.]/g, "").slice(0, 7);
    },

    redondearAuto() { this.cobrarEn = this.autoNum.toFixed(2); },

    moverAuto(paso) {
      this.cobrarEn = Math.max(1.01, this.autoNum + paso).toFixed(2);
    },

    /* ── La ronda ──────────────────────────────────────────────── */

    async mirar() {
      try {
        const { data } = await api.get("/games/crash/estado");
        const d = data.data;

        const esOtra = d.numero !== this.numero;
        this.numero = d.numero;
        this.estado = d.estado;
        this.faltaMs = d.faltaMs || 0;
        this.historial = d.historial || [];
        this.apuestas = d.apuestas || [];
        this.mia = d.miApuesta || null;

        if (d.estado === "girando") {
          this.base = { ms: d.transcurridoMs || 0, cuando: performance.now() };
        } else if (d.estado === "apostando") {
          this.base = { ms: 0, cuando: performance.now() };
          this.multiplicador = 1;
        }

        if (d.resultado && typeof d.resultado.punto === "number") {
          this.punto = d.resultado.punto;
          this.multiplicador = d.resultado.punto;
        }

        /* El latido va más seguido mientras vuela. */
        this.acomodarLatido(d.estado === "girando" ? LATIDO_VUELO_MS : LATIDO_QUIETO_MS);

        /*
          LA APUESTA QUE ESPERABA, Y EL AUTOMATICO.

          Las dos entran en el mismo lugar: cuando la ronda abre y la
          pantalla todavía no tiene nada jugado en ella.
        */
        if (esOtra && d.estado === "apostando" && !this.mia) {
          if (this.enEspera || this.auto) await this.apostar(true);
        }
      } catch (err) {
        /* La consulta siguiente lo arregla. */
      }
    },

    acomodarLatido(cada) {
      if (this.cadaCuanto === cada || !this.vivo) return;
      this.cadaCuanto = cada;
      if (this.latido) window.clearInterval(this.latido);
      this.latido = window.setInterval(this.mirar, cada);
    },

    async apostar(automatica = false) {
      if (this.mandando || this.mia) return;

      /* Si la ronda ya arrancó, la apuesta entra en la que sigue: es
         lo que hace el diseño cuando se aprieta Play en pleno vuelo. */
      if (this.estado !== "apostando") {
        this.enEspera = true;
        return;
      }

      this.mandando = true;
      this.error = "";
      try {
        const { data } = await api.post("/games/crash/bet", {
          apuestaSc: this.monto,
          autoCobrarEn: this.autoNum > 1 ? this.autoNum : undefined,
        });
        this.$store.commit("saldo", data.data);
        this.mia = data.data.miApuesta || null;
        this.apuestas = data.data.apuestas || [];
        this.enEspera = false;
      } catch (err) {
        this.error = err.textoParaElJugador || "";
        this.enEspera = false;
        /* Si falla, el automático para: repetir un error no es una
           comodidad, es un cartel repetido. */
        this.auto = false;
        if (!automatica) {
          this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
        }
      } finally {
        this.mandando = false;
      }
    },

    async cobrar() {
      if (this.mandando) return;
      this.mandando = true;
      try {
        const { data } = await api.post("/games/crash/cashout", { en: this.multiplicador });
        this.$store.commit("saldo", data.data);

        if (data.data.reventado) {
          /* Se apretó tarde: el servidor dice que ya había reventado. */
          this.$store.dispatch("avisar", { texto: this.$t("games.tooLate"), tono: "error" });
        }
        await this.mirar();
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      } finally {
        this.mandando = false;
      }
    },

    /* ── El dibujo ─────────────────────────────────────────────── */

    pintar() {
      if (!this.vivo) return;

      if (this.estado === "girando") {
        const t = this.base.ms + (performance.now() - this.base.cuando);
        this.multiplicador = Math.floor(Math.exp(RITMO * t) * 100) / 100;
      }

      this.dibujar();
      this.cuadro = window.requestAnimationFrame(this.pintar);
    },

    /*
      EL GRAFICO, TAL CUAL EL DISEÑO.

      Esto es el `gxDrawCrash` del prototipo con los nombres
      traducidos: la escala, las marcas de los ejes, la curva, el
      relleno y la pelota. No se le cambió ninguna cuenta.
    */
    dibujar() {
      const cv = this.$refs.lienzo;
      if (!cv) return;

      const w = cv.clientWidth;
      const h = cv.clientHeight;
      if (!w || !h) return;

      const ratio = window.devicePixelRatio || 1;
      if (cv.width !== Math.round(w * ratio) || cv.height !== Math.round(h * ratio)) {
        cv.width = Math.round(w * ratio);
        cv.height = Math.round(h * ratio);
      }

      const ctx = cv.getContext("2d");
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const sm = w < 500;
      const xStart = sm ? 28 : 30;
      const yStart = 20;
      const topPad = sm ? 70 : 95;
      const pw = w - xStart - 10;
      const ph = h - yStart - topPad;

      const volando = this.estado === "girando";
      const reventado = this.estado === "mostrando";
      const mult = this.estado === "apostando" ? 1 : this.multiplicador;

      const crecimiento = Math.log(mult) / RITMO;
      const XBEG = 1;
      const YBEG = Math.max(800, crecimiento);
      const YPB = 100;
      const YPE = Math.max(725, 100 * mult);
      const XS = pw / (YBEG - XBEG);
      const YS = ph / (YPE - YPB);
      const trX = (t) => XS * (t - XBEG);
      const trY = (p) => -(YS * (p - YPB));

      const marca = (s) => {
        let r = 1;
        for (;;) {
          if (r > s) return r;
          r *= 2;
          if (r > s) return r;
          r *= 5;
        }
      };

      ctx.save();
      ctx.translate(xStart, h - yStart);
      ctx.font = (sm ? "12px" : "16px") + " Excon";
      ctx.textAlign = "center";
      ctx.strokeStyle = "white";
      ctx.fillStyle = "white";
      ctx.lineWidth = 1;

      const ySep = marca((16 * 4 + 25) / YS);
      const xSep = marca((2 * ctx.measureText("10000").width) / XS);

      ctx.beginPath();
      for (let p = YPB + ySep; p < YPE; p += ySep) { ctx.moveTo(0, trY(p)); ctx.lineTo(-4, trY(p)); }
      for (let t = xSep; t < YBEG; t += xSep) { ctx.moveTo(trX(t), 0); ctx.lineTo(trX(t), 4); }
      ctx.stroke();

      for (let p = YPB + ySep; p < YPE; p += ySep) ctx.fillText(p / 100 + "x", -20, trY(p));
      for (let t = 0; t < YBEG; t += xSep) ctx.fillText(t / 1000 + "s", trX(t), 11 + 6);

      if (volando || reventado) {
        const paso = Math.max(1, Math.floor(38 / XS));
        ctx.lineWidth = 3;
        ctx.strokeStyle = "white";
        ctx.beginPath();

        let t = XBEG;
        let x = 0;
        let y = 0;
        for (; t < crecimiento; t += paso) {
          x = trX(t);
          y = trY(100 * Math.exp(RITMO * t));
          ctx.lineTo(x, y);
        }
        ctx.stroke();

        const y0 = trY(100);
        ctx.fillStyle = volando ? "#3f7cf0" : "#f11f5e";
        ctx.lineTo(x, y0);
        ctx.lineTo(trX(XBEG), y0);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(x, y, 13, 0, 2 * Math.PI);
        ctx.fill();
      } else {
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(0, 0, 13, 0, 2 * Math.PI);
        ctx.fill();
      }

      ctx.restore();
    },
  },
};
</script>
