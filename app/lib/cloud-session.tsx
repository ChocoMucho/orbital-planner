"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import {
  beginGoogleSignIn,
  completeAuthFromUrl,
  getCloudClient,
  isCloudConfigured,
  isDesktopRuntime,
  listenForDesktopAuthCallbacks,
} from "./cloud";

type CloudSessionValue = {
  configured: boolean;
  loading: boolean;
  user: User | null;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
};

const CloudSessionContext = createContext<CloudSessionValue | null>(null);

export function CloudSessionProvider({ children }: { children: ReactNode }) {
  const configured = isCloudConfigured();
  const [loading, setLoading] = useState(configured);
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cloudClient = getCloudClient();
    if (!cloudClient) return;

    let active = true;
    let stopDeepLinkListener: (() => void) | undefined;

    const complete = async (url: string) => {
      try {
        const completed = await completeAuthFromUrl(url);
        if (completed && !isDesktopRuntime()) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      } catch (authError) {
        if (active) setError(authError instanceof Error ? authError.message : "로그인을 완료하지 못했습니다.");
      }
    };

    void cloudClient.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) setError(sessionError.message);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    if (!isDesktopRuntime() && window.location.search.includes("code=")) {
      void complete(window.location.href);
    }
    void listenForDesktopAuthCallbacks(complete).then((stop) => {
      if (active) stopDeepLinkListener = stop;
      else stop();
    });

    const { data: subscription } = cloudClient.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setUser(session?.user ?? null);
      setLoading(false);
      setError(null);
    });

    return () => {
      active = false;
      stopDeepLinkListener?.();
      subscription.subscription.unsubscribe();
    };
  }, [configured]);

  const signIn = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      await beginGoogleSignIn();
      if (isDesktopRuntime()) setLoading(false);
    } catch (signInError) {
      setLoading(false);
      setError(signInError instanceof Error ? signInError.message : "Google 로그인을 시작하지 못했습니다.");
    }
  }, []);

  const signOut = useCallback(async () => {
    const cloudClient = getCloudClient();
    if (!cloudClient) return;
    const { error: signOutError } = await cloudClient.auth.signOut();
    if (signOutError) setError(signOutError.message);
  }, []);

  const value = useMemo<CloudSessionValue>(() => ({
    configured,
    loading,
    user,
    error,
    signIn,
    signOut,
  }), [configured, error, loading, signIn, signOut, user]);

  return <CloudSessionContext.Provider value={value}>{children}</CloudSessionContext.Provider>;
}

export function useCloudSession(): CloudSessionValue {
  const value = useContext(CloudSessionContext);
  if (!value) throw new Error("useCloudSession must be used inside CloudSessionProvider.");
  return value;
}
