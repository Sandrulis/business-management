import { fetchUnreadMail } from "@/app/lib/mail/unread";

export const maxDuration = 60;

export async function POST() {
  const result = await fetchUnreadMail();
  if (!result.ok) return Response.json({ message: result.message }, { status: result.status });
  return Response.json({ message: result.message, items: result.items, updated: result.updated });
}
