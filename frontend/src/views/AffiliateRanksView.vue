<template>
  <div class="mb-ar">
    <router-link to="/affiliates" class="mb-ar__volver">‹ {{ $t('nav.affiliates') }}</router-link>

    <!-- ── El cartel ────────────────────────────────────────────── -->
    <section class="mb-arcartel">
      <div class="mb-rays mb-arcartel__rayos" aria-hidden="true"></div>
      <div class="mb-arcartel__texto">
        <span class="mb-arcartel__lab">{{ $t('affil.ranksKicker', { n: escalera.length }) }}</span>
        <h1>{{ $t('affil.programTitle', { pct: tope.houseEdgePct }) }}</h1>
        <p>
          {{ $t('affil.ranksSub', {
            name: piso.nombre,
            cpa: piso.cpaSc,
            rev: piso.revsharePct,
            edge: piso.houseEdgePct,
          }) }}
        </p>
      </div>
    </section>

    <!-- ── Las cuatro maneras de cobrar ─────────────────────────── -->
    <section class="mb-arcaja">
      <div class="mb-arin">
        <div class="mb-arcab">
          <h2>{{ $t('affil.fourWays') }}</h2>
          <span class="mb-tenue">{{ $t('affil.fourWaysSub') }}</span>
        </div>

        <div class="mb-armodelos">
          <article class="mb-armodelo is-cpa">
            <span class="mb-armodelo__lab">{{ $t('affil.mCpaLong') }}</span>
            <span class="mb-armodelo__num">
              SC {{ piso.cpaSc }} <span>→ SC {{ tope.cpaSc }}</span>
            </span>
            <p>{{ $t('affil.mCpaText') }}</p>
            <span class="mb-armodelo__pie">{{ $t('affil.mCpaFor') }}</span>
          </article>

          <article class="mb-armodelo is-revshare">
            <span class="mb-armodelo__lab">{{ $t('affil.mRevLong') }}</span>
            <span class="mb-armodelo__num">
              {{ piso.revsharePct }}% <span>→ {{ tope.revsharePct }}%</span>
            </span>
            <p>{{ $t('affil.mRevText') }}</p>
            <span class="mb-armodelo__pie">{{ $t('affil.mRevFor') }}</span>
          </article>

          <article class="mb-armodelo is-hibrido">
            <span class="mb-armodelo__lab">{{ $t('affil.mHybTitle') }}</span>
            <span class="mb-armodelo__num">
              SC {{ piso.hibridoCpaSc }} + {{ piso.hibridoPct }}%
            </span>
            <p>{{ $t('affil.mHybText') }}</p>
            <span class="mb-armodelo__pie">{{ $t('affil.mHybFor') }}</span>
          </article>

          <article class="mb-armodelo is-houseedge">
            <span class="mb-armodelo__lab">{{ $t('affil.mHouseTitle') }}</span>
            <span class="mb-armodelo__num">
              {{ piso.houseEdgePct }}% <span>→ {{ tope.houseEdgePct }}%</span>
            </span>
            <p>{{ $t('affil.mHouseText', { edge: houseEdge }) }}</p>
            <span class="mb-armodelo__pie">{{ $t('affil.mHouseFor') }}</span>
          </article>
        </div>

        <!-- La misma cuenta, con números -->
        <div class="mb-arcuenta">
          <span class="mb-alab">{{ $t('affil.diffTitle') }}</span>
          <p>{{ $t('affil.diff1', { played: '10.000', edge: houseEdge, margin: margen }) }}</p>
          <p>{{ $t('affil.diff2', { pct: piso.houseEdgePct, margin: margen, pays: conHouseEdge }) }}</p>
          <p>{{ $t('affil.diff3', { pct: piso.revsharePct }) }}</p>
        </div>
      </div>
    </section>

    <!-- ── La escalera ──────────────────────────────────────────── -->
    <section class="mb-arcaja">
      <div class="mb-arin">
        <div class="mb-arcab">
          <h2>{{ $t('affil.ladder') }}</h2>
          <span class="mb-tenue">{{ $t('affil.ladderSub') }}</span>
        </div>

        <div class="mb-artabla">
          <div class="mb-arfila mb-arfila--cab">
            <span>{{ $t('affil.rank') }}</span>
            <span class="mb-der">{{ $t('affil.mCpa') }}</span>
            <span class="mb-der">{{ $t('affil.mRev') }}</span>
            <span class="mb-der">{{ $t('affil.mHyb') }}</span>
            <span class="mb-der">{{ $t('affil.mHouse') }}</span>
            <span class="mb-der">{{ $t('affil.yourBonus') }}</span>
            <span>{{ $t('affil.whatAdds') }}</span>
          </div>

          <div
            v-for="r in escalera" :key="r.numero" class="mb-arfila"
            :class="{ 'is-mio': r.numero === mio }"
          >
            <span class="mb-arquien">
              <mb-gema :numero="r.numero" :lado="22" />
              <b>{{ r.numero }} · {{ r.nombre }}</b>
              <span v-if="r.numero === mio" class="mb-arsello">{{ $t('affil.youAreHere') }}</span>
            </span>

            <span class="mb-der mb-ambar">SC {{ r.cpaSc }}</span>
            <span class="mb-der mb-azul">{{ r.revsharePct }}%</span>
            <span class="mb-der mb-verde">SC {{ r.hibridoCpaSc }} + {{ r.hibridoPct }}%</span>
            <span class="mb-der mb-lila">{{ r.houseEdgePct }}%</span>
            <span class="mb-der">{{ r.bonoPct }}%</span>
            <span class="mb-tenue mb-arsuma">{{ queSuma(r) }}</span>
          </div>
        </div>

        <p class="mb-anota">{{ $t('affil.ranksNotAuto') }}</p>
      </div>
    </section>

    <!-- ── Pedir rango ──────────────────────────────────────────── -->
    <section class="mb-arcaja">
      <div class="mb-arin mb-arpedir">
        <span>
          <span class="mb-alab">{{ $t('affil.program') }}</span>
          <b>{{ $t('affil.askRankTitle') }}</b>
          <span class="mb-tenue">{{ $t('affil.askRankSub') }}</span>
        </span>

        <a class="mb-arpedir__b" :href="telegram" target="_blank" rel="noopener" @click="pedir">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M21.5 4.3 2.9 11.4c-.9.3-.9 1.6 0 2l4.6 1.5 1.8 5.6c.3.8 1.3 1 1.9.4l2.6-2.5 4.6 3.4c.7.5 1.6.1 1.8-.7l3-15c.2-.9-.7-1.6-1.7-1.3zM9.6 14.1l9-5.6-7.6 6.8-.3 3.3-1.1-4.5z" />
          </svg>
          {{ $t('affil.askRank') }}
        </a>
      </div>
    </section>
  </div>
</template>

<script>
import { mapGetters } from "vuex";
import api from "@/api";
import MbGema from "@/components/MbGema.vue";

/**
 * LOS RANGOS DE AFILIADO.
 *
 * La escalera entera, los cuatro modelos y la cuenta que explica la
 * diferencia entre cobrar del margen real y del margen teórico.
 *
 * TODO SALE DEL SERVIDOR
 *
 * Hasta los extremos del cartel --"hasta 65% del house edge"-- se leen
 * del último rango de la escalera. El equipo puede editarla desde el
 * panel, y esta pantalla no se tiene que tocar.
 *
 * SE PUEDE MIRAR SIN CUENTA
 *
 * Es una pantalla de venta: alguien que todavía no se registró tiene que
 * poder ver lo que se paga antes de abrirse una cuenta.
 */
export default {
  name: "AffiliateRanksView",

  components: { MbGema },

  data() {
    return { escalera: [], houseEdge: 8, telegram: "", mio: 0 };
  },

  computed: {
    ...mapGetters(["entro"]),

    piso() {
      return this.escalera[0] || {
        nombre: "—", cpaSc: 15, revsharePct: 35, hibridoCpaSc: 10, hibridoPct: 30,
        houseEdgePct: 50, bonoPct: 5, minimoCobroSc: 50, pago: "pedido",
      };
    },

    tope() {
      return this.escalera[this.escalera.length - 1] || this.piso;
    },

    /* La cuenta del ejemplo: SC 10.000 jugados por el house edge. */
    margen() {
      return this.num(10000 * (this.houseEdge / 100));
    },

    conHouseEdge() {
      return this.num(10000 * (this.houseEdge / 100) * (this.piso.houseEdgePct / 100));
    },
  },

  methods: {
    num(n) { return Number(n || 0).toLocaleString("en-US"); },

    /**
     * QUE SUMA ESE RANGO, LEIDO DE SUS PROPIOS NUMEROS.
     *
     * Y no una frase escrita a mano por rango: la escalera se edita
     * desde el panel, así que una frase fija quedaría mintiendo el día
     * que alguien cambie un número.
     */
    queSuma(r) {
      const partes = [];
      const antes = this.escalera[r.numero - 2];

      if (!antes) partes.push(this.$t("affil.addsStart"));
      else if (r.bonoPct > antes.bonoPct) {
        partes.push(this.$t("affil.addsBonus", { pct: r.bonoPct }));
      }

      if (r.pago === "semanal" && (!antes || antes.pago !== "semanal")) {
        partes.push(this.$t("affil.addsWeekly"));
      }
      if (r.pago === "pedido" && antes && antes.pago === "semanal") {
        partes.push(this.$t("affil.addsOnRequest"));
      }

      if (!r.minimoCobroSc && antes && antes.minimoCobroSc) {
        partes.push(this.$t("affil.addsNoMin"));
      } else if (antes && r.minimoCobroSc < antes.minimoCobroSc) {
        partes.push(this.$t("affil.addsLowerMin", { min: r.minimoCobroSc }));
      }

      if (!partes.length) partes.push(this.$t("affil.addsMore"));
      return partes.join(" · ");
    },

    async pedir() {
      if (!this.entro) return;
      try {
        await api.post("/affiliates/rank/request");
        this.$store.dispatch("avisar", { texto: this.$t("affil.asked") });
      } catch (err) {
        /* Ya pidió esta semana: no hace falta decirle nada. */
      }
    },

    async traer() {
      try {
        const { data } = await api.get("/affiliates/ranks");
        this.escalera = data.data.escalera;
        this.houseEdge = data.data.houseEdgePct;
        this.telegram = data.data.telegram;
        this.mio = data.data.mio || 0;
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      }
    },
  },

  watch: {
    entro() { this.traer(); },
  },

  created() { this.traer(); },
};
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

.mb-ar { display: flex; flex-direction: column; gap: 20px; }

.mb-ar__volver { align-self: flex-start; font-weight: 800; font-size: 13px; text-decoration: none; color: $texto-4; &:hover { color: #fff; } }

/* ── El cartel ────────────────────────────────────────────────────── */

.mb-arcartel {
  position: relative;
  overflow: hidden;
  border-radius: 22px;
  min-height: 220px;
  background:
    radial-gradient(circle at 80% 45%, rgba(255, 200, 61, .5) 0%, rgba(255, 200, 61, 0) 38%),
    linear-gradient(115deg, #15215e 0%, #2b2f8e 42%, #6b3fd6 72%, #a86bff 100%);
  display: flex;
  align-items: center;
}

.mb-arcartel__rayos {
  position: absolute;
  left: 76%;
  top: 50%;
  width: 1100px;
  height: 1100px;
  margin: -550px 0 0 -550px;
  background: repeating-conic-gradient(from 0deg, rgba(255, 255, 255, .08) 0deg 6deg, rgba(255, 255, 255, 0) 6deg 18deg);
}

.mb-arcartel__texto {
  position: relative;
  padding: 30px 36px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: min(700px, 100%);

  h1 {
    margin: 0;
    font-family: $fuente-cartel;
    font-weight: 400;
    font-size: clamp(26px, 4vw, 42px);
    line-height: 1.04;
    text-shadow: 0 3px 0 rgba(6, 20, 58, .55);
  }

  p { margin: 0; font-weight: 700; font-size: 16px; line-height: 1.45; color: #eef4ff; }

  @include en-celular { padding: 22px 18px; }
}

.mb-arcartel__lab { font-weight: 900; font-size: 11px; letter-spacing: .12em; color: #e6d6ff; }

/* ── Las cajas ────────────────────────────────────────────────────── */

.mb-arcaja { border-radius: 22px; background: #12233d; padding: 14px; box-sizing: border-box; }

.mb-arin {
  border-radius: 16px;
  background: #0b1729;
  padding: 22px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;

  @include en-celular { padding: 16px 16px 20px; }
}

.mb-arcab {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 10px;
  h2 { margin: 0; font-family: $fuente-cartel; font-weight: 400; font-size: 22px; }
  span { font-weight: 700; font-size: 14px; }
}

/* ── Los cuatro modelos ───────────────────────────────────────────── */

.mb-armodelos {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr));
  gap: 14px;
}

.mb-armodelo {
  padding: 18px;
  border-radius: 16px;
  background: $panel;
  display: flex;
  flex-direction: column;
  gap: 10px;

  p { margin: 0; font-weight: 700; font-size: 13px; line-height: 1.55; color: $texto-2; }

  &.is-cpa { border: 1px solid rgba(255, 200, 61, .5); .mb-armodelo__lab, .mb-armodelo__num { color: $amarillo-v; } }
  &.is-revshare { border: 1px solid rgba(63, 155, 255, .5); .mb-armodelo__lab, .mb-armodelo__num { color: #3f9bff; } }
  &.is-hibrido { border: 1px solid rgba(93, 255, 176, .5); .mb-armodelo__lab, .mb-armodelo__num { color: $verde; } }
  &.is-houseedge { border: 1px solid rgba(167, 139, 250, .6); .mb-armodelo__lab, .mb-armodelo__num { color: #c4b5fd; } }
}

.mb-armodelo__lab { font-weight: 900; font-size: 11px; letter-spacing: .12em; }

.mb-armodelo__num {
  font-family: $fuente-cartel;
  font-weight: 400;
  font-size: 26px;
  line-height: 1.1;
  span { font-family: $fuente; font-weight: 800; font-size: 15px; color: $texto-4; }
}

.mb-armodelo__pie { margin-top: auto; font-weight: 700; font-size: 12px; color: $texto-4; }

.mb-arcuenta {
  padding: 16px 18px;
  border-radius: 14px;
  background: #12233d;
  display: flex;
  flex-direction: column;
  gap: 8px;

  p { margin: 0; font-weight: 700; font-size: 14px; line-height: 1.6; color: $texto-2; }
}

/* ── La escalera ──────────────────────────────────────────────────── */

.mb-artabla { border-radius: 14px; background: $panel; overflow: hidden; }

.mb-arfila {
  display: grid;
  grid-template-columns: 1.5fr .8fr .8fr 1.2fr .9fr .9fr 1.6fr;
  gap: 10px;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #16243d;
  font-weight: 700;
  font-size: 14px;

  &:last-child { border-bottom: 0; }
  &.is-mio { background: rgba(255, 200, 61, .06); }

  &--cab {
    font-weight: 900;
    font-size: 11px;
    letter-spacing: .1em;
    color: $texto-4;
    text-transform: uppercase;
  }

  @include en-celular {
    grid-template-columns: 1fr 1fr;
    row-gap: 6px;
    &--cab { display: none; }
  }
}

.mb-arquien {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  b { font-weight: 900; font-size: 14px; }
  @include en-celular { grid-column: 1 / -1; }
}

.mb-arsello {
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(255, 200, 61, .16);
  color: $amarillo-v;
  font-size: 10px;
  font-weight: 900;
}

.mb-arsuma { white-space: normal; font-weight: 700; font-size: 13px; @include en-celular { grid-column: 1 / -1; } }

/* ── Pedir rango ──────────────────────────────────────────────────── */

.mb-arpedir {
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;

  > span { display: flex; flex-direction: column; gap: 6px; }
  b { font-family: $fuente-cartel; font-weight: 400; font-size: 24px; }
  > span > span:last-child { font-weight: 700; font-size: 14px; }
}

.mb-arpedir__b {
  flex: none;
  height: 46px;
  padding: 0 24px;
  border-radius: 23px;
  border: 3px solid #fff;
  background: linear-gradient(180deg, #45b6ff, #1d8fe0);
  color: #fff;
  font-weight: 900;
  font-size: 15px;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, .35);
  @include foco;
  &:hover { filter: brightness(1.06); color: #fff; }
}

/* ── Los colores ──────────────────────────────────────────────────── */

.mb-alab { font-weight: 900; font-size: 11px; letter-spacing: .12em; color: $texto-4; }
.mb-anota { margin: 0; font-weight: 700; font-size: 13px; color: $texto-4; }
.mb-der { text-align: right; font-variant-numeric: tabular-nums; @include en-celular { text-align: left; } }
.mb-tenue { color: $texto-4; }
.mb-verde { color: $verde; }
.mb-ambar { color: $amarillo-v; }
.mb-azul { color: #3f9bff; }
.mb-lila { color: #c4b5fd; }
</style>
