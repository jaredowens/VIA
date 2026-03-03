import CustomizeClient from "@/components/CustomizeClient";

export default async function CustomizePage({
  params,
}: {
  params: Promise<{ cardId: string }>;
}) {
  const { cardId } = await params;
  return <CustomizeClient cardId={cardId} />;
}