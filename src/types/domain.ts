export type ProductCategory = 'digital' | 'books' | 'life' | 'sports' | 'other'
export type ProductCondition = 'new' | 'like_new' | 'good' | 'fair'
export type ProductStatus = 'draft' | 'active' | 'reserved' | 'sold' | 'inactive'
export type TradeStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'completed'
export type SortOption = 'newest' | 'price_asc' | 'price_desc'

export interface Profile {
  id: string
  username: string
  avatarUrl: string | null
  bio: string | null
  createdAt: string
  updatedAt: string
}

export interface ProductImage {
  id: string
  productId: string
  storagePath: string
  url: string
  sortOrder: number
  createdAt: string
}

export interface Product {
  id: string
  sellerId: string
  title: string
  description: string
  category: ProductCategory
  price: number
  originalPrice: number | null
  condition: ProductCondition
  location: string
  status: ProductStatus
  createdAt: string
  updatedAt: string
  images: ProductImage[]
  seller: Profile
  distanceLabel?: string
  differentCampus?: boolean
  distanceUnavailable?: boolean
}

export interface ProductInput {
  title: string
  description: string
  category: ProductCategory
  price: number
  originalPrice: number | null
  condition: ProductCondition
  location: string
  status?: ProductStatus
}

export interface ProductFilters {
  query?: string
  location?: string
  category?: ProductCategory | 'all'
  minPrice?: number | null
  maxPrice?: number | null
  condition?: ProductCondition | 'all'
  status?: ProductStatus | 'all'
  sort?: SortOption
  sellerId?: string
}

export interface TradeRequest {
  id: string
  productId: string
  buyerId: string
  sellerId: string
  status: TradeStatus
  createdAt: string
  updatedAt: string
  product: Product
  buyer: Profile
  seller: Profile
}

export interface Conversation {
  id: string
  productId: string
  buyerId: string
  sellerId: string
  tradeRequestId: string | null
  createdAt: string
  updatedAt: string
  product: Product
  buyer: Profile
  seller: Profile
  lastMessage?: Message | null
  unreadCount?: number
}

export interface Message {
  id: string
  conversationId: string
  senderId: string
  content: string
  createdAt: string
  readAt: string | null
}

export interface UserSession {
  id: string
  email: string
  profile: Profile
}

export interface ServiceResult<T> {
  data: T
  error: null
}

export interface ServiceFailure {
  data: null
  error: Error
}
