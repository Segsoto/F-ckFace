// Catálogo interactivo para Fuck Face
const products = [
  {
    id: 1,
    title: 'The North Face Baltoro 700',
    category: 'camperas',
    brand: 'The North Face',
    size: 'L',
    condition: 'Muy buena',
    price: '₡312.000',
    oldPrice: '₡390.000',
    description: 'Abrigo premium con relleno técnico y estética de archivo para uso constante.',
    accent: 'Campera',
    visual: '🧥',
    whatsappText: 'Hola, quiero consultar la The North Face Baltoro 700.'
  },
  {
    id: 2,
    title: 'Adidas Smith Vs Nastase',
    category: 'zapatillas',
    brand: 'Adidas',
    size: '40',
    condition: 'Excelente',
    price: '₡120.000',
    oldPrice: '₡150.000',
    description: 'Sneaker vintage con identidad retro y un look de archivo muy reconocible.',
    accent: 'Zapatillas',
    visual: '👟',
    whatsappText: 'Hola, quiero consultar las Adidas Smith Vs Nastase.'
  },
  {
    id: 3,
    title: 'Nike Total 90 SP “OG”',
    category: 'zapatillas',
    brand: 'Nike',
    size: '41',
    condition: 'Muy buena',
    price: '₡248.000',
    oldPrice: '₡310.000',
    description: 'Referente del fútbol vintage con silueta clásica y un perfil lleno de historia.',
    accent: 'Zapatillas',
    visual: '👟',
    whatsappText: 'Hola, quiero consultar el Nike Total 90 SP “OG”.'
  },
  {
    id: 4,
    title: 'Oakley Bag Tactical Field Car',
    category: 'accesorios',
    brand: 'Oakley',
    size: 'Única',
    condition: 'Excelente',
    price: '₡144.000',
    oldPrice: '₡180.000',
    description: 'Accesorio urbano con fuerte identidad técnica y una estética de archivo.',
    accent: 'Accesorio',
    visual: '🎒',
    whatsappText: 'Hola, quiero consultar el Oakley Bag Tactical Field Car.'
  },
  {
    id: 5,
    title: 'Nike ACG 2000',
    category: 'buzos',
    brand: 'Nike',
    size: 'M',
    condition: 'Muy buena',
    price: '₡84.000',
    oldPrice: '₡105.000',
    description: 'Buzo técnico con detalles archive y un corte cómodo para uso diario.',
    accent: 'Buzo',
    visual: '🧢',
    whatsappText: 'Hola, quiero consultar el Nike ACG 2000.'
  },
  {
    id: 6,
    title: 'Nike Fit Barcelona 2007',
    category: 'remeras',
    brand: 'Nike',
    size: 'L',
    condition: 'Excelente',
    price: '₡72.000',
    oldPrice: '₡90.000',
    description: 'Remera vintage con look deportivo y un colorway que funciona perfecto en outfits.',
    accent: 'Remera',
    visual: '👕',
    whatsappText: 'Hola, quiero consultar la Nike Fit Barcelona 2007.'
  },
  {
    id: 7,
    title: 'Nike Anorak 2010',
    category: 'camperas',
    brand: 'Nike',
    size: 'M',
    condition: 'Muy buena',
    price: '₡72.000',
    oldPrice: '₡90.000',
    description: 'Campera técnica con estética de archivo, funcional y bien pensada para el día a día.',
    accent: 'Campera',
    visual: '🧥',
    whatsappText: 'Hola, quiero consultar la Nike Anorak 2010.'
  },
  {
    id: 8,
    title: 'Nike Athletic de Madrid 2008',
    category: 'remeras',
    brand: 'Nike',
    size: 'XL',
    condition: 'Buena',
    price: '₡144.000',
    oldPrice: '₡180.000',
    description: 'Diseño clásico y fuerte, con presencia en looks de invierno o verano cargados.',
    accent: 'Remera',
    visual: '👕',
    whatsappText: 'Hola, quiero consultar la Nike Athletic de Madrid 2008.'
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