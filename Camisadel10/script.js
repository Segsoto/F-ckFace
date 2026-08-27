// Variables globales
let currentSlide = 0;
let slides = [];
let totalSlides = 0;

// Tu número de WhatsApp
const WHATSAPP_NUMBER = '50689652370'; 
const PUBLIC_SITE_URL = 'https://www.lacamisadel10.com';

function toShareableImageUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return '';

    try {
        const url = new URL(rawUrl, window.location.href);
        const pathname = url.pathname || '';
        const imgIndex = pathname.toLowerCase().indexOf('/img/');

        if (url.protocol === 'https:' || url.protocol === 'http:') {
            const isLocalHost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
            if (isLocalHost && imgIndex !== -1) {
                return `${PUBLIC_SITE_URL}${pathname.slice(imgIndex)}`;
            }
            return url.href;
        }

        if (url.protocol === 'file:' && imgIndex !== -1) {
            return `${PUBLIC_SITE_URL}${pathname.slice(imgIndex)}`;
        }
    } catch (error) {
        if (rawUrl.startsWith('img/') || rawUrl.startsWith('/img/')) {
            const normalized = rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`;
            return `${PUBLIC_SITE_URL}${normalized}`;
        }
    }

    return '';
}

// Inicialización cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    slides = document.querySelectorAll('.carousel-slide');
    totalSlides = slides.length;
    
    if (slides.length > 0) {
        initCarousel();
    }
    initFilters();
    initMobileMenu();
    initAssistant();
    // initOrderButtons(); // Deshabilitado: app.js maneja botones din�micos
    initContactForm();
    initJerseyCarousels();
});

function initAssistant() {
    const widget = document.getElementById('assistantWidget');
    const panel = document.getElementById('assistantPanel');
    const messages = document.getElementById('assistantMessages');
    const choices = document.getElementById('assistantChoices');

    if (!widget || !panel || !messages || !choices) {
        return;
    }

    const categoryMap = {
        ligas: {
            label: 'Ligas Europeas',
            href: 'ligas.html',
            intro: 'Te gustan las camisetas de clubes y competiciones. Aquí tienes la categoría de ligas para ver camisetas relacionadas.'
        },
        selecciones: {
            label: 'Selecciones Nacionales',
            href: 'selecciones.html',
            intro: 'Prefieres camisetas de países. Esta categoría te lleva a las selecciones que tenemos disponibles.'
        },
        retro: {
            label: 'Camisetas Retro',
            href: 'retro.html',
            intro: 'Te gustan los diseños clásicos y con historia. Esta categoría es para ti.'
        },
        uniformes: {
            label: 'Uniformes',
            href: 'uniformes.html',
            intro: 'Buscas algo más deportivo y versátil. Aquí puedes ver uniformes relacionados.'
        }
    };

    const recommendationPool = [
        { name: 'Real Madrid Player', price: 21000, href: 'ligas.html', category: 'ligas' },
        { name: 'Barcelona Retro', price: 21000, href: 'retro.html', category: 'retro' },
        { name: 'Manchester United', price: 20500, href: 'ligas.html', category: 'ligas' },
        { name: 'PSG Edicion Especial', price: 22000, href: 'ligas.html', category: 'ligas' },
        { name: 'Argentina Seleccion', price: 20000, href: 'selecciones.html', category: 'selecciones' },
        { name: 'Brasil Seleccion', price: 20000, href: 'selecciones.html', category: 'selecciones' },
        { name: 'Juventus Player', price: 21000, href: 'ligas.html', category: 'ligas' },
        { name: 'AC Milan Retro', price: 21000, href: 'retro.html', category: 'retro' },
        { name: 'Uniforme Kids Portugal', price: 25000, href: 'uniformes.html', category: 'uniformes' },
        { name: 'Uniforme Kids Barcelona', price: 25000, href: 'uniformes.html', category: 'uniformes' }
    ];

    const fallbackChoices = [
        { label: 'Ligas Europeas', category: 'ligas' },
        { label: 'Selecciones Nacionales', category: 'selecciones' },
        { label: 'Camisetas Retro', category: 'retro' },
        { label: 'Uniformes', category: 'uniformes' },
        { label: 'No se, recomiendame', category: 'recomendar' },
        { label: 'Escribir por WhatsApp', category: 'whatsapp' }
    ];

    function formatCRC(value) {
        return `₡${Number(value).toLocaleString('es-CR')}`;
    }

    function pickRandomRecommendations(minPrice, amount) {
        const candidates = recommendationPool.filter(item => Number(item.price) > minPrice);
        const shuffled = [...candidates].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, amount);
    }

    function scrollMessagesToBottom() {
        messages.scrollTop = messages.scrollHeight;
    }

    function openAssistant() {
        panel.hidden = false;
        widget.classList.add('open');
        scrollMessagesToBottom();
    }

    function closeAssistant() {
        panel.hidden = true;
        widget.classList.remove('open');
    }

    function addMessage(text, type) {
        const message = document.createElement('div');
        message.className = `assistant-message ${type}`;
        message.textContent = text;
        messages.insertBefore(message, choices);
        scrollMessagesToBottom();
    }

    function renderChoices(list) {
        choices.innerHTML = '';
        list.forEach(item => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'assistant-chip';
            button.textContent = item.label;
            button.dataset.category = item.category;
            choices.appendChild(button);
        });
        scrollMessagesToBottom();
    }

    function showFallbackQuestion() {
        addMessage('Perfecto. ¿Qué te gusta más?', 'bot');
        renderChoices([
            { label: 'Camisetas de clubes', category: 'ligas' },
            { label: 'Camisetas de países', category: 'selecciones' },
            { label: 'Diseños clásicos', category: 'retro' },
            { label: 'Modelos deportivos', category: 'uniformes' }
        ]);
    }

    function showCategory(category) {
        const data = categoryMap[category];
        if (!data) {
            showFallbackQuestion();
            return;
        }

        addMessage(`Elegiste ${data.label}. ${data.intro}`, 'bot');
        choices.innerHTML = '';

        const actionGroup = document.createElement('div');
        actionGroup.className = 'assistant-result-group';

        const goButton = document.createElement('button');
        goButton.type = 'button';
        goButton.className = 'assistant-result-btn';
        goButton.textContent = `Ver ${data.label}`;
        goButton.addEventListener('click', function() {
            window.location.href = data.href;
        });

        const restartButton = document.createElement('button');
        restartButton.type = 'button';
        restartButton.className = 'assistant-result-btn';
        restartButton.textContent = 'Elegir otra categoría';
        restartButton.addEventListener('click', function() {
            addMessage('Claro, dime cuál prefieres ahora.', 'bot');
            renderChoices(fallbackChoices);
        });

        const whatsappButton = document.createElement('button');
        whatsappButton.type = 'button';
        whatsappButton.className = 'assistant-result-btn';
        whatsappButton.textContent = 'Enviar por WhatsApp';
        whatsappButton.addEventListener('click', function() {
            const whatsappMessage = `Hola, necesito ayuda para elegir camisetas de ${data.label.toLowerCase()} en La Camisa del 10.`;
            const whatsappURL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(whatsappMessage)}`;
            window.open(whatsappURL, '_blank');
        });

        actionGroup.appendChild(goButton);
        actionGroup.appendChild(whatsappButton);
        actionGroup.appendChild(restartButton);
        choices.appendChild(actionGroup);
        scrollMessagesToBottom();
    }

    function showRandomRecommendations() {
        const recommendations = pickRandomRecommendations(19000, 5);

        addMessage('Perfecto. Te recomiendo estas 5 camisetas aleatorias de mas de ₡19.000:', 'bot');
        choices.innerHTML = '';

        const actionGroup = document.createElement('div');
        actionGroup.className = 'assistant-result-group';

        recommendations.forEach(item => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'assistant-result-btn';
            button.textContent = `${item.name} - ${formatCRC(item.price)}`;
            button.addEventListener('click', function() {
                window.location.href = item.href;
            });
            actionGroup.appendChild(button);
        });

        const whatsappAllButton = document.createElement('button');
        whatsappAllButton.type = 'button';
        whatsappAllButton.className = 'assistant-result-btn';
        whatsappAllButton.textContent = 'Enviar estas recomendaciones por WhatsApp';
        whatsappAllButton.addEventListener('click', function() {
            const summary = recommendations
                .map(item => `- ${item.name} (${formatCRC(item.price)})`)
                .join('\n');
            const whatsappMessage = `Hola, quiero informacion de estas camisetas recomendadas:\n${summary}`;
            const whatsappURL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(whatsappMessage)}`;
            window.open(whatsappURL, '_blank');
        });

        const restartButton = document.createElement('button');
        restartButton.type = 'button';
        restartButton.className = 'assistant-result-btn';
        restartButton.textContent = 'Quiero otras 5 recomendaciones';
        restartButton.addEventListener('click', function() {
            showRandomRecommendations();
        });

        actionGroup.appendChild(whatsappAllButton);
        actionGroup.appendChild(restartButton);
        choices.appendChild(actionGroup);
        scrollMessagesToBottom();
    }

    document.querySelectorAll('[data-assistant-open]').forEach(button => {
        button.addEventListener('click', openAssistant);
    });

    const closeButton = document.querySelector('[data-assistant-close]');
    if (closeButton) {
        closeButton.addEventListener('click', closeAssistant);
    }

    choices.addEventListener('click', function(event) {
        const button = event.target.closest('[data-category]');
        if (!button) {
            return;
        }

        const category = button.dataset.category;
        const label = button.textContent.trim();

        addMessage(label, 'user');

        if (category === 'recomendar') {
            showRandomRecommendations();
            return;
        }

        if (category === 'whatsapp') {
            addMessage('Perfecto, te abro WhatsApp para que te ayudemos con tu compra.', 'bot');
            const whatsappMessage = 'Hola, quiero ayuda para elegir camisetas de futbol de muy buena calidad en La Camisa del 10.';
            const whatsappURL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(whatsappMessage)}`;
            window.open(whatsappURL, '_blank');
            renderChoices(fallbackChoices);
            return;
        }

        showCategory(category);
    });

    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            closeAssistant();
        }
    });
}

// ========== CARRUSEL ==========
function initCarousel() {
    // Crear dots
    const dotsContainer = document.querySelector('.carousel-dots');
    slides.forEach((_, index) => {
        const dot = document.createElement('span');
        dot.classList.add('dot');
        if (index === 0) dot.classList.add('active');
        dot.addEventListener('click', () => goToSlide(index));
        dotsContainer.appendChild(dot);
    });

    // Botones de navegación
    document.querySelector('.carousel-btn.prev').addEventListener('click', prevSlide);
    document.querySelector('.carousel-btn.next').addEventListener('click', nextSlide);

    // Auto-slide cada 5 segundos
    setInterval(nextSlide, 5000);
}

function showSlide(index) {
    slides.forEach((slide, i) => {
        slide.classList.remove('active');
        if (i === index) {
            slide.classList.add('active');
        }
    });

    // Actualizar dots
    const dots = document.querySelectorAll('.dot');
    dots.forEach((dot, i) => {
        dot.classList.remove('active');
        if (i === index) {
            dot.classList.add('active');
        }
    });
}

function nextSlide() {
    currentSlide = (currentSlide + 1) % totalSlides;
    showSlide(currentSlide);
}

function prevSlide() {
    currentSlide = (currentSlide - 1 + totalSlides) % totalSlides;
    showSlide(currentSlide);
}

function goToSlide(index) {
    currentSlide = index;
    showSlide(currentSlide);
}

// ========== FILTROS DE LIGAS ==========
function initFilters() {
    const filterButtons = document.querySelectorAll('.filter-btn');

    if (filterButtons.length === 0) {
        return;
    }

    function applyFilter(filterValue) {
        const jerseyCards = document.querySelectorAll('.jersey-card[data-league]');

        jerseyCards.forEach(card => {
            if (filterValue === 'all') {
                card.classList.remove('hidden');
                setTimeout(() => {
                    card.style.display = 'block';
                }, 10);
                return;
            }

            if (card.getAttribute('data-league') === filterValue) {
                card.classList.remove('hidden');
                setTimeout(() => {
                    card.style.display = 'block';
                }, 10);
            } else {
                card.classList.add('hidden');
                setTimeout(() => {
                    card.style.display = 'none';
                }, 300);
            }
        });
    }

    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Remover clase active de todos los botones
            filterButtons.forEach(btn => btn.classList.remove('active'));
            // Agregar clase active al botón clickeado
            this.classList.add('active');

            const filterValue = this.getAttribute('data-league');

            // Filtrar tarjetas (incluye dinámicas cargadas después)
            applyFilter(filterValue);
        });
    });

    // Exponer para aplicar filtro activo luego de cargar dinámicas desde app.js
    window.applyActiveLeagueFilter = function() {
        const active = document.querySelector('.filter-btn.active');
        const value = active ? active.getAttribute('data-league') : 'all';
        applyFilter(value || 'all');
    };
}

// ========== MENÚ MÓVIL ==========
function initMobileMenu() {
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');
    const navLinks = document.querySelectorAll('.nav-menu a');

    if (hamburger) {
        hamburger.addEventListener('click', function() {
            navMenu.classList.toggle('active');
            
            // Animación del hamburger
            const spans = this.querySelectorAll('span');
            if (navMenu.classList.contains('active')) {
                spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
                spans[1].style.opacity = '0';
                spans[2].style.transform = 'rotate(-45deg) translate(7px, -6px)';
            } else {
                spans[0].style.transform = 'none';
                spans[1].style.opacity = '1';
                spans[2].style.transform = 'none';
            }
        });

        // Cerrar menú al hacer click en un enlace
        navLinks.forEach(link => {
            link.addEventListener('click', function() {
                navMenu.classList.remove('active');
                const spans = hamburger.querySelectorAll('span');
                spans[0].style.transform = 'none';
                spans[1].style.opacity = '1';
                spans[2].style.transform = 'none';
            });
        });
    }
}

// ========== BOTONES DE ORDENAR ==========
/* DESHABILITADO - app.js maneja completamente el flujo de pedidos
function initOrderButtons() {
    // Usar evento de delegación para asegurar que funcione con todos los botones
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('order-btn') || e.target.closest('.order-btn')) {
            const button = e.target.classList.contains('order-btn') ? e.target : e.target.closest('.order-btn');

            // Si hay modal disponible, redirigir al flujo de configuración (evita mensaje legacy)
            const card = button.closest('.jersey-card');
            const quickViewBtn = card ? card.querySelector('.quick-view-btn') : null;
            if (quickViewBtn) {
                e.preventDefault();
                e.stopPropagation();
                quickViewBtn.click();
                return;
            }

            // Fallback para páginas sin modal
            const jerseyName = button.getAttribute('data-jersey');
            const jerseyInfo = button.closest('.jersey-info');
            const price = jerseyInfo ? jerseyInfo.querySelector('.price').textContent : '₡0';
            const message = `¡Hola! Estoy interesado en ordenar la camiseta de *${jerseyName}* con precio de ${price}. ¿Está disponible?`;
            const encodedMessage = encodeURIComponent(message);
            const whatsappURL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodedMessage}`;
            window.open(whatsappURL, '_blank');
        }
    });
}
*/

// ========== FORMULARIO DE CONTACTO ==========
function initContactForm() {
    const contactForm = document.getElementById('contactForm');

    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();

            // Obtener valores del formulario
            const name = document.getElementById('name') ? document.getElementById('name').value : '';
            const email = document.getElementById('email') ? document.getElementById('email').value : '';
            const phone = document.getElementById('phone') ? document.getElementById('phone').value : '';
            const message = document.getElementById('message') ? document.getElementById('message').value : '';

            // Crear mensaje para WhatsApp
            const whatsappMessage = `*Nuevo mensaje de contacto*

*Nombre:* ${name}
*Email:* ${email}
*Teléfono:* ${phone}

*Mensaje:*
${message}`;

            // Codificar el mensaje para URL
            const encodedMessage = encodeURIComponent(whatsappMessage);

            // Crear URL de WhatsApp
            const whatsappURL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodedMessage}`;

            // Abrir WhatsApp en nueva pestaña
            window.open(whatsappURL, '_blank');

            // Limpiar formulario
            contactForm.reset();

            // Mostrar mensaje de confirmación
            alert('¡Gracias por tu mensaje! Te redirigiremos a WhatsApp.');
        });
    }
}

// ========== SCROLL SUAVE ==========
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            const headerOffset = 70;
            const elementPosition = target.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }
    });
});

// ========== ANIMACIÓN AL SCROLL ==========
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -100px 0px'
};

const observer = new IntersectionObserver(function(entries) {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observar tarjetas de camisetas
document.querySelectorAll('.jersey-card').forEach(card => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
    card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    observer.observe(card);
});

// ========== HEADER STICKY CON EFECTO ==========
let lastScroll = 0;
const header = document.querySelector('header');

if (header) {
    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;

        if (currentScroll <= 0) {
            header.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
        } else {
            header.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.2)';
        }

        lastScroll = currentScroll;
    });
}

// ========== BOTONES DE VISTA RÁPIDA ==========
// Este código ahora está integrado con la galería en el código anterior

// ========== VERIFICACIÓN Y FALLBACK PARA WHATSAPP ==========
// Agregar manejador global como fallback
window.orderWhatsApp = function(jerseyName, price) {
    const message = `¡Hola! Estoy interesado en ordenar la camiseta de *${jerseyName}* con precio de ${price}. ¿Está disponible?`;
    const encodedMessage = encodeURIComponent(message);
    const whatsappURL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodedMessage}`;
    window.open(whatsappURL, '_blank');
};

// Log para verificar que el script se cargó
console.log('Script cargado - WhatsApp Number:', WHATSAPP_NUMBER);
console.log('Botones de ordenar encontrados:', document.querySelectorAll('.order-btn').length);

// ========== CARRUSELES DE IMÁGENES EN TARJETAS ==========
function initJerseyCarousels() {
    const jerseyCards = document.querySelectorAll('.jersey-card');
    
    jerseyCards.forEach(card => {
        const carouselContainer = card.querySelector('.jersey-carousel-images');
        if (!carouselContainer) return;
        
        const images = carouselContainer.querySelectorAll('img');
        if (images.length <= 1) return; // Solo si hay múltiples imágenes
        
        let currentIndex = 0;
        let autoSlideInterval;
        const prevBtn = card.querySelector('.jersey-carousel-btn.prev-jersey');
        const nextBtn = card.querySelector('.jersey-carousel-btn.next-jersey');
        const indicatorsContainer = card.querySelector('.jersey-carousel-indicators');
        
        // Crear indicadores
        images.forEach((_, index) => {
            const indicator = document.createElement('span');
            indicator.classList.add('jersey-indicator');
            if (index === 0) indicator.classList.add('active');
            indicator.addEventListener('click', () => {
                goToJerseySlide(card, index);
                resetAutoSlide();
            });
            indicatorsContainer.appendChild(indicator);
        });
        
        // Función para mostrar slide específico
        function goToJerseySlide(cardElem, index) {
            const container = cardElem.querySelector('.jersey-carousel-images');
            const indicators = cardElem.querySelectorAll('.jersey-indicator');
            const imgs = container.querySelectorAll('img');
            
            currentIndex = index;
            container.style.transform = `translateX(-${currentIndex * 100}%)`;
            
            indicators.forEach((ind, i) => {
                ind.classList.toggle('active', i === currentIndex);
            });
        }
        
        // Función para avanzar automáticamente
        function nextSlideAuto() {
            currentIndex = (currentIndex + 1) % images.length;
            goToJerseySlide(card, currentIndex);
        }
        
        // Iniciar auto-slide
        function startAutoSlide() {
            autoSlideInterval = setInterval(nextSlideAuto, 5000); // 5 segundos
        }
        
        // Detener auto-slide
        function stopAutoSlide() {
            if (autoSlideInterval) {
                clearInterval(autoSlideInterval);
            }
        }
        
        // Reiniciar auto-slide
        function resetAutoSlide() {
            stopAutoSlide();
            startAutoSlide();
        }
        
        // Botón anterior
        if (prevBtn) {
            prevBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                currentIndex = (currentIndex - 1 + images.length) % images.length;
                goToJerseySlide(card, currentIndex);
                resetAutoSlide();
            });
        }
        
        // Botón siguiente
        if (nextBtn) {
            nextBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                currentIndex = (currentIndex + 1) % images.length;
                goToJerseySlide(card, currentIndex);
                resetAutoSlide();
            });
        }
        
        // Pausar auto-slide al pasar el mouse
        card.addEventListener('mouseenter', stopAutoSlide);
        card.addEventListener('mouseleave', startAutoSlide);
        
        // Iniciar auto-slide al cargar
        startAutoSlide();
    });
}

// ========== GALERÍA EN MODAL ==========
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('quick-view-btn') || e.target.closest('.quick-view-btn')) {
        e.stopPropagation();
        const button = e.target.classList.contains('quick-view-btn') ? e.target : e.target.closest('.quick-view-btn');
        const card = button.closest('.jersey-card');
        
        if (card) {
            const jerseyName = card.querySelector('h3') ? card.querySelector('h3').textContent : 'Camiseta';
            const price = card.querySelector('.price') ? card.querySelector('.price').textContent : '$79.99';
            
            // Obtener todas las imágenes del carrusel o solo la imagen principal
            const carouselImages = card.querySelectorAll('.jersey-carousel-images img');
            const singleImage = card.querySelector('.jersey-image img:not(.jersey-carousel-images img)');
            
            let imageSources = [];
            if (carouselImages.length > 0) {
                imageSources = Array.from(carouselImages).map(img => img.src);
            } else if (singleImage) {
                imageSources = [singleImage.src];
            }
            
            const imgSrc = imageSources[0] || '';
            const imgAlt = jerseyName;
            
            // Actualizar el modal con la información
            document.getElementById('jerseyModalLabel').textContent = jerseyName;
            document.getElementById('modalJerseyName').textContent = jerseyName;
            document.getElementById('modalJerseyPrice').textContent = price;
            document.getElementById('modalJerseyImage').src = imgSrc;
            document.getElementById('modalJerseyImage').alt = imgAlt;
            
            // Crear galería de miniaturas si hay múltiples imágenes
            const galleryContainer = document.getElementById('modalGallery');
            if (galleryContainer && imageSources.length > 1) {
                galleryContainer.innerHTML = '';
                imageSources.forEach((src, index) => {
                    const thumbnail = document.createElement('img');
                    thumbnail.src = src;
                    thumbnail.alt = `${jerseyName} ${index + 1}`;
                    if (index === 0) thumbnail.classList.add('active');
                    
                    thumbnail.addEventListener('click', function() {
                        document.getElementById('modalJerseyImage').src = src;
                        galleryContainer.querySelectorAll('img').forEach(img => img.classList.remove('active'));
                        this.classList.add('active');
                    });
                    
                    galleryContainer.appendChild(thumbnail);
                });
                galleryContainer.style.display = 'flex';
            } else if (galleryContainer) {
                galleryContainer.innerHTML = '';
                galleryContainer.style.display = 'none';
            }
            
            // Configurar el botón de ordenar del modal
            const modalOrderBtn = document.getElementById('modalOrderBtn');
            if (modalOrderBtn) {
                // Remover eventos anteriores
                const newBtn = modalOrderBtn.cloneNode(true);
                modalOrderBtn.parentNode.replaceChild(newBtn, modalOrderBtn);
                
                // Agregar nuevo evento
                document.getElementById('modalOrderBtn').addEventListener('click', function() {
                    const size = document.querySelector('input[name="size"]:checked')?.value || '';
                    const hasNameNumber = document.getElementById('hasNameNumber')?.checked || false;
                    const playerName = (document.getElementById('playerName')?.value || '').trim();
                    const playerNumber = (document.getElementById('playerNumber')?.value || '').trim();
                    const version = document.querySelector('input[name="version"]:checked')?.value || '';
                    const selectedImage = document.getElementById('modalJerseyImage')?.src || imgSrc || '';
                    const shareableImageUrl = toShareableImageUrl(selectedImage);

                    if (!size) {
                        alert('Por favor selecciona una talla');
                        return;
                    }

                    if (!version) {
                        alert('Por favor selecciona una versión');
                        return;
                    }

                    if (hasNameNumber && (!playerName || !playerNumber)) {
                        alert('Por favor completa nombre y número');
                        return;
                    }

                    const numberAndName = hasNameNumber
                        ? `${playerNumber} - ${playerName}`
                        : 'No';

                    let message = 'Me gustaria ordenar esta camisa\n';
                    message += shareableImageUrl
                        ? `(${shareableImageUrl})\n`
                        : '(Imagen no disponible)\n';
                    message += 'One pieces of this\n';
                    message += `Size: ${size}\n`;
                    message += `Number and Name: ${numberAndName}\n`;
                    message += `Version: ${version}`;

                    const encodedMessage = encodeURIComponent(message);
                    const whatsappURL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodedMessage}`;
                    window.open(whatsappURL, '_blank');
                });
            }
            
            // Mostrar el modal
            const modal = new bootstrap.Modal(document.getElementById('jerseyModal'));
            modal.show();
        }
    }
});
