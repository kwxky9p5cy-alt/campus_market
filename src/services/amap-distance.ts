import { campusAddress, type CampusName } from '@/services/campus-locations'

interface AMapLngLat { getLng(): number; getLat(): number }
interface AMapGeocoderResult { geocodes?: Array<{ location: AMapLngLat }> }
interface AMapGeocoder { getLocation(address: string, callback: (status: string, result: AMapGeocoderResult) => void): void }
interface AMapWalkingResult { routes?: Array<{ distance: number | string }> }
interface AMapWalking { search(origin: [number, number], destination: [number, number], callback: (status: string, result: AMapWalkingResult) => void): void }
interface AMapInstance { Geocoder: new (options?: { city?: string }) => AMapGeocoder; Walking: new () => AMapWalking }
declare global { interface Window { AMap?: AMapInstance; _AMapSecurityConfig?: { securityJsCode: string } } }

export interface Coordinates { longitude: number; latitude: number }

let amapPromise: Promise<AMapInstance> | undefined
const geocodeCache = new Map<string, Coordinates | null>()

function loadAMap() {
  if (window.AMap) return Promise.resolve(window.AMap)
  if (amapPromise) return amapPromise

  const key = import.meta.env.VITE_AMAP_JS_KEY as string | undefined
  const securityCode = import.meta.env.VITE_AMAP_SECURITY_CODE as string | undefined
  if (!key || !securityCode) return Promise.reject(new Error('请先在 .env.local 配置高德地图 Web JS Key 和安全密钥。'))

  window._AMapSecurityConfig = { securityJsCode: securityCode }
  amapPromise = new Promise<AMapInstance>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('#amap-js-sdk')
    if (existing) {
      existing.addEventListener('load', () => window.AMap ? resolve(window.AMap) : reject(new Error('高德地图加载失败。')), { once: true })
      existing.addEventListener('error', () => reject(new Error('高德地图加载失败，请检查网络和 Key 配置。')), { once: true })
      return
    }
    const script = document.createElement('script')
    script.id = 'amap-js-sdk'
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(key)}&plugin=AMap.Geocoder,AMap.Walking`
    script.async = true
    script.onload = () => window.AMap ? resolve(window.AMap) : reject(new Error('高德地图加载失败。'))
    script.onerror = () => reject(new Error('高德地图加载失败，请检查网络和 Key 配置。'))
    document.head.append(script)
  }).catch((error: unknown) => {
    amapPromise = undefined
    throw error
  })
  return amapPromise
}

export async function geocodeCampusLocation(campus: CampusName, location: string): Promise<Coordinates | null> {
  const address = campusAddress(campus, location)
  const cached = geocodeCache.get(address)
  if (cached !== undefined) return cached

  const amap = await loadAMap()
  const coordinates = await new Promise<Coordinates | null>((resolve, reject) => {
    const geocoder = new amap.Geocoder({ city: '成都' })
    geocoder.getLocation(address, (status, result) => {
      const first = result.geocodes?.[0]?.location
      if (status !== 'complete') return reject(new Error('高德地图地址解析失败，请检查地点名称。'))
      resolve(first ? { longitude: first.getLng(), latitude: first.getLat() } : null)
    })
  })
  geocodeCache.set(address, coordinates)
  return coordinates
}

export async function walkingDistanceMeters(origin: Coordinates, destination: Coordinates): Promise<number | null> {
  const amap = await loadAMap()
  return new Promise((resolve, reject) => {
    const walking = new amap.Walking()
    walking.search(
      [origin.longitude, origin.latitude],
      [destination.longitude, destination.latitude],
      (status, result) => {
        if (status === 'no_data') return resolve(null)
        if (status !== 'complete') return reject(new Error('高德地图步行路线规划失败。'))
        const distance = Number(result.routes?.[0]?.distance)
        resolve(Number.isFinite(distance) ? distance : null)
      },
    )
  })
}

export function formatDistance(meters: number) {
  if (meters < 100) return '<100m'
  if (meters < 500) return '<500m'
  if (meters < 1000) return `${Math.round(meters)}m`
  return `${(meters / 1000).toFixed(meters < 10_000 ? 1 : 0)}km`
}
