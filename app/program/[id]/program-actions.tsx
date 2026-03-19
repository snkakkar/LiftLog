"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, Pencil, Trash2, Loader2, Copy, Archive } from "lucide-react";

type ProgramActionsProps = {
  programId: string;
  programName: string;
  isArchived?: boolean;
};

export function ProgramActions({ programId, programName, isArchived = false }: ProgramActionsProps) {
  const router = useRouter();
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [name, setName] = useState(programName);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [duplicating, setDuplicating] = useState(false);

  useEffect(() => {
    setName(programName);
  }, [programName]);

  const handleRename = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/programs/${programId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) throw new Error("Rename failed");
      setRenameOpen(false);
      router.refresh();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async () => {
    setDuplicating(true);
    try {
      const res = await fetch(`/api/programs/${programId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Duplicate failed");
      const { programId: newId } = await res.json();
      router.push(`/program/${newId}`);
      router.refresh();
    } catch (e) {
      console.error(e);
    } finally {
      setDuplicating(false);
    }
  };

  const handleArchive = async () => {
    try {
      const res = await fetch(`/api/programs/${programId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archive: true }),
      });
      if (!res.ok) throw new Error("Archive failed");
      router.push("/");
      router.refresh();
    } catch (e) {
      console.error(e);
    }
  };

  const handleUnarchive = async () => {
    try {
      const res = await fetch(`/api/programs/${programId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archive: false }),
      });
      if (!res.ok) throw new Error("Unarchive failed");
      router.refresh();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/programs/${programId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setDeleteOpen(false);
      router.push("/");
      router.refresh();
    } catch (e) {
      console.error(e);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" className="w-fit -ml-2" asChild>
          <Link href="/">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to programs
          </Link>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setName(programName);
            setRenameOpen(true);
          }}
        >
          <Pencil className="h-4 w-4 mr-1" />
          Rename
        </Button>
        <Button variant="outline" size="sm" onClick={handleDuplicate} disabled={duplicating}>
          {duplicating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
          Duplicate
        </Button>
        {isArchived ? (
          <Button variant="outline" size="sm" onClick={handleUnarchive}>
            Unarchive
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={handleArchive}>
            <Archive className="h-4 w-4 mr-1" />
            Archive
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="h-4 w-4 mr-1" />
          Delete
        </Button>
      </div>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename program</DialogTitle>
            <DialogDescription>Enter a new name for this program.</DialogDescription>
          </DialogHeader>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Program name"
            onKeyDown={(e) => e.key === "Enter" && handleRename()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRename} disabled={saving || !name.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete program</DialogTitle>
            <DialogDescription>
              Delete &quot;{programName}&quot;? This will remove all weeks, days, exercises, and
              logged data. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
