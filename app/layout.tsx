import type { Metadata } from "next";
import { Barlow_Condensed, Geist_Mono, Inter, Oswald } from "next/font/google";
import "./globals.css";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://sangrenomadeadventure.vercel.app";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const barlow = Barlow_Condensed({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Sangre Nómade | Outdoor & Trekking · Córdoba",
    template: "%s | Sangre Nómade",
  },
  description:
    "Ropa técnica, capas térmicas e indumentaria forjada para resistir la abrasión del granito en Los Gigantes y el viento blanco de la cordillera andina. Envíos a todo el país.",
  keywords: [
    "trekking",
    "equipamiento montaña",
    "camperas 3L",
    "calzado Vibram",
    "Sangre Nómade",
    "Córdoba",
  ],
  icons: {
    icon: "/brand/isotipo-oficial.png",
    apple: "/brand/isotipo-oficial.png",
  },
  openGraph: {
    title: "Sangre Nómade | Outdoor & Trekking · Córdoba",
    description:
      "Expertos en el terreno, nómades por instinto. Equipo técnico testeado en sierras y cordillera.",
    type: "website",
    locale: "es_AR",
    url: "/",
    siteName: "Sangre Nómade",
    images: [
      {
        url: "/brand/isotipo-oficial.png",
        width: 512,
        height: 512,
        alt: "Sangre Nómade — isotipo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sangre Nómade | Outdoor & Trekking · Córdoba",
    description:
      "Equipo técnico testeado en sierras y cordillera. Envíos a todo el país.",
    images: ["/brand/isotipo-oficial.png"],
  },
  alternates: {
    canonical: "/",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${inter.variable} ${geistMono.variable} ${barlow.variable} ${oswald.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
