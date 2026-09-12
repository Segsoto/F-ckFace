(function () {
  const watched = new WeakSet();
  function update(img) {
    const frame = img.parentElement;
    if (!frame) return;
    frame.classList.toggle("photo-loading", !img.complete);
    frame.classList.toggle("photo-error", img.complete && img.naturalWidth === 0);
  }
  function watch(img) {
    if (!watched.has(img)) {
      watched.add(img);
      img.addEventListener("load", () => update(img));
      img.addEventListener("error", () => update(img));
    }
    update(img);
  }
  function prepare(root) {
    root.querySelectorAll(".product-image img, .dialog-gallery-item img").forEach(watch);
  }
  function setSource(img, src) {
    img.decoding = "async";
    img.src = src;
    watch(img);
  }
  window.ProductImages = { prepare, setSource };
})();
