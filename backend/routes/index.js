const express = require("express");

/**
 * EL MAPA DE LA API.
 *
 * Todo cuelga de /api. Un solo lugar donde ver que existe.
 */
const router = express.Router();

router.use("/public", require("./public"));
router.use("/auth", require("./auth"));
router.use("/profile", require("./profile"));
router.use("/boxes", require("./boxes"));
router.use("/inventory", require("./inventory"));
router.use("/deals", require("./deals"));
router.use("/community", require("./community"));
router.use("/races", require("./races"));
router.use("/vip", require("./vip"));
router.use("/promotions", require("./promotions"));
router.use("/challenges", require("./challenges"));
router.use("/support", require("./support"));
router.use("/wallet", require("./wallet"));
router.use("/affiliates", require("./affiliates"));
router.use("/notifications", require("./notifications"));

/* El aviso de pago de la pasarela. Va aparte porque no es del jugador:
   lo llama OxaPay y se valida por firma, no por sesion. */
router.use("/hooks", require("./wallet").aviso);
router.use("/admin", require("./admin"));

/* Para saber si el servidor esta vivo sin tener que mirar un registro. */
/*
  LA SEÑAL DE VIDA, Y QUE IP VE EL SERVIDOR.

  `ip` es la que el servidor cree que tiene QUIEN PREGUNTA, o sea la
  suya propia: no dice nada de nadie mas. Esta porque de otra forma no
  hay manera de saber si `PROXIES_DELANTE` esta bien puesto, y ese
  numero mal puesto rompe en silencio todos los frenos por IP --el de
  intentos de login, el primero.

  Para comprobarlo: pedir /health mandando una `X-Forwarded-For`
  inventada. Si `ip` devuelve la inventada, el numero esta de mas y
  cualquiera elige su IP. Si devuelve la de verdad, esta bien.

  `proxies` es el numero que tiene puesto, para no tener que adivinarlo
  desde afuera.
*/
router.get("/health", (req, res) => res.json({
  success: true,
  ok: true,
  at: new Date(),
  ip: req.ip,
  proxies: req.app.get("trust proxy"),
  /*
    La cadena tal como llega, para poder CONTAR los saltos en vez de
    suponerlos. Son las direcciones por las que paso ESTE pedido --el
    que pregunta-- y ninguna otra.
  */
  cadena: req.headers["x-forwarded-for"] || "",
  socket: (req.socket && req.socket.remoteAddress) || "",
}));

module.exports = router;
