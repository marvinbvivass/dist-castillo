// --- Lógica del módulo de Data (solo para Admins) ---

(function() {
    // Variables locales del módulo
    let _db, _appId, _userId, _mainContent, _floatingControls, _showMainMenu, _showModal;
    let _collection, _getDocs, _query, _where, _orderBy, _populateDropdown;

    let _lastStatsData = [];
    let _lastNumWeeks = 1;
    let _consolidatedClientsCache = [];
    let _filteredClientsCache = [];

    // ELIMINADO: Cachés de ordenamiento duplicadas
    // let _segmentoOrderCacheData = null;
    // let _rubroOrderCacheData = null;

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

    // --- Lógica de Reporte (adaptada) ---

    // MODIFICADO: Funciones de orden ahora locales dentro de processSalesDataForReport
    async function processSalesDataForReport(ventas, userIdForInventario) {
        // --- NUEVO: Funciones locales para obtener mapas de orden SOLO para este reporte ---
        async function getRubroOrderMapLocal() {
            const map = {};
            // Usa el _userId del admin actual para leer su configuración de rubros
            const rubrosRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/rubros`);
            try {
                const snapshot = await _getDocs(rubrosRef);
                snapshot.docs.forEach(doc => { map[doc.data().name] = doc.data().orden ?? 9999; });
            } catch (e) { console.warn("Reporte (Data): No se pudo obtener orden de rubros.", e); }
            return map;
        }
        async function getSegmentoOrderMapLocal() {
            const map = {};
            // Usa el _userId del admin actual para leer su configuración de segmentos
            const segmentosRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/segmentos`);
            try {
                const snapshot = await _getDocs(segmentosRef);
                snapshot.docs.forEach(doc => { map[doc.data().name] = doc.data().orden ?? 9999; });
            } catch (e) { console.warn("Reporte (Data): No se pudo obtener orden de segmentos.", e); }
            return map;
        }
        // --- FIN NUEVO ---

        const clientData = {};
        let grandTotalValue = 0;
        const allProductsMap = new Map();
        const vaciosMovementsPorTipo = {};

        // Usa el inventario del VENDEDOR específico (userIdForInventario)
        const inventarioRef = _collection(_db, `artifacts/${_appId}/users/${userIdForInventario}/inventario`);
        const inventarioSnapshot = await _getDocs(inventarioRef);
        const inventarioMap = new Map(inventarioSnapshot.docs.map(doc => [doc.id, doc.data()]));

        ventas.forEach(venta => {
            const clientName = venta.clienteNombre || 'Cliente Desconocido';
            if (!clientData[clientName]) clientData[clientName] = { products: {}, totalValue: 0 };
            if (!vaciosMovementsPorTipo[clientName]) { vaciosMovementsPorTipo[clientName] = {}; window.TIPOS_VACIO_GLOBAL?.forEach(tipo => vaciosMovementsPorTipo[clientName][tipo] = { entregados: 0, devueltos: 0 }); }
            clientData[clientName].totalValue += (venta.total || 0);
            grandTotalValue += (venta.total || 0);
            const vaciosDev = venta.vaciosDevueltosPorTipo || {};
            for (const tipo in vaciosDev) { if (!vaciosMovementsPorTipo[clientName][tipo]) vaciosMovementsPorTipo[clientName][tipo] = { entregados: 0, devueltos: 0 }; vaciosMovementsPorTipo[clientName][tipo].devueltos += (vaciosDev[tipo] || 0); }
            (venta.productos || []).forEach(p => {
                 const prodComp = inventarioMap.get(p.id) || p;
                 if (prodComp.manejaVacios && prodComp.tipoVacio) { const tipoV = prodComp.tipoVacio; if (!vaciosMovementsPorTipo[clientName][tipoV]) vaciosMovementsPorTipo[clientName][tipoV] = { entregados: 0, devueltos: 0 }; vaciosMovementsPorTipo[clientName][tipoV].entregados += p.cantidadVendida?.cj || 0; }
                 const rubro = prodComp.rubro || 'Sin Rubro', seg = prodComp.segmento || 'Sin Segmento', marca = prodComp.marca || 'Sin Marca';
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
                    const sortedPres = groupedProducts[rubro][segmento][marca].sort((a,b) => (a.presentacion||'').localeCompare(b.presentacion||''));
                    finalProductOrder.push(...sortedPres);
                });
            });
        });
        return { clientData, grandTotalValue, sortedClients, groupedProducts, finalProductOrder, sortedRubros, segmentoOrderMap, vaciosMovementsPorTipo, allProductsMap };
    }

    async function showClosingDetail(closingId) {
        const closingData = window.tempClosingsData?.find(c => c.id === closingId);
        if (!closingData) { _showModal('Error', 'No se cargaron detalles.'); return; }
        _showModal('Progreso', 'Generando reporte detallado...');
        try {
            // Usa el ID del vendedor del cierre para obtener su inventario
            const { clientData, grandTotalValue, sortedClients, groupedProducts, finalProductOrder, sortedRubros, segmentoOrderMap, vaciosMovementsPorTipo, allProductsMap } = await processSalesDataForReport(closingData.ventas, closingData.vendedorInfo.userId);

            let h1=`<tr><th rowspan="4">Cliente</th>`, h2=`<tr>`, h3=`<tr>`, h4=`<tr>`; // Headers
            sortedRubros.forEach(rubro => {
                let rSpan=0; const segs=Object.keys(groupedProducts[rubro]).sort((a,b)=>(segmentoOrderMap[a]??999)-(segmentoOrderMap[b]??999));
                segs.forEach(seg => { const marcas=Object.keys(groupedProducts[rubro][seg]).sort(); marcas.forEach(marca => { rSpan+=groupedProducts[rubro][seg][marca].length; }); });
                h1+=`<th colspan="${rSpan}">${rubro}</th>`;
                segs.forEach(seg => {
                    let sSpan=0; const marcas=Object.keys(groupedProducts[rubro][seg]).sort();
                    marcas.forEach(marca => { sSpan+=groupedProducts[rubro][seg][marca].length; });
                    h2+=`<th colspan="${sSpan}">${seg}</th>`;
                    marcas.forEach(marca => {
                        const mSpan=groupedProducts[rubro][seg][marca].length; h3+=`<th colspan="${mSpan}">${marca}</th>`;
                        const pres=groupedProducts[rubro][seg][marca].sort((a,b)=>(a.presentacion||'').localeCompare(b.presentacion||''));
                        pres.forEach(p => h4+=`<th>${p.presentacion}</th>`);
                    });
                });
            });
            h1+=`<th rowspan="4">Total</th></tr>`; h2+=`</tr>`; h3+=`</tr>`; h4+=`</tr>`;

            let bodyHTML = ''; // Body rows
            sortedClients.forEach(cli => {
                bodyHTML += `<tr><td>${cli}</td>`; const curCli = clientData[cli];
                finalProductOrder.forEach(p => {
                    const qtyU = curCli.products[p.id]||0; let dispQty='';
                    if(qtyU>0){ dispQty=`${qtyU} Unds`; const vPor=p.ventaPor||{}, uCj=p.unidadesPorCaja||1, uPaq=p.unidadesPorPaquete||1;
                        if(vPor.cj&&!vPor.paq&&!vPor.und&&uCj>0&&Number.isInteger(qtyU/uCj)) dispQty=`${qtyU/uCj} Cj`;
                        else if(vPor.paq&&!vPor.cj&&!vPor.und&&uPaq>0&&Number.isInteger(qtyU/uPaq)) dispQty=`${qtyU/uPaq} Paq`; }
                    bodyHTML+=`<td class="text-center">${dispQty}</td>`;
                }); bodyHTML+=`<td class="text-right font-semibold">$${curCli.totalValue.toFixed(2)}</td></tr>`;
            });

            let footerHTML = '<tr><td>TOTALES</td>'; // Footer row
            finalProductOrder.forEach(p => {
                let totQty=0; sortedClients.forEach(cli => totQty+=clientData[cli].products[p.id]||0); let dispTot='';
                if(totQty>0){ dispTot=`${totQty} Unds`; const vPor=p.ventaPor||{}, uCj=p.unidadesPorCaja||1, uPaq=p.unidadesPorPaquete||1;
                    if(vPor.cj&&!vPor.paq&&!vPor.und&&uCj>0&&Number.isInteger(totQty/uCj)) dispTot=`${totQty/uCj} Cj`;
                    else if(vPor.paq&&!vPor.cj&&!vPor.und&&uPaq>0&&Number.isInteger(totQty/uPaq)) dispTot=`${totQty/uPaq} Paq`; }
                footerHTML+=`<td class="text-center">${dispTot}</td>`;
            }); footerHTML+=`<td class="text-right">$${grandTotalValue.toFixed(2)}</td></tr>`;

            let vaciosHTML = ''; // Empties report
            const TIPOS_VACIO_GLOBAL = ["1/4 - 1/3", "ret 350 ml", "ret 1.25 Lts"];
            const cliVacios=Object.keys(vaciosMovementsPorTipo).filter(cli=>TIPOS_VACIO_GLOBAL.some(t=>(vaciosMovementsPorTipo[cli][t]?.entregados||0)>0||(vaciosMovementsPorTipo[cli][t]?.devueltos||0)>0)).sort();
            if(cliVacios.length>0){ vaciosHTML=`<h3 class="text-xl my-6">Reporte Vacíos</h3><div class="overflow-auto border"><table><thead><tr><th>Cliente</th><th>Tipo</th><th>Entregados</th><th>Devueltos</th><th>Neto</th></tr></thead><tbody>`;
                cliVacios.forEach(cli=>{ const movs=vaciosMovementsPorTipo[cli]; TIPOS_VACIO_GLOBAL.forEach(t=>{ const mov=movs[t]||{e:0,d:0}; if(mov.entregados>0||mov.devueltos>0){ const neto=mov.entregados-mov.devueltos; const nClass=neto>0?'text-red-600':(neto<0?'text-green-600':''); vaciosHTML+=`<tr><td>${cli}</td><td>${t}</td><td>${mov.entregados}</td><td>${mov.devueltos}</td><td class="${nClass}">${neto>0?`+${neto}`:neto}</td></tr>`; } }); });
                vaciosHTML+='</tbody></table></div>'; }

            const vendedor = closingData.vendedorInfo || {}; // Final modal HTML
            const reportHTML = `<div class="text-left max-h-[80vh] overflow-auto"> <div class="mb-4"> <p><strong>Vendedor:</strong> ${vendedor.nombre||''} ${vendedor.apellido||''}</p> <p><strong>Camión:</strong> ${vendedor.camion||'N/A'}</p> <p><strong>Fecha:</strong> ${closingData.fecha.toDate().toLocaleString('es-ES')}</p> </div> <h3 class="text-xl mb-4">Reporte Cierre</h3> <div class="overflow-auto border" style="max-height: 40vh;"> <table class="min-w-full bg-white text-xs"> <thead class="bg-gray-200">${h1}${h2}${h3}${h4}</thead> <tbody>${bodyHTML}</tbody> <tfoot>${footerHTML}</tfoot> </table> </div> ${vaciosHTML} </div>`;
            _showModal(`Detalle Cierre`, reportHTML, null, 'Cerrar');
        } catch (error) { console.error("Error generando detalle:", error); _showModal('Error', `No se pudo generar: ${error.message}`); }
    }

    async function exportSingleClosingToExcel(closingData) {
        if (typeof XLSX === 'undefined') { _showModal('Error', 'Librería Excel no cargada.'); return; }
        // Usa el ID del vendedor para obtener su inventario
        const { clientData, grandTotalValue, sortedClients, groupedProducts, finalProductOrder, sortedRubros, segmentoOrderMap, vaciosMovementsPorTipo, allProductsMap } = await processSalesDataForReport(closingData.ventas, closingData.vendedorInfo.userId);

        const dSheet1=[], merges1=[]; let h1=[""], h2=[""], h3=[""], h4=["Cliente"]; let col=1; // Sheet 1 Data
        sortedRubros.forEach(r => { const rStart=col; let rSpan=0; const segs=Object.keys(groupedProducts[r]).sort((a,b)=>(segmentoOrderMap[a]??999)-(segmentoOrderMap[b]??999));
            segs.forEach(s => { const sStart=col; let sSpan=0; const marcas=Object.keys(groupedProducts[r][s]).sort();
                marcas.forEach(m => { const mStart=col; const pres=groupedProducts[r][s][m].sort((a,b)=>(a.presentacion||'').localeCompare(b.presentacion||'')); const mSpan=pres.length; rSpan+=mSpan; sSpan+=mSpan;
                    h3.push(m); for(let i=1;i<mSpan;i++)h3.push(""); if(mSpan>1)merges1.push({s:{r:2,c:mStart},e:{r:2,c:mStart+mSpan-1}});
                    pres.forEach(p=>h4.push(p.presentacion||'N/A')); col+=mSpan; });
                h2.push(s); for(let i=1;i<sSpan;i++)h2.push(""); if(sSpan>1)merges1.push({s:{r:1,c:sStart},e:{r:1,c:sStart+sSpan-1}}); });
            h1.push(r); for(let i=1;i<rSpan;i++)h1.push(""); if(rSpan>1)merges1.push({s:{r:0,c:rStart},e:{r:0,c:rStart+rSpan-1}}); });
        h1.push(""); h2.push(""); h3.push(""); h4.push("Total Cliente"); dSheet1.push(h1,h2,h3,h4);
        merges1.push({s:{r:0,c:0},e:{r:3,c:0}}); merges1.push({s:{r:0,c:finalProductOrder.length+1},e:{r:3,c:finalProductOrder.length+1}});

        sortedClients.forEach(cli => { // Body data
            const row=[cli]; const curCli=clientData[cli];
            finalProductOrder.forEach(p => { const qtyU=curCli.products[p.id]||0; let dispQty=''; if(qtyU>0){ dispQty=`${qtyU} Unds`; const vPor=p.ventaPor||{}, uCj=p.unidadesPorCaja||1, uPaq=p.unidadesPorPaquete||1; if(vPor.cj&&!vPor.paq&&!vPor.und&&uCj>0&&Number.isInteger(qtyU/uCj)) dispQty=`${qtyU/uCj} Cj`; else if(vPor.paq&&!vPor.cj&&!vPor.und&&uPaq>0&&Number.isInteger(qtyU/uPaq)) dispQty=`${qtyU/uPaq} Paq`; } row.push(dispQty); });
            row.push(Number(curCli.totalValue.toFixed(2))); dSheet1.push(row); });

        const fRow=["TOTALES"]; // Footer data
        finalProductOrder.forEach(p=>{ let totQty=0; sortedClients.forEach(cli=>totQty+=clientData[cli].products[p.id]||0); let dispTot=''; if(totQty>0){ dispTot=`${totQty} Unds`; const vPor=p.ventaPor||{}, uCj=p.unidadesPorCaja||1, uPaq=p.unidadesPorPaquete||1; if(vPor.cj&&!vPor.paq&&!vPor.und&&uCj>0&&Number.isInteger(totQty/uCj)) dispTot=`${totQty/uCj} Cj`; else if(vPor.paq&&!vPor.cj&&!vPor.und&&uPaq>0&&Number.isInteger(totQty/uPaq)) dispTot=`${totQty/uPaq} Paq`; } fRow.push(dispTot); });
        fRow.push(Number(grandTotalValue.toFixed(2))); dSheet1.push(fRow);
        const ws1 = XLSX.utils.aoa_to_sheet(dSheet1); ws1['!merges'] = merges1;

        const TIPOS_VACIO_GLOBAL = ["1/4 - 1/3", "ret 350 ml", "ret 1.25 Lts"]; // Sheet 2 Data (Vacíos)
        const cliVacios=Object.keys(vaciosMovementsPorTipo).filter(cli=>TIPOS_VACIO_GLOBAL.some(t=>(vaciosMovementsPorTipo[cli][t]?.entregados||0)>0||(vaciosMovementsPorTipo[cli][t]?.devueltos||0)>0)).sort();
        const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws1, 'Reporte Cierre');
        if (cliVacios.length > 0) { const dSheet2=[['Cliente','Tipo Vacío','Entregados','Devueltos','Neto']];
            cliVacios.forEach(cli => { const movs=vaciosMovementsPorTipo[cli]; TIPOS_VACIO_GLOBAL.forEach(t => { const mov=movs[t]||{e:0,d:0}; if(mov.entregados>0||mov.devueltos>0) dSheet2.push([cli,t,mov.entregados,mov.devueltos,mov.entregados-mov.devueltos]); }); });
            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dSheet2), 'Reporte Vacíos'); }

        const vendedor = closingData.vendedorInfo || {}; const fecha = closingData.fecha.toDate().toISOString().slice(0, 10);
        const vendNombre = (vendedor.nombre || 'Vendedor').replace(/\s/g, '_');
        XLSX.writeFile(wb, `Cierre_${vendNombre}_${fecha}.xlsx`);
    }

    async function handleDownloadSingleClosing(closingId) {
        const closingData = window.tempClosingsData?.find(c => c.id === closingId);
        if (!closingData) { _showModal('Error', 'Datos no encontrados.'); return; }
        _showModal('Progreso', 'Generando Excel...');
        try {
            await exportSingleClosingToExcel(closingData);
             const modalContainer = document.getElementById('modalContainer'); // Cerrar progreso
             if(modalContainer && !modalContainer.classList.contains('hidden') && modalContainer.querySelector('h3')?.textContent.startsWith('Progreso')) { modalContainer.classList.add('hidden'); }
        } catch (error) { console.error("Error exportando:", error); _showModal('Error', `Error: ${error.message}`); }
    }

    // --- Lógica de Estadísticas (sin cambios en ordenamiento) ---
    function showProductStatsView() { /* ... código sin cambios ... */ }
    async function handleSearchStats() { /* ... código sin cambios ... */ }
    function renderStatsList(productArray, statsType, numWeeks = 1) { /* ... código sin cambios ... */ }
    function handleDownloadStats() { /* ... código sin cambios ... */ }

    // --- Lógica de Clientes Consolidados (sin cambios en ordenamiento) ---
    async function showConsolidatedClientsView() { /* ... código sin cambios ... */ }
    async function loadAndRenderConsolidatedClients() { /* ... código sin cambios ... */ }
    function renderConsolidatedClientsList() { /* ... código sin cambios ... */ }
    function handleDownloadFilteredClients() { /* ... código sin cambios ... */ }

    // --- Lógica del Mapa (sin cambios en ordenamiento) ---
    function showClientMapView() { /* ... código sin cambios ... */ }
    async function loadAndDisplayMap() { /* ... código sin cambios ... */ }
    function setupMapSearch(clientsWithCoords) { /* ... código sin cambios ... */ }

    // Exponer funciones públicas
    window.dataModule = { showClosingDetail, handleDownloadSingleClosing };

})();
