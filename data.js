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
    const TIPOS_VACIO = ["1/4 - 1/3", "ret 350 ml", "ret 1.25 Lts"];
    let firebaseConfig = {}; // Placeholder, will be set in initData

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
        firebaseConfig = dependencies.firebaseConfig; // Store firebaseConfig
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
                const userName = (user.nombre || user.apellido) ? `${user.nombre || ''} ${user.apellido || ''}`.trim() : user.email;
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
             if (isNaN(fechaDesde.getTime()) || isNaN(fechaHasta.getTime())) throw new Error("Formato de fecha inválido.");
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
            let q = _query(closingsRef, _where("fecha", ">=", Timestamp.fromDate(fechaDesde)), _where("fecha", "<=", Timestamp.fromDate(fechaHasta)));
            if (selectedUserId) {
                q = _query(q, _where("vendedorInfo.userId", "==", selectedUserId));
            }
            const snapshot = await _getDocs(q);
            let closings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            window.tempClosingsData = closings;
            renderClosingsList(closings);
        } catch (error) {
            console.error("Error al buscar cierres:", error);
            if (error.code === 'failed-precondition' && firebaseConfig.projectId) { // Check if projectId is available
                 container.innerHTML = `<p class="text-center text-red-500">Error: Se requiere un índice de Firestore. <a href="https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/indexes" target="_blank" rel="noopener noreferrer" class="underline">Crear índice</a>.</p>`;
                 _showModal('Error de Índice Requerido', `Firestore necesita un índice. Mensaje: <pre class="text-xs bg-gray-100 p-2 rounded overflow-auto">${error.message}</pre>`);
            } else if (error.code === 'failed-precondition') {
                 container.innerHTML = `<p class="text-center text-red-500">Error: Se requiere un índice de Firestore. Revise la consola de Firebase.</p>`;
                 _showModal('Error de Índice Requerido', `Firestore necesita un índice. Mensaje: <pre class="text-xs bg-gray-100 p-2 rounded overflow-auto">${error.message}</pre>`);
            } else {
                 container.innerHTML = `<p class="text-center text-red-500">Error al buscar: ${error.message}</p>`;
            }
        }
    }

    function renderClosingsList(closings) {
        const container = document.getElementById('cierres-list-container');
        if (!container) return;
        if (!Array.isArray(closings)) {
            console.error("renderClosingsList: closings is not an array", closings);
            container.innerHTML = `<p class="text-center text-red-500">Error al procesar resultados.</p>`;
            return;
        }
        if (closings.length === 0) {
            container.innerHTML = `<p class="text-center text-gray-500">No se encontraron cierres.</p>`;
            return;
        }
        closings.sort((a, b) => {
            const dateA = a.fecha?.toDate ? a.fecha.toDate().getTime() : 0;
            const dateB = b.fecha?.toDate ? b.fecha.toDate().getTime() : 0;
            return dateB - dateA;
        });
        let tableHTML = `<table class="min-w-full bg-white text-sm"><thead class="bg-gray-200 sticky top-0 z-10"><tr><th class="py-2 px-3 border-b text-left">Fecha</th><th class="py-2 px-3 border-b text-left">Vendedor</th><th class="py-2 px-3 border-b text-left">Camión</th><th class="py-2 px-3 border-b text-right">Total Cierre</th><th class="py-2 px-3 border-b text-center">Acciones</th></tr></thead><tbody>`;
        closings.forEach(cierre => {
            const vendedor = cierre.vendedorInfo || {};
            const vendedorNombreCompleto = (vendedor.nombre || vendedor.apellido) ? `${vendedor.nombre || ''} ${vendedor.apellido || ''}`.trim() : (vendedor.email || 'Desconocido');
            const fechaCierre = cierre.fecha?.toDate ? cierre.fecha.toDate() : null;
            tableHTML += `<tr class="hover:bg-gray-50"><td class="py-2 px-3 border-b">${fechaCierre ? fechaCierre.toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' }) : 'Inválida'}</td><td class="py-2 px-3 border-b">${vendedorNombreCompleto}</td><td class="py-2 px-3 border-b">${vendedor.camion || 'N/A'}</td><td class="py-2 px-3 border-b text-right font-semibold">$${(cierre.total || 0).toFixed(2)}</td><td class="py-2 px-3 border-b text-center space-x-2"><button onclick="window.dataModule.showClosingDetail('${cierre.id}')" class="px-3 py-1 bg-blue-500 text-white text-xs rounded-lg hover:bg-blue-600">Ver</button><button onclick="window.dataModule.handleDownloadSingleClosing('${cierre.id}')" title="Descargar Reporte" class="p-1.5 bg-green-500 text-white text-xs rounded-lg hover:bg-green-600 align-middle"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg></button></td></tr>`;
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
                            <div><label for="userFilter" class="block text-sm font-medium text-gray-700">Vendedor:</label><select id="userFilter" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"><option value="">Todos</option></select></div>
                            <div><label for="fechaDesde" class="block text-sm font-medium text-gray-700">Desde:</label><input type="date" id="fechaDesde" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"></div>
                            <div><label for="fechaHasta" class="block text-sm font-medium text-gray-700">Hasta:</label><input type="date" id="fechaHasta" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"></div>
                            <button id="searchCierresBtn" class="w-full px-6 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700">Buscar</button>
                        </div>
                        <div id="cierres-list-container" class="overflow-x-auto max-h-96"><p class="text-center text-gray-500">Seleccione opciones.</p></div>
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
            mapInstance = null; mapMarkers.clear();
        }
        if (_floatingControls) _floatingControls.classList.add('hidden');
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl text-center">
                        <h1 class="text-3xl font-bold text-gray-800 mb-6">Módulo de Datos</h1>
                        <div class="space-y-4">
                            <button id="closingDataBtn" class="w-full px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700">Datos de Cierres</button>
                            <button id="productStatsBtn" class="w-full px-6 py-3 bg-teal-600 text-white font-semibold rounded-lg shadow-md hover:bg-teal-700">Estadística Productos</button>
                            <button id="consolidatedClientsBtn" class="w-full px-6 py-3 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700">Clientes Consolidados</button>
                            <button id="clientMapBtn" class="w-full px-6 py-3 bg-cyan-600 text-white font-semibold rounded-lg shadow-md hover:bg-cyan-700">Mapa de Clientes</button>
                            <button id="dataManagementBtn" class="w-full px-6 py-3 bg-yellow-600 text-white font-semibold rounded-lg shadow-md hover:bg-yellow-700">Limpieza y Gestión</button>
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
        if (_rubroOrderCacheData?.userId === userIdForData) return _rubroOrderCacheData.map;
        const map = {};
        const rubrosRef = _collection(_db, `artifacts/${_appId}/users/${userIdForData}/rubros`);
        try {
            const snapshot = await _getDocs(rubrosRef);
            snapshot.docs.forEach(doc => { const data = doc.data(); map[data.name] = data.orden ?? 9999; });
            _rubroOrderCacheData = { userId: userIdForData, map: map };
            return map;
        } catch (e) {
            console.warn(`No se pudo obtener orden rubros para ${userIdForData} en data.js`, e);
            return {};
        }
    }

    async function getSegmentoOrderMapData(userIdForData) {
        if (_segmentoOrderCacheData?.userId === userIdForData) return _segmentoOrderCacheData.map;
        const map = {};
        const segmentosRef = _collection(_db, `artifacts/${_appId}/users/${userIdForData}/segmentos`);
        try {
            const snapshot = await _getDocs(segmentosRef);
            snapshot.docs.forEach(doc => { const data = doc.data(); map[data.name] = data.orden ?? 9999; });
             _segmentoOrderCacheData = { userId: userIdForData, map: map };
            return map;
        } catch (e) {
            console.warn(`No se pudo obtener orden segmentos para ${userIdForData} en data.js`, e);
            return {};
        }
    }

    async function processSalesDataForReport(ventas, userIdForInventario) {
        if (_rubroOrderCacheData?.userId !== userIdForInventario) _rubroOrderCacheData = null;
        if (_segmentoOrderCacheData?.userId !== userIdForInventario) _segmentoOrderCacheData = null;
        const clientData = {}; let grandTotalValue = 0; const allProductsMap = new Map(); const vaciosMovementsPorTipo = {};
        let inventarioMap = new Map();
        try {
            const inventarioRef = _collection(_db, `artifacts/${_appId}/users/${userIdForInventario}/inventario`);
            const inventarioSnapshot = await _getDocs(inventarioRef);
            inventarioMap = new Map(inventarioSnapshot.docs.map(doc => [doc.id, doc.data()]));
        } catch(invError) {
             console.error(`Error leyendo inventario de ${userIdForInventario}:`, invError);
             _showModal('Error de Datos', `No se pudo leer inventario del vendedor: ${invError.message}`);
             return { clientData: {}, grandTotalValue: 0, sortedClients: [], groupedProducts: {}, finalProductOrder: [], sortedRubros: [], segmentoOrderMap: {}, vaciosMovementsPorTipo: {}, allProductsMap: new Map() };
        }
        ventas.forEach(venta => {
            const clientName = venta.clienteNombre || 'Desconocido';
            if (!clientData[clientName]) clientData[clientName] = { products: {}, totalValue: 0 };
             if (!vaciosMovementsPorTipo[clientName]) {
                 vaciosMovementsPorTipo[clientName] = {};
                 TIPOS_VACIO.forEach(tipo => vaciosMovementsPorTipo[clientName][tipo] = { entregados: 0, devueltos: 0 });
             }
            clientData[clientName].totalValue += venta.total || 0; grandTotalValue += venta.total || 0;
             const vaciosDevueltosEnVenta = venta.vaciosDevueltosPorTipo || {};
             for (const tipoVacio in vaciosDevueltosEnVenta) {
                 if (vaciosMovementsPorTipo[clientName][tipoVacio]) {
                     vaciosMovementsPorTipo[clientName][tipoVacio].devueltos += vaciosDevueltosEnVenta[tipoVacio] || 0;
                 } else { console.warn(`Tipo vacío '${tipoVacio}' en venta no inicializado para ${clientName}.`); }
             }
            (venta.productos || []).forEach(p => {
                 const productoCompleto = inventarioMap.get(p.id) || p;
                 const tipoVacioProd = productoCompleto.tipoVacio;
                 if (productoCompleto.manejaVacios && tipoVacioProd && vaciosMovementsPorTipo[clientName]?.[tipoVacioProd]) {
                     vaciosMovementsPorTipo[clientName][tipoVacioProd].entregados += p.cantidadVendida?.cj || 0;
                 }
                const rubro = productoCompleto.rubro || 'Sin Rubro'; const segmento = productoCompleto.segmento || 'Sin Segmento'; const marca = productoCompleto.marca || 'Sin Marca';
                if (!allProductsMap.has(p.id)) {
                    allProductsMap.set(p.id, { ...productoCompleto, id: p.id, rubro, segmento, marca, presentacion: p.presentacion });
                }
                if (!clientData[clientName].products[p.id]) clientData[clientName].products[p.id] = 0;
                clientData[clientName].products[p.id] += p.totalUnidadesVendidas || 0;
            });
        });
        const sortedClients = Object.keys(clientData).sort();
        const groupedProducts = {};
        for (const product of allProductsMap.values()) {
             const rubroKey = product.rubro || 'Sin Rubro'; const segmentoKey = product.segmento || 'Sin Segmento'; const marcaKey = product.marca || 'Sin Marca';
            if (!groupedProducts[rubroKey]) groupedProducts[rubroKey] = {}; if (!groupedProducts[rubroKey][segmentoKey]) groupedProducts[rubroKey][segmentoKey] = {}; if (!groupedProducts[rubroKey][segmentoKey][marcaKey]) groupedProducts[rubroKey][segmentoKey][marcaKey] = [];
            groupedProducts[rubroKey][segmentoKey][marcaKey].push(product);
        }
        const rubroOrderMap = await getRubroOrderMapData(userIdForInventario); const segmentoOrderMap = await getSegmentoOrderMapData(userIdForInventario);
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
            _showModal('Error', 'Datos de cierres no disponibles. Busca de nuevo.'); return;
        }
        const closingData = window.tempClosingsData.find(c => c.id === closingId);
        if (!closingData?.vendedorInfo?.userId) {
            _showModal('Error', 'No se cargaron detalles o falta info vendedor.'); return;
        }
        _showModal('Progreso', 'Generando reporte detallado...');
        try {
            const { clientData, grandTotalValue, sortedClients, groupedProducts, finalProductOrder, sortedRubros, segmentoOrderMap, vaciosMovementsPorTipo, allProductsMap } = await processSalesDataForReport(closingData.ventas || [], closingData.vendedorInfo.userId);
            let h1=`<tr class="sticky top-0 z-20"><th rowspan="4" class="p-1 border bg-gray-200 sticky left-0 z-30">Cliente</th>`,h2=`<tr class="sticky z-20" style="top: 25px;">`,h3=`<tr class="sticky z-20" style="top: 50px;">`,h4=`<tr class="sticky z-20" style="top: 75px;">`;
            sortedRubros.forEach(rubro => {
                let rCS=0; const sS=Object.keys(groupedProducts[rubro]||{}).sort((a,b)=>(segmentoOrderMap[a]??999)-(segmentoOrderMap[b]??999));
                sS.forEach(seg=>{ const sM=Object.keys(groupedProducts[rubro]?.[seg]||{}).sort(); sM.forEach(mar=>{ rCS+=groupedProducts[rubro]?.[seg]?.[mar]?.length||0; }); });
                if(rCS>0)h1+=`<th colspan="${rCS}" class="p-1 border bg-gray-300">${rubro}</th>`;
                sS.forEach(seg=>{ let segCS=0; const sM=Object.keys(groupedProducts[rubro]?.[seg]||{}).sort(); sM.forEach(mar=>{ segCS+=groupedProducts[rubro]?.[seg]?.[mar]?.length||0; });
                if(segCS>0)h2+=`<th colspan="${segCS}" class="p-1 border bg-gray-200">${seg}</th>`;
                sM.forEach(mar=>{ const marCS=groupedProducts[rubro]?.[seg]?.[mar]?.length||0; if(marCS>0)h3+=`<th colspan="${marCS}" class="p-1 border bg-gray-100">${mar}</th>`;
                const sP=(groupedProducts[rubro]?.[seg]?.[mar]||[]).sort((a,b)=>(a.presentacion||'').localeCompare(b.presentacion||'')); sP.forEach(prod=>{ h4+=`<th class="p-1 border bg-gray-50 whitespace-nowrap">${prod.presentacion}</th>`; }); }); });
            });
            h1+=`<th rowspan="4" class="p-1 border bg-gray-200 sticky right-0 z-30">Total</th></tr>`;h2+=`</tr>`;h3+=`</tr>`;h4+=`</tr>`; let bH='';
            sortedClients.forEach(cliN=>{ bH+=`<tr class="hover:bg-blue-50"><td class="p-1 border font-medium bg-white sticky left-0 z-10">${cliN}</td>`; const cCli=clientData[cliN];
            finalProductOrder.forEach(prod=>{ const qU=cCli.products?.[prod.id]||0; let dQ=''; if(qU>0){ dQ=`${qU} Unds`; const vP=prod.ventaPor||{}; const uPC=prod.unidadesPorCaja||1; const uPP=prod.unidadesPorPaquete||1; if(vP.cj&&uPC>0){ const tB=qU/uPC; dQ=`${Number.isInteger(tB)?tB:tB.toFixed(1)} Cj`; }else if(vP.paq&&uPP>0){ const tP=qU/uPP; dQ=`${Number.isInteger(tP)?tP:tP.toFixed(1)} Paq`; } } bH+=`<td class="p-1 border text-center">${dQ}</td>`; }); bH+=`<td class="p-1 border text-right font-semibold bg-white sticky right-0 z-10">$${(cCli.totalValue||0).toFixed(2)}</td></tr>`; });
            let fH='<tr class="bg-gray-200 font-bold"><td class="p-1 border sticky left-0 z-10">TOTALES</td>';
            finalProductOrder.forEach(prod=>{ let tQ=0; sortedClients.forEach(cliN=>{ tQ+=clientData[cliN]?.products?.[prod.id]||0; }); let dT=''; if(tQ>0){ dT=`${tQ} Unds`; const vP=prod.ventaPor||{}; const uPC=prod.unidadesPorCaja||1; const uPP=prod.unidadesPorPaquete||1; if(vP.cj&&uPC>0){ const tB=tQ/uPC; dT=`${Number.isInteger(tB)?tB:tB.toFixed(1)} Cj`; }else if(vP.paq&&uPP>0){ const tP=tQ/uPP; dT=`${Number.isInteger(tP)?tP:tP.toFixed(1)} Paq`; } } fH+=`<td class="p-1 border text-center">${dT}</td>`; }); fH+=`<td class="p-1 border text-right sticky right-0 z-10">$${(grandTotalValue||0).toFixed(2)}</td></tr>`;
            let vRH=''; const tCM=TIPOS_VACIO.filter(tipo=>sortedClients.some(cli=> (vaciosMovementsPorTipo[cli]?.[tipo]?.entregados||0)>0 || (vaciosMovementsPorTipo[cli]?.[tipo]?.devueltos||0)>0));
            if(tCM.length>0){ vRH=`<h3 class="text-xl font-bold text-gray-800 my-6">Reporte Envases Retornables</h3>`;
            tCM.forEach(tipoV=>{ vRH+=`<h4 class="text-lg font-semibold text-gray-700 mt-4 mb-2">${tipoV}</h4><div class="overflow-auto border mb-4"><table class="min-w-full bg-white text-xs"><thead class="bg-gray-200"><tr><th class="p-1 border text-left">Cliente</th><th class="p-1 border text-center">Entregados</th><th class="p-1 border text-center">Devueltos</th><th class="p-1 border text-center">Neto</th></tr></thead><tbody>`;
            const cDT=sortedClients.filter(cli=> (vaciosMovementsPorTipo[cli]?.[tipoV]?.entregados||0)>0 || (vaciosMovementsPorTipo[cli]?.[tipoV]?.devueltos||0)>0);
            cDT.forEach(cli=>{ const mov=vaciosMovementsPorTipo[cli]?.[tipoV]||{entregados:0, devueltos:0}; const neto=mov.entregados-mov.devueltos; vRH+=`<tr class="hover:bg-blue-50"><td class="p-1 border">${cli}</td><td class="p-1 border text-center">${mov.entregados}</td><td class="p-1 border text-center">${mov.devueltos}</td><td class="p-1 border text-center font-bold">${neto>0?`+${neto}`:(neto<0?neto:'0')}</td></tr>`; }); vRH+='</tbody></table></div>'; }); }
            const vend=closingData.vendedorInfo||{}; const fCM=closingData.fecha?.toDate?closingData.fecha.toDate():null;
            const repH=`<div class="text-left max-h-[80vh] overflow-auto"><div class="mb-4"><p><strong>Vendedor:</strong> ${vend.nombre||''} ${vend.apellido||''}</p><p><strong>Camión:</strong> ${vend.camion||'N/A'}</p><p><strong>Fecha:</strong> ${fCM?fCM.toLocaleString('es-ES',{dateStyle:'short',timeStyle:'short'}):'Inválida'}</p></div><h3 class="text-xl font-bold text-gray-800 mb-4">Reporte Cierre</h3><div class="overflow-auto border"><table class="min-w-full bg-white text-xs"><thead class="bg-gray-200">${h1}${h2}${h3}${h4}</thead><tbody>${bH}</tbody><tfoot>${fH}</tfoot></table></div>${vRH}</div>`;
            _showModal(`Detalle Cierre`, repH);
        } catch (reportError) { console.error("Error generating closing detail report:", reportError); _showModal('Error', `No se pudo generar reporte: ${reportError.message}`); }
    }

    async function exportSingleClosingToExcel(closingData) {
        if (typeof XLSX === 'undefined') throw new Error('Librería XLSX no cargada.');
        if (!closingData?.vendedorInfo?.userId) throw new Error('Datos del cierre incompletos.');
        const { clientData, grandTotalValue, sortedClients, groupedProducts, finalProductOrder, sortedRubros, segmentoOrderMap, vaciosMovementsPorTipo } = await processSalesDataForReport(closingData.ventas || [], closingData.vendedorInfo.userId);
        const dS1 = []; const m1 = []; let h1=[""], h2=[""], h3=[""], h4=["Cliente"]; let cC=1;
        sortedRubros.forEach(rubro => { const rSC=cC; let rCS=0; const sS=Object.keys(groupedProducts[rubro]||{}).sort((a,b)=>(segmentoOrderMap[a]??999)-(segmentoOrderMap[b]??999));
        sS.forEach(seg=>{ const segSC=cC; let segCS=0; const sM=Object.keys(groupedProducts[rubro]?.[seg]||{}).sort(); sM.forEach(mar=>{ const marSC=cC; const pres=(groupedProducts[rubro]?.[seg]?.[mar]||[]).sort((a,b)=>(a.presentacion||'').localeCompare(b.presentacion||'')); const marCS=pres.length; if(marCS>0){ rCS+=marCS; segCS+=marCS; h3.push(mar); for(let i=1;i<marCS;i++)h3.push(""); if(marCS>1)m1.push({s:{r:2,c:marSC},e:{r:2,c:marSC+marCS-1}}); pres.forEach(p=>h4.push(p.presentacion)); cC+=marCS; } }); if(segCS>0){ h2.push(seg); for(let i=1;i<segCS;i++)h2.push(""); if(segCS>1)m1.push({s:{r:1,c:segSC},e:{r:1,c:segSC+segCS-1}}); } }); if(rCS>0){ h1.push(rubro); for(let i=1;i<rCS;i++)h1.push(""); if(rCS>1)m1.push({s:{r:0,c:rSC},e:{r:0,c:rSC+rCS-1}}); } });
        const tC=finalProductOrder.length; h1.push("");h2.push("");h3.push("");h4.push("Total Cliente"); dS1.push(h1,h2,h3,h4); m1.push({s:{r:0,c:0},e:{r:3,c:0}}); m1.push({s:{r:0,c:tC+1},e:{r:3,c:tC+1}});
        sortedClients.forEach(cliN=>{ const row=[cliN]; const cCli=clientData[cliN]; finalProductOrder.forEach(prod=>{ const qU=cCli.products?.[prod.id]||0; let dQ=''; if(qU>0){ dQ=`${qU} Unds`; const vP=prod.ventaPor||{}; const uPC=prod.unidadesPorCaja||1; const uPP=prod.unidadesPorPaquete||1; if(vP.cj&&uPC>0){ const tB=qU/uPC; dQ=`${Number.isInteger(tB)?tB:tB.toFixed(1)} Cj`; }else if(vP.paq&&uPP>0){ const tP=qU/uPP; dQ=`${Number.isInteger(tP)?tP:tP.toFixed(1)} Paq`; } } row.push(dQ); }); row.push(cCli.totalValue||0); dS1.push(row); });
        const fR=["TOTALES"]; finalProductOrder.forEach(prod=>{ let tQ=0; sortedClients.forEach(cliN=>tQ+=clientData[cliN]?.products?.[prod.id]||0); let dT=''; if(tQ>0){ dT=`${tQ} Unds`; const vP=prod.ventaPor||{}; const uPC=prod.unidadesPorCaja||1; const uPP=prod.unidadesPorPaquete||1; if(vP.cj&&uPC>0){ const tB=tQ/uPC; dT=`${Number.isInteger(tB)?tB:tB.toFixed(1)} Cj`; }else if(vP.paq&&uPP>0){ const tP=tQ/uPP; dT=`${Number.isInteger(tP)?tP:tP.toFixed(1)} Paq`; } } fR.push(dT); }); fR.push(grandTotalValue||0); dS1.push(fR);
        const ws1 = XLSX.utils.aoa_to_sheet(dS1); ws1['!merges']=m1; const tCL=XLSX.utils.encode_col(tC+1); ws1['!cols']=ws1['!cols']||[]; ws1['!cols'][tC+1]={wch:15}; for(let R=4;R<dS1.length;++R){ const cR=`${tCL}${R+1}`; if(ws1[cR]){ ws1[cR].t='n'; ws1[cR].z='$#,##0.00'; } }
        const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws1, 'Reporte Cierre');
        const tCM=TIPOS_VACIO.filter(tipo=>sortedClients.some(cli=>(vaciosMovementsPorTipo[cli]?.[tipo]?.entregados||0)>0||(vaciosMovementsPorTipo[cli]?.[tipo]?.devueltos||0)>0));
        if(tCM.length>0){ const dS2=[['Tipo Vacío','Cliente','Entregados','Devueltos','Neto']]; tCM.forEach(tipoV=>{ const cDT=sortedClients.filter(cli=>(vaciosMovementsPorTipo[cli]?.[tipoV]?.entregados||0)>0||(vaciosMovementsPorTipo[cli]?.[tipoV]?.devueltos||0)>0); cDT.forEach(cli=>{ const mov=vaciosMovementsPorTipo[cli]?.[tipoV]||{entregados:0,devueltos:0}; const neto=mov.entregados-mov.devueltos; dS2.push([tipoV,cli,mov.entregados,mov.devueltos,neto]); }); }); const ws2=XLSX.utils.aoa_to_sheet(dS2); ws2['!cols']=[{wch:20},{wch:30},{wch:15},{wch:15},{wch:10}]; XLSX.utils.book_append_sheet(wb, ws2, 'Reporte Vacíos'); }
        const vend=closingData.vendedorInfo||{}; const fCF=closingData.fecha?.toDate?closingData.fecha.toDate():new Date(); const fS=fCF.toISOString().slice(0,10); const vNF=(`${vend.nombre||''}_${vend.apellido||''}`.trim()||vend.email||'Vendedor').replace(/[^a-z0-9]/gi,'_').toLowerCase();
        XLSX.writeFile(wb, `Cierre_${vNF}_${fS}.xlsx`);
    }

    async function handleDownloadSingleClosing(closingId) {
         if (!window.tempClosingsData || !Array.isArray(window.tempClosingsData)) { _showModal('Error', 'Datos de búsqueda no disponibles.'); return; }
        const closingData = window.tempClosingsData.find(c => c.id === closingId);
        if (!closingData) { _showModal('Error', 'No se encontraron datos del cierre.'); return; }
        _showModal('Progreso', 'Generando Excel...');
        try {
            await exportSingleClosingToExcel(closingData);
            const mC=document.getElementById('modalContainer'); const mT=mC?.querySelector('h3')?.textContent; if(mC&&mT==='Progreso')mC.classList.add('hidden');
        } catch (error) { console.error("Error al exportar cierre:", error); _showModal('Error', `Error al generar archivo: ${error.message}`); }
    }

    function showProductStatsView() {
        if (_floatingControls) _floatingControls.classList.add('hidden');
        _mainContent.innerHTML = `
            <div class="p-4 pt-8"><div class="container mx-auto"><div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl"><h1 class="text-3xl font-bold text-gray-800 mb-6 text-center">Estadística Productos Vendidos</h1><div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 border rounded-lg items-end"><div><label for="stats-type" class="block text-sm font-medium text-gray-700">Tipo:</label><select id="stats-type" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"><option value="semanal">Semanal</option><option value="mensual">Mensual</option><option value="general">General (Prom. Sem.)</option></select></div><div><label for="stats-rubro-filter" class="block text-sm font-medium text-gray-700">Rubro:</label><select id="stats-rubro-filter" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"></select></div><button id="searchStatsBtn" class="w-full px-6 py-2 bg-teal-600 text-white font-semibold rounded-lg shadow-md hover:bg-teal-700">Mostrar</button></div><div id="stats-list-container" class="overflow-x-auto max-h-96"><p class="text-center text-gray-500">Seleccione opciones.</p></div><button id="backToDataMenuBtn" class="mt-6 w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver</button></div></div></div>`;
        _populateDropdown(`artifacts/${_appId}/users/${_userId}/rubros`, 'stats-rubro-filter', 'Rubro');
        document.getElementById('backToDataMenuBtn').addEventListener('click', showDataView);
        document.getElementById('searchStatsBtn').addEventListener('click', handleSearchStats);
    }

     async function handleSearchStats() {
        const container = document.getElementById('stats-list-container'); if (!container) return; container.innerHTML = `<p class="text-center text-gray-500">Calculando...</p>`;
        const statsType = document.getElementById('stats-type')?.value; const rubroFilter = document.getElementById('stats-rubro-filter')?.value;
         if (!statsType || rubroFilter === undefined) { console.error("Error: Elementos formulario stats no encontrados."); _showModal('Error Interno', 'Controles no encontrados.'); container.innerHTML = `<p class="text-center text-red-500">Error interno.</p>`; return; }
        if (!rubroFilter) { _showModal('Error', 'Seleccione un rubro.'); container.innerHTML = `<p class="text-center text-gray-500">Seleccione rubro.</p>`; return; }
        const now = new Date(); let fD; let fH = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        if (statsType === 'semanal') { const dW = now.getDay(); fD = new Date(now); const diff = now.getDate() - dW + (dW === 0 ? -6 : 1); fD.setDate(diff); fD.setHours(0, 0, 0, 0); }
        else if (statsType === 'mensual') { fD = new Date(now.getFullYear(), now.getMonth(), 1); fD.setHours(0, 0, 0, 0); }
        else { fD = new Date(0); }
        try {
             const { Timestamp } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js");
            const pCR = _collection(_db, `public_data/${_appId}/user_closings`); const pQ = _query(pCR, _where("fecha", ">=", Timestamp.fromDate(fD)), _where("fecha", "<=", Timestamp.fromDate(fH))); const pS = await _getDocs(pQ); const allC = pS.docs.map(doc => doc.data());
            if (allC.length === 0) { container.innerHTML = `<p class="text-center text-gray-500">No hay datos.</p>`; _lastStatsData = []; const dB = document.getElementById('downloadStatsBtn'); if (dB) dB.remove(); return; } // Remove download button if exists
            const productSales = {}; const aIR = _collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`); const iS = await _getDocs(aIR); const aIM = new Map(iS.docs.map(doc => [doc.id, doc.data()]));
            allC.forEach(c => { (c.ventas||[]).forEach(v => { (v.productos||[]).forEach(p => { const aPI = aIM.get(p.id); if (aPI?.rubro === rubroFilter) { if (!productSales[p.id]) { productSales[p.id] = { id: p.id, presentacion: aPI.presentacion, marca: aPI.marca||'Sin Marca', segmento: aPI.segmento||'Sin Segmento', totalUnidades: 0, ventaPor: aPI.ventaPor, unidadesPorCaja: aPI.unidadesPorCaja||1, unidadesPorPaquete: aPI.unidadesPorPaquete||1 }; } productSales[p.id].totalUnidades += p.totalUnidadesVendidas || 0; } }); }); });
            const pA = Object.values(productSales); let nW = 1; if (statsType === 'general') { const oD = 864e5; const fDt = allC.reduce((min, c) => { const cD = c.fecha?.toDate ? c.fecha.toDate() : min; return cD < min ? cD : min; }, new Date()); nW = Math.max(1, Math.ceil(Math.abs((now - fDt) / (oD * 7)))); }
            _lastStatsData = pA; _lastNumWeeks = nW; renderStatsList(pA, statsType, nW);
        } catch (error) {
            console.error("Error calculando stats:", error);
             if (error.code === 'failed-precondition' && firebaseConfig.projectId) { container.innerHTML = `<p class="text-center text-red-500">Error: Índice Firestore requerido. <a href="https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/indexes" target="_blank" class="underline">Crear índice</a>.</p>`; _showModal('Error Índice', `Firestore necesita índice. Mensaje: <pre class="text-xs bg-gray-100 p-2 rounded overflow-auto">${error.message}</pre>`); }
             else if (error.code === 'failed-precondition') { container.innerHTML = `<p class="text-center text-red-500">Error: Índice Firestore requerido.</p>`; _showModal('Error Índice', `Firestore necesita índice. Mensaje: <pre class="text-xs bg-gray-100 p-2 rounded overflow-auto">${error.message}</pre>`); }
             else { container.innerHTML = `<p class="text-center text-red-500">Error calculando: ${error.message}</p>`; }
             _lastStatsData = []; const dB = document.getElementById('downloadStatsBtn'); if (dB) dB.remove(); // Remove download button if exists
        }
    }

     function renderStatsList(productArray, statsType, numWeeks = 1) {
        const container = document.getElementById('stats-list-container'); if (!container) return;
        // Remove existing download button before rendering list
        const existingDownloadBtnContainer = container.nextElementSibling;
        if(existingDownloadBtnContainer && existingDownloadBtnContainer.querySelector('#downloadStatsBtn')) {
            existingDownloadBtnContainer.remove();
        }

        if (!Array.isArray(productArray)) { console.error("renderStatsList: productArray is not array"); container.innerHTML = `<p class="text-center text-red-500">Error interno.</p>`; return; }
        if (productArray.length === 0) { container.innerHTML = `<p class="text-center text-gray-500">No se encontraron ventas.</p>`; return; }
        const hT = statsType === 'general' ? 'Promedio Semanal' : 'Total Vendido'; let tH = `<table class="min-w-full bg-white text-sm"><thead class="bg-gray-200 sticky top-0 z-10"><tr><th class="py-2 px-3 border-b text-left">Producto</th><th class="py-2 px-3 border-b text-center">${hT}</th></tr></thead><tbody>`;
        productArray.sort((a, b) => { const mC=(a.marca||'').localeCompare(b.marca||''); if(mC!==0)return mC; const sC=(a.segmento||'').localeCompare(b.segmento||''); if(sC!==0)return sC; return(a.presentacion||'').localeCompare(b.presentacion||''); });
        productArray.forEach(p => { let dQ=0; let dU='Unds'; const val=(p.totalUnidades||0)/numWeeks; const vP=p.ventaPor||{und:true}; const uPC=p.unidadesPorCaja||1; const uPP=p.unidadesPorPaquete||1; if(vP.cj){dQ=(val/Math.max(1,uPC)).toFixed(1);dU='Cajas';} else if(vP.paq){dQ=(val/Math.max(1,uPP)).toFixed(1);dU='Paq.';} else{dQ=val.toFixed(0);} dQ=dQ.replace(/\.0$/,''); tH+=`<tr class="hover:bg-gray-50"><td class="py-2 px-3 border-b">${p.marca} - ${p.segmento} - ${p.presentacion}</td><td class="py-2 px-3 border-b text-center font-bold">${dQ} <span class="font-normal text-xs">${dU}</span></td></tr>`; });
        tH+=`</tbody></table>`; container.innerHTML=tH;
         const dBHTML=`<div class="mt-6 text-center"><button id="downloadStatsBtn" class="px-6 py-2 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700">Descargar Excel</button></div>`; container.insertAdjacentHTML('afterend',dBHTML);
         const nDB=document.getElementById('downloadStatsBtn'); if(nDB)nDB.addEventListener('click',handleDownloadStats); else console.error("Failed to find/add download button.");
    }

     function handleDownloadStats() {
        if (!Array.isArray(_lastStatsData)||_lastStatsData.length===0){ _showModal('Aviso','No hay datos para descargar.'); return; } if(typeof XLSX==='undefined'){ _showModal('Error','Librería XLSX no cargada.'); return; }
        const sT=document.getElementById('stats-type')?.value||'desconocido'; const hT=sT==='general'?'Promedio Semanal':'Total Vendido';
        try { const dTE=_lastStatsData.map(p=>{ let dQ=0; let dU='Unds'; const val=(p.totalUnidades||0)/_lastNumWeeks; const vP=p.ventaPor||{und:true}; const uPC=p.unidadesPorCaja||1; const uPP=p.unidadesPorPaquete||1; if(vP.cj){dQ=(val/Math.max(1,uPC)).toFixed(1);dU='Cajas';} else if(vP.paq){dQ=(val/Math.max(1,uPP)).toFixed(1);dU='Paq.';} else{dQ=val.toFixed(0);} dQ=dQ.replace(/\.0$/,''); return{'Marca':p.marca||'','Segmento':p.segmento||'','Presentación':p.presentacion||'',[hT]:`${dQ} ${dU}`}; });
            const ws=XLSX.utils.json_to_sheet(dTE); ws['!cols']=[{wch:20},{wch:20},{wch:30},{wch:20}]; const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Estadisticas');
            const rE=document.getElementById('stats-rubro-filter'); const rub=rE?rE.value:'Todos'; const tod=new Date().toISOString().slice(0,10); XLSX.writeFile(wb,`Estadisticas_${rub.replace(/[^a-z0-9]/gi,'_').toLowerCase()}_${sT}_${tod}.xlsx`);
        } catch(e){ console.error("Error generating Excel for stats:",e); _showModal('Error Exportación',`No se pudo generar Excel: ${e.message}`); }
    }

    async function showConsolidatedClientsView() {
        if (_floatingControls) _floatingControls.classList.add('hidden');
        _mainContent.innerHTML = `<div class="p-4 pt-8"><div class="container mx-auto"><div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl"><h1 class="text-3xl font-bold text-gray-800 mb-6 text-center">Clientes Consolidados</h1><div id="consolidated-clients-filters"><p class="text-center text-gray-500">Cargando...</p></div><div id="consolidated-clients-container" class="overflow-x-auto max-h-96"><p class="text-center text-gray-500">Cargando...</p></div><div class="mt-6 flex flex-col sm:flex-row gap-4"><button id="backToDataMenuBtn" class="w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver</button><button id="downloadClientsBtn" class="w-full px-6 py-3 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 hidden">Descargar Lista</button></div></div></div></div>`;
        document.getElementById('backToDataMenuBtn').addEventListener('click', showDataView);
        document.getElementById('downloadClientsBtn').addEventListener('click', handleDownloadFilteredClients);
        await loadAndRenderConsolidatedClients();
    }

     async function loadAndRenderConsolidatedClients() {
        const cont=document.getElementById('consolidated-clients-container'); const fCont=document.getElementById('consolidated-clients-filters'); if(!cont||!fCont)return;
        try { const cR=_collection(_db,`artifacts/ventas-9a210/public/data/clientes`); const allCS=await _getDocs(cR); _consolidatedClientsCache=allCS.docs.map(doc=>({id:doc.id,...doc.data()}));
            fCont.innerHTML=`<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 border rounded-lg"><input type="text" id="client-search-input" placeholder="Buscar..." class="md:col-span-2 w-full px-4 py-2 border rounded-lg"><div><label for="client-filter-sector" class="text-sm font-medium">Sector</label><select id="client-filter-sector" class="w-full px-2 py-1 border rounded-lg text-sm"><option value="">Todos</option></select></div><button id="clearClientFiltersBtn" class="bg-gray-300 text-xs font-semibold rounded-lg self-end py-1.5 px-3 hover:bg-gray-400 md:col-start-3">Limpiar</button></div>`;
            const sF=document.getElementById('client-filter-sector'); const sI=document.getElementById('client-search-input'); const cB=document.getElementById('clearClientFiltersBtn');
            try { const sR=_collection(_db,`artifacts/ventas-9a210/public/data/sectores`); const sS=await _getDocs(sR); const uS=sS.docs.map(doc=>doc.data().name).sort(); uS.forEach(sec=>{sF.innerHTML+=`<option value="${sec}">${sec}</option>`;}); } catch (sE) { console.error("Error loading sectors:",sE); sF.innerHTML='<option value="">Error</option>'; }
            sI.addEventListener('input',renderConsolidatedClientsList); sF.addEventListener('change',renderConsolidatedClientsList); cB.addEventListener('click',()=>{sI.value='';sF.value='';renderConsolidatedClientsList();});
            renderConsolidatedClientsList(); const dB=document.getElementById('downloadClientsBtn'); if(dB)dB.classList.remove('hidden');
        } catch(e){ console.error("Error loading clients:",e); cont.innerHTML=`<p class="text-center text-red-500">Error: ${e.message}</p>`; fCont.innerHTML=`<p class="text-center text-red-500">Error filtros.</p>`; }
    }

     function renderConsolidatedClientsList() {
        const cont=document.getElementById('consolidated-clients-container'); const sI=document.getElementById('client-search-input'); const sF=document.getElementById('client-filter-sector'); if(!cont||!sI||!sF){ console.error("renderConsolidatedClientsList: Missing elements."); if(cont)cont.innerHTML=`<p class="text-center text-red-500">Error.</p>`; return; }
        const sT=sI.value.toLowerCase(); const sS=sF.value; _filteredClientsCache=_consolidatedClientsCache.filter(cli=>{ const sM=!sT||(cli.nombreComercial&&cli.nombreComercial.toLowerCase().includes(sT))||(cli.nombrePersonal&&cli.nombrePersonal.toLowerCase().includes(sT))||(cli.codigoCEP&&cli.codigoCEP.toLowerCase().includes(sT)); const secM=!sS||cli.sector===sS; return sM&&secM; });
        if(_filteredClientsCache.length===0){ cont.innerHTML=`<p class="text-center text-gray-500">No se encontraron clientes.</p>`; return; }
        let tH=`<table class="min-w-full bg-white text-sm"><thead class="bg-gray-200 sticky top-0 z-10"><tr><th class="py-2 px-3 border-b text-left">Sector</th><th class="py-2 px-3 border-b text-left">N. Comercial</th><th class="py-2 px-3 border-b text-left">N. Personal</th><th class="py-2 px-3 border-b text-left">Teléfono</th><th class="py-2 px-3 border-b text-left">CEP</th><th class="py-2 px-3 border-b text-left">Coords.</th></tr></thead><tbody>`;
        _filteredClientsCache.sort((a,b)=>(a.nombreComercial||'').localeCompare(b.nombreComercial||'')).forEach(c=>{ tH+=`<tr class="hover:bg-gray-50"><td class="py-2 px-3 border-b">${c.sector||'N/A'}</td><td class="py-2 px-3 border-b font-semibold">${c.nombreComercial||'N/A'}</td><td class="py-2 px-3 border-b">${c.nombrePersonal||'N/A'}</td><td class="py-2 px-3 border-b">${c.telefono||'N/A'}</td><td class="py-2 px-3 border-b">${c.codigoCEP||'N/A'}</td><td class="py-2 px-3 border-b text-xs">${c.coordenadas||'N/A'}</td></tr>`; }); tH+='</tbody></table>'; cont.innerHTML=tH;
    }

     function handleDownloadFilteredClients() {
         if(typeof XLSX==='undefined'){_showModal('Error','Librería XLSX no cargada.');return;} if(!Array.isArray(_filteredClientsCache)||_filteredClientsCache.length===0){_showModal('Aviso','No hay clientes para descargar.');return;}
        try { _filteredClientsCache.sort((a,b)=>(a.nombreComercial||'').localeCompare(b.nombreComercial||'')); const dTE=_filteredClientsCache.map(c=>({'Sector':c.sector||'','Nombre Comercial':c.nombreComercial||'','Nombre Personal':c.nombrePersonal||'','Telefono':c.telefono||'','CEP':c.codigoCEP||'','Coordenadas':c.coordenadas||''}));
            const ws=XLSX.utils.json_to_sheet(dTE); ws['!cols']=[{wch:15},{wch:30},{wch:30},{wch:15},{wch:10},{wch:20}]; const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Clientes Consolidados'); const tod=new Date().toISOString().slice(0,10); XLSX.writeFile(wb,`Clientes_Consolidados_${tod}.xlsx`);
        } catch(e){ console.error("Error generating Excel for clients:",e); _showModal('Error Exportación',`No se pudo generar Excel: ${e.message}`); }
    }

    function showClientMapView() {
        if (mapInstance) { try{mapInstance.remove();}catch(e){console.warn("Error removing map:",e);} mapInstance=null; mapMarkers.clear(); } if(_floatingControls)_floatingControls.classList.add('hidden');
        _mainContent.innerHTML = `<div class="p-4 pt-8"><div class="container mx-auto"><div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl"><h1 class="text-3xl font-bold text-gray-800 mb-4 text-center">Mapa Clientes</h1><div class="relative mb-4"><input type="text" id="map-search-input" placeholder="Buscar..." class="w-full px-4 py-2 border rounded-lg"><div id="map-search-results" class="absolute z-[1000] w-full bg-white border rounded-lg mt-1 max-h-60 overflow-y-auto hidden shadow-lg"></div></div><div class="mb-4 p-2 bg-gray-100 border rounded-lg text-sm flex flex-wrap justify-center items-center gap-4"><span><img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png" alt="Rojo" style="height:25px;display:inline;vertical-align:middle;"> Regular</span><span><img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png" alt="Azul" style="height:25px;display:inline;vertical-align:middle;"> con CEP</span></div><div id="client-map" class="w-full rounded-lg shadow-inner bg-gray-200" style="height:65vh; border:1px solid #ccc;"><p class="text-center text-gray-500 pt-10">Cargando...</p></div><button id="backToDataMenuBtn" class="mt-6 w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver</button></div></div></div>`;
        document.getElementById('backToDataMenuBtn').addEventListener('click', showDataView); loadAndDisplayMap();
    }

     async function loadAndDisplayMap() {
        const mC=document.getElementById('client-map'); if(!mC)return; if(typeof L==='undefined'){_showModal('Error','Librería Leaflet no disponible.'); mC.innerHTML='<p class="text-center text-red-500 pt-10">Error librería mapas.</p>'; return;} mC.innerHTML='<p class="text-center text-gray-500 pt-10">Cargando clientes...</p>';
        try { if(_consolidatedClientsCache.length===0){ const cR=_collection(_db,`artifacts/ventas-9a210/public/data/clientes`); const allCS=await _getDocs(cR); _consolidatedClientsCache=allCS.docs.map(doc=>({id:doc.id,...doc.data()})); } const allC=_consolidatedClientsCache;
            const cWC=allC.filter(c=>{ if(!c.coordenadas||typeof c.coordenadas!=='string')return false; const p=c.coordenadas.split(',').map(p=>parseFloat(p.trim())); return p.length===2&&!isNaN(p[0])&&!isNaN(p[1])&&p[0]>=-90&&p[0]<=90&&p[1]>=-180&&p[1]<=180; });
            if(cWC.length===0){ mC.innerHTML='<p class="text-center text-gray-500 pt-10">No hay clientes con coordenadas.</p>'; return; } mC.innerHTML='';
             if(!mapInstance){ try{ mapInstance=L.map('client-map').setView([7.7639,-72.2250],13); L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',maxZoom:19}).addTo(mapInstance); } catch(mapE){ console.error("Error initializing map:",mapE); mC.innerHTML=`<p class="text-center text-red-500 pt-10">Error mapa: ${mapE.message}</p>`; return; } }
            const rI=new L.Icon({iconUrl:'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',shadowUrl:'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',iconSize:[25,41],iconAnchor:[12,41],popupAnchor:[1,-34],shadowSize:[41,41]}); const bI=new L.Icon({iconUrl:'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',shadowUrl:'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',iconSize:[25,41],iconAnchor:[12,41],popupAnchor:[1,-34],shadowSize:[41,41]}); mapMarkers.clear(); const mG=[];
            cWC.forEach(cli=>{ const coo=cli.coordenadas.split(',').map(p=>parseFloat(p.trim())); const hC=cli.codigoCEP&&cli.codigoCEP.toLowerCase()!=='n/a'; const ico=hC?bI:rI; const pop=`<b>${cli.nombreComercial||'N/A'}</b><br>${cli.nombrePersonal||''}<br>Tel: ${cli.telefono||'N/A'}<br>Sector: ${cli.sector||'N/A'}${hC?`<br><b>CEP: ${cli.codigoCEP}</b>`:''}`; const mar=L.marker(coo,{icon:ico}).bindPopup(pop); const mK=cli.id||cli.nombreComercial; if(mK)mapMarkers.set(mK,mar); else console.warn("Client missing ID/Name for marker:",cli); mG.push(mar); });
             if(mG.length>0){ const fG=L.featureGroup(mG).addTo(mapInstance); mapInstance.fitBounds(fG.getBounds().pad(0.1)); } else{ mapInstance.setView([7.7639,-72.2250],13); }
            setupMapSearch(cWC);
        } catch(e){ console.error("Error loading map:",e); mC.innerHTML=`<p class="text-center text-red-500 pt-10">Error cargando datos.</p>`; _showModal('Error Mapa',`No se pudieron cargar datos: ${e.message}`); }
    }

     function setupMapSearch(clients) {
        const sI=document.getElementById('map-search-input'); const rC=document.getElementById('map-search-results'); if(!sI||!rC)return;
        sI.addEventListener('input',()=>{ const sT=sI.value.toLowerCase().trim(); if(sT.length<2){ rC.innerHTML=''; rC.classList.add('hidden'); return; }
            const fC=clients.filter(cli=>(cli.nombreComercial&&cli.nombreComercial.toLowerCase().includes(sT))||(cli.nombrePersonal&&cli.nombrePersonal.toLowerCase().includes(sT))||(cli.codigoCEP&&cli.codigoCEP.toLowerCase().includes(sT))).slice(0,10);
            if(fC.length===0){ rC.innerHTML='<div class="p-2 text-gray-500">No encontrado.</div>'; rC.classList.remove('hidden'); return; }
            rC.innerHTML=fC.map(cli=>{ const cK=cli.id||cli.nombreComercial; return cK?`<div class="p-2 hover:bg-gray-100 cursor-pointer border-b last:border-b-0" data-client-key="${cK}"><p class="font-semibold text-sm">${cli.nombreComercial}</p><p class="text-xs text-gray-600">${cli.nombrePersonal||''} ${cli.codigoCEP&&cli.codigoCEP!=='N/A'?`(CEP: ${cli.codigoCEP})`:''}</p></div>`:''; }).join(''); rC.classList.remove('hidden');
        });
        rC.addEventListener('click',(e)=>{ const tar=e.target.closest('[data-client-key]'); if(tar&&mapInstance){ const cK=tar.dataset.clientKey; const mar=mapMarkers.get(cK); if(mar){ mapInstance.flyTo(mar.getLatLng(),17); mar.openPopup(); } else{ console.warn(`Marker not found: ${cK}`); _showModal('Aviso','Marcador no encontrado.'); } sI.value=''; rC.innerHTML=''; rC.classList.add('hidden'); } });
        document.addEventListener('click',function(ev){ if(rC&&sI&&!rC.contains(ev.target)&&ev.target!==sI)rC.classList.add('hidden'); });
    }

    function showDataManagementView() {
        if (_floatingControls) _floatingControls.classList.add('hidden');
        _mainContent.innerHTML = `
            <div class="p-4 pt-8"><div class="container mx-auto max-w-2xl"><div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl"><h1 class="text-3xl font-bold text-gray-800 mb-6 text-center">Limpieza y Gestión</h1><div class="space-y-6"><div class="p-4 border rounded-lg bg-red-50 border-red-200"><h2 class="text-xl font-semibold text-red-800 mb-2">Ventas (Cierres)</h2><p class="text-sm text-red-700 mb-4">Exporta TODOS los cierres (públicos y admin) y los ELIMINA permanentemente.</p><button id="deleteExportSalesBtn" class="w-full px-6 py-3 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700">Borrar y Exportar Ventas</button></div><div class="p-4 border rounded-lg bg-yellow-50 border-yellow-200"><h2 class="text-xl font-semibold text-yellow-800 mb-2">Inventario</h2><p class="text-sm text-yellow-700 mb-4"><strong>Borrar/Exportar:</strong> Exporta inventario maestro admin (incl. categorías) y ELIMINA estos datos de TODOS los usuarios.</p><button id="deleteExportInventoryBtn" class="w-full px-6 py-3 bg-yellow-600 text-white font-semibold rounded-lg shadow-md hover:bg-yellow-700 mb-4">Borrar y Exportar Inventario</button><hr class="my-4 border-yellow-300"><p class="text-sm text-yellow-700 mb-2"><strong>Importar:</strong> Importa inventario desde Excel y lo distribuye a TODOS, SOBREESCRIBIENDO estructura pero conservando cantidades.</p><input type="file" id="inventory-file-input" accept=".xlsx, .xls" class="w-full p-2 border border-yellow-400 rounded-lg mb-2"><button id="importInventoryBtn" class="w-full px-6 py-3 bg-yellow-500 text-gray-900 font-semibold rounded-lg shadow-md hover:bg-yellow-600">Importar Inventario Excel</button></div></div><button id="backToDataMenuBtn" class="mt-8 w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver</button></div></div></div>`;
        document.getElementById('backToDataMenuBtn').addEventListener('click', showDataView);
        document.getElementById('deleteExportSalesBtn').addEventListener('click', handleDeleteAndExportSales);
        document.getElementById('deleteExportInventoryBtn').addEventListener('click', handleDeleteAndExportInventory);
        document.getElementById('importInventoryBtn').addEventListener('click', handleImportInventory);
    }

    async function getAllUserIds(excludeAdmin = false) {
        try { const uR=_collection(_db,"users"); const sn=await _getDocs(uR); let uIds=sn.docs.map(doc=>doc.id); if(excludeAdmin)uIds=uIds.filter(id=>id!==_userId); return uIds; }
        catch(e){ console.error("Error getting user IDs:",e); _showModal('Error Interno','No se pudo obtener lista usuarios.'); return[]; }
    }

    async function exportClosingsToExcel(publicClosings, adminClosings) {
         if(typeof XLSX==='undefined')throw new Error('Librería XLSX no cargada.'); const wb=XLSX.utils.book_new();
         if(publicClosings?.length>0){ const pD=publicClosings.map(c=>{ const fC=c.fecha?.toDate?c.fecha.toDate():null; return{'Fecha':fC?fC.toISOString().slice(0,10):'Inválida','Vendedor_Email':c.vendedorInfo?.email||'N/A','Vendedor_Nombre':`${c.vendedorInfo?.nombre||''} ${c.vendedorInfo?.apellido||''}`.trim()||'N/A','Camion':c.vendedorInfo?.camion||'N/A','Total':c.total||0,'ID_Cierre':c.id||'N/A','Datos_Ventas':JSON.stringify(c.ventas||[])}; }); const wsP=XLSX.utils.json_to_sheet(pD); XLSX.utils.book_append_sheet(wb,wsP,'Cierres_Publicos'); }
         else{ const wsP=XLSX.utils.aoa_to_sheet([["No hay cierres públicos."]]); XLSX.utils.book_append_sheet(wb,wsP,'Cierres_Publicos'); }
         if(adminClosings?.length>0){ const aD=adminClosings.map(c=>{ const fC=c.fecha?.toDate?c.fecha.toDate():null; return{'Fecha':fC?fC.toISOString().slice(0,10):'Inválida','Total':c.total||0,'ID_Cierre':c.id||'N/A','Datos_Ventas':JSON.stringify(c.ventas||[])}; }); const wsA=XLSX.utils.json_to_sheet(aD); XLSX.utils.book_append_sheet(wb,wsA,'Cierres_Admin'); }
         else{ const wsA=XLSX.utils.aoa_to_sheet([["No hay cierres admin."]]); XLSX.utils.book_append_sheet(wb,wsA,'Cierres_Admin'); }
        const tod=new Date().toISOString().slice(0,10); XLSX.writeFile(wb,`Exportacion_Cierres_${tod}.xlsx`);
    }

    async function handleDeleteAndExportSales() {
        _showModal('Confirmar Borrado Ventas',`<p class="text-red-600 font-bold">¡ADVERTENCIA!</p><p>Exporta TODOS los cierres (públicos y admin) y los ELIMINA permanentemente.</p><p class="mt-2">NO SE PUEDE DESHACER.</p><p class="mt-4 font-bold">¿Seguro?</p>`,
            async()=>{ _showModal('Progreso','Exportando y eliminando...'); let exp=false; try{ const pCR=_collection(_db,`public_data/${_appId}/user_closings`); const pS=await _getDocs(pCR); const pC=pS.docs.map(doc=>({id:doc.id,...doc.data()})); const aCR=_collection(_db,`artifacts/${_appId}/users/${_userId}/cierres`); const aS=await _getDocs(aCR); const aC=aS.docs.map(doc=>({id:doc.id,...doc.data()}));
            if(pC.length>0||aC.length>0){ await exportClosingsToExcel(pC,aC); exp=true; } else{ _showModal('Aviso','No hay datos para exportar/eliminar.'); return false; } _showModal('Progreso','Datos exportados. Eliminando...');
            if(!pS.empty){ const bP=_writeBatch(_db); pS.docs.forEach(doc=>bP.delete(doc.ref)); await bP.commit(); } if(!aS.empty){ const bA=_writeBatch(_db); aS.docs.forEach(doc=>bA.delete(doc.ref)); await bA.commit(); }
            _showModal('Éxito','Datos de ventas exportados y eliminados.'); return true; } catch(e){ console.error("Error borrando/exportando ventas:",e); const actF=exp?"eliminación":"exportación/eliminación"; _showModal('Error',`Error durante ${actF}: ${e.message}`); return false; } },'Sí, Borrar Todo',null,true);
    }

    async function exportInventoryToExcel() {
        if(typeof XLSX==='undefined')throw new Error('Librería XLSX no cargada.'); const wb=XLSX.utils.book_new(); const cols=['inventario','rubros','segmentos','marcas']; let dF=false;
        for(const cN of cols){ const path=`artifacts/${_appId}/users/${_userId}/${cN}`; try{ const sn=await _getDocs(_collection(_db,path)); if(!sn.empty){ dF=true; const data=sn.docs.map(doc=>({firestore_id:doc.id,...doc.data()})); const ws=XLSX.utils.json_to_sheet(data); XLSX.utils.book_append_sheet(wb,ws,cN); } else{ const ws=XLSX.utils.aoa_to_sheet([[`No hay datos en ${cN}`]]); XLSX.utils.book_append_sheet(wb,ws,cN); } } catch(rE){ console.error(`Error leyendo ${cN}:`,rE); const ws=XLSX.utils.aoa_to_sheet([[`Error al leer ${cN}: ${rE.message}`]]); XLSX.utils.book_append_sheet(wb,ws,cN); } }
        if(!dF){ _showModal('Aviso','No se encontraron datos de inventario admin.'); return false; } const tod=new Date().toISOString().slice(0,10); XLSX.writeFile(wb,`Exportacion_Inventario_Maestro_${tod}.xlsx`); return true;
    }

    async function handleDeleteAndExportInventory() {
         _showModal('Confirmar Borrado Inventario',`<p class="text-red-600 font-bold">¡ADVERTENCIA MAYOR!</p><p>Exporta inventario maestro admin (incl. categorías).</p><p class="mt-2">Luego ELIMINA permanentemente estos datos de <strong>TODOS los usuarios</strong>.</p><p class="mt-2">NO SE PUEDE DESHACER.</p><p class="mt-4 font-bold">¿Seguro?</p>`,
            async()=>{ _showModal('Progreso','Exportando inventario...'); let exp=false; try{ exp=await exportInventoryToExcel(); if(!exp)return false; _showModal('Progreso','Inventario exportado. Obteniendo usuarios...'); const allUIds=await getAllUserIds(); if(allUIds.length===0){ _showModal('Advertencia','Exportado, pero no hay otros usuarios.'); return true; }
            _showModal('Progreso',`Eliminando datos para ${allUIds.length} usuario(s)...`); const cTD=['inventario','rubros','segmentos','marcas']; let dE=0; const MAX_OPS=490;
            for(const uIdDel of allUIds){ for(const cN of cTD){ const path=`artifacts/${_appId}/users/${uIdDel}/${cN}`; try{ const sn=await _getDocs(_collection(_db,path)); if(!sn.empty){ let batch=_writeBatch(_db); let ops=0; for(const doc of sn.docs){ batch.delete(doc.ref); ops++; if(ops>=MAX_OPS){await batch.commit();batch=_writeBatch(_db);ops=0;} } if(ops>0)await batch.commit(); } } catch(uDE){ console.error(`Error eliminando ${cN} para ${uIdDel}:`,uDE); dE++; } } }
            if(dE>0){ _showModal('Advertencia','Exportado. Eliminación completada con errores. Revisa consola.'); } else{ _showModal('Éxito','Inventario exportado y eliminado de todos.'); } return true; } catch(e){ console.error("Error borrando/exportando inventario:",e); const actF=exp?"eliminación":"exportación"; _showModal('Error',`Error durante ${actF}: ${e.message}`); return false; } },'Sí, Borrar Todo Inventario',null,true);
    }

    function handleInventoryFileSelect() {
        const fI=document.getElementById('inventory-file-input'); if(!fI){ _showModal('Error Interno','Input no encontrado.'); return null; } const file=fI.files?.[0]; if(!file){ _showModal('Error','Selecciona un archivo.'); return null; } return file;
    }

    async function mergeDataForUser(targetUserId, collectionName, sourceItems, fieldToPreserve) {
        if (!sourceItems || sourceItems.length === 0) { console.log(` - No hay ${collectionName} fuente para ${targetUserId}, omitiendo merge.`); return; }
        const targetPath = `artifacts/${_appId}/users/${targetUserId}/${collectionName}`;
        const targetRef = _collection(_db, targetPath);
        let targetMap = new Map();
        try { const targetSnapshot = await _getDocs(targetRef); targetMap = new Map(targetSnapshot.docs.map(doc => [doc.id, doc.data()])); }
        catch (readError) { console.warn(`No se pudo leer ${collectionName} existente para ${targetUserId}.`, readError); }
        let batch = _writeBatch(_db); let operations = 0; const MAX_OPS_PER_BATCH = 490;
        for (const item of sourceItems) {
            const itemId = item.id; if (!itemId) { console.warn("Item en fuente sin ID, omitiendo:", item); continue; }
            const { id, ...data } = item;
            const targetDocRef = _doc(_db, targetPath, itemId);
            let preservedValue = (fieldToPreserve === 'saldoVacios' ? {} : 0);
            if (targetMap.has(itemId)) { const existingData = targetMap.get(itemId); preservedValue = existingData?.[fieldToPreserve] ?? preservedValue; targetMap.delete(itemId); }
            data[fieldToPreserve] = preservedValue;
            batch.set(targetDocRef, data); operations++;
             if (operations >= MAX_OPS_PER_BATCH) { await batch.commit(); batch = _writeBatch(_db); operations = 0; }
        }
         const deleteOrphans = true;
         if (deleteOrphans && targetMap.size > 0) {
             console.log(` - Eliminando ${targetMap.size} items huérfanos de ${collectionName} para ${targetUserId}`);
             for (const orphanId of targetMap.keys()) {
                 batch.delete(_doc(_db, targetPath, orphanId)); operations++;
                 if (operations >= MAX_OPS_PER_BATCH) { await batch.commit(); batch = _writeBatch(_db); operations = 0; }
             }
         }
        if (operations > 0) await batch.commit();
         console.log(` - Merge de ${collectionName} completado para ${targetUserId}`);
    }

    async function copyDataToUser(targetUserId, collectionName, sourceItems) {
         const targetPath = `artifacts/${_appId}/users/${targetUserId}/${collectionName}`;
         const targetCollectionRef = _collection(_db, targetPath);
         console.log(` - Limpiando ${collectionName} anterior para ${targetUserId}...`);
         try { const oldSnapshot = await _getDocs(targetCollectionRef);
             if (!oldSnapshot.empty) { let deleteBatch = _writeBatch(_db); let deleteOps = 0; const MAX_OPS_PER_BATCH = 490;
                 oldSnapshot.docs.forEach(doc => { deleteBatch.delete(doc.ref); deleteOps++; if (deleteOps >= MAX_OPS_PER_BATCH) { await deleteBatch.commit(); deleteBatch = _writeBatch(_db); deleteOps = 0; } });
                  if(deleteOps > 0) await deleteBatch.commit(); console.log(`   - ${oldSnapshot.size} items eliminados de ${collectionName} para ${targetUserId}.`);
             }
         } catch (deleteError) { console.error(`Error limpiando ${collectionName} para ${targetUserId}:`, deleteError); throw new Error(`Fallo al limpiar ${collectionName}: ${deleteError.message}`); }
         if (!sourceItems || sourceItems.length === 0) { console.log(` - No hay ${collectionName} fuente para ${targetUserId}.`); return; }
         console.log(` - Copiando ${sourceItems.length} items de ${collectionName} a ${targetUserId}...`);
        let writeBatch = _writeBatch(_db); let writeOps = 0; const MAX_OPS_PER_BATCH = 490;
        sourceItems.forEach(item => {
             const itemId = item.id; const { id, ...data } = item;
             const targetDocRef = (itemId && typeof itemId === 'string' && itemId.trim() !== '') ? _doc(_db, targetPath, itemId) : _doc(targetCollectionRef);
             writeBatch.set(targetDocRef, data); writeOps++;
             if (writeOps >= MAX_OPS_PER_BATCH) { await writeBatch.commit(); writeBatch = _writeBatch(_db); writeOps = 0; }
        });
         if(writeOps > 0) await writeBatch.commit(); console.log(` - Copia de ${collectionName} completada para ${targetUserId}`);
    }

    async function handleImportInventory() {
        const file=handleInventoryFileSelect(); if(!file)return; if(typeof XLSX==='undefined'){ _showModal('Error','Librería XLSX no cargada.'); return; }
         _showModal('Confirmar Importación Inventario',`<p class="text-orange-600 font-bold">¡ATENCIÓN!</p><p>Distribuye inventario (incl. categorías) a <strong>TODOS los usuarios</strong>.</p><p class="mt-2">SOBRESCRIBE estructura, conserva cantidades.</p><p class="mt-4 font-bold">Asegúrate formato correcto (hojas: inventario, rubros, segmentos, marcas). ¿Continuar?</p>`,
            async()=>{ _showModal('Progreso','Leyendo Excel...'); const reader=new FileReader(); reader.onload=async(e)=>{ let iE=0; try{ const data=e.target.result; const wb=XLSX.read(data,{type:'array'}); const reqS=['inventario','rubros','segmentos','marcas']; const iD={}; let mS=[];
            reqS.forEach(sN=>{ if(wb.SheetNames.includes(sN)){const ws=wb.Sheets[sN];iD[sN]=XLSX.utils.sheet_to_json(ws);} else{if(sN==='inventario')mS.push(sN); else iD[sN]=[];}}); if(mS.length>0)throw new Error(`Falta hoja requerida 'inventario'.`); if(!iD.inventario||iD.inventario.length===0)console.warn("Hoja 'inventario' vacía.");
            _showModal('Progreso','Datos leídos. Obteniendo usuarios...'); const allUIds=await getAllUserIds(); if(allUIds.length===0){_showModal('Aviso','Datos leídos, no hay usuarios.');return false;} _showModal('Progreso',`Distribuyendo a ${allUIds.length} usuario(s)...`);
            for(const tId of allUIds){ try{ for(const cat of['rubros','segmentos','marcas']){ const iTC=(iD[cat]||[]).map(item=>{ const{firestore_id,...rest}=item; return{id:firestore_id,...rest}; }); await copyDataToUser(tId,cat,iTC); } if(iD.inventario.length>0){ const iTM=iD.inventario.map(item=>{ const{firestore_id,cantidadUnidades,...rest}=item; return{id:firestore_id,...rest}; }); await mergeDataForUser(tId,'inventario',iTM,'cantidadUnidades'); } } catch(uIE){ console.error(`Error importando para ${tId}:`,uIE); iE++; } }
            if(iE>0){ _showModal('Advertencia',`Importación completada con ${iE} error(es). Revisa consola.`); } else{ _showModal('Éxito','Inventario importado y distribuido.'); } showDataManagementView(); return true; } catch(e){ console.error("Error importando inventario:",e); _showModal('Error',`Error importación: ${e.message}`); const fI=document.getElementById('inventory-file-input'); if(fI)fI.value=''; return false; } }; reader.onerror=(e)=>{_showModal('Error','No se pudo leer archivo.');}; reader.readAsArrayBuffer(file); },'Sí, Importar y Distribuir',null,true);
    }

    window.dataModule = {
        showClosingDetail,
        handleDownloadSingleClosing
    };
})();
