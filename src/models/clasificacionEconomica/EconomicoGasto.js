// Modelo de clasificación económica para gastos.

import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const EconomicoGasto = sequelize.define("EconomicoGasto", {
  cod_economico: { type: DataTypes.INTEGER, primaryKey: true, allowNull: false },
  descripcion:   { type: DataTypes.STRING(100), allowNull: false },
  nivel:         { type: DataTypes.INTEGER, allowNull: false },
  cod_economico_padre: { type: DataTypes.INTEGER, allowNull: true },
}, {
  tableName: "ovif_economico_gastos",
  timestamps: false,
});

// Autorelación (árbol)
EconomicoGasto.hasMany(EconomicoGasto, {
  as: "hijos",
  foreignKey: "cod_economico_padre",
});
EconomicoGasto.belongsTo(EconomicoGasto, {
  as: "padre",
  foreignKey: "cod_economico_padre",
});

export default EconomicoGasto;

