# -*- coding: utf-8 -*-
"""
UN ARCHIVO POR OBJETO, AL DOBLE DE TAMANO.

El diseno entrego los 1.712 objetos en UNA lamina de 42 x 41 casilleros
de 96 x 96 px. Dibujarlos salia de ahi con `background-position`.

POR QUE SE DEJO DE USAR ASI

La lamina pesa 4 MB y la bajaba entera CUALQUIER pantalla que mostrara
un solo objeto, y encima el casillero de 96 px se estira: en la pagina
de una caja los premios se dibujan a 140 px, y en un celular con pantalla
de 3x eso son 420 px de pantalla sacados de 96. Por eso se veian
borrosos.

LO QUE HACE ESTE SCRIPT

Corta cada casillero usado y lo guarda aparte, al doble (192 px), con
Lanczos y un pelin de enfoque. Mas pixeles no inventan detalle, pero el
navegador pasa de ESTIRAR 96 a ACHICAR 192, que es lo que se ve nitido.

Y cada pantalla baja solo los que muestra: la portada ~12 objetos
(~90 KB) en vez de 4 MB.

    python scripts/cortarObjetos.py

Se corre desde frontend/. La lamina original vive en scripts/fuente/
porque ya no se publica.
"""
import io
import json
import os
import sys

from PIL import Image, ImageFilter

AQUI = os.path.dirname(os.path.abspath(__file__))
FRONT = os.path.dirname(AQUI)
LAMINA = os.path.join(AQUI, "fuente", "objetos.webp")
CATALOGO = os.path.join(FRONT, "..", "backend", "datos", "catalogo.json")
SALIDA = os.path.join(FRONT, "public", "img", "prod")

COLUMNAS, FILAS = 42, 41
CALIDAD = 82


def casillero(posicion):
    """De '60.9756% 0.0000%' al (columna, fila) del casillero."""
    x, y = [float(p.replace("%", "")) for p in posicion.split()]
    return (
        int(round(x * (COLUMNAS - 1) / 100)),
        int(round(y * (FILAS - 1) / 100)),
    )


def main():
    if not os.path.exists(LAMINA):
        sys.exit("falta la lamina: %s" % LAMINA)

    lamina = Image.open(LAMINA).convert("RGBA")
    ancho, alto = lamina.width // COLUMNAS, lamina.height // FILAS

    catalogo = json.load(io.open(CATALOGO, encoding="utf-8"))
    usados = set()
    for objeto in catalogo["items"]:
        if objeto.get("sprite") == "prod" and objeto.get("spritePos"):
            usados.add(casillero(objeto["spritePos"]))

    if not os.path.isdir(SALIDA):
        os.makedirs(SALIDA)

    bytes_totales = 0
    for columna, fila in sorted(usados):
        caja = (columna * ancho, fila * alto, columna * ancho + ancho, fila * alto + alto)
        recorte = lamina.crop(caja)

        grande = recorte.resize((ancho * 2, alto * 2), Image.LANCZOS)
        grande = grande.filter(ImageFilter.UnsharpMask(radius=1.6, percent=85, threshold=2))

        destino = os.path.join(SALIDA, "%d-%d.webp" % (columna, fila))
        grande.save(destino, "WEBP", quality=CALIDAD, method=5)
        bytes_totales += os.path.getsize(destino)

    print("%d objetos cortados a %d px, %.1f MB en total (%.1f KB cada uno)" % (
        len(usados), ancho * 2, bytes_totales / 1048576.0, bytes_totales / len(usados) / 1024.0,
    ))


if __name__ == "__main__":
    main()
