// inventoryManagement.js

// --- Module-scoped variables (will be initialized via init function) ---
let _db;
let _currentUserData; // Will be updated by index.html on auth state change
let _isAdmin; // Function reference from index.html
let _isUser; // Function reference from index.html
let _vehicles; // Global vehicles array from index.html (passed by reference)
let _inventory; // Global inventory array from index.html (passed by reference)
let _users; // Global users array from index.html (passed by reference)
let _vendors; // Global vendors array from index.html (passed by reference)
let _productImages; // Global productImages object from index.html
let _showMessageModal; // Function reference from index.html
let _showConfirmationModal; // Function reference from index.html
let _createTable; // Function reference from index.html
let _createInput; // Function reference from index.html
let _createSelect; // Function reference from index.html
let _createButton; // Function reference from index.html
let _setScreenAndRender; // Function reference from index.html
let _fetchDataFromFirestore; // Function reference from index.html
let _createSearchableDropdown; // Function reference from index.html

// --- Data specific to inventory management ---
export let currentTruckInventory = []; // Inventory for the currently assigned truck
export let loadRecords = []; // History of merchandise loads
export let transferRecords = []; // History of inventory transfers

// State variables for inventory screens
export let selectedLoader = null;
export let selectedTruckForReceiving = null;
export let receivingQuantities = {};
export let editingVehicle = null;
export let selectedAdminVehicle = null;
export let resetQuantities = {}; // For initial load reset
export let transferQuantities = {}; // For inventory transfer

// Firestore unsubscribe functions for real-time listeners
let truckInventoryUnsubscribe = null;
let adminTruckInventoryUnsubscribe = null;

// Initial data for populating Firestore if collections are empty
const initialInventory = [
    { sku: '2364', rubro: 'Alimentos', segmento: 'Snacks', producto: 'Galletas Saladas', presentacion: 'Paquete 150g', cantidad: 100, precio: 1.50 },
    { sku: '7458', rubro: 'Bebidas', segmento: 'Refrescos', producto: 'Refresco Cola', presentacion: 'Botella 2L', cantidad: 50, precio: 2.00 },
    { sku: '1001', rubro: 'Alimentos', segmento: 'Lácteos', producto: 'Leche Entera', presentacion: 'Litro', cantidad: 75, precio: 1.20 },
    { sku: '1002', rubro: 'Alimentos', segmento: 'Panadería', producto: 'Pan de Molde', presentacion: '500g', cantidad: 40, precio: 2.10 },
    { sku: '9876', rubro: 'Limpieza', segmento: 'Hogar', producto: 'Detergente Líquido', presentacion: '1L', cantidad: 30, precio: 3.50 }
];

const initialVehicles = [
    { plate: 'ABC-123', model: 'Ford F-150', capacity: 500, assignedUser: null },
    { plate: 'XYZ-789', model: 'Chevrolet Silverado', capacity: 600, assignedUser: null },
    { plate: 'DEF-456', model: 'Toyota Hilux', capacity: 450, assignedUser: null }
];


// --- Initialization function ---
export const init = (db, currentUserData, isAdmin, isUser, vehicles, inventory, users, vendors, productImages,
    showMessageModal, showConfirmationModal, createTable, createInput, createSelect, createButton,
    setScreenAndRender, fetchDataFromFirestore, createSearchableDropdown) => {
    _db = db;
    _currentUserData = currentUserData;
    _isAdmin = isAdmin;
    _isUser = isUser;
    _vehicles = vehicles; // Reference to global array
    _inventory = inventory; // Reference to global array
    _users = users; // Reference to global array
    _vendors = vendors; // Reference to global array
    _productImages = productImages;
    _showMessageModal = showMessageModal;
    _showConfirmationModal = showConfirmationModal;
    _createTable = createTable;
    _createInput = createInput;
    _createSelect = createSelect;
    _createButton = createButton;
    _setScreenAndRender = setScreenAndRender;
    _fetchDataFromFirestore = fetchDataFromFirestore;
    _createSearchableDropdown = createSearchableDropdown;
    console.log('[inventoryManagement.js] Initialized with dependencies.');
};

// --- Getters and Setters for Module-Scoped Variables (if needed by index.html) ---
export const getCurrentTruckInventory = () => currentTruckInventory;
export const setCurrentTruckInventory = (newInventory) => {
    currentTruckInventory = newInventory;
};
export const getTruckInventoryUnsubscribe = () => truckInventoryUnsubscribe;
export const setTruckInventoryUnsubscribe = (func) => { truckInventoryUnsubscribe = func; };
export const getAdminTruckInventoryUnsubscribe = () => adminTruckInventoryUnsubscribe;
export const setAdminTruckInventoryUnsubscribe = (func) => { adminTruckInventoryUnsubscribe = func; };
export const updateCurrentUserData = (data) => {
    // This function is called by index.html's onAuthStateChanged
    // to keep the module's _currentUserData in sync with the main app's currentUserData
    Object.assign(_currentUserData, data);
    console.log('[inventoryManagement.js] _currentUserData updated:', _currentUserData);
};


// --- Data Fetching Functions ---
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

        const loadRecordsSnapshot = await _db.collection('loadRecords').get();
        loadRecords.splice(0, loadRecords.length, ...loadRecordsSnapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() })));
        console.log('[inventoryManagement.js] Load Records fetched:', loadRecords.length);

        const transferRecordsSnapshot = await _db.collection('transferRecords').get();
        transferRecords.splice(0, transferRecords.length, ...transferRecordsSnapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() })));
        console.log('[inventoryManagement.js] Transfer Records fetched:', transferRecords.length);

        if (_currentUserData.assignedTruckPlate) {
            const truckInventoryDoc = await _db.collection('truck_inventories').doc(_currentUserData.assignedTruckPlate).get();
            if (truckInventoryDoc.exists) {
                currentTruckInventory.splice(0, currentTruckInventory.length, ...(truckInventoryDoc.data().items || []));
                console.log(`[inventoryManagement.js] Truck Inventory for ${_currentUserData.assignedTruckPlate} fetched:`, currentTruckInventory.length);
            } else {
                currentTruckInventory.splice(0, currentTruckInventory.length); // Clear if no truck inventory
                console.log(`[inventoryManagement.js] No truck inventory found for assigned truck: ${_currentUserData.assignedTruckPlate}.`);
            }
        } else {
            currentTruckInventory.splice(0, currentTruckInventory.length); // Clear if no truck assigned
            console.log('[inventoryManagement.js] No truck assigned, clearing currentTruckInventory.');
        }

        console.log('[inventoryManagement.js] Inventory-related data fetch completed successfully.');
    } catch (error) {
        console.error('[inventoryManagement.js] Error fetching inventory-related data from Firestore:', error);
        _showMessageModal('Error al cargar datos de inventario, vehículos, cargas o transbordos. Usando datos de ejemplo. Por favor, revisa tu conexión y las reglas de seguridad de Firestore.');
        // Fallback to initial data if error occurs
        _inventory.splice(0, _inventory.length, ...initialInventory);
        _vehicles.splice(0, _vehicles.length, ...initialVehicles);
        loadRecords.splice(0, loadRecords.length);
        transferRecords.splice(0, transferRecords.length);
        currentTruckInventory.splice(0, currentTruckInventory.length);
    }
};

// --- Real-time Listeners ---
export const setupTruckInventoryListener = () => {
    if (truckInventoryUnsubscribe) {
        truckInventoryUnsubscribe(); // Unsubscribe from previous listener if exists
        console.log('[Firestore Listener] Unsubscribed from previous user truck inventory listener.');
    }

    if (_currentUserData.assignedTruckPlate && _isUser()) {
        const docRef = _db.collection('truck_inventories').doc(_currentUserData.assignedTruckPlate);
        truckInventoryUnsubscribe = docRef.onSnapshot(docSnapshot => {
            if (docSnapshot.exists) {
                currentTruckInventory.splice(0, currentTruckInventory.length, ...(docSnapshot.data().items || []));
                console.log(`[Firestore Listener] Real-time update for truck inventory (${_currentUserData.assignedTruckPlate}):`, currentTruckInventory.length);
            } else {
                currentTruckInventory.splice(0, currentTruckInventory.length);
                console.log(`[Firestore Listener] Truck inventory document for ${_currentUserData.assignedTruckPlate} does not exist.`);
            }
            _setScreenAndRender(document.getElementById('app-root').dataset.currentScreen || 'main'); // Re-render current screen
        }, error => {
            console.error('[Firestore Listener] Error listening to truck inventory:', error);
            _showMessageModal('Error en la escucha en tiempo real del inventario del camión. Revisa tu conexión.');
        });
        console.log(`[Firestore Listener] Subscribed to real-time updates for truck inventory: ${_currentUserData.assignedTruckPlate}`);
    } else {
        console.log('[Firestore Listener] No truck assigned or not a user, not setting up truck inventory listener.');
    }
};

export const setupAdminTruckInventoryListener = (truckPlate) => {
    if (adminTruckInventoryUnsubscribe) {
        adminTruckInventoryUnsubscribe(); // Unsubscribe from previous listener if exists
        console.log('[Firestore Listener] Unsubscribed from previous admin truck inventory listener.');
    }

    if (truckPlate && _isAdmin()) {
        const docRef = _db.collection('truck_inventories').doc(truckPlate);
        adminTruckInventoryUnsubscribe = docRef.onSnapshot(docSnapshot => {
            if (docSnapshot.exists) {
                currentTruckInventory.splice(0, currentTruckInventory.length, ...(docSnapshot.data().items || []));
                console.log(`[Firestore Listener] Real-time update for admin selected truck inventory (${truckPlate}):`, currentTruckInventory.length);
            } else {
                currentTruckInventory.splice(0, currentTruckInventory.length);
                console.log(`[Firestore Listener] Truck inventory document for ${truckPlate} does not exist.`);
            }
            _setScreenAndRender('adminVehicleInventory'); // Re-render admin vehicle inventory screen
        }, error => {
            console.error('[Firestore Listener] Error listening to admin truck inventory:', error);
            _showMessageModal('Error en la escucha en tiempo real del inventario del camión (Admin). Revisa tu conexión.');
        });
        console.log(`[Firestore Listener] Subscribed to real-time updates for admin selected truck inventory: ${truckPlate}`);
    } else {
        console.log('[Firestore Listener] No truck selected or not an admin, not setting up admin truck inventory listener.');
    }
};


// --- Screen Rendering Functions ---
export const renderCargaSelectionScreen = () => {
    if (!_isAdmin()) { _showMessageModal('Acceso denegado: Solo los administradores pueden acceder a esta sección.'); _setScreenAndRender('main'); return; }
    document.getElementById('app-root').innerHTML = `
        <div class="screen-container bg-white rounded-xl m-2 shadow-md">
            <h2 class="text-2xl font-bold mb-5 text-center text-indigo-700">SELECCIÓN DE CARGA</h2>
            <div class="flex flex-wrap justify-center">
                ${_createButton('CARGA DE MERCANCÍA A CAMIÓN', 'truckLoadingButton')}
                ${_createButton('HISTORIAL DE CARGAS', 'loadHistoryButton')}
                ${_createButton('REINICIAR CARGAS INICIALES', 'resetCargasInicialesPasswordButton')}
            </div>
            ${_createButton('Volver al Menú Principal', 'backToMainFromCargaSelection', 'bg-gray-600 mt-5 w-full')}
        </div>
    `;
};

export const renderTruckReceivingScreen = () => {
    if (!_isAdmin()) { _showMessageModal('Acceso denegado: Solo los administradores pueden acceder a esta sección.'); _setScreenAndRender('main'); return; }

    const loaderOptions = _users.filter(u => u.role === 'user').map(user => ({ value: user.uid, text: user.email }));
    const truckOptions = _vehicles.map(v => ({ value: v.plate, text: v.plate }));

    const productsHtml = _inventory.map(item => `
        <tr>
            <td><img src="${_productImages[item.sku] || _productImages['default']}" alt="Imagen de ${item.producto}" class="w-10 h-10 rounded-md object-cover"></td>
            <td>${item.sku}</td>
            <td>${item.producto}</td>
            <td>${item.presentacion}</td>
            <td><input type="number" class="border border-gray-300 rounded-md text-center receiving-quantity-input" value="${receivingQuantities[item.sku] || ''}" data-sku="${item.sku}" min="0"></td>
            <td>${item.cantidad}</td>
        </tr>
    `).join('');

    document.getElementById('app-root').innerHTML = `
        <div class="screen-container bg-white rounded-xl m-2 shadow-md">
            <h2 class="text-2xl font-bold mb-5 text-center text-indigo-700">CARGA DE MERCANCÍA A CAMIÓN</h2>
            <div class="mb-4">
                <label for="loaderSelect" class="block text-gray-700 text-sm font-bold mb-2">Seleccionar Cargador:</label>
                ${_createSelect('loaderSelect', loaderOptions, selectedLoader || '', 'w-full')}
            </div>
            <div class="mb-4">
                <label for="truckSelect" class="block text-gray-700 text-sm font-bold mb-2">Seleccionar Camión:</label>
                ${_createSelect('truckSelect', truckOptions, selectedTruckForReceiving || '', 'w-full')}
            </div>
            <p class="text-base text-center my-5 text-gray-600">Inventario Principal:</p>
            ${_createTable(['Imagen', 'SKU', 'Producto', 'Presentación', 'Cantidad a Cargar', 'Disponible'], productsHtml, 'receiving-products-body')}
            ${_createButton('Cargar Mercancía', 'loadMerchandiseButton', 'bg-emerald-600 mt-3 w-full')}
            ${_createButton('Volver', 'backToCargaSelectionButton', 'bg-gray-600 mt-5 w-full')}
        </div>
    `;
};

export const renderLoadHistoryScreen = () => {
    if (!_isAdmin()) { _showMessageModal('Acceso denegado: Solo los administradores pueden acceder a esta sección.'); _setScreenAndRender('main'); return; }

    const loadHistoryRows = loadRecords.map(record => {
        const itemsSummary = record.items.map(item => `${item.producto} (${item.cantidadCargada})`).join(', ');
        return `
            <tr>
                <td>${record.date}</td>
                <td>${record.truckPlate}</td>
                <td>${record.loaderEmail}</td>
                <td>${itemsSummary}</td>
                <td>
                    ${_createButton('Descargar CSV', '', 'bg-blue-500 hover:bg-blue-600 text-white py-1 px-3 rounded-md text-sm download-load-csv-button', { recordid: record.docId })}
                </td>
            </tr>
        `;
    }).join('');

    document.getElementById('app-root').innerHTML = `
        <div class="screen-container bg-white rounded-xl m-2 shadow-md">
            <h2 class="text-2xl font-bold mb-5 text-center text-indigo-700">HISTORIAL DE CARGAS</h2>
            ${_createTable(['Fecha', 'Camión', 'Cargador', 'Items Cargados', 'Acciones'], loadHistoryRows, 'load-history-body')}
            ${_createButton('Limpiar Historial', 'clearLoadHistoryButton', 'bg-red-600 mt-3 w-full')}
            ${_createButton('Volver', 'backToCargaSelectionFromLoadHistoryButton', 'bg-gray-600 mt-5 w-full')}
        </div>
    `;
};

export const renderInventarioScreen = () => {
    // This screen is for regular users to view their assigned truck's inventory
    // or main inventory if no truck is assigned.
    if (!_isUser() && !_isAdmin()) { _showMessageModal('Acceso denegado.'); _setScreenAndRender('main'); return; }

    const inventoryToDisplay = _currentUserData.assignedTruckPlate ? currentTruckInventory : _inventory;
    const inventorySourceText = _currentUserData.assignedTruckPlate ? ` (Camión: ${_currentUserData.assignedTruckPlate})` : ' (Almacén Principal)';

    const inventoryRows = inventoryToDisplay.map(item => `
        <tr>
            <td><img src="${_productImages[item.sku] || _productImages['default']}" alt="Imagen de ${item.producto}" class="w-10 h-10 rounded-md object-cover"></td>
            <td>${item.sku}</td>
            <td>${item.producto}</td>
            <td>${item.presentacion}</td>
            <td>${item.quantity !== undefined ? item.quantity : item.cantidad}</td>
            <td>$${(item.price !== undefined ? item.price : item.precio).toFixed(2)}</td>
        </tr>
    `).join('');

    document.getElementById('app-root').innerHTML = `
        <div class="screen-container bg-white rounded-xl m-2 shadow-md">
            <h2 class="text-2xl font-bold mb-5 text-center text-indigo-700">INVENTARIO${inventorySourceText}</h2>
            ${_createInput('inventorySearchInputUser', 'Buscar por SKU o Producto', '', 'text', false, '', { oninput: 'inventoryManagement.filterInventoryForUserScreen(this.value)' })}
            ${_createTable(['Imagen', 'SKU', 'Producto', 'Presentación', 'Cantidad', 'Precio'], inventoryRows, 'user-inventory-body')}
            ${_createButton('Volver al Menú Principal', 'backToMainFromUserInventoryButton', 'bg-gray-600 mt-5 w-full')}
        </div>
    `;
    filterInventoryForUserScreen(document.getElementById('inventorySearchInputUser').value); // Apply initial filter
};

export const renderAdminInventorySelection = () => {
    if (!_isAdmin()) { _showMessageModal('Acceso denegado: Solo los administradores pueden acceder a esta sección.'); _setScreenAndRender('main'); return; }
    document.getElementById('app-root').innerHTML = `
        <div class="screen-container bg-white rounded-xl m-2 shadow-md">
            <h2 class="text-2xl font-bold mb-5 text-center text-indigo-700">SELECCIÓN DE INVENTARIO (ADMIN)</h2>
            <div class="flex flex-wrap justify-center">
                ${_createButton('INVENTARIO PRINCIPAL', 'adminMainInventoryButton')}
                ${_createButton('INVENTARIO DE CAMIONES', 'adminVehicleInventoryButton')}
            </div>
            ${_createButton('Volver al Menú Principal', 'backToMainFromAdminInventorySelection', 'bg-gray-600 mt-5 w-full')}
        </div>
    `;
};

export const renderAdminMainInventoryScreen = () => {
    if (!_isAdmin()) { _showMessageModal('Acceso denegado: Solo los administradores pueden acceder a esta sección.'); _setScreenAndRender('main'); return; }

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
            <h2 class="text-2xl font-bold mb-5 text-center text-indigo-700">INVENTARIO PRINCIPAL (ADMIN)</h2>
            ${_createInput('inventorySearchInputAdminMain', 'Buscar por SKU o Producto', '', 'text', false, '', { oninput: 'inventoryManagement.filterInventoryForAdminMainScreen(this.value)' })}
            ${_createTable(['Imagen', 'SKU', 'Producto', 'Presentación', 'Cantidad', 'Precio'], inventoryRows, 'admin-main-inventory-body')}
            ${_createButton('Volver', 'backToAdminInventorySelectionButton', 'bg-gray-600 mt-5 w-full')}
        </div>
    `;
    filterInventoryForAdminMainScreen(document.getElementById('inventorySearchInputAdminMain').value); // Apply initial filter
};

export const renderAdminVehicleInventoryScreen = () => {
    if (!_isAdmin()) { _showMessageModal('Acceso denegado: Solo los administradores pueden acceder a esta sección.'); _setScreenAndRender('main'); return; }

    const truckOptions = _vehicles.map(v => ({ value: v.plate, text: v.plate }));

    const inventoryRows = currentTruckInventory.map(item => `
        <tr>
            <td><img src="${_productImages[item.sku] || _productImages['default']}" alt="Imagen de ${item.producto}" class="w-10 h-10 rounded-md object-cover"></td>
            <td>${item.sku}</td>
            <td>${item.producto}</td>
            <td>${item.presentacion}</td>
            <td>${item.quantity}</td>
            <td>$${item.price.toFixed(2)}</td>
        </tr>
    `).join('');

    document.getElementById('app-root').innerHTML = `
        <div class="screen-container bg-white rounded-xl m-2 shadow-md">
            <h2 class="text-2xl font-bold mb-5 text-center text-indigo-700">INVENTARIO DE CAMIONES (ADMIN)</h2>
            <div class="mb-4">
                <label for="adminVehicleSelect" class="block text-gray-700 text-sm font-bold mb-2">Seleccionar Camión:</label>
                ${_createSelect('adminVehicleSelect', truckOptions, selectedAdminVehicle || '', 'w-full')}
            </div>
            <p class="text-base text-center my-5 text-gray-600">Inventario del Camión Seleccionado:</p>
            ${_createInput('inventorySearchInputAdminTruck', 'Buscar por SKU o Producto', '', 'text', false, '', { oninput: 'inventoryManagement.filterInventoryForAdminTruckScreen(this.value)' })}
            ${_createTable(['Imagen', 'SKU', 'Producto', 'Presentación', 'Cantidad', 'Precio'], inventoryRows, 'admin-truck-inventory-body')}
            ${_createButton('Volver', 'backToAdminInventorySelectionFromVehicleInventoryButton', 'bg-gray-600 mt-5 w-full')}
        </div>
    `;
    filterInventoryForAdminTruckScreen(document.getElementById('inventorySearchInputAdminTruck').value); // Apply initial filter
};

export const renderVehiclesScreen = () => {
    if (!_isAdmin()) { _showMessageModal('Acceso denegado: Solo los administradores pueden acceder a esta sección.'); _setScreenAndRender('main'); return; }

    const vehicleRows = _vehicles.map(vehicle => {
        const assignedUserEmail = _users.find(u => u.uid === vehicle.assignedUser)?.email || 'N/A';
        return `
            <tr>
                <td>${vehicle.plate}</td>
                <td>${vehicle.model}</td>
                <td>${vehicle.capacity}</td>
                <td>${assignedUserEmail}</td>
                <td>
                    ${_createButton('Editar', '', 'bg-yellow-500 hover:bg-yellow-600 text-white py-1 px-3 rounded-md text-sm edit-vehicle-button', { plate: vehicle.plate })}
                    ${_createButton('Eliminar', '', 'bg-red-500 hover:bg-red-600 text-white py-1 px-3 rounded-md text-sm delete-vehicle-button', { plate: vehicle.plate })}
                </td>
            </tr>
        `;
    }).join('');

    document.getElementById('app-root').innerHTML = `
        <div class="screen-container bg-white rounded-xl m-2 shadow-md">
            <h2 class="text-2xl font-bold mb-5 text-center text-indigo-700">GESTIÓN DE VEHÍCULOS DE CARGA</h2>
            ${_createButton('Agregar Nuevo Vehículo', 'addVehicleButton', 'bg-emerald-600 mb-4')}
            ${_createTable(['Placa', 'Modelo', 'Capacidad', 'Usuario Asignado', 'Acciones'], vehicleRows, 'vehicles-table-body')}
            ${_createButton('Volver al Menú Principal', 'backToMainFromVehiclesButton', 'bg-gray-600 mt-5 w-full')}
        </div>
    `;
};

export const renderAssignVehicleScreen = () => {
    if (!_isAdmin()) { _showMessageModal('Acceso denegado: Solo los administradores pueden acceder a esta sección.'); _setScreenAndRender('main'); return; }

    const userOptions = _users.map(user => ({ value: user.uid, text: user.email }));
    const vehicleOptions = _vehicles.map(vehicle => ({ value: vehicle.plate, text: vehicle.plate }));

    const assignmentRows = _users.map(user => {
        const assignedVehicle = _vehicles.find(v => v.assignedUser === user.uid);
        return `
            <tr>
                <td>${user.email}</td>
                <td>${assignedVehicle ? assignedVehicle.plate : 'Ninguno'}</td>
                <td>
                    <div class="flex gap-2">
                        ${_createSelect(`assignVehicle-${user.uid}`, vehicleOptions, assignedVehicle ? assignedVehicle.plate : '', 'w-full', '-- Asignar Camión --', { userid: user.uid, currentvehicle: assignedVehicle ? assignedVehicle.plate : '' })}
                        ${_createButton('Guardar', '', 'bg-blue-500 hover:bg-blue-600 text-white py-1 px-3 rounded-md text-sm save-assignment-button', { userid: user.uid })}
                        ${assignedVehicle ? _createButton('Quitar', '', 'bg-red-500 hover:bg-red-600 text-white py-1 px-3 rounded-md text-sm remove-assignment-button', { userid: user.uid }) : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    document.getElementById('app-root').innerHTML = `
        <div class="screen-container bg-white rounded-xl m-2 shadow-md">
            <h2 class="text-2xl font-bold mb-5 text-center text-indigo-700">ASIGNAR VEHÍCULO A USUARIO</h2>
            ${_createTable(['Usuario', 'Camión Asignado', 'Acciones'], assignmentRows, 'assign-vehicle-table-body')}
            ${_createButton('Volver al Menú Principal', 'backToMainFromAssignVehicleButton', 'bg-gray-600 mt-5 w-full')}
        </div>
    `;
    attachAssignVehicleEventListeners(); // Attach event listeners for dynamic selects and buttons
};

export const renderResetCargasInicialesPasswordScreen = () => {
    if (!_isAdmin()) { _showMessageModal('Acceso denegado: Solo los administradores pueden acceder a esta sección.'); _setScreenAndRender('main'); return; }
    document.getElementById('app-root').innerHTML = `
        <div class="screen-container bg-white rounded-xl m-2 shadow-md max-w-md mx-auto my-10">
            <h2 class="text-2xl font-bold mb-5 text-center text-indigo-700">REINICIAR CARGAS INICIALES</h2>
            <p class="text-base text-center my-4 text-gray-600">Esta acción es irreversible y requiere confirmación de administrador.</p>
            ${_createInput('adminPasswordForReset', 'Contraseña de Administrador', '', 'password')}
            ${_createButton('Confirmar y Continuar', 'adminPasswordForResetButton', 'bg-red-600 w-full')}
            ${_createButton('Cancelar y Volver', 'cancelAndBackToCargaSelectionButton', 'bg-gray-600 mt-4 w-full')}
        </div>
    `;
};

export const renderResetCargasInicialesEditScreen = () => {
    if (!_isAdmin()) { _showMessageModal('Acceso denegado: Solo los administradores pueden acceder a esta sección.'); _setScreenAndRender('main'); return; }

    resetQuantities = {}; // Reset quantities when entering this screen

    const mainInventoryRows = _inventory.map(item => {
        resetQuantities[`main-${item.sku}`] = item.cantidad; // Initialize with current quantity
        return `
            <tr>
                <td><img src="${_productImages[item.sku] || _productImages['default']}" alt="Imagen de ${item.producto}" class="w-10 h-10 rounded-md object-cover"></td>
                <td>${item.sku}</td>
                <td>${item.producto}</td>
                <td><input type="number" class="border border-gray-300 rounded-md text-center reset-quantity-input-main" value="${item.cantidad}" data-sku="${item.sku}" min="0"></td>
            </tr>
        `;
    }).join('');

    let truckInventorySections = _vehicles.map(vehicle => {
        const truckItems = currentTruckInventory.filter(item => item.assignedTruckPlate === vehicle.plate);
        if (truckItems.length === 0) return ''; // Skip if truck has no inventory

        const truckRows = truckItems.map(item => {
            resetQuantities[`truck-${vehicle.plate}-${item.sku}`] = item.quantity; // Initialize
            return `
                <tr>
                    <td><img src="${_productImages[item.sku] || _productImages['default']}" alt="Imagen de ${item.producto}" class="w-10 h-10 rounded-md object-cover"></td>
                    <td>${item.sku}</td>
                    <td>${item.producto}</td>
                    <td><input type="number" class="border border-gray-300 rounded-md text-center reset-quantity-input-truck" value="${item.quantity}" data-sku="${item.sku}" data-truckplate="${vehicle.plate}" min="0"></td>
                </tr>
            `;
        }).join('');
        return `
            <h3 class="text-xl font-bold mt-6 mb-3 text-indigo-600">Inventario del Camión: ${vehicle.plate}</h3>
            ${_createTable(['Imagen', 'SKU', 'Producto', 'Cantidad'], truckRows, `reset-truck-inventory-body-${vehicle.plate}`)}
        `;
    }).join('');

    document.getElementById('app-root').innerHTML = `
        <div class="screen-container bg-white rounded-xl m-2 shadow-md">
            <h2 class="text-2xl font-bold mb-5 text-center text-indigo-700">EDITAR CARGAS INICIALES</h2>
            <p class="text-base text-center my-4 text-red-600 font-semibold">¡ADVERTENCIA! Modificar estas cantidades afectará directamente el inventario. Procede con precaución.</p>

            <h3 class="text-xl font-bold mb-3 text-indigo-600">Inventario Principal</h3>
            ${_createTable(['Imagen', 'SKU', 'Producto', 'Cantidad'], mainInventoryRows, 'reset-main-inventory-body')}

            ${truckInventorySections}

            ${_createButton('Guardar Cambios de Cargas Iniciales', 'saveResetCargasInicialesButton', 'bg-emerald-600 mt-5 w-full')}
            ${_createButton('Cancelar y Volver', 'cancelResetCargasInicialesButton', 'bg-gray-600 mt-4 w-full')}
        </div>
    `;
};

export const renderTransferInventoryPasswordScreen = () => {
    if (!_isUser()) { _showMessageModal('Acceso denegado: Solo los usuarios pueden acceder a esta sección.'); _setScreenAndRender('main'); return; }
    document.getElementById('app-root').innerHTML = `
        <div class="screen-container bg-white rounded-xl m-2 shadow-md max-w-md mx-auto my-10">
            <h2 class="text-2xl font-bold mb-5 text-center text-indigo-700">TRANSBORDO DE INVENTARIO</h2>
            <p class="text-base text-center my-4 text-gray-600">Para realizar un transbordo, ingresa tu contraseña.</p>
            ${_createInput('userPasswordForTransfer', 'Tu Contraseña', '', 'password')}
            ${_createButton('Confirmar y Continuar', 'userPasswordForTransferButton', 'bg-blue-600 w-full')}
            ${_createButton('Cancelar y Volver', 'cancelTransferInventoryPasswordButton', 'bg-gray-600 mt-4 w-full')}
        </div>
    `;
};

export const renderTransferInventoryScreen = () => {
    if (!_isUser()) { _showMessageModal('Acceso denegado: Solo los usuarios pueden acceder a esta sección.'); _setScreenAndRender('main'); return; }
    if (!_currentUserData.assignedTruckPlate) { _showMessageModal('No tienes un camión asignado para realizar transbordos.'); _setScreenAndRender('main'); return; }

    const availableTrucks = _vehicles.filter(v => v.plate !== _currentUserData.assignedTruckPlate);
    const destinationTruckOptions = availableTrucks.map(v => ({ value: v.plate, text: v.plate }));

    const productsHtml = currentTruckInventory.map(item => `
        <tr>
            <td><img src="${_productImages[item.sku] || _productImages['default']}" alt="Imagen de ${item.producto}" class="w-10 h-10 rounded-md object-cover"></td>
            <td>${item.sku}</td>
            <td>${item.producto}</td>
            <td>${item.presentacion}</td>
            <td><input type="number" class="border border-gray-300 rounded-md text-center transfer-quantity-input" value="${transferQuantities[item.sku] || ''}" data-sku="${item.sku}" min="0" max="${item.quantity}"></td>
            <td>${item.quantity}</td>
        </tr>
    `).join('');

    document.getElementById('app-root').innerHTML = `
        <div class="screen-container bg-white rounded-xl m-2 shadow-md">
            <h2 class="text-2xl font-bold mb-5 text-center text-indigo-700">REALIZAR TRANSBORDO</h2>
            <p class="text-lg font-bold text-center my-4 text-emerald-800">Tu Camión: ${_currentUserData.assignedTruckPlate}</p>
            <div class="mb-4">
                <label for="destinationTruckSelect" class="block text-gray-700 text-sm font-bold mb-2">Seleccionar Camión de Destino:</label>
                ${_createSelect('destinationTruckSelect', destinationTruckOptions, '', 'w-full')}
            </div>
            <p class="text-base text-center my-5 text-gray-600">Inventario de tu Camión (${_currentUserData.assignedTruckPlate}):</p>
            ${_createTable(['Imagen', 'SKU', 'Producto', 'Presentación', 'Cantidad a Transferir', 'Disponible'], productsHtml, 'transfer-products-body')}
            ${_createButton('Realizar Transbordo', 'performTransferButton', 'bg-emerald-600 mt-3 w-full')}
            ${_createButton('Volver', 'backToMainFromTransferInventoryButton', 'bg-gray-600 mt-5 w-full')}
        </div>
    `;
};

export const renderAdminTransferHistoryScreen = () => {
    if (!_isAdmin()) { _showMessageModal('Acceso denegado: Solo los administradores pueden acceder a esta sección.'); _setScreenAndRender('main'); return; }

    const transferHistoryRows = transferRecords.map(record => {
        const itemsSummary = record.items.map(item => `${item.producto} (${item.cantidadTransferida})`).join(', ');
        return `
            <tr>
                <td>${record.date}</td>
                <td>${record.sourceTruckPlate}</td>
                <td>${record.destinationTruckPlate}</td>
                <td>${record.transferringUserEmail}</td>
                <td>${itemsSummary}</td>
                <td>
                    ${_createButton('Descargar CSV', '', 'bg-blue-500 hover:bg-blue-600 text-white py-1 px-3 rounded-md text-sm download-transfer-csv-button', { recordid: record.docId })}
                </td>
            </tr>
        `;
    }).join('');

    document.getElementById('app-root').innerHTML = `
        <div class="screen-container bg-white rounded-xl m-2 shadow-md">
            <h2 class="text-2xl font-bold mb-5 text-center text-indigo-700">HISTORIAL DE TRANSBORDOS (ADMIN)</h2>
            ${_createTable(['Fecha', 'Camión Origen', 'Camión Destino', 'Usuario', 'Items Transferidos', 'Acciones'], transferHistoryRows, 'transfer-history-body')}
            ${_createButton('Limpiar Historial', 'clearTransferHistoryButton', 'bg-red-600 mt-3 w-full')}
            ${_createButton('Volver', 'backToMainFromAdminTransferHistoryButton', 'bg-gray-600 mt-5 w-full')}
        </div>
    `;
};

// --- Event Listener Attachments (for dynamic content) ---
const attachAssignVehicleEventListeners = () => {
    document.querySelectorAll('select[id^="assignVehicle-"]').forEach(select => {
        select.onchange = async (e) => {
            const userId = e.target.dataset.userid;
            const newPlate = e.target.value;
            const currentVehicle = e.target.dataset.currentvehicle;
            await assignVehicleToUser(userId, newPlate, currentVehicle);
        };
    });

    document.querySelectorAll('.remove-assignment-button').forEach(button => {
        button.onclick = async (e) => {
            const userId = e.target.dataset.userid;
            await removeVehicleAssignment(userId);
        };
    });
};

// --- Logic Functions ---
export const handleLoaderSelection = (userId) => {
    selectedLoader = userId;
};

export const handleTruckForReceivingSelection = (plate) => {
    selectedTruckForReceiving = plate;
};

export const handleReceivingQuantityChange = (sku, quantity) => {
    receivingQuantities[sku] = parseInt(quantity) || 0;
};

export const showLoadMerchandiseConfirmation = () => {
    _showConfirmationModal('¿Estás seguro de que quieres cargar la mercancía al camión? Esto actualizará el inventario principal y el del camión.', loadMerchandiseLogic);
};

const loadMerchandiseLogic = async () => {
    if (!selectedLoader) { _showMessageModal('Por favor, selecciona un cargador.'); return; }
    if (!selectedTruckForReceiving) { _showMessageModal('Por favor, selecciona un camión.'); return; }

    const itemsToLoad = [];
    let validationErrors = [];

    // Filter out items with 0 or invalid quantities
    for (const sku in receivingQuantities) {
        const quantity = receivingQuantities[sku];
        if (quantity > 0) {
            const mainInventoryItem = _inventory.find(item => item.sku === sku);
            if (!mainInventoryItem) {
                validationErrors.push(`Error: El SKU ${sku} no se encontró en el inventario principal.`);
                continue;
            }
            if (quantity > mainInventoryItem.cantidad) {
                validationErrors.push(`Error: Cantidad a cargar de "${mainInventoryItem.producto}" (${quantity}) excede el stock disponible (${mainInventoryItem.cantidad}).`);
            } else {
                itemsToLoad.push({
                    sku: sku,
                    producto: mainInventoryItem.producto,
                    presentacion: mainInventoryItem.presentacion,
                    cantidadCargada: quantity,
                    precio: mainInventoryItem.precio // Include price for truck inventory
                });
            }
        }
    }

    if (validationErrors.length > 0) { _showMessageModal(validationErrors.join('\n')); return; }
    if (itemsToLoad.length === 0) { _showMessageModal('No se ha ingresado ninguna cantidad para cargar.'); return; }

    try {
        const batch = _db.batch();

        // 1. Update Main Inventory
        const updatedMainInventory = JSON.parse(JSON.stringify(_inventory));
        itemsToLoad.forEach(loadedItem => {
            const mainItem = updatedMainInventory.find(item => item.sku === loadedItem.sku);
            if (mainItem) {
                mainItem.cantidad -= loadedItem.cantidadCargada;
                batch.set(_db.collection('inventory').doc(mainItem.sku), mainItem);
            }
        });
        _inventory.splice(0, _inventory.length, ...updatedMainInventory.filter(item => item.cantidad > 0)); // Update global array in place

        // 2. Update Truck Inventory
        const truckInventoryRef = _db.collection('truck_inventories').doc(selectedTruckForReceiving);
        const truckInventoryDoc = await truckInventoryRef.get();
        let currentTruckItems = truckInventoryDoc.exists ? (truckInventoryDoc.data().items || []) : [];

        itemsToLoad.forEach(loadedItem => {
            const existingTruckItemIndex = currentTruckItems.findIndex(item => item.sku === loadedItem.sku);
            if (existingTruckItemIndex !== -1) {
                currentTruckItems[existingTruckItemIndex].quantity += loadedItem.cantidadCargada;
            } else {
                currentTruckItems.push({
                    sku: loadedItem.sku,
                    producto: loadedItem.producto,
                    presentacion: loadedItem.presentacion,
                    quantity: loadedItem.cantidadCargada,
                    price: loadedItem.precio // Use 'price' for truck inventory for consistency
                });
            }
        });
        batch.set(truckInventoryRef, { items: currentTruckItems });
        currentTruckInventory.splice(0, currentTruckInventory.length, ...currentTruckItems); // Update local truck inventory

        // 3. Record Load History
        const loaderUser = _users.find(u => u.uid === selectedLoader);
        const loadRecord = {
            date: new Date().toLocaleDateString('es-ES'),
            truckPlate: selectedTruckForReceiving,
            loaderId: selectedLoader,
            loaderEmail: loaderUser ? loaderUser.email : 'Desconocido',
            items: itemsToLoad,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        const loadDocRef = _db.collection('loadRecords').doc();
        batch.set(loadDocRef, loadRecord);
        loadRecords.push({ docId: loadDocRef.id, ...loadRecord }); // Update local loadRecords

        await batch.commit();
        _showMessageModal('Mercancía cargada exitosamente.');
        selectedLoader = null;
        selectedTruckForReceiving = null;
        receivingQuantities = {};
        await _fetchDataFromFirestore(); // Re-fetch all data to ensure UI consistency
        _setScreenAndRender('cargaSelection');
    } catch (error) {
        console.error('Error al cargar mercancía:', error);
        _showMessageModal('Error al cargar mercancía. Por favor, revisa tu conexión y las reglas de seguridad de Firestore.');
    }
};

export const showClearLoadHistoryConfirmation = () => {
    _showConfirmationModal('¿Estás seguro de que quieres limpiar todo el historial de cargas? Esta acción es irreversible.', clearLoadHistoryLogic);
};

const clearLoadHistoryLogic = async () => {
    try {
        const batch = _db.batch();
        loadRecords.forEach(record => {
            batch.delete(_db.collection('loadRecords').doc(record.docId));
        });
        await batch.commit();
        loadRecords = []; // Clear local array
        _showMessageModal('Historial de cargas limpiado exitosamente.');
        _setScreenAndRender('cargaSelection');
    } catch (error) {
        console.error('Error al limpiar historial de cargas:', error);
        _showMessageModal('Error al limpiar historial de cargas. Revisa tu conexión y reglas de seguridad.');
    }
};

export const filterInventoryForUserScreen = (searchTerm) => {
    const tableBody = document.getElementById('user-inventory-body');
    if (!tableBody) return;

    const inventoryToFilter = _currentUserData.assignedTruckPlate ? currentTruckInventory : _inventory;
    const filteredItems = inventoryToFilter.filter(item =>
        item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.producto.toLowerCase().includes(searchTerm.toLowerCase())
    );

    tableBody.innerHTML = filteredItems.map(item => `
        <tr>
            <td><img src="${_productImages[item.sku] || _productImages['default']}" alt="Imagen de ${item.producto}" class="w-10 h-10 rounded-md object-cover"></td>
            <td>${item.sku}</td>
            <td>${item.producto}</td>
            <td>${item.presentacion}</td>
            <td>${item.quantity !== undefined ? item.quantity : item.cantidad}</td>
            <td>$${(item.price !== undefined ? item.price : item.precio).toFixed(2)}</td>
        </tr>
    `).join('');
};

export const filterInventoryForAdminMainScreen = (searchTerm) => {
    const tableBody = document.getElementById('admin-main-inventory-body');
    if (!tableBody) return;

    const filteredItems = _inventory.filter(item =>
        item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.producto.toLowerCase().includes(searchTerm.toLowerCase())
    );

    tableBody.innerHTML = filteredItems.map(item => `
        <tr>
            <td><img src="${_productImages[item.sku] || _productImages['default']}" alt="Imagen de ${item.producto}" class="w-10 h-10 rounded-md object-cover"></td>
            <td>${item.sku}</td>
            <td>${item.producto}</td>
            <td>${item.presentacion}</td>
            <td>${item.cantidad}</td>
            <td>$${item.precio.toFixed(2)}</td>
        </tr>
    `).join('');
};

export const handleAdminVehicleSelection = async (plate) => {
    selectedAdminVehicle = plate;
    if (plate) {
        setupAdminTruckInventoryListener(plate); // Setup real-time listener for admin view
    } else {
        if (adminTruckInventoryUnsubscribe) {
            adminTruckInventoryUnsubscribe();
            adminTruckInventoryUnsubscribe = null;
        }
        currentTruckInventory = []; // Clear displayed inventory if no truck selected
    }
    _setScreenAndRender('adminVehicleInventory'); // Re-render to update the displayed inventory
};


export const filterInventoryForAdminTruckScreen = (searchTerm) => {
    const tableBody = document.getElementById('admin-truck-inventory-body');
    if (!tableBody) return;

    const filteredItems = currentTruckInventory.filter(item =>
        item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.producto.toLowerCase().includes(searchTerm.toLowerCase())
    );

    tableBody.innerHTML = filteredItems.map(item => `
        <tr>
            <td><img src="${_productImages[item.sku] || _productImages['default']}" alt="Imagen de ${item.producto}" class="w-10 h-10 rounded-md object-cover"></td>
            <td>${item.sku}</td>
            <td>${item.producto}</td>
            <td>${item.presentacion}</td>
            <td>${item.quantity}</td>
            <td>$${item.price.toFixed(2)}</td>
        </tr>
    `).join('');
};

export const handleAddVehicle = () => {
    editingVehicle = { plate: '', model: '', capacity: 0, assignedUser: null };
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

const renderEditVehicleModal = () => {
    if (!editingVehicle) return '';
    const isNew = !editingVehicle.plate;
    const userOptions = _users.map(user => ({ value: user.uid, text: user.email }));

    const modalHtml = `
        <div id="edit-vehicle-modal" class="modal">
            <div class="modal-content">
                <h3 class="text-2xl font-bold mb-4 text-center text-indigo-700">${isNew ? 'Agregar Nuevo Vehículo' : 'Editar Vehículo'}</h3>
                ${_createInput('vehiclePlate', 'Placa del Vehículo', editingVehicle.plate, 'text', !isNew)}
                ${_createInput('vehicleModel', 'Modelo', editingVehicle.model)}
                ${_createInput('vehicleCapacity', 'Capacidad (kg)', editingVehicle.capacity, 'number')}
                <div class="mb-4">
                    <label for="assignedUserSelect" class="block text-gray-700 text-sm font-bold mb-2">Usuario Asignado:</label>
                    ${_createSelect('assignedUserSelect', userOptions, editingVehicle.assignedUser || '', 'w-full', '-- Ninguno --')}
                </div>
                <div class="flex justify-around gap-4 mt-5">
                    ${_createButton('Guardar Vehículo', 'saveEditedVehicleButton', 'bg-emerald-600 flex-1')}
                    ${_createButton('Cancelar', 'cancelEditVehicleButton', 'bg-gray-600 flex-1')}
                </div>
            </div>
        </div>
    `;
    const appRoot = document.getElementById('app-root');
    if (appRoot) {
        const existingModal = document.getElementById('edit-vehicle-modal');
        if (existingModal) existingModal.remove();
        appRoot.insertAdjacentHTML('beforeend', modalHtml);
    }
};

export const saveEditedVehicle = async () => {
    const isNew = !editingVehicle.plate;
    const vehicleData = {
        plate: document.getElementById('vehiclePlate').value.trim(),
        model: document.getElementById('vehicleModel').value.trim(),
        capacity: parseInt(document.getElementById('vehicleCapacity').value) || 0,
        assignedUser: document.getElementById('assignedUserSelect').value || null,
    };

    if (!vehicleData.plate || !vehicleData.model || vehicleData.capacity <= 0) {
        _showMessageModal('Placa, Modelo y Capacidad son campos obligatorios y la capacidad debe ser mayor a 0.');
        return;
    }

    try {
        const batch = _db.batch();

        // Handle previous assignment if a user was assigned to this vehicle
        const oldVehicleData = _vehicles.find(v => v.plate === editingVehicle.plate);
        if (oldVehicleData && oldVehicleData.assignedUser && oldVehicleData.assignedUser !== vehicleData.assignedUser) {
            // Unassign from old user
            const oldUserRef = _db.collection('users').doc(oldVehicleData.assignedUser);
            batch.update(oldUserRef, { assignedTruckPlate: null });
        }

        // Handle new assignment if a user is being assigned to this vehicle
        if (vehicleData.assignedUser) {
            // Check if the new user is already assigned to another vehicle
            const existingAssignment = _vehicles.find(v => v.assignedUser === vehicleData.assignedUser && v.plate !== vehicleData.plate);
            if (existingAssignment) {
                // Remove existing assignment from the other vehicle
                const otherVehicleRef = _db.collection('vehicles').doc(existingAssignment.plate);
                batch.update(otherVehicleRef, { assignedUser: null });
                _showMessageModal(`El usuario ya estaba asignado al camión ${existingAssignment.plate}. Se ha desasignado de ese camión.`);
            }
            // Assign to new user
            const newUserRef = _db.collection('users').doc(vehicleData.assignedUser);
            batch.update(newUserRef, { assignedTruckPlate: vehicleData.plate });
        }

        if (isNew) {
            await _db.collection('vehicles').doc(vehicleData.plate).set(vehicleData);
            _vehicles.push(vehicleData);
        } else {
            await _db.collection('vehicles').doc(editingVehicle.plate).update(vehicleData);
            const index = _vehicles.findIndex(v => v.plate === editingVehicle.plate);
            if (index !== -1) _vehicles[index] = vehicleData;
        }

        await batch.commit();
        _showMessageModal('Vehículo guardado exitosamente.');
        editingVehicle = null; // Close modal
        await _fetchDataFromFirestore(); // Re-fetch all data to update local arrays and UI
        _setScreenAndRender('vehicles'); // Re-render the vehicle list
    } catch (error) {
        console.error('Error al guardar vehículo:', error);
        _showMessageModal('Error al guardar vehículo. Revisa tu conexión y reglas de seguridad.');
    }
};

export const showDeleteVehicleConfirmation = (plate) => {
    _showConfirmationModal(`¿Estás seguro de que quieres eliminar el vehículo con placa "${plate}"? Esto también desvinculará a cualquier usuario asignado.`, () => deleteVehicle(plate));
};

const deleteVehicle = async (plate) => {
    try {
        const batch = _db.batch();
        batch.delete(_db.collection('vehicles').doc(plate));

        // Unassign user if any
        const vehicleToDelete = _vehicles.find(v => v.plate === plate);
        if (vehicleToDelete && vehicleToDelete.assignedUser) {
            const userRef = _db.collection('users').doc(vehicleToDelete.assignedUser);
            batch.update(userRef, { assignedTruckPlate: null });
        }

        await batch.commit();
        _vehicles = _vehicles.filter(v => v.plate !== plate); // Update local array
        _showMessageModal('Vehículo eliminado exitosamente.');
        await _fetchDataFromFirestore(); // Re-fetch all data to update local arrays and UI
        _setScreenAndRender('vehicles'); // Re-render the vehicle list
    } catch (error) {
        console.error('Error al eliminar vehículo:', error);
        _showMessageModal('Error al eliminar vehículo. Revisa tu conexión y reglas de seguridad.');
    }
};

const assignVehicleToUser = async (userId, newPlate, currentVehicle) => {
    try {
        const batch = _db.batch();

        // 1. Unassign old vehicle from user if exists
        const userRef = _db.collection('users').doc(userId);
        batch.update(userRef, { assignedTruckPlate: newPlate || null });

        // 2. Clear old vehicle's assignedUser if it was assigned to this user
        if (currentVehicle && currentVehicle !== newPlate) {
            const oldVehicleRef = _db.collection('vehicles').doc(currentVehicle);
            batch.update(oldVehicleRef, { assignedUser: null });
        }

        // 3. Assign new vehicle's assignedUser
        if (newPlate) {
            // Check if the new vehicle is already assigned to another user
            const existingAssignment = _users.find(u => _vehicles.find(v => v.plate === newPlate && v.assignedUser === u.uid));
            if (existingAssignment && existingAssignment.uid !== userId) {
                // Remove existing assignment from the other user
                const otherUserRef = _db.collection('users').doc(existingAssignment.uid);
                batch.update(otherUserRef, { assignedTruckPlate: null });
                _showMessageModal(`El camión ${newPlate} ya estaba asignado a ${existingAssignment.email}. Se ha desasignado de ese usuario.`);
            }
            const newVehicleRef = _db.collection('vehicles').doc(newPlate);
            batch.update(newVehicleRef, { assignedUser: userId });
        }

        await batch.commit();
        _showMessageModal(`Vehículo ${newPlate || 'ninguno'} asignado a ${(_users.find(u => u.uid === userId)?.email || userId)} exitosamente.`);
        await _fetchDataFromFirestore(); // Re-fetch all data to update local arrays and UI
        _setScreenAndRender('assignVehicle'); // Re-render the assignment screen
    } catch (error) {
        console.error('Error al asignar vehículo:', error);
        _showMessageModal('Error al asignar vehículo. Revisa tu conexión y reglas de seguridad.');
    }
};

const removeVehicleAssignment = async (userId) => {
    _showConfirmationModal(`¿Estás seguro de que quieres desasignar el vehículo de este usuario?`, async () => {
        try {
            const batch = _db.batch();

            const userRef = _db.collection('users').doc(userId);
            const userDoc = await userRef.get();
            const userData = userDoc.data();
            const assignedTruckPlate = userData.assignedTruckPlate;

            if (assignedTruckPlate) {
                // Unassign from user
                batch.update(userRef, { assignedTruckPlate: null });

                // Clear vehicle's assignedUser
                const vehicleRef = _db.collection('vehicles').doc(assignedTruckPlate);
                batch.update(vehicleRef, { assignedUser: null });
            }

            await batch.commit();
            _showMessageModal('Vehículo desasignado exitosamente.');
            await _fetchDataFromFirestore(); // Re-fetch all data to update local arrays and UI
            _setScreenAndRender('assignVehicle'); // Re-render the assignment screen
        } catch (error) {
            console.error('Error al desasignar vehículo:', error);
            _showMessageModal('Error al desasignar vehículo. Revisa tu conexión y reglas de seguridad.');
        }
    });
};

export const handleResetCargasInicialesPassword = async () => {
    const adminPassword = document.getElementById('adminPasswordForReset').value;
    // In a real application, you would verify this password against a secure backend.
    // For this example, we'll use a simple hardcoded check.
    if (adminPassword === 'admin123') { // REPLACE WITH A SECURE METHOD IN PRODUCTION
        _setScreenAndRender('resetCargasInicialesEdit');
    } else {
        _showMessageModal('Contraseña de administrador incorrecta.');
    }
};

export const handleResetQuantityChange = (sku, type, quantity, truckPlate = null) => {
    const key = type === 'main' ? `main-${sku}` : `truck-${truckPlate}-${sku}`;
    resetQuantities[key] = parseInt(quantity) || 0;
};

export const saveResetCargasIniciales = async () => {
    _showConfirmationModal('¿Estás seguro de que quieres guardar estos cambios de cargas iniciales? Esto modificará permanentemente los inventarios.', async () => {
        try {
            const batch = _db.batch();

            // Update Main Inventory
            for (const item of _inventory) {
                const newQty = resetQuantities[`main-${item.sku}`];
                if (newQty !== undefined && newQty !== item.cantidad) {
                    batch.set(_db.collection('inventory').doc(item.sku), { ...item, cantidad: newQty });
                }
            }

            // Update Truck Inventories
            for (const vehicle of _vehicles) {
                const truckInventoryRef = _db.collection('truck_inventories').doc(vehicle.plate);
                const truckInventoryDoc = await truckInventoryRef.get();
                let currentTruckItems = truckInventoryDoc.exists ? (truckInventoryDoc.data().items || []) : [];

                let updatedTruckItems = JSON.parse(JSON.stringify(currentTruckItems)); // Deep copy

                for (const item of currentTruckItems) {
                    const newQty = resetQuantities[`truck-${vehicle.plate}-${item.sku}`];
                    if (newQty !== undefined && newQty !== item.quantity) {
                        const index = updatedTruckItems.findIndex(i => i.sku === item.sku);
                        if (index !== -1) {
                            updatedTruckItems[index].quantity = newQty;
                        }
                    }
                }
                // Add new items if they were set in resetQuantities but not originally in truck inventory
                for (const key in resetQuantities) {
                    if (key.startsWith(`truck-${vehicle.plate}-`)) {
                        const sku = key.split('-')[2];
                        const newQty = resetQuantities[key];
                        if (newQty > 0 && !updatedTruckItems.some(item => item.sku === sku)) {
                            const mainProduct = _inventory.find(p => p.sku === sku);
                            if (mainProduct) {
                                updatedTruckItems.push({
                                    sku: mainProduct.sku,
                                    producto: mainProduct.producto,
                                    presentacion: mainProduct.presentacion,
                                    quantity: newQty,
                                    price: mainProduct.precio
                                });
                            }
                        }
                    }
                }

                batch.set(truckInventoryRef, { items: updatedTruckItems.filter(item => item.quantity > 0) });
            }

            await batch.commit();
            _showMessageModal('Cargas iniciales actualizadas exitosamente.');
            await _fetchDataFromFirestore(); // Re-fetch all data
            _setScreenAndRender('cargaSelection');
        } catch (error) {
            console.error('Error al guardar cambios de cargas iniciales:', error);
            _showMessageModal('Error al guardar cambios de cargas iniciales. Revisa tu conexión y reglas de seguridad.');
        }
    });
};

export const handleTransferInventoryPassword = async () => {
    const userPassword = document.getElementById('userPasswordForTransfer').value;
    // In a real application, verify against the currently logged-in user's password.
    // For simplicity, we'll just check if it's not empty.
    if (userPassword.length > 0) { // REPLACE WITH ACTUAL PASSWORD VERIFICATION IN PRODUCTION
        _setScreenAndRender('transferInventory');
    } else {
        _showMessageModal('Por favor, ingresa tu contraseña.');
    }
};

export const handleDestinationTruckSelection = (plate) => {
    // No need to fetch inventory here, it's just for the transfer record.
    // The currentTruckInventory is already the source.
};

export const handleTransferQuantityChange = (sku, quantity) => {
    transferQuantities[sku] = parseInt(quantity) || 0;
};

export const showTransferConfirmation = () => {
    _showConfirmationModal('¿Estás seguro de que quieres realizar este transbordo? Esto moverá el inventario entre camiones.', performTransferLogic);
};

const performTransferLogic = async () => {
    const sourceTruckPlate = _currentUserData.assignedTruckPlate;
    const destinationTruckPlate = document.getElementById('destinationTruckSelect').value;

    if (!sourceTruckPlate) { _showMessageModal('No tienes un camión de origen asignado.'); return; }
    if (!destinationTruckPlate) { _showMessageModal('Por favor, selecciona un camión de destino.'); return; }
    if (sourceTruckPlate === destinationTruckPlate) { _showMessageModal('El camión de origen y destino no pueden ser el mismo.'); return; }

    const itemsToTransfer = [];
    let validationErrors = [];

    // Validate quantities against source truck's current inventory
    const currentSourceTruckInventory = JSON.parse(JSON.stringify(currentTruckInventory)); // Deep copy
    for (const sku in transferQuantities) {
        const quantity = transferQuantities[sku];
        if (quantity > 0) {
            const sourceItem = currentSourceTruckInventory.find(item => item.sku === sku);
            if (!sourceItem) {
                validationErrors.push(`Error: El SKU ${sku} no se encontró en el inventario de tu camión.`);
                continue;
            }
            if (quantity > sourceItem.quantity) {
                validationErrors.push(`Error: Cantidad a transferir de "${sourceItem.producto}" (${quantity}) excede el stock disponible (${sourceItem.quantity}).`);
            } else {
                itemsToTransfer.push({
                    sku: sku,
                    producto: sourceItem.producto,
                    presentacion: sourceItem.presentacion,
                    cantidadTransferida: quantity,
                    price: sourceItem.price
                });
            }
        }
    }

    if (validationErrors.length > 0) { _showMessageModal(validationErrors.join('\n')); return; }
    if (itemsToTransfer.length === 0) { _showMessageModal('No se ha ingresado ninguna cantidad para transferir.'); return; }

    try {
        const batch = _db.batch();

        // 1. Update Source Truck Inventory
        let updatedSourceTruckItems = JSON.parse(JSON.stringify(currentSourceTruckInventory));
        itemsToTransfer.forEach(transferItem => {
            const sourceItemIndex = updatedSourceTruckItems.findIndex(item => item.sku === transferItem.sku);
            if (sourceItemIndex !== -1) {
                updatedSourceTruckItems[sourceItemIndex].quantity -= transferItem.cantidadTransferida;
            }
        });
        batch.set(_db.collection('truck_inventories').doc(sourceTruckPlate), { items: updatedSourceTruckItems.filter(item => item.quantity > 0) });
        currentTruckInventory.splice(0, currentTruckInventory.length, ...updatedSourceTruckItems.filter(item => item.quantity > 0)); // Update local

        // 2. Update Destination Truck Inventory
        const destinationTruckRef = _db.collection('truck_inventories').doc(destinationTruckPlate);
        const destinationTruckDoc = await destinationTruckRef.get();
        let currentDestinationTruckItems = destinationTruckDoc.exists ? (destinationTruckDoc.data().items || []) : [];

        itemsToTransfer.forEach(transferItem => {
            const existingDestinationItemIndex = currentDestinationTruckItems.findIndex(item => item.sku === transferItem.sku);
            if (existingDestinationItemIndex !== -1) {
                currentDestinationTruckItems[existingDestinationItemIndex].quantity += transferItem.cantidadTransferida;
            } else {
                currentDestinationTruckItems.push({
                    sku: transferItem.sku,
                    producto: transferItem.producto,
                    presentacion: transferItem.presentacion,
                    quantity: transferItem.cantidadTransferida,
                    price: transferItem.price
                });
            }
        });
        batch.set(destinationTruckRef, { items: currentDestinationTruckItems });

        // 3. Record Transfer History
        const transferringUser = _users.find(u => u.uid === _currentUserData.uid);
        const transferRecord = {
            date: new Date().toLocaleDateString('es-ES'),
            sourceTruckPlate: sourceTruckPlate,
            destinationTruckPlate: destinationTruckPlate,
            transferringUserId: _currentUserData.uid,
            transferringUserEmail: transferringUser ? transferringUser.email : 'Desconocido',
            items: itemsToTransfer,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        const transferDocRef = _db.collection('transferRecords').doc();
        batch.set(transferDocRef, transferRecord);
        transferRecords.push({ docId: transferDocRef.id, ...transferRecord }); // Update local transferRecords

        await batch.commit();
        _showMessageModal('Transbordo realizado exitosamente.');
        transferQuantities = {}; // Clear quantities
        await _fetchDataFromFirestore(); // Re-fetch all data to ensure UI consistency
        _setScreenAndRender('main'); // Go back to main screen after transfer
    } catch (error) {
        console.error('Error al realizar transbordo:', error);
        _showMessageModal('Error al realizar transbordo. Por favor, revisa tu conexión y las reglas de seguridad de Firestore.');
    }
};

export const showClearTransferHistoryConfirmation = () => {
    _showConfirmationModal('¿Estás seguro de que quieres limpiar todo el historial de transbordos? Esta acción es irreversible.', clearTransferHistoryLogic);
};

const clearTransferHistoryLogic = async () => {
    try {
        const batch = _db.batch();
        transferRecords.forEach(record => {
            batch.delete(_db.collection('transferRecords').doc(record.docId));
        });
        await batch.commit();
        transferRecords = []; // Clear local array
        _showMessageModal('Historial de transbordos limpiado exitosamente.');
        _setScreenAndRender('main');
    } catch (error) {
        console.error('Error al limpiar historial de transbordos:', error);
        _showMessageModal('Error al limpiar historial de transbordos. Revisa tu conexión y reglas de seguridad.');
    }
};

// --- File Upload/Download Handlers (delegated from index.html) ---
export const handleFileUpload = async (event, type) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        const parsedData = parseCSV(e.target.result); // Assuming parseCSV is available or passed
        try {
            const collectionRef = _db.collection(type);
            const existingSnapshot = await collectionRef.get();
            const deleteBatch = _db.batch();
            existingSnapshot.docs.forEach(doc => deleteBatch.delete(doc.ref));
            await deleteBatch.commit();
            console.log(`[handleFileUpload] Existing ${type} documents deleted.`);

            const addBatch = _db.batch();
            for (const row of parsedData) {
                let docId = row.sku || row.plate || row.id; // Determine docId based on type
                if (!docId) {
                    console.warn(`Skipping row due to missing ID for type ${type}:`, row);
                    continue;
                }
                addBatch.set(collectionRef.doc(docId), row);
            }
            await addBatch.commit();
            console.log(`[handleFileUpload] New ${type} documents added.`);
            _showMessageModal(`${type}.csv cargado y guardado exitosamente en Firestore.`);
        } catch (error) {
            console.error(`Error al cargar archivo ${type}.csv a Firestore:`, error);
            _showMessageModal(`Error al cargar archivo ${type}.csv. Por favor, revisa tu conexión y las reglas de seguridad de Firestore.`);
        }
    };
    reader.readAsText(file);
};

export const downloadExistingCSV = (filename) => {
    let csvContent = '';
    let dataToDownload = [];
    let headers = [];

    if (filename === 'inventario.csv') {
        dataToDownload = _inventory;
        headers = ['sku', 'rubro', 'segmento', 'producto', 'presentacion', 'cantidad', 'precio'];
    } else if (filename === 'vehiculos.csv') {
        dataToDownload = _vehicles;
        headers = ['plate', 'model', 'capacity', 'assignedUser'];
    } else if (filename.startsWith('carga_')) {
        const recordId = filename.replace('carga_', '').replace('.csv', '');
        const record = loadRecords.find(r => r.docId === recordId);
        if (record) {
            csvContent = `Fecha:,${record.date}\nCamión:,${record.truckPlate}\nCargador:,${record.loaderEmail}\n\nSKU,Producto,Presentacion,Cantidad Cargada,Precio\n` +
                         record.items.map(item => `${item.sku},${item.producto},${item.presentacion},${item.cantidadCargada},${item.precio.toFixed(2)}`).join('\n');
        } else {
            _showMessageModal(`No se encontró el registro de carga para el archivo: ${filename}`);
            return;
        }
    } else if (filename.startsWith('traslado_')) {
        const recordId = filename.replace('traslado_', '').replace('.csv', '');
        const record = transferRecords.find(r => r.docId === recordId);
        if (record) {
            csvContent = `Fecha:,${record.date}\nCamión Origen:,${record.sourceTruckPlate}\nCamión Destino:,${record.destinationTruckPlate}\nUsuario:,${record.transferringUserEmail}\n\nSKU,Producto,Presentacion,Cantidad Transferida,Precio\n` +
                         record.items.map(item => `${item.sku},${item.producto},${item.presentacion},${item.cantidadTransferida},${item.price.toFixed(2)}`).join('\n');
        } else {
            _showMessageModal(`No se encontró el registro de transbordo para el archivo: ${filename}`);
            return;
        }
    } else {
        _showMessageModal(`Tipo de archivo no reconocido para descarga: ${filename}`);
        return;
    }

    if (!csvContent) { // If it's not a special case handled above
        csvContent = toCSV(dataToDownload, headers); // Assuming toCSV is available or passed
    }
    triggerCSVDownload(filename, csvContent); // Assuming triggerCSVDownload is available or passed
};

// Helper for CSV download (assuming it's passed from index.html init)
let toCSV;
let triggerCSVDownload;
export const setCsvHelpers = (csvToFunc, csvTriggerFunc) => {
    toCSV = csvToFunc;
    triggerCSVDownload = csvTriggerFunc;
};
