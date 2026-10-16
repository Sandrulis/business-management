import { redirect } from "next/navigation";

export default function FormerUnpaidPage() {
  redirect("/incoming_invoices/unpaid");
}
