# Firestore Schema

## `users`

Firebase Auth user profile and account settings.

## `projects`

Stores project ownership and the latest wizard configuration.

Fields include `id`, `userId`, `name`, `wizardConfig`, timestamps, and `lastGenerationJobId`.

## `generationJobs`

Stores queue and worker state.

Fields include `status`, `progress`, `currentEngine`, `currentTask`, `completedEngines`, `failedEngines`, `estimatedTimeSeconds`, `elapsedSeconds`, `logs`, `errors`, `checkpoints`, and `result`.

## `pages`

Rendered HTML page records with title, metadata, headings, word count, status, and version.

## `assets`

Copied template assets, downloads, ZIPs, manifest, sitemap, and robots assets.

SEO metadata is carried in structured content JSON and rendered through template placeholders.

## Other Collections

`activities`, `templates`, `deployments`, and `settings` are reserved for real feature implementations. UI features must remain disabled until backed by services using those collections.
