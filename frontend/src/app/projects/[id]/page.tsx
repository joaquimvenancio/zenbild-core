"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { notFound } from "next/navigation";
import UploadToS3 from "./upload";

type KPI = { label: string; value: string | number };
type TimelineItem = { date: string; text: string };
type ProjectDetail = { id: string; name: string; kpis: KPI[]; timeline: TimelineItem[] };

type PageParams = { params: { id: string } };


async function fetchProject(id: string): Promise<ProjectDetail | null> {
  const { data } = await api.get(`/projects/${id}`);
  return data ?? null;
}

export default function Page({ params }: PageParams) {
  const { data, isLoading } = useQuery({
    queryKey: ["project", params.id],
    queryFn: () => fetchProject(params.id),
  });

  if (isLoading) return <main className="p-8">Loading…</main>;
  if (!data) return notFound();

  return (
    <main className="p-8 space-y-8">
      <h1 className="text-2xl font-semibold">{data.name}</h1>

      <section>
        <h2 className="text-xl font-semibold mb-2">KPIs</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {data.kpis.map((k) => (
            <div key={k.label} className="border p-4 rounded-lg">
              <div className="text-sm text-gray-600">{k.label}</div>
              <div className="text-xl font-bold">{k.value}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">Timeline</h2>
        <ul className="space-y-2">
          {data.timeline.map((t, idx) => (
            <li key={idx} className="text-sm">
              <span className="font-mono text-gray-600 mr-2">{t.date}</span>
              {t.text}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">Upload</h2>
        <UploadToS3 projectId={data.id} />
      </section>
    </main>
  );
}