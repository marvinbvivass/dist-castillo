// --- Lógica del módulo de Ventas ---

(function() {
    // Variables locales del módulo
    let _db, _userId, _appId, _mainContent, _floatingControls, _activeListeners;
    let _showMainMenu, _showModal;
    let _collection, _onSnapshot, _doc, _getDoc, _addDoc, _setDoc, _deleteDoc, _getDocs, _writeBatch, _runTransaction, _query, _where;
    
    // Cachés de datos locales para este módulo
    let _clientesCache = [];
    let _inventarioCache = [];
    let _ventasGlobal = [];
    
    // Estado local de una venta en progreso
    let _ventaActual = { cliente: null, productos: {} };
    let _tasaCOP = 0;
    let _monedaActual = 'USD';

    /**
     * Inicializa el módulo con las dependencias de la app principal.
     */
    window.initVentas = function(dependencies) {
        _db = dependencies.db;
        _userId = dependencies.userId;
        _appId = dependencies.appId;
        _mainContent = dependencies.mainContent;
        _floatingControls = dependencies.floatingControls;
        _activeListeners = dependencies.activeListeners;
        _showMainMenu = dependencies.showMainMenu;
        _showModal = dependencies.showModal;
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

    /**
     * Renderiza la vista principal de ventas.
     */
    window.showVentasView = function() {
        _floatingControls.classList.add('hidden');
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl text-center">
                        <h1 class="text-3xl font-bold text-gray-800 mb-6">Gestión de Ventas</h1>
                        <div class="space-y-4">
                            <button id="nuevaVentaBtn" class="w-full px-6 py-3 bg-green-500 text-white font-semibold rounded-lg shadow-md hover:bg-green-600">Nueva Venta</button>
                            <button id="ventasTotalesBtn" class="w-full px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg shadow-md hover:bg-blue-600">Ventas Totales</button>
                            <button id="backToMenuBtn" class="w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('nuevaVentaBtn').addEventListener('click', showNuevaVentaView);
        document.getElementById('ventasTotalesBtn').addEventListener('click', showVentasTotalesView);
        document.getElementById('backToMenuBtn').addEventListener('click', _showMainMenu);
    }
    
    /**
     * Renderiza la vista para iniciar una nueva venta.
     */
    function showNuevaVentaView() {
        _floatingControls.classList.add('hidden');
        _monedaActual = 'USD';
        _ventaActual = { cliente: null, productos: {} };
        _mainContent.innerHTML = `
            <div class="p-2 sm:p-4 w-full">
                <div class="bg-white/90 backdrop-blur-sm p-4 sm:p-6 rounded-lg shadow-xl flex flex-col h-full" style="min-height: calc(100vh - 2rem);">
                    <div id="venta-header-section" class="mb-4">
                        <div class="flex justify-between items-center mb-4">
                            <h2 class="text-xl font-bold text-gray-800">Nueva Venta</h2>
                            <button id="backToVentasBtn" class="px-4 py-2 bg-gray-400 text-white text-sm font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver</button>
                        </div>
                        <div id="client-search-container">
                            <label for="clienteSearch" class="block text-gray-700 font-medium mb-2">Seleccionar Cliente:</label>
                            <div class="relative"><input type="text" id="clienteSearch" placeholder="Buscar cliente..." class="w-full px-4 py-2 border rounded-lg"><div id="clienteDropdown" class="autocomplete-list hidden"></div></div>
                        </div>
                        <div id="client-display-container" class="hidden flex-wrap items-center justify-between gap-4">
                            <p class="text-gray-700 flex-grow"><span class="font-medium">Cliente:</span> <span id="selected-client-name" class="font-bold"></span></p>
                            <div id="tasaCopContainer" class="flex items-center space-x-2">
                                 <label for="tasaCopInput" class="block text-gray-700 text-sm font-medium">Tasa (USD/COP):</label>
                                <input type="number" id="tasaCopInput" placeholder="Ej: 4000" class="w-28 px-2 py-1 border rounded-lg">
                            </div>
                        </div>
                    </div>
                    <div id="inventarioTableContainer" class="hidden animate-fade-in flex-grow flex flex-col overflow-hidden">
                         <div class="flex justify-between items-center mb-2">
                            <h3 class="text-lg font-semibold text-gray-800">Inventario <span id="monedaIndicator" class="text-sm font-normal text-gray-500">(USD)</span></h3>
                             <div id="rubro-filter-container" class="w-1/2">
                                <select id="rubroFilter" class="w-full px-2 py-1 border rounded-lg text-sm"><option value="">Todos los Rubros</option></select>
                            </div>
                        </div>
                        <div class="overflow-auto flex-grow rounded-lg shadow">
                            <table class="min-w-full bg-white text-xs"><thead class="bg-gray-200 sticky top-0"><tr class="text-gray-700 uppercase leading-normal"><th class="py-2 px-1 text-center">Cant.</th><th class="py-2 px-2 text-left">Producto</th><th class="py-2 px-2 text-left price-toggle" onclick="window.ventasModule.toggleMoneda()">Precio</th><th class="py-2 px-1 text-center">Stock</th></tr></thead><tbody id="inventarioTableBody" class="text-gray-600 font-light"></tbody></table>
                        </div>
                    </div>
                    <div id="venta-footer-section" class="mt-4 flex items-center justify-between hidden">
                        <span id="ventaTotal" class="text-lg font-bold text-gray-800">Total: $0.00</span>
                         <button id="generarTicketBtn" class="px-6 py-3 bg-green-500 text-white font-semibold rounded-lg shadow-md hover:bg-green-600">Generar Ticket</button>
                    </div>
                </div>
            </div>
        `;
        
        const clienteSearchInput = document.getElementById('clienteSearch');
        clienteSearchInput.addEventListener('input', () => {
            const searchTerm = clienteSearchInput.value.toLowerCase();
            const filteredClients = _clientesCache.filter(c => c.nombreComercial.toLowerCase().includes(searchTerm) || c.nombrePersonal.toLowerCase().includes(searchTerm));
            renderClienteDropdown(filteredClients);
            document.getElementById('clienteDropdown').classList.remove('hidden');
        });
        
        const savedTasa = localStorage.getItem('tasaCOP');
        if (savedTasa) {
            _tasaCOP = parseFloat(savedTasa);
            document.getElementById('tasaCopInput').value = _tasaCOP;
        }

        document.getElementById('tasaCopInput').addEventListener('input', (e) => {
            _tasaCOP = parseFloat(e.target.value) || 0;
            localStorage.setItem('tasaCOP', _tasaCOP);
            renderVentasInventario();
        });
        
        document.getElementById('rubroFilter').addEventListener('change', renderVentasInventario);
        document.getElementById('generarTicketBtn').addEventListener('click', generarTicket);
        document.getElementById('backToVentasBtn').addEventListener('click', showVentasView);
        
        loadDataForNewSale();
    }
    
    /**
     * Carga los datos de clientes e inventario y popula el filtro de rubros.
     */
    function loadDataForNewSale() {
        const clientesRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/clientes`);
        const unsubClientes = _onSnapshot(clientesRef, (snapshot) => {
            _clientesCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        });

        const inventarioRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`);
        const unsubInventario = _onSnapshot(inventarioRef, (snapshot) => {
            _inventarioCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            populateRubroFilter();
            if (_ventaActual.cliente) {
                renderVentasInventario();
            }
        });

        _activeListeners.push(unsubClientes, unsubInventario);
    }
    
    /**
     * Popula el filtro de rubros.
     */
    function populateRubroFilter() {
        const rubroFilter = document.getElementById('rubroFilter');
        if(!rubroFilter) return;
        const rubros = [...new Set(_inventarioCache.map(p => p.rubro))].sort();
        rubroFilter.innerHTML = '<option value="">Todos los Rubros</option>';
        rubros.forEach(rubro => {
             if(rubro) rubroFilter.innerHTML += `<option value="${rubro}">${rubro}</option>`;
        });
    }

    /**
     * Renderiza el dropdown de clientes.
     */
    function renderClienteDropdown(filteredClients) {
        const clienteDropdown = document.getElementById('clienteDropdown');
        if(!clienteDropdown) return;
        clienteDropdown.innerHTML = '';
        filteredClients.forEach(cliente => {
            const item = document.createElement('div');
            item.className = 'autocomplete-item';
            item.textContent = `${cliente.nombreComercial} (${cliente.nombrePersonal})`;
            item.addEventListener('click', () => selectCliente(cliente));
            clienteDropdown.appendChild(item);
        });
    }

    /**
     * Selecciona un cliente y muestra la tabla de inventario.
     */
    function selectCliente(cliente) {
        _ventaActual.cliente = cliente;
        document.getElementById('client-search-container').classList.add('hidden');
        document.getElementById('clienteDropdown').classList.add('hidden');
        document.getElementById('selected-client-name').textContent = cliente.nombreComercial;
        document.getElementById('client-display-container').classList.remove('hidden');
        document.getElementById('inventarioTableContainer').classList.remove('hidden');
        document.getElementById('venta-footer-section').classList.remove('hidden');
        renderVentasInventario();
    }
    
    /**
     * Cambia la moneda de visualización.
     */
    function toggleMoneda() {
        if (_tasaCOP <= 0 && _monedaActual === 'USD') {
            _showModal('Aviso', 'Ingresa una tasa de cambio válida para ver precios en COP.');
            return;
        }
        _monedaActual = _monedaActual === 'USD' ? 'COP' : 'USD';
        renderVentasInventario();
        updateVentaTotal();
    }

    /**
     * Renderiza la tabla de inventario para la venta.
     */
    function renderVentasInventario() {
        const inventarioTableBody = document.getElementById('inventarioTableBody');
        const monedaIndicator = document.getElementById('monedaIndicator');
        const rubroFilter = document.getElementById('rubroFilter');

        if (!inventarioTableBody || !monedaIndicator || !rubroFilter) return;
        inventarioTableBody.innerHTML = '';

        monedaIndicator.textContent = `(${_monedaActual})`;
        
        const selectedRubro = rubroFilter.value;
        const inventarioConStock = _inventarioCache.filter(p => p.cantidad > 0);
        const filteredInventario = selectedRubro ? inventarioConStock.filter(p => p.rubro === selectedRubro) : inventarioConStock;

        const productosAgrupados = filteredInventario.reduce((acc, p) => {
            const marca = p.marca || 'Sin Marca';
            if (!acc[marca]) acc[marca] = [];
            acc[marca].push(p);
            return acc;
        }, {});

        const marcasOrdenadas = Object.keys(productosAgrupados).sort((a, b) => a.localeCompare(b));

        if (marcasOrdenadas.length === 0) {
            inventarioTableBody.innerHTML = `<tr><td colspan="4" class="py-3 px-6 text-center">No hay productos que coincidan.</td></tr>`;
            return;
        }

        marcasOrdenadas.forEach(marca => {
            const marcaRow = document.createElement('tr');
            marcaRow.innerHTML = `<td colspan="4" class="py-1 px-2 bg-gray-100 font-bold text-gray-700 text-sm">${marca}</td>`;
            inventarioTableBody.appendChild(marcaRow);

            productosAgrupados[marca].sort((a,b) => a.presentacion.localeCompare(b.presentacion)).forEach(producto => {
                const row = document.createElement('tr');
                row.classList.add('border-b', 'border-gray-200', 'hover:bg-gray-50');

                let precioMostrado;
                if (_monedaActual === 'COP') {
                    const precioConvertido = producto.precio * _tasaCOP;
                    const precioRedondeado = Math.ceil(precioConvertido / 100) * 100;
                    precioMostrado = `COP ${precioRedondeado.toLocaleString('es-CO')}`;
                } else {
                    precioMostrado = `$${producto.precio.toFixed(2)}`;
                }

                row.innerHTML = `
                    <td class="py-1 px-1 text-center">
                        <input type="number" min="0" max="${producto.cantidad}" value="${_ventaActual.productos[producto.id]?.cantidadVendida || 0}"
                               class="w-12 p-1 text-center border rounded-lg text-sm" data-product-id="${producto.id}"
                               oninput="window.ventasModule.updateVentaCantidad(event)">
                    </td>
                    <td class="py-1 px-2 text-left whitespace-nowrap">${producto.presentacion} <span class="text-gray-500">(${producto.unidadTipo || 'und.'})</span></td>
                    <td class="py-1 px-2 text-left price-toggle" onclick="window.ventasModule.toggleMoneda()">${precioMostrado}</td>
                    <td class="py-1 px-1 text-center">${producto.cantidad}</td>
                `;
                inventarioTableBody.appendChild(row);
            });
        });
    }

    /**
     * Actualiza la cantidad de un producto y el total.
     */
    function updateVentaCantidad(event) {
        const { productId } = event.target.dataset;
        const cantidad = parseInt(event.target.value, 10);
        const producto = _inventarioCache.find(p => p.id === productId);
        if (cantidad > producto.cantidad) {
            event.target.value = producto.cantidad;
             _showModal('Stock Insuficiente', `Solo quedan ${producto.cantidad} unidades de ${producto.presentacion}.`);
        }
        
        const cantidadFinal = parseInt(event.target.value, 10);
        
        if (cantidadFinal > 0) {
            _ventaActual.productos[productId] = { ...producto, cantidadVendida: cantidadFinal };
        } else {
            delete _ventaActual.productos[productId];
        }
        updateVentaTotal();
    };

    /**
     * Calcula y muestra el total de la venta.
     */
    function updateVentaTotal() {
        const totalEl = document.getElementById('ventaTotal');
        if(!totalEl) return;
        let total = Object.values(_ventaActual.productos).reduce((sum, p) => sum + (p.precio * p.cantidadVendida), 0);
        
        if (_monedaActual === 'COP') {
            const totalCOP = total * _tasaCOP;
            const totalRedondeado = Math.ceil(totalCOP / 100) * 100;
            totalEl.textContent = `Total: COP ${totalRedondeado.toLocaleString('es-CO')}`;
        } else {
            totalEl.textContent = `Total: $${total.toFixed(2)}`;
        }
    }
    
    /**
     * Crea el HTML para un ticket/factura.
     */
    function createTicketHTML(venta, productos, tipo = 'ticket') {
        const fecha = venta.fecha ? venta.fecha.toDate().toLocaleString('es-VE') : new Date().toLocaleString('es-VE');
        const clienteNombre = venta.cliente ? venta.cliente.nombreComercial : venta.clienteNombre;
        let total = 0;
        
        let productosHTML = productos.map(p => {
            const subtotal = p.precio * p.cantidadVendida;
            total += subtotal;
            return `
                <tr>
                    <td class="px-1 py-1 text-left">${p.presentacion}</td>
                    <td class="px-1 py-1 text-center">${p.cantidadVendida}</td>
                    <td class="px-1 py-1 text-right">$${p.precio.toFixed(2)}</td>
                    <td class="px-1 py-1 text-right">$${subtotal.toFixed(2)}</td>
                </tr>
            `;
        }).join('');

        return `
            <div id="temp-ticket-for-image" class="p-4 bg-white text-black font-mono" style="width: 384px;">
                <div class="text-center">
                    <h2 class="text-xl font-bold uppercase">Nombre Empresa</h2>
                    <p class="text-xs">Dirección de la Empresa, Ciudad</p>
                    <p class="text-xs">RIF: J-12345678-9</p>
                    <p class="text-xs">Teléfono: (0412) 123-4567</p>
                </div>
                <hr class="my-2 border-black border-dashed">
                <div class="text-xs">
                    <p><strong>Fecha:</strong> ${fecha}</p>
                    <p><strong>Cliente:</strong> ${clienteNombre}</p>
                </div>
                <hr class="my-2 border-black border-dashed">
                <table class="w-full text-xs">
                    <thead>
                        <tr>
                            <th class="px-1 py-1 text-left">Producto</th>
                            <th class="px-1 py-1 text-center">Cant</th>
                            <th class="px-1 py-1 text-right">Precio</th>
                            <th class="px-1 py-1 text-right">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>${productosHTML}</tbody>
                </table>
                <hr class="my-2 border-black border-dashed">
                <div class="text-right font-bold text-sm">
                    <p>TOTAL: $${total.toFixed(2)}</p>
                </div>
                <div class="text-center mt-4 text-xs">
                    <p>¡Gracias por su compra!</p>
                    ${tipo === 'factura' ? '<p class="font-bold">FACTURA FISCAL</p>' : ''}
                </div>
            </div>
        `;
    }

    /**
     * Maneja la generación y compartición de la imagen del ticket.
     */
    async function handleShareTicket(htmlContent, successCallback) {
        _showModal('Progreso', 'Generando imagen del ticket...');
        const tempDiv = document.createElement('div');
        tempDiv.style.position = 'absolute';
        tempDiv.style.left = '-9999px';
        tempDiv.style.top = '0';
        tempDiv.innerHTML = htmlContent;
        document.body.appendChild(tempDiv);
        
        try {
            await new Promise(resolve => setTimeout(resolve, 100));
            const canvas = await html2canvas(tempDiv.firstChild, { scale: 3 });
            canvas.toBlob(async (blob) => {
                if (navigator.share && blob) {
                     _showModal('Progreso', 'Abriendo diálogo para compartir...');
                    try {
                        await navigator.share({ files: [new File([blob], "ticket.png", { type: "image/png" })], title: "Ticket de Venta" });
                        _showModal('Éxito', 'Venta registrada y ticket compartido.', successCallback);
                    } catch(shareError) {
                        _showModal('Aviso', 'No se compartió el ticket, pero la venta fue registrada.', successCallback);
                    }
                } else {
                     _showModal('Error', 'La función de compartir no está disponible en este navegador.', successCallback);
                }
            }, 'image/png');
        } catch(e) {
            console.error(e);
            _showModal('Error', `No se pudo generar la imagen del ticket. ${e.message}`, successCallback);
        } finally {
            document.body.removeChild(tempDiv);
        }
    }

    /**
     * Genera un ticket y guarda la venta.
     */
    async function generarTicket() {
        if (!_ventaActual.cliente) {
            _showModal('Error', 'Debe seleccionar un cliente para generar el ticket.');
            return;
        }
        const productosVendidos = Object.values(_ventaActual.productos);
        if (productosVendidos.length === 0) {
            _showModal('Error', 'Debe agregar al menos un producto para vender.');
            return;
        }

        _showModal('Confirmar Venta', '¿Deseas guardar esta venta y generar el ticket?', async () => {
            _showModal('Progreso', 'Procesando venta...');
            try {
                await _runTransaction(_db, async (transaction) => {
                    const ventaRef = _doc(_collection(_db, `artifacts/${_appId}/users/${_userId}/ventas`));
                    let totalVenta = 0;
                    const itemsVenta = [];

                    for (const p of productosVendidos) {
                        const productoRef = _doc(_db, `artifacts/${_appId}/users/${_userId}/inventario`, p.id);
                        const productoDoc = await transaction.get(productoRef);
                        if (!productoDoc.exists()) throw new Error(`El producto "${p.presentacion}" ya no existe.`);
                        const stockActual = productoDoc.data().cantidad;
                        if (stockActual < p.cantidadVendida) throw new Error(`Stock insuficiente para ${p.presentacion}.`);
                        transaction.update(productoRef, { cantidad: stockActual - p.cantidadVendida });
                        totalVenta += p.precio * p.cantidadVendida;
                        itemsVenta.push({ id: p.id, presentacion: p.presentacion, marca: p.marca ?? null, segmento: p.segmento ?? null, precio: p.precio, cantidadVendida: p.cantidadVendida, iva: p.iva ?? 0, unidadTipo: p.unidadTipo ?? 'und.' });
                    }
                    transaction.set(ventaRef, { clienteId: _ventaActual.cliente.id, clienteNombre: _ventaActual.cliente.nombreComercial || _ventaActual.cliente.nombrePersonal, fecha: new Date(), total: totalVenta, productos: itemsVenta });
                });

                const ticketHTML = createTicketHTML(_ventaActual, productosVendidos, 'ticket');
                await handleShareTicket(ticketHTML, showNuevaVentaView);

            } catch (e) {
                _showModal('Error', `Hubo un error al procesar la venta: ${e.message}`);
            }
        });
    }

    /**
     * Muestra la vista de ventas totales.
     */
    function showVentasTotalesView() {
        _floatingControls.classList.add('hidden');
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl text-center">
                        <h2 class="text-2xl font-bold text-gray-800 mb-6">Ventas Totales</h2>
                        <div class="space-y-4">
                            <button id="ventasActualesBtn" class="w-full px-6 py-3 bg-teal-500 text-white font-semibold rounded-lg shadow-md hover:bg-teal-600">Ventas Actuales</button>
                            <button id="cierreVentasBtn" class="w-full px-6 py-3 bg-red-500 text-white font-semibold rounded-lg shadow-md hover:bg-red-600">Cierre de Ventas</button>
                        </div>
                        <button id="backToVentasBtn" class="mt-6 w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver</button>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('ventasActualesBtn').addEventListener('click', showVentasActualesView);
        document.getElementById('cierreVentasBtn').addEventListener('click', showCierreSubMenuView);
        document.getElementById('backToVentasBtn').addEventListener('click', showVentasView);
    }
    
    /**
     * Muestra la vista con la lista de todas las ventas actuales.
     */
    function showVentasActualesView() {
        _floatingControls.classList.add('hidden');
        _mainContent.innerHTML = `
            <div class="p-4 w-full">
                <div class="bg-white/90 backdrop-blur-sm p-6 rounded-lg shadow-xl">
                    <div class="flex justify-between items-center mb-6">
                        <h2 class="text-2xl font-bold text-gray-800">Ventas Actuales</h2>
                        <button id="backToVentasTotalesBtn" class="px-4 py-2 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver</button>
                    </div>
                    <div id="ventasListContainer" class="overflow-x-auto"><p class="text-gray-500 text-center">Cargando ventas...</p></div>
                </div>
            </div>
        `;
        document.getElementById('backToVentasTotalesBtn').addEventListener('click', showVentasTotalesView);
        renderVentasList();
    }

    /**
     * Renderiza la lista de ventas en el DOM.
     */
    function renderVentasList() {
        const container = document.getElementById('ventasListContainer');
        if (!container) return;

        const ventasRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/ventas`);
        const q = _query(ventasRef);
        const unsubscribe = _onSnapshot(q, (snapshot) => {
            _ventasGlobal = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            _ventasGlobal.sort((a, b) => b.fecha.toDate() - a.fecha.toDate());

            if (_ventasGlobal.length === 0) {
                container.innerHTML = `<p class="text-center text-gray-500">No hay ventas registradas.</p>`;
                return;
            }

            let tableHTML = `
                <table class="min-w-full bg-white text-sm">
                    <thead class="bg-gray-200">
                        <tr>
                            <th class="py-2 px-3 border-b text-left">Cliente</th>
                            <th class="py-2 px-3 border-b text-left">Fecha</th>
                            <th class="py-2 px-3 border-b text-right">Total</th>
                            <th class="py-2 px-3 border-b text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            _ventasGlobal.forEach(venta => {
                tableHTML += `
                    <tr class="hover:bg-gray-50">
                        <td class="py-2 px-3 border-b">${venta.clienteNombre}</td>
                        <td class="py-2 px-3 border-b">${venta.fecha.toDate().toLocaleDateString('es-ES')}</td>
                        <td class="py-2 px-3 border-b text-right font-semibold">$${venta.total.toFixed(2)}</td>
                        <td class="py-2 px-3 border-b text-center space-x-1">
                            <button onclick="window.ventasModule.shareSaleTicket('${venta.id}')" class="px-3 py-1 bg-blue-500 text-white text-xs rounded-lg hover:bg-blue-600">Ticket</button>
                            <button onclick="window.ventasModule.mostrarFactura('${venta.id}')" class="px-3 py-1 bg-green-500 text-white text-xs rounded-lg hover:bg-green-600">Factura</button>
                        </td>
                    </tr>
                `;
            });
            tableHTML += `</tbody></table>`;
            container.innerHTML = tableHTML;
        }, (error) => {
            console.error("Error cargando ventas: ", error);
            container.innerHTML = `<p class="text-center text-red-500">Error al cargar las ventas.</p>`;
        });
        _activeListeners.push(unsubscribe);
    }
    
    /**
     * Muestra el submenú de opciones para el cierre de ventas.
     */
    function showCierreSubMenuView() {
         _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl text-center">
                        <h2 class="text-2xl font-bold text-gray-800 mb-6">Cierre de Ventas</h2>
                        <div class="space-y-4">
                            <button id="verCierreBtn" class="w-full px-6 py-3 bg-cyan-500 text-white font-semibold rounded-lg shadow-md hover:bg-cyan-600">Ver Cierre</button>
                            <button id="ejecutarCierreBtn" class="w-full px-6 py-3 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700">Ejecutar Cierre</button>
                        </div>
                        <button id="backToVentasTotalesBtn" class="mt-6 w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver</button>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('verCierreBtn').addEventListener('click', showVerCierreView);
        document.getElementById('ejecutarCierreBtn').addEventListener('click', ejecutarCierre);
        document.getElementById('backToVentasTotalesBtn').addEventListener('click', showVentasTotalesView);
    }
    
    /**
     * Muestra una vista previa del reporte de cierre de ventas.
     */
    async function showVerCierreView() {
        _showModal('Progreso', 'Generando reporte de cierre...');
        const ventasSnapshot = await _getDocs(_collection(_db, `artifacts/${_appId}/users/${_userId}/ventas`));
        const ventas = ventasSnapshot.docs.map(doc => doc.data());

        if (ventas.length === 0) {
            _showModal('Aviso', 'No hay ventas para generar un cierre.');
            return;
        }

        let totalGeneral = 0;
        const productosVendidos = {};

        ventas.forEach(venta => {
            totalGeneral += venta.total;
            venta.productos.forEach(p => {
                if (!productosVendidos[p.presentacion]) {
                    productosVendidos[p.presentacion] = { cantidad: 0, total: 0 };
                }
                productosVendidos[p.presentacion].cantidad += p.cantidadVendida;
                productosVendidos[p.presentacion].total += p.precio * p.cantidadVendida;
            });
        });
        
        let productosHTML = Object.keys(productosVendidos).sort().map(nombre => `
            <tr>
                <td class="py-1 px-2 border-b">${nombre}</td>
                <td class="py-1 px-2 border-b text-center">${productosVendidos[nombre].cantidad}</td>
                <td class="py-1 px-2 border-b text-right">$${productosVendidos[nombre].total.toFixed(2)}</td>
            </tr>
        `).join('');

        const reporteHTML = `
            <div class="text-left max-h-[70vh] overflow-y-auto">
                <h3 class="text-xl font-bold text-gray-800 mb-4">Reporte de Cierre de Ventas</h3>
                <p><strong>Fecha del Reporte:</strong> ${new Date().toLocaleDateString('es-ES')}</p>
                <p class="font-bold text-lg"><strong>Total General Vendido:</strong> $${totalGeneral.toFixed(2)}</p>
                <p><strong>Número de Ventas:</strong> ${ventas.length}</p>
                <h4 class="font-bold mt-4 mb-2">Resumen de Productos Vendidos:</h4>
                <table class="min-w-full bg-white text-sm">
                    <thead class="bg-gray-100"><tr>
                        <th class="py-1 px-2 border-b text-left">Producto</th>
                        <th class="py-1 px-2 border-b text-center">Cantidad</th>
                        <th class="py-1 px-2 border-b text-right">Total</th>
                    </tr></thead>
                    <tbody>${productosHTML}</tbody>
                </table>
            </div>`;
        _showModal('Reporte de Cierre', reporteHTML);
    }

    /**
     * Ejecuta el cierre de ventas: archiva y elimina.
     */
    function ejecutarCierre() {
        _showModal('Confirmar Cierre Definitivo', 
            'Esta acción archivará las ventas actuales y las eliminará. No se puede deshacer. ¿Continuar?', 
            async () => {
                _showModal('Progreso', 'Ejecutando cierre...');
                const ventasRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/ventas`);
                const ventasSnapshot = await _getDocs(ventasRef);
                const ventas = ventasSnapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
                
                if (ventas.length === 0) {
                    _showModal('Aviso', 'No hay ventas para cerrar.');
                    return;
                }

                try {
                    const cierreRef = _doc(_collection(_db, `artifacts/${_appId}/users/${_userId}/cierres`));
                    await _setDoc(cierreRef, {
                        fecha: new Date(),
                        ventas: ventas.map(({id, ...rest}) => rest), // Guardar sin el ID de documento
                        total: ventas.reduce((sum, v) => sum + v.total, 0)
                    });

                    const batch = _writeBatch(_db);
                    ventas.forEach(venta => {
                        batch.delete(_doc(ventasRef, venta.id));
                    });
                    await batch.commit();

                    _showModal('Éxito', 'El cierre de ventas se ha completado correctamente.', showVentasTotalesView);
                } catch(e) {
                    _showModal('Error', `Ocurrió un error durante el cierre: ${e.message}`);
                }
            },
            'Sí, Ejecutar Cierre'
        );
    }
    
     /**
     * Re-genera y comparte un ticket de una venta existente.
     */
    async function shareSaleTicket(ventaId) {
        const venta = _ventasGlobal.find(v => v.id === ventaId);
        if (venta) {
            const ticketHTML = createTicketHTML(venta, venta.productos, 'ticket');
            await handleShareTicket(ticketHTML, () => {});
        } else {
            _showModal('Error', 'No se encontró la venta seleccionada.');
        }
    }

    /**
     * Re-genera y comparte una factura fiscal de una venta existente.
     */
    async function mostrarFactura(ventaId) {
        const venta = _ventasGlobal.find(v => v.id === ventaId);
        if (venta) {
            const facturaHTML = createTicketHTML(venta, venta.productos, 'factura');
            await handleShareTicket(facturaHTML, () => {});
        } else {
            _showModal('Error', 'No se encontró la venta seleccionada.');
        }
    }

    // Exponer funciones públicas al objeto window
    window.ventasModule = {
        toggleMoneda,
        updateVentaCantidad,
        shareSaleTicket,
        mostrarFactura
    };
})();
