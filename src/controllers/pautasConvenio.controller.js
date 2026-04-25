import {
  CierreModulo,
  Convenio,
  EjercicioMes,
  PautaConvenio,
  ProrrogaMunicipio,
  TipoPauta,
} from "../models/index.js";
import { Op } from "sequelize";
import { PautasSchema } from "../validation/PautasSchema.validation.js";
import { zodErrorsToArray } from "../utils/zodErrorMessages.js";

const includePautaRelations = [
  {
    model: Convenio,
    attributes: ["convenio_id", "nombre"],
  },
  {
    model: TipoPauta,
    as: "TipoPauta",
    attributes: [
      "tipo_pauta_id",
      "codigo",
      "nombre",
      "descripcion",
      "requiere_periodo_rectificar",
    ],
  },
];

const normalizarPauta = (pauta, modificable = false) => ({
  pauta_id: pauta.pauta_id,
  convenio_id: pauta.convenio_id,
  convenio_nombre: pauta.Convenio?.nombre ?? null,
  descripcion: pauta.descripcion,
  dia_vto: pauta.dia_vto,
  plazo_vto: pauta.plazo_vto,
  cant_dias_rectifica: pauta.cant_dias_rectifica,
  plazo_mes_rectifica: pauta.plazo_mes_rectifica,
  tipo_pauta_id: pauta.tipo_pauta_id,
  tipo_pauta_codigo: pauta.TipoPauta?.codigo ?? null,
  tipo_pauta_nombre: pauta.TipoPauta?.nombre ?? null,
  tipo_pauta_descripcion: pauta.TipoPauta?.descripcion ?? null,
  requiere_periodo_rectificar: Boolean(
    pauta.TipoPauta?.requiere_periodo_rectificar
  ),
  modificable,
});

const validarRectificacionSegunTipo = (tipoPauta, payload) => {
  if (!tipoPauta?.requiere_periodo_rectificar) {
    return {
      cant_dias_rectifica: null,
      plazo_mes_rectifica: null,
    };
  }

  const cantDias = Number(payload.cant_dias_rectifica ?? NaN);
  const plazoMes = Number(payload.plazo_mes_rectifica ?? NaN);

  if (!Number.isInteger(cantDias) || cantDias <= 0) {
    throw new Error(
      "La pauta requiere período de rectificación: cant_dias_rectifica debe ser un entero mayor a 0"
    );
  }

  if (!Number.isInteger(plazoMes) || plazoMes < 0) {
    throw new Error(
      "La pauta requiere período de rectificación: plazo_mes_rectifica debe ser un entero mayor a 0"
    );
  }

  return {
    cant_dias_rectifica: cantDias,
    plazo_mes_rectifica: plazoMes,
  };
};

export const getPautaConvenioParametros = async (req, res) => {
  const pautaParam = req.params?.pautaId ?? req.query?.pautaId ?? req.query?.id;

  if (!pautaParam || !/^[0-9]+$/.test(String(pautaParam))) {
    return res
      .status(400)
      .json({ error: "El identificador de pauta es obligatorio y debe ser numérico." });
  }

  const pautaId = Number.parseInt(pautaParam, 10);

  try {
    const pauta = await PautaConvenio.findOne({
      where: { pauta_id: pautaId },
      include: includePautaRelations,
    });

    if (!pauta) {
      return res.status(404).json({ error: "Pauta del convenio no encontrada." });
    }

    const dia_vto = Number.parseInt(pauta.dia_vto, 10);
    const plazo_vto = Number.parseInt(pauta.plazo_vto, 10);

    return res.json({
      dia_vto: Number.isNaN(dia_vto) ? null : dia_vto,
      plazo_vto: Number.isNaN(plazo_vto) ? null : plazo_vto,
      tipo_pauta_id: pauta.tipo_pauta_id,
      tipo_pauta_codigo: pauta.TipoPauta?.codigo ?? null,
      tipo_pauta_nombre: pauta.TipoPauta?.nombre ?? null,
      tipo_pauta_descripcion: pauta.TipoPauta?.descripcion ?? null,
      requiere_periodo_rectificar: Boolean(
        pauta.TipoPauta?.requiere_periodo_rectificar
      ),
      cant_dias_rectifica: pauta.cant_dias_rectifica,
      plazo_mes_rectifica: pauta.plazo_mes_rectifica,
    });
  } catch (error) {
    console.error("❌ Error obteniendo parámetros de la pauta del convenio:", error);
    return res
      .status(500)
      .json({ error: "Error obteniendo parámetros de la pauta del convenio" });
  }
};

export const getPautasSelect = async (_req, res) => {
  try {
    const pautas = await PautaConvenio.findAll({
      attributes: ["pauta_id", "descripcion", "tipo_pauta_id"],
      include: [
        {
          model: TipoPauta,
          as: "TipoPauta",
          attributes: [
            "tipo_pauta_id",
            "codigo",
            "nombre",
            "descripcion",
            "requiere_periodo_rectificar",
          ],
        },
      ],
      order: [["descripcion", "ASC"]],
    });

    return res.json(
      pautas.map((pauta) => ({
        pauta_id: pauta.pauta_id,
        descripcion: pauta.descripcion,
        tipo_pauta_id: pauta.tipo_pauta_id,
        tipo_pauta_codigo: pauta.TipoPauta?.codigo ?? null,
        tipo_pauta_nombre: pauta.TipoPauta?.nombre ?? null,
        tipo_pauta_descripcion: pauta.TipoPauta?.descripcion ?? null,
        requiere_periodo_rectificar: Boolean(
          pauta.TipoPauta?.requiere_periodo_rectificar
        ),
      }))
    );
  } catch (error) {
    console.error("❌ Error consultando pautas:", error);
    return res.status(500).json({ error: "Error consultando pautas" });
  }
};

export const listarPautas = async (req, res) => {
  try {
    let { pagina = 1, limite = 10, search } = req.query;

    const paginaParsed = Number.parseInt(pagina, 10);
    const limiteParsed = Number.parseInt(limite, 10);
    const paginaFinal = Number.isFinite(paginaParsed) && paginaParsed > 0 ? paginaParsed : 1;
    const limiteFinal = Number.isFinite(limiteParsed) && limiteParsed > 0 ? limiteParsed : 10;
    const offset = (paginaFinal - 1) * limiteFinal;

    const where = {};
    const trimmedSearch = typeof search === "string" ? search.trim() : "";
    if (trimmedSearch) {
      where.descripcion = { [Op.like]: `%${trimmedSearch}%` };
    }

    const { rows, count } = await PautaConvenio.findAndCountAll({
      where,
      include: includePautaRelations,
      order: [
        ["pauta_id", "DESC"],
        ["descripcion", "ASC"],
      ],
      limit: limiteFinal,
      offset,
    });

    const pautasPlanas = await Promise.all(
      rows.map(async (p) => {
        let modificable = false;
        try {
          modificable = await esPautaModificable(p.pauta_id);
        } catch (error) {
          console.error(`❌ Error verificando si la pauta es modificable para pauta_id ${p.pauta_id}`, error);
        }
        return normalizarPauta(p, modificable);
      })
    );

    const totalPaginas = limiteFinal > 0 ? Math.ceil(count / limiteFinal) : 0;

    return res.json({
      total: count,
      pagina: paginaFinal,
      limite: limiteFinal,
      totalPaginas,
      data: pautasPlanas,
    });
  } catch (error) {
    console.error("❌ Error consultando pautas:", error);
    return res.status(500).json({ error: "Error consultando pautas" });
  }
};

export const crearPauta = async (req, res) => {
  const {
    descripcion,
    convenio_id,
    dia_vto,
    plazo_vto,
    cant_dias_rectifica,
    plazo_mes_rectifica,
    tipo_pauta_id,
  } = req.body;

  try {
    const valid = PautasSchema.safeParse({
      descripcion,
      convenio_id,
      dia_vto,
      plazo_vto,
      cant_dias_rectifica,
      plazo_mes_rectifica,
      tipo_pauta_id,
    });

    if (!valid.success) {
      return res.status(400).json({ error: zodErrorsToArray(valid.error.issues).join(",") });
    }

    const [convenio, tipoPauta] = await Promise.all([
      Convenio.findOne({ where: { convenio_id } }),
      TipoPauta.findByPk(tipo_pauta_id),
    ]);

    if (!convenio) {
      return res.status(400).json({ error: "No existe el convenio seleccionado" });
    }

    if (!tipoPauta) {
      return res.status(400).json({ error: "No existe el tipo de pauta seleccionado" });
    }

    const payloadRectificacion = validarRectificacionSegunTipo(tipoPauta, {
      cant_dias_rectifica,
      plazo_mes_rectifica,
    });

    const pauta = await PautaConvenio.create({
      descripcion,
      convenio_id,
      dia_vto: dia_vto ?? 0,
      plazo_vto: plazo_vto ?? 0,
      cant_dias_rectifica: payloadRectificacion.cant_dias_rectifica,
      plazo_mes_rectifica: payloadRectificacion.plazo_mes_rectifica,
      tipo_pauta_id,
    });

    const pautaConRelaciones = await PautaConvenio.findByPk(pauta.pauta_id, {
      include: includePautaRelations,
    });

    return res.status(201).json({
      message: "Pauta creada correctamente",
      pauta: normalizarPauta(pautaConRelaciones, true),
    });
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }

    console.error("❌ Error creando pauta:", error);
    return res.status(500).json({ error: "Error creando pauta" });
  }
};

export const actualizarPauta = async (req, res) => {
  const { pautaId } = req.params;
  const {
    descripcion,
    convenio_id,
    dia_vto,
    plazo_vto,
    cant_dias_rectifica,
    plazo_mes_rectifica,
    tipo_pauta_id,
  } = req.body;

  try {
    const pauta = await PautaConvenio.findByPk(pautaId);

    if (!pauta) {
      return res.status(404).json({ error: "Pauta no encontrada" });
    }

    const modificable = await esPautaModificable(pautaId);

    if (!modificable) {
      return res.status(400).json({ error: "La pauta está asociado a otros datos y no puede ser actualizado" });
    }

    const valid = PautasSchema.safeParse({
      descripcion,
      convenio_id,
      dia_vto,
      plazo_vto,
      cant_dias_rectifica,
      plazo_mes_rectifica,
      tipo_pauta_id,
    });

    if (!valid.success) {
      return res.status(400).json({ error: zodErrorsToArray(valid.error.issues).join(",") });
    }

    const [convenio, tipoPauta] = await Promise.all([
      Convenio.findOne({ where: { convenio_id } }),
      TipoPauta.findByPk(tipo_pauta_id),
    ]);

    if (!convenio) {
      return res.status(400).json({ error: "No existe el convenio seleccionado" });
    }

    if (!tipoPauta) {
      return res.status(400).json({ error: "No existe el tipo de pauta seleccionado" });
    }

    const payloadRectificacion = validarRectificacionSegunTipo(tipoPauta, {
      cant_dias_rectifica,
      plazo_mes_rectifica,
    });

    pauta.descripcion = descripcion;
    pauta.convenio_id = convenio_id;
    pauta.dia_vto = dia_vto;
    pauta.plazo_vto = plazo_vto;
    pauta.cant_dias_rectifica = payloadRectificacion.cant_dias_rectifica;
    pauta.plazo_mes_rectifica = payloadRectificacion.plazo_mes_rectifica;
    pauta.tipo_pauta_id = tipo_pauta_id;

    await pauta.save();

    const pautaConRelaciones = await PautaConvenio.findByPk(pauta.pauta_id, {
      include: includePautaRelations,
    });

    return res.json({
      message: "Pauta actualizado correctamente",
      pauta: normalizarPauta(pautaConRelaciones, modificable),
    });
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }

    console.error("❌ Error actualizando pauta:", error);
    return res.status(500).json({ error: "Error actualizando pauta" });
  }
};

export const eliminarPauta = async (req, res) => {
  const { pautaId } = req.params;

  try {
    const pauta = await PautaConvenio.findByPk(pautaId);

    if (!pauta) {
      return res.status(404).json({ error: "Pauta no encontrado" });
    }

    const modificable = await esPautaModificable(pautaId);

    if (!modificable) {
      return res.status(400).json({ error: "La pauta está asociado a otros datos y no puede ser eliminado" });
    }

    await pauta.destroy();

    return res.json({ message: "Pauta eliminada correctamente" });
  } catch (error) {
    console.error("❌ Error eliminando pauta:", error);
    return res.status(500).json({ error: "Error eliminando pauta" });
  }
};

const esPautaModificable = async (pautaId) => {
  const cierreModulo = await CierreModulo.findOne({ where: { pauta_id: pautaId } });
  if (cierreModulo) return false;

  const ejercicioMes = await EjercicioMes.findOne({ where: { pauta_id: pautaId } });
  if (ejercicioMes) return false;

  const prorrogaMunicipio = await ProrrogaMunicipio.findOne({ where: { pauta_id: pautaId } });
  if (prorrogaMunicipio) return false;

  return true;
};
