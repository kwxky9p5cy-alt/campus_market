import { isSupabaseConfigured } from '@/lib/supabase'
import { demoService } from '@/services/demo-store'
import { supabaseService } from '@/services/supabase-service'
import type { MarketplaceService } from '@/services/types'

export const marketplace: MarketplaceService = isSupabaseConfigured ? supabaseService : demoService
export const isDemoMode = marketplace.mode === 'demo'
