import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

// v142: Cohesive serious font family — Inter for everything (body + headings),
// JetBrains Mono for code/numbers. Both designed by Rasmus Andersson to pair
// perfectly. Inter has full Cyrillic support (ў, қ, ғ, ҳ, а-я) for sud.uz data.
// Removed: Unbounded (playful geometric display) + Caveat (handwritten casual).
const jakarta = Inter({
  variable: "--font-jakarta",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sud To'lovlarini Qidiruv - billing.sud.uz kvitansiyalarini import qiluvchi vosita",
  description:
    "Kompaniya STIR raqamini kiriting (9 ta raqam). Ilova billing.sud.uz saytidan barcha kvitansiyalarni import qiladi — turini (davlat boji / pochta), to'langan summani, holatini, sudni va har bir to'lov ishlatilgan sud ish raqamlarini ko'rsatadi.",
  keywords: ["billing.sud.uz", "sud billing", "kvitansiya", "davlat boji", "INN", "STIR", "yuridik shaxs", "Uzbekistan court fees"],
  authors: [{ name: "Sud Billing Lookup" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "Sud To'lovlarini Qidiruv",
    description: "billing.sud.uz dan kompaniya nomiga chiqarilgan barcha kvitansiyalarni import qiling",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sud To'lovlarini Qidiruv",
    description: "billing.sud.uz dan kompaniya nomiga chiqarilgan barcha kvitansiyalarni import qiling",
  },
};

// FOUC prevention: apply saved theme before first paint.
// Uses 'mono-theme' key (matches the "Monochrome Glass" preview).
// Defaults to 'light' (preview default).
const themeBootstrap = `
(function(){
  try {
    var t = localStorage.getItem('mono-theme') || 'light';
    if (t !== 'light' && t !== 'dark') t = 'light';
    document.documentElement.setAttribute('data-theme', t);
  } catch(e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uz" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body
        className={`${jakarta.variable} ${jetbrains.variable} antialiased`}
      >
        {children}
        <Toaster />
        <SonnerToaster position="top-center" closeButton />
      </body>
    </html>
  );
}
