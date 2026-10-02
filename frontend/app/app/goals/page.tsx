import { redirect } from "next/navigation";

export default function AppGoalsRedirectPage() {
  redirect("/dashboard/goals");
}
