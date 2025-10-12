// --- Lógica del módulo de Data (solo para Admins) ---

(function() {
    // Variables locales del módulo
    let _db, _appId, _mainContent, _showMainMenu, _showModal;
    let _collection, _getDocs, _query, _where, _orderBy;

    /**
     * Inicializa el módulo con las dependencias necesarias.
     */
    window.initData = function(dependencies) {
        _db = dependencies.db;
        _appId = dependencies.appId;
        _mainContent = dependencies.mainContent;
        _showMainMenu = dependencies.showMainMenu;
        _showModal = dependencies.showModal;
        _collection = dependencies.collection;
        _getDocs = dependencies.getDocs;
        _query = dependencies.query;
        _where = dependencies.where;
        _orderBy = dependencies.orderBy;
    };
    
    /**
     * Muestra la vista principal de Data para buscar y ver cierres de vendedores.
     */
    window.showDataView = function() {
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl">
                        <h1 class="text-3xl font-bold text-gray-800 mb-6 text-center">Datos de Cierres de Vendedores</h1>
                        
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 border rounded-lg items-end">
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
                            <p class="text-center text-gray-500">Seleccione un rango de fechas para buscar.</p>
                        </div>
                        <button id="backToMenuBtn" class="mt-6 w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver al Menú Principal</button>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('backToMenuBtn').addEventListener('click', _showMainMenu);
        document.getElementById('searchCierresBtn').addEventListener('click', handleSearchClosings);
        
        // Set default dates
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('fechaDesde').value = today;
        document.getElementById('fechaHasta').value = today;
    };

    /**
     * Maneja la búsqueda de cierres de vendedores por rango de fecha.
     */
    async function handleSearchClosings() {
        const container = document.getElementById('cierres-list-container');
        container.innerHTML = `<p class="text-center text-gray-500">Buscando...</p>`;

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
            const q = _query(closingsRef, 
                _where("fecha", ">=", fechaDesde),
                _where("fecha", "<=", fechaHasta)
            );

            const snapshot = await _getDocs(q);
            const closings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Guardar en una variable global temporal para el detalle
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
            container.innerHTML = `<p class="text-center text-gray-500">No se encontraron cierres en el rango de fechas seleccionado.</p>`;
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

    /**
     * Muestra el detalle de un cierre en un modal (reutilizando la lógica de ventas.js)
     */
    async function showClosingDetail(closingId) {
        const closingData = window.tempClosingsData.find(c => c.id === closingId);
        if (!closingData) {
            _showModal('Error', 'No se pudieron cargar los detalles del cierre.');
            return;
        }

        // Se reutiliza la misma función de procesamiento de 'ventas.js'
        // Esto requiere que la función global esté disponible
        if (window.ventasModule && typeof window.ventasModule.processSalesDataForReport === 'function') {
            _showModal('Progreso', 'Generando reporte detallado...');
            const { clientData, grandTotalValue, sortedClients, groupedProducts, finalProductOrder, sortedRubros, segmentoOrderMap, vaciosMovements, allProductsMap } = await window.ventasModule.processSalesDataForReport(closingData.ventas);
            
            // La lógica para renderizar las tablas es la misma que en `showVerCierreView` de `ventas.js`
            // Se duplica aquí para mantener el módulo independiente.
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

        } else {
            _showModal('Error', 'No se pudo cargar la función para procesar el reporte de ventas.');
        }
    }


    // Exponer funciones públicas al objeto window
    window.dataModule = {
        showClosingDetail
    };

})();
