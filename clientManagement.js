// clientManagement.js

// --- Module-scoped variables (will be initialized via init function) ---
let _db;
let _setScreenAndRender;
let _createButton;
let _createInput;
let _createSelect;
let _createTable;
let _showMessageModal;
let _showConfirmationModal;
let _createSearchableDropdown; // New dependency

// Data specific to client management
export let clients = [];
export let zones = [];
export let sectors = [];

// State variables for modals
export let showEditClientModalState = false;
export let editingClient = null;
export let showManageZonesSectorsModalState = false;
export let selectedZoneForSector = null; // For managing sectors within a zone
export let showClientPickerModal = false;
export let selectedClientForSale = null; // Client selected for a sale transaction
export let selectedClientInClientsScreen = null; // Client selected in the main clients screen

// State for searchable dropdowns
let clientSearchTerm = ''; // For the client list screen's search dropdown
let clientPickerSearchTerm = ''; // For the client picker modal's search dropdown

// --- Initialization function ---
export const init = (db, setScreenAndRender, createButton, createInput, createSelect, createTable, showMessageModal, showConfirmationModal, createSearchableDropdown) => {
    _db = db;
    _setScreenAndRender = setScreenAndRender;
    _createButton = createButton;
    _createInput = createInput;
    _createSelect = createSelect;
    _createTable = createTable;
    _showMessageModal = showMessageModal;
    _showConfirmationModal = showConfirmationModal;
    _createSearchableDropdown = createSearchableDropdown; // Assign the new dependency
    console.log('[clientManagement.js] Initialized with dependencies.');
};

// --- Reset selected client for sale ---
export const resetSelectedClientForSale = () => {
    selectedClientForSale = null;
};

// --- Data Fetching Functions ---
export const fetchClientData = async () => {
    console.log('[clientManagement.js] Fetching client data...');
    try {
        const clientsSnapshot = await _db.collection('clients').get();
        clients.splice(0, clients.length, ...clientsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        console.log('[clientManagement.js] Clients fetched:', clients.length);

        const zonesSnapshot = await _db.collection('zones').get();
        zones.splice(0, zones.length, ...zonesSnapshot.docs.map(doc => ({ name: doc.id, ...doc.data() })));
        console.log('[clientManagement.js] Zones fetched:', zones.length);

        const sectorsSnapshot = await _db.collection('sectors').get();
        sectors.splice(0, sectors.length, ...sectorsSnapshot.docs.map(doc => ({ name: doc.id, ...doc.data() })));
        console.log('[clientManagement.js] Sectors fetched:', sectors.length);

        // Initial data population if collections are empty
        if (clients.length === 0) {
            const initialClients = [
                { id: 'C001', nombreComercial: 'Supermercado Central', razonSocial: 'Supermercado Central C.A.', rif: 'J-12345678-9', direccion: 'Av. Principal #123', telefono: '0212-1112233', email: 'supercentral@mail.com', zona: 'Zona Norte', sector: 'Sector A' },
                { id: 'C002', nombreComercial: 'Bodegón La Esquina', razonSocial: 'Bodegón La Esquina S.R.L.', rif: 'J-98765432-1', direccion: 'Calle 5 #45', telefono: '0212-4445566', email: 'bodegon@mail.com', zona: 'Zona Sur', sector: 'Sector B' },
                { id: 'C003', nombreComercial: 'Minimarket Express', razonSocial: 'Minimarket Express C.A.', rif: 'J-56789012-3', direccion: 'Av. Libertador #789', telefono: '0212-7778899', email: 'minimarket@mail.com', zona: 'Zona Centro', sector: 'Sector C' },
            ];
            const batch = _db.batch();
            initialClients.forEach(client => batch.set(_db.collection('clients').doc(client.id), client));
            await batch.commit();
            clients.splice(0, clients.length, ...initialClients);
            console.log('[clientManagement.js] Populated initial clients.');
        }

        if (zones.length === 0) {
            const initialZones = [{ name: 'Zona Norte' }, { name: 'Zona Sur' }, { name: 'Zona Centro' }];
            const batch = _db.batch();
            initialZones.forEach(zone => batch.set(_db.collection('zones').doc(zone.name), zone));
            await batch.commit();
            zones.splice(0, zones.length, ...initialZones);
            console.log('[clientManagement.js] Populated initial zones.');
        }

        if (sectors.length === 0) {
            const initialSectors = [
                { name: 'Sector A', zone: 'Zona Norte' },
                { name: 'Sector B', zone: 'Zona Sur' },
                { name: 'Sector C', zone: 'Zona Centro' },
            ];
            const batch = _db.batch();
            initialSectors.forEach(sector => batch.set(_db.collection('sectors').doc(sector.name), sector));
            await batch.commit();
            sectors.splice(0, sectors.length, ...initialSectors);
            console.log('[clientManagement.js] Populated initial sectors.');
        }

    } catch (error) {
        console.error('[clientManagement.js] Error fetching client data:', error);
        _showMessageModal('Error al cargar datos de clientes, zonas o sectores. Usando datos de ejemplo. Revisa tu conexión y las reglas de seguridad.');
        // Fallback to empty arrays on error
        clients.splice(0, clients.length);
        zones.splice(0, zones.length);
        sectors.splice(0, sectors.length);
    }
};

// --- Screen Rendering Functions ---
export const renderClientesScreen = () => {
    console.log('[clientManagement.js] Rendering clients screen.');

    const clientOptions = clients.map(client => ({
        value: client.id,
        text: `${client.nombreComercial} (${client.id}) - ${client.zona}, ${client.sector}`
    }));

    const selectedClientDetailsHtml = selectedClientInClientsScreen ? `
        <div class="bg-gray-100 p-4 rounded-lg shadow-sm border border-gray-200 mt-4">
            <h3 class="text-xl font-bold mb-2 text-indigo-800">${selectedClientInClientsScreen.nombreComercial}</h3>
            <p class="text-sm text-gray-600">ID: ${selectedClientInClientsScreen.id}</p>
            <p class="text-sm text-gray-600">Razón Social: ${selectedClientInClientsScreen.razonSocial}</p>
            <p class="text-sm text-gray-600">RIF: ${selectedClientInClientsScreen.rif}</p>
            <p class="text-sm text-gray-600">Dirección: ${selectedClientInClientsScreen.direccion}</p>
            <p class="text-sm text-gray-600">Teléfono: ${selectedClientInClientsScreen.telefono}</p>
            <p class="text-sm text-gray-600">Email: ${selectedClientInClientsScreen.email}</p>
            <p class="text-sm text-gray-600">Zona: ${selectedClientInClientsScreen.zona}</p>
            <p class="text-sm text-gray-600">Sector: ${selectedClientInClientsScreen.sector}</p>
            <div class="flex justify-end gap-2 mt-3">
                ${_createButton('Editar', 'editClientButton', 'bg-yellow-500 hover:bg-yellow-600 text-white py-1 px-3 rounded-md text-sm', { clientid: selectedClientInClientsScreen.id })}
                ${_createButton('Eliminar', 'deleteClientButton', 'bg-red-500 hover:bg-red-600 text-white py-1 px-3 rounded-md text-sm', { clientid: selectedClientInClientsScreen.id })}
            </div>
        </div>
    ` : '<p class="text-center text-gray-500 mt-4">Selecciona un cliente para ver sus detalles.</p>';


    document.getElementById('app-root').innerHTML = `
        <div class="screen-container bg-white rounded-xl m-2 shadow-md">
            <h2 class="text-2xl font-bold mb-5 text-center text-indigo-700">GESTIÓN DE CLIENTES</h2>
            <div class="flex justify-center mb-6 gap-4">
                ${_createButton('Agregar Nuevo Cliente', 'addClientButton', 'bg-emerald-600')}
                ${_createButton('Gestionar Zonas y Sectores', 'manageZonesSectorsButton', 'bg-blue-600')}
            </div>

            <h3 class="text-xl font-bold mb-4 text-gray-700">Buscar y Seleccionar Cliente</h3>
            <div class="mb-4">
                ${_createSearchableDropdown('clientListSearch', 'Buscar cliente por nombre, ID, zona, sector...', clientOptions, selectedClientInClientsScreen ? selectedClientInClientsScreen.id : '', (value) => handleClientSelectionInClientsScreen(value), 'text')}
            </div>

            <div id="selected-client-details">
                ${selectedClientDetailsHtml}
            </div>

            ${_createButton('Volver al Menú Principal', 'backToMainFromClientsButton', 'bg-gray-600 mt-5 w-full')}
        </div>
    `;
};

export const handleClientSelectionInClientsScreen = (clientId) => {
    selectedClientInClientsScreen = clients.find(c => c.id === clientId) || null;
    _setScreenAndRender('clientes'); // Re-render to show selected client details
};


// --- Edit Client Modal Functions ---
export const renderEditClientModal = () => {
    if (!showEditClientModalState) return '';
    const isNew = !editingClient.id;

    const zoneOptions = zones.map(z => ({ value: z.name, text: z.name }));
    const sectorOptions = sectors.filter(s => s.zone === editingClient.zona).map(s => ({ value: s.name, text: s.name }));

    return `
        <div id="edit-client-modal" class="modal">
            <div class="modal-content">
                <h3 class="text-2xl font-bold mb-4 text-center text-indigo-700">${isNew ? 'Agregar Nuevo Cliente' : 'Editar Cliente'}</h3>
                ${_createInput('clientId', 'ID del Cliente', editingClient.id || '', 'text', !isNew)}
                ${_createInput('clientNombreComercial', 'Nombre Comercial', editingClient.nombreComercial || '')}
                ${_createInput('clientRazonSocial', 'Razón Social', editingClient.razonSocial || '')}
                ${_createInput('clientRif', 'RIF', editingClient.rif || '')}
                ${_createInput('clientDireccion', 'Dirección', editingClient.direccion || '')}
                ${_createInput('clientTelefono', 'Teléfono', editingClient.telefono || '')}
                ${_createInput('clientEmail', 'Email', editingClient.email || '', 'email')}
                ${_createSelect('clientZone', zoneOptions, editingClient.zona || '', 'mb-4', '-- Seleccione Zona --')}
                ${_createSelect('clientSector', sectorOptions, editingClient.sector || '', 'mb-4', '-- Seleccione Sector --')}
                <div class="flex justify-around gap-4 mt-5">
                    ${_createButton('Guardar Cliente', 'saveEditedClientButton', 'bg-emerald-600 flex-1')}
                    ${_createButton('Cancelar', 'cancelEditClientButton', 'bg-gray-600 flex-1')}
                </div>
            </div>
        </div>
    `;
};

export const addClient = () => {
    editingClient = { id: '', nombreComercial: '', razonSocial: '', rif: '', direccion: '', telefono: '', email: '', zona: '', sector: '' };
    showEditClientModalState = true;
    _setScreenAndRender('clientes'); // Re-render to show modal
};

export const editClient = (clientId) => {
    editingClient = clients.find(c => c.id === clientId);
    showEditClientModalState = true;
    _setScreenAndRender('clientes'); // Re-render to show modal
};

export const cancelEditClient = () => {
    showEditClientModalState = false;
    editingClient = null;
    _setScreenAndRender('clientes'); // Re-render to hide modal
};

export const saveEditedClient = async () => {
    const isNew = !editingClient.id;
    const clientData = {
        id: document.getElementById('clientId').value.trim(),
        nombreComercial: document.getElementById('clientNombreComercial').value.trim(),
        razonSocial: document.getElementById('clientRazonSocial').value.trim(),
        rif: document.getElementById('clientRif').value.trim(),
        direccion: document.getElementById('clientDireccion').value.trim(),
        telefono: document.getElementById('clientTelefono').value.trim(),
        email: document.getElementById('clientEmail').value.trim(),
        zona: document.getElementById('clientZone').value,
        sector: document.getElementById('clientSector').value,
    };

    if (!clientData.id || !clientData.nombreComercial || !clientData.zona || !clientData.sector) {
        _showMessageModal('ID, Nombre Comercial, Zona y Sector son campos obligatorios.');
        return;
    }

    if (isNew && clients.some(c => c.id === clientData.id)) {
        _showMessageModal('Ya existe un cliente con este ID.');
        return;
    }

    try {
        if (isNew) {
            await _db.collection('clients').doc(clientData.id).set(clientData);
            clients.push(clientData);
        } else {
            await _db.collection('clients').doc(editingClient.id).update(clientData);
            const index = clients.findIndex(c => c.id === editingClient.id);
            if (index !== -1) clients[index] = clientData;
        }
        _showMessageModal('Cliente guardado exitosamente.');
        showEditClientModalState = false;
        editingClient = null;
        selectedClientInClientsScreen = clientData; // Update selected client if it was the one being edited
        await fetchClientData(); // Re-fetch to ensure data consistency
        _setScreenAndRender('clientes'); // Re-render the client list
    } catch (error) {
        console.error('Error al guardar cliente:', error);
        _showMessageModal('Error al guardar cliente. Revisa tu conexión y reglas de seguridad.');
    }
};

export const showDeleteClientConfirmation = (clientId) => {
    _showConfirmationModal(`¿Estás seguro de que quieres eliminar el cliente con ID ${clientId}? Esta acción es irreversible.`, () => deleteClient(clientId));
};

const deleteClient = async (clientId) => {
    try {
        await _db.collection('clients').doc(clientId).delete();
        clients = clients.filter(c => c.id !== clientId);
        _showMessageModal('Cliente eliminado exitosamente.');
        selectedClientInClientsScreen = null; // Clear selected client if it was deleted
        await fetchClientData(); // Re-fetch to ensure data consistency
        _setScreenAndRender('clientes'); // Re-render the client list
    } catch (error) {
        console.error('Error al eliminar cliente:', error);
        _showMessageModal('Error al eliminar cliente. Revisa tu conexión y reglas de seguridad.');
    }
};

export const handleZoneChangeForClientEdit = (zoneName) => {
    if (editingClient) {
        editingClient.zona = zoneName;
        editingClient.sector = ''; // Reset sector when zone changes
        // Re-render the modal to update sector options
        _setScreenAndRender('clientes'); // This will trigger renderEditClientModal
    }
};

// --- Manage Zones and Sectors Modal Functions ---
export const renderManageZonesSectorsModal = () => {
    if (!showManageZonesSectorsModalState) return '';

    const zoneOptions = zones.map(z => ({ value: z.name, text: z.name }));

    const zonesHtml = zones.map(zone => `
        <div class="flex justify-between items-center bg-gray-50 p-2 rounded-md mb-2 border border-gray-200">
            <span>${zone.name}</span>
            ${_createButton('Eliminar', '', 'bg-red-500 hover:bg-red-600 text-white py-1 px-3 rounded-md text-sm delete-zone-button', { zonename: zone.name })}
        </div>
    `).join('');

    const sectorsHtml = sectors.filter(s => s.zone === selectedZoneForSector).map(sector => `
        <div class="flex justify-between items-center bg-gray-50 p-2 rounded-md mb-2 border border-gray-200">
            <span>${sector.name}</span>
            ${_createButton('Eliminar', '', 'bg-red-500 hover:bg-red-600 text-white py-1 px-3 rounded-md text-sm delete-sector-button', { sectorname: sector.name, zone: sector.zone })}
        </div>
    `).join('');

    return `
        <div id="manage-zones-sectors-modal" class="modal">
            <div class="modal-content">
                <h3 class="text-2xl font-bold mb-4 text-center text-indigo-700">Gestionar Zonas y Sectores</h3>

                <div class="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-300">
                    <h4 class="text-xl font-bold mb-3 text-blue-700">Gestionar Zonas</h4>
                    ${_createInput('newZoneName', 'Nueva Zona', '')}
                    ${_createButton('Agregar Zona', 'addZoneButton', 'bg-emerald-600 w-full mb-4')}
                    <div id="zones-list">${zonesHtml}</div>
                </div>

                <div class="mb-6 p-4 bg-green-50 rounded-lg border border-green-300">
                    <h4 class="text-xl font-bold mb-3 text-green-700">Gestionar Sectores</h4>
                    ${_createSelect('selectZoneForSector', zoneOptions, selectedZoneForSector || '', 'mb-4', '-- Seleccione Zona para Sectores --')}
                    ${_createInput('newSectorName', 'Nuevo Sector', '')}
                    ${_createButton('Agregar Sector', 'addSectorButton', 'bg-emerald-600 w-full mb-4')}
                    <div id="sectors-list">${sectorsHtml}</div>
                </div>

                ${_createButton('Cerrar', 'closeManageZonesSectorsModalButton', 'bg-gray-600 mt-5 w-full')}
            </div>
        </div>
    `;
};

export const openManageZonesSectorsModal = () => {
    showManageZonesSectorsModalState = true;
    selectedZoneForSector = zones.length > 0 ? zones[0].name : null; // Select first zone by default
    _setScreenAndRender('clientes'); // Re-render to show modal
};

export const closeManageZonesSectorsModal = () => {
    showManageZonesSectorsModalState = false;
    selectedZoneForSector = null;
    _setScreenAndRender('clientes'); // Re-render to hide modal
};

export const updateManageZonesSectorsModalContent = () => {
    // This function is called after rendering the modal to update dynamic content
    // and re-attach event listeners.
    const zonesListDiv = document.getElementById('zones-list');
    if (zonesListDiv) {
        zonesListDiv.innerHTML = zones.map(zone => `
            <div class="flex justify-between items-center bg-gray-50 p-2 rounded-md mb-2 border border-gray-200">
                <span>${zone.name}</span>
                ${_createButton('Eliminar', '', 'bg-red-500 hover:bg-red-600 text-white py-1 px-3 rounded-md text-sm delete-zone-button', { zonename: zone.name })}
            </div>
        `).join('');
    }

    const sectorsListDiv = document.getElementById('sectors-list');
    if (sectorsListDiv) {
        sectorsListDiv.innerHTML = sectors.filter(s => s.zone === selectedZoneForSector).map(sector => `
            <div class="flex justify-between items-center bg-gray-50 p-2 rounded-md mb-2 border border-gray-200">
                <span>${sector.name}</span>
                ${_createButton('Eliminar', '', 'bg-red-500 hover:bg-red-600 text-white py-1 px-3 rounded-md text-sm delete-sector-button', { sectorname: sector.name, zone: sector.zone })}
            </div>
        `).join('');
    }

    // Re-attach event listeners for dynamically added buttons
    document.querySelectorAll('.delete-zone-button').forEach(button => {
        button.onclick = (e) => showDeleteZoneConfirmation(e.target.dataset.zonename);
    });
    document.querySelectorAll('.delete-sector-button').forEach(button => {
        button.onclick = (e) => showDeleteSectorConfirmation(e.target.dataset.sectorname, e.target.dataset.zone);
    });
};

export const handleAddZone = async () => {
    const newZoneName = document.getElementById('newZoneName').value.trim();
    if (!newZoneName) {
        _showMessageModal('Por favor, ingresa un nombre para la nueva zona.');
        return;
    }
    if (zones.some(z => z.name === newZoneName)) {
        _showMessageModal('Esta zona ya existe.');
        return;
    }
    try {
        await _db.collection('zones').doc(newZoneName).set({ name: newZoneName });
        zones.push({ name: newZoneName });
        _showMessageModal('Zona agregada exitosamente.');
        document.getElementById('newZoneName').value = ''; // Clear input
        await fetchClientData(); // Re-fetch to update local data and trigger re-render
        _setScreenAndRender('clientes'); // Re-render to update modal content
    } catch (error) {
        console.error('Error al agregar zona:', error);
        _showMessageModal('Error al agregar zona. Revisa tu conexión y reglas de seguridad.');
    }
};

export const showDeleteZoneConfirmation = (zoneName) => {
    _showConfirmationModal(`¿Estás seguro de que quieres eliminar la zona "${zoneName}"? Esto también eliminará todos los sectores asociados a esta zona y desvinculará a los clientes de esta zona/sector.`, () => deleteZone(zoneName));
};

const deleteZone = async (zoneName) => {
    try {
        const batch = _db.batch();
        batch.delete(_db.collection('zones').doc(zoneName));

        // Delete associated sectors
        const sectorsToDelete = sectors.filter(s => s.zone === zoneName);
        sectorsToDelete.forEach(sector => batch.delete(_db.collection('sectors').doc(sector.name)));

        // Unlink clients from this zone/sector
        const clientsToUpdate = clients.filter(c => c.zona === zoneName);
        clientsToUpdate.forEach(client => {
            batch.update(_db.collection('clients').doc(client.id), { zona: '', sector: '' });
        });

        await batch.commit();
        _showMessageModal('Zona y sus sectores/clientes asociados eliminados/actualizados exitosamente.');
        await fetchClientData(); // Re-fetch to update local data and trigger re-render
        selectedZoneForSector = zones.length > 0 ? zones[0].name : null; // Reset selected zone for sector management
        _setScreenAndRender('clientes'); // Re-render to update modal content
    } catch (error) {
        console.error('Error al eliminar zona:', error);
        _showMessageModal('Error al eliminar zona. Revisa tu conexión y reglas de seguridad.');
    }
};

export const handleSelectZoneForSector = (zoneName) => {
    selectedZoneForSector = zoneName;
    _setScreenAndRender('clientes'); // Re-render to update modal content
};

export const handleAddSector = async () => {
    const newSectorName = document.getElementById('newSectorName').value.trim();
    if (!newSectorName || !selectedZoneForSector) {
        _showMessageModal('Por favor, selecciona una zona e ingresa un nombre para el nuevo sector.');
        return;
    }
    if (sectors.some(s => s.name === newSectorName && s.zone === selectedZoneForSector)) {
        _showMessageModal('Este sector ya existe en la zona seleccionada.');
        return;
    }
    try {
        await _db.collection('sectors').doc(newSectorName).set({ name: newSectorName, zone: selectedZoneForSector });
        sectors.push({ name: newSectorName, zone: selectedZoneForSector });
        _showMessageModal('Sector agregado exitosamente.');
        document.getElementById('newSectorName').value = ''; // Clear input
        await fetchClientData(); // Re-fetch to update local data and trigger re-render
        _setScreenAndRender('clientes'); // Re-render to update modal content
    } catch (error) {
        console.error('Error al agregar sector:', error);
        _showMessageModal('Error al agregar sector. Revisa tu conexión y reglas de seguridad.');
    }
};

export const showDeleteSectorConfirmation = (sectorName, zoneName) => {
    _showConfirmationModal(`¿Estás seguro de que quieres eliminar el sector "${sectorName}" de la zona "${zoneName}"? Esto desvinculará a los clientes de este sector.`, () => deleteSector(sectorName, zoneName));
};

const deleteSector = async (sectorName, zoneName) => {
    try {
        const batch = _db.batch();
        batch.delete(_db.collection('sectors').doc(sectorName));

        // Unlink clients from this sector
        const clientsToUpdate = clients.filter(c => c.zona === zoneName && c.sector === sectorName);
        clientsToUpdate.forEach(client => {
            batch.update(_db.collection('clients').doc(client.id), { sector: '' });
        });

        await batch.commit();
        _showMessageModal('Sector y clientes asociados eliminados/actualizados exitosamente.');
        await fetchClientData(); // Re-fetch to update local data and trigger re-render
        _setScreenAndRender('clientes'); // Re-render to update modal content
    } catch (error) {
        console.error('Error al eliminar sector:', error);
        _showMessageModal('Error al eliminar sector. Revisa tu conexión y reglas de seguridad.');
    }
};

export const closeAllClientModals = () => {
    showEditClientModalState = false;
    showManageZonesSectorsModalState = false;
    showClientPickerModal = false;
    editingClient = null;
    selectedZoneForSector = null;
    // Do NOT reset selectedClientForSale or selectedClientInClientsScreen here,
    // as they might be needed by the calling screen (e.g., venta screen)
};

// --- Client Picker Modal for Sales ---
export const renderClientPickerModal = () => {
    if (!showClientPickerModal) return '';

    const clientOptions = clients.map(client => ({
        value: client.id,
        text: `${client.nombreComercial} (${client.id}) - ${client.zona}, ${client.sector}`
    }));

    return `
        <div id="client-picker-modal" class="modal">
            <div class="modal-content">
                <h3 class="text-2xl font-bold mb-4 text-center text-indigo-700">Seleccionar Cliente</h3>
                <div class="mb-4">
                    ${_createSearchableDropdown('clientPickerSearch', 'Buscar cliente por nombre, ID, zona, sector...', clientOptions, selectedClientForSale ? selectedClientForSale.id : '', (value) => handleClientPickerSelection(value), 'text')}
                </div>
                <div id="client-picker-list" class="max-h-64 overflow-y-auto mb-4 border border-gray-300 rounded-lg p-2">
                    <!-- Client list will be dynamically updated -->
                </div>
                <div class="flex justify-around gap-4 mt-5">
                    ${_createButton('Confirmar Selección', 'confirmClientSelectionButton', 'bg-emerald-600 flex-1')}
                    ${_createButton('Cancelar', 'cancelClientSelectionButton', 'bg-gray-600 flex-1')}
                </div>
            </div>
        </div>
    `;
};

export const openClientPickerModal = () => {
    showClientPickerModal = true;
    clientPickerSearchTerm = ''; // Reset search term
    _setScreenAndRender('venta'); // Re-render to show modal
};

export const closeClientPickerModal = () => {
    showClientPickerModal = false;
    // Do NOT reset selectedClientForSale here, as it should persist if cancelled without new selection
    _setScreenAndRender('venta'); // Re-render to hide modal
};

export const handleClientPickerSelection = (clientId) => {
    // This function is called by the searchable dropdown when an item is selected
    selectedClientForSale = clients.find(c => c.id === clientId) || null;
    // The modal itself doesn't need to re-render immediately, but the main screen might.
    // The actual update to the main screen happens on confirmClientSelection.
    console.log('[clientManagement.js] Selected client in picker:', selectedClientForSale);
};

export const updateClientPickerList = () => {
    // This function is called after rendering the modal to update dynamic content
    // and re-attach event listeners.
    const clientPickerListDiv = document.getElementById('client-picker-list');
    if (clientPickerListDiv) {
        const filteredClients = clients.filter(client =>
            client.nombreComercial.toLowerCase().includes(clientPickerSearchTerm.toLowerCase()) ||
            client.id.toLowerCase().includes(clientPickerSearchTerm.toLowerCase()) ||
            client.zona.toLowerCase().includes(clientPickerSearchTerm.toLowerCase()) ||
            client.sector.toLowerCase().includes(clientPickerSearchTerm.toLowerCase())
        );

        clientPickerListDiv.innerHTML = filteredClients.map(client => `
            <div class="p-2 border-b border-gray-200 cursor-pointer hover:bg-blue-100 ${selectedClientForSale && selectedClientForSale.id === client.id ? 'bg-blue-200' : ''}" data-clientid="${client.id}">
                ${client.nombreComercial} (${client.id}) - ${client.zona}, ${client.sector}
            </div>
        `).join('');

        // Re-attach click listeners for manual selection within the list (if not using searchable dropdown's direct select)
        clientPickerListDiv.querySelectorAll('div').forEach(item => {
            item.onclick = (e) => {
                const clientId = e.target.dataset.clientid;
                handleClientPickerSelection(clientId);
                // Visually highlight the selected item
                clientPickerListDiv.querySelectorAll('div').forEach(div => div.classList.remove('bg-blue-200'));
                e.target.classList.add('bg-blue-200');
            };
        });
    }
};

export const confirmClientSelection = () => {
    // selectedClientForSale is already updated by handleClientPickerSelection
    // Now just close the modal and trigger re-render of the main screen
    showClientPickerModal = false;
    _setScreenAndRender('venta'); // Re-render the venta screen to show selected client
};

export const downloadClientsCSV = () => {
    const headers = ['ID', 'Nombre Comercial', 'Razón Social', 'RIF', 'Dirección', 'Teléfono', 'Email', 'Zona', 'Sector'];
    const dataToDownload = clients.map(client => ({
        ID: client.id,
        'Nombre Comercial': client.nombreComercial,
        'Razón Social': client.razonSocial,
        RIF: client.rif,
        Dirección: client.direccion,
        Teléfono: client.telefono,
        Email: client.email,
        Zona: client.zona,
        Sector: client.sector
    }));
    const csvContent = toCSV(dataToDownload, headers);
    triggerCSVDownload('clientes.csv', csvContent);
};

// Helper function (copied from index.html if needed here)
const toCSV = (data, headers) => {
    if (!data || data.length === 0) return '';
    const actualHeaders = headers || Object.keys(data[0]);
    const csvRows = [actualHeaders.map(header => {
        const val = header;
        if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
            return `"${val.replace(/"/g, '""')}"`;
        }
        return val;
    }).join(',')];
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
