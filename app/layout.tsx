import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Geist_Mono, Lexend } from "next/font/google";
import "./globals.css";
import { LawFirmJsonLd } from "@/components/JsonLd";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const displayFont = Lexend({
  variable: "--font-serif",
  subsets: ["latin"],
});

const BASE_URL = "https://amadoeamadojr.com.br";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "Amado & Amado Jr. Advogados | Direito Canábico e Habeas Corpus",
    template: "%s | Amado & Amado Jr. Advogados",
  },
  description: "Escritório especializado em Direito Canábico e Habeas Corpus preventivo para cultivo medicinal de Cannabis. Protegemos seu direito ao tratamento. Florianópolis/SC — atendimento nacional.",
  keywords: [
    "advogado cannabis", "direito canabico", "habeas corpus cannabis",
    "cultivo medicinal", "cannabis medicinal", "CBD juridico",
    "advogado habeas corpus", "ANVISA cannabis", "cultivo proprio",
    "Amado Jr advogado", "Florianopolis cannabis"
  ],
  authors: [{ name: "Eduardo Amado Jr.", url: BASE_URL }],
  creator: "Eduardo Amado Jr.",
  publisher: "Amado & Amado Jr. Advogados",
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: BASE_URL,
    siteName: "Amado & Amado Jr. Advogados",
    title: "Amado & Amado Jr. Advogados | Direito Canábico e Habeas Corpus",
    description: "Escritório especializado em Direito Canábico e Habeas Corpus preventivo para cultivo medicinal de Cannabis.",
    images: [{ url: "/assets/amado_animado.png", width: 1200, height: 630, alt: "Amado & Amado Jr. Advogados" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Amado & Amado Jr. Advogados | Direito Canábico",
    description: "Escritório especializado em Direito Canábico e Habeas Corpus preventivo para cultivo medicinal.",
    images: ["/assets/amado_animado.png"],
  },
  alternates: {
    canonical: BASE_URL,
  },
  verification: {
    google: "", // adicionar GSC token aqui
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${plusJakarta.variable} ${geistMono.variable} ${displayFont.variable} h-full antialiased scroll-smooth`}
    >
      <body className="min-h-full flex flex-col bg-[#041510] text-zinc-100">
        <LawFirmJsonLd />
        {children}
      </body>
    </html>
  );
}
