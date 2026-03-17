-- ============================================================
-- 008_invoices.sql — Facturas y Documentos
-- DM Cars — Sesión S-01
-- ============================================================

-- ──────────────────────────────────────────────
-- TABLA: invoices — Facturas electrónicas (ARCA/AFIP)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.invoices (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Tipo de comprobante
    invoice_type        TEXT NOT NULL
                            CHECK (invoice_type IN ('A', 'B', 'C', 'ND_A', 'ND_B', 'NC_A', 'NC_B')),
    invoice_number      TEXT,                   -- NroFactura de ARCA
    cae                 TEXT,                   -- CAE obtenido de ARCA
    cae_expiry_date     DATE,                   -- Vencimiento del CAE

    -- Punto de venta y CUIT
    punto_venta         INTEGER NOT NULL DEFAULT 1,
    emisor_cuit         TEXT NOT NULL,
    receptor_cuit       TEXT,
    receptor_name       TEXT,
    receptor_iva_cond   TEXT,

    -- Entidad origen de la factura
    reference_type      TEXT NOT NULL CHECK (reference_type IN ('sale', 'work_order')),
    reference_id        UUID NOT NULL,

    -- Montos
    net_amount          NUMERIC(15,2) NOT NULL,  -- Neto gravado
    iva_amount          NUMERIC(15,2) NOT NULL DEFAULT 0,  -- IVA 21%
    total_amount        NUMERIC(15,2) NOT NULL,

    -- Estado
    status              TEXT NOT NULL DEFAULT 'pendiente'
                            CHECK (status IN ('pendiente', 'emitida', 'error', 'anulada')),
    error_message       TEXT,

    -- Response completo de MrBot API (inmutable)
    mrbot_response      JSONB,

    -- QR code URL (generado localmente)
    qr_url              TEXT,

    invoice_date        DATE NOT NULL DEFAULT CURRENT_DATE,
    created_by          UUID REFERENCES auth.users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.invoices IS 'Facturas electrónicas emitidas via ARCA (AFIP). Inmutables una vez emitidas.';
COMMENT ON COLUMN public.invoices.mrbot_response IS 'Response completo de MrBot API, guardado como auditoria';
COMMENT ON COLUMN public.invoices.cae IS 'Código de Autorización Electrónica otorgado por ARCA';

CREATE INDEX idx_invoices_reference ON public.invoices(reference_type, reference_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);
CREATE INDEX idx_invoices_date ON public.invoices(invoice_date DESC);
CREATE INDEX idx_invoices_cae ON public.invoices(cae) WHERE cae IS NOT NULL;

-- Trigger updated_at
CREATE TRIGGER trg_invoices_updated_at
    BEFORE UPDATE ON public.invoices
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Agregar FK de work_orders a invoices (ahora que invoices existe)
ALTER TABLE public.work_orders
    ADD CONSTRAINT fk_work_orders_invoice
    FOREIGN KEY (invoice_id) REFERENCES public.invoices(id);

-- ──────────────────────────────────────────────
-- TABLA: documents — Documentos PDF generados
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.documents (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Tipo de documento
    doc_type            TEXT NOT NULL
                            CHECK (doc_type IN (
                                'cotizacion',
                                'boleto_compraventa',
                                'recibo_seña',
                                'acta_entrega',
                                'contrato_consignacion',
                                'liquidacion_consignacion',
                                'orden_trabajo',
                                'recepcion_vehiculo',
                                'reporte_stock',
                                'reporte_ventas',
                                'reporte_comisiones',
                                'cuenta_corriente'
                            )),

    -- Entidad origen
    reference_type      TEXT NOT NULL,           -- 'sale', 'work_order', 'consignment', 'report'
    reference_id        UUID,

    -- Almacenamiento
    storage_path        TEXT NOT NULL,           -- Path en Supabase Storage
    public_url          TEXT NOT NULL,           -- URL pública del PDF

    -- Metadatos
    filename            TEXT NOT NULL,
    file_size_bytes     INTEGER,

    generated_by        UUID REFERENCES auth.users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()

    -- Los documentos son INMUTABLES: nunca se actualizan, solo se crean nuevos
);

COMMENT ON TABLE public.documents IS 'PDFs generados por el sistema. Inmutables: no se sobreescriben, se crean nuevas versiones.';

CREATE INDEX idx_documents_reference ON public.documents(reference_type, reference_id);
CREATE INDEX idx_documents_type ON public.documents(doc_type);
CREATE INDEX idx_documents_created ON public.documents(created_at DESC);
