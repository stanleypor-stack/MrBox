/**
 * LOS ATAJOS DE LA CUENTA.
 *
 * La lista que sale del avatar, arriba a la derecha en la computadora y
 * del último botón de la barra de abajo en el teléfono. Son los MISMOS
 * en los dos lados: estaba escrita dos veces y la de la computadora se
 * había quedado con dos atajos de los diez.
 *
 * Casi todos llevan a una pestaña del perfil, no a una pantalla nueva:
 * el perfil YA tiene esas pestañas, y una pantalla aparte por cada una
 * sería la misma tabla dos veces en dos lugares distintos.
 */
export const ATAJOS = [
  { id: "wallet", texto: "nav.wallet", icono: "M3 7a2 2 0 0 1 2-2h12v4M3 7v10a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2z" },
  { id: "inventario", texto: "nav.inventory", icono: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" },
  { id: "orders", texto: "profile.orders", icono: "M1 4h14v12H1zM15 9h4l4 4v3h-8z" },
  { id: "perfil", texto: "nav.profile", icono: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8a2 2 0 1 1-2.8 2.8a1.7 1.7 0 0 0-2.8 1.4V21a2 2 0 1 1-4 0a1.7 1.7 0 0 0-2.9-1.2a2 2 0 1 1-2.8-2.8A1.7 1.7 0 0 0 3 14H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9a2 2 0 1 1 2.8-2.8A1.7 1.7 0 0 0 10 3V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2a2 2 0 1 1 2.8 2.8A1.7 1.7 0 0 0 21 10H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" },
  { id: "verificacion", texto: "nav.verification", icono: "M3 5h18v14H3zM7 10h4M7 14h6M15 9h3v4h-3z" },
  { id: "direcciones", texto: "profile.addresses", icono: "M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" },
  { id: "movimientos", texto: "profile.transactions", icono: "M6 2h12v20l-3-2-3 2-3-2-3 2zM9 7h6M9 11h6M9 15h4" },
  { id: "historial", texto: "profile.history", icono: "M6 2h12M6 22h12M7 2c0 5 10 5 10 10S7 17 7 22M17 2c0 5-10 5-10 10s10 5 10 10" },
  { id: "actividad", texto: "profile.activity", icono: "M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 3" },
  { id: "recompensas", texto: "nav.rewards", icono: "M20 12v9H4v-9M2 7h20v5H2zM12 21V7" },
  { id: "refer", texto: "profile.refer", icono: "M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" },
  { id: "controles", texto: "profile.controls", icono: "M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" },
];

/* El atajo "orders" es la seccion "pedidos"; los demas se llaman igual. */
export const SECCION = { orders: "pedidos" };

/**
 * A DONDE VA CADA ATAJO.
 *
 * Devuelve qué hacer, para que cada menú lo haga a su manera: la
 * billetera abre un cajón, las recompensas son una pantalla y el resto
 * son pedazos del perfil.
 *
 * @returns {{ que: "wallet" | "ruta" | "perfil", a?: string }}
 */
export function aDonde(id) {
  if (id === "wallet") return { que: "wallet" };
  if (id === "inventario") return { que: "ruta", a: "/inventory" };
  if (id === "recompensas") return { que: "ruta", a: "/rewards" };
  return { que: "perfil", a: SECCION[id] || id };
}
