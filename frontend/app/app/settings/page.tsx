import { redirect } from "next/navigation";

export default function AppSettingsRedirectPage() {
  redirect("/dashboard/settings/account");
}
