import { Op } from "sequelize";
import { CierreModulo, Convenio, EjercicioMes, PautaConvenio, ProrrogaMunicipio, TipoPauta } from "../models/index.js";
import { ConveniosSchema } from "../validation/ConveniosSchema.validation.js";
import { zodErrorsToArray } from "../utils/zodErrorMessages.js";
import { obtenerFechaActual } from "../utils/obtenerFechaActual.js";

export const listarConveniosActivos = async (req, res) => {
  try {
    const convenios = await Convenio.findAll({
      where: {
        fecha_fin: {
          [Op.gte]: obtenerFechaActual(),
        },
      },
      order: [["nombre", "ASC"]],
    });

    return res.json(convenios);
  } catch (error) {
    console.error("❌ Error listando convenios:", error);
    return res.status(500).json({ error: "Error listando convenios" });
  }
};

export const listarPautasPorConvenio = async (req, res) => {
  const { convenioId } = req.params;

  if (!convenioId || !/^[0-9]+$/.test(convenioId)) {
    return res.status(400).json({ error: "El convenioId es obligatorio y debe ser numérico" });
  }

  try {
    const pautas = await PautaConvenio.findAll({
      where: { convenio_id: Number.parseInt(convenioId, 10) },
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
      order: [["pauta_id", "ASC"]],
    });

    return res.json(
      pautas.map((pauta) => ({
        pauta_id: pauta.pauta_id,
        convenio_id: pauta.convenio_id,
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
      }))
    );
  } catch (error) {
    console.error("❌ Error listando pautas por convenio:", error);
    return res.status(500).json({ error: "Error listando pautas del convenio" });
  }
};

export const getConveniosSelect = async (req, res) => {
  try {
    const convenios = await Convenio.findAll({
      attributes: ["convenio_id", "nombre"],
      order: [["nombre", "ASC"]],
    });

    res.json(convenios);
  } catch (error) {
    console.error("❌ Error consultando convenios:", error);
    res.status(500).json({ error: "Error consultando convenios" });
  }
}

export const listarConvenios = async (req, res) => {
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
      where.nombre = { [Op.like]: `%${trimmedSearch}%` };
    }

    const { rows, count } = await Convenio.findAndCountAll({
      where,
      order: [
        ["nombre", "ASC"],
        ["convenio_id", "ASC"],
      ],
      limit: limiteFinal,
      offset,
    });

    const conveniosPlanos = await Promise.all(
      rows.map(async (c) => {
        const modificable = await esConvenioModificable(c.convenio_id);

        return {
          convenio_id: c.convenio_id,
          nombre: c.nombre,
          descripcion: c.descripcion,
          fecha_inicio: c.fecha_inicio,
          fecha_fin: c.fecha_fin,
          fecha_creacion: c.fecha_creacion,
          fecha_actualizacion: c.fecha_actualizacion,
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
      data: conveniosPlanos,
    });
  } catch (error) {
    console.error("❌ Error consultando convenios:", error);
    res.status(500).json({ error: "Error consultando convenios" });
  }
}

export const crearConvenio = async (req, res) => {
  const {
    nombre,
    descripcion,
    fecha_inicio,
    fecha_fin
  } = req.body;

  try {
    const valid = ConveniosSchema.safeParse({
      nombre,
      descripcion,
      fecha_inicio,
      fecha_fin
    })

    if (!valid.success) {
      return res.status(400).json({ error: zodErrorsToArray(valid.error.issues).join(',') })
    }

    if (nombre) {
      const convenioDuplicado = await Convenio.findOne({ where: { nombre } });

      if (convenioDuplicado) {
        return res.status(400).json({ error: "Ya existe otro convenio con este nombre" });
      }
    }

    const convenio = await Convenio.create({
      nombre: nombre,
      descripcion: descripcion,
      fecha_inicio: fecha_inicio,
      fecha_fin: fecha_fin
    })

    res.json({
      message: "Convenio creado correctamente",
      convenio,
    });
  } catch (error) {
    console.error("❌ Error creando convenio:", error);
    res.status(500).json({ error: "Error creando convenio" });
  }
}

export const actualizarConvenio = async (req, res) => {
  const { convenioId } = req.params;
  const {
    nombre,
    descripcion,
    fecha_inicio,
    fecha_fin
  } = req.body;

  try {
    const convenio = await Convenio.findByPk(convenioId);

    if (!convenio) {
      return res.status(404).json({ error: "Convenio no encontrado" });
    }

    const valid = ConveniosSchema.safeParse({
      nombre,
      descripcion,
      fecha_inicio,
      fecha_fin
    })

    if (!valid.success) {
      return res.status(400).json({ error: zodErrorsToArray(valid.error.issues).join(',') })
    }

    const modificable = await esConvenioModificable(convenio.convenio_id);

    if(!modificable){
      return res.status(400).json({ error: "El convenio está asociado a otros datos y no puede ser actualizado" });
    }

    if (nombre && nombre !== convenio.nombre) {
      const convenioDuplicado = await Convenio.findOne({ where: { nombre } });

      if (convenioDuplicado && convenioDuplicado.convenio_id !== convenio.convenio_id) {
        return res.status(400).json({ error: "Ya existe otro convenio con ese nombre" });
      }

      convenio.nombre = nombre;
    }

    if(descripcion != undefined && descripcion != null) convenio.descripcion = descripcion;
    if(fecha_inicio != undefined && fecha_inicio != null) convenio.fecha_inicio = fecha_inicio;
    if(fecha_fin != undefined && fecha_fin != null) convenio.fecha_fin = fecha_fin;

    await convenio.save();
    convenio.modificable = modificable;

    res.json({
      message: "Convenio actualizado correctamente",
      convenio,
    });
  } catch (error) {
    console.error("❌ Error actualizando convenio:", error);
    res.status(500).json({ error: "Error actualizando convenio" });
  }
};

export const eliminarConvenio = async (req, res) => {
  const { convenioId } = req.params;

  try {
    const convenio = await Convenio.findByPk(convenioId);

    if (!convenio) {
      return res.status(404).json({ error: "Convenio no encontrado" });
    }

    const modificable = await esConvenioModificable(convenio.convenio_id);

    if(!modificable){
      return res.status(400).json({ error: "El convenio está asociado a otros datos y no puede ser eliminado" });
    }

    await convenio.destroy();

    res.json({ message: "Convenio eliminado correctamente" });
  } catch (error) {
    console.error("❌ Error eliminando convenio:", error);
    res.status(500).json({ error: "Error eliminando convenio" });
  }
}

const esConvenioModificable = async (convenioId) => {
  const pautaConvenio = await PautaConvenio.findOne({where: {
    convenio_id: convenioId
  }})

  if(pautaConvenio) return false;

  const ejercicioMes = await EjercicioMes.findOne({ where: { convenio_id: convenioId } })

  if(ejercicioMes) return false;

  const cierreModulo = await CierreModulo.findOne({ where: { convenio_id: convenioId } })

  if(cierreModulo) return false;

  const prorrogaMunicipio = await ProrrogaMunicipio.findOne({ where: { convenio_id: convenioId } })

  if(prorrogaMunicipio) return false;

  return true;
}
