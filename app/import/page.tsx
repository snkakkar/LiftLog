"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ImportProgram } from "@/lib/import/types";
import { Upload, Loader2, Check } from "lucide-react";

export default function ImportPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportProgram | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [programName, setProgramName] = useState("");

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setError(null);
    setLoading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const res = await fetch("/api/parse", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Parse failed");
      }
      const data: ImportProgram = await res.json();
      setPreview(data);
      setProgramName(data.name || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!preview) return;
    setSaving(true);
    setError(null);
    try {
      const payload = { ...preview, name: programName.trim() || preview.name };
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Import failed");
      }
      const { programId } = await res.json();
      router.push(`/program/${programId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function clearPreview() {
    setPreview(null);
    setFile(null);
    setProgramName("");
    setError(null);
  }

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Import program</h1>
        <p className="text-muted-foreground mt-1">
          Upload any Excel or CSV with your program. We support table layouts (e.g. Exercise, Reps, Weight, Week, Day) and Min-Max style (Week N, day labels). Include a header row when possible.
        </p>
      </div>

      {!preview ? (
        <Card>
          <CardHeader>
            <CardTitle>Upload Excel</CardTitle>
            <CardDescription>
              Use a header row with columns like Exercise, Reps, Weight, (optional) Week, Day, RIR, or use Min-Max style with &quot;Week 1&quot;, day names (Upper, Lower, etc.), and exercise rows.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <Label htmlFor="file">File</Label>
                <Input
                  id="file"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="mt-2"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <Button type="submit" disabled={!file || loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Parsing…
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Parse & preview
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Preview</CardTitle>
              <CardDescription>
                Review the program below. Edit the name if needed, then save.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="name">Program name</Label>
                <Input
                  id="name"
                  value={programName}
                  onChange={(e) => setProgramName(e.target.value)}
                  className="mt-2"
                  placeholder="Program name"
                />
              </div>

              <div className="rounded-lg border border-border bg-muted/20 overflow-hidden">
                <div className="bg-muted/50 px-4 py-3 border-b border-border">
                  <h3 className="font-semibold text-lg">
                    {preview.name || programName || "Unnamed"}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {preview.weeks.length} week{preview.weeks.length === 1 ? "" : "s"}
                    {" · "}
                    {(preview.weeks as { days: unknown[] }[]).reduce(
                      (acc, w) => acc + (w.days?.length ?? 0),
                      0
                    )}{" "}
                    workout days
                  </p>
                </div>
                <div className="divide-y divide-border max-h-[50vh] overflow-y-auto">
                  {preview.weeks.map((w, wi) => (
                    <div key={`week-${wi}-${w.weekNumber}`} className="p-4">
                      <h4 className="text-sm font-semibold text-primary mb-3">
                        Week {w.weekNumber}
                      </h4>
                      <div className="space-y-4">
                        {w.days.map((d, di) => (
                          <div
                            key={`day-${wi}-${di}-${d.dayNumber}`}
                            className="rounded-md border border-border bg-background p-3"
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                Day {d.dayNumber}
                              </span>
                              {d.name && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                                  {d.name}
                                </span>
                              )}
                            </div>
                            <ul className="space-y-1.5">
                              {d.exercises.map((e, idx) => (
                                <li
                                  key={idx}
                                  className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm"
                                >
                                  <span className="font-medium">{e.name}</span>
                                  {e.sets.length > 0 && (
                                    <span className="text-muted-foreground text-xs">
                                      {e.sets.some((s) => s.reps != null || s.weight != null || s.rir != null)
                                        ? e.sets
                                            .map((s) => {
                                              const parts: string[] = [];
                                              if (s.reps != null) parts.push(`${s.reps}r`);
                                              if (s.weight != null) parts.push(`${s.weight}lb`);
                                              if (s.rir != null) parts.push(`RIR${s.rir}`);
                                              return parts.length ? parts.join(" ") : "—";
                                            })
                                            .join(" · ")
                                        : `${e.sets.length} set${e.sets.length === 1 ? "" : "s"}`
                                      }
                                    </span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Save program
                    </>
                  )}
                </Button>
                <Button type="button" variant="outline" onClick={clearPreview}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
