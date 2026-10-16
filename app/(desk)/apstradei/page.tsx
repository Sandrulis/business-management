import { redirect } from "next/navigation";

export default function FormerProcessingPage() {
  redirect("/incoming_invoices/processing");
}
