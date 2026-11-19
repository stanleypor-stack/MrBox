<template>
  <span class="mb-bmarca" :style="{ background: marca.fondo }" :title="marca.nombre">
    <img v-if="icono" :src="icono" :alt="nombre" width="20" height="20">

    <!-- MetaMask: el zorro, en dos planos. -->
    <svg v-else-if="marca.id === 'metamask'" viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
      <path d="M21 3 13.6 8.4l1.4-3.3z" fill="#e2761b" />
      <path d="M3 3l7.3 5.5-1.3-3.4z" fill="#e4761b" />
      <path d="M18.4 15.6l-2 3 4.2 1.2 1.2-4.1zM2.2 15.7l1.2 4.1 4.2-1.2-2-3z" fill="#e4761b" />
      <path d="M7.4 10.6L6.2 12.4l4.2.2-.1-4.5zm9.2 0l-3-2.6-.1 4.6 4.2-.2z" fill="#e4761b" />
      <path d="M7.6 18.6l2.5-1.2-2.2-1.7zm6.3-1.2l2.5 1.2-.3-2.9z" fill="#e4761b" />
      <path d="M16.4 18.6l-2.5-1.2.2 1.6v.7zm-8.8 0l2.3 1.1v-.7l.2-1.6z" fill="#d7c1b3" />
      <path d="M10 14.8l-2.1-.6 1.5-.7zm4 0l.6-1.3 1.5.7z" fill="#233447" />
    </svg>

    <!-- Phantom: el fantasma. -->
    <svg v-else-if="marca.id === 'phantom'" viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
      <path
        d="M19.8 11.4c0 4.1-3.3 7.4-7.3 7.4-1 0-1.6.5-2.4 1-.7.5-1.5 1-2.7 1-1.9 0-3.2-1.3-3.2-3.2 0-3.6 2.9-9.6 8.4-9.6 4 0 7.2 3.3 7.2 3.4z"
        fill="#fff"
      />
      <ellipse cx="10.4" cy="11.6" rx="1" ry="1.6" fill="#534bb1" />
      <ellipse cx="14" cy="11.6" rx="1" ry="1.6" fill="#534bb1" />
    </svg>

    <!-- Coinbase Wallet: el círculo con el cuadrado. -->
    <svg v-else-if="marca.id === 'coinbase'" viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="#fff" />
      <rect x="9.2" y="9.2" width="5.6" height="5.6" rx="1.4" fill="#0052ff" />
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

  img, svg { display: block; }
  b { font-weight: 900; font-size: 12px; color: #fff; }
}
</style>
