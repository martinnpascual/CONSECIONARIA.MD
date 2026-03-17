-- ============================================================
-- 009_rls_policies.sql — Row Level Security (RLS)
-- DM Cars — Sesión S-01
-- IMPORTANTE: Ejecutar DESPUÉS de todas las migraciones anteriores
-- ============================================================

-- ──────────────────────────────────────────────
-- Habilitar RLS en TODAS las tablas
-- ──────────────────────────────────────────────
ALTER TABLE public.user_profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.businesses            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_photos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.persons               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interactions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.person_vehicle_interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_payments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_ins             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_orders           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_order_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_registers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_movements        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consignments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents             ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────
-- user_profiles
-- ──────────────────────────────────────────────
-- El usuario puede leer y actualizar SU PROPIO perfil
CREATE POLICY "user_profiles: ver propio"
    ON public.user_profiles FOR SELECT
    USING (id = auth.uid());

CREATE POLICY "user_profiles: actualizar propio"
    ON public.user_profiles FOR UPDATE
    USING (id = auth.uid());

-- Admin puede ver y gestionar todos los perfiles
CREATE POLICY "user_profiles: admin total"
    ON public.user_profiles FOR ALL
    USING (public.get_my_role() = 'admin');

-- ──────────────────────────────────────────────
-- businesses
-- ──────────────────────────────────────────────
-- Todos los usuarios autenticados pueden leer datos de la empresa (para el membrete)
CREATE POLICY "businesses: leer autenticado"
    ON public.businesses FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- Solo admin puede modificar datos de la empresa
CREATE POLICY "businesses: admin escribe"
    ON public.businesses FOR ALL
    USING (public.get_my_role() = 'admin');

-- ──────────────────────────────────────────────
-- vehicles
-- ──────────────────────────────────────────────
-- Todos los autenticados pueden leer vehículos (sin soft delete)
-- PERO la columna cost_price se oculta vía función en el backend
CREATE POLICY "vehicles: leer autenticado"
    ON public.vehicles FOR SELECT
    USING (auth.uid() IS NOT NULL AND deleted_at IS NULL);

-- Admin y vendedor pueden crear/editar vehículos
CREATE POLICY "vehicles: admin y vendedor escriben"
    ON public.vehicles FOR INSERT
    WITH CHECK (public.get_my_role() IN ('admin', 'vendedor'));

CREATE POLICY "vehicles: admin y vendedor actualizan"
    ON public.vehicles FOR UPDATE
    USING (public.get_my_role() IN ('admin', 'vendedor'));

-- Solo admin puede borrar (soft delete)
CREATE POLICY "vehicles: admin elimina"
    ON public.vehicles FOR DELETE
    USING (public.get_my_role() = 'admin');

-- ──────────────────────────────────────────────
-- vehicle_photos y vehicle_price_history
-- ──────────────────────────────────────────────
CREATE POLICY "vehicle_photos: leer autenticado"
    ON public.vehicle_photos FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "vehicle_photos: admin y vendedor gestionan"
    ON public.vehicle_photos FOR ALL
    USING (public.get_my_role() IN ('admin', 'vendedor'));

-- Historial de precios: solo admin puede verlo
CREATE POLICY "vehicle_price_history: solo admin"
    ON public.vehicle_price_history FOR ALL
    USING (public.get_my_role() = 'admin');

-- ──────────────────────────────────────────────
-- persons (CRM)
-- ──────────────────────────────────────────────
-- Admin ve todos los leads/clientes
CREATE POLICY "persons: admin total"
    ON public.persons FOR ALL
    USING (public.get_my_role() = 'admin' AND deleted_at IS NULL);

-- Vendedor solo ve sus propios leads/clientes asignados
CREATE POLICY "persons: vendedor ve los suyos"
    ON public.persons FOR SELECT
    USING (
        public.get_my_role() = 'vendedor'
        AND assigned_seller_id = auth.uid()
        AND deleted_at IS NULL
    );

CREATE POLICY "persons: vendedor crea"
    ON public.persons FOR INSERT
    WITH CHECK (
        public.get_my_role() = 'vendedor'
        AND assigned_seller_id = auth.uid()
    );

CREATE POLICY "persons: vendedor actualiza los suyos"
    ON public.persons FOR UPDATE
    USING (
        public.get_my_role() = 'vendedor'
        AND assigned_seller_id = auth.uid()
    );

-- Cajero puede ver clientes para cobros
CREATE POLICY "persons: cajero lee"
    ON public.persons FOR SELECT
    USING (public.get_my_role() = 'cajero' AND deleted_at IS NULL);

-- ──────────────────────────────────────────────
-- interactions
-- ──────────────────────────────────────────────
CREATE POLICY "interactions: admin total"
    ON public.interactions FOR ALL
    USING (public.get_my_role() = 'admin');

CREATE POLICY "interactions: vendedor ve y crea en sus personas"
    ON public.interactions FOR SELECT
    USING (
        public.get_my_role() = 'vendedor'
        AND EXISTS (
            SELECT 1 FROM public.persons p
            WHERE p.id = interactions.person_id
            AND p.assigned_seller_id = auth.uid()
        )
    );

CREATE POLICY "interactions: vendedor crea en sus personas"
    ON public.interactions FOR INSERT
    WITH CHECK (
        public.get_my_role() = 'vendedor'
        AND EXISTS (
            SELECT 1 FROM public.persons p
            WHERE p.id = person_id
            AND p.assigned_seller_id = auth.uid()
        )
    );

-- person_vehicle_interests: misma lógica que interactions
CREATE POLICY "pvi: admin total"
    ON public.person_vehicle_interests FOR ALL
    USING (public.get_my_role() = 'admin');

CREATE POLICY "pvi: vendedor sus personas"
    ON public.person_vehicle_interests FOR ALL
    USING (
        public.get_my_role() = 'vendedor'
        AND EXISTS (
            SELECT 1 FROM public.persons p
            WHERE p.id = person_id
            AND p.assigned_seller_id = auth.uid()
        )
    );

-- ──────────────────────────────────────────────
-- sales
-- ──────────────────────────────────────────────
CREATE POLICY "sales: admin total"
    ON public.sales FOR ALL
    USING (public.get_my_role() = 'admin' AND deleted_at IS NULL);

-- Vendedor ve sus propias ventas
CREATE POLICY "sales: vendedor ve las suyas"
    ON public.sales FOR SELECT
    USING (
        public.get_my_role() = 'vendedor'
        AND seller_id = auth.uid()
        AND deleted_at IS NULL
    );

CREATE POLICY "sales: vendedor crea"
    ON public.sales FOR INSERT
    WITH CHECK (
        public.get_my_role() = 'vendedor'
        AND seller_id = auth.uid()
    );

CREATE POLICY "sales: vendedor actualiza las suyas"
    ON public.sales FOR UPDATE
    USING (
        public.get_my_role() = 'vendedor'
        AND seller_id = auth.uid()
    );

-- Cajero puede leer ventas para cobros
CREATE POLICY "sales: cajero lee"
    ON public.sales FOR SELECT
    USING (public.get_my_role() = 'cajero' AND deleted_at IS NULL);

-- sale_payments: admin y cajero gestionan; vendedor ve las suyas
CREATE POLICY "sale_payments: admin total"
    ON public.sale_payments FOR ALL
    USING (public.get_my_role() = 'admin');

CREATE POLICY "sale_payments: cajero gestiona"
    ON public.sale_payments FOR ALL
    USING (public.get_my_role() = 'cajero');

CREATE POLICY "sale_payments: vendedor lee las suyas"
    ON public.sale_payments FOR SELECT
    USING (
        public.get_my_role() = 'vendedor'
        AND EXISTS (
            SELECT 1 FROM public.sales s
            WHERE s.id = sale_payments.sale_id
            AND s.seller_id = auth.uid()
        )
    );

-- trade_ins: admin y vendedor
CREATE POLICY "trade_ins: admin total"
    ON public.trade_ins FOR ALL
    USING (public.get_my_role() = 'admin');

CREATE POLICY "trade_ins: vendedor en sus ventas"
    ON public.trade_ins FOR ALL
    USING (
        public.get_my_role() = 'vendedor'
        AND EXISTS (
            SELECT 1 FROM public.sales s
            WHERE s.id = trade_ins.sale_id
            AND s.seller_id = auth.uid()
        )
    );

-- ──────────────────────────────────────────────
-- work_orders
-- ──────────────────────────────────────────────
CREATE POLICY "work_orders: admin total"
    ON public.work_orders FOR ALL
    USING (public.get_my_role() = 'admin' AND deleted_at IS NULL);

-- Mecánico ve solo sus OTs
CREATE POLICY "work_orders: mecanico ve las suyas"
    ON public.work_orders FOR SELECT
    USING (
        public.get_my_role() = 'mecanico'
        AND mechanic_id = auth.uid()
        AND deleted_at IS NULL
    );

CREATE POLICY "work_orders: mecanico actualiza las suyas"
    ON public.work_orders FOR UPDATE
    USING (
        public.get_my_role() = 'mecanico'
        AND mechanic_id = auth.uid()
    );

-- Vendedor puede crear OTs
CREATE POLICY "work_orders: vendedor crea"
    ON public.work_orders FOR INSERT
    WITH CHECK (public.get_my_role() IN ('vendedor', 'admin'));

CREATE POLICY "work_orders: vendedor lee"
    ON public.work_orders FOR SELECT
    USING (public.get_my_role() = 'vendedor' AND deleted_at IS NULL);

-- work_order_items: hereda del acceso a work_orders
CREATE POLICY "wo_items: admin total"
    ON public.work_order_items FOR ALL
    USING (public.get_my_role() = 'admin');

CREATE POLICY "wo_items: mecanico en sus OTs"
    ON public.work_order_items FOR ALL
    USING (
        public.get_my_role() IN ('mecanico', 'vendedor')
        AND EXISTS (
            SELECT 1 FROM public.work_orders wo
            WHERE wo.id = work_order_items.work_order_id
            AND (wo.mechanic_id = auth.uid() OR public.get_my_role() = 'vendedor')
        )
    );

-- ──────────────────────────────────────────────
-- cash_registers y cash_movements
-- ──────────────────────────────────────────────
-- Solo admin y cajero acceden a caja
CREATE POLICY "cash_registers: admin y cajero"
    ON public.cash_registers FOR ALL
    USING (public.get_my_role() IN ('admin', 'cajero'));

CREATE POLICY "cash_movements: admin y cajero"
    ON public.cash_movements FOR ALL
    USING (public.get_my_role() IN ('admin', 'cajero'));

-- ──────────────────────────────────────────────
-- consignments
-- ──────────────────────────────────────────────
CREATE POLICY "consignments: admin total"
    ON public.consignments FOR ALL
    USING (public.get_my_role() = 'admin' AND deleted_at IS NULL);

CREATE POLICY "consignments: vendedor lee"
    ON public.consignments FOR SELECT
    USING (public.get_my_role() = 'vendedor' AND deleted_at IS NULL);

-- ──────────────────────────────────────────────
-- invoices y documents
-- ──────────────────────────────────────────────
-- Solo admin puede emitir facturas; todos autenticados pueden leer las propias
CREATE POLICY "invoices: admin total"
    ON public.invoices FOR ALL
    USING (public.get_my_role() = 'admin');

CREATE POLICY "invoices: vendedor y cajero leen"
    ON public.invoices FOR SELECT
    USING (public.get_my_role() IN ('vendedor', 'cajero'));

-- Documentos: todos leen, solo admin y vendedor crean
CREATE POLICY "documents: leer autenticado"
    ON public.documents FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "documents: admin y vendedor crean"
    ON public.documents FOR INSERT
    WITH CHECK (public.get_my_role() IN ('admin', 'vendedor'));

-- ──────────────────────────────────────────────
-- Storage policies (Supabase Storage)
-- ──────────────────────────────────────────────
-- Bucket: vehicle-photos (público para lectura)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'vehicle-photos',
    'vehicle-photos',
    TRUE,                               -- Público: fotos visibles sin auth
    10485760,                           -- 10 MB máximo por foto
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
) ON CONFLICT (id) DO NOTHING;

-- Bucket: documents (privado, requiere auth)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'documents',
    'documents',
    FALSE,                              -- Privado: documentos confidenciales
    52428800,                           -- 50 MB máximo
    ARRAY['application/pdf']
) ON CONFLICT (id) DO NOTHING;

-- Storage policies para vehicle-photos
CREATE POLICY "vehicle-photos: lectura pública"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'vehicle-photos');

CREATE POLICY "vehicle-photos: admin y vendedor suben"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'vehicle-photos'
        AND auth.uid() IS NOT NULL
        AND public.get_my_role() IN ('admin', 'vendedor')
    );

CREATE POLICY "vehicle-photos: admin y vendedor eliminan"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'vehicle-photos'
        AND public.get_my_role() IN ('admin', 'vendedor')
    );

-- Storage policies para documents (solo autenticados)
CREATE POLICY "documents: autenticado lee"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "documents: admin y vendedor suben"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'documents'
        AND public.get_my_role() IN ('admin', 'vendedor')
    );
