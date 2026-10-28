import { NextResponse, type NextRequest } from "next/server";
import { updateSupabaseSession } from "@/lib/supabase/middleware";

function redirectWithSession(url: URL, req: NextRequest, sessionResponse: NextResponse) {
  // POSTs must become GETs at the login page, not replay the submitted action.
  const status = req.method === "GET" || req.method === "HEAD" ? 307 : 303;
  const response = NextResponse.redirect(url, status);
  sessionResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export async function proxy(req: NextRequest) {
  const { user, res } = await updateSupabaseSession(req);

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
    url.search = "";
    url.searchParams.set("next", path + req.nextUrl.search);
    return redirectWithSession(url, req, res);
  }

  if (user && isLogin) {
    const url = req.nextUrl.clone();
    url.pathname = "/projects";
    return redirectWithSession(url, req, res);
  }

  return res;
}

export const config = {
  matcher: ["/login", "/projects/:path*", "/archive/:path*", "/reports/:path*", "/admin/:path*"],
};
