import { Op } from "sequelize";
import { PautaConvenio, TipoPauta } from "../models/index.js";
import { TiposPautaSchema } from "../validation/TiposPautaSchema.validation.js";
import { zodErrorsToArray } from "../utils/zodErrorMessages.js";

const normalizarTipoPauta = (item) => ({
  tipo_pauta_id: item.tipo_pauta_id,
  codigo: item.codigo,
  nombre: item.nombre,
  descripcion: item.descripcion,
  requiere_periodo_rectificar: Boolean(item.requiere_periodo_rectificar),
  fecha_creacion: item.fecha_creacion,
  fecha_actualizacion: item.fecha_actualizacion,
});

export const listarTiposPauta = async (req, res) => {
  try {
    let { pagina = 1, limite = 10, search } = req.query;

    const paginaParsed = Number.parseInt(pagina, 10);
    const limiteParsed = Number.parseInt(limite, 10);
    const paginaFinal =
      Number.isFinite(paginaParsed) && paginaParsed > 0 ? paginaParsed : 1;
    const limiteFinal =
      Number.isFinite(limiteParsed) && limiteParsed > 0 ? limiteParsed : 10;
    const offset = (paginaFinal - 1) * limiteFinal;

    const where = {};
    const trimmedSearch = typeof search === "string" ? search.trim() : "";
    if (trimmedSearch) {
      where[Op.or] = [
        { codigo: { [Op.like]: `%${trimmedSearch}%` } },
        { nombre: { [Op.like]: `%${trimmedSearch}%` } },
        { descripcion: { [Op.like]: `%${trimmedSearch}%` } },
      ];
    }

    const { rows, count } = await TipoPauta.findAndCountAll({
      where,
      order: [
        ["nombre", "ASC"],
        ["tipo_pauta_id", "ASC"],
      ],
      limit: limiteFinal,
      offset,
    });

    const totalPaginas = limiteFinal > 0 ? Math.ceil(count / limiteFinal) : 0;

    return res.json({
      total: count,
      pagina: paginaFinal,
      limite: limiteFinal,
      totalPaginas,
      data: rows.map(normalizarTipoPauta),
    });
  } catch (error) {
    console.error("❌ Error consultando tipos de pauta:", error);
    return res.status(500).json({ error: "Error consultando tipos de pauta" });
  }
};

export const getTiposPautaSelect = async (_req, res) => {
  try {
    const tipos = await TipoPauta.findAll({
      attributes: [
        "tipo_pauta_id",
        "codigo",
        "nombre",
        "descripcion",
        "requiere_periodo_rectificar",
      ],
      order: [["nombre", "ASC"]],
    });

    return res.json(tipos.map(normalizarTipoPauta));
  } catch (error) {
    console.error("❌ Error consultando catálogo de tipos de pauta:", error);
    return res
      .status(500)
      .json({ error: "Error consultando catálogo de tipos de pauta" });
  }
};

export const crearTipoPauta = async (req, res) => {
  const { codigo, nombre, descripcion, requiere_periodo_rectificar } =
    req.body ?? {};

  try {
    const valid = TiposPautaSchema.safeParse({
      codigo,
      nombre,
      descripcion,
      requiere_periodo_rectificar,
    });

    if (!valid.success) {
      return res
        .status(400)
        .json({ error: zodErrorsToArray(valid.error.issues).join(",") });
    }

    const codigoNormalizado = valid.data.codigo.trim();
    const nombreNormalizado = valid.data.nombre.trim();

    const existente = await TipoPauta.findOne({
      where: { codigo: codigoNormalizado },
    });
    if (existente) {
      return res
        .status(400)
        .json({ error: "Ya existe un tipo de pauta con ese código" });
    }

    const tipoPauta = await TipoPauta.create({
      codigo: codigoNormalizado,
      nombre: nombreNormalizado,
      descripcion: valid.data.descripcion ?? null,
      requiere_periodo_rectificar: valid.data.requiere_periodo_rectificar,
    });

    return res.status(201).json({
      message: "Tipo de pauta creado correctamente",
      tipo_pauta: normalizarTipoPauta(tipoPauta),
    });
  } catch (error) {
    console.error("❌ Error creando tipo de pauta:", error);
    return res.status(500).json({ error: "Error creando tipo de pauta" });
  }
};

export const actualizarTipoPauta = async (req, res) => {
  const { tipoPautaId } = req.params;
  const { codigo, nombre, descripcion, requiere_periodo_rectificar } =
    req.body ?? {};

  try {
    const tipoPauta = await TipoPauta.findByPk(tipoPautaId);
    if (!tipoPauta) {
      return res.status(404).json({ error: "Tipo de pauta no encontrado" });
    }

    const valid = TiposPautaSchema.safeParse({
      codigo,
      nombre,
      descripcion,
      requiere_periodo_rectificar,
    });

    if (!valid.success) {
      return res
        .status(400)
        .json({ error: zodErrorsToArray(valid.error.issues).join(",") });
    }

    const codigoNormalizado = valid.data.codigo.trim();
    const nombreNormalizado = valid.data.nombre.trim();

    if (codigoNormalizado !== tipoPauta.codigo) {
      const duplicado = await TipoPauta.findOne({
        where: { codigo: codigoNormalizado },
      });
      if (duplicado && duplicado.tipo_pauta_id !== tipoPauta.tipo_pauta_id) {
        return res
          .status(400)
          .json({ error: "Ya existe un tipo de pauta con ese código" });
      }
    }

    tipoPauta.codigo = codigoNormalizado;
    tipoPauta.nombre = nombreNormalizado;
    tipoPauta.descripcion = valid.data.descripcion ?? null;
    tipoPauta.requiere_periodo_rectificar =
      valid.data.requiere_periodo_rectificar;
    await tipoPauta.save();

    return res.json({
      message: "Tipo de pauta actualizado correctamente",
      tipo_pauta: normalizarTipoPauta(tipoPauta),
    });
  } catch (error) {
    console.error("❌ Error actualizando tipo de pauta:", error);
    return res.status(500).json({ error: "Error actualizando tipo de pauta" });
  }
};

export const eliminarTipoPauta = async (req, res) => {
  const { tipoPautaId } = req.params;

  try {
    const tipoPauta = await TipoPauta.findByPk(tipoPautaId);
    if (!tipoPauta) {
      return res.status(404).json({ error: "Tipo de pauta no encontrado" });
    }

    const pautaAsociada = await PautaConvenio.findOne({
      where: { tipo_pauta_id: tipoPauta.tipo_pauta_id },
      attributes: ["pauta_id"],
    });

    if (pautaAsociada) {
      return res.status(400).json({
        error:
          "El tipo de pauta está asociado a pautas existentes y no puede eliminarse",
      });
    }

    await tipoPauta.destroy();
    return res.json({ message: "Tipo de pauta eliminado correctamente" });
  } catch (error) {
    console.error("❌ Error eliminando tipo de pauta:", error);
    return res.status(500).json({ error: "Error eliminando tipo de pauta" });
  }
};
