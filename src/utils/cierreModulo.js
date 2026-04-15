export const CIERRE_MODULOS = Object.freeze({
  GASTOS: "GASTOS",
  RECURSOS: "RECURSOS",
  RECAUDACIONES: "RECAUDACIONES",
  REMUNERACIONES: "REMUNERACIONES",
  DETERMINACION_TRIBUTARIA: "DETERMINACION_TRIBUTARIA",
  PERSONAL: "PERSONAL",
});

export const TIPOS_CIERRE_MODULO = Object.freeze({
  REGULAR: "REGULAR",
  PRORROGA: "PRORROGA",
  MANUAL: "MANUAL",
});

const MODULO_LABELS = {
  [CIERRE_MODULOS.GASTOS]: "Gastos",
  [CIERRE_MODULOS.RECURSOS]: "Recursos",
  [CIERRE_MODULOS.RECAUDACIONES]: "Recaudaciones",
  [CIERRE_MODULOS.REMUNERACIONES]: "Remuneraciones",
  [CIERRE_MODULOS.DETERMINACION_TRIBUTARIA]: "Determinacion Tributaria",
  [CIERRE_MODULOS.PERSONAL]: "Personal",
};

const MODULO_ALIASES = {
  [CIERRE_MODULOS.GASTOS]: ["GASTOS", "Gastos"],
  [CIERRE_MODULOS.RECURSOS]: ["RECURSOS", "Recursos"],
  [CIERRE_MODULOS.RECAUDACIONES]: ["RECAUDACIONES", "Recaudaciones"],
  [CIERRE_MODULOS.REMUNERACIONES]: ["REMUNERACIONES", "Remuneraciones"],
  [CIERRE_MODULOS.DETERMINACION_TRIBUTARIA]: [
    "DETERMINACION_TRIBUTARIA",
    "Determinacion Tributaria",
  ],
  [CIERRE_MODULOS.PERSONAL]: ["PERSONAL", "Personal"],
};

export const normalizeModuloCierre = (value) => {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return null;
  }

  const normalized = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s-]+/g, "_")
    .toUpperCase();

  if (normalized in CIERRE_MODULOS) {
    return CIERRE_MODULOS[normalized];
  }

  return normalized;
};

export const getModuloCierreAliases = (value) => {
  const normalized = normalizeModuloCierre(value);
  if (!normalized) {
    return [];
  }

  return [...new Set([normalized, ...(MODULO_ALIASES[normalized] ?? [])])];
};

export const getModuloCierreLabel = (value) => {
  const normalized = normalizeModuloCierre(value);
  if (!normalized) {
    return "Sin especificar";
  }

  return MODULO_LABELS[normalized] ?? normalized;
};

export const normalizeTipoCierre = (value) => {
  const raw = String(value ?? "").trim().toUpperCase();
  if (!raw) {
    return null;
  }

  if (raw === "AUTOMATICO") {
    return TIPOS_CIERRE_MODULO.REGULAR;
  }

  if (raw in TIPOS_CIERRE_MODULO) {
    return TIPOS_CIERRE_MODULO[raw];
  }

  return raw;
};
