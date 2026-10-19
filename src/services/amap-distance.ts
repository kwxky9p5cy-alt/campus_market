import { campusAddress, type CampusName } from '@/services/campus-locations'

interface AMapLngLat { getLng(): number; getLat(): number }
interface AMapGeocoderResult { geocodes?: Array<{ location: AMapLngLat }> }
interface AMapGeocoder { getLocation(address: string, callback: (status: string, result?: AMapGeocoderResult) => void): void }
interface AMapWalkingResult { routes?: Array<{ distance: number | string }> }
interface AMapWalking { search(origin: [number, number], destination: [number, number], callback: (status: string, result?: AMapWalkingResult) => void): void }
interface AMapInstance { Geocoder: new (options?: { city?: string }) => AMapGeocoder; Walking: new () => AMapWalking }
declare global { interface Window { AMap?: AMapInstance; _AMapSecurityConfig?: { securityJsCode: string } } }

export interface Coordinates { longitude: number; latitude: number }

let amapPromise: Promise<AMapInstance> | undefined
const geocodeCache = new Map<string, Coordinates | null>()
const SDK_LOAD_TIMEOUT_MS = 8_000
const MAP_OPERATION_TIMEOUT_MS = 6_000

export function withTimeout<T>(operation: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs)
    operation.then(
      (value) => { clearTimeout(timer); resolve(value) },
      (error) => { clearTimeout(timer); reject(error) },
    )
  })
}

export function resetAMapLoader() {
  amapPromise = undefined
  if (!window.AMap) document.querySelector<HTMLScriptElement>('#amap-js-sdk')?.remove()
}

function loadAMap() {
  if (window.AMap) return Promise.resolve(window.AMap)
  if (amapPromise) return amapPromise

  const key = import.meta.env.VITE_AMAP_JS_KEY as string | undefined
  const securityCode = import.meta.env.VITE_AMAP_SECURITY_CODE as string | undefined
  if (!key || !securityCode) return Promise.reject(new Error('距离服务尚未配置，请暂时取消距离条件。'))

  window._AMapSecurityConfig = { securityJsCode: securityCode }
  amapPromise = new Promise<AMapInstance>((resolve, reject) => {
    let script = document.querySelector<HTMLScriptElement>('#amap-js-sdk')
    if (script?.dataset.amapState === 'failed') {
      script.remove()
      script = null
    }

    const target = script ?? document.createElement('script')
    let settled = false
    const cleanup = () => {
      window.clearTimeout(timer)
      target.removeEventListener('load', handleLoad)
      target.removeEventListener('error', handleError)
    }
    const fail = (message: string) => {
      if (settled) return
      settled = true
      target.dataset.amapState = 'failed'
      cleanup()
      if (!window.AMap) target.remove()
      reject(new Error(message))
    }
    const handleLoad = () => {
      if (!window.AMap) return fail('高德地图初始化失败，请检查 Key 与可用域名设置。')
      if (settled) return
      settled = true
      target.dataset.amapState = 'loaded'
      cleanup()
      resolve(window.AMap)
    }
    const handleError = () => fail('当前网络无法连接高德地图，请稍后重试或暂时取消距离条件。')
    const timer = window.setTimeout(
      () => fail('高德地图连接超时，请稍后重试或暂时取消距离条件。'),
      SDK_LOAD_TIMEOUT_MS,
    )

    target.addEventListener('load', handleLoad, { once: true })
    target.addEventListener('error', handleError, { once: true })

    if (!script) {
      target.id = 'amap-js-sdk'
      target.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(key)}&plugin=AMap.Geocoder,AMap.Walking`
      target.async = true
      target.dataset.amapState = 'loading'
      document.head.append(target)
    } else if (script.dataset.amapState === 'loaded') {
      handleLoad()
    }
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
  const coordinates = await withTimeout(new Promise<Coordinates | null>((resolve, reject) => {
    const geocoder = new amap.Geocoder({ city: '成都' })
    geocoder.getLocation(address, (status, result) => {
      const first = result?.geocodes?.[0]?.location
      if (status !== 'complete') return reject(new Error('高德地图地址解析失败，请检查地点名称。'))
      resolve(first ? { longitude: first.getLng(), latitude: first.getLat() } : null)
    })
  }), MAP_OPERATION_TIMEOUT_MS, '高德地图地址解析超时，请稍后重试。')
  geocodeCache.set(address, coordinates)
  return coordinates
}

export async function walkingDistanceMeters(origin: Coordinates, destination: Coordinates): Promise<number | null> {
  const amap = await loadAMap()
  return withTimeout(new Promise((resolve, reject) => {
    const walking = new amap.Walking()
    walking.search(
      [origin.longitude, origin.latitude],
      [destination.longitude, destination.latitude],
      (status, result) => {
        if (status === 'no_data') return resolve(null)
        if (status !== 'complete') return reject(new Error('高德地图步行路线规划失败。'))
        const distance = Number(result?.routes?.[0]?.distance)
        resolve(Number.isFinite(distance) ? distance : null)
      },
    )
  }), MAP_OPERATION_TIMEOUT_MS, '高德地图步行路线规划超时，请稍后重试。')
}

export function formatDistance(meters: number) {
  if (meters < 100) return '<100m'
  if (meters < 500) return '<500m'
  if (meters < 1000) return `${Math.round(meters)}m`
  return `${(meters / 1000).toFixed(meters < 10_000 ? 1 : 0)}km`
}
