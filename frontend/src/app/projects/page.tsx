"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Link from "next/link";

type Project = { id: string; name: string };

async function fetchProjects(): Promise<Project[]> {
  const { data } = await api.get("/projects");
  return data;
}

export default function ProjectsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
  });

  if (isLoading) return <main className="p-8">Loading projects…</main>;
  if (error) return <main className="p-8">Failed to load projects.</main>;

  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold mb-4">Projects</h1>
      <ul className="space-y-2">
        {data?.map((p) => (
          <li key={p.id}>
            <Link className="underline" href={`/projects/${p.id}`}>{p.name}</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
