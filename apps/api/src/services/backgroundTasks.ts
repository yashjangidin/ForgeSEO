export const scheduleBackgroundTask = async (
  taskFactory: () => Promise<unknown>,
  label: string
): Promise<void> => {
  const runGuardedTask = (): Promise<void> =>
    taskFactory()
      .then(() => undefined)
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`${label} failed: ${message}`);
      });

  if (process.env.VERCEL) {
    try {
      const { waitUntil } = await import("@vercel/functions");
      waitUntil(runGuardedTask());
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`Could not register Vercel background task for ${label}: ${message}`);
    }
  }

  void runGuardedTask();
};
