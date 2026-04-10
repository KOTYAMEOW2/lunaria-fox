import { cookies } from "next/headers";

import { env } from "@/lib/env";
import type { DiscordSession } from "@/lib/types";

const SESSION_COOKIE = "lunaria_session";
const STATE_COOKIE = "lunaria_oauth_state";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

function encodeUtf8(input: string) {
  return new TextEncoder().encode(input);
}

function bytesToBase64Url(bytes: Uint8Array) {
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlToString(value: string) {
  const padded = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");

  return Buffer.from(padded, "base64").toString("utf8");
}

async function getSigningKey() {
  return crypto.subtle.importKey(
    "raw",
    encodeUtf8(env.sessionSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function signPayload(payload: string) {
  const key = await getSigningKey();
  const signature = await crypto.subtle.sign("HMAC", key, encodeUtf8(payload));
  return bytesToBase64Url(new Uint8Array(signature));
}

export async function createSessionCookie(session: DiscordSession) {
  const payload = bytesToBase64Url(encodeUtf8(JSON.stringify(session)));
  const signature = await signPayload(payload);
  return `${payload}.${signature}`;
}

export async function readSessionCookie(rawValue: string | undefined) {
  if (!rawValue || !env.sessionSecret) return null;

  const [payload, signature] = rawValue.split(".");
  if (!payload || !signature) return null;

  const expected = await signPayload(payload);
  if (signature !== expected) return null;

  const parsed = JSON.parse(base64UrlToString(payload)) as DiscordSession;
  if (parsed.expiresAt <= Date.now()) return null;
  return parsed;
}

export async function getSession() {
  const cookieStore = await cookies();
  return readSessionCookie(cookieStore.get(SESSION_COOKIE)?.value);
}

export function getSessionCookieName() {
  return SESSION_COOKIE;
}

export function getStateCookieName() {
  return STATE_COOKIE;
}

export function getSessionMaxAge() {
  return Math.floor(SESSION_TTL_MS / 1000);
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: getSessionMaxAge(),
  };
}
