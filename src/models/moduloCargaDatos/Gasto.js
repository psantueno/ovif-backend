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
  partidas_gastos_codigo: {
    type: DataTypes.INTEGER,
    primaryKey: true
  },
  municipio_id: {
    type: DataTypes.INTEGER,
    primaryKey: true
  },
  gastos_importe_devengado: {
    type: DataTypes.DECIMAL(20,2),
    allowNull: false
  }},
  {
  tableName: "ovif_gastos",
  timestamps: true,
  createdAt: "fecha_creacion",
  updatedAt: "fecha_actualizacion"
});

export default Gasto;
