"use client";
import { useState } from "react";
import { api } from "@/lib/api";

export default function UploadToS3({ projectId }: { projectId: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string>("");

  async function handleUpload() {
    if (!file) return;
    setStatus("Requesting presigned URL…");
    const { data } = await api.post("/uploads/presign", {
      projectId,
      filename: file.name,
      contentType: file.type || "application/octet-stream",
    });
    const presignedUrl: string = data.url;

    setStatus("Uploading…");
    const res = await fetch(presignedUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });

    setStatus(res.ok ? "Uploaded successfully" : "Upload failed");
  }

  return (
    <div className="space-y-2">
      <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      <button className="px-3 py-1 border rounded" onClick={handleUpload} disabled={!file}>
        Upload
      </button>
      {status && <div className="text-sm text-gray-600">{status}</div>}
    </div>
  );
}
