import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const SituacionRevista = sequelize.define("SituacionRevista", {
  id_situacion_revista: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  descripcion: { type: DataTypes.STRING(100), allowNull: false },
}, {
  tableName: "ovif_situacion_revista",
  timestamps: false,
});

export default SituacionRevista;
