# -*- coding: utf-8 -*-
"""
SACA EL CATALOGO DEL PROTOTIPO Y LE ARREGLA LA ECONOMIA.

    python scripts/extraerCatalogoDelDiseno.py <Landing.dc.html> <datos.json>

QUE SE TOMA DEL DISENO, TAL CUAL
  - los 1712 objetos: nombre, cuanto valen y su rareza
  - las 163 cajas: nombre, categorias, precio, riesgo, destacada, nueva
  - QUE OBJETOS LLEVA CADA CAJA (la curaduria, que es el trabajo de verdad)
  - la posicion de cada cosa en las laminas de arte

QUE HAY QUE RECALCULAR, Y POR QUE
  Las chances del prototipo son de adorno. Medido sobre las 163 cajas:
  el retorno mediano da 770% y el maximo 34.665%. Solo 37 cajas quedan
  en un rango creible. Sembrar eso seria un sitio donde cada caja paga
  casi ocho veces lo que cobra.

  Asi que se conserva lo que el diseno decide --que objetos y a que
  precio-- y se resuelve lo unico que estaba de relleno: con que
  frecuencia sale cada cosa.

COMO SE RESUELVEN LAS CHANCES
  La chance de cada objeto se hace proporcional a 1/valor^k, y se busca
  el k que hace que la caja pague exactamente precio x retorno.

  Esa familia se elige porque conserva la FORMA que uno espera de una
  caja: lo caro sale poco y lo barato sale seguido, siempre en ese
  orden. Subir k empuja la plata hacia lo barato y baja el retorno;
  bajarlo hace lo contrario. Como el retorno baja de forma continua con
  k, una busqueda binaria encuentra el punto exacto.

  Veintinueve cajas no se pueden resolver asi: hasta su objeto mas
  barato vale mas que el precio entero. A esas se les agrega un credito
  --la misma idea del "Bonus Coupon" del diseno-- del tamano que haga
  falta.
"""
import io, json, os, re, sys

RETORNO_OBJETIVO = 0.92

# Creditos de a pasos redondos, para no inventar un objeto por caja.
CREDITOS = [0.10, 0.25, 0.50, 1, 2, 5, 10, 25, 50, 100, 250, 500, 1000]

RAREZAS = {"l": "gold", "e": "red", "r": "pink", "u": "purple", "c": "blue"}


def pagoPromedio(valores, chances):
    return sum(v * c for v, c in zip(valores, chances))


def chancesCon(valores, k):
    """Chances proporcionales a 1/valor^k, normalizadas."""
    pesos = [v ** (-k) for v in valores]
    total = sum(pesos)
    return [w / total for w in pesos]


# El piso de chance: una entre diez millones.
#
# Hace falta porque la familia 1/valor^k le da a los premios mas caros
# chances absurdamente chicas. En la caja "Black Card" el G63 de
# SC 284.000 quedaba en 1e-11, que al redondear da CERO: la caja
# anunciaria un premio que no puede salir nunca. Eso no es una caja
# agresiva, es publicidad enganosa.
#
# Con el piso, el G63 sale una vez cada diez millones de aperturas. Es
# una posibilidad remota y se muestra como tal --la pantalla dice
# "1 / 10.000.000"-- pero es de verdad. Y cuesta casi nada: 284.000 por
# 1e-7 son menos de tres centavos de los 416 que la caja puede pagar.
PISO_DE_CHANCE = 1e-7


def resolverChances(valores, objetivo):
    """
    Busca el k que hace que la caja pague `objetivo` en promedio.

    Los objetos cuya chance caeria por debajo del piso se fijan EN el
    piso, y el resto se vuelve a resolver con lo que queda de
    probabilidad y de presupuesto. Se repite hasta que no aparezcan
    nuevos: cada vuelta solo puede agregar fijados, asi que termina.

    Devuelve (chances, k) o None si no hay forma de llegar al objetivo.
    """
    if not valores:
        return None

    n = len(valores)
    fijados = {}

    for _ in range(n + 2):
        libres = [i for i in range(n) if i not in fijados]
        if not libres:
            return None

        # Lo que ya se gasto en los fijados, en probabilidad y en plata.
        masaFijada = sum(fijados.values())
        gastoFijado = sum(valores[i] * c for i, c in fijados.items())

        masaLibre = 1 - masaFijada
        objetivoLibre = objetivo - gastoFijado
        if masaLibre <= 0:
            return None

        vLibres = [valores[i] for i in libres]
        # El objetivo, llevado a "si estos fueran toda la caja".
        objetivoNormalizado = objetivoLibre / masaLibre
        if objetivoNormalizado <= min(vLibres) or objetivoNormalizado >= max(vLibres):
            return None

        bajo, alto = -60.0, 120.0
        for _ in range(400):
            k = (bajo + alto) / 2
            ev = pagoPromedio(vLibres, chancesCon(vLibres, k))
            # El retorno BAJA cuando k sube: mas peso en lo barato.
            if ev > objetivoNormalizado:
                bajo = k
            else:
                alto = k
        k = (bajo + alto) / 2
        cLibres = [c * masaLibre for c in chancesCon(vLibres, k)]

        nuevos = {libres[j]: PISO_DE_CHANCE
                  for j, c in enumerate(cLibres) if c < PISO_DE_CHANCE}
        if not nuevos:
            chances = [0.0] * n
            for i, c in fijados.items():
                chances[i] = c
            for j, i in enumerate(libres):
                chances[i] = cLibres[j]
            return chances, k

        fijados.update(nuevos)

    return None


def redondearChances(chances):
    """
    A diez decimales, y lo que sobre o falte va a la chance mas grande.

    Tienen que sumar exactamente 1: el sorteo recorre el acumulado, y si
    sumaran 0,99999 habria un hueco por el que caeria una de cada cien
    mil aperturas.
    """
    r = [round(c, 10) for c in chances]
    sobra = round(sum(r) - 1, 10)
    if sobra:
        i = max(range(len(r)), key=lambda j: r[j])
        r[i] = round(r[i] - sobra, 10)
    return r


def creditoPara(precio):
    """El credito mas grande que entre comodo en una caja de este precio."""
    tope = precio * 0.25
    posibles = [c for c in CREDITOS if c <= tope]
    return posibles[-1] if posibles else CREDITOS[0]


def main(rutaLanding, rutaDatos, rutaSalida):
    texto = io.open(rutaLanding, encoding="utf-8").read()

    m = re.search(r"const RAW = '([^']*)';", texto)
    if not m:
        raise SystemExit("no encontre la lista de cajas (RAW) en el diseno")

    filas = [f for f in m.group(1).split(";") if f.strip()]
    d = json.load(io.open(rutaDatos, encoding="utf-8"))
    productos, premiosPorCaja = d["p"], d["b"]

    # ── Los objetos ──────────────────────────────────────────────────
    items = []
    for k, pr in enumerate(productos):
        items.append({
            "sku": "D%04d" % k,
            "name": pr[0],
            "valueSc": round(float(pr[1]), 2),
            "rarity": RAREZAS.get(pr[2] if len(pr) > 2 else "c", "blue"),
            # Lamina de productos: 42 columnas x 41 filas.
            "spritePos": "%.4f%% %.4f%%" % ((k % 42) / 41 * 100, (k // 42) / 40 * 100),
            "sprite": "prod",
        })

    porValor = {}  # credito -> indice en items, para no duplicarlos

    def itemDeCredito(valor):
        if valor in porValor:
            return porValor[valor]
        items.append({
            "sku": "CRED%s" % str(valor).replace(".", "_"),
            "name": "MR BOX Credit %s" % (("%.2f" % valor).rstrip("0").rstrip(".")),
            "valueSc": valor,
            "rarity": "blue",
            "spritePos": None,
            "sprite": "credito",
            "shippable": False,
        })
        porValor[valor] = len(items) - 1
        return len(items) - 1

    # ── Las cajas ────────────────────────────────────────────────────
    cajas = []
    conRelleno = 0
    sinResolver = []

    for i, fila in enumerate(filas):
        p = fila.split("|")
        nombre, cats, precio = p[0], [c.strip() for c in p[1].split(",")], float(p[2])
        premios = premiosPorCaja[i] if i < len(premiosPorCaja) else []

        # Los objetos que el diseno puso en esta caja, sin repetir.
        indices = sorted({int(idx) for idx, _ in premios})
        if not indices:
            sinResolver.append((nombre, "sin premios"))
            continue

        objetivo = precio * RETORNO_OBJETIVO
        valores = [items[k]["valueSc"] for k in indices]

        if objetivo <= min(valores):
            # Ni el mas barato entra: hace falta un credito.
            credito = creditoPara(precio)
            indices.append(itemDeCredito(credito))
            valores.append(credito)
            conRelleno += 1

        resuelto = resolverChances(valores, objetivo)
        if not resuelto:
            sinResolver.append((nombre, "objetivo %.2f fuera de [%.2f, %.2f]" % (
                objetivo, min(valores), max(valores))))
            continue

        chances = redondearChances(resuelto[0])
        ev = pagoPromedio(valores, chances)

        cajas.append({
            "slug": re.sub(r"[^a-z0-9]+", "-", nombre.lower()).strip("-"),
            "name": nombre,
            "categories": cats,
            "priceSc": round(precio, 2),
            "risk": int(p[3]),
            "featured": p[4] == "1",
            "markedNew": p[5] == "1",
            # Lamina de cajas: 14 x 14.
            "spritePos": "%.4f%% %.4f%%" % ((i % 14) / 13 * 100, (i // 14) / 13 * 100),
            "prizes": [{"item": k, "chance": c} for k, c in zip(indices, chances)],
            "pagoPromedio": round(ev, 4),
            "retorno": round(ev / precio, 6),
        })

    json.dump({"items": items, "boxes": cajas},
              io.open(rutaSalida, "w", encoding="utf-8"), ensure_ascii=False)

    retornos = [c["retorno"] for c in cajas]
    print("objetos: %d  (incluye %d creditos)" % (len(items), len(porValor)))
    print("cajas:   %d  (%d necesitaron credito de relleno)" % (len(cajas), conRelleno))
    if sinResolver:
        print("NO se pudieron armar: %d" % len(sinResolver))
        for n, por in sinResolver[:5]:
            print("   %s: %s" % (n, por))
    print()
    print("retorno de las cajas armadas:")
    print("   minimo %.4f%%  maximo %.4f%%" % (min(retornos) * 100, max(retornos) * 100))
    fuera = [c for c in cajas if abs(c["retorno"] - RETORNO_OBJETIVO) > 0.0001]
    print("   fuera del objetivo por mas de 0,01 puntos: %d" % len(fuera))
    print()
    print("guardado en", rutaSalida)


if __name__ == "__main__":
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    salida = sys.argv[3] if len(sys.argv) > 3 else os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "..", "datos", "catalogo.json")
    os.makedirs(os.path.dirname(os.path.abspath(salida)), exist_ok=True)
    main(sys.argv[1], sys.argv[2], os.path.abspath(salida))
