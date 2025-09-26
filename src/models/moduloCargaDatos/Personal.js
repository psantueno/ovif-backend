import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const Personal = sequelize.define("Personal", {
  id_personal: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  ejercicio: { type: DataTypes.INTEGER, allowNull: false },
  mes: { type: DataTypes.INTEGER, allowNull: false },
  municipio_id: { type: DataTypes.INTEGER, allowNull: false },
  cantidad: { type: DataTypes.INTEGER, allowNull: false },
  id_situacion_revista: { type: DataTypes.INTEGER, allowNull: false },
}, {
  tableName: "ovif_personal",
  timestamps: false,
});

export default Personal;
