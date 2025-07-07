// saleModule.js

// Funciones relacionadas con la pantalla de Venta
// Estas funciones serán llamadas desde index.html, por lo que necesitan acceso a variables globales
// que se pasarán como argumentos o se accederán a través de un objeto de contexto.
// Por ahora, las definimos aquí asumiendo que las variables globales necesarias se inyectarán.

// NOTA: Las variables globales como 'clients', 'inventory', 'dailySales', 'selectedClientForSale',
// 'saleQuantities', 'currentUserData', 'productImages', 'db', 'showMessageModal',
// 'showConfirmationModal', 'setScreenAndRender', 'getCurrentDateFormatted', 'downloadCSV',
// 'selectedVendor' NO están definidas en este archivo. Deberán ser pasadas como argumentos
// a una función de inicialización o a cada función si se desea un acoplamiento más bajo.
// Para este ejercicio, asumiremos que se pasarán a una función de inicialización o se accederán
// a través de un objeto global exportado.

// Definimos una función para inicializar el módulo de venta, que recibirá las dependencias.
// Esto es crucial para que el módulo sea independiente y reutilizable.
let _clients, _inventory, _dailySales, _vehicles, _currentTruckInventory, _users, _loadRecords, _transferRecords;
let _selectedClientForSale, _saleQuantities, _clientSearchTerm, _showClientPickerModal;
let _currentUserData, _productImages, _db, _showMessageModal, _showConfirmationModal, _setScreenAndRender, _getCurrentDateFormatted, _downloadCSV, _selectedVendor;

export const initSaleModule = (dependencies) => {
    // Asignar dependencias a variables locales para su uso dentro del módulo
    _clients = dependencies.clients;
    _inventory = dependencies.inventory;
    _dailySales = dependencies.dailySales;
    _vehicles = dependencies.vehicles;
    _currentTruckInventory = dependencies.currentTruckInventory;
    _users = dependencies.users;
    _loadRecords = dependencies.loadRecords;
    _transferRecords = dependencies.transferRecords;

    _selectedClientForSale = dependencies.selectedClientForSale;
    _saleQuantities = dependencies.saleQuantities;
    _clientSearchTerm = dependencies.clientSearchTerm;
    _showClientPickerModal = dependencies.showClientPickerModal;

    _currentUserData = dependencies.currentUserData;
    _productImages = dependencies.productImages;
    _db = dependencies.db;
    _showMessageModal = dependencies.showMessageModal;
    _showConfirmationModal = dependencies.showConfirmationModal;
    _setScreenAndRender = dependencies.setScreenAndRender;
    _getCurrentDateFormatted = dependencies.getCurrentDateFormatted;
    _downloadCSV = dependencies.downloadCSV;
    _selectedVendor = dependencies.selectedVendor;

    // También necesitamos una forma de actualizar las variables en el archivo principal (index.html)
    // Esto se hará a través de funciones de actualización que se pasen como dependencias
    _updateGlobalState = dependencies.updateGlobalState; // Una función para actualizar el estado global en index.html
};

// Función auxiliar para actualizar el estado global en index.html
let _updateGlobalState = () => {}; // Se inicializará en initSaleModule

export const renderVentaScreen = () => {
    const ventaDiv = document.createElement('div');
    ventaDiv.className = 'screen-container bg-white rounded-xl m-2 shadow-md';
    ventaDiv.innerHTML = `
        <h2 class="text-2xl font-bold mb-5 text-center text-indigo-700">VENTA</h2>

        <button class="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-5 rounded-lg w-full shadow-md transition duration-300 ease-in-out transform hover:scale-105" onclick="saleModule.toggleClientPickerModal(true)">Seleccionar Cliente</button>

        <div id="selected-client-display" class="text-lg font-bold text-center my-4 text-emerald-800"></div>
        <div id="product-sale-container"></div>
        <div id="info-text" class="text-base text-center my-5 text-gray-600"></div>

        <button class="bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-5 rounded-lg mt-5 w-full shadow-md transition duration-300 ease-in-out transform hover:scale-105" onclick="saleModule.resetVentaStateAndGoToMain()">Volver al Menú Principal</button>
    `;
    // Asumimos que appRoot es global o se pasa como dependencia
    document.getElementById('app-root').appendChild(ventaDiv);

    updateVentaScreenContent();
};

export const updateVentaScreenContent = () => {
    const selectedClientDisplay = document.getElementById('selected-client-display');
    const productSaleContainer = document.getElementById('product-sale-container');
    const infoText = document.getElementById('info-text');

    const isUser = () => _currentUserData.role === 'user'; // Helper local

    // Si el usuario es normal y no tiene un camión asignado, no puede realizar ventas
    if (isUser() && !_currentUserData.assignedTruckPlate) {
        selectedClientDisplay.textContent = '';
        infoText.textContent = 'No tienes un camión asignado. Por favor, contacta a un administrador para que te asigne uno.';
        productSaleContainer.innerHTML = '';
        return;
    }

    // Determinar qué inventario mostrar y de qué fuente se realizará la venta
    const inventoryToDisplay = _currentUserData.assignedTruckPlate ? _currentTruckInventory : _inventory;
    const inventorySourceText = _currentUserData.assignedTruckPlate ? ` (Camión: ${_currentUserData.assignedTruckPlate})` : ' (Almacén Principal)';

    if (_selectedClientForSale) {
        selectedClientDisplay.textContent = `Cliente Seleccionado: ${_selectedClientForSale.nombreComercial}`;
        infoText.textContent = `Inventario actual${inventorySourceText}`; // Mostrar de qué inventario se vende

        productSaleContainer.innerHTML = `
            <div class="table-container mb-5">
                <table>
                    <thead>
                        <tr>
                            <th>Imagen</th>
                            <th>SKU</th>
                            <th>Cantidad a Vender</th>
                            <th>Producto</th>
                            <th>Presentación</th>
                            <th>Precio</th>
                            <th>Disponible</th>
                        </tr>
                    </thead>
                    <tbody id="products-for-sale-body">
                    </tbody>
                </table>
            </div>
            <button class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-5 rounded-lg mt-3 w-full shadow-md transition duration-300 ease-in-out transform hover:scale-105" onclick="saleModule.showFinalizeSaleConfirmation()">Finalizar Venta</button>
        `;
        const productsForSaleBody = document.getElementById('products-for-sale-body');
        inventoryToDisplay.forEach(item => {
            const row = document.createElement('tr');
            // Usar 'quantity' y 'price' para inventario de camiones, 'cantidad' y 'precio' para almacén
            const quantity = item.quantity !== undefined ? item.quantity : item.cantidad;
            const price = item.price !== undefined ? item.price : item.precio;

            row.innerHTML = `
                <td><img src="${_productImages[item.sku] || _productImages['default']}" alt="Imagen de ${item.producto}" class="w-12 h-12 rounded-md object-cover"></td>
                <td>${item.sku}</td>
                <td><input type="number" class="border border-gray-300 rounded-md text-center" value="${_saleQuantities[item.sku] || ''}" onchange="saleModule.handleProductQuantityChange('${item.sku}', this.value)" min="0" max="${quantity}"></td>
                <td>${item.producto}</td>
                <td>${item.presentacion}</td>
                <td>$${price.toFixed(2)}</td>
                <td>${quantity}</td>
            `;
            productsForSaleBody.appendChild(row);
        });

    } else {
        selectedClientDisplay.textContent = '';
        infoText.textContent = 'Por favor, seleccione un cliente para iniciar la venta.';
        productSaleContainer.innerHTML = '';
    }

    if (_showClientPickerModal) {
        renderClientPickerModal();
    } else {
        const existingModal = document.getElementById('client-picker-modal');
        if (existingModal) existingModal.remove();
    }
};

export const handleProductQuantityChange = (sku, quantity) => {
    _saleQuantities[sku] = parseInt(quantity) || 0;
};

export const showFinalizeSaleConfirmation = () => {
    console.log('[showFinalizeSaleConfirmation] Llamado.');
    _showConfirmationModal('¿Estás seguro de que quieres finalizar esta venta? Esto actualizará el inventario y generará un archivo de venta.', finalizeSaleLogic);
};

export const finalizeSaleLogic = async () => {
    console.log('[finalizeSaleLogic] Iniciando...');
    if (!_selectedClientForSale) {
        _showMessageModal('Error: Por favor, seleccione un cliente primero.');
        console.error('[finalizeSaleLogic] Error: No hay cliente seleccionado para finalizar la venta.');
        return;
    }

    const isUser = () => _currentUserData.role === 'user'; // Helper local

    // Si el usuario es normal y no tiene un camión asignado, no puede realizar ventas
    if (isUser() && !_currentUserData.assignedTruckPlate) {
        _showMessageModal('Error: No tienes un camión asignado para realizar ventas.');
        console.error('[finalizeSaleLogic] Error: Usuario no tiene camión asignado.');
        return;
    }

    const saleData = [];
    let totalSaleAmount = 0;
    let hasInsufficientStock = false;
    let messages = [];

    // Determinar el inventario de origen (camión o almacén principal)
    const sourceInventoryCollection = _currentUserData.assignedTruckPlate ? 'truck_inventories' : 'inventory';
    const sourceInventoryDocId = _currentUserData.assignedTruckPlate; // Placa del camión si es un camión

    let currentSourceInventoryData;
    if (sourceInventoryCollection === 'truck_inventories') {
        const truckInventoryDoc = await _db.collection(sourceInventoryCollection).doc(sourceInventoryDocId).get();
        currentSourceInventoryData = truckInventoryDoc.exists ? (truckInventoryDoc.data().items || []) : [];
    } else {
        // Para el almacén, trabajamos con el array '_inventory' global ya cargado
        currentSourceInventoryData = JSON.parse(JSON.stringify(_inventory));
    }

    let updatedSourceInventory = JSON.parse(JSON.stringify(currentSourceInventoryData)); // Copia para modificar

    for (const item of currentSourceInventoryData) { // Iterar sobre los datos del inventario de origen
        const quantitySold = _saleQuantities[item.sku] || 0;
        const availableQuantity = item.quantity !== undefined ? item.quantity : item.cantidad;

        if (quantitySold > 0) {
            if (quantitySold > availableQuantity) {
                messages.push(`Error: La cantidad a vender de "${item.producto}" (${quantitySold}) excede el stock disponible (${availableQuantity}).`);
                hasInsufficientStock = true;
            } else {
                const price = item.price !== undefined ? item.price : item.precio;
                const subtotal = quantitySold * price;
                saleData.push({
                    sku: item.sku,
                    producto: item.producto,
                    presentacion: item.presentacion,
                    cantidadVendida: quantitySold,
                    precioUnitario: price,
                    subtotal: subtotal,
                });
                totalSaleAmount += subtotal;

                // Actualizar la cantidad en la copia del inventario de origen
                updatedSourceInventory = updatedSourceInventory.map(invItem =>
                    invItem.sku === item.sku ? { ...invItem, quantity: (invItem.quantity !== undefined ? invItem.quantity : invItem.cantidad) - quantitySold, cantidad: (invItem.quantity !== undefined ? invItem.quantity : invItem.cantidad) - quantitySold } : invItem
                );
            }
        }
    }

    if (hasInsufficientStock) {
        _showMessageModal(messages.join('\n'));
        console.error('[finalizeSaleLogic] Error: Stock insuficiente detectado. Deteniendo venta.');
        return;
    }

    if (saleData.length === 0) {
        _showMessageModal('Error: No se ha ingresado ninguna cantidad para la venta.');
        console.warn('[finalizeSaleLogic] Advertencia: No se ingresó ninguna cantidad para la venta.');
        return;
    }

    const fileName = `venta_${_selectedClientForSale.nombreComercial.replace(/\s/g, '_')}_${_getCurrentDateFormatted()}.csv`;
    const saleRecord = {
        fileName: fileName,
        client: _selectedClientForSale,
        date: _getCurrentDateFormatted(),
        items: saleData,
        total: totalSaleAmount,
        vendor: _selectedVendor, // Guardar el vendedor que realizó la venta
        sourceInventory: _currentUserData.assignedTruckPlate ? _currentUserData.assignedTruckPlate : 'warehouse', // Origen del inventario
        rawCSV: `SKU,Producto,Presentacion,Cantidad,Precio Unitario,Subtotal\n` +
                saleData.map(item => `${item.sku},${item.producto},${item.presentacion},${item.cantidadVendida},${item.precioUnitario.toFixed(2)},${item.subtotal.toFixed(2)}`).join('\n') +
                `\nTotal General:, , , , ,${totalSaleAmount.toFixed(2)}`
    };
    console.log('[finalizeSaleLogic] Contenido rawCSV para descarga:', saleRecord.rawCSV);

    try {
        const docRef = await _db.collection('dailySales').add(saleRecord);
        saleRecord.docId = docRef.id;
        _dailySales.push(saleRecord); // Actualizar el estado local de dailySales
        console.log('[Firestore] Venta guardada en Firestore con ID:', docRef.id);

        // Actualizar el inventario de la fuente correcta en Firestore
        if (sourceInventoryCollection === 'truck_inventories') {
            await _db.collection('truck_inventories').doc(sourceInventoryDocId).set({ items: updatedSourceInventory });
            _updateGlobalState('currentTruckInventory', updatedSourceInventory); // Actualizar inventario local del camión
            console.log(`[Firestore] Inventario del camión ${sourceInventoryDocId} actualizado en Firestore.`);
        } else { // Es 'inventory' (almacén principal) - Esto no debería ocurrir si las ventas siempre son de camiones
            // Si por alguna razón un usuario sin camión asignado pudiera vender del almacén directamente,
            // esta lógica lo manejaría, pero la instrucción es que el inventario principal se deduce al cierre.
            // Por ahora, no se modifica el inventario principal aquí.
            console.log('[finalizeSaleLogic] Venta realizada desde el almacén principal. La deducción se realizará en el cierre de ventas.');
        }

        messages.push(`Venta Completada: Archivo de venta "${fileName}" generado y guardado en Firestore.`);
        messages.push(`Imprimiendo: Simulando impresión de la venta para ${_selectedClientForSale.nombreComercial}.`);

    } catch (error) {
        console.error('Error al finalizar la venta y guardar en Firestore:', error);
        _showMessageModal('Error al finalizar la venta. Por favor, revisa tu conexión y las reglas de seguridad de Firestore.');
        return;
    }

    resetVentaState();
    _setScreenAndRender('main');
    _showMessageModal(messages.join('\n'));
    console.log('[finalizeSaleLogic] Finalizado.');
};

export const toggleClientPickerModal = (show) => {
    _showClientPickerModal = show;
    _updateGlobalState('showClientPickerModal', show); // Actualizar estado global
    _setScreenAndRender('venta'); // Re-renderizar la pantalla de venta para mostrar/ocultar el modal
};

export const renderClientPickerModal = () => {
    if (!_showClientPickerModal) return;

    const modalDiv = document.createElement('div');
    modalDiv.id = 'client-picker-modal';
    modalDiv.className = 'modal';
    modalDiv.innerHTML = `
        <div class="modal-content">
            <h3 class="text-2xl font-bold mb-4 text-center text-indigo-700">Seleccionar Cliente</h3>
            <input type="text" id="clientSearchInput" class="h-12 border border-gray-300 rounded-lg px-4 mb-4 text-base w-full bg-white" placeholder="Buscar cliente..." onkeyup="saleModule.filterClientsForPicker(this.value)">
            <div id="client-picker-list" class="max-h-60 overflow-y-auto w-full"></div>
            <button class="bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-5 rounded-lg mt-5 w-full shadow-md transition duration-300 ease-in-out transform hover:scale-105" onclick="saleModule.toggleClientPickerModal(false)">Cerrar</button>
        </div>
    `;
    document.getElementById('app-root').appendChild(modalDiv); // Asumimos appRoot es global

    updateClientPickerList();
};

export const updateClientPickerList = () => {
    const clientPickerListDiv = document.getElementById('client-picker-list');
    if (!clientPickerListDiv) return;

    clientPickerListDiv.innerHTML = '';
    const filteredClients = _clients.filter(client =>
        client.nombreComercial.toLowerCase().includes(_clientSearchTerm.toLowerCase()) ||
        client.nombrePersonal.toLowerCase().includes(_clientSearchTerm.toLowerCase())
    );

    filteredClients.forEach(client => {
        const clientItem = document.createElement('button');
        clientItem.className = 'block w-full text-left p-3 border-b border-gray-200 hover:bg-blue-50 transition duration-150 ease-in-out rounded-md';
        clientItem.textContent = `${client.nombreComercial} (${client.nombrePersonal})`;
        clientItem.onclick = () => {
            _selectedClientForSale = client;
            _updateGlobalState('selectedClientForSale', client); // Actualizar estado global
            toggleClientPickerModal(false);
            _clientSearchTerm = '';
            _updateGlobalState('clientSearchTerm', ''); // Actualizar estado global
            updateVentaScreenContent();
        };
        clientPickerListDiv.appendChild(clientItem);
    });
};

export const filterClientsForPicker = (term) => {
    _clientSearchTerm = term;
    _updateGlobalState('clientSearchTerm', term); // Actualizar estado global
    updateClientPickerList();
};

export const resetVentaState = () => {
    _selectedClientForSale = null;
    _saleQuantities = {};
    // _currentProductIndex = 0; // currentProductIndex no parece ser una variable global persistente de venta
    _updateGlobalState('selectedClientForSale', null);
    _updateGlobalState('saleQuantities', {});
};

export const resetVentaStateAndGoToMain = () => {
    resetVentaState();
    _setScreenAndRender('main');
};
