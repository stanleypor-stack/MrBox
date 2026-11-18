<template>
  <div v-if="d" class="adj">
    <!-- ── Quién es ─────────────────────────────────────────────── -->
    <div class="adj__cabeza">
      <span class="adj__avatar">{{ inicial }}</span>

      <div class="adj__quien">
        <span class="adj__nombre">
          {{ j.username }}
          <span v-if="j.banned" class="ad-estado is-mal">{{ $t('admin.state.banned') }}</span>
          <span v-if="j.rank !== 'user'" class="ad-estado">{{ j.rank }}</span>
        </span>
        <span class="ad-tenue">{{ j.email }}</span>
        <span class="ad-tenue">
          {{ $t('admin.player.since', { fecha: fecha(j.createdAt) }) }}
          · {{ $t('admin.player.lastSeen', { fecha: j.lastSeenAt ? fechaHora(j.lastSeenAt) : '—' }) }}
        </span>
      </div>

      <router-link to="/admin/players" class="ad-b ad-b--suave">{{ $t('common.back') }}</router-link>
    </div>

    <!-- ── Sus números ──────────────────────────────────────────── -->
    <div class="ad-nums">
      <div class="ad-num">
        <span>{{ $t('common.balance') }}</span>
        <b>SC {{ plata(j.balanceSc) }}</b>
        <em v-if="j.bonoPendienteSc > 0">{{ $t('admin.player.bonusLocked', { amount: plata(j.bonoPendienteSc) }) }}</em>
      </div>
      <div class="ad-num"><span>{{ $t('profile.wagered') }}</span><b>SC {{ plata(j.jugadoSc) }}</b></div>
      <div class="ad-num"><span>{{ $t('admin.dash.opensShort') }}</span><b>{{ num(d.aperturas) }}</b></div>
      <div class="ad-num">
        <span>{{ $t('inventory.title') }}</span>
        <b>SC {{ plata(d.inventario.valorSc) }}</b>
        <em>{{ $t('box.items', { n: d.inventario.cuantos }) }}</em>
      </div>
      <div class="ad-num"><span>{{ $t('nav.verification') }}</span><b>{{ $t('admin.player.level', { n: j.verificationLevel }) }}</b></div>
      <div class="ad-num"><span>{{ $t('common.freeOpens') }}</span><b>{{ num(j.freeOpens) }}</b></div>
    </div>

    <!-- ── Lo que se puede hacer ────────────────────────────────── -->
    <div class="adj__dos">
      <section class="ad-caja">
        <h2>{{ $t('admin.player.adjust') }}</h2>
        <p>{{ $t('admin.player.adjustHelp') }}</p>

        <div class="ad-fila">
          <label class="ad-campo">
            {{ $t('profile.amount') }}
            <input v-model="monto" class="ad-in" inputmode="decimal" placeholder="25.00 / -25.00">
          </label>
          <label class="ad-campo ad-crece">
            {{ $t('admin.reason') }}
            <input v-model="motivo" class="ad-in" :placeholder="$t('admin.player.reasonExample')">
          </label>
        </div>

        <button type="button" class="ad-b" :disabled="!sePuedeAjustar || ocupado" @click="ajustar">
          {{ $t('admin.player.apply') }}
        </button>
      </section>

      <section class="ad-caja">
        <h2>{{ $t('admin.player.account') }}</h2>
        <p>{{ $t('admin.player.banHelp') }}</p>

        <button
          type="button" class="ad-b" :class="j.banned ? '' : 'ad-b--mal'"
          :disabled="ocupado" @click="alternarCuenta"
        >{{ j.banned ? $t('admin.act.unban') : $t('admin.act.ban') }}</button>

        <div v-if="d.verificaciones.length" class="adj__kyc">
          <span class="ad-tenue">{{ $t('nav.verification') }}</span>
          <div v-for="v in d.verificaciones" :key="v.nivel" class="adj__kyc-fila">
            <span>{{ $t('profile.level' + v.nivel) }}</span>
            <span class="ad-estado" :class="tono(v.estado)">{{ $t('kyc.state.' + v.estado) }}</span>
          </div>
        </div>
      </section>
    </div>

    <!-- ── Sus códigos ──────────────────────────────────────────── -->
    <section v-if="d.codigos.length" class="ad-tabla">
      <div class="ad-tabla__scroll">
        <table>
          <thead>
            <tr>
              <th>{{ $t('profile.code') }}</th>
              <th class="ad-der">{{ $t('profile.players') }}</th>
              <th class="ad-der">{{ $t('profile.earned') }}</th>
              <th class="ad-der">{{ $t('admin.col.cobradoSc') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in d.codigos" :key="c.code">
              <td>{{ c.code }}</td>
              <td class="ad-der">{{ num(c.jugadores) }}</td>
              <td class="ad-der">SC {{ plata(c.ganadoSc) }}</td>
              <td class="ad-der">SC {{ plata(c.cobradoSc) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- ── Su extracto ──────────────────────────────────────────── -->
    <section class="ad-tabla">
      <div class="ad-tabla__scroll">
        <table>
          <thead>
            <tr>
              <th>{{ $t('profile.when') }}</th>
              <th>{{ $t('profile.what') }}</th>
              <th class="ad-der">{{ $t('profile.amount') }}</th>
              <th class="ad-der">{{ $t('common.balance') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in d.movimientos" :key="m._id">
              <td class="ad-tenue">{{ fechaHora(m.createdAt) }}</td>
              <td>
                {{ $t('txType.' + m.type) }}
                <span v-if="m.label || m.reason" class="ad-tenue">· {{ m.label || m.reason }}</span>
              </td>
              <td class="ad-der" :class="m.amountSc >= 0 ? 'ad-verde' : 'ad-rojo'">
                {{ m.amountSc >= 0 ? '+' : '' }}{{ plata(m.amountSc) }}
              </td>
              <td class="ad-der ad-tenue">{{ plata(m.balanceAfter) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="!d.movimientos.length" class="ad-tabla__vacio">{{ $t('profile.noTransactions') }}</p>
    </section>
  </div>
</template>

<script>
import api from "@/api";

/**
 * LA FICHA DE UN JUGADOR.
 *
 * Lo que hace falta para contestarle a alguien que escribe: su saldo,
 * lo que jugó, su verificación, sus códigos y su extracto.
 *
 * AJUSTAR UN SALDO PIDE UN MOTIVO
 *
 * Y el motivo va al LIBRO, no a una nota interna: aparece en el
 * extracto del jugador. Si le entra plata de la nada, tiene que poder
 * leer por qué sin escribir a soporte para preguntarlo.
 */
export default {
  name: "AdminJugador",

  data() { return { d: null, monto: "", motivo: "", ocupado: false }; },

  computed: {
    j() { return this.d.jugador; },
    inicial() { return String(this.j.username || "?").charAt(0).toUpperCase(); },

    sePuedeAjustar() {
      const n = Number(String(this.monto).replace(",", "."));
      return Number.isFinite(n) && n !== 0 && this.motivo.trim().length >= 3;
    },
  },

  watch: {
    "$route.params.id"() { this.traer(); },
  },

  methods: {
    plata(n) {
      return Number(n || 0).toLocaleString("en-US", {
        minimumFractionDigits: 2, maximumFractionDigits: 2,
      });
    },
    num(n) { return Number(n || 0).toLocaleString("en-US"); },
    fecha(d) { return d ? new Date(d).toLocaleDateString(this.$i18n.locale, { day: "2-digit", month: "short", year: "numeric" }) : "—"; },
    fechaHora(d) { return d ? new Date(d).toLocaleString(this.$i18n.locale, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"; },

    tono(e) {
      if (e === "approved") return "is-bien";
      if (e === "pending") return "is-espera";
      if (e === "rejected") return "is-mal";
      return "";
    },

    async traer() {
      try {
        const { data } = await api.get(`/admin/players/${this.$route.params.id}`);
        this.d = data.data;
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
        this.$router.push("/admin/players");
      }
    },

    async ajustar() {
      this.ocupado = true;
      try {
        await api.post(`/admin/players/${this.j._id}/balance`, {
          montoSc: Number(String(this.monto).replace(",", ".")),
          motivo: this.motivo.trim(),
        });
        this.monto = "";
        this.motivo = "";
        this.$store.dispatch("avisar", { texto: this.$t("admin.done") });
        await this.traer();
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      } finally {
        this.ocupado = false;
      }
    },

    async alternarCuenta() {
      const cerrar = !this.j.banned;
      let motivo = "";
      if (cerrar) {
        motivo = window.prompt(this.$t("admin.whyBan"));
        if (motivo === null) return;
        if (String(motivo).trim().length < 3) {
          this.$store.dispatch("avisar", { texto: this.$t("error.REASON_REQUIRED"), tono: "error" });
          return;
        }
      }

      this.ocupado = true;
      try {
        await api.post(`/admin/players/${this.j._id}/ban`, { cerrar, motivo });
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

.adj { display: flex; flex-direction: column; gap: 20px; }
.adj__cabeza { display: flex; flex-wrap: wrap; align-items: center; gap: 16px; }

.adj__avatar {
  width: 56px;
  height: 56px;
  flex: none;
  border-radius: 14px;
  background: $azul;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 900;
  font-size: 22px;
}

.adj__quien { flex: 1 1 240px; display: flex; flex-direction: column; gap: 4px; font-size: 13px; }
.adj__nombre { display: flex; align-items: center; gap: 10px; font-weight: 900; font-size: 22px; }

.adj__dos { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr)); gap: 16px; align-items: start; }
.adj__dos .ad-b { align-self: flex-start; }

.adj__kyc { display: flex; flex-direction: column; gap: 8px; }
.adj__kyc-fila { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 13px; }

.ad-tenue { color: $texto-4; }
</style>
