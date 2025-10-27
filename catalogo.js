(function() {
    // MODIFICADO: Añadidas _doc, _setDoc, _getDoc
    let _db, _userId, _appId, _mainContent, _showMainMenu, _collection, _getDocs, _floatingControls, _doc, _setDoc, _getDoc;
    let _catalogoTasaCOP = 0;
    let _catalogoMonedaActual = 'USD';
    let _currentRubros = [];
    let _currentBgImage = '';
    // let _segmentoOrderCacheCatalogo = null; // ELIMINADO: Ya no se usa localmente
    let _inventarioCache = [];
    let _marcasCache = [];
    let _productosAgrupadosCache = {};

    // NUEVO: Cachés para la función global de ordenamiento
    let _sortPreferenceCache = null;
    let _rubroOrderMapCache = null;
    let _segmentoOrderMapCache = null;
    const SORT_CONFIG_PATH = 'config/productSortOrder'; // Ruta relativa al usuario

    // MODIFICADO: Añadidas _doc, _setDoc, _getDoc a las dependencias
    window.initCatalogo = function(dependencies) {
        _db = dependencies.db;
        _userId = dependencies.userId;
        _appId = dependencies.appId;
        _mainContent = dependencies.mainContent;
        _showMainMenu = dependencies.showMainMenu;
        _collection = dependencies.collection;
        _getDocs = dependencies.getDocs;
        _floatingControls = dependencies.floatingControls;
        _doc = dependencies.doc; // NUEVO
        _setDoc = dependencies.setDoc; // NUEVO
        _getDoc = dependencies.getDoc; // NUEVO
        if (!_floatingControls) {
            console.warn("Catalogo Init Warning: floatingControls element was not provided or found.");
        }
         // Validar dependencias Firestore necesarias
         if (!_doc || !_setDoc || !_getDoc) {
            console.error("Catalogo Init Error: Missing Firestore dependencies (_doc, _setDoc, _getDoc).");
         }
    };

    // ELIMINADO: getSegmentoOrderMapCatalogo ya no es necesaria aquí

    // MODIFICADO: Añadido botón para configurar orden
    window.showCatalogoSubMenu = function() {
        if (_floatingControls) {
            _floatingControls.classList.add('hidden');
        }
        document.body.classList.remove('catalogo-active');
        document.body.style.removeProperty('--catalogo-bg-image');
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto max-w-lg">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl text-center">
                        <h1 class="text-3xl font-bold text-gray-800 mb-6">Catálogo de Productos</h1>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <button data-rubros='["CERVECERIA Y VINOS"]' data-bg="images/cervezayvinos.png" class="catalogo-btn w-full px-6 py-3 bg-yellow-500 text-white font-semibold rounded-lg shadow-md hover:bg-yellow-600 transition duration-200">Cerveza y Vinos</button>
                            <button data-rubros='["MALTIN & PEPSI"]' data-bg="images/maltinypepsi.png" class="catalogo-btn w-full px-6 py-3 bg-blue-700 text-white font-semibold rounded-lg shadow-md hover:bg-blue-800 transition duration-200">Maltin y Pepsicola</button>
                            <button data-rubros='["ALIMENTOS"]' data-bg="images/alimentospolar.png" class="catalogo-btn w-full px-6 py-3 bg-red-500 text-white font-semibold rounded-lg shadow-md hover:bg-red-600 transition duration-200">Alimentos Polar</button>
                            <button data-rubros='["P&G"]' data-bg="images/p&g.png" class="catalogo-btn w-full px-6 py-3 bg-sky-500 text-white font-semibold rounded-lg shadow-md hover:bg-sky-600 transition duration-200">Procter & Gamble</button>
                            <button data-rubros='[]' data-bg="" class="catalogo-btn md:col-span-2 w-full px-6 py-3 bg-gray-700 text-white font-semibold rounded-lg shadow-md hover:bg-gray-800 transition duration-200">Unificado (Todos)</button>
                        </div>
                        <!-- NUEVO BOTÓN -->
                        <button id="configSortBtn" class="mt-4 w-full px-6 py-3 bg-purple-500 text-white font-semibold rounded-lg shadow-md hover:bg-purple-600 transition duration-200">Configurar Orden Productos</button>
                        <button id="backToMenuBtn" class="mt-6 w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500 transition duration-200">Volver al Menú</button>
                    </div>
                </div>
            </div>
        `;
        document.querySelectorAll('.catalogo-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                 try {
                     _currentRubros = JSON.parse(e.target.dataset.rubros || '[]');
                 } catch (parseError) {
                      console.error("Error parsing rubros data:", parseError, e.target.dataset.rubros);
                      _currentRubros = [];
                 }
                const title = e.target.textContent.trim();
                const bgImage = e.target.dataset.bg || '';
                showCatalogoView(title, bgImage);
            });
        });
        // NUEVO: Listener para el botón de configurar orden
        document.getElementById('configSortBtn').addEventListener('click', showProductSortConfigView);
        document.getElementById('backToMenuBtn').addEventListener('click', _showMainMenu);
    }

    // NUEVO: Vista para configurar el orden de los productos
    async function showProductSortConfigView() {
        if (_floatingControls) _floatingControls.classList.add('hidden');
        document.body.classList.remove('catalogo-active'); // Asegurarse que no haya fondo especial

        // Criterios disponibles y sus nombres legibles
        const availableCriteria = {
            rubro: 'Rubro',
            segmento: 'Segmento',
            marca: 'Marca',
            presentacion: 'Presentación'
        };

        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto max-w-lg">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl">
                        <h2 class="text-2xl font-bold text-gray-800 mb-4 text-center">Configurar Orden de Productos</h2>
                        <p class="text-center text-gray-600 mb-6">Arrastra y suelta los criterios para definir la prioridad de ordenamiento en las listas de productos (Catálogo, Inventario, Ventas).</p>
                        <ul id="sort-criteria-list" class="space-y-2 border rounded-lg p-4 mb-6 bg-gray-50">
                            <p class="text-gray-500 text-center">Cargando orden actual...</p>
                        </ul>
                        <div class="space-y-4">
                            <button id="saveSortBtn" class="w-full px-6 py-3 bg-green-500 text-white font-semibold rounded-lg shadow-md hover:bg-green-600">Guardar Orden</button>
                            <button id="backToCatalogoMenuBtn" class="w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver al Catálogo</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('saveSortBtn').addEventListener('click', handleSaveSortPreference);
        document.getElementById('backToCatalogoMenuBtn').addEventListener('click', showCatalogoSubMenu);

        // Cargar orden actual o default
        const sortListContainer = document.getElementById('sort-criteria-list');
        try {
            const docRef = _doc(_db, `artifacts/${_appId}/users/${_userId}/${SORT_CONFIG_PATH}`);
            const docSnap = await _getDoc(docRef);
            let currentOrder = ['segmento', 'marca', 'presentacion']; // Default order
            if (docSnap.exists() && docSnap.data().order) {
                currentOrder = docSnap.data().order;
                // Validar que el orden guardado contenga todos los criterios esperados
                const savedCriteriaSet = new Set(currentOrder);
                const availableCriteriaKeys = Object.keys(availableCriteria);
                if (currentOrder.length !== availableCriteriaKeys.length || !availableCriteriaKeys.every(key => savedCriteriaSet.has(key))) {
                     console.warn("Orden guardado inválido o incompleto, usando default.");
                     currentOrder = ['segmento', 'marca', 'presentacion', 'rubro']; // Default completo
                     // Opcional: Podrías intentar fusionar el guardado con los faltantes
                }
            } else {
                 console.log("No sort preference found, using default.");
                 // Asegurar que el default incluya todos los criterios si es la primera vez
                 currentOrder = ['segmento', 'marca', 'presentacion', 'rubro'];
            }

            sortListContainer.innerHTML = ''; // Limpiar 'Cargando...'
            currentOrder.forEach(key => {
                 if (availableCriteria[key]) { // Asegurarse que el criterio exista
                    const li = document.createElement('li');
                    li.dataset.key = key;
                    li.className = 'p-3 bg-gray-100 rounded shadow-sm cursor-grab active:cursor-grabbing hover:bg-gray-200';
                    li.textContent = availableCriteria[key];
                    li.draggable = true;
                    sortListContainer.appendChild(li);
                 }
            });
            // Añadir criterios faltantes si el orden guardado era incompleto (aunque ya validamos antes)
            Object.keys(availableCriteria).forEach(key => {
                 if (!currentOrder.includes(key)) {
                      const li = document.createElement('li');
                      li.dataset.key = key;
                      li.className = 'p-3 bg-gray-100 rounded shadow-sm cursor-grab active:cursor-grabbing hover:bg-gray-200';
                      li.textContent = availableCriteria[key];
                      li.draggable = true;
                      sortListContainer.appendChild(li);
                 }
            });

            addDragAndDropHandlersSort(sortListContainer); // Añadir lógica de drag & drop
        } catch (error) {
             console.error("Error cargando/renderizando orden de criterios:", error);
             sortListContainer.innerHTML = `<p class="text-red-500 text-center">Error al cargar la configuración.</p>`;
        }
    }

    // NUEVO: Lógica para guardar la preferencia de ordenamiento
    async function handleSaveSortPreference() {
        const listItems = document.querySelectorAll('#sort-criteria-list li');
        if (listItems.length === 0) {
            _showModal('Error', 'No se pudieron leer los criterios de ordenamiento.');
            return;
        }
        const newOrder = Array.from(listItems).map(li => li.dataset.key);

        _showModal('Progreso', 'Guardando preferencia de orden...');
        try {
            const docRef = _doc(_db, `artifacts/${_appId}/users/${_userId}/${SORT_CONFIG_PATH}`);
            await _setDoc(docRef, { order: newOrder });
            _sortPreferenceCache = null; // Invalidar caché local para que se recargue
             // Invalidar también las cachés de mapas de orden, por si acaso
             _rubroOrderMapCache = null;
             _segmentoOrderMapCache = null;
            _showModal('Éxito', 'Preferencia de ordenamiento guardada.');
            showCatalogoSubMenu(); // Volver al menú del catálogo
        } catch (error) {
             console.error("Error guardando preferencia de orden:", error);
             _showModal('Error', `No se pudo guardar la preferencia: ${error.message}`);
        }
    }

    // NUEVO: Lógica Drag & Drop adaptada para los criterios
    function addDragAndDropHandlersSort(container) {
        // (Esta función es similar a la de inventario.js, adaptada si es necesario)
        let draggedItem = null;
        let placeholder = null;
        const createPlaceholder = () => {
             if (!placeholder) {
                 placeholder = document.createElement('li');
                 placeholder.style.height = '40px';
                 placeholder.style.background = '#e0e7ff';
                 placeholder.style.border = '2px dashed #6366f1';
                 placeholder.style.borderRadius = '0.375rem';
                 placeholder.style.margin = '0.5rem 0';
                 placeholder.style.listStyleType = 'none';
             }
        };
        createPlaceholder();
        container.addEventListener('dragstart', e => {
             if (e.target.tagName === 'LI') {
                 draggedItem = e.target;
                 setTimeout(() => { if(draggedItem) draggedItem.style.opacity = '0.5'; }, 0);
             }
        });
        container.addEventListener('dragend', e => {
            if(draggedItem) draggedItem.style.opacity = '1';
            draggedItem = null;
            if (placeholder && placeholder.parentNode) placeholder.parentNode.removeChild(placeholder);
        });
        container.addEventListener('dragover', e => {
            e.preventDefault();
            const afterElement = getDragAfterElementSort(container, e.clientY);
            if (draggedItem) {
                 if (!placeholder) createPlaceholder();
                if (afterElement == null) container.appendChild(placeholder);
                else container.insertBefore(placeholder, afterElement);
            }
        });
         container.addEventListener('drop', e => {
              e.preventDefault();
              if (draggedItem && placeholder && placeholder.parentNode) {
                  container.insertBefore(draggedItem, placeholder);
                  draggedItem.style.opacity = '1';
              }
              if (placeholder && placeholder.parentNode) placeholder.parentNode.removeChild(placeholder);
              draggedItem = null;
        });
        container.addEventListener('dragleave', e => {
              if (!container.contains(e.relatedTarget) && placeholder && placeholder.parentNode) {
                  placeholder.parentNode.removeChild(placeholder);
              }
        });
        function getDragAfterElementSort(container, y) {
             const draggableElements = [...container.querySelectorAll('li:not([style*="height: 40px"])')].filter(el => el !== draggedItem);
             return draggableElements.reduce((closest, child) => {
                 const box = child.getBoundingClientRect();
                 const offset = y - box.top - box.height / 2;
                 if (offset < 0 && offset > closest.offset) return { offset: offset, element: child };
                 else return closest;
             }, { offset: Number.NEGATIVE_INFINITY }).element;
        }
    }

    // NUEVO: Función Global para obtener la función de comparación de productos
    window.getGlobalProductSortFunction = async () => {
        // 1. Cargar Preferencia de Ordenamiento (con caché)
        if (!_sortPreferenceCache) {
            try {
                const docRef = _doc(_db, `artifacts/${_appId}/users/${_userId}/${SORT_CONFIG_PATH}`);
                const docSnap = await _getDoc(docRef);
                if (docSnap.exists() && docSnap.data().order) {
                    _sortPreferenceCache = docSnap.data().order;
                     // Validar que tenga todos los criterios esperados
                     const expectedKeys = new Set(['rubro', 'segmento', 'marca', 'presentacion']);
                     if (_sortPreferenceCache.length !== expectedKeys.size || !_sortPreferenceCache.every(key => expectedKeys.has(key))) {
                         console.warn("Preferencia de ordenamiento inválida/incompleta, usando default completo.");
                         _sortPreferenceCache = ['segmento', 'marca', 'presentacion', 'rubro'];
                     }
                } else {
                    _sortPreferenceCache = ['segmento', 'marca', 'presentacion', 'rubro']; // Default completo
                }
            } catch (error) {
                console.error("Error cargando preferencia de ordenamiento, usando default:", error);
                _sortPreferenceCache = ['segmento', 'marca', 'presentacion', 'rubro']; // Default en caso de error
            }
        }

        // 2. Cargar Mapas de Orden de Rubros y Segmentos (con caché)
        if (!_rubroOrderMapCache) {
            _rubroOrderMapCache = {};
            try {
                const rubrosRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/rubros`);
                const snapshot = await _getDocs(rubrosRef);
                snapshot.docs.forEach(doc => {
                    const data = doc.data();
                    _rubroOrderMapCache[data.name] = (data.orden !== undefined && data.orden !== null) ? data.orden : 9999;
                });
            } catch (e) { console.warn("No se pudo obtener el orden de los rubros para la función global.", e); }
        }
        if (!_segmentoOrderMapCache) {
            _segmentoOrderMapCache = {};
            try {
                const segmentosRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/segmentos`);
                const snapshot = await _getDocs(segmentosRef);
                snapshot.docs.forEach(doc => {
                    const data = doc.data();
                    _segmentoOrderMapCache[data.name] = (data.orden !== undefined && data.orden !== null) ? data.orden : 9999;
                });
            } catch (e) { console.warn("No se pudo obtener el orden de los segmentos para la función global.", e); }
        }

        // 3. Devolver la función de comparación
        return (a, b) => {
            for (const key of _sortPreferenceCache) {
                let valA, valB;
                let comparisonResult = 0;

                switch (key) {
                    case 'rubro':
                        valA = _rubroOrderMapCache[a.rubro] ?? 9999;
                        valB = _rubroOrderMapCache[b.rubro] ?? 9999;
                        comparisonResult = valA - valB;
                        if (comparisonResult === 0) { // Si tienen el mismo orden, ordenar alfabéticamente
                           comparisonResult = (a.rubro || '').localeCompare(b.rubro || '');
                        }
                        break;
                    case 'segmento':
                        valA = _segmentoOrderMapCache[a.segmento] ?? 9999;
                        valB = _segmentoOrderMapCache[b.segmento] ?? 9999;
                        comparisonResult = valA - valB;
                         if (comparisonResult === 0) {
                           comparisonResult = (a.segmento || '').localeCompare(b.segmento || '');
                        }
                        break;
                    case 'marca':
                        valA = a.marca || '';
                        valB = b.marca || '';
                        comparisonResult = valA.localeCompare(valB);
                        break;
                    case 'presentacion':
                        valA = a.presentacion || '';
                        valB = b.presentacion || '';
                        comparisonResult = valA.localeCompare(valB);
                        break;
                }

                if (comparisonResult !== 0) {
                    return comparisonResult;
                }
            }
            return 0; // Si todos los criterios son iguales
        };
    };

    // NUEVO: Función para invalidar las cachés globales
    function invalidateGlobalSortCache() {
        _sortPreferenceCache = null;
        _rubroOrderMapCache = null;
        _segmentoOrderMapCache = null;
        console.log("Cachés de ordenamiento global invalidadas.");
    }


    function showCatalogoView(title, bgImage) {
        _currentBgImage = bgImage;
        if (bgImage) {
            document.body.style.setProperty('--catalogo-bg-image', `url('${bgImage}')`);
             document.body.classList.add('catalogo-active');
        } else {
             document.body.classList.remove('catalogo-active');
             document.body.style.removeProperty('--catalogo-bg-image');
        }
        _catalogoMonedaActual = 'USD';

        if (_floatingControls) {
            _floatingControls.classList.add('hidden');
        }
         if (!_mainContent) {
             console.error("CRITICAL: Main content area not available in showCatalogoView");
             alert("Error crítico: No se encuentra el área de contenido principal.");
             return;
         }

        _mainContent.innerHTML = `
            <div class="p-4 pt-6 md:pt-8">
                <div class="container mx-auto">
                    <div id="catalogo-container-wrapper" class="bg-white/95 backdrop-blur-sm p-4 sm:p-6 md:p-8 rounded-lg shadow-xl max-h-[calc(100vh-6rem)] overflow-y-auto">
                        <div id="catalogo-para-imagen">
                            <h2 class="text-3xl md:text-4xl font-bold text-black mb-2 text-center">${title}</h2>
                            <p class="text-center text-gray-800 mb-1 text-sm md:text-base">DISTRIBUIDORA CASTILLO YAÑEZ C.A</p>
                            <p class="text-center text-gray-700 mb-4 text-xs md:text-base italic">(Todos los precios incluyen IVA)</p>
                            <div class="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4">
                                <div id="tasa-input-container" class="flex-grow w-full sm:w-auto">
                                    <label for="catalogoTasaCopInput" class="block text-sm font-medium mb-1">Tasa (USD a COP):</label>
                                    <input type="number" id="catalogoTasaCopInput" placeholder="Ej: 4000" class="w-full px-3 py-1.5 border rounded-lg text-sm">
                                </div>
                            </div>
                            <div id="catalogo-content" class="space-y-6"><p class="text-center text-gray-500 p-4">Cargando...</p></div>
                        </div>
                         <div id="catalogo-buttons-container" class="mt-6 text-center space-y-3 sm:space-y-4">
                             <button id="generateCatalogoImageBtn" class="w-full px-6 py-2.5 bg-green-500 text-white font-semibold rounded-lg shadow-md hover:bg-green-600 transition duration-200">Generar Imagen</button>
                             <button id="backToCatalogoMenuBtn" class="w-full px-6 py-2.5 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500 transition duration-200">Volver</button>
                         </div>
                    </div>
                </div>
            </div>
        `;

        const tasaInput = document.getElementById('catalogoTasaCopInput');
        if (tasaInput) {
            const savedTasa = localStorage.getItem('tasaCOP');
            if (savedTasa) {
                _catalogoTasaCOP = parseFloat(savedTasa);
                tasaInput.value = _catalogoTasaCOP;
            }
            tasaInput.addEventListener('input', (e) => {
                _catalogoTasaCOP = parseFloat(e.target.value) || 0;
                localStorage.setItem('tasaCOP', _catalogoTasaCOP);
                if (_catalogoMonedaActual === 'COP') {
                    renderCatalogo();
                }
            });
        }

        document.getElementById('backToCatalogoMenuBtn').addEventListener('click', showCatalogoSubMenu);
        document.getElementById('generateCatalogoImageBtn').addEventListener('click', handleGenerateCatalogoImage);
        loadAndRenderCatalogo();
    }

    window.toggleCatalogoMoneda = function() {
        if (_catalogoTasaCOP <= 0) {
             // MODIFICADO: Usar window.showModal global
             window.showModal('Aviso', 'Ingresa una tasa de cambio (USD a COP) válida para ver precios en COP.');
            return;
        }
        _catalogoMonedaActual = _catalogoMonedaActual === 'USD' ? 'COP' : 'USD';
        renderCatalogo();
    };

    async function loadAndRenderCatalogo() {
        const container = document.getElementById('catalogo-content');
        if (!container) return;
        container.innerHTML = `<p class="text-center text-gray-500 p-4">Cargando inventario...</p>`;
        try {
             // No es necesario cargar específicamente para el catálogo si ya existe una caché global,
             // pero la cargamos aquí por si acaso o si es la primera vez.
             // Podríamos optimizar esto para usar una caché más persistente si _inventarioCache ya está poblada.
             const inventarioRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`);
             const snapshot = await _getDocs(inventarioRef);
             _inventarioCache = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
            await renderCatalogo();
        } catch (error) {
            console.error("Error al cargar el inventario para el catálogo:", error);
            container.innerHTML = `<p class="text-center text-red-500 p-4">Error al cargar el inventario.</p>`;
        }
    }

    // MODIFICADO: Usa la función de ordenamiento global
    async function renderCatalogo() {
        const container = document.getElementById('catalogo-content');
        if (!container) { console.error("Catalogo content container not found."); return; }
        container.innerHTML = `<p class="text-center text-gray-500 p-4">Ordenando productos...</p>`;
        try {
            let productos = [..._inventarioCache];
            if (_currentRubros?.length > 0) {
                productos = productos.filter(p => p.rubro && _currentRubros.includes(p.rubro));
            }

            // --- NUEVO: Usar función global para ordenar ---
            const sortFunction = await window.getGlobalProductSortFunction();
            productos.sort(sortFunction);
            // --- FIN NUEVO ---

            if (productos.length === 0) {
                container.innerHTML = `<p class="text-center text-gray-500 p-4">No hay productos ${ _currentRubros.length > 0 ? 'en esta categoría' : 'definidos'}.</p>`;
                _marcasCache = [];
                _productosAgrupadosCache = {};
                return;
            }

            // Agrupar por Marca (el orden de las marcas dependerá del orden de los productos ya ordenados)
            const productosAgrupados = productos.reduce((acc, p) => {
                const marca = p.marca || 'Sin Marca';
                if (!acc[marca]) acc[marca] = [];
                acc[marca].push(p);
                return acc;
            }, {});
            // Obtener el orden de las marcas basado en el primer producto de cada marca en la lista ya ordenada
            const marcasOrdenadas = [...new Set(productos.map(p => p.marca || 'Sin Marca'))];


            _marcasCache = marcasOrdenadas; // Guardar marcas en orden para la generación de imagen
            _productosAgrupadosCache = productosAgrupados; // Guardar productos agrupados

            let html = '<div class="space-y-4">';
            const monedaLabel = _catalogoMonedaActual === 'COP' ? 'PRECIO (COP)' : 'PRECIO (USD)';

            marcasOrdenadas.forEach(marca => {
                html += `<table class="min-w-full bg-transparent text-sm md:text-lg print:text-sm">
                            <thead class="text-black">
                                <tr><th colspan="2" class="py-2 px-2 md:px-4 bg-gray-100 font-bold text-left text-base md:text-xl rounded-t-lg">${marca}</th></tr>
                                <tr>
                                    <th class="py-1 md:py-2 px-2 md:px-4 text-left font-semibold text-xs md:text-base border-b border-gray-300">PRESENTACIÓN (Segmento)</th>
                                    <th class="py-1 md:py-2 px-2 md:px-4 text-right font-semibold text-xs md:text-base border-b border-gray-300 price-toggle" onclick="window.toggleCatalogoMoneda()" title="Clic para cambiar moneda">${monedaLabel} <span class="text-gray-500 text-xs">⇆</span></th>
                                </tr>
                            </thead>
                            <tbody>`;
                const productosDeMarca = productosAgrupados[marca] || []; // Obtener productos de la marca (ya ordenados por Segmento/Presentación)
                productosDeMarca.forEach(p => {
                    const ventaPor = p.ventaPor || { und: true };
                    const precios = p.precios || { und: p.precioPorUnidad || 0 };
                    let precioBaseUSD = 0;
                    let displayPresentacion = `${p.presentacion || 'N/A'}`;
                    let unitInfo = '';
                    // Determinar precio y unidad a mostrar (prioridad Cj > Paq > Und)
                    if (ventaPor.cj && precios.cj > 0) { precioBaseUSD = precios.cj; unitInfo = `(Cj/${p.unidadesPorCaja || 1} und)`; }
                    else if (ventaPor.paq && precios.paq > 0) { precioBaseUSD = precios.paq; unitInfo = `(Paq/${p.unidadesPorPaquete || 1} und)`; }
                    else { precioBaseUSD = precios.und || 0; unitInfo = `(Und)`; }

                    let precioMostrado;
                    if (_catalogoMonedaActual === 'COP' && _catalogoTasaCOP > 0) {
                         // Redondeo hacia arriba al múltiplo de 100 más cercano
                         precioMostrado = `COP ${(Math.ceil((precioBaseUSD * _catalogoTasaCOP) / 100) * 100).toLocaleString('es-CO')}`;
                    } else {
                        precioMostrado = `$${precioBaseUSD.toFixed(2)}`;
                    }
                    const segmentoDisplay = p.segmento ? `<span class="text-xs text-gray-500 ml-1">(${p.segmento})</span>` : '';
                    html += `
                        <tr class="border-b border-gray-200 last:border-b-0">
                            <td class="py-1.5 md:py-2 px-2 md:px-4 text-gray-900 align-top">
                                ${displayPresentacion} ${segmentoDisplay}
                                ${unitInfo ? `<span class="block text-xs text-gray-500">${unitInfo}</span>` : ''}
                            </td>
                            <td class="py-1.5 md:py-2 px-2 md:px-4 text-right font-semibold align-top">${precioMostrado}</td>
                        </tr>
                    `;
                });
                html += `</tbody></table>`;
            });
            html += '</div>';
            container.innerHTML = html;
        } catch (error) {
            console.error("Error al renderizar el catálogo:", error);
            container.innerHTML = `<p class="text-center text-red-500 p-4">Error al mostrar el catálogo.</p>`;
        }
    }

    async function handleGenerateCatalogoImage() {
        const MAX_BRANDS_PER_PAGE = 5; // Ajustable según el contenido
        const shareButton = document.getElementById('generateCatalogoImageBtn');
        const tasaInputContainer = document.getElementById('tasa-input-container');
        const buttonsContainer = document.getElementById('catalogo-buttons-container');

        // Usar _marcasCache que ya está ordenada como se mostró en renderCatalogo
        if (!_marcasCache || _marcasCache.length === 0) {
             window.showModal('Aviso', 'No hay productos en el catálogo actual para generar imagen.');
             return;
        }

        // Paginación basada en las marcas ya ordenadas
        const pagesOfBrands = [];
        for (let i = 0; i < _marcasCache.length; i += MAX_BRANDS_PER_PAGE) {
            pagesOfBrands.push(_marcasCache.slice(i, i + MAX_BRANDS_PER_PAGE));
        }
        const totalPages = pagesOfBrands.length;

        if (shareButton) {
            shareButton.textContent = `Generando ${totalPages} imagen(es)...`;
            shareButton.disabled = true;
        }
        if (tasaInputContainer) tasaInputContainer.classList.add('hidden');
        if (buttonsContainer) buttonsContainer.classList.add('hidden');
        // MODIFICADO: Usar window.showModal global
        window.showModal('Progreso', `Generando ${totalPages} página(s) del catálogo como imagen...`);

        try {
            const imageFiles = await Promise.all(pagesOfBrands.map(async (brandsInPage, index) => {
                const pageNum = index + 1;
                let contentHtml = '<div class="space-y-4">';
                const monedaLabel = _catalogoMonedaActual === 'COP' ? 'PRECIO (COP)' : 'PRECIO (USD)';
                // Iterar sobre las marcas DE ESTA PÁGINA
                brandsInPage.forEach(marca => {
                    contentHtml += `<table class="min-w-full bg-transparent text-lg print:text-sm">
                                <thead class="text-black">
                                    <tr><th colspan="2" class="py-2 px-4 bg-gray-100 font-bold text-left text-xl rounded-t-lg">${marca}</th></tr>
                                    <tr><th class="py-2 px-4 text-left font-semibold text-base border-b border-gray-300">PRESENTACIÓN (Segmento)</th><th class="py-2 px-4 text-right font-semibold text-base border-b border-gray-300">${monedaLabel}</th></tr>
                                </thead><tbody>`;
                    // Usar _productosAgrupadosCache que ya tiene los productos ordenados por marca
                    const productosDeMarca = _productosAgrupadosCache[marca] || [];
                    productosDeMarca.forEach(p => {
                        const ventaPor = p.ventaPor || { und: true };
                        const precios = p.precios || { und: p.precioPorUnidad || 0 };
                        let precioBaseUSD = 0;
                        let displayPresentacion = `${p.presentacion || 'N/A'}`;
                        let unitInfo = '';
                        if (ventaPor.cj && precios.cj > 0) { precioBaseUSD = precios.cj; unitInfo = `(Cj/${p.unidadesPorCaja || 1} und)`; }
                        else if (ventaPor.paq && precios.paq > 0) { precioBaseUSD = precios.paq; unitInfo = `(Paq/${p.unidadesPorPaquete || 1} und)`; }
                        else { precioBaseUSD = precios.und || 0; unitInfo = `(Und)`; }
                        let precioMostrado = _catalogoMonedaActual === 'COP' && _catalogoTasaCOP > 0
                            ? `COP ${(Math.ceil((precioBaseUSD * _catalogoTasaCOP) / 100) * 100).toLocaleString('es-CO')}`
                            : `$${precioBaseUSD.toFixed(2)}`;
                        const segmentoDisplay = p.segmento ? `<span class="text-xs text-gray-500 ml-1">(${p.segmento})</span>` : '';
                        contentHtml += `<tr class="border-b border-gray-200 last:border-b-0"><td class="py-2 px-4 text-gray-900 align-top">${displayPresentacion} ${segmentoDisplay} ${unitInfo ? `<span class="block text-xs text-gray-500">${unitInfo}</span>` : ''}</td><td class="py-2 px-4 text-right font-semibold align-top">${precioMostrado}</td></tr>`;
                    });
                    contentHtml += `</tbody></table>`;
                });
                contentHtml += '</div>';

                const titleElement = document.querySelector('#catalogo-para-imagen h2');
                const title = titleElement ? titleElement.textContent.trim() : 'Catálogo';
                // HTML para generar la imagen de ESTA PÁGINA
                const fullPageHtml = `
                    <div class="bg-white p-8" style="width: 800px; box-shadow: none; border: 1px solid #eee;">
                        <h2 class="text-4xl font-bold text-black mb-2 text-center">${title}</h2>
                        <p class="text-center text-gray-800 mb-1 text-base">DISTRIBUIDORA CASTILLO YAÑEZ C.A</p>
                        <p class="text-center text-gray-700 mb-4 text-base italic">(Todos los precios incluyen IVA)</p>
                        ${contentHtml}
                        <p class="text-center text-gray-600 mt-4 text-sm">Página ${pageNum} de ${totalPages}</p>
                    </div>`;

                const tempDiv = document.createElement('div');
                tempDiv.style.position = 'absolute'; tempDiv.style.left = '-9999px'; tempDiv.style.top = '0';
                tempDiv.innerHTML = fullPageHtml;
                document.body.appendChild(tempDiv);
                const pageWrapper = tempDiv.firstElementChild;

                if (_currentBgImage) {
                    pageWrapper.style.backgroundImage = `linear-gradient(rgba(255, 255, 255, 0.85), rgba(255, 255, 255, 0.85)), url('${_currentBgImage}')`;
                    pageWrapper.style.backgroundSize = 'cover';
                    pageWrapper.style.backgroundPosition = 'center';
                }

                const canvasOptions = { scale: 3, useCORS: true, allowTaint: true, backgroundColor: _currentBgImage ? null : '#FFFFFF' };
                const canvas = await html2canvas(pageWrapper, canvasOptions);
                const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png', 0.9));
                document.body.removeChild(tempDiv);
                const safeTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
                return new File([blob], `catalogo_${safeTitle}_p${pageNum}.png`, { type: "image/png" });
            }));

            // Cerrar modal de progreso si aún está abierto
            const modalContainer = document.getElementById('modalContainer');
             if(modalContainer && !modalContainer.classList.contains('hidden') && modalContainer.querySelector('h3')?.textContent.startsWith('Progreso')) {
                  modalContainer.classList.add('hidden');
             }

            if (navigator.share && imageFiles.length > 0 && navigator.canShare?.({ files: imageFiles })) {
                 try {
                     await navigator.share({
                         files: imageFiles,
                         title: `Catálogo: ${title}`,
                         text: `Catálogo de productos (${title}) - ${totalPages > 1 ? `${totalPages} páginas` : ''}`
                     });
                 } catch (shareError) {
                      console.warn("Sharing failed or was cancelled:", shareError);
                      if (shareError.name !== 'AbortError') {
                          window.showModal('Error al Compartir', 'No se pudieron compartir las imágenes.');
                      }
                 }
            } else if (imageFiles.length > 0) {
                 window.showModal('Imágenes Generadas', 'Imágenes generadas, pero tu navegador no soporta compartir archivos. Puedes intentar descargar la primera imagen.');
                 // Intenta descargar la primera imagen como fallback
                 try {
                     const firstImage = imageFiles[0];
                     const url = URL.createObjectURL(firstImage);
                     const a = document.createElement('a');
                     a.href = url; a.download = firstImage.name;
                     document.body.appendChild(a); a.click(); document.body.removeChild(a);
                     URL.revokeObjectURL(url);
                 } catch (downloadError) {
                     console.error("Failed to download image fallback:", downloadError);
                 }
            } else {
                 window.showModal('Error', 'No se pudieron generar las imágenes del catálogo.');
            }
        } catch (error) {
            console.error("Error grave al generar imagen(es) del catálogo: ", error);
             window.showModal('Error Grave', `No se pudo generar la imagen: ${error.message || error}`);
        } finally {
            // Restaurar estado de botones y UI
            if (shareButton) { shareButton.textContent = 'Generar Imagen'; shareButton.disabled = false; }
            if (tasaInputContainer) tasaInputContainer.classList.remove('hidden');
            if (buttonsContainer) buttonsContainer.classList.remove('hidden');
            // Asegurarse de que el modal de progreso se cierre
             const modalContainer = document.getElementById('modalContainer');
             if(modalContainer && !modalContainer.classList.contains('hidden') && modalContainer.querySelector('h3')?.textContent.startsWith('Progreso')) {
                  modalContainer.classList.add('hidden');
             }
        }
    }

    // MODIFICADO: Ahora exporta la función para invalidar caché global
    window.catalogoModule = {
        invalidateCache: invalidateGlobalSortCache // Usar la nueva función global
    };

})();
