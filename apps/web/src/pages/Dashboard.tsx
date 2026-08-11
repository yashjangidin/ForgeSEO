import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import type { ReactElement } from "react";
import { getCapabilities } from "../services/api";

export const Dashboard = (): ReactElement => {
  const { data, error, isLoading } = useQuery({ queryKey: ["capabilities"], queryFn: getCapabilities });

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
        {error ? <p className="mt-3 text-sm text-red-700">Could not load backend capability status.</p> : null}
        {data ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Firebase Admin", data.firebaseAdmin],
              ["Redis Queue", data.redis],
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
