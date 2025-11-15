const videoInput = document.getElementById("videoInput");
const hiddenVideo = document.getElementById("hiddenVideo");
const previewCanvas = document.getElementById("previewCanvas");
const processBtn = document.getElementById("processBtn");
const statusEl = document.getElementById("status");
const downloadContainer = document.getElementById("downloadContainer");

let ctx;
let videoFile = null;
let faceApiReady = false;
let logoImage = null;

const MODEL_URL = "https://cdn.jsdelivr.net/gh/cgarciagl/face-api.js@0.22.2/weights";

document.addEventListener("DOMContentLoaded", () => {
  ctx = previewCanvas.getContext("2d");
  caricaLogo();
});

function caricaLogo() {
  logoImage = new Image();
  logoImage.src = "logo_voci.png"; // deve stare nella stessa cartella di index.html
  logoImage.onload = () => {
    console.log("Logo caricato");
  };
  logoImage.onerror = () => {
    console.warn("Logo non trovato, uso solo testo.");
  };
}

// Caricamento modelli face-api
async function initFaceApi() {
  if (faceApiReady) return;
  if (typeof faceapi === "undefined") {
    statusEl.textContent =
      "Errore: face-api.js non è stato caricato. Controlla gli script in index.html.";
    throw new Error("faceapi non disponibile");
  }
  statusEl.textContent = "Caricamento modelli rilevamento volti...";
  await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
  faceApiReady = true;
  statusEl.textContent = "Modelli caricati. Pronto per l'elaborazione.";
}

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
      processBtn.disabled = false;
      statusEl.textContent =
        "Video caricato. Premi \"Avvia elaborazione automatica\" per oscurare i volti e aggiungere il logo.";
    },
    { once: true }
  );

  hiddenVideo.currentTime = 0.01;
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

// Watermark grafico + fallback testo
function drawWatermark(ctx, vw, vh) {
  const padding = 20;

  if (logoImage && logoImage.complete && logoImage.naturalWidth > 0) {
    const targetWidth = vw * 0.22; // ~22% larghezza video
    const ratio = logoImage.naturalHeight / logoImage.naturalWidth;
    const targetHeight = targetWidth * ratio;

    const x = vw - targetWidth - padding;
    const y = vh - targetHeight - padding;

    ctx.save();
    ctx.globalAlpha = 0.95;
    ctx.drawImage(logoImage, x, y, targetWidth, targetHeight);
    ctx.restore();
  } else {
    // fallback testo
    const text = "Voci di Cassino";
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
}

// Avvio elaborazione automatica con face detection
processBtn.addEventListener("click", async () => {
  if (!videoFile) {
    statusEl.textContent = "Carica prima un video.";
    return;
  }

  processBtn.disabled = true;
  downloadContainer.innerHTML = "";

  try {
    await initFaceApi();
  } catch (e) {
    processBtn.disabled = false;
    return;
  }

  statusEl.textContent =
    "Elaborazione in corso... rilevamento volti e oscuramento automatico. Non chiudere la pagina.";

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
      "Il browser non supporta la registrazione video (MediaRecorder). Prova con Chrome/Edge aggiornato.";
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
    a.textContent = "Scarica il video oscurato (WEBM, senza audio)";
    a.className = "download-link";

    downloadContainer.innerHTML = "";
    downloadContainer.appendChild(a);

    statusEl.textContent =
      "Elaborazione completata. Scarica il video dal link qui sopra.";
    processBtn.disabled = false;
  };

  mediaRecorder.start();

  hiddenVideo.currentTime = 0;
  hiddenVideo.play();

  let frameCount = 0;

  async function step() {
    if (hiddenVideo.paused || hiddenVideo.ended) {
      mediaRecorder.stop();
      return;
    }

    workCtx.drawImage(hiddenVideo, 0, 0, vw, vh);

    // Rilevamento volti sul frame corrente
    const detections = await faceapi.detectAllFaces(
      workCanvas,
      new faceapi.TinyFaceDetectorOptions({
        inputSize: 256,
        scoreThreshold: 0.5,
      })
    );

    // Oscura ogni volto rilevato
    detections.forEach((det) => {
      const box = det.box;
      // ingrandisco un po' il rettangolo per coprire bene
      const margin = 10;
      const x = Math.max(0, box.x - margin);
      const y = Math.max(0, box.y - margin);
      const w = Math.min(vw - x, box.width + margin * 2);
      const h = Math.min(vh - y, box.height + margin * 2);
      pixelateRegion(workCtx, x, y, w, h, 14);
    });

    // Logo grafico
    drawWatermark(workCtx, vw, vh);

    frameCount++;
    if (frameCount % 20 === 0) {
      statusEl.textContent = `Elaborazione in corso... frame processati circa: ${frameCount}`;
    }

    requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
});
