// receivingModule.js

// Variables que se inyectarán desde el módulo principal (index.html)
let _isAdmin;
let _inventory;
let _vehicles;
let _vendors;
let _db;
let _showMessageModal;
let _showConfirmationModal;
let _setScreenAndRender;
let _getCurrentDateFormatted;
let _downloadCSV;
let _loadRecords;
let _fetchDataFromFirestore; // Necesario para re-fetch después de reset

// Estado local del módulo de recepción
let _selectedTruckForReceiving = null;
let _selectedLoader = null;
let _receivingQuantities = {};
let _selectedTruckInventoryForReceiving = [];

// Estado local para el reset de cargas iniciales
let _resetQuantities = {};
let _allTruckInventories = {};

export const initReceivingModule = (dependencies) => {
    _isAdmin = dependencies.isAdmin;
    _inventory = dependencies.inventory;
    _vehicles = dependencies.vehicles;
    _vendors = dependencies.vendors;
    _db = dependencies.db;
    _showMessageModal = dependencies.showMessageModal;
    _showConfirmationModal = dependencies.showConfirmationModal;
    _setScreenAndRender = dependencies.setScreenAndRender;
    _getCurrentDateFormatted = dependencies.getCurrentDateFormatted;
    _downloadCSV = dependencies.downloadCSV;
    _loadRecords = dependencies.loadRecords;
    _fetchDataFromFirestore = dependencies.fetchDataFromFirestore;

    // Inicializar estados locales si se pasan como dependencias o se necesitan valores iniciales
    _selectedTruckForReceiving = dependencies.selectedTruckForReceiving || null;
    _selectedLoader = dependencies.selectedLoader || null;
    _receivingQuantities = dependencies.receivingQuantities || {};
    _selectedTruckInventoryForReceiving = dependencies.selectedTruckInventoryForReceiving || [];
    _resetQuantities = dependencies.resetQuantities || {};
    _allTruckInventories = dependencies.allTruckInventories || {};
};

// Pantalla de selección para la sección "CARGA" (solo para admins)
export const renderCargaSelectionScreen = () => {
    if (!_isAdmin()) {
        _showMessageModal('Acceso denegado: Solo los administradores pueden acceder a la sección de Carga.');
        _setScreenAndRender('main');
        return;
    }

    const cargaSelectionDiv = document.createElement('div');
    cargaSelectionDiv.className = 'screen-container bg-white rounded-xl m-2 shadow-md';
    cargaSelectionDiv.innerHTML = `
        <h2 class="text-2xl font-bold mb-5 text-center text-indigo-700">SECCIÓN DE CARGA</h2>
        <p class="text-base text-center my-5 text-gray-600">
            Selecciona una opción para la gestión de cargas.
        </p>
        <div class="flex flex-wrap justify-center gap-4">
            <button class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-6 rounded-lg m-2 min-w-[150px] shadow-md transition duration-300 ease-in-out transform hover:scale-105 border border-indigo-700" onclick="receivingModule.renderTruckReceivingScreen()">RECEPCIÓN DE MERCANCÍA EN CAMIÓN</button>
            <button class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-6 rounded-lg m-2 min-w-[150px] shadow-md transition duration-300 ease-in-out transform hover:scale-105 border border-indigo-700" onclick="receivingModule.renderLoadHistoryScreen()">HISTORIAL DE CARGAS</button>
            <button class="bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-6 rounded-lg m-2 min-w-[150px] shadow-md transition duration-300 ease-in-out transform hover:scale-105 border border-red-700" onclick="receivingModule.renderResetCargasInicialesPasswordScreen()">RESET CARGAS INICIALES</button>
        </div>
        <button class="bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-5 rounded-lg mt-5 w-full shadow-md transition duration-300 ease-in-out transform hover:scale-105" onclick="_setScreenAndRender('main')">Volver</button>
    `;
    document.getElementById('app-root').appendChild(cargaSelectionDiv);
};

// Pantalla de solicitud de contraseña para Reset Cargas Iniciales
export const renderResetCargasInicialesPasswordScreen = () => {
    if (!_isAdmin()) {
        _showMessageModal('Acceso denegado: Solo los administradores pueden acceder a esta función.');
        _setScreenAndRender('main');
        return;
    }

    const passwordScreenDiv = document.createElement('div');
    passwordScreenDiv.className = 'screen-container bg-white rounded-xl shadow-md p-8 max-w-md mx-auto my-10';
    passwordScreenDiv.innerHTML = `
        <h2 class="text-2xl font-bold mb-6 text-center text-red-700">Confirmación de Seguridad</h2>
        <p class="text-lg text-center mb-6 text-gray-700">Esta función altera directamente los diversos inventarios (Principal y por vehículo) de la empresa, necesitamos confirmación si desea continuar.</p>
        <input type="password" id="adminPasswordForReset" class="h-12 border border-gray-300 rounded-lg px-4 mb-4 text-base w-full bg-white focus:ring-2 focus:ring-red-500 focus:border-transparent" placeholder="Contraseña de Administrador">
        <button class="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-5 rounded-lg w-full shadow-md transition duration-300 ease-in-out transform hover:scale-105" onclick="receivingModule.handleResetCargasInicialesPassword()">Continuar</button>
        <button class="bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-5 rounded-lg mt-3 w-full shadow-md transition duration-300 ease-in-out transform hover:scale-105" onclick="receivingModule.renderCargaSelectionScreen()">Cancelar</button>
    `;
    document.getElementById('app-root').appendChild(passwordScreenDiv);
};

// Lógica para verificar la contraseña del administrador
export const handleResetCargasInicialesPassword = async () => {
    const password = document.getElementById('adminPasswordForReset').value;

    if (!password) {
        _showMessageModal('Por favor, ingresa la contraseña.');
        return;
    }

    try {
        // Re-autenticar al usuario actual con la contraseña proporcionada
        // Esto asume que `firebase.auth()` y `currentUser` están disponibles globalmente o se pasan como dependencia
        const currentUser = firebase.auth().currentUser;
        if (!currentUser) {
            _showMessageModal('No hay usuario autenticado. Por favor, inicia sesión de nuevo.');
            _setScreenAndRender('login');
            return;
        }
        const credential = firebase.auth.EmailAuthProvider.credential(currentUser.email, password);
        await currentUser.reauthenticateWithCredential(credential);

        // Si la re-autenticación es exitosa, cargar los datos y pasar a la pantalla de edición
        await loadAllInventoriesForReset();
        _setScreenAndRender('resetCargasInicialesEdit');

    } catch (error) {
        _showMessageModal(`Error de autenticación: ${error.message}. Contraseña incorrecta o sesión expirada.`);
        console.error("Error de re-autenticación para reset de cargas:", error);
    }
};

// Cargar todos los inventarios (principal y de camiones) para la edición
const loadAllInventoriesForReset = async () => {
    _resetQuantities = {};
    _allTruckInventories = {};

    // Cargar inventario principal
    const mainInvSnapshot = await _db.collection('inventory').get();
    _inventory = mainInvSnapshot.docs.map(doc => ({ sku: doc.id, ...doc.data() }));

    // Inicializar resetQuantities con el inventario principal
    _inventory.forEach(item => {
        _resetQuantities[item.sku] = {
            main: item.cantidad,
            trucks: {}
        };
    });

    // Cargar inventarios de todos los camiones
    const truckInvSnapshot = await _db.collection('truck_inventories').get();
    truckInvSnapshot.docs.forEach(doc => {
        const truckPlate = doc.id;
        const items = doc.data().items || [];
        _allTruckInventories[truckPlate] = items;

        items.forEach(item => {
            if (!_resetQuantities[item.sku]) {
                // Si un SKU existe en un camión pero no en el inventario principal, inicializarlo
                _resetQuantities[item.sku] = {
                    main: 0, // Por defecto 0 en principal si no existe
                    trucks: {}
                };
            }
            _resetQuantities[item.sku].trucks[truckPlate] = item.quantity;
        });
    });

    // Asegurarse de que todos los SKUs del inventario principal tengan entradas para todos los camiones (con 0 si no están)
    _vehicles.forEach(vehicle => {
        Object.keys(_resetQuantities).forEach(sku => {
            if (_resetQuantities[sku].trucks[vehicle.plate] === undefined) {
                _resetQuantities[sku].trucks[vehicle.plate] = 0;
            }
        });
    });

    console.log('[Reset Cargas] Datos cargados para edición:', _resetQuantities);
};

// Pantalla de edición de inventarios para Reset Cargas Iniciales
export const renderResetCargasInicialesEditScreen = () => {
    if (!_isAdmin()) {
        _showMessageModal('Acceso denegado: Solo los administradores pueden acceder a esta función.');
        _setScreenAndRender('main');
        return;
    }

    const editScreenDiv = document.createElement('div');
    editScreenDiv.className = 'screen-container bg-white rounded-xl m-2 shadow-md';

    let tableHeaders = `
        <th>SKU</th>
        <th>Producto</th>
        <th>Principal</th>
    `;
    _vehicles.forEach(v => {
        tableHeaders += `<th>${v.plate}</th>`;
    });

    let tableRows = '';
    // Ordenar SKUs para una visualización consistente
    const sortedSKUs = Object.keys(_resetQuantities).sort();

    sortedSKUs.forEach(sku => {
        const productDetails = _inventory.find(item => item.sku === sku) || { producto: 'Desconocido', presentacion: '' };
        tableRows += `
            <tr>
                <td>${sku}</td>
                <td>${productDetails.producto}</td>
                <td><input type="number" class="border border-gray-300 rounded-md text-center w-20" value="${_resetQuantities[sku].main}" onchange="receivingModule.handleResetQuantityChange('${sku}', 'main', this.value)" min="0"></td>
        `;
        _vehicles.forEach(v => {
            const truckQty = _resetQuantities[sku].trucks[v.plate] !== undefined ? _resetQuantities[sku].trucks[v.plate] : 0;
            tableRows += `<td><input type="number" class="border border-gray-300 rounded-md text-center w-20" value="${truckQty}" onchange="receivingModule.handleResetQuantityChange('${sku}', '${v.plate}', this.value)" min="0"></td>`;
        });
        tableRows += `</tr>`;
    });

    editScreenDiv.innerHTML = `
        <h2 class="text-2xl font-bold mb-5 text-center text-red-700">RESET DE CARGAS INICIALES</h2>
        <p class="text-base text-center my-5 text-gray-600">
            Modifica las cantidades del inventario principal y de cada camión.
            Asegúrate de que la suma de las cantidades de un SKU en todos los camiones no exceda la cantidad en el inventario principal.
        </p>
        <div class="table-container mb-5">
            <table class="w-full text-sm">
                <thead>
                    <tr>
                        ${tableHeaders}
                    </tr>
                </thead>
                <tbody id="reset-inventories-body">
                    ${tableRows}
                </tbody>
            </table>
        </div>
        <button class="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-5 rounded-lg mt-5 w-full shadow-md transition duration-300 ease-in-out transform hover:scale-105" onclick="receivingModule.saveResetCargasIniciales()">Guardar Cambios de Inventario</button>
        <button class="bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-5 rounded-lg mt-3 w-full shadow-md transition duration-300 ease-in-out transform hover:scale-105" onclick="receivingModule.renderCargaSelectionScreen()">Cancelar y Volver</button>
    `;
    document.getElementById('app-root').appendChild(editScreenDiv);
};

// Manejador de cambio de cantidad para el reset de inventarios
export const handleResetQuantityChange = (sku, type, value) => {
    const parsedValue = parseInt(value) || 0;
    if (type === 'main') {
        _resetQuantities[sku].main = parsedValue;
    } else {
        _resetQuantities[sku].trucks[type] = parsedValue;
    }
};

// Lógica para guardar los cambios de Reset Cargas Iniciales
export const saveResetCargasIniciales = async () => {
    if (!_isAdmin()) {
        _showMessageModal('Acceso denegado: Solo los administradores pueden guardar cambios en esta función.');
        return;
    }

    let validationErrors = [];
    let updatedMainInventory = [];
    let updatedTruckInventories = {}; // { 'plate': [{item}, {item}] }

    // Inicializar updatedTruckInventories para todos los camiones
    _vehicles.forEach(v => {
        updatedTruckInventories[v.plate] = [];
    });

    // Procesar cada SKU y realizar la validación de coherencia
    for (const sku of Object.keys(_resetQuantities)) {
        const mainQty = _resetQuantities[sku].main;
        let totalTruckQty = 0;

        // Calcular la suma de cantidades en camiones para este SKU
        for (const truckPlate in _resetQuantities[sku].trucks) {
            totalTruckQty += _resetQuantities[sku].trucks[truckPlate];
        }

        // Validar coherencia: suma de camiones no puede ser mayor que el principal
        if (totalTruckQty > mainQty) {
            validationErrors.push(`Error de coherencia para SKU ${sku}: La suma de cantidades en camiones (${totalTruckQty}) excede la cantidad en el inventario principal (${mainQty}).`);
        }

        // Preparar datos para el inventario principal
        const originalItemDetails = _inventory.find(item => item.sku === sku);
        if (originalItemDetails) {
            updatedMainInventory.push({ ...originalItemDetails, cantidad: mainQty });
        } else {
            console.warn(`SKU ${sku} no encontrado en el inventario principal original. Se añadirá con la cantidad especificada.`);
            updatedMainInventory.push({
                rubro: 'Desconocido',
                sku: sku,
                segmento: 'Desconocido',
                producto: `Producto ${sku}`,
                presentacion: 'Unidad',
                cantidad: mainQty,
                precio: 0
            });
        }

        // Preparar datos para los inventarios de camiones
        for (const truckPlate in _resetQuantities[sku].trucks) {
            const truckQty = _resetQuantities[sku].trucks[truckPlate];
            if (truckQty > 0) {
                // Buscar detalles completos del producto para el inventario del camión
                const productDetails = _inventory.find(item => item.sku === sku) || originalItemDetails;
                if (productDetails) {
                    updatedTruckInventories[truckPlate].push({
                        sku: productDetails.sku,
                        rubro: productDetails.rubro,
                        segmento: productDetails.segmento,
                        producto: productDetails.producto,
                        presentacion: productDetails.presentacion,
                        quantity: truckQty,
                        price: productDetails.precio
                    });
                }
            }
        }
    }

    if (validationErrors.length > 0) {
        _showMessageModal(`Errores de validación:\n${validationErrors.join('\n')}`);
        return;
    }

    try {
        const batch = _db.batch();

        // Actualizar inventario principal
        updatedMainInventory.forEach(item => {
            const itemRef = _db.collection('inventory').doc(item.sku);
            batch.set(itemRef, item);
        });

        // Actualizar inventarios de camiones
        for (const truckPlate in updatedTruckInventories) {
            const truckRef = _db.collection('truck_inventories').doc(truckPlate);
            batch.set(truckRef, { items: updatedTruckInventories[truckPlate] });
        }

        await batch.commit();

        // Actualizar el estado local después de un guardado exitoso
        await _fetchDataFromFirestore(); // Re-fetch all data to ensure consistency

        _showMessageModal('Inventarios actualizados exitosamente con las nuevas cargas iniciales.');
        _setScreenAndRender('cargaSelection');
    } catch (error) {
        console.error('Error al guardar los cambios de cargas iniciales:', error);
        _showMessageModal('Error al guardar los cambios de inventario. Revisa tu conexión y las reglas de seguridad.');
    }
};

// Pantalla de recepción de mercancía en camión
export const renderTruckReceivingScreen = async () => {
    if (!_isAdmin()) {
        _showMessageModal('Acceso denegado: Solo los administradores pueden acceder a la carga de inventario.');
        _setScreenAndRender('main');
        return;
    }

    const cargaDiv = document.createElement('div');
    cargaDiv.className = 'screen-container bg-white rounded-xl m-2 shadow-md';
    cargaDiv.innerHTML = `
        <h2 class="text-2xl font-bold mb-5 text-center text-indigo-700">RECEPCIÓN DE MERCANCÍA EN CAMIÓN</h2>

        <div class="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-300">
            <label for="truckSelectForReceiving" class="block text-lg font-semibold text-blue-700 mb-2">Seleccionar Camión que Recibe Mercancía:</label>
            <select id="truckSelectForReceiving" class="h-12 border border-gray-300 rounded-lg px-4 text-base w-full bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent" onchange="receivingModule.handleTruckSelectionForReceiving(this.value)">
                <option value="">-- Seleccione un camión --</option>
                ${_vehicles.map(v => `<option value="${v.plate}" ${_selectedTruckForReceiving && _selectedTruckForReceiving.plate === v.plate ? 'selected' : ''}>${v.name} (${v.plate})</option>`).join('')}
            </select>
        </div>

        <div class="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-300">
            <label for="loaderSelect" class="block text-lg font-semibold text-blue-700 mb-2">Seleccione quien realiza la carga:</label>
            <select id="loaderSelect" class="h-12 border border-gray-300 rounded-lg px-4 text-base w-full bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent" onchange="receivingModule.handleLoaderSelection(this.value)">
                <option value="">-- Seleccione un vendedor --</option>
                ${_vendors.map(v => `<option value="${v.name}" ${_selectedLoader === v.name ? 'selected' : ''}>${v.name}</option>`).join('')}
            </select>
        </div>

        ${_selectedTruckForReceiving && _selectedLoader ? `
            <p class="text-base text-center mb-4 text-gray-700">Ingresa las cantidades de productos que el camión <strong>${_selectedTruckForReceiving.name} (${_selectedTruckForReceiving.plate})</strong> está recibiendo de un proveedor, realizada por <strong>${_selectedLoader}</strong>.</p>
            <div class="table-container mb-5">
                <table>
                    <thead>
                        <tr>
                            <th>Rubro</th>
                            <th>Sku</th>
                            <th>Producto</th>
                            <th>Presentación</th>
                            <th>Cantidad a Recibir</th>
                        </tr>
                    </thead>
                    <tbody id="products-for-receiving-body">
                    </tbody>
                </table>
            </div>
            <button class="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-5 rounded-lg mt-5 w-full shadow-md transition duration-300 ease-in-out transform hover:scale-105" onclick="receivingModule.handleReceiveToTruckAndWarehouse()">Registrar Recepción</button>
        ` : `<p class="text-center text-gray-600">Por favor, seleccione un camión y quien realiza la carga para continuar.</p>`}

        <button class="bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-5 rounded-lg mt-3 w-full shadow-md transition duration-300 ease-in-out transform hover:scale-105" onclick="receivingModule.renderCargaSelectionScreen()">Volver</button>
    `;
    document.getElementById('app-root').appendChild(cargaDiv);

    if (_selectedTruckForReceiving && _selectedLoader) {
        const productsForReceivingBody = document.getElementById('products-for-receiving-body');
        // Mostrar todos los productos del inventario principal para poder recibir cualquier SKU
        _inventory.forEach(item => {
            const row = document.createElement('tr');
            // Aseguramos que 'receivingQuantities' tenga un valor inicial de 0 si no existe
            if (_receivingQuantities[item.sku] === undefined) {
                _receivingQuantities[item.sku] = 0;
            }
            row.innerHTML = `
                <td>${item.rubro}</td>
                <td>${item.sku}</td>
                <td>${item.producto}</td>
                <td>${item.presentacion}</td>
                <td><input type="number" class="border border-gray-300 rounded-md text-center w-20" value="${_receivingQuantities[item.sku]}" onchange="receivingModule.handleReceivingQuantityChange('${item.sku}', this.value)" min="0"></td>
            `;
            productsForReceivingBody.appendChild(row);
        });
    }
};

// Manejador de selección de camión para la recepción de mercancía
export const handleTruckSelectionForReceiving = async (plate) => {
    if (!plate) {
        _selectedTruckForReceiving = null;
        _selectedTruckInventoryForReceiving = [];
        _receivingQuantities = {};
        _setScreenAndRender('truckLoading'); // Re-renderizar la pantalla de carga para actualizar la UI
        return;
    }

    _selectedTruckForReceiving = _vehicles.find(v => v.plate === plate);
    _receivingQuantities = {}; // Reiniciar cantidades de recepción al seleccionar un nuevo camión

    if (_selectedTruckForReceiving) {
        try {
            const truckInventoryDoc = await _db.collection('truck_inventories').doc(plate).get();
            if (truckInventoryDoc.exists) {
                _selectedTruckInventoryForReceiving = truckInventoryDoc.data().items || [];
            } else {
                console.warn(`[Firestore] No se encontró inventario para el camión ${plate}. Creando uno vacío.`);
                await _db.collection('truck_inventories').doc(plate).set({ items: [] });
                _selectedTruckInventoryForReceiving = [];
            }
        } catch (error) {
            console.error('Error al cargar inventario del camión para recepción:', error);
            _showMessageModal('Error al cargar el inventario del camión. Intenta de nuevo.');
            _selectedTruckInventoryForReceiving = [];
        }
    } else {
        _selectedTruckInventoryForReceiving = [];
    }
    _setScreenAndRender('truckLoading'); // Re-renderizar la pantalla de carga para actualizar la UI
};

// Manejador de selección de quien realiza la carga
export const handleLoaderSelection = (loaderName) => {
    _selectedLoader = loaderName || null;
    _receivingQuantities = {}; // Reiniciar cantidades de recepción al cambiar el cargador
    _setScreenAndRender('truckLoading'); // Re-renderizar la pantalla de carga para actualizar la UI
};

// Manejador de cambio de cantidad para la recepción de mercancía
export const handleReceivingQuantityChange = (sku, quantity) => {
    _receivingQuantities[sku] = parseInt(quantity) || 0;
};

// Lógica para registrar la recepción de mercancía en camión y actualizar el almacén
export const handleReceiveToTruckAndWarehouse = async () => {
    if (!_isAdmin()) {
        _showMessageModal('Acceso denegado: Solo los administradores pueden registrar la recepción de mercancía.');
        return;
    }
    if (!_selectedTruckForReceiving || !_selectedLoader) {
        _showMessageModal('Por favor, selecciona un camión y quien realiza la carga primero.');
        return;
    }

    let messages = [];
    let hasPositiveReceivingQuantity = false;
    let itemsToUpdateInWarehouse = JSON.parse(JSON.stringify(_inventory)); // Copia del inventario principal
    let itemsToUpdateInTruck = JSON.parse(JSON.stringify(_selectedTruckInventoryForReceiving)); // Copia del inventario del camión
    let loadData = []; // Para el archivo CSV de la carga

    for (const sku in _receivingQuantities) {
        const quantityToReceive = _receivingQuantities[sku];
        if (quantityToReceive <= 0) continue;

        hasPositiveReceivingQuantity = true;

        // Encontrar el item en el inventario principal para obtener sus propiedades
        const originalItemDetails = _inventory.find(item => item.sku === sku);

        if (!originalItemDetails) {
            messages.push(`Advertencia: Producto con SKU ${sku} no encontrado en el inventario principal. No se pudo procesar completamente.`);
            continue;
        }

        // Actualizar inventario del almacén principal
        let warehouseItem = itemsToUpdateInWarehouse.find(item => item.sku === sku);
        if (warehouseItem) {
            warehouseItem.cantidad += quantityToReceive;
        } else {
            // Si el producto no existe en el inventario principal, añadirlo
            itemsToUpdateInWarehouse.push({
                ...originalItemDetails,
                cantidad: quantityToReceive
            });
        }

        // Actualizar inventario del camión
        let truckItem = itemsToUpdateInTruck.find(item => item.sku === sku);
        if (truckItem) {
            truckItem.quantity += quantityToReceive;
        } else {
            // Si el producto no existe en el camión, añadirlo
            itemsToUpdateInTruck.push({
                sku: originalItemDetails.sku,
                rubro: originalItemDetails.rubro,
                segmento: originalItemDetails.segmento,
                producto: originalItemDetails.producto,
                presentacion: originalItemDetails.presentacion,
                quantity: quantityToReceive,
                price: originalItemDetails.precio
            });
        }

        // Añadir al registro de carga para el CSV
        loadData.push({
            sku: originalItemDetails.sku,
            producto: originalItemDetails.producto,
            presentacion: originalItemDetails.presentacion,
            cantidadCargada: quantityToReceive,
            precioUnitario: originalItemDetails.precio,
            subtotal: quantityToReceive * originalItemDetails.precio
        });
    }

    if (!hasPositiveReceivingQuantity) {
        _showMessageModal('Por favor, ingresa al menos una cantidad positiva para registrar la recepción.');
        return;
    }

    // Generar CSV de la carga
    const loadTotalAmount = loadData.reduce((sum, item) => sum + item.subtotal, 0);
    const loadFileName = `carga_${_selectedLoader.replace(/\s/g, '_')}_${_selectedTruckForReceiving.plate}_${_getCurrentDateFormatted()}.csv`;
    const loadCSVContent = `SKU,Producto,Presentacion,Cantidad Cargada,Precio Unitario,Subtotal\n` +
                           loadData.map(item => `${item.sku},${item.producto},${item.presentacion},${item.cantidadCargada},${item.precioUnitario.toFixed(2)},${item.subtotal.toFixed(2)}`).join('\n') +
                           `\nTotal General:, , , , ,${loadTotalAmount.toFixed(2)}`;

    const loadRecord = {
        fileName: loadFileName,
        date: _getCurrentDateFormatted(),
        truckPlate: _selectedTruckForReceiving.plate,
        truckName: _selectedTruckForReceiving.name,
        loader: _selectedLoader,
        items: loadData,
        total: loadTotalAmount,
        rawCSV: loadCSVContent
    };

    try {
        // Usar un batch para actualizaciones atómicas
        const batch = _db.batch();

        // Actualizar inventario del almacén en Firestore
        for (const item of itemsToUpdateInWarehouse) {
            const itemRef = _db.collection('inventory').doc(item.sku);
            batch.set(itemRef, item);
        }
        // No se actualiza _inventory aquí directamente, se hará con _fetchDataFromFirestore

        // Actualizar inventario del camión en Firestore
        const truckInventoryRef = _db.collection('truck_inventories').doc(_selectedTruckForReceiving.plate);
        batch.set(truckInventoryRef, { items: itemsToUpdateInTruck });
        // No se actualiza _selectedTruckInventoryForReceiving aquí directamente

        // Guardar el registro de carga en Firestore
        const docRef = await _db.collection('loadRecords').add(loadRecord);
        loadRecord.docId = docRef.id;
        // No se actualiza _loadRecords aquí directamente

        await batch.commit(); // Confirmar todas las operaciones del batch

        // Re-fetch all data to ensure consistency across the application
        await _fetchDataFromFirestore();

        _showMessageModal('Recepción de mercancía registrada exitosamente. Inventarios actualizados y archivo de carga generado.');
        _downloadCSV(loadFileName, loadCSVContent); // Descargar el archivo CSV
        _receivingQuantities = {}; // Limpiar cantidades de recepción
        _selectedTruckForReceiving = null; // Limpiar selección de camión
        _selectedLoader = null; // Limpiar selección de cargador
        _setScreenAndRender('cargaSelection'); // Re-renderizar para mostrar los cambios
    } catch (error) {
        console.error('Error al registrar la recepción de mercancía o guardar registro de carga:', error);
        _showMessageModal('Error al registrar la recepción de mercancía. Revisa tu conexión y reglas de seguridad.');
    }
};

// Pantalla de Historial de Cargas (con botón Limpiar Historial)
export const renderLoadHistoryScreen = () => {
    if (!_isAdmin()) {
        _showMessageModal('Acceso denegado: Solo los administradores pueden ver el historial de cargas.');
        _setScreenAndRender('main');
        return;
    }

    const loadHistoryDiv = document.createElement('div');
    loadHistoryDiv.className = 'screen-container bg-white rounded-xl m-2 shadow-md';
    loadHistoryDiv.innerHTML = `
        <h2 class="text-2xl font-bold mb-5 text-center text-indigo-700">HISTORIAL DE CARGAS</h2>
        <p class="text-base text-center my-5 text-gray-600">
            Aquí puedes ver y descargar los archivos de cargas generados.
        </p>

        <div class="p-4 bg-yellow-50 rounded-lg border border-yellow-300">
            <h3 class="text-xl font-bold mb-4 text-yellow-700">Archivos de Carga Generados</h3>
            <div id="generated-load-files-list"></div>
        </div>

        <button class="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-5 rounded-lg mt-5 w-full shadow-md transition duration-300 ease-in-out transform hover:scale-105" onclick="receivingModule.showClearLoadHistoryConfirmation()">Limpiar Historial</button>
        <button class="bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-5 rounded-lg mt-3 w-full shadow-md transition duration-300 ease-in-out transform hover:scale-105" onclick="receivingModule.renderCargaSelectionScreen()">Volver</button>
    `;
    document.getElementById('app-root').appendChild(loadHistoryDiv);

    const generatedLoadFilesListDiv = document.getElementById('generated-load-files-list');
    if (_loadRecords.length === 0) {
        generatedLoadFilesListDiv.innerHTML = '<p class="text-gray-600">No hay archivos de carga generados.</p>';
    } else {
        // Ordenar por fecha descendente
        const sortedLoadRecords = [..._loadRecords].sort((a, b) => {
            const dateA = parseInt(a.date.substring(4, 8) + a.date.substring(2, 4) + a.date.substring(0, 2));
            const dateB = parseInt(b.date.substring(4, 8) + b.date.substring(2, 4) + b.date.substring(0, 2));
            return dateB - dateA;
        });

        sortedLoadRecords.forEach(record => {
            const fileItemDiv = document.createElement('div');
            fileItemDiv.className = 'bg-yellow-100 p-3 rounded-lg mb-2 flex flex-wrap justify-between items-center border border-yellow-200';
            fileItemDiv.innerHTML = `
                <span class="text-base text-yellow-800 mb-2 sm:mb-0">
                    ${record.fileName} <br>
                    <span class="text-sm text-gray-600">
                        Camión: ${record.truckName} (${record.truckPlate}) - Cargador: ${record.loader} - Total: $${record.total.toFixed(2)}
                    </span>
                </span>
                <div class="flex flex-wrap gap-2">
                    <button class="bg-green-500 hover:bg-green-600 text-white font-bold py-1 px-3 rounded-md text-sm transition duration-150 ease-in-out" onclick="_downloadCSV('${record.fileName}', '${record.rawCSV.replace(/'/g, "\\'").replace(/"/g, '&quot;')}')">DESCARGAR CSV</button>
                </div>
            `;
            generatedLoadFilesListDiv.appendChild(fileItemDiv);
        });
    }
};

// Lógica para confirmar y limpiar el historial de cargas
export const showClearLoadHistoryConfirmation = () => {
    if (!_isAdmin()) {
        _showMessageModal('Acceso denegado: Solo los administradores pueden limpiar el historial de cargas.');
        return;
    }
    _showConfirmationModal('Confirma desea borrar el Historial de Cargas', clearLoadHistoryLogic);
};

// Lógica para borrar el historial de cargas
const clearLoadHistoryLogic = async () => {
    if (!_isAdmin()) {
        _showMessageModal('Acceso denegado: Solo los administradores pueden limpiar el historial de cargas.');
        return;
    }
    try {
        const batch = _db.batch();
        const loadRecordsSnapshot = await _db.collection('loadRecords').get();
        loadRecordsSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        // Después de la operación, re-fetch para actualizar el estado global
        await _fetchDataFromFirestore();
        _showMessageModal('Historial de cargas borrado exitosamente.');
        _setScreenAndRender('cargaSelection'); // Re-renderizar la pantalla
    } catch (error) {
        console.error('Error al limpiar el historial de cargas:', error);
        _showMessageModal('Error al limpiar el historial de cargas. Revisa tu conexión y reglas de seguridad.');
    }
};
