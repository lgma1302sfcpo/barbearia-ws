import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL('https://controle-repasses-barbearia.indigo-rice-2953.chatgpt.site'),
  title: 'Controle de Repasses',
  description: 'Atendimentos, repasses e resumo mensal de Flávio e Fernando.',
  openGraph: {
    title: 'Controle de Repasses',
    description: 'Atendimentos, 60% e 40% em ordem.',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Controle de Repasses' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Controle de Repasses',
    description: 'Atendimentos, 60% e 40% em ordem.',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>{children}</body></html>;
}
