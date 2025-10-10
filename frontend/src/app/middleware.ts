// frontend/middleware.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Rotas públicas que NÃO exigem login
const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/magic",           // se usar magic link/OTP
  "/api/public",      // se tiver APIs públicas
  "/_next", "/favicon.ico", "/robots.txt", "/sitemap.xml", "/assets",
];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p));
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  // Regra de autenticação: existe um cookie de sessão válido?
  // Troque "zen_sess" pelo nome do seu cookie de sessão.
  const session = req.cookies.get("zen_sess")?.value;

  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    // opcional: preserve "next" para pós-login
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Aplica o middleware em tudo, exceto arquivos estáticos
  matcher: ["/((?!_next/static|_next/image|favicon.ico|assets|robots.txt|sitemap.xml).*)"],
};
