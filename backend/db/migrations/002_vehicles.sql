-- ============================================================
-- 002_vehicles.sql — Stock de Vehículos
-- DM Cars — Sesión S-01
-- ============================================================

-- ──────────────────────────────────────────────
-- TABLA: vehicles — Inventario de vehículos
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vehicles (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Clasificación
    vehicle_type        TEXT NOT NULL CHECK (vehicle_type IN ('nuevo', 'usado', 'consignacion')),
    status              TEXT NOT NULL DEFAULT 'disponible'
                            CHECK (status IN ('disponible', 'reservado', 'vendido', 'baja')),

    -- Datos del vehículo
    brand               TEXT NOT NULL,           -- Toyota, Ford, Volkswagen...
    model               TEXT NOT NULL,           -- Corolla, Ranger, Golf...
    version             TEXT,                    -- XEI AT 2.0, TDI...
    year                INTEGER NOT NULL,        -- Año de fabricación
    model_year          INTEGER,                 -- Año modelo (puede diferir)
    color               TEXT,
    interior_color      TEXT,
    fuel_type           TEXT NOT NULL DEFAULT 'nafta'
                            CHECK (fuel_type IN ('nafta', 'diesel', 'hibrido', 'electrico', 'gnc', 'otro')),
    transmission        TEXT NOT NULL DEFAULT 'manual'
                            CHECK (transmission IN ('manual', 'automatica', 'cvt')),
    doors               INTEGER DEFAULT 4,
    body_type           TEXT,                    -- sedan, suv, pickup, hatchback...

    -- Identificación
    chassis_number      TEXT UNIQUE,             -- VIN / número de chasis
    engine_number       TEXT,
    plate               TEXT,                    -- Patente (solo si tiene dominio)

    -- Solo para usados
    mileage             INTEGER,                 -- Kilometraje
    previous_owners     INTEGER DEFAULT 0,

    -- Precios
    list_price          NUMERIC(15,2),           -- Precio público ARS
    cost_price          NUMERIC(15,2),           -- Precio de costo (SOLO admin)
    min_price           NUMERIC(15,2),           -- Precio mínimo / piso
    currency            TEXT NOT NULL DEFAULT 'ARS' CHECK (currency IN ('ARS', 'USD')),

    -- Ubicación y procedencia
    location            TEXT DEFAULT 'Salón',   -- Salón / Depósito / En reparación
    provenance          TEXT,                    -- Cómo llegó al stock (solo usados)

    -- Descripción y equipamiento
    description         TEXT,                   -- Para web y publicaciones
    equipment           JSONB DEFAULT '[]',     -- Lista de equipamientos

    -- Vinculación a consignación
    consignment_id      UUID,                   -- FK se agrega en 007_consignments.sql

    -- Venta vinculada (cuando está reservado o vendido)
    sale_id             UUID,                   -- FK se agrega en 004_sales.sql

    -- Días en stock (actualizado por función)
    entry_date          DATE NOT NULL DEFAULT CURRENT_DATE,
    sale_date           DATE,

    -- Soft delete
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

COMMENT ON TABLE public.vehicles IS 'Inventario de vehículos: nuevos, usados y en consignación';
COMMENT ON COLUMN public.vehicles.cost_price IS 'SENSIBLE: solo visible para rol admin via RLS';
COMMENT ON COLUMN public.vehicles.min_price IS 'Precio piso de negociación';
COMMENT ON COLUMN public.vehicles.equipment IS 'Array JSON de equipamientos: ["Aire acond.", "GPS", "Techo solar"]';

CREATE INDEX idx_vehicles_status ON public.vehicles(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_vehicles_type ON public.vehicles(vehicle_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_vehicles_brand_model ON public.vehicles(brand, model) WHERE deleted_at IS NULL;
CREATE INDEX idx_vehicles_year ON public.vehicles(year) WHERE deleted_at IS NULL;

-- ──────────────────────────────────────────────
-- TABLA: vehicle_photos — Fotos de vehículos
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vehicle_photos (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id  UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
    url         TEXT NOT NULL,          -- URL pública de Supabase Storage
    storage_path TEXT NOT NULL,         -- Path interno: {vehicle_id}/{photo_id}.{ext}
    is_main     BOOLEAN NOT NULL DEFAULT FALSE,  -- Foto principal / portada
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.vehicle_photos IS 'Fotos de vehículos almacenadas en Supabase Storage';

CREATE INDEX idx_vehicle_photos_vehicle_id ON public.vehicle_photos(vehicle_id);

-- Solo puede haber una foto principal por vehículo
CREATE UNIQUE INDEX idx_vehicle_photos_main
    ON public.vehicle_photos(vehicle_id)
    WHERE is_main = TRUE;

-- ──────────────────────────────────────────────
-- TABLA: vehicle_price_history — Historial de precios
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vehicle_price_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id      UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
    old_list_price  NUMERIC(15,2),
    new_list_price  NUMERIC(15,2),
    old_cost_price  NUMERIC(15,2),
    new_cost_price  NUMERIC(15,2),
    changed_by      UUID REFERENCES auth.users(id),
    reason          TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.vehicle_price_history IS 'Auditoría de cambios de precio por vehículo';

CREATE INDEX idx_price_history_vehicle_id ON public.vehicle_price_history(vehicle_id);

-- ──────────────────────────────────────────────
-- FUNCIÓN: registrar cambio de precio automáticamente
-- ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_vehicle_price_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo registrar si cambió algún precio
    IF OLD.list_price IS DISTINCT FROM NEW.list_price
    OR OLD.cost_price IS DISTINCT FROM NEW.cost_price THEN
        INSERT INTO public.vehicle_price_history (
            vehicle_id,
            old_list_price, new_list_price,
            old_cost_price, new_cost_price,
            changed_by
        ) VALUES (
            NEW.id,
            OLD.list_price, NEW.list_price,
            OLD.cost_price, NEW.cost_price,
            auth.uid()
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_vehicle_price_change
    AFTER UPDATE ON public.vehicles
    FOR EACH ROW EXECUTE FUNCTION public.log_vehicle_price_change();

-- Trigger updated_at
CREATE TRIGGER trg_vehicles_updated_at
    BEFORE UPDATE ON public.vehicles
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ──────────────────────────────────────────────
-- VISTA: v_vehicles_public
-- Versión del stock SIN precio de costo
-- Para vendedores y consultas públicas
-- ──────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_vehicles_public AS
SELECT
    id, vehicle_type, status,
    brand, model, version,
    year, model_year, color, interior_color,
    fuel_type, transmission, doors, body_type,
    chassis_number, engine_number, plate,
    mileage, previous_owners,
    list_price, min_price, currency,
    -- cost_price EXCLUIDO intencionalmente
    location, description, equipment,
    entry_date, sale_date,
    created_at, updated_at
FROM public.vehicles
WHERE deleted_at IS NULL;

COMMENT ON VIEW public.v_vehicles_public IS 'Vista de vehículos sin precio de costo. Uso: vendedores y frontend no-admin';
