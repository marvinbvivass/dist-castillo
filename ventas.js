// --- Lógica del módulo de Ventas ---

(function() {
    // Variables locales del módulo
    let _db, _userId, _appId, _mainContent, _floatingControls, _activeListeners;
    let _showMainMenu, _showModal, _populateDropdown;
    let _collection, _onSnapshot, _doc, _getDoc, _addDoc, _setDoc, _deleteDoc, _getDocs, _writeBatch, _runTransaction, _query, _where;
    
    // Cachés de datos locales para este módulo
    let _clientesCache = [];
    let _inventarioCache = [];
    let _ventasGlobal = [];
    
    // Estado local de una venta en progreso
    let _ventaActual = { cliente: null, productos: {} };
    let _tasaCOP = 0;
    let _monedaActual = 'USD';

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
        _populateDropdown = dependencies.populateDropdown;
        _collection = dependencies.collection;
        _onSnapshot = dependencies.onSnapshot;
        _doc = dependencies.doc;
        _getDoc = dependencies.getDoc;
        _addDoc = dependencies.addDoc;
        _setDoc = dependencies.setDoc;
        _deleteDoc = dependencies.deleteDoc;
        _getDocs = dependencies.getDocs;
        _writeBatch = dependencies.writeBatch;
        _runTransaction = dependencies.runTransaction;
        _query = dependencies.query;
        _where = dependencies.where;
    };

    /**
     * Renderiza la vista principal de ventas.
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
                            <button id="ventasTotalesBtn" class="w-full px-6 py-3 bg-green-500 text-white font-semibold rounded-lg shadow-md hover:bg-green-600">Ventas Totales</button>
                            <button id="backToMenuBtn" class="w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('nuevaVentaBtn').addEventListener('click', showNuevaVentaView);
        document.getElementById('ventasTotalesBtn').addEventListener('click', showVentasTotalesView);
        document.getElementById('backToMenuBtn').addEventListener('click', _showMainMenu);
    }
    
    /**
     * Renderiza la vista para iniciar una nueva venta.
     */
    function showNuevaVentaView() {
         _floatingControls.classList.add('hidden');
         _monedaActual = 'USD';
         _ventaActual = { cliente: null, productos: {} };
        _mainContent.innerHTML = `
            <div class="p-2 sm:p-4 w-full">
                <div class="bg-white/90 backdrop-blur-sm p-4 sm:p-6 rounded-lg shadow-xl flex flex-col h-full" style="min-height: calc(100vh - 2rem);">
                    <div id="venta-header-section" class="mb-4">
                        <div class="flex justify-between items-center mb-4">
                            <h2 class="text-xl font-bold text-gray-800">Nueva Venta</h2>
                            <button id="backToVentasBtn" class="px-4 py-2 bg-gray-400 text-white text-sm font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver</button>
                        </div>
                        <div id="client-search-container">
                            <label for="clienteSearch" class="block text-gray-700 font-medium mb-2">Seleccionar Cliente:</label>
                            <div class="relative"><input type="text" id="clienteSearch" placeholder="Buscar cliente..." class="w-full px-4 py-2 border rounded-lg"><div id="clienteDropdown" class="autocomplete-list hidden"></div></div>
                        </div>
                        <div id="client-display-container" class="hidden flex-wrap items-center justify-between gap-4">
                            <p class="text-gray-700 flex-grow"><span class="font-medium">Cliente:</span> <span id="selected-client-name" class="font-bold"></span></p>
                            <div id="tasaCopContainer" class="flex items-center space-x-2">
                                 <label for="tasaCopInput" class="block text-gray-700 text-sm font-medium">Tasa (USD/COP):</label>
                                <input type="number" id="tasaCopInput" placeholder="Ej: 4000" class="w-28 px-2 py-1 border rounded-lg">
                            </div>
                        </div>
                    </div>
                    <div id="inventarioTableContainer" class="hidden animate-fade-in flex-grow flex flex-col overflow-hidden">
                         <div class="flex justify-between items-center mb-2">
                            <h3 class="text-lg font-semibold text-gray-800">Inventario <span id="monedaIndicator" class="text-sm font-normal text-gray-500">(USD/COP)</span></h3>
                             <div id="rubro-filter-container" class="w-1/2">
                                <select id="rubroFilter" class="w-full px-2 py-1 border rounded-lg text-sm"><option value="">Todos los Rubros</option></select>
                            </div>
                        </div>
                        <div class="overflow-auto flex-grow rounded-lg shadow">
                            <table class="min-w-full bg-white text-xs"><thead class="bg-gray-200 sticky top-0"><tr class="text-gray-700 uppercase leading-normal"><th class="py-2 px-1 text-center">Cant.</th><th class="py-2 px-2 text-left">Producto</th><th class="py-2 px-2 text-left price-toggle" onclick="window.ventasModule.toggleMoneda()">Precio</th><th class="py-2 px-1 text-center">Stock</th></tr></thead><tbody id="inventarioTableBody" class="text-gray-600 font-light"></tbody></table>
                        </div>
                    </div>
                    <div id="venta-footer-section" class="mt-4 flex items-center justify-between hidden">
                        <span id="ventaTotal" class="text-lg font-bold text-gray-800">Total: $0.00</span>
                         <button id="generarTicketBtn" class="px-6 py-3 bg-green-500 text-white font-semibold rounded-lg shadow-md hover:bg-green-600">Generar Ticket</button>
                    </div>
                </div>
            </div>
        `;
        
        const clienteSearchInput = document.getElementById('clienteSearch');
        clienteSearchInput.addEventListener('input', () => {
            const searchTerm = clienteSearchInput.value.toLowerCase();
            const filteredClients = _clientesCache.filter(c => c.nombreComercial.toLowerCase().includes(searchTerm) || c.nombrePersonal.toLowerCase().includes(searchTerm));
            renderClienteDropdown(filteredClients);
            document.getElementById('clienteDropdown').classList.remove('hidden');
        });
        
        const savedTasa = localStorage.getItem('tasaCOP');
        if (savedTasa) {
            _tasaCOP = parseFloat(savedTasa);
            document.getElementById('tasaCopInput').value = _tasaCOP;
        }

        document.getElementById('tasaCopInput').addEventListener('input', (e) => {
            _tasaCOP = parseFloat(e.target.value) || 0;
            localStorage.setItem('tasaCOP', _tasaCOP);
            renderVentasInventario();
        });
        
        document.getElementById('rubroFilter').addEventListener('change', renderVentasInventario);
        document.getElementById('generarTicketBtn').addEventListener('click', generarTicket);
        document.getElementById('backToVentasBtn').addEventListener('click', showVentasView);
        
        loadDataForNewSale();
    }
    
    /**
     * Carga los datos de clientes e inventario y popula el filtro de rubros.
     */
    function loadDataForNewSale() {
        const clientesRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/clientes`);
        const unsubClientes = _onSnapshot(clientesRef, (snapshot) => {
            _clientesCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        });

        const inventarioRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`);
        const unsubInventario = _onSnapshot(inventarioRef, (snapshot) => {
            _inventarioCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            populateRubroFilter();
            if (_ventaActual.cliente) { // Si ya hay un cliente seleccionado, re-renderizar
                renderVentasInventario();
            }
        });

        _activeListeners.push(unsubClientes, unsubInventario);
    }
    
    /**
     * Popula el filtro de rubros.
     */
    function populateRubroFilter() {
        const rubroFilter = document.getElementById('rubroFilter');
        if(!rubroFilter) return;
        const rubros = [...new Set(_inventarioCache.map(p => p.rubro))].sort();
        rubroFilter.innerHTML = '<option value="">Todos los Rubros</option>';
        rubros.forEach(rubro => {
             rubroFilter.innerHTML += `<option value="${rubro}">${rubro}</option>`;
        });
    }

    /**
     * Renderiza el dropdown de clientes.
     */
    function renderClienteDropdown(filteredClients) {
        const clienteDropdown = document.getElementById('clienteDropdown');
        clienteDropdown.innerHTML = '';
        filteredClients.forEach(cliente => {
            const item = document.createElement('div');
            item.className = 'autocomplete-item';
            item.textContent = `${cliente.nombreComercial} (${cliente.nombrePersonal})`;
            item.addEventListener('click', () => selectCliente(cliente));
            clienteDropdown.appendChild(item);
        });
    }

    /**
     * Selecciona un cliente y muestra la tabla de inventario.
     */
    function selectCliente(cliente) {
        _ventaActual.cliente = cliente;
        document.getElementById('client-search-container').classList.add('hidden');
        document.getElementById('selected-client-name').textContent = cliente.nombreComercial;
        document.getElementById('client-display-container').classList.remove('hidden');
        document.getElementById('inventarioTableContainer').classList.remove('hidden');
        document.getElementById('venta-footer-section').classList.remove('hidden');
        renderVentasInventario();
    }
    
    /**
     * Cambia la moneda de visualización.
     */
    function toggleMoneda() {
        if (_tasaCOP <= 0) {
            _showModal('Aviso', 'Ingresa una tasa de cambio válida para COP.');
            return;
        }
        _monedaActual = _monedaActual === 'USD' ? 'COP' : 'USD';
        renderVentasInventario();
        updateVentaTotal();
    }

    /**
     * Renderiza la tabla de inventario para la venta.
     */
    function renderVentasInventario() {
        // ... (código existente, no necesita cambios)
    }

    /**
     * Actualiza la cantidad de un producto y el total.
     */
    function updateVentaCantidad(event) {
        // ... (código existente, no necesita cambios)
    };

    /**
     * Calcula y muestra el total de la venta.
     */
    function updateVentaTotal() {
        // ... (código existente, no necesita cambios)
    }

    /**
     * Maneja la generación y compartición de la imagen del ticket.
     */
    async function handleShareTicket(venta, productos) {
        // ... (código existente, no necesita cambios)
    }

    /**
     * Genera un ticket y guarda la venta.
     */
    async function generarTicket() {
        // ... (código existente, no necesita cambios)
    }

    /**
     * Muestra la vista de ventas totales.
     */
    function showVentasTotalesView() {
        // ... (código existente, no necesita cambios)
    }
    
    /**
     * Muestra el submenú de opciones para el cierre de ventas.
     */
    function showCierreSubMenuView() {
        // ... (código existente, no necesita cambios)
    }
    
    /**
     * Muestra una vista previa del reporte de cierre de ventas.
     */
    async function showVerCierreView() {
        // ... (código existente, no necesita cambios)
    }
    
    /**
     * Muestra la vista con la lista de todas las ventas actuales.
     */
    function showVentasActualesView() {
        // ... (código existente, no necesita cambios)
    }

    /**
     * Renderiza la lista de ventas en el DOM.
     */
    function renderVentasList() {
        // ... (código existente, no necesita cambios)
    }
    
    /**
     * Genera y comparte una imagen del ticket de una venta histórica.
     */
    async function shareSaleTicket(ventaId) {
        // ... (código existente, no necesita cambios)
    };

    /**
     * Muestra la factura fiscal de una venta.
     */
    function mostrarFactura(ventaId) {
        // ... (código existente, no necesita cambios)
    };
    
    async function showFacturaFiscal(venta) {
        // ... (código existente, no necesita cambios)
    }

    /**
     * Obtiene y procesa los datos para el cierre de ventas.
     */
    async function getClosingData() {
        // ... (código existente, no necesita cambios)
    }
    
    /**
     * Genera el HTML para el reporte de cierre.
     */
    function generateClosingReportHTML(closingData) {
        // ... (código existente, no necesita cambios)
    }

    /**
     * Maneja la generación de la imagen del cierre de ventas.
     */
    async function handleGenerateCierreImage() {
        // ... (código existente, no necesita cambios)
    }

    /**
     * Maneja el proceso de cierre de ventas definitivo.
     */
    async function handleCierreDeVentas() {
        // ... (código existente, no necesita cambios)
    }

    // Exponer funciones públicas al objeto window
    window.ventasModule = {
        toggleMoneda,
        updateVentaCantidad,
        shareSaleTicket,
        mostrarFactura
    };
})();
