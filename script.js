const videoInput = document.getElementById("videoInput");
const hiddenVideo = document.getElementById("hiddenVideo");
const previewCanvas = document.getElementById("previewCanvas");
const processBtn = document.getElementById("processBtn");
const statusEl = document.getElementById("status");
const rectInfoEl = document.getElementById("rectInfo");
const downloadContainer = document.getElementById("downloadContainer");

let ctx;
let videoFile = null;
let rect = null;
let isDrawing = false;
let startX = 0;
let startY = 0;
let lastTouchX = 0;
let lastTouchY = 0;

document.addEventListener("DOMContentLoaded", () => {
  ctx = previewCanvas.getContext("2d");
});

// Caricamento video
videoInput.addEventListener("change", () => {
  const file = videoInput.files[0];
  if (!file) return;

  videoFile = file;
  const url = URL.createObjectURL(file);
  hiddenVideo.src = url;
  hiddenVideo.load();

  hiddenVideo.addEventListener("loadeddata", drawFirstFrame, { once: true });
});

function drawFirstFrame() {
  const vw = hiddenVideo.videoWidth;
  const vh = hiddenVideo.videoHeight;

  if (!vw || !vh) {
    statusEl.textContent = "Errore: impossibile leggere il video.";
    return;
  }

  previewCanvas.width = vw;
  previewCanvas.height = vh;

  hiddenVideo.currentTime = 0;
  hiddenVideo.pause();

  hiddenVideo.addEventListener(
    "seeked",
    () => {
      ctx.drawImage(hiddenVideo, 0, 0, vw, vh);
      statusEl.textContent =
        "Primo frame caricato. Trascina col mouse o col dito per selezionare la zona da oscurare.";
      abilitaSelezioneRettangolo();
    },
    { once: true }
  );

  hiddenVideo.currentTime = 0.01;
}

function abilitaSelezioneRettangolo() {
  rect = null;
  rectInfoEl.textContent = "";
  processBtn.disabled = true;

  // --- MOUSE ---
  previewCanvas.onmousedown = (e) => {
    const { x, y } = getCanvasCoords(e);
    isDrawing = true;
    startX = x;
    startY = y;
  };

  previewCanvas.onmousemove = (e) => {
    if (!isDrawing) return;
    const { x, y } = getCanvasCoords(e);
    ridisegnaFrameConRettangolo(startX, startY, x, y);
  };

  previewCanvas.onmouseup = (e) => {
    if (!isDrawing) return;
    isDrawing = false;
    const { x, y } = getCanvasCoords(e);
    completaSelezione(startX, startY, x, y);
  };

  previewCanvas.onmouseleave = () => {
    if (isDrawing) isDrawing = false;
  };

  // --- TOUCH (SMARTPHONE) ---
  previewCanvas.ontouchstart = (e) => {
    e.preventDefault();
    const { x, y } = getCanvasCoords(e);
    isDrawing = true;
    startX = x;
    startY = y;
    lastTouchX = x;
    lastTouchY = y;
  };

  previewCanvas.ontouchmove = (e) => {
    e.preventDefault();
    if (!isDrawing) return;
    const { x, y } = getCanvasCoords(e);
    lastTouchX = x;
    lastTouchY = y;
    ridisegnaFrameConRettangolo(startX, startY, x, y);
  };

  previewCanvas.ontouchend = (e) => {
    e.preventDefault();
    if (!isDrawing) return;
    isDrawing = false;
    completaSelezione(startX, startY, lastTouchX, lastTouchY);
  };

  previewCanvas.ontouchcancel = (e) => {
    e.preventDefault();
    if (isDrawing) isDrawing = false;
  };
}

function getCanvasCoords(evt) {
  const rectCanvas = previewCanvas.getBoundingClientRect();
  let clientX, clientY;

  if (evt.touches && evt.touches[0]) {
    clientX = evt.touches[0].clientX;
    clientY = evt.touches[0].clientY;
  } else if (evt.changedTouches && evt.changedTouches[0]) {
    clientX = evt.changedTouches[0].clientX;
    clientY = evt.changedTouches[0].clientY;
  } else {
    clientX = evt.clientX;
    clientY = evt.clientY;
  }

  const scaleX = previewCanvas.width / rectCanvas.width;
  const scaleY = previewCanvas.height / rectCanvas.height;
  const x = (clientX - rectCanvas.left) * scaleX;
  const y = (clientY - rectCanvas.top) * scaleY;
  return { x, y };
}

function ridisegnaFrameConRettangolo(x1, y1, x2, y2) {
  ctx.drawImage(hiddenVideo, 0, 0, previewCanvas.width, previewCanvas.height);
  const r = normalizzaRettangolo(x1, y1, x2, y2);
  ctx.strokeStyle = "#f97316";
  ctx.lineWidth = 3;
  ctx.strokeRect(r.x, r.y, r.w, r.h);
}

function ridisegnaFrameFinale() {
  ctx.drawImage(hiddenVideo, 0, 0, previewCanvas.width, previewCanvas.height);
  if (rect) {
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 3;
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  }
}

function normalizzaRettangolo(x1, y1, x2, y2) {
  const x = Math.min(x1, x2);
  const y = Math.min(y1, y2);
  const w = Math.abs(x2 - x1);
  const h = Math.abs(y2 - y1);
  return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
}

// Qui forziamo SEMPRE una selezione valida
function completaSelezione(x1, y1, x2, y2) {
  let r = normalizzaRettangolo(x1, y1, x2, y2);

  // Se l'utente ha solo "toccato" o trascinato pochissimo,
  // creiamo automaticamente un rettangolo più grande attorno al punto.
  const minSide = 80; // dimensione minima lato in pixel
  if (r.w < minSide || r.h < minSide) {
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;

    const half = minSide / 2;

    let x = Math.max(0, Math.round(cx - half));
    let y = Math.max(0, Math.round(cy - half));
    let w = minSide;
    let h = minSide;

    if (x + w > previewCanvas.width) {
      x = previewCanvas.width - w;
    }
    if (y + h > previewCanvas.height) {
      y = previewCanvas.height - h;
    }

    r = { x, y, w, h };
  }

  rect = r;
  ridisegnaFrameFinale();
  rectInfoEl.textContent = `Zona selezionata: x=${rect.x}, y=${rect.y}, w=${rect.w}, h=${rect.h}`;
  processBtn.disabled = false;
}

// Pixelate su una zona
function pixelateRegion(ctx, rx, ry, rw, rh, blockSize = 10) {
  const imageData = ctx.getImageData(rx, ry, rw, rh);
  const data = imageData.data;

  for (let y = 0; y < rh; y += blockSize) {
    for (let x = 0; x < rw; x += blockSize) {
      let red = 0,
        green = 0,
        blue = 0,
        count = 0;

      for (let yy = 0; yy < blockSize && y + yy < rh; yy++) {
        for (let xx = 0; xx < blockSize && x + xx < rw; xx++) {
          const idx = ((y + yy) * rw + (x + xx)) * 4;
          red += data[idx];
          green += data[idx + 1];
          blue += data[idx + 2];
          count++;
        }
      }

      red = red / count;
      green = green / count;
      blue = blue / count;

      for (let yy = 0; yy < blockSize && y + yy < rh; yy++) {
        for (let xx = 0; xx < blockSize && x + xx < rw; xx++) {
          const idx = ((y + yy) * rw + (x + xx)) * 4;
          data[idx] = red;
          data[idx + 1] = green;
          data[idx + 2] = blue;
        }
      }
    }
  }

  ctx.putImageData(imageData, rx, ry);
}

// Watermark "Voci di Cassino"
function drawWatermark(ctx, vw, vh) {
  const text = "Voci di Cassino";
  const padding = 16;
  const fontSize = Math.round(vw * 0.04);

  ctx.save();
  ctx.font = `bold ${fontSize}px system-ui`;
  ctx.textBaseline = "bottom";
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.shadowColor = "rgba(0,0,0,0.7)";
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;

  const textWidth = ctx.measureText(text).width;
  ctx.fillText(text, vw - textWidth - padding, vh - padding);
  ctx.restore();
}

// Avvio elaborazione
processBtn.addEventListener("click", async () => {
  if (!videoFile || !rect) {
    statusEl.textContent = "Seleziona prima una zona da oscurare.";
    return;
  }

  processBtn.disabled = true;
  statusEl.textContent =
    "Elaborazione in corso... potrebbe richiedere qualche minuto, non chiudere la pagina.";
  downloadContainer.innerHTML = "";

  const url = URL.createObjectURL(videoFile);
  hiddenVideo.src = url;
  hiddenVideo.load();

  await new Promise((resolve) => {
    hiddenVideo.addEventListener("loadeddata", resolve, { once: true });
  });

  const vw = hiddenVideo.videoWidth;
  const vh = hiddenVideo.videoHeight;

  const workCanvas = document.createElement("canvas");
  workCanvas.width = vw;
  workCanvas.height = vh;
  const workCtx = workCanvas.getContext("2d");

  const stream = workCanvas.captureStream();
  let options = { mimeType: "video/webm" };
  if (!MediaRecorder.isTypeSupported(options.mimeType)) {
    options = {};
  }

  let mediaRecorder;
  try {
    mediaRecorder = new MediaRecorder(stream, options);
  } catch (e) {
    statusEl.textContent =
      "Il tuo browser non supporta la registrazione video (MediaRecorder). Prova con Chrome/Edge aggiornato.";
    processBtn.disabled = false;
    return;
  }

  const chunks = [];
  mediaRecorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  mediaRecorder.onstop = () => {
    const blob = new Blob(chunks, { type: "video/webm" });
    const outUrl = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = outUrl;
    a.download = "video_blur.webm";
    a.textContent = "Scarica il video oscurato (WEBM)";
    a.className = "download-link";

    downloadContainer.innerHTML = "";
    downloadContainer.appendChild(a);

    statusEl.textContent =
      "Elaborazione completata. Scarica il video oscurato dal link qui sopra (solo video, senza audio).";
    processBtn.disabled = false;
  };

  mediaRecorder.start();

  hiddenVideo.currentTime = 0;
  hiddenVideo.play();

  let frameCount = 0;

  function step() {
    if (hiddenVideo.paused || hiddenVideo.ended) {
      mediaRecorder.stop();
      return;
    }

    workCtx.drawImage(hiddenVideo, 0, 0, vw, vh);
    pixelateRegion(workCtx, rect.x, rect.y, rect.w, rect.h, 14);
    drawWatermark(workCtx, vw, vh);

    frameCount++;
    if (frameCount % 30 === 0) {
      statusEl.textContent = `Elaborazione in corso... frame processati circa: ${frameCount}`;
    }

    requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
});
