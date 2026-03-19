"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Users, UserPlus } from "lucide-react";

export function AdminDashboard() {
  const [userCount, setUserCount] = useState<number | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [createEmail, setCreateEmail] = useState("");
  const [createName, setCreateName] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [createResult, setCreateResult] = useState<{
    success: boolean;
    message?: string;
    email?: string;
    tempPassword?: string;
  } | null>(null);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then((data) => {
        if (typeof data.userCount === "number") setUserCount(data.userCount);
      })
      .catch(() => {})
      .finally(() => setLoadingStats(false));
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateResult(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: createEmail.trim().toLowerCase(),
          name: createName.trim() || undefined,
          password: createPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateResult({ success: false, message: data.error ?? "Failed to create user" });
        return;
      }
      setCreateResult({
        success: true,
        message: "User created. Share the temp password with them.",
        email: data.email,
        tempPassword: data.tempPassword,
      });
      setCreateEmail("");
      setCreateName("");
      setCreatePassword("");
      setUserCount((c) => (c != null ? c + 1 : 1));
    } catch (e) {
      setCreateResult({ success: false, message: "Request failed" });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Platform stats
          </CardTitle>
          <CardDescription>Total registered users</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingStats ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : (
            <p className="text-3xl font-bold">{userCount ?? "—"}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Create account
          </CardTitle>
          <CardDescription>
            Create a new user with a temporary password. Share the password with them—they should change it after first login.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div>
              <Label htmlFor="create-email">Email</Label>
              <Input
                id="create-email"
                type="email"
                required
                placeholder="user@example.com"
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="create-name">Name (optional)</Label>
              <Input
                id="create-name"
                type="text"
                placeholder="Jane Doe"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="create-password">Temporary password (min 8 chars)</Label>
              <Input
                id="create-password"
                type="text"
                required
                minLength={8}
                placeholder="TempPass123"
                value={createPassword}
                onChange={(e) => setCreatePassword(e.target.value)}
                className="mt-1"
              />
            </div>
            <Button type="submit" disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create user"}
            </Button>
          </form>
          {createResult && (
            <div
              className={`mt-4 p-3 rounded-lg text-sm ${
                createResult.success ? "bg-green-500/10 text-green-700 dark:text-green-400" : "bg-destructive/10 text-destructive"
              }`}
            >
              {createResult.success ? (
                <p>
                  <strong>Created:</strong> {createResult.email}
                  <br />
                  <strong>Temp password:</strong> {createResult.tempPassword}
                  <br />
                  <span className="text-muted-foreground">{createResult.message}</span>
                </p>
              ) : (
                <p>{createResult.message}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
