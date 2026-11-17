# MR BOX — qué funciona y qué falta

Al 17 de noviembre de 2026. Comparado contra los dos canvas de diseño.

---

## Lo que funciona, comprobado en el navegador

El circuito completo, probado de punta a punta en vivo:

**registro → abrir una caja → ganar un objeto → venderlo → el saldo sube → el movimiento aparece en el perfil**

| | Estado |
|---|---|
| Registro y entrada, con captcha | ✅ |
| Código de afiliado al registrarse | ✅ |
| Bono de 5% / 10% en la compra | ✅ |
| Catálogo con buscador, filtros y orden | ✅ |
| Abrir una caja (x1 a x4) | ✅ |
| Aperturas de regalo (3 al registrarse) | ✅ |
| Demo sin cuenta | ✅ |
| Inventario y venta | ✅ |
| Sorteo verificable + rotar semilla | ✅ |
| Extracto de movimientos | ✅ |
| Lo jugado (*amount wagered*) | ✅ |
| Panel de afiliado y cobro | ✅ |
| 9 idiomas | ✅ |

**94 pruebas automáticas**, de las cuales 40 atacan el servidor por HTTP
como lo haría el navegador.

---

## Los huecos, por orden de importancia

### 1. No se puede meter plata — *lo que bloquea todo*

**Falta**: OxaPay. Hoy el saldo solo se mueve a mano o ganando.

Sin esto, el sitio no puede facturar un peso. Es lo primero.

Necesito de vos: las dos claves (merchant y payout) en las variables del
servidor. La URL de callback ya la pusiste bien: `https://mrbox.gg/api/payments/oxapay/callback`.

### 2. No se puede sacar plata

**Falta**: la pantalla de canje y la cola de aprobación en el panel.

El modelo ya está: `canjeableSc` descuenta el bono sin jugar, y la regla
de verificación nivel 2 está escrita y probada. Falta la pantalla y el
pago por OxaPay.

### 3. El panel de administración no existe

Es el que más pantallas tiene: **33 en tu diseño**. Hoy hay cero.

Lo que ya tiene datos listos para mostrar: Players, Movements, Item
catalogue, Boxes, Affiliates. Lo que necesita trabajo de fondo: Orders &
shipping, Verification, Redemptions, Risk.

Sin panel, cargar el catálogo se hace con un script (`scripts/sembrar.js`).

### 4. Los envíos

**Falta**: pedir el envío, la dirección, los estados (*to ship / in
transit / delivered*) y la pantalla de Orders del panel.

Lo que sí está: el inventario ya dice por cada objeto si se puede enviar
y, si no, **por qué** (necesita nivel 2, necesita nivel 3, o no es
enviable).

### 5. La verificación en tres niveles

**Falta**: subir el documento y la cola de revisión.

Lo que sí está: los tres niveles en el modelo, y las reglas aplicadas —
canjear pide nivel 2, enviar pide 2, enviar algo de más de SC 1.000 pide 3.

### 6. Pantallas del jugador que faltan enteras

| Pantalla | Qué necesita |
|---|---|
| **Deals** (el upgrader) | las cuentas (están definidas en la spec), la rueda, el backend |
| **Community boxes** | listado y aprobación |
| **Create a box** | el armador, con el precio saliendo de los objetos |
| **Creator dashboard** | ganancias del creador (50% del margen) |
| **Races** (diaria/semanal/mensual) | puntaje, premios, tablas |
| **Challenges** | apuntan a una caja |
| **VIP Club** | los 9 rangos, rakeback, caja al subir |
| **Rewards** | cobro del rakeback |
| **Promotions** | las tarjetas |
| **Home** | banners, filas (*Popular, Featured, Luxury, Under SC 5*), marcas |
| **Soporte** | el chat con la respuesta automática |

### 7. Cosas chicas del perfil

Cambiar contraseña, cambiar avatar, cerrar la cuenta, autoexclusión.

---

## Huecos que encontré y ya cubrí

| Hueco | Qué hice |
|---|---|
| El captcha real bloqueaba el desarrollo | En local van las claves de prueba de Cloudflare; las reales irán en las variables del servidor |
| El contador de aperturas de regalo decía *"Probar gratis"* | Texto propio: la demo no da nada y el regalo sí |
| El margen traía basura decimal (`7.9999…` en vez de `8`) | Se redondea antes de llegar a la comisión del afiliado |
| `isNew` pisaba un nombre reservado de Mongoose | Renombrado a `markedNew` |
| El límite de intentos no se podía ajustar | `AUTH_RATE_LIMIT`: hace falta de verdad detrás de un NAT grande |
| El catálogo arrastraba todos los premios en la grilla | Solo el conteo y el mejor premio |
| Un botón de envío apagado sin explicación | El servidor manda el motivo y la pantalla lo muestra |
| El buscador pedía en cada tecla | 350 ms de espera y descarte de respuestas viejas |

---

## Lo que necesito de vos

1. **OxaPay**: las dos claves, cuando quieras que lo enganche.
2. **¿OxaPay tiene sandbox en tu cuenta?** Para probar sin mover plata.
3. **Dos ajustes en OxaPay que vi en tus capturas** (están explicados en
   el mensaje): *Convertir automáticamente a USDT* conviene **encendido**,
   y ojo con *Retiro automático* encendido, que deja el saldo sin fondos
   para pagar los canjes.
4. **Fotos**: hoy no hay ninguna imagen de objeto ni de caja. Las tarjetas
   se dibujan con un resplandor del color de la rareza, que queda bien,
   pero con fotos queda como mrloot.
