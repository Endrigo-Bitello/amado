import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: {
    default: "CRM",
    template: "%s | CRM Amado & Amado Jr.",
  },
  description: "Área interna de gestão do escritório Amado & Amado Jr. Advogados.",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export const viewport: Viewport = {
  themeColor: "#263A2D",
};

export default function LayoutCrm({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
