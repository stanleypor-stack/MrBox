/**
 * LA CAJA DE POKEMON, CON POKEMON ADENTRO.
 *
 * Tenia cinco premios: dos cajas de cartas, un peluche de Labubu --que
 * no es Pokemon-- y dos vales de credito que se llevaban el 96% de las
 * chances. Abrirla era, casi siempre, ver un signo de peso. Con las
 * fotos rotas ademas, la pantalla no mostraba un solo Pokemon.
 *
 * El catalogo tiene treinta y pico de productos de Pokemon de verdad,
 * desde un sobre suelto de SC 0,71 hasta una escultura de Charizard de
 * SC 39.440. Esta caja se arma con eso y con nada mas.
 *
 * EL PRECIO NO SE ELIGE: SALE DE LOS OBJETOS.
 *
 *     paga en promedio = suma( valor x chance )
 *     precio           = eso / 0,92
 *
 * Asi que la lista de abajo esta escrita para que la cuenta de un
 * precio parecido al que la caja ya tenia (SC 7,46). Si se cambia una
 * chance, el precio cambia solo: eso es a proposito y es lo que evita
 * que una caja quede pagando mas de lo que cobra.
 *
 * Uso:  node scripts/armarPokemon.js            (muestra lo que haria)
 *       node scripts/armarPokemon.js --aplicar
 */
require("dotenv").config();

const mongoose = require("mongoose");
const { conectar, desconectar } = require("../database");
const Box = require("../database/models/Box");
const Item = require("../database/models/Item");
const economia = require("../services/boxes/economia");

const APLICAR = process.argv.includes("--aplicar");

/*
  La escalera. El nombre es el del catalogo; la chance, en por ciento.

  De arriba hacia abajo: el premio imposible, los que se cuentan, y
  abajo los sobres sueltos que son lo que sale casi siempre. Ningun
  vale de credito: el que abre una caja de Pokemon quiere cartas.
*/
const ESCALERA = [
  ["Charizard Sculpture", 0.002],
  ["Sun & Moon Team Up Booster Box", 0.005],
  ["Pikachu Sculpture", 0.005],
  ["Pikachu Flocky 1000%", 0.008],
  ["Sword & Shield Evolving Skies Booster Box", 0.01],
  ["XY Evolutions Booster Box", 0.01],
  ["Pokemon T-shirt", 0.02],
  ["Sun & Moon Crimson Invasion Booster Box", 0.03],
  ["Sword & Shield Lost Origin Booster Display Box", 0.05],
  ["Sword & Shield Brilliant Stars Booster Box", 0.06],
  ["Sword & Shield Silver Tempest Booster Display Box", 0.08],
  ["Scarlet & Violet Stellar Crown Booster Box", 0.1],
  ["Scarlet & Violet Expansion Pack Ruler of the Black Flame Booster Box (JP)", 0.15],
  ["Scarlet & Violet 151 Booster Bundle", 0.2],
  ['20" Pikachu Plush', 0.25],
  ["Scarlet & Violet Shrouded Fable Booster Box", 0.3],
  ["Sword & Shield Fusion Strike Build & Battle Booster", 0.5],
  ["Sword & Shield Astral Radiance Booster Build & Battle Box", 1],
  ["Scarlet & Violet 8: Surging Sparks Booster", 5],
  ["Scarlet & Violet 7: Stellar Crown Booster", 8.75],
  ["Wild Force SV5K Booster (JP)", 15],
  ["Ancient Roar SV4K Booster (JP)", 15],
  ["Cyber Judge SV5M Booster (JP)", 15],
  ["Future Flash SV4M Booster (JP)", 15],
  ["Trick or Trade - BOOster Pack", null], // el resto, hasta 100
];

/* El color de la chapita, por lo que vale. Es lo mismo que mira el
   jugador en el filtro "Pink / Purple / Gold". */
function rarezaDe(valorSc) {
  if (valorSc >= 2000) return "gold";
  if (valorSc >= 250) return "red";
  if (valorSc >= 60) return "purple";
  if (valorSc >= 6) return "pink";
  return "blue";
}

(async () => {
  await conectar();

  const caja = await Box.findOne({ slug: "pokemon-boosters" });
  if (!caja) throw new Error("no existe la caja pokemon-boosters");

  console.log(`antes: ${caja.prizes.length} premios, SC ${caja.priceSc}\n`);

  /* El resto de la chance, para el sobre mas barato. */
  const puestas = ESCALERA.filter(([, c]) => c != null).reduce((a, [, c]) => a + c, 0);
  const resto = Math.round((100 - puestas) * 1e6) / 1e6;
  if (resto <= 0) throw new Error(`las chances ya suman ${puestas}%`);

  const premios = [];
  for (const [nombre, pct] of ESCALERA) {
    const item = await Item.findOne({ name: nombre }).lean();
    if (!item) throw new Error(`no esta en el catalogo: ${nombre}`);
    if (!item.imageUrl) throw new Error(`sin foto: ${nombre}`);

    const chance = (pct == null ? resto : pct) / 100;
    premios.push({
      item: item._id,
      name: item.name,
      valueSc: item.valueSc,
      imageUrl: item.imageUrl,
      rarity: rarezaDe(item.valueSc),
      shippable: item.shippable !== false,
      chance,
      peso: null,
    });
  }

  const promedio = economia.pagoPromedio(premios);
  const precio = economia.precioDe(premios);
  const suma = economia.sumaDeChances(premios);

  for (const p of premios) {
    console.log(
      `  ${(p.chance * 100).toFixed(3).padStart(7)}%  ${p.name.padEnd(62)} SC ${String(p.valueSc).padStart(9)}  ${p.rarity}`
    );
  }

  console.log(`\n  chances suman: ${(suma * 100).toFixed(4)}%`);
  console.log(`  paga en promedio: SC ${promedio}`);
  console.log(`  precio que le toca: SC ${precio}  (antes SC ${caja.priceSc})`);
  console.log(`  retorno: ${(economia.retornoReal(premios, precio) * 100).toFixed(2)}%`);

  const revision = economia.revisarCaja({ ...caja.toObject(), prizes: premios, priceSc: precio });
  if (revision.errores.length) {
    console.log("\n  ERRORES:", revision.errores.join(" | "));
    throw new Error("la caja no pasa la revision");
  }
  if (revision.avisos.length) console.log("  avisos:", revision.avisos.join(" | "));

  if (!APLICAR) {
    console.log("\n(prueba en seco: nada se guardo. Correr con --aplicar)");
  } else {
    caja.prizes = premios;
    caja.priceSc = precio;
    caja.pagoPromedio = promedio;
    caja.retorno = economia.retornoReal(premios, precio);
    await caja.save();
    console.log("\nguardada.");
  }

  await desconectar();
  await mongoose.disconnect().catch(() => {});
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
