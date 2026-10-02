import { redirect } from "next/navigation";

export default function AppBudgetRedirectPage() {
  redirect("/dashboard/budget");
}
