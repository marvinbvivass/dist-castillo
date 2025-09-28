// --- Lógica del módulo de Inventario ---

(function() {
    // Variables locales del módulo que se inicializarán desde index.html
    let _db, _userId, _appId, _mainContent, _floatingControls, _activeListeners;
    let _showMainMenu, _showModal, _showAddItemModal, _populateDropdown;
    let _collection, _onSnapshot, _doc, _addDoc, _setDoc, _deleteDoc, _query, _where, _getDocs, _writeBatch;
    
    let _inventarioCache = []; // Caché local para búsquedas y ediciones rápidas
    let _lastFilters = { searchTerm: '', rubro: '', segmento: '', marca: '' }; // Objeto para persistir los filtros
    let _segmentoOrderCache = null; // Caché para el orden de los segmentos

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
     * Muestra el submenú de opciones de inventario.
     */
    window.showInventarioSubMenu = function() {
        _floatingControls.classList.add('hidden');
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl text-center">
                        <h1 class="text-3xl font-bold text-gray-800 mb-6">Gestión de Inventario</h1>
                        <div class="space-y-4">
                            <button id="addProductoBtn" class="w-full px-6 py-3 bg-green-500 text-white font-semibold rounded-lg shadow-md hover:bg-green-600">Agregar Producto</button>
                            <button id="modificarProductoBtn" class="w-full px-6 py-3 bg-yellow-500 text-white font-semibold rounded-lg shadow-md hover:bg-yellow-600">Modificar / Eliminar Producto</button>
                            <button id="datosMaestrosBtn" class="w-full px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg shadow-md hover:bg-blue-600">Datos Maestros</button>
                        </div>
                        <button id="backToMenuBtn" class="mt-6 w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver</button>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('addProductoBtn').addEventListener('click', () => showAddOrEditProductoView());
        document.getElementById('modificarProductoBtn').addEventListener('click', showModificarEliminarView);
        document.getElementById('datosMaestrosBtn').addEventListener('click', showDatosMaestrosView);
        document.getElementById('backToMenuBtn').addEventListener('click', _showMainMenu);
    };

    /**
     * Muestra la vista para modificar o eliminar productos.
     */
    function showModificarEliminarView() {
        _mainContent.innerHTML = `
            <div class="p-4 w-full">
                <div class="bg-white/90 backdrop-blur-sm p-6 rounded-lg shadow-xl">
                    <div class="flex flex-col sm:flex-row justify-between sm:items-center mb-4 gap-4">
                        <h2 class="text-2xl font-bold text-gray-800">Inventario de Productos</h2>
                        <button id="backToInventarioMenuBtn" class="px-4 py-2 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500 w-full sm:w-auto">Volver</button>
                    </div>
                    
                    <!-- NUEVO: Contenedor de Búsqueda y Filtros -->
                    <div class="mb-4 p-4 bg-gray-50 rounded-lg border">
                        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                            <!-- Búsqueda -->
                            <div class="col-span-1 sm:col-span-2 md:col-span-4">
                                <label for="searchInput" class="block text-sm font-medium text-gray-700">Buscar por Código, Marca o Presentación</label>
                                <input type="text" id="searchInput" placeholder="Ej: 12345, Pepsi, 1.5L..." class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                            </div>
                            <!-- Filtro Rubro -->
                            <div>
                                <label for="rubroFilter" class="block text-sm font-medium text-gray-700">Rubro</label>
                                <select id="rubroFilter" class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"></select>
                            </div>
                            <!-- Filtro Segmento -->
                            <div>
                                <label for="segmentoFilter" class="block text-sm font-medium text-gray-700">Segmento</label>
                                <select id="segmentoFilter" class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md" disabled></select>
                            </div>
                            <!-- Filtro Marca -->
                            <div>
                                <label for="marcaFilter" class="block text-sm font-medium text-gray-700">Marca</label>
                                <select id="marcaFilter" class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md" disabled></select>
                            </div>
                        </div>
                    </div>

                    <div id="inventarioContainer" class="overflow-x-auto"><p class="text-gray-500 text-center">Cargando inventario...</p></div>
                </div>
            </div>
        `;

        document.getElementById('backToInventarioMenuBtn').addEventListener('click', showInventarioSubMenu);
        
        // Cargar el inventario en caché y luego configurar los filtros y renderizar la tabla
        loadInventarioCache().then(() => {
            setupCascadingFilters();
            applyFiltersAndRender();
        });
    }

    /**
     * Carga el inventario completo en la caché local.
     */
    function loadInventarioCache() {
        return new Promise((resolve, reject) => {
            const collectionRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`);
            const unsubscribe = _onSnapshot(collectionRef, (snapshot) => {
                _inventarioCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                resolve(); // Resuelve la promesa una vez que los datos están cargados
            }, (error) => {
                console.error("Error al cargar el inventario: ", error);
                document.getElementById('inventarioContainer').innerHTML = `<p class="text-red-500 text-center">Error al cargar el inventario.</p>`;
                reject(error);
            });
            _activeListeners.push(unsubscribe); // Guardar para limpieza posterior
        });
    }

    /**
     * Configura los listeners para los filtros en cascada.
     */
    function setupCascadingFilters() {
        const rubroFilter = document.getElementById('rubroFilter');
        const segmentoFilter = document.getElementById('segmentoFilter');
        const marcaFilter = document.getElementById('marcaFilter');
        const searchInput = document.getElementById('searchInput');

        // Poblar el filtro de rubros inicial
        const rubros = [...new Set(_inventarioCache.map(p => p.rubro))].sort();
        rubroFilter.innerHTML = '<option value="">Todos los Rubros</option>';
        rubros.forEach(r => rubroFilter.innerHTML += `<option value="${r}">${r}</option>`);

        // Listeners
        searchInput.addEventListener('input', applyFiltersAndRender);
        rubroFilter.addEventListener('change', () => {
            updateSegmentoFilter();
            applyFiltersAndRender();
        });
        segmentoFilter.addEventListener('change', () => {
            updateMarcaFilter();
            applyFiltersAndRender();
        });
        marcaFilter.addEventListener('change', applyFiltersAndRender);

        // Restaurar estado de los filtros
        searchInput.value = _lastFilters.searchTerm;
        rubroFilter.value = _lastFilters.rubro;
        updateSegmentoFilter(); // Esto poblará y seleccionará el segmento
        segmentoFilter.value = _lastFilters.segmento;
        updateMarcaFilter(); // Y esto poblará y seleccionará la marca
        marcaFilter.value = _lastFilters.marca;
    }

    /**
     * Actualiza el dropdown de Segmentos basado en el Rubro seleccionado.
     */
    function updateSegmentoFilter() {
        const rubroFilter = document.getElementById('rubroFilter');
        const segmentoFilter = document.getElementById('segmentoFilter');
        const marcaFilter = document.getElementById('marcaFilter');
        const selectedRubro = rubroFilter.value;

        // Limpiar y deshabilitar filtros dependientes
        segmentoFilter.innerHTML = '<option value="">Todos los Segmentos</option>';
        marcaFilter.innerHTML = '<option value="">Todas las Marcas</option>';
        segmentoFilter.disabled = true;
        marcaFilter.disabled = true;

        if (selectedRubro) {
            const segmentos = [...new Set(
                _inventarioCache
                    .filter(p => p.rubro === selectedRubro)
                    .map(p => p.segmento)
            )].sort();
            
            if (segmentos.length > 0) {
                segmentos.forEach(s => segmentoFilter.innerHTML += `<option value="${s}">${s}</option>`);
                segmentoFilter.disabled = false;
            }
        }
    }

    /**
     * Actualiza el dropdown de Marcas basado en el Rubro y Segmento seleccionados.
     */
    function updateMarcaFilter() {
        const rubroFilter = document.getElementById('rubroFilter');
        const segmentoFilter = document.getElementById('segmentoFilter');
        const marcaFilter = document.getElementById('marcaFilter');
        const selectedRubro = rubroFilter.value;
        const selectedSegmento = segmentoFilter.value;

        marcaFilter.innerHTML = '<option value="">Todas las Marcas</option>';
        marcaFilter.disabled = true;

        if (selectedRubro && selectedSegmento) {
            const marcas = [...new Set(
                _inventarioCache
                    .filter(p => p.rubro === selectedRubro && p.segmento === selectedSegmento)
                    .map(p => p.marca)
            )].sort();

            if (marcas.length > 0) {
                marcas.forEach(m => marcaFilter.innerHTML += `<option value="${m}">${m}</option>`);
                marcaFilter.disabled = false;
            }
        }
    }

    /**
     * Lee los filtros, los guarda y llama a renderInventario.
     */
    function applyFiltersAndRender() {
        _lastFilters.searchTerm = document.getElementById('searchInput').value;
        _lastFilters.rubro = document.getElementById('rubroFilter').value;
        _lastFilters.segmento = document.getElementById('segmentoFilter').value;
        _lastFilters.marca = document.getElementById('marcaFilter').value;
        renderInventario();
    }
    
    /**
     * Renderiza la tabla de inventario basado en los filtros y la búsqueda.
     */
    function renderInventario() {
        const container = document.getElementById('inventarioContainer');
        if (!container) return;

        // Aplicar filtros
        const { searchTerm, rubro, segmento, marca } = _lastFilters;
        const searchTermLower = searchTerm.toLowerCase();

        let filteredInventario = _inventarioCache.filter(p => {
            const matchesSearch = searchTermLower === '' ||
                (p.codigo && p.codigo.toLowerCase().includes(searchTermLower)) ||
                (p.marca && p.marca.toLowerCase().includes(searchTermLower)) ||
                (p.presentacion && p.presentacion.toLowerCase().includes(searchTermLower));
            
            const matchesRubro = rubro === '' || p.rubro === rubro;
            const matchesSegmento = segmento === '' || p.segmento === segmento;
            const matchesMarca = marca === '' || p.marca === marca;

            return matchesSearch && matchesRubro && matchesSegmento && matchesMarca;
        });

        // Ordenar el inventario filtrado
        filteredInventario.sort((a, b) => {
            if (a.rubro !== b.rubro) return (a.rubro || '').localeCompare(b.rubro || '');
            if (a.segmento !== b.segmento) return (a.segmento || '').localeCompare(b.segmento || '');
            if (a.marca !== b.marca) return (a.marca || '').localeCompare(b.marca || '');
            return (a.presentacion || '').localeCompare(b.presentacion || '');
        });

        if (filteredInventario.length === 0) {
            container.innerHTML = `<p class="text-center text-gray-500 py-4">No se encontraron productos que coincidan con los filtros.</p>`;
            return;
        }

        let tableHTML = `
            <table class="min-w-full bg-white text-sm">
                <thead class="bg-gray-200">
                    <tr>
                        <th class="py-2 px-3 border-b text-left">Producto</th>
                        <th class="py-2 px-3 border-b text-left">Rubro</th>
                        <th class="py-2 px-3 border-b text-right">Precio Und.</th>
                        <th class="py-2 px-3 border-b text-right">Stock Und.</th>
                        <th class="py-2 px-3 border-b text-center">Acciones</th>
                    </tr>
                </thead>
                <tbody>
        `;
        filteredInventario.forEach(producto => {
            tableHTML += `
                <tr class="hover:bg-gray-50">
                    <td class="py-2 px-3 border-b align-middle font-medium">${producto.marca || ''} ${producto.presentacion || ''}</td>
                    <td class="py-2 px-3 border-b align-middle">${producto.rubro || 'N/A'}</td>
                    <td class="py-2 px-3 border-b text-right align-middle">$${(producto.precioPorUnidad || 0).toFixed(2)}</td>
                    <td class="py-2 px-3 border-b text-right align-middle font-semibold">${producto.cantidadUnidades || 0}</td>
                    <td class="py-2 px-3 border-b text-center align-middle">
                        <button onclick="window.inventarioModule.editProducto('${producto.id}')" class="px-3 py-1 bg-yellow-500 text-white text-xs font-semibold rounded-lg hover:bg-yellow-600">Editar</button>
                        <button onclick="window.inventarioModule.deleteProducto('${producto.id}')" class="px-3 py-1 bg-red-500 text-white text-xs font-semibold rounded-lg hover:bg-red-600 ml-1">Eliminar</button>
                    </td>
                </tr>
            `;
        });
        tableHTML += `</tbody></table>`;
        container.innerHTML = tableHTML;
    }

    // ... El resto de las funciones (showAddOrEditProductoView, showDatosMaestrosView, etc.) permanecen igual.
    // Solo se necesitará ajustar la llamada a renderInventario si se modifica desde otras vistas.
    // A continuación, se incluyen las funciones sin modificar para que el archivo esté completo.

    /**
     * Muestra la vista para agregar o editar un producto.
     * Si se proporciona un productoId, carga los datos para editar.
     */
    function showAddOrEditProductoView(productoId = null) {
        const esEdicion = productoId !== null;
        const titulo = esEdicion ? 'Editar Producto' : 'Agregar Nuevo Producto';
        _mainContent.innerHTML = `
            <div class="p-4 w-full">
                <div class="bg-white/90 backdrop-blur-sm p-6 rounded-lg shadow-xl">
                    <h2 class="text-2xl font-bold text-gray-800 mb-6">${titulo}</h2>
                    <form id="productoForm" class="space-y-4">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><label class="block text-gray-700">Código de Barras</label><input type="text" id="codigo" class="w-full px-3 py-2 border rounded-lg"></div>
                            <div><label class="block text-gray-700">Rubro</label><select id="rubro" class="w-full px-3 py-2 border rounded-lg"></select></div>
                            <div><label class="block text-gray-700">Segmento</label><select id="segmento" class="w-full px-3 py-2 border rounded-lg"></select></div>
                            <div><label class="block text-gray-700">Marca</label><select id="marca" class="w-full px-3 py-2 border rounded-lg"></select></div>
                            <div><label class="block text-gray-700">Presentación</label><input type="text" id="presentacion" class="w-full px-3 py-2 border rounded-lg"></div>
                            <div><label class="block text-gray-700">Unidades por Paquete</label><input type="number" id="unidadesPorPaquete" class="w-full px-3 py-2 border rounded-lg"></div>
                            <div><label class="block text-gray-700">Precio por Paquete (USD)</label><input type="number" step="0.01" id="precioPorPaquete" class="w-full px-3 py-2 border rounded-lg"></div>
                            <div><label class="block text-gray-700">Precio por Unidad (USD)</label><input type="number" step="0.01" id="precioPorUnidad" class="w-full px-3 py-2 border rounded-lg" readonly></div>
                            <div><label class="block text-gray-700">Cantidad de Paquetes (Stock)</label><input type="number" id="cantidadPaquetes" class="w-full px-3 py-2 border rounded-lg"></div>
                            <div><label class="block text-gray-700">Cantidad de Unidades (Stock)</label><input type="number" id="cantidadUnidades" class="w-full px-3 py-2 border rounded-lg" readonly></div>
                            <div><label class="block text-gray-700">IVA (%)</label><input type="number" id="iva" class="w-full px-3 py-2 border rounded-lg" value="0"></div>
                        </div>
                        <div class="flex space-x-4 mt-6">
                            <button type="submit" class="w-full px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg shadow-md hover:bg-blue-600">Guardar</button>
                            <button type="button" id="backBtn" class="w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.getElementById('backBtn').addEventListener('click', showInventarioSubMenu);

        // Llenar los dropdowns
        _populateDropdown('rubros', 'rubro', 'Rubro');
        _populateDropdown('segmentos', 'segmento', 'Segmento');
        _populateDropdown('marcas', 'marca', 'Marca');

        // Lógica para calcular precios y cantidades
        const unidadesInput = document.getElementById('unidadesPorPaquete');
        const precioPaqueteInput = document.getElementById('precioPorPaquete');
        const precioUnidadInput = document.getElementById('precioPorUnidad');
        const cantidadPaquetesInput = document.getElementById('cantidadPaquetes');
        const cantidadUnidadesInput = document.getElementById('cantidadUnidades');

        function updateCalculos() {
            const unidades = parseFloat(unidadesInput.value) || 0;
            const precioPaquete = parseFloat(precioPaqueteInput.value) || 0;
            const cantidadPaquetes = parseFloat(cantidadPaquetesInput.value) || 0;

            if (unidades > 0) {
                precioUnidadInput.value = (precioPaquete / unidades).toFixed(2);
            } else {
                precioUnidadInput.value = '';
            }
            cantidadUnidadesInput.value = Math.floor(cantidadPaquetes * unidades);
        }

        unidadesInput.addEventListener('input', updateCalculos);
        precioPaqueteInput.addEventListener('input', updateCalculos);
        cantidadPaquetesInput.addEventListener('input', updateCalculos);

        if (esEdicion) {
            const producto = _inventarioCache.find(p => p.id === productoId);
            if (producto) {
                document.getElementById('codigo').value = producto.codigo || '';
                document.getElementById('rubro').value = producto.rubro || '';
                document.getElementById('segmento').value = producto.segmento || '';
                document.getElementById('marca').value = producto.marca || '';
                document.getElementById('presentacion').value = producto.presentacion || '';
                document.getElementById('unidadesPorPaquete').value = producto.unidadesPorPaquete || '';
                document.getElementById('precioPorPaquete').value = producto.precioPorPaquete || '';
                document.getElementById('cantidadPaquetes').value = producto.cantidadPaquetes || '';
                document.getElementById('iva').value = producto.iva || 0;
                updateCalculos(); // Para llenar campos calculados
            }
        }

        document.getElementById('productoForm').addEventListener('submit', (e) => handleSaveProducto(e, productoId));
    }

    /**
     * Maneja el guardado de un producto (nuevo o editado).
     */
    async function handleSaveProducto(e, productoId) {
        e.preventDefault();
        const productoData = {
            codigo: document.getElementById('codigo').value,
            rubro: document.getElementById('rubro').value,
            segmento: document.getElementById('segmento').value,
            marca: document.getElementById('marca').value,
            presentacion: document.getElementById('presentacion').value,
            unidadesPorPaquete: parseInt(document.getElementById('unidadesPorPaquete').value, 10),
            precioPorPaquete: parseFloat(document.getElementById('precioPorPaquete').value),
            precioPorUnidad: parseFloat(document.getElementById('precioPorUnidad').value),
            cantidadPaquetes: parseInt(document.getElementById('cantidadPaquetes').value, 10),
            cantidadUnidades: parseInt(document.getElementById('cantidadUnidades').value, 10),
            iva: parseFloat(document.getElementById('iva').value)
        };

        try {
            if (productoId) {
                // Editar
                const docRef = _doc(_db, `artifacts/${_appId}/users/${_userId}/inventario`, productoId);
                await _setDoc(docRef, productoData);
                _showModal('Éxito', 'Producto actualizado correctamente.', showModificarEliminarView);
            } else {
                // Agregar
                await _addDoc(_collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`), productoData);
                _showModal('Éxito', 'Producto agregado correctamente.', showInventarioSubMenu);
            }
        } catch (error) {
            _showModal('Error', `Ocurrió un error al guardar el producto: ${error.message}`);
        }
    }
    
    /**
     * Muestra la vista para gestionar datos maestros (Rubros, Segmentos, Marcas).
     */
    function showDatosMaestrosView() {
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl text-center">
                        <h2 class="text-2xl font-bold text-gray-800 mb-6">Gestionar Datos Maestros</h2>
                        <p class="text-gray-600 mb-6">Agrega o elimina las categorías base para tus productos.</p>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            <button id="addRubroBtn" class="w-full px-4 py-2 bg-sky-500 text-white rounded-lg">Agregar Rubro</button>
                            <button id="addSegmentoBtn" class="w-full px-4 py-2 bg-sky-500 text-white rounded-lg">Agregar Segmento</button>
                            <button id="addMarcaBtn" class="w-full px-4 py-2 bg-sky-500 text-white rounded-lg">Agregar Marca</button>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                            <div><h3 class="font-bold mb-2">Rubros</h3><ul id="rubrosList" class="text-left space-y-1"></ul></div>
                            <div><h3 class="font-bold mb-2">Segmentos</h3><ul id="segmentosList" class="text-left space-y-1"></ul></div>
                            <div><h3 class="font-bold mb-2">Marcas</h3><ul id="marcasList" class="text-left space-y-1"></ul></div>
                        </div>
                         <div class="mt-8 border-t pt-6">
                             <button id="deleteAllMaestrosBtn" class="w-full md:w-auto px-6 py-3 bg-red-700 text-white font-semibold rounded-lg shadow-md hover:bg-red-800">Eliminar Todos los Datos Maestros</button>
                        </div>
                        <button id="backToInventarioMenuBtn" class="mt-6 w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver</button>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('addRubroBtn').addEventListener('click', () => _showAddItemModal('rubros', 'Rubro'));
        document.getElementById('addSegmentoBtn').addEventListener('click', () => _showAddItemModal('segmentos', 'Segmento'));
        document.getElementById('addMarcaBtn').addEventListener('click', () => _showAddItemModal('marcas', 'Marca'));
        document.getElementById('backToInventarioMenuBtn').addEventListener('click', showInventarioSubMenu);
        document.getElementById('deleteAllMaestrosBtn').addEventListener('click', handleDeleteAllDatosMaestros);
        
        renderDataList('rubros', 'rubrosList');
        renderDataList('segmentos', 'segmentosList');
        renderDataList('marcas', 'marcasList');
    }
    
    function renderDataList(collectionName, elementId) {
        const listElement = document.getElementById(elementId);
        if (!listElement) return;

        const collectionRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/${collectionName}`);
        const unsubscribe = _onSnapshot(collectionRef, (snapshot) => {
            const items = snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name })).sort((a,b) => a.name.localeCompare(b.name));
            listElement.innerHTML = '';
            items.forEach(item => {
                const li = document.createElement('li');
                li.className = "flex justify-between items-center bg-gray-100 p-2 rounded";
                li.textContent = item.name;
                const deleteBtn = document.createElement('button');
                deleteBtn.innerHTML = '&times;';
                deleteBtn.className = 'ml-2 text-red-500 font-bold hover:text-red-700';
                deleteBtn.onclick = () => handleDeleteDataItem(collectionName, item.id, item.name);
                li.appendChild(deleteBtn);
                listElement.appendChild(li);
            });
        });
        _activeListeners.push(unsubscribe);
    }
    
    async function handleDeleteDataItem(collectionName, itemId, itemName) {
        const singularName = collectionName.slice(0, -1); 
        const q = _query(_collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`), _where(singularName, '==', itemName));
        
        try {
            const usageSnapshot = await _getDocs(q);
            if (!usageSnapshot.empty) {
                _showModal('Error', `No se puede eliminar "${itemName}" porque está siendo utilizado por ${usageSnapshot.size} producto(s).`);
                return;
            }
            
            _showModal('Confirmar Eliminación', `¿Seguro que quieres eliminar "${itemName}"?`, async () => {
                await _deleteDoc(_doc(_db, `artifacts/${_appId}/users/${_userId}/${collectionName}`, itemId));
            });

        } catch (error) {
            _showModal('Error', `Ocurrió un error: ${error.message}`);
        }
    }

    async function handleDeleteAllDatosMaestros() {
        _showModal('Confirmación Extrema', '¿Estás SEGURO de que quieres eliminar TODOS los Rubros, Segmentos y Marcas? Esta acción es irreversible.', async () => {
            _showModal('Progreso', 'Eliminando datos maestros...');
            try {
                const collectionsToDelete = ['rubros', 'segmentos', 'marcas'];
                for (const collectionName of collectionsToDelete) {
                    const collectionRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/${collectionName}`);
                    const snapshot = await _getDocs(collectionRef);
                    if (!snapshot.empty) {
                        const batch = _writeBatch(_db);
                        snapshot.docs.forEach(doc => batch.delete(doc.ref));
                        await batch.commit();
                    }
                }
                _showModal('Éxito', 'Todos los datos maestros han sido eliminados.');
            } catch (error) {
                console.error("Error al eliminar todos los datos maestros:", error);
                _showModal('Error', 'Hubo un error al eliminar los datos maestros.');
            }
        });
    }
    
    // Funciones públicas
    function editProducto(productoId) {
        showAddOrEditProductoView(productoId);
    }

    function deleteProducto(productoId) {
        const producto = _inventarioCache.find(p => p.id === productoId);
        _showModal('Confirmar Eliminación', `¿Seguro que quieres eliminar el producto "${producto.marca} ${producto.presentacion}"?`, async () => {
            try {
                await _deleteDoc(_doc(_db, `artifacts/${_appId}/users/${_userId}/inventario`, productoId));
                // No se necesita llamar a renderInventario() porque el onSnapshot lo hará automáticamente.
            } catch (error) {
                 _showModal('Error', `Ocurrió un error al eliminar el producto: ${error.message}`);
            }
        });
    }
    
    async function getSegmentoOrderMap() {
        if (_segmentoOrderCache) return _segmentoOrderCache;
        const map = {};
        const segmentosRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/segmentos`);
        try {
            const snapshot = await _getDocs(segmentosRef);
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                map[data.name] = (data.orden !== undefined) ? data.orden : 9999;
            });
            _segmentoOrderCache = map;
            return map;
        } catch (e) {
            return null;
        }
    }
    
    function invalidateSegmentOrderCache() {
        _segmentoOrderCache = null;
    }


    // Exponer funciones públicas al objeto window
    window.inventarioModule = {
        editProducto,
        deleteProducto,
        handleDeleteDataItem,
        getSegmentoOrderMap,
        invalidateSegmentOrderCache
    };

})();
