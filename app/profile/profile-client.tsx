"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";

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

const GENDER_OPTIONS = [
  { value: "", label: "—" },
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];

export function ProfileClient({
  initialProfile,
  initialDailyLogs,
}: {
  initialProfile: ProfileState | null;
  initialDailyLogs: DailyLogEntry[];
}) {
  const [profile, setProfile] = useState<ProfileState>(initialProfile ?? { heightCm: null, age: null, gender: null });
  const [heightFeet, setHeightFeet] = useState<string>("");
  const [heightInches, setHeightInches] = useState<string>("");
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
  const [dailyLogs, setDailyLogs] = useState<DailyLogEntry[]>(initialDailyLogs);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingLog, setSavingLog] = useState(false);
  const [logDate, setLogDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [logWeight, setLogWeight] = useState("");
  const [logBodyFat, setLogBodyFat] = useState("");

  const handleSaveProfile = async () => {
    const heightCm =
      heightFeet !== "" && heightInches !== ""
        ? feetInchesToCm(parseInt(heightFeet, 10) || 0, parseFloat(heightInches) || 0)
        : null;
    setSavingProfile(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          heightCm,
          age: profile.age ?? null,
          gender: profile.gender || null,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      setProfile((p) => ({ ...p, heightCm }));
    } catch (e) {
      console.error(e);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAddDailyLog = async () => {
    setSavingLog(true);
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
      setSavingLog(false);
    }
  };

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

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
    <Tabs defaultValue="profile" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="profile">Profile</TabsTrigger>
        <TabsTrigger value="daily">Daily log</TabsTrigger>
        <TabsTrigger value="password">Password</TabsTrigger>
      </TabsList>
      <TabsContent value="profile" className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle>Your stats</CardTitle>
            <CardDescription>Used for contextual summaries (height, age, gender).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2 items-end">
              <div>
                <Label htmlFor="height-ft">Height (ft)</Label>
                <Input
                  id="height-ft"
                  type="number"
                  min={0}
                  max={8}
                  placeholder="5"
                  value={heightFeet}
                  onChange={(e) => setHeightFeet(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="height-in">(in)</Label>
                <Input
                  id="height-in"
                  type="number"
                  min={0}
                  max={11.9}
                  step={0.5}
                  placeholder="8"
                  value={heightInches}
                  onChange={(e) => setHeightInches(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="age">Age</Label>
              <Input
                id="age"
                type="number"
                min={0}
                value={profile.age ?? ""}
                onChange={(e) => setProfile((p) => ({ ...p, age: e.target.value ? parseInt(e.target.value, 10) : null }))}
              />
            </div>
            <div>
              <Label htmlFor="gender">Gender</Label>
              <select
                id="gender"
                value={
                  (profile.gender ?? "").toLowerCase() === "female"
                    ? "female"
                    : (profile.gender ?? "").toLowerCase() === "male"
                      ? "male"
                      : ""
                }
                onChange={(e) => setProfile((p) => ({ ...p, gender: e.target.value || null }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {GENDER_OPTIONS.map((opt) => (
                  <option key={opt.value || "blank"} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <Button onClick={handleSaveProfile} disabled={savingProfile}>
              {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="daily" className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle>Daily log</CardTitle>
            <CardDescription>Log weight (lb) and body fat % to track over time.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2 items-end">
              <div>
                <Label className="text-xs">Date</Label>
                <Input
                  type="date"
                  value={logDate}
                  onChange={(e) => setLogDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Weight (lb)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.1}
                  placeholder="—"
                  value={logWeight}
                  onChange={(e) => setLogWeight(e.target.value)}
                  className="mt-1 w-24"
                />
              </div>
              <div>
                <Label className="text-xs">Body fat %</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  placeholder="—"
                  value={logBodyFat}
                  onChange={(e) => setLogBodyFat(e.target.value)}
                  className="mt-1 w-24"
                />
              </div>
              <Button onClick={handleAddDailyLog} disabled={savingLog}>
                {savingLog ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
              </Button>
            </div>
            <ul className="border rounded-lg divide-y divide-border max-h-64 overflow-y-auto">
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
      </TabsContent>
      <TabsContent value="password" className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle>Change password</CardTitle>
            <CardDescription>Update your password. You will need to sign in again with the new password.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="current-password">Current password</Label>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="new-password">New password (min 8 chars)</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1"
              />
            </div>
            <Button onClick={handleChangePassword} disabled={changingPassword || !currentPassword || newPassword.length < 8}>
              {changingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : "Change password"}
            </Button>
            {passwordMessage && (
              <p className={`text-sm ${passwordMessage.type === "success" ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
                {passwordMessage.text}
              </p>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
