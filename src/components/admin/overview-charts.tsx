import { Line, LineChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

type WeeklyPoint = { weekStart: string; count: number };
type TopCourse = { title: string; count: number };

function formatWeekLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const signupsConfig: ChartConfig = { count: { label: "New employees", color: "var(--primary)" } };
const certsConfig: ChartConfig = { count: { label: "Certificates issued", color: "var(--gold)" } };
const coursesConfig: ChartConfig = { count: { label: "Completions", color: "var(--primary)" } };

function TrendCard({
  title,
  data,
  config,
  color,
}: {
  title: string;
  data: WeeklyPoint[];
  config: ChartConfig;
  color: string;
}) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <span className="text-xs text-muted-foreground">last 12 weeks · {total} total</span>
      </div>
      {total === 0 ? (
        <p className="mt-8 pb-8 text-center text-sm text-muted-foreground">No activity yet.</p>
      ) : (
        <ChartContainer config={config} className="mt-3 aspect-auto h-48 w-full">
          <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="weekStart"
              tickFormatter={formatWeekLabel}
              tickLine={false}
              axisLine={false}
              minTickGap={24}
            />
            <YAxis tickLine={false} axisLine={false} width={28} allowDecimals={false} />
            <ChartTooltip
              content={<ChartTooltipContent labelFormatter={(v) => formatWeekLabel(String(v))} />}
            />
            <Line
              type="monotone"
              dataKey="count"
              stroke={color}
              strokeWidth={2}
              dot={{ r: 3, fill: color, strokeWidth: 0 }}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ChartContainer>
      )}
    </div>
  );
}

function TopCoursesCard({ data }: { data: TopCourse[] }) {
  const rows = [...data].sort((a, b) => a.count - b.count); // ascending so the biggest bar ends up on top
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card lg:col-span-2">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          Most-completed courses (last 12 weeks)
        </h3>
      </div>
      {rows.length === 0 ? (
        <p className="mt-8 pb-8 text-center text-sm text-muted-foreground">
          No lesson completions recorded yet.
        </p>
      ) : (
        <ChartContainer
          config={coursesConfig}
          className="mt-3 aspect-auto w-full"
          style={{ height: Math.max(160, rows.length * 36) }}
        >
          <BarChart
            data={rows}
            layout="vertical"
            margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
          >
            <CartesianGrid horizontal={false} strokeDasharray="3 3" />
            <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} />
            <YAxis
              type="category"
              dataKey="title"
              tickLine={false}
              axisLine={false}
              width={160}
              tick={{ fontSize: 12 }}
              tickFormatter={(v: string) => (v.length > 22 ? `${v.slice(0, 21)}…` : v)}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="count" fill="var(--primary)" radius={[0, 4, 4, 0]} maxBarSize={18} />
          </BarChart>
        </ChartContainer>
      )}
    </div>
  );
}

export function OverviewCharts({
  signups,
  certificates,
  topCourses,
}: {
  signups: WeeklyPoint[];
  certificates: WeeklyPoint[];
  topCourses: TopCourse[];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <TrendCard
        title="New employees"
        data={signups}
        config={signupsConfig}
        color="var(--primary)"
      />
      <TrendCard
        title="Certificates issued"
        data={certificates}
        config={certsConfig}
        color="var(--gold)"
      />
      <TopCoursesCard data={topCourses} />
    </div>
  );
}
