import type { Metadata } from "next";
import { PortalEnvio } from "./PortalEnvio";

export const metadata: Metadata = {
  title: "Envio seguro de documentos",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: "no-referrer",
};

export default function PaginaEnvioDocumentos() {
  return <PortalEnvio />;
}
