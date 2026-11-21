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
router.get("/health", (req, res) => res.json({ success: true, ok: true, at: new Date() }));

module.exports = router;
