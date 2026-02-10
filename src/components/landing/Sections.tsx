import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const features = [
  {
    title: "Today-first workflow",
    description: "Start every day with a clear, prioritized list of follow-ups and milestones.",
  },
  {
    title: "Pipeline clarity",
    description: "Move leads through stages without losing context or next actions.",
  },
  {
    title: "Client continuity",
    description: "Keep notes, links, and invoices tied to each contact and project.",
  },
  {
    title: "Fast capture",
    description: "Add a lead in under 20 seconds with required next follow-up.",
  },
  {
    title: "Owner-only finance",
    description: "Strict separation for revenue, receivables, and payments.",
  },
  {
    title: "Lightweight by design",
    description: "No clutter, no noise—just what an agency needs daily.",
  },
];

export function LandingSections() {
  return (
    <main>
      <section id="home" className="mx-auto w-full max-w-6xl px-6 py-16">
        <div className="grid gap-10 md:grid-cols-[1.1fr_0.9fr] md:items-center">
          <div className="space-y-6">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Flowlane CRM</p>
            <h1 className="text-4xl font-semibold leading-tight md:text-5xl">
              The internal agency CRM that replaces Notion + Trello.
            </h1>
            <p className="text-base text-muted-foreground">
              Built for daily execution. Capture leads fast, follow up on time, and keep every
              project moving without clutter.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/signup">
                <Button>Get started</Button>
              </Link>
              <Link href="/signin">
                <Button variant="outline">Sign in</Button>
              </Link>
            </div>
          </div>
          <div className="rounded-2xl border bg-card p-6 shadow-soft glass">
            <p className="text-sm font-medium">What should I do next?</p>
            <div className="mt-4 space-y-3 text-sm text-muted-foreground">
              <div className="rounded-lg border bg-background px-4 py-3">
                Follow up with Aether Capital (due today)
              </div>
              <div className="rounded-lg border bg-background px-4 py-3">
                Milestone: MVP handoff for Vanta Labs (due in 3 days)
              </div>
              <div className="rounded-lg border bg-background px-4 py-3">
                Prepare proposal for Flux Design Co.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="services" className="mx-auto w-full max-w-6xl px-6 py-12">
        <div className="flex items-center justify-between gap-6">
          <h2 className="text-2xl font-semibold">Services & features</h2>
          <Link href="/signup" className="text-sm text-muted-foreground hover:text-foreground">
            Start with Flowlane →
          </Link>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {features.map((feature) => (
            <Card key={feature.title} className="glass">
              <CardHeader>
                <CardTitle className="text-base">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {feature.description}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="about" className="mx-auto w-full max-w-6xl px-6 py-12">
        <div className="rounded-2xl border bg-card p-8">
          <h2 className="text-2xl font-semibold">About Flowlane</h2>
          <p className="mt-4 text-sm text-muted-foreground">
            Flowlane is designed for boutique agencies that need a calm, repeatable daily
            workflow. No heavy analytics. No noisy dashboards. Just a clear path from capture to
            follow-up to close.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Built for founders, PMs, designers, and operators who need focus—fast.
          </p>
        </div>
      </section>

      <footer className="mx-auto w-full max-w-6xl px-6 py-10 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>© 2026 Flowlane. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <Link href="#home">Home</Link>
            <Link href="#services">Services</Link>
            <Link href="#about">About</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
