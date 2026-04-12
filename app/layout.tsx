import type { Metadata } from "next";
import { Geist, Geist_Mono, Oswald } from "next/font/google";
import "./globals.css";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://sangrenomadeadventure.vercel.app";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Sangre Nómade Adventure | Equipamiento de trekking",
    template: "%s | Sangre Nómade Adventure",
  },
  description:
    "Ropa y accesorios de trekking multimarcas (Columbia, Ansilta, Lippi, Doite y más). Asesoramiento técnico para senderistas y montañistas. Envíos Argentina. Córdoba.",
  keywords: [
    "trekking",
    "equipamiento montaña",
    "calzado trekking",
    "camperas impermeables",
    "multimarcas outdoor",
    "Córdoba",
  ],
  icons: {
    icon: "/logo-sangre-nomade.png",
    apple: "/logo-sangre-nomade.png",
  },
  openGraph: {
    title: "Sangre Nómade Adventure | Equipamiento de trekking",
    description:
      "Equipamiento de trekking: calzado técnico, camperas, mochilas y accesorios. Multimarcas con asesoramiento real de ruta. Desde Córdoba, envíos a todo el país.",
    type: "website",
    locale: "es_AR",
    url: "/",
    siteName: "Sangre Nómade Adventure",
    images: [
      {
        url: "/logo-sangre-nomade.png",
        width: 512,
        height: 512,
        alt: "Sangre Nómade Adventure — logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sangre Nómade Adventure | Equipamiento de trekking",
    description:
      "Equipamiento de trekking multimarcas con asesoramiento técnico. Envíos Argentina.",
    images: ["/logo-sangre-nomade.png"],
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
        className={`${geistSans.variable} ${geistMono.variable} ${oswald.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
