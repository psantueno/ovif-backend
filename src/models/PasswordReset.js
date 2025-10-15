// models/PasswordReset.js
import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const PasswordReset = sequelize.define("ovif_password_resets", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  usuario_id: { type: DataTypes.INTEGER, allowNull: false },
  token_hash: { type: DataTypes.STRING(255), allowNull: false, unique: true },
  expires_at: { type: DataTypes.DATE, allowNull: false },
  used_at: { type: DataTypes.DATE, allowNull: true },
  requested_ip: { type: DataTypes.STRING(45), allowNull: true },
}, {
  tableName: "ovif_password_resets",
  timestamps: true,
  createdAt: "created_at",
  updatedAt: false,
});

export default PasswordReset;
