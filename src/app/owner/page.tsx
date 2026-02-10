import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function OwnerPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  if (user.role !== "owner") redirect("/editor");

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Owner Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Manage everything across Flowlane.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary">owner</Badge>
          <Link href="/today">
            <Button variant="outline">Go to Today</Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Link className="rounded-xl border bg-card p-4 hover:bg-muted/30" href="/today">
          Today
        </Link>
        <Link className="rounded-xl border bg-card p-4 hover:bg-muted/30" href="/crm">
          Pipeline
        </Link>
        <Link className="rounded-xl border bg-card p-4 hover:bg-muted/30" href="/contacts">
          Contacts
        </Link>
        <Link className="rounded-xl border bg-card p-4 hover:bg-muted/30" href="/projects">
          Projects
        </Link>
        <Link className="rounded-xl border bg-card p-4 hover:bg-muted/30" href="/invoices">
          Invoices
        </Link>
      </div>
    </div>
  );
}
