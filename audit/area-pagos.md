# MR BOX — Auditoría de seguridad · Área: pagos, webhooks, integraciones, configuración e infraestructura

Fecha: 19 de noviembre de 2026
Alcance: `backend/routes/wallet/`, `backend/services/cashier/`, `backend/routes/admin/extra.js`,
`backend/index.js`, `backend/database/`, `backend/utils/`, `.env*`, historial de git, dependencias.
Modo: **solo lectura**. No se modificó ningún archivo del proyecto. No se hizo ninguna petición a
dominios reales (ni OxaPay, ni Cloudflare, ni producción). Las pruebas en vivo se hicieron contra
el servidor de desarrollo que ya estaba escuchando en `127.0.0.1:5001`, y **ninguna acreditó ni
movió saldo** (se usó `status: "expired"`, que el handler ignora, y logins sin captcha).

Todo valor secreto está **enmascarado**.

---

## Resumen

| ID | Título | Severidad | Confianza |
|---|---|---|---|
| PAGO-01 | El payout manda el monto en SC como si fueran unidades de la cripto | **Crítica** | Alta |
| PAGO-02 | El aviso de depósito acredita `amount` como SC 1:1 sin mirar `currency` | **Crítica** | Alta |
| PAGO-03 | La firma se calcula sobre el JSON re-serializado, no sobre los bytes crudos | **Alta** | Alta (probado) |
| PAGO-04 | `OXAPAY_CALLBACK_URL` apunta a una ruta que no existe (404) | **Alta** | Alta (probado) |
| PAGO-05 | Un depósito que falla al acreditar queda bloqueado para siempre | **Alta** | Alta |
| PAGO-06 | Sin doble aprobación: el mismo admin aprueba y paga | Media | Alta |
| PAGO-07 | La dirección de pago se valida solo por largo y espacios | Media | Alta |
| PAGO-08 | `OXAPAY_CALLBACK_SECRET` vacío → cae a la clave de comercio | Baja | Alta |
| EUPAY-01 | No existe ninguna integración EUPay en el repositorio | Info | Alta |
| INFRA-01 | CORS queda en comodín si falta `SITIO_URL` | **Alta** | Alta (probado) |
| INFRA-02 | `X-Forwarded-For` falseable: evade el rate limit y ensucia las señales de riesgo | Media | Alta (probado) |
| INFRA-03 | CSP apagado y sin `Permissions-Policy` | Media | Alta |
| INFRA-04 | El 404 refleja la ruta pedida | Baja | Alta |
| INFRA-05 | Falta `hpp` (impacto bajo por el parser de Express 5) | Baja | Media |
| SEC-01 | Claves reales de OxaPay (incluida la de pagos) en el `.env` de la máquina de desarrollo | Baja | Alta |
| SEC-02 | `backend/scripts/tmp/inv.js` quedó en el historial de git | Baja | Alta |
| INFRA-06 | `npm audit`: 0 en backend, 33 en frontend (todas en devDependencies) | Info | Alta |

### Lo que está bien (verificado, no es hallazgo)

- **La firma del aviso existe, es HMAC-SHA512 y se compara en tiempo constante.**
  `backend/services/cashier/oxapay.js:136-151` usa `crypto.timingSafeEqual` con control de largo
  previo, y devuelve `false` si falta la clave o la firma. **Probado en vivo**: sin cabecera `hmac`
  → `401`; con `hmac: deadbeef` → `401`. **No se puede acreditar saldo sin firma válida.**
- **Replay**: `DepositoAvisado` con `trackId` único creado ANTES de mover la plata
  (`backend/routes/wallet/index.js:383-394`); el segundo aviso choca contra el índice 11000 y
  contesta `{repetido:true}`. Está bien implementado (ver PAGO-05 por el efecto colateral).
- **`POST /wallet/deposit/tx` no acredita nada**: solo hace un `updateOne` con `$setOnInsert` sobre
  `WalletTx` (`backend/routes/wallet/index.js:95-118`). El estado del pago **no** lo controla el
  cliente por ningún camino.
- **Doble pago del mismo canje: no se puede.** `approve`, `pay` y `reject` usan
  `findOneAndUpdate` con el estado anterior dentro del filtro
  (`backend/services/cashier/index.js:328-339`, `356-362`, `383-388`). El cambio de estado es
  atómico; no hay leer→guardar.
- **No se puede cambiar la dirección después de pedir el canje.** No existe ninguna ruta que
  edite `Redemption.direccion`: la única escritura es el `create` de
  `backend/services/cashier/index.js:182-193`, y el editor genérico del panel
  (`backend/routes/admin/editar.js`) trabaja con una lista blanca de modelos y campos que **no
  incluye `Redemption`**.
- **El saldo se descuenta al pedir, con la condición adentro de la base** (`$expr` sobre
  `balanceSc - bonoPendienteSc`, `backend/services/wallet/index.js:117-124`), y si el pago a la
  pasarela falla, el canje vuelve a `approved` sin devolver ni volver a descontar
  (`backend/services/cashier/index.js:399-403`). Correcto.
- **No se filtran stack traces ni queries al cliente.** `backend/utils/errors.js` devuelve
  `{code, message, data}` con mensajes de un catálogo fijo; los `responderError` de cada router
  loguean `err.message` y contestan `SOMETHING_WENT_WRONG` genérico; el handler final
  (`backend/index.js:149-152`) loguea el stack y contesta genérico.
- **No se loguea PII, tokens ni cuerpos enteros.** Grep sobre todos los `logger.*` del backend:
  ningún `req.body`, ninguna contraseña, ningún token. `backend/utils/logger.js` guarda 200 líneas
  en memoria y solo las ve el panel (admin).
- **Mongo no tiene URI por defecto** (`backend/database/index.js:244-248` exige `DATABASE_URI` y
  rompe fuerte si falta); la de desarrollo es `mongodb://127.0.0.1:27017/...`, no expuesta, sin
  credenciales.
- **`backend/.env` nunca se commiteó** y no hay material de clave en el historial (ver SEC).
- **No hay paquetes "placeholder"** (`fs`, `http`, `path`, `https`, `crypto-js`, `base64-img`) en
  ninguno de los dos `package.json`.

> Excluido por pedido (ya reportado): la idempotencia del payout depende de que OxaPay respete el
> campo de referencia.

---

## PAGO-01 — El payout manda el monto en SC como si fueran unidades de la cripto

- **Severidad**: Crítica
- **Categoría**: Lógica de negocio / integración de pagos
- **Archivo**: `backend/services/cashier/index.js:390-398` y `backend/services/cashier/oxapay.js:109-124`
- **Confianza**: Alta
- **Esfuerzo**: Medio (hace falta una fuente de cotización)

### Descripción

Un canje se guarda en SC (`montoSc`) y en `backend/services/cashier/index.js:390-398` se manda a
pagar tal cual, con el ticker de la moneda elegida:

```js
      salida = await oxapay.pagar({
        montoSc: sc(tomado.montoSc),
        ticker: tomado.moneda,
        red: tomado.red,
        direccion: tomado.direccion,
        referencia: String(tomado._id),
      });
```

Y `pagar` lo pone directamente en el cuerpo del `/payout`, junto con `currency`:

```js
async function pagar({ montoSc, ticker, red, direccion, referencia }) {
  const datos = await pedir(
    "/payout",
    {
      address: direccion,
      currency: ticker,
      network: red,
      amount: montoSc,          // <-- SC (USD) enviado como unidades de `currency`
```

No hay conversión en ningún lado: `grep -rni "cotiza|price_amount|pay_amount|rate|usd"` sobre
`backend/services` y `backend/routes` no devuelve ninguna conversión de moneda, y
`backend/utils/money.js:1-6` lo dice explícitamente: *"no hay cotización entre monedas, no hay
conversiones"*. Que `amount` va en unidades de la moneda lo confirma el propio proyecto en
`backend/services/cashier/monedas.js:37-42`, donde `comision` y `retiroMinimo` están documentados
*"en unidades de esa moneda"* y leídos de `GET /v1/common/currencies` de la cuenta.

De las 12 monedas de `monedas.js`, solo USDT y USDC valen ~1 USD. Las otras diez (BTC, ETH, SOL,
LTC, TRX, BNB, DOGE, POL, XRP, XMR) quedan mal por varios órdenes de magnitud.

### Impacto concreto

Un jugador pide canjear **SC 50 en BTC** y el panel manda a OxaPay `{"currency":"BTC","amount":50}`:
una orden de pago de **50 BTC**. Si la cuenta de OxaPay tiene saldo, la plata sale. Si no lo tiene,
OxaPay rechaza y el canje vuelve a `approved` — es decir, el único freno real hoy es el saldo de la
cuenta de la pasarela, no el código. En el sentido inverso, un canje de SC 50 en DOGE manda 50 DOGE
(unos pocos dólares) y el jugador cobra una fracción de lo que le descontaron.

### Pasos para reproducir (local, sin pagar nada)

1. `cd backend && node --test tests/caja.test.js` no cubre el cuerpo del payout.
2. Instrumentar en local (sin tocar el repo): levantar el servidor con `OXAPAY_PAYOUT_KEY=x` y
   `oxapay.BASE` apuntando a un servidor mock en `127.0.0.1` que imprima el cuerpo recibido.
3. Crear un canje de SC 50 en BTC, aprobarlo y tocar "Pagar" en el panel.
4. El mock recibe `{"address":"...","currency":"BTC","network":"BTC","amount":50,...}`.

### PoC (mock local, no toca OxaPay)

```js
// scratchpad/mock-payout.js
require("http").createServer((req, res) => {
  let b = ""; req.on("data", (c) => (b += c));
  req.on("end", () => { console.log(req.url, b); res.end('{"data":{"track_id":"mock"},"error":{}}'); });
}).listen(5099);
// y arrancar el backend con BASE = "http://127.0.0.1:5099/v1"
```

### Arreglo propuesto

```diff
--- a/backend/services/cashier/oxapay.js
+++ b/backend/services/cashier/oxapay.js
@@
-async function pagar({ montoSc, ticker, red, direccion, referencia }) {
+/**
+ * Cuánto vale 1 unidad de `ticker` en USD, según la pasarela.
+ * Se pide a la API en el momento del pago: una cotización vieja paga mal.
+ */
+async function cotizacion(ticker) {
+  const r = await fetch(`${BASE}/common/prices`, { headers: { "Content-Type": "application/json" } });
+  const d = await r.json();
+  const precio = Number((d.data || d)[String(ticker).toUpperCase()]);
+  if (!Number.isFinite(precio) || precio <= 0) throw new Error(`oxapay: sin cotizacion de ${ticker}`);
+  return precio;
+}
+
+async function pagar({ montoSc, ticker, red, direccion, referencia }) {
+  /* SC es USD. La pasarela cobra en unidades de la moneda: hay que convertir. */
+  const precio = await cotizacion(ticker);
+  const cantidad = Number((montoSc / precio).toFixed(8));
+
   const datos = await pedir(
     "/payout",
     {
       address: direccion,
       currency: ticker,
       network: red,
-      amount: montoSc,
+      amount: cantidad,
       description: `MR BOX redemption ${referencia}`,
     },
```

Además, en `services/cashier/index.js`, guardar en el `Redemption` la cotización usada y la
cantidad enviada (`cotizacionUsada`, `cantidadEnviada`) para poder auditar después, y rechazar el
pago si `cantidad < par.red.retiroMinimo` o si `cantidad <= 0`.

### Cómo verificar

Con el mock de arriba: un canje de SC 50 en BTC tiene que mandar `amount` ≈ `50 / precioBTC`
(del orden de 0.0005), no 50; y un canje de SC 50 en USDT tiene que mandar ≈ 50.

---

## PAGO-02 — El aviso de depósito acredita `amount` como SC 1:1 sin mirar `currency`

- **Severidad**: Crítica
- **Categoría**: Lógica de negocio / webhook
- **Archivo**: `backend/routes/wallet/index.js:361-412`
- **Confianza**: Alta
- **Esfuerzo**: Medio

### Descripción

```js
    const datos = JSON.parse(crudo || "{}");
    const estado = String(datos.status || "").toLowerCase();
    const trackId = String(datos.track_id || datos.trackId || "");
    const userId = String(datos.order_id || "");

    /* Solo cuando está confirmado de verdad. */
    if (estado !== "paid" && estado !== "confirmed") return res.json({ success: true, ignorado: estado });

    const monto = sc(Number(datos.amount) || 0);
    if (!userId || monto <= 0 || !trackId) return res.json({ success: true, ignorado: "incompleto" });
```

…y más abajo (`:406-412`):

```js
    await wallet.mover({
      userId,
      amountSc: sc(monto + bono),
      type: "purchase",
```

El cuerpo del aviso se usa así:

- **`currency` no se lee nunca.** El número que venga en `amount` se acredita como SC, y SC = USD.
- **`network` no se lee nunca**, así que tampoco se comprueba contra la red por la que se pidió la
  dirección.
- **No se miran las confirmaciones.** `monedas.js` define `confirmaciones` para cada red (2 para
  BTC, 50 para Polygon…) y el comentario de ese archivo dice que *"es lo que hay que esperar antes
  de acreditar"*, pero el aviso no compara nada: alcanza con `status: paid`.
- **No se compara contra un monto esperado** ni contra el mínimo que el propio sitio publica
  (`minimoDepositoSc: 10`, `backend/routes/wallet/index.js:53`).
- **`order_id` se usa como id de jugador tal cual** y se acredita a esa cuenta. Esto está
  protegido por la firma, pero convierte cualquier filtración de la clave de comercio en
  "acreditarle SC a cualquier usuario".

### Impacto concreto

Diez de las doce monedas aceptadas no valen 1 USD:

| Depósito real | Lo que llega en `amount` | SC acreditados | Resultado |
|---|---|---|---|
| 1.000 DOGE (~USD 150-200) | 1000 | **1.000 SC = USD 1.000** | el jugador multiplica su plata por 5 |
| 1.000 TRX (~USD 300) | 1000 | **1.000 SC** | ×3 |
| 2.000 POL (~USD 400) | 2000 | **2.000 SC** | ×5 |
| 0,01 BTC (~USD 900) | 0.01 | **0 SC** (`sc()` redondea a centavos) | el jugador pierde todo el depósito |
| 0,2 ETH (~USD 600) | 0.2 | **0,20 SC** | pierde el 99,97% |

Es decir: por un lado una máquina de plata gratis con las monedas baratas, por otro depósitos de
BTC/ETH que se evaporan en silencio (`monto <= 0` → `ignorado: "incompleto"`, y además la marca de
`DepositoAvisado` ya quedó escrita, ver PAGO-05). Encima, al acreditar también se paga el bono de
afiliado sobre el monto inflado (`:403`).

### Pasos para reproducir (local)

1. Levantar el backend local con `OXAPAY_CALLBACK_SECRET=secreto-de-prueba`.
2. Firmar y mandar un aviso con una moneda barata (ver PoC). No hace falta tocar OxaPay.
3. Mirar el saldo del jugador: suben tantos SC como unidades de cripto diga `amount`,
   independientemente de `currency`.

### PoC

```js
// scratchpad/poc-deposito.js  (contra un backend LOCAL con secreto de prueba)
const crypto = require("crypto");
const cuerpo = JSON.stringify({
  status: "paid", track_id: "poc-1", order_id: "<id del jugador>",
  amount: 1000, currency: "DOGE", network: "Dogecoin"   // 1000 DOGE ≈ USD 180
});
const firma = crypto.createHmac("sha512", "secreto-de-prueba").update(cuerpo).digest("hex");
fetch("http://127.0.0.1:5001/api/hooks/oxapay", {
  method: "POST", headers: { "Content-Type": "application/json", hmac: firma }, body: cuerpo,
}).then((r) => r.text()).then(console.log);
// -> {"success":true} y el jugador queda con 1000 SC (USD 1000) por USD 180.
```

### Arreglo propuesto

```diff
--- a/backend/routes/wallet/index.js
+++ b/backend/routes/wallet/index.js
@@
     const datos = JSON.parse(crudo || "{}");
     const estado = String(datos.status || "").toLowerCase();
     const trackId = String(datos.track_id || datos.trackId || "");
     const userId = String(datos.order_id || "");
+    const ticker = String(datos.currency || "").toUpperCase();
+    const red = String(datos.network || "");
 
     /* Solo cuando está confirmado de verdad. */
     if (estado !== "paid" && estado !== "confirmed") return res.json({ success: true, ignorado: estado });
 
-    const monto = sc(Number(datos.amount) || 0);
-    if (!userId || monto <= 0 || !trackId) return res.json({ success: true, ignorado: "incompleto" });
+    /*
+      EL MONTO EN SC NO ES EL NUMERO DEL AVISO.
+
+      `amount` viene en unidades de `currency`. SC es USD: hay que usar
+      el valor en USD que manda la pasarela y, si no viene, convertir con
+      la cotizacion. Acreditar `amount` tal cual regala plata con las
+      monedas baratas y se come los depositos de BTC/ETH.
+    */
+    const par = require("../../services/cashier/monedas").buscar(ticker, red);
+    if (!par) return res.json({ success: true, ignorado: "moneda desconocida" });
+
+    const usd = Number(datos.price_amount ?? datos.usd_amount);
+    const monto = sc(Number.isFinite(usd) && usd > 0
+      ? usd
+      : Number(datos.amount) * (await oxapay.cotizacion(ticker)));
+
+    /* Las confirmaciones que pide la red, no las que diga el aviso. */
+    const confirmaciones = Number(datos.confirmations ?? datos.confirms ?? 0);
+    if (confirmaciones < par.red.confirmaciones) {
+      return res.json({ success: true, ignorado: "sin confirmaciones" });
+    }
+
+    if (!userId || monto <= 0 || !trackId) return res.json({ success: true, ignorado: "incompleto" });
```

Y guardar en `DepositoAvisado` el `ticker`, la `red`, el `amount` original y la cotización usada,
para poder reconstruir después de dónde salió cada SC.

### Cómo verificar

Mandar al backend local el mismo PoC con `currency: "DOGE"` y con `currency: "USDT"` y comprobar
que el saldo sube en USD, no en unidades; y que un aviso con menos confirmaciones que las de
`monedas.js` no acredita.

---

## PAGO-03 — La firma se calcula sobre el JSON re-serializado, no sobre los bytes crudos

- **Severidad**: Alta
- **Categoría**: Webhook / disponibilidad del cobro
- **Archivo**: `backend/index.js:94-100` + `backend/routes/wallet/index.js:352-356`
- **Confianza**: Alta — **probado en vivo**
- **Esfuerzo**: Bajo

### Descripción

El handler pide el cuerpo crudo:

```js
aviso.post("/oxapay", express.raw({ type: "*/*" }), async (req, res) => {
  const crudo = req.body instanceof Buffer ? req.body.toString("utf8") : JSON.stringify(req.body || {});
```

Pero en `backend/index.js:97-100` hay un `express.json()` **global**, montado antes de `/api`:

```js
app.use((req, res, next) => {
  const grande = SUBEN_ARCHIVOS.some((r) => r.test(req.path));
  return (grande ? cuerpoGrande : cuerpoChico)(req, res, next);
});

app.use("/api", require("./routes"));
```

Cuando el aviso llega con `Content-Type: application/json` (que es lo normal), `express.json()` ya
consumió el stream y marcó `req._body`; `express.raw` se vuelve un no-op, `req.body` **no** es un
Buffer, y la firma se calcula sobre `JSON.stringify(req.body)` — una **re-serialización**, no los
bytes que firmó OxaPay.

### Prueba en vivo (ejecutada)

Contra `127.0.0.1:5001`, con `status: "expired"` (el handler lo ignora, no acredita nada):

```
A compacto  + firma sobre bytes crudos  (json)   200 {"success":true,"ignorado":"expired"}
B espaciado + firma sobre bytes crudos  (json)   401 {"success":false}
C espaciado + firma sobre re-serializado (json)  200 {"success":true,"ignorado":"expired"}
D espaciado + firma sobre bytes crudos  (text)   200 {"success":true,"ignorado":"expired"}
```

B es la prueba: un cuerpo cuyos bytes están firmados correctamente se **rechaza** si el formato no
coincide byte a byte con `JSON.stringify` de Node. C confirma que lo que se verifica es la
re-serialización. D confirma que con un content-type que `express.json` no parsea, sí llegan los
bytes crudos.

### Impacto concreto

Si OxaPay manda el JSON con cualquier diferencia de formato respecto de `JSON.stringify` de Node
(espacios, saltos de línea, `1.0` en vez de `1`, escapes Unicode, orden de claves distinto al de
`JSON.parse`), **todos los avisos se rechazan con 401 y ningún depósito se acredita jamás**. Es un
fallo cerrado, pero el síntoma es "la gente paga y no le llega el saldo", y la tentación obvia para
destrabarlo en producción es aflojar la verificación de firma. Además, cualquier cosa que
`JSON.parse`→`stringify` normalice (claves duplicadas, números muy grandes) deja de estar cubierta
por la firma.

### Pasos para reproducir

`node scratchpad/probar-firma.js` (el script usado arriba): manda los cuatro casos A–D y muestra
el código de respuesta de cada uno.

### Arreglo propuesto

```diff
--- a/backend/index.js
+++ b/backend/index.js
@@
 const SUBEN_ARCHIVOS = [/^\/api\/profile\/verification(\/|$)/, /^\/api\/community(\/|$)/];
+/*
+  EL AVISO DE LA PASARELA NO SE PARSEA ACA.
+
+  La firma se comprueba sobre los BYTES que mandó la pasarela. Si
+  `express.json` los parsea antes, lo unico que queda es volver a
+  serializar el objeto, que NO da los mismos bytes: los avisos buenos se
+  rechazan con 401 y ningun deposito se acredita.
+*/
+const SIN_PARSEAR = [/^\/api\/hooks(\/|$)/];
 const cuerpoChico = express.json({ limit: "200kb" });
 const cuerpoGrande = express.json({ limit: "12mb" });
 
 app.use((req, res, next) => {
+  if (SIN_PARSEAR.some((r) => r.test(req.path))) return next();
   const grande = SUBEN_ARCHIVOS.some((r) => r.test(req.path));
   return (grande ? cuerpoGrande : cuerpoChico)(req, res, next);
 });
```

Y en el handler, hacer explícito que sin Buffer no se sigue:

```diff
--- a/backend/routes/wallet/index.js
+++ b/backend/routes/wallet/index.js
@@
 aviso.post("/oxapay", express.raw({ type: "*/*" }), async (req, res) => {
-  const crudo = req.body instanceof Buffer ? req.body.toString("utf8") : JSON.stringify(req.body || {});
+  /* Sin los bytes crudos no hay nada que comprobar: no se adivina. */
+  if (!(req.body instanceof Buffer)) {
+    logger.error("[oxapay] el aviso llego parseado: la firma no se puede comprobar");
+    return res.status(500).json({ success: false });
+  }
+  const crudo = req.body.toString("utf8");
```

### Cómo verificar

Repetir el script: los casos A, B y D tienen que dar 200 y el caso C (firma sobre otra cosa) tiene
que dar 401.

---

## PAGO-04 — `OXAPAY_CALLBACK_URL` apunta a una ruta que no existe

- **Severidad**: Alta
- **Categoría**: Configuración / integración
- **Archivo**: `backend/.env.example:49-50`, `backend/.env:23`, `backend/routes/index.js:27`, `backend/services/cashier/oxapay.js:92`
- **Confianza**: Alta — **probado en vivo**
- **Esfuerzo**: Trivial

### Descripción

La variable que se le manda a OxaPay en cada pedido de dirección es:

```
OXAPAY_CALLBACK_URL=https://mrbox.gg/api/payments/oxapay/callback
```

y se usa en `oxapay.js:92` (`callback_url: process.env.OXAPAY_CALLBACK_URL || undefined`). Pero el
router del aviso está montado en otro lado:

```js
router.use("/hooks", require("./wallet").aviso);   // backend/routes/index.js:27
```

No existe ningún `/api/payments`. Probado contra el servidor local:

```
POST /api/payments/oxapay/callback  ->  404
POST /api/hooks/oxapay              ->  401 (firma faltante, o sea la ruta existe)
```

`docs/HUECOS.md` repite la URL equivocada (*"La URL de callback ya la pusiste bien"*), así que es
probable que también esté mal cargada en el panel de OxaPay.

### Impacto concreto

En producción, OxaPay avisa a una URL que devuelve 404 con un cuerpo JSON de error. **Ningún
depósito se acredita.** El jugador paga, la plata entra a la cuenta de OxaPay y el saldo nunca
aparece. Es el mismo síntoma que PAGO-03 y se suman.

### Arreglo propuesto

Dos opciones; la segunda es la que no depende de que nadie se acuerde:

```diff
--- a/backend/.env.example
+++ b/backend/.env.example
-OXAPAY_CALLBACK_URL=https://mrbox.gg/api/payments/oxapay/callback
+#  Tiene que ser EXACTAMENTE la ruta donde esta montado el aviso
+#  (ver backend/routes/index.js: router.use("/hooks", ...)).
+OXAPAY_CALLBACK_URL=https://mrbox.gg/api/hooks/oxapay
```

```diff
--- a/backend/routes/index.js
+++ b/backend/routes/index.js
 router.use("/hooks", require("./wallet").aviso);
+/* Alias historico: la URL vieja que quedo cargada en el panel de OxaPay. */
+router.use("/payments/oxapay/callback", require("./wallet").aviso);
```

(Si se usa el alias, el sub-path del router es `/oxapay`, así que conviene montarlo como
`router.use("/payments", require("./wallet").aviso)` y que la URL sea `/api/payments/oxapay`.)

Mejor todavía: arrancar comprobando que la ruta que dice `OXAPAY_CALLBACK_URL` existe de verdad, y
loguear a los gritos si no.

### Cómo verificar

`curl -s -o /dev/null -w "%{http_code}" -X POST <OXAPAY_CALLBACK_URL>` tiene que dar **401**
(firma faltante), nunca 404.

---

## PAGO-05 — Un depósito que falla al acreditar queda bloqueado para siempre

- **Severidad**: Alta
- **Categoría**: Lógica de negocio / integridad del dinero
- **Archivo**: `backend/routes/wallet/index.js:383-420`
- **Confianza**: Alta
- **Esfuerzo**: Medio

### Descripción

La marca anti-replay se escribe **antes** de mover la plata (y eso está bien), pero si algo falla
después, la marca queda:

```js
    let marca;
    try {
      marca = await DepositoAvisado.create({ trackId, pasarela: "oxapay", user: userId, montoSc: monto });
    } catch (err) {
      if (err && err.code === 11000) return res.json({ success: true, repetido: true });
      throw err;
    }
    ...
    await wallet.mover({ ... });                                   // <-- si esto tira
    await DepositoAvisado.updateOne({ _id: marca._id }, { $set: { acreditado: true } });
  } catch (err) {
    logger.error("[oxapay] aviso:", err.message);
    return res.status(500).json({ success: false });               // <-- OxaPay reintenta
  }
```

El 500 hace que OxaPay reintente, pero el reintento choca con el índice único y contesta
`{repetido: true}` **sin acreditar**. La fila queda con `acreditado: false` para siempre.

El comentario del modelo dice *"queda acá en `false` y se ve en el panel"*
(`backend/database/models/DepositoAvisado.js:24-25`), pero eso **no existe**: un grep de
`DepositoAvisado` en todo el backend solo devuelve el modelo y el propio handler. Ninguna pantalla
del panel la lee, ningún proceso la repara.

### Impacto concreto

Cualquier error transitorio entre la marca y el movimiento (la base se cae un segundo, el bono de
afiliado tira, `Settings.leer()` falla, el proceso se reinicia justo ahí) deja un depósito pago sin
acreditar y sin forma automática de recuperarlo. El jugador reclama, y la única salida es entrar a
la base a mano. Se agrava con PAGO-02: un depósito en BTC con `monto = 0` corta antes de la marca,
pero uno que redondea a 0 después de `sc()` ya la dejó escrita.

### Arreglo propuesto

```diff
--- a/backend/routes/wallet/index.js
+++ b/backend/routes/wallet/index.js
@@
     } catch (err) {
       if (err && err.code === 11000) {
-        return res.json({ success: true, repetido: true });
+        /*
+          Ya hay marca. Si ademas esta acreditado, es un reintento normal
+          y no se hace nada. Si NO esta acreditado, el intento anterior se
+          corto en el medio: se sigue, y lo que impide pagar dos veces es
+          el `findOneAndUpdate` de abajo.
+        */
+        const previa = await DepositoAvisado.findOneAndUpdate(
+          { trackId, acreditado: false, enCurso: { $ne: true } },
+          { $set: { enCurso: true } },
+          { new: true }
+        );
+        if (!previa) return res.json({ success: true, repetido: true });
+        marca = previa;
+      } else {
+        throw err;
       }
-      throw err;
     }
```

…y en el `catch` final, marcar la fila como fallida (`$set: { enCurso: false, error: err.message }`)
para que el reintento la vuelva a tomar. Complementario: una pantalla del panel que liste
`DepositoAvisado.find({ acreditado: false })` con un botón "acreditar a mano", que es lo que el
comentario del modelo ya promete.

### Cómo verificar

En local, forzar que `wallet.mover` tire una vez (por ejemplo con una base detenida un instante),
mandar el mismo aviso firmado dos veces, y comprobar que el segundo sí acredita.

---

## PAGO-06 — Sin doble aprobación: el mismo admin aprueba y paga

- **Severidad**: Media
- **Categoría**: Control interno / AML
- **Archivo**: `backend/services/cashier/index.js:355-388`, `backend/routes/admin/extra.js:151-172`
- **Confianza**: Alta
- **Esfuerzo**: Bajo

### Descripción

`resolver()` permite que la misma persona haga `approve` y después `pay`:

```js
  if (accion === "approve") {
    const aprobado = await Redemption.findOneAndUpdate(
      { _id: pedido._id, estado: "pending" },
      { $set: { estado: "approved", revisadoPor: admin._id, revisadoEl: new Date() } },
```

```js
    const tomado = await Redemption.findOneAndUpdate(
      { _id: pedido._id, estado: "approved" },
      { $set: { estado: "paid", revisadoPor: admin._id, revisadoEl: new Date() } },
```

No hay ninguna comprobación de que `admin._id` sea distinto del que aprobó (de hecho `revisadoPor`
se **pisa**, así que después del pago ni siquiera queda registrado quién había aprobado; eso solo
sobrevive en `AdminLog`). Tampoco hay tope de monto que exija un segundo par de ojos.

### Impacto concreto

Una sola cuenta de `admin` comprometida (o un empleado desleal) puede crear un canje a su propia
dirección y moverlo `pending → approved → paid` sin que nadie más intervenga. En un sitio de dinero
real con payouts en cripto —irreversibles— esto es el control interno más importante que falta.

### Arreglo propuesto

```diff
--- a/backend/database/models/Redemption.js
+++ b/backend/database/models/Redemption.js
+    aprobadoPor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
+    pagadoPor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
```

```diff
--- a/backend/services/cashier/index.js
+++ b/backend/services/cashier/index.js
+/* Arriba de esto, pagar pide que lo aprueben y lo paguen dos personas. */
+const CUATRO_OJOS_DESDE_SC = 100;
@@
   if (accion === "approve") {
     const aprobado = await Redemption.findOneAndUpdate(
       { _id: pedido._id, estado: "pending" },
-      { $set: { estado: "approved", revisadoPor: admin._id, revisadoEl: new Date() } },
+      { $set: { estado: "approved", revisadoPor: admin._id, aprobadoPor: admin._id, revisadoEl: new Date() } },
@@
   if (accion === "pay") {
     if (pedido.estado !== "approved") throw errorDe("ALREADY_CLAIMED");
+    /*
+      EL QUE APROBO NO ES EL QUE PAGA.
+
+      Un canje grande lo tienen que tocar dos personas: con una sola
+      cuenta de admin tomada, la plata sale sin que nadie mas la vea.
+    */
+    if (sc(pedido.montoSc) >= CUATRO_OJOS_DESDE_SC
+      && String(pedido.aprobadoPor || "") === String(admin._id)) {
+      throw errorDe("NOT_ON_YOURSELF", {}, 403);
+    }
@@
     const tomado = await Redemption.findOneAndUpdate(
       { _id: pedido._id, estado: "approved" },
-      { $set: { estado: "paid", revisadoPor: admin._id, revisadoEl: new Date() } },
+      { $set: { estado: "paid", revisadoPor: admin._id, pagadoPor: admin._id, revisadoEl: new Date() } },
```

### Cómo verificar

Con dos cuentas de admin: la que aprueba no puede pagar un canje de SC 100 o más (403), y la otra sí.

---

## PAGO-07 — La dirección de pago se valida solo por largo y espacios

- **Severidad**: Media
- **Categoría**: Validación de entrada / pérdida de fondos
- **Archivo**: `backend/services/cashier/index.js:157-163`
- **Confianza**: Alta
- **Esfuerzo**: Bajo

### Descripción

```js
  const limpia = String(direccion || "").trim();
  /* Una dirección de cripto no tiene espacios y no es corta. No se
     valida más que eso a propósito: cada cadena tiene su formato y una
     expresión regular desactualizada rebota pagos buenos. */
  if (limpia.length < 20 || limpia.length > 200 || /\s/.test(limpia)) {
    throw errorDe("INVALID_AMOUNT", { campo: "direccion" });
  }
```

El razonamiento del comentario es defendible, pero el resultado es que **nada** comprueba que la
dirección corresponda a la red elegida. `buscar(ticker, red)` valida que el par moneda/red exista
en el catálogo, no que la dirección sea de esa cadena. Una dirección de Tron (`T...`) con red
`ERC20`, o una de BTC con red `Solana`, pasa sin problema. Tampoco hay lista negra ni comprobación
de que la dirección no sea una de las de depósito del propio sitio.

### Impacto concreto

Un jugador que se equivoca de red pierde el canje: OxaPay acepta el payout (la dirección es
sintácticamente plausible) y la plata se manda a una cadena donde esa dirección no existe o no la
controla nadie. Es irrecuperable y el saldo ya se descontó. También habilita el clásico
"pegué la dirección de otra billetera" sin ningún aviso.

### Arreglo propuesto

Validación por familia de cadena, laxa pero no inexistente, y chequeo con la pasarela antes de pagar:

```diff
--- a/backend/services/cashier/monedas.js
+++ b/backend/services/cashier/monedas.js
+/*
+  LA FORMA DE UNA DIRECCION, POR FAMILIA DE CADENA.
+
+  No valida el checksum --eso lo hace la pasarela-- pero si impide lo
+  que mas pasa: pegar una direccion de otra red. Una direccion de Tron
+  en Ethereum es plata tirada.
+*/
+const FORMAS = {
+  TRC20: /^T[1-9A-HJ-NP-Za-km-z]{33}$/,
+  ERC20: /^0x[a-fA-F0-9]{40}$/,
+  BEP20: /^0x[a-fA-F0-9]{40}$/,
+  Polygon: /^0x[a-fA-F0-9]{40}$/,
+  Base: /^0x[a-fA-F0-9]{40}$/,
+  Solana: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
+  BTC: /^(bc1[a-z0-9]{25,62}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/,
+  LTC: /^(ltc1[a-z0-9]{25,62}|[LM3][a-km-zA-HJ-NP-Z1-9]{26,33})$/,
+  Dogecoin: /^D[5-9A-HJ-NP-U][1-9A-HJ-NP-Za-km-z]{32}$/,
+  xrpl: /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/,
+  Monero: /^4[0-9AB][1-9A-HJ-NP-Za-km-z]{93}$/,
+  TON: /^[A-Za-z0-9_-]{48}$/,
+};
+function formaOk(redClave, direccion) {
+  const re = FORMAS[Object.keys(FORMAS).find((k) => k.toUpperCase() === String(redClave).toUpperCase())];
+  return re ? re.test(direccion) : true;   /* red nueva sin forma conocida: no se rebota */
+}
-module.exports = { MONEDAS, buscar };
+module.exports = { MONEDAS, buscar, formaOk };
```

```diff
--- a/backend/services/cashier/index.js
+++ b/backend/services/cashier/index.js
   if (limpia.length < 20 || limpia.length > 200 || /\s/.test(limpia)) {
     throw errorDe("INVALID_AMOUNT", { campo: "direccion" });
   }
+  if (!formaOk(par.red.clave, limpia)) {
+    throw errorDe("INVALID_AMOUNT", { campo: "direccion", red: par.red.clave });
+  }
```

### Cómo verificar

Pedir un canje en `ERC20` con una dirección `T...` de Tron: tiene que rebotar con
`INVALID_AMOUNT { campo: "direccion", red: "ERC20" }`.

---

## PAGO-08 — `OXAPAY_CALLBACK_SECRET` vacío: cae a la clave de comercio

- **Severidad**: Baja
- **Categoría**: Configuración
- **Archivo**: `backend/services/cashier/oxapay.js:137`, `backend/.env:22`, `backend/.env.example:45-47`
- **Confianza**: Alta

### Descripción

```js
  const clave = process.env.OXAPAY_CALLBACK_SECRET || claveDeComercio();
  if (!clave || !firma) return false;
```

En `backend/.env` la variable existe pero está **vacía** (largo 0), así que hoy se verifica con la
clave de comercio. Eso coincide con cómo firma OxaPay, pero `backend/.env.example:45-47` describe
`OXAPAY_CALLBACK_SECRET` como un secreto propio (*"Lo que OxaPay firma en cada aviso"*), lo que
invita a poner ahí cualquier cadena al azar al desplegar. El día que alguien la complete con un
valor inventado, **todos los avisos pasan a dar 401** y ningún depósito se acredita (otra vez el
mismo síntoma que PAGO-03 y PAGO-04).

Fallar cerrado está bien; lo que está mal es que el `.env.example` empuje a la configuración
equivocada y que el fallo sea silencioso para el equipo.

### Arreglo propuesto

```diff
--- a/backend/.env.example
+++ b/backend/.env.example
-#  Lo que OxaPay firma en cada aviso de pago, para comprobar que el aviso
-#  viene de ellos y no de alguien que descubrió la dirección.
-OXAPAY_CALLBACK_SECRET=
+#  Con qué viene firmado el aviso de pago. OxaPay firma los avisos de
+#  cobro con la MISMA clave de comercio de arriba, así que esto se deja
+#  VACIO salvo que ellos digan otra cosa. Poner acá un texto inventado
+#  hace que todos los avisos se rechacen y ningún depósito se acredite.
+OXAPAY_CALLBACK_SECRET=
```

Y avisar al arrancar:

```diff
--- a/backend/services/cashier/oxapay.js
+++ b/backend/services/cashier/oxapay.js
+if (process.env.OXAPAY_CALLBACK_SECRET && process.env.OXAPAY_CALLBACK_SECRET !== claveDeComercio()) {
+  logger.warn("[oxapay] OXAPAY_CALLBACK_SECRET distinto de la clave de comercio: si no es el que usa OxaPay, ningun aviso va a pasar");
+}
```

---

## EUPAY-01 — No existe ninguna integración EUPay en el repositorio

- **Severidad**: Info
- **Confianza**: Alta

Se buscó `eupay`, `eu_pay`, `eu-pay`, `card_number`, `3ds`, `checkout.` sin distinguir mayúsculas
en **todo** el árbol (incluidos `node_modules`, `.git`, `docs/`, `.env`, `.env.example` y el
`dist/` del frontend). **Cero resultados** fuera de un falso positivo en un hash base64 de
`frontend/package-lock.json`.

Tampoco hay:

- ninguna variable `EUPAY_*` en `backend/.env` (21 líneas, revisadas una por una) ni en `.env.example`;
- ninguna ruta, servicio ni modelo de tarjeta: la única pasarela montada es OxaPay
  (`backend/routes/index.js:27`), y `backend/services/cashier/` solo tiene `index.js`,
  `monedas.js` y `oxapay.js`;
- ninguna mención en `docs/ESPECIFICACION.md` ni `docs/HUECOS.md` (que sí listan OxaPay como el
  hueco número 1: *"No se puede meter plata"*).

**Conclusión**: no hay nada a medias que pueda introducir riesgo al desplegar, porque no hay nada.
Si existe una rama o una copia local con EUPay, no está en este repositorio ni en su historial, y
habría que auditarla aparte. Vale la advertencia de siempre: el día que entre tarjeta, entra PCI —
nada de número de tarjeta tocando este servidor, solo campos alojados o redirección del proveedor.

---

## INFRA-01 — CORS queda en comodín si falta `SITIO_URL`

- **Severidad**: Alta
- **Categoría**: Configuración
- **Archivo**: `backend/index.js:50-55`
- **Confianza**: Alta — **probado en vivo**
- **Esfuerzo**: Trivial

### Descripción

```js
const ORIGENES = String(process.env.SITIO_URL || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors(ORIGENES.length ? { origin: ORIGENES } : {}));
```

`cors({})` es `origin: "*"`. Si `SITIO_URL` falta, está vacía o se escribe mal (`SITE_URL`,
`SITIO_URLS`, una coma suelta), el sitio **abre la API a cualquier origen sin ningún aviso**. Hoy
mismo, en el servidor de desarrollo, la respuesta trae `Access-Control-Allow-Origin: *` (capturado
en la prueba del webhook), y `backend/.env` no define `SITIO_URL`.

No se usa `credentials: true` y la sesión viaja en la cabecera `x-auth-token`, así que esto **no**
es un CSRF — el comentario del código tiene razón en eso. El problema es otro: es un fallo
**abierto**, en la variable más fácil de olvidar al desplegar.

### Impacto concreto

Con el comodín, cualquier página puede leer las respuestas de la API desde el navegador de un
jugador si consigue su token (XSS en un subdominio, una extensión, un token pegado en un chat de
soporte), y cualquier frontend clonado puede usar la API de producción directamente, que es la base
de un sitio de phishing convincente. Y como falla abierto, nadie se entera.

### Arreglo propuesto

```diff
--- a/backend/index.js
+++ b/backend/index.js
 const ORIGENES = String(process.env.SITIO_URL || "")
   .split(",")
   .map((o) => o.trim())
   .filter(Boolean);
 
-app.use(cors(ORIGENES.length ? { origin: ORIGENES } : {}));
+/*
+  EN PRODUCCION NO SE ABRE A CUALQUIERA.
+
+  Sin `SITIO_URL` esto dejaba pasar a todos los origenes, que es lo que
+  hace falta en desarrollo y lo ultimo que uno quiere en produccion. La
+  variable mas facil de olvidar al desplegar no puede ser la que abre la
+  puerta: si falta y estamos en produccion, el servidor no arranca.
+*/
+const enProduccion = process.env.NODE_ENV === "production";
+if (enProduccion && !ORIGENES.length) {
+  throw new Error("Falta SITIO_URL: en produccion la API no se abre a cualquier origen.");
+}
+app.use(cors(ORIGENES.length ? { origin: ORIGENES } : {}));
+if (!ORIGENES.length) logger.warn("[cors] sin SITIO_URL: cualquier origen puede llamar a la API");
```

### Cómo verificar

`curl -s -D- -o /dev/null -H "Origin: https://evil.example" https://<sitio>/api/health | grep -i access-control-allow-origin`
no tiene que devolver `*` ni `https://evil.example`.

---

## INFRA-02 — `X-Forwarded-For` falseable: evade el rate limit y ensucia las señales de riesgo

- **Severidad**: Media
- **Categoría**: Configuración / antifraude
- **Archivo**: `backend/index.js:36`, `backend/routes/auth/index.js:43-49,101,205`, `backend/services/admin/index.js:37`
- **Confianza**: Alta — **probado en vivo**
- **Esfuerzo**: Bajo

### Descripción

```js
app.set("trust proxy", 1);
```

Con `trust proxy: 1`, Express toma como `req.ip` la última entrada de `X-Forwarded-For`. Eso es
**correcto** si y solo si el servidor es inalcanzable salvo a través de **exactamente un** proxy que
reescriba esa cabecera (el caso de Render a secas). Deja de serlo si alguien llega directo al
origen (el `*.onrender.com`, el puerto del contenedor, un túnel) o si mañana se pone otro salto
delante (Cloudflare, un balanceador): ahí la cabecera la escribe el cliente.

### Prueba en vivo (ejecutada contra `127.0.0.1:5001`)

```
400 400 400 400 400 400 400 400 400 400 429 429   <= 12 intentos con X-Forwarded-For: 10.0.0.1
429 429 429                                        <= la misma IP sigue bloqueada
400 400 400 400 400                                <= IPs 10.0.0.2 … 10.0.0.6: contador en cero
```

El límite de `/api/auth/login` (10 por 15 minutos) se reinicia con solo cambiar un número en la
cabecera. (Se usaron logins sin captcha contra un email inexistente: fallan antes de tocar la base
y sin ninguna llamada saliente.)

### Impacto concreto

1. **Fuerza bruta de contraseñas y registro masivo** sin límite efectivo, si el origen es
   alcanzable sin pasar por el proxy.
2. **Las señales de riesgo se pueden burlar y envenenar**: `req.ip` es lo que se guarda en
   `SessionEvent` (`routes/auth/index.js:101`, que es lo que el jugador ve en la pestaña Activity)
   y en el `AdminLog` (`services/admin/index.js:37`), y el panel de riesgo agrupa cuentas por IP
   (`routes/admin/extra.js`, `porIp`). Una granja de multicuentas elige una IP distinta por cuenta
   y nunca cae en el grupo; y al revés, se le puede plantar a un jugador honesto un inicio de sesión
   desde la IP de otro.
3. La IP falseada también viaja a Cloudflare como `remoteip` del captcha.

### Arreglo propuesto

Lo correcto es **no confiar en un número de saltos**, sino en quién es el proxy:

```diff
--- a/backend/index.js
+++ b/backend/index.js
-app.set("trust proxy", 1);
+/*
+  EN QUIEN SE CONFIA PARA SABER DE DONDE VIENE EL PEDIDO.
+
+  `trust proxy` en 1 da por buena la ultima entrada de X-Forwarded-For.
+  Eso solo vale si NADIE puede llegar al origen sin pasar por el proxy:
+  si se llega directo --el *.onrender.com, el puerto del contenedor-- o
+  si mañana hay dos saltos, la cabecera la escribe el que ataca, y con
+  cambiarle un numero se reinicia el limite de intentos y se esquivan las
+  señales de "misma IP" del panel de riesgo.
+
+  Se listan los proxies de verdad. Sin la variable, no se confia en nadie.
+*/
+const PROXIES = String(process.env.PROXIES_DE_CONFIANZA || "")
+  .split(",").map((p) => p.trim()).filter(Boolean);
+app.set("trust proxy", PROXIES.length ? PROXIES : false);
```

Si el despliegue es Render a secas, `PROXIES_DE_CONFIANZA=loopback,linklocal,uniquelocal` alcanza.
Complementos: bloquear en el proveedor el acceso directo al origen, y sumar al rate limit del login
una segunda clave por email/usuario además de la IP, que no se puede falsear.

### Cómo verificar

Repetir la tanda de arriba: después de 10 intentos, cambiar `X-Forwarded-For` **no** tiene que
devolver 400; tiene que seguir dando 429.

---

## INFRA-03 — CSP apagado y sin `Permissions-Policy`

- **Severidad**: Media
- **Categoría**: Cabeceras de seguridad
- **Archivo**: `backend/index.js:82`
- **Confianza**: Alta
- **Esfuerzo**: Medio

### Descripción

```js
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
```

Cabeceras que **sí** salen (capturadas en vivo): `Strict-Transport-Security: max-age=31536000;
includeSubDomains`, `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`,
`Referrer-Policy: no-referrer`, `Cross-Origin-Opener-Policy: same-origin`,
`Cross-Origin-Resource-Policy: same-origin`, `Origin-Agent-Cluster: ?1`,
`X-DNS-Prefetch-Control: off`, `X-Download-Options: noopen`,
`X-Permitted-Cross-Domain-Policies: none`.

Faltan: **`Content-Security-Policy`** (apagado a propósito), `Cross-Origin-Embedder-Policy`
(apagado a propósito) y `Permissions-Policy` (helmet no la pone nunca).

### Evaluación del CSP apagado

El razonamiento del comentario —*"un CSP que hay que apagar a mano en desarrollo es un CSP que
alguien va a dejar apagado en producción"*— es correcto como diagnóstico y equivocado como
conclusión: la respuesta no es no tener CSP, es tener **dos** políticas, la de desarrollo y la de
producción, elegidas por `NODE_ENV`. En un sitio con saldo real y retiros, el CSP es la última red
cuando aparece un XSS (el feed de la comunidad, los nombres de cajas creadas por jugadores, el chat
de soporte, un `innerHTML` en Vue 2): sin él, un XSS lee el token de `x-auth-token` y pide un canje.

`X-Frame-Options: SAMEORIGIN` ya cubre el clickjacking que menciona el comentario, así que eso está
bien resuelto. Lo que falta es el control de scripts.

### Arreglo propuesto

```diff
--- a/backend/index.js
+++ b/backend/index.js
-app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
+/*
+  EL CSP VA EN PRODUCCION, NO EN DESARROLLO.
+
+  El servidor de Vue usa `eval` y estilos en linea, asi que ahi queda
+  apagado; en produccion, donde se sirve el `dist` construido, va
+  prendido. Dos politicas y no una que hay que acordarse de prender: el
+  `else` es el que protege.
+*/
+const enProduccion = process.env.NODE_ENV === "production";
+
+app.use(helmet({
+  crossOriginEmbedderPolicy: false,
+  contentSecurityPolicy: enProduccion && {
+    useDefaults: true,
+    directives: {
+      "default-src": ["'self'"],
+      "script-src": ["'self'", "https://challenges.cloudflare.com"],
+      "frame-src": ["https://challenges.cloudflare.com"],
+      "style-src": ["'self'", "'unsafe-inline'"],   /* Vue 2 inyecta estilos en linea */
+      "img-src": ["'self'", "data:", "blob:"],      /* las fotos del documento viajan como data: */
+      "connect-src": ["'self'"],
+      "object-src": ["'none'"],
+      "base-uri": ["'self'"],
+      "form-action": ["'self'"],
+      "frame-ancestors": ["'none'"],
+      "upgrade-insecure-requests": [],
+    },
+  },
+}));
+
+/* Lo que el sitio no usa, apagado. helmet no la pone. */
+app.use((req, res, next) => {
+  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
+  next();
+});
```

Camino recomendado: desplegar primero con `Content-Security-Policy-Report-Only` y un endpoint de
reporte, mirar una semana, y recién ahí pasar a modo bloqueo.

### Cómo verificar

`curl -sD- -o /dev/null https://<sitio>/` con `NODE_ENV=production` tiene que traer
`Content-Security-Policy` y `Permissions-Policy`; el sitio construido tiene que funcionar completo
(captcha incluido) sin violaciones en la consola.

---

## INFRA-04 — El 404 refleja la ruta pedida

- **Severidad**: Baja
- **Categoría**: Fuga de información
- **Archivo**: `backend/index.js:139`
- **Confianza**: Alta
- **Esfuerzo**: Trivial

```js
app.use((req, res) => res.status(404).json(errorDe("SOMETHING_WENT_WRONG", { ruta: req.path }, 404).aRespuesta()));
```

Devuelve al cliente la ruta que pidió. No es XSS (la respuesta es `application/json` con
`nosniff`), y no revela nada que el cliente no supiera ya. Lo único real es que facilita el mapeo
automático de la API y que, si algún día alguien pega esa respuesta en un panel de soporte que
renderiza HTML, el contenido viene del atacante.

```diff
-app.use((req, res) => res.status(404).json(errorDe("SOMETHING_WENT_WRONG", { ruta: req.path }, 404).aRespuesta()));
+app.use((req, res) => res.status(404).json(errorDe("NOT_FOUND", {}, 404).aRespuesta()));
```

**Lo demás de errores está bien**: no se filtra ningún stack, ningún `err.message` crudo de Mongo
ni ninguna query. Se revisó cada `responderError` y el handler final.

---

## INFRA-05 — Falta `hpp` (impacto bajo)

- **Severidad**: Baja
- **Categoría**: Validación de entrada
- **Confianza**: Media
- **Esfuerzo**: Trivial

`hpp` no está instalado. El impacto real es chico por dos razones comprobadas:

1. Express 5 usa el parser de query `simple` por defecto, así que `?page[$gt]=1` es una clave
   literal, no un objeto: **no hay inyección de operadores de Mongo por la query**.
2. Los parámetros duplicados llegan como array y las conversiones los neutralizan:
   `Math.max(1, Number(["1","2"]) || 1)` da 1. Probado en vivo:
   `GET /api/boxes?page=1&page=2&perPage=2&sort[]=a` → **200**, `"page":1`, sin excepción.

Donde sí conviene mirar es en los `req.query.estado` que entran directo a un filtro de Mongo
(`backend/services/cashier/index.js:264-265`): con `?estado=a&estado=b` el filtro queda
`{estado: ["a","b"]}`, que no devuelve filas (no es inyección, pero es una lista vacía silenciosa).

```diff
--- a/backend/index.js
+++ b/backend/index.js
+const hpp = require("hpp");
@@
 app.use(compression());
+/* Un parametro repetido llega como array y termina en un filtro de la
+   base. Se queda el ultimo, que es lo que cualquiera espera. */
+app.use(hpp());
```

…o, sin dependencia nueva, `String(req.query.estado || "")` en cada uso.

---

## SEC — Secretos y repositorio

### SEC-01 — Claves reales de OxaPay (incluida la de pagos) en el `.env` de desarrollo

- **Severidad**: Baja (sube a Alta si esa máquina se comparte o se respalda a la nube)
- **Archivo**: `backend/.env:20-21`
- **Confianza**: Alta

| Línea | Variable | Tipo | Valor enmascarado | Largo |
|---|---|---|---|---|
| `backend/.env:1` | `DATABASE_URI` | URI de Mongo local | `mong****` | 37 |
| `backend/.env:3` | `JWT_SECRET` | secreto de firma de sesiones | `mrbo****` | 58 |
| `backend/.env:18` | `TURNSTILE_SECRET_KEY` | clave de **prueba** pública de Cloudflare (`1x00****`) | no es secreto | 35 |
| `backend/.env:20` | `OXAPAY_MERCHANT_KEY` | **clave de comercio real** | `3LOF****LBBL` | 27 |
| `backend/.env:21` | `OXAPAY_PAYOUT_KEY` | **clave de pagos real** | `1H3W****` | 27 |
| `backend/.env:22` | `OXAPAY_CALLBACK_SECRET` | vacío (ver PAGO-08) | — | 0 |
| `backend/.env:23` | `OXAPAY_CALLBACK_URL` | URL equivocada (ver PAGO-04) | `http****` | 33 |

El propio `.env.example` lo dice: la clave de pagos *"es la que mueve plata hacia afuera, así que es
la más delicada de todas"*. No hay ninguna razón para que esté en una máquina de desarrollo: el
sitio está diseñado para andar solo con la de comercio (`oxapay.js:11-25`). También conviene
cambiar el `JWT_SECRET` de desarrollo (empieza con el nombre del proyecto; adivinable).

**Recomendación**: sacar `OXAPAY_PAYOUT_KEY` del `.env` local, rotarla en el panel de OxaPay y
dejarla solo en las variables de entorno del servidor; en desarrollo, usar la clave de prueba o
ninguna (`listaParaPagar()` ya contempla que falte).

### SEC-02 — `backend/scripts/tmp/inv.js` quedó en el historial de git

- **Severidad**: Baja (higiene)
- **Confianza**: Alta

Un script de depuración de un rato se commiteó en `b7c90f7` y se borró en `153b8f3` *("Afuera los
scripts de un rato")*. Ya no está rastreado y `backend/scripts/tmp/` está en `.gitignore`, pero
sigue recuperable del historial. Contenido revisado: solo `mongodb://127.0.0.1:27017/mrbox_local` y
tres nombres de usuario de prueba (`hello1`, `dani`, `kaylope`). **No hay secretos.** No hace falta
reescribir el historial; sirve como recordatorio de que `.gitignore` se puso después.

### SEC-03 — Conclusión sobre el historial de git: **nunca se filtró un secreto**

Comprobado:

- `git log --all --full-history -- backend/.env` → **sin resultados**. El `.env` nunca se commiteó.
- `git log --all -S "<prefijo de la clave de comercio>"` y `-S "<prefijo de la clave de pagos>"` →
  **sin resultados** en ningún commit de ninguna rama.
- `git log -p --all -S "OXAPAY"` → solo comentarios y la lista de monedas; ningún valor de clave.
- `git log --all --full-history --name-only -- "*.env*" "*.xlsx" "*.sql" "*.dump" "*.log" "*backup*" "*tmp*"`
  → solo `backend/.env.example`, `frontend/.env.example` y el `inv.js` de SEC-02.
- `git ls-files` filtrado por `.xlsx|.csv|.sql|.dump|.bak|.log|.zip|.pem|.key|.p12|.ppk|backup|dump`
  → **nada**. Lo mismo recorriendo el disco fuera de `node_modules`: no hay volcados, planillas,
  logs ni respaldos.
- `.gitignore` cubre `node_modules/`, `dist/`, `.env`, `.env.*` (con `!.env.example`), `*.log`,
  `logs/`, `coverage/`, `__pycache__/` y `backend/scripts/tmp/`. Correcto.

### SEC-04 — `.env.example` y el frontend

- `backend/.env.example` **nombra las variables sin filtrar ningún valor** (todas vacías salvo
  `DATABASE_URI` local, `PORT` y la `OXAPAY_CALLBACK_URL`, que además está equivocada: PAGO-04).
  Documenta bien qué es público y qué no. Falta documentar `LOG_LEVEL` y `AUTH_RATE_LIMIT`, que el
  código lee pero el ejemplo no menciona.
- **El frontend no expone ninguna clave.** La única variable es
  `VUE_APP_TURNSTILE_SITE_KEY` (`frontend/src/views/AuthView.vue:218`), que es pública por diseño.
  `frontend/.env` no está rastreado y contiene la clave de prueba (`1x0000****`); en un comentario
  de ese archivo está escrita la site key **real** de Turnstile, que también es pública por
  definición, así que no es una filtración — pero conviene no acostumbrarse a dejar claves en
  comentarios.

---

## INFRA-06 — Dependencias (`npm audit`)

### `backend/` — **0 vulnerabilidades** (112 dependencias de producción)

```json
{"info":0,"low":0,"moderate":0,"high":0,"critical":0,"total":0}
```

Versiones instaladas: express 5.3.0, express-rate-limit 8.7.4, helmet 8.1.0, mongoose 9.12.2,
bcryptjs 3.0.3, jsonwebtoken 9.0.3. Al día.

### `frontend/` — **33 vulnerabilidades: 4 altas, 18 moderadas, 11 bajas**

Las 33 están en **devDependencies** (la cadena de `@vue/cli-service`, `jest` y `webpack-dev-server`);
de las 72 dependencias de producción, ninguna aparece con vulnerabilidad propia salvo `vue` por
ReDoS en el compilador de plantillas.

| Severidad | Paquete | Problema | Arreglo |
|---|---|---|---|
| **Alta** | `webpack-dev-server` | el código fuente se puede robar visitando un sitio malicioso mientras corre el servidor de desarrollo | `npm audit fix` (sin romper nada) |
| **Alta** | `webpack-dev-middleware` | path traversal con `publicPath` sin barra final | `npm audit fix` |
| **Alta** | `serialize-javascript` | RCE vía `RegExp.flags` / `Date.prototype.toISOString` | requiere major de `@vue/cli-plugin-unit-jest` |
| **Alta** | `postcss` | error de parseo de retornos de línea; XSS vía `</style>` sin escapar | requiere major |
| Moderada | `vue-template-compiler` | XSS del lado del cliente | requiere major |
| Moderada | `minimatch`, `glob`, `uuid`, `sockjs`, `js-beautify`, `editorconfig`, `copy-webpack-plugin`, `css-minimizer-webpack-plugin`, `@vue/*` | DoS por amplificación, bypass de AbortSignal, bounds check | mezcla de `audit fix` y majors |
| Baja | `jest` y su cadena (`jsdom`, `http-proxy-agent`, `@tootallnate/once`), `vue`, `vuex` | varias | majors |

**Riesgo real**: moderado y acotado a las máquinas de desarrollo y al pipeline de build — nada de
esto se sirve al navegador del jugador, salvo `vue`/`vue-template-compiler`, que sí se compilan
adentro del bundle. El `webpack-dev-server` alto importa de verdad si alguien levanta `npm run
serve` y navega por internet en la misma sesión.

**Recomendación**: correr `npm audit fix` en `frontend/` (resuelve `webpack-dev-server`,
`webpack-dev-middleware`, `minimatch`, `glob`, `uuid`, `sockjs`, `js-beautify`, `copy-webpack-plugin`
sin cambios mayores) y planificar aparte la migración de Vue CLI a Vite, que es lo que cierra el
resto. No tocar nada de esto el mismo día que se despliega.

### Paquetes "placeholder": **no hay**

Ni `fs`, ni `http`, ni `path`, ni `https`, ni `crypto-js`, ni `base64-img` figuran en
`backend/package.json` ni en `frontend/package.json`. Las dependencias declaradas son todas
conocidas y pertinentes.

---

## Orden sugerido para arreglar

1. **PAGO-01** y **PAGO-02** — la conversión de moneda, en las dos puntas. Son las dos que mueven
   plata de verdad y hoy están mal por órdenes de magnitud. Nada debería desplegarse con payouts
   habilitados hasta que esto esté.
2. **PAGO-04** y **PAGO-03** — sin la URL correcta y sin la firma sobre los bytes crudos, no se
   acredita un solo depósito. Son diez minutos cada uno.
3. **INFRA-01** — una línea, y es la diferencia entre una API cerrada y una abierta al mundo.
4. **PAGO-05**, **PAGO-06**, **PAGO-07**, **INFRA-02**, **INFRA-03**.
5. **PAGO-08**, **INFRA-04**, **INFRA-05**, **SEC-01** (rotar la clave de pagos), `npm audit fix`.
