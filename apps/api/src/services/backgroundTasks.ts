export const scheduleBackgroundTask = async (
  task: Promise<unknown>,
  label: string
): Promise<void> => {
  const guardedTask = task.catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${label} failed: ${message}`);
  });

  if (process.env.VERCEL) {
    try {
      const { waitUntil } = await import("@vercel/functions");
      waitUntil(guardedTask);
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`Could not register Vercel background task for ${label}: ${message}`);
    }
  }

  void guardedTask;
};
