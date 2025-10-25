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
             console.error("Error en listener de inventario:", error);
             if (!window.isLoggingOut || error.code !== 'permission-denied') {
                 if (error.code !== 'cancelled') {
                     _showModal('Error de Conexión', 'No se pudo actualizar el inventario en tiempo real. Revisa tu conexión.');
                 }
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
                    seg.orden = newOrder;
                });
                await batch.commit();
                allSegments = [...segmentsWithOrder, ...segmentsWithoutOrder];
                console.log("Initial order assigned to new segments.");
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
            console.error("Error al renderizar la lista de segmentos:", error);
            container.innerHTML = `<p class="text-red-500 text-center">Error al cargar los segmentos.</p>`;
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
                 setTimeout(() => {
                     if (draggedItem) {
                         draggedItem.style.opacity = '0.5';
                         draggedItem.style.border = '2px dashed gray';
                     }
                 }, 0);
                 e.dataTransfer.effectAllowed = 'move';
                 e.dataTransfer.setData('text/plain', draggedItem.dataset.id);
             } else {
                 e.preventDefault();
             }
        });
        container.addEventListener('dragend', e => {
             if (draggedItem) {
                 draggedItem.style.opacity = '1';
                 draggedItem.style.border = '';
             }
             draggedItem = null;
             if (placeholder && placeholder.parentNode) {
                 placeholder.parentNode.removeChild(placeholder);
             }
        });
        container.addEventListener('dragover', e => {
             e.preventDefault();
             e.dataTransfer.dropEffect = 'move';
             const afterElement = getDragAfterElement(container, e.clientY);
             if (afterElement) {
                 container.insertBefore(placeholder, afterElement);
             } else {
                 container.appendChild(placeholder);
             }
        });
        container.addEventListener('drop', e => {
              e.preventDefault();
              if (draggedItem && placeholder && placeholder.parentNode) {
                  container.insertBefore(draggedItem, placeholder);
                  draggedItem.style.opacity = '1';
                  draggedItem.style.border = '';
              }
              if (placeholder && placeholder.parentNode) {
                  placeholder.parentNode.removeChild(placeholder);
              }
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
                 if (offset < 0 && offset > closest.offset) {
                     return { offset: offset, element: child };
                 } else {
                     return closest;
                 }
             }, { offset: Number.NEGATIVE_INFINITY }).element;
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
        const currentOrderMap = await getSegmentoOrderMap();

        listItems.forEach((item, index) => {
            const docId = item.dataset.id;
            const docRef = _doc(_db, `artifacts/${_appId}/users/${_userId}/segmentos`, docId);
            const segmentName = item.dataset.name;
             const currentDbOrder = currentOrderMap[segmentName] ?? 9999;
             if (currentDbOrder !== index) {
                 batch.update(docRef, { orden: index });
                 hasChanges = true;
             }
            orderedIds.push(docId);
        });

         if (!hasChanges) {
             _showModal('Aviso', 'No se detectaron cambios en el orden.');
             return;
         }
        _showModal('Progreso', 'Guardando nuevo orden para admin...');

        try {
            await batch.commit();
            invalidateSegmentOrderCache();
             if (window.adminModule?.propagateCategoryOrderChange) {
                  _showModal('Progreso', 'Propagando orden a otros usuarios...');
                 await window.adminModule.propagateCategoryOrderChange('segmentos', orderedIds);
             } else {
                  console.warn("Función propagateCategoryOrderChange no encontrada.");
                  _showModal('Advertencia', 'Orden guardado localmente, no se pudo propagar.');
             }
            _showModal('Éxito', 'Orden de segmentos guardado y propagado.');
            showInventarioSubMenu();
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
        startMainInventarioListener(renderCallback);
    }

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
        const segmentoOrderMap = await getSegmentoOrderMap();
        productos.sort((a, b) => {
             const orderA = segmentoOrderMap[a.segmento] ?? 9999;
             const orderB = segmentoOrderMap[b.segmento] ?? 9999;
             if (orderA !== orderB) return orderA - orderB;
             const marcaComp = (a.marca || '').localeCompare(b.marca || '');
             if (marcaComp !== 0) return marcaComp;
             return (a.presentacion || '').localeCompare(b.presentacion || '');
        });

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
                 tableHTML += `<tr><td colspan="2" class="py-2 px-4 bg-gray-300 font-bold text-gray-800 sticky top-[calc(theme(height.10))] z-[9]">${currentSegmento}</td></tr>`;
            }
            if (marca !== currentMarca) {
                 currentMarca = marca;
                 tableHTML += `<tr><td colspan="2" class="py-2 px-4 bg-gray-100 font-semibold text-gray-700 pl-8">${currentMarca}</td></tr>`;
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
             _showModal('Aviso', container?.textContent.includes('No hay productos') ? 'No hay productos que coincidan.' : 'Lista no cargada.');
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
                 }
                 return;
            }
            if (productoOriginal) {
                const nuevaCantidadUnidades = newValueInDisplayUnits * conversionFactor;
                if ((productoOriginal.cantidadUnidades || 0) !== nuevaCantidadUnidades) {
                    const docRef = _doc(_db, `artifacts/${_appId}/users/${_userId}/inventario`, docId);
                    batch.update(docRef, { cantidadUnidades: nuevaCantidadUnidades });
                    changesCount++;
                }
            } else {
                 console.warn(`Producto no encontrado en caché para ID: ${docId}.`);
            }
        });

        if (invalidValues) {
             _showModal('Error de Entrada', 'Valores inválidos detectados. Corrígelos.');
             return;
        }
        if (changesCount === 0) {
            _showModal('Aviso', 'No se detectaron cambios.');
            return;
        }

        _showModal('Confirmar Cambios', `Actualizar ${changesCount} producto(s)?`, async () => {
            try {
                await batch.commit();
                _showModal('Éxito', 'Cantidades actualizadas.');
            } catch (error) {
                console.error("Error al guardar ajuste masivo:", error);
                _showModal('Error', 'Error al guardar.');
            }
        });
    }

    function showModificarDatosView() {
        if (_userRole !== 'admin') {
            _showModal('Acceso Denegado', 'Solo administradores.');
            return;
        }
        if (_floatingControls) _floatingControls.classList.add('hidden');
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl">
                        <h2 class="text-2xl font-bold text-gray-800 mb-6 text-center">Modificar Datos Maestros</h2>
                        <p class="text-sm text-center text-gray-600 mb-6">Gestiona categorías globales. Cambios se propagan. Eliminación solo si no está en uso.</p>
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
            const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            if (items.length === 0) {
                container.innerHTML = `<p class="text-gray-500 text-sm p-2">No hay ${itemName.toLowerCase()}s definidos.</p>`;
                return;
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
             console.error(`Error en listener de ${collectionName}:`, error);
             if (!window.isLoggingOut || error.code !== 'permission-denied') {
                  container.innerHTML = `<p class="text-red-500 text-center p-2">Error al cargar ${itemName.toLowerCase()}s.</p>`;
             }
        });
        _activeListeners.push(unsubscribe);
    }

    function showAddCategoryModal(collectionName, itemName) {
        if (_userRole !== 'admin') return;
        _showModal(
            `Agregar Nuevo ${itemName}`,
            `<form id="addCategoryForm" class="space-y-4">
                <input type="text" id="newCategoryName" placeholder="Nombre del ${itemName}" class="w-full px-4 py-2 border rounded-lg" required>
                <p id="addCategoryMessage" class="text-sm text-red-600 h-4"></p>
            </form>`,
            async () => {
                const input = document.getElementById('newCategoryName');
                const messageP = document.getElementById('addCategoryMessage');
                const newName = input.value.trim();
                messageP.textContent = '';
                if (!newName) {
                    messageP.textContent = 'El nombre no puede estar vacío.';
                    input.focus();
                    return false;
                }
                const newNameUpper = newName.toUpperCase();
                try {
                    const collectionRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/${collectionName}`);
                    const q = _query(collectionRef, _where("name", "==", newNameUpper));
                    const querySnapshot = await _getDocs(q);
                    if (!querySnapshot.empty) {
                        messageP.textContent = `"${newName}" ya existe.`;
                        input.select();
                        return false;
                    }
                    const newItemData = { name: newNameUpper };
                     if (collectionName === 'segmentos') {
                         const currentSegmentsSnapshot = await _getDocs(collectionRef);
                         const maxOrder = currentSegmentsSnapshot.docs.reduce((max, doc) => Math.max(max, doc.data().orden ?? -1), -1);
                         newItemData.orden = maxOrder + 1;
                     }
                    const docRef = await _addDoc(collectionRef, newItemData);
                    if (window.adminModule?.propagateCategoryChange) {
                         console.log('Propagating new category...');
                        await window.adminModule.propagateCategoryChange(collectionName, docRef.id, newItemData);
                         console.log(`"${newNameUpper}" added and propagated.`);
                    } else {
                         console.log(`"${newNameUpper}" added locally (propagation not available).`);
                    }
                     if (collectionName === 'segmentos') invalidateSegmentOrderCache();
                    return true;
                } catch (err) {
                    console.error(`Error al agregar ${itemName}:`, err);
                    messageP.textContent = 'Error al guardar.';
                    return false;
                }
            },
            'Guardar y Propagar',
             () => {},
             true
        );
         setTimeout(() => document.getElementById('newCategoryName')?.focus(), 50);
    }

    async function handleDeleteDataItem(collectionName, itemName, itemType, itemId) {
        if (_userRole !== 'admin') {
            _showModal('Acceso Denegado', 'Solo administradores.');
            return;
        }
        const fieldMap = { rubros: 'rubro', segmentos: 'segmento', marcas: 'marca' };
        const fieldName = fieldMap[collectionName];
        if (!fieldName) { _showModal('Error Interno', 'Tipo no reconocido.'); return; }

        console.log(`Verifying usage of "${itemName}"...`);
        const inventarioRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`);
        const q = _query(inventarioRef, _where(fieldName, "==", itemName));
        try {
            const usageSnapshot = await _getDocs(q);
            if (!usageSnapshot.empty) {
                _showModal('Error al Eliminar', `"${itemName}" está en uso por ${usageSnapshot.size} producto(s).`);
                return;
            }
            _showModal('Confirmar Eliminación', `Eliminar "${itemName}"? Se propagará. IRREVERSIBLE.`, async () => {
                console.log(`Deleting "${itemName}" for admin...`);
                 try {
                     await _deleteDoc(_doc(_db, `artifacts/${_appId}/users/${_userId}/${collectionName}`, itemId));
                     if (window.adminModule?.propagateCategoryChange) {
                          console.log('Propagating deletion...');
                         await window.adminModule.propagateCategoryChange(collectionName, itemId, null);
                         console.log(`${itemType} "${itemName}" deleted and propagated.`);
                     } else {
                          console.warn('Deleted locally, propagation not available.');
                     }
                     if (collectionName === 'segmentos') invalidateSegmentOrderCache();
                     _showModal('Éxito', `${itemType} "${itemName}" eliminado.`);
                 } catch (deleteError) {
                      console.error(`Error al eliminar/propagar ${itemName}:`, deleteError);
                      _showModal('Error', `Error durante eliminación: ${deleteError.message}`);
                 }
            }, 'Sí, Eliminar');
        } catch (error) {
            _showModal('Error', `Error al verificar uso: ${error.message}`);
        }
    }

    function showAgregarProductoView() {
        if (_userRole !== 'admin') { _showModal('Acceso Denegado', 'Solo administradores.'); return; }
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
        updateDynamicInputs();
        document.getElementById('productoForm').addEventListener('submit', agregarProducto);
        document.getElementById('backToInventarioBtn').addEventListener('click', showInventarioSubMenu);
    }

    function getProductoDataFromForm(isEditing = false) {
        const unidadesPorPaqueteInput = document.getElementById('unidadesPorPaquete');
        const unidadesPorCajaInput = document.getElementById('unidadesPorCaja');
        const unidadesPorPaquete = Math.max(1, unidadesPorPaqueteInput ? (parseInt(unidadesPorPaqueteInput.value, 10) || 1) : 1);
        const unidadesPorCaja = Math.max(1, unidadesPorCajaInput ? (parseInt(unidadesPorCajaInput.value, 10) || 1) : 1);
        const precioUndInput = document.getElementById('precioUnd');
        const precioPaqInput = document.getElementById('precioPaq');
        const precioCjInput = document.getElementById('precioCj');
        const precios = {
            und: Math.max(0, precioUndInput ? (parseFloat(precioUndInput.value) || 0) : 0),
            paq: Math.max(0, precioPaqInput ? (parseFloat(precioPaqInput.value) || 0) : 0),
            cj: Math.max(0, precioCjInput ? (parseFloat(precioCjInput.value) || 0) : 0),
        };
        let precioFinalPorUnidad = 0;
        if (precios.und > 0) { precioFinalPorUnidad = precios.und; }
        else if (precios.paq > 0 && unidadesPorPaquete > 0) { precioFinalPorUnidad = precios.paq / unidadesPorPaquete; }
        else if (precios.cj > 0 && unidadesPorCaja > 0) { precioFinalPorUnidad = precios.cj / unidadesPorCaja; }
        precioFinalPorUnidad = parseFloat(precioFinalPorUnidad.toFixed(2));
        let cantidadTotalUnidades;
        if (isEditing) {
             const cantidadActualInput = document.getElementById('cantidadActual');
             cantidadTotalUnidades = cantidadActualInput ? (parseInt(cantidadActualInput.value, 10) || 0) : 0;
        } else {
            cantidadTotalUnidades = 0;
        }
        const manejaVaciosChecked = document.getElementById('manejaVaciosCheck').checked;
        const tipoVacioSelected = document.getElementById('tipoVacioSelect').value;
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
            tipoVacio: manejaVaciosChecked ? tipoVacioSelected : null,
            precios: precios,
            precioPorUnidad: precioFinalPorUnidad,
            cantidadUnidades: cantidadTotalUnidades,
            iva: parseInt(document.getElementById('ivaTipo').value, 10)
        };
    }

    async function agregarProducto(e) {
        e.preventDefault();
        if (_userRole !== 'admin') return;
        const productoData = getProductoDataFromForm(false);
        if (!productoData.rubro || !productoData.segmento || !productoData.marca || !productoData.presentacion) { _showModal('Error', 'Completa Rubro, Segmento, Marca y Presentación.'); return; }
        if (!productoData.ventaPor.und && !productoData.ventaPor.paq && !productoData.ventaPor.cj) { _showModal('Error', 'Selecciona al menos una forma de venta.'); return; }
        if (productoData.manejaVacios && !productoData.tipoVacio) { _showModal('Error', 'Si maneja vacío, selecciona el tipo.'); document.getElementById('tipoVacioSelect')?.focus(); return; }
        let precioValidoIngresado = false;
        if (productoData.ventaPor.und && productoData.precios.und > 0) precioValidoIngresado = true;
        if (productoData.ventaPor.paq && productoData.precios.paq > 0) precioValidoIngresado = true;
        if (productoData.ventaPor.cj && productoData.precios.cj > 0) precioValidoIngresado = true;
        if (!precioValidoIngresado) { _showModal('Error', 'Ingresa al menos un precio válido (> 0) para la forma de venta.'); document.querySelector('#preciosContainer input[required]')?.focus(); return; }

        console.log('Verifying and saving product...');

        try {
            const inventarioRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`);
            const q = _query(inventarioRef, _where("rubro", "==", productoData.rubro), _where("segmento", "==", productoData.segmento), _where("marca", "==", productoData.marca), _where("presentacion", "==", productoData.presentacion));
            const querySnapshot = await _getDocs(q);
            if (!querySnapshot.empty) { _showModal('Producto Duplicado', 'Ya existe un producto con esa combinación.'); return; }
            const docRef = await _addDoc(inventarioRef, productoData);
            const newProductId = docRef.id;
            if (window.adminModule?.propagateProductChange) {
                 console.log('Propagating new product...');
                await window.adminModule.propagateProductChange(newProductId, productoData);
                 console.log('Product added and propagated.');
            } else {
                 console.log('Product added locally (propagation not available).');
            }
            _showModal('Éxito', 'Producto agregado correctamente.');
            showAgregarProductoView();
        } catch (err) {
            console.error("Error al agregar producto:", err);
            _showModal('Error', `Error al guardar: ${err.message}`);
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
        function updateDependentFilters(trigger) {
             const selectedRubro = rubroFilter.value;
             const selectedSegmento = segmentoFilter.value;
             if (trigger === 'rubro' || trigger === 'init') {
                 const currentSegmentoValue = (trigger === 'init') ? _lastFilters.segmento : '';
                 segmentoFilter.innerHTML = '<option value="">Todos</option>';
                 segmentoFilter.disabled = true;
                 segmentoFilter.value = currentSegmentoValue;
                 if (selectedRubro) {
                     const segmentos = [...new Set(_inventarioCache.filter(p => p.rubro === selectedRubro && p.segmento).map(p => p.segmento))].sort();
                     if (segmentos.length > 0) {
                          segmentos.forEach(s => segmentoFilter.innerHTML += `<option value="${s}" ${s === currentSegmentoValue ? 'selected' : ''}>${s}</option>`);
                          segmentoFilter.disabled = false;
                     }
                 }
             }
             if (trigger === 'rubro' || trigger === 'segmento' || trigger === 'init') {
                  const currentMarcaValue = (trigger === 'init') ? _lastFilters.marca : '';
                  marcaFilter.innerHTML = '<option value="">Todos</option>';
                  marcaFilter.disabled = true;
                  marcaFilter.value = currentMarcaValue;
                  if (selectedRubro) {
                      const marcas = [...new Set(_inventarioCache.filter(p => p.rubro === selectedRubro && (!selectedSegmento || p.segmento === selectedSegmento) && p.marca).map(p => p.marca))].sort();
                      if (marcas.length > 0) {
                           marcas.forEach(m => marcaFilter.innerHTML += `<option value="${m}" ${m === currentMarcaValue ? 'selected' : ''}>${m}</option>`);
                           marcaFilter.disabled = false;
                      }
                  }
             }
        }
        setTimeout(() => {
             rubroFilter.value = _lastFilters.rubro || '';
             updateDependentFilters('init');
             if (typeof renderCallback === 'function') {
                 renderCallback();
             }
        }, 200);
        const applyAndSaveFilters = () => {
             _lastFilters.searchTerm = searchInput.value || '';
             _lastFilters.rubro = rubroFilter.value || '';
             _lastFilters.segmento = segmentoFilter.value || '';
             _lastFilters.marca = marcaFilter.value || '';
              if (typeof renderCallback === 'function') {
                 renderCallback();
              }
        };
        searchInput.addEventListener('input', applyAndSaveFilters);
        rubroFilter.addEventListener('change', () => {
             _lastFilters.segmento = '';
             _lastFilters.marca = '';
             updateDependentFilters('rubro');
             applyAndSaveFilters();
        });
        segmentoFilter.addEventListener('change', () => {
              _lastFilters.marca = '';
              updateDependentFilters('segmento');
              applyAndSaveFilters();
        });
        marcaFilter.addEventListener('change', applyAndSaveFilters);
        clearBtn.addEventListener('click', () => {
             searchInput.value = '';
             rubroFilter.value = '';
             updateDependentFilters('rubro');
             applyAndSaveFilters();
        });
    }

    async function renderProductosList(elementId, readOnly = false) {
        const container = document.getElementById(elementId);
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
        const segmentoOrderMap = await getSegmentoOrderMap();
        productos.sort((a, b) => {
             const orderA = segmentoOrderMap[a.segmento] ?? 9999;
             const orderB = segmentoOrderMap[b.segmento] ?? 9999;
             if (orderA !== orderB) return orderA - orderB;
             const marcaComp = (a.marca || '').localeCompare(b.marca || '');
             if (marcaComp !== 0) return marcaComp;
             return (a.presentacion || '').localeCompare(b.presentacion || '');
        });

        if (productos.length === 0) {
            container.innerHTML = `<p class="text-gray-500 text-center p-4">No hay productos que coincidan.</p>`;
            return;
        }

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
                 tableHTML += `<tr><td colspan="${cols}" class="py-2 px-4 bg-gray-300 font-bold text-gray-800 sticky top-[calc(theme(height.10))] z-[9]">${currentSegmento}</td></tr>`;
            }
            if (marca !== currentMarca) {
                 currentMarca = marca;
                 tableHTML += `<tr><td colspan="${cols}" class="py-2 px-4 bg-gray-100 font-semibold text-gray-600 pl-8">${currentMarca}</td></tr>`;
            }
            const ventaPor = p.ventaPor || { und: true };
            const precios = p.precios || { und: p.precioPorUnidad || 0 };
            let displayPresentacion = p.presentacion || 'N/A';
            let displayPrecio = `$0.00`;
            let displayStock = `${p.cantidadUnidades || 0} Und`;
            let conversionFactorStock = 1;
            if (ventaPor.cj) {
                 if (p.unidadesPorCaja) displayPresentacion += ` <span class="text-xs text-gray-500">(${p.unidadesPorCaja} und.)</span>`;
                 displayPrecio = `$${(precios.cj || 0).toFixed(2)}`;
                 conversionFactorStock = Math.max(1, p.unidadesPorCaja || 1);
                 displayStock = `${Math.floor((p.cantidadUnidades || 0) / conversionFactorStock)} Cj`;
            } else if (ventaPor.paq) {
                 if (p.unidadesPorPaquete) displayPresentacion += ` <span class="text-xs text-gray-500">(${p.unidadesPorPaquete} und.)</span>`;
                 displayPrecio = `$${(precios.paq || 0).toFixed(2)}`;
                 conversionFactorStock = Math.max(1, p.unidadesPorPaquete || 1);
                 displayStock = `${Math.floor((p.cantidadUnidades || 0) / conversionFactorStock)} Paq`;
            } else {
                 displayPrecio = `$${(precios.und || 0).toFixed(2)}`;
            }
            const stockEnUnidades = p.cantidadUnidades || 0;
            const stockTooltip = `${stockEnUnidades} Und. Base`;

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
             _showModal('Acceso Denegado', 'Solo administradores pueden editar definición.');
             return;
        }
        const producto = _inventarioCache.find(p => p.id === productId);
        if (!producto) { _showModal('Error', 'Producto no encontrado.'); return; }
        if (_floatingControls) _floatingControls.classList.add('hidden');
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto max-w-2xl">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl text-center">
                        <h2 class="text-2xl font-bold text-gray-800 mb-6">Editar Producto</h2>
                        <form id="editProductoForm" class="space-y-4 text-left">
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
                                         <label class="block text-gray-700 font-medium mb-1">Stock Actual (Unidades):</label>
                                         <input type="number" id="cantidadActual" value="${producto.cantidadUnidades || 0}" class="w-full px-4 py-2 border rounded-lg bg-gray-100" readonly>
                                         <p class="text-xs text-gray-500 mt-1">Se modifica desde "Ajuste Masivo".</p>
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
                            <button type="submit" class="w-full px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg shadow-md hover:bg-blue-600">Guardar Cambios y Propagar</button>
                        </form>
                        <button id="backToModifyDeleteBtn" class="mt-4 w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver</button>
                    </div>
                </div>
            </div>
        `;
        _populateDropdown(`artifacts/${_appId}/users/${_userId}/rubros`, 'rubro', 'Rubro', producto.rubro);
        _populateDropdown(`artifacts/${_appId}/users/${_userId}/segmentos`, 'segmento', 'Segmento', producto.segmento);
        _populateDropdown(`artifacts/${_appId}/users/${_userId}/marcas`, 'marca', 'Marca', producto.marca);
        const ventaPorContainer = document.getElementById('ventaPorContainer');
        const preciosContainer = document.getElementById('preciosContainer');
        const empaquesContainer = document.getElementById('empaquesContainer');
        const manejaVaciosCheck = document.getElementById('manejaVaciosCheck');
        const tipoVacioContainer = document.getElementById('tipoVacioContainer');
        const tipoVacioSelect = document.getElementById('tipoVacioSelect');
        const updateDynamicInputs = () => { /* ... (código sin cambios) ... */ };
        manejaVaciosCheck.addEventListener('change', () => { /* ... (código sin cambios) ... */ });
        ventaPorContainer.addEventListener('change', updateDynamicInputs);
        setTimeout(() => {
            document.getElementById('presentacion').value = producto.presentacion || '';
            document.getElementById('ivaTipo').value = producto.iva !== undefined ? producto.iva : 16;
            if (producto.ventaPor) {
                document.getElementById('ventaPorUnd').checked = producto.ventaPor.und || false;
                document.getElementById('ventaPorPaq').checked = producto.ventaPor.paq || false;
                document.getElementById('ventaPorCj').checked = producto.ventaPor.cj || false;
            } else { document.getElementById('ventaPorUnd').checked = true; }
            updateDynamicInputs();
            const undPaqInput = document.getElementById('unidadesPorPaquete');
            if (undPaqInput && producto.ventaPor?.paq) undPaqInput.value = producto.unidadesPorPaquete || 1;
            const undCjInput = document.getElementById('unidadesPorCaja');
            if (undCjInput && producto.ventaPor?.cj) undCjInput.value = producto.unidadesPorCaja || 1;
             const preciosExistentes = producto.precios || { und: producto.precioPorUnidad || 0 };
             const precioUndInput = document.getElementById('precioUnd');
             if (precioUndInput) precioUndInput.value = preciosExistentes.und || 0;
             const precioPaqInput = document.getElementById('precioPaq');
             if (precioPaqInput) precioPaqInput.value = preciosExistentes.paq || 0;
             const precioCjInput = document.getElementById('precioCj');
             if (precioCjInput) precioCjInput.value = preciosExistentes.cj || 0;
             if (producto.manejaVacios) {
                 manejaVaciosCheck.checked = true;
                 tipoVacioContainer.classList.remove('hidden');
                 tipoVacioSelect.required = true;
                 tipoVacioSelect.value = producto.tipoVacio || '';
             } else {
                  manejaVaciosCheck.checked = false;
                  tipoVacioContainer.classList.add('hidden');
                  tipoVacioSelect.required = false;
             }
        }, 300);
        document.getElementById('editProductoForm').addEventListener('submit', (e) => handleUpdateProducto(e, productId));
        document.getElementById('backToModifyDeleteBtn').addEventListener('click', showModifyDeleteView);
    };

    async function handleUpdateProducto(e, productId) {
        e.preventDefault();
        if (_userRole !== 'admin') return;
        const updatedData = getProductoDataFromForm(true);
        const productoOriginal = _inventarioCache.find(p => p.id === productId);
        if (!productoOriginal) { _showModal('Error', 'No se encontró el producto original.'); return; }
        if (!updatedData.rubro || !updatedData.segmento || !updatedData.marca || !updatedData.presentacion) { /* ... (validación sin cambios) ... */ }
        if (!updatedData.ventaPor.und && !updatedData.ventaPor.paq && !updatedData.ventaPor.cj) { /* ... (validación sin cambios) ... */ }
        if (updatedData.manejaVacios && !updatedData.tipoVacio) { /* ... (validación sin cambios) ... */ }
        let precioValidoIngresado = false;
        if (updatedData.ventaPor.und && updatedData.precios.und > 0) precioValidoIngresado = true;
        if (updatedData.ventaPor.paq && updatedData.precios.paq > 0) precioValidoIngresado = true;
        if (updatedData.ventaPor.cj && updatedData.precios.cj > 0) precioValidoIngresado = true;
        if (!precioValidoIngresado) { /* ... (validación sin cambios) ... */ }

        console.log('Saving changes for admin...'); // Mantener log
        try {
            await _setDoc(_doc(_db, `artifacts/${_appId}/users/${_userId}/inventario`, productId), updatedData);
            if (window.adminModule?.propagateProductChange) {
                 console.log('Propagating changes...'); // Mantener log
                await window.adminModule.propagateProductChange(productId, updatedData);
                 console.log('Product modified and propagated.'); // Mantener log
            } else {
                 console.log('Product modified locally (propagation not available).'); // Mantener log
            }
            _showModal('Éxito', 'Producto modificado exitosamente.');
            showModifyDeleteView();
        } catch (err) {
            console.error("Error al modificar producto:", err); // Mantener error
            _showModal('Error', `Error al modificar: ${err.message}`);
        }
    }

    function deleteProducto(productId) {
        if (_userRole !== 'admin') { _showModal('Acceso Denegado', 'Solo administradores.'); return; }
        const producto = _inventarioCache.find(p => p.id === productId);
        if (!producto) { _showModal('Error', 'Producto no encontrado.'); return; }
        _showModal('Confirmar Eliminación', `Eliminar "${producto.presentacion}"? Se propagará. IRREVERSIBLE.`, async () => {
             console.log(`Deleting "${producto.presentacion}" for admin...`); // Mantener log
            try {
                await _deleteDoc(_doc(_db, `artifacts/${_appId}/users/${_userId}/inventario`, productId));
                if (window.adminModule?.propagateProductChange) {
                     console.log('Propagating deletion...'); // Mantener log
                    await window.adminModule.propagateProductChange(productId, null);
                     console.log('Product deleted and propagated.'); // Mantener log
                } else {
                     console.log('Product deleted locally (propagation not available).'); // Mantener log
                }
                _showModal('Éxito', 'Producto eliminado correctamente.');
            } catch (e) {
                 console.error("Error al eliminar producto:", e); // Mantener error
                 _showModal('Error', `Error al eliminar: ${e.message}`);
            }
        }, 'Sí, Eliminar');
    };

    async function handleDeleteAllProductos() {
        if (_userRole !== 'admin') return;
        _showModal('Confirmación Extrema', `<p class="text-red-600 font-bold">¡ADVERTENCIA MAYOR!</p><p>Eliminar TODOS los productos? Se propagará. IRREVERSIBLE.</p>`, async () => {
            console.log('Deleting all products for admin...'); // Mantener log
            try {
                const collectionRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`);
                const snapshot = await _getDocs(collectionRef);
                if (snapshot.empty) { _showModal('Aviso', 'No hay productos para eliminar.'); return; }
                const productIdsToDelete = snapshot.docs.map(doc => doc.id);
                const batchAdmin = _writeBatch(_db);
                snapshot.docs.forEach(doc => batchAdmin.delete(doc.ref));
                await batchAdmin.commit();
                if (window.adminModule?.propagateProductChange) {
                     console.log(`Propagating deletion of ${productIdsToDelete.length} products...`); // Mantener log
                     let propagationErrors = 0;
                     for (const productId of productIdsToDelete) {
                          try { await window.adminModule.propagateProductChange(productId, null); }
                          catch (propError) { console.error(`Error propagating deletion for ${productId}:`, propError); propagationErrors++; } // Mantener error
                     }
                     _showModal(propagationErrors > 0 ? 'Advertencia' : 'Éxito', `Productos eliminados localmente.${propagationErrors > 0 ? ` ${propagationErrors} eliminaciones no propagadas.` : ' Eliminación propagada.'}`);
                } else {
                     _showModal('Éxito', 'Productos eliminados localmente (no se pudo propagar).');
                }
            } catch (error) {
                console.error("Error al eliminar todos los productos:", error); // Mantener error
                _showModal('Error', `Error al eliminar: ${error.message}`);
            }
        }, 'Sí, Eliminar Todos');
    }

    async function handleDeleteAllDatosMaestros() {
        if (_userRole !== 'admin') return;
        _showModal('Confirmar Borrado Datos Maestros', `<p class="text-red-600 font-bold">¡ADVERTENCIA MAYOR!</p><p>Eliminar TODOS los Rubros, Segmentos y Marcas? Verifica que no estén en uso. Se propagará. IRREVERSIBLE.</p>`, async () => {
           console.log('Verifying master data usage...'); // Mantener log
            try {
                const collectionsToDelete = ['rubros', 'segmentos', 'marcas'];
                const deletedItemsMap = { rubros: [], segmentos: [], marcas: [] };
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
                              deletedItemsMap[colName].push({ id: doc.id, name: itemName });
                         }
                     });
                 }
                 if (itemsInUse.length > 0) {
                      _showModal('Error', `No se pueden eliminar. En uso: ${itemsInUse.join(', ')}.`);
                      return;
                 }
                console.log('Deleting unused master data for admin...'); // Mantener log
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
                 console.log(`${adminDeleteCount} master data items deleted for admin.`); // Mantener log
                 if (window.adminModule?.propagateCategoryChange) {
                      console.log('Propagating category deletions...'); // Mantener log
                      let propagatedCount = 0;
                      let propagationErrors = 0;
                      for (const colName in deletedItemsMap) {
                          for (const item of deletedItemsMap[colName]) {
                               try { await window.adminModule.propagateCategoryChange(colName, item.id, null); propagatedCount++; }
                               catch (propError) { console.error(`Error propagating deletion for ${colName}/${item.id} (${item.name}):`, propError); propagationErrors++; } // Mantener error
                          }
                      }
                      _showModal(propagationErrors > 0 ? 'Advertencia' : 'Éxito', `Datos maestros eliminados localmente.${propagationErrors > 0 ? ` ${propagationErrors} eliminaciones no propagadas.` : ' Eliminación propagada.'}`);
                 } else {
                      _showModal('Éxito', 'Datos maestros eliminados localmente (no se pudo propagar).');
                 }
                  invalidateSegmentOrderCache();
            } catch (error) {
                console.error("Error al eliminar todos los datos maestros:", error); // Mantener error
                _showModal('Error', `Error al eliminar: ${error.message}`);
            }
        }, 'Sí, Eliminar No Usados');
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

