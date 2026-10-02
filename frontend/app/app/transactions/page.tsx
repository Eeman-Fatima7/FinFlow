import { redirect } from "next/navigation";

export default function AppTransactionsRedirectPage() {
  redirect("/dashboard/transactions");
}
