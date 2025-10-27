(function() {
    let _db, _userId, _userRole, _appId, _mainContent, _floatingControls, _activeListeners;
    let _showMainMenu, _showModal, _showAddItemModal, _populateDropdown;
    // MODIFICADO: Asegurar que _getDoc esté declarado
    let _collection, _onSnapshot, _doc, _addDoc, _setDoc, _deleteDoc, _query, _where, _getDocs, _writeBatch, _getDoc;

    let _inventarioCache = [];
    let _lastFilters = { searchTerm: '', rubro: '', segmento: '', marca: '' };
    let _inventarioListenerUnsubscribe = null;
    let _marcasCache = null;

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
        // --- CORRECCIÓN: Añadir la asignación faltante ---
        _getDoc = dependencies.getDoc;
        // --- FIN CORRECCIÓN ---
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
             if (window.isLoggingOut && error.code === 'permission-denied') { return; }
             console.error("Error en listener de inventario:", error);
             if (error.code !== 'cancelled') _showModal('Error de Conexión', 'No se pudo actualizar el inventario.');
        });
        _activeListeners.push(_inventarioListenerUnsubscribe);
    }

    function invalidateSegmentOrderCache() {
        _marcasCache = null;
        if (window.catalogoModule?.invalidateCache) {
             window.catalogoModule.invalidateCache();
        } else {
            console.warn("Función invalidateCache de catalogoModule no encontrada.");
        }
    }

    window.showInventarioSubMenu = function() {
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
                            ${isAdmin ? `<button id="ordenarSegmentosBtn" class="w-full px-6 py-3 bg-purple-500 text-white font-semibold rounded-lg shadow-md hover:bg-purple-600">Ordenar Segmentos y Marcas</button>` : ''}
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
            document.getElementById('ordenarSegmentosBtn')?.addEventListener('click', showOrdenarSegmentosMarcasView);
            document.getElementById('modificarDatosBtn')?.addEventListener('click', showModificarDatosView);
        }
        document.getElementById('ajusteMasivoBtn').addEventListener('click', showAjusteMasivoView);
        document.getElementById('backToMenuBtn').addEventListener('click', _showMainMenu);
    }

    function showOrdenarSegmentosMarcasView() {
        if (_userRole !== 'admin') {
            _showModal('Acceso Denegado', 'Solo administradores.');
            return;
        }
        if (_floatingControls) _floatingControls.classList.add('hidden');
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto max-w-2xl">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl">
                        <h2 class="text-2xl font-bold text-gray-800 mb-4 text-center">Ordenar Segmentos y Marcas (Visualización)</h2>
                        <p class="text-center text-gray-600 mb-6">Arrastra Segmentos para reordenarlos. Arrastra Marcas <span class="font-bold">dentro</span> de su Segmento.</p>
                        <div class="mb-4">
                           <label for="ordenarRubroFilter" class="block text-gray-700 font-medium mb-2">Filtrar por Rubro (Opcional):</label>
                           <select id="ordenarRubroFilter" class="w-full px-4 py-2 border rounded-lg">
                               <option value="">Todos</option>
                           </select>
                        </div>
                        <div id="segmentos-marcas-sortable-list" class="space-y-4 border rounded-lg p-4 max-h-[60vh] overflow-y-auto bg-gray-50">
                            <p class="text-gray-500 text-center">Cargando...</p>
                        </div>
                        <div class="mt-6 flex flex-col sm:flex-row gap-4">
                            <button id="backToInventarioBtn" class="w-full px-6 py-3 bg-gray-400 text-white rounded-lg shadow-md hover:bg-gray-500">Volver</button>
                            <button id="saveOrderBtn" class="w-full px-6 py-3 bg-green-500 text-white rounded-lg shadow-md hover:bg-green-600">Guardar Orden</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('backToInventarioBtn').addEventListener('click', showInventarioSubMenu);
        document.getElementById('saveOrderBtn').addEventListener('click', handleGuardarOrdenJerarquia);
        const rubroFilter = document.getElementById('ordenarRubroFilter');
        _populateDropdown(`artifacts/${_appId}/users/${_userId}/rubros`, 'ordenarRubroFilter', 'Rubro');
        rubroFilter.addEventListener('change', () => renderSortableHierarchy(rubroFilter.value));
        renderSortableHierarchy('');
    }

    async function getAllMarcas() {
        if (_marcasCache) return _marcasCache;
        try {
            const marcasRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/marcas`);
            const snapshot = await _getDocs(marcasRef);
            _marcasCache = snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name }));
            return _marcasCache;
        } catch (error) { console.error("Error cargando marcas:", error); return []; }
    }

    async function renderSortableHierarchy(rubroFiltro = '') {
        const container = document.getElementById('segmentos-marcas-sortable-list');
        if (!container) return;
        container.innerHTML = `<p class="text-gray-500 text-center">Cargando...</p>`;
        try {
            const segmentosRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/segmentos`);
            let segSnapshot = await _getDocs(segmentosRef);
            let allSegments = segSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const segsSinOrden = allSegments.filter(s => s.orden === undefined || s.orden === null);
            if (segsSinOrden.length > 0) {
                 const segsConOrden = allSegments.filter(s => s.orden !== undefined && s.orden !== null);
                 const maxOrden = segsConOrden.reduce((max, s) => Math.max(max, s.orden ?? -1), -1);
                 const batch = _writeBatch(_db);
                 segsSinOrden.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
                 segsSinOrden.forEach((seg, index) => { const dRef = _doc(segmentosRef, seg.id); const nOrden = maxOrden + 1 + index; batch.update(dRef, { orden: nOrden }); seg.orden = nOrden; });
                 await batch.commit(); allSegments = [...segsConOrden, ...segsSinOrden];
             }
            allSegments.sort((a, b) => (a.orden ?? 9999) - (b.orden ?? 9999));
            const allMarcas = await getAllMarcas(); const marcasMap = new Map(allMarcas.map(m => [m.name, m.id]));
            let prodsQuery = _collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`); if (rubroFiltro) prodsQuery = _query(prodsQuery, _where("rubro", "==", rubroFiltro));
            const prodSnap = await _getDocs(prodsQuery); const prodsEnRubro = prodSnap.docs.map(d => d.data());
            let segsToShow = allSegments; if (rubroFiltro) { const uSegNames = new Set(prodsEnRubro.map(p => p.segmento).filter(Boolean)); segsToShow = allSegments.filter(s => s.name && uSegNames.has(s.name)); segsToShow.sort((a, b) => (a.orden ?? 9999) - (b.orden ?? 9999)); }
            container.innerHTML = ''; if (segsToShow.length === 0) { container.innerHTML = `<p class="text-gray-500 text-center">No hay segmentos ${rubroFiltro ? 'con productos' : ''}.</p>`; return; }

            segsToShow.forEach(seg => {
                const segCont = document.createElement('div'); segCont.className = 'segmento-container border border-gray-300 rounded-lg mb-3 bg-white shadow'; segCont.dataset.segmentoId = seg.id; segCont.dataset.segmentoName = seg.name; segCont.dataset.type = 'segmento';
                const segTitle = document.createElement('div'); segTitle.className = 'segmento-title p-3 bg-gray-200 rounded-t-lg cursor-grab active:cursor-grabbing font-semibold flex justify-between items-center'; segTitle.draggable = true; segTitle.textContent = seg.name; segCont.appendChild(segTitle);
                const marcasList = document.createElement('ul'); marcasList.className = 'marcas-sortable-list p-3 space-y-1 bg-white rounded-b-lg'; marcasList.dataset.segmentoParent = seg.id;
                const marcasEnSeg = [...new Set(prodsEnRubro.filter(p => p.segmento === seg.name && p.marca).map(p => p.marca))];
                const marcaOrderPref = seg.marcaOrder || [];
                marcasEnSeg.sort((a, b) => { const iA = marcaOrderPref.indexOf(a), iB = marcaOrderPref.indexOf(b); if (iA!==-1 && iB!==-1) return iA-iB; if (iA!==-1) return -1; if (iB!==-1) return 1; return a.localeCompare(b); });
                if (marcasEnSeg.length === 0) { marcasList.innerHTML = `<li class="text-xs text-gray-500 italic pl-2">No hay marcas.</li>`; }
                else { marcasEnSeg.forEach(marcaName => { const mId = marcasMap.get(marcaName) || `temp_${marcaName.replace(/\s+/g,'_')}`; const li = document.createElement('li'); li.dataset.marcaId = mId; li.dataset.marcaName = marcaName; li.dataset.type = 'marca'; li.className = 'marca-item p-2 bg-gray-50 rounded shadow-xs cursor-grab active:cursor-grabbing hover:bg-gray-100 text-sm'; li.textContent = marcaName; li.draggable = true; marcasList.appendChild(li); }); }
                segCont.appendChild(marcasList); container.appendChild(segCont);
            });
            addDragAndDropHandlersHierarchy(container);
        } catch (error) { console.error("Error render jerarquía:", error); container.innerHTML = `<p class="text-red-500">Error al cargar.</p>`; }
    }

    function addDragAndDropHandlersHierarchy(container) {
        let draggedItem = null; let draggedItemElement = null; let draggedType = null; let sourceList = null; let placeholder = null;

        const createPlaceholder = (type) => { if(placeholder) placeholder.remove(); placeholder = document.createElement(type === 'segmento' ? 'div' : 'li'); placeholder.className = type === 'segmento' ? 'segmento-placeholder' : 'marca-placeholder'; placeholder.style.height = type === 'segmento' ? '60px' : '30px'; placeholder.style.background = type === 'segmento' ? '#dbeafe' : '#e0e7ff'; placeholder.style.border = type === 'segmento' ? '2px dashed #3b82f6' : '1px dashed #6366f1'; placeholder.style.borderRadius = type === 'segmento' ? '0.5rem' : '0.25rem'; placeholder.style.margin = type === 'segmento' ? '1rem 0' : '0.25rem 0'; if(type === 'marca') placeholder.style.listStyleType = 'none'; };

        container.addEventListener('dragstart', e => {
            draggedItemElement = e.target.closest('.segmento-container, .marca-item');
            if (!draggedItemElement) { e.preventDefault(); return; }
            draggedType = draggedItemElement.dataset.type;
            draggedItem = draggedItemElement;
            sourceList = draggedItemElement.parentNode;
            setTimeout(() => { if (draggedItemElement) draggedItemElement.classList.add('opacity-50'); }, 0);
            e.dataTransfer.effectAllowed = 'move';
            createPlaceholder(draggedType);
        });

        container.addEventListener('dragend', e => {
            if (draggedItemElement) draggedItemElement.classList.remove('opacity-50');
            draggedItem = null; draggedItemElement = null; draggedType = null; sourceList = null;
            if (placeholder) placeholder.remove(); placeholder = null;
        });

        container.addEventListener('dragover', e => {
            e.preventDefault();
            if (!draggedItem || !placeholder) return;
            const targetList = e.target.closest(draggedType === 'segmento' ? '#segmentos-marcas-sortable-list' : '.marcas-sortable-list');
            if (!targetList || (draggedType === 'marca' && targetList !== sourceList)) { if (placeholder.parentNode) placeholder.remove(); e.dataTransfer.dropEffect = 'none'; return; }
            e.dataTransfer.dropEffect = 'move';
            const afterElement = getDragAfterElementHierarchy(targetList, e.clientY, draggedType);
            if (afterElement === null) targetList.appendChild(placeholder);
            else targetList.insertBefore(placeholder, afterElement);
        });

        container.addEventListener('drop', e => {
            e.preventDefault();
            const targetList = e.target.closest(draggedType === 'segmento' ? '#segmentos-marcas-sortable-list' : '.marcas-sortable-list');
            if (draggedItemElement && placeholder && placeholder.parentNode && targetList && !(draggedType === 'marca' && targetList !== sourceList) ) { placeholder.parentNode.insertBefore(draggedItemElement, placeholder); }
            if (draggedItemElement) draggedItemElement.classList.remove('opacity-50');
            if (placeholder) placeholder.remove();
            draggedItem = null; draggedItemElement = null; draggedType = null; sourceList = null; placeholder = null;
        });

        container.addEventListener('dragleave', e => { if (!container.contains(e.relatedTarget) && placeholder) { placeholder.remove(); placeholder = null; } });

        function getDragAfterElementHierarchy(listContainer, y, itemType) {
            const selector = itemType === 'segmento' ? '.segmento-container' : '.marca-item';
            const draggables = [...listContainer.children].filter(c => c.matches(selector) && c !== draggedItemElement && !c.matches('.segmento-placeholder') && !c.matches('.marca-placeholder'));
            return draggables.reduce((closest, child) => { const box = child.getBoundingClientRect(), offset = y - box.top - box.height / 2; if (offset < 0 && offset > closest.offset) return { offset: offset, element: child }; else return closest; }, { offset: Number.NEGATIVE_INFINITY }).element;
        }
    }

    async function handleGuardarOrdenJerarquia() {
        if (_userRole !== 'admin') return;
        const segConts = document.querySelectorAll('#segmentos-marcas-sortable-list .segmento-container'); if (segConts.length === 0) { _showModal('Aviso', 'No hay elementos.'); return; }
        _showModal('Progreso', 'Guardando...');
        const batch = _writeBatch(_db); let segOrderChanged=false, marcaOrderChanged=false; const orderedSegIds = []; const currentSegmentDocs = {};
        try { const segsRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/segmentos`); const segsSnap = await _getDocs(segsRef); segsSnap.docs.forEach(doc => { currentSegmentDocs[doc.id] = doc.data(); }); } catch (e) { console.warn("No se pudo precargar segmentos:", e); }

        segConts.forEach((segCont, index) => {
            const segId = segCont.dataset.segmentoId; orderedSegIds.push(segId); const segRef = _doc(_db, `artifacts/${_appId}/users/${_userId}/segmentos`, segId); const currentSegData = currentSegmentDocs[segId] || {};
            if (currentSegData.orden === undefined || currentSegData.orden !== index) { batch.update(segRef, { orden: index }); segOrderChanged = true; }
            const marcaItems = segCont.querySelectorAll('.marcas-sortable-list .marca-item'); const newMarcaOrder = Array.from(marcaItems).map(item => item.dataset.marcaName); const currentMarcaOrder = currentSegData.marcaOrder || [];
            if (JSON.stringify(newMarcaOrder) !== JSON.stringify(currentMarcaOrder)) { batch.update(segRef, { marcaOrder: newMarcaOrder }); marcaOrderChanged = true; }
        });

        if (!segOrderChanged && !marcaOrderChanged) { _showModal('Aviso', 'No hay cambios.'); return; }

        try {
            await batch.commit(); invalidateSegmentOrderCache(); _showModal('Progreso', 'Propagando...'); let propSuccess = true;
            if (segOrderChanged && window.adminModule?.propagateCategoryOrderChange) { try { await window.adminModule.propagateCategoryOrderChange('segmentos', orderedSegIds); } catch (e) { propSuccess = false; console.error("Error prop seg order:", e); } }
            if (marcaOrderChanged && window.adminModule?.propagateCategoryChange) {
                for (const segCont of segConts) { const segId=segCont.dataset.segmentoId; const marcaItems=segCont.querySelectorAll('.marcas-sortable-list .marca-item'); const newMarcaOrder=Array.from(marcaItems).map(item=>item.dataset.marcaName); try { const segRef=_doc(_db,`artifacts/${_appId}/users/${_userId}/segmentos`,segId);
                        // --- CORRECCIÓN: Usar _getDoc aquí ---
                        const segSnap=await _getDoc(segRef);
                        // --- FIN CORRECCIÓN ---
                         if(segSnap.exists()){ const segDataComp=segSnap.data(); segDataComp.marcaOrder=newMarcaOrder; await window.adminModule.propagateCategoryChange('segmentos', segId, segDataComp); } } catch (e) { propSuccess=false; console.error(`Error prop marca order seg ${segId}:`, e); } }
            }
            _showModal(propSuccess ? 'Éxito' : 'Advertencia', `Orden guardado localmente.${propSuccess ? ' Propagado.' : ' Errores al propagar.'}`, showInventarioSubMenu);
        } catch (error) { console.error("Error guardando orden:", error); _showModal('Error', `Error: ${error.message}`); }
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

    async function renderAjusteMasivoList() {
        const container = document.getElementById('ajusteListContainer');
        if (!container) return;
        let productos = [..._inventarioCache];
        productos = productos.filter(p => {
             const searchTermLower = (_lastFilters.searchTerm || '').toLowerCase();
             const textMatch = !searchTermLower || (p.presentacion && p.presentacion.toLowerCase().includes(searchTermLower)) || (p.marca && p.marca.toLowerCase().includes(searchTermLower)) || (p.segmento && p.segmento.toLowerCase().includes(searchTermLower));
             const rubroMatch = !_lastFilters.rubro || p.rubro === _lastFilters.rubro;
             const segmentoMatch = !_lastFilters.segmento || p.segmento === _lastFilters.segmento;
             const marcaMatch = !_lastFilters.marca || p.marca === _lastFilters.marca;
             return textMatch && rubroMatch && segmentoMatch && marcaMatch;
        });
        const sortFunction = await window.getGlobalProductSortFunction();
        productos.sort(sortFunction);
        if (productos.length === 0) { container.innerHTML = `<p class="text-gray-500 text-center p-4">No hay productos.</p>`; return; }
        let tableHTML = `<table class="min-w-full bg-white text-sm"><thead class="bg-gray-100 sticky top-0 z-10"><tr><th class="py-2 px-4 border-b text-left">Producto</th><th class="py-2 px-4 border-b text-center w-40">Cant. Nueva</th></tr></thead><tbody>`;
        let lastHeaderKey = null; const firstSortKey = window._sortPreferenceCache ? window._sortPreferenceCache[0] : 'segmento';
        productos.forEach(p => {
            const currentHeaderValue = p[firstSortKey] || `Sin ${firstSortKey}`;
            if (currentHeaderValue !== lastHeaderKey) { lastHeaderKey = currentHeaderValue; tableHTML += `<tr><td colspan="2" class="py-2 px-4 bg-gray-300 font-bold text-gray-800 sticky top-[calc(theme(height.10))] z-[9]">${lastHeaderKey}</td></tr>`; }
            const vPor = p.ventaPor || {und:true}; let uType='Und', cFactor=1, cStockU=p.cantidadUnidades||0; if(vPor.cj){uType='Cj';cFactor=p.unidadesPorCaja||1;}else if(vPor.paq){uType='Paq';cFactor=p.unidadesPorPaquete||1;} cFactor=Math.max(1,cFactor); const cStockDispU=Math.floor(cStockU/cFactor);
            tableHTML += `<tr class="hover:bg-gray-50"><td class="py-2 px-4 border-b"><p class="font-medium">${p.presentacion}</p><p class="text-xs text-gray-500">${p.marca||'S/M'} - Actual: ${cStockDispU} ${uType}. (${cStockU} Und.)</p></td><td class="py-2 px-4 border-b text-center align-middle"><div class="flex items-center justify-center"><input type="number" value="${cStockDispU}" data-doc-id="${p.id}" data-conversion-factor="${cFactor}" min="0" step="1" class="w-20 p-1 text-center border rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500"><span class="ml-2">${uType}.</span></div></td></tr>`;
        });
        tableHTML += `</tbody></table>`; container.innerHTML = tableHTML;
    }

    async function handleGuardarAjusteMasivo() {
        const inputs = document.querySelectorAll('#ajusteListContainer input[data-doc-id]'); if (inputs.length === 0) { _showModal('Aviso', 'Lista vacía.'); return; }
        const batch = _writeBatch(_db); let changesCount = 0; let invalidValues = false; inputs.forEach(i => i.classList.remove('border-red-500','ring-1','ring-red-500'));
        inputs.forEach(input => { const dId=input.dataset.docId, cF=parseInt(input.dataset.conversionFactor,10)||1, nVStr=input.value.trim(), nV=parseInt(nVStr,10), pOrig=_inventarioCache.find(p=>p.id===dId); if(nVStr===''||isNaN(nV)||!Number.isInteger(nV)||nV<0){if(nVStr!==''){input.classList.add('border-red-500','ring-1','ring-red-500'); invalidValues=true;} return;} if(pOrig){const nCantU=nV*cF; if((pOrig.cantidadUnidades||0)!==nCantU){const dRef=_doc(_db,`artifacts/${_appId}/users/${_userId}/inventario`,dId); batch.update(dRef,{cantidadUnidades:nCantU}); changesCount++;}} });
        if(invalidValues){_showModal('Error','Valores inválidos.');return;} if(changesCount===0){_showModal('Aviso','No hay cambios.');return;}
        _showModal('Confirmar Cambios', `Actualizar ${changesCount} producto(s)?`, async () => { _showModal('Progreso','Guardando...'); try { await batch.commit(); _showModal('Éxito','Ajuste realizado con exito'); } catch (error) { console.error("Error ajuste:",error); _showModal('Error',`Error: ${error.message}`); } }, 'Sí, Actualizar', null, true);
    }

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
                                <h3 class="text-lg font-semibold text-gray-700 mb-2 border-b pb-2 flex justify-between items-center"> <span>Rubros</span> <button onclick="window.inventarioModule.showAddCategoryModal('rubros', 'Rubro')" class="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600">+</button> </h3>
                                <div id="rubros-list" class="space-y-2 max-h-60 overflow-y-auto border p-2 rounded bg-gray-50"></div>
                            </div>
                            <div>
                                <h3 class="text-lg font-semibold text-gray-700 mb-2 border-b pb-2 flex justify-between items-center"> <span>Segmentos</span> <button onclick="window.inventarioModule.showAddCategoryModal('segmentos', 'Segmento')" class="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600">+</button> </h3>
                                <div id="segmentos-list" class="space-y-2 max-h-60 overflow-y-auto border p-2 rounded bg-gray-50"></div>
                            </div>
                            <div>
                                <h3 class="text-lg font-semibold text-gray-700 mb-2 border-b pb-2 flex justify-between items-center"> <span>Marcas</span> <button onclick="window.inventarioModule.showAddCategoryModal('marcas', 'Marca')" class="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600">+</button> </h3>
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
        const container = document.getElementById(containerId); if (!container) return; container.innerHTML = `<p class="text-gray-500 text-sm p-2">Cargando...</p>`;
        const collectionRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/${collectionName}`);
        const unsubscribe = _onSnapshot(collectionRef, (snapshot) => {
            const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            if (items.length === 0) { container.innerHTML = `<p class="text-gray-500 text-sm p-2">No hay ${itemName.toLowerCase()}s.</p>`; return; }
            container.innerHTML = items.map(item => `<div class="flex justify-between items-center bg-white p-2 rounded shadow-sm border border-gray-200"><span class="text-gray-800 text-sm flex-grow mr-2">${item.name}</span><div class="flex-shrink-0 space-x-1"><button onclick="window.inventarioModule.handleDeleteDataItem('${collectionName}', '${item.name}', '${itemName}', '${item.id}')" class="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600" title="Eliminar">X</button></div></div>`).join('');
        }, (error) => { if (window.isLoggingOut && error.code === 'permission-denied') { return; } console.error(`Error listener ${collectionName}:`, error); container.innerHTML = `<p class="text-red-500 text-center p-2">Error al cargar.</p>`; });
        _activeListeners.push(unsubscribe);
    }

    function showAddCategoryModal(collectionName, itemName) {
         if (window.adminModule?.showAddCategoryModal) { window.adminModule.showAddCategoryModal(collectionName, itemName); }
         else if (_showAddItemModal) { _showAddItemModal(collectionName, itemName); }
         else { console.error("Función showAddCategoryModal no encontrada."); }
    }

    async function handleDeleteDataItem(collectionName, itemName, itemType, itemId) {
        if (_userRole !== 'admin') { _showModal('Acceso Denegado', 'Solo administradores.'); return; }
        const fieldMap = { rubros: 'rubro', segmentos: 'segmento', marcas: 'marca' }; const fieldName = fieldMap[collectionName]; if (!fieldName) { _showModal('Error Interno', 'Tipo no reconocido.'); return; }
        _showModal('Progreso', `Verificando uso de "${itemName}"...`); const inventarioRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`); const q = _query(inventarioRef, _where(fieldName, "==", itemName));
        try { const usageSnapshot = await _getDocs(q); if (!usageSnapshot.empty) { _showModal('Error al Eliminar', `"${itemName}" está en uso por ${usageSnapshot.size} producto(s). No se puede eliminar.`); return; }
            _showModal('Confirmar Eliminación', `Eliminar ${itemType} "${itemName}"? Se propagará y es IRREVERSIBLE.`, async () => { _showModal('Progreso', `Eliminando "${itemName}"...`); try { await _deleteDoc(_doc(_db, `artifacts/${_appId}/users/${_userId}/${collectionName}`, itemId)); if (window.adminModule?.propagateCategoryChange) { _showModal('Progreso', `Propagando eliminación...`); await window.adminModule.propagateCategoryChange(collectionName, itemId, null); } else { console.warn('Propagate function not found.'); } if (collectionName === 'segmentos') invalidateSegmentOrderCache(); _showModal('Éxito', `${itemType} "${itemName}" eliminado.`); } catch (deleteError) { console.error(`Error eliminando/propagando ${itemName}:`, deleteError); _showModal('Error', `Error: ${deleteError.message}`); } }, 'Sí, Eliminar', null, true);
        } catch (error) { console.error(`Error verificando uso ${itemName}:`, error); _showModal('Error', `Error al verificar: ${error.message}`); }
    }

    function showAgregarProductoView() {
        if (_userRole !== 'admin') { _showModal('Acceso Denegado', 'Solo administradores.'); return; } if (_floatingControls) _floatingControls.classList.add('hidden');
        _mainContent.innerHTML = `
            <div class="p-4 pt-8"> <div class="container mx-auto max-w-2xl"> <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl text-center">
                <h2 class="text-2xl font-bold text-gray-800 mb-6">Agregar Producto</h2>
                <form id="productoForm" class="space-y-4 text-left">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4"> <div> <label for="rubro">Rubro:</label> <div class="flex items-center space-x-2"> <select id="rubro" class="w-full px-4 py-2 border rounded-lg" required></select> <button type="button" onclick="window.inventarioModule.showAddCategoryModal('rubros', 'Rubro')" class="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-xs">+</button> </div> </div> <div> <label for="segmento">Segmento:</label> <div class="flex items-center space-x-2"> <select id="segmento" class="w-full px-4 py-2 border rounded-lg" required></select> <button type="button" onclick="window.inventarioModule.showAddCategoryModal('segmentos', 'Segmento')" class="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-xs">+</button> </div> </div> <div> <label for="marca">Marca:</label> <div class="flex items-center space-x-2"> <select id="marca" class="w-full px-4 py-2 border rounded-lg" required></select> <button type="button" onclick="window.inventarioModule.showAddCategoryModal('marcas', 'Marca')" class="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-xs">+</button> </div> </div> <div> <label for="presentacion">Presentación:</label> <input type="text" id="presentacion" class="w-full px-4 py-2 border rounded-lg" required> </div> </div>
                    <div class="border-t pt-4 mt-4"> <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"> <div> <label class="block mb-2">Venta por:</label> <div id="ventaPorContainer" class="flex items-center space-x-4"> <label class="flex items-center"><input type="checkbox" id="ventaPorUnd" class="h-4 w-4"> <span class="ml-2">Und.</span></label> <label class="flex items-center"><input type="checkbox" id="ventaPorPaq" class="h-4 w-4"> <span class="ml-2">Paq.</span></label> <label class="flex items-center"><input type="checkbox" id="ventaPorCj" class="h-4 w-4"> <span class="ml-2">Cj.</span></label> </div> </div> <div class="mt-4 md:mt-0"> <label class="flex items-center cursor-pointer"> <input type="checkbox" id="manejaVaciosCheck" class="h-4 w-4"> <span class="ml-2 font-medium">Maneja Vacío</span> </label> <div id="tipoVacioContainer" class="mt-2 hidden"> <label for="tipoVacioSelect" class="block text-sm">Tipo:</label> <select id="tipoVacioSelect" class="w-full px-2 py-1 border rounded-lg text-sm bg-gray-50"> <option value="">Seleccione...</option> <option value="1/4 - 1/3">1/4 - 1/3</option> <option value="ret 350 ml">Ret 350 ml</option> <option value="ret 1.25 Lts">Ret 1.25 Lts</option> </select> </div> </div> </div> <div id="empaquesContainer" class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4"></div> <div id="preciosContainer" class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4"></div> </div>
                    <div class="border-t pt-4 mt-4"> <div class="grid grid-cols-1 md:grid-cols-2 gap-4"> <div> <label>Cantidad Inicial:</label> <input type="number" id="cantidadInicial" value="0" class="w-full px-4 py-2 border rounded-lg bg-gray-100" readonly> <p class="text-xs text-gray-500 mt-1">Siempre 0.</p> </div> <div> <label for="ivaTipo">IVA:</label> <select id="ivaTipo" class="w-full px-4 py-2 border rounded-lg" required> <option value="16" selected>16%</option> <option value="0">Exento 0%</option> </select> </div> </div> </div>
                    <button type="submit" class="w-full px-6 py-3 bg-green-500 text-white rounded-lg shadow-md hover:bg-green-600">Guardar y Propagar</button>
                </form>
                <button id="backToInventarioBtn" class="mt-4 w-full px-6 py-3 bg-gray-400 text-white rounded-lg shadow-md hover:bg-gray-500">Volver</button>
            </div> </div> </div>
        `;
        _populateDropdown(`artifacts/${_appId}/users/${_userId}/rubros`, 'rubro', 'Rubro'); _populateDropdown(`artifacts/${_appId}/users/${_userId}/segmentos`, 'segmento', 'Segmento'); _populateDropdown(`artifacts/${_appId}/users/${_userId}/marcas`, 'marca', 'Marca');
        const vPorCont=document.getElementById('ventaPorContainer'), pCont=document.getElementById('preciosContainer'), eCont=document.getElementById('empaquesContainer'), mVacioCheck=document.getElementById('manejaVaciosCheck'), tVacioCont=document.getElementById('tipoVacioContainer'), tVacioSel=document.getElementById('tipoVacioSelect');
        const updateDynInputs=()=>{eCont.innerHTML=''; pCont.innerHTML=''; const vPaq=document.getElementById('ventaPorPaq').checked, vCj=document.getElementById('ventaPorCj').checked, vUnd=document.getElementById('ventaPorUnd').checked; if(vPaq)eCont.innerHTML+=`<div><label class="text-sm">Und/Paq:</label><input type="number" id="unidadesPorPaquete" min="1" class="w-full px-2 py-1 border rounded" value="1" required></div>`; if(vCj)eCont.innerHTML+=`<div><label class="text-sm">Und/Cj:</label><input type="number" id="unidadesPorCaja" min="1" class="w-full px-2 py-1 border rounded" value="1" required></div>`; if(vUnd)pCont.innerHTML+=`<div><label class="text-sm">Precio Und.</label><input type="number" step="0.01" min="0" id="precioUnd" class="w-full px-2 py-1 border rounded" required></div>`; if(vPaq)pCont.innerHTML+=`<div><label class="text-sm">Precio Paq.</label><input type="number" step="0.01" min="0" id="precioPaq" class="w-full px-2 py-1 border rounded" required></div>`; if(vCj)pCont.innerHTML+=`<div><label class="text-sm">Precio Cj.</label><input type="number" step="0.01" min="0" id="precioCj" class="w-full px-2 py-1 border rounded" required></div>`; pCont.querySelectorAll('input').forEach(i=>{i.required=document.getElementById(`ventaPor${i.id.substring(6)}`)?.checked??false;});};
        mVacioCheck.addEventListener('change',()=>{if(mVacioCheck.checked){tVacioCont.classList.remove('hidden');tVacioSel.required=true;}else{tVacioCont.classList.add('hidden');tVacioSel.required=false;tVacioSel.value='';}}); vPorCont.addEventListener('change',updateDynInputs); updateDynInputs();
        document.getElementById('productoForm').addEventListener('submit', agregarProducto); document.getElementById('backToInventarioBtn').addEventListener('click', showInventarioSubMenu);
    }

    function getProductoDataFromForm(isEditing = false) {
        const undPaqInput = document.getElementById('unidadesPorPaquete'), undCjInput = document.getElementById('unidadesPorCaja'); const undPaq = Math.max(1, undPaqInput ? (parseInt(undPaqInput.value, 10) || 1) : 1); const undCj = Math.max(1, undCjInput ? (parseInt(undCjInput.value, 10) || 1) : 1); const pUndInput = document.getElementById('precioUnd'), pPaqInput = document.getElementById('precioPaq'), pCjInput = document.getElementById('precioCj'); const precios = { und: Math.max(0, pUndInput ? (parseFloat(pUndInput.value) || 0) : 0), paq: Math.max(0, pPaqInput ? (parseFloat(pPaqInput.value) || 0) : 0), cj: Math.max(0, pCjInput ? (parseFloat(pCjInput.value) || 0) : 0), }; let pFinalUnd = 0; if (precios.und > 0) pFinalUnd = precios.und; else if (precios.paq > 0 && undPaq > 0) pFinalUnd = precios.paq / undPaq; else if (precios.cj > 0 && undCj > 0) pFinalUnd = precios.cj / undCj; pFinalUnd = parseFloat(pFinalUnd.toFixed(2)); const cantUnd = isEditing ? (parseInt(document.getElementById('cantidadActual').value, 10) || 0) : 0; const manejaVac = document.getElementById('manejaVaciosCheck').checked; const tipoVac = document.getElementById('tipoVacioSelect').value;
        return { rubro: document.getElementById('rubro').value, segmento: document.getElementById('segmento').value, marca: document.getElementById('marca').value, presentacion: document.getElementById('presentacion').value.trim(), unidadesPorPaquete: undPaq, unidadesPorCaja: undCj, ventaPor: { und: document.getElementById('ventaPorUnd').checked, paq: document.getElementById('ventaPorPaq').checked, cj: document.getElementById('ventaPorCj').checked }, manejaVacios: manejaVac, tipoVacio: manejaVac ? tipoVac : null, precios: precios, precioPorUnidad: pFinalUnd, cantidadUnidades: cantUnd, iva: parseInt(document.getElementById('ivaTipo').value, 10) };
    }

    async function agregarProducto(e) {
        e.preventDefault(); if (_userRole !== 'admin') return; const pData = getProductoDataFromForm(false); if (!pData.rubro||!pData.segmento||!pData.marca||!pData.presentacion){_showModal('Error','Completa campos.');return;} if (!pData.ventaPor.und&&!pData.ventaPor.paq&&!pData.ventaPor.cj){_showModal('Error','Selecciona forma venta.');return;} if (pData.manejaVacios&&!pData.tipoVacio){_showModal('Error','Selecciona tipo vacío.');document.getElementById('tipoVacioSelect')?.focus();return;} let pValido=(pData.ventaPor.und&&pData.precios.und>0)||(pData.ventaPor.paq&&pData.precios.paq>0)||(pData.ventaPor.cj&&pData.precios.cj>0); if(!pValido){_showModal('Error','Ingresa precio > 0.');document.querySelector('#preciosContainer input[required]')?.focus();return;} _showModal('Progreso','Verificando...');
        try { const invRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`); const q = _query(invRef, _where("rubro","==",pData.rubro),_where("segmento","==",pData.segmento),_where("marca","==",pData.marca),_where("presentacion","==",pData.presentacion)); const qSnap = await _getDocs(q); if (!qSnap.empty) { _showModal('Duplicado', 'Ya existe.'); return; } const dRef = await _addDoc(invRef, pData); if (window.adminModule?.propagateProductChange) { await window.adminModule.propagateProductChange(dRef.id, pData); } _showModal('Éxito','Producto agregado.'); showAgregarProductoView(); } catch (err) { console.error("Error agregando:", err); _showModal('Error',`Error: ${err.message}`); }
    }

    function showModifyDeleteView() {
         if (_floatingControls) _floatingControls.classList.add('hidden'); const isAdmin = _userRole === 'admin';
        _mainContent.innerHTML = `<div class="p-4 pt-8"> <div class="container mx-auto"> <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl"> <h2 class="text-2xl font-bold mb-6 text-center">Ver Productos / ${isAdmin?'Modificar Def.':'Consultar Stock'}</h2> ${getFiltrosHTML('modify')} <div id="productosListContainer" class="overflow-x-auto max-h-96 border rounded-lg"> <p class="text-gray-500 text-center p-4">Cargando...</p> </div> <div class="mt-6 flex flex-col sm:flex-row gap-4"> <button id="backToInventarioBtn" class="w-full px-6 py-3 bg-gray-400 text-white rounded-lg shadow-md hover:bg-gray-500">Volver</button> ${isAdmin?`<button id="deleteAllProductosBtn" class="w-full px-6 py-3 bg-red-600 text-white rounded-lg shadow-md hover:bg-red-700">Eliminar Todos</button>`:''} </div> </div> </div> </div>`;
        document.getElementById('backToInventarioBtn').addEventListener('click', showInventarioSubMenu); if (isAdmin) document.getElementById('deleteAllProductosBtn')?.addEventListener('click', handleDeleteAllProductos); const rCallback = () => renderProductosList('productosListContainer', !isAdmin); _populateDropdown(`artifacts/${_appId}/users/${_userId}/rubros`, 'modify-filter-rubro', 'Rubro'); setupFiltros('modify', rCallback); startMainInventarioListener(rCallback);
    }

    function getFiltrosHTML(prefix) { const cSearch = _lastFilters.searchTerm || ''; return `<div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 p-4 border rounded-lg bg-gray-50"> <input type="text" id="${prefix}-search-input" placeholder="Buscar..." class="md:col-span-4 w-full px-4 py-2 border rounded-lg text-sm" value="${cSearch}"> <div> <label for="${prefix}-filter-rubro" class="text-xs">Rubro</label> <select id="${prefix}-filter-rubro" class="w-full px-2 py-1 border rounded-lg text-sm"><option value="">Todos</option></select> </div> <div> <label for="${prefix}-filter-segmento" class="text-xs">Segmento</label> <select id="${prefix}-filter-segmento" class="w-full px-2 py-1 border rounded-lg text-sm" disabled><option value="">Todos</option></select> </div> <div> <label for="${prefix}-filter-marca" class="text-xs">Marca</label> <select id="${prefix}-filter-marca" class="w-full px-2 py-1 border rounded-lg text-sm" disabled><option value="">Todos</option></select> </div> <button id="${prefix}-clear-filters-btn" class="bg-gray-300 text-xs rounded-lg self-end py-1.5 px-3 hover:bg-gray-400">Limpiar</button> </div> `; }

    function setupFiltros(prefix, renderCallback) {
        const sInput=document.getElementById(`${prefix}-search-input`), rFilt=document.getElementById(`${prefix}-filter-rubro`), sFilt=document.getElementById(`${prefix}-filter-segmento`), mFilt=document.getElementById(`${prefix}-filter-marca`), cBtn=document.getElementById(`${prefix}-clear-filters-btn`); if(!sInput||!rFilt||!sFilt||!mFilt||!cBtn) return;
        function updateDeps(trigger){ const selR=rFilt.value, selS=sFilt.value; if(trigger==='rubro'||trigger==='init'){ const cSegVal=(trigger==='init')?_lastFilters.segmento:''; sFilt.innerHTML='<option value="">Todos</option>'; sFilt.disabled=true; sFilt.value=cSegVal; if(selR){ const segs=[...new Set(_inventarioCache.filter(p=>p.rubro===selR&&p.segmento).map(p=>p.segmento))].sort(); if(segs.length>0){segs.forEach(s=>sFilt.innerHTML+=`<option value="${s}" ${s===cSegVal?'selected':''}>${s}</option>`); sFilt.disabled=false; sFilt.value=cSegVal;}} if(sFilt.value!==cSegVal)_lastFilters.segmento=''; } if(trigger==='rubro'||trigger==='segmento'||trigger==='init'){ const cMarVal=(trigger==='init')?_lastFilters.marca:''; mFilt.innerHTML='<option value="">Todos</option>'; mFilt.disabled=true; mFilt.value=cMarVal; if(selR){ const marcas=[...new Set(_inventarioCache.filter(p=>p.rubro===selR&&(!selS||p.segmento===selS)&&p.marca).map(p=>p.marca))].sort(); if(marcas.length>0){marcas.forEach(m=>mFilt.innerHTML+=`<option value="${m}" ${m===cMarVal?'selected':''}>${m}</option>`); mFilt.disabled=false; mFilt.value=cMarVal;}} if(mFilt.value!==cMarVal)_lastFilters.marca=''; } }
        setTimeout(()=>{rFilt.value=_lastFilters.rubro||''; updateDeps('init'); if(typeof renderCallback==='function')renderCallback();}, 300); const applySave=()=>{_lastFilters.searchTerm=sInput.value||''; _lastFilters.rubro=rFilt.value||''; _lastFilters.segmento=sFilt.value||''; _lastFilters.marca=mFilt.value||''; if(typeof renderCallback==='function')renderCallback();};
        sInput.addEventListener('input', applySave); rFilt.addEventListener('change', ()=>{_lastFilters.segmento=''; _lastFilters.marca=''; updateDeps('rubro'); applySave();}); sFilt.addEventListener('change', ()=>{_lastFilters.marca=''; updateDeps('segmento'); applySave();}); mFilt.addEventListener('change', applySave); cBtn.addEventListener('click', ()=>{sInput.value=''; rFilt.value=''; updateDeps('rubro'); applySave();});
    }

    async function renderProductosList(elementId, readOnly = false) {
        const cont=document.getElementById(elementId); if (!cont) return; let prods=[..._inventarioCache]; prods=prods.filter(p=>{const sL=(_lastFilters.searchTerm||'').toLowerCase(); const tM=!sL||(p.presentacion&&p.presentacion.toLowerCase().includes(sL))||(p.marca&&p.marca.toLowerCase().includes(sL))||(p.segmento&&p.segmento.toLowerCase().includes(sL)); const rM=!_lastFilters.rubro||p.rubro===_lastFilters.rubro; const sM=!_lastFilters.segmento||p.segmento===_lastFilters.segmento; const mM=!_lastFilters.marca||p.marca===_lastFilters.marca; return tM&&rM&&sM&&mM;}); const sortFunc=await window.getGlobalProductSortFunction(); prods.sort(sortFunc);
        if (prods.length === 0) { cont.innerHTML=`<p class="text-center text-gray-500 p-4">No hay productos.</p>`; return; } const cols=readOnly?3:4; let tHTML=`<table class="min-w-full bg-white text-sm"><thead class="bg-gray-200 sticky top-0 z-10"><tr><th class="py-2 px-3 text-left">Presentación</th><th class="py-2 px-3 text-right">Precio</th><th class="py-2 px-3 text-center">Stock</th>${!readOnly?`<th class="py-2 px-3 text-center">Acciones</th>`:''}</tr></thead><tbody>`; let lastHKey=null; const fSortKey=window._sortPreferenceCache?window._sortPreferenceCache[0]:'segmento';
        prods.forEach(p=>{const curHVal=p[fSortKey]||`Sin ${fSortKey}`; if(curHVal!==lastHKey){lastHKey=curHVal; tHTML+=`<tr><td colspan="${cols}" class="py-2 px-4 bg-gray-300 font-bold sticky top-[calc(theme(height.10))] z-[9]">${lastHKey}</td></tr>`;} const vPor=p.ventaPor||{und:true}, precios=p.precios||{und:p.precioPorUnidad||0}; let dPres=p.presentacion||'N/A', dPrecio='$0.00', dStock=`${p.cantidadUnidades||0} Und`, fStock=1; if(vPor.cj){if(p.unidadesPorCaja)dPres+=` (${p.unidadesPorCaja} und.)`;dPrecio=`$${(precios.cj||0).toFixed(2)}`;fStock=Math.max(1,p.unidadesPorCaja||1);dStock=`${Math.floor((p.cantidadUnidades||0)/fStock)} Cj`;}else if(vPor.paq){if(p.unidadesPorPaquete)dPres+=` (${p.unidadesPorPaquete} und.)`;dPrecio=`$${(precios.paq||0).toFixed(2)}`;fStock=Math.max(1,p.unidadesPorPaquete||1);dStock=`${Math.floor((p.cantidadUnidades||0)/fStock)} Paq`;}else{dPrecio=`$${(precios.und||0).toFixed(2)}`;} const stockUnd=p.cantidadUnidades||0, stockTip=`${stockUnd} Und. Base`; tHTML+=`<tr class="hover:bg-gray-50"><td class="py-2 px-3 border-b">${dPres}</td><td class="py-2 px-3 border-b text-right font-medium">${dPrecio}</td><td class="py-2 px-3 border-b text-center font-medium" title="${stockTip}">${dStock}</td> ${!readOnly?`<td class="py-2 px-3 border-b text-center space-x-1"><button onclick="window.inventarioModule.editProducto('${p.id}')" class="px-2 py-1 bg-yellow-500 text-white text-xs rounded hover:bg-yellow-600">Edt</button><button onclick="window.inventarioModule.deleteProducto('${p.id}')" class="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600">Del</button></td>`:''} </tr>`; }); tHTML+=`</tbody></table>`; cont.innerHTML=tHTML;
    }

    function editProducto(productId) {
        if (_userRole !== 'admin') { _showModal('Acceso Denegado', 'Solo administradores.'); return; } const prod = _inventarioCache.find(p => p.id === productId); if (!prod) { _showModal('Error', 'Producto no encontrado.'); return; } if (_floatingControls) _floatingControls.classList.add('hidden');
        _mainContent.innerHTML = `<div class="p-4 pt-8"> <div class="container mx-auto max-w-2xl"> <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl text-center"> <h2 class="text-2xl font-bold mb-6">Editar Producto</h2> <form id="editProductoForm" class="space-y-4 text-left"> <div class="grid grid-cols-1 md:grid-cols-2 gap-4"> <div> <label>Rubro:</label> <div class="flex items-center space-x-2"> <select id="rubro" class="w-full px-4 py-2 border rounded-lg" required></select> <button type="button" onclick="window.inventarioModule.showAddCategoryModal('rubros','Rubro')" class="px-3 py-2 bg-blue-500 text-white rounded-lg text-xs">+</button> </div> </div> <div> <label>Segmento:</label> <div class="flex items-center space-x-2"> <select id="segmento" class="w-full px-4 py-2 border rounded-lg" required></select> <button type="button" onclick="window.inventarioModule.showAddCategoryModal('segmentos','Segmento')" class="px-3 py-2 bg-blue-500 text-white rounded-lg text-xs">+</button> </div> </div> <div> <label>Marca:</label> <div class="flex items-center space-x-2"> <select id="marca" class="w-full px-4 py-2 border rounded-lg" required></select> <button type="button" onclick="window.inventarioModule.showAddCategoryModal('marcas','Marca')" class="px-3 py-2 bg-blue-500 text-white rounded-lg text-xs">+</button> </div> </div> <div> <label>Presentación:</label> <input type="text" id="presentacion" class="w-full px-4 py-2 border rounded-lg" required> </div> </div> <div class="border-t pt-4 mt-4"> <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"> <div> <label class="block mb-2">Venta por:</label> <div id="ventaPorContainer" class="flex space-x-4"> <label><input type="checkbox" id="ventaPorUnd"> Und.</label> <label><input type="checkbox" id="ventaPorPaq"> Paq.</label> <label><input type="checkbox" id="ventaPorCj"> Cj.</label> </div> </div> <div class="mt-4 md:mt-0"> <label class="flex items-center"> <input type="checkbox" id="manejaVaciosCheck"> <span class="ml-2">Maneja Vacío</span> </label> <div id="tipoVacioContainer" class="mt-2 hidden"> <label class="text-sm">Tipo:</label> <select id="tipoVacioSelect" class="w-full px-2 py-1 border rounded text-sm"> <option value="">Seleccione...</option> <option value="1/4 - 1/3">1/4 - 1/3</option> <option value="ret 350 ml">Ret 350 ml</option> <option value="ret 1.25 Lts">Ret 1.25 Lts</option> </select> </div> </div> </div> <div id="empaquesContainer" class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4"></div> <div id="preciosContainer" class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4"></div> </div> <div class="border-t pt-4 mt-4"> <div class="grid grid-cols-1 md:grid-cols-2 gap-4"> <div> <label>Stock (Und):</label> <input type="number" id="cantidadActual" value="${prod.cantidadUnidades||0}" class="w-full px-4 py-2 border rounded bg-gray-100" readonly> <p class="text-xs text-gray-500 mt-1">Modificar en "Ajuste Masivo".</p> </div> <div> <label>IVA:</label> <select id="ivaTipo" class="w-full px-4 py-2 border rounded" required> <option value="16">16%</option> <option value="0">Exento 0%</option> </select> </div> </div> </div> <button type="submit" class="w-full px-6 py-3 bg-blue-500 text-white rounded-lg shadow-md hover:bg-blue-600">Guardar y Propagar</button> </form> <button id="backToModifyDeleteBtn" class="mt-4 w-full px-6 py-3 bg-gray-400 text-white rounded-lg shadow-md hover:bg-gray-500">Volver</button> </div> </div> </div>`;
        _populateDropdown(`artifacts/${_appId}/users/${_userId}/rubros`, 'rubro', 'Rubro', prod.rubro); _populateDropdown(`artifacts/${_appId}/users/${_userId}/segmentos`, 'segmento', 'Segmento', prod.segmento); _populateDropdown(`artifacts/${_appId}/users/${_userId}/marcas`, 'marca', 'Marca', prod.marca);
        const vPorCont=document.getElementById('ventaPorContainer'), pCont=document.getElementById('preciosContainer'), eCont=document.getElementById('empaquesContainer'), mVacioCheck=document.getElementById('manejaVaciosCheck'), tVacioCont=document.getElementById('tipoVacioContainer'), tVacioSel=document.getElementById('tipoVacioSelect');
        const updateDynInputs=()=>{eCont.innerHTML=''; pCont.innerHTML=''; const vPaq=document.getElementById('ventaPorPaq').checked, vCj=document.getElementById('ventaPorCj').checked, vUnd=document.getElementById('ventaPorUnd').checked; if(vPaq)eCont.innerHTML+=`<div><label class="text-sm">Und/Paq:</label><input type="number" id="unidadesPorPaquete" min="1" class="w-full px-2 py-1 border rounded" value="1" required></div>`; if(vCj)eCont.innerHTML+=`<div><label class="text-sm">Und/Cj:</label><input type="number" id="unidadesPorCaja" min="1" class="w-full px-2 py-1 border rounded" value="1" required></div>`; if(vUnd)pCont.innerHTML+=`<div><label class="text-sm">Precio Und.</label><input type="number" step="0.01" min="0" id="precioUnd" class="w-full px-2 py-1 border rounded" required></div>`; if(vPaq)pCont.innerHTML+=`<div><label class="text-sm">Precio Paq.</label><input type="number" step="0.01" min="0" id="precioPaq" class="w-full px-2 py-1 border rounded" required></div>`; if(vCj)pCont.innerHTML+=`<div><label class="text-sm">Precio Cj.</label><input type="number" step="0.01" min="0" id="precioCj" class="w-full px-2 py-1 border rounded" required></div>`; pCont.querySelectorAll('input').forEach(i=>{i.required=document.getElementById(`ventaPor${i.id.substring(6)}`)?.checked??false;});};
        mVacioCheck.addEventListener('change',()=>{if(mVacioCheck.checked){tVacioCont.classList.remove('hidden');tVacioSel.required=true;}else{tVacioCont.classList.add('hidden');tVacioSel.required=false;tVacioSel.value='';}}); vPorCont.addEventListener('change',updateDynInputs);
        setTimeout(()=>{document.getElementById('presentacion').value=prod.presentacion||''; document.getElementById('ivaTipo').value=prod.iva!==undefined?prod.iva:16; if(prod.ventaPor){document.getElementById('ventaPorUnd').checked=prod.ventaPor.und||false; document.getElementById('ventaPorPaq').checked=prod.ventaPor.paq||false; document.getElementById('ventaPorCj').checked=prod.ventaPor.cj||false;}else{document.getElementById('ventaPorUnd').checked=true;} updateDynInputs(); const uPaqIn=document.getElementById('unidadesPorPaquete'); if(uPaqIn&&prod.ventaPor?.paq)uPaqIn.value=prod.unidadesPorPaquete||1; const uCjIn=document.getElementById('unidadesPorCaja'); if(uCjIn&&prod.ventaPor?.cj)uCjIn.value=prod.unidadesPorCaja||1; const pExist=prod.precios||{und:prod.precioPorUnidad||0}; const pUndIn=document.getElementById('precioUnd'); if(pUndIn)pUndIn.value=pExist.und||0; const pPaqIn=document.getElementById('precioPaq'); if(pPaqIn)pPaqIn.value=pExist.paq||0; const pCjIn=document.getElementById('precioCj'); if(pCjIn)pCjIn.value=pExist.cj||0; if(prod.manejaVacios){mVacioCheck.checked=true; tVacioCont.classList.remove('hidden'); tVacioSel.required=true; tVacioSel.value=prod.tipoVacio||'';}else{mVacioCheck.checked=false; tVacioCont.classList.add('hidden'); tVacioSel.required=false;}}, 300);
        document.getElementById('editProductoForm').addEventListener('submit', (e)=>handleUpdateProducto(e, productId)); document.getElementById('backToModifyDeleteBtn').addEventListener('click', showModifyDeleteView);
    }

    async function handleUpdateProducto(e, productId) {
        e.preventDefault(); if (_userRole !== 'admin') return; const upData = getProductoDataFromForm(true); const pOrig = _inventarioCache.find(p => p.id === productId); if (!pOrig) { _showModal('Error', 'Original no encontrado.'); return; } if (!upData.rubro||!upData.segmento||!upData.marca||!upData.presentacion){_showModal('Error','Completa campos.');return;} if (!upData.ventaPor.und&&!upData.ventaPor.paq&&!upData.ventaPor.cj){_showModal('Error','Selecciona forma venta.');return;} if (upData.manejaVacios&&!upData.tipoVacio){_showModal('Error','Selecciona tipo vacío.');document.getElementById('tipoVacioSelect')?.focus();return;} let pValido=(upData.ventaPor.und&&upData.precios.und>0)||(upData.ventaPor.paq&&upData.precios.paq>0)||(upData.ventaPor.cj&&upData.precios.cj>0); if(!pValido){_showModal('Error','Ingresa precio > 0.');document.querySelector('#preciosContainer input[required]')?.focus();return;} upData.cantidadUnidades=pOrig.cantidadUnidades||0; _showModal('Progreso','Guardando...');
        try { await _setDoc(_doc(_db, `artifacts/${_appId}/users/${_userId}/inventario`, productId), upData); if (window.adminModule?.propagateProductChange) await window.adminModule.propagateProductChange(productId, upData); _showModal('Éxito','Producto modificado.'); showModifyDeleteView(); } catch (err) { console.error("Error modificando:", err); _showModal('Error',`Error: ${err.message}`); }
    }

    function deleteProducto(productId) {
        if (_userRole !== 'admin') { _showModal('Acceso Denegado', 'Solo administradores.'); return; } const prod = _inventarioCache.find(p => p.id === productId); if (!prod) { _showModal('Error', 'Producto no encontrado.'); return; }
        _showModal('Confirmar Eliminación', `Eliminar "${prod.presentacion}"? Se propagará y es IRREVERSIBLE.`, async () => { _showModal('Progreso', `Eliminando "${prod.presentacion}"...`); try { await _deleteDoc(_doc(_db, `artifacts/${_appId}/users/${_userId}/inventario`, productId)); if (window.adminModule?.propagateProductChange) { _showModal('Progreso', `Propagando...`); await window.adminModule.propagateProductChange(productId, null); } _showModal('Éxito','Producto eliminado.'); } catch (e) { console.error("Error eliminando:", e); _showModal('Error', `Error: ${e.message}`); } }, 'Sí, Eliminar', null, true);
    }

    async function handleDeleteAllProductos() {
        if (_userRole !== 'admin') return; _showModal('Confirmación Extrema', `Eliminar TODOS los productos? IRREVERSIBLE.`, async () => { _showModal('Progreso', 'Eliminando...'); try { const cRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`); const snap = await _getDocs(cRef); if (snap.empty) { _showModal('Aviso', 'No hay productos.'); return; } const pIds = snap.docs.map(d => d.id); const BATCH_LIMIT = 490; let batch = _writeBatch(_db), ops = 0, deleted = 0; for (const dS of snap.docs) { batch.delete(dS.ref); ops++; if (ops >= BATCH_LIMIT) { await batch.commit(); deleted += ops; batch = _writeBatch(_db); ops = 0; } } if (ops > 0) { await batch.commit(); deleted += ops; } _showModal('Progreso', `Eliminados localmente. Propagando...`); if (window.adminModule?.propagateProductChange) { let propErrors = 0; for (const pId of pIds) { try { await window.adminModule.propagateProductChange(pId, null); } catch (pE) { console.error(`Error prop ${pId}:`, pE); propErrors++; } } _showModal(propErrors > 0 ? 'Advertencia' : 'Éxito', `Eliminados localmente.${propErrors > 0 ? ` ${propErrors} errores al propagar.` : ' Propagado.'}`); } else { _showModal('Advertencia', 'Eliminados localmente, propagación no disponible.'); } } catch (error) { console.error("Error eliminando todos:", error); _showModal('Error', `Error: ${error.message}`); } }, 'Sí, Eliminar Todos', null, true);
    }

    async function handleDeleteAllDatosMaestros() {
        if (_userRole !== 'admin') return; _showModal('Confirmar Borrado', `Eliminar TODOS los Datos Maestros NO USADOS? IRREVERSIBLE.`, async () => { _showModal('Progreso', 'Verificando uso...'); try { const cols=['rubros','segmentos','marcas'], toDel={rubros:[],segmentos:[],marcas:[]}; let inUse=[]; const invSnap=await _getDocs(_collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`)); const allProds=invSnap.docs.map(d=>d.data()); for(const col of cols){const f=col==='rubros'?'rubro':(col==='segmentos'?'segmento':'marca'); const catSnap=await _getDocs(_collection(_db, `artifacts/${_appId}/users/${_userId}/${col}`)); catSnap.docs.forEach(d=>{const n=d.data().name; if(n&&allProds.some(p=>p[f]===n))inUse.push(`'${n}' (${col.slice(0,-1)})`); else if(n)toDel[col].push({id:d.id,name:n});});} if(inUse.length>0){_showModal('Error',`En uso: ${inUse.join(', ')}.`); return;} let totDel=Object.values(toDel).reduce((s,a)=>s+a.length,0); if(totDel===0){_showModal('Aviso','No hay datos no usados.'); return;} _showModal('Confirmación Final', `Eliminar ${totDel} datos no usados? Se propagará.`, async ()=>{ _showModal('Progreso',`Eliminando ${totDel}...`); const bAdmin=_writeBatch(_db); let adCount=0; for(const c in toDel){toDel[c].forEach(i=>{bAdmin.delete(_doc(_db,`artifacts/${_appId}/users/${_userId}/${c}`,i.id)); adCount++;});} await bAdmin.commit(); _showModal('Progreso',`Eliminados localmente. Propagando...`); if(window.adminModule?.propagateCategoryChange){let pErrors=0; for(const c in toDel){for(const i of toDel[c]){try{await window.adminModule.propagateCategoryChange(c,i.id,null);}catch(pE){console.error(`Error prop ${c}/${i.id}:`,pE); pErrors++;}}} _showModal(pErrors>0?'Advertencia':'Éxito',`Eliminados localmente.${pErrors>0?` ${pErrors} errores al propagar.`:' Propagado.'}`);} else {_showModal('Advertencia','Eliminados localmente, propagación no disponible.');} invalidateSegmentOrderCache(); }, 'Sí, Eliminar No Usados', null, true); } catch (error) { console.error("Error eliminando datos:", error); _showModal('Error',`Error: ${error.message}`); } }, 'Sí, Eliminar No Usados', null, true);
    }

    window.inventarioModule = {
        editProducto,
        deleteProducto,
        handleDeleteDataItem,
        showAddCategoryModal,
        invalidateSegmentOrderCache
    };

})();

