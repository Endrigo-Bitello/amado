import type { Metadata } from "next";
import { TelaLogin } from "./TelaLogin";

export const metadata: Metadata = {
  title: "Entrar",
  robots: { index: false, follow: false },
};

export default function PaginaLogin() {
  return <TelaLogin />;
}
