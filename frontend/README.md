# AutoLabeling Frontend

React + TypeScript + Vite frontend for the AutoLabeling pre-annotation and YOLO training workflow.

## Requirements

Use Node.js 22 or newer.

The app uses Vite/Rolldown native bindings. Reinstall dependencies if `node_modules` was installed with a different Node architecture.

## Scripts

```bash
npm install
npm run dev
npm run lint
npm run build
```

## Key Areas

- `src/pages/Home.tsx` - main workflow surface for upload, detection, filtering, history, training, and validation.
- `src/components/DetectionCanvas.tsx` - image preview, bounding-box rendering, and manual drawing.
- `src/components/DetectionResult.tsx` - result actions, YOLO export, batch thumbnails, and validation-safe controls.
- `src/components/ResultTable.tsx` - box table, visibility toggles, and delete actions.
- `src/hooks/useDetection.ts` - detection list and mutation hooks.
- `src/hooks/useBatchDetection.ts` - serial batch detection flow.
- `src/hooks/useYoloValidation.ts` - trained-model validation mode.
- `src/lib/filterBoxes.ts` - frontend All / Best / NMS box filtering.
- `src/lib/yoloExport.ts` - browser-side single-image YOLO `.txt` export.
- `src/services/api.ts` - typed API helper layer.

## Behavior Notes

- Detection records now expose `categories` as an array, not a JSON string.
- Filter modes are `all`, `best`, and `nms`; saved filter settings are persisted by the backend and used by export/training.
- Box visibility is temporary UI state keyed by `box.id`.
- Validation results use temporary ids and do not call backend-only persistence or zip export actions.
