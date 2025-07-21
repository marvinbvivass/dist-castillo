// inventoryManagement.js

// --- Module-scoped variables (will be initialized via init function) ---
let _db;
let _currentUserData;
let _isAdmin;
let _isUser;
let _vehicles; // This will be the global vehicles array from index.html
let _inventory; // This will be the global inventory array from index.html
let _users; // This will be the global users array from index.html
let _vendors; // This will be the global vendors array from index.html
let _productImages; // This will be the global productImages object from index.html
let _showMessageModal;
let _showConfirmationModal;
let _createTable;
let _createInput;
let _createSelect;
let _createButton;
let _setScreenAndRender;
let _fetchDataFromFirestore; // Reference to the main data fetching function in index.html

// --- Data specific to inventory management ---
let currentTruckInventory = []; // Changed to 'let' without export directly for internal management
let loadRecords = []; // Changed to 'let' without export directly for internal management
let transferRecords = []; // Changed to 'let' without export directly for internal management

// State variables for various inventory screens
let selectedTruckForReceiving = null;
let selectedLoader = null;
let receivingQuantities = {};
let selectedTruckInventoryForReceiving = [];
let selectedAdminVehicleForInventory = null;
let resetQuantities = {};
let allTruckInventories = {};
let selectedDestinationTruck = null;
let transferQuantities = {};
let inventorySearchTermUser = '';

// Unsubscribe functions for Firestore listeners
export let truckInventoryUnsubscribe = null; // For user's assigned truck
export let adminTruckInventoryUnsubscribe = null; // For admin's selected truck

// Initial data for populating Firestore if collections are empty
const initialInventory = [
    { rubro: 'Cerveceria', sku: '2364', segmento: 'cerveza', producto: 'solera verde', presentacion: '1/4', cantidad: 180, precio: 23 },
    { rubro: 'Cerveceria', sku: '7458', segmento: 'cerveza', producto: 'ligth', presentacion: '1/4', cantidad: 180, precio: 19.8 },
    { rubro: 'Alimentos', sku: '1001', segmento: 'panaderia', producto: 'pan de molde', presentacion: 'unidad', cantidad: 50, precio: 3.5 },
    { rubro: 'Alimentos', sku: '1002', segmento: 'lacteos', producto: 'leche entera', presentacion: 'litro', cantidad: 100, precio: 2.8 },
    { rubro: 'Cerveceria', sku: '9876', segmento: 'cerveza', producto: 'polar pilsen', presentacion: 'tercio', cantidad: 200, precio: 1.5 },
];
const initialVehicles = [
    { plate: 'ABC-123', name: 'Volswaguen Worker 220', brand: 'Volswaguen', model: 'Worker 220' },
    { plate: 'DEF-456', name: 'Chevrolet FVR 300', brand: 'Chevrolet', model: 'FVR 300' },
    { plate: 'GHI-789', name: 'Chevrolet NPR 250', brand: 'Chevrolet', model: 'NPR 250' },
];

// --- Initialization function ---
export const init = (db, currentUserData, isAdmin, isUser, vehicles, inventory, users, vendors, productImages, showMessageModal, showConfirmationModal, createTable, createInput, createSelect, createButton, setScreenAndRender, fetchDataFromFirestore) => {
    _db = db;
    _currentUserData = currentUserData;
    _isAdmin = isAdmin;
    _isUser = isUser;
    _vehicles = vehicles;
    _inventory = inventory;
    _users = users;
    _vendors = vendors;
    _productImages = productImages;
    _showMessageModal = showMessageModal;
    _showConfirmationModal = showConfirmationModal;
    _createTable = createTable;
    _createInput = createInput;
    _createSelect = createSelect;
    _createButton = createButton;
    _setScreenAndRender = setScreenAndRender;
    _fetchDataFromFirestore = fetchDataFromFirestore;
    console.log('[inventoryManagement.js] Initialized with dependencies.');
};

// --- Getters and Setters for module-scoped variables ---
export const getCurrentTruckInventory = () => currentTruckInventory;
export const setCurrentTruckInventory = (newInventory) => {
    currentTruckInventory = newInventory;
    console.log('[inventoryManagement.js] currentTruckInventory updated internally.');
};

export const getLoadRecords = () => loadRecords;
export const setLoadRecords = (newRecords) => {
    loadRecords = newRecords;
    console.log('[inventoryManagement.js] loadRecords updated internally.');
};

export const getTransferRecords = () => transferRecords;
export const setTransferRecords = (newRecords) => {
    transferRecords = newRecords;
    console.log('[inventoryManagement.js] transferRecords updated internally.');
};


// --- Helper Functions (copied from index.html if specific to inventory) ---
const getCurrentDateFormatted = () => {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    return `${day}${month}${year}`;
};

const triggerCSVDownload = (filename, csvContent) => {
    if (!csvContent) {
        _showMessageModal(`No se encontró contenido para descargar el archivo: ${filename}`);
        return;
    }
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } else {
        _showMessageModal('La descarga de archivos no es compatible con este navegador.');
    }
};

const parseCSV = (csvString) => {
    const lines = csvString.split('\n').filter(line => line.trim() !== '');
    if (lines.length === 0) return [];
    const headers = lines[0].split(',').map(header => header.trim());
    return lines.slice(1).map(currentLine => {
        const data = currentLine.split(',');
        return headers.reduce((obj, header, j) => {
            obj[header] = data[j] ? data[j].trim() : '';
            return obj;
        }, {});
    });
};

const toCSV = (data, headers) => {
    if (!data || data.length === 0) return '';
    const actualHeaders = headers || Object.keys(data[0]);
    const csvRows = [actualHeaders.join(',')];
    for (const row of data) {
        const values = actualHeaders.map(header => {
            const val = row[header];
            if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
                return `"${val.replace(/"/g, '""')}"`;
            }
            return typeof val === 'number' ? val.toString() : val;
        });
        csvRows.push(values.join(','));
    }
    return csvRows.join('\n');
};

// --- Screen Rendering Functions ---

export const renderCargaSelectionScreen = () => {
    if (!_isAdmin()) { _showMessageModal('Acceso denegado: Solo los administradores pueden acceder a la sección de Carga.'); _setScreenAndRender('main'); return; }
    document.getElementById('app-root').innerHTML = `
        <div class="screen-container bg-white rounded-xl m-2 shadow-md">
            <h2 class="text-2xl font-bold mb-5 text-center text-indigo-700">SECCIÓN DE CARGA</h2>
            <p class="text-base text-center my-5 text-gray-600">Selecciona una opción para la gestión de cargas.</p>
            <div class="flex flex-wrap justify-center gap-4">
                ${_createButton('RECEPCIÓN DE MERCANCÍA EN CAMIÓN', 'truckLoadingButton', 'bg-indigo-600')}
                ${_createButton('HISTORIAL DE CARGAS', 'loadHistoryButton', 'bg-indigo-600')}
                ${_createButton('RESET CARGAS INICIALES', 'resetCargasInicialesPasswordButton', 'bg-red-600 border-red-700')}
            </div>
            ${_createButton('Volver', 'backToMainFromCargaSelection', 'bg-gray-600 mt-5 w-full')}
        </div>
    `;
};

export const renderTruckReceivingScreen = () => {
    if (!_isAdmin()) { _showMessageModal('Acceso denegado: Solo los administradores pueden acceder a esta función.'); _setScreenAndRender('main'); return; }

    const loaderOptions = _vendors.map(v => ({ value: v.name, text: v.name }));
    const vehicleOptions = _vehicles.map(v => ({ value: v.plate, text: `${v.name} (${v.plate})` }));

    document.getElementById('app-root').innerHTML = `
        <div class="screen-container bg-white rounded-xl m-2 shadow-md max-w-md mx-auto my-10">
            <h2 class="text-2xl font-bold mb-5 text-center text-indigo-700">RECEPCIÓN DE MERCANCÍA EN CAMIÓN</h2>
            <p class="text-lg text-center mb-6 text-gray-700">Selecciona un cargador y un camión, luego ingresa las cantidades a cargar.</p>

            <div class="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-300">
                <label for="loaderSelect" class="block text-lg font-semibold text-blue-700 mb-2">Seleccionar Cargador:</label>
                ${_createSelect('loaderSelect', loaderOptions, selectedLoader)}
            </div>

            <div class="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-300">
                <label for="truckSelect" class="block text-lg font-semibold text-blue-700 mb-2">Seleccionar Camión de Destino:</label>
                ${_createSelect('truckSelect', vehicleOptions, selectedTruckForReceiving?.plate)}
            </div>

            <div id="receiving-products-container">
                <p class="text-center text-gray-600 text-lg py-4">Seleccione un cargador y un camión para empezar a cargar mercancía.</p>
            </div>

            ${_createButton('Volver a Carga', 'backToCargaSelectionButton', 'bg-gray-600 mt-5 w-full')}
        </div>
    `;

    if (selectedLoader && selectedTruckForReceiving) {
        updateTruckReceivingScreenContent();
    }
};

export const handleLoaderSelection = (loaderName) => {
    selectedLoader = loaderName;
    if (selectedTruckForReceiving) {
        updateTruckReceivingScreenContent();
    }
};

export const handleTruckForReceivingSelection = async (truckPlate) => {
    selectedTruckForReceiving = truckPlate ? _vehicles.find(v => v.plate === truckPlate) : null;
    receivingQuantities = {};

    if (selectedTruckForReceiving) {
        try {
            const truckInvDoc = await _db.collection('truck_inventories').doc(selectedTruckForReceiving.plate).get();
            selectedTruckInventoryForReceiving = truckInvDoc.exists ? (truckInvDoc.data().items || []) : [];
            console.log(`[handleTruckForReceivingSelection] Inventario actual del camión ${selectedTruckForReceiving.plate}:`, selectedTruckInventoryForReceiving);
        } catch (error) {
            console.error('Error al cargar el inventario del camión seleccionado:', error);
            _showMessageModal('Error al cargar el inventario del camión. Intenta de nuevo.');
            selectedTruckInventoryForReceiving = [];
        }
    } else {
        selectedTruckInventoryForReceiving = [];
    }
    updateTruckReceivingScreenContent();
};

export const updateTruckReceivingScreenContent = () => {
    const receivingProductsContainer = document.getElementById('receiving-products-container');
    if (!receivingProductsContainer) return;

    if (!selectedLoader || !selectedTruckForReceiving) {
        receivingProductsContainer.innerHTML = `<p class="text-center text-gray-600 text-lg py-4">Seleccione un cargador y un camión para empezar a cargar mercancía.</p>`;
        return;
    }

    const inventoryToDisplay = JSON.parse(JSON.stringify(_inventory));

    const tableRows = inventoryToDisplay.map(item => {
        const currentMainQty = item.cantidad;
        const qtyToReceive = receivingQuantities[item.sku] || 0;

        return `
            <tr>
                <td><img src="${_productImages[item.sku] || _productImages['default']}" alt="Imagen de ${item.producto}" class="w-10 h-10 rounded-md object-cover"></td>
                <td>${item.sku}</td>
                <td>${item.producto}</td>
                <td>${item.presentacion}</td>
                <td>${currentMainQty}</td>
                <td><input type="number" class="border border-gray-300 rounded-md text-center w-20 receiving-quantity-input" value="${qtyToReceive}" data-sku="${item.sku}" min="0"></td>
            </tr>
        `;
    }).join('');

    receivingProductsContainer.innerHTML = `
        <h3 class="text-xl font-bold mb-4 text-emerald-700">Productos a Cargar</h3>
        ${_createTable(['Imagen', 'SKU', 'Producto', 'Presentación', 'Disponible (Principal)', 'Cantidad a Cargar'], tableRows, 'products-for-receiving-body')}
        ${_createButton('Cargar Mercancía', 'loadMerchandiseButton', 'bg-emerald-600 mt-5 w-full')}
    `;
};

export const handleReceivingQuantityChange = (sku, quantity) => {
    receivingQuantities[sku] = parseInt(quantity) || 0;
};

export const showLoadMerchandiseConfirmation = () => {
    _showConfirmationModal('¿Estás seguro de que quieres realizar esta carga de mercancía? Esto actualizará los inventarios y registrará la carga.', performLoadMerchandise);
};

export const performLoadMerchandise = async () => {
    if (!selectedLoader || !selectedTruckForReceiving) {
        _showMessageModal('Error: Por favor, selecciona un cargador y un camión antes de cargar mercancía.');
        return;
    }

    const loadData = [];
    let totalLoadAmount = 0;
    let validationErrors = [];
    let hasPositiveLoadQuantity = false;

    let updatedMainInventory = JSON.parse(JSON.stringify(_inventory));
    let updatedTruckInventory = JSON.parse(JSON.stringify(selectedTruckInventoryForReceiving));

    for (const sku in receivingQuantities) {
        const quantityToLoad = receivingQuantities[sku];
        if (quantityToLoad <= 0) continue;

        hasPositiveLoadQuantity = true;

        let mainInventoryItem = updatedMainInventory.find(item => item.sku === sku);
        let productDetailsFromInventory = _inventory.find(item => item.sku === sku);

        if (!mainInventoryItem) {
            const newProductDetails = productDetailsFromInventory || { rubro: 'Desconocido', segmento: 'Desconocido', producto: `Producto ${sku}`, presentacion: 'Unidad', precio: 0 };
            updatedMainInventory.push({ ...newProductDetails, sku: sku, cantidad: quantityToLoad });
            mainInventoryItem = updatedMainInventory.find(item => item.sku === sku);
        } else {
            mainInventoryItem.cantidad += quantityToLoad;
        }

        totalLoadAmount += quantityToLoad * (mainInventoryItem ? mainInventoryItem.precio : 0);

        const truckItemIndex = updatedTruckInventory.findIndex(item => item.sku === sku);
        if (truckItemIndex !== -1) {
            updatedTruckInventory[truckItemIndex].quantity += quantityToLoad;
        } else {
            if (productDetailsFromInventory) {
                updatedTruckInventory.push({
                    sku: productDetailsFromInventory.sku, rubro: productDetailsFromInventory.rubro, segmento: productDetailsFromInventory.segmento,
                    producto: productDetailsFromInventory.producto, presentacion: productDetailsFromInventory.presentacion,
                    quantity: quantityToLoad, price: productDetailsFromInventory.precio
                });
            } else {
                _showMessageModal(`Advertencia: Producto con SKU ${sku} no encontrado en el inventario principal. Se añadió al camión con detalles por defecto.`);
                updatedTruckInventory.push({
                    sku: sku, rubro: 'Desconocido', segmento: 'Desconocido', producto: `Producto ${sku}`, presentacion: 'Unidad', quantity: quantityToLoad, price: 0
                });
            }
        }

        loadData.push({
            sku: sku,
            producto: (mainInventoryItem ? mainInventoryItem.producto : `Producto ${sku}`),
            presentacion: (mainInventoryItem ? mainInventoryItem.presentacion : 'Unidad'),
            cantidadCargada: quantityToLoad,
            precioUnitario: (mainInventoryItem ? mainInventoryItem.precio : 0),
            subtotal: quantityToLoad * (mainInventoryItem ? mainInventoryItem.precio : 0)
        });
    }

    if (validationErrors.length > 0) {
        _showMessageModal(validationErrors.join('\n'));
        return;
    }
    if (!hasPositiveLoadQuantity) {
        _showMessageModal('Por favor, ingresa al menos una cantidad positiva para cargar.');
        return;
    }

    const fileName = `carga_${selectedTruckForReceiving.plate}_${getCurrentDateFormatted()}.csv`;
    const loadCSVContent = `SKU,Producto,Presentacion,Cantidad Cargada,Precio Unitario,Subtotal\n` +
                           loadData.map(item => `${item.sku},${item.producto},${item.presentacion},${item.cantidadCargada},${item.precioUnitario.toFixed(2)},${item.subtotal.toFixed(2)}`).join('\n') +
                           `\nTotal General:, , , , ,${totalLoadAmount.toFixed(2)}`;

    const loadRecord = {
        fileName: fileName,
        date: getCurrentDateFormatted(),
        truckPlate: selectedTruckForReceiving.plate,
        truckName: selectedTruckForReceiving.name,
        loader: selectedLoader,
        total: totalLoadAmount,
        items: loadData,
        rawCSV: loadCSVContent,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        const batch = _db.batch();

        updatedMainInventory.forEach(item => {
            batch.set(_db.collection('inventory').doc(item.sku), {
                rubro: item.rubro, sku: item.sku, segmento: item.segmento,
                producto: item.producto, presentacion: item.presentacion,
                cantidad: item.cantidad, precio: item.precio
            });
        });

        batch.set(_db.collection('truck_inventories').doc(selectedTruckForReceiving.plate), { items: updatedTruckInventory.filter(item => item.quantity > 0) });

        const loadDocRef = _db.collection('loadRecords').doc();
        batch.set(loadDocRef, loadRecord);

        await batch.commit();

        // Update the _inventory reference in this module (which is passed from index.html)
        _inventory.splice(0, _inventory.length, ...updatedMainInventory); // Update in place
        setLoadRecords([...getLoadRecords(), { docId: loadDocRef.id, ...loadRecord }]); // Use setter
        selectedTruckInventoryForReceiving = updatedTruckInventory;

        _showMessageModal('Mercancía cargada exitosamente. Archivo de carga generado.');
        triggerCSVDownload(fileName, loadCSVContent);
        
        selectedLoader = null;
        selectedTruckForReceiving = null;
        receivingQuantities = {};
        selectedTruckInventoryForReceiving = [];

        await _fetchDataFromFirestore();
        _setScreenAndRender('cargaSelection');
    } catch (error) {
        console.error('Error al realizar la carga de mercancía:', error);
        _showMessageModal('Error al cargar mercancía. Revisa tu conexión y las reglas de seguridad.');
    }
};

export const renderResetCargasInicialesPasswordScreen = () => {
    if (!_isAdmin()) { _showMessageModal('Acceso denegado: Solo los administradores pueden acceder a esta función.'); _setScreenAndRender('main'); return; }
    document.getElementById('app-root').innerHTML = `
        <div class="screen-container bg-white rounded-xl m-2 shadow-md max-w-md mx-auto my-10">
            <h2 class="text-2xl font-bold mb-5 text-center text-indigo-700">Confirmación de Seguridad</h2>
            <p class="text-lg text-center mb-6 text-gray-700">Esta función altera directamente los diversos inventarios (Principal y por vehículo) de la empresa, necesitamos confirmación si desea continuar.</p>
            ${_createInput('adminPasswordForReset', 'Contraseña de Administrador', '', 'password')}
            ${_createButton('Continuar', 'adminPasswordForResetButton', 'w-full')}
            ${_createButton('Cancelar', 'cancelResetCargasInicialesButton', 'bg-gray-600 mt-3 w-full')}
        </div>
    `;
};

export const handleResetCargasInicialesPassword = async () => {
    const password = document.getElementById('adminPasswordForReset').value;
    if (!password) { _showMessageModal('Por favor, ingresa la contraseña.'); return; }
    try {
        const credential = firebase.auth.EmailAuthProvider.credential(_currentUserData.email, password); // Use _currentUserData.email
        await firebase.auth().currentUser.reauthenticateWithCredential(credential); // Use firebase.auth().currentUser
        
        await loadAllInventoriesForReset();
        _setScreenAndRender('resetCargasInicialesEdit');
    } catch (error) {
        _showMessageModal(`Error de autenticación: ${error.message}. Contraseña incorrecta o sesión expirada.`);
    }
};

export const loadAllInventoriesForReset = async () => {
    resetQuantities = {};
    allTruckInventories = {};

    const mainInvSnapshot = await _db.collection('inventory').get();
    _inventory.splice(0, _inventory.length, ...mainInvSnapshot.docs.map(doc => ({ sku: doc.id, ...doc.data() }))); // Update in place
    _inventory.forEach(item => { resetQuantities[item.sku] = { main: item.cantidad, trucks: {} }; });

    const truckInvSnapshot = await _db.collection('truck_inventories').get();
    truckInvSnapshot.docs.forEach(doc => {
        const truckPlate = doc.id;
        const items = doc.data().items || [];
        allTruckInventories[truckPlate] = items;
        items.forEach(item => {
            if (!resetQuantities[item.sku]) {
                const productDetails = _inventory.find(invItem => invItem.sku === item.sku) || { rubro: 'Desconocido', segmento: 'Desconocido', producto: `Producto ${item.sku}`, presentacion: 'Unidad', precio: 0 };
                resetQuantities[item.sku] = { main: 0, trucks: {} };
            }
            resetQuantities[item.sku].trucks[truckPlate] = item.quantity;
        });
    });

    Object.keys(resetQuantities).forEach(sku => {
        _vehicles.forEach(vehicle => {
            if (resetQuantities[sku].trucks[vehicle.plate] === undefined) {
                resetQuantities[sku].trucks[vehicle.plate] = 0;
            }
        });
    });
    console.log('[loadAllInventoriesForReset] Initial resetQuantities:', JSON.stringify(resetQuantities));
};

export const renderResetCargasInicialesEditScreen = () => {
    if (!_isAdmin()) { _showMessageModal('Acceso denegado: Solo los administradores pueden acceder a esta función.'); _setScreenAndRender('main'); return; }

    let tableHeaders = `<th>SKU</th><th>Producto</th><th>Principal</th>`;
    _vehicles.forEach(v => { tableHeaders += `<th>${v.plate}</th>`; });

    let tableRows = Object.keys(resetQuantities).sort().map(sku => {
        const productDetails = _inventory.find(item => item.sku === sku) || { producto: 'Desconocido', presentacion: '' };
        let truckInputs = _vehicles.map(v => {
            const truckQty = resetQuantities[sku].trucks[v.plate] !== undefined ? resetQuantities[sku].trucks[v.plate] : 0;
            return `<td><input type="number" class="border border-gray-300 rounded-md text-center w-20 reset-quantity-input-truck" value="${truckQty}" data-sku="${sku}" data-truckplate="${v.plate}" min="0"></td>`;
        }).join('');
        return `
            <tr>
                <td>${sku}</td>
                <td>${productDetails.producto}</td>
                <td><input type="number" class="border border-gray-300 rounded-md text-center w-20 reset-quantity-input-main" value="${resetQuantities[sku].main}" data-sku="${sku}" min="0"></td>
                ${truckInputs}
            </tr>
        `;
    }).join('');

    document.getElementById('app-root').innerHTML = `
        <div class="screen-container bg-white rounded-xl m-2 shadow-md">
            <h2 class="text-2xl font-bold mb-5 text-center text-indigo-700">RESET DE CARGAS INICIALES</h2>
            <p class="text-base text-center my-5 text-gray-600">Modifica las cantidades del inventario principal y de cada camión. Asegúrate de que la suma de las cantidades de un SKU en todos los camiones no exceda la cantidad en el inventario principal.</p>
            ${_createTable([tableHeaders], tableRows, 'reset-inventories-body')}
            ${_createButton('Guardar Cambios de Inventario', 'saveResetCargasInicialesButton', 'bg-red-600 mt-5 w-full')}
            ${_createButton('Cancelar y Volver', 'cancelAndBackToCargaSelectionButton', 'bg-gray-600 mt-3 w-full')}
        </div>
    `;
};

export const handleResetQuantityChange = (sku, type, value) => {
    const parsedValue = parseInt(value) || 0;
    if (resetQuantities[sku]) {
        if (type === 'main') {
            resetQuantities[sku].main = parsedValue;
        } else {
            resetQuantities[sku].trucks[type] = parsedValue;
        }
    }
    console.log(`[handleResetQuantityChange] SKU: ${sku}, Type: ${type}, Value: ${parsedValue}. Current resetQuantities[${sku}]:`, resetQuantities[sku]);
};

export const saveResetCargasIniciales = async () => {
    if (!_isAdmin()) { _showMessageModal('Acceso denegado: Solo los administradores pueden guardar cambios en esta función.'); return; }
    let validationErrors = [];
    let updatedMainInventory = [];
    let truckItemsToSave = {};

    _vehicles.forEach(v => {
        truckItemsToSave[v.plate] = [];
    });

    console.log('[saveResetCargasIniciales] Starting save. Current resetQuantities:', JSON.stringify(resetQuantities));

    for (const sku of Object.keys(resetQuantities)) {
        const mainQty = resetQuantities[sku].main;
        let totalTruckQty = Object.values(resetQuantities[sku].trucks).reduce((sum, qty) => sum + qty, 0);

        if (totalTruckQty > mainQty) {
            validationErrors.push(`Error de coherencia para SKU ${sku}: La suma de cantidades en camiones (${totalTruckQty}) excede la cantidad en el inventario principal (${mainQty}).`);
        }

        const originalItemDetails = _inventory.find(item => item.sku === sku) || { rubro: 'Desconocido', segmento: 'Desconocido', producto: `Producto ${sku}`, presentacion: 'Unidad', precio: 0 };
        updatedMainInventory.push({ ...originalItemDetails, sku: sku, cantidad: mainQty });

        for (const truckPlate in resetQuantities[sku].trucks) {
            const truckQty = resetQuantities[sku].trucks[truckPlate];
            if (truckQty > 0) {
                const productDetails = _inventory.find(item => item.sku === sku) || originalItemDetails;
                if (productDetails) {
                    truckItemsToSave[truckPlate].push({
                        sku: productDetails.sku, rubro: productDetails.rubro, segmento: productDetails.segmento,
                        producto: productDetails.producto, presentacion: productDetails.presentacion,
                        quantity: truckQty, price: productDetails.precio
                    });
                }
            }
        }
    }

    if (validationErrors.length > 0) { _showMessageModal(`Errores de validación:\n${validationErrors.join('\n')}`); return; }

    console.log('[saveResetCargasIniciales] Data for main inventory (before commit):', JSON.stringify(updatedMainInventory.map(i => ({sku: i.sku, cantidad: i.cantidad}))));
    console.log('[saveResetCargasIniciales] Data for truck inventories (before commit):', JSON.stringify(truckItemsToSave));

    try {
        const batch = _db.batch();
        updatedMainInventory.forEach(item => {
            batch.set(_db.collection('inventory').doc(item.sku), {
                rubro: item.rubro, sku: item.sku, segmento: item.segmento,
                producto: item.producto, presentacion: item.presentacion,
                cantidad: item.cantidad, precio: item.precio
            });
        });

        for (const truckPlate in truckItemsToSave) {
            batch.set(_db.collection('truck_inventories').doc(truckPlate), { items: truckItemsToSave[truckPlate] });
        }

        await batch.commit();
        console.log('[saveResetCargasIniciales] Batch commit exitoso.');
        // Update the _inventory reference in this module (which is passed from index.html)
        _inventory.splice(0, _inventory.length, ...updatedMainInventory); // Update in place
        await _fetchDataFromFirestore();
        _showMessageModal('Inventarios reiniciados y guardados exitosamente.');
        _setScreenAndRender('cargaSelection');
    } catch (error) {
        console.error('Error al guardar los cambios de carga iniciales:', error);
        _showMessageModal('Error al guardar los cambios de carga iniciales. Revisa tu conexión y reglas de seguridad.');
    }
};

export const renderAdminInventorySelection = () => {
    if (!_isAdmin()) { _showMessageModal('Acceso denegado: Solo los administradores pueden acceder a esta sección de inventario.'); _setScreenAndRender('main'); return; }
    document.getElementById('app-root').innerHTML = `
        <div class="screen-container bg-white rounded-xl m-2 shadow-md">
            <h2 class="text-2xl font-bold mb-5 text-center text-indigo-700">SELECCIÓN DE INVENTARIO (ADMIN)</h2>
            <p class="text-base text-center my-5 text-gray-600">Selecciona qué inventario deseas visualizar o gestionar.</p>
            <div class="flex flex-wrap justify-center gap-4">
                ${_createButton('INVENTARIO PRINCIPAL', 'adminMainInventoryButton')}
                ${_createButton('INVENTARIO POR VEHÍCULO', 'adminVehicleInventoryButton')}
            </div>
            ${_createButton('Volver', 'backToMainFromAdminInventorySelection', 'bg-gray-600 mt-5 w-full')}
        </div>
    `;
};

export const renderAdminMainInventoryScreen = () => {
    if (!_isAdmin()) { _showMessageModal('Acceso denegado: Solo los administradores pueden ver el inventario principal.'); _setScreenAndRender('main'); return; }
    const tableRows = _inventory.map(item => `
        <td>${item.rubro}</td><td>${item.sku}</td><td>${item.producto}</td>
        <td>${item.presentacion}</td><td>${item.cantidad}</td><td>$${item.precio.toFixed(2)}</td>
    `).map(row => `<tr>${row}</tr>`).join('');

    document.getElementById('app-root').innerHTML = `
        <div class="screen-container bg-white rounded-xl m-2 shadow-md">
            <h2 class="text-2xl font-bold mb-5 text-center text-indigo-700">INVENTARIO PRINCIPAL (ALMACÉN)</h2>
            <p class="text-base text-center mb-4 text-gray-700">Mostrando inventario del almacén principal.</p>
            ${_createTable(['Rubro', 'Sku', 'Producto', 'Presentación', 'Cantidad', 'Precio'], tableRows, 'main-inventory-display-body')}
            ${_createButton('Volver', 'backToAdminInventorySelectionButton', 'bg-gray-600 mt-5 w-full')}
        </div>
    `;
};

export const renderInventarioScreen = () => {
    if (!_isUser()) { _showMessageModal('Acceso denegado: Solo los usuarios pueden acceder a esta sección de inventario.'); _setScreenAndRender('main'); return; }
    document.getElementById('app-root').innerHTML = `
        <div class="screen-container bg-white rounded-xl m-2 shadow-md">
            <h2 class="text-2xl font-bold mb-5 text-center text-indigo-700">INVENTARIO DE MI CAMIÓN</h2>
            <div class="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-300">
                <label for="inventorySearchInputUser" class="block text-lg font-semibold text-blue-700 mb-2">Buscar Producto:</label>
                ${_createInput('inventorySearchInputUser', 'Buscar por SKU, Producto o Presentación...')}
            </div>
            <div id="inventory-content"></div>
            ${_createButton('Volver', 'backToMainFromUserInventoryButton', 'bg-gray-600 mt-5 w-full')}
        </div>
    `;
    updateUserInventoryDisplayTable();
};

export const filterInventoryForUserScreen = (term) => {
    inventorySearchTermUser = term;
    updateUserInventoryDisplayTable();
};

export const updateUserInventoryDisplayTable = () => {
    const inventoryContentDiv = document.getElementById('inventory-content');
    if (!inventoryContentDiv) return;

    if (!_currentUserData.assignedTruckPlate) {
        inventoryContentDiv.innerHTML = `<p class="text-center text-red-600 text-lg py-4">Todavía no tienes un vehículo asignado.</p><p class="text-center text-gray-600 text-md">Por favor, contacta a un administrador para que te asigne uno.</p>`;
        return;
    }

    const filteredInventory = currentTruckInventory.filter(item =>
        item.sku.toLowerCase().includes(inventorySearchTermUser.toLowerCase()) ||
        item.producto.toLowerCase().includes(inventorySearchTermUser.toLowerCase()) ||
        item.presentacion.toLowerCase().includes(inventorySearchTermUser.toLowerCase())
    );

    let tableRows = '';
    if (filteredInventory.length === 0) {
        tableRows = `<td colspan="6" class="text-center text-gray-500 py-4">No se encontraron productos que coincidan con la búsqueda.</td>`;
    } else {
        tableRows = filteredInventory.map(item => `
            <td>${item.rubro}</td><td>${item.sku}</td><td>${item.producto}</td>
            <td>${item.presentacion}</td><td>${item.quantity}</td><td>$${item.price.toFixed(2)}</td>
        `).map(row => `<tr>${row}</tr>`).join('');
    }

    inventoryContentDiv.innerHTML = `
        <p class="text-base text-center mb-4 text-gray-700">Mostrando inventario de tu camión (${_currentUserData.assignedTruckPlate})</p>
        ${_createTable(['Rubro', 'Sku', 'Producto', 'Presentación', 'Cantidad', 'Precio'], tableRows, 'inventory-display-body')}
    `;
};

export const renderAdminVehicleInventoryScreen = () => {
    if (!_isAdmin()) { _showMessageModal('Acceso denegado: Solo los administradores pueden acceder a esta sección.'); _setScreenAndRender('main'); return; }

    const vehicleOptions = _vehicles.map(v => ({ value: v.plate, text: `${v.name} (${v.plate})` }));
    let displayContent = selectedAdminVehicleForInventory ? `<p class="text-center text-gray-600 text-lg py-4">Cargando inventario para ${selectedAdminVehicleForInventory.name}...</p>` : '<p class="text-center text-gray-600 text-lg py-4">Seleccione un camión para ver su inventario.</p>';

    document.getElementById('app-root').innerHTML = `
        <div class="screen-container bg-white rounded-xl m-2 shadow-md">
            <h2 class="text-2xl font-bold mb-5 text-center text-indigo-700">INVENTARIO POR VEHÍCULO (ADMIN)</h2>
            <div class="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-300">
                <label for="adminVehicleSelect" class="block text-lg font-semibold text-blue-700 mb-2">Seleccionar Camión:</label>
                ${_createSelect('adminVehicleSelect', vehicleOptions, selectedAdminVehicleForInventory?.plate)}
            </div>
            <div id="selected-vehicle-inventory-display">${displayContent}</div>
            ${_createButton('Volver', 'backToAdminInventorySelectionFromVehicleInventoryButton', 'bg-gray-600 mt-5 w-full')}
        </div>
    `;

    if (selectedAdminVehicleForInventory) {
        setupAdminTruckInventoryListener(selectedAdminVehicleForInventory.plate);
    } else {
        if (adminTruckInventoryUnsubscribe) {
            adminTruckInventoryUnsubscribe();
            adminTruckInventoryUnsubscribe = null;
            console.log('[Firestore Listener] Unsubscribed from admin truck inventory listener (no truck selected).');
        }
        document.getElementById('selected-vehicle-inventory-display').innerHTML = '<p class="text-center text-gray-600 text-lg py-4">Seleccione un camión para ver su inventario.</p>';
    }
};

export const handleAdminVehicleSelection = (plate) => {
    selectedAdminVehicleForInventory = plate ? _vehicles.find(v => v.plate === plate) : null;
    if (selectedAdminVehicleForInventory) {
        setupAdminTruckInventoryListener(plate);
    } else {
        if (adminTruckInventoryUnsubscribe) {
            adminTruckInventoryUnsubscribe();
            adminTruckInventoryUnsubscribe = null;
            console.log('[Firestore Listener] Unsubscribed from admin truck inventory listener (no truck selected).');
        }
        document.getElementById('selected-vehicle-inventory-display').innerHTML = '<p class="text-center text-gray-600 text-lg py-4">Seleccione un camión para ver su inventario.</p>';
    }
};

export const renderVehiclesScreen = () => {
    if (!_isAdmin()) { _showMessageModal('Acceso denegado: Solo los administradores pueden gestionar vehículos.'); _setScreenAndRender('main'); return; }

    // Removed editingVehicle from here, it's a local variable in this module now.
    // We need to ensure editingVehicle is properly managed (e.g., set to null when screen changes)
    // For now, assume it's correctly managed by the calling context or through event handlers.
    let editingVehicleLocal = null; // Placeholder for the actual editingVehicle state in this module.
    // If editingVehicle is passed as a dependency to init, it should be _editingVehicle.
    // For now, I'll assume it's managed by a dedicated function like `editVehicle` which sets it.

    const tableRows = _vehicles.map(vehicle => `
        <td>${vehicle.plate}</td><td>${vehicle.name}</td><td>${vehicle.brand || 'N/A'}</td><td>${vehicle.model || 'N/A'}</td>
        <td>
            ${_createButton('Editar', `editVehicle-${vehicle.plate}`, 'bg-yellow-500 text-white py-1 px-2 rounded-md text-sm mr-2 edit-vehicle-button', { plate: vehicle.plate })}
            ${_createButton('Eliminar', `deleteVehicle-${vehicle.plate}`, 'bg-red-500 text-white py-1 px-2 rounded-md text-sm delete-vehicle-button', { plate: vehicle.plate })}
        </td>
    `).map(row => `<tr>${row}</tr>`).join('');

    document.getElementById('app-root').innerHTML = `
        <div class="screen-container bg-white rounded-xl m-2 shadow-md">
            <h2 class="text-2xl font-bold mb-5 text-center text-indigo-700">VEHÍCULOS DE CARGA</h2>
            <div class="mb-8 p-4 bg-emerald-50 rounded-lg border border-emerald-300">
                <h3 class="text-xl font-bold mb-4 text-emerald-700">Lista de Vehículos</h3>
                ${_createTable(['Placa', 'Nombre', 'Marca', 'Modelo', 'Acciones'], tableRows, 'vehicles-table-body')}
            </div>
            <div class="p-4 bg-lime-50 rounded-lg border border-lime-300">
                <h3 class="text-xl font-bold mb-4 text-lime-700">${editingVehicleLocal ? 'Editar Vehículo' : 'Agregar Nuevo Vehículo'}</h3>
                ${_createInput('vehiclePlate', 'Placa', editingVehicleLocal?.plate, 'text', !!editingVehicleLocal)}
                ${_createInput('vehicleName', 'Nombre (ej. Volswaguen Worker 220)', editingVehicleLocal?.name)}
                ${_createInput('vehicleBrand', 'Marca', editingVehicleLocal?.brand)}
                ${_createInput('vehicleModel', 'Modelo', editingVehicleLocal?.model)}
                ${editingVehicleLocal ? _createButton('Guardar Cambios', 'saveEditedVehicleButton', 'bg-purple-600 mt-3 w-full') : _createButton('Agregar Vehículo', 'addVehicleButton', 'bg-purple-600 mt-3 w-full')}
                ${editingVehicleLocal ? _createButton('Cancelar Edición', 'cancelEditVehicleButton', 'bg-gray-600 mt-3 w-full') : ''}
            </div>
            ${_createButton('Volver', 'backToMainFromVehiclesButton', 'bg-gray-600 mt-5 w-full')}
        </div>
    `;
};

// Variable to hold the vehicle being edited within this module
let editingVehicle = null;

export const handleAddVehicle = async () => {
    if (!_isAdmin()) { _showMessageModal('Acceso denegado: Solo los administradores pueden agregar vehículos.'); return; }
    const plate = document.getElementById('vehiclePlate').value.trim();
    const name = document.getElementById('vehicleName').value.trim();
    const brand = document.getElementById('vehicleBrand').value.trim();
    const model = document.getElementById('vehicleModel').value.trim();

    if (!plate || !name) { _showMessageModal('La placa y el nombre del vehículo son obligatorios.'); return; }
    if (_vehicles.some(v => v.plate === plate)) { _showMessageModal('Ya existe un vehículo con esta placa.'); return; }

    const newVehicle = { plate, name, brand, model };
    try {
        await _db.collection('vehicles').doc(plate).set(newVehicle);
        await _db.collection('truck_inventories').doc(plate).set({ items: [] });
        _vehicles.push(newVehicle); // Update the shared _vehicles array
        _showMessageModal('Vehículo agregado exitosamente y su inventario de camión creado.');
        _setScreenAndRender('vehicles'); // Re-render to show updated list
    } catch (error) {
        console.error('Error al agregar vehículo:', error);
        _showMessageModal('Error al agregar vehículo. Revisa tu conexión y reglas de seguridad.');
    }
};

export const editVehicle = (plate) => {
    if (!_isAdmin()) { _showMessageModal('Acceso denegado: Solo los administradores pueden editar vehículos.'); return; }
    editingVehicle = _vehicles.find(v => v.plate === plate);
    _setScreenAndRender('vehicles');
};

export const cancelEditVehicle = () => {
    editingVehicle = null;
    _setScreenAndRender('vehicles');
};

export const saveEditedVehicle = async () => {
    if (!_isAdmin()) { _showMessageModal('Acceso denegado: Solo los administradores pueden guardar cambios en vehículos.'); return; }
    if (!editingVehicle) return;

    const name = document.getElementById('vehicleName').value.trim();
    const brand = document.getElementById('vehicleBrand').value.trim();
    const model = document.getElementById('vehicleModel').value.trim();

    if (!name) { _showMessageModal('El nombre del vehículo es obligatorio.'); return; }

    const updatedVehicle = { ...editingVehicle, name, brand, model };
    try {
        await _db.collection('vehicles').doc(updatedVehicle.plate).set(updatedVehicle);
        _vehicles = _vehicles.map(v => v.plate === updatedVehicle.plate ? updatedVehicle : v); // Update the shared _vehicles array
        _showMessageModal('Vehículo actualizado exitosamente.');
        editingVehicle = null;
        _setScreenAndRender('vehicles');
    } catch (error) {
        console.error('Error al actualizar vehículo:', error);
        _showMessageModal('Error al actualizar vehículo. Revisa tu conexión y reglas de seguridad.');
    }
};

export const showDeleteVehicleConfirmation = (plate) => {
    if (!_isAdmin()) { _showMessageModal('Acceso denegado: Solo los administradores pueden eliminar vehículos.'); return; }
    _showConfirmationModal(`¿Estás seguro de que quieres eliminar el vehículo con placa ${plate}? Esto también eliminará su inventario de camión.`, () => deleteVehicle(plate));
};

export const deleteVehicle = async (plate) => {
    if (!_isAdmin()) { _showMessageModal('Acceso denegado: Solo los administradores pueden eliminar vehículos.'); return; }
    try {
        await _db.collection('vehicles').doc(plate).delete();
        await _db.collection('truck_inventories').doc(plate).delete();
        _vehicles = _vehicles.filter(v => v.plate !== plate); // Update the shared _vehicles array
        _showMessageModal('Vehículo y su inventario de camión eliminados exitosamente.');
        _setScreenAndRender('vehicles');
    } catch (error) {
        console.error('Error al eliminar vehículo:', error);
        _showMessageModal('Error al eliminar vehículo. Revisa tu conexión y reglas de seguridad.');
    }
};

export const renderAssignVehicleScreen = () => {
    if (!_isAdmin()) { _showMessageModal('Acceso denegado: Solo los administradores pueden asignar vehículos.'); _setScreenAndRender('main'); return; }

    const vehicleOptions = _vehicles.map(v => ({ value: v.plate, text: `${v.name} (${v.plate})` }));
    const tableRows = _users.map(user => `
        <td>${user.email}</td><td>${user.role}</td><td>${user.assignedTruckPlate || 'Ninguno'}</td>
        <td>${_createSelect(`assignTruck-${user.uid}`, vehicleOptions, user.assignedTruckPlate, '', '-- No asignar --', { userid: user.uid, class: 'assign-truck-select' })}</td>
        <td>${_createButton('Guardar', `saveAssignVehicle-${user.uid}`, 'bg-indigo-500 text-sm assign-vehicle-save-button', { userid: user.uid })}</td>
    `).map(row => `<tr>${row}</tr>`).join('');

    document.getElementById('app-root').innerHTML = `
        <div class="screen-container bg-white rounded-xl m-2 shadow-md">
            <h2 class="text-2xl font-bold mb-5 text-center text-indigo-700">ASIGNAR VEHÍCULO A VENDEDOR</h2>
            <div class="mb-8 p-4 bg-blue-50 rounded-lg border border-blue-300">
                <h3 class="text-xl font-bold mb-4 text-blue-700">Asignar Camión a Usuarios</h3>
                ${_createTable(['Correo Electrónico', 'Rol', 'Camión Asignado', 'Asignar Nuevo Camión', 'Acciones'], tableRows, 'user-assignment-table-body')}
            </div>
            ${_createButton('Volver', 'backToMainFromAssignVehicleButton', 'bg-gray-600 mt-5 w-full')}
        </div>
    `;
};

export const handleAssignVehicle = async (userId) => {
    if (!_isAdmin()) { _showMessageModal('Acceso denegado: Solo los administradores pueden asignar vehículos.'); return; }
    const selectElement = document.getElementById(`assignTruck-${userId}`);
    const newAssignedTruckPlate = selectElement.value || null;

    try {
        await _db.collection('users').doc(userId).update({ assignedTruckPlate: newAssignedTruckPlate });
        _users = _users.map(u => u.uid === userId ? { ...u, assignedTruckPlate: newAssignedTruckPlate } : u);
        if (_currentUserData && _currentUserData.uid === userId) {
            _currentUserData.assignedTruckPlate = newAssignedTruckPlate;
            setupTruckInventoryListener();
        }
        _showMessageModal(`Vehículo asignado exitosamente al usuario ${_users.find(u => u.uid === userId).email}.`);
        _setScreenAndRender('assignVehicle');
    } catch (error) {
        console.error('Error al asignar vehículo:', error);
        _showMessageModal('Error al asignar vehículo. Revisa tu conexión y reglas de seguridad.');
    }
};

export const renderLoadHistoryScreen = () => {
    if (!_isAdmin()) { _showMessageModal('Acceso denegado: Solo los administradores pueden ver el historial de cargas.'); _setScreenAndRender('main'); return; }

    // Use getter for loadRecords
    const sortedLoadRecords = [...getLoadRecords()].sort((a, b) => {
        const dateA = parseInt(a.date.substring(4, 8) + a.date.substring(2, 4) + a.date.substring(0, 2));
        const dateB = parseInt(b.date.substring(4, 8) + b.date.substring(2, 4) + b.date.substring(0, 2));
        return dateB - dateA;
    });

    const loadFilesHtml = sortedLoadRecords.length === 0 ? '<p class="text-gray-600">No hay archivos de carga generados.</p>' :
        sortedLoadRecords.map(record => `
            <div class="bg-yellow-100 p-3 rounded-lg mb-2 flex flex-wrap justify-between items-center border border-yellow-200">
                <span class="text-base text-yellow-800 mb-2 sm:mb-0">
                    ${record.fileName} <br>
                    <span class="text-sm text-gray-600">Camión: ${record.truckName} (${record.truckPlate}) - Cargador: ${record.loader} - Total: $${record.total.toFixed(2)}</span>
                </span>
                <div class="flex flex-wrap gap-2">
                    ${_createButton('DESCARGAR CSV', `downloadCsv-${record.fileName}`, 'bg-green-500 text-white py-1 px-3 rounded-md text-sm download-csv-button', { filename: record.fileName })}
                </div>
            </div>
        `).join('');

    document.getElementById('app-root').innerHTML = `
        <div class="screen-container bg-white rounded-xl m-2 shadow-md">
            <h2 class="text-2xl font-bold mb-5 text-center text-indigo-700">HISTORIAL DE CARGAS</h2>
            <p class="text-base text-center my-5 text-gray-600">Aquí puedes ver y descargar los archivos de cargas generados.</p>
            <div class="p-4 bg-yellow-50 rounded-lg border border-yellow-300">
                <h3 class="text-xl font-bold mb-4 text-yellow-700">Archivos de Carga Generados</h3>
                <div id="generated-load-files-list">${loadFilesHtml}</div>
            </div>
            ${_createButton('Limpiar Historial', 'clearLoadHistoryButton', 'bg-red-600 mt-5 w-full')}
            ${_createButton('Volver', 'backToCargaSelectionFromLoadHistoryButton', 'bg-gray-600 mt-3 w-full')}
        </div>
    `;
};

export const showClearLoadHistoryConfirmation = () => {
    if (!_isAdmin()) { _showMessageModal('Acceso denegado: Solo los administradores pueden limpiar el historial de cargas.'); return; }
    _showConfirmationModal('Confirma desea borrar el Historial de Cargas', clearLoadHistoryLogic);
};

export const clearLoadHistoryLogic = async () => {
    if (!_isAdmin()) { _showMessageModal('Acceso denegado: Solo los administradores pueden limpiar el historial de cargas.'); return; }
    try {
        const batch = _db.batch();
        const loadRecordsSnapshot = await _db.collection('loadRecords').get();
        loadRecordsSnapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        setLoadRecords([]); // Use setter
        _showMessageModal('Historial de cargas borrado exitosamente.');
        _setScreenAndRender('loadHistory');
    } catch (error) {
        console.error('Error al limpiar el historial de cargas:', error);
        _showMessageModal('Error al limpiar el historial de cargas. Revisa tu conexión y reglas de seguridad.');
    }
};

export const renderTransferInventoryPasswordScreen = () => {
    if (!_isUser() || !_currentUserData.assignedTruckPlate) {
        _showMessageModal('Acceso denegado o no tienes un camión asignado.'); _setScreenAndRender('main'); return;
    }
    document.getElementById('app-root').innerHTML = `
        <div class="screen-container bg-white rounded-xl m-2 shadow-md max-w-md mx-auto my-10">
            <h2 class="text-2xl font-bold mb-5 text-center text-indigo-700">Confirmación de Seguridad</h2>
            <p class="text-lg text-center mb-6 text-gray-700">Ingrese contraseña para confirmar la operación de transbordo.</p>
            ${_createInput('userPasswordForTransfer', 'Contraseña', '', 'password')}
            ${_createButton('Continuar', 'userPasswordForTransferButton', 'w-full')}
            ${_createButton('Cancelar', 'cancelTransferInventoryPasswordButton', 'bg-gray-600 mt-3 w-full')}
        </div>
    `;
};

export const handleTransferInventoryPassword = async () => {
    const password = document.getElementById('userPasswordForTransfer').value;
    if (!password) { _showMessageModal('Por favor, ingresa tu contraseña.'); return; }
    try {
        const credential = firebase.auth.EmailAuthProvider.credential(_currentUserData.email, password); // Use _currentUserData.email
        await firebase.auth().currentUser.reauthenticateWithCredential(credential); // Use firebase.auth().currentUser

        selectedDestinationTruck = null;
        transferQuantities = {};
        _setScreenAndRender('transferInventory');
    } catch (error) {
        _showMessageModal(`Error de autenticación: ${error.message}. Contraseña incorrecta o sesión expirada.`);
    }
};

export const renderTransferInventoryScreen = () => {
    if (!_isUser() || !_currentUserData.assignedTruckPlate) { _showMessageModal('Acceso denegado o no tienes un camión asignado.'); _setScreenAndRender('main'); return; }
    const sourceTruck = _vehicles.find(v => v.plate === _currentUserData.assignedTruckPlate);
    if (!sourceTruck) { _showMessageModal('No se encontró información para tu camión asignado.'); _setScreenAndRender('main'); return; }

    const destinationTrucks = _vehicles.filter(v => v.plate !== sourceTruck.plate);
    const destinationOptions = destinationTrucks.map(v => ({ value: v.plate, text: `${v.name} (${v.plate})` }));

    let productsTableHtml = '';
    if (selectedDestinationTruck) {
        // Use getter for currentTruckInventory
        const tableRows = getCurrentTruckInventory().map(item => {
            if (transferQuantities[item.sku] === undefined) transferQuantities[item.sku] = 0;
            return `
                <td><img src="${_productImages[item.sku] || _productImages['default']}" alt="Imagen de ${item.producto}" class="w-10 h-10 rounded-md object-cover"></td>
                <td>${item.sku}</td><td>${item.producto}</td><td>${item.presentacion}</td><td>${item.quantity}</td>
                <td><input type="number" class="border border-gray-300 rounded-md text-center w-20 transfer-quantity-input" value="${transferQuantities[item.sku]}" data-sku="${item.sku}" min="0" max="${item.quantity}"></td>
            `;
        }).map(row => `<tr>${row}</tr>`).join('');

        productsTableHtml = `
            <p class="text-base text-center mb-4 text-gray-700">Cantidad a trasladar del camión <strong>${sourceTruck.name}</strong> al camión <strong>${selectedDestinationTruck.name}</strong>.</p>
            ${_createTable(['Imagen', 'SKU', 'Producto', 'Presentación', 'Disponible', 'Cantidad a Trasladar'], tableRows, 'products-for-transfer-body')}
            ${_createButton('Realizar Transbordo', 'performTransferButton', 'bg-emerald-600 mt-5 w-full')}
        `;
    } else {
        productsTableHtml = '<p class="text-center text-gray-600">Por favor, seleccione un camión de destino para continuar.</p>';
    }

    document.getElementById('app-root').innerHTML = `
        <div class="screen-container bg-white rounded-xl m-2 shadow-md">
            <h2 class="text-2xl font-bold mb-5 text-center text-indigo-700">TRANSBORDO DE INVENTARIO</h2>
            <p class="text-lg text-center mb-4 text-gray-700">Camión de Origen: <strong>${sourceTruck.name} (${sourceTruck.plate})</strong></p>
            <div class="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-300">
                <label for="destinationTruckSelect" class="block text-lg font-semibold text-blue-700 mb-2">Seleccionar Camión de Destino:</label>
                ${_createSelect('destinationTruckSelect', destinationOptions, selectedDestinationTruck?.plate)}
            </div>
            ${productsTableHtml}
            <div class="p-4 bg-yellow-50 rounded-lg border border-yellow-300 mt-8">
                <h3 class="text-xl font-bold mb-4 text-yellow-700">Historial de Traslados</h3>
                <div id="user-transfer-history-list"></div>
            </div>
            ${_createButton('Volver', 'backToMainFromTransferInventoryButton', 'bg-gray-600 mt-5 w-full')}
        </div>
    `;
    updateUserTransferHistoryDisplay();
};

export const handleDestinationTruckSelection = (plate) => {
    selectedDestinationTruck = plate ? _vehicles.find(v => v.plate === plate) : null;
    transferQuantities = {};
    _setScreenAndRender('transferInventory');
};

export const handleTransferQuantityChange = (sku, quantity) => {
    transferQuantities[sku] = parseInt(quantity) || 0;
};

export const showTransferConfirmation = () => {
    _showConfirmationModal('¿Estás seguro de que quieres realizar este transbordo de inventario? Esto modificará los inventarios de ambos camiones.', performInventoryTransfer);
};

export const performInventoryTransfer = async () => {
    if (!_isUser() || !_currentUserData.assignedTruckPlate || !selectedDestinationTruck) {
        _showMessageModal('Error: No se puede realizar el transbordo. Asegúrate de tener un camión asignado y un camión de destino seleccionado.'); return;
    }

    const sourceTruckPlate = _currentUserData.assignedTruckPlate;
    const destinationTruckPlate = selectedDestinationTruck.plate;

    let transferData = [];
    let messages = [];
    let hasPositiveTransferQuantity = false;

    let sourceTruckInventoryCopy = JSON.parse(JSON.stringify(getCurrentTruckInventory())); // Use getter
    let destinationTruckInventoryCopy = [];
    try {
        const destTruckDoc = await _db.collection('truck_inventories').doc(destinationTruckPlate).get();
        destinationTruckInventoryCopy = destTruckDoc.exists ? (destTruckDoc.data().items || []) : [];
    } catch (error) {
        console.error('Error al cargar inventario del camión de destino:', error);
        _showMessageModal('Error al cargar el inventario del camión de destino. Intenta de nuevo.'); return;
    }

    for (const sku in transferQuantities) {
        const quantityToTransfer = transferQuantities[sku];
        if (quantityToTransfer <= 0) continue;
        hasPositiveTransferQuantity = true;

        const sourceItemIndex = sourceTruckInventoryCopy.findIndex(item => item.sku === sku);
        const sourceItem = sourceItemIndex !== -1 ? sourceTruckInventoryCopy[sourceItemIndex] : null;

        if (!sourceItem || quantityToTransfer > sourceItem.quantity) {
            messages.push(`Error: Cantidad insuficiente para SKU "${sku}" en el camión de origen. Disponible: ${sourceItem ? sourceItem.quantity : 0}, Intentado trasladar: ${quantityToTransfer}.`);
            continue;
        }

        sourceTruckInventoryCopy[sourceItemIndex].quantity -= quantityToTransfer;

        const destItemIndex = destinationTruckInventoryCopy.findIndex(item => item.sku === sku);
        if (destItemIndex !== -1) {
            destinationTruckInventoryCopy[destItemIndex].quantity += quantityToTransfer;
        } else {
            const productDetails = _inventory.find(item => item.sku === sku);
            if (productDetails) {
                destinationTruckInventoryCopy.push({
                    sku: productDetails.sku, rubro: productDetails.rubro, segmento: productDetails.segmento,
                    producto: productDetails.producto, presentacion: productDetails.presentacion,
                    quantity: quantityToTransfer, price: productDetails.precio
                });
            } else {
                messages.push(`Advertencia: Producto con SKU ${sku} no encontrado en el inventario principal. No se pudo añadir completamente al camión de destino.`);
            }
        }
        transferData.push({
            sku: sku, producto: sourceItem.producto, presentacion: sourceItem.presentacion,
            cantidadTrasladada: quantityToTransfer, camionOrigen: sourceTruckPlate, camionDestino: destinationTruckPlate
        });
    }

    if (messages.length > 0) { _showMessageModal(messages.join('\n')); return; }
    if (!hasPositiveTransferQuantity) { _showMessageModal('Por favor, ingresa al menos una cantidad positiva para realizar el transbordo.'); return; }

    const transferFileName = `traslado_${sourceTruckPlate}_${destinationTruckPlate}_${getCurrentDateFormatted()}.csv`;
    const transferCSVContent = `SKU,Producto,Presentacion,Cantidad Trasladada,Camion Origen,Camion Destino\n` +
                               transferData.map(item => `${item.sku},${item.producto},${item.presentacion},${item.cantidadTrasladada},${item.camionOrigen},${item.camionDestino}`).join('\n');

    const transferRecord = {
        fileName: transferFileName, date: getCurrentDateFormatted(), sourceTruckPlate: sourceTruckPlate,
        destinationTruckPlate: destinationTruckPlate, userId: _currentUserData.uid, items: transferData, rawCSV: transferCSVContent
    };

    try {
        const batch = _db.batch();
        batch.set(_db.collection('truck_inventories').doc(sourceTruckPlate), { items: sourceTruckInventoryCopy.filter(item => item.quantity > 0) });
        batch.set(_db.collection('truck_inventories').doc(destinationTruckPlate), { items: destinationTruckInventoryCopy.filter(item => item.quantity > 0) });
        const docRef = await _db.collection('transferRecords').add(transferRecord);
        transferRecord.docId = docRef.id;
        await batch.commit();

        setCurrentTruckInventory(sourceTruckInventoryCopy); // Use the setter function
        setTransferRecords([...getTransferRecords(), transferRecord]); // Use setter
        
        _showMessageModal('Transbordo de inventario realizado exitosamente. Archivo generado.');
        triggerCSVDownload(transferFileName, transferCSVContent);
        selectedDestinationTruck = null;
        transferQuantities = {};
        _setScreenAndRender('transferInventory');
    } catch (error) {
        console.error('Error al realizar transbordo de inventario:', error);
        _showMessageModal('Error al realizar transbordo. Revisa tu conexión y reglas de seguridad.');
    }
};

export const updateUserTransferHistoryDisplay = () => {
    const userTransferHistoryListDiv = document.getElementById('user-transfer-history-list');
    if (!userTransferHistoryListDiv) return;

    // Use getter for transferRecords
    const userSpecificTransferRecords = getTransferRecords().filter(record => record.userId === _currentUserData.uid);
    const sortedUserTransferRecords = [...userSpecificTransferRecords].sort((a, b) => {
        const dateA = parseInt(a.date.substring(4, 8) + a.date.substring(2, 4) + a.date.substring(0, 2));
        const dateB = parseInt(b.date.substring(4, 8) + b.date.substring(2, 4) + b.date.substring(0, 2));
        return dateB - dateA;
    });

    if (sortedUserTransferRecords.length === 0) {
        userTransferHistoryListDiv.innerHTML = '<p class="text-gray-600">No hay traslados registrados para tu usuario.</p>';
    } else {
        userTransferHistoryListDiv.innerHTML = sortedUserTransferRecords.map(record => {
            const userEmail = _users.find(u => u.uid === record.userId)?.email || 'Desconocido';
            return `
                <div class="bg-yellow-100 p-3 rounded-lg mb-2 flex flex-wrap justify-between items-center border border-yellow-200">
                    <span class="text-base text-yellow-800 mb-2 sm:mb-0">
                        ${record.fileName} <br>
                        <span class="text-sm text-gray-600">Origen: ${record.sourceTruckPlate} - Destino: ${record.destinationTruckPlate} - Realizado por: ${userEmail} - Fecha: ${record.date}</span>
                    </span>
                    <div class="flex flex-wrap gap-2">
                        ${_createButton('DESCARGAR CSV', `downloadCsv-${record.fileName}`, 'bg-green-500 text-white py-1 px-3 rounded-md text-sm download-csv-button', { filename: record.fileName })}
                    </div>
                </div>
            `;
        }).join('');
    }
};

export const renderAdminTransferHistoryScreen = () => {
    if (!_isAdmin()) { _showMessageModal('Acceso denegado: Solo los administradores pueden ver el historial de transbordos.'); _setScreenAndRender('main'); return; }

    // Use getter for transferRecords
    const sortedTransferRecords = [...getTransferRecords()].sort((a, b) => {
        const dateA = parseInt(a.date.substring(4, 8) + a.date.substring(2, 4) + a.date.substring(0, 2));
        const dateB = parseInt(b.date.substring(4, 8) + b.date.substring(2, 4) + b.date.substring(0, 2));
        return dateB - dateA;
    });

    const transferFilesHtml = sortedTransferRecords.length === 0 ? '<p class="text-gray-600">No hay archivos de transbordo generados.</p>' :
        sortedTransferRecords.map(record => {
            const userEmail = _users.find(u => u.uid === record.userId)?.email || 'Desconocido';
            return `
                <div class="bg-yellow-100 p-3 rounded-lg mb-2 flex flex-wrap justify-between items-center border border-yellow-200">
                    <span class="text-base text-yellow-800 mb-2 sm:mb-0">
                        ${record.fileName} <br>
                        <span class="text-sm text-gray-600">Origen: ${record.sourceTruckPlate} - Destino: ${record.destinationTruckPlate} - Realizado por: ${userEmail} - Fecha: ${record.date}</span>
                    </span>
                    <div class="flex flex-wrap gap-2">
                        ${_createButton('DESCARGAR CSV', `downloadCsv-${record.fileName}`, 'bg-green-500 text-white py-1 px-3 rounded-md text-sm download-csv-button', { filename: record.fileName })}
                    </div>
                </div>
            `;
        }).join('');

    document.getElementById('app-root').innerHTML = `
        <div class="screen-container bg-white rounded-xl m-2 shadow-md">
            <h2 class="text-2xl font-bold mb-5 text-center text-indigo-700">HISTORIAL DE TRANSBORDOS</h2>
            <p class="text-base text-center my-5 text-gray-600">Aquí puedes ver y descargar todos los archivos de transbordo generados.</p>
            <div class="p-4 bg-yellow-50 rounded-lg border border-yellow-300">
                <h3 class="text-xl font-bold mb-4 text-yellow-700">Archivos de Transbordo Generados</h3>
                <div id="admin-transfer-history-list">${transferFilesHtml}</div>
            </div>
            ${_createButton('Limpiar Historial de Transbordo', 'clearTransferHistoryButton', 'bg-red-600 mt-5 w-full')}
            ${_createButton('Volver', 'backToMainFromAdminTransferHistoryButton', 'bg-gray-600 mt-3 w-full')}
        </div>
    `;
};

export const showClearTransferHistoryConfirmation = () => {
    if (!_isAdmin()) { _showMessageModal('Acceso denegado: Solo los administradores pueden limpiar el historial de transbordos.'); return; }
    _showConfirmationModal('Confirma desea borrar el Historial de Transbordos (esto afectará a todos los usuarios).', clearTransferHistoryLogic);
};

export const clearTransferHistoryLogic = async () => {
    if (!_isAdmin()) { _showMessageModal('Acceso denegado: Solo los administradores pueden limpiar el historial de transbordos.'); return; }
    try {
        const batch = _db.batch();
        const transferRecordsSnapshot = await _db.collection('transferRecords').get();
        transferRecordsSnapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        setTransferRecords([]); // Use setter
        _showMessageModal('Historial de transbordos borrado exitosamente.');
        _setScreenAndRender('adminTransferHistory');
    } catch (error) {
        console.error('Error al limpiar el historial de transbordos:', error);
        _showMessageModal('Error al limpiar el historial de transbordos. Revisa tu conexión y reglas de seguridad.');
    }
};

// --- Firestore Data Fetching and Listeners ---

// This function will be called from fetchDataFromFirestore in index.html
export const fetchInventoryRelatedData = async () => {
    try {
        const fetchCollection = async (collectionName, initialData, idKey) => {
            const snapshot = await _db.collection(collectionName).get();
            if (snapshot.empty) {
                console.log(`[inventoryManagement] Collection '${collectionName}' is empty. Populating with initial data.`);
                const batch = _db.batch();
                for (const item of initialData) {
                    batch.set(_db.collection(collectionName).doc(item[idKey]), item);
                }
                await batch.commit();
                if (collectionName === 'vehicles') {
                     const truckInvBatch = _db.batch();
                     for (const item of initialData) {
                         const truckInvDoc = await _db.collection('truck_inventories').doc(item.plate).get();
                         if (!truckInvDoc.exists) {
                             truckInvBatch.set(_db.collection('truck_inventories').doc(item.plate), { items: [] });
                         }
                     }
                     await truckInvBatch.commit();
                }
                return initialData;
            } else {
                console.log(`[inventoryManagement] Collection '${collectionName}' has data. Fetching existing data.`);
                return snapshot.docs.map(doc => ({ [idKey]: doc.id, ...doc.data() }));
            }
        };

        _inventory.splice(0, _inventory.length, ...await fetchCollection('inventory', initialInventory, 'sku')); // Update _inventory in place
        _vehicles.splice(0, _vehicles.length, ...await fetchCollection('vehicles', initialVehicles, 'plate')); // Update _vehicles in place

        if (_isAdmin()) {
            console.log('[inventoryManagement] User is admin, fetching all load records.');
            const loadRecordsSnapshot = await _db.collection('loadRecords').get();
            setLoadRecords(loadRecordsSnapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() }))); // Use setter
        } else {
            setLoadRecords([]); // Use setter to clear
            console.log('[inventoryManagement] User is not admin, not fetching all load records.');
        }

        if (_isAdmin()) {
            console.log('[inventoryManagement] User is admin, fetching all transfer records.');
            const transferRecordsSnapshot = await _db.collection('transferRecords').get();
            setTransferRecords(transferRecordsSnapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() }))); // Use setter
        } else if (_isUser() && _currentUserData) {
            console.log(`[inventoryManagement] User is regular, fetching transfer records for user: ${_currentUserData.uid}`);
            const userTransferRecordsSnapshot = await _db.collection('transferRecords').where('userId', '==', _currentUserData.uid).get();
            setTransferRecords(userTransferRecordsSnapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() }))); // Use setter
        } else {
            setTransferRecords([]); // Use setter to clear
            console.log('[inventoryManagement] Not fetching transfer records (guest or no user).');
        }

        console.log('[inventoryManagement] Inventory-related data fetch completed.');
    } catch (error) {
        console.error('[inventoryManagement] Error fetching inventory-related data:', error);
        _showMessageModal('Error al cargar datos de inventario. Usando datos de ejemplo. Por favor, revisa tu conexión y las reglas de seguridad de Firestore.');
        _inventory.splice(0, _inventory.length, ...initialInventory); // Fallback in place
        _vehicles.splice(0, _vehicles.length, ...initialVehicles); // Fallback in place
        setLoadRecords([]); // Use setter for fallback
        setTransferRecords([]); // Use setter for fallback
    }
};

export const setupTruckInventoryListener = () => {
    if (truckInventoryUnsubscribe) {
        truckInventoryUnsubscribe();
        truckInventoryUnsubscribe = null;
        console.log('[Firestore Listener] Unsubscribed from previous user truck inventory listener.');
    }

    if (_currentUserData.assignedTruckPlate) {
        const truckInventoryDocRef = _db.collection('truck_inventories').doc(_currentUserData.assignedTruckPlate);
        console.log(`[Firestore Listener] Setting up onSnapshot for user truck inventory: ${_currentUserData.assignedTruckPlate}`);

        truckInventoryUnsubscribe = truckInventoryDocRef.onSnapshot(docSnapshot => {
            if (docSnapshot.exists) {
                setCurrentTruckInventory(docSnapshot.data().items || []); // Use setter
                console.log(`[Firestore Listener] User truck inventory updated via snapshot for ${_currentUserData.assignedTruckPlate}:`, getCurrentTruckInventory().length, 'items.');
            } else {
                setCurrentTruckInventory([]); // Use setter
                console.log(`[Firestore Listener] User truck inventory document for ${_currentUserData.assignedTruckPlate} does not exist or is empty.`);
            }
            // Trigger a re-render in index.html if on a relevant screen
            if (document.getElementById('app-root')) { // Check if app-root exists before trying to re-render
                _setScreenAndRender(document.getElementById('app-root').dataset.currentScreen || 'main'); // Attempt to re-render current screen
            }
        }, error => {
            console.error('[Firestore Listener] Error listening to user truck inventory:', error);
            _showMessageModal('Error en la sincronización del inventario del camión. Puede que los datos no estén actualizados.');
        });
    } else {
        setCurrentTruckInventory([]); // Use setter
        console.log('[Firestore Listener] No truck assigned for current user, no listener set up.');
    }
};

export const setupAdminTruckInventoryListener = (plate) => {
    if (adminTruckInventoryUnsubscribe) {
        adminTruckInventoryUnsubscribe();
        adminTruckInventoryUnsubscribe = null;
        console.log('[Firestore Listener] Unsubscribed from previous admin truck inventory listener.');
    }

    if (plate) {
        const truckInventoryDocRef = _db.collection('truck_inventories').doc(plate);
        console.log(`[Firestore Listener] Setting up onSnapshot for admin selected truck inventory: ${plate}`);

        adminTruckInventoryUnsubscribe = truckInventoryDocRef.onSnapshot(docSnapshot => {
            const displayDiv = document.getElementById('selected-vehicle-inventory-display');
            if (!displayDiv) {
                console.warn('[Firestore Listener] Display div for admin truck inventory not found.');
                return;
            }

            console.log(`[Firestore Listener] Snapshot received for ${plate}. docSnapshot.exists: ${docSnapshot.exists}`);
            if (docSnapshot.exists) {
                const data = docSnapshot.data();
                console.log(`[Firestore Listener] Snapshot data for ${plate}:`, JSON.stringify(data));
                const displayInventory = data.items || [];
                console.log(`[Firestore Listener] Items array for ${plate}:`, JSON.stringify(displayInventory));

                if (displayInventory.length === 0) {
                    displayDiv.innerHTML = `<p class="text-center text-gray-600 text-lg py-4">Inventario del camión ${plate} vacío por el momento.</p>`;
                } else {
                    const tableRows = displayInventory.map(item => `
                        <td>${item.rubro}</td><td>${item.sku}</td><td>${item.producto}</td>
                        <td>${item.presentacion}</td><td>${item.quantity}</td><td>$${item.price.toFixed(2)}</td>
                    `).map(row => `<tr>${row}</tr>`).join('');
                    displayDiv.innerHTML = _createTable(['Rubro', 'Sku', 'Producto', 'Presentación', 'Cantidad', 'Precio'], tableRows, 'admin-truck-inventory-display-body');
                }
            } else {
                displayDiv.innerHTML = `<p class="text-center text-gray-600 text-lg py-4">Inventario del camión ${plate} no existe o está vacío.</p>`;
                console.log(`[Firestore Listener] Admin selected truck inventory document for ${plate} does not exist or is empty.`);
            }
        }, error => {
            console.error('[Firestore Listener] Error listening to admin selected truck inventory:', error);
            _showMessageModal('Error en la sincronización del inventario del camión para el administrador. Puede que los datos no estén actualizados.');
            const displayDiv = document.getElementById('selected-vehicle-inventory-display');
            if (displayDiv) {
                displayDiv.innerHTML = `<p class="text-center text-red-600 text-lg py-4">Error al cargar el inventario del camión.</p>`;
            }
        });
    } else {
        console.log('[Firestore Listener] No truck selected for admin, no listener set up.');
    }
};

export const handleFileUpload = async (event, type) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        const parsedData = parseCSV(e.target.result);
        try {
            const collectionRef = _db.collection(type === 'inventory' ? 'inventory' : 'vehicles');
            const existingSnapshot = await collectionRef.get();
            const deleteBatch = _db.batch();
            existingSnapshot.docs.forEach(doc => deleteBatch.delete(doc.ref));
            await deleteBatch.commit();
            console.log(`[handleFileUpload] Existing ${type} documents deleted.`);

            const addBatch = _db.batch();
            for (const row of parsedData) {
                if (type === 'inventory') {
                    addBatch.set(collectionRef.doc(row.Sku), { rubro: row.Rubro, sku: row.Sku, segmento: row.Segmento, producto: row.Producto, presentacion: row.Presentacion, cantidad: parseInt(row.Cantidad) || 0, precio: parseFloat(row.Precio) || 0 });
                } else if (type === 'vehicles') {
                    addBatch.set(collectionRef.doc(row.Plate), { plate: row.Plate, name: row.Name, brand: row.Brand, model: row.Model });
                    const truckInvDoc = await _db.collection('truck_inventories').doc(row.Plate).get();
                    if (!truckInvDoc.exists || (truckInvDoc.exists && truckInvDoc.data().items && truckInvDoc.data().items.length > 0)) {
                        addBatch.set(_db.collection('truck_inventories').doc(row.Plate), { items: [] });
                    }
                }
            }
            await addBatch.commit();
            console.log(`[handleFileUpload] New ${type} documents added.`);

            await _fetchDataFromFirestore();
            _showMessageModal(`${type}.csv cargado y guardado exitosamente en Firestore.`);
            // No need to render here, _fetchDataFromFirestore will trigger main render
        } catch (error) {
            console.error('Error al cargar archivo CSV a Firestore:', error);
            _showMessageModal('Error al cargar archivo. Por favor, revisa tu conexión y las reglas de seguridad de Firestore.');
        }
    };
    reader.readAsText(file);
};

export const downloadExistingCSV = (filename) => {
    let csvContent = '';
    const findContent = (arr, key, val) => arr.find(record => record[key] === val);

    const loadRecord = findContent(getLoadRecords(), 'fileName', filename); // Use getter
    const transferRecord = findContent(getTransferRecords(), 'fileName', filename); // Use getter
    // Note: dailySales is in index.html, not here. If needed, it must be passed in init.
    // For now, only handle load and transfer records from this module.

    if (loadRecord) {
        csvContent = loadRecord.rawCSV;
    } else if (transferRecord) {
        csvContent = transferRecord.rawCSV;
    } else {
        let dataToDownload = [];
        let headers = [];
        switch (filename) {
            case 'inventario.csv':
                dataToDownload = _inventory.map(i => ({ Rubro: i.rubro, Sku: i.sku, Segmento: i.segmento, Producto: i.producto, Presentacion: i.presentacion, Cantidad: i.cantidad, Precio: i.precio }));
                headers = ['Rubro', 'Sku', 'Segmento', 'Producto', 'Presentacion', 'Cantidad', 'Precio'];
                break;
            case 'vehiculos.csv':
                dataToDownload = _vehicles.map(v => ({ Plate: v.plate, Name: v.name, Brand: v.brand, Model: v.model }));
                headers = ['Plate', 'Name', 'Brand', 'Model'];
                break;
            default:
                _showMessageModal(`No se encontró contenido para descargar el archivo: ${filename}`);
                return;
        }
        csvContent = toCSV(dataToDownload, headers);
    }
    triggerCSVDownload(filename, csvContent);
};
