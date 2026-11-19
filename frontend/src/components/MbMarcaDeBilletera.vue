<template>
  <span class="mb-bmarca" :style="{ background: marca.fondo }" :title="marca.nombre">
    <img v-if="icono" :src="icono" :alt="nombre" width="20" height="20">

    <!--
      MetaMask: la cabeza del zorro.

      Simplificada a propósito: a 20 px, las veinte caras del logo de
      verdad son una mancha naranja. Con las orejas, el hocico claro y
      los dos ojos se reconoce igual, que es lo único que tiene que
      hacer un icono de este tamaño.
    -->
    <svg v-else-if="marca.id === 'metamask'" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d="M3.4 3.2 10 8h4l6.6-4.8-1.5 5.2 1.1 1.9-1.1 4.3 1 1.1-1.3 4.3-5-1.6h-3.6l-5 1.6-1.3-4.3 1-1.1-1.1-4.3 1.1-1.9z" fill="#e2761b" />
      <path d="M3.4 3.2 10 8l-.9 2.6-5.1-.3z" fill="#e4761b" />
      <path d="M20.6 3.2 14 8l.9 2.6 5.1-.3z" fill="#e4761b" />
      <path d="M8.6 14.9h6.8l.6 3.1-1.4.9H9.4l-1.4-.9z" fill="#f6851b" />
      <path d="M9.4 18.9h5.2l-.4 1.5H9.8z" fill="#c0ad9e" />
      <ellipse cx="9.1" cy="11.6" rx="1.15" ry="1.3" fill="#233447" />
      <ellipse cx="14.9" cy="11.6" rx="1.15" ry="1.3" fill="#233447" />
    </svg>

    <!-- Phantom: el fantasma, con el ruedo ondulado. -->
    <svg v-else-if="marca.id === 'phantom'" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        d="M12 4.4a7.7 7.7 0 0 0-7.7 7.7v6.6c0 .6.8.9 1.2.4l1.1-1.2c.3-.3.8-.3 1.1 0l1.1 1.2c.3.3.8.3 1.1 0l1.1-1.2c.3-.3.8-.3 1.1 0l1.1 1.2c.3.3.8.3 1.1 0l1.1-1.2c.3-.3.8-.3 1.1 0l1.1 1.2c.4.5 1.2.2 1.2-.4v-6.6A7.7 7.7 0 0 0 12 4.4Z"
        fill="#fff"
      />
      <ellipse cx="9.6" cy="11.7" rx=".95" ry="1.55" fill="#4e44ce" />
      <ellipse cx="14.4" cy="11.7" rx=".95" ry="1.55" fill="#4e44ce" />
    </svg>

    <!--
      Coinbase Wallet: el cuadrado redondeado adentro del círculo.

      Estaba al revés --círculo blanco, cuadrado azul-- y encima sobre
      la chapita azul, así que el círculo desaparecía y quedaba un
      cuadrado suelto.
    -->
    <svg v-else-if="marca.id === 'coinbase'" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="#fff" stroke-width="1.4" opacity=".55" />
      <rect x="8.9" y="8.9" width="6.2" height="6.2" rx="1.6" fill="#fff" />
    </svg>

    <!-- Cualquier otra: la inicial. -->
    <b v-else>{{ (nombre || "?").slice(0, 1) }}</b>
  </span>
</template>

<script>
/**
 * LA CHAPITA DE UNA BILLETERA.
 *
 * Con el icono que manda la billetera cuando está instalada, y con la
 * marca dibujada cuando no: la tarjeta de "Connect Wallet" muestra las
 * tres de siempre aunque el jugador no tenga ninguna, que es como se
 * entiende de qué se trata antes de instalar nada.
 *
 * Son marcas de terceros dibujadas simples, para decir "acá va
 * MetaMask". No son los logos oficiales ni pretenden serlo.
 */
const MARCAS = {
  metamask: { id: "metamask", nombre: "MetaMask", fondo: "#2a2a2e" },
  phantom: { id: "phantom", nombre: "Phantom", fondo: "#ab9ff2" },
  coinbase: { id: "coinbase", nombre: "Coinbase Wallet", fondo: "#0052ff" },
};

export default {
  name: "MbMarcaDeBilletera",

  props: {
    /** "metamask", "phantom", "coinbase", o el nombre que venga. */
    marcaId: { type: String, default: "" },
    nombre: { type: String, default: "" },
    /** El icono que manda la billetera instalada, si lo mandó. */
    icono: { type: String, default: "" },
  },

  computed: {
    marca() {
      const texto = `${this.marcaId} ${this.nombre}`.toLowerCase();
      const cual = Object.keys(MARCAS).find((k) => texto.includes(k));
      return cual ? MARCAS[cual] : { id: "otra", nombre: this.nombre, fondo: "#1d3354" };
    },
  },
};
</script>

<style lang="scss" scoped>
.mb-bmarca {
  width: 26px;
  height: 26px;
  flex: none;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  // Un filo claro arriba y la sombrita: la chapita deja de ser una
  // mancha de color y parece el icono de una aplicación.
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .22),
    inset 0 0 0 1px rgba(0, 0, 0, .18),
    0 1px 3px rgba(0, 0, 0, .35);

  img, svg { display: block; }
  b { font-weight: 900; font-size: 12px; color: #fff; }
}
</style>
