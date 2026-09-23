/*
Historial de altas/modificaciones/bajas de mtz_recursos_partida.
matriz_id no tiene FK a propósito: el historial tiene que sobrevivir a la
baja (borrado físico) de la correspondencia.
*/

import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const MtzRecursosPartidaHistorial = sequelize.define("MtzRecursosPartidaHistorial", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  matriz_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  municipio_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  codigo_recurso: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  accion: {
    type: DataTypes.ENUM("ALTA", "MODIFICACION", "BAJA"),
    allowNull: false
  },
  partida_anterior: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  partida_nueva: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  observaciones: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  usuario_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  fecha: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: "mtz_recursos_partida_historial",
  timestamps: false
});

export default MtzRecursosPartidaHistorial;
