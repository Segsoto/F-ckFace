(function () {
  const MAX_BYTES = 300000;
  const MAX_DIMENSION = 1600;
  const MAX_INPUT_BYTES = 10 * 1024 * 1024;
  const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
  function validate(files) {
    if (!files.length || files.length > 7) throw new Error('Seleccioná entre 1 y 7 fotos.');
    for (const file of files) {
      if (!TYPES.has(file.type)) throw new Error('Usá fotos JPG, PNG o WebP. Convertí HEIC a JPG antes de subir.');
      if (!file.size || file.size > MAX_INPUT_BYTES) throw new Error('Cada foto debe pesar entre 1 byte y 10 MB.');
    }
  }
  function encode(canvas, type, quality) {
    return new Promise((resolve, reject) => canvas.toBlob(blob => {
      if (blob?.size) resolve(blob);
      else reject(new Error('No se pudo comprimir una foto. Volvé a intentarlo.'));
    }, type, quality));
  }
  function outputFile(blob, original) {
    const extension = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' }[blob.type];
    if (!extension) throw new Error('El navegador no pudo generar un formato de foto válido.');
    return new File([blob], `${original.name.replace(/\.[^.]+$/, '') || 'foto'}.${extension}`, { type: blob.type });
  }
  async function compress(file) {
    validate([file]);
    let bitmap;
    try { bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch { throw new Error(`No se pudo abrir ${file.name}. Probá exportarla como JPG y volver a cargarla.`); }
    const canvas = document.createElement('canvas');
    try {
      if (!bitmap.width || !bitmap.height) throw new Error('La foto no tiene dimensiones válidas.');
      const originalLongest = Math.max(bitmap.width, bitmap.height);
      if (file.size <= MAX_BYTES && originalLongest <= MAX_DIMENSION) return outputFile(file, file);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('El navegador no permite preparar las fotos. Probá con otro navegador.');
      let dimension = Math.min(MAX_DIMENSION, originalLongest);
      let type = 'image/webp';
      for (let attempt = 0; attempt < 6; attempt++) {
        const scale = dimension / originalLongest;
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        const draw = () => {
          context.clearRect(0, 0, canvas.width, canvas.height);
          if (type === 'image/jpeg') { context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height); }
          context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        };
        draw();
        for (const quality of [0.82, 0.74, 0.66]) {
          let blob = await encode(canvas, type, quality);
          // Some browsers return PNG when WebP encoding is unavailable.
          if (blob.type !== type) {
            if (type === 'image/jpeg') throw new Error('Tu navegador no permite comprimir estas fotos.');
            type = 'image/jpeg'; draw(); blob = await encode(canvas, type, quality);
            if (blob.type !== type) throw new Error('Tu navegador no permite comprimir estas fotos.');
          }
          if (blob.size <= MAX_BYTES) {
            // Never enlarge an already-small, correctly sized source file.
            if (originalLongest <= MAX_DIMENSION && file.size <= blob.size) return outputFile(file, file);
            return outputFile(blob, file);
          }
        }
        dimension = Math.max(1, Math.floor(dimension * 0.8));
      }
      throw new Error(`No se pudo reducir ${file.name} a 300 KB. Elegí una versión más pequeña.`);
    } finally {
      bitmap.close();
      canvas.width = canvas.height = 1;
    }
  }
  async function prepare(files, onProgress = () => {}) {
    const selected = Array.from(files);
    validate(selected); // Validate the whole selection before encoding or uploading anything.
    const prepared = [];
    for (let i = 0; i < selected.length; i++) {
      onProgress(i + 1, selected.length);
      prepared.push(await compress(selected[i]));
    }
    return prepared;
  }
  window.ImageCompression = { prepare, compress, MAX_BYTES, MAX_DIMENSION };
})();
