// --- Lógica del módulo de Ventas (Corregido y Funcional) ---

(function() {
    // Variables locales del módulo
    let _db, _userId, _appId, _mainContent, _floatingControls, _activeListeners;
    let _showMainMenu, _showModal;
    let _collection, _onSnapshot, _doc, _addDoc, _getDocs, _query, _where;

    // Cachés de datos para búsquedas rápidas
    let _clientesCache =;
    let _inventarioCache =;
    
    // Estado de la venta actual
    let _ventaActual = {
        cliente: null,
        items:,
        total: 0
    };

    /**
     * Inicializa el módulo con las dependencias de la app principal.
     */
    window.initVentas = function(dependencies) {
        _db = dependencies.db;
        _userId = dependencies.userId;
        _appId = dependencies.appId;
        _mainContent = dependencies.mainContent;
        _floatingControls = dependencies.floatingControls;
        _activeListeners = dependencies.activeListeners;
        _showMainMenu = dependencies.showMainMenu;
        _showModal = dependencies.showModal;
        _collection = dependencies.collection;
        _onSnapshot = dependencies.onSnapshot;
        _doc = dependencies.doc;
        _addDoc = dependencies.addDoc;
        _getDocs = dependencies.getDocs;
        _query = dependencies.query;
        _where = dependencies.where;
    };

    /**
     * Muestra la vista principal del módulo de ventas.
     */
    window.showVentasView = function() {
        _floatingControls.classList.add('hidden');
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl text-center">
                        <h1 class="text-3xl font-bold text-gray-800 mb-6">Gestión de Ventas</h1>
                        <div class="space-y-4">
                            <button id="nuevaVentaBtn" class="w-full px-6 py-3 bg-green-500 text-white font-semibold rounded-lg shadow-md hover:bg-green-600">Nueva Venta</button>
                            <button id="historialVentasBtn" class="w-full px-6 py-3 bg-green-500 text-white font-semibold rounded-lg shadow-md hover:bg-green-600">Historial de Ventas</button>
                            <button id="backToMenuBtn" class="w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver al Menú Principal</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('nuevaVentaBtn').addEventListener('click', showNuevaVentaView);
        document.getElementById('historialVentasBtn').addEventListener('click', showHistorialVentasView);
        document.getElementById('backToMenuBtn').addEventListener('click', _showMainMenu);
    };

    /**
     * Carga los datos de clientes e inventario en caché.
     */
    async function loadDataCaches() {
        const clientesRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/clientes`);
        const inventarioRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`);
        
        const = await Promise.all();

        _clientesCache = clientesSnapshot.docs.map(doc => ({ id: doc.id,...doc.data() }));
        _inventarioCache = inventarioSnapshot.docs.map(doc => ({ id: doc.id,...doc.data() }));
    }

    /**
     * Muestra la interfaz para crear una nueva venta.
     */
    async function showNuevaVentaView() {
        _ventaActual = { cliente: null, items:, total: 0 }; // Reiniciar venta
        _floatingControls.classList.add('hidden');
        _mainContent.innerHTML = `<div class="p-4 text-center">Cargando...</div>`;

        await loadDataCaches();

        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl">
                        <h2 class="text-2xl font-bold text-gray-800 mb-6 text-center">Nueva Venta</h2>
                        
                        <div class="mb-6">
                            <label for="cliente-search" class="block text-gray-700 font-medium mb-2">Buscar Cliente:</label>
                            <div class="relative">
                                <input type="text" id="cliente-search" placeholder="Escriba para buscar..." class="w-full px-4 py-2 border rounded-lg">
                                <div id="cliente-autocomplete-list" class="autocomplete-list hidden"></div>
                            </div>
                            <div id="cliente-seleccionado" class="mt-2 p-3 bg-blue-100 border border-blue-300 rounded-lg hidden"></div>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div>
                                <h3 class="text-xl font-bold text-gray-700 mb-4">Inventario</h3>
                                <input type="text" id="inventario-search" placeholder="Buscar producto..." class="w-full px-4 py-2 border rounded-lg mb-4">
                                <div id="inventario-list" class="overflow-y-auto max-h-80 border rounded-lg p-2 bg-gray-50">
                                    </div>
                            </div>
                            <div>
                                <h3 class="text-xl font-bold text-gray-700 mb-4">Carrito de Compra</h3>
                                <div id="carrito-items" class="overflow-y-auto max-h-80 border rounded-lg p-2 bg-gray-50 min-h-[10rem]">
                                    <p class="text-gray-500 text-center p-4">Agregue productos desde el inventario.</p>
                                </div>
                                <div id="carrito-total" class="mt-4 text-right text-2xl font-bold text-gray-800">
                                    Total: $0.00
                                </div>
                            </div>
                        </div>

                        <div class="mt-8 flex flex-col md:flex-row gap-4">
                            <button id="finalizarVentaBtn" class="w-full px-6 py-3 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 disabled:bg-gray-400" disabled>Finalizar Venta</button>
                            <button id="backToVentasBtn" class="w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Cancelar</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        setupAutocomplete('cliente-search', _clientesCache, 'nombreComercial', seleccionarCliente);
        setupAutocomplete('inventario-search', _inventarioCache, 'nombre', filterInventario);
        
        renderInventarioList(_inventarioCache);

        document.getElementById('backToVentasBtn').addEventListener('click', showVentasView);
        document.getElementById('finalizarVentaBtn').addEventListener('click', handleFinalizarVenta);
    }

    /**
     * Configura la lógica de autocompletado para un campo de búsqueda.
     */
    function setupAutocomplete(inputId, data, property, onSelect) {
        const searchInput = document.getElementById(inputId);
        const listId = inputId.replace('-search', '-autocomplete-list');
        const listContainer = document.getElementById(listId);

        if (searchInput) {
            searchInput.addEventListener('input', () => {
                const searchTerm = searchInput.value.toLowerCase();
                if (!searchTerm) {
                    listContainer?.classList.add('hidden');
                    if (onSelect === filterInventario) renderInventarioList(data); // Reset inventory list
                    return;
                }
                const filteredData = data.filter(item => item[property].toLowerCase().includes(searchTerm));
                
                if (onSelect === filterInventario) {
                     renderInventarioList(filteredData);
                } else if (listContainer) {
                    listContainer.innerHTML = '';
                    if (filteredData.length > 0) {
                        listContainer.classList.remove('hidden');
                        filteredData.forEach(item => {
                            const itemEl = document.createElement('div');
                            itemEl.className = 'autocomplete-item';
                            itemEl.textContent = item[property];
                            itemEl.addEventListener('click', () => {
                                onSelect(item);
                                searchInput.value = '';
                                listContainer.classList.add('hidden');
                            });
                            listContainer.appendChild(itemEl);
                        });
                    } else {
                        listContainer.classList.add('hidden');
                    }
                }
            });
        }
    }
    
    function filterInventario() {
        const searchTerm = document.getElementById('inventario-search').value.toLowerCase();
        const filtered = _inventarioCache.filter(item => item.nombre.toLowerCase().includes(searchTerm));
        renderInventarioList(filtered);
    }

    /**
     * Renderiza la lista de productos del inventario.
     */
    function renderInventarioList(inventario) {
        const container = document.getElementById('inventario-list');
        container.innerHTML = '';
        if (inventario.length === 0) {
            container.innerHTML = `<p class="text-gray-500 text-center p-4">No se encontraron productos.</p>`;
            return;
        }
        inventario.forEach(item => {
            const itemEl = document.createElement('div');
            itemEl.className = 'flex justify-between items-center p-2 border-b hover:bg-gray-100';
            itemEl.innerHTML = `
                <div>
                    <p class="font-semibold">${item.nombre}</p>
                    <p class="text-sm text-gray-600">$${parseFloat(item.precio).toFixed(2)}</p>
                </div>
                <button data-id="${item.id}" class="add-to-cart-btn px-3 py-1 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600">+</button>
            `;
            container.appendChild(itemEl);
        });

        document.querySelectorAll('.add-to-cart-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const itemId = e.target.getAttribute('data-id');
                agregarAlCarrito(itemId);
            });
        });
    }

    /**
     * Maneja la selección de un cliente.
     */
    function seleccionarCliente(cliente) {
        _ventaActual.cliente = { id: cliente.id, nombre: cliente.nombreComercial };
        const container = document.getElementById('cliente-seleccionado');
        container.innerHTML = `<strong>Cliente:</strong> ${cliente.nombreComercial} (${cliente.nombrePersonal})`;
        container.classList.remove('hidden');
        validarVenta();
    }

    /**
     * Agrega un producto al carrito o incrementa su cantidad.
     */
    function agregarAlCarrito(itemId) {
        const itemEnCarrito = _ventaActual.items.find(item => item.id === itemId);
        if (itemEnCarrito) {
            itemEnCarrito.cantidad++;
        } else {
            const itemInventario = _inventarioCache.find(item => item.id === itemId);
            _ventaActual.items.push({
                id: itemInventario.id,
                nombre: itemInventario.nombre,
                precio: parseFloat(itemInventario.precio),
                cantidad: 1
            });
        }
        renderCarrito();
        validarVenta();
    }

    /**
     * Renderiza los items en el carrito de compra.
     */
    function renderCarrito() {
        const container = document.getElementById('carrito-items');
        container.innerHTML = '';

        if (_ventaActual.items.length === 0) {
            container.innerHTML = `<p class="text-gray-500 text-center p-4">Agregue productos desde el inventario.</p>`;
            actualizarTotal();
            return;
        }

        _ventaActual.items.forEach(item => {
            const itemEl = document.createElement('div');
            itemEl.className = 'flex justify-between items-center p-2 border-b';
            itemEl.innerHTML = `
                <div>
                    <p class="font-semibold">${item.nombre}</p>
                    <p class="text-sm text-gray-600">$${item.precio.toFixed(2)} x ${item.cantidad}</p>
                </div>
                <div class="flex items-center gap-2">
                    <button data-id="${item.id}" class="decrease-qty-btn px-2 py-0.5 bg-gray-300 rounded">-</button>
                    <button data-id="${item.id}" class="increase-qty-btn px-2 py-0.5 bg-gray-300 rounded">+</button>
                    <button data-id="${item.id}" class="remove-item-btn px-2 py-0.5 bg-red-500 text-white rounded">x</button>
                </div>
            `;
            container.appendChild(itemEl);
        });

        document.querySelectorAll('.increase-qty-btn').forEach(btn => btn.addEventListener('click', e => cambiarCantidad(e.target.dataset.id, 1)));
        document.querySelectorAll('.decrease-qty-btn').forEach(btn => btn.addEventListener('click', e => cambiarCantidad(e.target.dataset.id, -1)));
        document.querySelectorAll('.remove-item-btn').forEach(btn => btn.addEventListener('click', e => eliminarDelCarrito(e.target.dataset.id)));
        
        actualizarTotal();
    }

    function cambiarCantidad(itemId, cambio) {
        const item = _ventaActual.items.find(i => i.id === itemId);
        if (item) {
            item.cantidad += cambio;
            if (item.cantidad <= 0) {
                eliminarDelCarrito(itemId);
            } else {
                renderCarrito();
            }
        }
    }

    function eliminarDelCarrito(itemId) {
        _ventaActual.items = _ventaActual.items.filter(i => i.id!== itemId);
        renderCarrito();
        validarVenta();
    }

    function actualizarTotal() {
        _ventaActual.total = _ventaActual.items.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
        document.getElementById('carrito-total').textContent = `Total: $${_ventaActual.total.toFixed(2)}`;
    }

    function validarVenta() {
        const btn = document.getElementById('finalizarVentaBtn');
        const esValida = _ventaActual.cliente && _ventaActual.items.length > 0;
        btn.disabled =!esValida;
    }

    /**
     * Guarda la venta en Firestore.
     */
    async function handleFinalizarVenta() {
        const ventaData = {
            clienteId: _ventaActual.cliente.id,
            clienteNombre: _ventaActual.cliente.nombre,
            items: _ventaActual.items,
            total: _ventaActual.total,
            fecha: new Date().toISOString()
        };

        try {
            await _addDoc(_collection(_db, `artifacts/${_appId}/users/${_userId}/ventas`), ventaData);
            _showModal('Éxito', 'La venta se ha guardado correctamente.', () => {
                showVentasView();
            }, 'Aceptar');
        } catch (error) {
            console.error("Error al guardar la venta:", error);
            _showModal('Error', 'Hubo un problema al guardar la venta.');
        }
    }

    /**
     * Muestra el historial de ventas.
     */
    async function showHistorialVentasView() {
        _floatingControls.classList.add('hidden');
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl">
                        <h2 class="text-2xl font-bold text-gray-800 mb-6 text-center">Historial de Ventas</h2>
                        <div id="historial-list" class="overflow-y-auto max-h-96">
                            <p class="text-center">Cargando historial...</p>
                        </div>
                        <button id="backToVentasBtn" class="mt-6 w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver</button>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('backToVentasBtn').addEventListener('click', showVentasView);
        
        const ventasRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/ventas`);
        const unsubscribe = _onSnapshot(ventasRef, (snapshot) => {
            const ventas = snapshot.docs.map(doc => ({ id: doc.id,...doc.data() })).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
            renderHistorialList(ventas);
        });
        _activeListeners.push(unsubscribe);
    }

    function renderHistorialList(ventas) {
        const container = document.getElementById('historial-list');
        if (!container) return;
        container.innerHTML = '';

        if (ventas.length === 0) {
            container.innerHTML = `<p class="text-center text-gray-500">No hay ventas registradas.</p>`;
            return;
        }

        const table = document.createElement('table');
        table.className = 'min-w-full bg-white border';
        table.innerHTML = `
            <thead class="bg-gray-200">
                <tr>
                    <th class="py-2 px-4 border-b text-left text-sm">Fecha</th>
                    <th class="py-2 px-4 border-b text-left text-sm">Cliente</th>
                    <th class="py-2 px-4 border-b text-right text-sm">Total</th>
                    <th class="py-2 px-4 border-b text-center text-sm">Acciones</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;
        const tbody = table.querySelector('tbody');
        ventas.forEach(venta => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-50';
            tr.innerHTML = `
                <td class="py-2 px-4 border-b text-sm">${new Date(venta.fecha).toLocaleDateString()}</td>
                <td class="py-2 px-4 border-b text-sm">${venta.clienteNombre}</td>
                <td class="py-2 px-4 border-b text-sm text-right font-semibold">$${venta.total.toFixed(2)}</td>
                <td class="py-2 px-4 border-b text-sm text-center">
                    <button data-id="${venta.id}" class="view-ticket-btn px-3 py-1 bg-blue-500 text-white text-xs rounded-lg hover:bg-blue-600">Ver Ticket</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
        container.appendChild(table);

        document.querySelectorAll('.view-ticket-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const venta = ventas.find(v => v.id === btn.dataset.id);
                showTicketModal(venta);
            });
        });
    }

    /**
     * Muestra un modal con el ticket de venta y opción para descargar.
     */
    function showTicketModal(venta) {
        const itemsHtml = venta.items.map(item => `
            <tr class="border-t">
                <td class="py-1 pr-2">${item.nombre}</td>
                <td class="py-1 px-2 text-center">${item.cantidad}</td>
                <td class="py-1 px-2 text-right">$${item.precio.toFixed(2)}</td>
                <td class="py-1 pl-2 text-right">$${(item.cantidad * item.precio).toFixed(2)}</td>
            </tr>
        `).join('');

        const modalContentHTML = `
            <div id="ticket-content" class="bg-white p-6 text-gray-800">
                <div class="text-center mb-4">
                    <h3 class="text-xl font-bold uppercase-ticket">Recibo de Venta</h3>
                    <p class="text-sm">Fecha: ${new Date(venta.fecha).toLocaleString()}</p>
                </div>
                <div class="mb-4">
                    <p><strong class="uppercase-ticket">Cliente:</strong> ${venta.clienteNombre}</p>
                </div>
                <table class="w-full text-sm mb-4">
                    <thead>
                        <tr class="border-b-2 border-gray-800">
                            <th class="py-1 pr-2 text-left uppercase-ticket">Producto</th>
                            <th class="py-1 px-2 text-center uppercase-ticket">Cant.</th>
                            <th class="py-1 px-2 text-right uppercase-ticket">Precio</th>
                            <th class="py-1 pl-2 text-right uppercase-ticket">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                </table>
                <div class="text-right font-bold text-lg border-t-2 border-gray-800 pt-2">
                    <p class="uppercase-ticket">Total: $${venta.total.toFixed(2)}</p>
                </div>
            </div>
            <div class="mt-6 text-center">
                <button id="downloadTicketBtn" class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">Descargar Ticket</button>
            </div>
        `;

        _showModal('Detalle de Venta', modalContentHTML, null, '');
        
        document.getElementById('downloadTicketBtn').addEventListener('click', () => {
            const ticketElement = document.getElementById('ticket-content');
            html2canvas(ticketElement).then(canvas => {
                const link = document.createElement('a');
                link.download = `ticket-venta-${venta.id}.png`;
                link.href = canvas.toDataURL();
                link.click();
            });
        });
    }

})();
