# Electron CAD Workbench

This is a small Electron desktop demo for CAD/Web3D style engineering workflows:

- CAD/Web3D style model viewport
- Electron main/preload/renderer separation
- IPC for native desktop actions
- Simulated realtime telemetry
- Export workflow similar to model/task handoff
- TypeScript + Vite + Tailwind CSS

## Run

```bash
npm install
npm run dev
```

## Project Structure

```text
electron/
  main.ts              Electron main process
  preload.ts           Safe IPC bridge
src/
  main.ts              Renderer app entry
  styles.css           Tailwind CSS entry
  types.ts             Shared renderer types
index.html             Vite HTML entry
```

## Demo Features

- Canvas-based CAD preview with pan/zoom controls
- Live telemetry stream from the main process
- Task panel for render, export, and SDK sync actions
- Native file export through Electron IPC
