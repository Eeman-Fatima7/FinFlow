import { redirect } from "next/navigation";

export default function AppSummaryRedirectPage() {
  redirect("/dashboard/summary");
}
