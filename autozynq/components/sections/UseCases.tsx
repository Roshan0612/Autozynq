"use client";

import { useEffect, useState } from "react";

type NodeType = "trigger" | "process" | "action";

type WorkflowNodeType = {
  label: string;
  type: NodeType;
  icon: string;
};

type UseCase = {
  id: string;
  number: string;
  title: string;
  description: string;
  result: string;
  nodes: WorkflowNodeType[];
};

const useCases: UseCase[] = [
  {
    id: "lead",
    number: "01",
    title: "Lead & Enquiry",
    description: "Capture incoming enquiries, process the information, and automatically respond without manually moving data between tools.",
    result: "New enquiry processed automatically",
    nodes: [
      { label: "Google Form", type: "trigger", icon: "F" },
      { label: "Process", type: "process", icon: "*" },
      { label: "Google Sheets", type: "action", icon: "S" },
      { label: "Gmail", type: "action", icon: "M" },
    ],
  },
  {
    id: "documents",
    number: "02",
    title: "Document Flow",
    description: "Move files through your workflow automatically, process incoming data, and keep documents organized without repetitive manual work.",
    result: "Document workflow completed",
    nodes: [
      { label: "Webhook", type: "trigger", icon: "W" },
      { label: "Process", type: "process", icon: "*" },
      { label: "Google Drive", type: "action", icon: "D" },
      { label: "Gmail", type: "action", icon: "M" },
    ],
  },
  {
    id: "scheduling",
    number: "03",
    title: "Scheduling",
    description: "Connect incoming requests with calendar actions and automatically keep people informed about scheduled events.",
    result: "Calendar event created",
    nodes: [
      { label: "Google Form", type: "trigger", icon: "F" },
      { label: "Process", type: "process", icon: "*" },
      { label: "Calendar", type: "action", icon: "C" },
      { label: "Gmail", type: "action", icon: "M" },
    ],
  },
  {
    id: "data",
    number: "04",
    title: "Data Collection",
    description: "Collect structured information and automatically organize it where your team can use it immediately.",
    result: "Data synchronized successfully",
    nodes: [
      { label: "Google Form", type: "trigger", icon: "F" },
      { label: "Process", type: "process", icon: "*" },
      { label: "Google Sheets", type: "action", icon: "S" },
      { label: "Google Drive", type: "action", icon: "D" },
    ],
  },
  {
    id: "notifications",
    number: "05",
    title: "Notifications",
    description: "React to events automatically and send the right information to the right place as soon as something happens.",
    result: "Notification dispatched",
    nodes: [
      { label: "Webhook", type: "trigger", icon: "W" },
      { label: "Process", type: "process", icon: "*" },
      { label: "Gmail", type: "action", icon: "M" },
      { label: "Calendar", type: "action", icon: "C" },
    ],
  },
];

function WorkflowNode({ node, index, active }: { node: WorkflowNodeType; index: number; active: boolean }) {
  const isProcess = node.type === "process";

  return (
    <div className="relative flex min-w-0 flex-1 flex-col items-center text-center" style={{ opacity: active ? 1 : 0, transform: active ? "translateY(0px) scale(1)" : "translateY(14px) scale(0.94)", transition: `opacity 500ms ease ${index * 100}ms, transform 500ms cubic-bezier(0.16, 1, 0.3, 1) ${index * 100}ms` }}>
      <div className={[
        "relative flex h-[70px] w-[70px] items-center justify-center rounded-[20px] border backdrop-blur-xl sm:h-[78px] sm:w-[78px]",
        isProcess ? "border-violet-300/30 bg-violet-500/[0.09] shadow-[0_0_35px_rgba(139,92,246,0.15)]" : "border-white/[0.08] bg-white/[0.025]",
      ].join(" ")}>
        {isProcess && (
          <>
            <div className="absolute -inset-2 rounded-[25px] border border-violet-400/10 animate-pulse" />
            <div className="absolute -inset-4 rounded-[30px] border border-violet-400/[0.035]" />
          </>
        )}
        <span className={[
          "relative z-10 flex h-9 w-9 items-center justify-center rounded-xl text-xs font-medium",
          isProcess ? "bg-violet-400/10 text-violet-200" : "bg-white/[0.035] text-white/60",
        ].join(" ")}>
          {node.icon}
        </span>
      </div>
      <p className="mt-4 max-w-[110px] text-[11px] font-medium leading-4 text-white/60 sm:text-xs">{node.label}</p>
      <p className="mt-1 text-[8px] uppercase tracking-[0.16em] text-white/20">{node.type}</p>
    </div>
  );
}

export default function UseCases() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const activeCase = useCases[activeIndex];

  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current >= useCases.length - 1 ? 0 : current + 1));
    }, 5500);
    return () => window.clearInterval(timer);
  }, [paused]);

  return (
    <section className="relative overflow-hidden bg-[#020106] px-6 py-28 sm:py-36" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[550px] w-[550px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-600/[0.035] blur-[140px]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(255,255,255,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:80px_80px]" />
      <div className="relative mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <p className="mb-5 text-xs uppercase tracking-[0.35em] text-violet-300/70">Use cases</p>
          <h2 className="text-4xl font-medium leading-[1.04] tracking-[-0.045em] text-white sm:text-6xl lg:text-7xl">
            Automate the work
            <br />
            <span className="text-white/30">between the steps.</span>
          </h2>
          <p className="mt-7 max-w-xl text-base leading-7 text-white/40 sm:text-lg">
            Connect the tools you already use and turn repetitive actions into workflows that run automatically.
          </p>
        </div>
        <div className="mt-20 grid gap-8 lg:grid-cols-[250px_1fr] lg:gap-16">
          <div className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:gap-1 lg:overflow-visible">
            {useCases.map((item, index) => {
              const selected = index === activeIndex;
              return (
                <button key={item.id} type="button" onClick={() => setActiveIndex(index)} className={[
                    "group relative shrink-0 rounded-xl border-l px-4 py-3.5 text-left transition-all duration-500 lg:rounded-none lg:px-5",
                    selected ? "border-violet-400 bg-white/[0.025]" : "border-white/[0.06] hover:border-white/20",
                  ].join(" ")}>
                  <div className="flex items-center gap-3">
                    <span className={[
                      "font-mono text-[9px] tracking-[0.2em] transition-colors",
                      selected ? "text-violet-300" : "text-white/20",
                    ].join(" ")}>{item.number}</span>
                    <span className={[
                      "whitespace-nowrap text-sm transition-colors",
                      selected ? "text-white" : "text-white/40 group-hover:text-white/70",
                    ].join(" ")}>{item.title}</span>
                  </div>
                  {selected && <span className="absolute right-4 top-1/2 hidden h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-violet-300 shadow-[0_0_14px_rgba(167,139,250,0.8)] lg:block" />}
                </button>
              );
            })}
          </div>
          <div className="relative overflow-hidden rounded-[30px] border border-white/[0.07] bg-white/[0.018] p-6 sm:p-10 lg:p-12">
            <div className="pointer-events-none absolute -right-32 -top-32 h-[300px] w-[300px] rounded-full bg-violet-500/[0.06] blur-[110px]" />
            <div className="pointer-events-none absolute -bottom-32 -left-32 h-[280px] w-[280px] rounded-full bg-indigo-500/[0.035] blur-[110px]" />
            <div className="relative z-10 flex items-start justify-between gap-5">
              <div>
                <p className="text-[9px] uppercase tracking-[0.25em] text-white/20">Automation scenario</p>
                <h3 key={activeCase.id} className="mt-3 text-2xl font-medium tracking-tight text-white sm:text-3xl" style={{ animation: "none" }}>{activeCase.title}</h3>
              </div>
              <div className="flex shrink-0 items-center gap-2 rounded-full border border-emerald-400/10 bg-emerald-400/[0.035] px-3 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
                <span className="text-[8px] uppercase tracking-[0.18em] text-emerald-300/60">Active</span>
              </div>
            </div>
            <p key={`${activeCase.id}-description`} className="relative z-10 mt-5 max-w-2xl text-sm leading-6 text-white/35 sm:text-base">{activeCase.description}</p>
            <div className="relative z-10 mt-16">
              <div className="absolute left-[12.5%] right-[12.5%] top-[35px] hidden h-px bg-white/[0.07] md:block" />
              <div key={`${activeCase.id}-connection`} className="absolute left-[12.5%] top-[35px] hidden h-px md:block" style={{ width: "75%", background: "linear-gradient(90deg, rgba(167,139,250,0.65), rgba(217,70,239,0.65), rgba(167,139,250,0.35))", transformOrigin: "left center", animation: "connectionReveal 900ms ease-out" }} />
              <div key={`${activeCase.id}-particle`} className="pointer-events-none absolute left-[12.5%] top-[31px] hidden h-[9px] w-[9px] rounded-full bg-white md:block" style={{ boxShadow: "0 0 16px rgba(255,255,255,1), 0 0 30px rgba(139,92,246,0.8)", animation: "dataFlow 2200ms ease-in-out infinite" }} />
              <div className="grid grid-cols-2 gap-y-12 md:flex md:gap-0">
                {activeCase.nodes.map((node, index) => (
                  <WorkflowNode key={`${activeCase.id}-${node.label}`} node={node} index={index} active />
                ))}
              </div>
            </div>
            <div key={`${activeCase.id}-result`} className="relative z-10 mt-14 flex items-center justify-between gap-5 rounded-2xl border border-white/[0.06] bg-black/20 px-5 py-4">
              <div>
                <p className="text-[8px] uppercase tracking-[0.2em] text-white/20">Result</p>
                <p className="mt-1.5 text-sm text-white/55">{activeCase.result}</p>
              </div>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-emerald-400/10 bg-emerald-400/[0.04] text-xs text-emerald-300">✓</div>
            </div>
          </div>
        </div>
        <div className="mt-7 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {useCases.map((item, index) => {
              const selected = index === activeIndex;
              return (
                <button key={item.id} type="button" aria-label={`Show ${item.title}`} onClick={() => setActiveIndex(index)} className={[
                  "h-1 rounded-full transition-all duration-500",
                  selected ? "w-8 bg-violet-400" : "w-2 bg-white/10 hover:bg-white/20",
                ].join(" ")} />
              );
            })}
          </div>
          <p className="text-[9px] uppercase tracking-[0.2em] text-white/20">
            {String(activeIndex + 1).padStart(2, "0")} / {String(useCases.length).padStart(2, "0")}
          </p>
        </div>
      </div>
      <style>{`
        @keyframes connectionReveal {
          from { transform: scaleX(0); opacity: 0; }
          to { transform: scaleX(1); opacity: 1; }
        }
        @keyframes dataFlow {
          0% { left: 12.5%; opacity: 0; transform: scale(0.65); }
          12% { opacity: 1; }
          50% { opacity: 1; transform: scale(1); }
          88% { opacity: 1; }
          100% { left: 87.5%; opacity: 0; transform: scale(0.65); }
        }
      `}</style>
    </section>
  );
}
