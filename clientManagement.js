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

// --- Data specific to client management ---
export let clients = [];
export let zones = [];
export let sectors = [];

// State variables for client screens
export let selectedClientForSale = null; // Exported for direct access in index.html
export let editingClient = null;
export let showManageZonesSectorsModalState = false; // Exported for direct access in index.html
export let showClientPickerModal = false; // Exported for direct access in index.html

let selectedZoneForSectorManagement = null;

// Initial data for populating Firestore if collections are empty
const initialClients = [
    { id: 'cli001', nombreComercial: 'Tienda La Esquina', rif: 'J-12345678-9', direccion: 'Calle Principal 123', telefono: '0414-1234567', email: 'laesquina@example.com', zona: 'Centro', sector: 'Sector A' },
    { id: 'cli002', nombreComercial: 'Bodegon Express', rif: 'J-98765432-1', direccion: 'Av. Libertador 456', telefono: '0424-7654321', email: 'bodegon@example.com', zona: 'Norte', sector: 'Sector B' },
];
const initialZones = [
    { name: 'Centro' },
    { name: 'Norte' },
    { name: 'Sur' },
];
const initialSectors = [
    { name: 'Sector A', zone: 'Centro' },
    { name: 'Sector B', zone: 'Norte' },
    { name: 'Sector C', zone: 'Sur' },
];

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
    _createSearchableDropdown = createSearchableDropdown;
    console.log('[clientManagement.js] Initialized with dependencies.');
};

// --- Data Fetching Functions ---
export const fetchClientData = async () => {
    console.log('[clientManagement.js] Fetching client data...');
    try {
        const fetchCollection = async (collectionName, targetArray, initialData, idKey) => {
            const snapshot = await _db.collection(collectionName).get();
            if (snapshot.empty) {
                console.log(`[clientManagement.js] Collection '${collectionName}' is empty. Populating with initial data.`);
                const batch = _db.batch();
                for (const item of initialData) {
                    batch.set(_db.collection(collectionName).doc(item[idKey]), item);
                }
                await batch.commit();
                targetArray.splice(0, targetArray.length, ...initialData); // Update in place
            } else {
                console.log(`[clientManagement.js] Collection '${collectionName}' has data. Fetching existing data.`);
                targetArray.splice(0, targetArray.length, ...snapshot.docs.map(doc => ({ [idKey]: doc.id, ...doc.data() }))); // Update in place
            }
        };

        await fetchCollection('clients', clients, initialClients, 'id');
        await fetchCollection('zones', zones, initialZones, 'name');
        await fetchCollection('sectors', sectors, initialSectors, 'name');

        console.log('[clientManagement.js] Clients fetched:', clients.length);
        console.log('[clientManagement.js] Zones fetched:', zones.length);
        console.log('[clientManagement.js] Sectors fetched:', sectors.length);

    } catch (error) {
        console.error('[clientManagement.js] Error fetching client-related data:', error);
        _showMessageModal('Error al cargar datos de clientes, zonas o sectores. Usando datos de ejemplo. Revisa tu conexión y las reglas de seguridad.');
        clients.splice(0, clients.length, ...initialClients);
        zones.splice(0, zones.length, ...initialZones);
        sectors.splice(0, sectors.length, ...initialSectors);
    }
};

// --- Screen Rendering Functions ---
export const renderClientesScreen = () => {
    console.log('[clientManagement.js] Rendering clients screen.');
    const clientRows = clients.map(client => `
        <tr>
            <td>${client.nombreComercial}</td>
            <td>${client.rif}</td>
            <td>${client.telefono}</td>
            <td>${client.zona || 'N/A'}</td>
            <td>${client.sector || 'N/A'}</td>
            <td>
                ${_createButton('Editar', '', 'bg-yellow-500 hover:bg-yellow-600 text-white py-1 px-3 rounded-md text-sm edit-client-button', { clientid: client.id })}
                ${_createButton('Eliminar', '', 'bg-red-500 hover:bg-red-600 text-white py-1 px-3 rounded-md text-sm delete-client-button', { clientid: client.id })}
            </td>
        </tr>
    `).join('');

    document.getElementById('app-root').innerHTML = `
        <div class="screen-container bg-white rounded-xl m-2 shadow-md">
            <h2 class="text-2xl font-bold mb-5 text-center text-indigo-700">GESTIÓN DE CLIENTES</h2>
            <div class="flex justify-center mb-6 gap-4">
                ${_createButton('Agregar Nuevo Cliente', 'addClientButton', 'bg-emerald-600')}
                ${_createButton('Gestionar Zonas y Sectores', 'manageZonesSectorsButton', 'bg-blue-600')}
            </div>
            <div class="table-container mb-5">
                ${_createTable(['Nombre Comercial', 'RIF', 'Teléfono', 'Zona', 'Sector', 'Acciones'], clientRows, 'clients-table-body')}
            </div>
            ${_createButton('Volver al Menú Principal', 'backToMainFromClientsButton', 'bg-gray-600 mt-5 w-full')}
        </div>
    `;
};

// --- Client Modals and Logic ---
export const addClient = () => {
    editingClient = { id: '', nombreComercial: '', rif: '', direccion: '', telefono: '', email: '', zona: '', sector: '' };
    renderEditClientModal();
};

export const editClient = (clientId) => {
    editingClient = clients.find(c => c.id === clientId);
    renderEditClientModal();
};

export const cancelEditClient = () => {
    editingClient = null;
    _setScreenAndRender('clientes'); // Re-render to close modal
};

export const renderEditClientModal = () => {
    if (!editingClient) return '';
    const isNew = !editingClient.id;

    const zoneOptions = zones.map(z => ({ value: z.name, text: z.name }));
    const filteredSectorOptions = sectors.filter(s => s.zone === editingClient.zona).map(s => ({ value: s.name, text: s.name }));

    const modalHtml = `
        <div id="edit-client-modal" class="modal">
            <div class="modal-content">
                <h3 class="text-2xl font-bold mb-4 text-center text-indigo-700">${isNew ? 'Agregar Nuevo Cliente' : 'Editar Cliente'}</h3>
                ${_createInput('clientNombreComercial', 'Nombre Comercial', editingClient.nombreComercial)}
                ${_createInput('clientRif', 'RIF', editingClient.rif)}
                ${_createInput('clientDireccion', 'Dirección', editingClient.direccion)}
                ${_createInput('clientTelefono', 'Teléfono', editingClient.telefono, 'tel')}
                ${_createInput('clientEmail', 'Email', editingClient.email, 'email')}
                <div class="mb-4">
                    <label for="clientZone" class="block text-gray-700 text-sm font-bold mb-2">Zona:</label>
                    ${_createSelect('clientZone', zoneOptions, editingClient.zona, 'w-full')}
                </div>
                <div class="mb-4">
                    <label for="clientSector" class="block text-gray-700 text-sm font-bold mb-2">Sector:</label>
                    ${_createSelect('clientSector', filteredSectorOptions, editingClient.sector, 'w-full', '-- Selecciona un sector --')}
                </div>
                <div class="flex justify-around gap-4 mt-5">
                    ${_createButton('Guardar Cliente', 'saveEditedClientButton', 'bg-emerald-600 flex-1')}
                    ${_createButton('Cancelar', 'cancelEditClientButton', 'bg-gray-600 flex-1')}
                </div>
            </div>
        </div>
    `;
    // Append modal to app-root, then call render to update the main screen
    const appRoot = document.getElementById('app-root');
    if (appRoot) {
        const existingModal = document.getElementById('edit-client-modal');
        if (existingModal) existingModal.remove(); // Remove old modal if exists
        appRoot.insertAdjacentHTML('beforeend', modalHtml);
    }
};

export const handleZoneChangeForClientEdit = (zoneName) => {
    if (editingClient) {
        editingClient.zona = zoneName;
        editingClient.sector = ''; // Reset sector when zone changes
        renderEditClientModal(); // Re-render the modal to update sector options
    }
};

export const saveEditedClient = async () => {
    const isNew = !editingClient.id;
    const clientData = {
        nombreComercial: document.getElementById('clientNombreComercial').value.trim(),
        rif: document.getElementById('clientRif').value.trim(),
        direccion: document.getElementById('clientDireccion').value.trim(),
        telefono: document.getElementById('clientTelefono').value.trim(),
        email: document.getElementById('clientEmail').value.trim(),
        zona: document.getElementById('clientZone').value,
        sector: document.getElementById('clientSector').value,
    };

    if (!clientData.nombreComercial || !clientData.rif) {
        _showMessageModal('Nombre Comercial y RIF son campos obligatorios.');
        return;
    }

    try {
        if (isNew) {
            const newClientId = _db.collection('clients').doc().id; // Generate new ID
            await _db.collection('clients').doc(newClientId).set({ id: newClientId, ...clientData });
            clients.push({ id: newClientId, ...clientData });
        } else {
            await _db.collection('clients').doc(editingClient.id).update(clientData);
            const index = clients.findIndex(c => c.id === editingClient.id);
            if (index !== -1) clients[index] = { id: editingClient.id, ...clientData };
        }
        _showMessageModal('Cliente guardado exitosamente.');
        editingClient = null; // Close modal
        await fetchClientData(); // Re-fetch to update clients array in main scope
        _setScreenAndRender('clientes'); // Re-render the client list
    } catch (error) {
        console.error('Error al guardar cliente:', error);
        _showMessageModal('Error al guardar cliente. Revisa tu conexión y reglas de seguridad.');
    }
};

export const showDeleteClientConfirmation = (clientId) => {
    _showConfirmationModal(`¿Estás seguro de que quieres eliminar este cliente?`, () => deleteClient(clientId));
};

const deleteClient = async (clientId) => {
    try {
        await _db.collection('clients').doc(clientId).delete();
        clients = clients.filter(c => c.id !== clientId);
        _showMessageModal('Cliente eliminado exitosamente.');
        await fetchClientData(); // Re-fetch to update clients array in main scope
        _setScreenAndRender('clientes'); // Re-render the client list
    } catch (error) {
        console.error('Error al eliminar cliente:', error);
        _showMessageModal('Error al eliminar cliente. Revisa tu conexión y reglas de seguridad.');
    }
};

export const downloadClientsCSV = () => {
    const headers = ['id', 'nombreComercial', 'rif', 'direccion', 'telefono', 'email', 'zona', 'sector'];
    const dataToDownload = clients.map(client => ({
        id: client.id,
        nombreComercial: client.nombreComercial,
        rif: client.rif,
        direccion: client.direccion,
        telefono: client.telefono,
        email: client.email,
        zona: client.zona,
        sector: client.sector
    }));
    const csvContent = toCSV(dataToDownload, headers); // Assuming toCSV is available globally or passed
    triggerCSVDownload('clientes.csv', csvContent); // Assuming triggerCSVDownload is available globally or passed
};

// --- Zone and Sector Management Modals and Logic ---
export const renderManageZonesSectorsModal = () => {
    if (!showManageZonesSectorsModalState) return '';

    const zoneOptions = zones.map(z => ({ value: z.name, text: z.name }));

    const zonesHtml = zones.map(zone => `
        <div class="flex justify-between items-center bg-gray-100 p-2 rounded-md mb-2">
            <span>${zone.name}</span>
            <div class="flex gap-2">
                ${_createButton('Eliminar', '', 'bg-red-500 hover:bg-red-600 text-white py-1 px-2 rounded-md text-sm delete-zone-button', { zonename: zone.name })}
            </div>
        </div>
    `).join('');

    const filteredSectors = sectors.filter(s => s.zone === selectedZoneForSectorManagement);
    const sectorsHtml = filteredSectors.map(sector => `
        <div class="flex justify-between items-center bg-gray-100 p-2 rounded-md mb-2">
            <span>${sector.name}</span>
            <div class="flex gap-2">
                ${_createButton('Eliminar', '', 'bg-red-500 hover:bg-red-600 text-white py-1 px-2 rounded-md text-sm delete-sector-button', { sectorname: sector.name, zone: sector.zone })}
            </div>
        </div>
    `).join('');

    return `
        <div id="manage-zones-sectors-modal" class="modal">
            <div class="modal-content">
                <h3 class="text-2xl font-bold mb-4 text-center text-blue-700">Gestionar Zonas y Sectores</h3>

                <div class="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-300">
                    <h4 class="text-xl font-bold mb-3 text-blue-700">Gestionar Zonas</h4>
                    ${_createInput('newZoneName', 'Nombre de Nueva Zona', '')}
                    ${_createButton('Agregar Zona', 'addZoneButton', 'bg-blue-600 w-full mb-4')}
                    <div id="zones-list">${zonesHtml}</div>
                </div>

                <div class="mb-6 p-4 bg-green-50 rounded-lg border border-green-300">
                    <h4 class="text-xl font-bold mb-3 text-green-700">Gestionar Sectores</h4>
                    <div class="mb-3">
                        <label for="selectZoneForSector" class="block text-gray-700 text-sm font-bold mb-2">Seleccionar Zona:</label>
                        ${_createSelect('selectZoneForSector', zoneOptions, selectedZoneForSectorManagement || '', 'w-full')}
                    </div>
                    ${_createInput('newSectorName', 'Nombre de Nuevo Sector', '')}
                    ${_createButton('Agregar Sector', 'addSectorButton', 'bg-green-600 w-full mb-4', { disabled: !selectedZoneForSectorManagement })}
                    <div id="sectors-list">${sectorsHtml}</div>
                </div>

                ${_createButton('Cerrar', 'closeManageZonesSectorsModalButton', 'bg-gray-600 mt-5 w-full')}
            </div>
        </div>
    `;
};

// Functions to open/close the modal
export const openManageZonesSectorsModal = () => {
    showManageZonesSectorsModalState = true;
    selectedZoneForSectorManagement = null; // Reset selection
    _setScreenAndRender('clientes'); // Re-render to show modal
};

export const closeManageZonesSectorsModal = () => {
    showManageZonesSectorsModalState = false;
    selectedZoneForSectorManagement = null;
    _setScreenAndRender('clientes'); // Re-render to hide modal
};

export const handleAddZone = async () => {
    const newZoneName = document.getElementById('newZoneName').value.trim();
    if (!newZoneName) { _showMessageModal('Por favor, ingresa un nombre para la zona.'); return; }
    if (zones.some(z => z.name === newZoneName)) { _showMessageModal('Esta zona ya existe.'); return; }

    try {
        await _db.collection('zones').doc(newZoneName).set({ name: newZoneName });
        await fetchClientData(); // Re-fetch all data to update local arrays
        updateManageZonesSectorsModalContent(); // Update modal content
        _showMessageModal('Zona agregada exitosamente.');
    } catch (error) {
        console.error('Error adding zone:', error);
        _showMessageModal('Error al agregar zona. Revisa tu conexión y reglas de seguridad.');
    }
};

export const showDeleteZoneConfirmation = (zoneName) => {
    _showConfirmationModal(`¿Estás seguro de que quieres eliminar la zona "${zoneName}"? Esto también eliminará todos los sectores asociados a esta zona y desvinculará a los clientes.`, () => deleteZone(zoneName));
};

const deleteZone = async (zoneName) => {
    try {
        const batch = _db.batch();
        batch.delete(_db.collection('zones').doc(zoneName));

        // Delete associated sectors
        const sectorsToDelete = sectors.filter(s => s.zone === zoneName);
        sectorsToDelete.forEach(s => batch.delete(_db.collection('sectors').doc(s.name)));

        // Unlink clients from this zone and its sectors
        const clientsToUpdate = clients.filter(c => c.zona === zoneName);
        clientsToUpdate.forEach(c => batch.update(_db.collection('clients').doc(c.id), { zona: '', sector: '' }));

        await batch.commit();
        await fetchClientData(); // Re-fetch all data
        updateManageZonesSectorsModalContent(); // Update modal content
        _showMessageModal('Zona y sectores asociados eliminados, clientes desvinculados exitosamente.');
    } catch (error) {
        console.error('Error deleting zone:', error);
        _showMessageModal('Error al eliminar zona. Revisa tu conexión y reglas de seguridad.');
    }
};

export const handleSelectZoneForSector = (zoneName) => {
    selectedZoneForSectorManagement = zoneName;
    updateManageZonesSectorsModalContent(); // Re-render the modal to show sectors for the selected zone
};

export const handleAddSector = async () => {
    if (!selectedZoneForSectorManagement) { _showMessageModal('Por favor, selecciona una zona primero.'); return; }
    const newSectorName = document.getElementById('newSectorName').value.trim();
    if (!newSectorName) { _showMessageModal('Por favor, ingresa un nombre para el sector.'); return; }
    if (sectors.some(s => s.name === newSectorName && s.zone === selectedZoneForSectorManagement)) { _showMessageModal('Este sector ya existe en la zona seleccionada.'); return; }

    try {
        await _db.collection('sectors').doc(newSectorName).set({ name: newSectorName, zone: selectedZoneForSectorManagement });
        await fetchClientData(); // Re-fetch all data
        updateManageZonesSectorsModalContent(); // Update modal content
        _showMessageModal('Sector agregado exitosamente.');
    } catch (error) {
        console.error('Error adding sector:', error);
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
        const clientsToUpdate = clients.filter(c => c.sector === sectorName && c.zona === zoneName);
        clientsToUpdate.forEach(c => batch.update(_db.collection('clients').doc(c.id), { sector: '' }));

        await batch.commit();
        await fetchClientData(); // Re-fetch all data
        updateManageZonesSectorsModalContent(); // Update modal content
        _showMessageModal('Sector eliminado y clientes desvinculados exitosamente.');
    } catch (error) {
        console.error('Error deleting sector:', error);
        _showMessageModal('Error al eliminar sector. Revisa tu conexión y reglas de seguridad.');
    }
};

export const updateManageZonesSectorsModalContent = () => {
    if (!showManageZonesSectorsModalState) return;

    const modalContentDiv = document.querySelector('#manage-zones-sectors-modal .modal-content');
    if (modalContentDiv) {
        const zoneOptions = zones.map(z => ({ value: z.name, text: z.name }));
        const filteredSectors = sectors.filter(s => s.zone === selectedZoneForSectorManagement);

        const zonesHtml = zones.map(zone => `
            <div class="flex justify-between items-center bg-gray-100 p-2 rounded-md mb-2">
                <span>${zone.name}</span>
                <div class="flex gap-2">
                    ${_createButton('Eliminar', '', 'bg-red-500 hover:bg-red-600 text-white py-1 px-2 rounded-md text-sm delete-zone-button', { zonename: zone.name })}
                </div>
            </div>
        `).join('');

        const sectorsHtml = filteredSectors.map(sector => `
            <div class="flex justify-between items-center bg-gray-100 p-2 rounded-md mb-2">
                <span>${sector.name}</span>
                <div class="flex gap-2">
                    ${_createButton('Eliminar', '', 'bg-red-500 hover:bg-red-600 text-white py-1 px-2 rounded-md text-sm delete-sector-button', { sectorname: sector.name, zone: sector.zone })}
                </div>
            </div>
        `).join('');

        modalContentDiv.innerHTML = `
            <h3 class="text-2xl font-bold mb-4 text-center text-blue-700">Gestionar Zonas y Sectores</h3>

            <div class="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-300">
                <h4 class="text-xl font-bold mb-3 text-blue-700">Gestionar Zonas</h4>
                ${_createInput('newZoneName', 'Nombre de Nueva Zona', '')}
                ${_createButton('Agregar Zona', 'addZoneButton', 'bg-blue-600 w-full mb-4')}
                <div id="zones-list">${zonesHtml}</div>
            </div>

            <div class="mb-6 p-4 bg-green-50 rounded-lg border border-green-300">
                <h4 class="text-xl font-bold mb-3 text-green-700">Gestionar Sectores</h4>
                <div class="mb-3">
                    <label for="selectZoneForSector" class="block text-gray-700 text-sm font-bold mb-2">Seleccionar Zona:</label>
                    ${_createSelect('selectZoneForSector', zoneOptions, selectedZoneForSectorManagement || '', 'w-full')}
                </div>
                ${_createInput('newSectorName', 'Nombre de Nuevo Sector', '')}
                ${_createButton('Agregar Sector', 'addSectorButton', 'bg-green-600 w-full mb-4', { disabled: !selectedZoneForSectorManagement })}
                <div id="sectors-list">${sectorsHtml}</div>
            </div>

            ${_createButton('Cerrar', 'closeManageZonesSectorsModalButton', 'bg-gray-600 mt-5 w-full')}
        `;
    }
};

// --- Client Picker Modal for Sales Screen ---
export const renderClientPickerModal = () => {
    if (!showClientPickerModal) return '';

    const clientOptions = clients.map(c => ({ value: c.id, text: `${c.nombreComercial} (${c.zona} - ${c.sector})` }));

    return `
        <div id="client-picker-modal" class="modal">
            <div class="modal-content">
                <h3 class="text-2xl font-bold mb-4 text-center text-purple-700">Seleccionar Cliente</h3>
                <div class="mb-4">
                    ${_createSearchableDropdown('clientSearchDropdown', 'Buscar cliente por nombre o RIF...', clientOptions, selectedClientForSale?.id || '', (clientId) => selectClientForSale(clientId), 'text')}
                </div>
                <div id="client-picker-list" class="mb-4">
                    <!-- Client list will be updated dynamically -->
                </div>
                <div class="flex justify-around gap-4 mt-5">
                    ${_createButton('Confirmar Selección', 'confirmClientSelectionButton', 'bg-purple-600 flex-1')}
                    ${_createButton('Cancelar', 'cancelClientSelectionButton', 'bg-gray-600 flex-1')}
                </div>
            </div>
        </div>
    `;
};

export const openClientPickerModal = () => {
    showClientPickerModal = true;
    _setScreenAndRender('venta'); // Re-render to show modal
};

export const closeClientPickerModal = () => {
    showClientPickerModal = false;
    _setScreenAndRender('venta'); // Re-render to hide modal
};

export const updateClientPickerList = () => {
    if (!showClientPickerModal) return;
    const clientListDiv = document.getElementById('client-picker-list');
    if (clientListDiv) {
        // This list will be filtered by the searchable dropdown's internal logic
        // The dropdown itself renders the options. This div might be redundant or used for a different display.
        // For now, let's just ensure the dropdown is rendered.
    }
};

export const selectClientForSale = (clientId) => {
    selectedClientForSale = clients.find(c => c.id === clientId) || null;
    console.log('[clientManagement.js] Selected client for sale:', selectedClientForSale);
    // No re-render here, it's handled by the modal's confirm button or external logic
};

export const confirmClientSelection = () => {
    if (!selectedClientForSale) {
        _showMessageModal('Por favor, selecciona un cliente.');
        return;
    }
    closeClientPickerModal();
    // The parent screen (venta) will re-render and use selectedClientForSale
};

export const resetSelectedClientForSale = () => {
    selectedClientForSale = null;
};

export const closeAllClientModals = () => {
    showManageZonesSectorsModalState = false;
    showClientPickerModal = false;
    editingClient = null;
    selectedZoneForSectorManagement = null;
    selectedClientForSale = null;
    console.log('[clientManagement.js] All client-related modals and states reset.');
};

// Helper for CSV download (assuming it's passed from index.html init)
let toCSV;
let triggerCSVDownload;
export const setCsvHelpers = (csvToFunc, csvTriggerFunc) => {
    toCSV = csvToFunc;
    triggerCSVDownload = csvTriggerFunc;
};

