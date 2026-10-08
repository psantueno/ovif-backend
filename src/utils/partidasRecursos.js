/*
Reglas puras del catálogo de partidas de recursos (sin acceso a base), para
poder testearlas aisladas.

Estructura del código (Manual de Clasificaciones Presupuestarias de Neuquén,
clasificador de recursos por rubro): 8 dígitos
  TT C K SS 00
  TT = tipo, C = clase, K = concepto, SS = subconcepto, 00 = sin uso.
El padre se deduce poniendo en cero el último campo no nulo; los tipos
(TT000000) tienen padre 0.
*/

export const CODIGO_MIN = 10000000;
export const CODIGO_MAX = 99999999;

export const NIVEL_TIPO = 1;
export const NIVEL_CLASE = 2;
export const NIVEL_CONCEPTO = 3;
export const NIVEL_SUBCONCEPTO = 4;

export const esCodigoPartidaValido = (codigo) =>
  Number.isInteger(codigo) && codigo >= CODIGO_MIN && codigo <= CODIGO_MAX && codigo % 100 === 0;

export const nivelPartida = (codigo) => {
  if (codigo % 10000 !== 0) return NIVEL_SUBCONCEPTO;
  if (codigo % 100000 !== 0) return NIVEL_CONCEPTO;
  if (codigo % 1000000 !== 0) return NIVEL_CLASE;
  return NIVEL_TIPO;
};

/** Padre que corresponde por estructura de código (0 para los tipos). */
export const derivarPadre = (codigo) => {
  if (codigo % 10000 !== 0) return codigo - (codigo % 10000);
  if (codigo % 100000 !== 0) return codigo - (codigo % 100000);
  if (codigo % 1000000 !== 0) return codigo - (codigo % 1000000);
  return 0;
};

/** El subconcepto es el último nivel: no admite aperturas. */
export const admiteHijas = (codigo) => nivelPartida(codigo) < NIVEL_SUBCONCEPTO;

// Juego de caracteres de la columna (latin1 de MariaDB = cp1252): los
// caracteres fuera de este conjunto fallan al guardar en modo estricto.
const CP1252_EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");

export const esRepresentableEnLatin1 = (texto) => {
  for (const caracter of String(texto)) {
    const punto = caracter.codePointAt(0);
    if (punto === 0x09 || punto === 0x0a || punto === 0x0d) continue;
    if (punto >= 0x20 && punto <= 0x7e) continue;
    if (punto >= 0xa0 && punto <= 0xff) continue;
    if (CP1252_EXTRA.has(caracter)) continue;
    return false;
  }
  return true;
};

/** Fila del modelo -> objeto plano estable que se guarda en la auditoría. */
export const snapshotPartida = (fila) => {
  if (!fila) return null;
  const datos = typeof fila.get === "function" ? fila.get({ plain: true }) : fila;
  return {
    codigo: Number(datos.partidas_recursos_codigo),
    descripcion: datos.partidas_recursos_descripcion,
    padre: Number(datos.partidas_recursos_padre),
    sl: Boolean(datos.partidas_recursos_sl),
    carga: Boolean(datos.partidas_recursos_carga),
    activo: datos.activo === undefined ? true : Boolean(datos.activo),
  };
};

export const CAMPOS_AUDITADOS = ["codigo", "descripcion", "padre", "sl", "carga", "activo"];

/** Campos que cambiaron entre dos snapshots: [{ campo, anterior, nuevo }]. */
export const calcularCambios = (antes, despues) => {
  if (!antes || !despues) return [];
  return CAMPOS_AUDITADOS
    .filter((campo) => antes[campo] !== despues[campo])
    .map((campo) => ({ campo, anterior: antes[campo], nuevo: despues[campo] }));
};

const MAX_SEGMENTOS_HISTORIAL = 20;

const esOrigen = (fila) => fila.accion === "ALTA" || fila.partida_codigo_anterior !== null && fila.partida_codigo_anterior !== undefined;

/**
 * Historial completo de la partida que hoy tiene `codigo`, siguiendo los
 * cambios de código hacia atrás sin mezclar partidas que reutilizaron un
 * código liberado.
 *
 * Para cada código se toman las filas desde su "origen" (ALTA, o el cambio
 * de código que lo introdujo) hasta el corte del tramo siguiente. Si el
 * origen es un cambio de código, se continúa con el código anterior,
 * cortando en el id de ese cambio. Las partidas previas al ABM no tienen
 * ALTA: en ese caso se toman todas las filas anteriores al corte.
 *
 * @param {number} codigo código actual de la partida
 * @param {(codigo: number) => Promise<Array>} cargarFilas filas de auditoría
 *   del código (cualquier orden), con id, accion y partida_codigo_anterior
 * @returns {Promise<Array>} filas ordenadas por id descendente
 */
export const reconstruirHistorialPartida = async (codigo, cargarFilas) => {
  const resultado = [];
  let codigoTramo = codigo;
  let corte = Infinity;

  for (let i = 0; i < MAX_SEGMENTOS_HISTORIAL && codigoTramo !== null; i += 1) {
    const filas = (await cargarFilas(codigoTramo))
      .filter((fila) => fila.id < corte)
      .sort((a, b) => b.id - a.id);

    const origen = filas.find(esOrigen);
    const tramo = origen ? filas.filter((fila) => fila.id >= origen.id) : filas;
    resultado.push(...tramo);

    if (origen && origen.accion !== "ALTA" && origen.partida_codigo_anterior !== codigoTramo) {
      corte = origen.id;
      codigoTramo = origen.partida_codigo_anterior;
    } else {
      codigoTramo = null;
    }
  }

  return resultado.sort((a, b) => b.id - a.id);
};
