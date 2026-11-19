<template>
  <div v-if="d" class="adso">
    <router-link to="/admin/affiliates" class="adso__volver">‹ {{ $t('admin.nav.affiliates') }}</router-link>

    <div class="adso__cabeza">
      <div class="adso__quien">
        <h1>
          {{ d.socio.username }}
          <span v-if="d.socio.banned" class="ad-estado is-mal">{{ $t('admin.state.banned') }}</span>
          <span v-if="d.pidioRangoEl" class="ad-estado is-espera">{{ $t('admin.afi.asked') }}</span>
        </h1>
        <span class="adso__que">
          {{ d.socio.email }} · {{ $t('admin.afi.since', { date: fecha(d.socio.desde) }) }}
          <template v-if="d.socio.vinoCon"> · {{ $t('admin.afi.cameWith', { code: d.socio.vinoCon }) }}</template>
        </span>
      </div>

      <router-link :to="`/admin/players/${d.socio._id}`" class="ad-b ad-b--suave">
        {{ $t('admin.afi.openPlayer') }}
      </router-link>
    </div>

    <!-- ── Los números ──────────────────────────────────────────── -->
    <div class="ad-nums">
      <div class="ad-num"><span>{{ $t('admin.afi.brought') }}</span><b>{{ num(d.numeros.traidos) }}</b></div>
      <div class="ad-num"><span>{{ $t('admin.afi.theirPlay') }}</span><b>SC {{ plata(d.numeros.jugadoSc) }}</b></div>
      <div class="ad-num">
        <span>{{ $t('admin.afi.margin') }}</span>
        <b>SC {{ plata(d.numeros.margenSc) }}</b>
        <em>{{ $t('admin.afi.marginHelp', { pct: houseEdge }) }}</em>
      </div>
      <div class="ad-num"><span>{{ $t('admin.afi.paid') }}</span><b>SC {{ plata(d.numeros.pagadoSc) }}</b></div>
      <div class="ad-num">
        <span>{{ $t('admin.afi.pending') }}</span>
        <b class="ad-amarillo">SC {{ plata(d.numeros.porCobrarSc) }}</b>
      </div>
      <div class="ad-num">
        <span>{{ $t('admin.afi.net') }}</span>
        <b :class="d.numeros.netoSc < 0 ? 'ad-rojo' : 'ad-verde'">SC {{ plata(d.numeros.netoSc) }}</b>
        <em>{{ $t('admin.afi.shareIs', { pct: pct(d.numeros.tajadaPct) }) }}</em>
      </div>
    </div>

    <!-- ── El rango ─────────────────────────────────────────────── -->
    <section class="ad-caja">
      <h2>{{ $t('admin.afi.rank') }}</h2>
      <p>{{ $t('admin.afi.rankHelp') }}</p>

      <div class="adso__rango">
        <span class="adso__ahora">
          <mb-gema :numero="d.rango.numero" :lado="36" />
          <span>
            <b>{{ d.rango.numero }} · {{ d.rango.nombre }}</b>
            <em>
              SC {{ d.rango.cpaSc }} · {{ d.rango.revsharePct }}% ·
              SC {{ d.rango.hibridoCpaSc }} + {{ d.rango.hibridoPct }}% ·
{{ $t('admin.afi.bonus', { pct: d.rango.bonoPct }) }}
            </em>
          </span>
        </span>

        <div class="adso__dar">
          <mb-elegir v-model="nuevoRango" class="ad-elegir" :opciones="opcionesDeRango" />
          <input v-model="motivo" class="ad-in adso__motivo" :placeholder="$t('admin.reason')" maxlength="300">
          <button
            type="button" class="ad-b"
            :disabled="motivo.trim().length < 3 || nuevoRango === d.rango.numero || dando"
            @click="dar"
          >{{ $t('admin.afi.grant') }}</button>
        </div>
      </div>
    </section>

    <!-- ── Las campañas ─────────────────────────────────────────── -->
    <section class="ad-caja">
      <h2>{{ $t('admin.afi.campaigns') }}</h2>
      <p>{{ $t('admin.afi.campaignsHelp') }}</p>

      <div class="ad-tabla">
        <div class="ad-tabla__scroll">
          <table>
            <thead>
              <tr>
                <th>{{ $t('admin.afi.campaign') }}</th>
                <th>{{ $t('admin.afi.model') }}</th>
                <th class="ad-der">{{ $t('admin.afi.paysToday') }}</th>
                <th class="ad-der">{{ $t('admin.afi.clicks') }}</th>
                <th class="ad-der">{{ $t('admin.afi.players') }}</th>
                <th class="ad-der">{{ $t('admin.afi.theirPlay') }}</th>
                <th class="ad-der">{{ $t('admin.afi.earned') }}</th>
                <th class="ad-der">{{ $t('admin.afi.pending') }}</th>
                <th>{{ $t('admin.afi.state') }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in d.campanas" :key="c._id">
                <td>
                  <b>{{ c.code }}</b>
                  <em class="adso__nombre">{{ c.nombre }}{{ c.canal ? ' · ' + c.canal : '' }}</em>
                </td>
                <td><span class="adso__m" :class="'is-' + c.modelo">{{ $t('admin.afi.m_' + c.modelo) }}</span></td>
                <td class="ad-der">{{ comoCobra(c) }}</td>
                <td class="ad-der">{{ num(c.clics) }}</td>
                <td class="ad-der">{{ num(c.jugadores) }}</td>
                <td class="ad-der">SC {{ plata(c.jugadoPorLosSuyosSc) }}</td>
                <td class="ad-der">SC {{ plata(c.ganadoSc) }}</td>
                <td class="ad-der ad-amarillo">SC {{ plata(c.porCobrarSc) }}</td>
                <td>
                  <span class="ad-estado" :class="c.activo ? 'is-bien' : 'is-mal'">
                    {{ $t(c.activo ? 'admin.state.active' : 'admin.state.off') }}
                  </span>
                  <!-- El bono puesto a mano se ve: es el unico numero de
                       esta campaña que no sale del rango. -->
                  <em v-if="c.bonoPropio !== null" class="adso__amano">
                    {{ $t('admin.afi.byHand', { pct: pct(c.bonoPropio * 100) }) }}
                  </em>
                </td>
                <td>
                  <button type="button" class="ad-b ad-b--chico ad-b--suave" @click="abrirCampana(c)">
                    {{ $t('admin.edit') }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="!d.campanas.length" class="ad-tabla__vacio">{{ $t('admin.empty') }}</div>
      </div>
    </section>

    <!-- ── El embudo y las cabezas ──────────────────────────────── -->
    <section class="ad-caja">
      <h2>{{ $t('admin.afi.heads') }}</h2>

      <div class="adso__embudo">
        <span v-for="(v, k) in d.embudo" :key="k" class="adso__paso">
          <em>{{ $t('admin.afi.st_' + k) }}</em>
          <b>{{ num(v) }}</b>
        </span>
      </div>

      <div class="ad-tabla">
        <div class="ad-tabla__scroll">
          <table>
            <thead>
              <tr>
                <th>{{ $t('admin.afi.player') }}</th>
                <th>{{ $t('admin.afi.campaign') }}</th>
                <th>{{ $t('admin.afi.state') }}</th>
                <th class="ad-der">{{ $t('admin.afi.pays') }}</th>
                <th class="ad-der">{{ $t('admin.afi.deposited') }}</th>
                <th class="ad-der">{{ $t('admin.afi.played') }}</th>
                <th class="ad-der">{{ $t('admin.afi.kyc') }}</th>
                <th>{{ $t('admin.afi.signals') }}</th>
                <th>{{ $t('admin.afi.releases') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in d.cabezas" :key="c._id">
                <td>{{ c.jugador }}</td>
                <td class="ad-tenue">{{ c.campana }}</td>
                <td><span class="ad-estado" :class="tono(c.estado)">{{ $t('admin.afi.st_' + c.estado) }}</span></td>
                <td class="ad-der">SC {{ plata(c.montoSc) }}</td>
                <td class="ad-der">SC {{ plata(c.depositadoSc) }}</td>
                <td class="ad-der">SC {{ plata(c.jugadoSc) }}</td>
                <td class="ad-der" :class="c.nivelKyc >= 2 ? 'ad-verde' : 'ad-rojo'">{{ c.nivelKyc }}</td>
                <td class="ad-tenue">{{ c.senales.join(' · ') || '—' }}</td>
                <td class="ad-tenue">{{ c.pagadoEl ? fecha(c.pagadoEl) : fecha(c.liberaEl) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="!d.cabezas.length" class="ad-tabla__vacio">{{ $t('admin.empty') }}</div>
      </div>
    </section>

    <!-- ── Lo que cobró y lo que le tocamos ─────────────────────── -->
    <div class="adso__dos">
      <section class="ad-caja">
        <h2>{{ $t('admin.afi.claims') }}</h2>
        <p>{{ $t('admin.afi.claimsHelp') }}</p>

        <div class="ad-tabla">
          <div class="ad-tabla__scroll">
            <table>
              <thead>
                <tr>
                  <th>{{ $t('admin.col.createdAt') }}</th>
                  <th>{{ $t('admin.afi.campaign') }}</th>
                  <th class="ad-der">{{ $t('admin.col.amountSc') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="t in d.cobros" :key="t._id">
                  <td class="ad-tenue">{{ fecha(t.cuando) }}</td>
                  <td>{{ t.label || '—' }}</td>
                  <td class="ad-der">SC {{ plata(t.amountSc) }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-if="!d.cobros.length" class="ad-tabla__vacio">{{ $t('admin.empty') }}</div>
        </div>
      </section>

      <section class="ad-caja">
        <h2>{{ $t('admin.afi.history') }}</h2>
        <p>{{ $t('admin.afi.historyHelp') }}</p>

        <div class="adso__log">
          <div v-for="l in d.historial" :key="l._id" class="adso__linea">
            <span class="adso__cuando">{{ fecha(l.cuando) }}</span>
            <span>
              <b>{{ l.admin }}</b> · {{ l.evento }}
              <em v-if="l.antes && l.despues && l.antes.nombre">
                {{ l.antes.nombre }} → {{ l.despues.nombre }}
              </em>
              <em v-if="l.motivo" class="adso__motivo-log">“{{ l.motivo }}”</em>
            </span>
          </div>

          <p v-if="!d.historial.length" class="ad-tabla__vacio">{{ $t('admin.empty') }}</p>
        </div>
      </section>
    </div>

    <!-- Tocar una campaña -->
    <mb-ventana
      v-if="campana" :titulo="campana.code" :sub="$t('admin.afi.editHelp')"
      @cerrar="campana = null"
    >
      <label class="ad-campo">
        {{ $t('admin.afi.model') }}
        <mb-elegir v-model="edicion.modelo" class="ad-elegir" :opciones="opcionesDeModelo" />
      </label>

      <label class="ad-campo">
        {{ $t('admin.afi.state') }}
        <mb-elegir v-model="edicion.activo" class="ad-elegir" :opciones="opcionesDeEstado" />
      </label>

      <label class="ad-campo">
        {{ $t('admin.afi.ownBonus') }}
        <input v-model="edicion.bonoPropio" class="ad-in" inputmode="decimal" placeholder="—">
        <span class="adso__ayuda">{{ $t('admin.afi.ownBonusHelp', { pct: d.rango.bonoPct }) }}</span>
      </label>

      <label class="ad-campo">
        {{ $t('admin.reason') }}
        <input v-model="motivoCampana" class="ad-in" maxlength="300">
      </label>

      <template #pie>
        <button type="button" class="ad-b ad-b--suave" @click="campana = null">
          {{ $t('admin.cancel') }}
        </button>
        <button
          type="button" class="ad-b" :disabled="motivoCampana.trim().length < 3"
          @click="guardarCampana"
        >{{ $t('admin.save') }}</button>
      </template>
    </mb-ventana>
  </div>
</template>

<script>
import api from "@/api";
import MbGema from "@/components/MbGema.vue";
import MbElegir from "@/components/MbElegir.vue";
import MbVentana from "@/components/MbVentana.vue";

/**
 * UN SOCIO POR DENTRO.
 *
 * Su rango, sus campañas, sus cabezas, lo que cobró y lo que el equipo
 * le tocó. Es la pantalla donde se otorga un rango, así que al lado del
 * botón están los dos números que importan: el margen que generó y lo
 * que ya se le pagó.
 *
 * LO QUE SE LE PAGO SALE DEL LIBRO
 *
 * No del contador de la campaña. El contador dice lo que debería haber
 * cobrado; el libro, lo que de verdad se le fue.
 */
export default {
  name: "AdminSocio",

  components: { MbGema, MbElegir, MbVentana },

  data() {
    return {
      d: null,
      nuevoRango: 1,
      motivo: "",
      dando: false,
      campana: null,
      edicion: { modelo: "hibrido", activo: true, bonoPropio: "" },
      motivoCampana: "",
    };
  },

  computed: {
    houseEdge() {
      /* El margen teórico que muestra la ficha sale del mismo house edge
         con el que se calcula el modelo. Se lee del servidor. */
      const n = this.d && this.d.numeros;
      if (!n || !n.jugadoSc) return 8;
      return Math.round((n.margenSc / n.jugadoSc) * 1000) / 10;
    },

    opcionesDeRango() {
      return ((this.d && this.d.escalera) || []).map((r) => ({
        valor: r.numero,
        texto: `${r.numero} · ${r.nombre}`,
        derecha: `SC ${r.cpaSc} · ${r.revsharePct}%`,
      }));
    },

    opcionesDeModelo() {
      return ["cpa", "revshare", "hibrido"].map((m) => ({
        valor: m, texto: this.$t("admin.afi.m_" + m),
      }));
    },

    opcionesDeEstado() {
      return [
        { valor: true, texto: this.$t("admin.state.active") },
        { valor: false, texto: this.$t("admin.state.off") },
      ];
    },
  },

  methods: {
    num(n) { return Number(n || 0).toLocaleString("en-US"); },
    plata(n) {
      return Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },
    pct(n) { return `${Math.round((Number(n) || 0) * 10) / 10}%`; },
    fecha(f) {
      return f ? new Date(f).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
    },

    tono(estado) {
      if (estado === "pagado" || estado === "califica") return "is-bien";
      if (estado === "anulado") return "is-mal";
      return "is-espera";
    },

    comoCobra(c) {
      if (c.modelo === "cpa") return `SC ${c.cobra.porCabezaSc}`;
      if (c.modelo === "hibrido") return `SC ${c.cobra.porCabezaSc} + ${c.cobra.pct}%`;
      return `${c.cobra.pct}%`;
    },

    abrirCampana(c) {
      this.campana = c;
      this.motivoCampana = "";
      this.edicion = {
        modelo: c.modelo,
        activo: c.activo,
        bonoPropio: c.bonoPropio === null ? "" : String(Math.round(c.bonoPropio * 1000) / 10),
      };
    },

    async guardarCampana() {
      try {
        const bono = String(this.edicion.bonoPropio).trim();
        await api.post(`/admin/affiliates/campaigns/${this.campana._id}`, {
          modelo: this.edicion.modelo,
          activo: this.edicion.activo,
          /* Vacío quiere decir "usá el del rango"; 0 quiere decir cero. */
          bonoPropio: bono === "" ? null : (Number(bono) || 0) / 100,
          motivo: this.motivoCampana,
        });
        this.campana = null;
        this.$store.dispatch("avisar", { texto: this.$t("admin.done") });
        await this.traer();
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      }
    },

    async dar() {
      this.dando = true;
      try {
        await api.post(`/admin/affiliates/${this.$route.params.userId}/rank`, {
          numero: this.nuevoRango,
          motivo: this.motivo,
        });
        this.motivo = "";
        this.$store.dispatch("avisar", { texto: this.$t("admin.done") });
        await this.traer();
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      } finally {
        this.dando = false;
      }
    },

    async traer() {
      try {
        const { data } = await api.get(`/admin/affiliates/${this.$route.params.userId}`);
        this.d = data.data;
        this.nuevoRango = data.data.rango.numero;
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      }
    },
  },

  watch: {
    "$route.params.userId"() { this.traer(); },
  },

  created() { this.traer(); },
};
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

.adso { display: flex; flex-direction: column; gap: 20px; }
.adso__volver { align-self: flex-start; font-weight: 800; font-size: 13px; text-decoration: none; color: $texto-4; &:hover { color: #fff; } }

.adso__cabeza { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
.adso__quien { flex: 1 1 320px; display: flex; flex-direction: column; gap: 4px; }
.adso__quien h1 { margin: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 10px; font-weight: 900; font-size: 26px; }
.adso__que { font-size: 14px; line-height: 1.5; color: $texto-3; }

/* ── El rango ─────────────────────────────────────────────────────── */

.adso__rango { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px; }

.adso__ahora {
  display: flex;
  align-items: center;
  gap: 12px;

  > span { display: flex; flex-direction: column; gap: 2px; }
  b { font-weight: 900; font-size: 20px; }
  em { font-style: normal; font-weight: 700; font-size: 12px; color: $texto-4; }
}

.adso__dar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.adso__motivo { min-width: 240px; flex: 1; }

/* ── Las campañas ─────────────────────────────────────────────────── */

.adso__nombre { display: block; font-style: normal; font-size: 11px; color: $texto-4; }
.adso__amano { display: block; margin-top: 2px; font-style: normal; font-size: 10px; color: $amarillo; }

.adso__m {
  padding: 2px 7px;
  border-radius: 999px;
  font-weight: 900;
  font-size: 10px;
  background: #1d3354;

  &.is-cpa { background: rgba(255, 211, 90, .14); color: $amarillo; }
  &.is-revshare { background: rgba(63, 155, 255, .16); color: #8fb4ff; }
  &.is-hibrido { background: rgba(93, 255, 176, .14); color: $verde; }
}

/* ── El embudo ────────────────────────────────────────────────────── */

.adso__embudo { display: flex; flex-wrap: wrap; gap: 8px; }

.adso__paso {
  padding: 10px 14px;
  border-radius: 12px;
  background: $panel;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 110px;

  em { font-style: normal; font-weight: 900; font-size: 10px; letter-spacing: .1em; color: $texto-4; text-transform: uppercase; }
  b { font-weight: 900; font-size: 20px; }
}

/* ── Lo de abajo ──────────────────────────────────────────────────── */

.adso__dos { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr)); gap: 20px; align-items: start; }

.adso__log { display: flex; flex-direction: column; gap: 10px; }

.adso__linea {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid #1a2a45;
  font-weight: 700;
  font-size: 13px;

  &:last-child { border-bottom: 0; }
  em { display: block; font-style: normal; color: $texto-4; }
}

.adso__cuando { min-width: 110px; color: $texto-4; }
.adso__motivo-log { color: $texto-3; }
.adso__ayuda { font-weight: 700; font-size: 12px; color: $texto-4; }
</style>
