import { Navigate, Route, Routes } from 'react-router-dom'
import { FavoritesProvider } from '@/features/favorites/FavoritesProvider'
import { ProtectedRoute } from '@/features/auth/AuthProvider'
import { AppShell } from '@/layouts/AppShell'
import { HomePage } from '@/pages/HomePage'
import { SearchPage } from '@/pages/SearchPage'
import { ProductDetailPage } from '@/pages/ProductDetailPage'
import { ProductFormPage } from '@/pages/ProductFormPage'
import { FavoritesPage } from '@/pages/FavoritesPage'
import { TradesPage } from '@/pages/TradesPage'
import { MessagesPage } from '@/pages/MessagesPage'
import { ConversationPage } from '@/pages/ConversationPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { AssistantPage } from '@/pages/AssistantPage'

const protectedPage = (node: React.ReactNode) => <ProtectedRoute>{node}</ProtectedRoute>

export function App() {
  return (
    <FavoritesProvider>
      <AppShell>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/products/:id" element={<ProductDetailPage />} />
          <Route path="/sell" element={protectedPage(<ProductFormPage />)} />
          <Route path="/products/:id/edit" element={protectedPage(<ProductFormPage />)} />
          <Route path="/favorites" element={protectedPage(<FavoritesPage />)} />
          <Route path="/trades" element={protectedPage(<TradesPage />)} />
          <Route path="/messages" element={protectedPage(<MessagesPage />)} />
          <Route path="/messages/:id" element={protectedPage(<ConversationPage />)} />
          <Route path="/assistant" element={protectedPage(<AssistantPage />)} />
          <Route path="/profile" element={protectedPage(<ProfilePage />)} />
          <Route path="/me" element={<Navigate to="/profile" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AppShell>
    </FavoritesProvider>
  )
}
