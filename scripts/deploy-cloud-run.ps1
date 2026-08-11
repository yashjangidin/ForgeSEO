param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectId,

  [string]$Region = "us-central1",
  [string]$Repository = "forgeseo",
  [string]$ApiService = "forgeseo-api",
  [string]$WorkerPool = "forgeseo-worker",

  [Parameter(Mandatory = $true)]
  [string]$FirebaseProjectId,

  [Parameter(Mandatory = $true)]
  [string]$FirebaseStorageBucket,

  [Parameter(Mandatory = $true)]
  [string]$WebOrigin,

  [string]$RedisSecret = "forgeseo-redis-url",
  [string]$ServiceAccount = "",
  [int]$WorkerInstances = 0,
  [int]$WorkerIdleShutdownSeconds = 180
)

$ErrorActionPreference = "Stop"

$defaultDDriveGcloud = "D:\Yash College 2\Tools\GoogleCloudSDK\google-cloud-sdk\bin\gcloud.cmd"
$gcloudCommand = Get-Command gcloud -ErrorAction SilentlyContinue
$gcloudExecutable = if ($gcloudCommand) {
  $gcloudCommand.Source
} elseif (Test-Path -LiteralPath $defaultDDriveGcloud) {
  $defaultDDriveGcloud
} else {
  ""
}

function Invoke-Gcloud {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
  & $gcloudExecutable @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "gcloud $($Arguments -join ' ') failed with exit code $LASTEXITCODE."
  }
}

if (-not $gcloudExecutable) {
  throw "Google Cloud CLI was not found. Install it first: https://cloud.google.com/sdk/docs/install"
}

$apiImage = "$Region-docker.pkg.dev/$ProjectId/$Repository/api:latest"
$workerImage = "$Region-docker.pkg.dev/$ProjectId/$Repository/worker:latest"

Invoke-Gcloud config set project $ProjectId
Invoke-Gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com firestore.googleapis.com storage.googleapis.com

$projectNumber = (& $gcloudExecutable projects describe $ProjectId --format "value(projectNumber)").Trim()
if (-not $projectNumber) {
  throw "Could not read the Google Cloud project number."
}

$runtimeServiceAccount = if ($ServiceAccount.Trim()) {
  $ServiceAccount.Trim()
} else {
  "$projectNumber-compute@developer.gserviceaccount.com"
}

Invoke-Gcloud secrets add-iam-policy-binding $RedisSecret `
  --project $ProjectId `
  --member "serviceAccount:$runtimeServiceAccount" `
  --role "roles/secretmanager.secretAccessor"

Invoke-Gcloud projects add-iam-policy-binding $ProjectId `
  --member "serviceAccount:$runtimeServiceAccount" `
  --role "roles/datastore.user"

Invoke-Gcloud projects add-iam-policy-binding $ProjectId `
  --member "serviceAccount:$runtimeServiceAccount" `
  --role "roles/run.developer"

Invoke-Gcloud projects add-iam-policy-binding $ProjectId `
  --member "serviceAccount:$runtimeServiceAccount" `
  --role "roles/iam.serviceAccountTokenCreator"

Invoke-Gcloud storage buckets add-iam-policy-binding "gs://$FirebaseStorageBucket" `
  --member "serviceAccount:$runtimeServiceAccount" `
  --role "roles/storage.objectAdmin"

$previousErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"
& $gcloudExecutable artifacts repositories describe $Repository --location $Region *> $null
$repositoryExists = $LASTEXITCODE -eq 0
$ErrorActionPreference = $previousErrorActionPreference
if (-not $repositoryExists) {
  Invoke-Gcloud artifacts repositories create $Repository --repository-format docker --location $Region --description "ForgeSEO container images"
}

Invoke-Gcloud builds submit --config cloudbuild.api.yaml --substitutions "_IMAGE=$apiImage" .
Invoke-Gcloud builds submit --config cloudbuild.worker.yaml --substitutions "_IMAGE=$workerImage" .

$serviceAccountArgs = @()
if ($ServiceAccount.Trim()) {
  $serviceAccountArgs = @("--service-account", $ServiceAccount.Trim())
}

$apiEnv = @(
  "NODE_ENV=production",
  "QUEUE_PROVIDER=redis",
  "SITE_STORAGE_PROVIDER=firebase",
  "STRUCTURED_JSON_PROVIDER=openai",
  "FIREBASE_PROJECT_ID=$FirebaseProjectId",
  "FIREBASE_STORAGE_BUCKET=$FirebaseStorageBucket",
  "WEB_ORIGIN=$WebOrigin",
  "CLOUD_RUN_WORKER_AUTOSCALE=true",
  "CLOUD_RUN_PROJECT_ID=$ProjectId",
  "CLOUD_RUN_REGION=$Region",
  "CLOUD_RUN_WORKER_POOL=$WorkerPool"
) -join ","

Invoke-Gcloud run deploy $ApiService `
  --image $apiImage `
  --region $Region `
  --allow-unauthenticated `
  --memory 1Gi `
  --cpu 1 `
  --timeout 900 `
  --set-env-vars $apiEnv `
  --set-secrets "REDIS_URL=${RedisSecret}:latest" `
  @serviceAccountArgs

$apiUrl = (& $gcloudExecutable run services describe $ApiService --region $Region --format "value(status.url)").Trim()
if (-not $apiUrl) {
  throw "Could not read the Cloud Run API URL."
}

$workerEnv = @(
  "NODE_ENV=production",
  "QUEUE_PROVIDER=redis",
  "SITE_STORAGE_PROVIDER=firebase",
  "STRUCTURED_JSON_PROVIDER=openai",
  "FIREBASE_PROJECT_ID=$FirebaseProjectId",
  "FIREBASE_STORAGE_BUCKET=$FirebaseStorageBucket",
  "API_PUBLIC_URL=$apiUrl",
  "CLOUD_RUN_WORKER_AUTOSCALE=true",
  "CLOUD_RUN_PROJECT_ID=$ProjectId",
  "CLOUD_RUN_REGION=$Region",
  "CLOUD_RUN_WORKER_POOL=$WorkerPool",
  "WORKER_IDLE_SHUTDOWN_SECONDS=$WorkerIdleShutdownSeconds"
) -join ","

Invoke-Gcloud run worker-pools deploy $WorkerPool `
  --image $workerImage `
  --region $Region `
  --instances $WorkerInstances `
  --memory 2Gi `
  --cpu 1 `
  --set-env-vars $workerEnv `
  --set-secrets "REDIS_URL=${RedisSecret}:latest" `
  @serviceAccountArgs

Write-Host ""
Write-Host "ForgeSEO backend deployed."
Write-Host "API URL: $apiUrl"
Write-Host "Set VITE_API_BASE_URL=$apiUrl before building/deploying the frontend."
