const mongoose = require("mongoose");

/**
 * UNA CUENTA.
 *
 * UNA SOLA MONEDA
 *
 * `balanceSc` y nada más. En BetSweeps hay dos saldos (Gold y Sweeps) y la
 * mitad de los errores de esa billetera salen de preguntarse cuál de los
 * dos tocar. Acá no existe esa pregunta.
 *
 * El saldo NO se toca a mano desde ningún lado: todo movimiento pasa por
 * `services/wallet`, que escribe el movimiento y mueve el saldo en la
 * misma operación. Un saldo sin movimiento que lo explique es un error.
 */

/*
  LOS TRES NIVELES DE VERIFICACION.

    0 - nada. Puede comprar SC y abrir cajas. Nada más.
    1 - datos básicos: nombre y fecha de nacimiento.
    2 - identidad: un documento con foto. Habilita canjear SC y pedir
        envíos.
    3 - domicilio: una factura o resumen. Hace falta para envíos de más
        de SC 1.000.

  Son acumulativos: para el 3 hay que tener el 2.
*/
const NIVEL_MAXIMO = 3;

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true, index: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },

    /* Hash de bcrypt. La contraseña en claro no entra nunca a este objeto. */
    passwordHash: { type: String, required: true, select: false },

    avatarUrl: { type: String, default: "" },

    /*
      EL SALDO, EN SC.

      `select: false` a propósito: el saldo solo se lee cuando se lo pide
      explícitamente. Así una consulta distraída no lo arrastra a una
      respuesta pública, que es como se filtra el saldo de otro jugador.
    */
    balanceSc: { type: Number, default: 0, select: false },

    /*
      CUANTO JUGO EN TOTAL.

      Sube con cada apertura y nunca baja. Es lo que mide los rangos VIP,
      las carreras y el rakeback, y lo que se compara contra lo canjeado
      para detectar cuentas que sacan más de lo que ponen.
    */
    jugadoSc: { type: Number, default: 0 },

    /*
      LA PARTE DEL SALDO QUE ES BONO Y TODAVIA NO SE JUGO.

      MR BOX no tiene rollover: lo que comprás lo usás enseguida. Pero el
      bono por código de afiliado sí tiene que jugarse antes de poder
      sacarlo, porque si no es plata regalada que se saca sin abrir una
      sola caja (ver Settings.vecesAJugarElBono).

      Sube cuando se acredita un bono y baja con cada apertura. Lo que se
      puede canjear es `balanceSc - bonoPendienteSc`.

      Es un número aparte y no un saldo aparte a propósito: dos saldos
      obligan a preguntarse cuál tocar en cada operación, que es de donde
      salen la mitad de los errores de la billetera de BetSweeps.
    */
    bonoPendienteSc: { type: Number, default: 0, select: false },

    verificationLevel: { type: Number, default: 0, min: 0, max: NIVEL_MAXIMO, index: true },

    /*
      LAS CAJAS DE REGALO.

      El regalo de bienvenida son TRES CAJAS, una apertura en cada una,
      no tres fichas para usar donde sea. Es lo que dice el prototipo, y
      la diferencia no es un detalle: con fichas sueltas alguien abre
      tres veces la caja mas cara de las tres y el regalo cuesta el
      triple de lo pensado.

      No son saldo: no se canjean ni se venden, solo se abren. Por eso
      viven acá y no en `balanceSc`.

      `usadaEl` en vez de borrar la fila: asi se puede mirar cuales
      abrio y cuales no, que es la mitad de la pantalla de bienvenida.
    */
    cajasGratis: {
      type: [
        {
          box: { type: mongoose.Schema.Types.ObjectId, ref: "Box", required: true },
          slug: { type: String, required: true },
          nombre: { type: String, default: "" },
          usadaEl: { type: Date, default: null },
        },
      ],
      default: [],
    },

    /*
      CUANTAS LE QUEDAN SIN ABRIR.

      Es la cuenta de `cajasGratis`, guardada aparte porque la cabecera
      la muestra en cada pantalla y leerla asi es un campo en vez de
      recorrer un arreglo. Se mueve SIEMPRE junto con el arreglo (ver
      services/boxes).
    */
    freeOpens: { type: Number, default: 0 },

    /*
      LAS TRABAS QUE LE PONE EL EQUIPO.

      Distintas de los limites que se pone el jugador: estas las pone
      soporte y el jugador no las puede sacar. Sirven para frenar una
      cuenta sin cerrarla entera --por ejemplo, mientras se revisa un
      canje raro-- que es lo que se necesita el 90% de las veces.

      Cada una dice POR QUE: una traba sin motivo, tres semanas
      despues, no la puede explicar nadie.
    */
    trabas: {
      canje: { type: Boolean, default: false },
      envio: { type: Boolean, default: false },
      promos: { type: Boolean, default: false },
      carreras: { type: Boolean, default: false },
      motivo: { type: String, default: "", maxlength: 300 },
      puestaEl: { type: Date, default: null },
    },

    /*
      LA NOTA INTERNA.

      Lo que el equipo quiere que sepa el proximo que abra esta ficha.
      No la ve el jugador. Es el lugar donde va "pidio no recibir
      promociones" o "el canje del 12 lo autorizo Dani".
    */
    notaInterna: { type: String, default: "", maxlength: 2000 },

    /*
      EL RANGO VIP PUESTO A MANO.

      Para el traslado de rango: alguien que ya era VIP en otro lado
      empieza aca en su rango sin haber jugado. Vacio quiere decir "el
      que le corresponde por lo jugado".
    */
    /*
      EL PISO DEL VIP CUANDO EL RANGO SE PONE A MANO.

      Al traer a alguien de otro sitio se le pone el rango que ya tenia
      y la barra arranca en el piso de ese rango; de ahi en mas cuenta
      lo que juegue acá. Esto guarda ese arranque.

      Va aparte de `jugadoSc` a proposito: `jugadoSc` es lo que de
      verdad jugo, y de ahi salen las carreras, el rakeback y el margen
      del panel. Sumarle el piso meteria a un recien llegado en la
      tabla de la carrera sin haber jugado nada.
    */
    jugadoBaseSc: { type: Number, default: 0, min: 0 },

    /*
      CUANTO DEL SALDO NO SE PUEDE SACAR TODAVIA.

      Es el BONO, no lo que falta jugar. `bonoPendienteSc` dice cuanto
      falta JUGAR --con 10x, diez veces el bono-- y usar ese numero
      para trabar el saldo ataba tambien la plata del jugador: con un
      bono de 50 a 10x quedaban trabados 500 de un saldo de 150.

      Se suelta solo cuando `bonoPendienteSc` llega a cero.
    */
    bonoAtadoSc: { type: Number, default: 0, min: 0, select: false },

    rangoManual: { type: String, default: "" },

    /*
      CUANTAS PRUEBAS GRATIS GASTO.

      El demo no cobra, no paga y no guarda nada: es para mirar como
      gira antes de poner plata. Son pocas a proposito --el ajuste dice
      cuantas-- porque el que las gasta todas y sigue mirando no se
      decide nunca.
    */
    demosUsadas: { type: Number, default: 0 },

    /*
      LOS LIMITES QUE SE PONE EL JUGADOR.

      Cuánto está dispuesto a jugar por día, y hasta cuándo no quiere
      poder entrar. Se los pone él, no nosotros.

      APRETAR ES INMEDIATO, AFLOJAR ESPERA
      -----------------------------------
      Bajar un límite --o ponerse uno-- vale desde ese segundo. Subirlo
      o sacarlo recién vale a las 24 horas.

      Sin esa espera el límite no sirve para nada: el momento en que
      alguien quiere sacárselo es exactamente el momento en que lo
      necesita. Por eso lo nuevo se guarda aparte, con la fecha en que
      empieza a valer, y hasta entonces manda el viejo.

      Y la pausa no se cancela. Esa es toda la idea de una pausa.
    */
    limites: {
      /* Cuánto puede jugar por día, en SC. `null` es sin límite. */
      juegoDiarioSc: { type: Number, default: null },

      /* Cuánto puede perder por día: lo jugado menos lo ganado. */
      perdidaDiariaSc: { type: Number, default: null },

      /* Lo que pidió aflojar, y desde cuándo vale. */
      pendiente: {
        juegoDiarioSc: { type: Number, default: null },
        perdidaDiariaSc: { type: Number, default: null },
        desde: { type: Date, default: null },
      },

      /* Hasta cuándo se tomó un descanso. No se puede acortar. */
      pausaHasta: { type: Date, default: null },

      actualizadoEl: { type: Date, default: null },
    },

    /*
      CUANDO SE LLEVO EL BONO DE BIENVENIDA.

      `null` quiere decir que todavia no. Es la marca que lo limita a
      una sola vez, y se pone con una condicion en el filtro --no con
      un `if`-- para que dos avisos de pago al mismo tiempo no puedan
      reclamarlo los dos.
    */
    bonoDeBienvenidaEl: { type: Date, default: null },

    /*
      LO JUGADO HOY, PARA EL TOPE DIARIO.

      Sumar el libro y despues decidir deja una ventana: veinte
      aperturas a la vez leen el mismo total y pasan todas. Con un
      contador propio, el tope se puede poner adentro del filtro del
      `$inc` y lo decide la base.

      `dia` es la fecha UTC en texto. Cuando cambia, el contador
      arranca de cero.
    */
    /*
      CUANTOS CANJES TIENE EN EL AIRE.

      Contarlos y despues decidir deja pasar veinte pedidos
      simultaneos. Con un contador propio, el tope va adentro del
      filtro del `$inc` y lo decide la base. Baja cuando el canje se
      paga, se rechaza o se cancela.
    */
    canjesPendientes: { type: Number, default: 0, min: 0 },

    /*
      DESDE CUANDO VALEN LAS SESIONES.

      Al cambiar la contraseña esto se pone en ahora, y el middleware
      rechaza cualquier token firmado antes. Es lo que hace que cambiar
      la clave de verdad eche al que te la robo: sin esto, el token que
      ya tenia le servia 30 dias mas.
    */
    clavesDesde: { type: Date, default: null },


    contadorDiario: {
      dia: { type: String, default: "" },
      jugadoSc: { type: Number, default: 0 },
    },


    rank: { type: String, enum: ["user", "support", "admin", "owner"], default: "user", index: true },

    /* Quién lo trajo. Se fija una vez, al registrarse, y no cambia más. */
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    affiliateCode: { type: String, default: "", trim: true, index: true },

    /*
      EL RANGO COMO SOCIO. Del 1 (Bronce) al 8 (Onix).

      No sube solo: lo otorga el equipo. Decide los cuatro numeros con
      los que cobran TODAS sus campañas, y tambien el bono que reciben
      los jugadores que entran con sus codigos.
    */
    rangoAfiliado: { type: Number, default: 1, min: 1, max: 20 },

    /* Cuando pidio subir. Se limpia cuando se le contesta. */
    pidioRangoEl: { type: Date, default: null },

    /*
      Bloqueos. `banned` no puede entrar; `redemptionLock` puede jugar pero
      no sacar plata, que es lo que se pone cuando el control automático
      marca algo y todavía no lo miró una persona.
    */
    banned: { type: Boolean, default: false, index: true },
    redemptionLock: { type: Boolean, default: false, index: true },

    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

/** Si puede canjear SC por cripto. */
userSchema.methods.puedeCanjear = function puedeCanjear() {
  if (this.trabas && this.trabas.canje) return false;
  return !this.banned && !this.redemptionLock && this.verificationLevel >= 2;
};

/**
 * Si puede pedir el envío de un objeto de este valor.
 *
 * El piso lo dice el panel (Settings.envioNivelMinimo, 3 de fábrica) y
 * entra por parámetro: un modelo no lee la configuración. Arriba de
 * SC 1.000 siempre hace falta el 3, pase lo que pase con esa perilla:
 * lo caro es lo que vale la pena robar, y ahí el domicilio comprobado
 * deja de ser un trámite.
 */
userSchema.methods.puedeEnviar = function puedeEnviar(valorSc, nivelBase = 3, topeSc = 1000) {
  if (this.banned) return false;
  if (this.trabas && this.trabas.envio) return false;

  const piso = Number(nivelBase) >= 2 && Number(nivelBase) <= 3 ? Number(nivelBase) : 3;
  if (this.verificationLevel < piso) return false;

  return Number(valorSc) <= Number(topeSc) || this.verificationLevel >= 3;
};

module.exports = mongoose.model("User", userSchema);
module.exports.NIVEL_MAXIMO = NIVEL_MAXIMO;
