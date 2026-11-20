<template>
  <section
    class="mb-reel" :class="[`mb-reel--n${cuantas}`, enColumnas ? 'mb-reel--columnas' : 'mb-reel--fila']"
    :aria-label="$t('box.reelAria', { name: nombreDeLaCaja })"
  >
    <!--
      LAS MARCAS DEL CENTRO.

      Con una cinta, las dos flechas arriba y abajo del medio, como
      siempre. Con varias --que giran hacia abajo, una al lado de la
      otra-- las flechas se corren a los costados y senalan el mismo
      renglon en las seis a la vez.
    -->
    <template v-if="enColumnas">
      <svg class="mb-reel__flecha mb-reel__flecha--izq" width="14" height="18" viewBox="0 0 18 24"
           fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M3 5l6 7-6 7M10 5l6 7-6 7" />
      </svg>

      <svg class="mb-reel__flecha mb-reel__flecha--der" width="14" height="18" viewBox="0 0 18 24"
           fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M15 5l-6 7 6 7M8 5l-6 7 6 7" />
      </svg>
    </template>

    <template v-else>
      <svg class="mb-reel__flecha mb-reel__flecha--arriba" width="18" height="14" viewBox="0 0 24 18"
           fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M5 3l7 6 7-6M5 10l7 6 7-6" />
      </svg>
      <span class="mb-reel__raya mb-reel__raya--ai" aria-hidden="true"></span>
      <span class="mb-reel__raya mb-reel__raya--ad" aria-hidden="true"></span>

      <svg class="mb-reel__flecha mb-reel__flecha--abajo" width="18" height="14" viewBox="0 0 24 18"
           fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M5 15l7-6 7 6M5 8l7-6 7 6" />
      </svg>
      <span class="mb-reel__raya mb-reel__raya--bi" aria-hidden="true"></span>
      <span class="mb-reel__raya mb-reel__raya--bd" aria-hidden="true"></span>
    </template>

    <div class="mb-reel__cintas">
      <div v-for="(cinta, i) in cintas" :key="i" class="mb-reel__col">
      <div class="mb-reel__pista">
        <!-- La banda del centro, una por columna: con las columnas
             partidas en dos renglones, una sola no alcanza. -->
        <span v-if="enColumnas" class="mb-reel__banda" aria-hidden="true"></span>
        <div
          ref="tiras" class="mb-reel__tira"
          :style="{
            transform: enColumnas ? `translateY(${cinta.x}px)` : `translateX(${cinta.x}px)`,
            transition: transicion,
          }"
        >
          <div
            v-for="(it, n) in cinta.items" :key="n"
            class="mb-reel__item"
            :style="{ opacity: opacidadDe(cinta, n) }"
          >
            <div class="mb-reel__caja" :style="{ transform: `scale(${escalaDe(cinta, n)})` }">
              <span class="mb-reel__marco mb-reel__marco--izq" aria-hidden="true"></span>
              <span class="mb-reel__marco mb-reel__marco--der" aria-hidden="true"></span>
              <span
                class="mb-reel__brillo" aria-hidden="true"
                :style="{ background: color(it.rarity), opacity: brilloDe(cinta, n) }"
              ></span>

              <span
                v-if="arte(it)" class="mb-prod mb-reel__foto" :class="arte(it).clase"
                :style="arte(it).estilo" aria-hidden="true"
              ></span>
              <img v-else-if="it.imageUrl" class="mb-reel__foto" :src="it.imageUrl" :alt="it.name">
            </div>

            <!--
              El nombre, solo en el que salio y solo cuando freno. En
              columnas no va aca: la columna es muy angosta y el
              renglon de abajo lo dice mejor.
            -->
            <div
              v-if="!enColumnas" class="mb-reel__rotulo"
              :style="{ visibility: ganador(cinta, n) ? 'visible' : 'hidden' }"
            >
              <span class="mb-reel__nombre">{{ it.name }}</span>
              <span class="mb-reel__valor">
                <span class="mb-sc mb-sc--16" aria-hidden="true">SC</span>{{ plata(it.valueSc) }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!--
        LO QUE SALIO, DEBAJO DE SU COLUMNA.

        Adentro de la columna y no en un renglon aparte: con las
        columnas partidas en dos renglones, un renglon suelto de
        nombres no se puede alinear con ninguna.

        Aparece recien cuando freno: mientras gira no hay nada que
        decir, y un texto que cambia distrae del unico lugar que hay
        que mirar.
      -->
      <div v-if="enColumnas" class="mb-reel__salida" aria-live="polite">
        <template v-if="quieta && !cinta.enReposo">
          <span class="mb-reel__nombre">{{ cinta.items[GANADOR].name }}</span>
          <span class="mb-reel__valor">
            <span class="mb-sc mb-sc--16" aria-hidden="true">SC</span>{{ plata(cinta.items[GANADOR].valueSc) }}
          </span>
        </template>
      </div>
      </div>
    </div>
  </section>
</template>

<script>
import { sprite } from "@/utils/sprite";
import { ticsDeLaCinta } from "@/utils/sonido";

/*
  LA GEOMETRIA DE LA CINTA, QUE ES LA DEL DISEÑO.

  Cada casillero mide 120 y entre dos hay 12 de aire: 132 de paso. La
  tira empieza corrida 60 --medio casillero-- para que el centro de la
  pantalla caiga en el MEDIO de un casillero y no en la juntura.

  El premio que salió va en el lugar 54 de 64. Los diez de atrás no se
  ven nunca: están para que el final de la tira no aparezca por la
  derecha cuando frena.
*/
const PASO = 132;
const GANADOR = 54;
const CORRIMIENTO = 60;
const LARGO = 64;

/* De dónde arranca la tira: cinco casilleros adentro. */
const ARRANQUE = -(PASO * 5 + CORRIMIENTO);

const DURACION = 5200;
const DURACION_RAPIDA = 1600;

const COLORES = {
  blue: "#3f7cf0", purple: "#8b4fe0", pink: "#e0418f", red: "#e2424b", gold: "#f5b80a",
};

/**
 * LA CINTA QUE GIRA.
 *
 * Una por caja cuando se abren varias: en el diseño van una debajo de
 * otra, no cuatro cintas en fila.
 *
 * QUIEN DECIDE
 *
 * El servidor, siempre. Acá llega el premio ya sorteado y la cinta se
 * arma PARA QUE CAIGA AHI: el lugar 54 es el que salió y el resto se
 * rellena al azar. Al revés --sortear acá-- cualquiera con la consola
 * abierta gana lo que quiera.
 *
 * POR QUE `setTimeout` Y NO `requestAnimationFrame`
 *
 * Porque rAF se congela cuando la pestaña no está adelante. Quien abre
 * cuatro cajas y se va a otra pestaña volvía a una cinta clavada en el
 * aire para siempre.
 */
export default {
  name: "MbRuleta",

  props: {
    /** Los premios de la caja, para rellenar la tira. */
    premios: { type: Array, default: () => [] },
    /** Cuántas cintas: una por caja abierta. */
    cuantas: { type: Number, default: 1 },
    rapido: { type: Boolean, default: false },
    nombreDeLaCaja: { type: String, default: "" },
  },

  data() {
    return {
      cintas: [],
      animando: false,
      girandoAhora: false,
      quieta: true,
      /* Para el renglon de abajo, que lee `cinta.items[GANADOR]`. */
      GANADOR,
    };
  },

  computed: {
    /*
      DE COSTADO EN CUANTO HAY MAS DE UNA.

      Con una sola, la cinta horizontal de siempre. Con varias, una
      columna por caja: cuatro cintas horizontales apiladas son cuatro
      cosas moviendose igual, una debajo de otra, y no se sabe donde
      mirar.
    */
    enColumnas() { return this.cuantas > 1; },

    duracion() { return this.rapido ? DURACION_RAPIDA : DURACION; },

    transicion() {
      return this.animando ? `transform ${this.duracion}ms cubic-bezier(.08,.82,.17,1)` : "none";
    },

    /*
      El alto de cada cinta y el tamaño de la foto salen del CSS, por la
      clase `mb-reel--nX`. Antes venían de acá como estilo en línea, y
      un estilo en línea no lo puede achicar una media query: en el
      teléfono cuatro cintas tapaban la pantalla entera y el botón de
      abrir quedaba abajo del pliegue.
    */
  },

  watch: {
    cuantas() { this.reposo(); },
    premios() { this.reposo(); },
  },

  methods: {
    plata(n) {
      return Number(n || 0).toLocaleString("en-US", {
        minimumFractionDigits: 2, maximumFractionDigits: 2,
      });
    },

    arte(it) { return sprite(it.imageUrl); },
    color(r) { return COLORES[r] || COLORES.blue; },

    ganador(cinta, n) { return !cinta.enReposo && this.quieta && n === GANADOR; },

    opacidadDe(cinta, n) {
      if (cinta.enReposo) return 0.85;
      if (!this.quieta) return 1;
      return n === GANADOR ? 1 : 0.25;
    },

    escalaDe(cinta, n) { return this.ganador(cinta, n) ? 1.22 : 1; },
    brilloDe(cinta, n) { return this.ganador(cinta, n) ? 0.9 : 0.35; },

    /**
     * EL RELLENO DE LA CINTA: TODO EL CATALOGO, BARAJADO.
     *
     * Antes se sorteaba ponderado por la chance, y eso hacia que en una
     * caja donde lo bueno sale 0,31% y la basura 30%, los 64 casilleros
     * fueran basura: el jugador nunca veia pasar lo caro y la caja
     * parecia no tenerlo.
     *
     * La cinta es DECORACION. Lo que sale lo decide el servidor y llega
     * ya sorteado; lo unico que hace esto es mostrarlo girando. Asi que
     * muestra de que esta hecha la caja, no que te va a tocar.
     *
     * Las chances de verdad son las que estan escritas abajo, en "Qué
     * puede salir", y esas no las toca nadie.
     */
    relleno(cuantos) {
      const lista = this.premios;
      if (!lista.length) {
        return Array.from({ length: cuantos }, () => ({ name: "", valueSc: 0, rarity: "blue", imageUrl: "" }));
      }

      const items = [];

      /* Se recorre el catalogo barajado una y otra vez hasta llenar.
         Barajar cada vuelta, y no una sola, evita que se vea el mismo
         orden repetido cuando la caja tiene pocos objetos. */
      while (items.length < cuantos) {
        const vuelta = lista.slice();
        for (let i = vuelta.length - 1; i > 0; i -= 1) {
          const j = Math.floor(Math.random() * (i + 1));
          const t = vuelta[i]; vuelta[i] = vuelta[j]; vuelta[j] = t;
        }
        for (const p of vuelta) {
          if (items.length >= cuantos) break;
          items.push(p);
        }
      }

      return items;
    },

    /** Una tira de 64 con el premio que salió en el lugar 54. */
    tiraCon(premio) {
      const items = this.relleno(LARGO);
      if (premio) items[GANADOR] = premio;
      return items;
    },

    /** La cinta parada, para cuando todavía no se abrió nada. */
    reposo() {
      if (this.girandoAhora) return;
      this.animando = false;
      this.quieta = true;
      this.cintas = Array.from({ length: Math.max(1, this.cuantas) }, () => ({
        items: this.tiraCon(null),
        x: ARRANQUE,
        enReposo: true,
      }));
    },

    /**
     * Gira hasta los premios que ya trajo el servidor.
     *
     * @param {Array} premios uno por cinta
     * @returns {Promise<void>} se resuelve cuando frenaron todas
     */
    async girar(premios) {
      const lista = Array.isArray(premios) ? premios : [premios];

      this.girandoAhora = true;
      this.quieta = false;
      this.animando = false;

      this.cintas = lista.map((p) => ({
        items: this.tiraCon(p),
        x: ARRANQUE,
        enReposo: false,
      }));

      /*
        TRES PASOS, Y CADA UNO HACE FALTA.

        Vue junta los cambios de un mismo tick en un solo pintado. Si la
        tira nueva y su posición final salieran juntas, el navegador
        nunca vería la posición de arranque y no habría nada que animar:
        la cinta aparecería ya frenada.

        1. pintar la tira en su lugar de arranque
        2. poner la transición
        3. recién ahí mover
      */
      await this.$nextTick();
      this.animando = true;
      await this.$nextTick();
      await new Promise((r) => window.setTimeout(r, 32));

      this.cintas = this.cintas.map((cinta) => ({
        ...cinta,
        /* El tironcito al azar es lo que hace que no frenen las cuatro
           exactamente en el mismo lugar, que se nota y queda falso. */
        x: -(GANADOR * PASO + CORRIMIENTO) + (Math.random() * 24 - 12),
      }));

      /*
        EL TIC VA ATADO AL MOVIMIENTO, NO AL RELOJ.

        Lee dónde está la tira en cada cuadro y suena cuando pasa un
        objeto. Por eso los tics se van separando solos mientras la
        cinta frena: a intervalos fijos sonaría a metrónomo.

        Una sola tira suena --la primera-- aunque haya cuatro: cuatro
        cintas sonando a la vez es ruido, no juego.
      */
      const tira = Array.isArray(this.$refs.tiras) ? this.$refs.tiras[0] : this.$refs.tiras;
      ticsDeLaCinta(tira, this.duracion, PASO, this.enColumnas ? "y" : "x");

      return new Promise((listo) => {
        window.setTimeout(() => {
          this.quieta = true;
          this.girandoAhora = false;
          this.$emit("termino");
          listo();
        }, this.duracion + 80);
      });
    },
  },

  created() { this.reposo(); },
};
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

.mb-reel {
  position: relative;
  overflow: hidden;
  border-radius: 18px;
  border: 2px solid #24365e;
  // El fondo del diseño: un halo azul al medio y una trama de puntos.
  background:
    radial-gradient(ellipse 45% 70% at 50% 50%, rgba(63, 124, 240, .16) 0%, rgba(15, 26, 48, 0) 70%),
    radial-gradient(rgba(255, 255, 255, .05) 1px, transparent 1.2px) 0 0 / 18px 18px,
    #0f1a30;
  padding: 30px 0;
}

.mb-reel__flecha {
  position: absolute;
  z-index: 3;

  &--arriba, &--abajo { left: 50%; margin-left: -9px; }
  &--arriba { top: 8px; }
  &--abajo { bottom: 8px; }

  /* En columnas apuntan al renglon del medio desde los costados. */
  &--izq, &--der { top: 50%; margin-top: -9px; }
  &--izq { left: 7px; }
  &--der { right: 7px; }
}

/*
  LA BANDA DEL MEDIO, UNA POR COLUMNA.

  Es el renglon donde va a frenar esa columna. Sin algo que lo marque,
  seis columnas girando son seis cosas sueltas; con la banda cada una
  dice donde mirar.

  Una por columna y no una sola cruzada: en el telefono las columnas
  se parten en dos renglones, y una banda absoluta sobre toda la caja
  no puede marcar los dos.

  `pointer-events: none` porque va por encima de la cinta.
*/
.mb-reel__banda {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 120px;
  margin-top: -60px;
  z-index: 2;
  pointer-events: none;
  border-top: 1px solid rgba(255, 255, 255, .22);
  border-bottom: 1px solid rgba(255, 255, 255, .22);
  background: rgba(63, 124, 240, .1);
}

// Las dos rayitas que salen de cada flecha hacia los costados.
.mb-reel__raya {
  position: absolute;
  height: 1px;

  &--ai, &--ad { top: 14px; }
  &--bi, &--bd { bottom: 14px; }

  &--ai, &--bi {
    left: 22%;
    right: calc(50% + 18px);
    background: linear-gradient(90deg, rgba(255, 255, 255, 0), rgba(255, 255, 255, .3));
  }

  &--ad, &--bd {
    right: 22%;
    left: calc(50% + 18px);
    background: linear-gradient(90deg, rgba(255, 255, 255, .3), rgba(255, 255, 255, 0));
  }
}

.mb-reel__cintas {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.mb-reel__pista { position: relative; overflow: hidden; }

/*
  ══ DE COSTADO: UNA COLUMNA POR CAJA ═══════════════════════════════

  Las columnas se reparten el ancho en partes iguales (`flex: 1 1 0`),
  asi que seis en un telefono son seis columnas de 56px y no hay que
  escribir un ancho por cada cantidad.

  El alto es el MISMO para todas las cantidades: es el alto de la
  ventana por la que se ve pasar la cinta, y no tiene por que cambiar
  porque haya mas columnas.
*/
.mb-reel--columnas {
  padding: 10px 8px;

  /*
    LAS COLUMNAS SE ACOMODAN SOLAS.

    En escritorio entran todas en un renglon (`flex: 1 1 0`). En el
    telefono la media query de abajo les pone un ancho y se parten en
    dos renglones, que es como lo hacen krush y unbox: seis columnas
    de 56px no se leen.
  */
  .mb-reel__cintas {
    flex-direction: row;
    flex-wrap: wrap;
    gap: 6px;
  }

  .mb-reel__col {
    flex: 1 1 0;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .mb-reel__pista {
    height: 330px;
    border-radius: 12px;
    background: rgba(255, 255, 255, .025);
  }

  /*
    LA TIRA, EN VERTICAL.

    `top: 50%` es el ancla: el `translateY` de la cuenta mide desde
    ahi, igual que el `translateX` medía desde `left: 50%`.
  */
  .mb-reel__tira {
    left: 0;
    right: 0;
    top: 50%;
    bottom: auto;
    flex-direction: column;
    gap: 12px;
  }

  .mb-reel__item {
    width: 100%;
    height: 120px;
  }

  /* El casillero se adapta al ancho de la columna, con un techo para
     que con una o dos no quede un objeto gigante. */
  .mb-reel__caja {
    width: 100%;
    max-width: 104px;
    height: auto;
  }
}

/*
  LO QUE SALIO, DEBAJO DE SU COLUMNA.

  Siempre ocupa su lugar, haya o no texto: sin el alto reservado, la
  cinta salta hacia arriba cuando frena.
*/
.mb-reel__salida {
  min-height: 36px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding: 8px 4px 0;
  box-sizing: border-box;
  text-align: center;
  overflow: hidden;
}

/* El nombre no puede empujar la columna: con seis, un nombre largo
   ensancharia la suya y achicaria las otras cinco. */
.mb-reel__salida .mb-reel__nombre {
  max-width: 100%;
  font-size: 12.5px;
}

.mb-reel__salida .mb-reel__valor { font-size: 12px; }

/*
  CUANTAS CINTAS, QUE TAN ALTAS.

  Cuatro de 230 son 920px: no entran ni en una notebook. Y el numero
  tiene que estar en el CSS y no en un estilo en linea, para que la
  media query de abajo pueda achicarlo.
*/
/* Con una sola caja, la cinta horizontal de siempre. */
.mb-reel--fila .mb-reel__pista { height: 230px; }
.mb-reel--fila .mb-reel__caja { width: 120px; }

.mb-reel__tira {
  position: absolute;
  left: 50%;
  top: 0;
  bottom: 0;
  display: flex;
  gap: 12px;
  align-items: center;
  will-change: transform;
}

.mb-reel__item {
  flex: none;
  width: 120px;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: opacity .35s ease;
}

.mb-reel__caja {
  position: relative;
  aspect-ratio: 1 / 1;
  transition: transform .35s ease;
}

// Los dos marcos torcidos de atrás, que dan la idea de "cartas".
.mb-reel__marco {
  position: absolute;
  inset: 6% 18%;
  border-radius: 10px;

  &--izq { border: 2px solid rgba(255, 255, 255, .13); transform: rotate(-7deg); }
  &--der { border: 2px solid rgba(255, 255, 255, .08); transform: rotate(7deg); }
}

.mb-reel__brillo {
  position: absolute;
  left: 20%;
  right: 20%;
  bottom: 4%;
  height: 22%;
  border-radius: 50%;
  filter: blur(16px);
  transition: opacity .35s ease;
}

.mb-reel__foto {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 6px 10px rgba(0, 0, 0, .5));
}

.mb-reel__rotulo {
  height: 34px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  white-space: nowrap;
  text-align: center;
}

.mb-reel__nombre {
  max-width: 170px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 900;
  font-size: 14px;
}

.mb-reel__valor {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 800;
  font-size: 13px;
  color: $texto-2;
}

/*
  EN EL TELEFONO TODO ENTRA EN UNA PANTALLA.

  Lo que importa de abrir una caja es ver el premio Y poder tocar
  "Abrir" de nuevo. Si la cinta se come los 844px de alto, el boton
  queda abajo del pliegue y hay que scrollear despues de cada tirada.
*/
@media (max-width: 760px) {
  .mb-reel--fila .mb-reel__pista { height: 186px; }
  .mb-reel--fila .mb-reel__caja { width: 104px; }

  /*
    De costado, la ventana se achica para que debajo sigan entrando el
    boton de abrir y lo que salio: en el telefono lo que importa es
    ver el premio Y poder tocar "Abrir" otra vez sin scrollear.
  */
  /*
    EN EL TELEFONO, HASTA TRES POR RENGLON.

    Seis en fila son seis columnas de 56px: el objeto se ve mas chico
    que su precio. Partidas, cada una mide 120 y se lee.

      2 y 3  un renglon
      4      2 + 2, que queda parejo
      5 y 6  3 + 3

    El alto del casillero NO se toca: 120 + 12 de hueco son los 132 de
    paso con los que el guion calcula donde frenar. Lo que se achica es
    la ventana --cuanto se ve de la cinta-- y el casillero de adentro.
  */
  /*
    Las flechas de los costados, fuera.

    Apuntan al renglon del medio de la caja entera, y en el telefono
    las columnas se parten en dos renglones: la flecha quedaba
    senalando el hueco entre los dos. Cada columna ya tiene su banda,
    que dice lo mismo y no se puede confundir.
  */
  .mb-reel--columnas .mb-reel__flecha { display: none; }

  .mb-reel--columnas { padding: 8px 6px; }
  .mb-reel--columnas .mb-reel__cintas { gap: 6px; }
  .mb-reel--columnas .mb-reel__pista { height: 150px; }
  .mb-reel--columnas .mb-reel__banda { height: 104px; margin-top: -52px; }
  .mb-reel--columnas .mb-reel__caja { max-width: 86px; }

  .mb-reel--n4 .mb-reel__col { flex: 0 0 calc(50% - 3px); }
  /* El 5 ya no se ofrece --queda 3+2, con el segundo renglon a medio
     llenar-- pero la regla se deja: si alguien abre cinco por API, la
     pantalla tiene que saber dibujarlo. */
  .mb-reel--n5 .mb-reel__col,
  .mb-reel--n6 .mb-reel__col { flex: 0 0 calc(33.333% - 4px); }

  .mb-reel__salida { min-height: 32px; padding: 6px 2px 0; }
  .mb-reel__salida .mb-reel__nombre { font-size: 11px; }
  .mb-reel__salida .mb-reel__valor { font-size: 11px; }
}
</style>
