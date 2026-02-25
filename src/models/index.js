/* 
============================================== IMPORTANTE ==================================================
En este archivo se definen las relaciones entre los modelos Usuario, Rol y Municipio utilizando Sequelize.
============================================================================================================
*/
import Usuario from './Usuario.js';
import Rol from './Rol.js';
import Municipio from './Municipio.js';
import EjercicioMes from './moduloEjercicios/EjercicioMes.js';
import PartidaGasto from './partidas/PartidaGasto.js';
import PartidaRecurso from './partidas/PartidaRecurso.js';
import Recurso from './moduloCargaDatos/Recurso.js';
import Gasto from './moduloCargaDatos/Gasto.js';
import Archivo from './moduloCargaDatos/Archivo.js';
import SituacionRevista from './moduloCargaDatos/SituacionRevista.js';
import Remuneracion from './moduloCargaDatos/Remuneracion.js';
import ConceptoRecaudacion from './ConceptoRecaudacion.js';
import Recaudacion from './moduloCargaDatos/Recaudacion.js';
import RecaudacionRectificada from './rectificaciones/RecaudacionRectificada.js';
import RemuneracionRectificada from './rectificaciones/RemuneracionRectificada.js';
import RegimenLaboral from './RegimenLaboral.js';
import TipoGasto from './TipoGasto.js';
import Poblacion from './moduloCargaDatos/Poblacion.js';
import PartidaEconomico from './puentes/PartidaEconomico.js';
import EconomicoGasto from './clasificacionEconomica/EconomicoGasto.js';
import EjercicioMesCerrado from './moduloEjercicios/EjercicioMesCerrado.js';
import CronLog from './moduloEjercicios/CronLog.js';
import CierreModulo from './moduloEjercicios/CierreModulo.js';
import RecursoEconomico from './puentes/RecursoEconomico.js';
import EconomicoRecurso from './clasificacionEconomica/EconomicoRecurso.js';
import PasswordReset from './PasswordReset.js';
import TokenBlacklist from './TokenBlacklist.js';
import UsuarioMunicipio from './UsuarioMunicipio.js';
import UsuarioRol from './UsuarioRol.js';
import Convenio from './Convenio.js';
import PautaConvenio from './PautaConvenio.js';
import ProrrogaMunicipio from './ProrrogaMunicipio.js';
import AuditoriaProrrogaMunicipio from './AuditoriaProrrogaMunicipio.js';
import Parametros from './Parametros.js';


// Relación muchos a muchos con Rol
Usuario.belongsToMany(Rol, {
  as: 'Roles',
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
  as: 'Usuarios',
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

Convenio.hasMany(PautaConvenio, { foreignKey: "convenio_id" });
PautaConvenio.belongsTo(Convenio, { foreignKey: "convenio_id" });
Convenio.hasMany(EjercicioMes, { foreignKey: "convenio_id" });
PautaConvenio.hasMany(EjercicioMes, { foreignKey: "pauta_id" });
Convenio.hasMany(ProrrogaMunicipio, { foreignKey: "convenio_id" });
PautaConvenio.hasMany(ProrrogaMunicipio, { foreignKey: "pauta_id" });
Municipio.hasMany(ProrrogaMunicipio, { foreignKey: "municipio_id" });

EjercicioMes.belongsTo(Convenio, { foreignKey: "convenio_id" });
EjercicioMes.belongsTo(PautaConvenio, { foreignKey: "pauta_id" });
ProrrogaMunicipio.belongsTo(Municipio, { foreignKey: "municipio_id" });
ProrrogaMunicipio.belongsTo(Convenio, { foreignKey: "convenio_id" });
ProrrogaMunicipio.belongsTo(PautaConvenio, { foreignKey: "pauta_id" });

AuditoriaProrrogaMunicipio.belongsTo(ProrrogaMunicipio, { foreignKey: "prorroga_id" });
AuditoriaProrrogaMunicipio.belongsTo(Municipio, { foreignKey: "municipio_id" });
AuditoriaProrrogaMunicipio.belongsTo(Convenio, { foreignKey: "convenio_id" });
AuditoriaProrrogaMunicipio.belongsTo(PautaConvenio, { foreignKey: "pauta_id" });
AuditoriaProrrogaMunicipio.belongsTo(Usuario, { foreignKey: "gestionado_por" });
ProrrogaMunicipio.hasMany(AuditoriaProrrogaMunicipio, { foreignKey: "prorroga_id" });

Gasto.belongsTo(Municipio, { foreignKey: "municipio_id" });
Gasto.belongsTo(PartidaGasto, {
  foreignKey: "partidas_gastos_codigo",
  targetKey: "partidas_gastos_codigo"
});

Recurso.belongsTo(Municipio, { foreignKey: "municipio_id" });
Recurso.belongsTo(PartidaRecurso, { foreignKey: "partidas_recursos_codigo", targetKey: "partidas_recursos_codigo" });

Archivo.belongsTo(Municipio, { foreignKey: "municipio_id" });

ConceptoRecaudacion.belongsTo(PartidaRecurso, {
  foreignKey: "cod_recurso",
  targetKey: "partidas_recursos_codigo"
});
PartidaRecurso.hasMany(ConceptoRecaudacion, {
  foreignKey: "cod_recurso",
  sourceKey: "partidas_recursos_codigo"
});


Remuneracion.belongsTo(RegimenLaboral, { foreignKey: "regimen_id" });
RegimenLaboral.hasMany(Remuneracion, { foreignKey: "regimen_id" });
Remuneracion.belongsTo(TipoGasto, { foreignKey: "tipo_liquidacion" });
TipoGasto.hasMany(Remuneracion, { foreignKey: "tipo_liquidacion" });
RemuneracionRectificada.belongsTo(RegimenLaboral, { foreignKey: "regimen_id" });
RegimenLaboral.hasMany(RemuneracionRectificada, { foreignKey: "regimen_id" });
RemuneracionRectificada.belongsTo(TipoGasto, { foreignKey: "tipo_liquidacion" });
TipoGasto.hasMany(RemuneracionRectificada, { foreignKey: "tipo_liquidacion" });

Poblacion.belongsTo(Municipio, { foreignKey: "municipio_id" });

Recaudacion.belongsTo(Municipio, { foreignKey: "municipio_id" });
Recaudacion.belongsTo(ConceptoRecaudacion, { foreignKey: "cod_concepto", targetKey: "cod_concepto" });
ConceptoRecaudacion.hasMany(Recaudacion, { foreignKey: "cod_concepto", sourceKey: "cod_concepto" });
RecaudacionRectificada.belongsTo(Municipio, { foreignKey: "municipio_id" });
RecaudacionRectificada.belongsTo(ConceptoRecaudacion, { foreignKey: "cod_concepto", targetKey: "cod_concepto" });
ConceptoRecaudacion.hasMany(RecaudacionRectificada, { foreignKey: "cod_concepto", sourceKey: "cod_concepto" });

// PartidaGasto ↔ PartidaEconomico
PartidaGasto.hasMany(PartidaEconomico, {
  foreignKey: "cod_partida",
  sourceKey: "partidas_gastos_codigo"
});
PartidaEconomico.belongsTo(PartidaGasto, {
  foreignKey: "cod_partida",
  targetKey: "partidas_gastos_codigo"
});

// PartidaEconomico ↔ EconomicoGasto
PartidaEconomico.belongsTo(EconomicoGasto, {
  foreignKey: "cod_economico",
  targetKey: "cod_economico"
});
EconomicoGasto.hasMany(PartidaEconomico, {
  foreignKey: "cod_economico",
  sourceKey: "cod_economico"
});

EjercicioMesCerrado.belongsTo(Municipio, { foreignKey: "municipio_id" });
CierreModulo.belongsTo(Municipio, { foreignKey: "municipio_id" });
CierreModulo.belongsTo(Convenio, { foreignKey: "convenio_id" });
CierreModulo.belongsTo(PautaConvenio, { foreignKey: "pauta_id" });

PartidaRecurso.hasOne(RecursoEconomico, {
  foreignKey: "cod_recurso",                 // en ovif_recursos_economico
  sourceKey: "partidas_recursos_codigo"      // en ovif_partidas_recursos
});
RecursoEconomico.belongsTo(PartidaRecurso, {
  foreignKey: "cod_recurso",
  targetKey: "partidas_recursos_codigo"
});

RecursoEconomico.belongsTo(EconomicoRecurso, {
  foreignKey: "cod_economico",
  targetKey: "cod_economico"
});
EconomicoRecurso.hasMany(RecursoEconomico, {
  foreignKey: "cod_economico",
  sourceKey: "cod_economico"
});



export {
  Usuario, 
  Rol, 
  Municipio, 
  EjercicioMes,
  Gasto,
  Recurso,
  Archivo,
  PartidaGasto,
  PartidaRecurso, 
  SituacionRevista,
  PartidaEconomico,
  EconomicoGasto,
  Poblacion,
  EjercicioMesCerrado,
  CierreModulo,
  PasswordReset,
  TokenBlacklist,
  CronLog,
  UsuarioMunicipio,
  UsuarioRol,
  Convenio,
  PautaConvenio,
  ProrrogaMunicipio,
  AuditoriaProrrogaMunicipio,
  RegimenLaboral,
  TipoGasto,
  Remuneracion,
  ConceptoRecaudacion,
  Recaudacion,
  RecaudacionRectificada,
  RemuneracionRectificada,
  Parametros
};
