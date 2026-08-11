# Cloud Run Deployment

ForgeSEO runs as:

1. Firebase Hosting for `apps/web`.
2. Cloud Run service for `apps/api`.
3. Cloud Run worker pool for `apps/worker`.
4. Hosted Redis for BullMQ.
5. Firebase Storage for generated previews and ZIP files.

The API and worker use Firebase Admin through Application Default Credentials on Cloud Run. Do not ship a Firebase private key in the container.

## Prerequisites

- Install Google Cloud CLI.
- Log in with `gcloud auth login`.
- Select the right project with `gcloud config set project PROJECT_ID`.
- Create a hosted Redis URL. Upstash Redis is the simplest first option.
- Create a Secret Manager secret named `forgeseo-redis-url` whose latest version contains the Redis URL.
- Make sure the Cloud Run service account has:
  - `roles/datastore.user`
  - `roles/run.developer`
  - `roles/storage.objectAdmin` on the Firebase Storage bucket
  - `roles/secretmanager.secretAccessor` for `forgeseo-redis-url`

## One Command Backend Deploy

From the repo root:

```powershell
.\scripts\deploy-cloud-run.ps1 `
  -ProjectId "YOUR_GCP_PROJECT_ID" `
  -Region "us-central1" `
  -FirebaseProjectId "YOUR_FIREBASE_PROJECT_ID" `
  -FirebaseStorageBucket "YOUR_FIREBASE_STORAGE_BUCKET" `
  -WebOrigin "https://YOUR_FIREBASE_HOSTING_DOMAIN"
```

Optional:

```powershell
.\scripts\deploy-cloud-run.ps1 `
  -ProjectId "YOUR_GCP_PROJECT_ID" `
  -Region "us-central1" `
  -FirebaseProjectId "YOUR_FIREBASE_PROJECT_ID" `
  -FirebaseStorageBucket "YOUR_FIREBASE_STORAGE_BUCKET" `
  -WebOrigin "https://YOUR_FIREBASE_HOSTING_DOMAIN" `
  -RedisSecret "forgeseo-redis-url" `
  -ServiceAccount "forgeseo-runtime@YOUR_GCP_PROJECT_ID.iam.gserviceaccount.com" `
  -WorkerInstances 0 `
  -WorkerIdleShutdownSeconds 180
```

The script:

- Enables required Google APIs.
- Creates the Artifact Registry Docker repository if missing.
- Builds and pushes the API image with `cloudbuild.api.yaml`.
- Builds and pushes the worker image with `cloudbuild.worker.yaml`.
- Deploys `forgeseo-api` as a public Cloud Run service.
- Deploys `forgeseo-worker` as a Cloud Run worker pool.
- Deploys the worker pool with `0` instances by default.
- Prints the API URL.

## Worker Pool Cost Control

Cloud Run worker pools do not automatically scale from HTTP traffic. ForgeSEO handles this in app code:

- The API scales `forgeseo-worker` to `1` instance when a user starts website generation.
- The worker checks the BullMQ queue after jobs complete.
- When the queue stays idle for `WORKER_IDLE_SHUTDOWN_SECONDS`, the worker scales the worker pool back to `0`.

This means opening the ForgeSEO URL does not start the worker. Only actual generation wakes it.

## Frontend After Backend Deploy

Use the printed API URL when building the web app:

```powershell
$env:VITE_API_BASE_URL="https://YOUR_API_URL"
npm run build --workspace @forgeseo/web
firebase deploy --only hosting
```

## Manual Deploy Commands

API:

```powershell
gcloud builds submit --config cloudbuild.api.yaml --substitutions _IMAGE=REGION-docker.pkg.dev/PROJECT_ID/forgeseo/api:latest

gcloud run deploy forgeseo-api `
  --image REGION-docker.pkg.dev/PROJECT_ID/forgeseo/api:latest `
  --region REGION `
  --allow-unauthenticated `
  --memory 1Gi `
  --cpu 1 `
  --timeout 900 `
  --set-env-vars NODE_ENV=production,QUEUE_PROVIDER=redis,SITE_STORAGE_PROVIDER=firebase,STRUCTURED_JSON_PROVIDER=openai,FIREBASE_PROJECT_ID=FIREBASE_PROJECT_ID,FIREBASE_STORAGE_BUCKET=FIREBASE_STORAGE_BUCKET,WEB_ORIGIN=https://YOUR_FIREBASE_HOSTING_DOMAIN `
  --set-secrets REDIS_URL=forgeseo-redis-url:latest
```

Worker:

```powershell
gcloud builds submit --config cloudbuild.worker.yaml --substitutions _IMAGE=REGION-docker.pkg.dev/PROJECT_ID/forgeseo/worker:latest

gcloud run worker-pools deploy forgeseo-worker `
  --image REGION-docker.pkg.dev/PROJECT_ID/forgeseo/worker:latest `
  --region REGION `
  --instances 0 `
  --memory 2Gi `
  --cpu 1 `
  --set-env-vars NODE_ENV=production,QUEUE_PROVIDER=redis,SITE_STORAGE_PROVIDER=firebase,STRUCTURED_JSON_PROVIDER=openai,FIREBASE_PROJECT_ID=FIREBASE_PROJECT_ID,FIREBASE_STORAGE_BUCKET=FIREBASE_STORAGE_BUCKET,API_PUBLIC_URL=https://YOUR_API_URL,CLOUD_RUN_WORKER_AUTOSCALE=true,CLOUD_RUN_PROJECT_ID=PROJECT_ID,CLOUD_RUN_REGION=REGION,CLOUD_RUN_WORKER_POOL=forgeseo-worker,WORKER_IDLE_SHUTDOWN_SECONDS=180 `
  --set-secrets REDIS_URL=forgeseo-redis-url:latest
```

## Notes

- User-supplied AI API keys still flow from Settings into each generation job.
- `OPENAI_API_KEY` is optional as a team-wide fallback only.
- Worker pools are used because the worker is continuous background processing and does not expose HTTP.
- Worker pools can be disabled with `gcloud run worker-pools update forgeseo-worker --region REGION --instances=0`.
- The API is allowed unauthenticated at Cloud Run level, but protected generation endpoints still require Firebase ID tokens.
