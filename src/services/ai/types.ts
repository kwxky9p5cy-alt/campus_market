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

export interface AutofillInput {
  rawText: string
  imageNames?: string[]
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
  source: 'provider' | 'fallback'
}
