/* 
========== IMPORTANTE ========== 
En este archivo se definen las relaciones entre los modelos Usuario, Rol y Municipio utilizando Sequelize.
================================= 
*/

import Usuario from './Usuario.js';
import Rol from './Rol.js';
import Municipio from './Municipio.js';
import EjercicioMesMunicipioAuditoria from './moduloEjercicios/EjercicioMesMunicipioAuditoria.js';
import EjercicioMesMunicipio from './moduloEjercicios/EjercicioMesMunicipio.js';
import EjercicioMes from './moduloEjercicios/EjercicioMes.js';
import PartidaGasto from './partidas/PartidaGasto.js';
import PartidaRecurso from './partidas/PartidaRecurso.js';
import Recurso from './moduloCargaDatos/Recurso.js';
import Gasto from './moduloCargaDatos/Gasto.js';
import Personal from './moduloCargaDatos/Personal.js';
import Archivo from './moduloCargaDatos/Archivo.js';
import SituacionRevista from './moduloCargaDatos/SituacionRevista.js';
import Poblacion from './moduloCargaDatos/Poblacion.js';
import PartidaEconomico from './puentes/PartidaEconomico.js';
import EconomicoGasto from './clasificacionEconomica/EconomicoGasto.js';

// Relación muchos a muchos con Rol
Usuario.belongsToMany(Rol, {
  through: 'ovif_usuario_rol',
  foreignKey: 'usuario_id',
  otherKey: 'rol_id'
});

// Relación muchos a muchos con Municipio
Usuario.belongsToMany(Municipio, {
  through: 'ovif_usuario_municipio',
  foreignKey: 'usuario_id',
  otherKey: 'municipio_id'
});

// Relación muchos a muchos con Usuario
Rol.belongsToMany(Usuario, {
  through: 'ovif_usuario_rol',
  foreignKey: 'rol_id',
  otherKey: 'usuario_id'
});

// Relación muchos a muchos con Usuario
Municipio.belongsToMany(Usuario, {
  through: 'ovif_usuario_municipio',
  foreignKey: 'municipio_id',
  otherKey: 'usuario_id'
});

EjercicioMesMunicipioAuditoria.belongsTo(Usuario, {
  foreignKey: "usuario_id",
});

Gasto.belongsTo(Municipio, { foreignKey: "municipio_id" });
Gasto.belongsTo(PartidaGasto, { foreignKey: "cod_partida_gasto" });

Recurso.belongsTo(Municipio, { foreignKey: "municipio_id" });
Recurso.belongsTo(PartidaRecurso, { foreignKey: "cod_partida_recurso" });

Personal.belongsTo(Municipio, { foreignKey: "municipio_id" });

Archivo.belongsTo(Municipio, { foreignKey: "municipio_id" });

Personal.belongsTo(Municipio, { foreignKey: "municipio_id" });
Personal.belongsTo(SituacionRevista, { foreignKey: "id_situacion_revista" });

Poblacion.belongsTo(Municipio, { foreignKey: "municipio_id" });

// PartidaGasto ↔ PartidaEconomico
PartidaGasto.hasMany(PartidaEconomico, { foreignKey: "cod_partida_gasto" });
PartidaEconomico.belongsTo(PartidaGasto, { foreignKey: "cod_partida_gasto" });

// PartidaEconomico ↔ EconomicoGasto
PartidaEconomico.belongsTo(EconomicoGasto, { foreignKey: "cod_economico" });
EconomicoGasto.hasMany(PartidaEconomico, { foreignKey: "cod_economico" });



export {
  Usuario, 
  Rol, 
  Municipio, 
  EjercicioMesMunicipioAuditoria, 
  EjercicioMesMunicipio, 
  EjercicioMes,
  Gasto,
  Recurso,
  Personal,
  Archivo,
  PartidaGasto,
  PartidaRecurso, 
  SituacionRevista,
  PartidaEconomico,
  EconomicoGasto,
  Poblacion 
};
