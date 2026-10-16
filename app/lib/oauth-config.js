import { ENABLED_SOCIAL_PROVIDERS } from "./social-providers";

export const OAUTH = {
  linkedin: {
    label: "LinkedIn",
    clientId: "LINKEDIN_CLIENT_ID",
    clientSecret: "LINKEDIN_CLIENT_SECRET",
    auth: "https://www.linkedin.com/oauth/v2/authorization",
    token: "https://www.linkedin.com/oauth/v2/accessToken",
    scope: "openid profile w_member_social",
    clientKey: "client_id"
  },
  facebook: {
    label: "Facebook",
    clientId: "META_APP_ID",
    clientSecret: "META_APP_SECRET",
    auth: "https://www.facebook.com/v24.0/dialog/oauth",
    token: "https://graph.facebook.com/v24.0/oauth/access_token",
    scope: "pages_show_list pages_read_engagement pages_manage_posts instagram_basic instagram_content_publish business_management whatsapp_business_management whatsapp_business_messaging",
    clientKey: "client_id",
    meta: true
  },
  instagram: {
    label: "Instagram",
    clientId: "INSTAGRAM_APP_ID",
    clientSecret: "INSTAGRAM_APP_SECRET",
    auth: "https://www.instagram.com/oauth/authorize",
    token: "https://api.instagram.com/oauth/access_token",
    scope: "instagram_business_basic,instagram_business_content_publish",
    clientKey: "client_id",
    instagramDirect: true
  },
  youtube: {
    label: "YouTube",
    clientId: "GOOGLE_CLIENT_ID",
    clientSecret: "GOOGLE_CLIENT_SECRET",
    auth: "https://accounts.google.com/o/oauth2/v2/auth",
    token: "https://oauth2.googleapis.com/token",
    scope: "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly",
    clientKey: "client_id",
    google: true
  },
};

export function envReady(id) {
  const c = OAUTH[id];
  return Boolean(c && process.env[c.clientId] && process.env[c.clientSecret]);
}


export const ENABLED_SOCIAL_PROVIDER_IDS = ENABLED_SOCIAL_PROVIDERS.filter(id=>id!=="whatsapp");
export const ENABLED_SOCIAL_CHANNELS = ["LinkedIn","Facebook","Instagram","YouTube","WhatsApp"];

export function isEnabledSocialProvider(id){
  return ENABLED_SOCIAL_PROVIDER_IDS.includes(String(id||"").toLowerCase());
}
