import './globals.css'
import type { Metadata } from 'next'
import { Cormorant_Garamond, DM_Sans, DM_Mono } from 'next/font/google'
import { Providers } from './providers'

const display = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
})

const sans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-sans',
  display: 'swap',
})

const mono = DM_Mono({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Audere',
  description: 'Sistema operacional da prática clínica.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body>
        {/* Modo sigilo: aplica a classe ANTES da pintura pra não piscar dados
            sensíveis ao carregar com o sigilo ligado. */}
        <script dangerouslySetInnerHTML={{ __html: `try{if(localStorage.getItem('auren.sigilo')==='1')document.documentElement.classList.add('sigilo-on')}catch(e){}` }} />
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
