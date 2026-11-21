/**
 * ENVIOS.
 *
 * Los Terminos apuntan a esta pagina, asi que tiene que existir: un
 * contrato que remite a una politica que no esta es peor que no
 * remitir a nada.
 *
 * Los umbrales son los de `services/verification` y `Settings`:
 * nivel 2 para que te manden algo, nivel 3 arriba de SC 1.000.
 *
 * Los plazos y los paises a los que se envia estan marcados «[[asi]]»
 * porque dependen del operador logistico que se contrate.
 */
import { h, s, p, li, nota, tabla } from "./bloques";

export const ACTUALIZADO = "2026-11-21";

export const TEXTO = [
  p("How an item gets from your inventory to your door. This page is part of the Terms of Service."),

  nota("Shipping an item is free. What is not free, and is not ours to charge, is what your own country charges to let the parcel in."),

  /* ── 1 ─────────────────────────────────────────────────────────── */
  h("1. Asking for an item"),
  p("An item you win sits in your inventory until you ask us to ship it or sell it back to us. There is no deadline while your account is open and in good standing."),
  p("To ship, you give us a complete address and a phone number for the carrier. We cannot change an address once the parcel is dispatched."),
  p("Your account must be verified to level 2. An order worth more than SC 1,000 needs level 3."),

  /* ── 2 ─────────────────────────────────────────────────────────── */
  h("2. Where we ship"),
  p("[[PAÍSES A LOS QUE SE ENVÍA — a definir con el operador logístico]]"),
  p("Some items cannot be sent everywhere: anything with a lithium battery, a liquid, a fragrance or an aerosol is restricted by air carriers, and some countries will not let certain goods in at all. If yours is one of those, we will tell you and you can take its value in SC instead."),

  /* ── 3 ─────────────────────────────────────────────────────────── */
  h("3. What it costs"),
  p("We pay the shipping. You pay whatever your own country charges to import the parcel."),

  s("Import duty, VAT and handling"),
  p("Unless an import charge is shown and paid at checkout, you are the importer of record. Import VAT, customs duty, brokerage and the carrier's handling fee in the destination country are yours. They are set by your authorities and by the carrier, not by us, and the parcel may be held until they are paid."),
  p("We declare the real value of what is inside and the real contents. We do not under-declare and we do not mark a parcel as a gift. Asking us to is asking us to help you commit customs fraud, and we will not."),
  p("If the import charges for your destination would be out of proportion to what the item is worth, we will tell you before dispatch and give you the choice: pay them yourself, or take the item's value in SC."),

  /* ── 4 ─────────────────────────────────────────────────────────── */
  h("4. How long"),
  tabla([
    ["We prepare the order", "Up to 72 hours"],
    ["We dispatch it", "Within 14 days of the order being confirmed"],
    ["It arrives", "[[PLAZO DE ENTREGA POR REGIÓN — a definir]]"],
  ]),
  p("These are estimates, not promises. Customs, weather, strikes and the carrier's own backlog are outside our control. Items that have to be sourced, or that are high value, take longer, and we will tell you when."),
  p("You get a tracking number when the parcel is dispatched."),

  /* ── 5 ─────────────────────────────────────────────────────────── */
  h("5. When it does not arrive"),

  s("A. Lost"),
  p("If tracking stops moving or the parcel does not turn up, write to support@mrbox.gg. We open a claim with the carrier. Carriers will not treat a parcel as lost until a waiting period has passed — usually [[PLAZO PARA RECLAMO AL TRANSPORTISTA]] — so there is a wait before we can act. Once it is confirmed lost, you get the item again if we can source it, or its value in SC."),

  s("B. Damaged or faulty"),
  p("Tell us within 14 days of delivery and send photographs of the item and of the packaging. We may ask you to send it back, at our cost, before we replace it or credit you. If it turns out to be fine, we send it back and nothing is credited."),
  p("Nothing here takes away the rights you have as a consumer where you live, including about goods that are faulty or not as described."),

  s("C. Nobody took delivery"),
  p("If you are not there, do not collect it from the depot, and do not pay a charge you owe so it can be released, the carrier will send it back to us or customs will dispose of it."),
  p("If it comes back, we can try again at your cost, or credit you the item's value less what the failed delivery actually cost us — return shipping, storage, duty already paid. That can come to nothing. Please collect your parcels."),

  /* ── 6 ─────────────────────────────────────────────────────────── */
  h("6. When we cannot send the item"),
  p("If we cannot source it, we will tell you and you will get its value in SC, or a different item worth the same or more. Where it is practical, you choose."),
  p("Until the parcel is delivered to you the item is still ours, and the risk of it being lost or damaged is ours. Both pass to you on delivery."),

  /* ── 7 ─────────────────────────────────────────────────────────── */
  h("7. Changing your mind"),
  p("Items are shipped on request, not sold as a separate purchase, so there is no order to cancel once it is dispatched. Before dispatch, write to us and we will stop it and put the item back in your inventory."),
  p("What happens with money is in the Refund Policy."),
];

export default { ACTUALIZADO, TEXTO };
