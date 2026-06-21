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
 *
 * APNs endpoint: https://api.push.apple.com/3/device/<token>
 * Auth: JWT signed with ES256 using the .p8 key.
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
    return new Response(JSON.stringify({ error: "POST only" }), {
      status: 405,
      headers: { ...CORS_HEADERS, "content-type": "application/json" },
    });
  }

  // Only accept from allowed origins (and authenticated Supabase calls)
  const authHeader = req.headers.get("authorization");
  const isServiceRole = authHeader?.startsWith("Bearer eyJ"); // JWT token

  if (!isAllowed && !isServiceRole) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: CORS_HEADERS,
    });
  }

  // ── Get secrets ────────────────────────────────────────────────────
  const keyId = Deno.env.get("APNS_KEY_ID");
  const teamId = Deno.env.get("APNS_TEAM_ID");
  const privateKey = Deno.env.get("APNS_PRIVATE_KEY");
  const topic = Deno.env.get("APNS_TOPIC");

  if (!keyId || !teamId || !privateKey || !topic) {
    return new Response(
      JSON.stringify({ error: "Missing APNs configuration — check edge function secrets" }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }

  // ── Parse request ──────────────────────────────────────────────────
  let body: {
    user_id?: string;
    token?: string;       // direct token (bypasses DB lookup)
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
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  if (!body.token && !body.user_id) {
    return new Response(JSON.stringify({ error: "Provide token or user_id" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  // ── Resolve tokens ─────────────────────────────────────────────────
  let tokens: string[] = [];

  if (body.token) {
    tokens = [body.token];
  } else {
    // Look up user's device tokens in Supabase
    const client = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data, error } = await client
      .from("device_tokens")
      .select("token")
      .eq("user_id", body.user_id)
      .eq("platform", "ios");

    if (error) {
      return new Response(
        JSON.stringify({ error: "DB lookup failed", detail: error.message }),
        { status: 500, headers: { "content-type": "application/json" } },
      );
    }
    tokens = (data || []).map((r: { token: string }) => r.token);
  }

  if (tokens.length === 0) {
    return new Response(JSON.stringify({ sent: 0, reason: "No device tokens found" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
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
  const badTokens = failed.filter((r) => r.status === 410); // "Unregistered" — token stale

  // Clean up stale tokens
  if (badTokens.length > 0 && body.user_id) {
    const client = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const staleTokens = tokens.filter((_, i) => results[i].status === 410);
    await client.from("device_tokens").delete().in("token", staleTokens);
  }

  return new Response(
    JSON.stringify({
      sent: succeeded,
      failed: failed.length,
      ...(failed.length > 0 && { errors: failed.map((f) => f.reason) }),
    }),
    {
      status: succeeded > 0 ? 200 : 500,
      headers: {
        ...CORS_HEADERS,
        "Access-Control-Allow-Origin": isAllowed ? origin : ALLOWED_ORIGINS[0],
        "content-type": "application/json",
      },
    },
  );
});
