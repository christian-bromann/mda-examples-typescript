#!/usr/bin/env node
/**
 * Product API stand-in for the Account Concierge (trusted-backend ingress).
 *
 * In production this is *any* server that already owns authentication — your
 * Nest/Express/FastAPI app, BFF, API gateway, etc. That server:
 *   1. Authenticates the member however you already do (session cookie, OAuth,
 *      SSO, API key, …). MDA does not care about that mechanism.
 *   2. Proxies LangGraph / agent traffic to the Account Concierge deployment.
 *   3. Stamps reserved ingress headers on each upstream request:
 *        X-MDA-Ingress-Secret  ← shared secret (MDA_INGRESS_SECRET), server-only
 *        X-MDA-User-Id         ← the member id *your* auth layer resolved
 *
 * The browser / mobile client never sees the ingress secret. MDA trusts the
 * secret, then scopes threads / memory to X-MDA-User-Id.
 *
 * This file is a tiny stand-in for that pattern:
 *   GET /login?user=alice  → toy httpOnly session
 *   /threads, /runs, …     → proxy with the headers above
 */

import http from "node:http";
import { randomBytes } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

loadDotEnv(resolve(root, ".env"));

const PORT = Number(process.env.PROXY_PORT ?? 4910);
/**
 * Local `mda dev` by default; point at your hosted deployment URL in prod.
 *
 * Default is IPv6 loopback: langgraph-cli often logs `Server running at ::1:2024`
 * and does not listen on `127.0.0.1`, so Node → 127.0.0.1 gets ECONNREFUSED.
 */
const UPSTREAM = (process.env.LANGGRAPH_API_URL ?? "http://[::1]:2024").replace(
  /\/$/,
  ""
);
/** Must match the secret configured on the MDA deployment. Never expose to clients. */
const INGRESS_SECRET = process.env.MDA_INGRESS_SECRET?.trim() ?? "";
const SESSION_COOKIE = "mda_tb_session";

/**
 * In-memory sessions for the demo login. Replace with your real session store /
 * JWT verification / IdP — anything that yields a stable user id string.
 *
 * @type {Map<string, { userId: string, createdAt: number }>}
 */
const sessions = new Map();

/** LangGraph HTTP paths this proxy forwards to MDA. */
const PROXY_PREFIXES = [
  "/threads",
  "/runs",
  "/assistants",
  "/info",
  "/ok",
  "/identity",
  "/store",
];

function loadDotEnv(path) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function parseCookies(req) {
  const header = req.headers.cookie;
  if (!header) return {};
  /** @type {Record<string, string>} */
  const cookies = {};
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const sep = trimmed.indexOf("=");
    if (sep === -1) continue;
    cookies[trimmed.slice(0, sep)] = decodeURIComponent(trimmed.slice(sep + 1));
  }
  return cookies;
}

function resolveSession(req) {
  const id = parseCookies(req)[SESSION_COOKIE];
  if (!id) return null;
  return sessions.get(id) ?? null;
}

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body, null, 2));
}

function setSessionCookie(res, sessionId) {
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${encodeURIComponent(sessionId)}; HttpOnly; Path=/; SameSite=Lax`
  );
}

function clearSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`
  );
}

function shouldProxy(pathname) {
  return PROXY_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/**
 * Forward a LangGraph request to MDA after your auth layer has identified the user.
 *
 * This is the only MDA-specific step: attach the shared ingress secret and the
 * authenticated user id. Swap `resolveSession` for whatever your stack already uses.
 *
 * @param {import("node:http").IncomingMessage} req
 * @param {import("node:http").ServerResponse} res
 * @param {string} pathname
 */
function proxyToUpstream(req, res, pathname) {
  // Gate on *your* auth. MDA never sees the cookie / OAuth token — only the headers below.
  const session = resolveSession(req);
  if (!session) {
    sendJson(res, 401, {
      error: "not_authenticated",
      hint: "GET /login?user=alice first",
    });
    return;
  }
  if (!INGRESS_SECRET) {
    sendJson(res, 500, {
      error: "missing_MDA_INGRESS_SECRET",
      hint: "Set MDA_INGRESS_SECRET in .env (same value as mda dev / deploy).",
    });
    return;
  }

  const target = new URL(req.url ?? pathname, UPSTREAM);
  const headers = { ...req.headers, host: target.host };
  delete headers.connection;
  // Trusted-backend ingress — required on every agent call from your backend.
  headers["x-mda-ingress-secret"] = INGRESS_SECRET;
  headers["x-mda-user-id"] = session.userId;

  // Pass a URL object (not hostname options): Node's URL.hostname for IPv6 is
  // "[::1]", which fails DNS if used as `hostname` in the options form.
  const upstreamReq = http.request(
    target,
    { method: req.method, headers },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    }
  );
  upstreamReq.on("error", (err) => {
    sendJson(res, 502, {
      error: "upstream_unreachable",
      message: err.message,
      upstream: UPSTREAM,
    });
  });
  req.pipe(upstreamReq);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);
  const { pathname } = url;

  if (pathname === "/" || pathname === "/health") {
    sendJson(res, 200, {
      ok: true,
      upstream: UPSTREAM,
      ingressSecretConfigured: Boolean(INGRESS_SECRET),
      session: resolveSession(req)?.userId ?? null,
    });
    return;
  }

  // --- Demo auth surface (replace with your real login / session APIs) ---

  if (pathname === "/login" && req.method === "GET") {
    // Toy login: trust ?user= and mint a session. Production would verify
    // password, OAuth code, SSO assertion, etc., then store that user id.
    const user = (url.searchParams.get("user") ?? "").trim();
    if (!user) {
      sendJson(res, 400, { error: "missing_user", hint: "GET /login?user=alice" });
      return;
    }
    const sessionId = randomBytes(16).toString("hex");
    sessions.set(sessionId, { userId: user, createdAt: Date.now() });
    setSessionCookie(res, sessionId);
    sendJson(res, 200, { ok: true, user });
    return;
  }

  if (pathname === "/logout" && (req.method === "GET" || req.method === "POST")) {
    const id = parseCookies(req)[SESSION_COOKIE];
    if (id) sessions.delete(id);
    clearSessionCookie(res);
    sendJson(res, 200, { ok: true });
    return;
  }

  if (pathname === "/me") {
    const session = resolveSession(req);
    if (!session) {
      sendJson(res, 401, { error: "not_authenticated" });
      return;
    }
    sendJson(res, 200, { user: session.userId });
    return;
  }

  // --- Agent traffic: authenticate locally, then proxy with MDA headers ---

  if (shouldProxy(pathname)) {
    proxyToUpstream(req, res, pathname);
    return;
  }

  sendJson(res, 404, {
    error: "not_found",
    routes: ["/", "/login?user=", "/logout", "/me", ...PROXY_PREFIXES],
  });
});

server.listen(PORT, () => {
  console.log(`account-concierge proxy on http://127.0.0.1:${PORT}`);
  console.log(`  upstream: ${UPSTREAM}`);
  console.log(`  login:    curl -c cookies.txt 'http://127.0.0.1:${PORT}/login?user=alice'`);
  if (!INGRESS_SECRET) {
    console.warn("  warning: MDA_INGRESS_SECRET is not set");
  }
});
