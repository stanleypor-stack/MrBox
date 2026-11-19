<template>
  <div v-if="filas.length" class="ade">
    <router-link to="/admin/affiliates" class="ade__volver">‹ {{ $t('admin.nav.affiliates') }}</router-link>

    <div class="ade__cabeza">
      <div class="ade__quien">
        <h1>{{ $t('admin.afi.ladder') }}</h1>
        <span class="ade__que">{{ $t('admin.afi.ladderHelp', { pct: reglas.houseEdgePct }) }}</span>
      </div>

      <button type="button" class="ad-b ad-b--grande" :disabled="!hayCambios || guardando" @click="guardar">
        {{ guardando ? $t('admin.loading') : $t('admin.save') }}
      </button>
    </div>

    <p class="ad-aviso">{{ $t('admin.afi.ladderWarn') }}</p>

    <!-- ── La escalera ──────────────────────────────────────────── -->
    <div class="ad-t">
      <div class="ad-t__scroll">
        <div class="ad-t__ancho ade__ancho">
          <div class="ad-t__cab ade__fila">
            <span>{{ $t('admin.afi.rank') }}</span>
            <span class="ad-der">{{ $t('admin.afi.m_cpa') }}</span>
            <span class="ad-der">{{ $t('admin.afi.m_revshare') }}</span>
            <span class="ad-der">{{ $t('admin.afi.hybCpa') }}</span>
            <span class="ad-der">{{ $t('admin.afi.hybPct') }}</span>
            <span class="ad-der">{{ $t('admin.afi.m_houseedge') }}</span>
            <span class="ad-der">{{ $t('admin.afi.playerBonus') }}</span>
            <span class="ad-der">{{ $t('admin.afi.minClaim') }}</span>
            <span>{{ $t('admin.afi.payout') }}</span>
            <span class="ad-der">{{ $t('admin.afi.costs') }}</span>
          </div>

          <div v-for="(f, i) in filas" :key="i" class="ad-t__fila ade__fila">
            <span class="ade__quien-rango">
              <mb-gema :numero="i + 1" :lado="26" />
              <input v-model="f.nombre" class="ad-in ade__in ade__in--nombre" maxlength="30">
            </span>

            <span class="ad-der"><input v-model="f.cpaSc" class="ad-in ade__in" inputmode="decimal"></span>
            <span class="ad-der"><input v-model="f.revsharePct" class="ad-in ade__in" inputmode="decimal"></span>
            <span class="ad-der"><input v-model="f.hibridoCpaSc" class="ad-in ade__in" inputmode="decimal"></span>
            <span class="ad-der"><input v-model="f.hibridoPct" class="ad-in ade__in" inputmode="decimal"></span>
            <span class="ad-der"><input v-model="f.houseEdgePct" class="ad-in ade__in" inputmode="decimal"></span>
            <span class="ad-der"><input v-model="f.bonoPct" class="ad-in ade__in" inputmode="decimal"></span>
            <span class="ad-der"><input v-model="f.minimoCobroSc" class="ad-in ade__in" inputmode="decimal"></span>

            <span><mb-elegir v-model="f.pago" class="ad-elegir" :opciones="pagos" chico /></span>

            <!--
              LO QUE CUESTA ESE RANGO, EN PESOS.

              Sobre SC 10.000 jugados: cuánto se lleva el socio con cada
              modelo y cuánto queda. Subir un revshare del 39% al 45% es
              una corazonada sin esta columna.
            -->
            <span class="ad-der ade__cuesta">
              <em>{{ $t('admin.afi.perTenK') }}</em>
              <b :class="cuesta(f) > margen ? 'ad-rojo' : ''">SC {{ plata(cuesta(f)) }}</b>
              <em>{{ $t('admin.afi.ofMargin', { pct: pct(cuesta(f) / margen * 100) }) }}</em>
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Las reglas del pago por cabeza ───────────────────────── -->
    <section class="ad-caja">
      <h2>{{ $t('admin.afi.cpaRules') }}</h2>
      <p>{{ $t('admin.afi.cpaRulesHelp') }}</p>

      <div class="ade__reglas">
        <label class="ad-campo">
          {{ $t('admin.afi.needsDeposit') }}
          <input v-model="reglas.cpaDepositoSc" class="ad-in" inputmode="decimal">
        </label>
        <label class="ad-campo">
          {{ $t('admin.afi.needsPlay') }}
          <input v-model="reglas.cpaJugadoSc" class="ad-in" inputmode="decimal">
        </label>
        <label class="ad-campo">
          {{ $t('admin.afi.needsKyc') }}
          <input v-model="reglas.cpaNivelKyc" class="ad-in" inputmode="numeric">
        </label>
        <label class="ad-campo">
          {{ $t('admin.afi.waitDays') }}
          <input v-model="reglas.cpaEsperaDias" class="ad-in" inputmode="numeric">
        </label>
        <label class="ad-campo">
          {{ $t('admin.afi.dailyCap') }}
          <input v-model="reglas.cpaTopeDiario" class="ad-in" inputmode="numeric">
        </label>
        <label class="ad-campo">
          {{ $t('admin.afi.telegram') }}
          <input v-model="reglas.telegram" class="ad-in" maxlength="200">
        </label>
      </div>

      <h2 class="ade__h2">{{ $t('admin.afi.openModels') }}</h2>
      <p>{{ $t('admin.afi.openModelsHelp') }}</p>

      <div class="ade__modelos">
        <label v-for="m in modelos" :key="m" class="ade__chk">
          <input v-model="reglas.modelos" type="checkbox" :value="m">
          {{ $t('admin.afi.m_' + m) }}
        </label>
      </div>
    </section>

    <!-- ── El motivo ────────────────────────────────────────────── -->
    <section class="ad-caja">
      <label class="ad-campo">
        {{ $t('admin.reason') }}
        <input v-model="motivo" class="ad-in" maxlength="300" :placeholder="$t('admin.afi.whyLadder')">
      </label>
    </section>
  </div>
</template>

<script>
import api from "@/api";
import MbGema from "@/components/MbGema.vue";
import MbElegir from "@/components/MbElegir.vue";

/**
 * LA ESCALERA DE AFILIADOS.
 *
 * Los rangos con sus cuatro modelos, y las reglas del pago por cabeza.
 * Se edita entera y se guarda de una: los valores se miran entre ellos
 * --un rango no puede pagar menos que el anterior-- y guardarlos de a
 * uno deja estados imposibles en el medio.
 *
 * AL LADO DE LO QUE SE EDITA, LO QUE CUESTA
 *
 * La última columna dice, en pesos, lo que se lleva el socio con el
 * modelo más caro de ese rango sobre SC 10.000 jugados, y qué parte del
 * margen es. Con eso, subir un número es una decisión; sin eso, es una
 * corazonada que se paga a fin de mes.
 */
export default {
  name: "AdminEscalera",

  components: { MbGema, MbElegir },

  data() {
    return {
      filas: [],
      reglas: { houseEdgePct: 8, modelos: [] },
      original: "",
      motivo: "",
      guardando: false,
      modelos: ["cpa", "revshare", "hibrido", "houseedge"],
    };
  },

  computed: {
    hayCambios() {
      return JSON.stringify({ f: this.filas, r: this.reglas }) !== this.original;
    },

    /* El margen teórico de SC 10.000 jugados, para la columna de costo. */
    margen() {
      return 10000 * ((Number(this.reglas.houseEdgePct) || 8) / 100);
    },

    pagos() {
      return [
        { valor: "pedido", texto: this.$t("admin.afi.onRequest") },
        { valor: "semanal", texto: this.$t("admin.afi.weekly") },
        { valor: "mensual", texto: this.$t("admin.afi.monthly") },
      ];
    },
  },

  methods: {
    num(n) { return Number(n || 0).toLocaleString("en-US"); },
    plata(n) {
      return Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },
    pct(n) { return `${Math.round((Number(n) || 0) * 10) / 10}%`; },

    /**
     * LO QUE SE LLEVA EL SOCIO DE SC 10.000 JUGADOS.
     *
     * El más caro de los tres modelos que cobran por jugada, que es el
     * que de verdad hay que mirar: el socio elige el que más le
     * conviene, no el promedio.
     */
    cuesta(f) {
      const margen = this.margen;
      const porComision = margen * ((Number(f.revsharePct) || 0) / 100);
      const porHouseEdge = margen * ((Number(f.houseEdgePct) || 0) / 100);
      const porHibrido = margen * ((Number(f.hibridoPct) || 0) / 100);
      return Math.max(porComision, porHouseEdge, porHibrido);
    },

    async traer() {
      try {
        const { data } = await api.get("/admin/affiliates/ladder");
        this.filas = data.data.escalera.map((r) => ({ ...r }));
        this.reglas = { ...data.data.reglas, modelos: [...data.data.reglas.modelos] };
        this.original = JSON.stringify({ f: this.filas, r: this.reglas });
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      }
    },

    async guardar() {
      if (this.motivo.trim().length < 3) {
        this.$store.dispatch("avisar", { texto: this.$t("admin.needReason"), tono: "error" });
        return;
      }

      this.guardando = true;
      try {
        await api.put("/admin/affiliates/ladder", {
          escalera: this.filas.map((f) => ({
            nombre: f.nombre,
            cpaSc: Number(f.cpaSc) || 0,
            revsharePct: Number(f.revsharePct) || 0,
            hibridoCpaSc: Number(f.hibridoCpaSc) || 0,
            hibridoPct: Number(f.hibridoPct) || 0,
            houseEdgePct: Number(f.houseEdgePct) || 0,
            bonoPct: Number(f.bonoPct) || 0,
            minimoCobroSc: Number(f.minimoCobroSc) || 0,
            pago: f.pago,
          })),
          reglas: this.reglas,
          motivo: this.motivo,
        });
        this.$store.dispatch("avisar", { texto: this.$t("admin.done") });
        await this.traer();
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      } finally {
        this.guardando = false;
      }
    },
  },

  created() { this.traer(); },
};
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

.ade { display: flex; flex-direction: column; gap: 20px; }
.ade__volver { align-self: flex-start; font-weight: 800; font-size: 13px; text-decoration: none; color: $texto-4; &:hover { color: #fff; } }

.ade__cabeza { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
.ade__quien { flex: 1 1 320px; display: flex; flex-direction: column; gap: 4px; }
.ade__quien h1 { margin: 0; font-weight: 900; font-size: 26px; }
.ade__que { max-width: 720px; font-size: 14px; line-height: 1.5; color: $texto-3; }

.ade__ancho { min-width: 1280px; }
.ade__fila { grid-template-columns: 1.5fr .8fr .8fr .8fr .8fr .9fr .9fr .9fr 1.1fr 1.3fr; }

.ade__quien-rango { display: flex; align-items: center; gap: 8px; }
.ade__in { width: 100%; height: 34px; box-sizing: border-box; font-size: 13px; text-align: right; }
.ade__in--nombre { text-align: left; }

.ade__cuesta {
  display: flex;
  flex-direction: column;
  gap: 1px;
  em { font-style: normal; font-size: 10px; color: $texto-4; }
  b { font-weight: 900; font-size: 14px; }
}

.ade__reglas { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr)); gap: 12px; }
.ade__h2 { margin-top: 10px; }
.ade__modelos { display: flex; flex-wrap: wrap; gap: 14px; }

.ade__chk {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  font-size: 14px;
  color: $texto-2;
  input { width: 18px; height: 18px; }
}
</style>
