(function() {
    let _db, _userId, _userRole, _appId, _mainContent, _floatingControls, _activeListeners;
    let _showMainMenu, _showModal, _showAddItemModal, _populateDropdown;
    let _collection, _onSnapshot, _doc, _addDoc, _setDoc, _deleteDoc, _query, _where, _getDocs, _writeBatch;

    let _inventarioCache = [];
    let _lastFilters = { searchTerm: '', rubro: '', segmento: '', marca: '' };
    // ELIMINADO: _segmentoOrderCache ya no es necesario aquí
    let _inventarioListenerUnsubscribe = null;

    window.initInventario = function(dependencies) {
        _db = dependencies.db;
        _userId = dependencies.userId;
        _userRole = dependencies.userRole;
        _appId = dependencies.appId;
        _mainContent = dependencies.mainContent;
        _floatingControls = dependencies.floatingControls;
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
    };

    function startMainInventarioListener(callback) {
        if (_inventarioListenerUnsubscribe) {
            try { _inventarioListenerUnsubscribe(); } catch(e) { console.warn("Error unsubscribing:", e); }
        }
        const collectionRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`);
        _inventarioListenerUnsubscribe = _onSnapshot(collectionRef, (snapshot) => {
            _inventarioCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            if (callback && typeof callback === 'function') {
                 try { callback(); } catch (cbError) { console.error("Listener callback error:", cbError); }
            }
        }, (error) => {
             if (window.isLoggingOut && error.code === 'permission-denied') {
                 console.log("Inventario listener detenido por logout (ignorado).");
                 return;
             }
             console.error("Error en listener de inventario:", error);
             if (error.code !== 'cancelled') {
                 _showModal('Error de Conexión', 'No se pudo actualizar el inventario.');
             }
        });
        _activeListeners.push(_inventarioListenerUnsubscribe);
    }

    // MODIFICADO: Llama a la función global de invalidación
    function invalidateSegmentOrderCache() {
        // Llama a la función exportada por catalogo.js para invalidar cachés globales
        if (window.catalogoModule?.invalidateCache) {
             window.catalogoModule.invalidateCache();
        } else {
            console.warn("Función invalidateCache de catalogoModule no encontrada.");
        }
    }

    window.showInventarioSubMenu = function() {
        // No es necesario invalidar aquí, se invalida al guardar el orden
        if (_floatingControls) _floatingControls.classList.add('hidden');
        const isAdmin = _userRole === 'admin';
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto max-w-lg">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl text-center">
                        <h1 class="text-3xl font-bold text-gray-800 mb-6">Gestión de Inventario</h1>
                        <div class="space-y-4">
                            <button id="verModificarBtn" class="w-full px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg shadow-md hover:bg-blue-600">Ver Productos / ${isAdmin ? 'Modificar Def.' : 'Consultar Stock'}</button>
                            ${isAdmin ? `<button id="agregarProductoBtn" class="w-full px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg shadow-md hover:bg-blue-600">Agregar Producto</button>` : ''}
                            <button id="ajusteMasivoBtn" class="w-full px-6 py-3 bg-teal-500 text-white font-semibold rounded-lg shadow-md hover:bg-teal-600">Ajuste Masivo de Cantidades</button>
                            ${isAdmin ? `<button id="ordenarSegmentosBtn" class="w-full px-6 py-3 bg-purple-500 text-white font-semibold rounded-lg shadow-md hover:bg-purple-600">Ordenar Segmentos (Visualización)</button>` : ''}
                            ${isAdmin ? `<button id="modificarDatosBtn" class="w-full px-6 py-3 bg-yellow-500 text-gray-800 font-semibold rounded-lg shadow-md hover:bg-yellow-600">Modificar Datos Maestros</button>` : ''}
                            <button id="backToMenuBtn" class="w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver al Menú Principal</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('verModificarBtn').addEventListener('click', () => {
            _lastFilters = { searchTerm: '', rubro: '', segmento: '', marca: '' };
            showModifyDeleteView();
        });
        if (isAdmin) {
            document.getElementById('agregarProductoBtn')?.addEventListener('click', showAgregarProductoView);
            // MODIFICADO: La lógica de ordenar segmentos ahora también invalida la caché global
            document.getElementById('ordenarSegmentosBtn')?.addEventListener('click', showOrdenarSegmentosView);
            document.getElementById('modificarDatosBtn')?.addEventListener('click', showModificarDatosView);
        }
        document.getElementById('ajusteMasivoBtn').addEventListener('click', showAjusteMasivoView);
        document.getElementById('backToMenuBtn').addEventListener('click', _showMainMenu);
    }

    // ELIMINADO: getSegmentoOrderMap ya no se necesita

    // La lógica de showOrdenarSegmentosView, renderSortableSegmentList, addDragAndDropHandlers
    // y handleGuardarOrdenSegmentos permanece igual, pero handleGuardarOrdenSegmentos
    // ahora llama a invalidateSegmentOrderCache que a su vez llama a la función global.
    function showOrdenarSegmentosView() {
        if (_userRole !== 'admin') {
            _showModal('Acceso Denegado', 'Solo administradores.');
            return;
        }
        if (_floatingControls) _floatingControls.classList.add('hidden');
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto max-w-lg">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl">
                        <h2 class="text-2xl font-bold text-gray-800 mb-4 text-center">Ordenar Segmentos (Visualización)</h2>
                        <p class="text-center text-gray-600 mb-6">Arrastra para cambiar el orden. Este orden se propagará.</p>
                        <div class="mb-4">
                           <label for="ordenarRubroFilter" class="block text-gray-700 font-medium mb-2">Filtrar por Rubro:</label>
                           <select id="ordenarRubroFilter" class="w-full px-4 py-2 border rounded-lg">
                               <option value="">Todos</option>
                           </select>
                        </div>
                        <ul id="segmentos-sortable-list" class="space-y-2 border rounded-lg p-4 max-h-96 overflow-y-auto bg-gray-50">
                            <p class="text-gray-500 text-center">Cargando...</p>
                        </ul>
                        <div class="mt-6 flex flex-col sm:flex-row gap-4">
                            <button id="backToInventarioBtn" class="w-full px-6 py-3 bg-gray-400 text-white rounded-lg shadow-md hover:bg-gray-500">Volver</button>
                            <button id="saveOrderBtn" class="w-full px-6 py-3 bg-green-500 text-white rounded-lg shadow-md hover:bg-green-600">Guardar Orden</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('backToInventarioBtn').addEventListener('click', showInventarioSubMenu);
        document.getElementById('saveOrderBtn').addEventListener('click', handleGuardarOrdenSegmentos);
        const rubroFilter = document.getElementById('ordenarRubroFilter');
        _populateDropdown(`artifacts/${_appId}/users/${_userId}/rubros`, 'ordenarRubroFilter', 'Rubro');
        rubroFilter.addEventListener('change', () => renderSortableSegmentList(rubroFilter.value));
        renderSortableSegmentList('');
    }

    async function renderSortableSegmentList(rubro = '') {
        const container = document.getElementById('segmentos-sortable-list');
        if (!container) return;
        container.innerHTML = `<p class="text-gray-500 text-center">Cargando...</p>`;
        try {
            const segmentosRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/segmentos`);
            let snapshot = await _getDocs(segmentosRef);
            let allSegments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            const segmentsWithoutOrder = allSegments.filter(s => s.orden === undefined || s.orden === null);
            if (segmentsWithoutOrder.length > 0) {
                const segmentsWithOrder = allSegments.filter(s => s.orden !== undefined && s.orden !== null);
                const maxOrder = segmentsWithOrder.reduce((max, s) => Math.max(max, s.orden ?? -1), -1);
                const batch = _writeBatch(_db);
                segmentsWithoutOrder.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
                segmentsWithoutOrder.forEach((seg, index) => {
                    const docRef = _doc(segmentosRef, seg.id);
                    const newOrder = maxOrder + 1 + index;
                    batch.update(docRef, { orden: newOrder });
                    seg.orden = newOrder;
                });
                await batch.commit();
                allSegments = [...segmentsWithOrder, ...segmentsWithoutOrder];
            }

            let segmentsToDisplay = allSegments;
            if (rubro) {
                const inventarioRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`);
                const q = _query(inventarioRef, _where("rubro", "==", rubro));
                const inventarioSnapshot = await _getDocs(q);
                const usedSegmentNames = new Set(inventarioSnapshot.docs.map(doc => doc.data().segmento).filter(Boolean));
                segmentsToDisplay = allSegments.filter(s => s.name && usedSegmentNames.has(s.name));
            }

            segmentsToDisplay.sort((a, b) => (a.orden ?? 9999) - (b.orden ?? 9999));

            container.innerHTML = '';
            if (segmentsToDisplay.length === 0) {
                container.innerHTML = `<p class="text-gray-500 text-center">No hay segmentos ${rubro ? 'para este rubro' : 'definidos'}.</p>`;
                return;
            }
            segmentsToDisplay.forEach(seg => {
                const li = document.createElement('li');
                li.dataset.id = seg.id;
                li.dataset.name = seg.name;
                li.className = 'p-3 bg-gray-100 rounded shadow-sm cursor-grab active:cursor-grabbing hover:bg-gray-200';
                li.textContent = seg.name;
                li.draggable = true;
                container.appendChild(li);
            });
            addDragAndDropHandlers(container);
        } catch (error) {
            console.error("Error renderizando lista de segmentos:", error);
            container.innerHTML = `<p class="text-red-500 text-center">Error al cargar.</p>`;
        }
    }

    function addDragAndDropHandlers(container) {
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
                 e.dataTransfer.effectAllowed = 'move';
             } else { e.preventDefault(); }
        });
        container.addEventListener('dragend', e => {
             if (draggedItem) { draggedItem.style.opacity = '1'; }
             draggedItem = null;
             if (placeholder && placeholder.parentNode) placeholder.parentNode.removeChild(placeholder);
        });
        container.addEventListener('dragover', e => {
             e.preventDefault();
             e.dataTransfer.dropEffect = 'move';
             const afterElement = getDragAfterElement(container, e.clientY);
             if (draggedItem) {
                 if (afterElement) container.insertBefore(placeholder, afterElement);
                 else container.appendChild(placeholder);
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
        function getDragAfterElement(container, y) {
             const draggableElements = [...container.querySelectorAll('li:not([style*="height: 40px"])')].filter(el => el !== draggedItem);
             return draggableElements.reduce((closest, child) => {
                 const box = child.getBoundingClientRect();
                 const offset = y - box.top - box.height / 2;
                 if (offset < 0 && offset > closest.offset) return { offset: offset, element: child };
                 else return closest;
             }, { offset: Number.NEGATIVE_INFINITY }).element;
        }
    }

    async function handleGuardarOrdenSegmentos() {
        if (_userRole !== 'admin') return;
        const listItems = document.querySelectorAll('#segmentos-sortable-list li');
        if (listItems.length === 0) {
            _showModal('Aviso', 'Lista de segmentos vacía o no cargada.');
            return;
        }
        const batch = _writeBatch(_db);
        const orderedIds = [];
        let hasChanges = false;
        // Se necesita cargar el mapa actual para comparar si realmente hubo cambios
        let currentOrderMapTemp = {};
        try {
            const segmentsRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/segmentos`);
            const snapshot = await _getDocs(segmentsRef);
            snapshot.docs.forEach(doc => { currentOrderMapTemp[doc.id] = doc.data().orden; });
        } catch { /* Ignorar error de lectura, se procederá sin verificación de cambios */ }

        listItems.forEach((item, index) => {
            const docId = item.dataset.id;
            const docRef = _doc(_db, `artifacts/${_appId}/users/${_userId}/segmentos`, docId);
            const currentDbOrder = currentOrderMapTemp[docId];
             if (currentDbOrder === undefined || currentDbOrder !== index) { // Solo actualiza si cambió o no tenía orden
                 batch.update(docRef, { orden: index });
                 hasChanges = true;
             }
            orderedIds.push(docId);
        });

         if (!hasChanges) {
             _showModal('Aviso', 'No se detectaron cambios en el orden.');
             return;
         }
        _showModal('Progreso', 'Guardando orden...');
        try {
            await batch.commit();
            invalidateSegmentOrderCache(); // Llama a la función que ahora llama a la global

             if (window.adminModule?.propagateCategoryOrderChange) {
                  _showModal('Progreso', 'Propagando orden...');
                 await window.adminModule.propagateCategoryOrderChange('segmentos', orderedIds);
             } else {
                  console.warn("propagateCategoryOrderChange no encontrada.");
                  _showModal('Advertencia', 'Orden guardado localmente, no se pudo propagar.');
             }
            _showModal('Éxito', 'Orden de segmentos guardado y propagado.');
            showInventarioSubMenu();
        } catch (error) {
            console.error("Error guardando/propagando orden:", error);
            _showModal('Error', `Error al guardar: ${error.message}`);
        }
    }

    function showAjusteMasivoView() {
         if (_floatingControls) _floatingControls.classList.add('hidden');
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl">
                        <h2 class="text-2xl font-bold text-gray-800 mb-6 text-center">Ajuste Masivo de Cantidades</h2>
                        ${getFiltrosHTML('ajuste')}
                        <div id="ajusteListContainer" class="overflow-x-auto max-h-96 border rounded-lg">
                            <p class="text-gray-500 text-center p-4">Cargando...</p>
                        </div>
                        <div class="mt-6 flex flex-col sm:flex-row gap-4">
                            <button id="backToInventarioBtn" class="w-full px-6 py-3 bg-gray-400 text-white rounded-lg shadow-md hover:bg-gray-500">Volver</button>
                            <button id="saveAjusteBtn" class="w-full px-6 py-3 bg-green-500 text-white rounded-lg shadow-md hover:bg-green-600">Guardar Cambios</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('backToInventarioBtn').addEventListener('click', showInventarioSubMenu);
        document.getElementById('saveAjusteBtn').addEventListener('click', handleGuardarAjusteMasivo);
        const renderCallback = () => renderAjusteMasivoList();
        _populateDropdown(`artifacts/${_appId}/users/${_userId}/rubros`, 'ajuste-filter-rubro', 'Rubro');
        setupFiltros('ajuste', renderCallback);
        startMainInventarioListener(renderCallback);
    }

    // MODIFICADO: Usa la función de ordenamiento global
    async function renderAjusteMasivoList() {
        const container = document.getElementById('ajusteListContainer');
        if (!container) return;
        let productos = [..._inventarioCache];
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

        // --- NUEVO: Ordenamiento Global ---
        const sortFunction = await window.getGlobalProductSortFunction();
        productos.sort(sortFunction);
        // --- FIN NUEVO ---

        if (productos.length === 0) {
            container.innerHTML = `<p class="text-gray-500 text-center p-4">No hay productos que coincidan.</p>`;
            return;
        }

        let tableHTML = `<table class="min-w-full bg-white text-sm"><thead class="bg-gray-100 sticky top-0 z-10"><tr><th class="py-2 px-4 border-b text-left">Producto</th><th class="py-2 px-4 border-b text-center w-40">Cantidad Nueva</th></tr></thead><tbody>`;
        let lastHeaderKey = null; // Para agrupar visualmente según el primer criterio de orden
        const firstSortKey = _sortPreferenceCache ? _sortPreferenceCache[0] : 'segmento'; // Obtener primer criterio

        productos.forEach(p => {
            const currentHeaderValue = p[firstSortKey] || `Sin ${firstSortKey}`;
            // Añadir cabecera si cambia el valor del primer criterio de orden
            if (currentHeaderValue !== lastHeaderKey) {
                 lastHeaderKey = currentHeaderValue;
                 tableHTML += `<tr><td colspan="2" class="py-2 px-4 bg-gray-300 font-bold text-gray-800 sticky top-[calc(theme(height.10))] z-[9]">${lastHeaderKey}</td></tr>`;
            }

            const ventaPor = p.ventaPor || { und: true };
            let unitType = 'Und';
            let conversionFactor = 1;
            let currentStockInUnits = p.cantidadUnidades || 0;
            if (ventaPor.cj) { unitType = 'Cj'; conversionFactor = p.unidadesPorCaja || 1; }
            else if (ventaPor.paq) { unitType = 'Paq'; conversionFactor = p.unidadesPorPaquete || 1; }
            conversionFactor = Math.max(1, conversionFactor);
            const currentStockInDisplayUnits = Math.floor(currentStockInUnits / conversionFactor);

            tableHTML += `
                <tr class="hover:bg-gray-50">
                    <td class="py-2 px-4 border-b">
                        <p class="font-medium">${p.presentacion}</p>
                        <p class="text-xs text-gray-500">${p.marca || 'S/M'} - Actual: ${currentStockInDisplayUnits} ${unitType}. (${currentStockInUnits} Und.)</p>
                    </td>
                    <td class="py-2 px-4 border-b text-center align-middle">
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

    async function handleGuardarAjusteMasivo() {
        const inputs = document.querySelectorAll('#ajusteListContainer input[data-doc-id]');
        if (inputs.length === 0) {
            _showModal('Aviso', 'Lista vacía o no cargada.');
            return;
        }
        const batch = _writeBatch(_db);
        let changesCount = 0;
        let invalidValues = false;
        inputs.forEach(input => input.classList.remove('border-red-500', 'ring-1', 'ring-red-500'));

        inputs.forEach(input => {
            const docId = input.dataset.docId;
            const conversionFactor = parseInt(input.dataset.conversionFactor, 10) || 1;
            const newValueInDisplayUnitsStr = input.value.trim();
            const newValueInDisplayUnits = parseInt(newValueInDisplayUnitsStr, 10);
            const productoOriginal = _inventarioCache.find(p => p.id === docId);

            if (newValueInDisplayUnitsStr === '' || isNaN(newValueInDisplayUnits) || !Number.isInteger(newValueInDisplayUnits) || newValueInDisplayUnits < 0) {
                 if (newValueInDisplayUnitsStr !== '') {
                     input.classList.add('border-red-500', 'ring-1', 'ring-red-500');
                     invalidValues = true;
                 } return;
            }
            if (productoOriginal) {
                const nuevaCantidadUnidades = newValueInDisplayUnits * conversionFactor;
                if ((productoOriginal.cantidadUnidades || 0) !== nuevaCantidadUnidades) {
                    const docRef = _doc(_db, `artifacts/${_appId}/users/${_userId}/inventario`, docId);
                    batch.update(docRef, { cantidadUnidades: nuevaCantidadUnidades });
                    changesCount++;
                }
            }
        });

        if (invalidValues) {
             _showModal('Error de Entrada', 'Valores inválidos (no enteros >= 0). Corrígelos.'); return;
        }
        if (changesCount === 0) {
            _showModal('Aviso', 'No se detectaron cambios.'); return;
        }
        _showModal('Confirmar Cambios', `Se actualizará la cantidad de ${changesCount} producto(s). ¿Continuar?`, async () => {
             _showModal('Progreso', 'Guardando...');
            try {
                await batch.commit();
                _showModal('Éxito', 'Cantidades actualizadas.');
            } catch (error) {
                console.error("Error guardando ajuste:", error);
                _showModal('Error', `Error al guardar: ${error.message}`);
            }
        }, 'Sí, Actualizar', null, true);
    }

    // La lógica de showModificarDatosView, renderDataListForEditing, showAddCategoryModal,
    // handleDeleteDataItem, agregarProducto, showModifyDeleteView, getFiltrosHTML, setupFiltros,
    // editProducto, handleUpdateProducto, deleteProducto, handleDeleteAllProductos y
    // handleDeleteAllDatosMaestros permanece mayormente igual, pero las vistas que listan
    // productos ahora usan el ordenamiento global.

    function showModificarDatosView() {
        if (_userRole !== 'admin') { _showModal('Acceso Denegado', 'Solo administradores.'); return; }
        if (_floatingControls) _floatingControls.classList.add('hidden');
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl">
                        <h2 class="text-2xl font-bold text-gray-800 mb-6 text-center">Modificar Datos Maestros</h2>
                        <p class="text-sm text-center text-gray-600 mb-6">Gestiona Rubros, Segmentos, Marcas. Cambios se propagan. Eliminación solo si no están en uso.</p>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <h3 class="text-lg font-semibold text-gray-700 mb-2 border-b pb-2 flex justify-between items-center">
                                    <span>Rubros</span>
                                    <button onclick="window.inventarioModule.showAddCategoryModal('rubros', 'Rubro')" class="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600">+</button>
                                </h3>
                                <div id="rubros-list" class="space-y-2 max-h-60 overflow-y-auto border p-2 rounded bg-gray-50"></div>
                            </div>
                            <div>
                                <h3 class="text-lg font-semibold text-gray-700 mb-2 border-b pb-2 flex justify-between items-center">
                                    <span>Segmentos</span>
                                     <button onclick="window.inventarioModule.showAddCategoryModal('segmentos', 'Segmento')" class="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600">+</button>
                                </h3>
                                <div id="segmentos-list" class="space-y-2 max-h-60 overflow-y-auto border p-2 rounded bg-gray-50"></div>
                            </div>
                            <div>
                                <h3 class="text-lg font-semibold text-gray-700 mb-2 border-b pb-2 flex justify-between items-center">
                                    <span>Marcas</span>
                                     <button onclick="window.inventarioModule.showAddCategoryModal('marcas', 'Marca')" class="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600">+</button>
                                </h3>
                                <div id="marcas-list" class="space-y-2 max-h-60 overflow-y-auto border p-2 rounded bg-gray-50"></div>
                            </div>
                        </div>
                        <div class="mt-8 flex flex-col sm:flex-row gap-4">
                            <button id="backToInventarioBtn" class="w-full px-6 py-3 bg-gray-400 text-white rounded-lg shadow-md hover:bg-gray-500">Volver</button>
                            <button id="deleteAllDatosMaestrosBtn" class="w-full px-6 py-3 bg-red-600 text-white rounded-lg shadow-md hover:bg-red-700">Eliminar No Usados</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('backToInventarioBtn').addEventListener('click', showInventarioSubMenu);
        document.getElementById('deleteAllDatosMaestrosBtn').addEventListener('click', handleDeleteAllDatosMaestros);
        renderDataListForEditing('rubros', 'rubros-list', 'Rubro');
        renderDataListForEditing('segmentos', 'segmentos-list', 'Segmento');
        renderDataListForEditing('marcas', 'marcas-list', 'Marca');
    }

    function renderDataListForEditing(collectionName, containerId, itemName) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = `<p class="text-gray-500 text-sm p-2">Cargando...</p>`;
        const collectionRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/${collectionName}`);
        const unsubscribe = _onSnapshot(collectionRef, (snapshot) => {
            const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            if (items.length === 0) {
                container.innerHTML = `<p class="text-gray-500 text-sm p-2">No hay ${itemName.toLowerCase()}s.</p>`; return;
            }
            container.innerHTML = items.map(item => `
                <div class="flex justify-between items-center bg-white p-2 rounded shadow-sm border border-gray-200">
                    <span class="text-gray-800 text-sm flex-grow mr-2">${item.name}</span>
                    <div class="flex-shrink-0 space-x-1">
                        <button onclick="window.inventarioModule.handleDeleteDataItem('${collectionName}', '${item.name}', '${itemName}', '${item.id}')" class="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600" title="Eliminar">X</button>
                    </div>
                </div>
            `).join('');
        }, (error) => {
             if (window.isLoggingOut && error.code === 'permission-denied') { return; }
             console.error(`Error listener ${collectionName}:`, error);
             container.innerHTML = `<p class="text-red-500 text-center p-2">Error al cargar.</p>`;
        });
        _activeListeners.push(unsubscribe);
    }

    // showAddCategoryModal ahora es global y está en admin.js, así que no se necesita aquí.
    // Se deja una referencia por si se llama desde este archivo.
    function showAddCategoryModal(collectionName, itemName) {
         if (window.adminModule?.showAddCategoryModal) {
             window.adminModule.showAddCategoryModal(collectionName, itemName);
         } else if (_showAddItemModal) { // Fallback a la versión básica si adminModule no está listo
              _showAddItemModal(collectionName, itemName);
         } else {
             console.error("Función showAddCategoryModal no encontrada.");
         }
    }


    async function handleDeleteDataItem(collectionName, itemName, itemType, itemId) {
        if (_userRole !== 'admin') { _showModal('Acceso Denegado', 'Solo administradores.'); return; }
        const fieldMap = { rubros: 'rubro', segmentos: 'segmento', marcas: 'marca' };
        const fieldName = fieldMap[collectionName];
        if (!fieldName) { _showModal('Error Interno', 'Tipo no reconocido.'); return; }
        _showModal('Progreso', `Verificando uso de "${itemName}"...`);
        const inventarioRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`);
        const q = _query(inventarioRef, _where(fieldName, "==", itemName));
        try {
            const usageSnapshot = await _getDocs(q);
            if (!usageSnapshot.empty) {
                _showModal('Error al Eliminar', `"${itemName}" está en uso por ${usageSnapshot.size} producto(s). No se puede eliminar.`); return;
            }
            _showModal('Confirmar Eliminación', `Eliminar ${itemType} "${itemName}"? Se propagará y es IRREVERSIBLE.`, async () => {
                 _showModal('Progreso', `Eliminando "${itemName}"...`);
                 try {
                     await _deleteDoc(_doc(_db, `artifacts/${_appId}/users/${_userId}/${collectionName}`, itemId));
                     if (window.adminModule?.propagateCategoryChange) {
                          _showModal('Progreso', `Propagando eliminación...`);
                         await window.adminModule.propagateCategoryChange(collectionName, itemId, null);
                     } else { console.warn('Propagate function not found.'); }
                     if (collectionName === 'segmentos') invalidateSegmentOrderCache();
                     _showModal('Éxito', `${itemType} "${itemName}" eliminado.`);
                 } catch (deleteError) {
                      console.error(`Error eliminando/propagando ${itemName}:`, deleteError);
                      _showModal('Error', `Error: ${deleteError.message}`);
                 }
            }, 'Sí, Eliminar', null, true);
        } catch (error) {
             console.error(`Error verificando uso ${itemName}:`, error);
            _showModal('Error', `Error al verificar: ${error.message}`);
        }
    }

    function showAgregarProductoView() {
        if (_userRole !== 'admin') { _showModal('Acceso Denegado', 'Solo administradores.'); return; }
        if (_floatingControls) _floatingControls.classList.add('hidden');
        _mainContent.innerHTML = `
            <div class="p-4 pt-8"> <div class="container mx-auto max-w-2xl"> <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl text-center">
                <h2 class="text-2xl font-bold text-gray-800 mb-6">Agregar Producto</h2>
                <form id="productoForm" class="space-y-4 text-left">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div> <label for="rubro">Rubro:</label> <div class="flex items-center space-x-2"> <select id="rubro" class="w-full px-4 py-2 border rounded-lg" required></select> <button type="button" onclick="window.inventarioModule.showAddCategoryModal('rubros', 'Rubro')" class="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-xs">+</button> </div> </div>
                        <div> <label for="segmento">Segmento:</label> <div class="flex items-center space-x-2"> <select id="segmento" class="w-full px-4 py-2 border rounded-lg" required></select> <button type="button" onclick="window.inventarioModule.showAddCategoryModal('segmentos', 'Segmento')" class="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-xs">+</button> </div> </div>
                        <div> <label for="marca">Marca:</label> <div class="flex items-center space-x-2"> <select id="marca" class="w-full px-4 py-2 border rounded-lg" required></select> <button type="button" onclick="window.inventarioModule.showAddCategoryModal('marcas', 'Marca')" class="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-xs">+</button> </div> </div>
                        <div> <label for="presentacion">Presentación:</label> <input type="text" id="presentacion" class="w-full px-4 py-2 border rounded-lg" required> </div>
                    </div>
                    <div class="border-t pt-4 mt-4">
                        <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div> <label class="block mb-2">Venta por:</label> <div id="ventaPorContainer" class="flex items-center space-x-4"> <label class="flex items-center"><input type="checkbox" id="ventaPorUnd" class="h-4 w-4"> <span class="ml-2">Und.</span></label> <label class="flex items-center"><input type="checkbox" id="ventaPorPaq" class="h-4 w-4"> <span class="ml-2">Paq.</span></label> <label class="flex items-center"><input type="checkbox" id="ventaPorCj" class="h-4 w-4"> <span class="ml-2">Cj.</span></label> </div> </div>
                            <div class="mt-4 md:mt-0"> <label class="flex items-center cursor-pointer"> <input type="checkbox" id="manejaVaciosCheck" class="h-4 w-4"> <span class="ml-2 font-medium">Maneja Vacío</span> </label> <div id="tipoVacioContainer" class="mt-2 hidden"> <label for="tipoVacioSelect" class="block text-sm">Tipo:</label> <select id="tipoVacioSelect" class="w-full px-2 py-1 border rounded-lg text-sm bg-gray-50"> <option value="">Seleccione...</option> <option value="1/4 - 1/3">1/4 - 1/3</option> <option value="ret 350 ml">Ret 350 ml</option> <option value="ret 1.25 Lts">Ret 1.25 Lts</option> </select> </div> </div>
                        </div>
                        <div id="empaquesContainer" class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4"></div>
                        <div id="preciosContainer" class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4"></div>
                    </div>
                    <div class="border-t pt-4 mt-4">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div> <label>Cantidad Inicial:</label> <input type="number" id="cantidadInicial" value="0" class="w-full px-4 py-2 border rounded-lg bg-gray-100" readonly> <p class="text-xs text-gray-500 mt-1">Siempre 0. Ajustar luego.</p> </div>
                            <div> <label for="ivaTipo">IVA:</label> <select id="ivaTipo" class="w-full px-4 py-2 border rounded-lg" required> <option value="16" selected>16%</option> <option value="0">Exento 0%</option> </select> </div>
                        </div>
                    </div>
                    <button type="submit" class="w-full px-6 py-3 bg-green-500 text-white rounded-lg shadow-md hover:bg-green-600">Guardar y Propagar</button>
                </form>
                <button id="backToInventarioBtn" class="mt-4 w-full px-6 py-3 bg-gray-400 text-white rounded-lg shadow-md hover:bg-gray-500">Volver</button>
            </div> </div> </div>
        `;
        _populateDropdown(`artifacts/${_appId}/users/${_userId}/rubros`, 'rubro', 'Rubro');
        _populateDropdown(`artifacts/${_appId}/users/${_userId}/segmentos`, 'segmento', 'Segmento');
        _populateDropdown(`artifacts/${_appId}/users/${_userId}/marcas`, 'marca', 'Marca');
        const ventaPorContainer = document.getElementById('ventaPorContainer');
        const preciosContainer = document.getElementById('preciosContainer');
        const empaquesContainer = document.getElementById('empaquesContainer');
        const manejaVaciosCheck = document.getElementById('manejaVaciosCheck');
        const tipoVacioContainer = document.getElementById('tipoVacioContainer');
        const tipoVacioSelect = document.getElementById('tipoVacioSelect');
        const updateDynamicInputs = () => {
             empaquesContainer.innerHTML = ''; preciosContainer.innerHTML = '';
             const vPaq = document.getElementById('ventaPorPaq').checked, vCj = document.getElementById('ventaPorCj').checked, vUnd = document.getElementById('ventaPorUnd').checked;
             if (vPaq) empaquesContainer.innerHTML += `<div><label class="text-sm">Und/Paq:</label><input type="number" id="unidadesPorPaquete" min="1" step="1" class="w-full px-2 py-1 border rounded" value="1" required></div>`;
             if (vCj) empaquesContainer.innerHTML += `<div><label class="text-sm">Und/Cj:</label><input type="number" id="unidadesPorCaja" min="1" step="1" class="w-full px-2 py-1 border rounded" value="1" required></div>`;
             if (vUnd) preciosContainer.innerHTML += `<div><label class="text-sm">Precio Und.</label><input type="number" step="0.01" min="0" id="precioUnd" class="w-full px-2 py-1 border rounded" required></div>`;
             if (vPaq) preciosContainer.innerHTML += `<div><label class="text-sm">Precio Paq.</label><input type="number" step="0.01" min="0" id="precioPaq" class="w-full px-2 py-1 border rounded" required></div>`;
             if (vCj) preciosContainer.innerHTML += `<div><label class="text-sm">Precio Cj.</label><input type="number" step="0.01" min="0" id="precioCj" class="w-full px-2 py-1 border rounded" required></div>`;
             preciosContainer.querySelectorAll('input').forEach(input => { input.required = document.getElementById(`ventaPor${input.id.substring(6)}`)?.checked ?? false; });
        };
        manejaVaciosCheck.addEventListener('change', () => {
             if (manejaVaciosCheck.checked) { tipoVacioContainer.classList.remove('hidden'); tipoVacioSelect.required = true; }
             else { tipoVacioContainer.classList.add('hidden'); tipoVacioSelect.required = false; tipoVacioSelect.value = ''; }
        });
        ventaPorContainer.addEventListener('change', updateDynamicInputs);
        updateDynamicInputs();
        document.getElementById('productoForm').addEventListener('submit', agregarProducto);
        document.getElementById('backToInventarioBtn').addEventListener('click', showInventarioSubMenu);
    }

    function getProductoDataFromForm(isEditing = false) {
        const undPaqInput = document.getElementById('unidadesPorPaquete'), undCjInput = document.getElementById('unidadesPorCaja');
        const undPaq = Math.max(1, undPaqInput ? (parseInt(undPaqInput.value, 10) || 1) : 1);
        const undCj = Math.max(1, undCjInput ? (parseInt(undCjInput.value, 10) || 1) : 1);
        const pUndInput = document.getElementById('precioUnd'), pPaqInput = document.getElementById('precioPaq'), pCjInput = document.getElementById('precioCj');
        const precios = {
            und: Math.max(0, pUndInput ? (parseFloat(pUndInput.value) || 0) : 0),
            paq: Math.max(0, pPaqInput ? (parseFloat(pPaqInput.value) || 0) : 0),
            cj: Math.max(0, pCjInput ? (parseFloat(pCjInput.value) || 0) : 0),
        };
        let pFinalUnd = 0;
        if (precios.und > 0) pFinalUnd = precios.und;
        else if (precios.paq > 0 && undPaq > 0) pFinalUnd = precios.paq / undPaq;
        else if (precios.cj > 0 && undCj > 0) pFinalUnd = precios.cj / undCj;
        pFinalUnd = parseFloat(pFinalUnd.toFixed(2));
        const cantUnd = isEditing ? (parseInt(document.getElementById('cantidadActual').value, 10) || 0) : 0;
        const manejaVac = document.getElementById('manejaVaciosCheck').checked;
        const tipoVac = document.getElementById('tipoVacioSelect').value;
        return {
            rubro: document.getElementById('rubro').value, segmento: document.getElementById('segmento').value,
            marca: document.getElementById('marca').value, presentacion: document.getElementById('presentacion').value.trim(),
            unidadesPorPaquete: undPaq, unidadesPorCaja: undCj,
            ventaPor: { und: document.getElementById('ventaPorUnd').checked, paq: document.getElementById('ventaPorPaq').checked, cj: document.getElementById('ventaPorCj').checked },
            manejaVacios: manejaVac, tipoVacio: manejaVac ? tipoVac : null,
            precios: precios, precioPorUnidad: pFinalUnd,
            cantidadUnidades: cantUnd, iva: parseInt(document.getElementById('ivaTipo').value, 10)
        };
    }

    async function agregarProducto(e) {
        e.preventDefault();
        if (_userRole !== 'admin') return;
        const productoData = getProductoDataFromForm(false);
        if (!productoData.rubro || !productoData.segmento || !productoData.marca || !productoData.presentacion) { _showModal('Error', 'Completa Rubro, Segmento, Marca y Presentación.'); return; }
        if (!productoData.ventaPor.und && !productoData.ventaPor.paq && !productoData.ventaPor.cj) { _showModal('Error', 'Selecciona forma de venta.'); return; }
        if (productoData.manejaVacios && !productoData.tipoVacio) { _showModal('Error', 'Si maneja vacío, selecciona tipo.'); document.getElementById('tipoVacioSelect')?.focus(); return; }
        let pValido = (productoData.ventaPor.und && productoData.precios.und > 0) || (productoData.ventaPor.paq && productoData.precios.paq > 0) || (productoData.ventaPor.cj && productoData.precios.cj > 0);
        if (!pValido) { _showModal('Error', 'Ingresa al menos un precio > 0.'); document.querySelector('#preciosContainer input[required]')?.focus(); return; }
        _showModal('Progreso', 'Verificando y guardando...');
        try {
            const inventarioRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`);
            const q = _query(inventarioRef, _where("rubro", "==", productoData.rubro), _where("segmento", "==", productoData.segmento), _where("marca", "==", productoData.marca), _where("presentacion", "==", productoData.presentacion));
            const querySnapshot = await _getDocs(q);
            if (!querySnapshot.empty) { _showModal('Producto Duplicado', 'Ya existe un producto con esa combinación.'); return; }
            const docRef = await _addDoc(inventarioRef, productoData);
            if (window.adminModule?.propagateProductChange) {
                 await window.adminModule.propagateProductChange(docRef.id, productoData);
            }
            _showModal('Éxito', 'Producto agregado.');
            showAgregarProductoView();
        } catch (err) { console.error("Error agregando:", err); _showModal('Error', `Error: ${err.message}`); }
    }

    function showModifyDeleteView() {
         if (_floatingControls) _floatingControls.classList.add('hidden');
        const isAdmin = _userRole === 'admin';
        _mainContent.innerHTML = `
            <div class="p-4 pt-8"> <div class="container mx-auto"> <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl">
                <h2 class="text-2xl font-bold text-gray-800 mb-6 text-center">Ver Productos / ${isAdmin ? 'Modificar Def.' : 'Consultar Stock'}</h2>
                ${getFiltrosHTML('modify')}
                <div id="productosListContainer" class="overflow-x-auto max-h-96 border rounded-lg"> <p class="text-gray-500 text-center p-4">Cargando...</p> </div>
                <div class="mt-6 flex flex-col sm:flex-row gap-4">
                    <button id="backToInventarioBtn" class="w-full px-6 py-3 bg-gray-400 text-white rounded-lg shadow-md hover:bg-gray-500">Volver</button>
                    ${isAdmin ? `<button id="deleteAllProductosBtn" class="w-full px-6 py-3 bg-red-600 text-white rounded-lg shadow-md hover:bg-red-700">Eliminar Todos</button>` : ''}
                </div>
            </div> </div> </div>
        `;
        document.getElementById('backToInventarioBtn').addEventListener('click', showInventarioSubMenu);
        if (isAdmin) document.getElementById('deleteAllProductosBtn')?.addEventListener('click', handleDeleteAllProductos);
        const renderCallback = () => renderProductosList('productosListContainer', !isAdmin);
        _populateDropdown(`artifacts/${_appId}/users/${_userId}/rubros`, 'modify-filter-rubro', 'Rubro');
        setupFiltros('modify', renderCallback);
        startMainInventarioListener(renderCallback);
    }

    function getFiltrosHTML(prefix) {
         const currentSearch = _lastFilters.searchTerm || '';
        return `
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 p-4 border rounded-lg bg-gray-50">
                <input type="text" id="${prefix}-search-input" placeholder="Buscar..." class="md:col-span-4 w-full px-4 py-2 border rounded-lg text-sm" value="${currentSearch}">
                <div> <label for="${prefix}-filter-rubro" class="text-xs">Rubro</label> <select id="${prefix}-filter-rubro" class="w-full px-2 py-1 border rounded-lg text-sm"><option value="">Todos</option></select> </div>
                 <div> <label for="${prefix}-filter-segmento" class="text-xs">Segmento</label> <select id="${prefix}-filter-segmento" class="w-full px-2 py-1 border rounded-lg text-sm" disabled><option value="">Todos</option></select> </div>
                 <div> <label for="${prefix}-filter-marca" class="text-xs">Marca</label> <select id="${prefix}-filter-marca" class="w-full px-2 py-1 border rounded-lg text-sm" disabled><option value="">Todos</option></select> </div>
                <button id="${prefix}-clear-filters-btn" class="bg-gray-300 text-xs rounded-lg self-end py-1.5 px-3 hover:bg-gray-400">Limpiar</button>
            </div> `;
    }

    function setupFiltros(prefix, renderCallback) {
        const searchInput = document.getElementById(`${prefix}-search-input`);
        const rubroFilter = document.getElementById(`${prefix}-filter-rubro`);
        const segmentoFilter = document.getElementById(`${prefix}-filter-segmento`);
        const marcaFilter = document.getElementById(`${prefix}-filter-marca`);
        const clearBtn = document.getElementById(`${prefix}-clear-filters-btn`);
        if (!searchInput || !rubroFilter || !segmentoFilter || !marcaFilter || !clearBtn) { return; }
        function updateDependentFilters(trigger) {
             const selRubro = rubroFilter.value, selSeg = segmentoFilter.value;
             if (trigger === 'rubro' || trigger === 'init') {
                 const curSegVal = (trigger === 'init') ? _lastFilters.segmento : '';
                 segmentoFilter.innerHTML = '<option value="">Todos</option>'; segmentoFilter.disabled = true; segmentoFilter.value = curSegVal;
                 if (selRubro) {
                     const segs = [...new Set(_inventarioCache.filter(p => p.rubro === selRubro && p.segmento).map(p => p.segmento))].sort();
                     if (segs.length > 0) { segs.forEach(s => segmentoFilter.innerHTML += `<option value="${s}" ${s === curSegVal ? 'selected' : ''}>${s}</option>`); segmentoFilter.disabled = false; segmentoFilter.value = curSegVal; }
                 }
                 if (segmentoFilter.value !== curSegVal) _lastFilters.segmento = '';
             }
             if (trigger === 'rubro' || trigger === 'segmento' || trigger === 'init') {
                  const curMarVal = (trigger === 'init') ? _lastFilters.marca : '';
                  marcaFilter.innerHTML = '<option value="">Todos</option>'; marcaFilter.disabled = true; marcaFilter.value = curMarVal;
                  if (selRubro) {
                      const marcas = [...new Set(_inventarioCache.filter(p => p.rubro === selRubro && (!selSeg || p.segmento === selSeg) && p.marca).map(p => p.marca))].sort();
                      if (marcas.length > 0) { marcas.forEach(m => marcaFilter.innerHTML += `<option value="${m}" ${m === curMarVal ? 'selected' : ''}>${m}</option>`); marcaFilter.disabled = false; marcaFilter.value = curMarVal; }
                  }
                   if (marcaFilter.value !== curMarVal) _lastFilters.marca = '';
             }
        }
        setTimeout(() => {
             rubroFilter.value = _lastFilters.rubro || '';
             updateDependentFilters('init');
             if (typeof renderCallback === 'function') renderCallback();
        }, 300);
        const applyAndSave = () => {
             _lastFilters.searchTerm = searchInput.value || ''; _lastFilters.rubro = rubroFilter.value || '';
             _lastFilters.segmento = segmentoFilter.value || ''; _lastFilters.marca = marcaFilter.value || '';
              if (typeof renderCallback === 'function') renderCallback();
        };
        searchInput.addEventListener('input', applyAndSave);
        rubroFilter.addEventListener('change', () => { _lastFilters.segmento = ''; _lastFilters.marca = ''; updateDependentFilters('rubro'); applyAndSave(); });
        segmentoFilter.addEventListener('change', () => { _lastFilters.marca = ''; updateDependentFilters('segmento'); applyAndSave(); });
        marcaFilter.addEventListener('change', applyAndSave);
        clearBtn.addEventListener('click', () => { searchInput.value = ''; rubroFilter.value = ''; updateDependentFilters('rubro'); applyAndSave(); });
    }

    // MODIFICADO: Usa la función de ordenamiento global
    async function renderProductosList(elementId, readOnly = false) {
        const container = document.getElementById(elementId);
        if (!container) return;
        let productos = [..._inventarioCache];
        productos = productos.filter(p => {
             const searchL = (_lastFilters.searchTerm || '').toLowerCase();
             const txtMatch = !searchL || (p.presentacion && p.presentacion.toLowerCase().includes(searchL)) || (p.marca && p.marca.toLowerCase().includes(searchL)) || (p.segmento && p.segmento.toLowerCase().includes(searchL));
             const rubroMatch = !_lastFilters.rubro || p.rubro === _lastFilters.rubro;
             const segMatch = !_lastFilters.segmento || p.segmento === _lastFilters.segmento;
             const marcaMatch = !_lastFilters.marca || p.marca === _lastFilters.marca;
             return txtMatch && rubroMatch && segMatch && marcaMatch;
        });

        // --- NUEVO: Ordenamiento Global ---
        const sortFunction = await window.getGlobalProductSortFunction();
        productos.sort(sortFunction);
        // --- FIN NUEVO ---

        if (productos.length === 0) {
            container.innerHTML = `<p class="text-gray-500 text-center p-4">No hay productos que coincidan.</p>`; return;
        }
        const cols = readOnly ? 3 : 4;
        let tableHTML = `<table class="min-w-full bg-white text-sm"><thead class="bg-gray-200 sticky top-0 z-10"><tr>
            <th class="py-2 px-3 border-b text-left">Presentación</th> <th class="py-2 px-3 border-b text-right">Precio</th>
            <th class="py-2 px-3 border-b text-center">Stock</th> ${!readOnly ? `<th class="py-2 px-3 border-b text-center">Acciones</th>` : ''}
        </tr></thead><tbody>`;

        let lastHeaderKey = null; // Agrupar visualmente según primer criterio
        const firstSortKey = _sortPreferenceCache ? _sortPreferenceCache[0] : 'segmento';

        productos.forEach(p => {
            const currentHeaderValue = p[firstSortKey] || `Sin ${firstSortKey}`;
            // Añadir cabecera si cambia
            if (currentHeaderValue !== lastHeaderKey) {
                 lastHeaderKey = currentHeaderValue;
                 tableHTML += `<tr><td colspan="${cols}" class="py-2 px-4 bg-gray-300 font-bold sticky top-[calc(theme(height.10))] z-[9]">${lastHeaderKey}</td></tr>`;
            }
            const vPor = p.ventaPor || { und: true }, precios = p.precios || { und: p.precioPorUnidad || 0 };
            let dispPres = p.presentacion || 'N/A', dispPrecio = `$0.00`, dispStock = `${p.cantidadUnidades || 0} Und`, factorStock = 1;
            if (vPor.cj) { if (p.unidadesPorCaja) dispPres += ` (${p.unidadesPorCaja} und.)`; dispPrecio = `$${(precios.cj || 0).toFixed(2)}`; factorStock = Math.max(1, p.unidadesPorCaja || 1); dispStock = `${Math.floor((p.cantidadUnidades || 0) / factorStock)} Cj`; }
            else if (vPor.paq) { if (p.unidadesPorPaquete) dispPres += ` (${p.unidadesPorPaquete} und.)`; dispPrecio = `$${(precios.paq || 0).toFixed(2)}`; factorStock = Math.max(1, p.unidadesPorPaquete || 1); dispStock = `${Math.floor((p.cantidadUnidades || 0) / factorStock)} Paq`; }
            else { dispPrecio = `$${(precios.und || 0).toFixed(2)}`; }
            const stockUnd = p.cantidadUnidades || 0, stockTooltip = `${stockUnd} Und. Base`;

            tableHTML += `
                <tr class="hover:bg-gray-50">
                    <td class="py-2 px-3 border-b">${dispPres}</td> <td class="py-2 px-3 border-b text-right font-medium">${dispPrecio}</td>
                    <td class="py-2 px-3 border-b text-center font-medium" title="${stockTooltip}">${dispStock}</td>
                    ${!readOnly ? `
                    <td class="py-2 px-3 border-b text-center space-x-1">
                        <button onclick="window.inventarioModule.editProducto('${p.id}')" class="px-2 py-1 bg-yellow-500 text-white text-xs rounded hover:bg-yellow-600" title="Editar">Edt</button>
                        <button onclick="window.inventarioModule.deleteProducto('${p.id}')" class="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600" title="Eliminar">Del</button>
                    </td>` : ''}
                </tr> `;
        });
        tableHTML += `</tbody></table>`;
        container.innerHTML = tableHTML;
    }

    function editProducto(productId) {
        if (_userRole !== 'admin') { _showModal('Acceso Denegado', 'Solo administradores.'); return; }
        const producto = _inventarioCache.find(p => p.id === productId);
        if (!producto) { _showModal('Error', 'Producto no encontrado.'); return; }
        if (_floatingControls) _floatingControls.classList.add('hidden');
        _mainContent.innerHTML = `
            <div class="p-4 pt-8"> <div class="container mx-auto max-w-2xl"> <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl text-center">
                <h2 class="text-2xl font-bold text-gray-800 mb-6">Editar Producto</h2>
                <form id="editProductoForm" class="space-y-4 text-left">
                     <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div> <label for="rubro">Rubro:</label> <div class="flex items-center space-x-2"> <select id="rubro" class="w-full px-4 py-2 border rounded-lg" required></select> <button type="button" onclick="window.inventarioModule.showAddCategoryModal('rubros', 'Rubro')" class="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-xs">+</button> </div> </div>
                        <div> <label for="segmento">Segmento:</label> <div class="flex items-center space-x-2"> <select id="segmento" class="w-full px-4 py-2 border rounded-lg" required></select> <button type="button" onclick="window.inventarioModule.showAddCategoryModal('segmentos', 'Segmento')" class="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-xs">+</button> </div> </div>
                        <div> <label for="marca">Marca:</label> <div class="flex items-center space-x-2"> <select id="marca" class="w-full px-4 py-2 border rounded-lg" required></select> <button type="button" onclick="window.inventarioModule.showAddCategoryModal('marcas', 'Marca')" class="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-xs">+</button> </div> </div>
                        <div> <label for="presentacion">Presentación:</label> <input type="text" id="presentacion" class="w-full px-4 py-2 border rounded-lg" required> </div>
                    </div>
                    <div class="border-t pt-4 mt-4">
                        <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div> <label class="block mb-2">Venta por:</label> <div id="ventaPorContainer" class="flex items-center space-x-4"> <label class="flex items-center"><input type="checkbox" id="ventaPorUnd" class="h-4 w-4"> <span class="ml-2">Und.</span></label> <label class="flex items-center"><input type="checkbox" id="ventaPorPaq" class="h-4 w-4"> <span class="ml-2">Paq.</span></label> <label class="flex items-center"><input type="checkbox" id="ventaPorCj" class="h-4 w-4"> <span class="ml-2">Cj.</span></label> </div> </div>
                            <div class="mt-4 md:mt-0"> <label class="flex items-center cursor-pointer"> <input type="checkbox" id="manejaVaciosCheck" class="h-4 w-4"> <span class="ml-2 font-medium">Maneja Vacío</span> </label> <div id="tipoVacioContainer" class="mt-2 hidden"> <label for="tipoVacioSelect" class="block text-sm">Tipo:</label> <select id="tipoVacioSelect" class="w-full px-2 py-1 border rounded-lg text-sm bg-gray-50"> <option value="">Seleccione...</option> <option value="1/4 - 1/3">1/4 - 1/3</option> <option value="ret 350 ml">Ret 350 ml</option> <option value="ret 1.25 Lts">Ret 1.25 Lts</option> </select> </div> </div>
                        </div>
                        <div id="empaquesContainer" class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4"></div>
                        <div id="preciosContainer" class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4"></div>
                    </div>
                     <div class="border-t pt-4 mt-4">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div> <label>Stock Actual (Und):</label> <input type="number" id="cantidadActual" value="${producto.cantidadUnidades || 0}" class="w-full px-4 py-2 border rounded-lg bg-gray-100" readonly> <p class="text-xs text-gray-500 mt-1">Modificar desde "Ajuste Masivo".</p> </div>
                            <div> <label for="ivaTipo">IVA:</label> <select id="ivaTipo" class="w-full px-4 py-2 border rounded-lg" required> <option value="16">16%</option> <option value="0">Exento 0%</option> </select> </div>
                        </div>
                    </div>
                    <button type="submit" class="w-full px-6 py-3 bg-blue-500 text-white rounded-lg shadow-md hover:bg-blue-600">Guardar Cambios y Propagar</button>
                </form>
                <button id="backToModifyDeleteBtn" class="mt-4 w-full px-6 py-3 bg-gray-400 text-white rounded-lg shadow-md hover:bg-gray-500">Volver</button>
            </div> </div> </div>
        `;
        _populateDropdown(`artifacts/${_appId}/users/${_userId}/rubros`, 'rubro', 'Rubro', producto.rubro);
        _populateDropdown(`artifacts/${_appId}/users/${_userId}/segmentos`, 'segmento', 'Segmento', producto.segmento);
        _populateDropdown(`artifacts/${_appId}/users/${_userId}/marcas`, 'marca', 'Marca', producto.marca);
        const vPorCont = document.getElementById('ventaPorContainer'), pCont = document.getElementById('preciosContainer'), eCont = document.getElementById('empaquesContainer');
        const mVacioCheck = document.getElementById('manejaVaciosCheck'), tVacioCont = document.getElementById('tipoVacioContainer'), tVacioSel = document.getElementById('tipoVacioSelect');
        const updateDynInputs = () => {
             eCont.innerHTML = ''; pCont.innerHTML = '';
             const vPaq = document.getElementById('ventaPorPaq').checked, vCj = document.getElementById('ventaPorCj').checked, vUnd = document.getElementById('ventaPorUnd').checked;
             if (vPaq) eCont.innerHTML += `<div><label class="text-sm">Und/Paq:</label><input type="number" id="unidadesPorPaquete" min="1" class="w-full px-2 py-1 border rounded" value="1" required></div>`;
             if (vCj) eCont.innerHTML += `<div><label class="text-sm">Und/Cj:</label><input type="number" id="unidadesPorCaja" min="1" class="w-full px-2 py-1 border rounded" value="1" required></div>`;
             if (vUnd) pCont.innerHTML += `<div><label class="text-sm">Precio Und.</label><input type="number" step="0.01" min="0" id="precioUnd" class="w-full px-2 py-1 border rounded" required></div>`;
             if (vPaq) pCont.innerHTML += `<div><label class="text-sm">Precio Paq.</label><input type="number" step="0.01" min="0" id="precioPaq" class="w-full px-2 py-1 border rounded" required></div>`;
             if (vCj) pCont.innerHTML += `<div><label class="text-sm">Precio Cj.</label><input type="number" step="0.01" min="0" id="precioCj" class="w-full px-2 py-1 border rounded" required></div>`;
             pCont.querySelectorAll('input').forEach(input => { input.required = document.getElementById(`ventaPor${input.id.substring(6)}`)?.checked ?? false; });
        };
        mVacioCheck.addEventListener('change', () => {
             if (mVacioCheck.checked) { tVacioCont.classList.remove('hidden'); tVacioSel.required = true; }
             else { tVacioCont.classList.add('hidden'); tVacioSel.required = false; tVacioSel.value = ''; }
        });
        vPorCont.addEventListener('change', updateDynInputs);
        setTimeout(() => {
            document.getElementById('presentacion').value = producto.presentacion || '';
            document.getElementById('ivaTipo').value = producto.iva !== undefined ? producto.iva : 16;
            if (producto.ventaPor) {
                document.getElementById('ventaPorUnd').checked = producto.ventaPor.und || false;
                document.getElementById('ventaPorPaq').checked = producto.ventaPor.paq || false;
                document.getElementById('ventaPorCj').checked = producto.ventaPor.cj || false;
            } else { document.getElementById('ventaPorUnd').checked = true; }
            updateDynInputs(); // Generar inputs antes de llenarlos
            const undPaqInput = document.getElementById('unidadesPorPaquete');
            if (undPaqInput && producto.ventaPor?.paq) undPaqInput.value = producto.unidadesPorPaquete || 1;
            const undCjInput = document.getElementById('unidadesPorCaja');
            if (undCjInput && producto.ventaPor?.cj) undCjInput.value = producto.unidadesPorCaja || 1;
            const pExist = producto.precios || { und: producto.precioPorUnidad || 0 };
            const pUndInput = document.getElementById('precioUnd'); if (pUndInput) pUndInput.value = pExist.und || 0;
            const pPaqInput = document.getElementById('precioPaq'); if (pPaqInput) pPaqInput.value = pExist.paq || 0;
            const pCjInput = document.getElementById('precioCj'); if (pCjInput) pCjInput.value = pExist.cj || 0;
            if (producto.manejaVacios) {
                 mVacioCheck.checked = true; tVacioCont.classList.remove('hidden'); tVacioSel.required = true; tVacioSel.value = producto.tipoVacio || '';
             } else { mVacioCheck.checked = false; tVacioCont.classList.add('hidden'); tVacioSel.required = false; }
        }, 300);
        document.getElementById('editProductoForm').addEventListener('submit', (e) => handleUpdateProducto(e, productId));
        document.getElementById('backToModifyDeleteBtn').addEventListener('click', showModifyDeleteView);
    };

    async function handleUpdateProducto(e, productId) {
        e.preventDefault();
        if (_userRole !== 'admin') return;
        const updatedData = getProductoDataFromForm(true);
        const productoOriginal = _inventarioCache.find(p => p.id === productId);
        if (!productoOriginal) { _showModal('Error', 'Producto original no encontrado.'); return; }
        if (!updatedData.rubro || !updatedData.segmento || !updatedData.marca || !updatedData.presentacion) { _showModal('Error', 'Completa campos requeridos.'); return; }
        if (!updatedData.ventaPor.und && !updatedData.ventaPor.paq && !updatedData.ventaPor.cj) { _showModal('Error', 'Selecciona forma de venta.'); return; }
        if (updatedData.manejaVacios && !updatedData.tipoVacio) { _showModal('Error', 'Si maneja vacío, selecciona tipo.'); document.getElementById('tipoVacioSelect')?.focus(); return; }
        let pValido = (updatedData.ventaPor.und && updatedData.precios.und > 0) || (updatedData.ventaPor.paq && updatedData.precios.paq > 0) || (updatedData.ventaPor.cj && updatedData.precios.cj > 0);
        if (!pValido) { _showModal('Error', 'Ingresa al menos un precio > 0.'); document.querySelector('#preciosContainer input[required]')?.focus(); return; }
        updatedData.cantidadUnidades = productoOriginal.cantidadUnidades || 0; // Conservar stock
        _showModal('Progreso', 'Guardando y propagando...');
        try {
            await _setDoc(_doc(_db, `artifacts/${_appId}/users/${_userId}/inventario`, productId), updatedData);
            if (window.adminModule?.propagateProductChange) {
                await window.adminModule.propagateProductChange(productId, updatedData);
            }
            _showModal('Éxito', 'Producto modificado.');
            showModifyDeleteView();
        } catch (err) { console.error("Error modificando:", err); _showModal('Error', `Error: ${err.message}`); }
    }

    function deleteProducto(productId) {
        if (_userRole !== 'admin') { _showModal('Acceso Denegado', 'Solo administradores.'); return; }
        const producto = _inventarioCache.find(p => p.id === productId);
        if (!producto) { _showModal('Error', 'Producto no encontrado.'); return; }
        _showModal('Confirmar Eliminación', `Eliminar "${producto.presentacion}"? Se propagará y es IRREVERSIBLE.`, async () => {
             _showModal('Progreso', `Eliminando "${producto.presentacion}"...`);
            try {
                await _deleteDoc(_doc(_db, `artifacts/${_appId}/users/${_userId}/inventario`, productId));
                if (window.adminModule?.propagateProductChange) {
                     _showModal('Progreso', `Propagando eliminación...`);
                    await window.adminModule.propagateProductChange(productId, null);
                }
                _showModal('Éxito', 'Producto eliminado.');
            } catch (e) { console.error("Error eliminando:", e); _showModal('Error', `Error: ${e.message}`); }
        }, 'Sí, Eliminar', null, true);
    };

    async function handleDeleteAllProductos() {
        if (_userRole !== 'admin') return;
        _showModal('Confirmación Extrema', `Eliminar TODOS los productos? Se propagará y es IRREVERSIBLE.`, async () => {
            _showModal('Progreso', 'Eliminando todos...');
            try {
                const collectionRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`);
                const snapshot = await _getDocs(collectionRef);
                if (snapshot.empty) { _showModal('Aviso', 'No hay productos.'); return; }
                const productIdsToDelete = snapshot.docs.map(doc => doc.id);
                const BATCH_LIMIT = 490;
                let batchAdmin = _writeBatch(_db); let adminOps = 0; let totalDeletedLocally = 0;
                for (const docSnap of snapshot.docs) { batchAdmin.delete(docSnap.ref); adminOps++; if (adminOps >= BATCH_LIMIT) { await batchAdmin.commit(); totalDeletedLocally += adminOps; batchAdmin = _writeBatch(_db); adminOps = 0; } }
                 if (adminOps > 0) { await batchAdmin.commit(); totalDeletedLocally += adminOps; }
                 _showModal('Progreso', `Productos eliminados localmente. Propagando...`);
                if (window.adminModule?.propagateProductChange) {
                     let propagationErrors = 0;
                     for (const productId of productIdsToDelete) { try { await window.adminModule.propagateProductChange(productId, null); } catch (propError) { console.error(`Error propagando ${productId}:`, propError); propagationErrors++; } }
                     _showModal(propagationErrors > 0 ? 'Advertencia' : 'Éxito', `Eliminados localmente.${propagationErrors > 0 ? ` ${propagationErrors} errores al propagar.` : ' Propagado.'}`);
                } else { _showModal('Advertencia', 'Eliminados localmente, propagación no disponible.'); }
            } catch (error) { console.error("Error eliminando todos:", error); _showModal('Error', `Error: ${error.message}`); }
        }, 'Sí, Eliminar Todos', null, true);
    }

    async function handleDeleteAllDatosMaestros() {
        if (_userRole !== 'admin') return;
        _showModal('Confirmar Borrado Datos Maestros', `Eliminar TODOS los Rubros, Segmentos, Marcas NO USADOS? Se propagará y es IRREVERSIBLE.`, async () => {
           _showModal('Progreso', 'Verificando uso...');
            try {
                const cols = ['rubros', 'segmentos', 'marcas'], itemsToDelete = { rubros: [], segmentos: [], marcas: [] }; let itemsInUse = [];
                 const invSnap = await _getDocs(_collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`));
                 const allProds = invSnap.docs.map(d => d.data());
                 for (const col of cols) {
                     const field = col === 'rubros' ? 'rubro' : (col === 'segmentos' ? 'segmento' : 'marca');
                     const catSnap = await _getDocs(_collection(_db, `artifacts/${_appId}/users/${_userId}/${col}`));
                     catSnap.docs.forEach(doc => {
                         const name = doc.data().name;
                         if (name && allProds.some(p => p[field] === name)) itemsInUse.push(`'${name}' (${col.slice(0,-1)})`);
                         else if (name) itemsToDelete[col].push({ id: doc.id, name: name });
                     });
                 }
                 if (itemsInUse.length > 0) { _showModal('Error', `En uso: ${itemsInUse.join(', ')}. Elimina/modifica productos primero.`); return; }
                 let totalToDelete = Object.values(itemsToDelete).reduce((sum, arr) => sum + arr.length, 0);
                 if (totalToDelete === 0) { _showModal('Aviso', 'No hay datos maestros no usados.'); return; }
                 _showModal('Confirmación Final', `Se eliminarán ${totalToDelete} datos no usados. Se propagará. ¿Continuar?`, async () => {
                     _showModal('Progreso', `Eliminando ${totalToDelete} datos...`);
                     const batchAdmin = _writeBatch(_db); let adminDelCount = 0;
                     for (const col in itemsToDelete) { itemsToDelete[col].forEach(item => { batchAdmin.delete(_doc(_db, `artifacts/${_appId}/users/${_userId}/${col}`, item.id)); adminDelCount++; }); }
                     await batchAdmin.commit();
                     _showModal('Progreso', `Datos eliminados localmente. Propagando...`);
                      if (window.adminModule?.propagateCategoryChange) {
                          let propErrors = 0;
                          for (const col in itemsToDelete) { for (const item of itemsToDelete[col]) { try { await window.adminModule.propagateCategoryChange(col, item.id, null); } catch (propErr) { console.error(`Error propagando ${col}/${item.id}:`, propErr); propErrors++; } } }
                          _showModal(propErrors > 0 ? 'Advertencia' : 'Éxito', `Eliminados localmente.${propErrors > 0 ? ` ${propErrors} errores al propagar.` : ' Propagado.'}`);
                      } else { _showModal('Advertencia', 'Eliminados localmente, propagación no disponible.'); }
                      invalidateSegmentOrderCache(); // Invalida caché por si se eliminaron segmentos
                 }, 'Sí, Eliminar No Usados', null, true);
            } catch (error) { console.error("Error eliminando datos maestros:", error); _showModal('Error', `Error: ${error.message}`); }
        }, 'Sí, Eliminar No Usados', null, true);
    }

    // Exportar funciones necesarias
    window.inventarioModule = {
        editProducto,
        deleteProducto,
        handleDeleteDataItem,
        showAddCategoryModal, // Referencia a la función (que ahora puede llamar a la global)
        // ELIMINADO: getSegmentoOrderMap ya no se exporta
        invalidateSegmentOrderCache // Exporta la función que llama a la global
    };

})();
