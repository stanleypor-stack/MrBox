# MR BOX — Auditoría de autenticación, sesiones y autorización

Alcance: `backend/middleware/auth.js`, `backend/routes/auth/**`, `backend/services/turnstile.js`,
`backend/routes/admin/**` (los 6 archivos), todas las rutas con `:id` de jugador, y
`frontend/src/router/` + `frontend/src/views/admin/`.

Solo lectura. Nada del repo fue modificado. Las pruebas se corrieron con scripts aparte en el
scratchpad, montando los routers reales **sin** base de datos.

Fuera de alcance por ya estar reportado: JWT de 30 días irrevocable, falta de límite por cuenta,
el admin que crea saldo sin tope, Turnstile que falla abierto. Donde algo de eso se combina con un
hallazgo nuevo, se nombra como contexto, no como hallazgo.

---

## Resumen

| ID | Título | Severidad | Confianza |
|----|--------|-----------|-----------|
| AUTH-01 | El freno de `/auth` se saltea cambiando `X-Forwarded-For` | Alta | Confirmado (mecanismo) |
| AUTH-02 | El registro dice cuál email y cuál usuario ya existen | Media | Confirmado |
| AUTH-03 | No hay cambio de contraseña, ni reset, ni verificación de email | Media | Confirmado |
| AUTH-04 | Sin granularidad de roles: el rango `support` no concede nada | Media | Confirmado |
| AUTH-05 | Cuerpos de 12 MB parseados sin sesión y sin freno | Media | Confirmado |
| AUTH-06 | Un login cuesta ~800 ms de CPU y no hay freno efectivo | Media | Confirmado |
| AUTH-07 | `/api/deals/verify/:id` devuelve el recibo de cualquiera | Baja | Confirmado |
| AUTH-08 | `JWT_SECRET` no se comprueba al arrancar | Baja | Confirmado |
| AUTH-09 | Contraseña de `owner` fija en `scripts/sembrar.js` | Baja | Confirmado |
| AUTH-10 | `COSAS[req.params.cosa]` sin `hasOwnProperty` | Info | Confirmado |

**Lo que está bien y lo verifiqué** está al final, en "Áreas sanas". Es la parte más larga del
informe y es a propósito: la autorización de este backend está bien hecha.

---

## AUTH-01 — El freno de `/auth` se saltea cambiando `X-Forwarded-For`

- **Severidad:** Alta
- **Categoría:** Control de acceso / fuerza bruta
- **Archivo:** `backend/index.js:36` + `backend/routes/auth/index.js:43-49`
- **Confianza:** Confirmado el mecanismo (probado). Sospecha **alta** de que aplique en producción:
  depende de cuántos proxies haya delante, y eso no lo puedo ver desde el código.
- **Esfuerzo del arreglo:** chico

### Qué está mal

`backend/index.js:36`:

```js
app.set("trust proxy", 1);
```

`backend/routes/auth/index.js:43`:

```js
const limite = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT) || 10,
  ...
});
```

`express-rate-limit` cuenta por `req.ip`, y con `trust proxy` en 1 Express calcula `req.ip`
descartando **un** salto desde la derecha de `X-Forwarded-For`. Eso es correcto si y solo si delante
hay exactamente un proxy que agrega la cabecera. Hay dos formas de que no se cumpla, y las dos son
malas:

- **Cero proxies** (desarrollo, un `node index.js` expuesto, un contenedor sin balanceador delante):
  la cabecera la pone el cliente entera, así que el cliente **elige su propia `req.ip`** y el freno
  no cuenta nada.
- **Dos proxies** (si algún día entra Cloudflare delante de Render): `req.ip` pasa a ser la IP del
  proxy intermedio, igual para todo el mundo. El freno entonces cuenta a todos juntos y a los diez
  intentos **deja afuera al planeta entero**. Es el escenario que el comentario de `index.js:31-35`
  dice querer evitar, y `trust proxy: 1` solo lo evita con exactamente un salto.

### Impacto

Es el único freno que hay sobre `/api/auth/login` y `/api/auth/register`. No hay bloqueo por cuenta
(ya reportado), así que si este se cae, no queda nada: prueba de contraseñas ilimitada contra
cualquier cuenta, incluidas las de rango `admin` y `owner`, que son las que pueden crear saldo y
aprobar canjes. También habilita la enumeración masiva de AUTH-02 y el agotamiento de CPU de
AUTH-06.

### Reproducción en local

Copia exacta de las dos configuraciones del repo:

```js
const app = express();
app.set("trust proxy", 1);                                    // index.js:36
const limite = rateLimit({ windowMs: 15*60*1000, max: 10 });  // auth/index.js:43
app.post("/login", limite, (req, res) => res.json({ ip: req.ip }));
```

Resultado medido:

```
A) 14 intentos SIN cabecera:
   #10 -> 200 {"ipQueVeElServidor":"::1"}
   #11 -> 429 {"code":"RATE_LIMITED"}          <- frena bien
   bloqueados: 4/14

B) 50 intentos cambiando X-Forwarded-For:
   #1  XFF=203.0.113.1  -> 200 {"ipQueVeElServidor":"203.0.113.1"}
   #50 XFF=203.0.113.50 -> 200 {"ipQueVeElServidor":"203.0.113.50"}
   bloqueados: 0/50                            <- no frena nada
```

Contra la API de verdad (`localhost:5001`), con el servidor arrancado sin proxy delante:

```bash
for i in $(seq 1 40); do
  curl -s -o /dev/null -w "%{http_code} " -X POST http://localhost:5001/api/auth/login \
    -H 'content-type: application/json' -H "x-forwarded-for: 203.0.113.$i" \
    --data '{"email":"dani@mrbox.local","password":"mal"}'
done
# Son 40 "401". Sin la cabecera, del 11 en adelante son "429".
```

### Arreglo propuesto

Que el número de saltos sea una variable, no una constante, y que el freno no dependa solo de la IP:

```diff
--- a/backend/index.js
+++ b/backend/index.js
-app.set("trust proxy", 1);
+/*
+  Cuántos proxies hay DELANTE de este servidor. Es un dato del despliegue,
+  no del código: en Render es 1, con Cloudflare delante de Render es 2, y
+  arrancándolo a mano es 0. Con el número equivocado `req.ip` deja de ser
+  la del jugador, y el freno de intentos cuenta cualquier cosa.
+*/
+app.set("trust proxy", Number(process.env.PROXIES_DELANTE ?? 0));
```

```diff
--- a/backend/routes/auth/index.js
+++ b/backend/routes/auth/index.js
 const limite = rateLimit({
   windowMs: 15 * 60 * 1000,
   max: Number(process.env.AUTH_RATE_LIMIT) || 10,
   standardHeaders: true,
   legacyHeaders: false,
+  /*
+    La IP sola no alcanza: si `trust proxy` no coincide con el despliegue,
+    la elige el que ataca. La cuenta a la que se le pega es un dato que no
+    puede mentir, así que se cuenta por las dos cosas.
+  */
+  keyGenerator: (req) => {
+    const quien = String(req.body && (req.body.email || req.body.username) || "")
+      .trim().toLowerCase().slice(0, 120);
+    return `${req.ip}|${quien}`;
+  },
   handler: (req, res) => res.status(429).json(errorDe("RATE_LIMITED", {}, 429).aRespuesta()),
 });
```

Y en `.env.example`, junto a `SITIO_URL`:

```
# Cuantos proxies hay delante del servidor. Render = 1. Cloudflare + Render = 2.
# Arrancandolo a mano, sin nada delante = 0. Si este numero no coincide con la
# realidad, el limite de intentos de login cuenta la IP equivocada.
PROXIES_DELANTE=1
```

### Cómo verificar que quedó arreglado

1. Con `PROXIES_DELANTE=0`, repetir el bucle de arriba: del intento 11 en adelante tiene que dar
   429 **aunque** cambie `X-Forwarded-For` en cada pedido.
2. Con `PROXIES_DELANTE=1` y un proxy de prueba delante que agregue la cabecera, comprobar que dos
   clientes con IP distinta se cuentan por separado (ninguno de los dos frena al otro).

---

## AUTH-02 — El registro dice cuál email y cuál usuario ya existen

- **Severidad:** Media
- **Categoría:** Fuga de información / enumeración de cuentas
- **Archivo:** `backend/routes/auth/index.js:134-135` (y `147`)
- **Confianza:** Confirmado
- **Esfuerzo del arreglo:** medio (necesita email, ver abajo)

### Qué está mal

```js
    if (await User.exists({ username })) throw errorDe("USERNAME_TAKEN");
    if (await User.exists({ email })) throw errorDe("EMAIL_TAKEN");
```

El login está muy bien cuidado contra esto (`auth/index.js:238-252`: un solo código de error para
los dos casos, y un hash de relleno para que el tiempo tampoco lo cuente). El registro deshace ese
trabajo: contesta `EMAIL_TAKEN` solo cuando el email existe, y `USERNAME_TAKEN` solo cuando el
nombre existe. Son dos oráculos distintos, y cada uno cuesta un pedido.

El comentario de las líneas 128-133 explica por qué se hace ("para poder decir CUÁL de los dos está
tomado"), que es una razón de usabilidad real. Pero el precio es que `/register` contesta la
pregunta que `/login` se niega a contestar.

### Impacto

Con una lista de emails filtrada de otro sitio, se averigua cuáles tienen cuenta en MR BOX a un
pedido por email. Con el freno de AUTH-01 saltado, eso es toda la base de usuarios en minutos. Lo
que sale de ahí: una lista de direcciones de gente que juega con dinero real, que es exactamente la
lista que se compra para phishing dirigido ("tu retiro está pendiente, entrá acá"). Y como no hay
verificación de email (AUTH-03), tampoco hay forma de que el jugador distinga el aviso falso.

El mismo oráculo sirve para apuntar la fuerza bruta: en vez de probar contraseñas contra cuentas que
no existen, se prueban solo contra las que sí.

### Reproducción en local

```bash
# Un email que no existe: el registro avanza y falla por otra cosa (o crea la cuenta).
curl -s -X POST http://localhost:5001/api/auth/register -H 'content-type: application/json' \
  --data '{"username":"zzz001","email":"nadie@ejemplo.com","password":"12345678"}'

# Un email que SI existe (de scripts/sembrar.js):
curl -s -X POST http://localhost:5001/api/auth/register -H 'content-type: application/json' \
  --data '{"username":"zzz002","email":"dani@mrbox.local","password":"12345678"}'
# -> {"success":false,"code":"EMAIL_TAKEN",...}
```

El segundo contesta `EMAIL_TAKEN` sin más datos, y eso ya es la respuesta.

### Arreglo propuesto

El nombre de usuario es público en el sitio (aparece en el feed y en las carreras), así que decir
que está tomado no revela nada. El email sí. La forma habitual es no contestar sobre el email en el
momento y mandar el aviso a la casilla:

```diff
--- a/backend/routes/auth/index.js
+++ b/backend/routes/auth/index.js
     if (await User.exists({ username })) throw errorDe("USERNAME_TAKEN");
-    if (await User.exists({ email })) throw errorDe("EMAIL_TAKEN");
+
+    /*
+      EL EMAIL NO SE CONTESTA ACA.
+
+      El nombre de usuario es publico --sale en el feed y en las carreras--
+      asi que decir que esta tomado no cuenta nada que no se vea igual. El
+      email no: contestar "ya existe" convierte a esta ruta en un buscador
+      de cuentas, que es justo lo que /login se cuida de no ser.
+
+      Si ya hay cuenta con ese email, se contesta lo MISMO que si no la
+      hubiera y se le manda un aviso a la casilla ("alguien quiso registrarse
+      con tu email; si fuiste vos, entra por aca"). El que tiene la casilla se
+      entera; el que solo tiene la lista, no.
+    */
+    const yaTieneCuenta = await User.exists({ email });
+    if (yaTieneCuenta) {
+      await avisos.alguienQuisoRegistrarse(email);
+      return res.status(201).json({ success: true, revisaTuCorreo: true });
+    }
```

Mientras no haya servicio de email (ver AUTH-03), el paliativo mínimo es que los dos casos devuelvan
el mismo código genérico y que el freno de AUTH-01 esté arreglado, de modo que enumerar cueste caro.

### Cómo verificar que quedó arreglado

Registrar con un email existente y con uno inexistente, y comprobar que el cuerpo de la respuesta,
el código HTTP y el tiempo de respuesta son indistinguibles. Un `curl -w '%{time_total}'` sobre
veinte de cada uno no debería separar los dos grupos.

---

## AUTH-03 — No hay cambio de contraseña, ni reset, ni verificación de email

- **Severidad:** Media
- **Categoría:** Gestión del ciclo de vida de credenciales
- **Archivo:** `backend/routes/auth/index.js` (las únicas rutas son `/register`, `/login`, `/me`);
  `frontend/src/views/AuthView.vue:133`
- **Confianza:** Confirmado
- **Esfuerzo del arreglo:** grande (necesita servicio de email)

### Qué está mal

El router de autenticación tiene tres rutas y nada más:

```
routes/auth/index.js:108   router.post("/register", limite, ...)
routes/auth/index.js:200   router.post("/login", limite, ...)
routes/auth/index.js:270   router.get("/me", autorizar(true), ...)
```

Un `grep` por `reset|forgot|recuperar|changePassword|nuevaClave|verify-email` sobre
`backend/routes`, `backend/services` y `backend/middleware` no devuelve ninguna implementación: los
únicos aciertos son la validación de largo en el registro y el `bcrypt.compare` del login.

En el frontend, el enlace existe pero no hace nada (`AuthView.vue:133`):

```html
<a v-if="!esRegistro" href="#" @click.prevent="avisarPendiente">{{ $t('auth.forgot') }}</a>
```

Lo mismo con los botones de Google y Facebook (líneas 81 y 90), que llaman al mismo
`avisarPendiente`. Eso coincide con lo que me dijiste: **no hay OAuth implementado, y no inventé
hallazgos sobre eso.**

### Impacto

No es una funcionalidad que falte: es un agujero de recuperación.

1. **Una contraseña comprometida no se puede rotar.** El jugador que reusó la clave de otro sitio
   filtrado no tiene ninguna forma de cambiarla. Ni él ni soporte: no hay ruta.
2. **Se combina con el token de 30 días irrevocable** (ya reportado). Hoy, si a alguien le roban la
   sesión, el atacante entra 30 días y el dueño no puede hacer nada: no puede cambiar la clave
   (porque no existe), y cambiarla tampoco invalidaría el token (porque no hay revocación). Las dos
   cosas por separado son molestas; juntas significan que **una cuenta tomada queda tomada**, con su
   saldo, su inventario y sus direcciones de envío.
3. **Sin verificación de email, el email no sirve para recuperar.** Hoy nadie comprobó que la
   casilla sea del jugador, así que mañana no se puede usar para devolverle la cuenta sin convertir
   el reset en una forma de robarla.
4. Una cuenta registrada con un email ajeno es indistinguible de una legítima, lo que complica el
   KYC y las disputas de pago.

### Reproducción en local

No hay nada que reproducir: es ausencia. Se comprueba así:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:5001/api/auth/forgot   # 404
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:5001/api/auth/reset    # 404
curl -s -o /dev/null -w '%{http_code}\n' -X PUT  http://localhost:5001/api/auth/password # 404
```

Y en el sitio (`localhost:8090/login`), tocar "¿Olvidaste tu contraseña?" muestra el cartel de
"pendiente".

### Arreglo propuesto

Por orden de lo que más tapa con menos trabajo:

**1. Cambio de contraseña con la vieja (no necesita email, se puede hacer ya):**

```diff
--- a/backend/routes/auth/index.js
+++ b/backend/routes/auth/index.js
+/**
+ * CAMBIAR LA CONTRASEÑA.
+ *
+ * Pide la vieja: sin eso, un token robado --y los de aca duran 30 dias--
+ * alcanza para quedarse con la cuenta para siempre.
+ */
+router.put("/password", autorizar(true), limite, async (req, res) => {
+  try {
+    const actual = String(req.body.actual || "");
+    const nueva = String(req.body.nueva || "");
+    if (nueva.length < CLAVE_MINIMA) {
+      throw errorDe("BELOW_MINIMUM", { campo: "password", minimo: CLAVE_MINIMA });
+    }
+
+    const u = await User.findById(req.user._id).select("+passwordHash").lean();
+    if (!u || !(await bcrypt.compare(actual, u.passwordHash))) {
+      throw errorDe("BAD_CREDENTIALS", {}, 401);
+    }
+
+    await User.updateOne(
+      { _id: u._id },
+      { $set: { passwordHash: await bcrypt.hash(nueva, 12), clavesDesde: new Date() } }
+    );
+    await anotarSesion(u._id, req, "password");
+
+    return res.json({ success: true, token: firmar(u._id) });
+  } catch (err) {
+    return responderError(res, err, "password");
+  }
+});
```

**2. Que cambiar la clave invalide las sesiones viejas.** El campo `clavesDesde` de arriba, más tres
líneas en el middleware, resuelven de paso la mitad del problema de revocación ya reportado:

```diff
--- a/backend/middleware/auth.js
+++ b/backend/middleware/auth.js
-      const { id } = jwt.verify(token, process.env.JWT_SECRET);
+      const { id, iat } = jwt.verify(token, process.env.JWT_SECRET);
       const usuario = await User.findById(id)
         .select("+balanceSc +bonoPendienteSc")
         .lean();

       if (!usuario) throw new Error("no existe");
+
+      /* Un token firmado ANTES del ultimo cambio de clave no vale mas.
+         Es lo que convierte "cambie la contraseña" en "lo eche". */
+      if (usuario.clavesDesde && iat * 1000 < new Date(usuario.clavesDesde).getTime()) {
+        throw new Error("sesion vieja");
+      }
```

**3. Reset por email y verificación de la casilla** cuando haya servicio de correo. Token de un solo
uso, guardado hasheado, válido una hora, y la respuesta de "te mandamos el correo" igual exista o no
la cuenta (si no, el reset se convierte en el oráculo de AUTH-02).

### Cómo verificar que quedó arreglado

1. Cambiar la contraseña con la vieja correcta: 200. Con la vieja equivocada: 401.
2. Guardar un token, cambiar la contraseña, y comprobar que ese token guardado ahora da 401 en
   `GET /api/auth/me`.
3. Que el token nuevo que devuelve el cambio sí funcione.

---

## AUTH-04 — Sin granularidad de roles: el rango `support` no concede nada

- **Severidad:** Media
- **Categoría:** Autorización / diseño de permisos
- **Archivo:** `backend/middleware/auth.js:64`, `backend/routes/admin/index.js:36`,
  `backend/routes/admin/editar.js:426`, `backend/database/models/User.js:201`
- **Confianza:** Confirmado
- **Esfuerzo del arreglo:** medio

### Qué está mal

El modelo define cuatro rangos (`User.js:201`):

```js
rank: { type: String, enum: ["user", "support", "admin", "owner"], default: "user", index: true },
```

El panel los ofrece los cuatro para asignar (`editar.js:426`):

```js
    if (!["user", "support", "admin", "owner"].includes(rango)) throw errorDe("INVALID_AMOUNT");
```

Pero la única puerta del panel es (`admin/index.js:36`):

```js
router.use(autorizar(true), soloAdmin());
```

y `soloAdmin` sin argumentos es (`middleware/auth.js:64`):

```js
function soloAdmin(rangos = ["admin", "owner"]) {
```

Busqué `"support"` en todo `routes/`, `services/`, `middleware/` y `database/`. Aparece exactamente
tres veces: en el `enum` del modelo, en la validación de `/team/:id`, y en el filtro de la lista de
equipo (`admin/index.js:996`). **Ninguna ruta lo acepta como rango que habilite nada.** El frontend
coincide (`store/index.js:80`: `["admin","owner"].includes(s.usuario.rank)`), así que el que tiene
`support` entra a `/admin` y ve el cartel de "no permitido".

De las ~76 rutas del panel, exactamente **una** tiene permiso más fino: `PUT /settings`
(`admin/index.js:1058`, `soloAdmin(["owner"])`). Todo el resto es admin-o-owner, sin distinción.

### Impacto

No es un bypass —falla cerrado, que es lo correcto— pero es una trampa operativa con consecuencias
de plata. El rango `support` existe, se puede asignar desde el panel y no hace nada. La persona a la
que se lo asignan no puede trabajar. La salida obvia para quien administra es darle `admin`, y
`admin` incluye, sin ningún control adicional:

- `POST /api/admin/players/:id/balance` — crear saldo (`admin/index.js:287`);
- `POST /api/admin/redemptions/:id/:accion` — aprobar y pagar canjes en cripto
  (`admin/extra.js:151`);
- `POST /api/admin/affiliates/conversions/:id/pay` — pagar comisiones (`afiliados.js:393`);
- `POST /api/admin/races/:id/settle` y `/pay/:userId` — liquidar y pagar premios
  (`carreras.js:107,148`);
- `GET /api/admin/verification/:id/files/:campo` — descargar la foto del pasaporte de cualquier
  jugador (`admin/index.js:854`).

O sea: contratar a alguien para contestar el chat de soporte termina, en la práctica, dándole la
llave de la caja y del archivo de documentos. Que el admin pueda crear saldo sin tope ya está
reportado; lo que agrego acá es que **no hay ningún rango intermedio al que dárselo**, y que el
único control que sí existe (`owner` para `/settings`) demuestra que el mecanismo está y no se usó.

Lo bueno: un `admin` **no** puede ascenderse a `owner`. `POST /team/:id` exige `owner`
(`editar.js:422`), `editar.js` no expone el modelo `User` en su lista blanca, y ninguna ruta de
`jugador.js` escribe `rank`. Eso lo verifiqué una por una y está bien.

### Reproducción en local

```bash
# 1. Como owner (dani), darle rango "support" a un jugador:
curl -s -X POST http://localhost:5001/api/admin/team/<ID_DEL_JUGADOR> \
  -H "x-auth-token: <TOKEN_DE_OWNER>" -H 'content-type: application/json' \
  --data '{"rank":"support"}'
# -> {"success":true,"data":{"rank":"support"}}

# 2. Entrar con ese jugador y pedir cualquier cosa del panel:
curl -s http://localhost:5001/api/admin/support -H "x-auth-token: <TOKEN_DEL_SUPPORT>"
# -> 403. Lo mismo con /dashboard, /players, /verification: las 76 rutas.
```

En el sitio: entrar a `localhost:8090/admin` con esa cuenta muestra el cartel de "no permitido".

### Arreglo propuesto

Dar contenido al rango que ya existe, en vez de sacarlo:

```diff
--- a/backend/routes/admin/index.js
+++ b/backend/routes/admin/index.js
-router.use(autorizar(true), soloAdmin());
+/*
+  LA PUERTA DEL PANEL: entra soporte tambien.
+
+  Lo que soporte NO puede hacer se marca ruta por ruta mas abajo. Es al
+  reves de como estaba --todo admin, nada mas-- porque asi el que contesta
+  el chat puede trabajar sin que haya que darle la llave de la caja.
+*/
+router.use(autorizar(true), soloAdmin(["support", "admin", "owner"]));
```

y después, en las rutas que mueven plata o muestran documentos:

```diff
-router.post("/players/:id/balance", async (req, res) => {
+router.post("/players/:id/balance", soloAdmin(), async (req, res) => {
```

```diff
-router.get("/verification/:id/files/:campo", async (req, res) => {
+router.get("/verification/:id/files/:campo", soloAdmin(), async (req, res) => {
```

Lo mismo en `extra.js:151` (`/redemptions/:id/:accion`), `afiliados.js:393` y `:418`
(`/conversions/:id/pay` y `/void`), y `carreras.js:107` y `:148` (`/settle` y `/pay/:userId`).

Y que el frontend lo acompañe, para que el menú no muestre lo que después da 403:

```diff
--- a/frontend/src/store/index.js
+++ b/frontend/src/store/index.js
-    esAdmin: (s) => !!s.usuario && ["admin", "owner"].includes(s.usuario.rank),
+    /* Quien puede ENTRAR al panel. Lo que puede HACER adentro lo decide el
+       servidor ruta por ruta; esto solo dibuja. */
+    entraAlPanel: (s) => !!s.usuario && ["support", "admin", "owner"].includes(s.usuario.rank),
+    esAdmin: (s) => !!s.usuario && ["admin", "owner"].includes(s.usuario.rank),
```

### Cómo verificar que quedó arreglado

Con un token de rango `support`:

- `GET /api/admin/support` y `GET /api/admin/players/:id` → 200.
- `POST /api/admin/players/:id/balance` → 403.
- `POST /api/admin/redemptions/:id/approve` → 403.
- `GET /api/admin/verification/:id/files/frente` → 403.

Y que el registro del panel (`AdminLog`) siga anotando quién hizo cada cosa, con el rango incluido.

---

## AUTH-05 — Cuerpos de 12 MB parseados sin sesión y sin freno

- **Severidad:** Media
- **Categoría:** Denegación de servicio / consumo de recursos
- **Archivo:** `backend/index.js:93-100`
- **Confianza:** Confirmado (probado)
- **Esfuerzo del arreglo:** chico

### Qué está mal

```js
const SUBEN_ARCHIVOS = [/^\/api\/profile\/verification(\/|$)/, /^\/api\/community(\/|$)/];
const cuerpoChico = express.json({ limit: "200kb" });
const cuerpoGrande = express.json({ limit: "12mb" });

app.use((req, res, next) => {
  const grande = SUBEN_ARCHIVOS.some((r) => r.test(req.path));
  return (grande ? cuerpoGrande : cuerpoChico)(req, res, next);
});

app.use("/api", require("./routes"));
```

La decisión de tamaño se toma **por ruta de URL, antes del router**. O sea antes de `autorizar`,
antes de `soloAdmin` y antes de cualquier `rateLimit`. El efecto es que cualquiera —sin cuenta,
sin token— puede mandar 12 MB de JSON a cualquier dirección que empiece con `/api/community` y el
servidor los va a leer y parsear enteros antes de darse cuenta de que no hay nada que hacer con
ellos.

Y `/api/community` tiene rutas públicas: `router.get("/boxes", ...)` (`routes/community/index.js:37`)
no pide sesión. Tampoco hay ningún `rateLimit` en ese router (el `grep` de `rateLimit(` sobre
`routes/` da cinco resultados: `auth`, `boxes`, `support`, `wallet` y `affiliates`; `community`,
`profile`, `inventory` y `deals` no tienen).

### Impacto

Un atacante sin cuenta ocupa 12 MB de memoria del servidor por pedido en vuelo, más el tiempo de
`JSON.parse`. Con unas pocas decenas de pedidos concurrentes se llena la memoria de un plan chico
de Render y el proceso se reinicia; mientras tanto el sitio no responde, y un sitio de apuestas que
no responde es un sitio que no cobra. No hace falta ninguna credencial y no queda nada en el
registro, porque el pedido muere antes de llegar a una ruta.

Se combina con AUTH-01: el único control que podría frenarlo no existe en ese router.

Nota sobre lo que **no** es: la verificación de identidad no crece sin límite. `services/verification
/index.js:215` usa `findOneAndUpdate({user, nivel}, ..., {upsert:true})`, o sea una fila por nivel y
por jugador, que se pisa; y `resolver()` borra los archivos al aprobar o rechazar
(`verification/index.js:258`). Eso está bien pensado. El problema es solo el parseo, no el
almacenamiento.

### Reproducción en local

Copia exacta de `index.js:93-100`, con un manejador que solo informa cuánto se parseó:

```
cuerpo enviado: 8 MB, SIN cabecera de sesion

  POST  /api/boxes/x/open                -> 413 {"error":"entity.too.large"}
  POST  /api/auth/login                  -> 413 {"error":"entity.too.large"}
  GET   /api/community/boxes             -> 200 {"bytesParseados":8388616}
  POST  /api/community                   -> 200 {"bytesParseados":8388616}
  POST  /api/profile/verification/2      -> 200 {"bytesParseados":8388616}
```

Contra la API de verdad:

```bash
# 8 MB de JSON a una ruta publica, sin token:
node -e 'process.stdout.write(JSON.stringify({x:"A".repeat(8*1024*1024)}))' > /tmp/grande.json
curl -s -o /dev/null -w '%{http_code} %{time_total}s\n' \
  -X GET http://localhost:5001/api/community/boxes \
  -H 'content-type: application/json' --data-binary @/tmp/grande.json
# Contesta 200 con la lista de cajas: ley_ los 8 MB para nada.

# La misma carga a una ruta normal:
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:5001/api/auth/login \
  -H 'content-type: application/json' --data-binary @/tmp/grande.json
# 413, como corresponde.
```

### Arreglo propuesto

Que el cuerpo grande se habilite por **método y ruta exacta**, no por prefijo, y que esas dos rutas
tengan su propio freno:

```diff
--- a/backend/index.js
+++ b/backend/index.js
-const SUBEN_ARCHIVOS = [/^\/api\/profile\/verification(\/|$)/, /^\/api\/community(\/|$)/];
+/*
+  QUIEN PUEDE MANDAR 12 MB: EL METODO TAMBIEN CUENTA.
+
+  Con el prefijo solo, un GET sin sesion a /api/community/boxes tambien se
+  llevaba los 12 MB: el cuerpo se parsea ACA, antes del router, o sea antes
+  de `autorizar` y antes de cualquier freno. Cualquiera sin cuenta ocupaba
+  12 MB por pedido.
+*/
+const SUBEN_ARCHIVOS = [
+  { metodos: ["POST"], ruta: /^\/api\/profile\/verification\/[123]$/ },
+  { metodos: ["POST", "PUT"], ruta: /^\/api\/community(\/[0-9a-f]{24})?$/i },
+];
 const cuerpoChico = express.json({ limit: "200kb" });
 const cuerpoGrande = express.json({ limit: "12mb" });

 app.use((req, res, next) => {
-  const grande = SUBEN_ARCHIVOS.some((r) => r.test(req.path));
+  const grande = SUBEN_ARCHIVOS.some((s) => s.metodos.includes(req.method) && s.ruta.test(req.path));
   return (grande ? cuerpoGrande : cuerpoChico)(req, res, next);
 });
```

Y un freno en los dos routers que suben archivos, por ejemplo en `routes/community/index.js`:

```diff
+/* Subir una caja con sus fotos es caro: pocas por minuto alcanzan de sobra. */
+const limiteSubida = rateLimit({
+  windowMs: 60 * 1000,
+  max: 10,
+  standardHeaders: true,
+  legacyHeaders: false,
+  message: { success: false, error: { code: "RATE_LIMITED" } },
+});

-router.post("/", autorizar(true), async (req, res) => {
+router.post("/", autorizar(true), limiteSubida, async (req, res) => {
```

(y lo mismo en `PUT /:id` de community y en `POST /verification/:nivel` de profile).

### Cómo verificar que quedó arreglado

1. `GET /api/community/boxes` con 8 MB de cuerpo → 413.
2. `POST /api/community` con 8 MB y sin token → 413 o 401, nunca 200.
3. `POST /api/community` con token y 8 MB → 200 las primeras diez veces del minuto, 429 después.
4. Que subir una caja de comunidad de verdad, desde el sitio, siga funcionando.

---

## AUTH-06 — Un login cuesta ~800 ms de CPU y no hay freno efectivo

- **Severidad:** Media
- **Categoría:** Denegación de servicio / consumo de recursos
- **Archivo:** `backend/routes/auth/index.js:137` y `:249-250`, `backend/package.json` (`bcryptjs`)
- **Confianza:** Confirmado (medido)
- **Esfuerzo del arreglo:** chico

### Qué está mal

El proyecto usa `bcryptjs`, que es una implementación en **JavaScript puro** (no hay ningún `.node`
en `node_modules/bcryptjs`), con factor de costo 12:

```js
    const passwordHash = await bcrypt.hash(password, 12);        // :137, registro
...
    const hash = (usuario && usuario.passwordHash) || "$2a$12$" + "x".repeat(53);
    const coincide = await bcrypt.compare(password, hash);       // :249-250, login
```

El costo 12 es una buena elección de seguridad —no es el problema—. El problema es la combinación de
costo 12 **con una implementación en JS puro**: `bcryptjs` es del orden de cinco a diez veces más
lento que una implementación nativa, y como Node es de un solo hilo, ese tiempo sale del mismo lugar
donde se atienden todos los demás pedidos.

Medido en esta máquina, 12 comparaciones intercaladas de cada tipo:

```
relleno (usuario inexistente): mediana 750.2 ms   min 497.3  max 1424.3
hash real (usuario existente): mediana 813.1 ms   min 675.1  max 1804.4
```

Casi **un segundo de CPU por intento de login**, exista la cuenta o no — el hash de relleno de la
línea 249 hace el trabajo completo, que es justamente lo que lo hace servir contra el ataque por
tiempo (ver "Áreas sanas").

### Impacto

A razón de ~0,8 s de CPU por pedido, poco más de un login por segundo satura un contenedor de medio
núcleo, que es lo que da un plan chico de Render. No hace falta adivinar ninguna contraseña: alcanza
con pedir, y se puede pedir con un email que no existe. Con el freno saltado por AUTH-01, un solo
cliente tira el sitio entero. Y mientras el proceso está haciendo bcrypt, también están esperando
las aperturas de caja, los depósitos y el aviso de pago de OxaPay.

### Reproducción en local

```bash
# Un solo intento, para ver el costo:
curl -s -o /dev/null -w 'un login: %{time_total}s\n' -X POST http://localhost:5001/api/auth/login \
  -H 'content-type: application/json' --data '{"email":"noexiste@ejemplo.com","password":"x"}'

# Veinte en paralelo, cada uno con su X-Forwarded-For para saltar el freno (AUTH-01),
# y en otra terminal, mirar cuanto tarda algo que no tiene nada que ver:
for i in $(seq 1 20); do
  curl -s -o /dev/null -X POST http://localhost:5001/api/auth/login \
    -H 'content-type: application/json' -H "x-forwarded-for: 198.51.100.$i" \
    --data '{"email":"noexiste@ejemplo.com","password":"x"}' &
done
curl -s -o /dev/null -w 'health mientras tanto: %{time_total}s\n' http://localhost:5001/api/health
```

`/api/health` no toca la base ni hace criptografía: lo que tarde de más es tiempo que el servidor no
tenía para nadie.

### Arreglo propuesto

Dos cosas, ninguna de las dos es bajar el costo:

**1. Usar la implementación nativa.** `bcrypt` (el paquete con binding en C) corre el mismo costo 12
en una décima parte del tiempo **y lo hace fuera del hilo principal**, en el pool de libuv, así que
no bloquea a nadie. Los hashes son compatibles: los `$2a$`/`$2b$` ya guardados siguen validando.

```diff
--- a/backend/package.json
+++ b/backend/package.json
-    "bcryptjs": "^3.0.3",
+    "bcrypt": "^5.1.1",
```

```diff
--- a/backend/routes/auth/index.js
+++ b/backend/routes/auth/index.js
-const bcrypt = require("bcryptjs");
+/*
+  `bcrypt` y no `bcryptjs`: el mismo costo 12, pero nativo y en el pool de
+  hilos. En JavaScript puro cada intento son ~800 ms del UNICO hilo de Node,
+  o sea que un login por segundo deja al resto del sitio esperando.
+*/
+const bcrypt = require("bcrypt");
```

(hay que cambiar el `require` en los cuatro lugares: `routes/auth/index.js:2` y los `scripts/sembrar*`
que generan los hashes de prueba.)

**2. Comprobar la forma antes de gastar el bcrypt.** Si el email ni siquiera parece un email, no hay
razón para pagar 800 ms:

```diff
--- a/backend/routes/auth/index.js
+++ b/backend/routes/auth/index.js
     const esEmail = escrito.includes("@");
+
+    /* Si no tiene forma ni de email ni de usuario, no hay cuenta posible:
+       se contesta lo mismo que siempre, pero sin pagar el bcrypt. */
+    if (!escrito || (esEmail ? !EMAIL_OK.test(escrito.toLowerCase()) : !USUARIO_OK.test(escrito))) {
+      throw errorDe("BAD_CREDENTIALS", {}, 401);
+    }
```

Esto no reabre la enumeración: la forma del email la sabe el que lo escribió, no dice nada sobre si
existe la cuenta.

Y arreglar AUTH-01, que es lo que pone el techo.

### Cómo verificar que quedó arreglado

1. Medir un login: con `bcrypt` nativo tiene que bajar a decenas de milisegundos.
2. Repetir la prueba de los veinte en paralelo y comprobar que `/api/health` sigue contestando en
   pocos milisegundos.
3. Comprobar que las cuentas creadas **antes** del cambio siguen pudiendo entrar (compatibilidad de
   los hashes ya guardados).

---

## AUTH-07 — `/api/deals/verify/:id` devuelve el recibo de cualquier jugador

- **Severidad:** Baja
- **Categoría:** IDOR / fuga de información
- **Archivo:** `backend/routes/deals/index.js:195-201`, `backend/services/deals/index.js` (`verificar`)
- **Confianza:** Confirmado
- **Esfuerzo del arreglo:** trivial

### Qué está mal

```js
router.get("/verify/:id", async (req, res) => {
  try {
    return res.json({ success: true, data: await deals.verificar({ dealId: req.params.id }) });
```

Sin `autorizar`, y el servicio tampoco filtra por dueño:

```js
async function verificar({ dealId }) {
  const recibo = await Deal.findById(dealId).lean();
  if (!recibo) throw errorDe("ITEM_NOT_FOUND", {}, 404);
```

Lo que devuelve (`sinSecretos`) incluye `itemName`, `valueSc`, `chance`, `stakeSc`, `gano`, las
semillas, el nonce y la fecha de una jugada **de cualquier jugador**.

La ruta hermana, la de las cajas, sí filtra (`services/boxes/index.js:548`):

```js
  const recibo = await BoxOpen.findOne({ _id: boxOpenId, user: user._id })
```

y la ruta que la expone pide sesión (`routes/inventory/index.js:194`). O sea: la misma función, en
el mismo producto, resuelta de las dos maneras.

### Impacto

Bajo, y conviene decir por qué: el recibo **no trae el id ni el nombre del jugador**, hace falta
adivinar un `ObjectId` de 24 caracteres hexadecimales para pedir uno, y la semilla del servidor que
devuelve es una que ya se reveló al rotar, que por diseño es pública. Lo que queda es que, con un
`dealId` conseguido por otro lado (un enlace compartido, un registro, una captura), se ve la apuesta
y el resultado de otra persona.

Lo reporto igual por dos razones: es una inconsistencia con la ruta equivalente de cajas, y es el
tipo de ruta que mañana devuelve un campo más y ahí sí importa.

Vale aclarar que hay un argumento legítimo para que esta ruta sea pública: la verificación de
"provably fair" se vuelve más creíble si un tercero puede comprobar la jugada sin tener cuenta. Si
esa es la intención, el arreglo es escribirlo y dejarla pública a propósito, no dejarla así por
omisión mientras la de cajas hace lo contrario.

### Reproducción en local

```bash
# Como jugador A, jugar un deal y quedarse con el _id:
curl -s -X POST http://localhost:5001/api/deals/play -H "x-auth-token: <TOKEN_A>" \
  -H 'content-type: application/json' --data '{"itemId":"<ID>","chance":0.25,"veces":1}'
curl -s http://localhost:5001/api/deals/mine -H "x-auth-token: <TOKEN_A>" | head -c 400
# tomar un _id de la lista

# Sin ningun token, con el _id de A:
curl -s http://localhost:5001/api/deals/verify/<DEAL_ID_DE_A>
# -> devuelve el recibo entero de A.

# Comparar con la de cajas, que si filtra:
curl -s http://localhost:5001/api/inventory/fair/verify/<BOXOPEN_ID_DE_A> -H "x-auth-token: <TOKEN_B>"
# -> 404 ITEM_NOT_FOUND, correcto.
```

### Arreglo propuesto

```diff
--- a/backend/routes/deals/index.js
+++ b/backend/routes/deals/index.js
-router.get("/verify/:id", async (req, res) => {
+/* Igual que la de cajas (inventory/fair/verify/:boxOpenId): el recibo es
+   del que jugo, asi que se pide sesion y se filtra por dueño. */
+router.get("/verify/:id", autorizar(true), async (req, res) => {
   try {
-    return res.json({ success: true, data: await deals.verificar({ dealId: req.params.id }) });
+    return res.json({ success: true, data: await deals.verificar({ user: req.user, dealId: req.params.id }) });
```

```diff
--- a/backend/services/deals/index.js
+++ b/backend/services/deals/index.js
-async function verificar({ dealId }) {
-  const recibo = await Deal.findById(dealId).lean();
+async function verificar({ user, dealId }) {
+  const recibo = await Deal.findOne({ _id: dealId, user: user._id }).lean();
   if (!recibo) throw errorDe("ITEM_NOT_FOUND", {}, 404);
```

### Cómo verificar que quedó arreglado

- Sin token: 401.
- Con el token de B y un `dealId` de A: 404.
- Con el token de A y su propio `dealId`: 200, igual que antes.

---

## AUTH-08 — `JWT_SECRET` no se comprueba al arrancar

- **Severidad:** Baja
- **Categoría:** Configuración / disponibilidad
- **Archivo:** `backend/index.js:196-203`, `backend/middleware/auth.js:19-21`
- **Confianza:** Confirmado
- **Esfuerzo del arreglo:** trivial

### Qué está mal

`arrancar()` comprueba la base y nada más:

```js
async function arrancar() {
  const base = await conectar();
  const puerto = Number(process.env.PORT) || 5001;
  app.listen(puerto, () => { ... });
}
```

`firmar()` sí comprueba el secreto, pero recién cuando alguien intenta entrar
(`middleware/auth.js:19-21`), y `autorizar` pasa `undefined` directamente a `jwt.verify`
(`auth.js:40`).

**Lo bueno:** falla cerrado. Lo probé: `jwt.verify(token, undefined)` lanza
`secret or public key must be provided`, lo atrapa el `catch` de la línea 55 y contesta 401. No hay
forma de que un token sin firma pase por acá. Tampoco con el secreto en `""`: la librería exige
declarar `"none"` en `algorithms` para aceptar tokens sin firmar, y el código nunca lo hace.

### Impacto

No es un bypass; es una caída silenciosa. Un despliegue sin `JWT_SECRET` arranca bien, dice "MR BOX
escuchando" en el registro, sirve el catálogo y las cajas, y recién falla cuando el primer jugador
intenta entrar: `/login` contesta 500 y `/me` contesta 401, o sea que **nadie puede usar su cuenta**
mientras el servidor parece sano. En un sitio con dinero real, media hora de eso son depósitos que
no entran y canjes que no se piden.

Hay un segundo efecto, más grave y más silencioso: si el secreto se define pero **cambia** entre
despliegues (por ejemplo porque se genera al vuelo en vez de fijarse en el entorno), todas las
sesiones se caen de golpe y el único síntoma es un pico de 401 — el `.env.example:22` lo advierte
("si cambia, se cierran todas las sesiones abiertas") pero nada lo comprueba.

### Reproducción en local

```bash
cd /c/Users/Usuario/mrbox/backend
# Arrancar sin el secreto (sin tocar el .env):
env -u JWT_SECRET node -e '
  require("dotenv").config({path:"/dev/null"});
  process.env.DATABASE_URI="mongodb://127.0.0.1:27017/mrbox_local";
  delete process.env.JWT_SECRET;
  require("./index.js").arrancar();
'
# El registro dice "MR BOX escuchando en 5001". Despues:
curl -s http://localhost:5001/api/health            # {"success":true,...}  parece sano
curl -s -X POST http://localhost:5001/api/auth/login -H 'content-type: application/json' \
  --data '{"email":"dani@mrbox.local","password":"mrbox12345"}'
# -> 500 SOMETHING_WENT_WRONG
```

### Arreglo propuesto

```diff
--- a/backend/index.js
+++ b/backend/index.js
 async function arrancar() {
+  /*
+    LO QUE NO PUEDE FALTAR, SE MIRA ACA.
+
+    Sin `JWT_SECRET` el servidor arranca igual, sirve el catalogo y parece
+    sano: lo unico que no anda es entrar a una cuenta, y eso se descubre
+    cuando lo descubre un jugador. Mejor no arrancar.
+
+    El largo tambien: un secreto de ocho caracteres se prueba entero, y con
+    el se firman sesiones de treinta dias.
+  */
+  const secreto = process.env.JWT_SECRET || "";
+  if (secreto.length < 32) {
+    throw new Error("JWT_SECRET falta o es corto: hacen falta 32 caracteres o mas, al azar.");
+  }
+
   const base = await conectar();
   const puerto = Number(process.env.PORT) || 5001;
```

### Cómo verificar que quedó arreglado

1. Sin `JWT_SECRET`: el proceso no levanta y el registro dice exactamente qué falta.
2. Con un `JWT_SECRET` de menos de 32 caracteres: tampoco levanta.
3. Con el `.env` normal: arranca igual que siempre y las sesiones existentes siguen valiendo.

---

## AUTH-09 — Contraseña de `owner` fija en `scripts/sembrar.js`

- **Severidad:** Baja
- **Categoría:** Credenciales en el código
- **Archivo:** `backend/scripts/sembrar.js:112-120` (la guarda, en `:125-128`)
- **Confianza:** Confirmado
- **Esfuerzo del arreglo:** trivial

### Qué está mal

```js
const CUENTAS = [
  { username: "dani", email: "dani@mrbox.local", rank: "owner", balanceSc: 0, verificationLevel: 3 },
  { username: "sol",  email: "sol@mrbox.local",  rank: "admin", balanceSc: 0, verificationLevel: 3 },
  ...
];

const CLAVE_DE_PRUEBA = "mrbox12345";
```

Una cuenta de rango `owner` con contraseña conocida, escrita en un archivo del repositorio.

**Lo bueno, y es importante:** hay una guarda explícita que impide correr esto contra cualquier cosa
que no sea una base local (`sembrar.js:125-128`):

```js
  const uri = process.env.DATABASE_URI || "";
  if (!/localhost|127\.0\.0\.1/.test(uri)) {
    throw new Error(`Esto solo corre contra una base local. DATABASE_URI apunta a otro lado.`);
  }
```

Está bien puesta y hace su trabajo. Y el `passwordHash` va en `$setOnInsert` (`:165`), así que
re-sembrar no le pisa la contraseña a una cuenta que ya existe.

### Impacto

Bajo mientras la guarda se cumpla. Los dos huecos que le quedan:

1. La comprobación es sobre el **texto** de la URI, no sobre adónde apunta de verdad. Un túnel SSH
   o un `port-forward` de Kubernetes contra la base de producción da una URI que dice
   `mongodb://127.0.0.1:27017/...` y pasa la guarda sin problema. En ese caso `sembrar.js` crea un
   `owner` con contraseña pública en la base de verdad.
2. `dani` / `mrbox12345` es una combinación que alguien puede probar en el sitio real sin que cueste
   nada, y hoy no hay bloqueo por cuenta (ya reportado) ni freno confiable por IP (AUTH-01).

### Reproducción en local

```bash
cd /c/Users/Usuario/mrbox/backend
# La guarda funciona:
DATABASE_URI="mongodb://un-servidor-cualquiera/mrbox" node scripts/sembrar.js
# -> Error: Esto solo corre contra una base local.

# Pero el texto es lo unico que mira:
DATABASE_URI="mongodb://127.0.0.1:27018/produccion" node scripts/sembrar.js
# -> pasa la guarda. (No lo corri: el 27018 no es una base de verdad acá.)
```

Y en el sitio local, `dani` / `mrbox12345` entra como `owner`.

### Arreglo propuesto

Que la clave de las cuentas sembradas sea del entorno, con un valor de desarrollo obvio, y que la
guarda pida además una confirmación explícita:

```diff
--- a/backend/scripts/sembrar.js
+++ b/backend/scripts/sembrar.js
-const CLAVE_DE_PRUEBA = "mrbox12345";
+/*
+  La clave de las cuentas de prueba sale del entorno.
+
+  Escrita acá, viaja en el repositorio: cualquiera que lo clone sabe la
+  contraseña del `owner`, y esa combinación se prueba en el sitio de verdad
+  sin que cueste nada.
+*/
+const CLAVE_DE_PRUEBA = process.env.CLAVE_DE_SIEMBRA || "cambiala-en-tu-env";
```

```diff
   const uri = process.env.DATABASE_URI || "";
   if (!/localhost|127\.0\.0\.1/.test(uri)) {
     throw new Error(`Esto solo corre contra una base local. DATABASE_URI apunta a otro lado.`);
   }
+
+  /*
+    El texto de la URI no prueba nada: un tunel a la base de produccion
+    tambien dice 127.0.0.1. Esto no lo puede comprobar un script, asi que
+    lo confirma una persona.
+  */
+  if (process.env.SEMBRAR_DE_VERDAD !== "si") {
+    throw new Error("Para sembrar, correlo con SEMBRAR_DE_VERDAD=si. Mira a que base apunta primero.");
+  }
```

Y, aparte del arreglo: cambiarle la contraseña a `dani` y a `sol` en cualquier entorno que haya sido
sembrado alguna vez con la clave del repositorio.

### Cómo verificar que quedó arreglado

1. `node scripts/sembrar.js` sin `SEMBRAR_DE_VERDAD=si` no hace nada y explica por qué.
2. Con las dos variables puestas, siembra igual que antes.
3. `grep -rn "mrbox12345" backend/` no devuelve nada.

---

## AUTH-10 — `COSAS[req.params.cosa]` sin `hasOwnProperty`

- **Severidad:** Info
- **Categoría:** Robustez
- **Archivo:** `backend/routes/admin/editar.js:234`, `:257`, `:295`
- **Confianza:** Confirmado (por lectura; no es explotable, ver abajo)
- **Esfuerzo del arreglo:** trivial

### Qué está mal

```js
router.post("/:cosa", async (req, res) => {
  try {
    const cosa = COSAS[req.params.cosa];
    if (!cosa) throw errorDe("NOT_FOUND");
```

`COSAS` es un objeto literal, así que hereda de `Object.prototype`. Con `cosa` igual a `__proto__`,
`constructor` o `toString`, la búsqueda devuelve algo **verdadero** y el `if (!cosa)` no lo atrapa.
Lo mismo en `:257` (`put`) y `:295` (`delete`).

**No es explotable.** Lo seguí hasta el final: el objeto que vuelve no tiene `campos`, así que
`armar()` llega a `Object.entries(cosa.campos)` con `undefined` y lanza; o, en el `put`/`delete`,
`cosa.modelo.findById` lanza `TypeError`. En los dos casos cae en el `catch`, que no es
`ErrorDeJugador`, y `responderError` contesta un 500 genérico sin filtrar nada
(`utils/errors.js:143`: la respuesta solo lleva `code`, `message` y `data`; el `stack` va al
registro, no al navegador). Y las tres rutas están detrás de `autorizar(true) + soloAdmin()`, o sea
que hace falta ser admin para siquiera llegar.

Lo anoto porque es la clase de descuido que deja de ser inocuo en cuanto alguien agregue un camino
que use `cosa` antes de tocar `campos` o `modelo`.

### Impacto

Ninguno hoy. Un 500 en el registro, provocable solo por un admin.

### Reproducción en local

```bash
curl -s -X POST http://localhost:5001/api/admin/__proto__ \
  -H "x-auth-token: <TOKEN_DE_ADMIN>" -H 'content-type: application/json' --data '{}'
# -> 500 SOMETHING_WENT_WRONG  (en vez del 404 NOT_FOUND que corresponde)
```

### Arreglo propuesto

```diff
--- a/backend/routes/admin/editar.js
+++ b/backend/routes/admin/editar.js
+/* Solo las propias: `COSAS["__proto__"]` devuelve algo verdadero y se cuela
+   por el `if (!cosa)`. No llega a ningun lado, pero contesta 500 en vez de 404. */
+const cosaDe = (nombre) => (Object.hasOwn(COSAS, nombre) ? COSAS[nombre] : null);
...
-    const cosa = COSAS[req.params.cosa];
+    const cosa = cosaDe(req.params.cosa);
     if (!cosa) throw errorDe("NOT_FOUND");
```

(en los tres lugares: `:234`, `:257`, `:295`)

### Cómo verificar que quedó arreglado

`POST /api/admin/__proto__`, `PUT /api/admin/constructor/x` y `DELETE /api/admin/toString/x` con
token de admin devuelven 404 `NOT_FOUND`, y las entidades reales (`promotions`, `challenges`,
`races`, `banners`, `promo`) siguen funcionando.

---

# Áreas sanas

Esto no es relleno: cada punto se verificó leyendo el código, y varios se probaron corriendo. Que
estén bien es información tan útil como los hallazgos.

## El guardia del panel SÍ les aplica a los sub-routers — probado

Era la sospecha principal del encargo y **no se confirma**. El orden es correcto.

`routes/admin/index.js:36` registra `router.use(autorizar(true), soloAdmin())` **antes** que los
cinco `router.use(require("./..."))` de las líneas 1271-1297. En Express, la pila de un router se
recorre en orden de registro, así que un pedido a cualquier ruta de `extra.js`, `afiliados.js`,
`editar.js`, `jugador.js` o `carreras.js` pasa primero por el middleware de la línea 36. Que los
sub-routers se monten al final del archivo no cambia nada: lo que importa es el orden de registro,
y el guardia se registra primero.

Lo probé de verdad, montando el router real sin base de datos y pidiendo las 76 rutas sin token:

```
Rutas probadas: 76
Devolvieron 401 (guardia aplico): 76
NO devolvieron 401:
(ninguna)
```

Las 76 incluyen todas las de los seis archivos: el tablero, jugadores, saldo, baneo, movimientos,
cajas, comunidad, objetos, pedidos, verificación (datos y archivos), carreras, desafíos,
promociones, actividad, equipo, ajustes, deals, soporte, pagos, canjes, riesgo, analítica, rangos,
segmentos, portada, banners, registro, monedas, promo, legal, seo, afiliados (lista, pedidos,
conversiones, pagar, anular, escalera, ficha, rango, campañas), las genéricas de `editar.js`, las
seis de `jugador.js` y las tres de `carreras.js`.

**Ningún sub-router queda afuera.** No hay nada CRÍTICO acá.

## El manejo del JWT está bien — probado

Probé los cuatro ataques clásicos contra la versión instalada (`jsonwebtoken` 9.0.3):

```
1) alg:none                                       -> rechazado: "jwt signature is required"
2) RS256 verificado contra el secreto de texto    -> rechazado: "invalid algorithm"
   HS256 firmado con la clave publica RSA         -> rechazado: "invalid signature"
3) HS256 con el secreto correcto (control)        -> ACEPTADO, como debe ser
4) verify con secreto undefined                   -> rechazado: "secret or public key must be provided"
   verify con secreto ""                          -> rechazado: 'please specify "none" in "algorithms"'
5) token vencido                                  -> rechazado: "jwt expired"
```

Aunque `middleware/auth.js:40` no pasa la opción `algorithms`, `jsonwebtoken` 9 deduce el conjunto
permitido de la forma de la clave: con un secreto de texto que no es un PEM, solo acepta
`HS256/384/512`. Por eso ni `alg:none` ni la confusión HS/RS funcionan. Si algún día se migra a
claves asimétricas, ahí sí habría que fijar `algorithms` a mano.

El contenido del token es el mínimo —`{ id, iat, exp }`— y el comentario de `auth.js:10-13` explica
bien por qué: el rango y el saldo se leen de la base en cada pedido, así que a quien se le saca el
acceso de admin lo pierde en el acto, sin esperar a que venza el token. Eso está bien resuelto y es
mejor que lo que hace la mayoría.

`autorizar` además vuelve a mirar `banned` en cada pedido (`auth.js:48-51`), así que una cuenta
cerrada no pasa aunque tenga un token válido.

Sobre el almacenamiento: el token vive en `localStorage` (`frontend/src/api.js:26-36`) y viaja en la
cabecera `x-auth-token` (`:44`). Es una decisión con un intercambio conocido —queda expuesto a XSS,
pero inmune a CSRF— y en este proyecto está tomada de forma coherente: el comentario de
`backend/index.js:46-48` dice exactamente eso, y la configuración de CORS no activa `credentials`,
así que no hay confusión entre los dos modelos. Mientras no haya XSS, aguanta. Con una cookie
`httpOnly` + `SameSite` el token estaría mejor protegido contra XSS, pero habría que agregar defensa
CSRF, que hoy no hace falta. No lo cuento como hallazgo: es una decisión documentada y consistente.

## No hay IDOR en las rutas con `:id` — revisadas una por una

Revisé todas las que pediste, más las que aparecieron al buscar. **Todas** filtran por dueño, no
solo por `_id`:

| Ruta | Dónde se filtra |
|------|-----------------|
| `POST /inventory/:id/sell` | `services/boxes/index.js:505` — `findOneAndUpdate({_id, user: user._id, state:"held"})` |
| `POST /inventory/sell-many` | misma función, por cada id |
| `GET /inventory/fair/verify/:boxOpenId` | `services/boxes/index.js:548` — `findOne({_id, user: user._id})` |
| `POST /inventory/ship` | `services/shipping/index.js:71` — `find({_id:{$in}, user: user._id, state:"held"})`; la dirección en `:65` |
| `POST /inventory/ship/:orderId/cancel` | `services/shipping/index.js:167` — `findOne({_id: orderId, user: user._id})` |
| `PUT /profile/addresses/:id` | `routes/profile/index.js:230` — `updateOne({_id, user: req.user._id})` + `matchedCount` |
| `DELETE /profile/addresses/:id` | `routes/profile/index.js:240` — `findOneAndDelete({_id, user})` |
| `POST /profile/addresses/:id/default` | `routes/profile/index.js:259` — `exists({_id, user})` antes de marcar |
| `GET /profile/orders` | `routes/profile/index.js:272` — `find({user: req.user._id})` |
| `GET /profile/verification` y `POST /verification/:nivel` | por `req.user._id`; el nivel es `[1,2,3]` y exige el anterior |
| `GET /support/threads/:id` | `services/support/index.js:80` — `findOne({_id: hiloId, user: userId})` |
| `POST /support/threads` (con `hilo`) | `services/support/index.js:103` — ídem |
| `POST /support/threads/:id/close` | `services/support/index.js:159` — ídem |
| `PUT /community/:id`, `/submit`, `DELETE` | `services/community/index.js:261`, `:280`, `:293` — `findOne({_id, creator: user._id})` |
| `PATCH /affiliates/campaigns/:id` | `routes/affiliates/index.js:260` — `findOneAndUpdate({_id, owner: req.user._id})` |
| `POST /affiliates/campaigns/:id/code` | `routes/affiliates/index.js:297` — `findOne({_id, owner})` |
| `POST /affiliates/campaigns/:id/claim` | `services/affiliates/index.js:619` — `findOne({_id: codigoId, owner: userId})` |
| `POST /wallet/withdrawals/:id/cancel` | `services/cashier/index.js:244` — `findOneAndUpdate({_id, user: userId, estado:"pending"})` |

La única excepción es `GET /deals/verify/:id`, que es AUTH-07.

Un detalle que merece mención porque está bien pensado: varias de estas ponen la condición de estado
**dentro del filtro** y no en un `if` de JavaScript —`vender` en `boxes/index.js:505`, `cancelar` en
`cashier/index.js:244-247`, el marcado de `shipping/index.js:108`—, lo que cierra la ventana entre
leer y escribir. El comentario de `boxes/index.js:498-503` explica exactamente por qué, y tiene
razón: con el estado mirado en JavaScript, dos ventas simultáneas del mismo objeto pagan dos veces.

## No hay asignación masiva en ningún lado

Busqué `findByIdAndUpdate`, `findOneAndUpdate`, `updateOne`, `Object.assign`, `new Model(req.body)`
y `...req.body` en todo `routes/` y `services/`. **No hay un solo lugar donde el cuerpo del pedido
entre entero a un modelo.** Los tres `Object.assign` que aparecen (`services/support/index.js:55`,
`:245`, `:337`) arman respuestas de salida, no documentos.

Concretamente, sobre lo que preguntaste:

- **`backend/routes/admin/editar.js`** — las rutas genéricas `post("/:cosa")` y `put("/:cosa/:id")`
  trabajan sobre el diccionario `COSAS` (`:95-208`), que contiene exactamente cinco entidades:
  `promotions`, `challenges`, `races`, `banners` y `promo`. **El modelo `User` no está.** No hay
  forma de escribir sobre una cuenta por esta vía. Y cada entidad declara su lista blanca de campos
  con su tipo, que `armar()` (`:213-230`) aplica campo por campo: lo que no está declarado no se
  guarda, venga como venga. `balanceSc`, `rank`, `verificationLevel`, `bonoPendienteSc`,
  `demosUsadas`, `freeOpens`, `banned` y `trabas` no aparecen en ninguna de las cinco listas.
- **`PUT /admin/settings`** (`admin/index.js:1066-1096`) — lista blanca explícita de 34 claves, con
  soporte de rutas con punto para no pisar grupos enteros, y `runValidators: true` en el `updateOne`
  para que los topes del esquema se apliquen también al actualizar. Bien hecho, y el comentario
  explica los dos motivos.
- **El registro** (`auth/index.js:141`) — `User.create({ username, email, passwordHash })`, tres
  campos nombrados. No hay forma de nacer con saldo, con rango ni con nivel de verificación.
- **Las direcciones** (`profile/index.js:175-195`) — `camposDeDireccion()` construye un objeto nuevo
  con ocho campos recortados; `user` lo pone el servidor desde `req.user._id` (`:214`).
- **`jugador.js`** — las cinco rutas que escriben (`locks`, `note`, `tier`, `gifts`, y el `ban` de
  `index.js:302`) arman el `$set` a mano con campos fijos, exigen `motivo` de al menos tres
  caracteres y escriben en `AdminLog` con el antes y el después.

**No hay escalada de admin a owner.** Lo verifiqué por los cuatro caminos posibles: `POST /team/:id`
exige `req.user.rank === "owner"` y además prohíbe tocarse a uno mismo (`editar.js:422-423`);
`editar.js` no expone `User`; ninguna ruta de `jugador.js` ni de `extra.js` escribe `rank`; y
`otorgarRango` de afiliados (`services/affiliates/index.js:684`) escribe `rangoAfiliado`, que es el
nivel de socio, no el rango del panel.

## El login no filtra si la cuenta existe — probado

`auth/index.js:238-252` está bien resuelto, por las dos vías:

```js
    const hash = (usuario && usuario.passwordHash) || "$2a$12$" + "x".repeat(53);
    const coincide = await bcrypt.compare(password, hash);

    if (!usuario || !coincide) throw errorDe("BAD_CREDENTIALS", {}, 401);
```

- **Por el mensaje:** un solo código, `BAD_CREDENTIALS`, para "no existe" y para "la clave está
  mal".
- **Por el tiempo:** el hash de relleno es un bcrypt válido de costo 12, así que cuando la cuenta no
  existe se paga el mismo trabajo. Lo comprobé: no es un adorno, `bcrypt.compare` lo procesa entero
  y devuelve `false` sin lanzar. Medianas de 12 mediciones intercaladas: 750 ms con el relleno
  contra 813 ms con un hash real. Hay 63 ms de diferencia, pero el rango de cada grupo va de 497 a
  1804 ms, o sea que el ruido es un orden de magnitud mayor que la señal; **no es un oráculo
  utilizable por red**, y menos todavía a través de internet. Lo dejo anotado como medición, no como
  hallazgo.

El `banned` se comprueba después de validar la contraseña (`:253`), que es el orden correcto: al
revés, el mensaje de cuenta cerrada contaría que la cuenta existe.

Un detalle bien resuelto: la búsqueda por nombre de usuario usa `collation` en vez de una expresión
regular (`:231-235`), así que el texto del jugador nunca entra en un patrón. El comentario de
`:226-230` lo explica. Eso evita de paso una denegación de servicio por `regex`.

## Turnstile está donde tiene que estar

Se comprueba en el servidor en las dos puertas: registro (`auth/index.js:125`) y login (`:205`). El
comentario de `services/turnstile.js:7-12` explica bien por qué el servidor es el único lugar donde
sirve. Que falle abierto cuando Cloudflare no contesta (`:76`) y que quede apagado sin clave (`:48`)
ya está reportado, así que no lo repito; lo que sí verifiqué es que el token se manda a Cloudflare
con `--form-string`-equivalente (`URLSearchParams`, `:55`) y que la IP del visitante va como
`remoteip`, que es lo correcto.

## Lo demás que miré y está bien

- **CORS y helmet** (`index.js:55` y `:82`): la lista de orígenes sale de `SITIO_URL` y, cuando está
  vacía, deja pasar a todos. Como la sesión viaja en una cabecera y `credentials` no está activado,
  un origen cualquiera no puede leer ni mandar la sesión de nadie: el `Access-Control-Allow-Origin:
  *` de desarrollo no abre nada. `frameguard` viene con el `helmet` por defecto, que es la cabecera
  que importa acá. El CSP apagado está documentado con su razón (`:76-80`) y queda como deuda para
  cuando se sirva el `dist`.
- **Errores**: `utils/errors.js:143` devuelve `{ success, code, message, data }` y nada más. El
  `stack` va al registro (`index.js:150`), no al navegador. No hay fuga de nombres de campos ni de
  errores de Mongo.
- **Registro de auditoría**: todas las acciones del panel que escriben llaman a `admin.anotar` con
  el antes, el después, el motivo y el `req`. Es lo que permite reconstruir quién hizo qué.
- **Archivos de KYC**: se guardan en la base como `data:`, no en el disco, así que
  `/verification/:id/files/:campo` no tiene traversal posible; el campo se busca con `.find()` sobre
  un arreglo (`admin/index.js:861`). Cada lectura queda anotada (`kyc.view`, `kyc.file`). Y al
  resolver el nivel, los archivos se borran (`services/verification/index.js:258`) — el comentario
  de `:243-246` tiene razón en que guardar la foto del pasaporte después de usarla es solo esperar a
  que te la roben.
- **Inyección NoSQL**: no encontré ninguna. Los filtros que reciben datos del jugador usan `String()`
  o vienen de `req.params`, que en Express siempre son cadenas. Los pocos valores que llegan del
  cuerpo y entran a un filtro (`hiloId`, `addressId`, los `ids` de venta masiva) van siempre
  acompañados de `user: req.user._id` en el mismo filtro, así que ni siquiera un operador colado
  cruzaría de cuenta.
- **El guardia del frontend** (`frontend/src/router/index.js:157` y `AdminShell.vue:5`) es solo
  visual, pero **eso está bien acá**, porque el servidor valida las 76 rutas (probado arriba). Los
  comentarios de `router/index.js:153-155` y `AdminShell.vue:185-189` lo dicen con todas las letras
  ("esconder un botón no protege nada"), y el criterio del frontend coincide con el del backend
  (`store/index.js:80`: `["admin","owner"]`). **No encontré ninguna vista cuya protección sea solo
  del lado del cliente.** `AdminSettings.vue:158` incluso replica el `owner` que el servidor exige
  en `PUT /settings`.
- **`.env` no está en el repositorio**: `git ls-files` solo devuelve los dos `.env.example`, y
  `git log --all` sobre `backend/.env` y `frontend/.env` no devuelve nada. Nunca estuvo.
- **La guarda de `sembrar.js`** contra bases no locales (`:125-128`) está bien puesta; su límite es
  AUTH-09.
- **Lo ya arreglado que verifiqué**: `helmet` y `cors` están efectivamente en `index.js:55` y `:82`.
  El saludo de soporte ya no usa `v-html` con el nombre del jugador.

---

## Nota sobre las pruebas

Las tres pruebas que corrí montan los routers reales del repositorio **sin conectarse a ninguna base
de datos** y sirven desde un puerto efímero. No se escribió nada en `C:\Users\Usuario\mrbox` ni en
ninguna base. Los scripts quedaron en el scratchpad:

- `probe-admin.js` — pide las 76 rutas del panel sin token y verifica que todas den 401.
- `probe-jwt.js` — `alg:none`, confusión HS/RS, secreto vacío, expiración.
- `probe-ratelimit.js` — reproduce `trust proxy: 1` + el `rateLimit` de `/auth` y mide el salteo.
- `probe-bcrypt.js` / `probe-bcrypt2.js` — mide el hash de relleno contra uno real.
- `probe-cuerpo.js` — reproduce la selección de límite de cuerpo de `index.js:93-100`.
