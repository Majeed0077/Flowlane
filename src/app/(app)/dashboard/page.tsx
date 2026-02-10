"use client";

import { useMemo } from "react";
import { formatMoney, formatDateShort, isDueToday, isOverdue } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { parseISO, isAfter, addDays, isSameMonth } from "date-fns";
import { StatCard } from "@/components/dashboard/StatCard";
import { FocusList, type FocusItem } from "@/components/dashboard/FocusList";
import { useLocalData } from "@/lib/localDataStore";
import { useRole } from "@/lib/useRole";

export default function DashboardPage() {
  const role = useRole();
  const isOwner = role === "owner";
  const { contacts, invoices, projects, milestones } = useLocalData();
  const today = new Date();

  const followUpsToday = useMemo(
    () => contacts.filter((contact) => isDueToday(contact.nextFollowUpAt, today)).length,
    [contacts, today],
  );

  const overdueFollowUps = useMemo(
    () => contacts.filter((contact) => isOverdue(contact.nextFollowUpAt, today)).length,
    [contacts, today],
  );

  const receivablesTotal = useMemo(() => {
    if (!isOwner) return null;
    return invoices
      .filter((invoice) => invoice.status !== "paid")
      .reduce(
        (acc, invoice) =>
          acc +
          invoice.lineItems.reduce(
            (subtotal, item) => subtotal + item.qty * item.rate,
            0,
          ),
        0,
      );
  }, [invoices, isOwner]);

  const thisMonthRevenue = useMemo(() => {
    if (!isOwner) return null;
    return invoices
      .flatMap((invoice) => invoice.payments)
      .filter((payment) => isSameMonth(parseISO(payment.paidAt), today))
      .reduce((acc, payment) => acc + payment.amount, 0);
  }, [invoices, isOwner, today]);

  const overdueTotal = useMemo(() => {
    if (!isOwner) return null;
    return invoices
      .filter((invoice) => invoice.status === "overdue")
      .reduce(
        (acc, invoice) =>
          acc +
          invoice.lineItems.reduce(
            (subtotal, item) => subtotal + item.qty * item.rate,
            0,
          ),
        0,
      );
  }, [invoices, isOwner]);

  const focusItems = useMemo<FocusItem[]>(() => {
    return [
      ...contacts
        .filter((contact) => isOverdue(contact.nextFollowUpAt, today))
        .map((contact) => ({
          id: `followup-${contact.id}`,
          title: `Overdue follow-up: ${contact.name}`,
          meta: `${contact.company} - Due ${formatDateShort(contact.nextFollowUpAt)}`,
          type: "Follow-up" as const,
          dueAt: contact.nextFollowUpAt,
          href: `/contacts/${contact.id}`,
          entityType: "contact" as const,
          entityId: contact.id,
        })),
      ...milestones
        .filter((milestone) => {
          const due = parseISO(milestone.dueDate);
          return isAfter(due, today) && isAfter(addDays(today, 7), due);
        })
        .map((milestone) => {
          const project = projects.find((item) => item.id === milestone.projectId);
          return {
            id: `milestone-${milestone.id}`,
            title: `Milestone due: ${milestone.title}`,
            meta: `${project?.title ?? "Project"} - Due ${formatDateShort(
              milestone.dueDate,
            )}`,
            type: "Milestone" as const,
            dueAt: milestone.dueDate,
            href: `/projects/${milestone.projectId}`,
            entityType: "milestone" as const,
            entityId: milestone.id,
          };
        }),
      ...invoices
        .filter((invoice) => invoice.status === "overdue")
        .map((invoice) => {
          const contact = contacts.find((item) => item.id === invoice.contactId);
          return {
            id: `invoice-${invoice.id}`,
            title: `Overdue invoice ${invoice.invoiceNo}`,
            meta: `${contact?.company ?? "Client"} - Due ${formatDateShort(
              invoice.dueDate,
            )}`,
            type: "Invoice" as const,
            dueAt: invoice.dueDate,
            href: `/invoices/${invoice.id}`,
            entityType: "invoice" as const,
            entityId: invoice.id,
          };
        }),
    ];
  }, [contacts, invoices, milestones, projects, today]);

  const milestonesDueSoon = useMemo(
    () =>
      milestones.filter((milestone) => {
        const due = parseISO(milestone.dueDate);
        return isAfter(due, today) && isAfter(addDays(today, 7), due);
      }).length,
    [milestones, today],
  );

  const waitingOnClient = useMemo(
    () => milestones.filter((milestone) => milestone.status === "waiting_client").length,
    [milestones],
  );

  const projectCounts = useMemo(() => {
    const active = projects.filter((project) => project.status === "active").length;
    const planning = projects.filter((project) => project.status === "planning").length;
    const onHold = projects.filter((project) => project.status === "on_hold").length;
    const completed = projects.filter((project) => project.status === "completed").length;
    return { active, planning, onHold, completed };
  }, [projects]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Welcome back. Here is your live pulse for today.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Follow-ups Today"
          value={followUpsToday}
          href="/contacts?filter=followupsToday"
        />
        <StatCard
          title="Overdue Follow-ups"
          value={overdueFollowUps}
          href="/contacts?filter=followupsOverdue"
        />
        {isOwner ? (
          <>
            <StatCard
              title="Receivables"
              value={formatMoney(receivablesTotal ?? 0, "USD")}
              href="/invoices?status=unpaid"
            />
            <StatCard
              title="This Month Revenue"
              value={formatMoney(thisMonthRevenue ?? 0, "USD")}
              href="/invoices?filter=thisMonthPaid"
            />
          </>
        ) : (
          <>
            <StatCard
              title="Milestones Due Soon"
              value={milestonesDueSoon}
              href="/projects"
            />
            <StatCard
              title="Waiting on Client"
              value={waitingOnClient}
              href="/crm"
            />
          </>
        )}
      </div>

      {isOwner ? (
        <Card className="glass">
          <CardHeader>
            <CardTitle>Revenue Summary</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Receivables</p>
              <p className="text-lg font-semibold">
                {formatMoney(receivablesTotal ?? 0, "USD")}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Overdue</p>
              <p className="text-lg font-semibold">
                {formatMoney(overdueTotal ?? 0, "USD")}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">This month paid</p>
              <p className="text-lg font-semibold">
                {formatMoney(thisMonthRevenue ?? 0, "USD")}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Project Pulse</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Planning</p>
            <p className="text-lg font-semibold">{projectCounts.planning}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Active</p>
            <p className="text-lg font-semibold">{projectCounts.active}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">On Hold</p>
            <p className="text-lg font-semibold">{projectCounts.onHold}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Completed</p>
            <p className="text-lg font-semibold">{projectCounts.completed}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>My Focus Today</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {focusItems.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Nothing urgent today. Review pipeline or plan next milestones.
            </div>
          ) : (
            <FocusList items={focusItems} maxItems={4} viewAllHref="/today" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
