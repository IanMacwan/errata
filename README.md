# errata

**errata** is a lightweight web application for comparing two compiled ELF binaries. Upload a baseline and candidate build to compare file sizes, ELF sections, load segments, and symbol sizes. Export the results as a Markdown report.

## Features

- Compare file sizes and ELF metadata.
- View section-size and load-segment differences.
- Identify the largest symbol-size increases and decreases.
- Export comparison results to Markdown.

## Tech Stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS
- **Backend:** Python 3.12, FastAPI, Uvicorn, `pyelftools`, Pydantic
- **Deployment:** Docker, Docker Compose, Nginx
- **Testing & Quality:** Vitest, React Testing Library, pytest, Ruff

## Run Locally

Requires Docker and Docker Compose.

```bash
git clone https://github.com/IanMacwan/bananatcp.git
cd errata
docker compose up --build
```

Open **http://localhost:8080** in your browser.

Stop the application with:

```bash
docker compose down
```

## Limitations

Section and load-segment totals are comparison metrics, not exact physical flash or RAM usage. Symbol comparisons depend on symbol information being available in the ELF files.
