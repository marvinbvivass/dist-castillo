(function() {
    let _db, _userId, _userRole, _appId, _mainContent, _floatingControls;
    let _showMainMenu, _showModal, _activeListeners;
    let _collection, _onSnapshot, _doc, _getDoc, _addDoc, _setDoc, _deleteDoc, _getDocs, _writeBatch, _runTransaction, _query, _where;

    let _clientesCache = [];
    let _inventarioCache = [];
    let _ventasGlobal = [];
    let _ventaActual = { cliente: null, productos: {}, vaciosDevueltosPorTipo: {} };
    let _originalVentaForEdit = null;
    let _tasaCOP = 0;
    let _tasaBs = 0;
    let _monedaActual = 'USD';

    // Asume que TIPOS_VACIO_GLOBAL se define o está disponible globalmente
    // Usaremos window.TIPOS_VACIO_GLOBAL si existe, o un default
    const TIPOS_VACIO = window.TIPOS_VACIO_GLOBAL || ["1/4 - 1/3", "ret 350 ml", "ret 1.25 Lts"];

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
            <div class="p-4 pt-8"> <div class="container mx-auto"> <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl text-center">
                <h1 class="text-3xl font-bold text-gray-800 mb-6">Gestión de Ventas</h1>
                <div class="space-y-4">
                    <button id="nuevaVentaBtn" class="w-full px-6 py-3 bg-green-500 text-white rounded-lg shadow-md hover:bg-green-600">Nueva Venta</button>
                    <button id="ventasTotalesBtn" class="w-full px-6 py-3 bg-blue-500 text-white rounded-lg shadow-md hover:bg-blue-600">Ventas Totales</button>
                    <button id="backToMenuBtn" class="w-full px-6 py-3 bg-gray-400 text-white rounded-lg shadow-md hover:bg-gray-500">Volver</button>
                </div>
            </div> </div> </div>
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
            <div class="p-2 w-full"> <div class="bg-white/90 backdrop-blur-sm p-3 sm:p-4 rounded-lg shadow-xl flex flex-col h-full" style="min-height: calc(100vh - 1rem);">
                <div id="venta-header-section" class="mb-2">
                    <div class="flex justify-between items-center mb-2"> <h2 class="text-lg font-bold">Nueva Venta</h2> <button id="backToVentasBtn" class="px-3 py-1.5 bg-gray-400 text-white text-xs rounded-lg shadow-md hover:bg-gray-500">Volver</button> </div>
                    <div id="client-search-container"> <label for="clienteSearch" class="block font-medium mb-2">Cliente:</label> <div class="relative"><input type="text" id="clienteSearch" placeholder="Buscar..." class="w-full px-4 py-2 border rounded-lg"><div id="clienteDropdown" class="autocomplete-list hidden"></div></div> </div>
                    <div id="client-display-container" class="hidden flex-wrap items-center justify-between gap-2"> <p class="flex-grow text-sm"><span class="font-medium">Cliente:</span> <span id="selected-client-name" class="font-bold"></span></p> <div id="tasasContainer" class="flex flex-row items-center gap-2"> <div class="flex items-center space-x-1"> <label for="tasaCopInput" class="text-xs">COP:</label> <input type="number" id="tasaCopInput" placeholder="4000" class="w-16 px-1 py-1 text-sm border rounded-lg"> </div> <div class="flex items-center space-x-1"> <label for="tasaBsInput" class="text-xs">Bs.:</label> <input type="number" id="tasaBsInput" placeholder="36.5" class="w-16 px-1 py-1 text-sm border rounded-lg"> </div> </div> </div>
                </div>
                <div id="vacios-devueltos-section" class="mb-2 hidden"> <h3 class="text-sm font-semibold text-cyan-700 mb-1">Vacíos Devueltos:</h3> <div class="grid grid-cols-3 gap-2"> ${TIPOS_VACIO.map(tipo => `<div> <label for="vacios-${tipo.replace(/\s+/g, '-')}" class="text-xs mb-1 block">${tipo}</label> <input type="number" min="0" value="0" id="vacios-${tipo.replace(/\s+/g, '-')}" class="w-16 p-1 text-center border rounded-md" data-tipo-vacio="${tipo}" oninput="window.ventasModule.handleTipoVacioChange(event)"> </div>`).join('')} </div> </div>
                <div id="inventarioTableContainer" class="hidden animate-fade-in flex-grow flex flex-col overflow-hidden">
                    <div id="rubro-filter-container" class="mb-2"> <label for="rubroFilter" class="text-xs font-medium">Filtrar Rubro:</label> <select id="rubroFilter" class="w-full px-2 py-1 border rounded-lg text-sm"><option value="">Todos</option></select> </div>
                    <div class="overflow-auto flex-grow rounded-lg shadow"> <table class="min-w-full bg-white text-sm"><thead class="bg-gray-200 sticky top-0"><tr class="uppercase text-xs"><th class="py-2 px-2 text-center w-24">Cant</th><th class="py-2 px-2 text-left">Producto</th><th class="py-2 px-2 text-left price-toggle" onclick="window.ventasModule.toggleMoneda()">Precio</th><th class="py-2 px-1 text-center">Stock</th></tr></thead><tbody id="inventarioTableBody" class="text-gray-600"></tbody></table> </div>
                </div>
                <div id="venta-footer-section" class="mt-2 flex items-center justify-between hidden"> <span id="ventaTotal" class="text-base font-bold">$0.00</span> <button id="generarTicketBtn" class="px-5 py-2 bg-green-500 text-white rounded-lg shadow-md hover:bg-green-600">Generar Ticket</button> </div>
            </div> </div>
        `;
        const clienteSearchInput = document.getElementById('clienteSearch');
        clienteSearchInput.addEventListener('input', () => { const term = clienteSearchInput.value.toLowerCase(); const filtered = _clientesCache.filter(c=>(c.nombreComercial||'').toLowerCase().includes(term)||(c.nombrePersonal||'').toLowerCase().includes(term)); renderClienteDropdown(filtered); document.getElementById('clienteDropdown').classList.remove('hidden'); });
        const savedTasa = localStorage.getItem('tasaCOP'); if (savedTasa) { _tasaCOP = parseFloat(savedTasa); document.getElementById('tasaCopInput').value = _tasaCOP; }
        const savedTasaBs = localStorage.getItem('tasaBs'); if (savedTasaBs) { _tasaBs = parseFloat(savedTasaBs); document.getElementById('tasaBsInput').value = _tasaBs; }
        document.getElementById('tasaCopInput').addEventListener('input', (e) => { _tasaCOP = parseFloat(e.target.value) || 0; localStorage.setItem('tasaCOP', _tasaCOP); if (_monedaActual === 'COP') { renderVentasInventario(); updateVentaTotal(); } });
        document.getElementById('tasaBsInput').addEventListener('input', (e) => { _tasaBs = parseFloat(e.target.value) || 0; localStorage.setItem('tasaBs', _tasaBs); if (_monedaActual === 'Bs') { renderVentasInventario(); updateVentaTotal(); } });
        document.getElementById('rubroFilter').addEventListener('change', renderVentasInventario);
        document.getElementById('generarTicketBtn').addEventListener('click', generarTicket);
        document.getElementById('backToVentasBtn').addEventListener('click', showVentasView);
        loadDataForNewSale();
    }

    function loadDataForNewSale() {
        const clientesRef = _collection(_db, `artifacts/ventas-9a210/public/data/clientes`);
        const unsubClientes = _onSnapshot(clientesRef, snap => { _clientesCache = snap.docs.map(d => ({ id: d.id, ...d.data() })); }, err => { if (!window.isLoggingOut || err.code !== 'permission-denied') console.error("Error clientes:", err); });
        const inventarioRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`);
        const unsubInventario = _onSnapshot(inventarioRef, snap => { _inventarioCache = snap.docs.map(d => ({ id: d.id, ...d.data() })); populateRubroFilter(); if (_ventaActual.cliente) renderVentasInventario(); }, err => { if (!window.isLoggingOut || err.code !== 'permission-denied') console.error("Error inventario:", err); const b = document.getElementById('inventarioTableBody'); if(b) b.innerHTML = '<tr><td colspan="4" class="text-red-500">Error inventario</td></tr>'; });
        _activeListeners.push(unsubClientes, unsubInventario);
    }

    function populateRubroFilter() {
        const rF = document.getElementById('rubroFilter'); if(!rF) return;
        const rubros = [...new Set(_inventarioCache.map(p => p.rubro))].sort(); const cV = rF.value;
        rF.innerHTML = '<option value="">Todos</option>'; rubros.forEach(r => { if(r) rF.innerHTML += `<option value="${r}">${r}</option>`; }); rF.value = rubros.includes(cV) ? cV : '';
    }

    function renderClienteDropdown(filteredClients) {
        const cD = document.getElementById('clienteDropdown'); if(!cD) return; cD.innerHTML = '';
        filteredClients.forEach(cli => { const i = document.createElement('div'); i.className = 'autocomplete-item'; i.textContent = `${cli.nombreComercial} (${cli.nombrePersonal})`; i.addEventListener('click', () => selectCliente(cli)); cD.appendChild(i); });
    }

    function selectCliente(cliente) {
        _ventaActual.cliente = cliente; document.getElementById('client-search-container').classList.add('hidden'); document.getElementById('clienteDropdown').classList.add('hidden');
        document.getElementById('selected-client-name').textContent = cliente.nombreComercial; document.getElementById('client-display-container').classList.remove('hidden');
        document.getElementById('inventarioTableContainer').classList.remove('hidden'); document.getElementById('venta-footer-section').classList.remove('hidden'); document.getElementById('vacios-devueltos-section').classList.remove('hidden');
        renderVentasInventario();
    }

    function toggleMoneda() {
        const cycle = ['USD', 'COP', 'Bs'], rates = { 'USD': 1, 'COP': _tasaCOP, 'Bs': _tasaBs }; let cI = cycle.indexOf(_monedaActual), nI = (cI + 1) % cycle.length;
        while (nI !== cI) { if (rates[cycle[nI]] > 0) { _monedaActual = cycle[nI]; renderVentasInventario(); updateVentaTotal(); return; } nI = (nI + 1) % cycle.length; }
        _showModal('Aviso', (_tasaCOP <= 0 && _tasaBs <= 0) ? 'Ingresa tasas para alternar.' : 'Ingresa tasa válida (> 0).');
    }

    async function renderVentasInventario() {
        const body = document.getElementById('inventarioTableBody'), rF = document.getElementById('rubroFilter'); if (!body || !rF) return; body.innerHTML = `<tr><td colspan="4" class="text-center text-gray-500">Cargando...</td></tr>`;
        const selRubro = rF.value; const invFilt = _inventarioCache.filter(p => (p.cantidadUnidades || 0) > 0 || _ventaActual.productos[p.id]); let filtInv = selRubro ? invFilt.filter(p => p.rubro === selRubro) : invFilt;
        // Usa la función global para ordenar el inventario en la vista de venta
        const sortFunc = await window.getGlobalProductSortFunction();
        filtInv.sort(sortFunc);
        body.innerHTML = '';
        if (filtInv.length === 0) { body.innerHTML = `<tr><td colspan="4" class="text-center text-gray-500">No hay productos ${selRubro ? 'en este rubro' : ''}.</td></tr>`; return; }
        let lastHKey = null;
        // Obtiene el primer criterio de ordenamiento de la preferencia global (si existe)
        const fSortKey = window._sortPreferenceCache ? window._sortPreferenceCache[0] : 'segmento';
        filtInv.forEach(prod => {
            const curHVal = prod[fSortKey] || `Sin ${fSortKey}`; if (curHVal !== lastHKey) { lastHKey = curHVal; const hRow = document.createElement('tr'); hRow.innerHTML = `<td colspan="4" class="py-1 px-2 bg-gray-100 font-bold sticky top-[calc(theme(height.10))] z-[9]">${lastHKey}</td>`; body.appendChild(hRow); }
            const vPor = prod.ventaPor || { und: true }, vActProd = _ventaActual.productos[prod.id] || {}, precios = prod.precios || { und: prod.precioPorUnidad || 0 };
            const fPrice = (v) => { if (isNaN(v)) v=0; if (_monedaActual==='COP'&&_tasaCOP>0) return `COP ${(Math.ceil((v*_tasaCOP)/100)*100).toLocaleString('es-CO')}`; if (_monedaActual==='Bs'&&_tasaBs>0) return `Bs.S ${(v*_tasaBs).toLocaleString('es-VE',{minimumFractionDigits:2,maximumFractionDigits:2})}`; return `$${v.toFixed(2)}`; };
            const cRow = (t, c, max, pT, stockT, descT) => { const r=document.createElement('tr'); r.className='border-b hover:bg-gray-50'; r.innerHTML=`<td class="py-2 px-2 text-center align-middle"> <input type="number" min="0" max="${max}" value="${c}" class="w-16 p-1 text-center border rounded-md" data-product-id="${prod.id}" data-tipo-venta="${t}" oninput="window.ventasModule.handleQuantityChange(event)"> </td> <td class="py-2 px-2 text-left align-middle"> ${descT} <span class="text-xs text-gray-500">${prod.marca || 'S/M'}</span> </td> <td class="py-2 px-2 text-left align-middle font-semibold price-toggle" onclick="window.ventasModule.toggleMoneda()">${fPrice(pT)}</td> <td class="py-2 px-1 text-center align-middle">${stockT}</td>`; body.appendChild(r); };
            const stockU = prod.cantidadUnidades || 0;
            if (vPor.cj) { const uCj=prod.unidadesPorCaja||1, maxCj=Math.floor(stockU/uCj); cRow('cj', vActProd.cantCj||0, maxCj, precios.cj||0, `${maxCj} Cj`, `${prod.presentacion} (Cj/${uCj} und)`); }
            if (vPor.paq) { const uPaq=prod.unidadesPorPaquete||1, maxPaq=Math.floor(stockU/uPaq); cRow('paq', vActProd.cantPaq||0, maxPaq, precios.paq||0, `${maxPaq} Paq`, `${prod.presentacion} (Paq/${uPaq} und)`); }
            if (vPor.und) { cRow('und', vActProd.cantUnd||0, stockU, precios.und||0, `${stockU} Und`, `${prod.presentacion} (Und)`); }
        }); updateVentaTotal();
    }

    function handleQuantityChange(event) {
        const inp=event.target, pId=inp.dataset.productId, tV=inp.dataset.tipoVenta, prod=_inventarioCache.find(p=>p.id===pId); if(!prod) return; if(!_ventaActual.productos[pId]) _ventaActual.productos[pId]={...prod, cantCj:0,cantPaq:0,cantUnd:0,totalUnidadesVendidas:0};
        const qty=parseInt(inp.value,10)||0; _ventaActual.productos[pId][`cant${tV[0].toUpperCase()+tV.slice(1)}`]=qty; const pV=_ventaActual.productos[pId], uCj=pV.unidadesPorCaja||1, uPaq=pV.unidadesPorPaquete||1;
        const totU=(pV.cantCj*uCj)+(pV.cantPaq*uPaq)+(pV.cantUnd||0); const stockU=prod.cantidadUnidades||0; if(totU>stockU){ _showModal('Stock Insuficiente',`Ajustado.`); let ex=totU-stockU; if(tV==='cj')inp.value=Math.max(0,qty-Math.ceil(ex/uCj)); else if(tV==='paq')inp.value=Math.max(0,qty-Math.ceil(ex/uPaq)); else inp.value=Math.max(0,qty-ex); handleQuantityChange({target:inp}); return; }
        pV.totalUnidadesVendidas=totU; if(totU===0&&pV.cantCj===0&&pV.cantPaq===0&&pV.cantUnd===0) delete _ventaActual.productos[pId]; updateVentaTotal();
    };

    function handleTipoVacioChange(event) { const inp=event.target, tipo=inp.dataset.tipoVacio, cant=parseInt(inp.value,10)||0; if(tipo&&_ventaActual.vaciosDevueltosPorTipo.hasOwnProperty(tipo)) _ventaActual.vaciosDevueltosPorTipo[tipo]=cant; }

    function updateVentaTotal() {
        const tEl=document.getElementById('ventaTotal'); if(!tEl) return;
        const tUSD=Object.values(_ventaActual.productos).reduce((s,p)=>{const pr=p.precios||{und:p.precioPorUnidad||0}; return s+(pr.cj||0)*(p.cantCj||0)+(pr.paq||0)*(p.cantPaq||0)+(pr.und||0)*(p.cantUnd||0);},0);
        if(_monedaActual==='COP'&&_tasaCOP>0)tEl.textContent=`Total: COP ${(Math.ceil((tUSD*_tasaCOP)/100)*100).toLocaleString('es-CO')}`; else if(_monedaActual==='Bs'&&_tasaBs>0)tEl.textContent=`Total: Bs.S ${(tUSD*_tasaBs).toLocaleString('es-VE',{minimumFractionDigits:2,maximumFractionDigits:2})}`; else tEl.textContent=`Total: $${tUSD.toFixed(2)}`;
    }

    // Funciones de Ticket (createTicketHTML, createRawTextTicket, etc.) y Generación/Guardado (generarTicket) sin cambios funcionales mayores
    function createTicketHTML(venta, productos, vaciosDevueltosPorTipo, tipo = 'ticket') {
        const fecha = venta.fecha ? (venta.fecha.toDate ? venta.fecha.toDate().toLocaleDateString('es-ES') : new Date(venta.fecha).toLocaleDateString('es-ES')) : new Date().toLocaleDateString('es-ES');
        const clienteNombre = venta.cliente ? venta.cliente.nombreComercial : venta.clienteNombre;
        const clienteNombrePersonal = (venta.cliente ? venta.cliente.nombrePersonal : venta.clienteNombrePersonal) || '';
        let total = 0;
        let productosHTML = '';
        const productosVendidos = productos.filter(p => (p.totalUnidadesVendidas || (p.cantidadVendida && (p.cantidadVendida.cj > 0 || p.cantidadVendida.paq > 0 || p.cantidadVendida.und > 0)) ));
        productosVendidos.forEach(p => { /* ... (igual que antes) ... */ });
        let vaciosHTML = ''; const tiposConDev = Object.entries(vaciosDevueltosPorTipo || {}).filter(([t, c]) => c > 0);
        if (tiposConDev.length > 0) { /* ... (igual que antes) ... */ }
        const titulo = tipo === 'factura' ? 'FACTURA FISCAL' : 'TICKET DE VENTA';
        return `
            <div id="temp-ticket-for-image" class="bg-white text-black p-4 font-bold" style="width: 768px; font-family: 'Courier New', Courier, monospace;">
                <!-- ... (contenido HTML del ticket igual que antes) ... -->
            </div>`;
    }

    function createRawTextTicket(venta, productos, vaciosDevueltosPorTipo) {
        const fecha = venta.fecha ? (venta.fecha.toDate ? venta.fecha.toDate().toLocaleDateString('es-ES') : new Date(venta.fecha).toLocaleDateString('es-ES')) : new Date().toLocaleDateString('es-ES');
        const toTitleCase = (str) => { /* ... (igual que antes) ... */ };
        const clienteNombre = toTitleCase(venta.cliente ? venta.cliente.nombreComercial : venta.clienteNombre);
        const clienteNombrePersonal = toTitleCase((venta.cliente ? venta.cliente.nombrePersonal : venta.clienteNombrePersonal) || '');
        const LINE_WIDTH = 48; let total = 0; let ticket = '';
        const center = (text) => text.padStart(Math.floor((LINE_WIDTH - text.length) / 2) + text.length, ' ').padEnd(LINE_WIDTH, ' ');
        const wordWrap = (text, maxWidth) => { /* ... (igual que antes) ... */ };
        ticket += center('Distribuidora Castillo Yañez') + '\n'; ticket += center('Nota de Entrega') + '\n'; ticket += center('(no valido como factura fiscal)') + '\n\n';
        const wrappedClientName = wordWrap(`Cliente: ${clienteNombre}`, LINE_WIDTH); wrappedClientName.forEach(line => { ticket += line + '\n'; }); ticket += `Fecha: ${fecha}\n`;
        const productosVendidos = productos.filter(p => (p.totalUnidadesVendidas || (p.cantidadVendida && (p.cantidadVendida.cj > 0 || p.cantidadVendida.paq > 0 || p.cantidadVendida.und > 0)) ));
        if (productosVendidos.length > 0) { /* ... (igual que antes) ... */ }
        const tiposConDev = Object.entries(vaciosDevueltosPorTipo || {}).filter(([t, c]) => c > 0);
        if (tiposConDev.length > 0) { /* ... (igual que antes) ... */ }
        ticket += '-'.repeat(LINE_WIDTH) + '\n'; const totalString = `TOTAL: $${total.toFixed(2)}`; ticket += totalString.padStart(LINE_WIDTH, ' ') + '\n\n';
        ticket += '\n\n\n\n'; ticket += center('________________________') + '\n'; ticket += center(clienteNombrePersonal) + '\n\n'; ticket += '-'.repeat(LINE_WIDTH) + '\n';
        return ticket;
    }

    async function handleShareTicket(htmlContent, successCallback) { /* ... (igual que antes) ... */ }
    async function handleShareRawText(textContent, successCallback) { /* ... (igual que antes) ... */ }
    function copyToClipboard(textContent, successCallback) { /* ... (igual que antes) ... */ }
    function legacyCopyToClipboard(textContent, successCallback) { /* ... (igual que antes) ... */ }
    function showSharingOptions(venta, productos, vaciosDevueltosPorTipo, tipo, successCallback) { /* ... (igual que antes) ... */ }

    async function generarTicket() {
        if (!_ventaActual.cliente) { _showModal('Error', 'Selecciona cliente.'); return; }
        const prods = Object.values(_ventaActual.productos); const hayVac = Object.values(_ventaActual.vaciosDevueltosPorTipo).some(c=>c>0);
        if (prods.length === 0 && !hayVac) { _showModal('Error', 'Agrega productos o vacíos.'); return; }
        _showModal('Confirmar Transacción', '¿Guardar transacción?', async () => {
            _showModal('Progreso', 'Procesando...');
            try {
                const batch = _writeBatch(_db); const ventaRef = _doc(_collection(_db, `artifacts/${_appId}/users/${_userId}/ventas`));
                let totalVenta=0; const itemsVenta=[]; const vaciosChanges={};
                for(const p of prods){ const pCache=_inventarioCache.find(i=>i.id===p.id); if(!pCache)throw new Error(`Producto ${p.presentacion} no encontrado.`); const stockU=pCache.cantidadUnidades||0, restarU=p.totalUnidadesVendidas||0; if(restarU<0)throw new Error(`Cantidad inválida ${p.presentacion}.`); if(stockU<restarU)throw new Error(`Stock insuficiente ${p.presentacion}.`); if(restarU>0){const pRef=_doc(_db,`artifacts/${_appId}/users/${_userId}/inventario`,p.id); batch.update(pRef,{cantidadUnidades:stockU-restarU});}
                    const precios=p.precios||{und:p.precioPorUnidad||0}; const sub=(precios.cj||0)*(p.cantCj||0)+(precios.paq||0)*(p.cantPaq||0)+(precios.und||0)*(p.cantUnd||0); totalVenta+=sub;
                    if(pCache.manejaVacios&&pCache.tipoVacio){const tV=pCache.tipoVacio, cjV=p.cantCj||0; if(cjV>0)vaciosChanges[tV]=(vaciosChanges[tV]||0)+cjV;}
                    if(restarU>0)itemsVenta.push({ id:p.id, presentacion:p.presentacion, rubro:p.rubro??null, marca:p.marca??null, segmento:p.segmento??null, precios:p.precios, ventaPor:p.ventaPor, unidadesPorPaquete:p.unidadesPorPaquete, unidadesPorCaja:p.unidadesPorCaja, cantidadVendida:{cj:p.cantCj||0,paq:p.cantPaq||0,und:p.cantUnd||0}, totalUnidadesVendidas:p.totalUnidadesVendidas, iva:p.iva??0, manejaVacios:p.manejaVacios||false, tipoVacio:p.tipoVacio||null }); }
                for(const tV in _ventaActual.vaciosDevueltosPorTipo){const dev=_ventaActual.vaciosDevueltosPorTipo[tV]||0; if(dev>0)vaciosChanges[tV]=(vaciosChanges[tV]||0)-dev;}
                if(Object.values(vaciosChanges).some(c=>c!==0)){const cliRef=_doc(_db,`artifacts/ventas-9a210/public/data/clientes`,_ventaActual.cliente.id); await _runTransaction(_db,async(t)=>{const cliDoc=await t.get(cliRef); if(!cliDoc.exists())throw "Cliente no existe."; const cliData=cliDoc.data(), sVac=cliData.saldoVacios||{}; for(const tV in vaciosChanges){const ch=vaciosChanges[tV]; if(ch!==0)sVac[tV]=(sVac[tV]||0)+ch;} t.update(cliRef,{saldoVacios:sVac});});}
                batch.set(ventaRef,{ clienteId:_ventaActual.cliente.id, clienteNombre:_ventaActual.cliente.nombreComercial||_ventaActual.cliente.nombrePersonal, clienteNombrePersonal:_ventaActual.cliente.nombrePersonal, fecha:new Date(), total:totalVenta, productos:itemsVenta, vaciosDevueltosPorTipo:_ventaActual.vaciosDevueltosPorTipo });
                await batch.commit();
                showSharingOptions({ cliente:_ventaActual.cliente, fecha:new Date() }, itemsVenta, _ventaActual.vaciosDevueltosPorTipo, 'Nota de Entrega', showNuevaVentaView);
            } catch (e) { console.error("Error procesando:", e); _showModal('Error', `Error: ${e.message}`); }
        }, 'Sí, Guardar', null, true);
    }

    function showVentasTotalesView() {
        _floatingControls.classList.add('hidden');
        _mainContent.innerHTML = `
            <div class="p-4 pt-8"> <div class="container mx-auto"> <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl text-center">
                <h2 class="text-2xl font-bold text-gray-800 mb-6">Ventas Totales</h2>
                <div class="space-y-4">
                    <button id="ventasActualesBtn" class="w-full px-6 py-3 bg-teal-500 text-white rounded-lg shadow-md hover:bg-teal-600">Ventas Actuales</button>
                    <button id="ordenarCierreBtn" class="w-full px-6 py-3 bg-purple-500 text-white rounded-lg shadow-md hover:bg-purple-600">Orden Reportes</button>
                    <button id="cierreVentasBtn" class="w-full px-6 py-3 bg-red-500 text-white rounded-lg shadow-md hover:bg-red-600">Cierre de Ventas</button>
                </div>
                <button id="backToVentasBtn" class="mt-6 w-full px-6 py-3 bg-gray-400 text-white rounded-lg shadow-md hover:bg-gray-500">Volver</button>
            </div> </div> </div>
        `;
        document.getElementById('ventasActualesBtn').addEventListener('click', showVentasActualesView);
        document.getElementById('cierreVentasBtn').addEventListener('click', showCierreSubMenuView);
        document.getElementById('ordenarCierreBtn').addEventListener('click', showOrdenarCierreView);
        document.getElementById('backToVentasBtn').addEventListener('click', showVentasView);
    }

    function showVentasActualesView() {
        _floatingControls.classList.add('hidden');
        _mainContent.innerHTML = `
            <div class="p-4 w-full"> <div class="bg-white/90 backdrop-blur-sm p-6 rounded-lg shadow-xl">
                <div class="flex justify-between items-center mb-6"> <h2 class="text-2xl font-bold">Ventas Actuales</h2> <button id="backToVentasTotalesBtn" class="px-4 py-2 bg-gray-400 text-white rounded-lg shadow-md hover:bg-gray-500">Volver</button> </div>
                <div id="ventasListContainer" class="overflow-x-auto"><p class="text-center text-gray-500">Cargando...</p></div>
            </div> </div>
        `;
        document.getElementById('backToVentasTotalesBtn').addEventListener('click', showVentasTotalesView);
        renderVentasList();
    }

    function renderVentasList() {
        const cont = document.getElementById('ventasListContainer'); if (!cont) return;
        const vRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/ventas`); const q = _query(vRef);
        const unsub = _onSnapshot(q, (snap) => {
            _ventasGlobal = snap.docs.map(d => ({ id: d.id, ...d.data() })); _ventasGlobal.sort((a,b)=>(b.fecha?.toDate()??0)-(a.fecha?.toDate()??0));
            if (_ventasGlobal.length === 0) { cont.innerHTML = `<p class="text-center text-gray-500">No hay ventas.</p>`; return; }
            let tHTML = `<table class="min-w-full bg-white text-sm"><thead class="bg-gray-200 sticky top-0 z-10"><tr> <th class="py-2 px-3 border-b text-left">Cliente</th> <th class="py-2 px-3 border-b text-left">Fecha</th> <th class="py-2 px-3 border-b text-right">Total</th> <th class="py-2 px-3 border-b text-center">Acciones</th> </tr></thead><tbody>`;
            _ventasGlobal.forEach(v => { const fV=v.fecha?.toDate?v.fecha.toDate():new Date(0); const fF=fV.toLocaleDateString('es-ES',{day:'2-digit',month:'2-digit',year:'numeric'}); tHTML+=`<tr class="hover:bg-gray-50"><td class="py-2 px-3 border-b align-middle">${v.clienteNombre||'N/A'}</td><td class="py-2 px-3 border-b align-middle">${fF}</td><td class="py-2 px-3 border-b text-right font-semibold align-middle">$${(v.total||0).toFixed(2)}</td><td class="py-2 px-3 border-b"><div class="flex flex-col items-center space-y-1"><button onclick="window.ventasModule.showPastSaleOptions('${v.id}','ticket')" class="w-full px-3 py-1.5 bg-blue-500 text-white text-xs rounded-lg hover:bg-blue-600">Compartir</button><button onclick="window.ventasModule.editVenta('${v.id}')" class="w-full px-3 py-1.5 bg-yellow-500 text-white text-xs rounded-lg hover:bg-yellow-600">Editar</button><button onclick="window.ventasModule.deleteVenta('${v.id}')" class="w-full px-3 py-1.5 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600">Eliminar</button></div></td></tr>`; });
            tHTML += `</tbody></table>`; cont.innerHTML = tHTML;
        }, (err) => { if (!window.isLoggingOut || err.code !== 'permission-denied') console.error("Error lista ventas:", err); if(cont) cont.innerHTML = `<p class="text-red-500">Error al cargar.</p>`; });
        _activeListeners.push(unsub);
    }

    function showCierreSubMenuView() {
         _mainContent.innerHTML = `
            <div class="p-4 pt-8"> <div class="container mx-auto"> <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl text-center">
                <h2 class="text-2xl font-bold text-gray-800 mb-6">Cierre de Ventas</h2>
                <div class="space-y-4">
                    <button id="verCierreBtn" class="w-full px-6 py-3 bg-cyan-500 text-white rounded-lg shadow-md hover:bg-cyan-600">Ver Cierre</button>
                    <button id="ejecutarCierreBtn" class="w-full px-6 py-3 bg-red-600 text-white rounded-lg shadow-md hover:bg-red-700">Ejecutar Cierre</button>
                </div>
                <button id="backToVentasTotalesBtn" class="mt-6 w-full px-6 py-3 bg-gray-400 text-white rounded-lg shadow-md hover:bg-gray-500">Volver</button>
            </div> </div> </div>
        `;
        document.getElementById('verCierreBtn').addEventListener('click', showVerCierreView);
        document.getElementById('ejecutarCierreBtn').addEventListener('click', ejecutarCierre);
        document.getElementById('backToVentasTotalesBtn').addEventListener('click', showVentasTotalesView);
    }

    async function processSalesDataForReport(ventas, userIdForInventario) {
        const clientData = {}; let grandTotalValue = 0; const allProductsMap = new Map(); const vaciosMovementsPorTipo = {};
        const TIPOS_VACIO_GLOBAL = window.TIPOS_VACIO_GLOBAL || ["1/4 - 1/3", "ret 350 ml", "ret 1.25 Lts"];
        const inventarioRef = _collection(_db, `artifacts/${_appId}/users/${userIdForInventario}/inventario`); // Usa inventario del vendedor
        const inventarioSnapshot = await _getDocs(inventarioRef); const inventarioMap = new Map(inventarioSnapshot.docs.map(doc => [doc.id, doc.data()]));
        ventas.forEach(venta => { const cliN=venta.clienteNombre||'N/A'; if(!clientData[cliN])clientData[cliN]={products:{},totalValue:0}; if(!vaciosMovementsPorTipo[cliN]){vaciosMovementsPorTipo[cliN]={};TIPOS_VACIO_GLOBAL.forEach(t=>vaciosMovementsPorTipo[cliN][t]={entregados:0,devueltos:0});} clientData[cliN].totalValue+=(venta.total||0); grandTotalValue+=(venta.total||0); const vacDev=venta.vaciosDevueltosPorTipo||{}; for(const t in vacDev){if(!vaciosMovementsPorTipo[cliN][t])vaciosMovementsPorTipo[cliN][t]={e:0,d:0}; vaciosMovementsPorTipo[cliN][t].devueltos+=(vacDev[t]||0);} (venta.productos||[]).forEach(p=>{const pComp=inventarioMap.get(p.id)||p; if(pComp.manejaVacios&&pComp.tipoVacio){const tV=pComp.tipoVacio; if(!vaciosMovementsPorTipo[cliN][tV])vaciosMovementsPorTipo[cliN][tV]={e:0,d:0}; vaciosMovementsPorTipo[cliN][tV].entregados+=p.cantidadVendida?.cj||0;} const r=pComp.rubro||'N/R', s=pComp.segmento||'N/S', m=pComp.marca||'N/M'; if(!allProductsMap.has(p.id))allProductsMap.set(p.id,{...pComp,id:p.id,rubro:r,segmento:s,marca:m,presentacion:p.presentacion}); if(!clientData[cliN].products[p.id])clientData[cliN].products[p.id]=0; clientData[cliN].products[p.id]+=(p.totalUnidadesVendidas||0);}); });
        const sortedClients = Object.keys(clientData).sort();
        const sortFunction = await window.getGlobalProductSortFunction(); // Usa orden global
        const finalProductOrder = Array.from(allProductsMap.values()).sort(sortFunction);
        return { clientData, grandTotalValue, sortedClients, finalProductOrder, vaciosMovementsPorTipo };
    }

    async function showVerCierreView() {
        _showModal('Progreso', 'Generando reporte...');
        const ventasSnapshot = await _getDocs(_collection(_db, `artifacts/${_appId}/users/${_userId}/ventas`)); const ventas = ventasSnapshot.docs.map(doc => doc.data()); if (ventas.length === 0) { _showModal('Aviso', 'No hay ventas.'); return; }
        try {
            const { clientData, grandTotalValue, sortedClients, finalProductOrder, vaciosMovementsPorTipo } = await processSalesDataForReport(ventas, _userId); // Usa ID del admin
            let hHTML = `<tr class="sticky top-0 z-20 bg-gray-200"><th class="p-1 border sticky left-0 z-30 bg-gray-200">Cliente</th>`; finalProductOrder.forEach(p => { hHTML += `<th class="p-1 border whitespace-nowrap text-xs" title="${p.marca||''} - ${p.segmento||''}">${p.presentacion}</th>`; }); hHTML += `<th class="p-1 border sticky right-0 z-30 bg-gray-200">Total Cliente</th></tr>`;
            let bHTML=''; sortedClients.forEach(cli=>{bHTML+=`<tr class="hover:bg-blue-50"><td class="p-1 border font-medium bg-white sticky left-0 z-10">${cli}</td>`; const cCli=clientData[cli]; finalProductOrder.forEach(p=>{const qU=cCli.products[p.id]||0; let dQ=''; if(qU>0){dQ=`${qU} Unds`; const vP=p.ventaPor||{}, uCj=p.unidadesPorCaja||1, uPaq=p.unidadesPorPaquete||1; if(vP.cj&&!vP.paq&&!vP.und&&uCj>0&&Number.isInteger(qU/uCj))dQ=`${qU/uCj} Cj`; else if(vP.paq&&!vP.cj&&!vP.und&&uPaq>0&&Number.isInteger(qU/uPaq))dQ=`${qU/uPaq} Paq`;} bHTML+=`<td class="p-1 border text-center">${dQ}</td>`;}); bHTML+=`<td class="p-1 border text-right font-semibold bg-white sticky right-0 z-10">$${cCli.totalValue.toFixed(2)}</td></tr>`;});
            let fHTML='<tr class="bg-gray-200 font-bold"><td class="p-1 border sticky left-0 z-10">TOTALES</td>'; finalProductOrder.forEach(p=>{let tQ=0; sortedClients.forEach(cli=>tQ+=clientData[cli].products[p.id]||0); let dT=''; if(tQ>0){dT=`${tQ} Unds`; const vP=p.ventaPor||{}, uCj=p.unidadesPorCaja||1, uPaq=p.unidadesPorPaquete||1; if(vP.cj&&!vP.paq&&!vP.und&&uCj>0&&Number.isInteger(tQ/uCj))dT=`${tQ/uCj} Cj`; else if(vP.paq&&!vP.cj&&!vP.und&&uPaq>0&&Number.isInteger(tQ/uPaq))dT=`${tQ/uPaq} Paq`;} fHTML+=`<td class="p-1 border text-center">${dT}</td>`;}); fHTML+=`<td class="p-1 border text-right sticky right-0 z-10">$${grandTotalValue.toFixed(2)}</td></tr>`;
            let vHTML=''; const TIPOS_VACIO_GLOBAL = window.TIPOS_VACIO_GLOBAL || ["1/4 - 1/3", "ret 350 ml", "ret 1.25 Lts"]; const cliVacios=Object.keys(vaciosMovementsPorTipo).filter(cli=>TIPOS_VACIO_GLOBAL.some(t=>(vaciosMovementsPorTipo[cli][t]?.entregados||0)>0||(vaciosMovementsPorTipo[cli][t]?.devueltos||0)>0)).sort(); if(cliVacios.length>0){ vHTML=`<h3 class="text-xl my-6">Reporte Vacíos</h3><div class="overflow-auto border"><table><thead><tr><th>Cliente</th><th>Tipo</th><th>Entregados</th><th>Devueltos</th><th>Neto</th></tr></thead><tbody>`; cliVacios.forEach(cli=>{const movs=vaciosMovementsPorTipo[cli]; TIPOS_VACIO_GLOBAL.forEach(t=>{const mov=movs[t]||{e:0,d:0}; if(mov.entregados>0||mov.devueltos>0){const neto=mov.entregados-mov.devueltos; const nClass=neto>0?'text-red-600':(neto<0?'text-green-600':''); vHTML+=`<tr><td>${cli}</td><td>${t}</td><td>${mov.entregados}</td><td>${mov.devueltos}</td><td class="${nClass}">${neto>0?`+${neto}`:neto}</td></tr>`;}});}); vHTML+='</tbody></table></div>';}
            const reportHTML = `<div class="text-left max-h-[80vh] overflow-auto"> <h3 class="text-xl font-bold mb-4">Reporte Cierre</h3> <div class="overflow-auto border"> <table class="min-w-full bg-white text-xs"> <thead class="bg-gray-200">${hHTML}</thead> <tbody>${bHTML}</tbody> <tfoot>${fHTML}</tfoot> </table> </div> ${vHTML} </div>`;
            _showModal('Reporte de Cierre', reportHTML, null, 'Cerrar');
        } catch (error) { console.error("Error reporte:", error); _showModal('Error', `No se pudo generar: ${error.message}`); }
    }

    async function exportCierreToExcel(ventas) {
        if (typeof XLSX === 'undefined') { _showModal('Error', 'Librería Excel no cargada.'); return; }
        try {
            const { clientData, grandTotalValue, sortedClients, finalProductOrder, vaciosMovementsPorTipo } = await processSalesDataForReport(ventas, _userId); // Usa ID admin
            const dSheet1 = []; const hRow = ["Cliente"]; finalProductOrder.forEach(p => { hRow.push(p.presentacion || 'N/A'); }); hRow.push("Total Cliente"); dSheet1.push(hRow);
            sortedClients.forEach(cli => { const row=[cli]; const cCli=clientData[cli]; finalProductOrder.forEach(p=>{const qU=cCli.products[p.id]||0; let dQ=''; if(qU>0){dQ=`${qU} Unds`; const vP=p.ventaPor||{}, uCj=p.unidadesPorCaja||1, uPaq=p.unidadesPorPaquete||1; if(vP.cj&&!vP.paq&&!vP.und&&uCj>0&&Number.isInteger(qU/uCj))dQ=`${qU/uCj} Cj`; else if(vP.paq&&!vP.cj&&!vP.und&&uPaq>0&&Number.isInteger(qU/uPaq))dQ=`${qU/uPaq} Paq`;} row.push(dQ);}); row.push(Number(cCli.totalValue.toFixed(2))); dSheet1.push(row); });
            const fRow = ["TOTALES"]; finalProductOrder.forEach(p=>{let tQ=0; sortedClients.forEach(cli=>tQ+=clientData[cli].products[p.id]||0); let dT=''; if(tQ>0){dT=`${tQ} Unds`; const vP=p.ventaPor||{}, uCj=p.unidadesPorCaja||1, uPaq=p.unidadesPorPaquete||1; if(vP.cj&&!vP.paq&&!vP.und&&uCj>0&&Number.isInteger(tQ/uCj))dT=`${tQ/uCj} Cj`; else if(vP.paq&&!vP.cj&&!vP.und&&uPaq>0&&Number.isInteger(tQ/uPaq))dT=`${tQ/uPaq} Paq`;} fRow.push(dT);}); fRow.push(Number(grandTotalValue.toFixed(2))); dSheet1.push(fRow);
            const ws1 = XLSX.utils.aoa_to_sheet(dSheet1); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws1, 'Reporte Cierre');
            const TIPOS_VACIO_GLOBAL = window.TIPOS_VACIO_GLOBAL || ["1/4 - 1/3", "ret 350 ml", "ret 1.25 Lts"]; const cliVacios=Object.keys(vaciosMovementsPorTipo).filter(cli=>TIPOS_VACIO_GLOBAL.some(t=>(vaciosMovementsPorTipo[cli][t]?.entregados||0)>0||(vaciosMovementsPorTipo[cli][t]?.devueltos||0)>0)).sort(); if (cliVacios.length > 0) { const dSheet2=[['Cliente','Tipo Vacío','Entregados','Devueltos','Neto']]; cliVacios.forEach(cli=>{const movs=vaciosMovementsPorTipo[cli]; TIPOS_VACIO_GLOBAL.forEach(t=>{const mov=movs[t]||{e:0,d:0}; if(mov.entregados>0||mov.devueltos>0)dSheet2.push([cli,t,mov.entregados,mov.devueltos,mov.entregados-mov.devueltos]);});}); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dSheet2), 'Reporte Vacíos');}
            const today = new Date().toISOString().slice(0, 10); XLSX.writeFile(wb, `Reporte_Cierre_Ventas_${today}.xlsx`);
        } catch (error) { console.error("Error exportando:", error); _showModal('Error', `Error Excel: ${error.message}`); throw error; }
    }

    async function ejecutarCierre() {
        _showModal('Confirmar Cierre Definitivo', 'Generará Excel, archivará ventas y eliminará activas. IRREVERSIBLE. ¿Continuar?', async () => {
            _showModal('Progreso', 'Obteniendo ventas...');
            const ventasRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/ventas`); const ventasSnap = await _getDocs(ventasRef); const ventas = ventasSnap.docs.map(d=>({id: d.id, ...d.data()}));
            if (ventas.length === 0) { _showModal('Aviso', 'No hay ventas activas.'); return false; }
            try {
                 _showModal('Progreso', 'Generando Excel...'); await exportCierreToExcel(ventas);
                 _showModal('Progreso', 'Archivando y eliminando...'); const cierreData = { fecha: new Date(), ventas: ventas.map(({id,...rest})=>rest), total: ventas.reduce((s,v)=>s+(v.total||0),0) }; let cDocRef;
                 if (_userRole === 'user') { const uDocRef=_doc(_db,"users",_userId); const uDoc=await _getDoc(uDocRef); const uData=uDoc.exists()?uDoc.data():{}; cDocRef=_doc(_collection(_db,`public_data/${_appId}/user_closings`)); cierreData.vendedorInfo={userId:_userId,nombre:uData.nombre||'',apellido:uData.apellido||'',camion:uData.camion||'',email:uData.email||''}; await _setDoc(cDocRef, cierreData); }
                 else { cDocRef = _doc(_collection(_db, `artifacts/${_appId}/users/${_userId}/cierres`)); await _setDoc(cDocRef, cierreData); }
                 const batch = _writeBatch(_db); ventas.forEach(v => batch.delete(_doc(ventasRef, v.id))); await batch.commit();
                _showModal('Éxito', 'Cierre completado. Reporte descargado, ventas archivadas/eliminadas.', showVentasTotalesView); return true;
            } catch(e) { console.error("Error cierre:", e); _showModal('Error', `Error: ${e.message}`); return false; }
        }, 'Sí, Ejecutar Cierre', null, true);
    }

    function showOrdenarCierreView() { /* ... sin cambios ... */ }
    async function renderRubrosForOrdering() { /* ... sin cambios ... */ }
    async function renderSegmentosForOrderingGlobal() { /* ... sin cambios ... */ }
    function addDragAndDropHandlers(container) { /* ... sin cambios ... */ }
    async function handleGuardarOrdenCierre() { /* ... sin cambios ... */ }

    function showPastSaleOptions(ventaId, tipo = 'ticket') { /* ... sin cambios ... */ }
    function editVenta(ventaId) { /* ... sin cambios ... */ }
    function deleteVenta(ventaId) { /* ... sin cambios ... */ }

    async function showEditVentaView(venta) {
        _floatingControls.classList.add('hidden'); _monedaActual = 'USD';
        _mainContent.innerHTML = `
            <div class="p-2 sm:p-4 w-full"> <div class="bg-white/90 backdrop-blur-sm p-4 sm:p-6 rounded-lg shadow-xl flex flex-col h-full" style="min-height: calc(100vh - 2rem);">
                <div id="venta-header-section" class="mb-4">
                    <div class="flex justify-between items-center mb-4"> <h2 class="text-xl font-bold">Editando Venta</h2> <button id="backToVentasBtn" class="px-4 py-2 bg-gray-400 text-white text-sm rounded-lg shadow-md hover:bg-gray-500">Volver</button> </div>
                    <div class="p-4 bg-gray-100 rounded-lg"> <p><span class="font-medium">Cliente:</span> <span class="font-bold">${venta.clienteNombre||'N/A'}</span></p> <p class="text-sm"><span class="font-medium">Fecha Orig:</span> ${venta.fecha?.toDate?venta.fecha.toDate().toLocaleString('es-ES'):'N/A'}</p> </div>
                </div>
                <div id="vacios-devueltos-section" class="mb-4"> <h3 class="text-sm font-semibold text-cyan-700 mb-1">Vacíos Devueltos:</h3> <div class="grid grid-cols-3 gap-2"> ${TIPOS_VACIO.map(t => `<div><label for="vacios-${t.replace(/\s+/g,'-')}" class="text-xs mb-1 block">${t}</label><input type="number" min="0" value="${venta.vaciosDevueltosPorTipo?(venta.vaciosDevueltosPorTipo[t]||0):0}" id="vacios-${t.replace(/\s+/g,'-')}" class="w-16 p-1 text-center border rounded-md" data-tipo-vacio="${t}" oninput="window.ventasModule.handleTipoVacioChange(event)"></div>`).join('')} </div> </div>
                <div id="inventarioTableContainer" class="animate-fade-in flex-grow flex flex-col overflow-hidden">
                    <div class="mb-2"> <label for="rubroFilter" class="text-xs">Filtrar Rubro:</label> <select id="rubroFilter" class="w-full px-2 py-1 border rounded-lg text-sm"><option value="">Todos</option></select> </div>
                    <div class="overflow-auto flex-grow rounded-lg shadow"> <table class="min-w-full bg-white text-xs"><thead class="bg-gray-200 sticky top-0 z-10"><tr class="uppercase"> <th class="py-2 px-1 text-center">Cant.</th> <th class="py-2 px-2 text-left">Producto</th> <th class="py-2 px-2 text-left price-toggle" onclick="window.ventasModule.toggleMoneda()">Precio</th> <th class="py-2 px-1 text-center">Stock Disp.</th> </tr></thead><tbody id="inventarioTableBody" class="text-gray-600"></tbody></table> </div>
                </div>
                <div id="venta-footer-section" class="mt-4 flex items-center justify-between"> <span id="ventaTotal" class="text-lg font-bold">$0.00</span> <button id="saveChangesBtn" class="px-6 py-3 bg-blue-500 text-white rounded-lg shadow-md hover:bg-blue-600">Guardar Cambios</button> </div>
            </div> </div>
        `;
        document.getElementById('saveChangesBtn').addEventListener('click', handleGuardarVentaEditada); document.getElementById('backToVentasBtn').addEventListener('click', showVentasActualesView);
        _showModal('Progreso', 'Cargando datos...');
        try {
            const invSnap = await _getDocs(_collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`)); _inventarioCache = invSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            _ventaActual = { cliente: { id: venta.clienteId, nombreComercial: venta.clienteNombre, nombrePersonal: venta.clienteNombrePersonal }, productos: (venta.productos||[]).reduce((acc,p)=>{const pComp=_inventarioCache.find(inv=>inv.id===p.id)||p; const cant=p.cantidadVendida||{}; acc[p.id]={...pComp, cantCj:cant.cj||0, cantPaq:cant.paq||0, cantUnd:cant.und||0, totalUnidadesVendidas:p.totalUnidadesVendidas||0}; return acc;},{}), vaciosDevueltosPorTipo: venta.vaciosDevueltosPorTipo||{} };
            TIPOS_VACIO.forEach(t => { if(!_ventaActual.vaciosDevueltosPorTipo[t]) _ventaActual.vaciosDevueltosPorTipo[t]=0; });
            document.getElementById('rubroFilter').addEventListener('change', renderEditVentasInventario); populateRubroFilter(); document.getElementById('rubroFilter').value = '';
            renderEditVentasInventario(); updateVentaTotal(); document.getElementById('modalContainer').classList.add('hidden');
        } catch (error) { console.error("Error cargando edit:", error); _showModal('Error', `Error: ${error.message}`); showVentasActualesView(); }
    }

    async function renderEditVentasInventario() {
        const body = document.getElementById('inventarioTableBody'), rF = document.getElementById('rubroFilter'); if (!body || !rF) return; body.innerHTML = `<tr><td colspan="4" class="text-center text-gray-500">Cargando...</td></tr>`;
        const selRubro = rF.value; let invToShow = _inventarioCache.filter(p => _originalVentaForEdit.productos.some(oP => oP.id === p.id) || (p.cantidadUnidades || 0) > 0);
        if (selRubro) invToShow = invToShow.filter(p => p.rubro === selRubro);
        const sortFunc = await window.getGlobalProductSortFunction(); invToShow.sort(sortFunc); body.innerHTML = '';
        if (invToShow.length === 0) { body.innerHTML = `<tr><td colspan="4" class="text-center text-gray-500">No hay productos ${selRubro ? 'en este rubro' : ''}.</td></tr>`; return; }
        let lastHKey = null; const fSortKey = window._sortPreferenceCache ? window._sortPreferenceCache[0] : 'segmento';
        invToShow.forEach(prod => {
             const curHVal = prod[fSortKey] || `Sin ${fSortKey}`; if (curHVal !== lastHKey) { lastHKey = curHVal; const hRow=document.createElement('tr'); hRow.innerHTML=`<td colspan="4" class="py-1 px-2 bg-gray-100 font-bold sticky top-[calc(theme(height.10))] z-[9]">${lastHKey}</td>`; body.appendChild(hRow); }
             const vPor=prod.ventaPor||{und:true}, vActProd=_ventaActual.productos[prod.id]||{}, origVProd=_originalVentaForEdit.productos.find(p=>p.id===prod.id), precios=prod.precios||{und:prod.precioPorUnidad||0};
             const fPrice = (v) => { if (isNaN(v)) v=0; if (_monedaActual==='COP'&&_tasaCOP>0) return `COP ${(Math.ceil((v*_tasaCOP)/100)*100).toLocaleString('es-CO')}`; if (_monedaActual==='Bs'&&_tasaBs>0) return `Bs.S ${(v*_tasaBs).toLocaleString('es-VE',{minimumFractionDigits:2,maximumFractionDigits:2})}`; return `$${v.toFixed(2)}`; };
             const cERow = (t, cC, pT, descT) => { const cStockU=prod.cantidadUnidades||0, origUSoldT=origVProd?.cantidadVendida?.[t]||0; let factor=t==='cj'?(prod.unidadesPorCaja||1):t==='paq'?(prod.unidadesPorPaquete||1):1; const maxUAvail=cStockU+(origUSoldT*factor); const maxInp=Math.floor(maxUAvail/factor); const stockDispT=Math.floor(cStockU/factor); const r=document.createElement('tr'); r.className='border-b hover:bg-gray-50'; r.innerHTML=`<td class="py-2 px-1 text-center align-middle"> <input type="number" min="0" max="${maxInp}" value="${cC}" class="w-16 p-1 text-center border rounded-md" data-product-id="${prod.id}" data-tipo-venta="${t}" oninput="window.ventasModule.handleQuantityChange(event)"> </td> <td class="py-2 px-2 text-left align-middle">${descT} <span class="text-xs text-gray-500">${prod.marca||'S/M'}</span></td> <td class="py-2 px-2 text-left align-middle font-semibold price-toggle" onclick="window.ventasModule.toggleMoneda()">${fPrice(pT)}</td> <td class="py-2 px-1 text-center align-middle">${stockDispT} ${t.toUpperCase()}</td>`; body.appendChild(r); };
             if (vPor.cj) { const uCj=prod.unidadesPorCaja||1; cERow('cj', vActProd.cantCj||0, precios.cj||0, `${prod.presentacion} (Cj/${uCj} und)`); }
             if (vPor.paq) { const uPaq=prod.unidadesPorPaquete||1; cERow('paq', vActProd.cantPaq||0, precios.paq||0, `${prod.presentacion} (Paq/${uPaq} und)`); }
             if (vPor.und) { cERow('und', vActProd.cantUnd||0, precios.und||0, `${prod.presentacion} (Und)`); }
        }); updateVentaTotal();
    }

    async function handleGuardarVentaEditada() {
        if (!_originalVentaForEdit) { _showModal('Error', 'Venta original no encontrada.'); return; }
        const prods = Object.values(_ventaActual.productos).filter(p => p.totalUnidadesVendidas > 0); const hayVac = Object.values(_ventaActual.vaciosDevueltosPorTipo).some(c=>c>0);
        if (prods.length === 0 && !hayVac) { _showModal('Error', 'Venta editada sin productos o vacíos.'); return; }
        _showModal('Confirmar Cambios', '¿Guardar cambios? Stock y saldos se ajustarán.', async () => {
            _showModal('Progreso', 'Guardando y ajustando...');
            try {
                const batch=_writeBatch(_db); const origProds=new Map((_originalVentaForEdit.productos||[]).map(p=>[p.id,p])); const newProds=new Map(Object.values(_ventaActual.productos).map(p=>[p.id,p])); const allPIds=new Set([...origProds.keys(),...newProds.keys()]); const vaciosAdj={}; TIPOS_VACIO.forEach(t=>vaciosAdj[t]=0);
                for(const pId of allPIds){ const origP=origProds.get(pId), newP=newProds.get(pId), pCache=_inventarioCache.find(p=>p.id===pId); if(!pCache)continue; const origU=origP?(origP.totalUnidadesVendidas||0):0, newU=newP?(newP.totalUnidadesVendidas||0):0, deltaU=origU-newU;
                    if(deltaU!==0){ const cStockU=pCache.cantidadUnidades||0, fStockU=cStockU+deltaU; if(fStockU<0)throw new Error(`Stock insuficiente "${pCache.presentacion}".`); const pRef=_doc(_db,`artifacts/${_appId}/users/${_userId}/inventario`,pId); batch.update(pRef,{cantidadUnidades:fStockU}); }
                    if(pCache.manejaVacios&&pCache.tipoVacio){ const tV=pCache.tipoVacio, origCj=origP?.cantidadVendida?.cj||0, newCj=newP?.cantCj||0, deltaCj=newCj-origCj; if(vaciosAdj.hasOwnProperty(tV))vaciosAdj[tV]+=deltaCj; } }
                const origVac=_originalVentaForEdit.vaciosDevueltosPorTipo||{}, newVac=_ventaActual.vaciosDevueltosPorTipo||{}; TIPOS_VACIO.forEach(t=>{const origD=origVac[t]||0, newD=newVac[t]||0, deltaD=newD-origD; if(vaciosAdj.hasOwnProperty(t))vaciosAdj[t]-=deltaD;});
                if(Object.values(vaciosAdj).some(a=>a!==0)){const cliRef=_doc(_db,`artifacts/ventas-9a210/public/data/clientes`,_originalVentaForEdit.clienteId); try{await _runTransaction(_db,async(t)=>{const cliDoc=await t.get(cliRef); if(!cliDoc.exists())return; const cliData=cliDoc.data(), sVac=cliData.saldoVacios||{}; for(const tV in vaciosAdj){const adj=vaciosAdj[tV]; if(adj!==0&&sVac.hasOwnProperty(tV))sVac[tV]=(sVac[tV]||0)+adj;} t.update(cliRef,{saldoVacios:sVac});});} catch(transErr){console.error(`Error ajustando vacíos cli ${_originalVentaForEdit.clienteId}:`,transErr); _showModal('Advertencia','No se ajustaron saldos vacíos.');}}
                let nTotal=0; const nItems=Object.values(_ventaActual.productos).filter(p=>p.totalUnidadesVendidas>0).map(p=>{ const pr=p.precios||{und:p.precioPorUnidad||0}; const sub=(pr.cj||0)*(p.cantCj||0)+(pr.paq||0)*(p.cantPaq||0)+(pr.und||0)*(p.cantUnd||0); nTotal+=sub; const uCj=p.unidadesPorCaja||1, uPaq=p.unidadesPorPaquete||1; const totURecalc=(p.cantCj||0)*uCj+(p.cantPaq||0)*uPaq+(p.cantUnd||0); return { id:p.id, presentacion:p.presentacion, rubro:p.rubro??null, marca:p.marca??null, segmento:p.segmento??null, precios:p.precios, ventaPor:p.ventaPor, unidadesPorPaquete:p.unidadesPorPaquete, unidadesPorCaja:p.unidadesPorCaja, cantidadVendida:{cj:p.cantCj||0,paq:p.cantPaq||0,und:p.cantUnd||0}, totalUnidadesVendidas:totURecalc, iva:p.iva??0, manejaVacios:p.manejaVacios||false, tipoVacio:p.tipoVacio||null }; });
                const vRef=_doc(_db,`artifacts/${_appId}/users/${_userId}/ventas`,_originalVentaForEdit.id); batch.update(vRef,{productos:nItems, total:nTotal, vaciosDevueltosPorTipo:_ventaActual.vaciosDevueltosPorTipo, fechaModificacion:new Date()});
                await batch.commit(); _originalVentaForEdit=null; _showModal('Éxito','Venta actualizada.',showVentasActualesView);
            } catch (error) { console.error("Error guardando edit:", error); _showModal('Error', `Error: ${error.message}`); }
        }, 'Sí, Guardar', null, true);
    }

    window.ventasModule = {
        toggleMoneda,
        handleQuantityChange,
        handleTipoVacioChange,
        showPastSaleOptions,
        editVenta,
        deleteVenta,
        invalidateCache: () => { /* No action needed */ }
    };
})();

