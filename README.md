# MR BOX

Cajas misteriosas con objetos de verdad. Hermano de BetSweeps, pero
**una sola moneda** y sin casino: acá solo hay cajas, Deals e inventario.

La especificación completa, sacada de los dos diseños, está en
[docs/ESPECIFICACION.md](docs/ESPECIFICACION.md).

## La idea en tres líneas

1. El jugador compra **SC** con cripto. 1 SC = 1 dólar.
2. Abre cajas. Cada caja tiene objetos de verdad con un valor en SC y una
   chance, y el sorteo es verificable.
3. Lo que gana lo **vende** por SC o se lo **manda a su casa**.

## Lo que ya está

```
backend/
  utils/money.js                 toda la plata pasa por acá
  services/boxes/economia.js     el precio sale de los objetos, no al revés
  services/boxes/fair.js         el sorteo verificable
  database/models/               Item, Box, User, BoxOpen,
                                 InventoryItem, BalanceTransaction, UserSeed
  tests/                         24 pruebas, incluida una de 200.000 aperturas
```

```bash
cd backend && npm test
```

## Las dos reglas que no se rompen

**El precio de una caja no se escribe a mano.** Sale de los objetos que
tiene adentro y del retorno objetivo (92%):

```
precio = suma(valor_del_objeto × su_chance) / 0,92
```

Una caja preciada a ojo puede pagar más de lo que cobra y no avisa hasta
que el mes cierra en rojo. Calculándolo, ese error es imposible.

**El saldo no se toca sin escribir un movimiento.** Cada peso que entra o
sale deja una fila con el saldo antes y después, así el saldo siempre se
puede reconstruir en vez de tener que creerlo.

## Tecnología

La misma que BetSweeps, a propósito: Node + Express + Mongoose, Vue 2 +
Vuex. Así el motor de cajas, el sorteo verificable, la verificación en
tres niveles, los afiliados y las carreras se portan en vez de
reescribirse.
