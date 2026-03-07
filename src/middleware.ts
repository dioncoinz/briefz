// src/middleware.ts
import { NextRequest } from "next/server";
import { createSupabaseMiddlewareClient } from "@/lib/supabase/middleware";

export async function middleware(req: NextRequest) {
  const { supabase, res } = createSupabaseMiddlewareClient(req);

  // Refresh session (important for SSR)
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  const path = req.nextUrl.pathname;

  const isLogin = path.startsWith("/login");
  const isProtected =
    path.startsWith("/projects") ||
    path.startsWith("/archive") ||
    path.startsWith("/reports") ||
    path.startsWith("/admin");

  if (!user && isProtected) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return Response.redirect(url);
  }

  if (user && isLogin) {
    const url = req.nextUrl.clone();
    url.pathname = "/projects";
    return Response.redirect(url);
  }

  return res;
}

export const config = {
  matcher: ["/login", "/projects/:path*", "/archive/:path*", "/reports/:path*", "/admin/:path*"],
};
