import { useEffect, useState, type ReactElement } from "react";
import { Link, useParams } from "react-router-dom";
import type { GenerationJob } from "@forgeseo/shared";
import { ENGINE_ORDER } from "@forgeseo/shared";
import { subscribeToJob } from "../services/jobs";

export const Pipeline = (): ReactElement => {
  const { jobId } = useParams();
  const [job, setJob] = useState<GenerationJob | undefined>();
  const [error, setError] = useState<string | undefined>();

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
