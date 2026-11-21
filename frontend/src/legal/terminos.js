/**
 * LOS TERMINOS DE SERVICIO DE MR BOX.
 *
 * ESTAN EN INGLES A PROPOSITO
 *
 * El sitio esta en nueve idiomas y los textos salen de un generador.
 * Un contrato no puede salir de ahi: una traduccion automatica de una
 * clausula de limitacion de responsabilidad es una clausula distinta,
 * y la que vale termina siendo la que diga el juez del pais del que
 * reclama. Asi que hay UNA version, en ingles, y la clausula 21.D dice
 * que esa es la que manda. Es lo que hacen mrloot y luxdrop.
 *
 * LO QUE DICE ACA TIENE QUE SER LO QUE HACE EL CODIGO
 *
 * Los numeros no son de relleno: el 92% de retorno, el tope de premio
 * de SC 300.000, la recompra al 100%, el minimo de canje de SC 50 con
 * nivel 2, el envio sobre SC 1.000 con nivel 3, las 3 aperturas de
 * prueba, el 50% del margen del creador y las cajas de 5 a 20 objetos
 * salen todos de `Settings`. Si alguien cambia una perilla, esto
 * queda mintiendo: por eso cada numero esta marcado con un comentario
 * que dice de donde sale.
 *
 * LO QUE FALTA DECIDIR ESTA MARCADO
 *
 * Todo lo que empieza con «[[» es una decision de Dani o de su
 * abogado: la razon social, la direccion, la ley que rige, los paises
 * excluidos. No las invento. `scripts/exportarLegales.js` las lista.
 *
 * ESTO NO ES ASESORAMIENTO LEGAL. Lo tiene que revisar un abogado
 * antes de publicarse.
 */

/* Las perillas que se nombran en el texto, para que se vea de un
   vistazo contra que hay que cotejarlo (ver Settings en el backend). */
export const NUMEROS_QUE_SE_NOMBRAN = {
  "retornoObjetivo": "92%",
  "topePremioSc": "SC 300,000",
  "tasaDeRecompra": "100%",
  "canjeMinimoSc": "SC 50",
  "canjeNivelMinimo": "level 2",
  "envioQuePideNivel3Sc": "SC 1,000",
  "aperturasDeDemo": "3",
  "aperturasDeRegalo": "3",
  "cajasALaVez": "6",
  "parteDelCreador": "50%",
  "objetosPorCajaDeComunidad": "5 to 20",
  "bonoPorDeposito": "5% / 10%",
  "vecesAJugarElBono": "1x",
};

export const ACTUALIZADO = "2026-11-21";

const h = (texto) => ({ t: "h2", texto });
const s = (texto) => ({ t: "h3", texto });
const p = (texto) => ({ t: "p", texto });
const li = (items) => ({ t: "ul", items });
const nota = (texto) => ({ t: "nota", texto });

export const TERMINOS = [
  p("Please read these Terms before you use MR BOX. By creating an account, buying SC, or opening a box, you agree to them."),

  nota("MR BOX is a shop, not a casino. Every box you open gives you an item. The chance of each item is published on the box page before you pay, and you can check afterwards that the draw was not tampered with."),

  /* ── 1 ─────────────────────────────────────────────────────────── */
  h("1. Who we are and what MR BOX is"),

  s("A. The company"),
  p("MR BOX is operated by [[RAZÓN SOCIAL]], registered in [[PAÍS]] under number [[Nº DE REGISTRO]], with registered address at [[DIRECCIÓN]]. In these Terms, \"MR BOX\", \"we\", \"us\" and \"our\" mean that company, and your agreement is with it. You can reach us at [[EMAIL DE SOPORTE]] or through the chat on the site."),

  s("B. What we sell"),
  p("MR BOX is an online shop for mystery boxes. You buy site credit called SC, you spend SC to open a box, and the box gives you an item from a published list. Items are real goods: we ship them to you, or you can sell them back to us for SC."),
  p("We are not a gambling service. We do not take bets, we do not run casino games, and we do not run a lottery. Every box opening returns an item — there is no outcome where you pay and receive nothing. The list of items in a box, and the chance of each one, is shown on the box page before you pay."),
  p("MR BOX is entertainment and shopping. It is not an investment, a savings product or a way to make money, and you must not use it as one. The items in a box are worth less, on average, than the box costs: across all openings of a box, the total value of what comes out is about 92% of what goes in. You should expect to spend more than you get back."),
  p("It is your responsibility to check that using MR BOX is lawful where you live. We make no promise that it is."),

  s("C. These Terms, and changes to them"),
  p("These Terms, together with our Privacy Policy, Cookie Policy, Shipping Policy and any rules shown on a specific feature, are the whole agreement between you and us."),
  p("We may change these Terms. If a change materially affects your rights, we will post a notice on the site and email you, and it takes effect 14 days later. Other changes take effect when posted. Changes are not retroactive: they do not affect SC you have already bought or items you have already won. The date at the top of this page tells you when it last changed."),
  p("If you do not accept a change, stop using the site and close your account as described in section 2.D."),

  /* ── 2 ─────────────────────────────────────────────────────────── */
  h("2. Your account"),

  s("A. Who can open one"),
  p("You must be at least 18 years old, and old enough to enter a binding contract where you live. One account per person. Creating more than one account may cost you all of them, along with any SC and items in them."),
  p("Everything you tell us must be true, and you must keep it up to date. If you give us false information we may suspend or close your account."),

  s("B. Verification"),
  p("We verify identity on a risk basis. We may ask for government ID, proof of address, a liveness check, proof that you own the payment method you used, or an explanation of where your funds came from. We may ask before or after a transaction."),
  p("Verification is always required before you redeem SC for cryptocurrency, and before we ship an order worth more than SC 1,000. We may also require it at any other point."),
  p("If we ask and you do not complete verification, we may refuse or reverse the transaction and return the money to where it came from. Any SC or bonus credited for that transaction is then cancelled."),
  p("You must pay with a method that belongs to you. Paying with someone else's card, account or wallet is not allowed."),

  s("C. Keeping it yours"),
  p("Do not share your password, do not let anyone else use your account, and do not sell, lend or transfer it. Anything done from your account is treated as done by you, and we are not liable for losses caused by someone else getting in."),
  p("Tell us straight away at [[EMAIL DE SOPORTE]] if you think somebody has access to your account."),

  s("D. Closing it"),
  p("You can close your account whenever you want, by writing to [[EMAIL DE SOPORTE]]. Before you do, redeem or ship what you have: unused SC is not refundable except as set out in section 3.D, and items left in your inventory are forfeited when the account closes."),
  p("We can suspend or close your account too. If we close it because you broke these Terms, section 16 applies and you may lose your SC and items. If we close it for any other reason, we will ship or redeem what you are owed first."),

  /* ── 3 ─────────────────────────────────────────────────────────── */
  h("3. SC, the site credit"),

  s("A. What SC is"),
  p("SC is credit that only works inside MR BOX. It is not money, not electronic money, not a deposit and not a payment account. We do not hold money for you and we do not pay interest on an SC balance."),
  p("SC is shown with a currency symbol so that prices are easy to read, and 1 SC is displayed as 1 US dollar. That is a display convention. It does not make SC money and it does not give you a right to receive dollars."),
  p("SC can be spent on opening boxes and on the other paid features of the site. It cannot be transferred to another player, sold, or given away."),

  s("B. Buying SC"),
  p("You buy SC with the payment methods shown at checkout. The price is shown before you pay. Payments are handled by independent payment processors; we never see or store your full card number, and their own terms apply to the payment itself."),
  p("If a payment fails, is reversed or never settles, the SC credited for it is cancelled and removed from your balance."),

  s("C. Bonuses"),
  p("A deposit may come with a bonus — currently 5% on a normal deposit and 10% on a featured one. Bonus SC must be played through once before the balance it is part of can be redeemed. Every promotion shows its own rules next to it, and those rules win over this paragraph if they disagree."),
  p("Free openings, gift boxes, promotional codes and similar offers are one per person unless they say otherwise, and we may change or withdraw them for the future at any time."),

  s("D. What SC cannot do"),
  p("SC cannot be withdrawn as money. The only ways SC leaves your account are: spending it on the site, or redeeming it for cryptocurrency under section 7."),
  p("If you are a consumer in the EU or EEA: SC is digital content delivered immediately. By paying, you ask us to deliver it immediately and you accept that you lose the 14-day right of withdrawal under Article 16(m) of Directive 2011/83/EU for that purchase. This does not affect your rights if something we sell you is faulty."),
  p("Where a payment was duplicated or charged in error, we refund the excess to the original payment method."),

  /* ── 4 ─────────────────────────────────────────────────────────── */
  h("4. Opening boxes"),

  s("A. You always get something"),
  p("Every opening gives you exactly one item from that box's list. There is no empty outcome. The item may be worth far less than the box cost, and usually will be."),
  p("You can open up to 6 boxes at once. Each one is a separate opening with its own draw."),

  s("B. The odds are published"),
  p("Every box page lists every item it can give and the chance of each, before you pay. The chances add up to 100%. We can change what is in a box or what it costs at any time, but the change applies to openings after it, never to one you already paid for."),
  p("The animation that plays while a box opens is decoration. The items that scroll past are a sample of the box, not the draw, and the draw is already decided by the server before the animation starts."),

  s("C. Provably fair"),
  p("Every opening is decided by HMAC-SHA256 using a server seed as the key and your client seed plus a counter as the message. We publish the hash of the server seed before you play, so we cannot change it afterwards, and we show you the seeds and the counter after the fact so you can repeat the calculation yourself. The method is described in full on the Provably Fair page."),
  p("You can change your client seed whenever you want."),

  s("D. Free and demo openings"),
  p("New accounts get 3 demo openings. A demo draws a real item with the real odds, but nothing is charged and nothing is kept: it is there to show you what the box does. Demo results are not items and cannot be shipped, sold or redeemed."),
  p("We may also give out free openings or gift boxes. Those are real openings and what comes out is yours, subject to the rest of these Terms."),

  s("E. The payout cap"),
  p("No single item in a box is worth more than SC 300,000."),

  /* ── 5 ─────────────────────────────────────────────────────────── */
  h("5. The items you win"),

  s("A. Your inventory"),
  p("An item you win sits in your inventory until you do one of two things with it: ask us to ship it, or sell it back to us. Items do not expire while your account is open and in good standing."),

  s("B. Selling it back"),
  p("You can sell an item back to us for SC at the value shown for it, currently 100% of its stated value. This is us buying the item back, not a withdrawal: you receive SC, which is subject to all the SC rules in section 3."),
  p("Selling back is final. Once you have sold an item you cannot get it back."),

  s("C. What \"stated value\" means"),
  p("The value shown against an item is the value we assign to it for use inside MR BOX. It is what we will buy it back for and what it counts as in box pricing. It is not a market price, a retail price or an appraisal, and it may be higher or lower than what the same item sells for elsewhere."),
  p("We may update stated values. The value that applies to a sell-back is the one shown at the moment you sell."),

  /* ── 6 ─────────────────────────────────────────────────────────── */
  h("6. Shipping"),

  s("A. Asking for delivery"),
  p("To have an item shipped, give us a complete and correct delivery address. If the address is wrong or incomplete we may cancel the order or charge the cost of sorting it out. Orders over SC 1,000 require level 3 verification before they are dispatched."),

  s("B. Duties, taxes and import charges"),
  p("Items may be shipped from outside your country. Unless an import charge is shown and paid at checkout, you are the importer of record: import VAT, duties, customs brokerage and carrier handling fees in the destination country are yours to pay. Those charges are set by your country's authorities and by the carrier, not by us, and the parcel may be held until they are paid."),
  p("We declare the real value of what we ship. We do not under-declare and we do not mark parcels as gifts."),
  p("If, before we dispatch, the import charges or compliance cost for your destination turn out to be out of proportion to the item's stated value, or the item cannot lawfully be imported where you are, we will tell you and offer you either to pay those charges yourself or to take the item's stated value in SC instead."),

  s("C. How long it takes"),
  p("Delivery estimates are estimates. We aim to dispatch within 14 days of a confirmed order; total delivery time depends on the carrier and on customs and can be longer. High-value items may take longer and we will tell you when."),

  s("D. Lost, damaged or faulty"),
  p("If a parcel does not arrive, write to [[EMAIL DE SOPORTE]] and we will chase the carrier. If what arrives is damaged or faulty, write to us within 14 days of delivery with photographs; we may ask you to send the item back at our cost before we replace it or credit you. If the item turns out to be fine, we will send it back to you and no credit is due."),
  p("Nothing here takes away the rights you have as a consumer where you live, including rights about goods that are faulty or not as described."),

  s("E. If you do not take delivery"),
  p("If you are not there, do not collect, and do not pay a charge you owe, the parcel may come back to us or be destroyed by the carrier or customs. If that happens we may try again at your cost, or credit you the item's stated value less what the failed delivery actually cost us, which can leave nothing."),

  s("F. Out of stock and substitutes"),
  p("If we cannot source an item you have asked us to ship, we will tell you and you will get either the item's stated value in SC or a different item of the same or greater stated value, at your choice where practical."),

  s("G. Title and risk"),
  p("The item stays ours until it is delivered to you. Risk of loss or damage passes to you on delivery."),

  /* ── 7 ─────────────────────────────────────────────────────────── */
  h("7. Redeeming SC"),

  s("A. How it works"),
  p("You can redeem SC for cryptocurrency once your account is verified to level 2 and your balance is at least SC 50. The currencies and networks available, the network's own minimum, and any fee are shown before you confirm."),
  p("Bonus SC must be played through before the balance it is part of can be redeemed."),

  s("B. The wallet has to be yours"),
  p("Redemptions go to a wallet you own. We do not send to third-party wallets, and we may ask you to prove the wallet is yours. We screen destination addresses and may refuse one."),

  s("C. Cryptocurrency is one-way"),
  p("A cryptocurrency transfer cannot be reversed. If you give us a wrong address, or an address on the wrong network, the funds are gone and we cannot recover them. Check the address and the network before you confirm."),
  p("Cryptocurrency prices move. The amount of cryptocurrency you receive is worked out at the moment the redemption is processed, and its value afterwards is not our responsibility."),

  s("D. How long it takes"),
  p("Redemptions are reviewed before they are paid. Most are processed within [[PLAZO DE CANJE]]; one that triggers a verification or compliance check takes longer. We will tell you if yours does."),

  /* ── 8 ─────────────────────────────────────────────────────────── */
  h("8. Community boxes"),

  s("A. Making one"),
  p("You can build a box from items in our catalogue: between 5 and 20 of them, and you set how often each one comes out. You do not set the price. The price is calculated from what you put in, so that the box returns the same share to players as any of ours."),

  s("B. We review it before it goes live"),
  p("A community box is checked by us before anyone can open it, and we can refuse it or take it down later without giving a reason. Editing a live box takes it off the air until it is reviewed again."),
  p("You are responsible for the name and description you give your box. Do not use anyone else's trademark, do not imply we endorse you, and do not claim odds or values other than the ones the site shows."),

  s("C. What you earn"),
  p("When somebody else opens your box, you receive 50% of the margin that opening produced — the price of the box less the value of the item that came out. The other half is ours."),
  p("Margin is accumulated per box. When a box pays out an expensive item the accumulated margin can go negative; while it is negative you earn nothing, and your share resumes once it is positive again. You never owe us money: your share is never negative."),
  p("You do not earn anything from opening your own box."),
  p("Your share is credited as SC and is subject to section 3."),

  s("D. What we can undo"),
  p("If a box, or an opening of it, was produced by abuse — several accounts, a bug, a pricing error, or anything else in section 12 — we can cancel the box, reverse the share paid for it, and apply section 16."),

  /* ── 9 ─────────────────────────────────────────────────────────── */
  h("9. Races, challenges, rewards and ranks"),
  p("We run races, daily challenges, rank rewards and similar features. Each one shows its own rules, its prize and its dates where you take part, and those rules are part of these Terms."),
  p("We can change, pause or end any of them for the future. If we cancel one that is already running, players who have taken part get back what they put in, where anything was put in."),
  p("Prizes are credited as SC or as items unless the feature says otherwise. Where a race needs a minimum number of players to run and it is not reached, the race does not pay out and anything staked is returned."),

  /* ── 10 ────────────────────────────────────────────────────────── */
  h("10. The affiliate programme"),
  p("If we accept you as an affiliate, you get a code and earn on the players who sign up with it, under the model and rate agreed with you and shown in your dashboard."),
  p("You may not: bid on our brand name in paid search, spam, send unsolicited email, refer yourself or people you control, promote us to anyone under 18, promote us in a country where we do not accept players, describe MR BOX as gambling, or promise returns. Doing any of these ends the deal and forfeits unpaid commission."),
  p("We can change rates and models for the future, and we can close a programme account. Commission on a player found to be fraudulent, self-referred or charged back is reversed."),

  /* ── 11 ────────────────────────────────────────────────────────── */
  h("11. Fair play"),
  p("You must not:"),
  li([
    "open more than one account, or use somebody else's",
    "use bots, scripts, or automate any part of the site",
    "exploit a bug, a glitch or an obvious pricing mistake — including carrying on once you have noticed one",
    "abuse promotions, including by making accounts to claim free openings",
    "use someone else's payment method, or money that is not yours",
    "try to break, overload, scrape or reverse-engineer the site",
    "harass other players or our staff, in chat or anywhere else",
    "resell access to your account or to the site",
  ]),
  p("If you find a bug, tell us at [[EMAIL DE SOPORTE]] instead of using it. We would rather fix it."),

  /* ── 12 ────────────────────────────────────────────────────────── */
  h("12. Mistakes"),
  p("If a box, an item or a price is shown wrong because of an obvious error — a typo, a wrong conversion, a catalogue mistake — we may cancel the affected openings and put you back where you were: you get back the SC you paid. We will tell you when we do this and why."),
  p("If we credit you SC, an item or a benefit by mistake, it stays ours. If you have already spent it, you owe us the value and we may take it from your balance. Tell us if you notice something credited that should not be."),
  p("Report a billing error within 30 days. After that we treat the charge as correct, except where the law says otherwise."),

  /* ── 13 ────────────────────────────────────────────────────────── */
  h("13. Chargebacks"),
  p("If you think a charge is wrong, write to us first at [[EMAIL DE SOPORTE]]. We answer within 7 business days and refund to the original payment method where you are right."),
  p("Starting a chargeback on a purchase you authorised and received, without contacting us first, is a serious breach of these Terms. We may close the account and any connected ones, cancel the SC and items that came from the disputed payment, hold any pending shipment, and recover the amount and the fees from your balance."),
  p("None of this limits your right to dispute a payment you genuinely did not authorise."),

  /* ── 14 ────────────────────────────────────────────────────────── */
  h("14. Playing responsibly"),
  p("MR BOX is meant to be fun. It is not a way to make money and it should not be used to try to win back what you have spent."),
  p("You can set a daily spending limit or a daily loss limit on your account, or take a break for a period you choose. While a break is running you cannot open boxes, and we will not credit deposits, promotions or rewards to your account either — a break that still takes your money is not a break."),
  p("A limit you tighten applies immediately; a limit you loosen, and the end of a break, take effect only after a cooling-off period. We do this on purpose."),
  p("If you want help, write to [[EMAIL DE SOPORTE]] and we will close your account. [[RECURSOS DE AYUDA AL JUGADOR — a definir con el abogado]]"),

  /* ── 15 ────────────────────────────────────────────────────────── */
  h("15. Where we do not operate"),
  p("You may not use MR BOX if you are in, or a resident of, [[PAÍSES EXCLUIDOS]], or if you are on a sanctions list. Payments from those places are declined or refunded."),
  p("You may not use a VPN, a proxy or false information to get around this. If you do, we may close the account and section 16 applies."),

  /* ── 16 ────────────────────────────────────────────────────────── */
  h("16. Suspension and forfeiture"),
  p("If we find that SC, an item or a benefit came from fraud, from a bug, from bonus abuse, from several accounts, or from any other breach of section 11, we may cancel it along with anything derived from it, hold any pending shipment, and suspend or close the account and any connected ones."),
  p("Where we close an account for a breach, SC and items in it are forfeited. Where we close an account for any other reason, they are not: we will ship or redeem what you are owed."),
  p("We will tell you what we found, unless telling you would get in the way of an investigation or we are not allowed to."),

  /* ── 17 ────────────────────────────────────────────────────────── */
  h("17. Brands and intellectual property"),
  p("MR BOX, our logo and everything on the site — text, pictures, code, design — belongs to us or to the people who licensed it to us. You may use it to use the site, and not for anything else."),
  p("The brands of the products we sell belong to their owners. MR BOX is independent: we are not affiliated with, endorsed by or sponsored by any of them, and we show their names and logos only to say which product is which."),
  p("Anything you post on the site — a chat message, a box you build, a name you choose — you let us use, show and keep showing in connection with running and promoting MR BOX. You keep owning it, and you promise it is yours to post."),

  /* ── 18 ────────────────────────────────────────────────────────── */
  h("18. Your data"),
  p("What we collect and why is in our Privacy Policy, which is part of these Terms. Chat is not private: we can read it, keep it, and act on it."),

  /* ── 19 ────────────────────────────────────────────────────────── */
  h("19. What we do not promise, and what we are liable for"),
  p("The site is provided as it is. We do not promise it will be available without interruption, free of bugs, or that any item will be in stock."),
  p("We are responsible for what we get wrong. We are not responsible for: what a payment processor, carrier, customs authority or blockchain network does; the value of an item changing; a cryptocurrency transfer you sent to the wrong address; or your use of the site where it is not lawful for you."),
  p("Where we are liable, our liability for any claim is limited to the greater of the amount you spent on MR BOX in the 6 months before the claim, or [[TOPE DE RESPONSABILIDAD]]. We do not limit liability for death or personal injury caused by our negligence, for fraud, or for anything else the law does not let us limit."),
  p("Nothing in these Terms takes away rights you have as a consumer that cannot be taken away by agreement."),

  /* ── 20 ────────────────────────────────────────────────────────── */
  h("20. If something goes wrong between us"),
  p("Write to us first at [[EMAIL DE SOPORTE]]. We answer complaints within [[PLAZO DE RESPUESTA A RECLAMOS]] and we would rather sort it out than argue about it."),
  p("These Terms are governed by the law of [[JURISDICCIÓN]], and the courts of [[JURISDICCIÓN]] have jurisdiction, except where the law of your country as a consumer gives you the right to go to your own courts, which it may."),
  p("[[EU: enlace a la plataforma de resolución de litigios en línea — a confirmar con el abogado]]"),
  p("[[EE.UU.: arbitraje y renuncia a demanda colectiva — a decidir con el abogado]]"),

  /* ── 21 ────────────────────────────────────────────────────────── */
  h("21. The rest"),

  s("A. The whole agreement"),
  p("These Terms, with the policies they refer to, are everything that was agreed. They replace anything said before."),

  s("B. If a part fails"),
  p("If a court decides a clause does not work, the rest still stands."),

  s("C. Not giving something up"),
  p("If we do not enforce something straight away, we have not given it up."),

  s("D. Language"),
  p("These Terms are written in English. Translations are provided to help you read them; if a translation and the English disagree, the English version is the one that applies."),

  s("E. Transferring this agreement"),
  p("You cannot transfer your account or this agreement. We can transfer it to a company that takes over our business, as long as your rights are not reduced."),

  s("F. Notices"),
  p("We write to you at the email on your account, or through the site. Write to us at [[EMAIL DE SOPORTE]]."),

  s("G. Things outside anyone's control"),
  p("We are not liable for failing to do something because of an event beyond our reasonable control, for as long as it lasts."),

  s("H. No partnership"),
  p("Using MR BOX, including as an affiliate or as a community-box creator, does not make you our employee, partner or agent."),
];

export default { ACTUALIZADO, TERMINOS, NUMEROS_QUE_SE_NOMBRAN };
