# Worker Flow

The worker subscribes to BullMQ queue `website-generation`.

For each job:

1. Claim the Firestore job.
2. Load the project.
3. Convert the business profile into structured JSON.
4. Checkpoint every engine to Firestore.
5. Render the selected template by replacing placeholders and copying assets.
6. Persist rendered pages and assets.
7. Write preview artifacts and the rendering report to disk.
8. Create a ZIP archive.
9. Upload the build and ZIP to Firebase Storage.
10. Mark the job completed with signed preview and download URLs.

If an engine throws, the worker marks the job failed, records the failed engine, and stores a user-safe error message.
