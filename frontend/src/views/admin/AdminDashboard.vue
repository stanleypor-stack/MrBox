<template>
  <div v-if="d" class="adp">
    <!-- ── Título y período ─────────────────────────────────────── -->
    <div class="adp__cabeza">
      <div class="adp__titulo">
        <h1>{{ $t('admin.nav.dashboard') }}</h1>
        <span class="ad-tenue">{{ $t('admin.dash.lastSync', { seg: hace }) }}</span>
      </div>

      <MbElegir v-model="dias" :opciones="periodos" chico class="ad-elegir" @elegida="traer" />
    </div>

    <!-- ── Las tres grandes ─────────────────────────────────────── -->
    <div class="adp__grandes">
      <div class="adp__grande">
        <span>{{ $t('admin.dash.deposits') }}</span>
        <strong>SC {{ plata(d.compradoSc) }}</strong>
        <span class="ad-tenue">{{ $t('admin.dash.purchases', { n: num(d.aperturas ? d.compras || 0 : 0) }) }}</span>
      </div>
      <div class="adp__grande">
        <span>{{ $t('admin.dash.paidOut') }}</span>
        <strong>SC {{ plata(d.canjeadoSc + d.devueltoSc) }}</strong>
        <span class="ad-tenue">{{ $t('admin.dash.paidOutSub') }}</span>
      </div>
      <div class="adp__grande">
        <span>{{ $t('admin.dash.revenue') }}</span>
        <strong :class="d.margenSc >= 0 ? 'ad-verde' : 'ad-rojo'">SC {{ plata(d.margenSc) }}</strong>
        <span :class="d.margenSc >= 0 ? 'ad-verde' : 'ad-rojo'">{{ d.margenPct }}% {{ $t('admin.dash.ofPlayed') }}</span>
      </div>
    </div>

    <!-- ── Los otros números ────────────────────────────────────── -->
    <div class="adp__kpis">
      <div v-for="k in kpis" :key="k.rotulo" class="adp__kpi">
        <span>{{ k.rotulo }}</span>
        <strong>{{ k.valor }}</strong>
        <span class="ad-tenue">{{ k.nota }}</span>
      </div>
    </div>

    <!-- ── El gráfico y las colas ───────────────────────────────── -->
    <div class="adp__dos">
      <section class="adp__grafico">
        <h2>{{ $t('admin.dash.playedPerDay', { n: d.dias }) }}</h2>

        <div
          v-if="d.serie.length" class="adp__barras" role="img"
          :aria-label="$t('admin.dash.chartAria', { n: d.dias })"
        >
          <div v-for="s in d.serie" :key="s.dia" class="adp__barra">
            <span class="adp__v">{{ corto(s.jugadoSc) }}</span>
            <div :style="{ height: alto(s.jugadoSc) }"></div>
          </div>
        </div>
        <p v-else class="ad-tenue">{{ $t('admin.dash.noPlay') }}</p>

        <div v-if="d.serie.length" class="adp__fechas">
          <span v-for="s in d.serie" :key="s.dia">{{ s.dia.slice(8) }}</span>
        </div>
      </section>

      <div class="adp__lado">
        <section class="adp__caja">
          <h2>{{ $t('admin.dash.needsReview') }}</h2>

          <router-link
            v-for="c in colas" :key="c.a" :to="c.a" class="adp__cola"
          >
            <span class="adp__cola-ico">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#9fc0ff"
                   stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path :d="c.icono" />
              </svg>
            </span>
            <span class="adp__cola-t">
              <strong>{{ c.titulo }}</strong>
              <span class="ad-tenue">{{ c.detalle }}</span>
            </span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8ea3c7" stroke-width="2.4"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
          </router-link>
        </section>

        <section class="adp__caja">
          <h2>{{ $t('admin.dash.topBoxes') }}</h2>

          <div v-for="t in d.top" :key="t.name" class="adp__top">
            <div class="adp__top-t">
              <span>{{ t.name }}</span>
              <strong>SC {{ plata(t.jugadoSc) }}</strong>
            </div>
            <div class="adp__top-barra"><div :style="{ width: anchoTop(t.jugadoSc) }"></div></div>
          </div>

          <p v-if="!d.top.length" class="ad-tenue">{{ $t('admin.dash.noPlay') }}</p>
        </section>

        <!-- La resta del margen, para poder revisarla. -->
        <section class="adp__caja">
          <h2>{{ $t('admin.dash.marginTitle') }}</h2>
          <p class="ad-tenue adp__p">{{ $t('admin.dash.marginHelp') }}</p>
          <div class="adp__cuenta">
            <span>{{ $t('admin.dash.played') }}<b>SC {{ plata(d.jugadoSc) }}</b></span>
            <span>− {{ $t('admin.dash.soldBack') }}<b>SC {{ plata(d.devueltoSc) }}</b></span>
            <span>− {{ $t('admin.dash.givenBack') }}<b>SC {{ plata(d.regaladoSc) }}</b></span>
            <span class="adp__total">= {{ $t('admin.dash.margin') }}<b :class="d.margenSc >= 0 ? 'ad-verde' : 'ad-rojo'">SC {{ plata(d.margenSc) }}</b></span>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script>
import MbElegir from "@/components/MbElegir.vue";
import api from "@/api";

/**
 * EL TABLERO.
 *
 * El del diseño: las tres grandes arriba, los otros números, y abajo
 * el gráfico a la izquierda con las colas y las cajas top a la
 * derecha.
 *
 * TODO SALE DEL LIBRO
 *
 * Ninguno de estos números viene de un contador: salen de sumar las
 * transacciones. Si uno no coincide con el libro, el que está mal es
 * el número, y eso se puede revisar. Un contador no.
 *
 * Y el margen va con su RESTA al costado: "SC 4.812" no se puede
 * revisar; "jugado, menos lo que volvió en ventas, menos lo que se
 * repartió" sí.
 */
export default {
  name: "AdminDashboard",

  components: { MbElegir },

  data() { return { d: null, dias: 14, traidoEl: Date.now(), hace: 0, reloj: null }; },

  computed: {
    periodos() {
      return [7, 14, 30, 90].map((n) => ({ valor: n, texto: this.$t("admin.dash.days", { n }) }));
    },

    kpis() {
      const d = this.d;
      if (!d) return [];
      return [
        { rotulo: this.$t("admin.dash.played"), valor: "SC " + this.plata(d.jugadoSc), nota: this.$t("admin.dash.opens", { n: this.num(d.aperturas + d.deals) }) },
        { rotulo: this.$t("admin.dash.players"), valor: this.num(d.jugadores), nota: "+" + this.num(d.nuevos) + " " + this.$t("admin.dash.newOnes") },
        { rotulo: this.$t("admin.dash.liveBoxes"), valor: this.num(d.cajasVivas), nota: "" },
        { rotulo: this.$t("admin.dash.redeemed"), valor: "SC " + this.plata(d.canjeadoSc), nota: "" },
        { rotulo: this.$t("admin.dash.givenBack"), valor: "SC " + this.plata(d.regaladoSc), nota: this.$t("admin.dash.givenBackSub") },
      ];
    },

    /** Las tres colas que esperan a una persona. */
    colas() {
      const p = (this.d && this.d.pendientes) || {};
      return [
        {
          a: "/admin/orders",
          titulo: this.$t("admin.nav.orders"),
          detalle: this.$tc("admin.dash.ordersWaiting", p.pedidos || 0, { n: p.pedidos || 0 }),
          icono: "M1 5h14v11H1zM15 9h4l4 4v3h-8z",
        },
        {
          a: "/admin/verification",
          titulo: this.$t("admin.nav.verification"),
          detalle: this.$tc("admin.dash.kycWaiting", p.verificaciones || 0, { n: p.verificaciones || 0 }),
          icono: "M3 5h18v14H3zM7 10h4M7 14h6M15 9h3v4h-3z",
        },
        {
          a: "/admin/community",
          titulo: this.$t("admin.nav.community"),
          detalle: this.$tc("admin.dash.boxesWaiting", p.cajasDeComunidad || 0, { n: p.cajasDeComunidad || 0 }),
          icono: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a6 6 0 0 1 12 0M19 8v6M16 11h6",
        },
        {
          a: "/admin/support",
          titulo: this.$t("admin.nav.support"),
          detalle: this.$tc("admin.dash.threadsWaiting", p.soporte || 0, { n: p.soporte || 0 }),
          icono: "M4 5h16v11H9l-5 4z",
        },
      ];
    },

    techo() {
      if (!this.d || !this.d.serie.length) return 1;
      return Math.max(1, ...this.d.serie.map((s) => s.jugadoSc));
    },

    techoTop() {
      if (!this.d || !this.d.top.length) return 1;
      return Math.max(1, ...this.d.top.map((t) => t.jugadoSc));
    },
  },

  methods: {
    plata(n) {
      return Number(n || 0).toLocaleString("en-US", {
        minimumFractionDigits: 2, maximumFractionDigits: 2,
      });
    },
    num(n) { return Number(n || 0).toLocaleString("en-US"); },

    /* Arriba de cada barra entra "12.4K", no "12,418.60". */
    corto(n) {
      const v = Number(n || 0);
      if (v >= 1000) return (v / 1000).toFixed(1) + "K";
      return v.toFixed(0);
    },

    alto(v) { return Math.max(2, (v / this.techo) * 100) + "%"; },
    anchoTop(v) { return Math.max(4, (v / this.techoTop) * 100) + "%"; },

    async traer() {
      try {
        const { data } = await api.get("/admin/dashboard", { params: { days: this.dias } });
        this.d = data.data;
        this.traidoEl = Date.now();
        this.hace = 0;
        /* El menú muestra estos números al lado de cada sección: es lo
           que hace que alguien entre a mirarlas. */
        this.$emit("pendientes", {
          orders: this.d.pendientes.pedidos,
          verification: this.d.pendientes.verificaciones,
          community: this.d.pendientes.cajasDeComunidad,
          support: this.d.pendientes.soporte,
        });
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      }
    },
  },

  created() {
    this.traer();
    this.reloj = window.setInterval(() => {
      this.hace = Math.round((Date.now() - this.traidoEl) / 1000);
    }, 1000);
  },

  beforeDestroy() { window.clearInterval(this.reloj); },
};
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

.adp { display: flex; flex-direction: column; gap: 20px; }

.adp__cabeza { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
.adp__titulo { flex: 1 1 280px; display: flex; flex-direction: column; gap: 4px; h1 { margin: 0; font-weight: 900; font-size: 26px; } }

.adp__grandes { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(240px, 100%), 1fr)); gap: 16px; }

.adp__grande {
  padding: 20px;
  border-radius: 16px;
  background: $panel-alto;
  border: 1px solid $borde;
  display: flex;
  flex-direction: column;
  gap: 6px;

  > span:first-child { font-weight: 700; color: $texto-3; }
  strong { font-weight: 900; font-size: 30px; font-variant-numeric: tabular-nums; }
}

.adp__kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(200px, 100%), 1fr)); gap: 16px; }

.adp__kpi {
  padding: 16px 18px;
  border-radius: 14px;
  background: $panel;
  border: 1px solid $borde;
  display: flex;
  flex-direction: column;
  gap: 4px;

  > span:first-child { font-weight: 700; font-size: 13px; color: $texto-3; }
  strong { font-weight: 900; font-size: 22px; font-variant-numeric: tabular-nums; }
}

.adp__dos { display: flex; flex-wrap: wrap; gap: 20px; align-items: flex-start; }

.adp__grafico {
  flex: 3 1 520px;
  min-width: 0;
  padding: 22px;
  border-radius: 16px;
  background: $panel-alto;
  border: 1px solid $borde;
  display: flex;
  flex-direction: column;
  gap: 18px;

  h2 { margin: 0; font-weight: 900; font-size: 18px; }
}

.adp__barras {
  height: 260px;
  display: flex;
  align-items: flex-end;
  gap: 10px;
  padding-top: 8px;
  border-bottom: 1px solid #2a4170;
}

.adp__barra {
  flex: 1;
  min-width: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: center;
  gap: 6px;

  div { width: 100%; border-radius: 6px 6px 0 0; background: $azul; }
}

.adp__v { font-size: 11px; font-weight: 700; color: $texto-3; }
.adp__fechas { display: flex; gap: 10px; span { flex: 1; text-align: center; font-size: 11px; color: $texto-4; } }

.adp__lado { flex: 2 1 320px; min-width: 0; display: flex; flex-direction: column; gap: 20px; }

.adp__caja {
  padding: 18px;
  border-radius: 16px;
  background: $panel-alto;
  border: 1px solid $borde;
  display: flex;
  flex-direction: column;
  gap: 10px;

  h2 { margin: 0 0 4px; font-weight: 900; font-size: 18px; }
}

.adp__p { margin: 0; font-size: 13px; line-height: 1.5; }

.adp__cola {
  min-height: 56px;
  padding: 8px 12px;
  border-radius: 12px;
  background: $panel;
  color: #fff;
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: 12px;
  @include foco;
  &:hover { background: $panel-hover; color: #fff; }
}

.adp__cola-ico {
  width: 36px;
  height: 36px;
  flex: none;
  border-radius: 10px;
  background: #1d3354;
  display: flex;
  align-items: center;
  justify-content: center;
}

.adp__cola-t { flex: 1; display: flex; flex-direction: column; gap: 2px; strong { font-weight: 800; font-size: 14px; } span { font-size: 13px; } }

.adp__top { display: flex; flex-direction: column; gap: 5px; }
.adp__top-t { display: flex; justify-content: space-between; gap: 8px; font-weight: 700; font-size: 14px; }
.adp__top-barra { height: 6px; border-radius: 3px; background: $panel; div { height: 100%; border-radius: 3px; background: $azul; } }

.adp__cuenta {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 13px;
  color: $texto-4;

  span { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
  b { font-size: 15px; color: #fff; font-variant-numeric: tabular-nums; }
}

.adp__total { padding-top: 8px; border-top: 1px solid $borde; }

.ad-tenue { color: $texto-4; }
</style>
