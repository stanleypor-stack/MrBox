# -*- coding: utf-8 -*-
"""
LOS LOGOS DE LAS TRES CAJAS DE COMUNIDAD.

Un creador sube los suyos desde el editor. Estas tres son nuestras, asi
que los dibujo aca: tres marcas simples, de una sola tinta, que se
tienen que leer pegadas en la cara de un carton de cuarenta pixeles.

POR QUE PNG Y NO SVG

Porque el servidor solo acepta `data:image/(png|jpeg|webp)` --ver
`portadaLimpia` en services/community-- y tiene razon: un `data:` con
SVG adentro puede traer un `<script>`, y eso entraria al sitio por la
puerta de las imagenes.

POR QUE TINTA OSCURA Y NO BLANCA

Las tres caras son de color vivo --dorado, verde agua, naranja-- y el
blanco sobre esos tres se lava. Oscuro encima de color es como se
imprime un carton de verdad.

SE DIBUJA EN GRANDE Y SE ACHICA

Pillow no suaviza los bordes al dibujar. Dibujar a 1024 y bajar a 256
hace el mismo trabajo que el antialiasing, y una diagonal deja de
verse como una escalera.

    python scripts/logosDeComunidad.py
"""
import io
import os
import math
import base64

from PIL import Image, ImageDraw

LADO = 256
ESCALA = 4
G = LADO * ESCALA                      # el lienzo grande
TINTA = (14, 24, 48, 236)              # azul casi negro, como la tinta del sitio

SALIDA = os.path.join(os.path.dirname(__file__), "..", "..", "audit", "logos-comunidad")


def lienzo():
    img = Image.new("RGBA", (G, G), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img)


def pegar_rotado(fondo, capa, grados, centro):
    """Rota una capa suelta y la apoya centrada en `centro`."""
    girada = capa.rotate(grados, resample=Image.BICUBIC, expand=True)
    x = int(centro[0] - girada.width / 2)
    y = int(centro[1] - girada.height / 2)
    fondo.alpha_composite(girada, (x, y))


def pack_ripper():
    """
    Tres sobres en abanico.

    El de adelante TAPA al de atras: antes los tres eran contornos
    sueltos y donde se cruzaban quedaba una maraña que no se leia. Asi
    que de cada uno se borra primero su silueta entera --queda el
    color del carton-- y recien despues se estampa su contorno. Es lo
    mismo que hacen tres cartas de verdad apoyadas una sobre otra.
    """
    img, _ = lienzo()

    ancho, alto, radio = int(G * 0.30), int(G * 0.44), int(G * 0.035)
    borde = int(G * 0.022)

    # De atras hacia adelante: el ultimo que se dibuja es el que tapa.
    for grados, dx, dy in ((-26, -0.175, 0.035), (26, 0.175, 0.035), (0, 0, -0.015)):
        caja = (ancho + 40, alto + 40)

        silueta = Image.new("L", caja, 0)
        ImageDraw.Draw(silueta).rounded_rectangle([20, 20, 20 + ancho, 20 + alto], radio, fill=255)

        tinta = Image.new("RGBA", caja, (0, 0, 0, 0))
        d = ImageDraw.Draw(tinta)
        d.rounded_rectangle([20, 20, 20 + ancho, 20 + alto], radio, outline=TINTA, width=borde)
        # La ventanita de arriba: es lo que lo vuelve un sobre y no un
        # rectangulo cualquiera.
        d.rounded_rectangle(
            [20 + ancho * 0.24, 20 + alto * 0.16, 20 + ancho * 0.76, 20 + alto * 0.42],
            int(radio * 0.7), fill=TINTA,
        )

        centro = (G / 2 + dx * G, G / 2 + dy * G)
        mascara = silueta.rotate(-grados, resample=Image.BICUBIC, expand=True)
        pos = (int(centro[0] - mascara.width / 2), int(centro[1] - mascara.height / 2))
        img.paste((0, 0, 0, 0), pos, mascara)
        pegar_rotado(img, tinta, -grados, centro)

    return img


def battle_station():
    """Un monitor con un rayo: el escritorio, en dos trazos."""
    img, d = lienzo()

    grosor = int(G * 0.055)
    izq, der = G * 0.13, G * 0.87
    arr, aba = G * 0.20, G * 0.66
    d.rounded_rectangle([izq, arr, der, aba], int(G * 0.055), outline=TINTA, width=grosor)

    # El pie: la columna y la base.
    d.rounded_rectangle(
        [G * 0.455, aba, G * 0.545, G * 0.775], int(G * 0.012), fill=TINTA
    )
    d.rounded_rectangle(
        [G * 0.30, G * 0.775, G * 0.70, G * 0.835], int(G * 0.028), fill=TINTA
    )

    # El rayo adentro de la pantalla.
    cx, cy, k = G * 0.5, G * 0.43, G * 0.145
    d.polygon(
        [
            (cx + k * 0.40, cy - k * 1.05),
            (cx - k * 0.72, cy + k * 0.18),
            (cx - k * 0.06, cy + k * 0.18),
            (cx - k * 0.40, cy + k * 1.05),
            (cx + k * 0.72, cy - k * 0.20),
            (cx + k * 0.06, cy - k * 0.20),
        ],
        fill=TINTA,
    )
    return img


def sole_survivor():
    """Una zapatilla de perfil, de un trazo cerrado."""
    img, d = lienzo()

    """
    EL PERFIL, MIRANDO A LA IZQUIERDA.

    La primera version era una loma: la puntera muy gruesa y el talon
    muy bajo, y de lejos parecia una piedra. Una zapatilla se reconoce
    por tres cosas, y son estas tres: la puntera BAJA adelante, la caña
    ALTA atras, y la suela separada del cuerpo por un hueco.
    """
    cuerpo = [
        (0.070, 0.690),   # punta, abajo del todo y adelante
        (0.075, 0.610),
        (0.130, 0.562),   # el domo de la puntera, bajo
        (0.250, 0.535),
        (0.380, 0.515),
        (0.480, 0.455),   # empieza a subir hacia la lengueta
        (0.565, 0.375),
        (0.625, 0.300),
        (0.700, 0.268),   # borde de arriba de la caña
        (0.792, 0.285),
        (0.820, 0.370),
        (0.815, 0.470),   # la espalda del talon
        (0.862, 0.560),
        (0.922, 0.630),
        (0.930, 0.690),
        (0.070, 0.690),
    ]
    d.polygon([(x * G, y * G) for x, y in cuerpo], fill=TINTA)

    # La suela, separada por un hueco: es lo que la vuelve una
    # zapatilla y no una pala.
    d.rounded_rectangle(
        [G * 0.052, G * 0.722, G * 0.948, G * 0.812], int(G * 0.045), fill=TINTA
    )

    # Y la curva del costado, cortada --no pintada-- para que por el
    # hueco se vea el color del carton.
    puntos = []
    for i in range(49):
        t = i / 48
        x = 0.185 + t * 0.400
        y = 0.650 - math.sin(t * math.pi * 0.58) * 0.120
        puntos.append((x * G, y * G))

    hueco = Image.new("L", (G, G), 0)
    ImageDraw.Draw(hueco).line(puntos, fill=255, width=int(G * 0.042), joint="curve")
    img.paste((0, 0, 0, 0), (0, 0), hueco)

    return img


def comoDataUri(img):
    chico = img.resize((LADO, LADO), Image.LANCZOS)
    buf = io.BytesIO()
    chico.save(buf, format="PNG", optimize=True)
    crudo = buf.getvalue()
    return crudo, "data:image/png;base64," + base64.b64encode(crudo).decode("ascii")


if __name__ == "__main__":
    os.makedirs(SALIDA, exist_ok=True)
    salida = {}
    for nombre, hacer in (
        ("pack-ripper", pack_ripper),
        ("battle-station", battle_station),
        ("sole-survivor", sole_survivor),
    ):
        crudo, uri = comoDataUri(hacer())
        io.open(os.path.join(SALIDA, nombre + ".png"), "wb").write(crudo)
        io.open(os.path.join(SALIDA, nombre + ".txt"), "w").write(uri)
        salida[nombre] = len(crudo)
        print("%-16s %5d bytes  (%d en base64)" % (nombre, len(crudo), len(uri)))
    print("\nen", os.path.abspath(SALIDA))
