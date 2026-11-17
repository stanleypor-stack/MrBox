<template>
  <div class="mb-perfil">
    <p v-if="!entro" class="mb-vacio">{{ $t('error.NOT_LOGGED_IN') }}</p>

    <div v-else class="mb-perfil__cols">
      <!-- ── El menú de la cuenta ─────────────────────────────────── -->
      <nav class="mb-pnav" :aria-label="$t('header.account')">
        <button
          v-for="t in pestanas" :key="t.id" type="button"
          class="mb-pnav__b" :class="{ 'is-activa': pestana === t.id }"
          :aria-current="pestana === t.id ? 'page' : 'false'"
          @click="pestana = t.id"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff"
               stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path :d="t.icono" />
          </svg>{{ $t(t.texto) }}
        </button>
      </nav>

      <div class="mb-perfil__cuerpo">
        <!-- ── Perfil ────────────────────────────────────────────── -->
        <template v-if="pestana === 'perfil'">
          <section class="mb-tarjeta-user">
            <div class="mb-tarjeta-user__trama" aria-hidden="true"></div>

            <div class="mb-tarjeta-user__avatar">
              <span class="mb-avatar">{{ inicial }}</span>
            </div>

            <div class="mb-tarjeta-user__datos">
              <div class="mb-tarjeta-user__fila">
                <span class="mb-tarjeta-user__nombre">{{ usuario.username }}</span>
                <span class="mb-tarjeta-user__rango">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#c9d7f7" aria-hidden="true">
                    <path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z" />
                  </svg>{{ rango.nombre }}
                </span>
              </div>

              <span class="mb-tarjeta-user__desde">
                {{ $t('profile.memberSince', { fecha: fecha(usuario.createdAt) }) }}
              </span>

              <div class="mb-progreso__rotulo">
                <span>{{ $t('profile.progressTo', { rango: rango.siguiente }) }}</span>
                <span class="mb-tenue">
                  SC {{ plata(usuario.jugadoSc) }} / {{ plata(rango.faltaPara) }}
                </span>
              </div>
              <div class="mb-progreso"><div :style="{ width: rango.pct }"></div></div>
              <span class="mb-tarjeta-user__puesto">
                {{ $t('profile.rankOf', { n: rango.numero, total: 9 }) }}
              </span>

              <div class="mb-tarjeta-user__pie">
                <span class="mb-id">
                  {{ $t('profile.userId') }}
                  <b>{{ idCorto }}</b>
                  <button type="button" class="mb-id__copiar" :aria-label="$t('profile.copyId')" @click="copiarId">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c9d7f7"
                         stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5h10" />
                    </svg>
                  </button>
                </span>
                <router-link to="/rewards" class="mb-ver-mas">{{ $t('profile.viewRewards') }}</router-link>
              </div>
            </div>
          </section>

          <div class="mb-dos">
            <section class="mb-panel">
              <h2>{{ $t('profile.accountInfo') }}</h2>
              <label class="mb-campo-g">
                {{ $t('auth.username') }}
                <input v-model="forma.username" type="text">
              </label>
              <label class="mb-campo-g">
                {{ $t('auth.email') }}
                <input v-model="forma.email" type="email" placeholder="you@example.com">
              </label>
              <button type="button" class="mb-guardar" @click="guardar">{{ $t('action.save') }}</button>
            </section>

            <section class="mb-panel">
              <h2>{{ $t('profile.security') }}</h2>
              <div class="mb-caja-chica">
                <span class="mb-caja-chica__t">
                  {{ $t('profile.verifyEmail') }}
                  <span class="mb-tenue">•</span>
                  <span :class="usuario.verificationLevel > 0 ? 'mb-ok' : 'mb-pend'">
                    {{ usuario.verificationLevel > 0 ? $t('profile.verified') : $t('profile.notVerified') }}
                  </span>
                </span>
                <span class="mb-caja-chica__s">{{ $t('profile.verifyEmailSub') }}</span>
              </div>
              <div class="mb-caja-chica mb-caja-chica--fila">
                <span>
                  <span class="mb-caja-chica__t">{{ $t('profile.twoFactor') }}</span>
                  <span class="mb-caja-chica__s">{{ $t('profile.twoFactorSub') }}</span>
                </span>
                <button type="button" class="mb-chico" @click="pendiente">{{ $t('profile.enable') }}</button>
              </div>
              <button type="button" class="mb-chico" @click="pendiente">{{ $t('profile.changePassword') }}</button>
            </section>
          </div>
        </template>

        <!-- ── Verificación ─────────────────────────────────────── -->
        <template v-else-if="pestana === 'verificacion'">
          <section class="mb-panel">
            <h2>{{ $t('nav.verification') }}</h2>
            <p class="mb-panel__p">{{ $t('profile.verificationIntro') }}</p>

            <div
              v-for="(n, i) in niveles" :key="i"
              class="mb-nivel" :class="{ 'is-hecho': usuario.verificationLevel > i }"
            >
              <span class="mb-nivel__num">{{ i + 1 }}</span>
              <span class="mb-nivel__texto">
                <span class="mb-nivel__t">{{ $t(n.titulo) }}</span>
                <span class="mb-nivel__s">{{ $t(n.sub) }}</span>
              </span>
              <span v-if="usuario.verificationLevel > i" class="mb-nivel__ok">{{ $t('profile.verified') }}</span>
              <button v-else type="button" class="mb-chico" @click="pendiente">{{ $t('profile.start') }}</button>
            </div>

            <div class="mb-desbloquea">
              <h3>{{ $t('profile.whatUnlocks') }}</h3>
              <p v-for="(u, i) in desbloqueos" :key="i">
                <b>{{ $t(u.que) }}</b> — {{ $t(u.nivel) }}
              </p>
            </div>
          </section>
        </template>

        <!-- ── Números ──────────────────────────────────────────── -->
        <template v-else-if="pestana === 'numeros'">
          <section class="mb-numeros">
            <div v-for="n in numeros" :key="n.clave" class="mb-numero">
              <span class="mb-numero__rot">{{ n.rotulo }}</span>
              <span class="mb-numero__val">
                <span v-if="n.moneda" class="mb-sc mb-sc--18" aria-hidden="true">SC</span>{{ n.valor }}
              </span>
              <span v-if="n.nota" class="mb-numero__nota">{{ n.nota }}</span>
            </div>
          </section>

          <p v-if="stats && !stats.cuadra" class="mb-descuadre">
            {{ $t('profile.mismatch', {
              contador: plata(stats.jugadoSc), libro: plata(stats.jugadoSegunElLibro) }) }}
          </p>
        </template>

        <!-- ── Movimientos ──────────────────────────────────────── -->
        <template v-else-if="pestana === 'movimientos'">
          <section class="mb-panel mb-panel--tabla">
            <div class="mb-panel__cabeza">
              <h2>{{ $t('profile.transactions') }}</h2>
              <label class="mb-sel-chico">
                <span class="mb-oculto">{{ $t('boxes.sort') }}</span>
                <select v-model="tipo" @change="traerMovimientos(1)">
                  <option value="">{{ $t('boxes.allCategories') }}</option>
                  <option v-for="t in TIPOS" :key="t" :value="t">{{ $t('txType.' + t) }}</option>
                </select>
              </label>
            </div>

            <p v-if="!movimientos.items.length" class="mb-panel__vacio">{{ $t('profile.noTransactions') }}</p>

            <table v-else class="mb-tabla">
              <thead>
                <tr>
                  <th>{{ $t('profile.when') }}</th>
                  <th>{{ $t('profile.what') }}</th>
                  <th class="mb-der">{{ $t('profile.amount') }}</th>
                  <th class="mb-der">{{ $t('common.balance') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="m in movimientos.items" :key="m._id">
                  <td class="mb-tenue">{{ fechaHora(m.createdAt) }}</td>
                  <td>
                    <b>{{ $t('txType.' + m.type) }}</b>
                    <span v-if="m.label" class="mb-tenue"> · {{ m.label }}</span>
                    <span v-if="m.reason" class="mb-tenue"> · {{ m.reason }}</span>
                  </td>
                  <td class="mb-der" :class="m.amountSc >= 0 ? 'mb-entra' : 'mb-sale'">
                    {{ m.amountSc >= 0 ? '+' : '' }}{{ plata(m.amountSc) }}
                  </td>
                  <td class="mb-der mb-tenue">{{ plata(m.balanceAfter) }}</td>
                </tr>
              </tbody>
            </table>

            <nav v-if="movimientos.pages > 1" class="mb-paginas">
              <button type="button" class="mb-chico" :disabled="movimientos.page <= 1"
                      @click="traerMovimientos(movimientos.page - 1)">{{ $t('common.previous') }}</button>
              <span>{{ movimientos.page }} / {{ movimientos.pages }}</span>
              <button type="button" class="mb-chico" :disabled="movimientos.page >= movimientos.pages"
                      @click="traerMovimientos(movimientos.page + 1)">{{ $t('common.next') }}</button>
            </nav>
          </section>
        </template>

        <!-- ── Historial de aperturas ───────────────────────────── -->
        <template v-else-if="pestana === 'historial'">
          <section class="mb-panel mb-panel--tabla">
            <h2>{{ $t('profile.history') }}</h2>
            <p v-if="!aperturas.items.length" class="mb-panel__vacio">{{ $t('profile.noOpenings') }}</p>

            <table v-else class="mb-tabla">
              <thead>
                <tr>
                  <th>{{ $t('profile.when') }}</th>
                  <th>{{ $t('nav.boxes') }}</th>
                  <th>{{ $t('box.youWon') }}</th>
                  <th class="mb-der">{{ $t('profile.amount') }}</th>
                  <th class="mb-der">{{ $t('profile.net') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="a in aperturas.items" :key="a._id">
                  <td class="mb-tenue">{{ fechaHora(a.createdAt) }}</td>
                  <td><b>{{ a.boxName }}</b></td>
                  <td>{{ a.premio.name }}</td>
                  <td class="mb-der mb-tenue">{{ a.conAperturaGratis ? $t('common.freeOpens') : plata(a.priceSc) }}</td>
                  <td class="mb-der" :class="a.diferenciaSc >= 0 ? 'mb-entra' : 'mb-sale'">
                    {{ a.diferenciaSc >= 0 ? '+' : '' }}{{ plata(a.diferenciaSc) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          <!-- La prueba del sorteo: las semillas. -->
          <section v-if="semillas" class="mb-panel">
            <h2>{{ $t('box.provablyFair') }}</h2>
            <p class="mb-panel__p">{{ $t('profile.fairIntro') }}</p>

            <div class="mb-semilla">
              <span class="mb-semilla__rot">{{ $t('profile.serverSeedHash') }}</span>
              <code>{{ semillas.actual.semillaServidorHash }}</code>
            </div>
            <div class="mb-semilla">
              <span class="mb-semilla__rot">{{ $t('profile.clientSeed') }}</span>
              <code>{{ semillas.actual.semillaCliente }}</code>
            </div>
            <div class="mb-semilla">
              <span class="mb-semilla__rot">{{ $t('profile.openingsWithIt') }}</span>
              <code>{{ semillas.actual.nonce }}</code>
            </div>

            <button type="button" class="mb-guardar" @click="rotar">{{ $t('profile.rotateSeed') }}</button>
            <p class="mb-panel__p mb-tenue">{{ $t('profile.rotateNote') }}</p>
          </section>
        </template>

        <!-- ── Afiliados ────────────────────────────────────────── -->
        <template v-else-if="pestana === 'afiliados'">
          <section v-if="afiliado" class="mb-panel mb-panel--tabla">
            <h2>{{ $t('nav.affiliates') }}</h2>

            <p v-if="!afiliado.codigos.length" class="mb-panel__vacio">{{ $t('profile.noAffiliate') }}</p>

            <table v-else class="mb-tabla">
              <thead>
                <tr>
                  <th>{{ $t('profile.code') }}</th>
                  <th class="mb-der">{{ $t('profile.players') }}</th>
                  <th class="mb-der">{{ $t('profile.theirPlay') }}</th>
                  <th class="mb-der">{{ $t('profile.earned') }}</th>
                  <th class="mb-der">{{ $t('profile.toClaim') }}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="c in afiliado.codigos" :key="c._id">
                  <td><b>{{ c.code }}</b></td>
                  <td class="mb-der">{{ c.jugadores }}</td>
                  <td class="mb-der">{{ plata(c.jugadoPorLosSuyosSc) }}</td>
                  <td class="mb-der">{{ plata(c.ganadoSc) }}</td>
                  <td class="mb-der"><b>{{ plata(c.porCobrarSc) }}</b></td>
                  <td>
                    <button type="button" class="mb-chico" :disabled="!c.porCobrarSc || cobrando"
                            @click="cobrar(c)">{{ $t('profile.claim') }}</button>
                  </td>
                </tr>
              </tbody>
            </table>

            <p v-if="afiliado.miCodigoDeEntrada" class="mb-panel__p mb-tenue">
              {{ $t('profile.joinedWith', { code: afiliado.miCodigoDeEntrada }) }}
            </p>
          </section>
        </template>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters, mapState } from "vuex";
import api from "@/api";

const TIPOS = [
  "purchase", "redemption", "box_open", "item_sold", "deal", "rakeback",
  "race_prize", "challenge", "affiliate", "promo_code", "creator_share", "manual",
];

/* Los nueve rangos del diseño, con lo que hay que jugar para entrar. */
const RANGOS = [
  ["Bronze", 0], ["Silver", 25000], ["Gold", 50000], ["Sapphire", 75000],
  ["Emerald", 100000], ["Ruby", 250000], ["Diamond", 500000],
  ["Onyx", 750000], ["Opal", 1500000],
];

/**
 * EL PERFIL.
 *
 * Portado del prototipo: el menu de la cuenta a la izquierda y los
 * paneles a la derecha. Perfil, Verificacion, Numeros, Movimientos,
 * Historial --con la prueba del sorteo-- y Afiliados.
 *
 * EL EXTRACTO ESTA ENTERO
 *
 * No recortado a "los ultimos diez". Es lo que convierte un reclamo de
 * "me faltan SC 40" en una conversacion de dos minutos: el jugador
 * mira, encuentra el movimiento, y listo.
 */
export default {
  name: "ProfileView",

  data() {
    return {
      TIPOS,
      pestana: "perfil",
      stats: null,
      afiliado: null,
      semillas: null,
      movimientos: { items: [], page: 1, pages: 0, total: 0 },
      aperturas: { items: [], page: 1, pages: 0 },
      tipo: "",
      cobrando: false,
      forma: { username: "", email: "" },

      pestanas: [
        { id: "perfil", texto: "nav.profile", icono: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" },
        { id: "verificacion", texto: "nav.verification", icono: "M3 5h18v14H3zM7 10h4M7 14h6M15 9h3v4h-3z" },
        { id: "numeros", texto: "profile.stats", icono: "M4 20V10M10 20V4M16 20v-7M22 20H2" },
        { id: "movimientos", texto: "profile.transactions", icono: "M4 8h14M14 4l4 4-4 4M20 16H6M10 12l-4 4 4 4" },
        { id: "historial", texto: "profile.history", icono: "M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 3" },
        { id: "afiliados", texto: "nav.affiliates", icono: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a6 6 0 0 1 12 0M19 8v6M16 11h6" },
      ],

      niveles: [
        { titulo: "profile.level1", sub: "profile.level1Sub" },
        { titulo: "profile.level2", sub: "profile.level2Sub" },
        { titulo: "profile.level3", sub: "profile.level3Sub" },
      ],

      desbloqueos: [
        { que: "profile.unlockPlay", nivel: "profile.unlockNone" },
        { que: "profile.unlockRedeem", nivel: "profile.unlockL2" },
        { que: "profile.unlockShip", nivel: "profile.unlockL2" },
        { que: "profile.unlockShipBig", nivel: "profile.unlockL3" },
      ],
    };
  },

  computed: {
    ...mapState(["usuario"]),
    ...mapGetters(["entro"]),

    inicial() { return (this.usuario && this.usuario.username || "?").charAt(0).toUpperCase(); },

    idCorto() {
      return "MBX" + String((this.usuario && this.usuario._id) || "").slice(-5).toUpperCase();
    },

    /** En qué rango está y cuánto le falta para el próximo. */
    rango() {
      const jugado = (this.usuario && this.usuario.jugadoSc) || 0;
      let i = 0;
      for (let k = 0; k < RANGOS.length; k += 1) if (jugado >= RANGOS[k][1]) i = k;
      const siguiente = RANGOS[Math.min(i + 1, RANGOS.length - 1)];
      const desde = RANGOS[i][1];
      const hasta = siguiente[1];
      const pct = hasta > desde ? ((jugado - desde) / (hasta - desde)) * 100 : 100;
      return {
        nombre: RANGOS[i][0],
        numero: i + 1,
        siguiente: siguiente[0],
        faltaPara: hasta,
        pct: Math.max(4, Math.min(100, pct)).toFixed(1) + "%",
      };
    },

    numeros() {
      const s = this.stats;
      if (!s) return [];
      return [
        { clave: "saldo", rotulo: this.$t("common.balance"), valor: this.plata(s.balanceSc), moneda: true },
        {
          clave: "canjeable", rotulo: this.$t("profile.withdrawable"),
          valor: this.plata(s.canjeableSc), moneda: true,
          nota: s.bonoPendienteSc > 0
            ? this.$t("profile.bonusPending", { amount: this.plata(s.bonoPendienteSc) }) : "",
        },
        { clave: "jugado", rotulo: this.$t("profile.wagered"), valor: this.plata(s.jugadoSc), moneda: true },
        { clave: "comprado", rotulo: this.$t("profile.purchased"), valor: this.plata(s.compradoSc), moneda: true },
        { clave: "aperturas", rotulo: this.$t("profile.opened"), valor: String(s.aperturas) },
        {
          clave: "inventario", rotulo: this.$t("inventory.title"),
          valor: this.plata(s.inventario.valorSc), moneda: true,
          nota: this.$t("box.items", { n: s.inventario.cuantos }),
        },
      ];
    },
  },

  methods: {
    plata(n) {
      return Number(n || 0).toLocaleString("en-US", {
        minimumFractionDigits: 2, maximumFractionDigits: 2,
      });
    },
    fecha(d) {
      return d ? new Date(d).toLocaleDateString(this.$i18n.locale, {
        day: "2-digit", month: "short", year: "numeric" }) : "";
    },
    fechaHora(d) {
      return new Date(d).toLocaleString(this.$i18n.locale, {
        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
    },

    pendiente() { this.$store.dispatch("avisar", { texto: this.$t("auth.soon") }); },

    copiarId() {
      try {
        navigator.clipboard.writeText(this.idCorto);
        this.$store.dispatch("avisar", { texto: this.$t("profile.copied") });
      } catch {
        /* Sin permiso de portapapeles no se puede; no es grave. */
      }
    },

    guardar() { this.pendiente(); },

    async traerTodo() {
      if (!this.entro) return;
      this.forma = {
        username: this.usuario.username,
        email: this.usuario.email,
      };
      try {
        const [s, a, sem] = await Promise.all([
          api.get("/profile/stats"),
          api.get("/profile/affiliate"),
          api.get("/inventory/fair/seed").catch(() => null),
        ]);
        this.stats = s.data.data;
        this.afiliado = a.data.data;
        if (sem) this.semillas = sem.data.data;
        await Promise.all([this.traerMovimientos(1), this.traerAperturas()]);
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      }
    },

    async traerMovimientos(pagina) {
      try {
        const { data } = await api.get("/profile/transactions", {
          params: { page: pagina, perPage: 20, type: this.tipo || undefined },
        });
        this.movimientos = data.data;
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      }
    },

    async traerAperturas() {
      try {
        const { data } = await api.get("/inventory/openings", { params: { perPage: 25 } });
        this.aperturas = data.data;
      } catch {
        /* El historial es informativo: que falle no rompe el perfil. */
      }
    },

    async rotar() {
      try {
        const { data } = await api.post("/inventory/fair/rotate", {});
        this.semillas = { ...this.semillas, actual: data.data.nueva };
        this.$store.dispatch("avisar", { texto: this.$t("profile.rotated") });
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      }
    },

    async cobrar(c) {
      this.cobrando = true;
      try {
        const { data } = await api.post("/profile/affiliate/claim", { codigoId: c._id });
        this.$store.commit("saldo", data.data);
        await this.traerTodo();
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      } finally {
        this.cobrando = false;
      }
    },
  },

  created() { this.traerTodo(); },
  watch: { entro() { this.traerTodo(); } },
};
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

.mb-perfil__cols { display: flex; flex-wrap: wrap; gap: 20px; align-items: flex-start; }

.mb-pnav {
  flex: 1 1 220px;
  max-width: 260px;
  display: flex;
  flex-direction: column;
  gap: 10px;

  @include en-celular {
    max-width: none;
    flex-direction: row;
    overflow-x: auto;
    scrollbar-width: none;
    &::-webkit-scrollbar { display: none; }
  }
}

.mb-pnav__b {
  flex: none;
  display: flex;
  align-items: center;
  gap: 12px;
  height: 48px;
  padding: 0 18px;
  border-radius: 12px;
  border: 0;
  background: #12213a;
  color: #fff;
  font-family: inherit;
  font-weight: 800;
  font-size: 15px;
  cursor: pointer;
  white-space: nowrap;
  @include foco;

  &:hover { background: #1d3354; }
  &.is-activa { background: linear-gradient(90deg, #2f9be0, #2f6fe0); }
}

.mb-perfil__cuerpo { flex: 999 1 420px; min-width: 0; display: flex; flex-direction: column; gap: 20px; }

/* ── La tarjeta del jugador ───────────────────────────────────────── */

.mb-tarjeta-user {
  position: relative;
  overflow: hidden;
  border-radius: 18px;
  background: #12213a;
  padding: clamp(18px, 3vw, 28px);
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  align-items: center;
}

// Las rayas diagonales del fondo, muy suaves.
.mb-tarjeta-user__trama {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(45deg, rgba(255, 255, 255, .025) 0 18px, rgba(255, 255, 255, 0) 18px 36px);
}

.mb-tarjeta-user__avatar { position: relative; width: 120px; height: 120px; flex: none; }

.mb-avatar {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: #2f6fe0;
  border: 4px solid #c9d7f7;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: $fuente-cartel;
  font-size: 48px;
}

.mb-tarjeta-user__datos { position: relative; flex: 1 1 280px; display: flex; flex-direction: column; gap: 8px; }
.mb-tarjeta-user__fila { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.mb-tarjeta-user__nombre { font-weight: 900; font-size: 30px; }

.mb-tarjeta-user__rango {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 900;
  font-size: 13px;
  letter-spacing: .06em;
  color: $texto-2;
}

.mb-tarjeta-user__desde { font-size: 14px; color: $texto-3; }

.mb-progreso__rotulo { display: flex; justify-content: space-between; font-size: 13px; margin-top: 8px; gap: 10px; }

.mb-progreso {
  height: 8px;
  border-radius: 4px;
  background: #22385c;
  overflow: hidden;
  div { min-width: 4%; height: 100%; background: $texto-2; }
}

.mb-tarjeta-user__puesto { font-size: 12px; color: $texto-4; }

.mb-tarjeta-user__pie {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 10px;
}

.mb-id { display: flex; align-items: center; gap: 8px; font-size: 13px; color: $texto-3; b { color: #fff; font-weight: 900; } }

.mb-id__copiar {
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 8px;
  background: #0e1a2e;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  @include foco;
  &:hover { background: #1d3354; }
}

.mb-ver-mas {
  height: 40px;
  padding: 0 16px;
  border-radius: 20px;
  border: 2px solid #3a5687;
  background: transparent;
  color: #fff;
  font-weight: 800;
  font-size: 14px;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  @include foco;
  &:hover { color: #fff; background: rgba(255, 255, 255, .06); }
}

/* ── Los paneles ──────────────────────────────────────────────────── */

.mb-dos {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr));
  gap: 20px;
  align-items: start;
}

.mb-panel {
  border-radius: 18px;
  background: #12213a;
  padding: 22px;
  display: flex;
  flex-direction: column;
  gap: 14px;

  h2 { margin: 0; font-weight: 900; font-size: 20px; }
  &--tabla { padding: 0; h2 { padding: 20px 22px 0; } }
}

.mb-panel__p { margin: 0; color: $texto-3; font-size: 14px; line-height: 1.5; }
.mb-panel__vacio { margin: 0; padding: 20px 22px; color: $texto-4; }

.mb-panel__cabeza {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 20px 22px 0;
  h2 { flex: 1; padding: 0; }
}

.mb-campo-g {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-weight: 800;
  font-size: 15px;

  input {
    height: 50px;
    padding: 0 16px;
    border-radius: 14px;
    border: 1px solid #2a4170;
    background: #0e1a2e;
    color: #fff;
    font-family: inherit;
    font-size: 15px;
    font-weight: 600;
    &:focus { outline: none; border-color: $azul; }
  }
}

.mb-guardar {
  align-self: flex-start;
  height: 46px;
  padding: 0 22px;
  border-radius: 23px;
  border: 2px solid #fff;
  background: linear-gradient(180deg, #4fa2ff, #2f6fe0);
  color: #fff;
  font-family: inherit;
  font-weight: 900;
  font-size: 15px;
  cursor: pointer;
  @include foco;
  &:hover { filter: brightness(1.07); }
}

.mb-caja-chica {
  border-radius: 14px;
  background: #0e1a2e;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;

  &--fila { flex-direction: row; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; }
  &__t { display: block; font-weight: 900; font-size: 16px; }
  &__s { display: block; font-size: 14px; color: $texto-3; }
}

.mb-ok { color: #2fd47a; }
.mb-pend { color: $amarillo; }

/* ── Verificación ─────────────────────────────────────────────────── */

.mb-nivel {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  border-radius: 14px;
  background: #0e1a2e;
  border: 1px solid #22385c;

  &.is-hecho { border-color: #2fd47a; }
}

.mb-nivel__num {
  flex: none;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #1d3354;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 900;
}

.mb-nivel__texto { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.mb-nivel__t { font-weight: 900; font-size: 15px; }
.mb-nivel__s { font-size: 13px; color: $texto-3; line-height: 1.4; }
.mb-nivel__ok { color: #2fd47a; font-weight: 900; font-size: 13px; }

.mb-desbloquea {
  border-radius: 14px;
  background: #0e1a2e;
  padding: 16px;

  h3 { margin: 0 0 10px; font-size: 14px; font-weight: 900; }
  p { margin: 0 0 6px; font-size: 13px; color: $texto-3; &:last-child { margin: 0; } }
  b { color: #fff; }
}

/* ── Números ──────────────────────────────────────────────────────── */

.mb-numeros { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; }

.mb-numero {
  padding: 16px 18px;
  border-radius: 14px;
  background: #12213a;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.mb-numero__rot {
  color: $texto-4;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .07em;
  text-transform: uppercase;
}

.mb-numero__val {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 900;
  font-size: 20px;
  font-variant-numeric: tabular-nums;
}

.mb-numero__nota { color: $texto-4; font-size: 11px; }

.mb-descuadre {
  margin: 0;
  padding: 12px 16px;
  border: 1px solid #ff5b6b;
  border-radius: 14px;
  background: rgba(255, 91, 107, .1);
  color: #ff9aa5;
  font-weight: 700;
}

/* ── Las tablas ───────────────────────────────────────────────────── */

.mb-tabla {
  width: 100%;
  border-collapse: collapse;
  display: block;
  overflow-x: auto;
  white-space: nowrap;

  th, td { padding: 11px 22px; text-align: left; }
  thead th {
    color: $texto-4;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: .07em;
    text-transform: uppercase;
    border-bottom: 1px solid $borde;
  }
  tbody tr { border-bottom: 1px solid rgba(31, 51, 85, .5); &:last-child { border-bottom: 0; } }
  tbody tr:hover { background: $panel-hover; }
}

.mb-der { text-align: right !important; font-variant-numeric: tabular-nums; }
.mb-tenue { color: $texto-4; }
.mb-entra { color: #2fd47a; font-weight: 800; }
.mb-sale { color: $texto-2; font-weight: 800; }

.mb-sel-chico, .mb-chico {
  height: 38px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid #2a4170;
  background: #0e1a2e;
  color: #fff;
  font-family: inherit;
  font-weight: 800;
  font-size: 13px;
  cursor: pointer;
  @include foco;
  &:hover:not(:disabled) { background: #1d3354; }
  &:disabled { opacity: .4; cursor: default; }
}

.mb-sel-chico select {
  border: 0;
  background: transparent;
  color: #fff;
  font-family: inherit;
  font-weight: 800;
  cursor: pointer;
}

.mb-paginas {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 14px;
  border-top: 1px solid $borde;
  color: $texto-3;
  font-weight: 800;
}

/* ── Las semillas ─────────────────────────────────────────────────── */

.mb-semilla {
  border-radius: 12px;
  background: #0e1a2e;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;

  code {
    font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
    font-size: 12px;
    color: $texto-2;
    word-break: break-all;
  }
}

.mb-semilla__rot { font-size: 11px; font-weight: 800; letter-spacing: .07em; color: $texto-4; text-transform: uppercase; }

.mb-vacio { margin: 40px 0; text-align: center; color: $texto-4; }
.mb-oculto { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
</style>
