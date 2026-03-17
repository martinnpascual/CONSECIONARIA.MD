-- ============================================================
-- 003_persons_crm.sql — CRM: Personas e Interacciones
-- DM Cars — Sesión S-01
-- ============================================================

-- ──────────────────────────────────────────────
-- TABLA: persons — Clientes, leads y propietarios
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.persons (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Tipo de persona en el sistema
    person_type             TEXT NOT NULL DEFAULT 'lead'
                                CHECK (person_type IN ('lead', 'cliente', 'consignante', 'proveedor')),

    -- Datos personales
    first_name              TEXT NOT NULL,
    last_name               TEXT NOT NULL,
    dni_cuit                TEXT,
    iva_condition           TEXT NOT NULL DEFAULT 'consumidor_final'
                                CHECK (iva_condition IN (
                                    'consumidor_final',
                                    'responsable_inscripto',
                                    'monotributo',
                                    'exento'
                                )),
    birth_date              DATE,

    -- Contacto
    email                   TEXT,
    phone                   TEXT,
    whatsapp                TEXT,

    -- Dirección
    address                 TEXT,
    city                    TEXT,
    province                TEXT,
    postal_code             TEXT,

    -- CRM: origen del lead
    origin_channel          TEXT DEFAULT 'showroom'
                                CHECK (origin_channel IN (
                                    'web', 'instagram', 'facebook',
                                    'mercadolibre', 'showroom', 'referido', 'otro'
                                )),

    -- CRM: estado del pipeline
    lead_status             TEXT NOT NULL DEFAULT 'nuevo'
                                CHECK (lead_status IN (
                                    'nuevo', 'contactado', 'interesado',
                                    'en_negociacion', 'cerrado_ganado', 'cerrado_perdido'
                                )),
    loss_reason             TEXT,               -- Si cerrado_perdido
    next_contact_date       DATE,               -- Próximo seguimiento
    next_contact_action     TEXT,               -- Qué hacer en el próximo contacto

    -- Asignación
    assigned_seller_id      UUID REFERENCES auth.users(id),

    -- Cuenta corriente (saldo en ARS)
    balance                 NUMERIC(15,2) NOT NULL DEFAULT 0.00,

    notes                   TEXT,

    -- Soft delete
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at              TIMESTAMPTZ
);

COMMENT ON TABLE public.persons IS 'Personas del sistema: leads, clientes, consignantes y proveedores';
COMMENT ON COLUMN public.persons.balance IS 'Saldo cuenta corriente en ARS: positivo = saldo a favor del cliente';

CREATE INDEX idx_persons_lead_status ON public.persons(lead_status) WHERE deleted_at IS NULL;
CREATE INDEX idx_persons_seller ON public.persons(assigned_seller_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_persons_type ON public.persons(person_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_persons_dni ON public.persons(dni_cuit) WHERE deleted_at IS NULL;
-- Búsqueda por nombre (full text)
CREATE INDEX idx_persons_name ON public.persons
    USING gin(to_tsvector('spanish', first_name || ' ' || last_name));

-- Trigger updated_at
CREATE TRIGGER trg_persons_updated_at
    BEFORE UPDATE ON public.persons
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ──────────────────────────────────────────────
-- TABLA: interactions — Historial de contactos CRM
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.interactions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id       UUID NOT NULL REFERENCES public.persons(id) ON DELETE CASCADE,

    interaction_type TEXT NOT NULL
                        CHECK (interaction_type IN (
                            'llamada', 'whatsapp', 'email', 'visita',
                            'test_drive', 'cotizacion_enviada', 'otro'
                        )),
    date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    result          TEXT,                   -- Resultado / resumen
    notes           TEXT,

    -- Próximo contacto planificado en esta interacción
    next_contact_date   DATE,
    next_contact_action TEXT,

    -- Quién registró la interacción
    created_by      UUID REFERENCES auth.users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()

    -- Las interacciones son inmutables (no se editan, solo soft-delete si es necesario)
);

COMMENT ON TABLE public.interactions IS 'Historial inmutable de interacciones CRM por persona';

CREATE INDEX idx_interactions_person_id ON public.interactions(person_id);
CREATE INDEX idx_interactions_date ON public.interactions(date DESC);

-- ──────────────────────────────────────────────
-- TABLA: person_vehicle_interests
-- Vehículos de interés de un lead
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.person_vehicle_interests (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id   UUID NOT NULL REFERENCES public.persons(id) ON DELETE CASCADE,
    vehicle_id  UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
    -- Si no hay vehículo específico, descripción libre
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.person_vehicle_interests IS 'Vehículos de interés vinculados a un lead';

CREATE INDEX idx_pvi_person_id ON public.person_vehicle_interests(person_id);
