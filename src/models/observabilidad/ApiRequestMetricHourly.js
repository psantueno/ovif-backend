import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const ApiRequestMetricHourly = sequelize.define("ApiRequestMetricHourly", {
  metric_hourly_id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  hour_bucket: { type: DataTypes.DATE, allowNull: false },
  module: { type: DataTypes.STRING(80), allowNull: false, defaultValue: "unknown" },
  route_pattern: { type: DataTypes.STRING(255), allowNull: false, defaultValue: "unknown" },
  method: { type: DataTypes.STRING(10), allowNull: false, defaultValue: "UNKNOWN" },
  status_family: { type: DataTypes.STRING(3), allowNull: false, defaultValue: "0xx" },
  limiter: { type: DataTypes.STRING(80), allowNull: false, defaultValue: "none" },
  total_requests: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  total_4xx: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  total_5xx: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  total_429: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  avg_duration_ms: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
  max_duration_ms: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  p95_duration_ms: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  total_response_bytes: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0 },
  usuarios_activos: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
  tableName: "ovif_api_request_metrics_hourly",
  timestamps: false,
  indexes: [
    { unique: true, fields: ["hour_bucket", "module", "route_pattern", "method", "status_family", "limiter"], name: "uq_ovif_api_metrics_hourly_bucket_dims" },
    { fields: ["hour_bucket"] },
    { fields: ["hour_bucket", "module"] },
    { fields: ["hour_bucket", "route_pattern"] },
  ],
});

export default ApiRequestMetricHourly;
