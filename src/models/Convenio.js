import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Convenio = sequelize.define(
    "Convenio",
    {
        convenio_id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        nombre: {
            type: DataTypes.STRING(150),
            allowNull: false,
        },
        descripcion: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        fecha_inicio: {
            type: DataTypes.DATEONLY,
            allowNull: false,
        },
        fecha_fin: {
            type: DataTypes.DATEONLY,
            allowNull: false,
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
        tableName: "ovif_convenios",
        timestamps: true,
        createdAt: "fecha_creacion",
        updatedAt: "fecha_actualizacion",
    }
);

export default Convenio;
