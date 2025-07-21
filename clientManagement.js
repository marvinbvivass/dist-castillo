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

// State variables for modals
export let showEditClientModalState = false;
export let editingClient = null;
export let showManageZonesSectorsModalState = false;
export let showClientPickerModal = false;
export let selectedClientForSale = null;

// Search/filter terms for client picker
let clientPickerSearchTerm = '';
let clientPickerFilterZone = '';
let clientPickerFilterSector = '';

// Initial data for populating Firestore if collections are empty
const initialClients = [
    { id: 'C001', nombreComercial: 'Tienda La Esquina', rif: 'J-12345678-9', telefono: '04141234567', direccion: 'Calle 10, Casa 5, El Centro', zone: 'Centro', sector: 'Centro' },
    { id: 'C002', nombreComercial: 'Bodegon El Barril', rif: 'J-98765432-1', telefono: '04247654321', direccion: 'Av. Principal, Local 1, La Concordia', zone: 'Concordia', sector: 'Principal' },
    { id: 'C003', nombreComercial: 'Supermercado Express', rif: 'J-11223344-5', telefono: '04161122334', direccion: 'Carrera 6, Edif. Azul, Pueblo Nuevo', zone: 'Pueblo Nuevo', sector: 'Comercial' },
];

const initialZones = [
    { name: 'Centro' },
    { name: 'Concordia' },
    { name: 'Pueblo Nuevo' },
    { name: 'Las Vegas' },
];

const initialSectors = [
    { name: 'Centro' },
    { name: 'Principal' },
    { name: 'Comercial' },
    { name: 'Residencial' },
    { name: 'Industrial' },
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
    _createSearchableDropdown = createSearchableDropdown; // Assign the new dependency
    console.log('[clientManagement.js] Initialized with dependencies.');
};

// --- Data Fetching from Firestore ---
export const fetchClientData = async () => {
    console.log('[clientManagement] Fetching client data...');
    try {
        const fetchCollection = async (collectionName, initialData, idKey) => {
            const snapshot = await _db.collection(collectionName).get();
            if (snapshot.empty) {
                console.log(`[clientManagement] Collection '${collectionName}' is empty. Populating with initial data.`);
                const batch = _db.batch();
                for (const item of initialData) {
                    batch.set(_db.collection(collectionName).doc(item[idKey]), item);
                }
                await batch.commit();
                return initialData;
            } else {
                console.log(`[clientManagement] Collection '${collectionName}' has data. Fetching existing data.`);
                return snapshot.docs.map(doc => ({ [idKey]: doc.id, ...doc.data() }));
            }
        };

        clients.splice(0, clients.length, ...await fetchCollection('clients', initialClients, 'id'));
        zones.splice(0, zones.length, ...await fetchCollection('zones', initialZones, 'name'));
        sectors.splice(0, sectors.length, ...await fetchCollection('sectors', initialSectors, 'name'));

        console.log('[clientManagement] Client data fetch completed successfully.');
    } catch (error) {
        console.error('[clientManagement] Error fetching client data from Firestore:', error);
        _showMessageModal('Error al cargar datos de clientes, zonas o sectores. Usando datos de ejemplo. Por favor, revisa tu conexión y las reglas de seguridad de Firestore.');
        // Fallback to initial data if Firestore fetch fails
        clients.splice(0, clients.length, ...initialClients);
        zones.splice(0, zones.length, ...initialZones);
        sectors.splice(0, sectors.length, ...initialSectors);
    }
};

// --- Client Screen Rendering ---
export const renderClientesScreen = () => {
    console.log('[clientManagement] Rendering clients screen.');

    const clientOptions = clients.map(client => ({
        value: client.id,
        text: `${client.nombreComercial} (${client.rif}) - ${client.telefono} - ${client.direccion} - ${client.zone}/${client.sector}`
    }));

    const onClientSelect = (clientId) => {
        const selectedClient = clients.find(c => c.id === clientId);
        if (selectedClient) {
            // This is just for visualization, not for sale selection.
            // Maybe update a display area or log it.
            console.log('Cliente seleccionado para visualización:', selectedClient);
            // You might want to update a specific UI element here to show the selected client's details
            // For now, let's just re-render to reflect the selection if needed, or do nothing visual.
            // If the goal is to show details, you'd need a dedicated area.
        }
    };

    document.getElementById('app-root').innerHTML = `
        <div class="screen-container bg-white rounded-xl m-2 shadow-md">
            <h2 class="text-2xl font-bold mb-5 text-center text-indigo-700">GESTIÓN DE CLIENTES</h2>
            <div class="flex justify-center mb-6 gap-4">
                ${_createButton('Agregar Nuevo Cliente', 'addClientButton', 'bg-emerald-600')}
                ${_createButton('Gestionar Zonas y Sectores', 'manageZonesSectorsButton', 'bg-blue-600')}
            </div>

            <h3 class="text-xl font-bold mb-4 text-gray-700">Lista de Clientes</h3>
            <div class="mb-4">
                ${_createSearchableDropdown('clientListSearch', 'Buscar cliente por nombre, RIF, teléfono o dirección...', clientOptions, '', onClientSelect)}
            </div>

            <div id="clients-list-display" class="grid grid-cols-1 md:grid-cols-2 gap-4">
                ${clients.length === 0 ? '<p class="text-center text-gray-500 col-span-full">No hay clientes registrados.</p>' :
                    clients.map(client => `
                        <div class="bg-gray-100 p-4 rounded-lg shadow-sm border border-gray-200">
                            <p class="font-semibold text-lg text-indigo-800">${client.nombreComercial}</p>
                            <p class="text-sm text-gray-600">RIF: ${client.rif}</p>
                            <p class="text-sm text-gray-600">Teléfono: ${client.telefono}</p>
                            <p class="text-sm text-gray-600">Dirección: ${client.direccion}</p>
                            <p class="text-sm text-gray-600">Zona/Sector: ${client.zone}/${client.sector}</p>
                            <div class="flex justify-end gap-2 mt-3">
                                ${_createButton('Editar', '', 'bg-yellow-500 hover:bg-yellow-600 text-white py-1 px-3 rounded-md text-sm edit-client-button', { clientid: client.id })}
                                ${_createButton('Eliminar', '', 'bg-red-500 hover:bg-red-600 text-white py-1 px-3 rounded-md text-sm delete-client-button', { clientid: client.id })}
                            </div>
                        </div>
                    `).join('')
                }
            </div>

            ${_createButton('Volver al Menú Principal', 'backToMainFromClientsButton', 'bg-gray-600 mt-5 w-full')}
        </div>
    `;
};


// --- Edit Client Modal ---
export const openEditClientModal = (client = null) => {
    editingClient = client ? { ...client } : { id: '', nombreComercial: '', rif: '', telefono: '', direccion: '', zone: '', sector: '' };
    showEditClientModalState = true;
    _setScreenAndRender('clientes'); // Re-render to show modal
};

export const closeEditClientModal = () => {
    showEditClientModalState = false;
    editingClient = null;
    _setScreenAndRender('clientes'); // Re-render to hide modal
};

export const renderEditClientModal = () => {
    if (!showEditClientModalState) return '';

    const zoneOptions = zones.map(z => ({ value: z.name, text: z.name }));
    const sectorOptions = sectors.map(s => ({ value: s.name, text: s.name }));

    return `
        <div id="edit-client-modal" class="modal">
            <div class="modal-content">
                <h3 class="text-2xl font-bold mb-4 text-center text-indigo-700">${editingClient.id ? 'Editar Cliente' : 'Agregar Nuevo Cliente'}</h3>
                ${_createInput('clientId', 'ID del Cliente (generado automáticamente si es nuevo)', editingClient.id, 'text', !!editingClient.id)}
                ${_createInput('clientName', 'Nombre Comercial', editingClient.nombreComercial)}
                ${_createInput('clientRif', 'RIF', editingClient.rif)}
                ${_createInput('clientPhone', 'Teléfono', editingClient.telefono, 'tel')}
                ${_createInput('clientAddress', 'Dirección', editingClient.direccion)}
                ${_createSelect('clientZone', zoneOptions, editingClient.zone, 'mb-4', '-- Seleccione Zona --')}
                ${_createSelect('clientSector', sectorOptions, editingClient.sector, 'mb-4', '-- Seleccione Sector --')}
                <div class="flex justify-around gap-4 mt-5">
                    ${_createButton('Guardar Cliente', 'saveClientButton', 'bg-emerald-600 flex-1')}
                    ${_createButton('Cancelar', 'cancelEditClientButton', 'bg-gray-600 flex-1')}
                </div>
            </div>
        </div>
    `;
};

export const saveClient = async () => {
    const isNew = !editingClient.id;
    const clientData = {
        id: isNew ? _db.collection('clients').doc().id : editingClient.id,
        nombreComercial: document.getElementById('clientName').value.trim(),
        rif: document.getElementById('clientRif').value.trim(),
        telefono: document.getElementById('clientPhone').value.trim(),
        direccion: document.getElementById('clientAddress').value.trim(),
        zone: document.getElementById('clientZone').value,
        sector: document.getElementById('clientSector').value,
    };

    if (!clientData.nombreComercial || !clientData.rif || !clientData.telefono || !clientData.direccion || !clientData.zone || !clientData.sector) {
        _showMessageModal('Todos los campos son obligatorios.');
        return;
    }

    try {
        await _db.collection('clients').doc(clientData.id).set(clientData);
        _showMessageModal('Cliente guardado exitosamente.');
        await fetchClientData(); // Re-fetch clients to update local state
        closeEditClientModal();
    } catch (error) {
        console.error('Error al guardar cliente:', error);
        _showMessageModal('Error al guardar cliente. Revisa tu conexión y reglas de seguridad.');
    }
};

export const deleteClient = async (clientId) => {
    try {
        await _db.collection('clients').doc(clientId).delete();
        _showMessageModal('Cliente eliminado exitosamente.');
        await fetchClientData(); // Re-fetch clients to update local state
        _setScreenAndRender('clientes'); // Re-render the client list
    } catch (error) {
        console.error('Error al eliminar cliente:', error);
        _showMessageModal('Error al eliminar cliente. Revisa tu conexión y reglas de seguridad.');
    }
};

// --- Manage Zones and Sectors Modal ---
export const openManageZonesSectorsModal = () => {
    showManageZonesSectorsModalState = true;
    _setScreenAndRender('clientes'); // Re-render to show modal
};

export const closeManageZonesSectorsModal = () => {
    showManageZonesSectorsModalState = false;
    _setScreenAndRender('clientes'); // Re-render to hide modal
};

// State for search terms within the zones/sectors modal
let zoneSearchTerm = '';
let sectorSearchTerm = '';

export const handleZoneSearch = (term) => {
    zoneSearchTerm = term;
    updateManageZonesSectorsModalContent();
};

export const handleSectorSearch = (term) => {
    sectorSearchTerm = term;
    updateManageZonesSectorsModalContent();
};

export const selectZoneFromDropdown = async (zoneName) => {
    const zoneInput = document.getElementById('zoneSearchInput');
    if (zoneInput) zoneInput.value = zoneName;
    zoneSearchTerm = zoneName;
    // No need to re-render the whole screen, just update the modal content
    updateManageZonesSectorsModalContent();
};

export const selectSectorFromDropdown = async (sectorName) => {
    const sectorInput = document.getElementById('sectorSearchInput');
    if (sectorInput) sectorInput.value = sectorName;
    sectorSearchTerm = sectorName;
    // No need to re-render the whole screen, just update the modal content
    updateManageZonesSectorsModalContent();
};


export const renderManageZonesSectorsModal = () => {
    if (!showManageZonesSectorsModalState) return '';

    return `
        <div id="manage-zones-sectors-modal" class="modal">
            <div class="modal-content">
                <h3 class="text-2xl font-bold mb-4 text-center text-blue-700">Gestionar Zonas y Sectores</h3>

                <div class="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-300">
                    <h4 class="text-xl font-bold mb-3 text-blue-700">Zonas</h4>
                    <div class="flex gap-2 mb-3">
                        ${_createInput('newZoneName', 'Nueva Zona', '', 'text', false, 'flex-grow')}
                        ${_createButton('Agregar Zona', 'addZoneButton', 'bg-blue-500')}
                    </div>
                    <div id="zones-list-container">
                        <!-- Zones will be rendered here by updateManageZonesSectorsModalContent -->
                    </div>
                </div>

                <div class="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-300">
                    <h4 class="text-xl font-bold mb-3 text-blue-700">Sectores</h4>
                    <div class="flex gap-2 mb-3">
                        ${_createInput('newSectorName', 'Nuevo Sector', '', 'text', false, 'flex-grow')}
                        ${_createButton('Agregar Sector', 'addSectorButton', 'bg-blue-500')}
                    </div>
                    <div id="sectors-list-container">
                        <!-- Sectors will be rendered here by updateManageZonesSectorsModalContent -->
                    </div>
                </div>

                ${_createButton('Cerrar', 'closeManageZonesSectorsButton', 'bg-gray-600 mt-5 w-full')}
            </div>
        </div>
    `;
};

export const updateManageZonesSectorsModalContent = () => {
    const zonesListContainer = document.getElementById('zones-list-container');
    const sectorsListContainer = document.getElementById('sectors-list-container');

    if (zonesListContainer) {
        // Options for searchable dropdown
        const zoneOptions = zones.map(z => ({ value: z.name, text: z.name }));

        zonesListContainer.innerHTML = `
            ${_createSearchableDropdown('zoneSearch', 'Buscar zona...', zoneOptions, zoneSearchTerm, handleZoneSearch, 'text')}
            <div class="mt-4 max-h-40 overflow-y-auto border border-gray-200 rounded-md p-2">
                ${zones.filter(zone => zone.name.toLowerCase().includes(zoneSearchTerm.toLowerCase())).length === 0 ? '<p class="text-center text-gray-500">No hay zonas.</p>' :
                    zones.filter(zone => zone.name.toLowerCase().includes(zoneSearchTerm.toLowerCase())).map(zone => `
                        <div class="flex justify-between items-center py-2 px-3 border-b border-gray-100 last:border-b-0">
                            <span>${zone.name}</span>
                            ${_createButton('Eliminar', '', 'bg-red-500 hover:bg-red-600 text-white py-1 px-2 rounded-md text-sm delete-zone-button', { zonename: zone.name })}
                        </div>
                    `).join('')
                }
            </div>
        `;
    }

    if (sectorsListContainer) {
        // Options for searchable dropdown
        const sectorOptions = sectors.map(s => ({ value: s.name, text: s.name }));

        sectorsListContainer.innerHTML = `
            ${_createSearchableDropdown('sectorSearch', 'Buscar sector...', sectorOptions, sectorSearchTerm, handleSectorSearch, 'text')}
            <div class="mt-4 max-h-40 overflow-y-auto border border-gray-200 rounded-md p-2">
                ${sectors.filter(sector => sector.name.toLowerCase().includes(sectorSearchTerm.toLowerCase())).length === 0 ? '<p class="text-center text-gray-500">No hay sectores.</p>' :
                    sectors.filter(sector => sector.name.toLowerCase().includes(sectorSearchTerm.toLowerCase())).map(sector => `
                        <div class="flex justify-between items-center py-2 px-3 border-b border-gray-100 last:border-b-0">
                            <span>${sector.name}</span>
                            ${_createButton('Eliminar', '', 'bg-red-500 hover:bg-red-600 text-white py-1 px-2 rounded-md text-sm delete-sector-button', { sectorname: sector.name })}
                        </div>
                    `).join('')
                }
            </div>
        `;
    }
};


export const addZone = async () => {
    const newZoneName = document.getElementById('newZoneName').value.trim();
    if (!newZoneName) { _showMessageModal('El nombre de la zona no puede estar vacío.'); return; }
    if (zones.some(z => z.name.toLowerCase() === newZoneName.toLowerCase())) {
        _showMessageModal('Esta zona ya existe.');
        return;
    }
    try {
        await _db.collection('zones').doc(newZoneName).set({ name: newZoneName });
        _showMessageModal('Zona agregada exitosamente.');
        await fetchClientData(); // Re-fetch to update local state
        document.getElementById('newZoneName').value = ''; // Clear input
        updateManageZonesSectorsModalContent(); // Update modal content
    } catch (error) {
        console.error('Error al agregar zona:', error);
        _showMessageModal('Error al agregar zona. Revisa tu conexión y reglas de seguridad.');
    }
};

export const deleteZone = async (zoneName) => {
    try {
        await _db.collection('zones').doc(zoneName).delete();
        _showMessageModal('Zona eliminada exitosamente.');
        await fetchClientData(); // Re-fetch to update local state
        updateManageZonesSectorsModalContent(); // Update modal content
    } catch (error) {
        console.error('Error al eliminar zona:', error);
        _showMessageModal('Error al eliminar zona. Revisa tu conexión y reglas de seguridad.');
    }
};

export const addSector = async () => {
    const newSectorName = document.getElementById('newSectorName').value.trim();
    if (!newSectorName) { _showMessageModal('El nombre del sector no puede estar vacío.'); return; }
    if (sectors.some(s => s.name.toLowerCase() === newSectorName.toLowerCase())) {
        _showMessageModal('Este sector ya existe.');
        return;
    }
    try {
        await _db.collection('sectors').doc(newSectorName).set({ name: newSectorName });
        _showMessageModal('Sector agregado exitosamente.');
        await fetchClientData(); // Re-fetch to update local state
        document.getElementById('newSectorName').value = ''; // Clear input
        updateManageZonesSectorsModalContent(); // Update modal content
    } catch (error) {
        console.error('Error al agregar sector:', error);
        _showMessageModal('Error al agregar sector. Revisa tu conexión y reglas de seguridad.');
    }
};

export const deleteSector = async (sectorName) => {
    try {
        await _db.collection('sectors').doc(sectorName).delete();
        _showMessageModal('Sector eliminado exitosamente.');
        await fetchClientData(); // Re-fetch to update local state
        updateManageZonesSectorsModalContent(); // Update modal content
    } catch (error) {
        console.error('Error al eliminar sector:', error);
        _showMessageModal('Error al eliminar sector. Revisa tu conexión y reglas de seguridad.');
    }
};

// --- Client Picker Modal (for Sales Screen) ---
export const toggleClientPickerModal = (show) => {
    showClientPickerModal = show;
    if (!show) {
        clientPickerSearchTerm = '';
        clientPickerFilterZone = '';
        clientPickerFilterSector = '';
    }
    _setScreenAndRender('venta'); // Re-render to show/hide modal
};

export const renderClientPickerModal = () => {
    if (!showClientPickerModal) return '';

    const zoneOptions = zones.map(z => ({ value: z.name, text: z.name }));
    const sectorOptions = sectors.map(s => ({ value: s.name, text: s.name }));

    return `
        <div id="client-picker-modal" class="modal">
            <div class="modal-content">
                <h3 class="text-2xl font-bold mb-4 text-center text-indigo-700">Seleccionar Cliente</h3>
                <div class="mb-4">
                    ${_createInput('clientPickerSearchInput', 'Buscar cliente...', clientPickerSearchTerm, 'text', false, 'w-full')}
                </div>
                <div class="flex flex-col sm:flex-row gap-4 mb-4">
                    ${_createSelect('clientPickerFilterZone', zoneOptions, clientPickerFilterZone, 'flex-1', '-- Filtrar por Zona --')}
                    ${_createSelect('clientPickerFilterSector', sectorOptions, clientPickerFilterSector, 'flex-1', '-- Filtrar por Sector --')}
                </div>
                <div id="client-picker-list" class="max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-2 mb-4">
                    <!-- Client list will be dynamically updated here -->
                </div>
                ${_createButton('Cerrar', 'closeClientPickerButton', 'bg-gray-600 w-full')}
            </div>
        </div>
    `;
};

export const updateClientPickerList = () => {
    const clientPickerListDiv = document.getElementById('client-picker-list');
    if (!clientPickerListDiv) return;

    const filteredClients = clients.filter(client => {
        const matchesSearch = clientPickerSearchTerm === '' ||
            client.nombreComercial.toLowerCase().includes(clientPickerSearchTerm.toLowerCase()) ||
            client.rif.toLowerCase().includes(clientPickerSearchTerm.toLowerCase()) ||
            client.telefono.toLowerCase().includes(clientPickerSearchTerm.toLowerCase()) ||
            client.direccion.toLowerCase().includes(clientPickerSearchTerm.toLowerCase());

        const matchesZone = clientPickerFilterZone === '' || client.zone === clientPickerFilterZone;
        const matchesSector = clientPickerFilterSector === '' || client.sector === clientPickerFilterSector;

        return matchesSearch && matchesZone && matchesSector;
    });

    clientPickerListDiv.innerHTML = filteredClients.length === 0 ? '<p class="text-center text-gray-500">No hay clientes que coincidan con los filtros.</p>' :
        filteredClients.map(client => `
            <div class="select-client-item bg-gray-50 p-3 rounded-md mb-2 cursor-pointer hover:bg-gray-100 border border-gray-200" data-client='${JSON.stringify(client)}'>
                <p class="font-semibold">${client.nombreComercial}</p>
                <p class="text-sm text-gray-600">${client.zone}/${client.sector}</p>
            </div>
        `).join('');
};

export const handleClientPickerSearchChange = (searchTerm) => {
    clientPickerSearchTerm = searchTerm;
    updateClientPickerList();
};

export const handleClientPickerFilterChange = (type, value) => {
    if (type === 'zone') {
        clientPickerFilterZone = value;
    } else if (type === 'sector') {
        clientPickerFilterSector = value;
    }
    updateClientPickerList();
};

export const selectClientForSale = (client) => {
    selectedClientForSale = client;
    toggleClientPickerModal(false); // Close the picker modal
    // The main app's render function will be called by toggleClientPickerModal,
    // which will then update the venta screen content.
};

export const resetSelectedClientForSale = () => {
    selectedClientForSale = null;
};

export const downloadClientsCSV = () => {
    const headers = ['ID', 'Nombre Comercial', 'RIF', 'Teléfono', 'Dirección', 'Zona', 'Sector'];
    const dataToDownload = clients.map(client => ({
        ID: client.id,
        'Nombre Comercial': client.nombreComercial,
        RIF: client.rif,
        Teléfono: client.telefono,
        Dirección: client.direccion,
        Zona: client.zone,
        Sector: client.sector
    }));
    const csvContent = toCSV(dataToDownload, headers);
    triggerCSVDownload('clientes.csv', csvContent);
};

