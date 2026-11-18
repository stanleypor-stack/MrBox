<template>
  <div class="mb-vent" @keydown.esc="$emit('cerrar')">
    <button type="button" class="mb-vent__fondo" :aria-label="$t('action.cancel')" @click="$emit('cerrar')"></button>

    <div ref="caja" class="mb-vent__caja" role="dialog" aria-modal="true" :aria-label="titulo" tabindex="-1">
      <header class="mb-vent__cabeza">
        <span class="mb-vent__t">
          {{ titulo }}
          <span v-if="sub" class="mb-vent__s">{{ sub }}</span>
        </span>

        <button type="button" class="mb-vent__x" :aria-label="$t('action.cancel')" @click="$emit('cerrar')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.8"
               stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </header>

      <div class="mb-vent__cuerpo"><slot /></div>

      <footer v-if="$slots.pie" class="mb-vent__pie"><slot name="pie" /></footer>
    </div>
  </div>
</template>

<script>
/**
 * UNA VENTANA QUE SALTA POR ENCIMA.
 *
 * El cartel del diseño: fondo oscurecido, borde blanco, la cruz arriba
 * a la derecha. Lo usan los formularios que piden datos --un nivel de
 * verificación, una dirección-- porque cargar datos ES el momento en
 * que no hay que poder hacer otra cosa.
 *
 * POR QUE NO VA EN LA PAGINA
 *
 * Un formulario abierto en medio de la página empuja todo para abajo y
 * se pierde de vista al scrollear: la persona termina escribiendo sin
 * ver el botón de guardar. Arriba de todo no se pierde.
 *
 * MIENTRAS ESTA ABIERTA, LA PAGINA NO SE MUEVE
 *
 * Se le traba el scroll al documento. Si no, se scrollea lo de atrás y
 * al cerrar la ventana la página quedó en otro lado.
 */
export default {
  name: "MbVentana",

  props: {
    titulo: { type: String, required: true },
    sub: { type: String, default: "" },
  },

  mounted() {
    this.antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    /* El foco entra a la ventana: si no, Tab sigue en lo de atrás. */
    if (this.$refs.caja) this.$refs.caja.focus();
  },

  beforeDestroy() {
    document.body.style.overflow = this.antes || "";
  },
};
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

.mb-vent {
  position: fixed;
  inset: 0;
  z-index: 95;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  box-sizing: border-box;
}

.mb-vent__fondo { position: absolute; inset: 0; border: 0; background: rgba(3, 8, 18, .72); cursor: pointer; }

.mb-vent__caja {
  position: relative;
  width: min(560px, 100%);
  max-height: calc(100vh / var(--escala, 1) - 32px);
  overflow: auto;
  border-radius: 22px;
  border: 2px solid #fff;
  background: $panel;
  display: flex;
  flex-direction: column;
  outline: 0;
}

.mb-vent__cabeza {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 20px;
  border-bottom: 1px solid $borde;
}

.mb-vent__t { display: flex; flex-direction: column; gap: 4px; font-weight: 900; font-size: 19px; }
.mb-vent__s { font-weight: 600; font-size: 13px; line-height: 1.45; color: $texto-3; }

.mb-vent__x {
  width: 34px;
  height: 34px;
  flex: none;
  border-radius: 10px;
  border: 0;
  background: $panel-alto;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  @include foco;

  &:hover { background: $panel-hover; }
}

.mb-vent__cuerpo { padding: 20px; display: flex; flex-direction: column; gap: 14px; }

.mb-vent__pie {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 16px 20px;
  border-top: 1px solid $borde;
}

@include en-celular {
  .mb-vent { padding: 0; align-items: flex-end; }

  .mb-vent__caja {
    width: 100%;
    max-height: 92vh;
    border-radius: 22px 22px 0 0;
    border-bottom: 0;
  }
}
</style>
