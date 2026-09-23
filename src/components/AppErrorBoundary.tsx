import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'

export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) console.error('Application render failed', error, info)
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-background p-6 text-center">
          <div className="max-w-md"><h1 className="text-xl font-semibold">页面暂时无法显示</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">请刷新页面重试。你的已保存数据不会受到影响。</p><Button className="mt-5" onClick={() => window.location.reload()}>刷新页面</Button></div>
        </main>
      )
    }
    return this.props.children
  }
}
