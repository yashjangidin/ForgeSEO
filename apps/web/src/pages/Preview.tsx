import { useEffect, useState, type ReactElement } from "react";
import { useParams } from "react-router-dom";
import type { GenerationJob } from "@forgeseo/shared";
import { subscribeToJob } from "../services/jobs";

export const Preview = (): ReactElement => {
  const { jobId } = useParams();
  const [job, setJob] = useState<GenerationJob | undefined>();
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (!jobId) {
      setError("Missing job id.");
      return undefined;
    }
    return subscribeToJob(jobId, setJob, (nextError) => setError(nextError.message));
  }, [jobId]);

  const previewUrl = job?.result?.previewUrl;

  return (
    <main className="h-[calc(100vh-4rem)]">
      {error ? <p className="m-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {!previewUrl && !error ? <p className="p-4 text-slate-600">Preview will be available after the worker uploads the generated site.</p> : null}
      {previewUrl ? <iframe className="h-full w-full border-0" title="Generated website preview" src={previewUrl} /> : null}
    </main>
  );
};
