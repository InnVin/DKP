import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "АвтоДоговор Cloud 1.0.7.1",
  description: "Защищённая облачная подготовка договора купли-продажи автомобиля.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: { title: "АвтоДоговор Cloud 1.0.7.1", description: "Документы, распознавание, проверка и архив ДКП." },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body>{children}</body></html>;
}
