/*
Este modelo representa los envíos de correos electrónicos relacionados con el módulo de ejercicios y reestablecimiento de contraseñas. Cada vez que se programa un envío de correo, se crea un 
registro en esta tabla con el estado "PENDIENTE". Un proceso separado se encarga de procesar estos registros, intentar enviar los correos, y actualizar el estado a "ENVIANDO", "ENVIADO" o "ERROR" 
según corresponda. El campo `payload` almacena la información necesaria para renderizar el correo (como nombre del destinatario, ejercicio, mes, módulos, etc.) y se utiliza para generar el contenido 
del correo al momento de enviarlo.
Cada registro corresponde a un intento de envío de correo, con su estado actual, número de intentos realizados, y datos necesarios para renderizar el correo.
*/

import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const EnvioCorreo = sequelize.define("EnvioCorreo", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  idempotency_key: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
  },
  tipo: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: "Tipo de mail: CIERRE_MODULOS, RESET_PASSWORD, etc.",
  },
  destinatario: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  nombre_destinatario: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  asunto: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  payload: {
    type: DataTypes.JSON,
    allowNull: false,
    comment: "Datos necesarios para renderizar el mail",
  },
  estado: {
    type: DataTypes.ENUM("PENDIENTE", "ENVIANDO", "ENVIADO", "ERROR"),
    allowNull: false,
    defaultValue: "PENDIENTE",
  },
  intentos: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  max_intentos: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 5,
  },
  ultimo_error: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  next_retry_at: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: DataTypes.NOW,
  },
  enviado_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  message_id: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: "Message-ID devuelto por el servidor SMTP",
  },
}, {
  tableName: "ovif_envio_correos",
  timestamps: true,
  createdAt: "created_at",
  updatedAt: "updated_at",
  indexes: [
    { fields: ["estado", "next_retry_at"] },
    { fields: ["idempotency_key"], unique: true },
    { fields: ["tipo"] },
  ],
});

export default EnvioCorreo;
