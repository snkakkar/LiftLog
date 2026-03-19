"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ChevronDown } from "lucide-react";

const INCHES_PER_CM = 1 / 2.54;
const CM_PER_INCH = 2.54;

function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const totalInches = cm * INCHES_PER_CM;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches - feet * 12);
  return { feet, inches };
}

function feetInchesToCm(feet: number, inches: number): number {
  return (feet * 12 + inches) * CM_PER_INCH;
}

type ProfileState = { heightCm: number | null; age: number | null; gender: string | null };
type DailyLogEntry = { id: string; date: string; weightLb: number | null; bodyFatPct: number | null };
type AccountState = { name: string | null; email: string };

const GENDER_OPTIONS = [
  { value: "", label: "—" },
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];

export function AccountMenu() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);

  if (status === "loading") return null;
  if (!session?.user) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/login">Sign in</Link>
        </Button>
        <Button size="sm" asChild>
          <Link href="/signup">Sign up</Link>
        </Button>
      </div>
    );
  }

  const displayLabel = session.user.name ?? session.user.email ?? "Account";
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground font-normal gap-1"
        >
          <span className="truncate max-w-[140px]">{displayLabel}</span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Account</DialogTitle>
        </DialogHeader>
        <AccountPanel onSignOut={() => signOut({ callbackUrl: "/login" })} />
      </DialogContent>
    </Dialog>
  );
}

function AccountPanel({ onSignOut }: { onSignOut: () => void }) {
  const [account, setAccount] = useState<AccountState | null>(null);
  const [profile, setProfile] = useState<ProfileState | null>(null);
  const [dailyLogs, setDailyLogs] = useState<DailyLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [accRes, profRes, logsRes] = await Promise.all([
        fetch("/api/account"),
        fetch("/api/profile"),
        fetch("/api/profile/daily-log"),
      ]);
      if (accRes.ok) setAccount(await accRes.json());
      if (profRes.ok) setProfile(await profRes.json());
      if (logsRes.ok) setDailyLogs(await logsRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Tabs defaultValue="user" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="user">User details</TabsTrigger>
        <TabsTrigger value="profile">Profile</TabsTrigger>
        <TabsTrigger value="daily">Daily log</TabsTrigger>
      </TabsList>
      <TabsContent value="user" className="mt-4">
        <UserDetailsSection
          account={account}
          onAccountUpdate={async () => {
            const r = await fetch("/api/account");
            if (r.ok) setAccount(await r.json());
          }}
        />
      </TabsContent>
      <TabsContent value="profile" className="mt-4">
        <ProfileSection initialProfile={profile} />
      </TabsContent>
      <TabsContent value="daily" className="mt-4">
        <DailyLogSection initialLogs={dailyLogs} />
      </TabsContent>
      <div className="mt-6 pt-4 border-t border-border">
        <Button variant="ghost" className="w-full text-muted-foreground hover:text-destructive" onClick={onSignOut}>
          Sign out
        </Button>
      </div>
    </Tabs>
  );
}

function UserDetailsSection({ account, onAccountUpdate }: { account: AccountState | null; onAccountUpdate: () => void | Promise<void> }) {
  const [name, setName] = useState(account?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    setName(account?.name ?? "");
  }, [account?.name]);

  const handleSaveName = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || null }),
      });
      if (res.ok) await onAccountUpdate();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || newPassword.length < 8) return;
    setChangingPassword(true);
    setPasswordMessage(null);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPasswordMessage({ type: "error", text: data.error ?? "Failed to change password" });
        return;
      }
      setPasswordMessage({ type: "success", text: "Password updated. Use your new password next time you sign in." });
      setCurrentPassword("");
      setNewPassword("");
    } catch (e) {
      setPasswordMessage({ type: "error", text: "Request failed" });
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>User details</CardTitle>
          <CardDescription>Your name, email, and password settings.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="account-name">Name</Label>
            <div className="flex gap-2 mt-1">
              <Input
                id="account-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="flex-1"
              />
              <Button onClick={handleSaveName} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
            </div>
          </div>
          <div>
            <Label>Email</Label>
            <p className="text-sm text-muted-foreground mt-1">{account?.email ?? "—"}</p>
          </div>
          <div className="pt-2 border-t border-border">
            <p className="text-sm font-medium mb-2">Change password</p>
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Current password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
              <Input
                type="password"
                placeholder="New password (min 8 chars)"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <Button onClick={handleChangePassword} disabled={changingPassword || !currentPassword || newPassword.length < 8}>
                {changingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : "Change password"}
              </Button>
            </div>
            {passwordMessage && (
              <p className={`text-sm mt-2 ${passwordMessage.type === "success" ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
                {passwordMessage.text}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ProfileSection({ initialProfile }: { initialProfile: ProfileState | null }) {
  const [profile, setProfile] = useState<ProfileState>(initialProfile ?? { heightCm: null, age: null, gender: null });
  const [heightFeet, setHeightFeet] = useState("");
  const [heightInches, setHeightInches] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile.heightCm != null) {
      const { feet, inches } = cmToFeetInches(profile.heightCm);
      setHeightFeet(String(feet));
      setHeightInches(String(inches));
    } else {
      setHeightFeet("");
      setHeightInches("");
    }
  }, [profile.heightCm]);

  const handleSave = async () => {
    const heightCm =
      heightFeet !== "" && heightInches !== ""
        ? feetInchesToCm(parseInt(heightFeet, 10) || 0, parseFloat(heightInches) || 0)
        : null;
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ heightCm, age: profile.age ?? null, gender: profile.gender || null }),
      });
      if (res.ok) setProfile((p) => ({ ...p, heightCm }));
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your stats</CardTitle>
        <CardDescription>Height, age, gender for contextual summaries.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 items-end">
          <div>
            <Label htmlFor="height-ft">Height (ft)</Label>
            <Input id="height-ft" type="number" min={0} max={8} placeholder="5" value={heightFeet} onChange={(e) => setHeightFeet(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="height-in">(in)</Label>
            <Input id="height-in" type="number" min={0} max={11.9} step={0.5} placeholder="8" value={heightInches} onChange={(e) => setHeightInches(e.target.value)} />
          </div>
        </div>
        <div>
          <Label htmlFor="age">Age</Label>
          <Input id="age" type="number" min={0} value={profile.age ?? ""} onChange={(e) => setProfile((p) => ({ ...p, age: e.target.value ? parseInt(e.target.value, 10) : null }))} />
        </div>
        <div>
          <Label htmlFor="gender">Gender</Label>
          <select
            id="gender"
            value={(profile.gender ?? "").toLowerCase() === "female" ? "female" : (profile.gender ?? "").toLowerCase() === "male" ? "male" : ""}
            onChange={(e) => setProfile((p) => ({ ...p, gender: e.target.value || null }))}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {GENDER_OPTIONS.map((opt) => (
              <option key={opt.value || "blank"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
        </Button>
      </CardContent>
    </Card>
  );
}

function DailyLogSection({ initialLogs }: { initialLogs: DailyLogEntry[] }) {
  const [dailyLogs, setDailyLogs] = useState(initialLogs);
  const [saving, setSaving] = useState(false);
  const [logDate, setLogDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [logWeight, setLogWeight] = useState("");
  const [logBodyFat, setLogBodyFat] = useState("");

  useEffect(() => {
    setDailyLogs(initialLogs);
  }, [initialLogs]);

  const handleAdd = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/profile/daily-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: new Date(logDate).toISOString(),
          weightLb: logWeight === "" ? null : parseFloat(logWeight),
          bodyFatPct: logBodyFat === "" ? null : parseFloat(logBodyFat),
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      const created = await res.json();
      const createdDay = created.date.slice(0, 10);
      setDailyLogs((prev) => [created, ...prev.filter((l) => (l.date as string).slice(0, 10) !== createdDay)]);
      setLogWeight("");
      setLogBodyFat("");
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily log</CardTitle>
        <CardDescription>Log weight and body fat % to track over time.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <Label className="text-xs">Date</Label>
            <Input type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Weight (lb)</Label>
            <Input type="number" min={0} step={0.1} placeholder="—" value={logWeight} onChange={(e) => setLogWeight(e.target.value)} className="mt-1 w-24" />
          </div>
          <div>
            <Label className="text-xs">Body fat %</Label>
            <Input type="number" min={0} max={100} step={0.1} placeholder="—" value={logBodyFat} onChange={(e) => setLogBodyFat(e.target.value)} className="mt-1 w-24" />
          </div>
          <Button onClick={handleAdd} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
          </Button>
        </div>
        <ul className="border rounded-lg divide-y divide-border max-h-48 overflow-y-auto">
          {dailyLogs.map((log) => (
            <li key={log.id} className="px-3 py-2 flex justify-between text-sm">
              <span className="text-muted-foreground">
                {new Date(log.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
              </span>
              <span>
                {log.weightLb != null && `${log.weightLb} lb`}
                {log.weightLb != null && log.bodyFatPct != null && " · "}
                {log.bodyFatPct != null && `${log.bodyFatPct}% body fat`}
                {log.weightLb == null && log.bodyFatPct == null && "—"}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
