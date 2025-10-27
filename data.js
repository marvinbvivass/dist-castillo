// --- Lógica del módulo de Data (solo para Admins) ---

(function() {
    // Variables locales del módulo
    let _db, _appId, _userId, _mainContent, _floatingControls, _showMainMenu, _showModal;
    let _collection, _getDocs, _query, _where, _orderBy, _populateDropdown;

    let _lastStatsData = []; // Caché para los datos de la última estadística generada
    let _lastNumWeeks = 1;   // Caché para el número de semanas del último cálculo
    let _consolidatedClientsCache = []; // Caché para la lista de clientes consolidados
    let _filteredClientsCache = []; // Caché para la lista filtrada de clientes a descargar

    // Se duplican estas funciones para mantener el módulo independiente
    let _segmentoOrderCacheData = null;
    let _rubroOrderCacheData = null;

    // Variables para el mapa
    let mapInstance = null;
    let mapMarkers = new Map();


    /**
     * Inicializa el módulo con las dependencias necesarias.
     */
    window.initData = function(dependencies) {
        _db = dependencies.db;
        _appId = dependencies.appId;
        _userId = dependencies.userId; // El ID del admin actual
        _mainContent = dependencies.mainContent;
        _floatingControls = dependencies.floatingControls;
        _showMainMenu = dependencies.showMainMenu;
        _showModal = dependencies.showModal;
        _collection = dependencies.collection;
        _getDocs = dependencies.getDocs;
        _query = dependencies.query;
        _where = dependencies.where;
        _orderBy = dependencies.orderBy;
        _populateDropdown = dependencies.populateDropdown;
    };

    /**
     * Muestra el submenú de opciones del módulo de Data.
     */
    window.showDataView = function() {
        if (mapInstance) {
            mapInstance.remove();
            mapInstance = null;
        }
        _floatingControls.classList.add('hidden');
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl text-center">
                        <h1 class="text-3xl font-bold text-gray-800 mb-6">Módulo de Datos</h1>
                        <div class="space-y-4">
                            <button id="closingDataBtn" class="w-full px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700">Datos de Cierres de Ventas</button>
                            <button id="productStatsBtn" class="w-full px-6 py-3 bg-teal-600 text-white font-semibold rounded-lg shadow-md hover:bg-teal-700">Estadística de Productos</button>
                            <button id="consolidatedClientsBtn" class="w-full px-6 py-3 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700">Clientes Consolidados</button>
                            <button id="clientMapBtn" class="w-full px-6 py-3 bg-cyan-600 text-white font-semibold rounded-lg shadow-md hover:bg-cyan-700">Mapa de Clientes</button>
                            <button id="backToMenuBtn" class="w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver al Menú Principal</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('closingDataBtn').addEventListener('click', showClosingDataView);
        document.getElementById('productStatsBtn').addEventListener('click', showProductStatsView);
        document.getElementById('consolidatedClientsBtn').addEventListener('click', showConsolidatedClientsView);
        document.getElementById('clientMapBtn').addEventListener('click', showClientMapView);
        document.getElementById('backToMenuBtn').addEventListener('click', _showMainMenu);
    };

    /**
     * Muestra la vista para buscar y ver cierres de vendedores.
     */
    async function showClosingDataView() {
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl">
                        <h1 class="text-3xl font-bold text-gray-800 mb-6 text-center">Datos de Cierres de Vendedores</h1>

                        <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 p-4 border rounded-lg items-end">
                            <div>
                                <label for="userFilter" class="block text-sm font-medium text-gray-700">Vendedor:</label>
                                <select id="userFilter" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                                    <option value="">Todos los Vendedores</option>
                                </select>
                            </div>
                            <div>
                                <label for="fechaDesde" class="block text-sm font-medium text-gray-700">Desde:</label>
                                <input type="date" id="fechaDesde" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                            </div>
                            <div>
                                <label for="fechaHasta" class="block text-sm font-medium text-gray-700">Hasta:</label>
                                <input type="date" id="fechaHasta" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                            </div>
                            <button id="searchCierresBtn" class="w-full px-6 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700">Buscar Cierres</button>
                        </div>

                        <div id="cierres-list-container" class="overflow-x-auto max-h-96">
                            <p class="text-center text-gray-500">Seleccione las opciones para buscar.</p>
                        </div>
                        <button id="backToDataMenuBtn" class="mt-6 w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver</button>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('backToDataMenuBtn').addEventListener('click', showDataView);
        document.getElementById('searchCierresBtn').addEventListener('click', handleSearchClosings);

        const today = new Date().toISOString().split('T')[0];
        document.getElementById('fechaDesde').value = today;
        document.getElementById('fechaHasta').value = today;

        await populateUserFilter();
    };

    /**
     * Popula el desplegable de filtro de usuarios.
     */
    async function populateUserFilter() {
        const userFilterSelect = document.getElementById('userFilter');
        if (!userFilterSelect) return;

        try {
            const usersRef = _collection(_db, "users");
            const snapshot = await _getDocs(usersRef);
            snapshot.docs.forEach(doc => {
                const user = doc.data();
                const option = document.createElement('option');
                option.value = doc.id;
                option.textContent = `${user.nombre || ''} ${user.apellido || user.email} (${user.camion || 'N/A'})`;
                userFilterSelect.appendChild(option);
            });
        } catch (error) {
            console.error("Error al cargar usuarios para el filtro:", error);
        }
    }


    /**
     * Maneja la búsqueda de cierres de vendedores por rango de fecha y usuario.
     */
    async function handleSearchClosings() {
        const container = document.getElementById('cierres-list-container');
        container.innerHTML = `<p class="text-center text-gray-500">Buscando...</p>`;

        const selectedUserId = document.getElementById('userFilter').value;
        const fechaDesdeStr = document.getElementById('fechaDesde').value;
        const fechaHastaStr = document.getElementById('fechaHasta').value;

        if (!fechaDesdeStr || !fechaHastaStr) {
            _showModal('Error', 'Por favor, seleccione ambas fechas.');
            container.innerHTML = `<p class="text-center text-gray-500">Seleccione un rango de fechas.</p>`; // Reset message
            return;
        }

        // Use UTC to avoid timezone issues when comparing dates only
        const fechaDesde = new Date(fechaDesdeStr + 'T00:00:00Z');
        const fechaHasta = new Date(fechaHastaStr + 'T23:59:59Z');


        try {
            const closingsRef = _collection(_db, `public_data/${_appId}/user_closings`);

            // Query by date range first
            let q = _query(closingsRef,
                _where("fecha", ">=", fechaDesde),
                _where("fecha", "<=", fechaHasta)
                // Do not order here, sort later in JS
            );

            const snapshot = await _getDocs(q);
            let closings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Filter by user locally if a specific user is selected
            if (selectedUserId) {
                closings = closings.filter(cierre => cierre.vendedorInfo && cierre.vendedorInfo.userId === selectedUserId);
            }

            // Store in temporary global variable for modal access
            window.tempClosingsData = closings;

            renderClosingsList(closings);

        } catch (error) {
            console.error("Error al buscar cierres:", error);
            container.innerHTML = `<p class="text-center text-red-500">Ocurrió un error al buscar los cierres.</p>`;
        }
    }


    /**
     * Renderiza la lista de cierres encontrados.
     */
    function renderClosingsList(closings) {
        const container = document.getElementById('cierres-list-container');
        if (closings.length === 0) {
            container.innerHTML = `<p class="text-center text-gray-500">No se encontraron cierres para los filtros seleccionados.</p>`;
            return;
        }

        // Sort by date descending
        closings.sort((a, b) => b.fecha.toDate() - a.fecha.toDate());

        let tableHTML = `
            <table class="min-w-full bg-white text-sm">
                <thead class="bg-gray-200 sticky top-0 z-10">
                    <tr>
                        <th class="py-2 px-3 border-b text-left">Fecha</th>
                        <th class="py-2 px-3 border-b text-left">Vendedor</th>
                        <th class="py-2 px-3 border-b text-left">Camión</th>
                        <th class="py-2 px-3 border-b text-right">Total Cierre</th>
                        <th class="py-2 px-3 border-b text-center">Acciones</th>
                    </tr>
                </thead>
                <tbody>`;

        closings.forEach(cierre => {
            const vendedor = cierre.vendedorInfo || {};
            tableHTML += `
                <tr class="hover:bg-gray-50">
                    <td class="py-2 px-3 border-b">${cierre.fecha.toDate().toLocaleDateString('es-ES')}</td>
                    <td class="py-2 px-3 border-b">${vendedor.nombre || ''} ${vendedor.apellido || ''}</td>
                    <td class="py-2 px-3 border-b">${vendedor.camion || 'N/A'}</td>
                    <td class="py-2 px-3 border-b text-right font-semibold">$${(cierre.total || 0).toFixed(2)}</td>
                    <td class="py-2 px-3 border-b text-center space-x-2">
                        <button onclick="window.dataModule.showClosingDetail('${cierre.id}')" class="px-3 py-1 bg-blue-500 text-white text-xs rounded-lg hover:bg-blue-600">Ver</button>
                        <button onclick="window.dataModule.handleDownloadSingleClosing('${cierre.id}')" title="Descargar Reporte" class="p-1.5 bg-green-500 text-white text-xs rounded-lg hover:bg-green-600 align-middle">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                        </button>
                    </td>
                </tr>
            `;
        });

        tableHTML += '</tbody></table>';
        container.innerHTML = tableHTML;
    }

    // --- Lógica de Reporte (duplicada de ventas.js para independencia) ---

    async function getRubroOrderMapData(userIdForData) {
        if (_rubroOrderCacheData) return _rubroOrderCacheData;
        const map = {};
        const rubrosRef = _collection(_db, `artifacts/${_appId}/users/${userIdForData}/rubros`);
        try {
            const snapshot = await _getDocs(rubrosRef);
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                map[data.name] = (data.orden !== undefined) ? data.orden : 9999;
            });
            _rubroOrderCacheData = map;
            return map;
        } catch (e) { console.warn("No se pudo obtener el orden de los rubros en data.js", e); return null; }
    }

    async function getSegmentoOrderMapData(userIdForData) {
        if (_segmentoOrderCacheData) return _segmentoOrderCacheData;
        const map = {};
        const segmentosRef = _collection(_db, `artifacts/${_appId}/users/${userIdForData}/segmentos`);
        try {
            const snapshot = await _getDocs(segmentosRef);
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                map[data.name] = (data.orden !== undefined) ? data.orden : 9999;
            });
            _segmentoOrderCacheData = map;
            return map;
        } catch (e) { console.warn("No se pudo obtener el orden de los segmentos en data.js", e); return null; }
    }

    async function processSalesDataForReport(ventas, userIdForInventario) {
        const clientData = {};
        let grandTotalValue = 0;
        const allProductsMap = new Map();
        const vaciosMovementsPorTipo = {}; // Cambio: por cliente y TIPO

        // Fetch the specific user's inventory to get product details
        const inventarioRef = _collection(_db, `artifacts/${_appId}/users/${userIdForInventario}/inventario`);
        const inventarioSnapshot = await _getDocs(inventarioRef);
        const inventarioMap = new Map(inventarioSnapshot.docs.map(doc => [doc.id, doc.data()]));

        ventas.forEach(venta => {
            const clientName = venta.clienteNombre || 'Cliente Desconocido';
            if (!clientData[clientName]) {
                clientData[clientName] = { products: {}, totalValue: 0 };
            }
            // Initialize empty movements for the client if not present
            if (!vaciosMovementsPorTipo[clientName]) {
                vaciosMovementsPorTipo[clientName] = {};
                // You might need a predefined list of TIPOS_VACIO here if not all types appear in sales
                 window.TIPOS_VACIO_GLOBAL?.forEach(tipo => vaciosMovementsPorTipo[clientName][tipo] = { entregados: 0, devueltos: 0 });
            }

            clientData[clientName].totalValue += (venta.total || 0);
            grandTotalValue += (venta.total || 0);

            // Add returned empties from the sale record
            const vaciosDevueltosEnVenta = venta.vaciosDevueltosPorTipo || {};
            for (const tipoVacio in vaciosDevueltosEnVenta) {
                 if (!vaciosMovementsPorTipo[clientName][tipoVacio]) vaciosMovementsPorTipo[clientName][tipoVacio] = { entregados: 0, devueltos: 0 }; // Ensure type exists
                 vaciosMovementsPorTipo[clientName][tipoVacio].devueltos += (vaciosDevueltosEnVenta[tipoVacio] || 0);
            }

            (venta.productos || []).forEach(p => {
                 const productoCompleto = inventarioMap.get(p.id) || p; // Get full product details

                 // Add delivered empties based on product sold (if applicable)
                 if (productoCompleto.manejaVacios && productoCompleto.tipoVacio) {
                     const tipoVacio = productoCompleto.tipoVacio;
                     if (!vaciosMovementsPorTipo[clientName][tipoVacio]) vaciosMovementsPorTipo[clientName][tipoVacio] = { entregados: 0, devueltos: 0 }; // Ensure type exists
                     vaciosMovementsPorTipo[clientName][tipoVacio].entregados += p.cantidadVendida?.cj || 0;
                 }


                const rubro = productoCompleto.rubro || 'Sin Rubro';
                const segmento = productoCompleto.segmento || 'Sin Segmento';
                const marca = productoCompleto.marca || 'Sin Marca';

                if (!allProductsMap.has(p.id)) {
                    allProductsMap.set(p.id, {
                        ...productoCompleto, // Copy all data from inventory
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

        const rubroOrderMap = await getRubroOrderMapData(userIdForInventario);
        const segmentoOrderMap = await getSegmentoOrderMapData(userIdForInventario);

        const sortedRubros = Object.keys(groupedProducts).sort((a, b) => (rubroOrderMap[a] ?? 999) - (rubroOrderMap[b] ?? 999));

        const finalProductOrder = [];
        sortedRubros.forEach(rubro => {
            const sortedSegmentos = Object.keys(groupedProducts[rubro]).sort((a, b) => (segmentoOrderMap[a] ?? 999) - (segmentoOrderMap[b] ?? 999));
            sortedSegmentos.forEach(segmento => {
                const sortedMarcas = Object.keys(groupedProducts[rubro][segmento]).sort();
                sortedMarcas.forEach(marca => {
                    const sortedPresentaciones = groupedProducts[rubro][segmento][marca].sort((a,b) => (a.presentacion||'').localeCompare(b.presentacion||''));
                    finalProductOrder.push(...sortedPresentaciones);
                });
            });
        });

        return { clientData, grandTotalValue, sortedClients, groupedProducts, finalProductOrder, sortedRubros, segmentoOrderMap, vaciosMovementsPorTipo, allProductsMap };
    }


    /**
     * Muestra el detalle de un cierre en un modal
     */
    async function showClosingDetail(closingId) {
        // Use the globally stored temp data
        const closingData = window.tempClosingsData?.find(c => c.id === closingId);
        if (!closingData) {
            _showModal('Error', 'No se pudieron cargar los detalles del cierre.');
            return;
        }

        _showModal('Progreso', 'Generando reporte detallado...');

        try {
            // Process the sales data for the report
            const { clientData, grandTotalValue, sortedClients, groupedProducts, finalProductOrder, sortedRubros, segmentoOrderMap, vaciosMovementsPorTipo, allProductsMap } = await processSalesDataForReport(closingData.ventas, closingData.vendedorInfo.userId);

            // Build Header Rows
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

            // Build Body Rows
            let bodyHTML = '';
            sortedClients.forEach(clientName => {
                bodyHTML += `<tr class="hover:bg-blue-50"><td class="p-1 border font-medium bg-white sticky left-0 z-10">${clientName}</td>`;
                const currentClient = clientData[clientName];
                finalProductOrder.forEach(product => {
                    const quantityInUnits = currentClient.products[product.id] || 0;
                    let displayQuantity = '';

                    if (quantityInUnits > 0) {
                        displayQuantity = `${quantityInUnits} Unds`; // Default to units
                        const ventaPor = product.ventaPor || {};
                        const unidadesPorCaja = product.unidadesPorCaja || 1;
                        const unidadesPorPaquete = product.unidadesPorPaquete || 1;
                        const isExclusiveCj = ventaPor.cj && !ventaPor.paq && !ventaPor.und;
                        const isExclusivePaq = ventaPor.paq && !ventaPor.cj && !ventaPor.und;

                        // Display as Cj or Paq only if it's the exclusive sale type AND division results in integer
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

            // Build Footer Row
            let footerHTML = '<tr class="bg-gray-200 font-bold"><td class="p-1 border sticky left-0 z-10">TOTALES</td>';
            finalProductOrder.forEach(product => {
                let totalQty = 0;
                sortedClients.forEach(clientName => {
                    totalQty += clientData[clientName].products[product.id] || 0;
                });

                let displayTotal = '';
                if (totalQty > 0) {
                    displayTotal = `${totalQty} Unds`; // Default to units
                    const ventaPor = product.ventaPor || {};
                    const unidadesPorCaja = product.unidadesPorCaja || 1;
                    const unidadesPorPaquete = product.unidadesPorPaquete || 1;
                    const isExclusiveCj = ventaPor.cj && !ventaPor.paq && !ventaPor.und;
                    const isExclusivePaq = ventaPor.paq && !ventaPor.cj && !ventaPor.und;

                     // Display as Cj or Paq only if it's the exclusive sale type AND division results in integer
                    if (isExclusiveCj && unidadesPorCaja > 0 && Number.isInteger(totalQty / unidadesPorCaja)) {
                        displayTotal = `${totalQty / unidadesPorCaja} Cj`;
                    } else if (isExclusivePaq && unidadesPorPaquete > 0 && Number.isInteger(totalQty / unidadesPorPaquete)) {
                        displayTotal = `${totalQty / unidadesPorPaquete} Paq`;
                    }
                }
                footerHTML += `<td class="p-1 border text-center">${displayTotal}</td>`;
            });
            footerHTML += `<td class="p-1 border text-right sticky right-0 z-10">$${grandTotalValue.toFixed(2)}</td></tr>`;

            // Build Empties Report HTML (by type)
            let vaciosReportHTML = '';
             const TIPOS_VACIO_GLOBAL = ["1/4 - 1/3", "ret 350 ml", "ret 1.25 Lts"]; // Make sure this is consistent
             const clientesConMovimientoVacios = Object.keys(vaciosMovementsPorTipo).filter(cliente =>
                 TIPOS_VACIO_GLOBAL.some(tipo => (vaciosMovementsPorTipo[cliente][tipo]?.entregados || 0) > 0 || (vaciosMovementsPorTipo[cliente][tipo]?.devueltos || 0) > 0)
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
                    TIPOS_VACIO_GLOBAL.forEach(tipoVacio => {
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


            // Assemble Final HTML for Modal
            const vendedor = closingData.vendedorInfo || {};
            const reporteHTML = `
                <div class="text-left max-h-[80vh] overflow-auto">
                    <div class="mb-4">
                        <p><strong>Vendedor:</strong> ${vendedor.nombre || ''} ${vendedor.apellido || ''}</p>
                        <p><strong>Camión:</strong> ${vendedor.camion || 'N/A'}</p>
                        <p><strong>Fecha:</strong> ${closingData.fecha.toDate().toLocaleString('es-ES')}</p>
                    </div>
                    <h3 class="text-xl font-bold text-gray-800 mb-4">Reporte de Cierre de Ventas</h3>
                    <div class="overflow-auto border" style="max-height: 40vh;">
                        <table class="min-w-full bg-white text-xs">
                            <thead class="bg-gray-200">${headerRow1}${headerRow2}${headerRow3}${headerRow4}</thead>
                            <tbody>${bodyHTML}</tbody>
                            <tfoot>${footerHTML}</tfoot>
                        </table>
                    </div>
                    ${vaciosReportHTML}
                </div>`;
            _showModal(`Detalle del Cierre`, reporteHTML, null, 'Cerrar'); // Provide 'Cerrar' text

        } catch (error) {
             console.error("Error generating closing detail:", error);
             _showModal('Error', `No se pudo generar el reporte detallado: ${error.message}`);
        }
    }


    /**
     * Genera y descarga un archivo Excel para un único cierre.
     */
    async function exportSingleClosingToExcel(closingData) {
        if (typeof XLSX === 'undefined') {
            _showModal('Error', 'La librería para exportar a Excel no está cargada.');
            return;
        }

        const { clientData, grandTotalValue, sortedClients, groupedProducts, finalProductOrder, sortedRubros, segmentoOrderMap, vaciosMovementsPorTipo, allProductsMap } = await processSalesDataForReport(closingData.ventas, closingData.vendedorInfo.userId);

        // --- Hoja 1: Reporte de Ventas ---
        const dataForSheet1 = [];
        const merges1 = [];
        const headerRow1 = [""]; const headerRow2 = [""]; const headerRow3 = [""]; const headerRow4 = ["Cliente"];

        let currentColumn = 1; // Start after Cliente column
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

                    headerRow3.push(marca); // Add Marca to 3rd header row
                    for (let i = 1; i < marcaColspan; i++) headerRow3.push(""); // Fill empty cells for colspan
                    if (marcaColspan > 1) merges1.push({ s: { r: 2, c: marcaStartCol }, e: { r: 2, c: marcaStartCol + marcaColspan - 1 } }); // Add merge info

                    presentaciones.forEach(p => headerRow4.push(p.presentacion || 'N/A')); // Add Presentacion to 4th header row
                    currentColumn += marcaColspan; // Move column index
                });
                headerRow2.push(segmento); // Add Segmento to 2nd header row
                for (let i = 1; i < segmentoColspan; i++) headerRow2.push(""); // Fill empty cells
                if (segmentoColspan > 1) merges1.push({ s: { r: 1, c: segmentoStartCol }, e: { r: 1, c: segmentoStartCol + segmentoColspan - 1 } }); // Add merge
            });
            headerRow1.push(rubro); // Add Rubro to 1st header row
            for (let i = 1; i < rubroColspan; i++) headerRow1.push(""); // Fill empty cells
            if (rubroColspan > 1) merges1.push({ s: { r: 0, c: rubroStartCol }, e: { r: 0, c: rubroStartCol + rubroColspan - 1 } }); // Add merge
        });

        // Add "Total Cliente" header spanning 4 rows
        headerRow1.push(""); headerRow2.push(""); headerRow3.push(""); headerRow4.push("Total Cliente");
        dataForSheet1.push(headerRow1, headerRow2, headerRow3, headerRow4);

        // Merge cells for "Cliente" and "Total Cliente" headers
        merges1.push({ s: { r: 0, c: 0 }, e: { r: 3, c: 0 } }); // Merge A1:A4
        merges1.push({ s: { r: 0, c: finalProductOrder.length + 1 }, e: { r: 3, c: finalProductOrder.length + 1 } }); // Merge last column

        // Add body data
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
            row.push(Number(currentClient.totalValue.toFixed(2))); // Store total as number
            dataForSheet1.push(row);
        });

        // Add footer row
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
        footerRow.push(Number(grandTotalValue.toFixed(2))); // Store total as number
        dataForSheet1.push(footerRow);

        const ws1 = XLSX.utils.aoa_to_sheet(dataForSheet1);
        ws1['!merges'] = merges1;

        // --- Hoja 2: Reporte de Vacíos por Tipo ---
         const TIPOS_VACIO_GLOBAL = ["1/4 - 1/3", "ret 350 ml", "ret 1.25 Lts"]; // Ensure consistency
         const clientesConMovimientoVacios = Object.keys(vaciosMovementsPorTipo).filter(cliente =>
             TIPOS_VACIO_GLOBAL.some(tipo => (vaciosMovementsPorTipo[cliente][tipo]?.entregados || 0) > 0 || (vaciosMovementsPorTipo[cliente][tipo]?.devueltos || 0) > 0)
         ).sort();

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws1, 'Reporte de Cierre');

        if (clientesConMovimientoVacios.length > 0) {
            const dataForSheet2 = [['Cliente', 'Tipo Vacío', 'Entregados (Cajas)', 'Devueltos (Cajas)', 'Neto']];
            clientesConMovimientoVacios.forEach(cliente => {
                 const movimientos = vaciosMovementsPorTipo[cliente];
                TIPOS_VACIO_GLOBAL.forEach(tipoVacio => {
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

        // --- Generar Archivo ---
        const vendedor = closingData.vendedorInfo || {};
        const fecha = closingData.fecha.toDate().toISOString().slice(0, 10);
        const vendedorNombre = (vendedor.nombre || 'Vendedor').replace(/\s/g, '_');
        XLSX.writeFile(wb, `Cierre_${vendedorNombre}_${fecha}.xlsx`);
    }


    /**
     * Maneja la descarga de un único cierre.
     */
    async function handleDownloadSingleClosing(closingId) {
        // Find data in temp global variable
        const closingData = window.tempClosingsData?.find(c => c.id === closingId);
        if (!closingData) {
            _showModal('Error', 'No se pudieron encontrar los datos del cierre para descargar.');
            return;
        }

        _showModal('Progreso', 'Generando archivo Excel...');

        try {
            await exportSingleClosingToExcel(closingData);
            // Close the progress modal if it's still open
             const modalContainer = document.getElementById('modalContainer');
             const modalTitle = modalContainer?.querySelector('h3')?.textContent;
             if(modalContainer && !modalContainer.classList.contains('hidden') && modalTitle?.startsWith('Progreso')) {
                  modalContainer.classList.add('hidden');
             }
        } catch (error) {
            console.error("Error al exportar cierre individual:", error);
            _showModal('Error', `Ocurrió un error al generar el archivo: ${error.message}`);
        }
    }


    // --- Lógica de Estadísticas de Productos ---

    function showProductStatsView() {
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl">
                        <h1 class="text-3xl font-bold text-gray-800 mb-6 text-center">Estadística de Productos Vendidos</h1>

                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 border rounded-lg items-end">
                            <div>
                                <label for="stats-type" class="block text-sm font-medium text-gray-700">Tipo de Estadística:</label>
                                <select id="stats-type" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md">
                                    <option value="semanal">Semanal</option>
                                    <option value="mensual">Mensual</option>
                                    <option value="general">General (Promedio Semanal)</option>
                                </select>
                            </div>
                            <div>
                                <label for="stats-rubro-filter" class="block text-sm font-medium text-gray-700">Rubro:</label>
                                <select id="stats-rubro-filter" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"></select>
                            </div>
                            <button id="searchStatsBtn" class="w-full px-6 py-2 bg-teal-600 text-white font-semibold rounded-lg shadow-md hover:bg-teal-700">Mostrar Estadísticas</button>
                        </div>

                        <div id="stats-list-container" class="overflow-x-auto max-h-96">
                            <p class="text-center text-gray-500">Seleccione las opciones y genere la estadística.</p>
                        </div>
                        <button id="backToDataMenuBtn" class="mt-6 w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver</button>
                    </div>
                </div>
            </div>
        `;

        // CORRECCIÓN: Pasar la ruta completa a la colección de rubros del admin
        const adminRubrosPath = `artifacts/${_appId}/users/${_userId}/rubros`;
        _populateDropdown(adminRubrosPath, 'stats-rubro-filter', 'Rubro');

        document.getElementById('backToDataMenuBtn').addEventListener('click', showDataView);
        document.getElementById('searchStatsBtn').addEventListener('click', handleSearchStats);
    }


    async function handleSearchStats() {
        const container = document.getElementById('stats-list-container');
        container.innerHTML = `<p class="text-center text-gray-500">Calculando estadísticas...</p>`;

        const statsType = document.getElementById('stats-type').value;
        const rubroFilter = document.getElementById('stats-rubro-filter').value;

        if (!rubroFilter) {
            _showModal('Error', 'Por favor, seleccione un rubro.');
            container.innerHTML = `<p class="text-center text-gray-500">Seleccione un rubro para continuar.</p>`;
            return;
        }

        const now = new Date();
        let fechaDesde;
        let fechaHasta = new Date(); // Use local date for upper bound

        // Determine date range based on statsType
        if (statsType === 'semanal') {
            const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ...
            fechaDesde = new Date(now);
            const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust to start week on Monday
            fechaDesde.setDate(diff); // Set to the date of the previous Monday (or today if Monday)
            fechaDesde.setHours(0, 0, 0, 0); // Start of the day
        } else if (statsType === 'mensual') {
            fechaDesde = new Date(now.getFullYear(), now.getMonth(), 1);
            fechaDesde.setHours(0, 0, 0, 0); // Start of the month
        } else { // general
            fechaDesde = new Date(0); // Epoch, start of time
        }
        fechaHasta.setHours(23, 59, 59, 999); // Ensure end of the current day

        try {
            // Get closings from public user closings and admin's private closings
            const publicClosingsRef = _collection(_db, `public_data/${_appId}/user_closings`);
            const adminClosingsRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/cierres`);

            const publicQuery = _query(publicClosingsRef, _where("fecha", ">=", fechaDesde), _where("fecha", "<=", fechaHasta));
            const adminQuery = _query(adminClosingsRef, _where("fecha", ">=", fechaDesde), _where("fecha", "<=", fechaHasta));

            const [publicSnapshot, adminSnapshot] = await Promise.all([
                _getDocs(publicQuery),
                _getDocs(adminQuery)
            ]);

            const publicClosings = publicSnapshot.docs.map(doc => doc.data());
            const adminClosings = adminSnapshot.docs.map(doc => doc.data());
            const allClosings = [...publicClosings, ...adminClosings];

            if (allClosings.length === 0) {
                container.innerHTML = `<p class="text-center text-gray-500">No hay datos de ventas en el período seleccionado.</p>`;
                _lastStatsData = []; // Clear cache
                return;
            }

            // Aggregate product sales
            const productSales = {};
            // Use admin's inventory for canonical product info (like rubro, units per pack/case)
            const adminInventarioRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`);
            const inventarioSnapshot = await _getDocs(adminInventarioRef);
            const adminInventarioMap = new Map(inventarioSnapshot.docs.map(doc => [doc.id, doc.data()]));

            let earliestDate = new Date(); // Track earliest date for 'general' average

            allClosings.forEach(cierre => {
                 const cierreDate = cierre.fecha?.toDate ? cierre.fecha.toDate() : new Date(0);
                 if (cierreDate < earliestDate) earliestDate = cierreDate;

                (cierre.ventas || []).forEach(venta => {
                    (venta.productos || []).forEach(p => {
                        const adminProductInfo = adminInventarioMap.get(p.id);
                        // Check if product exists in admin inventory and matches rubro filter
                        if (adminProductInfo && adminProductInfo.rubro === rubroFilter) {
                            if (!productSales[p.id]) {
                                productSales[p.id] = {
                                    presentacion: adminProductInfo.presentacion, // Use admin's presentation name
                                    totalUnidades: 0,
                                    ventaPor: adminProductInfo.ventaPor,
                                    unidadesPorCaja: adminProductInfo.unidadesPorCaja || 1,
                                    unidadesPorPaquete: adminProductInfo.unidadesPorPaquete || 1
                                };
                            }
                            productSales[p.id].totalUnidades += (p.totalUnidadesVendidas || 0);
                        }
                    });
                });
            });

            const productArray = Object.values(productSales);

            let numWeeks = 1;
            if (statsType === 'general') {
                const oneDay = 24 * 60 * 60 * 1000;
                // Calculate difference in weeks, rounding up, minimum 1 week
                numWeeks = Math.max(1, Math.ceil(Math.abs((now - earliestDate) / (oneDay * 7))));
            }

            _lastStatsData = productArray; // Cache the processed data
            _lastNumWeeks = numWeeks; // Cache the number of weeks

            renderStatsList(productArray, statsType, numWeeks);

        } catch (error) {
            console.error("Error al calcular estadísticas:", error);
            container.innerHTML = `<p class="text-center text-red-500">Ocurrió un error al calcular las estadísticas.</p>`;
            _lastStatsData = []; // Clear cache on error
        }
    }


    function renderStatsList(productArray, statsType, numWeeks = 1) {
        const container = document.getElementById('stats-list-container');
        if (productArray.length === 0) {
            container.innerHTML = `<p class="text-center text-gray-500">No se encontraron ventas para este rubro en el período seleccionado.</p>`;
            return;
        }

        const headerTitle = statsType === 'general' ? 'Promedio Semanal' : 'Total Vendido';

        let tableHTML = `
            <table class="min-w-full bg-white text-sm">
                <thead class="bg-gray-200 sticky top-0 z-10">
                    <tr>
                        <th class="py-2 px-3 border-b text-left">Producto</th>
                        <th class="py-2 px-3 border-b text-center">${headerTitle}</th>
                    </tr>
                </thead>
                <tbody>`;

        productArray.sort((a, b) => (a.presentacion || '').localeCompare(b.presentacion || ''));

        productArray.forEach(p => {
            let displayQuantity = 0;
            let displayUnit = 'Unds';
            // Calculate average for 'general', otherwise use total
            const totalForPeriod = statsType === 'general' ? (p.totalUnidades / numWeeks) : p.totalUnidades;

            // Determine display unit based on ventaPor (prioritize Cj, then Paq)
            if (p.ventaPor?.cj && p.unidadesPorCaja > 0) {
                displayQuantity = (totalForPeriod / p.unidadesPorCaja).toFixed(1);
                // Remove .0 if it's an integer
                if (displayQuantity.endsWith('.0')) displayQuantity = displayQuantity.slice(0, -2);
                displayUnit = 'Cajas';
            } else if (p.ventaPor?.paq && p.unidadesPorPaquete > 0) {
                displayQuantity = (totalForPeriod / p.unidadesPorPaquete).toFixed(1);
                if (displayQuantity.endsWith('.0')) displayQuantity = displayQuantity.slice(0, -2);
                displayUnit = 'Paq.';
            } else {
                displayQuantity = totalForPeriod.toFixed(0); // Display units as whole numbers
            }

            tableHTML += `
                <tr class="hover:bg-gray-50">
                    <td class="py-2 px-3 border-b">${p.presentacion}</td>
                    <td class="py-2 px-3 border-b text-center font-bold">${displayQuantity} <span class="font-normal text-xs">${displayUnit}</span></td>
                </tr>
            `;
        });

        tableHTML += `</tbody></table>`;
        container.innerHTML = `
            ${tableHTML}
            <div class="mt-6 text-center">
                <button id="downloadStatsBtn" class="px-6 py-2 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700">Descargar como Excel</button>
            </div>
        `;

        // Add event listener for the download button
        const downloadBtn = document.getElementById('downloadStatsBtn');
        if(downloadBtn) {
             downloadBtn.addEventListener('click', handleDownloadStats);
        }
    }


    function handleDownloadStats() {
        if (_lastStatsData.length === 0) {
            _showModal('Aviso', 'No hay datos de estadísticas para descargar.');
            return;
        }

        if (typeof XLSX === 'undefined') {
            _showModal('Error', 'La librería para exportar a Excel no está cargada.');
            return;
        }

        const statsType = document.getElementById('stats-type').value;
        const headerTitle = statsType === 'general' ? 'Promedio Semanal' : 'Total Vendido';

        // Prepare data in the desired format for Excel export
        const dataToExport = _lastStatsData.map(p => {
            let displayQuantity = 0;
            let displayUnit = 'Unds';
             // Calculate average for 'general', otherwise use total
            const totalForPeriod = statsType === 'general' ? (p.totalUnidades / _lastNumWeeks) : p.totalUnidades;

            // Determine display unit based on ventaPor
             if (p.ventaPor?.cj && p.unidadesPorCaja > 0) {
                displayQuantity = (totalForPeriod / p.unidadesPorCaja).toFixed(1);
                 if (displayQuantity.endsWith('.0')) displayQuantity = displayQuantity.slice(0, -2);
                displayUnit = 'Cajas';
            } else if (p.ventaPor?.paq && p.unidadesPorPaquete > 0) {
                displayQuantity = (totalForPeriod / p.unidadesPorPaquete).toFixed(1);
                 if (displayQuantity.endsWith('.0')) displayQuantity = displayQuantity.slice(0, -2);
                displayUnit = 'Paq.';
            } else {
                displayQuantity = totalForPeriod.toFixed(0);
            }

            // Return object for json_to_sheet
            return {
                'Producto': p.presentacion,
                [headerTitle]: `${displayQuantity} ${displayUnit}` // Combine value and unit
            };
        });

        // Create worksheet and workbook
        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Estadisticas');

        // Generate filename and trigger download
        const rubro = document.getElementById('stats-rubro-filter').value;
        const today = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(wb, `Estadisticas_${rubro}_${statsType}_${today}.xlsx`);
    }



    // --- Lógica de Clientes Consolidados ---

    async function showConsolidatedClientsView() {
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl">
                        <h1 class="text-3xl font-bold text-gray-800 mb-6 text-center">Clientes Consolidados</h1>
                        <div id="consolidated-clients-filters"></div>
                        <div id="consolidated-clients-container" class="overflow-x-auto max-h-96">
                             <p class="text-center text-gray-500">Cargando clientes...</p>
                        </div>
                        <div class="mt-6 flex flex-col sm:flex-row gap-4">
                            <button id="backToDataMenuBtn" class="w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver</button>
                            <button id="downloadClientsBtn" class="w-full px-6 py-3 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 hidden">Descargar Lista Actual</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('backToDataMenuBtn').addEventListener('click', showDataView);
        document.getElementById('downloadClientsBtn').addEventListener('click', handleDownloadFilteredClients);

        await loadAndRenderConsolidatedClients();
    }

    async function loadAndRenderConsolidatedClients() {
        const container = document.getElementById('consolidated-clients-container');
        const filtersContainer = document.getElementById('consolidated-clients-filters');
        if(!container || !filtersContainer) return;

        try {
            // Use the consistent public path
            const clientesRef = _collection(_db, `artifacts/ventas-9a210/public/data/clientes`);
            const allClientSnapshots = await _getDocs(clientesRef);

            _consolidatedClientsCache = allClientSnapshots.docs.map(doc => ({id: doc.id, ...doc.data()})); // Include ID

            // Setup Filters
            filtersContainer.innerHTML = `
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 border rounded-lg bg-gray-50">
                    <input type="text" id="client-search-input" placeholder="Buscar por Nombre, Personal o CEP..." class="md:col-span-2 w-full px-4 py-2 border rounded-lg text-sm">
                    <div>
                        <label for="client-filter-sector" class="block text-xs font-medium text-gray-600 mb-1">Sector</label>
                        <select id="client-filter-sector" class="w-full px-2 py-1 border rounded-lg text-sm"><option value="">Todos</option></select>
                    </div>
                     <button id="clear-client-filters-btn" class="bg-gray-300 text-xs font-semibold rounded-lg self-end py-1.5 px-3 hover:bg-gray-400 mt-3 md:mt-0">Limpiar</button>
                </div>
            `;

            // Populate Sector Filter
            const uniqueSectors = [...new Set(_consolidatedClientsCache.map(c => c.sector).filter(Boolean))].sort(); // Filter out undefined/null sectors
            const sectorFilter = document.getElementById('client-filter-sector');
            uniqueSectors.forEach(sector => {
                const option = document.createElement('option');
                 option.value = sector;
                 option.textContent = sector;
                 sectorFilter.appendChild(option);
            });

            // Add Filter Event Listeners
            document.getElementById('client-search-input').addEventListener('input', renderConsolidatedClientsList);
            sectorFilter.addEventListener('change', renderConsolidatedClientsList);
             document.getElementById('clear-client-filters-btn').addEventListener('click', () => {
                 document.getElementById('client-search-input').value = '';
                 sectorFilter.value = '';
                 renderConsolidatedClientsList();
             });


            renderConsolidatedClientsList(); // Initial render
            document.getElementById('downloadClientsBtn').classList.remove('hidden');

        } catch (error) {
            console.error("Error al cargar clientes consolidados:", error);
            container.innerHTML = `<p class="text-center text-red-500 p-4">Ocurrió un error al cargar los clientes.</p>`;
        }
    }


    function renderConsolidatedClientsList() {
        const container = document.getElementById('consolidated-clients-container');
        const searchInput = document.getElementById('client-search-input');
        const sectorFilter = document.getElementById('client-filter-sector');

        if (!container || !searchInput || !sectorFilter) return;

        const searchTerm = searchInput.value.toLowerCase();
        const selectedSector = sectorFilter.value;

        _filteredClientsCache = _consolidatedClientsCache.filter(client => {
            const nombreComercialLower = (client.nombreComercial || '').toLowerCase();
            const nombrePersonalLower = (client.nombrePersonal || '').toLowerCase();
            const codigoCEPLower = (client.codigoCEP || '').toLowerCase();

            const searchMatch = !searchTerm ||
                                nombreComercialLower.includes(searchTerm) ||
                                nombrePersonalLower.includes(searchTerm) ||
                                (client.codigoCEP && codigoCEPLower.includes(searchTerm)); // Ensure codigoCEP exists

            const sectorMatch = !selectedSector || client.sector === selectedSector;

            return searchMatch && sectorMatch;
        });

        if (_filteredClientsCache.length === 0) {
            container.innerHTML = `<p class="text-center text-gray-500 p-4">No se encontraron clientes que coincidan con los filtros.</p>`;
            return;
        }

        let tableHTML = `
            <table class="min-w-full bg-white text-sm">
                <thead class="bg-gray-200 sticky top-0 z-10">
                    <tr>
                        <th class="py-2 px-3 border-b text-left">Sector</th>
                        <th class="py-2 px-3 border-b text-left">Nombre Comercial</th>
                        <th class="py-2 px-3 border-b text-left">Nombre Personal</th>
                        <th class="py-2 px-3 border-b text-left">Teléfono</th>
                        <th class="py-2 px-3 border-b text-left">CEP</th>
                    </tr>
                </thead>
                <tbody>`;
        _filteredClientsCache.sort((a,b) => (a.nombreComercial || '').localeCompare(b.nombreComercial || '')).forEach(c => {
            tableHTML += `
                <tr class="hover:bg-gray-50 border-b">
                    <td class="py-2 px-3">${c.sector || 'N/A'}</td>
                    <td class="py-2 px-3 font-semibold">${c.nombreComercial || 'N/A'}</td>
                    <td class="py-2 px-3">${c.nombrePersonal || 'N/A'}</td>
                    <td class="py-2 px-3">${c.telefono || 'N/A'}</td>
                    <td class="py-2 px-3">${c.codigoCEP || 'N/A'}</td>
                </tr>
            `;
        });
        tableHTML += '</tbody></table>';
        container.innerHTML = tableHTML;
    }


    function handleDownloadFilteredClients() {
         if (typeof XLSX === 'undefined') {
            _showModal('Error', 'La librería para exportar a Excel no está cargada.');
            return;
        }
        if (_filteredClientsCache.length === 0) {
            _showModal('Aviso', 'No hay clientes en la lista actual para descargar.');
            return;
        }

        const dataToExport = _filteredClientsCache.map(c => ({
            'Sector': c.sector || '',
            'Nombre Comercial': c.nombreComercial || '',
            'Nombre Personal': c.nombrePersonal || '',
            'Telefono': c.telefono || '', // Corrected key to match import format
            'CEP': c.codigoCEP || '',
             'Coordenadas': c.coordenadas || '' // Include coordinates if available
             // Add saldoVacios if needed, requires formatting
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Clientes Consolidados');

        const today = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(wb, `Clientes_Consolidados_${today}.xlsx`);
    }


    // --- Lógica del Mapa de Clientes ---

    /**
     * Muestra la vista del mapa con los clientes.
     */
    function showClientMapView() {
        if (mapInstance) {
            mapInstance.remove();
            mapInstance = null;
        }
        _floatingControls.classList.add('hidden');
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl">
                        <h1 class="text-3xl font-bold text-gray-800 mb-4 text-center">Mapa de Clientes Consolidados</h1>
                        <div class="relative mb-4">
                            <input type="text" id="map-search-input" placeholder="Buscar cliente por nombre o CEP..." class="w-full px-4 py-2 border rounded-lg">
                            <div id="map-search-results" class="absolute z-[1000] w-full bg-white border rounded-lg mt-1 max-h-60 overflow-y-auto hidden shadow-lg"></div>
                        </div>
                        <div class="mb-4 p-2 bg-gray-100 border rounded-lg text-xs flex flex-wrap justify-center items-center gap-x-4 gap-y-1">
                           <span class="flex items-center"><img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png" style="height: 20px; display: inline-block; margin-right: 2px;"> Cliente Regular</span>
                           <span class="flex items-center"><img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png" style="height: 20px; display: inline-block; margin-right: 2px;"> Cliente con CEP</span>
                        </div>
                        <div id="client-map" class="w-full rounded-lg shadow-inner" style="height: 65vh; border: 1px solid #ccc; background-color: #e5e7eb;">
                            <p class="text-center text-gray-500 pt-10">Cargando mapa...</p>
                        </div>
                        <button id="backToDataMenuBtn" class="mt-6 w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver</button>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('backToDataMenuBtn').addEventListener('click', showDataView);
        loadAndDisplayMap();
    }


    /**
     * Carga los datos de los clientes y los muestra en el mapa.
     */
    async function loadAndDisplayMap() {
        const mapContainer = document.getElementById('client-map');
        if (!mapContainer || typeof L === 'undefined') {
            mapContainer.innerHTML = '<p class="text-center text-red-500 pt-10">Error: La librería de mapas (Leaflet) no está cargada.</p>';
            return;
        }

        try {
            // Use cached data if available and recent, otherwise fetch
             if (_consolidatedClientsCache.length === 0) {
                 console.log("Fetching client data for map...");
                 const clientesRef = _collection(_db, `artifacts/ventas-9a210/public/data/clientes`);
                 const allClientSnapshots = await _getDocs(clientesRef);
                 _consolidatedClientsCache = allClientSnapshots.docs.map(doc => ({id: doc.id, ...doc.data()}));
             } else {
                 console.log("Using cached client data for map.");
             }

            const clientsWithCoords = _consolidatedClientsCache.filter(c => {
                if (!c.coordenadas) return false;
                 // Basic validation: check for comma and parseable numbers
                 const parts = c.coordenadas.split(',');
                 if (parts.length !== 2) return false;
                 const lat = parseFloat(parts[0].trim());
                 const lon = parseFloat(parts[1].trim());
                // Check if parsing resulted in valid numbers and reasonable bounds (e.g., for Venezuela)
                 return !isNaN(lat) && !isNaN(lon) && lat >= 0 && lat <= 13 && lon >= -74 && lon <= -59;
            });

            if (clientsWithCoords.length === 0) {
                mapContainer.innerHTML = '<p class="text-center text-gray-500 pt-10">No se encontraron clientes con coordenadas válidas en la región.</p>';
                return;
            }

            // Default center if no clients have coords (should not happen due to check above)
            let mapCenter = [7.77, -72.22]; // San Cristóbal
            let defaultZoom = 13;

            mapInstance = L.map('client-map').setView(mapCenter, defaultZoom);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                maxZoom: 19 // Allow closer zoom
            }).addTo(mapInstance);

            const redIcon = new L.Icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
            });
            const blueIcon = new L.Icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
            });

            mapMarkers.clear();
            const markerGroup = [];
            clientsWithCoords.forEach(client => {
                 try {
                     const coords = client.coordenadas.split(',').map(p => parseFloat(p.trim()));
                     const hasCEP = client.codigoCEP && client.codigoCEP.toLowerCase() !== 'n/a';
                     const icon = hasCEP ? blueIcon : redIcon;

                     const popupContent = `
                         <b class="text-sm">${client.nombreComercial}</b><br>
                         <span class="text-xs">${client.nombrePersonal || ''}</span><br>
                         <span class="text-xs">Tel: ${client.telefono || 'N/A'}</span><br>
                         <span class="text-xs">Sector: ${client.sector || 'N/A'}</span>
                         ${hasCEP ? `<br><b class="text-xs">CEP: ${client.codigoCEP}</b>` : ''}
                         <br><a href="https://www.google.com/maps?q=${coords[0]},${coords[1]}" target="_blank" class="text-xs text-blue-600 hover:underline">Ver en Google Maps</a>
                     `;

                     const marker = L.marker(coords, {icon: icon})
                                     .bindPopup(popupContent, { minWidth: 150 }); // Set minWidth for popup
                     markerGroup.push(marker);
                     // Use ID as key for marker map for stability
                     mapMarkers.set(client.id, marker);
                 } catch (coordError) {
                      console.warn(`Error processing coordinates for client ${client.nombreComercial}: ${client.coordenadas}`, coordError);
                 }
            });

            if(markerGroup.length > 0) {
                 const group = L.featureGroup(markerGroup).addTo(mapInstance); // Add markers to map
                 // Fit map bounds to markers, with padding
                 mapInstance.fitBounds(group.getBounds().pad(0.1));
            } else {
                 // Fallback if no valid markers could be created
                  mapContainer.innerHTML = '<p class="text-center text-gray-500 pt-10">No se pudieron mostrar clientes en el mapa (error de coordenadas).</p>';
                  return; // Stop execution
            }


            setupMapSearch(clientsWithCoords); // Pass only clients that have coords

        } catch (error) {
            console.error("Error al cargar el mapa de clientes:", error);
            mapContainer.innerHTML = `<p class="text-center text-red-500 pt-10">Ocurrió un error al cargar los datos para el mapa.</p>`;
        }
    }


    function setupMapSearch(clientsWithCoords) { // Accept only clients with coordinates
        const searchInput = document.getElementById('map-search-input');
        const resultsContainer = document.getElementById('map-search-results');
        if (!searchInput || !resultsContainer) return;

        searchInput.addEventListener('input', () => {
            const searchTerm = searchInput.value.toLowerCase().trim();
            if (searchTerm.length < 2) {
                resultsContainer.innerHTML = '';
                resultsContainer.classList.add('hidden');
                return;
            }

            const filteredClients = clientsWithCoords.filter(client => // Filter from pre-filtered list
                (client.nombreComercial || '').toLowerCase().includes(searchTerm) ||
                (client.nombrePersonal || '').toLowerCase().includes(searchTerm) ||
                (client.codigoCEP && client.codigoCEP.toLowerCase().includes(searchTerm))
            );

            if (filteredClients.length === 0) {
                resultsContainer.innerHTML = '<div class="p-2 text-gray-500 text-sm">No se encontraron clientes.</div>';
                resultsContainer.classList.remove('hidden');
                return;
            }

            resultsContainer.innerHTML = filteredClients.slice(0, 10).map(client => `
                <div class="p-2 hover:bg-gray-100 cursor-pointer border-b last:border-b-0" data-client-id="${client.id}">
                    <p class="font-semibold text-sm">${client.nombreComercial}</p>
                    <p class="text-xs text-gray-600">${client.nombrePersonal || ''} ${client.codigoCEP && client.codigoCEP !== 'N/A' ? `(${client.codigoCEP})` : ''}</p>
                </div>
            `).join('');
            resultsContainer.classList.remove('hidden');
        });

        resultsContainer.addEventListener('click', (e) => {
            const target = e.target.closest('[data-client-id]');
            if (target && mapInstance) {
                const clientId = target.dataset.clientId;
                const marker = mapMarkers.get(clientId); // Find marker by ID
                if (marker) {
                    mapInstance.flyTo(marker.getLatLng(), 17); // Zoom closer
                    marker.openPopup();
                }
                searchInput.value = ''; // Clear search
                resultsContainer.innerHTML = '';
                resultsContainer.classList.add('hidden');
            }
        });

        // Hide results if clicked outside search input or results list
        document.addEventListener('click', function(event) {
            if (!resultsContainer.contains(event.target) && event.target !== searchInput) {
                resultsContainer.classList.add('hidden');
            }
        });
    }



    // Exponer funciones públicas al objeto window
    window.dataModule = {
        showClosingDetail,
        handleDownloadSingleClosing
    };

})();
