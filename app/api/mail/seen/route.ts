import { markMailSeen } from "@/app/lib/mail/unread";

export const maxDuration = 60;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { messageId?: string } | null;
  const messageId = body?.messageId?.trim() ?? "";
  if (!messageId) return Response.json({ ok: false }, { status: 400 });
  await markMailSeen(messageId);
  return Response.json({ ok: true });
}
