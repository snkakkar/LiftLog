import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth";

export async function GET() {
  const userId = await requireUserId();
  const logs = await prisma.bodyMetricLog.findMany({
    where: { userId },
    orderBy: { date: "desc" },
    take: 365,
  });
  return NextResponse.json(logs);
}

export async function POST(request: NextRequest) {
  const userId = await requireUserId();
  const body = await request.json();
  const dateStr = body.date;
  if (!dateStr) {
    return NextResponse.json({ error: "date required (ISO string)" }, { status: 400 });
  }
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }
  date.setHours(0, 0, 0, 0);
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);
  const weightLb = body.weightLb != null ? Number(body.weightLb) : null;
  const bodyFatPct = body.bodyFatPct != null ? Number(body.bodyFatPct) : null;

  const existing = await prisma.bodyMetricLog.findFirst({
    where: { userId, date: { gte: date, lt: nextDay } },
  });
  const log = existing
    ? await prisma.bodyMetricLog.update({
        where: { id: existing.id },
        data: { weightLb: weightLb ?? undefined, bodyFatPct: bodyFatPct ?? undefined },
      })
    : await prisma.bodyMetricLog.create({
        data: { userId, date, weightLb, bodyFatPct },
      });
  return NextResponse.json(log);
}
