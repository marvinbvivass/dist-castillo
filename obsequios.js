// --- Lógica del módulo de Gestión de Obsequios ---

(function() {
    // Variables locales del módulo
    let _db, _userId, _userRole, _appId, _mainContent, _floatingControls, _activeListeners;
    let _showMainMenu, _showModal;
    let _collection, _onSnapshot, _doc, _getDoc, _addDoc, _setDoc, _getDocs, _writeBatch, _runTransaction, _query, _where;

    // Estado específico del módulo
    let _clientesCache = [];
    let _inventarioCache = []; // Caché del inventario del usuario actual
    let _obsequioConfig = { productoId: null, productoData: null }; // Configuración del producto de obsequio
    let _obsequioActual = { cliente: null, cantidadEntregada: 0, vaciosRecibidos: 0, observacion: '' };

    // Constante para tipos de vacío (debe coincidir con inventario.js)
    const TIPOS_VACIO = ["1/4 - 1/3", "ret 350 ml", "ret 1.25 Lts"];
    // Definir ruta pública para la configuración
    const OBSEQUIO_CONFIG_PATH = `artifacts/${'ventas-9a210'}/public/data/config/obsequio`; // Usar ID de proyecto hardcoded

    /**
     * Inicializa el módulo de obsequios.
     */
    window.initObsequios = function(dependencies) {
        _db = dependencies.db;
        _userId = dependencies.userId;
        _userRole = dependencies.userRole; // Aunque la vista es para 'user', guardamos por si acaso
        _appId = dependencies.appId; // Se obtiene appId aquí
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
        _getDocs = dependencies.getDocs;
        _writeBatch = dependencies.writeBatch;
        _runTransaction = dependencies.runTransaction;
        _query = dependencies.query;
        _where = dependencies.where;
    };

    /**
     * Muestra la vista principal de gestión de obsequios.
     */
    window.showGestionObsequiosView = async function() {
        if (_userRole !== 'user') {
            _showModal('Acceso Denegado', 'Esta función es solo para vendedores.');
            _showMainMenu();
            return;
        }

        _floatingControls.classList.add('hidden');
        _obsequioActual = { cliente: null, cantidadEntregada: 0, vaciosRecibidos: 0, observacion: '' }; // Resetear
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto max-w-lg">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl">
                        <div class="flex justify-between items-center mb-6">
                            <h1 class="text-2xl font-bold text-gray-800">Gestión de Obsequios</h1>
                            <button id="backToMenuBtn" class="px-4 py-2 bg-gray-400 text-white text-sm font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver</button>
                        </div>

                        <div id="obsequio-loader" class="text-center text-gray-500 mb-4">Cargando configuración...</div>
                        <div id="obsequio-content" class="hidden space-y-4">
                            <!-- Selección de Cliente -->
                            <div id="client-search-container-obsequio">
                                <label for="clienteSearchObsequio" class="block text-gray-700 font-medium mb-2">Seleccionar Cliente:</label>
                                <div class="relative">
                                    <input type="text" id="clienteSearchObsequio" placeholder="Buscar cliente..." class="w-full px-4 py-2 border rounded-lg">
                                    <div id="clienteDropdownObsequio" class="autocomplete-list hidden"></div>
                                </div>
                            </div>
                            <div id="client-display-container-obsequio" class="hidden p-3 bg-gray-100 rounded-lg">
                                <p class="text-gray-700"><span class="font-medium">Cliente:</span> <span id="selected-client-name-obsequio" class="font-bold"></span></p>
                            </div>

                            <!-- Formulario de Obsequio (cuando se selecciona cliente) -->
                            <form id="obsequioForm" class="hidden space-y-4 text-left border-t pt-4">
                                <p class="font-semibold text-center text-gray-800">Producto: <span id="obsequioProductName"></span></p>
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label for="cantidadEntregada" class="block text-gray-700 font-medium mb-1">Cajas Entregadas:</label>
                                        <input type="number" id="cantidadEntregada" min="0" class="w-full px-4 py-2 border rounded-lg" required>
                                        <p class="text-xs text-gray-500 mt-1">Stock disponible: <span id="obsequioStock">--</span> cajas</p>
                                    </div>
                                    <div>
                                        <label for="vaciosRecibidos" class="block text-gray-700 font-medium mb-1">Vacíos Recibidos:</label>
                                        <input type="number" id="vaciosRecibidos" min="0" class="w-full px-4 py-2 border rounded-lg">
                                        <p id="vaciosTipoInfo" class="text-xs text-gray-500 mt-1">Tipo: --</p>
                                    </div>
                                </div>
                                <div>
                                    <label for="observacion" class="block text-gray-700 font-medium mb-1">Información/Observación:</label>
                                    <textarea id="observacion" rows="3" class="w-full px-4 py-2 border rounded-lg" placeholder="Motivo de la entrega del obsequio..."></textarea>
                                </div>
                                <button type="submit" class="w-full px-6 py-3 bg-pink-500 text-white font-semibold rounded-lg shadow-md hover:bg-pink-600">Registrar y Generar Ticket</button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('backToMenuBtn').addEventListener('click', _showMainMenu);

        // Cargar datos necesarios en paralelo
        await Promise.all([
            _loadClientes(),
            _loadInventarioUsuario(),
            _loadObsequioProduct() // Carga la configuración Y el producto del inventario
        ]);

        const loader = document.getElementById('obsequio-loader');
        const content = document.getElementById('obsequio-content');

        if (_obsequioConfig.productoId && _obsequioConfig.productoData) {
            loader.classList.add('hidden');
            content.classList.remove('hidden');
            setupObsequioUI(); // Configurar UI después de cargar todo
        } else {
            loader.textContent = 'Error: No se ha configurado un producto de obsequio o no se encontró en el inventario.';
             _showModal('Error de Configuración', 'No hay un producto de obsequio configurado por el administrador o no se encuentra en tu inventario. Contacta al administrador.');
        }
    };

    /**
     * Carga la configuración del producto de obsequio desde la ruta pública.
     * También carga los datos del producto desde el inventario del usuario actual.
     */
    async function _loadObsequioProduct() {
        try {
            // 1. Leer la configuración pública directamente
            const configRef = _doc(_db, OBSEQUIO_CONFIG_PATH); // Usa la ruta pública definida
            const configSnap = await _getDoc(configRef);

            if (configSnap.exists()) {
                _obsequioConfig.productoId = configSnap.data().productoId;

                // 2. Buscar el producto en el inventario del usuario actual (esto permanece igual)
                const productoDataEnInventario = _inventarioCache.find(p => p.id === _obsequioConfig.productoId);

                if (productoDataEnInventario) {
                    _obsequioConfig.productoData = productoDataEnInventario;
                     // Validar que maneje vacíos y sea por caja (esto permanece igual)
                     if (!productoDataEnInventario.manejaVacios || !productoDataEnInventario.ventaPor?.cj) {
                         throw new Error(`El producto "${productoDataEnInventario.presentacion}" configurado como obsequio no maneja vacíos o no se vende por caja.`);
                     }
                } else {
                    throw new Error("El producto configurado como obsequio no se encontró en tu inventario.");
                }
            } else {
                throw new Error("No se ha configurado un producto de obsequio en la ruta pública.");
            }

        } catch (error) {
            // Log original (línea ~170)
            console.error("Error al cargar configuración de obsequio:", error);
            _obsequioConfig = { productoId: null, productoData: null }; // Resetear si hay error
             // El mensaje de error se mostrará en showGestionObsequiosView
        }
    }

    /** Carga el inventario del usuario actual */
    async function _loadInventarioUsuario() {
         try {
             const inventarioRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`);
             const snapshot = await _getDocs(inventarioRef);
             _inventarioCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
         } catch (error) {
             console.error("Error cargando inventario del usuario:", error);
             _inventarioCache = []; // Dejar vacío si hay error
             _showModal('Error', 'No se pudo cargar tu inventario.');
         }
    }

    /** Carga los clientes desde la colección pública */
    async function _loadClientes() {
        try {
            // Usa el ID de proyecto hardcoded para la colección pública
            const clientesRef = _collection(_db, `artifacts/ventas-9a210/public/data/clientes`);
            const snapshot = await _getDocs(clientesRef);
            _clientesCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error("Error cargando clientes:", error);
            _clientesCache = [];
             _showModal('Error', 'No se pudo cargar la lista de clientes.');
        }
    }

    /** Configura los listeners y elementos de la UI de obsequios */
    function setupObsequioUI() {
        const clienteSearchInput = document.getElementById('clienteSearchObsequio');
        const cantidadInput = document.getElementById('cantidadEntregada');
        const vaciosInput = document.getElementById('vaciosRecibidos');
        const observacionInput = document.getElementById('observacion');
        const form = document.getElementById('obsequioForm');

        // Poblar nombre y stock del producto
        const productNameSpan = document.getElementById('obsequioProductName');
        const stockSpan = document.getElementById('obsequioStock');
        const vaciosTipoInfo = document.getElementById('vaciosTipoInfo');

        if (_obsequioConfig.productoData) {
            const prod = _obsequioConfig.productoData;
            productNameSpan.textContent = `${prod.marca} - ${prod.segmento} - ${prod.presentacion}`;
            const stockEnCajas = Math.floor((prod.cantidadUnidades || 0) / (prod.unidadesPorCaja || 1));
            stockSpan.textContent = stockEnCajas;
            cantidadInput.max = stockEnCajas; // Establecer máximo
            vaciosTipoInfo.textContent = `Tipo: ${prod.tipoVacio}`;
        }

        // Setup búsqueda de cliente
        clienteSearchInput.addEventListener('input', () => {
            const searchTerm = clienteSearchInput.value.toLowerCase();
            const filteredClients = _clientesCache.filter(c => c.nombreComercial.toLowerCase().includes(searchTerm) || c.nombrePersonal.toLowerCase().includes(searchTerm));
            _renderClienteDropdown(filteredClients);
            document.getElementById('clienteDropdownObsequio').classList.remove('hidden');
        });

        // Setup formulario
        cantidadInput.addEventListener('input', (e) => _obsequioActual.cantidadEntregada = parseInt(e.target.value, 10) || 0);
        vaciosInput.addEventListener('input', (e) => _obsequioActual.vaciosRecibidos = parseInt(e.target.value, 10) || 0);
        observacionInput.addEventListener('input', (e) => _obsequioActual.observacion = e.target.value.trim());
        form.addEventListener('submit', handleRegistrarObsequio);

        // Ocultar dropdown si se hace clic fuera
        document.addEventListener('click', function(event) {
             const dropdown = document.getElementById('clienteDropdownObsequio');
             const searchInput = document.getElementById('clienteSearchObsequio');
            if (dropdown && !dropdown.contains(event.target) && event.target !== searchInput) {
                dropdown.classList.add('hidden');
            }
        });
    }

    /** Renderiza el dropdown de clientes para obsequios */
    function _renderClienteDropdown(filteredClients) {
        const clienteDropdown = document.getElementById('clienteDropdownObsequio');
        if(!clienteDropdown) return;
        clienteDropdown.innerHTML = '';
        filteredClients.forEach(cliente => {
            const item = document.createElement('div');
            item.className = 'autocomplete-item';
            item.textContent = `${cliente.nombreComercial} (${cliente.nombrePersonal})`;
            item.addEventListener('click', () => _selectCliente(cliente));
            clienteDropdown.appendChild(item);
        });
    }

    /** Selecciona un cliente y muestra el formulario */
    function _selectCliente(cliente) {
        _obsequioActual.cliente = cliente;
        document.getElementById('client-search-container-obsequio').classList.add('hidden');
        document.getElementById('clienteDropdownObsequio').classList.add('hidden');
        document.getElementById('selected-client-name-obsequio').textContent = cliente.nombreComercial;
        document.getElementById('client-display-container-obsequio').classList.remove('hidden');
        document.getElementById('obsequioForm').classList.remove('hidden');
    }

    /**
     * Valida, registra la entrega de obsequio, actualiza stock/saldos y genera ticket.
     */
    async function handleRegistrarObsequio(e) {
        e.preventDefault();
        if (!_obsequioActual.cliente) {
            _showModal('Error', 'Debes seleccionar un cliente.');
            return;
        }
        if (!_obsequioConfig.productoId || !_obsequioConfig.productoData) {
            _showModal('Error', 'Producto de obsequio no configurado o no encontrado.');
            return;
        }

        const cantidadEntregada = _obsequioActual.cantidadEntregada;
        const vaciosRecibidos = _obsequioActual.vaciosRecibidos;
        const productoObsequio = _obsequioConfig.productoData;
        const unidadesPorCaja = productoObsequio.unidadesPorCaja || 1;
        const stockActualCajas = Math.floor((productoObsequio.cantidadUnidades || 0) / unidadesPorCaja);

        if (cantidadEntregada <= 0) {
            _showModal('Error', 'La cantidad de cajas entregadas debe ser mayor que cero.');
            return;
        }
        if (cantidadEntregada > stockActualCajas) {
            _showModal('Error', `Stock insuficiente. Solo hay ${stockActualCajas} cajas disponibles.`);
            return;
        }
        if (!productoObsequio.tipoVacio) {
             _showModal('Error', `El producto "${productoObsequio.presentacion}" no tiene un tipo de vacío asignado.`);
             return;
        }

        const confirmMsg = `
            Confirmar entrega:<br>
            - Cliente: ${_obsequioActual.cliente.nombreComercial}<br>
            - Producto: ${productoObsequio.presentacion}<br>
            - Cajas Entregadas: ${cantidadEntregada}<br>
            - Vacíos Recibidos (${productoObsequio.tipoVacio}): ${vaciosRecibidos}<br>
            - Observación: ${_obsequioActual.observacion || 'Ninguna'}
        `;

        _showModal('Confirmar Obsequio', confirmMsg, async () => {
            _showModal('Progreso', 'Registrando entrega...');

            try {
                const batch = _writeBatch(_db);
                const unidadesARestar = cantidadEntregada * unidadesPorCaja;
                const nuevoStockUnidades = (productoObsequio.cantidadUnidades || 0) - unidadesARestar;

                // Actualizar stock
                const inventarioRef = _doc(_db, `artifacts/${_appId}/users/${_userId}/inventario`, _obsequioConfig.productoId);
                batch.update(inventarioRef, { cantidadUnidades: nuevoStockUnidades });

                // Actualizar saldo de vacíos del cliente (si se recibieron)
                if (vaciosRecibidos > 0) {
                    // Usa el ID de proyecto hardcoded para la colección pública de clientes
                    const clienteRef = _doc(_db, `artifacts/ventas-9a210/public/data/clientes`, _obsequioActual.cliente.id);
                    await _runTransaction(_db, async (transaction) => {
                        const clienteDoc = await transaction.get(clienteRef);
                        if (!clienteDoc.exists()) throw "El cliente no existe.";

                        const clienteData = clienteDoc.data();
                        const saldoVacios = clienteData.saldoVacios || {};
                        const tipoVacioProducto = productoObsequio.tipoVacio;
                        const saldoActualTipo = saldoVacios[tipoVacioProducto] || 0;

                        // Restar los vacíos recibidos del saldo pendiente
                        saldoVacios[tipoVacioProducto] = saldoActualTipo - vaciosRecibidos;

                        transaction.update(clienteRef, { saldoVacios: saldoVacios });
                    });
                     // Nota: No incluimos la actualización del cliente en el batch principal
                     // porque ya se hizo en la transacción separada.
                }

                // Guardar registro de la entrega
                const registroRef = _doc(_collection(_db, `artifacts/${_appId}/users/${_userId}/obsequios_entregados`));
                const registroData = {
                    fecha: new Date(),
                    clienteId: _obsequioActual.cliente.id,
                    clienteNombre: _obsequioActual.cliente.nombreComercial,
                    productoId: _obsequioConfig.productoId,
                    productoNombre: productoObsequio.presentacion,
                    cantidadCajas: cantidadEntregada,
                    vaciosRecibidos: vaciosRecibidos,
                    tipoVacio: productoObsequio.tipoVacio,
                    observacion: _obsequioActual.observacion,
                    userId: _userId
                };
                batch.set(registroRef, registroData);

                // Ejecutar el batch (actualización de stock y registro de entrega)
                await batch.commit();

                // Generar ticket
                 _showSharingOptionsObsequio(registroData, productoObsequio, showGestionObsequiosView);


            } catch (error) {
                console.error("Error al registrar obsequio:", error);
                _showModal('Error', `No se pudo registrar la entrega: ${error.message}`);
            }

        }, 'Sí, Confirmar');
    }

    // --- Funciones adaptadas para Tickets de Obsequio ---

    function _createTicketHTMLObsequio(registro, producto) {
        const fecha = registro.fecha.toLocaleDateString('es-ES');
        const clienteNombre = registro.clienteNombre;
        // Obtener nombre personal del cliente (requiere buscar en _clientesCache o pasar el objeto cliente)
        const clienteObj = _clientesCache.find(c => c.id === registro.clienteId);
        const clienteNombrePersonal = clienteObj?.nombrePersonal || '';

        const titulo = 'ENTREGA DE OBSEQUIO';

        return `
            <div id="temp-ticket-for-image" class="bg-white text-black p-4 font-bold" style="width: 768px; font-family: 'Courier New', Courier, monospace;">
                <div class="text-center">
                    <h2 class="text-4xl uppercase">${titulo}</h2>
                    <p class="text-3xl">DISTRIBUIDORA CASTILLO YAÑEZ</p>
                </div>
                <div class="text-3xl mt-8">
                    <p>FECHA: ${fecha}</p>
                    <p>CLIENTE: ${clienteNombre}</p>
                </div>
                <table class="w-full text-3xl mt-6">
                    <thead>
                        <tr>
                            <th class="pb-2 text-left">PRODUCTO ENTREGADO</th>
                            <th class="pb-2 text-center">CANT.</th>
                        </tr>
                    </thead>
                    <tbody>
                         <tr class="align-top">
                            <td class="py-2 pr-2 text-left" style="width: 80%;">
                                <div style="line-height: 1.2;">${producto.segmento || ''} ${producto.marca || ''} ${registro.productoNombre}</div>
                            </td>
                            <td class="py-2 text-center" style="width: 20%;">${registro.cantidadCajas} CJ</td>
                        </tr>
                    </tbody>
                </table>
                 ${registro.vaciosRecibidos > 0 ? `
                 <div class="text-3xl mt-6 border-t border-black border-dashed pt-4">
                     <p>ENVASES RECIBIDOS:</p>
                     <table class="w-full text-3xl mt-2">
                         <tbody>
                            <tr>
                                <td class="py-1 pr-2 text-left" style="width: 70%;">${registro.tipoVacio}</td>
                                <td class="py-1 pl-2 text-right" style="width: 30%;">${registro.vaciosRecibidos} CJ</td>
                            </tr>
                         </tbody>
                     </table>
                 </div>
                 ` : ''}
                 ${registro.observacion ? `
                 <div class="text-3xl mt-6 border-t border-black border-dashed pt-4">
                     <p>OBSERVACIÓN:</p>
                     <p class="font-normal">${registro.observacion}</p>
                 </div>
                 ` : ''}
                <div class="text-center mt-16">
                    <p class="border-t border-black w-96 mx-auto"></p>
                    <p class="mt-4 text-3xl">${clienteNombrePersonal}</p>
                </div>
                <hr class="border-dashed border-black mt-6">
            </div>
        `;
    }

    function _createRawTextTicketObsequio(registro, producto) {
        const fecha = registro.fecha.toLocaleDateString('es-ES');

        const toTitleCase = (str) => {
            if (!str) return '';
            return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
        };

        const clienteNombre = toTitleCase(registro.clienteNombre);
        const clienteObj = _clientesCache.find(c => c.id === registro.clienteId);
        const clienteNombrePersonal = toTitleCase(clienteObj?.nombrePersonal || '');

        const LINE_WIDTH = 48;
        let ticket = '';

        const center = (text) => text.padStart(Math.floor((LINE_WIDTH - text.length) / 2) + text.length, ' ').padEnd(LINE_WIDTH, ' ');
         const wordWrap = (text, maxWidth) => {
            const lines = [];
            if (!text) return lines;
            let currentLine = '';
            const words = text.split(' ');
            for (const word of words) {
                if ((currentLine + ' ' + word).trim().length > maxWidth) {
                    if(currentLine.length > 0) lines.push(currentLine.trim());
                    currentLine = word;
                } else {
                    currentLine = (currentLine + ' ' + word).trim();
                }
            }
            if (currentLine) lines.push(currentLine.trim());
            return lines;
        };

        ticket += center('Distribuidora Castillo Yañez') + '\n';
        ticket += center('Entrega de Obsequio') + '\n\n';

        const wrappedClientName = wordWrap(`Cliente: ${clienteNombre}`, LINE_WIDTH);
        wrappedClientName.forEach(line => {
            ticket += line + '\n';
        });
        ticket += `Fecha: ${fecha}\n`;
        ticket += '-'.repeat(LINE_WIDTH) + '\n';

        ticket += 'PRODUCTO ENTREGADO'.padEnd(LINE_WIDTH - 9) + 'CANT.'.padStart(9) + '\n';
        const productName = toTitleCase(`${producto.segmento || ''} ${producto.marca || ''} ${registro.productoNombre}`);
        const wrappedProductName = wordWrap(productName, LINE_WIDTH - 10); // Dejar espacio para cantidad
        wrappedProductName.forEach((line, index) => {
             const qtyStr = index === wrappedProductName.length - 1 ? `${registro.cantidadCajas} CJ` : '';
             ticket += line.padEnd(LINE_WIDTH - 9) + qtyStr.padStart(9) + '\n';
        });

        if (registro.vaciosRecibidos > 0) {
            ticket += '-'.repeat(LINE_WIDTH) + '\n';
            ticket += center('ENVASES RECIBIDOS') + '\n';
            const vacioText = `${registro.tipoVacio}`;
            const vacioQtyText = `${registro.vaciosRecibidos} CJ`;
             ticket += vacioText.padEnd(LINE_WIDTH - vacioQtyText.length) + vacioQtyText + '\n';
        }

         if (registro.observacion) {
            ticket += '-'.repeat(LINE_WIDTH) + '\n';
            ticket += 'OBSERVACION:\n';
             const wrappedObs = wordWrap(registro.observacion, LINE_WIDTH);
             wrappedObs.forEach(line => { ticket += line + '\n'; });
        }


        ticket += '-'.repeat(LINE_WIDTH) + '\n\n';
        ticket += '\n\n\n\n';
        ticket += center('________________________') + '\n';
        ticket += center(clienteNombrePersonal) + '\n\n';
        ticket += '-'.repeat(LINE_WIDTH) + '\n';

        return ticket;
    }

    async function _handleShareTicketObsequio(htmlContent, successCallback) {
         _showModal('Progreso', 'Generando imagen...');
        const tempDiv = document.createElement('div');
        tempDiv.style.position = 'absolute';
        tempDiv.style.left = '-9999px';
        tempDiv.style.top = '0';
        tempDiv.innerHTML = htmlContent;
        document.body.appendChild(tempDiv);

        const ticketElement = document.getElementById('temp-ticket-for-image');
        if (!ticketElement) {
             _showModal('Error', 'No se pudo encontrar el elemento del ticket.');
             document.body.removeChild(tempDiv);
             successCallback(); // Continuar aunque falle la imagen
             return;
        }

        try {
            await new Promise(resolve => setTimeout(resolve, 100)); // Pequeña pausa para renderizar
            const canvas = await html2canvas(ticketElement, { scale: 3 });
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));

            if (navigator.share && blob) {
                await navigator.share({ files: [new File([blob], "obsequio.png", { type: "image/png" })], title: "Ticket de Obsequio" });
                 _showModal('Éxito', 'Entrega registrada. Imagen compartida.', successCallback);
            } else {
                 _showModal('Error', 'Función de compartir no disponible.', successCallback);
            }
        } catch(e) {
             _showModal('Error', `No se pudo generar/compartir imagen: ${e.message}`, successCallback);
        } finally {
            document.body.removeChild(tempDiv);
        }
    }

    async function _handleShareRawTextObsequio(textContent, successCallback) {
         if (navigator.share) {
            try {
                await navigator.share({ title: 'Ticket de Obsequio', text: textContent });
                 _showModal('Éxito', 'Entrega registrada. Ticket listo para imprimir.', successCallback);
            } catch (err) {
                 _showModal('Aviso', 'No se compartió el ticket. Entrega registrada.', successCallback);
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
                 _showModal('Error', 'No se pudo compartir ni copiar. Entrega registrada.', successCallback);
            }
        }
    }

    function _showSharingOptionsObsequio(registro, producto, successCallback) {
        const modalContent = `
            <div class="text-center">
                <h3 class="text-xl font-bold text-gray-800 mb-4">Generar Ticket de Obsequio</h3>
                <p class="text-gray-600 mb-6">Elige el formato para el comprobante.</p>
                <div class="space-y-4">
                    <button id="printTextBtnObs" class="w-full px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg shadow-md hover:bg-blue-600">Imprimir (Texto)</button>
                    <button id="shareImageBtnObs" class="w-full px-6 py-3 bg-green-500 text-white font-semibold rounded-lg shadow-md hover:bg-green-600">Compartir (Imagen)</button>
                </div>
            </div>`;

         _showModal('Elige una opción', modalContent, null, ''); // No mostrar botón de confirmación por defecto

        document.getElementById('printTextBtnObs').addEventListener('click', () => {
            const rawTextTicket = _createRawTextTicketObsequio(registro, producto);
             _handleShareRawTextObsequio(rawTextTicket, successCallback);
        });

        document.getElementById('shareImageBtnObs').addEventListener('click', () => {
            const ticketHTML = _createTicketHTMLObsequio(registro, producto);
             _handleShareTicketObsequio(ticketHTML, successCallback);
        });
    }


})(); // Fin del IIFE
