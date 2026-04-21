"use client";

import { motion } from "framer-motion";
import Link from "next/link";

const workflowSteps = [
  {
    title: "Data Intake",
    emoji: "🗂️",
    body: "Load SAMHSA facility records and normalize key service fields.",
    image: "https://picsum.photos/seed/data-intake/900/540",
  },
  {
    title: "Feature Engineering",
    emoji: "🧩",
    body: "Convert service patterns into structured signals for clustering and ranking.",
    image:
      "https://images.unsplash.com/photo-1518186285589-2f7649de83e0?auto=format&fit=crop&w=900&q=80",
  },
  {
    title: "Care-Bundle Clustering",
    emoji: "🧠",
    body: "Group facilities into tiers by complexity support and service breadth.",
    image: "/workflow-clustering.svg",
  },
  {
    title: "User Context",
    emoji: "📍",
    body: "Capture ZIP/location and clinical constraints from care-team filters.",
    image:
      "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=900&q=80",
  },
  {
    title: "Scoring + Rerank",
    emoji: "⚖️",
    body: "Apply bounded explainable score and optional AI rerank for nuance.",
    image:
      "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=900&q=80",
  },
  {
    title: "Actionable Output",
    emoji: "☎️",
    body: "Show map, top facilities, and direct call/intake/map actions.",
    image:
      "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=900&q=80",
  },
];
const FALLBACK_WORKFLOW_IMAGE = "https://picsum.photos/seed/workflow-fallback/900/540";
const USER_STORY_VIDEO_URL = "https://www.youtube.com/embed/j44QaSDsIT0";
const workflowAccents = [
  { dot: "bg-sky-500 ring-sky-100", badge: "bg-sky-100 text-sky-700", card: "border-sky-100 bg-sky-50/50" },
  {
    dot: "bg-emerald-500 ring-emerald-100",
    badge: "bg-emerald-100 text-emerald-700",
    card: "border-emerald-100 bg-emerald-50/50",
  },
  {
    dot: "bg-violet-500 ring-violet-100",
    badge: "bg-violet-100 text-violet-700",
    card: "border-violet-100 bg-violet-50/50",
  },
  {
    dot: "bg-amber-500 ring-amber-100",
    badge: "bg-amber-100 text-amber-700",
    card: "border-amber-100 bg-amber-50/50",
  },
  {
    dot: "bg-rose-500 ring-rose-100",
    badge: "bg-rose-100 text-rose-700",
    card: "border-rose-100 bg-rose-50/50",
  },
  {
    dot: "bg-indigo-500 ring-indigo-100",
    badge: "bg-indigo-100 text-indigo-700",
    card: "border-indigo-100 bg-indigo-50/50",
  },
];

const reveal = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: "easeOut" as const } },
};

function Section({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.section
      variants={reveal}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      className={className}
    >
      {children}
    </motion.section>
  );
}

export default function HomeLanding() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-gradient-to-b from-sky-50 via-white to-indigo-50 text-slate-900">
      <div className="pointer-events-none absolute inset-0 -z-0 overflow-hidden">
        <motion.div
          className="absolute -left-20 top-16 h-72 w-72 rounded-full bg-sky-200/40 blur-3xl"
          animate={{ y: [0, 16, 0], x: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 9, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute right-0 top-56 h-64 w-64 rounded-full bg-indigo-200/35 blur-3xl"
          animate={{ y: [0, -20, 0], x: [0, -8, 0] }}
          transition={{ repeat: Infinity, duration: 10, ease: "easeInOut" }}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-6 py-14">
        <Section className="rounded-3xl border border-sky-200 bg-white p-10 shadow-xl shadow-sky-100">
          <p className="mb-3 text-xs uppercase tracking-[0.22em] text-sky-600">Raptor Rise · BHA Navigator</p>
          <h1 className="max-w-4xl text-4xl font-semibold leading-tight md:text-5xl">
            Helping care teams find the right behavioral health facility faster.
          </h1>
          <p className="mt-4 max-w-3xl text-slate-600">
            We turn raw public facility records into a practical decision tool. Instead of manually
            calling long provider lists, teams can filter by clinical needs, care complexity, and
            location to prioritize the most relevant options first.
          </p>
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }} className="mt-7 inline-block">
            <Link
              prefetch
              href="/navigator"
              className="rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 px-5 py-2.5 font-medium text-white transition hover:from-sky-600 hover:to-indigo-600"
            >
              Open Facility Navigator
            </Link>
          </motion.div>
        </Section>

        <Section className="mt-10 grid gap-5 md:grid-cols-2">
          <motion.article whileHover={{ y: -4 }} className="rounded-2xl border border-rose-200 bg-white p-6 shadow-sm">
            <h2 className="mb-3 text-xl font-semibold text-rose-700">Problem Statement</h2>
            <img
              src="https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=1200&q=80"
              alt="Healthcare professionals discussing patient care"
              className="mb-4 h-44 w-full rounded-xl border border-rose-100 object-cover"
              onError={(event) => {
                event.currentTarget.onerror = null;
                event.currentTarget.src = "https://picsum.photos/seed/problem-doctors/1200/700";
              }}
            />
            <p className="text-sm leading-6 text-slate-600">
              Across the U.S., social workers, discharge planners, and care coordinators still
              spend too much time calling <strong>outdated directories</strong>, hitting{" "}
              <strong>voicemails</strong>, and reconciling <strong>contradictory provider data</strong>.
              The challenge is not finding any facility — it is finding a <strong>plausible option</strong>{" "}
              for a specific patient in a specific location.
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              This project builds a behavioral health plausibility navigator using the{" "}
              <strong>SAMHSA facilities dataset</strong>: users enter ZIP, care need, and constraints,
              then get ranked options with <strong>transparent match signals</strong>. The goal is{" "}
              <strong>faster, more confident referral decisions</strong> rather than appointment booking.
            </p>
          </motion.article>
          <motion.article whileHover={{ y: -4 }} className="rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
            <h2 className="mb-3 text-xl font-semibold text-amber-700">What Existing Solutions Lack</h2>
            <img
              src="https://commons.wikimedia.org/wiki/Special:FilePath/Old_Index_Card_File_Cabinet.jpg"
              alt="Old directory card catalog drawer with paper records"
              className="mb-4 h-44 w-full rounded-xl border border-amber-100 object-cover"
              onError={(event) => {
                event.currentTarget.onerror = null;
                event.currentTarget.src =
                  "https://commons.wikimedia.org/wiki/Special:FilePath/Card_Catolog01.jpg";
              }}
            />
            <ul className="space-y-2 text-sm text-slate-600">
              <li>
                <strong>Static lists</strong> without quality triage or complexity awareness.
              </li>
              <li>
                <strong>Limited transparency</strong> about why a facility is shown.
              </li>
              <li>
                <strong>Weak support</strong> for combining care fit + location + service depth.
              </li>
              <li>
                <strong>Too much manual effort</strong> for time-sensitive referrals.
              </li>
            </ul>
          </motion.article>
        </Section>

        <Section className="mt-10 rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-2xl font-semibold text-slate-800">What Users Face Today</h2>
            <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-medium text-rose-700">
              Real-world frustration
            </span>
          </div>
          <p className="mb-4 max-w-4xl text-sm leading-6 text-slate-600">
            This kind of experience is exactly what this project addresses: people struggling to find
            the right behavioral health option despite urgent need, insurance constraints, and unclear
            directories.
          </p>
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <div className="aspect-video w-full bg-slate-100">
              <iframe
                src={USER_STORY_VIDEO_URL}
                title="Patient story: navigating a broken mental health system"
                className="h-full w-full"
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
          </div>
        </Section>

        <Section className="mt-10 rounded-2xl border border-sky-200 bg-white p-7 shadow-sm">
          <h2 className="mb-3 text-2xl font-semibold text-sky-700">Data Foundation: SAMHSA Dataset</h2>
          <p className="max-w-4xl text-sm leading-6 text-slate-600">
            This platform is powered by the SAMHSA behavioral health treatment facilities dataset.
            We use structured fields such as care type, setting, emergency services, payment options,
            special programs, recovery support, and location to build an explainable search-and-rank
            workflow.
          </p>
        </Section>

        <Section className="mt-10 rounded-2xl border border-indigo-200 bg-white p-7 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-2xl font-semibold text-indigo-700">Project Workflow</h2>
            <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-700">
              End-to-end pipeline
            </span>
          </div>
          <p className="max-w-4xl text-sm leading-6 text-slate-600">
            This is how the platform turns public data into practical referral decisions. The flow
            below mirrors what happens in the product from ingestion to outreach.
          </p>

          <div className="relative mt-7">
            <div className="absolute bottom-0 left-4 top-0 w-0.5 bg-indigo-100 sm:left-1/2 sm:-translate-x-1/2" />
            <div className="space-y-10">
              {workflowSteps.map((step, idx) => {
                const accent = workflowAccents[idx % workflowAccents.length];
                return (
                  <motion.article
                    key={step.title}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.35 }}
                    transition={{ duration: 0.45, ease: "easeOut", delay: 0.03 * idx }}
                    className="relative grid gap-4 pl-10 sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-6 sm:pl-0"
                  >
                    <div
                      className={`relative rounded-2xl border p-5 shadow-sm sm:row-start-1 ${accent.card} ${
                        idx % 2 === 0 ? "sm:col-start-1" : "sm:col-start-3"
                      }`}
                    >
                      <span className={`mb-2 inline-block rounded-full px-2.5 py-1 text-xs font-medium ${accent.badge}`}>
                        Step {idx + 1}
                      </span>
                      <h3 className="mt-1 flex items-center gap-2 text-lg font-semibold text-slate-800">
                        <span>{step.emoji}</span>
                        {step.title}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{step.body}</p>
                    </div>

                    <div className={`sm:row-start-1 ${idx % 2 === 0 ? "sm:col-start-3" : "sm:col-start-1"}`}>
                      <motion.img
                        whileHover={{ scale: 1.02 }}
                        src={step.image}
                        alt={step.title}
                        onError={(event) => {
                          event.currentTarget.onerror = null;
                          event.currentTarget.src = FALLBACK_WORKFLOW_IMAGE;
                        }}
                        className="h-44 w-full rounded-2xl border border-indigo-100 object-cover shadow-sm"
                      />
                    </div>

                    <div
                      className={`absolute left-4 top-6 z-10 h-3 w-3 -translate-x-1/2 rounded-full ring-4 sm:left-1/2 ${accent.dot}`}
                    />
                  </motion.article>
                );
              })}
            </div>
          </div>
        </Section>

        <Section className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            {
              title: "1) Care-Bundle Clustering",
              body: "Facilities are grouped into meaningful tiers based on service breadth and support patterns, so complexity can be matched quickly.",
              cls: "border-sky-200 text-sky-700",
            },
            {
              title: "2) Explainable Ranking",
              body: "A bounded scoring model (`0..100`) combines clinical fit, logistics, and access signals with transparent weights.",
              cls: "border-indigo-200 text-indigo-700",
            },
            {
              title: "3) Workflow Speed",
              body: "GPS-assisted ZIP defaults, filtered top results, map + detail panel, and call/intake actions reduce search-to-outreach time.",
              cls: "border-emerald-200 text-emerald-700",
            },
          ].map((card) => (
            <motion.article
              key={card.title}
              whileHover={{ y: -6, scale: 1.01 }}
              className={`rounded-2xl border bg-white p-5 shadow-sm ${card.cls}`}
            >
              <h3 className="mb-2 text-lg font-semibold">{card.title}</h3>
              <p className="text-sm text-slate-600">{card.body}</p>
            </motion.article>
          ))}
        </Section>

        <Section className="mt-10 rounded-2xl border border-violet-200 bg-white p-7 shadow-sm">
          <h2 className="mb-3 text-2xl font-semibold text-violet-700">What We Are Building</h2>
          <p className="text-sm leading-6 text-slate-600">
            A practical behavioral health access intelligence layer: not just a directory, but a
            triage-aware system that helps users answer,{" "}
            <span className="font-semibold text-slate-800">
              “Who should we call first for this specific patient?”
            </span>
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-sky-100 px-3 py-1 text-sky-700">SAMHSA-based</span>
            <span className="rounded-full bg-indigo-100 px-3 py-1 text-indigo-700">Tier-aware</span>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">Explainable scores</span>
            <span className="rounded-full bg-violet-100 px-3 py-1 text-violet-700">Map + detail workflow</span>
            <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">Human-in-the-loop AI rerank</span>
          </div>
        </Section>

        <Section className="mt-10 rounded-2xl border border-emerald-200 bg-white p-7 shadow-sm">
          <h2 className="mb-3 text-2xl font-semibold text-emerald-700">How Users Experience It</h2>
          <div className="grid gap-3 text-sm text-slate-600 md:grid-cols-2">
            <p>1. Location is auto-detected and ZIP is prefilled for relevance.</p>
            <p>2. Filters narrow results by care, setting, population, emergency, and tier.</p>
            <p>3. Top 150 results are shown with map pins and explainable scores.</p>
            <p>4. Teams open details and call intake lines directly from one panel.</p>
          </div>
        </Section>

        <Section className="mt-10 rounded-2xl border border-amber-200 bg-white p-7 shadow-sm">
          <h2 className="mb-3 text-2xl font-semibold text-amber-700">Why This Is Better</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-4">
              <p className="text-sm font-semibold text-amber-800">Less Guesswork</p>
              <p className="mt-1 text-sm text-slate-600">Structured ranking instead of random calling sequences.</p>
            </div>
            <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-4">
              <p className="text-sm font-semibold text-amber-800">Faster Outreach</p>
              <p className="mt-1 text-sm text-slate-600">Call/intake/map actions reduce handoff time under pressure.</p>
            </div>
            <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-4">
              <p className="text-sm font-semibold text-amber-800">Transparent Logic</p>
              <p className="mt-1 text-sm text-slate-600">Every score is bounded and documented with visible criteria.</p>
            </div>
          </div>
        </Section>

        <Section className="mt-10 rounded-2xl border border-indigo-200 bg-white p-8 text-center shadow-sm">
          <h3 className="text-2xl font-semibold text-indigo-700">Ready to Explore Live Facilities?</h3>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-600">
            Jump into the navigator to test filters, map behavior, and complexity-aware ranking in real time.
          </p>
          <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.98 }} className="mt-6 inline-block">
            <Link
              prefetch
              href="/navigator"
              className="rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 px-6 py-3 font-medium text-white"
            >
              Launch Navigator
            </Link>
          </motion.div>
        </Section>

        <Section className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <h3 className="mb-2 text-lg font-semibold text-slate-800">Important Note</h3>
          <p className="text-sm text-slate-600">
            This is a navigation and prioritization tool, not a booking or availability guarantee.
            Teams should always confirm acceptance, capacity, and current intake status directly with
            each facility.
          </p>
        </Section>
      </div>
    </main>
  );
}
