# Architecture

## Runtime Boundaries

The frontend never calls external model providers or worker-only services directly. It authenticates with Firebase, submits generation requests to the API, and listens to Firestore for job state.

The API owns request validation, authorization, project persistence, job creation, and BullMQ enqueueing.

The worker owns all long-running generation work. It claims jobs from BullMQ, updates Firestore after every engine, persists generated records, uploads build artifacts, and marks jobs completed or failed.

## Template-Driven Rendering

ForgeSEO no longer treats an LLM as an HTML, CSS, JavaScript, layout, or theme generator. Structured JSON is generated locally by default. If an external model provider is explicitly enabled, its boundary is structured content JSON only. Template rendering is deterministic and runs without an LLM.

The worker loads a selected premium HTML template from `templates/`, validates its `template.manifest.json`, flattens structured content into `{{PLACEHOLDER}}` values, and performs string replacement. HTML structure, CSS, JavaScript, animations, spacing, assets, and responsive behavior are preserved from the source template.

Adding a template requires:

1. Copy the template folder into `templates/<template-id>/`.
2. Add `template.manifest.json`.
3. Add the template id to `templates/registry.json`.

The renderer itself does not need to change for new templates.

## Engine Order

The shared `ENGINE_ORDER` contract defines the canonical template pipeline:

1. Structured JSON Generator
2. Template Renderer
3. Preview Builder
4. ZIP Export

Each engine receives `GenerationState` and returns a new state plus a human-readable task summary. Progress shown in the UI comes from the Firestore job document only.

The structured JSON generator receives only the business wizard profile and returns content fields such as `businessName`, `tagline`, `hero`, `about`, `services`, `faq`, `contact`, and `seo`. It does not write markup or presentation code.

The template renderer is solely responsible for loading the selected template, replacing placeholders, copying assets, updating metadata placeholders, and producing final HTML.
