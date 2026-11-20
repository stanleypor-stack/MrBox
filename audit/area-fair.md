# MR BOX — Auditoría de área: RNG, provably fair, cajas e inventario

**Fecha:** 2026-11-19
**Alcance:** `C:\Users\Usuario\mrbox\backend` (solo lectura) + base local de desarrollo `mongodb://127.0.0.1:27017/mrbox_local` (solo lectura).
**Pruebas de concurrencia / estadística:** bases descartables `mrbox_audit_fair` y `mrbox_audit_fair2`, creadas y borradas por los scripts. No se tocó ningún archivo del repo, no se hizo ningún commit, no se escribió en `mrbox_local`.

**Scripts usados** (todos en el scratchpad):

- `analisis-cajas.js` — recorre las 165 cajas de la base local, suma de chances, EV, RTP, precio teórico.
- `api-vs-sorteo.js` — compara campo por campo lo que devuelve `resumenDeCaja()` (= `GET /api/boxes/:slug`) contra lo que recorre `fair.elegirPremio()`, y simula 20.000 sorteos por caja de muestra.
- `replay-aperturas.js` — rehace TODAS las aperturas reales de la base local con el verificador público.
- `concurrencia.js` — 15 pruebas contra el servidor real (nonce en paralelo, rotación concurrente, venta doble, envíos, deals, 10.000 aperturas de distribución).
- `extras.js` — flag `shippable`, tanda a medias, compromiso previo de la semilla, edición de chances desde el panel, ciclo completo de una caja de comunidad.

---

## Resumen

El núcleo criptográfico **está bien hecho y lo confirmé con números**. No hay `Math.random()` en ningún resultado real, el nonce es atómico de verdad bajo 60 pedidos en paralelo, el verificador público reproduce exactamente las 251 aperturas de la base local, las 165 cajas cierran en 100,00 % y ninguna paga más de lo que cobra. El escenario crítico que se me pidió descartar —que el creador de una caja de comunidad le cambie los premios después de aprobada— **no existe**: cada edición la baja del aire.

Lo que sí encontré son 10 problemas de severidad media y baja, ninguno explotable por un jugador para sacarle plata a la casa. El más caro en la práctica es FAIR-01 (depósito despachando vales de crédito por correo). El más importante para la confianza es FAIR-02 (el panel puede cambiar las chances de una caja en vivo sin que el registro diga cuáles eran).

| ID | Título | Severidad | Confianza |
|---|---|---|---|
| FAIR-01 | El flag `shippable` del catálogo no llega al inventario | Alta | Confirmado |
| FAIR-02 | Se pueden cambiar las chances de una caja EN VIVO y el registro no guarda cuáles eran | Media | Confirmado |
| FAIR-03 | `/boxes/:slug/demo` ignora `live`: expone la tabla de una caja apagada o no aprobada | Media | Confirmado |
| FAIR-04 | `GET /deals/verify/:id` es público y sin dueño: expone apuestas ajenas | Media | Confirmado |
| FAIR-05 | Rotar la semilla en paralelo rompe con E11000 y deja tandas huérfanas | Media | Confirmado |
| FAIR-06 | `deals.verificar` revela la semilla con `!activa` en vez de `reveladaEn` | Baja | Confirmado |
| FAIR-07 | Una tanda x4 sin saldo cobra las primeras y devuelve 400: el jugador no ve lo que ganó | Media | Confirmado |
| FAIR-08 | El retorno que se le muestra al jugador se desvía hasta +0,31 pp del real | Baja | Confirmado |
| FAIR-09 | Cancelar un envío en paralelo devuelve 200 varias veces | Baja | Confirmado |
| FAIR-10 | El panel valida cajas ignorando `topePremioSc` y `retornoObjetivo` | Baja | Confirmado |
| FAIR-11 | Una cuenta sin tanda crea la semilla dentro del mismo pedido que la apertura | Info | Confirmado |

---

## Lo que está bien hecho (y el dueño puede confiar)

Esto no es relleno: cada punto lo verifiqué con código y con números.

### 1. No hay `Math.random()` en ningún resultado real

```
$ grep -rn "Math.random" backend/ --include=*.js   (sin node_modules)
backend/services/feed/index.js:102,104,137,141   → cinta de relleno de la portada
backend/tests/economia.test.js:61,66             → datos de prueba
```

Las cuatro de `feed/index.js` arman entradas falsas para la cinta de la portada (`_id: "v" + contador`, usuario inventado, no tocan la base ni el libro: `services/feed/index.js:98-160`). No deciden ningún premio de nadie. En el frontend hay otras cuatro (`MbRuleta.vue:182,250`, `MbRuedaDeDeal.vue:145,146`): rellenan la cinta con objetos al azar y le dan un tironcito al punto donde frena. El premio que se muestra en el lugar 54 y el ángulo ganador/perdedor los manda el servidor. **Ninguna decide un resultado.**

El sorteo real usa `crypto.createHmac("sha256", ...)` y `crypto.randomBytes(32)` (`services/boxes/fair.js:33-38, 104`).

### 2. El HMAC está bien construido

`fair.js:40-42` toma 13 dígitos hex (52 bits, exactamente la mantisa de un double) y divide por 2^52. La división es exacta: no hay sesgo de redondeo. `elegirPremio` recorre los premios **en el orden guardado, sin ordenarlos** (`fair.js:58-70`), que es la única forma de que un tercero rehaga la cuenta.

### 3. El compromiso previo funciona

Verificado end-to-end (`extras.js`, bloque C):

- La semilla se crea **junto con la cuenta**, no en la primera apertura (`routes/auth/index.js:152-167`).
- `GET /inventory/fair/seed` devuelve el hash y **no** la semilla: `exponeSemilla: false`. El campo es `select: false` en el modelo (`UserSeed.js:40`).
- `sha256(semilla) === hash publicado`: **true**.
- El hash que viaja en el recibo es el mismo que el jugador vio antes de abrir: **true**.
- El jugador edita su semilla de cliente cuando quiere: `POST /inventory/fair/rotate` con `semillaCliente: "LA-QUE-YO-QUIERO-123"` → la tanda nueva queda con esa semilla. **true**.
- Tras rotar: `verificable: true`, `coincide: true`, `sha256(semilla revelada) === hash`. **true**.

### 4. El nonce es atómico de verdad

`services/boxes/index.js:188-194`:

```js
const movida = await UserSeed.findOneAndUpdate(
  { _id: tanda._id },
  { $inc: { nonce: 1 } },
  { new: true }
).select("+semillaServidor").lean();
```

**Prueba de concurrencia** (`concurrencia.js`, bloque 1): 60 `POST /boxes/:slug/open` disparados en paralelo contra el mismo jugador.

```json
{ "pedidos": 60, "ok": 60, "noncesUnicos": 60, "hmacsUnicos": 60,
  "aperturasEnBase": 60, "noncesDuplicadosEnBase": 0, "rango": [1, 60], "huecos": 0 }
```

**Ningún nonce repetido, ningún HMAC repetido, sin huecos.** No se puede forzar el mismo resultado jugando en paralelo. El índice único parcial `{user:1, activa:1}` de `UserSeed.js:64-67` lo respalda en la base.

### 5. El verificador público reproduce de verdad los resultados

`replay-aperturas.js` corrió sobre **las 251 aperturas reales de `mrbox_local`**:

```
aperturas totales: 251
  reproducidas EXACTAS: 251      (hmac + numero + premio + valor)
  NO coinciden: 0
  hash != sha256(semilla): 0
  sin snapshot de premios: 0
  nonce repetido dentro de la misma tanda: 0
  indicePremio incoherente: 0
  snapshots que no suman 1: 0
```

Y por HTTP, con un jugador real (`extras.js` bloque C y `concurrencia.js` bloque 8): tras rotar, `GET /inventory/fair/verify/:id` devuelve `coincide: true` y `GET /deals/verify/:id` devuelve `coincide: true`.

### 6. La caja se congela en el recibo

`BoxOpen` guarda `premios[]` **tal como estaba la caja** más `indicePremio` (`services/boxes/index.js:227-232`, `BoxOpen.js:65-67`). Editar la caja mañana no rompe la verificación de lo abierto ayer. Los 251 snapshots suman 1 exacto. Esto es lo que hace honesta a la verificación y está bien resuelto.

### 7. Cobrar va antes de sortear

`services/boxes/index.js:171-194` y `services/deals/index.js:239-254`: el `wallet.mover` negativo ocurre **antes** del `$inc` del nonce. No hay ventana para abortar un pedido después de ver el premio.

### 8. El servidor no puede elegir el resultado después de ver la apuesta

- En cajas, el premio sale de `HMAC(semillaServidor, semillaCliente:nonce)` y **no depende de la caja, ni del precio, ni del monto**. Lo único que la caja aporta es el tramo del [0,1) en el que cae el número, y esa tabla está congelada en el recibo.
- En deals, `gano = numero < laChance` (`deals/index.js:264`), con `laChance` validada **antes** de cobrar y el nonce reservado **después** de cobrar.
- No existe ninguna ruta de admin que toque `UserSeed`. Lo confirmé con grep: las únicas escrituras son `routes/auth`, `services/boxes`, `services/deals` y `scripts/sembrar.js`.

### 9. La economía de las 165 cajas cierra

`analisis-cajas.js` sobre `mrbox_local`:

```
cajas: 165 | live: 165 | de comunidad: 2
RTP promedio (live): 91,999 %
RTP min / max (live): 91,958 % / 92,000 %
chances que NO suman 1 (tol 1e-6):               0
premios con chance 0:                            0
cajas con RTP > 98 % (la casa casi no gana):     0
cajas con RTP > 100 % (la casa PIERDE):          0
cajas con RTP < 80 %:                            0
precio distinto del teórico (sin precioAMano):   0
cajas cuyo acumulado no llega a 1:               0

distribución de RTP (live):
  91 %-92 %:   6
  92 %-93 %: 159
```

**Ninguna caja de la base local está por encima del 100 %, ninguna absurdamente por debajo.** Las 6 que caen en la banda 91-92 están en 91,958-91,999 %: es el redondeo del precio al centavo **para arriba**, que siempre queda del lado de la casa (`economia.js:88-93`). Está bien.

### 10. El % que se le muestra al jugador es el % que se usa para sortear

`api-vs-sorteo.js`, 165 cajas, premio por premio:

```
chances mostradas != chances del sorteo: 0
orden/nombre distinto:                   0
valores distintos:                       0
```

`resumenDeCaja()` (`services/boxes/index.js:478-485`) mapea `p.chance` sin tocarlo, en el mismo orden del array, y `fair.elegirPremio()` recorre ese mismo array. Son el mismo dato.

Y la distribución es la que se anuncia. **10.000 aperturas reales por HTTP** (`concurrencia.js`, bloque 10), caja con un premio al 10 %:

```
aperturas: 10.000 | esperadas: 1.000 | obtenidas: 987 | frecuencia: 9,87 % | z = -0,43
```

Más 20.000 sorteos simulados sobre cada una de 5 cajas reales: `|z|` máximo 2,83 sobre 5 cajas × hasta 20 premios. Todo dentro de lo normal.

### 11. Las cajas de la comunidad: el escenario crítico NO existe

Esto es lo que más me pidieron mirar y es la mejor noticia del informe. Verificado end-to-end (`extras.js`, bloque E):

```json
{ "creadaLive": false, "creadaEstado": "none",
  "abrirSinAprobar": [400, "BOX_NOT_LIVE"],
  "traslaAprobacionLive": true, "estado": "approved",
  "editarTrasAprobar": [200, null],
  "trasEditarLive": false, "trasEditarEstado": "none",
  "elCreadorEligeElPrecio": { "priceSc": 32.61, "live": false,
                              "approvalState": "none", "precioAMano": false } }
```

- **La aprobación del admin es obligatoria.** Una caja recién creada nace `live: false` / `approvalState: "none"` y abrirla por slug directo da `400 BOX_NOT_LIVE`.
- **Editarla después de aprobada la baja del aire.** `services/community/index.js:255-257` pone `live: false, approvalState: "none"` en CADA guardado, sin excepción. No se puede aprobar con medias y publicar con relojes.
- **El creador no manipula ni chances ni ganancia.** Los valores y nombres se leen del catálogo, no del pedido (`community/index.js:106-139`); el precio sale de `eco.precioDe(lista)` y le mandé `priceSc: 0.01, precioAMano: true, live: true, approvalState: "approved"` en el cuerpo: **los cuatro se ignoraron**.
- **No cobra por abrir su propia caja** (`services/boxes/index.js:275`), y el margen se acumula con los negativos incluidos antes de repartir (`community/index.js:329-347`), así que un premio gordo no deja a la casa pagando sola.

### 12. El inventario aguanta

Todo verificado con pedidos en paralelo (`concurrencia.js`, bloques 4-6):

| Prueba | Resultado |
|---|---|
| 12 ventas en paralelo del mismo objeto | **1 sola** exitosa, pagado 1× el valor, estado `sold` |
| Precio de venta mandado por el cliente (`valueSc/priceSc/amountSc/vendidoSc: 999999`) | **Ignorado**, se pagó el valor real |
| Vender un objeto ya pedido para envío | `400 ITEM_ALREADY_GONE` |
| Vender un objeto ya despachado | `400 ITEM_ALREADY_GONE` |
| Cancelar un pedido ya despachado | `400 ITEM_ALREADY_GONE`, el objeto queda `shipped`, **no se devuelve un peso** |
| 8 pedidos de envío en paralelo del mismo objeto | **1 solo** pedido creado |

El precio de venta lo pone el servidor: `services/boxes/index.js:516` → `sc(objeto.valueSc * (cfg.tasaDeRecompra ?? 1))`, con `objeto` releído de la base. Y si el pago falla, el objeto vuelve a `held` (`:526-532`). **No se puede vender dos veces, no se puede vender lo enviado, no se puede enviar lo vendido, y cancelar un envío nunca devuelve plata** (no la cobró nunca: `shipping/index.js:26-30`).

### 13. Deals: la chance anunciada es la chance real

`concurrencia.js`, bloque 7. 2.000 tiros reales por HTTP a 50 % de chance sobre un objeto de SC 90:

```
quote: { valueSc: 90, chance: 0.5, apuestaSc: 48.92 }     → 90 × 0,5 / 0,92 = 48,913 → 48,92 ✔
tiros: 2.000 | ganados: 1.027 | chance real: 51,35 %  (z = +1,21)
RTP teórico: 45 / 48,92 = 91,99 %   |   RTP medido: 94,47 %  (+1,2 σ)
```

La chance anunciada y la jugada son la misma, y el payout corresponde al RTP. Los límites aguantan: chance 0,99 → `ABOVE_MAXIMUM`; chance −1 y 0 → `INVALID_AMOUNT`; `veces: 99` → `TOO_MANY_AT_ONCE`; objeto `active: false` → `404`. Valores de plata mandados por el cliente (`valueSc`, `stakeSc`, `apuestaSc`) se ignoran: la apuesta se recalcula del catálogo.

**No se puede cobrar un deal ya terminado ni cancelar uno perdido**: no existe ruta de cobro ni de cancelación. El tiro se resuelve y se paga en el mismo pedido (`deals/index.js:266-300`); `Deal` es un recibo inmutable y el único endpoint que lo lee es `verify`, que no escribe nada.

### 14. El `<` de deals es el correcto

`deals/index.js:264`: `numero < laChance`. Como el número vive en [0,1), la franja que gana mide **exactamente** la chance pedida. Con `<=` mediría un pelo más y la verificación de afuera no cerraría. Está bien y está explicado en el código.

---

# Hallazgos

---

## FAIR-01 — El flag `shippable` del catálogo no llega al inventario

- **Severidad:** Alta
- **Categoría:** Inventario / envíos
- **Archivo:** `backend/services/boxes/index.js:204-213`, `backend/services/deals/index.js:268-277`
- **Confianza:** Confirmado (reproducido end-to-end)
- **Esfuerzo:** Bajo (2 líneas + un script de arreglo de datos)

### Descripción

Al entregar un premio, el `InventoryItem` se crea copiando nombre, foto, rareza y valor del premio, **pero no `shippable`**:

```js
// services/boxes/index.js:204
const guardado = await InventoryItem.create({
  user: user._id,
  item: premio.item,
  name: premio.name,
  imageUrl: premio.imageUrl,
  rarity: premio.rarity,
  valueSc: sc(premio.valueSc),
  state: "held",
  source: { kind: "box", box: caja._id },
});                                    // <-- falta shippable
```

Lo mismo en deals (`deals/index.js:268`). Y el modelo tiene:

```js
// database/models/InventoryItem.js:41
shippable: { type: Boolean, default: true },
```

Así que **todo lo que sale de una caja o de un deal queda enviable**, aunque el objeto del catálogo diga que no. El chequeo de `shipping/index.js:91` (`if (o.shippable === false) throw errorDe("ITEM_NOT_SHIPPABLE")`) mira el `InventoryItem`, que siempre dice `true`, así que nunca dispara.

### Impacto concreto

En la base local hay **9 objetos con `shippable: false`** —los vales "MR BOX Credit 0.25 / 0.5 / 1 / 2 / 5 / 10 / 25"— y están como premio en **32 cajas que están al aire** (`harley-davidson`, `apple-2k25`, `rolex`, `supreme`, `mac`, `labubu`, `gucci-vs-lv`…). En el inventario de la base local: **0 de 323 filas tienen el flag**.

Un jugador que gana "MR BOX Credit 25" ve en su inventario `puedeEnviarse: true` y puede pedir que se lo manden a su casa. El depósito recibe una orden de envío de un vale de crédito. Eso es tiempo de alguien, un paquete que no existe, y un reclamo cuando el jugador recibe un sobre vacío o nada.

### Pasos para reproducir

1. Abrir una caja que tenga un "MR BOX Credit" entre sus premios hasta que salga.
2. `GET /api/inventory` → el objeto viene con `puedeEnviarse: true`.
3. `POST /api/inventory/ship` con su id y una dirección.

### PoC

`extras.js`, bloque A: objeto de catálogo con `shippable: false`, ganado en una caja.

```json
{ "itemCatalogoShippable": false,
  "inventoryItemShippable": true,
  "apiDiceQuePuedeEnviarse": true,
  "envioAceptado": [200, null],
  "estadoFinal": "requested" }
```

### Arreglo propuesto

```diff
--- a/backend/services/boxes/index.js
+++ b/backend/services/boxes/index.js
@@
     const guardado = await InventoryItem.create({
       user: user._id,
       item: premio.item,
       name: premio.name,
       imageUrl: premio.imageUrl,
       rarity: premio.rarity,
       valueSc: sc(premio.valueSc),
+      /* El premio de la caja no guarda si se envía: eso lo dice el
+         catálogo. Sin esta copia, un vale de crédito termina pedido
+         como paquete. */
+      shippable: premioDelCatalogo ? premioDelCatalogo.shippable !== false : true,
       state: "held",
       source: { kind: "box", box: caja._id },
     });
```

Para tener `premioDelCatalogo` hace falta el `Item`. Lo más barato es copiar `shippable` al premio de la caja cuando se guarda (igual que ya se copian `name`, `valueSc` e `imageUrl`):

```diff
--- a/backend/database/models/Box.js
+++ b/backend/database/models/Box.js
@@ const premioSchema
     imageUrl: { type: String, default: "" },
     rarity: { type: String, default: "blue" },
+    /* Copiado del catálogo igual que el valor: si no viaja acá, el
+       objeto entregado queda enviable aunque no lo sea. */
+    shippable: { type: Boolean, default: true },
```

…llenarlo en `routes/admin/index.js:481` (`shippable: o.shippable !== false`) y en `services/community/index.js:125` (`shippable: objeto.shippable !== false`), y entonces en `boxes/index.js` y `deals/index.js` alcanza con `shippable: premio.shippable !== false` / `objeto.shippable !== false`.

En deals es más directo, porque ya tiene el `Item` entero en la mano:

```diff
--- a/backend/services/deals/index.js
+++ b/backend/services/deals/index.js
@@
         rarity: objeto.rarity,
         valueSc: valorSc,
+        shippable: objeto.shippable !== false,
         state: "held",
```

Y un arreglo de datos de una sola vez para las filas ya creadas: para cada `InventoryItem` en estado `held`, copiar el `shippable` del `Item` al que apunta.

### Cómo verificar

Abrir una caja con un "MR BOX Credit" adentro hasta que salga, mirar que `GET /api/inventory` traiga `puedeEnviarse: false` y `porQueNoSeEnvia: "ITEM_NOT_SHIPPABLE"`, y que `POST /api/inventory/ship` devuelva `ITEM_NOT_SHIPPABLE`.

---

## FAIR-02 — Se pueden cambiar las chances de una caja EN VIVO y el registro no guarda cuáles eran

- **Severidad:** Media
- **Categoría:** Cajas / auditoría
- **Archivo:** `backend/routes/admin/index.js:465-521` (el `anotar` en `:510-517`)
- **Confianza:** Confirmado (reproducido)
- **Esfuerzo:** Bajo

### Descripción

`PUT /admin/boxes/:id` acepta una tabla de premios nueva, la valida y la guarda **sin bajar la caja del aire**. Y el registro de auditoría anota solo tres campos:

```js
// routes/admin/index.js:465-468
const b = await Box.findById(req.params.id);
if (!b) throw errorDe("BOX_NOT_FOUND", {}, 404);
const antes = { name: b.name, priceSc: sc(b.priceSc), cuantos: b.prizes.length };
...
// routes/admin/index.js:510-517
await admin.anotar({
  admin: req.user,
  evento: "box.edit",
  sobre: { tipo: "box", id: b._id, nombre: b.name },
  antes,
  despues: { name: b.name, priceSc: sc(b.priceSc), cuantos: b.prizes.length },
  req,
});
```

`antes` y `despues` guardan **nombre, precio y cantidad de objetos**. No guardan las chances, ni qué objetos eran. Si alguien baja el premio grande del 1 % al 0,1 %, el registro dice "el precio pasó de SC 50 a SC 46" y nada más: no hay forma de reconstruir qué odds tenía la caja ayer.

Esto contrasta con el propio comentario del modelo (`AdminLog.js:40`): *"El antes y el después, para poder deshacerlo a mano"*. Con estos tres campos no se puede deshacer nada.

### Impacto concreto

1. **No se puede responder la pregunta que importa.** Un jugador reclama que la caja pagaba más la semana pasada; no hay registro que lo confirme ni lo desmienta. El recibo de cada apertura sí guarda la tabla (`BoxOpen.premios`), así que la verificación de lo ya abierto no se rompe — pero reconstruir el historial de odds de una caja obliga a recorrer todas sus aperturas.
2. **La caja sigue al aire mientras cambia.** Un jugador que vio 1 % en la pantalla y aprieta "abrir" dos segundos después juega con 0,1 %. No es trampa del sorteo (la tabla que se usa es la que está en ese instante, y es la que queda en el recibo), pero rompe la promesa de la pantalla.
3. Es también la única vía real por la que una caja podría quedar pagando distinto de lo anunciado, porque el resto del sistema no deja.

### Pasos para reproducir

1. Entrar al panel como `owner`.
2. `PUT /api/admin/boxes/:id` con `prizes` cambiando las chances (manteniendo suma 1).
3. Mirar que la caja sigue `live: true` y revisar el `AdminLog` de evento `box.edit`.

### PoC

`extras.js`, bloque D. Caja al aire, dos premios 50/50, se pasa a 1/99:

```json
{ "estado": 200,
  "antes":   "Credito 25=0.5,  Barato=0.5",
  "despues": "Credito 25=0.01, Barato=0.99",
  "seguiaLive": true,
  "precioAntes": 10, "precioDespues": 1.35,
  "registroAntes":   { "name": "Mixta", "priceSc": 10,   "cuantos": 2 },
  "registroDespues": { "name": "Mixta", "priceSc": 1.35, "cuantos": 2 },
  "elRegistroGuardaLasChances": false }
```

### Arreglo propuesto

```diff
--- a/backend/routes/admin/index.js
+++ b/backend/routes/admin/index.js
@@
-    const antes = { name: b.name, priceSc: sc(b.priceSc), cuantos: b.prizes.length };
+    /*
+      LA TABLA ENTERA, NO EL CONTEO.
+
+      "cuantos: 12" no dice nada el día que alguien pregunte qué odds
+      tenía esta caja el martes. Lo que hay que poder deshacer a mano
+      son las chances, así que son las chances lo que se anota.
+    */
+    const tablaDe = (caja) => (caja.prizes || []).map((p) => ({
+      item: String(p.item), name: p.name, valueSc: sc(p.valueSc), chance: p.chance,
+    }));
+    const antes = {
+      name: b.name,
+      priceSc: sc(b.priceSc),
+      live: !!b.live,
+      prizes: tablaDe(b),
+    };
@@
     await admin.anotar({
       admin: req.user,
       evento: "box.edit",
       sobre: { tipo: "box", id: b._id, nombre: b.name },
       antes,
-      despues: { name: b.name, priceSc: sc(b.priceSc), cuantos: b.prizes.length },
+      despues: {
+        name: b.name,
+        priceSc: sc(b.priceSc),
+        live: !!b.live,
+        prizes: tablaDe(b),
+      },
       req,
     });
```

Y, aparte, decidir si cambiar la tabla de una caja al aire tiene que bajarla —como ya hace la de comunidad en `services/community/index.js:255`— o al menos pedir un motivo:

```diff
     if (Array.isArray(req.body.prizes)) {
+      /* Tocar los premios de una caja al aire es lo mismo que tocar los
+         de una de comunidad: se baja y se vuelve a publicar a mano.
+         Si no, alguien que vio 1% en la pantalla abre con 0,1%. */
+      if (b.live && !req.body.confirmarEnVivo) {
+        throw errorDe("BOX_IS_LIVE", { hayQueBajarla: true });
+      }
```

### Cómo verificar

Repetir el PoC y mirar que el `AdminLog` de `box.edit` traiga `antes.prizes` con las chances viejas y `despues.prizes` con las nuevas.

---

## FAIR-03 — `/boxes/:slug/demo` ignora `live`: expone la tabla de una caja apagada o no aprobada

- **Severidad:** Media
- **Categoría:** Cajas / exposición de datos
- **Archivo:** `backend/services/boxes/index.js:88`, `backend/routes/boxes/index.js:328-352`
- **Confianza:** Confirmado (reproducido, con y sin sesión)
- **Esfuerzo:** Muy bajo (1 línea)

### Descripción

El chequeo de "al aire" está puenteado para el modo demostración:

```js
// services/boxes/index.js:88
if (!demo && !caja.live) throw errorDe("BOX_NOT_LIVE");
```

Y la ruta de demo deja pasar a cualquiera, con o sin sesión:

```js
// routes/boxes/index.js:328
router.post("/:slug/demo", autorizar(false), limiteAbrir, async (req, res) => {
```

La respuesta del demo incluye `caja: resumenDeCaja(caja)` (`services/boxes/index.js:111`), que trae **la tabla de premios entera con sus chances y sus valores**.

Es una inconsistencia con el resto del sistema, que sí tapa las cajas apagadas: `GET /boxes/:slug` devuelve `400 BOX_NOT_LIVE` salvo para admin (`routes/boxes/index.js:284-286`), y el catálogo filtra por `live: true`.

### Impacto concreto

- Las cajas de la comunidad **pendientes de aprobación** quedan visibles por slug: alguien que arma una caja y la manda a revisar expone su diseño antes de que nadie la mire. Los slugs son predecibles (`slugLibre()` los arma del nombre: `services/community/index.js:142-156`).
- Una caja que el panel bajó del aire —porque pagaba mal, o porque está en edición— sigue mostrando su tabla.
- Sin sesión no hay tope de demos: `aperturasDeDemo` solo se cuenta si hay `req.user` (`routes/boxes/index.js:334-340`), así que cualquiera enumera slugs y lee tablas sin límite más allá del rate limit de 120/min.

No hay pérdida de plata: el demo no cobra ni acredita nada.

### Pasos para reproducir

1. Tomar el slug de una caja con `live: false`.
2. `POST /api/boxes/<slug>/demo` **sin token**.

### PoC

`concurrencia.js`, bloque 3:

```json
{ "open":           [400, "BOX_NOT_LIVE"],
  "getPublico":     [400, "BOX_NOT_LIVE"],
  "demoConSesion":  [200, null],
  "demoSinSesion":  [200, null],
  "demoExponeTabla": true,
  "demoChances": ["Caro=0.1", "Barato=0.9"] }
```

### Arreglo propuesto

```diff
--- a/backend/services/boxes/index.js
+++ b/backend/services/boxes/index.js
@@
-  if (!demo && !caja.live) throw errorDe("BOX_NOT_LIVE");
+  /*
+    TAMBIEN EN DEMO.
+
+    El demo no cobra, así que la tentación es dejarlo pasar. Pero
+    devuelve la tabla de premios entera, y eso convierte a /demo en una
+    mirilla a las cajas apagadas y a las de la comunidad que todavía
+    nadie aprobó. Lo que no está al aire no se mira por ningún lado.
+  */
+  if (!caja.live) throw errorDe("BOX_NOT_LIVE");
```

Si el panel necesita probar una caja antes de publicarla, que la ruta acepte al admin igual que `GET /:slug`:

```diff
-router.post("/:slug/demo", autorizar(false), limiteAbrir, async (req, res) => {
+router.post("/:slug/demo", autorizar(false), limiteAbrir, async (req, res) => {
   try {
+    const caja = await cajas.cajaPorSlug(req.params.slug);
+    if (!caja.live && !(req.user && ["admin", "owner"].includes(req.user.rank))) {
+      throw errorDe("BOX_NOT_LIVE");
+    }
```

### Cómo verificar

`POST /api/boxes/<slug-apagado>/demo` sin token tiene que dar `400 BOX_NOT_LIVE`, y con token de admin tiene que seguir funcionando.

---

## FAIR-04 — `GET /deals/verify/:id` es público y sin dueño: expone apuestas ajenas

- **Severidad:** Media
- **Categoría:** Provably fair / privacidad
- **Archivo:** `backend/routes/deals/index.js:195-201`, `backend/services/deals/index.js:354-380`
- **Confianza:** Confirmado (reproducido sin sesión)
- **Esfuerzo:** Bajo

### Descripción

```js
// routes/deals/index.js:195
router.get("/verify/:id", async (req, res) => {
  try {
    return res.json({ success: true, data: await deals.verificar({ dealId: req.params.id }) });
```

Sin `autorizar()` y sin filtrar por dueño. El servicio tampoco:

```js
// services/deals/index.js:354
async function verificar({ dealId }) {
  const recibo = await Deal.findById(dealId).lean();
```

La respuesta siempre incluye `sinSecretos(recibo)` (`deals/index.js:382-397`): nombre del objeto, su valor, la chance elegida, **la apuesta** y si ganó.

El equivalente de cajas sí está bien hecho: `cajas.verificar({ user, boxOpenId })` filtra `{ _id: boxOpenId, user: user._id }` (`services/boxes/index.js:548`) y `GET /inventory/fair/verify/:id` pide sesión. Lo verifiqué: leer la apertura de otro da `404 ITEM_NOT_FOUND`.

### Impacto concreto

Un tercero con un id de deal ve cuánto apostó otro jugador, a qué y si ganó. Los `ObjectId` de Mongo llevan el timestamp y un contador, así que son parcialmente adivinables: con uno propio se pueden enumerar vecinos.

Que la **semilla** salga una vez retirada la tanda es correcto y es el punto del mecanismo (así cualquiera puede auditar un resultado ajeno). Lo que no corresponde es que salga el historial de apuestas con él.

### Pasos para reproducir

1. Jugar un deal con la cuenta A y quedarse con el `dealId`.
2. `GET /api/deals/verify/<dealId>` **sin token**.

### PoC

`concurrencia.js`, bloque 8:

```json
{ "sinSesionAntesDeRotar": { "estado": 200, "sePuede": false,
                             "exponeSemilla": false,
                             "exponeApuestaAjena": true },
  "sinSesionTrasRotar":    { "estado": 200, "sePuede": true,
                             "exponeSemilla": true, "coincide": true } }

"verifyCajaAjena": [404, "ITEM_NOT_FOUND"]   <-- así se hace, en cajas
```

### Arreglo propuesto

Dos opciones. La mínima, dejar la verificación pública pero sin los montos:

```diff
--- a/backend/services/deals/index.js
+++ b/backend/services/deals/index.js
@@
-function sinSecretos(recibo) {
+/*
+  @param {boolean} esMio  si lo pide el dueño. Un tercero puede auditar
+  el sorteo --ese es el punto-- pero no necesita saber cuánto apostó
+  otro ni a qué. Lo que hace falta para rehacer la cuenta es la chance,
+  el nonce y las semillas; el monto no entra en el HMAC.
+*/
+function sinSecretos(recibo, esMio = false) {
   return {
     _id: recibo._id,
-    itemName: recibo.itemName,
-    valueSc: sc(recibo.valueSc),
     chance: recibo.chance,
-    stakeSc: sc(recibo.stakeSc),
     gano: recibo.gano,
     semillaServidorHash: recibo.semillaServidorHash,
     semillaCliente: recibo.semillaCliente,
     nonce: recibo.nonce,
     hmac: recibo.hmac,
     numero: recibo.numero,
     createdAt: recibo.createdAt,
+    ...(esMio ? {
+      itemName: recibo.itemName,
+      valueSc: sc(recibo.valueSc),
+      stakeSc: sc(recibo.stakeSc),
+    } : {}),
   };
 }
```

con `verificar({ dealId, userId })` pasando `esMio = userId && String(recibo.user) === String(userId)` y la ruta con `autorizar(false)`.

La simétrica con cajas, si no hace falta que un tercero audite:

```diff
-router.get("/verify/:id", async (req, res) => {
+router.get("/verify/:id", autorizar(true), async (req, res) => {
   try {
-    return res.json({ success: true, data: await deals.verificar({ dealId: req.params.id }) });
+    return res.json({ success: true, data: await deals.verificar({ user: req.user, dealId: req.params.id }) });
```

### Cómo verificar

`GET /api/deals/verify/<id ajeno>` no tiene que traer `stakeSc` ni `valueSc` (o tiene que dar 404, según la opción elegida), y el dueño tiene que seguir viendo todo con `coincide: true`.

---

## FAIR-05 — Rotar la semilla en paralelo rompe con E11000 y deja tandas huérfanas

- **Severidad:** Media
- **Categoría:** Provably fair / robustez
- **Archivo:** `backend/services/boxes/index.js:603-636`
- **Confianza:** Confirmado (reproducido, 10 errores 500 de 10 intentos)
- **Esfuerzo:** Medio

### Descripción

`rotarSemilla` hace cuatro operaciones sueltas y la invariante "una sola tanda activa por jugador" la sostiene un índice único de la base, no el código:

```js
// services/boxes/index.js:603-622
async function rotarSemilla({ user, semillaCliente }) {
  const vieja = await UserSeed.findOne({ user: user._id, activa: true });

  const nueva = fair.semillaNueva();
  const creada = await UserSeed.create({
    ...
    activa: false, // se enciende recién cuando la vieja se apagó
  });

  if (vieja) {
    await UserSeed.updateOne({ _id: vieja._id }, { $set: { activa: false, reveladaEn: new Date() } });
  }
  await UserSeed.updateOne({ _id: creada._id }, { $set: { activa: true } });
```

Con dos rotaciones a la vez, las dos leen la misma `vieja` y las dos crean su tanda nueva. La primera que llega al último `updateOne` gana; la segunda choca contra el índice único `{ user: 1, activa: 1 }` de `UserSeed.js:64-67` y tira **E11000 → 500**, dejando su tanda recién creada en `activa: false, reveladaEn: null` para siempre.

Hay una ventana peor: entre `vieja → activa:false` y `creada → activa:true` **ningún documento del jugador tiene `activa: true`**. Si en ese instante entra una apertura, `semillaDe()` (`services/boxes/index.js:59-73`) no encuentra tanda y **crea una tercera**, que gana el índice; entonces la rotación falla con 500 y el jugador se queda jugando con una tanda cuyo hash nunca le mostraron antes de jugar.

### Impacto concreto

- **Lo importante: la integridad del sorteo NO se rompe.** Lo verifiqué: cero colisiones de nonce dentro de una tanda, cero HMAC repetidos, y el dinero no se mueve (el 500 de `open` ocurre en `semillaDe`, en la línea 130, **antes** del bucle que cobra en la 171).
- Pero el jugador que hace doble clic en "cambiar semilla" ve un error del servidor, y no sabe si su semilla rotó o no.
- Quedan filas basura en `userseeds`: 8 huérfanas en 10 intentos.
- Esas huérfanas están en el estado exacto que FAIR-06 vuelve riesgoso.

### Pasos para reproducir

Disparar varios `POST /api/inventory/fair/rotate` a la vez con el mismo token.

### PoC

`concurrencia.js`, bloque 2 (25 aperturas x4 + 10 rotaciones, todo en paralelo):

```json
{ "aperturas": 92, "tandas": 11, "activas": 1,
  "inactivasSinRevelar": 8,
  "colisionesNonceEnMismaTanda": 0,
  "hmacsRepetidos": 0,
  "errores5xx": 10, "codigos": [200, 500] }
```

Log del servidor:

```
ERROR [inventory] rotate: E11000 duplicate key error collection:
  mrbox_audit_fair.userseeds index: user_1_activa_1
  dup key: { user: ObjectId('...'), activa: true }     × 8
ERROR [boxes] open: E11000 duplicate key error ...     × 2
```

### Arreglo propuesto

Apagar la vieja con la condición en el filtro, y arrancar la nueva solo si esa apagada fue mía:

```diff
--- a/backend/services/boxes/index.js
+++ b/backend/services/boxes/index.js
@@ async function rotarSemilla({ user, semillaCliente }) {
-  const vieja = await UserSeed.findOne({ user: user._id, activa: true });
-
-  const nueva = fair.semillaNueva();
-  const creada = await UserSeed.create({
-    user: user._id,
-    semillaServidor: nueva,
-    semillaServidorHash: fair.hashDeSemilla(nueva),
-    semillaCliente: String(semillaCliente || "").trim().slice(0, 64) || fair.semillaNueva().slice(0, 16),
-    nonce: 0,
-    activa: false, // se enciende recién cuando la vieja se apagó
-  });
-
-  if (vieja) {
-    await UserSeed.updateOne(
-      { _id: vieja._id },
-      { $set: { activa: false, reveladaEn: new Date() } }
-    );
-  }
-  await UserSeed.updateOne({ _id: creada._id }, { $set: { activa: true } });
+  /*
+    APAGAR LA VIEJA ES LO QUE DA EL TURNO.
+
+    La condición `activa: true` va EN EL FILTRO: si dos rotaciones
+    entran juntas, la base deja que UNA sola apague la tanda, y esa es
+    la única que puede encender la siguiente. La otra se encuentra sin
+    nada que apagar y devuelve la tanda que ya quedó activa, en vez de
+    crear una segunda y chocar contra el índice único.
+
+    Y la nueva se crea con `activa: true` directo: dejar al jugador sin
+    ninguna tanda activa, aunque sea un milisegundo, hace que una
+    apertura simultánea se fabrique una tercera por su cuenta.
+  */
+  const vieja = await UserSeed.findOneAndUpdate(
+    { user: user._id, activa: true },
+    { $set: { activa: false, reveladaEn: new Date() } },
+    { new: false }
+  ).lean();
+
+  if (!vieja) {
+    /* Otra rotación se adelantó. La de ella vale; no se hace una más. */
+    const yaEsta = await semillaDe(user._id);
+    return {
+      nueva: {
+        semillaServidorHash: yaEsta.semillaServidorHash,
+        semillaCliente: yaEsta.semillaCliente,
+        nonce: yaEsta.nonce,
+      },
+      revelada: null,
+    };
+  }
+
+  const nueva = fair.semillaNueva();
+  const creada = await UserSeed.create({
+    user: user._id,
+    semillaServidor: nueva,
+    semillaServidorHash: fair.hashDeSemilla(nueva),
+    semillaCliente: String(semillaCliente || "").trim().slice(0, 64) || fair.semillaNueva().slice(0, 16),
+    nonce: 0,
+    activa: true,
+  });
```

(el `return` de abajo usa `creada` en vez de releerla, y `vieja.nonce` sigue sirviendo para `aperturas`).

Y en `semillaDe`, atrapar el E11000 de la carrera y releer, en vez de propagar un 500:

```diff
   const semilla = fair.semillaNueva();
-  tanda = await UserSeed.create({ ... });
-  return UserSeed.findById(tanda._id).select("+semillaServidor");
+  try {
+    tanda = await UserSeed.create({ ... });
+  } catch (err) {
+    /* Otro pedido le creó la tanda en el mismo instante: la que vale es
+       la suya. Un 500 acá le rompe la apertura a alguien por una
+       carrera que no le importa. */
+    if (!err || err.code !== 11000) throw err;
+    return UserSeed.findOne({ user: userId, activa: true }).select("+semillaServidor");
+  }
+  return UserSeed.findById(tanda._id).select("+semillaServidor");
```

Y un arreglo de datos: borrar las `UserSeed` con `activa: false`, `reveladaEn: null` y `nonce: 0`, que son huérfanas sin aperturas.

### Cómo verificar

Repetir el PoC: los 10 `rotate` tienen que devolver 200, `errores5xx` tiene que dar 0, `inactivasSinRevelar` tiene que dar 0 y `activas` tiene que seguir en 1.

---

## FAIR-06 — `deals.verificar` revela la semilla con `!activa` en vez de `reveladaEn`

- **Severidad:** Baja
- **Categoría:** Provably fair
- **Archivo:** `backend/services/deals/index.js:363`
- **Confianza:** Confirmado (la inconsistencia es cierta; no logré encadenarla a una fuga real)
- **Esfuerzo:** Muy bajo (1 línea)

### Descripción

Los dos verificadores deciden distinto cuándo una semilla ya se puede mostrar.

Cajas, correcto — mira la marca explícita de revelación:

```js
// services/boxes/index.js:558
const revelada = tanda && tanda.reveladaEn ? tanda.semillaServidor : null;
if (!revelada) { return { verificable: false, motivo: "LA_SEMILLA_SIGUE_TAPADA", ... }; }
```

Deals, más flojo — alcanza con que no esté activa:

```js
// services/deals/index.js:363
if (!tanda || tanda.activa) {
  return { sePuede: false, motivo: "SEED_STILL_ACTIVE", recibo: sinSecretos(recibo) };
}
// ...y a partir de acá devuelve tanda.semillaServidor
```

"No activa" y "revelada" **no son lo mismo**. FAIR-05 demuestra que el sistema produce tandas con `activa: false` y `reveladaEn: null`: medí 8 en una sola prueba. El propio `rotarSemilla` crea la tanda nueva en ese estado antes de encenderla (`services/boxes/index.js:613`).

### Impacto concreto

Hoy no encontré una secuencia que filtre una semilla **en uso**: una tanda solo acumula tiros mientras está activa, y el único camino que la desactiva (`rotarSemilla`) le pone `reveladaEn` en el mismo `$set`. Por eso lo pongo en Baja y no más arriba. Pero es la clase de condición que deja de ser cierta con el próximo cambio —por ejemplo, un botón de admin que desactive una tanda, o un arreglo parcial de FAIR-05— y el día que deje de serlo, el efecto es que un jugador calcula lo que le va a salir antes de apostar. Es una línea.

### Pasos para reproducir

Es una revisión de código. El estado que lo habilita se reproduce con el PoC de FAIR-05 (`inactivasSinRevelar: 8`).

### Arreglo propuesto

```diff
--- a/backend/services/deals/index.js
+++ b/backend/services/deals/index.js
@@
-  if (!tanda || tanda.activa) {
+  /*
+    LA MARCA QUE VALE ES `reveladaEn`, NO `activa`.
+
+    "No activa" y "revelada" no son lo mismo: una tanda puede quedar
+    apagada sin haberse revelado nunca --`rotarSemilla` crea la nueva
+    así antes de encenderla-- y en ese estado mostrar la semilla deja
+    al jugador calcular lo que le va a salir. Es la misma condición que
+    usa `boxes.verificar`, y tienen que decir lo mismo.
+  */
+  if (!tanda || !tanda.reveladaEn) {
     return { sePuede: false, motivo: "SEED_STILL_ACTIVE", recibo: sinSecretos(recibo) };
   }
```

### Cómo verificar

Un deal jugado con la tanda activa tiene que seguir dando `sePuede: false`; después de `POST /inventory/fair/rotate`, `sePuede: true` y `coincide: true`. Y forzar en la base una tanda `activa: false, reveladaEn: null` con un deal apuntándole tiene que dar `sePuede: false`.

---

## FAIR-07 — Una tanda x4 sin saldo cobra las primeras y devuelve 400: el jugador no ve lo que ganó

- **Severidad:** Media
- **Categoría:** Cajas / consistencia
- **Archivo:** `backend/services/boxes/index.js:125-128` y `:142-320`
- **Confianza:** Confirmado (reproducido)
- **Esfuerzo:** Bajo

### Descripción

Antes de cobrar se revisan los límites del jugador **por la tanda entera**, y el comentario explica bien por qué:

```js
// services/boxes/index.js:118-128
/*  Se miran por la tanda entera y no apertura por apertura: pedir x4
    con el tope a dos aperturas de distancia tiene que rebotar entero,
    no cobrar dos y fallar en la tercera dejando media tanda hecha.  */
await controles.revisarAntesDeJugar({
  userId: user._id,
  montoSc: sc(precioUnitario * cuantas),
});
```

Pero **el saldo no se revisa ahí**. El bucle cobra de a una (`:171-179`) y la condición de saldo vive dentro de `wallet.mover` (`services/wallet/index.js`, `filtro.balanceSc = { $gte: -monto }`). Cuando la plata se termina en la apertura 3 de 4, el `throw` sube hasta la ruta y el jugador recibe `400 NOT_ENOUGH_COINS` — con las dos primeras **ya cobradas, ya sorteadas y ya entregadas**.

Es exactamente el caso que el comentario de arriba quiso evitar, para la condición que falta.

### Impacto concreto

Las cuentas cierran: la plata que salió corresponde a los objetos entregados y los recibos quedan bien. Lo verifiqué. Pero:

- El jugador paga SC 20, ve un cartel de error, **no ve la ruleta ni sabe qué le tocó**, y tiene que descubrir por su cuenta que hay dos objetos nuevos en su inventario.
- Si le salió el premio grande en una de esas dos, la primera vez que lo ve es como una fila en una lista. Para un sitio cuyo producto es el momento de la apertura, eso es grave.
- Es generador directo de tickets de soporte: "me cobraron y me dio error".

### Pasos para reproducir

1. Cuenta con SC 25.
2. `POST /api/boxes/<slug de SC 10>/open` con `{ "veces": 4 }`.

### PoC

`extras.js`, bloque B:

```json
{ "saldoAntes": 25,
  "estado": 400, "code": "NOT_ENOUGH_COINS",
  "saldoDespues": 5,
  "aperturasGuardadas": 2,
  "objetosEnInventario": 2,
  "laPantallaVioElResultado": false }
```

### Arreglo propuesto

Revisar el saldo de la tanda entera junto con los límites, antes de cobrar nada:

```diff
--- a/backend/services/boxes/index.js
+++ b/backend/services/boxes/index.js
@@
   await controles.revisarAntesDeJugar({
     userId: user._id,
     montoSc: sc(precioUnitario * cuantas),
   });
+
+  /*
+    Y EL SALDO, POR LA TANDA ENTERA, POR LA MISMA RAZON.
+
+    `wallet.mover` ya no deja gastar de más --la condición va en el
+    filtro-- pero rebota en la apertura 3 de 4, con dos ya cobradas y
+    entregadas. El jugador se come un error y nunca ve lo que le tocó.
+
+    Esto NO reemplaza la condición de `wallet.mover`: es un rebote
+    temprano para que la tanda sea todo o nada de cara al jugador. La
+    que decide sigue siendo la base.
+  */
+  if (precioUnitario > 0) {
+    const gratisQueLeQuedan = Math.min(cuantas, Number(user.freeOpens) || 0);
+    const aPagar = sc(precioUnitario * (cuantas - gratisQueLeQuedan));
+    const { balanceSc } = await wallet.saldoDe(user._id);
+    if (aPagar > 0 && sc(balanceSc) < aPagar) {
+      throw errorDe("NOT_ENOUGH_COINS", { hacenFalta: aPagar, tiene: sc(balanceSc) });
+    }
+  }
```

Como red de atrás, si el bucle igual falla en la mitad, devolver lo hecho en vez de un error seco:

```diff
   for (let i = 0; i < cuantas; i += 1) {
+    try {
       ...
+    } catch (err) {
+      /* Si ya hay aperturas hechas, el jugador tiene derecho a verlas:
+         ya las pagó. El error de las que faltan viaja al lado. */
+      if (!resultados.length) throw err;
+      parcial = { code: err.code || "SOMETHING_WENT_WRONG", faltaron: cuantas - resultados.length };
+      break;
+    }
   }
```

…y que la respuesta lleve `parcial` para que la pantalla muestre las que salieron y después el aviso.

### Cómo verificar

Repetir el PoC: tiene que dar `400 NOT_ENOUGH_COINS` con `aperturasGuardadas: 0`, `objetosEnInventario: 0` y el saldo intacto en 25.

---

## FAIR-08 — El retorno que se le muestra al jugador se desvía hasta +0,31 pp del real

- **Severidad:** Baja
- **Categoría:** Cajas / economía
- **Archivo:** `backend/services/boxes/economia.js:64-72` y `:101-105`; `backend/routes/boxes/index.js:301`
- **Confianza:** Confirmado (medido sobre las 165 cajas)
- **Esfuerzo:** Bajo

### Descripción

`pagoPromedio` redondea el valor esperado **a centavos** antes de devolverlo:

```js
// services/boxes/economia.js:64-72
function pagoPromedio(premios) {
  return sc(                                        // <-- redondeo a centavos
    premios.reduce((acc, p) => acc + (Number(p.valueSc) || 0) * (Number(p.chance) || 0), 0)
  );
}
```

y `retornoReal` divide ese número redondeado:

```js
// services/boxes/economia.js:101-105
function retornoReal(premios, precio) {
  return pagoPromedio(premios) / p;
}
```

El EV de una caja **no es un monto de plata**: es una esperanza matemática, y redondearla al centavo mete un error relativo que en una caja barata es grande. En `junk-box` el EV real es SC 1,1868 y `pagoPromedio` devuelve SC 1,19: 0,27 % de más.

Ese número es el que viaja al jugador. `GET /boxes/:slug` devuelve:

```js
// routes/boxes/index.js:301
retornoMostrado: Math.round((caja.retorno || 0) * 10000) / 100,
```

y la fila "Best Odds" de la portada ordena por el mismo campo (`routes/boxes/index.js:201-202`).

### Impacto concreto

Medido sobre las 165 cajas (`api-vs-sorteo.js`):

| caja | mostrado | real | desvío |
|---|---|---|---|
| `just-games` | 92,31 % | 92,00 % | **+0,31 pp** |
| `junk-box` | 92,25 % | 92,00 % | +0,25 pp |
| `asics` | 92,18 % | 92,00 % | +0,18 pp |
| `cheap-games` | 91,86 % | 92,00 % | −0,14 pp |
| `gopro` | 91,86 % | 92,00 % | −0,14 pp |

**22 de 165 cajas** se desvían más de 0,05 pp. Ninguna miente a favor de la casa en el sorteo —el RTP real está entre 91,958 % y 92,000 % en las 165, y el premio que sale es el que dice la tabla— pero el número publicado no es el real, y el sitio hace bandera de publicarlo ("No tenemos nada que esconder", `routes/boxes/index.js:299-300`).

Hay un segundo efecto: **la fila "Best Odds" ordena por un artefacto de redondeo.** Las 165 cajas devuelven el mismo 92 %; lo que decide el orden de esa fila es el error de `sc()`, no la generosidad de la caja.

Y un tercero: `precioDe()` usa el mismo `pagoPromedio` redondeado, así que vuelve a guardar una caja desde el panel le cambia el precio sin que nadie lo haya pedido. En `junk-box`, de SC 1,29 a SC 1,30.

### Pasos para reproducir

```
node api-vs-sorteo.js
```

### PoC

```
retornoMostrado vs RTP real de la tabla:
  peor desvío: { "slug": "just-games", "mostrado": 92.31, "real": 92, "delta": 0.31 }
  cajas con |delta| > 0,05 pp: 22 / 165
```

### Arreglo propuesto

Redondear la plata, no la esperanza:

```diff
--- a/backend/services/boxes/economia.js
+++ b/backend/services/boxes/economia.js
@@
+/*
+  EL VALOR ESPERADO NO ES PLATA.
+
+  `sc()` redondea a centavos, y eso está bien para un saldo o un
+  premio: son montos que alguien cobra. Esto es una esperanza
+  matemática, y en una caja de SC 1,29 el medio centavo de redondeo es
+  un cuarto de punto porcentual. Ese cuarto de punto termina en el
+  retorno que se le muestra al jugador y en el orden de "Best Odds".
+
+  Se devuelve sin redondear; quien necesite un monto, que llame a sc().
+*/
 function pagoPromedio(premios) {
   if (!Array.isArray(premios)) return 0;
-  return sc(
-    premios.reduce(
-      (acc, p) => acc + (Number(p.valueSc) || 0) * (Number(p.chance) || 0),
-      0
-    )
+  return premios.reduce(
+    (acc, p) => acc + (Number(p.valueSc) || 0) * (Number(p.chance) || 0),
+    0
   );
 }
```

`precioDe` ya redondea para arriba al centavo al final (`:92`), así que el precio sigue saliendo en plata; `revisarCaja` devuelve `pagoPromedio: promedio` para mostrar, que conviene envolver en `sc()` **en el lugar donde se muestra**, no en el cálculo. Y el campo `pagoPromedio` que se guarda en `Box` (`routes/admin/index.js:506`, `services/community/index.js:245`) también se guarda con `sc()`.

Después hace falta recalcular `retorno` en las 22 cajas desviadas. **Ojo:** con `pagoPromedio` sin redondear, `precioDe()` da un centavo distinto en algunas cajas baratas, así que el recálculo hay que hacerlo tocando `retorno` **sin** tocar `priceSc`, o cambiarle el precio a propósito y avisarlo.

### Cómo verificar

Volver a correr `api-vs-sorteo.js`: `cajas con |delta| > 0,05 pp` tiene que dar 0 y el peor desvío tiene que quedar por debajo de 0,005 pp.

---

## FAIR-09 — Cancelar un envío en paralelo devuelve 200 varias veces

- **Severidad:** Baja
- **Categoría:** Inventario / envíos
- **Archivo:** `backend/services/shipping/index.js:166-181`
- **Confianza:** Confirmado (6 de 6 cancelaciones devolvieron 200)
- **Esfuerzo:** Muy bajo

### Descripción

`cancelar` lee el pedido, mira el estado en JavaScript y después guarda:

```js
// services/shipping/index.js:166-178
async function cancelar({ user, orderId, motivo = "" }) {
  const pedido = await Order.findOne({ _id: orderId, user: user._id });
  if (!pedido) throw errorDe("ITEM_NOT_FOUND", {}, 404);
  if (!["pending", "packing"].includes(pedido.estado)) throw errorDe("ITEM_ALREADY_GONE");

  await InventoryItem.updateMany(
    { order: pedido._id, user: user._id, state: "requested" },
    { $set: { state: "held", order: null } }
  );

  pedido.estado = "cancelled";
  pedido.motivo = String(motivo || "").slice(0, 200);
  await pedido.save();
```

Es justo el patrón que el resto del archivo evita a propósito: `pedir()` pone la condición de estado **en el filtro** (`:108-111`) y lo explica en un comentario (`:101-107`). Acá no.

### Impacto concreto

Lo medí y **no hay daño patrimonial**: los objetos vuelven a `held` una sola vez (el `updateMany` filtra `state: "requested"`, y el segundo no encuentra nada) y la cancelación no devuelve plata porque el envío nunca la cobró. Lo que sí pasa es que seis pedidos de cancelación devuelven `200 OK` sobre un pedido que ya estaba cancelado, cuando deberían devolver `ITEM_ALREADY_GONE`.

El riesgo real está en la carrera con el depósito: si un admin marca el pedido `shipped` justo mientras el jugador cancela, el `pedido.save()` de Mongoose escribe `estado: "cancelled"` encima. Queda un paquete en la calle contra un pedido cancelado. Es una ventana estrecha y pide que las dos cosas pasen en el mismo instante, pero el arreglo es de una línea.

### Pasos para reproducir

Disparar varios `POST /api/inventory/ship/:orderId/cancel` a la vez.

### PoC

`concurrencia.js`, bloque 6:

```json
{ "cancelacionesOk": 6,
  "plataDevuelta": 0,
  "estadosFinales": ["held", "held"] }
```

(y, bien resuelto, el caso del despachado: `cancelarDespachado: { estado: 400, code: "ITEM_ALREADY_GONE", estadoItem: "shipped", plataDevuelta: 0 }`)

### Arreglo propuesto

```diff
--- a/backend/services/shipping/index.js
+++ b/backend/services/shipping/index.js
@@ async function cancelar({ user, orderId, motivo = "" }) {
-  const pedido = await Order.findOne({ _id: orderId, user: user._id });
-  if (!pedido) throw errorDe("ITEM_NOT_FOUND", {}, 404);
-  if (!["pending", "packing"].includes(pedido.estado)) throw errorDe("ITEM_ALREADY_GONE");
+  /*
+    LA CONDICION DE ESTADO VA EN EL FILTRO, igual que en `pedir`.
+
+    Mirándola en JavaScript, seis cancelaciones a la vez pasan las
+    seis, y --peor-- un `save()` que escribe el documento entero puede
+    pisar un `shipped` que el depósito acaba de poner. Un paquete en la
+    calle contra un pedido cancelado.
+  */
+  const pedido = await Order.findOneAndUpdate(
+    { _id: orderId, user: user._id, estado: { $in: ["pending", "packing"] } },
+    { $set: { estado: "cancelled", motivo: String(motivo || "").slice(0, 200) } },
+    { new: false }
+  ).lean();
+
+  if (!pedido) {
+    const existe = await Order.findOne({ _id: orderId, user: user._id }).lean();
+    if (!existe) throw errorDe("ITEM_NOT_FOUND", {}, 404);
+    throw errorDe("ITEM_ALREADY_GONE", { estado: existe.estado });
+  }
 
   await InventoryItem.updateMany(
     { order: pedido._id, user: user._id, state: "requested" },
     { $set: { state: "held", order: null } }
   );
-
-  pedido.estado = "cancelled";
-  pedido.motivo = String(motivo || "").slice(0, 200);
-  await pedido.save();
 
-  return { _id: pedido._id, estado: pedido.estado };
+  return { _id: pedido._id, estado: "cancelled" };
 }
```

### Cómo verificar

Repetir el PoC: `cancelacionesOk` tiene que dar 1, las otras cinco `400 ITEM_ALREADY_GONE`, y los objetos tienen que terminar igual en `held`.

---

## FAIR-10 — El panel valida cajas ignorando `topePremioSc` y `retornoObjetivo`

- **Severidad:** Baja
- **Categoría:** Cajas / configuración
- **Archivo:** `backend/routes/admin/index.js:497`
- **Confianza:** Confirmado (revisión de código + comparación con los otros llamadores)
- **Esfuerzo:** Muy bajo

### Descripción

`revisarCaja` acepta `retornoObjetivo` y `topePremio` por opciones, con valores por defecto `RETORNO_OBJETIVO` (0,92) e `Infinity` (`economia.js:132-137`). El guardado del panel no le pasa ninguno:

```js
// routes/admin/index.js:497
const revision = eco.revisarCaja(b, { esDeComunidad: !!b.creator });
```

Mientras que los scripts de siembra sí:

```js
// scripts/sembrar.js:271
{ retornoObjetivo: cfg.retornoObjetivo, topePremio: cfg.topePremioSc }
```

Resultado: las perillas `retornoObjetivo` y `topePremioSc` de `Settings` (defaults 0,92 y SC 300.000, `Settings.js:75,78`) **no se aplican en la única ruta por la que se edita una caja en producción**.

### Impacto concreto

- Se puede guardar una caja con un premio por encima del tope de pago configurado sin que nada avise. El tope existe para que la casa no quede expuesta a un objeto que no puede entregar.
- Si alguien baja `retornoObjetivo` a 0,90 desde el panel, las cajas editadas después se siguen preciando al 0,92 y los avisos de "retorno alto/bajo" se miden contra el objetivo viejo.
- La perilla está en la pantalla de Settings, así que quien la mueve cree que hizo algo.

No es explotable por un jugador: hace falta ser admin para llegar acá.

### Arreglo propuesto

```diff
--- a/backend/routes/admin/index.js
+++ b/backend/routes/admin/index.js
@@
-    const revision = eco.revisarCaja(b, { esDeComunidad: !!b.creator });
+    /*
+      LAS PERILLAS VALEN ACA TAMBIEN.
+
+      `revisarCaja` toma el retorno objetivo y el tope de premio por
+      opciones, y con los defaults el tope es Infinity: sin pasarle la
+      configuración, la única ruta por la que se edita una caja en
+      producción ignora las dos perillas que el panel muestra.
+    */
+    const cfgCajas = await Settings.leer();
+    const revision = eco.revisarCaja(b, {
+      esDeComunidad: !!b.creator,
+      retornoObjetivo: cfgCajas.retornoObjetivo,
+      topePremio: cfgCajas.topePremioSc,
+    });
     if (!revision.ok) throw errorDe("BOX_NOT_VALID", { errores: revision.errores });
 
     if (b.precioAMano && req.body.priceSc !== undefined) {
       b.priceSc = sc(req.body.priceSc);
     } else {
-      b.priceSc = eco.precioDe(b.prizes);
+      b.priceSc = eco.precioDe(b.prizes, cfgCajas.retornoObjetivo);
     }
```

Conviene mirar lo mismo en `services/community/index.js:232` y `:235`, que también llaman sin configuración.

### Cómo verificar

Poner `topePremioSc` en SC 1.000 desde Settings e intentar guardar una caja con un premio de SC 2.000: tiene que rebotar con `BOX_NOT_VALID` y el error `"... over the payout cap"`.

---

## FAIR-11 — Una cuenta sin tanda crea la semilla dentro del mismo pedido que la apertura

- **Severidad:** Info
- **Categoría:** Provably fair
- **Archivo:** `backend/services/boxes/index.js:59-73`
- **Confianza:** Confirmado
- **Esfuerzo:** —

### Descripción

El registro crea la tanda **junto con la cuenta**, y el comentario explica exactamente por qué:

```js
// routes/auth/index.js:152-167
/*  LAS SEMILLAS, DESDE EL MINUTO CERO.
    Se crean junto con la cuenta y no la primera vez que abre una caja:
    así el jugador puede mirar el hash de su semilla ANTES de jugar,
    que es lo único que hace verificable al sorteo.  */
```

Está perfecto. Pero `semillaDe()` tiene un camino de respaldo que crea la tanda **adentro del pedido que abre la caja**:

```js
// services/boxes/index.js:59-73
async function semillaDe(userId) {
  let tanda = await UserSeed.findOne({ user: userId, activa: true }).select("+semillaServidor");
  if (tanda) return tanda;
  const semilla = fair.semillaNueva();
  tanda = await UserSeed.create({ ... });
```

El comentario de arriba lo justifica ("Pasa con cuentas viejas o creadas a mano; no es motivo para no dejarlo jugar"), y es una decisión razonable. Pero para esa primera apertura el hash nunca estuvo publicado antes de jugar, así que esa apertura en particular **no tiene compromiso previo**. La semilla sigue saliendo de `crypto.randomBytes(32)`, así que no hay manipulación posible; lo que falta es la prueba de que no la hubo.

En la base local hoy: 110 tandas, todas activas, ninguna en ese estado anómalo. Lo anoto para que quede escrito, no porque haya algo roto.

### Arreglo propuesto

Alcanza con marcarlas:

```diff
     tanda = await UserSeed.create({
       user: userId,
       semillaServidor: semilla,
       semillaServidorHash: fair.hashDeSemilla(semilla),
       semillaCliente: fair.semillaNueva().slice(0, 16),
       nonce: 0,
       activa: true,
+      /* Se creó dentro del pedido que abre, no al registrarse: para la
+         primera apertura de esta tanda el jugador no llegó a ver el
+         hash antes. Queda anotado para poder decirlo. */
+      creadaAlVuelo: true,
     });
```

y, de paso, correr una vez `regalarSemillaSiFalta` sobre las cuentas que no tengan tanda, para que el camino de respaldo no se use nunca.

---

## Notas menores (no son hallazgos)

- **`rotarSemilla` no devuelve la semilla vieja en su respuesta.** Solo el hash y cuántas aperturas lleva (`services/boxes/index.js:632-634`). La semilla sale por `GET /inventory/fair/verify/:boxOpenId`, apertura por apertura. Funciona, pero un endpoint que devuelva la semilla revelada de una tanda le ahorraría al jugador N pedidos para auditar N aperturas.
- **Apertura gratis y `wallet.mover`.** Si `gastarAperturaGratis` consume el ticket (`:144`) y el `wallet.mover` del regalo falla (`:160-166`), el ticket queda gastado sin apertura. Ventana chica, sin pérdida de plata para el jugador más allá del regalo.
- **Los desafíos suben el retorno efectivo de las cajas que los tienen.** `retos.revisar` paga SC sobre la apertura (`services/challenges/index.js:88-96`) y ese pago no entra en `retorno`. Es una decisión comercial y está bien implementada (cupo atómico en el filtro, índice único contra doble cobro), pero el RTP publicado de esas cajas queda por debajo del efectivo.
- **La apuesta mínima de deals redondea el RTP hacia abajo.** Con `apuestaSc` de SC 0,55 el retorno real es 90,9 % y no 92 %. Está documentado en `deals/index.js:65-81` y el piso de SC 0,50 lo acota entre 90,2 % y 92 %. Correcto y declarado.
- **`veces: -5` abre una caja en vez de rebotar** (`Math.max(1, ...)` en `services/boxes/index.js:90`). Es un *clamp*, no un error de plata: cobra una y entrega una. `veces: 100` sí rebota con `TOO_MANY_AT_ONCE`.

---

## Cómo volver a correr todo

```bash
cd C:/Users/Usuario/mrbox/backend

# Solo lectura sobre la base local
node <scratchpad>/analisis-cajas.js      # suma de chances, EV, RTP de las 165 cajas
node <scratchpad>/api-vs-sorteo.js       # lo mostrado vs lo sorteado, + simulación
node <scratchpad>/replay-aperturas.js    # rehace las 251 aperturas reales

# Contra bases descartables (las crea y las borra solas)
node <scratchpad>/concurrencia.js        # nonce, rotación, ventas, envíos, deals, 10k aperturas
node <scratchpad>/extras.js              # shippable, tanda a medias, admin, comunidad
```

`<scratchpad>` = `C:\Users\Usuario\AppData\Local\Temp\claude\129b3a634fe72b46\ba2ec5dc-2307-4c6d-8248-ec61480eb51f\scratchpad`

**Aviso sobre los números:** `mrbox_local` creció mientras auditaba (de 29 a 251 aperturas, de 11 a 110 tandas, de 164 a 165 cajas) por actividad ajena a esta auditoría. Las cifras de arriba son del último corte. Los resultados no cambiaron con el crecimiento: las cajas siguieron cerrando en 100,00 % y las 251 aperturas siguieron reproduciéndose exactas.
