# Subtitle Sync Frontend (React)

A modern, minimalistic UI for uploading a video and subtitle file, syncing subtitles via backend Whisper processing, tracking progress, downloading the result, and viewing processing history.

## Quick Start

1. Install dependencies:
   npm install

2. Configure backend URL:
   - Copy .env.example to .env
   - Set REACT_APP_BACKEND_URL to your FastAPI backend, e.g.
     REACT_APP_BACKEND_URL=http://localhost:8000

3. Run the app:
   npm start

The app will be available at http://localhost:3000

## Features

- Video file upload
- Subtitle file upload (.srt, .ass, .ssa, .vtt)
- Sync action that triggers backend processing
- Progress indicator with status messages
- Download synced subtitle file
- History of processed files

## API Endpoints

The UI expects a FastAPI backend exposing:
- POST /upload -> returns { task_id }
- POST /sync -> body: { task_id }
- GET /progress/{task_id} -> returns { progress, status, message }
- GET /download/{task_id} -> returns file stream
- GET /history -> returns array of processed items

Adjust the paths in src/App.js if your backend differs.

## Styling and Theme

- Light theme
- Colors:
  - Primary: #1976d2
  - Accent: #ff9800
  - Secondary: #424242

All styles are implemented via inline styles and CSS variables in src/App.css for minimal dependencies.

## Tests

Run:
  npm test
