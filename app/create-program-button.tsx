"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FileEdit } from "lucide-react";

export function CreateProgramButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New program" }),
      });
      if (!res.ok) throw new Error("Failed to create program");
      const program = await res.json();
      router.push(`/program/${program.id}`);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  return (
    <Button variant="outline" onClick={handleCreate} disabled={loading}>
      <FileEdit className="h-4 w-4" />
      {loading ? "Creating…" : "Create program"}
    </Button>
  );
}
