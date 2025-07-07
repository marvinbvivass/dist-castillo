// transferModule.js

// Variables que se inyectarán desde el módulo principal (index.html)
let _isUser;
let _isAdmin;
let _currentUserData;
let _vehicles;
let _inventory;
let _currentTruckInventory;
let _transferRecords;
let _users; // Necesario para mostrar el email del usuario en el historial de transbordos del admin
let _productImages;
let _db;
let _showMessageModal;
let _showConfirmationModal;
let _setScreenAndRender;
let _getCurrentDateFormatted;
let _downloadCSV;
let _fetchDataFromFirestore; // Necesario para re-fetch después de transbordo/limpieza
let _auth; // Necesario para la re-autenticación

// Estado local del módulo de transbordo
let _selectedDestinationTruck = null;
let _transferQuantities = {};

export const initTransferModule = (dependencies) => {
    _isUser = dependencies.isUser;
    _isAdmin = dependencies.isAdmin;
    _currentUserData = dependencies.currentUserData;
    _vehicles = dependencies.vehicles;
    _inventory = dependencies.inventory;
    _currentTruckInventory = dependencies.currentTruckInventory;
    _transferRecords = dependencies.transferRecords;
    _users = dependencies.users;
    _productImages = dependencies.productImages;
    _db = dependencies.db;
    _showMessageModal = dependencies.showMessageModal;
    _showConfirmationModal = dependencies.showConfirmationModal;
    _setScreenAndRender = dependencies.setScreenAndRender;
    _getCurrentDateFormatted = dependencies.getCurrentDateFormatted;
    _downloadCSV = dependencies.downloadCSV;
    _fetchDataFromFirestore = dependencies.fetchDataFromFirestore;
    _auth = dependencies.auth;

    // Inicializar estados locales si se pasan como dependencias o se necesitan valores iniciales
    _selectedDestinationTruck = dependencies.selectedDestinationTruck || null;
    _transferQuantities = dependencies.transferQuantities || {};
};

// Pantalla de solicitud de contraseña para Transbordo Inv.
export const renderTransferInventoryPasswordScreen = () => {
    if (!_isUser()) { // Solo usuarios pueden hacer transbordo
        _showMessageModal('Acceso denegado: Solo los usuarios pueden realizar transbordo de inventario.');
        _setScreenAndRender('main');
        return;
    }
    if (!_currentUserData.assignedTruckPlate) {
         _showMessageModal('No tienes un camión asignado para realizar transbordos. Contacta a un administrador.');
         _setScreenAndRender('main');
         return;
    }

    const passwordScreenDiv = document.createElement('div');
    passwordScreenDiv.className = 'screen-container bg-white rounded-xl shadow-md p-8 max-w-md mx-auto my-10';
    passwordScreenDiv.innerHTML = `
        <h2 class="text-2xl font-bold mb-6 text-center text-indigo-700">Confirmación de Seguridad</h2>
        <p class="text-lg text-center mb-6 text-gray-700">Ingrese contraseña para confirmar la operación de transbordo.</p>
        <input type="password" id="userPasswordForTransfer" class="h-12 border border-gray-300 rounded-lg px-4 mb-4 text-base w-full bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent" placeholder="Contraseña">
        <button class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-5 rounded-lg w-full shadow-md transition duration-300 ease-in-out transform hover:scale-105" onclick="transferModule.handleTransferInventoryPassword()">Continuar</button>
        <button class="bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-5 rounded-lg mt-3 w-full shadow-md transition duration-300 ease-in-out transform hover:scale-105" onclick="_setScreenAndRender('main')">Cancelar</button>
    `;
    document.getElementById('app-root').appendChild(passwordScreenDiv);
};

// Lógica para verificar la contraseña del usuario para Transbordo
export const handleTransferInventoryPassword = async () => {
    const password = document.getElementById('userPasswordForTransfer').value;

    if (!password) {
        _showMessageModal('Por favor, ingresa tu contraseña.');
        return;
    }

    try {
        const credential = _auth.EmailAuthProvider.credential(_auth.currentUser.email, password);
        await _auth.currentUser.reauthenticateWithCredential(credential);

        // Si la re-autenticación es exitosa, pasar a la pantalla de transbordo
        _selectedDestinationTruck = null; // Reiniciar selección de destino
        _transferQuantities = {}; // Reiniciar cantidades de transbordo
        _setScreenAndRender('transferInventory');

    } catch (error) {
        _showMessageModal(`Error de autenticación: ${error.message}. Contraseña incorrecta o sesión expirada.`);
        console.error("Error de re-autenticación para transbordo:", error);
    }
};

// Pantalla principal de Transbordo de Inventario
export const renderTransferInventoryScreen = () => {
    if (!_isUser() || !_currentUserData.assignedTruckPlate) {
        _showMessageModal('Acceso denegado o no tienes un camión asignado.');
        _setScreenAndRender('main');
        return;
    }

    const sourceTruck = _vehicles.find(v => v.plate === _currentUserData.assignedTruckPlate);
    if (!sourceTruck) {
        _showMessageModal('No se encontró información para tu camión asignado.');
        _setScreenAndRender('main');
        return;
    }

    const destinationTrucks = _vehicles.filter(v => v.plate !== sourceTruck.plate);

    const transferDiv = document.createElement('div');
    transferDiv.className = 'screen-container bg-white rounded-xl m-2 shadow-md';
    transferDiv.innerHTML = `
        <h2 class="text-2xl font-bold mb-5 text-center text-indigo-700">TRANSBORDO DE INVENTARIO</h2>
        <p class="text-lg text-center mb-4 text-gray-700">Camión de Origen: <strong>${sourceTruck.name} (${sourceTruck.plate})</strong></p>

        <div class="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-300">
            <label for="destinationTruckSelect" class="block text-lg font-semibold text-blue-700 mb-2">Seleccionar Camión de Destino:</label>
            <select id="destinationTruckSelect" class="h-12 border border-gray-300 rounded-lg px-4 text-base w-full bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent" onchange="transferModule.handleDestinationTruckSelection(this.value)">
                <option value="">-- Seleccione un camión --</option>
                ${destinationTrucks.map(v => `<option value="${v.plate}" ${_selectedDestinationTruck && _selectedDestinationTruck.plate === v.plate ? 'selected' : ''}>${v.name} (${v.plate})</option>`).join('')}
            </select>
        </div>

        ${_selectedDestinationTruck ? `
            <p class="text-base text-center mb-4 text-gray-700">Cantidad a trasladar del camión <strong>${sourceTruck.name}</strong> al camión <strong>${_selectedDestinationTruck.name}</strong>.</p>
            <div class="table-container mb-5">
                <table>
                    <thead>
                        <tr>
                            <th>Imagen</th>
                            <th>SKU</th>
                            <th>Producto</th>
                            <th>Presentación</th>
                            <th>Disponible</th>
                            <th>Cantidad a Trasladar</th>
                        </tr>
                    </thead>
                    <tbody id="products-for-transfer-body">
                    </tbody>
                </table>
            </div>
            <button class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-5 rounded-lg mt-5 w-full shadow-md transition duration-300 ease-in-out transform hover:scale-105" onclick="transferModule.showTransferConfirmation()">Realizar Transbordo</button>
        ` : `<p class="text-center text-gray-600">Por favor, seleccione un camión de destino para continuar.</p>`}

        <div class="p-4 bg-yellow-50 rounded-lg border border-yellow-300 mt-8">
            <h3 class="text-xl font-bold mb-4 text-yellow-700">Historial de Traslados</h3>
            <div id="user-transfer-history-list"></div>
        </div>

        <button class="bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-5 rounded-lg mt-5 w-full shadow-md transition duration-300 ease-in-out transform hover:scale-105" onclick="_setScreenAndRender('main')">Volver</button>
    `;
    document.getElementById('app-root').appendChild(transferDiv);

    if (_selectedDestinationTruck) {
        const productsForTransferBody = document.getElementById('products-for-transfer-body');
        _currentTruckInventory.forEach(item => { // _currentTruckInventory es el inventario del camión de origen del usuario
            const row = document.createElement('tr');
            // Aseguramos que '_transferQuantities' tenga un valor inicial de 0 si no existe
            if (_transferQuantities[item.sku] === undefined) {
                _transferQuantities[item.sku] = 0;
            }
            row.innerHTML = `
                <td><img src="${_productImages[item.sku] || _productImages['default']}" alt="Imagen de ${item.producto}" class="w-12 h-12 rounded-md object-cover"></td>
                <td>${item.sku}</td>
                <td>${item.producto}</td>
                <td>${item.presentacion}</td>
                <td>${item.quantity}</td>
                <td><input type="number" class="border border-gray-300 rounded-md text-center w-20" value="${_transferQuantities[item.sku]}" onchange="transferModule.handleTransferQuantityChange('${item.sku}', this.value)" min="0" max="${item.quantity}"></td>
            `;
            productsForTransferBody.appendChild(row);
        });
    }
    updateUserTransferHistoryDisplay();
};

// Manejador de selección de camión de destino
export const handleDestinationTruckSelection = (plate) => {
    if (!plate) {
        _selectedDestinationTruck = null;
    } else {
        _selectedDestinationTruck = _vehicles.find(v => v.plate === plate);
    }
    _transferQuantities = {}; // Reiniciar cantidades al cambiar el destino
    _setScreenAndRender('transferInventory'); // Re-renderizar para actualizar la UI
};

// Manejador de cambio de cantidad a trasladar
export const handleTransferQuantityChange = (sku, quantity) => {
    _transferQuantities[sku] = parseInt(quantity) || 0;
};

// Confirmación antes de realizar el transbordo
export const showTransferConfirmation = () => {
    _showConfirmationModal('¿Estás seguro de que quieres realizar este transbordo de inventario? Esto modificará los inventarios de ambos camiones.', performInventoryTransfer);
};

// Lógica para realizar el transbordo de inventario
export const performInventoryTransfer = async () => {
    if (!_isUser() || !_currentUserData.assignedTruckPlate || !_selectedDestinationTruck) {
        _showMessageModal('Error: No se puede realizar el transbordo. Asegúrate de tener un camión asignado y un camión de destino seleccionado.');
        return;
    }

    const sourceTruckPlate = _currentUserData.assignedTruckPlate;
    const destinationTruckPlate = _selectedDestinationTruck.plate;

    let transferData = [];
    let messages = [];
    let hasPositiveTransferQuantity = false;

    // Obtener copias de los inventarios de origen y destino
    let sourceTruckInventoryCopy = JSON.parse(JSON.stringify(_currentTruckInventory));
    let destinationTruckInventoryCopy = [];
    try {
        const destTruckDoc = await _db.collection('truck_inventories').doc(destinationTruckPlate).get();
        destinationTruckInventoryCopy = destTruckDoc.exists ? (destTruckDoc.data().items || []) : [];
    } catch (error) {
        console.error('Error al cargar inventario del camión de destino:', error);
        _showMessageModal('Error al cargar el inventario del camión de destino. Intenta de nuevo.');
        return;
    }

    for (const sku in _transferQuantities) {
        const quantityToTransfer = _transferQuantities[sku];
        if (quantityToTransfer <= 0) continue;

        hasPositiveTransferQuantity = true;

        const sourceItemIndex = sourceTruckInventoryCopy.findIndex(item => item.sku === sku);
        const sourceItem = sourceItemIndex !== -1 ? sourceTruckInventoryCopy[sourceItemIndex] : null;

        if (!sourceItem || quantityToTransfer > sourceItem.quantity) {
            messages.push(`Error: Cantidad insuficiente para SKU "${sku}" en el camión de origen. Disponible: ${sourceItem ? sourceItem.quantity : 0}, Intentado trasladar: ${quantityToTransfer}.`);
            continue;
        }

        // Deduce del camión de origen
        sourceTruckInventoryCopy[sourceItemIndex].quantity -= quantityToTransfer;

        // Añade al camión de destino
        const destItemIndex = destinationTruckInventoryCopy.findIndex(item => item.sku === sku);
        if (destItemIndex !== -1) {
            destinationTruckInventoryCopy[destItemIndex].quantity += quantityToTransfer;
        } else {
            // Si el producto no existe en el camión de destino, añadirlo
            const productDetails = _inventory.find(item => item.sku === sku); // Obtener detalles completos del producto
            if (productDetails) {
                destinationTruckInventoryCopy.push({
                    sku: productDetails.sku,
                    rubro: productDetails.rubro,
                    segmento: productDetails.segmento,
                    producto: productDetails.producto,
                    presentacion: productDetails.presentacion,
                    quantity: quantityToTransfer,
                    price: productDetails.precio
                });
            } else {
                messages.push(`Advertencia: Producto con SKU ${sku} no encontrado en el inventario principal. No se pudo añadir completamente al camión de destino.`);
            }
        }

        // Registrar para el CSV de traslado
        transferData.push({
            sku: sku,
            producto: sourceItem.producto,
            presentacion: sourceItem.presentacion,
            cantidadTrasladada: quantityToTransfer,
            camionOrigen: sourceTruckPlate,
            camionDestino: destinationTruckPlate
        });
    }

    if (messages.length > 0) {
        _showMessageModal(messages.join('\n'));
        return;
    }
    if (!hasPositiveTransferQuantity) {
        _showMessageModal('Por favor, ingresa al menos una cantidad positiva para realizar el transbordo.');
        return;
    }

    // Generar CSV del traslado
    const transferFileName = `traslado_${sourceTruckPlate}_${destinationTruckPlate}_${_getCurrentDateFormatted()}.csv`;
    const transferCSVContent = `SKU,Producto,Presentacion,Cantidad Trasladada,Camion Origen,Camion Destino\n` +
                               transferData.map(item => `${item.sku},${item.producto},${item.presentacion},${item.cantidadTrasladada},${item.camionOrigen},${item.camionDestino}`).join('\n');

    const transferRecord = {
        fileName: transferFileName,
        date: _getCurrentDateFormatted(),
        sourceTruckPlate: sourceTruckPlate,
        destinationTruckPlate: destinationTruckPlate,
        userId: _auth.currentUser.uid, // Guardar quién realizó el transbordo
        items: transferData,
        rawCSV: transferCSVContent
    };

    try {
        const batch = _db.batch();

        // Actualizar inventario del camión de origen
        const sourceTruckRef = _db.collection('truck_inventories').doc(sourceTruckPlate);
        batch.set(sourceTruckRef, { items: sourceTruckInventoryCopy });

        // Actualizar inventario del camión de destino
        const destinationTruckRef = _db.collection('truck_inventories').doc(destinationTruckPlate);
        batch.set(destinationTruckRef, { items: destinationTruckInventoryCopy });

        // Guardar el registro de transbordo
        const docRef = await _db.collection('transferRecords').add(transferRecord);
        transferRecord.docId = docRef.id; // Asignar el ID del documento para futuras referencias

        await batch.commit();

        // Actualizar el estado global después de un guardado exitoso
        await _fetchDataFromFirestore(); // Re-fetch all data to ensure consistency

        _showMessageModal('Transbordo de inventario realizado exitosamente. Archivo generado.');
        _downloadCSV(transferFileName, transferCSVContent);
        _selectedDestinationTruck = null; // Limpiar selección de destino
        _transferQuantities = {}; // Limpiar cantidades de transbordo
        _setScreenAndRender('transferInventory'); // Re-renderizar para mostrar los cambios y el historial
    } catch (error) {
        console.error('Error al realizar transbordo de inventario:', error);
        _showMessageModal('Error al realizar transbordo. Revisa tu conexión y reglas de seguridad.');
    }
};

// Función para actualizar la lista de historial de traslados del usuario
export const updateUserTransferHistoryDisplay = () => {
    const userTransferHistoryListDiv = document.getElementById('user-transfer-history-list');
    if (!userTransferHistoryListDiv) return;

    const userSpecificTransferRecords = _transferRecords.filter(record => record.userId === _auth.currentUser.uid);

    if (userSpecificTransferRecords.length === 0) {
        userTransferHistoryListDiv.innerHTML = '<p class="text-gray-600">No hay traslados registrados para tu usuario.</p>';
    } else {
        // Ordenar por fecha descendente
        const sortedUserTransferRecords = [...userSpecificTransferRecords].sort((a, b) => {
            const dateA = parseInt(a.date.substring(4, 8) + a.date.substring(2, 4) + a.date.substring(0, 2));
            const dateB = parseInt(b.date.substring(4, 8) + b.date.substring(2, 4) + b.date.substring(0, 2));
            return dateB - dateA;
        });

        userTransferHistoryListDiv.innerHTML = ''; // Limpiar antes de añadir
        sortedUserTransferRecords.forEach(record => {
            const fileItemDiv = document.createElement('div');
            fileItemDiv.className = 'bg-yellow-100 p-3 rounded-lg mb-2 flex flex-wrap justify-between items-center border border-yellow-200';
            fileItemDiv.innerHTML = `
                <span class="text-base text-yellow-800 mb-2 sm:mb-0">
                    ${record.fileName} <br>
                    <span class="text-sm text-gray-600">
                        Origen: ${record.sourceTruckPlate} - Destino: ${record.destinationTruckPlate} - Fecha: ${record.date}
                    </span>
                </span>
                <div class="flex flex-wrap gap-2">
                    <button class="bg-green-500 hover:bg-green-600 text-white font-bold py-1 px-3 rounded-md text-sm transition duration-150 ease-in-out" onclick="_downloadCSV('${record.fileName}', '${record.rawCSV.replace(/'/g, "\\'").replace(/"/g, '&quot;')}')">DESCARGAR CSV</button>
                </div>
            `;
            userTransferHistoryListDiv.appendChild(fileItemDiv);
        });
    }
};

// Pantalla de Historial de Transbordo para Administradores
export const renderAdminTransferHistoryScreen = () => {
    if (!_isAdmin()) {
        _showMessageModal('Acceso denegado: Solo los administradores pueden ver el historial de transbordos.');
        _setScreenAndRender('main');
        return;
    }

    const adminTransferHistoryDiv = document.createElement('div');
    adminTransferHistoryDiv.className = 'screen-container bg-white rounded-xl m-2 shadow-md';
    adminTransferHistoryDiv.innerHTML = `
        <h2 class="text-2xl font-bold mb-5 text-center text-indigo-700">HISTORIAL DE TRANSBORDOS</h2>
        <p class="text-base text-center my-5 text-gray-600">
            Aquí puedes ver y descargar todos los archivos de transbordo generados.
        </p>

        <div class="p-4 bg-yellow-50 rounded-lg border border-yellow-300">
            <h3 class="text-xl font-bold mb-4 text-yellow-700">Archivos de Transbordo Generados</h3>
            <div id="admin-transfer-history-list"></div>
        </div>

        <button class="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-5 rounded-lg mt-5 w-full shadow-md transition duration-300 ease-in-out transform hover:scale-105" onclick="transferModule.showClearTransferHistoryConfirmation()">Limpiar Historial de Transbordo</button>
        <button class="bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-5 rounded-lg mt-3 w-full shadow-md transition duration-300 ease-in-out transform hover:scale-105" onclick="_setScreenAndRender('main')">Volver</button>
    `;
    document.getElementById('app-root').appendChild(adminTransferHistoryDiv);

    const adminTransferHistoryListDiv = document.getElementById('admin-transfer-history-list');
    if (_transferRecords.length === 0) {
        adminTransferHistoryListDiv.innerHTML = '<p class="text-gray-600">No hay archivos de transbordo generados.</p>';
    } else {
        // Ordenar por fecha descendente
        const sortedTransferRecords = [..._transferRecords].sort((a, b) => {
            const dateA = parseInt(a.date.substring(4, 8) + a.date.substring(2, 4) + a.date.substring(0, 2));
            const dateB = parseInt(b.date.substring(4, 8) + b.date.substring(2, 4) + b.date.substring(0, 2));
            return dateB - dateA;
        });

        adminTransferHistoryListDiv.innerHTML = ''; // Limpiar antes de añadir
        sortedTransferRecords.forEach(record => {
            const fileItemDiv = document.createElement('div');
            fileItemDiv.className = 'bg-yellow-100 p-3 rounded-lg mb-2 flex flex-wrap justify-between items-center border border-yellow-200';
            const userEmail = _users.find(u => u.uid === record.userId)?.email || 'Desconocido';
            fileItemDiv.innerHTML = `
                <span class="text-base text-yellow-800 mb-2 sm:mb-0">
                    ${record.fileName} <br>
                    <span class="text-sm text-gray-600">
                        Origen: ${record.sourceTruckPlate} - Destino: ${record.destinationTruckPlate} - Realizado por: ${userEmail} - Fecha: ${record.date}
                    </span>
                </span>
                <div class="flex flex-wrap gap-2">
                    <button class="bg-green-500 hover:bg-green-600 text-white font-bold py-1 px-3 rounded-md text-sm transition duration-150 ease-in-out" onclick="_downloadCSV('${record.fileName}', '${record.rawCSV.replace(/'/g, "\\'").replace(/"/g, '&quot;')}')">DESCARGAR CSV</button>
                </div>
            `;
            adminTransferHistoryListDiv.appendChild(fileItemDiv);
        });
    }
};

// Lógica para confirmar y limpiar el historial de transbordos (para admin)
export const showClearTransferHistoryConfirmation = () => {
    if (!_isAdmin()) {
        _showMessageModal('Acceso denegado: Solo los administradores pueden limpiar el historial de transbordos.');
        return;
    }
    _showConfirmationModal('Confirma desea borrar el Historial de Transbordos (esto afectará a todos los usuarios).', clearTransferHistoryLogic);
};

// Lógica para borrar el historial de transbordos
const clearTransferHistoryLogic = async () => {
    if (!_isAdmin()) {
        _showMessageModal('Acceso denegado: Solo los administradores pueden limpiar el historial de transbordos.');
        return;
    }
    try {
        const batch = _db.batch();
        const transferRecordsSnapshot = await _db.collection('transferRecords').get();
        transferRecordsSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        // Después de la operación, re-fetch para actualizar el estado global
        await _fetchDataFromFirestore();
        _showMessageModal('Historial de transbordos borrado exitosamente.');
        _setScreenAndRender('adminTransferHistory'); // Re-renderizar la pantalla
    } catch (error) {
        console.error('Error al limpiar el historial de transbordos:', error);
        _showMessageModal('Error al limpiar el historial de transbordos. Revisa tu conexión y reglas de seguridad.');
    }
};
