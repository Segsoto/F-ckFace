(function initAdminPanel() {
    if (window.__camisadel10_admin_initialized__) {
        return;
    }
    window.__camisadel10_admin_initialized__ = true;

    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
        console.error('Supabase no está disponible. Verifica la carga del CDN en admin.html');
        return;
    }
    if (typeof SUPABASE_URL === 'undefined' || typeof SUPABASE_ANON_KEY === 'undefined') {
        console.error('Faltan variables de configuración de Supabase en config.js');
        return;
    }

    const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    let isAuthenticated = false;
    let editingId = null;
    let selectedImages = []; // Archivos seleccionados para agregar
    let editingImages = []; // Archivos seleccionados para editar

    const loginForm = document.getElementById('loginForm');
    const adminPanel = document.getElementById('adminPanel');
    const logoutBtn = document.getElementById('logoutBtn');
    const jerseyForm = document.getElementById('jerseyForm');
    const editForm = document.getElementById('editForm');
    const jerseysList = document.getElementById('jerseysList');
    const messageBox = document.getElementById('messageBox');
    const editModal = document.getElementById('editModal');
    const modalCloseBtn = document.getElementById('modalCloseBtn');
    const editCancelBtn = document.getElementById('editCancelBtn');

    function showMessage(message, type) {
        if (!messageBox) {
            return;
        }
        const safeType = type || 'success';
        messageBox.className = `message ${safeType}`;
        messageBox.textContent = message;
        messageBox.style.display = 'block';
        setTimeout(() => {
            messageBox.style.display = 'none';
        }, 4000);
    }

    // FUNCIONES PARA MANEJAR MÚLTIPLES IMÁGENES
    function displayImagePreviews(filesArray, galleryId, forEdit = false) {
        const gallery = document.getElementById(galleryId);
        if (!gallery) return;

        gallery.innerHTML = '';

        filesArray.forEach((item, index) => {
            const previewDiv = document.createElement('div');
            previewDiv.className = 'preview-item';

            const img = document.createElement('img');
            img.src = item.preview;
            img.alt = `Preview ${index + 1}`;

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'remove-img';
            removeBtn.innerHTML = '×';
            removeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                removeImagePreview(index, forEdit);
            });

            previewDiv.appendChild(img);
            previewDiv.appendChild(removeBtn);
            gallery.appendChild(previewDiv);
        });

        // Actualizar contador
        const counterId = forEdit ? 'editUploadCounter' : 'uploadCounter';
        const counter = document.getElementById(counterId);
        if (counter) {
            if (filesArray.length > 0) {
                counter.textContent = `${filesArray.length} imagen(es) seleccionada(s)`;
            } else {
                counter.textContent = '';
            }
        }
    }

    function removeImagePreview(index, forEdit = false) {
        if (forEdit) {
            editingImages.splice(index, 1);
            displayImagePreviews(editingImages, 'editImagePreviewGallery', true);
        } else {
            selectedImages.splice(index, 1);
            displayImagePreviews(selectedImages, 'imagePreviewGallery', false);
        }
    }

    function handleImageSelection(files, forEdit = false) {
        const maxImages = 4;
        const imagesArray = forEdit ? editingImages : selectedImages;
        const gallery = forEdit ? 'editImagePreviewGallery' : 'imagePreviewGallery';

        // Convertir FileList a Array
        const newFiles = Array.from(files);

        // Validar cantidad total
        if (imagesArray.length + newFiles.length > maxImages) {
            showMessage(`Máximo ${maxImages} imágenes permitidas`, 'error');
            return;
        }

        // Procesar cada archivo
        newFiles.forEach((file) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                imagesArray.push({
                    file: file,
                    preview: e.target.result
                });
                displayImagePreviews(imagesArray, gallery, forEdit);
            };
            reader.readAsDataURL(file);
        });
    }

    async function deleteJersey(id) {
        if (!confirm('¿Estás seguro de que deseas eliminar esta camiseta?')) {
            return;
        }

        try {
            const { error } = await client
                .from('jerseys')
                .delete()
                .eq('id', id);

            if (error) {
                throw error;
            }

            showMessage('Camiseta eliminada', 'success');
            await loadJerseys();
        } catch (error) {
            console.error('Error eliminando camiseta:', error);
            showMessage('Error al eliminar', 'error');
        }
    }

    async function editJersey(id) {
        try {
            const { data, error } = await client
                .from('jerseys')
                .select('*')
                .eq('id', id)
                .single();

            if (error) {
                throw error;
            }

            editingId = id;
            editingImages = []; // Limpiar imágenes de edición anteriores

            // Rellenar el formulario con los datos
            document.getElementById('editTeam').value = data.team || '';
            document.getElementById('editCategory').value = data.category || '';
            document.getElementById('editPrice').value = data.price || '';
            document.getElementById('editLeague').value = data.league || '';

            // Mostrar imagenes actuales (pipe-delimitadas)
            const editGallery = document.getElementById('editImagePreviewGallery');
            if (editGallery) {
                editGallery.innerHTML = '';

                // Parsear URLs pipe-delimitadas
                const imageUrls = data.image_url ? data.image_url.split('|').map(url => url.trim()) : [];

                imageUrls.forEach((url, index) => {
                    const previewDiv = document.createElement('div');
                    previewDiv.className = 'preview-item';

                    const img = document.createElement('img');
                    img.src = url;
                    img.alt = `Imagen ${index + 1}`;

                    previewDiv.appendChild(img);
                    editGallery.appendChild(previewDiv);
                });
            }

            // Mostrar/ocultar campo de liga
            updateEditLeagueVisibility();

            // Abrir modal
            editModal.classList.add('active');
        } catch (error) {
            console.error('Error cargando camiseta para edición:', error);
            showMessage('Error al cargar la camiseta', 'error');
        }
    }

    function updateEditLeagueVisibility() {
        const editLeagueGroup = document.getElementById('editLeagueGroup');
        const editLeagueSelect = document.getElementById('editLeague');
        const isLigas = document.getElementById('editCategory').value === 'ligas';
        editLeagueGroup.style.display = isLigas ? 'block' : 'none';
        editLeagueSelect.required = isLigas;
        if (!isLigas) {
            editLeagueSelect.value = '';
        }
    }

    function closeEditModal() {
        editingId = null;
        editingImages = [];
        editModal.classList.remove('active');
        editForm.reset();
        const editGallery = document.getElementById('editImagePreviewGallery');
        if (editGallery) {
            editGallery.innerHTML = '';
        }
        const editCounter = document.getElementById('editUploadCounter');
        if (editCounter) {
            editCounter.textContent = '';
        }
    }

    async function uploadMultipleImages(imagesArray) {
        const uploadedUrls = [];

        for (const item of imagesArray) {
            const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${item.file.name}`;
            const storagePath = `images/${fileName}`;

            const { error: uploadError } = await client
                .storage
                .from('jerseys')
                .upload(storagePath, item.file);

            if (uploadError) {
                throw uploadError;
            }

            const { data: publicData } = client
                .storage
                .from('jerseys')
                .getPublicUrl(storagePath);

            uploadedUrls.push(publicData.publicUrl);
        }

        return uploadedUrls;
    }

    async function loadJerseys() {
        if (!jerseysList) {
            return;
        }

        try {
            const { data, error } = await client
                .from('jerseys')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                throw error;
            }

            jerseysList.innerHTML = '';

            if (!data || data.length === 0) {
                jerseysList.innerHTML = '<p style="text-align:center; color: var(--muted);">No hay camisetas agregadas aun</p>';
                return;
            }

            data.forEach((jersey) => {
                const jerseyCard = document.createElement('div');
                jerseyCard.className = 'jersey-admin-card';
                const leagueLabel = jersey.category === 'ligas' && jersey.league
                    ? `<p><strong>Liga:</strong> ${jersey.league}</p>`
                    : '';
                jerseyCard.innerHTML = `
                    <div class="jersey-preview">
                        <img src="${jersey.image_url}" alt="${jersey.team}">
                    </div>
                    <div class="jersey-details">
                        <h3>${jersey.team}</h3>
                        <p><strong>Categoria:</strong> ${jersey.category}</p>
                        ${leagueLabel}
                        <p><strong>Precio:</strong> ₡${jersey.price}</p>
                        <p style="font-size: 0.85rem; color: var(--muted);">ID: ${jersey.id}</p>
                    </div>
                    <div class="jersey-actions">
                        <button class="edit-btn" type="button">✎ Editar</button>
                        <button class="delete-btn" type="button">Eliminar</button>
                    </div>
                `;

                const deleteBtn = jerseyCard.querySelector('.delete-btn');
                if (deleteBtn) {
                    deleteBtn.addEventListener('click', () => {
                        deleteJersey(jersey.id);
                    });
                }

                const editBtn = jerseyCard.querySelector('.edit-btn');
                if (editBtn) {
                    editBtn.addEventListener('click', () => {
                        editJersey(jersey.id);
                    });
                }

                jerseysList.appendChild(jerseyCard);
            });
        } catch (error) {
            console.error('Error cargando camisetas:', error);
            showMessage('Error al cargar las camisetas', 'error');
        }
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const passwordInput = document.getElementById('password');
            const password = passwordInput ? passwordInput.value : '';

            if (password === ADMIN_PASSWORD) {
                isAuthenticated = true;
                loginForm.style.display = 'none';
                if (adminPanel) {
                    adminPanel.style.display = 'block';
                }
                showMessage('Acceso concedido', 'success');
                await loadJerseys();
            } else {
                showMessage('Contrasena incorrecta', 'error');
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            isAuthenticated = false;
            if (loginForm) {
                loginForm.style.display = 'block';
            }
            if (adminPanel) {
                adminPanel.style.display = 'none';
            }
            const passwordInput = document.getElementById('password');
            if (passwordInput) {
                passwordInput.value = '';
            }
            showMessage('Sesion cerrada', 'info');
        });
    }

    // MANEJADOR PARA AGREGAR CAMISETA (Formulario principal)
    if (jerseyForm) {
        jerseyForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const formData = new FormData(jerseyForm);
            const team = formData.get('team');
            const category = formData.get('category');
            const league = formData.get('league');
            const price = formData.get('price');

            if (!team || !category || !price) {
                showMessage('Por favor completa los campos requeridos', 'error');
                return;
            }

            if (selectedImages.length === 0) {
                showMessage('Por favor selecciona al menos una imagen', 'error');
                return;
            }

            if (category === 'ligas' && !league) {
                showMessage('Selecciona la liga para esta camiseta', 'error');
                return;
            }

            try {
                // Subir todas las imágenes
                const uploadedUrls = await uploadMultipleImages(selectedImages);
                const imageUrlString = uploadedUrls.join('|');

                const { error: insertError } = await client
                    .from('jerseys')
                    .insert([{
                        team,
                        category,
                        league: category === 'ligas' ? league : null,
                        price: Number(price),
                        image_url: imageUrlString
                    }]);

                if (insertError) {
                    throw insertError;
                }

                showMessage(`Camiseta "${team}" agregada`, 'success');
                jerseyForm.reset();
                selectedImages = [];
                displayImagePreviews(selectedImages, 'imagePreviewGallery', false);
                await loadJerseys();
            } catch (error) {
                console.error('Error agregando camiseta:', error);
                if (error && error.statusCode === '403' && error.namespace === 'storage') {
                    showMessage('Falta política de Storage en Supabase: habilita INSERT para el bucket jerseys', 'error');
                } else {
                    showMessage(`Error: ${error.message}`, 'error');
                }
            }
        });
    }

    // MANEJADOR PARA ACTUALIZAR CAMISETA (Modal de edición)
    if (editForm) {
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            if (!editingId) {
                showMessage('Error: No hay camiseta seleccionada', 'error');
                return;
            }

            const formData = new FormData(editForm);
            const team = formData.get('team');
            const category = formData.get('category');
            const league = formData.get('league');
            const price = formData.get('price');

            if (!team || !category || !price) {
                showMessage('Por favor completa los campos requeridos', 'error');
                return;
            }

            if (category === 'ligas' && !league) {
                showMessage('Selecciona la liga para esta camiseta', 'error');
                return;
            }

            try {
                const updateData = {
                    team,
                    category,
                    league: category === 'ligas' ? league : null,
                    price: Number(price)
                };

                // Si hay nuevas imágenes, subirlas y concatenar con las anteriores
                if (editingImages.length > 0) {
                    const uploadedUrls = await uploadMultipleImages(editingImages);
                    
                    // Obtener URLs anteriores
                    const { data: currentData } = await client
                        .from('jerseys')
                        .select('image_url')
                        .eq('id', editingId)
                        .single();

                    const currentUrls = currentData.image_url ? currentData.image_url.split('|').map(url => url.trim()) : [];
                    
                    // Combinar (nuevas primero)
                    const allUrls = [...uploadedUrls, ...currentUrls].slice(0, 4); // Máximo 4
                    
                    updateData.image_url = allUrls.join('|');
                }

                const { error: updateError } = await client
                    .from('jerseys')
                    .update(updateData)
                    .eq('id', editingId);

                if (updateError) {
                    throw updateError;
                }

                showMessage(`Camiseta "${team}" actualizada`, 'success');
                closeEditModal();
                await loadJerseys();
            } catch (error) {
                console.error('Error actualizando camiseta:', error);
                if (error && error.statusCode === '403' && error.namespace === 'storage') {
                    showMessage('Falta política de Storage en Supabase: habilita UPDATE para el bucket jerseys', 'error');
                } else {
                    showMessage(`Error: ${error.message}`, 'error');
                }
            }
        });
    }

    // Manejadores del modal de edición
    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', closeEditModal);
    }

    if (editCancelBtn) {
        editCancelBtn.addEventListener('click', closeEditModal);
    }

    // Cerrar modal al hacer clic fuera del contenido
    if (editModal) {
        editModal.addEventListener('click', (e) => {
            if (e.target === editModal) {
                closeEditModal();
            }
        });
    }

    // Cambio de categoría en el modal de edición
    const editCategorySelect = document.getElementById('editCategory');
    if (editCategorySelect) {
        editCategorySelect.addEventListener('change', updateEditLeagueVisibility);
    }

    // Manejador para la imagen en el modal de edición
    const editImageGroup = document.getElementById('editImageGroup');
    const editImageInput = document.getElementById('editImage');
    if (editImageGroup && editImageInput) {
        editImageGroup.addEventListener('click', () => {
            editImageInput.click();
        });

        editImageInput.addEventListener('change', (e) => {
            handleImageSelection(e.target.files, true);
        });
    }

    // Manejador para las imágenes en el formulario de agregar
    const imageGroup = document.getElementById('imageGroup');
    const imageInput = document.getElementById('image');
    if (imageGroup && imageInput) {
        imageGroup.addEventListener('click', () => {
            imageInput.click();
        });

        imageInput.addEventListener('change', (e) => {
            handleImageSelection(e.target.files, false);
        });
    }
})();
