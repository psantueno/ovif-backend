/**
 * Helpers para sumar importes con dos decimales de forma EXACTA, evitando el drift
 * de punto flotante (IEEE 754).
 *
 * El objetivo de estos helpers es hacer la suma exacta entre números floats (con dos
 * decimales). Sumar floats directamente acumula error (por ejemplo
 * 0.1 + 0.2 === 0.30000000000000004) y, sobre miles de registros, el total termina
 * desviándose en centavos. Para evitarlo se convierte cada valor a centavos enteros
 * (exactos mientras la suma quede por debajo de Number.MAX_SAFE_INTEGER), se suma como
 * enteros y recién al final se divide por 100.
 */

// Convierte un valor decimal (number | string) a centavos enteros, de forma exacta.
export const aCentavos = (valor) => Math.round((Number(valor) || 0) * 100);

// Convierte centavos enteros de vuelta a un número decimal con dos decimales.
export const desdeCentavos = (centavos) => centavos / 100;

/**
 * Suma exacta de importes con dos decimales evitando el drift de floats.
 * Acepta números/strings sueltos o arrays (se aplanan).
 * Devuelve un número con dos decimales sin error de punto flotante.
 */
export const sumarDecimales = (...valores) =>
  desdeCentavos(valores.flat().reduce((acc, valor) => acc + aCentavos(valor), 0));
