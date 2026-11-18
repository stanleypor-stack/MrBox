<template>
  <div v-if="d" class="adc">
    <div class="adc__cabeza">
      <div class="adc__quien">
        <h1>
          {{ $t('admin.race.title', { tipo: c.tipo }) }}
          <span class="ad-estado" :class="c.estado === 'live' ? 'is-bien' : ''">{{ c.estado }}</span>
        </h1>
        <span class="ad-tenue">{{ $t('admin.race.window', { desde: fechaHora(c.desde), hasta: fechaHora(c.hasta) }) }}</span>
        <span v-if="c.cerradaEl" class="ad-tenue">{{ $t('admin.race.closedAt', { fecha: fechaHora(c.cerradaEl) }) }}</span>
      </div>

      <router-link to="/admin/races" class="ad-b ad-b--suave">{{ $t('admin.back') }}</router-link>
    </div>

    <div class="ad-nums">
      <div class="ad-num"><span>{{ $t('admin.race.pool') }}</span><b>SC {{ plata(c.premioTotalSc) }}</b></div>
      <div class="ad-num"><span>{{ $t('admin.race.places') }}</span><b>{{ c.reparto.length }}</b></div>
      <div class="ad-num"><span>{{ $t('admin.race.players') }}</span><b>{{ num(n.jugadores) }}</b></div>
      <div class="ad-num"><span>{{ $t('admin.race.wagered') }}</span><b>SC {{ plata(n.jugadoSc) }}</b></div>
      <div class="ad-num"><span>{{ $t('admin.race.shareOut') }}</span><b>SC {{ plata(n.repartidoSc) }}</b></div>
      <div class="ad-num">
        <span>{{ $t('admin.race.paidOut') }}</span>
        <b :class="n.sinPagar ? 'ad-rojo' : ''">SC {{ plata(n.pagadoSc) }}</b>
        <em v-if="n.sinPagar">{{ $t('admin.race.unpaid') }}: {{ n.sinPagar }}</em>
      </div>
    </div>

    <section v-if="c.estado === 'live'" class="ad-caja">
      <h2>{{ $t('admin.race.settle') }}</h2>
      <p>{{ $t('admin.race.settleHelp') }}</p>
      <button type="button" class="ad-b ad-b--mal" :disabled="ocupado" @click="cerrar">
        {{ $t('admin.race.settle') }}
      </button>
    </section>

    <p class="ad-aviso">
      {{ c.estado === 'live' ? $t('admin.race.leaderboardLive') : $t('admin.race.leaderboardDone') }}
    </p>

    <div class="ad-tabla">
      <h2 class="adc__t">{{ $t('admin.race.leaderboard') }}</h2>

      <div class="ad-tabla__scroll">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>{{ $t('admin.col.username') }}</th>
              <th class="ad-der">{{ $t('admin.col.jugadoSc') }}</th>
              <th class="ad-der">{{ $t('admin.race.prize') }}</th>
              <th class="ad-der">{{ $t('admin.race.paid') }}</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            <tr v-for="p in d.puestos" :key="p.puesto">
              <td class="adc__puesto" :class="'is-' + p.puesto">{{ p.puesto }}</td>
              <td>
                <router-link class="adc__link" :to="`/admin/players/${p.user}`">{{ p.username }}</router-link>
              </td>
              <td class="ad-der">SC {{ plata(p.jugadoSc) }}</td>
              <td class="ad-der" :class="p.premioSc > 0 ? 'ad-amarillo' : 'ad-tenue'">
                {{ p.premioSc > 0 ? 'SC ' + plata(p.premioSc) : '—' }}
              </td>
              <td class="ad-der" :class="p.sinPagar ? 'ad-rojo' : 'ad-verde'">
                {{ p.cobradoSc === null ? $t('admin.race.notYet') : 'SC ' + plata(p.cobradoSc) }}
              </td>
              <td>
                <button
                  v-if="p.sinPagar" type="button" class="ad-b ad-b--chico"
                  :disabled="ocupado" @click="pagar(p)"
                >{{ $t('admin.race.payNow') }}</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p v-if="!d.puestos.length" class="ad-tabla__vacio">{{ $t('admin.race.empty') }}</p>
    </div>

    <p v-if="n.sinPagar" class="ad-aviso">{{ $t('admin.race.payHelp') }}</p>
  </div>
</template>

<script>
import api from "@/api";

/**
 * UNA CARRERA, POR DENTRO.
 *
 * La lista dice cuáles hay; esta pantalla dice lo que pasa adentro de
 * una: quién va ganando ahora mismo, cuánto le toca a cada puesto y
 * --si ya cerró-- quién cobró de verdad.
 *
 * LA COLUMNA "PAID" SALE DEL LIBRO
 *
 * No de la lista de ganadores. Esa dice lo que TENIA que cobrar cada
 * uno; el libro dice lo que se le movió. Cuando un pago falla al
 * cerrar, la diferencia se ve acá en rojo y se paga con el botón, en
 * vez de descubrirla cuando el jugador escriba preguntando.
 */
export default {
  name: "AdminCarrera",

  data() { return { d: null, ocupado: false }; },

  computed: {
    c() { return this.d.carrera; },
    n() { return this.d.numeros; },
  },

  methods: {
    plata(n) {
      return Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },
    num(n) { return Number(n || 0).toLocaleString("en-US"); },
    fechaHora(d) {
      return d ? new Date(d).toLocaleString(this.$i18n.locale, {
        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
      }) : "—";
    },

    async traer() {
      try {
        const { data } = await api.get(`/admin/races/${this.$route.params.id}`);
        this.d = data.data;
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
        this.$router.push("/admin/races");
      }
    },

    async cerrar() {
      const motivo = window.prompt(this.$t("admin.race.whySettle"));
      if (motivo === null) return;
      if (String(motivo).trim().length < 3) {
        this.$store.dispatch("avisar", { texto: this.$t("error.REASON_REQUIRED"), tono: "error" });
        return;
      }

      this.ocupado = true;
      try {
        await api.post(`/admin/races/${this.c._id}/settle`, { motivo: String(motivo).trim() });
        this.$store.dispatch("avisar", { texto: this.$t("admin.done") });
        await this.traer();
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      } finally {
        this.ocupado = false;
      }
    },

    async pagar(p) {
      this.ocupado = true;
      try {
        await api.post(`/admin/races/${this.c._id}/pay/${p.user}`, {});
        this.$store.dispatch("avisar", { texto: this.$t("admin.done") });
        await this.traer();
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      } finally {
        this.ocupado = false;
      }
    },
  },

  created() { this.traer(); },
};
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

.adc { display: flex; flex-direction: column; gap: 20px; }
.adc__cabeza { display: flex; flex-wrap: wrap; align-items: center; gap: 16px; }
.adc__quien { flex: 1 1 320px; display: flex; flex-direction: column; gap: 4px; font-size: 13px; }

.adc__quien h1 {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 900;
  font-size: 26px;
  text-transform: capitalize;
}

.adc__t { margin: 0; padding: 14px 16px; font-weight: 900; font-size: 15px; border-bottom: 1px solid $borde; }

/* El podio se lee de un vistazo: oro, plata y bronce. */
.adc__puesto {
  font-weight: 900;
  font-variant-numeric: tabular-nums;

  &.is-1 { color: $amarillo-v; }
  &.is-2 { color: #cdd7e6; }
  &.is-3 { color: #d79a5b; }
}

.adc__link { color: inherit; font-weight: 800; }
.ad-tenue { color: $texto-4; }
</style>
