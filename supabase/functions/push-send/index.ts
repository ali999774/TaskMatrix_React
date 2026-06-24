/// <reference lib="deno.ns" />

/**
 * push-send — Send push notifications to iOS devices via APNs.
 *
 * Deployed at: https://xulnxwwwjpvgsaqnsllo.supabase.co/functions/v1/push-send
 * Requires these Supabase secrets:
 *   - APNS_KEY_ID      — Apple Developer key ID (10-char, e.g. ABC1234DEF)
 *   - APNS_TEAM_ID     — Apple Developer Team ID (10-char, e.g. D8WS4AUW8R)
 *   - APNS_PRIVATE_KEY  — Contents of the .p8 private key file (PEM string)
 *   - APNS_TOPIC        — Bundle ID (com.milestonepediatrics.taskmatrix)
 * Plus the auto-injected Supabase env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * SUPABASE_ANON_KEY (used for caller authentication / token verification).
 *
 * APNs endpoint: https://api.push.apple.com/3/device/<token>
 * Auth: JWT signed with ES256 using the .p8 key.
 *
 * AUTHORIZATION MODEL (see SECURITY-AUDIT #1/#2):
 *   The caller must present a verifiable bearer token. Two identities:
 *     1. Service role  — the project service_role key. Trusted backend path
 *        (e.g. the reminder scheduler). May target any user_id, or a raw device
 *        token for testing.
 *     2. User token    — a signed Supabase user JWT, verified via getUser().
 *        Self-push only: user_id is forced to the verified user; any
 *        caller-supplied user_id / token in the body is ignored.
 *   The public anon key is NEITHER, so it can no longer authorize a send.
 *   A prior version accepted any "Bearer eyJ…" prefix, which the public anon
 *   key satisfies — that allowed push spoofing to arbitrary users.
 */

import { createClient } from "npm:@supabase/supabase-js@2";

// ── CORS ──────────────────────────────────────────────────────────────────
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://ali999774.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
} as const;

const ALLOWED_ORIGINS = [
  "https://ali999774.github.io",
  "http://localhost:5173",
  "capacitor://localhost",
  "taskmatrix://localhost",
];

/** Constant-time string compare (length is not secret here). */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

// ── JWT Signing (ES256) ──────────────────────────────────────────────────
async function signJWT(
  keyId: string,
  teamId: string,
  privateKeyPEM: string,
): Promise<string> {
  // Strip PEM headers/footers, keep raw base64 body
  const pemBody = privateKeyPEM
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");

  const keyBytes = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );

  // Build JWT header + payload
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "ES256", kid: keyId };
  const payload = { iss: teamId, iat: now };

  const encoder = new TextEncoder();
  const b64Header = btoaURL(encoder.encode(JSON.stringify(header)));
  const b64Payload = btoaURL(encoder.encode(JSON.stringify(payload)));
  const signingInput = `${b64Header}.${b64Payload}`;

  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    encoder.encode(signingInput),
  );
  const b64Sig = btoaURL(new Uint8Array(sig));

  return `${signingInput}.${b64Sig}`;
}

function btoaURL(buf: Uint8Array): string {
  return btoa(String.fromCharCode(...buf))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// ── Send to a single device ──────────────────────────────────────────────
async function sendToDevice(
  token: string,
  payload: Record<string, unknown>,
  jwt: string,
  topic: string,
): Promise<{ ok: boolean; status: number; reason?: string }> {
  const url = `https://api.push.apple.com/3/device/${token}`;

  // APNs JSON payload shape
  const apnsPayload = {
    aps: {
      alert: {
        title: payload.title || "TaskMatrix",
        subtitle: payload.subtitle || undefined,
        body: payload.body || "",
      },
      badge: payload.badge ?? undefined,
      sound: "default",
      "mutable-content": 1,
    },
    // Custom data — forwarded to the app on tap
    task_id: payload.task_id || undefined,
    type: payload.type || "reminder",
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `bearer ${jwt}`,
      "apns-topic": topic,
      "apns-push-type": "alert",
      "apns-priority": "10", // immediate
      "content-type": "application/json",
    },
    body: JSON.stringify(apnsPayload),
  });

  if (resp.ok) return { ok: true, status: resp.status };

  const reason = await resp.text();
  return { ok: false, status: resp.status, reason };
}

// ── Main handler ─────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "";
  const isAllowed = ALLOWED_ORIGINS.some((o) => o === origin || origin.startsWith(o + "/"));

  // CORS-aware JSON responder. Note: Origin is for browser CORS only — it is
  // NOT an authorization signal (it's trivially spoofable off-browser).
  const respond = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), {
      status,
      headers: {
        ...CORS_HEADERS,
        "Access-Control-Allow-Origin": isAllowed ? origin : ALLOWED_ORIGINS[0],
        "content-type": "application/json",
      },
    });

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...CORS_HEADERS,
        "Access-Control-Allow-Origin": isAllowed ? origin : ALLOWED_ORIGINS[0],
      },
    });
  }

  if (req.method !== "POST") {
    return respond({ error: "POST only" }, 405);
  }

  // ── Secrets / config ───────────────────────────────────────────────
  const keyId = Deno.env.get("APNS_KEY_ID");
  const teamId = Deno.env.get("APNS_TEAM_ID");
  const privateKey = Deno.env.get("APNS_PRIVATE_KEY");
  const topic = Deno.env.get("APNS_TOPIC");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!keyId || !teamId || !privateKey || !topic) {
    return respond({ error: "Missing APNs configuration — check edge function secrets" }, 500);
  }
  if (!supabaseUrl || !serviceRoleKey) {
    return respond({ error: "Missing Supabase configuration" }, 500);
  }

  // ── Authenticate the caller (real verification, not a prefix check) ──
  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!bearer) return respond({ error: "Unauthorized" }, 401);

  const isService = timingSafeEqual(bearer, serviceRoleKey);
  let authedUserId: string | null = null;

  if (!isService) {
    // Verify as a Supabase user access token. The anon key and random JWTs
    // resolve to no user → rejected.
    const authClient = createClient(supabaseUrl, anonKey ?? serviceRoleKey, {
      global: { headers: { Authorization: `Bearer ${bearer}` } },
    });
    const { data: { user }, error } = await authClient.auth.getUser(bearer);
    if (error || !user) return respond({ error: "Unauthorized" }, 401);
    authedUserId = user.id;
  }

  // ── Parse request ──────────────────────────────────────────────────
  let body: {
    user_id?: string;
    token?: string;       // direct token (service-role path only)
    title?: string;
    subtitle?: string;
    body?: string;
    task_id?: string;
    badge?: number;
    type?: string;
  };
  try {
    body = await req.json();
  } catch {
    return respond({ error: "Invalid JSON" }, 400);
  }

  // ── Resolve target tokens (ownership-scoped) ───────────────────────
  const admin = createClient(supabaseUrl, serviceRoleKey);
  let tokens: string[] = [];
  let targetUserId: string | null = null;

  if (isService) {
    // Trusted backend: honor body.token (direct) or body.user_id (lookup).
    if (body.token) {
      tokens = [body.token];
    } else if (body.user_id) {
      targetUserId = body.user_id;
    } else {
      return respond({ error: "Provide token or user_id" }, 400);
    }
  } else {
    // User path: ignore body.token / body.user_id — only the caller's own
    // registered devices can be targeted.
    targetUserId = authedUserId;
  }

  if (targetUserId) {
    const { data, error } = await admin
      .from("device_tokens")
      .select("token")
      .eq("user_id", targetUserId)
      .eq("platform", "ios");

    if (error) {
      console.error("[push-send] device_tokens lookup failed:", error.message);
      return respond({ error: "Lookup failed" }, 500);
    }
    tokens = (data || []).map((r: { token: string }) => r.token);
  }

  if (tokens.length === 0) {
    return respond({ sent: 0, reason: "No device tokens found" }, 200);
  }

  // ── Sign JWT once, send to all tokens ───────────────────────────────
  const jwt = await signJWT(keyId, teamId, privateKey);
  const results = await Promise.all(
    tokens.map((t) =>
      sendToDevice(t, {
        title: body.title,
        subtitle: body.subtitle,
        body: body.body,
        task_id: body.task_id,
        badge: body.badge,
        type: body.type,
      }, jwt, topic)
    ),
  );

  const succeeded = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);

  // Clean up stale tokens (410 "Unregistered"). We know the owning user here.
  if (failed.some((r) => r.status === 410) && targetUserId) {
    const staleTokens = tokens.filter((_, i) => results[i].status === 410);
    await admin.from("device_tokens").delete().in("token", staleTokens);
  }

  // Log APNs detail server-side only — do NOT leak raw reasons to the caller.
  if (failed.length > 0) {
    console.error("[push-send] APNs failures:", failed.map((f) => `${f.status}:${f.reason}`));
  }

  return respond({ sent: succeeded, failed: failed.length }, succeeded > 0 ? 200 : 502);
});
