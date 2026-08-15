import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "오비탈 플래너 · DSP 생산 계산기",
  description: "Dyson Sphere Program 생산 라인 계산기",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
