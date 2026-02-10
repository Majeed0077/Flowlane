import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section id="home" className="mx-auto w-full max-w-6xl px-6 py-16">
      <div className="grid gap-10 md:grid-cols-[1.1fr_0.9fr] md:items-center">
        <div className="space-y-6">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Flowlane CRM
          </p>
          <h1 className="text-4xl font-semibold leading-tight md:text-5xl">
            The internal agency CRM that replaces Notion + Trello.
          </h1>
          <p className="text-base text-muted-foreground">
            Built for today-first execution: capture leads fast, run your pipeline,
            and keep projects and invoices aligned without clutter.
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
        <div className="relative rounded-2xl border bg-card p-6 shadow-soft glass">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-muted/30 via-transparent to-muted/10" />
          <div className="relative z-10 space-y-4">
            <div className="rounded-xl border bg-background/80 px-4 py-3 text-sm">
              What should I do next?
            </div>
            <div className="rounded-xl border bg-background/80 px-4 py-3 text-sm text-muted-foreground">
              Follow up with Aether Capital (due today)
            </div>
            <div className="rounded-xl border bg-background/80 px-4 py-3 text-sm text-muted-foreground">
              Milestone: MVP handoff for Vanta Labs (due in 3 days)
            </div>
            <div className="rounded-xl border bg-background/80 px-4 py-3 text-sm text-muted-foreground">
              Quick Add: Capture new lead in under 20 seconds
            </div>
            <div className="relative h-40 overflow-hidden rounded-xl border bg-background/60">
              <Image
                src="/landing/hero-ui.svg"
                alt="Flowlane hero preview"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 40vw"
                priority
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
