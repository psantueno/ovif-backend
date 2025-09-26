import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const Poblacion = sequelize.define("Poblacion", {
  id_poblacion: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  ejercicio: { type: DataTypes.INTEGER, allowNull: false }, // año del registro
  municipio_id: { type: DataTypes.INTEGER, allowNull: false },
  cantidad: { type: DataTypes.INTEGER, allowNull: false }, // población estimada o censada
}, {
  tableName: "ovif_poblacion",
  timestamps: false,
});

export default Poblacion;
