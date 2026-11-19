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

        <!--
          COMO PAGAR.

          Dos maneras, las dos de cripto: desde la billetera del
          navegador, o copiando la dirección. Es la misma plata y la
          misma dirección; cambia quién la escribe.
        -->
        <template v-if="lado === 'in'">
          <span class="mb-caja__grupo">{{ $t('wallet.groupCrypto') }}</span>

          <button
            type="button" class="mb-caja__metodo" :class="{ 'is-elegido': metodo === 'billetera' }"
            :aria-pressed="String(metodo === 'billetera')" @click="metodo = 'billetera'"
          >
            <span class="mb-caja__metodo-t">{{ $t('wallet.connectWallet') }}</span>
            <span class="mb-caja__puntos">
              <MbMarcaDeBilletera
                v-for="b in marcasDeBilletera" :key="b.id"
                :marca-id="b.id" :nombre="b.nombre" :icono="b.icono"
              />
              <span class="mb-caja__mas">{{ $t('wallet.scanChip') }}</span>
            </span>
          </button>

          <button
            type="button" class="mb-caja__metodo" :class="{ 'is-elegido': metodo === 'direccion' }"
            :aria-pressed="String(metodo === 'direccion')" @click="metodo = 'direccion'"
          >
            <span class="mb-caja__metodo-t">{{ $t('wallet.cryptocurrencies') }}</span>
            <span class="mb-caja__puntos">
              <MbMoneda
                v-for="m in monedas.slice(0, 4)" :key="m.ticker"
                :ticker="m.ticker" :color="m.color" :letra="m.letra"
              />
              <span v-if="monedas.length > 4" class="mb-caja__mas">+{{ monedas.length - 4 }}</span>
            </span>
          </button>
        </template>

        <button v-else type="button" class="mb-caja__metodo is-elegido" aria-pressed="true">
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
          <span>{{ metodo === 'billetera' ? $t('wallet.payFromWallet') : $t('wallet.payWithCrypto') }}</span>
          <button type="button" class="mb-caja__x" :aria-label="$t('action.cancel')" @click="cerrar">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"
                 stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>

        <p v-if="deposito && !deposito.conectada" class="mb-caja__aviso">
          {{ $t('wallet.notConnected') }}
        </p>

        <!--
          ══ PAGAR DESDE LA BILLETERA ═══════════════════════════════

          La plata va a la MISMA direccion que muestra la otra manera.
          Esto le ahorra al jugador copiarla y pegarla, que es donde se
          pierden los depositos.
        -->
        <template v-else-if="metodo === 'billetera'">
          <div class="mb-caja__conectar">
            <span class="mb-caja__conectar-iconos" aria-hidden="true">
              <MbMarcaDeBilletera
                v-for="b in marcasDeBilletera" :key="b.id" class="mb-caja__marca-grande"
                :marca-id="b.id" :nombre="b.nombre" :icono="b.icono"
              />
            </span>

            <b class="mb-caja__conectar-t">{{ $t('wallet.connectTitle') }}</b>
            <p class="mb-caja__conectar-p">
              {{ enEsteNavegador && !billeteras.length ? $t('wallet.connectNone') : $t('wallet.connectSub') }}
            </p>

            <!--
              LAS DOS MANERAS DE PAGAR DESDE TU BILLETERA.

              Desde ESTE navegador, apretando un boton, o desde el
              TELEFONO, escaneando. Es la misma cosa con dos caminos,
              asi que es una perilla aca adentro y no otra tarjeta en la
              lista de la izquierda.
            -->
            <div class="mb-caja__como" role="group" :aria-label="$t('wallet.connectTitle')">
              <button
                type="button" :class="{ 'is-elegido': comoPago === 'aqui' }"
                :aria-pressed="String(comoPago === 'aqui')" @click="elegirComo('aqui')"
              >{{ $t('wallet.payHere') }}</button>
              <button
                type="button" :class="{ 'is-elegido': comoPago === 'qr' }"
                :aria-pressed="String(comoPago === 'qr')" @click="elegirComo('qr')"
              >{{ $t('wallet.scanTitle') }}</button>
            </div>

            <template v-if="hayComoPagar">
              <!-- Que moneda y en que red. Las que sabe mandar la
                   manera elegida: escaneando entran mas, Solana entre
                   ellas. -->
              <div class="mb-caja__conectar-campos">
                <span class="mb-caja__campo">
                  {{ $t('wallet.coin') }}
                  <MbElegir
                    v-model="tickerElegido"
                    :opciones="enEsteNavegador ? opcionesDeMonedaBilletera : opcionesDeMonedaQr"
                    @elegida="enEsteNavegador ? alCambiarMonedaBilletera() : alCambiarMonedaQr()"
                  >
                    <template #icono="{ o }">
                      <MbMoneda v-if="o" :ticker="o.valor" :color="o.color" :letra="o.letra" />
                    </template>
                  </MbElegir>
                </span>

                <span class="mb-caja__campo">
                  {{ $t('wallet.network') }}
                  <MbElegir
                    v-model="redElegida"
                    :opciones="enEsteNavegador ? opcionesDeRedBilletera : opcionesDeRedQr"
                    @elegida="traerDeposito"
                  >
                    <template #icono="{ o }">
                      <MbMoneda v-if="o" :ticker="o.valor" :color="o.color" :letra="o.letra" />
                    </template>
                  </MbElegir>
                </span>
              </div>

              <template v-if="!txHash">
                <div class="mb-caja__billetera-fila">
                  <input
                    v-model="montoCripto" class="mb-caja__in" inputmode="decimal"
                    :placeholder="$t('wallet.amountIn', { coin: tickerElegido })"
                    :aria-label="$t('wallet.amountIn', { coin: tickerElegido })"
                  >
                  <span class="mb-caja__billetera-tk">{{ tickerElegido }}</span>
                </div>

                <div v-if="enEsteNavegador" class="mb-caja__billetera-botones">
                  <button
                    v-for="b in billeteras" :key="b.id" type="button"
                    class="mb-caja__conectar-b" :disabled="pagando || !hayDireccion"
                    @click="pagarCon(b)"
                  >
                    <MbMarcaDeBilletera :marca-id="b.id" :nombre="b.nombre" :icono="b.icono" />
                    {{ $t('wallet.payWith', { wallet: b.nombre }) }}
                  </button>
                </div>

                <!--
                  EL QR CON TODO PUESTO.

                  No es el QR de la direccion pelada: adentro van la
                  moneda, la red y el monto, asi la billetera del
                  telefono abre la pantalla de enviar completa.
                -->
                <template v-else>
                  <div class="mb-caja__qr mb-caja__qr--pago">
                    <img v-if="qrDePago" :src="qrDePago" :alt="$t('wallet.qrAlt')">
                    <span v-else class="mb-caja__qr-vacio">{{ $t('wallet.scanWaiting') }}</span>
                  </div>

                  <a
                    v-if="enlaceDePagoActual" :href="enlaceDePagoActual"
                    class="mb-caja__conectar-b mb-caja__qr-abrir"
                  >{{ $t('wallet.scanOpen') }}</a>
                </template>

                <p class="mb-caja__fino">
                  {{ enEsteNavegador
                    ? $t('wallet.walletNote', { net: red.nombre })
                    : $t('wallet.scanNote', { coin: tickerElegido, net: red.nombre }) }}
                </p>
              </template>

              <template v-else>
                <p class="mb-caja__billetera-ok">{{ $t('wallet.walletSent') }}</p>
                <a :href="enlaceDeLaTx" target="_blank" rel="noopener" class="mb-caja__billetera-link">
                  {{ txCorto }}
                </a>
                <p class="mb-caja__fino">
                  {{ $t('wallet.minAndConfirms', { min: minimo, n: red.confirmaciones, time: red.demora }) }}
                </p>
              </template>
            </template>
          </div>

          <!-- Lo que se puede pagar asi, a la vista. -->
          <div class="mb-caja__soportadas">
            <span>{{ $t('wallet.supportedCoins') }}</span>
            <span class="mb-caja__puntos">
              <MbMoneda
                v-for="m in monedasDeBilletera" :key="m.ticker"
                :ticker="m.ticker" :color="m.color" :letra="m.letra"
              />
            </span>
          </div>

          <!-- Y la salida para el que paga desde un exchange o en Tron. -->
          <button type="button" class="mb-caja__salida" @click="metodo = 'direccion'">
            {{ $t('wallet.fromExchange') }}
            <b>{{ $t('wallet.useAddress') }}</b>
          </button>
        </template>

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

        <!--
          La moneda y la red, los dos selectores del diseño. Solo en la
          manera de la dirección: la otra tiene los suyos adentro del
          panel, con las monedas que una billetera sabe mandar.
        -->
        <template v-if="metodo === 'direccion'">
          <span class="mb-caja__campo">
            {{ $t('wallet.coin') }}
            <MbElegir v-model="tickerElegido" :opciones="opcionesDeMoneda" @elegida="alCambiarMoneda">
              <template #icono="{ o }">
                <MbMoneda v-if="o" :ticker="o.valor" :color="o.color" :letra="o.letra" />
              </template>
            </MbElegir>
          </span>

          <span class="mb-caja__campo">
            {{ $t('wallet.network') }}
            <MbElegir v-model="redElegida" :opciones="opcionesDeRed" @elegida="traerDeposito">
              <template #icono="{ o }">
                <MbMoneda v-if="o" :ticker="o.valor" :color="o.color" :letra="o.letra" />
              </template>
            </MbElegir>
          </span>

          <p class="mb-caja__fino">
            {{ $t('wallet.minAndConfirms', { min: minimo, n: red.confirmaciones, time: red.demora }) }}
            <br>{{ $t('wallet.belowMin') }}
          </p>
        </template>

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

          <!--
            SIN VERIFICAR NO HAY FORMULARIO.

            Dejarlo escribir el monto, elegir la moneda, pegar la
            direccion y recien ahi decirle que no, es hacerle perder el
            tiempo dos veces: la de llenarlo y la de entender por que
            no salio.
          -->
          <div v-if="!verificado" class="mb-caja__verificar">
            <span class="mb-caja__verificar-ico" aria-hidden="true">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 3l7.5 3v5.4c0 4.3-3 8.2-7.5 9.6-4.5-1.4-7.5-5.3-7.5-9.6V6z" />
                <path d="m9 12 2.1 2.1L15.5 9.7" />
              </svg>
            </span>

            <b class="mb-caja__verificar-t">{{ $t('wallet.verifyTitle') }}</b>
            <p class="mb-caja__verificar-p">{{ $t('wallet.verifyBody') }}</p>
            <p class="mb-caja__verificar-n">
              {{ $t('wallet.verifyLevel', { tiene: canje.nivel, pide: canje.nivelQuePide }) }}
            </p>

            <router-link
              to="/profile?tab=verification" class="mb-caja__enviar mb-caja__verificar-b"
              @click.native="cerrar"
            >{{ $t('wallet.verifyCta') }}</router-link>
          </div>

          <form v-else class="mb-caja__form" @submit.prevent="canjear">
            <label class="mb-caja__campo">
              {{ $t('profile.amount') }}
              <span class="mb-caja__select mb-caja__select--monto">
                <span class="mb-sc mb-sc--18 mb-caja__scico" aria-hidden="true">SC</span>
                <input
                  v-model="monto" inputmode="decimal" placeholder="0.00"
                  :disabled="!puedeCanjear"
                >

                <!--
                  CUANTO ES ESO EN LA MONEDA QUE ELIGIO.

                  Solo cuando se puede decir exacto: SC esta atado al
                  dolar, asi que en USDT y USDC es uno a uno. Para
                  bitcoin haria falta una cotizacion, y un numero
                  inventado al lado de un monto de plata no va.
                -->
                <span v-if="enMoneda" class="mb-caja__igual">
                  = <MbMoneda :ticker="tickerElegido" :color="moneda.color" :letra="moneda.letra" chica />
                  {{ enMoneda }}
                </span>

                <button type="button" class="mb-caja__todo" :disabled="!puedeCanjear" @click="monto = String(canje.disponibleSc)">
                  {{ $t('wallet.max') }}
                </button>
              </span>
              <span class="mb-caja__minimo">
                {{ $t('wallet.minCashOut', { n: plata(canje.minimoSc) }) }}
              </span>
            </label>

            <span class="mb-caja__campo">
              {{ $t('wallet.coin') }}
              <MbElegir
                v-model="tickerElegido" :opciones="opcionesDeMoneda"
                :deshabilitado="!puedeCanjear" @elegida="alCambiarMoneda"
              >
                <template #icono="{ o }">
                  <MbMoneda v-if="o" :ticker="o.valor" :color="o.color" :letra="o.letra" />
                </template>
              </MbElegir>
            </span>

            <span class="mb-caja__campo">
              {{ $t('wallet.network') }}
              <MbElegir v-model="redElegida" :opciones="opcionesDeRed" :deshabilitado="!puedeCanjear">
                <template #icono="{ o }">
                  <MbMoneda v-if="o" :ticker="o.valor" :color="o.color" :letra="o.letra" />
                </template>
              </MbElegir>
            </span>

            <!--
              LO QUE CUESTA LA RED.

              Son los numeros de la pasarela, no una estimacion: en
              USDT por Ethereum la comision son 2 USDT, y el que saca
              5 no tiene por que enterarse despues.
            -->
            <p v-if="red.comision !== undefined" class="mb-caja__fino">
              {{ $t('wallet.networkFee', { fee: red.comision, min: red.retiroMinimo, coin: tickerElegido }) }}
            </p>

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
import MbElegir from "@/components/MbElegir.vue";
import MbMoneda from "@/components/MbMoneda.vue";
import MbMarcaDeBilletera from "@/components/MbMarcaDeBilletera.vue";
import { parDeBilletera, enlaceDePago, SOLANA } from "@/utils/cadenas";
import { billeterasDisponibles, enlaceDeTx, pagar } from "@/utils/billeteras";

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

  components: { MbElegir, MbMoneda, MbMarcaDeBilletera },

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
      /* El del enlace de pago, que es otro: lleva monto y moneda. */
      qrDePago: "",
      /*
        COMO PAGA DESDE SU BILLETERA: "aqui" o "qr".

        Arranca en la del navegador si tiene alguna instalada --es la
        que menos pasos tiene-- y en el QR si no tiene ninguna, que es
        lo unico que le sirve.
      */
      comoPago: "aqui",
      relojDelQr: null,
      copiado: false,
      monto: "",
      direccion: "",
      mandando: false,
      minimo: 10,
      codigo: "",
      codigoAbierto: false,
      aplicando: false,

      /* Como se paga: desde la billetera del navegador, o copiando
         la direccion. Arranca en la direccion y pasa sola a la
         billetera si el navegador tiene una. */
      metodo: "direccion",
      billeteras: [],
      montoCripto: "",
      pagando: false,
      txHash: "",
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

    /*
      Lo que ve el selector: nombre a la izquierda, ticker a la
      derecha y la monedita adelante, como en el diseño.
    */
    opcionesDeMoneda() {
      return this.monedas.map((m) => ({
        valor: m.ticker,
        texto: m.nombre,
        derecha: m.ticker,
        color: m.color,
        letra: m.letra,
      }));
    },

    opcionesDeRed() {
      return (this.moneda.redes || []).map((r) => ({
        valor: r.clave,
        texto: r.nombre,
        nota: r.demora,
        /* "TRC20" al costado de "Tron Network" ayuda; "Polygon" al
           costado de "Polygon" es ruido. */
        derecha: r.clave.toUpperCase() === r.nombre.toUpperCase() ? "" : r.clave,
        color: r.color,
      }));
    },

    /* "USDT (TRC20)" cuando hay varias redes; "BTC" cuando hay una. */
    tickerLargo() {
      return (this.moneda.redes || []).length > 1
        ? `${this.tickerElegido} (${this.redElegida})`
        : this.tickerElegido;
    },

    /*
      SI ESTE PAR SE PUEDE PAGAR CON UN BOTON.

      Hacen falta tres cosas: que la moneda y la red sean de las que
      habla una billetera de navegador (ver utils/cadenas.js), que la
      pasarela ya nos haya dado la dirección, y que el navegador tenga
      alguna billetera instalada. Si falta una, queda la dirección y el
      QR, que es lo que siempre hubo.
    */
    /**
     * LAS TRES MARCAS DE LA TARJETA.
     *
     * Las que el navegador tenga instaladas, y si no llega a tres, se
     * completan con las de siempre. Una tarjeta vacía no dice de qué se
     * trata; tres logos sí, y el "no encontramos ninguna" se cuenta
     * adentro, cuando la elegís.
     */
    marcasDeBilletera() {
      const puestas = this.billeteras.slice(0, 3).map((b) => ({
        id: b.id, nombre: b.nombre, icono: b.icono,
      }));

      const siempre = [
        { id: "metamask", nombre: "MetaMask", icono: "" },
        { id: "phantom", nombre: "Phantom", icono: "" },
        { id: "coinbase", nombre: "Coinbase Wallet", icono: "" },
      ];

      for (const m of siempre) {
        if (puestas.length >= 3) break;
        const yaEsta = puestas.some((p) => `${p.id} ${p.nombre}`.toLowerCase().includes(m.id));
        if (!yaEsta) puestas.push(m);
      }

      return puestas;
    },

    /* Las monedas que una billetera de navegador sabe mandar. */
    monedasDeBilletera() {
      return this.monedas.filter((m) => (m.redes || []).some((r) => parDeBilletera(m.ticker, r.clave)));
    },

    opcionesDeMonedaBilletera() {
      return this.monedasDeBilletera.map((m) => ({
        valor: m.ticker,
        texto: m.nombre,
        derecha: m.ticker,
        color: m.color,
        letra: m.letra,
      }));
    },

    monedasDeQr() {
      return this.monedas.filter((m) => (m.redes || []).some((r) => this.sePuedeEscanear(m.ticker, r.clave)));
    },

    opcionesDeMonedaQr() {
      return this.monedasDeQr.map((m) => ({
        valor: m.ticker, texto: m.nombre, derecha: m.ticker, color: m.color, letra: m.letra,
      }));
    },

    opcionesDeRedQr() {
      return (this.moneda.redes || [])
        .filter((r) => this.sePuedeEscanear(this.tickerElegido, r.clave))
        .map((r) => ({
          valor: r.clave,
          texto: r.nombre,
          derecha: r.clave.toUpperCase() === r.nombre.toUpperCase() ? "" : r.clave,
          color: r.color,
          letra: r.letra,
        }));
    },

    enEsteNavegador() { return this.comoPago === "aqui"; },

    /*
      EL MONTO EN LA MONEDA ELEGIDA.

      SC esta atado al dolar, asi que en las monedas atadas al dolar es
      uno a uno y se puede decir exacto. En las demas no: hace falta
      una cotizacion, y hasta que la haya es mejor no decir nada que
      decir un numero que no es.
    */
    enMoneda() {
      const ATADAS = ["USDT", "USDC"];
      if (!ATADAS.includes(this.tickerElegido)) return "";

      const n = Number(String(this.monto).replace(",", "."));
      if (!Number.isFinite(n) || n <= 0) return "0";

      return this.plata(n);
    },

    /* Con qué se puede pagar de la manera elegida. */
    hayComoPagar() {
      return this.enEsteNavegador ? this.billeteras.length > 0 : this.monedasDeQr.length > 0;
    },

    /** El enlace de pago de lo que esta elegido ahora, o "". */
    enlaceDePagoActual() {
      if (!this.hayDireccion) return "";
      return enlaceDePago(this.tickerElegido, this.redElegida, this.deposito.direccion, this.montoCripto);
    },

    opcionesDeRedBilletera() {
      return (this.moneda.redes || [])
        .filter((r) => parDeBilletera(this.tickerElegido, r.clave))
        .map((r) => ({
          valor: r.clave,
          texto: r.nombre,
          derecha: r.clave.toUpperCase() === r.nombre.toUpperCase() ? "" : r.clave,
          color: r.color,
          letra: r.letra,
        }));
    },

    /*
      La direccion la contesta el servidor, asi que durante el primer
      instante --y si la respuesta falla-- `deposito` es null. Sin esto,
      el boton de pagar lo leia igual y la pantalla se caia entera en
      vez de mostrar el cajon a medio cargar.
    */
    hayDireccion() {
      return !!(this.deposito && this.deposito.direccion);
    },

    /* El nivel que pide el canje lo dice el panel, no esta fijo aca. */
    verificado() {
      return !!this.canje && (this.canje.nivel || 0) >= this.canje.nivelQuePide;
    },

    sePuedePagarConBilletera() {
      return !!(this.deposito && this.deposito.direccion
        && this.billeteras.length
        && parDeBilletera(this.tickerElegido, this.redElegida));
    },

    enlaceDeLaTx() {
      return enlaceDeTx(this.tickerElegido, this.redElegida, this.txHash);
    },

    txCorto() {
      const h = this.txHash || "";
      return h.length > 18 ? `${h.slice(0, 10)}…${h.slice(-8)}` : h;
    },

    puedeCanjear() {
      return this.verificado;
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
    metodo(v) {
      this.txHash = "";
      if (v !== "billetera") return;
      if (this.enEsteNavegador) this.aUnParDeBilletera();
      else this.alCambiarMonedaQr();
    },

    /*
      El QR se redibuja al cambiar moneda, red o monto. Con un respiro
      de un cuarto de segundo: si no, cada tecla del monto arma un QR
      que nadie llega a mirar.
    */
    enlaceDePagoActual(v) {
      window.clearTimeout(this.relojDelQr);
      if (!v) { this.qrDePago = ""; return; }
      this.relojDelQr = window.setTimeout(() => this.dibujarQrDePago(v), 250);
    },

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

    /**
     * PAGA CON LA BILLETERA ELEGIDA.
     *
     * Todo lo delicado --que la billetera esté en la cadena correcta y
     * que el contrato del token sea el que decimos-- pasa adentro de
     * `pagar()`. Acá solo quedan el monto, el aviso y el hash.
     *
     * NO ACREDITA NADA. La plata la acredita la pasarela cuando la red
     * confirma, igual que si hubiera copiado la dirección: este botón
     * no es un camino nuevo para el saldo, es uno nuevo para mandar.
     */
    async pagarCon(billetera) {
      const monto = String(this.montoCripto).trim();
      if (!monto) {
        this.$store.dispatch("avisar", { texto: this.$t("wallet.amountFirst"), tono: "error" });
        return;
      }

      this.pagando = true;
      try {
        const hash = await pagar({
          proveedor: billetera.proveedor,
          ticker: this.tickerElegido,
          red: this.redElegida,
          destino: this.deposito.direccion,
          monto,
        });

        this.txHash = hash;

        /* Queda anotado para soporte: "pagué y no me llegó" es la
           consulta más común, y sin el hash no hay nada que mirar. */
        api.post("/wallet/deposit/tx", {
          coin: this.tickerElegido,
          network: this.redElegida,
          hash,
          address: this.deposito.direccion,
        }).catch(() => {});

        this.$store.dispatch("avisar", { texto: this.$t("wallet.walletSent") });
      } catch (err) {
        /* 4001 es "el jugador apretó cancelar": eso no es un error. */
        if (err && err.code === 4001) return;
        this.$store.dispatch("avisar", {
          texto: this.$t("wallet.walletFailed", { why: (err && err.message) || "" }),
          tono: "error",
        });
      } finally {
        this.pagando = false;
      }
    },

    async buscarBilleteras() {
      try {
        this.billeteras = await billeterasDisponibles();
      } catch {
        this.billeteras = [];
      }

      /*
        CON UNA BILLETERA INSTALADA, ESA ES LA MANERA DE ARRANQUE.
        Es la que menos pasos tiene y la que no deja copiar mal una
        direccion. Sin billetera, ni se ofrece de entrada.
      */
      /*
        Sin billetera instalada, la manera util es el QR del telefono:
        arrancar en "pagar desde este navegador" seria ofrecerle lo
        unico que no puede hacer.
      */
      this.comoPago = this.billeteras.length ? "aqui" : "qr";

      if (this.lado === "in") {
        this.metodo = "billetera";
        if (this.billeteras.length) this.aUnParDeBilletera();
        else this.alCambiarMonedaQr();
      }
    },

    /** Deja elegida una moneda y una red que la billetera sepa mandar. */
    aUnParDeBilletera() {
      if (parDeBilletera(this.tickerElegido, this.redElegida)) return;

      const moneda = this.monedasDeBilletera.find((m) => m.ticker === this.tickerElegido)
        || this.monedasDeBilletera[0];
      if (!moneda) return;

      const red = (moneda.redes || []).find((r) => parDeBilletera(moneda.ticker, r.clave));
      if (!red) return;

      this.tickerElegido = moneda.ticker;
      this.redElegida = red.clave;
      this.traerDeposito();
    },

    /* Al cambiar de moneda en el panel de la billetera, la red tiene
       que ser una que esa billetera sepa mandar. */
    /**
     * LAS QUE SE PUEDEN ESCANEAR.
     *
     * Las mismas que la billetera del navegador, mas Solana: Solana no
     * tiene boton --armar su transaccion pide la libreria entera-- pero
     * un enlace `solana:` lo lee Phantom igual.
     */
    sePuedeEscanear(ticker, red) {
      return !!(parDeBilletera(ticker, red)
        || (String(red).toLowerCase() === "solana" && SOLANA.tokens[String(ticker).toUpperCase()]));
    },

    /*
      CAMBIAR DE MANERA.

      Al pasar al QR, el par elegido puede no servir para la otra: de
      la billetera del navegador se puede venir con uno que ella sabe
      mandar, y escaneando entran mas. Se deja uno que sirva.
    */
    elegirComo(cual) {
      if (this.comoPago === cual) return;
      this.comoPago = cual;
      this.txHash = "";
      if (cual === "aqui") this.aUnParDeBilletera();
      else this.alCambiarMonedaQr();
    },

    /* Igual que el de la billetera, pero con las que se escanean. */
    alCambiarMonedaQr() {
      const moneda = this.monedas.find((m) => m.ticker === this.tickerElegido);
      const red = ((moneda && moneda.redes) || []).find((r) => this.sePuedeEscanear(this.tickerElegido, r.clave));
      this.redElegida = red ? red.clave : this.redElegida;
      this.traerDeposito();
    },

    alCambiarMonedaBilletera() {
      const moneda = this.monedas.find((m) => m.ticker === this.tickerElegido);
      const red = ((moneda && moneda.redes) || []).find((r) => parDeBilletera(this.tickerElegido, r.clave));
      this.redElegida = red ? red.clave : this.redElegida;
      this.traerDeposito();
    },

    async traerDeposito() {
      if (!this.entro) return;
      this.deposito = null;
      this.qr = "";
      this.copiado = false;
      this.txHash = "";

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

    /** El QR del enlace de pago. Se dibuja igual que el de la direccion. */
    async dibujarQrDePago(texto) {
      try {
        const QR = (await import(/* webpackChunkName: "qr" */ "qrcode")).default;
        this.qrDePago = await QR.toDataURL(texto, {
          margin: 1,
          width: 300,
          color: { dark: "#0b1424", light: "#ffffff" },
        });
      } catch (err) {
        /* Sin QR queda el boton de abrir en la billetera. */
        this.qrDePago = "";
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
    /**
     * UN CODIGO, DEL TIPO QUE SEA.
     *
     * El servidor averigua si es de un afiliado o de una promoción y
     * contesta qué pasó; acá solo se dice con palabras. El jugador no
     * tiene por qué saber de qué tipo es el suyo.
     */
    async aplicarCodigo() {
      this.aplicando = true;
      try {
        const { data } = await api.post("/wallet/code", { code: this.codigo.trim() });
        const d = data.data;

        this.codigo = "";
        this.codigoAbierto = false;

        if (d.tipo === "promo") {
          this.$store.commit("saldo", d);
          this.$store.dispatch("avisar", {
            texto: d.tipo === "promo" && d.tipoPromo === "aperturas"
              ? this.$t("rewards.codeBoxes", { code: d.codigo, n: d.aperturas })
              : this.$t("rewards.codeBalance", { code: d.codigo, amount: this.plata(d.montoSc) }),
          });
        } else {
          this.$store.dispatch("avisar", {
            texto: this.$t("wallet.codeOn", { code: d.code, pct: d.bonoPct }),
          });
        }
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
    if (this.lado === "in") {
      this.traerDeposito();
      this.buscarBilleteras();
    } else {
      this.traerCanje();
    }
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
  max-height: calc(100vh / var(--escala, 1) - 32px);
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

/* El rombito de la red, del mismo tamaño que la monedita. */
.mb-caja__red {
  width: 26px;
  height: 26px;
  flex: none;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

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

/* ── Las dos maneras de pagar ──────────────────────────────────────── */

.mb-caja__grupo {
  font-weight: 900;
  font-size: 11px;
  letter-spacing: .12em;
  text-transform: uppercase;
  color: $texto-4;
}

.mb-caja__icono {
  width: 26px;
  height: 26px;
  border-radius: 8px;
  /* Un escalón más claro que la tarjeta: si fuera el mismo tono, la
     letra flotaría sin chapa y no se leería como un icono. */
  background: #1d3354;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 900;
  font-size: 12px;
  overflow: hidden;

  img { display: block; }
  &--grande { width: 44px; height: 44px; border-radius: 12px; }
}

/* El panel grande de conectar, como en el diseño de referencia. */
.mb-caja__conectar {
  border-radius: 16px;
  background: $panel-alto;
  border: 1px solid $borde;
  padding: 22px 18px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  text-align: center;

  @include en-celular { padding: 18px 14px; }
}

.mb-caja__conectar-iconos { display: flex; gap: 8px; }

// Las dos maneras de pagar desde la billetera, una al lado de la otra.
/*
  EL CAMPO DEL MONTO DEL RETIRO.

  Tres cosas en una linea: lo que escribe, cuanto es eso en la moneda
  elegida, y "Todo". El boton deja de estar en posicion absoluta: con
  el equivalente al lado se pisaban.
*/
.mb-caja__select--monto {
  input { width: auto; flex: 1; min-width: 0; padding-right: 6px; }
  .mb-caja__todo { position: static; flex: none; margin: 0 10px 0 0; }
}

// El "= 25.00 USDT" adentro del campo, y el minimo abajo.
.mb-caja__igual {
  display: flex;
  align-items: center;
  gap: 5px;
  flex: none;
  padding-right: 4px;
  font-weight: 800;
  font-size: 14px;
  color: $texto-3;
}

.mb-caja__minimo {
  display: block;
  margin-top: 7px;
  font-weight: 700;
  font-size: 12.5px;
  color: #6bb4ff;
  letter-spacing: 0;
  text-transform: none;
}

.mb-caja__como {
  display: flex;
  gap: 4px;
  padding: 4px;
  border-radius: 14px;
  background: $fondo;
  border: 1px solid #1f3355;

  button {
    flex: 1;
    min-width: 0;
    height: 38px;
    border-radius: 10px;
    border: 0;
    background: transparent;
    color: $texto-3;
    font-family: inherit;
    font-weight: 800;
    font-size: 13px;
    cursor: pointer;
    @include foco;
    &.is-elegido { background: $azul; color: #fff; }
  }
}

/* El QR del enlace de pago, y el boton de abrirlo en la billetera. */
.mb-caja__qr--pago {
  margin: 4px auto 0;
  min-height: 150px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mb-caja__qr-vacio { font-size: 13px; color: $texto-4; text-align: center; padding: 0 16px; }

.mb-caja__qr-abrir {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  align-self: center;
  min-width: 200px;
}
.mb-caja__marca-grande { width: 44px; height: 44px; border-radius: 12px; }
.mb-caja__conectar-t { font-weight: 900; font-size: 17px; }

.mb-caja__conectar-p {
  margin: 0;
  max-width: 340px;
  font-size: 13px;
  line-height: 1.55;
  color: $texto-3;
}

.mb-caja__conectar-campos {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 150px), 1fr));
  gap: 10px;
  text-align: left;
}

.mb-caja__conectar-b {
  width: 100%;
  height: 50px;
  padding: 0 20px;
  border-radius: 25px;
  border: 3px solid #fff;
  background: linear-gradient(180deg, #4fa2ff, #2f6fe0);
  color: #fff;
  font-family: inherit;
  font-weight: 900;
  font-size: 15px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  @include foco;

  img { border-radius: 5px; }
  &:hover:not(:disabled) { filter: brightness(1.07); }
  &:disabled { opacity: .5; cursor: default; }
}

.mb-caja__soportadas {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 0 4px;

  > span:first-child { font-weight: 800; font-size: 13px; color: $texto-4; }
}

.mb-caja__salida {
  border: 0;
  background: transparent;
  color: $texto-4;
  font-family: inherit;
  font-size: 13px;
  text-align: center;
  cursor: pointer;
  @include foco;

  b { color: #8fb4ff; }
  &:hover b { color: #fff; }
}

/* ── Pagar desde la billetera ──────────────────────────────────────── */

.mb-caja__billetera {
  border-radius: 14px;
  background: $panel-alto;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.mb-caja__billetera-cab {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-weight: 900;
  font-size: 11px;
  letter-spacing: .1em;
  text-transform: uppercase;
  color: $texto-4;
}

.mb-caja__billetera-red { color: #8fb4ff; letter-spacing: 0; text-transform: none; font-size: 12px; }

.mb-caja__billetera-fila {
  position: relative;
  display: flex;
  align-items: center;

  .mb-caja__in { padding-right: 60px; }
}

.mb-caja__billetera-tk {
  position: absolute;
  right: 12px;
  font-weight: 900;
  font-size: 13px;
  color: $texto-4;
  pointer-events: none;
}

.mb-caja__billetera-botones { display: flex; flex-wrap: wrap; gap: 8px; }

.mb-caja__billetera-b {
  flex: 1 1 120px;
  height: 44px;
  padding: 0 14px;
  border-radius: 12px;
  border: 0;
  background: $azul;
  color: #fff;
  font-family: inherit;
  font-weight: 800;
  font-size: 14px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  @include foco;

  img { border-radius: 4px; }
  &:hover:not(:disabled) { filter: brightness(1.08); }
  &:disabled { opacity: .5; cursor: default; }
}

.mb-caja__billetera-ok { margin: 0; font-weight: 800; font-size: 14px; color: $verde; }

.mb-caja__billetera-link {
  font-weight: 700;
  font-size: 12px;
  color: #8fb4ff;
  word-break: break-all;
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

// =====================================================================
//  LA PANTALLA DE "VERIFICATE PRIMERO"
//
//  Ocupa el lugar del formulario, no un costado: lo que hay que hacer
//  antes de retirar es esto, y no hay nada mas que mirar.
// =====================================================================

.mb-caja__verificar {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 26px 20px;
  border-radius: 16px;
  background: rgba(79, 155, 255, .08);
  border: 1px solid #27406b;
  text-align: center;
}

.mb-caja__verificar-ico {
  width: 54px;
  height: 54px;
  flex: none;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(79, 155, 255, .16);
  color: #6bb4ff;
}

.mb-caja__verificar-t { font-family: $fuente-cartel; font-size: 19px; line-height: 1.15; }
.mb-caja__verificar-p { margin: 0; font-size: 14px; line-height: 1.5; color: $texto-2; max-width: 34em; }
.mb-caja__verificar-n { margin: 0; font-size: 13px; font-weight: 700; color: $texto-4; }

.mb-caja__verificar-b {
  margin-top: 4px;
  width: auto;
  min-width: 200px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
}

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
