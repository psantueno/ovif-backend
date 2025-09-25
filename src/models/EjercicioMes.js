import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

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
}, {
  tableName: "ovif_ejercicios_meses",
  timestamps: false,
});

export default EjercicioMes;
