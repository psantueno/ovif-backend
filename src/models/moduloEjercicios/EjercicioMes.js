import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const EjercicioMes = sequelize.define("EjercicioMes", {
  ejercicio: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    allowNull: false,
  },
  mes: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    allowNull: false,
  },
  fecha_inicio: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  fecha_fin: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  fecha_creacion: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  fecha_actualizacion: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  creado_por: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  modificado_por: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
}, {
  tableName: "ovif_ejercicios_meses",
  timestamps: true,
  createdAt: "fecha_creacion",
  updatedAt: "fecha_actualizacion",
});

export default EjercicioMes;
