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

    // --- [INICIO] Funciones movidas antes de showDataView ---

    /**
     * Popula el desplegable de filtro de usuarios.
     */
    async function populateUserFilter() {
        const userFilterSelect = document.getElementById('userFilter');
        if (!userFilterSelect) return;

        try {
            const usersRef = _collection(_db, "users");
            const snapshot = await _getDocs(usersRef);
            // Limpiar opciones existentes excepto la primera ("Todos")
            userFilterSelect.innerHTML = '<option value="">Todos los Vendedores</option>';
            snapshot.docs.forEach(doc => {
                const user = doc.data();
                const option = document.createElement('option');
                option.value = doc.id;
                // Intentar mostrar nombre y apellido si existen
                const userName = (user.nombre || user.apellido)
                    ? `${user.nombre || ''} ${user.apellido || ''}`.trim()
                    : user.email; // Fallback al email
                option.textContent = `${userName} (${user.camion || 'N/A'})`;
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
            container.innerHTML = `<p class="text-center text-gray-500">Seleccione las opciones para buscar.</p>`; // Resetear mensaje
            return;
        }

        // Convertir fechas a objetos Date de JS asegurando el inicio y fin del día
        const fechaDesde = new Date(fechaDesdeStr + 'T00:00:00'); // Inicio del día
        const fechaHasta = new Date(fechaHastaStr + 'T23:59:59.999'); // Fin del día


        try {
            // Referencia a la colección pública de cierres
            const closingsRef = _collection(_db, `public_data/${_appId}/user_closings`);

            // Construir la consulta base con filtro de fecha
            let q = _query(closingsRef,
                _where("fecha", ">=", fechaDesde),
                _where("fecha", "<=", fechaHasta)
                // Nota: Firestore puede requerir un índice compuesto para esta consulta.
                // Si da error de índice, créalo desde la consola de Firebase.
            );

            // Si se seleccionó un usuario específico, añadir ese filtro
            if (selectedUserId) {
                q = _query(q, _where("vendedorInfo.userId", "==", selectedUserId));
                 // Nota: Puede requerir otro índice compuesto (fecha, vendedorInfo.userId).
            }


            const snapshot = await _getDocs(q);
            let closings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Guardar temporalmente para usar en detalles y descarga
            window.tempClosingsData = closings;

            renderClosingsList(closings);

        } catch (error) {
            console.error("Error al buscar cierres:", error);
            // Mostrar un mensaje más útil si es un error de índice
            if (error.code === 'failed-precondition') {
                 container.innerHTML = `<p class="text-center text-red-500">Error: Se requiere un índice de Firestore para esta consulta. Por favor, créalo desde la consola de Firebase o contacta al administrador.</p>`;
                 _showModal('Error de Índice', 'Se necesita configurar un índice en Firestore para realizar esta búsqueda. Consulta la consola de Firebase o al administrador.');
            } else {
                 container.innerHTML = `<p class="text-center text-red-500">Ocurrió un error al buscar los cierres: ${error.message}</p>`;
            }
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

        // Ordenar por fecha descendente (más reciente primero)
        closings.sort((a, b) => b.fecha.toDate().getTime() - a.fecha.toDate().getTime());

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
                : (vendedor.email || 'Desconocido'); // Fallback a email o 'Desconocido'

            tableHTML += `
                <tr class="hover:bg-gray-50">
                    <td class="py-2 px-3 border-b">${cierre.fecha.toDate().toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' })}</td>
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
                                    <!-- Options will be populated by populateUserFilter -->
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

        document.getElementById('backToDataMenuBtn').addEventListener('click', showDataView); // Volver al menú principal de Data
        document.getElementById('searchCierresBtn').addEventListener('click', handleSearchClosings);

        // Establecer fechas por defecto (hoy)
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('fechaDesde').value = today;
        document.getElementById('fechaHasta').value = today;

        // Poblar el filtro de usuarios después de renderizar el HTML
        await populateUserFilter();
    };

    // --- [FIN] Funciones movidas ---


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
                            <button id="dataManagementBtn" class="w-full px-6 py-3 bg-yellow-600 text-white font-semibold rounded-lg shadow-md hover:bg-yellow-700">Limpieza y Gestión de Datos</button> {/* <-- NUEVO BOTÓN */}
                            <button id="backToMenuBtn" class="w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver al Menú Principal</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('closingDataBtn').addEventListener('click', showClosingDataView); // <-- Ahora debería funcionar
        document.getElementById('productStatsBtn').addEventListener('click', showProductStatsView);
        document.getElementById('consolidatedClientsBtn').addEventListener('click', showConsolidatedClientsView);
        document.getElementById('clientMapBtn').addEventListener('click', showClientMapView);
        document.getElementById('dataManagementBtn').addEventListener('click', showDataManagementView); // <-- Listener para el nuevo botón
        document.getElementById('backToMenuBtn').addEventListener('click', _showMainMenu);
    };


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
        const vaciosMovements = { // Objeto para rastrear por tipo de vacío
            "1/4 - 1/3": {},
            "ret 350 ml": {},
            "ret 1.25 Lts": {}
        };

        const inventarioRef = _collection(_db, `artifacts/${_appId}/users/${userIdForInventario}/inventario`);
        const inventarioSnapshot = await _getDocs(inventarioRef);
        const inventarioMap = new Map(inventarioSnapshot.docs.map(doc => [doc.id, doc.data()]));

        ventas.forEach(venta => {
            const clientName = venta.clienteNombre;
            if (!clientData[clientName]) {
                clientData[clientName] = { products: {}, totalValue: 0 };
            }
            clientData[clientName].totalValue += venta.total;
            grandTotalValue += venta.total;

            (venta.productos || []).forEach(p => {
                 const productoCompleto = inventarioMap.get(p.id) || p; // Usar datos del inventario si están disponibles
                 const tipoVacioProd = productoCompleto.tipoVacio; // Obtener el tipo de vacío del producto

                 if (p.manejaVacios && tipoVacioProd && vaciosMovements[tipoVacioProd]) {
                     if (!vaciosMovements[tipoVacioProd][clientName]) {
                         vaciosMovements[tipoVacioProd][clientName] = { entregados: 0, devueltos: 0 };
                     }
                     vaciosMovements[tipoVacioProd][clientName].entregados += p.cantidadVendida?.cj || 0;
                     vaciosMovements[tipoVacioProd][clientName].devueltos += p.vaciosDevueltos || 0;
                 }


                const rubro = productoCompleto.rubro || 'Sin Rubro';
                const segmento = productoCompleto.segmento || 'Sin Segmento';
                const marca = productoCompleto.marca || 'Sin Marca';

                if (!allProductsMap.has(p.id)) {
                    allProductsMap.set(p.id, {
                        ...productoCompleto, // Copiar todos los datos del inventario
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

        // --- Generación de encabezados (sin cambios) ---
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

        // --- Generación del cuerpo (sin cambios) ---
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
                    if (isExclusiveCj && unidadesPorCaja > 0) {
                        const totalBoxes = quantityInUnits / unidadesPorCaja;
                        displayQuantity = `${Number.isInteger(totalBoxes) ? totalBoxes : totalBoxes.toFixed(1)} Cj`;
                    } else if (isExclusivePaq && unidadesPorPaquete > 0) {
                        const totalPackages = quantityInUnits / unidadesPorPaquete;
                        displayQuantity = `${Number.isInteger(totalPackages) ? totalPackages : totalPackages.toFixed(1)} Paq`;
                    }
                }
                bodyHTML += `<td class="p-1 border text-center">${displayQuantity}</td>`;
            });
            bodyHTML += `<td class="p-1 border text-right font-semibold bg-white sticky right-0 z-10">$${currentClient.totalValue.toFixed(2)}</td></tr>`;
        });

        // --- Generación del pie de página (sin cambios) ---
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

                if (isExclusiveCj && unidadesPorCaja > 0) {
                    const totalBoxes = totalQty / unidadesPorCaja;
                    displayTotal = `${Number.isInteger(totalBoxes) ? totalBoxes : totalBoxes.toFixed(1)} Cj`;
                } else if (isExclusivePaq && unidadesPorPaquete > 0) {
                    const totalPackages = totalQty / unidadesPorPaquete;
                    displayTotal = `${Number.isInteger(totalPackages) ? totalPackages : totalPackages.toFixed(1)} Paq`;
                }
            }
            footerHTML += `<td class="p-1 border text-center">${displayTotal}</td>`;
        });
        footerHTML += `<td class="p-1 border text-right sticky right-0 z-10">$${grandTotalValue.toFixed(2)}</td></tr>`;


        // --- [INICIO] Reporte de Vacíos por Tipo ---
        let vaciosReportHTML = '';
        const tiposConMovimiento = Object.keys(vaciosMovements).filter(tipo =>
            Object.values(vaciosMovements[tipo]).some(mov => mov.entregados > 0 || mov.devueltos > 0)
        );

        if (tiposConMovimiento.length > 0) {
            vaciosReportHTML = `<h3 class="text-xl font-bold text-gray-800 my-6">Reporte de Envases Retornables (Vacíos) por Tipo</h3>`;

            tiposConMovimiento.forEach(tipoVacio => {
                vaciosReportHTML += `
                    <h4 class="text-lg font-semibold text-gray-700 mt-4 mb-2">${tipoVacio}</h4>
                    <div class="overflow-auto border mb-4">
                        <table class="min-w-full bg-white text-xs">
                            <thead class="bg-gray-200">
                                <tr>
                                    <th class="p-1 border text-left">Cliente</th>
                                    <th class="p-1 border text-center">Entregados (Cajas)</th>
                                    <th class="p-1 border text-center">Devueltos (Cajas)</th>
                                    <th class="p-1 border text-center">Neto</th>
                                </tr>
                            </thead>
                            <tbody>`;

                const clientesDelTipo = Object.keys(vaciosMovements[tipoVacio]).sort();
                clientesDelTipo.forEach(cliente => {
                    const mov = vaciosMovements[tipoVacio][cliente];
                    const neto = mov.entregados - mov.devueltos;
                    if (mov.entregados > 0 || mov.devueltos > 0) {
                        vaciosReportHTML += `
                            <tr class="hover:bg-blue-50">
                                <td class="p-1 border">${cliente}</td>
                                <td class="p-1 border text-center">${mov.entregados}</td>
                                <td class="p-1 border text-center">${mov.devueltos}</td>
                                <td class="p-1 border text-center font-bold">${neto > 0 ? `+${neto}` : neto}</td>
                            </tr>
                        `;
                    }
                });
                vaciosReportHTML += '</tbody></table></div>';
            });
        }
        // --- [FIN] Reporte de Vacíos por Tipo ---


        const vendedor = closingData.vendedorInfo || {};
        const reporteHTML = `
            <div class="text-left max-h-[80vh] overflow-auto">
                <div class="mb-4">
                    <p><strong>Vendedor:</strong> ${vendedor.nombre || ''} ${vendedor.apellido || ''}</p>
                    <p><strong>Camión:</strong> ${vendedor.camion || 'N/A'}</p>
                    <p><strong>Fecha:</strong> ${closingData.fecha.toDate().toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}</p>
                </div>
                <h3 class="text-xl font-bold text-gray-800 mb-4">Reporte de Cierre de Ventas</h3>
                <div class="overflow-auto border">
                    <table class="min-w-full bg-white text-xs">
                        <thead class="bg-gray-200">${headerRow1}${headerRow2}${headerRow3}${headerRow4}</thead>
                        <tbody>${bodyHTML}</tbody>
                        <tfoot>${footerHTML}</tfoot>
                    </table>
                </div>
                ${vaciosReportHTML} {/* <-- Insertar reporte de vacíos */}
            </div>`;
        _showModal(`Detalle del Cierre`, reporteHTML);
    }


    /**
     * Genera y descarga un archivo Excel para un único cierre.
     */
    async function exportSingleClosingToExcel(closingData) {
        if (typeof XLSX === 'undefined') {
            _showModal('Error', 'La librería para exportar a Excel no está cargada.');
            return;
        }

        const { clientData, grandTotalValue, sortedClients, groupedProducts, finalProductOrder, sortedRubros, segmentoOrderMap, vaciosMovements, allProductsMap } = await processSalesDataForReport(closingData.ventas, closingData.vendedorInfo.userId);

        // --- Hoja 1: Reporte de Ventas (sin cambios) ---
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
        merges1.push({ s: { r: 0, c: 0 }, e: { r: 3, c: 0 } }); // Merge Cliente cell
        merges1.push({ s: { r: 0, c: finalProductOrder.length + 1 }, e: { r: 3, c: finalProductOrder.length + 1 } }); // Merge Total Cliente cell

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
                    if (isExclusiveCj && unidadesPorCaja > 0) {
                        const totalBoxes = quantityInUnits / unidadesPorCaja;
                        displayQuantity = `${Number.isInteger(totalBoxes) ? totalBoxes : totalBoxes.toFixed(1)} Cj`;
                    } else if (isExclusivePaq && unidadesPorPaquete > 0) {
                        const totalPackages = quantityInUnits / unidadesPorPaquete;
                        displayQuantity = `${Number.isInteger(totalPackages) ? totalPackages : totalPackages.toFixed(1)} Paq`;
                    }
                }
                row.push(displayQuantity);
            });
            row.push(currentClient.totalValue);
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
                if (isExclusiveCj && unidadesPorCaja > 0) {
                    const totalBoxes = totalQty / unidadesPorCaja;
                    displayTotal = `${Number.isInteger(totalBoxes) ? totalBoxes : totalBoxes.toFixed(1)} Cj`;
                } else if (isExclusivePaq && unidadesPorPaquete > 0) {
                    const totalPackages = totalQty / unidadesPorPaquete;
                    displayTotal = `${Number.isInteger(totalPackages) ? totalPackages : totalPackages.toFixed(1)} Paq`;
                }
            }
            footerRow.push(displayTotal);
        });
        footerRow.push(grandTotalValue);
        dataForSheet1.push(footerRow);

        const ws1 = XLSX.utils.aoa_to_sheet(dataForSheet1);
        ws1['!merges'] = merges1;

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws1, 'Reporte de Cierre');

        // --- [INICIO] Hoja 2: Reporte de Vacíos por Tipo ---
        const tiposConMovimiento = Object.keys(vaciosMovements).filter(tipo =>
            Object.values(vaciosMovements[tipo]).some(mov => mov.entregados > 0 || mov.devueltos > 0)
        );

        if (tiposConMovimiento.length > 0) {
             const dataForSheet2 = [['Tipo Vacío', 'Cliente', 'Entregados (Cajas)', 'Devueltos (Cajas)', 'Neto']];
             tiposConMovimiento.forEach(tipoVacio => {
                 const clientesDelTipo = Object.keys(vaciosMovements[tipoVacio]).sort();
                 clientesDelTipo.forEach(cliente => {
                    const mov = vaciosMovements[tipoVacio][cliente];
                    const neto = mov.entregados - mov.devueltos;
                    if (mov.entregados > 0 || mov.devueltos > 0) {
                        dataForSheet2.push([
                            tipoVacio,
                            cliente,
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
        // --- [FIN] Hoja 2: Reporte de Vacíos por Tipo ---

        const vendedor = closingData.vendedorInfo || {};
        const fecha = closingData.fecha.toDate().toISOString().slice(0, 10);
        const vendedorNombre = (vendedor.nombre || 'Vendedor').replace(/\s/g, '_');
        XLSX.writeFile(wb, `Cierre_${vendedorNombre}_${fecha}.xlsx`);
    }

    /**
     * Maneja la descarga de un único cierre.
     */
    async function handleDownloadSingleClosing(closingId) {
        const closingData = window.tempClosingsData.find(c => c.id === closingId);
        if (!closingData) {
            _showModal('Error', 'No se pudieron encontrar los datos del cierre para descargar.');
            return;
        }

        _showModal('Progreso', 'Generando archivo Excel...');

        try {
            await exportSingleClosingToExcel(closingData);
            // Cierra el modal de "progreso" si aún está abierto
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

        _populateDropdown(`artifacts/${_appId}/users/${_userId}/rubros`, 'stats-rubro-filter', 'Rubro'); // Usar ruta completa
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
        let fechaHasta = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999); // Fin del día actual

        if (statsType === 'semanal') {
            const dayOfWeek = now.getDay(); // 0 = Domingo, 1 = Lunes, ...
            fechaDesde = new Date(now);
             // Ajusta para que la semana empiece en Lunes (si hoy es Domingo (0), resta 6 días; si es Sábado (6), resta 5, etc.)
            const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
            fechaDesde.setDate(diff);
            fechaDesde.setHours(0, 0, 0, 0); // Inicio del Lunes de esta semana
        } else if (statsType === 'mensual') {
            fechaDesde = new Date(now.getFullYear(), now.getMonth(), 1);
            fechaDesde.setHours(0, 0, 0, 0); // Inicio del mes actual
        } else { // general
            fechaDesde = new Date(0); // El inicio de los tiempos (1 Enero 1970 UTC)
        }

        try {
            // Obtener cierres públicos
            const publicClosingsRef = _collection(_db, `public_data/${_appId}/user_closings`);
            const publicQuery = _query(publicClosingsRef, _where("fecha", ">=", fechaDesde), _where("fecha", "<=", fechaHasta));
            const publicSnapshot = await _getDocs(publicQuery);
            const publicClosings = publicSnapshot.docs.map(doc => doc.data());

            // Obtener cierres del admin actual (si es necesario agregarlos, aunque no deberían existir si sigue la lógica)
            // const adminClosingsRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/cierres`);
            // const adminQuery = _query(adminClosingsRef, _where("fecha", ">=", fechaDesde), _where("fecha", "<=", fechaHasta));
            // const adminSnapshot = await _getDocs(adminQuery);
            // const adminClosings = adminSnapshot.docs.map(doc => doc.data());
            // const allClosings = [...publicClosings, ...adminClosings];
            const allClosings = publicClosings; // Usar solo los públicos

            if (allClosings.length === 0) {
                container.innerHTML = `<p class="text-center text-gray-500">No hay datos de ventas en el período seleccionado.</p>`;
                return;
            }

            const productSales = {};
            // Usar el inventario del admin actual como referencia maestra para nombres, etc.
            const adminInventarioRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`);
            const inventarioSnapshot = await _getDocs(adminInventarioRef);
            const adminInventarioMap = new Map(inventarioSnapshot.docs.map(doc => [doc.id, doc.data()]));

            allClosings.forEach(cierre => {
                cierre.ventas.forEach(venta => {
                    venta.productos.forEach(p => {
                        const adminProductInfo = adminInventarioMap.get(p.id);
                        // Filtrar por rubro usando la info del inventario maestro del admin
                        if (adminProductInfo && adminProductInfo.rubro === rubroFilter) {
                            if (!productSales[p.id]) {
                                productSales[p.id] = {
                                    // Usar datos del admin para consistencia
                                    presentacion: adminProductInfo.presentacion,
                                    marca: adminProductInfo.marca || 'Sin Marca',
                                    segmento: adminProductInfo.segmento || 'Sin Segmento',
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
                 // Encontrar la fecha del cierre más antiguo
                 const firstDate = allClosings.reduce((min, c) => {
                     const cierreDate = c.fecha.toDate();
                     return cierreDate < min ? cierreDate : min;
                 }, new Date()); // Iniciar con la fecha actual como máximo inicial
                // Calcular semanas desde la fecha más antigua hasta hoy
                 numWeeks = Math.max(1, Math.ceil(Math.abs((now - firstDate) / (oneDay * 7)))); // Asegurar al menos 1 semana
            }

            _lastStatsData = productArray;
            _lastNumWeeks = numWeeks;

            renderStatsList(productArray, statsType, numWeeks);

        } catch (error) {
            console.error("Error al calcular estadísticas:", error);
            container.innerHTML = `<p class="text-center text-red-500">Ocurrió un error al calcular las estadísticas: ${error.message}</p>`;
        }
    }


    function renderStatsList(productArray, statsType, numWeeks = 1) {
        const container = document.getElementById('stats-list-container');
        if (productArray.length === 0) {
            container.innerHTML = `<p class="text-center text-gray-500">No se encontraron ventas para este rubro en el período seleccionado.</p>`;
            // Ocultar botón de descarga si no hay datos
             const downloadBtn = document.getElementById('downloadStatsBtn');
             if (downloadBtn) downloadBtn.classList.add('hidden');
            return;
        }

        const headerTitle = statsType === 'general' ? 'Promedio Semanal' : 'Total Vendido';

        let tableHTML = `
            <table class="min-w-full bg-white text-sm">
                <thead class="bg-gray-200 sticky top-0 z-10">
                    <tr>
                        <th class="py-2 px-3 border-b text-left">Producto (Marca - Segmento - Presentación)</th>
                        <th class="py-2 px-3 border-b text-center">${headerTitle}</th>
                    </tr>
                </thead>
                <tbody>`;

        // Ordenar por Marca -> Segmento -> Presentación
        productArray.sort((a, b) => {
             const marcaComp = a.marca.localeCompare(b.marca);
             if (marcaComp !== 0) return marcaComp;
             const segComp = a.segmento.localeCompare(b.segmento);
             if (segComp !== 0) return segComp;
             return a.presentacion.localeCompare(b.presentacion);
        });

        productArray.forEach(p => {
            let displayQuantity = 0;
            let displayUnit = 'Unds';
            // Calcular total o promedio
            const total = (p.totalUnidades || 0) / numWeeks;

            // Determinar la unidad de venta principal para mostrar
            const ventaPor = p.ventaPor || { und: true }; // Default a unidades si no está definido
            const unidadesPorCaja = p.unidadesPorCaja || 1;
            const unidadesPorPaquete = p.unidadesPorPaquete || 1;

            if (ventaPor.cj) {
                displayQuantity = (total / unidadesPorCaja).toFixed(1);
                displayUnit = 'Cajas';
            } else if (ventaPor.paq) {
                displayQuantity = (total / unidadesPorPaquete).toFixed(1);
                displayUnit = 'Paq.';
            } else { // Venta por unidad o si no está especificado
                displayQuantity = total.toFixed(0);
            }
             // Eliminar decimal '.0' si es un número entero
             displayQuantity = displayQuantity.replace(/\.0$/, '');


            tableHTML += `
                <tr class="hover:bg-gray-50">
                    <td class="py-2 px-3 border-b">${p.marca} - ${p.segmento} - ${p.presentacion}</td>
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
            // Recalcular para la exportación
            const total = (p.totalUnidades || 0) / _lastNumWeeks;
            const ventaPor = p.ventaPor || { und: true };
            const unidadesPorCaja = p.unidadesPorCaja || 1;
            const unidadesPorPaquete = p.unidadesPorPaquete || 1;

            if (ventaPor.cj) {
                displayQuantity = (total / unidadesPorCaja).toFixed(1);
                displayUnit = 'Cajas';
            } else if (ventaPor.paq) {
                displayQuantity = (total / unidadesPorPaquete).toFixed(1);
                displayUnit = 'Paq.';
            } else {
                displayQuantity = total.toFixed(0);
            }
             displayQuantity = displayQuantity.replace(/\.0$/, ''); // Limpiar .0


            return {
                'Marca': p.marca,
                'Segmento': p.segmento,
                'Presentación': p.presentacion,
                [headerTitle]: `${displayQuantity} ${displayUnit}` // Combinar valor y unidad
            };
        });

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Estadisticas');

        const rubro = document.getElementById('stats-rubro-filter').value || 'Todos';
        const today = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(wb, `Estadisticas_${rubro.replace(/\s+/g, '_')}_${statsType}_${today}.xlsx`);
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
             // Ruta pública de clientes
            const clientesRef = _collection(_db, `artifacts/ventas-9a210/public/data/clientes`);
            const allClientSnapshots = await _getDocs(clientesRef);

            _consolidatedClientsCache = allClientSnapshots.docs.map(doc => ({ id: doc.id, ...doc.data() })); // Guardar ID también

            const filtersContainer = document.getElementById('consolidated-clients-filters');
            filtersContainer.innerHTML = `
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 border rounded-lg">
                    <input type="text" id="client-search-input" placeholder="Buscar por Nombre o CEP..." class="md:col-span-2 w-full px-4 py-2 border rounded-lg">
                    <div>
                        <label for="client-filter-sector" class="text-sm font-medium">Sector</label>
                        <select id="client-filter-sector" class="w-full px-2 py-1 border rounded-lg text-sm"><option value="">Todos</option></select>
                    </div>
                </div>
            `;

            // Poblar filtro de sectores desde la colección pública de sectores
            const sectoresRef = _collection(_db, `artifacts/ventas-9a210/public/data/sectores`);
            const sectoresSnapshot = await _getDocs(sectoresRef);
            const uniqueSectors = sectoresSnapshot.docs.map(doc => doc.data().name).sort();
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
            const searchMatch = !searchTerm ||
                (client.nombreComercial && client.nombreComercial.toLowerCase().includes(searchTerm)) ||
                (client.nombrePersonal && client.nombrePersonal.toLowerCase().includes(searchTerm)) ||
                (client.codigoCEP && client.codigoCEP.toLowerCase().includes(searchTerm)); // Añadir búsqueda por CEP
            const sectorMatch = !selectedSector || client.sector === selectedSector;
            return searchMatch && sectorMatch;
        });

        if (_filteredClientsCache.length === 0) {
            container.innerHTML = `<p class="text-center text-gray-500">No se encontraron clientes que coincidan con los filtros.</p>`;
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
                        <th class="py-2 px-3 border-b text-left">CEP</th> {/* Añadir columna CEP */}
                    </tr>
                </thead>
                <tbody>`;
        // Ordenar alfabéticamente por Nombre Comercial antes de mostrar
        _filteredClientsCache.sort((a,b) => (a.nombreComercial || '').localeCompare(b.nombreComercial || '')).forEach(c => {
            tableHTML += `
                <tr class="hover:bg-gray-50">
                    <td class="py-2 px-3 border-b">${c.sector || 'N/A'}</td>
                    <td class="py-2 px-3 border-b font-semibold">${c.nombreComercial || 'N/A'}</td>
                    <td class="py-2 px-3 border-b">${c.nombrePersonal || 'N/A'}</td>
                    <td class="py-2 px-3 border-b">${c.telefono || 'N/A'}</td>
                    <td class="py-2 px-3 border-b">${c.codigoCEP || 'N/A'}</td> {/* Mostrar CEP */}
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

        // Ordenar para la exportación
        _filteredClientsCache.sort((a, b) => (a.nombreComercial || '').localeCompare(b.nombreComercial || ''));

        const dataToExport = _filteredClientsCache.map(c => ({
            'Sector': c.sector || '',
            'Nombre Comercial': c.nombreComercial || '',
            'Nombre Personal': c.nombrePersonal || '',
            'Telefono': c.telefono || '', // Corregido el nombre del campo
            'CEP': c.codigoCEP || '',
            'Coordenadas': c.coordenadas || '' // Añadir coordenadas si existen
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
            mapMarkers.clear(); // Limpiar marcadores anteriores
        }
        _floatingControls.classList.add('hidden');
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl">
                        <h1 class="text-3xl font-bold text-gray-800 mb-4 text-center">Mapa de Clientes Consolidados</h1>
                        <div class="relative mb-4">
                            <input type="text" id="map-search-input" placeholder="Buscar cliente por nombre o CEP..." class="w-full px-4 py-2 border rounded-lg">
                            <div id="map-search-results" class="absolute z-[1000] w-full bg-white border rounded-lg mt-1 max-h-60 overflow-y-auto hidden shadow-lg"></div> {/* Añadir shadow */}
                        </div>
                        <div class="mb-4 p-2 bg-gray-100 border rounded-lg text-sm flex flex-wrap justify-center items-center gap-4"> {/* Flex-wrap */}
                           <span><img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png" alt="Marcador Rojo" style="height: 25px; display: inline; vertical-align: middle;"> Cliente Regular</span>
                           <span><img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png" alt="Marcador Azul" style="height: 25px; display: inline; vertical-align: middle;"> Cliente con CEP</span>
                        </div>
                        <div id="client-map" class="w-full rounded-lg shadow-inner bg-gray-200" style="height: 65vh; border: 1px solid #ccc;"> {/* Añadir bg color */}
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
             // Esperar un poco y reintentar si Leaflet no está listo
            await new Promise(resolve => setTimeout(resolve, 500));
            if (typeof L === 'undefined') {
                mapContainer.innerHTML = '<p class="text-center text-red-500 pt-10">Error: La librería de mapas (Leaflet) no se cargó correctamente.</p>';
                 _showModal('Error de Mapa', 'No se pudo cargar la librería de mapas. Revisa la conexión a internet o el script de Leaflet.');
                return;
            }
        }
         mapContainer.innerHTML = '<p class="text-center text-gray-500 pt-10">Cargando datos de clientes...</p>'; // Mensaje mientras carga clientes


        try {
            // Usar caché si ya está cargada, si no, cargarla
            if (_consolidatedClientsCache.length === 0) {
                 const clientesRef = _collection(_db, `artifacts/ventas-9a210/public/data/clientes`);
                 const allClientSnapshots = await _getDocs(clientesRef);
                 _consolidatedClientsCache = allClientSnapshots.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            }
            const allClients = _consolidatedClientsCache; // Usar caché


            const clientsWithCoords = allClients.filter(c => {
                if (!c.coordenadas) return false;
                const parts = c.coordenadas.split(',').map(p => parseFloat(p.trim()));
                // Validar que sean números y estén en rangos razonables (latitud -90 a 90, longitud -180 a 180)
                return parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1]) &&
                       parts[0] >= -90 && parts[0] <= 90 && parts[1] >= -180 && parts[1] <= 180;
            });

            if (clientsWithCoords.length === 0) {
                mapContainer.innerHTML = '<p class="text-center text-gray-500 pt-10">No se encontraron clientes con coordenadas válidas para mostrar en el mapa.</p>';
                return;
            }

             // Limpiar contenedor antes de inicializar el mapa
             mapContainer.innerHTML = '';


            // Inicializar mapa si no existe
             if (!mapInstance) {
                mapInstance = L.map('client-map').setView([7.77, -72.22], 13); // Centrado en San Cristóbal por defecto

                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                    maxZoom: 19 // Aumentar zoom máximo
                }).addTo(mapInstance);
            }


            // Definir iconos personalizados
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

            mapMarkers.clear(); // Limpiar marcadores existentes antes de añadir nuevos
            const markerGroup = [];

            clientsWithCoords.forEach(client => {
                const coords = client.coordenadas.split(',').map(p => parseFloat(p.trim()));
                const hasCEP = client.codigoCEP && client.codigoCEP.toLowerCase() !== 'n/a';
                const icon = hasCEP ? blueIcon : redIcon;

                const popupContent = `
                    <b>${client.nombreComercial || 'N/A'}</b><br>
                    ${client.nombrePersonal || ''}<br>
                    Tel: ${client.telefono || 'N/A'}<br>
                    Sector: ${client.sector || 'N/A'}
                    ${hasCEP ? `<br><b>CEP: ${client.codigoCEP}</b>` : ''}
                `;

                // Crear marcador y añadirlo al mapa
                const marker = L.marker(coords, { icon: icon })
                                .bindPopup(popupContent);
                mapMarkers.set(client.nombreComercial, marker); // Guardar referencia para búsqueda
                markerGroup.push(marker); // Añadir al grupo para ajustar bounds
            });

             // Crear una capa de grupo y añadirla al mapa
            const featureGroup = L.featureGroup(markerGroup).addTo(mapInstance);


            // Ajustar la vista del mapa para mostrar todos los marcadores si hay alguno
            if(markerGroup.length > 0) {
                 // Usar fitBounds en lugar de setView para ajustar automáticamente
                mapInstance.fitBounds(featureGroup.getBounds().pad(0.1)); // pad(0.1) añade un pequeño margen
            } else {
                 // Si no hay marcadores, centrar en la vista por defecto
                 mapInstance.setView([7.77, -72.22], 13);
            }


            setupMapSearch(clientsWithCoords); // Configurar la búsqueda

        } catch (error) {
            console.error("Error al cargar el mapa de clientes:", error);
            mapContainer.innerHTML = `<p class="text-center text-red-500 pt-10">Ocurrió un error al cargar los datos de los clientes para el mapa.</p>`;
             _showModal('Error de Mapa', `No se pudieron cargar los datos de los clientes: ${error.message}`);
        }
    }

    /**
     * Configura la funcionalidad de búsqueda en el mapa.
     */
    function setupMapSearch(clients) {
        const searchInput = document.getElementById('map-search-input');
        const resultsContainer = document.getElementById('map-search-results');
        if (!searchInput || !resultsContainer) return;

        searchInput.addEventListener('input', () => {
            const searchTerm = searchInput.value.toLowerCase().trim(); // Añadir trim()
            if (searchTerm.length < 2) {
                resultsContainer.innerHTML = '';
                resultsContainer.classList.add('hidden');
                return;
            }

            const filteredClients = clients.filter(client =>
                (client.nombreComercial && client.nombreComercial.toLowerCase().includes(searchTerm)) ||
                (client.nombrePersonal && client.nombrePersonal.toLowerCase().includes(searchTerm)) ||
                (client.codigoCEP && client.codigoCEP.toLowerCase().includes(searchTerm))
            ).slice(0, 10); // Limitar a 10 resultados para rendimiento


            if (filteredClients.length === 0) {
                resultsContainer.innerHTML = '<div class="p-2 text-gray-500">No se encontraron clientes.</div>';
                resultsContainer.classList.remove('hidden');
                return;
            }

            resultsContainer.innerHTML = filteredClients.map(client => `
                <div class="p-2 hover:bg-gray-100 cursor-pointer border-b last:border-b-0" data-client-name="${client.nombreComercial}">
                    <p class="font-semibold text-sm">${client.nombreComercial}</p>
                    <p class="text-xs text-gray-600">${client.nombrePersonal || ''} ${client.codigoCEP && client.codigoCEP !== 'N/A' ? `(CEP: ${client.codigoCEP})` : ''}</p>
                </div>
            `).join('');
            resultsContainer.classList.remove('hidden');
        });

        // Event listener para seleccionar un resultado
        resultsContainer.addEventListener('click', (e) => {
            const target = e.target.closest('[data-client-name]');
            if (target && mapInstance) {
                const clientName = target.dataset.clientName;
                const marker = mapMarkers.get(clientName); // Buscar marcador por nombre comercial
                if (marker) {
                    mapInstance.flyTo(marker.getLatLng(), 17); // Volar al marcador con zoom
                    marker.openPopup(); // Abrir popup
                }
                // Limpiar búsqueda después de seleccionar
                searchInput.value = '';
                resultsContainer.innerHTML = '';
                resultsContainer.classList.add('hidden');
            }
        });


        // Ocultar resultados si se hace clic fuera del input o de los resultados
        document.addEventListener('click', function(event) {
            if (!resultsContainer.contains(event.target) && event.target !== searchInput) {
                resultsContainer.classList.add('hidden');
            }
        });
    }

    // --- [INICIO] Lógica de Limpieza y Gestión de Datos ---

    /**
     * Muestra la vista para las opciones de limpieza y gestión de datos.
     */
    function showDataManagementView() {
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto max-w-2xl"> {/* Ajustar ancho */}
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl">
                        <h1 class="text-3xl font-bold text-gray-800 mb-6 text-center">Limpieza y Gestión de Datos</h1>
                        <div class="space-y-6">
                             {/* Sección Ventas */}
                            <div class="p-4 border rounded-lg bg-red-50 border-red-200">
                                <h2 class="text-xl font-semibold text-red-800 mb-2">Datos de Ventas (Cierres)</h2>
                                <p class="text-sm text-red-700 mb-4">Esta acción exportará todos los cierres de ventas (públicos y del admin) a archivos Excel y luego los eliminará permanentemente de la base de datos.</p>
                                <button id="deleteExportSalesBtn" class="w-full px-6 py-3 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700">Borrar y Exportar Datos de Ventas</button>
                            </div>

                             {/* Sección Inventario */}
                            <div class="p-4 border rounded-lg bg-yellow-50 border-yellow-200">
                                <h2 class="text-xl font-semibold text-yellow-800 mb-2">Datos de Inventario</h2>
                                <p class="text-sm text-yellow-700 mb-4"><strong>Borrar/Exportar:</strong> Exporta el inventario maestro del admin (incluyendo rubros, segmentos, marcas) a Excel y luego elimina estos datos de TODOS los usuarios.</p>
                                <button id="deleteExportInventoryBtn" class="w-full px-6 py-3 bg-yellow-600 text-white font-semibold rounded-lg shadow-md hover:bg-yellow-700 mb-4">Borrar y Exportar Datos de Inventario</button>

                                <hr class="my-4 border-yellow-300">

                                <p class="text-sm text-yellow-700 mb-2"><strong>Importar:</strong> Importa un inventario completo desde un archivo Excel (formato específico) y lo distribuye a TODOS los usuarios, sobrescribiendo la estructura existente pero conservando las cantidades.</p>
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

    /** Obtiene todos los IDs de usuarios (excepto el admin actual si es necesario) */
    async function getAllUserIds(excludeAdmin = false) {
        const usersRef = _collection(_db, "users");
        const snapshot = await _getDocs(usersRef);
        let userIds = snapshot.docs.map(doc => doc.id);
        if (excludeAdmin) {
            userIds = userIds.filter(id => id !== _userId); // Excluir al admin que ejecuta la acción
        }
        return userIds;
    }


    /** Exporta cierres a Excel (adaptado para separar públicos y admin) */
    async function exportClosingsToExcel(publicClosings, adminClosings) {
         if (typeof XLSX === 'undefined') throw new Error('Librería XLSX no cargada.');

         const wb = XLSX.utils.book_new();

        // Hoja para cierres públicos
         if (publicClosings && publicClosings.length > 0) {
             const publicData = publicClosings.map(c => ({
                 'Fecha': c.fecha.toDate().toISOString().slice(0, 10),
                 'Vendedor_Email': c.vendedorInfo?.email || 'N/A',
                 'Vendedor_Nombre': `${c.vendedorInfo?.nombre || ''} ${c.vendedorInfo?.apellido || ''}`.trim(),
                 'Camion': c.vendedorInfo?.camion || 'N/A',
                 'Total': c.total || 0,
                 'ID_Cierre': c.id || 'N/A', // Incluir ID si está disponible
                 'Datos_Ventas': JSON.stringify(c.ventas) // Guardar ventas como JSON
             }));
             const wsPublic = XLSX.utils.json_to_sheet(publicData);
             XLSX.utils.book_append_sheet(wb, wsPublic, 'Cierres_Publicos');
         } else {
             const wsPublic = XLSX.utils.aoa_to_sheet([["No hay cierres públicos para exportar."]]);
             XLSX.utils.book_append_sheet(wb, wsPublic, 'Cierres_Publicos');
         }

        // Hoja para cierres del admin
        if (adminClosings && adminClosings.length > 0) {
             const adminData = adminClosings.map(c => ({
                 'Fecha': c.fecha.toDate().toISOString().slice(0, 10),
                 'Total': c.total || 0,
                  'ID_Cierre': c.id || 'N/A',
                 'Datos_Ventas': JSON.stringify(c.ventas)
             }));
            const wsAdmin = XLSX.utils.json_to_sheet(adminData);
            XLSX.utils.book_append_sheet(wb, wsAdmin, 'Cierres_Admin');
        } else {
             const wsAdmin = XLSX.utils.aoa_to_sheet([["No hay cierres de admin para exportar."]]);
             XLSX.utils.book_append_sheet(wb, wsAdmin, 'Cierres_Admin');
         }

        const today = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(wb, `Exportacion_Cierres_${today}.xlsx`);
    }


    /** Maneja la exportación y borrado de datos de ventas */
    async function handleDeleteAndExportSales() {
        _showModal('Confirmar Borrado de Ventas',
            `<p class="text-red-600 font-bold">¡ADVERTENCIA!</p>
             <p>Esta acción exportará TODOS los cierres de ventas (públicos y del admin actual) a un archivo Excel y luego los eliminará permanentemente.</p>
             <p class="mt-2">Esta acción NO SE PUEDE DESHACER.</p>
             <p class="mt-4 font-bold">¿Estás absolutamente seguro?</p>`,
            async () => {
                _showModal('Progreso', 'Exportando y eliminando datos de ventas...');
                try {
                    // 1. Obtener datos públicos
                    const publicClosingsRef = _collection(_db, `public_data/${_appId}/user_closings`);
                    const publicSnapshot = await _getDocs(publicClosingsRef);
                    const publicClosings = publicSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                    // 2. Obtener datos del admin
                    const adminClosingsRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/cierres`);
                    const adminSnapshot = await _getDocs(adminClosingsRef);
                    const adminClosings = adminSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                    // 3. Exportar a Excel
                    if (publicClosings.length > 0 || adminClosings.length > 0) {
                         await exportClosingsToExcel(publicClosings, adminClosings);
                    } else {
                         _showModal('Aviso', 'No se encontraron datos de cierres para exportar o eliminar.');
                         return; // No continuar si no hay nada que hacer
                    }


                    // 4. Eliminar datos (con una segunda confirmación implícita por el proceso)
                     _showModal('Progreso', 'Datos exportados. Eliminando registros...');

                    const batchPublic = _writeBatch(_db);
                    publicSnapshot.docs.forEach(doc => batchPublic.delete(doc.ref));
                    await batchPublic.commit();

                    const batchAdmin = _writeBatch(_db);
                    adminSnapshot.docs.forEach(doc => batchAdmin.delete(doc.ref));
                    await batchAdmin.commit();


                    _showModal('Éxito', 'Los datos de ventas han sido exportados y eliminados correctamente.');
                } catch (error) {
                    console.error("Error borrando/exportando ventas:", error);
                    _showModal('Error', `Ocurrió un error: ${error.message}`);
                }
            }, 'Sí, Borrar Todo');
    }

    /** Exporta el inventario maestro del admin a Excel */
    async function exportInventoryToExcel() {
        if (typeof XLSX === 'undefined') throw new Error('Librería XLSX no cargada.');

        const wb = XLSX.utils.book_new();
        const collections = ['inventario', 'rubros', 'segmentos', 'marcas'];
        let dataFound = false;

        for (const colName of collections) {
            const path = `artifacts/${_appId}/users/${_userId}/${colName}`;
            const snapshot = await _getDocs(_collection(_db, path));
            if (!snapshot.empty) {
                dataFound = true;
                const data = snapshot.docs.map(doc => ({ firestore_id: doc.id, ...doc.data() })); // Incluir ID de Firestore
                const ws = XLSX.utils.json_to_sheet(data);
                XLSX.utils.book_append_sheet(wb, ws, colName); // Usar nombre de colección como nombre de hoja
            } else {
                 // Crear hoja vacía si no hay datos
                 const ws = XLSX.utils.aoa_to_sheet([[`No hay datos en ${colName}`]]);
                 XLSX.utils.book_append_sheet(wb, ws, colName);
            }
        }

        if (!dataFound) {
             _showModal('Aviso', 'No se encontraron datos de inventario (productos, rubros, etc.) en la cuenta del administrador para exportar.');
             return false; // Indicar que no se generó archivo
        }


        const today = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(wb, `Exportacion_Inventario_Maestro_${today}.xlsx`);
        return true; // Indicar que se generó archivo
    }

    /** Maneja la exportación y borrado de datos de inventario */
    async function handleDeleteAndExportInventory() {
         _showModal('Confirmar Borrado de Inventario',
            `<p class="text-red-600 font-bold">¡ADVERTENCIA MAYOR!</p>
             <p>Esta acción exportará el inventario maestro del admin actual (incluyendo rubros, segmentos, marcas) a Excel.</p>
             <p class="mt-2">Luego, eliminará permanentemente estos datos (inventario, rubros, segmentos, marcas) de <strong>TODOS los usuarios</strong>, incluyendo el admin.</p>
             <p class="mt-2">Esta acción NO SE PUEDE DESHACER y dejará la aplicación sin inventario hasta que se importe uno nuevo.</p>
             <p class="mt-4 font-bold">¿Estás absolutamente seguro?</p>`,
            async () => {
                _showModal('Progreso', 'Exportando inventario maestro del admin...');
                try {
                    // 1. Exportar inventario del admin
                    const exported = await exportInventoryToExcel();
                    if (!exported) return; // Detener si no había nada que exportar

                    // 2. Obtener IDs de todos los usuarios
                     _showModal('Progreso', 'Inventario exportado. Obteniendo lista de usuarios para limpieza...');
                    const allUserIds = await getAllUserIds();

                    // 3. Eliminar datos de todos los usuarios
                    _showModal('Progreso', `Eliminando datos de inventario para ${allUserIds.length} usuario(s)...`);
                    const collectionsToDelete = ['inventario', 'rubros', 'segmentos', 'marcas'];
                    for (const userIdToDelete of allUserIds) {
                        console.log(`Eliminando datos para usuario: ${userIdToDelete}`);
                        for (const colName of collectionsToDelete) {
                            const path = `artifacts/${_appId}/users/${userIdToDelete}/${colName}`;
                            const snapshot = await _getDocs(_collection(_db, path));
                            if (!snapshot.empty) {
                                const batch = _writeBatch(_db);
                                snapshot.docs.forEach(doc => batch.delete(doc.ref));
                                await batch.commit();
                                console.log(` - ${colName} eliminado para ${userIdToDelete}`);
                            }
                        }
                    }

                    _showModal('Éxito', 'Los datos de inventario (productos, rubros, segmentos, marcas) han sido exportados y eliminados de todos los usuarios.');
                } catch (error) {
                    console.error("Error borrando/exportando inventario:", error);
                    _showModal('Error', `Ocurrió un error: ${error.message}`);
                }
            }, 'Sí, Borrar Todo el Inventario');
    }

    /** Maneja la selección del archivo Excel para importar inventario */
    function handleInventoryFileSelect() {
        const fileInput = document.getElementById('inventory-file-input');
        const file = fileInput.files[0];
        if (!file) {
            _showModal('Error', 'Por favor, selecciona un archivo Excel.');
            return null;
        }
        return file;
    }

    /** Maneja la importación del inventario desde Excel */
    async function handleImportInventory() {
        const file = handleInventoryFileSelect();
        if (!file) return;

        if (typeof XLSX === 'undefined') {
            _showModal('Error', 'La librería XLSX no está cargada.');
            return;
        }

         _showModal('Confirmar Importación de Inventario',
            `<p class="text-orange-600 font-bold">¡ATENCIÓN!</p>
             <p>Esta acción leerá el archivo Excel seleccionado y distribuirá los datos de inventario (incluyendo rubros, segmentos, marcas) a <strong>TODOS los usuarios</strong>.</p>
             <p class="mt-2">Sobreescribirá la estructura existente (productos, categorías), pero intentará conservar las cantidades de stock si un producto ya existe.</p>
             <p class="mt-4 font-bold">Asegúrate de que el archivo tiene el formato correcto (hojas: inventario, rubros, segmentos, marcas). ¿Continuar?</p>`,
            async () => {
                _showModal('Progreso', 'Leyendo archivo Excel...');
                const reader = new FileReader();
                reader.onload = async (e) => {
                    try {
                        const data = e.target.result;
                        const workbook = XLSX.read(data, { type: 'array' });

                        const requiredSheets = ['inventario', 'rubros', 'segmentos', 'marcas'];
                        const importedData = {};
                        let missingSheets = [];

                        requiredSheets.forEach(sheetName => {
                             if (workbook.SheetNames.includes(sheetName)) {
                                 const ws = workbook.Sheets[sheetName];
                                 // Convertir a JSON, asegurando que los IDs se lean si existen
                                 importedData[sheetName] = XLSX.utils.sheet_to_json(ws);
                             } else {
                                 missingSheets.push(sheetName);
                             }
                        });

                         if (missingSheets.length > 0) {
                             throw new Error(`Faltan las siguientes hojas en el archivo Excel: ${missingSheets.join(', ')}`);
                         }
                         if (!importedData.inventario || importedData.inventario.length === 0) {
                             throw new Error("La hoja 'inventario' está vacía o no se pudo leer correctamente.");
                         }


                         // Proceder con la distribución
                         _showModal('Progreso', 'Datos leídos. Obteniendo lista de usuarios...');
                         const allUserIds = await getAllUserIds();

                         _showModal('Progreso', `Distribuyendo datos a ${allUserIds.length} usuario(s)...`);

                         for (const targetId of allUserIds) {
                            console.log(`Importando datos para usuario: ${targetId}`);
                             // Copiar categorías primero (sobrescribir)
                             for(const cat of ['rubros', 'segmentos', 'marcas']) {
                                 // Preparar datos para Firestore (usar firestore_id si existe, si no, generar)
                                 const itemsToCopy = importedData[cat]?.map(item => {
                                      const { firestore_id, ...rest } = item;
                                      // Devolver { id: firestore_id, ...rest } para copyDataToUser
                                      // copyDataToUser espera 'id' como la clave del documento
                                      return { id: firestore_id, ...rest };
                                 }) || []; // Asegurar que sea un array
                                 await copyDataToUser(targetId, cat, itemsToCopy);
                                 console.log(` - ${cat} importado para ${targetId}`);
                             }
                             // Luego, fusionar inventario conservando cantidades
                             const inventarioToMerge = importedData.inventario.map(item => {
                                 const { firestore_id, cantidadUnidades, ...rest } = item; // Excluir cantidadUnidades del origen
                                 return { id: firestore_id, ...rest };
                             });
                             await mergeDataForUser(targetId, 'inventario', inventarioToMerge, 'cantidadUnidades');
                             console.log(` - inventario fusionado para ${targetId}`);
                         }


                        _showModal('Éxito', 'El inventario ha sido importado y distribuido a todos los usuarios.');
                        // Opcional: Volver al menú de gestión o data
                        showDataManagementView();

                    } catch (error) {
                        console.error("Error importando inventario:", error);
                        _showModal('Error', `Error durante la importación: ${error.message}`);
                         // Limpiar input de archivo en caso de error
                         const fileInput = document.getElementById('inventory-file-input');
                         if(fileInput) fileInput.value = '';
                    }
                };
                reader.onerror = (e) => {
                     _showModal('Error', 'No se pudo leer el archivo seleccionado.');
                };
                reader.readAsArrayBuffer(file);
            }, 'Sí, Importar y Distribuir');
    }


    // --- [FIN] Lógica de Limpieza y Gestión de Datos ---

    // --- Lógica del Mapa de Clientes (ya existente, sin cambios necesarios aquí) ---
    // ... (funciones showClientMapView, loadAndDisplayMap, setupMapSearch) ...


    // Exponer funciones públicas al objeto window
    window.dataModule = {
        showClosingDetail,
        handleDownloadSingleClosing
        // No es necesario exponer las funciones de limpieza/importación ya que se llaman internamente
    };

})();

