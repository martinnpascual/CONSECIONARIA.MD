import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPut } from '@/lib/api'

export interface BusinessConfig {
  id: string
  name: string
  legal_name: string
  cuit: string
  iva_condition: 'responsable_inscripto' | 'monotributo' | 'exento'
  address: string | null
  city: string | null
  province: string | null
  postal_code: string | null
  phone: string | null
  email: string | null
  website: string | null
  logo_url: string | null
  afip_punto_venta: number
  stock_alert_days: number
  commission_pct: number
  reservation_days: number
  usd_rate: number | null
  usd_rate_updated_at: string | null
  updated_at: string
}

export type BusinessConfigUpdate = Partial<Omit<BusinessConfig, 'id' | 'updated_at' | 'usd_rate_updated_at'>>

export function useBusinessConfig() {
  return useQuery<BusinessConfig>({
    queryKey: ['business-config'],
    queryFn: () => apiGet('/config'),
    staleTime: 5 * 60_000,
    retry: false,
  })
}

export function useUpdateBusinessConfig() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: BusinessConfigUpdate) => apiPut('/config', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['business-config'] }),
  })
}
