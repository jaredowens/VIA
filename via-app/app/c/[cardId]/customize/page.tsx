
"use client";

import { useParams } from "next/navigation";
import OwnerGate from "@/components/OwnerGate";
import CustomizeClient from "@/components/CustomizeClient";
import CardShell from "@/components/CardShell";

export default function CustomizePage() {
  const { cardId } = useParams<{ cardId: string }>();
  const cid = (cardId ?? "").trim().toUpperCase();
  if (!cid) return null;

  return (
    <OwnerGate cardId={cid}>
      <CardShell cardId={cid}>
        <CustomizeClient cardId={cid} />
      </CardShell>
    </OwnerGate>
  );
}