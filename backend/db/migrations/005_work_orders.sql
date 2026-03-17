-- ============================================================
-- 005_work_orders.sql — Taller / Posventa
-- DM Cars — Sesión S-01
-- ============================================================

-- ──────────────────────────────────────────────
-- TABLA: work_orders — Órdenes de Trabajo del taller
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.work_orders (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Número correlativo: OT-2026-0001
    order_number            TEXT UNIQUE NOT NULL,

    status                  TEXT NOT NULL DEFAULT 'recibido'
                                CHECK (status IN (
                                    'recibido', 'en_proceso', 'listo',
                                    'entregado', 'cancelado'
                                )),

    -- Tipo de trabajo
    work_type               TEXT NOT NULL DEFAULT 'reparacion'
                                CHECK (work_type IN (
                                    'service', 'reparacion', 'chapa_pintura',
                                    'preparacion_venta', 'garantia', 'otro'
                                )),

    -- Fechas
    entry_date              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    estimated_delivery_date DATE,
    actual_delivery_date    DATE,

    -- Vehículo (puede ser del stock propio o externo)
    -- Si es del stock propio:
    vehicle_id              UUID REFERENCES public.vehicles(id),
    -- Si es externo (cliente trae su auto):
    external_vehicle        JSONB,              -- {brand, model, year, plate, mileage}

    -- Cliente
    client_id               UUID REFERENCES public.persons(id),

    -- Mecánico asignado
    mechanic_id             UUID REFERENCES auth.users(id),

    -- Descripción del trabajo solicitado
    description             TEXT NOT NULL,
    observations            TEXT,

    -- Totales calculados (se actualizan al modificar items)
    labor_cost              NUMERIC(15,2) NOT NULL DEFAULT 0,
    parts_cost              NUMERIC(15,2) NOT NULL DEFAULT 0,
    total                   NUMERIC(15,2) GENERATED ALWAYS AS (labor_cost + parts_cost) STORED,

    -- Factura asociada (cuando se factura el servicio)
    invoice_id              UUID,               -- FK se agrega en 008_invoices.sql

    -- Soft delete
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at              TIMESTAMPTZ
);

COMMENT ON TABLE public.work_orders IS 'Órdenes de trabajo del taller de la concesionaria';
COMMENT ON COLUMN public.work_orders.external_vehicle IS 'Datos del vehículo si no es del stock propio';
COMMENT ON COLUMN public.work_orders.total IS 'Calculado: mano de obra + repuestos';

CREATE INDEX idx_wo_status ON public.work_orders(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_wo_mechanic ON public.work_orders(mechanic_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_wo_vehicle ON public.work_orders(vehicle_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_wo_client ON public.work_orders(client_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_wo_entry_date ON public.work_orders(entry_date DESC) WHERE deleted_at IS NULL;

-- Trigger updated_at
CREATE TRIGGER trg_work_orders_updated_at
    BEFORE UPDATE ON public.work_orders
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ──────────────────────────────────────────────
-- SECUENCIA para order_number: OT-YYYY-NNNN
-- ──────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.work_order_number_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_work_order_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
        NEW.order_number := 'OT-' || TO_CHAR(NOW(), 'YYYY') || '-' ||
                            LPAD(nextval('public.work_order_number_seq')::TEXT, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_work_order_number
    BEFORE INSERT ON public.work_orders
    FOR EACH ROW EXECUTE FUNCTION public.generate_work_order_number();

-- ──────────────────────────────────────────────
-- TABLA: work_order_items — Ítems de cada OT
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.work_order_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_order_id   UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,

    item_type       TEXT NOT NULL CHECK (item_type IN ('labor', 'part', 'other')),
    description     TEXT NOT NULL,

    -- Para repuestos (parts)
    part_code       TEXT,
    quantity        NUMERIC(10,2) NOT NULL DEFAULT 1,
    unit_price      NUMERIC(15,2) NOT NULL,
    subtotal        NUMERIC(15,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.work_order_items IS 'Ítems de órdenes de trabajo: mano de obra y repuestos';

CREATE INDEX idx_wo_items_work_order_id ON public.work_order_items(work_order_id);

-- ──────────────────────────────────────────────
-- FUNCIÓN: actualizar totales de la OT al modificar ítems
-- ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_work_order_totals()
RETURNS TRIGGER AS $$
DECLARE
    v_work_order_id UUID;
BEGIN
    -- Obtener el ID de la OT (puede ser INSERT, UPDATE o DELETE)
    v_work_order_id := COALESCE(NEW.work_order_id, OLD.work_order_id);

    UPDATE public.work_orders
    SET
        labor_cost = COALESCE((
            SELECT SUM(subtotal) FROM public.work_order_items
            WHERE work_order_id = v_work_order_id AND item_type = 'labor'
        ), 0),
        parts_cost = COALESCE((
            SELECT SUM(subtotal) FROM public.work_order_items
            WHERE work_order_id = v_work_order_id AND item_type IN ('part', 'other')
        ), 0)
    WHERE id = v_work_order_id;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_wo_items_update_totals
    AFTER INSERT OR UPDATE OR DELETE ON public.work_order_items
    FOR EACH ROW EXECUTE FUNCTION public.update_work_order_totals();
