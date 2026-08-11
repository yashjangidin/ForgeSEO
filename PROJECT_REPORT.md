# ForgeSEO Project Report

## Student

**Yash Jangid**  
Electronics and Communication Engineering

## Project Title

ForgeSEO: Template-Driven SEO Website Generator

## Abstract

ForgeSEO is a full-stack web application that generates complete static SEO websites using a rendering-first architecture. The system accepts business information from a simplified wizard, uses an AI provider only to generate structured JSON content, and renders the final website by replacing placeholders inside registered premium HTML templates. This approach avoids unstable AI-generated HTML/CSS/JavaScript and keeps design quality consistent across generated websites.

## Problem Statement

Traditional AI website generators often produce inconsistent layouts, broken responsiveness, and difficult-to-maintain code because the AI directly generates frontend markup. ForgeSEO solves this by separating content generation from layout rendering.

## Objectives

- Build a web-based project wizard for business website generation.
- Generate structured content JSON using configurable AI providers.
- Render static websites through existing templates without modifying layout logic.
- Support multiple pages, service dropdown pages, embeds, contact modes, preview, and ZIP export.
- Deploy the complete system using Firebase and Cloud Run.

## Architecture

```text
React Web App
  -> Express API
  -> Firestore Job Record
  -> Redis/BullMQ Queue
  -> Cloud Run Worker
  -> Structured JSON Generator
  -> Template Renderer
  -> Firebase Storage
  -> Preview and ZIP Download
```

## Key Modules

- **Project Wizard:** Collects business name, description, industry, keywords, templates, embeds, contact mode, and generation preferences.
- **AI Provider Layer:** Supports OpenAI, OpenRouter, Gemini, Claude, Groq, Mistral, Together AI, Perplexity, and xAI-compatible providers.
- **Template Library:** Stores templates with manifests, supported pages, placeholder lists, style metadata, and preview images.
- **Template Renderer:** Replaces placeholders, creates service pages, removes unselected navigation links, preserves original template layout, and creates output artifacts.
- **Job Pipeline:** Tracks progress through Firestore and processes generation asynchronously with BullMQ.
- **Deployment Layer:** Uses Firebase Hosting for frontend and Google Cloud Run for API/worker services.

## Technologies Used

- React
- TypeScript
- Vite
- TailwindCSS
- Node.js
- Express
- Firebase Auth
- Firestore
- Firebase Storage
- Redis
- BullMQ
- Docker
- Google Cloud Run
- Cloud Build

## Security Considerations

- API keys are entered through the settings flow and should not be committed.
- `.env`, `.env.*`, `.secrets`, logs, generated builds, and ZIP exports are ignored by Git.
- Firebase private keys are excluded from the repository.
- API routes validate Firebase ID tokens before protected operations.

## Outcome

ForgeSEO is deployed as a working full-stack application. The system can create SEO-ready websites from selected templates, show live pipeline progress, and provide preview/download artifacts after generation.

## Resume Summary

Built and deployed a cloud-based AI-assisted template rendering engine that converts business inputs into complete SEO-ready static websites using React, Node.js, Firebase, Redis/BullMQ, Cloud Run, and provider-agnostic structured JSON generation.

