<template>
  <span class="mb-mon" :class="{ 'mb-mon--chica': chica }" :style="{ background: fondo }" aria-hidden="true">
    <!-- Bitcoin: la B con las dos barras. -->
    <svg v-if="ticker === 'BTC'" viewBox="0 0 24 24" fill="#fff">
      <path d="M9.2 4h1.7v2.1h1.1V4h1.7v2.2c2 .2 3.3 1.1 3.3 2.9 0 1.1-.6 1.9-1.6 2.2 1.3.3 2.1 1.2 2.1 2.6 0 2-1.4 3-3.8 3.2V19h-1.7v-1.8h-1.1V19H9.2v-1.8H6.4v-1.7h1.2V8.5H6.4V6.8h2.8V4Zm1.3 4.5v2.6h1.9c1 0 1.6-.4 1.6-1.3s-.6-1.3-1.7-1.3h-1.8Zm0 4.2v2.8h2.2c1.1 0 1.8-.5 1.8-1.4s-.7-1.4-1.9-1.4h-2.1Z" />
    </svg>

    <!-- Ethereum: el rombo partido. -->
    <svg v-else-if="ticker === 'ETH'" viewBox="0 0 24 24" fill="#fff">
      <path d="M12 2.5 6.2 12 12 15.4 17.8 12 12 2.5Z" opacity=".9" />
      <path d="M12 16.7 6.2 13.3 12 21.5l5.8-8.2L12 16.7Z" opacity=".65" />
    </svg>

    <!-- Tether: la T con la barra. -->
    <svg v-else-if="ticker === 'USDT'" viewBox="0 0 24 24" fill="#fff">
      <path d="M5 5h14v3.1h-5.3v1.5c3.2.2 5.6 1 5.6 2s-2.4 1.8-5.6 2v5.9h-3.4v-5.9c-3.2-.2-5.6-1-5.6-2s2.4-1.8 5.6-2V8.1H5V5Zm7 7.7c2.7 0 4.9-.4 4.9-1s-2.2-1-4.9-1-4.9.4-4.9 1 2.2 1 4.9 1Z" />
    </svg>

    <!-- USD Coin: el dólar. -->
    <svg v-else-if="ticker === 'USDC'" viewBox="0 0 24 24" fill="#fff">
      <path d="M11.1 3h1.8v1.7c1.9.2 3.2 1.2 3.5 2.9h-2.2c-.2-.8-.9-1.2-2.2-1.2-1.4 0-2.2.5-2.2 1.3 0 .7.5 1 2.4 1.4l.9.2c2.5.5 3.6 1.4 3.6 3.2 0 1.9-1.4 3.1-3.8 3.4V18h-1.8v-1.8c-2.1-.2-3.5-1.3-3.8-3.1h2.3c.2.9 1 1.4 2.5 1.4 1.5 0 2.4-.5 2.4-1.4 0-.7-.5-1.1-2.3-1.4l-1-.2C8.7 11 7.6 10.1 7.6 8.4c0-1.8 1.3-3 3.5-3.4V3Z" />
    </svg>

    <!-- Solana: las tres bandas inclinadas. -->
    <svg v-else-if="ticker === 'SOL'" viewBox="0 0 24 24" fill="#fff">
      <path d="M7.4 7.3c.1-.2.3-.3.6-.3h9.3c.3 0 .5.4.3.6l-1.7 1.7c-.1.2-.3.2-.5.2H6c-.3 0-.5-.3-.3-.5l1.7-1.7Z" />
      <path d="M7.4 14.8c.2-.2.4-.3.6-.3h9.3c.3 0 .5.4.3.6l-1.7 1.6c-.1.2-.3.3-.5.3H6c-.3 0-.5-.4-.3-.6l1.7-1.6Z" />
      <path d="M16.6 11.1c-.1-.2-.3-.3-.5-.3H6.8c-.3 0-.5.4-.3.6l1.7 1.6c.1.2.3.3.5.3h9.3c.3 0 .5-.4.3-.6l-1.7-1.6Z" />
    </svg>

    <!-- Litecoin: la Ł. -->
    <svg v-else-if="ticker === 'LTC'" viewBox="0 0 24 24" fill="#fff">
      <path d="M10.3 4h3.4l-1.8 7.1 2.6-.8-.5 2.1-2.6.8-.9 3.6h7l-.7 3.2H6.3l1.5-6-2.3.7.5-2.1 2.3-.7L10.3 4Z" />
    </svg>

    <!-- BNB: el rombo con los cuatro chicos. -->
    <svg v-else-if="ticker === 'BNB'" viewBox="0 0 24 24" fill="#fff">
      <path d="m12 3 2.6 2.6L12 8.2 9.4 5.6 12 3Zm-5.4 5.4L9.2 11l-2.6 2.6L4 11l2.6-2.6Zm10.8 0L20 11l-2.6 2.6L14.8 11l2.6-2.6ZM12 8.9 14.1 11 12 13.1 9.9 11 12 8.9Zm0 7.9 2.6 2.6L12 22l-2.6-2.6L12 16.8Z" />
    </svg>

    <!-- Tron: el triangulo con la barra. -->
    <svg v-else-if="ticker === 'TRX'" viewBox="0 0 24 24" fill="#fff">
      <path d="M4 5.5 20 8l-7.4 11.5L4 5.5Zm2.9 2.2 4.6 7.9.6-5.6-5.2-2.3Zm6.8 2.5-.6 5.3 4.2-6.5-3.6 1.2Zm3.1-1.4L8.3 7.2l7.4 3.3 1.1-1.7Z" />
    </svg>

    <!-- Dogecoin: la D con la barra. -->
    <svg v-else-if="ticker === 'DOGE'" viewBox="0 0 24 24" fill="#fff">
      <path d="M7 4h5.2c3.9 0 6.6 3.1 6.6 8s-2.7 8-6.6 8H7v-6.1H5v-2.3h2V4Zm3.3 2.6v4.9h3v2.3h-3v4.6h1.7c2.3 0 3.7-1.9 3.7-5.9s-1.4-5.9-3.7-5.9h-1.7Z" />
    </svg>

    <!-- Polygon: el hexagono. -->
    <svg v-else-if="ticker === 'POL'" viewBox="0 0 24 24" fill="#fff">
      <path d="M12 2.6 20 7v10l-8 4.4L4 17V7l8-4.4Zm0 2.5L6.2 8.3v7.4L12 18.9l5.8-3.2V8.3L12 5.1Zm0 3 3.2 1.8v3.4L12 16.6l-3.2-1.9v-3.4L12 9.6Z" />
    </svg>

    <!-- XRP: la equis cruzada. -->
    <svg v-else-if="ticker === 'XRP'" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.1" stroke-linecap="round">
      <path d="M5 5c2 2.6 4.3 4 7 4s5-1.4 7-4M5 19c2-2.6 4.3-4 7-4s5 1.4 7 4" />
    </svg>

    <!-- Monero: la M. -->
    <svg v-else-if="ticker === 'XMR'" viewBox="0 0 24 24" fill="#fff">
      <path d="M3.6 18V7l4.6 5.4L12 8.3l3.8 4.1L20.4 7v11h-3.2v-5.2L12 18.6l-5.2-5.8V18H3.6Z" />
    </svg>

    <!-- Cualquier otra: su inicial, que es lo que había antes. -->
    <span v-else class="mb-mon__letra">{{ letra }}</span>
  </span>
</template>

<script>
/**
 * LA MONEDITA.
 *
 * Un círculo del color de la moneda con su marca adentro, como en el
 * diseño. Las marcas están DIBUJADAS por nosotros --la B con barras,
 * el rombo, la T, el dólar, las bandas, la Ł-- y no son los logos de
 * nadie: son marcas registradas de terceros y además bajar seis
 * archivos para seis monedas es media pantalla de red por nada.
 *
 * La que no conocemos cae en su inicial, así una moneda nueva en la
 * tabla del servidor se ve bien sin tocar esto.
 */
export default {
  name: "MbMoneda",

  props: {
    ticker: { type: String, default: "" },
    color: { type: String, default: "#2b3a57" },
    letra: { type: String, default: "" },
    chica: { type: Boolean, default: false },
  },

  computed: {
    fondo() {
      /* Solana es la única con degradé en el diseño. */
      if (this.ticker === "SOL") return "linear-gradient(135deg, #9945ff, #19fb9b)";
      return this.color;
    },
  },
};
</script>

<style lang="scss" scoped>
.mb-mon {
  width: 26px;
  height: 26px;
  flex: none;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;

  svg { width: 16px; height: 16px; }
  &--chica { width: 20px; height: 20px; svg { width: 13px; height: 13px; } }
}

.mb-mon__letra { font-weight: 900; font-size: 13px; color: #fff; }
.mb-mon--chica .mb-mon__letra { font-size: 11px; }
</style>
