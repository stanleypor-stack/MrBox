# -*- coding: utf-8 -*-
"""
LAS CLAVES DE IDIOMA QUE FALTAN.

    python scripts/faltan.py

Busca en src todos los $t("algo") y los compara con el ingles generado.
Una clave que no existe no explota: se dibuja tal cual, y entonces la
pantalla dice "admin.col.username" en vez de "Player". Eso se ve en
produccion y no en la consola, asi que conviene preguntarlo aca.

TAMBIEN MIRA LAS QUE SE ARMAN SOLAS

Media tabla del panel usa "admin.col." + campo, que ningun buscador de
texto encuentra. Por eso lee secciones.js y arma las claves de sus
columnas, filtros y estados como las arma la pantalla.
"""
import io
import json
import os
import re
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(AQUI, "..", "src")


def idioma(cual="en"):
    ruta = os.path.join(SRC, "i18n", "locales", cual + ".js")
    crudo = io.open(ruta, encoding="utf-8").read()
    datos = json.loads(crudo.split("export default ", 1)[1].rsplit(";", 1)[0])

    planas = set()

    def bajar(nodo, prefijo):
        for k, v in nodo.items():
            clave = prefijo + k if not prefijo else prefijo + "." + k
            if isinstance(v, dict):
                bajar(v, clave)
            else:
                planas.add(clave)

    bajar(datos, "")
    return planas


def archivos():
    for raiz, _, nombres in os.walk(SRC):
        for n in nombres:
            if n.endswith((".vue", ".js")) and "i18n" not in raiz:
                yield os.path.join(raiz, n)


def claves_escritas():
    """Los $t("clave") de siempre."""
    # El `(?!\s*\+)` deja afuera las que se arman con una variable:
    # en `$t("admin.col." + campo)` la clave de verdad no esta escrita
    # en ningun lado, y mirarla como "admin.col." no sirve.
    patron = re.compile(r"""\$t[c]?\(\s*['"]([a-zA-Z][\w.]*)['"](?!\s*\+)""")
    salida = {}
    for ruta in archivos():
        texto = io.open(ruta, encoding="utf-8").read()
        for m in patron.finditer(texto):
            clave = m.group(1)
            if clave.endswith("."):
                continue
            salida.setdefault(clave, ruta)
    return salida


def claves_del_panel():
    """Las que arma AdminLista a partir de secciones.js."""
    ruta = os.path.join(SRC, "views", "admin", "secciones.js")
    if not os.path.exists(ruta):
        return {}

    texto = io.open(ruta, encoding="utf-8").read()
    salida = {}

    for campo in re.findall(r"campo:\s*\"([\w]+)\"", texto):
        salida["admin.col." + campo] = ruta

    for campo in re.findall(r"filtros:\s*\[\s*\{\s*campo:\s*\"([\w]+)\"", texto):
        salida["admin.filter." + campo] = ruta

    # { opciones: [...], textos: "admin.rank" }
    for opciones, textos in re.findall(
        r"opciones:\s*\[([^\]]*)\][^}]*?textos:\s*\"([\w.]+)\"", texto, re.S
    ):
        for o in re.findall(r"\"([\w]+)\"", opciones):
            salida[textos + "." + o] = ruta

    # valor: (f) => (f.x ? "live" : "off"), textos: "admin.state"
    for a, b, textos in re.findall(
        r"\?\s*\"([\w]+)\"\s*:\s*\"([\w]+)\"[^}]*?textos:\s*\"([\w.]+)\"", texto
    ):
        salida[textos + "." + a] = ruta
        salida[textos + "." + b] = ruta

    for seccion in re.findall(r"^  ([a-z]+):\s*\{$", texto, re.M):
        salida["admin.nav." + seccion] = ruta
        salida["admin.what." + seccion] = ruta

    return salida


def main():
    hay = idioma("en")
    buscadas = claves_escritas()
    buscadas.update(claves_del_panel())

    faltan = sorted(k for k in buscadas if k not in hay)

    # Las que se arman con una variable entera no se pueden mirar asi.
    if faltan:
        print("FALTAN %d claves:\n" % len(faltan))
        for k in faltan:
            print("  %-42s %s" % (k, os.path.relpath(buscadas[k], SRC)))
        return 1

    print("no falta ninguna clave (%d miradas, %d en el idioma)" % (len(buscadas), len(hay)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
