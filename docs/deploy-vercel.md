# Deploy ForgeSEO on Vercel

ForgeSEO can run on Vercel without Cloud Run or Redis by using direct generation mode.

## Required Vercel Environment Variables

Set these in the Vercel project settings:

```env
NODE_ENV=production
GENERATION_MODE=direct
STRUCTURED_JSON_PROVIDER=openai
SITE_STORAGE_PROVIDER=firebase
WEB_ORIGIN=https://your-vercel-domain.vercel.app
FIREBASE_PROJECT_ID=forgeseo-prod-fd54a
FIREBASE_STORAGE_BUCKET=forgeseo-prod-fd54a-builds
FIREBASE_CLIENT_EMAIL=your-firebase-admin-client-email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
WORKER_TMP_ROOT=/tmp/forgeseo-builds
```

Optional:

```env
OPENAI_API_KEY=only-needed-if-users-do-not-provide-api-keys-in-settings
OPENAI_MODEL=gpt-5-mini
```

## Firebase Setup

Add the Vercel production domain to Firebase Authentication authorized domains.

The Firebase service account used by Vercel needs:

- Firestore read/write access
- Firebase Storage object read/write access for the build bucket

## How Generation Works on Vercel

Vercel does not run the BullMQ worker. Instead, `/api/generation/start` creates the job and completes the same rendering pipeline inside the request.

This removes Cloud Run and Redis cost, but generation must complete within the Vercel Function duration limit.
