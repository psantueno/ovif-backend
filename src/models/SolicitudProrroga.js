import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const SolicitudProrroga = sequelize.define(
    "SolicitudProrroga",
    {
        solicitud_id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        grupo_solicitud_id: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        municipio_id: {
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
        convenio_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        pauta_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        prorroga_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        fecha_cierre_solicitada: {
            type: DataTypes.DATEONLY,
            allowNull: false,
        },
        fecha_cierre_anterior: {
            type: DataTypes.DATEONLY,
            allowNull: true,
        },
        fecha_cierre_aprobada: {
            type: DataTypes.DATEONLY,
            allowNull: true,
        },
        motivo: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        estado: {
            type: DataTypes.ENUM("PENDIENTE", "APROBADA", "RECHAZADA", "CANCELADA"),
            allowNull: false,
            defaultValue: "PENDIENTE",
        },
        tipo: {
            type: DataTypes.ENUM("AMPLIACION_PLAZO", "CORRECCION_DATOS"),
            allowNull: true,
        },
        solicitado_por: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        fecha_solicitud: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        },
        actualizado_por: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        resuelto_por: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        fecha_resolucion: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        comentario_resolucion: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        cancelado_por: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        fecha_cancelacion: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        motivo_cancelacion: {
            type: DataTypes.TEXT,
            allowNull: true,
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
        tableName: "ovif_solicitudes_prorroga",
        timestamps: true,
        createdAt: "fecha_creacion",
        updatedAt: "fecha_actualizacion",
    }
);

export default SolicitudProrroga;
