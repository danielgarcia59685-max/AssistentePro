import { Geist, Geist_Mono } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
// import Providers from './providers' // Não use esse!
import '../lib/fonts';
import { Toaster } from '../components/ui/toaster';
import { Providers } from '@/context/Providers'; // ESTA LINHA é nova!

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

// 👇 ADICIONE ESTA PARTE PARA O FAVICON E TÍTULO
export const metadata = {
  title: 'AssistentePro - Gestão Financeira',
  description: 'Sistema completo de gestão financeira pessoal',
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/apple-touch-icon.png', // usa png mesmo
  },
}


export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <Providers>
          {children}
        </Providers>
        <Toaster />
      </body>
    </html>
  );
}
