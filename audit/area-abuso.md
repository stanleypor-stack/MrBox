# MR BOX — Auditoría de abuso de negocio, fraude y cumplimiento de sweepstakes

Alcance: `C:\Users\Usuario\mrbox` (solo lectura). Fecha: 2026-11-19.
Áreas: abuso de bonos y multicuenta, lavado, juego responsable, copy y
cumplimiento, reglas declaradas vs implementadas.

Excluidos por pedido (ya reportados): falta de límite de intentos por cuenta,
el admin puede crear saldo sin tope, Turnstile falla abierto.

Resumen: **22 hallazgos** — 2 Críticos, 6 Altos, 11 Medios, 3 Bajos/Info.

---

## 1. ABUSO DE NEGOCIO Y FRAUDE

### ABUSO-01 — Las carreras pagan el pozo entero sin piso de participación ni de volumen
- **Severidad**: Crítica · **Categoría**: abuso de promociones / multicuenta
- **Archivo**: `backend/services/races/index.js:108` (`{ $match: { jugadoSc: { $gt: 0 } } }`),
  `:53` (`REPARTO = [30,18,12,9,7,6,5,5,4,4]`), `:205` (`premioDe(...)`),
  `:218` (`wallet.mover({ type: "race_prize" })`);
  pozos en `backend/database/models/Settings.js:303-307` (daily 2000, weekly 10000, monthly 30000)
- **Confianza**: Alta (verificado en código) · **Esfuerzo de explotación**: Trivial

**Descripción.** `tablaDe()` arma la tabla con *cualquier* cuenta que tenga
`jugadoSc > 0` en la ventana y `cerrar()` paga el reparto completo sobre esa
tabla. No hay volumen mínimo, no hay número mínimo de participantes, no hay
tope por cuenta y no hay deduplicación por IP, correo o dispositivo. El único
filtro es `banned` y `trabas.carreras` (`races/index.js:131-134`), dos cosas
que se ponen a mano *después* del hecho.

Y las aperturas de regalo cuentan: `services/boxes/index.js:160-180` acredita
el regalo (`promo_code`) y acto seguido cobra la apertura (`box_open`), así que
una apertura gratis deja una fila de `box_open` por el precio de lista. El
propio texto del panel lo dice: *"They go through the ledger like any other
opening, so they still count for wagering, races and the margin"*
(`frontend/scripts/panel.py:493`).

**Impacto concreto.**

| Carrera | Pozo | 1er puesto | Volumen que "costaría" ese premio al 8% | Volumen real necesario en un sitio tranquilo |
|---|---|---|---|---|
| diaria | SC 2.000 | SC 600 | SC 7.500 | **SC 2,37** (una apertura de regalo) |
| semanal | SC 10.000 | SC 3.000 | SC 37.500 | SC 2,37 |
| mensual | SC 30.000 | SC 9.000 | SC 112.500 | SC 2,37 |

Las tres cajas de regalo (`mac` SC 2,37 + `pokemon-boosters` SC 2,89 +
`splash` SC 3,01 = **SC 8,27 de volumen a costo cero**) alcanzan para entrar
en la tabla. Con **10 cuentas nuevas**, un abusador ocupa los diez puestos
pagos de la carrera diaria y se lleva **SC 2.000 por día con costo propio
SC 0**, SC 10.000 la semanal y SC 30.000 la mensual. El premio entra como
saldo retirable (`race_prize`, sin `bonoSc`).

Incluso con competencia real, un farmer con bankroll B genera volumen ≈ 12,5×B
antes de fundirse (margen 8%), así que **SC 600 de bankroll compran el primer
puesto diario** mientras el volumen del segundo sea menor a SC 7.500.

**Pasos para reproducir.**
1. Registrar 10 cuentas (no hace falta confirmar correo: no existe esa confirmación).
2. En cada una, abrir las tres cajas de regalo (`POST /api/boxes/mac/open`, etc.).
3. Esperar al cierre de la ventana UTC. `ponerAlDia()` corre al arrancar, cada hora
   y cuando cualquiera abre `GET /api/races/daily`.
4. Las diez cuentas reciben SC 600/360/240/180/140/120/100/100/80/80.

**PoC.**
```js
// lectura: qué paga hoy cada puesto con la tabla actual
const carreras = require("./backend/services/races");
const c = await carreras.ver({ tipo: "daily" });
console.log(c.filas.map(f => `${f.puesto} ${f.username} jugado=${f.jugadoSc} premio=${f.premioSc}`));
// En un sitio nuevo: puesto 1 con jugadoSc 2.37 => premioSc 600
```

**Arreglo propuesto.**
1. Volumen mínimo por puesto (p. ej. `premioSc <= jugadoSc * k`, con k ≈ 0,5),
   y en todo caso `premioSc = min(premioDe(...), jugadoSc * tope)`.
2. Participantes mínimos para repartir: si hay menos de N en la tabla, el pozo
   se recorta proporcionalmente o rueda a la ventana siguiente.
3. Excluir del volumen de carrera las aperturas con `conAperturaGratis` y todo
   `box_open` cuya contraparte sea un `promo_code` del mismo segundo
   (o, mejor, no escribir el par regalo/cobro y llevar el "jugado de regalo"
   en un campo aparte).
4. Un puesto pago por IP /24 y por dispositivo; el resto, corrido.

**Cómo verificar.** Con la base local: sembrar 10 cuentas, darles solo el
regalo, correr `races.cerrar()` sobre la ventana y comprobar que la suma de
`race_prize` quede en 0 (o acotada al volumen) en lugar de SC 2.000.

---

### ABUSO-02 — Auto-referido con una segunda cuenta: el bono de compra del 5–10% es ganancia neta repetible
- **Severidad**: Alta · **Categoría**: abuso de bonos / multicuenta
- **Archivo**: `backend/services/affiliates/index.js:245-270` (`atarAlSocio`),
  `:249-250` (el único control), `backend/routes/wallet/index.js:169-200`
  (`POST /code`, permite atar el código *después* del registro),
  `backend/routes/wallet/index.js:405-412` (acreditación con `bonoSc`),
  `backend/database/models/Settings.js:216` (`vecesAJugarElBono: 1`)
- **Confianza**: Alta · **Esfuerzo**: Trivial

**Descripción.** El único control antiauto-referido es:

```js
/* Nadie se trae a sí mismo. Es el autofraude más viejo que hay. */
if (String(codigo.owner && codigo.owner._id) === String(usuario._id)) return null;
```
(`services/affiliates/index.js:249-250`)

Compara **el mismo ObjectId**, es decir el caso que ya es imposible por
construcción (en `/auth/register` el usuario acaba de nacer y no puede ser
dueño de un código). No se mira correo, ni IP, ni huella de dispositivo, ni
`SessionEvent`. Crear una segunda cuenta y ponerle el código propio es el
camino normal y no hay nada que lo frene. Más aún, `POST /api/wallet/code`
permite atar el código a una cuenta ya creada mientras `referredBy` sea nulo,
así que ni siquiera hace falta hacerlo en el formulario de registro.

Encima el bono de compra **no es de primer depósito**: `bonoDeCompra()`
(`affiliates/index.js:301-311`) lo aplica a *cada* compra, y
`vecesAJugarElBono = 1` solo obliga a jugar la parte regalada una vez.

**Impacto concreto.** Con margen de la casa del 8%, jugar el bono una vez
cuesta el 8% del bono:

| Bono | Depósito | Bono | Costo de jugarlo 1× | **Neto por ciclo** |
|---|---|---|---|---|
| 5% (Bronze) | SC 1.000 | SC 50 | SC 4 | **+SC 46 (4,6%)** |
| 5% | SC 10.000 | SC 500 | SC 40 | **+SC 460 (4,6%)** |
| 10% (Diamond) | SC 1.000 | SC 100 | SC 8 | **+SC 92 (9,2%)** |
| 10% | SC 10.000 | SC 1.000 | SC 80 | **+SC 920 (9,2%)** |

Repetible sin tope: depositar → jugar el bono → canjear → repetir. **Para que
el bono fuera neutro haría falta `vecesAJugarElBono ≈ 12,5` (= 1/0,08), no 1.**
El comentario de `Settings.js:205-214` razona bien el salto de 0 a 1, pero se
queda doce veces corto.

El CPA, en cambio, **sí** está bien defendido (ver "lo que está bien"): pide
depósito ≥ SC 20, jugado ≥ SC 200, KYC nivel 2 y 14 días de espera.

**Pasos para reproducir.**
1. Cuenta A: `POST /api/affiliates/campaigns` con modelo `revshare`, código `MIO`.
2. Cuenta B (otro correo, misma máquina): registrar con `affiliateCode: "MIO"`,
   o registrar suelta y después `POST /api/wallet/code {code:"MIO"}`.
3. `GET /api/auth/me` en B: `affiliateCode: "MIO"`, `referredBy` apuntando a A.
   Ningún control saltó.
4. Depósito de B → el callback acredita `monto + 5%` con `bonoPendienteSc = bono`.
5. B juega SC 50 en cajas (costo esperado SC 4) → `canjeableSc` pasa a cubrir todo.
6. B canja. Neto +SC 46 por ciclo.

**Arreglo propuesto.**
- En `atarAlSocio`, rechazar si el referido comparte correo normalizado,
  IP /24 de `SessionEvent`, o huella de dispositivo con el dueño del código, y
  dejar la conversión en estado `sospechosa` en vez de `nuevo`.
- Subir `vecesAJugarElBono` al entorno de 1/margen (≈12), o acotar el bono a
  la primera compra y a un tope absoluto (p. ej. SC 100).
- Guardar una huella de dispositivo en el registro (hoy no existe ninguna).

**Cómo verificar.** Registrar B con el código de A desde el mismo navegador y
comprobar que `referredBy` queda nulo y que la respuesta trae `affiliate.invalido`.

---

### ABUSO-03 — El regalo de bienvenida es SC 7,61 de valor esperado por cuenta y no hay verificación de correo
- **Severidad**: Alta · **Categoría**: farmeo de cuentas
- **Archivo**: `backend/services/boxes/index.js:383-408` (`regalarCajasDeBienvenida`),
  `backend/routes/auth/index.js:176` (se llama en el registro),
  `backend/database/models/User.js` (no existe ningún campo `emailVerificado`)
- **Confianza**: Alta (números calculados sobre `backend/datos/catalogo.json`) · **Esfuerzo**: Bajo

**Descripción.** El registro entrega tres aperturas gratis y **nada** verifica
que el correo exista: no hay token de confirmación, no hay campo de estado de
correo, no hay huella de dispositivo. El único freno es el límite de 10
pedidos por 15 minutos por IP (`routes/auth/index.js:43-49`) y Turnstile.

**Impacto concreto.** Calculado del catálogo sembrado:

| Caja de regalo | Precio | Pago promedio (EV del objeto) |
|---|---|---|
| `mac` | SC 2,37 | SC 2,18 |
| `pokemon-boosters` | SC 2,89 | SC 2,66 |
| `splash` | SC 3,01 | SC 2,77 |
| **Total** | **SC 8,27** | **SC 7,61** |

Los objetos se venden al 100% (`tasaDeRecompra: 1`), así que cada cuenta nueva
convierte el regalo en **SC 7,61 de saldo retirable**. 50 cuentas = SC 380;
500 cuentas = SC 3.804. A 10 registros/15 min por IP son **SC 304 por hora y
por IP**, sin tope global.

Para *retirar* hace falta KYC nivel 2 y SC 50 de mínimo, así que la pérdida
directa es contenida; el daño real es (a) costo de premios regalados a bots,
(b) el combustible de ABUSO-01 (volumen de carrera gratis) y (c) el ruido en
analítica y en el embudo de conversión.

**Arreglo propuesto.** Confirmación de correo obligatoria antes de
`regalarCajasDeBienvenida` (o entregar el regalo recién al confirmar); huella
de dispositivo + una cuenta con regalo por dispositivo e IP /24 por día.

**Cómo verificar.** `node -e` sobre el catálogo: la suma de `pagoPromedio` de
las tres cajas de `Settings.CAJAS_DE_REGALO` debe dar 7,61.

---

### ABUSO-04 — Las cajas de la comunidad son un canal de transferencia de valor entre cuentas (50% del margen)
- **Severidad**: Alta · **Categoría**: lavado / movimiento de valor
- **Archivo**: `backend/services/community/index.js:314-370` (`pagarAlCreador`),
  `backend/services/boxes/index.js:275-282` (el único control: no se paga al
  creador si él mismo abre), `backend/database/models/Settings.js:89`
  (`parteDelCreador: 0.5`)
- **Confianza**: Alta · **Esfuerzo**: Medio (requiere que el panel apruebe la caja)

**Descripción.** No hay chat, ni rain, ni tips, ni envío de objetos entre
cuentas: todos esos caminos están cerrados y está bien. Pero queda uno abierto.

`pagarAlCreador` acredita al creador el 50% del margen acumulado de su caja,
como `creator_share`, **saldo retirable y sin `bonoSc`**. El único control es
el del sitio de llamada:

```js
if (caja.creator && String(caja.creator) !== String(user._id)) {
```
(`services/boxes/index.js:275`)

que solo cubre el caso de abrir la caja uno mismo. Con dos cuentas no hay nada.
`pagarAlCreador` en sí **no repite el control**, así que si mañana aparece otro
sitio de llamada el agujero se abre entero.

**Impacto concreto.** Por cada SC 100 que la cuenta B juega en la caja de A:
B pierde SC 8 (esperado) y **A cobra SC 4 retirables**. Es un 50% de recupero.

| Saldo en B | Volumen total hasta fundirse (B/0,08) | **Extraído por A** |
|---|---|---|
| SC 100 | SC 1.250 | **SC 50** |
| SC 1.000 | SC 12.500 | **SC 500** |
| SC 10.000 | SC 125.000 | **SC 5.000** |

Para qué sirve esto de verdad: **sacar el 50% de un saldo que no se puede
retirar**. Casos concretos — un `bonoPendienteSc` que no es canjeable, una
cuenta con `redemptionLock` o `trabas.canje` puestas por soporte, una cuenta
que nunca va a pasar el KYC nivel 2. Nada de eso bloquea jugar, y jugar en la
caja del cómplice convierte la mitad en saldo limpio y retirable en otra
cuenta. El libro lo muestra como `creator_share`, que es exactamente lo que
un revisor de AML espera no ver sin un control detrás.

Mitigación existente: la caja de la comunidad necesita aprobación humana
(`backend/routes/admin/index.js:582` → `services/admin/index.js:150-177`) y
cada edición la vuelve a borrador (`community/index.js:255-258`). Eso sube el
esfuerzo pero no cierra nada: una vez aprobada, la caja queda al aire.

**Arreglo propuesto.**
- Repetir el control dentro de `pagarAlCreador`, no solo en el sitio de llamada.
- No pagar `creator_share` por aperturas de cuentas que comparten IP /24,
  dispositivo o correo con el creador; dejarlas acumuladas y marcadas.
- Señal nueva en el panel Risk: creador cuyo `creator_share` viene de ≤ 3
  cuentas, o de cuentas con `trabas`/`redemptionLock`.
- No contar en el margen repartible el juego que viene de saldo con
  `bonoPendienteSc` o de una cuenta con el canje trabado.

**Cómo verificar.** A crea y publica una caja; B (misma máquina) la abre 100
veces por SC 1 cada una; `BalanceTransaction.find({user: A, type:"creator_share"})`
debería dar 0 y hoy da ≈ SC 4.

---

### ABUSO-05 — El panel Risk promete tres señales: una es código muerto, otra cuenta doble, y ninguna ve los patrones reales
- **Severidad**: Media · **Categoría**: detección / controles
- **Archivo**: `backend/routes/admin/extra.js:176-280`
- **Confianza**: Alta · **Esfuerzo**: n/a

**Descripción.** `GET /api/admin/risk` declara detectar tres cosas. Una por una:

**(a) `self_referral` — código muerto.**
```js
User.aggregate([
  { $match: { referredBy: { $ne: null } } },
  { $match: { $expr: { $eq: ["$referredBy", "$_id"] } } },
```
(`extra.js:206-209`). Busca cuentas cuyo `referredBy` es su propio `_id`. Pero
`atarAlSocio` ya lo impide (`affiliates/index.js:250`) y no hay otro camino que
lo escriba. El comentario lo admite ("una cuenta vieja o un arreglo a mano
podrían tenerlo igual"). En la práctica **siempre devuelve 0**, mientras el
auto-referido de verdad (ABUSO-02, segunda cuenta) no se mira nunca.

**(b) `cashed_out_more` — cuenta doble las devoluciones.**
```js
canjeado: { $sum: { $cond: [{ $eq: ["$type", "redemption"] }, { $abs: "$amountSc" }, 0] } },
```
(`extra.js:217`). El tipo `redemption` se usa en las **dos** direcciones:
`cashier/index.js:199` descuenta al pedir (−monto), `:254` devuelve al cancelar
(+monto) y `:346` devuelve al rechazar (+monto). Con `$abs`, un canje pedido y
cancelado suma **2× el monto** a "canjeado" sin que haya salido un peso. Un
jugador que pide y cancela SC 500 tres veces aparece con SC 3.000 "canjeados"
y jugado 0: señal falsa garantizada. Y al revés: el ruido de falsos positivos
hace que la señal verdadera no se mire.

**(c) `shared_ip`** — lo único que funciona, y sobre la IP ya recortada a /24
(`SessionEvent.recortarIp`, `models/SessionEvent.js:84-94`), con TTL de 90 días.
Detecta la familia y el locutorio; no detecta un VPN de SC 3 al mes.

**Lo que no ve ninguna señal**: farmeo de carreras (ABUSO-01), auto-referido
con segunda cuenta (ABUSO-02), farmeo del regalo de bienvenida (ABUSO-03),
transferencia vía caja de la comunidad (ABUSO-04), abuso del bono por compra.

**Arreglo propuesto.** Reemplazar (a) por "el referido comparte IP/24,
dispositivo o dominio de correo con el dueño del código"; arreglar (b) con
`{$lt: ["$amountSc", 0]}` en vez de `$abs`; y agregar: ganadores de carrera con
premio ≫ volumen, creadores de caja con `creator_share` de ≤ 3 cuentas, racimos
de cuentas creadas en la misma hora con el mismo código.

**Cómo verificar.** Pedir un canje de SC 100 y cancelarlo. `GET /api/admin/risk`
debería seguir sin esa cuenta en `cashed_out_more`; hoy la lista con
`SC 200 / SC 0`.

---

### ABUSO-06 — `usosMaximos` de un código promocional no es atómico: se puede pasar de la cuenta
- **Severidad**: Media · **Categoría**: abuso de promociones
- **Archivo**: `backend/routes/wallet/index.js:237` (`if (!codigo.sirve())`),
  `:276` (`$inc: { usos: 1 }` **después** de acreditar),
  `backend/database/models/PromoCode.js:52-58` (`sirve()` lee `this.usos`)
- **Confianza**: Alta · **Esfuerzo**: Bajo

**Descripción.** El archivo documenta correctamente que el doble canje por
persona lo impide el índice único `(code, user)` y así es. Pero el **tope
global** (`usosMaximos`) sigue el patrón que el resto del código evita a
propósito: leer, decidir en JavaScript, escribir después.

```js
if (!codigo.sirve()) throw errorDe("CODE_EXPIRED");   // lee usos
...                                                    // acredita
await PromoCode.updateOne({ _id: codigo._id }, { $inc: { usos: 1 } });  // :276
```

N jugadores distintos que canjeen a la vez leen todos el mismo `usos`, pasan
todos y acreditan todos: el índice único no los frena porque son usuarios
distintos. El tope se desborda por tantos pedidos como entren en la ventana.

**Impacto concreto.** Un código de "SC 20, primeros 100" publicado en un vídeo
se canjea con 120-300 cuentas si llegan juntas (el pico típico es el primer
minuto). Con SC 20 por canje, SC 400 a SC 4.000 de más por campaña. Combinable
con ABUSO-03: las cuentas no cuestan nada.

**Arreglo propuesto.** Mismo patrón que el resto del archivo: reservar el uso
con la condición adentro del filtro, antes de acreditar.
```js
const tomado = await PromoCode.findOneAndUpdate(
  { _id: codigo._id, activo: true,
    $or: [{ usosMaximos: 0 }, { $expr: { $lt: ["$usos", "$usosMaximos"] } }] },
  { $inc: { usos: 1 } }, { new: true });
if (!tomado) throw errorDe("CODE_EXPIRED");
// ... y devolver el uso con $inc -1 si falla el crédito
```

**Cómo verificar.** Código con `usosMaximos: 1`; disparar dos `POST /wallet/promo`
en paralelo con dos usuarios. Hoy acreditan los dos.

---

### ABUSO-07 — Un código promocional de tipo "aperturas" ignora `codigo.aperturas` y siempre regala las tres cajas de bienvenida
- **Severidad**: Media · **Categoría**: regla declarada vs implementada / costo de promoción
- **Archivo**: `backend/routes/wallet/index.js:267-269`,
  `backend/services/boxes/index.js:383-408`
- **Confianza**: Alta · **Esfuerzo**: n/a

**Descripción.**
```js
if (codigo.tipo === "aperturas" && codigo.aperturas > 0) {
  await cajas.regalarCajasDeBienvenida(usuario._id);   // :268
}
```
`regalarCajasDeBienvenida` no recibe cuántas: lee `cfg.cajasDeRegalo`, corta a
`cfg.aperturasDeRegalo` (3) y hace **`$set`** de `cajasGratis` y `freeOpens`
(`boxes/index.js:404-407`). Resultado:

1. `codigo.aperturas` se guarda en `PromoUse` (`wallet/index.js:249`) y se
   muestra en el panel (`extra.js:699`) pero **nunca decide nada**. Un código
   de "1 apertura" entrega 3; uno de "10" entrega 3.
2. Siempre son las mismas tres cajas de bienvenida; no se puede hacer una
   campaña de "una apertura gratis en la caja X".
3. Al ser `$set`, le **re-regala las tres de bienvenida** a una cuenta que ya
   las usó — que es el efecto buscado, pero no el declarado.

**Impacto concreto.** Cada canje de un código de tipo "aperturas" cuesta
**SC 7,61 de valor esperado** (ver ABUSO-03) sea cual sea el número que el
equipo haya escrito en el panel. Una campaña pensada como "1 apertura"
multiplica su costo por 3 sin avisar. Con `usosMaximos` desbordable (ABUSO-06),
el error se multiplica otra vez.

**Arreglo propuesto.** Que `regalarCajasDeBienvenida` acepte
`{ cuantas, slugs }` y use `$push`/`$inc` en vez de `$set`; que el canje pase
`codigo.aperturas`. Y agregar al modelo `PromoCode` un campo `cajas: [String]`
para poder apuntar a cajas concretas.

**Cómo verificar.** Crear un `PromoCode { tipo:"aperturas", aperturas: 1 }`,
canjearlo y mirar `freeOpens`: hoy da 3.

---

### ABUSO-08 — `POST /api/deals/play` no tiene límite de pedidos; `/api/deals/demo` además no pide sesión ni cuenta las tiradas gratis
- **Severidad**: Media · **Categoría**: abuso / superficie
- **Archivo**: `backend/routes/deals/index.js:121` (demo, sin `autorizar`, sin freno),
  `:136` (`play`, con `autorizar(true)` pero sin freno).
  Comparar con `backend/routes/boxes/index.js:35-41` (`limiteAbrir`, 120/min) y
  `:328`, `:355` donde sí se aplica.
- **Confianza**: Alta · **Esfuerzo**: Trivial

**Descripción.** El archivo de deals no importa `express-rate-limit` en
absoluto. `POST /play` es la vía más barata para generar volumen de carrera y
de rango VIP (misma cuenta en el libro: `type: "deal"` cuenta en
`races/index.js:50` y `vip/index.js:75`), y queda sin techo mientras las
cajas están limitadas a 120 aperturas por minuto.

`POST /demo` es peor: **sin sesión**, sin límite y sin consumir ningún
contador. La perilla `deals.tiradasGratisPorItem` (Settings.js:280, "1 tirada
gratis por item para visitantes") no se lee en ningún lado. El endpoint hace
un `Item.findById` y HMACs por cada tiro, hasta 4 por pedido, sin autenticar:
amplificador de carga gratis.

**Impacto concreto.** Un script sin cuenta satura `POST /api/deals/demo`;
con cuenta, `POST /api/deals/play` multiplica el ritmo de farmeo de
ABUSO-01 sin el techo de 120/min que sí tienen las cajas.

**Arreglo propuesto.** Aplicar `limiteAbrir` (o uno propio) a `/play` y a
`/demo`, y llevar el contador de demos de deals en el usuario igual que
`demosUsadas` en cajas (`routes/boxes/index.js:334-340`), leyendo
`deals.tiradasGratisPorItem`.

**Cómo verificar.** 500 `POST /api/deals/demo` seguidos: hoy pasan los 500.

---

### ABUSO-09 — Crear cajas de la comunidad: cuerpo de 12 MB, sin límite de pedidos y sin sesión en `/quote`
- **Severidad**: Media · **Categoría**: abuso de recursos
- **Archivo**: `backend/index.js:90-97` (`SUBEN_ARCHIVOS` incluye `/api/community`,
  límite 12 MB), `backend/routes/community/index.js:223` (`POST /quote`, sin
  `autorizar`), `:249` (`POST /`, sin freno),
  `backend/services/community/index.js:197-207` (dos logos `data:` de hasta
  2,9 MB cada uno, guardados en la base), `:50` (`CAJAS_POR_CREADOR = 20`)
- **Confianza**: Alta · **Esfuerzo**: Bajo

**Descripción.** `portadaLimpia` valida bien el tipo (`data:image/(png|jpeg|webp)`)
y el tamaño por logo, y el comentario reconoce que guardar `data:` en la base
es una decisión temporal acotada por el tope de 20 cajas por creador. Lo que
falta es el techo de **cuentas**: las cuentas son gratis y no verifican correo
(ABUSO-03).

**Impacto concreto.** 20 cajas × 2 logos × 2,9 MB ≈ **116 MB de base por
cuenta**. 50 cuentas = 5,8 GB. Y `POST /quote` acepta cuerpos de 12 MB sin
sesión y sin freno: corre `premiosDesdeElPedido` (hasta 20 `Item.find`) y
`revisarCaja` por pedido.

**Arreglo propuesto.** `autorizar(true)` + freno en `/quote`; freno en
`POST /` y `PUT /:id`; exigir correo verificado para crear cajas; mover los
logos a un depósito de archivos o bajar el tope a ~300 KB por logo.

**Cómo verificar.** `POST /api/community/quote` con 12 MB y sin token: hoy
responde 200.

---

### ABUSO-10 — `POST /wallet/code` es un oráculo de enumeración de códigos
- **Severidad**: Baja · **Categoría**: enumeración
- **Archivo**: `backend/routes/wallet/index.js:169-213`
- **Confianza**: Alta · **Esfuerzo**: Bajo

**Descripción.** El endpoint devuelve errores distintos según lo que pasó:
`OWN_CODE` (:178), `CODE_ALREADY_USED` (:179), `CODE_EXPIRED` (:180),
`PROMOS_LOCKED` (:235), `BELOW_MINIMUM` (:239), `CODE_NOT_FOUND` (:212). El
comentario explica —con razón— que esto es bueno para el jugador. El efecto
secundario es que distingue **"ese código no existe"** de **"existe pero…"**,
así que se puede mapear el espacio de códigos vivos sin canjearlos.

El freno es `freno` (`:36-42`): 20 pedidos por minuto **por IP**, y lo comparte
con `/deposit`, `/withdraw` y `/promo`. Son ~28.800 intentos por día por IP.
Para códigos de campaña cortos y adivinables (`WELCOME`, `MRBOX10`, el nombre
de un streamer) eso alcanza de sobra.

(No se reporta la falta de límite por cuenta: está fuera de alcance por pedido.)

**Arreglo propuesto.** Mantener los mensajes útiles solo para códigos que el
jugador tiene derecho a ver (de afiliado), y responder `CODE_NOT_FOUND` genérico
para los promocionales no canjeables; freno propio y más duro en `/code` y
`/promo`; exigir que los códigos generados tengan ≥ 10 caracteres de entropía.

**Cómo verificar.** Probar un código inexistente y uno vencido: hoy los
mensajes difieren.

---

## 2. CONTROLES DE JUEGO RESPONSABLE

### JRG-01 — La pausa y los límites solo frenan jugar: no frenan cobrar promociones, rakeback ni comisiones, ni la acreditación de compras
- **Severidad**: Alta · **Categoría**: juego responsable
- **Archivo**: `backend/services/controls/index.js:114-150` (`revisarAntesDeJugar`),
  llamado **solo** en `backend/services/boxes/index.js:125` y
  `backend/services/deals/index.js:227`
- **Confianza**: Alta (verificado: `grep -rn "controles" backend/` da exactamente
  esos dos sitios de llamada más las rutas de perfil) · **Esfuerzo**: n/a

**Descripción.** El comentario de cabecera del servicio declara la política:
*"Lo que se bloquea es JUGAR, no la cuenta"*, y para jugar está bien resuelto
(se revisa la tanda entera antes de cobrar, apretar vale ya y aflojar espera
24 h, la pausa no se acorta). El problema es el alcance real.

**Lista de endpoints que mueven plata, y si consultan los controles:**

| Endpoint | Qué hace | ¿Consulta `controles`? | Veredicto |
|---|---|---|---|
| `POST /api/boxes/:slug/open` | gasta | **Sí** (`boxes/index.js:125`) | OK |
| `POST /api/deals/play` | gasta | **Sí** (`deals/index.js:227`) | OK |
| `POST /api/inventory/:id/sell` | cobra | No | Correcto (cobrar lo ganado) |
| `POST /api/inventory/sell-many` | cobra | No | Correcto |
| `POST /api/wallet/withdraw` | cobra | No | Correcto (y deseable) |
| `POST /api/wallet/promo` | **acredita SC o cajas gratis** | **No** | **Hallazgo** |
| `POST /api/wallet/code` | **acredita SC o cajas gratis** | **No** | **Hallazgo** |
| `POST /api/vip/rakeback/:periodo` | acredita rakeback | **No** | **Hallazgo** |
| `POST /api/affiliates/campaigns/:id/claim` | acredita comisión | **No** | Menor |
| `POST /api/hooks/oxapay` | **acredita la compra de SC** | **No** | **Hallazgo** |
| `POST /api/inventory/ship` | mueve objetos | No | Correcto |
| premio de carrera / desafío / creador | acredita | No | Correcto (ya ganado) |

Los cuatro marcados son el problema: a un jugador **en pausa** el sitio le
sigue entregando **cajas gratis** (`/promo` y `/code` con un código de tipo
"aperturas" le reponen tres aperturas, ver ABUSO-07), le sigue acreditando
rakeback, y sobre todo **le sigue acreditando compras de SC**. Autoexcluirse y
poder seguir cargando saldo es lo primero que mira un auditor de juego
responsable y lo primero que un regulador llama "autoexclusión decorativa".

Además las tres cajas gratis reponidas durante la pausa sí van a chocar contra
`revisarAntesDeJugar` al abrirse, así que el jugador en pausa recibe un regalo
que no puede usar: el peor incentivo posible para pedir levantar la pausa.

**Impacto concreto.** Un jugador en pausa de 365 días (`PAUSA_MAXIMA_DIAS`)
puede depositar SC 10.000, cobrar rakeback y canjear códigos durante toda la
pausa. No pierde plata jugando, pero el sitio le sigue vendiendo y
comunicando: eso es exactamente lo que la pausa tiene que cortar.

**Arreglo propuesto.**
- `controles.enPausa(userId)` consultado en `canjearPromo`, en
  `cobrarRakeback` y en el callback de OxaPay (ahí: no acreditar, devolver o
  retener el pago y avisar a soporte).
- `trabas.promos` ya existe y funciona (`wallet/index.js:235, 295`): la pausa
  debería implicarlo.

**Cómo verificar.** `POST /api/profile/controls/break {dias: 30}` y después
`POST /api/wallet/promo` con un código vivo: hoy acredita.

---

### JRG-02 — No hay verificación de edad en el registro ni geobloqueo de estados/países
- **Severidad**: Crítica (cumplimiento) · **Categoría**: cumplimiento sweepstakes
- **Archivo**: `backend/routes/auth/index.js:108-190` (el registro pide usuario,
  correo, clave y nada más), `backend/database/models/User.js` (sin fecha de
  nacimiento, sin país, sin estado), `backend/services/verification/index.js:57-58`
  (`EDAD_MINIMA = 18`, **solo** en el formulario de nivel 1)
- **Confianza**: Alta (verificado: `grep -rniE "geoip|country|birth|nacimiento|edad"` en
  `backend/` no devuelve ningún control en el registro ni en jugar/comprar) · **Esfuerzo**: n/a

**Descripción.** Lo dejo dicho claramente, como se pidió: **para un sweepstakes
en EE.UU. esto es un requisito legal y hoy no existe.**

Lo que sí hay: la edad se valida al mandar la verificación de nivel 1
(`verification/index.js:133-138`, `TOO_YOUNG`), que es opcional y solo hace
falta para canjear o recibir un envío. Y una frase en el pie: *"By using this
site you confirm that you are over 18"* (`foot.age`) más el sello `18+`
(`MbPie.vue:33-34`). Una frase en el pie no es una puerta de edad.

Lo que falta:
1. **Puerta de edad en el registro**: ninguna fecha de nacimiento, ninguna
   casilla que haya que marcar y que el servidor exija. El registro solo
   valida forma de usuario, correo y largo de clave.
2. **Geobloqueo**: `User` no guarda país ni estado; no hay GeoIP, ni lista de
   estados restringidos (WA, ID, MI, NV, entre otros, que son los que los demás
   sweepstakes excluyen), ni lista de países sancionados. El único "país" del
   modelo está en la dirección de envío (`Address.pais`) y se usa para el
   paquete, no para decidir si la persona puede jugar.
3. **Coherencia con el copy**: el pie dice *"Void where prohibited"*
   (`foot.legal3`) y el sitio no tiene con qué hacerlo cumplir.

**Impacto concreto.** El riesgo no se mide en SC: es la pasarela de pago y la
licencia. OxaPay, y cualquier procesador, pide autodeclaración de edad y
bloqueo geográfico antes de habilitar una cuenta de sweepstakes. También es el
camino directo a una cuenta de un menor que compra SC con la tarjeta de un
padre, con devolución de cargo y reclamo encima.

**Arreglo propuesto.**
1. Fecha de nacimiento obligatoria en `POST /auth/register`, validada contra
   `EDAD_MINIMA` del servicio de verificación (la función `edadDe` ya existe).
2. Campo `pais`/`estado` en `User`, resuelto por GeoIP en el registro y
   revisado en cada login; lista de estados y países bloqueados en `Settings`.
3. Revisión del geobloqueo en los endpoints que gastan y en el canje, no solo
   en el registro (un VPN al registrarse no debería alcanzar).

**Cómo verificar.** `POST /api/auth/register` con fecha de nacimiento de 2015:
hoy no hay dónde ponerla y la cuenta se crea igual.

---

### JRG-03 — No hay límite de compra/depósito, y los límites que hay son solo diarios
- **Severidad**: Media · **Categoría**: juego responsable
- **Archivo**: `backend/services/controls/index.js:40-50` (`vigentes`: solo
  `juegoDiarioSc` y `perdidaDiariaSc`), `backend/routes/wallet/index.js:395-415`
  (el callback acredita sin mirar ningún tope)
- **Confianza**: Alta · **Esfuerzo**: n/a

**Descripción.** Los dos límites que el jugador puede ponerse se validan en el
servidor correctamente (están en `revisarAntesDeJugar`, antes de cobrar, con la
tanda entera, y salen del libro y no de un contador). Pero:
- **No hay límite de depósito/compra**, que es el límite que piden casi todos
  los marcos de juego responsable y el más fácil de respetar.
- **No hay ventana semanal ni mensual**: `arranqueDelDia()` corta siempre a
  medianoche UTC. Un jugador que quiere un tope mensual no lo puede pedir.
- El tope de pérdida se mide como "jugado − vendido del día"
  (`controls/index.js:92-96`), y el comentario explica que es a propósito. Es
  honesto, pero significa que un jugador con el inventario sin vender nunca
  llega a su tope de pérdida.

**Arreglo propuesto.** Agregar `compraDiariaSc/SemanalSc/MensualSc` al modelo
`limites`, revisarlo en el callback de la pasarela, y agregar ventanas semanal
y mensual a los dos límites que ya existen, con la misma regla de
"apretar vale ya, aflojar espera 24 h" que ya está bien resuelta.

---

## 3. CUMPLIMIENTO Y COPY

### COPY-01 — Las cinco páginas legales no existen: el pie enlaza a `/legal/*` y el router manda a `/boxes`
- **Severidad**: Crítica · **Categoría**: cumplimiento sweepstakes
- **Archivo**: `frontend/src/components/MbPie.vue:82-86` (los cinco enlaces),
  `frontend/src/router/index.js:18-239` (**no hay ninguna ruta `/legal`**),
  `:239` (`{ path: "*", redirect: "/boxes" }`),
  `backend/routes/admin/extra.js:715` (`router.get("/legal", pendiente("legalPages"))`)
- **Confianza**: Alta (verificado: no existe ningún `LegalView.vue` en
  `frontend/src/views/`) · **Esfuerzo**: Alto (hay que escribir los textos)

**Descripción.** El pie, que está en todas las pantallas, tiene una columna
"LEGAL" con cinco enlaces:

| Enlace | Destino | Qué pasa hoy |
|---|---|---|
| General terms | `/legal/terms` | **redirige a `/boxes`** |
| **Sweepstakes rules** | `/legal/rules` | **redirige a `/boxes`** |
| Responsible play | `/legal/responsible` | **redirige a `/boxes`** |
| Privacy policy | `/legal/privacy` | **redirige a `/boxes`** |
| Customer acceptance | `/legal/acceptance` | **redirige a `/boxes`** |

El comentario del componente dice *"Todas llevan a pantallas que existen: un
pie lleno de enlaces muertos es peor que un pie corto"*. No es así: el
comodín `path: "*"` del router las traga todas en silencio, sin 404 ni
mensaje. El jugador que hace clic en "Sweepstakes rules" termina en el
catálogo de cajas.

Y el pie, al mismo tiempo, afirma: *"No purchase necessary. Sweeps Coins can
be redeemed for prizes under the official rules. Void where prohibited."*
(`foot.legal3`). **Se invocan "las reglas oficiales" que no existen en ningún
lado**, ni en el frontend ni en el backend (el panel lo reconoce:
`pendiente("legalPages")`).

**Impacto concreto.** Esto es lo que cierra una pasarela de pago. El
expediente de alta de cualquier procesador para un sweepstakes pide: reglas
oficiales publicadas y accesibles, términos, privacidad, juego responsable, y
el método alternativo de entrada. Hoy MR BOX tiene **cero de cinco**, con
enlaces que fingen tenerlas. Además, prometer "official rules" que no están
publicadas es, por sí solo, una afirmación engañosa.

**Arreglo propuesto.** Modelo `LegalPage` (clave, idioma, título, cuerpo,
versión, fecha de vigencia), pantalla `/legal/:clave` con contenido desde la
API, sección Legal pages del panel, y una ruta 404 real antes del comodín para
que un enlace muerto se note. Los textos los tiene que escribir un abogado de
sweepstakes de EE.UU.; el código puede ir antes.

**Cómo verificar.** Abrir `http://localhost:8090/legal/rules`: hoy aterriza en
`/boxes` sin aviso.

---

### COPY-02 — Palabras prohibidas en el copy de cara al jugador, en inglés y en los ocho idiomas traducidos
- **Severidad**: Alta · **Categoría**: cumplimiento / marca
- **Archivo**: `frontend/src/i18n/locales/*.js` (los nueve), generados desde
  `frontend/scripts/traducir.py`
- **Confianza**: Alta (script de conteo sobre los nueve locales ya parseados) · **Esfuerzo**: Medio

**Descripción.** El inventario completo está en la sección 5 de este documento
(tabla clave por clave). Resumen de conteos, separando **lo que ve el jugador**
de **lo que es interno** (panel de administración, nombres de variables,
comentarios en español, campos de la base — esos últimos no se reportan):

**En inglés (`en.js`), 36 claves con palabra prohibida: 29 de jugador, 7 solo del panel.**

| Palabra | Apariciones totales (9 idiomas) | Claves distintas | **Claves de jugador** | Idiomas donde aparece el término inglés |
|---|---|---|---|---|
| `deposit` | 71 | 23 | **17** | en + 8 (vía claves `admin.*` sin traducir) |
| `wager` | 15 | 7 | **6** | en + 8 (ídem) |
| `odds` | 7 | 7 | **7** | solo en |
| `bet` / `betting` | 0 | 0 | 0 | — |
| `gamble` / `gambling` | 0 | 0 | 0 | — |
| `casino` | 0 | 0 | 0 | — (pero ver ruso, abajo) |
| `jackpot` | 0 | 0 | 0 | — |
| `real money` / `win real money` | 0 | 0 | 0 | — |

**Y los equivalentes traducidos, que son el mismo problema en otro idioma**
(solo claves de jugador, `admin.*` excluidas):

| Idioma | deposit | wager/bet | odds | casino |
|---|---|---|---|---|
| de | 15 (`Einzahlung`) | 14 (`Einsatz`) | **2 (`Beste Quoten`)** | 0 |
| fr | 15 (`dépôt`) | **16 (`mise`, `misé`)** | 0 | 0 |
| es | 16 (`depósito`) | 1 (`apuesta mínima`) | 0 | 0 |
| pt | 17 (`depósito`) | **7 (`Apostado`, `aposta`)** | 0 | 0 |
| it | 14 (`deposito`) | 1 (`puntata`) | 1 (`quote`) | 0 |
| ru | 15 (`пополнение`) | 14 (`ставка`) | 0 | **4 (`казино`)** |
| ja | 18 (`入金`) | 0 | 0 | 0 |
| zh | 21 (`充值`) | **27 (`投注`)** | **2 (`赔率`)** | 0 |

**Los cuatro peores, uno por uno:**

1. **Ruso: `казино` ("casino") en cuatro claves de cara al jugador**, en la
   pantalla de afiliados: `affil.mRevSub` = *"Доля от того, что **казино** на
   них заработало"*, y lo mismo en `affil.mRevText`, `affil.endsRev`,
   `affil.endsHyb`. En inglés esas mismas claves dicen "the house". El ruso
   llama casino al sitio, en la pantalla que más se comparte hacia afuera.
2. **Chino: 27 claves de jugador con `投注` ("apostar / hacer una apuesta")** y
   2 con `赔率` ("cuotas de apuesta"): `races.wagered` = `投注`,
   `boxes.sortReturn` y `rows.generous` = `赔率最佳` ("mejores cuotas"),
   `affil.played` = `投注额`, `profile.theirPlay` = `他们的投注`.
3. **Portugués: `Apostado` / `aposta`** en `profile.wagered`, `races.wagered`,
   `races.wageredShort`, `races.yourWager`, `deals.minStakeNote` y `refer.sub`
   (*"comissão em cada **aposta** deles"*). El español, para la misma clave,
   usa "Jugado": el portugués quedó atrás.
4. **Alemán e italiano: `Beste Quoten` / `quote`** en la fila de la portada y
   en el orden del catálogo. `Quote` en alemán es literalmente la cuota de una
   casa de apuestas.

**Tabla de reemplazos sugeridos (claves de jugador):**

| Clave | Hoy (en) | Debería decir |
|---|---|---|
| `action.deposit` | Deposit | **Buy SC** / *Add balance* |
| `wallet.useAddress` | Use a deposit address | Use a **top-up** address |
| `wallet.depositNote`, `wallet.depositSoon`, `wallet.notConnected`, `wallet.connectNone`, `wallet.qrAlt`, `wallet.walletNote` | Deposit(s) | **Purchase(s)** |
| `faq.missing.q` / `.a` | My deposit has not arrived | My **purchase** has not arrived |
| `profile.transactionsSub` | Your deposits, withdrawals… | Your **purchases, redemptions** and affiliate payouts |
| `redeem.sub`, `redeem.wonBonus` | next deposit | next **purchase** |
| `refer.sub` | 5% deposit bonus … every wager they place | 5% **purchase** bonus … everything they **play** |
| `affil.mCpaText`, `affil.qualifies`, `affil.waitingSub` | deposits / deposited | **purchases / purchased** |
| `profile.wagered`, `races.wagered`, `races.wageredShort`, `races.yourWager`, `refer.wagerVolume` | Wagered / Wager | **Played** / **Play volume** |
| `box.bestOdds`, `boxes.sortReturn`, `rows.generous` | Best odds | **Best return** / *Most generous* |
| `create.step3`, `create.priceNote`, `faq.fair.a`, `faq.howOpen.a` | odds | **chances** |
| ru `affil.mRevSub`, `affil.mRevText`, `affil.endsRev`, `affil.endsHyb` | казино | **площадка / сайт** |
| zh `races.wagered`, `affil.played`, `profile.theirPlay`, +24 | 投注 | **游玩额 / 开盒额** |
| zh `boxes.sortReturn`, `rows.generous` | 赔率最佳 | **回报最佳** |
| de `boxes.sortReturn`, `rows.generous` | Beste Quoten | **Beste Rückgabe** |
| pt `profile.wagered`, `races.wagered*`, `races.yourWager`, `refer.sub` | Apostado / aposta | **Jogado / jogada** |
| fr `profile.wagered`, `races.*`, `box.riskExplainer` | Misé / mise | **Joué / montant joué** |

**Arreglo propuesto.** Los locales se generan: hay que cambiar
`frontend/scripts/traducir.py` (la tabla `T`) y volver a correrlo. Editar los
`.js` a mano no sirve, el script los pisa — lo dice su propia cabecera.
Después agregar al script un chequeo que falle si alguna cadena de jugador
contiene una de estas palabras en cualquiera de los nueve idiomas.

**Cómo verificar.** Volver a correr el script de conteo de la sección 5: los
conteos de "claves de jugador" deben quedar en 0.

---

### COPY-03 — `aria-label="Deposit"` escrito en duro, sin traducir, en el botón de la cabecera
- **Severidad**: Media · **Categoría**: cumplimiento / copy
- **Archivo**: `frontend/src/components/MbCabecera.vue:95`
- **Confianza**: Alta · **Esfuerzo**: Trivial

**Descripción.** El botón "+" de la billetera, que está en **todas** las
pantallas, lleva `aria-label="Deposit"` literal. Dos problemas en uno: es una
palabra prohibida visible para lectores de pantalla y para cualquier scraper
de cumplimiento, y es la única cadena de cara al usuario de todo el frontend
que no pasa por `$t()` (la línea de abajo, `:120`, sí usa `$t('action.deposit')`).

**Arreglo.** `:aria-label="$t('action.deposit')"`, y cambiar esa clave por
"Buy SC" según COPY-02.

**Cómo verificar.** `grep -rn 'aria-label="' frontend/src --include=*.vue | grep -v '\$t('`
debe quedar sin resultados de texto en inglés.

---

### COPY-04 — "No purchase necessary" se afirma en el pie pero no existe ningún método alternativo de entrada (AMOE)
- **Severidad**: Alta · **Categoría**: cumplimiento sweepstakes
- **Archivo**: `frontend/src/i18n/locales/en.js` → `foot.legal3`;
  `vip.faq` (*"No purchase is needed to play, to climb the ranks or to redeem prizes"*);
  sin contraparte en `backend/routes/` (verificado: `grep -rniE "no purchase|free entry|amoe"`
  en `backend/` no devuelve nada)
- **Confianza**: Alta · **Esfuerzo**: Alto

**Descripción.** El sitio declara dos veces que no hace falta comprar:
- pie, en los nueve idiomas: *"No purchase necessary. Sweeps Coins can be
  redeemed for prizes under the official rules. Void where prohibited."*
- FAQ del Club VIP: *"No. No purchase is needed to play, to climb the ranks or
  to redeem prizes."*

Y **no hay ningún camino implementado para conseguir SC sin comprar**, salvo:
- las 3 aperturas de regalo del registro (`regalarCajasDeBienvenida`), que son
  aperturas de cajas concretas y no SC, se dan una sola vez y no están
  documentadas como AMOE;
- un código promocional, que depende de que el equipo publique uno.

No existe la solicitud por correo postal (el AMOE clásico de los sweepstakes de
EE.UU.), ni un formulario de entrada gratuita, ni límites diarios de entradas
gratuitas, ni reglas que digan cómo pedirlas — porque tampoco existen las
reglas (COPY-01).

**Impacto concreto.** Es el punto exacto sobre el que se apoya el modelo
sweepstakes: sin AMOE real y documentado, "no purchase necessary" es falso y
el producto deja de ser un sweepstakes para parecer una venta de azar. Es, con
COPY-01, lo que hace que un procesador rechace o cierre la cuenta.

**Arreglo propuesto.** Implementar el AMOE: formulario de solicitud + dirección
postal publicada en las reglas, acreditación manual desde el panel con su
propio tipo de movimiento (`amoe`), tope de entradas por persona y por día, y
las mismas condiciones de canje que el SC comprado. Documentarlo en
`/legal/rules`.

---

### COPY-05 — Estado de las traducciones: el panel está en inglés en los nueve idiomas; 15 claves de jugador sin traducir
- **Severidad**: Info/Baja · **Categoría**: i18n
- **Archivo**: `frontend/src/i18n/locales/*.js`, `frontend/scripts/panel.py`
- **Confianza**: Alta (script de comparación) · **Esfuerzo**: Bajo

**Números concretos**, de comparar los nueve locales clave por clave:

| | |
|---|---|
| Claves por idioma | **1.639, idénticas en los nueve** |
| Claves faltantes respecto a `en` | **0 en los 8 idiomas** |
| Claves sobrantes | **0 en los 8 idiomas** |
| Textos "BetSweeps" dentro de MR BOX | **0** (limpio) |
| Textos "MR BOX" | 13 por idioma (11 en ja) |

| Idioma | Claves idénticas a `en` | …con texto real (no marca/número) | **…de cara al jugador** |
|---|---|---|---|
| de | 719 | 700 | **43** |
| fr | 711 | 695 | **38** |
| it | 707 | 690 | **33** |
| pt | 698 | 682 | **25** |
| es | 696 | 680 | **23** |
| ja | 687 | 673 | **16** |
| ru | 686 | 672 | **15** |
| zh | 685 | 672 | **15** |

De las 672 claves idénticas en **los ocho idiomas a la vez**, **657 son
`admin.*`**: el panel está en inglés a propósito (`frontend/scripts/panel.py`
lo documenta: *"Los textos del panel van aparte … y en un solo idioma"*). Eso
no es un hallazgo de cara al jugador.

Las **15 de jugador** sin traducir en ningún idioma sí conviene mirarlas:
`affil.mCpa`, `affil.mRev`, `affil.mCpaTitle`, `affil.mRevTitle` (siglas de la
industria, aceptables); `rows.banners`, `rows.pulls`, `rows.bannersRule`,
`rows.pullsRule`, `rows.popularRule`, `rows.featuredRule`, `rows.luxuryRule`,
`rows.cheapRule`, `rows.generousRule` (descripciones internas de las filas de
la portada, hoy solo las consume `GET /api/admin/home` — están bajo un prefijo
de jugador por error de ubicación, no de traducción);
`create.namePlaceholder` = *"Friday Night Drop"* (**esta sí la ve el jugador**,
en el armador de cajas, en los nueve idiomas); `foot.copy` = `© {anio} MR BOX`
(correcto).

El resto son préstamos legítimos por idioma (`Menu`, `Total`, `Chance`, `Auto`,
`Max`, `Crypto`, `Rakeback`, `Top 10`): 15 a 43 según el idioma, ninguno grave.

**Arreglo.** Traducir `create.namePlaceholder`; mover `rows.*Rule` al espacio
`admin.*`, que es donde se usan.

---

## 4. REGLAS DECLARADAS vs IMPLEMENTADAS

Cada fila: la regla que el sitio le promete al usuario (o al dueño, en el
panel), y dónde la valida el **servidor** — o si no la valida.

| # | Regla declarada | Dónde se declara | Validación en servidor | Veredicto |
|---|---|---|---|---|
| 1 | Canje mínimo SC 50 | `Settings.canjeMinimoSc`, `/wallet/coins` | `services/cashier/index.js:134-135` | **OK** |
| 2 | Canje pide verificación nivel 2 | spec, `foot`/perfil | `cashier/index.js:150-152` (+ `nivelQuePide` lee la perilla) | **OK** |
| 3 | El canje lo aprueba una persona | spec | `cashier/index.js:310-400` (`resolver`), con la condición de estado adentro del filtro | **OK** |
| 4 | Máximo 3 canjes pendientes | — | `cashier/index.js:166-169` | **OK** |
| 5 | El bono sin jugar no se puede canjear | `User.bonoPendienteSc` | `services/wallet/index.js:117-127` (`$expr` en el filtro, sin ventana) | **OK, muy bien resuelto** |
| 6 | Envío pide nivel 3 (o 2 según perilla); > SC 1.000 siempre 3 | spec, `inventory` | `User.puedeEnviar` + `services/shipping/index.js:89-99` | **OK** |
| 7 | Máximo 20 objetos por envío | — | `shipping/index.js:42, 62` | **OK** |
| 8 | Código de afiliado una sola vez, no se cambia | `/wallet/code` | `affiliates/index.js:252-255` (`referredBy: null` en el filtro) | **OK** |
| 9 | Código promocional una vez por persona | `PromoCode` | índice único `(code, user)`, `models/PromoCode.js:70` | **OK** |
| 10 | Código promocional: tope global de usos | `PromoCode.usosMaximos`, panel | `wallet/index.js:237` + `:276` — **no atómico** | **ABUSO-06** |
| 11 | Código de "N aperturas" | `PromoCode.aperturas`, panel | **No se usa**: siempre 3 cajas (`wallet/index.js:268`) | **ABUSO-07** |
| 12 | Rakeback: una vez por ventana | `vip` | índice único `(user, periodo, desde)`, `vip/index.js:296-306` | **OK** |
| 13 | Rakeback según rango VIP, con rango manual | `User.rangoManual`, `/vip` | **Roto**: `vip/index.js:223` y `:282` hacen `.select("jugadoSc")` y después `rangoDe(u.jugadoSc, u.rangoManual)` con `rangoManual` **siempre `undefined`** | **REGLA-04** |
| 14 | Mínimo de cobro del socio según rango | `affil` | `affiliates/index.js:626-627` | **OK** |
| 15 | Máximo 10 campañas por socio | `affil` | `affiliates/index.js:595` | **OK** |
| 16 | CPA: depósito ≥20, jugado ≥200, KYC ≥2, espera 14 días, tope 40/día | panel afiliados | `affiliates/index.js:413-417`, `:426-430`, `:451-484`, `:493-500`, `:540-556` | **OK, bien resuelto** |
| 17 | Bono por depósito 5% / 10% | **`/wallet/coins` y `/public` se lo muestran al jugador** | `bonoPorDeposito` **nunca se lee** al acreditar; el bono sale del rango del afiliado y es **0 sin código** | **REGLA-01** |
| 18 | Retorno objetivo 92%, editable en el panel | `Settings.retornoObjetivo`, panel Settings | **Nunca se usa en runtime**: `eco.precioDe()` se llama sin el parámetro en `routes/admin/index.js:503, 698` y `community/index.js:235` | **REGLA-02** |
| 19 | Tope de premio SC 300.000 | spec, `Settings.topePremioSc`, panel | **Nunca se usa en runtime**: `revisarCaja` usa `topePremio = Infinity` por defecto (`economia.js:135`) y ningún sitio de llamada lo pasa salvo los scripts de siembra | **REGLA-02** |
| 20 | Caja de comunidad: 5 a 20 objetos, editable | `Settings.objetosPorCajaDeComunidad`, panel | Se valida, pero contra la constante `eco.OBJETOS_COMUNIDAD` (`economia.js:57`), **no contra la perilla** | **REGLA-03** |
| 21 | Deals: chance 1%–80%, margen 8%, 4 ruedas, 1 tirada gratis por item | spec, `Settings.deals.*`, panel | Se valida contra constantes del código (`deals/index.js:62-63`, `:116`) y contra `cfg.cajasALaVez` (`:190`); **las cinco perillas `deals.*` no se leen nunca**; `tiradasGratisPorItem` no existe | **REGLA-03** |
| 22 | Cajas a la vez (x1–x4) | `Settings.cajasALaVez` | `boxes/index.js:90-93` | **OK** |
| 23 | Recompra al 100% | `Settings.tasaDeRecompra` | `boxes/index.js:516` | **OK** |
| 24 | Parte del creador 50% del margen | `Settings.parteDelCreador` | `community/index.js:350-352` | **OK** (pero ver ABUSO-04) |
| 25 | 3 demos por visitante | `Settings.aperturasDeDemo` | `routes/boxes/index.js:331-340` **con sesión**; sin sesión lo cuenta la pantalla (declarado). En Deals, **nada** | **ABUSO-08** |
| 26 | Carreras: top 10, reparto fijo | spec | `races/index.js:53`, `:200-206` | OK la mecánica, **sin piso** → **ABUSO-01** |
| 27 | Edad mínima 18 | pie, `verification` | **Solo** en el formulario de nivel 1 (`verification/index.js:133-138`); nada en el registro | **JRG-02** |
| 28 | "Void where prohibited" (geo) | `foot.legal3` | **No existe** | **JRG-02** |
| 29 | Reglas de sweepstakes, términos, privacidad, juego responsable | pie, 5 enlaces | **No existen**; el router los traga | **COPY-01** |
| 30 | "No purchase necessary" | pie, FAQ VIP | **Sin AMOE** | **COPY-04** |

### REGLA-01 — El bono por depósito que el sitio anuncia no es el que acredita, y sin código de afiliado es cero
- **Severidad**: Media · **Categoría**: regla declarada vs implementada
- **Archivo**: `backend/routes/wallet/index.js:54` y `backend/routes/public/index.js:35`
  (se le muestra `cfg.bonoPorDeposito` al jugador), contra
  `backend/services/affiliates/index.js:296-306` (`bonoDeCompra`, que devuelve
  `{bonoSc: 0}` si `!usuario.affiliateCode`) y `:214-230` (`bonoDe`, que sale de
  `rangoNumero(...).bonoPct`)
- **Confianza**: Alta (verificado: `grep -rn "bonoPorDeposito" backend/` solo da
  el modelo, el panel y las dos respuestas al jugador — nunca la acreditación)

**Descripción.** `GET /api/wallet/coins` devuelve `bonoPorDeposito: {normal:
0.05, destacado: 0.10}` y la pantalla del cajero lo muestra. Pero el bono real
lo calcula `afiliados.bonoDeCompra`, que:
1. devuelve **0** si el jugador no tiene `affiliateCode`, y
2. si lo tiene, usa `bonoPct` del **rango del socio** (`rangosAfiliado`), no
   `bonoPorDeposito`.

Resultado: el jugador sin código ve "5% de bono" y recibe 0; el jugador de un
socio Diamond ve "5%" y recibe 10%. Y el dueño, que mueve las dos perillas
`bonoPorDeposito.normal/destacado` en Admin → Settings, no cambia nada.

**Impacto.** Promesa incumplida de cara al jugador (reclamo de soporte
garantizado en cada compra sin código) y una perilla del panel que miente.

**Arreglo.** Decidir cuál manda. Si manda el rango del afiliado, no mostrar
`bonoPorDeposito` al jugador: mostrar el porcentaje de *su* código (ya se
calcula en `POST /wallet/code`, `wallet/index.js:191`) o 0 si no tiene, y
borrar las dos perillas muertas del panel.

**Cómo verificar.** Cuenta sin código: `GET /api/wallet/coins` dice 5%;
simular un callback de compra de SC 100 → se acreditan SC 100, no SC 105.

### REGLA-02 — `retornoObjetivo` y `topePremioSc` son perillas editables que no se leen en runtime
- **Severidad**: Media · **Archivo**: `backend/routes/admin/index.js:1079` (están en la
  lista blanca de lo editable), `:503` y `:698` (`eco.precioDe(prizes)` sin el
  segundo parámetro), `backend/services/community/index.js:232` y `:235`
  (`revisarCaja` sin `topePremio` y `precioDe` sin `retornoObjetivo`),
  `backend/services/boxes/economia.js:134-135` (los defaults: `0.92` e `Infinity`)
- **Confianza**: Alta (verificado con `grep -rn "retornoObjetivo\|topePremio" backend/`:
  fuera de `economia.js`, solo aparecen en los scripts de siembra y en la lista
  blanca del panel)

El dueño puede bajar el retorno objetivo a 85% o subir el tope de premio desde
Admin → Settings y **no pasa nada**: toda caja guardada desde el panel o creada
por un jugador se vuelve a preciar con el `0.92` del código, y el tope de
premio de SC 300.000 de la spec **no se aplica** al editar una caja ni al
armar una de la comunidad (sí lo aplican los dos scripts de siembra, que es por
qué hoy no hay ningún item del catálogo por encima del tope: el más caro es el
G63 a SC 284.000).

Riesgo concreto: el día que entre al catálogo un item de SC 400.000, nada
impide que un jugador lo meta en una caja de la comunidad. La aprobación del
panel es el único freno, y el revisor no ve ningún error — `revisarCaja`
devuelve `ok: true`.

**Arreglo.** Pasar `{ retornoObjetivo: cfg.retornoObjetivo, topePremio:
cfg.topePremioSc }` en los tres sitios de llamada de runtime, igual que ya lo
hacen `scripts/sembrar.js:271` y `scripts/sembrarDesdeDiseno.js:128`.

### REGLA-03 — Las cinco perillas de Deals y el rango de objetos de caja de comunidad son editables y no se leen
- **Severidad**: Baja · **Archivo**: `backend/routes/admin/index.js:1081, 1088-1089`
  (lista blanca), contra `backend/services/deals/index.js:62-63` (`CHANCE_MIN/MAX`
  en el código), `:116` (`RETORNO_OBJETIVO` en el código), `:190`
  (usa `cfg.cajasALaVez`, **no** `cfg.deals.ruedasALaVez`),
  `backend/services/community/index.js:109` (`eco.OBJETOS_COMUNIDAD`)
- **Confianza**: Alta

`deals.chanceMinima`, `deals.chanceMaxima`, `deals.margen`,
`deals.ruedasALaVez` y `deals.tiradasGratisPorItem` se guardan y se muestran en
el panel; ninguna se lee. `objetosPorCajaDeComunidad.min/max` idem. Son
perillas que mienten: el equipo cree haber cambiado algo y no cambió.
`tiradasGratisPorItem` directamente no tiene implementación (ver ABUSO-08).

**Arreglo.** Leerlas, o sacarlas de la lista blanca y del panel. Lo segundo es
menos trabajo y más honesto hasta que haga falta.

### REGLA-04 — El rango VIP puesto a mano no cuenta para el rakeback
- **Severidad**: Media · **Archivo**: `backend/services/vip/index.js:223` y `:282`
- **Confianza**: Alta (verificado leyendo el `.select()` de las dos funciones)

```js
const usuario = await User.findById(userId).select("jugadoSc").lean();   // :223 y :282
...
const rango = rangoDe(usuario.jugadoSc, usuario.rangoManual);            // :226 y :285
```

`rangoManual` no está en el `select`, así que llega siempre `undefined` y
`rangoDe` ignora el traslado de rango. En cambio `GET /api/vip/`
(`routes/vip/index.js:29`) y el panel (`routes/admin/extra.js:389, 394`) **sí**
lo pasan bien, porque ahí el documento viene completo.

**Impacto concreto.** A un jugador al que se le otorgó "Diamond" por traslado
desde otro sitio, la pantalla del Club VIP le dice Diamond con 0,28% de
rakeback semanal, y `POST /api/vip/rakeback/weekly` le responde `RANK_TOO_LOW`
o le paga el 0% de Bronze. Es el beneficio principal del traslado de rango y
no funciona. Y el panel Admin → VIP ranks lo cuenta en Diamond, así que los
números de rakeback por rango del panel tampoco cierran con lo pagado.

**Arreglo.** `.select("jugadoSc rangoManual")` en las dos funciones.

**Cómo verificar.** Poner `rangoManual: "Diamond"` a una cuenta con
`jugadoSc: 0` y pedir `GET /api/vip/rakeback`: hoy devuelve `pct: 0`.

---

## 5. ANEXO — Tabla completa de palabras prohibidas (inglés), clave por clave

Generada parseando los nueve locales. "Idiomas" = en cuáles de los nueve
archivos aparece **la palabra inglesa** (que en `admin.*` son los nueve porque
el panel no se traduce).

| Clave | Palabra(s) | Idiomas | Público | Texto en inglés |
|---|---|---|---|---|
| `action.deposit` | deposit | en | **JUGADOR** | "Deposit" |
| `affil.mCpaText` | deposit | en | **JUGADOR** | "A fixed payout for every player who deposits, plays and verifies…" |
| `affil.qualifies` | deposit | en | **JUGADOR** | "A player qualifies with SC {dep} deposited…" |
| `affil.waitingSub` | deposit | en | **JUGADOR** | "{n} of your referrals deposited already…" |
| `box.bestOdds` | odds | en | **JUGADOR** | "Best odds" |
| `boxes.sortReturn` | odds | en | **JUGADOR** | "Best odds" |
| `create.priceNote` | odds | en | **JUGADOR** | "Worked out from the items and their odds. You do not set it." |
| `create.step3` | odds | en | **JUGADOR** | "Set the odds" |
| `faq.fair.a` | odds | en | **JUGADOR** | "Every box lists all of its prizes and their exact odds up front…" |
| `faq.howOpen.a` | odds | en | **JUGADOR** | "Choose any box, check the prizes and odds, then press Open…" |
| `faq.missing.a` | deposit | en | **JUGADOR** | "…Deposits need a few network confirmations…" |
| `faq.missing.q` | deposit | en | **JUGADOR** | "My deposit has not arrived" |
| `profile.transactionsSub` | deposit | en | **JUGADOR** | "Your deposits, withdrawals and affiliate payouts" |
| `profile.wagered` | wager | en | **JUGADOR** | "Wagered" |
| `races.wagered` | wager | en | **JUGADOR** | "WAGERED" |
| `races.wageredShort` | wager | en | **JUGADOR** | "Wagered" |
| `races.yourWager` | wager | en | **JUGADOR** | "Your wager" |
| `redeem.sub` | deposit | en | **JUGADOR** | "Balance, free boxes or a boost on your next deposit." |
| `redeem.wonBonus` | deposit | en | **JUGADOR** | "Bonus on your next deposit." |
| `refer.sub` | deposit, wager | en | **JUGADOR** | "Your friends get a 5% deposit bonus, and you earn commission on every wager they place." |
| `refer.wagerVolume` | wager | en | **JUGADOR** | "Wager volume" |
| `rows.generous` | odds | en | **JUGADOR** | "Best Odds" |
| `wallet.connectNone` | deposit | en | **JUGADOR** | "…or use a deposit address below." |
| `wallet.depositNote` | deposit | en | **JUGADOR** | "Deposits are credited on their own once the network confirms them…" |
| `wallet.depositSoon` | deposit | en | **JUGADOR** | "Deposits are not switched on yet." |
| `wallet.notConnected` | deposit | en | **JUGADOR** | "…so there is no deposit address to show…" |
| `wallet.qrAlt` | deposit | en | **JUGADOR** | "QR code of your deposit address" |
| `wallet.useAddress` | deposit | en | **JUGADOR** | "Use a deposit address" |
| `wallet.walletNote` | deposit | en | **JUGADOR** | "…It goes straight to your MrBox deposit address." |
| `admin.afi.cpaRulesHelp` | deposit | los 9 | ADMIN | "…a deposit that leaves without being played." |
| `admin.afi.deposited` | deposit | los 9 | ADMIN | "Deposited" |
| `admin.afi.needsDeposit` | deposit | los 9 | ADMIN | "Deposited at least (SC)" |
| `admin.afi.st_deposito` | deposit | los 9 | ADMIN | "Deposited" |
| `admin.player.giftsHelp` | wager | los 9 | ADMIN | "…they still count for wagering, races and the margin." |
| `admin.set.bonusBig` | deposit | los 9 | ADMIN | "Deposit bonus · big partners" |
| `admin.set.bonusNormal` | deposit | los 9 | ADMIN | "Deposit bonus" |

Fuera de los locales, en código de cara al usuario: **`MbCabecera.vue:95`**
(`aria-label="Deposit"`, COPY-03). Todo lo demás que aparece con `grep` en
`frontend/src` son nombres de clave (`$t('action.deposit')`), rutas de la API
(`/wallet/deposit`), nombres de clase CSS (`.mb-odds`) y comentarios en
español: **interno, no se reporta**.

---

## 6. LO QUE ESTÁ BIEN RESUELTO

Vale la pena decirlo explícitamente, porque es mucho y es poco común:

1. **La billetera.** Todo movimiento pasa por `services/wallet/mover()`, con la
   condición de saldo **adentro del filtro** de Mongo y el libro escrito en la
   misma operación. El patrón "leer, decidir en JS, escribir" —de donde salen
   los dobles gastos— está evitado a conciencia en casi todo el código.
2. **Lo canjeable con `$expr` (`wallet/index.js:118-127`).** El bono sin jugar
   se descuenta con la condición evaluada por la base en el mismo momento del
   descuento. Es la forma correcta y la poco común.
3. **El orden de `boxes.abrir`**: cobrar antes de sortear, y el nonce reservado
   con `$inc` atómico antes del sorteo. El razonamiento del comentario de
   cabecera es correcto.
4. **El redondeo siempre a favor de la casa.** `precioDe` usa `Math.ceil`
   (`economia.js:92`) y `apuestaDe` también (`deals/index.js:117`), y Deals
   suma un piso de apuesta de SC 0,50 (`:81`) y un valor mínimo de objeto
   derivado de él (`:91`). **Esto cierra el exploit de redondeo**: sin el piso,
   una apuesta "real" de SC 0,0149 redondearía a SC 0,01 con valor esperado
   SC 0,0137, o sea **+37% de ventaja para el jugador**, repetible. Está bien
   visto y bien resuelto.
5. **El precio de la caja de la comunidad no lo elige el creador**, y los
   valores salen del catálogo y no del pedido (`community/index.js:131-152`).
   El retorno real de una caja de comunidad **nunca puede pasar de 92%** por
   construcción (`precio = ceil(EV/0,92)`). Verificado sobre las 163 cajas del
   catálogo sembrado: retorno real entre 92,0000% y 92,0001%.
6. **No se paga al creador por abrir su propia caja** (`boxes/index.js:275`), y
   el margen del creador y el del socio se **acumulan con el negativo incluido**
   y solo se reparten en verde (`community/index.js:329-350`,
   `affiliates/index.js:325-345`). Es la defensa correcta contra el premio
   gordo que deja a la casa en rojo.
7. **El CPA de afiliados está bien defendido**: depósito ≥ SC 20, jugado ≥
   SC 200, **KYC nivel 2** (documento revisado por una persona), 14 días de
   espera, tope diario por campaña contado *después* de marcar, y tres señales
   de riesgo que frenan el pago automático. Farmear el CPA exige un documento
   de identidad real por cabeza: es el control más fuerte del sistema.
8. **El rakeback no se puede farmear**: Bronze paga 0% y hay que jugar SC 25.000
   para llegar a Silver; la suma de los tres periodos nunca pasa de 1,2% contra
   un margen de 8%, y está probado.
9. **Doble canje, doble cobro y doble pago**: todos cerrados con índices únicos
   o con la condición de estado adentro del filtro — `PromoUse (code,user)`,
   `RakebackClaim (user,periodo,desde)`, `ChallengeWin`, `DepositoAvisado.trackId`,
   `Race.estado: "live"`, `Redemption.estado`, `InventoryItem.state: "held"`.
10. **No hay caminos de transferencia directa**: sin chat, sin rain, sin tips,
    sin regalo ni intercambio de objetos. Verificado leyendo las rutas de
    inventario: solo vender, enviar a una dirección propia y cancelar.
11. **El envío** valida con el documento completo del usuario (no con el `lean()`
    de la sesión), con la traba y el nivel por separado y con el mensaje correcto.
12. **`trust proxy = 1`** (`index.js:35`) está bien puesto para un solo proxy:
    ni cuenta a todo el mundo junto ni deja falsear `X-Forwarded-For`.
13. **Los nueve locales tienen exactamente las mismas 1.639 claves**, sin
    faltantes ni sobrantes, y no queda ni un "BetSweeps" dentro de MR BOX.

---

## 7. ORDEN SUGERIDO DE TRABAJO

**Antes de abrir la caja (bloqueantes de pasarela):**
1. COPY-01 — las cinco páginas legales.
2. JRG-02 — edad en el registro + geobloqueo.
3. COPY-04 — AMOE real.
4. COPY-02 / COPY-03 — barrer "deposit", "wager", "odds", `казино`, `投注`,
   `赔率`, `Quoten`, `aposta`, `mise` del copy de jugador en los nueve idiomas.

**Antes de que entre plata de verdad (bloqueantes de economía):**
5. ABUSO-01 — piso de participación y de volumen en las carreras. Es el agujero
   más caro y el más fácil de explotar.
6. ABUSO-02 — auto-referido + `vecesAJugarElBono`.
7. JRG-01 — que la pausa frene promos, rakeback y acreditación de compras.
8. ABUSO-03 — verificación de correo antes del regalo.

**Después:**
9. ABUSO-04, ABUSO-05, ABUSO-06, ABUSO-07, REGLA-01, REGLA-04.
10. ABUSO-08, ABUSO-09, ABUSO-10, REGLA-02, REGLA-03, JRG-03, COPY-05.
