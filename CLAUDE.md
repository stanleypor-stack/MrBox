# MR BOX — cómo se trabaja acá

Este archivo lo lee Claude al abrir una sesión en esta carpeta. Está
para que una sesión nueva arranque sabiendo lo que ya se decidió, en
vez de volver a preguntarlo o volver a romperlo.

---

## Qué es MR BOX

Un e-commerce de cajas misteriosas, al estilo de **mrloot.com**,
**giveaways.com**, **unbox.gg** y **krush.gg**.

**NO es un sweepstakes de EE.UU. ni un casino.** No se agregan edades,
países, ni nada que venga del mundo de las apuestas si no se pidió.

Una sola moneda: **SC**, donde `1 SC = 1 USD`.

Referencia visual: **mrloot.com**. Cuando haya que decidir cómo se ve
algo, se mira ahí primero.

---

## El stack

| | |
|---|---|
| Frontend | Vue 2 + vue-cli, puerto 8090 |
| Backend | Express 5 + Mongoose 9, puerto 5001 |
| Base | MongoDB, `mrbox_local` |

No hay sockets, ni Redis, ni docker. No agregarlos sin preguntar.

Los servidores se levantan con `preview_start` (`mrbox-api` y
`mrbox-web` en `.claude/launch.json`), nunca con `npm run` desde la
terminal.

---

## Reglas que no se discuten

1. **Nunca tocar `main` ni la base de producción.** Se trabaja en una
   rama (`audit/fixes` es la que está en curso) y los merges los hace
   Dani.
2. **Pedir OK antes de pushear o abrir un PR.** Mostrar el diff y
   esperar.
3. **El feed de Activity no se toca.** Queda como está en producción.
4. **Las claves de `.env` no se escriben en el chat ni se commitean.**
   `.env` y `.env.*` están en el `.gitignore`. Las de producción viven
   en `backend/.env.production` y `frontend/.env.production`.
5. **Las PoC corren solo contra `localhost` y `mrbox_local`.** Cada una
   lo verifica antes de hacer nada.

---

## Cómo está escrito el código

- **Los comentarios van en castellano**, y explican el *por qué*, no el
  *qué*. Si un comentario se puede deducir leyendo la línea de abajo,
  sobra. Si explica una decisión, una medición o un error que ya pasó,
  va.
- **Los nombres son en castellano** salvo los de la API pública y los
  del modelo de datos, que vienen del diseño.
- **En un componente no se escribe un `#rrggbb`.** Los colores salen de
  `frontend/src/styles/_tokens.scss`.
- **Los textos no se escriben en los `locales/*.js`.** Se escriben en
  `frontend/scripts/traducir.py` (9 idiomas) y en
  `frontend/scripts/panel.py` (el admin, solo inglés), y después se
  corre `python scripts/traducir.py`. Editar un locale a mano no sirve:
  el siguiente build lo pisa.

---

## La plata

La parte sensible. Las reglas salieron de una auditoría y de agujeros
que ya aparecieron:

- **El libro primero.** Todo movimiento pasa por `wallet.mover()`, con
  la condición de saldo **adentro del filtro**, nunca en un `if`.
- **La idempotencia se hace con un índice único**, insertando la fila
  ANTES de mover la plata (`PromoCode`, `RakebackClaim`,
  `DepositoAvisado`, `ChallengeWin`).
- **Varias garantías de plata no son un `if`, son un índice único.** Por
  eso `conectar()` espera a que los índices existan antes de atender, y
  cada prueba los vuelve a crear después de su `dropDatabase`.
- **OxaPay**: el `amount` del aviso viene en cripto y el `value` en
  dólares. Se acredita `value`. El payout va en unidades de la moneda,
  no en SC. La firma se calcula sobre los **bytes crudos**.
- **Los canjes los pide el jugador y los aprueba el panel**, siempre,
  después de la verificación.

---

## Cómo se da algo por terminado

No alcanza con que compile.

1. `npm test` en `backend/` — son 211 y tienen que pasar las 211.
2. Si toca un flujo de plata o de cuentas, se escribe una **PoC en
   `audit/pocs/`** que lo recorra de punta a punta contra el servidor
   de verdad, y se corre varias veces.
3. Si se ve en pantalla, se **mira en el navegador a 375px y a 1365px**,
   y se mide lo que se afirma. "Se ve bien" no es una verificación;
   "el ganador queda a 7px del centro, medido" sí.
4. Si algo quedó sin hacer o falló, se dice.

Las PoC que ya existen son el mejor ejemplo del formato esperado:
`cajas-de-regalo.js`, `desafio-por-objeto.js`,
`desafios-desde-el-panel.js`, `kyc-bono-direccion.js`.

---

## Cosas que ya se decidieron (no volver a proponerlas)

- **No se trucan los resultados.** Se pidió una vez que las cajas
  gratis cayeran siempre en el premio más barato mostrando el más caro
  al lado. No se hace: rompe el verificador de provably fair y las
  chances publicadas pasan a ser mentira. La alternativa honesta es una
  tabla de premios distinta y **declarada** para las cajas gratis.
- **Las tres cajas de regalo son del registro.** El que deposita se
  lleva el bono del 50%, que es otra cosa. Dos promesas separadas.
- **El reloj del bono arranca al abrir el cajón de depósito**, no al
  crear la cuenta, y el servidor mide contra el mismo sello que el
  contador de la pantalla.
- **La cinta de apertura**: horizontal con una caja, en columnas de
  costado con más de una, y en el teléfono de a tres por renglón. El
  paso es 132 y el ganador el casillero 54; eso no se toca sin volver a
  verificar la frenada.
- **El 5 no está** en el selector de cantidad: queda 3+2 en el
  teléfono, con el renglón de abajo a medio llenar.

---

## Lo que falta

- El contenido de las páginas legales (están armadas, falta el texto).
- Las claves con `deposit` / `wager` / `odds` en textos de jugador, y
  sus traducciones (el ruso usa `казино`, el chino `投注`).
- El "Entrar con Google": el botón existe pero no hace nada y no hay
  ruta en el servidor. Ver `CONFIGURAR.md`.
- 153 objetos del catálogo siguen con la foto del prototipo porque no
  engancharon por nombre.
