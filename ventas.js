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
                            <button id="nuevaVentaBtn" class="w-full px-6 py-3 bg-green-500 text-white font-semibold rounded-lg shadow-md hover:bg-green-600 transition-all duration-300">Nueva Venta</button>
                            <button id="ventasTotalesBtn" class="w-full px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg shadow-md hover:bg-blue-600 transition-all duration-300">Ventas Totales</button>
                            <button id="backToMenuBtn" class="w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500 transition-all duration-300">Volver</button>
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
                            <button id="backToVentasBtn" class="px-4 py-2 bg-gray-400 text-white text-sm font-semibold rounded-lg shadow-md hover:bg-gray-500 transition-all duration-300">Volver</button>
                        </div>
                        <div id="client-search-container">
                            <label for="clienteSearch" class="block text-gray-700 font-medium mb-2">Seleccionar Cliente:</label>
                            <div class="relative"><input type="text" id="clienteSearch" placeholder="Buscar cliente..." class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"><div id="clienteDropdown" class="autocomplete-list hidden"></div></div>
                        </div>
                        <div id="client-display-container" class="hidden flex-wrap items-center justify-between gap-4 p-3 bg-gray-50 rounded-lg">
                            <p class="text-gray-700 flex-grow"><span class="font-medium">Cliente:</span> <span id="selected-client-name" class="font-bold text-blue-600"></span></p>
                            <div id="tasaCopContainer" class="flex items-center space-x-2">
                                 <label for="tasaCopInput" class="block text-gray-700 text-sm font-medium">Tasa (USD/COP):</label>
                                <input type="number" id="tasaCopInput" placeholder="Ej: 4000" class="w-28 px-2 py-1 border rounded-lg focus:ring-2 focus:ring-blue-500">
                            </div>
                        </div>
                    </div>
                    <div id="inventarioTableContainer" class="hidden animate-fade-in flex-grow flex flex-col overflow-hidden">
                         <div class="flex justify-between items-center mb-2">
                            <h3 class="text-lg font-semibold text-gray-800">Inventario <span id="monedaIndicator" class="text-sm font-normal text-gray-500">(USD/COP)</span></h3>
                             <div id="rubro-filter-container" class="w-1/2">
                                <select id="rubroFilter" class="w-full px-2 py-1 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"><option value="">Todos los Rubros</option></select>
                            </div>
                        </div>
                        <div class="overflow-auto flex-grow rounded-lg shadow">
                            <table class="min-w-full bg-white text-xs"><thead class="bg-gray-200 sticky top-0"><tr class="text-gray-700 uppercase leading-normal"><th class="py-2 px-1 text-center">Cant.</th><th class="py-2 px-2 text-left">Producto</th><th class="py-2 px-2 text-left cursor-pointer price-toggle" onclick="window.ventasModule.toggleMoneda()">Precio ⇅</th><th class="py-2 px-1 text-center">Stock</th></tr></thead><tbody id="inventarioTableBody" class="text-gray-600 font-light"></tbody></table>
                        </div>
                    </div>
                    <div id="venta-footer-section" class="mt-4 flex items-center justify-between hidden pt-4 border-t">
                        <span id="ventaTotal" class="text-lg font-bold text-gray-800">Total: $0.00</span>
                         <button id="generarTicketBtn" class="px-6 py-3 bg-green-500 text-white font-semibold rounded-lg shadow-md hover:bg-green-600 transition-all duration-300">Generar Ticket</button>
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
            updateVentaTotal();
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
        if (filteredClients.length === 0) {
            clienteDropdown.classList.add('hidden');
            return;
        }
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
        document.getElementById('clienteDropdown').classList.add('hidden');
        document.getElementById('clienteSearch').value = '';
        document.getElementById('client-search-container').classList.add('hidden');
        document.getElementById('selected-client-name').textContent = cliente.nombreComercial || cliente.nombrePersonal;
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
        document.querySelector('.price-toggle').textContent = `Precio (${_monedaActual}) ⇅`;
        
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
                if (_monedaActual === 'COP' && _tasaCOP > 0) {
                    const precioConvertido = producto.precio * _tasaCOP;
                    const precioRedondeado = Math.ceil(precioConvertido / 100) * 100;
                    precioMostrado = `COP ${precioRedondeado.toLocaleString('es-CO')}`;
                } else {
                    precioMostrado = `$${producto.precio.toFixed(2)}`;
                }

                row.innerHTML = `
                    <td class="py-1 px-1 text-center">
                        <input type="number" min="0" max="${producto.cantidad}" value="${_ventaActual.productos[producto.id]?.cantidadVendida || 0}"
                               class="w-14 p-1 text-center border rounded-lg text-sm focus:ring-2 focus:ring-blue-500" data-product-id="${producto.id}"
                               oninput="window.ventasModule.updateVentaCantidad(event)">
                    </td>
                    <td class="py-1 px-2 text-left whitespace-nowrap">${producto.presentacion} <span class="text-gray-500">(${producto.unidadTipo || 'und.'})</span></td>
                    <td class="py-1 px-2 text-left cursor-pointer price-toggle" onclick="window.ventasModule.toggleMoneda()">${precioMostrado}</td>
                    <td class="py-1 px-1 text-center">${producto.cantidad}</td>
                `;
                inventarioTableBody.appendChild(row);
            });
        });
    }

    /**
     * Actualiza la cantidad de un producto en la venta actual.
     */
    function updateVentaCantidad(event) {
        const { productId } = event.target.dataset;
        const cantidad = parseInt(event.target.value, 10);
        const producto = _inventarioCache.find(p => p.id === productId);

        if (!producto) return;

        if (cantidad > producto.cantidad) {
            event.target.value = producto.cantidad;
            _showModal('Stock Insuficiente', `Solo quedan ${producto.cantidad} unidades de ${producto.presentacion}.`);
            return;
        }
        
        if (cantidad > 0) {
            _ventaActual.productos[productId] = { ...producto, cantidadVendida: cantidad };
        } else {
            delete _ventaActual.productos[productId];
        }
        updateVentaTotal();
    };

    /**
     * Calcula y muestra el total de la venta actual.
     */
    function updateVentaTotal() {
        const totalEl = document.getElementById('ventaTotal');
        if(!totalEl) return;
        let total = Object.values(_ventaActual.productos).reduce((sum, p) => sum + (p.precio * p.cantidadVendida), 0);
        
        if (_monedaActual === 'COP' && _tasaCOP > 0) {
            const totalCOP = Math.ceil((total * _tasaCOP) / 100) * 100;
            totalEl.textContent = `Total: COP ${totalCOP.toLocaleString('es-CO')}`;
        } else {
            totalEl.textContent = `Total: $${total.toFixed(2)}`;
        }
    }

    /**
     * Genera el HTML para un ticket o factura.
     */
    function generarHTMLDocumento(venta, productos, tipo = 'ticket') {
        const fecha = venta.fecha.toDate().toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' });
        const esFactura = tipo === 'factura';
        
        const productosHTML = productos.map(p => {
            const totalProducto = p.precio * p.cantidad;
            return `
                <div class="grid grid-cols-4 gap-2 text-xs py-1 border-b">
                    <div class="col-span-2">${p.presentacion}</div>
                    <div class="text-right">${p.cantidad} x $${p.precio.toFixed(2)}</div>
                    <div class="text-right font-semibold">$${totalProducto.toFixed(2)}</div>
                </div>
            `;
        }).join('');

        return `
            <div id="temp-ticket-for-image" class="p-4 bg-white text-gray-800 font-sans" style="width: 320px;">
                <div class="text-center mb-3">
                    <h2 class="text-lg font-bold">${esFactura ? 'FACTURA FISCAL' : 'TICKET DE VENTA'}</h2>
                    <p class="text-xs">Fecha: ${fecha}</p>
                </div>
                <div class="mb-3">
                    <h3 class="font-semibold text-sm">Cliente:</h3>
                    <p class="text-sm">${venta.clienteNombre}</p>
                    ${esFactura ? '<p class="text-xs">RIF: J-12345678-9</p>' : ''}
                </div>
                <div class="grid grid-cols-4 gap-2 font-bold text-xs mb-1 pb-1 border-b-2 border-black">
                    <div class="col-span-2">Producto</div>
                    <div class="text-right">Cant/Precio</div>
                    <div class="text-right">Total</div>
                </div>
                ${productosHTML}
                <div class="mt-3 text-right">
                    <p class="text-xs">Subtotal: <span class="font-semibold">$${venta.total.toFixed(2)}</span></p>
                    <p class="text-xs">IVA (16%): <span class="font-semibold">$${(venta.total * 0.16).toFixed(2)}</span></p>
                    <p class="text-base font-bold">Total a Pagar: <span class="font-semibold">$${(venta.total * 1.16).toFixed(2)}</span></p>
                </div>
                 ${esFactura ? '<p class="text-center text-xs mt-4">Gracias por su compra</p>' : ''}
            </div>
        `;
    }

    /**
     * Maneja la generación y compartición de la imagen del documento (ticket/factura).
     */
    async function handleShareDocument(venta, productos, tipo = 'ticket') {
        _showModal('Progreso', `Generando imagen del ${tipo}...`);
        const documentHTML = generarHTMLDocumento(venta, productos, tipo);
        const tempDiv = document.createElement('div');
        tempDiv.style.position = 'absolute';
        tempDiv.style.left = '-9999px';
        tempDiv.style.top = '0';
        tempDiv.innerHTML = documentHTML;
        document.body.appendChild(tempDiv);
        
        try {
            await new Promise(resolve => setTimeout(resolve, 100)); // Allow rendering
            const canvas = await html2canvas(document.getElementById('temp-ticket-for-image'), { scale: 3 });
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            
            if (navigator.share && blob) {
                const file = new File([blob], `${tipo}_${venta.id}.png`, { type: "image/png" });
                await navigator.share({
                    files: [file],
                    title: `${tipo.charAt(0).toUpperCase() + tipo.slice(1)} de Venta`,
                    text: `Aquí está el ${tipo} para la venta a ${venta.clienteNombre}.`
                });
                _showModal('Éxito', 'Documento compartido.');
            } else {
                 _showModal('Error', 'La función de compartir no está disponible en este navegador.');
            }
        } catch(e) {
            console.error("Error sharing document:", e);
            // Don't show modal if share was cancelled by user
            if (e.name !== 'AbortError') {
                _showModal('Error', 'No se pudo generar o compartir la imagen del documento.');
            }
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
            _showModal('Error', 'Debe seleccionar al menos un producto para vender.');
            return;
        }

        _showModal('Confirmar Venta', '¿Deseas guardar esta venta y generar el ticket?', async () => {
            _showModal('Progreso', 'Procesando venta...');
            try {
                const isOnline = document.getElementById('connectionStatus')?.textContent === 'EN LÍNEA';
                const totalVenta = productosVendidos.reduce((sum, p) => sum + (p.precio * p.cantidadVendida), 0);
                const itemsVenta = productosVendidos.map(p => ({ 
                    id: p.id, presentacion: p.presentacion, marca: p.marca, segmento: p.segmento, 
                    precio: p.precio, cantidad: p.cantidadVendida, iva: p.iva, unidadTipo: p.unidadTipo 
                }));
                const ventaData = {
                    clienteId: _ventaActual.cliente.id,
                    clienteNombre: _ventaActual.cliente.nombreComercial || _ventaActual.cliente.nombrePersonal,
                    fecha: new Date(),
                    total: totalVenta,
                    productos: itemsVenta
                };
                
                let ventaRef;

                if (isOnline) {
                    await _runTransaction(_db, async (transaction) => {
                        ventaRef = _doc(_collection(_db, `artifacts/${_appId}/users/${_userId}/ventas`));
                        const stockUpdates = [];

                        for (const p of productosVendidos) {
                            const productoRef = _doc(_db, `artifacts/${_appId}/users/${_userId}/inventario`, p.id);
                            const productoDoc = await transaction.get(productoRef);
                            if (!productoDoc.exists()) throw new Error(`El producto "${p.presentacion}" ya no existe.`);
                            const stockActual = productoDoc.data().cantidad;
                            if (stockActual < p.cantidadVendida) throw new Error(`Stock insuficiente para ${p.presentacion}.`);
                            stockUpdates.push({ ref: productoRef, nuevaCantidad: stockActual - p.cantidadVendida });
                        }

                        transaction.set(ventaRef, ventaData);
                        stockUpdates.forEach(update => transaction.update(update.ref, { cantidad: update.nuevaCantidad }));
                    });
                } else {
                    const batch = _writeBatch(_db);
                    ventaRef = _doc(_collection(_db, `artifacts/${_appId}/users/${_userId}/ventas`));

                    for (const p of productosVendidos) {
                         const productoInventario = _inventarioCache.find(item => item.id === p.id);
                         if (!productoInventario || productoInventario.cantidad < p.cantidadVendida) throw new Error(`Stock insuficiente para: ${p.presentacion}.`);
                         batch.update(_doc(_db, `artifacts/${_appId}/users/${_userId}/inventario`, p.id), { cantidad: productoInventario.cantidad - p.cantidadVendida });
                    }
                    batch.set(ventaRef, ventaData);
                    await batch.commit();
                }

                _showModal('Éxito', 'Venta registrada. Preparando ticket...', () => {}, 2000);
                const ventaParaTicket = { ...ventaData, id: ventaRef.id, fecha: { toDate: () => ventaData.fecha } };
                await handleShareDocument(ventaParaTicket, itemsVenta, 'ticket');
                showNuevaVentaView(); // Reset view for new sale

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
                            <button id="ventasActualesBtn" class="w-full px-6 py-3 bg-teal-500 text-white font-semibold rounded-lg shadow-md hover:bg-teal-600 transition-all duration-300">Ventas Actuales</button>
                            <button id="cierreVentasBtn" class="w-full px-6 py-3 bg-red-500 text-white font-semibold rounded-lg shadow-md hover:bg-red-600 transition-all duration-300">Cierre de Ventas</button>
                        </div>
                        <button id="backToVentasBtn" class="mt-6 w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500 transition-all duration-300">Volver</button>
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
            <div class="p-4 pt-8 w-full">
                <div class="container mx-auto">
                    <div class="bg-white/90 backdrop-blur-sm p-4 sm:p-8 rounded-lg shadow-xl">
                        <h2 class="text-2xl font-bold text-gray-800 mb-6 text-center">Ventas Actuales</h2>
                        <div id="ventasListContainer" class="overflow-x-auto"><p class="text-gray-500 text-center">Cargando ventas...</p></div>
                        <button id="backToVentasTotalesBtn" class="mt-6 w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500 transition-all duration-300">Volver</button>
                    </div>
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
        const unsubscribe = _onSnapshot(ventasRef, (snapshot) => {
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
                        <td class="py-2 px-3 border-b font-semibold text-right">$${venta.total.toFixed(2)}</td>
                        <td class="py-2 px-3 border-b text-center space-x-1">
                            <button onclick="window.ventasModule.shareSaleTicket('${venta.id}')" class="px-3 py-1 bg-blue-500 text-white text-xs rounded-lg hover:bg-blue-600">Ticket</button>
                            <button onclick="window.ventasModule.mostrarFactura('${venta.id}')" class="px-3 py-1 bg-green-500 text-white text-xs rounded-lg hover:bg-green-600">Factura</button>
                        </td>
                    </tr>
                `;
            });
            tableHTML += `</tbody></table>`;
            container.innerHTML = tableHTML;
        });
        _activeListeners.push(unsubscribe);
    }
    
    /**
     * Muestra el submenú de opciones para el cierre de ventas.
     */
    function showCierreSubMenuView() {
         _floatingControls.classList.add('hidden');
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl text-center">
                        <h2 class="text-2xl font-bold text-gray-800 mb-6">Cierre de Ventas</h2>
                        <div class="space-y-4">
                            <button id="verCierreBtn" class="w-full px-6 py-3 bg-indigo-500 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-600 transition-all duration-300">Ver Reporte de Cierre</button>
                            <button id="ejecutarCierreBtn" class="w-full px-6 py-3 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700 transition-all duration-300">Ejecutar Cierre Definitivo</button>
                        </div>
                        <button id="backToVentasTotalesBtn" class="mt-6 w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500 transition-all duration-300">Volver</button>
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
        
        if (_ventasGlobal.length === 0) {
            _showModal('Información', 'No hay ventas para generar un reporte.', () => {}, 2000);
            return;
        }

        const totalVentas = _ventasGlobal.reduce((sum, v) => sum + v.total, 0);
        const productosVendidos = _ventasGlobal
            .flatMap(v => v.productos)
            .reduce((acc, p) => {
                if (!acc[p.id]) {
                    acc[p.id] = { ...p, cantidadTotal: 0, totalVendido: 0 };
                }
                acc[p.id].cantidadTotal += p.cantidad;
                acc[p.id].totalVendido += p.cantidad * p.precio;
                return acc;
            }, {});

        const productosArray = Object.values(productosVendidos).sort((a, b) => b.totalVendido - a.totalVendido);
        
        let productosHTML = productosArray.map(p => `
            <tr class="hover:bg-gray-50">
                <td class="py-2 px-3 border-b">${p.presentacion}</td>
                <td class="py-2 px-3 border-b text-center">${p.cantidadTotal}</td>
                <td class="py-2 px-3 border-b text-right">$${p.totalVendido.toFixed(2)}</td>
            </tr>
        `).join('');

        _mainContent.innerHTML = `
            <div class="p-4 pt-8 w-full">
                <div class="bg-white/90 backdrop-blur-sm p-4 sm:p-8 rounded-lg shadow-xl">
                    <h2 class="text-2xl font-bold text-gray-800 mb-4 text-center">Reporte de Cierre</h2>
                    <div class="text-center mb-6">
                        <p class="text-lg">Total de Ventas: <span class="font-bold text-green-600">$${totalVentas.toFixed(2)}</span></p>
                        <p class="text-md">Número de Transacciones: <span class="font-bold">${_ventasGlobal.length}</span></p>
                    </div>
                    <h3 class="text-xl font-semibold text-gray-700 mb-4">Resumen de Productos Vendidos</h3>
                    <div class="overflow-x-auto shadow rounded-lg">
                        <table class="min-w-full bg-white text-sm">
                            <thead class="bg-gray-200">
                                <tr>
                                    <th class="py-2 px-3 text-left">Producto</th>
                                    <th class="py-2 px-3 text-center">Cantidad Total</th>
                                    <th class="py-2 px-3 text-right">Total Vendido</th>
                                </tr>
                            </thead>
                            <tbody>${productosHTML}</tbody>
                        </table>
                    </div>
                     <button id="backToCierreMenuBtn" class="mt-6 w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500 transition-all duration-300">Volver</button>
                </div>
            </div>
        `;
        document.getElementById('backToCierreMenuBtn').addEventListener('click', showCierreSubMenuView);
        _showModal('Éxito', 'Reporte generado.', () => {}, 1000);
    }

    /**
     * Ejecuta el proceso de cierre de ventas.
     */
    async function ejecutarCierre() {
        if (_ventasGlobal.length === 0) {
            _showModal('Aviso', 'No hay ventas activas para realizar un cierre.');
            return;
        }

        _showModal('Confirmación Requerida', 'Esta acción es irreversible. Se archivarán las ventas actuales y se borrarán de la lista. ¿Estás seguro de continuar?', async () => {
            _showModal('Progreso', 'Ejecutando cierre de ventas...');
            try {
                const batch = _writeBatch(_db);

                // 1. Crear el documento de cierre
                const totalVentas = _ventasGlobal.reduce((sum, v) => sum + v.total, 0);
                const productosVendidos = _ventasGlobal.flatMap(v => v.productos);
                const cierreRef = _doc(_collection(_db, `artifacts/${_appId}/users/${_userId}/cierres`));
                batch.set(cierreRef, {
                    fecha: new Date(),
                    totalVentas,
                    numTransacciones: _ventasGlobal.length,
                    ventas: _ventasGlobal.map(v => ({...v, fecha: v.fecha.toDate()})), // Guardar fechas como objetos JS
                    productosResumen: productosVendidos
                });

                // 2. Borrar las ventas actuales
                _ventasGlobal.forEach(venta => {
                    const ventaRef = _doc(_db, `artifacts/${_appId}/users/${_userId}/ventas`, venta.id);
                    batch.delete(ventaRef);
                });

                // 3. Ejecutar el batch
                await batch.commit();

                _showModal('Cierre Exitoso', 'El cierre de ventas se ha completado. Las ventas han sido archivadas.', () => {
                    showVentasView();
                });

            } catch (e) {
                console.error("Error ejecutando cierre:", e);
                _showModal('Error', `Ocurrió un error durante el cierre: ${e.message}`);
            }
        });
    }
    
    /**
     * Busca una venta por ID y comparte su ticket.
     */
    async function shareSaleTicket(ventaId) {
        const venta = _ventasGlobal.find(v => v.id === ventaId);
        if (venta) {
            await handleShareDocument(venta, venta.productos, 'ticket');
        } else {
            _showModal('Error', 'No se encontró la venta para compartir.');
        }
    }

    /**
     * Busca una venta por ID y muestra/comparte una factura fiscal.
     */
    async function mostrarFactura(ventaId) {
        const venta = _ventasGlobal.find(v => v.id === ventaId);
        if (venta) {
            await handleShareDocument(venta, venta.productos, 'factura');
        } else {
            _showModal('Error', 'No se encontró la venta para generar la factura.');
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
