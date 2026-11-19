import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { ThemeProvider } from 'next-themes';
import { MotionConfigProvider } from '@/components/site-motion';
import { SiteFooter, SiteHeader } from '@/components/site-chrome';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'VoiceKit — Voice interface components for React', template: '%s · VoiceKit' },
  description: 'Open-source, audio-reactive voice interface presets for React. Preview eight visuals and install their source with shadcn.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="flex min-h-dvh flex-col antialiased">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
          <MotionConfigProvider>
            <a className="fixed top-3 left-3 z-50 -translate-y-[200%] rounded border bg-background px-3 py-2 text-sm focus:translate-y-0" href="#main-content">Skip to content</a>
            <SiteHeader />
            <main id="main-content" className="min-w-0 flex-1">{children}</main>
            <SiteFooter />
          </MotionConfigProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
