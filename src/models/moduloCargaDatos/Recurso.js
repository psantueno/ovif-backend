import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const Recurso = sequelize.define("Recurso", {
  id_recurso: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  ejercicio: { type: DataTypes.INTEGER, allowNull: false },
  mes: { type: DataTypes.INTEGER, allowNull: false },
  municipio_id: { type: DataTypes.INTEGER, allowNull: false },
  cod_partida_recurso: { type: DataTypes.INTEGER, allowNull: false },
  monto: { type: DataTypes.DECIMAL(15,2), allowNull: false },
  descripcion: { type: DataTypes.STRING(255), allowNull: true },
}, {
  tableName: "ovif_recursos",
  timestamps: false,
});


export default Recurso;
