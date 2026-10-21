import { useState } from "react";
import { motion } from "framer-motion";
import { Check, RotateCcw, Gamepad2, Film, FolderOpen } from "lucide-react";

/* "The download race": all four OCCTA speed bands download the same file side by
   side, at the top of each band's published "up to" speed. Bar lengths race in
   true proportion (Gigabit is 12.5x Essential), and each lane shows the
   real-world time the maths gives. Illustration only — never a line-speed promise
   (binding speeds come from the address check, see AGENTS.md). */

const BANDS = [
  { name: "Essential", mbps: 80 },
  { name: "Superfast", mbps: 330 },
  { name: "Ultrafast", mbps: 550 },
  { name: "Gigabit", mbps: 1000 },
];

const FILES = [
  { id: "game", label: "A big game", detail: "about 50GB", gb: 50, icon: Gamepad2 },
  { id: "film", label: "A 4K film", detail: "about 20GB", gb: 20, icon: Film },
  { id: "folder", label: "A work folder", detail: "about 2GB", gb: 2, icon: FolderOpen },
];

/** Gigabit's bar takes this long; slower bands take proportionally longer. */
const FASTEST_MS = 1000;
/** Roughly what one 4K stream needs, for the "streams at once" hint. */
const MBPS_PER_4K_STREAM = 25;

const formatDuration = (seconds: number) => {
  const s = Math.round(seconds);
  if (s < 60) return `${s} sec`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = s % 60;
  if (h > 0) return `${h} hr ${m} min`;
  return rest ? `${m} min ${rest} sec` : `${m} min`;
};

const SpeedRace = ({ tone = "light" }: { tone?: "light" | "dark" }) => {
  const [fileId, setFileId] = useState(FILES[0].id);
  const [run, setRun] = useState(0);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState<Set<string>>(new Set());
  const file = FILES.find((f) => f.id === fileId) ?? FILES[0];
  const dark = tone === "dark";

  const restart = (nextFile = fileId) => {
    setFileId(nextFile);
    setFinished(new Set());
    setRun((r) => r + 1);
  };

  return (
    <motion.div onViewportEnter={() => setStarted(true)} viewport={{ once: true, margin: "-120px" }}>
      {/* File picker */}
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Choose a download">
        {FILES.map((f) => {
          const active = f.id === fileId;
          return (
            <button
              key={f.id}
              type="button"
              aria-pressed={active}
              onClick={() => restart(f.id)}
              className={`inline-flex items-center gap-2.5 border-[3px] px-4 py-2.5 text-left transition-colors ${
                active
                  ? dark
                    ? "border-primary bg-primary text-black"
                    : "border-foreground bg-foreground text-background"
                  : dark
                    ? "border-white/25 text-white hover:border-white"
                    : "border-foreground/25 text-foreground hover:border-foreground"
              }`}
            >
              <f.icon className="w-5 h-5" />
              <span className="font-display text-xl uppercase leading-none">{f.label}</span>
              <span className={`font-sans text-xs ${active ? "opacity-70" : "opacity-55"}`}>{f.detail}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => restart()}
          className={`ml-auto inline-flex items-center gap-2 font-display text-lg uppercase tracking-wide ${dark ? "text-white" : "text-foreground"}`}
        >
          <RotateCcw className="w-4 h-4" /> Race again
        </button>
      </div>

      {/* Lanes */}
      <ol className="mt-8 space-y-3">
        {BANDS.map((band) => {
          const seconds = (file.gb * 8000) / band.mbps;
          const raceMs = FASTEST_MS * (1000 / band.mbps);
          const key = `${run}-${file.id}-${band.name}`;
          const done = finished.has(key);
          return (
            <li key={band.name} className="grid grid-cols-[6.5rem_1fr] sm:grid-cols-[10rem_1fr_9.5rem] items-center gap-x-4 gap-y-2">
              <div>
                <p className="font-display text-2xl sm:text-3xl uppercase leading-none">{band.name}</p>
                <p className={`mt-1 font-sans text-xs ${dark ? "text-white/55" : "text-foreground/55"}`}>Up to {band.mbps}Mbps</p>
              </div>

              <div className={`relative h-12 sm:h-14 overflow-hidden border-[3px] ${dark ? "border-white bg-white/5" : "border-foreground bg-white"}`}>
                {started && (
                  <div
                    key={key}
                    className="occ-race absolute inset-y-0 left-0 bg-primary"
                    style={{ ["--occ-race-ms" as string]: `${raceMs}ms` }}
                    onAnimationEnd={() => setFinished((s) => new Set(s).add(key))}
                  >
                    <span className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center bg-black text-primary">
                      {done ? <Check className="w-4 h-4" strokeWidth={3} /> : <file.icon className="w-4 h-4" />}
                    </span>
                  </div>
                )}
                <span aria-hidden className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent_0_calc(10%-2px),rgba(0,0,0,0.08)_calc(10%-2px)_10%)]" />
              </div>

              <div className="col-start-2 sm:col-start-auto flex items-baseline justify-between gap-3 sm:block sm:text-right">
                <p className={`whitespace-nowrap font-display text-xl sm:text-2xl leading-none transition-opacity duration-300 ${done || !started ? "opacity-100" : "opacity-40"}`}>
                  {formatDuration(seconds)}
                </p>
                <p className={`whitespace-nowrap font-sans text-[11px] ${dark ? "text-white/55" : "text-foreground/55"}`}>
                  ≈ {Math.floor(band.mbps / MBPS_PER_4K_STREAM)} × 4K streams<span className="hidden sm:inline"> at once</span>
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      <p className={`mt-6 max-w-3xl text-xs leading-relaxed ${dark ? "text-white/50" : "text-foreground/55"}`}>
        Illustration only: simple maths at the top of each band's "up to" speed (1GB = 8,000 megabits; one 4K stream taken as about {MBPS_PER_4K_STREAM}Mbps). Real downloads depend on your line, your Wi-Fi and the service you're downloading from. Your address-specific speed information is confirmed before you order.
      </p>
    </motion.div>
  );
};

export default SpeedRace;
