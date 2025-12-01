import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const RegimenLaboral = sequelize.define("RegimenLaboral", {
  regimen_id: {
    type: DataTypes.INTEGER,
    primaryKey: true
  },
  nombre: {
    type: DataTypes.STRING(100),
    allowNull: false
  }
}, {
  tableName: "ovif_regimen_laboral",
  timestamps: true,
  createdAt: "fecha_creacion",
  updatedAt: "fecha_actualizacion"
});

export default RegimenLaboral;
