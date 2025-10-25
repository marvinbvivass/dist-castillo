// --- Lógica del módulo de Inventario ---

(function() {
    // Variables locales del módulo
    let _db, _userId, _userRole, _appId, _mainContent, _floatingControls, _activeListeners;
    let _showMainMenu, _showModal, _showAddItemModal, _populateDropdown;
    let _collection, _onSnapshot, _doc, _addDoc, _setDoc, _deleteDoc, _query, _where, _getDocs, _writeBatch;

    // Cachés y estado local
    let _inventarioCache = [];
    let _lastFilters = { searchTerm: '', rubro: '', segmento: '', marca: '' };
    let _segmentoOrderCache = null;
    let _inventarioListenerUnsubscribe = null;

    /**
     * Inicializa el módulo con las dependencias necesarias desde la app principal.
     */
    window.initInventario = function(dependencies) {
        _db = dependencies.db;
        _userId = dependencies.userId;
        _userRole = dependencies.userRole; // Guardar el rol del usuario
        _appId = dependencies.appId;
        _mainContent = dependencies.mainContent;
        _floatingControls = dependencies.floatingControls; // Guardar referencia
        _activeListeners = dependencies.activeListeners;
        _showMainMenu = dependencies.showMainMenu;
        _showModal = dependencies.showModal;
        _showAddItemModal = dependencies.showAddItemModal;
        _populateDropdown = dependencies.populateDropdown;
        _collection = dependencies.collection;
        _onSnapshot = dependencies.onSnapshot;
        _doc = dependencies.doc;
        _addDoc = dependencies.addDoc;
        _setDoc = dependencies.setDoc;
        _deleteDoc = dependencies.deleteDoc;
        _query = dependencies.query;
        _where = dependencies.where;
        _getDocs = dependencies.getDocs;
        _writeBatch = dependencies.writeBatch;

        if (!_floatingControls) {
            console.warn("Inventario Init Warning: floatingControls not provided.");
        }
         console.log("Inventario module initialized.");
    };

    /**
     * Inicia el listener principal para la colección de inventario del usuario actual.
     */
    function startMainInventarioListener(callback) {
        if (_inventarioListenerUnsubscribe) {
            try {
                _inventarioListenerUnsubscribe(); // Detener listener anterior si existe
            } catch(e) { console.warn("Error unsubscribing previous inventory listener:", e); }
        }
        const collectionRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`);
        _inventarioListenerUnsubscribe = _onSnapshot(collectionRef, (snapshot) => {
            _inventarioCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            if (callback && typeof callback === 'function') { // Verificar si callback es una función
                 try {
                     callback(); // Llama al callback para re-renderizar la vista actual
                 } catch (cbError) {
                     console.error("Error executing inventory listener callback:", cbError);
                 }
            } else if (callback) {
                 console.warn("Inventory listener callback provided is not a function:", callback);
            }
        }, (error) => {
             console.error("Error en listener de inventario:", error);
             if (window.isLoggingOut && error.code === 'permission-denied') {
                 console.log("Listener de inventario detenido por cierre de sesión.");
             } else if (error.code !== 'cancelled') { // Ignorar errores de cancelación
                 _showModal('Error de Conexión', 'No se pudo actualizar el inventario en tiempo real. Revisa tu conexión.');
             }
        });
        _activeListeners.push(_inventarioListenerUnsubscribe); // Añadir a la lista global para limpieza
    }


    /**
     * Invalida la caché de orden de segmentos para forzar una recarga en este y otros módulos.
     */
    function invalidateSegmentOrderCache() {
        _segmentoOrderCache = null;
        // Notificar a otros módulos que dependen de esta caché
        if (window.ventasModule && typeof window.ventasModule.invalidateCache === 'function') {
            window.ventasModule.invalidateCache();
        }
        if (window.catalogoModule && typeof window.catalogoModule.invalidateCache === 'function') {
            window.catalogoModule.invalidateCache();
        }
        // El módulo de Data lee directamente, no necesita invalidación activa aquí.
         console.log("Segment order cache invalidated.");
    }

    /**
     * Renderiza el menú de subopciones de inventario, mostrando/ocultando opciones según el rol.
     */
    window.showInventarioSubMenu = function() {
        invalidateSegmentOrderCache(); // Invalida al entrar al submenú por si hubo cambios
        // --- INICIO CORRECCIÓN ---
        if (_floatingControls) {
            _floatingControls.classList.add('hidden');
        } else {
            console.warn("showInventarioSubMenu: floatingControls not available.");
        }
        // --- FIN CORRECCIÓN ---
        const isAdmin = _userRole === 'admin';
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto max-w-lg">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl text-center">
                        <h1 class="text-3xl font-bold text-gray-800 mb-6">Gestión de Inventario</h1>
                        <div class="space-y-4">
                            <!-- CORRECCIÓN: Comentarios eliminados -->
                            <button id="verModificarBtn" class="w-full px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg shadow-md hover:bg-blue-600">Ver Productos / ${isAdmin ? 'Modificar Def.' : 'Consultar Stock'}</button>
                            ${isAdmin ? `
                            <button id="agregarProductoBtn" class="w-full px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg shadow-md hover:bg-blue-600">Agregar Producto</button>
                            ` : ''}
                            <button id="ajusteMasivoBtn" class="w-full px-6 py-3 bg-teal-500 text-white font-semibold rounded-lg shadow-md hover:bg-teal-600">Ajuste Masivo de Cantidades</button>
                             ${isAdmin ? `
                             <button id="ordenarSegmentosBtn" class="w-full px-6 py-3 bg-purple-500 text-white font-semibold rounded-lg shadow-md hover:bg-purple-600">Ordenar Segmentos (Visualización)</button>
                             <button id="modificarDatosBtn" class="w-full px-6 py-3 bg-yellow-500 text-gray-800 font-semibold rounded-lg shadow-md hover:bg-yellow-600">Modificar Datos Maestros</button>
                             ` : ''}
                            <button id="backToMenuBtn" class="w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver al Menú Principal</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('verModificarBtn').addEventListener('click', () => {
            _lastFilters = { searchTerm: '', rubro: '', segmento: '', marca: '' }; // Resetear filtros al cambiar de vista
            showModifyDeleteView();
        });
        // Añadir listeners solo si los botones existen (son admin)
        if (isAdmin) {
            document.getElementById('agregarProductoBtn')?.addEventListener('click', showAgregarProductoView);
            document.getElementById('ordenarSegmentosBtn')?.addEventListener('click', showOrdenarSegmentosView);
            document.getElementById('modificarDatosBtn')?.addEventListener('click', showModificarDatosView);
        }
        document.getElementById('ajusteMasivoBtn').addEventListener('click', showAjusteMasivoView); // Disponible para todos
        document.getElementById('backToMenuBtn').addEventListener('click', _showMainMenu);
    }

    /**
     * Obtiene y cachea el mapa de orden de los segmentos del usuario actual.
     */
    async function getSegmentoOrderMap() {
        if (_segmentoOrderCache) return _segmentoOrderCache; // Devolver caché si existe
        const map = {};
        const segmentosRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/segmentos`);
        try {
            const snapshot = await _getDocs(segmentosRef);
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                // Usar 9999 si 'orden' es undefined o null
                map[data.name] = (data.orden !== undefined && data.orden !== null) ? data.orden : 9999;
            });
            _segmentoOrderCache = map; // Guardar en caché
             console.log("Segment order map loaded/cached:", _segmentoOrderCache);
            return map;
        } catch (e) {
            console.warn("No se pudo obtener el orden de los segmentos, se usará orden por defecto.", e);
            return {}; // Devolver objeto vacío en caso de error
        }
    }

    /**
     * Muestra la vista para ordenar los segmentos (solo Admin).
     */
    function showOrdenarSegmentosView() {
        if (_userRole !== 'admin') {
            _showModal('Acceso Denegado', 'Solo los administradores pueden ordenar segmentos.');
            return;
        }
        // --- INICIO CORRECCIÓN ---
        if (_floatingControls) {
            _floatingControls.classList.add('hidden');
        } else {
            console.warn("showOrdenarSegmentosView: floatingControls not available.");
        }
        // --- FIN CORRECCIÓN ---
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto max-w-lg"> {/* Ancho consistente */}
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl">
                        <h2 class="text-2xl font-bold text-gray-800 mb-4 text-center">Ordenar Segmentos (Visualización)</h2>
                        <p class="text-center text-gray-600 mb-6">Arrastra y suelta los segmentos para cambiar el orden en que aparecen en las listas y reportes. Este orden se propagará a todos los usuarios.</p>
                        <div class="mb-4">
                           <label for="ordenarRubroFilter" class="block text-gray-700 font-medium mb-2">Filtrar por Rubro (Opcional):</label>
                           <select id="ordenarRubroFilter" class="w-full px-4 py-2 border rounded-lg">
                               <option value="">Todos los Segmentos</option>
                           </select>
                        </div>
                        <ul id="segmentos-sortable-list" class="space-y-2 border rounded-lg p-4 max-h-96 overflow-y-auto bg-gray-50"> {/* Fondo ligero */}
                            <p class="text-gray-500 text-center">Cargando segmentos...</p>
                        </ul>
                        <div class="mt-6 flex flex-col sm:flex-row gap-4">
                            <button id="backToInventarioBtn" class="w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver</button>
                            <button id="saveOrderBtn" class="w-full px-6 py-3 bg-green-500 text-white font-semibold rounded-lg shadow-md hover:bg-green-600">Guardar Orden</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('backToInventarioBtn').addEventListener('click', showInventarioSubMenu);
        document.getElementById('saveOrderBtn').addEventListener('click', handleGuardarOrdenSegmentos);
        const rubroFilter = document.getElementById('ordenarRubroFilter');
        // Poblar filtro de rubros del admin actual
        _populateDropdown(`artifacts/${_appId}/users/${_userId}/rubros`, 'ordenarRubroFilter', 'Rubro');
        rubroFilter.addEventListener('change', () => renderSortableSegmentList(rubroFilter.value));
        renderSortableSegmentList(''); // Cargar todos inicialmente
    }

    /**
     * Renderiza la lista de segmentos del admin para que se puedan ordenar.
     */
    async function renderSortableSegmentList(rubro = '') {
        const container = document.getElementById('segmentos-sortable-list');
        if (!container) return;
        container.innerHTML = `<p class="text-gray-500 text-center">Cargando...</p>`;

        try {
            const segmentosRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/segmentos`);
            let snapshot = await _getDocs(segmentosRef);
            let allSegments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Inicializar orden si falta (Optimizado)
            const segmentsWithoutOrder = allSegments.filter(s => s.orden === undefined || s.orden === null);
            if (segmentsWithoutOrder.length > 0) {
                 _showModal('Progreso', 'Asignando orden inicial a segmentos nuevos...'); // Usar modal de progreso
                const segmentsWithOrder = allSegments.filter(s => s.orden !== undefined && s.orden !== null);
                const maxOrder = segmentsWithOrder.reduce((max, s) => Math.max(max, s.orden ?? -1), -1); // Considerar null/undefined
                const batch = _writeBatch(_db);
                // Ordenar alfabéticamente los nuevos para asignación inicial consistente
                segmentsWithoutOrder.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
                segmentsWithoutOrder.forEach((seg, index) => {
                    const docRef = _doc(segmentosRef, seg.id);
                    const newOrder = maxOrder + 1 + index;
                    batch.update(docRef, { orden: newOrder });
                    seg.orden = newOrder; // Actualizar localmente
                });
                await batch.commit();
                allSegments = [...segmentsWithOrder, ...segmentsWithoutOrder]; // Recombinar
                // Cerrar modal de progreso
                const modalContainer = document.getElementById('modalContainer');
                 const modalTitle = modalContainer?.querySelector('h3')?.textContent;
                 if(modalContainer && modalTitle?.startsWith('Progreso')) {
                      modalContainer.classList.add('hidden');
                 }
                console.log("Initial order assigned to new segments.");
            }

            // Filtrar si se seleccionó un rubro
            let segmentsToDisplay = allSegments;
            if (rubro) {
                const inventarioRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`);
                const q = _query(inventarioRef, _where("rubro", "==", rubro));
                const inventarioSnapshot = await _getDocs(q);
                // Usar un Set para eficiencia al buscar nombres de segmentos usados
                const usedSegmentNames = new Set(inventarioSnapshot.docs.map(doc => doc.data().segmento).filter(Boolean));
                segmentsToDisplay = allSegments.filter(s => s.name && usedSegmentNames.has(s.name));
            }

            // Ordenar según el campo 'orden' (usar 9999 como fallback)
            segmentsToDisplay.sort((a, b) => (a.orden ?? 9999) - (b.orden ?? 9999));

            // Renderizar la lista
            container.innerHTML = '';
            if (segmentsToDisplay.length === 0) {
                container.innerHTML = `<p class="text-gray-500 text-center">No hay segmentos ${rubro ? 'para este rubro' : 'definidos'}.</p>`;
                return;
            }
            segmentsToDisplay.forEach(seg => {
                const li = document.createElement('li');
                li.dataset.id = seg.id;
                li.dataset.name = seg.name;
                li.className = 'p-3 bg-gray-100 rounded shadow-sm cursor-grab active:cursor-grabbing hover:bg-gray-200'; // Add hover effect
                li.textContent = seg.name;
                li.draggable = true;
                container.appendChild(li);
            });
            addDragAndDropHandlers(container); // Activar drag & drop

        } catch (error) {
            console.error("Error al renderizar la lista de segmentos:", error);
            container.innerHTML = `<p class="text-red-500 text-center">Error al cargar los segmentos.</p>`;
        }
    }

    /**
     * Añade los manejadores de eventos para la funcionalidad de arrastrar y soltar.
     */
    function addDragAndDropHandlers(container) {
        let draggedItem = null;
        let placeholder = null; // Elemento visual para indicar dónde caerá

        // Crear placeholder (elemento fantasma)
        const createPlaceholder = () => {
            if (!placeholder) {
                placeholder = document.createElement('li');
                placeholder.style.height = '40px'; // Altura similar a los items
                placeholder.style.background = '#e0e7ff'; // Color azul claro
                placeholder.style.border = '2px dashed #6366f1'; // Borde discontinuo índigo
                placeholder.style.borderRadius = '0.375rem'; // rounded-lg
                placeholder.style.margin = '0.5rem 0'; // space-y-2
                placeholder.style.listStyleType = 'none'; // Quitar viñeta
            }
        };
        createPlaceholder(); // Crear una vez

        container.addEventListener('dragstart', e => {
             if (e.target.tagName === 'LI') {
                 draggedItem = e.target;
                 setTimeout(() => {
                     if (draggedItem) {
                         draggedItem.style.opacity = '0.5'; // Hacer semitransparente el original
                         draggedItem.style.border = '2px dashed gray'; // Opcional: Borde discontinuo
                     }
                 }, 0);
                 e.dataTransfer.effectAllowed = 'move'; // Indicar que es una operación de mover
                 e.dataTransfer.setData('text/plain', draggedItem.dataset.id); // Necesario para Firefox
             } else {
                 e.preventDefault(); // Evitar arrastrar otros elementos
             }
        });

        container.addEventListener('dragend', e => {
            if (draggedItem) {
                 draggedItem.style.opacity = '1'; // Restaurar opacidad
                 draggedItem.style.border = ''; // Quitar borde discontinuo
            }
            draggedItem = null;
            if (placeholder && placeholder.parentNode) {
                 placeholder.parentNode.removeChild(placeholder); // Eliminar placeholder
            }
        });

        container.addEventListener('dragover', e => {
            e.preventDefault(); // Necesario para permitir drop
            e.dataTransfer.dropEffect = 'move'; // Cursor visual de mover
            const afterElement = getDragAfterElement(container, e.clientY);

             // Insertar placeholder antes del elemento 'afterElement' o al final
            if (afterElement) {
                container.insertBefore(placeholder, afterElement);
            } else {
                container.appendChild(placeholder);
            }
        });

        container.addEventListener('drop', e => {
             e.preventDefault(); // Prevenir comportamiento por defecto
             if (draggedItem && placeholder && placeholder.parentNode) {
                 // Mover el elemento arrastrado a la posición del placeholder
                 container.insertBefore(draggedItem, placeholder);
                 // Restaurar estilos (dragend puede no dispararse si el drop es rápido)
                 draggedItem.style.opacity = '1';
                 draggedItem.style.border = '';
             }
             if (placeholder && placeholder.parentNode) {
                 placeholder.parentNode.removeChild(placeholder); // Eliminar placeholder
             }
             draggedItem = null; // Limpiar referencia
        });

        // Limpiar placeholder si se sale del contenedor
        container.addEventListener('dragleave', e => {
             // Verificar si el cursor salió realmente del contenedor
             if (!container.contains(e.relatedTarget) && placeholder && placeholder.parentNode) {
                 placeholder.parentNode.removeChild(placeholder);
             }
        });


        function getDragAfterElement(container, y) {
            // Obtener todos los LI excepto el placeholder y el que se está arrastrando (si ya está en el DOM)
            const draggableElements = [...container.querySelectorAll('li:not([style*="height: 40px"])')].filter(el => el !== draggedItem);

            return draggableElements.reduce((closest, child) => {
                const box = child.getBoundingClientRect();
                const offset = y - box.top - box.height / 2;
                // Si el offset es negativo (estamos por encima del centro del elemento)
                // y es el más cercano hasta ahora (más cercano a 0 desde negativo)
                if (offset < 0 && offset > closest.offset) {
                    return { offset: offset, element: child };
                } else {
                    return closest;
                }
            }, { offset: Number.NEGATIVE_INFINITY }).element; // Inicializar con offset muy negativo
        }
    }


    /**
     * Guarda el nuevo orden de los segmentos para el admin y propaga a otros usuarios.
     */
    async function handleGuardarOrdenSegmentos() {
        if (_userRole !== 'admin') return; // Seguridad adicional

        const listItems = document.querySelectorAll('#segmentos-sortable-list li');
        if (listItems.length === 0) {
            // Buscar si hay un mensaje indicando que no hay segmentos
             const noSegmentsMsg = document.querySelector('#segmentos-sortable-list p');
             if (noSegmentsMsg && noSegmentsMsg.textContent.includes('No hay segmentos')) {
                 _showModal('Aviso', 'No hay segmentos visibles para guardar orden.');
             } else {
                  _showModal('Aviso', 'Lista de segmentos no cargada o vacía.');
             }
            return;
        }

        _showModal('Progreso', 'Guardando nuevo orden para admin...');

        const batch = _writeBatch(_db);
        const orderedIds = []; // Guardar IDs en el orden visual actual
        let hasChanges = false; // Flag para detectar si hubo cambios reales

        // Obtener el orden actual de la base de datos (o caché si está actualizada) para comparar
         const currentOrderMap = await getSegmentoOrderMap(); // Re-fetch o usar caché

        listItems.forEach((item, index) => {
            const docId = item.dataset.id;
            const docRef = _doc(_db, `artifacts/${_appId}/users/${_userId}/segmentos`, docId);
            const segmentName = item.dataset.name; // Obtener nombre del dataset

            // Comparar orden nuevo (index) con el orden actual
             // Usar ?? 9999 para manejar casos donde 'orden' no existía
             const currentDbOrder = currentOrderMap[segmentName] ?? 9999;
             if (currentDbOrder !== index) {
                 batch.update(docRef, { orden: index }); // Actualizar orden del admin solo si cambió
                 hasChanges = true;
             }
            orderedIds.push(docId); // Guardar ID en orden visual
        });

         if (!hasChanges) {
             _showModal('Aviso', 'No se detectaron cambios en el orden.');
             return;
         }

        try {
            await batch.commit(); // Guardar cambios para el admin
            invalidateSegmentOrderCache(); // Limpiar caché local

            // Propagar el orden a otros usuarios
             if (window.adminModule && typeof window.adminModule.propagateCategoryOrderChange === 'function') {
                  _showModal('Progreso', 'Propagando orden a otros usuarios...');
                 // Pasar 'segmentos' y la lista de IDs ordenados
                 await window.adminModule.propagateCategoryOrderChange('segmentos', orderedIds);
             } else {
                  console.warn("Función propagateCategoryOrderChange no encontrada en adminModule.");
                  _showModal('Advertencia', 'Orden guardado localmente, pero no se pudo propagar a otros usuarios.');
                  // No retornar aquí, permitir que se muestre el éxito local
             }


            _showModal('Éxito', 'El orden de los segmentos ha sido guardado y propagado.');
            showInventarioSubMenu(); // Volver al submenú
        } catch (error) {
            console.error("Error guardando/propagando el orden de los segmentos:", error);
            _showModal('Error', `Hubo un error al guardar el nuevo orden: ${error.message}`);
        }
    }


    /**
     * Muestra la vista para el ajuste masivo de cantidades (disponible para todos).
     */
    function showAjusteMasivoView() {
         // --- INICIO CORRECCIÓN ---
         if (_floatingControls) {
            _floatingControls.classList.add('hidden');
        } else {
            console.warn("showAjusteMasivoView: floatingControls not available.");
        }
        // --- FIN CORRECCIÓN ---
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl">
                        <h2 class="text-2xl font-bold text-gray-800 mb-6 text-center">Ajuste Masivo de Cantidades</h2>
                        ${getFiltrosHTML('ajuste')} {/* Reutilizar filtros */}
                        <div id="ajusteListContainer" class="overflow-x-auto max-h-96 border rounded-lg"> {/* Añadir borde */}
                            <p class="text-gray-500 text-center p-4">Cargando productos...</p>
                        </div>
                        <div class="mt-6 flex flex-col sm:flex-row gap-4">
                            <button id="backToInventarioBtn" class="w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver</button>
                            <button id="saveAjusteBtn" class="w-full px-6 py-3 bg-green-500 text-white font-semibold rounded-lg shadow-md hover:bg-green-600">Guardar Cambios</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('backToInventarioBtn').addEventListener('click', showInventarioSubMenu);
        document.getElementById('saveAjusteBtn').addEventListener('click', handleGuardarAjusteMasivo);

        const renderCallback = () => renderAjusteMasivoList();

        // Poblar filtro de rubros del usuario actual
        _populateDropdown(`artifacts/${_appId}/users/${_userId}/rubros`, 'ajuste-filter-rubro', 'Rubro');

        setupFiltros('ajuste', renderCallback); // Configurar filtros para esta vista
        // Iniciar listener del inventario del usuario actual para esta vista
        startMainInventarioListener(renderCallback);
    }

    /**
     * Renderiza la lista de productos para el ajuste masivo del usuario actual.
     */
    async function renderAjusteMasivoList() {
        const container = document.getElementById('ajusteListContainer');
        if (!container) return;

        let productos = [..._inventarioCache]; // Usa la caché actualizada por el listener

        // Aplicar filtros
        productos = productos.filter(p => {
            const searchTermLower = (_lastFilters.searchTerm || '').toLowerCase();
             // Buscar en presentación, marca y segmento
            const textMatch = !searchTermLower ||
                              (p.presentacion && p.presentacion.toLowerCase().includes(searchTermLower)) ||
                              (p.marca && p.marca.toLowerCase().includes(searchTermLower)) ||
                              (p.segmento && p.segmento.toLowerCase().includes(searchTermLower));
            const rubroMatch = !_lastFilters.rubro || p.rubro === _lastFilters.rubro;
            const segmentoMatch = !_lastFilters.segmento || p.segmento === _lastFilters.segmento;
            const marcaMatch = !_lastFilters.marca || p.marca === _lastFilters.marca;
            return textMatch && rubroMatch && segmentoMatch && marcaMatch;
        });

        // Ordenar
        const segmentoOrderMap = await getSegmentoOrderMap(); // Orden del usuario actual
        productos.sort((a, b) => {
             // Usar ?? 9999 como fallback si el segmento no está en el mapa
            const orderA = segmentoOrderMap[a.segmento] ?? 9999;
            const orderB = segmentoOrderMap[b.segmento] ?? 9999;
            if (orderA !== orderB) return orderA - orderB;
            const marcaComp = (a.marca || '').localeCompare(b.marca || '');
            if (marcaComp !== 0) return marcaComp;
            return (a.presentacion || '').localeCompare(b.presentacion || '');
        });

        // Renderizar tabla
        if (productos.length === 0) {
            container.innerHTML = `<p class="text-gray-500 text-center p-4">No hay productos que coincidan con los filtros.</p>`;
            return;
        }

        let tableHTML = `<table class="min-w-full bg-white text-sm"><thead class="bg-gray-100 sticky top-0 z-10"><tr><th class="py-2 px-4 border-b text-left">Producto</th><th class="py-2 px-4 border-b text-center w-40">Cantidad Nueva</th></tr></thead><tbody>`;
        let currentSegmento = null;
        let currentMarca = null;
        productos.forEach(p => {
            const segmento = p.segmento || 'Sin Segmento';
            const marca = p.marca || 'Sin Marca';

            if (segmento !== currentSegmento) {
                currentSegmento = segmento;
                currentMarca = null;
                // Hacer la fila del segmento sticky
                // Ajustar 'top' para que quede debajo del thead pegajoso
                tableHTML += `<tr><td colspan="2" class="py-2 px-4 bg-gray-300 font-bold text-gray-800 sticky top-[calc(theme(height.10))] z-[9]">${currentSegmento}</td></tr>`; // Ajustar top y z-index
            }
            if (marca !== currentMarca) {
                currentMarca = marca;
                 // Fila de marca NO sticky, pero con estilo
                tableHTML += `<tr><td colspan="2" class="py-2 px-4 bg-gray-100 font-semibold text-gray-700 pl-8">${currentMarca}</td></tr>`;
            }

            // Determinar unidad y factor de conversión
            const ventaPor = p.ventaPor || { und: true };
            let unitType = 'Und';
            let conversionFactor = 1;
            let currentStockInUnits = p.cantidadUnidades || 0;

            // Priorizar Caja, luego Paquete, luego Unidad para mostrar
            if (ventaPor.cj) {
                unitType = 'Cj';
                conversionFactor = p.unidadesPorCaja || 1;
            } else if (ventaPor.paq) {
                unitType = 'Paq';
                conversionFactor = p.unidadesPorPaquete || 1;
            }

            // Asegurar que conversionFactor sea al menos 1 para evitar división por cero
             conversionFactor = Math.max(1, conversionFactor);

            const currentStockInDisplayUnits = Math.floor(currentStockInUnits / conversionFactor);

            tableHTML += `
                <tr class="hover:bg-gray-50">
                    <td class="py-2 px-4 border-b pl-12">
                        <p class="font-medium">${p.presentacion}</p>
                        <p class="text-xs text-gray-500">Actual: ${currentStockInDisplayUnits} ${unitType}. (${currentStockInUnits} Und. base)</p> {/* Mostrar base */}
                    </td>
                    <td class="py-2 px-4 border-b text-center align-middle"> {/* Centrar verticalmente */}
                        <div class="flex items-center justify-center">
                            <input type="number" value="${currentStockInDisplayUnits}"
                                   data-doc-id="${p.id}" data-conversion-factor="${conversionFactor}" min="0" step="1"
                                   class="w-20 p-1 text-center border rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500">
                            <span class="ml-2 text-gray-700">${unitType}.</span>
                        </div>
                    </td>
                </tr>
            `;
        });
        tableHTML += `</tbody></table>`;
        container.innerHTML = tableHTML;
    }


    /**
     * Guarda los cambios de cantidad realizados masivamente por el usuario actual.
     */
    async function handleGuardarAjusteMasivo() {
        const inputs = document.querySelectorAll('#ajusteListContainer input[data-doc-id]');
        if (inputs.length === 0) {
             // Verificar si es porque no hay productos o por filtros
             const container = document.getElementById('ajusteListContainer');
             if (container && container.textContent.includes('No hay productos')) {
                _showModal('Aviso', 'No hay productos que coincidan con los filtros para ajustar.');
             } else {
                 _showModal('Aviso', 'Lista de productos no cargada o vacía.');
             }
            return;
        }

        const batch = _writeBatch(_db);
        let changesCount = 0;
        let invalidValues = false;

        // Limpiar errores visuales previos
        inputs.forEach(input => input.classList.remove('border-red-500', 'ring-1', 'ring-red-500'));

        inputs.forEach(input => {
            const docId = input.dataset.docId;
            const conversionFactor = parseInt(input.dataset.conversionFactor, 10) || 1;
            const newValueInDisplayUnitsStr = input.value.trim(); // Obtener como string
            const newValueInDisplayUnits = parseInt(newValueInDisplayUnitsStr, 10); // Intentar parsear
            const productoOriginal = _inventarioCache.find(p => p.id === docId);

            // Validar si el input está vacío o no es un número entero >= 0
            if (newValueInDisplayUnitsStr === '' || isNaN(newValueInDisplayUnits) || !Number.isInteger(newValueInDisplayUnits) || newValueInDisplayUnits < 0) {
                 if (newValueInDisplayUnitsStr !== '') { // Solo marcar error si no está vacío pero es inválido
                     console.warn(`Valor inválido ingresado para ${productoOriginal?.presentacion}: ${newValueInDisplayUnitsStr}`);
                     input.classList.add('border-red-500', 'ring-1', 'ring-red-500');
                     invalidValues = true;
                 }
                 // Si está vacío, no hacer nada (no se considera un cambio ni un error)
                 return; // Saltar este input
            }


            if (productoOriginal) {
                const nuevaCantidadUnidades = newValueInDisplayUnits * conversionFactor;
                // Verificar si hubo un cambio real
                if ((productoOriginal.cantidadUnidades || 0) !== nuevaCantidadUnidades) {
                    const docRef = _doc(_db, `artifacts/${_appId}/users/${_userId}/inventario`, docId);
                    batch.update(docRef, { cantidadUnidades: nuevaCantidadUnidades });
                    changesCount++;
                     console.log(`Updating ${docId} (${productoOriginal.presentacion}): ${productoOriginal.cantidadUnidades || 0} -> ${nuevaCantidadUnidades}`);
                }
            } else {
                 console.warn(`Producto original no encontrado en caché para ID: ${docId}. No se puede guardar el cambio.`);
            }
        });

        if (invalidValues) {
             _showModal('Error de Entrada', 'Se encontraron valores inválidos (no numéricos o negativos) en algunos campos. Por favor, corrígelos antes de guardar.');
             return; // No proceder si hay errores
        }

        if (changesCount === 0) {
            _showModal('Aviso', 'No se detectaron cambios en las cantidades.');
            return;
        }

        _showModal('Confirmar Cambios', `Estás a punto de actualizar ${changesCount} producto(s) en tu inventario. ¿Deseas continuar?`, async () => {
             _showModal('Progreso', 'Guardando cambios...');
            try {
                await batch.commit();
                _showModal('Éxito', 'Las cantidades de tu inventario se han actualizado correctamente.');
                // La lista se actualizará automáticamente gracias al listener `startMainInventarioListener`
            } catch (error) {
                console.error("Error al guardar ajuste masivo:", error);
                _showModal('Error', 'Hubo un error al guardar los cambios.');
            }
        });
    }


    /**
     * Muestra la vista para modificar los datos maestros (Rubros, Segmentos, Marcas) - Solo Admin.
     */
    function showModificarDatosView() {
        if (_userRole !== 'admin') {
            _showModal('Acceso Denegado', 'Solo los administradores pueden modificar datos maestros.');
            return;
        }
        // --- INICIO CORRECCIÓN ---
        if (_floatingControls) {
            _floatingControls.classList.add('hidden');
        } else {
            console.warn("showModificarDatosView: floatingControls not available.");
        }
        // --- FIN CORRECCIÓN ---
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl">
                        <h2 class="text-2xl font-bold text-gray-800 mb-6 text-center">Modificar Datos Maestros</h2>
                        <p class="text-sm text-center text-gray-600 mb-6">Gestiona las categorías globales. Los cambios se propagarán a todos los usuarios. La eliminación solo es posible si la categoría no está en uso en tu inventario.</p>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Rubros */}
                            <div>
                                <h3 class="text-lg font-semibold text-gray-700 mb-2 border-b pb-2 flex justify-between items-center">
                                    <span>Rubros</span>
                                    <button onclick="window.inventarioModule.showAddCategoryModal('rubros', 'Rubro')" class="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600">+</button>
                                </h3>
                                <div id="rubros-list" class="space-y-2 max-h-60 overflow-y-auto border p-2 rounded bg-gray-50"></div>
                            </div>
                            {/* Segmentos */}
                            <div>
                                <h3 class="text-lg font-semibold text-gray-700 mb-2 border-b pb-2 flex justify-between items-center">
                                    <span>Segmentos</span>
                                     <button onclick="window.inventarioModule.showAddCategoryModal('segmentos', 'Segmento')" class="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600">+</button>
                                </h3>
                                <div id="segmentos-list" class="space-y-2 max-h-60 overflow-y-auto border p-2 rounded bg-gray-50"></div>
                            </div>
                            {/* Marcas */}
                            <div>
                                <h3 class="text-lg font-semibold text-gray-700 mb-2 border-b pb-2 flex justify-between items-center">
                                    <span>Marcas</span>
                                     <button onclick="window.inventarioModule.showAddCategoryModal('marcas', 'Marca')" class="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600">+</button>
                                </h3>
                                <div id="marcas-list" class="space-y-2 max-h-60 overflow-y-auto border p-2 rounded bg-gray-50"></div>
                            </div>
                        </div>
                        <div class="mt-8 flex flex-col sm:flex-row gap-4">
                            <button id="backToInventarioBtn" class="w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver</button>
                            {/* Botón eliminar todos los datos maestros */}
                            <button id="deleteAllDatosMaestrosBtn" class="w-full px-6 py-3 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700">Eliminar Todos los Datos Maestros</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('backToInventarioBtn').addEventListener('click', showInventarioSubMenu);
        document.getElementById('deleteAllDatosMaestrosBtn').addEventListener('click', handleDeleteAllDatosMaestros); // Listener añadido
        // Renderizar listas del admin actual
        renderDataListForEditing('rubros', 'rubros-list', 'Rubro');
        renderDataListForEditing('segmentos', 'segmentos-list', 'Segmento');
        renderDataListForEditing('marcas', 'marcas-list', 'Marca');
    }


    /**
     * Renderiza una lista de datos maestros del admin con botones para editar/eliminar.
     */
    function renderDataListForEditing(collectionName, containerId, itemName) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = `<p class="text-gray-500 text-sm p-2">Cargando ${itemName.toLowerCase()}s...</p>`; // Loading state

        const collectionRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/${collectionName}`);
        const unsubscribe = _onSnapshot(collectionRef, (snapshot) => {
            // Ordenar alfabéticamente por nombre
            const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            if (items.length === 0) {
                container.innerHTML = `<p class="text-gray-500 text-sm p-2">No hay ${itemName.toLowerCase()}s definidos.</p>`;
                return;
            }
            container.innerHTML = items.map(item => `
                <div class="flex justify-between items-center bg-white p-2 rounded shadow-sm border border-gray-200">
                    <span class="text-gray-800 text-sm flex-grow mr-2">${item.name}</span>
                    <div class="flex-shrink-0 space-x-1"> {/* Contenedor para botones */}
                        {/* No implementar edición aquí por simplicidad, se puede añadir luego */}
                        {/* <button onclick="window.inventarioModule.handleEditDataItem('${collectionName}', '${item.id}', '${item.name}', '${itemName}')" class="px-2 py-1 bg-yellow-500 text-white text-xs rounded hover:bg-yellow-600">E</button> */}
                        <button onclick="window.inventarioModule.handleDeleteDataItem('${collectionName}', '${item.name}', '${itemName}', '${item.id}')" class="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600" title="Eliminar">X</button>
                    </div>
                </div>
            `).join('');
        }, (error) => {
             console.error(`Error en listener de ${collectionName}:`, error);
             if (!window.isLoggingOut || error.code !== 'permission-denied') {
                  container.innerHTML = `<p class="text-red-500 text-center p-2">Error al cargar ${itemName.toLowerCase()}s.</p>`;
             }
        });
        _activeListeners.push(unsubscribe); // Registrar listener
    }


    /**
     * Muestra un modal genérico para agregar una nueva categoría (Rubro, Segmento, Marca).
     */
    function showAddCategoryModal(collectionName, itemName) {
        if (_userRole !== 'admin') return; // Seguridad

        _showModal(
            `Agregar Nuevo ${itemName}`,
            `<form id="addCategoryForm" class="space-y-4">
                <input type="text" id="newCategoryName" placeholder="Nombre del ${itemName}" class="w-full px-4 py-2 border rounded-lg" required>
                <p id="addCategoryMessage" class="text-sm text-red-600 h-4"></p> {/* Para mensajes de error/éxito */}
            </form>`,
            async () => { // Función onConfirm (al presionar el botón principal del modal)
                const input = document.getElementById('newCategoryName');
                const messageP = document.getElementById('addCategoryMessage');
                const newName = input.value.trim();
                messageP.textContent = ''; // Limpiar mensaje previo

                if (!newName) {
                    messageP.textContent = 'El nombre no puede estar vacío.';
                    input.focus();
                    return false; // Indicar al modal que no se cierre
                }
                const newNameUpper = newName.toUpperCase(); // Normalizar a mayúsculas

                try {
                    const collectionRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/${collectionName}`);
                    // Verificar duplicados (insensible a mayúsculas/minúsculas)
                    const q = _query(collectionRef, _where("name", "==", newNameUpper)); // Comparar con mayúsculas
                    const querySnapshot = await _getDocs(q);

                    if (!querySnapshot.empty) {
                        messageP.textContent = `"${newName}" ya existe.`;
                        input.select();
                        return false; // No cerrar modal
                    }

                    // Agregar la nueva categoría para el admin
                    const newItemData = { name: newNameUpper }; // Guardar en mayúsculas
                     // Añadir orden inicial si es segmento (para evitar problemas al ordenar)
                     if (collectionName === 'segmentos') {
                         const currentSegmentsSnapshot = await _getDocs(collectionRef);
                         const maxOrder = currentSegmentsSnapshot.docs.reduce((max, doc) => Math.max(max, doc.data().orden ?? -1), -1);
                         newItemData.orden = maxOrder + 1;
                     }
                    const docRef = await _addDoc(collectionRef, newItemData);

                    // Propagar a otros usuarios
                    if (window.adminModule && typeof window.adminModule.propagateCategoryChange === 'function') {
                         _showModal('Progreso', 'Propagando nueva categoría...');
                         // Pasar ID y datos del nuevo documento
                        await window.adminModule.propagateCategoryChange(collectionName, docRef.id, newItemData);
                         _showModal('Éxito', `"${newNameUpper}" agregado y propagado.`); // Usar mayúsculas
                    } else {
                         _showModal('Éxito', `"${newNameUpper}" agregado localmente (no se pudo propagar).`); // Usar mayúsculas
                    }
                     // Invalidar caché de orden si se agrega un segmento
                     if (collectionName === 'segmentos') invalidateSegmentOrderCache();

                    return true; // Indicar al modal que se cierre

                } catch (err) {
                    console.error(`Error al agregar ${itemName}:`, err);
                    messageP.textContent = 'Error al guardar.';
                    return false; // No cerrar modal
                }
            },
            'Guardar y Propagar', // Texto del botón de confirmación
             () => {}, // Callback de cancelar (vacío)
             true // Indicar que el botón de confirmación debe activar la validación/lógica
        );
         // Enfocar input al abrir modal
         setTimeout(() => document.getElementById('newCategoryName')?.focus(), 50);
    }


    /**
     * Maneja la eliminación de un item de datos maestros del admin, con validación de uso y propagación.
     */
    async function handleDeleteDataItem(collectionName, itemName, itemType, itemId) {
        if (_userRole !== 'admin') {
            _showModal('Acceso Denegado', 'Esta función es solo para administradores.');
            return;
        }

        const fieldMap = { rubros: 'rubro', segmentos: 'segmento', marcas: 'marca' };
        const fieldName = fieldMap[collectionName];
        if (!fieldName) {
             _showModal('Error Interno', 'Tipo de dato maestro no reconocido.');
             return;
        }

        // 1. Verificar uso en el inventario del ADMIN
        _showModal('Progreso', `Verificando uso de "${itemName}"...`);
        const inventarioRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`);
        const q = _query(inventarioRef, _where(fieldName, "==", itemName));
        try {
            const usageSnapshot = await _getDocs(q);
            if (!usageSnapshot.empty) {
                _showModal('Error al Eliminar', `No se puede eliminar ${itemType.toLowerCase()} "${itemName}" porque está siendo utilizado por ${usageSnapshot.size} producto(s) en tu inventario. Reasigna o elimina esos productos primero.`);
                return; // Detener si está en uso
            }

            // 2. Confirmar eliminación
            _showModal('Confirmar Eliminación', `¿Estás seguro de que deseas eliminar ${itemType.toLowerCase()} "${itemName}"? Esta acción se propagará a todos los usuarios y NO SE PUEDE DESHACER.`, async () => {
                _showModal('Progreso', `Eliminando "${itemName}" para admin...`);
                 try {
                     // 3. Eliminar para el admin
                     await _deleteDoc(_doc(_db, `artifacts/${_appId}/users/${_userId}/${collectionName}`, itemId));

                     // 4. Propagar eliminación a otros usuarios
                     if (window.adminModule && typeof window.adminModule.propagateCategoryChange === 'function') {
                          _showModal('Progreso', 'Propagando eliminación a otros usuarios...');
                         // Pasar null como datos para indicar eliminación
                         await window.adminModule.propagateCategoryChange(collectionName, itemId, null);
                         _showModal('Éxito', `${itemType} "${itemName}" eliminado y propagado.`);
                     } else {
                          _showModal('Advertencia', 'Eliminado localmente, pero no se pudo propagar automáticamente. Otros usuarios podrían seguir viéndolo.');
                     }
                      // Invalidar caché relevante si aplica (p.ej., segmentos)
                     if (collectionName === 'segmentos') invalidateSegmentOrderCache();

                 } catch (deleteError) {
                      console.error(`Error al eliminar/propagar ${itemName}:`, deleteError);
                      _showModal('Error', `Ocurrió un error durante la eliminación: ${deleteError.message}`);
                 }
            }, 'Sí, Eliminar'); // Botón de confirmación

        } catch (error) {
            _showModal('Error', `Ocurrió un error al verificar el uso del item: ${error.message}`);
        }
    }


    /**
     * Muestra la vista para agregar un nuevo producto (solo Admin).
     */
    function showAgregarProductoView() {
        if (_userRole !== 'admin') {
             _showModal('Acceso Denegado', 'Solo los administradores pueden agregar nuevos productos.');
             return;
        }
        // --- INICIO CORRECCIÓN ---
        if (_floatingControls) {
            _floatingControls.classList.add('hidden');
        } else {
            console.warn("showAgregarProductoView: floatingControls not available.");
        }
        // --- FIN CORRECCIÓN ---
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto max-w-2xl"> {/* Ancho consistente */}
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl text-center">
                        <h2 class="text-2xl font-bold text-gray-800 mb-6">Agregar Producto</h2>
                        <form id="productoForm" class="space-y-4 text-left">

                            {/* Datos Básicos */}
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label for="rubro" class="block text-gray-700 font-medium mb-1">Rubro:</label>
                                    <div class="flex items-center space-x-2">
                                        <select id="rubro" class="w-full px-4 py-2 border rounded-lg" required></select>
                                        {/* Botón "+" ahora llama al modal genérico */}
                                        <button type="button" onclick="window.inventarioModule.showAddCategoryModal('rubros', 'Rubro')" class="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-xs">+</button>
                                    </div>
                                </div>
                                <div>
                                    <label for="segmento" class="block text-gray-700 font-medium mb-1">Segmento:</label>
                                    <div class="flex items-center space-x-2">
                                        <select id="segmento" class="w-full px-4 py-2 border rounded-lg" required></select>
                                        <button type="button" onclick="window.inventarioModule.showAddCategoryModal('segmentos', 'Segmento')" class="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-xs">+</button>
                                    </div>
                                </div>
                                <div>
                                    <label for="marca" class="block text-gray-700 font-medium mb-1">Marca:</label>
                                    <div class="flex items-center space-x-2">
                                        <select id="marca" class="w-full px-4 py-2 border rounded-lg" required></select>
                                        <button type="button" onclick="window.inventarioModule.showAddCategoryModal('marcas', 'Marca')" class="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-xs">+</button>
                                    </div>
                                </div>
                                <div>
                                    <label for="presentacion" class="block text-gray-700 font-medium mb-1">Presentación:</label>
                                    <input type="text" id="presentacion" class="w-full px-4 py-2 border rounded-lg" required>
                                </div>
                            </div>

                            {/* Precios y Venta */}
                            <div class="border-t pt-4 mt-4"> {/* Añadir margen superior */}
                                <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"> {/* Ajustar layout y gap */}
                                    <div>
                                        <label class="block text-gray-700 font-medium mb-2">Venta por:</label>
                                        <div id="ventaPorContainer" class="flex items-center space-x-4">
                                            <label class="flex items-center"><input type="checkbox" id="ventaPorUnd" class="h-4 w-4"> <span class="ml-2">Und.</span></label>
                                            <label class="flex items-center"><input type="checkbox" id="ventaPorPaq" class="h-4 w-4"> <span class="ml-2">Paq.</span></label>
                                            <label class="flex items-center"><input type="checkbox" id="ventaPorCj" class="h-4 w-4"> <span class="ml-2">Cj.</span></label>
                                        </div>
                                    </div>
                                     {/* --- CAMBIO: Lógica Maneja Vacío --- */}
                                     <div class="mt-4 md:mt-0"> {/* Ajustar margen */}
                                         <label class="flex items-center cursor-pointer">
                                             <input type="checkbox" id="manejaVaciosCheck" class="h-4 w-4">
                                             <span class="ml-2 font-medium">Maneja Vacío</span>
                                         </label>
                                         <div id="tipoVacioContainer" class="mt-2 hidden"> {/* Oculto inicialmente */}
                                             <label for="tipoVacioSelect" class="block text-sm font-medium text-gray-600">Tipo de Vacío:</label>
                                             <select id="tipoVacioSelect" class="w-full px-2 py-1 border rounded-lg text-sm bg-gray-50">
                                                 <option value="">Seleccione...</option>
                                                 <option value="1/4 - 1/3">1/4 - 1/3</option>
                                                 <option value="ret 350 ml">Retornable 350 ml</option>
                                                 <option value="ret 1.25 Lts">Retornable 1.25 Lts</option>
                                             </select>
                                         </div>
                                     </div>
                                     {/* --- FIN CAMBIO --- */}
                                </div>
                                {/* Contenedor para Unidades por empaque */}
                                <div id="empaquesContainer" class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4"></div>
                                {/* Contenedor para Precios */}
                                <div id="preciosContainer" class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4"></div>
                            </div>

                            {/* Stock e IVA */}
                            <div class="border-t pt-4 mt-4"> {/* Añadir margen superior */}
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* --- CAMBIO: Simplificado a Cantidad Inicial 0 --- */}
                                    <div>
                                         <label class="block text-gray-700 font-medium mb-1">Cantidad Inicial:</label>
                                         <input type="number" id="cantidadInicial" value="0" class="w-full px-4 py-2 border rounded-lg bg-gray-100" readonly>
                                         <p class="text-xs text-gray-500 mt-1">La cantidad inicial siempre es 0. Ajústala luego si es necesario.</p>
                                    </div>
                                    {/* --- FIN CAMBIO --- */}
                                    <div>
                                        <label for="ivaTipo" class="block text-gray-700 font-medium mb-1">Tipo de IVA:</label>
                                        <select id="ivaTipo" class="w-full px-4 py-2 border rounded-lg" required>
                                            <option value="16" selected>IVA 16%</option> {/* Default a 16% */}
                                            <option value="0">Exento 0%</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <button type="submit" class="w-full px-6 py-3 bg-green-500 text-white font-semibold rounded-lg shadow-md hover:bg-green-600">Guardar Producto y Propagar</button>
                        </form>
                        <button id="backToInventarioBtn" class="mt-4 w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver</button>
                    </div>
                </div>
            </div>
        `;

        // Poblar dropdowns del admin
        _populateDropdown(`artifacts/${_appId}/users/${_userId}/rubros`, 'rubro', 'Rubro');
        _populateDropdown(`artifacts/${_appId}/users/${_userId}/segmentos`, 'segmento', 'Segmento');
        _populateDropdown(`artifacts/${_appId}/users/${_userId}/marcas`, 'marca', 'Marca');

        const ventaPorContainer = document.getElementById('ventaPorContainer');
        const preciosContainer = document.getElementById('preciosContainer');
        const empaquesContainer = document.getElementById('empaquesContainer');
        const manejaVaciosCheck = document.getElementById('manejaVaciosCheck');
        const tipoVacioContainer = document.getElementById('tipoVacioContainer');
        const tipoVacioSelect = document.getElementById('tipoVacioSelect');


        // Función para actualizar inputs dinámicos de empaques y precios
        const updateDynamicInputs = () => {
            empaquesContainer.innerHTML = ''; // Limpiar
            preciosContainer.innerHTML = '';  // Limpiar

            const ventaPorUnd = document.getElementById('ventaPorUnd').checked;
            const ventaPorPaq = document.getElementById('ventaPorPaq').checked;
            const ventaPorCj = document.getElementById('ventaPorCj').checked;

            // Añadir inputs de unidades si se seleccionan Paq o Cj
            if (ventaPorPaq) {
                empaquesContainer.innerHTML += `<div><label class="block text-sm font-medium">Unidades por Paquete:</label><input type="number" id="unidadesPorPaquete" min="1" step="1" class="w-full px-2 py-1 border rounded" value="1" required></div>`;
            }
            if (ventaPorCj) {
                empaquesContainer.innerHTML += `<div><label class="block text-sm font-medium">Unidades por Caja:</label><input type="number" id="unidadesPorCaja" min="1" step="1" class="w-full px-2 py-1 border rounded" value="1" required></div>`;
            }

            // Añadir inputs de precios según selección
            if (ventaPorUnd) {
                preciosContainer.innerHTML += `<div><label class="block text-sm font-medium">Precio por Und.</label><input type="number" step="0.01" min="0" id="precioUnd" class="w-full px-2 py-1 border rounded" required></div>`;
            }
            if (ventaPorPaq) {
                preciosContainer.innerHTML += `<div><label class="block text-sm font-medium">Precio por Paq.</label><input type="number" step="0.01" min="0" id="precioPaq" class="w-full px-2 py-1 border rounded" required></div>`;
            }
            if (ventaPorCj) {
                preciosContainer.innerHTML += `<div><label class="block text-sm font-medium">Precio por Cj.</label><input type="number" step="0.01" min="0" id="precioCj" class="w-full px-2 py-1 border rounded" required></div>`;
            }

            // Validar que al menos un precio sea requerido si su checkbox está marcado
             preciosContainer.querySelectorAll('input').forEach(input => {
                 // El input es requerido si el checkbox correspondiente está marcado
                 const tipo = input.id.substring(6); // 'Und', 'Paq', 'Cj'
                 const checkbox = document.getElementById(`ventaPor${tipo}`);
                 input.required = checkbox ? checkbox.checked : false;
             });
        };

        // Listener para mostrar/ocultar y requerir tipo de vacío
        manejaVaciosCheck.addEventListener('change', () => {
            if (manejaVaciosCheck.checked) {
                tipoVacioContainer.classList.remove('hidden');
                tipoVacioSelect.required = true;
            } else {
                tipoVacioContainer.classList.add('hidden');
                tipoVacioSelect.required = false;
                tipoVacioSelect.value = ''; // Resetear valor
            }
        });

        // Listener para actualizar inputs dinámicos cuando cambie "Venta por"
        ventaPorContainer.addEventListener('change', updateDynamicInputs);

        // Llamada inicial para configurar los inputs
        updateDynamicInputs();

        // Listeners formulario y botones
        document.getElementById('productoForm').addEventListener('submit', agregarProducto);
        document.getElementById('backToInventarioBtn').addEventListener('click', showInventarioSubMenu);
        // Los botones "+" ahora llaman a showAddCategoryModal directamente desde el HTML
    }


    /**
     * Recolecta y calcula los datos del formulario de producto para agregar o editar.
     */
    function getProductoDataFromForm(isEditing = false) {
        const unidadesPorPaqueteInput = document.getElementById('unidadesPorPaquete');
        const unidadesPorCajaInput = document.getElementById('unidadesPorCaja');
        // Usar valor del input si existe, si no, 1. Asegurar que sea >= 1.
        const unidadesPorPaquete = Math.max(1, unidadesPorPaqueteInput ? (parseInt(unidadesPorPaqueteInput.value, 10) || 1) : 1);
        const unidadesPorCaja = Math.max(1, unidadesPorCajaInput ? (parseInt(unidadesPorCajaInput.value, 10) || 1) : 1);

        const precioUndInput = document.getElementById('precioUnd');
        const precioPaqInput = document.getElementById('precioPaq');
        const precioCjInput = document.getElementById('precioCj');

        // Obtener precios, asegurando que sean >= 0
        const precios = {
            und: Math.max(0, precioUndInput ? (parseFloat(precioUndInput.value) || 0) : 0),
            paq: Math.max(0, precioPaqInput ? (parseFloat(precioPaqInput.value) || 0) : 0),
            cj: Math.max(0, precioCjInput ? (parseFloat(precioCjInput.value) || 0) : 0),
        };

        // Calcular precio por unidad (se usa en ventas si no hay precio específico)
        let precioFinalPorUnidad = 0;
        // Priorizar Und, luego Paq, luego Cj para el cálculo base
        if (precios.und > 0) {
            precioFinalPorUnidad = precios.und;
        } else if (precios.paq > 0 && unidadesPorPaquete > 0) {
            precioFinalPorUnidad = precios.paq / unidadesPorPaquete;
        } else if (precios.cj > 0 && unidadesPorCaja > 0) {
            precioFinalPorUnidad = precios.cj / unidadesPorCaja;
        }
        // Redondear a 2 decimales si es necesario
        precioFinalPorUnidad = parseFloat(precioFinalPorUnidad.toFixed(2));


        // --- CAMBIO: Manejo de Cantidad ---
        let cantidadTotalUnidades;
        if (isEditing) {
            // En edición, LEEMOS la cantidad actual (solo lectura) y la MANTENEMOS.
            // NO se usa ningún input editable de cantidad aquí.
             const cantidadActualInput = document.getElementById('cantidadActual'); // El input readonly
             cantidadTotalUnidades = cantidadActualInput ? (parseInt(cantidadActualInput.value, 10) || 0) : 0;
             console.log("Editing product, preserving quantity:", cantidadTotalUnidades);

        } else {
            // Al agregar, la cantidad inicial siempre es 0
            cantidadTotalUnidades = 0;
            console.log("Adding new product, initial quantity:", cantidadTotalUnidades);
        }
        // --- FIN CAMBIO ---

        // --- CAMBIO: Manejo de Vacío ---
        const manejaVaciosChecked = document.getElementById('manejaVaciosCheck').checked;
        const tipoVacioSelected = document.getElementById('tipoVacioSelect').value;
        // --- FIN CAMBIO ---

        return {
            rubro: document.getElementById('rubro').value,
            segmento: document.getElementById('segmento').value,
            marca: document.getElementById('marca').value,
            presentacion: document.getElementById('presentacion').value.trim(), // Quitar espacios extra
            unidadesPorPaquete: unidadesPorPaquete,
            unidadesPorCaja: unidadesPorCaja,
            ventaPor: { // Guardar estado de checkboxes
                und: document.getElementById('ventaPorUnd').checked,
                paq: document.getElementById('ventaPorPaq').checked,
                cj: document.getElementById('ventaPorCj').checked,
            },
            // --- CAMBIO: Guardar datos de vacío ---
            manejaVacios: manejaVaciosChecked,
            tipoVacio: manejaVaciosChecked ? tipoVacioSelected : null, // Guardar tipo solo si maneja vacío
            // --- FIN CAMBIO ---
            precios: precios, // Guardar objeto de precios
            precioPorUnidad: precioFinalPorUnidad, // Guardar precio unitario calculado
            cantidadUnidades: cantidadTotalUnidades, // Cantidad total en unidades base
            iva: parseInt(document.getElementById('ivaTipo').value, 10) // Guardar IVA como número
        };
    }


    /**
     * Agrega un nuevo producto al inventario del admin y propaga a otros usuarios.
     */
    async function agregarProducto(e) {
        e.preventDefault();
        if (_userRole !== 'admin') return; // Seguridad

        const productoData = getProductoDataFromForm(false); // Obtener datos (false = no es edición)

        // --- Validaciones Mejoradas ---
        if (!productoData.rubro || !productoData.segmento || !productoData.marca || !productoData.presentacion) {
            _showModal('Error', 'Debes completar Rubro, Segmento, Marca y Presentación.');
            return;
        }
        if (!productoData.ventaPor.und && !productoData.ventaPor.paq && !productoData.ventaPor.cj) {
            _showModal('Error', 'Debes seleccionar al menos una forma de venta (Und, Paq, o Cj).');
            return;
        }
         // Validar que se haya seleccionado un tipo de vacío si "Maneja Vacío" está marcado
         if (productoData.manejaVacios && !productoData.tipoVacio) {
             _showModal('Error', 'Si el producto maneja vacío, debes seleccionar el tipo de vacío.');
             document.getElementById('tipoVacioSelect')?.focus(); // Enfocar el select problemático
             return;
         }
         // Validar que se haya ingresado al menos un precio correspondiente a la forma de venta
         let precioValidoIngresado = false;
         if (productoData.ventaPor.und && productoData.precios.und > 0) precioValidoIngresado = true;
         if (productoData.ventaPor.paq && productoData.precios.paq > 0) precioValidoIngresado = true;
         if (productoData.ventaPor.cj && productoData.precios.cj > 0) precioValidoIngresado = true;
         if (!precioValidoIngresado) {
              _showModal('Error', 'Debes ingresar al menos un precio válido (mayor a 0) correspondiente a la forma de venta seleccionada.');
              // Enfocar el primer input de precio visible y requerido
              document.querySelector('#preciosContainer input[required]')?.focus();
              return;
         }


        _showModal('Progreso', 'Verificando y guardando producto...');

        try {
            // Verificar duplicados en el inventario del admin (comparación exacta por ahora)
            const inventarioRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`);
            const q = _query(inventarioRef,
                _where("rubro", "==", productoData.rubro),
                _where("segmento", "==", productoData.segmento),
                _where("marca", "==", productoData.marca),
                _where("presentacion", "==", productoData.presentacion)
            );
            const querySnapshot = await _getDocs(q);
            if (!querySnapshot.empty) {
                _showModal('Producto Duplicado', 'Ya existe un producto con el mismo Rubro, Segmento, Marca y Presentación.');
                return; // Detener si es duplicado
            }

            // Agregar el producto al inventario del admin (cantidadUnidades ya es 0)
            const docRef = await _addDoc(inventarioRef, productoData);
            const newProductId = docRef.id; // Obtener el ID del nuevo documento

            // Propagar el nuevo producto a otros usuarios
            if (window.adminModule && typeof window.adminModule.propagateProductChange === 'function') {
                 _showModal('Progreso', 'Propagando nuevo producto a otros usuarios...');
                 // Pasar ID y datos (con cantidad 0)
                await window.adminModule.propagateProductChange(newProductId, productoData);
                _showModal('Éxito', 'Producto agregado y propagado correctamente.');
            } else {
                 _showModal('Éxito', 'Producto agregado localmente (no se pudo propagar).');
            }


            showAgregarProductoView(); // Limpiar y resetear formulario para agregar otro
        } catch (err) {
            console.error("Error al agregar producto:", err);
            _showModal('Error', `Hubo un error al guardar el producto: ${err.message}`);
        }
    }


    /**
     * Muestra la vista para modificar o eliminar un producto.
     */
    function showModifyDeleteView() {
         // --- INICIO CORRECCIÓN ---
         if (_floatingControls) {
            _floatingControls.classList.add('hidden');
        } else {
            console.warn("showModifyDeleteView: floatingControls not available.");
        }
        // --- FIN CORRECCIÓN ---
        const isAdmin = _userRole === 'admin';
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl">
                        <h2 class="text-2xl font-bold text-gray-800 mb-6 text-center">Ver Productos / ${isAdmin ? 'Modificar Def.' : 'Consultar Stock'}</h2>
                        ${getFiltrosHTML('modify')} {/* Reutilizar filtros */}
                        <div id="productosListContainer" class="overflow-x-auto max-h-96 border rounded-lg"> {/* Añadir borde */}
                            <p class="text-gray-500 text-center p-4">Cargando productos...</p>
                        </div>
                        <div class="mt-6 flex flex-col sm:flex-row gap-4">
                            <button id="backToInventarioBtn" class="w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver</button>
                            {/* Botón eliminar todos solo para admin */}
                            ${isAdmin ? `<button id="deleteAllProductosBtn" class="w-full px-6 py-3 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700">Eliminar Todos los Productos</button>` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('backToInventarioBtn').addEventListener('click', showInventarioSubMenu);
        if (isAdmin) {
             document.getElementById('deleteAllProductosBtn')?.addEventListener('click', handleDeleteAllProductos);
        }

        const renderCallback = () => renderProductosList('productosListContainer', !isAdmin); // Pasar true si no es admin

        // Poblar filtro de rubros del usuario actual
        _populateDropdown(`artifacts/${_appId}/users/${_userId}/rubros`, 'modify-filter-rubro', 'Rubro');

        setupFiltros('modify', renderCallback); // Configurar filtros para esta vista
        // Iniciar listener del inventario del usuario actual
        startMainInventarioListener(renderCallback);
    }


    /**
     * Genera el HTML para los controles de filtro reutilizables.
     */
    function getFiltrosHTML(prefix) {
        // Restaurar valores guardados
         const currentSearch = _lastFilters.searchTerm || '';
         const currentRubro = _lastFilters.rubro || '';
         // Segmento y Marca se poblarán y seleccionarán dinámicamente

        return `
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 p-4 border rounded-lg bg-gray-50"> {/* Fondo ligero */}
                <input type="text" id="${prefix}-search-input" placeholder="Buscar por Presentación, Marca, Segmento..." class="md:col-span-4 w-full px-4 py-2 border rounded-lg text-sm" value="${currentSearch}"> {/* Restaurar valor */}
                <div>
                    <label for="${prefix}-filter-rubro" class="block text-xs font-medium text-gray-600 mb-1">Rubro</label>
                    <select id="${prefix}-filter-rubro" class="w-full px-2 py-1 border rounded-lg text-sm"><option value="">Todos</option></select> {/* El valor se restaura en setupFiltros */}
                </div>
                 <div>
                    <label for="${prefix}-filter-segmento" class="block text-xs font-medium text-gray-600 mb-1">Segmento</label>
                    <select id="${prefix}-filter-segmento" class="w-full px-2 py-1 border rounded-lg text-sm" disabled><option value="">Todos</option></select>
                </div>
                 <div>
                    <label for="${prefix}-filter-marca" class="block text-xs font-medium text-gray-600 mb-1">Marca</label>
                    <select id="${prefix}-filter-marca" class="w-full px-2 py-1 border rounded-lg text-sm" disabled><option value="">Todos</option></select>
                </div>
                {/* Botón más pequeño y alineado */}
                <button id="${prefix}-clear-filters-btn" class="bg-gray-300 text-xs font-semibold rounded-lg self-end py-1.5 px-3 hover:bg-gray-400">Limpiar</button>
            </div>
        `;
    }


    /**
     * Configura los listeners y la lógica para los filtros reutilizables.
     */
    function setupFiltros(prefix, renderCallback) {
        const searchInput = document.getElementById(`${prefix}-search-input`);
        const rubroFilter = document.getElementById(`${prefix}-filter-rubro`);
        const segmentoFilter = document.getElementById(`${prefix}-filter-segmento`);
        const marcaFilter = document.getElementById(`${prefix}-filter-marca`);
        const clearBtn = document.getElementById(`${prefix}-clear-filters-btn`);

        // --- Lógica para poblar Segmento y Marca dinámicamente ---
        function updateDependentFilters(trigger) {
            const selectedRubro = rubroFilter.value;
            const selectedSegmento = segmentoFilter.value;

            // Actualizar Segmentos si cambió Rubro o al inicio
            if (trigger === 'rubro' || trigger === 'init') {
                const currentSegmentoValue = (trigger === 'init') ? _lastFilters.segmento : ''; // Mantener valor inicial o resetear
                segmentoFilter.innerHTML = '<option value="">Todos</option>';
                segmentoFilter.disabled = true;
                segmentoFilter.value = currentSegmentoValue; // Intentar restaurar/resetear

                if (selectedRubro) {
                    const segmentos = [...new Set(_inventarioCache
                        .filter(p => p.rubro === selectedRubro && p.segmento) // Filtrar por rubro y asegurar que segmento exista
                        .map(p => p.segmento)
                    )].sort(); // Obtener segmentos únicos y ordenar

                    if (segmentos.length > 0) {
                         segmentos.forEach(s => segmentoFilter.innerHTML += `<option value="${s}" ${s === currentSegmentoValue ? 'selected' : ''}>${s}</option>`);
                         segmentoFilter.disabled = false;
                    }
                }
            }

            // Actualizar Marcas si cambió Rubro o Segmento o al inicio
            if (trigger === 'rubro' || trigger === 'segmento' || trigger === 'init') {
                 const currentMarcaValue = (trigger === 'init') ? _lastFilters.marca : ''; // Mantener valor inicial o resetear
                 marcaFilter.innerHTML = '<option value="">Todos</option>';
                 marcaFilter.disabled = true;
                 marcaFilter.value = currentMarcaValue; // Intentar restaurar/resetear

                 // Habilitar Marcas si se seleccionó Rubro (y opcionalmente Segmento)
                 if (selectedRubro) {
                     const marcas = [...new Set(_inventarioCache
                         .filter(p => p.rubro === selectedRubro && (!selectedSegmento || p.segmento === selectedSegmento) && p.marca) // Filtrar por rubro (y segmento si existe) y asegurar marca
                         .map(p => p.marca)
                     )].sort(); // Obtener marcas únicas y ordenar

                     if (marcas.length > 0) {
                          marcas.forEach(m => marcaFilter.innerHTML += `<option value="${m}" ${m === currentMarcaValue ? 'selected' : ''}>${m}</option>`);
                          marcaFilter.disabled = false;
                     }
                 }
            }
        }


        // Restaurar filtros guardados y poblar dependientes al inicio
        // Usar un pequeño retraso para asegurar que _inventarioCache esté poblado por el listener
        setTimeout(() => {
             // Restaurar valor de Rubro primero
             rubroFilter.value = _lastFilters.rubro || '';
             // Poblar y restaurar Segmento y Marca
             updateDependentFilters('init');
             // Llamar al renderCallback inicial después de restaurar filtros
             if (typeof renderCallback === 'function') {
                 renderCallback();
             }
        }, 200); // Ligero aumento del delay


        // Función para aplicar y guardar filtros
        const applyAndSaveFilters = () => {
            _lastFilters.searchTerm = searchInput.value || ''; // Guardar valor actual
            _lastFilters.rubro = rubroFilter.value || '';
            _lastFilters.segmento = segmentoFilter.value || '';
            _lastFilters.marca = marcaFilter.value || '';
             if (typeof renderCallback === 'function') {
                renderCallback(); // Re-renderizar lista
             }
        };

        // Listeners para cambios
        searchInput.addEventListener('input', applyAndSaveFilters);
        rubroFilter.addEventListener('change', () => {
            _lastFilters.segmento = ''; // Resetear segmento al cambiar rubro
            _lastFilters.marca = ''; // Resetear marca
            updateDependentFilters('rubro'); // Actualizar dropdowns dependientes
            applyAndSaveFilters(); // Aplicar y guardar
        });
        segmentoFilter.addEventListener('change', () => {
             _lastFilters.marca = ''; // Resetear marca al cambiar segmento
             updateDependentFilters('segmento'); // Actualizar dropdown de marca
             applyAndSaveFilters(); // Aplicar y guardar
        });
        marcaFilter.addEventListener('change', applyAndSaveFilters); // Solo aplicar y guardar

        // Listener para limpiar filtros
        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            rubroFilter.value = '';
            // Llamar a updateDependentFilters para resetear y deshabilitar Segmento/Marca
            updateDependentFilters('rubro');
            applyAndSaveFilters(); // Aplicar filtros vacíos
        });

        // No llamar a renderCallback aquí, se llama después del setTimeout inicial
    }


    /**
     * Renderiza la lista de productos en una tabla, mostrando/ocultando botones según rol.
     */
    async function renderProductosList(elementId, readOnly = false) {
        const container = document.getElementById(elementId);
        if (!container) return;

        let productos = [..._inventarioCache]; // Usar caché actualizada

        // Aplicar filtros
        productos = productos.filter(p => {
            const searchTermLower = (_lastFilters.searchTerm || '').toLowerCase();
            const textMatch = !searchTermLower ||
                              (p.presentacion && p.presentacion.toLowerCase().includes(searchTermLower)) ||
                              (p.marca && p.marca.toLowerCase().includes(searchTermLower)) ||
                              (p.segmento && p.segmento.toLowerCase().includes(searchTermLower));
            const rubroMatch = !_lastFilters.rubro || p.rubro === _lastFilters.rubro;
            const segmentoMatch = !_lastFilters.segmento || p.segmento === _lastFilters.segmento;
            const marcaMatch = !_lastFilters.marca || p.marca === _lastFilters.marca;
            return textMatch && rubroMatch && segmentoMatch && marcaMatch;
        });

        // Ordenar
        const segmentoOrderMap = await getSegmentoOrderMap(); // Orden del usuario actual
        productos.sort((a, b) => {
            const orderA = segmentoOrderMap[a.segmento] ?? 9999;
            const orderB = segmentoOrderMap[b.segmento] ?? 9999;
            if (orderA !== orderB) return orderA - orderB;
            const marcaComp = (a.marca || '').localeCompare(b.marca || '');
            if (marcaComp !== 0) return marcaComp;
            return (a.presentacion || '').localeCompare(b.presentacion || '');
        });

        // Renderizar
        if (productos.length === 0) {
            container.innerHTML = `<p class="text-gray-500 text-center p-4">No hay productos que coincidan con los filtros.</p>`;
            return;
        }

        // Definir columnas según si es readOnly
        const cols = readOnly ? 3 : 4;
        let tableHTML = `<table class="min-w-full bg-white text-sm"><thead class="bg-gray-200 sticky top-0 z-10"><tr>
            <th class="py-2 px-3 border-b text-left">Presentación</th>
            <th class="py-2 px-3 border-b text-right">Precio</th>
            <th class="py-2 px-3 border-b text-center">Stock</th>
            ${!readOnly ? `<th class="py-2 px-3 border-b text-center">Acciones</th>` : ''}
        </tr></thead><tbody>`;

        let currentSegmento = null;
        let currentMarca = null;
        productos.forEach(p => {
            const segmento = p.segmento || 'Sin Segmento';
            const marca = p.marca || 'Sin Marca';

            if (segmento !== currentSegmento) {
                currentSegmento = segmento;
                currentMarca = null;
                 // Fila de segmento sticky
                tableHTML += `<tr><td colspan="${cols}" class="py-2 px-4 bg-gray-300 font-bold text-gray-800 sticky top-[calc(theme(height.10))] z-[9]">${currentSegmento}</td></tr>`; // Ajustar top y z-index
            }
            if (marca !== currentMarca) {
                currentMarca = marca;
                tableHTML += `<tr><td colspan="${cols}" class="py-2 px-4 bg-gray-100 font-semibold text-gray-600 pl-8">${currentMarca}</td></tr>`;
            }

            // Calcular display de presentación, precio y stock
            const ventaPor = p.ventaPor || { und: true };
            const precios = p.precios || { und: p.precioPorUnidad || 0 }; // Usar objeto precios
            let displayPresentacion = p.presentacion || 'N/A';
            let displayPrecio = `$0.00`;
            let displayStock = `${p.cantidadUnidades || 0} Und`;
            let unitTypeStock = 'Und'; // Unidad para el tooltip
            let conversionFactorStock = 1; // Factor para el tooltip

            // Priorizar Caja, luego Paquete, luego Und para mostrar PRECIO Y STOCK
             if (ventaPor.cj) {
                 if (p.unidadesPorCaja) displayPresentacion += ` <span class="text-xs text-gray-500">(${p.unidadesPorCaja} und.)</span>`;
                 displayPrecio = `$${(precios.cj || 0).toFixed(2)}`;
                 conversionFactorStock = Math.max(1, p.unidadesPorCaja || 1); // Asegurar > 0
                 displayStock = `${Math.floor((p.cantidadUnidades || 0) / conversionFactorStock)} Cj`;
                 unitTypeStock = 'Cj';
            } else if (ventaPor.paq) {
                 if (p.unidadesPorPaquete) displayPresentacion += ` <span class="text-xs text-gray-500">(${p.unidadesPorPaquete} und.)</span>`;
                 displayPrecio = `$${(precios.paq || 0).toFixed(2)}`;
                 conversionFactorStock = Math.max(1, p.unidadesPorPaquete || 1); // Asegurar > 0
                 displayStock = `${Math.floor((p.cantidadUnidades || 0) / conversionFactorStock)} Paq`;
                 unitTypeStock = 'Paq';
            } else { // Fallback a Und
                 displayPrecio = `$${(precios.und || 0).toFixed(2)}`;
                 // conversionFactorStock y unitTypeStock ya son Und por defecto
            }

             // Tooltip con stock en unidades base
             const stockEnUnidades = p.cantidadUnidades || 0;
             const stockTooltip = `${stockEnUnidades} Und. Base`;


            tableHTML += `
                <tr class="hover:bg-gray-50">
                    <td class="py-2 px-3 border-b pl-12">${displayPresentacion}</td>
                    <td class="py-2 px-3 border-b text-right font-medium">${displayPrecio}</td>
                    {/* Añadir tooltip al stock */}
                    <td class="py-2 px-3 border-b text-center font-medium" title="${stockTooltip}">${displayStock}</td>
                    ${!readOnly ? `
                    <td class="py-2 px-3 border-b text-center space-x-1">
                        <button onclick="window.inventarioModule.editProducto('${p.id}')" class="px-2 py-1 bg-yellow-500 text-white text-xs rounded hover:bg-yellow-600" title="Editar Definición">Edt</button>
                        <button onclick="window.inventarioModule.deleteProducto('${p.id}')" class="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600" title="Eliminar Producto">Del</button>
                    </td>` : ''}
                </tr>
            `;
        });
        tableHTML += `</tbody></table>`;
        container.innerHTML = tableHTML;
    }


    /**
     * Muestra el formulario para editar un producto (solo Admin).
     */
    function editProducto(productId) {
        if (_userRole !== 'admin') {
             _showModal('Acceso Denegado', 'Solo los administradores pueden editar la definición de productos.');
             return;
        }
        const producto = _inventarioCache.find(p => p.id === productId);
        if (!producto) {
            _showModal('Error', 'Producto no encontrado.');
            return;
        }

        // --- INICIO CORRECCIÓN ---
        if (_floatingControls) {
            _floatingControls.classList.add('hidden');
        } else {
            console.warn("editProducto: floatingControls not available.");
        }
        // --- FIN CORRECCIÓN ---
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto max-w-2xl"> {/* Ancho consistente */}
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl text-center">
                        <h2 class="text-2xl font-bold text-gray-800 mb-6">Editar Producto</h2>
                        <form id="editProductoForm" class="space-y-4 text-left">
                             {/* --- Campos existentes (Rubro, Segmento, Marca, Presentación) --- */}
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label for="rubro" class="block text-gray-700 font-medium mb-1">Rubro:</label>
                                    <div class="flex items-center space-x-2">
                                        <select id="rubro" class="w-full px-4 py-2 border rounded-lg" required></select>
                                        <button type="button" onclick="window.inventarioModule.showAddCategoryModal('rubros', 'Rubro')" class="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-xs">+</button>
                                    </div>
                                </div>
                                <div>
                                    <label for="segmento" class="block text-gray-700 font-medium mb-1">Segmento:</label>
                                    <div class="flex items-center space-x-2">
                                        <select id="segmento" class="w-full px-4 py-2 border rounded-lg" required></select>
                                         <button type="button" onclick="window.inventarioModule.showAddCategoryModal('segmentos', 'Segmento')" class="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-xs">+</button>
                                    </div>
                                </div>
                                <div>
                                    <label for="marca" class="block text-gray-700 font-medium mb-1">Marca:</label>
                                     <div class="flex items-center space-x-2">
                                        <select id="marca" class="w-full px-4 py-2 border rounded-lg" required></select>
                                         <button type="button" onclick="window.inventarioModule.showAddCategoryModal('marcas', 'Marca')" class="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-xs">+</button>
                                    </div>
                                </div>
                                <div>
                                    <label for="presentacion" class="block text-gray-700 font-medium mb-1">Presentación:</label>
                                    <input type="text" id="presentacion" class="w-full px-4 py-2 border rounded-lg" required>
                                </div>
                            </div>

                             {/* --- Sección Venta por / Maneja Vacío --- */}
                             <div class="border-t pt-4 mt-4">
                                 <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                     <div>
                                         <label class="block text-gray-700 font-medium mb-2">Venta por:</label>
                                         <div id="ventaPorContainer" class="flex items-center space-x-4">
                                             {/* Checkboxes Und, Paq, Cj */}
                                             <label class="flex items-center"><input type="checkbox" id="ventaPorUnd" class="h-4 w-4"> <span class="ml-2">Und.</span></label>
                                             <label class="flex items-center"><input type="checkbox" id="ventaPorPaq" class="h-4 w-4"> <span class="ml-2">Paq.</span></label>
                                             <label class="flex items-center"><input type="checkbox" id="ventaPorCj" class="h-4 w-4"> <span class="ml-2">Cj.</span></label>
                                         </div>
                                     </div>
                                      <div class="mt-4 md:mt-0">
                                          <label class="flex items-center cursor-pointer">
                                              <input type="checkbox" id="manejaVaciosCheck" class="h-4 w-4">
                                              <span class="ml-2 font-medium">Maneja Vacío</span>
                                          </label>
                                          <div id="tipoVacioContainer" class="mt-2 hidden">
                                              <label for="tipoVacioSelect" class="block text-sm font-medium text-gray-600">Tipo de Vacío:</label>
                                              <select id="tipoVacioSelect" class="w-full px-2 py-1 border rounded-lg text-sm bg-gray-50">
                                                  {/* Opciones de tipo vacío */}
                                                  <option value="">Seleccione...</option>
                                                  <option value="1/4 - 1/3">1/4 - 1/3</option>
                                                  <option value="ret 350 ml">Retornable 350 ml</option>
                                                  <option value="ret 1.25 Lts">Retornable 1.25 Lts</option>
                                              </select>
                                          </div>
                                      </div>
                                 </div>
                                 {/* Contenedores dinámicos para empaques y precios */}
                                 <div id="empaquesContainer" class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4"></div>
                                 <div id="preciosContainer" class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4"></div>
                             </div>

                             {/* --- Sección Stock (Solo lectura) e IVA --- */}
                            <div class="border-t pt-4 mt-4">
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Mostrar stock actual como solo lectura */}
                                     <div>
                                         <label class="block text-gray-700 font-medium mb-1">Stock Actual (Unidades):</label>
                                         <input type="number" id="cantidadActual" value="${producto.cantidadUnidades || 0}" class="w-full px-4 py-2 border rounded-lg bg-gray-100" readonly>
                                         <p class="text-xs text-gray-500 mt-1">El stock se modifica desde "Ajuste Masivo".</p>
                                    </div>
                                     {/* Selección de IVA */}
                                    <div>
                                        <label for="ivaTipo" class="block text-gray-700 font-medium mb-1">Tipo de IVA:</label>
                                        <select id="ivaTipo" class="w-full px-4 py-2 border rounded-lg" required>
                                            <option value="16">IVA 16%</option>
                                            <option value="0">Exento 0%</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <button type="submit" class="w-full px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg shadow-md hover:bg-blue-600">Guardar Cambios y Propagar</button>
                        </form>
                        <button id="backToModifyDeleteBtn" class="mt-4 w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver</button>
                    </div>
                </div>
            </div>
        `;

        // Poblar dropdowns del admin
        _populateDropdown(`artifacts/${_appId}/users/${_userId}/rubros`, 'rubro', 'Rubro', producto.rubro);
        _populateDropdown(`artifacts/${_appId}/users/${_userId}/segmentos`, 'segmento', 'Segmento', producto.segmento);
        _populateDropdown(`artifacts/${_appId}/users/${_userId}/marcas`, 'marca', 'Marca', producto.marca);

        // Referencias a elementos dinámicos
        const ventaPorContainer = document.getElementById('ventaPorContainer');
        const preciosContainer = document.getElementById('preciosContainer');
        const empaquesContainer = document.getElementById('empaquesContainer');
        const manejaVaciosCheck = document.getElementById('manejaVaciosCheck');
        const tipoVacioContainer = document.getElementById('tipoVacioContainer');
        const tipoVacioSelect = document.getElementById('tipoVacioSelect');

        // Función para actualizar inputs dinámicos (igual que en agregar)
        const updateDynamicInputs = () => {
            empaquesContainer.innerHTML = '';
            preciosContainer.innerHTML = '';

            const ventaPorUnd = document.getElementById('ventaPorUnd').checked;
            const ventaPorPaq = document.getElementById('ventaPorPaq').checked;
            const ventaPorCj = document.getElementById('ventaPorCj').checked;

            if (ventaPorPaq) empaquesContainer.innerHTML += `<div><label class="block text-sm font-medium">Unidades por Paquete:</label><input type="number" id="unidadesPorPaquete" min="1" step="1" class="w-full px-2 py-1 border rounded" value="1" required></div>`;
            if (ventaPorCj) empaquesContainer.innerHTML += `<div><label class="block text-sm font-medium">Unidades por Caja:</label><input type="number" id="unidadesPorCaja" min="1" step="1" class="w-full px-2 py-1 border rounded" value="1" required></div>`;

            if (ventaPorUnd) preciosContainer.innerHTML += `<div><label class="block text-sm font-medium">Precio por Und.</label><input type="number" step="0.01" min="0" id="precioUnd" class="w-full px-2 py-1 border rounded" required></div>`;
            if (ventaPorPaq) preciosContainer.innerHTML += `<div><label class="block text-sm font-medium">Precio por Paq.</label><input type="number" step="0.01" min="0" id="precioPaq" class="w-full px-2 py-1 border rounded" required></div>`;
            if (ventaPorCj) preciosContainer.innerHTML += `<div><label class="block text-sm font-medium">Precio por Cj.</label><input type="number" step="0.01" min="0" id="precioCj" class="w-full px-2 py-1 border rounded" required></div>`;

             preciosContainer.querySelectorAll('input').forEach(input => {
                 input.required = document.getElementById(`ventaPor${input.id.substring(6)}`)?.checked ?? false;
             });
        };

        // Listener para Maneja Vacío (igual que en agregar)
        manejaVaciosCheck.addEventListener('change', () => {
            if (manejaVaciosCheck.checked) {
                tipoVacioContainer.classList.remove('hidden');
                tipoVacioSelect.required = true;
            } else {
                tipoVacioContainer.classList.add('hidden');
                tipoVacioSelect.required = false;
                tipoVacioSelect.value = '';
            }
        });

        // Listener para Venta Por (igual que en agregar)
        ventaPorContainer.addEventListener('change', updateDynamicInputs);


        // --- POBLAR EL FORMULARIO CON DATOS EXISTENTES ---
        // Usar setTimeout para asegurar que los dropdowns se hayan poblado
        setTimeout(() => {
            document.getElementById('presentacion').value = producto.presentacion || '';
            document.getElementById('ivaTipo').value = producto.iva !== undefined ? producto.iva : 16; // Default a 16 si no existe

            // Poblar checkboxes "Venta por"
            if (producto.ventaPor) {
                document.getElementById('ventaPorUnd').checked = producto.ventaPor.und || false;
                document.getElementById('ventaPorPaq').checked = producto.ventaPor.paq || false;
                document.getElementById('ventaPorCj').checked = producto.ventaPor.cj || false;
            } else { // Fallback si ventaPor no existe (datos antiguos)
                 document.getElementById('ventaPorUnd').checked = true; // Asumir venta por unidad
            }
            // Llamar a updateDynamicInputs DESPUÉS de setear los checkboxes
            updateDynamicInputs();

            // Poblar campos dinámicos (empaques y precios)
            // Asegurar que los inputs existan antes de asignar valor
            const undPaqInput = document.getElementById('unidadesPorPaquete');
            if (undPaqInput && producto.ventaPor?.paq) undPaqInput.value = producto.unidadesPorPaquete || 1;
            const undCjInput = document.getElementById('unidadesPorCaja');
            if (undCjInput && producto.ventaPor?.cj) undCjInput.value = producto.unidadesPorCaja || 1;

             const preciosExistentes = producto.precios || { und: producto.precioPorUnidad || 0 }; // Usar objeto precios o fallback
             const precioUndInput = document.getElementById('precioUnd');
             if (precioUndInput) precioUndInput.value = preciosExistentes.und || 0;
             const precioPaqInput = document.getElementById('precioPaq');
             if (precioPaqInput) precioPaqInput.value = preciosExistentes.paq || 0;
             const precioCjInput = document.getElementById('precioCj');
             if (precioCjInput) precioCjInput.value = preciosExistentes.cj || 0;


            // Poblar sección Maneja Vacío
             if (producto.manejaVacios) {
                 manejaVaciosCheck.checked = true;
                 tipoVacioContainer.classList.remove('hidden');
                 tipoVacioSelect.required = true;
                 tipoVacioSelect.value = producto.tipoVacio || ''; // Seleccionar tipo guardado
             } else {
                  manejaVaciosCheck.checked = false;
                  tipoVacioContainer.classList.add('hidden');
                  tipoVacioSelect.required = false;
             }

        }, 300); // Aumentar ligero delay si los dropdowns tardan

        // Listeners formulario y botones
        document.getElementById('editProductoForm').addEventListener('submit', (e) => handleUpdateProducto(e, productId));
        document.getElementById('backToModifyDeleteBtn').addEventListener('click', showModifyDeleteView);
    };


    /**
     * Maneja el guardado del producto editado por el admin y propaga los cambios.
     */
    async function handleUpdateProducto(e, productId) {
        e.preventDefault();
        if (_userRole !== 'admin') return; // Seguridad

        const updatedData = getProductoDataFromForm(true); // Obtener datos (true = es edición)
        const productoOriginal = _inventarioCache.find(p => p.id === productId);
        if (!productoOriginal) {
             _showModal('Error', 'No se encontró el producto original para comparar.');
             return;
        }

        // --- Validaciones (similares a agregar) ---
        if (!updatedData.rubro || !updatedData.segmento || !updatedData.marca || !updatedData.presentacion) {
            _showModal('Error', 'Debes completar Rubro, Segmento, Marca y Presentación.');
            return;
        }
        if (!updatedData.ventaPor.und && !updatedData.ventaPor.paq && !updatedData.ventaPor.cj) {
            _showModal('Error', 'Debes seleccionar al menos una forma de venta.');
            return;
        }
         if (updatedData.manejaVacios && !updatedData.tipoVacio) {
             _showModal('Error', 'Si el producto maneja vacío, debes seleccionar el tipo.');
             document.getElementById('tipoVacioSelect')?.focus();
             return;
         }
         let precioValidoIngresado = false;
         if (updatedData.ventaPor.und && updatedData.precios.und > 0) precioValidoIngresado = true;
         if (updatedData.ventaPor.paq && updatedData.precios.paq > 0) precioValidoIngresado = true;
         if (updatedData.ventaPor.cj && updatedData.precios.cj > 0) precioValidoIngresado = true;
         if (!precioValidoIngresado) {
              _showModal('Error', 'Debes ingresar al menos un precio válido (> 0) para la forma de venta.');
              document.querySelector('#preciosContainer input[required]')?.focus();
              return;
         }

        // Mantener la cantidad de unidades original (ya está en updatedData por getProductoDataFromForm(true))
        // updatedData.cantidadUnidades = productoOriginal?.cantidadUnidades || 0; // No es necesario si getProductoDataFromForm lo hace bien

        _showModal('Progreso', 'Guardando cambios para admin...');

        try {
            // Actualizar el producto para el admin
            await _setDoc(_doc(_db, `artifacts/${_appId}/users/${_userId}/inventario`, productId), updatedData);

            // Propagar la actualización a otros usuarios
            if (window.adminModule && typeof window.adminModule.propagateProductChange === 'function') {
                 _showModal('Progreso', 'Propagando cambios a otros usuarios...');
                // Pasar el ID y los datos actualizados (que incluyen la cantidad original preservada)
                await window.adminModule.propagateProductChange(productId, updatedData);
                _showModal('Éxito', 'Producto modificado y propagado exitosamente.');
            } else {
                 _showModal('Éxito', 'Producto modificado localmente (no se pudo propagar).');
            }

            showModifyDeleteView(); // Volver a la lista
        } catch (err) {
            console.error("Error al modificar producto:", err);
            _showModal('Error', `Hubo un error al modificar el producto: ${err.message}`);
        }
    }


    /**
     * Elimina un producto para el admin y propaga la eliminación.
     */
    function deleteProducto(productId) {
        if (_userRole !== 'admin') {
             _showModal('Acceso Denegado', 'Solo los administradores pueden eliminar productos.');
             return;
        }
        const producto = _inventarioCache.find(p => p.id === productId);
        if (!producto) {
            _showModal('Error', 'Producto no encontrado.');
            return;
        }

        _showModal('Confirmar Eliminación', `¿Estás seguro de que deseas eliminar "${producto.presentacion}"? Esta acción se propagará a todos los usuarios y NO SE PUEDE DESHACER.`, async () => {
             _showModal('Progreso', `Eliminando "${producto.presentacion}" para admin...`);
            try {
                // Eliminar para el admin
                await _deleteDoc(_doc(_db, `artifacts/${_appId}/users/${_userId}/inventario`, productId));

                // Propagar eliminación
                if (window.adminModule && typeof window.adminModule.propagateProductChange === 'function') {
                     _showModal('Progreso', 'Propagando eliminación a otros usuarios...');
                     // Pasar ID y null para indicar eliminación
                    await window.adminModule.propagateProductChange(productId, null);
                    _showModal('Éxito', 'Producto eliminado y propagado correctamente.');
                } else {
                     _showModal('Éxito', 'Producto eliminado localmente (no se pudo propagar).');
                }
                // La lista se actualizará automáticamente por el listener onSnapshot en showModifyDeleteView

            } catch (e) {
                 console.error("Error al eliminar producto:", e);
                 _showModal('Error', `Hubo un error al eliminar el producto: ${e.message}`);
            }
        }, 'Sí, Eliminar');
    };

    /**
     * Maneja la eliminación de TODOS los productos del inventario del admin y propaga.
     */
    async function handleDeleteAllProductos() {
        if (_userRole !== 'admin') return;

        _showModal('Confirmación Extrema', `<p class="text-red-600 font-bold">¡ADVERTENCIA MAYOR!</p><p>¿Estás SEGURO de que quieres eliminar TODOS los productos del inventario? Esta acción se propagará a todos los usuarios y es irreversible.</p>`, async () => {
            _showModal('Progreso', 'Eliminando productos para admin...');
            try {
                const collectionRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`);
                const snapshot = await _getDocs(collectionRef);
                if (snapshot.empty) {
                    _showModal('Aviso', 'No hay productos para eliminar.');
                    return;
                }

                const productIdsToDelete = snapshot.docs.map(doc => doc.id);

                // Eliminar para el admin
                const batchAdmin = _writeBatch(_db);
                snapshot.docs.forEach(doc => batchAdmin.delete(doc.ref));
                await batchAdmin.commit();

                // Propagar eliminación
                if (window.adminModule && typeof window.adminModule.propagateProductChange === 'function') {
                     _showModal('Progreso', `Propagando eliminación de ${productIdsToDelete.length} productos...`);
                     let propagationErrors = 0;
                     // Propagar la eliminación de cada producto individualmente
                     for (const productId of productIdsToDelete) {
                          try {
                              await window.adminModule.propagateProductChange(productId, null);
                          } catch (propError) {
                              console.error(`Error propagating deletion for product ${productId}:`, propError);
                              propagationErrors++;
                          }
                     }
                     if (propagationErrors > 0) {
                          _showModal('Advertencia', `Todos los productos eliminados localmente, pero ${propagationErrors} eliminaciones no pudieron propagarse.`);
                     } else {
                          _showModal('Éxito', 'Todos los productos han sido eliminados y la eliminación propagada.');
                     }
                } else {
                     _showModal('Éxito', 'Todos los productos eliminados localmente (no se pudo propagar).');
                }


            } catch (error) {
                console.error("Error al eliminar todos los productos:", error);
                _showModal('Error', `Hubo un error al eliminar los productos: ${error.message}`);
            }
        }, 'Sí, Eliminar Todos');
    }

    /**
     * Maneja la eliminación de TODOS los datos maestros (Rubros, Segmentos, Marcas) del admin y propaga.
     */
    async function handleDeleteAllDatosMaestros() {
         if (_userRole !== 'admin') return;

         _showModal('Confirmar Borrado Datos Maestros', `<p class="text-red-600 font-bold">¡ADVERTENCIA MAYOR!</p><p>¿Estás SEGURO de que quieres eliminar TODOS los Rubros, Segmentos y Marcas? Verifica que ningún producto los use. Esta acción se propagará y es irreversible.</p>`, async () => {
            _showModal('Progreso', 'Eliminando datos maestros para admin...');
            try {
                const collectionsToDelete = ['rubros', 'segmentos', 'marcas'];
                const deletedItemsMap = { rubros: [], segmentos: [], marcas: [] }; // Para propagación {id, name}

                // Verificar uso ANTES de eliminar
                 _showModal('Progreso', 'Verificando uso de datos maestros...');
                 let itemsInUse = [];
                 const inventarioSnapshot = await _getDocs(_collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`));
                 const allProducts = inventarioSnapshot.docs.map(d => d.data());

                 for (const colName of collectionsToDelete) {
                     const field = colName === 'rubros' ? 'rubro' : (colName === 'segmentos' ? 'segmento' : 'marca');
                     const catSnapshot = await _getDocs(_collection(_db, `artifacts/${_appId}/users/${_userId}/${colName}`));
                     catSnapshot.docs.forEach(doc => {
                         const itemName = doc.data().name;
                         if (allProducts.some(p => p[field] === itemName)) {
                             itemsInUse.push(`'${itemName}' (${colName.slice(0,-1)})`);
                         } else {
                              deletedItemsMap[colName].push({ id: doc.id, name: itemName }); // Guardar para eliminar/propagar
                         }
                     });
                 }

                 if (itemsInUse.length > 0) {
                      _showModal('Error', `No se pueden eliminar todos los datos maestros. Los siguientes están en uso: ${itemsInUse.join(', ')}. Reasigna o elimina los productos asociados primero.`);
                      return;
                 }

                // Proceder con la eliminación
                _showModal('Progreso', 'Eliminando datos maestros no usados para admin...');
                const batchAdmin = _writeBatch(_db);
                let adminDeleteCount = 0;
                for (const colName in deletedItemsMap) {
                    deletedItemsMap[colName].forEach(item => {
                         const docRef = _doc(_db, `artifacts/${_appId}/users/${_userId}/${colName}`, item.id);
                         batchAdmin.delete(docRef);
                         adminDeleteCount++;
                    });
                }
                await batchAdmin.commit();
                 console.log(`${adminDeleteCount} datos maestros eliminados para admin.`);

                 // Propagar eliminaciones
                 if (window.adminModule && typeof window.adminModule.propagateCategoryChange === 'function') {
                      _showModal('Progreso', 'Propagando eliminaciones de categorías...');
                      let propagatedCount = 0;
                      let propagationErrors = 0;
                      for (const colName in deletedItemsMap) {
                          for (const item of deletedItemsMap[colName]) {
                               try {
                                   await window.adminModule.propagateCategoryChange(colName, item.id, null);
                                   propagatedCount++;
                               } catch (propError) {
                                   console.error(`Error propagating deletion for ${colName}/${item.id} (${item.name}):`, propError);
                                   propagationErrors++;
                               }
                          }
                      }
                      if (propagationErrors > 0) {
                           _showModal('Advertencia', `Datos maestros eliminados localmente, pero ${propagationErrors} eliminaciones no pudieron propagarse.`);
                      } else {
                           _showModal('Éxito', `Todos los datos maestros no usados (${propagatedCount} items) han sido eliminados y la eliminación propagada.`);
                      }
                 } else {
                      _showModal('Éxito', 'Todos los datos maestros no usados eliminados localmente (no se pudo propagar).');
                 }
                  invalidateSegmentOrderCache(); // Limpiar caché de orden

            } catch (error) {
                console.error("Error al eliminar todos los datos maestros:", error);
                _showModal('Error', `Hubo un error al eliminar los datos maestros: ${error.message}`);
            }
        }, 'Sí, Eliminar No Usados');
    }

    // --- Exponer funciones públicas ---
    window.inventarioModule = {
        editProducto,
        deleteProducto,
        handleDeleteDataItem,
        showAddCategoryModal, // Exponer el modal genérico
        getSegmentoOrderMap,
        invalidateSegmentOrderCache
    };

})();
