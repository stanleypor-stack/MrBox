# MR BOX — Auditoría de integridad del dinero

Alcance: `C:\Users\Usuario\mrbox` (solo lectura). Pruebas contra la base local
`mrbox_local` con el servidor levantado en `localhost:5001` y usuarios de
prueba creados por el auditor (`audit_*`). No se tocó producción ni se
escribió un solo archivo del repo.

**Nota de entorno importante:** la base local es *standalone*, no replica set.
`wallet.hayTransacciones()` devuelve `false`, así que **todas las pruebas
corrieron sin transacciones de Mongo**, que es el modo que el propio código
declara soportado ("Preferimos un sitio que funciona en una base simple").
Las condiciones en el filtro (`findOneAndUpdate`) son entonces lo único que
protege, y es exactamente lo que se midió.

Scripts PoC (todos reproducibles, todos en el scratchpad):

- `C:\Users\Usuario\AppData\Local\Temp\claude\129b3a634fe72b46\ba2ec5dc-2307-4c6d-8248-ec61480eb51f\scratchpad\lib.js`
- `...\poc-01-vender-doble.js` · `...\poc-02-envios-solapados.js` · `...\poc-03-canje.js`
- `...\poc-03b-tope-pendientes.js` · `...\poc-04-cajas.js` · `...\poc-04b-gratis.js`
- `...\poc-05-gratis-fuga.js` · `...\poc-05b-registro-real.js` · `...\poc-06-montos.js`
- `...\poc-06b-montos.js` · `...\poc-07-ledger.js` · `...\poc-08-idempotencia.js`
- `...\poc-09-admin-carrera.js` · `...\poc-10-controles.js` · `...\poc-11-varios.js`
- `...\poc-12-deposito-creador.js` · `...\poc-13-reconstruir.js`

---

## Resumen

| ID | Título | Severidad | Confianza |
|---|---|---|---|
| DINERO-01 | La apertura gratis acredita el precio al saldo común antes de cobrar: crea SC canjeables | Crítica | Confirmado (PoC) |
| DINERO-02 | Dos envíos solapados dejan el objeto `held` dentro de un pedido: se vende y se despacha | Alta | Confirmado (PoC) |
| DINERO-03 | `POST /admin/races/:id/pay/:userId` paga el mismo premio tantas veces como clics | Alta | Confirmado (PoC) |
| DINERO-04 | El canje manda el monto en SC con `currency` en BTC/ETH/SOL/...: no hay conversión | Alta | Sospecha alta |
| DINERO-05 | El límite diario de juego se esquiva con pedidos simultáneos | Alta | Confirmado (PoC) |
| DINERO-06 | El promo de tipo `aperturas` ignora `codigo.aperturas` y pisa las cajas de regalo | Media | Confirmado (PoC) |
| DINERO-07 | `veces` fraccionario en Deals cobra más tiros de los que informa | Media | Confirmado (PoC) |
| DINERO-08 | El tope de 3 canjes pendientes es un `countDocuments` previo: se esquiva | Media | Confirmado (PoC) |
| DINERO-09 | La cuenta en pausa sigue pudiendo canjear códigos promocionales | Media | Confirmado (PoC) |
| DINERO-10 | `veces` fraccionario deja `Box.opens` en un número roto | Baja | Confirmado (PoC) |
| DINERO-11 | El aviso de depósito no tiene tope de monto y `sc()` pierde precisión arriba de 2^53/100 | Baja | Confirmado (PoC) |
| DINERO-12 | `sc()` redondea a la mitad para arriba también al canjear | Info | Confirmado (PoC) |
| DINERO-13 | El saldo no se reconstruye desde cero: no hay fila de saldo inicial | Info | Confirmado |

Operaciones que **sí** quedaron bien protegidas (probadas, ver §"Lo que pasó"):
vender item, vender muchos, pedir canje, cancelar canje, rechazar canje,
abrir caja (cobro), rakeback, código promocional, desafíos, cierre de carrera,
aviso de OxaPay, comisión de creador, comisión de socio, `soloCanjeable`.

---

## DINERO-01 · La apertura gratis crea SC canjeables

- **Severidad:** Crítica
- **Categoría:** Race condition / creación de dinero
- **Archivo:** `C:\Users\Usuario\mrbox\backend\services\boxes\index.js:142-179`
- **Confianza:** Confirmado con PoC reproducible
- **Esfuerzo del arreglo:** Medio (1 función, ~15 líneas)

### Qué pasa

Una apertura gratis se resuelve en **tres pasos separados** sobre el saldo
común, y entre el paso 2 y el 3 el saldo queda inflado y gastable por
cualquier otro pedido del mismo jugador:

```js
// services/boxes/index.js:144
const gratis = await gastarAperturaGratis(user._id, caja._id);   // 1. consume la gratis
...
// :159-166
if (gratis && precioUnitario > 0) {
  await wallet.mover({ userId: user._id, amountSc: precioUnitario,  // 2. ACREDITA el precio
    type: "promo_code", reference: { kind: "freeOpen", id: caja._id, label: caja.name } });
}
...
// :171-179
if (precio > 0) {
  await wallet.mover({ userId: user._id, amountSc: -precio,          // 3. cobra
    type: "box_open", juegaSc: precio, reference: { kind: "box", id: caja._id } });
}
```

El comentario de arriba dice "El saldo queda igual --neto cero--", y eso es
cierto **en serie**. En paralelo no: entre (2) y (3) hay SC en el saldo que
no son de nadie. Otro pedido simultáneo —otra caja, más barata— los gasta
primero; entonces (3) falla con `NOT_ENOUGH_COINS`, la excepción sube y sale
del `try`… **pero la acreditación del paso 2 ya está hecha y no se revierte, y
la caja gratis ya quedó marcada `usadaEl`**.

El regalo entra como `type: "promo_code"` **sin `bonoSc`**, o sea sin rollover:
es saldo canjeable a cripto desde el primer segundo.

### Impacto concreto en plata

- Cuenta recién registrada, saldo 0, las tres cajas de regalo de fábrica
  (`mac` SC 2,37 · `pokemon-boosters` SC 7,46 · `splash` SC 3,01): **8 de cada
  10 cuentas terminan con SC canjeables sin haber depositado un peso**,
  promedio SC 4,12, y además se quedan con los objetos de 2 aperturas.
- Si las cajas de regalo se configuran caras, escala linealmente: con
  `expensive-taste` (SC 1.198,39) la prueba sacó **SC 13.121,81 en 12 cuentas**
  (≈ SC 1.093 por cuenta).
- Es farmeable: una cuenta nueva por correo, tres clics simultáneos.

### Pasos exactos para reproducir

1. Registrarse (o `cajas.regalarCajasDeBienvenida(userId)`).
2. Disparar al mismo tiempo `POST /api/boxes/mac/open`,
   `POST /api/boxes/pokemon-boosters/open` y `POST /api/boxes/splash/open`.
3. Mirar `balanceSc`: queda > 0 habiendo empezado en 0.

### PoC

`C:\Users\Usuario\AppData\Local\Temp\claude\129b3a634fe72b46\ba2ec5dc-2307-4c6d-8248-ec61480eb51f\scratchpad\poc-05b-registro-real.js`
(escenario real) y `...\poc-05-gratis-fuga.js` (caja de regalo cara).

Salida real:

```
ronda 0: puso SC 0, quedo con SC 7.46; aperturas 2; gratis usadas 3/3
  libro: promo_code 3.01 | promo_code 2.37 | promo_code 7.46 | box_open -2.37 | box_open -3.01
cuentas que terminaron con saldo > 0 sin depositar nada: 8 / 10
SC creados de la nada: 32.98 (promedio 4.12 por cuenta)
```

Se ven **tres** `promo_code` y solo **dos** `box_open`: el tercer regalo quedó
en el saldo.

### Arreglo propuesto

La apertura gratis no tiene por qué pasar por el saldo. Lo que se quería
—que deje rastro en el libro— se consigue igual con un solo movimiento neto
cero, o mejor, **cobrando primero y acreditando después**, que invierte el
sentido de la ventana: si el cobro falla no hay nada que revertir, y si falla
la acreditación el jugador perdió una gratis pero no se creó plata.

```diff
--- a/backend/services/boxes/index.js
+++ b/backend/services/boxes/index.js
@@
-    if (gratis && precioUnitario > 0) {
-      await wallet.mover({
-        userId: user._id,
-        amountSc: precioUnitario,
-        type: "promo_code",
-        reference: { kind: "freeOpen", id: caja._id, label: caja.name },
-      });
-    }
-
-    /* Gratis o no, la apertura se cobra: el regalo ya entró. */
-    const precio = precioUnitario;
-
-    if (precio > 0) {
-      await wallet.mover({
-        userId: user._id,
-        amountSc: -precio,
-        type: "box_open",
-        juegaSc: precio,
-        reference: { kind: "box", id: caja._id, label: caja.name },
-      });
-    }
+    const precio = precioUnitario;
+
+    if (precio > 0) {
+      if (gratis) {
+        /*
+          LA GRATIS NO PASA POR EL SALDO.
+
+          Acreditar el precio y cobrarlo después son dos operaciones, y
+          entre una y otra el saldo esta inflado: otro pedido del mismo
+          jugador se lo gasta, el cobro de acá falla y el regalo queda
+          en el saldo como SC canjeables. Se anota el movimiento neto
+          cero --que es lo que hace falta para que lo jugado y el margen
+          salgan del libro-- sin que exista nunca un instante con saldo
+          de más.
+        */
+        await wallet.mover({
+          userId: user._id,
+          amountSc: precio,
+          type: "promo_code",
+          juegaSc: 0,
+          reference: { kind: "freeOpen", id: caja._id, label: caja.name },
+          emparejadoCon: "box_open",   // ver nota abajo
+        });
+        await wallet.mover({
+          userId: user._id,
+          amountSc: -precio,
+          type: "box_open",
+          juegaSc: precio,
+          reference: { kind: "box", id: caja._id, label: caja.name },
+        });
+      } else {
+        await wallet.mover({
+          userId: user._id,
+          amountSc: -precio,
+          type: "box_open",
+          juegaSc: precio,
+          reference: { kind: "box", id: caja._id, label: caja.name },
+        });
+      }
+    }
```

Ese diff **no alcanza solo**: sigue habiendo dos `mover()`. La forma correcta,
y la más chica de escribir, es darle a `wallet.mover()` la capacidad de hacer
los dos asientos en una sola operación sobre el documento del usuario:

```diff
--- a/backend/services/wallet/index.js
+++ b/backend/services/wallet/index.js
@@
+/**
+ * DOS ASIENTOS, UN SOLO TOQUE AL SALDO.
+ *
+ * Para los casos donde entra y sale lo mismo --la apertura gratis-- y el
+ * saldo NO puede quedar inflado ni un instante, porque otro pedido del
+ * mismo jugador se lo gasta.
+ */
+async function moverParejo({ userId, entrada, salida }) {
+  const neto = sc(entrada.amountSc + salida.amountSc);   // 0 en la gratis
+  const cambios = { $inc: { balanceSc: neto } };
+  if (salida.juegaSc > 0) {
+    cambios.$inc.jugadoSc = sc(salida.juegaSc);
+    cambios.$inc.bonoPendienteSc = sc(-salida.juegaSc);
+  }
+  const filtro = { _id: userId };
+  if (neto < 0) filtro.balanceSc = { $gte: -neto };
+
+  const antes = await User.findOneAndUpdate(filtro, cambios, { new: false })
+    .select("+balanceSc +bonoPendienteSc").lean();
+  if (!antes) throw errorDe("NOT_ENOUGH_COINS", {});
+
+  const b0 = sc(antes.balanceSc);
+  await BalanceTransaction.create([
+    { user: userId, type: entrada.type, amountSc: sc(entrada.amountSc),
+      balanceBefore: b0, balanceAfter: sc(b0 + entrada.amountSc), reference: entrada.reference },
+    { user: userId, type: salida.type, amountSc: sc(salida.amountSc),
+      balanceBefore: sc(b0 + entrada.amountSc), balanceAfter: sc(b0 + neto), reference: salida.reference },
+  ]);
+  await acotarBono(userId);
+  return { balanceBefore: b0, balanceAfter: sc(b0 + neto) };
+}
```

y en `boxes.abrir()`:

```diff
-    if (gratis && precioUnitario > 0) { ...acreditar... }
-    if (precio > 0) { ...cobrar... }
+    if (precio > 0 && gratis) {
+      await wallet.moverParejo({
+        userId: user._id,
+        entrada: { amountSc: precio, type: "promo_code",
+                   reference: { kind: "freeOpen", id: caja._id, label: caja.name } },
+        salida:  { amountSc: -precio, type: "box_open", juegaSc: precio,
+                   reference: { kind: "box", id: caja._id, label: caja.name } },
+      });
+    } else if (precio > 0) {
+      await wallet.mover({ userId: user._id, amountSc: -precio, type: "box_open",
+        juegaSc: precio, reference: { kind: "box", id: caja._id, label: caja.name } });
+    }
```

Además, **`gastarAperturaGratis` debería devolverse** si después falla algo:
hoy la gratis queda consumida aunque la apertura no se concrete.

### Cómo verificar

Correr `poc-05b-registro-real.js`: tiene que dar
`cuentas que terminaron con saldo > 0 sin depositar nada: 0 / 10`.
Y `poc-05-gratis-fuga.js` con la caja cara: `SC creados de la nada: 0`.

---

## DINERO-02 · Dos envíos solapados: el objeto se vende Y se despacha

- **Severidad:** Alta
- **Categoría:** Race condition / mercadería regalada
- **Archivo:** `C:\Users\Usuario\mrbox\backend\services\shipping\index.js:108-149`
- **Confianza:** Confirmado con PoC reproducible
- **Esfuerzo del arreglo:** Bajo

### Qué pasa

El rollback del pedido de envío usa `order: null` como condición, y **ese
`order: null` también alcanza a los objetos de OTRO pedido que todavía no
grabó su `order`**:

```js
// services/shipping/index.js:108
const marcados = await InventoryItem.updateMany(
  { _id: { $in: objetos.map((o) => o._id) }, user: user._id, state: "held" },
  { $set: { state: "requested" } }
);

if (marcados.modifiedCount !== objetos.length) {
  /* Se devuelve lo que se haya marcado ... */
  await InventoryItem.updateMany(
    { _id: { $in: objetos.map((o) => o._id) }, user: user._id, state: "requested", order: null },
    { $set: { state: "held" } }                     // ← también desmarca los del OTRO pedido
  );
  throw errorDe("ITEM_ALREADY_GONE");
}
...
const pedido = await Order.create({ ... });          // el Order ya incluye el objeto
await InventoryItem.updateMany(
  { _id: { $in: objetos.map((o) => o._id) } },       // ← sin condición de estado
  { $set: { order: pedido._id } }
);
```

Secuencia: A pide {X,Y}, B pide {Y,Z}. A marca X e Y como `requested`. B solo
logra marcar Z, falla la cuenta y **revierte Y y Z a `held`** (los dos
cumplen `requested` + `order: null`, porque A todavía no creó su `Order`).
A sigue: crea el `Order` con X e **Y adentro**, y le pone el `order` a los dos
sin mirar el estado. Resultado: **Y queda `held` —o sea vendible— y al mismo
tiempo dentro de un pedido que el depósito va a despachar**.

### Impacto concreto en plata

El jugador cobra el objeto en SC **y** recibe el objeto físico. En la prueba:
**12 de 25 rondas**, SC 3.600 de mercadería cobrada y despachada a la vez.

### Reproducir

1. Tener tres objetos `held` (X, Y, Z) y una dirección.
2. `POST /api/inventory/ship {ids:[X,Y]}` y `POST /api/inventory/ship {ids:[Y,Z]}` a la vez.
3. Buscar un `InventoryItem` con `state: "held"` y `order != null`.
4. `POST /api/inventory/<ese id>/sell` → paga, y el pedido sigue vivo.

### PoC

`...\scratchpad\poc-02-envios-solapados.js`

```
objetos que quedaron 'held' PERO adentro de un pedido: 12
de esos, vendidos por SC mientras siguen en el pedido: 12
plata cobrada por mercaderia que igual se despacha: SC 3600
```

### Arreglo propuesto

Reservar el objeto **con el `order` puesto en el mismo update** (crear el
`Order` antes y marcar con su id), y que el rollback toque solo lo de ESTE
pedido:

```diff
--- a/backend/services/shipping/index.js
+++ b/backend/services/shipping/index.js
@@
-  const marcados = await InventoryItem.updateMany(
-    { _id: { $in: objetos.map((o) => o._id) }, user: user._id, state: "held" },
-    { $set: { state: "requested" } }
-  );
-
-  if (marcados.modifiedCount !== objetos.length) {
-    await InventoryItem.updateMany(
-      { _id: { $in: objetos.map((o) => o._id) }, user: user._id, state: "requested", order: null },
-      { $set: { state: "held" } }
-    );
-    throw errorDe("ITEM_ALREADY_GONE");
-  }
-
-  const pedido = await Order.create({ ... });
-
-  await InventoryItem.updateMany(
-    { _id: { $in: objetos.map((o) => o._id) } },
-    { $set: { order: pedido._id } }
-  );
+  /*
+    EL PEDIDO SE CREA PRIMERO Y SU ID ES LA RESERVA.
+
+    Marcar `requested` sin dueño deja objetos que otro pedido fallido
+    puede devolver a `held` --`order: null` los alcanza-- mientras este
+    pedido ya los metió adentro. Con el id puesto en el MISMO update, un
+    objeto reservado nunca es anónimo y el rollback solo toca lo propio.
+  */
+  const pedido = await Order.create({ ...,  estado: "draft" });
+
+  const marcados = await InventoryItem.updateMany(
+    { _id: { $in: objetos.map((o) => o._id) }, user: user._id, state: "held", order: null },
+    { $set: { state: "requested", order: pedido._id } }
+  );
+
+  if (marcados.modifiedCount !== objetos.length) {
+    await InventoryItem.updateMany(
+      { order: pedido._id },                       // SOLO lo de este pedido
+      { $set: { state: "held" }, $unset: { order: 1 } }
+    );
+    await Order.deleteOne({ _id: pedido._id });
+    throw errorDe("ITEM_ALREADY_GONE");
+  }
+
+  await Order.updateOne({ _id: pedido._id }, { $set: { estado: "pending" } });
```

(Hay que agregar `"draft"` a `Order.ESTADOS` y excluirlo de la cola del
depósito, o usar un campo `listo: Boolean` si se prefiere no tocar el enum.)

### Cómo verificar

`poc-02-envios-solapados.js` tiene que dar
`objetos que quedaron 'held' PERO adentro de un pedido: 0`.

---

## DINERO-03 · `/admin/races/:id/pay/:userId` paga tantas veces como clics

- **Severidad:** Alta
- **Categoría:** Race condition / doble pago
- **Archivo:** `C:\Users\Usuario\mrbox\backend\routes\admin\carreras.js:160-172`
- **Confianza:** Confirmado con PoC reproducible
- **Esfuerzo del arreglo:** Bajo

### Qué pasa

El comentario dice **"NO PUEDE PAGAR DOS VECES"** y la comprobación es un
`findOne` seguido de un `mover`: leer-y-después-escribir, que es justo lo que
el resto del proyecto evita:

```js
// routes/admin/carreras.js:160-172
const yaCobro = await BalanceTransaction.findOne({
  type: "race_prize", user: g.user, "reference.id": c._id,
}).lean();
if (yaCobro) throw errorDe("ALREADY_CLAIMED");

await wallet.mover({ userId: g.user, amountSc: premioSc, type: "race_prize", ... });
```

Es el único pago del proyecto que no tiene la condición adentro del filtro
(comparar con `cashier.resolver`, `races.cerrar`, `vip.cobrarRakeback`, que
sí la tienen).

### Impacto concreto en plata

20 clics simultáneos sobre un premio de SC 300 → **20 pagos, SC 6.000 en vez
de SC 300: SC 5.700 de más**. Pide panel de admin, pero el escenario que el
comentario quiere cubrir —dos pestañas, dos personas del equipo, un
doble clic— es exactamente el que falla.

### PoC

`...\scratchpad\poc-09-admin-carrera.js`

```
respuestas OK: 20 | pagos en el libro: 20 | saldo del ganador: 6000
FALLA — pagado 20 veces, SC 6000 en vez de 300 (SC 5700 de mas)
```

### Arreglo propuesto

Marcar al ganador en la carrera, con la condición adentro del filtro, **antes**
de mover la plata. Es el mismo patrón que ya usa `races.cerrar`:

```diff
--- a/backend/routes/admin/carreras.js
+++ b/backend/routes/admin/carreras.js
@@
-    const yaCobro = await BalanceTransaction.findOne({
-      type: "race_prize",
-      user: g.user,
-      "reference.id": c._id,
-    }).lean();
-    if (yaCobro) throw errorDe("ALREADY_CLAIMED");
-
-    await wallet.mover({
+    /*
+      LA MARCA VA ANTES Y CON LA CONDICION ADENTRO DEL FILTRO.
+
+      Preguntarle al libro "¿ya cobro?" y despues pagar deja la ventana
+      de siempre: dos clics leen los dos que no cobro y pagan los dos.
+      Se probo: 20 clics pagaron 20 veces el mismo premio.
+    */
+    const tomado = await Race.findOneAndUpdate(
+      { _id: c._id, estado: "settled",
+        ganadores: { $elemMatch: { user: g.user, pagadoEl: null } } },
+      { $set: { "ganadores.$.pagadoEl": new Date(), "ganadores.$.pagadoPor": req.user._id } },
+      { new: true }
+    ).lean();
+    if (!tomado) throw errorDe("ALREADY_CLAIMED");
+
+    await wallet.mover({
       userId: g.user,
       amountSc: premioSc,
       type: "race_prize",
       reference: { kind: "race", id: c._id, label: `${c.tipo} #${g.puesto}` },
     });
```

Hace falta agregar `pagadoEl` (y opcionalmente `pagadoPor`) al subdocumento
`ganadores` de `Race`, y que `races.cerrar()` lo complete cuando el pago sale
bien, para que el botón del panel solo sirva para los que quedaron en `null`.

### Cómo verificar

`poc-09-admin-carrera.js` tiene que dar `pagos en el libro: 1`.

---

## DINERO-04 · El canje manda SC como si fueran unidades de la moneda

- **Severidad:** Alta
- **Categoría:** Validación de montos / integridad contable
- **Archivos:** `C:\Users\Usuario\mrbox\backend\services\cashier\oxapay.js:109-124`
  y `C:\Users\Usuario\mrbox\backend\services\cashier\monedas.js:54-150`
- **Confianza:** Sospecha, **alta**. No se pudo cerrar sin la documentación de
  OxaPay (no se hicieron llamadas a dominios reales, como pide el encargo).
- **Esfuerzo del arreglo:** Medio

### Qué pasa

El pago sale así:

```js
// services/cashier/oxapay.js:109-124
async function pagar({ montoSc, ticker, red, direccion, referencia }) {
  const datos = await pedir("/payout", {
    address: direccion,
    currency: ticker,          // "BTC", "ETH", "SOL", "LTC", "DOGE"...
    network: red,
    amount: montoSc,           // ← SC, o sea DOLARES
    description: `MR BOX redemption ${referencia}`,
  }, claveDePagos(), "payout_api_key");
```

y el sitio ofrece monedas que **no valen un dólar**:
`BTC`, `ETH`, `SOL`, `LTC`, `TRX`, `BNB`, `DOGE`, `POL` (`monedas.js:68-150`).

Que las unidades son de la moneda y no dólares lo dice el propio proyecto:
`monedas.js:39` — *"`comision` es lo que cobra la cadena por sacar, en
unidades de esa moneda"* — y los valores lo confirman
(`BTC retiroMinimo: 0.000045`, `ETH retiroMinimo: 0.0001`).

**No hay conversión en ningún lado.** Un `grep` por cotización, tasa,
`price_amount`, `receive_amount` o cualquier equivalente no devuelve nada
fuera de `economia.precioDe()`, que es el precio de una caja y no tiene que
ver. Y `retiroMinimo` / `comision`, que están definidos por red, **no se usan
nunca**: `pedirCanje()` solo compara contra `Settings.canjeMinimoSc` (SC 50).

### Impacto concreto en plata

Si OxaPay interpreta `amount` en la moneda de `currency` —que es lo que la
dupla de campos y los propios mínimos de `monedas.js` indican—, un canje de
SC 100 en BTC pide un pago de **100 BTC**. En el mejor caso la pasarela lo
rechaza por fondos; en el peor sale.

Del lado del depósito pasa lo simétrico: el aviso acredita
`sc(Number(datos.amount))` como SC (`routes/wallet/index.js:369`) sin mirar
`datos.currency`. Un depósito de 0,001 BTC acreditaría SC 0,001.

Hoy esto no explotó solo porque la base local no tiene canjes pagados en
moneda no-estable.

### Qué falta para confirmarlo

Leer la documentación de `POST /v1/payout` de OxaPay (campo `amount`: ¿unidad
de `currency` o USD?) y de su callback de depósito (`amount` vs. el monto en
USD). Con eso se cierra en cinco minutos.

### Arreglo propuesto

Normalizar en los dos sentidos, en un solo lugar:

```diff
--- a/backend/services/cashier/oxapay.js
+++ b/backend/services/cashier/oxapay.js
@@
 async function pagar({ montoSc, ticker, red, direccion, referencia }) {
+  /*
+    EL MONTO VIAJA EN DOLARES, SIEMPRE.
+
+    `amount` sin decir en que esta es la forma mas cara de equivocarse:
+    SC 100 con `currency: "BTC"` es un pedido de 100 BTC. OxaPay acepta
+    el monto en USD si se le dice; si algun dia deja de hacerlo, acá hay
+    que poner la cotizacion y no en cada pantalla.
+  */
   const datos = await pedir("/payout", {
     address: direccion,
     currency: ticker,
     network: red,
-    amount: montoSc,
+    amount: sc(montoSc),
+    amount_currency: "USD",
     description: `MR BOX redemption ${referencia}`,
   }, claveDePagos(), "payout_api_key");
```

y, mientras no esté verificado, **cerrar el canje a las estables**:

```diff
--- a/backend/services/cashier/index.js
+++ b/backend/services/cashier/index.js
@@
   const par = buscar(ticker, red);
   if (!par) throw errorDe("NOT_FOUND", { ticker, red });
+
+  /* Hasta que el monto del pago este normalizado a USD, solo salen
+     monedas que valen un dolar: ver oxapay.pagar(). */
+  if (!["USDT", "USDC"].includes(par.moneda.ticker)) {
+    throw errorDe("NOT_FOUND", { ticker, motivo: "moneda no disponible para canje" });
+  }
```

Y usar `par.red.retiroMinimo` / `par.red.comision`, que hoy están escritos y
no los mira nadie.

### Cómo verificar

Un canje de SC 60 en BTC tiene que rebotar, y el cuerpo que se le manda a
`/payout` tiene que llevar el monto en dólares (se ve con un `logger.info` del
cuerpo en un entorno de prueba, o con la clave de sandbox de OxaPay).

---

## DINERO-05 · El límite diario de juego se esquiva con pedidos simultáneos

- **Severidad:** Alta (juego responsable; es un control que el jugador se puso)
- **Categoría:** Race condition / bypass de control
- **Archivo:** `C:\Users\Usuario\mrbox\backend\services\controls\index.js:114-144`
- **Confianza:** Confirmado con PoC
- **Esfuerzo del arreglo:** Medio

### Qué pasa

`revisarAntesDeJugar()` suma el libro y después deja jugar: entre la suma y el
cobro no hay nada que ate las dos cosas.

```js
// services/controls/index.js:127-136
const hoy = await loDeHoy(userId);          // agrega BalanceTransaction del dia
const monto = sc(montoSc);

if (topes.juegoDiarioSc != null && hoy.jugadoSc + monto > topes.juegoDiarioSc + 1e-9) {
  throw errorDe("DAILY_PLAY_LIMIT", { ... }, 403);
}
```

Veinte aperturas simultáneas leen el mismo total y pasan todas.

### Impacto

Tope diario de SC 10, caja de SC 1,12, 20 aperturas a la vez: **las 20 pasan,
SC 22,40 jugados**, 124% por encima del tope que el jugador se puso. Lo mismo
vale para `perdidaDiariaSc`. La pausa (`pausaHasta`) **sí** frena bien, porque
no depende de una suma (ver §"Lo que pasó").

### PoC

`...\scratchpad\poc-10-controles.js`

```
limite diario de juego SC 10, caja de SC 1.12
20 aperturas simultaneas -> aceptadas: 20 | jugado hoy segun el libro: SC 22.4
FALLA — jugo SC 22.4 con tope de 10
```

### Arreglo propuesto

Un contador del día en el documento del usuario, movido **con la condición
adentro del filtro en el mismo `findOneAndUpdate` que cobra**. El libro sigue
siendo la verdad para explicarlo; el contador solo sirve para decidir.

```diff
--- a/backend/services/wallet/index.js
+++ b/backend/services/wallet/index.js
@@
   if (monto < 0) filtro.balanceSc = { $gte: -monto };
+
+  /*
+    EL TOPE DIARIO SE DECIDE EN LA BASE, NO ANTES.
+
+    Sumar el libro y despues cobrar deja pasar veinte aperturas
+    simultaneas con el mismo total leido: se probo, SC 22,40 contra un
+    tope de SC 10. El contador del dia va en el mismo update que el
+    saldo, con el tope adentro del filtro.
+  */
+  if (juegaSc > 0 && topeDiarioSc != null) {
+    filtro.$expr = {
+      $lte: [
+        { $add: [
+          { $cond: [{ $eq: ["$jugadoHoy.dia", diaUTC()] }, "$jugadoHoy.sc", 0] },
+          sc(juegaSc),
+        ] },
+        topeDiarioSc,
+      ],
+    };
+    cambios.$set = { ...(cambios.$set || {}), "jugadoHoy.dia": diaUTC() };
+    cambios.$inc["jugadoHoy.sc"] = sc(juegaSc);   // se reinicia con el $set del dia
+  }
```

(Hace falta un pequeño ajuste: cuando cambia el día, el `$inc` tiene que
partir de cero; se resuelve con dos updates condicionados o con un
`$set` calculado por `$cond` en pipeline de update, que Mongo 5+ soporta.)

Mínimo aceptable si no se quiere tocar `wallet`: mover la revisión a
**dentro** del bucle de `boxes.abrir()`/`deals.jugar()` (hoy se hace una sola
vez por tanda) **y** serializar por jugador con un lock optimista
(`User.findOneAndUpdate({_id, jugando: false}, {$set:{jugando:true}})`).

### Cómo verificar

`poc-10-controles.js`: `jugado hoy` no puede pasar el tope.

---

## DINERO-06 · El promo de tipo `aperturas` ignora lo que dice el código

- **Severidad:** Media
- **Categoría:** Lógica de negocio / regalo de más
- **Archivos:** `C:\Users\Usuario\mrbox\backend\routes\wallet\index.js:267-269`
  y `C:\Users\Usuario\mrbox\backend\services\boxes\index.js:383-413`
- **Confianza:** Confirmado con PoC
- **Esfuerzo del arreglo:** Bajo

### Qué pasa

```js
// routes/wallet/index.js:267-269
if (codigo.tipo === "aperturas" && codigo.aperturas > 0) {
  await cajas.regalarCajasDeBienvenida(usuario._id);   // ← no recibe `codigo.aperturas`
}
```

y la función del otro lado:

```js
// services/boxes/index.js:391 y :407-410
const slugs = configuradas.slice(0, cfg.aperturasDeRegalo || 3);
...
await User.updateOne(
  { _id: userId },
  { $set: { cajasGratis: regalo, freeOpens: regalo.length } }   // ← $set, no $push
);
```

Dos cosas:

1. **El `aperturas` del código no se usa.** Un código que dice "1 apertura"
   entrega las que diga `Settings.aperturasDeRegalo` (3 de fábrica).
2. **`$set` pisa el arreglo entero.** Las cajas de bienvenida ya usadas vuelven
   a quedar sin usar, y las que el jugador todavía no abrió se pierden si la
   configuración cambió de cajas.

### Impacto

Una campaña que creía estar regalando una apertura regala tres. Con las cajas
de fábrica son SC 12,84 de aperturas por canje en vez de SC 2,37. Es una vez
por jugador y por código (el índice único de `PromoUse` sí funciona, probado),
pero multiplica por tres el costo de cada campaña de aperturas.

### PoC

`...\scratchpad\poc-11-varios.js`, bloque [D]:

```
[D] promo tipo 'aperturas' con aperturas=1, sobre una cuenta que YA gasto las de bienvenida
    respuesta: OK
    freeOpens despues: 3 | sin usar: 3 | aperturasDeRegalo cfg: 3
    FALLA — el codigo decia 1 y dio 3
```

### Arreglo propuesto

```diff
--- a/backend/services/boxes/index.js
+++ b/backend/services/boxes/index.js
@@
-async function regalarCajasDeBienvenida(userId) {
+/**
+ * @param {number} [cuantas] cuantas regalar. Sin esto, las que diga el panel.
+ */
+async function regalarCajasDeBienvenida(userId, cuantas = null) {
   const cfg = await Settings.leer();
   const configuradas = (cfg.cajasDeRegalo || []).length ? cfg.cajasDeRegalo : Settings.CAJAS_DE_REGALO;
 
-  const slugs = configuradas.slice(0, cfg.aperturasDeRegalo || 3);
+  const tope = Number.isFinite(Number(cuantas)) && Number(cuantas) > 0
+    ? Number(cuantas)
+    : (cfg.aperturasDeRegalo || 3);
+  const slugs = configuradas.slice(0, tope);
@@
-  await User.updateOne(
-    { _id: userId },
-    { $set: { cajasGratis: regalo, freeOpens: regalo.length } }
-  );
+  /*
+    SE AGREGAN, NO SE PISAN.
+
+    Con `$set` un codigo promocional de aperturas le devolvia la vida a
+    las cajas de bienvenida ya usadas y le borraba las que no abrio.
+  */
+  await User.updateOne(
+    { _id: userId },
+    { $push: { cajasGratis: { $each: regalo } }, $inc: { freeOpens: regalo.length } }
+  );
```

```diff
--- a/backend/routes/wallet/index.js
+++ b/backend/routes/wallet/index.js
@@
     if (codigo.tipo === "aperturas" && codigo.aperturas > 0) {
-      await cajas.regalarCajasDeBienvenida(usuario._id);
+      await cajas.regalarCajasDeBienvenida(usuario._id, codigo.aperturas);
     }
```

Ojo: el registro (`routes/auth/index.js`) sigue llamándola sin argumento, que
es lo correcto, pero habría que asegurarse de que ahí el usuario no tenga ya
cajas (si no, el `$push` duplicaría). Con `cajasGratis: []` recién creado no
pasa.

### Cómo verificar

`poc-11-varios.js` bloque [D]: `freeOpens despues: 1`, y las de bienvenida
usadas tienen que seguir usadas.

---

## DINERO-07 · `veces` fraccionario en Deals cobra más de lo que informa

- **Severidad:** Media
- **Categoría:** Validación de montos / contabilidad que no cierra
- **Archivo:** `C:\Users\Usuario\mrbox\backend\services\deals\index.js:190-192` y `:341`
- **Confianza:** Confirmado con PoC
- **Esfuerzo del arreglo:** Trivial

### Qué pasa

```js
// services/deals/index.js:190-192
const tope = Math.min(MAXIMO_DE_TIROS, cfg.cajasALaVez || MAXIMO_DE_TIROS);
if (Number(veces) > tope) throw errorDe("TOO_MANY_AT_ONCE", { maximo: tope });
const cuantos = Math.max(1, Math.min(Number(veces) || 1, tope));   // ← no redondea
...
// :238
for (let i = 0; i < cuantos; i += 1) { ... await wallet.mover({ amountSc: -apuestaSc ... }) }
...
// :341
gastadoSc: sc(apuestaSc * cuantos),      // ← usa 2.5, pero el bucle corrió 3 veces
```

Con `veces: 2.5` el bucle corre **3** veces (cobra 3 apuestas) pero
`gastadoSc` informa 2,5 apuestas.

### Impacto

```
veces=2.5 -> 3 tiros | dice gastadoSc=679.35 | cobro de verdad=815.22 | diferencia=135.87
veces=3.9 -> 4 tiros | dice gastadoSc=1059.79 | cobro de verdad=1086.96 | diferencia=27.17
```

El jugador ve que gastó SC 679,35 y el libro dice SC 815,22. Es a favor de la
casa, pero es contabilidad que no cierra en la respuesta y una queja de
soporte que nadie va a poder explicar. (En cajas el mismo `veces` fraccionario
cobra de más pero `gastadoSc` se calcula de `resultados`, así que ahí sí
coincide; el problema de cajas es DINERO-10.)

### PoC

`...\scratchpad\poc-06b-montos.js`, bloque "deals: lo que dice que cobro vs lo que cobro".

### Arreglo propuesto

```diff
--- a/backend/services/deals/index.js
+++ b/backend/services/deals/index.js
@@
-  const cuantos = Math.max(1, Math.min(Number(veces) || 1, tope));
+  /* Entero: con 2,5 el bucle corria tres veces y `gastadoSc` informaba
+     dos y medio. El jugador veia una cifra y el libro, otra. */
+  const cuantos = Math.max(1, Math.min(Math.floor(Number(veces) || 1), tope));
```

Lo mismo en `services/boxes/index.js:90`:

```diff
-  const cuantas = Math.max(1, Math.min(Number(veces) || 1, cfg.cajasALaVez || 4));
+  const cuantas = Math.max(1, Math.min(Math.floor(Number(veces) || 1), cfg.cajasALaVez || 4));
```

### Cómo verificar

`poc-06b-montos.js`: la columna `diferencia` tiene que ser 0 en todos los casos.

---

## DINERO-08 · El tope de 3 canjes pendientes se esquiva

- **Severidad:** Media
- **Categoría:** Race condition / bypass de control antifraude
- **Archivo:** `C:\Users\Usuario\mrbox\backend\services\cashier\index.js:165-169`
- **Confianza:** Confirmado con PoC
- **Esfuerzo del arreglo:** Bajo

### Qué pasa

```js
// services/cashier/index.js:165-169
const pendientes = await Redemption.countDocuments({
  user: user._id, estado: { $in: ["pending", "approved"] },
});
if (pendientes >= PEDIDOS_A_LA_VEZ) throw errorDe("TOO_MANY_THREADS", { pendientes });
```

Contar y después crear: veinte pedidos a la vez leen 0 y crean 20.

### Impacto

**No crea plata** —cada pedido descuenta el saldo correctamente, eso quedó
probado— pero rompe el freno que limita cuánto puede salir de una cuenta
antes de que alguien lo mire. Veinte pedidos de SC 60 en vez de tres. Es el
control que separa un retiro raro de veinte retiros raros simultáneos.

El `rateLimit` del router (`routes/wallet/index.js:36-42`, 20/min por IP) lo
tapa parcialmente, pero no es un control de negocio y cae con varias IP.

### PoC

`...\scratchpad\poc-03b-tope-pendientes.js` (llama al servicio para saltear el
rate limit, que es lo único que lo escondía):

```
20 pedidos de canje simultaneos, tope declarado = 3
aceptados: 20 | pendientes en base: 20 | saldo: 98800
FALLA — 20 pendientes contra un tope de 3
```

### Arreglo propuesto

Un contador de pendientes en el usuario, movido con la condición adentro del
filtro, y devuelto al resolver el canje:

```diff
--- a/backend/services/cashier/index.js
+++ b/backend/services/cashier/index.js
@@
-  const pendientes = await Redemption.countDocuments({
-    user: user._id,
-    estado: { $in: ["pending", "approved"] },
-  });
-  if (pendientes >= PEDIDOS_A_LA_VEZ) throw errorDe("TOO_MANY_THREADS", { pendientes });
+  /*
+    EL TOPE LO DECIDE LA BASE.
+
+    Contar y despues crear deja pasar veinte pedidos simultaneos: se
+    probo. El contador sube con la condicion adentro del filtro y baja
+    cuando el canje se resuelve (pagado o rechazado).
+  */
+  const tomado = await User.findOneAndUpdate(
+    { _id: user._id, canjesPendientes: { $lt: PEDIDOS_A_LA_VEZ } },
+    { $inc: { canjesPendientes: 1 } },
+    { new: true }
+  ).select("canjesPendientes").lean();
+  if (!tomado) throw errorDe("TOO_MANY_THREADS", { pendientes: PEDIDOS_A_LA_VEZ });
```

con el `$inc: { canjesPendientes: -1 }` en `cancelar()` y en las ramas
`reject`/`pay` de `resolver()`, y en el `catch` que borra el pedido cuando no
se pudo descontar el saldo.

### Cómo verificar

`poc-03b-tope-pendientes.js` tiene que dar `pendientes en base: 3`.

---

## DINERO-09 · La cuenta en pausa sigue canjeando códigos promocionales

- **Severidad:** Media (juego responsable)
- **Categoría:** Lógica de negocio
- **Archivo:** `C:\Users\Usuario\mrbox\backend\routes\wallet\index.js:234-285` (no llama a `controles`)
- **Confianza:** Confirmado con PoC
- **Esfuerzo del arreglo:** Trivial

### Qué pasa

`controles.revisarAntesDeJugar()` se llama solo desde `boxes.abrir()` y
`deals.jugar()`. El diseño está escrito y es defendible
(`services/controls/index.js:17-22`: *"Lo que se bloquea es JUGAR, no la
cuenta"*), y por eso vender, enviar y canjear siguen abiertos —un jugador en
pausa tiene que poder sacar lo suyo—.

Pero **canjear un código promocional no es sacar lo suyo: es recibir un
incentivo nuevo**. Hoy una cuenta autoexcluida 30 días puede escribir un
código de campaña y acreditarse saldo o aperturas gratis.

### Medición

```
[PoC 10] cuenta EN PAUSA 30 dias — que deja pasar el servidor:
   abrir caja            -> frenado: ON_A_BREAK
   deals /play           -> frenado: ON_A_BREAK
   vender item           -> PASA IGUAL (!!)      ← correcto por diseño
   pedir envio           -> PASA IGUAL (!!)      ← correcto por diseño
   pedir canje           -> PASA IGUAL (!!)      ← correcto por diseño
   canjear promo         -> PASA IGUAL (!!)      ← esto no
   cobrar rakeback       -> frenado: RANK_TOO_LOW
```

(El rakeback quedó sin medir: la cuenta de prueba era Bronze. Por código,
`vip.cobrarRakeback()` tampoco mira la pausa, así que también entra.)

### Arreglo propuesto

```diff
--- a/backend/routes/wallet/index.js
+++ b/backend/routes/wallet/index.js
@@ async function canjearPromo(usuario, codigo) {
   if (usuario.trabas && usuario.trabas.promos) throw errorDe("PROMOS_LOCKED", {}, 403);
+
+  /*
+    EN PAUSA NO ENTRAN PROMOCIONES.
+
+    Vender, enviar y canjear siguen abiertos a proposito --lo suyo es
+    suyo-- pero un codigo de campaña no es sacar lo propio: es un
+    incentivo nuevo para alguien que pidio no recibirlos.
+  */
+  const l = (usuario.limites || {});
+  if (l.pausaHasta && new Date(l.pausaHasta) > new Date()) {
+    throw errorDe("ON_A_BREAK", { hasta: l.pausaHasta }, 403);
+  }
```

y lo mismo al principio de `vip.cobrarRakeback()`.

### Cómo verificar

`poc-10-controles.js`: `canjear promo -> frenado: ON_A_BREAK`.

---

## DINERO-10 · `veces` fraccionario rompe el contador de aperturas

- **Severidad:** Baja
- **Categoría:** Integridad de datos
- **Archivo:** `C:\Users\Usuario\mrbox\backend\services\boxes\index.js:90` y `:322`
- **Confianza:** Confirmado con PoC
- **Esfuerzo:** Trivial (lo arregla el mismo diff de DINERO-07)

```js
// :90
const cuantas = Math.max(1, Math.min(Number(veces) || 1, cfg.cajasALaVez || 4));
// :322
await Box.updateOne({ _id: caja._id }, { $inc: { opens: cuantas } });
```

Medido: `POST /api/boxes/wtf/open {veces: 2.7}` → 3 aperturas cobradas
correctamente, y `Box.opens` pasó de **57 a 59,7**. El contador de aperturas
es público (sale en `resumenDeCaja`) y ordena la grilla "popular".

PoC: `...\scratchpad\poc-06b-montos.js`, último bloque.

Lo arregla el `Math.floor` de DINERO-07.

---

## DINERO-11 · El aviso de depósito no tiene tope de monto

- **Severidad:** Baja
- **Categoría:** Validación de montos
- **Archivos:** `C:\Users\Usuario\mrbox\backend\routes\wallet\index.js:369-370`
  y `C:\Users\Usuario\mrbox\backend\utils\money.js:38-42`
- **Confianza:** Confirmado con PoC

```js
// routes/wallet/index.js:369-370
const monto = sc(Number(datos.amount) || 0);
if (!userId || monto <= 0 || !trackId) return res.json({ success: true, ignorado: "incompleto" });
```

Hay piso (`> 0`) pero **no hay techo**. Con un aviso firmado de
`amount: 1e21` el saldo quedó en `1.0000000000009998e+21`: `sc()` hace
`Math.round(n * 100) / 100` y arriba de `2^53` eso deja de ser exacto
(`money.js:38-42`), así que el saldo guardado ni siquiera es el número que
entró.

La firma HMAC-SHA512 funciona bien (`oxapay.js:136-151`, `timingSafeEqual`,
probado: firma inválida → 401 y saldo 0), así que esto no es explotable por un
jugador. Es una red para un error de la pasarela o una clave filtrada.

PoC: `...\scratchpad\poc-12-deposito-creador.js`, bloque [A2].

```diff
--- a/backend/routes/wallet/index.js
+++ b/backend/routes/wallet/index.js
@@
+/* Nadie deposita un millon de dolares de una. Un aviso por encima de
+   esto es un error de la pasarela o una clave filtrada, y acreditarlo
+   es peor que perderlo: queda anotado y lo mira una persona. */
+const DEPOSITO_MAXIMO_SC = 1000000;
@@
-    if (!userId || monto <= 0 || !trackId) return res.json({ success: true, ignorado: "incompleto" });
+    if (!userId || monto <= 0 || !trackId) return res.json({ success: true, ignorado: "incompleto" });
+    if (monto > DEPOSITO_MAXIMO_SC) {
+      logger.error(`[oxapay] aviso por SC ${monto}, por encima del tope. No se acredita: ${trackId}`);
+      return res.json({ success: true, ignorado: "monto fuera de rango" });
+    }
```

Y en `money.js`, que `sc()` avise en vez de devolver basura en silencio:

```diff
 function sc(valor) {
   const n = Number(valor);
   if (!Number.isFinite(n)) return 0;
+  /* Arriba de esto el redondeo por enteros deja de ser exacto. */
+  if (Math.abs(n) > Number.MAX_SAFE_INTEGER / CENTAVOS) {
+    throw new RangeError(`sc(): monto fuera de rango (${n})`);
+  }
   return Math.round(n * CENTAVOS) / CENTAVOS;
 }
```

---

## DINERO-12 · `sc()` redondea a la mitad para arriba, también al canjear

- **Severidad:** Info
- **Archivo:** `C:\Users\Usuario\mrbox\backend\utils\money.js:38-42`
- **Confianza:** Confirmado

`sc()` usa `Math.round`, que redondea el medio centavo **hacia arriba**. En las
cajas y en Deals eso está decidido a propósito y va a favor de la casa
(`deals/index.js:113-118` usa `Math.ceil` explícitamente). En el canje va al
revés:

```
50.005 -> ACEPTADO montoSc=50.01   (medio centavo a favor del jugador)
49.995 -> ACEPTADO montoSc=50      (pasa el minimo de SC 50 sin llegar)
```

Medio centavo por canje no es un problema de plata. Se anota porque el único
lugar del código donde el redondeo no está documentado en qué dirección va es
este, y porque deja que un monto por debajo del mínimo lo alcance redondeando.

Si se quiere cerrar: `Math.floor(n * 100) / 100` en el camino de salida de
plata (canje, pago al socio, pago al creador), dejando `Math.round` para todo
lo demás. PoC: `...\scratchpad\poc-06b-montos.js`, primer bloque.

---

## DINERO-13 · El saldo no se reconstruye desde cero

- **Severidad:** Info
- **Archivo:** `C:\Users\Usuario\mrbox\backend\scripts\sembrar.js:163`
- **Confianza:** Confirmado

**La buena noticia primero:** en una cuenta que solo pasó por la API, el libro
cierra perfecto incluso bajo concurrencia fuerte. Medido sobre 111 filas con
40 aperturas y 30 ventas simultáneas:

```
suma del libro: 961.47 | saldo real: 961.47 | diferencia: 0
filas con before+monto != after: 0        → cada fila es exacta
```

El `new: false` de `wallet.mover()` hace su trabajo: cada fila guarda el
`balanceBefore` real del momento del `$inc`.

**La mala:** barriendo los 64 usuarios de `mrbox_local`, 7 no cierran. El
motivo no es ningún camino de código —el `grep` de `balanceSc` confirma que
**nada fuera de `services/wallet` escribe el saldo**— sino que:

1. `scripts/sembrar.js:163` escribe `balanceSc` directo al crear las cuentas
   de prueba, sin una fila de apertura;
2. alguien editó saldos a mano en la base de desarrollo (se ve en `funkmaster`:
   una fila termina en 534,47 y la siguiente arranca en 412,50).

Como el libro no tiene un asiento de *saldo inicial*, cualquier cuenta
sembrada o migrada es irreconstruible desde cero para siempre. Antes de que
esto llegue a producción conviene que el seed y cualquier migración entren por
`wallet.mover({ type: "manual", reason: "saldo inicial" })`, que ya existe y
hace exactamente eso.

También hay **29 "saltos"** en la cadena `balanceAfter → balanceBefore` de la
cuenta concurrente: no son un error de plata (la suma cierra), son el reflejo
de que la fila se inserta **después** del `$inc` y dos pedidos simultáneos
pueden insertarlas en orden distinto al que movieron el saldo. Si el extracto
del jugador se lee como una cadena, va a verse raro. Ordenar el extracto por
`balanceAfter` no sirve; lo que sirve es guardar un número de secuencia por
usuario, o aceptar que la cadena solo es contigua en serie y documentarlo.

PoC: `...\scratchpad\poc-13-reconstruir.js` y `...\scratchpad\poc-07-ledger.js`.

---

# Lo que pasó: operaciones bien protegidas

Todo esto se probó y **aguantó**. Vale la pena decirlo explícitamente porque
es la parte del proyecto donde el patrón está bien aplicado.

| Operación | Prueba | Resultado |
|---|---|---|
| **Vender un item** (`boxes.vender`, `index.js:504-508`) | 30 ventas simultáneas del mismo objeto de SC 198,80 | 1 aceptada, 1 fila `item_sold`, saldo SC 198,80. **PASA** |
| **Vender + enviar a la vez** | 50 rondas, venta y envío del mismo objeto en paralelo | 0 rondas con las dos OK. **PASA** (el problema está en dos *envíos* solapados: DINERO-02) |
| **Vender muchos** (`routes/inventory:121-148`) | el mismo id 200 veces en el array | vendidos: 1, saldo SC 300. **PASA**. Con ids basura (`{$ne:null}`, `null`, `1`) cada uno falla por separado y no se cobra nada |
| **Abrir caja, cobro** (`wallet.mover` con `balanceSc: {$gte}` en el filtro) | saldo para 1, 30 aperturas simultáneas | 1 aceptada, saldo 0, **nunca negativo**. **PASA** |
| **Caja gratis** (`gastarAperturaGratis`, `$elemMatch` en el filtro) | 1 gratis, 20 aperturas simultáneas | se consumió **una sola vez**, `freeOpens` nunca bajó de 0. **PASA** (el agujero es lo que viene *después* de consumirla: DINERO-01) |
| **Pedir canje** (`cashier.pedirCanje` + `soloCanjeable`) | saldo 100, 20 retiros de SC 60 a la vez | 1 aceptado, saldo 40. **PASA** |
| **Bono sin jugar** (`$expr` de `wallet.mover`, `index.js:122-130`) | saldo 200 con `bonoPendienteSc` 150, 10 retiros de SC 55 | **0 aceptados**, bono intacto. **PASA** — el arreglo previo está bien hecho |
| **Cancelar canje** (`cashier.cancelar`, estado en el filtro) | 20 cancelaciones del mismo retiro de SC 200 | 1 aceptada, 1 devolución, saldo exacto 500. **PASA** |
| **Rechazar / aprobar / pagar canje** (`cashier.resolver:328-388`) | revisión de código | los tres usan `findOneAndUpdate` con el estado en el filtro. **CORRECTO** |
| **Rakeback** (`vip.cobrarRakeback` + índice único) | 20 cobros simultáneos del mismo periodo | 1 cobro de SC 120. **PASA** |
| **Código promocional** (`PromoUse`, índice `{code,user}`) | 15 canjes simultáneos de un código de SC 25 | 1 aceptado, saldo exacto 25. **PASA** |
| **Desafíos** (`challenges.revisar`, cupo en el filtro + `ChallengeWin` único) | 1 cupo, 20 jugadores pegándole a la vez | 1 ganador, 1 pago, `cuposUsados: 1`. **PASA** |
| **Cierre de carrera** (`races.cerrar`, `estado:"live"` en el filtro) | 20 cierres simultáneos de la misma carrera | 1 pago de SC 300. **PASA** (el agujero es el botón *pagar* del panel: DINERO-03) |
| **Aviso de OxaPay** (`DepositoAvisado`, `trackId` único antes de acreditar) | el mismo `track_id` 20 veces a la vez, SC 500 | 1 acreditación, 1 fila `purchase`, saldo 500. **PASA** — el arreglo previo está bien hecho |
| **Firma del aviso** (`oxapay.avisoEsDeOxaPay`) | aviso con firma inválida | **401**, saldo 0. **PASA** |
| **Comisión del creador** (`community.pagarAlCreador`, `margenPendienteSc`) | 20 aperturas simultáneas de una caja de comunidad | entró 22,40 / salió 20,35 / margen 2,05; pagado al creador 2,53 y `margenPendienteSc: -3,02`. **La cuenta cierra exacto** (2,05 − 5,06 consumidos = −3,01): el arreglo previo **no se double-cuenta**. Ver la nota de abajo |
| **Comisión del socio** (`affiliates.anotarComision`, mismo patrón) | revisión de código, `index.js:325-342` | mismo `$inc` + consumo condicionado. **CORRECTO** |
| **Cobrar como socio** (`affiliates.cobrar:629-634`) | revisión de código | compare-and-set sobre `cobradoSc`, con rollback si falla el `mover`. **CORRECTO** |
| **Pausa / autoexclusión** sobre el juego | abrir caja y Deals con la cuenta en pausa 30 días | las dos `ON_A_BREAK`. **PASA** |
| **KYC del canje** (`Settings.canjeNivelMinimo = 2`) | retiro con nivel 0, 1, 2, 3 | 0 y 1 rebotan con `VERIFICATION_LEVEL_TOO_LOW`; 2 y 3 pasan. **PASA, validado en el servidor** |
| **KYC del envío** (`Settings.envioNivelMinimo = 3` + tope SC 1.000) | envío con nivel 0/2/3 y objetos de SC 100 y SC 5.000 | solo nivel 3 pasa, en los dos valores. **PASA, validado en el servidor** |
| **Montos del canje** | negativos, 0, `NaN`, `null`, `"abc"`, `{"$gt":0}`, `Infinity`, `1e21` | todos rechazados con `INVALID_AMOUNT` o `NOT_ENOUGH_COINS`. **PASA** |
| **Chance de Deals** | −0,5, 0, 1, 100, `NaN`, `{"$gt":0}`, `"5e-1"` | todos acotados o rechazados; nunca por encima del 80%. **PASA** |

**Nota sobre la comisión del creador.** El acumulado se paga *entero* cada vez
que queda en verde, así que el creador puede estar pagado por encima del
margen realizado en cualquier momento (en la prueba: SC 2,53 cobrados contra
SC 2,05 de margen, con SC −3,02 de deuda parqueada en `Box.margenPendienteSc`).
A la larga converge, y eso es lo que el arreglo buscaba. Pero **la deuda vive
en el documento de la caja**: si la caja se borra, se despublica o el creador
deja de tener aperturas, ese saldo negativo nunca se recupera y la diferencia
ya está en el saldo canjeable del creador. No es un bug abierto —es una
decisión— pero conviene que esté escrita.

---

# Reglas del pliego que NO existen en este proyecto

Se buscaron y **no están**; no hay que reportarlas como rotas porque nunca se
implementaron, pero conviene saber que faltan si el pliego las pide:

- **Compra mínima de $15** — no existe. `GET /api/wallet/coins` informa
  `minimoDepositoSc: 10` **escrito a mano en el código**
  (`routes/wallet/index.js:52`), pero el aviso de depósito acredita cualquier
  monto > 0: ese 10 es un cartel, no una regla.
- **Límite diario de retiro de $9.000** — no existe. Lo único que hay es
  `canjeMinimoSc` (SC 50) y el tope de 3 pendientes (que además se esquiva,
  DINERO-08).
- **Redeem mínimo de 100 SC** — no existe; el mínimo configurado es **50**
  (`Settings.canjeMinimoSc`, `Settings.js:246`).
- **3 cajas gratis con la primera compra de $50** — no existe. Las 3 cajas son
  de **registro**, no de compra (`routes/auth/index.js`, `regalarCajasDeBienvenida`),
  y no hay ninguna condición de depósito.
- **Tope de valor por envío** — existe pero **no es un tope**: `User.puedeEnviar`
  (`User.js:247-255`) no limita el valor, solo exige nivel 3 por encima de
  `envioQuePideNivel3Sc` (SC 1.000). Con nivel 3 se envía cualquier valor.
- **Segunda firma para el ajuste manual de saldo** — no existe (ya reportado).

---

# Prioridad sugerida

1. **DINERO-01** — es creación de dinero canjeable por cualquier cuenta nueva.
   Hasta que esté arreglado, un paliativo de una línea: no dar cajas de regalo
   caras, y poner `vecesAJugarElBono` sobre el crédito de la gratis para que
   al menos no sea canjeable al instante.
2. **DINERO-02** — mercadería real regalada.
3. **DINERO-04** — si la sospecha se confirma, el primer canje en BTC es un
   incidente. Cerrar el canje a USDT/USDC es un diff de tres líneas y cuesta
   poco mientras se verifica.
4. **DINERO-03** y **DINERO-05**.
5. El resto.
