"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

import Scene, { type SceneHandle } from "@/components/experience/Scene";
import AutomationProcess from "@/components/sections/AutomationProcess";
import Integrations from "@/components/sections/Integrations";
import WorkflowBuilder from "@/components/sections/WorkflowBuilder";
import UseCases from "@/components/sections/UseCases";

const HeroIntro = dynamic(() => import("@/components/hero/HeroIntro"), {
  ssr: false,
});

export default function Home() {
  const sceneRef = useRef<SceneHandle | null>(null);
  const heroRef = useRef<HTMLElement | null>(null);
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    const updateScene = () => {
      const hero = heroRef.current;
      if (!hero) return;

      const rect = hero.getBoundingClientRect();
      const distance = window.innerHeight * 1.8;
      const scrolled = Math.max(0, -rect.top);
      const progress = Math.min(1, scrolled / distance);

      sceneRef.current?.setScrollProgress(progress);
    };

    updateScene();
    window.addEventListener("scroll", updateScene, { passive: true });
    window.addEventListener("resize", updateScene);

    return () => {
      window.removeEventListener("scroll", updateScene);
      window.removeEventListener("resize", updateScene);
    };
  }, []);

  return (
    <main className="relative min-h-screen bg-[#020106] text-white">
      <header className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-20">
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-6 lg:px-8">
          <div className="pointer-events-auto group flex items-center gap-2.5">
            <div className="relative flex h-7 w-7 items-center justify-center">
              <div className="absolute inset-0 rounded-full border border-violet-400/20" />
              <div className="absolute inset-0 rounded-full border border-transparent border-t-violet-400/80 border-r-violet-400/20 animate-[spin_3s_linear_infinite]" />
              <div className="relative h-2.5 w-2.5 rounded-full bg-violet-400 shadow-[0_0_14px_rgba(167,139,250,0.9)]" />
              <div className="absolute -right-0.5 top-1/2 h-1 w-1 -translate-y-1/2 rounded-full bg-white opacity-70 shadow-[0_0_8px_rgba(255,255,255,0.8)] animate-pulse" />
            </div>
            <span className="text-[15px] font-semibold tracking-[-0.03em] text-white/90 transition-colors duration-300 group-hover:text-white">Autozynq</span>
          </div>
          <nav className="pointer-events-auto hidden items-center gap-8 md:flex">
            {[
              ["#process", "Process"],
              ["#integrations", "Integrations"],
              ["#workflow", "Workflow"],
              ["#use-cases", "Use cases"],
            ].map(([href, label]) => (
              <a
                key={String(href)}
                href={String(href)}
                className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/35 transition-colors duration-300 hover:text-white/80"
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="pointer-events-auto">
            <button
              type="button"
              onClick={() => {
                const destination = status === "authenticated" ? "/dashboard" : "/auth/signin?callbackUrl=/dashboard";
                router.push(destination);
              }}
              className="group relative overflow-hidden rounded-full px-4 py-2 text-[10px] font-medium uppercase tracking-[0.18em] text-white/65 transition-colors duration-300 hover:text-white"
            >
              <span className="absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 bg-gradient-to-r from-transparent via-violet-400 to-transparent transition-transform duration-500 group-hover:scale-x-100" />
              Start building
            </button>
          </div>
        </div>
      </header>

      <div className="pointer-events-none fixed inset-0 z-0">
        <Scene ref={sceneRef} />
      </div>

      <section ref={heroRef} className="relative z-10 h-[280vh]">
        <div className="sticky top-0 h-screen overflow-hidden">
          <div className="absolute inset-0 z-20 flex items-center justify-center">
            <HeroIntro />
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 h-48 bg-gradient-to-t from-[#020106] via-[#020106]/40 to-transparent" />
          <div className="pointer-events-none absolute bottom-8 left-1/2 z-40 -translate-x-1/2 text-center">
            <div className="mx-auto mb-3 flex h-8 w-[18px] justify-center rounded-full border border-white/20 pt-1.5">
              <div className="h-2 w-1 rounded-full bg-white/50" />
            </div>
            <p className="text-[9px] uppercase tracking-[0.4em] text-white/30">Scroll</p>
          </div>
        </div>
      </section>

      <div id="process" className="relative z-20"><AutomationProcess /></div>
      <div id="integrations" className="relative z-20"><Integrations /></div>
      <div id="workflow" className="relative z-20"><WorkflowBuilder /></div>
      <div id="use-cases" className="relative z-20"><UseCases /></div>

      <section className="relative z-20 min-h-[80vh] overflow-hidden bg-[#020106] px-6 py-32">
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-600/[0.08] blur-[130px]" />
        <div className="relative mx-auto max-w-7xl">
          <p className="text-xs uppercase tracking-[0.35em] text-violet-300">Ready</p>
          <h2 className="mt-6 max-w-5xl text-5xl font-medium leading-[.95] tracking-[-0.055em] sm:text-7xl lg:text-[8rem]">
            Your workflow.
            <br />
            <span className="text-white/25">On autopilot.</span>
          </h2>
          <div className="mt-12 flex flex-col gap-5 sm:flex-row sm:items-center">
            <button className="group relative overflow-hidden rounded-full border border-violet-300/30 bg-violet-500/10 px-7 py-4 text-sm font-medium transition-all duration-300 hover:border-violet-300/60 hover:bg-violet-500/20 hover:shadow-[0_0_50px_rgba(139,92,246,.2)]">
              <span className="relative z-10">Start building</span>
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
            </button>
            <span className="text-sm text-white/25">No complicated setup.</span>
          </div>
        </div>
      </section>

      <footer className="relative z-20 overflow-hidden bg-[#020106] px-6 pb-8 pt-20">
        <div className="pointer-events-none absolute left-0 right-0 top-0 h-px overflow-hidden bg-white/[0.04]">
          <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-violet-400/50 to-transparent animate-[translateX_4s_linear_infinite]" />
        </div>
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-12 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="relative flex h-7 w-7 items-center justify-center">
                  <div className="absolute inset-0 rounded-full border border-violet-400/20" />
                  <div className="absolute inset-0 rounded-full border border-transparent border-t-violet-400/70 animate-[spin_3s_linear_infinite]" />
                  <div className="h-2.5 w-2.5 rounded-full bg-violet-400 shadow-[0_0_14px_rgba(167,139,250,0.8)]" />
                </div>
                <span className="text-sm font-semibold tracking-[-0.03em]">Autozynq</span>
              </div>
              <p className="mt-5 max-w-xs text-sm leading-6 text-white/25">Intelligent automation for connected, repeatable workflows.</p>
            </div>
            <div>
              <p className="text-[9px] font-medium uppercase tracking-[0.25em] text-white/30">Product</p>
              <div className="mt-5 flex flex-col gap-3">
                {[
                  ["#process", "Process"],
                  ["#integrations", "Integrations"],
                  ["#workflow", "Workflow builder"],
                  ["#use-cases", "Use cases"],
                ].map(([href, label]) => (
                  <a key={String(href)} href={String(href)} className="text-sm text-white/30 transition-colors hover:text-white/70">{label}</a>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[9px] font-medium uppercase tracking-[0.25em] text-white/30">Company</p>
              <div className="mt-5 flex flex-col gap-3">
                {[
                  ["#", "About"],
                  ["#", "Contact"],
                  ["#", "GitHub"],
                ].map(([href, label]) => (
                  <a key={String(label)} href={String(href)} className="text-sm text-white/30 transition-colors hover:text-white/70">{label}</a>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[9px] font-medium uppercase tracking-[0.25em] text-white/30">Legal</p>
              <div className="mt-5 flex flex-col gap-3">
                {[
                  ["#", "Privacy"],
                  ["#", "Terms"],
                ].map(([href, label]) => (
                  <a key={String(label)} href={String(href)} className="text-sm text-white/30 transition-colors hover:text-white/70">{label}</a>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-16 flex flex-col gap-4 border-t border-white/[0.05] pt-6 text-[10px] uppercase tracking-[0.18em] text-white/20 sm:flex-row sm:items-center sm:justify-between">
            <span>© 2026 Autozynq</span>
            <span>Intelligent automation</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
