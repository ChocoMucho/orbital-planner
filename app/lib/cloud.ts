import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type BuildEnvironment = {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
};

const buildEnvironment = (import.meta as ImportMeta & { env?: BuildEnvironment }).env;
const supabaseUrl = buildEnvironment?.VITE_SUPABASE_URL?.trim() ?? "";
const supabasePublishableKey = buildEnvironment?.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";

let client: SupabaseClient | null | undefined;

export function isCloudConfigured(): boolean {
  return Boolean(supabaseUrl && supabasePublishableKey);
}

export function isDesktopRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function getCloudClient(): SupabaseClient | null {
  if (client !== undefined) return client;
  if (!isCloudConfigured()) {
    client = null;
    return client;
  }

  client = createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      flowType: "pkce",
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  return client;
}

export async function beginGoogleSignIn(): Promise<void> {
  const cloudClient = getCloudClient();
  if (!cloudClient) throw new Error("클라우드 연결 정보가 설정되지 않았습니다.");

  const desktop = isDesktopRuntime();
  const redirectTo = desktop
    ? "orbital-planner://auth/callback"
    : `${window.location.origin}/`;
  const { data, error } = await cloudClient.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: desktop,
    },
  });
  if (error) throw error;

  if (desktop) {
    if (!data.url) throw new Error("Google 로그인 주소를 만들지 못했습니다.");
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(data.url);
  }
}

export async function completeAuthFromUrl(url: string): Promise<boolean> {
  const cloudClient = getCloudClient();
  if (!cloudClient) return false;

  const parsed = new URL(url);
  const code = parsed.searchParams.get("code");
  if (!code) return false;

  const { error } = await cloudClient.auth.exchangeCodeForSession(code);
  if (error) throw error;
  return true;
}

export async function listenForDesktopAuthCallbacks(
  callback: (url: string) => void | Promise<void>,
): Promise<() => void> {
  if (!isDesktopRuntime()) return () => undefined;

  const { getCurrent, onOpenUrl } = await import("@tauri-apps/plugin-deep-link");
  const currentUrls = await getCurrent();
  for (const url of currentUrls ?? []) await callback(url);

  return onOpenUrl((urls) => {
    for (const url of urls) void callback(url);
  });
}
