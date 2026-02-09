"use client";

import { TodayView } from "@/components/today/TodayView";
import { useLocalData } from "@/lib/localDataStore";
import { formatDateShort } from "@/lib/format";
import { addDays, isAfter, isBefore, isSameDay, parseISO } from "date-fns";

export function TodayClient() {
  const { contacts, milestones, invoices, projects } = useLocalData();
  const today = new Date();

  const followUps = contacts
    .filter((contact) => {
      const due = parseISO(contact.nextFollowUpAt);
      return isBefore(due, today) || isSameDay(due, today);
    })
    .map((contact) => ({
      id: `followup-${contact.id}`,
      type: "followup" as const,
      title: `Follow-up: ${contact.name}`,
      meta: `${contact.company} · Due ${formatDateShort(contact.nextFollowUpAt)}`,
      dueAt: contact.nextFollowUpAt,
      href: `/contacts/${contact.id}`,
      entityType: "contact" as const,
      entityId: contact.id,
      whatsapp: contact.whatsapp,
    }));

  const milestoneItems = milestones
    .filter((milestone) => {
      if (!milestone.dueDate) return false;
      const due = parseISO(milestone.dueDate);
      return (
        isBefore(due, today) ||
        isSameDay(due, today) ||
        (isAfter(due, today) && isBefore(due, addDays(today, 7)))
      );
    })
    .map((milestone) => {
      const project = projects.find((item) => item.id === milestone.projectId);
      return {
        id: `milestone-${milestone.id}`,
        type: "milestone" as const,
        title: milestone.title,
        meta: `${project?.title ?? "Project"} · Due ${formatDateShort(milestone.dueDate)}`,
        dueAt: milestone.dueDate,
        href: `/projects/${milestone.projectId}`,
        entityType: "milestone" as const,
        entityId: milestone.id,
        waitingClient: milestone.status === "waiting_client",
      };
    });

  const invoiceItems = invoices
    .filter((invoice) => invoice.status === "overdue")
    .map((invoice) => {
      const contact = contacts.find((item) => item.id === invoice.contactId);
      return {
        id: `invoice-${invoice.id}`,
        type: "invoice" as const,
        title: `Overdue invoice ${invoice.invoiceNo}`,
        meta: `${contact?.company ?? "Client"} · Due ${formatDateShort(invoice.dueDate)}`,
        dueAt: invoice.dueDate,
        href: `/invoices/${invoice.id}`,
        entityType: "invoice" as const,
        entityId: invoice.id,
      };
    });

  const items = [...followUps, ...milestoneItems, ...invoiceItems];

  return <TodayView initialItems={items} />;
}
