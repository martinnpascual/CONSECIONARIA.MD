-- ============================================================
-- 011_config_tradein_rls.sql
-- DM Cars — Políticas RLS para config (businesses) y trade_ins
-- Ejecutar DESPUÉS de 009_rls_policies.sql y 010_documents.sql
-- ============================================================

-- ──────────────────────────────────────────────
-- Helpers (reusar los ya creados en 009)
-- ──────────────────────────────────────────────
-- get_my_role() ya existe desde migración 009

-- ──────────────────────────────────────────────
-- businesses (configuración de la concesionaria)
-- ──────────────────────────────────────────────

-- Todos los usuarios autenticados pueden leer la config
CREATE POLICY IF NOT EXISTS "businesses_select_authenticated"
  ON public.businesses FOR SELECT
  TO authenticated
  USING (true);

-- Solo admin puede modificar la config
CREATE POLICY IF NOT EXISTS "businesses_update_admin"
  ON public.businesses FOR UPDATE
  TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');

-- Nadie puede insertar/borrar desde el cliente (solo service_role)
CREATE POLICY IF NOT EXISTS "businesses_insert_service"
  ON public.businesses FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY IF NOT EXISTS "businesses_delete_service"
  ON public.businesses FOR DELETE
  TO authenticated
  USING (false);

-- ──────────────────────────────────────────────
-- trade_ins (toma de usados)
-- ──────────────────────────────────────────────

-- Todos los autenticados pueden ver trade-ins
CREATE POLICY IF NOT EXISTS "trade_ins_select_authenticated"
  ON public.trade_ins FOR SELECT
  TO authenticated
  USING (true);

-- Vendedor y admin pueden crear trade-ins
CREATE POLICY IF NOT EXISTS "trade_ins_insert_vendedor"
  ON public.trade_ins FOR INSERT
  TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'vendedor'));

-- Admin y vendedor pueden actualizar
CREATE POLICY IF NOT EXISTS "trade_ins_update_vendedor"
  ON public.trade_ins FOR UPDATE
  TO authenticated
  USING (get_my_role() IN ('admin', 'vendedor'))
  WITH CHECK (get_my_role() IN ('admin', 'vendedor'));

-- Solo admin puede eliminar (soft delete preferido)
CREATE POLICY IF NOT EXISTS "trade_ins_delete_admin"
  ON public.trade_ins FOR DELETE
  TO authenticated
  USING (get_my_role() = 'admin');

-- ──────────────────────────────────────────────
-- Verificar que RLS está activo en ambas tablas
-- ──────────────────────────────────────────────
ALTER TABLE public.businesses  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_ins   ENABLE ROW LEVEL SECURITY;
