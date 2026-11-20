# -*- coding: utf-8 -*-
"""
LOS BANNERS NUEVOS DE LA PORTADA.

    python backend/scripts/ponerBanners.py <carpeta-con-las-imagenes>

Las cuatro llegan a 2000x667, que es la MISMA proporcion que las que
estaban (3,0) y mas del doble de resolucion: las viejas median 1600x534
y en una pantalla retina se agrandaban. A 2000 el banner se dibuja a
~1050 css, asi que a 2x queda justo.

NO SE REESCALAN NI SE RECORTAN. La caja del banner ya recorta un 15%
por el centro para quedar en la proporcion de mrloot (3,55), y ese
recorte se revisó banner por banner: el titulo, el texto y el boton
viven en la franja del medio.

Se guardan con calidad 92 y `method=6` --el compresor mas lento de
webp-- porque esta imagen es lo primero que ve alguien que entra. Pesar
200KB una vez vale mas que ahorrar 40KB en el banner de la portada.
"""
import os
import sys

from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
DESTINO = os.path.join(AQUI, "..", "..", "frontend", "public", "img", "banners")

# El archivo que mando Dani -> el nombre con el que vive en el sitio.
MAPA = [
    ("460.webp", "banner-luxury.webp", "Unbox your dream luxury items"),
    ("461.webp", "banner-gta.webp", "GTA VI Event"),
    ("462.webp", "banner-race.webp", "10K Race"),
    ("463.webp", "banner-50k.webp", "50K Reward"),
]

# Lo que la pantalla espera: 3,0 de proporcion. Si llega otra cosa, el
# recorte del 15% se come algo que no tiene que comerse.
PROPORCION = 3.0
TOLERANCIA = 0.04


def main(origen):
    for archivo, nombre, que in MAPA:
        entrada = os.path.join(origen, archivo)
        if not os.path.exists(entrada):
            print("FALTA: %s (%s)" % (entrada, que))
            continue

        im = Image.open(entrada).convert("RGB")
        prop = im.size[0] / float(im.size[1])

        if abs(prop - PROPORCION) > TOLERANCIA:
            print("OJO: %s viene en %.3f y la pantalla espera %.2f" % (archivo, prop, PROPORCION))

        salida = os.path.abspath(os.path.join(DESTINO, nombre))
        antes = os.path.getsize(salida) if os.path.exists(salida) else 0

        im.save(salida, "WEBP", quality=92, method=6)

        print("%s  %dx%d  %.0fKB (antes %.0fKB)  <- %s" % (
            nombre.ljust(20), im.size[0], im.size[1],
            os.path.getsize(salida) / 1024.0, antes / 1024.0, que,
        ))


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    main(sys.argv[1])
