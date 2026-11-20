# MR BOX — Auditoría de seguridad y funcionamiento

19 de noviembre de 2026. Rama `main`, commit `8d47dde`.
Todo el trabajo fue **de solo lectura sobre el código**: no se modificó ni un
archivo del proyecto, no se hicieron commits, no se tocó producción, no se
ejecutó ningún pago real. Las pruebas corrieron contra `localhost` y la base de
desarrollo `mrbox_local`.

Seis auditorías en paralelo (autenticación y autorización, integridad del
dinero, sorteo verificable, pagos e infraestructura, inyecciones, y abuso de
negocio y cumplimiento) más un recorrido funcional propio.

---

## Resumen para el dueño

En criollo: **el sitio no está listo para recibir plata de verdad, pero no por
estar mal hecho.** La base es buena —mejor que la mayoría de lo que se ve— y
los problemas se concentran en seis lugares puntuales. Son arreglables.

Lo que hay que entender, sin vueltas:

**1. Cualquiera que se registre hoy puede fabricar plata retirable, sin
depositar un peso.** Las tres cajas de regalo de bienvenida se cobran en dos
pasos: primero el sitio te acredita el precio de la caja y después te lo cobra.
Si abrís las tres casi al mismo tiempo, un cobro falla y el crédito queda. Lo
probé: una cuenta nueva terminó con **SC 7,46 retirables de la nada**. No hace
falta ser hacker, hace falta tener tres pestañas abiertas. Y esto lo introduje
yo en el cambio de hace unos días para que las aperturas gratis dejaran rastro
en el libro. Es el arreglo número uno.

**2. El canje manda el número de SC como si fueran unidades de la moneda.**
Un retiro de SC 50 en Bitcoin le pide a OxaPay que mande **50 BTC**. No hay
ninguna conversión de SC a cripto en ningún lado del código: lo verifiqué
buscando en todo el proyecto. Hoy lo único que lo frena es que la cuenta de
OxaPay no tenga ese saldo. Lo mismo al revés en los depósitos: si alguien manda
1.000 DOGE (unos 180 dólares), se le acreditan **SC 1.000**.

**3. Las cinco páginas legales no existen.** Términos, reglas del sorteo, juego
responsable, privacidad y aceptación de clientes están enlazadas en el pie de
todas las pantallas, y las cinco te mandan al catálogo de cajas. El pie además
dice que los premios se canjean "según las reglas oficiales" — reglas que no
están publicadas en ningún lado. Esto es lo que hace que una pasarela de pago te
cierre la cuenta.

**4. No se pregunta la edad ni de qué estado es el jugador.** Para un
sweepstakes en Estados Unidos las dos cosas son requisito legal.

**5. Las carreras regalan el pozo.** No hay mínimo de participantes ni de
volumen jugado. Diez cuentas nuevas, usando solo las cajas de regalo, se llevan
los pozos diario, semanal y mensual con costo propio cero.

**6. El aviso de pago de OxaPay se puede estar rechazando entero.** La firma se
verifica contra una reconstrucción del mensaje, no contra lo que llegó. Si
OxaPay manda el JSON con un formato apenas distinto, **ningún depósito se
acredita nunca**. Hoy puede estar andando de casualidad.

Lo bueno, que es mucho y conviene decirlo: la contabilidad está bien hecha
(todo movimiento deja asiento y el saldo cierra), el sorteo cobra antes de
sortear, el panel de administración rechaza correctamente a un usuario normal en
las 76 rutas, no hay inyección de SQL/NoSQL explotable, no hay XSS, no hay SSRF,
no se filtró ningún secreto en el historial de git, y el arreglo de comisiones
que hicimos antes resiste 20 aperturas simultáneas sin descuadrar un centavo.

**Plan para 24-48 horas**, en este orden: arreglar la apertura gratis (1-2 h),
cerrar el canje a monedas estables hasta resolver la conversión (15 min),
publicar las cinco páginas legales con las reglas del sorteo (1 día, es
redacción más que código), pedir fecha de nacimiento y estado en el registro
(2 h), poner piso de participación en las carreras (1 h), y sacar `/api/hooks`
del parser de JSON global (5 min).

---

## Alcance: qué del pliego aplica y qué no

El pliego describe una plataforma con dos monedas (GC/SC), slots, dice, crash,
mines, plinko, towers, coinflip, battles, chat con rain, propinas entre
jugadores, PayPal, WebAuthn, Redis y docker-compose. **Nada de eso existe en
MR BOX** — viene de BetSweeps. Se auditó lo que hay de verdad (ver
[`00-mapa.md`](00-mapa.md)).

| Sección del pliego | Estado |
|---|---|
| 3.7 Sockets y tiempo real | **N/A** — no hay socket.io ni carpeta `sockets/` |
| 3.4 dice / crash / slide / keno / mines / plinko / towers / coinflip / battles / slots | **N/A** — no existen; hay cajas y Deals |
| 3.3 moneda: GC vs SC | **N/A** — una sola moneda |
| 3.5 PayPal, wallet seamless de slots | **N/A** — solo OxaPay |
| 3.1 WebAuthn/fido2, Google OAuth | **N/A** — no implementados (los botones devuelven "pendiente") |
| 3.8 docker-compose, Redis, puertos 27017/6379 | **N/A** — no hay docker ni Redis |
| 3.9 chat, rain, tips, lavado por transferencia | **N/A** — no hay transferencia directa entre cuentas |
| 3.6 exportaciones CSV/Excel del panel | **N/A** — no existe ninguna exportación |
| 2. EUPay | **N/A** — búsqueda exhaustiva: no existe ninguna integración EUPay en el repo |
| Todo lo demás | auditado |

---

## Tabla de hallazgos

83 hallazgos. Severidad: **C**rítica, **A**lta, **M**edia, **B**aja, **I**nfo.
Confianza: **✓** confirmado con código y/o prueba reproducible, **?** sospecha.

### Críticos

| ID | Título | Archivo:línea | Conf. | Esfuerzo |
|---|---|---|---|---|
| DINERO-01 | La apertura gratis crea SC canjeable de la nada | `services/boxes/index.js:155-179` | ✓ | chico |
| PAGO-01 | El canje manda SC como unidades de la cripto (SC 50 → 50 BTC) | `services/cashier/oxapay.js:109-124` | ✓ | medio |
| PAGO-02 | El depósito acredita `amount` 1:1 como SC sin mirar `currency` | `routes/wallet/index.js:368` | ✓ | medio |
| ABUSO-01 | Las carreras pagan el pozo sin piso de participación ni de volumen | `services/races/index.js:53,108,205` | ✓ | chico |
| JRG-02 | Sin verificación de edad ni geobloqueo en el registro | `routes/auth/index.js:108-190` | ✓ | medio |
| COPY-01 | Las cinco páginas legales no existen; el pie enlaza al vacío | `components/MbPie.vue:82-86`, `router/index.js:239` | ✓ | medio |

### Altos

| ID | Título | Archivo:línea | Conf. | Esfuerzo |
|---|---|---|---|---|
| FAIR-01 | El flag `shippable` no llega al inventario: los vales se pueden despachar | `services/boxes/index.js:204-213` | ✓ | trivial |
| DINERO-02 | Dos envíos solapados: el objeto se vende Y se despacha | `services/shipping/index.js:108-149` | ✓ | chico |
| DINERO-03 | `/admin/races/:id/pay/:userId` paga una vez por clic | `routes/admin/carreras.js:160-172` | ✓ | trivial |
| DINERO-05 | El límite diario que se pone el jugador se esquiva | `services/controls/index.js:127-136` | ✓ | chico |
| HOOK-01 | La firma del aviso se verifica sobre el JSON reserializado | `index.js:95-101` + `routes/wallet/index.js:353` | ✓ | trivial |
| PAGO-05 | Un depósito que falla al acreditar queda trabado para siempre | `routes/wallet/index.js:383-420` | ✓ | chico |
| AUTH-01 | El límite de intentos se saltea con `X-Forwarded-For` | `index.js:36`, `routes/auth/index.js:43` | ✓ | chico |
| INFRA-01 | CORS en comodín si falta `SITIO_URL` (falla abierto) | `index.js:50-55` | ✓ | trivial |
| QA-01 | La cinta de Live Pulls ordena en memoria, polleada cada 1,5 s | `routes/boxes/index.js:368` | ✓ | trivial |
| ABUSO-02 | Auto-referido con segunda cuenta + bono de compra repetible | `services/affiliates/index.js:249-250` | ✓ | medio |
| ABUSO-03 | Regalo de bienvenida sin verificación de correo: SC 7,61/cuenta | `services/boxes/index.js:383-408` | ✓ | medio |
| ABUSO-04 | Las cajas de la comunidad transfieren valor entre cuentas | `services/community/index.js:314-370` | ✓ | medio |
| JRG-01 | La pausa no frena promos, rakeback ni la acreditación de compras | `services/controls/index.js:114-150` | ✓ | chico |
| COPY-02 | Palabras prohibidas en el copy de jugador, en los 9 idiomas | `scripts/traducir.py` | ✓ | medio |
| COPY-04 | Se afirma "No purchase necessary" y no existe el AMOE | `foot.legal3` + FAQ VIP | ✓ | medio |

### Medios

| ID | Título | Archivo:línea | Conf. |
|---|---|---|---|
| FAIR-02 | Se cambian las chances de una caja en vivo y el registro no guarda cuáles eran | `routes/admin/index.js:465-521` | ✓ |
| FAIR-03 | `/boxes/:slug/demo` ignora `live`: expone la tabla de una caja apagada | `services/boxes/index.js:88` | ✓ |
| FAIR-04 | `GET /deals/verify/:id` es público y sin dueño: expone apuestas ajenas | `routes/deals/index.js:195` | ✓ |
| FAIR-05 | Rotar la semilla en paralelo da 500 y deja tandas huérfanas | `services/boxes/index.js:603-636` | ✓ |
| FAIR-07 | Una tanda x4 sin saldo cobra las primeras y el jugador no ve lo que ganó | `services/boxes/index.js:125-128` | ✓ |
| HOOK-02 | El aviso de pago no tiene techo de monto (hay SC 1e21 en el libro) | `routes/wallet/index.js:368` | ✓ |
| DINERO-06 | El promo "aperturas" ignora la cantidad y regala las 3 de bienvenida | `routes/wallet/index.js:267-269` | ✓ |
| DINERO-07 | `veces` fraccionario en Deals cobra más de lo que informa | `services/deals/index.js:192` | ✓ |
| DINERO-08 | El tope de 3 canjes pendientes se esquiva en paralelo | `services/cashier/index.js:165-169` | ✓ |
| DINERO-09 | La cuenta en pausa sigue canjeando códigos promocionales | `routes/wallet/index.js:292` | ✓ |
| PAGO-04 | La URL del callback documentada no es la real | `.env.example:46`, `docs/HUECOS.md:43` | ✓ |
| PAGO-06 | Sin doble firma: el mismo admin aprueba y paga un canje | `services/cashier/index.js:355-388` | ✓ |
| PAGO-07 | La dirección de pago se valida solo por largo y espacios | `services/cashier/index.js:157-163` | ✓ |
| INFRA-03 | CSP apagado y sin `Permissions-Policy` | `index.js:82` | ✓ |
| AUTH-02 | El registro dice cuál email y cuál usuario ya existen | `routes/auth/index.js:134-135` | ✓ |
| AUTH-03 | No hay cambio de contraseña, ni reset, ni verificación de email | `routes/auth/` | ✓ |
| AUTH-04 | Sin granularidad de roles: `support` no concede nada | `middleware/auth.js:64` | ✓ |
| AUTH-05 | Cuerpos de 12 MB parseados sin sesión y sin freno | `index.js:93-100` | ✓ |
| AUTH-06 | Un login cuesta ~800 ms de CPU del único hilo de Node | `routes/auth/index.js:249-250` | ✓ |
| INY-01 | `POST /community/quote` acepta 12 MB sin sesión y sin freno | `routes/community/index.js:223` | ✓ |
| ABUSO-05 | El panel Risk: una señal cuenta doble y no ve los patrones reales | `routes/admin/extra.js:176-280` | ✓ |
| ABUSO-06 | `usosMaximos` de los códigos promocionales no es atómico | `routes/wallet/index.js:237,276` | ✓ |
| ABUSO-08 | `/deals/play` sin límite de pedidos; `/deals/demo` sin sesión | `routes/deals/index.js:121,136` | ✓ |
| ABUSO-09 | `/community` con cuerpo de 12 MB y cuentas gratis sin verificar | `routes/community/index.js` | ✓ |
| REGLA-01 | El bono por depósito que se anuncia no es el que se acredita | `routes/wallet/index.js:54` | ✓ |
| REGLA-02 | `retornoObjetivo` y `topePremioSc` son editables y no se leen | `services/community/index.js:232` | ✓ |
| REGLA-04 | El rango VIP puesto a mano no cuenta para el rakeback | `services/vip/index.js:223,282` | ✓ |
| COPY-03 | `aria-label="Deposit"` en duro, fuera de `$t()` | `components/MbCabecera.vue:95` | ✓ |
| JRG-03 | Sin límite de compra; los límites son solo diarios | `services/controls/index.js:40-50` | ✓ |

### Bajos e Info

| ID | Título | Conf. |
|---|---|---|
| DINERO-10 | `Box.opens` queda fraccionario con `veces` decimal | ✓ |
| DINERO-11 | `sc()` pierde precisión por encima de 2^53/100 | ✓ |
| DINERO-12 | `sc()` redondea el medio centavo para arriba también al canjear | ✓ |
| DINERO-13 | El saldo no se reconstruye en 7 cuentas sembradas a mano | ✓ |
| AUTH-07 | `/deals/verify/:id` devuelve el recibo de cualquiera | ✓ |
| AUTH-08 | `JWT_SECRET` no se comprueba al arrancar (falla cerrado) | ✓ |
| AUTH-09 | Contraseña de `owner` fija en `scripts/sembrar.js` | ✓ |
| AUTH-10 | `COSAS[req.params.cosa]` sin `hasOwnProperty` | ✓ |
| INY-02 | Dos listas del panel sin tope de `perPage` | ✓ |
| INY-03 | Open redirect por el `destino` de banners y promociones | ✓ |
| INY-04 | Lookups con clave heredada → 500 público (`?sort=constructor`) | ✓ |
| INY-05 | Operadores de Mongo en ids del cuerpo (no cruza cuentas) | ✓ |
| INY-06 | Cuerpo excedido y JSON malo dan 500 en vez de 413/400 | ✓ |
| INY-07 | KYC: se cree el tipo declarado, no se miran los bytes | ✓ |
| INY-08 | No se limpia el EXIF de las fotos de KYC | ✓ |
| INY-09/10/11 | Robustez menor (idiomas, `portadaLimpia`, query duplicada) | ✓ |
| INFRA-04 | El 404 refleja la ruta pedida | ✓ |
| INFRA-05 | Falta `hpp` (impacto chico en Express 5) | ✓ |
| PAGO-08 | `OXAPAY_CALLBACK_SECRET` vacío cae a la clave de comercio | ✓ |
| SEC-01 | Claves reales de OxaPay en el `.env` de desarrollo | ✓ |
| SEC-02 | `backend/scripts/tmp/inv.js` quedó en el historial (sin secretos) | ✓ |
| ABUSO-07 | El promo "aperturas" entrega SC 7,61 en vez de lo configurado | ✓ |
| ABUSO-10 | `/wallet/code` es un oráculo de enumeración de códigos | ✓ |
| REGLA-03 | Cinco perillas de Deals editables y muertas | ✓ |
| COPY-05 | `create.namePlaceholder` sin traducir en los 9 idiomas | ✓ |
| QA-02 | Faltan favicon.ico, apple-touch-icon y robots.txt | ✓ |
| QA-03 | El inventario vacío no conecta con las aperturas gratis | ✓ |
| QA-04 | Las tarjetas del tablero no acotan números grandes | ✓ |
| FAIR-06 | `deals.verificar` revela la semilla con `!activa` en vez de `reveladaEn` | ✓ |
| FAIR-08 | El retorno que se muestra se desvía hasta +0,31 pp del real (22 de 165 cajas) | ✓ |
| FAIR-09 | Cancelar un envío en paralelo devuelve 200 varias veces | ✓ |
| FAIR-10 | El panel valida cajas ignorando `topePremioSc` y `retornoObjetivo` | ✓ |
| FAIR-11 | Una cuenta sin tanda crea la semilla dentro del pedido de la apertura | ✓ |

---

# Detalle de los hallazgos críticos

## DINERO-01 — La apertura gratis crea SC canjeable de la nada

**Crítica · Confirmado con PoC propia · `backend/services/boxes/index.js:155-179`**

### Qué pasa

Una apertura gratis se resuelve en dos movimientos sobre el saldo común:

```js
if (gratis && precioUnitario > 0) {
  await wallet.mover({ userId: user._id, amountSc: precioUnitario,
    type: "promo_code", reference: { kind: "freeOpen", ... } });   // 1. acredita
}

const precio = precioUnitario;
if (precio > 0) {
  await wallet.mover({ userId: user._id, amountSc: -precio,
    type: "box_open", juegaSc: precio, ... });                      // 2. cobra
}
```

El comentario dice *"El saldo queda igual --neto cero--"*, y en serie es cierto.
En paralelo no: entre el paso 1 y el paso 2 el saldo está inflado, y los pasos
de varias aperturas se intercalan. Con saldo 0 y dos aperturas a la vez alcanza:

```
A acredita +P   -> saldo P
B cobra    -P   -> saldo 0      (B todavía no acreditó)
A cobra    -P   -> FALLA, no hay saldo; la excepción sube y aborta A
B acredita +P   -> saldo P
```

Queda P de saldo que nadie depositó. La gratis de A ya está marcada como usada y
**su crédito no se revierte**: son dos llamadas sueltas a `wallet.mover`, no una
transacción. Y el SC que queda es **canjeable**: el crédito va sin `bonoSc`, así
que no arrastra ninguna condición de juego.

Esto lo introduje yo, en el cambio que hizo que las aperturas gratis dejaran
asiento en el libro. La intención era correcta —sin eso, el "amount wagered" del
Club VIP y el margen del panel no contaban las cajas de regalo— pero la forma de
hacerlo abrió el agujero.

### Impacto

Una cuenta recién registrada viene con tres cajas de regalo. El ataque es abrir
las tres casi al mismo tiempo: tres pestañas, o un clic en cada tarjeta de
"Tus aperturas gratis". No hace falta ninguna herramienta.

El monto creado escala con el precio de la caja regalada. Con las tres de
fábrica (`mac` SC 2,37 + `pokemon-boosters` SC 2,89 + `splash` SC 3,01) son
unos SC 7 por cuenta. Con una caja de regalo cara, mucho más: la auditoría de
dinero midió **SC 13.121,81 creados en 12 cuentas** usando `expensive-taste`
(SC 1.198). Y el jugador se queda además con los objetos.

Combinado con ABUSO-03 (no hay verificación de correo), es farmeable con cuentas
descartables.

### Reproducir

```
node audit/pocs/gratis-crea-plata.js 10
```

Resultado real de esta auditoría:

```
  ronda 10: 3 gratis, 1 aperturas OK  |  creditos 2 / cobros 1  |  saldo canjeable SC 7.46   <<<< PLATA CREADA

CONFIRMADO: 1 de 10 cuentas terminaron con SC canjeable
sin haber depositado nada. Total creado: SC 7.46.
```

(1 de 10 por HTTP, porque el freno de aperturas rechaza las concurrentes. Las
pruebas contra el servicio, sin ese freno, dieron 8 de 10.)

### Arreglo

El problema de fondo es que un neto cero se está haciendo con dos movimientos
que pueden quedar a mitad de camino. La solución correcta es **no mover el saldo
en absoluto** y dejar el asiento contable sin tocar el balance, que es lo que
hacía falta desde el principio: lo que se quería era que la apertura gratis
*contara como jugada*, no que la plata diera una vuelta.

```diff
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
+    /*
+      UNA APERTURA GRATIS TAMBIEN ES JUGAR, PERO NO MUEVE EL SALDO.
+
+      Antes se acreditaba el precio y despues se cobraba, para que la
+      jugada quedara en el libro. El neto era cero en serie, pero no en
+      paralelo: entre el credito y el cobro el saldo queda inflado, y si
+      el cobro falla el credito no se revierte. Se creaba plata.
+
+      Ahora la gratis deja UN asiento de monto cero que igual suma a lo
+      jugado. El libro dice la verdad y el saldo no se toca nunca.
+    */
+    const precio = gratis ? 0 : precioUnitario;
+
+    if (gratis) {
+      await wallet.mover({
+        userId: user._id,
+        amountSc: 0,
+        type: "box_open",
+        juegaSc: precioUnitario,
+        reference: { kind: "freeOpen", id: caja._id, label: caja.name },
+      });
+    } else if (precio > 0) {
```

Hay que confirmar que `wallet.mover` acepte `amountSc: 0` sin cortar (hoy el
filtro de saldo solo se agrega cuando el monto es negativo, así que debería
pasar), y que `juegaSc` siga sumando a `jugadoSc`. Si se prefiere no tocar
`mover`, la alternativa es envolver los dos movimientos en una transacción de
Mongo — pero eso exige replica set, y la base de desarrollo es standalone.

### Verificar

`node audit/pocs/gratis-crea-plata.js 20` tiene que dar 0 cuentas con saldo, y
el libro tiene que seguir mostrando la jugada (`jugadoSc` crece, el margen del
panel cuenta el premio como costo).

---

## PAGO-01 y PAGO-02 — El canje manda SC como si fueran unidades de la cripto

**Crítica · Confirmado por código · `services/cashier/oxapay.js:109-124`,
`routes/wallet/index.js:368`**

### Qué pasa

Al pagar un canje:

```js
async function pagar({ montoSc, ticker, red, direccion, referencia }) {
  const datos = await pedir("/payout", {
    address: direccion,
    currency: ticker,
    amount: montoSc,        // <-- SC (= USD) con la moneda puesta en BTC
    ...
```

**No hay ninguna conversión de SC a cripto en todo el proyecto.** Lo verifiqué
buscando `cotiza|rate|convert|exchange` en `services/cashier/` y
`routes/wallet/`: cero resultados. Y el propio `money.js` lo dice en su
encabezado: *"no hay cotización entre monedas, no hay conversiones"*.

Que las unidades son de la moneda, y no dólares, lo dice el propio proyecto en
`services/cashier/monedas.js`:

> `comision` es lo que cobra la cadena por sacar, **en unidades de esa moneda**

y el catálogo lo confirma: `BTC` tiene `retiroMinimo: 0.000045` y
`comision: 0.00001`, que solo tienen sentido en BTC.

En el depósito pasa lo mismo al revés:

```js
const monto = sc(Number(datos.amount) || 0);
```

Se lee `amount` y **nunca se lee `currency`, ni `network`, ni las
confirmaciones**. El sitio ofrece BTC, ETH, SOL, LTC, TRX, BNB, DOGE y POL:
diez de las doce monedas del catálogo no valen un dólar.

Además, `retiroMinimo` y `comision` del catálogo **no se usan nunca** en la
validación del servidor: lo único que se compara es `canjeMinimoSc` (SC 50).
La pantalla los muestra, el backend los ignora.

### Impacto

- Canje de SC 50 en BTC → pedido de payout por **50 BTC**.
- Canje de SC 50 en DOGE → **50 DOGE**, unos 9 dólares: el jugador cobra de
  menos y reclama.
- Depósito de 1.000 DOGE (~USD 180) → **SC 1.000** acreditados.
- Depósito de 0,01 BTC (~USD 900) → `sc(0.01)` = **SC 0,01**.

Hoy lo único que frena el primer caso es que la cuenta de OxaPay no tenga ese
saldo. No hay nada en el código que lo impida.

### Lo que falta para cerrarlo del todo

Leer la documentación de `POST /v1/payout` y del callback de pago de OxaPay para
confirmar en qué unidad esperan `amount` y qué campo trae el valor en USD.
No se hicieron requests a dominios reales, así que esto queda como **tarea
pendiente antes de tocar el código**. Lo que sí está confirmado, sin
depender de esa doc, es que **el proyecto no convierte nada**.

### Arreglo inmediato (15 minutos, mientras se resuelve lo de arriba)

Cerrar el canje a monedas estables, donde 1 unidad ≈ 1 USD y el error
desaparece:

```diff
+/* Hasta que exista la conversion SC -> cripto, solo estables: ahi una
+   unidad es un dolar y mandar el numero de SC como `amount` es correcto.
+   Con BTC o DOGE no lo es, y hoy no hay nada que lo convierta. */
+const SOLO_ESTABLES = ["USDT", "USDC"];
+
 async function pedirCanje({ user, montoSc, ticker, red, direccion }) {
   ...
   const par = buscar(ticker, red);
   if (!par) throw errorDe("NOT_FOUND", { ticker, red });
+  if (!SOLO_ESTABLES.includes(par.moneda.ticker)) {
+    throw errorDe("NOT_FOUND", { ticker, motivo: "moneda no habilitada" });
+  }
```

Y en el depósito, rechazar lo que no sea estable en vez de acreditar:

```diff
+    const moneda = String(datos.currency || "").toUpperCase();
+    if (!SOLO_ESTABLES.includes(moneda)) {
+      logger.error(`[oxapay] deposito en ${moneda}: no hay conversion, no se acredita`);
+      return res.json({ success: true, ignorado: "moneda sin conversion" });
+    }
```

### Arreglo definitivo

Una capa de cotización: pedir el precio a OxaPay (o a un oráculo) al crear la
factura y al pagar el canje, guardar la cotización usada en `Redemption` y en
`WalletTx` para que el movimiento sea auditable, y validar contra
`retiroMinimo` y `comision` del catálogo, que hoy son decorativos.

### Verificar

Una prueba que arme un canje de SC 50 en cada moneda del catálogo y compruebe
que el `amount` que sale hacia la pasarela equivale a USD 50 según la cotización
guardada, con tolerancia.

---

## ABUSO-01 — Las carreras pagan el pozo sin piso de participación

**Crítica · Confianza alta · `backend/services/races/index.js:53, 108, 205`**

`tablaDe()` incluye a cualquier cuenta con `jugadoSc > 0`, y `cerrar()` reparte
el pozo entero (30/18/12/9/7/6/5/5/4/4 %) sin mínimo de volumen, sin mínimo de
participantes y sin deduplicar por IP, correo ni dispositivo.

Y las tres aperturas de regalo **escriben filas reales de `box_open`** (es el
mismo cambio de DINERO-01), así que cada cuenta nueva aporta **SC 8,27 de
volumen de carrera a costo cero**.

**Números**: en un sitio tranquilo, SC 2,37 de volumen ganan los SC 600 del
primer puesto diario. Diez cuentas nuevas se llevan los pozos diario (SC 2.000),
semanal (SC 10.000) y mensual (SC 30.000) con costo propio cero. El premio entra
como saldo retirable.

**Arreglo**: piso de volumen por jugador para entrar a la tabla, mínimo de
participantes para que la carrera se liquide (si no se alcanza, el pozo pasa a
la siguiente), y excluir de la tabla el volumen de las aperturas gratis.

---

## JRG-02 — Sin verificación de edad ni geobloqueo

**Crítica · Confianza alta · `routes/auth/index.js:108-190`, `models/User.js`**

El registro pide usuario, correo y contraseña. **Ninguna fecha de nacimiento,
ninguna casilla obligatoria validada en el servidor.** La edad (18) solo se
comprueba al mandar la verificación de nivel 1, que es opcional y ocurre
después de haber jugado.

`User` **no guarda país ni estado**, no hay GeoIP, y no existe ninguna lista de
estados o países restringidos. El pie dice *"Void where prohibited"* y no hay
con qué hacerlo cumplir.

Para un sweepstakes en Estados Unidos las dos cosas son requisito legal, no una
buena práctica.

**Arreglo**: fecha de nacimiento obligatoria en el registro con validación de 18
años en el servidor, campo de estado/país en `User`, lista de estados
restringidos en `Settings`, y bloqueo al registrarse y al canjear.

---

## COPY-01 — Las cinco páginas legales no existen

**Crítica · Confirmado por mí · `components/MbPie.vue:82-86`,
`router/index.js:239`**

El pie de **todas** las pantallas enlaza a:

```
/legal/terms  /legal/rules  /legal/responsible  /legal/privacy  /legal/acceptance
```

- No existe ninguna vista legal en `frontend/src/views/` (busqué
  `legal|terms|rules|privacy`: ninguna).
- El router no tiene ninguna ruta `/legal`.
- El comodín `{ path: "*", redirect: "/boxes" }` manda las cinco al catálogo de
  cajas, sin 404 ni aviso.

El jugador que toca **"Sweepstakes rules"** termina mirando cajas. Y el mismo
pie afirma que los premios se canjean *"under the official rules"* — reglas que
no están publicadas en ningún lado.

Esto es lo que hace que un procesador de pagos cierre una cuenta. Junto con
COPY-04 (se afirma "No purchase necessary" y no existe el método alternativo de
entrada) y JRG-02, es el bloque que hay que resolver antes de abrir al público.

**Arreglo**: es más redacción que código. Una vista `LegalView.vue` con las
cinco páginas y sus rutas, y el texto de las reglas del sorteo, que es el
documento que define el AMOE, los topes de entrada y la elegibilidad por estado.

---

# Detalle de los hallazgos altos

## FAIR-01 — El flag `shippable` no llega al inventario

**Alta · Confirmado por mí · `services/boxes/index.js:204-213`,
`services/deals/index.js:268-277`**

Al crear el `InventoryItem` se copian nombre, foto, rareza y valor, pero **no
`shippable`**, y el modelo lo deja en `default: true`.

Medido en la base local: **9 objetos del catálogo marcados no enviables**
(los vales "MR BOX Credit"), presentes en 32 cajas al aire, y **0 de 462 filas
del inventario llevan el flag**.

El resultado es que el depósito puede recibir una orden de despachar por correo
un vale de crédito. **Arreglo**: una línea, copiar `shippable` desde el `Item` al
crear la fila; más una migración para las 462 existentes.

## DINERO-02 — Dos envíos solapados: el objeto se vende Y se despacha

**Alta · Confirmado con PoC · `services/shipping/index.js:108-149**

El rollback filtra por `{state:"requested", order:null}` y **también desmarca
los objetos del otro pedido** que todavía no grabó su `order`; después el ganador
graba `order` sin condición de estado. El objeto queda `held` (vendible) dentro
de un pedido que el depósito va a despachar.

**12 de 25 rondas** terminaron con mercadería cobrada en SC y despachada a la
vez: **SC 3.600**. **Arreglo**: condición de estado en el filtro del `$set` de
`order`, y acotar el rollback a los ids de ese pedido.

## DINERO-03 — El pago de premio de carrera se repite por cada clic

**Alta · Confirmado con PoC · `routes/admin/carreras.js:160-172`**

El comentario dice "NO PUEDE PAGAR DOS VECES", pero es un `findOne` seguido de
un `mover`: es el **único pago del proyecto sin la condición adentro del
filtro**. 20 clics simultáneos sobre un premio de SC 300 → **20 pagos,
SC 6.000 en vez de SC 300**.

**Arreglo**: `findOneAndUpdate` con el estado "no pagado" dentro del filtro,
igual que hacen los otros ocho lugares del proyecto.

## HOOK-01 / PAGO-03 — La firma del aviso se verifica sobre el JSON reserializado

**Alta · Confirmado con PoC propia · `index.js:95-101` + `routes/wallet/index.js:353`**

El parser global de JSON corre para todas las rutas, incluida `/api/hooks`. Para
cuando corre el `express.raw({type:"*/*"})` de la ruta del aviso, body-parser ya
marcó `req._body` y se saltea: `req.body` queda como objeto parseado, no Buffer.
La ruta lo tapa así:

```js
const crudo = req.body instanceof Buffer ? req.body.toString("utf8") : JSON.stringify(req.body || {});
```

`JSON.stringify` de un objeto parseado **no devuelve los bytes originales**:
pierde el formato y renormaliza los números (`10.50` → `10.5`).

```
node audit/pocs/hook-cuerpo-crudo.js

  FIRMA ACEPTADA  compacto       HTTP 200  {"success":true,"ignorado":"sin jugador"}
  FIRMA RECHAZADA con sangria    HTTP 401  {"success":false}
```

**Impacto**: el aviso solo pasa si OxaPay manda JSON compacto y ningún número
que se reserialice distinto. Si no, **todos los avisos dan 401 y ningún depósito
se acredita nunca**. El jugador paga y no recibe nada, y el registro solo dice
"aviso con firma que no cierra", que apunta al lugar equivocado. Hoy puede estar
funcionando de casualidad.

**Arreglo**: sacar `/api/hooks` del parser global y, ya que no hace falta más,
rechazar el camino de reconstrucción en vez de taparlo.

```diff
+const CRUDO = /^\/api\/hooks(\/|$)/;
+
 app.use((req, res, next) => {
+  if (CRUDO.test(req.path)) return next();
   const grande = SUBEN_ARCHIVOS.some((r) => r.test(req.path));
   return (grande ? cuerpoGrande : cuerpoChico)(req, res, next);
 });
```

```diff
-const crudo = req.body instanceof Buffer ? req.body.toString("utf8") : JSON.stringify(req.body || {});
+if (!(req.body instanceof Buffer)) {
+  logger.error("[oxapay] el aviso llego parseado: algun parser se adelanto al raw");
+  return res.status(500).json({ success: false });
+}
+const crudo = req.body.toString("utf8");
```

**Verificar**: `node audit/pocs/hook-cuerpo-crudo.js` tiene que aceptar los dos
formatos.

## PAGO-05 — Un depósito que falla al acreditar queda trabado para siempre

**Alta · Confirmado por mí · `routes/wallet/index.js:383-420`**

La marca de `DepositoAvisado` se crea antes de mover la plata, que es correcto y
es lo que impide la doble acreditación. Pero si `wallet.mover` tira, el 500 hace
que OxaPay reintente, y el reintento choca con el índice único y contesta
`{repetido: true}` **sin acreditar**, dejando `acreditado: false` para siempre.

El comentario del modelo dice que eso "se ve en el panel". No se ve:
`grep -rn "DepositoAvisado"` en todo el backend devuelve **solo** el modelo, el
`require` y las dos escrituras. El campo `acreditado` se escribe y **no se lee
nunca**. No hay pantalla ni proceso de reparación.

Es un efecto colateral del arreglo de idempotencia del commit anterior: el
arreglo está bien, pero le falta el acompañante.

**Arreglo**: una pantalla en el panel que liste `DepositoAvisado` con
`acreditado: false` y un botón para reintentar la acreditación, o un repaso
automático en el reloj de cada hora.

## AUTH-01 / INFRA-02 — El límite de intentos se saltea con `X-Forwarded-For`

**Alta · Confirmado por mí · `index.js:36`, `routes/auth/index.js:43`**

`app.set("trust proxy", 1)` hace que `req.ip` sea confiable solo si hay
**exactamente un** proxy delante. Medido contra el servidor local:

```
Sin cabecera:                       400 ×7, después 429 ×7
Rotando X-Forwarded-For (20 veces): 400 ×20, el contador nunca sube
```

Es el único freno sobre el login, porque **no hay bloqueo por cuenta**. Con cero
proxies (desarrollo, o un `node index.js` expuesto) el cliente elige su `req.ip`.
Con dos proxies (si entra Cloudflare delante de Render) pasa lo contrario: todos
cuentan como la misma IP y a los diez intentos queda afuera todo el mundo.

Además, `req.ip` es lo que se guarda en `SessionEvent`, en el `AdminLog` y lo que
agrupa el panel de riesgo por IP: una granja de multicuentas elige una IP por
cuenta y nunca cae en el grupo.

**Arreglo**: el número de proxies como variable de entorno, y un `keyGenerator`
que mezcle la IP con la cuenta apuntada.

## INFRA-01 — CORS en comodín si falta `SITIO_URL`

**Alta · Confirmado por mí · `index.js:50-55`**

`cors({})` es `origin: "*"`. `SITIO_URL` no está definida en `backend/.env` y la
respuesta real trae `Access-Control-Allow-Origin: *`. **Falla abierto**, en la
variable más fácil de olvidar al desplegar.

No es CSRF (la sesión va en `x-auth-token` y no hay `credentials`), pero permite
que cualquier página lea respuestas de la API con un token robado, y que un
frontend clonado use producción.

**Arreglo**: negarse a arrancar sin `SITIO_URL` salvo que una variable explícita
diga que es desarrollo.

## QA-01 — La cinta de Live Pulls ordena en memoria

**Alta · Confirmado por mí · `routes/boxes/index.js:368`**

Detalle completo en [`qa/README.md`](qa/README.md). Resumen: la portada pide
`/api/boxes/feed/latest` cada 1,5 s, por visitante, sin sesión y sin freno, y la
consulta no tiene índice que la sirva. El `explain` dice `SORT` en memoria
examinando la colección entera, que crece una fila por apertura. Se arregla con
un índice `{ demo: 1, createdAt: -1 }`.

## ABUSO-02, ABUSO-03, ABUSO-04, JRG-01, COPY-02, COPY-04

Están detallados en el informe del área, con números. Resumen:

- **ABUSO-02**: el control de auto-referido compara el mismo ObjectId, caso que
  ya era imposible. Con una segunda cuenta no hay nada, y el bono de compra no es
  de primer depósito: aplica a cada compra, con `vecesAJugarElBono = 1`. Da
  **+4,6 % neto por depósito con 5 %, +9,2 % con 10 %**, repetible sin tope. Para
  ser neutro haría falta `vecesAJugarElBono ≈ 12,5`.
- **ABUSO-03**: no existe verificación de correo. Las tres cajas de bienvenida
  valen **SC 7,61 esperados**, vendibles al 100 %. A 10 registros cada 15 min por
  IP son SC 304/hora/IP.
- **ABUSO-04**: `pagarAlCreador` acredita el 50 % del margen como saldo
  retirable, y el control de "no cobrar por abrir la propia caja" está en el
  sitio de llamada, no dentro de la función. Con dos cuentas se **extrae el 50 %
  de un saldo trabado** (bono no canjeable, cuenta con `redemptionLock`, cuenta
  que nunca va a pasar el KYC). Mitiga, no cierra, que la caja necesita
  aprobación humana.
- **JRG-01**: `revisarAntesDeJugar` se llama **solo** desde abrir caja y jugar
  deal. No lo consultan `/wallet/promo`, `/wallet/code`, `/vip/rakeback/:periodo`
  ni —lo más grave— `POST /hooks/oxapay`, que **le sigue acreditando compras a un
  autoexcluido de 365 días**.
- **COPY-02**: 29 claves de cara al jugador con palabras prohibidas en inglés
  (`deposit` ×17, `wager` ×6, `odds` ×7) y sus equivalentes traducidos en los
  ocho idiomas. Los peores: el **ruso llama `казино` al sitio** en 4 claves, el
  **chino usa `投注` ("apostar") en 27 claves** y `赔率最佳` ("mejores cuotas")
  en la portada, y alemán e italiano usan `Quoten`/`quote`. Ojo: los locales se
  **generan** desde `frontend/scripts/traducir.py`; editar los `.js` a mano no
  sirve.
- **COPY-04**: el pie afirma "No purchase necessary" en los nueve idiomas y el
  FAQ del VIP lo repite. No existe ninguna vía gratuita: ni solicitud postal, ni
  formulario, ni topes de entrada. Sin AMOE real la afirmación es falsa y el
  modelo deja de ser sweepstakes.

---

# Plan para las próximas 24-48 horas

| # | Qué | Por qué primero | Tiempo |
|---|---|---|---|
| 1 | **DINERO-01** — la apertura gratis | Hoy cualquiera fabrica saldo retirable | 1-2 h |
| 2 | **PAGO-01/02** — cerrar el canje y el depósito a USDT/USDC | 15 min que tapan el riesgo más caro mientras se resuelve la conversión | 15 min |
| 3 | **HOOK-01** — sacar `/api/hooks` del parser global | Sin esto los depósitos pueden no acreditarse nunca | 5 min |
| 4 | **PAGO-04** — revisar qué URL de callback está cargada en el panel de OxaPay | `docs/HUECOS.md` dice que se cargó la ruta equivocada | 10 min |
| 5 | **FAIR-01** — copiar `shippable` + migrar las 462 filas | Evita despachar vales por correo | 30 min |
| 6 | **DINERO-03** — condición de estado en el pago de carrera | Un clic de más son SC 300 | 15 min |
| 7 | **DINERO-02** — el rollback de envíos | Mercadería real | 1 h |
| 8 | **ABUSO-01** — piso de participación en carreras | Los pozos son el premio más grande del sitio | 1 h |
| 9 | **INFRA-01** — no arrancar sin `SITIO_URL` | Una línea | 5 min |
| 10 | **AUTH-01** — proxies como variable + `keyGenerator` por cuenta | El login no tiene otro freno | 1 h |

Y en paralelo, que no es código: **COPY-01** (escribir y publicar las cinco
páginas legales, con las reglas del sorteo y el AMOE), **JRG-02** (fecha de
nacimiento y estado en el registro) y **COPY-04**. Ese bloque es el que decide si
la pasarela de pago sigue abierta.

---

# Lo que está bien hecho

Conviene decirlo con el mismo detalle, porque es en lo que se puede confiar.

## El sorteo verificable: verificado con números

- **No hay `Math.random()` en ningún resultado.** Solo aparece en la cinta de
  relleno de la portada (entradas falsas que no tocan la base) y en la animación
  de la ruleta. El sorteo real usa `crypto.createHmac` y `crypto.randomBytes`.
- **251 aperturas reales de la base local reproducidas exactas por el
  verificador público: 251 de 251, 0 que no coincidan.**
- **Prueba de nonce**: 60 aperturas en paralelo del mismo jugador → 60 nonces
  únicos, 60 HMAC únicos, 0 duplicados, rango [1,60] sin huecos. **No se puede
  repetir un nonce ni forzar el mismo resultado jugando en paralelo.**
- **165 cajas**: las chances suman 100,00 % en todas (tolerancia 1e-6), 0 premios
  con chance 0, **0 cajas con retorno mayor a 100 %**. RTP real entre 91,958 % y
  92,000 %.
- **Lo que muestra la API es lo que usa el sorteo**: 0 diferencias en chance,
  valor y orden, premio por premio, en las 165 cajas.
- **Distribución**: 10.000 aperturas reales sobre un premio al 10 % dieron 9,87 %
  (z = −0,43). 2.000 tiros de Deals al 50 % dieron 51,35 % (z = +1,21).
- **El servidor no puede elegir el resultado después de ver la apuesta**: el HMAC
  no depende de la caja ni del monto, la tabla de premios queda congelada en el
  recibo, y **no hay ninguna ruta de admin que toque `UserSeed`**.
- El compromiso previo está bien: la semilla se crea con la cuenta, el hash se
  publica, la semilla no se devuelve nunca (`select: false`), el jugador edita su
  semilla de cliente, y al rotar se revela la vieja.

## Las cajas de la comunidad

El escenario que más preocupaba —que un creador le cambie los premios a su caja
después de aprobada— **no existe**. Nacen apagadas, la aprobación del admin es
obligatoria, **cada edición posterior las vuelve a bajar del aire**, el creador
no puede forzar `priceSc`, `precioAMano`, `live` ni `approvalState` (se le
mandaron los cuatro y los cuatro se ignoraron), los valores se leen del catálogo
y no del pedido, y no cobra por abrir su propia caja.

## La contabilidad

- Todo movimiento pasa por `wallet.mover()`, con la condición de saldo **adentro
  del filtro**. Nada fuera de `services/wallet` escribe `balanceSc` (verificado
  con grep).
- En cuentas 100 % API el libro **cierra perfecto**: 111 filas con 40 aperturas y
  30 ventas concurrentes, suma = saldo exacto, 0 filas donde
  `before + monto != after`.
- **El arreglo de comisiones del commit anterior resiste**: 20 aperturas de una
  caja de comunidad → margen 2,05, pagado 2,53, `margenPendienteSc: -3,02`. La
  cuenta cierra exacta y no se paga dos veces.
- **El bono sin jugar no se puede sacar**: saldo 200, bono 150, 10 retiros de 55
  en paralelo → **0 aceptados**.
- **El aviso de OxaPay con el mismo `track_id` 20 veces → 1 sola acreditación.**
- El redondeo es **siempre a favor de la casa** (`Math.ceil` en `precioDe` y
  `apuestaDe`), y el piso de apuesta de SC 0,50 en Deals cierra un exploit de
  redondeo que si no daría +37 % de ventaja al jugador.

### Pruebas de concurrencia que pasaron

Vender el mismo objeto ×30 → 1 · vender + enviar el mismo objeto, 50 rondas → 0
dobles · `sell-many` con el mismo id ×200 → 1 · abrir caja con saldo para 1, ×30
→ 1, saldo nunca negativo · 1 caja gratis, 20 aperturas → se consume una sola vez
· 20 retiros de SC 60 con saldo 100 → 1 · cancelar el mismo retiro ×20 → 1
devolución · rakeback ×20 del mismo período → 1 · promo ×15 del mismo código → 1
· desafío de 1 cupo, 20 jugadores → 1 ganador · cerrar la misma carrera ×20 → 1
pago · 12 ventas en paralelo del mismo objeto → 1 · 8 pedidos de envío del mismo
objeto → 1.

## La autorización del panel

**76 rutas de `/api/admin` probadas, dos veces y por dos caminos distintos**
(montando el router sin base, y por HTTP contra el servidor real con un token de
jugador normal): **401 sin token, 403 con token de jugador, sin una sola
excepción**. Los sub-routers montados después del middleware quedan cubiertos.
Un `admin` **no puede ascenderse a `owner`**: los cuatro caminos posibles están
cerrados.

## Autenticación

JWT sólido: `alg:none` rechazado, confusión HS/RS rechazada en las dos
direcciones, secreto vacío rechazado, expiración respetada. El token lleva solo
el id; rango, saldo y verificación se releen de la base en cada pedido, así que
quitarle el admin a alguien tiene efecto inmediato, y `banned` se revalida
siempre. El login **no permite enumerar usuarios**: mismo error para los dos
casos y hash de relleno real; la diferencia de tiempo (750 vs 813 ms de mediana,
con rango de 497 a 1804) es un orden de magnitud menor que el ruido.

## Inyecciones

**Ninguna explotable.** Login con `{"$ne":null}` y `{"$regex":"^a"}` → ambos
`BAD_CREDENTIALS`. Códigos promocionales con `$ne`, `$regex`, `$gt` → todos
`CODE_NOT_FOUND`: **no se pueden enumerar carácter por carácter**. Cero XSS (los
nueve `v-html` del frontend son `$t()` con parámetros numéricos o constantes del
servidor). Cero SSRF: solo dos `fetch` en todo el backend, los dos con URL
constante; **no hay ningún campo "image URL" que el servidor descargue**. Cero
prototype pollution: no hay un solo merge profundo. El SVG **no pasa** el filtro
de portadas. Los archivos de KYC no son accesibles por otro usuario y no hay path
traversal (`__proto__`, `constructor` y `..%2f` → 404). Los topes de tamaño del
KYC funcionan (9 MB → `FILE_TOO_BIG`).

**Ninguna de las 157 rutas deja de castear lo que usa**, aunque no hay librería
de validación de esquemas: cada archivo repite su propio `String().trim()`.

## Secretos e historial

**No se filtró ningún secreto, nunca.** `backend/.env` no se commiteó jamás
(`git log --all --full-history` sin resultados), `git log -S` con los prefijos de
las dos claves de OxaPay no devuelve nada en ninguna rama, y el barrido de
`*.env*`, `*.xlsx`, `*.sql`, `*.dump`, `*.log` y `*backup*` en todo el historial
solo encontró los `.env.example` y un script de inventario sin secretos.

`npm audit`: **backend 0 vulnerabilidades**. Frontend 33, **todas en
devDependencies** (webpack-dev-server, postcss, serialize-javascript): no llegan
al bundle de producción.

## Funcionamiento

209 pruebas pasan, el build del frontend sale limpio, 15 rutas a 390 px sin
desborde horizontal, los 9 idiomas sin claves crudas a la vista, 16 rutas
recorridas con 0 pedidos 4xx/5xx y 0 errores de consola, los 7 `setInterval`
tienen su `clearInterval`, y el doble clic no dispara dos operaciones porque los
botones se deshabilitan antes del `await`.

---

# Nota sobre la base de datos local

Las pruebas dejaron datos en `mrbox_local`: usuarios `audit_*` y `poc_gratis_*`
con su inventario, sus canjes y sus filas del libro, una caja `audit-com-*`,
códigos `AUDIT*`/`PAUSA*`, un hilo de soporte y una campaña de afiliado con
payloads de prueba en el texto, y un movimiento de SC 1e21 que rompe las
estadísticas del tablero.

**No se borró nada** porque borrar datos no estaba en el encargo. Si querés, se
limpia con un filtro por los prefijos `audit`, `poc_` y `dbg_`. Producción no se
tocó en ningún momento.
