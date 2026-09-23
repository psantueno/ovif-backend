/*
Reparación de texto con doble codificación UTF-8 ("mojibake"), detectado en
archivos de carga real (ver informes de Centenario, ovif_recaudaciones
2026/05): el texto original en UTF-8 se decodificó una vez como Windows-1252
(cp1252) -típico de Excel en Windows- y ese resultado se volvió a guardar
como si fuera el texto final. Ejemplos reales:
  "TASA DE ACTUACIÃ“N" -> "TASA DE ACTUACIÓN"
  "VEHÃCULO"           -> "VEHÍCULO"
  "AÃ‘OS"               -> "AÑOS"       (usa el rango 0x80-0x9F de cp1252)
  "NÂ°7"                -> "Nº7"

Se usa cp1252 (no ISO-8859-1 puro) porque el rango de bytes 0x80-0x9F difiere
entre ambos, y en los datos reales aparecen caracteres de ese rango (p.ej. Ñ).
*/

// Mapeo inverso de los caracteres Unicode que Windows-1252 define de forma
// distinta a ISO-8859-1 en el rango de bytes 0x80-0x9F.
const CP1252_BYTE_POR_CODEPOINT = {
  0x20ac: 0x80,
  0x201a: 0x82,
  0x0192: 0x83,
  0x201e: 0x84,
  0x2026: 0x85,
  0x2020: 0x86,
  0x2021: 0x87,
  0x02c6: 0x88,
  0x2030: 0x89,
  0x0160: 0x8a,
  0x2039: 0x8b,
  0x0152: 0x8c,
  0x017d: 0x8e,
  0x2018: 0x91,
  0x2019: 0x92,
  0x201c: 0x93,
  0x201d: 0x94,
  0x2022: 0x95,
  0x2013: 0x96,
  0x2014: 0x97,
  0x02dc: 0x98,
  0x2122: 0x99,
  0x0161: 0x9a,
  0x203a: 0x9b,
  0x0153: 0x9c,
  0x017e: 0x9e,
  0x0178: 0x9f
};

/**
 * Convierte un caracter (code point) al byte que tendría en cp1252.
 * Devuelve null si el caracter no existe en cp1252 (irreparable).
 */
const charAByteCp1252 = (codePoint) => {
  if (codePoint <= 0xff) {
    // 0x00-0x7F y 0xA0-0xFF coinciden con Unicode. El rango 0x80-0x9F
    // "indefinido" de cp1252 se mapea a sí mismo en la práctica (bytes que
    // nunca se corrompieron), así que también se admite como identidad.
    return codePoint;
  }
  return CP1252_BYTE_POR_CODEPOINT[codePoint] ?? null;
};

/**
 * Heurística de detección: el patrón de doble codificación UTF-8 siempre
 * deja como marca los caracteres Ã (U+00C3) o Â (U+00C2), que son el primer
 * byte de la mayoría de las secuencias UTF-8 de 2 bytes del rango Latin-1.
 */
export const detectarMojibake = (texto) => {
  if (typeof texto !== "string" || texto.length === 0) return false;
  return /[ÂÃ]/.test(texto);
};

/**
 * Intenta reparar un texto con doble codificación UTF-8.
 * @returns {{valor: string, reparado: boolean, irreparable: boolean}}
 *   - reparado=true: se corrigió y `valor` es el texto reparado.
 *   - irreparable=true: se detectó el patrón pero no se pudo reparar de
 *     forma segura; `valor` es el texto original, sin modificar.
 *   - ambos false: no había nada para reparar; `valor` es el texto original.
 */
export const repararMojibake = (texto) => {
  if (!detectarMojibake(texto)) {
    return { valor: texto, reparado: false, irreparable: false };
  }

  const bytes = [];
  for (const caracter of texto) {
    const byte = charAByteCp1252(caracter.codePointAt(0));
    if (byte === null) {
      return { valor: texto, reparado: false, irreparable: true };
    }
    bytes.push(byte);
  }

  let decodificado;
  try {
    decodificado = new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(bytes));
  } catch {
    return { valor: texto, reparado: false, irreparable: true };
  }

  if (decodificado === texto || decodificado.includes("�")) {
    // El "round-trip" no cambió nada o produjo caracteres inválidos: no era
    // realmente doble codificación (o quedaría peor). No se toca.
    return { valor: texto, reparado: false, irreparable: false };
  }

  return { valor: decodificado, reparado: true, irreparable: false };
};
