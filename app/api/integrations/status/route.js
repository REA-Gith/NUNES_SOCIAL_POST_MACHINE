import { cookies } from "next/headers";
import { OAUTH, envReady, ENABLED_SOCIAL_PROVIDER_IDS } from "../../../lib/oauth-config";
import { cookieName, unseal, readConfig, secretFromJar } from "../../../lib/oauth-store";
import { getSharedState, setSharedState, sharedStateReady } from "../../../lib/shared-state";

function tokenUsable(token) {
  if (!token?.access_token) return false;
  if (!token.expires_at) return true;
  return Number(token.expires_at) > Date.now() + 60_000;
}

async function validateFacebookPublishing(token, saved) {
  if (!tokenUsable(token)) {
    return {
      connected: false,
      health: token?.access_token ? "token-expired" : "not-connected",
      missingPermissions: [],
      pageAccessible: false,
      canCreate: false
    };
  }

  const required = ["pages_show_list", "pages_read_engagement", "pages_manage_posts"];
  let granted = [];
  let pageAccessible = false;
  let canCreate = false;
  let pageName = saved?.name || "";
  let pageId = saved?.accountId || "";
  let tasks = [];
  let tokenValid = false;

  try {
    const pr = await fetch(
      "https://graph.facebook.com/v24.0/me/permissions?access_token=" + encodeURIComponent(token.access_token),
      { cache: "no-store" }
    );
    const pj = await pr.json().catch(() => ({}));
    if (pr.ok && Array.isArray(pj.data)) {
      tokenValid = true;
      granted = pj.data.filter(x => x.status === "granted").map(x => x.permission);
    }
  } catch (e) {
    console.warn("[FACEBOOK HEALTH] permissions check failed", String(e?.message || e));
  }

  try {
    const ar = await fetch(
      "https://graph.facebook.com/v24.0/me/accounts?fields=id,name,access_token,tasks,instagram_business_account&access_token=" +
        encodeURIComponent(token.access_token),
      { cache: "no-store" }
    );
    const aj = await ar.json().catch(() => ({}));
    const pages = Array.isArray(aj.data) ? aj.data : [];
    const page =
      (saved?.accountId ? pages.find(x => String(x.id) === String(saved.accountId)) : null) ||
      pages[0] ||
      null;

    if (page) {
      pageAccessible = true;
      pageId = String(page.id);
      pageName = page.name || pageName;
      tasks = Array.isArray(page.tasks) ? page.tasks : [];
      canCreate = !tasks.length || tasks.includes("CREATE_CONTENT") || tasks.includes("MANAGE");
    }
  } catch (e) {
    console.warn("[FACEBOOK HEALTH] page access check failed", String(e?.message || e));
  }

  const missingPermissions = required.filter(x => !granted.includes(x));
  const connected = tokenValid && pageAccessible && canCreate && missingPermissions.length === 0;

  return {
    connected,
    health: connected
      ? "connected"
      : !tokenValid
        ? "token-invalid"
        : !pageAccessible
          ? "page-access-required"
          : missingPermissions.length
            ? "limited-permissions"
            : "insufficient-page-role",
    missingPermissions,
    grantedPermissions: granted,
    pageAccessible,
    canCreate,
    pageId,
    pageName,
    tasks,
    tokenExpiresAt: token.expires_at || null,
    metaUserId: token.meta_user_id || null
  };
}

export async function GET() {
  const jar = await cookies();
  const integrations = {};

  for (const [id, cfg] of Object.entries(OAUTH)) {
    if (!ENABLED_SOCIAL_PROVIDER_IDS.includes(id)) continue;

    const browserToken = unseal(jar.get(cookieName(cfg.label))?.value, secretFromJar(jar));
    const browserConfig = readConfig(jar, id);

    let token = await getSharedState(`token:${id}`);
    let saved = await getSharedState(`config:${id}`);

    if (!token && browserToken?.access_token) {
      token = browserToken;
      await setSharedState(`token:${id}`, browserToken);
    }
    if (!saved && browserConfig?.clientId && browserConfig?.clientSecret) {
      saved = browserConfig;
      await setSharedState(`config:${id}`, browserConfig);
    }

    const configured = envReady(id) || Boolean(saved?.clientId && saved?.clientSecret);

    if (id === "facebook") {
      const health = await validateFacebookPublishing(token, saved);
      integrations[cfg.label] = {
        signedIn: tokenUsable(token),
        sharedSaved: Boolean(token?.access_token),
        publishingReady: health.connected,
        connected: health.connected,
        configured,
        mode: health.connected
          ? "connected"
          : token?.access_token
            ? "signed-in-action-required"
            : configured
              ? "ready-to-login"
              : "app-setup-required",
        publishingHealth: health.health,
        health,
        tokenExpiresAt: token?.expires_at || null,
        metaUserId: token?.meta_user_id || null,
        actionRequired: health.connected
          ? ""
          : health.health === "token-expired" || health.health === "token-invalid"
            ? "Reconnect Meta because the stored Facebook token is expired or invalid."
            : health.health === "limited-permissions"
              ? "Reconnect Meta and grant the required Page and Instagram permissions."
              : health.health === "page-access-required"
                ? "Reconnect Meta and select/authorize the Nunes Instrumentation Page."
                : health.health === "insufficient-page-role"
                  ? "Your Facebook user needs Page content/admin access."
                  : ""
      };
      continue;
    }

    if (id === "instagram") {
      const fbToken = await getSharedState("token:facebook");
      let instagramRepair = null;

      if (tokenUsable(fbToken)) {
        instagramRepair = await ensureInstagramConnection(saved || {}, fbToken);
        token = await getSharedState("token:instagram");
        saved = await getSharedState("config:instagram");
      }

      const verifiedNow = Boolean(instagramRepair?.connected);
      const connected = verifiedNow && tokenUsable(token) && Boolean(saved?.accountId) && saved?.verified === true;

      integrations[cfg.label] = {
        connected,
        configured,
        mode: connected ? "connected" : configured ? "configured-action-required" : "app-setup-required",
        accountId: connected ? saved?.accountId || "" : "",
        name: connected ? saved?.name || token?.username || "" : "",
        accountType: connected ? saved?.accountType || token?.account_type || "" : "",
        facebookPageId: connected ? saved?.secondaryId || token?.facebook_page_id || "" : "",
        facebookPageName: connected ? saved?.facebookPageName || token?.facebook_page_name || "" : "",
        tokenExpiresAt: token?.expires_at || fbToken?.expires_at || null,
        verified: connected,
        repair: instagramRepair,
        actionRequired: connected
          ? ""
          : instagramRepair?.reason === "instagram-not-linked-to-page"
            ? "Link the Instagram Professional account to the Facebook Page and reconnect Meta."
            : instagramRepair?.reason === "page-discovery-failed"
              ? "Meta could not list Pages for this login. Reconnect and grant pages_show_list."
              : instagramRepair?.reason === "facebook-page-not-found"
                ? "The Meta login has no accessible Facebook Page."
                : instagramRepair?.reason === "meta-token-missing"
                  ? "Connect Meta first."
                  : "Reconnect Meta and grant Instagram publishing permissions."
      };
      continue;
    }

    integrations[cfg.label] = {
      connected: tokenUsable(token),
      configured,
      mode: tokenUsable(token) ? "connected" : configured ? "ready-to-login" : "app-setup-required"
    };
  }

  const [waToken, waConfig, waNumbersRaw] = await Promise.all([
    getSharedState("token:whatsapp"),
    getSharedState("config:whatsapp"),
    getSharedState("whatsapp:numbers")
  ]);

  const waNumbers = Array.isArray(waNumbersRaw) ? waNumbersRaw : [];
  const legacyConnected = tokenUsable(waToken) && Boolean(waConfig?.accountId && waConfig?.secondaryId);
  const numbersConnected =
    waNumbers.filter(n => n?.enabled !== false && n?.phoneNumberId && (n?.accessToken || tokenUsable(waToken))).length ||
    (legacyConnected ? 1 : 0);

  integrations.WhatsApp = {
    connected: numbersConnected > 0,
    configured: Boolean(waConfig?.clientId && waConfig?.clientSecret),
    mode: numbersConnected > 0 ? "connected" : waConfig?.clientId && waConfig?.clientSecret ? "ready-to-login" : "not-connected",
    phoneNumberId: waConfig?.accountId || "",
    wabaId: waConfig?.secondaryId || "",
    phone: waConfig?.phone || "",
    numbersConnected,
    numberCount: numbersConnected,
    numbersConfigured: waNumbers.length || (waConfig?.accountId ? 1 : 0),
    tokenExpiresAt: waToken?.expires_at || null
  };

  return Response.json({
    ok: true,
    n8nRequired: false,
    secureStorageReady: sharedStateReady(),
    secureStorageMode: sharedStateReady() ? "shared-server-encrypted" : "browser-only-fallback",
    integrations
  });
}
