import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const DeterminacionTributaria = sequelize.define(
  "DeterminacionTributaria",
  {
    determinacion_ejercicio: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false,
    },
    determinacion_mes: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false,
    },
    municipio_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false,
    },
    cod_impuesto: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false,
    },
    descripcion: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    anio: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    cuota: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    liquidadas: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    importe_liquidadas: {
      type: DataTypes.DECIMAL(36, 2),
      allowNull: false,
    },
    impagas: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    importe_impagas: {
      type: DataTypes.DECIMAL(36, 2),
      allowNull: false,
    },
    pagadas: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    importe_pagadas: {
      type: DataTypes.DECIMAL(36, 2),
      allowNull: false,
    },
    altas_periodo: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    bajas_periodo: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    tableName: "ovif_determinacion_tributaria",
    timestamps: false,
  }
);

export default DeterminacionTributaria;
