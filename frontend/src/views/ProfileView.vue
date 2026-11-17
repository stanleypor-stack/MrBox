<template>
  <div class="mb-perfil">
    <h1 class="mb-perfil__titulo">{{ $t('nav.profile') }}</h1>

    <p v-if="!entro" class="mb-vacio">{{ $t('error.NOT_LOGGED_IN') }}</p>

    <template v-else>
      <!-- ── Los números ──────────────────────────────────────────── -->
      <section class="mb-numeros">
        <div v-for="n in numeros" :key="n.clave" class="mb-numero">
          <span class="mb-numero__rotulo">{{ n.rotulo }}</span>
          <span class="mb-numero__valor">
            <span v-if="n.moneda" class="mb-sc" aria-hidden="true">SC</span>{{ n.valor }}
          </span>
          <span v-if="n.nota" class="mb-numero__nota">{{ n.nota }}</span>
        </div>
      </section>

      <!--
        EL AVISO DE QUE ALGO NO CUADRA.

        El servidor manda lo jugado de dos fuentes: el contador del
        usuario y la suma del libro de movimientos. Si no coinciden, hay
        un problema de verdad y el lugar donde se tiene que ver es acá,
        no escondido en un registro que nadie mira.
      -->
      <p v-if="stats && !stats.cuadra" class="mb-descuadre">
        {{ $t('profile.mismatch', {
          contador: plata(stats.jugadoSc),
          libro: plata(stats.jugadoSegunElLibro),
        }) }}
      </p>

      <!-- ── Afiliados ────────────────────────────────────────────── -->
      <section v-if="afiliado" class="mb-panel">
        <h2 class="mb-panel__titulo">{{ $t('profile.affiliate') }}</h2>

        <p v-if="!afiliado.codigos.length" class="mb-panel__vacio">
          {{ $t('profile.noAffiliate') }}
        </p>

        <table v-else class="mb-tabla">
          <thead>
            <tr>
              <th>{{ $t('profile.code') }}</th>
              <th>{{ $t('profile.players') }}</th>
              <th>{{ $t('profile.theirPlay') }}</th>
              <th>{{ $t('profile.earned') }}</th>
              <th>{{ $t('profile.toClaim') }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in afiliado.codigos" :key="c._id">
              <td><b>{{ c.code }}</b></td>
              <td>{{ c.jugadores }}</td>
              <td>SC {{ plata(c.jugadoPorLosSuyosSc) }}</td>
              <td>SC {{ plata(c.ganadoSc) }}</td>
              <td><b>SC {{ plata(c.porCobrarSc) }}</b></td>
              <td>
                <button
                  type="button" class="mb-mini"
                  :disabled="!c.porCobrarSc || cobrando" @click="cobrar(c)"
                >{{ $t('profile.claim') }}</button>
              </td>
            </tr>
          </tbody>
        </table>

        <p v-if="afiliado.miCodigoDeEntrada" class="mb-panel__pie">
          {{ $t('profile.joinedWith', { code: afiliado.miCodigoDeEntrada }) }}
        </p>
      </section>

      <!-- ── Los movimientos ──────────────────────────────────────── -->
      <section class="mb-panel">
        <div class="mb-panel__cabeza">
          <h2 class="mb-panel__titulo">{{ $t('profile.transactions') }}</h2>
          <label class="mb-filtro">
            <span class="mb-oculto">{{ $t('boxes.sort') }}</span>
            <select v-model="tipo" class="mb-select" @change="traerMovimientos(1)">
              <option value="">{{ $t('boxes.allCategories') }}</option>
              <option v-for="t in TIPOS" :key="t" :value="t">{{ $t('txType.' + t) }}</option>
            </select>
          </label>
        </div>

        <p v-if="!movimientos.items.length" class="mb-panel__vacio">
          {{ $t('profile.noTransactions') }}
        </p>

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
              <td class="mb-tenue">{{ fecha(m.createdAt) }}</td>
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
          <button type="button" class="mb-mini" :disabled="movimientos.page <= 1"
                  @click="traerMovimientos(movimientos.page - 1)">{{ $t('common.previous') }}</button>
          <span>{{ movimientos.page }} / {{ movimientos.pages }}</span>
          <button type="button" class="mb-mini" :disabled="movimientos.page >= movimientos.pages"
                  @click="traerMovimientos(movimientos.page + 1)">{{ $t('common.next') }}</button>
        </nav>
      </section>
    </template>
  </div>
</template>

<script>
import { mapGetters } from "vuex";
import api from "@/api";

/* Los mismos tipos que define el servidor. */
const TIPOS = [
  "purchase", "redemption", "box_open", "item_sold", "deal", "rakeback",
  "race_prize", "challenge", "affiliate", "promo_code", "creator_share", "manual",
];

/**
 * EL PERFIL.
 *
 * Tres cosas: los números del jugador, su panel de afiliado y el
 * extracto completo.
 *
 * El extracto está entero y no recortado a "los últimos diez". Es lo que
 * convierte un reclamo de "me faltan SC 40" en una conversación de dos
 * minutos: el jugador mira, encuentra el movimiento, y listo.
 */
export default {
  name: "ProfileView",

  data() {
    return {
      TIPOS,
      stats: null,
      afiliado: null,
      movimientos: { items: [], page: 1, pages: 0, total: 0 },
      tipo: "",
      cobrando: false,
    };
  },

  computed: {
    ...mapGetters(["entro"]),

    numeros() {
      const s = this.stats;
      if (!s) return [];
      return [
        { clave: "saldo", rotulo: this.$t("common.balance"), valor: this.plata(s.balanceSc), moneda: true },
        {
          clave: "canjeable", rotulo: this.$t("profile.withdrawable"),
          valor: this.plata(s.canjeableSc), moneda: true,
          nota: s.bonoPendienteSc > 0
            ? this.$t("profile.bonusPending", { amount: this.plata(s.bonoPendienteSc) })
            : "",
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
      /* En el idioma del jugador: en japonés el orden es otro. */
      return new Date(d).toLocaleString(this.$i18n.locale, {
        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
      });
    },

    async traerTodo() {
      if (!this.entro) return;
      try {
        const [s, a] = await Promise.all([
          api.get("/profile/stats"),
          api.get("/profile/affiliate"),
        ]);
        this.stats = s.data.data;
        this.afiliado = a.data.data;
        await this.traerMovimientos(1);
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

.mb-perfil {
  padding: 24px 28px 48px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  @include en-celular { padding: 16px; }
}

.mb-perfil__titulo {
  margin: 0;
  font-family: $fuente-titulo;
  font-size: 26px;
  font-weight: 400;
}

.mb-numeros {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 12px;
}

.mb-numero {
  padding: 14px 16px;
  border: 1px solid $borde;
  border-radius: $radio-tarjeta;
  background: $panel;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.mb-numero__rotulo {
  color: $texto-4;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .07em;
  text-transform: uppercase;
}

.mb-numero__valor {
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
  border: 1px solid $rojo;
  border-radius: $radio;
  background: rgba(255, 154, 165, .1);
  color: $rojo;
  font-weight: 700;
}

.mb-panel {
  border: 1px solid $borde;
  border-radius: $radio-panel;
  background: $panel;
  overflow: hidden;
}

.mb-panel__cabeza {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 14px 18px;
  border-bottom: 1px solid $borde;
}

.mb-panel__titulo {
  flex: 1;
  margin: 0;
  padding: 0;
  font-size: 15px;
  font-weight: 900;

  .mb-panel > &:first-child {
    padding: 14px 18px;
    border-bottom: 1px solid $borde;
  }
}

.mb-panel__vacio { margin: 0; padding: 20px 18px; color: $texto-4; }
.mb-panel__pie { margin: 0; padding: 12px 18px; border-top: 1px solid $borde; color: $texto-4; font-size: 12px; }

/* La tabla se desliza al costado en el teléfono en vez de romper la
   página: seis columnas no entran en 390px de ninguna manera. */
.mb-tabla {
  width: 100%;
  border-collapse: collapse;
  display: block;
  overflow-x: auto;
  white-space: nowrap;

  th, td { padding: 10px 18px; text-align: left; }
  thead th {
    color: $texto-4;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: .07em;
    text-transform: uppercase;
    border-bottom: 1px solid $borde;
  }
  tbody tr { border-bottom: 1px solid rgba(31, 51, 85, .5); }
  tbody tr:last-child { border-bottom: 0; }
  tbody tr:hover { background: $panel-hover; }
}

.mb-der { text-align: right !important; font-variant-numeric: tabular-nums; }
.mb-tenue { color: $texto-4; }
.mb-entra { color: $verde; font-weight: 800; }
.mb-sale { color: $texto-2; font-weight: 800; }

.mb-select {
  height: 38px;
  padding: 0 10px;
  border: 1px solid $borde-fuerte;
  border-radius: $radio-chico;
  background: $panel-alto;
  color: $texto;
  font-family: inherit;
  font-weight: 700;
  cursor: pointer;
}

.mb-mini {
  min-height: 32px;
  padding: 0 10px;
  border: 1px solid $borde-fuerte;
  border-radius: $radio-chico;
  background: $panel-alto;
  color: $texto-2;
  font-family: inherit;
  font-weight: 800;
  font-size: 12px;
  cursor: pointer;
  @include foco;
  &:hover:not(:disabled) { background: $lateral-hover; color: $texto; }
  &:disabled { opacity: .4; cursor: default; }
}

.mb-paginas {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 12px;
  border-top: 1px solid $borde;
  color: $texto-3;
  font-weight: 800;
}

.mb-vacio { margin: 40px 0; text-align: center; color: $texto-4; }

.mb-oculto {
  position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%);
}

.mb-sc {
  display: inline-flex;
  flex: none;
  width: 18px;
  height: 18px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: linear-gradient($sc-verde-claro, $sc-verde);
  color: $sc-texto;
  font-weight: 900;
  font-size: 8px;
  line-height: 1;
}
</style>
