// clientManagement.js

// --- Dependencias de Firebase (se asume que se inicializan en index.html y se pasan) ---
let db;

// --- Datos del módulo de clientes ---
let clients = [];
let zonesData = [];
let sectorsData = [];

// Datos iniciales de ejemplo para clientes, zonas y sectores
const initialClients = [
    { id: '1', nombreComercial: 'Los Sartenes de Amita', nombrePersonal: 'Maria Rosario', zona: 'Foranea', sector: 'puerba cambio dos', tlf: '0414555555555', observaciones: 'al frente del chalet' },
    { id: '3', nombreComercial: 'El Parrandereo', nombrePersonal: 'Jose Martinez', zona: 'Santa Teresa', sector: 'Barrio Bolivar', tlf: '787878787878', observaciones: 'ninguna' },
    { id: '4', nombreComercial: 'Licoreria Grysyudey', nombrePersonal: 'Guillermina', zona: 'Palo Gordo', sector: 'Via Principal', tlf: '46898755675', observaciones: 'al doblar la esquina' },
];
const initialZones = [{ name: 'Foranea' }, { name: 'Santa Teresa' }, { name: 'Palo Gordo' }];
const initialSectors = [{ name: 'puerba cambio dos' }, { name: 'Barrio Bolivar' }, { name: 'Via Principal' }];

// --- Estado del UI de Clientes ---
let newClient = { id: '', nombreComercial: '', nombrePersonal: '', zona: '', sector: '', tlf: '', observaciones: '' };
export let selectedClientForSale = null; // Exportar para que index.html pueda acceder
let clientSearchTerm = ''; // Para la búsqueda en el modal de selección de cliente
let clientSearchTermClientes = ''; // Para la búsqueda en la pantalla principal de clientes
let showClientPickerModal = false;
let showAddClientForm = false;
let editingClient = null;
let originalEditingClientId = null;
let showEditClientModal = false;
let showManageZonesSectorsModalState = false;
let editingZone = null;
let editingSector = null;

// --- Funciones de Ayuda (adaptadas de index.html) ---
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

// --- Inicialización del módulo ---
export const init = (firestoreInstance) => {
    db = firestoreInstance;
    console.log('[clientManagement] Módulo inicializado con Firestore.');
};

// --- Funciones de Carga de Datos desde Firestore (para clientes, zonas, sectores) ---
export const fetchClientData = async () => {
    console.log('[clientManagement] Iniciando carga de datos de clientes, zonas y sectores...');
    try {
        const fetchCollectionAndPopulate = async (collectionName, initialData, idKey) => {
            const snapshot = await db.collection(collectionName).get();
            if (snapshot.empty) {
                console.log(`[clientManagement] Colección '${collectionName}' vacía. Poblando con datos iniciales.`);
                const batch = db.batch();
                initialData.forEach(item => {
                    batch.set(db.collection(collectionName).doc(item[idKey]), item);
                });
                await batch.commit();
                return initialData;
            } else {
                console.log(`[clientManagement] Colección '${collectionName}' con datos. Obteniendo datos existentes.`);
                return snapshot.docs.map(doc => ({ [idKey]: doc.id, ...doc.data() }));
            }
        };

        clients = await fetchCollectionAndPopulate('clients', initialClients, 'id');
        zonesData = await fetchCollectionAndPopulate('zones', initialZones, 'name');
        sectorsData = await fetchCollectionAndPopulate('sectors', initialSectors, 'name');

        console.log('[clientManagement] Carga de datos de clientes, zonas y sectores completada.');
    } catch (error) {
        console.error('[clientManagement] Error al cargar datos de clientes, zonas o sectores:', error);
        window.showMessageModal('Error al cargar datos de clientes/zonas/sectores. Usando datos de ejemplo. Por favor, revisa tu conexión y las reglas de seguridad de Firestore.');
        clients = initialClients;
        zonesData = initialZones;
        sectorsData = initialSectors;
    }
};

// --- Funciones de Gestión de Clientes (CRUD) ---
export const handleNewClientChange = (field, value) => {
    newClient = { ...newClient, [field]: value };
    // No render aquí para evitar perder el foco del input
};

export const handleAddClient = async () => {
    if (!newClient.id || !newClient.nombreComercial || !newClient.zona || !newClient.sector) {
        window.showMessageModal('Por favor, completa todos los campos obligatorios (ID, Nombre Comercial, Zona, Sector).');
        return;
    }
    if (clients.some(c => c.id === newClient.id)) {
        window.showMessageModal('Ya existe un cliente con este ID.');
        return;
    }

    try {
        await db.collection('clients').doc(newClient.id).set(newClient);
        await fetchClientData(); // Re-fetch para actualizar la lista local y reflejar cambios
        window.showMessageModal('Cliente agregado exitosamente.');
        newClient = { id: '', nombreComercial: '', nombrePersonal: '', zona: '', sector: '', tlf: '', observaciones: '' }; // Reset form
        toggleAddClientForm(false); // Hide form
        window.setScreenAndRender('clientes'); // Re-render client screen
    } catch (error) {
        console.error('Error al agregar cliente:', error);
        window.showMessageModal('Error al agregar cliente. Revisa tu conexión y reglas de seguridad.');
    }
};

export const openEditClientModal = (client) => {
    editingClient = { ...client };
    originalEditingClientId = client.id;
    showEditClientModal = true;
    window.setScreenAndRender('clientes'); // Re-render to show modal
};

export const closeEditClientModal = () => {
    showEditClientModal = false;
    editingClient = null;
    originalEditingClientId = null;
    window.setScreenAndRender('clientes'); // Re-render to hide modal
};

export const handleEditClientChange = (field, value) => {
    editingClient = { ...editingClient, [field]: value };
    // No render aquí para evitar perder el foco del input
};

export const saveEditedClient = async () => {
    if (!editingClient.id || !editingClient.nombreComercial || !editingClient.zona || !editingClient.sector) {
        window.showMessageModal('Por favor, completa todos los campos obligatorios (ID, Nombre Comercial, Zona, Sector).');
        return;
    }
    if (editingClient.id !== originalEditingClientId && clients.some(c => c.id === editingClient.id)) {
        window.showMessageModal('Ya existe un cliente con el nuevo ID. Por favor, elige uno diferente.');
        return;
    }

    try {
        if (editingClient.id !== originalEditingClientId) {
            // If ID changed, delete old document and create new one
            await db.collection('clients').doc(originalEditingClientId).delete();
            await db.collection('clients').doc(editingClient.id).set(editingClient);
        } else {
            // If ID didn't change, just update
            await db.collection('clients').doc(editingClient.id).update(editingClient);
        }
        await fetchClientData(); // Re-fetch para actualizar la lista local
        window.showMessageModal('Cliente actualizado exitosamente.');
        closeEditClientModal();
    } catch (error) {
        console.error('Error al guardar cliente editado:', error);
        window.showMessageModal('Error al guardar cliente. Revisa tu conexión y reglas de seguridad.');
    }
};

export const showDeleteClientConfirmation = (id) => {
    window.showConfirmationModal(`¿Estás seguro de que quieres eliminar al cliente con ID ${id}?`, () => deleteClient(id));
};

export const deleteClient = async (id) => {
    try {
        await db.collection('clients').doc(id).delete();
        await fetchClientData(); // Re-fetch para actualizar la lista local
        window.showMessageModal('Cliente eliminado exitosamente.');
        window.setScreenAndRender('clientes');
    } catch (error) {
        console.error('Error al eliminar cliente:', error);
        window.showMessageModal('Error al eliminar cliente. Revisa tu conexión y reglas de seguridad.');
    }
};

export const handleClientFileUpload = async (event) => {
    // Asumimos que isAdmin() se verifica en index.html antes de llamar a esta función
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        const parsedData = parseCSV(e.target.result);
        if (parsedData.length === 0) {
            window.showMessageModal('El archivo CSV está vacío o no tiene el formato correcto.');
            return;
        }

        try {
            const batch = db.batch();
            const collectionRef = db.collection('clients');

            // Eliminar todos los clientes existentes
            const existingSnapshot = await collectionRef.get();
            existingSnapshot.docs.forEach(doc => batch.delete(doc.ref));

            // Añadir los nuevos clientes del CSV
            for (const row of parsedData) {
                const clientData = {
                    id: row.ID || '',
                    nombreComercial: row['Nombre Comercial'] || '',
                    nombrePersonal: row['Nombre Personal'] || '',
                    zona: row.Zona || '',
                    sector: row.Sector || '',
                    tlf: row.TLF || '',
                    observaciones: row.Observaciones || ''
                };
                if (clientData.id) {
                    batch.set(collectionRef.doc(clientData.id), clientData);
                } else {
                    console.warn('Fila CSV sin ID de cliente, omitida:', row);
                }
            }
            await batch.commit();
            await fetchClientData(); // Re-fetch para actualizar la lista local
            window.showMessageModal('clientes.csv cargado y guardado exitosamente en Firestore.');
            window.setScreenAndRender('archivosAdmin'); // Re-render files screen
        } catch (error) {
            console.error('Error al cargar archivo clientes.csv a Firestore:', error);
            window.showMessageModal('Error al cargar archivo. Por favor, revisa tu conexión y las reglas de seguridad de Firestore.');
        }
    };
    reader.readAsText(file);
};

export const downloadClientsCSV = () => {
    const dataToDownload = clients.map(c => ({
        ID: c.id,
        'Nombre Comercial': c.nombreComercial,
        'Nombre Personal': c.nombrePersonal,
        Zona: c.zona,
        Sector: c.sector,
        TLF: c.tlf,
        Observaciones: c.observaciones
    }));
    const headers = ['ID', 'Nombre Comercial', 'Nombre Personal', 'Zona', 'Sector', 'TLF', 'Observaciones'];
    const csvContent = toCSV(dataToDownload, headers);
    window.triggerCSVDownload('clientes.csv', csvContent);
};

// --- Funciones de Gestión de Zonas y Sectores ---
export const openManageZonesSectorsModal = () => {
    showManageZonesSectorsModalState = true;
    editingZone = null; // Reset editing state
    editingSector = null; // Reset editing state
    window.setScreenAndRender('clientes'); // Re-render to show modal
};

export const closeManageZonesSectorsModal = () => {
    showManageZonesSectorsModalState = false;
    editingZone = null;
    editingSector = null;
    window.setScreenAndRender('clientes'); // Re-render to hide modal
};

export const addZone = async () => {
    const newZoneName = document.getElementById('newZoneName').value.trim();
    if (!newZoneName) { window.showMessageModal('El nombre de la zona no puede estar vacío.'); return; }
    if (zonesData.some(z => z.name.toLowerCase() === newZoneName.toLowerCase())) {
        window.showMessageModal('Esta zona ya existe.');
        return;
    }
    try {
        await db.collection('zones').doc(newZoneName).set({ name: newZoneName });
        await fetchClientData(); // Re-fetch para actualizar la lista local
        window.showMessageModal('Zona agregada exitosamente.');
        document.getElementById('newZoneName').value = ''; // Clear input
        updateZonesList(); // Update modal content
    } catch (error) {
        console.error('Error al agregar zona:', error);
        window.showMessageModal('Error al agregar zona. Revisa tu conexión y reglas de seguridad.');
    }
};

export const editZone = (zoneName) => {
    editingZone = { name: zoneName, originalName: zoneName };
    updateZonesList(); // Re-render the list to show the edit input
};

export const cancelEditZone = () => {
    editingZone = null;
    updateZonesList();
};

export const saveEditedZone = async () => {
    if (!editingZone) return;
    const newName = document.getElementById('editZoneName').value.trim();
    if (!newName) { window.showMessageModal('El nombre de la zona no puede estar vacío.'); return; }
    if (newName !== editingZone.originalName && zonesData.some(z => z.name.toLowerCase() === newName.toLowerCase())) {
        window.showMessageModal('Ya existe una zona con este nombre.');
        return;
    }

    try {
        const batch = db.batch();
        // Update clients that use the old zone name
        const clientsToUpdateSnapshot = await db.collection('clients').where('zona', '==', editingZone.originalName).get();
        clientsToUpdateSnapshot.docs.forEach(doc => {
            batch.update(doc.ref, { zona: newName });
        });

        // Delete old zone document and create new one
        batch.delete(db.collection('zones').doc(editingZone.originalName));
        batch.set(db.collection('zones').doc(newName), { name: newName });

        await batch.commit();
        await fetchClientData(); // Re-fetch to update local data
        window.showMessageModal('Zona actualizada exitosamente.');
        editingZone = null;
        updateZonesList(); // Update modal content
    } catch (error) {
        console.error('Error al guardar zona editada:', error);
        window.showMessageModal('Error al guardar zona. Revisa tu conexión y reglas de seguridad.');
    }
};

export const showDeleteZoneConfirmation = (zoneName) => {
    window.showConfirmationModal(`¿Estás seguro de que quieres eliminar la zona "${zoneName}"? Esto también eliminará esta zona de todos los clientes asociados.`, () => deleteZone(zoneName));
};

export const deleteZone = async (zoneName) => {
    try {
        const batch = db.batch();
        // Update clients that use this zone to an empty string or a default value
        const clientsToUpdateSnapshot = await db.collection('clients').where('zona', '==', zoneName).get();
        clientsToUpdateSnapshot.docs.forEach(doc => {
            batch.update(doc.ref, { zona: '' }); // Or set to a default zone if desired
        });

        batch.delete(db.collection('zones').doc(zoneName));
        await batch.commit();
        await fetchClientData(); // Re-fetch to update local data
        window.showMessageModal('Zona eliminada exitosamente y clientes actualizados.');
        updateZonesList(); // Update modal content
    } catch (error) {
        console.error('Error al eliminar zona:', error);
        window.showMessageModal('Error al eliminar zona. Revisa tu conexión y reglas de seguridad.');
    }
};

export const addSector = async () => {
    const newSectorName = document.getElementById('newSectorName').value.trim();
    if (!newSectorName) { window.showMessageModal('El nombre del sector no puede estar vacío.'); return; }
    if (sectorsData.some(s => s.name.toLowerCase() === newSectorName.toLowerCase())) {
        window.showMessageModal('Este sector ya existe.');
        return;
    }
    try {
        await db.collection('sectors').doc(newSectorName).set({ name: newSectorName });
        await fetchClientData(); // Re-fetch para actualizar la lista local
        window.showMessageModal('Sector agregado exitosamente.');
        document.getElementById('newSectorName').value = ''; // Clear input
        updateSectorsList(); // Update modal content
    } catch (error) {
        console.error('Error al agregar sector:', error);
        window.showMessageModal('Error al agregar sector. Revisa tu conexión y reglas de seguridad.');
    }
};

export const editSector = (sectorName) => {
    editingSector = { name: sectorName, originalName: sectorName };
    updateSectorsList(); // Re-render the list to show the edit input
};

export const cancelEditSector = () => {
    editingSector = null;
    updateSectorsList();
};

export const saveEditedSector = async () => {
    if (!editingSector) return;
    const newName = document.getElementById('editSectorName').value.trim();
    if (!newName) { window.showMessageModal('El nombre del sector no puede estar vacío.'); return; }
    if (newName !== editingSector.originalName && sectorsData.some(s => s.name.toLowerCase() === newName.toLowerCase())) {
        window.showMessageModal('Ya existe un sector con este nombre.');
        return;
    }

    try {
        const batch = db.batch();
        // Update clients that use the old sector name
        const clientsToUpdateSnapshot = await db.collection('clients').where('sector', '==', editingSector.originalName).get();
        clientsToUpdateSnapshot.docs.forEach(doc => {
            batch.update(doc.ref, { sector: newName });
        });

        // Delete old sector document and create new one
        batch.delete(db.collection('sectors').doc(editingSector.originalName));
        batch.set(db.collection('sectors').doc(newName), { name: newName });

        await batch.commit();
        await fetchClientData(); // Re-fetch to update local data
        window.showMessageModal('Sector actualizado exitosamente.');
        editingSector = null;
        updateSectorsList(); // Update modal content
    } catch (error) {
        console.error('Error al guardar sector editado:', error);
        window.showMessageModal('Error al guardar sector. Revisa tu conexión y reglas de seguridad.');
    }
};

export const showDeleteSectorConfirmation = (sectorName) => {
    window.showConfirmationModal(`¿Estás seguro de que quieres eliminar el sector "${sectorName}"? Esto también eliminará este sector de todos los clientes asociados.`, () => deleteSector(sectorName));
};

export const deleteSector = async (sectorName) => {
    try {
        const batch = db.batch();
        // Update clients that use this sector to an empty string or a default value
        const clientsToUpdateSnapshot = await db.collection('clients').where('sector', '==', sectorName).get();
        clientsToUpdateSnapshot.docs.forEach(doc => {
            batch.update(doc.ref, { sector: '' }); // Or set to a default sector if desired
        });

        batch.delete(db.collection('sectors').doc(sectorName));
        await batch.commit();
        await fetchClientData(); // Re-fetch to update local data
        window.showMessageModal('Sector eliminado exitosamente y clientes actualizados.');
        updateSectorsList(); // Update modal content
    } catch (error) {
        console.error('Error al eliminar sector:', error);
        window.showMessageModal('Error al eliminar sector. Revisa tu conexión y reglas de seguridad.');
    }
};

export const updateZonesList = () => {
    const zonesListDiv = document.getElementById('zones-list');
    if (!zonesListDiv) return;
    zonesListDiv.innerHTML = zonesData.map(zone => `
        <div class="flex justify-between items-center bg-gray-100 p-2 rounded-md mb-2">
            ${editingZone && editingZone.originalName === zone.name ?
                `<input type="text" id="editZoneName" class="border border-gray-300 rounded-md px-2 py-1 w-1/2" value="${editingZone.name}" />
                <div class="flex gap-2">
                    <button class="bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded-md text-sm" onclick="clientManagement.saveEditedZone()">Guardar</button>
                    <button class="bg-gray-500 hover:bg-gray-600 text-white px-2 py-1 rounded-md text-sm" onclick="clientManagement.cancelEditZone()">Cancelar</button>
                </div>` :
                `<span class="text-gray-800">${zone.name}</span>
                <div class="flex gap-2">
                    <button class="bg-yellow-500 hover:bg-yellow-600 text-white px-2 py-1 rounded-md text-sm" onclick="clientManagement.editZone('${zone.name}')">Editar</button>
                    <button class="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded-md text-sm" onclick="clientManagement.showDeleteZoneConfirmation('${zone.name}')">Eliminar</button>
                </div>`
            }
        </div>
    `).join('');
};

export const updateSectorsList = () => {
    const sectorsListDiv = document.getElementById('sectors-list');
    if (!sectorsListDiv) return;
    sectorsListDiv.innerHTML = sectorsData.map(sector => `
        <div class="flex justify-between items-center bg-gray-100 p-2 rounded-md mb-2">
            ${editingSector && editingSector.originalName === sector.name ?
                `<input type="text" id="editSectorName" class="border border-gray-300 rounded-md px-2 py-1 w-1/2" value="${editingSector.name}" />
                <div class="flex gap-2">
                    <button class="bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded-md text-sm" onclick="clientManagement.saveEditedSector()">Guardar</button>
                    <button class="bg-gray-500 hover:bg-gray-600 text-white px-2 py-1 rounded-md text-sm" onclick="clientManagement.cancelEditSector()">Cancelar</button>
                </div>` :
                `<span class="text-gray-800">${sector.name}</span>
                <div class="flex gap-2">
                    <button class="bg-yellow-500 hover:bg-yellow-600 text-white px-2 py-1 rounded-md text-sm" onclick="clientManagement.editSector('${sector.name}')">Editar</button>
                    <button class="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded-md text-sm" onclick="clientManagement.showDeleteSectorConfirmation('${sector.name}')">Eliminar</button>
                </div>`
            }
        </div>
    `).join('');
};

// --- Funciones de Pantalla de Clientes ---
export const setScreenAndRenderClientes = () => {
    window.setScreenAndRender('clientes');
};

export const renderClientesScreen = () => {
    console.log('[clientManagement] Rendering clientes screen.');
    const appRoot = document.getElementById('app-root');
    appRoot.innerHTML = window.createScreenContainer('GESTIÓN DE CLIENTES', `
        <div class="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-300">
            <label for="clientSearchInputClientes" class="block text-lg font-semibold text-blue-700 mb-2">Buscar Cliente:</label>
            ${window.createInput('clientSearchInputClientes', 'Buscar por ID, Nombre Comercial o Personal...', clientSearchTermClientes, 'text', false, 'clientManagement.filterClientsForClientesScreen(this.value)')}
        </div>
        <div id="clients-table-container"></div>
        <div class="flex flex-wrap justify-center gap-4 mt-5">
            ${window.createButton('AÑADIR NUEVO CLIENTE', 'clientManagement.toggleAddClientForm(true)', 'bg-emerald-600')}
            ${window.createButton('GESTIONAR ZONAS Y SECTORES', 'clientManagement.openManageZonesSectorsModal()', 'bg-purple-600')}
        </div>
        ${window.createButton('Volver al Menú Principal', "window.setScreenAndRender('main')", 'bg-gray-600 mt-5 w-full')}
    `);
    updateClientTableForClientesScreen();
};

export const filterClientsForClientesScreen = (term) => {
    clientSearchTermClientes = term;
    updateClientTableForClientesScreen();
};

export const updateClientTableForClientesScreen = () => {
    const clientsTableContainer = document.getElementById('clients-table-container');
    if (!clientsTableContainer) return;

    const filteredClients = clients.filter(client =>
        client.id.toLowerCase().includes(clientSearchTermClientes.toLowerCase()) ||
        client.nombreComercial.toLowerCase().includes(clientSearchTermClientes.toLowerCase()) ||
        client.nombrePersonal.toLowerCase().includes(clientSearchTermClientes.toLowerCase())
    );

    let tableRows = '';
    if (filteredClients.length === 0) {
        tableRows = `<td colspan="7" class="text-center text-gray-500 py-4">No se encontraron clientes que coincidan con la búsqueda.</td>`;
    } else {
        tableRows = filteredClients.map(client => `
            <td>${client.id}</td><td>${client.nombreComercial}</td><td>${client.nombrePersonal}</td>
            <td>${client.zona}</td><td>${client.sector}</td><td>${client.tlf}</td>
            <td>
                <button class="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-1 px-2 rounded-md text-sm mr-2" onclick="clientManagement.openEditClientModal(${JSON.stringify(client).replace(/"/g, '&quot;')})">Editar</button>
                <button class="bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-2 rounded-md text-sm" onclick="clientManagement.showDeleteClientConfirmation('${client.id}')">Eliminar</button>
            </td>
        `).map(row => `<tr>${row}</tr>`).join('');
    }

    clientsTableContainer.innerHTML = `
        <h3 class="text-xl font-bold mb-4 text-emerald-700">Lista de Clientes</h3>
        ${window.createTable(['ID', 'Nombre Comercial', 'Nombre Personal', 'Zona', 'Sector', 'Teléfono', 'Acciones'], tableRows, 'clients-table-body')}
        ${showAddClientForm ? renderAddClientForm() : ''}
    `;
};

export const toggleAddClientForm = (show) => {
    showAddClientForm = show;
    // Reset newClient form when showing it
    if (show) {
        newClient = { id: '', nombreComercial: '', nombrePersonal: '', zona: '', sector: '', tlf: '', observaciones: '' };
    }
    updateClientTableForClientesScreen(); // Re-render the client table to show/hide the form
};

const renderAddClientForm = () => {
    const zoneOptions = zonesData.map(z => ({ value: z.name, text: z.name }));
    const sectorOptions = sectorsData.map(s => ({ value: s.name, text: s.name }));

    return `
        <div class="p-4 bg-lime-50 rounded-lg border border-lime-300 mt-5">
            <h3 class="text-xl font-bold mb-4 text-lime-700">Añadir Nuevo Cliente</h3>
            ${window.createInput('newClientId', 'ID del Cliente', newClient.id, 'text', false, 'clientManagement.handleNewClientChange("id", this.value)')}
            ${window.createInput('newClientNombreComercial', 'Nombre Comercial', newClient.nombreComercial, 'text', false, 'clientManagement.handleNewClientChange("nombreComercial", this.value)')}
            ${window.createInput('newClientNombrePersonal', 'Nombre Personal', newClient.nombrePersonal, 'text', false, 'clientManagement.handleNewClientChange("nombrePersonal", this.value)')}
            <div class="mb-4">
                ${window.createSelect('newClientZona', zoneOptions, newClient.zona, 'clientManagement.handleNewClientChange("zona", this.value)', '-- Seleccione Zona --')}
            </div>
            <div class="mb-4">
                ${window.createSelect('newClientSector', sectorOptions, newClient.sector, 'clientManagement.handleNewClientChange("sector", this.value)', '-- Seleccione Sector --')}
            </div>
            ${window.createInput('newClientTlf', 'Teléfono', newClient.tlf, 'text', false, 'clientManagement.handleNewClientChange("tlf", this.value)')}
            ${window.createInput('newClientObservaciones', 'Observaciones', newClient.observaciones, 'text', false, 'clientManagement.handleNewClientChange("observaciones", this.value)')}
            <button class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-5 rounded-lg mt-3 w-full shadow-md transition duration-300 ease-in-out transform hover:scale-105" onclick="clientManagement.handleAddClient()">Guardar Cliente</button>
            <button class="bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-5 rounded-lg mt-3 w-full shadow-md transition duration-300 ease-in-out transform hover:scale-105" onclick="clientManagement.toggleAddClientForm(false)">Cancelar</button>
        </div>
    `;
};

export const renderEditClientModal = () => {
    if (!showEditClientModal || !editingClient) return '';

    const zoneOptions = zonesData.map(z => ({ value: z.name, text: z.name }));
    const sectorOptions = sectorsData.map(s => ({ value: s.name, text: s.name }));

    return `
        <div id="edit-client-modal" class="modal">
            <div class="modal-content">
                <h3 class="text-2xl font-bold mb-4 text-center text-indigo-700">Editar Cliente</h3>
                ${window.createInput('editClientId', 'ID del Cliente', editingClient.id, 'text', false, 'clientManagement.handleEditClientChange("id", this.value)')}
                ${window.createInput('editClientNombreComercial', 'Nombre Comercial', editingClient.nombreComercial, 'text', false, 'clientManagement.handleEditClientChange("nombreComercial", this.value)')}
                ${window.createInput('editClientNombrePersonal', 'Nombre Personal', editingClient.nombrePersonal, 'text', false, 'clientManagement.handleEditClientChange("nombrePersonal", this.value)')}
                <div class="mb-4">
                    ${window.createSelect('editClientZona', zoneOptions, editingClient.zona, 'clientManagement.handleEditClientChange("zona", this.value)', '-- Seleccione Zona --')}
                </div>
                <div class="mb-4">
                    ${window.createSelect('editClientSector', sectorOptions, editingClient.sector, 'clientManagement.handleEditClientChange("sector", this.value)', '-- Seleccione Sector --')}
                </div>
                ${window.createInput('editClientTlf', 'Teléfono', editingClient.tlf, 'text', false, 'clientManagement.handleEditClientChange("tlf", this.value)')}
                ${window.createInput('editClientObservaciones', 'Observaciones', editingClient.observaciones, 'text', false, 'clientManagement.handleEditClientChange("observaciones", this.value)')}
                <div class="flex justify-around gap-4 mt-5">
                    <button class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-5 rounded-lg flex-1 shadow-md transition duration-300 ease-in-out transform hover:scale-105" onclick="clientManagement.saveEditedClient()">Guardar Cambios</button>
                    <button class="bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-5 rounded-lg flex-1 shadow-md transition duration-300 ease-in-out transform hover:scale-105" onclick="clientManagement.closeEditClientModal()">Cancelar</button>
                </div>
            </div>
        </div>
    `;
};

export const renderManageZonesSectorsModal = () => {
    if (!showManageZonesSectorsModalState) return '';
    return `
        <div id="manage-zones-sectors-modal" class="modal">
            <div class="modal-content">
                <h3 class="text-2xl font-bold mb-4 text-center text-indigo-700">Gestionar Zonas y Sectores</h3>

                <div class="mb-8 p-4 bg-blue-50 rounded-lg border border-blue-300">
                    <h4 class="text-xl font-bold mb-3 text-blue-700">Zonas</h4>
                    <div id="zones-list" class="mb-4"></div>
                    <div class="flex gap-2">
                        ${window.createInput('newZoneName', 'Nueva Zona', '', 'text', false, '')}
                        <button class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105" onclick="clientManagement.addZone()">Añadir</button>
                    </div>
                </div>

                <div class="mb-8 p-4 bg-green-50 rounded-lg border border-green-300">
                    <h4 class="text-xl font-bold mb-3 text-green-700">Sectores</h4>
                    <div id="sectors-list" class="mb-4"></div>
                    <div class="flex gap-2">
                        ${window.createInput('newSectorName', 'Nuevo Sector', '', 'text', false, '')}
                        <button class="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105" onclick="clientManagement.addSector()">Añadir</button>
                    </div>
                </div>

                <button class="bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-5 rounded-lg mt-5 w-full shadow-md transition duration-300 ease-in-out transform hover:scale-105" onclick="clientManagement.closeManageZonesSectorsModal()">Cerrar</button>
            </div>
        </div>
    `;
};

// Se llama después de que el modal se ha renderizado
export const updateManageZonesSectorsModalContent = () => {
    if (showManageZonesSectorsModalState) {
        updateZonesList();
        updateSectorsList();
    }
};

// --- Funciones del Modal de Selección de Cliente ---
export const toggleClientPickerModal = (show) => {
    showClientPickerModal = show;
    if (show) {
        clientSearchTerm = ''; // Reset search term
        updateClientPickerList();
    }
    window.setScreenAndRender('venta'); // Re-render to show/hide modal
};

export const selectClientForSale = (client) => {
    selectedClientForSale = client;
    toggleClientPickerModal(false); // Close modal
    window.updateVentaScreenContent(); // Call a function in index.html to update the sale screen
};

export const filterClientsForPicker = (term) => {
    clientSearchTerm = term;
    updateClientPickerList();
};

export const updateClientPickerList = () => {
    const clientPickerListDiv = document.getElementById('client-picker-list');
    if (!clientPickerListDiv) return;

    const filteredClients = clients.filter(client =>
        client.id.toLowerCase().includes(clientSearchTerm.toLowerCase()) ||
        client.nombreComercial.toLowerCase().includes(clientSearchTerm.toLowerCase()) ||
        client.nombrePersonal.toLowerCase().includes(clientSearchTerm.toLowerCase())
    );

    let clientListHtml = '';
    if (filteredClients.length === 0) {
        clientListHtml = '<p class="text-gray-600 text-center py-4">No se encontraron clientes.</p>';
    } else {
        clientListHtml = filteredClients.map(client => `
            <div class="bg-blue-100 p-3 rounded-lg mb-2 flex justify-between items-center border border-blue-200">
                <span class="text-blue-800 font-medium">${client.nombreComercial} (${client.id})</span>
                <button class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-1 px-3 rounded-md text-sm transition duration-150 ease-in-out" onclick="clientManagement.selectClientForSale(${JSON.stringify(client).replace(/"/g, '&quot;')})">Seleccionar</button>
            </div>
        `).join('');
    }
    clientPickerListDiv.innerHTML = clientListHtml;
};

export const renderClientPickerModal = () => {
    if (!showClientPickerModal) return '';
    return `
        <div id="client-picker-modal" class="modal">
            <div class="modal-content">
                <h3 class="text-2xl font-bold mb-4 text-center text-indigo-700">Seleccionar Cliente</h3>
                ${window.createInput('clientSearchInput', 'Buscar por ID o Nombre...', clientSearchTerm, 'text', false, 'clientManagement.filterClientsForPicker(this.value)')}
                <div id="client-picker-list" class="max-h-60 overflow-y-auto mb-4 p-2 border border-gray-300 rounded-lg">
                    <!-- Client list will be populated by updateClientPickerList -->
                </div>
                <button class="bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-5 rounded-lg w-full shadow-md transition duration-300 ease-in-out transform hover:scale-105" onclick="clientManagement.toggleClientPickerModal(false)">Cerrar</button>
            </div>
        </div>
    `;
};

export const closeAllClientModals = () => {
    showClientPickerModal = false;
    showEditClientModal = false;
    showManageZonesSectorsModalState = false;
    showAddClientForm = false; // Also hide the add client form
    editingClient = null;
    originalEditingClientId = null;
    editingZone = null;
    editingSector = null;
    // No explicit render call here, as it's expected to be called by index.html's setScreenAndRender
};
