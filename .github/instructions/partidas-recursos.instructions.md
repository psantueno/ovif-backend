---
applyTo: "src/controllers/partidas-recursos.controller.js,src/routes/partidasRecursos.routes.js,src/services/partidasRecursos.service.js,src/services/matrices/**,src/models/partidas/**,src/models/matrices/**,src/utils/partidasRecursos.js,src/validation/PartidasRecursosSchema.validation.js,src/validation/MatricesSchema.validation.js,src/controllers/matrices.controller.js,src/controllers/conceptosRecaudacion.controller.js,scripts/sql/*partidas*,scripts/sql/*matrices*,tests/partidasRecursos.test.js"
---

# Clasificador de Recursos por Rubros (`ovif_partidas_recursos`) y su ABM

Este archivo da el contexto para modificar el catálogo de partidas de recursos, su ABM y todo lo que depende de él (matrices de homogeneización y conceptos de recaudación). Leelo entero antes de tocar cualquiera de esos archivos: casi todas las reglas existen para no dejar referencias inválidas.

## Qué es el clasificador

Es la lista de partidas provinciales con la que OVIF clasifica los recursos que informan los municipios: 129 partidas al 2026-10, 87 imputables. Es una adaptación municipal del clasificador de recursos por rubro del *Manual de Clasificaciones Presupuestarias para el Sector Público Provincial* de Neuquén (2011).

### Estructura del código

En la UI y en los mensajes al usuario se habla de **desagregación**, no de "hijas": "Desagrega en 3 clases", "Sin desagregación", "posee desagregación". En el código y en este archivo, "hija" = partida del nivel inferior.


8 dígitos: `TT C K SS 00`. El manual define 6: tipo (2) + clase (1) + concepto (1) + subconcepto (2). El `00` final es una convención de OVIF que se ve en los datos; el manual no la establece.

- El padre se **deduce** del código poniendo en cero el último campo no nulo: `11310100 → 11310000 → 11300000 → 11000000 → 0`. Nunca se edita a mano.
- El subconcepto (nivel 4) no admite hijas.
- Funciones: `src/utils/partidasRecursos.js` (`derivarPadre`, `nivelPartida`, `admiteHijas`, `esCodigoPartidaValido`). El frontend replica las mismas en `partidas-recursos.model.ts`; si cambiás una, cambiá la otra.

### Columnas y flags

| Columna | Significado |
| --- | --- |
| `partidas_recursos_carga` | Imputable: se puede asignar en matrices. Si es 0, la partida solo agrupa a sus hijas |
| `partidas_recursos_sl` | "Sin liquidación". Con `sl=0` la carga legacy pedía además cantidad de contribuyentes y cantidad que pagaron (solo 11310100, 11320100, 11320400). Hoy ningún código lo lee. `sl=1` exige `carga=1` |
| `activo` | Baja lógica. Agregada por `scripts/sql/2026-10-partidas-recursos-abm.sql` |
| `partidas_recursos_padre` | Derivado del código (ver arriba); 0 para los tipos |

## Quién depende del catálogo

| Tabla | Relación | Notas |
| --- | --- | --- |
| `mtz_recursos_partida`, `mtz_recaudacion_partida` | FK `ON DELETE RESTRICT`, `ON UPDATE CASCADE` | Solo admiten partidas imputables y activas (`validarPartidaImputable`) |
| `mtz_*_partida_historial` | `partida_anterior` / `partida_nueva` **sin FK** | Guardan códigos históricos |
| `ovif_conceptos_recaudacion.cod_recurso` | FK `ON UPDATE CASCADE` | La tabla **no tiene clave primaria**; el modelo `ConceptoRecaudacion` declara `cod_concepto` como PK pero esa columna no existe (problema previo). No usar el modelo para buscar o actualizar conceptos por clave: usar SQL por `cod_recurso` |
| `ovif_recursos_legacy.partidas_recursos_codigo` | FK `ON UPDATE CASCADE` | Carga histórica 2012+, unas 420.000 filas. Nunca se modifica |
| `ovif_recursos_economico.cod_recurso` | **Sin FK**, MyISAM | Clasificación económica. 27 partidas imputables no la tienen y 144 códigos apuntan a partidas inexistentes |
| `ovif_recursos` (carga actual) | Ninguna directa | Usa el código municipal; se clasifica a través de `mtz_recursos_partida` |

## Reglas de negocio (implementadas en `src/services/partidasRecursos.service.js`)

Principio: **nunca dejar una correspondencia de matriz o un concepto apuntando a una partida que no se puede asignar.** Antes de un cambio que lo provocaría, el sistema pide reasignar.

| Operación | Regla |
| --- | --- |
| Alta | Código nuevo y válido; padre derivado existente y activo. **No** se crea una hija bajo un padre imputable: eso es "Abrir partida" |
| Cambio de código | Solo si la partida nunca fue usada: ni en matrices, ni en sus historiales, ni en conceptos, ni en legacy, ni en clasificación económica, ni como padre de otra partida |
| Cambio de descripción | Permitido; la UI confirma si está en uso porque las matrices muestran la descripción vigente |
| `carga` 1 → 0 | Bloqueado mientras la usen matrices o conceptos |
| `carga` 0 → 1 | Bloqueado si tiene hijas activas |
| Baja (`activo` → 0) | Bloqueada mientras la usen matrices o conceptos, o si tiene hijas activas |
| Reactivación | Padre activo y no imputable |
| Abrir partida | Ver abajo |

Hay 9 partidas imputables con hijas, previas al ABM (por ejemplo 17200000). Quedan como están; el listado las marca con `imputable_con_hijas`.

### Abrir partida (`abrirPartida`, `POST /api/partidas-recursos/:codigo/apertura`)

Desagrega una partida imputable en una sola transacción:

1. Crea las hijas como imputables.
2. Reasigna cada correspondencia de ambas matrices a una hija u otra partida imputable activa, y deja una fila MODIFICACION en el historial de la matriz con la observación `Apertura de partida X`.
3. Pasa todos los conceptos a un único destino.
4. Deja al padre con `carga=0, sl=0`.

El pedido tiene que cubrir **exactamente** las referencias actuales; si no, 409 sin aplicar nada. Todas las filas de auditoría de la operación comparten `operacion_id`.

**Sin vigencia:** las matrices no tienen `desde`/`hasta`. Reasignar una correspondencia reclasifica todos los períodos de `ovif_recursos`, también los anteriores. Es una decisión funcional vigente y está pendiente de validación con el cliente. No agregues vigencia sin que se decida; si se decide, impacta la clave única de las matrices, sus servicios, la UI y los informes.

## Invariantes que no hay que romper

- **Auditoría de solo inserción.** `ovif_partidas_recursos_auditoria` tiene triggers que abortan `UPDATE` y `DELETE`. Nunca la reescribas. El historial de una partida se arma con `reconstruirHistorialPartida`: sigue los cambios de código hacia atrás por `partida_codigo_anterior`, cortando por `id`, para no mezclar un código reutilizado.
- **Todo cambio de partida pasa por el servicio**, en transacción, con `FOR UPDATE` sobre la fila y la auditoría en la misma transacción. Nada de `UPDATE` directos sobre `ovif_partidas_recursos`: un cambio hecho por fuera no queda auditado.
- **No se borran partidas físicamente.**
- **`validarPartidaImputable(codigo, transaction)` se llama siempre con la transacción.** Lee la partida con `LOCK IN SHARE MODE`; así una baja o un "quitar imputable" concurrente (que toma `FOR UPDATE`) queda serializado y ve la asignación. Sin la transacción vuelve la carrera que dejaba correspondencias inválidas.
- Al actualizar una correspondencia **sin cambiar su partida** no se revalida la partida: editar observaciones no debe depender del estado de la partida.
- **Concurrencia por valores originales:** `PUT`, `PATCH .../estado` y la apertura reciben `original` (descripción, sl, carga, activo tal como se leyeron) y responden 409 con `detalle.motivo = "concurrencia"` si la fila cambió.
- El usuario de la auditoría sale de `req.user`, nunca del body. Se guarda también `usuario_descripcion` (nombre y apellido) para no perder la autoría.

## API (`src/routes/partidasRecursos.routes.js`, solo administradores)

| Método y ruta | Uso |
| --- | --- |
| `GET /select?imputables=1&incluir=<codigo>` | Catálogo para selects: solo activas; `incluir` agrega una inactiva para mostrar el valor actual en un diálogo |
| `GET /` | Listado paginado (`search`, `estado`, `imputable`) con `en_uso`, `codigo_editable`, `referencias`, `hijas_activas`. Con `todas=1` devuelve el catálogo completo sin paginar (tope 2000); es lo que usa la pantalla, que muestra un árbol y filtra en el cliente |
| `POST /` | Alta |
| `PUT /:codigo` | Modificación, con `original` |
| `PATCH /:codigo/estado` | Baja o reactivación, con `original` |
| `GET /:codigo/referencias` | Correspondencias y conceptos que la usan, para el asistente de apertura |
| `POST /:codigo/apertura` | Abrir partida |
| `GET /:codigo/historial` | Historial reconstruido, con `cambios` campo por campo |

`/select` va declarada antes que `/:codigo`.

## Trampas conocidas

- La columna de descripción es latin1 (cp1252 en MariaDB): `esRepresentableEnLatin1` rechaza lo que fallaría al guardar en modo estricto (por ejemplo emojis o `№`).
- MariaDB devuelve las columnas JSON como texto con el dialecto mysql: el modelo de auditoría serializa y parsea a mano.
- `COUNT(*)` y `EXISTS` crudos pueden volver como string: convertir con `Number()`.
- El frontend cachea el catálogo de partidas al abrir las matrices; tras cambios en el ABM hay que recargar esa pantalla.

## Despliegue y vuelta atrás

- **Orden:** primero el script SQL, después el código. El modelo `PartidaRecurso` incluye `activo`, así que el código nuevo falla contra una base sin esa columna.
- **Vuelta atrás:** primero el código anterior, después la base. Detalle en el bloque 4 del script.

## Tests

- `npx vitest run tests/partidasRecursos.test.js`: estructura del código, diff de auditoría, reconstrucción del historial (incluido un código reutilizado) y esquemas Zod.
- Las reglas que dependen de la base se probaron sobre una copia de las tablas. Si cambiás el servicio, repetí esa prueba en una base de prueba, nunca en la de test compartida.
