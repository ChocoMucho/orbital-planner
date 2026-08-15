import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "orbital-planner-dsp.vkclssha14.chatgpt.site";
  const forwardedProtocol = requestHeaders.get("x-forwarded-proto");
  const protocol = forwardedProtocol ?? (host.startsWith("localhost") ? "http" : "https");
  const image = `${protocol}://${host}/og.png`;
  const title = "오비탈 플래너 · DSP 생산 계산기";
  const description = "여러 생산 목표의 공통 중간재를 합산하는 Dyson Sphere Program 생산 라인 계산기";

  return {
    title,
    description,
    openGraph: { title, description, images: [{ url: image, width: 1731, height: 909, alt: "오비탈 플래너 — 여러 목표, 하나의 공장 계획" }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
