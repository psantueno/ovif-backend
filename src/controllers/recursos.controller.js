// controllers/recurso.controller.js
import { Recurso } from "../models/index.js";

// CREATE
export const crearRecurso = async (req, res) => {
  try {
    const { ejercicio, mes, municipioId } = req.params;

    // whitelist de campos permitidos desde el body
    const {
      partidas_recursos_codigo,
      recursos_importe_percibido,
      recursos_cantidad_contribuyentes,
      recursos_cantidad_pagaron
    } = req.body;

    // construir payload con claves de la URL
    const payload = {
      recursos_ejercicio: Number(ejercicio),
      recursos_mes: Number(mes),
      municipio_id: Number(municipioId),
      partidas_recursos_codigo: Number(partidas_recursos_codigo),
      recursos_importe_percibido: Number(recursos_importe_percibido),
      recursos_cantidad_contribuyentes: Number(recursos_cantidad_contribuyentes),
      recursos_cantidad_pagaron: Number(recursos_cantidad_pagaron)
    };

    // (opcional) validaciones simples
    if (!payload.partidas_recursos_codigo || payload.recursos_importe_percibido == null) {
      return res.status(400).json({ error: "Faltan campos obligatorios" });
    }

    const creado = await Recurso.create(payload);
    return res.status(201).json(creado);
  } catch (error) {
    console.error("❌ crearRecurso:", error);
    return res.status(500).json({ error: "Error creando recurso" });
  }
};


// READ (todos los recursos filtrados)
export const obtenerRecursos = async (req, res) => {
  try {
    const { ejercicio, mes, municipio_id } = req.query;
    const where = {};

    if (ejercicio !== undefined) where.recursos_ejercicio = Number(ejercicio);
    if (mes !== undefined)       where.recursos_mes = Number(mes);
    if (municipio_id !== undefined) where.municipio_id = Number(municipio_id);

    const recursos = await Recurso.findAll({ where });
    res.json(recursos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// READ (uno por clave compuesta)
export const obtenerRecurso = async (req, res) => {
  try {
    const { ejercicio, mes, partida, municipio } = req.params;
    const recurso = await Recurso.findOne({
      where: {
        recursos_ejercicio: ejercicio,
        recursos_mes: mes,
        partidas_recursos_codigo: partida,
        municipio_id: municipio
      }
    });

    if (!recurso) return res.status(404).json({ error: "Recurso no encontrado" });
    res.json(recurso);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


// UPDATE
export const actualizarRecurso = async (req, res) => {
  try {
    // 1) Claves desde la URL (parseadas a número)
    const ejercicio   = Number(req.params.ejercicio);
    const mes         = Number(req.params.mes);
    const municipioId = Number(req.params.municipioId);
    const partida     = Number(req.params.partida);

    // 2) Whitelist de campos editables desde body
    const {
      recursos_importe_percibido,
      recursos_cantidad_contribuyentes,
      recursos_cantidad_pagaron
    } = req.body;

    // 3) Buscar por PK compuesta
    const where = {
      recursos_ejercicio: ejercicio,
      recursos_mes: mes,
      municipio_id: municipioId,
      partidas_recursos_codigo: partida
    };

    const recurso = await Recurso.findOne({ where });
    if (!recurso) return res.status(404).json({ error: "Recurso no encontrado" });

    // 4) Asignar solo lo que venga definido
    if (recursos_importe_percibido !== undefined)
      recurso.recursos_importe_percibido = Number(recursos_importe_percibido);
    if (recursos_cantidad_contribuyentes !== undefined)
      recurso.recursos_cantidad_contribuyentes = Number(recursos_cantidad_contribuyentes);
    if (recursos_cantidad_pagaron !== undefined)
      recurso.recursos_cantidad_pagaron = Number(recursos_cantidad_pagaron);

    // 5) Guardar y devolver la fila final (bonus)
    await recurso.save();
    return res.json(recurso);
  } catch (error) {
    console.error("❌ actualizarRecurso:", error);
    return res.status(500).json({ error: "Error actualizando recurso" });
  }
};


// DELETE
export const eliminarRecurso = async (req, res) => {
  try {
    const { ejercicio, mes, partida, municipio } = req.params;
    const deleted = await Recurso.destroy({
      where: {
        recursos_ejercicio: ejercicio,
        recursos_mes: mes,
        partidas_recursos_codigo: partida,
        municipio_id: municipio
      }
    });

    if (deleted === 0) return res.status(404).json({ error: "Recurso no encontrado" });
    res.json({ message: "Recurso eliminado correctamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
