export type InviteEmailInput = {
  to: string;
  inviteUrl: string;
  role: "Owner" | "Admin" | "Member" | "Guest";
  invitedByEmail: string;
  name?: string;
  workspaceName?: string;
};

export type InviteEmailResult = {
  sent: boolean;
  provider: "resend" | "none";
  error?: string;
};

function buildInviteHtml(input: InviteEmailInput) {
  const greeting = input.name ? `Hi ${input.name},` : "Hi,";
  const workspaceLabel = input.workspaceName ? ` for ${input.workspaceName}` : "";

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">
      <p>${greeting}</p>
      <p>${input.invitedByEmail} invited you as <strong>${input.role}</strong>${workspaceLabel}.</p>
      <p>
        <a href="${input.inviteUrl}" style="display:inline-block;padding:10px 14px;border-radius:8px;background:#0f172a;color:#fff;text-decoration:none;">
          Accept invite
        </a>
      </p>
      <p style="font-size:12px;color:#555;">If button does not work, open this URL:</p>
      <p style="font-size:12px;color:#555;word-break:break-all;">${input.inviteUrl}</p>
    </div>
  `;
}

export async function sendInviteEmail(input: InviteEmailInput): Promise<InviteEmailResult> {
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.INVITE_FROM_EMAIL;

  if (!resendApiKey || !fromEmail) {
    return { sent: false, provider: "none", error: "Email provider not configured" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [input.to],
        subject: "You are invited to ScopeBoard",
        html: buildInviteHtml(input),
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        sent: false,
        provider: "resend",
        error: `Resend error: ${response.status} ${text}`,
      };
    }

    return { sent: true, provider: "resend" };
  } catch (error) {
    return {
      sent: false,
      provider: "resend",
      error: error instanceof Error ? error.message : "Unknown email error",
    };
  }
}
