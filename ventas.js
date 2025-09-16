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
    let _tasaBs = 0;
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
                            <div id="tasasContainer" class="flex flex-row items-center gap-2 sm:gap-4">
                                <div class="flex items-center space-x-1">
                                    <label for="tasaCopInput" class="block text-gray-700 text-sm font-medium">COP:</label>
                                    <input type="number" id="tasaCopInput" placeholder="4000" class="w-20 px-2 py-1 border rounded-lg">
                                </div>
                                <div class="flex items-center space-x-1">
                                    <label for="tasaBsInput" class="block text-gray-700 text-sm font-medium">Bs.:</label>
                                    <input type="number" id="tasaBsInput" placeholder="36.5" class="w-20 px-2 py-1 border rounded-lg">
                                </div>
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
        
        const savedTasaBs = localStorage.getItem('tasaBs');
        if (savedTasaBs) {
            _tasaBs = parseFloat(savedTasaBs);
            document.getElementById('tasaBsInput').value = _tasaBs;
        }

        document.getElementById('tasaCopInput').addEventListener('input', (e) => {
            _tasaCOP = parseFloat(e.target.value) || 0;
            localStorage.setItem('tasaCOP', _tasaCOP);
            renderVentasInventario();
            updateVentaTotal();
        });
        
        document.getElementById('tasaBsInput').addEventListener('input', (e) => {
            _tasaBs = parseFloat(e.target.value) || 0;
            localStorage.setItem('tasaBs', _tasaBs);
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
        const cycle = ['USD', 'COP', 'Bs'];
        const rates = { 'USD': 1, 'COP': _tasaCOP, 'Bs': _tasaBs };
        
        let currentIndex = cycle.indexOf(_monedaActual);
        let nextIndex = (currentIndex + 1) % cycle.length;

        // Loop to find the next available currency with a valid rate
        while (nextIndex !== currentIndex) {
            if (rates[cycle[nextIndex]] > 0) {
                _monedaActual = cycle[nextIndex];
                renderVentasInventario();
                updateVentaTotal();
                return;
            }
            nextIndex = (nextIndex + 1) % cycle.length;
        }

        // If no other currency is available
        _showModal('Aviso', 'Ingresa al menos una tasa de cambio para poder alternar monedas.');
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
                } else if (_monedaActual === 'Bs') {
                    const precioConvertido = producto.precio * _tasaBs;
                    precioMostrado = `Bs.S ${precioConvertido.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
        } else if (_monedaActual === 'Bs') {
            const totalBs = total * _tasaBs;
            totalEl.textContent = `Total: Bs.S ${totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        } else {
            totalEl.textContent = `Total: $${total.toFixed(2)}`;
        }
    }
    
    /**
     * Crea el HTML para un ticket/factura (para compartir como imagen).
     */
    function createTicketHTML(venta, productos, tipo = 'ticket') {
        const fecha = venta.fecha ? venta.fecha.toDate().toLocaleDateString('es-ES') : new Date().toLocaleDateString('es-ES');
        const clienteNombre = venta.cliente ? venta.cliente.nombreComercial : venta.clienteNombre;
        const clienteNombrePersonal = (venta.cliente ? venta.cliente.nombrePersonal : venta.clienteNombrePersonal) || '';
        let total = 0;
        
        let productosHTML = productos.map(p => {
            const subtotal = p.precio * p.cantidadVendida;
            total += subtotal;
            return `
                <tr class="align-top">
                    <td class="py-2 pr-2 text-left" style="width: 60%;">
                        <div style="line-height: 1.2;">${(p.segmento || '')} ${(p.marca || '')} ${p.presentacion}</div>
                    </td>
                    <td class="py-2 text-center" style="width: 15%;">${p.cantidadVendida}</td>
                    <td class="py-2 pl-2 text-right" style="width: 25%;">$${subtotal.toFixed(2)}</td>
                </tr>
            `;
        }).join('');

        const titulo = tipo === 'factura' ? 'FACTURA FISCAL' : 'TICKET DE VENTA';

        return `
            <div id="temp-ticket-for-image" class="bg-white text-black p-4 uppercase font-bold" style="width: 768px; font-family: 'Courier New', Courier, monospace;">
                <div class="text-center">
                    <h2 class="text-5xl">${titulo}</h2>
                    <p class="text-4xl">DISTRIBUIDORA CASTILLO YAÑEZ</p>
                </div>
                <div class="text-3xl mt-8">
                    <p>FECHA: ${fecha}</p>
                    <p>CLIENTE: ${clienteNombre}</p>
                </div>
                <table class="w-full text-3xl mt-6">
                    <thead>
                        <tr>
                            <th class="pb-2 text-left">PRODUCTO</th>
                            <th class="pb-2 text-center">CANT.</th>
                            <th class="pb-2 text-right">SUBTOTAL</th>
                        </tr>
                    </thead>
                    <tbody>${productosHTML}</tbody>
                </table>
                <div class="text-right text-4xl mt-6 border-t border-black border-dashed pt-4">
                    <p>TOTAL: $${total.toFixed(2)}</p>
                </div>
                <div class="text-center mt-16">
                    <p class="border-t border-black w-96 mx-auto"></p>
                    <p class="mt-4 text-3xl">${clienteNombrePersonal}</p>
                </div>
                <hr class="border-dashed border-black mt-6">
            </div>
        `;
    }

    /**
     * Crea un string de texto plano optimizado para impresoras térmicas.
     */
    function createRawTextTicket(venta, productos, tipo = 'ticket') {
        const fecha = venta.cliente ? new Date().toLocaleDateString('es-ES') : venta.fecha.toDate().toLocaleDateString('es-ES');
        const clienteNombre = (venta.cliente ? venta.cliente.nombreComercial : venta.clienteNombre).toUpperCase();
        const clienteNombrePersonal = ((venta.cliente ? venta.cliente.nombrePersonal : venta.clienteNombrePersonal) || '').toUpperCase();
        const LINE_WIDTH = 32; // Ancho estándar para papel de 58mm

        let total = 0;
        let ticket = '';

        const center = (text) => text.padStart(Math.floor(LINE_WIDTH / 2 + text.length / 2), ' ').padEnd(LINE_WIDTH, ' ');

        ticket += center(tipo === 'factura' ? 'FACTURA FISCAL' : 'TICKET DE VENTA') + '\n';
        ticket += center('DISTRIBUIDORA CASTILLO YAÑEZ') + '\n\n';
        
        ticket += `FECHA: ${fecha}\n`;
        ticket += `CLIENTE: ${clienteNombre}\n`;
        ticket += '-'.repeat(LINE_WIDTH) + '\n';
        ticket += 'CANT  PRODUCTO             SUBTOTAL\n';
        ticket += '-'.repeat(LINE_WIDTH) + '\n';
        
        productos.forEach(p => {
            const subtotal = p.precio * p.cantidadVendida;
            total += subtotal;
            const productName = `${p.segmento || ''} ${p.marca || ''} ${p.presentacion}`.toUpperCase();
            const quantity = p.cantidadVendida.toString();
            const subtotalStr = `$${subtotal.toFixed(2)}`;

            ticket += quantity.padEnd(4, ' ') + productName + '\n';
            ticket += subtotalStr.padStart(LINE_WIDTH, ' ') + '\n';
        });

        ticket += '-'.repeat(LINE_WIDTH) + '\n';
        const totalString = `TOTAL: $${total.toFixed(2)}`;
        ticket += totalString.padStart(LINE_WIDTH, ' ') + '\n\n';
        
        ticket += '\n\n\n\n';
        
        ticket += center('________________________') + '\n';
        ticket += center(clienteNombrePersonal) + '\n\n';
        ticket += '-'.repeat(LINE_WIDTH) + '\n';

        return ticket;
    }

    /**
     * Maneja la compartición de la imagen del ticket.
     */
    async function handleShareTicket(htmlContent, successCallback) {
        _showModal('Progreso', 'Generando imagen...');
        const tempDiv = document.createElement('div');
        tempDiv.style.position = 'absolute';
        tempDiv.style.left = '-9999px';
        tempDiv.style.top = '0';
        tempDiv.innerHTML = htmlContent;
        document.body.appendChild(tempDiv);
        
        const ticketElement = document.getElementById('temp-ticket-for-image');
        if (!ticketElement) {
            _showModal('Error', 'No se pudo encontrar el elemento del ticket para generar la imagen.');
            document.body.removeChild(tempDiv);
            return;
        }

        try {
            await new Promise(resolve => setTimeout(resolve, 100));
            const canvas = await html2canvas(ticketElement, { scale: 3 });
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));

            if (navigator.share && blob) {
                await navigator.share({ files: [new File([blob], "ticket.png", { type: "image/png" })], title: "Ticket de Venta" });
                _showModal('Éxito', 'Venta registrada. Imagen compartida.', successCallback);
            } else {
                 _showModal('Error', 'La función de compartir no está disponible.', successCallback);
            }
        } catch(e) {
            _showModal('Error', `No se pudo generar la imagen. ${e.message}`, successCallback);
        } finally {
            document.body.removeChild(tempDiv);
        }
    }

    /**
     * Maneja la compartición del ticket como texto plano.
     */
    async function handleShareRawText(textContent, successCallback) {
        if (navigator.share) {
            try {
                await navigator.share({ title: 'Ticket de Venta', text: textContent });
                _showModal('Éxito', 'Venta registrada. El ticket está listo para imprimir.', successCallback);
            } catch (err) {
                 _showModal('Aviso', 'No se compartió el ticket, pero la venta fue registrada.', successCallback);
            }
        } else {
            try {
                const textArea = document.createElement("textarea");
                textArea.value = textContent;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                _showModal('Copiado', 'Texto del ticket copiado. Pégalo en tu app de impresión.', successCallback);
            } catch (copyErr) {
                 _showModal('Error', 'No se pudo compartir ni copiar el ticket. La venta fue registrada.', successCallback);
            }
        }
    }

    /**
     * Muestra un modal para elegir entre imprimir (texto) o compartir (imagen).
     */
    function showSharingOptions(venta, productos, tipo, successCallback) {
        const modalContent = `
            <div class="text-center">
                <h3 class="text-xl font-bold text-gray-800 mb-4">¿Qué deseas hacer?</h3>
                <p class="text-gray-600 mb-6">Elige el formato para tu ${tipo}.</p>
                <div class="space-y-4">
                    <button id="printTextBtn" class="w-full px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg shadow-md hover:bg-blue-600">Imprimir (Texto)</button>
                    <button id="shareImageBtn" class="w-full px-6 py-3 bg-green-500 text-white font-semibold rounded-lg shadow-md hover:bg-green-600">Compartir (Imagen)</button>
                </div>
            </div>`;
        
        _showModal('Elige una opción', modalContent, null, ''); // Usamos _showModal sin botones por defecto

        document.getElementById('printTextBtn').addEventListener('click', () => {
            const rawTextTicket = createRawTextTicket(venta, productos, tipo);
            handleShareRawText(rawTextTicket, successCallback);
        });

        document.getElementById('shareImageBtn').addEventListener('click', () => {
            const ticketHTML = createTicketHTML(venta, productos, tipo);
            handleShareTicket(ticketHTML, successCallback);
        });
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

        _showModal('Confirmar Venta', '¿Deseas guardar esta venta?', async () => {
            _showModal('Progreso', 'Procesando venta...');
            try {
                const batch = _writeBatch(_db);
                const ventaRef = _doc(_collection(_db, `artifacts/${_appId}/users/${_userId}/ventas`));
                let totalVenta = 0;
                const itemsVenta = [];

                for (const p of productosVendidos) {
                    const productoEnCache = _inventarioCache.find(item => item.id === p.id);
                    if (!productoEnCache || productoEnCache.cantidad < p.cantidadVendida) {
                        throw new Error(`Stock insuficiente para ${p.presentacion}.`);
                    }
                    const productoRef = _doc(_db, `artifacts/${_appId}/users/${_userId}/inventario`, p.id);
                    const nuevoStock = productoEnCache.cantidad - p.cantidadVendida;
                    batch.update(productoRef, { cantidad: nuevoStock });
                    totalVenta += p.precio * p.cantidadVendida;
                    itemsVenta.push({ id: p.id, presentacion: p.presentacion, marca: p.marca ?? null, segmento: p.segmento ?? null, precio: p.precio, cantidadVendida: p.cantidadVendida, iva: p.iva ?? 0, unidadTipo: p.unidadTipo ?? 'und.' });
                }

                batch.set(ventaRef, { clienteId: _ventaActual.cliente.id, clienteNombre: _ventaActual.cliente.nombreComercial || _ventaActual.cliente.nombrePersonal, clienteNombrePersonal: _ventaActual.cliente.nombrePersonal, fecha: new Date(), total: totalVenta, productos: itemsVenta });
                await batch.commit();

                // Mostrar opciones después de guardar la venta
                showSharingOptions(_ventaActual, productosVendidos, 'ticket', showNuevaVentaView);

            } catch (e) {
                _showModal('Error', `Hubo un error al procesar la venta: ${e.message}`);
            }
        }, 'Sí, Guardar');
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
                            <button onclick="window.ventasModule.showPastSaleOptions('${venta.id}', 'ticket')" class="px-3 py-1 bg-blue-500 text-white text-xs rounded-lg hover:bg-blue-600">Ticket</button>
                            <button onclick="window.ventasModule.showPastSaleOptions('${venta.id}', 'factura')" class="px-3 py-1 bg-green-500 text-white text-xs rounded-lg hover:bg-green-600">Factura</button>
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
     * Procesa los datos de ventas para generar la estructura del reporte.
     */
    function processSalesDataForReport(ventas) {
        const clientData = {};
        let grandTotalValue = 0;
        
        const allProductsMap = new Map();

        ventas.forEach(venta => {
            const clientName = venta.clienteNombre;
            if (!clientData[clientName]) {
                clientData[clientName] = { products: {}, totalValue: 0 };
            }
            
            clientData[clientName].totalValue += venta.total;
            grandTotalValue += venta.total;

            venta.productos.forEach(p => {
                const productName = p.presentacion;
                if (!allProductsMap.has(productName)) {
                    allProductsMap.set(productName, {
                        segmento: p.segmento || 'Sin Segmento',
                        marca: p.marca || 'Sin Marca',
                        presentacion: p.presentacion
                    });
                }
                
                if (!clientData[clientName].products[productName]) {
                    clientData[clientName].products[productName] = 0;
                }
                clientData[clientName].products[productName] += p.cantidadVendida;
            });
        });

        const sortedClients = Object.keys(clientData).sort();

        const groupedProducts = {};
        for (const product of allProductsMap.values()) {
            if (!groupedProducts[product.segmento]) {
                groupedProducts[product.segmento] = {};
            }
            if (!groupedProducts[product.segmento][product.marca]) {
                groupedProducts[product.segmento][product.marca] = [];
            }
            groupedProducts[product.segmento][product.marca].push(product.presentacion);
        }

        const finalProductOrder = [];
        const sortedSegmentos = Object.keys(groupedProducts).sort();
        sortedSegmentos.forEach(segmento => {
            const sortedMarcas = Object.keys(groupedProducts[segmento]).sort();
            groupedProducts[segmento].sortedMarcas = sortedMarcas;
            sortedMarcas.forEach(marca => {
                const sortedPresentaciones = groupedProducts[segmento][marca].sort();
                groupedProducts[segmento][marca] = sortedPresentaciones;
                finalProductOrder.push(...sortedPresentaciones);
            });
        });

        return { clientData, grandTotalValue, sortedClients, groupedProducts, finalProductOrder, sortedSegmentos };
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

        const { clientData, grandTotalValue, sortedClients, groupedProducts, finalProductOrder, sortedSegmentos } = processSalesDataForReport(ventas);

        let headerRow1 = `<tr class="sticky top-0"><th rowspan="3" class="p-2 border-b border-gray-300 bg-gray-200 sticky left-0 z-10">Cliente</th>`;
        let headerRow2 = `<tr class="sticky" style="top: 36px;">`;
        let headerRow3 = `<tr class="sticky" style="top: 72px;">`;

        sortedSegmentos.forEach(segmento => {
            let segmentoColspan = 0;
            groupedProducts[segmento].sortedMarcas.forEach(marca => {
                segmentoColspan += groupedProducts[segmento][marca].length;
            });
            headerRow1 += `<th colspan="${segmentoColspan}" class="p-2 border-b border-l border-gray-300 bg-gray-200">${segmento}</th>`;
            
            groupedProducts[segmento].sortedMarcas.forEach(marca => {
                const marcaColspan = groupedProducts[segmento][marca].length;
                headerRow2 += `<th colspan="${marcaColspan}" class="p-2 border-b border-l border-gray-300 bg-gray-100">${marca}</th>`;
                
                groupedProducts[segmento][marca].forEach(presentacion => {
                    headerRow3 += `<th class="p-2 border-b border-l border-gray-300 bg-gray-50 whitespace-nowrap">${presentacion}</th>`;
                });
            });
        });
        headerRow1 += `<th rowspan="3" class="p-2 border-b border-gray-300 bg-gray-200 sticky right-0 z-10">Total Cliente</th></tr>`;
        headerRow2 += `</tr>`;
        headerRow3 += `</tr>`;

        let bodyHTML = '';
        sortedClients.forEach(clientName => {
            bodyHTML += `<tr class="hover:bg-blue-50"><td class="p-2 border-b border-gray-300 font-medium bg-white sticky left-0">${clientName}</td>`;
            const currentClient = clientData[clientName];
            finalProductOrder.forEach(productName => {
                const quantity = currentClient.products[productName] || 0;
                bodyHTML += `<td class="p-2 border-b border-l border-gray-300 text-center">${quantity > 0 ? quantity : ''}</td>`;
            });
            bodyHTML += `<td class="p-2 border-b border-gray-300 text-right font-semibold bg-white sticky right-0">$${currentClient.totalValue.toFixed(2)}</td></tr>`;
        });
        
        let footerHTML = '<tr class="bg-gray-200 font-bold"><td class="p-2 border-b border-gray-300 sticky left-0">TOTALES</td>';
        finalProductOrder.forEach(productName => {
            let totalQty = 0;
            sortedClients.forEach(clientName => {
                totalQty += clientData[clientName].products[productName] || 0;
            });
            footerHTML += `<td class="p-2 border-b border-l border-gray-300 text-center">${totalQty}</td>`;
        });
        footerHTML += `<td class="p-2 border-b border-gray-300 text-right sticky right-0">$${grandTotalValue.toFixed(2)}</td></tr>`;
        
        const reporteHTML = `
            <div class="text-left max-h-[80vh] overflow-auto">
                <h3 class="text-xl font-bold text-gray-800 mb-4">Reporte de Cierre de Ventas</h3>
                <div class="overflow-auto border border-gray-300">
                    <table class="min-w-full bg-white text-xs">
                        <thead class="bg-gray-200">${headerRow1}${headerRow2}${headerRow3}</thead>
                        <tbody>${bodyHTML}</tbody>
                        <tfoot>${footerHTML}</tfoot>
                    </table>
                </div>
            </div>`;
        _showModal('Reporte de Cierre', reporteHTML);
    }

    /**
     * Genera y descarga un archivo de Excel con el reporte de cierre.
     */
    async function exportCierreToExcel(ventas) {
        if (typeof XLSX === 'undefined') {
            _showModal('Error', 'La librería para exportar a Excel no está cargada.');
            return;
        }

        const { clientData, grandTotalValue, sortedClients, groupedProducts, finalProductOrder, sortedSegmentos } = processSalesDataForReport(ventas);

        const dataForSheet = [];
        const merges = [];
        
        const headerRow1 = [""];
        const headerRow2 = [""];
        const headerRow3 = ["Cliente"];
        
        let currentColumn = 1;
        sortedSegmentos.forEach(segmento => {
            const segmentoStartCol = currentColumn;
            let segmentoColspan = 0;
            groupedProducts[segmento].sortedMarcas.forEach(marca => {
                const marcaStartCol = currentColumn;
                const presentaciones = groupedProducts[segmento][marca];
                segmentoColspan += presentaciones.length;
                
                headerRow2.push(marca);
                for (let i = 1; i < presentaciones.length; i++) headerRow2.push("");
                if (presentaciones.length > 1) {
                    merges.push({ s: { r: 1, c: marcaStartCol }, e: { r: 1, c: marcaStartCol + presentaciones.length - 1 } });
                }
                
                presentaciones.forEach(p => {
                    headerRow3.push(p);
                });
                currentColumn += presentaciones.length;
            });
            headerRow1.push(segmento);
            for (let i = 1; i < segmentoColspan; i++) headerRow1.push("");
            if (segmentoColspan > 1) {
                merges.push({ s: { r: 0, c: segmentoStartCol }, e: { r: 0, c: segmentoStartCol + segmentoColspan - 1 } });
            }
        });
        
        headerRow1.push("");
        headerRow2.push("");
        headerRow3.push("Total Cliente");
        dataForSheet.push(headerRow1, headerRow2, headerRow3);

        merges.push({ s: { r: 0, c: 0 }, e: { r: 2, c: 0 } });
        merges.push({ s: { r: 0, c: finalProductOrder.length + 1 }, e: { r: 2, c: finalProductOrder.length + 1 } });

        sortedClients.forEach(clientName => {
            const row = [clientName];
            const currentClient = clientData[clientName];
            finalProductOrder.forEach(productName => {
                row.push(currentClient.products[productName] || 0);
            });
            row.push(currentClient.totalValue);
            dataForSheet.push(row);
        });

        const footerRow = ["TOTALES"];
        finalProductOrder.forEach(productName => {
            let totalQty = 0;
            sortedClients.forEach(clientName => {
                totalQty += clientData[clientName].products[productName] || 0;
            });
            footerRow.push(totalQty);
        });
        footerRow.push(grandTotalValue);
        dataForSheet.push(footerRow);

        const ws = XLSX.utils.aoa_to_sheet(dataForSheet);
        ws['!merges'] = merges;
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Reporte de Cierre');
        
        const today = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(wb, `Reporte_Cierre_Ventas_${today}.xlsx`);
    }

    /**
     * Ejecuta el cierre de ventas: archiva y elimina.
     */
    function ejecutarCierre() {
        _showModal('Confirmar Cierre Definitivo', 
            'Esta acción generará un reporte en Excel, luego archivará y eliminará las ventas actuales. No se puede deshacer. ¿Continuar?', 
            async () => {
                
                const ventasRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/ventas`);
                const ventasSnapshot = await _getDocs(ventasRef);
                const ventas = ventasSnapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
                
                if (ventas.length === 0) {
                    _showModal('Aviso', 'No hay ventas para cerrar.');
                    return;
                }

                try {
                    await exportCierreToExcel(ventas);
                    _showModal('Progreso', 'Reporte Excel generado. Ahora procesando el cierre...');

                    const cierreRef = _doc(_collection(_db, `artifacts/${_appId}/users/${_userId}/cierres`));
                    await _setDoc(cierreRef, {
                        fecha: new Date(),
                        ventas: ventas.map(({id, ...rest}) => rest),
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
     * Muestra las opciones para una venta pasada (imprimir o compartir).
     */
    function showPastSaleOptions(ventaId, tipo = 'ticket') {
        const venta = _ventasGlobal.find(v => v.id === ventaId);
        if (venta) {
            showSharingOptions(venta, venta.productos, tipo, () => {});
        } else {
            _showModal('Error', 'No se encontró la venta seleccionada.');
        }
    }

    // Exponer funciones públicas al objeto window
    window.ventasModule = {
        toggleMoneda,
        updateVentaCantidad,
        showPastSaleOptions,
    };
})();
