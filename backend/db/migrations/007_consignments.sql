-- ============================================================
-- 007_consignments.sql — Consignaciones de terceros
-- DM Cars — Sesión S-01
-- ============================================================

-- ──────────────────────────────────────────────
-- TABLA: consignments — Contratos de consignación
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.consignments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Número correlativo: CONS-2026-0001
    consignment_number  TEXT UNIQUE NOT NULL,

    status              TEXT NOT NULL DEFAULT 'activa'
                            CHECK (status IN ('activa', 'vendida', 'retirada')),

    -- Propietario del vehículo (consignante)
    owner_id            UUID NOT NULL REFERENCES public.persons(id),

    -- Vehículo en consignación (ingresado al stock con type='consignacion')
    vehicle_id          UUID NOT NULL REFERENCES public.vehicles(id),

    -- Venta asociada (cuando se vende el vehículo)
    sale_id             UUID REFERENCES public.sales(id),

    -- Términos de la consignación
    start_date          DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date            DATE,                       -- Fecha de vencimiento del contrato
    owner_floor_price   NUMERIC(15,2) NOT NULL,     -- Precio mínimo que acepta el propietario
    sale_price          NUMERIC(15,2),              -- Precio final de venta (se llena al vender)

    -- Comisión de la concesionaria
    commission_type     TEXT NOT NULL DEFAULT 'porcentaje'
                            CHECK (commission_type IN ('porcentaje', 'monto_fijo')),
    commission_value    NUMERIC(10,4) NOT NULL,     -- % o monto fijo según commission_type
    commission_amount   NUMERIC(15,2),              -- Monto calculado al vender

    -- Liquidación al propietario
    owner_settlement    NUMERIC(15,2),              -- sale_price - commission_amount
    settlement_date     DATE,
    settlement_paid     BOOLEAN NOT NULL DEFAULT FALSE,

    notes               TEXT,
    contract_doc_url    TEXT,                       -- URL del contrato PDF en Storage

    -- Soft delete
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

COMMENT ON TABLE public.consignments IS 'Contratos de consignación: vehículos de terceros vendidos por la concesionaria';
COMMENT ON COLUMN public.consignments.owner_floor_price IS 'Precio mínimo acordado con el propietario';
COMMENT ON COLUMN public.consignments.commission_type IS 'porcentaje = % del precio de venta, monto_fijo = ARS fijo';
COMMENT ON COLUMN public.consignments.owner_settlement IS 'Lo que recibe el propietario: precio_venta - comision';

CREATE INDEX idx_consignments_status ON public.consignments(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_consignments_owner ON public.consignments(owner_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_consignments_vehicle ON public.consignments(vehicle_id) WHERE deleted_at IS NULL;

-- Trigger updated_at
CREATE TRIGGER trg_consignments_updated_at
    BEFORE UPDATE ON public.consignments
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ──────────────────────────────────────────────
-- SECUENCIA para consignment_number: CONS-YYYY-NNNN
-- ──────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.consignment_number_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_consignment_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.consignment_number IS NULL OR NEW.consignment_number = '' THEN
        NEW.consignment_number := 'CONS-' || TO_CHAR(NOW(), 'YYYY') || '-' ||
                                  LPAD(nextval('public.consignment_number_seq')::TEXT, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_consignment_number
    BEFORE INSERT ON public.consignments
    FOR EACH ROW EXECUTE FUNCTION public.generate_consignment_number();

-- ──────────────────────────────────────────────
-- FUNCIÓN: calcular liquidación al marcar como vendida
-- ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.calculate_consignment_settlement()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'vendida' AND OLD.status != 'vendida' AND NEW.sale_price IS NOT NULL THEN
        -- Calcular comisión
        IF NEW.commission_type = 'porcentaje' THEN
            NEW.commission_amount := ROUND(NEW.sale_price * NEW.commission_value / 100, 2);
        ELSE
            NEW.commission_amount := NEW.commission_value;
        END IF;
        -- Calcular liquidación al propietario
        NEW.owner_settlement := NEW.sale_price - NEW.commission_amount;
        NEW.settlement_date := CURRENT_DATE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_consignment_settlement
    BEFORE UPDATE OF status ON public.consignments
    FOR EACH ROW EXECUTE FUNCTION public.calculate_consignment_settlement();

-- Agregar FK de vehicles a consignments (ahora que consignments existe)
ALTER TABLE public.vehicles
    ADD CONSTRAINT fk_vehicles_consignment
    FOREIGN KEY (consignment_id) REFERENCES public.consignments(id);
