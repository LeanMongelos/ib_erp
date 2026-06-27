import { Toaster } from 'sonner'
import { KeyboardNavProvider } from '@/components/layout/KeyboardNavProvider'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <KeyboardNavProvider>
      <Toaster position="top-right" richColors />
      {children}
    </KeyboardNavProvider>
  )
}
