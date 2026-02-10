"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { Contact, Invoice, Project } from "@/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { InvoiceStatusBadge } from "@/components/common/StatusBadge";
import { formatMoney, formatDate } from "@/lib/format";
import { hasPermission } from "@/lib/rbac";
import { useRole } from "@/lib/useRole";
import { DisableIfNoPermission, Can } from "@/components/common/PermissionGate";
import { MaskIfNoPermission } from "@/components/common/MaskIfNoPermission";
import { Badge } from "@/components/ui/badge";
import { ActivityTimeline } from "@/components/common/ActivityTimeline";
import { useActivity } from "@/lib/activityStore";
import { useLocalData } from "@/lib/localDataStore";
import { api } from "@/lib/api";

export function InvoiceDetail({
  invoice,
  contact,
  project,
  isOwner,
  autoExportPdf,
}: {
  invoice: Invoice;
  contact?: Contact;
  project?: Project;
  isOwner: boolean;
  autoExportPdf?: boolean;
}) {
  const safeLineItems = invoice.lineItems ?? [];
  const safePayments = invoice.payments ?? [];
  const [payments, setPayments] = useState(safePayments);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("bank transfer");
  const [note, setNote] = useState("");
  const [archived, setArchived] = useState(invoice.archived);
  const role = useRole();
  const { addActivity } = useActivity();
  const { setInvoices } = useLocalData();
  const contactName = contact?.company || contact?.name || "Client";
  const contactEmail = contact?.email || "";
  const whatsappNumber = (contact?.whatsapp || contact?.phone || "").replace(/\D/g, "");
  const [orgName, setOrgName] = useState("Flowlane");
  const [logoUrl, setLogoUrl] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [templateLoaded, setTemplateLoaded] = useState(false);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [didAutoExport, setDidAutoExport] = useState(false);

  const total = useMemo(
    () => safeLineItems.reduce((acc, item) => acc + item.qty * item.rate, 0),
    [safeLineItems],
  );

  const paid = payments.reduce((acc, payment) => acc + payment.amount, 0);
  const balance = total - paid;
  const lastPayment = payments[0];
  const paymentCount = payments.length;

  useEffect(() => {
    setPayments(safePayments);
  }, [safePayments]);

  useEffect(() => {
    if (!isOwner) return;
    fetch("/api/admin/settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data?.success || !data?.data) return;
        setOrgName(data.data.orgName || "Flowlane");
        setLogoUrl(data.data.logoUrl || "");
      })
      .catch(() => undefined);
  }, [isOwner]);

  useEffect(() => {
    fetch("/api/users/me/template")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data?.success || !data?.data) return;
        if (data.data.template && !templateLoaded) {
          setCustomMessage(data.data.template);
        }
        setTemplateLoaded(true);
      })
      .catch(() => undefined);
  }, [templateLoaded]);

  function buildMessage() {
    const due = formatDate(invoice.dueDate);
    if (isOwner) {
      return `Invoice ${invoice.invoiceNo} is due on ${due}. Total ${formatMoney(
        total,
        invoice.currency,
      )}.`;
    }
    return `Invoice ${invoice.invoiceNo} is due on ${due}.`;
  }

  function renderTemplate(template: string) {
    const safeTotal = hasPermission(role, "invoices:view_amounts")
      ? formatMoney(total, invoice.currency)
      : "amount hidden";
    return template
      .replaceAll("{invoiceNo}", invoice.invoiceNo)
      .replaceAll("{dueDate}", formatDate(invoice.dueDate))
      .replaceAll("{client}", contactName)
      .replaceAll("{project}", project?.title ?? "Project")
      .replaceAll("{total}", safeTotal);
  }

  function getMessage() {
    if (isOwner && customMessage.trim()) return customMessage.trim();
    return buildMessage();
  }

  const previewMessage =
    isOwner && customMessage.trim()
      ? renderTemplate(customMessage.trim())
      : getMessage();

  function handleEmail() {
    if (!contactEmail) {
      toast.error("No client email on file.");
      return;
    }
    const subject = `Invoice ${invoice.invoiceNo}`;
    const body = isOwner && customMessage.trim()
      ? renderTemplate(customMessage.trim())
      : getMessage();
    window.open(
      `mailto:${encodeURIComponent(contactEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
      "_blank",
    );
  }

  function handleWhatsApp() {
    if (!whatsappNumber) {
      toast.error("No WhatsApp number on file.");
      return;
    }
    const body = isOwner && customMessage.trim()
      ? renderTemplate(customMessage.trim())
      : getMessage();
    window.open(
      `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(body)}`,
      "_blank",
    );
  }

  async function handlePdfExport() {
    if (!hasPermission(role, "invoices:view_amounts")) {
      toast.error("Only the owner can export invoices.");
      return;
    }
    const lineItemsHtml = safeLineItems
      .map(
        (item) => `
          <tr>
            <td>${item.title}</td>
            <td style="text-align:right;">${item.qty} x ${formatMoney(
          item.rate,
          invoice.currency,
        )}</td>
            <td style="text-align:right;">${formatMoney(
          item.qty * item.rate,
          invoice.currency,
        )}</td>
          </tr>
        `,
      )
      .join("");

    const paymentsHtml = payments
      .map(
        (payment) => `
          <tr>
            <td>${formatDate(payment.paidAt)}</td>
            <td>${payment.method}</td>
            <td style="text-align:right;">${formatMoney(
          payment.amount,
          invoice.currency,
        )}</td>
            <td>${payment.note || "-"}</td>
          </tr>
        `,
      )
      .join("");

    const headerLogo = logoUrl
      ? `<img src="${logoUrl}" alt="${orgName}" style="height:32px; object-fit:contain; margin-right:12px;" />`
      : "";
    const html = `
      <div style="font-family: Arial, sans-serif; color:#111; padding:24px;">
        <div style="display:flex; align-items:center; justify-content:space-between;">
          <div style="display:flex; align-items:center; gap:12px;">
            ${headerLogo}
            <div>
              <div style="font-size:18px; font-weight:700;">${orgName}</div>
              <div style="font-size:12px; color:#666;">Invoice ${invoice.invoiceNo}</div>
            </div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:12px; color:#666;">Issued ${formatDate(invoice.issueDate)}</div>
            <div style="font-size:12px; color:#666;">Due ${formatDate(invoice.dueDate)}</div>
          </div>
        </div>
        <div style="margin-top:12px; font-size:12px; color:#444;">${contactName} - ${project?.title || "Project"
      }</div>
        <div style="margin-top:16px;">
          <div style="font-size:13px; font-weight:600; margin-bottom:8px;">Line items</div>
          <table style="width:100%; border-collapse:collapse; font-size:12px;">
            <thead>
              <tr>
                <th style="text-align:left; border-bottom:1px solid #ddd; padding:6px 4px;">Item</th>
                <th style="text-align:right; border-bottom:1px solid #ddd; padding:6px 4px;">Qty x Rate</th>
                <th style="text-align:right; border-bottom:1px solid #ddd; padding:6px 4px;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${lineItemsHtml}
              <tr>
                <td colspan="2" style="text-align:right; font-weight:700; padding:8px 4px;">Total</td>
                <td style="text-align:right; font-weight:700; padding:8px 4px;">${formatMoney(
        total,
        invoice.currency,
      )}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div style="margin-top:16px;">
          <div style="font-size:13px; font-weight:600; margin-bottom:8px;">Payments</div>
          <table style="width:100%; border-collapse:collapse; font-size:12px;">
            <thead>
              <tr>
                <th style="text-align:left; border-bottom:1px solid #ddd; padding:6px 4px;">Date</th>
                <th style="text-align:left; border-bottom:1px solid #ddd; padding:6px 4px;">Method</th>
                <th style="text-align:right; border-bottom:1px solid #ddd; padding:6px 4px;">Amount</th>
                <th style="text-align:left; border-bottom:1px solid #ddd; padding:6px 4px;">Note</th>
              </tr>
            </thead>
            <tbody>
              ${paymentsHtml || "<tr><td colspan='4'>No payments yet.</td></tr>"}
            </tbody>
          </table>
        </div>
      </div>
    `;

    const wrapper = document.createElement("div");
    wrapper.innerHTML = html;
    wrapper.style.position = "fixed";
    wrapper.style.left = "-10000px";
    wrapper.style.top = "0";
    wrapper.style.width = "800px";
    document.body.appendChild(wrapper);

    const module = await import("html2pdf.js");
    const html2pdf = (module as any).default ?? module;
    await html2pdf()
      .set({
        margin: [12, 12, 12, 12],
        filename: `invoice-${invoice.invoiceNo}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      })
      .from(wrapper)
      .save();

    document.body.removeChild(wrapper);
  }

  async function addPayment() {
    if (!hasPermission(role, "invoices:mark_paid")) {
      toast.error("Only the owner can do this.");
      return;
    }
    const value = Number(amount);
    if (!value || value <= 0) {
      toast.error("Enter a valid payment amount.");
      return;
    }
    const newPayment = {
      amount: value,
      method,
      paidAt: new Date().toISOString().slice(0, 10),
      note,
    };
    try {
      const updated = await api.updateInvoice(invoice.id, {
        status: "paid",
        payments: [...payments, newPayment],
      });
      setPayments(updated.payments);
      setInvoices((prev) =>
        prev.map((inv) => (inv.id === invoice.id ? updated : inv)),
      );
      setAmount("");
      setNote("");
      toast.success("Payment recorded.");
      addActivity({
        entityType: "invoice",
        entityId: invoice.id,
        action: "Invoice marked paid",
        meta: `${value} recorded`,
      });
    } catch {
      toast.error("Unable to record payment.");
    }
  }

  useEffect(() => {
    if (!autoExportPdf || didAutoExport) return;
    if (!hasPermission(role, "invoices:view_amounts")) return;
    setDidAutoExport(true);
    const timer = window.setTimeout(() => {
      handlePdfExport();
    }, 300);
    return () => window.clearTimeout(timer);
  }, [autoExportPdf, didAutoExport, role]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Invoice</p>
          <h1 className="text-2xl font-semibold">{invoice.invoiceNo}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>
              {contactName} - {project?.title ?? "Project"}
            </span>
            {archived && <Badge variant="secondary">Archived</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <DisableIfNoPermission permission="invoices:archive">
            <Button
              variant="outline"
              onClick={() => {
                const next = !archived;
                api
                  .updateInvoice(invoice.id, { archived: next })
                  .then((updated) => {
                    setArchived(next);
                    setInvoices((prev) =>
                      prev.map((inv) => (inv.id === invoice.id ? updated : inv)),
                    );
                    toast.success(next ? "Archived." : "Restored.");
                    addActivity({
                      entityType: "invoice",
                      entityId: invoice.id,
                      action: next ? "Invoice archived" : "Invoice restored",
                    });
                  })
                  .catch(() => toast.error("Unable to update invoice."));
              }}
            >
              {archived ? "Restore" : "Archive"}
            </Button>
          </DisableIfNoPermission>
          <Button variant="outline" onClick={handleEmail}>
            Email
          </Button>
          <Button variant="outline" onClick={handleWhatsApp}>
            WhatsApp
          </Button>
          <Can permission="invoices:view_amounts">
            <Button variant="outline" onClick={handlePdfExport}>
              Export PDF
            </Button>
          </Can>
          <Can permission="invoices:delete">
            <Button
              variant="destructive"
              onClick={() => {
                api
                  .deleteInvoice(invoice.id)
                  .then(() => {
                    setInvoices((prev) => prev.filter((inv) => inv.id !== invoice.id));
                    toast.success("Deleted.");
                  })
                  .catch(() => toast.error("Unable to delete invoice."));
              }}
            >
              Delete
            </Button>
          </Can>
          <InvoiceStatusBadge status={invoice.status} />
        </div>
      </div>

      {isOwner ? (
        <>
          <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <Card className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Line items</p>
                <span className="text-xs text-muted-foreground">
                  Issued {formatDate(invoice.issueDate)}
                </span>
              </div>
              <div className="space-y-3">
                {safeLineItems.map((item, index) => (
                  <div key={`${item.title}-${index}`} className="flex justify-between text-sm">
                    <span>
                      {item.title} - {item.qty} x {formatMoney(item.rate, invoice.currency)}
                    </span>
                    <span>{formatMoney(item.qty * item.rate, invoice.currency)}</span>
                  </div>
                ))}
                <div className="border-t pt-3 text-sm">
                  <div className="flex justify-between">
                    <span>Total</span>
                    <span className="font-semibold">
                      {formatMoney(total, invoice.currency)}
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-6 space-y-4">
              <div>
                <p className="text-sm font-semibold">Balance</p>
                <p className="text-2xl font-semibold">
                  {formatMoney(balance, invoice.currency)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Due {formatDate(invoice.dueDate)}
                </p>
              </div>
              <div className="space-y-2">
                <Input
                  placeholder="Payment amount"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  disabled={!hasPermission(role, "invoices:mark_paid")}
                />
                <Input
                  placeholder="Method"
                  value={method}
                  onChange={(event) => setMethod(event.target.value)}
                  disabled={!hasPermission(role, "invoices:mark_paid")}
                />
                <Input
                  placeholder="Note (optional)"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  disabled={!hasPermission(role, "invoices:mark_paid")}
                />
                <DisableIfNoPermission permission="invoices:mark_paid">
                  <Button onClick={addPayment}>Record payment</Button>
                </DisableIfNoPermission>
              </div>
            </Card>
          </div>

          <Card className="p-6 space-y-3">
            <p className="text-sm font-semibold">Client message</p>
            <p className="text-xs text-muted-foreground">
              Use placeholders: {"{invoiceNo}"} {"{dueDate}"} {"{client}"} {"{project}"} {"{total}"}
            </p>
            <Textarea
              value={customMessage}
              onChange={(event) => setCustomMessage(event.target.value)}
              placeholder={buildMessage()}
              rows={4}
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {isOwner ? "Owner template" : "Your template"}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPreview((prev) => !prev)}
                >
                  {showPreview ? "Hide preview" : "Preview"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={templateSaving}
                  onClick={async () => {
                    setTemplateSaving(true);
                    try {
                      await api.saveEmailTemplate(customMessage);
                      toast.success("Template saved.");
                    } catch (error: any) {
                      toast.error(error?.message ?? "Unable to save template.");
                    } finally {
                      setTemplateSaving(false);
                    }
                  }}
                >
                  {templateSaving ? "Saving..." : "Save template"}
                </Button>
              </div>
            </div>
            {showPreview ? (
              <div className="rounded-lg border bg-muted/40 p-3 text-sm text-foreground whitespace-pre-wrap">
                {previewMessage}
              </div>
            ) : null}
          </Card>

          <Card className="p-6 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Payments log</p>
                <p className="text-xs text-muted-foreground">
                  {paymentCount} payments - Paid {formatMoney(paid, invoice.currency)} - Balance{" "}
                  {formatMoney(balance, invoice.currency)}
                </p>
              </div>
              {lastPayment ? (
                <span className="text-xs text-muted-foreground">
                  Last payment {formatDate(lastPayment.paidAt)}
                </span>
              ) : null}
            </div>
            {payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {payments.map((payment, index) => (
                  <div
                    key={`${payment.paidAt}-${index}`}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background p-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">
                        {formatMoney(payment.amount, invoice.currency)} - {payment.method}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(payment.paidAt)}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {payment.note || "-"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <div className="space-y-3">
            <p className="text-sm font-semibold">Activity</p>
            <ActivityTimeline entityType="invoice" entityId={invoice.id} />
          </div>
        </>
      ) : (
        <Card className="p-6 space-y-3">
          <p className="text-sm font-semibold">Invoice details</p>
          <div className="grid gap-2 text-sm text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Invoice number</span>
              <span className="text-foreground">{invoice.invoiceNo}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Status</span>
              <span className="text-foreground">{invoice.status}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Due date</span>
              <span className="text-foreground">{formatDate(invoice.dueDate)}</span>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
