import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Nómade Mates | Tienda Oficial",
  description: "Mates artesanales y accesorios. Grabados láser, termos, bombillas y set materos. Envíos a todo el país. Córdoba, Argentina.",
  openGraph: {
    title: "Nómade Mates | Tienda Oficial",
    description: "Mates artesanales y accesorios. Grabados láser, termos, bombillas. Envíos a todo el país.",
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
