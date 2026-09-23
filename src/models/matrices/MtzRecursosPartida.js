/*
Matriz de homogeneización: relaciona, por municipio, el codigo_recurso
informado por el municipio con la partida provincial de recursos.
Ver docs/sql/2026-09-matrices-homogeneizacion.sql.
*/

import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const MtzRecursosPartida = sequelize.define("MtzRecursosPartida", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  municipio_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  codigo_recurso: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  partida_recursos_codigo: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  observaciones: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  usuario_alta_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  usuario_modificacion_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: "mtz_recursos_partida",
  timestamps: true,
  createdAt: "fecha_creacion",
  updatedAt: "fecha_actualizacion"
});

export default MtzRecursosPartida;
