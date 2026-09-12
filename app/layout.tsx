import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Waylo — travel that adapts to you",
  description:
    "A crew of agents builds your trip, then keeps re-planning as the weather, your budget and your mood change mid-trip.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Manrope:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body data-recording={process.env.NEXT_PUBLIC_RECORDING === "1" ? "1" : undefined}>
        {children}
      </body>
    </html>
  );
}
