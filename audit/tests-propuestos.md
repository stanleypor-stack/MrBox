# Las pruebas automáticas que faltan

Hoy hay **209 pruebas** en `backend/tests/` y pasan todas. Cubren bien la
economía, el sorteo, los modelos y buena parte del panel. Lo que sigue es lo que
**no** cubren, ordenado por lo que más duele si se rompe.

La regla para cada una: **tiene que fallar antes del arreglo y pasar después.**
Una prueba de regresión que nunca vio el bug rojo no prueba nada.

## 1. Dinero — carreras (lo primero)

Es donde están los agujeros confirmados y donde una regresión cuesta plata.

| Prueba | Qué fija | Hallazgo |
|---|---|---|
| Abrir las N cajas de regalo **en paralelo** desde saldo 0 y exigir saldo final 0 | Que la apertura gratis no cree SC | DINERO-01 |
| Mismo caso, exigir que `jugadoSc` haya crecido igual | Que el arreglo no rompa el conteo del Club VIP, que es para lo que se hizo el cambio | DINERO-01 |
| Vender y pedir el envío del mismo objeto en paralelo, N rondas, exigir que nunca las dos salgan bien | Mercadería cobrada y despachada a la vez | DINERO-02 |
| Pagar el mismo premio de carrera 20 veces en paralelo, exigir 1 asiento | El único pago sin condición en el filtro | DINERO-03 |
| Con límite diario de SC 10, 20 aperturas en paralelo, exigir que lo jugado no lo pase | El límite que se pone el jugador | DINERO-05 |
| 20 canjes simultáneos con tope de 3 pendientes, exigir 3 | El freno antifraude | DINERO-08 |
| `veces: 2.5` en Deals: exigir que lo cobrado sea igual a lo informado, y que `Box.opens` quede entero | Cobro de más | DINERO-07, DINERO-10 |
| Canjear un código de "1 apertura", exigir exactamente 1 | El promo que entrega 3 | DINERO-06 |

**Prueba paraguas**, la más valiosa de todas: una que recorra **todas** las
operaciones que mueven saldo, las dispare 30 veces en paralelo cada una y
verifique dos invariantes — el saldo nunca queda negativo, y la suma de los
asientos del libro es igual a `balanceSc`. Eso ataja la familia entera de bugs
en vez de uno por uno.

## 2. La conversión de moneda

Hoy no hay nada que lo cubra, y es la Crítica más cara.

- Para cada moneda del catálogo: armar un canje de SC 50 y verificar que lo que
  sale hacia la pasarela equivale a **USD 50** según la cotización guardada,
  con tolerancia.
- Un depósito de 1.000 unidades de una moneda que no vale un dólar **no** puede
  acreditar SC 1.000.
- El `retiroMinimo` y la `comision` del catálogo tienen que participar de la
  validación, no solo de la pantalla.
- Un aviso con un monto absurdo (1e21) tiene que rebotar, no acreditarse.

## 3. El aviso de pago

- El mismo cuerpo firmado **con sangría** tiene que ser aceptado igual que el
  compacto (es `pocs/hook-cuerpo-crudo.js` convertido en prueba).
- Un aviso con firma inválida → 401 y saldo sin tocar. *(Ya está cubierto.)*
- El mismo `track_id` dos veces → una sola acreditación. *(Ya está cubierto.)*
- **Falta**: si `wallet.mover` tira después de crear la marca, el reintento
  **tiene** que acreditar, no contestar `repetido`.

## 4. Autorización

Lo del panel ya se probó a mano dos veces, pero no hay nada automático. La
prueba que vale es **generativa**, no una lista escrita a mano que se
desactualiza:

- Recorrer el router de `/api/admin` **sacando las rutas del propio router** y,
  para cada una, exigir 401 sin token y 403 con token de jugador. Así una ruta
  nueva queda cubierta el día que se escribe, sin que nadie se acuerde de
  agregarla.
- Lo mismo para las rutas con `:id`: que el usuario A no pueda leer ni modificar
  el recurso de B. Hoy están bien las 18, pero nada lo garantiza mañana.

## 5. Juego responsable

- Con la cuenta en pausa, **cada** endpoint que gasta o acredita tiene que
  rebotar: abrir caja, deals, promo, código, rakeback y la acreditación del
  aviso de pago. Hoy solo rebotan los dos primeros.
- Sin fecha de nacimiento, o con menos de 18, el registro no puede completarse.
- Desde un estado restringido, el registro y el canje tienen que rebotar.

## 6. Inventario y catálogo

- Un objeto con `shippable: false` en el catálogo **no** puede entrar al flujo de
  envío (FAIR-01). Y una prueba de que el flag se copia al crear la fila.
- Las chances de toda caja al aire suman 100 % y su retorno no pasa de 100 %
  (es `pocs/analisis-cajas.js` como prueba, corriendo sobre las cajas sembradas).
- Editar una caja al aire la baja del aire y **deja las chances anteriores en el
  `AdminLog`** (FAIR-02).

## 7. Rendimiento

- Una prueba que corra `explain()` sobre las consultas de las listas públicas y
  **falle si alguna usa la etapa `SORT`** en vez de un índice. Eso ataja QA-01 y
  cualquier otro que aparezca al agregar una pantalla.

## 8. Lo que no vale la pena automatizar

- Las palabras prohibidas del copy: mejor un script de revisión que corra en el
  mismo paso que `traducir.py` y avise, no una prueba que rompa el build.
- El recorrido visual: no hay Playwright en el proyecto y montarlo para esto
  cuesta más de lo que devuelve. El `explain` y las pruebas de concurrencia
  cubren lo que de verdad hace daño.

## Dónde ponerlas

Siguiendo lo que ya hay: `backend/tests/concurrencia.test.js` para la familia de
carreras, y sumar a `economia.test.js`, `wallet.test.js` y `panel.test.js` lo que
corresponda a cada uno. El arnés de `tests/` ya levanta una base descartable, así
que no hace falta infraestructura nueva.
