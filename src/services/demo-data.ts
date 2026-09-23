import type { Conversation, Message, Product, Profile, TradeRequest } from '@/types/domain'

const now = Date.now()
const ago = (hours: number) => new Date(now - hours * 60 * 60 * 1000).toISOString()

export const demoProfiles: Profile[] = [
  { id: 'demo-user', username: '林同学', avatarUrl: null, bio: '毕业季清理闲置，校园内可面交。', createdAt: ago(2400), updatedAt: ago(72) },
  { id: 'seller-chen', username: '陈同学', avatarUrl: null, bio: '数码爱好者，物品都会如实描述。', createdAt: ago(3500), updatedAt: ago(120) },
  { id: 'seller-wang', username: '王同学', avatarUrl: null, bio: '课程教材和宿舍好物出闲置。', createdAt: ago(1800), updatedAt: ago(200) },
  { id: 'seller-zhao', username: '赵同学', avatarUrl: null, bio: null, createdAt: ago(900), updatedAt: ago(96) },
]

const image = (productId: string, id: string, url: string, order = 0) => ({
  id,
  productId,
  storagePath: `seed/${id}.jpg`,
  url,
  sortOrder: order,
  createdAt: ago(48),
})

const p = (value: Omit<Product, 'seller' | 'images'> & { seller: Profile; imageUrls: string[] }): Product => ({
  ...value,
  images: value.imageUrls.map((url, index) => image(value.id, `${value.id}-image-${index + 1}`, url, index)),
})

export const demoProducts: Product[] = [
  p({
    id: 'product-monitor', sellerId: 'seller-chen', seller: demoProfiles[1], title: 'Dell 24 英寸显示器', description: '1080P IPS 屏幕，色彩正常，无坏点。附电源线和 HDMI 线，宿舍桌面升级后闲置。', category: 'digital', price: 420, originalPrice: 899, condition: 'good', location: '宿舍区', status: 'active', createdAt: ago(2), updatedAt: ago(2),
    imageUrls: ['https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=1200&q=82'],
  }),
  p({
    id: 'product-keyboard', sellerId: 'seller-chen', seller: demoProfiles[1], title: 'Keychron K2 机械键盘', description: '茶轴，蓝牙和有线都能用。键帽有轻微使用痕迹，功能正常，带原装线。', category: 'digital', price: 260, originalPrice: 568, condition: 'good', location: '图书馆附近', status: 'active', createdAt: ago(5), updatedAt: ago(5),
    imageUrls: ['https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=1200&q=82', 'https://images.unsplash.com/photo-1595225476474-87563907a212?auto=format&fit=crop&w=1200&q=82'],
  }),
  p({
    id: 'product-k380', sellerId: 'demo-user', seller: demoProfiles[0], title: '罗技 K380 蓝牙键盘', description: '用了约一年，按键和蓝牙连接都正常。换机械键盘后闲置，外壳有正常使用痕迹。', category: 'digital', price: 95, originalPrice: 189, condition: 'good', location: '食堂门口', status: 'active', createdAt: ago(8), updatedAt: ago(8),
    imageUrls: ['https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?auto=format&fit=crop&w=1200&q=82'],
  }),
  p({
    id: 'product-calculus', sellerId: 'seller-wang', seller: demoProfiles[2], title: '高等数学第七版上下册', description: '同济版，上册有少量重点标注，下册很新。两本一起出，不影响正常阅读。', category: 'books', price: 32, originalPrice: 89, condition: 'good', location: '教学楼附近', status: 'active', createdAt: ago(11), updatedAt: ago(11),
    imageUrls: ['https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=1200&q=82'],
  }),
  p({
    id: 'product-lamp', sellerId: 'seller-wang', seller: demoProfiles[2], title: '可调光护眼台灯', description: '三档色温，可调亮度，触摸操作。灯臂转轴正常，适合宿舍书桌。', category: 'life', price: 48, originalPrice: 129, condition: 'like_new', location: '宿舍区', status: 'active', createdAt: ago(18), updatedAt: ago(18),
    imageUrls: ['https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=1200&q=82'],
  }),
  p({
    id: 'product-bike', sellerId: 'seller-zhao', seller: demoProfiles[3], title: '通勤自行车 26 寸', description: '前后刹车正常，车铃和车锁都在。车身有使用痕迹，适合校内通勤，建议现场试骑。', category: 'sports', price: 180, originalPrice: 499, condition: 'fair', location: '体育馆附近', status: 'reserved', createdAt: ago(26), updatedAt: ago(3),
    imageUrls: ['https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=1200&q=82'],
  }),
  p({
    id: 'product-headphones', sellerId: 'seller-chen', seller: demoProfiles[1], title: 'Sony 头戴式蓝牙耳机', description: '降噪和续航正常，耳罩有轻微使用痕迹，已清洁。配收纳包和充电线。', category: 'digital', price: 360, originalPrice: 899, condition: 'good', location: '校园内面交', status: 'active', createdAt: ago(32), updatedAt: ago(32),
    imageUrls: ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1200&q=82'],
  }),
  p({
    id: 'product-racket', sellerId: 'seller-zhao', seller: demoProfiles[3], title: '尤尼克斯入门羽毛球拍', description: '拍框无裂痕，手胶建议自行更换。附拍套，适合体育课或日常锻炼。', category: 'sports', price: 85, originalPrice: 199, condition: 'good', location: '体育馆附近', status: 'active', createdAt: ago(43), updatedAt: ago(43),
    imageUrls: ['https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=1200&q=82'],
  }),
  p({
    id: 'product-calculator', sellerId: 'demo-user', seller: demoProfiles[0], title: '卡西欧科学计算器', description: '所有按键正常，屏幕显示清晰。工程课使用，已更换新电池。', category: 'other', price: 45, originalPrice: 118, condition: 'good', location: '图书馆附近', status: 'sold', createdAt: ago(64), updatedAt: ago(9),
    imageUrls: ['https://images.unsplash.com/photo-1564466809058-bf4114d55352?auto=format&fit=crop&w=1200&q=82'],
  }),
  p({
    id: 'product-camera', sellerId: 'seller-chen', seller: demoProfiles[1], title: '富士入门微单相机', description: '机身功能正常，快门数不高。具体外观成色建议现场查看，包含电池和充电器。', category: 'digital', price: 1680, originalPrice: 3299, condition: 'good', location: '校园内面交', status: 'active', createdAt: ago(75), updatedAt: ago(75),
    imageUrls: ['https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1200&q=82'],
  }),
  p({
    id: 'product-fan', sellerId: 'seller-wang', seller: demoProfiles[2], title: '桌面静音小风扇', description: 'USB 供电，三档风速，运行正常。搬宿舍后用不上了。', category: 'life', price: 25, originalPrice: 59, condition: 'like_new', location: '宿舍区', status: 'active', createdAt: ago(90), updatedAt: ago(90),
    imageUrls: ['https://images.unsplash.com/photo-1565151443833-29bf2ba5dd8c?auto=format&fit=crop&w=1200&q=82'],
  }),
  p({
    id: 'product-router', sellerId: 'demo-user', seller: demoProfiles[0], title: 'TP-Link 千兆双频路由器', description: '毕业搬家闲置，双频 Wi-Fi 和网口都正常，已恢复出厂设置。', category: 'digital', price: 70, originalPrice: 169, condition: 'good', location: '宿舍区', status: 'inactive', createdAt: ago(120), updatedAt: ago(20),
    imageUrls: ['https://images.unsplash.com/photo-1606904825846-647eb07f5be2?auto=format&fit=crop&w=1200&q=82'],
  }),
]

export const demoTradeRequests: TradeRequest[] = [
  {
    id: 'trade-bike', productId: 'product-bike', buyerId: 'demo-user', sellerId: 'seller-zhao', status: 'accepted', createdAt: ago(13), updatedAt: ago(3), product: demoProducts[5], buyer: demoProfiles[0], seller: demoProfiles[3],
  },
  {
    id: 'trade-monitor', productId: 'product-monitor', buyerId: 'demo-user', sellerId: 'seller-chen', status: 'pending', createdAt: ago(1), updatedAt: ago(1), product: demoProducts[0], buyer: demoProfiles[0], seller: demoProfiles[1],
  },
]

export const demoMessages: Message[] = [
  { id: 'message-1', conversationId: 'conversation-bike', senderId: 'demo-user', content: '你好，自行车周三下午方便看一下吗？', createdAt: ago(12), readAt: ago(11) },
  { id: 'message-2', conversationId: 'conversation-bike', senderId: 'seller-zhao', content: '可以，下午四点体育馆门口见。你到了给我发消息。', createdAt: ago(11), readAt: null },
]

export const demoConversations: Conversation[] = [
  {
    id: 'conversation-bike', productId: 'product-bike', buyerId: 'demo-user', sellerId: 'seller-zhao', tradeRequestId: 'trade-bike', createdAt: ago(13), updatedAt: ago(11), product: demoProducts[5], buyer: demoProfiles[0], seller: demoProfiles[3], lastMessage: demoMessages[1], unreadCount: 1,
  },
]
