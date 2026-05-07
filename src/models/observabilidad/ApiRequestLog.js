import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const ApiRequestLog = sequelize.define("ApiRequestLog", {
  request_log_id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  fecha: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  usuario_id: { type: DataTypes.INTEGER, allowNull: true },
  method: { type: DataTypes.STRING(10), allowNull: false },
  original_url: { type: DataTypes.TEXT, allowNull: false },
  route_pattern: { type: DataTypes.STRING(255), allowNull: true },
  status_code: { type: DataTypes.INTEGER, allowNull: false },
  duration_ms: { type: DataTypes.INTEGER, allowNull: false },
  response_bytes: { type: DataTypes.INTEGER, allowNull: true },
  ip: { type: DataTypes.STRING(100), allowNull: true },
  user_agent: { type: DataTypes.STRING(512), allowNull: true },
  module: { type: DataTypes.STRING(80), allowNull: true },
  status_family: { type: DataTypes.STRING(3), allowNull: true },
  is_error: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  is_slow: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  is_bot: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  bot_type: { type: DataTypes.STRING(40), allowNull: true },
  limiter: { type: DataTypes.STRING(80), allowNull: true },
  rate_limit_key: { type: DataTypes.STRING(191), allowNull: true },
  rate_limit_used: { type: DataTypes.INTEGER, allowNull: true },
  rate_limit_limit: { type: DataTypes.INTEGER, allowNull: true },
  rate_limit_remaining: { type: DataTypes.INTEGER, allowNull: true },
  is_rate_limited: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
}, {
  tableName: "ovif_api_request_logs",
  timestamps: false,
  indexes: [
    { fields: ["fecha"] },
    { fields: ["usuario_id"] },
    { fields: ["route_pattern"] },
    { fields: ["status_code"] },
    { fields: ["is_rate_limited"] },
    { fields: ["fecha", "route_pattern"] },
    { fields: ["fecha", "usuario_id"] },
    { fields: ["fecha", "status_code"] },
    { fields: ["fecha", "module"] },
    { fields: ["usuario_id", "fecha"] },
  ],
});

export default ApiRequestLog;
