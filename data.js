// --- Lógica del módulo de Data (solo para Admins) ---

(function() {
    // Variables locales del módulo
    let _db, _appId, _userId, _mainContent, _floatingControls, _showMainMenu, _showModal;
    let _collection, _getDocs, _query, _where, _orderBy, _populateDropdown;

    let _lastStatsData = [];
    let _lastNumWeeks = 1;
    let _consolidatedClientsCache = [];
    let _filteredClientsCache = [];

    // Variables para el mapa
    let mapInstance = null;
    let mapMarkers = new Map();

    window.initData = function(dependencies) {
        _db = dependencies.db;
        _appId = dependencies.appId;
        _userId = dependencies.userId; // Admin ID
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

    window.showDataView = function() {
        if (mapInstance) {
            mapInstance.remove(); mapInstance = null;
        }
        _floatingControls.classList.add('hidden');
        _mainContent.innerHTML = `
            <div class="p-4 pt-8"> <div class="container mx-auto"> <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl text-center">
                <h1 class="text-3xl font-bold text-gray-800 mb-6">Módulo de Datos</h1>
                <div class="space-y-4">
                    <button id="closingDataBtn" class="w-full px-6 py-3 bg-indigo-600 text-white rounded-lg shadow-md hover:bg-indigo-700">Cierres de Ventas</button>
                    <button id="productStatsBtn" class="w-full px-6 py-3 bg-teal-600 text-white rounded-lg shadow-md hover:bg-teal-700">Estadística Productos</button>
                    <button id="consolidatedClientsBtn" class="w-full px-6 py-3 bg-green-600 text-white rounded-lg shadow-md hover:bg-green-700">Clientes Consolidados</button>
                    <button id="clientMapBtn" class="w-full px-6 py-3 bg-cyan-600 text-white rounded-lg shadow-md hover:bg-cyan-700">Mapa de Clientes</button>
                    <button id="backToMenuBtn" class="w-full px-6 py-3 bg-gray-400 text-white rounded-lg shadow-md hover:bg-gray-500">Volver Menú</button>
                </div>
            </div> </div> </div>
        `;
        document.getElementById('closingDataBtn').addEventListener('click', showClosingDataView);
        document.getElementById('productStatsBtn').addEventListener('click', showProductStatsView);
        document.getElementById('consolidatedClientsBtn').addEventListener('click', showConsolidatedClientsView);
        document.getElementById('clientMapBtn').addEventListener('click', showClientMapView);
        document.getElementById('backToMenuBtn').addEventListener('click', _showMainMenu);
    };

    async function showClosingDataView() {
        _mainContent.innerHTML = `
            <div class="p-4 pt-8"> <div class="container mx-auto"> <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl">
                <h1 class="text-3xl font-bold text-gray-800 mb-6 text-center">Cierres de Vendedores</h1>
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 p-4 border rounded-lg items-end">
                    <div> <label for="userFilter" class="block text-sm font-medium">Vendedor:</label> <select id="userFilter" class="mt-1 block w-full px-3 py-2 border rounded-md shadow-sm text-sm"> <option value="">Todos</option> </select> </div>
                    <div> <label for="fechaDesde" class="block text-sm font-medium">Desde:</label> <input type="date" id="fechaDesde" class="mt-1 block w-full px-3 py-2 border rounded-md shadow-sm text-sm"> </div>
                    <div> <label for="fechaHasta" class="block text-sm font-medium">Hasta:</label> <input type="date" id="fechaHasta" class="mt-1 block w-full px-3 py-2 border rounded-md shadow-sm text-sm"> </div>
                    <button id="searchCierresBtn" class="w-full px-6 py-2 bg-indigo-600 text-white rounded-lg shadow-md hover:bg-indigo-700">Buscar</button>
                </div>
                <div id="cierres-list-container" class="overflow-x-auto max-h-96"> <p class="text-center text-gray-500">Seleccione filtros.</p> </div>
                <button id="backToDataMenuBtn" class="mt-6 w-full px-6 py-3 bg-gray-400 text-white rounded-lg shadow-md hover:bg-gray-500">Volver</button>
            </div> </div> </div>
        `;
        document.getElementById('backToDataMenuBtn').addEventListener('click', showDataView);
        document.getElementById('searchCierresBtn').addEventListener('click', handleSearchClosings);
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('fechaDesde').value = today; document.getElementById('fechaHasta').value = today;
        await populateUserFilter();
    };

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
        } catch (error) { console.error("Error cargando usuarios filtro:", error); }
    }

    async function handleSearchClosings() {
        const container = document.getElementById('cierres-list-container');
        container.innerHTML = `<p class="text-center text-gray-500">Buscando...</p>`;
        const selectedUserId = document.getElementById('userFilter').value;
        const fechaDesdeStr = document.getElementById('fechaDesde').value;
        const fechaHastaStr = document.getElementById('fechaHasta').value;
        if (!fechaDesdeStr || !fechaHastaStr) {
            _showModal('Error', 'Seleccione ambas fechas.');
            container.innerHTML = `<p class="text-center text-gray-500">Seleccione rango.</p>`; return;
        }
        const fechaDesde = new Date(fechaDesdeStr + 'T00:00:00Z');
        const fechaHasta = new Date(fechaHastaStr + 'T23:59:59Z');
        try {
            const closingsRef = _collection(_db, `public_data/${_appId}/user_closings`);
            let q = _query(closingsRef, _where("fecha", ">=", fechaDesde), _where("fecha", "<=", fechaHasta));
            const snapshot = await _getDocs(q);
            let closings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            if (selectedUserId) {
                closings = closings.filter(c => c.vendedorInfo && c.vendedorInfo.userId === selectedUserId);
            }
            window.tempClosingsData = closings; // Store for modal access
            renderClosingsList(closings);
        } catch (error) {
            console.error("Error buscando cierres:", error);
            container.innerHTML = `<p class="text-center text-red-500">Error al buscar.</p>`;
        }
    }

    function renderClosingsList(closings) {
        const container = document.getElementById('cierres-list-container');
        if (closings.length === 0) {
            container.innerHTML = `<p class="text-center text-gray-500">No se encontraron cierres.</p>`; return;
        }
        closings.sort((a, b) => b.fecha.toDate() - a.fecha.toDate()); // Sort descending
        let tableHTML = `
            <table class="min-w-full bg-white text-sm">
                <thead class="bg-gray-200 sticky top-0 z-10"> <tr>
                    <th class="py-2 px-3 border-b text-left">Fecha</th> <th class="py-2 px-3 border-b text-left">Vendedor</th>
                    <th class="py-2 px-3 border-b text-left">Camión</th> <th class="py-2 px-3 border-b text-right">Total</th>
                    <th class="py-2 px-3 border-b text-center">Acciones</th>
                </tr> </thead> <tbody>`;
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
                        <button onclick="window.dataModule.handleDownloadSingleClosing('${cierre.id}')" title="Descargar" class="p-1.5 bg-green-500 text-white text-xs rounded-lg hover:bg-green-600 align-middle"> <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"> <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /> </svg> </button>
                    </td>
                </tr> `;
        });
        tableHTML += '</tbody></table>';
        container.innerHTML = tableHTML;
    }

    // --- Lógica de Reporte (adaptada para usar ordenamiento global) ---
    async function processSalesDataForReport(ventas, userIdForInventario) {
        // Funciones locales getRubroOrderMapLocal/getSegmentoOrderMapLocal eliminadas

        const clientData = {};
        let grandTotalValue = 0;
        const allProductsMap = new Map();
        const vaciosMovementsPorTipo = {};
        // Asume TIPOS_VACIO_GLOBAL existe globalmente o se define aquí
        const TIPOS_VACIO_GLOBAL = window.TIPOS_VACIO_GLOBAL || ["1/4 - 1/3", "ret 350 ml", "ret 1.25 Lts"];

        // Usa el inventario del VENDEDOR específico (userIdForInventario)
        const inventarioRef = _collection(_db, `artifacts/${_appId}/users/${userIdForInventario}/inventario`);
        const inventarioSnapshot = await _getDocs(inventarioRef);
        const inventarioMap = new Map(inventarioSnapshot.docs.map(doc => [doc.id, doc.data()]));

        ventas.forEach(venta => {
            const clientName = venta.clienteNombre || 'Cliente Desconocido';
            if (!clientData[clientName]) clientData[clientName] = { products: {}, totalValue: 0 };
            if (!vaciosMovementsPorTipo[clientName]) { vaciosMovementsPorTipo[clientName] = {}; TIPOS_VACIO_GLOBAL.forEach(tipo => vaciosMovementsPorTipo[clientName][tipo] = { entregados: 0, devueltos: 0 }); }
            clientData[clientName].totalValue += (venta.total || 0);
            grandTotalValue += (venta.total || 0);
            const vaciosDev = venta.vaciosDevueltosPorTipo || {};
            for (const tipo in vaciosDev) { if (!vaciosMovementsPorTipo[clientName][tipo]) vaciosMovementsPorTipo[clientName][tipo] = { e: 0, d: 0 }; vaciosMovementsPorTipo[clientName][tipo].devueltos += (vaciosDev[tipo] || 0); }
            (venta.productos || []).forEach(p => {
                 const prodComp = inventarioMap.get(p.id) || p;
                 if (prodComp.manejaVacios && prodComp.tipoVacio) { const tipoV = prodComp.tipoVacio; if (!vaciosMovementsPorTipo[clientName][tipoV]) vaciosMovementsPorTipo[clientName][tipoV] = { e: 0, d: 0 }; vaciosMovementsPorTipo[clientName][tipoV].entregados += p.cantidadVendida?.cj || 0; }
                 const rubro = prodComp.rubro || 'Sin Rubro', seg = prodComp.segmento || 'Sin Segmento', marca = prodComp.marca || 'Sin Marca';
                 if (!allProductsMap.has(p.id)) allProductsMap.set(p.id, { ...prodComp, id: p.id, rubro: rubro, segmento: seg, marca: marca, presentacion: p.presentacion });
                 if (!clientData[clientName].products[p.id]) clientData[clientName].products[p.id] = 0;
                 clientData[clientName].products[p.id] += (p.totalUnidadesVendidas || 0);
            });
        });

        const sortedClients = Object.keys(clientData).sort();

        // --- USA ORDEN GLOBAL ---
        const sortFunction = await window.getGlobalProductSortFunction();
        const finalProductOrder = Array.from(allProductsMap.values()).sort(sortFunction);
        // --- FIN ---

        return { clientData, grandTotalValue, sortedClients, finalProductOrder, vaciosMovementsPorTipo };
    }

    // MODIFICADO: Usa cabecera simplificada
    async function showClosingDetail(closingId) {
        const closingData = window.tempClosingsData?.find(c => c.id === closingId);
        if (!closingData) { _showModal('Error', 'No se cargaron detalles.'); return; }
        _showModal('Progreso', 'Generando reporte detallado...');
        try {
            const { clientData, grandTotalValue, sortedClients, finalProductOrder, vaciosMovementsPorTipo } = await processSalesDataForReport(closingData.ventas, closingData.vendedorInfo.userId);

            // Cabecera simplificada
            let headerHTML = `<tr class="sticky top-0 z-20 bg-gray-200"> <th class="p-1 border sticky left-0 z-30 bg-gray-200">Cliente</th>`;
            finalProductOrder.forEach(p => { headerHTML += `<th class="p-1 border whitespace-nowrap text-xs" title="${p.marca||''} - ${p.segmento||''}">${p.presentacion}</th>`; });
            headerHTML += `<th class="p-1 border sticky right-0 z-30 bg-gray-200">Total Cliente</th></tr>`;

            // Filas de datos (siguen finalProductOrder)
            let bodyHTML = ''; sortedClients.forEach(cli => { bodyHTML += `<tr class="hover:bg-blue-50"><td class="p-1 border font-medium bg-white sticky left-0 z-10">${cli}</td>`; const cCli = clientData[cli]; finalProductOrder.forEach(p => { const qU=cCli.products[p.id]||0; let dQ=''; if(qU>0){dQ=`${qU} Unds`; const vP=p.ventaPor||{}, uCj=p.unidadesPorCaja||1, uPaq=p.unidadesPorPaquete||1; if(vP.cj&&!vP.paq&&!vP.und&&uCj>0&&Number.isInteger(qU/uCj))dQ=`${qU/uCj} Cj`; else if(vP.paq&&!vP.cj&&!vP.und&&uPaq>0&&Number.isInteger(qU/uPaq))dQ=`${qU/uPaq} Paq`;} bodyHTML+=`<td class="p-1 border text-center">${dQ}</td>`; }); bodyHTML+=`<td class="p-1 border text-right font-semibold bg-white sticky right-0 z-10">$${cCli.totalValue.toFixed(2)}</td></tr>`; });

            // Pie de tabla (sigue finalProductOrder)
            let footerHTML = '<tr class="bg-gray-200 font-bold"><td class="p-1 border sticky left-0 z-10">TOTALES</td>'; finalProductOrder.forEach(p => { let tQ=0; sortedClients.forEach(cli => tQ+=clientData[cli].products[p.id]||0); let dT=''; if(tQ>0){dT=`${tQ} Unds`; const vP=p.ventaPor||{}, uCj=p.unidadesPorCaja||1, uPaq=p.unidadesPorPaquete||1; if(vP.cj&&!vP.paq&&!vP.und&&uCj>0&&Number.isInteger(tQ/uCj))dT=`${tQ/uCj} Cj`; else if(vP.paq&&!vP.cj&&!vP.und&&uPaq>0&&Number.isInteger(tQ/uPaq))dT=`${tQ/uPaq} Paq`;} footerHTML+=`<td class="p-1 border text-center">${dT}</td>`; }); footerHTML+=`<td class="p-1 border text-right sticky right-0 z-10">$${grandTotalValue.toFixed(2)}</td></tr>`;

            // Reporte de vacíos (sin cambios)
            let vaciosHTML = ''; const TIPOS_VACIO_GLOBAL = ["1/4 - 1/3", "ret 350 ml", "ret 1.25 Lts"]; const cliVacios=Object.keys(vaciosMovementsPorTipo).filter(cli=>TIPOS_VACIO_GLOBAL.some(t=>(vaciosMovementsPorTipo[cli][t]?.entregados||0)>0||(vaciosMovementsPorTipo[cli][t]?.devueltos||0)>0)).sort(); if(cliVacios.length>0){ vHTML=`<h3 class="text-xl my-6">Reporte Vacíos</h3><div class="overflow-auto border"><table><thead><tr><th>Cliente</th><th>Tipo</th><th>Entregados</th><th>Devueltos</th><th>Neto</th></tr></thead><tbody>`; cliVacios.forEach(cli=>{const movs=vaciosMovementsPorTipo[cli]; TIPOS_VACIO_GLOBAL.forEach(t=>{const mov=movs[t]||{e:0,d:0}; if(mov.entregados>0||mov.devueltos>0){const neto=mov.entregados-mov.devueltos; const nClass=neto>0?'text-red-600':(neto<0?'text-green-600':''); vHTML+=`<tr><td>${cli}</td><td>${t}</td><td>${mov.entregados}</td><td>${mov.devueltos}</td><td class="${nClass}">${neto>0?`+${neto}`:neto}</td></tr>`;}});}); vHTML+='</tbody></table></div>';}

            const vendedor = closingData.vendedorInfo || {};
            const reportHTML = `<div class="text-left max-h-[80vh] overflow-auto"> <div class="mb-4"> <p><strong>Vendedor:</strong> ${vendedor.nombre||''} ${vendedor.apellido||''}</p> <p><strong>Camión:</strong> ${vendedor.camion||'N/A'}</p> <p><strong>Fecha:</strong> ${closingData.fecha.toDate().toLocaleString('es-ES')}</p> </div> <h3 class="text-xl mb-4">Reporte Cierre</h3> <div class="overflow-auto border" style="max-height: 40vh;"> <table class="min-w-full bg-white text-xs"> <thead class="bg-gray-200">${headerHTML}</thead> <tbody>${bodyHTML}</tbody> <tfoot>${footerHTML}</tfoot> </table> </div> ${vaciosHTML} </div>`;
            _showModal(`Detalle Cierre`, reportHTML, null, 'Cerrar');
        } catch (error) { console.error("Error generando detalle:", error); _showModal('Error', `No se pudo generar: ${error.message}`); }
    }

    // MODIFICADO: Usa cabecera simplificada
    async function exportSingleClosingToExcel(closingData) {
        if (typeof XLSX === 'undefined') { _showModal('Error', 'Librería Excel no cargada.'); return; }
        try {
            const { clientData, grandTotalValue, sortedClients, finalProductOrder, vaciosMovementsPorTipo } = await processSalesDataForReport(closingData.ventas, closingData.vendedorInfo.userId);
            const dSheet1 = [];
            // Cabecera simple
            const hRow = ["Cliente"]; finalProductOrder.forEach(p => hRow.push(p.presentacion || 'N/A')); hRow.push("Total Cliente"); dSheet1.push(hRow);
            // Filas de datos
            sortedClients.forEach(cli => { const row=[cli]; const cCli=clientData[cli]; finalProductOrder.forEach(p=>{const qU=cCli.products[p.id]||0; let dQ=''; if(qU>0){dQ=`${qU} Unds`; const vP=p.ventaPor||{}, uCj=p.unidadesPorCaja||1, uPaq=p.unidadesPorPaquete||1; if(vP.cj&&!vP.paq&&!vP.und&&uCj>0&&Number.isInteger(qU/uCj))dQ=`${qU/uCj} Cj`; else if(vP.paq&&!vP.cj&&!vP.und&&uPaq>0&&Number.isInteger(qU/uPaq))dQ=`${qU/uPaq} Paq`;} row.push(dQ);}); row.push(Number(cCli.totalValue.toFixed(2))); dSheet1.push(row); });
            // Pie de tabla
            const fRow = ["TOTALES"]; finalProductOrder.forEach(p=>{let tQ=0; sortedClients.forEach(cli=>tQ+=clientData[cli].products[p.id]||0); let dT=''; if(tQ>0){dT=`${tQ} Unds`; const vP=p.ventaPor||{}, uCj=p.unidadesPorCaja||1, uPaq=p.unidadesPorPaquete||1; if(vP.cj&&!vP.paq&&!vP.und&&uCj>0&&Number.isInteger(tQ/uCj))dT=`${tQ/uCj} Cj`; else if(vP.paq&&!vP.cj&&!vP.und&&uPaq>0&&Number.isInteger(tQ/uPaq))dT=`${tQ/uPaq} Paq`;} fRow.push(dT);}); fRow.push(Number(grandTotalValue.toFixed(2))); dSheet1.push(fRow);
            const ws1 = XLSX.utils.aoa_to_sheet(dSheet1); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws1, 'Reporte Cierre');
            // Hoja de Vacíos (sin cambios)
            const TIPOS_VACIO_GLOBAL = ["1/4 - 1/3", "ret 350 ml", "ret 1.25 Lts"]; const cliVacios=Object.keys(vaciosMovementsPorTipo).filter(cli=>TIPOS_VACIO_GLOBAL.some(t=>(vaciosMovementsPorTipo[cli][t]?.entregados||0)>0||(vaciosMovementsPorTipo[cli][t]?.devueltos||0)>0)).sort(); if (cliVacios.length > 0) { const dSheet2=[['Cliente','Tipo Vacío','Entregados','Devueltos','Neto']]; cliVacios.forEach(cli=>{const movs=vaciosMovementsPorTipo[cli]; TIPOS_VACIO_GLOBAL.forEach(t=>{const mov=movs[t]||{e:0,d:0}; if(mov.entregados>0||mov.devueltos>0)dSheet2.push([cli,t,mov.entregados,mov.devueltos,mov.entregados-mov.devueltos]);});}); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dSheet2), 'Reporte Vacíos');}
            const vendedor = closingData.vendedorInfo || {}; const fecha = closingData.fecha.toDate().toISOString().slice(0, 10); const vendNombre = (vendedor.nombre || 'Vendedor').replace(/\s/g, '_');
            XLSX.writeFile(wb, `Cierre_${vendNombre}_${fecha}.xlsx`);
        } catch (error) { console.error("Error exportando:", error); _showModal('Error', `Error Excel: ${error.message}`); throw error; }
    }

    async function handleDownloadSingleClosing(closingId) {
        const closingData = window.tempClosingsData?.find(c => c.id === closingId);
        if (!closingData) { _showModal('Error', 'Datos no encontrados.'); return; }
        _showModal('Progreso', 'Generando Excel...');
        try {
            await exportSingleClosingToExcel(closingData);
             const modalContainer = document.getElementById('modalContainer');
             if(modalContainer && !modalContainer.classList.contains('hidden') && modalContainer.querySelector('h3')?.textContent.startsWith('Progreso')) { modalContainer.classList.add('hidden'); }
        } catch (error) { /* Error ya mostrado por exportSingleClosingToExcel */ }
    }

    // --- Lógica de Estadísticas (sin cambios) ---
    function showProductStatsView() {
        _mainContent.innerHTML = `
            <div class="p-4 pt-8"> <div class="container mx-auto"> <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl">
                <h1 class="text-3xl font-bold text-gray-800 mb-6 text-center">Estadística Productos</h1>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 border rounded-lg items-end">
                    <div> <label for="stats-type" class="block text-sm">Tipo:</label> <select id="stats-type" class="mt-1 block w-full px-3 py-2 border rounded-md"> <option value="semanal">Semanal</option> <option value="mensual">Mensual</option> <option value="general">General (Prom. Sem)</option> </select> </div>
                    <div> <label for="stats-rubro-filter" class="block text-sm">Rubro:</label> <select id="stats-rubro-filter" class="mt-1 block w-full px-3 py-2 border rounded-md"></select> </div>
                    <button id="searchStatsBtn" class="w-full px-6 py-2 bg-teal-600 text-white rounded-lg shadow-md hover:bg-teal-700">Mostrar</button>
                </div>
                <div id="stats-list-container" class="overflow-x-auto max-h-96"> <p class="text-center text-gray-500">Seleccione opciones.</p> </div>
                <button id="backToDataMenuBtn" class="mt-6 w-full px-6 py-3 bg-gray-400 text-white rounded-lg shadow-md hover:bg-gray-500">Volver</button>
            </div> </div> </div>
        `;
        const adminRubrosPath = `artifacts/${_appId}/users/${_userId}/rubros`; // Usar rubros del admin
        _populateDropdown(adminRubrosPath, 'stats-rubro-filter', 'Rubro');
        document.getElementById('backToDataMenuBtn').addEventListener('click', showDataView);
        document.getElementById('searchStatsBtn').addEventListener('click', handleSearchStats);
    }
    async function handleSearchStats() {
        const cont = document.getElementById('stats-list-container'); cont.innerHTML = `<p class="text-center text-gray-500">Calculando...</p>`;
        const sType = document.getElementById('stats-type').value; const rFilt = document.getElementById('stats-rubro-filter').value;
        if (!rFilt) { _showModal('Error', 'Seleccione rubro.'); cont.innerHTML = `<p class="text-center text-gray-500">Seleccione rubro.</p>`; return; }
        const now = new Date(); let fDesde; let fHasta = new Date();
        if (sType === 'semanal') { const dOW = now.getDay(); fDesde = new Date(now); const diff = now.getDate()-dOW+(dOW===0?-6:1); fDesde.setDate(diff); fDesde.setHours(0,0,0,0); }
        else if (sType === 'mensual') { fDesde = new Date(now.getFullYear(), now.getMonth(), 1); fDesde.setHours(0,0,0,0); }
        else { fDesde = new Date(0); } fHasta.setHours(23,59,59,999);
        try {
            const pubClosRef = _collection(_db, `public_data/${_appId}/user_closings`); const admClosRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/cierres`);
            const pubQ = _query(pubClosRef, _where("fecha",">=",fDesde), _where("fecha","<=",fHasta)); const admQ = _query(admClosRef, _where("fecha",">=",fDesde), _where("fecha","<=",fHasta));
            const [pubSnap, admSnap] = await Promise.all([_getDocs(pubQ), _getDocs(admQ)]);
            const allClosings = [...pubSnap.docs.map(d=>d.data()), ...admSnap.docs.map(d=>d.data())];
            if (allClosings.length === 0) { cont.innerHTML = `<p class="text-center text-gray-500">No hay datos.</p>`; _lastStatsData = []; return; }
            const pSales = {}; const admInvRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`); const invSnap = await _getDocs(admInvRef); const admInvMap = new Map(invSnap.docs.map(d=>[d.id, d.data()])); let earliestDate = new Date();
            allClosings.forEach(c => { const cDate = c.fecha?.toDate?c.fecha.toDate():new Date(0); if(cDate<earliestDate)earliestDate=cDate; (c.ventas||[]).forEach(v => { (v.productos||[]).forEach(p => { const admPInfo = admInvMap.get(p.id); if (admPInfo && admPInfo.rubro === rFilt) { if (!pSales[p.id]) pSales[p.id]={presentacion:admPInfo.presentacion, totalUnidades:0, ventaPor:admPInfo.ventaPor, unidadesPorCaja:admPInfo.unidadesPorCaja||1, unidadesPorPaquete:admPInfo.unidadesPorPaquete||1}; pSales[p.id].totalUnidades += (p.totalUnidadesVendidas||0); } }); }); });
            const pArray = Object.values(pSales); let nWeeks = 1;
            if (sType === 'general') { nWeeks = Math.max(1, Math.ceil(Math.abs((now - earliestDate) / (86400000 * 7)))); }
            _lastStatsData = pArray; _lastNumWeeks = nWeeks; renderStatsList(pArray, sType, nWeeks);
        } catch (error) { console.error("Error stats:", error); cont.innerHTML = `<p class="text-red-500">Error al calcular.</p>`; _lastStatsData = []; }
    }
    function renderStatsList(productArray, statsType, numWeeks = 1) {
        const cont = document.getElementById('stats-list-container'); if (productArray.length === 0) { cont.innerHTML = `<p class="text-center text-gray-500">No se encontraron ventas.</p>`; return; }
        const hTitle = statsType === 'general' ? 'Prom. Semanal' : 'Total Vendido';
        let tHTML = `<table class="min-w-full bg-white text-sm"> <thead class="bg-gray-200 sticky top-0 z-10"> <tr> <th class="py-2 px-3 border-b text-left">Producto</th> <th class="py-2 px-3 border-b text-center">${hTitle}</th> </tr> </thead> <tbody>`;
        productArray.sort((a,b)=>(a.presentacion||'').localeCompare(b.presentacion||''));
        productArray.forEach(p => { let dQty=0, dUnit='Unds'; const totPer = statsType==='general'?(p.totalUnidades/numWeeks):p.totalUnidades; if(p.ventaPor?.cj&&p.unidadesPorCaja>0){dQty=(totPer/p.unidadesPorCaja).toFixed(1); if(dQty.endsWith('.0'))dQty=dQty.slice(0,-2); dUnit='Cajas';} else if(p.ventaPor?.paq&&p.unidadesPorPaquete>0){dQty=(totPer/p.unidadesPorPaquete).toFixed(1); if(dQty.endsWith('.0'))dQty=dQty.slice(0,-2); dUnit='Paq.';} else {dQty=totPer.toFixed(0);} tHTML+=`<tr class="hover:bg-gray-50"><td class="py-2 px-3 border-b">${p.presentacion}</td><td class="py-2 px-3 border-b text-center font-bold">${dQty} <span class="font-normal text-xs">${dUnit}</span></td></tr>`; });
        tHTML += `</tbody></table>`; cont.innerHTML = `${tHTML}<div class="mt-6 text-center"><button id="downloadStatsBtn" class="px-6 py-2 bg-green-600 text-white rounded-lg shadow-md hover:bg-green-700">Descargar Excel</button></div>`;
        const dBt = document.getElementById('downloadStatsBtn'); if(dBt) dBt.addEventListener('click', handleDownloadStats);
    }
    function handleDownloadStats() {
        if (_lastStatsData.length === 0 || typeof XLSX === 'undefined') { _showModal('Aviso', _lastStatsData.length === 0 ? 'No hay datos.' : 'Librería Excel no cargada.'); return; }
        const sType = document.getElementById('stats-type').value; const hTitle = sType === 'general' ? 'Prom. Semanal' : 'Total Vendido';
        const dExport = _lastStatsData.map(p => { let dQty=0, dUnit='Unds'; const totPer=sType==='general'?(p.totalUnidades/_lastNumWeeks):p.totalUnidades; if(p.ventaPor?.cj&&p.unidadesPorCaja>0){dQty=(totPer/p.unidadesPorCaja).toFixed(1); if(dQty.endsWith('.0'))dQty=dQty.slice(0,-2); dUnit='Cajas';} else if(p.ventaPor?.paq&&p.unidadesPorPaquete>0){dQty=(totPer/p.unidadesPorPaquete).toFixed(1); if(dQty.endsWith('.0'))dQty=dQty.slice(0,-2); dUnit='Paq.';} else {dQty=totPer.toFixed(0);} return {'Producto': p.presentacion, [hTitle]: `${dQty} ${dUnit}`}; });
        const ws = XLSX.utils.json_to_sheet(dExport); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Estadisticas');
        const rubro = document.getElementById('stats-rubro-filter').value; const today = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(wb, `Estadisticas_${rubro}_${sType}_${today}.xlsx`);
    }

    // --- Lógica de Clientes Consolidados (sin cambios) ---
    async function showConsolidatedClientsView() {
        _mainContent.innerHTML = `
            <div class="p-4 pt-8"> <div class="container mx-auto"> <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl">
                <h1 class="text-3xl font-bold text-gray-800 mb-6 text-center">Clientes Consolidados</h1>
                <div id="consolidated-clients-filters"></div>
                <div id="consolidated-clients-container" class="overflow-x-auto max-h-96"> <p class="text-center text-gray-500">Cargando...</p> </div>
                <div class="mt-6 flex flex-col sm:flex-row gap-4"> <button id="backToDataMenuBtn" class="w-full px-6 py-3 bg-gray-400 text-white rounded-lg shadow-md hover:bg-gray-500">Volver</button> <button id="downloadClientsBtn" class="w-full px-6 py-3 bg-green-600 text-white rounded-lg shadow-md hover:bg-green-700 hidden">Descargar Lista</button> </div>
            </div> </div> </div>
        `;
        document.getElementById('backToDataMenuBtn').addEventListener('click', showDataView); document.getElementById('downloadClientsBtn').addEventListener('click', handleDownloadFilteredClients);
        await loadAndRenderConsolidatedClients();
    }
    async function loadAndRenderConsolidatedClients() {
        const cont = document.getElementById('consolidated-clients-container'), filtCont = document.getElementById('consolidated-clients-filters'); if(!cont || !filtCont) return;
        try {
            const cliRef = _collection(_db, `artifacts/ventas-9a210/public/data/clientes`); const cliSnaps = await _getDocs(cliRef);
            _consolidatedClientsCache = cliSnaps.docs.map(d => ({id: d.id, ...d.data()}));
            filtCont.innerHTML = `<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 border rounded-lg bg-gray-50"> <input type="text" id="client-search-input" placeholder="Buscar..." class="md:col-span-2 w-full px-4 py-2 border rounded-lg text-sm"> <div> <label for="client-filter-sector" class="block text-xs mb-1">Sector</label> <select id="client-filter-sector" class="w-full px-2 py-1 border rounded-lg text-sm"><option value="">Todos</option></select> </div> <button id="clear-client-filters-btn" class="bg-gray-300 text-xs rounded-lg self-end py-1.5 px-3 hover:bg-gray-400 mt-3 md:mt-0">Limpiar</button> </div>`;
            const uSectors = [...new Set(_consolidatedClientsCache.map(c => c.sector).filter(Boolean))].sort(); const sFilt = document.getElementById('client-filter-sector'); uSectors.forEach(s => { const o=document.createElement('option'); o.value=s; o.textContent=s; sFilt.appendChild(o); });
            document.getElementById('client-search-input').addEventListener('input', renderConsolidatedClientsList); sFilt.addEventListener('change', renderConsolidatedClientsList); document.getElementById('clear-client-filters-btn').addEventListener('click', () => { document.getElementById('client-search-input').value = ''; sFilt.value = ''; renderConsolidatedClientsList(); });
            renderConsolidatedClientsList(); document.getElementById('downloadClientsBtn').classList.remove('hidden');
        } catch (error) { console.error("Error clientes consolidados:", error); cont.innerHTML = `<p class="text-red-500">Error al cargar.</p>`; }
    }
    function renderConsolidatedClientsList() {
        const cont=document.getElementById('consolidated-clients-container'), sInp=document.getElementById('client-search-input'), sFilt=document.getElementById('client-filter-sector'); if(!cont||!sInp||!sFilt) return;
        const sTerm = sInp.value.toLowerCase(), selSec = sFilt.value;
        _filteredClientsCache = _consolidatedClientsCache.filter(cli => { const nComL=(cli.nombreComercial||'').toLowerCase(), nPerL=(cli.nombrePersonal||'').toLowerCase(), cepL=(cli.codigoCEP||'').toLowerCase(); const searchM=!sTerm||nComL.includes(sTerm)||nPerL.includes(sTerm)||(cli.codigoCEP&&cepL.includes(sTerm)); const secM=!selSec||cli.sector===selSec; return searchM&&secM; });
        if (_filteredClientsCache.length === 0) { cont.innerHTML = `<p class="text-center text-gray-500 p-4">No se encontraron clientes.</p>`; return; }
        let tHTML = `<table class="min-w-full bg-white text-sm"> <thead class="bg-gray-200 sticky top-0 z-10"> <tr> <th class="py-2 px-3 border-b text-left">Sector</th> <th class="py-2 px-3 border-b text-left">N. Comercial</th> <th class="py-2 px-3 border-b text-left">N. Personal</th> <th class="py-2 px-3 border-b text-left">Teléfono</th> <th class="py-2 px-3 border-b text-left">CEP</th> </tr> </thead> <tbody>`;
        _filteredClientsCache.sort((a,b)=>(a.nombreComercial||'').localeCompare(b.nombreComercial||'')).forEach(c=>{tHTML+=`<tr class="hover:bg-gray-50 border-b"><td class="py-2 px-3">${c.sector||'N/A'}</td><td class="py-2 px-3 font-semibold">${c.nombreComercial||'N/A'}</td><td class="py-2 px-3">${c.nombrePersonal||'N/A'}</td><td class="py-2 px-3">${c.telefono||'N/A'}</td><td class="py-2 px-3">${c.codigoCEP||'N/A'}</td></tr>`;});
        tHTML += '</tbody></table>'; cont.innerHTML = tHTML;
    }
    function handleDownloadFilteredClients() {
         if (typeof XLSX === 'undefined' || _filteredClientsCache.length === 0) { _showModal('Aviso', typeof XLSX === 'undefined'?'Librería Excel no cargada.':'No hay clientes.'); return; }
        const dExport = _filteredClientsCache.map(c => ({'Sector':c.sector||'','Nombre Comercial':c.nombreComercial||'','Nombre Personal':c.nombrePersonal||'','Telefono':c.telefono||'','CEP':c.codigoCEP||'','Coordenadas':c.coordenadas||''}));
        const ws = XLSX.utils.json_to_sheet(dExport); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Clientes Consolidados');
        const today = new Date().toISOString().slice(0, 10); XLSX.writeFile(wb, `Clientes_Consolidados_${today}.xlsx`);
    }

    // --- Lógica del Mapa (sin cambios) ---
    function showClientMapView() {
        if (mapInstance) { mapInstance.remove(); mapInstance = null; } _floatingControls.classList.add('hidden');
        _mainContent.innerHTML = `
            <div class="p-4 pt-8"> <div class="container mx-auto"> <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl">
                <h1 class="text-3xl font-bold text-gray-800 mb-4 text-center">Mapa Clientes</h1>
                <div class="relative mb-4"> <input type="text" id="map-search-input" placeholder="Buscar cliente..." class="w-full px-4 py-2 border rounded-lg"> <div id="map-search-results" class="absolute z-[1000] w-full bg-white border rounded-lg mt-1 max-h-60 overflow-y-auto hidden shadow-lg"></div> </div>
                <div class="mb-4 p-2 bg-gray-100 border rounded-lg text-xs flex flex-wrap justify-center items-center gap-x-4 gap-y-1"> <span class="flex items-center"><img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png" style="height:20px;margin-right:2px;"> Regular</span> <span class="flex items-center"><img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png" style="height:20px;margin-right:2px;"> Con CEP</span> </div>
                <div id="client-map" class="w-full rounded-lg shadow-inner" style="height:65vh; border:1px solid #ccc; background-color:#e5e7eb;"> <p class="text-center text-gray-500 pt-10">Cargando mapa...</p> </div>
                <button id="backToDataMenuBtn" class="mt-6 w-full px-6 py-3 bg-gray-400 text-white rounded-lg shadow-md hover:bg-gray-500">Volver</button>
            </div> </div> </div>
        `;
        document.getElementById('backToDataMenuBtn').addEventListener('click', showDataView); loadAndDisplayMap();
    }
    async function loadAndDisplayMap() {
        const mapCont = document.getElementById('client-map'); if (!mapCont || typeof L === 'undefined') { mapCont.innerHTML = '<p class="text-red-500">Error: Leaflet no cargado.</p>'; return; }
        try {
            if (_consolidatedClientsCache.length === 0) { const cliRef = _collection(_db, `artifacts/ventas-9a210/public/data/clientes`); const cliSnaps = await _getDocs(cliRef); _consolidatedClientsCache = cliSnaps.docs.map(d => ({id: d.id, ...d.data()})); }
            const cliCoords = _consolidatedClientsCache.filter(c => { if(!c.coordenadas)return false; const p=c.coordenadas.split(','); if(p.length!==2)return false; const lat=parseFloat(p[0]), lon=parseFloat(p[1]); return !isNaN(lat)&&!isNaN(lon)&&lat>=0&&lat<=13&&lon>=-74&&lon<=-59; });
            if (cliCoords.length === 0) { mapCont.innerHTML = '<p class="text-gray-500">No hay clientes con coordenadas válidas.</p>'; return; }
            let mapCenter = [7.77, -72.22]; let zoom = 13; mapInstance = L.map('client-map').setView(mapCenter, zoom); L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OSM', maxZoom: 19 }).addTo(mapInstance);
            const redI = new L.Icon({iconUrl:'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png', shadowUrl:'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png', iconSize:[25,41],iconAnchor:[12,41],popupAnchor:[1,-34],shadowSize:[41,41]}); const blueI = new L.Icon({iconUrl:'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png', shadowUrl:'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png', iconSize:[25,41],iconAnchor:[12,41],popupAnchor:[1,-34],shadowSize:[41,41]});
            mapMarkers.clear(); const mGroup=[]; cliCoords.forEach(cli=>{try{const coords=cli.coordenadas.split(',').map(p=>parseFloat(p)); const hasCEP=cli.codigoCEP&&cli.codigoCEP.toLowerCase()!=='n/a'; const icon=hasCEP?blueI:redI; const pCont=`<b>${cli.nombreComercial}</b><br><small>${cli.nombrePersonal||''}</small><br><small>Tel: ${cli.telefono||'N/A'}</small><br><small>Sector: ${cli.sector||'N/A'}</small>${hasCEP?`<br><b>CEP: ${cli.codigoCEP}</b>`:''}<br><a href="https://www.google.com/maps?q=${coords[0]},${coords[1]}" target="_blank" class="text-xs text-blue-600">Ver en Maps</a>`; const marker=L.marker(coords,{icon:icon}).bindPopup(pCont,{minWidth:150}); mGroup.push(marker); mapMarkers.set(cli.id, marker);}catch(coordErr){console.warn(`Error coords cli ${cli.nombreComercial}: ${cli.coordenadas}`, coordErr);}});
            if(mGroup.length > 0) { const group = L.featureGroup(mGroup).addTo(mapInstance); mapInstance.fitBounds(group.getBounds().pad(0.1)); } else { mapCont.innerHTML = '<p class="text-gray-500">No se pudieron mostrar clientes.</p>'; return; }
            setupMapSearch(cliCoords);
        } catch (error) { console.error("Error mapa:", error); mapCont.innerHTML = `<p class="text-red-500">Error al cargar datos mapa.</p>`; }
    }
    function setupMapSearch(clientsWithCoords) {
        const sInp = document.getElementById('map-search-input'), resCont = document.getElementById('map-search-results'); if (!sInp || !resCont) return;
        sInp.addEventListener('input', () => { const sTerm = sInp.value.toLowerCase().trim(); if (sTerm.length<2){resCont.innerHTML=''; resCont.classList.add('hidden'); return;} const filtCli = clientsWithCoords.filter(cli => (cli.nombreComercial||'').toLowerCase().includes(sTerm) || (cli.nombrePersonal||'').toLowerCase().includes(sTerm) || (cli.codigoCEP&&cli.codigoCEP.toLowerCase().includes(sTerm))); if(filtCli.length===0){resCont.innerHTML='<div class="p-2 text-gray-500 text-sm">No encontrado.</div>'; resCont.classList.remove('hidden'); return;} resCont.innerHTML=filtCli.slice(0,10).map(cli=>`<div class="p-2 hover:bg-gray-100 cursor-pointer border-b" data-client-id="${cli.id}"><p class="font-semibold text-sm">${cli.nombreComercial}</p><p class="text-xs text-gray-600">${cli.nombrePersonal||''} ${cli.codigoCEP&&cli.codigoCEP!=='N/A'?`(${cli.codigoCEP})`:''}</p></div>`).join(''); resCont.classList.remove('hidden'); });
        resCont.addEventListener('click', (e) => { const target = e.target.closest('[data-client-id]'); if (target&&mapInstance){ const cliId=target.dataset.clientId; const marker=mapMarkers.get(cliId); if(marker){mapInstance.flyTo(marker.getLatLng(),17); marker.openPopup();} sInp.value=''; resCont.innerHTML=''; resCont.classList.add('hidden'); } });
        document.addEventListener('click', (ev)=>{ if(!resCont.contains(ev.target)&&ev.target!==sInp) resCont.classList.add('hidden'); });
    }

    // Exponer funciones públicas
    window.dataModule = { showClosingDetail, handleDownloadSingleClosing };

})();
