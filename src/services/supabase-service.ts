import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { CATEGORY_LABELS } from '@/lib/constants'
import { toAuthServiceError, toMarketplaceServiceError } from '@/lib/service-error'
import { makeId } from '@/lib/utils'
import { resolveCampusLocation } from '@/services/campus-locations'
import type { MarketplaceService } from '@/services/types'
import type { Conversation, Message, Product, ProductImage, ProductStatus, Profile, TradeRequest, TradeStatus, UserSession } from '@/types/domain'

interface RawProfile { id: string; username: string; avatar_url: string | null; bio: string | null; created_at: string; updated_at: string }
interface RawImage { id: string; product_id: string; storage_path: string; sort_order: number; created_at: string }
interface RawProduct {
  id: string; seller_id: string; title: string; description: string; category: Product['category']; price: number | string; original_price: number | string | null; condition: Product['condition']; location: string; status: ProductStatus; created_at: string; updated_at: string
  seller?: RawProfile; product_images?: RawImage[]
}
interface RawTrade {
  id: string; product_id: string; buyer_id: string; seller_id: string; status: TradeStatus; created_at: string; updated_at: string
  product?: RawProduct; buyer?: RawProfile; seller?: RawProfile
}
interface RawConversation {
  id: string; product_id: string; buyer_id: string; seller_id: string; trade_request_id: string | null; created_at: string; updated_at: string
  product?: RawProduct; buyer?: RawProfile; seller?: RawProfile; messages?: RawMessage[]
}
interface RawMessage { id: string; conversation_id: string; sender_id: string; content: string; created_at: string; read_at: string | null }

const client = () => {
  if (!supabase) throw new Error('Supabase 尚未配置。')
  return supabase
}

function mapProfile(row: RawProfile): Profile {
  return { id: row.id, username: row.username, avatarUrl: row.avatar_url, bio: row.bio, createdAt: row.created_at, updatedAt: row.updated_at }
}

function publicImage(path: string) {
  return client().storage.from('product-images').getPublicUrl(path).data.publicUrl
}

function mapImage(row: RawImage): ProductImage {
  return { id: row.id, productId: row.product_id, storagePath: row.storage_path, url: publicImage(row.storage_path), sortOrder: row.sort_order, createdAt: row.created_at }
}

function mapProduct(row: RawProduct): Product {
  const fallback: RawProfile = { id: row.seller_id, username: '校园用户', avatar_url: null, bio: null, created_at: row.created_at, updated_at: row.updated_at }
  return {
    id: row.id, sellerId: row.seller_id, title: row.title, description: row.description, category: row.category, price: Number(row.price), originalPrice: row.original_price == null ? null : Number(row.original_price), condition: row.condition, location: row.location, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at,
    seller: mapProfile(row.seller ?? fallback), images: (row.product_images ?? []).sort((a, b) => a.sort_order - b.sort_order).map(mapImage),
  }
}

function mapMessage(row: RawMessage): Message {
  return { id: row.id, conversationId: row.conversation_id, senderId: row.sender_id, content: row.content, createdAt: row.created_at, readAt: row.read_at }
}

function mapTrade(row: RawTrade): TradeRequest {
  if (!row.product || !row.buyer || !row.seller) throw new Error('交易数据不完整。')
  return { id: row.id, productId: row.product_id, buyerId: row.buyer_id, sellerId: row.seller_id, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at, product: mapProduct(row.product), buyer: mapProfile(row.buyer), seller: mapProfile(row.seller) }
}

function mapConversation(row: RawConversation): Conversation {
  if (!row.product || !row.buyer || !row.seller) throw new Error('会话数据不完整。')
  const last = row.messages?.slice().sort((a, b) => a.created_at.localeCompare(b.created_at)).at(-1)
  return { id: row.id, productId: row.product_id, buyerId: row.buyer_id, sellerId: row.seller_id, tradeRequestId: row.trade_request_id, createdAt: row.created_at, updatedAt: row.updated_at, product: mapProduct(row.product), buyer: mapProfile(row.buyer), seller: mapProfile(row.seller), lastMessage: last ? mapMessage(last) : null }
}

async function profileForSession(session: Session): Promise<UserSession> {
  const { data, error } = await client().from('profiles').select('*').eq('id', session.user.id).single()
  if (error) throw toAuthServiceError(error, 'profile')
  return { id: session.user.id, email: session.user.email ?? '', profile: mapProfile(data as RawProfile) }
}

export function isExistingEmailSignup(user: { identities?: unknown[] | null } | null) {
  return Boolean(user && Array.isArray(user.identities) && user.identities.length === 0)
}

const productSelect = '*, seller:profiles!products_seller_id_fkey(*), product_images(*)'
const tradeSelect = `*, product:products!trade_requests_product_id_fkey(${productSelect}), buyer:profiles!trade_requests_buyer_id_fkey(*), seller:profiles!trade_requests_seller_id_fkey(*)`
const conversationSelect = `*, product:products!conversations_product_id_fkey(${productSelect}), buyer:profiles!conversations_buyer_id_fkey(*), seller:profiles!conversations_seller_id_fkey(*), messages(*)`

async function uploadImages(productId: string, files: File[], startOrder: number) {
  const { data: authData, error: authError } = await client().auth.getUser()
  if (authError) throw toAuthServiceError(authError, 'session')
  if (!authData.user) throw new Error('请先登录后再上传图片。')
  const created: RawImage[] = []
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index]
    const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
    const path = `${authData.user.id}/${productId}/${makeId('image')}.${extension}`
    const { error: uploadError } = await client().storage.from('product-images').upload(path, file, { contentType: file.type, upsert: false })
    if (uploadError) throw toMarketplaceServiceError(uploadError, `图片“${file.name}”上传失败，请重试。`)
    const { data, error } = await client().from('product_images').insert({ product_id: productId, storage_path: path, sort_order: startOrder + index }).select().single()
    if (error) {
      await client().storage.from('product-images').remove([path])
      throw toMarketplaceServiceError(error, '图片记录保存失败，请重试。')
    }
    created.push(data as RawImage)
  }
  return created
}

export const supabaseService: MarketplaceService = {
  mode: 'supabase',
  subscribe(onChange) {
    const { data } = client().auth.onAuthStateChange((_event: AuthChangeEvent) => onChange())
    return () => data.subscription.unsubscribe()
  },
  async getSession() {
    const { data, error } = await client().auth.getSession()
    if (error) throw toAuthServiceError(error, 'session')
    return data.session ? profileForSession(data.session) : null
  },
  async signIn(email, password) {
    const { data, error } = await client().auth.signInWithPassword({ email, password })
    if (error) throw toAuthServiceError(error, 'sign-in')
    if (!data.session) throw toAuthServiceError(new Error('Missing session'), 'sign-in')
    return profileForSession(data.session)
  },
  async signUp(email, password, username) {
    const { data, error } = await client().auth.signUp({ email, password, options: { data: { username } } })
    if (error) {
      if (/already|registered/i.test(error.message)) throw new Error('这个邮箱已经注册。')
      throw toAuthServiceError(error, 'sign-up')
    }
    // With email confirmation enabled, Supabase can return an obfuscated user
    // with no identities for an existing address instead of an explicit error.
    if (isExistingEmailSignup(data.user)) throw new Error('这个邮箱已经注册，请直接登录或找回密码。')
    return data.session ? profileForSession(data.session) : null
  },
  async requestPasswordReset(email, redirectTo) {
    const { error } = await client().auth.resetPasswordForEmail(email.trim(), { redirectTo })
    if (error) throw toAuthServiceError(error, 'password-reset')
  },
  async updatePassword(password) {
    const { error } = await client().auth.updateUser({ password })
    if (error) throw toAuthServiceError(error, 'password-update')
  },
  async signOut() {
    const { error } = await client().auth.signOut()
    if (error) throw toAuthServiceError(error, 'session')
  },
  async updateProfile(input) {
    const { data: authData, error: authError } = await client().auth.getUser()
    if (authError) throw toAuthServiceError(authError, 'session')
    if (!authData.user) throw new Error('请先登录。')
    const { data, error } = await client().from('profiles').update({ username: input.username, bio: input.bio }).eq('id', authData.user.id).select().single()
    if (error) throw toMarketplaceServiceError(error, '个人资料保存失败，请重试。')
    return mapProfile(data as RawProfile)
  },
  async listProducts(filters = {}) {
    let query = client().from('products').select(productSelect)
    if (filters.query?.trim()) {
      const rawValue = filters.query.trim().replace(/[,%()]/g, ' ')
      const matchedCategory = (Object.entries(CATEGORY_LABELS) as Array<[Product['category'], string]>).find(([, label]) => rawValue.includes(label))?.[0]
      const value = matchedCategory ? rawValue.replace(CATEGORY_LABELS[matchedCategory], '').trim() : rawValue
      if (matchedCategory) query = query.eq('category', matchedCategory)
      if (value) query = query.or(`title.ilike.%${value}%,description.ilike.%${value}%`)
    }
    if (filters.location?.trim()) {
      const campusLocation = resolveCampusLocation(filters.location)
      if (campusLocation) {
        const locationFilters = campusLocation.aliases.map((alias) => `location.ilike.%${alias}%`).join(',')
        query = query.or(locationFilters)
      } else {
        const location = filters.location.trim().replace(/[,%()_*]/g, ' ')
        if (location) query = query.ilike('location', `%${location}%`)
      }
    }
    if (filters.category && filters.category !== 'all') query = query.eq('category', filters.category)
    if (filters.condition && filters.condition !== 'all') query = query.eq('condition', filters.condition)
    if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status)
    if (filters.minPrice != null) query = query.gte('price', filters.minPrice)
    if (filters.maxPrice != null) query = query.lte('price', filters.maxPrice)
    if (filters.sellerId) query = query.eq('seller_id', filters.sellerId)
    query = filters.sort === 'price_asc' ? query.order('price', { ascending: true }) : filters.sort === 'price_desc' ? query.order('price', { ascending: false }) : query.order('created_at', { ascending: false })
    const { data, error } = await query.limit(100)
    if (error) throw toMarketplaceServiceError(error, '商品加载失败，请稍后重试。')
    return (data as unknown as RawProduct[]).map(mapProduct)
  },
  async getProduct(id) {
    const { data, error } = await client().from('products').select(productSelect).eq('id', id).maybeSingle()
    if (error) throw toMarketplaceServiceError(error, '商品详情加载失败，请重试。')
    return data ? mapProduct(data as unknown as RawProduct) : null
  },
  async createProduct(input, files) {
    const { data: authData, error: authError } = await client().auth.getUser()
    if (authError) throw toAuthServiceError(authError, 'session')
    if (!authData.user) throw new Error('请先登录后再发布。')
    const { data, error } = await client().from('products').insert({ seller_id: authData.user.id, title: input.title, description: input.description, category: input.category, price: input.price, original_price: input.originalPrice, condition: input.condition, location: input.location, status: input.status ?? 'active' }).select().single()
    if (error) throw toMarketplaceServiceError(error, '商品发布失败，请检查信息后重试。')
    try { await uploadImages(data.id as string, files, 0) } catch (uploadError) {
      await client().from('products').delete().eq('id', data.id)
      throw uploadError
    }
    const created = await this.getProduct(data.id as string)
    if (!created) throw new Error('商品已保存，但详情读取失败。')
    return created
  },
  async updateProduct(id, input, newFiles, keepImageIds) {
    const existing = await this.getProduct(id)
    if (!existing) throw new Error('商品不存在。')
    const remove = existing.images.filter((item) => !keepImageIds.includes(item.id))
    const { error } = await client().from('products').update({ title: input.title, description: input.description, category: input.category, price: input.price, original_price: input.originalPrice, condition: input.condition, location: input.location }).eq('id', id)
    if (error) throw toMarketplaceServiceError(error, '商品保存失败，请重试。')
    if (remove.length) {
      const { error: imageError } = await client().from('product_images').delete().in('id', remove.map((item) => item.id))
      if (imageError) throw toMarketplaceServiceError(imageError, '部分图片删除失败，请重试。')
      await client().storage.from('product-images').remove(remove.map((item) => item.storagePath))
    }
    const keptImages = existing.images.filter((item) => keepImageIds.includes(item.id)).sort((a, b) => keepImageIds.indexOf(a.id) - keepImageIds.indexOf(b.id))
    for (let index = 0; index < keptImages.length; index += 1) {
      if (keptImages[index].sortOrder !== index) await client().from('product_images').update({ sort_order: index }).eq('id', keptImages[index].id)
    }
    await uploadImages(id, newFiles, keepImageIds.length)
    const updated = await this.getProduct(id)
    if (!updated) throw new Error('商品已保存，但详情读取失败。')
    return updated
  },
  async setProductStatus(id, status) {
    const { data, error } = await client().from('products').update({ status }).eq('id', id).select(productSelect).single()
    if (error) throw toMarketplaceServiceError(error, '商品状态更新失败。')
    return mapProduct(data as unknown as RawProduct)
  },
  async deleteProduct(id) {
    const product = await this.getProduct(id)
    const { error } = await client().from('products').delete().eq('id', id)
    if (error) throw toMarketplaceServiceError(error, '商品删除失败，请重试。')
    if (product?.images.length) await client().storage.from('product-images').remove(product.images.map((item) => item.storagePath))
  },
  async favoriteIds() {
    const { data: authData, error: authError } = await client().auth.getUser()
    if (authError) throw toAuthServiceError(authError, 'session')
    if (!authData.user) return []
    const { data, error } = await client().from('favorites').select('product_id').eq('user_id', authData.user.id)
    if (error) throw toMarketplaceServiceError(error, '收藏状态加载失败。')
    return (data as Array<{ product_id: string }>).map((item) => item.product_id)
  },
  async toggleFavorite(productId) {
    const { data: authData, error: authError } = await client().auth.getUser()
    if (authError) throw toAuthServiceError(authError, 'session')
    if (!authData.user) throw new Error('请先登录后再收藏。')
    const { data, error: lookupError } = await client().from('favorites').select('id').eq('user_id', authData.user.id).eq('product_id', productId).maybeSingle()
    if (lookupError) throw toMarketplaceServiceError(lookupError, '收藏状态读取失败，请重试。')
    if (data) {
      const { error } = await client().from('favorites').delete().eq('id', data.id)
      if (error) throw toMarketplaceServiceError(error, '取消收藏失败。')
      return false
    }
    const { error } = await client().from('favorites').insert({ user_id: authData.user.id, product_id: productId })
    if (error) throw toMarketplaceServiceError(error, '收藏失败，请重试。')
    return true
  },
  async listFavorites() {
    const { data: authData, error: authError } = await client().auth.getUser()
    if (authError) throw toAuthServiceError(authError, 'session')
    if (!authData.user) throw new Error('请先登录。')
    const { data, error } = await client().from('favorites').select(`product:products!favorites_product_id_fkey(${productSelect})`).eq('user_id', authData.user.id).order('created_at', { ascending: false })
    if (error) throw toMarketplaceServiceError(error, '收藏列表加载失败。')
    return (data as unknown as Array<{ product: RawProduct }>).map((item) => mapProduct(item.product))
  },
  async listTrades() {
    const { data, error } = await client().from('trade_requests').select(tradeSelect).order('updated_at', { ascending: false })
    if (error) throw toMarketplaceServiceError(error, '交易列表加载失败。')
    return (data as unknown as RawTrade[]).map(mapTrade)
  },
  async createTrade(productId) {
    const { data: authData, error: authError } = await client().auth.getUser()
    if (authError) throw toAuthServiceError(authError, 'session')
    if (!authData.user) throw new Error('请先登录。')
    const product = await this.getProduct(productId)
    if (!product) throw new Error('商品不存在。')
    const { data, error } = await client().from('trade_requests').insert({ product_id: productId, buyer_id: authData.user.id, seller_id: product.sellerId }).select(tradeSelect).single()
    if (error) {
      if (error.code === '23505') throw new Error('你已经发起过交易请求。')
      throw toMarketplaceServiceError(error, '交易请求发送失败，请重试。')
    }
    return mapTrade(data as unknown as RawTrade)
  },
  async updateTrade(id, status) {
    const { data, error } = await client().rpc('transition_trade_request', { request_id: id, next_status: status }).select(tradeSelect).single()
    if (error) throw toMarketplaceServiceError(error, '当前状态不允许这个操作，或请求已被处理。')
    return mapTrade(data as unknown as RawTrade)
  },
  async listConversations() {
    const { data, error } = await client().from('conversations').select(conversationSelect).order('updated_at', { ascending: false })
    if (error) throw toMarketplaceServiceError(error, '消息列表加载失败。')
    return (data as unknown as RawConversation[]).map(mapConversation)
  },
  async getOrCreateConversation(productId, tradeRequestId) {
    const { data, error } = await client().rpc('get_or_create_conversation', { target_product_id: productId, target_trade_request_id: tradeRequestId ?? null }).single()
    if (error) throw toMarketplaceServiceError(error, '会话创建失败，请重试。')
    const conversationId = (data as { id: string }).id
    const conversation = await this.getConversation(conversationId)
    if (!conversation) throw new Error('会话读取失败。')
    return conversation
  },
  async getConversation(id) {
    const { data, error } = await client().from('conversations').select(conversationSelect).eq('id', id).maybeSingle()
    if (error) throw toMarketplaceServiceError(error, '会话加载失败。')
    return data ? mapConversation(data as unknown as RawConversation) : null
  },
  async listMessages(conversationId) {
    const { data, error } = await client().from('messages').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: true })
    if (error) throw toMarketplaceServiceError(error, '消息加载失败。')
    const { data: authData, error: authError } = await client().auth.getUser()
    if (authError) throw toAuthServiceError(authError, 'session')
    if (authData.user) await client().from('messages').update({ read_at: new Date().toISOString() }).eq('conversation_id', conversationId).neq('sender_id', authData.user.id).is('read_at', null)
    return (data as RawMessage[]).map(mapMessage)
  },
  async sendMessage(conversationId, content) {
    const { data: authData, error: authError } = await client().auth.getUser()
    if (authError) throw toAuthServiceError(authError, 'session')
    if (!authData.user) throw new Error('请先登录。')
    const { data, error } = await client().from('messages').insert({ conversation_id: conversationId, sender_id: authData.user.id, content: content.trim() }).select().single()
    if (error) throw toMarketplaceServiceError(error, '消息发送失败，请重试。')
    return mapMessage(data as RawMessage)
  },
  subscribeMessages(conversationId, callback) {
    const channel = client().channel(`conversation:${conversationId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, (payload) => callback(mapMessage(payload.new as RawMessage))).subscribe()
    return () => { void client().removeChannel(channel) }
  },
}
