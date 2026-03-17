-- ============================================================
-- 010_documents.sql — Registro de documentos PDF generados
-- DM Cars — Sesión S-13
-- ============================================================

-- ──────────────────────────────────────────────
-- TABLA: documents — PDFs generados por el sistema
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.documents (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Tipo de documento
    doc_type            TEXT NOT NULL
                            CHECK (doc_type IN (
                                'cotizacion',
                                'boleto_compraventa',
                                'recibo_sena',
                                'acta_entrega',
                                'orden_trabajo',
                                'contrato_consignacion'
                            )),

    -- Entidad a la que pertenece
    reference_type      TEXT NOT NULL
                            CHECK (reference_type IN ('sale', 'work_order', 'consignment')),
    reference_id        UUID,

    -- Archivo en Storage
    storage_path        TEXT NOT NULL,
    public_url          TEXT NOT NULL,
    filename            TEXT NOT NULL,
    file_size_bytes     INTEGER,

    -- Quién lo generó
    generated_by        UUID REFERENCES auth.users(id),

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.documents IS 'Registro de documentos PDF generados por el sistema';

CREATE INDEX idx_documents_reference ON public.documents(reference_type, reference_id);
CREATE INDEX idx_documents_doc_type  ON public.documents(doc_type);
CREATE INDEX idx_documents_created   ON public.documents(created_at DESC);

-- ──────────────────────────────────────────────
-- RLS
-- ──────────────────────────────────────────────
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Usuarios autenticados pueden ver todos los documentos
CREATE POLICY "documents_select" ON public.documents
    FOR SELECT TO authenticated USING (true);

-- Solo usuarios autenticados pueden crear documentos
CREATE POLICY "documents_insert" ON public.documents
    FOR INSERT TO authenticated WITH CHECK (true);

-- ──────────────────────────────────────────────
-- BUCKET de Storage
-- ──────────────────────────────────────────────
-- Nota: el bucket 'documents' debe crearse manualmente en Supabase Storage
-- o via la dashboard, ya que no se puede crear via SQL puro.
-- Configuración: bucket privado, acceso solo con JWT, max 10MB por archivo.
