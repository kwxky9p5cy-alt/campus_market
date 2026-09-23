import type { Conversation, Message, Product, ProductFilters, ProductInput, ProductStatus, Profile, TradeRequest, TradeStatus, UserSession } from '@/types/domain'

export interface MarketplaceService {
  mode: 'demo' | 'supabase'
  subscribe: (onChange: () => void) => () => void
  getSession: () => Promise<UserSession | null>
  signIn: (email: string, password: string) => Promise<UserSession>
  signUp: (email: string, password: string, username: string) => Promise<UserSession | null>
  signOut: () => Promise<void>
  updateProfile: (input: Pick<Profile, 'username' | 'bio'>) => Promise<Profile>
  listProducts: (filters?: ProductFilters) => Promise<Product[]>
  getProduct: (id: string) => Promise<Product | null>
  createProduct: (input: ProductInput, files: File[]) => Promise<Product>
  updateProduct: (id: string, input: ProductInput, newFiles: File[], keepImageIds: string[]) => Promise<Product>
  setProductStatus: (id: string, status: ProductStatus) => Promise<Product>
  deleteProduct: (id: string) => Promise<void>
  favoriteIds: () => Promise<string[]>
  toggleFavorite: (productId: string) => Promise<boolean>
  listFavorites: () => Promise<Product[]>
  listTrades: () => Promise<TradeRequest[]>
  createTrade: (productId: string) => Promise<TradeRequest>
  updateTrade: (id: string, status: TradeStatus) => Promise<TradeRequest>
  listConversations: () => Promise<Conversation[]>
  getOrCreateConversation: (productId: string, tradeRequestId?: string) => Promise<Conversation>
  getConversation: (id: string) => Promise<Conversation | null>
  listMessages: (conversationId: string) => Promise<Message[]>
  sendMessage: (conversationId: string, content: string) => Promise<Message>
  subscribeMessages: (conversationId: string, callback: (message: Message) => void) => () => void
}
