(function() {
    let _db, _userId, _userRole, _appId, _mainContent, _floatingControls, _activeListeners;
    let _showMainMenu, _showModal, _showAddItemModal, _populateDropdown;
    let _collection, _onSnapshot, _doc, _addDoc, _setDoc, _deleteDoc, _query, _where, _getDocs, _writeBatch;

    let _inventarioCache = [];
    let _lastFilters = { searchTerm: '', rubro: '', segmento: '', marca: '' };
    let _segmentoOrderCache = null;
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
            try {
                _inventarioListenerUnsubscribe();
            } catch(e) { console.warn("Error unsubscribing previous inventory listener:", e); }
        }
        const collectionRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`);
        _inventarioListenerUnsubscribe = _onSnapshot(collectionRef, (snapshot) => {
            _inventarioCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            if (callback && typeof callback === 'function') {
                 try {
                     callback();
                 } catch (cbError) {
                     console.error("Error executing inventory listener callback:", cbError);
                 }
            } else if (callback) {
                 console.warn("Inventory listener callback provided is not a function:", callback);
            }
        }, (error) => {
             // MODIFICACIÓN: Ignorar error de permisos al cerrar sesión
             if (window.isLoggingOut && error.code === 'permission-denied') {
                 console.log("Listener de inventario detenido por cierre de sesión (ignorado).");
                 return; // Ignorar el error silenciosamente
             }
             console.error("Error en listener de inventario:", error);
             // Evitar mostrar modal si el error es 'cancelled' o si es 'permission-denied' durante logout
             if (error.code !== 'cancelled') {
                 _showModal('Error de Conexión', 'No se pudo actualizar el inventario en tiempo real. Revisa tu conexión.');
             }
        });
        _activeListeners.push(_inventarioListenerUnsubscribe);
    }


    function invalidateSegmentOrderCache() {
        _segmentoOrderCache = null;
        if (window.ventasModule?.invalidateCache) window.ventasModule.invalidateCache();
        if (window.catalogoModule?.invalidateCache) window.catalogoModule.invalidateCache();
    }

    window.showInventarioSubMenu = function() {
        invalidateSegmentOrderCache();
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
            document.getElementById('ordenarSegmentosBtn')?.addEventListener('click', showOrdenarSegmentosView);
            document.getElementById('modificarDatosBtn')?.addEventListener('click', showModificarDatosView);
        }
        document.getElementById('ajusteMasivoBtn').addEventListener('click', showAjusteMasivoView);
        document.getElementById('backToMenuBtn').addEventListener('click', _showMainMenu);
    }

    async function getSegmentoOrderMap() {
        if (_segmentoOrderCache) return _segmentoOrderCache;
        const map = {};
        const segmentosRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/segmentos`);
        try {
            const snapshot = await _getDocs(segmentosRef);
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                map[data.name] = (data.orden !== undefined && data.orden !== null) ? data.orden : 9999;
            });
            _segmentoOrderCache = map;
            return map;
        } catch (e) {
            console.warn("No se pudo obtener el orden de los segmentos.", e);
            return {};
        }
    }

    function showOrdenarSegmentosView() {
        if (_userRole !== 'admin') {
            _showModal('Acceso Denegado', 'Solo los administradores pueden ordenar segmentos.');
            return;
        }
        if (_floatingControls) _floatingControls.classList.add('hidden');
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto max-w-lg">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl">
                        <h2 class="text-2xl font-bold text-gray-800 mb-4 text-center">Ordenar Segmentos (Visualización)</h2>
                        <p class="text-center text-gray-600 mb-6">Arrastra y suelta los segmentos para cambiar el orden. Este orden se propagará.</p>
                        <div class="mb-4">
                           <label for="ordenarRubroFilter" class="block text-gray-700 font-medium mb-2">Filtrar por Rubro (Opcional):</label>
                           <select id="ordenarRubroFilter" class="w-full px-4 py-2 border rounded-lg">
                               <option value="">Todos los Segmentos</option>
                           </select>
                        </div>
                        <ul id="segmentos-sortable-list" class="space-y-2 border rounded-lg p-4 max-h-96 overflow-y-auto bg-gray-50">
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
                 console.log('Assigning initial order to new segments...');
                const segmentsWithOrder = allSegments.filter(s => s.orden !== undefined && s.orden !== null);
                const maxOrder = segmentsWithOrder.reduce((max, s) => Math.max(max, s.orden ?? -1), -1);
                const batch = _writeBatch(_db);
                segmentsWithoutOrder.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
                segmentsWithoutOrder.forEach((seg, index) => {
                    const docRef = _doc(segmentosRef, seg.id);
                    const newOrder = maxOrder + 1 + index;
                    batch.update(docRef, { orden: newOrder });
                    seg.orden = newOrder; // Update local object as well
                });
                await batch.commit();
                allSegments = [...segmentsWithOrder, ...segmentsWithoutOrder]; // Rebuild the list with updated orders
                console.log("Initial order assigned to new segments.");
            }

            let segmentsToDisplay = allSegments;
            if (rubro) {
                // Filter segments based on products in the selected rubro
                const inventarioRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`);
                const q = _query(inventarioRef, _where("rubro", "==", rubro));
                const inventarioSnapshot = await _getDocs(q);
                const usedSegmentNames = new Set(inventarioSnapshot.docs.map(doc => doc.data().segmento).filter(Boolean));
                segmentsToDisplay = allSegments.filter(s => s.name && usedSegmentNames.has(s.name));
            }

            segmentsToDisplay.sort((a, b) => (a.orden ?? 9999) - (b.orden ?? 9999));

            container.innerHTML = ''; // Clear loading message
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
            console.error("Error al renderizar la lista de segmentos:", error);
            container.innerHTML = `<p class="text-red-500 text-center">Error al cargar los segmentos.</p>`;
        }
    }


    function addDragAndDropHandlers(container) {
        let draggedItem = null;
        let placeholder = null;
        // Function to create or reuse the placeholder
        const createPlaceholder = () => {
             if (!placeholder) {
                 placeholder = document.createElement('li');
                 placeholder.style.height = '40px'; // Example height, adjust as needed
                 placeholder.style.background = '#e0e7ff'; // Light blue background
                 placeholder.style.border = '2px dashed #6366f1'; // Indigo dashed border
                 placeholder.style.borderRadius = '0.375rem'; // Rounded corners
                 placeholder.style.margin = '0.5rem 0'; // Vertical margin
                 placeholder.style.listStyleType = 'none'; // No bullet point
             }
        };
        createPlaceholder(); // Create it initially

        container.addEventListener('dragstart', e => {
             if (e.target.tagName === 'LI') {
                 draggedItem = e.target;
                 // Slight delay to allow the browser to create the drag image
                 setTimeout(() => {
                     if (draggedItem) { // Check if drag wasn't cancelled immediately
                         draggedItem.style.opacity = '0.5';
                         draggedItem.style.border = '2px dashed gray'; // Indicate dragging
                     }
                 }, 0);
                 e.dataTransfer.effectAllowed = 'move';
                 e.dataTransfer.setData('text/plain', draggedItem.dataset.id); // Set data (optional but good practice)
             } else {
                 e.preventDefault(); // Prevent dragging unintended elements
             }
        });

        container.addEventListener('dragend', e => {
             if (draggedItem) {
                 // Restore appearance
                 draggedItem.style.opacity = '1';
                 draggedItem.style.border = '';
             }
             draggedItem = null;
             // Remove placeholder if it's still in the DOM
             if (placeholder && placeholder.parentNode) {
                 placeholder.parentNode.removeChild(placeholder);
             }
        });

        container.addEventListener('dragover', e => {
             e.preventDefault(); // Necessary to allow dropping
             e.dataTransfer.dropEffect = 'move';
             // Find the element the dragged item should appear after
             const afterElement = getDragAfterElement(container, e.clientY);
             // Insert the placeholder
             if (afterElement) {
                 container.insertBefore(placeholder, afterElement);
             } else {
                 container.appendChild(placeholder); // Append if dragging to the end
             }
        });

        container.addEventListener('drop', e => {
              e.preventDefault(); // Prevent default browser behavior (like opening link)
              // Insert the dragged item before the placeholder
              if (draggedItem && placeholder && placeholder.parentNode) {
                  container.insertBefore(draggedItem, placeholder);
                  // Restore appearance immediately after drop
                  draggedItem.style.opacity = '1';
                  draggedItem.style.border = '';
              }
              // Clean up placeholder
              if (placeholder && placeholder.parentNode) {
                  placeholder.parentNode.removeChild(placeholder);
              }
              draggedItem = null; // Reset dragged item
        });

         // Clean up placeholder if drag leaves the container entirely
        container.addEventListener('dragleave', e => {
              // Check if the relatedTarget (where the mouse moved to) is outside the container
              if (!container.contains(e.relatedTarget) && placeholder && placeholder.parentNode) {
                  placeholder.parentNode.removeChild(placeholder);
              }
        });

        // Helper function to determine where to insert the placeholder
        function getDragAfterElement(container, y) {
             // Get all list items currently in the container, excluding the placeholder itself and the item being dragged
             const draggableElements = [...container.querySelectorAll('li:not([style*="height: 40px"])')].filter(el => el !== draggedItem);

             // Find the element whose center is closest below the mouse position
             return draggableElements.reduce((closest, child) => {
                 const box = child.getBoundingClientRect();
                 const offset = y - box.top - box.height / 2;
                 // If the offset is negative (mouse is above the center) and closer than the previous closest
                 if (offset < 0 && offset > closest.offset) {
                     return { offset: offset, element: child };
                 } else {
                     return closest;
                 }
             }, { offset: Number.NEGATIVE_INFINITY }).element; // Start with negative infinity offset
        }
    }


    async function handleGuardarOrdenSegmentos() {
        if (_userRole !== 'admin') return;
        const listItems = document.querySelectorAll('#segmentos-sortable-list li');
        if (listItems.length === 0) {
             const noSegmentsMsg = document.querySelector('#segmentos-sortable-list p');
             _showModal('Aviso', noSegmentsMsg?.textContent.includes('No hay segmentos') ? 'No hay segmentos visibles para guardar orden.' : 'Lista de segmentos no cargada o vacía.');
            return;
        }

        const batch = _writeBatch(_db);
        const orderedIds = [];
        let hasChanges = false;
        const currentOrderMap = await getSegmentoOrderMap(); // Get current order before loop

        listItems.forEach((item, index) => {
            const docId = item.dataset.id;
            const docRef = _doc(_db, `artifacts/${_appId}/users/${_userId}/segmentos`, docId);
            const segmentName = item.dataset.name;
             // Get the order this item currently has in the DB (or assume a high number if new)
             const currentDbOrder = currentOrderMap[segmentName] ?? 9999;
             // Only update if the new index is different from the DB order
             if (currentDbOrder !== index) {
                 batch.update(docRef, { orden: index });
                 hasChanges = true;
             }
            orderedIds.push(docId); // Keep track of the final order of IDs
        });

         if (!hasChanges) {
             _showModal('Aviso', 'No se detectaron cambios en el orden.');
             return;
         }

        _showModal('Progreso', 'Guardando nuevo orden para admin...');

        try {
            await batch.commit();
            invalidateSegmentOrderCache(); // Invalidate admin's cache
            // MODIFICACIÓN: Invalidar caché del catálogo
             if (window.catalogoModule?.invalidateCache) {
                 window.catalogoModule.invalidateCache();
                 console.log("Catálogo cache invalidada desde Inventario.");
             }

             // Propagate order change to other users if function exists
             if (window.adminModule?.propagateCategoryOrderChange) {
                  _showModal('Progreso', 'Propagando orden a otros usuarios...');
                 await window.adminModule.propagateCategoryOrderChange('segmentos', orderedIds);
             } else {
                  console.warn("Función propagateCategoryOrderChange no encontrada.");
                  _showModal('Advertencia', 'Orden guardado localmente, no se pudo propagar.');
             }

            _showModal('Éxito', 'Orden de segmentos guardado y propagado.');
            showInventarioSubMenu(); // Go back after success
        } catch (error) {
            console.error("Error guardando/propagando orden de segmentos:", error);
            _showModal('Error', `Error al guardar orden: ${error.message}`);
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
        _populateDropdown(`artifacts/${_appId}/users/${_userId}/rubros`, 'ajuste-filter-rubro', 'Rubro');
        setupFiltros('ajuste', renderCallback);
        startMainInventarioListener(renderCallback); // Start listener, render on first load and updates
    }


    async function renderAjusteMasivoList() {
        const container = document.getElementById('ajusteListContainer');
        if (!container) return;
        // Filter products based on current _lastFilters
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

        // Sort products
        const segmentoOrderMap = await getSegmentoOrderMap();
        productos.sort((a, b) => {
             const orderA = segmentoOrderMap[a.segmento] ?? 9999;
             const orderB = segmentoOrderMap[b.segmento] ?? 9999;
             if (orderA !== orderB) return orderA - orderB;
             const marcaComp = (a.marca || '').localeCompare(b.marca || '');
             if (marcaComp !== 0) return marcaComp;
             return (a.presentacion || '').localeCompare(b.presentacion || '');
        });

        // Render the list
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
            // Add segment header row if it changed
            if (segmento !== currentSegmento) {
                 currentSegmento = segmento;
                 currentMarca = null; // Reset marca when segmento changes
                 // Sticky header for segment, ensure z-index is lower than the main header
                 tableHTML += `<tr><td colspan="2" class="py-2 px-4 bg-gray-300 font-bold text-gray-800 sticky top-[calc(theme(height.10))] z-[9]">${currentSegmento}</td></tr>`;
            }
            // Add marca header row if it changed
            if (marca !== currentMarca) {
                 currentMarca = marca;
                 // Non-sticky header for marca
                 tableHTML += `<tr><td colspan="2" class="py-2 px-4 bg-gray-100 font-semibold text-gray-700 pl-8">${currentMarca}</td></tr>`;
            }

            // Determine display unit and conversion factor
            const ventaPor = p.ventaPor || { und: true };
            let unitType = 'Und';
            let conversionFactor = 1;
            let currentStockInUnits = p.cantidadUnidades || 0;

            if (ventaPor.cj) { unitType = 'Cj'; conversionFactor = p.unidadesPorCaja || 1; }
            else if (ventaPor.paq) { unitType = 'Paq'; conversionFactor = p.unidadesPorPaquete || 1; }
            conversionFactor = Math.max(1, conversionFactor); // Ensure factor is at least 1

            const currentStockInDisplayUnits = Math.floor(currentStockInUnits / conversionFactor);

            // Add product row
            tableHTML += `
                <tr class="hover:bg-gray-50">
                    <td class="py-2 px-4 border-b pl-12">
                        <p class="font-medium">${p.presentacion}</p>
                        <p class="text-xs text-gray-500">Actual: ${currentStockInDisplayUnits} ${unitType}. (${currentStockInUnits} Und. base)</p>
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
             const container = document.getElementById('ajusteListContainer');
             _showModal('Aviso', container?.textContent.includes('No hay productos') ? 'No hay productos que coincidan.' : 'Lista no cargada o vacía.');
            return;
        }

        const batch = _writeBatch(_db);
        let changesCount = 0;
        let invalidValues = false;

        // Clear previous validation styles
        inputs.forEach(input => input.classList.remove('border-red-500', 'ring-1', 'ring-red-500'));

        inputs.forEach(input => {
            const docId = input.dataset.docId;
            const conversionFactor = parseInt(input.dataset.conversionFactor, 10) || 1;
            const newValueInDisplayUnitsStr = input.value.trim();
            const newValueInDisplayUnits = parseInt(newValueInDisplayUnitsStr, 10);
            const productoOriginal = _inventarioCache.find(p => p.id === docId);

            // Validate input: must be a non-empty, non-negative integer
            if (newValueInDisplayUnitsStr === '' || isNaN(newValueInDisplayUnits) || !Number.isInteger(newValueInDisplayUnits) || newValueInDisplayUnits < 0) {
                 // Mark as invalid only if it's not empty (allow empty as no-change)
                 if (newValueInDisplayUnitsStr !== '') {
                     input.classList.add('border-red-500', 'ring-1', 'ring-red-500');
                     invalidValues = true;
                 }
                 return; // Skip this input if invalid or empty
            }

            if (productoOriginal) {
                const nuevaCantidadUnidades = newValueInDisplayUnits * conversionFactor;
                // Add to batch only if the base unit quantity has changed
                if ((productoOriginal.cantidadUnidades || 0) !== nuevaCantidadUnidades) {
                    const docRef = _doc(_db, `artifacts/${_appId}/users/${_userId}/inventario`, docId);
                    batch.update(docRef, { cantidadUnidades: nuevaCantidadUnidades });
                    changesCount++;
                     console.log(`Updating ${productoOriginal.presentacion} to ${nuevaCantidadUnidades} units.`);
                }
            } else {
                 console.warn(`Producto no encontrado en caché para ID: ${docId}. No se puede actualizar.`);
            }
        });

        if (invalidValues) {
             _showModal('Error de Entrada', 'Se encontraron valores inválidos (no enteros o negativos) en los campos de cantidad. Por favor, corrígelos.');
             return; // Stop if any input is invalid
        }

        if (changesCount === 0) {
            _showModal('Aviso', 'No se detectaron cambios en las cantidades.');
            return; // Stop if no changes were made
        }

        _showModal('Confirmar Cambios', `Se actualizará la cantidad base de ${changesCount} producto(s). ¿Continuar?`, async () => {
             _showModal('Progreso', 'Guardando cambios...'); // Show progress
            try {
                await batch.commit();
                _showModal('Éxito', 'Las cantidades se actualizaron correctamente.');
                 // No need to manually refresh, listener will update the view
            } catch (error) {
                console.error("Error al guardar ajuste masivo:", error);
                _showModal('Error', `Error al guardar los cambios: ${error.message}`);
            }
        }, 'Sí, Actualizar', null, true); // Trigger confirm logic
    }


    function showModificarDatosView() {
        if (_userRole !== 'admin') {
            _showModal('Acceso Denegado', 'Solo los administradores pueden modificar datos maestros.');
            return;
        }
        if (_floatingControls) _floatingControls.classList.add('hidden');
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl">
                        <h2 class="text-2xl font-bold text-gray-800 mb-6 text-center">Modificar Datos Maestros</h2>
                        <p class="text-sm text-center text-gray-600 mb-6">Gestiona las categorías globales (Rubros, Segmentos, Marcas). Los cambios aquí se propagan a todos los usuarios. La eliminación solo es posible si la categoría no está en uso por ningún producto.</p>
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
                            <button id="backToInventarioBtn" class="w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver</button>
                            <button id="deleteAllDatosMaestrosBtn" class="w-full px-6 py-3 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700">Eliminar Todos los Datos Maestros</button>
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
        container.innerHTML = `<p class="text-gray-500 text-sm p-2">Cargando ${itemName.toLowerCase()}s...</p>`;

        const collectionRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/${collectionName}`);
        const unsubscribe = _onSnapshot(collectionRef, (snapshot) => {
            // Sort items alphabetically by name
            const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            if (items.length === 0) {
                container.innerHTML = `<p class="text-gray-500 text-sm p-2">No hay ${itemName.toLowerCase()}s definidos.</p>`;
                return;
            }
            // Generate list items with delete button
            container.innerHTML = items.map(item => `
                <div class="flex justify-between items-center bg-white p-2 rounded shadow-sm border border-gray-200">
                    <span class="text-gray-800 text-sm flex-grow mr-2">${item.name}</span>
                    <div class="flex-shrink-0 space-x-1">
                        <button onclick="window.inventarioModule.handleDeleteDataItem('${collectionName}', '${item.name}', '${itemName}', '${item.id}')" class="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600" title="Eliminar">X</button>
                    </div>
                </div>
            `).join('');
        }, (error) => {
             // MODIFICACIÓN: Ignorar error de permisos al cerrar sesión
             if (window.isLoggingOut && error.code === 'permission-denied') {
                 console.log(`Listener de ${collectionName} detenido por cierre de sesión (ignorado).`);
                 return; // Ignorar el error silenciosamente
             }
             console.error(`Error en listener de ${collectionName}:`, error);
             container.innerHTML = `<p class="text-red-500 text-center p-2">Error al cargar ${itemName.toLowerCase()}s.</p>`;
        });
        _activeListeners.push(unsubscribe); // Add listener to global array
    }


    function showAddCategoryModal(collectionName, itemName) {
        if (_userRole !== 'admin') return;
        _showModal(
            `Agregar Nuevo ${itemName}`,
            `<form id="addCategoryForm" class="space-y-4">
                <input type="text" id="newCategoryName" placeholder="Nombre del ${itemName}" class="w-full px-4 py-2 border rounded-lg" required>
                <p id="addCategoryMessage" class="text-sm text-red-600 h-4"></p> <!-- Error message area -->
            </form>`,
            async () => { // onConfirm logic (returns true on success, false on failure/validation error)
                const input = document.getElementById('newCategoryName');
                const messageP = document.getElementById('addCategoryMessage');
                const newName = input.value.trim();
                messageP.textContent = ''; // Clear previous message

                if (!newName) {
                    messageP.textContent = 'El nombre no puede estar vacío.';
                    input.focus();
                    return false; // Prevent modal close on validation error
                }
                const newNameUpper = newName.toUpperCase();

                try {
                    const collectionRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/${collectionName}`);
                    // Check if name already exists (case-insensitive check needed usually, but Firestore query helps)
                    const q = _query(collectionRef, _where("name", "==", newNameUpper));
                    const querySnapshot = await _getDocs(q);
                    if (!querySnapshot.empty) {
                        messageP.textContent = `"${newName}" ya existe. Por favor, elige otro nombre.`;
                        input.select();
                        return false; // Prevent modal close
                    }

                    // Prepare new item data
                    const newItemData = { name: newNameUpper };
                    // If adding a segment, assign the next available order number
                     if (collectionName === 'segmentos') {
                         const currentSegmentsSnapshot = await _getDocs(collectionRef);
                         const maxOrder = currentSegmentsSnapshot.docs.reduce((max, doc) => Math.max(max, doc.data().orden ?? -1), -1);
                         newItemData.orden = maxOrder + 1;
                     }

                    // Add the new item for the admin
                    const docRef = await _addDoc(collectionRef, newItemData);

                    // Propagate the change to other users
                    if (window.adminModule?.propagateCategoryChange) {
                         console.log('Propagating new category...');
                        await window.adminModule.propagateCategoryChange(collectionName, docRef.id, newItemData);
                         console.log(`"${newNameUpper}" added and propagated.`);
                    } else {
                         console.log(`"${newNameUpper}" added locally (propagation function not found).`);
                    }

                     // Invalidate segment order cache if a segment was added
                     if (collectionName === 'segmentos') invalidateSegmentOrderCache();

                    return true; // Indicate success, modal will close
                } catch (err) {
                    console.error(`Error al agregar ${itemName}:`, err);
                    messageP.textContent = 'Error al guardar. Inténtalo de nuevo.';
                    return false; // Prevent modal close on error
                }
            },
            'Guardar y Propagar', // confirmText
             () => {}, // onCancel (no action needed)
             true // triggerConfirmLogic = true (use async logic, handle errors)
        );
         // Auto-focus the input after modal appears
         setTimeout(() => document.getElementById('newCategoryName')?.focus(), 50);
    }


    async function handleDeleteDataItem(collectionName, itemName, itemType, itemId) {
        if (_userRole !== 'admin') {
            _showModal('Acceso Denegado', 'Solo los administradores pueden eliminar datos maestros.');
            return;
        }
        // Map collection name to the corresponding field name in the 'inventario' collection
        const fieldMap = { rubros: 'rubro', segmentos: 'segmento', marcas: 'marca' };
        const fieldName = fieldMap[collectionName];
        if (!fieldName) { _showModal('Error Interno', 'Tipo de dato maestro no reconocido.'); return; }

        console.log(`Verifying usage of "${itemName}" in inventory...`);
        _showModal('Progreso', `Verificando si "${itemName}" está en uso...`); // Show progress

        const inventarioRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`);
        const q = _query(inventarioRef, _where(fieldName, "==", itemName)); // Query for usage

        try {
            const usageSnapshot = await _getDocs(q);
            // Check if the item is in use
            if (!usageSnapshot.empty) {
                _showModal('Error al Eliminar', `"${itemName}" está en uso por ${usageSnapshot.size} producto(s) en tu inventario. No se puede eliminar.`);
                return; // Stop deletion if in use
            }

            // If not in use, confirm deletion
            _showModal('Confirmar Eliminación', `¿Estás seguro de eliminar el ${itemType} "${itemName}"? Esta acción se propagará a todos los usuarios y es IRREVERSIBLE.`, async () => {
                console.log(`Deleting "${itemName}" for admin...`);
                 _showModal('Progreso', `Eliminando "${itemName}" y propagando...`); // Show progress during deletion/propagation
                 try {
                     // Delete the item for the admin
                     await _deleteDoc(_doc(_db, `artifacts/${_appId}/users/${_userId}/${collectionName}`, itemId));

                     // Propagate the deletion to other users
                     if (window.adminModule?.propagateCategoryChange) {
                          console.log('Propagating deletion...');
                         await window.adminModule.propagateCategoryChange(collectionName, itemId, null); // Pass null data for deletion
                         console.log(`${itemType} "${itemName}" deleted and propagated.`);
                     } else {
                          console.warn('Deleted locally, but propagation function not found.');
                     }
                     // Invalidate segment cache if a segment was deleted
                     if (collectionName === 'segmentos') invalidateSegmentOrderCache();

                     _showModal('Éxito', `${itemType} "${itemName}" eliminado correctamente.`);
                 } catch (deleteError) {
                      console.error(`Error al eliminar/propagar ${itemName}:`, deleteError);
                      _showModal('Error', `Error durante el proceso de eliminación: ${deleteError.message}`);
                 }
            }, 'Sí, Eliminar', null, true); // Trigger confirm logic

        } catch (error) {
             console.error(`Error verifying usage for ${itemName}:`, error);
            _showModal('Error', `Error al verificar si el ${itemType} está en uso: ${error.message}`);
        }
    }


    function showAgregarProductoView() {
        if (_userRole !== 'admin') { _showModal('Acceso Denegado', 'Solo los administradores pueden agregar productos.'); return; }
        if (_floatingControls) _floatingControls.classList.add('hidden');
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto max-w-2xl">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl text-center">
                        <h2 class="text-2xl font-bold text-gray-800 mb-6">Agregar Producto</h2>
                        <form id="productoForm" class="space-y-4 text-left">
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
                            <div class="border-t pt-4 mt-4">
                                <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                    <div>
                                        <label class="block text-gray-700 font-medium mb-2">Venta por:</label>
                                        <div id="ventaPorContainer" class="flex items-center space-x-4">
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
                                                 <option value="">Seleccione...</option>
                                                 <option value="1/4 - 1/3">1/4 - 1/3</option>
                                                 <option value="ret 350 ml">Retornable 350 ml</option>
                                                 <option value="ret 1.25 Lts">Retornable 1.25 Lts</option>
                                             </select>
                                         </div>
                                     </div>
                                </div>
                                <div id="empaquesContainer" class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4"></div>
                                <div id="preciosContainer" class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4"></div>
                            </div>
                            <div class="border-t pt-4 mt-4">
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                         <label class="block text-gray-700 font-medium mb-1">Cantidad Inicial:</label>
                                         <input type="number" id="cantidadInicial" value="0" class="w-full px-4 py-2 border rounded-lg bg-gray-100" readonly>
                                         <p class="text-xs text-gray-500 mt-1">Siempre 0. Ajustar luego si es necesario.</p>
                                    </div>
                                    <div>
                                        <label for="ivaTipo" class="block text-gray-700 font-medium mb-1">Tipo de IVA:</label>
                                        <select id="ivaTipo" class="w-full px-4 py-2 border rounded-lg" required>
                                            <option value="16" selected>IVA 16%</option>
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

        _populateDropdown(`artifacts/${_appId}/users/${_userId}/rubros`, 'rubro', 'Rubro');
        _populateDropdown(`artifacts/${_appId}/users/${_userId}/segmentos`, 'segmento', 'Segmento');
        _populateDropdown(`artifacts/${_appId}/users/${_userId}/marcas`, 'marca', 'Marca');

        const ventaPorContainer = document.getElementById('ventaPorContainer');
        const preciosContainer = document.getElementById('preciosContainer');
        const empaquesContainer = document.getElementById('empaquesContainer');
        const manejaVaciosCheck = document.getElementById('manejaVaciosCheck');
        const tipoVacioContainer = document.getElementById('tipoVacioContainer');
        const tipoVacioSelect = document.getElementById('tipoVacioSelect');

        // Function to update dynamic inputs based on 'Venta por' checkboxes
        const updateDynamicInputs = () => {
             empaquesContainer.innerHTML = '';
             preciosContainer.innerHTML = '';
             const ventaPorUnd = document.getElementById('ventaPorUnd').checked;
             const ventaPorPaq = document.getElementById('ventaPorPaq').checked;
             const ventaPorCj = document.getElementById('ventaPorCj').checked;

             // Add inputs for package/box units if checked
             if (ventaPorPaq) empaquesContainer.innerHTML += `<div><label class="block text-sm font-medium">Unidades por Paquete:</label><input type="number" id="unidadesPorPaquete" min="1" step="1" class="w-full px-2 py-1 border rounded" value="1" required></div>`;
             if (ventaPorCj) empaquesContainer.innerHTML += `<div><label class="block text-sm font-medium">Unidades por Caja:</label><input type="number" id="unidadesPorCaja" min="1" step="1" class="w-full px-2 py-1 border rounded" value="1" required></div>`;

             // Add inputs for prices based on checked boxes
             if (ventaPorUnd) preciosContainer.innerHTML += `<div><label class="block text-sm font-medium">Precio por Und.</label><input type="number" step="0.01" min="0" id="precioUnd" class="w-full px-2 py-1 border rounded" required></div>`;
             if (ventaPorPaq) preciosContainer.innerHTML += `<div><label class="block text-sm font-medium">Precio por Paq.</label><input type="number" step="0.01" min="0" id="precioPaq" class="w-full px-2 py-1 border rounded" required></div>`;
             if (ventaPorCj) preciosContainer.innerHTML += `<div><label class="block text-sm font-medium">Precio por Cj.</label><input type="number" step="0.01" min="0" id="precioCj" class="w-full px-2 py-1 border rounded" required></div>`;

             // Make price inputs required only if their corresponding checkbox is checked
             preciosContainer.querySelectorAll('input').forEach(input => {
                 input.required = document.getElementById(`ventaPor${input.id.substring(6)}`)?.checked ?? false;
             });
        };
        // Show/hide and require 'Tipo de Vacío' based on 'Maneja Vacío' checkbox
        manejaVaciosCheck.addEventListener('change', () => {
             if (manejaVaciosCheck.checked) {
                 tipoVacioContainer.classList.remove('hidden');
                 tipoVacioSelect.required = true;
             } else {
                 tipoVacioContainer.classList.add('hidden');
                 tipoVacioSelect.required = false;
                 tipoVacioSelect.value = ''; // Reset selection
             }
        });
        // Update dynamic inputs when 'Venta por' changes
        ventaPorContainer.addEventListener('change', updateDynamicInputs);
        updateDynamicInputs(); // Initial call to set up the form
        document.getElementById('productoForm').addEventListener('submit', agregarProducto);
        document.getElementById('backToInventarioBtn').addEventListener('click', showInventarioSubMenu);
    }


    function getProductoDataFromForm(isEditing = false) {
        // Get unit conversion factors, default to 1 if not present or invalid
        const unidadesPorPaqueteInput = document.getElementById('unidadesPorPaquete');
        const unidadesPorCajaInput = document.getElementById('unidadesPorCaja');
        const unidadesPorPaquete = Math.max(1, unidadesPorPaqueteInput ? (parseInt(unidadesPorPaqueteInput.value, 10) || 1) : 1);
        const unidadesPorCaja = Math.max(1, unidadesPorCajaInput ? (parseInt(unidadesPorCajaInput.value, 10) || 1) : 1);

        // Get prices, default to 0 if not present or invalid
        const precioUndInput = document.getElementById('precioUnd');
        const precioPaqInput = document.getElementById('precioPaq');
        const precioCjInput = document.getElementById('precioCj');
        const precios = {
            und: Math.max(0, precioUndInput ? (parseFloat(precioUndInput.value) || 0) : 0),
            paq: Math.max(0, precioPaqInput ? (parseFloat(precioPaqInput.value) || 0) : 0),
            cj: Math.max(0, precioCjInput ? (parseFloat(precioCjInput.value) || 0) : 0),
        };

        // Calculate base price per unit (used for sorting/display maybe?)
        let precioFinalPorUnidad = 0;
        if (precios.und > 0) { precioFinalPorUnidad = precios.und; }
        else if (precios.paq > 0 && unidadesPorPaquete > 0) { precioFinalPorUnidad = precios.paq / unidadesPorPaquete; }
        else if (precios.cj > 0 && unidadesPorCaja > 0) { precioFinalPorUnidad = precios.cj / unidadesPorCaja; }
        precioFinalPorUnidad = parseFloat(precioFinalPorUnidad.toFixed(2)); // Round to 2 decimal places

        // Get quantity (only relevant when editing, otherwise default to 0)
        let cantidadTotalUnidades;
        if (isEditing) {
             const cantidadActualInput = document.getElementById('cantidadActual'); // Assuming this ID exists in edit view
             cantidadTotalUnidades = cantidadActualInput ? (parseInt(cantidadActualInput.value, 10) || 0) : 0;
        } else {
            cantidadTotalUnidades = 0; // Always 0 for new products
        }

        // Get 'manejaVacios' status and 'tipoVacio'
        const manejaVaciosChecked = document.getElementById('manejaVaciosCheck').checked;
        const tipoVacioSelected = document.getElementById('tipoVacioSelect').value;

        // Return structured product data
        return {
            rubro: document.getElementById('rubro').value,
            segmento: document.getElementById('segmento').value,
            marca: document.getElementById('marca').value,
            presentacion: document.getElementById('presentacion').value.trim(),
            unidadesPorPaquete: unidadesPorPaquete,
            unidadesPorCaja: unidadesPorCaja,
            ventaPor: {
                und: document.getElementById('ventaPorUnd').checked,
                paq: document.getElementById('ventaPorPaq').checked,
                cj: document.getElementById('ventaPorCj').checked,
            },
            manejaVacios: manejaVaciosChecked,
            tipoVacio: manejaVaciosChecked ? tipoVacioSelected : null, // Store null if not applicable
            precios: precios,
            precioPorUnidad: precioFinalPorUnidad,
            cantidadUnidades: cantidadTotalUnidades, // Initial quantity is 0 for new, fetched for edit
            iva: parseInt(document.getElementById('ivaTipo').value, 10)
        };
    }

    async function agregarProducto(e) {
        e.preventDefault();
        if (_userRole !== 'admin') return; // Double check role

        const productoData = getProductoDataFromForm(false); // Get data for a new product

        // --- VALIDATIONS ---
        if (!productoData.rubro || !productoData.segmento || !productoData.marca || !productoData.presentacion) {
             _showModal('Error', 'Completa los campos: Rubro, Segmento, Marca y Presentación.');
             return;
        }
        if (!productoData.ventaPor.und && !productoData.ventaPor.paq && !productoData.ventaPor.cj) {
            _showModal('Error', 'Debes seleccionar al menos una forma de venta (Und, Paq, Cj).');
            return;
        }
        if (productoData.manejaVacios && !productoData.tipoVacio) {
            _showModal('Error', 'Si el producto maneja vacío, debes seleccionar el Tipo de Vacío.');
            document.getElementById('tipoVacioSelect')?.focus(); // Focus the select element
            return;
        }
        // Check if at least one valid price (> 0) is entered for the selected sale types
        let precioValidoIngresado = false;
        if (productoData.ventaPor.und && productoData.precios.und > 0) precioValidoIngresado = true;
        if (productoData.ventaPor.paq && productoData.precios.paq > 0) precioValidoIngresado = true;
        if (productoData.ventaPor.cj && productoData.precios.cj > 0) precioValidoIngresado = true;
        if (!precioValidoIngresado) {
            _showModal('Error', 'Ingresa al menos un precio válido (mayor que 0) para la(s) forma(s) de venta seleccionada(s).');
            // Try to focus the first relevant price input
            document.querySelector('#preciosContainer input[required]')?.focus();
            return;
        }
        // --- END VALIDATIONS ---


        console.log('Verifying product uniqueness and saving...');
        _showModal('Progreso', 'Verificando y guardando producto...');

        try {
            // Check for duplicates based on key fields
            const inventarioRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`);
            const q = _query(inventarioRef,
                _where("rubro", "==", productoData.rubro),
                _where("segmento", "==", productoData.segmento),
                _where("marca", "==", productoData.marca),
                _where("presentacion", "==", productoData.presentacion)
            );
            const querySnapshot = await _getDocs(q);
            if (!querySnapshot.empty) {
                _showModal('Producto Duplicado', 'Ya existe un producto con la misma combinación de Rubro, Segmento, Marca y Presentación.');
                return; // Stop if duplicate found
            }

            // Add the product for the admin
            const docRef = await _addDoc(inventarioRef, productoData);
            const newProductId = docRef.id;

            // Propagate the new product definition (with 0 quantity) to other users
            if (window.adminModule?.propagateProductChange) {
                 console.log('Propagating new product definition...');
                await window.adminModule.propagateProductChange(newProductId, productoData); // Pass full data
                 console.log('Product added and propagated.');
            } else {
                 console.log('Product added locally (propagation function not found).');
            }

            _showModal('Éxito', 'Producto agregado correctamente.');
            showAgregarProductoView(); // Reset the form for potentially adding another product
        } catch (err) {
            console.error("Error al agregar producto:", err);
            _showModal('Error', `Error al guardar el producto: ${err.message}`);
        }
    }


    function showModifyDeleteView() {
         if (_floatingControls) _floatingControls.classList.add('hidden');
        const isAdmin = _userRole === 'admin';
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl">
                        <h2 class="text-2xl font-bold text-gray-800 mb-6 text-center">Ver Productos / ${isAdmin ? 'Modificar Def.' : 'Consultar Stock'}</h2>
                        ${getFiltrosHTML('modify')}
                        <div id="productosListContainer" class="overflow-x-auto max-h-96 border rounded-lg">
                            <p class="text-gray-500 text-center p-4">Cargando productos...</p>
                        </div>
                        <div class="mt-6 flex flex-col sm:flex-row gap-4">
                            <button id="backToInventarioBtn" class="w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver</button>
                            ${isAdmin ? `<button id="deleteAllProductosBtn" class="w-full px-6 py-3 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700">Eliminar Todos los Productos</button>` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('backToInventarioBtn').addEventListener('click', showInventarioSubMenu);
        if (isAdmin) document.getElementById('deleteAllProductosBtn')?.addEventListener('click', handleDeleteAllProductos);

        // Setup filters and render the list
        const renderCallback = () => renderProductosList('productosListContainer', !isAdmin);
        _populateDropdown(`artifacts/${_appId}/users/${_userId}/rubros`, 'modify-filter-rubro', 'Rubro');
        setupFiltros('modify', renderCallback);
        startMainInventarioListener(renderCallback); // Start listener, render on first load and updates
    }


    function getFiltrosHTML(prefix) {
         // Get the current search term from the last used filters
         const currentSearch = _lastFilters.searchTerm || '';
        return `
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 p-4 border rounded-lg bg-gray-50">
                <!-- Search Input spans full width on mobile, full width on medium screens and up -->
                <input type="text" id="${prefix}-search-input" placeholder="Buscar por presentación, marca o segmento..." class="md:col-span-4 w-full px-4 py-2 border rounded-lg text-sm" value="${currentSearch}">
                <!-- Filters -->
                <div>
                    <label for="${prefix}-filter-rubro" class="block text-xs font-medium text-gray-600 mb-1">Rubro</label>
                    <select id="${prefix}-filter-rubro" class="w-full px-2 py-1 border rounded-lg text-sm"><option value="">Todos</option></select>
                </div>
                 <div>
                    <label for="${prefix}-filter-segmento" class="block text-xs font-medium text-gray-600 mb-1">Segmento</label>
                    <select id="${prefix}-filter-segmento" class="w-full px-2 py-1 border rounded-lg text-sm" disabled><option value="">Todos</option></select>
                </div>
                 <div>
                    <label for="${prefix}-filter-marca" class="block text-xs font-medium text-gray-600 mb-1">Marca</label>
                    <select id="${prefix}-filter-marca" class="w-full px-2 py-1 border rounded-lg text-sm" disabled><option value="">Todos</option></select>
                </div>
                <!-- Clear Button aligns itself at the bottom of the grid cell -->
                <button id="${prefix}-clear-filters-btn" class="bg-gray-300 text-xs font-semibold rounded-lg self-end py-1.5 px-3 hover:bg-gray-400">Limpiar</button>
            </div>
        `;
    }


    function setupFiltros(prefix, renderCallback) {
        const searchInput = document.getElementById(`${prefix}-search-input`);
        const rubroFilter = document.getElementById(`${prefix}-filter-rubro`);
        const segmentoFilter = document.getElementById(`${prefix}-filter-segmento`);
        const marcaFilter = document.getElementById(`${prefix}-filter-marca`);
        const clearBtn = document.getElementById(`${prefix}-clear-filters-btn`);

        if (!searchInput || !rubroFilter || !segmentoFilter || !marcaFilter || !clearBtn) {
             console.error("Error setting up filters: One or more filter elements not found with prefix:", prefix);
             return;
        }

        // Function to update Segmento and Marca dropdowns based on Rubro/Segmento selection
        function updateDependentFilters(trigger) {
             const selectedRubro = rubroFilter.value;
             const selectedSegmento = segmentoFilter.value; // Keep track of current segment selection

             // Update Segmento dropdown if Rubro changed or on initialization
             if (trigger === 'rubro' || trigger === 'init') {
                 // Get the value we want to re-select after repopulating (from cache on init, empty otherwise)
                 const currentSegmentoValue = (trigger === 'init') ? _lastFilters.segmento : '';
                 segmentoFilter.innerHTML = '<option value="">Todos</option>'; // Reset
                 segmentoFilter.disabled = true; // Disable initially
                 segmentoFilter.value = currentSegmentoValue; // Try to set the desired value

                 if (selectedRubro) {
                     // Find unique segment names for products matching the selected rubro
                     const segmentos = [...new Set(_inventarioCache.filter(p => p.rubro === selectedRubro && p.segmento).map(p => p.segmento))].sort();
                     if (segmentos.length > 0) {
                          segmentos.forEach(s => segmentoFilter.innerHTML += `<option value="${s}" ${s === currentSegmentoValue ? 'selected' : ''}>${s}</option>`);
                          segmentoFilter.disabled = false; // Enable if segments found
                          segmentoFilter.value = currentSegmentoValue; // Ensure correct selection after adding options
                     }
                 }
                 // If the intended value wasn't found (e.g., segment doesn't exist for this rubro), it defaults to "Todos"
                 if (segmentoFilter.value !== currentSegmentoValue) _lastFilters.segmento = '';

             }

             // Update Marca dropdown if Rubro or Segmento changed, or on initialization
             if (trigger === 'rubro' || trigger === 'segmento' || trigger === 'init') {
                  const currentMarcaValue = (trigger === 'init') ? _lastFilters.marca : '';
                  marcaFilter.innerHTML = '<option value="">Todos</option>'; // Reset
                  marcaFilter.disabled = true; // Disable initially
                  marcaFilter.value = currentMarcaValue; // Try to set

                  if (selectedRubro) { // Only enable if a Rubro is selected
                      // Filter products by selected Rubro AND Segmento (if any)
                      const marcas = [...new Set(
                          _inventarioCache
                              .filter(p => p.rubro === selectedRubro && (!selectedSegmento || p.segmento === selectedSegmento) && p.marca)
                              .map(p => p.marca)
                      )].sort();

                      if (marcas.length > 0) {
                           marcas.forEach(m => marcaFilter.innerHTML += `<option value="${m}" ${m === currentMarcaValue ? 'selected' : ''}>${m}</option>`);
                           marcaFilter.disabled = false; // Enable
                           marcaFilter.value = currentMarcaValue; // Ensure selection
                      }
                  }
                   // If the intended value wasn't found, it defaults to "Todos"
                   if (marcaFilter.value !== currentMarcaValue) _lastFilters.marca = '';
             }
        }

        // --- Initialization ---
        // Restore filters from cache and populate dependent dropdowns after a short delay
        // to allow _populateDropdown to finish loading Rubros first.
        setTimeout(() => {
             rubroFilter.value = _lastFilters.rubro || '';
             updateDependentFilters('init'); // Populate Segmento and Marca based on cached Rubro/Segmento
             // Initial render after restoring filters
             if (typeof renderCallback === 'function') {
                 renderCallback();
             }
        }, 300); // Increased delay slightly

        // --- Event Listeners ---
        // Function to save current filters and trigger re-render
        const applyAndSaveFilters = () => {
             _lastFilters.searchTerm = searchInput.value || '';
             _lastFilters.rubro = rubroFilter.value || '';
             _lastFilters.segmento = segmentoFilter.value || '';
             _lastFilters.marca = marcaFilter.value || '';
              // Execute the provided render callback
              if (typeof renderCallback === 'function') {
                 renderCallback();
              }
        };

        searchInput.addEventListener('input', applyAndSaveFilters); // Filter on search input

        rubroFilter.addEventListener('change', () => {
             // When Rubro changes, reset Segmento and Marca selections in the cache and UI
             _lastFilters.segmento = '';
             _lastFilters.marca = '';
             updateDependentFilters('rubro'); // Update dependent dropdowns
             applyAndSaveFilters(); // Save filters and re-render
        });

        segmentoFilter.addEventListener('change', () => {
              // When Segmento changes, reset Marca selection
              _lastFilters.marca = '';
              updateDependentFilters('segmento'); // Update Marca dropdown
              applyAndSaveFilters(); // Save filters and re-render
        });

        marcaFilter.addEventListener('change', applyAndSaveFilters); // Filter on Marca change

        clearBtn.addEventListener('click', () => {
             searchInput.value = '';
             rubroFilter.value = '';
             // Reset dependent filters and the cache, then re-render
             updateDependentFilters('rubro'); // Update Segmento/Marca based on empty Rubro
             applyAndSaveFilters(); // Save empty filters and render
        });
    }

    async function renderProductosList(elementId, readOnly = false) {
        const container = document.getElementById(elementId);
        if (!container) return;

        // Filter products based on _lastFilters
        let productos = [..._inventarioCache];
        productos = productos.filter(p => {
             const searchTermLower = (_lastFilters.searchTerm || '').toLowerCase();
             // Match search term against presentation, marca, or segmento
             const textMatch = !searchTermLower ||
                               (p.presentacion && p.presentacion.toLowerCase().includes(searchTermLower)) ||
                               (p.marca && p.marca.toLowerCase().includes(searchTermLower)) ||
                               (p.segmento && p.segmento.toLowerCase().includes(searchTermLower));
             // Match dropdown filters
             const rubroMatch = !_lastFilters.rubro || p.rubro === _lastFilters.rubro;
             const segmentoMatch = !_lastFilters.segmento || p.segmento === _lastFilters.segmento;
             const marcaMatch = !_lastFilters.marca || p.marca === _lastFilters.marca;
             return textMatch && rubroMatch && segmentoMatch && marcaMatch;
        });

        // Sort products
        const segmentoOrderMap = await getSegmentoOrderMap();
        productos.sort((a, b) => {
             const orderA = segmentoOrderMap[a.segmento] ?? 9999;
             const orderB = segmentoOrderMap[b.segmento] ?? 9999;
             if (orderA !== orderB) return orderA - orderB; // Sort by segment order
             const marcaComp = (a.marca || '').localeCompare(b.marca || '');
             if (marcaComp !== 0) return marcaComp; // Then by marca
             return (a.presentacion || '').localeCompare(b.presentacion || ''); // Finally by presentacion
        });

        // Handle no results
        if (productos.length === 0) {
            container.innerHTML = `<p class="text-gray-500 text-center p-4">No hay productos que coincidan con los filtros.</p>`;
            return;
        }

        // Build table HTML
        const cols = readOnly ? 3 : 4; // Number of columns depends on readOnly flag
        // Sticky header with z-index
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

            // Add Segmento header row if changed
            if (segmento !== currentSegmento) {
                 currentSegmento = segmento;
                 currentMarca = null; // Reset marca when segmento changes
                 // Sticky header row for segment, adjust top offset based on main header height
                 tableHTML += `<tr><td colspan="${cols}" class="py-2 px-4 bg-gray-300 font-bold text-gray-800 sticky top-[calc(theme(height.10))] z-[9]">${currentSegmento}</td></tr>`;
            }
            // Add Marca header row if changed
            if (marca !== currentMarca) {
                 currentMarca = marca;
                 // Non-sticky header for marca
                 tableHTML += `<tr><td colspan="${cols}" class="py-2 px-4 bg-gray-100 font-semibold text-gray-600 pl-8">${currentMarca}</td></tr>`;
            }

            // Determine display price and stock based on preferred sale unit
            const ventaPor = p.ventaPor || { und: true };
            const precios = p.precios || { und: p.precioPorUnidad || 0 };
            let displayPresentacion = p.presentacion || 'N/A';
            let displayPrecio = `$0.00`;
            let displayStock = `${p.cantidadUnidades || 0} Und`;
            let conversionFactorStock = 1;

            if (ventaPor.cj) {
                 // Add unit count if available
                 if (p.unidadesPorCaja) displayPresentacion += ` <span class="text-xs text-gray-500">(${p.unidadesPorCaja} und.)</span>`;
                 displayPrecio = `$${(precios.cj || 0).toFixed(2)}`;
                 conversionFactorStock = Math.max(1, p.unidadesPorCaja || 1);
                 displayStock = `${Math.floor((p.cantidadUnidades || 0) / conversionFactorStock)} Cj`;
            } else if (ventaPor.paq) {
                 if (p.unidadesPorPaquete) displayPresentacion += ` <span class="text-xs text-gray-500">(${p.unidadesPorPaquete} und.)</span>`;
                 displayPrecio = `$${(precios.paq || 0).toFixed(2)}`;
                 conversionFactorStock = Math.max(1, p.unidadesPorPaquete || 1);
                 displayStock = `${Math.floor((p.cantidadUnidades || 0) / conversionFactorStock)} Paq`;
            } else { // Default to Und
                 displayPrecio = `$${(precios.und || 0).toFixed(2)}`;
            }
            const stockEnUnidades = p.cantidadUnidades || 0;
            const stockTooltip = `${stockEnUnidades} Und. Base`; // Tooltip shows base unit stock

            // Add product row
            tableHTML += `
                <tr class="hover:bg-gray-50">
                    <td class="py-2 px-3 border-b pl-12">${displayPresentacion}</td>
                    <td class="py-2 px-3 border-b text-right font-medium">${displayPrecio}</td>
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


    function editProducto(productId) {
        if (_userRole !== 'admin') {
             _showModal('Acceso Denegado', 'Solo los administradores pueden editar la definición de productos.');
             return;
        }
        const producto = _inventarioCache.find(p => p.id === productId);
        if (!producto) { _showModal('Error', 'Producto no encontrado en la caché.'); return; }
        if (_floatingControls) _floatingControls.classList.add('hidden');

        // --- HTML Structure for Edit Form --- (Similar to Add Form, but pre-filled)
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto max-w-2xl">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl text-center">
                        <h2 class="text-2xl font-bold text-gray-800 mb-6">Editar Producto</h2>
                        <form id="editProductoForm" class="space-y-4 text-left">
                            <!-- Categories (Rubro, Segmento, Marca) with Add buttons -->
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
                             <!-- Sale Options (Venta por, Maneja Vacío) -->
                             <div class="border-t pt-4 mt-4">
                                 <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                     <div>
                                         <label class="block text-gray-700 font-medium mb-2">Venta por:</label>
                                         <div id="ventaPorContainer" class="flex items-center space-x-4">
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
                                                  <option value="">Seleccione...</option>
                                                  <option value="1/4 - 1/3">1/4 - 1/3</option>
                                                  <option value="ret 350 ml">Retornable 350 ml</option>
                                                  <option value="ret 1.25 Lts">Retornable 1.25 Lts</option>
                                              </select>
                                          </div>
                                      </div>
                                 </div>
                                 <!-- Dynamic containers for units/prices -->
                                 <div id="empaquesContainer" class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4"></div>
                                 <div id="preciosContainer" class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4"></div>
                             </div>
                            <!-- Stock and IVA -->
                            <div class="border-t pt-4 mt-4">
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                     <div>
                                         <label class="block text-gray-700 font-medium mb-1">Stock Actual (Unidades):</label>
                                         <input type="number" id="cantidadActual" value="${producto.cantidadUnidades || 0}" class="w-full px-4 py-2 border rounded-lg bg-gray-100" readonly>
                                         <p class="text-xs text-gray-500 mt-1">El stock se modifica desde "Ajuste Masivo".</p>
                                    </div>
                                    <div>
                                        <label for="ivaTipo" class="block text-gray-700 font-medium mb-1">Tipo de IVA:</label>
                                        <select id="ivaTipo" class="w-full px-4 py-2 border rounded-lg" required>
                                            <option value="16">IVA 16%</option>
                                            <option value="0">Exento 0%</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <!-- Submit Button -->
                            <button type="submit" class="w-full px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg shadow-md hover:bg-blue-600">Guardar Cambios y Propagar</button>
                        </form>
                        <!-- Back Button -->
                        <button id="backToModifyDeleteBtn" class="mt-4 w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver</button>
                    </div>
                </div>
            </div>
        `;

        // --- Populate Dropdowns ---
        _populateDropdown(`artifacts/${_appId}/users/${_userId}/rubros`, 'rubro', 'Rubro', producto.rubro);
        _populateDropdown(`artifacts/${_appId}/users/${_userId}/segmentos`, 'segmento', 'Segmento', producto.segmento);
        _populateDropdown(`artifacts/${_appId}/users/${_userId}/marcas`, 'marca', 'Marca', producto.marca);

        // --- Setup Dynamic Inputs (same as Add view) ---
        const ventaPorContainer = document.getElementById('ventaPorContainer');
        const preciosContainer = document.getElementById('preciosContainer');
        const empaquesContainer = document.getElementById('empaquesContainer');
        const manejaVaciosCheck = document.getElementById('manejaVaciosCheck');
        const tipoVacioContainer = document.getElementById('tipoVacioContainer');
        const tipoVacioSelect = document.getElementById('tipoVacioSelect');

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
        ventaPorContainer.addEventListener('change', updateDynamicInputs);

        // --- Pre-fill Form Fields ---
        // Use setTimeout to ensure dropdowns are populated before setting values
        setTimeout(() => {
            document.getElementById('presentacion').value = producto.presentacion || '';
            document.getElementById('ivaTipo').value = producto.iva !== undefined ? producto.iva : 16;

            // Set 'Venta por' checkboxes
            if (producto.ventaPor) {
                document.getElementById('ventaPorUnd').checked = producto.ventaPor.und || false;
                document.getElementById('ventaPorPaq').checked = producto.ventaPor.paq || false;
                document.getElementById('ventaPorCj').checked = producto.ventaPor.cj || false;
            } else {
                 // Default to Und if 'ventaPor' is missing (for older data)
                 document.getElementById('ventaPorUnd').checked = true;
            }
            updateDynamicInputs(); // Generate inputs based on checkboxes

            // Fill units per package/box (after inputs are generated)
            const undPaqInput = document.getElementById('unidadesPorPaquete');
            if (undPaqInput && producto.ventaPor?.paq) undPaqInput.value = producto.unidadesPorPaquete || 1;
            const undCjInput = document.getElementById('unidadesPorCaja');
            if (undCjInput && producto.ventaPor?.cj) undCjInput.value = producto.unidadesPorCaja || 1;

             // Fill prices (after inputs are generated)
             const preciosExistentes = producto.precios || { und: producto.precioPorUnidad || 0 }; // Handle old price structure
             const precioUndInput = document.getElementById('precioUnd');
             if (precioUndInput) precioUndInput.value = preciosExistentes.und || 0;
             const precioPaqInput = document.getElementById('precioPaq');
             if (precioPaqInput) precioPaqInput.value = preciosExistentes.paq || 0;
             const precioCjInput = document.getElementById('precioCj');
             if (precioCjInput) precioCjInput.value = preciosExistentes.cj || 0;

             // Set 'Maneja Vacío' state
             if (producto.manejaVacios) {
                 manejaVaciosCheck.checked = true;
                 tipoVacioContainer.classList.remove('hidden');
                 tipoVacioSelect.required = true;
                 tipoVacioSelect.value = producto.tipoVacio || ''; // Select saved type
             } else {
                  manejaVaciosCheck.checked = false;
                  tipoVacioContainer.classList.add('hidden');
                  tipoVacioSelect.required = false;
             }
        }, 300); // Delay allows dropdowns to populate

        // --- Add Event Listeners ---
        document.getElementById('editProductoForm').addEventListener('submit', (e) => handleUpdateProducto(e, productId));
        document.getElementById('backToModifyDeleteBtn').addEventListener('click', showModifyDeleteView);
    };


    async function handleUpdateProducto(e, productId) {
        e.preventDefault();
        if (_userRole !== 'admin') return;

        // Get updated data using the same form reading function
        const updatedData = getProductoDataFromForm(true); // Pass true for editing context
        const productoOriginal = _inventarioCache.find(p => p.id === productId);
        if (!productoOriginal) { _showModal('Error', 'No se encontró el producto original en la caché.'); return; }

        // --- VALIDATIONS (same as Add) ---
        if (!updatedData.rubro || !updatedData.segmento || !updatedData.marca || !updatedData.presentacion) { _showModal('Error', 'Completa Rubro, Segmento, Marca y Presentación.'); return; }
        if (!updatedData.ventaPor.und && !updatedData.ventaPor.paq && !updatedData.ventaPor.cj) { _showModal('Error', 'Selecciona al menos una forma de venta.'); return; }
        if (updatedData.manejaVacios && !updatedData.tipoVacio) { _showModal('Error', 'Si maneja vacío, selecciona el tipo.'); document.getElementById('tipoVacioSelect')?.focus(); return; }
        let precioValidoIngresado = false;
        if (updatedData.ventaPor.und && updatedData.precios.und > 0) precioValidoIngresado = true;
        if (updatedData.ventaPor.paq && updatedData.precios.paq > 0) precioValidoIngresado = true;
        if (updatedData.ventaPor.cj && updatedData.precios.cj > 0) precioValidoIngresado = true;
        if (!precioValidoIngresado) { _showModal('Error', 'Ingresa al menos un precio válido (> 0) para la forma de venta.'); document.querySelector('#preciosContainer input[required]')?.focus(); return; }
        // --- END VALIDATIONS ---

        // Preserve the original quantity, as it's not editable here
        updatedData.cantidadUnidades = productoOriginal.cantidadUnidades || 0;

        console.log('Saving changes for admin...');
        _showModal('Progreso', 'Guardando cambios y propagando...');

        try {
            // Update the product for the admin using setDoc (overwrite)
            await _setDoc(_doc(_db, `artifacts/${_appId}/users/${_userId}/inventario`, productId), updatedData);

            // Propagate the updated definition (excluding quantity) to other users
            if (window.adminModule?.propagateProductChange) {
                 console.log('Propagating changes...');
                 // Pass the updated data (which now includes the preserved quantity,
                 // propagateProductChange should handle ignoring it)
                await window.adminModule.propagateProductChange(productId, updatedData);
                 console.log('Product modified and propagated.');
            } else {
                 console.log('Product modified locally (propagation function not found).');
            }

            _showModal('Éxito', 'Producto modificado exitosamente.');
            showModifyDeleteView(); // Go back to the list view
        } catch (err) {
            console.error("Error al modificar producto:", err);
            _showModal('Error', `Error al modificar: ${err.message}`);
        }
    }


    function deleteProducto(productId) {
        if (_userRole !== 'admin') { _showModal('Acceso Denegado', 'Solo los administradores pueden eliminar productos.'); return; }
        const producto = _inventarioCache.find(p => p.id === productId);
        if (!producto) { _showModal('Error', 'Producto no encontrado en la caché.'); return; }

        // Confirm deletion
        _showModal('Confirmar Eliminación', `¿Estás seguro de eliminar "${producto.presentacion}"? Esta acción se propagará a todos los usuarios y es IRREVERSIBLE.`, async () => {
             console.log(`Deleting "${producto.presentacion}" for admin...`);
             _showModal('Progreso', `Eliminando "${producto.presentacion}" y propagando...`); // Show progress
            try {
                // Delete the product for the admin
                await _deleteDoc(_doc(_db, `artifacts/${_appId}/users/${_userId}/inventario`, productId));

                // Propagate the deletion to other users
                if (window.adminModule?.propagateProductChange) {
                     console.log('Propagating deletion...');
                    await window.adminModule.propagateProductChange(productId, null); // Pass null data for deletion
                     console.log('Product deleted and propagated.');
                } else {
                     console.log('Product deleted locally (propagation function not found).');
                }
                _showModal('Éxito', 'Producto eliminado correctamente.');
                 // The listener will automatically update the list view
            } catch (e) {
                 console.error("Error al eliminar producto:", e);
                 _showModal('Error', `Error al eliminar el producto: ${e.message}`);
            }
        }, 'Sí, Eliminar', null, true); // Trigger confirm logic
    };


    async function handleDeleteAllProductos() {
        if (_userRole !== 'admin') return;
        _showModal('Confirmación Extrema', `<p class="text-red-600 font-bold">¡ADVERTENCIA MAYOR!</p><p>¿Estás ABSOLUTAMENTE SEGURO de eliminar TODOS los productos de tu inventario? Esta acción se propagará a todos los usuarios y es IRREVERSIBLE.</p>`, async () => {
            _showModal('Progreso', 'Eliminando todos los productos...'); // Show progress
            try {
                const collectionRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`);
                const snapshot = await _getDocs(collectionRef);
                if (snapshot.empty) { _showModal('Aviso', 'No hay productos para eliminar.'); return; }

                const productIdsToDelete = snapshot.docs.map(doc => doc.id);
                console.log(`Attempting to delete ${productIdsToDelete.length} products locally...`);

                // Delete products locally for admin in batches
                const BATCH_LIMIT = 490;
                let batchAdmin = _writeBatch(_db);
                let adminOps = 0;
                let totalDeletedLocally = 0;
                for (const docSnap of snapshot.docs) {
                     batchAdmin.delete(docSnap.ref);
                     adminOps++;
                     if (adminOps >= BATCH_LIMIT) {
                         await batchAdmin.commit();
                         totalDeletedLocally += adminOps;
                         console.log(`Deleted batch of ${adminOps} products locally.`);
                         batchAdmin = _writeBatch(_db);
                         adminOps = 0;
                     }
                }
                 if (adminOps > 0) {
                     await batchAdmin.commit();
                     totalDeletedLocally += adminOps;
                     console.log(`Deleted final batch of ${adminOps} products locally.`);
                 }

                 console.log(`Locally deleted ${totalDeletedLocally} products.`);
                 _showModal('Progreso', `Productos eliminados localmente. Propagando eliminación a otros usuarios...`);

                // Propagate deletion to other users
                if (window.adminModule?.propagateProductChange) {
                     console.log(`Propagating deletion of ${productIdsToDelete.length} products...`);
                     let propagationErrors = 0;
                     // Propagate deletions one by one to avoid large single points of failure
                     // Batching propagation might be faster but harder to track individual errors
                     for (const productId of productIdsToDelete) {
                          try {
                              await window.adminModule.propagateProductChange(productId, null);
                          } catch (propError) {
                              console.error(`Error propagating deletion for ${productId}:`, propError);
                              propagationErrors++;
                          }
                     }
                     _showModal(propagationErrors > 0 ? 'Advertencia' : 'Éxito', `Todos los productos eliminados localmente.${propagationErrors > 0 ? ` Ocurrieron ${propagationErrors} errores al propagar la eliminación.` : ' Eliminación propagada correctamente.'}`);
                } else {
                     _showModal('Advertencia', 'Productos eliminados localmente, pero la función de propagación no está disponible.');
                }
                 // Listener will update the view

            } catch (error) {
                console.error("Error al eliminar todos los productos:", error);
                _showModal('Error', `Error durante el proceso de eliminación: ${error.message}`);
            }
        }, 'Sí, Eliminar Todos', null, true); // Trigger confirm logic
    }


    async function handleDeleteAllDatosMaestros() {
        if (_userRole !== 'admin') return;
        _showModal('Confirmar Borrado Datos Maestros', `<p class="text-red-600 font-bold">¡ADVERTENCIA MAYOR!</p><p>¿Estás seguro de eliminar TODOS los Rubros, Segmentos y Marcas que NO estén en uso por algún producto en TU inventario? Esta acción se propagará a todos los usuarios y es IRREVERSIBLE.</p>`, async () => {
           console.log('Verifying master data usage in admin inventory...');
           _showModal('Progreso', 'Verificando uso de datos maestros...');
            try {
                const collectionsToDelete = ['rubros', 'segmentos', 'marcas'];
                const itemsToDeleteMap = { rubros: [], segmentos: [], marcas: [] };
                 let itemsInUse = [];

                 // 1. Get all products from admin's inventory
                 const inventarioSnapshot = await _getDocs(_collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`));
                 const allProducts = inventarioSnapshot.docs.map(d => d.data());

                 // 2. Iterate through each category type (rubros, segmentos, marcas)
                 for (const colName of collectionsToDelete) {
                     const field = colName === 'rubros' ? 'rubro' : (colName === 'segmentos' ? 'segmento' : 'marca');
                     const catSnapshot = await _getDocs(_collection(_db, `artifacts/${_appId}/users/${_userId}/${colName}`));

                     // 3. For each item in the category, check if it's used by any product
                     catSnapshot.docs.forEach(doc => {
                         const itemName = doc.data().name;
                         if (itemName && allProducts.some(p => p[field] === itemName)) {
                             // If used, add to the 'in use' list
                             itemsInUse.push(`'${itemName}' (${colName.slice(0,-1)})`);
                         } else if (itemName) {
                              // If not used, add to the 'to delete' list for this category
                              itemsToDeleteMap[colName].push({ id: doc.id, name: itemName });
                         }
                     });
                 }

                 // 4. If any items are in use, stop the process
                 if (itemsInUse.length > 0) {
                      _showModal('Error', `No se pueden eliminar todos los datos. Los siguientes están en uso: ${itemsInUse.join(', ')}. Elimina o modifica los productos primero.`);
                      return;
                 }

                 // 5. Count total items to be deleted
                 let totalItemsToDelete = 0;
                 for (const colName in itemsToDeleteMap) {
                     totalItemsToDelete += itemsToDeleteMap[colName].length;
                 }
                 if (totalItemsToDelete === 0) {
                      _showModal('Aviso', 'No se encontraron datos maestros no utilizados para eliminar.');
                      return;
                 }


                 // 6. Confirm final deletion
                 _showModal('Confirmación Final', `Se eliminarán ${totalItemsToDelete} datos maestros no utilizados (Rubros, Segmentos, Marcas). Esta acción se propagará. ¿Continuar?`, async () => {
                     console.log('Deleting unused master data for admin...');
                      _showModal('Progreso', `Eliminando ${totalItemsToDelete} datos maestros...`);
                     const batchAdmin = _writeBatch(_db);
                     let adminDeleteCount = 0;
                     for (const colName in itemsToDeleteMap) {
                         itemsToDeleteMap[colName].forEach(item => {
                              const docRef = _doc(_db, `artifacts/${_appId}/users/${_userId}/${colName}`, item.id);
                              batchAdmin.delete(docRef);
                              adminDeleteCount++;
                         });
                     }
                     await batchAdmin.commit();
                      console.log(`${adminDeleteCount} master data items deleted for admin.`);
                      _showModal('Progreso', `Datos eliminados localmente. Propagando eliminación...`);


                     // 7. Propagate deletions
                      if (window.adminModule?.propagateCategoryChange) {
                          console.log('Propagating category deletions...');
                          let propagatedCount = 0;
                          let propagationErrors = 0;
                          for (const colName in itemsToDeleteMap) {
                              for (const item of itemsToDeleteMap[colName]) {
                                   try {
                                       await window.adminModule.propagateCategoryChange(colName, item.id, null); // null data for deletion
                                       propagatedCount++;
                                   } catch (propError) {
                                       console.error(`Error propagating deletion for ${colName}/${item.id} (${item.name}):`, propError);
                                       propagationErrors++;
                                   }
                              }
                          }
                          _showModal(propagationErrors > 0 ? 'Advertencia' : 'Éxito', `Datos maestros no utilizados eliminados localmente.${propagationErrors > 0 ? ` Ocurrieron ${propagationErrors} errores al propagar.` : ' Eliminación propagada.'}`);
                      } else {
                          _showModal('Advertencia', 'Datos maestros eliminados localmente, pero la función de propagación no está disponible.');
                      }

                      // Invalidate relevant caches
                      invalidateSegmentOrderCache(); // Segment order might change if segments are deleted

                 }, 'Sí, Eliminar No Usados', null, true); // Trigger confirm logic


            } catch (error) {
                console.error("Error al eliminar todos los datos maestros:", error);
                _showModal('Error', `Error durante el proceso: ${error.message}`);
            }
        }, 'Sí, Eliminar No Usados', null, true); // Trigger initial confirm logic
    }


    window.inventarioModule = {
        editProducto,
        deleteProducto,
        handleDeleteDataItem,
        showAddCategoryModal,
        getSegmentoOrderMap,
        invalidateSegmentOrderCache
    };

})();
