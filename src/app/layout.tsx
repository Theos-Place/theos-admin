import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

// CSP con nonce (B17): el nonce es por request, así que TODA página debe
// renderizarse por request — una página estática se prerenderiza en build SIN
// nonce y el browser bloquea sus scripts inline. Es el trade-off documentado
// de nonce-CSP en Next; aceptable en un admin interno de tráfico modesto.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: {
    default: 'Theos Place — Sistema Administrativo',
    template: '%s | Theos Place',
  },
  description: 'Sistema administrativo interno de Theos Place. Gestión de miembros, eventos, estudios, finanzas y comunicaciones.',
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>{children}</body>
    </html>
  );
}
