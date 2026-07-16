import type {Metadata, Viewport} from 'next';
import {Manrope, Noto_Sans_SC} from 'next/font/google';
import {ServiceWorkerRegister} from '@/components/pwa/service-worker-register';
import './globals.css';

const manrope = Manrope({subsets: ['latin'], variable: '--font-display'});
const notoSansSc = Noto_Sans_SC({subsets: ['latin'], weight: ['400', '500', '700', '900'], variable: '--font-sans'});

export const metadata: Metadata = {
  title: 'KTV-Picker',
  description: 'Mobile-first KTV song importing and picking.',
  applicationName: 'KTV-Picker',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'What2Sing',
    statusBarStyle: 'black-translucent'
  },
  icons: {
    icon: [
      {url: '/icon.svg', type: 'image/svg+xml'},
      {url: '/icon-192.png', sizes: '192x192', type: 'image/png'},
      {url: '/icon-512.png', sizes: '512x512', type: 'image/png'}
    ],
    apple: [{url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png'}]
  }
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#050507'
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={`${manrope.variable} ${notoSansSc.variable} dark`}>
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
