import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import {
  clearCustomerReturnToCookie,
  clearCustomerStateCookie,
  customerGoogleConfig,
  customerSessionCookie,
  readCustomerReturnTo,
  readCustomerState
} from "@/lib/customer-auth";
import { CustomerModel } from "@/models/Customer";

function sanitizeReturnTo(input: string | null) {
  if (!input || !input.startsWith("/")) return "/checkout";
  if (input.startsWith("//")) return "/checkout";
  return input;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  if (error) {
    const response = NextResponse.redirect(new URL("/checkout?auth=error", url.origin));
    response.headers.append("Set-Cookie", clearCustomerStateCookie());
    response.headers.append("Set-Cookie", clearCustomerReturnToCookie());
    return response;
  }

  const state = url.searchParams.get("state");
  const expectedState = readCustomerState(request);
  if (!state || !expectedState || state !== expectedState) {
    return NextResponse.json({ error: "Estado OAuth inválido" }, { status: 400 });
  }

  const code = url.searchParams.get("code");
  if (!code) return NextResponse.json({ error: "Falta el código OAuth" }, { status: 400 });

  const { clientId, clientSecret, redirectUri } = customerGoogleConfig();
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code"
    })
  });

  if (!tokenResponse.ok) {
    return NextResponse.json({ error: "No se pudo completar el login con Google" }, { status: 502 });
  }

  const tokenData = await tokenResponse.json() as { access_token?: string };
  if (!tokenData.access_token) {
    return NextResponse.json({ error: "Google no devolvió credenciales válidas" }, { status: 502 });
  }

  const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` }
  });
  if (!profileResponse.ok) {
    return NextResponse.json({ error: "No se pudo leer el perfil de Google" }, { status: 502 });
  }

  const profile = await profileResponse.json() as { sub?: string; email?: string; name?: string; picture?: string; email_verified?: boolean };
  if (!profile.sub || !profile.email || !profile.name || profile.email_verified !== true) {
    return NextResponse.json({ error: "Google no devolvió datos de usuario suficientes" }, { status: 502 });
  }

  await connectDb();
  const customer = await CustomerModel.findOneAndUpdate(
    { googleId: profile.sub },
    { googleId: profile.sub, email: profile.email, name: profile.name, picture: profile.picture ?? "" },
    { upsert: true, new: true }
  );
  const customerId = customer ? String(customer._id) : null;
  if (!customerId) {
    return NextResponse.json({ error: "No se pudo crear la sesión de cliente" }, { status: 500 });
  }

  const returnTo = sanitizeReturnTo(readCustomerReturnTo(request));
  const response = NextResponse.redirect(new URL(returnTo, url.origin));
  response.headers.append("Set-Cookie", customerSessionCookie(customerId));
  response.headers.append("Set-Cookie", clearCustomerStateCookie());
  response.headers.append("Set-Cookie", clearCustomerReturnToCookie());
  return response;
}
