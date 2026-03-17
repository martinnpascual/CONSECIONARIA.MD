-- ============================================================
-- 006_cash.sql — Caja y Movimientos Financieros
-- DM Cars — Sesión S-01
-- ============================================================

-- ──────────────────────────────────────────────
-- TABLA: cash_registers — Cajas diarias
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cash_registers (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    opened_by           UUID NOT NULL REFERENCES auth.users(id),
    closed_by           UUID REFERENCES auth.users(id),

    open_date           DATE NOT NULL DEFAULT CURRENT_DATE,
    opened_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at           TIMESTAMPTZ,

    status              TEXT NOT NULL DEFAULT 'abierta'
                            CHECK (status IN ('abierta', 'cerrada')),

    -- Saldo inicial en ARS y USD
    opening_balance_ars NUMERIC(15,2) NOT NULL DEFAULT 0,
    opening_balance_usd NUMERIC(15,2) NOT NULL DEFAULT 0,

    -- Saldo final (calculado al cerrar)
    closing_balance_ars NUMERIC(15,2),
    closing_balance_usd NUMERIC(15,2),

    -- Tipo de cambio del día (USD → ARS)
    usd_rate            NUMERIC(12,2),

    notes               TEXT,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.cash_registers IS 'Cajas diarias de la concesionaria';

-- Solo puede haber una caja abierta a la vez
CREATE UNIQUE INDEX idx_cash_registers_one_open
    ON public.cash_registers(open_date)
    WHERE status = 'abierta';

CREATE INDEX idx_cash_registers_date ON public.cash_registers(open_date DESC);

-- Trigger updated_at
CREATE TRIGGER trg_cash_registers_updated_at
    BEFORE UPDATE ON public.cash_registers
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ──────────────────────────────────────────────
-- TABLA: cash_movements — Movimientos de caja
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cash_movements (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cash_register_id    UUID NOT NULL REFERENCES public.cash_registers(id),

    -- Tipo de movimiento
    movement_type       TEXT NOT NULL CHECK (movement_type IN ('ingreso', 'egreso')),

    -- Categoría del movimiento
    category            TEXT NOT NULL DEFAULT 'otro'
                            CHECK (category IN (
                                'cobro_venta',      -- Pago de una venta
                                'cobro_servicio',   -- Pago de servicio de taller
                                'seña',             -- Seña de una venta
                                'devolucion',       -- Devolución al cliente
                                'gasto_operativo',  -- Gasto de la concesionaria
                                'gasto_publicidad', -- Publicidad
                                'comision',         -- Comisión pagada a vendedor
                                'liquidacion_consignacion', -- Pago al propietario de consignación
                                'otro'
                            )),

    description         TEXT NOT NULL,
    amount              NUMERIC(15,2) NOT NULL CHECK (amount > 0),
    currency            TEXT NOT NULL DEFAULT 'ARS' CHECK (currency IN ('ARS', 'USD')),
    usd_rate            NUMERIC(12,2),              -- Tipo de cambio si es USD

    payment_method      TEXT NOT NULL DEFAULT 'efectivo'
                            CHECK (payment_method IN (
                                'efectivo', 'transferencia', 'cheque',
                                'tarjeta_credito', 'tarjeta_debito', 'deposito'
                            )),

    -- Referencia a la entidad origen (opcional)
    reference_type      TEXT,                       -- 'sale', 'work_order', 'consignment'
    reference_id        UUID,                       -- ID de la entidad

    -- Persona relacionada (cliente, proveedor, etc.)
    person_id           UUID REFERENCES public.persons(id),

    movement_date       DATE NOT NULL DEFAULT CURRENT_DATE,
    reference           TEXT,                       -- Nro transferencia, cheque, etc.
    notes               TEXT,

    registered_by       UUID NOT NULL REFERENCES auth.users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.cash_movements IS 'Movimientos de ingreso y egreso de caja';

CREATE INDEX idx_cash_movements_register ON public.cash_movements(cash_register_id);
CREATE INDEX idx_cash_movements_date ON public.cash_movements(movement_date DESC);
CREATE INDEX idx_cash_movements_category ON public.cash_movements(category);
CREATE INDEX idx_cash_movements_person ON public.cash_movements(person_id);

-- ──────────────────────────────────────────────
-- VISTA: v_cash_summary
-- Resumen de la caja actual
-- ──────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_cash_summary AS
SELECT
    cr.id AS cash_register_id,
    cr.open_date,
    cr.status,
    cr.opening_balance_ars,
    cr.opening_balance_usd,
    cr.usd_rate,
    -- Ingresos del día
    COALESCE(SUM(CASE WHEN cm.movement_type = 'ingreso' AND cm.currency = 'ARS' THEN cm.amount ELSE 0 END), 0) AS total_income_ars,
    COALESCE(SUM(CASE WHEN cm.movement_type = 'ingreso' AND cm.currency = 'USD' THEN cm.amount ELSE 0 END), 0) AS total_income_usd,
    -- Egresos del día
    COALESCE(SUM(CASE WHEN cm.movement_type = 'egreso' AND cm.currency = 'ARS' THEN cm.amount ELSE 0 END), 0) AS total_expense_ars,
    COALESCE(SUM(CASE WHEN cm.movement_type = 'egreso' AND cm.currency = 'USD' THEN cm.amount ELSE 0 END), 0) AS total_expense_usd
FROM public.cash_registers cr
LEFT JOIN public.cash_movements cm ON cm.cash_register_id = cr.id
GROUP BY cr.id, cr.open_date, cr.status, cr.opening_balance_ars, cr.opening_balance_usd, cr.usd_rate;

COMMENT ON VIEW public.v_cash_summary IS 'Resumen de ingresos y egresos por caja';
