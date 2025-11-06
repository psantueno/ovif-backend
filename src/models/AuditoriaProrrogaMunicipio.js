import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const AuditoriaProrrogaMunicipio = sequelize.define(
    "AuditoriaProrrogaMunicipio",
    {
        auditoria_id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        prorroga_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
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
        fecha_cambio: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        },
        fecha_fin_anterior: {
            type: DataTypes.DATEONLY,
            allowNull: false,
        },
        fecha_fin_prorrogada: {
            type: DataTypes.DATEONLY,
            allowNull: false,
        },
        tipo: {
            type: DataTypes.ENUM("PRORROGA", "RECTIFICATIVA", "AMPLIACION"),
            allowNull: false,
            defaultValue: "PRORROGA",
        },
        motivo: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        gestionado_por: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        observaciones: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
    },
    {
        tableName: "ovif_auditoria_prorroga_municipio",
        timestamps: false,
    }
);

export default AuditoriaProrrogaMunicipio;
