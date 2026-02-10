import Image from "next/image";

export function About() {
  return (
    <section id="about" className="mx-auto w-full max-w-6xl px-6 py-12">
      <div className="grid gap-8 md:grid-cols-[1.1fr_0.9fr] md:items-center">
        <div>
          <h2 className="text-2xl font-semibold">About Flowlane</h2>
          <p className="mt-4 text-sm text-muted-foreground">
            Flowlane is built for boutique agencies that need a calm, repeatable workflow.
            Capture leads quickly, prioritize today, and keep every project moving without
            noisy dashboards.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            It is built for founders, PMs, designers, and operators who want speed and
            clarity over complexity.
          </p>
        </div>
        <div className="relative min-h-[220px] overflow-hidden rounded-2xl border bg-card">
          <Image
            src="/landing/about-ui.svg"
            alt="Flowlane about preview"
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 40vw"
          />
        </div>
      </div>
    </section>
  );
}
