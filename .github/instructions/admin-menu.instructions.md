---
applyTo: "src/routes/**,src/controllers/auth.controller.js"
---

# Menú del Panel de Administración (`/admin` del frontend)

El menú admin vive **solo en el frontend** (`ovif-frontend`, `src/app/pages/admin/admin-menu/`). El backend no tiene endpoint, tabla ni columna para él: el buscador, el orden A–Z/personalizado y el orden que arma cada usuario se resuelven en el navegador y se guardan en `localStorage` (clave `ovif.adminMenu.prefs.v1.<userId>`). No agregues persistencia en base de datos para esto salvo que se pida explícitamente (por ejemplo, para sincronizar el orden entre dispositivos).

El detalle completo está en `ovif-frontend/.github/instructions/admin-menu.instructions.md`.

## Qué depende del backend

### `id` del usuario

El frontend arma la clave de preferencias con `user.id` (con fallback a `user.usuario_id`). Ese `id` sale de `loadFullUser` en `src/controllers/auth.controller.js`, que mapea `id: user.usuario_id` en las respuestas de login y perfil.

- No renombres ni quites `id` de ese payload: cada usuario perdería su orden guardado y se compartiría el default.
- Si cambia el identificador (por ejemplo, a un UUID), los órdenes guardados quedan huérfanos: no rompe nada, pero cada usuario vuelve al orden por defecto. Avisá en el PR.

### Rol `administrador`

El acceso a `/admin` lo controla `AdminGuard` en el frontend leyendo los roles del usuario (`Roles[].nombre === 'administrador'`). Los endpoints admin siguen necesitando su propia validación de rol en el backend: el menú y el guard son solo UX, no seguridad.

## Al agregar un módulo admin nuevo

Si creás rutas/controladores para un módulo administrable nuevo, la tarjeta del menú no aparece sola. En el frontend hay que:

1. Agregar la ruta en `src/app/app.routes.ts` con `canActivate: [AdminGuard]`.
2. Agregar una entrada en `ADMIN_MENU_ITEMS` (`src/app/pages/admin/admin-menu/admin-menu.items.ts`) con un `id` estable igual a la ruta sin `/admin/`.

No hace falta tocar HTML ni migrar preferencias: la tarjeta nueva aparece al final del orden personalizado de cada usuario.
