# Ultimate Builder – MVP (Client‑Only)

Ein 100% clientseitiges MVP für deine immersive „Ultimate PC/Cluster“-Website.
- **Kostenlos**: läuft als statische Seite (GitHub Pages / Cloudflare Pages).
- **WOW**: 3D‑Mindmap (Three.js), Live‑Heuristiken, Export von Build‑Plänen.
- **Ohne API**: Optionaler Local‑LLM (WebLLM, WebGPU) kann zugeschaltet werden.

## Features
- 3D‑Canvas mit Nodes (Head‑Server, Mini‑PCs, NAS, Switch, eGPU).
- Drag‑&‑Drop, Verkabelungen, Typen, Bandbreite.
- Heuristik‑Berater („AI Light“) ohne Internet.
- Export: JSON/YAML‑ähnlicher Build‑Plan.
- Optional: Local‑LLM via WebLLM (wenn Browser WebGPU unterstützt).

## Start (lokal)
1. Zip entpacken.
2. Öffne `index.html` **per Static Server** (z. B. in VS Code Extension „Live Server“).
   - Direktes Öffnen per `file://` blockiert Imports/Module.
3. Browser: Chrome/Edge/Arc/Brave (WebGL an, optional WebGPU).

## Deployment
- **GitHub Pages**: Repo anlegen, Code pushen, Pages aktivieren (Build source: `/(root)`), `index.html` wird bereitgestellt.
- **Cloudflare Pages**: Neues Projekt → „Upload assets“ → Ordner wählen → Deploy.

## Optional: Local‑LLM
- Toggle im UI: „Local AI (WebLLM)“. Beim Aktivieren werden Modelldateien (mehrere 100 MB) nachgeladen.
- Läuft offline im Browser mit WebGPU. Fallback bleibt die Heuristik.

## Hinweis
Dies ist ein MVP – kein Ersatz für produktionsreife Orchestrierung. Ziel: schnelles, eindrucksvolles Prototyping.
