# -*- coding: utf-8 -*-
"""
LAS FOTOS BAJADAS, PUESTAS DONDE LA PANTALLA LAS BUSCA.

    node scripts/traerFotos.js --aplicar      primero: las baja
    python scripts/convertirFotos.py          despues: las convierte

Las de origen son PNG de 500x500 con transparencia; las que tenemos son
recortes de lamina de 192x192 aplastados contra un fondo. En la
pantalla se dibujan a 132px, asi que en un telefono --que pinta a 2x--
las viejas se agrandan y se ven sucias.

SE PISA EL MISMO ARCHIVO DE SIEMPRE.

El catalogo apunta a `sprite:prod:X% Y%`, que la pantalla convierte en
`/img/prod/<columna>-<fila>.webp`. Pisando ese archivo, la foto mejora
sin tocar una linea de la pantalla ni un registro de la base.

El mapeo se rehace aca y no se lee de una lista: la unica verdad es el
catalogo, y asi correr esto dos veces da lo mismo.

SE GUARDA EN WEBP CON TRANSPARENCIA. El fondo del sitio es oscuro y
cambia de tono entre la cinta, la grilla y las tarjetas; una foto con
su propio fondo blanco se nota en las tres.
"""
import io
import json
import os
import re
import subprocess
import sys

from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, "..", ".."))
CACHE = os.path.join(RAIZ, ".fotos-cache")
DESTINO = os.path.join(RAIZ, "frontend", "public", "img", "prod")

# Las mismas que `frontend/src/utils/sprite.js`.
COLUMNAS = 42
FILAS = 41

# 500 es lo que viene de origen y mas que suficiente: lo mas grande que
# dibuja la pantalla son 132px, o sea 264 en una pantalla de 2x.
LADO = 500

APLICAR = "--aplicar" in sys.argv


def archivo_de(image_url):
    """El recorte de lamina que le toca a un objeto."""
    m = re.match(r"^sprite:prod:([\d.]+)% ([\d.]+)%", image_url or "")
    if not m:
        return ""
    col = int(round(float(m.group(1)) * (COLUMNAS - 1) / 100.0))
    fil = int(round(float(m.group(2)) * (FILAS - 1) / 100.0))
    return "%d-%d.webp" % (col, fil)


def candidatos(nombre):
    """Las mismas formas que prueba `traerFotos.js`, en el mismo orden."""
    base = nombre.lower().replace("&", " ")
    base = re.sub(r"['‘’\"]", "", base)
    base = re.sub(r"[^a-z0-9]+", "-", base).strip("-")

    fuera = [base]

    sin_prefijo = re.sub(r"^(sword-shield|scarlet-violet|sun-moon|xy|pokemon)-", "", base)
    if sin_prefijo != base:
        fuera.append(sin_prefijo)

    sin_cola = re.sub(r"-(booster-)?(display-)?box$", "", base)
    if sin_cola != base:
        fuera.append(sin_cola)

    vistos = set()
    return [x for x in fuera if x and not (x in vistos or vistos.add(x))]


def catalogo():
    """Los objetos del catalogo, preguntandoselo a node."""
    guion = (
        "const m=require('mongoose'),fs=require('fs');"
        "const uri=fs.readFileSync('.env','utf8').split(/\\r?\\n/)"
        ".find(l=>l.startsWith('DATABASE_URI=')).slice(13).trim();"
        "(async()=>{await m.connect(uri);"
        "const I=require('./database/models/Item');"
        "const r=await I.find({imageUrl:{$regex:'^sprite:prod:'}})"
        ".select('name imageUrl').lean();"
        "console.log(JSON.stringify(r.map(x=>({n:x.name,u:x.imageUrl}))));"
        "await m.disconnect();})()"
    )
    salida = subprocess.check_output(
        ["node", "-e", guion],
        cwd=os.path.join(RAIZ, "backend"),
    ).decode("utf-8")
    # node imprime el aviso de dotenv antes del JSON
    corte = salida.index("[")
    return json.loads(salida[corte:])


def main():
    items = catalogo()
    print("objetos en el catalogo: %d" % len(items))

    # Los vales son nuestros: ya tienen su dibujo.
    items = [x for x in items if not x["n"].lower().startswith("mr box credit")]

    hechos, sin_foto, repetidos = 0, 0, 0
    vistos = set()

    for it in items:
        destino_rel = archivo_de(it["u"])
        if not destino_rel:
            continue
        if destino_rel in vistos:
            repetidos += 1
            continue
        vistos.add(destino_rel)

        origen = None
        for slug in candidatos(it["n"]):
            posible = os.path.join(CACHE, slug + ".png")
            if os.path.exists(posible):
                origen = posible
                break

        if not origen:
            sin_foto += 1
            continue

        if not APLICAR:
            hechos += 1
            continue

        try:
            im = Image.open(origen).convert("RGBA")
        except Exception as e:
            print("  no pude abrir %s: %s" % (os.path.basename(origen), e))
            sin_foto += 1
            continue

        if max(im.size) > LADO:
            im.thumbnail((LADO, LADO), Image.LANCZOS)

        # `method=4` y no 6: medido sobre estas fotos, 6 tarda 6,8
        # segundos por imagen contra 0,06, y el archivo queda 1KB mas
        # chico. Mil quinientas fotos serian tres horas para nada.
        im.save(os.path.join(DESTINO, destino_rel), "WEBP",
                quality=90, method=4, lossless=False)
        hechos += 1

        if hechos % 200 == 0:
            sys.stdout.write("  %d listas\r" % hechos)
            sys.stdout.flush()

    print("\nCON FOTO NUEVA: %d" % hechos)
    print("SIN FOTO:       %d  (se quedan con la del prototipo)" % sin_foto)
    print("REPETIDOS:      %d  (dos entradas del catalogo, un mismo recorte)" % repetidos)

    if not APLICAR:
        print("\n(prueba en seco: no se escribio nada. Correr con --aplicar)")


if __name__ == "__main__":
    main()
