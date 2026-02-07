import { CierreModulo, Convenio, EjercicioMes, PautaConvenio, ProrrogaMunicipio } from "../models/index.js";
import { Op } from "sequelize";
import { PautasSchema } from "../validation/PautasSchema.validation.js";
import { zodErrorsToArray } from "../utils/zodErrorMessages.js";

export const getPautaConvenioParametros = async (req, res) => {
  const pautaParam = req.params?.pautaId ?? req.query?.pautaId ?? req.query?.id;

  if (!pautaParam || !/^[0-9]+$/.test(String(pautaParam))) {
    return res.status(400).json({ error: "El identificador de pauta es obligatorio y debe ser numérico." });
  }

  const pautaId = Number.parseInt(pautaParam, 10);

  try {
    const pauta = await PautaConvenio.findOne({
      where: { pauta_id: pautaId },
    });

    if (!pauta) {
      return res.status(404).json({ error: "Pauta del convenio no encontrada." });
    }

    const dia_vto = Number.parseInt(pauta.dia_vto, 10);
    const plazo_vto = Number.parseInt(pauta.plazo_vto, 10);

    return res.json({
      dia_vto: Number.isNaN(dia_vto) ? null : dia_vto,
      plazo_vto: Number.isNaN(plazo_vto) ? null : plazo_vto,
    });
  } catch (error) {
    console.error("❌ Error obteniendo parámetros de la pauta del convenio:", error);
    return res.status(500).json({ error: "Error obteniendo parámetros de la pauta del convenio" });
  }
};

export const getPautasSelect = async (req, res) => {
  try {
    const pautas = await PautaConvenio.findAll({
      attributes: ["pauta_id", "descripcion"],
      order: [["descripcion", "ASC"]],
    });

    res.json(pautas);
  } catch (error) {
    console.error("❌ Error consultando pautas:", error);
    res.status(500).json({ error: "Error consultando pautas" });
  }
}

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
      order: [
        ["descripcion", "ASC"],
        ["pauta_id", "ASC"],
      ],
      limit: limiteFinal,
      offset,
    });

    const pautasPlanas = await Promise.all(
      rows.map(async (p) => {
        const modificable = await esPautaModificable(p.pauta_id);

        const convenio = await Convenio.findOne({ where: { convenio_id: p.convenio_id } })

        return {
          pauta_id: p.pauta_id,
          convenio_id: p.convenio_id,
          convenio_nombre: convenio.nombre,
          descripcion: p.descripcion,
          dia_vto: p.dia_vto,
          plazo_vto: p.plazo_vto,
          cant_dias_rectifica: p.cant_dias_rectifica,
          plazo_mes_rectifica: p.plazo_mes_rectifica,
          tipo_pauta: p.tipo_pauta,
          modificable: modificable
        };
      })
    );

    const totalPaginas = limiteFinal > 0 ? Math.ceil(count / limiteFinal) : 0;

    res.json({
      total: count,
      pagina: paginaFinal,
      limite: limiteFinal,
      totalPaginas,
      data: pautasPlanas,
    });
  } catch (error) {
    console.error("❌ Error consultando pautas:", error);
    res.status(500).json({ error: "Error consultando pautas" });
  }
}

export const crearPauta = async (req, res) => {
  const {
    descripcion,
    convenio_id,
    dia_vto,
    plazo_vto,
    cant_dias_rectifica,
    plazo_mes_rectifica,
    tipo_pauta
  } = req.body;

  try {
    const valid = PautasSchema.safeParse({
      descripcion,
      convenio_id,
      dia_vto,
      plazo_vto,
      cant_dias_rectifica,
      plazo_mes_rectifica,
      tipo_pauta
    })

    if (!valid.success) {
      return res.status(400).json({ error: zodErrorsToArray(valid.error.issues).join(',') })
    }
    

    if (descripcion) {
      const pautaDuplicada = await PautaConvenio.findOne({ where: { descripcion: descripcion } });

      if (pautaDuplicada) {
        return res.status(400).json({ error: "Ya existe otra pauta con esta descripción" });
      }
    }

    const convenio = await Convenio.findOne({ where: { convenio_id: convenio_id } })
    if(!convenio){
      return res.status(400).json({ error: "No existe el convenio seleccionado" });
    }

    const pauta = await PautaConvenio.create({
      descripcion: descripcion,
      convenio_id: convenio_id,
      dia_vto: dia_vto ?? 0,
      plazo_vto: plazo_vto ?? 0,
      cant_dias_rectifica: cant_dias_rectifica ?? 0,
      plazo_mes_rectifica: plazo_mes_rectifica ?? 0,
      tipo_pauta: tipo_pauta
    })

    res.json({
      message: "Pauta creada correctamente",
      pauta,
    });
  } catch (error) {
    console.error("❌ Error creando pauta:", error);
    res.status(500).json({ error: "Error creando pauta" });
  }
}

export const actualizarPauta = async (req, res) => {
  const { pautaId } = req.params;
  const {
    descripcion,
    convenio_id,
    dia_vto,
    plazo_vto,
    cant_dias_rectifica,
    plazo_mes_rectifica,
    tipo_pauta
  } = req.body;

  try {
    const pauta = await PautaConvenio.findByPk(pautaId);

    if (!pauta) {
      return res.status(404).json({ error: "Pauta no encontrada" });
    }

    const modificable = await esPautaModificable(pautaId);

    if(!modificable){
      return res.status(400).json({ error: "La pauta está asociado a otros datos y no puede ser actualizado" });
    }

    const valid = PautasSchema.safeParse({
      descripcion,
      convenio_id,
      dia_vto,
      plazo_vto,
      cant_dias_rectifica,
      plazo_mes_rectifica,
      tipo_pauta
    })

    if (!valid.success) {
      return res.status(400).json({ error: zodErrorsToArray(valid.error.issues).join(',') })
    }

    if(convenio_id){
      const convenio = await Convenio.findOne({ where: { convenio_id: convenio_id } })
      if(!convenio){
        return res.status(400).json({ error: "No existe el convenio seleccionado" });
      }
    }

    if (descripcion && descripcion !== pauta.descripcion) {
      const pautaDuplicada = await PautaConvenio.findOne({ where: { descripcion: descripcion } });

      if (pautaDuplicada) {
        return res.status(400).json({ error: "Ya existe otra pauta con esta descripción" });
      }

      pauta.descripcion = descripcion;
    }

    if(dia_vto != undefined && dia_vto != null) pauta.dia_vto = dia_vto ?? 0;
    if(plazo_vto != undefined && plazo_vto != null) pauta.plazo_vto = plazo_vto ?? 0;
    if(cant_dias_rectifica != undefined && cant_dias_rectifica != null) pauta.cant_dias_rectifica = cant_dias_rectifica ?? 0;
    if(plazo_mes_rectifica != undefined && plazo_mes_rectifica != null) pauta.plazo_mes_rectifica = plazo_mes_rectifica ?? 0;
    if(tipo_pauta != undefined && tipo_pauta != null) pauta.tipo_pauta = tipo_pauta ?? 0;
    if(convenio_id != undefined && convenio_id != null) pauta.convenio_id = convenio_id ?? 0;

    await pauta.save();
    pauta.modificable = modificable;

    res.json({
      message: "Pauta actualizado correctamente",
      pauta,
    });
  } catch (error) {
    console.error("❌ Error actualizando pauta:", error);
    res.status(500).json({ error: "Error actualizando pauta" });
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

    if(!modificable){
      return res.status(400).json({ error: "La pauta está asociado a otros datos y no puede ser eliminado" });
    }

    await pauta.destroy();

    res.json({ message: "Pauta eliminada correctamente" });
  } catch (error) {
    console.error("❌ Error eliminando pauta:", error);
    res.status(500).json({ error: "Error eliminando pauta" });
  }
}

const esPautaModificable = async (pautaId) => {
  const cierreModulo = await CierreModulo.findOne({ where: { pauta_id: pautaId } })
  if(cierreModulo) return false;

  const ejercicioMes = await EjercicioMes.findOne({ where: { pauta_id: pautaId } })
  if(ejercicioMes) return false;

  const prorrogaMunicipio = await ProrrogaMunicipio.findOne({ where: { pauta_id: pautaId } })
  if(prorrogaMunicipio) return false;

  return true;
}
