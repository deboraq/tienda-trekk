import type { Metadata } from "next";
import { Geist, Geist_Mono, Oswald } from "next/font/google";
import "./globals.css";

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
  title: "Sangre Nómade Adventure | Equipamiento de trekking",
  description:
    "Ropa y accesorios de trekking multimarcas (Columbia, Ansilta, Lippi, Doite y más). Asesoramiento técnico, senderistas y montañistas. Envíos Argentina. Córdoba.",
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
    title: "Sangre Nómade Adventure | Donde el mapa termina, comienza tu historia",
    description:
      "Equipamiento de trekking: calzado técnico, camperas, mochilas y accesorios. Multimarcas con asesoramiento real de ruta.",
    type: "website",
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
