const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function setup(thumbnails = {}) {
  const requests = [];
  function element(tag) {
    const events = new Map();
    return {
      tag, children: [], style: {}, attributes: {}, complete: false,
      className: '',
      classList: { toggle() {} },
      setAttribute(name, value) { this.attributes[name] = value; },
      appendChild(child) { child.parentElement = this; this.children.push(child); },
      replaceChildren() { this.children = []; },
      querySelectorAll() { return this.children; },
      addEventListener(name, callback, options) {
        if (!events.has(name)) events.set(name, []);
        events.get(name).push({ callback, once: options?.once });
      },
      emit(name) {
        const handlers = events.get(name) || [];
        events.set(name, handlers.filter(handler => !handler.once));
        handlers.forEach(handler => handler.callback());
      },
      set src(value) { this.source = value; requests.push({ tag, source: value }); },
      get src() { return this.source; },
    };
  }
  const window = { ProductThumbnails: thumbnails };
  vm.runInNewContext(fs.readFileSync('assets/js/shared/product-images.js', 'utf8'), {
    window, document: { createElement: element },
  });
  const gallery = element('gallery');
  const main = element('main');
  return { api: window.ProductImages, gallery, main, requests };
}

test('opening a gallery requests static lazy previews, and originals only when selected', () => {
  const { api, gallery, main, requests } = setup({ piece: {
    source: 'front.jpg', thumbnail: 'cover.webp', gallery: [
      { source: 'front.jpg', thumbnail: 'front.webp' },
      { source: 'back.jpg', thumbnail: 'back.webp' },
    ],
  } });
  api.setSource(main, 'front.jpg');
  api.renderGallery(gallery, main, { id: 'piece', name: 'Jacket' }, ['front.jpg', 'back.jpg']);
  assert.deepEqual(requests.map(request => request.source), ['front.jpg', 'front.webp', 'back.webp']);
  gallery.children.forEach(button => {
    const image = button.children[0];
    assert.equal(image.loading, 'lazy');
    assert.equal(image.decoding, 'async');
    assert.equal(image.fetchPriority, 'low');
    assert.equal(image.width, 62);
    assert.equal(image.alt, '');
  });
  gallery.children[0].emit('click');
  assert.equal(requests.length, 3, 'Selecting the active image does not request it again');
  gallery.children[1].emit('click');
  assert.equal(main.src, 'back.jpg');
  assert.equal(gallery.children[1].attributes['aria-pressed'], 'true');
  assert.equal(gallery.children[0].attributes['aria-pressed'], 'false');
});

test('preview lookup follows the source when photos change order and rejects outdated mappings', () => {
  const { api } = setup({ piece: {
    source: 'old.jpg', thumbnail: 'old.webp',
    gallery: [{ source: 'back.jpg', thumbnail: 'back.webp' }],
  } });
  assert.equal(api.thumbnailFor({ id: 'piece' }, 'back.jpg'), 'back.webp');
  assert.equal(api.thumbnailFor({ id: 'piece' }, 'replacement.jpg'), 'replacement.jpg');
  assert.equal(api.thumbnailFor({ id: 'piece' }, 'old.jpg'), 'old.webp');
  assert.equal(api.thumbnailFor({ id: 'new' }, 'back.jpg'), 'back.jpg');
});

test('missing static previews fall back once to the original without an error loop', () => {
  const { api, gallery, main, requests } = setup({ piece: { source: 'front.jpg', thumbnail: 'missing.webp' } });
  api.renderGallery(gallery, main, { id: 'piece', name: 'Jacket' }, ['front.jpg', 'back.jpg']);
  const preview = gallery.children[0].children[0];
  preview.emit('error');
  assert.equal(preview.src, 'front.jpg');
  preview.emit('error');
  assert.equal(requests.length, 3);
  assert.equal(gallery.children[1].children[0].src, 'back.jpg');
});

test('reopening replaces the previous gallery and hides navigation for one photo', () => {
  const { api, gallery, main } = setup();
  api.renderGallery(gallery, main, { id: 'piece', name: 'Jacket' }, ['front.jpg', 'back.jpg']);
  api.renderGallery(gallery, main, { id: 'other', name: 'Pants' }, ['pants.jpg']);
  assert.equal(gallery.children.length, 1);
  assert.equal(gallery.style.display, 'none');
  assert.equal(gallery.children[0].children[0].src, 'pants.jpg');
});
