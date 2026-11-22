<template>
  <div class="mb-premios-p">
    <p v-if="!entro" class="mb-vacio">{{ $t('error.NOT_LOGGED_IN') }}</p>

    <template v-else-if="datos">
      <!-- ── El cartel ────────────────────────────────────────────── -->
      <section class="mb-rcartel">
        <span class="mb-rcartel__gema" aria-hidden="true"><span></span></span>

        <div class="mb-rcartel__texto">
          <h1>{{ $t('nav.rewards') }}</h1>
          <p>{{ $t('rewards.sub') }}</p>

          <div class="mb-rcartel__rot">
            <span>{{ $t('rewards.progressTo', { rango: datos.rango.siguiente || datos.rango.nombre }) }}</span>
            <span>{{ datos.rango.progreso }}%</span>
          </div>
          <div class="mb-rcartel__barra"><div :style="{ width: datos.rango.progreso + '%' }"></div></div>
        </div>
      </section>

      <!-- ── Los tres botones ─────────────────────────────────────── -->
      <section class="mb-boost">
        <h2>{{ $t('rewards.playBoost') }}</h2>
        <p class="mb-ayuda">{{ $t('rewards.boostHelp', { pct: (datos.rango.rakeback.monthly * 100).toFixed(2) }) }}</p>

        <div class="mb-boost__grilla">
          <article
            v-for="c in datos.cajas" :key="c.periodo"
            class="mb-boost__caja" :class="{ 'is-lista': c.sePuedeCobrar }"
          >
            <span class="mb-sc mb-sc--32 mb-float" aria-hidden="true">SC</span>
            <span class="mb-boost__rot">{{ $t('rewards.' + c.periodo) }}</span>
            <span class="mb-boost__monto">
              <span class="mb-sc mb-sc--20" aria-hidden="true">SC</span>{{ plata(c.montoSc) }}
            </span>
            <span class="mb-boost__base">
              {{ $t('rewards.fromPlay', { amount: plata(c.jugadoSc), pct: (c.pct * 100).toFixed(2) }) }}
            </span>

            <button
              v-if="c.sePuedeCobrar" type="button" :disabled="cobrando === c.periodo"
              class="mb-boost__b" @click="cobrar(c.periodo)"
            >{{ cobrando === c.periodo ? $t('common.loading') : $t('rewards.claim') }}</button>

            <span v-else-if="c.yaCobrado" class="mb-boost__estado">{{ $t('rewards.claimed') }}</span>

            <span v-else-if="!c.pct" class="mb-boost__estado">
              {{ $t('rewards.lockedUntil') }}
            </span>

            <span v-else class="mb-boost__estado">{{ $t('rewards.keepPlaying') }}</span>
          </article>
        </div>
      </section>

      <!--
        ── Las cajas del club ─────────────────────────────────────

        Se piden, no caen solas. Es lo mismo que hace el rakeback de
        arriba, y por el mismo motivo: un reloj que reparta cajas cada
        semana y cada mes es una cosa mas que se puede caer una noche
        sin que nadie se entere. Acá el jugador ve lo que le toca y lo
        agarra.
      -->
      <section v-if="club" class="mb-boost">
        <h2>{{ $t('rewards.clubBoxes') }}</h2>
        <p class="mb-ayuda">
          {{ club.compro ? $t('rewards.clubHelp') : $t('rewards.clubNeedBuy') }}
        </p>

        <div class="mb-boost__grilla">
          <article
            v-for="b in cajasDelClub" :key="b.clave"
            class="mb-boost__caja" :class="{ 'is-lista': b.sePuedeCobrar }"
          >
            <span class="mb-boost__rot">{{ $t('rewards.' + b.clave) }}</span>
            <span class="mb-boost__caja-nombre">{{ b.caja ? b.caja.nombre : '—' }}</span>

            <button
              v-if="b.sePuedeCobrar" type="button" :disabled="cobrando === b.clave"
              class="mb-boost__b" @click="cobrarCaja(b.clave)"
            >{{ cobrando === b.clave ? $t('common.loading') : $t('rewards.claim') }}</button>

            <span v-else-if="b.yaCobrado" class="mb-boost__estado">{{ $t('rewards.claimed') }}</span>

            <span v-else class="mb-boost__estado">
              {{ $t('rewards.fromRank', { rango: b.desdeRango }) }}
            </span>
          </article>
        </div>
      </section>

      <!-- ── El código y lo cobrado ───────────────────────────────── -->
      <div class="mb-dos">
        <section class="mb-panel">
          <h2>{{ $t('rewards.promoCode') }}</h2>
          <p class="mb-panel__p">{{ $t('rewards.promoHelp') }}</p>
          <div class="mb-codigo">
            <input v-model="codigo" :aria-label="$t('rewards.promoCode')" :placeholder="$t('rewards.enterCode')">
            <button type="button" :disabled="!codigo.trim() || canjeando" @click="canjear">
              {{ canjeando ? $t('common.loading') : $t('rewards.redeemCode') }}
            </button>
          </div>
        </section>

        <section class="mb-panel">
          <h2>{{ $t('rewards.claimedSoFar') }}</h2>
          <div v-for="p in PERIODOS" :key="p" class="mb-cobrado">
            <span>{{ $t('rewards.' + p) }}</span>
            <span class="mb-cobrado__n">
              <span class="mb-sc mb-sc--16" aria-hidden="true">SC</span>{{ plata(datos.cobradoPorPeriodo[p] || 0) }}
            </span>
          </div>
          <div class="mb-cobrado mb-cobrado--total">
            <span>{{ $t('common.total') }}</span>
            <span class="mb-cobrado__n mb-cobrado__n--grande">
              <span class="mb-sc mb-sc--20" aria-hidden="true">SC</span>{{ plata(datos.cobradoTotalSc) }}
            </span>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>

<script>
import { mapGetters } from "vuex";
import api from "@/api";

const PERIODOS = ["daily", "weekly", "monthly"];

/**
 * LAS RECOMPENSAS.
 *
 * El rakeback: una parte de lo que jugaste, devuelta. Se junta solo y
 * se cobra en tres ventanas --diaria, semanal y mensual--, cada una una
 * vez por ventana.
 *
 * El monto lo calcula el SERVIDOR. Acá solo se dibuja: un número de
 * plata que sale de una cuenta hecha en el navegador es un número que
 * no se puede defender cuando alguien reclama.
 */
export default {
  name: "RewardsView",

  data() {
    return { PERIODOS, datos: null, club: null, codigo: "", cobrando: "", canjeando: false };
  },

  computed: {
    ...mapGetters(["entro"]),

    /* Solo los tres que entregan una caja: los otros cuatro se
       muestran en la pantalla del club, que es donde se explican. */
    cajasDelClub() {
      return ((this.club && this.club.beneficios) || []).filter((b) => !!b.vuelta);
    },
  },

  watch: { entro() { this.traer(); } },

  methods: {
    plata(n) {
      return Number(n || 0).toLocaleString("en-US", {
        minimumFractionDigits: 2, maximumFractionDigits: 2,
      });
    },

    async traer() {
      if (!this.entro) return;
      try {
        /*
          Las dos juntas: son la misma pantalla y pedirlas una despues
          de la otra la deja media dibujada mientras llega la segunda.
        */
        const [rake, club] = await Promise.all([
          api.get("/vip/rakeback"),
          api.get("/vip/beneficios"),
        ]);
        this.datos = rake.data.data;
        this.club = club.data.data;
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      }
    },

    async cobrar(periodo) {
      this.cobrando = periodo;
      try {
        const { data } = await api.post(`/vip/rakeback/${periodo}`, {});
        this.$store.commit("saldo", data.data);
        this.$store.dispatch("avisar", {
          texto: this.$t("rewards.claimedFor", { amount: "SC " + this.plata(data.data.montoSc) }),
        });
        await this.traer();
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      } finally {
        this.cobrando = "";
      }
    },

    /** Cobrar una de las cajas del club. */
    async cobrarCaja(clave) {
      this.cobrando = clave;
      try {
        const { data } = await api.post(`/vip/beneficios/${clave}`, {});
        /* La cabecera muestra las aperturas gratis: acaba de cambiar. */
        this.$store.commit("inventarioCambio");
        this.$store.dispatch("avisar", {
          texto: this.$t("rewards.gotBox", { caja: data.data.caja.nombre }),
        });
        await this.traer();
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      } finally {
        this.cobrando = "";
      }
    },

    /**
     * Canjear un código promocional.
     *
     * Los códigos se crean en el panel. Lo que impide canjearlo dos
     * veces lo decide la base, no esta pantalla: acá solo se manda el
     * texto y se muestra lo que contestó.
     */
    async canjear() {
      const texto = this.codigo.trim();
      if (!texto) return;

      this.canjeando = true;
      try {
        const { data } = await api.post("/wallet/promo", { code: texto });
        this.$store.commit("saldo", data.data);
        this.codigo = "";

        const d = data.data;
        this.$store.dispatch("avisar", {
          texto: d.tipo === "saldo"
            ? this.$t("rewards.codeBalance", { code: d.codigo, amount: this.plata(d.montoSc) })
            : this.$t("rewards.codeBoxes", { code: d.codigo, n: d.aperturas }),
        });

        await this.traer();
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      } finally {
        this.canjeando = false;
      }
    },
  },

  created() { this.traer(); },
};
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

.mb-premios-p { display: flex; flex-direction: column; gap: 22px; }
.mb-vacio { margin: 40px 0; text-align: center; color: $texto-4; }

/* ── El cartel ────────────────────────────────────────────────────── */

.mb-rcartel {
  position: relative;
  overflow: hidden;
  border-radius: 22px;
  background: #13285a;
  border: 1px solid #2a4a85;
  padding: clamp(18px, 3vw, 30px);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 24px;
}

// La gema del diseño: un cuadrado girado 45 grados con doble borde.
.mb-rcartel__gema {
  width: 110px;
  height: 110px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;

  span {
    width: 78px;
    height: 78px;
    border-radius: 18px;
    transform: rotate(45deg);
    background: #6b5a8a;
    border: 6px solid #8a7aa8;
    box-shadow: inset 0 0 0 10px #5a4a78, 0 10px 24px rgba(0, 0, 0, .4);
  }
}

.mb-rcartel__texto {
  flex: 1 1 280px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 540px;

  h1 { margin: 0; font-weight: 900; font-size: clamp(30px, 4vw, 42px); line-height: 1; }
  p { margin: 0; font-size: 15px; color: $texto-2; }
}

.mb-rcartel__rot { display: flex; justify-content: space-between; font-weight: 700; font-size: 13px; margin-top: 6px; }

.mb-rcartel__barra {
  height: 8px;
  border-radius: 4px;
  background: #0b1730;
  overflow: hidden;
  div { height: 100%; background: $azul; }
}

/* ── Los tres botones ─────────────────────────────────────────────── */

.mb-boost { display: flex; flex-direction: column; gap: 14px; h2 { margin: 0; font-weight: 900; font-size: 22px; } }
.mb-ayuda { margin: 0; font-size: 13px; color: $texto-4; line-height: 1.5; }

.mb-boost__grilla {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
  gap: 14px;
}

.mb-boost__caja {
  border-radius: 16px;
  background: $panel-alto;
  border: 1px solid $borde;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;

  &.is-lista { border-color: $verde; }
}

.mb-boost__rot { font-weight: 700; font-size: 13px; color: $texto-3; }
.mb-boost__monto { display: flex; align-items: center; gap: 8px; font-weight: 900; font-size: 26px; }
.mb-boost__base { font-size: 12px; color: $texto-4; }

.mb-boost__b {
  height: 46px;
  border-radius: 12px;
  border: 0;
  background: $azul;
  box-shadow: 0 4px 0 $azul-hondo;
  color: #fff;
  font-family: inherit;
  font-weight: 800;
  font-size: 15px;
  cursor: pointer;
  @include foco;
  &:disabled { opacity: .6; cursor: default; }
}

.mb-boost__estado {
  height: 46px;
  border-radius: 12px;
  background: $panel;
  padding: 0 16px;
  display: flex;
  align-items: center;
  font-weight: 700;
  font-size: 14px;
  color: $texto-3;
}

/* ── El código y lo cobrado ───────────────────────────────────────── */

.mb-dos {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
  gap: 14px;
  align-items: start;
}

.mb-panel {
  border-radius: 16px;
  background: $panel-alto;
  border: 1px solid $borde;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;

  h2 { margin: 0; font-weight: 900; font-size: 20px; }
}

.mb-panel__p { margin: 0; font-size: 14px; line-height: 1.5; color: $texto-3; }

.mb-codigo {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;

  input {
    flex: 1 1 160px;
    min-width: 0;
    height: 48px;
    padding: 0 14px;
    border-radius: 12px;
    border: 1px solid #2a4170;
    background: $panel;
    color: #fff;
    font-family: inherit;
    font-size: 15px;
    &:focus { outline: none; border-color: $azul; }
  }

  button {
    height: 48px;
    padding: 0 20px;
    border-radius: 12px;
    border: 0;
    background: $azul;
    box-shadow: 0 4px 0 $azul-hondo;
    color: #fff;
    font-family: inherit;
    font-weight: 800;
    font-size: 15px;
    cursor: pointer;
    @include foco;
  }
}

.mb-cobrado {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 11px 0;
  border-bottom: 1px solid $borde;
  font-size: 14px;

  > span:first-child { color: $texto-3; font-weight: 700; }

  &--total { border-bottom: 0; padding-top: 14px; > span:first-child { color: #fff; font-weight: 900; } }
}

.mb-cobrado__n {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 900;

  &--grande { font-size: 22px; color: $amarillo-v; }
}

.mb-boost__caja-nombre {
  font-weight: 800;
  font-size: 16px;
  line-height: 1.2;
}
</style>
