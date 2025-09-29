/*
Es un puente que vincula una partida de gastos (ovif_partidas_gastos) con su 
clasificación económica. La clasificación económica agrupa las partidas en 
niveles (ejemplo: Corrientes vs Capital, Ingresos Tributarios vs No Tributarios).
*/

import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const PartidaEconomico = sequelize.define("PartidaEconomico", {
  cod_partida: {            // FK → ovif_partidas_gastos.partidas_gastos_codigo
    type: DataTypes.INTEGER,
    allowNull: false,
    primaryKey: true
  },
  cod_tipo_proyecto: {      // distingue el “tipo” (p.ej. gastos vs recursos)
    type: DataTypes.INTEGER,
    allowNull: false,
    primaryKey: true
  },
  cod_economico: {          // FK → ovif_economico_gastos.cod_economico
    type: DataTypes.INTEGER,
    allowNull: false
  }
}, {
  tableName: "ovif_partidas_economico",
  timestamps: false,
  indexes: [
    { fields: ["cod_economico"] } // útil para reportes
  ]
});

export default PartidaEconomico;
