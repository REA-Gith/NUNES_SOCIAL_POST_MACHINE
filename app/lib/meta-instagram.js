import { getSharedState, setSharedState } from "./shared-state";

const GRAPH = "https://graph.facebook.com/v24.0";

async function graphJson(path, accessToken, fields="") {
  const url = new URL(`${GRAPH}/${path}`);
  if (fields) url.searchParams.set("fields", fields);
  url.searchParams.set("access_token", accessToken);
  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json().catch(e => ({ parseError: String(e?.message || e) }));
  return { res, json };
}

async function validateInstagramCandidate(page, fbToken) {
  const pageToken = page?.access_token || fbToken?.access_token;
  if (!page?.id || !pageToken) return null;

  const pageLookup = await graphJson(
    encodeURIComponent(String(page.id)),
    pageToken,
    "id,name,access_token,instagram_business_account"
  );

  if (!pageLookup.res.ok) {
    console.warn("[INSTAGRAM CONNECT] Page lookup failed", pageLookup.json?.error?.message || `HTTP ${pageLookup.res.status}`);
    return null;
  }

  const pageData = pageLookup.json || {};
  const igId = String(pageData?.instagram_business_account?.id || "").trim();

  // IMPORTANT: only instagram_business_account proves the Facebook-Login
  // Instagram Graph relationship. Never promote a manually entered ID or
  // connected_instagram_account fallback to "connected".
  if (!igId) return null;

  const effectivePageToken = pageData.access_token || pageToken;
  const igLookup = await graphJson(
    encodeURIComponent(igId),
    effectivePageToken,
    "id,username,account_type,profile_picture_url"
  );

  if (!igLookup.res.ok || !igLookup.json?.id) {
    console.warn("[INSTAGRAM CONNECT] account validation failed", igLookup.json?.error?.message || `HTTP ${igLookup.res.status}`);
    return null;
  }

  return {
    page: {
      id: String(pageData.id || page.id),
      name: pageData.name || page.name || "",
      access_token: effectivePageToken,
      tasks: Array.isArray(pageData.tasks) ? pageData.tasks : (Array.isArray(page.tasks) ? page.tasks : [])
    },
    instagram: igLookup.json
  };
}

export async function ensureInstagramConnection(igConfig = {}, fbToken) {
  const userToken = fbToken?.access_token;
  const configuredPageId = String(igConfig?.secondaryId || "").trim();

  if (!userToken) return { connected: false, reason: "meta-token-missing" };

  try {
    const pagesLookup = await graphJson(
      "me/accounts",
      userToken,
      "id,name,access_token,tasks,instagram_business_account"
    );

    if (!pagesLookup.res.ok) {
      const detail = pagesLookup.json?.error?.message || `HTTP ${pagesLookup.res.status}`;
      console.warn("[INSTAGRAM CONNECT] page discovery failed", detail);
      return { connected: false, reason: "page-discovery-failed", detail };
    }

    const pages = Array.isArray(pagesLookup.json?.data) ? pagesLookup.json.data : [];
    if (!pages.length) {
      return {
        connected: false,
        reason: "facebook-page-not-found",
        detail: "Meta returned no accessible Facebook Pages for this login."
      };
    }

    const orderedPages = configuredPageId
      ? [...pages.filter(p => String(p.id) === configuredPageId), ...pages.filter(p => String(p.id) !== configuredPageId)]
      : pages;

    let resolved = null;
    for (const page of orderedPages) {
      resolved = await validateInstagramCandidate(page, fbToken);
      if (resolved) break;
    }

    if (!resolved) {
      return {
        connected: false,
        reason: "instagram-not-linked-to-page",
        detail: "No accessible Facebook Page returned a verified instagram_business_account. Link the Instagram Professional account to the Page and grant Instagram permissions."
      };
    }

    const page = resolved.page;
    const ig = resolved.instagram;
    const now = Date.now();

    const tokenPayload = {
      ...fbToken,
      platform: "Instagram",
      access_token: page.access_token,
      instagram_user_id: String(ig.id),
      username: ig.username || "",
      account_type: ig.account_type || "",
      linkedFrom: "facebook-page-instagram_business_account",
      facebook_page_id: String(page.id),
      facebook_page_name: page.name || "",
      verified: true,
      validatedAt: now,
      updatedAt: now
    };

    const configPayload = {
      ...igConfig,
      platform: "instagram",
      accountId: String(ig.id),
      secondaryId: String(page.id),
      name: ig.username || "",
      accountType: ig.account_type || "",
      profilePictureUrl: ig.profile_picture_url || "",
      facebookPageName: page.name || "",
      verified: true,
      connectionStatus: "connected",
      validatedAt: now,
      updatedAt: now,
      savedAt: now
    };

    await Promise.all([
      setSharedState("token:instagram", tokenPayload),
      setSharedState("config:instagram", configPayload)
    ]);

    return {
      connected: true,
      userId: String(ig.id),
      name: ig.username || "",
      accountType: ig.account_type || "",
      pageId: String(page.id),
      pageName: page.name || "",
      tokenSource: "facebook-page-token",
      verified: true
    };
  } catch (e) {
    const detail = String(e?.message || e);
    console.error("[INSTAGRAM CONNECT] recovery exception", detail);
    return { connected: false, reason: "instagram-validation-exception", detail };
  }
}

export async function repairInstagramFromStoredMeta() {
  const [igConfig, fbToken] = await Promise.all([
    getSharedState("config:instagram"),
    getSharedState("token:facebook")
  ]);
  return ensureInstagramConnection(igConfig || {}, fbToken || null);
}
