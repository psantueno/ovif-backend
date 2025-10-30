import { Parametro } from "../models/index.js";

const parseActivoValue = (value) => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "number") return value ? 1 : 0;

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "t", "si", "sí", "yes", "activo"].includes(normalized)) {
      return 1;
    }
    if (["0", "false", "f", "no", "inactive", "inactivo"].includes(normalized)) {
      return 0;
    }
  }

  return null;
};

const DEFAULT_EJERCICIO_FISCAL = {
  cierreDia: 15,
  mesesOffset: 0,
};

export const getParametros = async (req, res) => {
  try {
    const { activo } = req.query;
    const filters = {};

    const parsedActivo = parseActivoValue(activo);
    if (activo !== undefined) {
      if (parsedActivo === null) {
        return res.status(400).json({ error: "El filtro 'activo' no es válido" });
      }
      filters.activo = parsedActivo;
    }

    const parametros = await Parametro.findAll({
      where: filters,
      order: [["parametro_id", "ASC"]],
    });

    res.json(parametros);
  } catch (error) {
    console.error("❌ Error consultando parámetros:", error);
    res.status(500).json({ error: "Error consultando parámetros" });
  }
};

export const getParametrosEjercicioFiscal = async (req, res) => {
  try {
    const [cierreDiaParam, mesesOffsetParam] = await Promise.all([
      Parametro.findOne({
        where: { parametro_id: 1, activo: 1 },
      }),
      Parametro.findOne({
        where: { parametro_id: 2, activo: 1 },
      }),
    ]);

    const cierreDiaValue = cierreDiaParam ? Number.parseInt(cierreDiaParam.valor, 10) : NaN;
    const mesesOffsetValue = mesesOffsetParam ? Number.parseInt(mesesOffsetParam.valor, 10) : NaN;

    const cierreDia = Number.isNaN(cierreDiaValue)
      ? DEFAULT_EJERCICIO_FISCAL.cierreDia
      : cierreDiaValue;
    const mesesOffset = Number.isNaN(mesesOffsetValue)
      ? DEFAULT_EJERCICIO_FISCAL.mesesOffset
      : mesesOffsetValue;

    return res.json({ cierreDia, mesesOffset });
  } catch (error) {
    console.error("❌ Error obteniendo parámetros del ejercicio fiscal:", error);
    return res.status(500).json({ error: "Error obteniendo parámetros del ejercicio fiscal" });
  }
};

export const getParametroById = async (req, res) => {
  try {
    const parametro = await Parametro.findByPk(req.params.id);
    if (!parametro) {
      return res.status(404).json({ error: "Parámetro no encontrado" });
    }
    res.json(parametro);
  } catch (error) {
    console.error("❌ Error consultando parámetro:", error);
    res.status(500).json({ error: "Error consultando parámetro" });
  }
};

export const createParametro = async (req, res) => {
  const { valor, descripcion, activo } = req.body;

  if (!valor) {
    return res.status(400).json({ error: "El valor del parámetro es obligatorio" });
  }

  const parsedActivo = parseActivoValue(activo);
  if (activo !== undefined && parsedActivo === null) {
    return res.status(400).json({ error: "El campo 'activo' no es válido" });
  }

  try {
    const nuevoParametro = await Parametro.create({
      valor,
      descripcion: descripcion ?? null,
      activo: parsedActivo ?? 1,
    });

    res.status(201).json({
      message: "Parámetro creado correctamente",
      parametro: nuevoParametro,
    });
  } catch (error) {
    console.error("❌ Error creando parámetro:", error);
    res.status(500).json({ error: "Error creando parámetro" });
  }
};

export const updateParametro = async (req, res) => {
  const { valor, descripcion, activo } = req.body;

  try {
    const parametro = await Parametro.findByPk(req.params.id);
    if (!parametro) {
      return res.status(404).json({ error: "Parámetro no encontrado" });
    }

    if (valor !== undefined) {
      if (!valor) {
        return res.status(400).json({ error: "El valor del parámetro es obligatorio" });
      }
      parametro.valor = valor;
    }

    if (descripcion !== undefined) {
      parametro.descripcion = descripcion;
    }

    if (activo !== undefined) {
      const parsedActivo = parseActivoValue(activo);
      if (parsedActivo === null) {
        return res.status(400).json({ error: "El campo 'activo' no es válido" });
      }
      parametro.activo = parsedActivo;
    }

    parametro.fecha_actualizacion = new Date();
    await parametro.save();

    res.json({
      message: "Parámetro actualizado correctamente",
      parametro,
    });
  } catch (error) {
    console.error("❌ Error actualizando parámetro:", error);
    res.status(500).json({ error: "Error actualizando parámetro" });
  }
};

export const deleteParametro = async (req, res) => {
  try {
    const parametro = await Parametro.findByPk(req.params.id);
    if (!parametro) {
      return res.status(404).json({ error: "Parámetro no encontrado" });
    }

    await parametro.destroy();

    res.json({ message: "Parámetro eliminado correctamente" });
  } catch (error) {
    console.error("❌ Error eliminando parámetro:", error);
    res.status(500).json({ error: "Error eliminando parámetro" });
  }
};
