import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const Archivo = sequelize.define("Archivo", {
  id_archivo: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  ejercicio: { type: DataTypes.INTEGER, allowNull: false },
  mes: { type: DataTypes.INTEGER, allowNull: false },
  municipio_id: { type: DataTypes.INTEGER, allowNull: false },
  nombre: { type: DataTypes.STRING(255), allowNull: false },
  ruta: { type: DataTypes.STRING(500), allowNull: false },
  tipo: { type: DataTypes.STRING(50), allowNull: true },
}, {
  tableName: "ovif_archivos",
  timestamps: false,
});


export default Archivo;
