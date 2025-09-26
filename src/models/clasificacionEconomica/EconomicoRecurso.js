// Modelo de clasificación económica para recursos.

import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const EconomicoRecurso = sequelize.define("EconomicoRecurso", {
  cod_economico: { type: DataTypes.INTEGER, primaryKey: true, allowNull: false },
  descripcion:   { type: DataTypes.STRING(100), allowNull: false },
  nivel:         { type: DataTypes.INTEGER, allowNull: false },
  cod_economico_padre: { type: DataTypes.INTEGER, allowNull: true },
}, {
  tableName: "ovif_economico_recursos",
  timestamps: false,
});

// Autorelación (árbol)
EconomicoRecurso.hasMany(EconomicoRecurso, {
  as: "hijos",
  foreignKey: "cod_economico_padre",
});
EconomicoRecurso.belongsTo(EconomicoRecurso, {
  as: "padre",
  foreignKey: "cod_economico_padre",
});

export default EconomicoRecurso;
