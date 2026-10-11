import type { ProductCategory, ProductCondition } from '@/types/domain'

export interface SearchParseInput { text: string }
export interface SearchParseResult {
  keywords: string[]
  category: ProductCategory | null
  priceMin: number | null
  priceMax: number | null
  condition: ProductCondition | null
  source: 'provider' | 'fallback'
}

export interface AutofillImage {
  name: string
  url: string
}

export interface AutofillInput {
  rawText: string
  images?: AutofillImage[]
}

export type ModerationCategory =
  | 'none'
  | 'firearms_explosives'
  | 'drugs_controlled_substances'
  | 'controlled_weapons'
  | 'hazardous_materials'
  | 'protected_wildlife'
  | 'stolen_smuggled_property'
  | 'classified_military_police'

export interface ModerationResult {
  status: 'allowed' | 'blocked' | 'review'
  category: ModerationCategory
  reason: string
  evidence: string[]
  confidence: 'high' | 'medium' | 'low'
  source: 'provider' | 'local'
}

export interface AutofillImageInsights {
  productObjects: string[]
  visibleText: string[]
  colors: string[]
  materials: string[]
  distinguishingFeatures: string[]
  brandCandidates: Array<{
    name: string
    evidence: string
    confidence: 'high' | 'medium' | 'low'
  }>
  conditionNotes: string[]
  conditionConfidence: 'high' | 'medium' | 'low' | 'none'
}

export interface AutofillResearch {
  status: 'available' | 'insufficient' | 'unavailable'
  query: string
  identifiedBrand: string
  identifiedProduct: string
  confidence: 'high' | 'medium' | 'low' | 'none'
  summary: string
  priceLow: number | null
  priceHigh: number | null
  suggestedPrice: number | null
  rationale: string
  sources: Array<{ title: string; url: string }>
}

export interface AutofillResult {
  title: string
  category: ProductCategory | null
  price: number | null
  condition: ProductCondition | null
  description: string
  location: string
  tags: string[]
  missingFields: string[]
  imageInsights: AutofillImageInsights
  research: AutofillResearch
  moderation: ModerationResult
  source: 'provider' | 'fallback'
}
