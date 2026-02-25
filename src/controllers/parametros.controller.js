import { Op } from "sequelize";
import { Parametros, Usuario } from "../models/index.js";

const toBoolean = (value, defaultValue = true) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") return true;
    if (normalized === "false" || normalized === "0") return false;
  }
  return defaultValue;
};

const normalizeListResponse = (rows) =>
  rows.map((item) => ({
    parametro_id: item.parametro_id,
    nombre: item.nombre,
    valor: item.valor,
    descripcion: item.descripcion,
    estado: Boolean(item.estado),
    creado_por: item.creado_por,
    actualizado_por: item.actualizado_por,
    created_at: item.created_at,
    updated_at: item.updated_at,
  }));

export const listarParametros = async (req, res) => {
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
      where[Op.or] = [
        { nombre: { [Op.like]: `%${trimmedSearch}%` } },
        { descripcion: { [Op.like]: `%${trimmedSearch}%` } },
        { valor: { [Op.like]: `%${trimmedSearch}%` } },
      ];
    }

    const { rows, count } = await Parametros.findAndCountAll({
      where,
      order: [
        ["nombre", "ASC"],
        ["parametro_id", "ASC"],
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
      data: normalizeListResponse(rows),
    });
  } catch (error) {
    console.error("❌ Error listando parámetros:", error);
    return res.status(500).json({ error: "Error listando parámetros" });
  }
};

export const getParametroById = async (req, res) => {
  const { parametroId } = req.params;
  try {
    const parametro = await Parametros.findByPk(parametroId);

    if (!parametro) {
      return res.status(404).json({ error: "Parámetro no encontrado" });
    }

    const usuarioIds = [parametro.creado_por, parametro.actualizado_por].filter(
      (id, index, arr) => id !== null && id !== undefined && arr.indexOf(id) === index
    );

    const usuarios = usuarioIds.length
      ? await Usuario.findAll({
          where: { usuario_id: usuarioIds },
          attributes: ["usuario_id", "usuario", "nombre", "apellido"],
        })
      : [];

    const usuariosMap = new Map(
      usuarios.map((usuario) => [
        usuario.usuario_id,
        {
          usuario: usuario.usuario,
          nombre: usuario.nombre,
          apellido: usuario.apellido,
        },
      ])
    );

    const creador = parametro.creado_por ? usuariosMap.get(parametro.creado_por) : null;
    const actualizador = parametro.actualizado_por ? usuariosMap.get(parametro.actualizado_por) : null;

    return res.json({
      parametro_id: parametro.parametro_id,
      nombre: parametro.nombre,
      valor: parametro.valor,
      descripcion: parametro.descripcion,
      estado: Boolean(parametro.estado),
      creado_por: parametro.creado_por,
      creado_por_usuario: creador?.usuario ?? null,
      creado_por_nombre: [creador?.nombre, creador?.apellido].filter(Boolean).join(" ") || null,
      actualizado_por: parametro.actualizado_por,
      actualizado_por_usuario: actualizador?.usuario ?? null,
      actualizado_por_nombre: [actualizador?.nombre, actualizador?.apellido].filter(Boolean).join(" ") || null,
      created_at: parametro.created_at,
      updated_at: parametro.updated_at,
    });
  } catch (error) {
    console.error("❌ Error consultando parámetro:", error);
    return res.status(500).json({ error: "Error consultando parámetro" });
  }
};

export const crearParametro = async (req, res) => {
  const { nombre, valor, descripcion, estado } = req.body;
  const usuarioId = req.user?.usuario_id ?? null;

  if (!nombre || String(nombre).trim().length === 0) {
    return res.status(400).json({ error: "El nombre es obligatorio" });
  }

  if (valor === null || valor === undefined || String(valor).trim().length === 0) {
    return res.status(400).json({ error: "El valor es obligatorio" });
  }

  try {
    const nombreNormalizado = String(nombre).trim();
    const existente = await Parametros.findOne({
      where: { nombre: nombreNormalizado },
    });

    if (existente) {
      return res.status(400).json({ error: "Ya existe un parámetro con ese nombre" });
    }

    const parametro = await Parametros.create({
      nombre: nombreNormalizado,
      valor: String(valor).trim(),
      descripcion:
        descripcion === null || descripcion === undefined || String(descripcion).trim().length === 0
          ? null
          : String(descripcion).trim(),
      estado: toBoolean(estado, true),
      creado_por: usuarioId,
      actualizado_por: usuarioId,
    });

    return res.status(201).json({
      message: "Parámetro creado correctamente",
      parametro,
    });
  } catch (error) {
    console.error("❌ Error creando parámetro:", error);
    return res.status(500).json({ error: "Error creando parámetro" });
  }
};

export const actualizarParametro = async (req, res) => {
  const { parametroId } = req.params;
  const { nombre, valor, descripcion, estado } = req.body;
  const usuarioId = req.user?.usuario_id ?? null;

  try {
    const parametro = await Parametros.findByPk(parametroId);
    if (!parametro) {
      return res.status(404).json({ error: "Parámetro no encontrado" });
    }

    if (nombre !== undefined) {
      const nombreNormalizado = String(nombre).trim();
      if (!nombreNormalizado) {
        return res.status(400).json({ error: "El nombre no puede estar vacío" });
      }

      if (nombreNormalizado !== parametro.nombre) {
        const existeNombre = await Parametros.findOne({ where: { nombre: nombreNormalizado } });
        if (existeNombre && existeNombre.parametro_id !== parametro.parametro_id) {
          return res.status(400).json({ error: "Ya existe un parámetro con ese nombre" });
        }
      }

      parametro.nombre = nombreNormalizado;
    }

    if (valor !== undefined) {
      const valorNormalizado = String(valor).trim();
      if (!valorNormalizado) {
        return res.status(400).json({ error: "El valor no puede estar vacío" });
      }
      parametro.valor = valorNormalizado;
    }

    if (descripcion !== undefined) {
      const descripcionNormalizada = String(descripcion ?? "").trim();
      parametro.descripcion = descripcionNormalizada.length > 0 ? descripcionNormalizada : null;
    }

    if (estado !== undefined) {
      parametro.estado = toBoolean(estado, Boolean(parametro.estado));
    }

    parametro.actualizado_por = usuarioId;

    await parametro.save();

    return res.json({
      message: "Parámetro actualizado correctamente",
      parametro,
    });
  } catch (error) {
    console.error("❌ Error actualizando parámetro:", error);
    return res.status(500).json({ error: "Error actualizando parámetro" });
  }
};

export const actualizarEstadoParametro = async (req, res) => {
  const { parametroId } = req.params;
  const { estado } = req.body;
  const usuarioId = req.user?.usuario_id ?? null;

  try {
    const parametro = await Parametros.findByPk(parametroId);
    if (!parametro) {
      return res.status(404).json({ error: "Parámetro no encontrado" });
    }

    const nuevoEstado =
      estado === undefined ? !Boolean(parametro.estado) : toBoolean(estado, Boolean(parametro.estado));

    parametro.estado = nuevoEstado;
    parametro.actualizado_por = usuarioId;
    await parametro.save();

    return res.json({
      message: `Parámetro ${nuevoEstado ? "activado" : "desactivado"} correctamente`,
      parametro,
    });
  } catch (error) {
    console.error("❌ Error actualizando estado del parámetro:", error);
    return res.status(500).json({ error: "Error actualizando estado del parámetro" });
  }
};
