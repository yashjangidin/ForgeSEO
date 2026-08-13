import { useEffect, useState, type ReactElement } from "react";
import { Link, useParams } from "react-router-dom";
import type { GenerationJob } from "@forgeseo/shared";
import { ENGINE_ORDER } from "@forgeseo/shared";
import { useMutation } from "@tanstack/react-query";
import { Upload } from "lucide-react";
import { continueGenerationWithImages } from "../services/api";
import { subscribeToJob } from "../services/jobs";

const fileToDataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
  reader.onerror = () => reject(new Error("Could not read uploaded image."));
  reader.readAsDataURL(file);
});

export const Pipeline = (): ReactElement => {
  const { jobId } = useParams();
  const [job, setJob] = useState<GenerationJob | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [uploads, setUploads] = useState<Record<string, { dataUrl: string; fileName: string }>>({});

  const continueMutation = useMutation({
    mutationFn: async () => {
      if (!jobId || !job?.imageRequirements?.length) {
        throw new Error("Missing image prompts.");
      }
      return continueGenerationWithImages(jobId, {
        imageInputs: job.imageRequirements.map((requirement) => {
          const upload = uploads[requirement.id];
          if (!upload) {
            throw new Error(`Upload an image for ${requirement.label}.`);
          }
          return {
            requirementId: requirement.id,
            dataUrl: upload.dataUrl,
            fileName: upload.fileName
          };
        })
      });
    }
  });

  useEffect(() => {
    if (!jobId) {
      setError("Missing job id.");
      return undefined;
    }
    return subscribeToJob(
      jobId,
      (nextJob) => {
        setJob(nextJob);
        setError(undefined);
      },
      (nextError) => {
        if (/database is closing|hidden|offline|indexeddb/i.test(nextError.message)) {
          return;
        }
        setError(nextError.message);
      }
    );
  }, [jobId]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-3xl font-semibold text-ink">Template Rendering Pipeline</h1>
      {error ? <p className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {!job && !error ? <p className="mt-4 text-slate-600">Waiting for job data from Firestore...</p> : null}
      {job ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
          <section className="rounded border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-wide text-slate-500">{job.status}</p>
                <h2 className="text-xl font-semibold">{job.currentEngine ?? "Queued"}</h2>
                <p className="mt-1 text-sm text-slate-600">{job.currentTask}</p>
              </div>
              <p className="text-3xl font-semibold text-ocean">{job.progress}%</p>
            </div>
            <div className="mt-5 h-3 overflow-hidden rounded bg-slate-100">
              <div className="h-full bg-mint" style={{ width: `${job.progress}%` }} />
            </div>
            <div className="mt-6 grid gap-2 sm:grid-cols-3">
              {ENGINE_ORDER.map((engine) => {
                const checkpoint = job.checkpoints.find((item) => item.engine === engine);
                return (
                  <div key={engine} className="rounded border border-slate-200 p-3">
                    <p className="text-sm font-medium">{engine}</p>
                    <p className="text-xs text-slate-500">{checkpoint?.status ?? "pending"}</p>
                  </div>
                );
              })}
            </div>
            {job.status === "waiting-for-images" && job.imageRequirements?.length ? (
              <div className="mt-6 grid gap-4 rounded border border-amber-200 bg-amber-50 p-4">
                <div>
                  <h3 className="font-semibold text-ink">Upload Images To Continue</h3>
                  <p className="mt-1 text-sm text-slate-600">Generate each image using the prompt, upload the matching file, then continue the same job.</p>
                </div>
                <div className="grid gap-3">
                  {job.imageRequirements.map((requirement) => (
                    <div key={requirement.id} className="grid gap-3 rounded border border-amber-200 bg-white p-3">
                      <div className="flex flex-col gap-1">
                        <p className="text-sm font-semibold text-ink">{requirement.label}</p>
                        <pre className="whitespace-pre-wrap rounded bg-slate-50 p-3 text-xs text-slate-700">{requirement.prompt}</pre>
                      </div>
                      <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-ocean hover:text-ocean">
                        <Upload className="h-4 w-4" />
                        {uploads[requirement.id]?.fileName ?? "Upload image"}
                        <input
                          className="sr-only"
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/svg+xml"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (!file) {
                              return;
                            }
                            void fileToDataUrl(file).then((dataUrl) => {
                              setUploads((current) => ({ ...current, [requirement.id]: { dataUrl, fileName: file.name } }));
                            }).catch((nextError: unknown) => {
                              setError(nextError instanceof Error ? nextError.message : "Could not read uploaded image.");
                            });
                          }}
                        />
                      </label>
                    </div>
                  ))}
                </div>
                <button
                  className="rounded bg-ocean px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
                  disabled={continueMutation.isPending || job.imageRequirements.some((requirement) => !uploads[requirement.id])}
                  onClick={() => continueMutation.mutate()}
                  type="button"
                >
                  {continueMutation.isPending ? "Continuing generation..." : "Continue Generation"}
                </button>
                {continueMutation.error ? <p className="text-sm text-red-700">{continueMutation.error.message}</p> : null}
              </div>
            ) : null}
            {job.status === "completed" && job.result ? (
              <div className="mt-6 flex gap-3">
                <Link className="rounded bg-ocean px-4 py-2 font-semibold text-white" to={`/preview/${job.id}`}>
                  Preview Website
                </Link>
                <a className="rounded border border-slate-300 px-4 py-2 font-semibold" href={job.result.zipUrl}>
                  Download ZIP
                </a>
              </div>
            ) : null}
          </section>
          <aside className="rounded border border-slate-200 bg-white p-5">
            <h2 className="font-semibold">Worker Logs</h2>
            <div className="mt-4 max-h-[560px] space-y-3 overflow-auto text-sm">
              {job.logs.map((log) => (
                <div key={`${log.timestamp}-${log.engine}-${log.message}`} className="border-b border-slate-100 pb-2">
                  <p className={log.level === "error" ? "font-semibold text-red-700" : "font-semibold text-slate-700"}>{log.engine}</p>
                  <p className="text-slate-600">{log.message}</p>
                  <p className="text-xs text-slate-400">{new Date(log.timestamp).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </aside>
        </div>
      ) : null}
    </main>
  );
};
