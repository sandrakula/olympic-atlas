import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { atlasMetadata, publicSiteOrigin, siteDescription } from "@/lib/metadata";
import "./globals.css";

export const metadata: Metadata = {
  ...atlasMetadata("/", "OLYMPIC ATLAS — база знаний об Олимпийских играх", siteDescription),
  metadataBase: publicSiteOrigin(),
  robots: publicSiteOrigin() ? undefined : { index: false, follow: false },
  title: {
    default: "OLYMPIC ATLAS — база знаний об Олимпийских играх",
    template: "%s · OLYMPIC ATLAS",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className="h-full antialiased" data-scroll-behavior="smooth">
      <body className="flex min-h-full flex-col">
        <a href="#atlas-content" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-4 focus:z-[100] focus:rounded-xl focus:bg-[#d6ad60] focus:px-5 focus:py-3 focus:font-bold focus:text-[#080e1c]">Перейти к содержанию</a>
        <SiteHeader />
        <div id="atlas-content" tabIndex={-1} className="flex-1 scroll-mt-24">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
