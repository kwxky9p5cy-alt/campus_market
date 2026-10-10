/**
 * Search aliases for buildings and residential groups on the UESTC campus.
 * Keep canonical names and aliases here so search UI and both data services
 * interpret buyer location filters in the same way.
 */
export const CAMPUS_LOCATIONS = [
  { canonical: '学知苑一组团', aliases: ['学知苑一组团', '一组团'] },
  { canonical: '信息与通信工程学院', aliases: ['信息与通信工程学院', '信通学院'] },
  { canonical: '软件工程学院', aliases: ['软件工程学院'] },
] as const

export const CAMPUS_OPTIONS = ['清水河校区', '沙河校区'] as const
export type CampusName = (typeof CAMPUS_OPTIONS)[number]

export function campusAddress(campus: CampusName, location: string) {
  const value = location.trim().replace(/^(清水河|沙河)校区\s*[·,，-]?\s*/u, '')
  const normalized = resolveCampusLocation(value)?.canonical ?? value
  return `电子科技大学${campus}${normalized}`
}

export function splitCampusAddress(value: string): { campus: CampusName; location: string } {
  const match = value.match(/^(清水河|沙河)校区\s*[·,，-]?\s*(.*)$/u)
  return {
    campus: match?.[1] === '沙河' ? '沙河校区' : '清水河校区',
    location: match?.[2] ?? value,
  }
}

export function formatCampusLocation(value: string) {
  const { campus, location } = splitCampusAddress(value)
  return `${location || '校园内'}（${campus}）`
}

function compact(value: string) {
  return value.toLowerCase().replace(/[\s　]/g, '')
}

const aliasesByLength = CAMPUS_LOCATIONS.flatMap((location) =>
  location.aliases.map((alias) => ({ ...location, alias })),
).sort((a, b) => b.alias.length - a.alias.length)

export function resolveCampusLocation(value: string | null | undefined) {
  if (!value?.trim()) return null
  const input = compact(value)
  const match = aliasesByLength.find(({ alias }) => input.includes(compact(alias)))
  return match ? { canonical: match.canonical, aliases: [...match.aliases] } : null
}

/** Strip campus-intent wording and recognized building names before item search. */
export function removeCampusLocationTerms(value: string) {
  let result = value
  for (const { alias } of aliasesByLength) {
    result = result.replace(new RegExp(alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ' ')
  }
  return result
    .replace(/附近的人|附近同学|附近|离我近|离我最近|校内|学校里|电子科技大学|电子科大/g, ' ')
    .replace(/[，,。.!！?？、\s]+/g, ' ')
    .trim()
}
