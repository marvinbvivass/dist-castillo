// --- Lógica del módulo de Ventas ---

(function() {
    // Variables locales del módulo
    let _db, _userId, _userRole, _appId, _mainContent, _floatingControls;
    let _showMainMenu, _showModal, _activeListeners;
    let _collection, _onSnapshot, _doc, _getDoc, _addDoc, _setDoc, _deleteDoc, _getDocs, _writeBatch, _runTransaction, _query, _where;
    
    // Variables específicas del módulo
    let _clientesCache = [];
    let _inventarioCache = [];
    let _ventasGlobal = [];
    let _segmentoOrderCacheVentas = null;
    let _rubroOrderCacheVentas = null;
    let _ventaActual = { cliente: null, productos: {} };
    let _originalVentaForEdit = null;
    let _tasaCOP = 0;
    let _tasaBs = 0;
    let _monedaActual = 'USD';

    /**
     * Obtiene y cachea el mapa de orden de los rubros.
     */
    async function getRubroOrderMap() {
        if (_rubroOrderCacheVentas) return _rubroOrderCacheVentas;
        const map = {};
        const rubrosRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/rubros`);
        try {
            const snapshot = await _getDocs(rubrosRef);
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                map[data.name] = (data.orden !== undefined) ? data.orden : 9999;
            });
            _rubroOrderCacheVentas = map;
            return map;
        } catch (e) {
            console.warn("No se pudo obtener el orden de los rubros en ventas.js", e);
            return null;
        }
    }

    /**
     * Obtiene y cachea el mapa de orden de los segmentos.
     */
    async function getSegmentoOrderMapVentas() {
        if (_segmentoOrderCacheVentas) return _segmentoOrderCacheVentas;
        if (window.inventarioModule && typeof window.inventarioModule.getSegmentoOrderMap === 'function') {
            _segmentoOrderCacheVentas = await window.inventarioModule.getSegmentoOrderMap();
            return _segmentoOrderCacheVentas;
        }
        const map = {};
        const segmentosRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/segmentos`);
        try {
            const snapshot = await _getDocs(segmentosRef);
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                map[data.name] = (data.orden !== undefined) ? data.orden : 9999;
            });
            _segmentoOrderCacheVentas = map;
            return map;
        } catch (e) {
            console.warn("No se pudo obtener el orden de los segmentos en ventas.js", e);
            return null;
        }
    }
    
    /**
     * Inicializa el módulo.
     */
    window.initVentas = function(dependencies) {
        _db = dependencies.db;
        _userId = dependencies.userId;
        _userRole = dependencies.userRole;
        _appId = dependencies.appId;
        _mainContent = dependencies.mainContent;
        _floatingControls = dependencies.floatingControls;
        _showMainMenu = dependencies.showMainMenu;
        _showModal = dependencies.showModal;
        _activeListeners = dependencies.activeListeners; // Usa la lista global
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
                            <button id="ventasTotalesBtn" class="w-full px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg shadow-md hover:bg-blue-600">Ventas Totales</button>
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
    
    // --- [INICIO] Lógica de Nueva Venta ---

    /**
     * Renderiza la vista para iniciar una nueva venta.
     */
    function showNuevaVentaView() {
        _originalVentaForEdit = null;
        _floatingControls.classList.add('hidden');
        _monedaActual = 'USD';
        _ventaActual = { cliente: null, productos: {} };
        _mainContent.innerHTML = `
            <div class="p-2 w-full">
                <div class="bg-white/90 backdrop-blur-sm p-3 sm:p-4 rounded-lg shadow-xl flex flex-col h-full" style="min-height: calc(100vh - 1rem);">
                    <div id="venta-header-section" class="mb-2">
                        <div class="flex justify-between items-center mb-2">
                            <h2 class="text-lg font-bold text-gray-800">Nueva Venta</h2>
                            <button id="backToVentasBtn" class="px-3 py-1.5 bg-gray-400 text-white text-xs font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver</button>
                        </div>
                        <div id="client-search-container">
                            <label for="clienteSearch" class="block text-gray-700 font-medium mb-2">Seleccionar Cliente:</label>
                            <div class="relative"><input type="text" id="clienteSearch" placeholder="Buscar cliente..." class="w-full px-4 py-2 border rounded-lg"><div id="clienteDropdown" class="autocomplete-list hidden"></div></div>
                        </div>
                        <div id="client-display-container" class="hidden flex-wrap items-center justify-between gap-2">
                            <p class="text-gray-700 flex-grow text-sm"><span class="font-medium">Cliente:</span> <span id="selected-client-name" class="font-bold"></span></p>
                            <div id="tasasContainer" class="flex flex-row items-center gap-2">
                                <div class="flex items-center space-x-1">
                                    <label for="tasaCopInput" class="block text-gray-700 text-xs font-medium">COP:</label>
                                    <input type="number" id="tasaCopInput" placeholder="4000" class="w-16 px-1 py-1 text-sm border rounded-lg">
                                </div>
                                <div class="flex items-center space-x-1">
                                    <label for="tasaBsInput" class="block text-gray-700 text-xs font-medium">Bs.:</label>
                                    <input type="number" id="tasaBsInput" placeholder="36.5" class="w-16 px-1 py-1 text-sm border rounded-lg">
                                </div>
                            </div>
                        </div>
                    </div>
                    <div id="inventarioTableContainer" class="hidden animate-fade-in flex-grow flex flex-col overflow-hidden">
                         <div id="rubro-filter-container" class="mb-2">
                             <label for="rubroFilter" class="text-xs font-medium">Filtrar por Rubro</label>
                             <select id="rubroFilter" class="w-full px-2 py-1 border rounded-lg text-sm"><option value="">Todos los Rubros</option></select>
                         </div>
                        <div class="overflow-auto flex-grow rounded-lg shadow">
                            <table class="min-w-full bg-white text-sm"><thead class="bg-gray-200 sticky top-0"><tr class="text-gray-700 uppercase leading-normal"><th class="py-2 px-2 text-center w-24">Cantidad</th><th class="py-2 px-2 text-left">Producto</th><th class="py-2 px-2 text-left price-toggle" onclick="window.ventasModule.toggleMoneda()">Precio</th><th class="py-2 px-1 text-center">Stock</th></tr></thead><tbody id="inventarioTableBody" class="text-gray-600 font-light"></tbody></table>
                        </div>
                    </div>
                    <div id="venta-footer-section" class="mt-2 flex items-center justify-between hidden">
                        <span id="ventaTotal" class="text-base font-bold text-gray-800">Total: $0.00</span>
                         <button id="generarTicketBtn" class="px-5 py-2 bg-green-500 text-white font-semibold rounded-lg shadow-md hover:bg-green-600">Generar Ticket</button>
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
        
        const savedTasaBs = localStorage.getItem('tasaBs');
        if (savedTasaBs) {
            _tasaBs = parseFloat(savedTasaBs);
            document.getElementById('tasaBsInput').value = _tasaBs;
        }

        document.getElementById('tasaCopInput').addEventListener('input', (e) => {
            _tasaCOP = parseFloat(e.target.value) || 0;
            localStorage.setItem('tasaCOP', _tasaCOP);
            renderVentasInventario();
            updateVentaTotal();
        });
        
        document.getElementById('tasaBsInput').addEventListener('input', (e) => {
            _tasaBs = parseFloat(e.target.value) || 0;
            localStorage.setItem('tasaBs', _tasaBs);
            renderVentasInventario();
            updateVentaTotal();
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
        // CORRECCIÓN: Apuntar a la colección pública de clientes.
        const clientesRef = _collection(_db, `artifacts/${_appId}/public/data/clientes`);
        const unsubClientes = _onSnapshot(clientesRef, (snapshot) => {
            _clientesCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        });

        const inventarioRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`);
        const unsubInventario = _onSnapshot(inventarioRef, (snapshot) => {
            _inventarioCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            populateRubroFilter();
            if (_ventaActual.cliente) {
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
        const currentVal = rubroFilter.value;
        rubroFilter.innerHTML = '<option value="">Todos los Rubros</option>';
        rubros.forEach(rubro => {
             if(rubro) rubroFilter.innerHTML += `<option value="${rubro}">${rubro}</option>`;
        });
        if (!_originalVentaForEdit) {
            rubroFilter.value = currentVal;
        }
    }

    /**
     * Renderiza el dropdown de clientes.
     */
    function renderClienteDropdown(filteredClients) {
        const clienteDropdown = document.getElementById('clienteDropdown');
        if(!clienteDropdown) return;
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
        document.getElementById('clienteDropdown').classList.add('hidden');
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
        const cycle = ['USD', 'COP', 'Bs'];
        const rates = { 'USD': 1, 'COP': _tasaCOP, 'Bs': _tasaBs };
        let currentIndex = cycle.indexOf(_monedaActual);
        let nextIndex = (currentIndex + 1) % cycle.length;
        while (nextIndex !== currentIndex) {
            if (rates[cycle[nextIndex]] > 0) {
                _monedaActual = cycle[nextIndex];
                renderVentasInventario();
                updateVentaTotal();
                return;
            }
            nextIndex = (nextIndex + 1) % cycle.length;
        }
        _showModal('Aviso', 'Ingresa al menos una tasa de cambio para poder alternar monedas.');
    }

    /**
     * Renderiza la vista de inventario para la venta.
     */
    async function renderVentasInventario() {
        const inventarioTableBody = document.getElementById('inventarioTableBody');
        const rubroFilter = document.getElementById('rubroFilter');

        if (!inventarioTableBody || !rubroFilter) return;

        inventarioTableBody.innerHTML = `<tr><td colspan="4" class="py-3 px-6 text-center text-gray-500">Cargando y ordenando...</td></tr>`;
        
        const selectedRubro = rubroFilter.value;
        const inventarioConStock = _inventarioCache.filter(p => (p.cantidadUnidades || 0) > 0 || _ventaActual.productos[p.id]);
        
        let filteredInventario = selectedRubro ? inventarioConStock.filter(p => p.rubro === selectedRubro) : inventarioConStock;
        
        const segmentoOrderMap = await getSegmentoOrderMapVentas();
        if (segmentoOrderMap) {
            filteredInventario.sort((a, b) => {
                const orderA = segmentoOrderMap[a.segmento] ?? 9999;
                const orderB = segmentoOrderMap[b.segmento] ?? 9999;
                if (orderA !== orderB) return orderA - orderB;
                if ((a.marca || '').localeCompare(b.marca || '') !== 0) return (a.marca || '').localeCompare(b.marca || '');
                return a.presentacion.localeCompare(b.presentacion);
            });
        }

        inventarioTableBody.innerHTML = '';
        if (filteredInventario.length === 0) {
            inventarioTableBody.innerHTML = `<tr><td colspan="4" class="py-3 px-6 text-center">No hay productos que coincidan.</td></tr>`;
            return;
        }

        let currentSegmento = null;
        let currentMarca = null;

        filteredInventario.forEach(producto => {
            const segmento = producto.segmento || 'Sin Segmento';
            const marca = producto.marca || 'Sin Marca';

            if (segmento !== currentSegmento) {
                currentSegmento = segmento;
                currentMarca = null; 
                const segmentoRow = document.createElement('tr');
                segmentoRow.innerHTML = `<td colspan="4" class="py-1 px-2 bg-gray-100 font-bold text-gray-700 text-base">${currentSegmento}</td>`;
                inventarioTableBody.appendChild(segmentoRow);
            }
             if (marca !== currentMarca) {
                currentMarca = marca;
                const marcaRow = document.createElement('tr');
                marcaRow.innerHTML = `<td colspan="4" class="py-1 px-4 bg-gray-50 font-semibold text-gray-600 text-sm">${currentMarca}</td>`;
                inventarioTableBody.appendChild(marcaRow);
            }
            
            const ventaPor = producto.ventaPor || { und: true };
            const ventaActualProducto = _ventaActual.productos[producto.id] || {};
            const precios = producto.precios || { und: producto.precioPorUnidad || 0 };
            
            const formatPrice = (value) => {
                if (_monedaActual === 'COP') return `COP ${(Math.ceil((value * _tasaCOP) / 100) * 100).toLocaleString('es-CO')}`;
                if (_monedaActual === 'Bs') return `Bs.S ${(value * _tasaBs).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                return `$${value.toFixed(2)}`;
            };
            
            const createRow = (tipo, cant, max, precio, stock, desc) => {
                const row = document.createElement('tr');
                row.classList.add('border-b', 'border-gray-200', 'hover:bg-gray-50');
                
                let vaciosInputHTML = '';
                if (tipo === 'cj' && producto.manejaVacios) {
                    const vaciosDevueltos = ventaActualProducto.vaciosDevueltos || 0;
                    vaciosInputHTML = `
                        <div class="mt-1 text-xs flex items-center">
                            <label for="vacios-${producto.id}" class="mr-2 font-medium text-cyan-700">Vacíos Devueltos:</label>
                            <input type="number" min="0" value="${vaciosDevueltos}" id="vacios-${producto.id}"
                                   class="w-16 p-1 text-center border rounded-md" 
                                   data-product-id="${producto.id}" oninput="window.ventasModule.handleVaciosChange(event)">
                        </div>
                    `;
                }

                row.innerHTML = `
                    <td class="py-2 px-2 text-center align-middle">
                        <input type="number" min="0" max="${max}" value="${cant}" class="w-16 p-1 text-center border rounded-md" data-product-id="${producto.id}" data-tipo-venta="${tipo}" oninput="window.ventasModule.handleQuantityChange(event)">
                    </td>
                    <td class="py-2 px-2 text-left align-middle">
                        ${desc}
                        ${vaciosInputHTML}
                    </td>
                    <td class="py-2 px-2 text-left align-middle font-semibold price-toggle" onclick="window.ventasModule.toggleMoneda()">${formatPrice(precio)}</td>
                    <td class="py-2 px-2 text-center align-middle">${stock}</td>
                `;
                inventarioTableBody.appendChild(row);
            };

            if (ventaPor.cj) {
                const unidadesPorCaja = producto.unidadesPorCaja || 1;
                createRow(
                    'cj',
                    ventaActualProducto.cantCj || 0,
                    Math.floor(producto.cantidadUnidades / unidadesPorCaja),
                    precios.cj || 0,
                    `${Math.floor(producto.cantidadUnidades / unidadesPorCaja)} Cj`,
                    `${producto.presentacion} (Cj. con ${unidadesPorCaja} unds)`
                );
            }
            if (ventaPor.paq) {
                const unidadesPorPaquete = producto.unidadesPorPaquete || 1;
                 createRow(
                    'paq',
                    ventaActualProducto.cantPaq || 0,
                    Math.floor(producto.cantidadUnidades / unidadesPorPaquete),
                    precios.paq || 0,
                    `${Math.floor(producto.cantidadUnidades / unidadesPorPaquete)} Paq`,
                    `${producto.presentacion} (Paq. con ${unidadesPorPaquete} unds)`
                );
            }
             if (ventaPor.und) {
                 createRow(
                    'und',
                    ventaActualProducto.cantUnd || 0,
                    producto.cantidadUnidades,
                    precios.und || 0,
                    `${producto.cantidadUnidades} Und`,
                    `${producto.presentacion}`
                );
            }
        });
    }

    /**
     * Actualiza la cantidad de un producto en la venta actual.
     */
    function handleQuantityChange(event) {
        const input = event.target;
        const productId = input.dataset.productId;
        const tipoVenta = input.dataset.tipoVenta;
        const producto = _inventarioCache.find(p => p.id === productId);
        if (!producto) return;

        if (!_ventaActual.productos[productId]) {
            _ventaActual.productos[productId] = { ...producto, cantCj: 0, cantPaq: 0, cantUnd: 0 };
        }
        
        _ventaActual.productos[productId][`cant${tipoVenta.charAt(0).toUpperCase() + tipoVenta.slice(1)}`] = parseInt(input.value, 10) || 0;

        const p = _ventaActual.productos[productId];
        const unidadesPorCaja = p.unidadesPorCaja || 1;
        const unidadesPorPaquete = p.unidadesPorPaquete || 1;
        
        const totalUnidadesVendidas = (p.cantCj * unidadesPorCaja) + (p.cantPaq * unidadesPorPaquete) + (p.cantUnd || 0);

        if (totalUnidadesVendidas > producto.cantidadUnidades) {
            _showModal('Stock Insuficiente', `La cantidad total excede el stock de ${producto.cantidadUnidades} unidades.`);
            input.value = parseInt(input.value, 10) - 1; 
            handleQuantityChange({target: input}); 
            return;
        }

        p.totalUnidadesVendidas = totalUnidadesVendidas;

        if (p.totalUnidadesVendidas === 0 && (p.vaciosDevueltos || 0) === 0) {
            delete _ventaActual.productos[productId];
        }
        updateVentaTotal();
    };

    /**
     * Actualiza la cantidad de vacíos devueltos en la venta actual.
     */
    function handleVaciosChange(event) {
        const input = event.target;
        const productId = input.dataset.productId;
        const producto = _inventarioCache.find(p => p.id === productId);
        if (!producto) return;
        
        if (!_ventaActual.productos[productId]) {
             _ventaActual.productos[productId] = { ...producto, cantCj: 0, cantPaq: 0, cantUnd: 0, totalUnidadesVendidas: 0 };
        }

        const p = _ventaActual.productos[productId];
        p.vaciosDevueltos = parseInt(input.value, 10) || 0;

        if ((p.totalUnidadesVendidas || 0) === 0 && p.vaciosDevueltos === 0) {
            delete _ventaActual.productos[productId];
        }
    }

    /**
     * Calcula y muestra el total de la venta.
     */
    function updateVentaTotal() {
        const totalEl = document.getElementById('ventaTotal');
        if(!totalEl) return;
        
        const totalUSD = Object.values(_ventaActual.productos).reduce((sum, p) => {
            if (!p.precios) return sum; // Si solo se devuelven vacíos, no hay precios.
            const precios = p.precios || { und: p.precioPorUnidad || 0 };
            const subtotal = 
                (precios.cj || 0) * (p.cantCj || 0) +
                (precios.paq || 0) * (p.cantPaq || 0) +
                (precios.und || 0) * (p.cantUnd || 0);
            return sum + subtotal;
        }, 0);

        if (_monedaActual === 'COP') {
            const totalRedondeado = Math.ceil((totalUSD * _tasaCOP) / 100) * 100;
            totalEl.textContent = `Total: COP ${totalRedondeado.toLocaleString('es-CO')}`;
        } else if (_monedaActual === 'Bs') {
            totalEl.textContent = `Total: Bs.S ${(totalUSD * _tasaBs).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        } else {
            totalEl.textContent = `Total: $${totalUSD.toFixed(2)}`;
        }
    }
    
    /**
     * Crea el HTML para un ticket/factura (para compartir como imagen).
     */
    function createTicketHTML(venta, productos, tipo = 'ticket') {
        const fecha = venta.fecha ? venta.fecha.toDate().toLocaleDateString('es-ES') : new Date().toLocaleDateString('es-ES');
        const clienteNombre = venta.cliente ? venta.cliente.nombreComercial : venta.clienteNombre;
        const clienteNombrePersonal = (venta.cliente ? venta.cliente.nombrePersonal : venta.clienteNombrePersonal) || '';
        let total = 0;
        
        let productosHTML = '';
        const productosVendidos = productos.filter(p => (p.totalUnidadesVendidas || 0) > 0);
        productosVendidos.forEach(p => {
            const precios = p.precios || { und: p.precioPorUnidad || 0 };
            const cant = p.cantidadVendida || p;
            const cantCj = cant.cantCj || cant.cj || 0;
            const cantPaq = cant.cantPaq || cant.paq || 0;
            const cantUnd = cant.cantUnd || cant.und || 0;
            
            const subtotal = 
                (precios.cj || 0) * cantCj +
                (precios.paq || 0) * cantPaq +
                (precios.und || 0) * cantUnd;
            total += subtotal;
            
            let cantidadDesc = '';
            if (cantCj > 0) cantidadDesc += `${cantCj} CJ, `;
            if (cantPaq > 0) cantidadDesc += `${cantPaq} PAQ, `;
            if (cantUnd > 0) cantidadDesc += `${cantUnd} UND, `;
            cantidadDesc = cantidadDesc.slice(0, -2); 

            let presentacionModificada = `${p.segmento || ''} ${p.marca || ''} ${p.presentacion}`;
            
            productosHTML += `
                <tr class="align-top">
                    <td class="py-2 pr-2 text-left" style="width: 60%;">
                        <div style="line-height: 1.2;">${presentacionModificada}</div>
                    </td>
                    <td class="py-2 text-center" style="width: 15%;">${cantidadDesc}</td>
                    <td class="py-2 pl-2 text-right" style="width: 25%;">$${subtotal.toFixed(2)}</td>
                </tr>
            `;
        });

        let vaciosHTML = '';
        const productosConDevolucion = productos.filter(p => (p.vaciosDevueltos || 0) > 0);
        if (productosConDevolucion.length > 0) {
            vaciosHTML += `
                <div class="text-3xl mt-6 border-t border-black border-dashed pt-4">
                    <p>ENVASES DEVUELTOS:</p>
                    <table class="w-full text-3xl mt-2">
                        <tbody>`;
            productosConDevolucion.forEach(p => {
                vaciosHTML += `
                    <tr>
                        <td class="py-1 pr-2 text-left" style="width: 70%;">${p.presentacion}</td>
                        <td class="py-1 pl-2 text-right" style="width: 30%;">${p.vaciosDevueltos} CJ</td>
                    </tr>`;
            });
            vaciosHTML += `
                        </tbody>
                    </table>
                </div>`;
        }


        const titulo = tipo === 'factura' ? 'FACTURA FISCAL' : 'TICKET DE VENTA';

        return `
            <div id="temp-ticket-for-image" class="bg-white text-black p-4 font-bold" style="width: 768px; font-family: 'Courier New', Courier, monospace;">
                <div class="text-center">
                    <h2 class="text-4xl uppercase">${titulo}</h2>
                    <p class="text-3xl">DISTRIBUIDORA CASTILLO YAÑEZ</p>
                </div>
                <div class="text-3xl mt-8">
                    <p>FECHA: ${fecha}</p>
                    <p>CLIENTE: ${clienteNombre}</p>
                </div>
                ${productosVendidos.length > 0 ? `
                <table class="w-full text-3xl mt-6">
                    <thead>
                        <tr>
                            <th class="pb-2 text-left">PRODUCTO</th>
                            <th class="pb-2 text-center">CANT.</th>
                            <th class="pb-2 text-right">SUBTOTAL</th>
                        </tr>
                    </thead>
                    <tbody>${productosHTML}</tbody>
                </table>
                ` : ''}
                ${vaciosHTML}
                <div class="text-right text-4xl mt-6 border-t border-black border-dashed pt-4">
                    <p>TOTAL: $${total.toFixed(2)}</p>
                </div>
                <div class="text-center mt-16">
                    <p class="border-t border-black w-96 mx-auto"></p>
                    <p class="mt-4 text-3xl">${clienteNombrePersonal}</p>
                </div>
                <hr class="border-dashed border-black mt-6">
            </div>
        `;
    }

    /**
     * Crea un string de texto plano para impresoras térmicas de 80mm.
     */
    function createRawTextTicket(venta, productos) {
        const fecha = venta.cliente ? new Date().toLocaleDateString('es-ES') : venta.fecha.toDate().toLocaleDateString('es-ES');
        
        const toTitleCase = (str) => {
            if (!str) return '';
            return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
        };

        const clienteNombre = toTitleCase(venta.cliente ? venta.cliente.nombreComercial : venta.clienteNombre);
        const clienteNombrePersonal = toTitleCase((venta.cliente ? venta.cliente.nombrePersonal : venta.clienteNombrePersonal) || '');
        
        const LINE_WIDTH = 48; 
        let total = 0;
        let ticket = '';

        const center = (text) => text.padStart(Math.floor((LINE_WIDTH - text.length) / 2) + text.length, ' ').padEnd(LINE_WIDTH, ' ');
        const wordWrap = (text, maxWidth) => {
            const lines = [];
            if (!text) return lines;
            let currentLine = '';
            const words = text.split(' ');
            for (const word of words) {
                if ((currentLine + ' ' + word).trim().length > maxWidth) {
                    if(currentLine.length > 0) lines.push(currentLine.trim());
                    currentLine = word;
                } else {
                    currentLine = (currentLine + ' ' + word).trim();
                }
            }
            if (currentLine) lines.push(currentLine.trim());
            return lines;
        };
        
        ticket += center('Distribuidora Castillo Yañez') + '\n';
        ticket += center('Nota de Entrega') + '\n';
        ticket += center('(no valido como factura fiscal)') + '\n\n';
        
        const wrappedClientName = wordWrap(`Cliente: ${clienteNombre}`, LINE_WIDTH);
        wrappedClientName.forEach(line => {
            ticket += line + '\n';
        });
        ticket += `Fecha: ${fecha}\n`;

        const productosVendidos = productos.filter(p => (p.totalUnidadesVendidas || 0) > 0);
        if (productosVendidos.length > 0) {
            ticket += '-'.repeat(LINE_WIDTH) + '\n';
            
            const header = ['Cant.'.padEnd(9), 'Producto'.padEnd(20), 'Precio'.padEnd(9), 'Subtotal'.padStart(10)].join('');
            ticket += header + '\n';
            ticket += '-'.repeat(LINE_WIDTH) + '\n';
            
            productosVendidos.forEach(p => {
                const precios = p.precios || { und: p.precioPorUnidad || 0 };
                const cant = p.cantidadVendida || p; 
                const cantCj = cant.cantCj || cant.cj || 0;
                const cantPaq = cant.cantPaq || cant.paq || 0;
                const cantUnd = cant.cantUnd || cant.und || 0;

                const addProductLine = (quantity, unitLabel, unitPrice, lineSubtotal, productNameInfo) => {
                    const wrappedProductName = wordWrap(productNameInfo, 20);
                    wrappedProductName.forEach((line, index) => {
                        const qtyStr = index === 0 ? `${quantity} ${unitLabel}` : '';
                        const priceStr = index === 0 ? `$${unitPrice.toFixed(2)}` : '';
                        const subtotalStr = index === wrappedProductName.length - 1 ? `$${lineSubtotal.toFixed(2)}` : '';
                        
                        ticket += [
                            qtyStr.padEnd(9),
                            line.padEnd(20),
                            priceStr.padEnd(9),
                            subtotalStr.padStart(10)
                        ].join('') + '\n';
                    });
                };

                const productNameBase = toTitleCase(`${p.segmento || ''} ${p.marca || ''} ${p.presentacion}`);
                
                if (cantCj > 0) {
                    total += (precios.cj || 0) * cantCj;
                    addProductLine(cantCj, 'cj', precios.cj, precios.cj * cantCj, `${productNameBase} (${p.unidadesPorCaja} unds)`);
                }
                if (cantPaq > 0) {
                    total += (precios.paq || 0) * cantPaq;
                    addProductLine(cantPaq, 'paq', precios.paq, precios.paq * cantPaq, `${productNameBase} (${p.unidadesPorPaquete} unds)`);
                }
                if (cantUnd > 0) {
                    total += (precios.und || 0) * cantUnd;
                    addProductLine(cantUnd, 'und', precios.und, precios.und * cantUnd, productNameBase);
                }
            });
        }
        
        const productosConDevolucion = productos.filter(p => (p.vaciosDevueltos || 0) > 0);
        if (productosConDevolucion.length > 0) {
            ticket += '-'.repeat(LINE_WIDTH) + '\n';
            ticket += center('ENVASES DEVUELTOS') + '\n';
            productosConDevolucion.forEach(p => {
                const productName = toTitleCase(p.presentacion);
                const quantityText = `${p.vaciosDevueltos} CJ`;
                const line = productName.padEnd(LINE_WIDTH - quantityText.length) + quantityText;
                ticket += line + '\n';
            });
        }


        ticket += '-'.repeat(LINE_WIDTH) + '\n';
        const totalString = `TOTAL: $${total.toFixed(2)}`;
        ticket += totalString.padStart(LINE_WIDTH, ' ') + '\n\n';
        
        ticket += '\n\n\n\n';
        ticket += center('________________________') + '\n';
        ticket += center(clienteNombrePersonal) + '\n\n';
        ticket += '-'.repeat(LINE_WIDTH) + '\n';

        return ticket;
    }


    /**
     * Maneja la compartición de la imagen del ticket.
     */
    async function handleShareTicket(htmlContent, successCallback) {
        _showModal('Progreso', 'Generando imagen...');
        const tempDiv = document.createElement('div');
        tempDiv.style.position = 'absolute';
        tempDiv.style.left = '-9999px';
        tempDiv.style.top = '0';
        tempDiv.innerHTML = htmlContent;
        document.body.appendChild(tempDiv);
        
        const ticketElement = document.getElementById('temp-ticket-for-image');
        if (!ticketElement) {
            _showModal('Error', 'No se pudo encontrar el elemento del ticket para generar la imagen.');
            document.body.removeChild(tempDiv);
            return;
        }

        try {
            await new Promise(resolve => setTimeout(resolve, 100));
            const canvas = await html2canvas(ticketElement, { scale: 3 });
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));

            if (navigator.share && blob) {
                await navigator.share({ files: [new File([blob], "ticket.png", { type: "image/png" })], title: "Ticket de Venta" });
                _showModal('Éxito', 'Venta registrada. Imagen compartida.', successCallback);
            } else {
                 _showModal('Error', 'La función de compartir no está disponible.', successCallback);
            }
        } catch(e) {
            _showModal('Error', `No se pudo generar la imagen. ${e.message}`, successCallback);
        } finally {
            document.body.removeChild(tempDiv);
        }
    }

    /**
     * Maneja la compartición del ticket como texto plano.
     */
    async function handleShareRawText(textContent, successCallback) {
        if (navigator.share) {
            try {
                await navigator.share({ title: 'Nota de Entrega', text: textContent });
                _showModal('Éxito', 'Venta registrada. El ticket está listo para imprimir.', successCallback);
            } catch (err) {
                 _showModal('Aviso', 'No se compartió el ticket, pero la venta fue registrada.', successCallback);
            }
        } else {
            try {
                const textArea = document.createElement("textarea");
                textArea.value = textContent;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                _showModal('Copiado', 'Texto de la nota copiado. Pégalo en tu app de impresión.', successCallback);
            } catch (copyErr) {
                 _showModal('Error', 'No se pudo compartir ni copiar el ticket. La venta fue registrada.', successCallback);
            }
        }
    }

    /**
     * Muestra un modal para elegir entre imprimir (texto) o compartir (imagen).
     */
    function showSharingOptions(venta, productos, tipo, successCallback) {
        const modalContent = `
            <div class="text-center">
                <h3 class="text-xl font-bold text-gray-800 mb-4">¿Qué deseas hacer?</h3>
                <p class="text-gray-600 mb-6">Elige el formato para tu ${tipo}.</p>
                <div class="space-y-4">
                    <button id="printTextBtn" class="w-full px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg shadow-md hover:bg-blue-600">Imprimir (Texto)</button>
                    <button id="shareImageBtn" class="w-full px-6 py-3 bg-green-500 text-white font-semibold rounded-lg shadow-md hover:bg-green-600">Compartir (Imagen)</button>
                </div>
            </div>`;
        
        _showModal('Elige una opción', modalContent, null, '');

        document.getElementById('printTextBtn').addEventListener('click', () => {
            const rawTextTicket = createRawTextTicket(venta, productos);
            handleShareRawText(rawTextTicket, successCallback);
        });

        document.getElementById('shareImageBtn').addEventListener('click', () => {
            const ticketHTML = createTicketHTML(venta, productos, tipo);
            handleShareTicket(ticketHTML, successCallback);
        });
    }

    /**
     * Genera un ticket y guarda la venta.
     */
    async function generarTicket() {
        if (!_ventaActual.cliente) {
            _showModal('Error', 'Debe seleccionar un cliente para generar el ticket.');
            return;
        }
        const productosEnTransaccion = Object.values(_ventaActual.productos);
        if (productosEnTransaccion.length === 0) {
            _showModal('Error', 'Debe agregar al menos un producto o registrar una devolución de vacíos.');
            return;
        }

        _showModal('Confirmar Transacción', '¿Deseas guardar esta transacción?', async () => {
            _showModal('Progreso', 'Procesando transacción...');
            try {
                const batch = _writeBatch(_db);
                const ventaRef = _doc(_collection(_db, `artifacts/${_appId}/users/${_userId}/ventas`));
                let totalVenta = 0;
                const itemsVenta = [];
                const vaciosChanges = {};

                for (const p of productosEnTransaccion) {
                    const productoEnCache = _inventarioCache.find(item => item.id === p.id);
                    if (!productoEnCache) throw new Error(`Producto ${p.presentacion} no encontrado.`);

                    const stockUnidadesTotal = productoEnCache.cantidadUnidades || 0;
                    const unidadesARestar = p.totalUnidadesVendidas || 0;
                    
                    if (stockUnidadesTotal < unidadesARestar) {
                        throw new Error(`Stock insuficiente para ${p.presentacion}.`);
                    }
                    
                    if (unidadesARestar > 0) {
                        const productoRef = _doc(_db, `artifacts/${_appId}/users/${_userId}/inventario`, p.id);
                        batch.update(productoRef, { cantidadUnidades: stockUnidadesTotal - unidadesARestar });
                    }

                    const precios = p.precios || { und: p.precioPorUnidad || 0 };
                    const subtotal = 
                        (precios.cj || 0) * (p.cantCj || 0) +
                        (precios.paq || 0) * (p.cantPaq || 0) +
                        (precios.und || 0) * (p.cantUnd || 0);
                    totalVenta += subtotal;

                    const vaciosDevueltos = p.vaciosDevueltos || 0;
                    if (p.manejaVacios) {
                        const cajasVendidas = p.cantCj || 0;
                        const netChange = cajasVendidas - vaciosDevueltos;
                        if (netChange !== 0) {
                            vaciosChanges[p.id] = netChange;
                        }
                    }

                    itemsVenta.push({ 
                        id: p.id, 
                        presentacion: p.presentacion, 
                        rubro: p.rubro ?? null,
                        marca: p.marca ?? null, 
                        segmento: p.segmento ?? null, 
                        precios: p.precios,
                        ventaPor: p.ventaPor,
                        unidadesPorPaquete: p.unidadesPorPaquete,
                        unidadesPorCaja: p.unidadesPorCaja,
                        cantidadVendida: {
                            cj: p.cantCj || 0,
                            paq: p.cantPaq || 0,
                            und: p.cantUnd || 0
                        },
                        totalUnidadesVendidas: p.totalUnidadesVendidas,
                        iva: p.iva ?? 0,
                        manejaVacios: p.manejaVacios || false,
                        vaciosDevueltos: vaciosDevueltos
                    });
                }

                if (Object.keys(vaciosChanges).length > 0) {
                    const clienteRef = _doc(_db, `artifacts/${_appId}/users/${_userId}/clientes`, _ventaActual.cliente.id);
                    await _runTransaction(_db, async (transaction) => {
                        const clienteDoc = await transaction.get(clienteRef);
                        if (!clienteDoc.exists()) throw "El cliente no existe.";
                        
                        const clienteData = clienteDoc.data();
                        const saldoVacios = clienteData.saldoVacios || {};
                        
                        for (const productoId in vaciosChanges) {
                            const change = vaciosChanges[productoId];
                            const saldoActual = saldoVacios[productoId] || 0;
                            saldoVacios[productoId] = saldoActual + change;
                        }
                        
                        transaction.update(clienteRef, { saldoVacios: saldoVacios });
                    });
                }

                batch.set(ventaRef, { 
                    clienteId: _ventaActual.cliente.id, 
                    clienteNombre: _ventaActual.cliente.nombreComercial || _ventaActual.cliente.nombrePersonal, 
                    clienteNombrePersonal: _ventaActual.cliente.nombrePersonal, 
                    fecha: new Date(), 
                    total: totalVenta, 
                    productos: itemsVenta 
                });
                await batch.commit();

                showSharingOptions(_ventaActual, productosEnTransaccion, 'Nota de Entrega', showNuevaVentaView);

            } catch (e) {
                _showModal('Error', `Hubo un error al procesar la transacción: ${e.message}`);
            }
        }, 'Sí, Guardar');
    }
    
    // --- [FIN] Lógica de Nueva Venta ---


    // --- [INICIO] Lógica de Ventas Totales y Cierre ---

    /**
     * Muestra la vista de ventas totales.
     */
    function showVentasTotalesView() {
        _floatingControls.classList.add('hidden');
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl text-center">
                        <h2 class="text-2xl font-bold text-gray-800 mb-6">Ventas Totales</h2>
                        <div class="space-y-4">
                            <button id="ventasActualesBtn" class="w-full px-6 py-3 bg-teal-500 text-white font-semibold rounded-lg shadow-md hover:bg-teal-600">Ventas Actuales</button>
                            <button id="ordenarCierreBtn" class="w-full px-6 py-3 bg-purple-500 text-white font-semibold rounded-lg shadow-md hover:bg-purple-600">Orden de Rubros y Segmentos</button>
                            <button id="cierreVentasBtn" class="w-full px-6 py-3 bg-red-500 text-white font-semibold rounded-lg shadow-md hover:bg-red-600">Cierre de Ventas</button>
                        </div>
                        <button id="backToVentasBtn" class="mt-6 w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver</button>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('ventasActualesBtn').addEventListener('click', showVentasActualesView);
        document.getElementById('cierreVentasBtn').addEventListener('click', showCierreSubMenuView);
        document.getElementById('ordenarCierreBtn').addEventListener('click', showOrdenarCierreView);
        document.getElementById('backToVentasBtn').addEventListener('click', showVentasView);
    }
    
    /**
     * Muestra la vista con la lista de todas las ventas actuales.
     */
    function showVentasActualesView() {
        _floatingControls.classList.add('hidden');
        _mainContent.innerHTML = `
            <div class="p-4 w-full">
                <div class="bg-white/90 backdrop-blur-sm p-6 rounded-lg shadow-xl">
                    <div class="flex justify-between items-center mb-6">
                        <h2 class="text-2xl font-bold text-gray-800">Ventas Actuales</h2>
                        <button id="backToVentasTotalesBtn" class="px-4 py-2 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver</button>
                    </div>
                    <div id="ventasListContainer" class="overflow-x-auto"><p class="text-gray-500 text-center">Cargando ventas...</p></div>
                </div>
            </div>
        `;
        document.getElementById('backToVentasTotalesBtn').addEventListener('click', showVentasTotalesView);
        renderVentasList();
    }

    /**
     * Renderiza la lista de ventas en el DOM.
     */
    function renderVentasList() {
        const container = document.getElementById('ventasListContainer');
        if (!container) return;

        const ventasRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/ventas`);
        const q = _query(ventasRef);
        const unsubscribe = _onSnapshot(q, (snapshot) => {
            _ventasGlobal = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            _ventasGlobal.sort((a, b) => b.fecha.toDate() - a.fecha.toDate());

            if (_ventasGlobal.length === 0) {
                container.innerHTML = `<p class="text-center text-gray-500">No hay ventas registradas.</p>`;
                return;
            }

            let tableHTML = `
                <table class="min-w-full bg-white text-sm">
                    <thead class="bg-gray-200">
                        <tr>
                            <th class="py-2 px-3 border-b text-left">Cliente</th>
                            <th class="py-2 px-3 border-b text-left">Fecha</th>
                            <th class="py-2 px-3 border-b text-right">Total</th>
                            <th class="py-2 px-3 border-b text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            _ventasGlobal.forEach(venta => {
                tableHTML += `
                    <tr class="hover:bg-gray-50">
                        <td class="py-2 px-3 border-b align-middle">${venta.clienteNombre}</td>
                        <td class="py-2 px-3 border-b align-middle">${venta.fecha.toDate().toLocaleDateString('es-ES')}</td>
                        <td class="py-2 px-3 border-b text-right font-semibold align-middle">$${(venta.total || 0).toFixed(2)}</td>
                        <td class="py-2 px-3 border-b">
                            <div class="flex flex-col items-center space-y-1">
                                <button onclick="window.ventasModule.showPastSaleOptions('${venta.id}', 'ticket')" class="w-full px-3 py-1.5 bg-blue-500 text-white text-xs font-semibold rounded-lg hover:bg-blue-600">Compartir</button>
                                <button onclick="window.ventasModule.editVenta('${venta.id}')" class="w-full px-3 py-1.5 bg-yellow-500 text-white text-xs font-semibold rounded-lg hover:bg-yellow-600">Editar</button>
                                <button onclick="window.ventasModule.deleteVenta('${venta.id}')" class="w-full px-3 py-1.5 bg-red-500 text-white text-xs font-semibold rounded-lg hover:bg-red-600">Eliminar</button>
                            </div>
                        </td>
                    </tr>
                `;
            });
            tableHTML += `</tbody></table>`;
            container.innerHTML = tableHTML;
        }, (error) => {
            if (window.isLoggingOut && error.code === 'permission-denied') {
                console.log("Listener de ventas detenido por cierre de sesión.");
                return;
            }
            console.error("Error cargando ventas: ", error);
            if(container) {
                container.innerHTML = `<p class="text-center text-red-500">Error al cargar las ventas.</p>`;
            }
        });
        _activeListeners.push(unsubscribe);
    }
    
    /**
     * Muestra el submenú de opciones para el cierre de ventas.
     */
    function showCierreSubMenuView() {
         _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl text-center">
                        <h2 class="text-2xl font-bold text-gray-800 mb-6">Cierre de Ventas</h2>
                        <div class="space-y-4">
                            <button id="verCierreBtn" class="w-full px-6 py-3 bg-cyan-500 text-white font-semibold rounded-lg shadow-md hover:bg-cyan-600">Ver Cierre</button>
                            <button id="ejecutarCierreBtn" class="w-full px-6 py-3 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700">Ejecutar Cierre</button>
                        </div>
                        <button id="backToVentasTotalesBtn" class="mt-6 w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver</button>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('verCierreBtn').addEventListener('click', showVerCierreView);
        document.getElementById('ejecutarCierreBtn').addEventListener('click', ejecutarCierre);
        document.getElementById('backToVentasTotalesBtn').addEventListener('click', showVentasTotalesView);
    }

    /**
     * Procesa los datos de ventas para generar la estructura del reporte.
     */
    async function processSalesDataForReport(ventas) {
        const clientData = {};
        let grandTotalValue = 0;
        const allProductsMap = new Map();
        const vaciosMovements = {};
        
        const inventarioSnapshot = await _getDocs(_collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`));
        const inventarioMap = new Map(inventarioSnapshot.docs.map(doc => [doc.id, doc.data()]));

        ventas.forEach(venta => {
            const clientName = venta.clienteNombre;
            if (!clientData[clientName]) {
                clientData[clientName] = { products: {}, totalValue: 0 };
            }
             if(!vaciosMovements[clientName]) {
                vaciosMovements[clientName] = {};
            }
            clientData[clientName].totalValue += venta.total;
            grandTotalValue += venta.total;
            
            (venta.productos || []).forEach(p => {
                if (p.manejaVacios) {
                    if (!vaciosMovements[clientName][p.id]) {
                        vaciosMovements[clientName][p.id] = { entregados: 0, devueltos: 0 };
                    }
                    vaciosMovements[clientName][p.id].entregados += p.cantidadVendida?.cj || 0;
                    vaciosMovements[clientName][p.id].devueltos += p.vaciosDevueltos || 0;
                }

                const productoCompleto = inventarioMap.get(p.id);
                const rubro = productoCompleto ? productoCompleto.rubro : p.rubro || 'Sin Rubro';
                const segmento = productoCompleto ? productoCompleto.segmento : p.segmento || 'Sin Segmento';
                const marca = productoCompleto ? productoCompleto.marca : p.marca || 'Sin Marca';
                
                if (!allProductsMap.has(p.id)) {
                    allProductsMap.set(p.id, {
                        id: p.id,
                        rubro: rubro,
                        segmento: segmento,
                        marca: marca,
                        presentacion: p.presentacion
                    });
                }

                if (!clientData[clientName].products[p.id]) {
                    clientData[clientName].products[p.id] = 0;
                }
                clientData[clientName].products[p.id] += p.totalUnidadesVendidas;
            });
        });

        const sortedClients = Object.keys(clientData).sort();

        const groupedProducts = {};
        for (const product of allProductsMap.values()) {
            if (!groupedProducts[product.rubro]) groupedProducts[product.rubro] = {};
            if (!groupedProducts[product.rubro][product.segmento]) groupedProducts[product.rubro][product.segmento] = {};
            if (!groupedProducts[product.rubro][product.segmento][product.marca]) groupedProducts[product.rubro][product.segmento][product.marca] = [];
            groupedProducts[product.rubro][product.segmento][product.marca].push(product);
        }

        const rubroOrderMap = await getRubroOrderMap();
        const segmentoOrderMap = await getSegmentoOrderMapVentas();

        const sortedRubros = Object.keys(groupedProducts).sort((a, b) => (rubroOrderMap[a] ?? 999) - (rubroOrderMap[b] ?? 999));

        const finalProductOrder = [];
        sortedRubros.forEach(rubro => {
            const sortedSegmentos = Object.keys(groupedProducts[rubro]).sort((a, b) => (segmentoOrderMap[a] ?? 999) - (segmentoOrderMap[b] ?? 999));
            sortedSegmentos.forEach(segmento => {
                const sortedMarcas = Object.keys(groupedProducts[rubro][segmento]).sort();
                sortedMarcas.forEach(marca => {
                    const sortedPresentaciones = groupedProducts[rubro][segmento][marca].sort((a,b) => a.presentacion.localeCompare(b.presentacion));
                    finalProductOrder.push(...sortedPresentaciones);
                });
            });
        });

        return { clientData, grandTotalValue, sortedClients, groupedProducts, finalProductOrder, sortedRubros, segmentoOrderMap, vaciosMovements, allProductsMap };
    }
    
    
    /**
     * Muestra una vista previa del reporte de cierre de ventas.
     */
    async function showVerCierreView() {
        _showModal('Progreso', 'Generando reporte de cierre...');
        const ventasSnapshot = await _getDocs(_collection(_db, `artifacts/${_appId}/users/${_userId}/ventas`));
        const ventas = ventasSnapshot.docs.map(doc => doc.data());

        if (ventas.length === 0) {
            _showModal('Aviso', 'No hay ventas para generar un cierre.');
            return;
        }

        const { clientData, grandTotalValue, sortedClients, groupedProducts, finalProductOrder, sortedRubros, segmentoOrderMap, vaciosMovements, allProductsMap } = await processSalesDataForReport(ventas);

        let headerRow1 = `<tr class="sticky top-0 z-20"><th rowspan="4" class="p-1 border bg-gray-200 sticky left-0 z-30">Cliente</th>`;
        let headerRow2 = `<tr class="sticky z-20" style="top: 25px;">`;
        let headerRow3 = `<tr class="sticky z-20" style="top: 50px;">`;
        let headerRow4 = `<tr class="sticky z-20" style="top: 75px;">`;

        sortedRubros.forEach(rubro => {
            let rubroColspan = 0;
            const sortedSegmentos = Object.keys(groupedProducts[rubro]).sort((a, b) => (segmentoOrderMap[a] ?? 999) - (segmentoOrderMap[b] ?? 999));
            sortedSegmentos.forEach(segmento => {
                const sortedMarcas = Object.keys(groupedProducts[rubro][segmento]).sort();
                sortedMarcas.forEach(marca => {
                    rubroColspan += groupedProducts[rubro][segmento][marca].length;
                });
            });
            headerRow1 += `<th colspan="${rubroColspan}" class="p-1 border bg-gray-300">${rubro}</th>`;

            sortedSegmentos.forEach(segmento => {
                let segmentoColspan = 0;
                const sortedMarcas = Object.keys(groupedProducts[rubro][segmento]).sort();
                sortedMarcas.forEach(marca => {
                    segmentoColspan += groupedProducts[rubro][segmento][marca].length;
                });
                headerRow2 += `<th colspan="${segmentoColspan}" class="p-1 border bg-gray-200">${segmento}</th>`;

                sortedMarcas.forEach(marca => {
                    const marcaColspan = groupedProducts[rubro][segmento][marca].length;
                    headerRow3 += `<th colspan="${marcaColspan}" class="p-1 border bg-gray-100">${marca}</th>`;
                    
                    const sortedPresentaciones = groupedProducts[rubro][segmento][marca].sort((a,b) => a.presentacion.localeCompare(b.presentacion));
                    sortedPresentaciones.forEach(producto => {
                        headerRow4 += `<th class="p-1 border bg-gray-50 whitespace-nowrap">${producto.presentacion}</th>`;
                    });
                });
            });
        });
        headerRow1 += `<th rowspan="4" class="p-1 border bg-gray-200 sticky right-0 z-30">Total Cliente</th></tr>`;
        headerRow2 += `</tr>`;
        headerRow3 += `</tr>`;
        headerRow4 += `</tr>`;

        let bodyHTML = '';
        sortedClients.forEach(clientName => {
            bodyHTML += `<tr class="hover:bg-blue-50"><td class="p-1 border font-medium bg-white sticky left-0 z-10">${clientName}</td>`;
            const currentClient = clientData[clientName];
            finalProductOrder.forEach(product => {
                const quantity = currentClient.products[product.id] || 0;
                bodyHTML += `<td class="p-1 border text-center">${quantity > 0 ? quantity : ''}</td>`;
            });
            bodyHTML += `<td class="p-1 border text-right font-semibold bg-white sticky right-0 z-10">$${currentClient.totalValue.toFixed(2)}</td></tr>`;
        });
        
        let footerHTML = '<tr class="bg-gray-200 font-bold"><td class="p-1 border sticky left-0 z-10">TOTALES (Uds)</td>';
        finalProductOrder.forEach(product => {
            let totalQty = 0;
            sortedClients.forEach(clientName => {
                totalQty += clientData[clientName].products[product.id] || 0;
            });
            footerHTML += `<td class="p-1 border text-center">${totalQty}</td>`;
        });
        footerHTML += `<td class="p-1 border text-right sticky right-0 z-10">$${grandTotalValue.toFixed(2)}</td></tr>`;
        
        let vaciosReportHTML = '';
        const clientesConMovimientoVacios = Object.keys(vaciosMovements).filter(cliente => Object.keys(vaciosMovements[cliente]).length > 0).sort();
        
        if (clientesConMovimientoVacios.length > 0) {
            vaciosReportHTML = `
                <h3 class="text-xl font-bold text-gray-800 my-6">Reporte de Envases Retornables (Vacíos)</h3>
                <div class="overflow-auto border">
                    <table class="min-w-full bg-white text-xs">
                        <thead class="bg-gray-200">
                            <tr>
                                <th class="p-1 border text-left">Cliente</th>
                                <th class="p-1 border text-left">Producto</th>
                                <th class="p-1 border text-center">Entregados (Cajas)</th>
                                <th class="p-1 border text-center">Devueltos (Cajas)</th>
                                <th class="p-1 border text-center">Neto</th>
                            </tr>
                        </thead>
                        <tbody>`;

            clientesConMovimientoVacios.forEach(cliente => {
                const movimientos = vaciosMovements[cliente];
                for(const productoId in movimientos) {
                    const mov = movimientos[productoId];
                    const producto = allProductsMap.get(productoId);
                    const neto = mov.entregados - mov.devueltos;
                    if(mov.entregados > 0 || mov.devueltos > 0) {
                         vaciosReportHTML += `
                            <tr class="hover:bg-blue-50">
                                <td class="p-1 border">${cliente}</td>
                                <td class="p-1 border">${producto ? producto.presentacion : 'Producto Desconocido'}</td>
                                <td class="p-1 border text-center">${mov.entregados}</td>
                                <td class="p-1 border text-center">${mov.devueltos}</td>
                                <td class="p-1 border text-center font-bold">${neto > 0 ? `+${neto}` : neto}</td>
                            </tr>
                        `;
                    }
                }
            });
            vaciosReportHTML += '</tbody></table></div>';
        }

        const reporteHTML = `
            <div class="text-left max-h-[80vh] overflow-auto">
                <h3 class="text-xl font-bold text-gray-800 mb-4">Reporte de Cierre de Ventas (Unidades)</h3>
                <div class="overflow-auto border">
                    <table class="min-w-full bg-white text-xs">
                        <thead class="bg-gray-200">${headerRow1}${headerRow2}${headerRow3}${headerRow4}</thead>
                        <tbody>${bodyHTML}</tbody>
                        <tfoot>${footerHTML}</tfoot>
                    </table>
                </div>
                ${vaciosReportHTML}
            </div>`;
        _showModal('Reporte de Cierre', reporteHTML);
    }

    /**
     * Genera y descarga un archivo de Excel con el reporte de cierre.
     */
    async function exportCierreToExcel(ventas) {
        if (typeof XLSX === 'undefined') {
            _showModal('Error', 'La librería para exportar a Excel no está cargada.');
            return;
        }

        const { clientData, grandTotalValue, sortedClients, groupedProducts, finalProductOrder, sortedRubros, segmentoOrderMap, vaciosMovements, allProductsMap } = await processSalesDataForReport(ventas);

        // --- Hoja 1: Reporte de Ventas ---
        const dataForSheet1 = [];
        const merges1 = [];
        const headerRow1 = [""]; const headerRow2 = [""]; const headerRow3 = [""]; const headerRow4 = ["Cliente"];
        
        let currentColumn = 1;
        sortedRubros.forEach(rubro => {
            const rubroStartCol = currentColumn;
            let rubroColspan = 0;
            const sortedSegmentos = Object.keys(groupedProducts[rubro]).sort((a, b) => (segmentoOrderMap[a] ?? 999) - (segmentoOrderMap[b] ?? 999));
            sortedSegmentos.forEach(segmento => {
                const segmentoStartCol = currentColumn;
                let segmentoColspan = 0;
                const sortedMarcas = Object.keys(groupedProducts[rubro][segmento]).sort();
                sortedMarcas.forEach(marca => {
                    const marcaStartCol = currentColumn;
                    const presentaciones = groupedProducts[rubro][segmento][marca].sort((a,b) => a.presentacion.localeCompare(b.presentacion));
                    rubroColspan += presentaciones.length;
                    segmentoColspan += presentaciones.length;
                    headerRow3.push(marca);
                    for (let i = 1; i < presentaciones.length; i++) headerRow3.push("");
                    if (presentaciones.length > 1) merges1.push({ s: { r: 2, c: marcaStartCol }, e: { r: 2, c: marcaStartCol + presentaciones.length - 1 } });
                    presentaciones.forEach(p => headerRow4.push(p.presentacion));
                    currentColumn += presentaciones.length;
                });
                headerRow2.push(segmento);
                for (let i = 1; i < segmentoColspan; i++) headerRow2.push("");
                if (segmentoColspan > 1) merges1.push({ s: { r: 1, c: segmentoStartCol }, e: { r: 1, c: segmentoStartCol + segmentoColspan - 1 } });
            });
            headerRow1.push(rubro);
            for (let i = 1; i < rubroColspan; i++) headerRow1.push("");
            if (rubroColspan > 1) merges1.push({ s: { r: 0, c: rubroStartCol }, e: { r: 0, c: rubroStartCol + rubroColspan - 1 } });
        });
        
        headerRow1.push(""); headerRow2.push(""); headerRow3.push(""); headerRow4.push("Total Cliente");
        dataForSheet1.push(headerRow1, headerRow2, headerRow3, headerRow4);
        merges1.push({ s: { r: 0, c: 0 }, e: { r: 3, c: 0 } });
        merges1.push({ s: { r: 0, c: finalProductOrder.length + 1 }, e: { r: 3, c: finalProductOrder.length + 1 } });

        sortedClients.forEach(clientName => {
            const row = [clientName];
            const currentClient = clientData[clientName];
            finalProductOrder.forEach(product => row.push(currentClient.products[product.id] || 0));
            row.push(currentClient.totalValue);
            dataForSheet1.push(row);
        });

        const footerRow = ["TOTALES (Uds)"];
        finalProductOrder.forEach(product => {
            let totalQty = 0;
            sortedClients.forEach(clientName => totalQty += clientData[clientName].products[product.id] || 0);
            footerRow.push(totalQty);
        });
        footerRow.push(grandTotalValue);
        dataForSheet1.push(footerRow);

        const ws1 = XLSX.utils.aoa_to_sheet(dataForSheet1);
        ws1['!merges'] = merges1;
        
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws1, 'Reporte de Cierre');

        // --- Hoja 2: Reporte de Vacíos ---
        const clientesConMovimientoVacios = Object.keys(vaciosMovements).filter(cliente => Object.keys(vaciosMovements[cliente]).length > 0).sort();
        if (clientesConMovimientoVacios.length > 0) {
            const dataForSheet2 = [['Cliente', 'Producto', 'Entregados (Cajas)', 'Devueltos (Cajas)', 'Neto']];
            clientesConMovimientoVacios.forEach(cliente => {
                 const movimientos = vaciosMovements[cliente];
                for(const productoId in movimientos) {
                    const mov = movimientos[productoId];
                    const producto = allProductsMap.get(productoId);
                    const neto = mov.entregados - mov.devueltos;
                     if(mov.entregados > 0 || mov.devueltos > 0) {
                        dataForSheet2.push([
                            cliente,
                            producto ? producto.presentacion : 'Producto Desconocido',
                            mov.entregados,
                            mov.devueltos,
                            neto
                        ]);
                    }
                }
            });
            const ws2 = XLSX.utils.aoa_to_sheet(dataForSheet2);
            XLSX.utils.book_append_sheet(wb, ws2, 'Reporte de Vacíos');
        }
        
        const today = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(wb, `Reporte_Cierre_Ventas_${today}.xlsx`);
    }

    /**
     * Ejecuta el cierre de ventas: archiva y elimina.
     */
    async function ejecutarCierre() {
        _showModal('Confirmar Cierre Definitivo', 
            'Esta acción generará un reporte en Excel, luego archivará y eliminará las ventas actuales. No se puede deshacer. ¿Continuar?', 
            async () => {
                const ventasRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/ventas`);
                const ventasSnapshot = await _getDocs(ventasRef);
                const ventas = ventasSnapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
                if (ventas.length === 0) {
                    _showModal('Aviso', 'No hay ventas para cerrar.');
                    return;
                }
                try {
                    await exportCierreToExcel(ventas);
                    _showModal('Progreso', 'Reporte Excel generado. Ahora procesando el cierre...');

                    if (_userRole === 'user') {
                        const userDocRef = _doc(_db, "users", _userId);
                        const userDoc = await _getDoc(userDocRef);
                        const userData = userDoc.exists() ? userDoc.data() : {};

                        const publicCierreRef = _doc(_collection(_db, `public_data/${_appId}/user_closings`));
                        await _setDoc(publicCierreRef, {
                            fecha: new Date(),
                            ventas: ventas.map(({id, ...rest}) => rest),
                            total: ventas.reduce((sum, v) => sum + v.total, 0),
                            vendedorInfo: {
                                userId: _userId,
                                nombre: userData.nombre || '',
                                apellido: userData.apellido || '',
                                camion: userData.camion || '',
                                email: userData.email || ''
                            }
                        });
                    } else { // admin
                        const cierreRef = _doc(_collection(_db, `artifacts/${_appId}/users/${_userId}/cierres`));
                        await _setDoc(cierreRef, {
                            fecha: new Date(),
                            ventas: ventas.map(({id, ...rest}) => rest),
                            total: ventas.reduce((sum, v) => sum + v.total, 0)
                        });
                    }
                    
                    const batch = _writeBatch(_db);
                    ventas.forEach(venta => batch.delete(_doc(ventasRef, venta.id)));
                    await batch.commit();
                    _showModal('Éxito', 'El cierre de ventas se ha completado correctamente.', showVentasTotalesView);
                } catch(e) {
                    _showModal('Error', `Ocurrió un error durante el cierre: ${e.message}`);
                }
            },
            'Sí, Ejecutar Cierre'
        );
    }

    // --- [FIN] Lógica de Ventas Totales y Cierre ---


    // --- [INICIO] Lógica para Ordenar Rubros y Segmentos del Cierre ---
    
    /**
     * Muestra la vista para ordenar Rubros y Segmentos para los reportes de cierre.
     */
    function showOrdenarCierreView() {
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl">
                        <h2 class="text-2xl font-bold text-gray-800 mb-4 text-center">Orden de Rubros y Segmentos</h2>
                        <p class="text-center text-gray-600 mb-6">Arrastra y suelta para cambiar el orden en que aparecen en los reportes.</p>
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div>
                                <h3 class="text-xl font-semibold mb-4 text-center">Orden de Rubros</h3>
                                <ul id="rubros-sortable-list" class="space-y-2 border rounded-lg p-4 max-h-96 overflow-y-auto">
                                    <p class="text-gray-500 text-center">Cargando rubros...</p>
                                </ul>
                            </div>
                            <div>
                                <h3 class="text-xl font-semibold mb-4 text-center">Orden de Segmentos</h3>
                                <ul id="segmentos-sortable-list" class="space-y-2 border rounded-lg p-4 max-h-96 overflow-y-auto">
                                    <p class="text-gray-500 text-center">Selecciona un rubro para ver sus segmentos.</p>
                                </ul>
                            </div>
                        </div>

                        <div class="mt-8 flex flex-col sm:flex-row gap-4">
                            <button id="backToVentasTotalesBtn" class="w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver</button>
                            <button id="saveOrderBtn" class="w-full px-6 py-3 bg-green-500 text-white font-semibold rounded-lg shadow-md hover:bg-green-600">Guardar Orden</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('backToVentasTotalesBtn').addEventListener('click', showVentasTotalesView);
        document.getElementById('saveOrderBtn').addEventListener('click', handleGuardarOrdenCierre);

        renderRubrosForOrdering();
    }

    /**
     * Renderiza la lista de Rubros y añade los listeners para seleccionar uno.
     */
    async function renderRubrosForOrdering() {
        const container = document.getElementById('rubros-sortable-list');
        if (!container) return;
        container.innerHTML = `<p class="text-gray-500 text-center">Cargando...</p>`;

        try {
            const collectionRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/rubros`);
            let snapshot = await _getDocs(collectionRef);
            let items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // CORRECCIÓN: Lógica para manejar rubros nuevos sin reiniciar el orden.
            const itemsWithoutOrder = items.filter(item => item.orden === undefined);
            const itemsWithOrder = items.filter(item => item.orden !== undefined);

            if (itemsWithoutOrder.length > 0) {
                const maxOrder = itemsWithOrder.reduce((max, item) => Math.max(max, item.orden), -1);
                const batch = _writeBatch(_db);

                itemsWithoutOrder.sort((a,b) => a.name.localeCompare(b.name));

                itemsWithoutOrder.forEach((item, index) => {
                    const docRef = _doc(collectionRef, item.id);
                    batch.update(docRef, { orden: maxOrder + 1 + index });
                });
                await batch.commit();
                
                snapshot = await _getDocs(collectionRef);
                items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            }


            items.sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999));
            container.innerHTML = ''; 

            if(items.length === 0) {
                 container.innerHTML = `<p class="text-gray-500 text-center">No hay rubros para ordenar.</p>`;
                 return;
            }

            items.forEach(item => {
                const li = document.createElement('li');
                li.dataset.id = item.id;
                li.dataset.name = item.name;
                li.className = 'p-3 bg-gray-100 rounded shadow-sm cursor-pointer hover:bg-gray-200';
                li.textContent = item.name;
                li.draggable = true;
                li.addEventListener('click', (e) => {
                    // Remove selection from others
                    container.querySelectorAll('li').forEach(el => el.classList.remove('bg-blue-200', 'ring-2', 'ring-blue-500'));
                    // Add selection to clicked
                    e.currentTarget.classList.add('bg-blue-200', 'ring-2', 'ring-blue-500');
                    renderSegmentosForOrdering(item.name);
                });
                container.appendChild(li);
            });
            addDragAndDropHandlers(container);
        } catch (error) {
            console.error(`Error al renderizar la lista de rubros:`, error);
            container.innerHTML = `<p class="text-red-500 text-center">Error al cargar datos.</p>`;
        }
    }

    /**
     * Renderiza la lista de Segmentos filtrada por un Rubro.
     */
    async function renderSegmentosForOrdering(rubroName) {
        const container = document.getElementById('segmentos-sortable-list');
        if (!container) return;
        container.innerHTML = `<p class="text-gray-500 text-center">Cargando segmentos para "${rubroName}"...</p>`;

        try {
            // 1. Encontrar qué segmentos se usan en este rubro
            const inventarioRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`);
            const q = _query(inventarioRef, _where("rubro", "==", rubroName));
            const inventarioSnapshot = await _getDocs(q);
            const usedSegmentNames = new Set(inventarioSnapshot.docs.map(doc => doc.data().segmento));

            // 2. Obtener todos los segmentos con su orden
            const segmentosRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/segmentos`);
            const segmentosSnapshot = await _getDocs(segmentosRef);
            let allSegmentos = segmentosSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // 3. Filtrar y ordenar
            const items = allSegmentos
                .filter(seg => usedSegmentNames.has(seg.name))
                .sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999));

            container.innerHTML = '';
            if (items.length === 0) {
                container.innerHTML = `<p class="text-gray-500 text-center">No hay segmentos asociados a este rubro.</p>`;
                return;
            }

            items.forEach(item => {
                const li = document.createElement('li');
                li.dataset.id = item.id;
                li.dataset.name = item.name;
                li.className = 'p-3 bg-gray-100 rounded shadow-sm cursor-grab active:cursor-grabbing';
                li.textContent = item.name;
                li.draggable = true;
                container.appendChild(li);
            });
            addDragAndDropHandlers(container);

        } catch (error) {
            console.error(`Error al renderizar la lista de segmentos:`, error);
            container.innerHTML = `<p class="text-red-500 text-center">Error al cargar datos.</p>`;
        }
    }


    /**
     * Añade los manejadores de eventos para la funcionalidad de arrastrar y soltar.
     */
    function addDragAndDropHandlers(container) {
        let draggedItem = null;
        container.addEventListener('dragstart', e => {
            if (e.target.tagName === 'LI') {
                draggedItem = e.target;
                setTimeout(() => { if(draggedItem) draggedItem.style.opacity = '0.5'; }, 0);
            }
        });
        container.addEventListener('dragend', e => {
            if(draggedItem) draggedItem.style.opacity = '1';
            draggedItem = null;
        });
        container.addEventListener('dragover', e => {
            e.preventDefault();
            const afterElement = getDragAfterElement(container, e.clientY);
            if (draggedItem) {
                if (afterElement == null) container.appendChild(draggedItem);
                else container.insertBefore(draggedItem, afterElement);
            }
        });
        function getDragAfterElement(container, y) {
            const draggableElements = [...container.querySelectorAll('li:not([style*="opacity: 0.5"])')];
            return draggableElements.reduce((closest, child) => {
                const box = child.getBoundingClientRect();
                const offset = y - box.top - box.height / 2;
                if (offset < 0 && offset > closest.offset) return { offset: offset, element: child };
                else return closest;
            }, { offset: Number.NEGATIVE_INFINITY }).element;
        }
    }

    /**
     * Guarda el nuevo orden de Rubros y Segmentos.
     */
    async function handleGuardarOrdenCierre() {
        const rubrosList = document.querySelectorAll('#rubros-sortable-list li');
        const segmentosList = document.querySelectorAll('#segmentos-sortable-list li');
        
        const batch = _writeBatch(_db);
        
        rubrosList.forEach((item, index) => {
            const docRef = _doc(_db, `artifacts/${_appId}/users/${_userId}/rubros`, item.dataset.id);
            batch.update(docRef, { orden: index });
        });

        segmentosList.forEach((item, index) => {
            const docRef = _doc(_db, `artifacts/${_appId}/users/${_userId}/segmentos`, item.dataset.id);
            batch.update(docRef, { orden: index });
        });

        try {
            await batch.commit();
            _rubroOrderCacheVentas = null; // Invalidate cache
            _segmentoOrderCacheVentas = null; // Invalidate cache
            _showModal('Éxito', 'El orden de los reportes ha sido guardado.');
            showVentasTotalesView();
        } catch (error) {
            console.error("Error guardando el orden:", error);
            _showModal('Error', 'Hubo un error al guardar el nuevo orden.');
        }
    }
    
    // --- [FIN] Lógica de Ordenamiento ---


    // --- [INICIO] Lógica de Edición y Eliminación de Ventas ---

    /**
     * Muestra las opciones para una venta pasada (imprimir o compartir).
     */
    function showPastSaleOptions(ventaId, tipo = 'ticket') {
        const venta = _ventasGlobal.find(v => v.id === ventaId);
        if (venta) {
            showSharingOptions(venta, venta.productos, 'Nota de Entrega', () => {});
        } else {
            _showModal('Error', 'No se encontró la venta seleccionada.');
        }
    }

    /**
     * Inicia la edición de una venta existente.
     */
    function editVenta(ventaId) {
        const venta = _ventasGlobal.find(v => v.id === ventaId);
        if (!venta) {
            _showModal('Error', 'No se pudo encontrar la venta para editar.');
            return;
        }
        _originalVentaForEdit = venta;
        showEditVentaView(venta);
    }

    /**
     * Inicia la eliminación de una venta existente.
     */
    function deleteVenta(ventaId) {
        const venta = _ventasGlobal.find(v => v.id === ventaId);
        if (!venta) {
            _showModal('Error', 'No se pudo encontrar la venta para eliminar.');
            return;
        }

        _showModal(
            'Confirmar Eliminación',
            `¿Estás seguro de que deseas eliminar la venta a "${venta.clienteNombre}"? El stock y los saldos de vacíos serán restaurados.`,
            async () => {
                _showModal('Progreso', 'Eliminando venta y restaurando datos...');
                try {
                    const batch = _writeBatch(_db);
                    const vaciosAdjustments = {};

                    for (const productoVendido of venta.productos) {
                        const productoEnCache = await _getDoc(_doc(_db, `artifacts/${_appId}/users/${_userId}/inventario`, productoVendido.id));
                        
                        if (productoEnCache.exists()) {
                            const unidadesADevolver = productoVendido.totalUnidadesVendidas || 0;
                            const nuevoStockUnidades = (productoEnCache.data().cantidadUnidades || 0) + unidadesADevolver;
                            batch.update(productoEnCache.ref, { cantidadUnidades: nuevoStockUnidades });
                        }

                        if (productoVendido.manejaVacios) {
                            const cajasVendidas = productoVendido.cantidadVendida?.cj || 0;
                            const devueltos = productoVendido.vaciosDevueltos || 0;
                            const netChange = cajasVendidas - devueltos;
                            if (netChange !== 0) {
                                vaciosAdjustments[productoVendido.id] = -netChange;
                            }
                        }
                    }

                    if (Object.keys(vaciosAdjustments).length > 0) {
                         const clienteRef = _doc(_db, `artifacts/${_appId}/users/${_userId}/clientes`, venta.clienteId);
                         await _runTransaction(_db, async (transaction) => {
                            const clienteDoc = await transaction.get(clienteRef);
                            if (!clienteDoc.exists()) return;
                            
                            const clienteData = clienteDoc.data();
                            const saldoVacios = clienteData.saldoVacios || {};
                            
                            for (const productoId in vaciosAdjustments) {
                                const adjustment = vaciosAdjustments[productoId];
                                const saldoActual = saldoVacios[productoId] || 0;
                                saldoVacios[productoId] = saldoActual + adjustment;
                            }
                            
                            transaction.update(clienteRef, { saldoVacios: saldoVacios });
                        });
                    }

                    const ventaRef = _doc(_db, `artifacts/${_appId}/users/${_userId}/ventas`, ventaId);
                    batch.delete(ventaRef);
                    await batch.commit();
                    _showModal('Éxito', 'La venta ha sido eliminada y los datos restaurados.');

                } catch (error) {
                    _showModal('Error', `Hubo un error al eliminar la venta: ${error.message}`);
                }
            },
            'Sí, Eliminar'
        );
    }
    
    /**
     * Muestra la vista para editar una venta.
     */
    async function showEditVentaView(venta) {
        _floatingControls.classList.add('hidden');
        _monedaActual = 'USD';
        
        _mainContent.innerHTML = `
            <div class="p-2 sm:p-4 w-full">
                <div class="bg-white/90 backdrop-blur-sm p-4 sm:p-6 rounded-lg shadow-xl flex flex-col h-full" style="min-height: calc(100vh - 2rem);">
                    <div id="venta-header-section" class="mb-4">
                        <div class="flex justify-between items-center mb-4">
                            <h2 class="text-xl font-bold text-gray-800">Editando Venta</h2>
                            <button id="backToVentasBtn" class="px-4 py-2 bg-gray-400 text-white text-sm font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver</button>
                        </div>
                        <div class="flex-wrap items-center justify-between gap-4 p-4 bg-gray-100 rounded-lg">
                            <p class="text-gray-700"><span class="font-medium">Cliente:</span> <span class="font-bold">${venta.clienteNombre}</span></p>
                        </div>
                    </div>
                    <div id="inventarioTableContainer" class="animate-fade-in flex-grow flex flex-col overflow-hidden">
                         <div class="mb-2">
                             <label for="rubroFilter" class="text-xs font-medium">Rubro</label>
                             <select id="rubroFilter" class="w-full px-2 py-1 border rounded-lg text-sm"><option value="">Todos los Rubros</option></select>
                         </div>
                        <div class="overflow-auto flex-grow rounded-lg shadow">
                            <table class="min-w-full bg-white text-xs"><thead class="bg-gray-200 sticky top-0"><tr class="text-gray-700 uppercase leading-normal">
                                <th class="py-2 px-1 text-center">Cant.</th>
                                <th class="py-2 px-2 text-left">Producto</th>
                                <th class="py-2 px-2 text-left">Precio/Und</th>
                                <th class="py-2 px-1 text-center">Stock (Und)</th>
                            </tr></thead><tbody id="inventarioTableBody" class="text-gray-600 font-light"></tbody></table>
                        </div>
                    </div>
                    <div id="venta-footer-section" class="mt-4 flex items-center justify-between">
                        <span id="ventaTotal" class="text-lg font-bold text-gray-800">Total: $0.00</span>
                         <button id="saveChangesBtn" class="px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg shadow-md hover:bg-blue-600">Guardar Cambios</button>
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('saveChangesBtn').addEventListener('click', handleGuardarVentaEditada);
        document.getElementById('backToVentasBtn').addEventListener('click', showVentasActualesView);

        _showModal('Progreso', 'Cargando datos para edición...');
        try {
            const inventarioRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`);
            const snapshot = await _getDocs(inventarioRef);
            _inventarioCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            _ventaActual = {
                cliente: { id: venta.clienteId, nombreComercial: venta.clienteNombre, nombrePersonal: venta.clienteNombrePersonal },
                productos: venta.productos.reduce((acc, p) => {
                    const productoCompleto = _inventarioCache.find(inv => inv.id === p.id) || p;
                    const cant = p.cantidadVendida || {};
                    acc[p.id] = { 
                        ...productoCompleto, 
                        cantCj: cant.cj || 0,
                        cantPaq: cant.paq || 0,
                        cantUnd: cant.und || 0,
                        totalUnidadesVendidas: p.totalUnidadesVendidas,
                        vaciosDevueltos: p.vaciosDevueltos || 0
                    };
                    return acc;
                }, {})
            };

            document.getElementById('rubroFilter').addEventListener('change', renderVentasInventario);
            populateRubroFilter();
            document.getElementById('rubroFilter').value = ''; 
            
            renderVentasInventario();
            updateVentaTotal();

            document.getElementById('modalContainer').classList.add('hidden');

        } catch (error) {
            _showModal('Error', `No se pudo cargar la información para editar: ${error.message}`);
        }
    }
    
    /**
     * Guarda los cambios de una venta editada y ajusta el stock.
     */
    async function handleGuardarVentaEditada() {
        if (!_originalVentaForEdit) {
            _showModal('Error', 'No se pudo encontrar la venta original para guardar los cambios.');
            return;
        }

        _showModal('Confirmar Cambios', '¿Deseas guardar los cambios? El stock y los saldos de vacíos se ajustarán automáticamente.', async () => {
            _showModal('Progreso', 'Guardando cambios y ajustando datos...');

            try {
                const batch = _writeBatch(_db);
                const originalProducts = new Map(_originalVentaForEdit.productos.map(p => [p.id, p]));
                const newProducts = new Map(Object.values(_ventaActual.productos).map(p => [p.id, p]));
                const allProductIds = new Set([...originalProducts.keys(), ...newProducts.keys()]);

                const vaciosAdjustments = {};

                for (const productId of allProductIds) {
                    const originalProduct = originalProducts.get(productId);
                    const newProduct = newProducts.get(productId);
                    const productoEnCache = _inventarioCache.find(p => p.id === productId);

                    if (!productoEnCache) continue;
                    
                    const originalUnitsSold = originalProduct ? (originalProduct.totalUnidadesVendidas || 0) : 0;
                    const newUnitsSold = newProduct ? (newProduct.totalUnidadesVendidas || 0) : 0;
                    const unitDelta = originalUnitsSold - newUnitsSold;

                    if (unitDelta !== 0) {
                        const currentStockUnits = productoEnCache.cantidadUnidades || 0;
                        const finalStockUnits = currentStockUnits + unitDelta;
                        if (finalStockUnits < 0) throw new Error(`Stock insuficiente para "${productoEnCache.presentacion}".`);
                        const productoRef = _doc(_db, `artifacts/${_appId}/users/${_userId}/inventario`, productId);
                        batch.update(productoRef, { cantidadUnidades: finalStockUnits });
                    }
                    
                    if(productoEnCache.manejaVacios){
                        const originalCajas = originalProduct?.cantidadVendida?.cj || 0;
                        const originalDevueltos = originalProduct?.vaciosDevueltos || 0;
                        const originalNetChange = originalCajas - originalDevueltos;

                        const newCajas = newProduct?.cantCj || 0;
                        const newDevueltos = newProduct?.vaciosDevueltos || 0;
                        const newNetChange = newCajas - newDevueltos;

                        const adjustment = newNetChange - originalNetChange;
                        if(adjustment !== 0){
                            vaciosAdjustments[productId] = adjustment;
                        }
                    }
                }

                if (Object.keys(vaciosAdjustments).length > 0) {
                    const clienteRef = _doc(_db, `artifacts/${_appId}/users/${_userId}/clientes`, _originalVentaForEdit.clienteId);
                     await _runTransaction(_db, async (transaction) => {
                        const clienteDoc = await transaction.get(clienteRef);
                        if (!clienteDoc.exists()) return;
                        
                        const clienteData = clienteDoc.data();
                        const saldoVacios = clienteData.saldoVacios || {};
                        
                        for (const productoId in vaciosAdjustments) {
                            const adjustment = vaciosAdjustments[productoId];
                            const saldoActual = saldoVacios[productoId] || 0;
                            saldoVacios[productoId] = saldoActual + adjustment;
                        }
                        
                        transaction.update(clienteRef, { saldoVacios: saldoVacios });
                    });
                }

                let nuevoTotal = 0;
                const nuevosItemsVenta = Object.values(_ventaActual.productos).map(p => {
                     const precios = p.precios || { und: p.precioPorUnidad || 0 };
                     const subtotal = 
                        (precios.cj || 0) * (p.cantCj || 0) +
                        (precios.paq || 0) * (p.cantPaq || 0) +
                        (precios.und || 0) * (p.cantUnd || 0);
                    nuevoTotal += subtotal;

                    const unidadesPorCaja = p.unidadesPorCaja || 1;
                    const unidadesPorPaquete = p.unidadesPorPaquete || 1;
                    const totalUnidadesVendidasRecalculado = (p.cantCj || 0) * unidadesPorCaja + (p.cantPaq || 0) * unidadesPorPaquete + (p.cantUnd || 0);

                    return {
                        id: p.id, presentacion: p.presentacion, 
                        rubro: p.rubro ?? null,
                        marca: p.marca ?? null, 
                        segmento: p.segmento ?? null,
                        precios: p.precios, 
                        unidadesPorPaquete: p.unidadesPorPaquete,
                        unidadesPorCaja: p.unidadesPorCaja,
                        cantidadVendida: {
                            cj: p.cantCj || 0,
                            paq: p.cantPaq || 0,
                            und: p.cantUnd || 0
                        },
                        totalUnidadesVendidas: totalUnidadesVendidasRecalculado,
                        iva: p.iva ?? 0,
                        manejaVacios: p.manejaVacios || false,
                        vaciosDevueltos: p.vaciosDevueltos || 0
                    };
                });

                const ventaRef = _doc(_db, `artifacts/${_appId}/users/${_userId}/ventas`, _originalVentaForEdit.id);
                batch.update(ventaRef, {
                    productos: nuevosItemsVenta,
                    total: nuevoTotal,
                    fechaModificacion: new Date()
                });
                
                await batch.commit();
                _originalVentaForEdit = null;
                _showModal('Éxito', 'La venta se ha actualizado correctamente.', showVentasActualesView);

            } catch (error) {
                _showModal('Error', `Hubo un error al guardar los cambios: ${error.message}`);
            }
        });
    }

    // --- [FIN] Lógica de Edición y Eliminación de Ventas ---


    // Exponer funciones públicas al objeto window
    window.ventasModule = {
        toggleMoneda,
        handleQuantityChange,
        handleVaciosChange,
        showPastSaleOptions,
        editVenta,
        deleteVenta,
        invalidateCache: () => { 
            _segmentoOrderCacheVentas = null;
            _rubroOrderCacheVentas = null;
        }
    };
})();
