"use client";

import axios from "axios";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { ProjectCreationFlow } from "@/components/project-creation-flow";
import { api } from "@/lib/api";

type Project = { id: string; name: string };

async function fetchProjects(): Promise<Project[]> {
  try {
    const { data } = await api.get("/projects");
    return data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return [];
    }

    throw error;
  }
}

export default function ProjectsPage() {
  const { data, isLoading, error } = useQuery<Project[], Error>({
    queryKey: ["projects"],
    queryFn: fetchProjects,
  });

  if (isLoading) return <main className="p-8">Loading projects…</main>;
  if (error)
    return (
      <main className="p-6">
        <div className="mx-auto max-w-2xl rounded-xl border border-red-200 bg-red-50 p-6 text-red-800">
          <h2 className="text-lg font-semibold">Não foi possível carregar os projetos</h2>
          <p className="mt-2 text-sm">
            Ocorreu um erro inesperado ao buscar seus projetos. Tente novamente mais tarde.
          </p>
        </div>
      </main>
    );

  if (!data || data.length === 0)
    return (
      <main className="bg-slate-50 px-4 py-8">
        <ProjectCreationFlow />
      </main>
    );

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
