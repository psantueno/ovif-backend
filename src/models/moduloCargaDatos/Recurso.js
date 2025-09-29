
import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const Recurso = sequelize.define("Recurso", {
  recursos_ejercicio: {
    type: DataTypes.INTEGER,
    primaryKey: true
  },
  recursos_mes: {
    type: DataTypes.INTEGER,
    primaryKey: true
  },
  partidas_recursos_codigo: {
    type: DataTypes.INTEGER,
    primaryKey: true
  },
  municipio_id: {
    type: DataTypes.INTEGER,
    primaryKey: true
  },
  recursos_importe_percibido: {
    type: DataTypes.DECIMAL(20,2),
    allowNull: false
  },
  recursos_cantidad_contribuyentes: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  recursos_cantidad_pagaron: {
    type: DataTypes.INTEGER,
    allowNull: false
  }
}, {
  tableName: "ovif_recursos",
  timestamps: true,
  createdAt: "fecha_creacion",
  updatedAt: "fecha_actualizacion"
});

export default Recurso;

