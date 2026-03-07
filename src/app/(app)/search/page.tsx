import { apiFetch } from "@/lib/apiClient";
import type { Contact, Project, Invoice } from "@/types";

type SearchResult = {
  contacts: Contact[];
  projects: Project[];
  invoices: Invoice[];
  milestones: { id: string; title: string; projectId: string }[];
};

async function getResults(query: string) {
  if (!query) return { contacts: [], projects: [], invoices: [], milestones: [] };
  const data = await apiFetch<{ success: boolean; data: SearchResult }>(
    `/api/search?q=${encodeURIComponent(query)}`,
  );
  return data.data ?? { contacts: [], projects: [], invoices: [], milestones: [] };
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const query = searchParams.q ?? "";
  const { contacts, projects, invoices, milestones } = await getResults(query);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Search</h1>
        <p className="text-sm text-muted-foreground">Results for "{query || "..."}"</p>
      </div>

      <div className="grid gap-6">
        <section className="rounded-xl border bg-card p-5">
          <h2 className="text-sm font-semibold">Contacts</h2>
          <div className="mt-3 grid gap-2 text-sm">
            {contacts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No matching contacts.</p>
            ) : (
              contacts.map((contact) => (
                <a key={contact.id} href={`/contacts/${contact.id}`} className="hover:underline">
                  {contact.name} - {contact.company}
                </a>
              ))
            )}
          </div>
        </section>

        <section className="rounded-xl border bg-card p-5">
          <h2 className="text-sm font-semibold">Projects</h2>
          <div className="mt-3 grid gap-2 text-sm">
            {projects.length === 0 ? (
              <p className="text-sm text-muted-foreground">No matching projects.</p>
            ) : (
              projects.map((project) => (
                <a key={project.id} href={`/projects/${project.id}`} className="hover:underline">
                  {project.title}
                </a>
              ))
            )}
          </div>
        </section>

        <section className="rounded-xl border bg-card p-5">
          <h2 className="text-sm font-semibold">Milestones</h2>
          <div className="mt-3 grid gap-2 text-sm">
            {milestones.length === 0 ? (
              <p className="text-sm text-muted-foreground">No matching milestones.</p>
            ) : (
              milestones.map((milestone) => (
                <a key={milestone.id} href={`/projects/${milestone.projectId}`} className="hover:underline">
                  {milestone.title}
                </a>
              ))
            )}
          </div>
        </section>

        <section className="rounded-xl border bg-card p-5">
          <h2 className="text-sm font-semibold">Invoices</h2>
          <div className="mt-3 grid gap-2 text-sm">
            {invoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">No matching invoices.</p>
            ) : (
              invoices.map((invoice) => (
                <a key={invoice.id} href={`/invoices/${invoice.id}`} className="hover:underline">
                  {invoice.invoiceNo}
                </a>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
