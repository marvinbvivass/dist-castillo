(function() {
    let _db, _userId, _userRole, _appId, _mainContent, _floatingControls;
    let _showMainMenu, _showModal, _activeListeners;
    let _collection, _onSnapshot, _doc, _getDoc, _addDoc, _setDoc, _deleteDoc, _getDocs, _writeBatch, _runTransaction, _query, _where;

    let _clientesCache = [];
    let _inventarioCache = [];
    let _ventasGlobal = [];
    // ELIMINADO: Cachés de ordenamiento local
    // let _segmentoOrderCacheVentas = null;
    // let _rubroOrderCacheVentas = null;
    let _ventaActual = { cliente: null, productos: {}, vaciosDevueltosPorTipo: {} };
    let _originalVentaForEdit = null;
    let _tasaCOP = 0;
    let _tasaBs = 0;
    let _monedaActual = 'USD';

    const TIPOS_VACIO = ["1/4 - 1/3", "ret 350 ml", "ret 1.25 Lts"];

    // ELIMINADO: Funciones getRubroOrderMap y getSegmentoOrderMapVentas globales (se moverán localmente a processSalesDataForReport si es necesario)

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
                            <label for="clienteSearch" class="block text-gray-700 font-medium mb-2">Cliente:</label>
                            <div class="relative"><input type="text" id="clienteSearch" placeholder="Buscar..." class="w-full px-4 py-2 border rounded-lg"><div id="clienteDropdown" class="autocomplete-list hidden"></div></div>
                        </div>
                        <div id="client-display-container" class="hidden flex-wrap items-center justify-between gap-2">
                            <p class="text-gray-700 flex-grow text-sm"><span class="font-medium">Cliente:</span> <span id="selected-client-name" class="font-bold"></span></p>
                            <div id="tasasContainer" class="flex flex-row items-center gap-2">
                                <div class="flex items-center space-x-1"> <label for="tasaCopInput" class="text-xs">COP:</label> <input type="number" id="tasaCopInput" placeholder="4000" class="w-16 px-1 py-1 text-sm border rounded-lg"> </div>
                                <div class="flex items-center space-x-1"> <label for="tasaBsInput" class="text-xs">Bs.:</label> <input type="number" id="tasaBsInput" placeholder="36.5" class="w-16 px-1 py-1 text-sm border rounded-lg"> </div>
                            </div>
                        </div>
                    </div>
                    <div id="vacios-devueltos-section" class="mb-2 hidden">
                         <h3 class="text-sm font-semibold text-cyan-700 mb-1">Vacíos Devueltos:</h3>
                         <div class="grid grid-cols-3 gap-2">
                            ${TIPOS_VACIO.map(tipo => `
                                <div> <label for="vacios-${tipo.replace(/\s+/g, '-')}" class="text-xs mb-1 block">${tipo}</label> <input type="number" min="0" value="0" id="vacios-${tipo.replace(/\s+/g, '-')}" class="w-16 p-1 text-center border rounded-md" data-tipo-vacio="${tipo}" oninput="window.ventasModule.handleTipoVacioChange(event)"> </div>
                            `).join('')}
                         </div>
                    </div>
                    <div id="inventarioTableContainer" class="hidden animate-fade-in flex-grow flex flex-col overflow-hidden">
                         <div id="rubro-filter-container" class="mb-2">
                             <label for="rubroFilter" class="text-xs font-medium">Filtrar Rubro:</label>
                             <select id="rubroFilter" class="w-full px-2 py-1 border rounded-lg text-sm"><option value="">Todos</option></select>
                         </div>
                        <div class="overflow-auto flex-grow rounded-lg shadow">
                            <table class="min-w-full bg-white text-sm"><thead class="bg-gray-200 sticky top-0"><tr class="uppercase text-xs"><th class="py-2 px-2 text-center w-24">Cant</th><th class="py-2 px-2 text-left">Producto</th><th class="py-2 px-2 text-left price-toggle" onclick="window.ventasModule.toggleMoneda()">Precio</th><th class="py-2 px-1 text-center">Stock</th></tr></thead><tbody id="inventarioTableBody" class="text-gray-600"></tbody></table>
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
        if (savedTasa) { _tasaCOP = parseFloat(savedTasa); document.getElementById('tasaCopInput').value = _tasaCOP; }
        const savedTasaBs = localStorage.getItem('tasaBs');
        if (savedTasaBs) { _tasaBs = parseFloat(savedTasaBs); document.getElementById('tasaBsInput').value = _tasaBs; }

        document.getElementById('tasaCopInput').addEventListener('input', (e) => { _tasaCOP = parseFloat(e.target.value) || 0; localStorage.setItem('tasaCOP', _tasaCOP); if (_monedaActual === 'COP') { renderVentasInventario(); updateVentaTotal(); } });
        document.getElementById('tasaBsInput').addEventListener('input', (e) => { _tasaBs = parseFloat(e.target.value) || 0; localStorage.setItem('tasaBs', _tasaBs); if (_monedaActual === 'Bs') { renderVentasInventario(); updateVentaTotal(); } });
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
            if (window.isLoggingOut && error.code === 'permission-denied') { return; }
            console.error("Error cargando clientes:", error);
        });

        const inventarioRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`);
        const unsubInventario = _onSnapshot(inventarioRef, (snapshot) => {
            _inventarioCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            populateRubroFilter();
            if (_ventaActual.cliente) { renderVentasInventario(); } // Renderizar si ya hay cliente seleccionado
        }, (error) => {
            if (window.isLoggingOut && error.code === 'permission-denied') { return; }
             console.error("Error cargando inventario:", error);
             const body = document.getElementById('inventarioTableBody');
             if(body) body.innerHTML = '<tr><td colspan="4" class="py-3 px-6 text-center text-red-500">Error al cargar inventario.</td></tr>';
        });
        _activeListeners.push(unsubClientes, unsubInventario);
    }

    function populateRubroFilter() {
        const rubroFilter = document.getElementById('rubroFilter');
        if(!rubroFilter) return;
        const rubros = [...new Set(_inventarioCache.map(p => p.rubro))].sort();
        const currentVal = rubroFilter.value;
        rubroFilter.innerHTML = '<option value="">Todos</option>';
        rubros.forEach(rubro => { if(rubro) rubroFilter.innerHTML += `<option value="${rubro}">${rubro}</option>`; });
        rubroFilter.value = rubros.includes(currentVal) ? currentVal : '';
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
                renderVentasInventario(); updateVentaTotal(); return;
            }
            nextIndex = (nextIndex + 1) % cycle.length;
        }
        if (_tasaCOP <= 0 && _tasaBs <= 0) _showModal('Aviso', 'Ingresa tasas COP y/o Bs. para alternar.');
        else _showModal('Aviso', 'Ingresa al menos una tasa válida (> 0).');
    }

    // MODIFICADO: Usa la función de ordenamiento global
    async function renderVentasInventario() {
        const inventarioTableBody = document.getElementById('inventarioTableBody');
        const rubroFilter = document.getElementById('rubroFilter');
        if (!inventarioTableBody || !rubroFilter) return;
        inventarioTableBody.innerHTML = `<tr><td colspan="4" class="py-3 px-6 text-center text-gray-500">Cargando y ordenando...</td></tr>`;

        const selectedRubro = rubroFilter.value;
        const inventarioConStockOEnVenta = _inventarioCache.filter(p => (p.cantidadUnidades || 0) > 0 || _ventaActual.productos[p.id]);
        let filteredInventario = selectedRubro ? inventarioConStockOEnVenta.filter(p => p.rubro === selectedRubro) : inventarioConStockOEnVenta;

        // --- NUEVO: Ordenamiento Global ---
        const sortFunction = await window.getGlobalProductSortFunction();
        filteredInventario.sort(sortFunction);
        // --- FIN NUEVO ---

        inventarioTableBody.innerHTML = '';
        if (filteredInventario.length === 0) {
            inventarioTableBody.innerHTML = `<tr><td colspan="4" class="py-3 px-6 text-center text-gray-500">No hay productos ${selectedRubro ? 'para este rubro' : ''}.</td></tr>`;
            return;
        }

        let lastHeaderKey = null; // Para agrupar visualmente
        const firstSortKey = _sortPreferenceCache ? _sortPreferenceCache[0] : 'segmento'; // Asume segmento si no hay pref

        filteredInventario.forEach(producto => {
            const currentHeaderValue = producto[firstSortKey] || `Sin ${firstSortKey}`;
            // Añadir cabecera si cambia
            if (currentHeaderValue !== lastHeaderKey) {
                 lastHeaderKey = currentHeaderValue;
                 const headerRow = document.createElement('tr');
                 headerRow.innerHTML = `<td colspan="4" class="py-1 px-2 bg-gray-100 font-bold text-gray-700 text-base sticky top-[calc(theme(height.10))] z-[9]">${lastHeaderKey}</td>`; // Ajustar top offset si es necesario
                 inventarioTableBody.appendChild(headerRow);
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
                    <td class="py-2 px-2 text-center align-middle"> <input type="number" min="0" max="${maxStockTipo}" value="${cant}" class="w-16 p-1 text-center border rounded-md" data-product-id="${producto.id}" data-tipo-venta="${tipo}" oninput="window.ventasModule.handleQuantityChange(event)"> </td>
                    <td class="py-2 px-2 text-left align-middle"> ${descTipo} <span class="text-xs text-gray-500">${producto.marca || 'S/M'}</span> </td>
                    <td class="py-2 px-2 text-left align-middle font-semibold price-toggle" onclick="window.ventasModule.toggleMoneda()" title="Clic para cambiar moneda">${formatPrice(precioTipo)}</td>
                    <td class="py-2 px-1 text-center align-middle">${stockDisplayTipo}</td>
                `;
                inventarioTableBody.appendChild(row);
            };
            const unidadesStockTotal = producto.cantidadUnidades || 0;
            if (ventaPor.cj) {
                const undCj = producto.unidadesPorCaja || 1; const maxCj = Math.floor(unidadesStockTotal / undCj);
                createRow('cj', ventaActualProducto.cantCj || 0, maxCj, precios.cj || 0, `${maxCj} Cj`, `${producto.presentacion} (Cj/${undCj} und)`);
            }
            if (ventaPor.paq) {
                const undPaq = producto.unidadesPorPaquete || 1; const maxPaq = Math.floor(unidadesStockTotal / undPaq);
                createRow('paq', ventaActualProducto.cantPaq || 0, maxPaq, precios.paq || 0, `${maxPaq} Paq`, `${producto.presentacion} (Paq/${undPaq} und)`);
            }
             if (ventaPor.und) {
                 createRow('und', ventaActualProducto.cantUnd || 0, unidadesStockTotal, precios.und || 0, `${unidadesStockTotal} Und`, `${producto.presentacion} (Und)`);
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
            _ventaActual.productos[productId] = { ...producto, cantCj: 0, cantPaq: 0, cantUnd: 0, totalUnidadesVendidas: 0 };
        }
        const quantity = parseInt(input.value, 10) || 0;
        _ventaActual.productos[productId][`cant${tipoVenta.charAt(0).toUpperCase() + tipoVenta.slice(1)}`] = quantity;
        const pVenta = _ventaActual.productos[productId];
        const undCj = pVenta.unidadesPorCaja || 1; const undPaq = pVenta.unidadesPorPaquete || 1;
        const totalUndVendidas = (pVenta.cantCj * undCj) + (pVenta.cantPaq * undPaq) + (pVenta.cantUnd || 0);
        const stockDispUnd = producto.cantidadUnidades || 0;
        if (totalUndVendidas > stockDispUnd) {
            _showModal('Stock Insuficiente', `Total (${totalUndVendidas} und) excede stock (${stockDispUnd} und). Se ajustará.`);
             let excess = totalUndVendidas - stockDispUnd;
             if (tipoVenta === 'cj') input.value = Math.max(0, quantity - Math.ceil(excess / undCj));
             else if (tipoVenta === 'paq') input.value = Math.max(0, quantity - Math.ceil(excess / undPaq));
             else input.value = Math.max(0, quantity - excess);
            handleQuantityChange({target: input}); return; // Recalcular
        }
        pVenta.totalUnidadesVendidas = totalUndVendidas;
        if (pVenta.totalUnidadesVendidas === 0 && pVenta.cantCj === 0 && pVenta.cantPaq === 0 && pVenta.cantUnd === 0) {
             delete _ventaActual.productos[productId]; // Eliminar si todo es 0
        }
        updateVentaTotal();
    };

    function handleTipoVacioChange(event) {
        const input = event.target;
        const tipoVacio = input.dataset.tipoVacio;
        const cantidad = parseInt(input.value, 10) || 0;
        if (tipoVacio && _ventaActual.vaciosDevueltosPorTipo.hasOwnProperty(tipoVacio)) {
            _ventaActual.vaciosDevueltosPorTipo[tipoVacio] = cantidad;
        }
    }

    function updateVentaTotal() {
        const totalEl = document.getElementById('ventaTotal');
        if(!totalEl) return;
        const totalUSD = Object.values(_ventaActual.productos).reduce((sum, p) => {
            const precios = p.precios || { und: p.precioPorUnidad || 0 };
            return sum + (precios.cj || 0) * (p.cantCj || 0) + (precios.paq || 0) * (p.cantPaq || 0) + (precios.und || 0) * (p.cantUnd || 0);
        }, 0);
        if (_monedaActual === 'COP' && _tasaCOP > 0) totalEl.textContent = `Total: COP ${(Math.ceil((totalUSD * _tasaCOP) / 100) * 100).toLocaleString('es-CO')}`;
        else if (_monedaActual === 'Bs' && _tasaBs > 0) totalEl.textContent = `Total: Bs.S ${(totalUSD * _tasaBs).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        else totalEl.textContent = `Total: $${totalUSD.toFixed(2)}`;
    }

    // Funciones createTicketHTML, createRawTextTicket, handleShareTicket, handleShareRawText,
    // copyToClipboard, legacyCopyToClipboard, showSharingOptions permanecen iguales.
    // ... (código omitido por brevedad)

    // generarTicket permanece igual.
    // ... (código omitido por brevedad)

    // showVentasTotalesView permanece igual.
    // ... (código omitido por brevedad)

    // showVentasActualesView y renderVentasList permanecen iguales.
    // ... (código omitido por brevedad)

    // showCierreSubMenuView permanece igual.
    // ... (código omitido por brevedad)

    // MODIFICADO: processSalesDataForReport ahora usa funciones locales para orden específico de reporte
    async function processSalesDataForReport(ventas) {
        // --- NUEVO: Funciones locales para obtener mapas de orden SOLO para este reporte ---
        async function getRubroOrderMapLocal() {
            const map = {};
            const rubrosRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/rubros`);
            try {
                const snapshot = await _getDocs(rubrosRef);
                snapshot.docs.forEach(doc => { map[doc.data().name] = doc.data().orden ?? 9999; });
            } catch (e) { console.warn("Reporte: No se pudo obtener orden de rubros.", e); }
            return map;
        }
        async function getSegmentoOrderMapLocal() {
            const map = {};
            const segmentosRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/segmentos`);
            try {
                const snapshot = await _getDocs(segmentosRef);
                snapshot.docs.forEach(doc => { map[doc.data().name] = doc.data().orden ?? 9999; });
            } catch (e) { console.warn("Reporte: No se pudo obtener orden de segmentos.", e); }
            return map;
        }
        // --- FIN NUEVO ---

        const clientData = {};
        let grandTotalValue = 0;
        const allProductsMap = new Map();
        const vaciosMovementsPorTipo = {};

        const inventarioSnapshot = await _getDocs(_collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`));
        const inventarioMap = new Map(inventarioSnapshot.docs.map(doc => [doc.id, doc.data()]));

        ventas.forEach(venta => {
            const clientName = venta.clienteNombre || 'Cliente Desconocido';
            if (!clientData[clientName]) clientData[clientName] = { products: {}, totalValue: 0 };
            if(!vaciosMovementsPorTipo[clientName]) { vaciosMovementsPorTipo[clientName] = {}; TIPOS_VACIO.forEach(tipo => vaciosMovementsPorTipo[clientName][tipo] = { entregados: 0, devueltos: 0 }); }
            clientData[clientName].totalValue += (venta.total || 0);
            grandTotalValue += (venta.total || 0);
            const vaciosDev = venta.vaciosDevueltosPorTipo || {};
            for (const tipo in vaciosDev) { if (vaciosMovementsPorTipo[clientName][tipo]) vaciosMovementsPorTipo[clientName][tipo].devueltos += (vaciosDev[tipo] || 0); }
            (venta.productos || []).forEach(p => {
                const prodComp = inventarioMap.get(p.id) || p;
                const rubro = prodComp.rubro || 'Sin Rubro', seg = prodComp.segmento || 'Sin Segmento', marca = prodComp.marca || 'Sin Marca';
                if (prodComp.manejaVacios && prodComp.tipoVacio) { const tipoV = prodComp.tipoVacio; if (vaciosMovementsPorTipo[clientName][tipoV]) vaciosMovementsPorTipo[clientName][tipoV].entregados += p.cantidadVendida?.cj || 0; }
                if (!allProductsMap.has(p.id)) allProductsMap.set(p.id, { ...prodComp, id: p.id, rubro: rubro, segmento: seg, marca: marca, presentacion: p.presentacion });
                if (!clientData[clientName].products[p.id]) clientData[clientName].products[p.id] = 0;
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

        // --- MODIFICADO: Usa las funciones locales ---
        const rubroOrderMap = await getRubroOrderMapLocal();
        const segmentoOrderMap = await getSegmentoOrderMapLocal();
        // --- FIN MODIFICADO ---

        const sortedRubros = Object.keys(groupedProducts).sort((a, b) => (rubroOrderMap[a] ?? 999) - (rubroOrderMap[b] ?? 999));
        const finalProductOrder = [];
        sortedRubros.forEach(rubro => {
            const sortedSegmentos = Object.keys(groupedProducts[rubro]).sort((a, b) => (segmentoOrderMap[a] ?? 999) - (segmentoOrderMap[b] ?? 999));
            sortedSegmentos.forEach(segmento => {
                const sortedMarcas = Object.keys(groupedProducts[rubro][segmento]).sort();
                sortedMarcas.forEach(marca => {
                    const sortedPres = groupedProducts[rubro][segmento][marca].sort((a,b) => (a.presentacion || '').localeCompare(b.presentacion || ''));
                    finalProductOrder.push(...sortedPres);
                });
            });
        });
        return { clientData, grandTotalValue, sortedClients, groupedProducts, finalProductOrder, sortedRubros, segmentoOrderMap, vaciosMovementsPorTipo, allProductsMap };
    }

    // showVerCierreView, exportCierreToExcel, ejecutarCierre permanecen iguales internamente,
    // pero ahora dependen de la versión modificada de processSalesDataForReport.
    // ... (código omitido por brevedad)

    // showOrdenarCierreView, renderRubrosForOrdering, renderSegmentosForOrderingGlobal,
    // addDragAndDropHandlers, handleGuardarOrdenCierre permanecen iguales.
    // ... (código omitido por brevedad)

    // showPastSaleOptions, editVenta, deleteVenta permanecen iguales.
    // ... (código omitido por brevedad)

    // showEditVentaView permanece igual.
    // ... (código omitido por brevedad)

    // MODIFICADO: Usa la función de ordenamiento global
    async function renderEditVentasInventario() {
        const inventarioTableBody = document.getElementById('inventarioTableBody');
        const rubroFilter = document.getElementById('rubroFilter');
        if (!inventarioTableBody || !rubroFilter) return;
        inventarioTableBody.innerHTML = `<tr><td colspan="4" class="py-3 px-6 text-center text-gray-500">Cargando...</td></tr>`;
        const selectedRubro = rubroFilter.value;
        let inventarioToShow = _inventarioCache.filter(p => _originalVentaForEdit.productos.some(origP => origP.id === p.id) || (p.cantidadUnidades || 0) > 0);
        if (selectedRubro) inventarioToShow = inventarioToShow.filter(p => p.rubro === selectedRubro);

        // --- NUEVO: Ordenamiento Global ---
        const sortFunction = await window.getGlobalProductSortFunction();
        inventarioToShow.sort(sortFunction);
        // --- FIN NUEVO ---

        inventarioTableBody.innerHTML = '';
        if (inventarioToShow.length === 0) {
            inventarioTableBody.innerHTML = `<tr><td colspan="4" class="py-3 px-6 text-center text-gray-500">No hay productos ${selectedRubro ? 'en este rubro' : ''}.</td></tr>`;
            return;
        }

        let lastHeaderKey = null; // Para agrupar visualmente
        const firstSortKey = _sortPreferenceCache ? _sortPreferenceCache[0] : 'segmento';

        inventarioToShow.forEach(producto => {
             const currentHeaderValue = producto[firstSortKey] || `Sin ${firstSortKey}`;
             if (currentHeaderValue !== lastHeaderKey) {
                 lastHeaderKey = currentHeaderValue;
                 const headerRow = document.createElement('tr');
                 headerRow.innerHTML = `<td colspan="4" class="py-1 px-2 bg-gray-100 font-bold text-base sticky top-[calc(theme(height.10))] z-[9]">${lastHeaderKey}</td>`;
                 inventarioTableBody.appendChild(headerRow);
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
                 let factor = tipo === 'cj' ? (producto.unidadesPorCaja || 1) : tipo === 'paq' ? (producto.unidadesPorPaquete || 1) : 1;
                 const maxUnitsAvail = currentStockUnits + (originalUnitsSoldTipo * factor);
                 const maxInput = Math.floor(maxUnitsAvail / factor);
                 const stockDispTipo = Math.floor(currentStockUnits / factor);
                const row = document.createElement('tr');
                row.classList.add('border-b', 'border-gray-200', 'hover:bg-gray-50');
                row.innerHTML = `
                    <td class="py-2 px-1 text-center align-middle"> <input type="number" min="0" max="${maxInput}" value="${currentCant}" class="w-16 p-1 text-center border rounded-md" data-product-id="${producto.id}" data-tipo-venta="${tipo}" oninput="window.ventasModule.handleQuantityChange(event)"> </td>
                    <td class="py-2 px-2 text-left align-middle">${descTipo} <span class="text-xs text-gray-500">${producto.marca || 'S/M'}</span></td>
                    <td class="py-2 px-2 text-left align-middle font-semibold price-toggle" onclick="window.ventasModule.toggleMoneda()">${formatPrice(precioTipo)}</td>
                    <td class="py-2 px-1 text-center align-middle">${stockDispTipo} ${tipo.toUpperCase()}</td>
                `;
                inventarioTableBody.appendChild(row);
            };
             if (ventaPor.cj) { const undCj = producto.unidadesPorCaja || 1; createEditRow('cj', ventaActualProd.cantCj || 0, precios.cj || 0, `${producto.presentacion} (Cj/${undCj} und)`); }
             if (ventaPor.paq) { const undPaq = producto.unidadesPorPaquete || 1; createEditRow('paq', ventaActualProd.cantPaq || 0, precios.paq || 0, `${producto.presentacion} (Paq/${undPaq} und)`); }
             if (ventaPor.und) { createEditRow('und', ventaActualProd.cantUnd || 0, precios.und || 0, `${producto.presentacion} (Und)`); }
        });
        updateVentaTotal();
    }

    // handleGuardarVentaEditada permanece igual.
    // ... (código omitido por brevedad)

    // MODIFICADO: InvalidateCache ahora está vacía o podría llamar a la global si fuera necesario
    window.ventasModule = {
        toggleMoneda,
        handleQuantityChange,
        handleTipoVacioChange,
        showPastSaleOptions,
        editVenta,
        deleteVenta,
        invalidateCache: () => {
            // Ya no hay cachés locales de ordenamiento que invalidar aquí
            console.log("ventasModule.invalidateCache llamada (acción no requerida).");
        }
    };
})();
