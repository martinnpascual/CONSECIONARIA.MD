-- ============================================================
-- 004_sales.sql — Ventas, Pagos y Toma de Usados
-- DM Cars — Sesión S-01
-- ============================================================

-- ──────────────────────────────────────────────
-- TABLA: sales — Operaciones de venta
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sales (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Número correlativo por año: 2026-0001
    sale_number         TEXT UNIQUE NOT NULL,

    -- Estado del proceso
    status              TEXT NOT NULL DEFAULT 'cotizacion'
                            CHECK (status IN (
                                'cotizacion', 'reserva', 'en_proceso',
                                'entregada', 'cancelada'
                            )),
    cancellation_reason TEXT,

    -- Fecha
    sale_date           DATE NOT NULL DEFAULT CURRENT_DATE,
    delivery_date       DATE,                   -- Fecha real de entrega

    -- Partes de la operación
    client_id           UUID NOT NULL REFERENCES public.persons(id),
    vehicle_id          UUID NOT NULL REFERENCES public.vehicles(id),
    seller_id           UUID NOT NULL REFERENCES auth.users(id),

    -- Tipo de operación y financiamiento
    operation_type      TEXT NOT NULL DEFAULT 'contado'
                            CHECK (operation_type IN (
                                'contado', 'financiado', 'plan_ahorro', 'combinado'
                            )),

    -- Precios
    list_price          NUMERIC(15,2) NOT NULL, -- Precio de lista al momento de la venta
    sale_price          NUMERIC(15,2) NOT NULL, -- Precio acordado
    discount            NUMERIC(15,2) DEFAULT 0,
    final_price         NUMERIC(15,2) NOT NULL, -- sale_price - discount

    -- Financiamiento (opcional)
    financed_amount     NUMERIC(15,2),
    financing_bank      TEXT,
    installments        INTEGER,
    installment_value   NUMERIC(15,2),
    interest_rate       NUMERIC(6,3),           -- Tasa nominal anual %

    -- Plan de ahorro (opcional)
    savings_plan_name   TEXT,
    savings_plan_group  TEXT,
    savings_plan_order  TEXT,

    -- Toma de usado (FK a trade_ins — se completa en S-04)
    trade_in_id         UUID,                   -- FK se agrega tras crear trade_ins

    -- Comisión del vendedor (calculada al cerrar)
    commission_amount   NUMERIC(15,2),
    commission_paid     BOOLEAN NOT NULL DEFAULT FALSE,

    observations        TEXT,

    -- Soft delete
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

COMMENT ON TABLE public.sales IS 'Operaciones de venta de vehículos';
COMMENT ON COLUMN public.sales.final_price IS 'Precio acordado menos descuento: lo que paga el cliente';
COMMENT ON COLUMN public.sales.commission_amount IS 'Calculado al entregar: (precio_venta - precio_costo) * % comisión';

CREATE INDEX idx_sales_status ON public.sales(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_sales_seller ON public.sales(seller_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_sales_client ON public.sales(client_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_sales_vehicle ON public.sales(vehicle_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_sales_date ON public.sales(sale_date DESC) WHERE deleted_at IS NULL;

-- Trigger updated_at
CREATE TRIGGER trg_sales_updated_at
    BEFORE UPDATE ON public.sales
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ──────────────────────────────────────────────
-- SECUENCIA para sale_number: YYYY-NNNN
-- ──────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.sale_number_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_sale_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.sale_number IS NULL OR NEW.sale_number = '' THEN
        NEW.sale_number := TO_CHAR(NOW(), 'YYYY') || '-' ||
                           LPAD(nextval('public.sale_number_seq')::TEXT, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sale_number
    BEFORE INSERT ON public.sales
    FOR EACH ROW EXECUTE FUNCTION public.generate_sale_number();

-- ──────────────────────────────────────────────
-- FUNCIÓN: lógica de negocio al cambiar estado de venta
-- ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_sale_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Al pasar a RESERVA: reservar el vehículo
    IF NEW.status = 'reserva' AND OLD.status != 'reserva' THEN
        UPDATE public.vehicles
        SET status = 'reservado', sale_id = NEW.id
        WHERE id = NEW.vehicle_id;
    END IF;

    -- Al ENTREGAR: vehículo pasa a vendido
    IF NEW.status = 'entregada' AND OLD.status != 'entregada' THEN
        UPDATE public.vehicles
        SET status = 'vendido',
            sale_date = CURRENT_DATE
        WHERE id = NEW.vehicle_id;
        -- Marcar lead/cliente como cerrado_ganado
        UPDATE public.persons
        SET lead_status = 'cerrado_ganado',
            person_type = 'cliente'
        WHERE id = NEW.client_id
        AND lead_status != 'cerrado_ganado';
    END IF;

    -- Al CANCELAR: liberar el vehículo
    IF NEW.status = 'cancelada' AND OLD.status != 'cancelada' THEN
        UPDATE public.vehicles
        SET status = 'disponible', sale_id = NULL
        WHERE id = NEW.vehicle_id AND status = 'reservado';
        -- Marcar lead como cerrado_perdido (si aplica)
        UPDATE public.persons
        SET lead_status = 'cerrado_perdido',
            loss_reason = NEW.cancellation_reason
        WHERE id = NEW.client_id
        AND lead_status = 'en_negociacion';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_sale_status_change
    AFTER UPDATE OF status ON public.sales
    FOR EACH ROW EXECUTE FUNCTION public.handle_sale_status_change();

-- ──────────────────────────────────────────────
-- TABLA: sale_payments — Pagos y señas
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sale_payments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id         UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,

    payment_type    TEXT NOT NULL
                        CHECK (payment_type IN (
                            'seña', 'pago_parcial', 'pago_final',
                            'financiamiento', 'plan_ahorro', 'otro'
                        )),
    amount          NUMERIC(15,2) NOT NULL,
    currency        TEXT NOT NULL DEFAULT 'ARS' CHECK (currency IN ('ARS', 'USD')),
    usd_rate        NUMERIC(12,2),              -- Tipo de cambio si es USD

    payment_method  TEXT NOT NULL DEFAULT 'efectivo'
                        CHECK (payment_method IN (
                            'efectivo', 'transferencia', 'cheque',
                            'tarjeta_credito', 'tarjeta_debito', 'deposito'
                        )),
    payment_date    DATE NOT NULL DEFAULT CURRENT_DATE,
    reference       TEXT,                       -- Nro de transferencia, cheque, etc.
    notes           TEXT,

    registered_by   UUID REFERENCES auth.users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.sale_payments IS 'Pagos, señas y cuotas por venta';

CREATE INDEX idx_sale_payments_sale_id ON public.sale_payments(sale_id);

-- ──────────────────────────────────────────────
-- TABLA: trade_ins — Toma de usados (parte de pago)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trade_ins (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id             UUID NOT NULL REFERENCES public.sales(id),

    -- Datos del vehículo entregado por el cliente
    brand               TEXT NOT NULL,
    model               TEXT NOT NULL,
    version             TEXT,
    year                INTEGER NOT NULL,
    color               TEXT,
    plate               TEXT,
    chassis_number      TEXT,
    mileage             INTEGER,
    fuel_type           TEXT DEFAULT 'nafta',
    transmission        TEXT DEFAULT 'manual',

    -- Estado del vehículo entregado
    general_condition   TEXT DEFAULT 'bueno'
                            CHECK (general_condition IN ('excelente', 'bueno', 'regular', 'para_reparar')),
    mechanical_notes    TEXT,
    cosmetic_notes      TEXT,

    -- Valuación
    market_reference    NUMERIC(15,2),          -- Precio de referencia de mercado
    offered_value       NUMERIC(15,2) NOT NULL, -- Valor ofrecido al cliente
    accepted            BOOLEAN NOT NULL DEFAULT FALSE,

    -- Una vez aceptado, se vincula al vehículo ingresado al stock
    stock_vehicle_id    UUID REFERENCES public.vehicles(id),

    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.trade_ins IS 'Vehículos usados tomados como parte de pago en una venta';

CREATE INDEX idx_trade_ins_sale_id ON public.trade_ins(sale_id);

-- Trigger updated_at
CREATE TRIGGER trg_trade_ins_updated_at
    BEFORE UPDATE ON public.trade_ins
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Agregar FK de sales.trade_in_id ahora que trade_ins existe
ALTER TABLE public.sales
    ADD CONSTRAINT fk_sales_trade_in
    FOREIGN KEY (trade_in_id) REFERENCES public.trade_ins(id);

-- Agregar FK de vehicles.sale_id ahora que sales existe
ALTER TABLE public.vehicles
    ADD CONSTRAINT fk_vehicles_sale
    FOREIGN KEY (sale_id) REFERENCES public.sales(id);
