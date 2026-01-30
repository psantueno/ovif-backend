import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const SituacionRevista = sequelize.define("SituacionRevista", {
  situacion_revista_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nombre: { type: DataTypes.STRING(100), allowNull: false },
  regimen_id: { type: DataTypes.INTEGER }
}, {
  tableName: "ovif_situacion_revista",
  timestamps: true,
  createdAt: "fecha_creacion",
  updatedAt: "fecha_actualizacion"
});

export default SituacionRevista;
