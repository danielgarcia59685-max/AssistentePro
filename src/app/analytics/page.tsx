import type { Metadata } from 'next'
import { TransactionsProvider } from '@/context/TransactionsContext'
import { Geist, Geist_Mono } from 'next/font/google'
import '@/lib/fonts'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'AssistentePro - Assistente Pessoal Financeiro',
  description: 'Seu assistente pessoal para controle financeiro completo',
  icons: {
    icon: [{ url: '/favicon.ico' }, { url: '/icon.png', type: 'image/png' }],
    apple: [{ url: '/apple-touch-icon.png' }],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <TransactionsProvider>{children}</TransactionsProvider>
      </body>
    </html>
  )
}
