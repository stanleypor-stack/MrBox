# MR BOX — mapa del sistema

Reconocimiento previo a la auditoría. Todo lo de acá está verificado leyendo el
repositorio, no supuesto.

## Qué es esto en realidad

El pliego de auditoría describe una plataforma con dos monedas (GC/SC), slots,
dice, crash, mines, plinko, towers, coinflip, battles, chat con rain, tips entre
jugadores, PayPal, WebAuthn, Redis y docker-compose. **Nada de eso existe en
MR BOX.** Ese pliego viene de BetSweeps. Lo que hay acá es:

- **Una sola moneda: SC** (1 SC = 1 USD). No hay moneda de juego separada.
- **Cajas misteriosas** con sorteo ponderado y objetos físicos reales.
- **Deals**: un minijuego de apuesta de un objeto contra una probabilidad.
- **Inventario**: vender un objeto de vuelta o pedir que te lo envíen.
- Carreras, desafíos, rakeback por rango VIP, afiliados, cajas de la comunidad.
- Depósitos y pagos en cripto por **OxaPay**. Tarjeta por **EUPay**, a medias.

Las secciones del pliego que no aplican se marcan como N/A en el informe, con el
motivo. No se inventan hallazgos sobre funcionalidad que no existe.

## Stack

| Capa | Qué | Versión |
|---|---|---|
| Runtime | Node | >= 20 |
| API | Express | ^5.3.0 |
| Base | MongoDB vía Mongoose | ^9.12.2 |
| Sesión | jsonwebtoken | ^9.0.3 |
| Contraseñas | bcryptjs | ^3.0.3 |
| Cabeceras | helmet | ^8.1.0 |
| Límites | express-rate-limit | ^8.7.4 |
| Otros | cors, compression, dotenv | |
| Frontend | Vue | ^2.7.16 |
| | vue-router 3, vuex 3, vue-i18n 8, axios, qrcode | |

**No hay**: socket.io, Redis, docker, multer, Cloudinary, passport, ejs, cheerio,
nodemailer, geoip, IPQS, express-fingerprint, ni SDK de PayPal.

### Cómo se levanta

- API: `cd backend && npm start` (o `npm run dev`). Puerto 5001 por defecto.
- Sitio: `cd frontend && npm run serve`. Puerto 8090.
- Pruebas: `cd backend && npm test` (node:test, 209 pruebas).
- Base local: MongoDB en `mrbox_local`.

No hay `docker-compose.yml`, así que la sección 8 del pliego sobre credenciales
por defecto de Mongo/Redis y puertos 27017/6379 expuestos **no aplica**: el
despliegue previsto es Render con una base administrada.

### Variables de entorno (solo nombres)

`DATABASE_URI`, `PORT`, `SITIO_URL`, `JWT_SECRET`, `TURNSTILE_SECRET_KEY`,
`OXAPAY_MERCHANT_KEY`, `OXAPAY_PAYOUT_KEY`, `OXAPAY_CALLBACK_SECRET`,
`OXAPAY_CALLBACK_URL`, `AUTH_RATE_LIMIT`, `OPEN_RATE_LIMIT`,
`AFFILIATE_RATE_LIMIT`, `LOG_LEVEL`, `TEST_DB_URI`.

`backend/.env` está en `.gitignore`. `MONGO_URI` aparece en el código pero la
conexión real usa `DATABASE_URI` y falla fuerte si falta, sin valor por defecto
(`backend/database/index.js:18-21`), que es lo correcto.

`NODE_ENV` no se usa en ningún lado del backend: no hay distinción entre
desarrollo y producción en el código.

## Cadena de middleware (backend/index.js)

1. `trust proxy = 1`
2. `cors(ORIGENES)` — allowlist desde `SITIO_URL`; **sin la variable deja pasar a todos**
3. `compression()`
4. `helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false })`
5. Cuerpo JSON: 200 KB general, 12 MB en `/api/profile/verification` y `/api/community`
6. `/api` → el router
7. `dist/` del frontend si existe
8. 404 en JSON, y un manejador de error que registra el stack y devuelve genérico

## Autenticación

`backend/middleware/auth.js`. La sesión viaja en la cabecera `x-auth-token` (no
en cookie), lo que hace que CSRF no sea aplicable. El token lleva **solo el id**;
el rango, el saldo y el nivel de verificación se releen de la base en cada
pedido, así que quitarle el admin a alguien tiene efecto inmediato. Dura 30 días.

- `autorizar(true)` exige sesión. `autorizar(false)` deja pasar al visitante.
- Una cuenta con `banned` no pasa, tenga el token que tenga.
- `soloAdmin(rangos = ["admin","owner"])` para el panel.

## Inventario de rutas HTTP

Todo cuelga de `/api`. Las que mueven saldo están marcadas con **$**.

### Públicas (sin sesión)

| Método | Ruta | Archivo:línea |
|---|---|---|
| GET | /health | routes/index.js:31 |
| GET | /public/settings | routes/public/index.js:22 |
| GET | /public/banners | routes/public/index.js:64 |
| GET | /public/counts | routes/public/index.js:86 |
| POST | /auth/register | routes/auth/index.js:108 (rate limit) |
| POST | /auth/login | routes/auth/index.js:200 (rate limit) |
| GET | /boxes, /categories, /rows, /gifts, /:slug, /feed/latest | routes/boxes/index.js |
| POST | /boxes/:slug/demo | routes/boxes/index.js:328 (rate limit) |
| GET | /deals/items, /quote, /verify/:id | routes/deals/index.js |
| POST | /deals/demo | routes/deals/index.js:121 |
| GET | /community/boxes | routes/community/index.js:37 |
| POST | /community/quote | routes/community/index.js:223 |
| GET | /races, /races/past, /races/:tipo | routes/races/index.js |
| GET | /challenges | routes/challenges/index.js:17 |
| GET | /promotions | routes/promotions/index.js:29 |
| GET | /vip | routes/vip/index.js:22 |
| GET | /affiliates/ranks | routes/affiliates/index.js:202 |
| POST | /affiliates/click/:code | routes/affiliates/index.js:360 |
| GET | /support/config | routes/support/index.js:42 |
| GET | /wallet/coins | routes/wallet/index.js:45 |
| POST | /hooks/... | aviso de OxaPay, firmado |

### Con sesión

| Método | Ruta | $ | Archivo:línea |
|---|---|---|---|
| GET | /auth/me | | routes/auth/index.js:270 |
| POST | /boxes/:slug/open | **$** | routes/boxes/index.js:355 |
| GET | /inventory | | routes/inventory/index.js:35 |
| POST | /inventory/:id/sell | **$** | routes/inventory/index.js:105 |
| POST | /inventory/sell-many | **$** | routes/inventory/index.js:121 |
| GET/POST | /inventory/fair/seed, /fair/rotate, /fair/verify/:id | | routes/inventory/index.js:158-194 |
| GET | /inventory/openings | | routes/inventory/index.js:204 |
| POST | /inventory/ship | | routes/inventory/index.js:249 |
| POST | /inventory/ship/:orderId/cancel | | routes/inventory/index.js:263 |
| POST | /deals/play | **$** | routes/deals/index.js:136 |
| GET | /deals/mine | | routes/deals/index.js:153 |
| GET | /profile/transactions, /stats, /orders, /activity | | routes/profile/index.js |
| GET/POST/PUT/DELETE | /profile/addresses[/:id] | | routes/profile/index.js:197-257 |
| GET/PUT | /profile/controls, POST /controls/break | | routes/profile/index.js:332-353 |
| GET | /profile/verification | | routes/profile/index.js:364 |
| POST | /profile/verification/:nivel | | routes/profile/index.js:381 |
| GET | /wallet/deposit | | routes/wallet/index.js:72 |
| POST | /wallet/deposit/tx | | routes/wallet/index.js:95 |
| GET/POST | /wallet/withdraw | **$** | routes/wallet/index.js:121-130 |
| POST | /wallet/code | **$** | routes/wallet/index.js:169 |
| POST | /wallet/promo | **$** | routes/wallet/index.js:292 |
| GET | /wallet/withdrawals | | routes/wallet/index.js:314 |
| POST | /wallet/withdrawals/:id/cancel | **$** | routes/wallet/index.js:323 |
| GET | /vip/rakeback | | routes/vip/index.js:39 |
| POST | /vip/rakeback/:periodo | **$** | routes/vip/index.js:47 |
| GET | /community/mine, /earnings, /payments | | routes/community/index.js |
| POST/PUT/DELETE | /community[/:id][/submit] | | routes/community/index.js:249-289 |
| GET | /affiliates | | routes/affiliates/index.js:193 |
| POST/PATCH | /affiliates/campaigns[/:id][/code][/claim] | **$** | routes/affiliates/index.js:227-337 |
| GET/POST | /support/threads[/:id][/close] | | routes/support/index.js |

### Panel (exige rango admin u owner)

`backend/routes/admin/index.js:36` aplica `router.use(autorizar(true), soloAdmin())`.
Los sub-routers (`extra.js`, `afiliados.js`, `editar.js`, `jugador.js`,
`carreras.js`) se montan en las líneas 1271-1297, **después** de las rutas
propias. 69 rutas en total. Las que mueven plata:

| Método | Ruta | Archivo:línea |
|---|---|---|
| POST | /admin/players/:id/balance | admin/index.js:287 |
| POST | /admin/players/:id/gifts | admin/jugador.js:440 |
| POST | /admin/redemptions/:id/:accion | admin/extra.js:151 |
| POST | /admin/races/:id/settle | admin/carreras.js:107 |
| POST | /admin/races/:id/pay/:userId | admin/carreras.js:148 |
| POST | /admin/affiliates/conversions/:id/pay | admin/afiliados.js:393 |
| PUT | /admin/settings | admin/index.js:1058 (solo owner) |
| POST/PUT/DELETE | /admin/:cosa[/:id] | admin/editar.js:232-293 (genéricas) |

## Sockets

**No hay.** No existe `backend/sockets/`, no hay socket.io en las dependencias.
Toda la sección 3.7 del pliego es N/A.

## Trabajos programados

**No hay carpeta `backend/cron/`.** Hay un solo reloj, en `backend/index.js:150`
(`revisarLasCarreras`), que corre cada hora con `unref()`:

1. `carreras.ponerAlDia()` — cierra carreras vencidas y reparte premios.
2. `afiliados.liberarCalificados()` — paga CPA que ya cumplieron la espera. Las
   conversiones con señales de riesgo **no** se pagan solas: esperan a que una
   persona las mire.

Es el único camino por el que se mueve plata sin que haya un pedido HTTP, así que
es el punto que más importa de esta sección.

## Webhooks y callbacks externos

Uno solo: `/api/hooks`, montado en `routes/index.js:27`, que es el aviso de pago
de OxaPay. Se autentica por firma, no por sesión. `DepositoAvisado` (trackId
único, creado antes de acreditar) es lo que impide la doble acreditación.

## Modelos con campos sensibles

| Modelo | Campos que importan |
|---|---|
| User | balanceSc, bonoPendienteSc, jugadoSc, rank, verificationLevel, banned, trabas, limites, freeOpens, cajasGratis, demosUsadas, redemptionLock, passwordHash |
| BalanceTransaction | amountSc, balanceBefore, balanceAfter, byAdmin — el libro mayor |
| Box | priceSc, prizes[].chance/peso, retorno, live, approvalState, creator, ganadoPorElCreadorSc, margenPendienteSc |
| BoxOpen | semillaServidor, semillaServidorHash, semillaCliente, nonce, hmac, premio |
| UserSeed | semillaServidor, semillaServidorHash, nonce, activa |
| InventoryItem | valueSc, state, soldFor, order |
| Redemption | montoSc, direccion, estado, pasarelaId |
| Verification | datos, archivos, adjuntos — los documentos de identidad |
| AffiliateCode | jugadoPorLosSuyosSc, ganadoSc, margenPendienteSc, cobradoSc |
| PromoCode | montoSc, usosMaximos, usos |
| Settings | retornoObjetivo, topePremioSc, parteDelCreador, canjeMinimoSc, canjeNivelMinimo, envioNivelMinimo, bonoPorDeposito, vecesAJugarElBono |

## Integraciones de terceros

| Servicio | Para qué | Dónde |
|---|---|---|
| OxaPay (merchant) | cobrar depósitos en cripto | services/wallet, routes/wallet |
| OxaPay (payout) | pagar los canjes | services/cashier |
| Cloudflare Turnstile | captcha del registro | services/turnstile.js |
| EUPay | tarjeta, a medias | pendiente de dominio |

No hay Cloudinary, ni correo saliente, ni IMAP, ni geolocalización, ni proveedor
de puntuación de riesgo.

## Rutas del frontend

`frontend/src/router/index.js`, 250 líneas, **sin ningún guardia de navegación**.
Es deliberado y está comentado en la línea 153: el panel se puede abrir en el
navegador pero todas sus llamadas van contra `/api/admin`, que exige el rango en
el servidor. Eso es lo correcto; lo que hay que verificar es que ninguna ruta de
`/api/admin` se escape del middleware. Está en la auditoría de autorización.

Rutas que piden sesión de hecho (no por guardia): /inventory, /profile,
/dashboard, /rewards, /affiliates, /create.

## Estado del entorno al momento de auditar

- `npm test` (backend): **209 pruebas, 209 pasan, 0 fallan**.
- `npm run build` (frontend): **exit 0**, sin errores.
- No hay linter configurado en ninguno de los dos paquetes.
