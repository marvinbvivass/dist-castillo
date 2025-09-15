// --- Lógica del módulo de Inventario ---

(function() {
    // Variables locales del módulo que se inicializarán desde index.html
    let _db, _userId, _appId, _mainContent, _floatingControls, _activeListeners;
    let _showMainMenu, _showModal, _showAddItemModal, _populateDropdown;
    let _collection, _onSnapshot, _doc, _addDoc, _setDoc, _deleteDoc, _query, _where, _getDocs, _writeBatch;
    
    let _inventarioCache = []; // Caché local para búsquedas y ediciones rápidas

    /**
     * Inicializa el módulo con las dependencias necesarias desde la app principal.
     */
    window.initInventario = function(dependencies) {
        _db = dependencies.db;
        _userId = dependencies.userId;
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

    /**
     * Renderiza el menú de subopciones de inventario.
     */
    window.showInventarioSubMenu = function() {
        _floatingControls.classList.add('hidden');
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl text-center">
                        <h1 class="text-3xl font-bold text-gray-800 mb-6">Gestión de Inventario</h1>
                        <div class="space-y-4">
                            <button id="verInventarioBtn" class="w-full px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg shadow-md hover:bg-blue-600 transition duration-300 transform hover:scale-105">
                                Ver Inventario
                            </button>
                            <button id="agregarProductoBtn" class="w-full px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg shadow-md hover:bg-blue-600 transition duration-300 transform hover:scale-105">
                                Agregar Producto
                            </button>
                            <button id="modifyDeleteBtn" class="w-full px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg shadow-md hover:bg-blue-600 transition duration-300 transform hover:scale-105">
                                Modificar / Eliminar Producto
                            </button>
                            <button id="ajusteMasivoBtn" class="w-full px-6 py-3 bg-teal-500 text-white font-semibold rounded-lg shadow-md hover:bg-teal-600 transition duration-300 transform hover:scale-105">
                                Ajuste Masivo de Cantidades
                            </button>
                             <button id="modificarDatosBtn" class="w-full px-6 py-3 bg-yellow-500 text-gray-800 font-semibold rounded-lg shadow-md hover:bg-yellow-600 transition duration-300 transform hover:scale-105">
                                Modificar Datos Maestros
                            </button>
                            <button id="backToMenuBtn" class="w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500 transition duration-300 transform hover:scale-105">
                                Volver al Menú Principal
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('verInventarioBtn').addEventListener('click', showVerInventarioView);
        document.getElementById('agregarProductoBtn').addEventListener('click', showAgregarProductoView);
        document.getElementById('modifyDeleteBtn').addEventListener('click', showModifyDeleteView);
        document.getElementById('ajusteMasivoBtn').addEventListener('click', showAjusteMasivoView);
        document.getElementById('modificarDatosBtn').addEventListener('click', showModificarDatosView);
        document.getElementById('backToMenuBtn').addEventListener('click', _showMainMenu);
    }

    /**
     * Muestra la vista para el ajuste masivo de cantidades.
     */
    function showAjusteMasivoView() {
        _floatingControls.classList.add('hidden');
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl">
                        <h2 class="text-2xl font-bold text-gray-800 mb-6 text-center">Ajuste Masivo de Cantidades</h2>
                        <div class="mb-4">
                           <label for="ajusteRubroFilter" class="block text-gray-700 font-medium mb-2">Filtrar por Rubro:</label>
                           <select id="ajusteRubroFilter" class="w-full px-4 py-2 border rounded-lg">
                               <option value="">Todos los Rubros</option>
                           </select>
                        </div>
                        <div id="ajusteListContainer" class="overflow-x-auto max-h-96">
                            <p class="text-gray-500 text-center">Cargando productos...</p>
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
        const rubroFilter = document.getElementById('ajusteRubroFilter');
        _populateDropdown('rubros', 'ajusteRubroFilter', 'Rubro');
        rubroFilter.addEventListener('change', () => renderAjusteMasivoList(rubroFilter.value));
        renderAjusteMasivoList('');
    }

    /**
     * Renderiza la lista de productos para el ajuste masivo.
     */
    function renderAjusteMasivoList(rubro = '') {
        const container = document.getElementById('ajusteListContainer');
        if (!container) return;

        let q = _query(_collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`));
        if (rubro) {
            q = _query(q, _where("rubro", "==", rubro));
        }

        const unsubscribe = _onSnapshot(q, (snapshot) => {
            const productos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            if (productos.length === 0) {
                container.innerHTML = `<p class="text-gray-500 text-center">No hay productos que coincidan.</p>`;
                return;
            }

            let tableHTML = `
                <table class="min-w-full bg-white border">
                    <thead class="bg-gray-100 sticky top-0">
                        <tr>
                            <th class="py-2 px-4 border-b text-left text-sm">Producto</th>
                            <th class="py-2 px-4 border-b text-center text-sm w-32">Cantidad Nueva</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            productos.forEach(p => {
                tableHTML += `
                    <tr class="hover:bg-gray-50">
                        <td class="py-2 px-4 border-b text-sm">
                            <p class="font-semibold">${p.presentacion} (${p.segmento})</p>
                            <p class="text-xs text-gray-600">Actual: ${p.cantidad}</p>
                        </td>
                        <td class="py-2 px-4 border-b text-center">
                            <input type="number" value="${p.cantidad}" data-doc-id="${p.id}" class="w-24 p-1 text-center border rounded-lg">
                        </td>
                    </tr>
                `;
            });
            tableHTML += `</tbody></table>`;
            container.innerHTML = tableHTML;
        });
        _activeListeners.push(unsubscribe);
    }
    
    /**
     * Guarda los cambios de cantidad realizados masivamente.
     */
    async function handleGuardarAjusteMasivo() {
        const inputs = document.querySelectorAll('#ajusteListContainer input[data-doc-id]');
        if (inputs.length === 0) {
            _showModal('Aviso', 'No hay cambios que guardar.');
            return;
        }

        const batch = _writeBatch(_db);
        let changesCount = 0;

        inputs.forEach(input => {
            const docId = input.dataset.docId;
            const nuevaCantidad = parseInt(input.value, 10);
            const productoOriginal = _inventarioCache.find(p => p.id === docId);

            // Solo actualizar si la cantidad es un número válido y ha cambiado
            if (!isNaN(nuevaCantidad) && productoOriginal && productoOriginal.cantidad !== nuevaCantidad) {
                const docRef = _doc(_db, `artifacts/${_appId}/users/${_userId}/inventario`, docId);
                batch.update(docRef, { cantidad: nuevaCantidad });
                changesCount++;
            }
        });

        if (changesCount === 0) {
            _showModal('Aviso', 'No se detectaron cambios en las cantidades.');
            return;
        }

        _showModal('Confirmar Cambios', `Estás a punto de actualizar ${changesCount} producto(s). ¿Deseas continuar?`, async () => {
            try {
                await batch.commit();
                _showModal('Éxito', 'Las cantidades del inventario se han actualizado correctamente.');
                showInventarioSubMenu();
            } catch (error) {
                console.error("Error al guardar ajuste masivo:", error);
                _showModal('Error', 'Hubo un error al guardar los cambios.');
            }
        });
    }


    /**
     * Muestra la vista para modificar los datos maestros (Rubros, Segmentos, Marcas).
     */
    function showModificarDatosView() {
        _floatingControls.classList.add('hidden');
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl">
                        <h2 class="text-2xl font-bold text-gray-800 mb-6 text-center">Modificar Datos Maestros</h2>
                        
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <!-- Columna de Rubros -->
                            <div>
                                <h3 class="text-lg font-semibold text-gray-700 mb-2 border-b pb-2">Rubros</h3>
                                <div id="rubros-list" class="space-y-2 max-h-60 overflow-y-auto"></div>
                            </div>
                            <!-- Columna de Segmentos -->
                            <div>
                                <h3 class="text-lg font-semibold text-gray-700 mb-2 border-b pb-2">Segmentos</h3>
                                <div id="segmentos-list" class="space-y-2 max-h-60 overflow-y-auto"></div>
                            </div>
                            <!-- Columna de Marcas -->
                            <div>
                                <h3 class="text-lg font-semibold text-gray-700 mb-2 border-b pb-2">Marcas</h3>
                                <div id="marcas-list" class="space-y-2 max-h-60 overflow-y-auto"></div>
                            </div>
                        </div>

                        <button id="backToInventarioBtn" class="mt-8 w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver</button>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('backToInventarioBtn').addEventListener('click', showInventarioSubMenu);

        // Renderizar las listas para cada categoría
        renderDataListForEditing('rubros', 'rubros-list', 'Rubro');
        renderDataListForEditing('segmentos', 'segmentos-list', 'Segmento');
        renderDataListForEditing('marcas', 'marcas-list', 'Marca');
    }

    /**
     * Renderiza una lista de datos (rubros, etc.) con botones para eliminar.
     */
    function renderDataListForEditing(collectionName, containerId, itemName) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const collectionRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/${collectionName}`);
        const unsubscribe = _onSnapshot(collectionRef, (snapshot) => {
            const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => a.name.localeCompare(b.name));
            if (items.length === 0) {
                container.innerHTML = `<p class="text-gray-500 text-sm">No hay ${itemName.toLowerCase()}s.</p>`;
                return;
            }
            container.innerHTML = items.map(item => `
                <div class="flex justify-between items-center bg-gray-50 p-2 rounded">
                    <span class="text-gray-800">${item.name}</span>
                    <button onclick="window.inventarioModule.handleDeleteDataItem('${collectionName}', '${item.name}', '${itemName}')" class="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600">Eliminar</button>
                </div>
            `).join('');
        });
        _activeListeners.push(unsubscribe);
    }

    /**
     * Maneja la eliminación de un item de datos maestros, con validación de uso.
     */
    async function handleDeleteDataItem(collectionName, itemName, itemType) {
        // Mapear el nombre de la colección al campo correspondiente en 'inventario'
        const fieldMap = {
            rubros: 'rubro',
            segmentos: 'segmento',
            marcas: 'marca'
        };
        const fieldName = fieldMap[collectionName];

        // 1. Validar si el item está en uso
        const inventarioRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`);
        const q = _query(inventarioRef, _where(fieldName, "==", itemName));
        
        try {
            const usageSnapshot = await _getDocs(q);
            if (!usageSnapshot.empty) {
                _showModal('Error al Eliminar', `No se puede eliminar el ${itemType.toLowerCase()} "${itemName}" porque está siendo utilizado por ${usageSnapshot.size} producto(s).`);
                return;
            }

            // 2. Si no está en uso, pedir confirmación y eliminar
            _showModal('Confirmar Eliminación', `¿Estás seguro de que deseas eliminar el ${itemType.toLowerCase()} "${itemName}"? Esta acción no se puede deshacer.`, async () => {
                const itemQuery = _query(_collection(_db, `artifacts/${_appId}/users/${_userId}/${collectionName}`), _where("name", "==", itemName));
                const itemSnapshot = await _getDocs(itemQuery);

                if (!itemSnapshot.empty) {
                    const docId = itemSnapshot.docs[0].id;
                    await _deleteDoc(_doc(_db, `artifacts/${_appId}/users/${_userId}/${collectionName}`, docId));
                    _showModal('Éxito', `${itemType} "${itemName}" ha sido eliminado.`);
                } else {
                    _showModal('Error', `No se pudo encontrar el ${itemType.toLowerCase()} para eliminar.`);
                }
            });

        } catch (error) {
            console.error(`Error al validar el uso de ${itemName}:`, error);
            _showModal('Error', 'Ocurrió un error al intentar eliminar el item.');
        }
    }

    /**
     * Muestra la vista para agregar un nuevo producto.
     */
    function showAgregarProductoView() {
        _floatingControls.classList.add('hidden');
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl text-center">
                        <h2 class="text-2xl font-bold text-gray-800 mb-6">Agregar Producto</h2>
                        <form id="productoForm" class="space-y-4 text-left">
                            <div>
                                <label for="rubro" class="block text-gray-700 font-medium mb-2">Rubro:</label>
                                <div class="flex items-center space-x-2">
                                    <select id="rubro" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required></select>
                                    <button type="button" id="addRubroBtn" class="px-4 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500">Agregar</button>
                                </div>
                            </div>
                            <div>
                                <label for="segmento" class="block text-gray-700 font-medium mb-2">Segmento:</label>
                                <div class="flex items-center space-x-2">
                                    <select id="segmento" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required></select>
                                    <button type="button" id="addSegmentoBtn" class="px-4 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500">Agregar</button>
                                </div>
                            </div>
                            <div>
                                <label for="marca" class="block text-gray-700 font-medium mb-2">Marca:</label>
                                <div class="flex items-center space-x-2">
                                    <select id="marca" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required></select>
                                    <button type="button" id="addMarcaBtn" class="px-4 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500">Agregar</button>
                                </div>
                            </div>
                            <div>
                                <label for="presentacion" class="block text-gray-700 font-medium mb-2">Presentación:</label>
                                <input type="text" id="presentacion" class="w-full px-4 py-2 border rounded-lg" required>
                            </div>
                            <div>
                                <label for="precio" class="block text-gray-700 font-medium mb-2">Precio (USD):</label>
                                <input type="number" step="0.01" id="precio" class="w-full px-4 py-2 border rounded-lg" required>
                            </div>
                            <div>
                                <label for="cantidad" class="block text-gray-700 font-medium mb-2">Cantidad:</label>
                                <input type="number" id="cantidad" class="w-full px-4 py-2 border rounded-lg" required>
                            </div>
                            <div>
                                <label for="ivaTipo" class="block text-gray-700 font-medium mb-2">Tipo de IVA:</label>
                                <select id="ivaTipo" class="w-full px-4 py-2 border rounded-lg" required>
                                    <option value="16">IVA 16%</option>
                                    <option value="0">Excento</option>
                                </select>
                            </div>
                            <button type="submit" class="w-full px-6 py-3 bg-green-500 text-white font-semibold rounded-lg shadow-md hover:bg-green-600">Guardar Producto</button>
                        </form>
                        <button id="backToInventarioBtn" class="mt-4 w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver</button>
                    </div>
                </div>
            </div>
        `;
        _populateDropdown('rubros', 'rubro', 'rubro');
        _populateDropdown('segmentos', 'segmento', 'segmento');
        _populateDropdown('marcas', 'marca', 'marca');
        
        document.getElementById('productoForm').addEventListener('submit', agregarProducto);
        document.getElementById('backToInventarioBtn').addEventListener('click', showInventarioSubMenu);
        document.getElementById('addRubroBtn').addEventListener('click', () => _showAddItemModal('rubros', 'Rubro'));
        document.getElementById('addSegmentoBtn').addEventListener('click', () => _showAddItemModal('segmentos', 'Segmento'));
        document.getElementById('addMarcaBtn').addEventListener('click', () => _showAddItemModal('marcas', 'Marca'));
    }

    /**
     * Agrega un nuevo producto al inventario con validación de duplicados.
     */
    async function agregarProducto(e) {
        e.preventDefault();
        const producto = {
            rubro: document.getElementById('rubro').value,
            segmento: document.getElementById('segmento').value,
            marca: document.getElementById('marca').value,
            presentacion: document.getElementById('presentacion').value.trim(),
            precio: parseFloat(document.getElementById('precio').value),
            cantidad: parseInt(document.getElementById('cantidad').value, 10),
            iva: parseInt(document.getElementById('ivaTipo').value, 10)
        };

        // Validar que todos los campos requeridos estén llenos
        if (!producto.rubro || !producto.segmento || !producto.marca || !producto.presentacion) {
            _showModal('Error', 'Todos los campos (Rubro, Segmento, Marca y Presentación) son obligatorios.');
            return;
        }

        try {
            // Verificar si el producto ya existe
            const inventarioRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`);
            const q = _query(inventarioRef, 
                _where("rubro", "==", producto.rubro),
                _where("segmento", "==", producto.segmento),
                _where("marca", "==", producto.marca),
                _where("presentacion", "==", producto.presentacion)
            );

            const querySnapshot = await _getDocs(q);

            if (!querySnapshot.empty) {
                _showModal('Producto Duplicado', 'Ya existe un producto con el mismo Rubro, Segmento, Marca y Presentación.');
                return;
            }

            // Si no existe, agregarlo
            await _addDoc(inventarioRef, producto);
            _showModal('Éxito', 'Producto agregado correctamente.');
            e.target.reset();

        } catch (err) {
            console.error("Error al agregar producto:", err);
            _showModal('Error', 'Hubo un error al guardar el producto.');
        }
    }

    /**
     * Muestra la vista de "Ver Inventario".
     */
    function showVerInventarioView() {
        _floatingControls.classList.add('hidden');
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl">
                        <h2 class="text-2xl font-bold text-gray-800 mb-6 text-center">Ver Inventario</h2>
                        <div class="mb-4">
                           <label for="verInventarioRubroFilter" class="block text-gray-700 font-medium mb-2">Filtrar por Rubro:</label>
                           <select id="verInventarioRubroFilter" class="w-full px-4 py-2 border rounded-lg">
                               <option value="">Todos los Rubros</option>
                           </select>
                        </div>
                        <div id="productosListContainer" class="overflow-x-auto">
                            <p class="text-gray-500 text-center">Cargando productos...</p>
                        </div>
                        <button id="backToInventarioBtn" class="mt-6 w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver</button>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('backToInventarioBtn').addEventListener('click', showInventarioSubMenu);
        const rubroFilter = document.getElementById('verInventarioRubroFilter');
        _populateDropdown('rubros', 'verInventarioRubroFilter', 'Rubro');
        rubroFilter.addEventListener('change', () => renderProductosList('productosListContainer', true));
        renderProductosList('productosListContainer', true);
    }

    /**
     * Muestra la vista para modificar o eliminar un producto.
     */
    function showModifyDeleteView() {
        _floatingControls.classList.add('hidden');
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl">
                        <h2 class="text-2xl font-bold text-gray-800 mb-6 text-center">Modificar / Eliminar Producto</h2>
                        
                        <!-- Sección de Filtros y Búsqueda -->
                        <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 p-4 border rounded-lg">
                            <input type="text" id="search-input" placeholder="Buscar por presentación..." class="md:col-span-4 w-full px-4 py-2 border rounded-lg">
                            <div>
                                <label for="filter-rubro" class="text-sm font-medium">Rubro</label>
                                <select id="filter-rubro" class="w-full px-2 py-1 border rounded-lg text-sm"><option value="">Todos</option></select>
                            </div>
                             <div>
                                <label for="filter-segmento" class="text-sm font-medium">Segmento</label>
                                <select id="filter-segmento" class="w-full px-2 py-1 border rounded-lg text-sm"><option value="">Todos</option></select>
                            </div>
                             <div>
                                <label for="filter-marca" class="text-sm font-medium">Marca</label>
                                <select id="filter-marca" class="w-full px-2 py-1 border rounded-lg text-sm"><option value="">Todos</option></select>
                            </div>
                            <button id="clear-filters-btn" class="bg-gray-300 text-sm font-semibold rounded-lg self-end py-1">Limpiar Filtros</button>
                        </div>
                        
                        <div id="productosListContainer" class="overflow-x-auto max-h-96">
                            <p class="text-gray-500 text-center">Cargando productos...</p>
                        </div>
                        <button id="backToInventarioBtn" class="mt-6 w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver</button>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('backToInventarioBtn').addEventListener('click', showInventarioSubMenu);
        
        // Poblar y configurar filtros
        _populateDropdown('rubros', 'filter-rubro', 'Rubro');
        _populateDropdown('segmentos', 'filter-segmento', 'Segmento');
        _populateDropdown('marcas', 'filter-marca', 'Marca');

        const searchInput = document.getElementById('search-input');
        const filterRubro = document.getElementById('filter-rubro');
        const filterSegmento = document.getElementById('filter-segmento');
        const filterMarca = document.getElementById('filter-marca');
        const clearBtn = document.getElementById('clear-filters-btn');

        const applyFilters = () => {
            renderProductosList('productosListContainer', false);
        };

        searchInput.addEventListener('input', applyFilters);
        filterRubro.addEventListener('change', applyFilters);
        filterSegmento.addEventListener('change', applyFilters);
        filterMarca.addEventListener('change', applyFilters);
        
        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            filterRubro.value = '';
            filterSegmento.value = '';
            filterMarca.value = '';
            applyFilters();
        });

        renderProductosList('productosListContainer', false);
    }

    /**
     * Renderiza la lista de productos en una tabla.
     */
    function renderProductosList(elementId, readOnly = false) {
        const container = document.getElementById(elementId);
        if (!container) return;

        // Obtener valores de los filtros
        const searchTerm = document.getElementById('search-input')?.value.toLowerCase() || '';
        const rubroFilter = document.getElementById('filter-rubro')?.value || '';
        const segmentoFilter = document.getElementById('filter-segmento')?.value || '';
        const marcaFilter = document.getElementById('filter-marca')?.value || '';

        const unsubscribe = _onSnapshot(_collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`), (snapshot) => {
            _inventarioCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Aplicar filtros
            let productos = _inventarioCache.filter(p => {
                const searchMatch = !searchTerm || p.presentacion.toLowerCase().includes(searchTerm);
                const rubroMatch = !rubroFilter || p.rubro === rubroFilter;
                const segmentoMatch = !segmentoFilter || p.segmento === segmentoFilter;
                const marcaMatch = !marcaFilter || p.marca === marcaFilter;
                return searchMatch && rubroMatch && segmentoMatch && marcaMatch;
            });

            if (productos.length === 0) {
                container.innerHTML = `<p class="text-gray-500 text-center">No hay productos que coincidan.</p>`;
                return;
            }

            let tableHTML = `
                <table class="min-w-full bg-white border border-gray-200">
                    <thead class="bg-gray-200 sticky top-0">
                        <tr>
                            <th class="py-2 px-4 border-b text-left text-sm">Presentación</th>
                            <th class="py-2 px-4 border-b text-left text-sm">Marca</th>
                            <th class="py-2 px-4 border-b text-right text-sm">Precio</th>
                            <th class="py-2 px-4 border-b text-center text-sm">Cantidad</th>
                            ${!readOnly ? `<th class="py-2 px-4 border-b text-center text-sm">Acciones</th>` : ''}
                        </tr>
                    </thead>
                    <tbody>
            `;
            productos.forEach(p => {
                tableHTML += `
                    <tr class="hover:bg-gray-50">
                        <td class="py-2 px-4 border-b text-sm">${p.presentacion} (${p.segmento})</td>
                        <td class="py-2 px-4 border-b text-sm">${p.marca}</td>
                        <td class="py-2 px-4 border-b text-right text-sm">$${p.precio.toFixed(2)}</td>
                        <td class="py-2 px-4 border-b text-center text-sm">${p.cantidad}</td>
                        ${!readOnly ? `
                        <td class="py-2 px-4 border-b text-center space-x-2">
                            <button onclick="window.inventarioModule.editProducto('${p.id}')" class="px-3 py-1 bg-yellow-500 text-white text-xs rounded-lg hover:bg-yellow-600">Editar</button>
                            <button onclick="window.inventarioModule.deleteProducto('${p.id}')" class="px-3 py-1 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600">Eliminar</button>
                        </td>` : ''}
                    </tr>
                `;
            });
            tableHTML += `</tbody></table>`;
            container.innerHTML = tableHTML;
        });
        _activeListeners.push(unsubscribe);
    }
    
    /**
     * Muestra el formulario para editar un producto.
     */
    function editProducto(productId) {
        _floatingControls.classList.add('hidden');
        const producto = _inventarioCache.find(p => p.id === productId);
        if (!producto) return;

        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl text-center">
                        <h2 class="text-2xl font-bold text-gray-800 mb-6">Editar Producto</h2>
                        <form id="editProductoForm" class="space-y-4 text-left">
                            <p class="text-sm">Nota: Rubro, Segmento y Marca no se pueden editar.</p>
                            <div>
                                <label class="block text-gray-700 font-medium">Presentación:</label>
                                <p class="w-full px-4 py-2 bg-gray-100 rounded-lg">${producto.presentacion}</p>
                            </div>
                            <div>
                                <label for="editPrecio" class="block text-gray-700 font-medium mb-2">Precio (USD):</label>
                                <input type="number" step="0.01" id="editPrecio" value="${producto.precio}" class="w-full px-4 py-2 border rounded-lg" required>
                            </div>
                            <div>
                                <label for="editCantidad" class="block text-gray-700 font-medium mb-2">Cantidad:</label>
                                <input type="number" id="editCantidad" value="${producto.cantidad}" class="w-full px-4 py-2 border rounded-lg" required>
                            </div>
                             <div>
                                <label for="editIvaTipo" class="block text-gray-700 font-medium mb-2">Tipo de IVA:</label>
                                <select id="editIvaTipo" class="w-full px-4 py-2 border rounded-lg" required>
                                    <option value="16" ${producto.iva === 16 ? 'selected' : ''}>IVA 16%</option>
                                    <option value="0" ${producto.iva === 0 ? 'selected' : ''}>Excento</option>
                                </select>
                            </div>
                            <button type="submit" class="w-full px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg shadow-md hover:bg-blue-600">Guardar Cambios</button>
                        </form>
                        <button id="backToModifyDeleteBtn" class="mt-4 w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver</button>
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('editProductoForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                await _setDoc(_doc(_db, `artifacts/${_appId}/users/${_userId}/inventario`, productId), {
                    precio: parseFloat(document.getElementById('editPrecio').value),
                    cantidad: parseInt(document.getElementById('editCantidad').value, 10),
                    iva: parseInt(document.getElementById('editIvaTipo').value, 10)
                }, { merge: true });
                _showModal('Éxito', 'Producto modificado exitosamente.');
                showModifyDeleteView();
            } catch (err) {
                _showModal('Error', 'Hubo un error al modificar el producto.');
            }
        });
        document.getElementById('backToModifyDeleteBtn').addEventListener('click', showModifyDeleteView);
    };

    /**
     * Elimina un producto.
     */
    function deleteProducto(productId) {
        _showModal('Confirmar Eliminación', '¿Estás seguro de que deseas eliminar este producto?', async () => {
            try {
                await _deleteDoc(_doc(_db, `artifacts/${_appId}/users/${_userId}/inventario`, productId));
                _showModal('Éxito', 'Producto eliminado correctamente.');
            } catch (e) {
                _showModal('Error', 'Hubo un error al eliminar el producto.');
            }
        });
    };

    // Exponer funciones públicas al objeto window para ser llamadas desde el HTML
    window.inventarioModule = {
        editProducto,
        deleteProducto,
        handleDeleteDataItem
    };

})();
