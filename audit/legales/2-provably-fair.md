<!--
  BORRADOR. No esta revisado por un abogado.

  Generado desde frontend/src/legal/ con scripts/exportarLegales.js.
  Si se edita ESTE archivo, el cambio no llega al sitio: el texto
  que se publica es el del .js.
-->
# MR BOX — Provably Fair

*Last updated: 2026-11-21*

Every box opening on MR BOX is decided by a calculation you can repeat yourself. This page explains exactly how, so you do not have to take our word for it.

> **We commit to the result before you play, and we show you the ingredients afterwards. If we had changed anything, the numbers would not match.**

## 1. The short version

Three things go into every opening: a secret of ours, a secret of yours, and a counter. We publish a fingerprint of our secret before you play. Afterwards we show you the secret itself. You check that the fingerprint matches, run the same calculation we ran, and you will get the same item.

Because we published the fingerprint first, we could not have changed our secret after seeing what you were going to get. And because your own secret goes into the calculation, we could not have picked a secret that gives a bad result for you specifically.

## 2. The three ingredients

### A. The server seed — ours

A random string we generate for you and keep secret while it is in use. Before you open anything, we show you its SHA-256 hash. That hash is a fingerprint: it is easy to go from the seed to the hash, and impossible to go back. Publishing it first is what stops us from swapping the seed later.

### B. The client seed — yours

A string you control. We set a random one to start with, and you can change it whenever you want from your profile. Changing it starts the counter again from zero.

This is the part that protects you from us. Even if we somehow knew the odds were against you on a particular draw, we cannot steer the outcome, because half of the input is chosen by you after our half is already locked.

### C. The nonce — the counter

A number that goes up by one with every opening you make on the same pair of seeds: 0, 1, 2, and so on. It is what makes two openings with the same seeds give different results.

## 3. The calculation

We compute an HMAC using SHA-256, with the server seed as the key and your client seed followed by a colon and the nonce as the message:

HMAC_SHA256( key = serverSeed, message = clientSeed + ":" + nonce )

That gives a 64-character hexadecimal string. We take the first 8 characters of it, read them as a hexadecimal number, and divide by the largest value 8 hex characters can hold. The result is a number between 0 and 1, spread evenly.

Then we walk down the box's item list, adding up each item's chance, and stop at the first item where the running total passes that number. That is your item.

## 4. Checking it yourself

After an opening, the box page shows you the server seed, your client seed, the nonce and the resulting HMAC. To check it:

- Hash the server seed with SHA-256 and compare it with the fingerprint we published before you played. They must match.
- Run the HMAC with those exact three ingredients. You must get the same HMAC we show.
- Turn the first 8 characters into a number between 0 and 1, and walk the item list as described above. You must land on the same item.

On a terminal, step two is one line:

echo -n "CLIENT_SEED:NONCE" | openssl dgst -sha256 -hmac "SERVER_SEED"

The item list and the chances we used are the ones shown on the box page at the moment you opened it, and we keep a record of them.

## 5. Rotating seeds

You can change your client seed at any time. When you do, we also retire the server seed in use, reveal it in full so you can verify everything you opened with it, and start a new one with its fingerprint published.

We also rotate server seeds on our side from time to time. We always reveal a retired seed, so nothing opened with it becomes impossible to check.

## 6. What this does and does not prove

It proves that the draw was not tampered with: not by us, not after the fact, and not for you in particular.

It does not change the odds. The chances are what the box page says they are, and they are weighted: cheap items come out far more often than expensive ones. A verifiable draw is still a draw, and across many openings a box returns less than it costs — about 92% of what goes in. Provably fair means honest, not profitable.

It also does not cover anything outside the draw: what an item is worth, whether it is in stock, or how long shipping takes. Those are in the Terms of Service.

## 7. The animation

The reel that spins when you open a box is decoration. The items scrolling past are a sample of what the box contains, shuffled for the animation. Your item is already decided by the server before the first frame plays, and the reel is simply told where to stop.

## 8. If the numbers do not match

Write to us at [[EMAIL DE SOPORTE]] with the opening, the seeds and the nonce. If you can show that a result does not reconcile, that is a bug on our side and we will tell you what happened and put it right.

---

## Lo que falta decidir

Cada uno de estos aparece en el texto escrito `[[así]]`. Son decisiones
del titular del sitio y de su abogado.

- **EMAIL DE SOPORTE** — 1 vez
