import { useState, useEffect } from 'react'
import { Outlet, Navigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/lib/utils'

export function MainLayout() {
  const { isAuthenticated, isLoading } = useAuthStore()
  const [collapsed, setCollapsed] = useState(false)
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('dmcars-theme') === 'dark'
  })

  // Apply dark mode class to html element
  useEffect(() => {
    const root = document.documentElement
    if (darkMode) {
      root.classList.add('dark')
      localStorage.setItem('dmcars-theme', 'dark')
    } else {
      root.classList.remove('dark')
      localStorage.setItem('dmcars-theme', 'light')
    }
  }, [darkMode])

  // Show nothing while auth initializes to avoid flash
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="w-8 h-8 border-2 border-brand-700 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
      />
      <Header
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        darkMode={darkMode}
        onToggleDark={() => setDarkMode((d) => !d)}
      />

      {/* Main content area — shifts right with sidebar */}
      <main
        className={cn(
          'pt-16 min-h-screen transition-all duration-300 ease-in-out',
          collapsed ? 'pl-16' : 'pl-60'
        )}
      >
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
