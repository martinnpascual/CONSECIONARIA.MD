/**
 * ErrorBoundary — Captura errores de React en el árbol de componentes.
 * Evita que un crash en un módulo tire toda la aplicación.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
  /** Nombre del módulo para mostrar en el mensaje de error */
  moduleName?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // En producción se podría enviar a Sentry / LogRocket
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    const { moduleName = 'este módulo' } = this.props

    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-8 max-w-md w-full">
          <AlertTriangle className="h-10 w-10 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Algo salió mal en {moduleName}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Ocurrió un error inesperado. Podés intentar recargar la sección o volver al inicio.
          </p>

          {/* Detalle técnico (solo en dev) */}
          {import.meta.env.DEV && this.state.error && (
            <pre className="text-left text-xs bg-gray-100 dark:bg-gray-800 rounded-lg p-3 mb-4 overflow-auto max-h-32 text-red-600 dark:text-red-400">
              {this.state.error.message}
            </pre>
          )}

          <div className="flex gap-3 justify-center">
            <button
              onClick={this.handleReset}
              className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Reintentar
            </button>
            <button
              onClick={() => window.location.href = '/dashboard'}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-xl transition-colors"
            >
              Ir al inicio
            </button>
          </div>
        </div>
      </div>
    )
  }
}
