/**
 * JUEGO RESPONSABLE.
 *
 * Las herramientas que se describen aca EXISTEN en el codigo
 * (`services/controls`): el tope diario de gasto, el tope diario de
 * perdida y la pausa. Lo que dice esta pagina sobre como se
 * comportan --que apretar es inmediato y aflojar tarda, que durante
 * una pausa no se acredita nada-- es lo que hacen de verdad.
 *
 * Lo que NO hay todavia esta marcado «[[asi]]»: los telefonos de
 * ayuda cambian por pais y no los invento.
 */
import { h, s, p, li, nota } from "./bloques";

export const ACTUALIZADO = "2026-11-21";

export const TEXTO = [
  p("MR BOX is meant to be fun. This page is about keeping it that way, and about the tools we give you if it stops being fun."),

  nota("A box returns, on average, less than it cost. Over many openings you will spend more than you get back. That is how the shop works and it is not something you can out-play."),

  /* ── 1 ─────────────────────────────────────────────────────────── */
  h("1. Spend what you were going to spend anyway"),
  p("Treat money you put into MR BOX the way you would treat money spent on anything else you enjoy: it is gone once you have spent it, and what you get back is a bonus, not a return."),
  p("Decide what you are willing to spend before you start, not while you are going. Deciding in the middle is how the number grows."),

  /* ── 2 ─────────────────────────────────────────────────────────── */
  h("2. Signs worth paying attention to"),
  p("None of these mean you have a problem. All of them are worth noticing:"),
  li([
    "opening boxes to win back what you have already spent",
    "spending more than you planned, more often than you planned",
    "hiding what you spend from people close to you",
    "borrowing, or using money meant for something else",
    "feeling you have to keep going rather than wanting to",
    "being irritable or restless when you cannot open boxes",
    "it getting in the way of sleep, work or people",
  ]),
  p("If you recognise yourself in several of these, the tools below exist for exactly that, and support will help you with no questions asked."),

  /* ── 3 ─────────────────────────────────────────────────────────── */
  h("3. The tools on your account"),

  s("A. A daily spending limit"),
  p("The most you can spend on openings in a day. Once you reach it, you cannot open any more that day, whatever your balance says."),

  s("B. A daily loss limit"),
  p("The most you can be down in a day, counting what came out of the boxes against what you paid. Once you reach it, the same thing happens."),

  s("C. Taking a break"),
  p("You pick how long. While a break is running you cannot open boxes at all."),
  p("A break also stops everything else coming in: no deposits are credited, no promotions, no rewards, no rakeback. A break that still takes your money is not a break, and we would rather lose the deposit than pretend otherwise."),

  s("D. Tightening is instant, loosening takes time"),
  p("Lowering a limit, or starting a break, takes effect immediately."),
  p("Raising a limit, removing one, or ending a break early does not. It takes effect only after a waiting period. This is deliberate: the moment you most want to undo a limit is the moment it is doing its job."),

  s("E. Closing the account"),
  p("If you want out for good, write to support@mrbox.gg and we will close the account. Before you do, redeem your balance and ship or sell what is in your inventory: once the account closes, what is left in it is gone."),

  /* ── 4 ─────────────────────────────────────────────────────────── */
  h("4. Under 18"),
  p("MR BOX is for adults. You must be 18 or older, and old enough to enter a contract where you live. We verify age and we close accounts that turn out to belong to minors, returning what was paid to the payment method it came from."),
  p("If you share a device with someone under 18, do not save your password in the browser, and consider blocking software: [[SOFTWARE DE BLOQUEO RECOMENDADO — a definir]]."),

  /* ── 5 ─────────────────────────────────────────────────────────── */
  h("5. What we do on our side"),
  li([
    "We publish the chance of every item before you pay, and the Provably Fair page lets you check every draw.",
    "We do not tell you that you are due a win, that a box is hot, or that a loss means a win is coming. None of that is true: every opening is independent of the last one.",
    "We do not advertise to anyone under 18, and our affiliates are not allowed to either.",
    "We do not chase you with offers to come back if you have set a limit or taken a break.",
    "We act on a request to close an account; we do not try to talk you out of it.",
  ]),

  /* ── 6 ─────────────────────────────────────────────────────────── */
  h("6. Where to get help"),
  p("If this stopped being a hobby, talking to somebody who is not us is worth more than anything on this page."),
  p("[[LÍNEAS DE AYUDA POR PAÍS — a definir con el abogado. Hay que listar las de los países donde se opere, no una genérica.]]"),
  p("You can also write to us at support@mrbox.gg. We will set a limit, start a break or close the account for you, and we will not ask why."),
];

export default { ACTUALIZADO, TEXTO };
