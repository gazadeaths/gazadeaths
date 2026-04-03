import type { Metadata } from "next";
import { Inter, Noto_Sans_Arabic } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { PublicNavbar } from "@/components/PublicNavbar";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { I18nProvider } from "@/lib/i18n-context";
import { Locale, locales, isValidLocale, getDirection } from "@/lib/i18n";
import { notFound } from "next/navigation";
import "../globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const notoSansArabic = Noto_Sans_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic"],
  display: "swap",
});

export async function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  
  const isArabic = locale === 'ar';
  
  const title = isArabic
    ? "شهداء غزة - Gaza Deaths"
    : "Gaza Deaths - شهداء غزة";
  const description = isArabic
    ? "توثيق وإنسانية الشهداء في غزة - مشروع لتخليد ذكرى كل من استشهد في الإبادة الجماعية"
    : "Documenting and humanising the victims of the Gaza genocide - a project to preserve the memory of every life lost";
  const siteUrl = "https://gazadeaths.com";

  return {
    title,
    description,
    metadataBase: new URL(siteUrl),
    alternates: {
      canonical: `/${locale}`,
      languages: {
        en: '/en',
        ar: '/ar',
      },
    },
    openGraph: {
      title,
      description,
      url: `${siteUrl}/${locale}`,
      siteName: 'Gaza Deaths',
      locale: isArabic ? 'ar_PS' : 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    robots: {
      index: true,
      follow: true,
    },
    icons: {
      icon: [
        { url: '/icon.png', sizes: '32x32', type: 'image/png' },
      ],
      apple: [
        { url: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
      ],
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale: localeParam } = await params;
  
  // Validate locale
  if (!isValidLocale(localeParam)) {
    notFound();
  }
  
  const locale = localeParam as Locale;
  const direction = getDirection(locale);
  const isArabic = locale === 'ar';

  return (
    <html 
      lang={locale} 
      dir={direction}
      suppressHydrationWarning
    >
      <body
        className={`${inter.variable} ${notoSansArabic.variable} antialiased ${
          isArabic ? 'font-arabic' : 'font-sans'
        }`}
        suppressHydrationWarning
        style={isArabic ? { fontSize: '107%' } : undefined}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <I18nProvider locale={locale}>
            <PublicNavbar />
            <main>{children}</main>
            <Toaster />
          </I18nProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}

