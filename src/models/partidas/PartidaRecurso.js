/*
Es un catálogo de partidas presupuestarias de recursos.
Cada recurso debe clasificarse en una partida presupuestaria
*/

import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const PartidaRecurso = sequelize.define("PartidaRecurso", {
  partidas_recursos_codigo: { type: DataTypes.INTEGER, primaryKey: true },
  partidas_recursos_descripcion: { type: DataTypes.TEXT, allowNull: false },
  partidas_recursos_padre: { type: DataTypes.INTEGER, allowNull: false },
  partidas_recursos_sl: { type: DataTypes.BOOLEAN, allowNull: false },
  partidas_recursos_carga: { type: DataTypes.BOOLEAN, allowNull: false }
}, {
  tableName: "ovif_partidas_recursos",
  timestamps: false
});

export default PartidaRecurso;
