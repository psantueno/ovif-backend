// Modelo
import { Municipio, EjercicioMes, EjercicioMesMunicipio, EjercicioMesCerrado, Gasto } from "../models/index.js";
import PartidaGasto from "../models/partidas/PartidaGasto.js";

const toISODate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().split("T")[0];
};

// Obtener todos los municipios
export const getMunicipios = async (req, res) => {
  try {
    const municipios = await Municipio.findAll();
    res.json(municipios);
  } catch (error) {
    console.error("❌ Error consultando municipios:", error);
    res.status(500).json({ error: "Error consultando municipios" });
  }
};

export const listarEjerciciosDisponiblesPorMunicipio = async (req, res) => {
  const municipioId = Number(req.params.id || req.params.municipioId);
  console.log(req.params)
  if (Number.isNaN(municipioId)) {
    return res.status(400).json({ error: "municipioId inválido" });
  }

  try {
    const municipio = await Municipio.findByPk(municipioId, {
      attributes: ["municipio_id", "municipio_nombre"],
    });
    if (!municipio) {
      return res.status(404).json({ error: "Municipio no encontrado" });
    }

    const ejercicios = await EjercicioMes.findAll({
      order: [
        ["ejercicio", "ASC"],
        ["mes", "ASC"],
      ],
    });

    if (ejercicios.length === 0) {
      return res.json({
        municipio: municipio.get(),
        ejercicios: [],
      });
    }

    const overrides = await EjercicioMesMunicipio.findAll({
      where: { municipio_id: municipioId },
    });
    const cierres = await EjercicioMesCerrado.findAll({
      where: { municipio_id: municipioId },
    });

    const overrideMap = new Map(
      overrides.map((o) => [`${o.ejercicio}-${o.mes}`, o])
    );
    const cierreMap = new Map(
      cierres.map((c) => [`${c.ejercicio}-${c.mes}`, c])
    );

    const hoy = toISODate(new Date());
    const disponibles = ejercicios
      .map((em) => {
        const key = `${em.ejercicio}-${em.mes}`;
        const override = overrideMap.get(key);
        const cierre = cierreMap.get(key);

        const fechaInicio = override?.fecha_inicio || em.fecha_inicio;
        const fechaFin = override?.fecha_fin || em.fecha_fin;
        const fechaCierre = cierre?.fecha || null;

        const fechaFinStr = toISODate(fechaFin);
        const fechaCierreStr = toISODate(fechaCierre);

        const vencido = fechaFinStr ? hoy > fechaFinStr : false;
        const cerrado = Boolean(cierre);
        const disponible = !vencido && !cerrado;

        return {
          ejercicio: em.ejercicio,
          mes: em.mes,
          fecha_inicio: toISODate(fechaInicio),
          fecha_fin: fechaFinStr,
          fecha_fin_oficial: toISODate(em.fecha_fin),
          tiene_prorroga: Boolean(override),
          fecha_cierre: fechaCierreStr,
          vencido,
          cerrado,
          disponible,
        };
      })
      .filter((item) => item.disponible);

    return res.json({
      municipio: municipio.get(),
      ejercicios: disponibles,
    });
  } catch (error) {
    console.error("❌ Error listando ejercicios disponibles:", error);
    return res.status(500).json({ error: "Error listando ejercicios disponibles" });
  }
};


// 📌 Endpoint liviano para selects
// GET /api/municipios/select
export const getMunicipiosSelect = async (req, res) => {
  try {
    const municipios = await Municipio.findAll({
      attributes: ["municipio_id", "municipio_nombre"],
      order: [["municipio_nombre", "ASC"]],
    });
    res.json(municipios);
  } catch (error) {
    console.error("❌ Error consultando municipios:", error);
    res.status(500).json({ error: "Error consultando municipios" });
  }
};

// Obtener un municipio por ID
export const getMunicipioById = async (req, res) => {
  const { id } = req.params;

  try {
    const municipio = await Municipio.findByPk(id);

    if (!municipio) {
      return res.status(404).json({ error: "Municipio no encontrado" });
    }

    res.json(municipio);
  } catch (error) {
    console.error("❌ Error consultando municipio:", error);
    res.status(500).json({ error: "Error consultando municipio" });
  }
};

// Crear un nuevo municipio
export const createMunicipio = async (req, res) => {
  const {
    municipio_nombre,
    municipio_usuario,
    municipio_password,
    municipio_spar,
    municipio_ubge,
    municipio_subir_archivos,
    municipio_poblacion,
  } = req.body;

  if (
    !municipio_nombre ||
    !municipio_usuario ||
    !municipio_password ||
    municipio_spar === undefined ||
    municipio_ubge === undefined ||
    municipio_subir_archivos === undefined ||
    municipio_poblacion === undefined
  ) {
    return res.status(400).json({ error: "Todos los campos del municipio son obligatorios" });
  }

  try {
    const municipioExistente = await Municipio.findOne({
      where: { municipio_nombre },
    });

    if (municipioExistente) {
      return res.status(400).json({ error: "Ya existe un municipio con ese nombre" });
    }

    const nuevoMunicipio = await Municipio.create({
      municipio_nombre,
      municipio_usuario,
      municipio_password,
      municipio_spar,
      municipio_ubge,
      municipio_subir_archivos,
      municipio_poblacion,
    });

    res.status(201).json({
      message: "Municipio creado correctamente",
      municipio: nuevoMunicipio,
    });
  } catch (error) {
    console.error("❌ Error creando municipio:", error);
    res.status(500).json({ error: "Error creando municipio" });
  }
};

// Actualizar un municipio existente
export const updateMunicipio = async (req, res) => {
  const { id } = req.params;
  const {
    municipio_nombre,
    municipio_usuario,
    municipio_password,
    municipio_spar,
    municipio_ubge,
    municipio_subir_archivos,
    municipio_poblacion,
  } = req.body;

  try {
    const municipio = await Municipio.findByPk(id);

    if (!municipio) {
      return res.status(404).json({ error: "Municipio no encontrado" });
    }

    if (municipio_nombre && municipio_nombre !== municipio.municipio_nombre) {
      const municipioDuplicado = await Municipio.findOne({ where: { municipio_nombre } });

      if (municipioDuplicado && municipioDuplicado.municipio_id !== municipio.municipio_id) {
        return res.status(400).json({ error: "Ya existe otro municipio con ese nombre" });
      }

      municipio.municipio_nombre = municipio_nombre;
    }

    if (municipio_usuario !== undefined) municipio.municipio_usuario = municipio_usuario;
    if (municipio_password !== undefined) municipio.municipio_password = municipio_password;
    if (municipio_spar !== undefined) municipio.municipio_spar = municipio_spar;
    if (municipio_ubge !== undefined) municipio.municipio_ubge = municipio_ubge;
    if (municipio_subir_archivos !== undefined)
      municipio.municipio_subir_archivos = municipio_subir_archivos;
    if (municipio_poblacion !== undefined) municipio.municipio_poblacion = municipio_poblacion;

    await municipio.save();

    res.json({
      message: "Municipio actualizado correctamente",
      municipio,
    });
  } catch (error) {
    console.error("❌ Error actualizando municipio:", error);
    res.status(500).json({ error: "Error actualizando municipio" });
  }
};

// Eliminar un municipio
// export const deleteMunicipio = async (req, res) => {
//   const { id } = req.params;

//   try {
//     const municipio = await Municipio.findByPk(id);

//     if (!municipio) {
//       return res.status(404).json({ error: "Municipio no encontrado" });
//     }

//     await municipio.destroy();

//     res.json({ message: "Municipio eliminado correctamente" });
//   } catch (error) {
//     console.error("❌ Error eliminando municipio:", error);
//     res.status(500).json({ error: "Error eliminando municipio" });
//   }
// };

// === Partidas de gastos del municipio (con importes cargados) ===
export const obtenerPartidasGastosMunicipio = async (req, res) => {
  const { ejercicio, mes, municipioId } = req.params;

  const ejercicioNum = Number(ejercicio);
  const mesNum = Number(mes);
  const municipioNum = Number(municipioId);

  if ([ejercicioNum, mesNum, municipioNum].some((value) => Number.isNaN(value))) {
    return res.status(400).json({ error: "Ejercicio, mes y municipio deben ser numéricos" });
  }

  try {
    const municipio = await Municipio.findByPk(municipioNum, { attributes: ["municipio_id"] });
    if (!municipio) {
      return res.status(404).json({ error: "Municipio no encontrado" });
    }

    const [partidas, gastosGuardados] = await Promise.all([
      PartidaGasto.findAll({
        order: [
          ["partidas_gastos_padre", "ASC"],
          ["partidas_gastos_codigo", "ASC"],
        ],
      }),
      Gasto.findAll({
        where: {
          gastos_ejercicio: ejercicioNum,
          gastos_mes: mesNum,
          municipio_id: municipioNum,
        },
      }),
    ]);

    console.log('gastos_ejercicio:', ejercicioNum, 'gastos_mes:', mesNum, 'municipio_id:', municipioNum);

    const gastosMap = new Map();
    gastosGuardados.forEach((gasto) => {
      const importe = gasto.gastos_importe_devengado;
      gastosMap.set(
        gasto.partidas_gastos_codigo,
        importe === null ? null : parseFloat(importe)
      );
    });

    const partidasMap = new Map();
    partidas.forEach((partida) => {
      const codigo = partida.partidas_gastos_codigo;
      partidasMap.set(codigo, {
        ...partida.toJSON(),
        partidas_gastos_padre_descripcion: null,
        puede_cargar: Boolean(partida.partidas_gastos_carga),
        importe_devengado: gastosMap.has(codigo) ? gastosMap.get(codigo) : null,
        children: [],
      });
    });

    const jerarquia = [];

    partidasMap.forEach((partida) => {
      const parentId = partida.partidas_gastos_padre;
      const esRaiz =
        parentId === null ||
        parentId === undefined ||
        parentId === 0 ||
        parentId === partida.partidas_gastos_codigo ||
        !partidasMap.has(parentId);

      if (esRaiz) {
        jerarquia.push(partida);
        return;
      }

      const padre = partidasMap.get(parentId);
      if (padre) {
        partida.partidas_gastos_padre_descripcion = padre.partidas_gastos_descripcion;
        padre.children.push(partida);
      } else {
        jerarquia.push(partida);
      }
    });

    return res.json(jerarquia);
  } catch (error) {
    console.error("❌ Error obteniendo partidas de gastos del municipio:", error);
    return res.status(500).json({ error: "Error obteniendo partidas de gastos" });
  }
};

// === Upsert masivo de gastos por municipio ===
export const upsertGastosMunicipio = async (req, res) => {
  const { ejercicio, mes, municipioId } = req.params;
  const { partidas } = req.body ?? {};

  const ejercicioNum = Number(ejercicio);
  const mesNum = Number(mes);
  const municipioNum = Number(municipioId);

  if ([ejercicioNum, mesNum, municipioNum].some((value) => Number.isNaN(value))) {
    return res.status(400).json({ error: "Ejercicio, mes y municipio deben ser numéricos" });
  }

  if (!Array.isArray(partidas) || partidas.length === 0) {
    return res.status(400).json({ error: "Debe enviar un arreglo 'partidas' con al menos un elemento" });
  }

  const sequelize = Gasto.sequelize;
  const transaction = await sequelize.transaction();

  try {
    const municipio = await Municipio.findByPk(municipioNum, { attributes: ["municipio_id"] });
    if (!municipio) {
      await transaction.rollback();
      return res.status(404).json({ error: "Municipio no encontrado" });
    }
    let creados = 0;
    let actualizados = 0;
    let sinCambios = 0;

    for (const item of partidas) {
      const codigo = Number(item?.partidas_gastos_codigo);

      if (Number.isNaN(codigo)) {
        await transaction.rollback();
        return res.status(400).json({ error: "Cada partida debe incluir 'partidas_gastos_codigo' numérico" });
      }

      const tieneImporte = Object.prototype.hasOwnProperty.call(item, "gastos_importe_devengado");
      const importeValor = item?.gastos_importe_devengado;
      let importeParsed;

      if (tieneImporte) {
        const normalizado = importeValor === null || importeValor === "" ? 0 : importeValor;
        importeParsed = Number(normalizado);
        if (Number.isNaN(importeParsed)) {
          await transaction.rollback();
          return res.status(400).json({ error: `El importe para la partida ${codigo} debe ser numérico` });
        }
      }

      const where = {
        gastos_ejercicio: ejercicioNum,
        gastos_mes: mesNum,
        municipio_id: municipioNum,
        partidas_gastos_codigo: codigo,
      };

      const existente = await Gasto.findOne({ where, transaction });

      if (!existente) {
        if (!tieneImporte) {
          await transaction.rollback();
          return res.status(400).json({
            error: `La partida ${codigo} no existe y requiere 'gastos_importe_devengado' para crearla`,
          });
        }

        await Gasto.create(
          {
            ...where,
            gastos_importe_devengado: importeParsed,
          },
          { transaction }
        );
        creados += 1;
        continue;
      }

      if (!tieneImporte) {
        sinCambios += 1;
        continue;
      }

      const importeActual = Number(existente.gastos_importe_devengado);
      if (!Number.isNaN(importeActual) && importeActual === importeParsed) {
        sinCambios += 1;
        continue;
      }

      await existente.update(
        {
          gastos_importe_devengado: importeParsed,
        },
        { transaction }
      );
      actualizados += 1;
    }

    await transaction.commit();

    return res.json({
      message: "Gastos procesados correctamente",
      resumen: {
        creados,
        actualizados,
        sinCambios,
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("❌ Error realizando upsert de gastos del municipio:", error);
    return res.status(500).json({ error: "Error guardando los gastos" });
  }
};
