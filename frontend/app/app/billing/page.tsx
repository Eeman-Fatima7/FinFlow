import { redirect } from "next/navigation";

export default function AppBillingRedirectPage() {
  redirect("/dashboard/billing");
}
