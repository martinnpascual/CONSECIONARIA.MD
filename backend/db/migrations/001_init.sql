-- ============================================================
-- 001_init.sql — Tablas base: perfiles de usuario y empresa
-- DM Cars — Sesión S-01
-- Aplicar en: Supabase SQL Editor (o supabase db push)
-- ============================================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ──────────────────────────────────────────────
-- TABLA: user_profiles
-- Extiende auth.users de Supabase con datos extra
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name       TEXT NOT NULL,
    role            TEXT NOT NULL DEFAULT 'vendedor'
                        CHECK (role IN ('admin', 'vendedor', 'cajero', 'mecanico')),
    avatar_url      TEXT,
    phone           TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

COMMENT ON TABLE public.user_profiles IS 'Perfiles extendidos de usuarios del sistema DM Cars';
COMMENT ON COLUMN public.user_profiles.role IS 'admin | vendedor | cajero | mecanico';

-- ──────────────────────────────────────────────
-- TABLA: businesses
-- Datos de la concesionaria (membrete, config)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.businesses (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                TEXT NOT NULL,
    legal_name          TEXT NOT NULL,           -- Razón social
    cuit                TEXT NOT NULL,
    iva_condition       TEXT NOT NULL DEFAULT 'responsable_inscripto'
                            CHECK (iva_condition IN ('responsable_inscripto', 'monotributo', 'exento')),
    address             TEXT,
    city                TEXT,
    province            TEXT,
    postal_code         TEXT,
    phone               TEXT,
    email               TEXT,
    website             TEXT,
    logo_url            TEXT,                    -- URL Supabase Storage
    -- Configuración de facturación
    afip_punto_venta    INTEGER NOT NULL DEFAULT 1,
    -- Configuración operativa
    stock_alert_days    INTEGER NOT NULL DEFAULT 90,   -- Alertar vehículos con >N días en stock
    commission_pct      NUMERIC(5,2) NOT NULL DEFAULT 2.00, -- % comisión base para vendedores
    reservation_days    INTEGER NOT NULL DEFAULT 7,    -- Días máximos de reserva sin confirmar
    -- Tipo de cambio USD (actualizable manualmente)
    usd_rate            NUMERIC(12,2),
    usd_rate_updated_at TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.businesses IS 'Datos de configuración de la concesionaria DM Cars';

-- ──────────────────────────────────────────────
-- FUNCIÓN: actualizar updated_at automáticamente
-- ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers updated_at
CREATE TRIGGER trg_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_businesses_updated_at
    BEFORE UPDATE ON public.businesses
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ──────────────────────────────────────────────
-- FUNCIÓN: sincronizar nuevo usuario con user_profiles
-- Se ejecuta al crear un usuario en Supabase Auth
-- ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, full_name, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        COALESCE(NEW.raw_user_meta_data->>'role', 'vendedor')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger en auth.users
DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ──────────────────────────────────────────────
-- FUNCIÓN: obtener rol del usuario actual
-- Usada en RLS policies
-- ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT AS $$
    SELECT role
    FROM public.user_profiles
    WHERE id = auth.uid()
    AND deleted_at IS NULL
    LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ──────────────────────────────────────────────
-- FUNCIÓN: obtener vendedor_id del usuario actual
-- ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_id()
RETURNS UUID AS $$
    SELECT auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;
