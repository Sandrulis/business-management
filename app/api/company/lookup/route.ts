import { lookupRegisteredCompany } from "@/app/lib/company/lookup-register";

export const maxDuration = 20;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { registrationNumber?: string } | null;
  const registrationNumber = body?.registrationNumber ?? "";
  if (!/^\d{11}$/.test(registrationNumber.replace(/\D/g, ""))) {
    return Response.json({ found: false });
  }

  try {
    const company = await lookupRegisteredCompany(registrationNumber);
    if (!company) return Response.json({ found: false });
    return Response.json({ found: true, ...company });
  } catch {
    return Response.json({ found: false, message: "Uzņēmuma datus neizdevās ielasīt." }, { status: 502 });
  }
}
