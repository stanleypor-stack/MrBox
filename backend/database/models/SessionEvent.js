const mongoose = require("mongoose");

/**
 * CADA VEZ QUE ALGUIEN ENTRA A SU CUENTA.
 *
 * Es lo que muestra la pestaña Activity del perfil: desde dónde y
 * cuándo se entró.
 *
 * PARA QUE SIRVE DE VERDAD
 *
 * Para que el jugador vea una sesión que no reconoce. Es la única
 * herramienta que tiene alguien para darse cuenta de que le entraron a
 * la cuenta antes de que le vacíen el saldo, y no cuesta nada
 * guardarlo.
 *
 * QUE NO SE GUARDA
 *
 * La contraseña, obviamente, pero tampoco el `User-Agent` entero: es
 * una huella bastante única y no hace falta para decir "Chrome en
 * Windows". Se guarda eso ya resumido.
 *
 * SE BORRA SOLO A LOS NOVENTA DIAS
 *
 * Nadie revisa un ingreso de hace tres meses, y una tabla que solo
 * crece termina siendo la más grande de la base por nada.
 */
const sessionEventSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    tipo: { type: String, enum: ["login", "register", "logout", "password"], default: "login" },

    /* "Chrome en Windows", "Safari en iPhone". Resumido, no la huella. */
    dispositivo: { type: String, default: "" },

    /*
      La IP, recortada.

      Los últimos números se tiran: alcanza para que el jugador
      reconozca "esto no fue desde mi casa" y deja de ser un dato que
      ubica a una persona en una cuadra.
    */
    desde: { type: String, default: "" },

    ok: { type: Boolean, default: true },
  },
  { timestamps: true }
);

sessionEventSchema.index({ user: 1, createdAt: -1 });

/* Mongo las borra solo cuando cumplen noventa días. */
sessionEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

/** De un `User-Agent` crudo a algo que una persona pueda leer. */
sessionEventSchema.statics.resumirDispositivo = function resumirDispositivo(ua) {
  const s = String(ua || "");
  if (!s) return "";

  const navegador = /Edg\//.test(s) ? "Edge"
    : /OPR\/|Opera/.test(s) ? "Opera"
      : /Firefox\//.test(s) ? "Firefox"
        : /Chrome\//.test(s) ? "Chrome"
          : /Safari\//.test(s) ? "Safari" : "";

  const sistema = /iPhone/.test(s) ? "iPhone"
    : /iPad/.test(s) ? "iPad"
      : /Android/.test(s) ? "Android"
        : /Windows/.test(s) ? "Windows"
          : /Mac OS X/.test(s) ? "Mac"
            : /Linux/.test(s) ? "Linux" : "";

  if (navegador && sistema) return `${navegador} · ${sistema}`;
  return navegador || sistema || "";
};

/** La IP, sin la parte que ubica a alguien en una cuadra. */
sessionEventSchema.statics.recortarIp = function recortarIp(ip) {
  const s = String(ip || "").replace(/^::ffff:/, "");
  if (!s) return "";
  if (s.includes(":")) {
    /* IPv6: los primeros cuatro grupos y nada más. */
    return s.split(":").slice(0, 4).join(":") + "::";
  }
  const partes = s.split(".");
  if (partes.length !== 4) return "";
  return `${partes[0]}.${partes[1]}.${partes[2]}.x`;
};

module.exports = mongoose.model("SessionEvent", sessionEventSchema);
