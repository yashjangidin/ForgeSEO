import { doc, onSnapshot } from "firebase/firestore";
import { COLLECTIONS, type GenerationJob } from "@forgeseo/shared";
import { db } from "./firebase";
import { getGenerationJob } from "./api";

const pollJob = (
  jobId: string,
  onValue: (job: GenerationJob | undefined) => void,
  onError: (error: Error) => void
): (() => void) => {
  let active = true;

  const load = async (): Promise<void> => {
    try {
      const job = await getGenerationJob(jobId);
      if (active) {
        onValue(job);
      }
    } catch (error) {
      if (active) {
        onError(error instanceof Error ? error : new Error("Could not load generation job."));
      }
    }
  };

  void load();
  const interval = window.setInterval(() => {
    void load();
  }, 2500);

  return () => {
    active = false;
    window.clearInterval(interval);
  };
};

export const subscribeToJob = (
  jobId: string,
  onValue: (job: GenerationJob | undefined) => void,
  onError: (error: Error) => void
): (() => void) => {
  if (!db) {
    onError(new Error("Firebase is not configured."));
    return () => undefined;
  }

  let stopPolling: (() => void) | undefined;
  const startPolling = (): void => {
    if (!stopPolling) {
      stopPolling = pollJob(jobId, onValue, onError);
    }
  };
  const stopSnapshot = onSnapshot(
    doc(db, COLLECTIONS.generationJobs, jobId),
    (snapshot) => {
      stopPolling?.();
      stopPolling = undefined;
      onValue(snapshot.exists() ? (snapshot.data() as GenerationJob) : undefined);
    },
    (error) => {
      const message = error instanceof Error ? error.message : String(error);
      if (
        error.code === "permission-denied" ||
        error.code === "unavailable" ||
        /database is closing|hidden|offline|indexeddb/i.test(message)
      ) {
        startPolling();
        return;
      }

      onError(error);
    }
  );

  return () => {
    stopSnapshot();
    stopPolling?.();
  };
};
