import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const parseJsonFallback = (value) => {
    if (typeof value !== "string") return value;

    try {
        return JSON.parse(value);
    } catch {
        return value;
    }
};

const SolicitudProrrogaEstados = sequelize.define(
    "SolicitudProrrogaEstados",
    {
        movimiento_id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        solicitud_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        accion: {
            type: DataTypes.ENUM("CREADA", "EDITADA", "CANCELADA", "APROBADA", "RECHAZADA"),
            allowNull: false,
        },
        estado_anterior: {
            type: DataTypes.ENUM("PENDIENTE", "APROBADA", "RECHAZADA", "CANCELADA"),
            allowNull: true,
        },
        estado_nuevo: {
            type: DataTypes.ENUM("PENDIENTE", "APROBADA", "RECHAZADA", "CANCELADA"),
            allowNull: false,
        },
        payload_anterior: {
            type: DataTypes.JSON,
            allowNull: true,
            get() {
                return parseJsonFallback(this.getDataValue("payload_anterior"));
            },
        },
        payload_nuevo: {
            type: DataTypes.JSON,
            allowNull: true,
            get() {
                return parseJsonFallback(this.getDataValue("payload_nuevo"));
            },
        },
        usuario_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        fecha_evento: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        },
        comentario: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
    },
    {
        tableName: "ovif_solicitud_prorroga_estados",
        timestamps: false,
    }
);

export default SolicitudProrrogaEstados;
