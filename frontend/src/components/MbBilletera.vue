<template>
  <div class="mb-caja" @keydown.esc="cerrar">
    <button type="button" class="mb-caja__fondo" :aria-label="$t('action.cancel')" @click="cerrar"></button>

    <div class="mb-caja__ventana" role="dialog" aria-modal="true" :aria-label="$t('wallet.refill')">
      <!-- ── La columna de la izquierda ───────────────────────────── -->
      <div class="mb-caja__lado">
        <div class="mb-caja__marca">
          <span class="mb-sc mb-sc--32" aria-hidden="true">SC</span>
          <span>{{ lado === 'in' ? $t('wallet.refill') : $t('wallet.cashOut') }}</span>
        </div>

        <div class="mb-caja__tabs" role="tablist" :aria-label="$t('wallet.refill')">
          <button
            v-for="l in ['in', 'out']" :key="l" type="button" role="tab"
            :aria-selected="lado === l ? 'true' : 'false'" :class="{ 'is-activa': lado === l }"
            @click="lado = l"
          >{{ l === 'in' ? $t('action.deposit') : $t('action.redeem') }}</button>
        </div>

        <!-- Lo que se puede pagar. Cripto anda; el resto llega con la
             pasarela, y se dice en vez de poner un botón mudo. -->
        <button type="button" class="mb-caja__metodo is-elegido" aria-pressed="true">
          <span class="mb-caja__metodo-t">{{ $t('wallet.crypto') }}</span>
          <span class="mb-caja__puntos">
            <span
              v-for="m in monedas.slice(0, 4)" :key="m.ticker" class="mb-caja__punto"
              :style="{ background: m.color }" aria-hidden="true"
            >{{ m.letra }}</span>
            <span v-if="monedas.length > 4" class="mb-caja__mas">+{{ monedas.length - 4 }}</span>
          </span>
        </button>

        <p class="mb-caja__nota">
          {{ lado === 'in' ? $t('wallet.depositNote') : $t('wallet.withdrawNote') }}
        </p>
      </div>

      <!-- ── Depositar ────────────────────────────────────────────── -->
      <div v-if="lado === 'in'" class="mb-caja__cuerpo">
        <div class="mb-caja__cabeza">
          <span>{{ $t('wallet.payWithCrypto') }}</span>
          <button type="button" class="mb-caja__x" :aria-label="$t('action.cancel')" @click="cerrar">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"
                 stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>

        <p v-if="deposito && !deposito.conectada" class="mb-caja__aviso">
          {{ $t('wallet.notConnected') }}
        </p>

        <template v-else-if="deposito">
          <span class="mb-caja__solo" v-html="$t('wallet.sendOnly', { coin: tickerLargo, net: red.nombre })"></span>

          <div class="mb-caja__qr">
            <img v-if="qr" :src="qr" :alt="$t('wallet.qrAlt')">
          </div>

          <span class="mb-caja__dir">{{ deposito.direccion }}</span>

          <button type="button" class="mb-caja__copiar" @click="copiar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" aria-hidden="true">
              <rect x="8" y="8" width="12" height="12" rx="2" />
              <path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />
            </svg>
            {{ copiado ? $t('wallet.copied') : $t('wallet.copyAddress') }}
          </button>
        </template>

        <p v-else class="mb-caja__nota">{{ $t('common.loading') }}</p>

        <!-- La moneda y la red: los dos selectores del diseño -->
        <label class="mb-caja__campo">
          {{ $t('wallet.coin') }}
          <span class="mb-caja__select">
            <span class="mb-caja__punto mb-caja__punto--grande" :style="{ background: moneda.color }" aria-hidden="true">
              {{ moneda.letra }}
            </span>
            <select v-model="tickerElegido" @change="alCambiarMoneda">
              <option v-for="m in monedas" :key="m.ticker" :value="m.ticker">
                {{ m.nombre }} ({{ m.ticker }})
              </option>
            </select>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8ea3c7" stroke-width="2.6"
                 stroke-linecap="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
          </span>
        </label>

        <label class="mb-caja__campo">
          {{ $t('wallet.network') }}
          <span class="mb-caja__select">
            <span class="mb-caja__punto mb-caja__punto--grande" :style="{ background: red.color }" aria-hidden="true">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
                <path d="M12 2 22 8v8l-10 6L2 16V8z" />
              </svg>
            </span>
            <select v-model="redElegida" @change="traerDeposito">
              <option v-for="r in moneda.redes" :key="r.clave" :value="r.clave">
                {{ r.nombre }} · {{ r.demora }}
              </option>
            </select>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8ea3c7" stroke-width="2.6"
                 stroke-linecap="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
          </span>
        </label>

        <p class="mb-caja__fino">
          {{ $t('wallet.minAndConfirms', { min: minimo, n: red.confirmaciones, time: red.demora }) }}
          <br>{{ $t('wallet.belowMin') }}
        </p>

        <!--
          EL CODIGO DE AFILIADO, QUE SE PUEDE PONER ACA.

          Normalmente se pone al registrarse, pero la mitad de la gente
          se entera del codigo despues. Mientras no tenga uno, lo puede
          atar desde aca y el bono entra en la compra siguiente.
        -->
        <div class="mb-caja__codigo">
          <button type="button" :aria-expanded="String(codigoAbierto)" @click="codigoAbierto = !codigoAbierto">
            {{ $t('wallet.haveCode') }}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8ea3c7" stroke-width="2.6"
                 stroke-linecap="round" aria-hidden="true"
                 :style="{ transform: codigoAbierto ? 'rotate(180deg)' : 'rotate(0deg)' }">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>

          <div v-if="codigoAbierto" class="mb-caja__codigo-fila">
            <input v-model="codigo" class="mb-caja__in" :placeholder="$t('wallet.codePlaceholder')" :aria-label="$t('wallet.haveCode')">
            <button type="button" class="mb-caja__aplicar" :disabled="!codigo.trim() || aplicando" @click="aplicarCodigo">
              {{ $t('wallet.apply') }}
            </button>
          </div>
        </div>
      </div>

      <!-- ── Canjear ──────────────────────────────────────────────── -->
      <div v-else class="mb-caja__cuerpo">
        <div class="mb-caja__cabeza">
          <span>{{ $t('wallet.cashOutTitle') }}</span>
          <button type="button" class="mb-caja__x" :aria-label="$t('action.cancel')" @click="cerrar">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"
                 stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>

        <template v-if="canje">
          <div class="mb-caja__saldos">
            <div>
              <span>{{ $t('wallet.available') }}</span>
              <b><span class="mb-sc mb-sc--16" aria-hidden="true">SC</span>{{ plata(canje.disponibleSc) }}</b>
            </div>
            <div v-if="canje.bonoPendienteSc > 0">
              <span>{{ $t('wallet.lockedBonus') }}</span>
              <b><span class="mb-sc mb-sc--16" aria-hidden="true">SC</span>{{ plata(canje.bonoPendienteSc) }}</b>
            </div>
          </div>

          <!-- Lo que falta, antes de escribir nada -->
          <p v-if="canje.nivel < canje.nivelQuePide" class="mb-caja__aviso">
            {{ $t('wallet.needsKyc', { n: canje.nivelQuePide }) }}
            <router-link to="/profile?tab=verification" @click.native="cerrar">{{ $t('nav.verification') }}</router-link>
          </p>

          <form class="mb-caja__form" @submit.prevent="canjear">
            <label class="mb-caja__campo">
              {{ $t('profile.amount') }}
              <span class="mb-caja__select">
                <span class="mb-sc mb-sc--18 mb-caja__scico" aria-hidden="true">SC</span>
                <input
                  v-model="monto" inputmode="decimal" :placeholder="String(canje.minimoSc)"
                  :disabled="!puedeCanjear"
                >
                <button type="button" class="mb-caja__todo" :disabled="!puedeCanjear" @click="monto = String(canje.disponibleSc)">
                  {{ $t('wallet.max') }}
                </button>
              </span>
            </label>

            <label class="mb-caja__campo">
              {{ $t('wallet.coin') }}
              <span class="mb-caja__select">
                <span class="mb-caja__punto mb-caja__punto--grande" :style="{ background: moneda.color }" aria-hidden="true">
                  {{ moneda.letra }}
                </span>
                <select v-model="tickerElegido" :disabled="!puedeCanjear" @change="alCambiarMoneda">
                  <option v-for="m in monedas" :key="m.ticker" :value="m.ticker">{{ m.nombre }} ({{ m.ticker }})</option>
                </select>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8ea3c7" stroke-width="2.6"
                     stroke-linecap="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
              </span>
            </label>

            <label class="mb-caja__campo">
              {{ $t('wallet.network') }}
              <span class="mb-caja__select">
                <span class="mb-caja__punto mb-caja__punto--grande" :style="{ background: red.color }" aria-hidden="true">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
                    <path d="M12 2 22 8v8l-10 6L2 16V8z" />
                  </svg>
                </span>
                <select v-model="redElegida" :disabled="!puedeCanjear">
                  <option v-for="r in moneda.redes" :key="r.clave" :value="r.clave">{{ r.nombre }} · {{ r.clave }}</option>
                </select>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8ea3c7" stroke-width="2.6"
                     stroke-linecap="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
              </span>
            </label>

            <label class="mb-caja__campo">
              {{ $t('wallet.yourAddress', { coin: tickerElegido }) }}
              <input v-model="direccion" class="mb-caja__in" :disabled="!puedeCanjear" :placeholder="$t('wallet.addressPlaceholder')">
            </label>

            <p class="mb-caja__fino">{{ $t('wallet.checkAddress') }}</p>

            <button type="submit" class="mb-caja__enviar" :disabled="!sePuedePedir || mandando">
              {{ mandando ? $t('common.loading') : $t('wallet.requestCashOut') }}
            </button>
          </form>

          <!-- Los pedidos que ya hizo -->
          <div v-if="pedidos.length" class="mb-caja__lista">
            <span class="mb-caja__lista-t">{{ $t('wallet.yourRequests') }}</span>
            <div v-for="p in pedidos" :key="p._id" class="mb-caja__pedido">
              <span class="mb-caja__pedido-a">
                <b><span class="mb-sc mb-sc--14" aria-hidden="true">SC</span>{{ plata(p.montoSc) }}</b>
                <span class="mb-tenue">{{ p.moneda }} · {{ p.red }}</span>
              </span>
              <span class="mb-caja__pedido-b">
                <span class="mb-caja__chapa" :class="'is-' + p.estado">{{ $t('cashier.state.' + p.estado) }}</span>
                <button
                  v-if="p.estado === 'pending'" type="button" class="mb-caja__cancelar"
                  @click="cancelar(p)"
                >{{ $t('action.cancel') }}</button>
              </span>
            </div>
          </div>
        </template>

        <p v-else class="mb-caja__nota">{{ $t('common.loading') }}</p>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters } from "vuex";
import api from "@/api";

/**
 * LA CAJA: COMPRAR SC Y CANJEARLOS.
 *
 * La ventana del prototipo: la columna de la izquierda con el título y
 * los medios de pago, y a la derecha lo que se está haciendo.
 *
 * NO HAY NINGUNA DIRECCION DE MENTIRA
 *
 * La dirección de depósito la da la pasarela. Mientras no esté
 * conectada, esta pantalla lo dice. Un QR de ejemplo en una pantalla de
 * depósito es plata de alguien mandada a la nada, y es un error que no
 * se puede deshacer.
 *
 * EL QR SE DIBUJA ACA
 *
 * Con la dirección que mandó el servidor, en el navegador. Mandarla a
 * un servicio de QR de terceros --que es como suele hacerse-- le
 * contaría a ese tercero la dirección de depósito de cada jugador.
 */
export default {
  name: "MbBilletera",

  props: {
    /* "in" deposita, "out" canjea. */
    modo: { type: String, default: "in" },
  },

  data() {
    return {
      lado: this.modo,
      monedas: [],
      tickerElegido: "USDT",
      redElegida: "TRC20",
      deposito: null,
      canje: null,
      pedidos: [],
      qr: "",
      copiado: false,
      monto: "",
      direccion: "",
      mandando: false,
      minimo: 10,
      codigo: "",
      codigoAbierto: false,
      aplicando: false,
    };
  },

  computed: {
    ...mapGetters(["entro"]),

    moneda() {
      return this.monedas.find((m) => m.ticker === this.tickerElegido) || { redes: [], color: "#3f7cf0", letra: "?" };
    },

    red() {
      return (this.moneda.redes || []).find((r) => r.clave === this.redElegida) || { nombre: "", clave: "", confirmaciones: 0, demora: "" };
    },

    /* "USDT (TRC20)" cuando hay varias redes; "BTC" cuando hay una. */
    tickerLargo() {
      return (this.moneda.redes || []).length > 1
        ? `${this.tickerElegido} (${this.redElegida})`
        : this.tickerElegido;
    },

    puedeCanjear() {
      return !!this.canje && this.canje.nivel >= this.canje.nivelQuePide;
    },

    sePuedePedir() {
      if (!this.puedeCanjear) return false;
      const n = Number(String(this.monto).replace(",", "."));
      return Number.isFinite(n)
        && n >= this.canje.minimoSc
        && n <= this.canje.disponibleSc
        && this.direccion.trim().length >= 20;
    },
  },

  watch: {
    lado(v) {
      if (v === "in") this.traerDeposito();
      else this.traerCanje();
    },
  },

  methods: {
    plata(n) {
      return Number(n || 0).toLocaleString("en-US", {
        minimumFractionDigits: 2, maximumFractionDigits: 2,
      });
    },

    cerrar() { this.$emit("cerrar"); },

    alCambiarMoneda() {
      this.redElegida = (this.moneda.redes[0] || {}).clave || "";
      if (this.lado === "in") this.traerDeposito();
    },

    async traerMonedas() {
      try {
        const { data } = await api.get("/wallet/coins");
        this.monedas = data.data.monedas;
        this.minimo = data.data.minimoDepositoSc;
        if (!this.monedas.find((m) => m.ticker === this.tickerElegido)) {
          this.tickerElegido = this.monedas[0].ticker;
          this.redElegida = this.monedas[0].redes[0].clave;
        }
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      }
    },

    async traerDeposito() {
      if (!this.entro) return;
      this.deposito = null;
      this.qr = "";
      this.copiado = false;

      try {
        const { data } = await api.get("/wallet/deposit", {
          params: { coin: this.tickerElegido, network: this.redElegida },
        });
        this.deposito = data.data;
        if (this.deposito.direccion) this.dibujarQr(this.deposito.direccion);
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      }
    },

    async traerCanje() {
      if (!this.entro) return;
      try {
        const [antes, mios] = await Promise.all([
          api.get("/wallet/withdraw"),
          api.get("/wallet/withdrawals"),
        ]);
        this.canje = antes.data.data;
        this.pedidos = mios.data.data.items;
        if (!this.monedas.length) this.monedas = this.canje.monedas;
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      }
    },

    /**
     * El QR, dibujado acá con la librería que ya trae el proyecto.
     *
     * Se carga sola la primera vez que hace falta: son 20KB que no
     * tiene por qué bajarse quien nunca abre la caja.
     */
    async dibujarQr(texto) {
      try {
        const QR = (await import(/* webpackChunkName: "qr" */ "qrcode")).default;
        this.qr = await QR.toDataURL(texto, {
          margin: 1,
          width: 300,
          color: { dark: "#0b1424", light: "#ffffff" },
        });
      } catch (err) {
        /* Sin QR se puede copiar la dirección igual. */
        this.qr = "";
      }
    },

    async copiar() {
      try {
        await navigator.clipboard.writeText(this.deposito.direccion);
        this.copiado = true;
        window.setTimeout(() => { this.copiado = false; }, 2500);
      } catch (err) {
        this.$store.dispatch("avisar", { texto: this.deposito.direccion });
      }
    },

    /** Atar un código de afiliado, si todavía no tiene uno. */
    async aplicarCodigo() {
      this.aplicando = true;
      try {
        const { data } = await api.post("/wallet/code", { code: this.codigo.trim() });
        this.codigo = "";
        this.codigoAbierto = false;
        this.$store.dispatch("avisar", {
          texto: this.$t("wallet.codeOn", { code: data.data.code, pct: data.data.bonoPct }),
        });
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      } finally {
        this.aplicando = false;
      }
    },

    async canjear() {
      this.mandando = true;
      try {
        const { data } = await api.post("/wallet/withdraw", {
          montoSc: Number(String(this.monto).replace(",", ".")),
          coin: this.tickerElegido,
          network: this.redElegida,
          address: this.direccion.trim(),
        });

        this.$store.commit("saldo", data.data);
        this.monto = "";
        this.$store.dispatch("avisar", { texto: this.$t("wallet.requested") });
        await this.traerCanje();
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      } finally {
        this.mandando = false;
      }
    },

    async cancelar(p) {
      try {
        const { data } = await api.post(`/wallet/withdrawals/${p._id}/cancel`);
        this.$store.commit("saldo", data.data);
        await this.traerCanje();
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      }
    },
  },

  async created() {
    await this.traerMonedas();
    if (this.lado === "in") this.traerDeposito();
    else this.traerCanje();
  },
};
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

.mb-caja {
  position: fixed;
  inset: 0;
  z-index: 90;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  box-sizing: border-box;
}

.mb-caja__fondo { position: absolute; inset: 0; border: 0; background: rgba(3, 8, 18, .72); cursor: pointer; }

.mb-caja__ventana {
  position: relative;
  width: min(880px, 100%);
  max-height: calc(100vh - 32px);
  overflow: auto;
  border-radius: 22px;
  border: 2px solid #fff;
  background: $panel;
  display: flex;
  flex-wrap: wrap;
}

/* ── La columna de la izquierda ───────────────────────────────────── */

.mb-caja__lado {
  flex: 1 1 280px;
  max-width: 320px;
  box-sizing: border-box;
  padding: 20px;
  background: $panel-alto;
  display: flex;
  flex-direction: column;
  gap: 14px;

  @include en-celular { max-width: none; }
}

.mb-caja__marca {
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: $fuente-cartel;
  font-size: 26px;
  line-height: 1;
  text-shadow: 0 3px 0 $azul-tinta;
}

.mb-caja__tabs {
  display: flex;
  gap: 4px;
  padding: 5px;
  border-radius: 14px;
  background: $panel;

  button {
    flex: 1;
    height: 40px;
    border-radius: 10px;
    border: 0;
    background: transparent;
    color: #fff;
    font-family: inherit;
    font-weight: 800;
    font-size: 15px;
    cursor: pointer;
    @include foco;
    &.is-activa { background: $azul; }
  }
}

.mb-caja__metodo {
  text-align: left;
  padding: 14px;
  border-radius: 14px;
  border: 2px solid $borde-fuerte;
  background: $panel;
  color: #fff;
  font-family: inherit;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 10px;
  @include foco;

  &.is-elegido { border-color: $azul; background: #173468; }
}

.mb-caja__metodo-t { font-weight: 900; font-size: 16px; }
.mb-caja__puntos { display: flex; align-items: center; gap: 4px; }

.mb-caja__punto {
  width: 22px;
  height: 22px;
  flex: none;
  border-radius: 50%;
  color: #fff;
  font-weight: 900;
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;

  &--grande { position: absolute; left: 12px; width: 26px; height: 26px; font-size: 13px; }
}

.mb-caja__mas {
  margin-left: 2px;
  padding: 2px 7px;
  border-radius: 10px;
  background: $panel;
  font-weight: 900;
  font-size: 11px;
}

.mb-caja__nota { margin: auto 0 0; font-size: 12px; line-height: 1.5; color: $texto-4; }

/* ── La derecha ───────────────────────────────────────────────────── */

.mb-caja__cuerpo {
  position: relative;
  flex: 999 1 340px;
  min-width: 0;
  box-sizing: border-box;
  padding: 20px 24px 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.mb-caja__cabeza {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-weight: 900;
  font-size: 18px;
}

.mb-caja__x {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 0;
  background: $panel-hover;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  @include foco;
}

.mb-caja__solo { text-align: center; font-size: 13px; color: $texto-2; }

.mb-caja__qr {
  align-self: center;
  width: 150px;
  height: 150px;
  padding: 8px;
  box-sizing: border-box;
  border-radius: 16px;
  background: #fff;

  img { width: 100%; height: 100%; display: block; }
}

.mb-caja__dir { text-align: center; font-weight: 800; font-size: 13px; word-break: break-all; color: $texto-2; }

.mb-caja__copiar {
  align-self: center;
  height: 44px;
  padding: 0 20px;
  border-radius: 12px;
  border: 0;
  background: #1d3a66;
  color: #fff;
  font-family: inherit;
  font-weight: 800;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  @include foco;
}

.mb-caja__campo { display: flex; flex-direction: column; gap: 8px; font-weight: 800; font-size: 14px; }

.mb-caja__select {
  position: relative;
  display: flex;
  align-items: center;
  height: 50px;
  border-radius: 14px;
  border: 1px solid $borde-fuerte;
  background: $panel-alto;

  select, input {
    width: 100%;
    height: 100%;
    padding: 0 40px 0 48px;
    border: 0;
    background: transparent;
    color: #fff;
    font-family: inherit;
    font-weight: 800;
    font-size: 15px;
    appearance: none;
    cursor: pointer;
    &:focus { outline: none; }
    &:disabled { opacity: .6; }
  }

  input { cursor: text; }

  > svg { position: absolute; right: 14px; pointer-events: none; }
}

.mb-caja__scico { position: absolute; left: 14px; }

.mb-caja__todo {
  position: absolute;
  right: 10px;
  height: 32px;
  padding: 0 12px;
  border-radius: 8px;
  border: 0;
  background: $azul;
  color: #fff;
  font-family: inherit;
  font-weight: 800;
  font-size: 12px;
  cursor: pointer;
  @include foco;
}

.mb-caja__in {
  height: 50px;
  padding: 0 14px;
  border-radius: 14px;
  border: 1px solid $borde-fuerte;
  background: $panel-alto;
  color: #fff;
  font-family: inherit;
  font-size: 14px;
  &:focus { outline: none; border-color: $azul; }
}

.mb-caja__codigo {
  border-radius: 14px;
  background: $panel-alto;
  overflow: hidden;

  > button {
    width: 100%;
    height: 52px;
    padding: 0 16px;
    border: 0;
    background: transparent;
    color: #fff;
    font-family: inherit;
    font-weight: 900;
    font-size: 15px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
    @include foco;
  }
}

.mb-caja__codigo-fila { display: flex; gap: 8px; padding: 0 16px 16px; }
.mb-caja__codigo-fila .mb-caja__in { flex: 1; min-width: 0; height: 44px; }

.mb-caja__aplicar {
  height: 44px;
  padding: 0 16px;
  border-radius: 10px;
  border: 0;
  background: $azul;
  color: #fff;
  font-family: inherit;
  font-weight: 800;
  font-size: 14px;
  cursor: pointer;
  @include foco;
  &:disabled { opacity: .5; cursor: default; }
}

.mb-caja__fino { margin: 0; text-align: center; font-size: 12px; line-height: 1.6; color: $texto-3; }

.mb-caja__aviso {
  margin: 0;
  padding: 12px 14px;
  border-radius: 12px;
  background: rgba(255, 211, 90, .12);
  border: 1px solid $amarillo;
  color: $amarillo;
  font-weight: 700;
  font-size: 13px;
  line-height: 1.5;

  a { color: #fff; }
}

/* ── Canjear ──────────────────────────────────────────────────────── */

.mb-caja__saldos {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;

  > div {
    flex: 1 1 140px;
    padding: 12px 14px;
    border-radius: 12px;
    background: $panel-alto;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  span { font-size: 12px; color: $texto-4; }
  b { display: flex; align-items: center; gap: 6px; font-weight: 900; font-size: 18px; }
}

.mb-caja__form { display: flex; flex-direction: column; gap: 14px; }

.mb-caja__enviar {
  height: 50px;
  border-radius: 25px;
  border: 2px solid #fff;
  background: linear-gradient(180deg, #4fa2ff, #2f6fe0);
  color: #fff;
  font-family: inherit;
  font-weight: 900;
  font-size: 15px;
  cursor: pointer;
  @include foco;
  &:disabled { opacity: .5; cursor: default; }
}

.mb-caja__lista { display: flex; flex-direction: column; gap: 8px; }
.mb-caja__lista-t { font-weight: 900; font-size: 14px; }

.mb-caja__pedido {
  padding: 10px 12px;
  border-radius: 12px;
  background: $panel-alto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 13px;
}

.mb-caja__pedido-a { display: flex; flex-direction: column; gap: 2px; b { display: flex; align-items: center; gap: 5px; } }
.mb-caja__pedido-b { display: flex; align-items: center; gap: 8px; }

.mb-caja__chapa {
  padding: 3px 9px;
  border-radius: 8px;
  background: #24365e;
  color: $texto-3;
  font-weight: 900;
  font-size: 11px;

  &.is-pending { background: rgba(255, 211, 90, .16); color: $amarillo; }
  &.is-approved { background: rgba(63, 124, 240, .18); color: #9fc0ff; }
  &.is-paid { background: rgba(93, 255, 176, .14); color: $verde; }
  &.is-rejected { background: rgba(255, 91, 107, .14); color: #ff9aa5; }
}

.mb-caja__cancelar {
  height: 28px;
  padding: 0 10px;
  border-radius: 8px;
  border: 1px solid #ff5b6b;
  background: transparent;
  color: #ff9aa5;
  font-family: inherit;
  font-weight: 800;
  font-size: 12px;
  cursor: pointer;
  @include foco;
}

.mb-tenue { color: $texto-4; }
</style>
