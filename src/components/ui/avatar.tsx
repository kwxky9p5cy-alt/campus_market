import { cn, getInitials } from '@/lib/utils'

export function Avatar({ src, name, className }: { src?: string | null; name: string; className?: string }) {
  return (
    <span className={cn('inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-xs font-semibold text-secondary-foreground', className)} aria-label={name}>
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : getInitials(name)}
    </span>
  )
}
