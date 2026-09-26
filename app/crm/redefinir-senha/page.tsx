import type { Metadata } from "next";
import { TelaRedefinirSenha } from "./TelaRedefinirSenha";

export const metadata: Metadata = {
  title: "Redefinir senha",
  robots: { index: false, follow: false },
};

export default function PaginaRedefinirSenha() {
  return <TelaRedefinirSenha />;
}
