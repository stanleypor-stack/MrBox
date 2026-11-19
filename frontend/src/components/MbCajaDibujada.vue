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

        <!-- Rayas al sesgo, como un papel de regalo. -->
        <pattern
          v-if="textura === 'rayas'" :id="idPatron" width="20" height="20"
          patternUnits="userSpaceOnUse" patternTransform="rotate(45)"
        >
          <rect width="10" height="20" fill="#ffffff" opacity=".16" />
        </pattern>

        <!-- Lunares. -->
        <pattern
          v-else-if="textura === 'lunares'" :id="idPatron" width="26" height="26"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="7" cy="7" r="4.2" fill="#ffffff" opacity=".2" />
          <circle cx="20" cy="20" r="4.2" fill="#000000" opacity=".16" />
        </pattern>

        <!-- Cuadros, como un mantel. -->
        <pattern
          v-else-if="textura === 'cuadros'" :id="idPatron" width="28" height="28"
          patternUnits="userSpaceOnUse"
        >
          <rect width="14" height="14" fill="#ffffff" opacity=".17" />
          <rect x="14" y="14" width="14" height="14" fill="#ffffff" opacity=".17" />
        </pattern>

        <!-- Panal. -->
        <pattern
          v-else-if="textura === 'panal'" :id="idPatron" width="30" height="52"
          patternUnits="userSpaceOnUse"
        >
          <g fill="none" stroke="#ffffff" stroke-opacity=".28" stroke-width="1.6">
            <path d="M15 1 28 8.5v15L15 31 2 23.5v-15z" />
            <path d="M0 27 13 34.5v15L0 57M30 27 17 34.5v15L30 57" />
          </g>
        </pattern>

        <!-- Chispas. -->
        <pattern
          v-else-if="textura === 'chispas'" :id="idPatron" width="44" height="44"
          patternUnits="userSpaceOnUse"
        >
          <g fill="#ffffff">
            <path d="M11 3l1.7 4.6L17.3 9l-4.6 1.7L11 15.3 9.3 10.7 4.7 9l4.6-1.4z" opacity=".55" />
            <path d="M32 22l1.3 3.4 3.4 1.3-3.4 1.3L32 31.4l-1.3-3.4-3.4-1.3 3.4-1.3z" opacity=".4" />
            <circle cx="36" cy="8" r="1.5" opacity=".45" />
            <circle cx="7" cy="33" r="1.5" opacity=".35" />
          </g>
        </pattern>

        <!-- Carton corrugado, el de una caja de verdad. -->
        <pattern
          v-else-if="textura === 'carton'" :id="idPatron" width="14" height="14"
          patternUnits="userSpaceOnUse"
        >
          <rect width="14" height="14" fill="#000000" opacity=".06" />
          <path d="M0 7h14" stroke="#ffffff" stroke-opacity=".14" stroke-width="3" />
          <path d="M0 13.5h14" stroke="#000000" stroke-opacity=".12" stroke-width="1.5" />
        </pattern>
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

      <!--
        LA TEXTURA DEL CARTON.

        Las mismas cuatro caras, dibujadas de nuevo y rellenas con el
        dibujito que se repite. Va encima de los colores y debajo de los
        logos, asi que el carton se ve estampado y no pintado.
      -->
      <g v-if="patron" :fill="`url(#${idPatron})`">
        <polygon points="50,236 205,178 205,381 51,371" />
        <polygon points="205,178 381,190 383,366 205,381" />
        <polygon points="60,168 200,170 166,240 8,232" />
        <polygon points="200,170 395,164 409,188 214,182" />
      </g>

      <!--
        LA CINTA.

        No es un dibujito que se repite: son cuatro tiras que siguen las
        caras de la caja, asi que dobla en los bordes como una cinta de
        verdad. El nudo seria un quinto trabajo y de lejos no se ve.
      -->
      <g v-else-if="textura === 'cinta'">
        <polygon points="115.1,211.6 139.9,202.4 140.3,377.8 115.7,375.2" :fill="tono.cintaSombra" />
        <polygon points="278.9,183 307.1,185 308.2,372.3 279.8,374.7" :fill="tono.cinta" />
        <polygon points="118.8,168.8 141.2,169.2 99.6,236.6 74.4,235.4" :fill="tono.cintaClara" />
        <polygon points="281.9,167.5 313.1,166.5 327.1,185.5 295.9,184.5" :fill="tono.cintaClara" />
      </g>
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
    /** "liso", "rayas", "lunares", "cuadros", "panal", "chispas", "carton" o "cinta". */
    textura: { type: String, default: "liso" },
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
    return { idDegrade: `mbDegrade${contador}`, idPatron: `mbPatron${contador}`, arrastre: null };
  },

  computed: {
    /*
      La cinta no es un dibujito que se repita, y "liso" no es nada: en
      los dos casos no hay `pattern` que poner.
    */
    patron() {
      return ["rayas", "lunares", "cuadros", "panal", "chispas", "carton"].includes(this.textura);
    },

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
        /* La cinta: la misma familia de color, bien clara. */
        cintaClara: mx(0.62),
        cinta: mx(0.5),
        cintaSombra: mx(0.3),
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

  /*
    DERECHOS, NO TORCIDOS.

    Estaban inclinados para seguir las caras del carton y el resultado
    era un logo deforme: lo que se nota no es que acompañe la
    perspectiva, es que esta chueco. Pegados derechos se leen, que es
    lo unico que tiene que hacer un logo.
  */
  &--izq { left: 14%; top: 62%; width: 31%; height: 26%; }
  &--der { left: 54%; top: 60%; width: 36%; height: 30%; }
}
</style>
