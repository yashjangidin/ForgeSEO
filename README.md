# ForgeSEO

ForgeSEO is a full-stack template rendering platform that generates SEO-ready static websites from structured business content. Instead of asking AI to write HTML, CSS, or JavaScript, ForgeSEO uses AI only for structured JSON content and a deterministic renderer to place that content into premium HTML templates.

Built by **Yash Jangid**, Electronics and Communication Engineering student.

## Live Demo

- App: https://forgeseo-prod-fd54a.web.app
- Health check: https://forgeseo-prod-fd54a.web.app/api/capabilities

## Why This Project Exists

Most AI website generators create unpredictable markup, inconsistent layouts, and hard-to-maintain code. ForgeSEO solves that by separating content generation from website rendering:

```text
Business Wizard
  -> Structured JSON Generator
  -> Template Renderer
  -> Preview
  -> ZIP Export
```

The renderer preserves the original template design, animations, responsiveness, scripts, and assets. Only text, metadata, links, embeds, service pages, contact details, and selected placeholders are replaced.

## Core Features

- Firebase Authentication with email/password and Google login
- Settings page for AI provider API keys
- Support for OpenAI, OpenRouter, Gemini, Claude, Groq, Mistral, Together AI, Perplexity, and xAI-style providers
- Template library with selectable templates
- Multi-page generation across selected templates
- Dynamic service dropdown pages from user-provided service keywords
- Optional About, Services, and Contact pages
- Contact layouts with form, map, contact details, or combined layouts
- Home page, service page, and FAQ structured content generation
- Deterministic placeholder replacement
- Preview and ZIP export
- Firebase Storage upload for generated artifacts
- Cloud Run API and Cloud Run worker pool deployment
- Redis/BullMQ job queue
- Firestore job tracking and live pipeline updates

## Tech Stack

- **Frontend:** React, TypeScript, Vite, TailwindCSS, TanStack Query, React Router
- **Backend:** Node.js, Express, TypeScript
- **Worker:** BullMQ, Redis, deterministic template renderer
- **Cloud:** Firebase Hosting, Firebase Auth, Firestore, Firebase Storage, Google Cloud Run
- **AI:** Provider-agnostic structured JSON generation
- **DevOps:** Docker, Cloud Build, Cloud Run deployment scripts

## Repository Structure

```text
apps/
  web/       React frontend
  api/       Express API and queue producer
  worker/    Queue worker, AI adapter, renderer, ZIP export
packages/
  shared/    Shared TypeScript contracts
templates/   Registered HTML templates and manifests
docs/        Architecture, deployment, API, and database notes
scripts/     Cloud Run deployment automation
tests/       Node test suite
```

## Local Development

```bash
npm install
cp .env.example .env
npm run typecheck
npm run dev
```

Redis is required for the hosted queue path. Local development can use the local queue path depending on `.env` configuration.

## Environment Variables

Use `.env.example` as the reference. Do not commit `.env`, Firebase private keys, Redis URLs, OpenAI keys, or any other secrets.

Important variables:

- `QUEUE_PROVIDER`
- `REDIS_URL`
- `SITE_STORAGE_PROVIDER`
- `STRUCTURED_JSON_PROVIDER`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_STORAGE_BUCKET`
- `OPENAI_MODEL`
- `VITE_FIREBASE_*`

## Testing

```bash
npm run typecheck
npm test
```

## Deployment

Firebase Hosting serves the frontend and rewrites `/api/**` to Cloud Run.

Cloud Run runs:

- `forgeseo-api`: HTTP API
- `forgeseo-worker`: worker pool that processes Redis/BullMQ jobs

Deployment script:

```powershell
.\scripts\deploy-cloud-run.ps1 `
  -ProjectId "forgeseo-prod-fd54a" `
  -Region "asia-south1" `
  -FirebaseProjectId "forgeseo-prod-fd54a" `
  -FirebaseStorageBucket "forgeseo-prod-fd54a-builds" `
  -WebOrigin "https://forgeseo-prod-fd54a.web.app" `
  -WorkerInstances 0
```

## Resume Highlights

- Designed a rendering-first architecture to prevent unstable AI-generated frontend code.
- Built a provider-agnostic AI adapter layer for structured JSON generation.
- Implemented async website generation with Redis, BullMQ, Firestore status tracking, and Cloud Run worker pools.
- Created a template manifest system that allows new templates to be added without changing the rendering engine.
- Deployed a working full-stack cloud application with Firebase Hosting, Cloud Run, Firestore, Firebase Auth, and Firebase Storage.

## Author

**Yash Jangid**  
Electronics and Communication Engineering Student

