import { NextResponse } from "next/server";
import {
  customerGoogleConfig,
  customerReturnToCookie,
  createCustomerStateCookie,
  newCustomerState
} from "@/lib/customer-auth";

function sanitizeReturnTo(input: string | null) {
  if (!input || !input.startsWith("/")) return "/checkout";
  if (input.startsWith("//")) return "/checkout";
  return input;
}

export async function GET(request: Request) {
  const { clientId, redirectUri } = customerGoogleConfig();
  const url = new URL(request.url);
  const returnTo = sanitizeReturnTo(url.searchParams.get("returnTo"));
  const state = newCustomerState();
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid email profile");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("access_type", "offline");
  // Fuerza el selector de cuenta para que una PC con varias sesiones de Google
  // no reutilice silenciosamente la última cuenta usada.
  authUrl.searchParams.set("prompt", "select_account consent");
  const response = NextResponse.redirect(authUrl);
  response.headers.append("Set-Cookie", createCustomerStateCookie(state));
  response.headers.append("Set-Cookie", customerReturnToCookie(returnTo));
  return response;
}
