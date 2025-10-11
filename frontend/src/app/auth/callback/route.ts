import { NextRequest, NextResponse } from "next/server";

function getSafeRedirectPath(raw: string | null): string | null {
  if (!raw) return null;
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    decoded = raw;
  }
  if (!decoded.startsWith("/") || decoded.startsWith("//")) {
    return null;
  }
  return decoded;
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/login?e=missing_token", req.url));
  }

  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/magic/consume?token=${encodeURIComponent(token)}`, {
      method: "POST",
      credentials: "include",
    });

    if (!res.ok) throw new Error("consume_failed");

    const nextFromQuery = getSafeRedirectPath(req.nextUrl.searchParams.get("next"));
    const redirectCookie = req.cookies.get("post_login_redirect")?.value ?? null;
    const nextFromCookie = getSafeRedirectPath(redirectCookie);
    const destination = nextFromQuery ?? nextFromCookie ?? "/projects";

    const response = NextResponse.redirect(new URL(destination, req.url));
    response.cookies.set({
      name: "post_login_redirect",
      value: "",
      path: "/",
      maxAge: 0,
    });
    return response;
  } catch {
    return NextResponse.redirect(new URL("/login?e=invalid_or_expired", req.url));
  }
}
