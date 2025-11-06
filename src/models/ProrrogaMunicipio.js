import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const ProrrogaMunicipio = sequelize.define(
    "ProrrogaMunicipio",
    {
        prorroga_id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        ejercicio: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        mes: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        municipio_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        convenio_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        pauta_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        fecha_fin_nueva: {
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
        tableName: "ovif_prorroga_municipio",
        timestamps: true,
        createdAt: "fecha_creacion",
        updatedAt: "fecha_actualizacion",
        indexes: [
            {
                unique: true,
                fields: [
                    "ejercicio",
                    "mes",
                    "municipio_id",
                    "pauta_id",
                    "convenio_id",
                ],
                name: "uk_prorroga",
            },
        ],
    }
);

export default ProrrogaMunicipio;
