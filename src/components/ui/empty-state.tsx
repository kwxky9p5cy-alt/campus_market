import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction }: { icon: LucideIcon; title: string; description: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center border border-dashed border-border px-6 py-12 text-center">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-muted"><Icon className="h-5 w-5 text-muted-foreground" aria-hidden="true" /></div>
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {actionLabel && onAction ? <Button className="mt-5" variant="outline" onClick={onAction}>{actionLabel}</Button> : null}
    </div>
  )
}
