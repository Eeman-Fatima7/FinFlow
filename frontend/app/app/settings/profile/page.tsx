import { redirect } from "next/navigation";

export default function AppSettingsProfileRedirectPage() {
  redirect("/dashboard/profile");
}
