(function() {
    let _db, _appId, _userId, _mainContent, _floatingControls, _showMainMenu, _showModal;
    let _collection, _getDocs, _query, _where, _orderBy, _populateDropdown, _writeBatch, _doc, _getDoc, _deleteDoc;

    let _lastStatsData = [];
    let _lastNumWeeks = 1;
    let _consolidatedClientsCache = [];
    let _filteredClientsCache = [];

    let _segmentoOrderCacheData = null;
    let _rubroOrderCacheData = null;

    let mapInstance = null;
    let mapMarkers = new Map();

    window.initData = function(dependencies) {
        _db = dependencies.db;
        _appId = dependencies.appId;
        _userId = dependencies.userId;
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
        _writeBatch = dependencies.writeBatch;
        _doc = dependencies.doc;
        _getDoc = dependencies.getDoc;
        _deleteDoc = dependencies.deleteDoc;

        if (!_floatingControls) {
            console.warn("Data Init Warning: floatingControls not provided.");
        }
    };

    async function populateUserFilter() {
        const userFilterSelect = document.getElementById('userFilter');
        if (!userFilterSelect) return;

        try {
            const usersRef = _collection(_db, "users");
            const snapshot = await _getDocs(usersRef);
            userFilterSelect.innerHTML = '<option value="">Todos los Vendedores</option>';
            const users = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .sort((a, b) => {
                    const nameA = `${a.nombre || ''} ${a.apellido || ''}`.trim() || a.email || '';
                    const nameB = `${b.nombre || ''} ${b.apellido || ''}`.trim() || b.email || '';
                    return nameA.localeCompare(nameB);
                });

            users.forEach(user => {
                const option = document.createElement('option');
                option.value = user.id;
                const userName = (user.nombre || user.apellido)
                    ? `${user.nombre || ''} ${user.apellido || ''}`.trim()
                    : user.email;
                option.textContent = `${userName} (${user.camion || 'N/A'})`;
                userFilterSelect.appendChild(option);
            });
        } catch (error) {
            console.error("Error al cargar usuarios para el filtro:", error);
            userFilterSelect.innerHTML = '<option value="">Error al cargar</option>';
        }
    }

    async function handleSearchClosings() {
        const container = document.getElementById('cierres-list-container');
        if (!container) return;
        container.innerHTML = `<p class="text-center text-gray-500">Buscando...</p>`;

        const selectedUserId = document.getElementById('userFilter')?.value;
        const fechaDesdeStr = document.getElementById('fechaDesde')?.value;
        const fechaHastaStr = document.getElementById('fechaHasta')?.value;

        if (selectedUserId === undefined || fechaDesdeStr === undefined || fechaHastaStr === undefined) {
             console.error("Error: Uno o más elementos del formulario de búsqueda no se encontraron.");
             _showModal('Error Interno', 'No se pudieron encontrar los controles de búsqueda.');
             container.innerHTML = `<p class="text-center text-red-500">Error interno al buscar.</p>`;
             return;
        }

        if (!fechaDesdeStr || !fechaHastaStr) {
            _showModal('Error', 'Por favor, seleccione ambas fechas.');
            container.innerHTML = `<p class="text-center text-gray-500">Seleccione las opciones para buscar.</p>`;
            return;
        }

        let fechaDesde, fechaHasta;
        try {
             fechaDesde = new Date(fechaDesdeStr + 'T00:00:00');
             fechaHasta = new Date(fechaHastaStr + 'T23:59:59.999');
             if (isNaN(fechaDesde.getTime()) || isNaN(fechaHasta.getTime())) {
                 throw new Error("Formato de fecha inválido.");
             }
             if (fechaDesde > fechaHasta) {
                 _showModal('Error', 'La fecha "Desde" no puede ser posterior a la fecha "Hasta".');
                 container.innerHTML = `<p class="text-center text-gray-500">Seleccione un rango de fechas válido.</p>`;
                 return;
             }
        } catch(dateError) {
             console.error("Error parsing dates:", dateError);
             _showModal('Error', 'Hubo un problema con las fechas seleccionadas.');
             container.innerHTML = `<p class="text-center text-red-500">Error en las fechas.</p>`;
             return;
        }

        try {
            const closingsRef = _collection(_db, `public_data/${_appId}/user_closings`);
            const { Timestamp } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js");
            let q = _query(closingsRef,
                _where("fecha", ">=", Timestamp.fromDate(fechaDesde)),
                _where("fecha", "<=", Timestamp.fromDate(fechaHasta))
            );

            if (selectedUserId) {
                q = _query(q, _where("vendedorInfo.userId", "==", selectedUserId));
            }

            const snapshot = await _getDocs(q);
            let closings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            window.tempClosingsData = closings;
            renderClosingsList(closings);

        } catch (error) {
            console.error("Error al buscar cierres:", error);
            if (error.code === 'failed-precondition') {
                 container.innerHTML = `<p class="text-center text-red-500">Error: Se requiere un índice de Firestore para esta consulta. <a href="https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/indexes" target="_blank" rel="noopener noreferrer" class="underline">Crear índice aquí</a> o contacta al administrador.</p>`;
                 _showModal('Error de Índice Requerido', `Firestore necesita un índice para esta consulta. El mensaje de error sugiere crearlo: <pre class="text-xs bg-gray-100 p-2 rounded overflow-auto">${error.message}</pre> Por favor, créalo desde la consola de Firebase o contacta al administrador.`);
            } else {
                 container.innerHTML = `<p class="text-center text-red-500">Ocurrió un error al buscar los cierres: ${error.message}</p>`;
            }
        }
    }

    function renderClosingsList(closings) {
        const container = document.getElementById('cierres-list-container');
        if (!container) return;
        if (!Array.isArray(closings)) {
            console.error("renderClosingsList: closings is not an array", closings);
            container.innerHTML = `<p class="text-center text-red-500">Error interno al procesar los resultados.</p>`;
            return;
        }
        if (closings.length === 0) {
            container.innerHTML = `<p class="text-center text-gray-500">No se encontraron cierres para los filtros seleccionados.</p>`;
            return;
        }
        closings.sort((a, b) => {
            const dateA = a.fecha?.toDate ? a.fecha.toDate().getTime() : 0;
            const dateB = b.fecha?.toDate ? b.fecha.toDate().getTime() : 0;
            return dateB - dateA;
        });
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
            const vendedorNombreCompleto = (vendedor.nombre || vendedor.apellido)
                ? `${vendedor.nombre || ''} ${vendedor.apellido || ''}`.trim()
                : (vendedor.email || 'Desconocido');
            const fechaCierre = cierre.fecha?.toDate ? cierre.fecha.toDate() : null;
            tableHTML += `
                <tr class="hover:bg-gray-50">
                    <td class="py-2 px-3 border-b">${fechaCierre ? fechaCierre.toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' }) : 'Fecha Inválida'}</td>
                    <td class="py-2 px-3 border-b">${vendedorNombreCompleto}</td>
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

    async function showClosingDataView() {
        if (_floatingControls) _floatingControls.classList.add('hidden');
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
        const fechaDesdeInput = document.getElementById('fechaDesde');
        const fechaHastaInput = document.getElementById('fechaHasta');
        if (fechaDesdeInput) fechaDesdeInput.value = today;
        if (fechaHastaInput) fechaHastaInput.value = today;
        await populateUserFilter();
    };

    window.showDataView = function() {
        if (mapInstance) {
            try { mapInstance.remove(); } catch(e) { console.warn("Error removing map instance:", e); }
            mapInstance = null;
            mapMarkers.clear();
        }
        if (_floatingControls) _floatingControls.classList.add('hidden');
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
                            <button id="dataManagementBtn" class="w-full px-6 py-3 bg-yellow-600 text-white font-semibold rounded-lg shadow-md hover:bg-yellow-700">Limpieza y Gestión de Datos</button>
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
        document.getElementById('dataManagementBtn').addEventListener('click', showDataManagementView);
        document.getElementById('backToMenuBtn').addEventListener('click', _showMainMenu);
    };

    async function getRubroOrderMapData(userIdForData) {
        if (_rubroOrderCacheData && _rubroOrderCacheData.userId === userIdForData) return _rubroOrderCacheData.map;
        const map = {};
        const rubrosRef = _collection(_db, `artifacts/${_appId}/users/${userIdForData}/rubros`);
        try {
            const snapshot = await _getDocs(rubrosRef);
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                map[data.name] = (data.orden !== undefined) ? data.orden : 9999;
            });
            _rubroOrderCacheData = { userId: userIdForData, map: map };
            return map;
        } catch (e) {
            console.warn(`No se pudo obtener el orden de los rubros para ${userIdForData} en data.js`, e);
            return {};
        }
    }

    async function getSegmentoOrderMapData(userIdForData) {
        if (_segmentoOrderCacheData && _segmentoOrderCacheData.userId === userIdForData) return _segmentoOrderCacheData.map;
        const map = {};
        const segmentosRef = _collection(_db, `artifacts/${_appId}/users/${userIdForData}/segmentos`);
        try {
            const snapshot = await _getDocs(segmentosRef);
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                map[data.name] = (data.orden !== undefined) ? data.orden : 9999;
            });
             _segmentoOrderCacheData = { userId: userIdForData, map: map };
            return map;
        } catch (e) {
            console.warn(`No se pudo obtener el orden de los segmentos para ${userIdForData} en data.js`, e);
            return {};
        }
    }

    async function processSalesDataForReport(ventas, userIdForInventario) {
        if (_rubroOrderCacheData?.userId !== userIdForInventario) _rubroOrderCacheData = null;
        if (_segmentoOrderCacheData?.userId !== userIdForInventario) _segmentoOrderCacheData = null;
        const clientData = {};
        let grandTotalValue = 0;
        const allProductsMap = new Map();
        const vaciosMovementsPorTipo = {};
        let inventarioMap = new Map();
        try {
            const inventarioRef = _collection(_db, `artifacts/${_appId}/users/${userIdForInventario}/inventario`);
            const inventarioSnapshot = await _getDocs(inventarioRef);
            inventarioMap = new Map(inventarioSnapshot.docs.map(doc => [doc.id, doc.data()]));
        } catch(invError) {
             console.error(`Error grave al leer inventario de ${userIdForInventario}:`, invError);
             _showModal('Error de Datos', `No se pudo leer el inventario del vendedor para generar el reporte. ${invError.message}`);
             return { clientData: {}, grandTotalValue: 0, sortedClients: [], groupedProducts: {}, finalProductOrder: [], sortedRubros: [], segmentoOrderMap: {}, vaciosMovementsPorTipo: {}, allProductsMap: new Map() };
        }
        ventas.forEach(venta => {
            const clientName = venta.clienteNombre || 'Cliente Desconocido';
            if (!clientData[clientName]) clientData[clientName] = { products: {}, totalValue: 0 };
             if (!vaciosMovementsPorTipo[clientName]) {
                 vaciosMovementsPorTipo[clientName] = {};
                 const TIPOS_VACIO = ["1/4 - 1/3", "ret 350 ml", "ret 1.25 Lts"];
                 TIPOS_VACIO.forEach(tipo => vaciosMovementsPorTipo[clientName][tipo] = { entregados: 0, devueltos: 0 });
             }
            clientData[clientName].totalValue += venta.total || 0;
            grandTotalValue += venta.total || 0;
             const vaciosDevueltosEnVenta = venta.vaciosDevueltosPorTipo || {};
             for (const tipoVacio in vaciosDevueltosEnVenta) {
                 if (vaciosMovementsPorTipo[clientName][tipoVacio]) {
                     vaciosMovementsPorTipo[clientName][tipoVacio].devueltos += vaciosDevueltosEnVenta[tipoVacio] || 0;
                 } else {
                      console.warn(`Tipo de vacío '${tipoVacio}' encontrado en venta pero no inicializado para cliente ${clientName}.`);
                 }
             }
            (venta.productos || []).forEach(p => {
                 const productoCompleto = inventarioMap.get(p.id) || p;
                 const tipoVacioProd = productoCompleto.tipoVacio;
                 if (productoCompleto.manejaVacios && tipoVacioProd && vaciosMovementsPorTipo[clientName]?.[tipoVacioProd]) {
                     vaciosMovementsPorTipo[clientName][tipoVacioProd].entregados += p.cantidadVendida?.cj || 0;
                 }
                const rubro = productoCompleto.rubro || 'Sin Rubro';
                const segmento = productoCompleto.segmento || 'Sin Segmento';
                const marca = productoCompleto.marca || 'Sin Marca';
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
                if (!clientData[clientName].products[p.id]) clientData[clientName].products[p.id] = 0;
                clientData[clientName].products[p.id] += p.totalUnidadesVendidas || 0;
            });
        });
        const sortedClients = Object.keys(clientData).sort();
        const groupedProducts = {};
        for (const product of allProductsMap.values()) {
             const rubroKey = product.rubro || 'Sin Rubro';
             const segmentoKey = product.segmento || 'Sin Segmento';
             const marcaKey = product.marca || 'Sin Marca';
            if (!groupedProducts[rubroKey]) groupedProducts[rubroKey] = {};
            if (!groupedProducts[rubroKey][segmentoKey]) groupedProducts[rubroKey][segmentoKey] = {};
            if (!groupedProducts[rubroKey][segmentoKey][marcaKey]) groupedProducts[rubroKey][segmentoKey][marcaKey] = [];
            groupedProducts[rubroKey][segmentoKey][marcaKey].push(product);
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
                    const sortedPresentaciones = groupedProducts[rubro][segmento][marca].sort((a,b) => (a.presentacion || '').localeCompare(b.presentacion || ''));
                    finalProductOrder.push(...sortedPresentaciones);
                });
            });
        });
        return { clientData, grandTotalValue, sortedClients, groupedProducts, finalProductOrder, sortedRubros, segmentoOrderMap, vaciosMovementsPorTipo, allProductsMap };
    }

    async function showClosingDetail(closingId) {
        if (!window.tempClosingsData || !Array.isArray(window.tempClosingsData)) {
            _showModal('Error', 'Los datos de la búsqueda de cierres no están disponibles. Por favor, realiza la búsqueda de nuevo.');
            return;
        }
        const closingData = window.tempClosingsData.find(c => c.id === closingId);
        if (!closingData || !closingData.vendedorInfo || !closingData.vendedorInfo.userId) {
            _showModal('Error', 'No se pudieron cargar los detalles del cierre seleccionado o falta información del vendedor.');
            return;
        }
        _showModal('Progreso', 'Generando reporte detallado...');
        try {
            const { clientData, grandTotalValue, sortedClients, groupedProducts, finalProductOrder, sortedRubros, segmentoOrderMap, vaciosMovementsPorTipo, allProductsMap } = await processSalesDataForReport(closingData.ventas || [], closingData.vendedorInfo.userId);
            let headerRow1 = `<tr class="sticky top-0 z-20"><th rowspan="4" class="p-1 border bg-gray-200 sticky left-0 z-30">Cliente</th>`;
            let headerRow2 = `<tr class="sticky z-20" style="top: 25px;">`;
            let headerRow3 = `<tr class="sticky z-20" style="top: 50px;">`;
            let headerRow4 = `<tr class="sticky z-20" style="top: 75px;">`;
            sortedRubros.forEach(rubro => {
                let rubroColspan = 0;
                const sortedSegmentos = Object.keys(groupedProducts[rubro] || {}).sort((a, b) => (segmentoOrderMap[a] ?? 999) - (segmentoOrderMap[b] ?? 999));
                sortedSegmentos.forEach(segmento => {
                    const sortedMarcas = Object.keys(groupedProducts[rubro]?.[segmento] || {}).sort();
                    sortedMarcas.forEach(marca => { rubroColspan += groupedProducts[rubro]?.[segmento]?.[marca]?.length || 0; });
                });
                if (rubroColspan > 0) headerRow1 += `<th colspan="${rubroColspan}" class="p-1 border bg-gray-300">${rubro}</th>`;
                sortedSegmentos.forEach(segmento => {
                    let segmentoColspan = 0;
                    const sortedMarcas = Object.keys(groupedProducts[rubro]?.[segmento] || {}).sort();
                    sortedMarcas.forEach(marca => { segmentoColspan += groupedProducts[rubro]?.[segmento]?.[marca]?.length || 0; });
                     if (segmentoColspan > 0) headerRow2 += `<th colspan="${segmentoColspan}" class="p-1 border bg-gray-200">${segmento}</th>`;
                    sortedMarcas.forEach(marca => {
                        const marcaColspan = groupedProducts[rubro]?.[segmento]?.[marca]?.length || 0;
                         if (marcaColspan > 0) headerRow3 += `<th colspan="${marcaColspan}" class="p-1 border bg-gray-100">${marca}</th>`;
                        const sortedPresentaciones = (groupedProducts[rubro]?.[segmento]?.[marca] || []).sort((a,b) => (a.presentacion || '').localeCompare(b.presentacion || ''));
                        sortedPresentaciones.forEach(producto => { headerRow4 += `<th class="p-1 border bg-gray-50 whitespace-nowrap">${producto.presentacion}</th>`; });
                    });
                });
            });
            headerRow1 += `<th rowspan="4" class="p-1 border bg-gray-200 sticky right-0 z-30">Total Cliente</th></tr>`;
            headerRow2 += `</tr>`; headerRow3 += `</tr>`; headerRow4 += `</tr>`;
            let bodyHTML = '';
            sortedClients.forEach(clientName => {
                bodyHTML += `<tr class="hover:bg-blue-50"><td class="p-1 border font-medium bg-white sticky left-0 z-10">${clientName}</td>`;
                const currentClient = clientData[clientName];
                finalProductOrder.forEach(product => {
                    const quantityInUnits = currentClient.products?.[product.id] || 0;
                    let displayQuantity = '';
                    if (quantityInUnits > 0) {
                        displayQuantity = `${quantityInUnits} Unds`;
                        const ventaPor = product.ventaPor || {};
                        const unidadesPorCaja = product.unidadesPorCaja || 1;
                        const unidadesPorPaquete = product.unidadesPorPaquete || 1;
                        if (ventaPor.cj && unidadesPorCaja > 0) { const totalBoxes = quantityInUnits / unidadesPorCaja; displayQuantity = `${Number.isInteger(totalBoxes) ? totalBoxes : totalBoxes.toFixed(1)} Cj`; }
                        else if (ventaPor.paq && unidadesPorPaquete > 0) { const totalPackages = quantityInUnits / unidadesPorPaquete; displayQuantity = `${Number.isInteger(totalPackages) ? totalPackages : totalPackages.toFixed(1)} Paq`; }
                    }
                    bodyHTML += `<td class="p-1 border text-center">${displayQuantity}</td>`;
                });
                bodyHTML += `<td class="p-1 border text-right font-semibold bg-white sticky right-0 z-10">$${(currentClient.totalValue || 0).toFixed(2)}</td></tr>`;
            });
            let footerHTML = '<tr class="bg-gray-200 font-bold"><td class="p-1 border sticky left-0 z-10">TOTALES</td>';
            finalProductOrder.forEach(product => {
                let totalQty = 0;
                sortedClients.forEach(clientName => { totalQty += clientData[clientName]?.products?.[product.id] || 0; });
                let displayTotal = '';
                if (totalQty > 0) {
                    displayTotal = `${totalQty} Unds`;
                    const ventaPor = product.ventaPor || {};
                    const unidadesPorCaja = product.unidadesPorCaja || 1;
                    const unidadesPorPaquete = product.unidadesPorPaquete || 1;
                    if (ventaPor.cj && unidadesPorCaja > 0) { const totalBoxes = totalQty / unidadesPorCaja; displayTotal = `${Number.isInteger(totalBoxes) ? totalBoxes : totalBoxes.toFixed(1)} Cj`; }
                    else if (ventaPor.paq && unidadesPorPaquete > 0) { const totalPackages = totalQty / unidadesPorPaquete; displayTotal = `${Number.isInteger(totalPackages) ? totalPackages : totalPackages.toFixed(1)} Paq`; }
                }
                footerHTML += `<td class="p-1 border text-center">${displayTotal}</td>`;
            });
            footerHTML += `<td class="p-1 border text-right sticky right-0 z-10">$${(grandTotalValue || 0).toFixed(2)}</td></tr>`;
            let vaciosReportHTML = '';
             const TIPOS_VACIO = ["1/4 - 1/3", "ret 350 ml", "ret 1.25 Lts"];
             const tiposConMovimiento = TIPOS_VACIO.filter(tipo => sortedClients.some(cliente => (vaciosMovementsPorTipo[cliente]?.[tipo]?.entregados || 0) > 0 || (vaciosMovementsPorTipo[cliente]?.[tipo]?.devueltos || 0) > 0));
            if (tiposConMovimiento.length > 0) {
                vaciosReportHTML = `<h3 class="text-xl font-bold text-gray-800 my-6">Reporte de Envases Retornables (Vacíos) por Tipo</h3>`;
                tiposConMovimiento.forEach(tipoVacio => {
                    vaciosReportHTML += `<h4 class="text-lg font-semibold text-gray-700 mt-4 mb-2">${tipoVacio}</h4><div class="overflow-auto border mb-4"><table class="min-w-full bg-white text-xs"><thead class="bg-gray-200"><tr><th class="p-1 border text-left">Cliente</th><th class="p-1 border text-center">Entregados (Cajas)</th><th class="p-1 border text-center">Devueltos (Cajas)</th><th class="p-1 border text-center">Neto</th></tr></thead><tbody>`;
                    const clientesDelTipo = sortedClients.filter(cliente => (vaciosMovementsPorTipo[cliente]?.[tipoVacio]?.entregados || 0) > 0 || (vaciosMovementsPorTipo[cliente]?.[tipoVacio]?.devueltos || 0) > 0);
                    clientesDelTipo.forEach(cliente => {
                        const mov = vaciosMovementsPorTipo[cliente]?.[tipoVacio] || { entregados: 0, devueltos: 0 };
                        const neto = mov.entregados - mov.devueltos;
                        vaciosReportHTML += `<tr class="hover:bg-blue-50"><td class="p-1 border">${cliente}</td><td class="p-1 border text-center">${mov.entregados}</td><td class="p-1 border text-center">${mov.devueltos}</td><td class="p-1 border text-center font-bold">${neto > 0 ? `+${neto}` : (neto < 0 ? neto : '0')}</td></tr>`;
                    });
                    vaciosReportHTML += '</tbody></table></div>';
                });
            }
            const vendedor = closingData.vendedorInfo || {};
            const fechaCierreModal = closingData.fecha?.toDate ? closingData.fecha.toDate() : null;
            const reporteHTML = `<div class="text-left max-h-[80vh] overflow-auto"><div class="mb-4"><p><strong>Vendedor:</strong> ${vendedor.nombre || ''} ${vendedor.apellido || ''}</p><p><strong>Camión:</strong> ${vendedor.camion || 'N/A'}</p><p><strong>Fecha:</strong> ${fechaCierreModal ? fechaCierreModal.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : 'Fecha Inválida'}</p></div><h3 class="text-xl font-bold text-gray-800 mb-4">Reporte de Cierre de Ventas</h3><div class="overflow-auto border"><table class="min-w-full bg-white text-xs"><thead class="bg-gray-200">${headerRow1}${headerRow2}${headerRow3}${headerRow4}</thead><tbody>${bodyHTML}</tbody><tfoot>${footerHTML}</tfoot></table></div>${vaciosReportHTML}</div>`;
            _showModal(`Detalle del Cierre`, reporteHTML);
        } catch (reportError) {
             console.error("Error generating closing detail report:", reportError);
             _showModal('Error', `No se pudo generar el reporte detallado: ${reportError.message}`);
        }
    }

    async function exportSingleClosingToExcel(closingData) {
        if (typeof XLSX === 'undefined') throw new Error('La librería para exportar a Excel (XLSX) no está cargada.');
        if (!closingData || !closingData.vendedorInfo || !closingData.vendedorInfo.userId) throw new Error('Datos del cierre incompletos o inválidos.');
        const { clientData, grandTotalValue, sortedClients, groupedProducts, finalProductOrder, sortedRubros, segmentoOrderMap, vaciosMovementsPorTipo, allProductsMap } = await processSalesDataForReport(closingData.ventas || [], closingData.vendedorInfo.userId);
        const dataForSheet1 = [];
        const merges1 = [];
        const headerRow1 = [""]; const headerRow2 = [""]; const headerRow3 = [""]; const headerRow4 = ["Cliente"];
        let currentColumn = 1;
        sortedRubros.forEach(rubro => {
            const rubroStartCol = currentColumn;
            let rubroColspan = 0;
            const sortedSegmentos = Object.keys(groupedProducts[rubro] || {}).sort((a, b) => (segmentoOrderMap[a] ?? 999) - (segmentoOrderMap[b] ?? 999));
            sortedSegmentos.forEach(segmento => {
                const segmentoStartCol = currentColumn;
                let segmentoColspan = 0;
                const sortedMarcas = Object.keys(groupedProducts[rubro]?.[segmento] || {}).sort();
                sortedMarcas.forEach(marca => {
                    const marcaStartCol = currentColumn;
                    const presentaciones = (groupedProducts[rubro]?.[segmento]?.[marca] || []).sort((a,b) => (a.presentacion || '').localeCompare(b.presentacion || ''));
                    const marcaColspan = presentaciones.length;
                    if (marcaColspan > 0) {
                        rubroColspan += marcaColspan;
                        segmentoColspan += marcaColspan;
                        headerRow3.push(marca);
                        for (let i = 1; i < marcaColspan; i++) headerRow3.push("");
                        if (marcaColspan > 1) merges1.push({ s: { r: 2, c: marcaStartCol }, e: { r: 2, c: marcaStartCol + marcaColspan - 1 } });
                        presentaciones.forEach(p => headerRow4.push(p.presentacion));
                        currentColumn += marcaColspan;
                    }
                });
                if (segmentoColspan > 0) {
                    headerRow2.push(segmento);
                    for (let i = 1; i < segmentoColspan; i++) headerRow2.push("");
                    if (segmentoColspan > 1) merges1.push({ s: { r: 1, c: segmentoStartCol }, e: { r: 1, c: segmentoStartCol + segmentoColspan - 1 } });
                }
            });
            if (rubroColspan > 0) {
                headerRow1.push(rubro);
                for (let i = 1; i < rubroColspan; i++) headerRow1.push("");
                if (rubroColspan > 1) merges1.push({ s: { r: 0, c: rubroStartCol }, e: { r: 0, c: rubroStartCol + rubroColspan - 1 } });
            }
        });
        const totalCols = finalProductOrder.length;
        headerRow1.push(""); headerRow2.push(""); headerRow3.push(""); headerRow4.push("Total Cliente");
        dataForSheet1.push(headerRow1, headerRow2, headerRow3, headerRow4);
        merges1.push({ s: { r: 0, c: 0 }, e: { r: 3, c: 0 } });
        merges1.push({ s: { r: 0, c: totalCols + 1 }, e: { r: 3, c: totalCols + 1 } });
        sortedClients.forEach(clientName => {
            const row = [clientName];
            const currentClient = clientData[clientName];
            finalProductOrder.forEach(product => {
                const quantityInUnits = currentClient.products?.[product.id] || 0;
                let displayQuantity = '';
                if (quantityInUnits > 0) {
                    displayQuantity = `${quantityInUnits} Unds`;
                    const ventaPor = product.ventaPor || {};
                    const unidadesPorCaja = product.unidadesPorCaja || 1;
                    const unidadesPorPaquete = product.unidadesPorPaquete || 1;
                    if (ventaPor.cj && unidadesPorCaja > 0) { const totalBoxes = quantityInUnits / unidadesPorCaja; displayQuantity = `${Number.isInteger(totalBoxes) ? totalBoxes : totalBoxes.toFixed(1)} Cj`; }
                    else if (ventaPor.paq && unidadesPorPaquete > 0) { const totalPackages = quantityInUnits / unidadesPorPaquete; displayQuantity = `${Number.isInteger(totalPackages) ? totalPackages : totalPackages.toFixed(1)} Paq`; }
                }
                row.push(displayQuantity);
            });
            row.push(currentClient.totalValue || 0);
            dataForSheet1.push(row);
        });
        const footerRow = ["TOTALES"];
        finalProductOrder.forEach(product => {
            let totalQty = 0;
            sortedClients.forEach(clientName => totalQty += clientData[clientName]?.products?.[product.id] || 0);
            let displayTotal = '';
            if (totalQty > 0) {
                displayTotal = `${totalQty} Unds`;
                const ventaPor = product.ventaPor || {};
                const unidadesPorCaja = product.unidadesPorCaja || 1;
                const unidadesPorPaquete = product.unidadesPorPaquete || 1;
                if (ventaPor.cj && unidadesPorCaja > 0) { const totalBoxes = totalQty / unidadesPorCaja; displayTotal = `${Number.isInteger(totalBoxes) ? totalBoxes : totalBoxes.toFixed(1)} Cj`; }
                else if (ventaPor.paq && unidadesPorPaquete > 0) { const totalPackages = totalQty / unidadesPorPaquete; displayTotal = `${Number.isInteger(totalPackages) ? totalPackages : totalPackages.toFixed(1)} Paq`; }
            }
            footerRow.push(displayTotal);
        });
        footerRow.push(grandTotalValue || 0);
        dataForSheet1.push(footerRow);
        const ws1 = XLSX.utils.aoa_to_sheet(dataForSheet1);
        ws1['!merges'] = merges1;
         const totalColLetter = XLSX.utils.encode_col(totalCols + 1);
         ws1[`!cols`] = ws1[`!cols`] || [];
         ws1[`!cols`][totalCols + 1] = { wch: 15 };
         for (let R = 4; R < dataForSheet1.length; ++R) {
             const cellRef = `${totalColLetter}${R + 1}`;
             if (ws1[cellRef]) {
                 ws1[cellRef].t = 'n';
                 ws1[cellRef].z = '$#,##0.00';
             }
         }
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws1, 'Reporte de Cierre');
         const TIPOS_VACIO = ["1/4 - 1/3", "ret 350 ml", "ret 1.25 Lts"];
         const tiposConMovimiento = TIPOS_VACIO.filter(tipo => sortedClients.some(cliente => (vaciosMovementsPorTipo[cliente]?.[tipo]?.entregados || 0) > 0 || (vaciosMovementsPorTipo[cliente]?.[tipo]?.devueltos || 0) > 0));
        if (tiposConMovimiento.length > 0) {
             const dataForSheet2 = [['Tipo Vacío', 'Cliente', 'Entregados (Cajas)', 'Devueltos (Cajas)', 'Neto']];
             tiposConMovimiento.forEach(tipoVacio => {
                 const clientesDelTipo = sortedClients.filter(cliente => (vaciosMovementsPorTipo[cliente]?.[tipoVacio]?.entregados || 0) > 0 || (vaciosMovementsPorTipo[cliente]?.[tipoVacio]?.devueltos || 0) > 0);
                 clientesDelTipo.forEach(cliente => {
                    const mov = vaciosMovementsPorTipo[cliente]?.[tipoVacio] || { entregados: 0, devueltos: 0 };
                    const neto = mov.entregados - mov.devueltos;
                    dataForSheet2.push([ tipoVacio, cliente, mov.entregados, mov.devueltos, neto ]);
                 });
             });
            const ws2 = XLSX.utils.aoa_to_sheet(dataForSheet2);
             ws2['!cols'] = [{wch: 20}, {wch: 30}, {wch: 15}, {wch: 15}, {wch: 10}];
            XLSX.utils.book_append_sheet(wb, ws2, 'Reporte de Vacíos');
        }
        const vendedor = closingData.vendedorInfo || {};
        const fechaCierreFile = closingData.fecha?.toDate ? closingData.fecha.toDate() : new Date();
        const fechaStr = fechaCierreFile.toISOString().slice(0, 10);
        const vendedorNombreFile = (`${vendedor.nombre || ''}_${vendedor.apellido || ''}`.trim() || vendedor.email || 'Vendedor').replace(/[^a-z0-9]/gi, '_').toLowerCase();
        XLSX.writeFile(wb, `Cierre_${vendedorNombreFile}_${fechaStr}.xlsx`);
    }

    async function handleDownloadSingleClosing(closingId) {
         if (!window.tempClosingsData || !Array.isArray(window.tempClosingsData)) {
            _showModal('Error', 'Los datos de la búsqueda de cierres no están disponibles. Por favor, realiza la búsqueda de nuevo.');
            return;
        }
        const closingData = window.tempClosingsData.find(c => c.id === closingId);
        if (!closingData) {
            _showModal('Error', 'No se pudieron encontrar los datos del cierre seleccionado para descargar.');
            return;
        }
        _showModal('Progreso', 'Generando archivo Excel...');
        try {
            await exportSingleClosingToExcel(closingData);
            const modalContainer = document.getElementById('modalContainer');
             const modalTitle = modalContainer?.querySelector('h3')?.textContent;
            if (modalContainer && modalTitle === 'Progreso') {
                 modalContainer.classList.add('hidden');
            }
        } catch (error) {
            console.error("Error al exportar cierre individual:", error);
            _showModal('Error', `Ocurrió un error al generar el archivo: ${error.message}`);
        }
    }

    function showProductStatsView() {
        if (_floatingControls) _floatingControls.classList.add('hidden');
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
        _populateDropdown(`artifacts/${_appId}/users/${_userId}/rubros`, 'stats-rubro-filter', 'Rubro');
        document.getElementById('backToDataMenuBtn').addEventListener('click', showDataView);
        document.getElementById('searchStatsBtn').addEventListener('click', handleSearchStats);
    }

     async function handleSearchStats() {
        const container = document.getElementById('stats-list-container');
        if (!container) return;
        container.innerHTML = `<p class="text-center text-gray-500">Calculando estadísticas...</p>`;
        const statsType = document.getElementById('stats-type')?.value;
        const rubroFilter = document.getElementById('stats-rubro-filter')?.value;
         if (!statsType || rubroFilter === undefined) {
             console.error("Error: No se encontraron los elementos del formulario de estadísticas.");
             _showModal('Error Interno', 'No se pudieron encontrar los controles de estadísticas.');
             container.innerHTML = `<p class="text-center text-red-500">Error interno al buscar.</p>`;
             return;
         }
        if (!rubroFilter) {
            _showModal('Error', 'Por favor, seleccione un rubro.');
            container.innerHTML = `<p class="text-center text-gray-500">Seleccione un rubro para continuar.</p>`;
            return;
        }
        const now = new Date();
        let fechaDesde;
        let fechaHasta = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        if (statsType === 'semanal') {
            const dayOfWeek = now.getDay();
            fechaDesde = new Date(now);
            const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
            fechaDesde.setDate(diff);
            fechaDesde.setHours(0, 0, 0, 0);
        } else if (statsType === 'mensual') {
            fechaDesde = new Date(now.getFullYear(), now.getMonth(), 1);
            fechaDesde.setHours(0, 0, 0, 0);
        } else {
            fechaDesde = new Date(0);
        }
        try {
             const { Timestamp } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js");
            const publicClosingsRef = _collection(_db, `public_data/${_appId}/user_closings`);
            const publicQuery = _query(publicClosingsRef, _where("fecha", ">=", Timestamp.fromDate(fechaDesde)), _where("fecha", "<=", Timestamp.fromDate(fechaHasta)));
            const publicSnapshot = await _getDocs(publicQuery);
            const allClosings = publicSnapshot.docs.map(doc => doc.data());
            if (allClosings.length === 0) {
                container.innerHTML = `<p class="text-center text-gray-500">No hay datos de ventas en el período seleccionado.</p>`;
                _lastStatsData = [];
                 const downloadBtn = document.getElementById('downloadStatsBtn');
                 if (downloadBtn) downloadBtn.classList.add('hidden');
                return;
            }
            const productSales = {};
            const adminInventarioRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`);
            const inventarioSnapshot = await _getDocs(adminInventarioRef);
            const adminInventarioMap = new Map(inventarioSnapshot.docs.map(doc => [doc.id, doc.data()]));
            allClosings.forEach(cierre => {
                (cierre.ventas || []).forEach(venta => {
                    (venta.productos || []).forEach(p => {
                        const adminProductInfo = adminInventarioMap.get(p.id);
                        if (adminProductInfo && adminProductInfo.rubro === rubroFilter) {
                            if (!productSales[p.id]) {
                                productSales[p.id] = {
                                    id: p.id,
                                    presentacion: adminProductInfo.presentacion,
                                    marca: adminProductInfo.marca || 'Sin Marca',
                                    segmento: adminProductInfo.segmento || 'Sin Segmento',
                                    totalUnidades: 0,
                                    ventaPor: adminProductInfo.ventaPor,
                                    unidadesPorCaja: adminProductInfo.unidadesPorCaja || 1,
                                    unidadesPorPaquete: adminProductInfo.unidadesPorPaquete || 1
                                };
                            }
                            productSales[p.id].totalUnidades += p.totalUnidadesVendidas || 0;
                        }
                    });
                });
            });
            const productArray = Object.values(productSales);
            let numWeeks = 1;
            if (statsType === 'general') {
                const oneDay = 24 * 60 * 60 * 1000;
                 const firstDate = allClosings.reduce((min, c) => { const cierreDate = c.fecha?.toDate ? c.fecha.toDate() : min; return cierreDate < min ? cierreDate : min; }, new Date());
                 numWeeks = Math.max(1, Math.ceil(Math.abs((now - firstDate) / (oneDay * 7))));
            }
            _lastStatsData = productArray;
            _lastNumWeeks = numWeeks;
            renderStatsList(productArray, statsType, numWeeks);
        } catch (error) {
            console.error("Error al calcular estadísticas:", error);
             if (error.code === 'failed-precondition') {
                 container.innerHTML = `<p class="text-center text-red-500">Error: Se requiere un índice de Firestore para esta consulta (probablemente en 'fecha'). <a href="https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/indexes" target="_blank" rel="noopener noreferrer" class="underline">Crear índice</a>.</p>`;
                 _showModal('Error de Índice Requerido', `Firestore necesita un índice para esta consulta (probablemente en el campo 'fecha'). El mensaje de error sugiere crearlo: <pre class="text-xs bg-gray-100 p-2 rounded overflow-auto">${error.message}</pre>`);
             } else {
                 container.innerHTML = `<p class="text-center text-red-500">Ocurrió un error al calcular las estadísticas: ${error.message}</p>`;
             }
             _lastStatsData = [];
             const downloadBtn = document.getElementById('downloadStatsBtn');
             if (downloadBtn) downloadBtn.classList.add('hidden');
        }
    }

     function renderStatsList(productArray, statsType, numWeeks = 1) {
        const container = document.getElementById('stats-list-container');
        if (!container) return;
        if (!Array.isArray(productArray)) {
             console.error("renderStatsList: productArray is not an array");
             container.innerHTML = `<p class="text-center text-red-500">Error interno al mostrar estadísticas.</p>`;
             return;
        }
        const downloadBtn = document.getElementById('downloadStatsBtn');
        if (productArray.length === 0) {
            container.innerHTML = `<p class="text-center text-gray-500">No se encontraron ventas para este rubro en el período seleccionado.</p>`;
             if (downloadBtn) downloadBtn.classList.add('hidden');
            return;
        }
        const headerTitle = statsType === 'general' ? 'Promedio Semanal' : 'Total Vendido';
        let tableHTML = `<table class="min-w-full bg-white text-sm"><thead class="bg-gray-200 sticky top-0 z-10"><tr><th class="py-2 px-3 border-b text-left">Producto (Marca - Segmento - Presentación)</th><th class="py-2 px-3 border-b text-center">${headerTitle}</th></tr></thead><tbody>`;
        productArray.sort((a, b) => {
             const marcaComp = (a.marca || '').localeCompare(b.marca || '');
             if (marcaComp !== 0) return marcaComp;
             const segComp = (a.segmento || '').localeCompare(b.segmento || '');
             if (segComp !== 0) return segComp;
             return (a.presentacion || '').localeCompare(b.presentacion || '');
        });
        productArray.forEach(p => {
            let displayQuantity = 0;
            let displayUnit = 'Unds';
            const value = (p.totalUnidades || 0) / numWeeks;
            const ventaPor = p.ventaPor || { und: true };
            const unidadesPorCaja = p.unidadesPorCaja || 1;
            const unidadesPorPaquete = p.unidadesPorPaquete || 1;
             if (ventaPor.cj) { displayQuantity = (value / Math.max(1, unidadesPorCaja)).toFixed(1); displayUnit = 'Cajas'; }
             else if (ventaPor.paq) { displayQuantity = (value / Math.max(1, unidadesPorPaquete)).toFixed(1); displayUnit = 'Paq.'; }
             else { displayQuantity = value.toFixed(0); }
             displayQuantity = displayQuantity.replace(/\.0$/, '');
            tableHTML += `<tr class="hover:bg-gray-50"><td class="py-2 px-3 border-b">${p.marca} - ${p.segmento} - ${p.presentacion}</td><td class="py-2 px-3 border-b text-center font-bold">${displayQuantity} <span class="font-normal text-xs">${displayUnit}</span></td></tr>`;
        });
        tableHTML += `</tbody></table>`;
        container.innerHTML = tableHTML;
         const downloadButtonHTML = `<div class="mt-6 text-center"><button id="downloadStatsBtn" class="px-6 py-2 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700">Descargar como Excel</button></div>`;
         container.insertAdjacentHTML('afterend', downloadButtonHTML);
         const newDownloadBtn = document.getElementById('downloadStatsBtn');
         if (newDownloadBtn) { newDownloadBtn.addEventListener('click', handleDownloadStats); }
         else { console.error("Failed to find download button after rendering stats list."); }
    }

     function handleDownloadStats() {
        if (!Array.isArray(_lastStatsData) || _lastStatsData.length === 0) { _showModal('Aviso', 'No hay datos de estadísticas para descargar.'); return; }
        if (typeof XLSX === 'undefined') { _showModal('Error', 'La librería para exportar a Excel (XLSX) no está cargada.'); return; }
        const statsType = document.getElementById('stats-type')?.value || 'desconocido';
        const headerTitle = statsType === 'general' ? 'Promedio Semanal' : 'Total Vendido';
        try {
            const dataToExport = _lastStatsData.map(p => {
                let displayQuantity = 0;
                let displayUnit = 'Unds';
                const value = (p.totalUnidades || 0) / _lastNumWeeks;
                const ventaPor = p.ventaPor || { und: true };
                const unidadesPorCaja = p.unidadesPorCaja || 1;
                const unidadesPorPaquete = p.unidadesPorPaquete || 1;
                if (ventaPor.cj) { displayQuantity = (value / Math.max(1, unidadesPorCaja)).toFixed(1); displayUnit = 'Cajas'; }
                else if (ventaPor.paq) { displayQuantity = (value / Math.max(1, unidadesPorPaquete)).toFixed(1); displayUnit = 'Paq.'; }
                else { displayQuantity = value.toFixed(0); }
                 displayQuantity = displayQuantity.replace(/\.0$/, '');
                return { 'Marca': p.marca || '', 'Segmento': p.segmento || '', 'Presentación': p.presentacion || '', [headerTitle]: `${displayQuantity} ${displayUnit}` };
            });
            const ws = XLSX.utils.json_to_sheet(dataToExport);
             ws['!cols'] = [{wch: 20}, {wch: 20}, {wch: 30}, {wch: 20}];
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Estadisticas');
            const rubroElement = document.getElementById('stats-rubro-filter');
            const rubro = rubroElement ? rubroElement.value : 'Todos';
            const today = new Date().toISOString().slice(0, 10);
            XLSX.writeFile(wb, `Estadisticas_${rubro.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${statsType}_${today}.xlsx`);
        } catch (excelError) {
             console.error("Error generating Excel file for stats:", excelError);
             _showModal('Error de Exportación', `No se pudo generar el archivo Excel: ${excelError.message}`);
        }
    }

    async function showConsolidatedClientsView() {
        if (_floatingControls) _floatingControls.classList.add('hidden');
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl">
                        <h1 class="text-3xl font-bold text-gray-800 mb-6 text-center">Clientes Consolidados</h1>
                        <div id="consolidated-clients-filters"><p class="text-center text-gray-500">Cargando filtros...</p></div>
                        <div id="consolidated-clients-container" class="overflow-x-auto max-h-96"><p class="text-center text-gray-500">Cargando clientes...</p></div>
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
         if (!container || !filtersContainer) return;
        try {
            const clientesRef = _collection(_db, `artifacts/ventas-9a210/public/data/clientes`);
            const allClientSnapshots = await _getDocs(clientesRef);
            _consolidatedClientsCache = allClientSnapshots.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            filtersContainer.innerHTML = `<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 border rounded-lg"><input type="text" id="client-search-input" placeholder="Buscar por Nombre o CEP..." class="md:col-span-2 w-full px-4 py-2 border rounded-lg"><div><label for="client-filter-sector" class="text-sm font-medium">Sector</label><select id="client-filter-sector" class="w-full px-2 py-1 border rounded-lg text-sm"><option value="">Todos</option></select></div><button id="clearClientFiltersBtn" class="bg-gray-300 text-xs font-semibold rounded-lg self-end py-1.5 px-3 hover:bg-gray-400 md:col-start-3">Limpiar</button></div>`;
            const sectorFilter = document.getElementById('client-filter-sector');
            const searchInput = document.getElementById('client-search-input');
            const clearBtn = document.getElementById('clearClientFiltersBtn');
             try {
                const sectoresRef = _collection(_db, `artifacts/ventas-9a210/public/data/sectores`);
                const sectoresSnapshot = await _getDocs(sectoresRef);
                const uniqueSectors = sectoresSnapshot.docs.map(doc => doc.data().name).sort();
                uniqueSectors.forEach(sector => { sectorFilter.innerHTML += `<option value="${sector}">${sector}</option>`; });
            } catch (sectorError) { console.error("Error loading sectors for filter:", sectorError); sectorFilter.innerHTML = '<option value="">Error</option>'; }
            searchInput.addEventListener('input', renderConsolidatedClientsList);
            sectorFilter.addEventListener('change', renderConsolidatedClientsList);
            clearBtn.addEventListener('click', () => { searchInput.value = ''; sectorFilter.value = ''; renderConsolidatedClientsList(); });
            renderConsolidatedClientsList();
            const downloadBtn = document.getElementById('downloadClientsBtn');
            if (downloadBtn) downloadBtn.classList.remove('hidden');
        } catch (error) {
            console.error("Error al cargar clientes consolidados:", error);
            container.innerHTML = `<p class="text-center text-red-500">Ocurrió un error al cargar clientes: ${error.message}</p>`;
             filtersContainer.innerHTML = `<p class="text-center text-red-500">Error al cargar filtros.</p>`;
        }
    }

     function renderConsolidatedClientsList() {
        const container = document.getElementById('consolidated-clients-container');
        const searchInput = document.getElementById('client-search-input');
        const sectorFilter = document.getElementById('client-filter-sector');
        if (!container || !searchInput || !sectorFilter) { console.error("renderConsolidatedClientsList: Missing DOM elements."); if (container) container.innerHTML = `<p class="text-center text-red-500">Error interno al renderizar.</p>`; return; }
        const searchTerm = searchInput.value.toLowerCase();
        const selectedSector = sectorFilter.value;
        _filteredClientsCache = _consolidatedClientsCache.filter(client => {
            const searchMatch = !searchTerm || (client.nombreComercial && client.nombreComercial.toLowerCase().includes(searchTerm)) || (client.nombrePersonal && client.nombrePersonal.toLowerCase().includes(searchTerm)) || (client.codigoCEP && client.codigoCEP.toLowerCase().includes(searchTerm));
            const sectorMatch = !selectedSector || client.sector === selectedSector;
            return searchMatch && sectorMatch;
        });
        if (_filteredClientsCache.length === 0) { container.innerHTML = `<p class="text-center text-gray-500">No se encontraron clientes que coincidan con los filtros.</p>`; return; }
        let tableHTML = `<table class="min-w-full bg-white text-sm"><thead class="bg-gray-200 sticky top-0 z-10"><tr><th class="py-2 px-3 border-b text-left">Sector</th><th class="py-2 px-3 border-b text-left">Nombre Comercial</th><th class="py-2 px-3 border-b text-left">Nombre Personal</th><th class="py-2 px-3 border-b text-left">Teléfono</th><th class="py-2 px-3 border-b text-left">CEP</th><th class="py-2 px-3 border-b text-left">Coordenadas</th></tr></thead><tbody>`;
        _filteredClientsCache.sort((a,b) => (a.nombreComercial || '').localeCompare(b.nombreComercial || '')).forEach(c => {
            tableHTML += `<tr class="hover:bg-gray-50"><td class="py-2 px-3 border-b">${c.sector || 'N/A'}</td><td class="py-2 px-3 border-b font-semibold">${c.nombreComercial || 'N/A'}</td><td class="py-2 px-3 border-b">${c.nombrePersonal || 'N/A'}</td><td class="py-2 px-3 border-b">${c.telefono || 'N/A'}</td><td class="py-2 px-3 border-b">${c.codigoCEP || 'N/A'}</td><td class="py-2 px-3 border-b text-xs">${c.coordenadas || 'N/A'}</td></tr>`;
        });
        tableHTML += '</tbody></table>';
        container.innerHTML = tableHTML;
    }

     function handleDownloadFilteredClients() {
         if (typeof XLSX === 'undefined') { _showModal('Error', 'La librería para exportar a Excel (XLSX) no está cargada.'); return; }
        if (!Array.isArray(_filteredClientsCache) || _filteredClientsCache.length === 0) { _showModal('Aviso', 'No hay clientes en la lista actual para descargar.'); return; }
        try {
            _filteredClientsCache.sort((a, b) => (a.nombreComercial || '').localeCompare(b.nombreComercial || ''));
            const dataToExport = _filteredClientsCache.map(c => ({ 'Sector': c.sector || '', 'Nombre Comercial': c.nombreComercial || '', 'Nombre Personal': c.nombrePersonal || '', 'Telefono': c.telefono || '', 'CEP': c.codigoCEP || '', 'Coordenadas': c.coordenadas || '' }));
            const ws = XLSX.utils.json_to_sheet(dataToExport);
             ws['!cols'] = [{wch: 15}, {wch: 30}, {wch: 30}, {wch: 15}, {wch: 10}, {wch: 20}];
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Clientes Consolidados');
            const today = new Date().toISOString().slice(0, 10);
            XLSX.writeFile(wb, `Clientes_Consolidados_${today}.xlsx`);
        } catch (excelError) {
            console.error("Error generating Excel file for clients:", excelError);
            _showModal('Error de Exportación', `No se pudo generar el archivo Excel: ${excelError.message}`);
        }
    }

    function showClientMapView() {
        if (mapInstance) { try { mapInstance.remove(); } catch(e) { console.warn("Error removing map instance:", e); } mapInstance = null; mapMarkers.clear(); }
        if (_floatingControls) _floatingControls.classList.add('hidden');
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl">
                        <h1 class="text-3xl font-bold text-gray-800 mb-4 text-center">Mapa de Clientes Consolidados</h1>
                        <div class="relative mb-4">
                            <input type="text" id="map-search-input" placeholder="Buscar cliente por nombre o CEP..." class="w-full px-4 py-2 border rounded-lg">
                            <div id="map-search-results" class="absolute z-[1000] w-full bg-white border rounded-lg mt-1 max-h-60 overflow-y-auto hidden shadow-lg"></div>
                        </div>
                        <div class="mb-4 p-2 bg-gray-100 border rounded-lg text-sm flex flex-wrap justify-center items-center gap-4">
                           <span><img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png" alt="Marcador Rojo" style="height: 25px; display: inline; vertical-align: middle;"> Cliente Regular</span>
                           <span><img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png" alt="Marcador Azul" style="height: 25px; display: inline; vertical-align: middle;"> Cliente con CEP</span>
                        </div>
                        <div id="client-map" class="w-full rounded-lg shadow-inner bg-gray-200" style="height: 65vh; border: 1px solid #ccc;"><p class="text-center text-gray-500 pt-10">Cargando mapa...</p></div>
                        <button id="backToDataMenuBtn" class="mt-6 w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver</button>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('backToDataMenuBtn').addEventListener('click', showDataView);
        loadAndDisplayMap();
    }

     async function loadAndDisplayMap() {
        const mapContainer = document.getElementById('client-map');
        if (!mapContainer) return;
        if (typeof L === 'undefined') { _showModal('Error', 'La librería de mapas (Leaflet) no está disponible.'); mapContainer.innerHTML = '<p class="text-center text-red-500 pt-10">Error al cargar librería de mapas.</p>'; return; }
         mapContainer.innerHTML = '<p class="text-center text-gray-500 pt-10">Cargando datos de clientes...</p>';
        try {
            if (_consolidatedClientsCache.length === 0) {
                 console.log("Map: Loading consolidated clients from Firestore...");
                 const clientesRef = _collection(_db, `artifacts/ventas-9a210/public/data/clientes`);
                 const allClientSnapshots = await _getDocs(clientesRef);
                 _consolidatedClientsCache = allClientSnapshots.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                 console.log(`Map: Loaded ${_consolidatedClientsCache.length} clients.`);
            } else { console.log("Map: Using cached consolidated clients."); }
            const allClients = _consolidatedClientsCache;
            const clientsWithCoords = allClients.filter(c => {
                if (!c.coordenadas || typeof c.coordenadas !== 'string') return false;
                const parts = c.coordenadas.split(',').map(p => parseFloat(p.trim()));
                return parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1]) && parts[0] >= -90 && parts[0] <= 90 && parts[1] >= -180 && parts[1] <= 180;
            });
            if (clientsWithCoords.length === 0) { mapContainer.innerHTML = '<p class="text-center text-gray-500 pt-10">No se encontraron clientes con coordenadas válidas.</p>'; return; }
             mapContainer.innerHTML = '';
             if (!mapInstance) {
                 try {
                    mapInstance = L.map('client-map').setView([7.7639, -72.2250], 13);
                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors', maxZoom: 19 }).addTo(mapInstance);
                    console.log("Map initialized.");
                 } catch (mapInitError) { console.error("Error initializing Leaflet map:", mapInitError); mapContainer.innerHTML = `<p class="text-center text-red-500 pt-10">Error al inicializar el mapa: ${mapInitError.message}</p>`; return; }
            } else { console.log("Map instance already exists."); }
            const redIcon = new L.Icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png', shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] });
            const blueIcon = new L.Icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png', shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] });
            mapMarkers.clear();
            const markerGroup = [];
            clientsWithCoords.forEach(client => {
                const coords = client.coordenadas.split(',').map(p => parseFloat(p.trim()));
                const hasCEP = client.codigoCEP && client.codigoCEP.toLowerCase() !== 'n/a';
                const icon = hasCEP ? blueIcon : redIcon;
                const popupContent = `<b>${client.nombreComercial || 'N/A'}</b><br>${client.nombrePersonal || ''}<br>Tel: ${client.telefono || 'N/A'}<br>Sector: ${client.sector || 'N/A'}${hasCEP ? `<br><b>CEP: ${client.codigoCEP}</b>` : ''}`;
                const marker = L.marker(coords, { icon: icon }).bindPopup(popupContent);
                 const markerKey = client.id || client.nombreComercial;
                 if (markerKey) { mapMarkers.set(markerKey, marker); }
                 else { console.warn("Client missing ID and Name, cannot store marker reference:", client); }
                markerGroup.push(marker);
            });
             if (markerGroup.length > 0) {
                const featureGroup = L.featureGroup(markerGroup).addTo(mapInstance);
                mapInstance.fitBounds(featureGroup.getBounds().pad(0.1));
             } else { console.log("No markers to add to map."); mapInstance.setView([7.7639, -72.2250], 13); }
            setupMapSearch(clientsWithCoords);
        } catch (error) {
            console.error("Error al cargar el mapa de clientes:", error);
            mapContainer.innerHTML = `<p class="text-center text-red-500 pt-10">Ocurrió un error al cargar los datos de los clientes.</p>`;
             _showModal('Error de Mapa', `No se pudieron cargar los datos de los clientes: ${error.message}`);
        }
    }

     function setupMapSearch(clients) {
        const searchInput = document.getElementById('map-search-input');
        const resultsContainer = document.getElementById('map-search-results');
        if (!searchInput || !resultsContainer) return;
        searchInput.addEventListener('input', () => {
            const searchTerm = searchInput.value.toLowerCase().trim();
            if (searchTerm.length < 2) { resultsContainer.innerHTML = ''; resultsContainer.classList.add('hidden'); return; }
            const filteredClients = clients.filter(client => (client.nombreComercial && client.nombreComercial.toLowerCase().includes(searchTerm)) || (client.nombrePersonal && client.nombrePersonal.toLowerCase().includes(searchTerm)) || (client.codigoCEP && client.codigoCEP.toLowerCase().includes(searchTerm))).slice(0, 10);
            if (filteredClients.length === 0) { resultsContainer.innerHTML = '<div class="p-2 text-gray-500">No se encontraron clientes.</div>'; resultsContainer.classList.remove('hidden'); return; }
            resultsContainer.innerHTML = filteredClients.map(client => { const clientKey = client.id || client.nombreComercial; return clientKey ? `<div class="p-2 hover:bg-gray-100 cursor-pointer border-b last:border-b-0" data-client-key="${clientKey}"><p class="font-semibold text-sm">${client.nombreComercial}</p><p class="text-xs text-gray-600">${client.nombrePersonal || ''} ${client.codigoCEP && client.codigoCEP !== 'N/A' ? `(CEP: ${client.codigoCEP})` : ''}</p></div>` : ''; }).join('');
            resultsContainer.classList.remove('hidden');
        });
        resultsContainer.addEventListener('click', (e) => {
            const target = e.target.closest('[data-client-key]');
            if (target && mapInstance) {
                const clientKey = target.dataset.clientKey;
                const marker = mapMarkers.get(clientKey);
                if (marker) { mapInstance.flyTo(marker.getLatLng(), 17); marker.openPopup(); }
                else { console.warn(`Marker not found for key: ${clientKey}`); _showModal('Aviso', 'No se pudo encontrar el marcador para este cliente.'); }
                searchInput.value = '';
                resultsContainer.innerHTML = '';
                resultsContainer.classList.add('hidden');
            }
        });
        document.addEventListener('click', function(event) { if (resultsContainer && searchInput && !resultsContainer.contains(event.target) && event.target !== searchInput) { resultsContainer.classList.add('hidden'); } });
    }

    function showDataManagementView() {
        if (_floatingControls) _floatingControls.classList.add('hidden');
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto max-w-2xl">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl">
                        <h1 class="text-3xl font-bold text-gray-800 mb-6 text-center">Limpieza y Gestión de Datos</h1>
                        <div class="space-y-6">
                            <div class="p-4 border rounded-lg bg-red-50 border-red-200">
                                <h2 class="text-xl font-semibold text-red-800 mb-2">Datos de Ventas (Cierres)</h2>
                                <p class="text-sm text-red-700 mb-4">Exportará todos los cierres (públicos y admin) a Excel y luego los eliminará permanentemente.</p>
                                <button id="deleteExportSalesBtn" class="w-full px-6 py-3 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700">Borrar y Exportar Datos de Ventas</button>
                            </div>
                            <div class="p-4 border rounded-lg bg-yellow-50 border-yellow-200">
                                <h2 class="text-xl font-semibold text-yellow-800 mb-2">Datos de Inventario</h2>
                                <p class="text-sm text-yellow-700 mb-4"><strong>Borrar/Exportar:</strong> Exporta el inventario maestro del admin (incl. categorías) a Excel y luego elimina estos datos de TODOS los usuarios.</p>
                                <button id="deleteExportInventoryBtn" class="w-full px-6 py-3 bg-yellow-600 text-white font-semibold rounded-lg shadow-md hover:bg-yellow-700 mb-4">Borrar y Exportar Datos de Inventario</button>
                                <hr class="my-4 border-yellow-300">
                                <p class="text-sm text-yellow-700 mb-2"><strong>Importar:</strong> Importa un inventario completo desde Excel (formato específico) y lo distribuye a TODOS, sobrescribiendo estructura pero conservando cantidades.</p>
                                <input type="file" id="inventory-file-input" accept=".xlsx, .xls" class="w-full p-2 border border-yellow-400 rounded-lg mb-2">
                                <button id="importInventoryBtn" class="w-full px-6 py-3 bg-yellow-500 text-gray-900 font-semibold rounded-lg shadow-md hover:bg-yellow-600">Importar Inventario desde Excel</button>
                            </div>
                        </div>
                        <button id="backToDataMenuBtn" class="mt-8 w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver al Menú de Datos</button>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('backToDataMenuBtn').addEventListener('click', showDataView);
        document.getElementById('deleteExportSalesBtn').addEventListener('click', handleDeleteAndExportSales);
        document.getElementById('deleteExportInventoryBtn').addEventListener('click', handleDeleteAndExportInventory);
        document.getElementById('importInventoryBtn').addEventListener('click', handleImportInventory);
    }

    async function getAllUserIds(excludeAdmin = false) {
        try {
            const usersRef = _collection(_db, "users");
            const snapshot = await _getDocs(usersRef);
            let userIds = snapshot.docs.map(doc => doc.id);
            if (excludeAdmin) userIds = userIds.filter(id => id !== _userId);
            return userIds;
        } catch (error) { console.error("Error getting user IDs:", error); _showModal('Error Interno', 'No se pudo obtener la lista completa de usuarios.'); return []; }
    }

    async function exportClosingsToExcel(publicClosings, adminClosings) {
         if (typeof XLSX === 'undefined') throw new Error('Librería XLSX no cargada.');
         const wb = XLSX.utils.book_new();
         if (publicClosings && publicClosings.length > 0) {
             const publicData = publicClosings.map(c => { const fechaCierre = c.fecha?.toDate ? c.fecha.toDate() : null; return { 'Fecha': fechaCierre ? fechaCierre.toISOString().slice(0, 10) : 'Fecha Inválida', 'Vendedor_Email': c.vendedorInfo?.email || 'N/A', 'Vendedor_Nombre': `${c.vendedorInfo?.nombre || ''} ${c.vendedorInfo?.apellido || ''}`.trim() || 'N/A', 'Camion': c.vendedorInfo?.camion || 'N/A', 'Total': c.total || 0, 'ID_Cierre': c.id || 'N/A', 'Datos_Ventas': JSON.stringify(c.ventas || []) }; });
             const wsPublic = XLSX.utils.json_to_sheet(publicData);
             XLSX.utils.book_append_sheet(wb, wsPublic, 'Cierres_Publicos');
         } else { const wsPublic = XLSX.utils.aoa_to_sheet([["No hay cierres públicos para exportar."]]); XLSX.utils.book_append_sheet(wb, wsPublic, 'Cierres_Publicos'); }
        if (adminClosings && adminClosings.length > 0) {
             const adminData = adminClosings.map(c => { const fechaCierre = c.fecha?.toDate ? c.fecha.toDate() : null; return { 'Fecha': fechaCierre ? fechaCierre.toISOString().slice(0, 10) : 'Fecha Inválida', 'Total': c.total || 0, 'ID_Cierre': c.id || 'N/A', 'Datos_Ventas': JSON.stringify(c.ventas || []) }; });
            const wsAdmin = XLSX.utils.json_to_sheet(adminData);
            XLSX.utils.book_append_sheet(wb, wsAdmin, 'Cierres_Admin');
        } else { const wsAdmin = XLSX.utils.aoa_to_sheet([["No hay cierres de admin para exportar."]]); XLSX.utils.book_append_sheet(wb, wsAdmin, 'Cierres_Admin'); }
        const today = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(wb, `Exportacion_Cierres_${today}.xlsx`);
    }

    async function handleDeleteAndExportSales() {
        _showModal('Confirmar Borrado de Ventas', `<p class="text-red-600 font-bold">¡ADVERTENCIA!</p><p>Exportará TODOS los cierres (públicos y admin) a Excel y luego los eliminará permanentemente.</p><p class="mt-2">IRREVERSIBLE.</p><p class="mt-4 font-bold">¿Absolutamente seguro?</p>`, async () => {
                _showModal('Progreso', 'Exportando y eliminando datos de ventas...');
                let exported = false;
                try {
                    const publicClosingsRef = _collection(_db, `public_data/${_appId}/user_closings`);
                    const publicSnapshot = await _getDocs(publicClosingsRef);
                    const publicClosings = publicSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    const adminClosingsRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/cierres`);
                    const adminSnapshot = await _getDocs(adminClosingsRef);
                    const adminClosings = adminSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    if (publicClosings.length > 0 || adminClosings.length > 0) { await exportClosingsToExcel(publicClosings, adminClosings); exported = true; }
                    else { _showModal('Aviso', 'No se encontraron datos de cierres para exportar o eliminar.'); return false; }
                     _showModal('Progreso', 'Datos exportados. Eliminando registros...');
                    if (!publicSnapshot.empty) { const batchPublic = _writeBatch(_db); publicSnapshot.docs.forEach(doc => batchPublic.delete(doc.ref)); await batchPublic.commit(); console.log(`${publicSnapshot.size} cierres públicos eliminados.`); }
                     if (!adminSnapshot.empty) { const batchAdmin = _writeBatch(_db); adminSnapshot.docs.forEach(doc => batchAdmin.delete(doc.ref)); await batchAdmin.commit(); console.log(`${adminSnapshot.size} cierres de admin eliminados.`); }
                    _showModal('Éxito', 'Datos de ventas exportados y eliminados.');
                    return true;
                } catch (error) {
                    console.error("Error borrando/exportando ventas:", error);
                    const actionFailed = exported ? "eliminación" : "exportación/eliminación";
                    _showModal('Error', `Error durante la ${actionFailed}: ${error.message}`);
                    return false;
                }
            }, 'Sí, Borrar Todo', null, true);
    }

    async function exportInventoryToExcel() {
        if (typeof XLSX === 'undefined') throw new Error('Librería XLSX no cargada.');
        const wb = XLSX.utils.book_new();
        const collections = ['inventario', 'rubros', 'segmentos', 'marcas'];
        let dataFound = false;
        for (const colName of collections) {
            const path = `artifacts/${_appId}/users/${_userId}/${colName}`;
            try {
                const snapshot = await _getDocs(_collection(_db, path));
                if (!snapshot.empty) { dataFound = true; const data = snapshot.docs.map(doc => ({ firestore_id: doc.id, ...doc.data() })); const ws = XLSX.utils.json_to_sheet(data); XLSX.utils.book_append_sheet(wb, ws, colName); }
                else { const ws = XLSX.utils.aoa_to_sheet([[`No hay datos en ${colName}`]]); XLSX.utils.book_append_sheet(wb, ws, colName); }
            } catch (readError) { console.error(`Error leyendo ${colName} para exportar:`, readError); const ws = XLSX.utils.aoa_to_sheet([[`Error al leer datos de ${colName}: ${readError.message}`]]); XLSX.utils.book_append_sheet(wb, ws, colName); }
        }
        if (!dataFound) { _showModal('Aviso', 'No se encontraron datos de inventario del admin para exportar.'); return false; }
        const today = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(wb, `Exportacion_Inventario_Maestro_${today}.xlsx`);
        return true;
    }

    async function handleDeleteAndExportInventory() {
         _showModal('Confirmar Borrado de Inventario', `<p class="text-red-600 font-bold">¡ADVERTENCIA MAYOR!</p><p>Exportará inventario maestro del admin (incl. categorías) a Excel.</p><p class="mt-2">Luego, eliminará permanentemente estos datos de <strong>TODOS los usuarios</strong>.</p><p class="mt-2">IRREVERSIBLE.</p><p class="mt-4 font-bold">¿Absolutamente seguro?</p>`, async () => {
                _showModal('Progreso', 'Exportando inventario maestro del admin...');
                let exported = false;
                try {
                    exported = await exportInventoryToExcel();
                    if (!exported) return false;
                     _showModal('Progreso', 'Inventario exportado. Obteniendo lista de usuarios...');
                    const allUserIds = await getAllUserIds();
                    if (allUserIds.length === 0) { _showModal('Advertencia', 'Inventario exportado, pero no se encontraron otros usuarios para limpiar.'); return true; }
                    _showModal('Progreso', `Eliminando datos de inventario para ${allUserIds.length} usuario(s)...`);
                    const collectionsToDelete = ['inventario', 'rubros', 'segmentos', 'marcas'];
                    let deleteErrors = 0;
                    for (const userIdToDelete of allUserIds) {
                        console.log(`Eliminando datos para usuario: ${userIdToDelete}`);
                        for (const colName of collectionsToDelete) {
                            const path = `artifacts/${_appId}/users/${userIdToDelete}/${colName}`;
                            try {
                                const snapshot = await _getDocs(_collection(_db, path));
                                if (!snapshot.empty) {
                                    const batch = _writeBatch(_db); let opsInBatch = 0; const MAX_OPS = 490;
                                    snapshot.docs.forEach(doc => { batch.delete(doc.ref); opsInBatch++; if(opsInBatch >= MAX_OPS){ await batch.commit(); batch = _writeBatch(_db); opsInBatch = 0; } });
                                    if(opsInBatch > 0) await batch.commit();
                                    console.log(` - ${colName} (${snapshot.size} items) eliminado para ${userIdToDelete}`);
                                }
                            } catch (userDeleteError) { console.error(`Error eliminando ${colName} para ${userIdToDelete}:`, userDeleteError); deleteErrors++; }
                        }
                    }
                    _showModal(deleteErrors > 0 ? 'Advertencia' : 'Éxito', `Inventario exportado. Eliminación completada.${deleteErrors > 0 ? ` Errores al limpiar ${deleteErrors} usuario(s).` : ' Todos los usuarios limpiados.'}`);
                    return true;
                } catch (error) {
                    console.error("Error borrando/exportando inventario:", error);
                     const actionFailed = exported ? "eliminación" : "exportación/eliminación";
                    _showModal('Error', `Error durante la ${actionFailed}: ${error.message}`);
                    return false;
                }
            }, 'Sí, Borrar Todo el Inventario', null, true);
    }

    function handleInventoryFileSelect() {
        const fileInput = document.getElementById('inventory-file-input');
        if (!fileInput) { _showModal('Error Interno', 'No se encontró el input para seleccionar archivo.'); return null; }
        const file = fileInput.files?.[0];
        if (!file) { _showModal('Error', 'Por favor, selecciona un archivo Excel.'); return null; }
        return file;
    }

    async function handleImportInventory() {
        const file = handleInventoryFileSelect();
        if (!file) return;
        if (typeof XLSX === 'undefined') { _showModal('Error', 'La librería XLSX no está cargada.'); return; }
         _showModal('Confirmar Importación de Inventario', `<p class="text-orange-600 font-bold">¡ATENCIÓN!</p><p>Leerá Excel y distribuirá datos de inventario (incl. categorías) a <strong>TODOS los usuarios</strong>.</p><p class="mt-2">Sobreescribirá estructura, pero intentará conservar cantidades.</p><p class="mt-4 font-bold">Asegúrate del formato (hojas: inventario, rubros, segmentos, marcas). ¿Continuar?</p>`, async () => {
                _showModal('Progreso', 'Leyendo archivo Excel...');
                const reader = new FileReader();
                reader.onload = async (e) => {
                    let importErrors = 0;
                    try {
                        const data = e.target.result;
                        const workbook = XLSX.read(data, { type: 'array' });
                        const requiredSheets = ['inventario', 'rubros', 'segmentos', 'marcas'];
                        const importedData = {}; let missingSheets = [];
                        requiredSheets.forEach(sheetName => {
                             if (workbook.SheetNames.includes(sheetName)) { importedData[sheetName] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]); }
                             else { if (sheetName === 'inventario') { missingSheets.push(sheetName); } else { console.warn(`Hoja opcional '${sheetName}' no encontrada.`); importedData[sheetName] = []; } }
                        });
                         if (missingSheets.length > 0) throw new Error(`Falta la hoja requerida 'inventario'.`);
                         if (!importedData.inventario || importedData.inventario.length === 0) console.warn("Hoja 'inventario' vacía. Solo se importarán categorías.");
                         _showModal('Progreso', 'Datos leídos. Obteniendo lista de usuarios...');
                         const allUserIds = await getAllUserIds();
                         if(allUserIds.length === 0){ _showModal('Aviso', 'Datos leídos, pero no se encontraron usuarios.'); return false; }
                         _showModal('Progreso', `Distribuyendo datos a ${allUserIds.length} usuario(s)...`);
                         for (const targetId of allUserIds) {
                            console.log(`Importando datos para usuario: ${targetId}`);
                             try {
                                 for(const cat of ['rubros', 'segmentos', 'marcas']) { const itemsToCopy = (importedData[cat] || []).map(item => { const { firestore_id, ...rest } = item; return { id: firestore_id, ...rest }; }); await copyDataToUser(targetId, cat, itemsToCopy); console.log(` - ${cat} importado para ${targetId}`); }
                                 if (importedData.inventario.length > 0) { const inventarioToMerge = importedData.inventario.map(item => { const { firestore_id, cantidadUnidades, ...rest } = item; return { id: firestore_id, ...rest }; }); await mergeDataForUser(targetId, 'inventario', inventarioToMerge, 'cantidadUnidades'); console.log(` - inventario fusionado para ${targetId}`); }
                             } catch(userImportError){ console.error(`Error importando datos para ${targetId}:`, userImportError); importErrors++; }
                         }
                        _showModal(importErrors > 0 ? 'Advertencia' : 'Éxito', `Importación completada.${importErrors > 0 ? ` Errores para ${importErrors} usuario(s).` : ''}`);
                        showDataManagementView(); return true;
                    } catch (error) {
                        console.error("Error importando inventario:", error); _showModal('Error', `Error durante la importación: ${error.message}`);
                         const fileInput = document.getElementById('inventory-file-input'); if(fileInput) fileInput.value = ''; return false;
                    }
                };
                reader.onerror = (e) => { _showModal('Error', 'No se pudo leer el archivo seleccionado.'); };
                reader.readAsArrayBuffer(file);
            }, 'Sí, Importar y Distribuir', null, true);
    }

    window.dataModule = {
        showClosingDetail,
        handleDownloadSingleClosing
    };

})();
