/**
 * REEMBOLSOS.
 *
 * Los Terminos la nombran dos veces, asi que tiene que existir.
 *
 * La regla de fondo --el SC comprado no se devuelve, salvo error--
 * es la de cualquier credito de tienda, y es la misma que tienen
 * mrloot y luxdrop. Lo que no hacen ellos, y si conviene hacer, es
 * decir CLARO en que casos SI se devuelve: una politica que solo
 * dice que no, hace que la gente vaya al chargeback en vez de
 * escribir, y un chargeback cuesta mucho mas caro que el reembolso.
 */
import { h, s, p, li, nota } from "./bloques";

export const ACTUALIZADO = "2026-11-21";

export const TEXTO = [
  p("When money comes back, and when it does not. This page is part of the Terms of Service."),

  nota("Short version: SC you have bought is not refundable, because it is credit you can spend immediately. If something went wrong on our side — a double charge, a payment that did not deliver, a mistake of ours — we fix it, and we would much rather you wrote to us than went to your bank."),

  /* ── 1 ─────────────────────────────────────────────────────────── */
  h("1. SC you bought"),
  p("Buying SC is buying digital content that is delivered to you the moment you pay. Once it is in your balance it is not refundable."),
  p("If you are a consumer in the EU or EEA: by paying you ask us to deliver the SC immediately and you accept that you lose the 14-day right of withdrawal under Article 16(m) of Directive 2011/83/EU for that purchase. We record that consent with the transaction."),
  p("This does not affect your rights if something we sell you is faulty, or if a charge was not authorised by you."),

  /* ── 2 ─────────────────────────────────────────────────────────── */
  h("2. When we do refund"),
  p("Write to [[EMAIL DE SOPORTE]] in any of these cases and we will put it right:"),
  li([
    "You were charged twice for the same purchase.",
    "You were charged and no SC arrived.",
    "You were charged an amount different from the one shown at checkout.",
    "Somebody used your payment method without your permission.",
    "We credited the wrong thing, or a bug of ours cost you SC or an item.",
    "We cancelled a box opening because of an obvious pricing error — there you get back what you paid for that opening.",
  ]),
  p("Refunds go back to the payment method the money came from. We cannot refund to a different card, a different account or a different wallet, and we do not refund in cash."),

  /* ── 3 ─────────────────────────────────────────────────────────── */
  h("3. Openings and items"),
  p("An opening cannot be undone. The moment you confirm it, the draw happens, the item is yours and the SC is spent. Getting an item worth less than the box is the normal outcome of a box, not a fault."),
  p("Selling an item back to us is also final: you chose to exchange it for SC at the value shown, and we cannot return the item afterwards."),
  p("If an item arrives damaged or faulty, that is a different thing and it is covered in the Shipping page."),

  /* ── 4 ─────────────────────────────────────────────────────────── */
  h("4. Closing your account"),
  p("Unused SC is not paid out when you close your account. Before you close it, redeem your balance if you can, and ship or sell what is in your inventory."),
  p("If we close your account for a reason that is not your fault, we do the opposite: we fulfil what is pending and return what you are owed."),

  /* ── 5 ─────────────────────────────────────────────────────────── */
  h("5. How long it takes"),
  p("We answer a refund request within 7 business days. Once we approve it, the money leaves us straight away; how long it takes to appear depends on your bank or card issuer, usually [[PLAZO DEL EMISOR]]."),
  p("A cryptocurrency payment cannot be reversed on the network. Where we agree to refund one, we send the equivalent back to the address it came from, less the network fee."),

  /* ── 6 ─────────────────────────────────────────────────────────── */
  h("6. Before you call your bank"),
  p("Write to us first. Most disputes are something we can see and fix in a day, and a chargeback cannot be undone once it starts — not even by you."),
  p("Starting a chargeback on a purchase you authorised and received, without contacting us first, is a serious breach of the Terms. We may close the account and any connected ones, cancel the SC and items that came from the disputed payment, and recover the amount and the fees."),
  p("None of this limits your right to dispute a payment you genuinely did not authorise. That is what chargebacks are for, and we will help you with it."),

  /* ── 7 ─────────────────────────────────────────────────────────── */
  h("7. Billing errors"),
  p("Report a billing error within 30 days of the charge. After that we treat the charge as correct, except where the law says otherwise."),
  p("If we credit you SC, an item or a benefit by mistake, it stays ours and we may take it back. If you have already spent it, you owe us the value. Tell us if you see something credited that should not be there — we will not treat it against you."),
];

export default { ACTUALIZADO, TEXTO };
