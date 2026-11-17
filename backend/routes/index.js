const express = require("express");

/**
 * EL MAPA DE LA API.
 *
 * Todo cuelga de /api. Un solo lugar donde ver que existe.
 */
const router = express.Router();

router.use("/auth", require("./auth"));
router.use("/profile", require("./profile"));

/* Para saber si el servidor esta vivo sin tener que mirar un registro. */
router.get("/health", (req, res) => res.json({ success: true, ok: true, at: new Date() }));

module.exports = router;
