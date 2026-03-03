"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function SetupRedirect() {
  const router = useRouter();
  const { cardId } = useParams<{ cardId: string }>();

  useEffect(() => {
    if (!cardId) return;
    router.replace(`/setup/${cardId}/edit/personal?next=links`);
  }, [cardId, router]);

  return null;
}