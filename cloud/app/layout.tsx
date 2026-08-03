import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "АвтоДоговор Cloud 1.0.6",
  description: "Защищённая облачная подготовка договора купли-продажи автомобиля.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: {
    title: "АвтоДоговор Cloud 1.0.6",
    description: "Документы, распознавание, проверка и архив ДКП в одном защищённом приложении.",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
