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

export interface AutofillImageInsights {
  productObjects: string[]
  visibleText: string[]
  colors: string[]
  conditionNotes: string[]
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
  source: 'provider' | 'fallback'
}
