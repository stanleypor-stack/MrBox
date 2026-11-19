<template>
  <span class="mb-mk" :class="{ 'mb-mk--con-dibujo': dibujo }">
    <!-- Apple: la manzana. -->
    <svg v-if="dibujo === 'apple'" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" class="mb-mk__svg">
      <path d="M16.4 12.7c0-2.5 2-3.7 2.1-3.8-1.2-1.7-3-1.9-3.6-2-1.6-.2-3 .9-3.8.9s-2-.9-3.3-.9C6.1 7 4.5 8 3.6 9.6c-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.3 2.6 1.3-.1 1.8-.9 3.4-.9s2 .9 3.4.8c1.4 0 2.3-1.3 3.2-2.5.6-.9 1-1.8 1.3-2.8-2.9-1.1-3.1-4.2-3.1-4.3Z" />
      <path d="M13.9 5.4c.7-.9 1.2-2.1 1.1-3.3-1 0-2.3.7-3 1.6-.7.8-1.2 2-1.1 3.2 1.1.1 2.3-.6 3-1.5Z" />
    </svg>

    <!-- Rolex: la corona de cinco puntas. -->
    <svg v-else-if="dibujo === 'rolex'" viewBox="0 0 24 16" fill="currentColor" aria-hidden="true" class="mb-mk__svg">
      <circle cx="3.4" cy="4.4" r="1.5" />
      <circle cx="8.7" cy="2.6" r="1.5" />
      <circle cx="15.3" cy="2.6" r="1.5" />
      <circle cx="20.6" cy="4.4" r="1.5" />
      <circle cx="12" cy="1.9" r="1.5" />
      <path d="M3.4 5.6h17.2l-1.5 5.2H4.9z" />
      <rect x="4.3" y="11.8" width="15.4" height="1.9" rx=".7" />
    </svg>

    <!-- PlayStation: el monograma. -->
    <svg v-else-if="dibujo === 'playstation'" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" class="mb-mk__svg">
      <path d="M9.6 2.6v16.6l3.5 1.1V7.4c0-.8.3-1.1.9-.9.6.2.9.8.9 1.7v4.6c2.2 1.1 4 .3 4-2.6 0-3-1.1-4.4-4.2-5.4-1.6-.6-3.4-1.1-5.1-1.5z" />
      <path d="m14.7 18.6 5.6-2c.6-.2.8-.6.2-.8-.6-.2-1.5-.2-2.1 0l-3.7 1.3v-2.1l.3-.1c.2 0 .6-.2 1.3-.3 2.7-.5 4.8.3 4.8 1.6 0 1.3-1.6 2.2-3.6 2.9l-2.8 1zM4.2 18.1c-.8-.2-1.4-.6-1.6-1.2-.3-.9.3-2 2.1-2.6l3.4-1.2v2.1l-2.5.9c-.6.2-.8.6-.2.8.6.2 1.5.2 2.1 0l.6-.2v1.9c-1.3.2-2.7.1-3.9-.5z" />
    </svg>

    <!-- Mercedes: la estrella de tres puntas. -->
    <svg v-else-if="dibujo === 'mercedes'" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         stroke-width="1.7" aria-hidden="true" class="mb-mk__svg">
      <circle cx="12" cy="12" r="9.6" />
      <path d="M12 12V2.6M12 12l8.2 4.8M12 12 3.8 16.8" />
    </svg>

    <!-- BMW: los cuartos del rodete. -->
    <svg v-else-if="dibujo === 'bmw'" viewBox="0 0 24 24" aria-hidden="true" class="mb-mk__svg">
      <circle cx="12" cy="12" r="9.4" fill="none" stroke="currentColor" stroke-width="1.7" />
      <path d="M12 3.6A8.4 8.4 0 0 0 3.6 12H12z" fill="currentColor" />
      <path d="M12 20.4a8.4 8.4 0 0 0 8.4-8.4H12z" fill="currentColor" />
    </svg>

    <!-- Nike: la pipa. -->
    <svg v-else-if="dibujo === 'nike'" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" class="mb-mk__svg">
      <path d="M22.4 6.2 7.2 16.2c-1.2.8-2.2 1.2-3 1.2-.9 0-1.6-.4-2-1.1-.6-1.1 0-2.8 1.6-4.6.4-.5.8-.9 1.1-1.2-.3.4-1.3 2.1-.2 2.9.4.3 1 .3 1.7.1.6-.1 1.3-.4 2.1-.8z" />
    </svg>

    <!-- Cualquier otra: su nombre, con la tipografia que la distingue. -->
    <span v-else class="mb-mk__texto" :style="estiloDelTexto">{{ rotulo }}</span>

    <!-- Las que llevan dibujo Y nombre. -->
    <span v-if="dibujo && conNombre" class="mb-mk__pie">{{ rotulo }}</span>
  </span>
</template>

<script>
/**
 * LA CHAPA DE UNA MARCA, EN LA PORTADA.
 *
 * Las marcas son de sus dueños: acá se dibujan simples, en un color
 * solo, para decir "tenemos cosas de esta marca" y llevar al catálogo
 * filtrado. No son los logos oficiales, no se bajan de ningún lado y no
 * se usan como si fueran nuestros.
 *
 * La que no tiene dibujo va escrita, que es como estaba todo antes: un
 * nombre con la tipografía justa se reconoce igual.
 */
export default {
  name: "MbMarca",

  props: {
    /** "apple", "rolex", "playstation", "mercedes", "bmw", "nike" o "". */
    dibujo: { type: String, default: "" },
    rotulo: { type: String, default: "" },
    /** Si el dibujo va acompañado del nombre abajo. */
    conNombre: { type: Boolean, default: false },
    tamano: { type: String, default: "24px" },
    espacio: { type: String, default: "0" },
    caja: { type: String, default: "none" },
  },

  computed: {
    estiloDelTexto() {
      return { fontSize: this.tamano, letterSpacing: this.espacio, textTransform: this.caja };
    },
  },
};
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

.mb-mk {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: #fff;
}

.mb-mk__svg { width: 38px; height: 38px; display: block; }
.mb-mk--con-dibujo .mb-mk__svg { filter: drop-shadow(0 2px 4px rgba(0, 0, 0, .35)); }

.mb-mk__texto { font-weight: 800; line-height: 1; }

.mb-mk__pie {
  font-weight: 800;
  font-size: 12px;
  letter-spacing: .26em;
  text-transform: uppercase;
  line-height: 1;
}

@include en-celular {
  .mb-mk__svg { width: 32px; height: 32px; }
  .mb-mk__pie { font-size: 11px; }
}
</style>
