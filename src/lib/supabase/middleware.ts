// src/lib/supabase/middleware.ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSupabaseSession(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  let res = NextResponse.next({ request: req });

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // Server Components must see the refreshed session too. Otherwise they
        // can try to rotate the old refresh token again during the same request.
        cookiesToSet.forEach(({ name, value }) => {
          req.cookies.set(name, value);
        });
        const previousCookies = res.cookies.getAll();
        res = NextResponse.next({ request: req });
        previousCookies.forEach((cookie) => res.cookies.set(cookie));
        cookiesToSet.forEach(({ name, value, options }) => {
          res.cookies.set(name, value, options);
        });
      },
    },
  });

  // Finish refreshing before returning the response: setAll may replace it.
  const { data: { user } } = await supabase.auth.getUser();
  res.headers.set("Cache-Control", "private, no-store");

  return { user, res };
}
