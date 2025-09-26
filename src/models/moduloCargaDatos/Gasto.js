import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const Gasto = sequelize.define("Gasto", {
  id_gasto: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  ejercicio: { type: DataTypes.INTEGER, allowNull: false },
  mes: { type: DataTypes.INTEGER, allowNull: false },
  municipio_id: { type: DataTypes.INTEGER, allowNull: false },
  cod_partida_gasto: { type: DataTypes.INTEGER, allowNull: false },
  monto: { type: DataTypes.DECIMAL(15,2), allowNull: false },
  descripcion: { type: DataTypes.STRING(255), allowNull: true },
}, {
  tableName: "ovif_gastos",
  timestamps: false,
});

export default Gasto;
