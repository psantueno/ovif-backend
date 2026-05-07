import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const RateLimitEvent = sequelize.define("RateLimitEvent", {
  rate_limit_event_id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  fecha: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  usuario_id: { type: DataTypes.INTEGER, allowNull: true },
  limiter: { type: DataTypes.STRING(80), allowNull: false },
  method: { type: DataTypes.STRING(10), allowNull: false },
  original_url: { type: DataTypes.TEXT, allowNull: false },
  route_pattern: { type: DataTypes.STRING(255), allowNull: true },
  status_code: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 429 },
  ip: { type: DataTypes.STRING(100), allowNull: true },
  user_agent: { type: DataTypes.STRING(512), allowNull: true },
  rate_limit_key: { type: DataTypes.STRING(191), allowNull: true },
  rate_limit_used: { type: DataTypes.INTEGER, allowNull: true },
  rate_limit_limit: { type: DataTypes.INTEGER, allowNull: true },
  rate_limit_remaining: { type: DataTypes.INTEGER, allowNull: true },
  reset_time: { type: DataTypes.DATE, allowNull: true },
}, {
  tableName: "ovif_rate_limit_events",
  timestamps: false,
  indexes: [
    { fields: ["fecha"] },
    { fields: ["usuario_id"] },
    { fields: ["limiter"] },
    { fields: ["route_pattern"] },
    { fields: ["fecha", "limiter"] },
  ],
});

export default RateLimitEvent;
