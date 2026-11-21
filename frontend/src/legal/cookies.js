/**
 * COOKIES.
 *
 * Esta es cortita y es la verdad: MR BOX hoy no pone NI UNA cookie.
 * Lo comprobe buscando `document.cookie` y `res.cookie` en todo el
 * repo y no hay ninguno, y en el `index.html` no hay un solo script
 * de terceros.
 *
 * Lo que si hay es `localStorage` con cuatro cosas, y la cookie que
 * pone Cloudflare para el captcha.
 *
 * Decirlo asi vale mas que una politica de cookies de plantilla con
 * una tabla de "cookies analiticas" que no existen: si manana entra
 * Google Analytics, se nota que esta pagina hay que cambiarla. Una
 * plantilla generica ya las nombraba y nadie se enteraria.
 */
import { h, p, li, nota, tabla } from "./bloques";

export const ACTUALIZADO = "2026-11-21";

export const TEXTO = [
  nota("MR BOX does not set any cookies of its own, and there is no tracking or advertising script anywhere on this site."),

  /* ── 1 ─────────────────────────────────────────────────────────── */
  h("1. What we store in your browser"),
  p("Instead of cookies we use local storage, which works the same way for you — it stays on your device — but is never sent along with a request. Four things live there:"),

  tabla([
    ["Your session", "The token that keeps you signed in. Clearing it signs you out."],
    ["Your language", "Which of the nine languages you chose."],
    ["The bonus banner", "Whether you dismissed it, so it does not come back on every page."],
    ["Demo openings", "How many of your free demo openings you have used, for when you are not signed in."],
  ]),

  p("None of it is used to follow you around, none of it is shared, and none of it leaves your device except the session token, which your browser sends to us so we know it is you."),

  /* ── 2 ─────────────────────────────────────────────────────────── */
  h("2. The one cookie that is set"),
  p("When you sign up or sign in, Cloudflare Turnstile runs a check to tell a person from a bot. Cloudflare sets its own cookie to do it. It is strictly necessary — without it we cannot protect the sign-in form — and it is Cloudflare's, under their privacy terms, not ours."),

  /* ── 3 ─────────────────────────────────────────────────────────── */
  h("3. Why there is no cookie banner"),
  p("Because there is nothing to consent to. A banner is required when a site stores things that are not strictly necessary — analytics, advertising, profiling. We do not. The four items above are what makes the site work for you, and the Turnstile check is what keeps bots out."),
  p("The day we add anything that is not strictly necessary, we will ask you first, and this page will say so before it happens."),

  /* ── 4 ─────────────────────────────────────────────────────────── */
  h("4. How to clear it"),
  p("Your browser's settings, under site data or storage, for this site. You can also use a private window, where nothing is kept after you close it."),
  p("Clearing it signs you out, forgets your language, and brings the bonus banner back. It does not delete anything on our side — what we hold is in the Privacy Policy."),

  /* ── 5 ─────────────────────────────────────────────────────────── */
  h("5. What we do not do"),
  li([
    "We do not use Google Analytics or any other analytics product.",
    "We do not use an advertising pixel from Facebook, TikTok, Google or anyone else.",
    "We do not build a profile of you to sell or to target.",
    "We do not let a third party run a script on this site, other than the Turnstile check described above.",
  ]),
  p("If any of that changes, this page changes with it, on the same day."),
];

export default { ACTUALIZADO, TEXTO };
