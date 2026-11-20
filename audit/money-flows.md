# MR BOX — los flujos de dinero

Cada camino por el que se mueve un SC, y dónde se valida cada regla.

Convención: **(A)** = paso atómico (una sola operación condicional contra la
base, sin ventana entre leer y escribir). **(L)** = deja fila en el libro mayor
(`BalanceTransaction`).

## El libro mayor

Todo pasa por `wallet.mover()` (`backend/services/wallet/index.js:76`). La
operación es un `findOneAndUpdate` con el chequeo de saldo **adentro del
filtro**, no antes:

```js
if (monto < 0) filtro.balanceSc = { $gte: -monto };
```

Con `new: false` para quedarse con el `balanceBefore` exacto, y dentro de una
transacción de Mongo cuando el despliegue las soporta. Eso es lo que hace que
dos pedidos simultáneos no puedan dejar el saldo en negativo: el segundo no
encuentra documento que cumpla el filtro y falla.

La variante `soloCanjeable: true` agrega al filtro un `$expr` que resta el bono
todavía no jugado, para que ese bono no se pueda sacar.

```mermaid
flowchart LR
    P[pedido] --> F{"findOneAndUpdate<br/>balanceSc >= monto<br/>(y canjeable si aplica)"}
    F -- no cumple --> E[INSUFFICIENT_BALANCE<br/>no se tocó nada]
    F -- cumple --> I["$inc balanceSc"]
    I --> T[BalanceTransaction<br/>antes / después / motivo]
```

## 1. Depósito en cripto

```mermaid
sequenceDiagram
    participant J as Jugador
    participant API as MR BOX
    participant OX as OxaPay
    J->>API: GET /wallet/deposit (moneda, red)
    API->>OX: crear factura (MERCHANT_KEY)
    OX-->>API: dirección + trackId
    API-->>J: dirección y QR
    J->>OX: manda la cripto
    OX->>API: POST /api/hooks (firmado)
    API->>API: (A) DepositoAvisado.create(trackId único)
    Note over API: si el trackId ya existe → 11000 → repetido, no acredita
    API->>API: (L) wallet.mover(+SC)
    API->>API: bono de bienvenida y de socio, si corresponde
    API->>API: DepositoAvisado.acreditado = true
```

**Dónde se valida qué**

| Regla | Dónde |
|---|---|
| El aviso viene de OxaPay | firma del callback, `routes/wallet/index.js` |
| No acreditar dos veces | `DepositoAvisado.trackId` único, creado **antes** de mover |
| Bono de bienvenida una sola vez | `affiliates.bonoDeCompra` |
| El bono queda con rollover | `User.bonoPendienteSc` + `Settings.vecesAJugarElBono` |

## 2. Abrir una caja

El camino más caliente del sitio. `backend/services/boxes/index.js:84`.

```mermaid
flowchart TD
    A[POST /boxes/:slug/open] --> B{caja.live?}
    B -- no --> X1[BOX_NOT_LIVE]
    B -- sí --> C{"veces <= Settings.cajasALaVez"}
    C -- no --> X2[TOO_MANY_AT_ONCE]
    C -- sí --> D["controles.revisarAntesDeJugar<br/>(autoexclusión, pausa, límites)<br/>por la tanda entera"]
    D --> E["semillaDe(user) — server seed + nonce"]
    E --> F{"¿le queda apertura gratis?"}
    F -- sí --> G["(A) gastarAperturaGratis<br/>filtro freeOpens > 0"]
    F -- no --> H["(A)(L) wallet.mover(-precio)"]
    G --> I["fair.sortear(semilla, nonce, premios)"]
    H --> I
    I --> J["InventoryItem + BoxOpen (recibo con hmac)"]
    J --> K["margen = precio - valor del premio<br/>(puede ser negativo)"]
    K --> L["afiliados.anotarComision — try aparte"]
    K --> M["comunidad.pagarAlCreador — try aparte<br/>solo si creator y no es el mismo jugador"]
    J --> N["retos.revisar — desafíos, try aparte"]
    N --> O["$inc Box.opens"]
```

Detalles que importan:

- El cobro y el sorteo son **por apertura**, en un bucle. Una tanda de 4 cobra
  cuatro veces; si la segunda falla, las dos primeras ya ocurrieron. Es
  deliberado: cada apertura es su propio recibo verificable.
- La apertura gratis se gasta con `$gt: 0` en el filtro, así que dos pedidos
  simultáneos no pueden gastar la misma.
- Las comisiones van en `try` propios: que falle pagarle a un socio no puede
  tumbar la apertura de alguien que ya pagó. El costo es que una comisión puede
  perderse en silencio — queda en el registro de errores.
- **No se le paga al creador por abrir su propia caja** (`boxes/index.js:272`),
  que si no sería una forma lenta y segura de sacarle plata a la casa.

## 3. Vender un objeto

```mermaid
flowchart LR
    A["POST /inventory/:id/sell<br/>o /sell-many"] --> B{"(A) InventoryItem<br/>_id + user + state: held<br/>→ state: sold"}
    B -- no cumple --> X[ya vendido, enviado o no es suyo]
    B -- cumple --> C["precio = valueSc × Settings.tasaDeRecompra<br/>lo pone el SERVIDOR"]
    C --> D["(L) wallet.mover(+precio)"]
```

El precio de recompra **nunca** viene del cliente: sale de `Item.valueSc` por la
tasa de `Settings`. El cambio de estado va en el filtro, que es lo que impide
vender dos veces el mismo objeto.

## 4. Pedir el envío de un objeto

```mermaid
flowchart TD
    A[POST /inventory/ship] --> B{"verificationLevel >= Settings.envioNivelMinimo"}
    B -- no --> X1[hay que verificarse]
    B -- sí --> C{"User.puedeEnviar(valor, nivel, tope)"}
    C -- no --> X2[supera el tope del nivel]
    C -- sí --> D["(A) items held + suyos → state: shipping"]
    D --> E[Order pending con la dirección]
    E --> F[el panel despacha y carga seguimiento]
```

Acá **no se mueve saldo**: el objeto sale del inventario y entra en una orden.
El riesgo no es contable sino de inventario (ver el informe: vender y enviar).

## 5. Canje / retiro

```mermaid
sequenceDiagram
    participant J as Jugador
    participant API as MR BOX
    participant AD as Admin
    participant OX as OxaPay
    J->>API: POST /wallet/withdraw
    API->>API: antesDeCanjear: KYC >= Settings.canjeNivelMinimo<br/>monto >= Settings.canjeMinimoSc (50)<br/>sin redemptionLock
    API->>API: (A)(L) wallet.mover(-monto, soloCanjeable: true)
    API->>API: Redemption estado "pending"
    Note over API: el bono sin jugar no entra, lo decide la base en el filtro
    AD->>API: POST /admin/redemptions/:id/approve
    API->>OX: payout (PAYOUT_KEY, referencia = id)
    OX-->>API: pagado
    API->>API: Redemption estado "paid"
    J->>API: POST /wallet/withdrawals/:id/cancel
    API->>API: (L) wallet.mover(+monto) y estado "cancelled"
```

| Regla | Dónde se valida |
|---|---|
| Mínimo 50 SC | `cashier.antesDeCanjear`, `Settings.canjeMinimoSc` |
| Nivel de KYC | `cashier.nivelQuePide(cfg)`, `Settings.canjeNivelMinimo` |
| Aprobación humana | el canje nace en `pending`; nadie paga sin `resolver()` |
| El bono no se puede sacar | `wallet.mover({ soloCanjeable: true })` con `$expr` |
| Cuenta trabada | `User.redemptionLock` |

## 6. La parte del creador (cajas de la comunidad)

Esta es la que tenía el agujero grave, y la que más vale entender.

```mermaid
flowchart TD
    A["apertura cerrada<br/>margen = precio - premio"] --> B["(A) $inc Box.margenPendienteSc += margen"]
    B --> C{"acumulado > 0 ?"}
    C -- no --> D["no se paga nada<br/>la deuda queda guardada"]
    C -- sí --> E["(A) $inc -acumulado<br/>filtro: margenPendienteSc >= acumulado"]
    E -- otro se lo llevó --> D
    E -- lo tomó --> F["parte = acumulado × Settings.parteDelCreador"]
    F --> G["(L) wallet.mover(+parte) al creador"]
```

**La comisión es sobre el margen de la casa, no sobre el precio de la caja.**
Medido en vivo sobre la caja `prueba-comision`: precio SC 3,87, retorno 91,99 %,
margen por apertura SC 0,32, el creador cobró SC 0,16 — la mitad del margen —
y SC 0 en la apertura donde el premio superó al precio.

El acumulador `margenPendienteSc` es lo que arrastra las pérdidas: una apertura
que le costó plata a la casa se descuenta de las ganancias siguientes antes de
volver a pagar. Sin eso, una caja de varianza alta pagaba comisión en las
aperturas buenas y nada en las malas, y la casa terminaba en negativo.

## 7. La comisión del socio (afiliados)

Mismo patrón, en `affiliates.anotarComision`:

```mermaid
flowchart TD
    A[apertura de un referido] --> B{"modelo del código"}
    B -- cpa --> C["no reparte por jugada<br/>paga por cabeza al calificar"]
    B -- revshare / híbrido --> D["(A) $inc AffiliateCode.margenPendienteSc += margen"]
    D --> E{"acumulado > 0 ?"}
    E -- no --> F[se guarda la deuda]
    E -- sí --> G["(A) consume el acumulado"]
    G --> H["porJugada(modelo, rango, jugado, margen)"]
    H --> I["(L) wallet.mover(+comisión) al socio"]
```

El CPA va por otro lado: `mirarCalificacion` marca la conversión, `senalesDe`
le pone banderas de riesgo, y `liberarCalificados` (el reloj de cada hora) paga
**solo las que no tienen señales**. Las que las tienen esperan a una persona.

## 8. Rakeback VIP

```mermaid
flowchart LR
    A["POST /vip/rakeback/:periodo"] --> B["(A) RakebackClaim.create<br/>índice único (user, periodo, desde)"]
    B -- 11000 --> X[ya cobrado ese período]
    B -- ok --> C["(L) wallet.mover(+monto)"]
```

La fila se crea **antes** de mover la plata: es el mismo patrón de idempotencia
que el depósito y el código promocional.

## 9. Código promocional

```mermaid
flowchart LR
    A[POST /wallet/promo] --> B["(A) PromoUse.create<br/>índice único (code, user)"]
    B -- 11000 --> X[ya lo usaste]
    B -- ok --> C{"usos < usosMaximos<br/>y jugadoSc >= mínimo"}
    C -- no --> X2[rechazo]
    C -- sí --> D["(L) wallet.mover(+monto) y/o aperturas gratis"]
```

## 10. Carreras

```mermaid
flowchart TD
    A["reloj de cada hora<br/>carreras.ponerAlDia()"] --> B{"hay carreras vencidas?"}
    B -- sí --> C["calcula el ranking por volumen jugado"]
    C --> D["(A) Race estado live → settled"]
    D --> E["(L) wallet.mover(+premio) a cada ganador"]
    F[admin: POST /races/:id/settle] --> D
    G[admin: POST /races/:id/pay/:userId] --> E
```

Es el único camino que mueve plata sin pedido HTTP de por medio, junto con
`liberarCalificados`.

## Dónde entra plata y dónde sale

| Entra | Sale |
|---|---|
| Depósito en cripto (OxaPay) | Canje aprobado (payout de OxaPay) |
| Bono de bienvenida | Envío de un objeto físico (sale valor, no SC) |
| Código promocional | |
| Premio de caja (del pozo de la casa al jugador) | Apertura de caja (del jugador a la casa) |
| Venta de un objeto | |
| Rakeback, premio de carrera, desafío | |
| Comisión de socio, parte del creador | |
| Ajuste del panel | Ajuste del panel |

Los dos únicos caminos por los que sale valor **fuera** del sistema son el canje
aprobado y el envío físico. Los dos exigen KYC y los dos pasan por una persona.
