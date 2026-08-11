# API Endpoints

## `GET /api/health`

Returns API liveness.

## `GET /api/capabilities`

Returns integration readiness:

- Firebase Admin
- Redis
- Structured JSON generator
- Storage
- Generation enabled
- Disabled reason

## `POST /api/generation/start`

Requires `Authorization: Bearer <firebase-id-token>`.

Validates and persists the wizard configuration, creates a Firestore generation job, and enqueues the worker job.

Returns:

```json
{
  "projectId": "string",
  "jobId": "string",
  "status": "queued"
}
```
