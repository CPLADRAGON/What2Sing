import type {Metadata} from 'next';
import {Manrope, Noto_Sans_SC} from 'next/font/google';
import './globals.css';

const manrope = Manrope({subsets: ['latin'], variable: '--font-display'});
const notoSansSc = Noto_Sans_SC({subsets: ['latin'], weight: ['400', '500', '700', '900'], variable: '--font-sans'});

export const metadata: Metadata = {
  title: 'KTV-Picker',
  description: 'Mobile-first KTV song importing and picking.'
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={`${manrope.variable} ${notoSansSc.variable} dark`}>
      <body>{children}</body>
    </html>
  );
}
