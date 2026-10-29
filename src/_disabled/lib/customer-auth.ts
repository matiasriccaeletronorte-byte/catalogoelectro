import { createHmac, randomBytes, timingSafeEqual } from "crypto";

const cookieName = "electronorte_customer";
const stateCookieName = "electronorte_customer_state";
const returnToCookieName = "electronorte_customer_return_to";

function customerSecret() {
  return process.env.CUSTOMER_SESSION_SECRET ?? process.env.ADMIN_SESSION_SECRET ?? null;
}

function stateSecret() {
  return process.env.CUSTOMER_STATE_SECRET ?? customerSecret();
}

function sign(value: string, secret: string | null) {
  if (!secret) return null;
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function createCustomerSessionValue(customerId: string) {
  const secret = customerSecret();
  const signature = sign(customerId, secret);
  if (!secret || !signature) throw new Error("Falta CUSTOMER_SESSION_SECRET en .env.local");
  return `${customerId}.${signature}`;
}

export function verifyCustomerSessionValue(value: string) {
  const secret = customerSecret();
  if (!secret) return null;
  const [customerId, signature] = value.split(".");
  if (!customerId || !signature) return null;
  const expected = sign(customerId, secret);
  if (!expected || expected.length !== signature.length) return null;
  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return null;
  return customerId;
}

export function customerSessionCookie(customerId: string) {
  return `${cookieName}=${createCustomerSessionValue(customerId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}

export function clearCustomerSessionCookie() {
  return `${cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function createCustomerStateCookie(state: string) {
  const secret = stateSecret();
  const signature = sign(state, secret);
  if (!secret || !signature) throw new Error("Falta CUSTOMER_STATE_SECRET en .env.local");
  return `${stateCookieName}=${state}.${signature}; Path=/; HttpOnly; SameSite=Lax; Max-Age=900${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}

export function clearCustomerStateCookie() {
  return `${stateCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function customerReturnToCookie(value: string) {
  return `${returnToCookieName}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=900${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}

export function clearCustomerReturnToCookie() {
  return `${returnToCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function readCustomerSession(request: Request) {
  const value = request.headers.get("cookie")?.match(new RegExp(`(?:^|; )${cookieName}=([^;]*)`))?.[1];
  if (!value) return null;
  return verifyCustomerSessionValue(value);
}

export function readCustomerState(request: Request) {
  const value = request.headers.get("cookie")?.match(new RegExp(`(?:^|; )${stateCookieName}=([^;]*)`))?.[1];
  if (!value) return null;
  const secret = stateSecret();
  if (!secret) return null;
  const [state, signature] = value.split(".");
  if (!state || !signature) return null;
  const expected = sign(state, secret);
  if (!expected || expected.length !== signature.length) return null;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature)) ? state : null;
}

export function readCustomerReturnTo(request: Request) {
  const value = request.headers.get("cookie")?.match(new RegExp(`(?:^|; )${returnToCookieName}=([^;]*)`))?.[1];
  return value ? decodeURIComponent(value) : null;
}

export function newCustomerState() {
  return randomBytes(16).toString("hex");
}

export function customerGoogleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Faltan GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET o GOOGLE_REDIRECT_URI en .env.local");
  }
  return { clientId, clientSecret, redirectUri };
}

export function customerLogoutCookies() {
  return [clearCustomerSessionCookie(), clearCustomerStateCookie(), clearCustomerReturnToCookie()];
}

export function customerCookieName() {
  return cookieName;
}
