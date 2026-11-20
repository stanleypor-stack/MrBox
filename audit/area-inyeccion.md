# MR BOX — Auditoría del área: inyecciones, validación de entrada, XSS, SSRF y subida de archivos

Fecha: 2026-11-19
Alcance: `C:\Users\Usuario\mrbox` (solo lectura) + requests reales contra `http://localhost:5001`.
Stack confirmado: Express 5.3.0, Mongoose 9.12.2, Vue 2.7.16 + vue-router 3.6.5, vue-i18n.
Sesiones de prueba: cuenta sembrada `almondy` (rank `user`) y `dani` (rank `owner`), con las
credenciales de desarrollo de `backend/scripts/sembrar.js:120`. Captcha de Turnstile en modo
"siempre pasa" (claves públicas de prueba de Cloudflare en el `.env` local).

---

## Resumen ejecutivo

El área está **mucho mejor de lo que suele estar un sitio de este tamaño**. No encontré
ninguna inyección NoSQL explotable, ningún XSS, ningún SSRF y ningún agujero en la subida
de archivos. Lo que queda son **un problema de disponibilidad (Media)** y un puñado de
cuestiones de robustez y endurecimiento (Baja/Info).

| ID | Título | Severidad | Confianza |
|----|--------|-----------|-----------|
| INY-01 | `POST /api/community/quote` acepta 12 MB sin sesión y sin freno | Media | Alta (probado) |
| INY-02 | Dos listas del panel sin tope de `perPage` | Baja | Alta (código + probado) |
| INY-03 | Open redirect por el `destino` de banners y promociones | Baja | Alta (probado) |
| INY-04 | Búsqueda de propiedades con clave del usuario → 500 | Baja | Alta (probado) |
| INY-05 | Operadores de Mongo aceptados en ids del cuerpo (endurecimiento) | Baja | Alta (código + probado) |
| INY-06 | Cuerpo excedido y errores de cast devuelven 500 en vez de 413/400 | Baja | Alta (probado) |
| INY-07 | KYC: se cree el tipo declarado del data-URI, no se mira el contenido | Info | Alta (probado) |
| INY-08 | No se limpia el EXIF de las fotos de KYC ni de los logos | Info | Alta (código) |
| INY-09 | `LIMPIAR.idiomas` devuelve el objeto del cuerpo tal cual → 500 | Info | Alta (probado) |
| INY-10 | `portadaLimpia` asigna con una clave del usuario sin guardia | Info | Alta (probado) |
| INY-11 | `GET /wallet/deposit` refleja el parámetro crudo en el error | Info | Alta (probado) |

---

## Áreas que están BIEN (verificadas, no son hallazgos)

### 1. Inyección NoSQL — no explotable en ninguna de las rutas de alto valor

Express 5 trae el parser de query en modo `simple` por defecto
(`backend/node_modules/express/lib/application.js:97` → `this.set('query parser', 'simple')`),
así que **`?campo[$ne]=x` no produce un objeto**: la clave llega literalmente como
`"campo[$ne]"` y se ignora. Comprobado:

```
GET /api/admin/players?rank[$ne]=zzz
→ 200, devuelve la lista SIN filtrar (req.query.rank es undefined)
```

El cuerpo JSON sí llega como objeto, pero todas las rutas que miré castean antes de consultar:

- **Login** (`backend/routes/auth/index.js:202-236`): `String(req.body.email||"")`,
  `String(req.body.password||"")`, y la comparación de nombre va con `collation`, no con regex.
  ```
  POST /api/auth/login {"email":{"$ne":null},"password":"x","captchaToken":"X.DUMMY.X"}
  → 401 {"success":false,"code":"BAD_CREDENTIALS","message":"Wrong email or password."}
  POST /api/auth/login {"email":{"$regex":"^a"},...}
  → 401 BAD_CREDENTIALS
  ```
- **Código promocional** (`backend/routes/wallet/index.js:288-311`): `codigoEscrito()` hace
  `String(texto||"").toUpperCase().replace(/[^A-Z0-9_-]/g,"").slice(0,24)` y en `/promo`
  además `.replace(/[^A-Z0-9]/g,"")`.
  ```
  POST /api/wallet/promo {"code":{"$ne":null}}    → 400 CODE_NOT_FOUND
  POST /api/wallet/promo {"code":{"$regex":"^A"}} → 400 CODE_NOT_FOUND
  POST /api/wallet/code  {"code":{"$gt":""}}      → 400 CODE_NOT_FOUND
  ```
  **No se puede enumerar códigos promocionales carácter por carácter.** Era el caso que más
  me preocupaba y está cerrado.
- **Buscador de jugadores del panel** (`backend/routes/admin/index.js:160-171`): el texto se
  escapa antes de meterlo en `$regex`
  (`texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")`). Lo mismo en `/admin/boxes:357`,
  `/admin/items:594`, `/boxes:63` y `/deals/items:41`.
- **GET /boxes** (`backend/routes/boxes/index.js:51-92`): `category` pasa por `String()`,
  `min`/`max` por `Number.isFinite`, `sort` contra una lista blanca, `page`/`perPage` con tope.

### 2. ReDoS — no hay

Todas las búsquedas escapan los metacaracteres antes de armar el `$regex`, así que el patrón
que llega a Mongo es literal. Probado con 5.000 caracteres y con un patrón anidado:

```
GET /api/admin/players?q=<5000 "a">                 → 200 en 33 ms
GET /api/boxes?search=<5000 "a">                    → 200 en 37 ms
GET /api/boxes?search=((((…200 veces…a…))))+        → 200 en 7 ms
GET /api/admin/support?q=<5000 "a">                 → 200 en 25 ms
```

La única regex del lado del servidor con cuantificador es la de KYC
(`backend/services/verification/index.js:73`), que es `[A-Za-z0-9+/=]+$`: una sola clase de
caracteres, anclada, sin anidamiento. Es lineal.

### 3. Topes de paginación — bien en todo lo del jugador y lo público

```
GET /api/profile/transactions?perPage=9999999 → perPage=100
GET /api/boxes/feed/latest?limit=9999999      → 50 items
GET /api/boxes?perPage=9999999                → perPage=60
GET /api/community/boxes?perPage=9999999      → perPage=48
GET /api/deals/items?perPage=9999999          → perPage=60
GET /api/inventory?perPage=9999999            → perPage=100
GET /api/admin/players?perPage=9999999        → perPage=200
GET /api/admin/movements?perPage=9999999      → perPage=200
GET /api/admin/activity?perPage=9999999       → perPage=200
GET /api/admin/support?perPage=9999999        → tope 100 (services/support/index.js:181)
GET /api/admin/logs?perPage=9999999           → tope 200
```
Las dos excepciones están en INY-02.

### 4. XSS — no hay ninguno

Grepeé `v-html`, `innerHTML`, `insertAdjacentHTML`, `document.write` y `outerHTML` en todo
`frontend/src/`. Los **nueve** `v-html` que quedan son todos `$t(...)` sobre claves de
traducción fijas, con parámetros que son números o constantes del servidor:

| Archivo:línea | Expresión | Quién controla el dato |
|---|---|---|
| `frontend/src/components/MbBilletera.vue:240` | `$t('wallet.sendOnly', { coin, net })` | lista fija en `backend/services/cashier/monedas.js` |
| `frontend/src/components/MbPedirEnvio.vue:196` | `$t('ship.doneBody', { code })` | id del pedido (hex) |
| `frontend/src/views/AuthView.vue:33,37,169,183` | `$t('auth.*')` | claves de idioma + número de `Settings` |
| `frontend/src/views/CreateBoxView.vue:136` | `$t('create.earnText')` | fijo |
| `frontend/src/views/DashboardView.vue:20` | `$t('dashboard.youKeep', { pct })` | `Math.round(parte*100)` |
| `frontend/src/views/HomeView.vue:94` | `$t('home.livePullsTwoLines')` | fijo |

**Ningún `v-html` toca un dato de jugador ni de panel.** El único `innerHTML` es
`frontend/src/views/AuthView.vue:258`, `this.$refs.captcha.innerHTML = ""` (vaciar un nodo).

**Confirmé que el arreglo del saludo de soporte está puesto**:
`frontend/src/components/MbSoporte.vue:30` ahora es
`{{ saludo.uno }}<br>{{ saludo.dos }}` — interpolación, no `v-html`.

El servidor **guarda HTML tal cual** en varios campos (ver abajo), pero todos se dibujan con
`{{ }}`, que Vue escapa:

| Campo | Qué guarda el servidor | Dónde se dibuja |
|---|---|---|
| asunto / texto de soporte | tal cual | `MbSoporte.vue:67,81` y `AdminSoporte.vue:50,82` → `{{ }}` |
| nombre / calle de una dirección | tal cual (recortado) | `AdminJugador.vue`, `MbPedirEnvio.vue` → `{{ }}` |
| nombre / canal de campaña de afiliado | tal cual (60/30 chars) | `AffiliatesView.vue`, `AdminSocio.vue` → `{{ }}` |
| nombre / descripción de caja de comunidad | tal cual (18/240 chars) | `CommunityView.vue:23` → `{{ c.name }}` |
| promociones (`titulo`, `texto`, `boton`) | tal cual | `PromotionsView.vue:25,26,28` → `{{ }}` |

Pruebas reales con `<img src=x onerror=alert(1)>`:

```
POST /api/auth/register   {"username":"<img src=x onerror=alert(1)>", …}
  → 400 {"code":"INVALID_AMOUNT","data":{"campo":"username"}}     (USUARIO_OK = /^[a-zA-Z0-9_]{3,20}$/)
POST /api/support/threads {"texto":"<img src=x onerror=alert(1)> asunto de prueba","nueva":true}
  → 200, "asunto":"<img src=x onerror=alert(1)> asunto de prueba"  (guardado crudo, se escapa al dibujar)
POST /api/profile/addresses {"nombre":"<img src=x onerror=alert(1)>", …}
  → 200, "nombre":"<img src=x onerror=alert(1)>"                   (ídem)
POST /api/affiliates/campaigns {"nombre":"<img src=x onerror=alert(1)>", …}
  → 200, "nombre":"<img src=x onerror=alert(1)>"                   (ídem)
POST /api/community {"name":"<img src=x>", …}
  → 200, "name":"<img src=x>", slug "img-src-x"                    (ídem)
```

Recomendación de fondo (no es un hallazgo abierto): dejar documentado que **el escape vive en
la plantilla**, para que el día que alguien agregue un `v-html` sobre `asunto` o `name` sepa
que ahí sí hay un XSS almacenado esperando.

### 5. `portadaLimpia` — el SVG NO pasa

`backend/services/community/index.js:210-216`:

```js
const logo = (valor) => {
  if (typeof valor !== "string") return "";
  if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(valor)) return "";
  if (valor.length > 2.9 * 1024 * 1024) return "";
  return valor;
};
```

Probado con `data:image/svg+xml;base64,<svg><script>alert(1)</script></svg>`, con
`data:text/html;base64,…`, con `color: "javascript:alert(1)"` y con `textura: "<script>"`.
Lo que quedó guardado (leído de vuelta con `GET /api/community/mine`):

```json
{"color":"#9b30ff","textura":"liso","estilo":2,"asoman":[],"logoIzquierdo":"","logoDerecho":""}
```

Todo rechazado y reemplazado por el valor por defecto. **Esta área está correcta.**

### 6. KYC / subida de archivos — el arreglo de la regex está bien y aguanta

`backend/services/verification/index.js:73`:
```js
const TIPOS_OK = /^data:(image\/(png|jpeg|webp)|application\/pdf);base64,[A-Za-z0-9+/=]+$/;
```
Probé seis formas de pasarla, todas rebotaron con `BAD_FILE_TYPE`:

```
data:image/svg+xml;base64,…                                   → 400 BAD_FILE_TYPE
data:text/html;base64,…                                       → 400 BAD_FILE_TYPE
data:image/png;charset=utf-8;base64,…                         → 400 BAD_FILE_TYPE
data:image/png;base64,QQ==data:text/html;base64,…             → 400 BAD_FILE_TYPE
data:image/png;base64,QQ\n==   (salto de línea en el base64)  → 400 BAD_FILE_TYPE
```
El grupo y el `$` de cierre hacen lo que el comentario dice que hacen.

**Tope de tamaño: existe y funciona.**
```
foto de ~9 MB  → 400 {"code":"FILE_TOO_BIG","data":{"campo":"foto","maximoMb":6}}
foto de ~8 MB  → 200 (aceptada; el tope real es 6 MB × 1,4 = 8,4 MB de cadena)
foto de ~13 MB → el cuerpo de 12 MB la corta antes (ver INY-06)
```

**Los documentos de KYC NO son accesibles por otro usuario, y no hay path traversal.**
`backend/routes/admin/index.js:852-875` resuelve `:campo` con un `Array.prototype.find` sobre
`v.archivos` comparando `a.campo === req.params.campo` — **no** arma una ruta de archivo ni
indexa un objeto, así que ni `..%2f` ni `__proto__` llevan a ningún lado:

```
GET /api/admin/verification/<id>/files/foto            (owner) → 200, devuelve el data-URI
GET /api/admin/verification/<id>/files/__proto__       (owner) → 404 ITEM_NOT_FOUND
GET /api/admin/verification/<id>/files/constructor     (owner) → 404 ITEM_NOT_FOUND
GET /api/admin/verification/<id>/files/..%2f..%2fdatos (owner) → 404 ITEM_NOT_FOUND
GET /api/admin/verification/<id>/files/foto      (token user)  → 403 NOT_LOGGED_IN
GET /api/admin/verification/<id>/files/foto      (sin sesión)  → 401 NOT_LOGGED_IN
GET /api/admin/verification/<id>/data            (token user)  → 403 NOT_LOGGED_IN
```
Y al resolver el nivel, `backend/services/verification/index.js:256` hace `fila.archivos = []`:
los archivos se borran. Muy bien pensado.

### 7. SSRF — no existe la superficie

Grep de `fetch(`, `axios`, `http.request`, `https.request`, `got(` en todo `backend/`
(excluyendo `node_modules`) da **exactamente dos** llamadas salientes, las dos con URL constante:

- `backend/services/cashier/oxapay.js:44` → `fetch(BASE + ruta, …)` donde
  `const BASE = "https://api.oxapay.com/v1"` (línea 28) y `ruta` es un literal en cada
  llamador (`"/payment/static-address"`, `"/payout"`).
- `backend/services/turnstile.js:61` → `fetch(URL_DE_CLOUDFLARE, …)` con
  `URL_DE_CLOUDFLARE = "https://challenges.cloudflare.com/turnstile/v0/siteverify"` (línea 31).

`ticker`, `red` y `direccion` del jugador viajan en el **cuerpo** del pedido a OxaPay, nunca en
la URL, y además pasan por `buscar()` (`backend/services/cashier/monedas.js:181-192`), que los
compara contra la lista fija de monedas.

**No hay ningún campo de "image URL" que el servidor descargue.** Las imágenes de las cajas y
de los objetos son cadenas que el frontend usa como `src`; el servidor nunca las pide. Así que
no hay dónde probar `169.254.169.254`, `127.0.0.1` ni `file://`.

### 8. Prototype pollution — no hay

Probado con cuerpos crudos (`__proto__` de verdad en el JSON, no un literal de JS) contra
`PUT /profile/controls`, `PUT /admin/settings` (con `__proto__` y con `constructor.prototype`),
`POST /community/quote` (`portada.posiciones.__proto__`), `POST /profile/verification/2` y
`POST /admin/team/:id`. Después:

```
GET /api/public/settings → ¿aparece 'polucionado'?: false
GET /api/health          → {"success":true,"ok":true,…}
```

Lo que lo impide es que **todas** las rutas de escritura arman un objeto nuevo campo por campo
contra una lista blanca, en vez de hacer `{...req.body}`:
`backend/routes/admin/editar.js:213-230` (`armar`), `backend/routes/admin/index.js:1047-1082`
(`permitidos` de settings), `backend/services/verification/index.js:93-147` (`leerFormulario`),
`backend/routes/profile/index.js:175-195` (`camposDeDireccion`). No hay un solo merge profundo
ni un `Object.assign` recursivo en `backend/` fuera de `node_modules`.

### 9. Exportaciones CSV/Excel — no existen

Grep de `csv|xlsx|excel|\.sheet|exportar|download` en `routes/`, `services/`, `utils/` e
`index.js`: **cero coincidencias**. No hay inyección de fórmulas porque no hay exportación.

### 10. Redirects del servidor — no existen

Grep de `redirect` y `Location` en todo `backend/` (sin `node_modules`): cero. El único open
redirect es del lado del cliente y está en INY-03.

### 11. Sin sinks peligrosos

Grep de `eval(`, `new Function`, `child_process`, `exec(`, `execSync`, `writeFile`,
`require(req.…)` en `routes/`, `services/`, `middleware/`, `utils/` e `index.js`: la única
coincidencia es `.exec()` de Mongoose (`backend/services/affiliates/index.js:210`), que no
tiene nada que ver.

### 12. Validación general: no hay capa de esquemas, pero la validación a mano es consistente

No hay `zod`, `joi`, `yup`, `ajv`, `express-validator` ni `celebrate` en
`backend/package.json`. Las **157 rutas** (contadas con
`grep -rcoE "router\.(get|post|put|patch|delete)\(" routes/`) validan a mano. Repartidas así:

```
33  routes/admin/index.js        9  routes/wallet/index.js      6  routes/admin/editar.js
15  routes/admin/extra.js        9  routes/inventory/index.js   5  routes/support/index.js
14  routes/profile/index.js      9  routes/community/index.js   3+3+3+3+3  vip/races/public/auth/carreras
11  routes/admin/afiliados.js    8  routes/boxes/index.js       1+1+1  promotions/index/challenges
                                 8  routes/affiliates/index.js
                                 6  routes/deals/index.js
                                 6  routes/admin/jugador.js
```

No puedo decir "X rutas no validan nada", porque **no encontré ninguna ruta de escritura que
no castee lo que usa**. Todas las rutas de lectura con filtros los castean también. Lo que sí
falta es *uniformidad*: cada archivo repite su propio `String(...).trim().slice(...)`, y eso
es lo que produce los huecos chicos de INY-02, INY-04 y INY-05. Una capa de esquemas los
cerraría todos de una vez, pero no es urgente.

---

# HALLAZGOS

## INY-01 — `POST /api/community/quote` acepta cuerpos de 12 MB sin sesión y sin freno

- **Severidad:** Media
- **Categoría:** Denegación de servicio / validación de entrada
- **Archivo:** `backend/index.js:93-100` + `backend/routes/community/index.js:223`
- **Confianza:** Alta (probado contra localhost)
- **Esfuerzo del arreglo:** Bajo (2 líneas)

### Descripción

`backend/index.js:93-100` le da 12 MB de cuerpo a **todo** lo que cuelgue de `/api/community`:

```js
const SUBEN_ARCHIVOS = [/^\/api\/profile\/verification(\/|$)/, /^\/api\/community(\/|$)/];
const cuerpoChico = express.json({ limit: "200kb" });
const cuerpoGrande = express.json({ limit: "12mb" });

app.use((req, res, next) => {
  const grande = SUBEN_ARCHIVOS.some((r) => r.test(req.path));
  return (grande ? cuerpoGrande : cuerpoChico)(req, res, next);
});
```

El resto de `/api/community` sí pide sesión (`autorizar(true)` ruta por ruta), pero
**`/quote` no**, y además el router de comunidad no tiene ningún `express-rate-limit`:

```js
/* backend/routes/community/index.js:223 */
router.post("/quote", async (req, res) => {
  try {
    const premios = await comunidad.premiosDesdeElPedido(req.body.premios);
```

Resultado: cualquiera, sin cuenta, puede hacer que el servidor reserve y parsee hasta 12 MB de
JSON por pedido, tantas veces como quiera. Comparar con `/api/wallet/promo`, que corta a 200 KB.

### Impacto concreto

Con ~40 pedidos concurrentes de 12 MB son ~480 MB de JSON parseándose a la vez en un proceso
Node de un solo hilo. En el plan chico de Render eso es el proceso caído, o al menos la API sin
aire para los jugadores que están abriendo cajas (que es plata que no entra). No hace falta
cuenta, no hace falta captcha y no queda ni un registro.

### Pasos exactos para reproducir

1. Sin ninguna cabecera `x-auth-token`.
2. `POST http://localhost:5001/api/community/quote` con un cuerpo JSON de ~11 MB.
3. El servidor lo parsea entero y recién después contesta un error de negocio.

### PoC

```bash
node -e '
const cuerpo = JSON.stringify({ premios: [{ itemId: "x".repeat(11*1024*1024), peso: 1 }] });
fetch("http://localhost:5001/api/community/quote", {
  method: "POST",
  headers: { "Content-Type": "application/json" },   /* sin x-auth-token */
  body: cuerpo,
}).then(r => r.text()).then(t => console.log(t));'
```

Respuesta real del servidor (cuerpo de 11.534.372 bytes, **sin sesión**):

```
< 400 (238ms) {"success":false,"code":"TOO_FEW_ITEMS","message":"That box needs more items.","data":{"minimo":5}}
```

El `400` es de negocio: **el cuerpo de 11 MB se leyó y se parseó entero** antes de llegar ahí.
Para contraste, la misma cantidad de datos contra una ruta normal sí rebota:

```
POST /api/wallet/promo  con 1 MB → 500 (PayloadTooLargeError, ver INY-06)
```

También probé si el tope de 12 MB se puede robar para otras rutas con `..` en el path: **no se
puede**, Express no resuelve `..` y la ruta directamente no existe (probado con socket crudo
para que el cliente no normalice la URL):

```
POST /api/community/../wallet/promo  (1 MB, socket crudo) → 404 {"data":{"ruta":"/api/community/../wallet/promo"}}
```

### Arreglo propuesto

Dos cosas: que `/quote` pida sesión (es una pantalla de un creador registrado, no una pública),
y que el cuerpo grande se limite a las rutas que de verdad suben archivos.

```diff
--- a/backend/index.js
+++ b/backend/index.js
-const SUBEN_ARCHIVOS = [/^\/api\/profile\/verification(\/|$)/, /^\/api\/community(\/|$)/];
+/*
+  Solo donde de verdad viaja un `data:`. `/api/community` entero daba 12 MB
+  a `/quote`, que no pide sesion: 12 MB de JSON por pedido y sin cuenta.
+*/
+const SUBEN_ARCHIVOS = [
+  /^\/api\/profile\/verification(\/|$)/,
+  /^\/api\/community$/,          // crear
+  /^\/api\/community\/[0-9a-f]{24}$/i,  // editar
+];
```

```diff
--- a/backend/routes/community/index.js
+++ b/backend/routes/community/index.js
-router.post("/quote", async (req, res) => {
+router.post("/quote", autorizar(true), freno, async (req, res) => {
```

...con un freno propio arriba del archivo:

```diff
+const rateLimit = require("express-rate-limit");
+
+/* Cotizar es barato pero se llama en cada tecla del editor: 120 por minuto
+   no molesta a nadie real y corta el script. */
+const freno = rateLimit({
+  windowMs: 60 * 1000,
+  max: Number(process.env.COMMUNITY_RATE_LIMIT) || 120,
+  standardHeaders: true,
+  legacyHeaders: false,
+  handler: (req, res) => res.status(429).json(errorDe("RATE_LIMITED", {}, 429).aRespuesta()),
+});
```

### Cómo verificar

```bash
# sin sesion: 401
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:5001/api/community/quote \
  -H 'Content-Type: application/json' --data '{"premios":[]}'
# 11 MB contra /quote: 413, no 400
# y crear/editar una caja con un logo de 2 MB sigue funcionando
```

---

## INY-02 — Dos listas del panel sin tope de `perPage`

- **Severidad:** Baja (hace falta sesión de admin)
- **Categoría:** Validación de entrada / denegación de servicio
- **Archivos:** `backend/routes/admin/extra.js:58-63,102-106,133-139` y `backend/services/cashier/index.js:265-275`
- **Confianza:** Alta (confirmado leyendo el código y probado)
- **Esfuerzo del arreglo:** Trivial

### Descripción

Casi todas las listas del panel pasan por `paginar()`, que tiene tope:

```js
/* backend/routes/admin/index.js:44-48 */
function paginar(req, porDefecto = 25) {
  const pagina = Math.max(1, Number(req.query.page) || 1);
  const porPagina = Math.min(200, Math.max(1, Number(req.query.perPage) || porDefecto));
  return { pagina, porPagina, saltar: (pagina - 1) * porPagina };
}
```

Pero **dos no la usan** y mandan el número del usuario derecho al `.limit()`:

```js
/* backend/routes/admin/extra.js:102-106 — /admin/payments */
const datos = await delLibro("purchase", {
  desde,
  page: Number(req.query.page) || 1,
  perPage: Number(req.query.perPage) || 25,     // ← sin tope
});
```
```js
/* backend/routes/admin/extra.js:58-63 — delLibro */
async function delLibro(tipo, { desde, page = 1, perPage = 25 }) {
  …
    BalanceTransaction.find(filtro)
      .sort({ createdAt: -1 })
      .skip((page - 1) * perPage)
      .limit(perPage)                            // ← sin tope
```
```js
/* backend/routes/admin/extra.js:133-139 — /admin/redemptions */
const datos = await caja.cola({
  estado: req.query.estado || "",
  page: Number(req.query.page) || 1,
  perPage: Number(req.query.perPage) || 25,     // ← sin tope
});
```
```js
/* backend/services/cashier/index.js:265-275 — cola */
async function cola({ estado = "", page = 1, perPage = 25 }) {
  …
    Redemption.find(filtro)
      .sort({ createdAt: 1 })
      .skip((Math.max(1, page) - 1) * perPage)
      .limit(perPage)                            // ← sin tope
```

### Impacto concreto

Una cuenta de `support`/`admin` (o una sesión de admin robada, o una pestaña de admin abierta
víctima de un CSRF — aunque acá la sesión va en cabecera, así que CSRF no aplica) puede pedir
el libro entero de compras o la cola entera de canjes en un solo pedido. Con el libro de un año
eso son cientos de miles de filas con `.populate("user", "username email")` encima: el proceso
se queda sin memoria, y de paso es la forma más cómoda de sacar la base de un tirón sin que el
registro del panel diga nada (estas dos rutas no llaman a `admin.anotar`).

No es Media porque hace falta el panel, y quien tiene el panel ya puede mirar todo. Es Baja
porque convierte "mirar de a 25" en "bajarse todo de una".

### Pasos exactos para reproducir

1. Entrar como `owner` o `admin`.
2. `GET /api/admin/payments?perPage=9999999`.

### PoC

```bash
TOK=$(curl -s -X POST http://localhost:5001/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"dani@mrbox.local","password":"mrbox12345","captchaToken":"X.DUMMY.X"}' \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).token))')

curl -s -H "x-auth-token: $TOK" "http://localhost:5001/api/admin/payments?perPage=9999999"    | head -c 200; echo
curl -s -H "x-auth-token: $TOK" "http://localhost:5001/api/admin/redemptions?perPage=9999999" | head -c 200; echo
```

Respuestas reales (la base local es chica, así que el tamaño no asusta; **lo que importa es que
no hay recorte**: con `perPage=3` devuelve 3, con `perPage=9999999` devuelve todo lo que hay):

```
200  162ms  items=5   bytes=1064   /admin/payments?perPage=9999999
200  18ms   items=5   bytes=1064   /admin/payments?perPage=25
200  27ms   items=23  bytes=8647   /admin/redemptions?perPage=9999999
200  191ms  items=3                /admin/redemptions?perPage=3        ← el limit sí se respeta
```

Comparar con una que sí tiene tope: `GET /admin/movements?perPage=9999999` → `perPage=200`.

De paso: `perPage=-1` llega a `.limit(-1)`, que en Mongo significa "un solo lote" en vez de
"ninguno". No rompe nada, pero es otro valor que no debería llegar.

```
200  29ms   items=1   /admin/payments?perPage=-1
```

### Arreglo propuesto

```diff
--- a/backend/routes/admin/extra.js
+++ b/backend/routes/admin/extra.js
+/* El mismo tope que `paginar()` de ./index.js: una lista del panel se mira,
+   no se descarga. Sin esto, `?perPage=9999999` se trae el libro entero. */
+function pagina(req, porDefecto = 25) {
+  return {
+    page: Math.max(1, Number(req.query.page) || 1),
+    perPage: Math.min(200, Math.max(1, Number(req.query.perPage) || porDefecto)),
+  };
+}
+
 router.get("/payments", async (req, res) => {
   try {
     const { dias, desde } = desdeDias(req);
-    const datos = await delLibro("purchase", {
-      desde,
-      page: Number(req.query.page) || 1,
-      perPage: Number(req.query.perPage) || 25,
-    });
+    const datos = await delLibro("purchase", { desde, ...pagina(req) });
@@
 router.get("/redemptions", async (req, res) => {
   try {
     const datos = await caja.cola({
       estado: req.query.estado || "",
-      page: Number(req.query.page) || 1,
-      perPage: Number(req.query.perPage) || 25,
+      ...pagina(req),
     });
```

Y por las dudas, el cinturón en el servicio (es público y lo puede llamar otro día otra ruta):

```diff
--- a/backend/services/cashier/index.js
+++ b/backend/services/cashier/index.js
 async function cola({ estado = "", page = 1, perPage = 25 }) {
+  /* El tope vive acá tambien: la ruta puede olvidarse, el servicio no. */
+  const porPagina = Math.min(200, Math.max(1, Number(perPage) || 25));
+  const pagina = Math.max(1, Number(page) || 1);
   const filtro = {};
   if (estado) filtro.estado = estado;
@@
     Redemption.find(filtro)
       .sort({ createdAt: 1 })
-      .skip((Math.max(1, page) - 1) * perPage)
-      .limit(perPage)
+      .skip((pagina - 1) * porPagina)
+      .limit(porPagina)
```
(ajustando también los `page`/`pages` del `return`).

### Cómo verificar

```bash
curl -s -H "x-auth-token: $TOK" "http://localhost:5001/api/admin/payments?perPage=9999999" \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).data.pages, JSON.parse(s).data.items.length))'
# el conteo de items nunca debe pasar de 200
```

---

## INY-03 — Open redirect por el `destino` de banners y promociones

- **Severidad:** Baja (hace falta escribir desde el panel)
- **Categoría:** Open redirect / validación de entrada
- **Archivos:** `backend/routes/admin/editar.js:173-187`, `backend/database/models/Banner.js:34`, `backend/database/models/Promotion.js:49`, `frontend/src/views/HomeView.vue:47`, `frontend/src/views/PromotionsView.vue:28`
- **Confianza:** Alta (guardado de verdad y resuelto de verdad con vue-router)
- **Esfuerzo del arreglo:** Bajo

### Descripción

Los dos modelos dicen en un comentario que el destino es interno, pero **nadie lo comprueba**:

```js
/* backend/database/models/Banner.js:33-34 */
/* A dónde lleva. Una dirección del sitio, no una externa. */
destino: { type: String, default: "/boxes", trim: true },
```
```js
/* backend/database/models/Promotion.js:48-49 */
/* Adónde lleva el botón. Una dirección del sitio, no de afuera. */
destino: { type: String, default: "/boxes" },
```

Y la lista blanca del panel lo trata como texto suelto:

```js
/* backend/routes/admin/editar.js:176-185 */
campos: {
  clave: "texto",
  foto: "texto",
  …
  destino: "texto",     // LIMPIAR.texto = String(v).trim().slice(0, 300)
```

El frontend lo pinta como `router-link`:

```html
<!-- frontend/src/views/HomeView.vue:47 -->
<router-link v-for="(b, i) in banners" :key="b.foto" :to="b.a" class="mb-banner">
<!-- frontend/src/views/PromotionsView.vue:28 -->
<router-link :to="p.destino" class="mb-promo__b">{{ p.boton || $t('promos.go') }}</router-link>
```

vue-router 3 neutraliza `javascript:` (lo convierte en una ruta relativa) pero **deja pasar la
URL protocolo-relativa `//host`** tal cual al atributo `href`. Verificado contra la librería real:

```
"/boxes"               => href: "/boxes"
"//evil.example"       => href: "//evil.example"          ← se va del sitio
"javascript:alert(1)"  => href: "/javascript:alert(1)"    ← neutralizado
"https://evil.example" => href: "/https://evil.example"   ← neutralizado
```

El click normal lo intercepta `router-link`, pero `guardEvent`
(`frontend/node_modules/vue-router/dist/vue-router.common.js:1244-1246`) **sale temprano con
ctrl/cmd/alt/shift y con el botón del medio**:

```js
function guardEvent (e) {
  // don't redirect with control keys
  if (e.metaKey || e.altKey || e.ctrlKey || e.shiftKey) { return }
```

Así que "abrir en una pestaña nueva", ctrl+click y click del medio **siguen el `href` crudo** y
se van a `evil.example`.

### Impacto concreto

Quien pueda escribir banners o promociones (todo el equipo con panel; o una cuenta de panel
comprometida) deja un enlace con el dominio y la marca de MR BOX que lleva afuera. En un sitio
de dinero real el destino típico es una copia de la pantalla de login o del cajón. El jugador
hizo ctrl+click desde la portada de mrbox.gg: no tiene motivo para desconfiar.

También es la vía para quemar la reputación del dominio: el enlace vive en la portada pública.

### Pasos exactos para reproducir

1. Entrar al panel como `owner`.
2. `POST /api/admin/banners` con `destino: "//evil.example/fish"`.
3. `GET /api/public/banners` (sin sesión) devuelve ese destino.
4. En la portada, ctrl+click (o botón del medio) sobre el banner.

### PoC

```bash
curl -s -X POST http://localhost:5001/api/admin/banners -H "x-auth-token: $TOK" \
  -H 'Content-Type: application/json' \
  -d '{"clave":"promo-q4","foto":"/img/banners/banner-50k.webp","destino":"//evil.example/fish","visible":true}'
```

Respuesta real:

```json
{"success":true,"data":{"clave":"audit-redirect-1795114674451","foto":"/img/x.webp","titulo":"","sub":"","cta":"","destino":"//evil.example/fish","orden":0,"visible":true,"_id":"6aff46b2cc6c590c20ec9f6d","createdAt":"2026-11-19T18:57:54.593Z","updatedAt":"2026-11-19T18:57:54.593Z","__v":0}}
```

Y servido al público sin sesión (`GET /api/public/banners`):

```json
{"success":true,"data":{"items":[
 {"_id":"6aff46b2cc6c590c20ec9f6d","clave":"audit-redirect-…","foto":"/img/x.webp","titulo":"","sub":"","cta":"","destino":"//evil.example/fish"},
 {"_id":"6aff46b2cc6c590c20ec9f6f","clave":"audit-redirect-…-b","foto":"/img/x.webp","titulo":"","sub":"","cta":"","destino":"https://evil.example"},
 {"_id":"6aff46b2cc6c590c20ec9f71","clave":"audit-redirect-…-c","foto":"javascript:alert(1)","titulo":"","sub":"","cta":"","destino":"javascript:alert(1)"}, …]}}
```

(Los tres banners de prueba quedaron **borrados** al terminar: `DELETE /api/admin/banners/<id>`
→ `{"success":true,"data":{"borrado":true}}` para los tres.)

Y la comprobación del `href` con la librería de verdad:

```bash
cd frontend && node -e '
const VueRouter = require("vue-router"); const Vue = require("vue"); Vue.use(VueRouter);
const r = new VueRouter({ mode: "history", routes: [{ path: "/boxes", component: { render(){} } }] });
for (const to of ["/boxes","//evil.example","javascript:alert(1)","https://evil.example/x"])
  console.log(JSON.stringify(to).padEnd(26), "=> href:", JSON.stringify(r.resolve(to).href));'
```

### Arreglo propuesto

Un tipo de campo nuevo en la lista blanca del panel. Lo importante es rechazar `//` al
principio, que es el caso que se escapa.

```diff
--- a/backend/routes/admin/editar.js
+++ b/backend/routes/admin/editar.js
 const LIMPIAR = {
   texto: (v) => String(v == null ? "" : v).trim().slice(0, 300),
+  /*
+    UNA DIRECCION DE ESTE SITIO Y NADA MAS.
+
+    Tiene que empezar con una sola barra. `//evil.com` es una direccion
+    protocolo-relativa: vue-router la deja pasar tal cual al `href`, y
+    aunque el click normal lo atrapa el router, ctrl+click y el boton
+    del medio se van afuera con la marca del sitio puesta.
+  */
+  rutaDelSitio: (v) => {
+    const t = String(v == null ? "" : v).trim().slice(0, 300);
+    if (!t) return "/boxes";
+    if (!/^\/(?!\/)/.test(t)) throw errorDe("INVALID_AMOUNT", { campo: "destino", valor: t });
+    return t;
+  },
```
```diff
   banners: {
     …
     campos: {
       clave: "texto",
       foto: "texto",
       titulo: "texto",
       sub: "texto",
       cta: "texto",
-      destino: "texto",
+      destino: "rutaDelSitio",
       orden: "entero",
       visible: "siNo",
     },
@@
   promotions: {
     …
     campos: {
       clave: "texto",
       titulo: "idiomas",
       texto: "idiomas",
       boton: "idiomas",
-      destino: "texto",
+      destino: "rutaDelSitio",
```

Y un cinturón del lado del cliente, por las filas que ya están guardadas:

```diff
--- a/frontend/src/views/HomeView.vue
+++ b/frontend/src/views/HomeView.vue
         if (deLaBase && deLaBase.length) {
           this.banners = deLaBase.map((b) => ({
-            foto: b.foto, title: b.titulo, sub: b.sub, cta: b.cta, a: b.destino,
+            foto: b.foto, title: b.titulo, sub: b.sub, cta: b.cta,
+            /* Una sola barra. `//otro-sitio` sale del sitio con ctrl+click. */
+            a: /^\/(?!\/)/.test(String(b.destino || "")) ? b.destino : "/boxes",
           }));
```
(lo mismo en `PromotionsView.vue` para `p.destino`).

### Cómo verificar

```bash
curl -s -X POST http://localhost:5001/api/admin/banners -H "x-auth-token: $TOK" \
  -H 'Content-Type: application/json' \
  -d '{"clave":"x","foto":"/a.webp","destino":"//evil.example"}'
# debe dar 400 INVALID_AMOUNT
# y `destino: "/boxes?sort=caras"` debe seguir funcionando
```

---

## INY-04 — Búsqueda de propiedades en objetos literales con una clave del usuario → 500

- **Severidad:** Baja
- **Categoría:** Validación de entrada / robustez
- **Archivos:** `backend/routes/boxes/index.js:75-84`, `backend/routes/community/index.js:44,48`, `backend/routes/inventory/index.js:48`, `backend/routes/admin/jugador.js:325`, `backend/routes/admin/editar.js:234,258,295`
- **Confianza:** Alta (probado, con las respuestas pegadas)
- **Esfuerzo del arreglo:** Trivial

### Descripción

Varias rutas eligen el orden, la solapa o la entidad buscando la clave del usuario en un objeto
literal. Un objeto literal **hereda de `Object.prototype`**, así que `constructor`, `toString`,
`valueOf`, `hasOwnProperty` y `__proto__` "existen" y devuelven algo que no es lo esperado:

```js
/* backend/routes/boxes/index.js:75-84 */
const ORDENES = { popular: {opens:-1}, nuevas: {createdAt:-1}, baratas: {priceSc:1},
                  caras: {priceSc:-1}, nombre: {name:1}, retorno: {retorno:-1} };
const orden = ORDENES[req.query.sort] || ORDENES.popular;   // ← ORDENES["constructor"] = Object
…
Box.find(filtro).sort(orden)                                 // ← Mongoose recibe una función
```
```js
/* backend/routes/admin/jugador.js:323-329 */
router.get("/players/:id/:solapa", async (req, res) => {
  const traer = SOLAPAS[req.params.solapa];        // ← SOLAPAS["constructor"] = Object
  if (!traer) throw errorDe("NOT_FOUND");
  const datos = await traer(req.params.id, …);     // ← llama a Object(id, pagina)
```
```js
/* backend/routes/admin/editar.js:234 (igual en 258 y 295) */
const cosa = COSAS[req.params.cosa];               // ← COSAS["__proto__"] = Object.prototype
if (!cosa) throw errorDe("NOT_FOUND");
const datos = await armar(cosa, req.body, true);   // ← Object.entries(undefined) revienta
```

### Impacto concreto

Dos cosas, las dos chicas:

1. **500 en vez de 404 en rutas públicas y sin sesión.** `GET /api/boxes?sort=constructor` tira
   un 500 con un pedido de cuatro bytes. No tumba el proceso (lo atrapa `responderError`), pero
   ensucia el registro, dispara las alertas y es una forma barata de hacer ruido.
2. **La ruta contesta 200 con basura.** `GET /admin/players/<id>/constructor` devuelve
   `{"success":true,"data":"<el id>"}` — el `Object(id, pagina)` que se ejecutó en lugar de la
   solapa. No filtra nada, pero una ruta que contesta "éxito" con algo que nadie escribió es
   exactamente la clase de cosa que mañana es otra cosa.

### Pasos exactos para reproducir

1. `GET http://localhost:5001/api/boxes?sort=constructor` (sin sesión).
2. Con sesión de admin: `GET /api/admin/players/<id>/constructor` y `/toString`.

### PoC y respuestas reales

```
GET /api/boxes?sort=constructor
< 500 (4ms) {"success":false,"code":"SOMETHING_WENT_WRONG","message":"Something went wrong.","data":{}}

GET /api/community/boxes?sort=constructor
< 500 (2ms) {"success":false,"code":"SOMETHING_WENT_WRONG","message":"Something went wrong.","data":{}}

GET /api/inventory?sort=constructor          (token de jugador)
< 500 (10ms) {"success":false,"code":"SOMETHING_WENT_WRONG","message":"Something went wrong.","data":{}}

GET /api/boxes?sort=__proto__
< 200 (18ms)  ← cae al orden por defecto, no rompe

GET /api/admin/players/6afc84b54ecad78c6806d1a7/constructor     (owner)
< 200 (51ms) {"success":true,"data":"6afc84b54ecad78c6806d1a7"}

GET /api/admin/players/6afc84b54ecad78c6806d1a7/toString        (owner)
< 200 (42ms) {"success":true,"data":"[object Undefined]"}

GET /api/admin/players/6afc84b54ecad78c6806d1a7/__proto__       (owner)
< 500 (82ms) SOMETHING_WENT_WRONG
GET /api/admin/players/6afc84b54ecad78c6806d1a7/valueOf         (owner)
< 500 (36ms) SOMETHING_WENT_WRONG
GET /api/admin/players/6afc84b54ecad78c6806d1a7/hasOwnProperty  (owner)
< 500 (27ms) SOMETHING_WENT_WRONG

POST /api/admin/constructor   {"clave":"x"}                     (owner)
< 500 (21ms) SOMETHING_WENT_WRONG
POST /api/admin/__proto__     {"clave":"x"}                     (owner)
< 500 (18ms) SOMETHING_WENT_WRONG
```

Mismo patrón, misma causa: `admin/support?asignado=a&asignado=b` (dos veces el mismo parámetro
da un array, que no castea a ObjectId) también termina en 500:

```
GET /api/admin/support?asignado=a&asignado=b   (owner)
< 500 (37ms) SOMETHING_WENT_WRONG
```
(ver `backend/services/support/index.js:187` → `filtro.asignado = o.asignado`).

### Arreglo propuesto

Una línea por sitio: preguntar por propiedad **propia**, no por la cadena de prototipos.

```diff
--- a/backend/routes/boxes/index.js
+++ b/backend/routes/boxes/index.js
-    const orden = ORDENES[req.query.sort] || ORDENES.popular;
+    /* `hasOwn` y no `ORDENES[x]`: un objeto literal hereda `constructor`
+       y `toString`, y esos llegan a `.sort()` como funciones. */
+    const pedido = String(req.query.sort || "");
+    const orden = Object.hasOwn(ORDENES, pedido) ? ORDENES[pedido] : ORDENES.popular;
```
```diff
--- a/backend/routes/community/index.js
+++ b/backend/routes/community/index.js
     const orden = { nuevas: { createdAt: -1 }, caras: { priceSc: -1 }, baratas: { priceSc: 1 } };
+    const pedido = String(req.query.sort || "");
@@
-        .sort(orden[req.query.sort] || { opens: -1, createdAt: -1 })
+        .sort(Object.hasOwn(orden, pedido) ? orden[pedido] : { opens: -1, createdAt: -1 })
```
```diff
--- a/backend/routes/admin/jugador.js
+++ b/backend/routes/admin/jugador.js
-    const traer = SOLAPAS[req.params.solapa];
-    if (!traer) throw errorDe("NOT_FOUND");
+    const cual = String(req.params.solapa || "");
+    if (!Object.hasOwn(SOLAPAS, cual)) throw errorDe("NOT_FOUND");
+    const traer = SOLAPAS[cual];
```
```diff
--- a/backend/routes/admin/editar.js
+++ b/backend/routes/admin/editar.js
-    const cosa = COSAS[req.params.cosa];
-    if (!cosa) throw errorDe("NOT_FOUND");
+    const cual = String(req.params.cosa || "");
+    if (!Object.hasOwn(COSAS, cual)) throw errorDe("NOT_FOUND");
+    const cosa = COSAS[cual];
```
(las tres veces: `post("/:cosa")`, `put("/:cosa/:id")`, `delete("/:cosa/:id")`).

Y en `services/support`, castear el filtro:

```diff
--- a/backend/services/support/index.js
+++ b/backend/services/support/index.js
-  if (o.estado) filtro.estado = o.estado;
-  if (o.asignado === "nadie") filtro.asignado = null;
-  else if (o.asignado) filtro.asignado = o.asignado;
+  /* Un parametro repetido en la query llega como array y no castea. */
+  const estado = Array.isArray(o.estado) ? "" : String(o.estado || "");
+  const asignado = Array.isArray(o.asignado) ? "" : String(o.asignado || "");
+  if (estado) filtro.estado = estado;
+  if (asignado === "nadie") filtro.asignado = null;
+  else if (/^[0-9a-f]{24}$/i.test(asignado)) filtro.asignado = asignado;
```

Alternativa de fondo, si se prefiere: declarar estas tablas con
`Object.assign(Object.create(null), { … })` y el problema desaparece de raíz.

### Cómo verificar

```bash
for s in constructor __proto__ toString valueOf hasOwnProperty caras; do
  printf "%-16s " "$s"
  curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:5001/api/boxes?sort=$s"
done
# todos 200; ninguno 500
curl -s -o /dev/null -w "%{http_code}\n" -H "x-auth-token: $TOK" \
  "http://localhost:5001/api/admin/players/$UID/constructor"   # 404, no 200
```

---

## INY-05 — Operadores de Mongo aceptados en ids que vienen del cuerpo (endurecimiento)

- **Severidad:** Baja
- **Categoría:** Inyección NoSQL (no escalable)
- **Archivos:** `backend/services/support/index.js:103`, `backend/services/shipping/index.js:65`, `backend/services/boxes/index.js:504,511,548`, `backend/routes/inventory/index.js:123-134`
- **Confianza:** Alta (probado; **confirmé que NO se puede escalar**)
- **Esfuerzo del arreglo:** Bajo

### Descripción

Un puñado de consultas meten un id que viene del cuerpo sin castear a `String`. Mongoose
acepta `{"$ne": null}` ahí porque castea el *valor del operador*, no el campo entero:

```js
/* backend/services/support/index.js:102-104 — hiloId sale de req.body.hilo */
if (datos.hiloId) {
  hilo = await SupportThread.findOne({ _id: datos.hiloId, user: datos.userId });
```
```js
/* backend/services/shipping/index.js:64-66 — addressId sale de req.body.addressId */
const destino = addressId
  ? await Address.findOne({ _id: addressId, user: user._id }).lean()
```
```js
/* backend/services/boxes/index.js:504-508 — inventoryItemId sale de req.body.ids[i] */
const objeto = await InventoryItem.findOneAndUpdate(
  { _id: inventoryItemId, user: user._id, state: "held" },
  { $set: { state: "sold", soldAt: new Date() } },
```
```js
/* backend/routes/inventory/index.js:123 — los elementos del array NO se castean */
const ids = Array.isArray(req.body.ids) ? req.body.ids.slice(0, 200) : [];
```

### Impacto concreto

**Acotado, y lo verifiqué:** las cuatro consultas llevan **siempre** `user: <id del que pide>`
pegado en el mismo filtro, que viene del token y no del cuerpo. Así que lo más que se consigue
con `{"$ne": null}` es "operar sobre *alguno* de mis propios hilos / mis propias direcciones /
mis propios objetos" en lugar de "sobre el que indiqué". **No se cruza a otra cuenta y no se
lee nada ajeno.** Por eso es Baja y no Alta.

Lo reporto igual porque es una línea de defensa que hoy depende de que nadie saque ese
`user:` del filtro. El día que alguien agregue una ruta de soporte "ver cualquier hilo por id",
esta misma forma pasa a ser una lectura cruzada.

Para contraste, `services/shipping/index.js:58` sí lo hace bien con la lista:
`[...new Set(ids.map(String))]`.

### Pasos exactos para reproducir

1. Con sesión de jugador.
2. `POST /api/support/threads` con `{"texto":"hola","hilo":{"$ne":null}}`.
3. `POST /api/inventory/sell-many` con `{"ids":[{"$ne":null}]}`.

### PoC y respuestas reales

```
POST /api/support/threads {"texto":"hola","hilo":{"$ne":null}}
< 400 (18ms) {"success":false,"code":"NOT_FOUND","message":"That does not exist.","data":{}}
   (la cuenta de prueba no tenía hilos propios; con hilos propios devuelve UNO de ellos)

POST /api/inventory/sell-many {"ids":[{"$ne":null}]}
< 200 (17ms) {"success":true,"data":{"vendidos":0,"totalSc":0,
    "fallaron":[{"id":{"$ne":null},"code":"ITEM_NOT_FOUND"}],
    "balanceSc":15,"bonoPendienteSc":0,"canjeableSc":15,"jugadoSc":0,"freeOpens":3}}
   (inventario vacío; con objetos en mano habría vendido UNO cualquiera de los propios)
```

El eco del operador en `fallaron[].id` es cosmético (es JSON, no HTML), pero confirma que el
objeto llegó entero hasta la consulta.

### Arreglo propuesto

```diff
--- a/backend/services/support/index.js
+++ b/backend/services/support/index.js
   if (datos.hiloId) {
-    hilo = await SupportThread.findOne({ _id: datos.hiloId, user: datos.userId });
+    /* `String()`: sin esto, `{"$ne":null}` en el cuerpo es un operador
+       que Mongoose acepta y la consulta deja de ser por id. */
+    hilo = await SupportThread.findOne({ _id: String(datos.hiloId), user: datos.userId });
```
```diff
--- a/backend/services/shipping/index.js
+++ b/backend/services/shipping/index.js
   const destino = addressId
-    ? await Address.findOne({ _id: addressId, user: user._id }).lean()
+    ? await Address.findOne({ _id: String(addressId), user: user._id }).lean()
```
```diff
--- a/backend/routes/inventory/index.js
+++ b/backend/routes/inventory/index.js
-    const ids = Array.isArray(req.body.ids) ? req.body.ids.slice(0, 200) : [];
+    /* `.map(String)` como en services/shipping: un objeto adentro del
+       array llega a la consulta como operador de Mongo. */
+    const ids = Array.isArray(req.body.ids) ? req.body.ids.slice(0, 200).map(String) : [];
```
```diff
--- a/backend/services/boxes/index.js
+++ b/backend/services/boxes/index.js
 async function vender({ user, inventoryItemId }) {
+  const cual = String(inventoryItemId || "");
   const cfg = await Settings.leer();
@@
   const objeto = await InventoryItem.findOneAndUpdate(
-    { _id: inventoryItemId, user: user._id, state: "held" },
+    { _id: cual, user: user._id, state: "held" },
@@
-    const existe = await InventoryItem.findOne({ _id: inventoryItemId, user: user._id }).lean();
+    const existe = await InventoryItem.findOne({ _id: cual, user: user._id }).lean();
```
(y lo mismo con `boxOpenId` en `verificar()`, `backend/services/boxes/index.js:548`.)

### Cómo verificar

```bash
curl -s -X POST http://localhost:5001/api/support/threads -H "x-auth-token: $TOK_USER" \
  -H 'Content-Type: application/json' -d '{"texto":"hola","hilo":{"$ne":null}}'
# debe dar 400 / NOT_FOUND tambien cuando el jugador SI tiene hilos propios
```

---

## INY-06 — Cuerpo excedido y errores de cast devuelven 500 en vez de 413/400

- **Severidad:** Baja
- **Categoría:** Manejo de errores
- **Archivo:** `backend/index.js:149-152`
- **Confianza:** Alta (probado)
- **Esfuerzo del arreglo:** Bajo

### Descripción

La red de seguridad del final convierte **todo** lo que no atrapó nadie en un 500:

```js
/* backend/index.js:149-152 */
app.use((err, req, res, _next) => {
  logger.error("[sin atrapar]", err && err.stack ? err.stack : err);
  res.status(500).json(errorDe("SOMETHING_WENT_WRONG", {}, 500).aRespuesta());
});
```

El `PayloadTooLargeError` de body-parser y los `SyntaxError` de JSON mal formado son errores
**del que pide**, no del servidor, y hoy salen como 500.

### Impacto concreto

1. El cliente no puede distinguir "tu archivo es muy grande" de "el servidor se rompió", así
   que la pantalla de KYC muestra el mensaje genérico cuando lo correcto sería "achicá la foto".
2. Cada pedido con un cuerpo grande escribe un *stack trace* entero en el registro. Eso lo
   convierte en una forma cómoda de llenar el buffer de `utils/logger` (`ultimas`) y empujar
   afuera las líneas que de verdad importan — que son las que mira el panel en `/admin/logs`.

### Pasos exactos para reproducir

1. `POST /api/wallet/promo` con un cuerpo JSON de 1 MB (el tope de esa ruta es 200 KB).

### PoC y respuestas reales

```
POST /api/wallet/promo  {"code":"<1 MB de A>"}
< 500 (27ms) {"success":false,"code":"SOMETHING_WENT_WRONG","message":"Something went wrong.","data":{}}

POST /api/profile/verification/2  (foto de ~13 MB, tope del cuerpo 12 MB)
< 500 (402ms) {"success":false,"code":"SOMETHING_WENT_WRONG","message":"Something went wrong.","data":{}}
```

(Ambos deberían ser 413.)

### Arreglo propuesto

```diff
--- a/backend/index.js
+++ b/backend/index.js
 app.use((err, req, res, _next) => {
+  /*
+    LO QUE ES CULPA DEL QUE PIDE NO ES UN 500.
+
+    Un cuerpo demasiado grande y un JSON mal armado son errores de 4xx: el
+    cliente los tiene que poder distinguir, y sobre todo NO tienen que
+    escribir un stack entero en el registro. Sin esto, mandar cuerpos
+    gigantes en serie empuja fuera del buffer las lineas que importan.
+  */
+  if (err && (err.type === "entity.too.large" || err.status === 413)) {
+    return res.status(413).json(errorDe("FILE_TOO_BIG", {}, 413).aRespuesta());
+  }
+  if (err && (err.type === "entity.parse.failed" || err instanceof SyntaxError)) {
+    return res.status(400).json(errorDe("INVALID_AMOUNT", { campo: "body" }, 400).aRespuesta());
+  }
+
   logger.error("[sin atrapar]", err && err.stack ? err.stack : err);
   res.status(500).json(errorDe("SOMETHING_WENT_WRONG", {}, 500).aRespuesta());
 });
```

### Cómo verificar

```bash
node -e 'fetch("http://localhost:5001/api/wallet/promo",{method:"POST",
  headers:{"Content-Type":"application/json","x-auth-token":process.env.TOK},
  body:JSON.stringify({code:"A".repeat(1024*1024)})}).then(r=>console.log(r.status))'
# 413
```

---

## INY-07 — KYC: se cree el tipo declarado del data-URI, no se mira el contenido real

- **Severidad:** Info
- **Categoría:** Subida de archivos
- **Archivo:** `backend/services/verification/index.js:73,103-120`
- **Confianza:** Alta (probado; **no es explotable hoy**)
- **Esfuerzo del arreglo:** Bajo

### Descripción

`TIPOS_OK` comprueba el **prefijo que declara el cliente**, no los bytes:

```js
/* backend/services/verification/index.js:73 */
const TIPOS_OK = /^data:(image\/(png|jpeg|webp)|application\/pdf);base64,[A-Za-z0-9+/=]+$/;
…
/* línea 116 */
tipo: texto.slice(5, texto.indexOf(";")),   // ← el tipo sale del mismo texto que mandó el cliente
```

Así que un `data:image/png;base64,` con HTML adentro entra. Lo probé:

```
POST /api/profile/verification/2
  {"documento":"passport","paisEmisor":"AR","numero":"X1",
   "foto":"data:image/png;base64,PHNjcmlwdD5hbGVydChkb2N1bWVudC5kb21haW4pPC9zY3JpcHQ+"}
   (ese base64 es "<script>alert(document.domain)</script>")
< 200 {"success":true, …}

GET /api/admin/verification/6aff45c6339f8098e3886348/files/foto   (owner)
< 200 {"success":true,"data":{"campo":"foto","nombre":"foto",
       "contenido":"data:image/png;base64,PHNjcmlwdD5hbGVydChkb2N1bWVudC5kb21haW4pPC9zY3JpcHQ+"}}
```

### Por qué NO es un hallazgo de severidad real hoy

El panel lo usa en dos lugares, y ninguno ejecuta nada:

```html
<!-- frontend/src/views/admin/AdminJugador.vue:369-372 -->
<img v-if="kyc.mirando && esFoto(kyc.mirando)" class="adk__foto" :src="kyc.mirando.contenido" alt="">
<a v-else-if="kyc.mirando" class="ad-b ad-b--suave" :href="kyc.mirando.contenido" :download="kyc.mirando.nombre">
```
```html
<!-- frontend/src/views/admin/AdminLista.vue:193-197 -->
<img v-if="esImagen(detalle.archivos[a].contenido)" :src="detalle.archivos[a].contenido" :alt="a">
<a v-else :href="detalle.archivos[a].contenido" target="_blank" rel="noopener">
```

- En un `<img src="data:image/png;…">` el navegador usa el tipo **declarado** y no olfatea: el
  HTML de adentro no se ejecuta, se ve una imagen rota.
- El `<a href="data:…">` solo aparece para el PDF (`esFoto` / `esImagen` filtran `data:image/`),
  y los navegadores modernos **bloquean la navegación de nivel superior a `data:`** desde 2017.
- Y la regex ya no deja entrar `svg+xml` ni `text/html` (ver "Áreas que están BIEN", §6).

Lo dejo como Info porque la defensa actual depende por completo de **cómo** se dibuja el
archivo. Si mañana alguien hace un visor que abra el contenido en un iframe o en una ventana
nueva con `document.write`, esto pasa de Info a Alta sin tocar una línea del servidor.

### Arreglo propuesto (opcional, endurecimiento)

Comprobar los bytes mágicos de la cabecera, que es barato y cierra el tema:

```diff
--- a/backend/services/verification/index.js
+++ b/backend/services/verification/index.js
+/*
+  LOS PRIMEROS BYTES, NO LO QUE DICE EL CLIENTE.
+
+  `TIPOS_OK` mira el prefijo `data:…` que escribe el navegador, y eso lo
+  elige quien manda el pedido. Esto mira el archivo: hoy el panel lo
+  dibuja en un <img> y un PNG con HTML adentro no hace nada, pero el dia
+  que el visor cambie, lo unico que nos cubre es esto.
+*/
+const FIRMAS = {
+  "image/png": [0x89, 0x50, 0x4e, 0x47],
+  "image/jpeg": [0xff, 0xd8, 0xff],
+  "image/webp": [0x52, 0x49, 0x46, 0x46],       // "RIFF"
+  "application/pdf": [0x25, 0x50, 0x44, 0x46],  // "%PDF"
+};
+
+function elTipoCoincide(dataUri) {
+  const tipo = dataUri.slice(5, dataUri.indexOf(";"));
+  const firma = FIRMAS[tipo];
+  if (!firma) return false;
+  const cabeza = Buffer.from(dataUri.slice(dataUri.indexOf(",") + 1, dataUri.indexOf(",") + 13), "base64");
+  return firma.every((b, i) => cabeza[i] === b);
+}
+
@@ function leerFormulario
       if (!TIPOS_OK.test(texto)) throw errorDe("BAD_FILE_TYPE", { campo: f.campo });
+      if (!elTipoCoincide(texto)) throw errorDe("BAD_FILE_TYPE", { campo: f.campo });
```

### Cómo verificar

```bash
# un PNG de verdad (1x1) debe entrar:
#   data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==
# y el del PoC de arriba (HTML disfrazado) debe dar 400 BAD_FILE_TYPE
```

---

## INY-08 — No se limpia el EXIF de las fotos de KYC ni de los logos

- **Severidad:** Info (privacidad)
- **Categoría:** Subida de archivos
- **Archivos:** `backend/services/verification/index.js:113-119`, `backend/services/community/index.js:210-216`
- **Confianza:** Alta (por código: no hay ninguna dependencia que procese imágenes)
- **Esfuerzo del arreglo:** Medio

### Descripción

El data-URI se guarda **tal cual llegó**:

```js
/* backend/services/verification/index.js:113-119 */
archivos.push({
  campo: f.campo,
  nombre: String(cuerpo[f.campo + "Nombre"] || f.campo).slice(0, 120),
  tipo: texto.slice(5, texto.indexOf(";")),
  tamano: Math.round((texto.length * 3) / 4),
  contenido: texto,          // ← los bytes originales, EXIF incluido
});
```

`backend/package.json` no tiene `sharp`, `jimp`, `exif`, `piexif` ni nada parecido:
las dependencias son `bcryptjs`, `compression`, `cors`, `dotenv`, `express`,
`express-rate-limit`, `helmet`, `jsonwebtoken` y `mongoose`. No hay dónde se pueda estar
limpiando nada.

### Impacto concreto

La foto del pasaporte sacada con un teléfono trae, típicamente, **coordenadas GPS**, marca y
modelo del aparato y fecha/hora exacta. Eso queda guardado en la base junto al documento. En un
sitio de dinero real con jugadores en Europa, esto es dato personal de categoría especial y
alimenta un incidente mucho más grave si la base se filtra alguna vez. La atenuante buena es
que `services/verification/index.js:256` borra los archivos al resolver el nivel, así que la
ventana es corta: lo que dure la cola de revisión.

### Arreglo propuesto

Lo más barato sin agregar una dependencia al servidor es **re-codificar la imagen en el
navegador** antes de mandarla (pintarla en un `<canvas>` y exportarla con `toDataURL`, lo que
descarta el EXIF de entrada), y en el servidor comprobar que el `data:` no traiga el marcador
APP1 de EXIF. La opción robusta es `sharp` con `.rotate().toBuffer()` del lado del servidor,
pero agrega una dependencia nativa al despliegue — decisión de Dani.

Si no se hace, dejarlo escrito en el modelo de amenazas: "las fotos de KYC conservan el EXIF
mientras están en la cola de revisión".

### Cómo verificar

Subir una foto sacada con un teléfono con ubicación encendida, leerla con
`GET /admin/verification/:id/files/foto`, decodificar el base64 y buscar el marcador
`ff e1` + `Exif\0\0` en los primeros bytes. Hoy aparece.

---

## INY-09 — `LIMPIAR.idiomas` devuelve el objeto del cuerpo tal cual → 500

- **Severidad:** Info
- **Categoría:** Validación de entrada
- **Archivo:** `backend/routes/admin/editar.js:75-79`
- **Confianza:** Alta (probado)
- **Esfuerzo del arreglo:** Trivial

### Descripción

De los once limpiadores de `LIMPIAR`, diez castean. Este devuelve el objeto como vino:

```js
/* backend/routes/admin/editar.js:75-79 */
idiomas: (v) => {
  if (v && typeof v === "object") return v;        // ← sin mirar las claves ni los valores
  const texto = String(v == null ? "" : v).trim().slice(0, 300);
  return { en: texto };
},
```

Lo usan `promotions.titulo`, `promotions.texto` y `promotions.boton`. El esquema es
`{ type: Map, of: String }` (`backend/database/models/Promotion.js:21-25`), así que un objeto
anidado revienta en el cast de Mongoose.

### Impacto concreto

Un 500 desde el panel y una promoción que no se crea. No hay inyección (el objeto va como
*valor* de un `$set`, donde Mongo no interpreta operadores — lo probé) ni pollution (lo probé).
Es robustez: hoy nada impide guardar un objeto de mil claves de 300 caracteres cada una en un
documento que después sirve `/api/promotions` a todo el mundo sin sesión.

### PoC y respuesta real

```
POST /api/admin/promotions   (owner)
  {"clave":"audit-1795114674725","titulo":{"en":{"anidado":{"mas":"xxxx…"}}},"destino":"//evil.example"}
< 500 (18ms) {"success":false,"code":"SOMETHING_WENT_WRONG","message":"Something went wrong.","data":{}}
```

### Arreglo propuesto

```diff
--- a/backend/routes/admin/editar.js
+++ b/backend/routes/admin/editar.js
   idiomas: (v) => {
-    if (v && typeof v === "object") return v;
+    /*
+      Clave por clave, y cada valor como texto. Devolver el objeto tal
+      cual deja entrar uno anidado --que revienta contra el Map de
+      strings del esquema-- y uno de mil claves, que despues sirve
+      `/api/promotions` a cualquiera.
+    */
+    if (v && typeof v === "object" && !Array.isArray(v)) {
+      const salida = {};
+      for (const [k, texto] of Object.entries(v).slice(0, 20)) {
+        if (!/^[a-z]{2}(-[A-Za-z]{2,4})?$/.test(k)) continue;
+        salida[k] = String(texto == null ? "" : texto).trim().slice(0, 300);
+      }
+      return salida;
+    }
     const texto = String(v == null ? "" : v).trim().slice(0, 300);
     return { en: texto };
   },
```

### Cómo verificar

```bash
curl -s -X POST http://localhost:5001/api/admin/promotions -H "x-auth-token: $TOK" \
  -H 'Content-Type: application/json' \
  -d '{"clave":"p1","titulo":{"en":{"a":1}},"destino":"/boxes"}'
# 200, y titulo queda en {} o {"en":""} — nunca 500
```

---

## INY-10 — `portadaLimpia` asigna con una clave del usuario sin guardia

- **Severidad:** Info
- **Categoría:** Prototype pollution (no explotable)
- **Archivo:** `backend/services/community/index.js:184-196`
- **Confianza:** Alta (probado: **no contamina `Object.prototype`**)
- **Esfuerzo del arreglo:** Trivial

### Descripción

```js
/* backend/services/community/index.js:185-196 */
if (p.posiciones && typeof p.posiciones === "object") {
  for (const [clave, valor] of Object.entries(p.posiciones)) {
    …
    posiciones[String(clave).slice(0, 40)] = [    // ← la clave la elige quien manda el pedido
```

Con `clave === "__proto__"`, la asignación va al *setter* de `__proto__` del objeto literal
`posiciones`: le cambia el prototipo a ese objeto en particular. **No** toca
`Object.prototype`, que es lo que importaría.

### Impacto concreto

Ninguno demostrable. Lo verifiqué:

```
POST /api/community  …,"portada":{"posiciones":{"__proto__":[1,2]}}
< 200
GET /api/community/mine →
  "portada":{"color":"#9b30ff","textura":"liso","estilo":2,"asoman":[],
             "logoIzquierdo":"","logoDerecho":""}       ← ni siquiera queda `posiciones`

GET /api/public/settings → ¿aparece 'polucionado'?: false
GET /api/health          → {"success":true,"ok":true,…}
```

Lo anoto porque es el patrón que, copiado a otro lugar donde el objeto destino sí se mezcle
con algo, sí sería pollution.

### Arreglo propuesto

```diff
--- a/backend/services/community/index.js
+++ b/backend/services/community/index.js
-  const posiciones = {};
+  /* `create(null)` para que una clave `__proto__` sea una clave y no el
+     setter del prototipo. */
+  const posiciones = Object.create(null);
   if (p.posiciones && typeof p.posiciones === "object") {
     for (const [clave, valor] of Object.entries(p.posiciones)) {
+      if (clave === "__proto__" || clave === "constructor" || clave === "prototype") continue;
```

### Cómo verificar

```bash
# guardar una caja con posiciones.__proto__ y leerla de vuelta:
# `posiciones` tiene que venir con esa clave como clave normal (o filtrada), nunca vacío
```

---

## INY-11 — `GET /wallet/deposit` refleja el parámetro crudo en el error

- **Severidad:** Info
- **Categoría:** Fuga de información (mínima)
- **Archivo:** `backend/services/cashier/index.js:50-51`
- **Confianza:** Alta (probado)
- **Esfuerzo del arreglo:** Trivial

### Descripción

```js
/* backend/services/cashier/index.js:50-51 */
const par = buscar(ticker, red);
if (!par) throw errorDe("NOT_FOUND", { ticker, red });   // ← `ticker` tal cual llegó
```

Con el parámetro repetido en la query, `ticker` es un array y vuelve entero en el JSON:

```
GET /api/wallet/deposit?coin=a&coin=b   (token de jugador)
< 400 {"success":false,"code":"NOT_FOUND","message":"That does not exist.","data":{"ticker":["a","b"],"red":""}}
```

### Impacto concreto

Prácticamente ninguno: es una respuesta `application/json` (no se dibuja como HTML en ningún
lado) y el valor es el que mandó el propio cliente. Lo anoto por consistencia con el resto de
la API, donde los errores llevan datos ya limpios.

### Arreglo propuesto

```diff
--- a/backend/services/cashier/index.js
+++ b/backend/services/cashier/index.js
 async function direccionDeDeposito({ userId, ticker, red }) {
-  const par = buscar(ticker, red);
-  if (!par) throw errorDe("NOT_FOUND", { ticker, red });
+  /* Lo que vuelve en el error va limpio, como en el resto de la API. */
+  const pedido = String(Array.isArray(ticker) ? ticker[0] : ticker || "").slice(0, 10);
+  const laRed = String(Array.isArray(red) ? red[0] : red || "").slice(0, 20);
+  const par = buscar(pedido, laRed);
+  if (!par) throw errorDe("NOT_FOUND", { ticker: pedido, red: laRed });
```

### Cómo verificar

```bash
curl -s -H "x-auth-token: $TOK_USER" "http://localhost:5001/api/wallet/deposit?coin=a&coin=b"
# "ticker":"a" (una cadena), nunca un array
```

---

## Apéndice — cómo reproducir todo

Los scripts quedaron en el scratchpad de esta sesión:

```
C:\Users\Usuario\AppData\Local\Temp\claude\129b3a634fe72b46\ba2ec5dc-2307-4c6d-8248-ec61480eb51f\scratchpad\probar.js        (arnés: fetch + impresión)
C:\Users\Usuario\AppData\Local\Temp\claude\129b3a634fe72b46\ba2ec5dc-2307-4c6d-8248-ec61480eb51f\scratchpad\casos_nosql.js   (inyección NoSQL)
C:\Users\Usuario\AppData\Local\Temp\claude\129b3a634fe72b46\ba2ec5dc-2307-4c6d-8248-ec61480eb51f\scratchpad\casos_xss.js     (XSS / validación)
C:\Users\Usuario\AppData\Local\Temp\claude\129b3a634fe72b46\ba2ec5dc-2307-4c6d-8248-ec61480eb51f\scratchpad\casos_com.js     (portada de la comunidad)
C:\Users\Usuario\AppData\Local\Temp\claude\129b3a634fe72b46\ba2ec5dc-2307-4c6d-8248-ec61480eb51f\scratchpad\casos_kyc.js     (KYC: tipos y acceso)
C:\Users\Usuario\AppData\Local\Temp\claude\129b3a634fe72b46\ba2ec5dc-2307-4c6d-8248-ec61480eb51f\scratchpad\casos_size.js    (topes de tamaño)
C:\Users\Usuario\AppData\Local\Temp\claude\129b3a634fe72b46\ba2ec5dc-2307-4c6d-8248-ec61480eb51f\scratchpad\casos_pag.js     (topes de paginación)
C:\Users\Usuario\AppData\Local\Temp\claude\129b3a634fe72b46\ba2ec5dc-2307-4c6d-8248-ec61480eb51f\scratchpad\casos_proto.js   (lookups, pollution, ReDoS)
C:\Users\Usuario\AppData\Local\Temp\claude\129b3a634fe72b46\ba2ec5dc-2307-4c6d-8248-ec61480eb51f\scratchpad\casos_pp.js      (pollution con cuerpo crudo)
C:\Users\Usuario\AppData\Local\Temp\claude\129b3a634fe72b46\ba2ec5dc-2307-4c6d-8248-ec61480eb51f\scratchpad\casos_arr.js     (parámetros repetidos)
C:\Users\Usuario\AppData\Local\Temp\claude\129b3a634fe72b46\ba2ec5dc-2307-4c6d-8248-ec61480eb51f\scratchpad\casos_banner.js  (open redirect)
```

Se corren con `node probar.js <nombre>` desde esa carpeta, con `tok_user.txt` y `tok_admin.txt`
al lado (los genera el login contra `/api/auth/login`).

**Limpieza:** borré todo lo que creé en la base local — los tres banners de prueba, las dos
cajas de comunidad y la dirección con el payload. Quedaron sin borrar, porque la API no ofrece
cómo: un hilo de soporte con `<img src=x onerror=alert(1)>` en el asunto, una campaña de
afiliado llamada igual, y la verificación de nivel 2 de `almondy` (la dejé rechazada). Nada de
eso toca producción: la base es `mongodb://127.0.0.1:27017/mrbox_local`.

**No toqué ningún archivo de `C:\Users\Usuario\mrbox`.** Todos los diffs de este informe son
propuestas para que las aplique quien corresponda.
