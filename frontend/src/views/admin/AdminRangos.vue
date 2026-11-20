<template>
  <div v-if="d" class="adr">
    <div class="adr__cabeza">
      <div class="adr__quien">
        <h1>{{ $t('admin.nav.ranks') }}</h1>
        <span class="adr__que">{{ $t('admin.what.ranks') }}</span>
      </div>

      <button type="button" class="ad-b ad-b--grande" :disabled="!hayCambios || guardando" @click="guardar">
        {{ guardando ? $t('admin.loading') : $t('admin.save') }}
      </button>
    </div>

    <div class="ad-nums">
      <div class="ad-num"><span>{{ $t('admin.rank.players') }}</span><b>{{ num(d.jugadores) }}</b></div>
      <div class="ad-num">
        <span>{{ $t('admin.num.aboveBronze') }}</span>
        <b>{{ num(d.conRango) }}</b>
        <em>{{ pct(d.conRango / (d.jugadores || 1) * 100) }}</em>
      </div>
      <div class="ad-num"><span>{{ $t('admin.num.rakebackPaid') }}</span><b>SC {{ plata(d.rakebackSc) }}</b></div>
      <div class="ad-num"><span>{{ $t('admin.num.claims') }}</span><b>{{ num(d.reclamos) }}</b></div>
      <div class="ad-num">
        <span>{{ $t('admin.rank.wagered') }}</span>
        <b>SC {{ plata(totales.jugadoSc) }}</b>
      </div>
      <div class="ad-num">
        <span>{{ $t('admin.rank.giveBack') }}</span>
        <b :class="devuelto > 8 ? 'ad-rojo' : ''">{{ pct(devuelto) }}</b>
        <em>{{ $t('admin.rank.giveBackHelp') }}</em>
      </div>
    </div>

    <p class="ad-aviso">{{ $t('admin.help.ranks') }}</p>

    <!-- ── La tabla: lo que se edita y lo que cuenta ─────────────── -->
    <div class="ad-t">
      <div class="ad-t__scroll">
        <div class="ad-t__ancho adr__ancho">
          <div class="ad-t__cab adr__fila">
            <span>{{ $t('admin.col.rango') }}</span>
            <span class="ad-der">{{ $t('admin.col.desdeSc') }}</span>
            <span class="ad-der">{{ $t('admin.rank.daily') }}</span>
            <span class="ad-der">{{ $t('admin.rank.weekly') }}</span>
            <span class="ad-der">{{ $t('admin.rank.monthly') }}</span>
            <span class="ad-der">{{ $t('admin.col.beneficios') }}</span>
            <span class="ad-der">{{ $t('admin.col.jugadores') }}</span>
            <span class="ad-der">{{ $t('admin.rank.theirWager') }}</span>
            <span class="ad-der">{{ $t('admin.rank.theirDeposits') }}</span>
            <span class="ad-der">{{ $t('admin.rank.theirRakeback') }}</span>
            <span class="ad-der">{{ $t('admin.rank.each') }}</span>
          </div>

          <div v-for="(f, i) in filas" :key="f.rango" class="ad-t__fila adr__fila">
            <span class="adr__quien-rango">
              <MbGema :numero="i + 1" :lado="26" />
              <input v-model="f.rango" class="ad-in adr__in adr__in--nombre">
            </span>

            <span class="ad-der"><input v-model="f.desdeSc" class="ad-in adr__in" inputmode="decimal"></span>
            <span class="ad-der"><input v-model="f.rakebackDiarioPct" class="ad-in adr__in" inputmode="decimal"></span>
            <span class="ad-der"><input v-model="f.rakebackPct" class="ad-in adr__in" inputmode="decimal"></span>
            <span class="ad-der"><input v-model="f.rakebackMensualPct" class="ad-in adr__in" inputmode="decimal"></span>

            <span class="ad-der">{{ f.beneficios }} / {{ (d.beneficios || []).length }}</span>

            <span class="ad-der">
              {{ num(f.jugadores) }}
              <em class="adr__parte">{{ pct(f.parte) }}</em>
            </span>

            <span class="ad-der">SC {{ plata(f.jugadoSc) }}</span>
            <span class="ad-der">SC {{ plata(f.compradoSc) }}</span>
            <span class="ad-der" :class="f.rakebackSc > 0 ? 'ad-amarillo' : 'ad-tenue'">SC {{ plata(f.rakebackSc) }}</span>
            <span class="ad-der ad-tenue">SC {{ plata(f.porCabezaSc) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Qué desbloquea cada rango ────────────────────────────── -->
    <section class="ad-caja">
      <h2>{{ $t('admin.rank.benefits') }}</h2>
      <p>{{ $t('admin.rank.benefitsHelp') }}</p>

      <div class="ad-tabla">
        <div class="ad-tabla__scroll">
          <table>
            <thead>
              <tr>
                <th>{{ $t('admin.col.beneficios') }}</th>
                <th v-for="(f, i) in filas" :key="f.rango" class="adr__cab-rango">
                  <MbGema :numero="i + 1" :lado="18" />
                  {{ f.rango }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(b, k) in (d.beneficios || [])" :key="b">
                <td>{{ $t('admin.benefit.' + b) }}</td>
                <td v-for="(f, i) in filas" :key="f.rango + b" class="ad-der">
                  <span :class="k < f.beneficios ? 'ad-verde' : 'ad-tenue'">{{ k < f.beneficios ? '✓' : '—' }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- ── El rango puesto a mano ──────────────────────────────── -->
    <section class="ad-caja">
      <h2>{{ $t('admin.rank.byHand') }}</h2>
      <p>{{ $t('admin.rank.byHandHelp') }}</p>

      <div class="adr__mano">
        <label class="ad-campo adr__buscar">
          {{ $t('admin.rank.whoFor') }}
          <input
            v-model="busca" class="ad-in" :placeholder="$t('admin.rank.whoForPh')"
            @keyup.enter="buscar"
          >
        </label>
        <button type="button" class="ad-b" :disabled="buscando" @click="buscar">
          {{ buscando ? $t('admin.loading') : $t('admin.rank.find') }}
        </button>
      </div>

      <p v-if="sinResultado" class="ad-tenue">{{ $t('admin.rank.noone') }}</p>

      <div v-if="elegido" class="adr__elegido">
        <div class="adr__quien">
          <b>{{ elegido.username }}</b>
          <span class="ad-tenue">{{ elegido.email }}</span>
          <span class="ad-tenue">{{ $t('admin.player.tierNow', { rango: elegido.rango }) }}</span>
        </div>

        <MbElegir
          v-model="rango" chico class="ad-elegir"
          :opciones="opcionesDeRango"
        />

        <label class="ad-campo">
          {{ $t('admin.reason') }}
          <input v-model="motivo" class="ad-in" :placeholder="$t('admin.player.reasonExample')">
        </label>

        <button
          type="button" class="ad-b"
          :disabled="moviendo || (!!rango && motivo.trim().length < 3)" @click="moverRango"
        >{{ $t('admin.save') }}</button>
      </div>
    </section>
  </div>
</template>

<script>
import api from "@/api";
import MbGema from "@/components/MbGema.vue";
import MbElegir from "@/components/MbElegir.vue";

/**
 * LOS NUEVE RANGOS.
 *
 * Se editan ENTEROS y se guardan de una: los valores se miran entre
 * ellos --un rango tiene que pedir más que el anterior-- y guardarlos
 * de a uno deja estados imposibles en el medio.
 *
 * AL LADO DE LO QUE SE EDITA, LO QUE PASA
 *
 * Cuánta gente hay en cada rango, cuánto juega, cuánto deposita y
 * cuánto se le devuelve. Sin eso, subir un rakeback del 5% al 7% es
 * una corazonada; con eso se ve en pesos lo que cuesta.
 */
export default {
  name: "AdminRangos",

  components: { MbGema, MbElegir },

  data() {
    return {
      d: null,
      filas: [],
      original: "",
      guardando: false,

      /* El rango a mano, al final de la pagina. */
      busca: "",
      buscando: false,
      sinResultado: false,
      elegido: null,
      rango: "",
      motivo: "",
      moviendo: false,
    };
  },

  computed: {
    /* Los nueve rangos mas "automatico", que es sacarle el manual. */
    opcionesDeRango() {
      const nombres = this.filas.map((f) => f.rango);
      return [{ valor: "", texto: this.$t("admin.player.tierAuto") }]
        .concat(nombres.map((r) => ({ valor: r, texto: r })));
    },

    hayCambios() { return JSON.stringify(this.filas) !== this.original; },

    totales() {
      return this.filas.reduce((t, f) => ({
        jugadoSc: t.jugadoSc + Number(f.jugadoSc || 0),
        rakebackSc: t.rakebackSc + Number(f.rakebackSc || 0),
      }), { jugadoSc: 0, rakebackSc: 0 });
    },

    /* Qué parte de lo jugado vuelve como rakeback. */
    devuelto() {
      const j = this.totales.jugadoSc;
      return j ? (this.totales.rakebackSc / j) * 100 : 0;
    },
  },

  methods: {
    /** Busca al jugador por nombre, correo o id. */
    async buscar() {
      const texto = this.busca.trim();
      if (!texto) return;

      this.buscando = true;
      this.sinResultado = false;
      try {
        const { data } = await api.get("/admin/players", { params: { q: texto, perPage: 1 } });
        const uno = (data.data.items || [])[0];

        if (!uno) {
          this.elegido = null;
          this.sinResultado = true;
          return;
        }

        this.elegido = uno;
        this.rango = uno.rangoManual || "";
        this.motivo = "";
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      } finally {
        this.buscando = false;
      }
    },

    /* El mismo endpoint que usa la ficha del jugador: una sola manera
       de mover un rango, no dos que se puedan desincronizar. */
    async moverRango() {
      this.moviendo = true;
      try {
        await api.post(`/admin/players/${this.elegido._id}/tier`, {
          rango: this.rango,
          motivo: this.motivo.trim(),
        });
        this.$store.dispatch("avisar", { texto: this.$t("admin.done") });
        await this.buscar();
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      } finally {
        this.moviendo = false;
      }
    },

    num(n) { return Number(n || 0).toLocaleString("en-US"); },
    plata(n) {
      return Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },
    pct(n) { return `${Math.round((Number(n) || 0) * 10) / 10}%`; },

    async traer() {
      try {
        const { data } = await api.get("/admin/ranks");
        this.d = data.data;
        this.filas = data.data.items.map((r) => ({ ...r }));
        this.original = JSON.stringify(this.filas);
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      }
    },

    async guardar() {
      this.guardando = true;
      try {
        await api.put("/admin/ranks", {
          rangos: this.filas.map((f) => ({
            nombre: f.rango,
            desde: Number(f.desdeSc) || 0,
            color: f.color,
            rakebackDiario: (Number(f.rakebackDiarioPct) || 0) / 100,
            rakebackSemanal: (Number(f.rakebackPct) || 0) / 100,
            rakebackMensual: (Number(f.rakebackMensualPct) || 0) / 100,
          })),
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
.adr__mano { display: flex; gap: 10px; align-items: flex-end; flex-wrap: wrap; margin-top: 12px; }
.adr__buscar { flex: 1 1 240px; min-width: 0; }
.adr__elegido { display: grid; gap: 10px; margin-top: 14px; max-width: 420px; }
.adr__quien { display: grid; gap: 2px; font-size: 13.5px; }

@import "@/styles/tokens";

.adr { display: flex; flex-direction: column; gap: 20px; }
.adr__cabeza { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
.adr__quien { flex: 1 1 320px; display: flex; flex-direction: column; gap: 4px; }
.adr__quien h1 { margin: 0; font-weight: 900; font-size: 26px; }
.adr__que { max-width: 680px; font-size: 14px; line-height: 1.5; color: $texto-3; }

.adr__ancho { min-width: 1240px; }
.adr__fila { grid-template-columns: 1.5fr .9fr .7fr .7fr .8fr .7fr .9fr 1.1fr 1.1fr 1.1fr 1fr; }

.adr__quien-rango { display: flex; align-items: center; gap: 8px; }
.adr__in { width: 100%; height: 34px; box-sizing: border-box; font-size: 13px; text-align: right; }
.adr__in--nombre { text-align: left; }
.adr__parte { display: block; font-size: 11px; font-style: normal; color: $texto-4; }
.adr__cab-rango { white-space: nowrap; }
.adr__cab-rango .mb-gema { display: inline-block; vertical-align: -3px; margin-right: 4px; }

.ad-tenue { color: $texto-4; }
</style>
