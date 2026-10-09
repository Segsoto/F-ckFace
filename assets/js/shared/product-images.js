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
  function thumbnailFor(product, source) {
    const entry = window.ProductThumbnails?.[product.id];
    const preview = entry?.gallery?.find((image) => image.source === source);
    return preview?.thumbnail || (entry?.source === source ? entry.thumbnail : source);
  }
  function renderGallery(gallery, mainImage, product, images) {
    gallery.replaceChildren();
    gallery.style.display = images.length > 1 ? "flex" : "none";
    let selectedIndex = 0;
    images.forEach((source, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `dialog-gallery-item ${index === 0 ? "active" : ""}`;
      button.setAttribute("aria-label", `Ver imagen ${index + 1} de ${product.name}`);
      button.setAttribute("aria-pressed", String(index === 0));
      const preview = document.createElement("img");
      preview.alt = "";
      preview.width = 62;
      preview.height = 62;
      preview.loading = "lazy";
      preview.fetchPriority = "low";
      button.appendChild(preview);
      const thumbnail = thumbnailFor(product, source);
      if (thumbnail !== source) {
        preview.addEventListener("error", () => setSource(preview, source), { once: true });
      }
      setSource(preview, thumbnail);
      button.addEventListener("click", () => {
        if (selectedIndex === index) return;
        selectedIndex = index;
        setSource(mainImage, source);
        gallery.querySelectorAll(".dialog-gallery-item").forEach((item) => {
          const active = item === button;
          item.classList.toggle("active", active);
          item.setAttribute("aria-pressed", String(active));
        });
      });
      gallery.appendChild(button);
    });
  }
  window.ProductImages = { prepare, setSource, renderGallery, thumbnailFor };
})();
