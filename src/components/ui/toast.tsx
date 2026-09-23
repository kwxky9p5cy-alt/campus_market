import { CheckCircle2, CircleAlert, X } from 'lucide-react'
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { cn, makeId } from '@/lib/utils'

type ToastTone = 'success' | 'error' | 'info'
interface ToastItem { id: string; title: string; description?: string; tone: ToastTone }
interface ToastContextValue { toast: (item: Omit<ToastItem, 'id'>) => void }
const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const remove = useCallback((id: string) => setItems((current) => current.filter((item) => item.id !== id)), [])
  const toast = useCallback((item: Omit<ToastItem, 'id'>) => {
    const id = makeId('toast')
    setItems((current) => [...current.slice(-2), { ...item, id }])
    window.setTimeout(() => remove(id), 4200)
  }, [remove])
  const value = useMemo(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] grid w-[calc(100%-2rem)] max-w-sm gap-2" aria-live="polite" aria-atomic="true">
        {items.map((item) => (
          <div key={item.id} className={cn('surface flex items-start gap-3 rounded-lg p-4 shadow-lg', item.tone === 'error' && 'border-destructive/30')} role={item.tone === 'error' ? 'alert' : 'status'}>
            {item.tone === 'success' ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" /> : item.tone === 'error' ? <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" /> : <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />}
            <div className="min-w-0 flex-1"><p className="text-sm font-medium">{item.title}</p>{item.description ? <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{item.description}</p> : null}</div>
            <button type="button" className="focus-ring rounded p-1 text-muted-foreground hover:text-foreground" onClick={() => remove(item.id)} aria-label="关闭提示"><X className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const value = useContext(ToastContext)
  if (!value) throw new Error('useToast must be used inside ToastProvider')
  return value
}
