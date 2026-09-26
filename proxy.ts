import { NextResponse, type NextRequest } from "next/server";

// Proteção de rota do CRM (verificação otimista): sem cookie de sessão do
// Supabase, redireciona para o login antes de carregar a aplicação.
// A autorização efetiva acontece no servidor de dados (RLS + Edge Functions):
// nenhuma informação do CRM é entregue sem um token válido.

// O portal de envio de documentos é público (acesso pelo token do link); passa
// pelo proxy apenas para receber os cabeçalhos de privacidade.
const PUBLICAS = ["/crm/login", "/crm/redefinir-senha", "/enviar-documentos"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const publica = PUBLICAS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  const temSessao = request.cookies
    .getAll()
    .some((c) => /^sb-.+-auth-token(\.\d+)?$/.test(c.name) && c.value.length > 0);

  if (!publica && !temSessao) {
    const destino = new URL("/crm/login", request.url);
    destino.searchParams.set("proximo", `${pathname}${search}`);
    const resposta = NextResponse.redirect(destino);
    resposta.headers.set("X-Robots-Tag", "noindex, nofollow");
    return resposta;
  }

  const resposta = NextResponse.next();
  resposta.headers.set("X-Robots-Tag", "noindex, nofollow");
  resposta.headers.set("Cache-Control", "no-store");
  resposta.headers.set("Referrer-Policy", "same-origin");
  resposta.headers.set("X-Frame-Options", "DENY");
  return resposta;
}

export const config = {
  matcher: ["/crm", "/crm/:path*", "/enviar-documentos"],
};
