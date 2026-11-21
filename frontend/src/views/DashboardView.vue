<template>
  <div class="mb-panel-c">
    <p v-if="!entro" class="mb-vacio">{{ $t('error.NOT_LOGGED_IN') }}</p>

    <template v-else>
      <!-- ── Quién sos acá ────────────────────────────────────────── -->
      <div class="mb-pc__cabeza">
        <span class="mb-pc__avatar">{{ iniciales }}</span>

        <div class="mb-pc__quien">
          <span class="mb-pc__nombre">
            {{ usuario.username }}
            <span class="mb-pc__chapa">{{ $t('dashboard.creator') }}</span>
          </span>
          <span class="mb-pc__sub">
            {{ $tc('dashboard.boxesLive', total.alAire, { n: total.alAire }) }}
            ·
            {{ $t('dashboard.creatorSince', { fecha: fecha(creadorDesde) }) }}
          </span>
          <span class="mb-pc__parte" v-html="$t('dashboard.youKeep', { pct: Math.round(parte * 100) })"></span>
        </div>

        <router-link to="/create" class="mb-pc__nueva">{{ $t('dashboard.newBox') }}</router-link>
      </div>

      <!-- ── Lo que ganó ──────────────────────────────────────────── -->
      <section class="mb-ganancia">
        <div class="mb-ganancia__fila">
          <div class="mb-ganancia__grande">
            <span class="mb-rotulo">{{ $t('dashboard.earningsLast', { n: ganancias.dias }) }}</span>
            <span class="mb-ganancia__num">
              <span class="mb-sc mb-sc--32" aria-hidden="true">SC</span>{{ plata(ganancias.ganadoSc) }}
            </span>
          </div>

          <div class="mb-ganancia__chicos">
            <div class="mb-chico-dato">
              <span>{{ $t('dashboard.opens') }}</span>
              <b>{{ ganancias.aperturas }}</b>
            </div>
            <div class="mb-chico-dato">
              <span>{{ $t('dashboard.allTimeEarned') }}</span>
              <b>{{ plata(total.ganadoSc) }}</b>
            </div>
            <div class="mb-chico-dato">
              <span>{{ $t('dashboard.perOpen') }}</span>
              <b>{{ plata(ganancias.porAperturaSc) }}</b>
            </div>
          </div>
        </div>

        <!-- La curva de los últimos treinta días. -->
        <svg
          viewBox="0 0 600 180" preserveAspectRatio="none" role="img"
          :aria-label="$t('dashboard.chartAria', { n: ganancias.dias, amount: plata(ganancias.ganadoSc) })"
          class="mb-curva"
        >
          <path d="M0 45H600M0 90H600M0 135H600" stroke="#1f3355" stroke-width="1" />
          <path :d="area" fill="#3f7cf0" opacity=".18" />
          <path :d="linea" fill="none" stroke="#6bb4ff" stroke-width="3" stroke-linejoin="round" />
        </svg>

        <div class="mb-ganancia__fechas">
          <span v-for="(f, i) in fechasDelEje" :key="i">{{ f }}</span>
        </div>
      </section>

      <!-- ── Sus cajas ────────────────────────────────────────────── -->
      <section class="mb-pc__seccion">
        <div class="mb-pc__titulo">
          <h2>{{ $t('dashboard.yourBoxes') }}</h2>
          <span>
            {{ $tc('dashboard.opensAllTime', total.aperturas, { n: total.aperturas }) }}
            ·
            {{ $tc('dashboard.slotsFree', libres, { n: libres }) }}
          </span>
        </div>

        <div class="mb-pc__grilla">
          <article v-for="c in cajas" :key="c._id" class="mb-mcaja">
            <div class="mb-mcaja__cabeza">
              <span class="mb-mcaja__icono" :style="{ background: c.portada.color || '#2f6fe0' }">
                {{ corto(c.name) }}
              </span>
              <span class="mb-mcaja__quien">
                <span class="mb-mcaja__nombre">{{ c.name }}</span>
                <span class="mb-mcaja__estado" :class="'is-' + c.estado">{{ $t('dashboard.state.' + c.estado) }}</span>
              </span>
              <span class="mb-mcaja__precio">
                <span class="mb-sc mb-sc--16" aria-hidden="true">SC</span>{{ plata(c.priceSc) }}
              </span>
            </div>

            <p v-if="c.estado === 'rejected' && c.motivoDelRechazo" class="mb-mcaja__motivo">
              {{ c.motivoDelRechazo }}
            </p>

            <div class="mb-mcaja__numeros">
              <div><span>{{ $t('dashboard.opens') }}</span><b>{{ c.opens }}</b></div>
              <div><span>{{ $t('dashboard.revenue') }}</span><b>{{ plata(c.opens * c.priceSc) }}</b></div>
              <div><span>{{ $t('dashboard.profit') }}</span><b class="mb-verde">{{ plata(c.ganadoSc) }}</b></div>
            </div>

            <div class="mb-mcaja__botones">
              <router-link v-if="c.live" :to="`/boxes/${c.slug}`" class="mb-mcaja__ver">
                {{ $t('dashboard.viewBox') }}
              </router-link>
              <span v-else class="mb-mcaja__ver mb-mcaja__ver--apagado">
                {{ $t('dashboard.notLiveYet') }}
              </span>

              <button
                v-if="c.live" type="button" class="mb-mcaja__chico"
                :aria-label="$t('dashboard.share')" @click="copiar(c)"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff"
                     stroke-width="2" stroke-linecap="round" aria-hidden="true">
                  <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                  <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
                </svg>
              </button>

              <button
                v-if="c.estado === 'none' || c.estado === 'rejected'" type="button" class="mb-mcaja__chico"
                :aria-label="$t('dashboard.submit')" @click="mandar(c)"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff"
                     stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </button>
            </div>
          </article>

          <!-- El hueco para la próxima. -->
          <router-link v-if="libres > 0" to="/create" class="mb-hueco">
            <span class="mb-hueco__mas">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff"
                   stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            </span>
            <span class="mb-hueco__t">{{ $tc('dashboard.slotsFree', libres, { n: libres }) }}</span>
            <span class="mb-hueco__s">{{ $t('dashboard.buildAnother') }}</span>
            <span class="mb-hueco__b">{{ $t('nav.createBox') }}</span>
          </router-link>
        </div>
      </section>

      <!-- ── Los pagos ────────────────────────────────────────────── -->
      <section class="mb-pc__seccion">
        <div class="mb-pc__titulo">
          <h2>{{ $t('dashboard.payments') }}</h2>
          <span>
            {{ $t('dashboard.claimedTotal', { amount: plata(pagos.totalSc) }) }}
            <!-- Y cuantas de cuantas, cuando la lista no las trae todas:
                 el total de al lado es de TODAS, la tabla no. -->
            <template v-if="pagos.cuantos > pagos.items.length">
              &middot;
              {{ $t('dashboard.paymentsShown', { n: pagos.items.length, total: pagos.cuantos }) }}
            </template>
          </span>
        </div>

        <p v-if="!pagos.items.length" class="mb-vacio mb-vacio--chico">{{ $t('dashboard.noPayments') }}</p>

        <div v-else class="mb-tablita">
          <div class="mb-tablita__cabeza">
            <span>{{ $t('nav.boxes') }}</span>
            <span>{{ $t('profile.when') }}</span>
            <span>{{ $t('profile.amount') }}</span>
          </div>
          <div v-for="p in pagos.items" :key="p._id" class="mb-tablita__fila">
            <span>{{ p.caja }}</span>
            <span class="mb-tenue">{{ fecha(p.createdAt) }}</span>
            <span class="mb-verde">{{ plata(p.amountSc) }}</span>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<script>
import { mapState, mapGetters } from "vuex";
import api from "@/api";

/**
 * EL PANEL DEL CREADOR.
 *
 * Lo que ganaron sus cajas, caja por caja y día por día.
 *
 * LOS NUMEROS SALEN DEL LIBRO
 *
 * El gráfico y los pagos vienen de las transacciones de tipo
 * `creator_share`, no de un contador aparte. Un contador se
 * desincroniza y nadie se entera hasta que el creador reclama que le
 * faltan SC 40 y no hay con qué contestarle.
 */
export default {
  name: "DashboardView",

  data() {
    return {
      cajas: [],
      total: { cajas: 0, alAire: 0, aperturas: 0, ganadoSc: 0 },
      parte: 0.5,
      tope: 20,
      ganancias: { dias: 30, serie: [], ganadoSc: 0, aperturas: 0, porAperturaSc: 0 },
      pagos: { items: [], totalSc: 0, cuantos: 0 },
    };
  },

  computed: {
    ...mapState(["usuario"]),
    ...mapGetters(["entro"]),

    iniciales() {
      return String((this.usuario && this.usuario.username) || "?").slice(0, 2).toUpperCase();
    },

    libres() { return Math.max(0, this.tope - this.total.cajas); },

    /*
      CREADOR DESDE SU PRIMERA CAJA, NO DESDE QUE SE REGISTRO.

      Decia `usuario.createdAt`, que es el dia que se hizo la cuenta.
      Alguien que juega hace dos anos y arma su primera caja hoy leia
      "creador desde 2024", que no es cierto y ademas le quita merito
      a lo que acaba de hacer.

      Las cajas vienen de la mas nueva a la mas vieja, asi que la
      primera es la ultima de la lista.
    */
    creadorDesde() {
      if (this.cajas.length) return this.cajas[this.cajas.length - 1].createdAt;
      return this.usuario && this.usuario.createdAt;
    },

    /** El tope de la curva. Nunca cero: dividir por cero aplana todo. */
    techo() {
      return Math.max(0.01, ...this.ganancias.serie.map((s) => s.ganadoSc));
    },

    puntos() {
      const n = this.ganancias.serie.length;
      if (!n) return [];
      return this.ganancias.serie.map((s, i) => {
        const x = n === 1 ? 300 : (i / (n - 1)) * 600;
        /* 170 abajo y 10 arriba: deja aire para que la punta del pico
           no quede cortada contra el borde. */
        const y = 170 - (s.ganadoSc / this.techo) * 160;
        return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
      });
    },

    linea() {
      if (!this.puntos.length) return "M0 170 L600 170";
      return "M" + this.puntos.map((p) => `${p[0]} ${p[1]}`).join(" L");
    },

    area() {
      if (!this.puntos.length) return "";
      return `${this.linea} L600 180 L0 180Z`;
    },

    /** Tres fechas debajo del gráfico: principio, medio y fin. */
    fechasDelEje() {
      const s = this.ganancias.serie;
      if (!s.length) return [];
      return [s[0], s[Math.floor(s.length / 2)], s[s.length - 1]]
        .filter(Boolean)
        .map((d) => this.fechaCorta(d.dia));
    },
  },

  methods: {
    plata(n) {
      return Number(n || 0).toLocaleString("en-US", {
        minimumFractionDigits: 2, maximumFractionDigits: 2,
      });
    },

    fecha(d) {
      return d
        ? new Date(d).toLocaleDateString(this.$i18n.locale, { day: "2-digit", month: "short", year: "numeric" })
        : "";
    },

    fechaCorta(d) {
      return new Date(d + "T00:00:00").toLocaleDateString(this.$i18n.locale, { day: "2-digit", month: "short" });
    },

    /** Las primeras letras del nombre, para el cuadradito de color. */
    corto(nombre) {
      return String(nombre || "")
        .split(/\s+/)
        .map((p) => p[0])
        .join("")
        .slice(0, 4)
        .toUpperCase();
    },

    async copiar(c) {
      const donde = `${window.location.origin}/boxes/${c.slug}`;
      try {
        await navigator.clipboard.writeText(donde);
        this.$store.dispatch("avisar", { texto: this.$t("dashboard.linkCopied") });
      } catch {
        /* Sin permiso de portapapeles no se puede; no es grave. */
      }
    },

    async mandar(c) {
      try {
        await api.post(`/community/${c._id}/submit`, {});
        this.$store.dispatch("avisar", { texto: this.$t("create.sentForReview") });
        await this.traer();
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      }
    },

    async traer() {
      if (!this.entro) return;
      try {
        const [mias, gan, pag] = await Promise.all([
          api.get("/community/mine"),
          api.get("/community/earnings"),
          api.get("/community/payments"),
        ]);
        this.cajas = mias.data.data.cajas;
        this.total = mias.data.data.total;
        this.parte = mias.data.data.parte;
        this.tope = mias.data.data.tope;
        this.ganancias = gan.data.data;
        this.pagos = pag.data.data;
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      }
    },
  },

  created() { this.traer(); },
  watch: { entro() { this.traer(); } },
};
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

.mb-panel-c { display: flex; flex-direction: column; gap: 22px; }

.mb-pc__cabeza { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; }

.mb-pc__avatar {
  width: 52px;
  height: 52px;
  flex: none;
  border-radius: 14px;
  background: #2b4c80;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 900;
  font-size: 18px;
}

.mb-pc__quien { display: flex; flex-direction: column; gap: 3px; flex: 1 1 240px; }

.mb-pc__nombre { display: flex; align-items: center; gap: 8px; font-weight: 900; font-size: 20px; }

.mb-pc__chapa {
  padding: 2px 9px;
  border-radius: 8px;
  border: 1px solid $azul;
  background: #12305e;
  color: #9cc4ff;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: .06em;
}

.mb-pc__sub { font-size: 13px; color: $texto-4; }
.mb-pc__parte { font-size: 13px; font-weight: 700; ::v-deep b { color: $verde; } }

.mb-pc__nueva {
  height: 46px;
  padding: 0 18px;
  border-radius: 12px;
  background: $azul;
  box-shadow: 0 4px 0 $azul-hondo;
  color: #fff;
  font-weight: 800;
  font-size: 15px;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  @include foco;
  &:hover { color: #fff; filter: brightness(1.06); }
}

/* ── El gráfico ───────────────────────────────────────────────────── */

.mb-ganancia {
  border-radius: 20px;
  background: $panel-alto;
  border: 1px solid #23397a;
  padding: clamp(16px, 3vw, 24px);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.mb-ganancia__fila { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 14px; }
.mb-ganancia__grande { display: flex; flex-direction: column; gap: 6px; }

.mb-rotulo {
  font-weight: 900;
  font-size: 12px;
  letter-spacing: .1em;
  color: $texto-4;
  text-transform: uppercase;
}

.mb-ganancia__num {
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: 900;
  font-size: clamp(40px, 6vw, 56px);
  line-height: 1;
}

.mb-ganancia__chicos { display: flex; gap: 10px; flex-wrap: wrap; align-items: flex-start; }

.mb-chico-dato {
  padding: 10px 14px;
  border-radius: 12px;
  background: $panel;
  min-width: 92px;

  span { display: block; font-size: 12px; color: $texto-4; }
  b { display: block; font-weight: 900; font-size: 18px; }
}

.mb-curva { width: 100%; height: 200px; }

.mb-ganancia__fechas {
  display: flex;
  justify-content: space-between;
  font-weight: 700;
  font-size: 12px;
  color: $texto-4;
}

/* ── Sus cajas ────────────────────────────────────────────────────── */

.mb-pc__seccion { display: flex; flex-direction: column; gap: 12px; }

.mb-pc__titulo {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 6px;

  h2 { margin: 0; font-weight: 900; font-size: 22px; }
  span { font-size: 13px; color: $texto-4; }
}

.mb-pc__grilla {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
  gap: 14px;
}

.mb-mcaja {
  border-radius: 18px;
  background: $panel-alto;
  border: 1px solid $borde;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.mb-mcaja__cabeza { display: flex; align-items: center; gap: 12px; }

.mb-mcaja__icono {
  width: 52px;
  height: 52px;
  flex: none;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: $fuente-cartel;
  font-size: 13px;
  line-height: 1;
  text-align: center;
}

.mb-mcaja__quien { display: flex; flex-direction: column; flex: 1; min-width: 0; gap: 2px; }
.mb-mcaja__nombre { font-weight: 900; font-size: 16px; }

.mb-mcaja__estado {
  align-self: flex-start;
  padding: 2px 8px;
  border-radius: 7px;
  font-weight: 800;
  font-size: 11px;
  background: #1d3354;
  color: $texto-3;

  &.is-live { background: rgba(93, 255, 176, .15); color: $verde; }
  &.is-pending { background: rgba(255, 211, 90, .15); color: $amarillo; }
  &.is-rejected { background: rgba(255, 91, 107, .15); color: #ff9aa5; }
}

.mb-mcaja__precio { display: flex; align-items: center; gap: 5px; font-weight: 900; font-size: 15px; }

.mb-mcaja__motivo {
  margin: 0;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(255, 91, 107, .1);
  border: 1px solid #ff5b6b;
  color: #ff9aa5;
  font-size: 13px;
  line-height: 1.4;
}

.mb-mcaja__numeros {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;

  span { display: block; font-size: 12px; color: $texto-4; }
  b { display: block; font-weight: 900; }
}

.mb-verde { color: $verde; }

.mb-mcaja__botones { display: flex; gap: 8px; }

.mb-mcaja__ver {
  flex: 1;
  height: 44px;
  border-radius: 12px;
  background: $panel;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 14px;
  color: $texto-3;
  text-decoration: none;
  @include foco;
  &:hover { color: #fff; }
  &--apagado { cursor: default; }
}

.mb-mcaja__chico {
  width: 44px;
  height: 44px;
  flex: none;
  border-radius: 12px;
  border: 0;
  background: $panel;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  @include foco;
  &:hover { background: $lateral-hover; }
}

.mb-hueco {
  min-height: 240px;
  border-radius: 18px;
  border: 2px dashed #2f4b80;
  background: $panel;
  color: #fff;
  text-decoration: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 20px;
  @include foco;
  &:hover { color: #fff; border-color: $azul; }
}

.mb-hueco__mas {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: #1d3354;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mb-hueco__t { font-weight: 900; font-size: 17px; }
.mb-hueco__s { font-size: 13px; color: $texto-4; max-width: 240px; text-align: center; }

.mb-hueco__b {
  margin-top: 4px;
  padding: 10px 16px;
  border-radius: 10px;
  background: $azul;
  font-weight: 800;
  font-size: 14px;
}

/* ── Los pagos ────────────────────────────────────────────────────── */

.mb-tablita { border-radius: 16px; overflow: hidden; border: 1px solid $borde; }

.mb-tablita__cabeza, .mb-tablita__fila {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr);
  gap: 8px;

  span:nth-child(2), span:nth-child(3) { text-align: right; }
}

.mb-tablita__cabeza {
  padding: 12px 16px;
  background: $panel;
  font-weight: 900;
  font-size: 11px;
  letter-spacing: .1em;
  color: $texto-4;
  text-transform: uppercase;
}

.mb-tablita__fila {
  padding: 14px 16px;
  border-top: 1px solid #1a2a45;
  font-weight: 700;
  font-size: 14px;
  span:nth-child(3) { font-weight: 900; }
}

.mb-tenue { color: $texto-3; }

.mb-vacio { margin: 40px 0; text-align: center; color: $texto-4; }
.mb-vacio--chico { margin: 16px 0; }
</style>
