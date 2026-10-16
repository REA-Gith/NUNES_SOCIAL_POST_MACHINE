import crypto from "crypto";
import { NextResponse } from "next/server";
import { OAUTH } from "../../../../lib/oauth-config";
import { BROWSER_KEY_COOKIE, KEY_COOKIE_OPTIONS, createBrowserSecret, readConfig, secretFromJar } from "../../../../lib/oauth-store";
import { getSharedState } from "../../../../lib/shared-state";

function b64url(buf) {
  return Buffer.from(buf).toString("base64url");
}

function publicOrigin(request) {
  if (process.env.PUBLIC_APP_URL) return process.env.PUBLIC_APP_URL.replace(/\/$/, "");
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || "https";
  return host ? `${proto}://${host}` : new URL(request.url).origin;
}

export async function GET(request, { params }) {
  const { platform } = await params;
  const id = String(platform || "").toLowerCase();
  const config = OAUTH[id];

  if (!config) {
    return NextResponse.redirect(new URL(`/connect/${platform}?error=unsupported`, request.url));
  }

  const saved=(await getSharedState(`config:${id}`)) || readConfig(request.cookies,id);
  const clientId=saved?.clientId || process.env[config.clientId];
  if (!clientId) {
    return NextResponse.redirect(new URL(`/connect/${config.label}?error=app-not-configured`, request.url));
  }

  const origin = publicOrigin(request);
  const redirectUri = `${origin}/api/oauth/${id}/callback`;
  const state = b64url(crypto.randomBytes(24));
  const url = new URL(config.auth);

  url.searchParams.set(config.clientKey, clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  if (id === "facebook" && saved?.configId) {
    url.searchParams.set("config_id", saved.configId);
    url.searchParams.set("override_default_response_type", "true");
  } else {
    url.searchParams.set("scope", config.scope);
  }

  if (id === "instagram" && config.instagramDirect) {
    url.searchParams.set("enable_fb_login", "0");
    url.searchParams.set("force_authentication", "1");
  }
  url.searchParams.set("state", state);

  if (config.google) {
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("include_granted_scopes", "true");
  }

  if (config.pkce) {
    const verifier = b64url(crypto.randomBytes(48));
    const challenge = b64url(crypto.createHash("sha256").update(verifier).digest());
    url.searchParams.set("code_challenge", challenge);
    url.searchParams.set("code_challenge_method", "S256");

    const response = NextResponse.redirect(url);
    if (!secretFromJar(request.cookies)) {
      response.cookies.set(BROWSER_KEY_COOKIE, createBrowserSecret(), KEY_COOKIE_OPTIONS);
    }
    response.cookies.set(`nunes_pkce_${id}`, verifier, {
      httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 600
    });
    response.cookies.set(`nunes_state_${id}`, state, {
      httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 600
    });
    return response;
  }

  const response = NextResponse.redirect(url);
  if (!secretFromJar(request.cookies)) {
    response.cookies.set(BROWSER_KEY_COOKIE, createBrowserSecret(), KEY_COOKIE_OPTIONS);
  }
  response.cookies.set(`nunes_state_${id}`, state, {
    httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 600
  });
  return response;
}
