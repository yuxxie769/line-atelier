import {renderRegion} from './renderer.js';

// CSS downscaling a large canvas undersamples thin strokes. Keep playback cheap,
// then rasterize the retained geometry at the actual display resolution at rest.
const viewportStates = new WeakMap();
export function renderViewport(canvas, engine) {
  if (!canvas || !engine || !canvas.clientWidth || !canvas.clientHeight) return;
  const doc = engine.doc;
  const scale = Math.min(
    Math.min(canvas.clientWidth / doc.width, canvas.clientHeight / doc.height) * (window.devicePixelRatio || 1),
    4096 / Math.max(doc.width, doc.height)
  );
  const width = Math.max(1, Math.round(doc.width * scale));
  const height = Math.max(1, Math.round(doc.height * scale));
  const key = JSON.stringify([doc.revision, engine.cursor, width, height, doc.layers]);
  let state = viewportStates.get(canvas);
  if (!state) { state = {}; viewportStates.set(canvas, state); }
  if (!engine.playing && state.doc === doc && state.key === key) return;
  clearTimeout(state.timer);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width; canvas.height = height;
  }
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(engine.canvas, 0, 0, width, height);
  state.key = null;
  if (engine.playing) return;
  const cursor = engine.cursor;
  state.timer = setTimeout(() => {
    if (engine.playing || engine.doc !== doc || engine.cursor !== cursor) return;
    const exact = renderRegion(engine, {region: [0, 0, doc.width, doc.height], scale, mirror: false});
    ctx.drawImage(exact, 0, 0, width, height);
    state.doc = doc; state.key = key;
  }, 70);
}

export function discardViewport(canvas) {
  clearTimeout(viewportStates.get(canvas)?.timer);
  viewportStates.delete(canvas);
}
