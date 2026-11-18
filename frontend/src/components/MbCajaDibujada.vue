<template>
  <div
    class="mb-dib" :class="{ 'is-arrastrable': arrastrable }"
    @pointermove="moviendo" @pointerup="soltar" @pointerleave="soltar"
  >
    <!-- El resplandor del color elegido, detrás de todo. -->
    <span class="mb-dib__brillo" aria-hidden="true"
          :style="{ background: `radial-gradient(62% 56% at 50% 46%, ${tono.brillo} 0, rgba(0,0,0,0) 72%)` }"></span>

    <!-- El interior de la caja: lo que se ve por la boca abierta. -->
    <svg viewBox="0 30 420 361" preserveAspectRatio="none" aria-hidden="true" class="mb-dib__capa">
      <polygon points="60,168 200,158 396,164 206,176" :fill="tono.interior" />
      <ellipse cx="210" cy="172" rx="150" ry="26" :fill="tono.luz" opacity=".26" />
      <polygon points="380,190 396,167 412,236 382,238" :fill="tono.ladoHondo" />
      <polygon points="396,167 412,236 404,236 390,178" :fill="tono.lado" />
    </svg>

    <!-- Los objetos que asoman. Van ENTRE el interior y el frente, que
         es lo que hace que parezca que salen de adentro. -->
    <div class="mb-dib__objetos">
      <div
        v-for="(a, i) in puestos" :key="a.clave"
        class="mb-dib__objeto"
        :role="arrastrable ? 'img' : null"
        :aria-label="arrastrable ? $t('create.dragItem') : null"
        :style="a.caja"
        @pointerdown="agarrar($event, a.clave, i)"
      >
        <span v-if="a.lamina" class="mb-prod" :class="a.lamina.clase" :style="a.foto" aria-hidden="true"></span>
        <img v-else-if="a.imageUrl" class="mb-dib__foto" :src="a.imageUrl" alt="" :style="a.foto">
      </div>

      <svg
        v-if="!puestos.length" viewBox="0 0 24 24" width="30" height="30" fill="none"
        stroke="rgba(255,255,255,.5)" stroke-width="1.5" stroke-linejoin="round"
        aria-hidden="true" class="mb-dib__hueco"
      >
        <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" /><path d="M4 7.5l8 4.5 8-4.5M12 12v9" />
      </svg>
    </div>

    <!-- El frente de la caja, por delante de los objetos. -->
    <svg viewBox="0 30 420 361" preserveAspectRatio="none" aria-hidden="true" class="mb-dib__capa mb-dib__frente">
      <defs>
        <linearGradient :id="idDegrade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" :stop-color="tono.degradeArriba" />
          <stop offset="1" :stop-color="tono.degradeAbajo" />
        </linearGradient>
      </defs>
      <polygon points="50,236 205,178 205,381 51,371" :fill="tono.caraIzq" />
      <polygon points="205,178 381,190 383,366 205,381" :fill="`url(#${idDegrade})`" />
      <line x1="205" y1="180" x2="205" y2="381" stroke="rgba(0,0,0,.35)" stroke-width="2" />
      <line x1="207" y1="182" x2="207" y2="380" stroke="rgba(255,255,255,.18)" stroke-width="1" />
      <polyline points="51,371 205,381 383,366" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="1.5" />
      <polygon points="60,168 200,170 166,240 8,232" :fill="tono.tapaIzq" />
      <line x1="8" y1="232" x2="166" y2="240" stroke="rgba(0,0,0,.35)" stroke-width="2" />
      <line x1="60" y1="168" x2="200" y2="170" stroke="rgba(255,255,255,.3)" stroke-width="1.2" />
      <polygon points="200,170 395,164 409,188 214,182" :fill="tono.tapaDer" />
      <polygon points="214,182 409,188 381,190 205,178" :fill="tono.debajo" />
    </svg>

    <!-- Los dos logos, pegados a las caras y torcidos con ellas. -->
    <div class="mb-dib__logo mb-dib__logo--izq">
      <img v-if="logoIzquierdo" :src="logoIzquierdo" alt="">
    </div>
    <div class="mb-dib__logo mb-dib__logo--der">
      <img v-if="logoDerecho" :src="logoDerecho" alt="">
    </div>
  </div>
</template>

<script>
import { sprite } from "@/utils/sprite";

/*
  LOS TRES ARMADOS DEL DISEÑO.

  Hero: un solo objeto, grande y centrado.
  Trio: tres derechos, el del medio adelante.
  Spread: tres inclinados en abanico.

  Los números salen del prototipo tal cual. `nC` es cuántos objetos hay,
  porque con dos el de la izquierda se corre para adentro: si no, queda
  un hueco en el medio que se ve como un error.
*/
function armado(estilo, i, cuantos) {
  if (estilo === 0) return { l: 4, w: 92, h: 100, iw: 76, tf: "none" };

  if (estilo === 1) {
    if (i === 0) return { l: 18, w: 64, h: 100, iw: 100, tf: "none" };
    if (i === 1) {
      return cuantos === 2
        ? { l: 6, w: 64, h: 100, iw: 100, tf: "scale(.9)" }
        : { l: -8, w: 64, h: 100, iw: 100, tf: "scale(.86)" };
    }
    return { l: 44, w: 64, h: 100, iw: 100, tf: "scale(.86)" };
  }

  if (i === 0) return { l: 19, w: 62, h: 100, iw: 100, tf: "none" };
  if (i === 1) {
    return cuantos === 2
      ? { l: 7, w: 62, h: 100, iw: 100, tf: "rotate(-10deg) scale(.88)" }
      : { l: -7, w: 62, h: 100, iw: 100, tf: "rotate(-13deg) scale(.86)" };
  }
  return { l: 45, w: 62, h: 100, iw: 100, tf: "rotate(13deg) scale(.86)" };
}

let contador = 0;

/**
 * LA CAJA DIBUJADA DE UNA CAJA DE COMUNIDAD.
 *
 * Las 163 cajas de la casa tienen su arte en una lámina. Las que hace un
 * jugador no: no hay nadie dibujando una por cada una.
 *
 * Así que se dibuja sola. Un cartón isométrico del color que eligió, con
 * hasta tres de sus propios premios asomando de adentro y, si subió
 * alguno, sus logos pegados en las dos caras. Todo en SVG, sin una sola
 * imagen que generar ni guardar.
 *
 * EL COLOR ES UNO SOLO Y DE AHI SALEN ONCE
 *
 * El jugador elige un color y las once superficies del cartón salen de
 * ese: la cara iluminada, la de sombra, la tapa, el interior. Si cada
 * una fuera elegible, se podría armar una caja ilegible; así, cualquier
 * color da una caja que se entiende.
 */
export default {
  name: "MbCajaDibujada",

  props: {
    color: { type: String, default: "#9b30ff" },
    /** 0 Hero, 1 Trio, 2 Spread. */
    estilo: { type: Number, default: 2 },
    /** Hasta tres premios: lo que asoma de la caja. */
    portada: { type: Array, default: () => [] },
    /** Corrimientos a mano, por clave: { clave: [x, y] } en por ciento. */
    posiciones: { type: Object, default: () => ({}) },
    logoIzquierdo: { type: String, default: "" },
    logoDerecho: { type: String, default: "" },
    /** En el editor se pueden mover con el dedo o el mouse. */
    arrastrable: { type: Boolean, default: false },
  },

  data() {
    /* Cada caja dibujada necesita su propio id de degradé: dos en la
       misma pantalla con el mismo id comparten el color de la primera. */
    contador += 1;
    return { idDegrade: `mbDegrade${contador}`, arrastre: null };
  },

  computed: {
    /** Las once superficies, derivadas del color elegido. */
    tono() {
      const hex = (this.color || "#9b30ff").replace("#", "");
      const n = parseInt(hex.length === 3 ? hex.replace(/(.)/g, "$1$1") : hex, 16);
      const r = (n >> 16) & 255;
      const g = (n >> 8) & 255;
      const b = n & 255;

      /* Oscurecer: multiplicar. Aclarar: acercar al blanco. */
      const f = (k) => `rgb(${[r, g, b].map((x) => Math.min(255, Math.round(x * k))).join(",")})`;
      const mx = (t) => `rgb(${[r, g, b].map((x) => Math.round(x + (255 - x) * t)).join(",")})`;

      return {
        interior: f(0.22),
        luz: mx(0.1),
        ladoHondo: f(0.45),
        lado: f(0.72),
        caraIzq: f(0.6),
        degradeArriba: f(0.82),
        degradeAbajo: f(0.6),
        tapaIzq: f(1),
        tapaDer: mx(0.12),
        debajo: f(0.43),
        brillo: `rgba(${r},${g},${b},.34)`,
      };
    },

    /* En Hero se muestra uno solo; en los otros dos, hasta tres. */
    aLaVista() {
      const lista = (this.portada || []).filter(Boolean).slice(0, 3);
      return this.estilo === 0 ? lista.slice(0, 1) : lista;
    },

    puestos() {
      const cuantos = this.aLaVista.length;
      return this.aLaVista.map((p, i) => {
        const L = armado(this.estilo, i, cuantos);
        const clave = p.clave || p._id || p.name || String(i);
        const corrido = this.posiciones[clave] || [0, 0];
        const lamina = sprite(p.imageUrl);

        return {
          clave,
          lamina,
          imageUrl: p.imageUrl,
          caja: {
            left: (L.l + corrido[0]) + "%",
            bottom: (-corrido[1]) + "%",
            width: L.w + "%",
            height: L.h + "%",
            transform: L.tf,
            zIndex: String(3 - i),
            background: this.arrastre && this.arrastre.clave === clave
              ? "rgba(255,255,255,.08)" : "transparent",
          },
          foto: {
            ...(lamina ? lamina.estilo : {}),
            width: L.iw + "%",
          },
        };
      });
    },
  },

  methods: {
    agarrar(e, clave) {
      if (!this.arrastrable) return;
      e.preventDefault();
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* da igual */ }
      const marco = e.currentTarget.parentElement.getBoundingClientRect();
      this.arrastre = {
        clave,
        x0: e.clientX,
        y0: e.clientY,
        desde: this.posiciones[clave] || [0, 0],
        ancho: marco.width || 1,
        alto: marco.height || 1,
      };
    },

    moviendo(e) {
      const a = this.arrastre;
      if (!a) return;
      /* En por ciento del marco, no en pixeles: así el objeto queda
         donde lo dejaron aunque después se mire en otra pantalla. */
      const dx = ((e.clientX - a.x0) / a.ancho) * 100;
      const dy = ((e.clientY - a.y0) / a.alto) * 100;
      this.$emit("mover", {
        clave: a.clave,
        posicion: [
          Math.round((a.desde[0] + dx) * 10) / 10,
          Math.round((a.desde[1] + dy) * 10) / 10,
        ],
      });
    },

    soltar() { this.arrastre = null; },
  },
};
</script>

<style lang="scss" scoped>
.mb-dib {
  position: relative;
  width: 100%;
  aspect-ratio: 420 / 361;
  overflow: hidden;
  border-radius: 10px;
  background: #0a1322;

  &.is-arrastrable { touch-action: none; user-select: none; }
}

.mb-dib__brillo { position: absolute; inset: 0; }
.mb-dib__capa { position: absolute; inset: 0; width: 100%; height: 100%; }

.mb-dib__frente {
  pointer-events: none;
  filter: drop-shadow(0 6px 14px rgba(0, 0, 0, .5));
}

.mb-dib__objetos { position: absolute; left: 8%; top: -20%; width: 84%; height: 62%; z-index: 0; }

.mb-dib__objeto {
  position: absolute;
  transform-origin: 50% 100%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  border-radius: 10px;

  .mb-dib.is-arrastrable & { cursor: grab; touch-action: none; }

  > * {
    flex: none;
    aspect-ratio: 1 / 1;
    /* Los objetos bajan un poco: así parece que salen de adentro y no
       que están apoyados arriba del cartón. */
    transform: translateY(42%);
    filter: drop-shadow(0 6px 10px rgba(0, 0, 0, .6));
  }
}

.mb-dib__foto { object-fit: contain; }

.mb-dib__hueco { position: absolute; left: 50%; bottom: 6%; transform: translateX(-50%); }

// Los logos van torcidos con la cara en la que están pegados.
.mb-dib__logo {
  position: absolute;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;

  img { max-width: 80%; max-height: 80%; }

  &--izq { left: 15%; top: 60%; width: 30%; height: 26%; transform: skewY(-20deg); }
  &--der { left: 53%; top: 60%; width: 38%; height: 30%; transform: skewY(4deg); }
}
</style>
