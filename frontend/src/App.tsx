import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { MainLayout } from '@/components/layout/MainLayout'
import { LoginPage } from '@/pages/LoginPage'
import { useAuthStore } from '@/store/authStore'

// ── Lazy imports (split por módulo) ──────────────────────────────
import { lazy, Suspense } from 'react'

const DashboardPage    = lazy(() => import('@/pages/DashboardPage').then(m => ({ default: m.DashboardPage })))
const StockPage        = lazy(() => import('@/pages/stock/StockPage').then(m => ({ default: m.StockPage })))
const CRMPage          = lazy(() => import('@/pages/crm/CRMPage').then(m => ({ default: m.CRMPage })))
const VentasPage       = lazy(() => import('@/pages/ventas/VentasPage').then(m => ({ default: m.VentasPage })))
const TallerPage       = lazy(() => import('@/pages/taller/TallerPage').then(m => ({ default: m.TallerPage })))
const CajaPage         = lazy(() => import('@/pages/caja/CajaPage').then(m => ({ default: m.CajaPage })))
const ConsignPage      = lazy(() => import('@/pages/consignaciones/ConsignPage').then(m => ({ default: m.ConsignPage })))
const DocumentosPage   = lazy(() => import('@/pages/documentos/DocumentosPage').then(m => ({ default: m.DocumentosPage })))
const UsadosPage       = lazy(() => import('@/pages/usados/UsadosPage').then(m => ({ default: m.UsadosPage })))
const ConfigPage       = lazy(() => import('@/pages/configuracion/ConfigPage').then(m => ({ default: m.ConfigPage })))

function PageFallback() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-brand-700 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export function App() {
  const { initialize } = useAuthStore()

  useEffect(() => {
    initialize()
  }, [initialize])

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<MainLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route
          path="/dashboard"
          element={
            <Suspense fallback={<PageFallback />}>
              <DashboardPage />
            </Suspense>
          }
        />
        <Route
          path="/stock/*"
          element={
            <Suspense fallback={<PageFallback />}>
              <StockPage />
            </Suspense>
          }
        />
        <Route
          path="/crm/*"
          element={
            <Suspense fallback={<PageFallback />}>
              <CRMPage />
            </Suspense>
          }
        />
        <Route
          path="/ventas/*"
          element={
            <Suspense fallback={<PageFallback />}>
              <VentasPage />
            </Suspense>
          }
        />
        <Route
          path="/taller/*"
          element={
            <Suspense fallback={<PageFallback />}>
              <TallerPage />
            </Suspense>
          }
        />
        <Route
          path="/caja/*"
          element={
            <Suspense fallback={<PageFallback />}>
              <CajaPage />
            </Suspense>
          }
        />
        <Route
          path="/consignaciones/*"
          element={
            <Suspense fallback={<PageFallback />}>
              <ConsignPage />
            </Suspense>
          }
        />
        <Route
          path="/documentos/*"
          element={
            <Suspense fallback={<PageFallback />}>
              <DocumentosPage />
            </Suspense>
          }
        />
        <Route
          path="/usados/*"
          element={
            <Suspense fallback={<PageFallback />}>
              <UsadosPage />
            </Suspense>
          }
        />
        <Route
          path="/configuracion/*"
          element={
            <Suspense fallback={<PageFallback />}>
              <ConfigPage />
            </Suspense>
          }
        />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
