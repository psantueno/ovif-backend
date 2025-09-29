import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const CronLog = sequelize.define("CronLog", {
  id_log: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nombre_tarea: { type: DataTypes.STRING(100), allowNull: false },
  ejercicio: { type: DataTypes.INTEGER, allowNull: true },
  mes: { type: DataTypes.INTEGER, allowNull: true },
  municipio_id: { type: DataTypes.INTEGER, allowNull: true },
  estado: { type: DataTypes.ENUM("OK", "ERROR"), allowNull: false },
  mensaje: { type: DataTypes.TEXT, allowNull: true },
}, {
  tableName: "ovif_cron_logs",
  timestamps: true,
  createdAt: "fecha", 
  updatedAt: false,   
});

export default CronLog;

