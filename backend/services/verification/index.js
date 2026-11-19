/**
 * LOS TRES NIVELES DE VERIFICACION.
 *
 *   1. quién dice ser
 *   2. que lo pruebe
 *   3. dónde vive
 *
 * EN ORDEN, Y SIN SALTEAR
 *
 * No se puede mandar el 2 sin tener aprobado el 1. No es burocracia: el
 * nivel 2 es "el documento coincide con lo que dijiste en el nivel 1", y
 * sin el 1 no hay con qué comparar.
 *
 * QUE DESBLOQUEA CADA UNO
 *
 *   jugar y vender ........ nada
 *   canjear saldo ......... nivel 2
 *   que te manden algo .... nivel 2
 *   más de SC 1.000 ....... nivel 3
 *
 * Esa tabla vive en `User.puedeEnviar` y en el canje. Acá solo se
 * decide quién llega a qué nivel.
 */

const Verification = require("../../database/models/Verification");
const User = require("../../database/models/User");
const { errorDe } = require("../../utils/errors");

/*
  LOS CAMPOS DE CADA NIVEL.

  Son los del diseño, tal cual. `obligatorio` dice cuáles no pueden ir
  vacíos; `archivo` dice cuáles son una foto.
*/
const FORMULARIOS = {
  1: [
    { campo: "nombre", tipo: "texto", obligatorio: true, largo: 60 },
    { campo: "apellido", tipo: "texto", obligatorio: true, largo: 60 },
    { campo: "nacimiento", tipo: "fecha", obligatorio: true },
  ],
  2: [
    { campo: "documento", tipo: "opcion", obligatorio: true, opciones: ["passport", "id", "licence"] },
    { campo: "paisEmisor", tipo: "texto", obligatorio: true, largo: 60 },
    { campo: "numero", tipo: "texto", obligatorio: true, largo: 40 },
    { campo: "foto", tipo: "archivo", obligatorio: true },
  ],
  3: [
    { campo: "calle", tipo: "texto", obligatorio: true, largo: 120 },
    { campo: "ciudad", tipo: "texto", obligatorio: true, largo: 80 },
    { campo: "provincia", tipo: "texto", obligatorio: false, largo: 80 },
    { campo: "codigoPostal", tipo: "texto", obligatorio: true, largo: 20 },
    { campo: "pais", tipo: "texto", obligatorio: true, largo: 60 },
    { campo: "comprobante", tipo: "archivo", obligatorio: true },
  ],
};

/** La edad mínima. No es negociable y no depende del país. */
const EDAD_MINIMA = 18;

/** Lo más grande que puede pesar una foto de documento. */
const MAXIMO_POR_ARCHIVO = 6 * 1024 * 1024;

/**
 * LOS TIPOS DE ARCHIVO QUE SE ACEPTAN.
 *
 * El `|` de una expresion regular separa TODO lo de un lado de TODO lo
 * del otro, asi que la de antes --sin el grupo y sin cerrar el final--
 * daba por buena cualquier cosa que empezara con `data:image/png` y
 * cualquier cosa que contuviera `application/pdf;base64,` en el medio.
 *
 * Esta pide las dos mitades: el tipo, y que lo que sigue sea base64.
 */
const TIPOS_OK = /^data:(image\/(png|jpeg|webp)|application\/pdf);base64,[A-Za-z0-9+/=]+$/;

/** Cuántos años tiene alguien nacido ese día. */
function edadDe(fecha) {
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return -1;
  const hoy = new Date();
  let anios = hoy.getUTCFullYear() - d.getUTCFullYear();
  const mes = hoy.getUTCMonth() - d.getUTCMonth();
  if (mes < 0 || (mes === 0 && hoy.getUTCDate() < d.getUTCDate())) anios -= 1;
  return anios;
}

/**
 * Lee lo que mandó el jugador según el formulario del nivel.
 *
 * Campo por campo y contra la lista: lo que no está en el formulario no
 * se guarda. Si no, cualquiera puede mandar un objeto de mil claves y
 * llenar la base con lo que se le ocurra.
 */
function leerFormulario(nivel, cuerpo) {
  const forma = FORMULARIOS[nivel];
  if (!forma) throw errorDe("INVALID_AMOUNT", { campo: "nivel" });

  const datos = {};
  const archivos = [];

  for (const f of forma) {
    const valor = cuerpo[f.campo];

    if (f.tipo === "archivo") {
      const texto = typeof valor === "string" ? valor : "";
      if (!texto) {
        if (f.obligatorio) throw errorDe("INVALID_AMOUNT", { campo: f.campo });
        continue;
      }
      if (!TIPOS_OK.test(texto)) throw errorDe("BAD_FILE_TYPE", { campo: f.campo });
      if (texto.length > MAXIMO_POR_ARCHIVO * 1.4) {
        throw errorDe("FILE_TOO_BIG", { campo: f.campo, maximoMb: Math.round(MAXIMO_POR_ARCHIVO / 1048576) });
      }
      archivos.push({
        campo: f.campo,
        nombre: String(cuerpo[f.campo + "Nombre"] || f.campo).slice(0, 120),
        tipo: texto.slice(5, texto.indexOf(";")),
        tamano: Math.round((texto.length * 3) / 4),
        contenido: texto,
      });
      continue;
    }

    const texto = String(valor == null ? "" : valor).trim().slice(0, f.largo || 120);
    if (!texto) {
      if (f.obligatorio) throw errorDe("INVALID_AMOUNT", { campo: f.campo });
      datos[f.campo] = "";
      continue;
    }

    if (f.tipo === "opcion" && !f.opciones.includes(texto)) {
      throw errorDe("INVALID_AMOUNT", { campo: f.campo });
    }

    if (f.tipo === "fecha") {
      const anios = edadDe(texto);
      if (anios < 0) throw errorDe("INVALID_AMOUNT", { campo: f.campo });
      /* La edad se revisa acá, al mandarla, y no solo cuando alguien la
         mira: un menor no tiene que poder quedarse esperando en una
         cola días para que recién ahí le digan que no. */
      if (anios < EDAD_MINIMA) throw errorDe("TOO_YOUNG", { minimo: EDAD_MINIMA }, 403);
    }

    datos[f.campo] = texto;
  }

  return { datos, archivos };
}

/** El estado de los tres niveles, sin un solo dato sensible adentro. */
async function estadoDe(userId) {
  const [usuario, filas] = await Promise.all([
    User.findById(userId).select("verificationLevel").lean(),
    Verification.find({ user: userId }).sort({ nivel: 1 }).lean(),
  ]);

  const porNivel = new Map(filas.map((f) => [f.nivel, f]));

  const niveles = [1, 2, 3].map((n) => {
    const fila = porNivel.get(n);
    const aprobado = (usuario ? usuario.verificationLevel : 0) >= n;

    return {
      nivel: n,
      /* `approved` manda sobre lo que diga la fila: el nivel del
         usuario es el que usan el canje y los envíos. */
      estado: aprobado ? "approved" : (fila ? fila.estado : "none"),
      /* Solo se puede mandar el que sigue al último aprobado. */
      sePuedeMandar: !aprobado
        && (usuario ? usuario.verificationLevel : 0) === n - 1
        && (!fila || fila.estado === "rejected"),
      motivo: fila && fila.estado === "rejected" ? fila.motivo : "",
      adjuntos: fila ? fila.adjuntos : [],
      mandadoEl: fila ? fila.createdAt : null,
      revisadoEl: fila ? fila.revisadoEl : null,
      campos: FORMULARIOS[n].map((f) => ({
        campo: f.campo,
        tipo: f.tipo,
        obligatorio: !!f.obligatorio,
        opciones: f.opciones || null,
      })),
    };
  });

  return {
    nivelActual: usuario ? usuario.verificationLevel : 0,
    niveles,
    edadMinima: EDAD_MINIMA,
    maximoPorArchivoMb: Math.round(MAXIMO_POR_ARCHIVO / 1048576),
  };
}

/**
 * Manda un nivel a revisar.
 *
 * Pisa el intento anterior del mismo nivel: diez intentos apilados son
 * diez filas que alguien tiene que leer para quedarse con la última.
 */
async function mandar({ userId, nivel, cuerpo }) {
  const n = Number(nivel);
  if (![1, 2, 3].includes(n)) throw errorDe("INVALID_AMOUNT", { campo: "nivel" });

  const usuario = await User.findById(userId).select("verificationLevel").lean();
  if (!usuario) throw errorDe("NOT_LOGGED_IN", {}, 401);

  if (usuario.verificationLevel >= n) throw errorDe("ALREADY_VERIFIED", { nivel: n });
  if (usuario.verificationLevel !== n - 1) {
    throw errorDe("FINISH_PREVIOUS_LEVEL", { falta: usuario.verificationLevel + 1 });
  }

  const yaHay = await Verification.findOne({ user: userId, nivel: n }).lean();
  if (yaHay && yaHay.estado === "pending") throw errorDe("ALREADY_IN_REVIEW", { nivel: n });

  const { datos, archivos } = leerFormulario(n, cuerpo || {});

  await Verification.findOneAndUpdate(
    { user: userId, nivel: n },
    {
      $set: {
        estado: "pending",
        datos,
        archivos,
        adjuntos: archivos.map((a) => ({ campo: a.campo, nombre: a.nombre, tamano: a.tamano })),
        motivo: "",
        revisadoPor: null,
        revisadoEl: null,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return estadoDe(userId);
}

/**
 * Lo que hace el panel al mirar un pedido.
 *
 * Aprobar sube el nivel del usuario, y solo si venía del anterior: si
 * dos personas aprueban el 2 y el 3 al mismo tiempo, el nivel no puede
 * terminar en 2 porque el último en escribir pisó al otro.
 *
 * Y en los dos casos SE BORRAN LOS ARCHIVOS. Cumplida su función,
 * guardar la foto del pasaporte de alguien es solo esperar a que te la
 * roben.
 */
async function resolver({ adminId, userId, nivel, aprobar, motivo = "" }) {
  const n = Number(nivel);
  if (![1, 2, 3].includes(n)) throw errorDe("INVALID_AMOUNT", { campo: "nivel" });

  const fila = await Verification.findOne({ user: userId, nivel: n });
  if (!fila) throw errorDe("ITEM_NOT_FOUND", {}, 404);

  fila.estado = aprobar ? "approved" : "rejected";
  fila.motivo = aprobar ? "" : String(motivo || "").slice(0, 300);
  fila.revisadoPor = adminId;
  fila.revisadoEl = new Date();
  fila.archivos = [];
  await fila.save();

  if (aprobar) {
    await User.updateOne(
      { _id: userId, verificationLevel: n - 1 },
      { $set: { verificationLevel: n } }
    );
  }

  return estadoDe(userId);
}

module.exports = {
  FORMULARIOS,
  EDAD_MINIMA,
  MAXIMO_POR_ARCHIVO,
  edadDe,
  leerFormulario,
  estadoDe,
  mandar,
  resolver,
};
