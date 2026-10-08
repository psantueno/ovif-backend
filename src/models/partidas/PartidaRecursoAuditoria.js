/*
Auditoría (solo inserción) del ABM de ovif_partidas_recursos.
Sin FK a propósito: tiene que sobrevivir a cambios de código y a la baja de
usuarios (la autoría queda también como texto en usuario_descripcion).
La tabla tiene triggers que impiden UPDATE y DELETE.
Ver scripts/sql/2026-10-partidas-recursos-abm.sql.
*/

import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

// MariaDB guarda JSON como LONGTEXT y lo devuelve como string con el dialecto
// mysql: se serializa y parsea a mano para no depender del driver.
const columnaJson = (nombre) => ({
  type: DataTypes.TEXT("long"),
  allowNull: true,
  get() {
    const valor = this.getDataValue(nombre);
    if (valor === null || valor === undefined) return null;
    if (typeof valor !== "string") return valor;
    try {
      return JSON.parse(valor);
    } catch {
      return null;
    }
  },
  set(valor) {
    this.setDataValue(nombre, valor === null || valor === undefined ? null : JSON.stringify(valor));
  },
});

const PartidaRecursoAuditoria = sequelize.define("PartidaRecursoAuditoria", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  partida_codigo: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  partida_codigo_anterior: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  accion: {
    type: DataTypes.ENUM("ALTA", "MODIFICACION", "BAJA", "REACTIVACION"),
    allowNull: false
  },
  operacion_id: {
    type: DataTypes.CHAR(36),
    allowNull: true
  },
  datos_anteriores: columnaJson("datos_anteriores"),
  datos_nuevos: columnaJson("datos_nuevos"),
  observaciones: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  usuario_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  usuario_descripcion: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  fecha: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: "ovif_partidas_recursos_auditoria",
  timestamps: false
});

export default PartidaRecursoAuditoria;
