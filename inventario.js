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
             // MODIFICACIÓN: Ignorar error de permisos durante logout
             if (window.isLoggingOut && error.code === 'permission-denied') {
                console.log("Inventory listener stopped due to logout.");
                return; // Ignorar el error silenciosamente
             }
             // Mostrar modal solo si NO estamos cerrando sesión O si el error NO es de permisos
             if (!window.isLoggingOut || error.code !== 'permission-denied') {
                 if (error.code !== 'cancelled') { // Ignorar errores de 'cancelled'
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
                // Asegurarse de que el orden sea numérico o un valor alto por defecto
                map[data.name] = (typeof data.orden === 'number' && !isNaN(data.orden)) ? data.orden : 9999;
            });
            _segmentoOrderCache = map;
            return map;
        } catch (e) {
            console.warn("No se pudo obtener el orden de los segmentos.", e);
            return {}; // Devolver mapa vacío en caso de error
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
        // Usar la ruta pública para los rubros si es necesario, o la privada si son específicos del usuario
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

            // Asegurar que todos los segmentos tengan un valor 'orden'
            const segmentsWithoutOrder = allSegments.filter(s => typeof s.orden !== 'number' || isNaN(s.orden));
            if (segmentsWithoutOrder.length > 0) {
                 console.log('Assigning initial order to new segments...');
                const segmentsWithOrder = allSegments.filter(s => typeof s.orden === 'number' && !isNaN(s.orden));
                const maxOrder = segmentsWithOrder.reduce((max, s) => Math.max(max, s.orden), -1);
                const batch = _writeBatch(_db);
                // Ordenar alfabéticamente los nuevos para asignación inicial consistente
                segmentsWithoutOrder.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
                segmentsWithoutOrder.forEach((seg, index) => {
                    const docRef = _doc(segmentosRef, seg.id);
                    const newOrder = maxOrder + 1 + index;
                    batch.update(docRef, { orden: newOrder });
                    seg.orden = newOrder; // Actualizar localmente también
                });
                await batch.commit();
                // Volver a fusionar las listas para asegurar que todos tienen orden
                allSegments = [...segmentsWithOrder, ...segmentsWithoutOrder];
                console.log("Initial order assigned to new segments.");
            }

            let segmentsToDisplay = allSegments;
            if (rubro) {
                // Filtrar segmentos basados en los productos que usan ese rubro
                const inventarioRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`);
                const q = _query(inventarioRef, _where("rubro", "==", rubro));
                const inventarioSnapshot = await _getDocs(q);
                const usedSegmentNames = new Set(inventarioSnapshot.docs.map(doc => doc.data().segmento).filter(Boolean));
                segmentsToDisplay = allSegments.filter(s => s.name && usedSegmentNames.has(s.name));
            }

            // Ordenar usando el valor 'orden' numérico
            segmentsToDisplay.sort((a, b) => a.orden - b.orden);

            container.innerHTML = '';
            if (segmentsToDisplay.length === 0) {
                container.innerHTML = `<p class="text-gray-500 text-center">No hay segmentos ${rubro ? 'para este rubro' : 'definidos'}.</p>`;
                return;
            }
            segmentsToDisplay.forEach(seg => {
                const li = document.createElement('li');
                li.dataset.id = seg.id;
                li.dataset.name = seg.name; // Guardar nombre para referencia
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
        let placeholder = null; // Elemento fantasma para indicar dónde soltar

        // Crear el placeholder una vez
        const createPlaceholder = () => {
             if (!placeholder) {
                 placeholder = document.createElement('li');
                 placeholder.style.height = '40px'; // Altura similar a un item
                 placeholder.style.background = '#e0e7ff'; // Azul claro
                 placeholder.style.border = '2px dashed #6366f1'; // Borde discontinuo azul
                 placeholder.style.borderRadius = '0.375rem'; // rounded-lg
                 placeholder.style.margin = '0.5rem 0'; // space-y-2 approx
                 placeholder.style.listStyleType = 'none'; // Sin viñeta
             }
        };
        createPlaceholder(); // Crear al inicio

        container.addEventListener('dragstart', e => {
             // Asegurarse de que el target sea un LI y no el placeholder
             if (e.target.tagName === 'LI' && e.target !== placeholder) {
                 draggedItem = e.target;
                 // Estilo visual mientras se arrastra
                 setTimeout(() => {
                     if (draggedItem) {
                         draggedItem.style.opacity = '0.5';
                         draggedItem.style.border = '2px dashed gray'; // Borde para indicar arrastre
                     }
                 }, 0);
                 e.dataTransfer.effectAllowed = 'move';
                 e.dataTransfer.setData('text/plain', draggedItem.dataset.id); // Guardar ID
             } else {
                 e.preventDefault(); // No arrastrar el placeholder u otros elementos
             }
        });

        container.addEventListener('dragend', e => {
             // Restaurar estilo al soltar o cancelar
             if (draggedItem) {
                 draggedItem.style.opacity = '1';
                 draggedItem.style.border = ''; // Quitar borde de arrastre
             }
             draggedItem = null;
             // Asegurarse de quitar el placeholder si sigue ahí
             if (placeholder && placeholder.parentNode) {
                 placeholder.parentNode.removeChild(placeholder);
             }
        });

        container.addEventListener('dragover', e => {
             e.preventDefault(); // Necesario para permitir 'drop'
             e.dataTransfer.dropEffect = 'move';

             // Encontrar el elemento sobre el cual se está arrastrando
             const afterElement = getDragAfterElement(container, e.clientY);

             // Insertar el placeholder en la posición correcta
             if (afterElement) {
                 container.insertBefore(placeholder, afterElement);
             } else {
                 container.appendChild(placeholder); // Si no hay elemento después, añadir al final
             }
        });

        container.addEventListener('drop', e => {
              e.preventDefault(); // Evitar comportamiento por defecto
              // Mover el elemento arrastrado a la posición del placeholder
              if (draggedItem && placeholder && placeholder.parentNode) {
                  container.insertBefore(draggedItem, placeholder);
                  // Restaurar estilo inmediatamente al soltar
                  draggedItem.style.opacity = '1';
                  draggedItem.style.border = '';
              }
              // Quitar placeholder después de soltar
              if (placeholder && placeholder.parentNode) {
                  placeholder.parentNode.removeChild(placeholder);
              }
              draggedItem = null; // Limpiar referencia
        });

        // Opcional: Manejar 'dragleave' para quitar el placeholder si el cursor sale del contenedor
        container.addEventListener('dragleave', e => {
              // Comprobar si el cursor realmente salió del contenedor (relatedTarget)
              if (!container.contains(e.relatedTarget) && placeholder && placeholder.parentNode) {
                  placeholder.parentNode.removeChild(placeholder);
              }
        });

        // Función auxiliar para encontrar el elemento después del cual soltar
        function getDragAfterElement(container, y) {
             // Obtener todos los LI que NO son el placeholder ni el arrastrado
             const draggableElements = [...container.querySelectorAll('li:not([style*="height: 40px"])')].filter(el => el !== draggedItem);

             return draggableElements.reduce((closest, child) => {
                 const box = child.getBoundingClientRect();
                 // Calcular punto medio vertical del elemento
                 const offset = y - box.top - box.height / 2;
                 // Si el cursor está por encima del punto medio y es el más cercano hasta ahora
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

        // Verificar si la lista está vacía o solo contiene el mensaje "No hay segmentos"
        if (listItems.length === 0) {
             const noSegmentsMsg = document.querySelector('#segmentos-sortable-list p');
             _showModal('Aviso', noSegmentsMsg?.textContent.includes('No hay segmentos') ? 'No hay segmentos visibles para guardar orden.' : 'Lista de segmentos no cargada o vacía.');
            return;
        }

        const batch = _writeBatch(_db);
        const orderedIds = []; // Para propagación
        let hasChanges = false;
        const currentOrderMap = await getSegmentoOrderMap(); // Obtener orden actual antes de comparar

        listItems.forEach((item, index) => {
            const docId = item.dataset.id;
            const docRef = _doc(_db, `artifacts/${_appId}/users/${_userId}/segmentos`, docId);
            const segmentName = item.dataset.name; // Usar el nombre guardado en data-name

             // Comparar el índice actual (nuevo orden) con el orden guardado en Firestore
             const currentDbOrder = currentOrderMap[segmentName]; // Obtener orden de la caché
             if (currentDbOrder !== index) {
                 batch.update(docRef, { orden: index });
                 hasChanges = true;
             }
            orderedIds.push(docId); // Añadir ID para la propagación
        });

         // Si no hubo cambios detectados
         if (!hasChanges) {
             _showModal('Aviso', 'No se detectaron cambios en el orden.');
             return;
         }

        _showModal('Progreso', 'Guardando nuevo orden para admin...');

        try {
            await batch.commit();
            invalidateSegmentOrderCache(); // Invalida caché local de inventario.js
            // MODIFICACIÓN: Invalida caché de catálogo.js también
            if (window.catalogoModule?.invalidateCache) {
                 window.catalogoModule.invalidateCache();
                 console.log("Catálogo cache invalidada desde Inventario.");
            }

             // Propagar el cambio a otros usuarios si la función existe
             if (window.adminModule?.propagateCategoryOrderChange) {
                  _showModal('Progreso', 'Propagando orden a otros usuarios...');
                 await window.adminModule.propagateCategoryOrderChange('segmentos', orderedIds);
             } else {
                  console.warn("Función propagateCategoryOrderChange no encontrada en adminModule.");
                  _showModal('Advertencia', 'Orden guardado localmente para el administrador, pero no se pudo propagar a otros usuarios.');
             }

            _showModal('Éxito', 'Orden de segmentos guardado y propagado.');
            showInventarioSubMenu(); // Volver al menú de inventario
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
        // Iniciar listener aquí para asegurar que _inventarioCache esté actualizado
        startMainInventarioListener(renderCallback);
    }

    async function renderAjusteMasivoList() {
        const container = document.getElementById('ajusteListContainer');
        if (!container) return; // Salir si el contenedor no existe

        // Filtrar productos desde la caché
        let productos = [..._inventarioCache]; // Usar copia de la caché
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

        // Ordenar productos
        const segmentoOrderMap = await getSegmentoOrderMap(); // Obtener mapa de orden
        productos.sort((a, b) => {
             const orderA = segmentoOrderMap[a.segmento] ?? 9999;
             const orderB = segmentoOrderMap[b.segmento] ?? 9999;
             if (orderA !== orderB) return orderA - orderB; // Ordenar por segmento
             const marcaComp = (a.marca || '').localeCompare(b.marca || '');
             if (marcaComp !== 0) return marcaComp; // Luego por marca
             return (a.presentacion || '').localeCompare(b.presentacion || ''); // Finalmente por presentación
        });

        // Generar HTML de la tabla
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

            // Añadir fila de cabecera de Segmento si cambia
            if (segmento !== currentSegmento) {
                 currentSegmento = segmento;
                 currentMarca = null; // Resetear marca al cambiar segmento
                 // Sticky top con z-index menor que el thead principal
                 tableHTML += `<tr><td colspan="2" class="py-2 px-4 bg-gray-300 font-bold text-gray-800 sticky top-[calc(theme(height.10))] z-[9]">${currentSegmento}</td></tr>`;
            }
            // Añadir fila de cabecera de Marca si cambia
            if (marca !== currentMarca) {
                 currentMarca = marca;
                 tableHTML += `<tr><td colspan="2" class="py-2 px-4 bg-gray-100 font-semibold text-gray-700 pl-8">${currentMarca}</td></tr>`;
            }

            // Determinar unidad de venta principal y factor de conversión
            const ventaPor = p.ventaPor || { und: true };
            let unitType = 'Und'; // Default a unidades
            let conversionFactor = 1;
            let currentStockInUnits = p.cantidadUnidades || 0;

            if (ventaPor.cj) { unitType = 'Cj'; conversionFactor = p.unidadesPorCaja || 1; }
            else if (ventaPor.paq) { unitType = 'Paq'; conversionFactor = p.unidadesPorPaquete || 1; }
            conversionFactor = Math.max(1, conversionFactor); // Evitar división por cero o NaN
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
             _showModal('Aviso', container?.textContent.includes('No hay productos') ? 'No hay productos que coincidan con los filtros.' : 'La lista de productos no está cargada.');
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
            const newValueInDisplayUnitsStr = input.value.trim();
            const newValueInDisplayUnits = parseInt(newValueInDisplayUnitsStr, 10);
            const productoOriginal = _inventarioCache.find(p => p.id === docId);

            // Validar entrada: no vacío, es número entero, no negativo
            if (newValueInDisplayUnitsStr === '' || isNaN(newValueInDisplayUnits) || !Number.isInteger(newValueInDisplayUnits) || newValueInDisplayUnits < 0) {
                 // Marcar como inválido solo si el input no está vacío (permite borrar para poner 0)
                 if (newValueInDisplayUnitsStr !== '') {
                     input.classList.add('border-red-500', 'ring-1', 'ring-red-500');
                     invalidValues = true;
                 }
                 // Si está vacío, se interpreta como 0 más adelante
                 return; // Saltar este input si es inválido y no vacío
            }

            if (productoOriginal) {
                // Calcular nueva cantidad en unidades base (si el input estaba vacío, newValueInDisplayUnits será NaN aquí, corregido abajo)
                const nuevaCantidadUnidades = (isNaN(newValueInDisplayUnits) ? 0 : newValueInDisplayUnits) * conversionFactor;

                // Comparar con la cantidad original en unidades base
                if ((productoOriginal.cantidadUnidades || 0) !== nuevaCantidadUnidades) {
                    const docRef = _doc(_db, `artifacts/${_appId}/users/${_userId}/inventario`, docId);
                    batch.update(docRef, { cantidadUnidades: nuevaCantidadUnidades });
                    changesCount++;
                }
            } else {
                 console.warn(`Producto no encontrado en caché para ID: ${docId}. No se actualizará.`);
            }
        });

        // Si se detectaron valores inválidos (no vacíos), mostrar error y detener
        if (invalidValues) {
             _showModal('Error de Entrada', 'Se detectaron cantidades inválidas (no numéricas, decimales o negativas). Por favor, corrígelas antes de guardar.');
             return;
        }

        // Si no hubo cambios válidos
        if (changesCount === 0) {
            _showModal('Aviso', 'No se detectaron cambios en las cantidades.');
            return;
        }

        // Confirmar y ejecutar el batch
        _showModal('Confirmar Cambios', `¿Estás seguro de que quieres actualizar las cantidades de ${changesCount} producto(s)?`, async () => {
             _showModal('Progreso', 'Guardando cambios...');
            try {
                await batch.commit();
                _showModal('Éxito', 'Las cantidades de inventario han sido actualizadas.');
                 // Opcional: Volver al menú o refrescar la vista actual
                 // showInventarioSubMenu();
            } catch (error) {
                console.error("Error al guardar ajuste masivo:", error);
                _showModal('Error', 'Hubo un error al guardar los cambios.');
            }
        });
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
                        <p class="text-sm text-center text-gray-600 mb-6">Gestiona categorías globales (Rubros, Segmentos, Marcas). Los cambios se propagarán a todos los usuarios. La eliminación solo es posible si el elemento no está en uso por ningún producto.</p>
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
                            <button id="deleteAllDatosMaestrosBtn" class="w-full px-6 py-3 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700">Eliminar Todos los Datos Maestros (No Usados)</button>
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
             // Evitar mostrar error si es por cierre de sesión
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
            async () => { // Confirm callback
                const input = document.getElementById('newCategoryName');
                const messageP = document.getElementById('addCategoryMessage');
                const newName = input.value.trim();
                messageP.textContent = ''; // Clear previous messages
                if (!newName) {
                    messageP.textContent = 'El nombre no puede estar vacío.';
                    input.focus();
                    return false; // Prevent modal close
                }
                const newNameUpper = newName.toUpperCase(); // Convertir a mayúsculas

                try {
                    // Check for duplicates in admin's collection first
                    const collectionRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/${collectionName}`);
                    const q = _query(collectionRef, _where("name", "==", newNameUpper));
                    const querySnapshot = await _getDocs(q);
                    if (!querySnapshot.empty) {
                        messageP.textContent = `"${newName}" ya existe.`;
                        input.select();
                        return false; // Prevent modal close
                    }

                    // Prepare new item data
                    const newItemData = { name: newNameUpper };

                     // If it's a 'segmento', assign the next available 'orden'
                     if (collectionName === 'segmentos') {
                         const currentSegmentsSnapshot = await _getDocs(collectionRef);
                         const maxOrder = currentSegmentsSnapshot.docs.reduce((max, doc) => Math.max(max, doc.data().orden ?? -1), -1);
                         newItemData.orden = maxOrder + 1;
                     }

                    // Add to admin's collection
                    const docRef = await _addDoc(collectionRef, newItemData);
                    const newItemId = docRef.id;

                    // Propagate to other users
                    if (window.adminModule?.propagateCategoryChange) {
                         console.log('Propagating new category...');
                        await window.adminModule.propagateCategoryChange(collectionName, newItemId, newItemData);
                         console.log(`"${newNameUpper}" added and propagated.`);
                    } else {
                         console.log(`"${newNameUpper}" added locally (propagation not available).`);
                    }

                     // Invalidate cache if it was a segmento
                     if (collectionName === 'segmentos') invalidateSegmentOrderCache();

                    return true; // Close modal on success

                } catch (err) {
                    console.error(`Error al agregar ${itemName}:`, err);
                    messageP.textContent = 'Error al guardar. Intenta de nuevo.';
                    return false; // Prevent modal close on error
                }
            },
            'Guardar y Propagar', // Confirm button text
             () => {}, // Cancel callback (optional)
             true // triggerConfirmLogic: true (to handle async and show errors)
        );
         // Auto-focus input after modal opens
         setTimeout(() => document.getElementById('newCategoryName')?.focus(), 50);
    }


    async function handleDeleteDataItem(collectionName, itemName, itemType, itemId) {
        if (_userRole !== 'admin') {
            _showModal('Acceso Denegado', 'Solo los administradores pueden eliminar datos maestros.');
            return;
        }

        // Map collection name to the field name used in 'inventario'
        const fieldMap = { rubros: 'rubro', segmentos: 'segmento', marcas: 'marca' };
        const fieldName = fieldMap[collectionName];
        if (!fieldName) {
             _showModal('Error Interno', 'Tipo de colección no reconocido.');
             return;
        }

        // Check if the item is used in any product in the admin's inventory
        console.log(`Verificando uso de "${itemName}" en el inventario del administrador...`);
        const inventarioRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`);
        const q = _query(inventarioRef, _where(fieldName, "==", itemName));

        try {
            const usageSnapshot = await _getDocs(q);
            if (!usageSnapshot.empty) {
                _showModal('Error al Eliminar', `"${itemName}" está en uso por ${usageSnapshot.size} producto(s) en tu inventario. No se puede eliminar.`);
                return;
            }

            // If not used, confirm deletion and propagation
            _showModal('Confirmar Eliminación', `¿Estás seguro de que quieres eliminar ${itemType.toLowerCase()} "${itemName}"? Esta acción se propagará a todos los usuarios y es IRREVERSIBLE.`, async () => {
                 _showModal('Progreso', `Eliminando "${itemName}"...`);
                 console.log(`Deleting "${itemName}" for admin...`);
                 try {
                     // Delete from admin's collection
                     await _deleteDoc(_doc(_db, `artifacts/${_appId}/users/${_userId}/${collectionName}`, itemId));

                     // Propagate deletion to other users
                     if (window.adminModule?.propagateCategoryChange) {
                          console.log('Propagating deletion...');
                         // Pass null as itemData to indicate deletion
                         await window.adminModule.propagateCategoryChange(collectionName, itemId, null);
                         console.log(`${itemType} "${itemName}" deleted and propagated.`);
                     } else {
                          console.warn('Deleted locally for admin, but propagation function not available.');
                     }

                     // Invalidate segment cache if applicable
                     if (collectionName === 'segmentos') invalidateSegmentOrderCache();

                     _showModal('Éxito', `${itemType} "${itemName}" eliminado correctamente.`);
                 } catch (deleteError) {
                      console.error(`Error al eliminar/propagar ${itemName}:`, deleteError);
                      _showModal('Error', `Error durante el proceso de eliminación: ${deleteError.message}`);
                 }
            }, 'Sí, Eliminar y Propagar');

        } catch (error) {
            _showModal('Error', `Error al verificar el uso del ${itemType.toLowerCase()}: ${error.message}`);
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
                            <!-- Categorías (Rubro, Segmento, Marca) -->
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
                            <!-- Venta Por y Empaques -->
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
                                     <!-- Manejo de Vacíos -->
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
                            <!-- Cantidad Inicial e IVA -->
                            <div class="border-t pt-4 mt-4">
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                         <label class="block text-gray-700 font-medium mb-1">Cantidad Inicial:</label>
                                         <input type="number" id="cantidadInicial" value="0" class="w-full px-4 py-2 border rounded-lg bg-gray-100" readonly>
                                         <p class="text-xs text-gray-500 mt-1">Siempre 0 al crear. Ajustar luego si es necesario.</p>
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
                            <!-- Botones -->
                            <button type="submit" class="w-full px-6 py-3 bg-green-500 text-white font-semibold rounded-lg shadow-md hover:bg-green-600">Guardar Producto y Propagar</button>
                        </form>
                        <button id="backToInventarioBtn" class="mt-4 w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver</button>
                    </div>
                </div>
            </div>
        `;

        // Populate dropdowns
        _populateDropdown(`artifacts/${_appId}/users/${_userId}/rubros`, 'rubro', 'Rubro');
        _populateDropdown(`artifacts/${_appId}/users/${_userId}/segmentos`, 'segmento', 'Segmento');
        _populateDropdown(`artifacts/${_appId}/users/${_userId}/marcas`, 'marca', 'Marca');

        // References to dynamic elements
        const ventaPorContainer = document.getElementById('ventaPorContainer');
        const preciosContainer = document.getElementById('preciosContainer');
        const empaquesContainer = document.getElementById('empaquesContainer');
        const manejaVaciosCheck = document.getElementById('manejaVaciosCheck');
        const tipoVacioContainer = document.getElementById('tipoVacioContainer');
        const tipoVacioSelect = document.getElementById('tipoVacioSelect');

        // Function to update dynamic inputs based on 'Venta por' checkboxes
        const updateDynamicInputs = () => {
             empaquesContainer.innerHTML = ''; // Clear previous inputs
             preciosContainer.innerHTML = '';
             const ventaPorUnd = document.getElementById('ventaPorUnd').checked;
             const ventaPorPaq = document.getElementById('ventaPorPaq').checked;
             const ventaPorCj = document.getElementById('ventaPorCj').checked;

             // Add empaque inputs if needed
             if (ventaPorPaq) empaquesContainer.innerHTML += `<div><label class="block text-sm font-medium">Unidades por Paquete:</label><input type="number" id="unidadesPorPaquete" min="1" step="1" class="w-full px-2 py-1 border rounded" value="1" required></div>`;
             if (ventaPorCj) empaquesContainer.innerHTML += `<div><label class="block text-sm font-medium">Unidades por Caja:</label><input type="number" id="unidadesPorCaja" min="1" step="1" class="w-full px-2 py-1 border rounded" value="1" required></div>`;

             // Add precio inputs if needed
             if (ventaPorUnd) preciosContainer.innerHTML += `<div><label class="block text-sm font-medium">Precio por Und.</label><input type="number" step="0.01" min="0" id="precioUnd" class="w-full px-2 py-1 border rounded" required></div>`;
             if (ventaPorPaq) preciosContainer.innerHTML += `<div><label class="block text-sm font-medium">Precio por Paq.</label><input type="number" step="0.01" min="0" id="precioPaq" class="w-full px-2 py-1 border rounded" required></div>`;
             if (ventaPorCj) preciosContainer.innerHTML += `<div><label class="block text-sm font-medium">Precio por Cj.</label><input type="number" step="0.01" min="0" id="precioCj" class="w-full px-2 py-1 border rounded" required></div>`;

             // Set required attribute based on checkbox (redundant with initial add but good practice)
             preciosContainer.querySelectorAll('input').forEach(input => {
                 input.required = document.getElementById(`ventaPor${input.id.substring(6)}`)?.checked ?? false;
             });
        };

        // Event listener for Maneja Vacío checkbox
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

        // Event listener for 'Venta por' container
        ventaPorContainer.addEventListener('change', updateDynamicInputs);

        // Initial call to set up inputs
        updateDynamicInputs();

        // Form submission and back button listeners
        document.getElementById('productoForm').addEventListener('submit', agregarProducto);
        document.getElementById('backToInventarioBtn').addEventListener('click', showInventarioSubMenu);
    }


    function getProductoDataFromForm(isEditing = false) {
        // Empaques
        const unidadesPorPaqueteInput = document.getElementById('unidadesPorPaquete');
        const unidadesPorCajaInput = document.getElementById('unidadesPorCaja');
        // Usar Math.max para asegurar al menos 1 unidad por empaque si el campo existe
        const unidadesPorPaquete = Math.max(1, unidadesPorPaqueteInput ? (parseInt(unidadesPorPaqueteInput.value, 10) || 1) : 1);
        const unidadesPorCaja = Math.max(1, unidadesPorCajaInput ? (parseInt(unidadesPorCajaInput.value, 10) || 1) : 1);

        // Precios
        const precioUndInput = document.getElementById('precioUnd');
        const precioPaqInput = document.getElementById('precioPaq');
        const precioCjInput = document.getElementById('precioCj');
        // Usar Math.max para asegurar precios no negativos
        const precios = {
            und: Math.max(0, precioUndInput ? (parseFloat(precioUndInput.value) || 0) : 0),
            paq: Math.max(0, precioPaqInput ? (parseFloat(precioPaqInput.value) || 0) : 0),
            cj: Math.max(0, precioCjInput ? (parseFloat(precioCjInput.value) || 0) : 0),
        };

        // Calcular precio final por unidad (para referencia, no usado directamente en ventas)
        let precioFinalPorUnidad = 0;
        if (precios.und > 0) { precioFinalPorUnidad = precios.und; }
        else if (precios.paq > 0 && unidadesPorPaquete > 0) { precioFinalPorUnidad = precios.paq / unidadesPorPaquete; }
        else if (precios.cj > 0 && unidadesPorCaja > 0) { precioFinalPorUnidad = precios.cj / unidadesPorCaja; }
        precioFinalPorUnidad = parseFloat(precioFinalPorUnidad.toFixed(2)); // Redondear a 2 decimales

        // Cantidad (solo relevante para edición, al crear siempre es 0)
        let cantidadTotalUnidades;
        if (isEditing) {
             const cantidadActualInput = document.getElementById('cantidadActual'); // ID usado en editProducto
             cantidadTotalUnidades = cantidadActualInput ? (parseInt(cantidadActualInput.value, 10) || 0) : 0;
        } else {
            cantidadTotalUnidades = 0; // Siempre 0 al crear
        }

        // Manejo de Vacíos
        const manejaVaciosChecked = document.getElementById('manejaVaciosCheck').checked;
        const tipoVacioSelected = document.getElementById('tipoVacioSelect').value;

        // Construir objeto final
        return {
            rubro: document.getElementById('rubro').value,
            segmento: document.getElementById('segmento').value,
            marca: document.getElementById('marca').value,
            presentacion: document.getElementById('presentacion').value.trim(), // Limpiar espacios
            unidadesPorPaquete: unidadesPorPaquete,
            unidadesPorCaja: unidadesPorCaja,
            ventaPor: {
                und: document.getElementById('ventaPorUnd').checked,
                paq: document.getElementById('ventaPorPaq').checked,
                cj: document.getElementById('ventaPorCj').checked,
            },
            manejaVacios: manejaVaciosChecked,
            tipoVacio: manejaVaciosChecked ? tipoVacioSelected : null, // Solo guardar si está marcado
            precios: precios,
            precioPorUnidad: precioFinalPorUnidad, // Guardar precio unitario calculado
            cantidadUnidades: cantidadTotalUnidades, // Cantidad en unidades base
            iva: parseInt(document.getElementById('ivaTipo').value, 10) // Guardar tipo de IVA
        };
    }


    async function agregarProducto(e) {
        e.preventDefault();
        if (_userRole !== 'admin') return;

        const productoData = getProductoDataFromForm(false); // Obtener datos del formulario

        // --- Validaciones ---
        if (!productoData.rubro || !productoData.segmento || !productoData.marca || !productoData.presentacion) {
             _showModal('Error', 'Debes completar los campos Rubro, Segmento, Marca y Presentación.');
             return;
        }
        if (!productoData.ventaPor.und && !productoData.ventaPor.paq && !productoData.ventaPor.cj) {
             _showModal('Error', 'Debes seleccionar al menos una forma de venta (Und, Paq o Cj).');
             return;
        }
        if (productoData.manejaVacios && !productoData.tipoVacio) {
             _showModal('Error', 'Si el producto maneja vacío, debes seleccionar el Tipo de Vacío.');
             document.getElementById('tipoVacioSelect')?.focus(); // Enfocar el select relevante
             return;
        }
        // Validar que al menos un precio sea mayor que 0 para las formas de venta seleccionadas
        let precioValidoIngresado = false;
        if (productoData.ventaPor.und && productoData.precios.und > 0) precioValidoIngresado = true;
        if (productoData.ventaPor.paq && productoData.precios.paq > 0) precioValidoIngresado = true;
        if (productoData.ventaPor.cj && productoData.precios.cj > 0) precioValidoIngresado = true;
        if (!precioValidoIngresado) {
             _showModal('Error', 'Debes ingresar al menos un precio válido (mayor que 0) para una de las formas de venta seleccionadas.');
             // Intentar enfocar el primer input de precio requerido visible
             document.querySelector('#preciosContainer input[required]')?.focus();
             return;
        }
        // --- Fin Validaciones ---

        _showModal('Progreso', 'Verificando y guardando producto...');
        console.log('Verifying and saving product...');

        try {
            // Verificar duplicados en la colección del admin
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
                 return; // Detener si ya existe
            }

            // Agregar el producto a la colección del admin
            const docRef = await _addDoc(inventarioRef, productoData);
            const newProductId = docRef.id;

            // Propagar el nuevo producto (definición con cantidad 0) a todos los usuarios
            if (window.adminModule?.propagateProductChange) {
                 console.log('Propagating new product...');
                // Pasamos productData, la función de propagación ajustará la cantidad a 0 si es nuevo
                await window.adminModule.propagateProductChange(newProductId, productoData);
                 console.log('Product added and propagated.');
            } else {
                 console.log('Product added locally (propagation not available).');
            }

            _showModal('Éxito', 'Producto agregado y propagado correctamente.');
            showAgregarProductoView(); // Limpiar formulario y permitir agregar otro

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

        // Configurar filtros y la función que se llamará al cambiar
        const renderCallback = () => renderProductosList('productosListContainer', !isAdmin); // Pasar !isAdmin como readOnly
        _populateDropdown(`artifacts/${_appId}/users/${_userId}/rubros`, 'modify-filter-rubro', 'Rubro');
        setupFiltros('modify', renderCallback);

        // Iniciar el listener que actualiza _inventarioCache y llama a renderCallback
        startMainInventarioListener(renderCallback);
    }

    // Función para generar el HTML de los filtros (reutilizable)
    function getFiltrosHTML(prefix) {
         const currentSearch = _lastFilters.searchTerm || ''; // Usar valor guardado
        return `
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 p-4 border rounded-lg bg-gray-50">
                <input type="text" id="${prefix}-search-input" placeholder="Buscar por presentación, marca o segmento..." class="md:col-span-4 w-full px-4 py-2 border rounded-lg text-sm" value="${currentSearch}">
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

    // Función para configurar los listeners de los filtros
    function setupFiltros(prefix, renderCallback) {
        const searchInput = document.getElementById(`${prefix}-search-input`);
        const rubroFilter = document.getElementById(`${prefix}-filter-rubro`);
        const segmentoFilter = document.getElementById(`${prefix}-filter-segmento`);
        const marcaFilter = document.getElementById(`${prefix}-filter-marca`);
        const clearBtn = document.getElementById(`${prefix}-clear-filters-btn`);

        // Función para actualizar Segmento y Marca basado en Rubro/Segmento seleccionado
        function updateDependentFilters(trigger) {
             const selectedRubro = rubroFilter.value;
             const selectedSegmento = segmentoFilter.value; // Valor actual de segmento

             // Actualizar Segmento si cambió Rubro o en la inicialización
             if (trigger === 'rubro' || trigger === 'init') {
                 // Guardar el valor actual si es la inicialización y hay uno guardado
                 const currentSegmentoValue = (trigger === 'init' && _lastFilters.segmento) ? _lastFilters.segmento : '';
                 segmentoFilter.innerHTML = '<option value="">Todos</option>';
                 segmentoFilter.disabled = true;
                 if (selectedRubro) {
                     // Obtener segmentos únicos de la caché filtrada por rubro
                     const segmentos = [...new Set(_inventarioCache.filter(p => p.rubro === selectedRubro && p.segmento).map(p => p.segmento))].sort();
                     if (segmentos.length > 0) {
                          segmentos.forEach(s => segmentoFilter.innerHTML += `<option value="${s}">${s}</option>`);
                          segmentoFilter.disabled = false;
                           // Restaurar valor si es posible
                           if (segmentos.includes(currentSegmentoValue)) {
                               segmentoFilter.value = currentSegmentoValue;
                           }
                     }
                 } else {
                      segmentoFilter.value = ''; // Reset si no hay rubro
                 }
             }

             // Actualizar Marca si cambió Rubro, Segmento o en la inicialización
             if (trigger === 'rubro' || trigger === 'segmento' || trigger === 'init') {
                  // Guardar el valor actual si es la inicialización y hay uno guardado
                  const currentMarcaValue = (trigger === 'init' && _lastFilters.marca) ? _lastFilters.marca : '';
                  marcaFilter.innerHTML = '<option value="">Todos</option>';
                  marcaFilter.disabled = true;
                   // Necesitamos el valor de segmento actualizado después del paso anterior
                  const finalSelectedSegmento = segmentoFilter.value;
                  if (selectedRubro) {
                      // Obtener marcas únicas de la caché filtrada por rubro y segmento (si aplica)
                      const marcas = [...new Set(_inventarioCache.filter(p => p.rubro === selectedRubro && (!finalSelectedSegmento || p.segmento === finalSelectedSegmento) && p.marca).map(p => p.marca))].sort();
                      if (marcas.length > 0) {
                           marcas.forEach(m => marcaFilter.innerHTML += `<option value="${m}">${m}</option>`);
                           marcaFilter.disabled = false;
                            // Restaurar valor si es posible
                            if (marcas.includes(currentMarcaValue)) {
                                marcaFilter.value = currentMarcaValue;
                            }
                      }
                  } else {
                      marcaFilter.value = ''; // Reset si no hay rubro
                  }
             }
        }

        // --- Inicialización de Filtros ---
        // Esperar un poco para que _inventarioCache esté poblado por el listener
        setTimeout(() => {
             // Restaurar filtros desde _lastFilters
             rubroFilter.value = _lastFilters.rubro || '';
             // Llamar a updateDependentFilters ANTES de llamar a renderCallback por primera vez
             updateDependentFilters('init');
             // Restaurar búsqueda
             if(searchInput) searchInput.value = _lastFilters.searchTerm || '';

             // Llamar al callback de renderizado inicial
             if (typeof renderCallback === 'function') {
                 renderCallback();
             }
        }, 200); // Ajustar delay si es necesario

        // --- Listeners para Cambios en Filtros ---
        const applyAndSaveFilters = () => {
             // Guardar estado actual en _lastFilters
             _lastFilters.searchTerm = searchInput.value || '';
             _lastFilters.rubro = rubroFilter.value || '';
             _lastFilters.segmento = segmentoFilter.value || '';
             _lastFilters.marca = marcaFilter.value || '';
              // Llamar al callback para re-renderizar la lista
              if (typeof renderCallback === 'function') {
                 renderCallback();
              }
        };

        searchInput.addEventListener('input', applyAndSaveFilters);

        rubroFilter.addEventListener('change', () => {
             // Al cambiar rubro, resetear segmento y marca antes de actualizar y renderizar
             _lastFilters.segmento = ''; // Resetear segmento guardado
             _lastFilters.marca = ''; // Resetear marca guardada
             updateDependentFilters('rubro'); // Actualiza dropdowns dependientes
             applyAndSaveFilters(); // Guarda nuevos filtros y renderiza
        });

        segmentoFilter.addEventListener('change', () => {
              // Al cambiar segmento, resetear marca antes de actualizar y renderizar
              _lastFilters.marca = ''; // Resetear marca guardada
              updateDependentFilters('segmento'); // Actualiza dropdown de marca
              applyAndSaveFilters(); // Guarda nuevos filtros y renderiza
        });

        marcaFilter.addEventListener('change', applyAndSaveFilters); // Solo guarda y renderiza

        clearBtn.addEventListener('click', () => {
             searchInput.value = '';
             rubroFilter.value = '';
             // Resetear filtros guardados y actualizar dropdowns dependientes
             _lastFilters.searchTerm = '';
             _lastFilters.rubro = '';
             _lastFilters.segmento = '';
             _lastFilters.marca = '';
             updateDependentFilters('rubro'); // Llama con 'rubro' para resetear todo
             applyAndSaveFilters(); // Renderiza con filtros limpios
        });
    }


    async function renderProductosList(elementId, readOnly = false) {
        const container = document.getElementById(elementId);
        if (!container) return; // Salir si el contenedor no existe

        // Filtrar productos desde la caché global
        let productos = [..._inventarioCache];
        productos = productos.filter(p => {
             const searchTermLower = (_lastFilters.searchTerm || '').toLowerCase();
             // Coincidencia de texto en presentación, marca o segmento
             const textMatch = !searchTermLower ||
                               (p.presentacion && p.presentacion.toLowerCase().includes(searchTermLower)) ||
                               (p.marca && p.marca.toLowerCase().includes(searchTermLower)) ||
                               (p.segmento && p.segmento.toLowerCase().includes(searchTermLower));
             // Coincidencia exacta de filtros de categoría
             const rubroMatch = !_lastFilters.rubro || p.rubro === _lastFilters.rubro;
             const segmentoMatch = !_lastFilters.segmento || p.segmento === _lastFilters.segmento;
             const marcaMatch = !_lastFilters.marca || p.marca === _lastFilters.marca;
             return textMatch && rubroMatch && segmentoMatch && marcaMatch;
        });

        // Ordenar productos
        const segmentoOrderMap = await getSegmentoOrderMap(); // Obtener mapa de orden
        productos.sort((a, b) => {
             const orderA = segmentoOrderMap[a.segmento] ?? 9999;
             const orderB = segmentoOrderMap[b.segmento] ?? 9999;
             if (orderA !== orderB) return orderA - orderB; // Ordenar por segmento
             const marcaComp = (a.marca || '').localeCompare(b.marca || '');
             if (marcaComp !== 0) return marcaComp; // Luego por marca
             return (a.presentacion || '').localeCompare(b.presentacion || ''); // Finalmente por presentación
        });

        // Generar HTML de la tabla
        if (productos.length === 0) {
            container.innerHTML = `<p class="text-gray-500 text-center p-4">No hay productos que coincidan con los filtros.</p>`;
            return;
        }

        const cols = readOnly ? 3 : 4; // Número de columnas varía si es solo lectura
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

            // Añadir fila de cabecera de Segmento
            if (segmento !== currentSegmento) {
                 currentSegmento = segmento;
                 currentMarca = null; // Resetear marca
                 tableHTML += `<tr><td colspan="${cols}" class="py-2 px-4 bg-gray-300 font-bold text-gray-800 sticky top-[calc(theme(height.10))] z-[9]">${currentSegmento}</td></tr>`;
            }
            // Añadir fila de cabecera de Marca
            if (marca !== currentMarca) {
                 currentMarca = marca;
                 tableHTML += `<tr><td colspan="${cols}" class="py-2 px-4 bg-gray-100 font-semibold text-gray-600 pl-8">${currentMarca}</td></tr>`;
            }

            // Determinar presentación, precio y stock a mostrar
            const ventaPor = p.ventaPor || { und: true };
            const precios = p.precios || { und: p.precioPorUnidad || 0 };
            let displayPresentacion = p.presentacion || 'N/A';
            let displayPrecio = `$0.00`;
            let displayStock = `${p.cantidadUnidades || 0} Und`;
            let conversionFactorStock = 1;

            if (ventaPor.cj && precios.cj > 0) { // Priorizar Caja si está disponible y tiene precio
                 if (p.unidadesPorCaja) displayPresentacion += ` <span class="text-xs text-gray-500">(${p.unidadesPorCaja} und.)</span>`;
                 displayPrecio = `$${(precios.cj).toFixed(2)}`;
                 conversionFactorStock = Math.max(1, p.unidadesPorCaja || 1);
                 displayStock = `${Math.floor((p.cantidadUnidades || 0) / conversionFactorStock)} Cj`;
            } else if (ventaPor.paq && precios.paq > 0) { // Luego Paquete
                 if (p.unidadesPorPaquete) displayPresentacion += ` <span class="text-xs text-gray-500">(${p.unidadesPorPaquete} und.)</span>`;
                 displayPrecio = `$${(precios.paq).toFixed(2)}`;
                 conversionFactorStock = Math.max(1, p.unidadesPorPaquete || 1);
                 displayStock = `${Math.floor((p.cantidadUnidades || 0) / conversionFactorStock)} Paq`;
            } else { // Por defecto o si solo Und está disponible/tiene precio
                 displayPrecio = `$${(precios.und || 0).toFixed(2)}`;
                 // displayStock ya está en Und
            }

            const stockEnUnidades = p.cantidadUnidades || 0;
            const stockTooltip = `${stockEnUnidades} Und. Base`; // Tooltip siempre muestra unidades base

            // Añadir fila del producto
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
        if (!producto) { _showModal('Error', 'Producto no encontrado.'); return; }

        if (_floatingControls) _floatingControls.classList.add('hidden');
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto max-w-2xl">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl text-center">
                        <h2 class="text-2xl font-bold text-gray-800 mb-6">Editar Producto</h2>
                        <form id="editProductoForm" class="space-y-4 text-left">
                            <!-- Categorías -->
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
                            <!-- Venta Por, Empaques, Vacíos -->
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
                             <!-- Stock e IVA -->
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
                            <!-- Botones -->
                            <button type="submit" class="w-full px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg shadow-md hover:bg-blue-600">Guardar Cambios y Propagar</button>
                        </form>
                        <button id="backToModifyDeleteBtn" class="mt-4 w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver</button>
                    </div>
                </div>
            </div>
        `;
        // Populate dropdowns con valor seleccionado
        _populateDropdown(`artifacts/${_appId}/users/${_userId}/rubros`, 'rubro', 'Rubro', producto.rubro);
        _populateDropdown(`artifacts/${_appId}/users/${_userId}/segmentos`, 'segmento', 'Segmento', producto.segmento);
        _populateDropdown(`artifacts/${_appId}/users/${_userId}/marcas`, 'marca', 'Marca', producto.marca);

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

        // --- Rellenar el formulario con los datos existentes ---
        // Usar setTimeout para asegurar que los dropdowns se hayan poblado
        setTimeout(() => {
            document.getElementById('presentacion').value = producto.presentacion || '';
            document.getElementById('ivaTipo').value = producto.iva !== undefined ? producto.iva : 16; // Default 16 si no existe

            // Marcar checkboxes de Venta Por
            if (producto.ventaPor) {
                document.getElementById('ventaPorUnd').checked = producto.ventaPor.und || false;
                document.getElementById('ventaPorPaq').checked = producto.ventaPor.paq || false;
                document.getElementById('ventaPorCj').checked = producto.ventaPor.cj || false;
            } else {
                 // Si no hay 'ventaPor' definido, marcar Und por defecto
                 document.getElementById('ventaPorUnd').checked = true;
            }

            // Llamar a updateDynamicInputs DESPUÉS de marcar los checkboxes
            updateDynamicInputs();

            // Rellenar valores de empaques (si los inputs existen después de updateDynamicInputs)
            const undPaqInput = document.getElementById('unidadesPorPaquete');
            if (undPaqInput && producto.ventaPor?.paq) undPaqInput.value = producto.unidadesPorPaquete || 1;
            const undCjInput = document.getElementById('unidadesPorCaja');
            if (undCjInput && producto.ventaPor?.cj) undCjInput.value = producto.unidadesPorCaja || 1;

             // Rellenar precios (si los inputs existen después de updateDynamicInputs)
             const preciosExistentes = producto.precios || { und: producto.precioPorUnidad || 0 };
             const precioUndInput = document.getElementById('precioUnd');
             if (precioUndInput) precioUndInput.value = preciosExistentes.und || 0;
             const precioPaqInput = document.getElementById('precioPaq');
             if (precioPaqInput) precioPaqInput.value = preciosExistentes.paq || 0;
             const precioCjInput = document.getElementById('precioCj');
             if (precioCjInput) precioCjInput.value = preciosExistentes.cj || 0;

             // Rellenar manejo de vacíos
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
        }, 300); // Delay para asegurar que los dropdowns se poblaron

        // --- Fin Relleno ---

        // Listeners para botones de acción
        document.getElementById('editProductoForm').addEventListener('submit', (e) => handleUpdateProducto(e, productId));
        document.getElementById('backToModifyDeleteBtn').addEventListener('click', showModifyDeleteView);
    };


    async function handleUpdateProducto(e, productId) {
        e.preventDefault();
        if (_userRole !== 'admin') return;

        // Obtener datos actualizados del formulario
        const updatedData = getProductoDataFromForm(true); // true indica que es edición

        // Buscar producto original en caché (solo para referencia, no necesario para la actualización)
        const productoOriginal = _inventarioCache.find(p => p.id === productId);
        if (!productoOriginal) {
             _showModal('Error', 'No se encontró el producto original en la caché local.');
             return;
        }

        // --- Validaciones (iguales que en agregarProducto) ---
        if (!updatedData.rubro || !updatedData.segmento || !updatedData.marca || !updatedData.presentacion) { _showModal('Error', 'Completa Rubro, Segmento, Marca y Presentación.'); return; }
        if (!updatedData.ventaPor.und && !updatedData.ventaPor.paq && !updatedData.ventaPor.cj) { _showModal('Error', 'Selecciona al menos una forma de venta.'); return; }
        if (updatedData.manejaVacios && !updatedData.tipoVacio) { _showModal('Error', 'Si maneja vacío, selecciona el tipo.'); document.getElementById('tipoVacioSelect')?.focus(); return; }
        let precioValidoIngresado = false;
        if (updatedData.ventaPor.und && updatedData.precios.und > 0) precioValidoIngresado = true;
        if (updatedData.ventaPor.paq && updatedData.precios.paq > 0) precioValidoIngresado = true;
        if (updatedData.ventaPor.cj && updatedData.precios.cj > 0) precioValidoIngresado = true;
        if (!precioValidoIngresado) { _showModal('Error', 'Ingresa al menos un precio válido (> 0) para la forma de venta.'); document.querySelector('#preciosContainer input[required]')?.focus(); return; }
        // --- Fin Validaciones ---

        _showModal('Progreso', 'Guardando cambios y propagando...');
        console.log('Saving changes for admin...');

        try {
            // Actualizar el documento del producto en Firestore para el admin
            // Usamos setDoc con merge:false (o simplemente setDoc) para SOBREESCRIBIR completamente la definición
            // excepto la cantidad que se preservó en updatedData desde el input readonly.
            // Si queremos preservar otros campos no editables, usaríamos merge:true y solo pasaríamos los campos editados.
            // Para la definición, sobreescribir es más seguro para asegurar consistencia.
            await _setDoc(_doc(_db, `artifacts/${_appId}/users/${_userId}/inventario`, productId), updatedData);

            // Propagar los cambios de DEFINICIÓN a todos los usuarios
            if (window.adminModule?.propagateProductChange) {
                 console.log('Propagating changes...');
                 // Pasamos updatedData, la función de propagación mantendrá la cantidad de cada usuario
                await window.adminModule.propagateProductChange(productId, updatedData);
                 console.log('Product modified and propagated.');
            } else {
                 console.log('Product modified locally (propagation not available).');
            }

            _showModal('Éxito', 'Producto modificado y cambios propagados exitosamente.');
            showModifyDeleteView(); // Volver a la lista

        } catch (err) {
            console.error("Error al modificar producto:", err);
            _showModal('Error', `Error al modificar: ${err.message}`);
        }
    }

    function deleteProducto(productId) {
        if (_userRole !== 'admin') { _showModal('Acceso Denegado', 'Solo los administradores pueden eliminar productos.'); return; }
        const producto = _inventarioCache.find(p => p.id === productId);
        if (!producto) { _showModal('Error', 'Producto no encontrado.'); return; }

        _showModal('Confirmar Eliminación', `¿Estás seguro de que quieres eliminar "${producto.presentacion}"? Esta acción se propagará a todos los usuarios y es IRREVERSIBLE.`, async () => {
             _showModal('Progreso', `Eliminando "${producto.presentacion}"...`);
             console.log(`Deleting "${producto.presentacion}" for admin...`);
            try {
                // Eliminar de la colección del admin
                await _deleteDoc(_doc(_db, `artifacts/${_appId}/users/${_userId}/inventario`, productId));

                // Propagar la eliminación a todos los usuarios
                if (window.adminModule?.propagateProductChange) {
                     console.log('Propagating deletion...');
                     // Pasar null como productData para indicar eliminación
                    await window.adminModule.propagateProductChange(productId, null);
                     console.log('Product deleted and propagated.');
                } else {
                     console.log('Product deleted locally (propagation not available).');
                }
                _showModal('Éxito', 'Producto eliminado y acción propagada correctamente.');
                // La lista se actualizará automáticamente por el listener onSnapshot
            } catch (e) {
                 console.error("Error al eliminar producto:", e);
                 _showModal('Error', `Error al eliminar: ${e.message}`);
            }
        }, 'Sí, Eliminar y Propagar');
    };


    async function handleDeleteAllProductos() {
        if (_userRole !== 'admin') return;
        _showModal('Confirmación Extrema', `<p class="text-red-600 font-bold">¡ADVERTENCIA MAYOR!</p><p>¿Estás SEGURO de que quieres eliminar TODOS los productos de TODOS los usuarios? Esta acción es IRREVERSIBLE.</p>`, async () => {
            _showModal('Progreso', 'Eliminando todos los productos para el administrador...');
            try {
                // 1. Obtener IDs de todos los productos del admin
                const adminInventarioRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`);
                const snapshot = await _getDocs(adminInventarioRef);
                if (snapshot.empty) { _showModal('Aviso', 'No hay productos para eliminar.'); return; }
                const productIdsToDelete = snapshot.docs.map(doc => doc.id);

                // 2. Eliminar productos del admin (usando batch)
                const batchAdmin = _writeBatch(_db);
                snapshot.docs.forEach(doc => batchAdmin.delete(doc.ref));
                await batchAdmin.commit();
                console.log(`Deleted ${productIdsToDelete.length} products for admin.`);

                // 3. Propagar la eliminación a todos los demás usuarios
                if (window.adminModule?.propagateProductChange) {
                     _showModal('Progreso', `Propagando eliminación de ${productIdsToDelete.length} productos a otros usuarios...`);
                     console.log(`Propagating deletion of ${productIdsToDelete.length} products...`);
                     let propagationErrors = 0;
                     // Iterar sobre cada ID y llamar a la propagación con 'null'
                     for (const productId of productIdsToDelete) {
                          try { await window.adminModule.propagateProductChange(productId, null); }
                          catch (propError) { console.error(`Error propagating deletion for ${productId}:`, propError); propagationErrors++; }
                     }
                      _showModal(propagationErrors > 0 ? 'Advertencia' : 'Éxito', `Todos los productos eliminados localmente.${propagationErrors > 0 ? ` Ocurrieron ${propagationErrors} errores al propagar la eliminación.` : ' Eliminación propagada correctamente.'}`);
                } else {
                     _showModal('Éxito', 'Todos los productos eliminados localmente (no se pudo propagar).');
                }
                // La lista del admin se actualizará automáticamente por el listener
            } catch (error) {
                console.error("Error al eliminar todos los productos:", error);
                _showModal('Error', `Error durante la eliminación masiva: ${error.message}`);
            }
        }, 'Sí, Eliminar Todos');
    }

    async function handleDeleteAllDatosMaestros() {
        if (_userRole !== 'admin') return;
        _showModal('Confirmar Borrado Datos Maestros', `<p class="text-red-600 font-bold">¡ADVERTENCIA MAYOR!</p><p>Se intentará eliminar TODOS los Rubros, Segmentos y Marcas que NO estén actualmente en uso en tu inventario. La eliminación se propagará. Esta acción es IRREVERSIBLE para los datos eliminados.</p>`, async () => {
           _showModal('Progreso', 'Verificando uso de datos maestros...');
           console.log('Verifying master data usage in admin inventory...');
            try {
                const collectionsToDelete = ['rubros', 'segmentos', 'marcas'];
                const deletedItemsMap = { rubros: [], segmentos: [], marcas: [] };
                 let itemsInUse = [];

                 // Obtener todos los productos del inventario del admin UNA VEZ
                 const inventarioSnapshot = await _getDocs(_collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`));
                 const allProducts = inventarioSnapshot.docs.map(d => d.data());

                 // Iterar sobre cada tipo de categoría
                 for (const colName of collectionsToDelete) {
                     const field = colName === 'rubros' ? 'rubro' : (colName === 'segmentos' ? 'segmento' : 'marca');
                     // Obtener todos los items de esta categoría
                     const catSnapshot = await _getDocs(_collection(_db, `artifacts/${_appId}/users/${_userId}/${colName}`));
                     // Verificar cada item contra la lista de productos
                     catSnapshot.docs.forEach(doc => {
                         const itemName = doc.data().name;
                         // Comprobar si algún producto usa este itemName en el campo correspondiente
                         if (allProducts.some(p => p[field] === itemName)) {
                             itemsInUse.push(`'${itemName}' (${colName.slice(0,-1)})`);
                         } else {
                              // Si no está en uso, añadir a la lista para eliminar
                              deletedItemsMap[colName].push({ id: doc.id, name: itemName });
                         }
                     });
                 }

                 // Si hay items en uso, mostrar error y detener
                 if (itemsInUse.length > 0) {
                      _showModal('Error', `No se pueden eliminar todos. Los siguientes están en uso en tu inventario: ${itemsInUse.join(', ')}. Elimínalos individualmente si es necesario.`);
                      return;
                 }

                 // Si no hay nada que eliminar (porque no existen o todos están en uso, aunque este último caso ya se manejó)
                 const totalToDelete = deletedItemsMap.rubros.length + deletedItemsMap.segmentos.length + deletedItemsMap.marcas.length;
                 if (totalToDelete === 0) {
                      _showModal('Aviso', 'No se encontraron datos maestros no utilizados para eliminar.');
                      return;
                 }

                _showModal('Progreso', `Eliminando ${totalToDelete} datos maestros no usados...`);
                console.log('Deleting unused master data for admin...');

                // Crear batch para eliminar del admin
                const batchAdmin = _writeBatch(_db);
                for (const colName in deletedItemsMap) {
                    deletedItemsMap[colName].forEach(item => {
                         const docRef = _doc(_db, `artifacts/${_appId}/users/${_userId}/${colName}`, item.id);
                         batchAdmin.delete(docRef);
                    });
                }
                await batchAdmin.commit();
                 console.log(`${totalToDelete} master data items deleted for admin.`);

                 // Propagar eliminaciones
                 if (window.adminModule?.propagateCategoryChange) {
                      _showModal('Progreso', 'Propagando eliminaciones...');
                      console.log('Propagating category deletions...');
                      let propagatedCount = 0;
                      let propagationErrors = 0;
                      for (const colName in deletedItemsMap) {
                          for (const item of deletedItemsMap[colName]) {
                               try {
                                    // Pasar null para indicar eliminación
                                    await window.adminModule.propagateCategoryChange(colName, item.id, null);
                                    propagatedCount++;
                                }
                               catch (propError) {
                                    console.error(`Error propagating deletion for ${colName}/${item.id} (${item.name}):`, propError);
                                    propagationErrors++;
                                }
                          }
                      }
                      _showModal(propagationErrors > 0 ? 'Advertencia' : 'Éxito', `Datos maestros no usados eliminados localmente.${propagationErrors > 0 ? ` Ocurrieron ${propagationErrors} errores al propagar.` : ' Eliminación propagada.'}`);
                 } else {
                      _showModal('Éxito', 'Datos maestros no usados eliminados localmente (no se pudo propagar).');
                 }
                  invalidateSegmentOrderCache(); // Invalidar caché de segmentos
            } catch (error) {
                console.error("Error al eliminar todos los datos maestros:", error);
                _showModal('Error', `Error durante la eliminación masiva: ${error.message}`);
            }
        }, 'Sí, Eliminar No Usados y Propagar');
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

