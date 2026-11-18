<template>
  <div class="mb-afi">
    <!-- ── El cartel ────────────────────────────────────────────── -->
    <section class="mb-acartel">
      <div class="mb-rays mb-acartel__rayos" aria-hidden="true"></div>

      <div class="mb-acartel__texto">
        <h1>{{ $t('affil.title') }}</h1>
        <p>{{ $t('affil.sub', { pct: bonoPct }) }}</p>

        <button type="button" class="mb-acartel__b" @click="copiarEnlace">
          {{ $t('affil.copyLink') }}
        </button>
        <span class="mb-acartel__copiado">{{ copiado ? $t('affil.copied') : '' }}</span>
      </div>
    </section>

    <template v-if="d">
      <!-- ── Lo que trajo ───────────────────────────────────────── -->
      <section class="mb-acaja mb-acaja--tres">
        <div class="mb-adato">
          <span>{{ $t('affil.referrals') }}</span>
          <b>{{ num(d.total.jugadores) }}</b>
        </div>
        <div class="mb-adato">
          <span>{{ $t('affil.deposits') }}</span>
          <b><span class="mb-sc mb-sc--20" aria-hidden="true">SC</span>{{ plata(d.total.depositadoSc) }}</b>
        </div>
        <div class="mb-adato">
          <span>{{ $t('affil.volume') }}</span>
          <b><span class="mb-sc mb-sc--20" aria-hidden="true">SC</span>{{ plata(d.total.jugadoSc) }}</b>
        </div>
      </section>

      <!-- ── El código y el enlace ──────────────────────────────── -->
      <section class="mb-acaja mb-acaja--dos">
        <div class="mb-adato">
          <span>{{ $t('affil.code') }}</span>
          <div class="mb-acodigo">
            <input
              v-if="editando" v-model="borrador" maxlength="16" class="mb-acodigo__in"
              :aria-label="$t('affil.code')" @input="borrador = borrador.replace(/[^a-zA-Z0-9]/g, '')"
            >
            <b v-else>{{ codigo }}</b>

            <button v-if="editando" type="button" class="mb-acodigo__b" :disabled="guardando" @click="guardar">
              {{ $t('action.save') }}
            </button>
            <button v-else type="button" class="mb-acodigo__b mb-acodigo__b--suave" @click="empezarAEditar">
              {{ $t('affil.edit') }}
            </button>
          </div>
        </div>

        <div class="mb-adato">
          <span>{{ $t('affil.link') }}</span>
          <div class="mb-acodigo">
            <span class="mb-acodigo__enlace">{{ enlace }}</span>
            <button type="button" class="mb-acodigo__b mb-acodigo__b--suave" @click="copiarEnlace">
              {{ copiado ? $t('affil.copied') : $t('affil.copy') }}
            </button>
          </div>
        </div>
      </section>

      <!-- ── Lo ganado y el tramo ───────────────────────────────── -->
      <section class="mb-ados">
        <div class="mb-acaja mb-acaja--col">
          <div class="mb-adato mb-adato--fila">
            <span class="mb-adato__t">
              {{ $t('affil.available') }}
              <b><span class="mb-sc mb-sc--20" aria-hidden="true">SC</span>{{ plata(d.total.porCobrarSc) }}</b>
            </span>
            <button
              type="button" class="mb-acobrar" :disabled="!d.total.porCobrarSc || cobrando"
              @click="cobrar"
            >{{ $t('affil.claim') }}</button>
          </div>

          <div class="mb-adato">
            <span>{{ $t('affil.totalEarned') }}</span>
            <b><span class="mb-sc mb-sc--20" aria-hidden="true">SC</span>{{ plata(d.total.ganadoSc) }}</b>
          </div>
        </div>

        <div class="mb-acaja mb-acaja--col">
          <div class="mb-atramo">
            <div class="mb-atramo__cab">
              <span>
                {{ $t('affil.commissionTier') }}
                <b>{{ d.tramoActual.numero }}/{{ d.tramoActual.deCuantos }}</b>
              </span>
              <button type="button" @click="tramosAbiertos = !tramosAbiertos">
                {{ $t('affil.allTiers') }}
              </button>
            </div>

            <span class="mb-atramo__ahora">
              {{ d.tramoActual.nombre }}
              <b>{{ (d.tramoActual.pct * 100).toFixed(0) }}%</b>
            </span>

            <div v-if="tramosAbiertos" class="mb-atramo__todos">
              <div
                v-for="t in d.tramos" :key="t.nombre" class="mb-atramo__uno"
                :class="{ 'is-mio': t.nombre === d.tramoActual.nombre }"
              >
                <span>{{ t.nombre }}</span>
                <b>{{ (t.pct * 100).toFixed(0) }}%</b>
                <span class="mb-tenue">{{ corto(t.desdeSc) }}</span>
              </div>
            </div>

            <div v-if="d.tramoActual.siguiente" class="mb-atramo__falta">
              <div class="mb-atramo__fila">
                <span class="mb-tenue">{{ $t('affil.next') }} <b>{{ d.tramoActual.siguiente.nombre }}</b></span>
                <span>{{ d.tramoActual.progreso }}%</span>
              </div>
              <div class="mb-atramo__barra"><div :style="{ width: d.tramoActual.progreso + '%' }"></div></div>
              <span class="mb-atramo__pie">
                {{ $t('affil.moreToEarn', {
                  amount: corto(d.tramoActual.faltaSc),
                  pct: (d.tramoActual.siguiente.pct * 100).toFixed(0),
                }) }}
              </span>
            </div>

            <p class="mb-atramo__nota">{{ $t('affil.ofMargin') }}</p>
          </div>
        </div>
      </section>

      <!-- ── Los que trajo ──────────────────────────────────────── -->
      <section class="mb-acaja mb-acaja--col">
        <div class="mb-alista__cab">
          <h2>{{ $t('affil.yourReferrals') }}</h2>
          <span class="mb-tenue">{{ $t('admin.showing', { n: num(d.referidos.length) }) }}</span>
        </div>

        <div v-if="d.referidos.length" class="mb-alista">
          <div class="mb-alista__fila mb-alista__fila--cab">
            <span>{{ $t('affil.player') }}</span>
            <span>{{ $t('affil.joined') }}</span>
            <span class="mb-der">{{ $t('affil.deposits') }}</span>
            <span class="mb-der">{{ $t('profile.wagered') }}</span>
          </div>

          <div v-for="r in d.referidos" :key="r._id" class="mb-alista__fila">
            <span>{{ r.username }}</span>
            <span class="mb-tenue">{{ fecha(r.desde) }}</span>
            <span class="mb-der">SC {{ plata(r.depositadoSc) }}</span>
            <span class="mb-der">SC {{ plata(r.jugadoSc) }}</span>
          </div>
        </div>

        <div v-else class="mb-avacio">
          <span>{{ $t('affil.noReferrals') }}</span>
          <span class="mb-tenue">{{ $t('affil.noReferralsSub') }}</span>
        </div>
      </section>
    </template>

    <p v-else-if="!entro" class="mb-avacio">{{ $t('error.NOT_LOGGED_IN') }}</p>
    <p v-else class="mb-tenue">{{ $t('common.loading') }}</p>
  </div>
</template>

<script>
import { mapGetters } from "vuex";
import api from "@/api";

/**
 * AFILIADOS.
 *
 * La pantalla del prototipo: el cartel con el enlace, lo que trajo, el
 * código, lo ganado y el tramo de comisión.
 *
 * EL PORCENTAJE ES SOBRE EL MARGEN, NO SOBRE LO JUGADO
 *
 * Y la pantalla lo dice. La casa se queda con el 8% de lo que se juega:
 * pagar "15% de cada apuesta" sería pagar el doble de lo que entra, y
 * ese trato no lo puede sostener nadie. Sobre el margen, el tramo VIII
 * paga 15 centavos de cada peso que la casa gana con esos jugadores.
 */
export default {
  name: "AffiliatesView",

  data() {
    return {
      d: null,
      copiado: false,
      editando: false,
      borrador: "",
      guardando: false,
      cobrando: false,
      tramosAbiertos: false,
    };
  },

  computed: {
    ...mapGetters(["entro"]),

    codigo() {
      return (this.d && this.d.codigos.length && this.d.codigos[0].code) || "—";
    },

    enlace() {
      const base = window.location.origin.replace(/^https?:\/\//, "");
      return `${base}/signup?ref=${this.codigo}`;
    },

    bonoPct() {
      const b = this.d && this.d.bonoParaElAmigo;
      return b ? Math.round(b.normal * 1000) / 10 : 5;
    },
  },

  methods: {
    num(n) { return Number(n || 0).toLocaleString("en-US"); },
    plata(n) {
      return Number(n || 0).toLocaleString("en-US", {
        minimumFractionDigits: 2, maximumFractionDigits: 2,
      });
    },
    fecha(d) { return d ? new Date(d).toLocaleDateString(this.$i18n.locale, { day: "2-digit", month: "short", year: "numeric" }) : ""; },

    /** "SC 2.5M", "SC 10K": en una tarjeta no entra "2,500,000.00". */
    corto(n) {
      const v = Number(n) || 0;
      if (v >= 1000000) return "SC " + (v / 1000000).toFixed(v % 1000000 ? 1 : 0) + "M";
      if (v >= 1000) return "SC " + Math.round(v / 1000) + "K";
      return "SC " + v;
    },

    async copiarEnlace() {
      try {
        await navigator.clipboard.writeText("https://" + this.enlace);
        this.copiado = true;
        window.setTimeout(() => { this.copiado = false; }, 2000);
      } catch (err) {
        this.$store.dispatch("avisar", { texto: this.enlace });
      }
    },

    empezarAEditar() {
      this.borrador = this.codigo === "—" ? "" : this.codigo;
      this.editando = true;
    },

    async guardar() {
      const nuevo = this.borrador.trim().toUpperCase();
      if (nuevo.length < 3) {
        this.$store.dispatch("avisar", { texto: this.$t("affil.codeShort"), tono: "error" });
        return;
      }

      this.guardando = true;
      try {
        await api.post("/profile/affiliate/code", { code: nuevo });
        this.editando = false;
        await this.traer();
        this.$store.dispatch("avisar", { texto: this.$t("admin.done") });
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      } finally {
        this.guardando = false;
      }
    },

    async cobrar() {
      this.cobrando = true;
      try {
        const { data } = await api.post("/profile/affiliate/claim", {
          codigoId: this.d.codigos[0]._id,
        });
        this.$store.commit("saldo", data.data);
        this.$store.dispatch("avisar", { texto: this.$t("affil.claimed", { amount: this.plata(data.data.cobradoSc) }) });
        await this.traer();
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      } finally {
        this.cobrando = false;
      }
    },

    async traer() {
      if (!this.entro) return;
      try {
        const { data } = await api.get("/profile/affiliate");
        this.d = data.data;
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      }
    },
  },

  watch: {
    /* El usuario llega DESPUES de dibujar la pantalla: el token se
       canjea en un pedido. Por eso se espera a que llegue en vez de
       mandar a /login al que ya tiene sesion. */
    entro() { this.traer(); },
  },

  created() { this.traer(); },
};
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

.mb-afi { display: flex; flex-direction: column; gap: 20px; }

/* ── El cartel ────────────────────────────────────────────────────── */

.mb-acartel {
  position: relative;
  overflow: hidden;
  border-radius: 22px;
  min-height: 250px;
  background: radial-gradient(circle at 18% 55%, rgba(255, 190, 60, .55) 0%, rgba(214, 112, 20, .5) 35%, rgba(20, 48, 106, .95) 72%), #14306a;
  border: 1px solid #2f4fa0;
  display: flex;
  align-items: center;
}

.mb-acartel__rayos {
  position: absolute;
  left: 70%;
  top: 50%;
  width: 1200px;
  height: 1200px;
  margin: -600px 0 0 -600px;
  background: repeating-conic-gradient(from 0deg, rgba(255, 255, 255, .07) 0deg 6deg, rgba(255, 255, 255, 0) 6deg 18deg);
}

.mb-acartel__texto {
  position: relative;
  padding: 32px 36px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-width: min(620px, 100%);

  h1 {
    margin: 0;
    font-family: $fuente-cartel;
    font-weight: 400;
    font-size: clamp(30px, 4.4vw, 44px);
    line-height: 1.02;
    text-shadow: 0 3px 0 rgba(6, 20, 58, .55);
  }

  p { margin: 0; font-weight: 700; font-size: 16px; line-height: 1.45; color: #eef4ff; }

  @include en-celular { padding: 22px 20px; }
}

.mb-acartel__b {
  align-self: flex-start;
  height: 46px;
  padding: 0 26px;
  border-radius: 23px;
  border: 3px solid #fff;
  background: linear-gradient(180deg, #4fa2ff, #2f6fe0);
  color: #fff;
  font-family: inherit;
  font-weight: 900;
  font-size: 15px;
  cursor: pointer;
  @include foco;
  &:hover { filter: brightness(1.06); }
}

.mb-acartel__copiado { min-height: 16px; font-weight: 800; font-size: 13px; }

/* ── Las tarjetas ─────────────────────────────────────────────────── */

.mb-acaja {
  border-radius: 22px;
  background: #12233d;
  padding: 14px;
  box-sizing: border-box;
  display: grid;
  gap: 14px;

  &--tres { grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); }
  &--dos { grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); }
  &--col { display: flex; flex-direction: column; }
}

.mb-ados { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr)); gap: 20px; align-items: start; }

.mb-adato {
  border-radius: 16px;
  background: #0b1729;
  padding: 22px 24px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 14px;

  > span:first-child { font-weight: 900; font-size: 11px; letter-spacing: .12em; color: $texto-4; }
  b { display: flex; align-items: center; gap: 8px; font-weight: 900; font-size: 26px; }

  &--fila { flex-direction: row; align-items: center; justify-content: space-between; gap: 12px; }
}

.mb-adato__t { display: flex; flex-direction: column; gap: 10px; font-weight: 900; font-size: 11px; letter-spacing: .12em; color: $texto-4; }

.mb-acobrar {
  height: 42px;
  padding: 0 20px;
  border-radius: 12px;
  border: 0;
  background: $verde;
  color: #06331f;
  font-family: inherit;
  font-weight: 900;
  font-size: 14px;
  cursor: pointer;
  @include foco;
  &:disabled { opacity: .45; cursor: default; }
}

/* ── El código ────────────────────────────────────────────────────── */

.mb-acodigo {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 40px;

  b { font-weight: 900; font-size: 20px; }
}

.mb-acodigo__in {
  flex: 1;
  min-width: 0;
  height: 40px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid $borde-fuerte;
  background: $panel;
  color: #fff;
  font-family: inherit;
  font-weight: 900;
  font-size: 18px;
  text-transform: uppercase;
  &:focus { outline: none; border-color: $azul; }
}

.mb-acodigo__enlace {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 800;
  font-size: 14px;
  color: $texto-2;
}

.mb-acodigo__b {
  flex: none;
  height: 36px;
  padding: 0 14px;
  border-radius: 10px;
  border: 0;
  background: $azul;
  color: #fff;
  font-family: inherit;
  font-weight: 800;
  font-size: 13px;
  cursor: pointer;
  @include foco;

  &--suave { background: #1d3354; }
  &:disabled { opacity: .5; cursor: default; }
}

/* ── El tramo ─────────────────────────────────────────────────────── */

.mb-atramo {
  border-radius: 16px;
  background: #0b1729;
  padding: 22px 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.mb-atramo__cab {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-weight: 900;
  font-size: 11px;
  letter-spacing: .12em;
  color: $texto-4;

  b { color: $placeholder; }

  button {
    border: 0;
    background: transparent;
    color: #3f9bff;
    font-family: inherit;
    font-weight: 800;
    font-size: 12px;
    cursor: pointer;
    @include foco;
  }
}

.mb-atramo__ahora {
  display: flex;
  align-items: baseline;
  gap: 12px;
  font-family: $fuente-cartel;
  font-size: 34px;
  b { font-family: $fuente; font-weight: 900; font-size: 22px; color: #3f9bff; }
}

.mb-atramo__todos { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }

.mb-atramo__uno {
  border-radius: 10px;
  background: #101f36;
  padding: 8px 6px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 11px;
  font-weight: 800;

  b { font-size: 14px; color: #3f9bff; }
  &.is-mio { background: #1d3a66; }
}

.mb-atramo__falta { margin-top: auto; display: flex; flex-direction: column; gap: 8px; }
.mb-atramo__fila { display: flex; justify-content: space-between; font-weight: 800; font-size: 13px; }

.mb-atramo__barra {
  height: 10px;
  border-radius: 6px;
  background: #050c18;
  div { height: 100%; border-radius: 6px; background: #3f9bff; }
}

.mb-atramo__pie { font-weight: 800; font-size: 14px; }
.mb-atramo__nota { margin: 0; font-size: 12px; line-height: 1.5; color: $texto-4; }

/* ── La lista ─────────────────────────────────────────────────────── */

.mb-alista__cab { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 10px 0; h2 { margin: 0; font-family: $fuente-cartel; font-weight: 400; font-size: 22px; } }

.mb-alista { border-radius: 16px; background: #0b1729; overflow: hidden; }

.mb-alista__fila {
  display: grid;
  grid-template-columns: 1.4fr 1fr 1fr 1fr;
  gap: 10px;
  padding: 12px 18px;
  border-bottom: 1px solid #14233c;
  font-weight: 700;
  font-size: 14px;

  &:last-child { border-bottom: 0; }

  &--cab {
    font-weight: 900;
    font-size: 11px;
    letter-spacing: .1em;
    color: $texto-4;
    text-transform: uppercase;
  }
}

.mb-der { text-align: right; font-variant-numeric: tabular-nums; }

.mb-avacio {
  border-radius: 16px;
  background: #0b1729;
  padding: 36px 10px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 6px;
  span:first-child { font-weight: 900; font-size: 16px; }
}

.mb-tenue { color: $texto-4; }
</style>
