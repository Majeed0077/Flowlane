import Link from "next/link";
import { Button } from "@/components/ui/button";

export function Cta() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-card px-6 py-8">
        <div>
          <h3 className="text-xl font-semibold">Start with Flowlane today</h3>
          <p className="text-sm text-muted-foreground">
            Give your agency a clear, repeatable daily workflow.
          </p>
        </div>
        <Link href="/signup">
          <Button>Get started</Button>
        </Link>
      </div>
    </section>
  );
}
