/**
 * AML Y ACEPTACION DE CLIENTES.
 *
 * Reemplaza a la pagina que se llamaba "Aceptacion de clientes".
 * Es el mismo tema, pero con el nombre con el que lo busca un banco,
 * un procesador de pagos y un abogado: AML. Tanto mrloot como
 * luxdrop tienen una pagina asi, y a los dos se la pide su
 * procesador.
 *
 * Los niveles y los umbrales son los de `services/verification`:
 *
 *   canjear saldo ......... nivel 2
 *   que te manden algo .... nivel 2
 *   mas de SC 1.000 ....... nivel 3
 *
 * La revision la hace el equipo, no un proveedor externo. Si algun
 * dia se contrata uno, esto cambia.
 *
 * Lo que depende de la jurisdiccion --a quien se reporta, cuanto se
 * conserva-- esta marcado «[[asi]]».
 */
import { h, s, p, li, nota, tabla } from "./bloques";

export const ACTUALIZADO = "2026-11-21";

export const TEXTO = [
  p("This page explains who we can accept as a customer, what we check, and when we have to say no. It is part of the Terms of Service."),

  nota("Most people never notice any of this. It matters when money moves: before you redeem a balance, before we ship something expensive, and whenever something does not add up."),

  /* ── 1 ─────────────────────────────────────────────────────────── */
  h("1. Who we can accept"),
  p("To hold an account you must:"),
  li([
    "be 18 or older, and old enough to enter a contract where you live",
    "be acting for yourself, not for somebody else",
    "not be in, or resident in, a country we do not serve",
    "not be on a sanctions list, and not be owned or controlled by somebody who is",
    "not be a politically exposed person whose risk we cannot manage, which we assess case by case",
  ]),
  p("One account per person. Opening more than one may cost you all of them."),
  p("[[PAÍSES EXCLUIDOS — lista concreta, a definir con el abogado y con el procesador de pagos]]"),

  /* ── 2 ─────────────────────────────────────────────────────────── */
  h("2. The verification levels"),
  p("Verification is in steps. You only go as far as what you want to do requires."),

  tabla([
    ["Level 1", "Your name, date of birth and country. Typed by you."],
    ["Level 2", "A photograph of a government document — passport, ID card or driving licence — that matches what you said at level 1."],
    ["Level 3", "A proof of address issued in the last three months: a utility bill, a bank statement or an official letter."],
  ]),

  s("When each one is required"),
  tabla([
    ["Opening boxes", "No verification"],
    ["Redeeming your balance", "Level 2"],
    ["Having an item shipped", "Level 2"],
    ["An order over SC 1,000", "Level 3"],
  ]),

  p("We may also ask for verification at any other time, including after a transaction, if something about an account does not fit."),

  s("Who looks at it"),
  p("Our own team reviews the documents. We do not send them to an outside verification company. They are stored encrypted, only the people who have to see them can, and the photograph is deleted once the decision is made."),

  /* ── 3 ─────────────────────────────────────────────────────────── */
  h("3. Where the money comes from"),
  p("You must pay with a method that belongs to you. Paying with somebody else's card, bank account or wallet is not allowed, and we may ask you to prove the method is yours."),
  p("If the amounts moving through an account do not match what we know about it, we may ask you where the funds came from and ask for documents to back it up — a payslip, a sale, a bank statement. We will tell you what we need and why."),
  p("Until we are satisfied, we may hold a redemption or a shipment. If we are not satisfied, we may decline the transaction and return the money to where it came from."),

  /* ── 4 ─────────────────────────────────────────────────────────── */
  h("4. Cryptocurrency"),
  p("Deposits and redemptions are in cryptocurrency, and the blockchain is public. We screen the addresses we send to and receive from against the usual risk databases."),
  p("We will not send to a third-party wallet. The wallet has to be yours, and we may ask you to prove it by signing a message or by making a small transfer from it."),
  p("If a deposit reaches us from an address flagged as high risk, we may freeze it, ask you about it, and return it to the sending address."),

  /* ── 5 ─────────────────────────────────────────────────────────── */
  h("5. What we watch for"),
  p("Not because we assume the worst, but because we are required to:"),
  li([
    "depositing and then redeeming with little or no play in between",
    "several accounts with the same device, address, payment method or document",
    "an account whose activity suddenly changes shape",
    "a refusal to verify at the point where verification is required",
    "payments from a method that is not the account holder's",
    "any attempt to get around a country restriction, including with a VPN",
  ]),

  /* ── 6 ─────────────────────────────────────────────────────────── */
  h("6. What we may do"),
  p("Depending on what we find, we may ask you for information, hold a transaction while we look, decline it, limit the account, or close it."),
  p("Where we are required to report something, we will. In that case the law may stop us from telling you, and then we will not be able to explain why — not because we are being difficult, but because we are not allowed to."),
  p("Where we close an account for a reason that is not your fault, you get your balance and your items. Where we close it because of fraud or a breach of the Terms, section 16 of the Terms applies."),
  p("[[AUTORIDAD A LA QUE SE REPORTA Y OBLIGACIONES CONCRETAS — dependen de la jurisdicción; a definir con el abogado]]"),

  /* ── 7 ─────────────────────────────────────────────────────────── */
  h("7. What we keep, and for how long"),
  p("We keep verification data and the record of every transaction for as long as the law requires, counted from when the relationship ends. That is why closing your account does not delete everything: some of it we are obliged to hold on to."),
  p("[[PLAZO DE CONSERVACIÓN — a definir]]"),
  p("What we do with that data day to day is in the Privacy Policy."),

  /* ── 8 ─────────────────────────────────────────────────────────── */
  h("8. Who is responsible for this inside MR BOX"),
  p("[[RESPONSABLE DE CUMPLIMIENTO / MLRO — nombre y contacto, a definir]]"),
  p("Questions about anything on this page: [[EMAIL DE CUMPLIMIENTO]]."),
];

export default { ACTUALIZADO, TEXTO };
