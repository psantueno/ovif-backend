// SEQUELIZE
import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Usuario = sequelize.define(
    "Usuario",
    {
        usuario_id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        usuario: {
            type: DataTypes.STRING(100),
            allowNull: false,
            unique: true,
        },
        email: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        password: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        nombre: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        apellido: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        activo: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
        },
        fecha_creacion: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        },
        fecha_actualizacion: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        },

    },
    {
        tableName: "ovif_usuarios",
        timestamps: true,
        createdAt: "fecha_creacion",
        updatedAt: "fecha_actualizacion",
    }
);

export default Usuario;
