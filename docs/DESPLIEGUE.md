# Subir MR BOX a internet

Esta es la versión **de prueba**: sin dominio propio y sin plata de
verdad. Sirve para abrir el sitio desde cualquier teléfono y ver cómo
anda. Para abrir al público faltan cosas, y están al final.

## Cómo queda armado

```
  navegador  ──►  Netlify            ──►  Render          ──►  Atlas
                  el sitio                el servidor          la base
                  mrbox.netlify.app       mrbox-api            Mongo
```

El sitio pide siempre `/api/...` y Netlify lo reenvía a Render (ver
`netlify.toml`). El navegador nunca ve la dirección de Render, así que
no hay CORS que configurar y cambiar de backend es cambiar una línea.

**Por qué el backend no va en Netlify.** Netlify sirve archivos
estáticos y funciones cortas. Esto es un servidor Express con una
conexión viva a Mongo, un reloj que cierra carreras cada hora y un
webhook que necesita el cuerpo crudo para verificar la firma de
OxaPay. Nada de eso sobrevive a una función que arranca y muere en
cada pedido.

## Las claves

**Las escribe Dani, siempre, en el panel de cada servicio.** No van en
ningún archivo del repositorio ni se escriben en un chat. Si una se
vio donde no debía, se rota y listo.

Por eso `render.yaml` las declara con `sync: false`: Render las pide en
su panel y no las busca en el repositorio.

## Los pasos

### 1. La base — MongoDB Atlas

1. Crear un clúster **M0** (gratis). Región cerca de Oregon, que es
   donde va a estar el servidor.
2. **Database Access** → crear un usuario sólo para la aplicación, con
   permiso `readWrite` sobre la base y nada más.
3. **Network Access** → `0.0.0.0/0`. Render no tiene IP fija en el
   plan gratis, así que no hay nada más específico que poner. Lo que
   protege la base es el usuario y la clave, no la lista de IP.
4. Copiar la cadena de conexión. El nombre de la base al final: algo
   que **no** diga `local`, `test` ni `dev`, para que `sembrar.js` se
   niegue a tocarla (ver la traba en ese script).

### 2. El servidor — Render

1. **New → Blueprint**, apuntado a este repositorio. Lee `render.yaml`
   y crea el servicio.
2. Render pide las variables marcadas `sync: false`. Las mínimas para
   que arranque:

   | Variable | Qué va |
   |---|---|
   | `SITIO_URL` | la dirección de Netlify, cuando exista |
   | `DATABASE_URI` | la cadena de Atlas del paso 1 |
   | `JWT_SECRET` | un texto largo al azar |
   | `TURNSTILE_SECRET_KEY` | el secret del captcha (paso 4) |

   Sin `SITIO_URL` el servidor **no arranca**, a propósito: olvidarla
   dejaría la API abierta a cualquier página.

3. Las de OxaPay se dejan vacías por ahora. Sin ellas no funcionan los
   depósitos ni los canjes, que para una prueba es lo correcto.

El plan gratis duerme el servicio tras un rato sin uso, así que el
primer pedido después de un rato tarda medio minuto. Es esperable.

### 3. El sitio — Netlify

1. **Add new site → Import from Git**, este repositorio, rama
   `audit/fixes`.
2. La configuración sale de `netlify.toml`; no hay que tocar nada en
   el panel.
3. **Cambiar a mano en `netlify.toml`** la dirección de Render en la
   regla `/api/*`, y volver a subir. Hasta ese momento el sitio carga
   pero no habla con nada.
4. Netlify da una dirección `algo.netlify.app`. Esa es la que va en
   `SITIO_URL` en Render.

### 4. El captcha — Cloudflare Turnstile

1. **Turnstile → Add widget**, con el hostname de Netlify.
2. El **site key** es público y va en Netlify, como variable de
   compilación `VUE_APP_TURNSTILE_SITE_KEY`.
3. El **secret key** va en Render, como `TURNSTILE_SECRET_KEY`.

Sin esto no se puede entrar ni registrarse: el login valida el captcha
contra Cloudflare.

### 5. Después del primer despliegue

Con el servicio arriba:

- `GET /api/health` tiene que contestar `{ ok: true }`.
- La base arranca vacía. Para que haya algo que mirar hay que cargar
  el catálogo; `sembrar.js` **no** sirve, porque se niega a correr
  contra una base que no sea de desarrollo (y hace bien: crea cuentas
  de administrador con una clave que está en el repositorio).
- La primera cuenta de administrador se crea a mano, con una clave que
  elija Dani.

## Lo que falta para abrir al público

Esto es una prueba, no una apertura. Antes de que entre alguien de
afuera:

1. **Los textos legales tienen 30 huecos** sin decidir: razón social,
   jurisdicción, dirección, países excluidos, plazos. Hoy el jugador
   leería `[[RAZÓN SOCIAL]]` en los Términos. Son decisiones del
   abogado, están listadas en `audit/legales/`.
2. **El dominio**, y con él el certificado y las direcciones de
   Turnstile, Google y OxaPay, que hoy apuntan a `mrbox.gg`.
3. **Las claves de OxaPay**, para que haya depósitos y canjes.
4. **Un plan pago en Render**, para que el servicio no se duerma.
5. **La cabecera CSP**, que hoy está apagada a propósito (ver el
   comentario en `backend/index.js`) y conviene prender sirviendo el
   sitio ya compilado.
6. **Copias de seguridad de Atlas**, que en el plan M0 no existen.
