/*
  ¿EL AVISO DE OXAPAY LLEGA CON LOS BYTES ORIGINALES?

  La firma se calcula sobre el CUERPO CRUDO. Pero en `backend/index.js`
  hay un `express.json()` global que corre antes que el router, y una
  vez que ese parser consumió el cuerpo, el `express.raw()` de la ruta
  del aviso ya no ve nada: body-parser marca `req._body` y se saltea.

  `routes/wallet/index.js:353` lo tapa con un `JSON.stringify(req.body)`
  cuando no hay Buffer. Eso NO devuelve los bytes originales: pierde el
  formato y renormaliza los números.

  Esta prueba manda el MISMO pago dos veces, firmado correctamente sobre
  los bytes que viajan, y mira si el servidor acepta las dos:

    1. compacto, sin espacios  -> {"a":1}
    2. con sangría             -> {\n  "a": 1\n}

  Si la 2 rebota con 401, la firma no se está verificando contra lo que
  mandó la pasarela, y cualquier aviso con otro formato se pierde.

  SOLO CONTRA LOCALHOST. No acredita nada: el `order_id` es un id que no
  existe, así que el servidor corta en "sin jugador" después de validar
  la firma, que es justo lo que se quiere medir.

  Uso:  node audit/pocs/hook-cuerpo-crudo.js
*/
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

/* Se lee el .env a mano para que esto corra sin instalar nada y sin
   depender de desde que carpeta se lo invoque. */
function leerEnv(clave) {
  const archivo = path.join(__dirname, "..", "..", "backend", ".env");
  for (const linea of fs.readFileSync(archivo, "utf8").split(/\r?\n/)) {
    const i = linea.indexOf("=");
    if (i > 0 && linea.slice(0, i).trim() === clave) {
      return linea.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    }
  }
  return "";
}

const DESTINO = "http://localhost:5001/api/hooks/oxapay";
const CLAVE = leerEnv("OXAPAY_CALLBACK_SECRET") || leerEnv("OXAPAY_MERCHANT_KEY");

/* Un jugador que no existe: la firma se valida igual y nada se mueve. */
const PAGO = {
  status: "paid",
  track_id: "poc-" + Date.now(),
  order_id: "000000000000000000000000",
  amount: 10.5,
};

async function probar(nombre, cuerpo) {
  const firma = crypto.createHmac("sha512", CLAVE).update(cuerpo).digest("hex");

  const r = await fetch(DESTINO, {
    method: "POST",
    headers: { "content-type": "application/json", hmac: firma },
    body: cuerpo,
  });

  const texto = await r.text();
  const firmaOk = r.status !== 401;

  console.log(
    (firmaOk ? "  FIRMA ACEPTADA  " : "  FIRMA RECHAZADA ") +
      nombre.padEnd(26) +
      " HTTP " + r.status + "  " + texto.slice(0, 80)
  );
  return firmaOk;
}

(async () => {
  if (!CLAVE) {
    console.error("Falta OXAPAY_CALLBACK_SECRET en backend/.env — no se puede firmar.");
    process.exit(1);
  }

  console.log("Aviso de OxaPay, misma carga, dos formatos:\n");

  const compacto = JSON.stringify(PAGO);
  const conSangria = JSON.stringify({ ...PAGO, track_id: PAGO.track_id + "-b" }, null, 2);

  const a = await probar("compacto", compacto);
  const b = await probar("con sangria", conSangria);

  console.log("");
  if (a && b) {
    console.log("Las dos pasan: el cuerpo crudo llega entero. No hay problema.");
  } else if (a && !b) {
    console.log("CONFIRMADO: solo pasa el formato que coincide con JSON.stringify.");
    console.log("La firma se verifica contra una reserializacion, no contra lo que");
    console.log("mando la pasarela. Un aviso con otro formato se pierde y el");
    console.log("deposito nunca se acredita.");
  } else {
    console.log("Ninguna pasa: revisar que OXAPAY_CALLBACK_SECRET sea la que usa el");
    console.log("servidor que esta corriendo.");
  }
})();
