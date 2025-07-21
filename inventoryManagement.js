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
let _createSearchableDropdown; // New dependency

// --- Data specific to inventory management ---
let currentTruckInventory = []; // Changed to 'let' without export directly for internal management
export let loadRecords = [];
export let transferRecords = [];

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

// State for searchable dropdowns in inventory management
let assignVehicleSearchTerm = ''; // For the assign vehicle screen's search dropdown
let vehiclesSearchTerm = ''; // For the vehicles screen's search dropdown

// Unsubscribe functions for Firestore listeners (now internal and managed by getters/setters)
let _truckInventoryUnsubscribe = null; // For user's assigned truck
let _adminTruckInventoryUnsubscribe = null; // For admin's selected truck

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
export const init = (db, currentUserData, isAdmin, isUser, vehicles, inventory, users, vendors, productImages, showMessageModal, showConfirmationModal, createTable, createInput, createSelect, createButton, setScreenAndRender, fetchDataFromFirestore, createSearchableDropdown) => {
    _db = db;
    _currentUserData = currentUserData;
    _isAdmin = isAdmin;
    _isUser = isUser;
    // Ensure these are arrays, even if initially undefined or null
    _vehicles = Array.isArray(vehicles) ? vehicles : [];
    _inventory = Array.isArray(inventory) ? inventory : [];
    _users = Array.isArray(users) ? users : [];
    _vendors = Array.isArray(vendors) ? vendors : [];

    _productImages = productImages;
    _showMessageModal = showMessageModal;
    _showConfirmationModal = showConfirmationModal;
    _createTable = createTable;
    _createInput = createInput;
    _createSelect = createSelect;
    _createButton = createButton;
    _setScreenAndRender = setScreenAndRender;
    _fetchDataFromFirestore = fetchDataFromFirestore;
    _createSearchableDropdown = createSearchableDropdown; // Assign the new dependency
    console.log('[inventoryManagement.js] Initialized with dependencies.');
};

// --- Getter for currentTruckInventory (for external modules to read) ---
export const getCurrentTruckInventory = () => currentTruckInventory;

// --- Setter for currentTruckInventory (for external modules to update) ---
export const setCurrentTruckInventory = (newInventory) => {
    currentTruckInventory = newInventory;
    console.log('[inventoryManagement.js] currentTruckInventory updated internally.');
};

// --- Getter/Setter for truckInventoryUnsubscribe ---
export const getTruckInventoryUnsubscribe = () => _truckInventoryUnsubscribe;
export const setTruckInventoryUnsubscribe = (func) => { _truckInventoryUnsubscribe = func; };

// --- Getter/Setter for adminTruckInventoryUnsubscribe ---
export const getAdminTruckInventoryUnsubscribe = () => _adminTruckInventoryUnsubscribe;
export const setAdminTruckInventoryUnsubscribe = (func) => { _adminTruckInventoryUnsubscribe = func; };

// --- Function to update _currentUserData (called from index.html) ---
export const updateCurrentUserData = (data) => {
    console.log('[inventoryManagement.js] updateCurrentUserData function called.');
    Object.assign(_currentUserData, data);
    console.log('[inventoryManagement.js] _currentUserData updated:', _currentUserData);
};
console.log('[inventoryManagement.js] updateCurrentUserData is defined and exported.'); // Log when module loads


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
                <label for="loaderSelect" class="block text-gray-700 text-sm font-bold mb-2">Cargador:</label>
                ${_createSelect('loaderSelect', loaderOptions, selectedLoader || '', 'w-full')}
            </div>

            <div class="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-300">
                <label for="truckSelect" class="block text-gray-700 text-sm font-bold mb-2">Camión a Cargar:</label>
                ${_createSelect('truckSelect', vehicleOptions, selectedTruckForReceiving || '', 'w-full')}
            </div>

            <div id="receiving-products-container" class="mb-6">
                <!-- Products to receive will be rendered here -->
                ${selectedTruckForReceiving ? renderReceivingProductsTable() : '<p class="text-center text-gray-500">Selecciona un camión para ver los productos.</p>'}
            </div>

            ${_createButton('Cargar Mercancía', 'loadMerchandiseButton', 'bg-emerald-600 w-full')}
            ${_createButton('Volver', 'backToCargaSelectionButton', 'bg-gray-600 mt-5 w-full')}
        </div>
    `;
};

const renderReceivingProductsTable = () => {
    if (!selectedTruckForReceiving) return '';

    const productsHtml = _inventory.map(item => `
        <tr>
            <td><img src="${_productImages[item.sku] || _productImages['default']}" alt="Imagen de ${item.producto}" class="w-10 h-10 rounded-md object-cover"></td>
            <td>${item.sku}</td>
            <td>${item.producto}</td>
            <td>${item.presentacion}</td>
            <td><input type="number" class="border border-gray-300 rounded-md text-center receiving-quantity-input" value="${receivingQuantities[item.sku] || ''}" data-sku="${item.sku}" min="0"></td>
        </tr>
    `).join('');

    return _createTable(['Imagen', 'SKU', 'Producto', 'Presentación', 'Cantidad a Cargar'], productsHtml, 'receiving-products-table-body');
};

export const handleLoaderSelection = (loaderName) => {
    selectedLoader = loaderName;
    _setScreenAndRender('truckLoading'); // Re-render to update the screen
};

export const handleTruckForReceivingSelection = async (truckPlate) => {
    selectedTruckForReceiving = truckPlate;
    receivingQuantities = {}; // Reset quantities for new truck
    selectedTruckInventoryForReceiving = []; // Reset inventory for new truck

    if (truckPlate) {
        try {
            const truckInventoryDoc = await _db.collection('truck_inventories').doc(truckPlate).get();
            if (truckInventoryDoc.exists) {
                selectedTruckInventoryForReceiving = truckInventoryDoc.data().items || [];
                console.log(`[Inventory Management] Fetched existing inventory for ${truckPlate}:`, selectedTruckInventoryForReceiving);
            } else {
                console.log(`[Inventory Management] No existing inventory found for ${truckPlate}. Starting fresh.`);
            }
        } catch (error) {
            console.error('[Inventory Management] Error fetching truck inventory for receiving:', error);
            _showMessageModal('Error al cargar el inventario del camión. Revisa tu conexión y las reglas de seguridad.');
        }
    }
    _setScreenAndRender('truckLoading'); // Re-render to update the screen
};

export const handleReceivingQuantityChange = (sku, quantity) => {
    receivingQuantities[sku] = parseInt(quantity) || 0;
};

export const showLoadMerchandiseConfirmation = () => {
    _showConfirmationModal('¿Estás seguro de que quieres cargar la mercancía en el camión seleccionado? Esto actualizará el inventario del camión y el inventario principal.', loadMerchandise);
};

const loadMerchandise = async () => {
    if (!selectedTruckForReceiving || !selectedLoader) {
        _showMessageModal('Por favor, selecciona un cargador y un camión.');
        return;
    }

    const itemsToLoad = [];
    for (const sku in receivingQuantities) {
        const quantity = receivingQuantities[sku];
        if (quantity > 0) {
            const mainInventoryItem = _inventory.find(item => item.sku === sku);
            if (!mainInventoryItem) {
                _showMessageModal(`Error: SKU ${sku} no encontrado en el inventario principal.`);
                return;
            }
            if (quantity > mainInventoryItem.cantidad) {
                _showMessageModal(`Error: No hay suficiente stock de ${mainInventoryItem.producto} (${mainInventoryItem.cantidad}) en el inventario principal para cargar ${quantity}.`);
                return;
            }
            itemsToLoad.push({ sku, quantity, product: mainInventoryItem.producto, presentacion: mainInventoryItem.presentacion, price: mainInventoryItem.precio });
        }
    }

    if (itemsToLoad.length === 0) {
        _showMessageModal('No se ha ingresado ninguna cantidad para cargar.');
        return;
    }

    try {
        const batch = _db.batch();

        // 1. Update Main Inventory
        const updatedMainInventory = JSON.parse(JSON.stringify(_inventory));
        itemsToLoad.forEach(itemToLoad => {
            const mainItemIndex = updatedMainInventory.findIndex(item => item.sku === itemToLoad.sku);
            if (mainItemIndex !== -1) {
                updatedMainInventory[mainItemIndex].cantidad -= itemToLoad.quantity;
                batch.update(_db.collection('inventory').doc(itemToLoad.sku), { cantidad: updatedMainInventory[mainItemIndex].cantidad });
            }
        });
        _inventory.splice(0, _inventory.length, ...updatedMainInventory); // Update global inventory in place

        // 2. Update Truck Inventory
        let currentTruckItems = JSON.parse(JSON.stringify(selectedTruckInventoryForReceiving));
        itemsToLoad.forEach(itemToLoad => {
            const truckItemIndex = currentTruckItems.findIndex(item => item.sku === itemToLoad.sku);
            if (truckItemIndex !== -1) {
                currentTruckItems[truckItemIndex].quantity += itemToLoad.quantity;
            } else {
                currentTruckItems.push({
                    sku: itemToLoad.sku,
                    product: itemToLoad.product,
                    presentacion: itemToLoad.presentacion,
                    quantity: itemToLoad.quantity,
                    price: itemToLoad.price
                });
            }
        });
        batch.set(_db.collection('truck_inventories').doc(selectedTruckForReceiving), { items: currentTruckItems });
        selectedTruckInventoryForReceiving = currentTruckItems; // Update local state

        // 3. Record Load History
        const loadRecord = {
            date: getCurrentDateFormatted(),
            truckPlate: selectedTruckForReceiving,
            loader: selectedLoader,
            items: itemsToLoad,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        batch.add(_db.collection('loadRecords'), loadRecord);

        await batch.commit();
        _showMessageModal('Mercancía cargada exitosamente.');

        // Reset state after successful load
        selectedTruckForReceiving = null;
        selectedLoader = null;
        receivingQuantities = {};
        selectedTruckInventoryForReceiving = [];

        await _fetchDataFromFirestore(); // Re-fetch all data to ensure consistency
        _setScreenAndRender('cargaSelection');
    } catch (error) {
        console.error('Error al cargar mercancía:', error);
        _showMessageModal('Error al cargar mercancía. Revisa tu conexión y las reglas de seguridad.');
    }
};

export const renderLoadHistoryScreen = async () => {
    if (!_isAdmin()) { _showMessageModal('Acceso denegado: Solo los administradores pueden acceder a esta función.'); _setScreenAndRender('main'); return; }
    console.log('[Inventory Management] Rendering load history screen.');
    try {
        const snapshot = await _db.collection('loadRecords').orderBy('createdAt', 'desc').get();
        loadRecords = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error('Error fetching load history:', error);
        _showMessageModal('Error al cargar el historial de cargas. Revisa tu conexión y las reglas de seguridad.');
        loadRecords = []; // Fallback to empty array on error
    }

    const loadRows = loadRecords.map(record => {
        const itemsSummary = record.items.map(item => `${item.product} (${item.quantity})`).join(', ');
        return `
            <tr>
                <td>${record.date}</td>
                <td>${record.truckPlate}</td>
                <td>${record.loader}</td>
                <td>${itemsSummary}</td>
                <td>
                    ${_createButton('Descargar CSV', '', 'bg-blue-500 hover:bg-blue-600 text-white py-1 px-2 rounded-md text-sm download-load-csv-button', { recordid: record.id })}
                </td>
            </tr>
        `;
    }).join('');

    document.getElementById('app-root').innerHTML = `
        <div class="screen-container bg-white rounded-xl m-2 shadow-md">
            <h2 class="text-2xl font-bold mb-5 text-center text-indigo-700">HISTORIAL DE CARGAS</h2>
            <div class="table-container mb-5">
                ${_createTable(['Fecha', 'Camión', 'Cargador', 'Artículos Cargados', 'Acciones'], loadRows, 'load-history-table-body')}
            </div>
            <div class="flex justify-center mb-6 gap-4">
                ${_createButton('Borrar Historial de Cargas', 'clearLoadHistoryButton', 'bg-red-600')}
            </div>
            ${_createButton('Volver a Selección de Carga', 'backToCargaSelectionFromLoadHistoryButton', 'bg-gray-600 mt-5 w-full')}
        </div>
    `;
};

export const showClearLoadHistoryConfirmation = () => {
    _showConfirmationModal('¿Estás seguro de que quieres borrar TODO el historial de cargas? Esta acción es irreversible.', clearLoadHistory);
};

const clearLoadHistory = async () => {
    try {
        const batch = _db.batch();
        const snapshot = await _db.collection('loadRecords').get();
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        _showMessageModal('Historial de cargas borrado exitosamente.');
        loadRecords = []; // Clear local state
        _setScreenAndRender('loadHistory'); // Re-render to show empty history
    } catch (error) {
        console.error('Error al borrar historial de cargas:', error);
        _showMessageModal('Error al borrar historial de cargas. Revisa tu conexión y las reglas de seguridad.');
    }
};

export const downloadExistingCSV = (filename) => {
    let csvContent = '';
    if (filename.startsWith('carga_')) {
        const recordId = filename.replace('carga_', '').replace('.csv', '');
        const record = loadRecords.find(r => r.id === recordId);
        if (record) {
            const headers = ['SKU', 'Producto', 'Presentacion', 'Cantidad'];
            const dataToDownload = record.items.map(item => ({
                SKU: item.sku,
                Producto: item.product,
                Presentacion: item.presentacion,
                Cantidad: item.quantity
            }));
            csvContent = toCSV(dataToDownload, headers);
            triggerCSVDownload(filename, csvContent);
        } else {
            _showMessageModal(`No se encontró el registro de carga para descargar: ${filename}`);
        }
    } else if (filename.startsWith('traslado_')) {
        const recordId = filename.replace('traslado_', '').replace('.csv', '');
        const record = transferRecords.find(r => r.id === recordId);
        if (record) {
            const headers = ['SKU', 'Producto', 'Presentacion', 'Cantidad'];
            const dataToDownload = record.items.map(item => ({
                SKU: item.sku,
                Producto: item.product,
                Presentacion: item.presentacion,
                Cantidad: item.quantity
            }));
            csvContent = toCSV(dataToDownload, headers);
            triggerCSVDownload(filename, csvContent);
        } else {
            _showMessageModal(`No se encontró el registro de transbordo para descargar: ${filename}`);
        }
    } else if (filename === 'inventario.csv') {
        const headers = ['Rubro', 'SKU', 'Segmento', 'Producto', 'Presentacion', 'Cantidad', 'Precio'];
        const dataToDownload = _inventory.map(item => ({
            Rubro: item.rubro,
            SKU: item.sku,
            Segmento: item.segmento,
            Producto: item.producto,
            Presentacion: item.presentacion,
            Cantidad: item.cantidad,
            Precio: item.precio
        }));
        csvContent = toCSV(dataToDownload, headers);
        triggerCSVDownload(filename, csvContent);
    } else if (filename === 'vehiculos.csv') {
        const headers = ['Plate', 'Name', 'Brand', 'Model'];
        const dataToDownload = _vehicles.map(v => ({
            Plate: v.plate,
            Name: v.name,
            Brand: v.brand,
            Model: v.model
        }));
        csvContent = toCSV(dataToDownload, headers);
        triggerCSVDownload(filename, csvContent);
    } else {
        _showMessageModal(`Tipo de archivo no reconocido para descarga: ${filename}`);
    }
};

export const renderInventarioScreen = () => {
    console.log('[Inventory Management] Rendering user inventory screen.');
    if (!_isUser() || !_currentUserData.assignedTruckPlate) {
        document.getElementById('app-root').innerHTML = `
            <div class="screen-container bg-white rounded-xl m-2 shadow-md">
                <h2 class="text-2xl font-bold mb-5 text-center text-indigo-700">INVENTARIO DE CAMIÓN</h2>
                <p class="text-center text-gray-600 my-5">No tienes un camión asignado o no eres un usuario válido.</p>
                <p class="text-center text-gray-600 my-5">Por favor, contacta a un administrador para que te asigne uno.</p>
                ${_createButton('Volver al Menú Principal', 'backToMainFromUserInventoryButton', 'bg-gray-600 mt-5 w-full')}
            </div>
        `;
        return;
    }

    const truckPlate = _currentUserData.assignedTruckPlate;
    const inventoryToDisplay = currentTruckInventory.filter(item => {
        const matchesSearch = inventorySearchTermUser === '' ||
            item.product.toLowerCase().includes(inventorySearchTermUser.toLowerCase()) ||
            item.sku.toLowerCase().includes(inventorySearchTermUser.toLowerCase());
        return matchesSearch;
    });

    const inventoryRows = inventoryToDisplay.map(item => `
        <tr>
            <td><img src="${_productImages[item.sku] || _productImages['default']}" alt="Imagen de ${item.product}" class="w-10 h-10 rounded-md object-cover"></td>
            <td>${item.sku}</td>
            <td>${item.product}</td>
            <td>${item.presentacion}</td>
            <td>${item.quantity}</td>
            <td>$${item.price.toFixed(2)}</td>
        </tr>
    `).join('');

    document.getElementById('app-root').innerHTML = `
        <div class="screen-container bg-white rounded-xl m-2 shadow-md">
            <h2 class="text-2xl font-bold mb-5 text-center text-indigo-700">INVENTARIO DE CAMIÓN</h2>
            <p class="text-lg font-bold text-center mb-4 text-gray-800">Camión Asignado: ${truckPlate}</p>
            <div class="mb-4">
                ${_createInput('inventorySearchInputUser', 'Buscar por producto o SKU...', inventorySearchTermUser, 'text', false, 'w-full')}
            </div>
            <div class="table-container mb-5">
                ${_createTable(['Imagen', 'SKU', 'Producto', 'Presentación', 'Cantidad', 'Precio'], inventoryRows, 'user-inventory-table-body')}
            </div>
            ${_createButton('Volver al Menú Principal', 'backToMainFromUserInventoryButton', 'bg-gray-600 mt-5 w-full')}
        </div>
    `;
};

export const filterInventoryForUserScreen = (searchTerm) => {
    inventorySearchTermUser = searchTerm;
    _setScreenAndRender('inventario'); // Re-render the inventory screen with filtered results
};

export const setupTruckInventoryListener = () => {
    if (_truckInventoryUnsubscribe) {
        _truckInventoryUnsubscribe(); // Unsubscribe from any existing listener
        _truckInventoryUnsubscribe = null;
        console.log('[Firestore Listener] Existing user truck inventory listener unsubscribed.');
    }

    if (_isUser() && _currentUserData.assignedTruckPlate) {
        const truckPlate = _currentUserData.assignedTruckPlate;
        console.log(`[Firestore Listener] Setting up real-time listener for truck inventory: ${truckPlate}`);
        _truckInventoryUnsubscribe = _db.collection('truck_inventories').doc(truckPlate)
            .onSnapshot(docSnapshot => {
                if (docSnapshot.exists) {
                    const data = docSnapshot.data();
                    setCurrentTruckInventory(data.items || []);
                    console.log(`[Firestore Listener] Real-time update for truck ${truckPlate}:`, currentTruckInventory.length, 'items');
                } else {
                    setCurrentTruckInventory([]);
                    console.log(`[Firestore Listener] Truck ${truckPlate} inventory document does not exist.`);
                }
                // Only re-render if the current screen is 'inventario' or 'venta' to avoid unnecessary renders
                const currentScreen = document.getElementById('app-root').dataset.currentScreen;
                if (currentScreen === 'inventario' || currentScreen === 'venta') {
                    _setScreenAndRender(currentScreen);
                }
            }, error => {
                console.error('[Firestore Listener] Error listening to truck inventory:', error);
                _showMessageModal('Error de conexión en tiempo real con el inventario del camión.');
            });
    } else {
        console.log('[Firestore Listener] Not setting up user truck inventory listener: Not a user or no truck assigned.');
    }
};


export const renderAdminInventorySelection = () => {
    if (!_isAdmin()) { _showMessageModal('Acceso denegado: Solo los administradores pueden acceder a esta sección.'); _setScreenAndRender('main'); return; }
    document.getElementById('app-root').innerHTML = `
        <div class="screen-container bg-white rounded-xl m-2 shadow-md">
            <h2 class="text-2xl font-bold mb-5 text-center text-indigo-700">SELECCIÓN DE INVENTARIO (ADMIN)</h2>
            <p class="text-base text-center my-5 text-gray-600">Selecciona el tipo de inventario que deseas gestionar.</p>
            <div class="flex flex-wrap justify-center gap-4">
                ${_createButton('INVENTARIO PRINCIPAL', 'adminMainInventoryButton', 'bg-indigo-600')}
                ${_createButton('INVENTARIO POR VEHÍCULO', 'adminVehicleInventoryButton', 'bg-indigo-600')}
            </div>
            ${_createButton('Volver al Menú Principal', 'backToMainFromAdminInventorySelection', 'bg-gray-600 mt-5 w-full')}
        </div>
    `;
};

export const renderAdminMainInventoryScreen = () => {
    if (!_isAdmin()) { _showMessageModal('Acceso denegado: Solo los administradores pueden acceder a esta función.'); _setScreenAndRender('main'); return; }
    console.log('[Inventory Management] Rendering admin main inventory screen.');

    const inventoryRows = _inventory.map(item => `
        <tr>
            <td><img src="${_productImages[item.sku] || _productImages['default']}" alt="Imagen de ${item.producto}" class="w-10 h-10 rounded-md object-cover"></td>
            <td>${item.sku}</td>
            <td>${item.producto}</td>
            <td>${item.presentacion}</td>
            <td>${item.cantidad}</td>
            <td>$${item.precio.toFixed(2)}</td>
        </tr>
    `).join('');

    document.getElementById('app-root').innerHTML = `
        <div class="screen-container bg-white rounded-xl m-2 shadow-md">
            <h2 class="text-2xl font-bold mb-5 text-center text-indigo-700">INVENTARIO PRINCIPAL (ALMACÉN)</h2>
            <div class="table-container mb-5">
                ${_createTable(['Imagen', 'SKU', 'Producto', 'Presentación', 'Cantidad', 'Precio'], inventoryRows, 'admin-main-inventory-table-body')}
            </div>
            ${_createButton('Volver a Selección de Inventario', 'backToAdminInventorySelectionButton', 'bg-gray-600 mt-5 w-full')}
        </div>
    `;
};

export const renderAdminVehicleInventoryScreen = () => {
    if (!_isAdmin()) { _showMessageModal('Acceso denegado: Solo los administradores pueden acceder a esta función.'); _setScreenAndRender('main'); return; }
    console.log('[Inventory Management] Rendering admin vehicle inventory screen.');

    const vehicleOptions = _vehicles.map(v => ({ value: v.plate, text: `${v.name} (${v.plate})` }));

    // Fetch all truck inventories to display in the dropdown
    const fetchAllTruckInventories = async () => {
        try {
            const snapshot = await _db.collection('truck_inventories').get();
            allTruckInventories = {}; // Reset
            snapshot.docs.forEach(doc => {
                allTruckInventories[doc.id] = doc.data().items || [];
            });
            console.log('[Inventory Management] All truck inventories fetched:', Object.keys(allTruckInventories).length, 'trucks');
            // If a truck was previously selected, ensure its listener is active
            if (selectedAdminVehicleForInventory) {
                setupAdminTruckInventoryListener(selectedAdminVehicleForInventory);
            }
            _setScreenAndRender('adminVehicleInventory'); // Re-render after fetching all truck inventories
        } catch (error) {
            console.error('Error fetching all truck inventories:', error);
            _showMessageModal('Error al cargar inventarios de camiones. Revisa tu conexión y las reglas de seguridad.');
            allTruckInventories = {};
        }
    };

    // Call fetchAllTruckInventories if it hasn't been called or if data is stale
    if (Object.keys(allTruckInventories).length === 0) {
        fetchAllTruckInventories();
    }

    const currentVehicleInventory = selectedAdminVehicleForInventory ? (allTruckInventories[selectedAdminVehicleForInventory] || []) : [];

    const inventoryRows = currentVehicleInventory.map(item => `
        <tr>
            <td><img src="${_productImages[item.sku] || _productImages['default']}" alt="Imagen de ${item.product}" class="w-10 h-10 rounded-md object-cover"></td>
            <td>${item.sku}</td>
            <td>${item.product}</td>
            <td>${item.presentacion}</td>
            <td>${item.quantity}</td>
            <td>$${item.price.toFixed(2)}</td>
        </tr>
    `).join('');

    document.getElementById('app-root').innerHTML = `
        <div class="screen-container bg-white rounded-xl m-2 shadow-md">
            <h2 class="text-2xl font-bold mb-5 text-center text-indigo-700">INVENTARIO POR VEHÍCULO (ADMIN)</h2>
            <div class="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-300">
                <label for="adminVehicleSelect" class="block text-gray-700 text-sm font-bold mb-2">Seleccionar Vehículo:</label>
                ${_createSelect('adminVehicleSelect', vehicleOptions, selectedAdminVehicleForInventory || '', 'w-full')}
            </div>
            <div class="table-container mb-5">
                ${currentVehicleInventory.length > 0 ? _createTable(['Imagen', 'SKU', 'Producto', 'Presentación', 'Cantidad', 'Precio'], inventoryRows, 'admin-vehicle-inventory-table-body') : '<p class="text-center text-gray-500">Selecciona un vehículo para ver su inventario o no hay inventario para este vehículo.</p>'}
            </div>
            ${_createButton('Volver a Selección de Inventario', 'backToAdminInventorySelectionFromVehicleInventoryButton', 'bg-gray-600 mt-5 w-full')}
        </div>
    `;
};

export const handleAdminVehicleSelection = (truckPlate) => {
    selectedAdminVehicleForInventory = truckPlate;
    setupAdminTruckInventoryListener(truckPlate); // Setup listener for the newly selected truck
    _setScreenAndRender('adminVehicleInventory'); // Re-render to show selected truck's inventory
};

export const setupAdminTruckInventoryListener = (truckPlate) => {
    if (_adminTruckInventoryUnsubscribe) {
        _adminTruckInventoryUnsubscribe(); // Unsubscribe from any existing listener
        _adminTruckInventoryUnsubscribe = null;
        console.log('[Firestore Listener] Existing admin truck inventory listener unsubscribed.');
    }

    if (truckPlate) {
        console.log(`[Firestore Listener] Setting up real-time listener for admin truck inventory: ${truckPlate}`);
        _adminTruckInventoryUnsubscribe = _db.collection('truck_inventories').doc(truckPlate)
            .onSnapshot(docSnapshot => {
                if (docSnapshot.exists) {
                    const data = docSnapshot.data();
                    allTruckInventories[truckPlate] = data.items || [];
                    console.log(`[Firestore Listener] Real-time update for admin truck ${truckPlate}:`, allTruckInventories[truckPlate].length, 'items');
                } else {
                    allTruckInventories[truckPlate] = [];
                    console.log(`[Firestore Listener] Admin truck ${truckPlate} inventory document does not exist.`);
                }
                // Only re-render if the current screen is 'adminVehicleInventory'
                const currentScreen = document.getElementById('app-root').dataset.currentScreen;
                if (currentScreen === 'adminVehicleInventory') {
                    _setScreenAndRender(currentScreen);
                }
            }, error => {
                console.error('[Firestore Listener] Error listening to admin truck inventory:', error);
                _showMessageModal('Error de conexión en tiempo real con el inventario del camión (Admin).');
            });
    } else {
        console.log('[Firestore Listener] Not setting up admin truck inventory listener: No truck selected.');
    }
};


export const renderVehiclesScreen = () => {
    if (!_isAdmin()) { _showMessageModal('Acceso denegado: Solo los administradores pueden acceder a esta función.'); _setScreenAndRender('main'); return; }
    console.log('[Inventory Management] Rendering vehicles screen.');

    const vehicleOptions = _vehicles.map(vehicle => ({
        value: vehicle.plate,
        text: `${vehicle.name} (${vehicle.plate}) - ${vehicle.brand} ${vehicle.model}`
    }));

    // Filtered list for display below the dropdown
    const filteredVehicles = _vehicles.filter(vehicle =>
        vehiclesSearchTerm === '' ||
        vehicle.name.toLowerCase().includes(vehiclesSearchTerm.toLowerCase()) ||
        vehicle.plate.toLowerCase().includes(vehiclesSearchTerm.toLowerCase()) ||
        vehicle.brand.toLowerCase().includes(vehiclesSearchTerm.toLowerCase()) ||
        vehicle.model.toLowerCase().includes(vehiclesSearchTerm.toLowerCase())
    );

    document.getElementById('app-root').innerHTML = `
        <div class="screen-container bg-white rounded-xl m-2 shadow-md">
            <h2 class="text-2xl font-bold mb-5 text-center text-indigo-700">GESTIÓN DE VEHÍCULOS</h2>
            <div class="flex justify-center mb-6 gap-4">
                ${_createButton('Agregar Nuevo Vehículo', 'addVehicleButton', 'bg-emerald-600')}
            </div>

            <h3 class="text-xl font-bold mb-4 text-gray-700">Lista de Vehículos</h3>
            <div class="mb-4">
                ${_createSearchableDropdown('vehicleListSearch', 'Buscar vehículo por placa, nombre, marca o modelo...', vehicleOptions, vehiclesSearchTerm, (value) => { vehiclesSearchTerm = value; _setScreenAndRender('vehicles'); }, 'text')}
            </div>

            <div id="vehicles-list-display" class="grid grid-cols-1 md:grid-cols-2 gap-4">
                ${filteredVehicles.length === 0 ? '<p class="text-center text-gray-500 col-span-full">No hay vehículos registrados o no coinciden con la búsqueda.</p>' :
                    filteredVehicles.map(vehicle => {
                        const assignedUser = _users.find(u => u.assignedTruckPlate === vehicle.plate);
                        return `
                            <div class="bg-gray-100 p-4 rounded-lg shadow-sm border border-gray-200">
                                <p class="font-semibold text-lg text-indigo-800">${vehicle.name} (${vehicle.plate})</p>
                                <p class="text-sm text-gray-600">Marca: ${vehicle.brand}</p>
                                <p class="text-sm text-gray-600">Modelo: ${vehicle.model}</p>
                                <p class="text-sm text-gray-600">Asignado a: ${assignedUser ? assignedUser.email : 'N/A'}</p>
                                <div class="flex justify-end gap-2 mt-3">
                                    ${_createButton('Editar', '', 'bg-yellow-500 hover:bg-yellow-600 text-white py-1 px-3 rounded-md text-sm edit-vehicle-button', { plate: vehicle.plate })}
                                    ${_createButton('Eliminar', '', 'bg-red-500 hover:bg-red-600 text-white py-1 px-3 rounded-md text-sm delete-vehicle-button', { plate: vehicle.plate })}
                                </div>
                            </div>
                        `;
                    }).join('')
                }
            </div>

            ${_createButton('Volver al Menú Principal', 'backToMainFromVehiclesButton', 'bg-gray-600 mt-5 w-full')}
        </div>
    `;
};

export const handleVehicleSearch = (term) => {
    vehiclesSearchTerm = term;
    _setScreenAndRender('vehicles'); // Re-render to update the filtered list
};

export const selectVehicleFromDropdown = (plate) => {
    vehiclesSearchTerm = plate; // Set the search term to the selected plate to filter the list
    _setScreenAndRender('vehicles');
};


// State for editing vehicle
let editingVehicle = null;

export const handleAddVehicle = () => {
    editingVehicle = { plate: '', name: '', brand: '', model: '' };
    renderEditVehicleModal();
};

export const editVehicle = (plate) => {
    editingVehicle = _vehicles.find(v => v.plate === plate);
    renderEditVehicleModal();
};

export const cancelEditVehicle = () => {
    editingVehicle = null;
    _setScreenAndRender('vehicles'); // Re-render to close modal
};

export const renderEditVehicleModal = () => {
    if (!editingVehicle) return '';
    const isNew = !editingVehicle.plate;
    const modalHtml = `
        <div id="edit-vehicle-modal" class="modal">
            <div class="modal-content">
                <h3 class="text-2xl font-bold mb-4 text-center text-indigo-700">${isNew ? 'Agregar Nuevo Vehículo' : 'Editar Vehículo'}</h3>
                ${_createInput('vehiclePlate', 'Placa', editingVehicle.plate, 'text', !isNew)}
                ${_createInput('vehicleName', 'Nombre', editingVehicle.name)}
                ${_createInput('vehicleBrand', 'Marca', editingVehicle.brand)}
                ${_createInput('vehicleModel', 'Modelo', editingVehicle.model)}
                <div class="flex justify-around gap-4 mt-5">
                    ${_createButton('Guardar Vehículo', 'saveEditedVehicleButton', 'bg-emerald-600 flex-1')}
                    ${_createButton('Cancelar', 'cancelEditVehicleButton', 'bg-gray-600 flex-1')}
                </div>
            </div>
        </div>
    `;
    // Append modal to app-root, then call render to update the main screen
    const appRoot = document.getElementById('app-root');
    if (appRoot) {
        const existingModal = document.getElementById('edit-vehicle-modal');
        if (existingModal) existingModal.remove(); // Remove old modal if exists
        appRoot.insertAdjacentHTML('beforeend', modalHtml);
    }
};

export const saveEditedVehicle = async () => {
    const isNew = !editingVehicle.plate;
    const vehicleData = {
        plate: document.getElementById('vehiclePlate').value.trim(),
        name: document.getElementById('vehicleName').value.trim(),
        brand: document.getElementById('vehicleBrand').value.trim(),
        model: document.getElementById('vehicleModel').value.trim(),
    };

    if (!vehicleData.plate || !vehicleData.name) {
        _showMessageModal('Placa y Nombre son campos obligatorios.');
        return;
    }

    if (isNew && _vehicles.some(v => v.plate === vehicleData.plate)) {
        _showMessageModal('Ya existe un vehículo con esta placa.');
        return;
    }

    try {
        if (isNew) {
            await _db.collection('vehicles').doc(vehicleData.plate).set(vehicleData);
            _vehicles.push(vehicleData);
        } else {
            await _db.collection('vehicles').doc(editingVehicle.plate).update(vehicleData);
            const index = _vehicles.findIndex(v => v.plate === editingVehicle.plate);
            if (index !== -1) _vehicles[index] = vehicleData;
        }
        _showMessageModal('Vehículo guardado exitosamente.');
        editingVehicle = null; // Close modal
        await _fetchDataFromFirestore(); // Re-fetch to update vehicles array in main scope
        _setScreenAndRender('vehicles'); // Re-render the vehicle list
    } catch (error) {
        console.error('Error al guardar vehículo:', error);
        _showMessageModal('Error al guardar vehículo. Revisa tu conexión y reglas de seguridad.');
    }
};

export const showDeleteVehicleConfirmation = (plate) => {
    _showConfirmationModal(`¿Estás seguro de que quieres eliminar el vehículo con placa ${plate}? Esto también eliminará su inventario asociado.`, () => deleteVehicle(plate));
};

const deleteVehicle = async (plate) => {
    try {
        const batch = _db.batch();
        batch.delete(_db.collection('vehicles').doc(plate));
        batch.delete(_db.collection('truck_inventories').doc(plate)); // Also delete associated truck inventory
        await batch.commit();
        _vehicles = _vehicles.filter(v => v.plate !== plate);
        _showMessageModal('Vehículo y su inventario asociado eliminados exitosamente.');
        await _fetchDataFromFirestore(); // Re-fetch to update vehicles array in main scope
        _setScreenAndRender('vehicles'); // Re-render the vehicle list
    } catch (error) {
        console.error('Error al eliminar vehículo:', error);
        _showMessageModal('Error al eliminar vehículo. Revisa tu conexión y reglas de seguridad.');
    }
};

export const renderAssignVehicleScreen = () => {
    if (!_isAdmin()) { _showMessageModal('Acceso denegado: Solo los administradores pueden acceder a esta función.'); _setScreenAndRender('main'); return; }
    console.log('[Inventory Management] Rendering assign vehicle screen.');

    const vehicleOptions = _vehicles.map(v => ({ value: v.plate, text: `${v.name} (${v.plate})` }));

    const usersHtml = Array.isArray(_users) && _users.length > 0 ? _users.map(user => {
        // Find the vehicle currently assigned to this user
        const currentAssignedVehicle = _vehicles.find(v => v.plate === user.assignedTruckPlate);
        const currentAssignedVehicleText = currentAssignedVehicle ? `${currentAssignedVehicle.name} (${currentAssignedVehicle.plate})` : '';

        return `
            <tr>
                <td>${user.email}</td>
                <td>${user.role}</td>
                <td>
                    <div id="assignTruckDropdown-${user.uid}" class="w-full">
                        ${_createSearchableDropdown(
                            `assignTruck-${user.uid}`,
                            'Buscar y asignar vehículo...',
                            vehicleOptions,
                            user.assignedTruckPlate || '', // Pass the currently assigned plate as selectedValue
                            (selectedPlate) => handleAssignVehicle(user.uid, selectedPlate),
                            'text'
                        )}
                    </div>
                </td>
            </tr>
        `;
    }).join('') : `<tr><td colspan="3" class="text-center text-gray-500 py-4">No hay usuarios para asignar vehículos.</td></tr>`;


    document.getElementById('app-root').innerHTML = `
        <div class="screen-container bg-white rounded-xl m-2 shadow-md">
            <h2 class="text-2xl font-bold mb-5 text-center text-indigo-700">ASIGNAR VEHÍCULO A USUARIO</h2>
            <div class="table-container mb-5">
                ${_createTable(['Usuario', 'Rol', 'Vehículo Asignado'], usersHtml, 'assign-vehicle-table-body')}
            </div>
            ${_createButton('Volver al Menú Principal', 'backToMainFromAssignVehicleButton', 'bg-gray-600 mt-5 w-full')}
        </div>
    `;
};

// This function is now called by the searchable dropdown's onSelectCallback
export const handleAssignVehicle = async (userId, newTruckPlate) => {
    if (!userId) {
        _showMessageModal('Error: ID de usuario no encontrado.');
        return;
    }

    try {
        const batch = _db.batch();

        // Get current user and vehicle data to handle unassignments
        const userDocRef = _db.collection('users').doc(userId);
        const userDoc = await userDocRef.get();
        const userData = userDoc.data();
        const oldAssignedTruckPlate = userData.assignedTruckPlate;

        // If the user was previously assigned to a different truck, unassign that truck
        if (oldAssignedTruckPlate && oldAssignedTruckPlate !== newTruckPlate) {
            const oldVehicleRef = _db.collection('vehicles').doc(oldAssignedTruckPlate);
            batch.update(oldVehicleRef, { assignedUser: null });
        }

        // If the new truck is already assigned to another user, unassign that user
        if (newTruckPlate) {
            const existingAssignment = _users.find(u => u.assignedTruckPlate === newTruckPlate && u.uid !== userId);
            if (existingAssignment) {
                const otherUserRef = _db.collection('users').doc(existingAssignment.uid);
                batch.update(otherUserRef, { assignedTruckPlate: null });
                _showMessageModal(`El camión ${newTruckPlate} ya estaba asignado a ${existingAssignment.email}. Se ha desasignado de ese usuario.`);
            }
            // Assign the new truck to the current user
            const newVehicleRef = _db.collection('vehicles').doc(newTruckPlate);
            batch.update(newVehicleRef, { assignedUser: userId });
        }

        // Update the user's assignedTruckPlate
        batch.update(userDocRef, { assignedTruckPlate: newTruckPlate || null }); // Set to null if unassigning

        await batch.commit();
        _showMessageModal('Vehículo asignado/desasignado exitosamente.');
        await _fetchDataFromFirestore(); // Re-fetch users and vehicles to update local state
        _setScreenAndRender('assignVehicle'); // Re-render to show updated assignment
    } catch (error) {
        console.error('Error al asignar vehículo:', error);
        _showMessageModal('Error al asignar vehículo. Revisa tu conexión y reglas de seguridad.');
    }
};


export const renderResetCargasInicialesPasswordScreen = () => {
    if (!_isAdmin()) { _showMessageModal('Acceso denegado: Solo los administradores pueden acceder a esta función.'); _setScreenAndRender('main'); return; }
    document.getElementById('app-root').innerHTML = `
        <div class="screen-container bg-white rounded-xl m-2 shadow-md max-w-md mx-auto my-10">
            <h2 class="text-2xl font-bold mb-5 text-center text-red-700">RESET DE CARGAS INICIALES</h2>
            <p class="text-base text-center my-5 text-gray-600">Esta es una operación sensible. Por favor, ingresa tu contraseña de administrador para continuar.</p>
            ${_createInput('adminPasswordForReset', 'Contraseña de Administrador', '', 'password')}
            ${_createButton('Verificar Contraseña', 'adminPasswordForResetButton', 'bg-red-600 w-full')}
            ${_createButton('Cancelar', 'cancelAndBackToCargaSelectionButton', 'bg-gray-600 mt-5 w-full')}
        </div>
    `;
};

export const handleResetCargasInicialesPassword = async () => {
    const password = document.getElementById('adminPasswordForReset').value;
    if (!password) {
        _showMessageModal('Por favor, ingresa tu contraseña.');
        return;
    }

    try {
        const credential = firebase.auth.EmailAuthProvider.credential(_currentUserData.email, password);
        await firebase.auth().currentUser.reauthenticateWithCredential(credential);
        _setScreenAndRender('resetCargasInicialesEdit');
    } catch (error) {
        console.error('Error al reautenticar:', error);
        _showMessageModal(`Error de autenticación: ${error.message}. Contraseña incorrecta o sesión expirada.`);
    }
};

export const renderResetCargasInicialesEditScreen = () => {
    if (!_isAdmin()) { _showMessageModal('Acceso denegado: Solo los administradores pueden acceder a esta función.'); _setScreenAndRender('main'); return; }
    console.log('[Inventory Management] Rendering reset initial loads edit screen.');

    const mainInventoryRows = _inventory.map(item => `
        <tr>
            <td><img src="${_productImages[item.sku] || _productImages['default']}" alt="Imagen de ${item.producto}" class="w-10 h-10 rounded-md object-cover"></td>
            <td>${item.sku}</td>
            <td>${item.producto}</td>
            <td>${item.presentacion}</td>
            <td><input type="number" class="border border-gray-300 rounded-md text-center reset-quantity-input-main" value="${item.cantidad}" data-sku="${item.sku}" min="0"></td>
            <td>$${item.precio.toFixed(2)}</td>
        </tr>
    `).join('');

    const allTrucksHtml = _vehicles.map(vehicle => {
        const truckInventory = allTruckInventories[vehicle.plate] || [];
        const truckInventoryRows = truckInventory.map(item => `
            <tr>
                <td><img src="${_productImages[item.sku] || _productImages['default']}" alt="Imagen de ${item.product}" class="w-10 h-10 rounded-md object-cover"></td>
                <td>${item.sku}</td>
                <td>${item.product}</td>
                <td>${item.presentacion}</td>
                <td><input type="number" class="border border-gray-300 rounded-md text-center reset-quantity-input-truck" value="${item.quantity}" data-sku="${item.sku}" data-truckplate="${vehicle.plate}" min="0"></td>
                <td>$${item.price.toFixed(2)}</td>
            </tr>
        `).join('');
        return `
            <div class="mb-6 p-4 bg-yellow-50 rounded-lg border border-yellow-300">
                <h3 class="text-xl font-bold mb-4 text-yellow-700">Inventario de Camión: ${vehicle.name} (${vehicle.plate})</h3>
                ${_createTable(['Imagen', 'SKU', 'Producto', 'Presentación', 'Cantidad', 'Precio'], truckInventoryRows, `truck-inventory-table-body-${vehicle.plate}`)}
            </div>
        `;
    }).join('');

    document.getElementById('app-root').innerHTML = `
        <div class="screen-container bg-white rounded-xl m-2 shadow-md">
            <h2 class="text-2xl font-bold mb-5 text-center text-red-700">EDITAR CARGAS INICIALES</h2>
            <p class="text-base text-center my-5 text-gray-600">Modifica las cantidades iniciales de inventario para el almacén principal y los camiones.</p>

            <div class="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-300">
                <h3 class="text-xl font-bold mb-4 text-blue-700">Inventario Principal (Almacén)</h3>
                ${_createTable(['Imagen', 'SKU', 'Producto', 'Presentación', 'Cantidad', 'Precio'], mainInventoryRows, 'main-inventory-table-body')}
            </div>

            ${allTrucksHtml}

            <div class="flex justify-around gap-4 mt-5">
                ${_createButton('Guardar Cambios', 'saveResetCargasInicialesButton', 'bg-emerald-600 flex-1')}
                ${_createButton('Cancelar', 'cancelResetCargasInicialesButton', 'bg-gray-600 flex-1')}
            </div>
        </div>
    `;
};

export const handleResetQuantityChange = (sku, type, quantity, truckPlate = null) => {
    const parsedQuantity = parseInt(quantity) || 0;
    if (type === 'main') {
        resetQuantities[`main_${sku}`] = parsedQuantity;
    } else if (type === 'truck' && truckPlate) {
        resetQuantities[`truck_${truckPlate}_${sku}`] = parsedQuantity;
    }
    console.log('[handleResetQuantityChange] resetQuantities:', resetQuantities);
};

export const saveResetCargasIniciales = async () => {
    try {
        const batch = _db.batch();

        // Update main inventory
        const updatedMainInventory = JSON.parse(JSON.stringify(_inventory));
        for (const item of updatedMainInventory) {
            const newQuantity = resetQuantities[`main_${item.sku}`];
            if (newQuantity !== undefined) {
                item.cantidad = newQuantity;
                batch.set(_db.collection('inventory').doc(item.sku), item);
            }
        }
        _inventory.splice(0, _inventory.length, ...updatedMainInventory.filter(item => item.cantidad > 0)); // Update global inventory in place

        // Update truck inventories
        for (const truckPlate in allTruckInventories) {
            let currentTruckItems = JSON.parse(JSON.stringify(allTruckInventories[truckPlate]));
            let truckInventoryChanged = false;

            // Update existing items in the truck
            currentTruckItems = currentTruckItems.map(item => {
                const newQuantity = resetQuantities[`truck_${truckPlate}_${item.sku}`];
                if (newQuantity !== undefined) {
                    truckInventoryChanged = true;
                    return { ...item, quantity: newQuantity };
                }
                return item;
            });

            // Add new items to the truck (from main inventory if they were added via resetQuantities)
            for (const sku in resetQuantities) {
                if (sku.startsWith(`truck_${truckPlate}_`)) {
                    const itemSku = sku.replace(`truck_${truckPlate}_`, '');
                    const newQuantity = resetQuantities[sku];
                    if (newQuantity > 0 && !currentTruckItems.some(item => item.sku === itemSku)) {
                        const productDetails = _inventory.find(mainItem => mainItem.sku === itemSku);
                        if (productDetails) {
                            currentTruckItems.push({
                                sku: productDetails.sku,
                                product: productDetails.producto,
                                presentacion: productDetails.presentacion,
                                quantity: newQuantity,
                                price: productDetails.precio
                            });
                            truckInventoryChanged = true;
                        }
                    }
                }
            }

            const filteredTruckItems = currentTruckItems.filter(item => item.quantity > 0);
            if (truckInventoryChanged || filteredTruckItems.length !== allTruckInventories[truckPlate].length) { // Check if something actually changed or if items were removed
                batch.set(_db.collection('truck_inventories').doc(truckPlate), { items: filteredTruckItems });
            }
        }

        await batch.commit();
        _showMessageModal('Cargas iniciales actualizadas exitosamente.');
        resetQuantities = {}; // Clear reset quantities
        await _fetchDataFromFirestore(); // Re-fetch all data to ensure consistency
        _setScreenAndRender('cargaSelection'); // Go back to carga selection
    } catch (error) {
        console.error('Error al guardar cargas iniciales:', error);
        _showMessageModal('Error al guardar cargas iniciales. Revisa tu conexión y reglas de seguridad.');
    }
};

export const renderTransferInventoryPasswordScreen = () => {
    if (!_isUser()) { _showMessageModal('Acceso denegado: Solo los usuarios pueden acceder a esta función.'); _setScreenAndRender('main'); return; }
    document.getElementById('app-root').innerHTML = `
        <div class="screen-container bg-white rounded-xl m-2 shadow-md max-w-md mx-auto my-10">
            <h2 class="text-2xl font-bold mb-5 text-center text-orange-700">TRANSBORDO DE INVENTARIO</h2>
            <p class="text-base text-center my-5 text-gray-600">Esta es una operación sensible. Por favor, ingresa tu contraseña para continuar.</p>
            ${_createInput('userPasswordForTransfer', 'Tu Contraseña', '', 'password')}
            ${_createButton('Verificar Contraseña', 'userPasswordForTransferButton', 'bg-orange-600 w-full')}
            ${_createButton('Cancelar', 'cancelTransferInventoryPasswordButton', 'bg-gray-600 mt-5 w-full')}
        </div>
    `;
};

export const handleTransferInventoryPassword = async () => {
    const password = document.getElementById('userPasswordForTransfer').value;
    if (!password) {
        _showMessageModal('Por favor, ingresa tu contraseña.');
        return;
    }

    try {
        const credential = firebase.auth.EmailAuthProvider.credential(_currentUserData.email, password);
        await firebase.auth().currentUser.reauthenticateWithCredential(credential);
        _setScreenAndRender('transferInventory');
    } catch (error) {
        console.error('Error al reautenticar para transbordo:', error);
        _showMessageModal(`Error de autenticación: ${error.message}. Contraseña incorrecta o sesión expirada.`);
    }
};

export const renderTransferInventoryScreen = () => {
    if (!_isUser() || !_currentUserData.assignedTruckPlate) {
        _showMessageModal('Acceso denegado: No tienes un camión asignado o no eres un usuario válido.');
        _setScreenAndRender('main');
        return;
    }

    const sourceTruckPlate = _currentUserData.assignedTruckPlate;
    const currentTruckItems = currentTruckInventory; // Use the current state of the assigned truck's inventory

    const destinationTruckOptions = _vehicles
        .filter(v => v.plate !== sourceTruckPlate)
        .map(v => ({ value: v.plate, text: `${v.name} (${v.plate})` }));

    const productsHtml = currentTruckItems.map(item => `
        <tr>
            <td><img src="${_productImages[item.sku] || _productImages['default']}" alt="Imagen de ${item.product}" class="w-10 h-10 rounded-md object-cover"></td>
            <td>${item.sku}</td>
            <td>${item.product}</td>
            <td>${item.presentacion}</td>
            <td>${item.quantity}</td>
            <td><input type="number" class="border border-gray-300 rounded-md text-center transfer-quantity-input" value="${transferQuantities[item.sku] || ''}" data-sku="${item.sku}" min="0" max="${item.quantity}"></td>
        </tr>
    `).join('');

    document.getElementById('app-root').innerHTML = `
        <div class="screen-container bg-white rounded-xl m-2 shadow-md">
            <h2 class="text-2xl font-bold mb-5 text-center text-orange-700">TRANSBORDO DE INVENTARIO</h2>
            <p class="text-lg font-bold text-center mb-4 text-gray-800">Camión Origen: ${sourceTruckPlate}</p>

            <div class="mb-6 p-4 bg-orange-50 rounded-lg border border-orange-300">
                <label for="destinationTruckSelect" class="block text-gray-700 text-sm font-bold mb-2">Camión Destino:</label>
                ${_createSelect('destinationTruckSelect', destinationTruckOptions, selectedDestinationTruck || '', 'w-full')}
            </div>

            <div class="table-container mb-5">
                ${productsHtml ? _createTable(['Imagen', 'SKU', 'Producto', 'Presentación', 'Cantidad Disponible', 'Cantidad a Transbordar'], productsHtml, 'transfer-products-table-body') : '<p class="text-center text-gray-500">No hay productos en tu camión para transbordar.</p>'}
            </div>

            <div class="flex justify-around gap-4 mt-5">
                ${_createButton('Realizar Transbordo', 'performTransferButton', 'bg-orange-600 flex-1')}
                ${_createButton('Volver', 'backToMainFromTransferInventoryButton', 'bg-gray-600 flex-1')}
            </div>
        </div>
    `;
};

export const handleDestinationTruckSelection = (truckPlate) => {
    selectedDestinationTruck = truckPlate;
    _setScreenAndRender('transferInventory'); // Re-render to update the screen
};

export const handleTransferQuantityChange = (sku, quantity) => {
    transferQuantities[sku] = parseInt(quantity) || 0;
};

export const showTransferConfirmation = () => {
    _showConfirmationModal('¿Estás seguro de que quieres realizar este transbordo? Esto moverá el inventario entre camiones.', performTransfer);
};

const performTransfer = async () => {
    if (!selectedDestinationTruck) {
        _showMessageModal('Por favor, selecciona un camión de destino.');
        return;
    }
    const sourceTruckPlate = _currentUserData.assignedTruckPlate;
    if (!sourceTruckPlate) {
        _showMessageModal('Error: No tienes un camión de origen asignado.');
        return;
    }

    const itemsToTransfer = [];
    const validationErrors = [];

    // Ensure currentTruckInventory is an array before iterating
    if (!Array.isArray(currentTruckInventory)) {
        console.error('[performTransfer] currentTruckInventory is not an array:', currentTruckInventory);
        _showMessageModal('Error interno: Inventario del camión de origen no válido.');
        return;
    }

    for (const item of currentTruckInventory) {
        const quantityToTransfer = transferQuantities[item.sku] || 0;
        if (quantityToTransfer > 0) {
            if (quantityToTransfer > item.quantity) {
                validationErrors.push(`Error: La cantidad a transbordar de "${item.product}" (${quantityToTransfer}) excede el stock disponible (${item.quantity}).`);
            } else {
                itemsToTransfer.push({ sku: item.sku, quantity: quantityToTransfer, product: item.product, presentacion: item.presentacion, price: item.price });
            }
        }
    }

    if (validationErrors.length > 0) {
        _showMessageModal(validationErrors.join('\n'));
        return;
    }
    if (itemsToTransfer.length === 0) {
        _showMessageModal('No se ha ingresado ninguna cantidad para transbordar.');
        return;
    }

    try {
        const batch = _db.batch();

        // 1. Update Source Truck Inventory
        let updatedSourceTruckItems = JSON.parse(JSON.stringify(currentTruckInventory));
        itemsToTransfer.forEach(itemToTransfer => {
            const itemIndex = updatedSourceTruckItems.findIndex(item => item.sku === itemToTransfer.sku);
            if (itemIndex !== -1) {
                updatedSourceTruckItems[itemIndex].quantity -= itemToTransfer.quantity;
            }
        });
        updatedSourceTruckItems = updatedSourceTruckItems.filter(item => item.quantity > 0);
        batch.set(_db.collection('truck_inventories').doc(sourceTruckPlate), { items: updatedSourceTruckItems });
        setCurrentTruckInventory(updatedSourceTruckItems); // Update local state for source truck

        // 2. Update Destination Truck Inventory
        const destinationTruckDocRef = _db.collection('truck_inventories').doc(selectedDestinationTruck);
        const destinationTruckDoc = await destinationTruckDocRef.get();
        let currentDestinationTruckItems = destinationTruckDoc.exists ? (destinationTruckDoc.data().items || []) : [];

        itemsToTransfer.forEach(itemToTransfer => {
            const itemIndex = currentDestinationTruckItems.findIndex(item => item.sku === itemToTransfer.sku);
            if (itemIndex !== -1) {
                currentDestinationTruckItems[itemIndex].quantity += itemToTransfer.quantity;
            } else {
                currentDestinationTruckItems.push(itemToTransfer);
            }
        });
        batch.set(destinationTruckDocRef, { items: currentDestinationTruckItems });

        // 3. Record Transfer History
        const transferRecord = {
            date: getCurrentDateFormatted(),
            userId: _currentUserData.uid, // Record who performed the transfer
            sourceTruck: sourceTruckPlate,
            destinationTruck: selectedDestinationTruck,
            items: itemsToTransfer,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        batch.add(_db.collection('transferRecords'), transferRecord);

        await batch.commit();
        _showMessageModal('Transbordo realizado exitosamente.');

        // Reset state after successful transfer
        selectedDestinationTruck = null;
        transferQuantities = {};
        await _fetchDataFromFirestore(); // Re-fetch all data to ensure consistency
        _setScreenAndRender('main'); // Go back to main screen
    } catch (error) {
        console.error('Error al realizar transbordo:', error);
        _showMessageModal('Error al realizar transbordo. Revisa tu conexión y las reglas de seguridad.');
    }
};

export const renderAdminTransferHistoryScreen = async () => {
    if (!_isAdmin()) { _showMessageModal('Acceso denegado: Solo los administradores pueden acceder a esta función.'); _setScreenAndRender('main'); return; }
    console.log('[Inventory Management] Rendering admin transfer history screen.');
    try {
        const snapshot = await _db.collection('transferRecords').orderBy('createdAt', 'desc').get();
        transferRecords = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error('Error fetching transfer history:', error);
        _showMessageModal('Error al cargar el historial de transbordos. Revisa tu conexión y las reglas de seguridad.');
        transferRecords = []; // Fallback to empty array on error
    }

    const transferRows = transferRecords.map(record => {
        const itemsSummary = record.items.map(item => `${item.product} (${item.quantity})`).join(', ');
        const userName = _users.find(u => u.uid === record.userId)?.email || 'Desconocido';
        return `
            <tr>
                <td>${record.date}</td>
                <td>${userName}</td>
                <td>${record.sourceTruck}</td>
                <td>${record.destinationTruck}</td>
                <td>${itemsSummary}</td>
                <td>
                    ${_createButton('Descargar CSV', '', 'bg-blue-500 hover:bg-blue-600 text-white py-1 px-2 rounded-md text-sm download-transfer-csv-button', { recordid: record.id })}
                </td>
            </tr>
        `;
    }).join('');

    document.getElementById('app-root').innerHTML = `
        <div class="screen-container bg-white rounded-xl m-2 shadow-md">
            <h2 class="text-2xl font-bold mb-5 text-center text-indigo-700">HISTORIAL DE TRANSBORDOS</h2>
            <div class="table-container mb-5">
                ${_createTable(['Fecha', 'Usuario', 'Origen', 'Destino', 'Artículos Transbordados', 'Acciones'], transferRows, 'transfer-history-table-body')}
            </div>
            <div class="flex justify-center mb-6 gap-4">
                ${_createButton('Borrar Historial de Transbordos', 'clearTransferHistoryButton', 'bg-red-600')}
            </div>
            ${_createButton('Volver al Menú Principal', 'backToMainFromAdminTransferHistoryButton', 'bg-gray-600 mt-5 w-full')}
        </div>
    `;
};

export const showClearTransferHistoryConfirmation = () => {
    _showConfirmationModal('¿Estás seguro de que quieres borrar TODO el historial de transbordos? Esta acción es irreversible.', clearTransferHistory);
};

const clearTransferHistory = async () => {
    try {
        const batch = _db.batch();
        const snapshot = await _db.collection('transferRecords').get();
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        _showMessageModal('Historial de transbordos borrado exitosamente.');
        transferRecords = []; // Clear local state
        _setScreenAndRender('adminTransferHistory'); // Re-render to show empty history
    } catch (error) {
        console.error('Error al borrar historial de transbordos:', error);
        _showMessageModal('Error al borrar historial de transbordos. Revisa tu conexión y las reglas de seguridad.');
    }
};

export const handleFileUpload = async (event, type) => {
    console.log(`[Inventory Management] handleFileUpload called for type: ${type}`);
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        const parsedData = parseCSV(e.target.result);
        if (parsedData.length === 0) {
            _showMessageModal(`El archivo CSV de ${type} está vacío o no tiene el formato correcto.`);
            return;
        }

        try {
            const batch = _db.batch();
            const collectionRef = _db.collection(type === 'inventory' ? 'inventory' : 'vehicles');
            const idKey = type === 'inventory' ? 'sku' : 'plate';

            // Delete existing documents in the collection
            const existingSnapshot = await collectionRef.get();
            existingSnapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });

            // Add new documents from CSV
            for (const row of parsedData) {
                const docId = row[idKey];
                if (!docId) {
                    console.warn(`Fila sin ${idKey}, saltando:`, row);
                    continue;
                }
                if (type === 'inventory') {
                    batch.set(collectionRef.doc(docId), {
                        rubro: row['Rubro'] || '',
                        sku: row['SKU'] || '',
                        segmento: row['Segmento'] || '',
                        producto: row['Producto'] || '',
                        presentacion: row['Presentacion'] || '',
                        cantidad: parseInt(row['Cantidad']) || 0,
                        precio: parseFloat(row['Precio']) || 0
                    });
                } else if (type === 'vehicles') {
                    batch.set(collectionRef.doc(docId), {
                        plate: row['Plate'] || '',
                        name: row['Name'] || '',
                        brand: row['Brand'] || '',
                        model: row['Model'] || ''
                    });
                }
            }
            await batch.commit();
            _showMessageModal(`${type}.csv cargado y guardado exitosamente en Firestore.`);
            await _fetchDataFromFirestore(); // Re-fetch to update the main app's data
            _setScreenAndRender('archivosAdmin'); // Go back to admin files screen
        } catch (error) {
            console.error(`Error al cargar archivo CSV de ${type} a Firestore:`, error);
            _showMessageModal(`Error al cargar archivo de ${type}. Por favor, revisa tu conexión y las reglas de seguridad de Firestore.`);
        }
    };
    reader.readAsText(file);
};

// --- Data Fetching for Inventory Management (called from index.html) ---
export const fetchInventoryRelatedData = async () => {
    console.log('[inventoryManagement.js] Fetching inventory-related data...');
    try {
        const fetchCollection = async (collectionName, targetArray, initialData, idKey) => {
            const snapshot = await _db.collection(collectionName).get();
            if (snapshot.empty) {
                console.log(`[inventoryManagement.js] Collection '${collectionName}' is empty. Populating with initial data.`);
                const batch = _db.batch();
                for (const item of initialData) {
                    batch.set(_db.collection(collectionName).doc(item[idKey]), item);
                }
                await batch.commit();
                targetArray.splice(0, targetArray.length, ...initialData); // Update in place
            } else {
                console.log(`[inventoryManagement.js] Collection '${collectionName}' has data. Fetching existing data.`);
                targetArray.splice(0, targetArray.length, ...snapshot.docs.map(doc => ({ [idKey]: doc.id, ...doc.data() }))); // Update in place
            }
        };

        await fetchCollection('inventory', _inventory, initialInventory, 'sku');
        await fetchCollection('vehicles', _vehicles, initialVehicles, 'plate');

        console.log('[inventoryManagement.js] Inventory fetched:', _inventory.length);
        console.log('[inventoryManagement.js] Vehicles fetched:', _vehicles.length);

    } catch (error) {
        console.error('[inventoryManagement.js] Error fetching inventory-related data:', error);
        _showMessageModal('Error al cargar datos de inventario o vehículos. Usando datos de ejemplo. Revisa tu conexión y las reglas de seguridad.');
        _inventory.splice(0, _inventory.length, ...initialInventory);
        _vehicles.splice(0, _vehicles.length, ...initialVehicles);
    }
};
