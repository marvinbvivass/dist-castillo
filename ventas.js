(function() {
    let _db, _userId, _userRole, _appId, _mainContent, _floatingControls;
    let _showMainMenu, _showModal, _activeListeners;
    let _collection, _onSnapshot, _doc, _getDoc, _addDoc, _setDoc, _deleteDoc, _getDocs, _writeBatch, _runTransaction, _query, _where;

    let _clientesCache = [];
    let _inventarioCache = [];
    let _ventasGlobal = [];
    let _segmentoOrderCacheVentas = null;
    let _rubroOrderCacheVentas = null;
    let _ventaActual = { cliente: null, productos: {}, vaciosDevueltosPorTipo: {} };
    let _originalVentaForEdit = null;
    let _tasaCOP = 0;
    let _tasaBs = 0;
    let _monedaActual = 'USD';

    const TIPOS_VACIO = ["1/4 - 1/3", "ret 350 ml", "ret 1.25 Lts"];

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

    async function getSegmentoOrderMapVentas() {
        if (_segmentoOrderCacheVentas) return _segmentoOrderCacheVentas;
        if (window.inventarioModule && typeof window.inventarioModule.getSegmentoOrderMap === 'function') {
             try {
                _segmentoOrderCacheVentas = await window.inventarioModule.getSegmentoOrderMap();
                if (_segmentoOrderCacheVentas) return _segmentoOrderCacheVentas;
             } catch(e) {
                 console.warn("Error getting segment order map from inventarioModule in ventas:", e);
             }
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
            console.warn("No se pudo obtener el orden de los segmentos en ventas.js (fallback failed):", e);
            return null;
        }
    }

    window.initVentas = function(dependencies) {
        _db = dependencies.db;
        _userId = dependencies.userId;
        _userRole = dependencies.userRole;
        _appId = dependencies.appId;
        _mainContent = dependencies.mainContent;
        _floatingControls = dependencies.floatingControls;
        _showMainMenu = dependencies.showMainMenu;
        _showModal = dependencies.showModal;
        _activeListeners = dependencies.activeListeners;
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

    function showNuevaVentaView() {
        _originalVentaForEdit = null;
        _floatingControls.classList.add('hidden');
        _monedaActual = 'USD';
        _ventaActual = { cliente: null, productos: {}, vaciosDevueltosPorTipo: {} };
        TIPOS_VACIO.forEach(tipo => _ventaActual.vaciosDevueltosPorTipo[tipo] = 0);

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
                    <div id="vacios-devueltos-section" class="mb-2 hidden">
                         <h3 class="text-sm font-semibold text-cyan-700 mb-1">Vacíos Devueltos:</h3>
                         <div class="grid grid-cols-3 gap-2">
                            ${TIPOS_VACIO.map(tipo => `
                                <div class="flex flex-col items-center">
                                    <label for="vacios-${tipo.replace(/\s+/g, '-')}" class="text-xs font-medium text-gray-600 mb-1">${tipo}</label>
                                    <input type="number" min="0" value="0" id="vacios-${tipo.replace(/\s+/g, '-')}"
                                           class="w-16 p-1 text-center border rounded-md"
                                           data-tipo-vacio="${tipo}" oninput="window.ventasModule.handleTipoVacioChange(event)">
                                </div>
                            `).join('')}
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
            const filteredClients = _clientesCache.filter(c => (c.nombreComercial || '').toLowerCase().includes(searchTerm) || (c.nombrePersonal || '').toLowerCase().includes(searchTerm));
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
            if (_monedaActual === 'COP') {
                renderVentasInventario();
                updateVentaTotal();
            }
        });

        document.getElementById('tasaBsInput').addEventListener('input', (e) => {
            _tasaBs = parseFloat(e.target.value) || 0;
            localStorage.setItem('tasaBs', _tasaBs);
            if (_monedaActual === 'Bs') {
                renderVentasInventario();
                updateVentaTotal();
            }
        });

        document.getElementById('rubroFilter').addEventListener('change', renderVentasInventario);
        document.getElementById('generarTicketBtn').addEventListener('click', generarTicket);
        document.getElementById('backToVentasBtn').addEventListener('click', showVentasView);

        loadDataForNewSale();
    }

    function loadDataForNewSale() {
        const clientesRef = _collection(_db, `artifacts/ventas-9a210/public/data/clientes`);
        const unsubClientes = _onSnapshot(clientesRef, (snapshot) => {
            _clientesCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }, (error) => {
            if (window.isLoggingOut && error.code === 'permission-denied') {
                console.log("Listener de clientes (venta nueva) detenido por cierre de sesión (ignorado).");
                return;
            }
            console.error("Error cargando clientes para nueva venta:", error);
        });

        const inventarioRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`);
        const unsubInventario = _onSnapshot(inventarioRef, (snapshot) => {
            _inventarioCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            populateRubroFilter();
            if (_ventaActual.cliente) {
                renderVentasInventario();
            }
        }, (error) => {
            if (window.isLoggingOut && error.code === 'permission-denied') {
                console.log("Listener de inventario (venta nueva) detenido por cierre de sesión (ignorado).");
                return;
            }
             console.error("Error cargando inventario para nueva venta:", error);
             const inventarioTableBody = document.getElementById('inventarioTableBody');
             if(inventarioTableBody) inventarioTableBody.innerHTML = '<tr><td colspan="4" class="py-3 px-6 text-center text-red-500">Error al cargar inventario.</td></tr>';
        });

        _activeListeners.push(unsubClientes, unsubInventario);
    }

    function populateRubroFilter() {
        const rubroFilter = document.getElementById('rubroFilter');
        if(!rubroFilter) return;
        const rubros = [...new Set(_inventarioCache.map(p => p.rubro))].sort();
        const currentVal = rubroFilter.value;
        rubroFilter.innerHTML = '<option value="">Todos los Rubros</option>';
        rubros.forEach(rubro => {
             if(rubro) rubroFilter.innerHTML += `<option value="${rubro}">${rubro}</option>`;
        });
        if (rubros.includes(currentVal)) {
            rubroFilter.value = currentVal;
        } else {
             rubroFilter.value = '';
        }
    }

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

    function selectCliente(cliente) {
        _ventaActual.cliente = cliente;
        document.getElementById('client-search-container').classList.add('hidden');
        document.getElementById('clienteDropdown').classList.add('hidden');
        document.getElementById('selected-client-name').textContent = cliente.nombreComercial;
        document.getElementById('client-display-container').classList.remove('hidden');
        document.getElementById('inventarioTableContainer').classList.remove('hidden');
        document.getElementById('venta-footer-section').classList.remove('hidden');
        document.getElementById('vacios-devueltos-section').classList.remove('hidden');
        renderVentasInventario();
    }

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
        if (_tasaCOP > 0 || _tasaBs > 0) {
             _showModal('Aviso', 'Ingresa al menos una tasa de cambio válida (> 0) para poder alternar monedas.');
        } else {
             _showModal('Aviso', 'Ingresa las tasas de cambio COP y/o Bs. para ver precios en otras monedas.');
        }
    }

    async function renderVentasInventario() {
        const inventarioTableBody = document.getElementById('inventarioTableBody');
        const rubroFilter = document.getElementById('rubroFilter');

        if (!inventarioTableBody || !rubroFilter) return;

        inventarioTableBody.innerHTML = `<tr><td colspan="4" class="py-3 px-6 text-center text-gray-500">Cargando y ordenando inventario...</td></tr>`;

        const selectedRubro = rubroFilter.value;
        const inventarioConStockOEnVenta = _inventarioCache.filter(p => (p.cantidadUnidades || 0) > 0 || _ventaActual.productos[p.id]);
        let filteredInventario = selectedRubro ? inventarioConStockOEnVenta.filter(p => p.rubro === selectedRubro) : inventarioConStockOEnVenta;

        const segmentoOrderMap = await getSegmentoOrderMapVentas();
        if (segmentoOrderMap) {
            filteredInventario.sort((a, b) => {
                const orderA = segmentoOrderMap[a.segmento] ?? 9999;
                const orderB = segmentoOrderMap[b.segmento] ?? 9999;
                if (orderA !== orderB) return orderA - orderB;
                const marcaComp = (a.marca || '').localeCompare(b.marca || '');
                if (marcaComp !== 0) return marcaComp;
                return (a.presentacion || '').localeCompare(b.presentacion || '');
            });
        } else {
             filteredInventario.sort((a, b) => (a.presentacion || '').localeCompare(b.presentacion || ''));
        }

        inventarioTableBody.innerHTML = '';
        if (filteredInventario.length === 0) {
            inventarioTableBody.innerHTML = `<tr><td colspan="4" class="py-3 px-6 text-center text-gray-500">No hay productos disponibles ${selectedRubro ? 'para este rubro' : ''}.</td></tr>`;
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
                if (isNaN(value)) value = 0;
                if (_monedaActual === 'COP' && _tasaCOP > 0) return `COP ${(Math.ceil((value * _tasaCOP) / 100) * 100).toLocaleString('es-CO')}`;
                if (_monedaActual === 'Bs' && _tasaBs > 0) return `Bs.S ${(value * _tasaBs).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                return `$${value.toFixed(2)}`;
            };

            const createRow = (tipo, cant, maxStockTipo, precioTipo, stockDisplayTipo, descTipo) => {
                const row = document.createElement('tr');
                row.classList.add('border-b', 'border-gray-200', 'hover:bg-gray-50');
                row.innerHTML = `
                    <td class="py-2 px-2 text-center align-middle">
                        <input type="number" min="0" max="${maxStockTipo}" value="${cant}" class="w-16 p-1 text-center border rounded-md" data-product-id="${producto.id}" data-tipo-venta="${tipo}" oninput="window.ventasModule.handleQuantityChange(event)">
                    </td>
                    <td class="py-2 px-2 text-left align-middle">
                        ${descTipo}
                    </td>
                    <td class="py-2 px-2 text-left align-middle font-semibold price-toggle" onclick="window.ventasModule.toggleMoneda()" title="Clic para cambiar moneda">${formatPrice(precioTipo)}</td>
                    <td class="py-2 px-1 text-center align-middle">${stockDisplayTipo}</td>
                `;
                inventarioTableBody.appendChild(row);
            };

            const unidadesStockTotal = producto.cantidadUnidades || 0;

            if (ventaPor.cj) {
                const unidadesPorCaja = producto.unidadesPorCaja || 1;
                const maxStockCajas = Math.floor(unidadesStockTotal / unidadesPorCaja);
                createRow(
                    'cj',
                    ventaActualProducto.cantCj || 0,
                    maxStockCajas,
                    precios.cj || 0,
                    `${maxStockCajas} Cj`,
                    `${producto.presentacion} (Cj/${unidadesPorCaja} und)`
                );
            }
            if (ventaPor.paq) {
                const unidadesPorPaquete = producto.unidadesPorPaquete || 1;
                const maxStockPaquetes = Math.floor(unidadesStockTotal / unidadesPorPaquete);
                 createRow(
                    'paq',
                    ventaActualProducto.cantPaq || 0,
                    maxStockPaquetes,
                    precios.paq || 0,
                    `${maxStockPaquetes} Paq`,
                    `${producto.presentacion} (Paq/${unidadesPorPaquete} und)`
                );
            }
             if (ventaPor.und) {
                 createRow(
                    'und',
                    ventaActualProducto.cantUnd || 0,
                    unidadesStockTotal,
                    precios.und || 0,
                    `${unidadesStockTotal} Und`,
                    `${producto.presentacion} (Und)`
                );
            }
        });
        updateVentaTotal();
    }

    function handleQuantityChange(event) {
        const input = event.target;
        const productId = input.dataset.productId;
        const tipoVenta = input.dataset.tipoVenta;
        const producto = _inventarioCache.find(p => p.id === productId);
        if (!producto) return;

        if (!_ventaActual.productos[productId]) {
            _ventaActual.productos[productId] = {
                 ...producto,
                 cantCj: 0,
                 cantPaq: 0,
                 cantUnd: 0,
                 totalUnidadesVendidas: 0
             };
        }

        const quantity = parseInt(input.value, 10) || 0;
        _ventaActual.productos[productId][`cant${tipoVenta.charAt(0).toUpperCase() + tipoVenta.slice(1)}`] = quantity;

        const pVenta = _ventaActual.productos[productId];
        const unidadesPorCaja = pVenta.unidadesPorCaja || 1;
        const unidadesPorPaquete = pVenta.unidadesPorPaquete || 1;
        const totalUnidadesVendidas = (pVenta.cantCj * unidadesPorCaja) + (pVenta.cantPaq * unidadesPorPaquete) + (pVenta.cantUnd || 0);

        const stockDisponibleUnidades = producto.cantidadUnidades || 0;
        if (totalUnidadesVendidas > stockDisponibleUnidades) {
            _showModal('Stock Insuficiente', `La cantidad total (${totalUnidadesVendidas} und) excede el stock disponible de ${stockDisponibleUnidades} unidades para ${producto.presentacion}. Se ajustará al máximo.`);

             let excessUnits = totalUnidadesVendidas - stockDisponibleUnidades;
             if (tipoVenta === 'cj') {
                 const excessCajas = Math.ceil(excessUnits / unidadesPorCaja);
                 input.value = Math.max(0, quantity - excessCajas);
             } else if (tipoVenta === 'paq') {
                 const excessPaquetes = Math.ceil(excessUnits / unidadesPorPaquete);
                 input.value = Math.max(0, quantity - excessPaquetes);
             } else {
                 input.value = Math.max(0, quantity - excessUnits);
             }
            handleQuantityChange({target: input});
            return;
        }

        pVenta.totalUnidadesVendidas = totalUnidadesVendidas;

        if (pVenta.totalUnidadesVendidas === 0 && pVenta.cantCj === 0 && pVenta.cantPaq === 0 && pVenta.cantUnd === 0) {
             delete _ventaActual.productos[productId];
        }

        updateVentaTotal();
    };

    function handleTipoVacioChange(event) {
        const input = event.target;
        const tipoVacio = input.dataset.tipoVacio;
        const cantidad = parseInt(input.value, 10) || 0;

        if (tipoVacio && _ventaActual.vaciosDevueltosPorTipo.hasOwnProperty(tipoVacio)) {
            _ventaActual.vaciosDevueltosPorTipo[tipoVacio] = cantidad;
        } else {
             console.warn("Tipo de vacío inválido o no encontrado:", tipoVacio);
        }
    }

    function updateVentaTotal() {
        const totalEl = document.getElementById('ventaTotal');
        if(!totalEl) return;

        const totalUSD = Object.values(_ventaActual.productos).reduce((sum, p) => {
            const precios = p.precios || { und: p.precioPorUnidad || 0 };
            const subtotal =
                (precios.cj || 0) * (p.cantCj || 0) +
                (precios.paq || 0) * (p.cantPaq || 0) +
                (precios.und || 0) * (p.cantUnd || 0);
            return sum + subtotal;
        }, 0);

        if (_monedaActual === 'COP' && _tasaCOP > 0) {
            const totalRedondeado = Math.ceil((totalUSD * _tasaCOP) / 100) * 100;
            totalEl.textContent = `Total: COP ${totalRedondeado.toLocaleString('es-CO')}`;
        } else if (_monedaActual === 'Bs' && _tasaBs > 0) {
            totalEl.textContent = `Total: Bs.S ${(totalUSD * _tasaBs).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        } else {
            totalEl.textContent = `Total: $${totalUSD.toFixed(2)}`;
        }
    }

    function createTicketHTML(venta, productos, vaciosDevueltosPorTipo, tipo = 'ticket') {
        const fecha = venta.fecha ? (venta.fecha.toDate ? venta.fecha.toDate().toLocaleDateString('es-ES') : new Date(venta.fecha).toLocaleDateString('es-ES')) : new Date().toLocaleDateString('es-ES');
        const clienteNombre = venta.cliente ? venta.cliente.nombreComercial : venta.clienteNombre;
        const clienteNombrePersonal = (venta.cliente ? venta.cliente.nombrePersonal : venta.clienteNombrePersonal) || '';
        let total = 0;

        let productosHTML = '';
        const productosVendidos = productos.filter(p => (p.totalUnidadesVendidas || (p.cantidadVendida && (p.cantidadVendida.cj > 0 || p.cantidadVendida.paq > 0 || p.cantidadVendida.und > 0)) ));

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

            let presentacionModificada = `${p.segmento || ''} ${p.marca || ''} ${p.presentacion || 'Producto Desconocido'}`;

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
        const tiposConDevolucion = Object.entries(vaciosDevueltosPorTipo || {}).filter(([tipo, cant]) => cant > 0);
        if (tiposConDevolucion.length > 0) {
            vaciosHTML += `
                <div class="text-3xl mt-6 border-t border-black border-dashed pt-4">
                    <p>ENVASES DEVUELTOS:</p>
                    <table class="w-full text-3xl mt-2">
                        <tbody>`;
            tiposConDevolucion.forEach(([tipo, cant]) => {
                vaciosHTML += `
                    <tr>
                        <td class="py-1 pr-2 text-left" style="width: 70%;">${tipo}</td>
                        <td class="py-1 pl-2 text-right" style="width: 30%;">${cant} CJ</td>
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
                ` : '<p class="text-3xl mt-6 text-center text-gray-500">(Sin productos en esta transacción)</p>'}
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

    function createRawTextTicket(venta, productos, vaciosDevueltosPorTipo) {
        const fecha = venta.fecha ? (venta.fecha.toDate ? venta.fecha.toDate().toLocaleDateString('es-ES') : new Date(venta.fecha).toLocaleDateString('es-ES')) : new Date().toLocaleDateString('es-ES');

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

        const productosVendidos = productos.filter(p => (p.totalUnidadesVendidas || (p.cantidadVendida && (p.cantidadVendida.cj > 0 || p.cantidadVendida.paq > 0 || p.cantidadVendida.und > 0)) ));

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

                const productNameBase = toTitleCase(`${p.segmento || ''} ${p.marca || ''} ${p.presentacion || 'N/A'}`);

                if (cantCj > 0) {
                    const lineSub = (precios.cj || 0) * cantCj;
                    total += lineSub;
                    addProductLine(cantCj, 'cj', precios.cj, lineSub, `${productNameBase} (${p.unidadesPorCaja || 1} und)`);
                }
                if (cantPaq > 0) {
                    const lineSub = (precios.paq || 0) * cantPaq;
                    total += lineSub;
                    addProductLine(cantPaq, 'paq', precios.paq, lineSub, `${productNameBase} (${p.unidadesPorPaquete || 1} und)`);
                }
                if (cantUnd > 0) {
                    const lineSub = (precios.und || 0) * cantUnd;
                    total += lineSub;
                    addProductLine(cantUnd, 'und', precios.und, lineSub, productNameBase);
                }
            });
        }

        const tiposConDevolucion = Object.entries(vaciosDevueltosPorTipo || {}).filter(([tipo, cant]) => cant > 0);
        if (tiposConDevolucion.length > 0) {
            ticket += '-'.repeat(LINE_WIDTH) + '\n';
            ticket += center('ENVASES DEVUELTOS') + '\n';
            tiposConDevolucion.forEach(([tipo, cant]) => {
                const quantityText = `${cant} CJ`;
                const line = tipo.padEnd(LINE_WIDTH - quantityText.length) + quantityText;
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
             if (successCallback) successCallback();
             return;
        }

        try {
            await new Promise(resolve => setTimeout(resolve, 150));
            const canvas = await html2canvas(ticketElement, { scale: 3, useCORS: true, allowTaint: true });
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png', 0.9));

            if (navigator.share && blob) {
                const file = new File([blob], "ticket.png", { type: "image/png" });
                 if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    await navigator.share({ files: [file], title: "Ticket de Venta" });
                     _showModal('Éxito', 'Venta registrada. Imagen compartida.', successCallback);
                 } else {
                     console.warn("File sharing not supported by Web Share API.");
                      _showModal('Aviso', 'Venta registrada. La imagen no se pudo compartir directamente (navegador no compatible).', successCallback);
                 }
            } else {
                 _showModal('Error', 'La función de compartir no está disponible en este navegador.', successCallback);
            }
        } catch(e) {
             console.error("Error generating/sharing ticket image:", e);
            window.showModal('Error', `No se pudo generar/compartir la imagen: ${e.message}`, successCallback);
        } finally {
            if (tempDiv.parentNode) {
                document.body.removeChild(tempDiv);
            }
        }
    }

    async function handleShareRawText(textContent, successCallback) {
        if (navigator.share) {
            try {
                await navigator.share({ title: 'Nota de Entrega', text: textContent });
                _showModal('Éxito', 'Venta registrada. El ticket está listo para imprimir/compartir.', successCallback);
            } catch (err) {
                 if (err.name === 'AbortError') {
                      console.log('Sharing aborted by user.');
                      _showModal('Aviso', 'Compartición cancelada. La venta fue registrada.', successCallback);
                 } else {
                      console.error('Web Share API error:', err);
                      copyToClipboard(textContent, successCallback);
                 }
            }
        } else {
            copyToClipboard(textContent, successCallback);
        }
    }

    function copyToClipboard(textContent, successCallback) {
         try {
             if (navigator.clipboard && navigator.clipboard.writeText) {
                 navigator.clipboard.writeText(textContent).then(() => {
                     _showModal('Copiado', 'Texto de la nota copiado al portapapeles. Pégalo en tu app de impresión.', successCallback);
                 }).catch(copyErr => {
                      console.error('navigator.clipboard.writeText failed:', copyErr);
                      legacyCopyToClipboard(textContent, successCallback);
                 });
             } else {
                 legacyCopyToClipboard(textContent, successCallback);
             }
         } catch (err) {
              console.error('General copy error:', err);
             _showModal('Error', 'No se pudo compartir ni copiar el ticket. La venta fue registrada.', successCallback);
         }
    }

    function legacyCopyToClipboard(textContent, successCallback) {
        const textArea = document.createElement("textarea");
        textArea.value = textContent;
        textArea.style.position = 'fixed';
        textArea.style.top = '-9999px';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        try {
            const successful = document.execCommand('copy');
            if (successful) {
                 _showModal('Copiado', 'Texto de la nota copiado al portapapeles (método antiguo). Pégalo en tu app de impresión.', successCallback);
            } else {
                 throw new Error('execCommand returned false');
            }
        } catch (copyErr) {
             console.error('document.execCommand("copy") failed:', copyErr);
            _showModal('Error', 'No se pudo copiar el texto al portapapeles. La venta fue registrada.', successCallback);
        } finally {
            document.body.removeChild(textArea);
        }
    }

    function showSharingOptions(venta, productos, vaciosDevueltosPorTipo, tipo, successCallback) {
        const modalContent = `
            <div class="text-center">
                <h3 class="text-xl font-bold text-gray-800 mb-4">¿Qué deseas hacer?</h3>
                <p class="text-gray-600 mb-6">Elige el formato para tu ${tipo}.</p>
                <div class="space-y-4">
                    <button id="printTextBtn" class="w-full px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg shadow-md hover:bg-blue-600">Imprimir/Compartir (Texto)</button>
                    <button id="shareImageBtn" class="w-full px-6 py-3 bg-green-500 text-white font-semibold rounded-lg shadow-md hover:bg-green-600">Compartir (Imagen)</button>
                </div>
            </div>`;

        _showModal('Elige una opción', modalContent, null, '');

        document.getElementById('printTextBtn').addEventListener('click', () => {
            const rawTextTicket = createRawTextTicket(venta, productos, vaciosDevueltosPorTipo);
            handleShareRawText(rawTextTicket, successCallback);
        });

        document.getElementById('shareImageBtn').addEventListener('click', () => {
            const ticketHTML = createTicketHTML(venta, productos, vaciosDevueltosPorTipo, tipo);
            handleShareTicket(ticketHTML, successCallback);
        });
    }

    async function generarTicket() {
        if (!_ventaActual.cliente) {
            _showModal('Error', 'Debe seleccionar un cliente para generar el ticket.');
            return;
        }
        const productosEnTransaccion = Object.values(_ventaActual.productos);
        const hayVaciosDevueltos = Object.values(_ventaActual.vaciosDevueltosPorTipo).some(cant => cant > 0);
        if (productosEnTransaccion.length === 0 && !hayVaciosDevueltos) {
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
                const vaciosChangesPorTipo = {};

                for (const p of productosEnTransaccion) {
                    const productoEnCache = _inventarioCache.find(item => item.id === p.id);
                    if (!productoEnCache) throw new Error(`Producto ${p.presentacion} no encontrado en caché.`);

                    const stockUnidadesTotal = productoEnCache.cantidadUnidades || 0;
                    const unidadesARestar = p.totalUnidadesVendidas || 0;

                    if (unidadesARestar < 0) {
                        throw new Error(`Cantidad inválida para ${p.presentacion}.`);
                    }

                    if (stockUnidadesTotal < unidadesARestar) {
                        throw new Error(`Stock insuficiente para ${p.presentacion} (Necesitas ${unidadesARestar}, tienes ${stockUnidadesTotal}).`);
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

                    if (productoEnCache.manejaVacios && productoEnCache.tipoVacio) {
                        const tipoVacio = productoEnCache.tipoVacio;
                        const cajasVendidas = p.cantCj || 0;
                        if (cajasVendidas > 0) {
                            vaciosChangesPorTipo[tipoVacio] = (vaciosChangesPorTipo[tipoVacio] || 0) + cajasVendidas;
                        }
                    }

                     if (unidadesARestar > 0) {
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
                            tipoVacio: p.tipoVacio || null,
                        });
                     }
                }

                for (const tipoVacio in _ventaActual.vaciosDevueltosPorTipo) {
                    const devueltos = _ventaActual.vaciosDevueltosPorTipo[tipoVacio] || 0;
                    if (devueltos > 0) {
                        vaciosChangesPorTipo[tipoVacio] = (vaciosChangesPorTipo[tipoVacio] || 0) - devueltos;
                    }
                }

                if (Object.values(vaciosChangesPorTipo).some(change => change !== 0)) {
                    const clienteRef = _doc(_db, `artifacts/ventas-9a210/public/data/clientes`, _ventaActual.cliente.id);
                    await _runTransaction(_db, async (transaction) => {
                        const clienteDoc = await transaction.get(clienteRef);
                        if (!clienteDoc.exists()) throw "El cliente no existe.";

                        const clienteData = clienteDoc.data();
                        const saldoVacios = clienteData.saldoVacios || {};

                        for (const tipoVacio in vaciosChangesPorTipo) {
                            const change = vaciosChangesPorTipo[tipoVacio];
                            if (change !== 0) {
                                const saldoActual = saldoVacios[tipoVacio] || 0;
                                saldoVacios[tipoVacio] = saldoActual + change;
                            }
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
                    productos: itemsVenta,
                    vaciosDevueltosPorTipo: _ventaActual.vaciosDevueltosPorTipo
                });

                await batch.commit();

                showSharingOptions(
                    {
                        cliente: _ventaActual.cliente,
                        fecha: new Date()
                    },
                    itemsVenta,
                    _ventaActual.vaciosDevueltosPorTipo,
                    'Nota de Entrega',
                    showNuevaVentaView
                 );

            } catch (e) {
                 console.error("Error processing transaction:", e);
                _showModal('Error', `Hubo un error al procesar la transacción: ${e.message}`);
            }
        }, 'Sí, Guardar', null, true);
    }

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

    function renderVentasList() {
        const container = document.getElementById('ventasListContainer');
        if (!container) return;

        const ventasRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/ventas`);
        const q = _query(ventasRef);
        const unsubscribe = _onSnapshot(q, (snapshot) => {
            _ventasGlobal = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            _ventasGlobal.sort((a, b) => (b.fecha?.toDate() ?? 0) - (a.fecha?.toDate() ?? 0));

            if (_ventasGlobal.length === 0) {
                container.innerHTML = `<p class="text-center text-gray-500 p-4">No hay ventas registradas.</p>`;
                return;
            }

            let tableHTML = `
                <table class="min-w-full bg-white text-sm">
                    <thead class="bg-gray-200 sticky top-0 z-10">
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
                const fechaVenta = venta.fecha?.toDate ? venta.fecha.toDate() : new Date(0);
                const fechaFormato = fechaVenta.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
                tableHTML += `
                    <tr class="hover:bg-gray-50">
                        <td class="py-2 px-3 border-b align-middle">${venta.clienteNombre || 'N/A'}</td>
                        <td class="py-2 px-3 border-b align-middle">${fechaFormato}</td>
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
                console.log("Listener de ventas totales detenido por cierre de sesión (ignorado).");
                return;
            }
            console.error("Error cargando lista de ventas: ", error);
            if(container) {
                container.innerHTML = `<p class="text-center text-red-500 p-4">Error al cargar las ventas.</p>`;
            }
        });
        _activeListeners.push(unsubscribe);
    }

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

    async function processSalesDataForReport(ventas) {
        const clientData = {};
        let grandTotalValue = 0;
        const allProductsMap = new Map();
        const vaciosMovementsPorTipo = {};

        const inventarioSnapshot = await _getDocs(_collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`));
        const inventarioMap = new Map(inventarioSnapshot.docs.map(doc => [doc.id, doc.data()]));

        ventas.forEach(venta => {
            const clientName = venta.clienteNombre || 'Cliente Desconocido';
            if (!clientData[clientName]) {
                clientData[clientName] = { products: {}, totalValue: 0 };
            }
             if(!vaciosMovementsPorTipo[clientName]) {
                vaciosMovementsPorTipo[clientName] = {};
                TIPOS_VACIO.forEach(tipo => vaciosMovementsPorTipo[clientName][tipo] = { entregados: 0, devueltos: 0 });
            }
            clientData[clientName].totalValue += (venta.total || 0);
            grandTotalValue += (venta.total || 0);

            const vaciosDevueltosEnVenta = venta.vaciosDevueltosPorTipo || {};
            for (const tipoVacio in vaciosDevueltosEnVenta) {
                if (vaciosMovementsPorTipo[clientName][tipoVacio]) {
                    vaciosMovementsPorTipo[clientName][tipoVacio].devueltos += (vaciosDevueltosEnVenta[tipoVacio] || 0);
                } else {
                     console.warn(`Tipo de vacío "${tipoVacio}" encontrado en venta pero no en TIPOS_VACIO para cliente ${clientName}.`);
                }
            }

            (venta.productos || []).forEach(p => {
                const productoCompleto = inventarioMap.get(p.id) || p;
                const rubro = productoCompleto.rubro || 'Sin Rubro';
                const segmento = productoCompleto.segmento || 'Sin Segmento';
                const marca = productoCompleto.marca || 'Sin Marca';

                if (productoCompleto.manejaVacios && productoCompleto.tipoVacio) {
                     const tipoVacio = productoCompleto.tipoVacio;
                     if (vaciosMovementsPorTipo[clientName][tipoVacio]) {
                        vaciosMovementsPorTipo[clientName][tipoVacio].entregados += p.cantidadVendida?.cj || 0;
                     } else {
                          console.warn(`Tipo de vacío "${tipoVacio}" del producto ${p.id} no está en TIPOS_VACIO para cliente ${clientName}.`);
                     }
                }

                if (!allProductsMap.has(p.id)) {
                    allProductsMap.set(p.id, {
                        ...productoCompleto,
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
                clientData[clientName].products[p.id] += (p.totalUnidadesVendidas || 0);
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
                    const sortedPresentaciones = groupedProducts[rubro][segmento][marca].sort((a,b) => (a.presentacion || '').localeCompare(b.presentacion || ''));
                    finalProductOrder.push(...sortedPresentaciones);
                });
            });
        });

        return { clientData, grandTotalValue, sortedClients, groupedProducts, finalProductOrder, sortedRubros, segmentoOrderMap, vaciosMovementsPorTipo, allProductsMap };
    }

    async function showVerCierreView() {
        _showModal('Progreso', 'Generando reporte de cierre...');
        const ventasSnapshot = await _getDocs(_collection(_db, `artifacts/${_appId}/users/${_userId}/ventas`));
        const ventas = ventasSnapshot.docs.map(doc => doc.data());

        if (ventas.length === 0) {
            _showModal('Aviso', 'No hay ventas para generar un cierre.');
            return;
        }

        const { clientData, grandTotalValue, sortedClients, groupedProducts, finalProductOrder, sortedRubros, segmentoOrderMap, vaciosMovementsPorTipo, allProductsMap } = await processSalesDataForReport(ventas);

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

                    const sortedPresentaciones = groupedProducts[rubro][segmento][marca].sort((a,b) => (a.presentacion||'').localeCompare(b.presentacion||''));
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
                const quantityInUnits = currentClient.products[product.id] || 0;
                let displayQuantity = '';

                if (quantityInUnits > 0) {
                    displayQuantity = `${quantityInUnits} Unds`;
                    const ventaPor = product.ventaPor || {};
                    const unidadesPorCaja = product.unidadesPorCaja || 1;
                    const unidadesPorPaquete = product.unidadesPorPaquete || 1;
                    const isExclusiveCj = ventaPor.cj && !ventaPor.paq && !ventaPor.und;
                    const isExclusivePaq = ventaPor.paq && !ventaPor.cj && !ventaPor.und;

                    if (isExclusiveCj && unidadesPorCaja > 0 && Number.isInteger(quantityInUnits / unidadesPorCaja)) {
                        displayQuantity = `${quantityInUnits / unidadesPorCaja} Cj`;
                    } else if (isExclusivePaq && unidadesPorPaquete > 0 && Number.isInteger(quantityInUnits / unidadesPorPaquete)) {
                         displayQuantity = `${quantityInUnits / unidadesPorPaquete} Paq`;
                    }
                }
                bodyHTML += `<td class="p-1 border text-center">${displayQuantity}</td>`;
            });
            bodyHTML += `<td class="p-1 border text-right font-semibold bg-white sticky right-0 z-10">$${currentClient.totalValue.toFixed(2)}</td></tr>`;
        });

        let footerHTML = '<tr class="bg-gray-200 font-bold"><td class="p-1 border sticky left-0 z-10">TOTALES</td>';
        finalProductOrder.forEach(product => {
            let totalQty = 0;
            sortedClients.forEach(clientName => {
                totalQty += clientData[clientName].products[product.id] || 0;
            });

            let displayTotal = '';
            if (totalQty > 0) {
                displayTotal = `${totalQty} Unds`;
                const ventaPor = product.ventaPor || {};
                const unidadesPorCaja = product.unidadesPorCaja || 1;
                const unidadesPorPaquete = product.unidadesPorPaquete || 1;
                const isExclusiveCj = ventaPor.cj && !ventaPor.paq && !ventaPor.und;
                const isExclusivePaq = ventaPor.paq && !ventaPor.cj && !ventaPor.und;

                if (isExclusiveCj && unidadesPorCaja > 0 && Number.isInteger(totalQty / unidadesPorCaja)) {
                    displayTotal = `${totalQty / unidadesPorCaja} Cj`;
                } else if (isExclusivePaq && unidadesPorPaquete > 0 && Number.isInteger(totalQty / unidadesPorPaquete)) {
                    displayTotal = `${totalQty / unidadesPorPaquete} Paq`;
                }
            }
            footerHTML += `<td class="p-1 border text-center">${displayTotal}</td>`;
        });
        footerHTML += `<td class="p-1 border text-right sticky right-0 z-10">$${grandTotalValue.toFixed(2)}</td></tr>`;

        let vaciosReportHTML = '';
        const clientesConMovimientoVacios = Object.keys(vaciosMovementsPorTipo).filter(cliente =>
            TIPOS_VACIO.some(tipo => (vaciosMovementsPorTipo[cliente][tipo]?.entregados || 0) > 0 || (vaciosMovementsPorTipo[cliente][tipo]?.devueltos || 0) > 0)
        ).sort();

        if (clientesConMovimientoVacios.length > 0) {
            vaciosReportHTML = `
                <h3 class="text-xl font-bold text-gray-800 my-6">Reporte de Envases Retornables (Vacíos)</h3>
                <div class="overflow-auto border">
                    <table class="min-w-full bg-white text-xs">
                        <thead class="bg-gray-200">
                            <tr>
                                <th class="p-1 border text-left">Cliente</th>
                                <th class="p-1 border text-left">Tipo Vacío</th>
                                <th class="p-1 border text-center">Entregados (Cajas)</th>
                                <th class="p-1 border text-center">Devueltos (Cajas)</th>
                                <th class="p-1 border text-center">Neto</th>
                            </tr>
                        </thead>
                        <tbody>`;

            clientesConMovimientoVacios.forEach(cliente => {
                const movimientos = vaciosMovementsPorTipo[cliente];
                TIPOS_VACIO.forEach(tipoVacio => {
                    const mov = movimientos[tipoVacio] || { entregados: 0, devueltos: 0 };
                    if (mov.entregados > 0 || mov.devueltos > 0) {
                        const neto = mov.entregados - mov.devueltos;
                        const netoClass = neto > 0 ? 'text-red-600' : (neto < 0 ? 'text-green-600' : '');
                        vaciosReportHTML += `
                            <tr class="hover:bg-blue-50">
                                <td class="p-1 border">${cliente}</td>
                                <td class="p-1 border">${tipoVacio}</td>
                                <td class="p-1 border text-center">${mov.entregados}</td>
                                <td class="p-1 border text-center">${mov.devueltos}</td>
                                <td class="p-1 border text-center font-bold ${netoClass}">${neto > 0 ? `+${neto}` : neto}</td>
                            </tr>
                        `;
                    }
                });
            });
            vaciosReportHTML += '</tbody></table></div>';
        }

        const reporteHTML = `
            <div class="text-left max-h-[80vh] overflow-auto">
                <h3 class="text-xl font-bold text-gray-800 mb-4">Reporte de Cierre de Ventas</h3>
                <div class="overflow-auto border">
                    <table class="min-w-full bg-white text-xs">
                        <thead class="bg-gray-200">${headerRow1}${headerRow2}${headerRow3}${headerRow4}</thead>
                        <tbody>${bodyHTML}</tbody>
                        <tfoot>${footerHTML}</tfoot>
                    </table>
                </div>
                ${vaciosReportHTML}
            </div>`;
        _showModal('Reporte de Cierre', reporteHTML, null, 'Cerrar');
    }

    async function exportCierreToExcel(ventas) {
        if (typeof XLSX === 'undefined') {
            _showModal('Error', 'La librería para exportar a Excel no está cargada.');
            return;
        }

        const { clientData, grandTotalValue, sortedClients, groupedProducts, finalProductOrder, sortedRubros, segmentoOrderMap, vaciosMovementsPorTipo, allProductsMap } = await processSalesDataForReport(ventas);

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
                    const presentaciones = groupedProducts[rubro][segmento][marca].sort((a,b) => (a.presentacion||'').localeCompare(b.presentacion||''));
                    const marcaColspan = presentaciones.length;
                    rubroColspan += marcaColspan;
                    segmentoColspan += marcaColspan;

                    headerRow3.push(marca);
                    for (let i = 1; i < marcaColspan; i++) headerRow3.push("");
                    if (marcaColspan > 1) merges1.push({ s: { r: 2, c: marcaStartCol }, e: { r: 2, c: marcaStartCol + marcaColspan - 1 } });

                    presentaciones.forEach(p => headerRow4.push(p.presentacion || 'N/A'));
                    currentColumn += marcaColspan;
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
            finalProductOrder.forEach(product => {
                const quantityInUnits = currentClient.products[product.id] || 0;
                let displayQuantity = '';

                if (quantityInUnits > 0) {
                    displayQuantity = `${quantityInUnits} Unds`;
                    const ventaPor = product.ventaPor || {};
                    const unidadesPorCaja = product.unidadesPorCaja || 1;
                    const unidadesPorPaquete = product.unidadesPorPaquete || 1;
                    const isExclusiveCj = ventaPor.cj && !ventaPor.paq && !ventaPor.und;
                    const isExclusivePaq = ventaPor.paq && !ventaPor.cj && !ventaPor.und;

                    if (isExclusiveCj && unidadesPorCaja > 0 && Number.isInteger(quantityInUnits / unidadesPorCaja)) {
                        displayQuantity = `${quantityInUnits / unidadesPorCaja} Cj`;
                    } else if (isExclusivePaq && unidadesPorPaquete > 0 && Number.isInteger(quantityInUnits / unidadesPorPaquete)) {
                         displayQuantity = `${quantityInUnits / unidadesPorPaquete} Paq`;
                    }
                }
                row.push(displayQuantity);
            });
            row.push(Number(currentClient.totalValue.toFixed(2)));
            dataForSheet1.push(row);
        });

        const footerRow = ["TOTALES"];
        finalProductOrder.forEach(product => {
            let totalQty = 0;
            sortedClients.forEach(clientName => totalQty += clientData[clientName].products[product.id] || 0);

            let displayTotal = '';
            if (totalQty > 0) {
                displayTotal = `${totalQty} Unds`;
                const ventaPor = product.ventaPor || {};
                const unidadesPorCaja = product.unidadesPorCaja || 1;
                const unidadesPorPaquete = product.unidadesPorPaquete || 1;
                const isExclusiveCj = ventaPor.cj && !ventaPor.paq && !ventaPor.und;
                const isExclusivePaq = ventaPor.paq && !ventaPor.cj && !ventaPor.und;

                if (isExclusiveCj && unidadesPorCaja > 0 && Number.isInteger(totalQty / unidadesPorCaja)) {
                    displayTotal = `${totalQty / unidadesPorCaja} Cj`;
                } else if (isExclusivePaq && unidadesPorPaquete > 0 && Number.isInteger(totalQty / unidadesPorPaquete)) {
                    displayTotal = `${totalQty / unidadesPorPaquete} Paq`;
                }
            }
            footerRow.push(displayTotal);
        });
        footerRow.push(Number(grandTotalValue.toFixed(2)));
        dataForSheet1.push(footerRow);

        const ws1 = XLSX.utils.aoa_to_sheet(dataForSheet1);
        ws1['!merges'] = merges1;

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws1, 'Reporte de Cierre');

        const clientesConMovimientoVacios = Object.keys(vaciosMovementsPorTipo).filter(cliente =>
            TIPOS_VACIO.some(tipo => (vaciosMovementsPorTipo[cliente][tipo]?.entregados || 0) > 0 || (vaciosMovementsPorTipo[cliente][tipo]?.devueltos || 0) > 0)
        ).sort();

        if (clientesConMovimientoVacios.length > 0) {
            const dataForSheet2 = [['Cliente', 'Tipo Vacío', 'Entregados (Cajas)', 'Devueltos (Cajas)', 'Neto']];
            clientesConMovimientoVacios.forEach(cliente => {
                 const movimientos = vaciosMovementsPorTipo[cliente];
                TIPOS_VACIO.forEach(tipoVacio => {
                    const mov = movimientos[tipoVacio] || { entregados: 0, devueltos: 0 };
                     if(mov.entregados > 0 || mov.devueltos > 0) {
                        const neto = mov.entregados - mov.devueltos;
                        dataForSheet2.push([
                            cliente,
                            tipoVacio,
                            mov.entregados,
                            mov.devueltos,
                            neto
                        ]);
                    }
                });
            });
            const ws2 = XLSX.utils.aoa_to_sheet(dataForSheet2);
            XLSX.utils.book_append_sheet(wb, ws2, 'Reporte de Vacíos');
        }

        const today = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(wb, `Reporte_Cierre_Ventas_${today}.xlsx`);
    }

    async function ejecutarCierre() {
        _showModal('Confirmar Cierre Definitivo',
            'Esta acción generará un reporte en Excel, luego archivará las ventas actuales (en la base de datos) y las eliminará de la lista activa. No se puede deshacer. ¿Continuar?',
            async () => {
                _showModal('Progreso', 'Obteniendo ventas actuales...');
                const ventasRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/ventas`);
                const ventasSnapshot = await _getDocs(ventasRef);
                const ventas = ventasSnapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
                if (ventas.length === 0) {
                    _showModal('Aviso', 'No hay ventas activas para cerrar.');
                    return false;
                }

                try {
                     _showModal('Progreso', 'Generando reporte Excel...');
                    await exportCierreToExcel(ventas);

                     _showModal('Progreso', 'Archivando ventas y eliminando de la lista activa...');
                     const cierreData = {
                         fecha: new Date(),
                         ventas: ventas.map(({id, ...rest}) => rest),
                         total: ventas.reduce((sum, v) => sum + (v.total || 0), 0)
                     };

                     let closingDocRef;
                     if (_userRole === 'user') {
                          const userDocRef = _doc(_db, "users", _userId);
                          const userDoc = await _getDoc(userDocRef);
                          const userData = userDoc.exists() ? userDoc.data() : {};
                          closingDocRef = _doc(_collection(_db, `public_data/${_appId}/user_closings`));
                          cierreData.vendedorInfo = {
                              userId: _userId,
                              nombre: userData.nombre || '',
                              apellido: userData.apellido || '',
                              camion: userData.camion || '',
                              email: userData.email || ''
                          };
                          await _setDoc(closingDocRef, cierreData);
                          console.log(`User closing saved to public_data with ID: ${closingDocRef.id}`);
                     } else {
                          closingDocRef = _doc(_collection(_db, `artifacts/${_appId}/users/${_userId}/cierres`));
                          await _setDoc(closingDocRef, cierreData);
                           console.log(`Admin closing saved to private collection with ID: ${closingDocRef.id}`);
                     }

                    const batch = _writeBatch(_db);
                    let count = 0;
                    const BATCH_LIMIT = 490;
                    ventas.forEach(venta => {
                         batch.delete(_doc(ventasRef, venta.id));
                         count++;
                         if (count >= BATCH_LIMIT) {
                              console.warn("Approaching batch limit during close deletion, consider committing periodically.");
                         }
                    });
                    await batch.commit();

                    _showModal('Éxito', 'El cierre de ventas se ha completado. Reporte descargado, ventas archivadas y eliminadas de la lista activa.', showVentasTotalesView);
                    return true;

                } catch(e) {
                     console.error("Error during closing process:", e);
                    _showModal('Error', `Ocurrió un error durante el cierre: ${e.message}`);
                    return false;
                }
            },
            'Sí, Ejecutar Cierre',
             null,
             true
        );
    }

    function showOrdenarCierreView() {
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl">
                        <h2 class="text-2xl font-bold text-gray-800 mb-4 text-center">Orden de Rubros y Segmentos (Reportes)</h2>
                        <p class="text-center text-gray-600 mb-6">Arrastra y suelta para cambiar el orden en que aparecen en los reportes de cierre. El orden de Segmentos es global (igual que en Inventario).</p>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div>
                                <h3 class="text-xl font-semibold mb-4 text-center">Orden de Rubros</h3>
                                <ul id="rubros-sortable-list" class="space-y-2 border rounded-lg p-4 max-h-96 overflow-y-auto bg-gray-50">
                                    <p class="text-gray-500 text-center">Cargando rubros...</p>
                                </ul>
                            </div>
                            <div>
                                <h3 class="text-xl font-semibold mb-4 text-center">Orden de Segmentos (Global)</h3>
                                <ul id="segmentos-sortable-list" class="space-y-2 border rounded-lg p-4 max-h-96 overflow-y-auto bg-gray-50">
                                    <p class="text-gray-500 text-center">Cargando segmentos globales...</p>
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
        renderSegmentosForOrderingGlobal();
    }

    async function renderRubrosForOrdering() {
        const container = document.getElementById('rubros-sortable-list');
        if (!container) return;
        container.innerHTML = `<p class="text-gray-500 text-center">Cargando...</p>`;

        try {
            const collectionRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/rubros`);
            let snapshot = await _getDocs(collectionRef);
            let items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            const itemsWithoutOrder = items.filter(item => item.orden === undefined || item.orden === null);
            if (itemsWithoutOrder.length > 0) {
                 console.log("Assigning initial order to rubros...");
                const itemsWithOrder = items.filter(item => item.orden !== undefined && item.orden !== null);
                const maxOrder = itemsWithOrder.reduce((max, item) => Math.max(max, item.orden ?? -1), -1);
                const batch = _writeBatch(_db);
                itemsWithoutOrder.sort((a,b) => (a.name || '').localeCompare(b.name || ''));
                itemsWithoutOrder.forEach((item, index) => {
                    const docRef = _doc(collectionRef, item.id);
                    const newOrder = maxOrder + 1 + index;
                    batch.update(docRef, { orden: newOrder });
                    item.orden = newOrder;
                });
                await batch.commit();
                items = [...itemsWithOrder, ...itemsWithoutOrder];
                 console.log("Initial order assigned to rubros.");
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
                li.className = 'p-3 bg-gray-100 rounded shadow-sm cursor-grab active:cursor-grabbing hover:bg-gray-200';
                li.textContent = item.name;
                li.draggable = true;
                container.appendChild(li);
            });
            addDragAndDropHandlers(container);
        } catch (error) {
            console.error(`Error al renderizar la lista de rubros:`, error);
            container.innerHTML = `<p class="text-red-500 text-center">Error al cargar datos.</p>`;
        }
    }

     async function renderSegmentosForOrderingGlobal() {
        const container = document.getElementById('segmentos-sortable-list');
        if (!container) return;
        container.innerHTML = `<p class="text-gray-500 text-center">Cargando segmentos globales...</p>`;

        try {
            const collectionRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/segmentos`);
            let snapshot = await _getDocs(collectionRef);
            let items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            const itemsWithoutOrder = items.filter(item => item.orden === undefined || item.orden === null);
            if (itemsWithoutOrder.length > 0) {
                 console.log("Assigning initial order to global segments...");
                const itemsWithOrder = items.filter(item => item.orden !== undefined && item.orden !== null);
                const maxOrder = itemsWithOrder.reduce((max, item) => Math.max(max, item.orden ?? -1), -1);
                const batch = _writeBatch(_db);
                itemsWithoutOrder.sort((a,b) => (a.name || '').localeCompare(b.name || ''));
                itemsWithoutOrder.forEach((item, index) => {
                    const docRef = _doc(collectionRef, item.id);
                    const newOrder = maxOrder + 1 + index;
                    batch.update(docRef, { orden: newOrder });
                    item.orden = newOrder;
                });
                await batch.commit();
                items = [...itemsWithOrder, ...itemsWithoutOrder];
                 console.log("Initial order assigned to global segments.");
            }

            items.sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999));
            container.innerHTML = '';

            if (items.length === 0) {
                container.innerHTML = `<p class="text-gray-500 text-center">No hay segmentos definidos.</p>`;
                return;
            }

            items.forEach(item => {
                const li = document.createElement('li');
                li.dataset.id = item.id;
                li.dataset.name = item.name;
                li.className = 'p-3 bg-gray-100 rounded shadow-sm cursor-grab active:cursor-grabbing hover:bg-gray-200';
                li.textContent = item.name;
                li.draggable = true;
                container.appendChild(li);
            });
            addDragAndDropHandlers(container);

        } catch (error) {
            console.error(`Error al renderizar la lista global de segmentos:`, error);
            container.innerHTML = `<p class="text-red-500 text-center">Error al cargar datos.</p>`;
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
                 setTimeout(() => { if(draggedItem) draggedItem.style.opacity = '0.5'; }, 0);
             }
        });
        container.addEventListener('dragend', e => {
            if(draggedItem) draggedItem.style.opacity = '1';
            draggedItem = null;
            if (placeholder && placeholder.parentNode) placeholder.parentNode.removeChild(placeholder);
        });
        container.addEventListener('dragover', e => {
            e.preventDefault();
            const afterElement = getDragAfterElement(container, e.clientY);
            if (draggedItem) {
                 if (!placeholder) createPlaceholder();
                if (afterElement == null) container.appendChild(placeholder);
                else container.insertBefore(placeholder, afterElement);
            }
        });
         container.addEventListener('drop', e => {
              e.preventDefault();
              if (draggedItem && placeholder && placeholder.parentNode) {
                  container.insertBefore(draggedItem, placeholder);
                  draggedItem.style.opacity = '1';
              }
              if (placeholder && placeholder.parentNode) placeholder.parentNode.removeChild(placeholder);
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
                 if (offset < 0 && offset > closest.offset) return { offset: offset, element: child };
                 else return closest;
             }, { offset: Number.NEGATIVE_INFINITY }).element;
        }
    }

    async function handleGuardarOrdenCierre() {
        const rubrosListItems = document.querySelectorAll('#rubros-sortable-list li');
        const segmentosListItems = document.querySelectorAll('#segmentos-sortable-list li');

        const batch = _writeBatch(_db);
        let rubroChanges = false;
        let segmentoChanges = false;
        const rubroIdsInOrder = [];
        const segmentoIdsInOrder = [];

        rubrosListItems.forEach((item, index) => {
            const docRef = _doc(_db, `artifacts/${_appId}/users/${_userId}/rubros`, item.dataset.id);
            batch.update(docRef, { orden: index });
            rubroChanges = true;
            rubroIdsInOrder.push(item.dataset.id);
        });

        segmentosListItems.forEach((item, index) => {
            const docRef = _doc(_db, `artifacts/${_appId}/users/${_userId}/segmentos`, item.dataset.id);
            batch.update(docRef, { orden: index });
            segmentoChanges = true;
            segmentoIdsInOrder.push(item.dataset.id);
        });

        if (!rubroChanges && !segmentoChanges) {
            _showModal('Aviso', 'No se detectaron cambios en el orden.');
            return;
        }

        _showModal('Progreso', 'Guardando nuevo orden...');

        try {
            await batch.commit();
            _rubroOrderCacheVentas = null;
            _segmentoOrderCacheVentas = null;
            if(window.inventarioModule?.invalidateCache) window.inventarioModule.invalidateCache();
            if(window.catalogoModule?.invalidateCache) window.catalogoModule.invalidateCache();

            _showModal('Progreso', 'Orden guardado localmente. Propagando cambios...');

            let propagationSuccess = true;
            if (rubroChanges && window.adminModule?.propagateCategoryOrderChange) {
                 try {
                     await window.adminModule.propagateCategoryOrderChange('rubros', rubroIdsInOrder);
                 } catch (e) { propagationSuccess = false; console.error("Error propagating rubro order:", e); }
            }
            if (segmentoChanges && window.adminModule?.propagateCategoryOrderChange) {
                 try {
                     await window.adminModule.propagateCategoryOrderChange('segmentos', segmentoIdsInOrder);
                 } catch (e) { propagationSuccess = false; console.error("Error propagating segmento order:", e); }
            }

            if (propagationSuccess) {
                 _showModal('Éxito', 'El orden para los reportes ha sido guardado y propagado.', showVentasTotalesView);
            } else {
                 _showModal('Advertencia', 'Orden guardado localmente, pero hubo errores al propagar. Revisa la consola.', showVentasTotalesView);
            }

        } catch (error) {
            console.error("Error guardando el orden:", error);
            _showModal('Error', `Hubo un error al guardar el nuevo orden: ${error.message}`);
        }
    }

    function showPastSaleOptions(ventaId, tipo = 'ticket') {
        const venta = _ventasGlobal.find(v => v.id === ventaId);
        if (venta) {
            const productosParaTicket = venta.productos || [];
            showSharingOptions(venta, productosParaTicket, venta.vaciosDevueltosPorTipo || {}, 'Nota de Entrega', () => {});
        } else {
            _showModal('Error', 'No se encontró la venta seleccionada.');
        }
    }

    function editVenta(ventaId) {
        const venta = _ventasGlobal.find(v => v.id === ventaId);
        if (!venta) {
            _showModal('Error', 'No se pudo encontrar la venta para editar.');
            return;
        }
        _originalVentaForEdit = JSON.parse(JSON.stringify(venta));
        showEditVentaView(venta);
    }

    function deleteVenta(ventaId) {
        const venta = _ventasGlobal.find(v => v.id === ventaId);
        if (!venta) {
            _showModal('Error', 'No se pudo encontrar la venta para eliminar.');
            return;
        }

        _showModal(
            'Confirmar Eliminación',
            `¿Estás seguro de que deseas eliminar la venta a "${venta.clienteNombre}" del ${venta.fecha?.toDate ? venta.fecha.toDate().toLocaleDateString('es-ES') : 'Fecha desconocida'}? El stock y los saldos de vacíos serán restaurados.`,
            async () => {
                _showModal('Progreso', 'Eliminando venta y restaurando datos...');
                try {
                    const batch = _writeBatch(_db);
                    const vaciosAdjustmentsPorTipo = {};

                    for (const productoVendido of (venta.productos || [])) {
                        const productoRef = _doc(_db, `artifacts/${_appId}/users/${_userId}/inventario`, productoVendido.id);
                        const productoDoc = await _getDoc(productoRef);

                        if (productoDoc.exists()) {
                            const productoActual = productoDoc.data();
                            const unidadesADevolver = productoVendido.totalUnidadesVendidas || 0;
                            if (unidadesADevolver > 0) {
                                const nuevoStockUnidades = (productoActual.cantidadUnidades || 0) + unidadesADevolver;
                                batch.update(productoRef, { cantidadUnidades: nuevoStockUnidades });
                                 console.log(`Restoring ${unidadesADevolver} units for ${productoVendido.presentacion}`);
                            }

                            if (productoActual.manejaVacios && productoActual.tipoVacio) {
                                const tipoVacio = productoActual.tipoVacio;
                                const cajasVendidas = productoVendido.cantidadVendida?.cj || 0;
                                if (cajasVendidas > 0) {
                                    vaciosAdjustmentsPorTipo[tipoVacio] = (vaciosAdjustmentsPorTipo[tipoVacio] || 0) - cajasVendidas;
                                }
                            }
                        } else {
                             console.warn(`Producto ${productoVendido.id} (${productoVendido.presentacion}) no encontrado en inventario al eliminar venta. No se ajustó stock.`);
                        }
                    }

                    const vaciosDevueltosEnVenta = venta.vaciosDevueltosPorTipo || {};
                    for(const tipoVacio in vaciosDevueltosEnVenta) {
                        const devueltos = vaciosDevueltosEnVenta[tipoVacio] || 0;
                        if(devueltos > 0) {
                             vaciosAdjustmentsPorTipo[tipoVacio] = (vaciosAdjustmentsPorTipo[tipoVacio] || 0) + devueltos;
                        }
                    }

                    if (Object.values(vaciosAdjustmentsPorTipo).some(adj => adj !== 0)) {
                         const clienteRef = _doc(_db, `artifacts/ventas-9a210/public/data/clientes`, venta.clienteId);
                         try {
                             await _runTransaction(_db, async (transaction) => {
                                const clienteDoc = await transaction.get(clienteRef);
                                if (!clienteDoc.exists()) {
                                     console.warn(`Cliente ${venta.clienteId} no encontrado al revertir saldos de vacíos.`);
                                     return;
                                }

                                const clienteData = clienteDoc.data();
                                const saldoVacios = clienteData.saldoVacios || {};

                                for (const tipoVacio in vaciosAdjustmentsPorTipo) {
                                    const adjustment = vaciosAdjustmentsPorTipo[tipoVacio];
                                    if (adjustment !== 0) {
                                        const saldoActual = saldoVacios[tipoVacio] || 0;
                                        saldoVacios[tipoVacio] = saldoActual + adjustment;
                                    }
                                }

                                transaction.update(clienteRef, { saldoVacios: saldoVacios });
                            });
                             console.log("Saldos de vacíos revertidos para cliente:", venta.clienteId);
                         } catch (transError) {
                              console.error(`Error revirtiendo saldos de vacíos para cliente ${venta.clienteId}:`, transError);
                         }
                    }

                    const ventaRef = _doc(_db, `artifacts/${_appId}/users/${_userId}/ventas`, ventaId);
                    batch.delete(ventaRef);

                    await batch.commit();
                    _showModal('Éxito', 'La venta ha sido eliminada y los datos restaurados.');

                } catch (error) {
                     console.error("Error al eliminar venta:", error);
                    _showModal('Error', `Hubo un error al eliminar la venta: ${error.message}`);
                }
            },
            'Sí, Eliminar',
             null,
             true
        );
    }

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
                            <p class="text-gray-700"><span class="font-medium">Cliente:</span> <span class="font-bold">${venta.clienteNombre || 'N/A'}</span></p>
                            <p class="text-gray-700 text-sm"><span class="font-medium">Fecha Original:</span> ${venta.fecha?.toDate ? venta.fecha.toDate().toLocaleString('es-ES') : 'N/A'}</p>
                        </div>
                    </div>
                    <div id="vacios-devueltos-section" class="mb-4">
                         <h3 class="text-sm font-semibold text-cyan-700 mb-1">Vacíos Devueltos (Ajustar si es necesario):</h3>
                         <div class="grid grid-cols-3 gap-2">
                            ${TIPOS_VACIO.map(tipo => `
                                <div class="flex flex-col items-center">
                                    <label for="vacios-${tipo.replace(/\s+/g, '-')}" class="text-xs font-medium text-gray-600 mb-1">${tipo}</label>
                                    <input type="number" min="0" value="${venta.vaciosDevueltosPorTipo ? (venta.vaciosDevueltosPorTipo[tipo] || 0) : 0}" id="vacios-${tipo.replace(/\s+/g, '-')}"
                                           class="w-16 p-1 text-center border rounded-md"
                                           data-tipo-vacio="${tipo}" oninput="window.ventasModule.handleTipoVacioChange(event)">
                                </div>
                            `).join('')}
                         </div>
                    </div>
                    <div id="inventarioTableContainer" class="animate-fade-in flex-grow flex flex-col overflow-hidden">
                         <div class="mb-2">
                             <label for="rubroFilter" class="text-xs font-medium">Filtrar Rubro:</label>
                             <select id="rubroFilter" class="w-full px-2 py-1 border rounded-lg text-sm"><option value="">Todos los Rubros</option></select>
                         </div>
                        <div class="overflow-auto flex-grow rounded-lg shadow">
                            <table class="min-w-full bg-white text-xs"><thead class="bg-gray-200 sticky top-0 z-10"><tr class="text-gray-700 uppercase leading-normal">
                                <th class="py-2 px-1 text-center">Cant.</th>
                                <th class="py-2 px-2 text-left">Producto</th>
                                <th class="py-2 px-2 text-left price-toggle" onclick="window.ventasModule.toggleMoneda()">Precio</th>
                                <th class="py-2 px-1 text-center">Stock Disp.</th>
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
                productos: (venta.productos || []).reduce((acc, p) => {
                    const productoCompleto = _inventarioCache.find(inv => inv.id === p.id) || p;
                    const cant = p.cantidadVendida || {};
                    acc[p.id] = {
                        ...productoCompleto,
                        cantCj: cant.cj || 0,
                        cantPaq: cant.paq || 0,
                        cantUnd: cant.und || 0,
                        totalUnidadesVendidas: p.totalUnidadesVendidas || 0
                    };
                    return acc;
                }, {}),
                vaciosDevueltosPorTipo: venta.vaciosDevueltosPorTipo || {}
            };
            TIPOS_VACIO.forEach(tipo => {
                 if (!_ventaActual.vaciosDevueltosPorTipo[tipo]) {
                     _ventaActual.vaciosDevueltosPorTipo[tipo] = 0;
                 }
            });

            document.getElementById('rubroFilter').addEventListener('change', renderEditVentasInventario);
            populateRubroFilter();
            document.getElementById('rubroFilter').value = '';

            renderEditVentasInventario();
            updateVentaTotal();

            document.getElementById('modalContainer').classList.add('hidden');

        } catch (error) {
            console.error("Error loading data for edit:", error);
            _showModal('Error', `No se pudo cargar la información para editar: ${error.message}`);
             showVentasActualesView();
        }
    }

     async function renderEditVentasInventario() {
        const inventarioTableBody = document.getElementById('inventarioTableBody');
        const rubroFilter = document.getElementById('rubroFilter');
        if (!inventarioTableBody || !rubroFilter) return;

        inventarioTableBody.innerHTML = `<tr><td colspan="4" class="py-3 px-6 text-center text-gray-500">Cargando inventario para edición...</td></tr>`;

        const selectedRubro = rubroFilter.value;

        let inventarioToShow = _inventarioCache.filter(p =>
             _originalVentaForEdit.productos.some(origP => origP.id === p.id) || (p.cantidadUnidades || 0) > 0
        );

        if (selectedRubro) {
            inventarioToShow = inventarioToShow.filter(p => p.rubro === selectedRubro);
        }

        const segmentoOrderMap = await getSegmentoOrderMapVentas();
        if (segmentoOrderMap) {
            inventarioToShow.sort((a, b) => {
                 const orderA = segmentoOrderMap[a.segmento] ?? 9999;
                 const orderB = segmentoOrderMap[b.segmento] ?? 9999;
                 if (orderA !== orderB) return orderA - orderB;
                 const marcaComp = (a.marca || '').localeCompare(b.marca || '');
                 if (marcaComp !== 0) return marcaComp;
                 return (a.presentacion || '').localeCompare(b.presentacion || '');
            });
        } else {
             inventarioToShow.sort((a, b) => (a.presentacion || '').localeCompare(b.presentacion || ''));
        }

        inventarioTableBody.innerHTML = '';
        if (inventarioToShow.length === 0) {
            inventarioTableBody.innerHTML = `<tr><td colspan="4" class="py-3 px-6 text-center text-gray-500">No hay productos ${selectedRubro ? 'en este rubro' : ''}.</td></tr>`;
            return;
        }

        let currentSegmento = null;
        let currentMarca = null;

        inventarioToShow.forEach(producto => {
            const segmento = producto.segmento || 'Sin Segmento';
            const marca = producto.marca || 'Sin Marca';

            if (segmento !== currentSegmento) {
                 currentSegmento = segmento; currentMarca = null;
                 const segRow = document.createElement('tr');
                 segRow.innerHTML = `<td colspan="4" class="py-1 px-2 bg-gray-100 font-bold text-gray-700 text-base">${segmento}</td>`;
                 inventarioTableBody.appendChild(segRow);
             }
            if (marca !== currentMarca) {
                 currentMarca = marca;
                 const marRow = document.createElement('tr');
                 marRow.innerHTML = `<td colspan="4" class="py-1 px-4 bg-gray-50 font-semibold text-gray-600 text-sm">${marca}</td>`;
                 inventarioTableBody.appendChild(marRow);
             }

            const ventaPor = producto.ventaPor || { und: true };
            const ventaActualProd = _ventaActual.productos[producto.id] || {};
            const originalVentaProd = _originalVentaForEdit.productos.find(p => p.id === producto.id);
            const precios = producto.precios || { und: producto.precioPorUnidad || 0 };

            const formatPrice = (value) => {
                if (isNaN(value)) value = 0;
                if (_monedaActual === 'COP' && _tasaCOP > 0) return `COP ${(Math.ceil((value * _tasaCOP) / 100) * 100).toLocaleString('es-CO')}`;
                if (_monedaActual === 'Bs' && _tasaBs > 0) return `Bs.S ${(value * _tasaBs).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                return `$${value.toFixed(2)}`;
            };

            const createEditRow = (tipo, currentCant, precioTipo, descTipo) => {
                 const currentStockUnits = producto.cantidadUnidades || 0;
                 const originalUnitsSoldTipo = originalVentaProd?.cantidadVendida?.[tipo] || 0;
                 let conversionFactor = tipo === 'cj' ? (producto.unidadesPorCaja || 1) : tipo === 'paq' ? (producto.unidadesPorPaquete || 1) : 1;
                 const maxUnitsAvailableForThisType = currentStockUnits + (originalUnitsSoldTipo * conversionFactor);
                 const maxInputType = Math.floor(maxUnitsAvailableForThisType / conversionFactor);
                 const stockDisplayTipo = Math.floor(currentStockUnits / conversionFactor);

                const row = document.createElement('tr');
                row.classList.add('border-b', 'border-gray-200', 'hover:bg-gray-50');
                row.innerHTML = `
                    <td class="py-2 px-1 text-center align-middle">
                        <input type="number" min="0" max="${maxInputType}" value="${currentCant}" class="w-16 p-1 text-center border rounded-md" data-product-id="${producto.id}" data-tipo-venta="${tipo}" oninput="window.ventasModule.handleQuantityChange(event)">
                    </td>
                    <td class="py-2 px-2 text-left align-middle">${descTipo}</td>
                    <td class="py-2 px-2 text-left align-middle font-semibold price-toggle" onclick="window.ventasModule.toggleMoneda()">${formatPrice(precioTipo)}</td>
                    <td class="py-2 px-1 text-center align-middle">${stockDisplayTipo} ${tipo.toUpperCase()}</td>
                `;
                inventarioTableBody.appendChild(row);
            };

             if (ventaPor.cj) {
                 const unidadesPorCaja = producto.unidadesPorCaja || 1;
                 createEditRow('cj', ventaActualProd.cantCj || 0, precios.cj || 0, `${producto.presentacion} (Cj/${unidadesPorCaja} und)`);
             }
             if (ventaPor.paq) {
                 const unidadesPorPaquete = producto.unidadesPorPaquete || 1;
                 createEditRow('paq', ventaActualProd.cantPaq || 0, precios.paq || 0, `${producto.presentacion} (Paq/${unidadesPorPaquete} und)`);
             }
             if (ventaPor.und) {
                 createEditRow('und', ventaActualProd.cantUnd || 0, precios.und || 0, `${producto.presentacion} (Und)`);
             }
        });
        updateVentaTotal();
    }

    async function handleGuardarVentaEditada() {
        if (!_originalVentaForEdit) {
            _showModal('Error', 'No se pudo encontrar la venta original para guardar los cambios.');
            return;
        }

         const productosEnTransaccion = Object.values(_ventaActual.productos).filter(p => p.totalUnidadesVendidas > 0);
        const hayVaciosDevueltos = Object.values(_ventaActual.vaciosDevueltosPorTipo).some(cant => cant > 0);
        if (productosEnTransaccion.length === 0 && !hayVaciosDevueltos) {
            _showModal('Error', 'La venta editada debe tener al menos un producto o un vacío devuelto para poder guardarla.');
            return;
        }

        _showModal('Confirmar Cambios', '¿Deseas guardar los cambios? El stock y los saldos de vacíos se ajustarán automáticamente.', async () => {
            _showModal('Progreso', 'Guardando cambios y ajustando datos...');

            try {
                const batch = _writeBatch(_db);
                const originalProducts = new Map((_originalVentaForEdit.productos || []).map(p => [p.id, p]));
                const newProducts = new Map(Object.values(_ventaActual.productos).map(p => [p.id, p]));
                const allProductIds = new Set([...originalProducts.keys(), ...newProducts.keys()]);

                const vaciosAdjustmentsPorTipo = {};

                for (const productId of allProductIds) {
                    const originalProductVenta = originalProducts.get(productId);
                    const newProductVenta = newProducts.get(productId);
                    const productoEnCache = _inventarioCache.find(p => p.id === productId);

                    if (!productoEnCache) {
                         console.warn(`Producto ${productId} no encontrado en caché durante la edición. No se ajustó stock.`);
                         continue;
                    }

                    const originalUnitsSold = originalProductVenta ? (originalProductVenta.totalUnidadesVendidas || 0) : 0;
                    const newUnitsSold = newProductVenta ? (newProductVenta.totalUnidadesVendidas || 0) : 0;
                    const unitDelta = originalUnitsSold - newUnitsSold;

                    if (unitDelta !== 0) {
                        const currentStockUnits = productoEnCache.cantidadUnidades || 0;
                        const finalStockUnits = currentStockUnits + unitDelta;

                        if (finalStockUnits < 0) {
                            throw new Error(`Stock insuficiente para "${productoEnCache.presentacion}" al intentar guardar cambios (${finalStockUnits} und).`);
                        }
                        const productoRef = _doc(_db, `artifacts/${_appId}/users/${_userId}/inventario`, productId);
                        batch.update(productoRef, { cantidadUnidades: finalStockUnits });
                         console.log(`Adjusting stock for ${productoEnCache.presentacion} by ${unitDelta}. New stock: ${finalStockUnits}`);
                    }
                }

                const originalVaciosPorTipoDevueltos = _originalVentaForEdit.vaciosDevueltosPorTipo || {};
                const nuevosVaciosPorTipoDevueltos = _ventaActual.vaciosDevueltosPorTipo || {};

                TIPOS_VACIO.forEach(tipo => vaciosAdjustmentsPorTipo[tipo] = 0);

                 for (const productId of allProductIds) {
                    const originalProductVenta = originalProducts.get(productId);
                    const newProductVenta = newProducts.get(productId);
                    const productoEnCache = _inventarioCache.find(p => p.id === productId);

                    if (!productoEnCache || !productoEnCache.manejaVacios || !productoEnCache.tipoVacio) continue;

                    const tipoVacio = productoEnCache.tipoVacio;
                    const originalCajasEntregadas = originalProductVenta?.cantidadVendida?.cj || 0;
                    const nuevasCajasEntregadas = newProductVenta?.cantCj || 0;
                    const deltaCajasEntregadas = nuevasCajasEntregadas - originalCajasEntregadas;

                     if (vaciosAdjustmentsPorTipo.hasOwnProperty(tipoVacio)) {
                        vaciosAdjustmentsPorTipo[tipoVacio] += deltaCajasEntregadas;
                     }
                }

                 TIPOS_VACIO.forEach(tipo => {
                     const originalDevueltos = originalVaciosPorTipoDevueltos[tipo] || 0;
                     const nuevosDevueltos = nuevosVaciosPorTipoDevueltos[tipo] || 0;
                     const deltaDevueltos = nuevosDevueltos - originalDevueltos;
                      if (vaciosAdjustmentsPorTipo.hasOwnProperty(tipo)) {
                        vaciosAdjustmentsPorTipo[tipo] -= deltaDevueltos;
                      }
                 });

                if (Object.values(vaciosAdjustmentsPorTipo).some(adj => adj !== 0)) {
                    const clienteRef = _doc(_db, `artifacts/ventas-9a210/public/data/clientes`, _originalVentaForEdit.clienteId);
                    try {
                        await _runTransaction(_db, async (transaction) => {
                            const clienteDoc = await transaction.get(clienteRef);
                            if (!clienteDoc.exists()) {
                                 console.warn(`Cliente ${_originalVentaForEdit.clienteId} no encontrado al ajustar saldos de vacíos durante edición.`);
                                 return;
                            }

                            const clienteData = clienteDoc.data();
                            const saldoVacios = clienteData.saldoVacios || {};

                            for (const tipoVacio in vaciosAdjustmentsPorTipo) {
                                const adjustment = vaciosAdjustmentsPorTipo[tipoVacio];
                                if (adjustment !== 0 && saldoVacios.hasOwnProperty(tipoVacio)) {
                                    const saldoActual = saldoVacios[tipoVacio] || 0;
                                    saldoVacios[tipoVacio] = saldoActual + adjustment;
                                }
                            }
                            transaction.update(clienteRef, { saldoVacios: saldoVacios });
                        });
                         console.log("Saldos de vacíos ajustados para cliente:", _originalVentaForEdit.clienteId);
                    } catch (transError) {
                         console.error(`Error ajustando saldos de vacíos para cliente ${_originalVentaForEdit.clienteId}:`, transError);
                         _showModal('Advertencia', 'No se pudieron ajustar los saldos de vacíos del cliente.');
                    }
                }

                let nuevoTotal = 0;
                const nuevosItemsVenta = Object.values(_ventaActual.productos)
                    .filter(p => p.totalUnidadesVendidas > 0)
                    .map(p => {
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
                            ventaPor: p.ventaPor,
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
                            tipoVacio: p.tipoVacio || null,
                        };
                    });

                const ventaRef = _doc(_db, `artifacts/${_appId}/users/${_userId}/ventas`, _originalVentaForEdit.id);
                batch.update(ventaRef, {
                    productos: nuevosItemsVenta,
                    total: nuevoTotal,
                    vaciosDevueltosPorTipo: _ventaActual.vaciosDevueltosPorTipo,
                    fechaModificacion: new Date()
                });

                await batch.commit();

                _originalVentaForEdit = null;
                _showModal('Éxito', 'La venta se ha actualizado correctamente.', showVentasActualesView);

            } catch (error) {
                 console.error("Error saving edited sale:", error);
                _showModal('Error', `Hubo un error al guardar los cambios: ${error.message}`);
            }
        }, 'Sí, Guardar', null, true);
    }

    window.ventasModule = {
        toggleMoneda,
        handleQuantityChange,
        handleTipoVacioChange,
        showPastSaleOptions,
        editVenta,
        deleteVenta,
        invalidateCache: () => {
            _segmentoOrderCacheVentas = null;
            _rubroOrderCacheVentas = null;
        }
    };
})();

