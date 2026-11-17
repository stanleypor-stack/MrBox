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

    verificationLevel: { type: Number, default: 0, min: 0, max: NIVEL_MAXIMO, index: true },

    /*
      APERTURAS GRATIS QUE LE QUEDAN.

      El regalo de bienvenida son 3. No son saldo: no se pueden canjear ni
      vender, solo gastar abriendo. Por eso viven acá y no en `balanceSc`.
    */
    freeOpens: { type: Number, default: 0 },

    rank: { type: String, enum: ["user", "support", "admin", "owner"], default: "user", index: true },

    /* Quién lo trajo. Se fija una vez, al registrarse, y no cambia más. */
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    affiliateCode: { type: String, default: "", trim: true, index: true },

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
  return !this.banned && !this.redemptionLock && this.verificationLevel >= 2;
};

/**
 * Si puede pedir el envío de un objeto de este valor.
 *
 * Nivel 2 para cualquier envío, 3 cuando pasa de SC 1.000: lo caro es lo
 * que vale la pena robar, y ahí el domicilio comprobado deja de ser un
 * trámite.
 */
userSchema.methods.puedeEnviar = function puedeEnviar(valorSc) {
  if (this.banned) return false;
  if (this.verificationLevel < 2) return false;
  return Number(valorSc) <= 1000 || this.verificationLevel >= 3;
};

module.exports = mongoose.model("User", userSchema);
module.exports.NIVEL_MAXIMO = NIVEL_MAXIMO;
