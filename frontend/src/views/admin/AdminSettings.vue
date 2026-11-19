<template>
  <div v-if="cfg" class="adc">
    <div class="adc__cabeza">
      <div class="adc__quien">
        <h1>{{ $t('admin.nav.settings') }}</h1>
        <span class="adc__que">{{ $t('admin.what.settings') }}</span>
      </div>

      <button type="button" class="ad-b ad-b--grande" :disabled="!esDueno || guardando || !hayCambios" @click="guardar">
        {{ guardando ? $t('admin.loading') : $t('admin.save') }}
      </button>
    </div>

    <p v-if="!esDueno" class="ad-aviso">{{ $t('admin.onlyOwner') }}</p>

    <section v-for="g in GRUPOS" :key="g.titulo" class="ad-caja">
      <h2>{{ $t(g.titulo) }}</h2>

      <div class="adc__campos">
        <label v-for="c in g.campos" :key="c.ruta" class="adc__campo">
          <span class="adc__rotulo">{{ $t('admin.set.' + c.id) }}</span>

          <MbElegir
            v-if="c.tipo === 'siNo'" chico class="ad-elegir" :deshabilitado="!esDueno"
            :value="!!leer(c.ruta)"
            :opciones="[{ valor: true, texto: $t('admin.state.on') }, { valor: false, texto: $t('admin.state.off') }]"
            @input="poner(c, $event)"
          />

          <input
            v-else class="ad-in" :disabled="!esDueno"
            :inputmode="c.tipo === 'texto' ? 'text' : 'decimal'"
            :value="mostrar(c)" @change="poner(c, $event.target.value)"
          >

          <span class="adc__ayuda">{{ $t('admin.setHelp.' + c.id) }}</span>
        </label>
      </div>
    </section>
  </div>
</template>

<script>
import MbElegir from "@/components/MbElegir.vue";
import { mapState } from "vuex";
import api from "@/api";

/**
 * LAS PERILLAS DEL SITIO.
 *
 * Las del diseño, agrupadas: el sitio, las cajas, la comunidad, los
 * regalos, los canjes, Deals, las carreras, soporte y la cinta de Live
 * Pulls.
 *
 * LOS PORCENTAJES SE ESCRIBEN COMO PORCENTAJES
 *
 * Adentro, el retorno es 0,92. Nadie escribe "0,92" cuando quiere decir
 * noventa y dos por ciento, así que el campo muestra 92 y la pantalla
 * hace la cuenta. Es el mismo motivo por el que el editor de cajas pide
 * la chance en por ciento.
 *
 * SOLO EL DUEÑO GUARDA
 *
 * El servidor es el que manda --`soloAdmin(["owner"])` en la ruta-- y
 * acá los campos se ven igual, apagados. Esconder la pantalla haría que
 * un admin no pueda ni MIRAR con qué números está corriendo el sitio,
 * que es justo lo que necesita para contestarle a alguien.
 */
const GRUPOS = [
  {
    titulo: "admin.setGroup.site",
    campos: [
      { id: "siteName", ruta: "siteName", tipo: "texto" },
      { id: "maintenance", ruta: "maintenance", tipo: "siNo" },
    ],
  },
  {
    titulo: "admin.setGroup.boxes",
    campos: [
      { id: "returnTarget", ruta: "retornoObjetivo", tipo: "pct" },
      { id: "payoutCap", ruta: "topePremioSc", tipo: "numero" },
      { id: "atOnce", ruta: "cajasALaVez", tipo: "numero" },
      { id: "sellBack", ruta: "tasaDeRecompra", tipo: "pct" },
    ],
  },
  {
    titulo: "admin.setGroup.community",
    campos: [
      { id: "creatorShare", ruta: "parteDelCreador", tipo: "pct" },
      { id: "minItems", ruta: "objetosPorCajaDeComunidad.min", tipo: "numero" },
      { id: "maxItems", ruta: "objetosPorCajaDeComunidad.max", tipo: "numero" },
    ],
  },
  {
    titulo: "admin.setGroup.gifts",
    campos: [
      { id: "signupOpens", ruta: "aperturasDeRegalo", tipo: "numero" },
      { id: "demoOpens", ruta: "aperturasDeDemo", tipo: "numero" },
      { id: "bonusNormal", ruta: "bonoPorDeposito.normal", tipo: "pct" },
      { id: "bonusBig", ruta: "bonoPorDeposito.destacado", tipo: "pct" },
      { id: "playBonus", ruta: "vecesAJugarElBono", tipo: "numero" },
    ],
  },
  {
    titulo: "admin.setGroup.cashier",
    campos: [
      { id: "minRedemption", ruta: "canjeMinimoSc", tipo: "numero" },
      { id: "kycLevel", ruta: "canjeNivelMinimo", tipo: "numero" },
      { id: "shipLevel3", ruta: "envioQuePideNivel3Sc", tipo: "numero" },
    ],
  },
  {
    titulo: "admin.setGroup.deals",
    campos: [
      { id: "chanceMin", ruta: "deals.chanceMinima", tipo: "pct" },
      { id: "chanceMax", ruta: "deals.chanceMaxima", tipo: "pct" },
      { id: "houseMargin", ruta: "deals.margen", tipo: "pct" },
      { id: "wheels", ruta: "deals.ruedasALaVez", tipo: "numero" },
      { id: "freeTries", ruta: "deals.tiradasGratisPorItem", tipo: "numero" },
    ],
  },
  {
    titulo: "admin.setGroup.races",
    campos: [
      { id: "poolDaily", ruta: "pozosDeCarrera.daily", tipo: "numero" },
      { id: "poolWeekly", ruta: "pozosDeCarrera.weekly", tipo: "numero" },
      { id: "poolMonthly", ruta: "pozosDeCarrera.monthly", tipo: "numero" },
    ],
  },
  {
    titulo: "admin.setGroup.support",
    campos: [
      { id: "autoReply", ruta: "soporte.respuestaAutomatica", tipo: "siNo" },
      { id: "hours", ruta: "soporte.horarioMostrado", tipo: "texto" },
    ],
  },
  {
    titulo: "admin.setGroup.pulls",
    campos: [
      { id: "fillerOn", ruta: "pulls.relleno", tipo: "siNo" },
      { id: "perMinute", ruta: "pulls.porMinuto", tipo: "numero" },
      { id: "cheapPct", ruta: "pulls.baratosPct", tipo: "numero" },
      { id: "cheapUpTo", ruta: "pulls.topeSc", tipo: "numero" },
    ],
  },
];

export default {
  name: "AdminSettings",

  components: { MbElegir },

  data() { return { GRUPOS, cfg: null, cambios: {}, guardando: false }; },

  computed: {
    ...mapState(["usuario"]),
    esDueno() { return this.usuario && this.usuario.rank === "owner"; },
    hayCambios() { return Object.keys(this.cambios).length > 0; },
  },

  methods: {
    leer(ruta) {
      if (this.cambios[ruta] !== undefined) return this.cambios[ruta];
      return ruta.split(".").reduce((o, k) => (o == null ? undefined : o[k]), this.cfg);
    },

    /** Un porcentaje se escribe 92, no 0,92. */
    mostrar(c) {
      const v = this.leer(c.ruta);
      if (c.tipo === "pct") return v === undefined ? "" : Math.round(Number(v) * 10000) / 100;
      return v === undefined ? "" : v;
    },

    poner(c, valor) {
      if (c.tipo === "siNo") { this.$set(this.cambios, c.ruta, !!valor); return; }
      if (c.tipo === "texto") { this.$set(this.cambios, c.ruta, String(valor)); return; }

      const n = Number(String(valor).replace(",", "."));
      if (!Number.isFinite(n)) return;
      this.$set(this.cambios, c.ruta, c.tipo === "pct" ? Math.round(n * 100) / 10000 : n);
    },

    async traer() {
      try {
        const { data } = await api.get("/admin/settings");
        this.cfg = data.data;
        this.cambios = {};
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      }
    },

    /**
     * Guarda SOLO lo que se tocó.
     *
     * Mandar el documento entero pisaría con valores viejos lo que otra
     * persona haya cambiado mientras esta pantalla estaba abierta.
     */
    async guardar() {
      this.guardando = true;
      try {
        /* Las rutas con punto se vuelven a armar como objeto. */
        const cuerpo = {};
        for (const [ruta, valor] of Object.entries(this.cambios)) {
          const partes = ruta.split(".");
          let nodo = cuerpo;
          for (let i = 0; i < partes.length - 1; i += 1) {
            nodo[partes[i]] = nodo[partes[i]] || {};
            nodo = nodo[partes[i]];
          }
          nodo[partes[partes.length - 1]] = valor;
        }

        const { data } = await api.put("/admin/settings", cuerpo);
        this.cfg = data.data;
        this.cambios = {};
        this.$store.dispatch("avisar", { texto: this.$t("admin.done") });
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

.adc { display: flex; flex-direction: column; gap: 20px; }

.adc__cabeza { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
.adc__quien { flex: 1 1 320px; display: flex; flex-direction: column; gap: 4px; }
.adc__quien h1 { margin: 0; font-weight: 900; font-size: 26px; }
.adc__que { max-width: 680px; font-size: 14px; line-height: 1.5; color: $texto-3; }

.adc__campos { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(260px, 100%), 1fr)); gap: 16px; }
.adc__campo { display: flex; flex-direction: column; gap: 6px; }
.adc__rotulo { font-weight: 800; font-size: 13px; }
.adc__ayuda { font-size: 12px; line-height: 1.4; color: $texto-3; }
</style>
