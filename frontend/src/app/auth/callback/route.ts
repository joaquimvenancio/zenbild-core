import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/login?e=missing_token", req.url));
  }

  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    const res = await fetch(`${baseUrl}/auth/magic/consume?token=${encodeURIComponent(token)}`, {
      method: "POST",
      credentials: "include",
    });

    if (!res.ok) throw new Error("consume_failed");

    // Cookie HttpOnly é setado pelo backend no domínio do backend.
    // Se frontend e backend estiverem em subdomínios diferentes, tudo bem.
    return NextResponse.redirect(new URL("/projects", req.url));
  } catch {
    return NextResponse.redirect(new URL("/login?e=invalid_or_expired", req.url));
  }
}
