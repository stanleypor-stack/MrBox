# Lo que falta configurar

Dos cosas necesitan datos que solo vos podés sacar: el captcha de
Cloudflare y el "Entrar con Google". Acá están los pasos y, al final de
cada uno, **exactamente qué tenés que pasarme**.

Facebook queda para después, como dijiste.

---

## 1. Cloudflare Turnstile (el captcha)

**Estado hoy:** el código ya está hecho y funcionando. Si
`TURNSTILE_SECRET_KEY` está vacío, el captcha simplemente no se exige y
el registro anda igual — por eso en local funciona sin tocar nada.
Falta solo poner las claves de verdad.

### Pasos

1. Entrá a <https://dash.cloudflare.com> → menú de la izquierda →
   **Turnstile**.
2. **Add widget**.
3. Completá:
   - **Widget name:** `MR BOX`
   - **Hostnames:** `mrbox.gg` y `www.mrbox.gg`. Agregá también
     `localhost` para poder probar en tu máquina.
   - **Widget Mode:** `Managed` (es el que decide solo si muestra el
     desafío o deja pasar).
4. **Create**.
5. Te quedan dos claves a la vista:
   - **Site Key** — empieza con `0x4AAAAA…`. Es pública, va en la
     pantalla.
   - **Secret Key** — empieza con `0x4AAAAA…` también. **Es privada.**

### Qué me pasás

| Dato | Dónde lo pongo yo |
|---|---|
| Site Key | `frontend/.env` → `VUE_APP_TURNSTILE_SITE_KEY` |
| Secret Key | `backend/.env` → `TURNSTILE_SECRET_KEY` |

> La **Secret Key** no puede ir nunca en el frontend: cualquiera la lee
> abriendo el código de la página. `backend/.env` está en `.gitignore`,
> así que no viaja al repo.

Pasámelas por acá y las dejo puestas. Si preferís no mandarlas por
chat, podés editar vos los dos archivos y me avisás.

---

## 2. Entrar con Google

**Estado hoy:** el botón de Google existe en la pantalla pero **no hace
nada** — muestra un cartel de "todavía no". No hay ruta en el servidor.
O sea: esto hay que construirlo, no es solo pegar una clave.

### Cómo lo voy a hacer

Con **Google Identity Services**: el botón de Google devuelve un token
firmado, el servidor lo verifica contra Google y busca o crea la cuenta.

Es el camino corto y el que menos secretos tiene dando vueltas: para
entrar y registrarse **alcanza con el Client ID**, que es público. El
Client Secret solo haría falta si algún día quisiéramos leer datos de
la cuenta de Google sin que la persona esté presente, y no es el caso.

Lo que resuelvo del lado nuestro, para que lo tengas en cuenta:

- **Alguien que ya tiene cuenta con ese mismo mail.** Se ata la cuenta
  de Google a la que ya existe, no se crea una segunda. Dos cuentas con
  el mismo mail es un lío de soporte y de saldos.
- **El nombre de usuario.** Google da nombre y mail, no un nick. Se
  propone uno a partir del mail y, si está tomado, se le pide que elija.
- **El mail ya viene verificado** por Google, así que se salta ese paso.
- **Las tres cajas de regalo** se dan igual que en el registro normal.

### Pasos

1. Entrá a <https://console.cloud.google.com>.
2. Arriba, el selector de proyecto → **New Project** → nombre `MR BOX` →
   **Create**.
3. Menú → **APIs & Services** → **OAuth consent screen**.
   - **User type:** `External` → **Create**.
   - **App name:** `MR BOX`
   - **User support email:** tu mail
   - **App logo:** el logo de MR BOX (opcional, pero queda mejor)
   - **Application home page:** `https://mrbox.gg`
   - **Privacy policy:** `https://mrbox.gg/legal/privacy`
   - **Terms of service:** `https://mrbox.gg/legal/terms`
   - **Authorized domains:** `mrbox.gg`
   - **Developer contact:** tu mail
   - **Save and continue**.
4. **Scopes:** agregá solo estos dos y nada más:
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`

   Con eso alcanza. Pedir más hace que Google exija una revisión que
   tarda semanas.
5. **Test users:** agregá tu mail mientras esté en modo prueba.
6. Menú → **APIs & Services** → **Credentials** → **Create
   credentials** → **OAuth client ID**.
   - **Application type:** `Web application`
   - **Name:** `MR BOX web`
   - **Authorized JavaScript origins** (uno por renglón):
     ```
     https://mrbox.gg
     https://www.mrbox.gg
     http://localhost:8090
     ```
   - **Authorized redirect URIs:** dejalas vacías. Con Identity Services
     no hacen falta.
   - **Create**.
7. Te muestra el **Client ID** (termina en
   `.apps.googleusercontent.com`) y el **Client Secret**.

### Qué me pasás

| Dato | Para qué |
|---|---|
| **Client ID** | Lo único que necesito para que el botón funcione |
| Client Secret | Guardalo vos. No hace falta ahora. |

Cuando esté en producción y quieras que entre cualquiera y no solo los
test users, hay que apretar **Publish app** en la pantalla de consent.
Con esos dos scopes Google no pide verificación.

---

## Resumen: lo que tenés que conseguir

1. **Turnstile Site Key** (pública)
2. **Turnstile Secret Key** (privada)
3. **Google Client ID**

Con esas tres dejo el captcha andando y el "Entrar con Google" hecho y
probado, en celular y en PC.
