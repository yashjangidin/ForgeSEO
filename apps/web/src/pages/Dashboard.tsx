import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import type { ReactElement } from "react";
import { ApiRequestError, getCapabilities } from "../services/api";

export const Dashboard = (): ReactElement => {
  const { data, error, isLoading } = useQuery({ queryKey: ["capabilities"], queryFn: getCapabilities });
  const errorMessage = error instanceof Error ? error.message : "Could not load backend capability status.";
  const errorDetails = error instanceof ApiRequestError ? error.details : undefined;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-ink">Projects</h1>
          <p className="mt-2 max-w-2xl text-slate-600">Create a project, complete the wizard, and generate a complete static SEO website through the backend worker.</p>
        </div>
        <Link className="rounded bg-ocean px-4 py-2 font-semibold text-white" to="/wizard">
          Create Project
        </Link>
      </div>

      <section className="mt-8 rounded border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Generation Readiness</h2>
        {isLoading ? <p className="mt-3 text-sm text-slate-600">Loading backend capability status...</p> : null}
        {error ? (
          <div className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <p className="font-semibold">Could not load backend capability status.</p>
            <p className="mt-1">{errorMessage}</p>
            {errorDetails ? (
              <dl className="mt-3 grid gap-2 text-xs text-red-900 sm:grid-cols-2">
                {errorDetails.url ? (
                  <>
                    <dt className="font-semibold">URL</dt>
                    <dd className="break-all">{errorDetails.url}</dd>
                  </>
                ) : null}
                {errorDetails.status ? (
                  <>
                    <dt className="font-semibold">HTTP Status</dt>
                    <dd>{errorDetails.status} {errorDetails.statusText}</dd>
                  </>
                ) : null}
                {errorDetails.contentType ? (
                  <>
                    <dt className="font-semibold">Content Type</dt>
                    <dd>{errorDetails.contentType}</dd>
                  </>
                ) : null}
                {errorDetails.body ? (
                  <>
                    <dt className="font-semibold sm:col-span-2">Response Body</dt>
                    <dd className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded bg-white p-2 font-mono sm:col-span-2">{errorDetails.body}</dd>
                  </>
                ) : null}
              </dl>
            ) : null}
          </div>
        ) : null}
        {data ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Firebase Admin", data.firebaseAdmin],
              [data.generationMode === "direct" ? "Direct Runner" : "Redis Queue", data.redis],
              ["AI JSON", data.structuredJson],
              ["Storage", data.storage]
            ].map(([label, enabled]) => (
              <div key={String(label)} className="rounded border border-slate-200 p-3">
                <p className="text-sm text-slate-500">{label}</p>
                <p className={enabled ? "font-semibold text-emerald-700" : "font-semibold text-red-700"}>{enabled ? "Configured" : "Not configured"}</p>
              </div>
            ))}
            {!data.generationEnabled ? <p className="sm:col-span-2 lg:col-span-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{data.disabledReason}</p> : null}
          </div>
        ) : null}
      </section>
    </main>
  );
};
