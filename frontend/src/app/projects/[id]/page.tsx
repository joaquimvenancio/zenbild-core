import ProjectClient from "./project-client";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProjectClient id={id} />;
}
