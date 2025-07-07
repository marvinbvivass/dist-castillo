// inventoryModule.js

// Variables que se inyectarán desde el módulo principal (index.html)
let _isAdmin;
let _isUser;
let _currentUserData;
let _inventory;
let _currentTruckInventory;
let _vehicles;
let _db;
let _showMessageModal;
let _setScreenAndRender;

// Estado local del módulo de inventario
let _currentAdminInventoryView = 'main'; // 'main' o un 'plate' de camión
let _selectedAdminVehicleForInventory = null; // El vehículo seleccionado por el admin para ver su inventario

export const initInventoryModule = (dependencies) => {
    _isAdmin = dependencies.isAdmin;
    _isUser = dependencies.isUser;
    _currentUserData = dependencies.currentUserData;
    _inventory = dependencies.inventory;
    _currentTruckInventory = dependencies.currentTruckInventory;
    _vehicles = dependencies.vehicles;
    _db = dependencies.db;
    _showMessageModal = dependencies.showMessageModal;
    _setScreenAndRender = dependencies.setScreenAndRender;

    // Inicializar estados locales si se pasan como dependencias o se necesitan valores iniciales
    _currentAdminInventoryView = dependencies.currentAdminInventoryView || 'main';
    _selectedAdminVehicleForInventory = dependencies.selectedAdminVehicleForInventory || null;
};

// Pantalla de selección de inventario para administradores
export const renderAdminInventorySelection = () => {
    if (!_isAdmin()) {
        _showMessageModal('Acceso denegado: Solo los administradores pueden acceder a esta sección de inventario.');
        _setScreenAndRender('main');
        return;
    }

    const selectionDiv = document.createElement('div');
    selectionDiv.className = 'screen-container bg-white rounded-xl m-2 shadow-md';
    selectionDiv.innerHTML = `
        <h2 class="text-2xl font-bold mb-5 text-center text-indigo-700">SELECCIÓN DE INVENTARIO</h2>
        <p class="text-base text-center my-5 text-gray-600">
            Selecciona qué inventario deseas visualizar.
        </p>
        <div class="flex flex-wrap justify-center gap-4">
            <button class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-6 rounded-lg m-2 min-w-[150px] shadow-md transition duration-300 ease-in-out transform hover:scale-105 border border-indigo-700" onclick="inventoryModule.setAdminInventoryView('main')">INVENTARIO PRINCIPAL</button>
            <button class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-6 rounded-lg m-2 min-w-[150px] shadow-md transition duration-300 ease-in-out transform hover:scale-105 border border-indigo-700" onclick="inventoryModule.renderAdminVehicleInventoryScreen()">INVENTARIO POR VEHÍCULO</button>
        </div>
        <button class="bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-5 rounded-lg mt-5 w-full shadow-md transition duration-300 ease-in-out transform hover:scale-105" onclick="_setScreenAndRender('main')">Volver</button>
    `;
    document.getElementById('app-root').appendChild(selectionDiv);
};

// Función para establecer la vista de inventario del admin
export const setAdminInventoryView = async (viewType, plate = null) => {
    _currentAdminInventoryView = viewType;
    _selectedAdminVehicleForInventory = plate ? _vehicles.find(v => v.plate === plate) : null;

    renderInventarioScreen(); // Reutiliza la función de renderizado de inventario
};

// renderInventarioScreen ahora es más flexible y asíncrona
export const renderInventarioScreen = async () => {
    const inventarioDiv = document.createElement('div');
    inventarioDiv.className = 'screen-container bg-white rounded-xl m-2 shadow-md';
    inventarioDiv.innerHTML = `
        <h2 class="text-2xl font-bold mb-5 text-center text-indigo-700">INVENTARIO Actual</h2>
        <div id="inventory-content"></div>
        <button class="bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-5 rounded-lg mt-5 w-full shadow-md transition duration-300 ease-in-out transform hover:scale-105" onclick="${_isAdmin() ? "inventoryModule.renderAdminInventorySelection()" : "_setScreenAndRender('main')"}">Volver</button>
    `;
    document.getElementById('app-root').appendChild(inventarioDiv);

    const inventoryContentDiv = document.getElementById('inventory-content');

    let displayInventory = [];
    let inventorySourceText = '';

    if (_isAdmin()) {
        if (_currentAdminInventoryView === 'main') {
            displayInventory = _inventory;
            inventorySourceText = ' (Almacén Principal)';
            updateInventoryDisplayTable(inventoryContentDiv, displayInventory, inventorySourceText);
        } else if (_currentAdminInventoryView === 'vehicle' && _selectedAdminVehicleForInventory) {
            inventorySourceText = ` (Camión: ${_selectedAdminVehicleForInventory.name} - ${_selectedAdminVehicleForInventory.plate})`;
            inventoryContentDiv.innerHTML = `<p class="text-center text-gray-600 text-lg py-4">Cargando inventario para ${_selectedAdminVehicleForInventory.name}...</p>`;
            try {
                const truckInventoryDoc = await _db.collection('truck_inventories').doc(_selectedAdminVehicleForInventory.plate).get();
                displayInventory = truckInventoryDoc.exists ? (truckInventoryDoc.data().items || []) : [];
                if (displayInventory.length === 0) {
                     inventoryContentDiv.innerHTML = `
                        <p class="text-center text-gray-600 text-lg py-4">Inventario del camión ${_selectedAdminVehicleForInventory.name} vacío por el momento.</p>
                    `;
                } else {
                    updateInventoryDisplayTable(inventoryContentDiv, displayInventory, inventorySourceText);
                }
            } catch (error) {
                console.error('Error al cargar inventario del camión para admin:', error);
                _showMessageModal('Error al cargar el inventario del camión. Intenta de nuevo.');
                inventoryContentDiv.innerHTML = `<p class="text-center text-red-600 text-lg py-4">Error al cargar el inventario del camión.</p>`;
            }
            return; // Salir aquí ya que el contenido se actualiza de forma asíncrona
        } else if (_currentAdminInventoryView === 'vehicle' && !_selectedAdminVehicleForInventory) {
            inventoryContentDiv.innerHTML = `
                <p class="text-center text-gray-600 text-lg py-4">Por favor, seleccione un vehículo para ver su inventario.</p>
            `;
            return;
        }
    } else { // Usuario normal
        if (_currentUserData.assignedTruckPlate) {
            displayInventory = _currentTruckInventory; // Esto es correctamente el inventario del camión asignado al usuario
            inventorySourceText = ` (Camión: ${_currentUserData.assignedTruckPlate})`;
            if (displayInventory.length === 0) {
                inventoryContentDiv.innerHTML = `
                    <p class="text-center text-gray-600 text-lg py-4">Inventario del camión vacío por el momento.</p>
                `;
                return;
            }
        } else {
            inventoryContentDiv.innerHTML = `
                <p class="text-center text-red-600 text-lg py-4">Todavía no tienes un vehículo asignado.</p>
                <p class="text-center text-gray-600 text-md">Por favor, contacta a un administrador para que te asigne uno.</p>
            `;
            return;
        }
    }

    // Esta línea solo se alcanzará para _isAdmin() && _currentAdminInventoryView === 'main'
    // o para los casos de _isUser() donde _currentTruckInventory está poblado.
    updateInventoryDisplayTable(inventoryContentDiv, displayInventory, inventorySourceText);
};

// Función auxiliar para actualizar la tabla de inventario
const updateInventoryDisplayTable = (containerDiv, displayInventory, inventorySourceText) => {
    let tableHtml = `
        <p class="text-base text-center mb-4 text-gray-700">Mostrando inventario${inventorySourceText}</p>
        <div class="table-container mb-5">
            <table>
                <thead>
                    <tr>
                        <th>Rubro</th>
                        <th>Sku</th>
                        <th>Producto</th>
                        <th>Presentación</th>
                        <th>Cantidad</th>
                        <th>Precio</th>
                    </tr>
                </thead>
                <tbody id="inventory-display-body">
                </tbody>
            </table>
        </div>
    `;
    containerDiv.innerHTML = tableHtml;

    const inventoryDisplayBody = document.getElementById('inventory-display-body');
    displayInventory.forEach(item => {
        const row = document.createElement('tr');
        const quantity = item.quantity !== undefined ? item.quantity : item.cantidad;
        const price = item.price !== undefined ? item.price : item.precio;
        row.innerHTML = `
            <td>${item.rubro}</td>
            <td>${item.sku}</td>
            <td>${item.producto}</td>
            <td>${item.presentacion}</td>
            <td>${quantity}</td>
            <td>$${price.toFixed(2)}</td>
        `;
        inventoryDisplayBody.appendChild(row);
    });
};

// Pantalla para que el admin seleccione un vehículo para ver su inventario
export const renderAdminVehicleInventoryScreen = () => {
    if (!_isAdmin()) {
        _showMessageModal('Acceso denegado: Solo los administradores pueden acceder a esta sección.');
        _setScreenAndRender('main');
        return;
    }

    const adminVehicleInventoryDiv = document.createElement('div');
    adminVehicleInventoryDiv.className = 'screen-container bg-white rounded-xl m-2 shadow-md';
    adminVehicleInventoryDiv.innerHTML = `
        <h2 class="text-2xl font-bold mb-5 text-center text-indigo-700">INVENTARIO POR VEHÍCULO</h2>

        <div class="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-300">
            <label for="adminVehicleSelect" class="block text-lg font-semibold text-blue-700 mb-2">Seleccionar Camión:</label>
            <select id="adminVehicleSelect" class="h-12 border border-gray-300 rounded-lg px-4 text-base w-full bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent" onchange="inventoryModule.handleAdminVehicleSelection(this.value)">
                <option value="">-- Seleccione un camión --</option>
                ${_vehicles.map(v => `<option value="${v.plate}" ${_selectedAdminVehicleForInventory && _selectedAdminVehicleForInventory.plate === v.plate ? 'selected' : ''}>${v.name} (${v.plate})</option>`).join('')}
            </select>
        </div>

        <div id="selected-vehicle-inventory-display">
            ${_selectedAdminVehicleForInventory ? `<p class="text-center text-gray-600 text-lg py-4">Cargando inventario para ${_selectedAdminVehicleForInventory.name}...</p>` : '<p class="text-center text-gray-600 text-lg py-4">Seleccione un camión para ver su inventario.</p>'}
        </div>

        <button class="bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-5 rounded-lg mt-5 w-full shadow-md transition duration-300 ease-in-out transform hover:scale-105" onclick="inventoryModule.renderAdminInventorySelection()">Volver</button>
    `;
    document.getElementById('app-root').appendChild(adminVehicleInventoryDiv);

    if (_selectedAdminVehicleForInventory) {
        // Llama a la función de renderizado de inventario para mostrar el inventario del camión
        setAdminInventoryView('vehicle', _selectedAdminVehicleForInventory.plate);
    }
};

// Manejador de selección de vehículo para el admin en la vista de inventario
export const handleAdminVehicleSelection = (plate) => {
    if (plate) {
        _selectedAdminVehicleForInventory = _vehicles.find(v => v.plate === plate);
        setAdminInventoryView('vehicle', plate);
    } else {
        _selectedAdminVehicleForInventory = null;
        // Limpiar el contenido si no hay camión seleccionado
        document.getElementById('selected-vehicle-inventory-display').innerHTML = '<p class="text-center text-gray-600 text-lg py-4">Seleccione un camión para ver su inventario.</p>';
        renderInventarioScreen(); // Re-render para actualizar la pantalla
    }
};
