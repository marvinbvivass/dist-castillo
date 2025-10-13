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
            return;
        }

        const fechaDesde = new Date(fechaDesdeStr);
        fechaDesde.setHours(0, 0, 0, 0); 
        
        const fechaHasta = new Date(fechaHastaStr);
        fechaHasta.setHours(23, 59, 59, 999);

        try {
            const closingsRef = _collection(_db, `public_data/${_appId}/user_closings`);
            
            let q;
            if (selectedUserId) {
                q = _query(closingsRef, 
                    _where("vendedorInfo.userId", "==", selectedUserId),
                    _where("fecha", ">=", fechaDesde),
                    _where("fecha", "<=", fechaHasta)
                );
            } else {
                q = _query(closingsRef, 
                    _where("fecha", ">=", fechaDesde),
                    _where("fecha", "<=", fechaHasta)
                );
            }

            const snapshot = await _getDocs(q);
            const closings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
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
        
        closings.sort((a, b) => b.fecha.toDate() - a.fecha.toDate());

        let tableHTML = `
            <table class="min-w-full bg-white text-sm">
                <thead class="bg-gray-200">
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
                    <td class="py-2 px-3 border-b text-center">
                        <button onclick="window.dataModule.showClosingDetail('${cierre.id}')" class="px-3 py-1 bg-blue-500 text-white text-xs rounded-lg hover:bg-blue-600">Ver Detalle</button>
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
        const vaciosMovements = {};
        
        const inventarioRef = _collection(_db, `artifacts/${_appId}/users/${userIdForInventario}/inventario`);
        const inventarioSnapshot = await _getDocs(inventarioRef);
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

        const rubroOrderMap = await getRubroOrderMapData(userIdForInventario);
        const segmentoOrderMap = await getSegmentoOrderMapData(userIdForInventario);

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
     * Muestra el detalle de un cierre en un modal
     */
    async function showClosingDetail(closingId) {
        const closingData = window.tempClosingsData.find(c => c.id === closingId);
        if (!closingData) {
            _showModal('Error', 'No se pudieron cargar los detalles del cierre.');
            return;
        }
        
        _showModal('Progreso', 'Generando reporte detallado...');
        
        const { clientData, grandTotalValue, sortedClients, groupedProducts, finalProductOrder, sortedRubros, segmentoOrderMap, vaciosMovements, allProductsMap } = await processSalesDataForReport(closingData.ventas, closingData.vendedorInfo.userId);
        
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

        const vendedor = closingData.vendedorInfo || {};
        const reporteHTML = `
            <div class="text-left max-h-[80vh] overflow-auto">
                <div class="mb-4">
                    <p><strong>Vendedor:</strong> ${vendedor.nombre || ''} ${vendedor.apellido || ''}</p>
                    <p><strong>Camión:</strong> ${vendedor.camion || 'N/A'}</p>
                    <p><strong>Fecha:</strong> ${closingData.fecha.toDate().toLocaleString('es-ES')}</p>
                </div>
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
        _showModal(`Detalle del Cierre`, reporteHTML);
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
        
        _populateDropdown('rubros', 'stats-rubro-filter', 'Rubro');
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
        let fechaHasta = new Date();

        if (statsType === 'semanal') {
            const dayOfWeek = now.getDay(); // 0 = Domingo, 1 = Lunes, ...
            fechaDesde = new Date(now);
            const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Ajusta para que la semana empiece en Lunes
            fechaDesde.setHours(0, 0, 0, 0);
        } else if (statsType === 'mensual') {
            fechaDesde = new Date(now.getFullYear(), now.getMonth(), 1);
            fechaDesde.setHours(0, 0, 0, 0);
        } else { // general
            fechaDesde = new Date(0); // El inicio de los tiempos
        }

        try {
            // CAMBIO: Obtener cierres de usuarios y del admin
            const publicClosingsRef = _collection(_db, `public_data/${_appId}/user_closings`);
            const adminClosingsRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/cierres`);

            const publicQuery = _query(publicClosingsRef, _where("fecha", ">=", fechaDesde), _where("fecha", "<=", fechaHasta));
            const adminQuery = _query(adminClosingsRef, _where("fecha", ">=", fechaDesde), _where("fecha", "<=", fechaHasta));

            const [publicSnapshot, adminSnapshot] = await Promise.all([_getDocs(publicQuery), _getDocs(adminQuery)]);
            
            const publicClosings = publicSnapshot.docs.map(doc => doc.data());
            const adminClosings = adminSnapshot.docs.map(doc => doc.data());
            const allClosings = [...publicClosings, ...adminClosings];
            
            if (allClosings.length === 0) {
                container.innerHTML = `<p class="text-center text-gray-500">No hay datos de ventas en el período seleccionado.</p>`;
                return;
            }

            const productSales = {};
            const adminInventarioRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`);
            const inventarioSnapshot = await _getDocs(adminInventarioRef);
            const adminInventarioMap = new Map(inventarioSnapshot.docs.map(doc => [doc.id, doc.data()]));
            
            allClosings.forEach(cierre => {
                cierre.ventas.forEach(venta => {
                    venta.productos.forEach(p => {
                        const adminProductInfo = adminInventarioMap.get(p.id) || p;
                        if (adminProductInfo.rubro === rubroFilter) {
                            if (!productSales[p.id]) {
                                productSales[p.id] = {
                                    presentacion: p.presentacion,
                                    totalUnidades: 0,
                                    ventaPor: adminProductInfo.ventaPor,
                                    unidadesPorCaja: adminProductInfo.unidadesPorCaja || 1,
                                    unidadesPorPaquete: adminProductInfo.unidadesPorPaquete || 1
                                };
                            }
                            productSales[p.id].totalUnidades += p.totalUnidadesVendidas;
                        }
                    });
                });
            });

            const productArray = Object.values(productSales);
            
            let numWeeks = 1;
            if (statsType === 'general') {
                const oneDay = 24 * 60 * 60 * 1000;
                const firstDate = allClosings.reduce((min, c) => c.fecha.toDate() < min ? c.fecha.toDate() : min, new Date());
                numWeeks = Math.ceil(Math.abs((now - firstDate) / (oneDay * 7))) || 1;
            }
            
            _lastStatsData = productArray;
            _lastNumWeeks = numWeeks;

            renderStatsList(productArray, statsType, numWeeks);

        } catch (error) {
            console.error("Error al calcular estadísticas:", error);
            container.innerHTML = `<p class="text-center text-red-500">Ocurrió un error al calcular las estadísticas.</p>`;
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
                <thead class="bg-gray-200">
                    <tr>
                        <th class="py-2 px-3 border-b text-left">Producto</th>
                        <th class="py-2 px-3 border-b text-center">${headerTitle}</th>
                    </tr>
                </thead>
                <tbody>`;
        
        productArray.sort((a, b) => a.presentacion.localeCompare(b.presentacion));
        
        productArray.forEach(p => {
            let displayQuantity = 0;
            let displayUnit = 'Unds';
            const total = p.totalUnidades / numWeeks;

            if (p.ventaPor?.cj) {
                displayQuantity = (total / p.unidadesPorCaja).toFixed(1);
                displayUnit = 'Cajas';
            } else if (p.ventaPor?.paq) {
                displayQuantity = (total / p.unidadesPorPaquete).toFixed(1);
                displayUnit = 'Paq.';
            } else {
                displayQuantity = total.toFixed(0);
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

        document.getElementById('downloadStatsBtn').addEventListener('click', handleDownloadStats);
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
        
        const dataToExport = _lastStatsData.map(p => {
            let displayQuantity = 0;
            let displayUnit = 'Unds';
            const total = p.totalUnidades / _lastNumWeeks;
    
            if (p.ventaPor?.cj) {
                displayQuantity = (total / p.unidadesPorCaja).toFixed(1);
                displayUnit = 'Cajas';
            } else if (p.ventaPor?.paq) {
                displayQuantity = (total / p.unidadesPorPaquete).toFixed(1);
                displayUnit = 'Paq.';
            } else {
                displayQuantity = total.toFixed(0);
            }
    
            return {
                'Producto': p.presentacion,
                [headerTitle]: `${displayQuantity} ${displayUnit}`
            };
        });
    
        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Estadisticas');
        
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
        try {
            // CORRECCIÓN: Usar el Project ID en lugar del App ID.
            const clientesRef = _collection(_db, `artifacts/ventas-9a210/public/data/clientes`);
            const allClientSnapshots = await _getDocs(clientesRef);

            _consolidatedClientsCache = allClientSnapshots.docs.map(doc => doc.data());
            
            const filtersContainer = document.getElementById('consolidated-clients-filters');
            filtersContainer.innerHTML = `
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 border rounded-lg">
                    <input type="text" id="client-search-input" placeholder="Buscar por Nombre..." class="md:col-span-2 w-full px-4 py-2 border rounded-lg">
                    <div>
                        <label for="client-filter-sector" class="text-sm font-medium">Sector</label>
                        <select id="client-filter-sector" class="w-full px-2 py-1 border rounded-lg text-sm"><option value="">Todos</option></select>
                    </div>
                </div>
            `;

            const uniqueSectors = [...new Set(_consolidatedClientsCache.map(c => c.sector))].sort();
            const sectorFilter = document.getElementById('client-filter-sector');
            uniqueSectors.forEach(sector => {
                sectorFilter.innerHTML += `<option value="${sector}">${sector}</option>`;
            });
            
            document.getElementById('client-search-input').addEventListener('input', renderConsolidatedClientsList);
            sectorFilter.addEventListener('change', renderConsolidatedClientsList);

            renderConsolidatedClientsList();
            document.getElementById('downloadClientsBtn').classList.remove('hidden');

        } catch (error) {
            console.error("Error al cargar clientes consolidados:", error);
            container.innerHTML = `<p class="text-center text-red-500">Ocurrió un error: ${error.message}</p>`;
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
            const searchMatch = !searchTerm || client.nombreComercial.toLowerCase().includes(searchTerm) || client.nombrePersonal.toLowerCase().includes(searchTerm);
            const sectorMatch = !selectedSector || client.sector === selectedSector;
            return searchMatch && sectorMatch;
        });

        if (_filteredClientsCache.length === 0) {
            container.innerHTML = `<p class="text-center text-gray-500">No se encontraron clientes que coincidan con los filtros.</p>`;
            return;
        }

        let tableHTML = `
            <table class="min-w-full bg-white text-sm">
                <thead class="bg-gray-200">
                    <tr>
                        <th class="py-2 px-3 border-b text-left">Sector</th>
                        <th class="py-2 px-3 border-b text-left">Nombre Comercial</th>
                        <th class="py-2 px-3 border-b text-left">Nombre Personal</th>
                        <th class="py-2 px-3 border-b text-left">Teléfono</th>
                    </tr>
                </thead>
                <tbody>`;
        _filteredClientsCache.sort((a,b) => a.nombreComercial.localeCompare(b.nombreComercial)).forEach(c => {
            tableHTML += `
                <tr class="hover:bg-gray-50">
                    <td class="py-2 px-3 border-b">${c.sector}</td>
                    <td class="py-2 px-3 border-b font-semibold">${c.nombreComercial}</td>
                    <td class="py-2 px-3 border-b">${c.nombrePersonal}</td>
                    <td class="py-2 px-3 border-b">${c.telefono}</td>
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
            'Sector': c.sector,
            'Nombre Comercial': c.nombreComercial,
            'Nombre Personal': c.nombrePersonal,
            'telefono': c.telefono,
            'CEP': c.codigoCEP
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
                            <div id="map-search-results" class="absolute z-[1000] w-full bg-white border rounded-lg mt-1 max-h-60 overflow-y-auto hidden"></div>
                        </div>
                        <div class="mb-4 p-2 bg-gray-100 border rounded-lg text-sm flex justify-center items-center gap-4">
                           <span><img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png" style="height: 25px; display: inline;"> Cliente Regular</span>
                           <span><img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png" style="height: 25px; display: inline;"> Cliente con CEP</span>
                        </div>
                        <div id="client-map" class="w-full rounded-lg shadow-inner" style="height: 65vh; border: 1px solid #ccc;">
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
            // CORRECCIÓN: Usar el Project ID en lugar del App ID.
            const clientesRef = _collection(_db, `artifacts/ventas-9a210/public/data/clientes`);
            const allClientSnapshots = await _getDocs(clientesRef);
            const allClients = allClientSnapshots.docs.map(doc => doc.data());

            const clientsWithCoords = allClients.filter(c => {
                if (!c.coordenadas) return false;
                const parts = c.coordenadas.split(',').map(p => parseFloat(p.trim()));
                return parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1]);
            });

            if (clientsWithCoords.length === 0) {
                mapContainer.innerHTML = '<p class="text-center text-gray-500 pt-10">No se encontraron clientes con coordenadas válidas.</p>';
                return;
            }
            
            mapInstance = L.map('client-map').setView([7.77, -72.22], 13); // Centrado en San Cristóbal

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(mapInstance);

            const redIcon = new L.Icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
            });

            const blueIcon = new L.Icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
            });
            
            mapMarkers.clear();
            const markerGroup = [];
            clientsWithCoords.forEach(client => {
                const coords = client.coordenadas.split(',').map(p => parseFloat(p.trim()));
                const hasCEP = client.codigoCEP && client.codigoCEP.toLowerCase() !== 'n/a';
                const icon = hasCEP ? blueIcon : redIcon;

                const popupContent = `
                    <b>${client.nombreComercial}</b><br>
                    ${client.nombrePersonal}<br>
                    Tel: ${client.telefono || 'N/A'}<br>
                    Sector: ${client.sector}
                    ${hasCEP ? `<br><b>CEP: ${client.codigoCEP}</b>` : ''}
                `;

                const marker = L.marker(coords, {icon: icon}).addTo(mapInstance).bindPopup(popupContent);
                mapMarkers.set(client.nombreComercial, marker);
                markerGroup.push(marker);
            });

            if(markerGroup.length > 0) {
                const group = new L.featureGroup(markerGroup);
                mapInstance.fitBounds(group.getBounds().pad(0.1));
            }

            setupMapSearch(clientsWithCoords);

        } catch (error) {
            console.error("Error al cargar el mapa de clientes:", error);
            mapContainer.innerHTML = `<p class="text-center text-red-500 pt-10">Ocurrió un error al cargar los datos de los clientes.</p>`;
        }
    }
    
    function setupMapSearch(clients) {
        const searchInput = document.getElementById('map-search-input');
        const resultsContainer = document.getElementById('map-search-results');
        if (!searchInput || !resultsContainer) return;

        searchInput.addEventListener('input', () => {
            const searchTerm = searchInput.value.toLowerCase();
            if (searchTerm.length < 2) {
                resultsContainer.innerHTML = '';
                resultsContainer.classList.add('hidden');
                return;
            }

            const filteredClients = clients.filter(client => 
                client.nombreComercial.toLowerCase().includes(searchTerm) ||
                client.nombrePersonal.toLowerCase().includes(searchTerm) ||
                (client.codigoCEP && client.codigoCEP.toLowerCase().includes(searchTerm))
            );

            if (filteredClients.length === 0) {
                resultsContainer.innerHTML = '<div class="p-2 text-gray-500">No se encontraron clientes.</div>';
                resultsContainer.classList.remove('hidden');
                return;
            }

            resultsContainer.innerHTML = filteredClients.map(client => `
                <div class="p-2 hover:bg-gray-100 cursor-pointer" data-client-name="${client.nombreComercial}">
                    <p class="font-semibold">${client.nombreComercial}</p>
                    <p class="text-sm text-gray-600">${client.nombrePersonal}</p>
                </div>
            `).join('');
            resultsContainer.classList.remove('hidden');
        });

        resultsContainer.addEventListener('click', (e) => {
            const target = e.target.closest('[data-client-name]');
            if (target && mapInstance) {
                const clientName = target.dataset.clientName;
                const marker = mapMarkers.get(clientName);
                if (marker) {
                    mapInstance.flyTo(marker.getLatLng(), 17); // Zoom más cercano
                    marker.openPopup();
                }
                searchInput.value = '';
                resultsContainer.innerHTML = '';
                resultsContainer.classList.add('hidden');
            }
        });

        // Ocultar resultados si se hace clic fuera
        document.addEventListener('click', function(event) {
            if (!resultsContainer.contains(event.target) && event.target !== searchInput) {
                resultsContainer.classList.add('hidden');
            }
        });
    }


    // Exponer funciones públicas al objeto window
    window.dataModule = {
        showClosingDetail
    };

})();
