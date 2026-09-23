// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { demoService } from '@/services/demo-store'
import type { ProductInput } from '@/types/domain'

const listing: ProductInput = {
  title: 'USB 桌面麦克风',
  description: '功能正常，旋钮和接口都可以使用，包含原装连接线。',
  category: 'digital',
  price: 68,
  originalPrice: 159,
  condition: 'good',
  location: '图书馆附近',
}

beforeEach(async () => {
  localStorage.clear()
  demoService.resetDemo()
  await demoService.signOut()
})

describe('demo authentication and ownership', () => {
  it('persists a session and protects another seller product', async () => {
    const session = await demoService.signIn('demo@campus.market', 'demo1234')
    expect((await demoService.getSession())?.id).toBe(session.id)
    await expect(demoService.deleteProduct('product-monitor')).rejects.toThrow('没有权限')
  })

  it('registers a new account and creates its profile', async () => {
    const session = await demoService.signUp('new@student.test', 'password88', '新用户')
    expect(session.email).toBe('new@student.test')
    expect((await demoService.getSession())?.profile.username).toBe('新用户')
  })

  it('creates, edits, changes status, and deletes an owned product', async () => {
    await demoService.signIn('demo@campus.market', 'demo1234')
    const file = new File([new Uint8Array([137, 80, 78, 71])], 'item.png', { type: 'image/png' })
    const product = await demoService.createProduct(listing, [file])
    expect(product.images).toHaveLength(1)
    const updated = await demoService.updateProduct(product.id, { ...listing, price: 60 }, [], product.images.map((image) => image.id))
    expect(updated.price).toBe(60)
    expect((await demoService.setProductStatus(product.id, 'inactive')).status).toBe('inactive')
    await demoService.deleteProduct(product.id)
    expect(await demoService.getProduct(product.id)).toBeNull()
  })
})

describe('favorites, trades, and conversations', () => {
  it('filters by keyword, category, price, condition, and sorting', async () => {
    const products = await demoService.listProducts({ query: '数码', category: 'digital', maxPrice: 300, condition: 'good', sort: 'price_asc' })
    expect(products.length).toBeGreaterThan(1)
    expect(products.every((product) => product.category === 'digital' && product.price <= 300 && product.condition === 'good')).toBe(true)
    expect(products.map((product) => product.price)).toEqual(products.map((product) => product.price).sort((a, b) => a - b))
  })

  it('toggles favorites without duplicates', async () => {
    await demoService.signIn('demo@campus.market', 'demo1234')
    expect(await demoService.toggleFavorite('product-monitor')).toBe(true)
    expect((await demoService.favoriteIds()).filter((id) => id === 'product-monitor')).toHaveLength(1)
    expect(await demoService.toggleFavorite('product-monitor')).toBe(false)
  })

  it('enforces buyer/seller roles and updates product through the completed trade flow', async () => {
    await demoService.signIn('demo@campus.market', 'demo1234')
    const trade = await demoService.createTrade('product-lamp')
    await expect(demoService.createTrade('product-k380')).rejects.toThrow('自己发布')
    await demoService.signOut()
    await demoService.signIn('wang@campus.market', 'demo1234')
    await expect(demoService.updateTrade(trade.id, 'cancelled')).rejects.toThrow('不允许')
    expect((await demoService.updateTrade(trade.id, 'accepted')).status).toBe('accepted')
    expect((await demoService.getProduct('product-lamp'))?.status).toBe('reserved')
    expect((await demoService.updateTrade(trade.id, 'completed')).status).toBe('completed')
    expect((await demoService.getProduct('product-lamp'))?.status).toBe('sold')
  })

  it('supports buyer cancellation and seller rejection', async () => {
    await demoService.signIn('demo@campus.market', 'demo1234')
    expect((await demoService.updateTrade('trade-monitor', 'cancelled')).status).toBe('cancelled')
    const request = await demoService.createTrade('product-headphones')
    await demoService.signOut()
    await demoService.signIn('chen@campus.market', 'demo1234')
    expect((await demoService.updateTrade(request.id, 'rejected')).status).toBe('rejected')
    expect((await demoService.getProduct('product-headphones'))?.status).toBe('active')
  })

  it('lets a buyer cancel an accepted trade and reopens the product', async () => {
    await demoService.signIn('demo@campus.market', 'demo1234')
    const request = await demoService.createTrade('product-lamp')
    await demoService.signOut()
    await demoService.signIn('wang@campus.market', 'demo1234')
    await demoService.updateTrade(request.id, 'accepted')
    await demoService.signOut()
    await demoService.signIn('demo@campus.market', 'demo1234')
    expect((await demoService.updateTrade(request.id, 'cancelled')).status).toBe('cancelled')
    expect((await demoService.getProduct('product-lamp'))?.status).toBe('active')
  })

  it('creates one conversation and persists messages for participants only', async () => {
    await demoService.signIn('demo@campus.market', 'demo1234')
    const first = await demoService.getOrCreateConversation('product-headphones')
    const second = await demoService.getOrCreateConversation('product-headphones')
    expect(second.id).toBe(first.id)
    await demoService.sendMessage(first.id, '你好，请问耳机还在吗？')
    expect((await demoService.listMessages(first.id)).at(-1)?.content).toContain('耳机还在吗')
    await demoService.signOut()
    await demoService.signIn('wang@campus.market', 'demo1234')
    expect(await demoService.getConversation(first.id)).toBeNull()
    await expect(demoService.listMessages(first.id)).rejects.toThrow('无权')
  })
})
