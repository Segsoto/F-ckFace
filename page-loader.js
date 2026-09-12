(function () {
  const overlay = document.getElementById("pageLoader");
  if (!overlay) return;
  let finished = false;
  const pending = new Set();
  overlay.hidden = false;
  document.documentElement.classList.add("page-loading");
  function finish() {
    if (finished) return;
    finished = true;
    clearTimeout(deadline);
    pending.forEach(cancel => cancel());
    pending.clear();
    overlay.hidden = true;
    document.documentElement.classList.remove("page-loading");
  }
  // Starts before third-party scripts, so even a stalled script cannot trap visitors.
  const deadline = setTimeout(finish, 8000);
  function waitForImage(img) {
    return new Promise(resolve => {
      function done() {
        img.removeEventListener("load", done);
        img.removeEventListener("error", done);
        pending.delete(done);
        resolve();
      }
      pending.add(done);
      img.addEventListener("load", done, { once: true });
      img.addEventListener("error", done, { once: true });
      img.loading = "eager";
      if (img.complete) done();
    });
  }
  async function ready() {
    if (finished) return;
    const images = [
      ...document.querySelectorAll(".site-header img, .hero img, .category-card img"),
      ...[...document.querySelectorAll("#productGrid img")].slice(0, 8),
    ];
    await Promise.all(images.map(waitForImage));
    finish();
  }
  // Prevent keyboard navigation behind the overlay without hiding images from loading.
  document.addEventListener("keydown", event => {
    if (!finished && event.key === "Tab") event.preventDefault();
  });
  window.addEventListener("pagehide", finish, { once: true });
  window.StorePageLoader = { ready, finish };
})();
