// Catálogo interactivo para Fuck Face
const products = [
  {
    id: 1,
    title: 'The North Face Baltoro 700',
    category: 'camperas',
    brand: 'The North Face',
    size: 'S',
    condition: '10/10',
    sku: 'THE-NORTH-FACE-BALTORO-700-1CH5A',
    price: '₡390.000',
    oldPrice: '₡312.000 con transferencia',
    discountedPrice: '₡312.000',
    description: 'Impecable. Sin uso o prácticamente sin uso. Medidas: 54cm de ancho / 66cm de largo.',
    accent: 'Pieza única',
    whatsappText: 'Hola! Me interesa esta pieza: THE NORTH FACE BALTORO 700.',
    promoText: '20% de descuento pagando con transferencia o depósito bancario.',
    installments: '3 cuotas sin interés de ₡130.000.',
    measures: 'Medidas: 54cm de ancho / 66cm de largo. Talle S. Para consultar medidas exactas, escribinos por WhatsApp.',
    conditionText: 'Impecable. Sin uso o prácticamente sin uso.',
    images: [
      'https://cauzerstore.com/assets/img/products/the-north-face-baltoro-700-1ch5a-10.jpg',
      'https://cauzerstore.com/assets/img/products/the-north-face-baltoro-700-1ch5a-2.jpg',
      'https://cauzerstore.com/assets/img/products/the-north-face-baltoro-700-1ch5a-3.jpg',
      'https://cauzerstore.com/assets/img/products/the-north-face-baltoro-700-1ch5a-4.jpg',
      'https://cauzerstore.com/assets/img/products/the-north-face-baltoro-700-1ch5a-5.jpg'
    ],
    visual: '🧥'
  },
  {
    id: 2,
    title: 'Adidas Smith Vs Nastase',
    category: 'zapatillas',
    brand: 'Adidas',
    size: '40',
    condition: 'Excelente',
    sku: 'ADIDAS-SMITH-VS-NASTASE',
    price: '₡120.000',
    oldPrice: '₡150.000',
    description: 'Sneaker vintage con identidad retro y un look de archivo muy reconocible.',
    accent: 'Zapatillas',
    whatsappText: 'Hola, quiero consultar las Adidas Smith Vs Nastase.',
    promoText: 'Descuento especial para pago por transferencia.',
    installments: '3 cuotas sin interés.',
    measures: 'Talle 40. Consulta medidas y detalle por WhatsApp.',
    conditionText: 'Excelente estado con uso mínimo.',
    images: [
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?auto=format&fit=crop&w=900&q=80'
    ],
    visual: '👟'
  },
  {
    id: 3,
    title: 'Nike Total 90 SP “OG”',
    category: 'zapatillas',
    brand: 'Nike',
    size: '41',
    condition: 'Muy buena',
    sku: 'NIKE-TOTAL-90-SP-OG',
    price: '₡248.000',
    oldPrice: '₡310.000',
    description: 'Referente del fútbol vintage con silueta clásica y un perfil lleno de historia.',
    accent: 'Zapatillas',
    whatsappText: 'Hola, quiero consultar el Nike Total 90 SP “OG”.',
    promoText: 'Descuento por transferencia disponible.',
    installments: '3 cuotas sin interés.',
    measures: 'Talle 41. Consulte condiciones exactas por WhatsApp.',
    conditionText: 'Muy buena condición visual y estructural.',
    images: [
      'https://images.unsplash.com/photo-1608231387042-66d1773070a5?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?auto=format&fit=crop&w=900&q=80'
    ],
    visual: '👟'
  },
  {
    id: 4,
    title: 'Oakley Bag Tactical Field Car',
    category: 'accesorios',
    brand: 'Oakley',
    size: 'Única',
    condition: 'Excelente',
    sku: 'OAKLEY-BAG-TACTICAL-FIELD-CAR',
    price: '₡144.000',
    oldPrice: '₡180.000',
    description: 'Accesorio urbano con fuerte identidad técnica y una estética de archivo.',
    accent: 'Accesorio',
    whatsappText: 'Hola, quiero consultar el Oakley Bag Tactical Field Car.',
    promoText: 'Envío y pago directo disponibles.',
    installments: 'Cuotas por Mercado Pago o transferencia.',
    measures: 'Tamaño único. Ideal para uso diario.',
    conditionText: 'Excelente estado, sin daños visibles.',
    images: [
      'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80'
    ],
    visual: '🎒'
  },
  {
    id: 5,
    title: 'Nike ACG 2000',
    category: 'buzos',
    brand: 'Nike',
    size: 'M',
    condition: 'Muy buena',
    sku: 'NIKE-ACG-2000',
    price: '₡84.000',
    oldPrice: '₡105.000',
    description: 'Buzo técnico con detalles archive y un corte cómodo para uso diario.',
    accent: 'Buzo',
    whatsappText: 'Hola, quiero consultar el Nike ACG 2000.',
    promoText: 'Descuento con transferencia activa.',
    installments: '3 cuotas sin interés.',
    measures: 'Talle M con corte regular.',
    conditionText: 'Uso mínimo. Todo en perfecto estado.',
    images: [
      'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=900&q=80'
    ],
    visual: '🧢'
  },
  {
    id: 6,
    title: 'Nike Fit Barcelona 2007',
    category: 'remeras',
    brand: 'Nike',
    size: 'L',
    condition: 'Excelente',
    sku: 'NIKE-FIT-BARCELONA-2007',
    price: '₡72.000',
    oldPrice: '₡90.000',
    description: 'Remera vintage con look deportivo y un colorway que funciona perfecto en outfits.',
    accent: 'Remera',
    whatsappText: 'Hola, quiero consultar la Nike Fit Barcelona 2007.',
    promoText: 'Cobertura total para Costa Rica.',
    installments: 'Pago directo o transferencia.',
    measures: 'Talle L. Consulta tone y medidas por WhatsApp.',
    conditionText: 'Sin uso visible ni desgaste relevante.',
    images: [
      'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=900&q=80'
    ],
    visual: '👕'
  },
  {
    id: 7,
    title: 'Nike Anorak 2010',
    category: 'camperas',
    brand: 'Nike',
    size: 'M',
    condition: 'Muy buena',
    sku: 'NIKE-ANORAK-2010',
    price: '₡72.000',
    oldPrice: '₡90.000',
    description: 'Campera técnica con estética de archivo, funcional y bien pensada para el día a día.',
    accent: 'Campera',
    whatsappText: 'Hola, quiero consultar la Nike Anorak 2010.',
    promoText: 'Envío a todo el país y pago seguro.',
    installments: 'Cuotas disponibles en algunos métodos.',
    measures: 'Talle M. Consulta medidas exactas por WhatsApp.',
    conditionText: 'Muy buena conservación, sin costuras rotas.',
    images: [
      'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=80'
    ],
    visual: '🧥'
  },
  {
    id: 8,
    title: 'Nike Athletic de Madrid 2008',
    category: 'remeras',
    brand: 'Nike',
    size: 'XL',
    condition: 'Buena',
    sku: 'NIKE-ATHLETIC-DE-MADRID-2008',
    price: '₡144.000',
    oldPrice: '₡180.000',
    description: 'Diseño clásico y fuerte, con presencia en looks de invierno o verano cargados.',
    accent: 'Remera',
    whatsappText: 'Hola, quiero consultar la Nike Athletic de Madrid 2008.',
    promoText: 'Descuento disponible para pago por transferencia.',
    installments: '3 cuotas sin interés.',
    measures: 'Talle XL. Escribinos para confirmar medidas exactas.',
    conditionText: 'Buena, con mínimo desgaste de uso.',
    images: [
      'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80'
    ],
    visual: '👕'
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
const modalOldPrice = document.getElementById('modalOldPrice');
const modalPromo = document.getElementById('modalPromo');
const modalInstallments = document.getElementById('modalInstallments');
const modalBadge = document.getElementById('modalBadge');
const modalSku = document.getElementById('modalSku');
const modalConditionText = document.getElementById('modalConditionText');
const modalMeasures = document.getElementById('modalMeasures');
const modalMainImage = document.getElementById('modalMainImage');
const galleryThumbs = document.getElementById('galleryThumbs');
const modalWhatsapp = document.getElementById('modalWhatsapp');
const copyLinkBtn = document.querySelector('.copy-link-btn');
const categoryCarousel = document.getElementById('categoryCarousel');
const prevBtn = document.querySelector('.carousel-nav.prev');
const nextBtn = document.querySelector('.carousel-nav.next');

if (hamburger) {
  hamburger.addEventListener('click', () => {
    body.classList.toggle('menu-open');
  });
}

if (categoryCarousel && prevBtn && nextBtn) {
  prevBtn.addEventListener('click', () => {
    categoryCarousel.scrollBy({ left: -280, behavior: 'smooth' });
  });

  nextBtn.addEventListener('click', () => {
    categoryCarousel.scrollBy({ left: 280, behavior: 'smooth' });
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

function updateGallery(images) {
  if (!galleryThumbs || !modalMainImage) return;

  galleryThumbs.innerHTML = '';

  images.forEach((image, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `gallery-thumb ${index === 0 ? 'is-active' : ''}`;
    button.innerHTML = `<img src="${image}" alt="Vista previa del producto ${index + 1}" />`;

    button.addEventListener('click', () => {
      modalMainImage.src = image;
      document.querySelectorAll('.gallery-thumb').forEach((thumb) => thumb.classList.remove('is-active'));
      button.classList.add('is-active');
    });

    galleryThumbs.appendChild(button);
  });

  modalMainImage.src = images[0];
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
  modalOldPrice.textContent = product.oldPrice;
  modalPromo.textContent = product.promoText;
  modalInstallments.textContent = product.installments;
  modalBadge.textContent = product.accent;
  modalSku.textContent = product.sku;
  modalConditionText.textContent = product.conditionText;
  modalMeasures.textContent = product.measures;
  modalWhatsapp.href = `https://wa.me/50663620357?text=${encodeURIComponent(product.whatsappText)}`;

  updateGallery(product.images);

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

if (copyLinkBtn) {
  copyLinkBtn.addEventListener('click', async () => {
    const url = window.location.href.split('#')[0] + '#coleccion';
    try {
      await navigator.clipboard.writeText(url);
      copyLinkBtn.textContent = 'Link copiado';
      setTimeout(() => {
        copyLinkBtn.textContent = 'Copiar link';
      }, 1200);
    } catch (error) {
      copyLinkBtn.textContent = 'No disponible';
    }
  });
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