// --- Lógica del módulo de Inventario ---

(function() {
    // Variables locales del módulo
    let _db;
    let _userId;
    let _appId;
    let _mainContent;
    let _showMainMenu;
    let _floatingControls;
    let _inventario = []; // Caché local del inventario

    // Funciones de Firestore pasadas desde index.html
    let _collection, _onSnapshot, _doc, _addDoc, _setDoc, _deleteDoc, _writeBatch;
    
    // Funciones de utilidad pasadas desde index.html
    let _showModal, _populateDropdown;


    /**
     * Inicializa el módulo de inventario con las dependencias necesarias de Firebase y del DOM.
     */
    window.initInventario = function(dependencies) {
        _db = dependencies.db;
        _userId = dependencies.userId;
        _appId = dependencies.appId;
        _mainContent = dependencies.mainContent;
        _showMainMenu = dependencies.showMainMenu;
        _floatingControls = dependencies.floatingControls;
        _collection = dependencies.collection;
        _onSnapshot = dependencies.onSnapshot;
        _doc = dependencies.doc;
        _addDoc = dependencies.addDoc;
        _setDoc = dependencies.setDoc;
        _deleteDoc = dependencies.deleteDoc;
        _writeBatch = dependencies.writeBatch;
        _showModal = dependencies.showModal;
        _populateDropdown = dependencies.populateDropdown;
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
                            <button id="cambioMasivoBtn" class="w-full px-6 py-3 bg-orange-500 text-white font-semibold rounded-lg shadow-md hover:bg-orange-600 transition duration-300 transform hover:scale-105">
                                Cambio Masivo de Cantidades
                            </button>
                            <button id="modifyDeleteBtn" class="w-full px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg shadow-md hover:bg-blue-600 transition duration-300 transform hover:scale-105">
                                Modificar / Eliminar Producto
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
        document.getElementById('cambioMasivoBtn').addEventListener('click', showCambioMasivoView);
        document.getElementById('modifyDeleteBtn').addEventListener('click', showModifyDeleteView);
        document.getElementById('backToMenuBtn').addEventListener('click', _showMainMenu);
    }

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
                                    <select id="rubro" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required>
                                        <option value="">Seleccione un rubro</option>
                                    </select>
                                    <button type="button" id="addRubroBtn" class="px-4 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition duration-300">Agregar</button>
                                </div>
                            </div>
                            <div>
                                <label for="segmento" class="block text-gray-700 font-medium mb-2">Segmento:</label>
                                <div class="flex items-center space-x-2">
                                    <select id="segmento" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required>
                                        <option value="">Seleccione un segmento</option>
                                    </select>
                                    <button type="button" id="addSegmentoBtn" class="px-4 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition duration-300">Agregar</button>
                                </div>
                            </div>
                            <div>
                                <label for="marca" class="block text-gray-700 font-medium mb-2">Marca:</label>
                                <div class="flex items-center space-x-2">
                                    <select id="marca" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required>
                                        <option value="">Seleccione una marca</option>
                                    </select>
                                    <button type="button" id="addMarcaBtn" class="px-4 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition duration-300">Agregar</button>
                                </div>
                            </div>
                            <div>
                                <label for="presentacion" class="block text-gray-700 font-medium mb-2">Presentación:</label>
                                <input type="text" id="presentacion" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required>
                            </div>
                            <div>
                                <label for="precio" class="block text-gray-700 font-medium mb-2">Precio (USD):</label>
                                <input type="number" step="0.01" id="precio" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required>
                            </div>
                            <div>
                                <label for="cantidad" class="block text-gray-700 font-medium mb-2">Cantidad:</label>
                                <input type="number" id="cantidad" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required>
                            </div>
                            <div>
                                <label for="ivaTipo" class="block text-gray-700 font-medium mb-2">Tipo de IVA:</label>
                                <select id="ivaTipo" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required>
                                    <option value="16">IVA 16%</option>
                                    <option value="0">Excento</option>
                                </select>
                            </div>
                            <button type="submit" class="w-full px-6 py-3 bg-green-500 text-white font-semibold rounded-lg shadow-md hover:bg-green-600 transition duration-300">
                                Guardar Producto
                            </button>
                        </form>
                        <button id="backToInventarioBtn" class="mt-4 w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500 transition duration-300">
                            Volver
                        </button>
                    </div>
                </div>
            </div>
        `;
        _populateDropdown('rubros', 'rubro');
        _populateDropdown('segmentos', 'segmento');
        _populateDropdown('marcas', 'marca');
        
        document.getElementById('productoForm').addEventListener('submit', agregarProducto);
        document.getElementById('backToInventarioBtn').addEventListener('click', window.showInventarioSubMenu);
        document.getElementById('addRubroBtn').addEventListener('click', () => window.showAddItemModal('rubros', 'Rubro'));
        document.getElementById('addSegmentoBtn').addEventListener('click', () => window.showAddItemModal('segmentos', 'Segmento'));
        document.getElementById('addMarcaBtn').addEventListener('click', () => window.showAddItemModal('marcas', 'Marca'));
    }

    /**
     * Agrega un nuevo producto al inventario en Firestore.
     */
    async function agregarProducto(e) {
        e.preventDefault();
        const rubro = document.getElementById('rubro').value;
        const segmento = document.getElementById('segmento').value;
        const marca = document.getElementById('marca').value;
        const presentacion = document.getElementById('presentacion').value;
        const precio = parseFloat(document.getElementById('precio').value);
        const cantidad = parseInt(document.getElementById('cantidad').value, 10);
        const iva = parseInt(document.getElementById('ivaTipo').value, 10);

        try {
            const inventarioRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`);
            await _addDoc(inventarioRef, {
                rubro,
                segmento,
                marca,
                presentacion,
                precio,
                cantidad,
                iva
            });
            _showModal('Éxito', 'Producto agregado correctamente.');
            document.getElementById('productoForm').reset();
        } catch (e) {
            console.error("Error al agregar el producto: ", e);
            _showModal('Error', 'Hubo un error al guardar el producto.');
        }
    }

    function showVerInventarioView() {
         _floatingControls.classList.add('hidden');
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl">
                        <h2 class="text-2xl font-bold text-gray-800 mb-6 text-center">Ver Inventario</h2>
                        <div class="mb-4">
                           <label for="verInventarioRubroFilter" class="block text-gray-700 font-medium mb-2">Filtrar por Rubro:</label>
                           <select id="verInventarioRubroFilter" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                               <option value="">Todos los Rubros</option>
                           </select>
                        </div>
                        <div id="productosListContainer" class="overflow-x-auto">
                            <p class="text-gray-500 text-center">Cargando productos...</p>
                        </div>
                        <button id="backToInventarioBtn" class="mt-6 w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500 transition duration-300">
                            Volver
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('backToInventarioBtn').addEventListener('click', window.showInventarioSubMenu);
        
        const rubroFilter = document.getElementById('verInventarioRubroFilter');
        _populateDropdown('rubros', 'verInventarioRubroFilter', 'Rubro');

        rubroFilter.addEventListener('change', () => {
             renderProductosList('productosListContainer', true, rubroFilter.value);
        });

        renderProductosList('productosListContainer', true, rubroFilter.value); // Renderiza en vista de solo lectura
    }

    function showModifyDeleteView() {
         _floatingControls.classList.add('hidden');
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl">
                        <h2 class="text-2xl font-bold text-gray-800 mb-6 text-center">Modificar / Eliminar Producto</h2>
                        <p class="text-gray-600 mb-4 text-center">Selecciona un producto de la lista para modificarlo o eliminarlo.</p>
                        <div id="productosListContainer" class="overflow-x-auto">
                            <p class="text-gray-500 text-center">Cargando productos...</p>
                        </div>
                        <button id="backToInventarioBtn" class="mt-6 w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500 transition duration-300">
                            Volver
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('backToInventarioBtn').addEventListener('click', window.showInventarioSubMenu);
        renderProductosList('productosListContainer');
    }

    /**
     * Muestra la vista para el cambio masivo de cantidades.
     */
    function showCambioMasivoView() {
        _floatingControls.classList.add('hidden');
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl">
                        <h2 class="text-2xl font-bold text-gray-800 mb-6 text-center">Cambio Masivo de Cantidades</h2>
                        <div class="mb-4">
                           <label for="cambioMasivoRubroFilter" class="block text-gray-700 font-medium mb-2">Filtrar por Rubro:</label>
                           <select id="cambioMasivoRubroFilter" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                               <option value="">Seleccione un Rubro</option>
                           </select>
                        </div>
                        <div id="cambioMasivoContainer" class="overflow-auto" style="max-height: 50vh;">
                            <p class="text-center text-gray-500">Seleccione un rubro para ver los productos.</p>
                        </div>
                        <div class="mt-6 space-y-2">
                           <button id="guardarCambiosMasivosBtn" class="w-full px-6 py-3 bg-green-500 text-white font-semibold rounded-lg shadow-md hover:bg-green-600 transition hidden">Guardar Cambios</button>
                           <button id="backToInventarioBtn" class="w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500 transition">Volver</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        const rubroFilter = document.getElementById('cambioMasivoRubroFilter');
        _populateDropdown('rubros', 'cambioMasivoRubroFilter', 'Rubro');

        rubroFilter.addEventListener('change', () => {
            renderCambioMasivoList(rubroFilter.value);
        });

        document.getElementById('backToInventarioBtn').addEventListener('click', window.showInventarioSubMenu);
    }

    /**
     * Renderiza la lista de productos para el cambio masivo.
     * @param {string} rubro El rubro seleccionado para filtrar.
     */
    function renderCambioMasivoList(rubro) {
        const container = document.getElementById('cambioMasivoContainer');
        const saveButton = document.getElementById('guardarCambiosMasivosBtn');
        if (!container || !saveButton) return;

        if (!rubro) {
            container.innerHTML = `<p class="text-center text-gray-500">Seleccione un rubro para ver los productos.</p>`;
            saveButton.classList.add('hidden');
            return;
        }

        const filteredInventario = _inventario.filter(p => p.rubro === rubro);
        
        if (filteredInventario.length === 0) {
            container.innerHTML = `<p class="text-center text-gray-600">No hay productos en este rubro.</p>`;
            saveButton.classList.add('hidden');
            return;
        }

        container.innerHTML = `
            <form id="cambioMasivoForm">
                ${filteredInventario.map(p => `
                    <div class="flex items-center justify-between p-2 border-b">
                        <label for="prod-${p.id}" class="text-sm text-gray-700">${p.presentacion} (${p.marca})</label>
                        <input type="number" id="prod-${p.id}" data-id="${p.id}" class="w-24 px-2 py-1 border rounded-lg text-center" value="${p.cantidad}">
                    </div>
                `).join('')}
            </form>
        `;
        
        saveButton.classList.remove('hidden');
        saveButton.onclick = handleGuardarCambiosMasivos;
    }

    /**
     * Guarda las cantidades actualizadas masivamente.
     */
    async function handleGuardarCambiosMasivos() {
        const form = document.getElementById('cambioMasivoForm');
        const inputs = form.querySelectorAll('input[type="number"]');
        const updates = [];

        inputs.forEach(input => {
            const id = input.dataset.id;
            const newQuantity = parseInt(input.value, 10);
            const originalProduct = _inventario.find(p => p.id === id);

            if (originalProduct && originalProduct.cantidad !== newQuantity && newQuantity >= 0) {
                updates.push({ id, newQuantity });
            }
        });

        if (updates.length === 0) {
            _showModal('Aviso', 'No se realizaron cambios en las cantidades.');
            return;
        }

        _showModal('Confirmar Cambios', `¿Estás seguro de que deseas actualizar las cantidades de ${updates.length} productos?`, async () => {
            const batch = _writeBatch(_db);
            updates.forEach(update => {
                const productRef = _doc(_db, `artifacts/${_appId}/users/${_userId}/inventario`, update.id);
                batch.update(productRef, { cantidad: update.newQuantity });
            });

            try {
                await batch.commit();
                _showModal('Éxito', 'Las cantidades se han actualizado correctamente.');
                showCambioMasivoView(); // Recargar la vista
            } catch (error) {
                console.error("Error al actualizar masivamente:", error);
                _showModal('Error', 'Hubo un problema al guardar los cambios.');
            }
        });
    }


    /**
     * Renderiza la lista de productos en el DOM.
     * @param {string} elementId ID del elemento donde se renderizará la lista.
     * @param {boolean} readOnly Indica si la lista es de solo lectura.
     * @param {string} rubroFilter Rubro para filtrar la lista.
     */
    function renderProductosList(elementId = 'productosListContainer', readOnly = false, rubroFilter = '') {
        const container = document.getElementById(elementId);
        if (!container) return;

        const inventarioRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`);
        const unsubscribe = _onSnapshot(inventarioRef, (snapshot) => {
            let productos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            _inventario = productos; // Actualiza el caché local
            
            if (rubroFilter) {
                productos = productos.filter(p => p.rubro === rubroFilter);
            }

            if (productos.length === 0) {
                container.innerHTML = `<p class="text-gray-500 text-center">No hay productos que coincidan.</p>`;
                return;
            }

            let tableHTML = `
                <table class="min-w-full bg-white border border-gray-200">
                    <thead class="bg-gray-200">
                        <tr>
                            <th class="py-2 px-4 border-b text-left text-sm">Presentación</th>
                            <th class="py-2 px-4 border-b text-left text-sm">Rubro</th>
                            <th class="py-2 px-4 border-b text-left text-sm">Marca</th>
                            <th class="py-2 px-4 border-b text-right text-sm">Precio (USD)</th>
                            <th class="py-2 px-4 border-b text-center text-sm">IVA</th>
                            <th class="py-2 px-4 border-b text-center text-sm">Cantidad</th>
                            ${!readOnly ? `<th class="py-2 px-4 border-b text-center text-sm">Acciones</th>` : ''}
                        </tr>
                    </thead>
                    <tbody>
            `;

            productos.forEach(producto => {
                tableHTML += `
                    <tr class="hover:bg-gray-50">
                        <td class="py-2 px-4 border-b text-sm">${producto.presentacion} (${producto.segmento})</td>
                        <td class="py-2 px-4 border-b text-sm">${producto.rubro}</td>
                        <td class="py-2 px-4 border-b text-sm">${producto.marca}</td>
                        <td class="py-2 px-4 border-b text-right text-sm">$${producto.precio.toFixed(2)}</td>
                        <td class="py-2 px-4 border-b text-center text-sm">${producto.iva === 0 ? 'Excento' : producto.iva + '%'}</td>
                        <td class="py-2 px-4 border-b text-center text-sm">${producto.cantidad}</td>
                        ${!readOnly ? `
                        <td class="py-2 px-4 border-b text-center space-x-2">
                            <button onclick="window.editProducto('${producto.id}')" class="px-3 py-1 bg-yellow-500 text-white text-xs rounded-lg hover:bg-yellow-600">Editar</button>
                            <button onclick="window.deleteProducto('${producto.id}')" class="px-3 py-1 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600">Eliminar</button>
                        </td>` : ''}
                    </tr>
                `;
            });

            tableHTML += `</tbody></table>`;
            container.innerHTML = tableHTML;
        });
         window.activeListeners.push(unsubscribe);
    }
    
    /**
     * Elimina un producto del inventario.
     * @param {string} productId ID del producto a eliminar.
     */
    window.deleteProducto = function(productId) {
        _showModal('Confirmar Eliminación', '¿Estás seguro de que deseas eliminar este producto?', async () => {
            try {
                await _deleteDoc(_doc(_db, `artifacts/${_appId}/users/${_userId}/inventario`, productId));
                _showModal('Éxito', 'Producto eliminado correctamente.');
            } catch (e) {
                console.error("Error al eliminar el producto: ", e);
                _showModal('Error', 'Hubo un error al eliminar el producto.');
            }
        });
    };

    /**
     * Edita un producto en el inventario.
     */
    window.editProducto = function(productId) {
         _floatingControls.classList.add('hidden');
        const producto = _inventario.find(p => p.id === productId);
        if (!producto) return;

        _mainContent.innerHTML = `
            <div class="p-4">
                <div class="container mx-auto">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl text-center">
                        <h2 class="text-2xl font-bold text-gray-800 mb-6">Editar Producto</h2>
                        <form id="editProductoForm" class="space-y-4 text-left">
                            <div>
                                <label class="block text-gray-700 font-medium mb-2">Rubro:</label>
                                <p class="w-full px-4 py-2 border rounded-lg bg-gray-100">${producto.rubro}</p>
                            </div>
                            <div>
                                <label class="block text-gray-700 font-medium mb-2">Segmento:</label>
                                <p class="w-full px-4 py-2 border rounded-lg bg-gray-100">${producto.segmento}</p>
                            </div>
                            <div>
                                <label class="block text-gray-700 font-medium mb-2">Marca:</label>
                                <p class="w-full px-4 py-2 border rounded-lg bg-gray-100">${producto.marca}</p>
                            </div>
                            <div>
                                <label class="block text-gray-700 font-medium mb-2">Presentación:</label>
                                <p class="w-full px-4 py-2 border rounded-lg bg-gray-100">${producto.presentacion}</p>
                            </div>
                            <div>
                                <label for="editPrecio" class="block text-gray-700 font-medium mb-2">Precio (USD):</label>
                                <input type="number" step="0.01" id="editPrecio" value="${producto.precio}" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required>
                            </div>
                            <div>
                                <label for="editCantidad" class="block text-gray-700 font-medium mb-2">Cantidad:</label>
                                <input type="number" id="editCantidad" value="${producto.cantidad}" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required>
                            </div>
                             <div>
                                <label for="editIvaTipo" class="block text-gray-700 font-medium mb-2">Tipo de IVA:</label>
                                <select id="editIvaTipo" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required>
                                    <option value="16" ${producto.iva === 16 ? 'selected' : ''}>IVA 16%</option>
                                    <option value="0" ${producto.iva === 0 ? 'selected' : ''}>Excento</option>
                                </select>
                            </div>
                            <button type="submit" class="w-full px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg shadow-md hover:bg-blue-600 transition duration-300">
                                Guardar Cambios
                            </button>
                        </form>
                        <button id="backToModifyDeleteBtn" class="mt-4 w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500 transition duration-300">
                            Volver
                        </button>
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
            } catch (e) {
                console.error("Error al modificar el producto: ", e);
                _showModal('Error', 'Hubo un error al modificar el producto.');
            }
        });
        document.getElementById('backToModifyDeleteBtn').addEventListener('click', showModifyDeleteView);
    };

})();
