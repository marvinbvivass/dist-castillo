// clientModule.js

// Variables que se inyectarán desde el módulo principal (index.html)
let _clients;
let _db;
let _showMessageModal;
let _setScreenAndRender;
let _updateGlobalState; // Función para actualizar el estado global en index.html

// Estado local del módulo de clientes
let _clientSearchTermClientes = '';
let _showAddClientForm = false;
let _editingClient = null;
let _showEditClientModal = false;

export const initClientModule = (dependencies) => {
    _clients = dependencies.clients;
    _db = dependencies.db;
    _showMessageModal = dependencies.showMessageModal;
    _setScreenAndRender = dependencies.setScreenAndRender;
    _updateGlobalState = dependencies.updateGlobalState;

    // Inicializar estados locales si se pasan como dependencias o se necesitan valores iniciales
    _clientSearchTermClientes = dependencies.clientSearchTermClientes || '';
    _showAddClientForm = dependencies.showAddClientForm || false;
    _editingClient = dependencies.editingClient || null;
    _showEditClientModal = dependencies.showEditClientModal || false;
};

// Helper function to get unique values for a given key from the clients array
const getUniqueClientValues = (key) => {
    const values = _clients.map(client => client[key]).filter(Boolean);
    return [...new Set(values)].sort();
};

export const renderClientesScreen = () => {
    const clientesDiv = document.createElement('div');
    clientesDiv.className = 'screen-container bg-white rounded-xl m-2 shadow-md';
    clientesDiv.innerHTML = `
        <h2 class="text-2xl font-bold mb-5 text-center text-indigo-700">CLIENTES</h2>

        <div class="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-300">
            <label for="clientSearchInputClientes" class="block text-lg font-semibold text-blue-700 mb-2">Buscar Cliente:</label>
            <input type="text" id="clientSearchInputClientes" class="h-12 border border-gray-300 rounded-lg px-4 text-base w-full bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Buscar por Nombre Comercial o Personal..." value="${_clientSearchTermClientes}" onkeyup="clientModule.filterClientsForClientesScreen(this.value)">
        </div>

        <div class="mb-8 p-4 bg-emerald-50 rounded-lg border border-emerald-300">
            <h3 class="text-xl font-bold mb-4 text-emerald-700">Lista de Clientes</h3>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Nombre Comercial</th>
                            <th>Nombre Personal</th>
                            <th>Zona</th>
                            <th>Sector</th>
                            <th>Teléfono</th>
                            <th>Observaciones</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="client-table-body">
                    </tbody>
                </table>
            </div>
        </div>

        <div class="p-4 bg-lime-50 rounded-lg border border-lime-300">
            <h3 class="text-xl font-bold mb-4 text-lime-700">Opciones de Cliente</h3>
            <button class="bg-sky-600 hover:bg-sky-700 text-white font-bold py-3 px-5 rounded-lg mt-3 w-full shadow-md transition duration-300 ease-in-out transform hover:scale-105" onclick="clientModule.toggleAddClientForm()">Agregar Nuevo Cliente</button>
            <div id="add-client-form-container" style="display: ${_showAddClientForm ? 'block' : 'none'};">
                <h4 class="text-lg font-bold mt-5 mb-3 text-lime-800">Formulario de Nuevo Cliente</h4>
                <input type="text" id="newClientNombreComercial" class="h-12 border border-gray-300 rounded-lg px-4 mb-3 text-base w-full bg-white" placeholder="Nombre Comercial">
                <input type="text" id="newClientNombrePersonal" class="h-12 border border-gray-300 rounded-lg px-4 mb-3 text-base w-full bg-white" placeholder="Nombre Personal">

                <select id="newClientZona" class="h-12 border border-gray-300 rounded-lg px-4 mb-3 text-base w-full bg-white">
                    <option value="">Seleccionar Zona</option>
                </select>
                <select id="newClientSector" class="h-12 border border-gray-300 rounded-lg px-4 mb-3 text-base w-full bg-white">
                    <option value="">Seleccionar Sector</option>
                </select>

                <input type="tel" id="newClientTlf" class="h-12 border border-gray-300 rounded-lg px-4 mb-3 text-base w-full bg-white" placeholder="Teléfono">
                <input type="text" id="newClientObservaciones" class="h-12 border border-gray-300 rounded-lg px-4 mb-3 text-base w-full bg-white" placeholder="Observaciones">
                <button class="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-5 rounded-lg mt-3 w-full shadow-md transition duration-300 ease-in-out transform hover:scale-105" onclick="clientModule.handleAddClient()">Guardar Nuevo Cliente</button>
            </div>
        </div>

        <button class="bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-5 rounded-lg mt-5 w-full shadow-md transition duration-300 ease-in-out transform hover:scale-105" onclick="_setScreenAndRender('main')">Volver</button>
    `;
    document.getElementById('app-root').appendChild(clientesDiv); // Asumimos appRoot es global o se pasa como dependencia

    updateClientTableForClientesScreen();

    if (_showAddClientForm) {
        const zonaSelect = document.getElementById('newClientZona');
        const sectorSelect = document.getElementById('newClientSector');

        const uniqueZonas = getUniqueClientValues('zona');
        const uniqueSectores = getUniqueClientValues('sector');

        uniqueZonas.forEach(zona => {
            const option = document.createElement('option');
            option.value = zona;
            option.textContent = zona;
            zonaSelect.appendChild(option);
        });

        uniqueSectores.forEach(sector => {
            const option = document.createElement('option');
            option.value = sector;
            option.textContent = sector;
            sectorSelect.appendChild(option);
        });
    }
    // Renderizar el modal de edición si está activo
    if (_showEditClientModal) {
        renderEditClientModal();
    }
};

export const filterClientsForClientesScreen = (term) => {
    _clientSearchTermClientes = term;
    _updateGlobalState('clientSearchTermClientes', term); // Actualizar estado global
    updateClientTableForClientesScreen();
};

export const updateClientTableForClientesScreen = () => {
    const clientTableBody = document.getElementById('client-table-body');
    if (!clientTableBody) return;

    clientTableBody.innerHTML = '';
    const filteredClients = _clients.filter(client =>
        client.nombreComercial.toLowerCase().includes(_clientSearchTermClientes.toLowerCase()) ||
        client.nombrePersonal.toLowerCase().includes(_clientSearchTermClientes.toLowerCase())
    );

    if (filteredClients.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `<td colspan="8" class="text-center text-gray-500 py-4">No se encontraron clientes.</td>`;
        clientTableBody.appendChild(row);
    } else {
        filteredClients.forEach(client => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${client.id}</td>
                <td>${client.nombreComercial}</td>
                <td>${client.nombrePersonal}</td>
                <td>${client.zona}</td>
                <td>${client.sector}</td>
                <td>${client.tlf}</td>
                <td>${client.observaciones}</td>
                <td>
                    <button class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-1 px-2 rounded-md text-sm" onclick="clientModule.openEditClientModal(${JSON.stringify(client).replace(/"/g, '&quot;')})">Editar</button>
                </td>
            `;
            clientTableBody.appendChild(row);
        });
    }
};

export const toggleAddClientForm = () => {
    _showAddClientForm = !_showAddClientForm;
    _updateGlobalState('showAddClientForm', _showAddClientForm); // Actualizar estado global
    _setScreenAndRender('clientes');
};

export const handleAddClient = async () => {
    const nombreComercial = document.getElementById('newClientNombreComercial').value;
    const nombrePersonal = document.getElementById('newClientNombrePersonal').value;
    const zona = document.getElementById('newClientZona').value;
    const sector = document.getElementById('newClientSector').value;
    const tlf = document.getElementById('newClientTlf').value;
    const observaciones = document.getElementById('newClientObservaciones').value;

    if (!nombreComercial || !nombrePersonal || !tlf) {
        _showMessageModal('Error: Nombre Comercial, Nombre Personal y Teléfono son obligatorios.');
        return;
    }

    try {
        const newClientId = `client_${Date.now()}`;
        const newClientData = { id: newClientId, nombreComercial, nombrePersonal, zona, sector, tlf, observaciones };

        await _db.collection('clients').doc(newClientId).set(newClientData);

        _clients.push(newClientData); // Actualizar estado local
        _updateGlobalState('clients', _clients); // Notificar al módulo principal para actualizar la lista global

        _showMessageModal('Cliente Agregado: El nuevo cliente ha sido añadido a Firestore.');

        document.getElementById('newClientNombreComercial').value = '';
        document.getElementById('newClientNombrePersonal').value = '';
        document.getElementById('newClientZona').value = '';
        document.getElementById('newClientSector').value = '';
        document.getElementById('newClientTlf').value = '';
        document.getElementById('newClientObservaciones').value = '';
        _showAddClientForm = false;
        _updateGlobalState('showAddClientForm', false); // Actualizar estado global

        _setScreenAndRender('clientes');
    } catch (error) {
        console.error('Error al añadir cliente a Firestore:', error);
        _showMessageModal('Error al agregar cliente. Por favor, revisa tu conexión y las reglas de seguridad.');
    }
};

export const openEditClientModal = (client) => {
    _editingClient = JSON.parse(JSON.stringify(client)); // Copia profunda
    _showEditClientModal = true;
    _updateGlobalState('editingClient', _editingClient); // Actualizar estado global
    _updateGlobalState('showEditClientModal', true); // Actualizar estado global
    _setScreenAndRender('clientes'); // Re-render para mostrar el modal
};

export const closeEditClientModal = () => {
    _editingClient = null;
    _showEditClientModal = false;
    _updateGlobalState('editingClient', null); // Actualizar estado global
    _updateGlobalState('showEditClientModal', false); // Actualizar estado global
    _setScreenAndRender('clientes');
};

export const handleEditClientChange = (field, value) => {
    if (_editingClient) {
        _editingClient[field] = value;
        _updateGlobalState('editingClient', _editingClient); // Actualizar estado global
    }
};

export const saveEditedClient = async () => {
    if (!_editingClient) return;

    if (!_editingClient.nombreComercial || !_editingClient.nombrePersonal || !_editingClient.tlf) {
        _showMessageModal('Error: Nombre Comercial, Nombre Personal y Teléfono son obligatorios.');
        return;
    }

    try {
        await _db.collection('clients').doc(_editingClient.id).set(_editingClient);
        _clients = _clients.map(c => c.id === _editingClient.id ? _editingClient : c); // Actualizar estado local
        _updateGlobalState('clients', _clients); // Notificar al módulo principal para actualizar la lista global

        _showMessageModal('Cliente actualizado exitosamente.');
        closeEditClientModal();
        _setScreenAndRender('clientes');
    } catch (error) {
        console.error('Error al actualizar cliente en Firestore:', error);
        _showMessageModal('Error al actualizar cliente. Por favor, revisa tu conexión y las reglas de seguridad.');
    }
};

export const renderEditClientModal = () => {
    if (!_showEditClientModal || !_editingClient) return;

    const modalDiv = document.createElement('div');
    modalDiv.id = 'edit-client-modal';
    modalDiv.className = 'modal';
    modalDiv.innerHTML = `
        <div class="modal-content">
            <h3 class="text-2xl font-bold mb-4 text-center text-indigo-700">Editar Cliente</h3>
            <input type="text" id="editClientNombreComercial" class="h-12 border border-gray-300 rounded-lg px-4 mb-3 text-base w-full bg-white" placeholder="Nombre Comercial" value="${_editingClient.nombreComercial}" onchange="clientModule.handleEditClientChange('nombreComercial', this.value)">
            <input type="text" id="editClientNombrePersonal" class="h-12 border border-gray-300 rounded-lg px-4 mb-3 text-base w-full bg-white" placeholder="Nombre Personal" value="${_editingClient.nombrePersonal}" onchange="clientModule.handleEditClientChange('nombrePersonal', this.value)">

            <select id="editClientZona" class="h-12 border border-gray-300 rounded-lg px-4 mb-3 text-base w-full bg-white" onchange="clientModule.handleEditClientChange('zona', this.value)">
                <option value="">Seleccionar Zona</option>
                ${getUniqueClientValues('zona').map(z => `<option value="${z}" ${_editingClient.zona === z ? 'selected' : ''}>${z}</option>`).join('')}
            </select>
            <select id="editClientSector" class="h-12 border border-gray-300 rounded-lg px-4 mb-3 text-base w-full bg-white" onchange="clientModule.handleEditClientChange('sector', this.value)">
                <option value="">Seleccionar Sector</option>
                ${getUniqueClientValues('sector').map(s => `<option value="${s}" ${_editingClient.sector === s ? 'selected' : ''}>${s}</option>`).join('')}
            </select>

            <input type="tel" id="editClientTlf" class="h-12 border border-gray-300 rounded-lg px-4 mb-3 text-base w-full bg-white" placeholder="Teléfono" value="${_editingClient.tlf}" onchange="clientModule.handleEditClientChange('tlf', this.value)">
            <input type="text" id="editClientObservaciones" class="h-12 border border-gray-300 rounded-lg px-4 mb-3 text-base w-full bg-white" placeholder="Observaciones" value="${_editingClient.observaciones}" onchange="clientModule.handleEditClientChange('observaciones', this.value)">

            <div class="flex justify-around gap-4 mt-5">
                <button class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-5 rounded-lg flex-1 shadow-md transition duration-300 ease-in-out transform hover:scale-105" onclick="clientModule.saveEditedClient()">Guardar Cambios</button>
                <button class="bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-5 rounded-lg flex-1 shadow-md transition duration-300 ease-in-out transform hover:scale-105" onclick="clientModule.closeEditClientModal()">Cancelar</button>
            </div>
        </div>
    `;
    document.getElementById('app-root').appendChild(modalDiv); // Asumimos appRoot es global
};