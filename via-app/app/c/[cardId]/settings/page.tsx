import { redirect } from "next/navigation";

export default function SettingsIndex({
  params,
}: {
  params: { cardId: string };
}) {
  redirect(`/c/${params.cardId}/settings/profile`);
}