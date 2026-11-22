"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Home, Menu, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { navigation } from "@/data/navigation";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const reduceMotion = useReducedMotion();
  const toggle = useRef<HTMLButtonElement>(null);
  const isActive = (href: string) => pathname === href || (href !== "/" && pathname.startsWith(href + "/"));
  const mainItems = [{ href: "/", label: "Главная", icon: Home }, ...navigation];
  const mobileItems = [...mainItems, { href: "/explore", label: "Исследовать", icon: Search }];

  useEffect(() => {
    const updateHeader = () => setScrolled(window.scrollY > 24);
    updateHeader();
    window.addEventListener("scroll", updateHeader, { passive: true });
    return () => window.removeEventListener("scroll", updateHeader);
  }, []);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || toggle.current?.getClientRects().length === 0) return;
      setOpen(false);
      toggle.current?.focus();
    };
    const desktop = window.matchMedia("(min-width: 80rem)");
    const closeOnDesktop = () => { if (desktop.matches) setOpen(false); };
    document.addEventListener("keydown", dismiss);
    desktop.addEventListener("change", closeOnDesktop);
    return () => {
      document.removeEventListener("keydown", dismiss);
      desktop.removeEventListener("change", closeOnDesktop);
    };
  }, [open]);

  return <header className={cn("sticky top-0 z-50 border-b transition-all duration-300", scrolled ? "border-white/[0.1] bg-[#080e1c]/94 shadow-[0_12px_40px_rgba(0,0,0,0.2)] backdrop-blur-2xl" : "border-white/[0.06] bg-[#080e1c]/78 backdrop-blur-xl")}>
    <div className={cn("mx-auto flex max-w-[90rem] items-center justify-between px-5 transition-[height] duration-300 sm:px-8 lg:px-12", scrolled ? "h-16" : "h-[4.75rem]")}>
      <Link href="/" className="flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300" onClick={() => setOpen(false)}>
        <BrandMark />
        <span className="text-sm font-extrabold tracking-[0.14em] text-white sm:text-base">OLYMPIC <span className="text-[#f5c451]">ATLAS</span></span>
      </Link>
      <nav aria-label="Основная навигация" className="hidden items-center gap-1 xl:flex">
        {mainItems.map((item) => <Link key={item.href} href={item.href} aria-current={isActive(item.href) ? "page" : undefined} className={cn("relative rounded-full px-3 py-2 text-sm font-medium text-[#98a6bb] transition hover:bg-white/[0.045] hover:text-white", isActive(item.href) && "bg-white/[0.065] text-white after:absolute after:inset-x-3 after:-bottom-px after:h-px after:bg-[#d6ad60]")}>{item.label}</Link>)}
      </nav>
      <div className="hidden xl:flex"><Button asChild variant="ghost" size="sm"><Link href="/explore" aria-current={isActive("/explore") ? "page" : undefined}><Search className="size-4" />Исследовать</Link></Button></div>
      <Link href="/explore" aria-label="Интеллектуальный поиск" className="ml-auto mr-2 grid size-11 shrink-0 place-items-center rounded-md border border-white/10 text-[#a9dfff] xl:hidden"><Search size={19} aria-hidden /></Link>
      <button ref={toggle} type="button" aria-label={open ? "Закрыть меню" : "Открыть меню"} aria-expanded={open} aria-controls={open ? "atlas-mobile-navigation" : undefined} onClick={() => setOpen((value) => !value)} className="grid size-11 shrink-0 place-items-center rounded-full border border-white/10 text-white xl:hidden">
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>
    </div>
    <AnimatePresence>
      {open && <motion.nav id="atlas-mobile-navigation" aria-label="Мобильная навигация" initial={reduceMotion ? false : { height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={reduceMotion ? undefined : { height: 0, opacity: 0 }} transition={{ duration: reduceMotion ? 0 : 0.22 }} className="overflow-hidden border-t border-white/[0.07] bg-[#080e1c] px-5 xl:hidden">
        <div className="mx-auto grid max-h-[calc(100svh-5rem)] max-w-[90rem] gap-1 overflow-y-auto py-4">
          {mobileItems.map((item) => <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className={cn("flex min-h-12 items-center gap-3 rounded-xl px-4 text-base font-medium text-slate-300 transition hover:bg-white/[0.05]", isActive(item.href) && "bg-white/[0.07] text-white")}><item.icon className="size-4 text-[#55b9f3]" />{item.label}</Link>)}
        </div>
      </motion.nav>}
    </AnimatePresence>
  </header>;
}
