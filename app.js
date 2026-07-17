// Catálogo interactivo para Fuck Face
const products = [
  {
    id: 1,
    title: 'Camisa técnica ligera',
    category: 'camisas',
    brand: 'North Face',
    size: 'M',
    condition: 'Muy buena',
    price: '₡18.000',
    description: 'Ideal para salidas urbanas o outdoor, con corte cómodo y excelente estado.',
    accent: 'Camisa',
    visual: '🧥',
    whatsappText: 'Hola, quiero consultar la Camisa técnica ligera.'
  },
  {
    id: 2,
    title: 'Abrigo vintage premium',
    category: 'abrigos',
    brand: 'Columbia',
    size: 'L',
    condition: 'Excelente',
    price: '₡24.000',
    description: 'Abrigo resistente y con estilo para clima fresco. Muy fácil de combinar.',
    accent: 'Abrigo',
    visual: '🧥',
    whatsappText: 'Hola, quiero consultar el Abrigo vintage premium.'
  },
  {
    id: 3,
    title: 'Pantalón outdoor',
    category: 'pantalones',
    brand: 'Patagonia',
    size: '32',
    condition: 'Bueno',
    price: '₡16.000',
    description: 'Pantalón funcional, cómodo y perfecto para uso diario o trekking.',
    accent: 'Pantalón',
    visual: '👖',
    whatsappText: 'Hola, quiero consultar el Pantalón outdoor.'
  },
  {
    id: 4,
    title: 'Mochila urbana',
    category: 'accesorios',
    brand: 'Arc’teryx',
    size: 'Única',
    condition: 'Excelente',
    price: '₡20.000',
    description: 'Mochila ligera con detalle premium y gran capacidad para diario.',
    accent: 'Accesorio',
    visual: '🎒',
    whatsappText: 'Hola, quiero consultar la Mochila urbana.'
  },
  {
    id: 5,
    title: 'New Drop: chaqueta ligera',
    category: 'newdrop',
    brand: 'Tommy Hilfiger',
    size: 'S',
    condition: 'Nueva',
    price: '₡22.000',
    description: 'Entrada nueva al catálogo con un look limpio y muy fácil de estilizar.',
    accent: 'New Drop',
    visual: '🧥',
    whatsappText: 'Hola, quiero consultar la chaqueta ligera del New Drop.'
  },
  {
    id: 6,
    title: 'Cazadora vintage',
    category: 'abrigos',
    brand: 'North Face',
    size: 'L',
    condition: 'Muy buena',
    price: '₡28.000',
    description: 'Diseño con carácter, excelente para quien busca una pieza de alto impacto.',
    accent: 'Abrigo',
    visual: '🧥',
    whatsappText: 'Hola, quiero consultar la Cazadora vintage.'
  }
];

const hamburger = document.querySelector('.hamburger');
const body = document.body;
const productGrid = document.getElementById('productGrid');
const filterButtons = document.querySelectorAll('.filter-btn');
const modal = document.getElementById('productModal');
const modalTitle = document.getElementById('modalTitle');
const modalKicker = document.getElementById('modalKicker');
const modalDescription = document.getElementById('modalDescription');
const modalBrand = document.getElementById('modalBrand');
const modalSize = document.getElementById('modalSize');
const modalCondition = document.getElementById('modalCondition');
const modalPrice = document.getElementById('modalPrice');
const modalBadge = document.getElementById('modalBadge');
const modalVisual = document.getElementById('modalVisual');
const modalWhatsapp = document.getElementById('modalWhatsapp');

if (hamburger) {
  hamburger.addEventListener('click', () => {
    body.classList.toggle('menu-open');
  });
}

function renderProducts(filter = 'all') {
  if (!productGrid) return;

  productGrid.innerHTML = '';

  const visibleProducts = products.filter((product) => {
    if (filter === 'all') return true;
    return product.category === filter;
  });

  visibleProducts.forEach((product) => {
    const article = document.createElement('article');
    article.className = 'product-card';
    article.innerHTML = `
      <div class="product-card__visual">${product.visual}</div>
      <div class="product-card__info">
        <span class="tag">${product.accent}</span>
        <h3>${product.title}</h3>
        <p>${product.description}</p>
        <div class="product-card__meta">
          <span>${product.brand}</span>
          <strong>${product.price}</strong>
        </div>
      </div>
      <div class="product-card__footer">
        <button class="product-card__btn" type="button" data-action="detail">Ver detalles</button>
        <a class="product-card__link" href="https://wa.me/50663620357?text=${encodeURIComponent(product.whatsappText)}" target="_blank" rel="noopener">Contactar</a>
      </div>
    `;

    article.addEventListener('click', (event) => {
      if (event.target.closest('.product-card__link') || event.target.closest('.product-card__btn')) {
        return;
      }
      openModal(product);
    });

    article.querySelector('.product-card__btn').addEventListener('click', (event) => {
      event.stopPropagation();
      openModal(product);
    });

    article.querySelector('.product-card__link').addEventListener('click', (event) => {
      event.stopPropagation();
    });

    productGrid.appendChild(article);
  });
}

function openModal(product) {
  if (!modal) return;

  modalTitle.textContent = product.title;
  modalKicker.textContent = `${product.brand} · ${product.size}`;
  modalDescription.textContent = product.description;
  modalBrand.textContent = product.brand;
  modalSize.textContent = product.size;
  modalCondition.textContent = product.condition;
  modalPrice.textContent = product.price;
  modalBadge.textContent = product.accent;
  modalVisual.textContent = product.visual;
  modalWhatsapp.href = `https://wa.me/50663620357?text=${encodeURIComponent(product.whatsappText)}`;

  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  body.classList.add('modal-open');
}

function closeModal() {
  if (!modal) return;
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  body.classList.remove('modal-open');
}

filterButtons.forEach((button) => {
  button.addEventListener('click', () => {
    filterButtons.forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    renderProducts(button.dataset.filter || 'all');
  });
});

document.querySelectorAll('[data-close-modal]').forEach((element) => {
  element.addEventListener('click', closeModal);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeModal();
});

renderProducts('all');
console.log('Fuck Face listo para vender por WhatsApp.');