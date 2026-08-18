import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Voss & Dicke FieldOps',
    short_name: 'V&D FieldOps',
    description: 'Interne D2D-Arbeitsapp für Voss & Dicke GbR',
    start_url: '/',
    display: 'standalone',
    background_color: '#f4f7f4',
    theme_color: '#102519',
    orientation: 'any',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
