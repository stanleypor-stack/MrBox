# Lo que falta configurar

> **Turnstile y Google ya están hechos y probados.** Lo que queda acá
> es dónde vive cada clave y qué hay que hacer el día del deploy.

---

## Dónde vive cada clave

| | Local | Producción |
|---|---|---|
| Turnstile Site Key | `frontend/.env` (la de prueba) | `frontend/.env.production` |
| Turnstile Secret | `backend/.env` (la de prueba) | `backend/.env.production` |
| Google Client ID | `frontend/.env` y `backend/.env` | los dos `.env.production` |

Ninguno de esos archivos está en el repo: `.env` y `.env.*` están en el
`.gitignore`. **Los dos `.env.production` son los que hay que subir al
servidor**, o de donde copiar los valores al panel del hosting.

### Por qué local usa las claves de prueba de Turnstile

Porque con la clave de verdad el registro local contesta
`CAPTCHA_FAILED`: el token de prueba solo vale con la clave de prueba.
Está bien que sea así, pero dejaría la máquina sin poder registrar a
nadie, y con eso se caen las PoC y cualquier prueba a mano.

El Client ID de Google sí es el de verdad en los dos lados: es público
y `http://localhost:8090` está entre los orígenes autorizados.

---

## Entrar con Google: cómo quedó

**El Client Secret no se usa.** Para entrar alcanza con el Client ID.
El Secret solo haría falta para leer datos de la cuenta de Google sin
que la persona esté presente, y no es el caso. Guardalo igual.

Lo que hace el botón:

1. Google dibuja **su** botón encima del nuestro, invisible. No se
   puede disparar su diálogo desde un botón propio: One Tap
   (`prompt()`) es una sugerencia, no una acción, y sus métodos de
   estado los está apagando Google con FedCM. El suyo arriba es el
   único camino soportado.
2. Devuelve un token firmado por Google.
3. El servidor comprueba la firma contra las claves públicas de
   Google, que sea **para nuestro Client ID**, y que no haya vencido.
4. Decide solo: si ya entró antes con Google, entra; si ya tenía
   cuenta con ese mail, le ata la de Google; si no tenía nada, la crea
   con sus semillas y sus tres cajas de regalo.

Un mail de Google **sin verificar** no abre cuenta ni se ata a una que
exista: cualquiera puede crear una cuenta de Google escribiendo el mail
de otro.

Está probado en `backend/tests/google.test.js`, siete casos.

---

## El día del deploy

1. Subir `backend/.env.production` y `frontend/.env.production`, o
   copiar sus valores al panel del hosting.
2. **`OXAPAY_CALLBACK_URL` tiene que apuntar a un servidor que
   responda.** Hoy dice `https://mrbox.gg/api/hooks/oxapay` y ese host
   no contesta: un depósito de verdad llegaría a OxaPay y el sitio no
   se enteraría nunca.
3. En Google Cloud → **Audience** → **Publish app**, para que entre
   cualquiera y no solo los test users. Con los dos scopes que
   pedimos (`userinfo.email` y `userinfo.profile`) Google no pide
   verificación.
4. En Cloudflare Turnstile, comprobar que `mrbox.gg` esté entre los
   hostnames del widget.

---

## Facebook

Queda para después, como quedamos. El botón sigue mostrando el cartel
de "todavía no".
