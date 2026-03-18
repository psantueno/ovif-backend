export const obtenerFechaActual = () =>
  new Date().toLocaleDateString("sv-SE", {
    timeZone: "America/Argentina/Buenos_Aires",
  });
