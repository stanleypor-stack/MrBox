/**
 * PRIVACIDAD.
 *
 * Describe lo que el sitio guarda DE VERDAD, no una plantilla. Lo
 * que dice sale de mirar el codigo:
 *
 *   - la cuenta y el saldo, en `User`
 *   - los documentos de verificacion, en `services/verification`
 *   - los movimientos, en `BalanceTransaction`
 *   - las aperturas, en `BoxOpen`
 *   - el chat, en `SupportThread`
 *   - la direccion de envio, en `Address` y `Order`
 *
 * Y lo que NO hay tambien es verdad y vale decirlo: no hay Google
 * Analytics, ni pixel de Facebook, ni ningun script de terceros en la
 * pagina. Si manana se agrega uno, esta pagina cambia el mismo dia.
 *
 * Los plazos de conservacion estan marcados «[[asi]]»: dependen de la
 * jurisdiccion y los define el abogado.
 */
import { h, s, p, li, nota } from "./bloques";

export const ACTUALIZADO = "2026-11-21";

export const TEXTO = [
  p("This page says what we keep about you, why, and what you can do about it. It is written to be read, not to be skipped."),

  nota("We do not sell your data, we do not share it for advertising, and there is no tracking script on this site: no Google Analytics, no advertising pixel, nothing from a third party running in your browser."),

  /* ── 1 ─────────────────────────────────────────────────────────── */
  h("1. Who is responsible"),
  p("The data controller is [[RAZÓN SOCIAL]], [[DIRECCIÓN]]. For anything about your data, write to [[EMAIL DE PRIVACIDAD]]."),
  p("[[DELEGADO DE PROTECCIÓN DE DATOS / REPRESENTANTE EN LA UE — a definir con el abogado]]"),

  /* ── 2 ─────────────────────────────────────────────────────────── */
  h("2. What we keep"),

  s("A. To have an account"),
  p("Your email, your username, and a hashed password — we never store the password itself. If you sign in with Google we receive your email and Google's account identifier, and nothing else from them."),

  s("B. To verify who you are"),
  p("When verification is required, we ask for your name, date of birth, country, and a photograph of a government document; for the highest level, a proof of address. These are reviewed by our own team, not sent to an outside verification company."),
  p("We keep the data from the document. We keep the photograph itself only as long as we need it to decide, and no longer."),

  s("C. Because you used the site"),
  p("Every deposit, purchase, box opening, sale back to us and redemption, with its amount and time. Every item you won and what happened to it. This is the record of what we owe each other, so we keep it even if you later delete other things."),
  p("Box openings also keep the seeds and counter behind the draw, which is what makes the Provably Fair page work."),

  s("D. To send you something"),
  p("The delivery address and phone number you give us for an order, which we pass to the carrier."),

  s("E. When you write to us"),
  p("Support conversations, including anything you put in them. Support chat is not private: our team reads it and we keep it."),

  s("F. Technical"),
  p("Your IP address and basic device and browser information on sign-in and on sensitive actions. We use this to spot somebody else getting into your account, and to tell whether one person is running several accounts."),

  /* ── 3 ─────────────────────────────────────────────────────────── */
  h("3. Why we are allowed to keep it"),
  li([
    "To give you what you paid for — the account, the openings, the items, the shipping. Without this data there is no service.",
    "Because the law requires it — identity checks, anti-money-laundering records, accounting and tax records.",
    "Because we have a legitimate interest in it — stopping fraud, stopping multiple accounts, keeping the site up, and defending ourselves if there is a dispute.",
    "Because you said yes — and only for things you can say no to, like marketing email. You can take that back whenever you want.",
  ]),

  /* ── 4 ─────────────────────────────────────────────────────────── */
  h("4. Who else sees it"),
  p("Only those who need to, and only what they need:"),
  li([
    "Our payment processor, to take a payment and to pay out a redemption. We never see or store your full card number — the processor handles that under its own terms.",
    "The carrier that delivers your order, which gets your name and address and nothing else.",
    "Our hosting and email providers, which hold the data in order to run the service.",
    "Cloudflare, whose Turnstile check runs when you sign up or sign in, to tell a person from a bot.",
    "An authority, when the law obliges us, and only what is asked for.",
  ]),
  p("We do not sell your data and we do not give it to anyone for advertising. If that ever changes it will be with your consent, asked for separately."),
  p("[[LISTA DE ENCARGADOS DEL TRATAMIENTO CON NOMBRE Y PAÍS — a completar antes de publicar]]"),

  /* ── 5 ─────────────────────────────────────────────────────────── */
  h("5. Cookies and what is stored in your browser"),
  p("MR BOX does not set cookies of its own. What it keeps in your browser's local storage is: the token that keeps you signed in, the language you picked, whether you dismissed the bonus banner, and how many demo openings you have used."),
  p("Cloudflare sets its own cookie for the Turnstile check. That is the only third-party storage on the site."),
  p("Clearing your browser storage signs you out and resets those preferences. It does not delete anything on our side."),

  /* ── 6 ─────────────────────────────────────────────────────────── */
  h("6. How long we keep it"),
  p("While your account exists, we keep what the account needs. After it closes, we keep what the law makes us keep — mainly the transaction record and the verification data, for anti-money-laundering and accounting — and delete the rest."),
  p("[[PLAZOS DE CONSERVACIÓN CONCRETOS — dependen de la jurisdicción; a definir con el abogado]]"),

  /* ── 7 ─────────────────────────────────────────────────────────── */
  h("7. Where it lives"),
  p("Our servers are in [[PAÍS/REGIÓN DE LOS SERVIDORES]]. If data is transferred outside your region, it is done with the safeguards the law requires."),
  p("[[MECANISMO DE TRANSFERENCIA INTERNACIONAL — cláusulas contractuales tipo u otro; a definir]]"),

  /* ── 8 ─────────────────────────────────────────────────────────── */
  h("8. What you can ask for"),
  p("Depending on where you live, you can ask us to:"),
  li([
    "show you what we hold about you, and give you a copy",
    "correct something that is wrong",
    "delete what we are not obliged to keep",
    "stop using it for a particular purpose, or limit how we use it",
    "hand it over in a portable form, or send it to someone else",
    "stop sending you marketing, which you can also do from the email itself",
  ]),
  p("Write to [[EMAIL DE PRIVACIDAD]] and we answer within 30 days. We may ask you to prove it is really you, so that nobody else can ask for your data."),
  p("Two honest limits. We cannot delete the transaction record while the law obliges us to keep it. And we cannot delete an account with a pending redemption or a pending shipment before it is resolved."),

  /* ── 9 ─────────────────────────────────────────────────────────── */
  h("9. If you are not happy with our answer"),
  p("Tell us first — most of it is a misunderstanding we can fix. If that does not work, you can complain to your data protection authority. [[AUTORIDAD DE CONTROL CORRESPONDIENTE — a definir]]"),

  /* ── 10 ────────────────────────────────────────────────────────── */
  h("10. Children"),
  p("MR BOX is for people 18 and over. We do not knowingly collect data from anyone younger. If we find that an account belongs to a minor we close it, return what was paid, and delete the data except what we must keep."),

  /* ── 11 ────────────────────────────────────────────────────────── */
  h("11. If this page changes"),
  p("We will post the new version here with a new date. If a change matters to you, we will email you before it takes effect."),
];

export default { ACTUALIZADO, TEXTO };
