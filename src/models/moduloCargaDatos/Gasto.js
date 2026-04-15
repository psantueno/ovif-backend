import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const Gasto = sequelize.define("Gasto", {
  gastos_ejercicio: {
    type: DataTypes.INTEGER,
    primaryKey: true
  },
  gastos_mes: {
    type: DataTypes.INTEGER,
    primaryKey: true
  },
  codigo_partida: {
    type: DataTypes.INTEGER,
    primaryKey: true
  },
  municipio_id: {
    type: DataTypes.INTEGER,
    primaryKey: true
  },
  descripcion: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  codigo_fuente_financiera: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  descripcion_fuente: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  formulado: {
    type: DataTypes.DECIMAL(36, 2),
    allowNull: false
  },
  modificado: {
    type: DataTypes.DECIMAL(36, 2),
    allowNull: false
  },
  vigente: {
    type: DataTypes.DECIMAL(36, 2),
    allowNull: false
  },
  devengado: {
    type: DataTypes.DECIMAL(36, 2),
    allowNull: false
  }},
  {
  tableName: "ovif_gastos",
  timestamps: true,
  createdAt: "fecha_creacion",
  updatedAt: "fecha_actualizacion"
});

export default Gasto;
