"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function OwnerGate({
  cardId,
  children,
}: {
  cardId: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const res = await fetch(
          `/api/card-is-owner?cardId=${encodeURIComponent(cardId)}`,
          { cache: "no-store" }
        );

        if (!res.ok) {
          router.replace(`/c/${cardId}`);
          return;
        }

        const data = await res.json();

        if (!cancelled) {
          if (!data.isOwner) {
            router.replace(`/c/${cardId}`);
            return;
          }

          setIsOwner(true);
          setLoading(false);
        }
      } catch {
        router.replace(`/c/${cardId}`);
      }
    }

    check();

    return () => {
      cancelled = true;
    };
  }, [cardId, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-white/50">
        Checking permissions…
      </div>
    );
  }

  if (!isOwner) return null;

  return <>{children}</>;
}