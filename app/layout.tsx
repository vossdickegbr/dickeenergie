import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Voss & Dicke FieldOps',
  description: 'Interne D2D-Arbeitsapp für Wochenplanung, Termine, Kunden und Arbeitszeiten.',
  applicationName: 'V&D FieldOps',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'V&D FieldOps',
  },
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
  icons: {
    icon: '/icons/favicon.png',
    apple: '/icons/apple-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#102519',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  )
}
