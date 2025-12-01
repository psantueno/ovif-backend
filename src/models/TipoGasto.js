import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const TipoGasto = sequelize.define("TipoGasto", {
  tipo_gasto_id: {
    type: DataTypes.INTEGER,
    primaryKey: true
  },
  descripcion: {
    type: DataTypes.TEXT,
    allowNull: false
  }
}, {
  tableName: "ovif_tipo_gasto",
  timestamps: true,
  createdAt: "fecha_creacion",
  updatedAt: "fecha_actualizacion"
});

export default TipoGasto;
