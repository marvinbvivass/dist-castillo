// clientManagement.js

// Variables globales dentro del módulo para almacenar las instancias de Firestore y la función setScreenAndRender
let _db;
let _setScreenAndRenderFunc;

// Estado global para la gestión de clientes
export let clients = [];
export let zones = [];
export let sectors = [];
export let selectedClientForSale = null;

// Modales de cliente
export let showEditClientModalState = false;
export let editingClient = null;
export let showManageZonesSectorsModalState = false;
export let showClientPickerModal = false;
export let clientPickerSearchTerm = '';
export let clientPickerFilterZone = '';
export let clientPickerFilterSector = '';

// Función de inicialización del módulo
// Ahora acepta la instancia de Firestore y la función setScreenAndRender
export const init = (dbInstance, setScreenAndRenderCallback) => {
    _db = dbInstance;
    _setScreenAndRenderFunc = setScreenAndRenderCallback; // Almacenar la función para uso posterior
    console.log('[Client Management] Módulo inicializado con DB y setScreenAndRender.');
};

// --- Funciones de Modales de Cliente ---
export const closeAllClientModals = () => {
    showEditClientModalState = false;
    editingClient = null;
    showManageZonesSectorsModalState = false;
    showClientPickerModal = false;
    clientPickerSearchTerm = '';
    clientPickerFilterZone = '';
    clientPickerFilterSector = '';
    // No llamar a render aquí, ya que se espera que el módulo principal lo haga.
};

export const openEditClientModal = (client = null) => {
    // Eliminados limiteCredito y diasCredito
    editingClient = client ? { ...client } : { id: '', nombreComercial: '', cedulaRif: '', direccionFiscal: '', telefono: '', correo: '', zona: '', sector: '', estado: 'activo' };
    showEditClientModalState = true;
    if (_setScreenAndRenderFunc) _setScreenAndRenderFunc('clientes'); // Forzar renderizado para mostrar el modal
};

export const closeEditClientModal = () => {
    showEditClientModalState = false;
    editingClient = null;
    if (_setScreenAndRenderFunc) _setScreenAndRenderFunc('clientes'); // Forzar renderizado para ocultar el modal
};

export const openManageZonesSectorsModal = () => {
    showManageZonesSectorsModalState = true;
    if (_setScreenAndRenderFunc) _setScreenAndRenderFunc('clientes');
};

export const closeManageZonesSectorsModal = () => {
    showManageZonesSectorsModalState = false;
    if (_setScreenAndRenderFunc) _setScreenAndRenderFunc('clientes');
};

export const toggleClientPickerModal = (show) => {
    showClientPickerModal = show;
    if (!show) {
        clientPickerSearchTerm = '';
        clientPickerFilterZone = '';
        clientPickerFilterSector = '';
    }
    if (_setScreenAndRenderFunc) _setScreenAndRenderFunc('venta'); // O la pantalla actual que lo necesite
};

export const handleClientPickerSearchChange = (term) => {
    clientPickerSearchTerm = term;
    if (_setScreenAndRenderFunc) _setScreenAndRenderFunc('venta'); // Re-render para actualizar la lista
};

export const handleClientPickerFilterChange = (type, value) => {
    if (type === 'zone') clientPickerFilterZone = value;
    if (type === 'sector') clientPickerFilterSector = value;
    if (_setScreenAndRenderFunc) _setScreenAndRenderFunc('venta'); // Re-render para actualizar la lista
};

export const selectClientForSale = (client) => {
    selectedClientForSale = client;
    toggleClientPickerModal(false); // Cerrar el modal
    if (_setScreenAndRenderFunc) _setScreenAndRenderFunc('venta'); // Volver a la pantalla de venta
};

// Nueva función para resetear selectedClientForSale
export const resetSelectedClientForSale = () => {
    selectedClientForSale = null;
    console.log('[Client Management] selectedClientForSale has been reset.');
};


// --- Funciones de Ayuda Generales (replicadas o adaptadas del index.html si son necesarias aquí) ---
const createButton = (text, id, className = '', dataAttributes = {}) => {
    const dataAttrs = Object.keys(dataAttributes).map(key => `data-${key}="${dataAttributes[key]}"`).join(' ');
    return `<button id="${id}" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-6 rounded-lg m-2 min-w-[150px] shadow-md transition duration-300 ease-in-out transform hover:scale-105 border border-indigo-700 ${className}" ${dataAttrs}>${text}</button>`;
};

const createInput = (id, placeholder, value = '', type = 'text', disabled = false, className = '', dataAttributes = {}) => {
    const dataAttrs = Object.keys(dataAttributes).map(key => `data-${key}="${dataAttributes[key]}"`).join(' ');
    return `<input type="${type}" id="${id}" class="h-12 border border-gray-300 rounded-lg px-4 mb-4 text-base w-full bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${className}" placeholder="${placeholder}" value="${value}" ${disabled ? 'disabled' : ''} ${dataAttrs}>`;
};

const createSelect = (id, options, selectedValue, className = '', placeholder = '-- Seleccione --', dataAttributes = {}) => {
    const dataAttrs = Object.keys(dataAttributes).map(key => `data-${key}="${dataAttributes[key]}"`).join(' ');
    return `
        <select id="${id}" class="h-12 border border-gray-300 rounded-lg px-4 text-base w-full bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent ${className}" ${dataAttrs}>
            <option value="">${placeholder}</option>
            ${options.map(opt => `<option value="${opt.value}" ${selectedValue === opt.value ? 'selected' : ''}>${opt.text}</option>`).join('')}
        </select>
    `;
};

const createTable = (headers, rowsHtml, id = '') => `
    <div class="table-container mb-5">
        <table>
            <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
            <tbody id="${id}">${rowsHtml}</tbody>
        </table>
    </div>
`;

// Helper para mostrar mensajes (usando la función del módulo principal)
const showMessageModal = (message) => {
    // Esto asume que showMessageModal es una función global o pasada al módulo principal
    // Para evitar la dependencia circular, la función showMessageModal del index.html
    // debería ser la única que gestiona el modal. Aquí solo la llamamos si está disponible.
    if (window.showMessageModal) {
        window.showMessageModal(message);
    } else {
        console.warn('showMessageModal no está disponible globalmente. Mensaje:', message);
        alert(message); // Fallback si no está integrada
    }
};

const showConfirmationModal = (message, callback) => {
    if (window.showConfirmationModal) {
        window.showConfirmationModal(message, callback);
    } else {
        console.warn('showConfirmationModal no está disponible globalmente.');
        if (confirm(message)) { // Fallback
            callback();
        }
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

const triggerCSVDownload = (filename, csvContent) => {
    if (!csvContent) {
        showMessageModal(`No se encontró contenido para descargar el archivo: ${filename}`);
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
        showMessageModal('La descarga de archivos no es compatible con este navegador.');
    }
};


// --- Funciones de Carga de Datos desde Firestore para Clientes ---
export const fetchClientData = async () => {
    console.log('[Client Management] Fetching client data...');
    try {
        const clientsSnapshot = await _db.collection('clients').get();
        clients = clientsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const zonesSnapshot = await _db.collection('zones').get();
        zones = zonesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (zones.length === 0) {
            await _db.collection('zones').doc('Zona A').set({ name: 'Zona A' });
            await _db.collection('zones').doc('Zona B').set({ name: 'Zona B' });
            zones = [{ id: 'Zona A', name: 'Zona A' }, { id: 'Zona B', name: 'Zona B' }];
        }

        const sectorsSnapshot = await _db.collection('sectors').get();
        sectors = sectorsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (sectors.length === 0) {
            await _db.collection('sectors').doc('Sector 1').set({ name: 'Sector 1' });
            await _db.collection('sectors').doc('Sector 2').set({ name: 'Sector 2' });
            sectors = [{ id: 'Sector 1', name: 'Sector 1' }, { id: 'Sector 2', name: 'Sector 2' }];
        }

        console.log('[Client Management] Client data fetched successfully.');
    } catch (error) {
        console.error('[Client Management] Error fetching client data:', error);
        showMessageModal('Error al cargar datos de clientes. Revisa tu conexión y las reglas de seguridad.');
        clients = [];
        zones = [{ id: 'Zona A', name: 'Zona A' }, { id: 'Zona B', name: 'Zona B' }];
        sectors = [{ id: 'Sector 1', name: 'Sector 1' }, { id: 'Sector 2', name: 'Sector 2' }];
    }
};

// --- Renderizado de Pantallas de Cliente ---
export const renderClientesScreen = () => {
    console.log('[Client Management] Rendering clients screen.');
    const appRoot = document.getElementById('app-root');
    const clientRows = clients.map(client => `
        <tr>
            <td>${client.nombreComercial}</td>
            <td>${client.cedulaRif}</td>
            <td>${client.telefono}</td>
            <td>${client.zona}</td>
            <td>${client.sector}</td>
            <td>
                ${createButton('Editar', '', 'bg-yellow-500 hover:bg-yellow-600 text-white py-1 px-2 rounded-md text-sm edit-client-button', { clientid: client.id })}
                ${createButton('Eliminar', '', 'bg-red-500 hover:bg-red-600 text-white py-1 px-2 rounded-md text-sm delete-client-button', { clientid: client.id })}
            </td>
        </tr>
    `).join('');

    appRoot.innerHTML = `
        <div class="screen-container bg-white rounded-xl m-2 shadow-md">
            <h2 class="text-2xl font-bold mb-5 text-center text-indigo-700">GESTIÓN DE CLIENTES</h2>
            <div class="flex justify-center mb-6 gap-4">
                ${createButton('Agregar Nuevo Cliente', 'addClientButton', 'bg-emerald-600')}
                ${createButton('Gestionar Zonas y Sectores', 'manageZonesSectorsButton', 'bg-blue-600')}
            </div>
            <div class="table-container mb-5">
                ${createTable(['Nombre Comercial', 'Cédula/RIF', 'Teléfono', 'Zona', 'Sector', 'Acciones'], clientRows, 'clients-table-body')}
            </div>
            ${createButton('Volver al Menú Principal', 'backToMainFromClientsButton', 'bg-gray-600 mt-5 w-full')}
        </div>
    `;
    // addClientScreenEventListeners() fue eliminado de aquí, ahora se maneja por delegación en index.html
};

// --- Funciones CRUD de Clientes ---
export const saveClient = async () => {
    console.log('[Client Management] saveClient called'); // Debug log
    const isNewClient = !editingClient.id;
    const clientData = {
        nombreComercial: document.getElementById('clientName').value.trim(),
        cedulaRif: document.getElementById('clientId').value.trim(),
        direccionFiscal: document.getElementById('clientAddress').value.trim(),
        telefono: document.getElementById('clientPhone').value.trim(),
        correo: document.getElementById('clientEmail').value.trim(),
        zona: document.getElementById('clientZone').value.trim(),
        sector: document.getElementById('clientSector').value.trim(),
        // Eliminados limiteCredito y diasCredito
        estado: document.getElementById('clientStatus').value,
    };

    if (!clientData.nombreComercial || !clientData.cedulaRif || !clientData.telefono) {
        showMessageModal('Nombre Comercial, Cédula/RIF y Teléfono son campos obligatorios.');
        return;
    }

    if (isNewClient && clients.some(c => c.cedulaRif === clientData.cedulaRif)) {
        showMessageModal('Ya existe un cliente con esta Cédula/RIF.');
        return;
    }

    try {
        if (isNewClient) {
            await _db.collection('clients').doc(clientData.cedulaRif).set(clientData);
            clients.push({ id: clientData.cedulaRif, ...clientData });
        } else {
            await _db.collection('clients').doc(editingClient.id).update(clientData);
            clients = clients.map(c => c.id === editingClient.id ? { id: editingClient.id, ...clientData } : c);
        }
        showMessageModal('Cliente guardado exitosamente.');
        closeEditClientModal();
        if (_setScreenAndRenderFunc) _setScreenAndRenderFunc('clientes'); // Re-render the client list
    } catch (error) {
        console.error('Error al guardar cliente:', error);
        showMessageModal('Error al guardar cliente. Revisa tu conexión y reglas de seguridad.');
    }
};

export const deleteClient = async (clientId) => {
    console.log('[Client Management] deleteClient called for ID:', clientId); // Debug log
    try {
        await _db.collection('clients').doc(clientId).delete();
        clients = clients.filter(c => c.id !== clientId);
        showMessageModal('Cliente eliminado exitosamente.');
        if (_setScreenAndRenderFunc) _setScreenAndRenderFunc('clientes'); // Re-render the client list
    } catch (error) {
        console.error('Error al eliminar cliente:', error);
        showMessageModal('Error al eliminar cliente. Revisa tu conexión y reglas de seguridad.');
    }
};

// --- Renderizado y Lógica de Modales ---
export const renderEditClientModal = () => {
    if (!showEditClientModalState) return '';
    const isNew = !editingClient || !editingClient.id;
    const client = editingClient || {};

    const statusOptions = [
        { value: 'activo', text: 'Activo' },
        { value: 'inactivo', text: 'Inactivo' }
    ];
    const zoneOptions = zones.map(z => ({ value: z.name, text: z.name }));
    const sectorOptions = sectors.map(s => ({ value: s.name, text: s.name }));

    return `
        <div id="edit-client-modal" class="modal">
            <div class="modal-content">
                <h3 class="text-2xl font-bold mb-4 text-center text-indigo-700">${isNew ? 'Agregar Nuevo Cliente' : 'Editar Cliente'}</h3>
                ${createInput('clientName', 'Nombre Comercial', client.nombreComercial)}
                ${createInput('clientId', 'Cédula/RIF', client.cedulaRif, 'text', !isNew)}
                ${createInput('clientAddress', 'Dirección Fiscal', client.direccionFiscal)}
                ${createInput('clientPhone', 'Teléfono', client.telefono, 'tel')}
                ${createInput('clientEmail', 'Correo Electrónico', client.correo, 'email')}
                ${createSelect('clientZone', zoneOptions, client.zona, '', '-- Seleccione Zona --')}
                ${createSelect('clientSector', sectorOptions, client.sector, '', '-- Seleccione Sector --')}
                <!-- Eliminados Límite de Crédito y Días de Crédito -->
                ${createSelect('clientStatus', statusOptions, client.estado || 'activo', '', '-- Seleccione Estado --')}
                <div class="flex justify-around gap-4 mt-5">
                    ${createButton('Guardar Cliente', 'saveClientButton', 'bg-emerald-600 flex-1')}
                    ${createButton('Cancelar', 'cancelEditClientButton', 'bg-gray-600 flex-1')}
                </div>
            </div>
        </div>
    `;
};

export const renderManageZonesSectorsModal = () => {
    if (!showManageZonesSectorsModalState) return '';

    const zoneRows = zones.map(zone => `
        <tr>
            <td>${zone.name}</td>
            <td>
                ${createButton('Eliminar', '', 'bg-red-500 hover:bg-red-600 text-white py-1 px-2 rounded-md text-sm delete-zone-button', { zonename: zone.name })}
            </td>
        </tr>
    `).join('');

    const sectorRows = sectors.map(sector => `
        <tr>
            <td>${sector.name}</td>
            <td>
                ${createButton('Eliminar', '', 'bg-red-500 hover:bg-red-600 text-white py-1 px-2 rounded-md text-sm delete-sector-button', { sectorname: sector.name })}
            </td>
        </tr>
    `).join('');

    return `
        <div id="manage-zones-sectors-modal" class="modal">
            <div class="modal-content">
                <h3 class="text-2xl font-bold mb-4 text-center text-indigo-700">Gestionar Zonas y Sectores</h3>

                <div class="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-300">
                    <h4 class="text-xl font-bold mb-3 text-blue-700">Zonas</h4>
                    ${createInput('newZoneName', 'Nueva Zona')}
                    ${createButton('Agregar Zona', 'addZoneButton', 'bg-blue-600 w-full mb-4')}
                    ${createTable(['Nombre', 'Acciones'], zoneRows, 'zones-table-body')}
                </div>

                <div class="mb-6 p-4 bg-green-50 rounded-lg border border-green-300">
                    <h4 class="text-xl font-bold mb-3 text-green-700">Sectores</h4>
                    ${createInput('newSectorName', 'Nuevo Sector')}
                    ${createButton('Agregar Sector', 'addSectorButton', 'bg-green-600 w-full mb-4')}
                    ${createTable(['Nombre', 'Acciones'], sectorRows, 'sectors-table-body')}
                </div>

                ${createButton('Cerrar', 'closeManageZonesSectorsButton', 'bg-gray-600 mt-5 w-full')}
            </div>
        </div>
    `;
};

export const updateManageZonesSectorsModalContent = () => {
    if (!showManageZonesSectorsModalState) return;
    const modalContent = document.querySelector('#manage-zones-sectors-modal .modal-content');
    if (!modalContent) return;

    // Re-render only the dynamic parts
    const zoneRows = zones.map(zone => `
        <tr>
            <td>${zone.name}</td>
            <td>
                ${createButton('Eliminar', '', 'bg-red-500 hover:bg-red-600 text-white py-1 px-2 rounded-md text-sm delete-zone-button', { zonename: zone.name })}
            </td>
        </tr>
    `).join('');
    const zonesTableBody = modalContent.querySelector('#zones-table-body');
    if (zonesTableBody) zonesTableBody.innerHTML = zoneRows;

    const sectorRows = sectors.map(sector => `
        <tr>
            <td>${sector.name}</td>
            <td>
                ${createButton('Eliminar', '', 'bg-red-500 hover:bg-red-600 text-white py-1 px-2 rounded-md text-sm delete-sector-button', { sectorname: sector.name })}
            </td>
        </tr>
    `).join('');
    const sectorsTableBody = modalContent.querySelector('#sectors-table-body');
    if (sectorsTableBody) sectorsTableBody.innerHTML = sectorRows;

    // addManageZonesSectorsModalEventListeners() fue eliminado de aquí.
    // Los event listeners para estos botones se manejan por delegación en index.html.
};

export const renderClientPickerModal = () => {
    if (!showClientPickerModal) return '';

    const zoneOptions = zones.map(z => ({ value: z.name, text: z.name }));
    const sectorOptions = sectors.map(s => ({ value: s.name, text: s.name }));

    return `
        <div id="client-picker-modal" class="modal">
            <div class="modal-content">
                <h3 class="text-2xl font-bold mb-4 text-center text-purple-700">Seleccionar Cliente</h3>
                <div class="mb-4 p-4 bg-purple-50 rounded-lg border border-purple-300">
                    ${createInput('clientPickerSearchInput', 'Buscar por nombre, cédula, teléfono...', clientPickerSearchTerm)}
                    <div class="flex flex-wrap gap-4 mt-2">
                        <div class="flex-1 min-w-[150px]">
                            ${createSelect('clientPickerFilterZone', zoneOptions, clientPickerFilterZone, 'w-full', '-- Filtrar por Zona --')}
                        </div>
                        <div class="flex-1 min-w-[150px]">
                            ${createSelect('clientPickerFilterSector', sectorOptions, clientPickerFilterSector, 'w-full', '-- Filtrar por Sector --')}
                        </div>
                    </div>
                </div>
                <div id="client-picker-list" class="max-h-60 overflow-y-auto mb-4 border border-gray-200 rounded-lg p-2">
                    <!-- Client list will be rendered here by updateClientPickerList -->
                </div>
                ${createButton('Cerrar', 'closeClientPickerButton', 'bg-gray-600 w-full')}
            </div>
        </div>
    `;
};

export const updateClientPickerList = () => {
    if (!showClientPickerModal) return;
    const clientPickerListDiv = document.getElementById('client-picker-list');
    if (!clientPickerListDiv) return;

    const filteredClients = clients.filter(client => {
        const matchesSearch = clientPickerSearchTerm === '' ||
            client.nombreComercial.toLowerCase().includes(clientPickerSearchTerm.toLowerCase()) ||
            client.cedulaRif.toLowerCase().includes(clientPickerSearchTerm.toLowerCase()) ||
            client.telefono.toLowerCase().includes(clientPickerSearchTerm.toLowerCase());
        const matchesZone = clientPickerFilterZone === '' || client.zona === clientPickerFilterZone;
        const matchesSector = clientPickerFilterSector === '' || client.sector === clientPickerFilterSector;
        return matchesSearch && matchesZone && matchesSector;
    });

    if (filteredClients.length === 0) {
        clientPickerListDiv.innerHTML = '<p class="text-center text-gray-500 py-4">No se encontraron clientes.</p>';
        return;
    }

    clientPickerListDiv.innerHTML = filteredClients.map(client => `
        <div class="p-3 mb-2 bg-purple-100 rounded-lg border border-purple-200 cursor-pointer hover:bg-purple-200 select-client-item" data-client='${JSON.stringify(client)}'>
            <p class="font-semibold text-purple-800">${client.nombreComercial}</p>
            <p class="text-sm text-gray-600">${client.cedulaRif} - ${client.telefono}</p>
            <p class="text-xs text-gray-500">${client.zona} / ${client.sector}</p>
        </div>
    `).join('');

    // Add event listeners for client selection
    // Estos onclicks se manejan directamente aquí porque son elementos dentro del modal
    // y se re-renderizan con cada actualización de la lista.
    clientPickerListDiv.querySelectorAll('.select-client-item').forEach(item => {
        item.onclick = (e) => {
            const clientData = JSON.parse(e.currentTarget.dataset.client);
            selectClientForSale(clientData);
        };
    });
};

// --- Funciones CRUD de Zonas y Sectores ---
export const addZone = async () => {
    console.log('[Client Management] addZone called'); // Debug log
    const newZoneName = document.getElementById('newZoneName').value.trim();
    if (!newZoneName) { showMessageModal('El nombre de la zona no puede estar vacío.'); return; }
    if (zones.some(z => z.name === newZoneName)) { showMessageModal('Esta zona ya existe.'); return; }

    try {
        await _db.collection('zones').doc(newZoneName).set({ name: newZoneName });
        zones.push({ id: newZoneName, name: newZoneName });
        showMessageModal('Zona agregada exitosamente.');
        document.getElementById('newZoneName').value = '';
        updateManageZonesSectorsModalContent(); // Actualizar el contenido del modal
    } catch (error) {
        console.error('Error al agregar zona:', error);
        showMessageModal('Error al agregar zona. Revisa tu conexión y reglas de seguridad.');
    }
};

export const deleteZone = async (zoneName) => {
    console.log('[Client Management] deleteZone called for:', zoneName); // Debug log
    try {
        await _db.collection('zones').doc(zoneName).delete();
        zones = zones.filter(z => z.name !== zoneName);
        showMessageModal('Zona eliminada exitosamente.');
        updateManageZonesSectorsModalContent(); // Actualizar el contenido del modal
    } catch (error) {
        console.error('Error al eliminar zona:', error);
        showMessageModal('Error al eliminar zona. Revisa tu conexión y reglas de seguridad.');
    }
};

export const addSector = async () => {
    console.log('[Client Management] addSector called'); // Debug log
    const newSectorName = document.getElementById('newSectorName').value.trim();
    if (!newSectorName) { showMessageModal('El nombre del sector no puede estar vacío.'); return; }
    if (sectors.some(s => s.name === newSectorName)) { showMessageModal('Este sector ya existe.'); return; }

    try {
        await _db.collection('sectors').doc(newSectorName).set({ name: newSectorName });
        sectors.push({ id: newSectorName, name: newSectorName });
        showMessageModal('Sector agregado exitosamente.');
        document.getElementById('newSectorName').value = '';
        updateManageZonesSectorsModalContent(); // Actualizar el contenido del modal
    } catch (error) {
        console.error('Error al agregar sector:', error);
        showMessageModal('Error al agregar sector. Revisa tu conexión y reglas de seguridad.');
    }
};

export const deleteSector = async (sectorName) => {
    console.log('[Client Management] deleteSector called for:', sectorName); // Debug log
    try {
        await _db.collection('sectors').doc(sectorName).delete();
        sectors = sectors.filter(s => s.name !== sectorName);
        showMessageModal('Sector eliminado exitosamente.');
        updateManageZonesSectorsModalContent(); // Actualizar el contenido del modal
    }
    catch (error) {
        console.error('Error al eliminar sector:', error);
        showMessageModal('Error al eliminar sector. Revisa tu conexión y reglas de seguridad.');
    }
};

// --- Manejo de Carga de Archivos CSV de Clientes ---
export const handleClientFileUpload = async (event) => {
    console.log('[Client Management] handleClientFileUpload called'); // Debug log
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        const parsedData = parseCSV(e.target.result);
        if (parsedData.length === 0) {
            showMessageModal('El archivo CSV de clientes está vacío o no tiene el formato correcto.');
            return;
        }

        try {
            const batch = _db.batch();
            const clientsCollectionRef = _db.collection('clients');
            const existingClientsSnapshot = await clientsCollectionRef.get();

            // Eliminar clientes existentes antes de cargar los nuevos
            existingClientsSnapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });

            // Añadir nuevos clientes del CSV
            for (const row of parsedData) {
                const clientId = row['Cédula/RIF'] || row['cedulaRif']; // Asegúrate de usar el nombre de columna correcto
                if (!clientId) {
                    console.warn('Fila sin Cédula/RIF, saltando:', row);
                    continue;
                }
                batch.set(clientsCollectionRef.doc(clientId), {
                    nombreComercial: row['Nombre Comercial'] || row['nombreComercial'] || '',
                    cedulaRif: clientId,
                    direccionFiscal: row['Dirección Fiscal'] || row['direccionFiscal'] || '',
                    telefono: row['Teléfono'] || row['telefono'] || '',
                    correo: row['Correo Electrónico'] || row['correo'] || '',
                    zona: row['Zona'] || row['zona'] || '',
                    sector: row['Sector'] || row['sector'] || '',
                    // Eliminados limiteCredito y diasCredito
                    estado: row['Estado'] || row['estado'] || 'activo',
                });
            }
            await batch.commit();
            await fetchClientData(); // Re-fetch para actualizar el estado local
            showMessageModal('clientes.csv cargado y guardado exitosamente en Firestore.');
            if (_setScreenAndRenderFunc) _setScreenAndRenderFunc('clientes'); // Re-render la pantalla de clientes
        } catch (error) {
            console.error('Error al cargar archivo CSV de clientes a Firestore:', error);
            showMessageModal('Error al cargar archivo de clientes. Por favor, revisa tu conexión y las reglas de seguridad de Firestore.');
        }
    };
    reader.readAsText(file);
};

// --- Descarga de Clientes CSV ---
export const downloadClientsCSV = () => {
    console.log('[Client Management] downloadClientsCSV called'); // Debug log
    // Eliminados 'Límite de Crédito' y 'Días de Crédito' de los headers
    const headers = ['Nombre Comercial', 'Cédula/RIF', 'Dirección Fiscal', 'Teléfono', 'Correo Electrónico', 'Zona', 'Sector', 'Estado'];
    const dataToDownload = clients.map(client => ({
        'Nombre Comercial': client.nombreComercial,
        'Cédula/RIF': client.cedulaRif,
        'Dirección Fiscal': client.direccionFiscal,
        'Teléfono': client.telefono,
        'Correo Electrónico': client.correo,
        'Zona': client.zona,
        'Sector': client.sector,
        'Estado': client.estado,
    }));
    const csvContent = toCSV(dataToDownload, headers);
    triggerCSVDownload('clientes.csv', csvContent);
};

// Los event listeners para los modales de cliente se han movido a index.html
// para centralizar el manejo de eventos a través de delegación.
