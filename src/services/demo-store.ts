import { demoConversations, demoMessages, demoProducts, demoProfiles, demoTradeRequests } from '@/services/demo-data'
import { fileToDataUrl, makeId } from '@/lib/utils'
import { resolveCampusLocation } from '@/services/campus-locations'
import type { Conversation, Message, Product, ProductFilters, ProductInput, ProductStatus, Profile, TradeRequest, TradeStatus, UserSession } from '@/types/domain'

interface DemoUser { id: string; email: string; password: string }
interface DemoState {
  users: DemoUser[]
  profiles: Profile[]
  products: Product[]
  favoritePairs: Array<{ userId: string; productId: string }>
  trades: TradeRequest[]
  conversations: Conversation[]
  messages: Message[]
}

const DB_KEY = 'campus-market-demo-db-v2'
const SESSION_KEY = 'campus-market-demo-session-v2'
const CHANGE_EVENT = 'campus-market-demo-change'

const initialState = (): DemoState => ({
  users: [
    { id: 'demo-user', email: 'demo@campus.market', password: 'demo1234' },
    { id: 'seller-chen', email: 'chen@campus.market', password: 'demo1234' },
    { id: 'seller-wang', email: 'wang@campus.market', password: 'demo1234' },
    { id: 'seller-zhao', email: 'zhao@campus.market', password: 'demo1234' },
  ],
  profiles: structuredClone(demoProfiles),
  products: structuredClone(demoProducts),
  favoritePairs: [
    { userId: 'demo-user', productId: 'product-keyboard' },
    { userId: 'demo-user', productId: 'product-lamp' },
  ],
  trades: structuredClone(demoTradeRequests),
  conversations: structuredClone(demoConversations),
  messages: structuredClone(demoMessages),
})

let memoryState = initialState()

function readState(): DemoState {
  try {
    const raw = localStorage.getItem(DB_KEY)
    if (!raw) return memoryState
    return JSON.parse(raw) as DemoState
  } catch {
    return memoryState
  }
}

function writeState(next: DemoState) {
  memoryState = next
  try { localStorage.setItem(DB_KEY, JSON.stringify(next)) } catch { /* Keep the in-memory copy when image data exceeds storage quota. */ }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

function requireUser(): DemoUser {
  const id = localStorage.getItem(SESSION_KEY)
  const user = readState().users.find((item) => item.id === id)
  if (!user) throw new Error('请先登录后再继续。')
  return user
}

function sessionFrom(state: DemoState, user: DemoUser): UserSession {
  const profile = state.profiles.find((item) => item.id === user.id)
  if (!profile) throw new Error('个人资料不存在。')
  return { id: user.id, email: user.email, profile }
}

function matches(product: Product, filters: ProductFilters) {
  const query = filters.query?.trim().toLowerCase()
  const categoryLabel = { digital: '数码', books: '教材 书籍', life: '生活', sports: '运动', other: '其他' }[product.category]
  const haystack = `${product.title} ${product.description} ${product.category} ${categoryLabel}`.toLowerCase()
  const locationFilter = filters.location?.trim()
  const requestedCampusLocation = resolveCampusLocation(locationFilter)
  const productCampusLocation = resolveCampusLocation(product.location)
  const matchesLocation = !locationFilter || (requestedCampusLocation
    ? productCampusLocation?.canonical === requestedCampusLocation.canonical
    : product.location.toLowerCase().includes(locationFilter.toLowerCase()))
  return (!query || query.split(/\s+/).every((word) => haystack.includes(word)))
    && matchesLocation
    && (!filters.category || filters.category === 'all' || product.category === filters.category)
    && (!filters.condition || filters.condition === 'all' || product.condition === filters.condition)
    && (!filters.status || filters.status === 'all' || product.status === filters.status)
    && (filters.minPrice == null || product.price >= filters.minPrice)
    && (filters.maxPrice == null || product.price <= filters.maxPrice)
    && (!filters.sellerId || product.sellerId === filters.sellerId)
}

export const demoService = {
  mode: 'demo' as const,
  subscribe(onChange: () => void) {
    window.addEventListener(CHANGE_EVENT, onChange)
    return () => window.removeEventListener(CHANGE_EVENT, onChange)
  },
  async getSession() {
    const id = localStorage.getItem(SESSION_KEY)
    if (!id) return null
    const state = readState()
    const user = state.users.find((item) => item.id === id)
    return user ? sessionFrom(state, user) : null
  },
  async signIn(email: string, password: string) {
    const state = readState()
    const user = state.users.find((item) => item.email.toLowerCase() === email.trim().toLowerCase() && item.password === password)
    if (!user) throw new Error('邮箱或密码不正确。演示账号密码为 demo1234。')
    localStorage.setItem(SESSION_KEY, user.id)
    window.dispatchEvent(new Event(CHANGE_EVENT))
    return sessionFrom(state, user)
  },
  async signUp(email: string, password: string, username: string) {
    if (password.length < 8) throw new Error('密码至少需要 8 位。')
    const state = readState()
    if (state.users.some((item) => item.email.toLowerCase() === email.trim().toLowerCase())) throw new Error('这个邮箱已经注册。')
    const id = makeId('user')
    const timestamp = new Date().toISOString()
    const user = { id, email: email.trim().toLowerCase(), password }
    const profile: Profile = { id, username: username.trim(), avatarUrl: null, bio: null, createdAt: timestamp, updatedAt: timestamp }
    writeState({ ...state, users: [...state.users, user], profiles: [...state.profiles, profile] })
    localStorage.setItem(SESSION_KEY, id)
    return { id, email: user.email, profile }
  },
  async signOut() {
    localStorage.removeItem(SESSION_KEY)
    window.dispatchEvent(new Event(CHANGE_EVENT))
  },
  async updateProfile(input: Pick<Profile, 'username' | 'bio'>) {
    const user = requireUser()
    const state = readState()
    let updated: Profile | undefined
    const profiles = state.profiles.map((profile) => {
      if (profile.id !== user.id) return profile
      updated = { ...profile, ...input, updatedAt: new Date().toISOString() }
      return updated
    })
    if (!updated) throw new Error('个人资料不存在。')
    const products = state.products.map((product) => product.sellerId === user.id ? { ...product, seller: updated! } : product)
    writeState({ ...state, profiles, products })
    return updated
  },
  async listProducts(filters: ProductFilters = {}) {
    const state = readState()
    const session = await this.getSession()
    const products = state.products.filter((product) => {
      const canSee = product.status === 'active' || product.status === 'reserved' || product.sellerId === session?.id || Boolean(filters.sellerId)
      return canSee && matches(product, filters)
    })
    return products.sort((a, b) => filters.sort === 'price_asc' ? a.price - b.price : filters.sort === 'price_desc' ? b.price - a.price : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  },
  async getProduct(id: string) {
    return readState().products.find((item) => item.id === id) ?? null
  },
  async createProduct(input: ProductInput, files: File[]) {
    const user = requireUser()
    const state = readState()
    const seller = state.profiles.find((item) => item.id === user.id)!
    const id = makeId('product')
    const timestamp = new Date().toISOString()
    const urls = await Promise.all(files.map(fileToDataUrl))
    const product: Product = {
      ...input,
      id,
      sellerId: user.id,
      status: input.status ?? 'active',
      createdAt: timestamp,
      updatedAt: timestamp,
      seller,
      images: urls.map((url, index) => ({ id: makeId('image'), productId: id, storagePath: `demo/${files[index].name}`, url, sortOrder: index, createdAt: timestamp })),
    }
    writeState({ ...state, products: [product, ...state.products] })
    return product
  },
  async updateProduct(id: string, input: ProductInput, newFiles: File[], keepImageIds: string[]) {
    const user = requireUser()
    const state = readState()
    const existing = state.products.find((item) => item.id === id)
    if (!existing || existing.sellerId !== user.id) throw new Error('你没有权限编辑这个商品。')
    const urls = await Promise.all(newFiles.map(fileToDataUrl))
    const kept = existing.images.filter((item) => keepImageIds.includes(item.id))
    const timestamp = new Date().toISOString()
    const images = [
      ...kept,
      ...urls.map((url, index) => ({ id: makeId('image'), productId: id, storagePath: `demo/${newFiles[index].name}`, url, sortOrder: kept.length + index, createdAt: timestamp })),
    ].map((item, index) => ({ ...item, sortOrder: index }))
    const product = { ...existing, ...input, images, updatedAt: timestamp }
    writeState({ ...state, products: state.products.map((item) => item.id === id ? product : item) })
    return product
  },
  async setProductStatus(id: string, status: ProductStatus) {
    const user = requireUser()
    const state = readState()
    const existing = state.products.find((item) => item.id === id)
    if (!existing || existing.sellerId !== user.id) throw new Error('你没有权限修改这个商品。')
    const product = { ...existing, status, updatedAt: new Date().toISOString() }
    writeState({ ...state, products: state.products.map((item) => item.id === id ? product : item) })
    return product
  },
  async deleteProduct(id: string) {
    const user = requireUser()
    const state = readState()
    const existing = state.products.find((item) => item.id === id)
    if (!existing || existing.sellerId !== user.id) throw new Error('你没有权限删除这个商品。')
    const removedConversationIds = state.conversations.filter((item) => item.productId === id).map((item) => item.id)
    writeState({
      ...state,
      products: state.products.filter((item) => item.id !== id),
      favoritePairs: state.favoritePairs.filter((item) => item.productId !== id),
      trades: state.trades.filter((item) => item.productId !== id),
      conversations: state.conversations.filter((item) => item.productId !== id),
      messages: state.messages.filter((item) => !removedConversationIds.includes(item.conversationId)),
    })
  },
  async favoriteIds() {
    const session = await this.getSession()
    if (!session) return []
    return readState().favoritePairs.filter((item) => item.userId === session.id).map((item) => item.productId)
  },
  async toggleFavorite(productId: string) {
    const user = requireUser()
    const state = readState()
    const exists = state.favoritePairs.some((item) => item.userId === user.id && item.productId === productId)
    const favoritePairs = exists
      ? state.favoritePairs.filter((item) => !(item.userId === user.id && item.productId === productId))
      : [...state.favoritePairs, { userId: user.id, productId }]
    writeState({ ...state, favoritePairs })
    return !exists
  },
  async listFavorites() {
    const ids = await this.favoriteIds()
    return readState().products.filter((item) => ids.includes(item.id))
  },
  async listTrades() {
    const user = requireUser()
    return readState().trades.filter((item) => item.buyerId === user.id || item.sellerId === user.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  },
  async createTrade(productId: string) {
    const user = requireUser()
    const state = readState()
    const product = state.products.find((item) => item.id === productId)
    if (!product || product.status !== 'active') throw new Error('这个商品当前无法发起交易。')
    if (product.sellerId === user.id) throw new Error('不能购买自己发布的商品。')
    const duplicate = state.trades.find((item) => item.productId === productId && item.buyerId === user.id && ['pending', 'accepted'].includes(item.status))
    if (duplicate) return duplicate
    const buyer = state.profiles.find((item) => item.id === user.id)!
    const timestamp = new Date().toISOString()
    const trade: TradeRequest = { id: makeId('trade'), productId, buyerId: user.id, sellerId: product.sellerId, status: 'pending', createdAt: timestamp, updatedAt: timestamp, product, buyer, seller: product.seller }
    writeState({ ...state, trades: [trade, ...state.trades] })
    return trade
  },
  async updateTrade(id: string, status: TradeStatus) {
    const user = requireUser()
    const state = readState()
    const trade = state.trades.find((item) => item.id === id)
    if (!trade) throw new Error('交易请求不存在。')
    const allowed = (trade.buyerId === user.id && trade.status === 'pending' && status === 'cancelled')
      || (trade.sellerId === user.id && trade.status === 'pending' && ['accepted', 'rejected'].includes(status))
      || (trade.buyerId === user.id && trade.status === 'accepted' && status === 'cancelled')
      || ((trade.sellerId === user.id || trade.buyerId === user.id) && trade.status === 'accepted' && status === 'completed')
    if (!allowed) throw new Error('当前状态不允许这个操作。')
    const timestamp = new Date().toISOString()
    const updated = { ...trade, status, updatedAt: timestamp }
    let products = state.products
    if (status === 'accepted') products = products.map((item) => item.id === trade.productId ? { ...item, status: 'reserved', updatedAt: timestamp } : item)
    if (status === 'completed') products = products.map((item) => item.id === trade.productId ? { ...item, status: 'sold', updatedAt: timestamp } : item)
    if (status === 'cancelled' && trade.status === 'accepted') products = products.map((item) => item.id === trade.productId ? { ...item, status: 'active', updatedAt: timestamp } : item)
    const trades = state.trades.map((item) => item.id === id ? updated : status === 'accepted' && item.productId === trade.productId && item.status === 'pending' ? { ...item, status: 'rejected' as const, updatedAt: timestamp } : item)
    writeState({ ...state, products, trades })
    return updated
  },
  async listConversations() {
    const user = requireUser()
    const state = readState()
    return state.conversations.filter((item) => item.buyerId === user.id || item.sellerId === user.id).map((conversation) => {
      const messages = state.messages.filter((item) => item.conversationId === conversation.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      return { ...conversation, lastMessage: messages.at(-1) ?? null, unreadCount: messages.filter((item) => item.senderId !== user.id && !item.readAt).length }
    }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  },
  async getOrCreateConversation(productId: string, tradeRequestId?: string) {
    const user = requireUser()
    const state = readState()
    const product = state.products.find((item) => item.id === productId)
    if (!product || product.sellerId === user.id) throw new Error('无法为这个商品创建会话。')
    const existing = state.conversations.find((item) => item.productId === productId && item.buyerId === user.id && item.sellerId === product.sellerId)
    if (existing) return existing
    const timestamp = new Date().toISOString()
    const buyer = state.profiles.find((item) => item.id === user.id)!
    const conversation: Conversation = { id: makeId('conversation'), productId, buyerId: user.id, sellerId: product.sellerId, tradeRequestId: tradeRequestId ?? null, createdAt: timestamp, updatedAt: timestamp, product, buyer, seller: product.seller, lastMessage: null, unreadCount: 0 }
    writeState({ ...state, conversations: [conversation, ...state.conversations] })
    return conversation
  },
  async getConversation(id: string) {
    const user = requireUser()
    const state = readState()
    const conversation = state.conversations.find((item) => item.id === id && (item.buyerId === user.id || item.sellerId === user.id))
    return conversation ?? null
  },
  async listMessages(conversationId: string) {
    const user = requireUser()
    const state = readState()
    const conversation = state.conversations.find((item) => item.id === conversationId && (item.buyerId === user.id || item.sellerId === user.id))
    if (!conversation) throw new Error('你无权查看这个会话。')
    const readAt = new Date().toISOString()
    const messages = state.messages.filter((item) => item.conversationId === conversationId).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    writeState({ ...state, messages: state.messages.map((item) => item.conversationId === conversationId && item.senderId !== user.id && !item.readAt ? { ...item, readAt } : item) })
    return messages.map((item) => item.senderId !== user.id && !item.readAt ? { ...item, readAt } : item)
  },
  async sendMessage(conversationId: string, content: string) {
    const user = requireUser()
    const state = readState()
    const conversation = state.conversations.find((item) => item.id === conversationId && (item.buyerId === user.id || item.sellerId === user.id))
    if (!conversation) throw new Error('你无权在这个会话中发送消息。')
    const timestamp = new Date().toISOString()
    const message: Message = { id: makeId('message'), conversationId, senderId: user.id, content: content.trim(), createdAt: timestamp, readAt: null }
    writeState({ ...state, messages: [...state.messages, message], conversations: state.conversations.map((item) => item.id === conversationId ? { ...item, updatedAt: timestamp, lastMessage: message } : item) })
    return message
  },
  subscribeMessages(_conversationId: string, callback: (message: Message) => void) {
    let known = new Set(readState().messages.map((item) => item.id))
    const handler = () => {
      const next = readState().messages
      next.filter((item) => item.conversationId === _conversationId && !known.has(item.id)).forEach(callback)
      known = new Set(next.map((item) => item.id))
    }
    window.addEventListener(CHANGE_EVENT, handler)
    return () => window.removeEventListener(CHANGE_EVENT, handler)
  },
  resetDemo() {
    writeState(initialState())
  },
}
