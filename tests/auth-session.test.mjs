import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { createServerClient } from "@supabase/ssr";

const require = createRequire(import.meta.url);
const { NextRequest } = require("next/server");
const cookieName = "sb-session-test-auth-token";
const user = { id: "test-user", aud: "authenticated", app_metadata: {}, user_metadata: {} };

function session(expired = false) {
  const expires_at = Math.floor(Date.now() / 1000) + (expired ? -3600 : 3600);
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return {
    access_token: `${encode({ alg: "HS256" })}.${encode({ sub: user.id, exp: expires_at })}.signature`,
    refresh_token: expired ? "old-refresh-token" : "new-refresh-token",
    token_type: "bearer", expires_in: 3600, expires_at, user,
  };
}

function sessionCookies(value) {
  const encoded = "base64-" + Buffer.from(JSON.stringify(value)).toString("base64url");
  // Exercise chunk replacement/removal as well as ordinary cookies.
  const midpoint = Math.floor(encoded.length / 2);
  return [
    { name: `${cookieName}.0`, value: encoded.slice(0, midpoint) },
    { name: `${cookieName}.1`, value: encoded.slice(midpoint) },
    { name: "theme", value: "dark" },
  ];
}

function request(path, cookies = [], method = "GET") {
  return new NextRequest(`https://briefz.example${path}`, {
    method,
    headers: { cookie: cookies.map(({ name, value }) => `${name}=${value}`).join("; ") },
  });
}

function applyResponseCookies(previous, response) {
  const jar = new Map(previous.map(({ name, value }) => [name, value]));
  for (const cookie of response.cookies.getAll()) {
    if (cookie.maxAge === 0) jar.delete(cookie.name);
    else jar.set(cookie.name, cookie.value);
  }
  return [...jar].map(([name, value]) => ({ name, value }));
}

// Compile only the app modules to resolve Next's package and the app's alias.
// NextRequest/NextResponse and the Supabase SDK are real; only HTTP is simulated.
function loadModule(path, dependencies, env) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const exports = {};
  vm.runInNewContext(outputText, {
    exports,
    require: (name) => dependencies[name] ?? require(name),
    process: { env },
  }, { filename: path });
  return exports;
}

function harness({ invalidRefresh = false } = {}) {
  const calls = [];
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: "https://session-test.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
  };
  const fetch = async (input, init) => {
    const url = new URL(String(input));
    calls.push(url.pathname);
    if (url.pathname === "/auth/v1/token") {
      assert.equal(url.searchParams.get("grant_type"), "refresh_token");
      assert.equal(JSON.parse(init.body).refresh_token, "old-refresh-token");
      if (invalidRefresh) {
        return Response.json({ code: "refresh_token_not_found", message: "Invalid Refresh Token: Refresh Token Not Found" }, {
          status: 400,
          headers: { "X-Supabase-Api-Version": "2024-01-01" },
        });
      }
      return Response.json(session());
    }
    if (url.pathname === "/auth/v1/user") return Response.json(user);
    throw new Error(`Unexpected auth request: ${url.pathname}`);
  };
  const createClient = (url, key, options) => createServerClient(url, key, {
    ...options,
    global: { fetch },
  });
  const middleware = loadModule("../src/lib/supabase/middleware.ts", {
    "@supabase/ssr": { createServerClient: createClient },
  }, env);
  const { proxy } = loadModule("../src/proxy.ts", {
    "@/lib/supabase/middleware": middleware,
  }, env);
  return {
    proxy, calls,
    serverClient(cookies) {
      return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
        cookies: {
          getAll: () => cookies,
          setAll: () => assert.fail("Server render must not need to refresh again"),
        },
      });
    },
  };
}

test("expired session reaches server render and browser without a second refresh", async () => {
  const { proxy, calls, serverClient } = harness();
  const originalCookies = sessionCookies(session(true));
  const req = request("/projects/123/handover", originalCookies);
  const response = await proxy(req);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-middleware-next"), "1");
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  const serverRequest = new NextRequest(req.url, {
    headers: { cookie: response.headers.get("x-middleware-request-cookie") },
  });
  assert.equal(serverRequest.cookies.get("theme").value, "dark");
  const { data, error } = await serverClient(serverRequest.cookies.getAll()).auth.getUser();
  assert.equal(error, null);
  assert.equal(data.user.id, user.id);
  assert.equal(response.cookies.get(`${cookieName}.1`).maxAge, 0);
  const browserCookies = applyResponseCookies(originalCookies, response);
  const nextResponse = await proxy(request("/projects/123", browserCookies));
  assert.equal(nextResponse.status, 200);
  assert.equal(calls.filter((path) => path === "/auth/v1/token").length, 1);
});

test("login redirect delivers refreshed cookies and can open projects", async () => {
  const { proxy, calls } = harness();
  const originalCookies = sessionCookies(session(true));
  const response = await proxy(request("/login", originalCookies));
  assert.equal(response.status, 307);
  assert.equal(new URL(response.headers.get("location")).pathname, "/projects");
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.ok(response.cookies.get(cookieName)?.value);
  assert.equal(response.cookies.get(`${cookieName}.0`).maxAge, 0);
  const nextResponse = await proxy(request("/projects", applyResponseCookies(originalCookies, response)));
  assert.equal(nextResponse.status, 200);
  assert.equal(calls.filter((path) => path === "/auth/v1/token").length, 1);
});

test("invalid session cookies are cleared on redirect and not retried on login", async () => {
  const { proxy, calls } = harness({ invalidRefresh: true });
  const originalCookies = sessionCookies(session(true));
  const response = await proxy(request("/projects/123/handover?edit=456", originalCookies));
  const location = new URL(response.headers.get("location"));
  assert.equal(location.pathname, "/login");
  assert.equal(location.searchParams.get("next"), "/projects/123/handover?edit=456");
  assert.equal(response.cookies.get(`${cookieName}.0`).maxAge, 0);
  assert.equal(response.cookies.get(`${cookieName}.1`).maxAge, 0);
  const login = await proxy(request(location.pathname + location.search, applyResponseCookies(originalCookies, response)));
  assert.equal(login.status, 200);
  assert.equal(calls.filter((path) => path === "/auth/v1/token").length, 1);
});

test("signed-out form submission redirects with 303 instead of replaying the POST", async () => {
  const { proxy, calls } = harness();
  const response = await proxy(request("/projects/123", [], "POST"));
  assert.equal(response.status, 303);
  assert.equal(new URL(response.headers.get("location")).pathname, "/login");
  assert.equal(calls.length, 0);
});

test("valid sessions do not rotate tokens and anonymous users can open login", async () => {
  const { proxy, calls } = harness();
  const response = await proxy(request("/projects", sessionCookies(session())));
  assert.equal(response.status, 200);
  assert.equal(response.cookies.getAll().length, 0);
  assert.equal((await proxy(request("/login"))).status, 200);
  assert.equal(calls.filter((path) => path === "/auth/v1/token").length, 0);
});
