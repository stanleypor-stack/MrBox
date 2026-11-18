const mongoose = require("mongoose");

/**
 * LAS PERILLAS DEL SITIO.
 *
 * Un solo documento. Todo lo que el dueño puede cambiar sin tocar código
 * vive acá: el retorno de las cajas, el tope de premio, el bono por
 * depósito, los mínimos.
 *
 * POR QUE UN SOLO DOCUMENTO Y NO UNA FILA POR PERILLA
 *
 * Porque así se leen todas de una y se pueden tener los valores por
 * defecto en el esquema. Una perilla nueva aparece con su valor sensato
 * sin migrar nada, y una que se borró del panel no deja la base con una
 * fila huérfana que nadie sabe si todavía se usa.
 */

/*
  LAS RESPUESTAS GUARDADAS QUE VIENEN DE FABRICA.

  Viven afuera del esquema porque el `default` de mongoose solo corre
  cuando se CREA el documento, y el documento de perillas se creo el
  primer dia: una perilla agregada despues nunca ve su valor por
  defecto. El servicio las usa cuando la lista esta vacia.
*/
/*
  LAS TRES CAJAS DE REGALO QUE VIENEN DE FABRICA.

  Afuera del esquema por lo mismo que las respuestas guardadas: el
  `default` de mongoose corre al CREAR el documento, y el de perillas
  se creo el primer dia. Una perilla agregada despues nunca ve su valor
  por defecto, y el servicio la encuentra vacia.
*/
const CAJAS_DE_REGALO = ["mac", "pokemon-boosters", "splash"];

const RESPUESTAS_POR_DEFECTO = [
  {
    titulo: "Where is my order?",
    texto: "Thanks for writing. Your order is being packed and you will get the tracking number here as soon as it ships.",
  },
  {
    titulo: "Why do I need to verify?",
    texto: "Verification protects your account and is required before any redemption or shipment. You can do it in Profile, then Verification.",
  },
  {
    titulo: "How long does a redemption take?",
    texto: "Redemptions are reviewed and paid within 24 hours once your verification is approved.",
  },
  {
    titulo: "Closing",
    texto: "Happy to help. I am closing this conversation, but write again any time and it reopens.",
  },
];

const settingsSchema = new mongoose.Schema(
  {
    /* Solo puede haber uno. La clave fija lo garantiza en la base. */
    key: { type: String, default: "main", unique: true, immutable: true },

    /*
      EL NOMBRE Y EL MANTENIMIENTO, UNA SOLA VEZ.

      Estaban dos veces --`siteName` y `nombreDelSitio`, `maintenance` y
      `mantenimiento`-- porque la segunda se agrego despues sin mirar la
      primera. Dos campos para lo mismo terminan con el panel guardando
      en uno y el sitio leyendo el otro, que es exactamente lo que
      pasaba: el panel mostraba el nombre vacio.
    */
    siteName: { type: String, default: "MR BOX", trim: true, maxlength: 60 },
    maintenance: { type: Boolean, default: false },

    /* ── Las cajas ───────────────────────────────────────────────────── */

    /** Lo que vuelve al jugador. De acá sale el precio de cada caja. */
    retornoObjetivo: { type: Number, default: 0.92, min: 0.5, max: 1 },

    /** Ningún premio puede valer más que esto. */
    topePremioSc: { type: Number, default: 300000 },

    /** Cuántas cajas se pueden abrir de una (el selector x1 a x4). */
    cajasALaVez: { type: Number, default: 4, min: 1, max: 10 },

    /** Lo que se le paga al jugador por vender un objeto, sobre su valor. */
    tasaDeRecompra: { type: Number, default: 1, min: 0, max: 1 },

    /* ── Las cajas de la comunidad ───────────────────────────────────── */

    /** Lo que el creador se lleva del MARGEN de su caja, no de lo facturado. */
    parteDelCreador: { type: Number, default: 0.5, min: 0, max: 1 },
    objetosPorCajaDeComunidad: {
      min: { type: Number, default: 5 },
      max: { type: Number, default: 20 },
    },

    /* ── Regalos ─────────────────────────────────────────────────────── */

    /** Cuántas cajas de regalo se dan al registrarse. */
    aperturasDeRegalo: { type: Number, default: 3 },

    /**
     * CUALES.
     *
     * Las tres del prototipo: una Mac, una de Pokemon y una Splash.
     * Son baratas y de las que tienen un premio grande adentro, que es
     * exactamente lo que tiene que hacer un regalo de bienvenida.
     *
     * Si una se saca del catalogo, el que se registre ese dia recibe
     * las que si existan: mejor dos regalos que un error.
     */
    cajasDeRegalo: { type: [String], default: () => CAJAS_DE_REGALO.slice() },

    /** Aperturas de demostración para el que todavía no tiene cuenta. */
    aperturasDeDemo: { type: Number, default: 3 },

    /* ── El bono por depósito ────────────────────────────────────────── */

    /**
     * EL BONO POR CODIGO DE AFILIADO.
     *
     * No hay rollover en MR BOX: el jugador compra SC y los puede usar
     * enseguida. En su lugar, el que entra con un código de afiliado se
     * lleva un porcentaje extra en cada compra.
     *
     * Dos tramos, como pidió el dueño: el normal y el de los socios
     * grandes. El tramo se decide por el código, no por el jugador.
     */
    bonoPorDeposito: {
      normal: { type: Number, default: 0.05, min: 0, max: 1 },
      destacado: { type: Number, default: 0.1, min: 0, max: 1 },
    },

    /**
     * CUANTAS VECES HAY QUE JUGAR EL BONO ANTES DE PODER SACARLO.
     *
     * Esto NO es el rollover de BetSweeps, que ata TODA la compra. Acá
     * solo ata la parte regalada, y solo para canjearla.
     *
     * En 1 quiere decir: el bono hay que jugarlo una vez. En 0, el bono
     * se puede canjear de una.
     *
     * Por qué el valor por defecto es 1 y no 0: con 0, alguien compra
     * SC 1.000, se le acreditan SC 1.100 y pide el canje de los SC 1.100
     * sin abrir una sola caja. Son SC 100 regalados por operación, repetible
     * para siempre y automatizable. Con 1, para llevarse el bono hay que
     * haberlo jugado, y jugarlo deja el margen de la casa.
     *
     * Se puede poner en 0 desde el panel. Es una decisión comercial, pero
     * conviene tomarla sabiendo la cuenta.
     */
    vecesAJugarElBono: { type: Number, default: 1, min: 0 },


    /*
      MODO MANTENIMIENTO: `maintenance`, arriba.

      Prendido, el sitio se ve pero no se puede abrir ni jugar nada. Es
      lo que se usa para migrar la base sin que una apertura quede a
      medio hacer en el medio.
    */

    /*
      LOS POZOS DE LAS TRES CARRERAS.

      Los del diseno. Se tocan desde el panel sin desplegar nada, y
      viven aca y no en el codigo porque es una decision de negocio que
      cambia solita cada temporada.

      Lo que se cambie vale para la carrera SIGUIENTE: la que esta al
      aire ya guardo su pozo, y moverselo a mitad de camino le
      cambiaria el premio a gente que ya jugo por el.
    */
    pozosDeCarrera: {
      daily: { type: Number, default: 2000, min: 0 },
      weekly: { type: Number, default: 10000, min: 0 },
      monthly: { type: Number, default: 30000, min: 0 },
    },

    /* ── Canjes ──────────────────────────────────────────────────────── */

    canjeMinimoSc: { type: Number, default: 50 },

    /** Arriba de esto, un envío pide verificación de domicilio (nivel 3). */
    envioQuePideNivel3Sc: { type: Number, default: 1000 },

    /* ── Deals ───────────────────────────────────────────────────────── */

    deals: {
      chanceMinima: { type: Number, default: 0.01 },
      chanceMaxima: { type: Number, default: 0.8 },
      margen: { type: Number, default: 0.08 },
      ruedasALaVez: { type: Number, default: 4 },
      tiradasGratisPorItem: { type: Number, default: 1 },
    },

    /*
      LOS NUEVE RANGOS VIP.

      Estaban en el codigo. Aca se pueden mover sin desplegar: cuanto
      hay que jugar para cada uno, su color y cuanto devuelve por
      semana. Vacio quiere decir "los de fabrica" (ver services/vip).
    */
    rangosVip: {
      type: [
        {
          nombre: { type: String, required: true },
          desde: { type: Number, required: true, min: 0 },
          color: { type: String, default: "#3f7cf0" },

          /*
            LOS TRES PERIODOS, cada uno con su numero.

            Antes solo se guardaba el semanal y los otros dos salian de
            una proporcion: cambiar el semanal movia los tres sin que
            nadie lo pidiera. El diario y el mensual en null quieren
            decir "el que trae el rango de fabrica".
          */
          rakebackSemanal: { type: Number, default: 0, min: 0, max: 0.5 },
          rakebackDiario: { type: Number, default: null, min: 0, max: 0.5 },
          rakebackMensual: { type: Number, default: null, min: 0, max: 0.5 },
        },
      ],
      default: [],
    },

    /*
      LAS FILAS DE LA PORTADA.

      Que se muestra y en que orden. La REGLA de cada fila sigue en el
      codigo --"las 14 mas abiertas" es una consulta-- pero esconder
      una o moverla no necesita desplegar nada.
    */
    portada: {
      type: [
        {
          id: { type: String, required: true },
          orden: { type: Number, default: 0 },
          visible: { type: Boolean, default: true },
        },
      ],
      default: [],
    },

    /* ── La cinta de Live Pulls ──────────────────────────────────────── */

    /**
     * EL VOLUMEN DE LA CINTA.
     *
     * La cinta de la portada muestra lo que se gana en el sitio. Con el
     * sitio recien abierto esta quieta, y una cinta quieta no invita a
     * nadie: `relleno` la llena con aperturas de adorno mientras tanto.
     *
     * No tocan la base ni el libro: viven en memoria y no le dan un
     * premio a nadie (ver services/feed). El dia que haya aperturas de
     * verdad se apaga aca y la cinta sigue sola.
     */
    pulls: {
      relleno: { type: Boolean, default: true },
      /** Cuantas por minuto. El prototipo hace una por segundo. */
      porMinuto: { type: Number, default: 60, min: 1, max: 600 },
      /** Cada cuantas de cada cien son de un premio barato. */
      baratosPct: { type: Number, default: 85, min: 0, max: 100 },
      /** Hasta cuanto vale "barato". */
      topeSc: { type: Number, default: 10, min: 0 },
    },

    /* ── Soporte ─────────────────────────────────────────────────────── */

    soporte: {
      /**
       * La respuesta automática del chat.
       *
       * Es lo primero que ve alguien que escribe, y existe para que no se
       * quede mirando una pantalla muda: dice que lo leímos y que viene
       * una persona. Se guarda como CODIGO y no como frase para que esté
       * en el idioma del que escribe (ver utils/errors.js).
       */
      respuestaAutomatica: { type: Boolean, default: true },
      horarioMostrado: { type: String, default: "24/7" },

      /**
       * LAS RESPUESTAS GUARDADAS.
       *
       * Las cuatro preguntas que se repiten --donde esta mi pedido, por
       * que pide verificacion, cuanto tarda un canje-- se contestan
       * veinte veces por dia. Guardarlas no es pereza: es que la
       * vigesima persona reciba la misma respuesta correcta que la
       * primera, y no una version apurada de las seis de la tarde.
       *
       * Se editan desde el panel y se insertan en el cuadro de texto:
       * nunca se mandan solas.
       */
      respuestas: {
        type: [
          {
            titulo: { type: String, default: "", trim: true, maxlength: 60 },
            texto: { type: String, default: "", trim: true, maxlength: 2000 },
          },
        ],
        default: () => RESPUESTAS_POR_DEFECTO.map((r) => ({ ...r })),
      },
    },
  },
  { timestamps: true }
);

/**
 * Las perillas, creándolas con sus valores por defecto la primera vez.
 *
 * Nunca devuelve `null`: medio sitio depende de esto y una pantalla que
 * explota porque todavía nadie entró al panel sería un papelón evitable.
 */
settingsSchema.statics.leer = async function leer() {
  const existente = await this.findOne({ key: "main" }).lean();
  if (existente) return existente;
  const creado = await this.create({ key: "main" });
  return creado.toObject();
};

module.exports = mongoose.model("Settings", settingsSchema);
module.exports.RESPUESTAS_POR_DEFECTO = RESPUESTAS_POR_DEFECTO;
module.exports.CAJAS_DE_REGALO = CAJAS_DE_REGALO;
