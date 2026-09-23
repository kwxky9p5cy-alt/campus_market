import type { ProductCategory, ProductCondition, ProductStatus, TradeStatus } from '@/types/domain'

export const CATEGORY_OPTIONS: Array<{ value: ProductCategory | 'all'; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'digital', label: '数码' },
  { value: 'books', label: '教材' },
  { value: 'life', label: '生活' },
  { value: 'sports', label: '运动' },
  { value: 'other', label: '其他' },
]

export const CONDITION_OPTIONS: Array<{ value: ProductCondition | 'all'; label: string }> = [
  { value: 'all', label: '全部成色' },
  { value: 'new', label: '全新' },
  { value: 'like_new', label: '几乎全新' },
  { value: 'good', label: '成色良好' },
  { value: 'fair', label: '有使用痕迹' },
]

export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  digital: '数码',
  books: '教材',
  life: '生活',
  sports: '运动',
  other: '其他',
}

export const CONDITION_LABELS: Record<ProductCondition, string> = {
  new: '全新',
  like_new: '几乎全新',
  good: '成色良好',
  fair: '有使用痕迹',
}

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  draft: '草稿',
  active: '在售',
  reserved: '已预订',
  sold: '已售出',
  inactive: '已下架',
}

export const TRADE_STATUS_LABELS: Record<TradeStatus, string> = {
  pending: '等待卖家处理',
  accepted: '已接受 · 待面交',
  rejected: '已拒绝',
  cancelled: '已取消',
  completed: '交易完成',
}

export const MAX_IMAGES = 5
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
