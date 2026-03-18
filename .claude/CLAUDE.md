# CLAUDE.md — DM Cars

## Proyecto
Sistema DMS (Dealer Management System) para la Concesionaria DM Cars - Dante Mostajo.

## Fuente de Verdad
**Siempre leer `PRD.md` antes de cualquier tarea.** Es la especificación oficial del sistema.

## Stack
- Backend: FastAPI (Python 3.11+)
- Frontend: React 18 + TypeScript + Vite + TailwindCSS
- Base de datos: Supabase (PostgreSQL)
- Auth: Supabase Auth
- Storage: Supabase Storage (fotos de vehículos y documentos PDF)
- Realtime: Supabase Realtime (dashboard)
- PDF: WeasyPrint + Jinja2
- Facturación: MrBot API + pyafipws (ARCA/AFIP)

## Reglas de Desarrollo

### Generales
1. No implementar funcionalidad que no esté en el PRD.
2. Código en inglés, comentarios y UI en español.
3. Commits en español con prefijos: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`
4. No hardcodear valores de configuración. Siempre usar `.env`.
5. Soft delete en todas las tablas críticas (campo `deleted_at`).

### Supabase
- El `service_role` key **SOLO** va en el backend. **NUNCA** en el frontend.
- RLS siempre activo en todas las tablas.
- El frontend usa el `anon` key — solo puede hacer lo que RLS permite.
- Migraciones versionadas en `backend/db/migrations/`.
- Nunca modificar tablas existentes sin una nueva migración SQL.

### Seguridad crítica
- El campo `precio_costo` de vehículos **NUNCA** aparece en documentos PDF.
- El campo `precio_costo` **SOLO** es visible para usuarios con rol `admin`.
- Los certificados AFIP (.crt, .key) **NUNCA** se commitean al repositorio.

### Backend
- `async` en todos los endpoints.
- Separación estricta: `routers/` → `services/` → Supabase.
- Nunca lógica de negocio en los routers.
- Validación de inputs con Pydantic schemas.

### Frontend
- Componentes < 200 líneas. Dividir si excede.
- Debounce de 300ms en buscadores.
- Loading skeletons en lugar de spinners genéricos.
- El precio de costo nunca se renderiza si `user.role !== 'admin'`.

## Dominio del Negocio

### Tipos de vehículos
- **nuevo**: directo de fábrica, sin uso
- **usado**: con kilometraje y propietario anterior
- **consignacion**: de un tercero, la concesionaria cobra comisión

### Estados de un vehículo
`disponible` → `reservado` → `vendido` | `baja`

### Estados de una venta
`cotizacion` → `reserva` → `en_proceso` → `entregada` | `cancelada`

### Estados de un lead (CRM)
`nuevo` → `contactado` → `interesado` → `en_negociacion` → `cerrado_ganado` | `cerrado_perdido`

### Roles de usuario
- `admin`: acceso total
- `vendedor`: solo sus leads/ventas, sin precio de costo
- `cajero`: solo caja y cobros
- `mecanico`: solo órdenes de trabajo

## Módulos del Sistema
1. Stock de Vehículos (M01)
2. CRM — Clientes y Leads (M02)
3. Proceso de Ventas (M03)
4. Toma de Usados (M04)
5. Taller / Posventa (M05)
6. Caja y Financiero (M06)
7. Consignaciones (M07)
8. Documentos PDF (M08)
9. Facturación ARCA (M09)
10. Dashboard y Reportes (M10)
11. Gestión de Usuarios (M11)

## Contexto de Sesiones Dev Manager
- Máximo 10.000 tokens por sesión
- Un branch por sesión: `session/NNN`
- Leer PROJECT_SPEC.md al iniciar cada sesión
- Registrar errores y mejoras en Supabase al cerrar
