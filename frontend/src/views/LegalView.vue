<template>
  <div class="mb-legal">
    <nav class="mb-legal__lista" :aria-label="$t('legal.index')">
      <router-link
        v-for="p in paginas" :key="p.id" :to="`/legal/${p.id}`"
        class="mb-legal__link" :class="{ 'is-aca': p.id === cual }"
      >{{ $t(p.titulo) }}</router-link>
    </nav>

    <article class="mb-legal__hoja">
      <h1>{{ $t(actual.titulo) }}</h1>
      <p class="mb-legal__sub">{{ $t(actual.sub) }}</p>

      <!--
        EL AVISO SOLO DONDE TODAVIA NO HAY TEXTO.

        Cuatro de las cinco paginas siguen vacias; los terminos ya no.
        Dejar el cartel de "esto todavia no esta" arriba de un
        contrato escrito seria decir que no vale.
      -->
      <div v-if="!bloques.length" class="mb-legal__aviso">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffd35a"
             stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
        </svg>
        <span>{{ $t('legal.pending') }}</span>
      </div>

      <template v-else>
        <p class="mb-legal__fecha">{{ $t('legal.updated', { fecha: actualizado }) }}</p>

        <!--
          EL TEXTO VIENE COMO DATOS, NO COMO HTML.

          Cada bloque dice que es --titulo, parrafo, lista-- y la
          pantalla lo dibuja. Nada de `v-html`: un contrato es texto,
          no necesita etiquetas, y abrirle la puerta al HTML en la
          unica pagina que todo el mundo lee no vale la pena.
        -->
        <!--
          UN SOLO RECORRIDO, QUE RESPETA EL ORDEN.

          La tabla sale en un `dl` y no en un `component` dinamico
          porque hay que armar filas, pero va DENTRO del mismo
          `v-for`: dibujarla en un recorrido aparte ponia todas las
          tablas juntas arriba y el resto del documento abajo.
        -->
        <template v-for="(b, i) in bloques">
          <dl v-if="b.t === 'tabla'" :key="i" class="mb-legal__tabla">
            <template v-for="(f, n) in b.filas">
              <dt :key="`d${n}`">{{ f[0] }}</dt>
              <dd :key="`e${n}`">{{ f[1] }}</dd>
            </template>
          </dl>

          <component
            v-else :key="i"
            :is="b.t === 'h2' ? 'h2' : b.t === 'h3' ? 'h3' : b.t === 'ul' ? 'ul' : 'p'"
            :class="{
              'mb-legal__h2': b.t === 'h2',
              'mb-legal__h3': b.t === 'h3',
              'mb-legal__nota': b.t === 'nota',
              'mb-legal__lista-p': b.t === 'ul',
            }"
          >
            <template v-if="b.t === 'ul'">
              <li v-for="(x, n) in b.items" :key="n">{{ x }}</li>
            </template>
            <template v-else>{{ b.texto }}</template>
          </component>
        </template>
      </template>

      <p class="mb-legal__cierre">
        {{ $t('legal.askUs') }}
        <button type="button" class="mb-legal__soporte" @click="abrirSoporte">
          {{ $t('legal.contactSupport') }}
        </button>
      </p>
    </article>
  </div>
</template>

<script>
/**
 * LAS PAGINAS LEGALES.
 *
 * Los cinco enlaces del pie --terminos, reglas del sorteo, juego
 * responsable, privacidad y aceptacion de clientes-- apuntaban a
 * `/legal/*`, que no existia: el comodin del router los mandaba al
 * catalogo de cajas. El que tocaba "Reglas del sorteo" terminaba
 * mirando cajas, y el mismo pie dice que los premios se canjean "segun
 * las reglas oficiales".
 *
 * El texto de cada una lo escribe el equipo; esto es la pantalla que
 * lo va a sostener, con el aviso de que todavia no esta. Una pagina
 * que dice la verdad es mejor que un enlace que no lleva a ningun
 * lado.
 */
/*
  LAS OCHO PAGINAS.

  "Reglas del sorteo" ya no existe: MR BOX no es un sorteo. No hay
  una via de entrada gratuita, no hay un ganador entre participantes
  y no hay un periodo que cierra. Es una tienda donde cada compra
  entrega un objeto, y llamarla sorteo la describia mal y encima la
  acercaba a una figura legal que no es la nuestra. En su lugar esta
  Provably Fair, que es lo que tienen mrloot y luxdrop.

  "Aceptacion de clientes" pasa a llamarse AML, que es el nombre con
  el que la busca un banco, un procesador de pagos y un abogado.

  Y estan las tres que los Terminos nombran --envios, reembolsos y
  cookies--: un contrato que remite a una pagina que no existe es
  peor que uno que no remite a nada.
*/
const PAGINAS = [
  { id: "terms", titulo: "foot.terms", sub: "legal.termsSub" },
  { id: "fair", titulo: "foot.fair", sub: "legal.fairSub" },
  { id: "shipping", titulo: "foot.shipping", sub: "legal.shippingSub" },
  { id: "refunds", titulo: "foot.refunds", sub: "legal.refundsSub" },
  { id: "responsible", titulo: "foot.responsible", sub: "legal.responsibleSub" },
  { id: "privacy", titulo: "foot.privacy", sub: "legal.privacySub" },
  { id: "cookies", titulo: "foot.cookies", sub: "legal.cookiesSub" },
  { id: "aml", titulo: "foot.aml", sub: "legal.amlSub" },
];

/*
  EL TEXTO DE CADA PAGINA, CUANDO LO HAY.

  Los terminos estan escritos; las otras cuatro todavia no. Se cargan
  aparte del resto del sitio --son muchas palabras que casi nadie
  abre-- asi que la portada no las baja.
*/
const TEXTOS = {
  terms: () => import(/* webpackChunkName: "legales" */ "@/legal/terminos.js"),
  fair: () => import(/* webpackChunkName: "legales" */ "@/legal/justo.js"),
  shipping: () => import(/* webpackChunkName: "legales" */ "@/legal/envios.js"),
  refunds: () => import(/* webpackChunkName: "legales" */ "@/legal/reembolsos.js"),
  responsible: () => import(/* webpackChunkName: "legales" */ "@/legal/responsable.js"),
  privacy: () => import(/* webpackChunkName: "legales" */ "@/legal/privacidad.js"),
  cookies: () => import(/* webpackChunkName: "legales" */ "@/legal/cookies.js"),
  aml: () => import(/* webpackChunkName: "legales" */ "@/legal/aml.js"),
};

export default {
  name: "LegalView",

  data() {
    return { paginas: PAGINAS, bloques: [], actualizado: "" };
  },

  computed: {
    cual() {
      const pedida = String(this.$route.params.pagina || "");
      return PAGINAS.some((p) => p.id === pedida) ? pedida : PAGINAS[0].id;
    },

    actual() {
      return PAGINAS.find((p) => p.id === this.cual) || PAGINAS[0];
    },
  },

  watch: {
    cual: { immediate: true, handler: "traerTexto" },
  },

  methods: {
    async traerTexto() {
      const traer = TEXTOS[this.cual];
      if (!traer) { this.bloques = []; this.actualizado = ""; return; }

      const m = await traer();
      this.bloques = m.TEXTO || [];
      this.actualizado = m.ACTUALIZADO || "";

      /* Arriba de todo: cambiar de pagina legal y aparecer en la
         mitad de la anterior es desorientador. */
      window.scrollTo({ top: 0 });
    },

    abrirSoporte() { this.$store.dispatch("pedirSoporte", ""); },
  },

  metaInfo() { return {}; },
};
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

.mb-legal {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 18px;
  align-items: start;
  padding: 18px 0 40px;
}

.mb-legal__lista {
  display: grid;
  gap: 4px;
  position: sticky;
  top: calc(var(--alto-cabecera, 72px) + 12px);
  border: 1px solid $borde;
  border-radius: 14px;
  background: $panel;
  padding: 8px;
}

.mb-legal__link {
  display: block;
  padding: 9px 11px;
  border-radius: 9px;
  font-weight: 800;
  font-size: 13.5px;
  color: $texto-3;
  text-decoration: none;

  &:hover { background: $panel-hover; color: $texto; }
  &.is-aca { background: $azul-activo; color: $texto; }
}

.mb-legal__hoja {
  border: 1px solid $borde;
  border-radius: 16px;
  background: $panel;
  padding: 24px;
  min-width: 0;

  h1 {
    margin: 0 0 6px;
    font-size: clamp(22px, 4vw, 28px);
    font-weight: 900;
    text-wrap: balance;
  }
}

.mb-legal__sub {
  margin: 0 0 20px;
  color: $texto-4;
  font-size: 14.5px;
  line-height: 1.5;
  max-width: 62ch;
}

.mb-legal__aviso {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 14px 16px;
  border-radius: 12px;
  border: 1px dashed rgba(255, 211, 90, .45);
  background: rgba(255, 211, 90, .07);
  color: $texto-2;
  font-size: 14px;
  line-height: 1.5;

  svg { flex: none; margin-top: 1px; }
}

/* ── El texto de un documento legal ───────────────────────────────── */

/*
  Un contrato se lee distinto que el resto del sitio: renglones mas
  separados, una medida que no pase de unos setenta caracteres --mas
  ancho y el ojo pierde el renglon al volver-- y titulos que se vean
  como escalones y no como adornos.
*/
.mb-legal__fecha {
  margin: 0 0 18px;
  font-size: 12.5px;
  font-weight: 700;
  color: $texto-4;
}

.mb-legal__hoja {
  p, li { max-width: 68ch; }

  p {
    margin: 0 0 12px;
    font-size: 14.5px;
    line-height: 1.65;
    color: $texto-2;
  }
}

.mb-legal__h2 {
  margin: 30px 0 10px;
  padding-top: 18px;
  border-top: 1px solid $borde;
  font-size: 18px;
  font-weight: 900;
  color: #fff;
}

.mb-legal__h3 {
  margin: 20px 0 8px;
  font-size: 14.5px;
  font-weight: 900;
  color: $texto;
}

/* Lo que hay que entender aunque no se lea el resto. */
.mb-legal__nota {
  margin: 0 0 20px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid rgba(63, 124, 240, .4);
  background: rgba(63, 124, 240, .09);
  color: #fff;
  font-weight: 700;
}

/* Las tablitas de niveles y plazos: dos columnas, clave y valor. */
.mb-legal__tabla {
  display: grid;
  grid-template-columns: minmax(120px, 34%) 1fr;
  gap: 1px;
  margin: 0 0 16px;
  max-width: 68ch;
  border: 1px solid $borde;
  border-radius: 10px;
  overflow: hidden;
  background: $borde;

  dt, dd {
    margin: 0;
    padding: 9px 12px;
    background: $panel;
    font-size: 13.5px;
    line-height: 1.5;
  }

  dt { font-weight: 800; color: #fff; }
  dd { color: $texto-2; }

  /* En el telefono no entran dos columnas: la etiqueta arriba y el
     valor abajo, que es como se lee una ficha. */
  @include en-celular {
    grid-template-columns: 1fr;
    dt { padding-bottom: 2px; }
    dd { padding-top: 2px; }
  }
}

.mb-legal__lista-p {
  margin: 0 0 12px;
  padding-left: 20px;
  color: $texto-2;

  li {
    margin-bottom: 6px;
    font-size: 14.5px;
    line-height: 1.6;
  }
}

.mb-legal__cierre {
  margin: 20px 0 0;
  color: $texto-4;
  font-size: 13.5px;
}

.mb-legal__soporte {
  font: inherit;
  font-weight: 800;
  color: $enlace;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  text-decoration: underline;

  &:hover { color: $texto; }
}

@media (max-width: 760px) {
  .mb-legal { grid-template-columns: minmax(0, 1fr); gap: 12px; }

  .mb-legal__lista {
    position: static;
    display: flex;
    gap: 6px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .mb-legal__link { flex: none; white-space: nowrap; }
  .mb-legal__hoja { padding: 18px; }
}
</style>
