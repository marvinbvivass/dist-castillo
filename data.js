(function() {
    let _db, _appId, _userId, _mainContent, _floatingControls, _showMainMenu, _showModal;
    let _collection, _getDocs, _query, _where, _orderBy, _populateDropdown, _getDoc, _doc, _setDoc;

    let _lastStatsData = [];
    let _lastNumWeeks = 1;
    let _consolidatedClientsCache = [];
    let _filteredClientsCache = [];

    let mapInstance = null;
    let mapMarkers = new Map();

    // --- CORRECCIÓN: Declarar variables de caché de ordenamiento ---
    let _sortPreferenceCache = null;
    let _rubroOrderMapCache = null;
    let _segmentoOrderMapCache = null;
    const SORT_CONFIG_PATH = 'config/productSortOrder'; 
    // --- FIN CORRECCIÓN ---

    const REPORTE_DESIGN_CONFIG_PATH = 'config/reporteCierreVentas';
    
    // --- VALORES POR DEFECTO ACTUALIZADOS ---
    const DEFAULT_REPORTE_SETTINGS = {
        showCargaInicial: true,
        showCargaRestante: true,
        showVaciosSheet: true,
        showClienteTotalSheet: true,
        styles: {
            // Añadido fontSize por defecto
            headerInfo: { bold: true, fillColor: "#FFFFFF", fontColor: "#000000", border: false, fontSize: 10 },
            headerProducts: { bold: true, fillColor: "#EFEFEF", fontColor: "#000000", border: true, fontSize: 10 },
            rowCargaInicial: { bold: true, fillColor: "#FFFFFF", fontColor: "#000000", border: true, fontSize: 10 },
            rowDataClients: { bold: false, fillColor: "#FFFFFF", fontColor: "#333333", border: true, fontSize: 10 },
            rowDataClientsSale: { bold: false, fillColor: "#F3FDE8", fontColor: "#000000", border: true, fontSize: 10 },
            rowCargaRestante: { bold: true, fillColor: "#FFFFFF", fontColor: "#000000", border: true, fontSize: 10 },
            rowTotals: { bold: true, fillColor: "#EFEFEF", fontColor: "#000000", border: true, fontSize: 10 },
            // --- AÑADIDOS ESTILOS PARA HOJAS VACÍOS Y TOTALES ---
            vaciosHeader: { bold: true, fillColor: "#EFEFEF", fontColor: "#000000", border: true, fontSize: 10 },
            vaciosData: { bold: false, fillColor: "#FFFFFF", fontColor: "#333333", border: true, fontSize: 10 },
            totalesHeader: { bold: true, fillColor: "#EFEFEF", fontColor: "#000000", border: true, fontSize: 10 },
            totalesData: { bold: false, fillColor: "#FFFFFF", fontColor: "#333333", border: true, fontSize: 10 },
            totalesTotalRow: { bold: true, fillColor: "#EFEFEF", fontColor: "#000000", border: true, fontSize: 11 }
        },
        columnWidths: {
            info: 15,          // Col A (Info Fecha/Usuario)
            labels: 25,        // Col B (Labels Clientes, Carga, etc.)
            products: 12,      // Default para productos (C, D, E...)
            subtotal: 15,      // Col "Sub Total"
            vaciosCliente: 25, // Hoja Vacíos - Cliente
            vaciosTipo: 15,    // Hoja Vacíos - Tipo
            vaciosQty: 12,     // Hoja Vacíos - Cantidades
            totalCliente: 35,  // Hoja Total Cliente - Cliente
            totalClienteValor: 15 // Hoja Total Cliente - Valor
        }
    };
    // --- FIN DE CAMBIOS EN VALORES POR DEFECTO ---

    /**
     * Devuelve la cantidad y unidad de display.
     * CORREGIDO: Ahora prioriza Unds si no es un número entero de Cj o Paq.
     */
    function getDisplayQty(qU, p) {
        if (!qU || qU === 0) return { value: 0, unit: 'Unds' }; // Devolver 0 Unds por defecto
        const vP = p.ventaPor || {und: true};
        const uCj = p.unidadesPorCaja || 1;
        const uPaq = p.unidadesPorPaquete || 1;
        
        // Priorizar Cajas SÓLO si es un número entero
        if (vP.cj && uCj > 0 && Number.isInteger(qU / uCj)) {
            return { value: (qU / uCj), unit: 'Cj' };
        }
        // Priorizar Paquetes SÓLO si es un número entero
        if (vP.paq && uPaq > 0 && Number.isInteger(qU / uPaq)) {
            return { value: (qU / uPaq), unit: 'Paq' };
        }
        // Si no es un paquete/caja entero, o si se vende por Unds, mostrar Unds
        return { value: qU, unit: 'Unds' };
    }

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
        _getDoc = dependencies.getDoc;
        _doc = dependencies.doc;
        _setDoc = dependencies.setDoc; 
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
                    <button id="designReportBtn" class="w-full px-6 py-3 bg-purple-600 text-white rounded-lg shadow-md hover:bg-purple-700">Diseño de Reporte</button>
                    <button id="productStatsBtn" class="w-full px-6 py-3 bg-teal-600 text-white rounded-lg shadow-md hover:bg-teal-700">Estadística Productos</button>
                    <button id="consolidatedClientsBtn" class="w-full px-6 py-3 bg-green-600 text-white rounded-lg shadow-md hover:bg-green-700">Clientes Consolidados</button>
                    <button id="clientMapBtn" class="w-full px-6 py-3 bg-cyan-600 text-white rounded-lg shadow-md hover:bg-cyan-700">Mapa de Clientes</button>
                    <button id="backToMenuBtn" class="w-full px-6 py-3 bg-gray-400 text-white rounded-lg shadow-md hover:bg-gray-500">Volver Menú</button>
                </div>
            </div> </div> </div>
        `;
        document.getElementById('closingDataBtn').addEventListener('click', showClosingDataView);
        document.getElementById('designReportBtn').addEventListener('click', showReportDesignView);
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
            window.tempClosingsData = closings; 
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
        closings.sort((a, b) => b.fecha.toDate() - a.fecha.toDate()); 
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

    async function _processSalesDataForModal(ventas, userIdForInventario) {
        const clientData = {};
        let grandTotalValue = 0;
        const allProductsMap = new Map();
        const vaciosMovementsPorTipo = {};
        const TIPOS_VACIO_GLOBAL = window.TIPOS_VACIO_GLOBAL || ["1/4 - 1/3", "ret 350 ml", "ret 1.25 Lts"];
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
                 
                 let cantidadUnidades = 0;
                 if (p.cantidadVendida) { 
                     const uCj = p.unidadesPorCaja || 1;
                     const uPaq = p.unidadesPorPaquete || 1;
                     cantidadUnidades = (p.cantidadVendida.cj || 0) * uCj + (p.cantidadVendida.paq || 0) * uPaq + (p.cantidadVendida.und || 0);
                 } else if (p.totalUnidadesVendidas) { 
                     cantidadUnidades = p.totalUnidadesVendidas;
                 }
                 clientData[clientName].products[p.id] += cantidadUnidades;
            });
        });
        const sortedClients = Object.keys(clientData).sort();
        const sortFunction = await getGlobalProductSortFunction();
        const finalProductOrder = Array.from(allProductsMap.values()).sort(sortFunction);
        return { clientData, grandTotalValue, sortedClients, finalProductOrder, vaciosMovementsPorTipo };
    }

    async function showClosingDetail(closingId) {
        const closingData = window.tempClosingsData?.find(c => c.id === closingId);
        if (!closingData) { _showModal('Error', 'No se cargaron detalles.'); return; }
        _showModal('Progreso', 'Generando reporte detallado...');
        try {
            const { clientData, grandTotalValue, sortedClients, finalProductOrder, vaciosMovementsPorTipo } = await _processSalesDataForModal(closingData.ventas, closingData.vendedorInfo.userId);
            let headerHTML = `<tr class="sticky top-0 z-20 bg-gray-200"> <th class="p-1 border sticky left-0 z-30 bg-gray-200">Cliente</th>`;
            finalProductOrder.forEach(p => { headerHTML += `<th class="p-1 border whitespace-nowrap text-xs" title="${p.marca||''} - ${p.segmento||''}">${p.presentacion}</th>`; });
            headerHTML += `<th class="p-1 border sticky right-0 z-30 bg-gray-200">Total Cliente</th></tr>`;
            let bodyHTML = ''; sortedClients.forEach(cli => { bodyHTML += `<tr class="hover:bg-blue-50"><td class="p-1 border font-medium bg-white sticky left-0 z-10">${cli}</td>`; const cCli = clientData[cli]; finalProductOrder.forEach(p => { const qU=cCli.products[p.id]||0; let dQ=''; if(qU>0){dQ=`${qU} Unds`; const vP=p.ventaPor||{}, uCj=p.unidadesPorCaja||1, uPaq=p.unidadesPorPaquete||1; if(vP.cj&&!vP.paq&&!vP.und&&uCj>0&&Number.isInteger(qU/uCj))dQ=`${qU/uCj} Cj`; else if(vP.paq&&!vP.cj&&!vP.und&&uPaq>0&&Number.isInteger(qU/uPaq))dQ=`${qU/uPaq} Paq`;} bodyHTML+=`<td class="p-1 border text-center">${dQ}</td>`; }); bodyHTML+=`<td class="p-1 border text-right font-semibold bg-white sticky right-0 z-10">$${cCli.totalValue.toFixed(2)}</td></tr>`; });
            let footerHTML = '<tr class="bg-gray-200 font-bold"><td class="p-1 border sticky left-0 z-10">TOTALES</td>'; finalProductOrder.forEach(p => { let tQ=0; sortedClients.forEach(cli => tQ+=clientData[cli].products[p.id]||0); let dT=''; if(tQ>0){dT=`${tQ} Unds`; const vP=p.ventaPor||{}, uCj=p.unidadesPorCaja||1, uPaq=p.unidadesPorPaquete||1; if(vP.cj&&!vP.paq&&!vP.und&&uCj>0&&Number.isInteger(tQ/uCj))dT=`${tQ/uCj} Cj`; else if(vP.paq&&!vP.cj&&!vP.und&&uPaq>0&&Number.isInteger(tQ/uPaq))dT=`${tQ/uPaq} Paq`;} footerHTML+=`<td class="p-1 border text-center">${dT}</td>`; }); footerHTML+=`<td class="p-1 border text-right sticky right-0 z-10">$${grandTotalValue.toFixed(2)}</td></tr>`;
            let vHTML = ''; const TIPOS_VACIO_GLOBAL = window.TIPOS_VACIO_GLOBAL || ["1/4 - 1/3", "ret 350 ml", "ret 1.25 Lts"]; const cliVacios=Object.keys(vaciosMovementsPorTipo).filter(cli=>TIPOS_VACIO_GLOBAL.some(t=>(vaciosMovementsPorTipo[cli][t]?.entregados||0)>0||(vaciosMovementsPorTipo[cli][t]?.devueltos||0)>0)).sort(); if(cliVacios.length>0){ vHTML=`<h3 class="text-xl my-6">Reporte Vacíos</h3><div class="overflow-auto border"><table><thead><tr><th>Cliente</th><th>Tipo</th><th>Entregados</th><th>Devueltos</th><th>Neto</th></tr></thead><tbody>`; cliVacios.forEach(cli=>{const movs=vaciosMovementsPorTipo[cli]; TIPOS_VACIO_GLOBAL.forEach(t=>{const mov=movs[t]||{e:0,d:0}; if(mov.entregados>0||mov.devueltos>0){const neto=mov.entregados-mov.devueltos; const nClass=neto>0?'text-red-600':(neto<0?'text-green-600':''); vHTML+=`<tr><td>${cli}</td><td>${t}</td><td>${mov.entregados}</td><td>${mov.devueltos}</td><td class="${nClass}">${neto>0?`+${neto}`:neto}</td></tr>`;}});}); vHTML+='</tbody></table></div>';}
            const vendedor = closingData.vendedorInfo || {};
            const reportHTML = `<div class="text-left max-h-[80vh] overflow-auto"> <div class="mb-4"> <p><strong>Vendedor:</strong> ${vendedor.nombre||''} ${vendedor.apellido||''}</p> <p><strong>Camión:</strong> ${vendedor.camion||'N/A'}</p> <p><strong>Fecha:</strong> ${closingData.fecha.toDate().toLocaleString('es-ES')}</p> </div> <h3 class="text-xl mb-4">Reporte Cierre</h3> <div class="overflow-auto border" style="max-height: 40vh;"> <table class="min-w-full bg-white text-xs"> <thead class="bg-gray-200">${headerHTML}</thead> <tbody>${bodyHTML}</tbody> <tfoot>${footerHTML}</tfoot> </table> </div> ${vHTML} </div>`;
            _showModal(`Detalle Cierre`, reportHTML, null, 'Cerrar');
        } catch (error) { console.error("Error generando detalle:", error); _showModal('Error', `No se pudo generar: ${error.message}`); }
    }

    async function processSalesDataForReport(ventas, userIdForInventario) {
        const dataByRubro = {};
        const clientTotals = {}; 
        let grandTotalValue = 0;
        const vaciosMovementsPorTipo = {};
        const allRubros = new Set();
        const TIPOS_VACIO_GLOBAL = window.TIPOS_VACIO_GLOBAL || ["1/4 - 1/3", "ret 350 ml", "ret 1.25 Lts"];
        const inventarioRef = _collection(_db, `artifacts/${_appId}/users/${userIdForInventario}/inventario`); 
        const inventarioSnapshot = await _getDocs(inventarioRef); 
        const inventarioMap = new Map(inventarioSnapshot.docs.map(doc => [doc.id, doc.data()]));
        const userDoc = await _getDoc(_doc(_db, "users", userIdForInventario));
        const userInfo = userDoc.exists() ? userDoc.data() : { email: 'Usuario Desconocido' };
        ventas.forEach(venta => {
            const clientName = venta.clienteNombre || 'Cliente Desconocido';
            const ventaTotalCliente = venta.total || 0;
            clientTotals[clientName] = (clientTotals[clientName] || 0) + ventaTotalCliente;
            grandTotalValue += ventaTotalCliente;
            if (!vaciosMovementsPorTipo[clientName]) { 
                vaciosMovementsPorTipo[clientName] = {}; 
                TIPOS_VACIO_GLOBAL.forEach(t => vaciosMovementsPorTipo[clientName][t] = { entregados: 0, devueltos: 0 }); 
            }
            const vacDev = venta.vaciosDevueltosPorTipo || {};
            for (const t in vacDev) { 
                if (!vaciosMovementsPorTipo[clientName][t]) vaciosMovementsPorTipo[clientName][t] = { entregados: 0, devueltos: 0 }; 
                vaciosMovementsPorTipo[clientName][t].devueltos += (vacDev[t] || 0); 
            }
            (venta.productos || []).forEach(p => {
                const prodInventario = inventarioMap.get(p.id); 
                const prodParaReporte = {
                    id: p.id,
                    precios: p.precios,
                    ventaPor: p.ventaPor || {und: true}, 
                    unidadesPorCaja: p.unidadesPorCaja || 1, 
                    unidadesPorPaquete: p.unidadesPorPaquete || 1, 
                    rubro: prodInventario?.rubro || p.rubro || 'SIN RUBRO',
                    segmento: prodInventario?.segmento || p.segmento || 'S/S',
                    marca: prodInventario?.marca || p.marca || 'S/M',
                    presentacion: prodInventario?.presentacion || p.presentacion || 'S/P',
                    manejaVacios: prodInventario?.manejaVacios || p.manejaVacios || false,
                    tipoVacio: prodInventario?.tipoVacio || p.tipoVacio || null
                };
                const rubro = prodParaReporte.rubro;
                allRubros.add(rubro);
                if (!dataByRubro[rubro]) {
                    dataByRubro[rubro] = { clients: {}, productsMap: new Map(), productTotals: {}, totalValue: 0 };
                }
                if (!dataByRubro[rubro].clients[clientName]) {
                    dataByRubro[rubro].clients[clientName] = { products: {}, totalValue: 0 };
                }
                if (!dataByRubro[rubro].productsMap.has(p.id)) {
                    dataByRubro[rubro].productsMap.set(p.id, prodParaReporte); 
                }
                let cantidadUnidades = 0;
                if (p.cantidadVendida) { 
                    const uCj = p.unidadesPorCaja || 1;
                    const uPaq = p.unidadesPorPaquete || 1;
                    cantidadUnidades = (p.cantidadVendida.cj || 0) * uCj + (p.cantidadVendida.paq || 0) * uPaq + (p.cantidadVendida.und || 0);
                } else if (p.totalUnidadesVendidas) { 
                    cantidadUnidades = p.totalUnidadesVendidas;
                }
                const subtotalProducto = (p.precios?.cj || 0) * (p.cantidadVendida?.cj || 0) + (p.precios?.paq || 0) * (p.cantidadVendida?.paq || 0) + (p.precios?.und || 0) * (p.cantidadVendida?.und || 0);
                dataByRubro[rubro].clients[clientName].products[p.id] = (dataByRubro[rubro].clients[clientName].products[p.id] || 0) + cantidadUnidades;
                dataByRubro[rubro].clients[clientName].totalValue += subtotalProducto;
                dataByRubro[rubro].totalValue += subtotalProducto;
                if (prodParaReporte.manejaVacios && prodParaReporte.tipoVacio) {
                    const tV = prodParaReporte.tipoVacio; 
                    if (!vaciosMovementsPorTipo[clientName][tV]) vaciosMovementsPorTipo[clientName][tV] = { entregados: 0, devueltos: 0 }; 
                    vaciosMovementsPorTipo[clientName][tV].entregados += p.cantidadVendida?.cj || 0; 
                }
            });
        });
        const sortFunction = await getGlobalProductSortFunction();
        const finalData = { rubros: {}, vaciosMovementsPorTipo: vaciosMovementsPorTipo, clientTotals: clientTotals, grandTotalValue: grandTotalValue };
        for (const rubroName of Array.from(allRubros).sort()) {
            const rubroData = dataByRubro[rubroName];
            const sortedProducts = Array.from(rubroData.productsMap.values()).sort(sortFunction);
            const sortedClients = Object.keys(rubroData.clients).sort();
            const productTotals = {};
            for (const p of sortedProducts) {
                const productId = p.id;
                let totalSoldUnits = 0;
                for (const clientName of sortedClients) {
                    totalSoldUnits += (rubroData.clients[clientName].products[productId] || 0);
                }
                const currentStockUnits = inventarioMap.get(productId)?.cantidadUnidades || 0;
                const initialStockUnits = currentStockUnits + totalSoldUnits;
                productTotals[productId] = { totalSold: totalSoldUnits, currentStock: currentStockUnits, initialStock: initialStockUnits };
            }
            finalData.rubros[rubroName] = { clients: rubroData.clients, products: sortedProducts, sortedClients: sortedClients, totalValue: rubroData.totalValue, productTotals: productTotals };
        }
        return { finalData, userInfo };
    }

    /**
     * [NUEVA FUNCIÓN DE ESTILOS PARA EXCELJS]
     * Esta función construye un objeto de estilo COMPLETO para ExcelJS.
     * CORREGIDO: Añadido horizontalAlign
     */
    function buildExcelJSStyle(config, borderStyle, numFmt = null, horizontalAlign = 'left') {
        const style = {};
        
        // 1. Fuente (Font)
        style.font = {
            bold: config.bold || false,
            color: { argb: 'FF' + (config.fontColor || "#000000").substring(1) }, // Formato ARGB
            size: config.fontSize || 10 // AÑADIDO: Tamaño de letra
        };

        // 2. Relleno (Fill)
        style.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF' + (config.fillColor || "#FFFFFF").substring(1) } // Formato ARGB
        };

        // 3. Bordes (Border)
        if (config.border && borderStyle) {
            style.border = borderStyle;
        }

        // 4. Formato de Número (Number Format)
        if (numFmt) {
            style.numFmt = numFmt;
        }
        
        // 5. Alineación (opcional, se puede añadir si se desea)
        style.alignment = { vertical: 'middle', horizontal: horizontalAlign }; // Añadido centrado vertical y horizontal
    }

    /**
     * [FUNCIÓN DE EXPORTACIÓN ACTUALIZADA CON EXCELJS]
     * Reescritura completa de la función de exportación para usar ExcelJS.
     */
    async function exportSingleClosingToExcel(closingData) {
        // Verificar si ExcelJS está cargado
        if (typeof ExcelJS === 'undefined') {
            _showModal('Error', 'Librería ExcelJS no cargada. No se puede exportar.');
            return;
        }

        const REPORTE_DESIGN_PATH = `artifacts/${_appId}/users/${_userId}/${REPORTE_DESIGN_CONFIG_PATH}`;
        // --- MODIFICADO: Usar _.cloneDeep o similar (JSON.parse(JSON.stringify)) para evitar mutación
        let settings = JSON.parse(JSON.stringify(DEFAULT_REPORTE_SETTINGS)); 
        try {
            const designDocRef = _doc(_db, REPORTE_DESIGN_PATH);
            const docSnap = await _getDoc(designDocRef);
            if (docSnap.exists()) {
                const savedSettings = docSnap.data();
                // Merge profundo manual simple para evitar problemas
                settings = { ...settings, ...savedSettings };
                settings.styles = { ...DEFAULT_REPORTE_SETTINGS.styles, ...(savedSettings.styles || {}) };
                settings.columnWidths = { ...DEFAULT_REPORTE_SETTINGS.columnWidths, ...(savedSettings.columnWidths || {}) };
            } 
        } catch (err) {
            console.warn("Error al cargar diseño de reporte, usando default:", err);
            // settings ya es DEFAULT_REPORTE_SETTINGS
        }
        _showModal('Progreso', 'Generando Excel con su diseño...'); 

        try {
            const { finalData, userInfo } = await processSalesDataForReport(closingData.ventas, closingData.vendedorInfo.userId);
            const workbook = new ExcelJS.Workbook();
            const fechaCierre = closingData.fecha.toDate().toLocaleDateString('es-ES');
            const usuarioEmail = userInfo.email || (userInfo.nombre ? `${userInfo.nombre} ${userInfo.apellido}` : 'Usuario Desconocido');

            // --- Definición de Estilos (usando la nueva buildExcelJSStyle) ---
            const thinBorderStyle = { top: {style:"thin"}, bottom: {style:"thin"}, left: {style:"thin"}, right: {style:"thin"} };
            const s = settings.styles;

            // CORREGIDO: Añadido 'left' alignment
            const headerInfoStyle = buildExcelJSStyle(s.headerInfo, s.headerInfo.border ? thinBorderStyle : null, null, 'left');
            const headerProductsStyle = buildExcelJSStyle(s.headerProducts, s.headerProducts.border ? thinBorderStyle : null, null, 'left');
            const headerPriceStyle = buildExcelJSStyle(s.headerProducts, s.headerProducts.border ? thinBorderStyle : null, "$#,##0.00", 'right');
            const headerSubtotalStyle = buildExcelJSStyle({ ...s.headerProducts, bold: true }, s.headerProducts.border ? thinBorderStyle : null, null, 'left');

            const cargaInicialStyle = buildExcelJSStyle(s.rowCargaInicial, s.rowCargaInicial.border ? thinBorderStyle : null, null, 'left');
            const cargaInicialQtyStyle = buildExcelJSStyle(s.rowCargaInicial, s.rowCargaInicial.border ? thinBorderStyle : null, null, 'center'); // Cantidades centradas
            
            const clientDataStyle = buildExcelJSStyle(s.rowDataClients, s.rowDataClients.border ? thinBorderStyle : null, null, 'left');
            const clientQtyStyle = buildExcelJSStyle(s.rowDataClients, s.rowDataClients.border ? thinBorderStyle : null, null, 'center'); // Cantidades centradas
            const clientSaleStyle = buildExcelJSStyle(s.rowDataClientsSale, s.rowDataClientsSale.border ? thinBorderStyle : null, null, 'center'); // Cantidades centradas
            const clientPriceStyle = buildExcelJSStyle(s.rowDataClients, s.rowDataClients.border ? thinBorderStyle : null, "$#,##0.00", 'right'); // Precios derecha

            const cargaRestanteStyle = buildExcelJSStyle(s.rowCargaRestante, s.rowCargaRestante.border ? thinBorderStyle : null, null, 'left');
            const cargaRestanteQtyStyle = buildExcelJSStyle(s.rowCargaRestante, s.rowCargaRestante.border ? thinBorderStyle : null, null, 'center'); // Cantidades centradas

            const totalsStyle = buildExcelJSStyle(s.rowTotals, s.rowTotals.border ? thinBorderStyle : null, null, 'left');
            const totalsQtyStyle = buildExcelJSStyle(s.rowTotals, s.rowTotals.border ? thinBorderStyle : null, null, 'center'); // Cantidades centradas
            const totalsPriceStyle = buildExcelJSStyle({ ...s.rowTotals, bold: true }, s.rowTotals.border ? thinBorderStyle : null, "$#,##0.00", 'right'); // Precio derecha
            // --- Fin Estilos ---

            const getPrice = (p) => {
                const precios = p.precios || { und: p.precioPorUnidad || 0 };
                if (p.ventaPor?.cj && precios.cj > 0) return Number(precios.cj.toFixed(2));
                if (p.ventaPor?.paq && precios.paq > 0) return Number(precios.paq.toFixed(2));
                return Number((precios.und || 0).toFixed(2));
            };

            for (const rubroName in finalData.rubros) {
                const rubroData = finalData.rubros[rubroName];
                const { products: sortedProducts, sortedClients, clients: clientData, productTotals, totalValue: rubroTotalValue } = rubroData;
                
                const sheetName = rubroName.replace(/[\/\\?*\[\]]/g, '').substring(0, 31);
                const worksheet = workbook.addWorksheet(sheetName);

                // --- MODIFICADO: Ancho de columnas desde settings ---
                const colWidths = [ 
                    { width: settings.columnWidths.info }, 
                    { width: settings.columnWidths.labels } 
                ];
                const START_COL = 3; // Columna 'C'
                
                // --- Fila 1: Info Fecha ---
                // CORREGIDO: Combinar celda y poner valor
                worksheet.mergeCells('A1', 'B1');
                worksheet.getCell('A1').value = `FECHA: ${fechaCierre}`;
                worksheet.getCell('A1').style = headerInfoStyle;

                // --- Fila 2: Info Usuario ---
                // CORREGIDO: Combinar celda y poner valor
                worksheet.mergeCells('A2', 'B2');
                worksheet.getCell('A2').value = `USUARIO: ${usuarioEmail}`;
                worksheet.getCell('A2').style = headerInfoStyle;

                // --- Fila 1-4: Cabeceras de Producto ---
                const headerRowSegment = worksheet.getRow(1);
                const headerRowMarca = worksheet.getRow(2);
                const headerRowPresentacion = worksheet.getRow(3);
                const headerRowPrecio = worksheet.getRow(4);

                headerRowSegment.getCell(2).value = "SEGMENTO";
                headerRowMarca.getCell(2).value = "MARCA";
                headerRowPresentacion.getCell(2).value = "PRESENTACION";
                headerRowPrecio.getCell(2).value = "PRECIO";
                [1,2,3,4].forEach(r => worksheet.getCell(r, 2).style = headerProductsStyle);
                
                let lastSegment = null, lastMarca = null;
                let segmentColStart = START_COL, marcaColStart = START_COL;

                sortedProducts.forEach((p, index) => {
                    const c = START_COL + index; 
                    const segment = p.segmento || 'S/S';
                    const marca = p.marca || 'S/M';
                    const presentacion = p.presentacion || 'S/P';
                    const precio = getPrice(p);

                    headerRowSegment.getCell(c).value = segment;
                    headerRowMarca.getCell(c).value = marca;
                    headerRowPresentacion.getCell(c).value = presentacion;
                    headerRowPrecio.getCell(c).value = precio;

                    // Aplicar estilos a cabeceras
                    headerRowSegment.getCell(c).style = headerProductsStyle;
                    headerRowMarca.getCell(c).style = headerProductsStyle;
                    headerRowPresentacion.getCell(c).style = headerProductsStyle;
                    headerRowPrecio.getCell(c).style = headerPriceStyle;

                    const priceLen = precio.toFixed(2).length;
                    const w = Math.max(segment.length, marca.length, presentacion.length, priceLen);
                    // --- MODIFICADO: Ancho de producto desde settings (como mínimo) ---
                    colWidths.push({ width: Math.max(w + 2, settings.columnWidths.products) });

                    if (index > 0) {
                        if (segment !== lastSegment) {
                            if (c - 1 >= segmentColStart) { worksheet.mergeCells(1, segmentColStart, 1, c - 1); }
                            segmentColStart = c;
                        }
                        if (marca !== lastMarca || segment !== lastSegment) {
                            if (c - 1 >= marcaColStart) { worksheet.mergeCells(2, marcaColStart, 2, c - 1); }
                            marcaColStart = c;
                        }
                    }
                    lastSegment = segment;
                    lastMarca = marca;
                });

                const lastProdCol = START_COL + sortedProducts.length - 1;
                if (lastProdCol >= segmentColStart) { worksheet.mergeCells(1, segmentColStart, 1, lastProdCol); }
                if (lastProdCol >= marcaColStart) { worksheet.mergeCells(2, marcaColStart, 2, lastProdCol); }
                
                const subTotalCol = START_COL + sortedProducts.length;
                worksheet.getCell(1, subTotalCol).value = "Sub Total";
                worksheet.getCell(1, subTotalCol).style = headerSubtotalStyle;
                worksheet.mergeCells(1, subTotalCol, 4, subTotalCol);
                // --- MODIFICADO: Ancho subtotal desde settings ---
                colWidths.push({ width: settings.columnWidths.subtotal });
                
                worksheet.columns = colWidths;
                
                let currentRowNum = 6; // Empezar en fila 6

                // --- Fila: CARGA INICIAL ---
                if (settings.showCargaInicial) {
                    const cargaInicialRow = worksheet.getRow(currentRowNum++);
                    cargaInicialRow.getCell(2).value = "CARGA INICIAL";
                    cargaInicialRow.getCell(2).style = cargaInicialStyle;
                    sortedProducts.forEach((p, index) => {
                        const initialStock = productTotals[p.id]?.initialStock || 0;
                        const cell = cargaInicialRow.getCell(START_COL + index);
                        // CORREGIDO: Aplicar formato y valor dinámico
                        const qtyDisplay = getDisplayQty(initialStock, p);
                        cell.value = qtyDisplay.value;
                        cell.style = cargaInicialQtyStyle;
                        cell.numFmt = `0.## "${qtyDisplay.unit}"`;
                    });
                    cargaInicialRow.getCell(subTotalCol).style = cargaInicialStyle; // Celda vacía con estilo
                }

                currentRowNum++; // Fila vacía

                // --- Filas: Clientes ---
                sortedClients.forEach(clientName => {
                    const clientRow = worksheet.getRow(currentRowNum++);
                    clientRow.getCell(2).value = clientName;
                    clientRow.getCell(2).style = clientDataStyle; // Estilo para el nombre del cliente
                    
                    const clientSales = clientData[clientName];
                    sortedProducts.forEach((p, index) => {
                        const qU = clientSales.products[p.id] || 0;
                        const cell = clientRow.getCell(START_COL + index);
                        // CORREGIDO: Aplicar formato y valor dinámico
                        const qtyDisplay = getDisplayQty(qU, p);
                        cell.value = qtyDisplay.value;
                        cell.style = (qU > 0) ? clientSaleStyle : clientQtyStyle;
                        cell.numFmt = `0.## "${qtyDisplay.unit}"`;
                    });
                    const subtotalCell = clientRow.getCell(subTotalCol);
                    subtotalCell.value = clientSales.totalValue;
                    subtotalCell.style = clientPriceStyle; // Estilo para el subtotal del cliente
                });

                currentRowNum++; // Fila vacía

                // --- Fila: CARGA RESTANTE ---
                if (settings.showCargaRestante) {
                    const cargaRestanteRow = worksheet.getRow(currentRowNum++);
                    cargaRestanteRow.getCell(2).value = "CARGA RESTANTE";
                    cargaRestanteRow.getCell(2).style = cargaRestanteStyle;
                    sortedProducts.forEach((p, index) => {
                        const currentStock = productTotals[p.id]?.currentStock || 0;
                        const cell = cargaRestanteRow.getCell(START_COL + index);
                        // CORREGIDO: Aplicar formato y valor dinámico
                        const qtyDisplay = getDisplayQty(currentStock, p);
                        cell.value = qtyDisplay.value;
                        cell.style = cargaRestanteQtyStyle;
                        cell.numFmt = `0.## "${qtyDisplay.unit}"`;
                    });
                    cargaRestanteRow.getCell(subTotalCol).style = cargaRestanteStyle; // Celda vacía con estilo
                }

                // --- Fila: TOTALES ---
                const totalesRow = worksheet.getRow(currentRowNum++);
                totalesRow.getCell(2).value = "TOTALES";
                totalesRow.getCell(2).style = totalsStyle;
                sortedProducts.forEach((p, index) => {
                    const totalSold = productTotals[p.id]?.totalSold || 0;
                    const cell = totalesRow.getCell(START_COL + index);
                    // CORREGIDO: Aplicar formato y valor dinámico
                    const qtyDisplay = getDisplayQty(totalSold, p);
                    cell.value = qtyDisplay.value;
                    cell.style = totalsQtyStyle;
                    cell.numFmt = `0.## "${qtyDisplay.unit}"`;
                });
                const totalCell = totalesRow.getCell(subTotalCol);
                totalCell.value = rubroTotalValue;
                totalCell.style = totalsPriceStyle;
            }

            // --- Hoja: Reporte Vacíos ---
            const { vaciosMovementsPorTipo } = finalData;
            const TIPOS_VACIO_GLOBAL = window.TIPOS_VACIO_GLOBAL || ["1/4 - 1/3", "ret 350 ml", "ret 1.25 Lts"]; 
            const cliVacios = Object.keys(vaciosMovementsPorTipo).filter(cli => TIPOS_VACIO_GLOBAL.some(t => (vaciosMovementsPorTipo[cli][t]?.entregados || 0) > 0 || (vaciosMovementsPorTipo[cli][t]?.devueltos || 0) > 0)).sort(); 
            
            if (settings.showVaciosSheet && cliVacios.length > 0) { 
                const wsVacios = workbook.addWorksheet('Reporte Vacíos');
                // --- MODIFICADO: Ancho de columnas desde settings ---
                wsVacios.columns = [ 
                    { width: settings.columnWidths.vaciosCliente }, 
                    { width: settings.columnWidths.vaciosTipo }, 
                    { width: settings.columnWidths.vaciosQty }, 
                    { width: settings.columnWidths.vaciosQty }, 
                    { width: settings.columnWidths.vaciosQty } 
                ];

                // --- MODIFICADO: Aplicar estilos a Hoja Vacíos ---
                const vaciosHeaderStyle = buildExcelJSStyle(s.vaciosHeader, s.vaciosHeader.border ? thinBorderStyle : null, null, 'left');
                const vaciosDataStyle = buildExcelJSStyle(s.vaciosData, s.vaciosData.border ? thinBorderStyle : null, null, 'left');
                const vaciosDataNumStyle = buildExcelJSStyle(s.vaciosData, s.vaciosData.border ? thinBorderStyle : null, '0', 'center');
                
                const headerRowVacios = wsVacios.getRow(1);
                headerRowVacios.values = ['Cliente', 'Tipo Vacío', 'Entregados', 'Devueltos', 'Neto'];
                headerRowVacios.style = vaciosHeaderStyle; // Aplica estilo general
                // Centrar cabeceras numéricas
                headerRowVacios.getCell(3).style = buildExcelJSStyle(s.vaciosHeader, s.vaciosHeader.border ? thinBorderStyle : null, null, 'center');
                headerRowVacios.getCell(4).style = buildExcelJSStyle(s.vaciosHeader, s.vaciosHeader.border ? thinBorderStyle : null, null, 'center');
                headerRowVacios.getCell(5).style = buildExcelJSStyle(s.vaciosHeader, s.vaciosHeader.border ? thinBorderStyle : null, null, 'center');
                // --- FIN MODIFICADO ---
                
                cliVacios.forEach(cli => {
                    const movs = vaciosMovementsPorTipo[cli]; 
                    TIPOS_VACIO_GLOBAL.forEach(t => {
                        const mov = movs[t] || {entregados:0, devueltos:0}; 
                        if (mov.entregados > 0 || mov.devueltos > 0) {
                            // --- MODIFICADO: Aplicar estilo de datos a fila ---
                            const dataRow = wsVacios.addRow([cli, t, mov.entregados, mov.devueltos, mov.entregados - mov.devueltos]);
                            // Aplicar estilo de datos general (para texto)
                            dataRow.getCell(1).style = vaciosDataStyle;
                            dataRow.getCell(2).style = vaciosDataStyle;
                            // Aplicar estilo numérico y centrado
                            dataRow.getCell(3).style = vaciosDataNumStyle;
                            dataRow.getCell(4).style = vaciosDataNumStyle;
                            dataRow.getCell(5).style = vaciosDataNumStyle;
                            // --- FIN MODIFICADO ---
                        }
                    });
                }); 
            }

            // --- Hoja: Total Por Cliente ---
            const { clientTotals, grandTotalValue } = finalData;
            if (settings.showClienteTotalSheet) {
                const wsClientes = workbook.addWorksheet('Total Por Cliente');
                // --- MODIFICADO: Ancho de columnas desde settings ---
                wsClientes.columns = [ 
                    { width: settings.columnWidths.totalCliente }, 
                    { width: settings.columnWidths.totalClienteValor } 
                ];

                // --- MODIFICADO: Aplicar estilos a Hoja Totales ---
                const totalesHeaderStyle = buildExcelJSStyle(s.totalesHeader, s.totalesHeader.border ? thinBorderStyle : null, null, 'left');
                const totalesDataStyle = buildExcelJSStyle(s.totalesData, s.totalesData.border ? thinBorderStyle : null, null, 'left');
                const totalesDataPriceStyle = buildExcelJSStyle(s.totalesData, s.totalesData.border ? thinBorderStyle : null, "$#,##0.00", 'right');
                const totalesTotalRowStyle = buildExcelJSStyle(s.totalesTotalRow, s.totalesTotalRow.border ? thinBorderStyle : null, null, 'left');
                const totalesTotalRowPriceStyle = buildExcelJSStyle(s.totalesTotalRow, s.totalesTotalRow.border ? thinBorderStyle : null, "$#,##0.00", 'right');
                
                const headerRowTotales = wsClientes.getRow(1);
                headerRowTotales.values = ['Cliente', 'Gasto Total'];
                headerRowTotales.style = totalesHeaderStyle;
                headerRowTotales.getCell(2).style = buildExcelJSStyle(s.totalesHeader, s.totalesHeader.border ? thinBorderStyle : null, null, 'right');
                // --- FIN MODIFICADO ---
                
                const sortedClientTotals = Object.entries(clientTotals).sort((a, b) => a[0].localeCompare(b[0]));
                sortedClientTotals.forEach(([clientName, totalValue]) => {
                    // --- MODIFICADO: Aplicar estilo de datos a fila ---
                    const row = wsClientes.addRow([clientName, Number(totalValue.toFixed(2))]);
                    row.getCell(1).style = totalesDataStyle;
                    row.getCell(2).style = totalesDataPriceStyle;
                    // --- FIN MODIFICADO ---
                });
                
                // --- MODIFICADO: Aplicar estilo a fila total ---
                const totalRow = wsClientes.addRow(['GRAN TOTAL', Number(grandTotalValue.toFixed(2))]);
                totalRow.getCell(1).style = totalesTotalRowStyle;
                totalRow.getCell(2).style = totalesTotalRowPriceStyle;
                // --- FIN MODIFICADO ---
            }

            // --- Descargar el archivo ---
            const vendedor = closingData.vendedorInfo || {}; 
            const fecha = closingData.fecha.toDate().toISOString().slice(0, 10); 
            const vendNombre = (vendedor.nombre || 'Vendedor').replace(/\s/g, '_');
            const fileName = `Cierre_${vendNombre}_${fecha}.xlsx`;

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);

        } catch (error) { 
            console.error("Error exportando con ExcelJS:", error); 
            _showModal('Error', `Error al generar Excel: ${error.message}`); 
            throw error; 
        }
    }


    async function handleDownloadSingleClosing(closingId) {
        const closingData = window.tempClosingsData?.find(c => c.id === closingId);
        if (!closingData) { _showModal('Error', 'Datos no encontrados.'); return; }
        
        const modalContainer = document.getElementById('modalContainer');
        if (modalContainer && !modalContainer.classList.contains('hidden') && modalContainer.querySelector('h3')?.textContent.startsWith('Progreso')) {
            modalContainer.classList.add('hidden');
        }

        _showModal('Progreso', 'Cargando diseño y generando Excel...');
        try {
            await exportSingleClosingToExcel(closingData);
             const modalContainer = document.getElementById('modalContainer');
             if(modalContainer && !modalContainer.classList.contains('hidden') && modalContainer.querySelector('h3')?.textContent.startsWith('Progreso')) { modalContainer.classList.add('hidden'); }
        } catch (error) { 
             const modalContainer = document.getElementById('modalContainer');
             if(modalContainer && !modalContainer.classList.contains('hidden') && modalContainer.querySelector('h3')?.textContent.startsWith('Progreso')) { modalContainer.classList.add('hidden'); }
        }
    }

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
        const adminRubrosPath = `artifacts/${_appId}/users/${_userId}/rubros`; 
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
            allClosings.forEach(c => { const cDate = c.fecha?.toDate?c.fecha.toDate():new Date(0); if(cDate<earliestDate)earliestDate=cDate; (c.ventas||[]).forEach(v => { (v.productos||[]).forEach(p => { const admPInfo = admInvMap.get(p.id); if (admPInfo && admPInfo.rubro === rFilt) { 
                if (!pSales[p.id]) {
                    pSales[p.id]={
                        segmento: admPInfo.segmento || 'S/S', 
                        marca: admPInfo.marca || 'S/M',       
                        presentacion: admPInfo.presentacion,
                        totalUnidades: 0, 
                        ventaPor: admPInfo.ventaPor, 
                        unidadesPorCaja: admPInfo.unidadesPorCaja||1, 
                        unidadesPorPaquete: admPInfo.unidadesPorPaquete||1
                    };
                }
                
                let cantidadUnidades = 0;
                if (p.cantidadVendida) { 
                    const uCj = p.unidadesPorCaja || 1;
                    const uPaq = p.unidadesPorPaquete || 1;
                    cantidadUnidades = (p.cantidadVendida.cj || 0) * uCj + (p.cantidadVendida.paq || 0) * uPaq + (p.cantidadVendida.und || 0);
                } else if (p.totalUnidadesVendidas) { 
                    cantidadUnidades = p.totalUnidadesVendidas;
                }
                pSales[p.id].totalUnidades += cantidadUnidades; 
            } }); }); });
            const pArray = Object.values(pSales); let nWeeks = 1;
            if (sType === 'general') { nWeeks = Math.max(1, Math.ceil(Math.abs((now - earliestDate) / (86400000 * 7)))); }
            _lastStatsData = pArray; _lastNumWeeks = nWeeks; renderStatsList(pArray, sType, nWeeks);
        } catch (error) { console.error("Error stats:", error); cont.innerHTML = `<p class="text-red-500">Error al calcular.</p>`; _lastStatsData = []; }
    }
    function renderStatsList(productArray, statsType, numWeeks = 1) {
        const cont = document.getElementById('stats-list-container'); if (productArray.length === 0) { cont.innerHTML = `<p class="text-center text-gray-500">No se encontraron ventas.</p>`; return; }
        const hTitle = statsType === 'general' ? 'Prom. Semanal' : 'Total Vendido';
        let tHTML = `<table class="min-w-full bg-white text-sm"> <thead class="bg-gray-200 sticky top-0 z-10"> <tr> <th class="py-2 px-3 border-b text-left">Producto</th> <th class="py-2 px-3 border-b text-center">${hTitle}</th> </tr> </thead> <tbody>`;
        productArray.sort((a,b)=>{
            const segComp = (a.segmento || '').localeCompare(b.segmento || '');
            if (segComp !== 0) return segComp;
            const marComp = (a.marca || '').localeCompare(b.marca || '');
            if (marComp !== 0) return marComp;
            return (a.presentacion||'').localeCompare(b.presentacion||'');
        });
        productArray.forEach(p => { 
            // CORREGIDO: Usar getDisplayQty
            const totPer = statsType==='general'?(p.totalUnidades/numWeeks):p.totalUnidades; 
            const qtyDisplay = getDisplayQty(totPer, p);
            let dQty = qtyDisplay.value;
            // Para estadísticas, sí queremos decimales si no es Unds
            if (qtyDisplay.unit !== 'Unds') {
                dQty = totPer / (qtyDisplay.unit === 'Cj' ? p.unidadesPorCaja : p.unidadesPorPaquete);
                dQty = dQty.toFixed(1); // Mostrar un decimal para promedios
                if(dQty.endsWith('.0')) dQty = dQty.slice(0,-2);
            } else {
                dQty = dQty.toFixed(0); // Sin decimales para unidades
            }

            const desc = `<span class="font-semibold">${p.segmento}</span> <span class="text-gray-700">${p.marca}</span> <span class="text-gray-500 font-light">${p.presentacion}</span>`;
            tHTML+=`<tr class="hover:bg-gray-50"><td class="py-2 px-3 border-b">${desc}</td><td class="py-2 px-3 border-b text-center font-bold">${dQty} <span class="font-normal text-xs">${qtyDisplay.unit}</span></td></tr>`; 
        });
        tHTML += `</tbody></table>`; cont.innerHTML = `${tHTML}<div class="mt-6 text-center"><button id="downloadStatsBtn" class="px-6 py-2 bg-green-600 text-white rounded-lg shadow-md hover:bg-green-700">Descargar Excel</button></div>`;
        const dBt = document.getElementById('downloadStatsBtn'); if(dBt) dBt.addEventListener('click', handleDownloadStats);
    }
    
    /**
     * [NUEVA FUNCIÓN DE EXPORTACIÓN CON EXCELJS]
     */
    async function handleDownloadStats() {
        if (_lastStatsData.length === 0 || typeof ExcelJS === 'undefined') { _showModal('Aviso', _lastStatsData.length === 0 ? 'No hay datos.' : 'Librería ExcelJS no cargada.'); return; }
        
        const sType = document.getElementById('stats-type').value; 
        const hTitle = sType === 'general' ? 'Prom. Semanal' : 'Total Vendido';
        const dExport = _lastStatsData.map(p => { 
            // CORREGIDO: Usar getDisplayQty
            const totPer = statsType==='general'?(p.totalUnidades/_lastNumWeeks):p.totalUnidades; 
            const qtyDisplay = getDisplayQty(totPer, p);
            let dQty = qtyDisplay.value;
            if (qtyDisplay.unit !== 'Unds') {
                dQty = totPer / (qtyDisplay.unit === 'Cj' ? p.unidadesPorCaja : p.unidadesPorPaquete);
                dQty = parseFloat(dQty.toFixed(2)); // Usar 2 decimales para Excel
            }

            return {
                'Segmento': p.segmento || 'S/S',
                'Marca': p.marca || 'S/M',
                'Presentacion': p.presentacion || 'S/P',
                'ValorNumerico': dQty,
                'Unidad': qtyDisplay.unit
            }; 
        });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Estadisticas');
        
        worksheet.columns = [
            { header: 'Segmento', key: 'Segmento', width: 25 },
            { header: 'Marca', key: 'Marca', width: 25 },
            { header: 'Presentacion', key: 'Presentacion', width: 30 },
            { header: hTitle, key: hTitle, width: 20 },
        ];
        worksheet.getRow(1).font = { bold: true };
        
        // Añadir filas manualmente para controlar el tipo
        dExport.forEach(item => {
            worksheet.addRow({
                'Segmento': item.Segmento,
                'Marca': item.Marca,
                'Presentacion': item.Presentacion,
                [hTitle]: item['ValorNumerico'], // Guardar como número
                'Unidad': item.Unidad // Guardar unidad por separado (opcional)
            });
            // Aplicar formato de número a la celda de cantidad
            const lastRow = worksheet.lastRow;
            const qtyCell = lastRow.getCell(hTitle);
            qtyCell.numFmt = `0.## "${item.Unidad}"`; // Formato: "10.5 Cajas"
        });

        const rubro = document.getElementById('stats-rubro-filter').value; 
        const today = new Date().toISOString().slice(0, 10);
        const fileName = `Estadisticas_${rubro}_${sType}_${today}.xlsx`;

        try {
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
        } catch (error) {
            console.error("Error al descargar stats con ExcelJS:", error);
            _showModal('Error', 'No se pudo generar el archivo de estadísticas.');
        }
    }
    
    async function showConsolidatedClientsView() {
        _mainContent.innerHTML = `
            <div class="p-4 pt-8"> <div class="container mx-auto"> <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl">
                <h1 class="text-3xl font-bold text-gray-800 mb-6 text-center">Clientes Consolidados</h1>
                <div id="consolidated-clients-filters"></div>
                <div id="consolidated-clients-container" class="overflow-x-auto max-h-96"> <p class="text-center text-gray-500">Cargando...</p> </div>
                <div class="mt-6 flex flex-col sm:flex-row gap-4"> <button id="backToDataMenuBtn" class="w-full px-6 py-3 bg-gray-400 text-white rounded-lg shadow-md hover:bg-gray-500">Volver</button> <button id="downloadClientsBtn" class="w-full px-6 py-3 bg-green-600 text-white rounded-lg shadow-md hover:bg-green-700 hidden">Descargar Lista</button> </div>
            </div> </div> </div>
        `;
        document.getElementById('backToDataMenuBtn').addEventListener('click', showDataView); 
        document.getElementById('downloadClientsBtn').addEventListener('click', handleDownloadFilteredClients);
        await loadAndRenderConsolidatedClients();
    }
    async function loadAndRenderConsolidatedClients() {
        const cont = document.getElementById('consolidated-clients-container'), filtCont = document.getElementById('consolidated-clients-filters'); if(!cont || !filtCont) return;
        try {
            const cliRef = _collection(_db, `artifacts/ventas-9a210/public/data/clientes`); const cliSnaps = await _getDocs(cliRef);
            _consolidatedClientsCache = cliSnaps.docs.map(d => ({id: d.id, ...d.data()}));
            filtCont.innerHTML = `<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 border rounded-lg bg-gray-50"> <input type="text" id="client-search-input" placeholder="Buscar..." class="md:col-span-2 w-full px-4 py-2 border rounded-lg text-sm"> <div> <label for="client-filter-sector" class="block text-xs mb-1">Sector</label> <select id="client-filter-sector" class="w-full px-2 py-1 border rounded-lg text-sm"><option value="">Todos</option></select> </div> <button id="clear-client-filters-btn" class="bg-gray-300 text-xs font-semibold text-gray-700 rounded-lg self-end py-1.5 px-3 hover:bg-gray-400 transition duration-150">Limpiar</button> </div>`;
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
    
    /**
     * [NUEVA FUNCIÓN DE EXPORTACIÓN CON EXCELJS]
     */
    async function handleDownloadFilteredClients() {
         if (typeof ExcelJS === 'undefined' || _filteredClientsCache.length === 0) { _showModal('Aviso', typeof ExcelJS === 'undefined'?'Librería ExcelJS no cargada.':'No hay clientes.'); return; }
        
        const dExport = _filteredClientsCache.map(c => ({
            'Sector':c.sector||'',
            'Nombre Comercial':c.nombreComercial||'',
            'Nombre Personal':c.nombrePersonal||'',
            'Telefono':c.telefono||'',
            'CEP':c.codigoCEP||'',
            'Coordenadas':c.coordenadas||''
        }));
        
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Clientes Consolidados');

        worksheet.columns = [
            { header: 'Sector', key: 'Sector', width: 20 },
            { header: 'Nombre Comercial', key: 'Nombre Comercial', width: 30 },
            { header: 'Nombre Personal', key: 'Nombre Personal', width: 30 },
            { header: 'Telefono', key: 'Telefono', width: 15 },
            { header: 'CEP', key: 'CEP', width: 15 },
            { header: 'Coordenadas', key: 'Coordenadas', width: 20 }
        ];
        worksheet.getRow(1).font = { bold: true };
        worksheet.addRows(dExport);

        const today = new Date().toISOString().slice(0, 10);
        const fileName = `Clientes_Consolidados_${today}.xlsx`;

        try {
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
        } catch (error) {
            console.error("Error al descargar clientes con ExcelJS:", error);
            _showModal('Error', 'No se pudo generar el archivo de clientes.');
        }
    }

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

    // --- MODIFICADO: createZoneEditor ahora incluye Tamaño de Letra ---
    function createZoneEditor(idPrefix, label, settings) {
        const s = settings; // 'settings' es el objeto de estilo (ej: s.styles.headerInfo)
        return `
        <div class="p-3 border rounded-lg bg-gray-50">
            <h4 class="font-semibold text-gray-700">${label}</h4>
            <div class="grid grid-cols-2 md:grid-cols-5 gap-3 mt-2 text-sm items-center">
                <label class="flex items-center space-x-2 cursor-pointer"><input type="checkbox" id="${idPrefix}_bold" ${s.bold ? 'checked' : ''} class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"><span>Negrita</span></label>
                <label class="flex items-center space-x-2 cursor-pointer"><input type="checkbox" id="${idPrefix}_border" ${s.border ? 'checked' : ''} class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"><span>Bordes</span></label>
                <label class="flex items-center space-x-2"><span>Fondo:</span><input type="color" id="${idPrefix}_fillColor" value="${s.fillColor || '#FFFFFF'}" class="h-6 w-10 border cursor-pointer p-0"></label>
                <label class="flex items-center space-x-2"><span>Texto:</span><input type="color" id="${idPrefix}_fontColor" value="${s.fontColor || '#000000'}" class="h-6 w-10 border cursor-pointer p-0"></label>
                <label class="flex items-center space-x-2"><span>Tamaño:</span><input type="number" id="${idPrefix}_fontSize" value="${s.fontSize || 10}" min="8" max="16" class="h-7 w-12 border cursor-pointer p-1 text-sm rounded-md"></label>
            </div>
        </div>`;
    }

    // --- MODIFICADO: createWidthEditor (NUEVA FUNCIÓN) ---
    // Función auxiliar para crear inputs de ancho
    function createWidthEditor(id, label, value) {
        return `
        <div class="flex items-center justify-between">
            <label for="${id}" class="text-sm font-medium text-gray-700">${label}:</label>
            <input type="number" id="${id}" value="${value}" min="5" max="50" step="1" class="w-20 px-2 py-1 border rounded-lg text-sm">
        </div>`;
    }

    // --- MODIFICADO: showReportDesignView ahora usa PESTAÑAS ---
    async function showReportDesignView() {
        if (_floatingControls) _floatingControls.classList.add('hidden');
        _mainContent.innerHTML = `
            <style>
                input[type="color"] { -webkit-appearance: none; -moz-appearance: none; appearance: none; background: none; border: 1px solid #ccc; padding: 0; }
                input[type="color"]::-webkit-color-swatch-wrapper { padding: 0; }
                input[type="color"]::-webkit-color-swatch { border: none; border-radius: 2px; }
                input[type="color"]::-moz-color-swatch { border: none; border-radius: 2px; }
                /* Estilos para pestañas */
                .design-tab-btn {
                    padding: 0.5rem 1rem;
                    cursor: pointer;
                    border: 1px solid transparent;
                    border-bottom: none;
                    margin-bottom: -1px;
                    background-color: #f9fafb; /* bg-gray-50 */
                    color: #6b7280; /* text-gray-500 */
                    border-radius: 0.375rem 0.375rem 0 0; /* rounded-t-md */
                }
                .design-tab-btn.active {
                    background-color: #ffffff; /* bg-white */
                    color: #3b82f6; /* text-blue-600 */
                    font-weight: 600; /* font-semibold */
                    border-color: #e5e7eb; /* border-gray-200 */
                }
            </style>
            <div class="p-4 pt-8">
                <div class="container mx-auto max-w-3xl">
                    <div class="bg-white/90 backdrop-blur-sm p-6 md:p-8 rounded-lg shadow-xl">
                        <h1 class="text-3xl font-bold text-gray-800 mb-6 text-center">Diseño de Reporte de Cierre</h1>
                        <p class="text-center text-gray-600 mb-6">Define los estilos visuales y la visibilidad de las secciones del reporte Excel.</p>
                        
                        <div id="design-loader" class="text-center text-gray-500 p-4">Cargando configuración...</div>
                        
                        <form id="design-form-container" class="hidden text-left">
                            
                            <!-- Contenedor de Pestañas -->
                            <div id="design-tabs" class="flex border-b border-gray-200 mb-4 overflow-x-auto text-sm">
                                <button type="button" class="design-tab-btn active" data-tab="general">General</button>
                                <button type="button" class="design-tab-btn" data-tab="rubro">Hoja Rubros</button>
                                <button type="button" class="design-tab-btn" data-tab="vacios">Hoja Vacíos</button>
                                <button type="button" class="design-tab-btn" data-tab="totales">Hoja Totales</button>
                            </div>

                            <!-- Contenido de Pestañas -->
                            <div id="design-tab-content" class="space-y-6">

                                <!-- Pestaña General (Visibilidad) -->
                                <div id="tab-content-general" class="space-y-4">
                                    <h3 class="text-lg font-semibold border-b pb-2 mt-4">Visibilidad de Secciones</h3>
                                    <div class="space-y-2 mt-4">
                                        <label class="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100 cursor-pointer">
                                            <input type="checkbox" id="chk_showCargaInicial" class="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500">
                                            <span>Mostrar fila "CARGA INICIAL" (en Hojas Rubro)</span>
                                        </label>
                                        <label class="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100 cursor-pointer">
                                            <input type="checkbox" id="chk_showCargaRestante" class="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500">
                                            <span>Mostrar fila "CARGA RESTANTE" (en Hojas Rubro)</span>
                                        </label>
                                        <label class="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100 cursor-pointer">
                                            <input type="checkbox" id="chk_showVaciosSheet" class="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500">
                                            <span>Incluir hoja "Reporte Vacíos"</span>
                                        </label>
                                        <label class="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100 cursor-pointer">
                                            <input type="checkbox" id="chk_showClienteTotalSheet" class="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500">
                                            <span>Incluir hoja "Total Por Cliente"</span>
                                        </label>
                                    </div>
                                </div>

                                <!-- Pestaña Hoja Rubros (Estilos y Anchos) -->
                                <div id="tab-content-rubro" class="space-y-6 hidden">
                                    <h3 class="text-lg font-semibold border-b pb-2">Ancho de Columnas (Hoja Rubros)</h3>
                                    <!-- CORREGIDO: Contenedor vacío -->
                                    <div id="rubro-widths-container" class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 mt-4 text-sm">
                                        <p>Cargando anchos...</p>
                                    </div>
                                    <h3 class="text-lg font-semibold border-b pb-2 mt-4">Estilos de Zonas (Hoja Rubros)</h3>
                                    <!-- CORREGIDO: Contenedor vacío -->
                                    <div id="style-zones-container" class="space-y-3 mt-4">
                                        <p>Cargando estilos...</p>
                                    </div>
                                </div>

                                <!-- Pestaña Hoja Vacíos (Anchos) -->
                                <div id="tab-content-vacios" class="space-y-6 hidden">
                                    <h3 class="text-lg font-semibold border-b pb-2">Ancho de Columnas (Hoja Vacíos)</h3>
                                    <!-- CORREGIDO: Contenedor vacío -->
                                    <div id="vacios-widths-container" class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 mt-4 text-sm">
                                        <p>Cargando anchos...</p>
                                    </div>
                                    <!-- --- AÑADIDO: Contenedor de Estilos Hoja Vacíos --- -->
                                    <h3 class="text-lg font-semibold border-b pb-2 mt-4">Estilos de Zonas (Hoja Vacíos)</h3>
                                    <div id="vacios-styles-container" class="space-y-3 mt-4">
                                        <p>Cargando estilos...</p>
                                    </div>
                                </div>

                                <!-- Pestaña Hoja Totales (Anchos) -->
                                <div id="tab-content-totales" class="space-y-6 hidden">
                                    <h3 class="text-lg font-semibold border-b pb-2">Ancho de Columnas (Hoja Totales)</h3>
                                    <!-- CORREGIDO: Contenedor vacío -->
                                    <div id="totales-widths-container" class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 mt-4 text-sm">
                                        <p>Cargando anchos...</p>
                                    </div>
                                    <!-- --- AÑADIDO: Contenedor de Estilos Hoja Totales --- -->
                                    <h3 class="text-lg font-semibold border-b pb-2 mt-4">Estilos de Zonas (Hoja Totales)</h3>
                                    <div id="totales-styles-container" class="space-y-3 mt-4">
                                        <p>Cargando estilos...</p>
                                    </div>
                                </div>

                            </div>

                            <!-- Botones de Acción -->
                            <div class="flex flex-col sm:flex-row gap-4 pt-6 mt-6 border-t">
                                <button type="button" id="saveDesignBtn" class="w-full px-6 py-3 bg-green-500 text-white font-semibold rounded-lg shadow-md hover:bg-green-600">Guardar Diseño</button>
                                <button type="button" id="backToDataMenuBtn" class="w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('backToDataMenuBtn').addEventListener('click', showDataView);
        document.getElementById('saveDesignBtn').addEventListener('click', handleSaveReportDesign);

        // --- Lógica de Pestañas ---
        const tabsContainer = document.getElementById('design-tabs');
        const tabContents = document.querySelectorAll('#design-tab-content > div');
        tabsContainer.addEventListener('click', (e) => {
            const clickedTab = e.target.closest('.design-tab-btn');
            if (!clickedTab) return;

            const tabId = clickedTab.dataset.tab;
            
            // Actualizar botones
            tabsContainer.querySelectorAll('.design-tab-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            clickedTab.classList.add('active');
            
            // Actualizar contenido
            tabContents.forEach(content => {
                if (content.id === `tab-content-${tabId}`) {
                    content.classList.remove('hidden');
                } else {
                    content.classList.add('hidden');
                }
            });
        });

        // --- Carga de Datos ---
        const loader = document.getElementById('design-loader');
        const formContainer = document.getElementById('design-form-container');
        
        try {
            const REPORTE_DESIGN_PATH = `artifacts/${_appId}/users/${_userId}/${REPORTE_DESIGN_CONFIG_PATH}`;
            const docRef = _doc(_db, REPORTE_DESIGN_PATH);
            const docSnap = await _getDoc(docRef);
            
            let currentSettings = JSON.parse(JSON.stringify(DEFAULT_REPORTE_SETTINGS)); // Copia profunda
            if (docSnap.exists()) {
                const savedSettings = docSnap.data();
                currentSettings = { ...currentSettings, ...savedSettings };
                currentSettings.styles = { ...DEFAULT_REPORTE_SETTINGS.styles, ...(savedSettings.styles || {}) };
                currentSettings.columnWidths = { ...DEFAULT_REPORTE_SETTINGS.columnWidths, ...(savedSettings.columnWidths || {}) };
            }

            // Poblar Pestaña General (Visibilidad)
            document.getElementById('chk_showCargaInicial').checked = currentSettings.showCargaInicial;
            document.getElementById('chk_showCargaRestante').checked = currentSettings.showCargaRestante;
            document.getElementById('chk_showVaciosSheet').checked = currentSettings.showVaciosSheet;
            document.getElementById('chk_showClienteTotalSheet').checked = currentSettings.showClienteTotalSheet;

            // Poblar Pestaña Hoja Rubros (Estilos y Anchos)
            const s = currentSettings.styles;
            // --- CORRECCIÓN: Apuntar al contenedor correcto ---
            document.getElementById('style-zones-container').innerHTML = `
                ${createZoneEditor('headerInfo', 'Info (Fecha/Usuario)', s.headerInfo)}
                ${createZoneEditor('headerProducts', 'Cabecera Productos', s.headerProducts)}
                ${createZoneEditor('rowCargaInicial', 'Fila "CARGA INICIAL"', s.rowCargaInicial)}
                ${createZoneEditor('rowDataClients', 'Filas Clientes (Celdas Vacías)', s.rowDataClients)}
                ${createZoneEditor('rowDataClientsSale', 'Filas Clientes (Venta > 0)', s.rowDataClientsSale)} 
                ${createZoneEditor('rowCargaRestante', 'Fila "CARGA RESTANTE"', s.rowCargaRestante)}
                ${createZoneEditor('rowTotals', 'Fila "TOTALES"', s.rowTotals)}
            `;
            const w = currentSettings.columnWidths;
            // --- CORRECCIÓN: Poblar el contenedor de anchos de rubro ---
            document.getElementById('rubro-widths-container').innerHTML = `
                ${createWidthEditor('width_info', 'Info (Fecha/Usuario)', w.info)}
                ${createWidthEditor('width_labels', 'Etiquetas (Cliente, Carga)', w.labels)}
                ${createWidthEditor('width_products', 'Productos (Default)', w.products)}
                ${createWidthEditor('width_subtotal', 'Sub Total', w.subtotal)}
            `;

            // Poblar Pestaña Hoja Vacíos (Anchos)
            // --- CORRECCIÓN: Poblar el contenedor de anchos de vacíos ---
            document.getElementById('vacios-widths-container').innerHTML = `
                ${createWidthEditor('width_vaciosCliente', 'Cliente', w.vaciosCliente)}
                ${createWidthEditor('width_vaciosTipo', 'Tipo Vacío', w.vaciosTipo)}
                ${createWidthEditor('width_vaciosQty', 'Cantidades (Ent/Dev/Neto)', w.vaciosQty)}
                <div></div> <!-- Placeholder for grid -->
            `;
            // --- AÑADIDO: Poblar estilos Hoja Vacíos ---
            document.getElementById('vacios-styles-container').innerHTML = `
                ${createZoneEditor('vaciosHeader', 'Cabecera (Cliente, Tipo, etc.)', s.vaciosHeader)}
                ${createZoneEditor('vaciosData', 'Filas de Datos', s.vaciosData)}
            `;

            // Poblar Pestaña Hoja Totales (Anchos)
            // --- CORRECCIÓN: Poblar el contenedor de anchos de totales ---
            document.getElementById('totales-widths-container').innerHTML = `
                ${createWidthEditor('width_totalCliente', 'Cliente', w.totalCliente)}
                ${createWidthEditor('width_totalClienteValor', 'Gasto Total', w.totalClienteValor)}
            `;
            // --- AÑADIDO: Poblar estilos Hoja Totales ---
            document.getElementById('totales-styles-container').innerHTML = `
                ${createZoneEditor('totalesHeader', 'Cabecera (Cliente, Gasto)', s.totalesHeader)}
                ${createZoneEditor('totalesData', 'Filas de Clientes', s.totalesData)}
                ${createZoneEditor('totalesTotalRow', 'Fila "GRAN TOTAL"', s.totalesTotalRow)}
            `;

            loader.classList.add('hidden');
            formContainer.classList.remove('hidden');

        } catch (error) {
            console.error("Error cargando diseño:", error);
            loader.textContent = 'Error al cargar la configuración.';
            _showModal('Error', `No se pudo cargar la configuración: ${error.message}`);
        }
    }

    // --- MODIFICADO: readZoneEditor ahora es más robusto ---
    function readZoneEditor(idPrefix) {
        const boldEl = document.getElementById(`${idPrefix}_bold`);
        const borderEl = document.getElementById(`${idPrefix}_border`);
        const fillColorEl = document.getElementById(`${idPrefix}_fillColor`);
        const fontColorEl = document.getElementById(`${idPrefix}_fontColor`);
        const fontSizeEl = document.getElementById(`${idPrefix}_fontSize`); // AÑADIDO

        // Usar valores por defecto si los elementos no se encuentran
        const defaults = DEFAULT_REPORTE_SETTINGS.styles[idPrefix] || 
                         (idPrefix === 'rowDataClientsSale' ? DEFAULT_REPORTE_SETTINGS.styles.rowDataClients : 
                         (DEFAULT_REPORTE_SETTINGS.styles[idPrefix] || {})); // Fallback genérico

        return {
            bold: boldEl ? boldEl.checked : (defaults.bold || false),
            border: borderEl ? borderEl.checked : (defaults.border || false),
            fillColor: fillColorEl ? fillColorEl.value : (defaults.fillColor || '#FFFFFF'),
            fontColor: fontColorEl ? fontColorEl.value : (defaults.fontColor || '#000000'),
            fontSize: fontSizeEl ? (parseInt(fontSizeEl.value, 10) || 10) : (defaults.fontSize || 10) // AÑADIDO
        };
    }

    // --- NUEVO: readWidthInputs ---
    function readWidthInputs() {
        const defaults = DEFAULT_REPORTE_SETTINGS.columnWidths;
        const readVal = (id, def) => parseInt(document.getElementById(id)?.value, 10) || def;
        
        return {
            info: readVal('width_info', defaults.info),
            labels: readVal('width_labels', defaults.labels),
            products: readVal('width_products', defaults.products),
            subtotal: readVal('width_subtotal', defaults.subtotal),
            vaciosCliente: readVal('width_vaciosCliente', defaults.vaciosCliente),
            vaciosTipo: readVal('width_vaciosTipo', defaults.vaciosTipo),
            vaciosQty: readVal('width_vaciosQty', defaults.vaciosQty),
            totalCliente: readVal('width_totalCliente', defaults.totalCliente),
            totalClienteValor: readVal('width_totalClienteValor', defaults.totalClienteValor)
        };
    }

    async function handleSaveReportDesign() {
        _showModal('Progreso', 'Guardando diseño...');

        const newSettings = {
            showCargaInicial: document.getElementById('chk_showCargaInicial').checked,
            showCargaRestante: document.getElementById('chk_showCargaRestante').checked,
            showVaciosSheet: document.getElementById('chk_showVaciosSheet').checked,
            showClienteTotalSheet: document.getElementById('chk_showClienteTotalSheet').checked,
            // --- MODIFICADO: Leer estilos y anchos ---
            styles: {
                headerInfo: readZoneEditor('headerInfo'),
                headerProducts: readZoneEditor('headerProducts'),
                rowCargaInicial: readZoneEditor('rowCargaInicial'),
                rowDataClients: readZoneEditor('rowDataClients'),
                rowDataClientsSale: readZoneEditor('rowDataClientsSale'), // NUEVO
                rowCargaRestante: readZoneEditor('rowCargaRestante'),
                rowTotals: readZoneEditor('rowTotals'),
                // --- AÑADIDO: Lectura de nuevos estilos ---
                vaciosHeader: readZoneEditor('vaciosHeader'),
                vaciosData: readZoneEditor('vaciosData'),
                totalesHeader: readZoneEditor('totalesHeader'),
                totalesData: readZoneEditor('totalesData'),
                totalesTotalRow: readZoneEditor('totalesTotalRow')
            },
            columnWidths: readWidthInputs() // NUEVO
            // --- FIN MODIFICADO ---
        };

        try {
            const REPORTE_DESIGN_PATH = `artifacts/${_appId}/users/${_userId}/${REPORTE_DESIGN_CONFIG_PATH}`;
            const docRef = _doc(_db, REPORTE_DESIGN_PATH);
            await _setDoc(docRef, newSettings); // _setDoc sobrescribe, lo cual está bien aquí
            _showModal('Éxito', 'Diseño guardado correctamente.', showDataView); 
        } catch (error) {
            console.error("Error guardando diseño:", error);
            _showModal('Error', `No se pudo guardar: ${error.message}`);
        }
    }

    async function getGlobalProductSortFunction() {
        if (!_sortPreferenceCache) {
            try { 
                // --- CORRECCIÓN: 'SORT_CONFIG_PATH' se movió al inicio del archivo ---
                const dRef=_doc(_db, `artifacts/${_appId}/users/${_userId}/${SORT_CONFIG_PATH}`); 
                const dSnap=await _getDoc(dRef); 
                if(dSnap.exists()&&dSnap.data().order){ 
                    _sortPreferenceCache=dSnap.data().order; 
                    const expKeys=new Set(['rubro','segmento','marca','presentacion']); 
                    if(_sortPreferenceCache.length!==expKeys.size||!_sortPreferenceCache.every(k=>expKeys.has(k))){_sortPreferenceCache=['segmento','marca','presentacion','rubro'];} 
                } else {_sortPreferenceCache=['segmento','marca','presentacion','rubro'];} 
            }
            catch (error) { console.error("Error cargando pref orden:", error); _sortPreferenceCache=['segmento','marca','presentacion','rubro']; }
        }
        if (!_rubroOrderMapCache) { _rubroOrderMapCache={}; try { const rRef=_collection(_db, `artifacts/${_appId}/users/${_userId}/rubros`); const snap=await _getDocs(rRef); snap.docs.forEach(d=>{const data=d.data(); _rubroOrderMapCache[data.name]=data.orden??9999;}); } catch (e) { console.warn("No se pudo obtener orden rubros.", e); } }
        if (!_segmentoOrderMapCache) { _segmentoOrderMapCache={}; try { const sRef=_collection(_db, `artifacts/${_appId}/users/${_userId}/segmentos`); const snap=await _getDocs(sRef); snap.docs.forEach(d=>{const data=d.data(); _segmentoOrderMapCache[data.name]=data.orden??9999;}); } catch (e) { console.warn("No se pudo obtener orden segmentos.", e); } }
        return (a, b) => {
            for (const key of _sortPreferenceCache) { let valA, valB, compRes = 0;
                switch (key) {
                    case 'rubro': valA=_rubroOrderMapCache[a.rubro]??9999; valB=_rubroOrderMapCache[b.rubro]??9999; compRes=valA-valB; if(compRes===0)compRes=(a.rubro||'').localeCompare(b.rubro||''); break;
                    case 'segmento': valA=_segmentoOrderMapCache[a.segmento]??9999; valB=_segmentoOrderMapCache[b.segmento]??9999; compRes=valA-valB; if(compRes===0)compRes=(a.segmento||'').localeCompare(b.segmento||''); break;
                    case 'marca': valA=a.marca||''; valB=b.marca||''; compRes=valA.localeCompare(valB); break;
                    case 'presentacion': valA=a.presentacion||''; valB=b.presentacion||''; compRes=valA.localeCompare(valB); break;
                } if (compRes !== 0) return compRes;
            } return 0;
        };
    };

    window.dataModule = { 
        showClosingDetail, 
        handleDownloadSingleClosing 
    };

})();
