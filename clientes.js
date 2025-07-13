// clients.js
// Este archivo contiene toda la lógica y la interfaz de usuario
// para la gestión de clientes, zonas y sectores.

// --- Variables de Estado Específicas de Clientes ---
// Estas variables se declaran globalmente en este script para ser accesibles
// por todas las funciones de gestión de clientes.
// Las variables `clients`, `zonesData`, `sectorsData` son globales y se cargan desde index.html.
// Asegúrate de que `db`, `auth`, `isAdmin`, `setScreenAndRender`, `showMessageModal`,
// `showConfirmationModal`, `parseCSV`, `toCSV`, `downloadCSV` también sean accesibles globalmente
// desde `index.html`.

let newClient = {
    id: '', // RUC o C.I.
    nombreComercial: '',
    nombrePersonal: '',
    tlf: '',
    direccion: '',
    zona: '',
    sector: '',
    tipoCliente: 'Persona Natural', // 'Persona Natural' o 'Empresa'
    observaciones: ''
};
let clientSearchTermClientes = ''; // Para la búsqueda en la pantalla de clientes
let showAddClientForm = false; // Controla la visibilidad del formulario de añadir cliente
let editingClient = null; // Almacena el cliente que se está editando
let originalEditingClientId = null; // Para guardar el ID original al editar
let showEditClientModal = false; // Controla la visibilidad del modal de edición
let showManageZonesSectorsModalState = false; // Controla la visibilidad del modal de gestión de zonas/sectores
let editingZone = null; // Almacena la zona que se está editando
let editingSector = null; // Almacena el sector que se está editando

// --- Funciones de Ayuda para Clientes, Zonas y Sectores ---

// Función para obtener valores únicos de una propiedad de los clientes
const getUniqueClientValues = (prop) => {
    return [...new Set(clients.map(client => client[prop]).filter(Boolean))].sort();
};

// --- PANTALLA PRINCIPAL DE CLIENTES ---
// Esta es la función que `index.html` llamará para renderizar la pantalla de clientes.
const renderClientsScreenExternal = () => {
    // No se requiere check de isAdmin() aquí, ya que los usuarios normales también pueden ver clientes.
    // Las acciones de edición/eliminación sí tendrán el check.

    const clientsDiv = document.createElement('div');
    clientsDiv.className = 'screen-container bg-white rounded-xl m-2 shadow-md';
    clientsDiv.innerHTML = `
        <h2 class="text-2xl font-bold mb-5 text-center text-indigo-700">GESTIÓN DE CLIENTES</h2>

        <div class="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-300">
            <label for="clientSearchInputClientes" class="block text-lg font-semibold text-blue-700 mb-2">Buscar Cliente:</label>
            <input type="text" id="clientSearchInputClientes" class="h-12 border border-gray-300 rounded-lg px-4 text-base w-full bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Buscar por RUC/CI, Nombre Comercial, Nombre Personal, Teléfono..." value="${clientSearchTermClientes}" onkeyup="filterClientsForClientesScreen(this.value)">
        </div>

        <div class="flex flex-wrap justify-center gap-4 mb-6">
            ${isAdmin() ? `<button class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-5 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105" onclick="toggleAddClientForm()">Añadir Nuevo Cliente</button>` : ''}
            ${isAdmin() ? `<button class="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-5 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105" onclick="openManageZonesSectorsModal()">Gestionar Zonas/Sectores</button>` : ''}
            ${isAdmin() ? `<label class="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-5 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 cursor-pointer file-input-wrapper">
                Cargar Clientes CSV
                <input type="file" onchange="handleClientFileUpload(event, 'clients')" accept=".csv">
            </label>` : ''}
            ${isAdmin() ? `<button class="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-5 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105" onclick="downloadClientData('clients')">Descargar Clientes CSV</button>` : ''}
        </div>

        <div id="add-client-form-container" class="${showAddClientForm ? 'block' : 'hidden'} p-4 bg-lime-50 rounded-lg border border-lime-300 mb-6">
            <h3 class="text-xl font-bold mb-4 text-lime-700">Añadir Nuevo Cliente</h3>
            <input type="text" id="newClientId" class="h-12 border border-gray-300 rounded-lg px-4 mb-3 text-base w-full bg-white" placeholder="RUC o C.I. (Obligatorio)">
            <input type="text" id="newClientNombreComercial" class="h-12 border border-gray-300 rounded-lg px-4 mb-3 text-base w-full bg-white" placeholder="Nombre Comercial (Obligatorio)">
            <input type="text" id="newClientNombrePersonal" class="h-12 border border-gray-300 rounded-lg px-4 mb-3 text-base w-full bg-white" placeholder="Nombre Personal (Obligatorio)">
            <input type="tel" id="newClientTlf" class="h-12 border border-gray-300 rounded-lg px-4 mb-3 text-base w-full bg-white" placeholder="Teléfono (Obligatorio)">
            <input type="text" id="newClientDireccion" class="h-12 border border-gray-300 rounded-lg px-4 mb-3 text-base w-full bg-white" placeholder="Dirección">
            <select id="newClientZona" class="h-12 border border-gray-300 rounded-lg px-4 mb-3 text-base w-full bg-white">
                <option value="">Seleccionar Zona</option>
                ${zonesData.map(zone => `<option value="${zone.name}">${zone.name}</option>`).join('')}
            </select>
            <select id="newClientSector" class="h-12 border border-gray-300 rounded-lg px-4 mb-3 text-base w-full bg-white">
                <option value="">Seleccionar Sector</option>
                ${sectorsData.map(sector => `<option value="${sector.name}">${sector.name}</option>`).join('')}
            </select>
            <select id="newClientTipoCliente" class="h-12 border border-gray-300 rounded-lg px-4 mb-3 text-base w-full bg-white">
                <option value="Persona Natural">Persona Natural</option>
                <option value="Empresa">Empresa</option>
            </select>
            <textarea id="newClientObservaciones" class="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline mb-3" rows="3" placeholder="Observaciones"></textarea>
            <button class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-5 rounded-lg mt-3 w-full shadow-md transition duration-300 ease-in-out transform hover:scale-105" onclick="handleAddClient()">Guardar Cliente</button>
        </div>

        <div class="mb-8 p-4 bg-emerald-50 rounded-lg border border-emerald-300">
            <h3 class="text-xl font-bold mb-4 text-emerald-700">Lista de Clientes</h3>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>RUC/CI</th>
                            <th>Nombre Comercial</th>
                            <th>Nombre Personal</th>
                            <th>Teléfono</th>
                            <th>Dirección</th>
                            <th>Zona</th>
                            <th>Sector</th>
                            <th>Tipo</th>
                            <th>Observaciones</th>
                            ${isAdmin() ? `<th>Acciones</th>` : ''}
                        </tr>
                    </thead>
                    <tbody id="clients-table-body">
                    </tbody>
                </table>
            </div>
        </div>

        <button class="bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-5 rounded-lg mt-5 w-full shadow-md transition duration-300 ease-in-out transform hover:scale-105" onclick="setScreenAndRender('main')">Volver</button>
    `;
    appRoot.appendChild(clientsDiv);

    updateClientTableForClientesScreen();

    // Renderizar modales si están activos
    if (showEditClientModal) {
        renderEditClientModal();
    }
    if (showManageZonesSectorsModalState) {
        renderManageZonesSectorsModal();
    }
};

// Función para filtrar clientes en la pantalla de gestión de clientes
const filterClientsForClientesScreen = (term) => {
    clientSearchTermClientes = term;
    updateClientTableForClientesScreen();
};

// Función para actualizar la tabla de clientes en la pantalla de gestión
const updateClientTableForClientesScreen = () => {
    const clientsTableBody = document.getElementById('clients-table-body');
    if (!clientsTableBody) return; // Asegurarse de que el elemento existe

    clientsTableBody.innerHTML = ''; // Limpiar la tabla antes de rellenar

    const filteredClients = clients.filter(client =>
        client.id.toLowerCase().includes(clientSearchTermClientes.toLowerCase()) ||
        client.nombreComercial.toLowerCase().includes(clientSearchTermClientes.toLowerCase()) ||
        client.nombrePersonal.toLowerCase().includes(clientSearchTermClientes.toLowerCase()) ||
        client.tlf.toLowerCase().includes(clientSearchTermClientes.toLowerCase())
    );

    if (filteredClients.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `<td colspan="${isAdmin() ? 10 : 9}" class="text-center text-gray-500 py-4">No se encontraron clientes que coincidan con la búsqueda.</td>`;
        clientsTableBody.appendChild(row);
        return;
    }

    filteredClients.forEach(client => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${client.id}</td>
            <td>${client.nombreComercial}</td>
            <td>${client.nombrePersonal}</td>
            <td>${client.tlf}</td>
            <td>${client.direccion || 'N/A'}</td>
            <td>${client.zona || 'N/A'}</td>
            <td>${client.sector || 'N/A'}</td>
            <td>${client.tipoCliente || 'N/A'}</td>
            <td>${client.observaciones || 'N/A'}</td>
            ${isAdmin() ? `
            <td>
                <button class="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-1 px-2 rounded-md text-sm mr-2" onclick="openEditClientModal('${client.id}')">Editar</button>
                <button class="bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-2 rounded-md text-sm" onclick="showDeleteClientConfirmation('${client.id}')">Eliminar</button>
            </td>
            ` : ''}
        `;
        clientsTableBody.appendChild(row);
    });
};

// --- FUNCIONES PARA AÑADIR CLIENTE ---
const toggleAddClientForm = () => {
    if (!isAdmin()) {
        showMessageModal('Acceso denegado: Solo los administradores pueden añadir clientes.');
        return;
    }
    showAddClientForm = !showAddClientForm;
    render();
};

const handleAddClient = async () => {
    if (!isAdmin()) {
        showMessageModal('Acceso denegado: Solo los administradores pueden añadir clientes.');
        return;
    }

    const id = document.getElementById('newClientId').value.trim();
    const nombreComercial = document.getElementById('newClientNombreComercial').value.trim();
    const nombrePersonal = document.getElementById('newClientNombrePersonal').value.trim();
    const tlf = document.getElementById('newClientTlf').value.trim();
    const direccion = document.getElementById('newClientDireccion').value.trim();
    const zona = document.getElementById('newClientZona').value;
    const sector = document.getElementById('newClientSector').value;
    const tipoCliente = document.getElementById('newClientTipoCliente').value;
    const observaciones = document.getElementById('newClientObservaciones').value.trim();

    if (!id || !nombreComercial || !nombrePersonal || !tlf) {
        showMessageModal('Error: RUC/C.I., Nombre Comercial, Nombre Personal y Teléfono son obligatorios.');
        return;
    }

    if (clients.some(client => client.id === id)) {
        showMessageModal('Error: Ya existe un cliente con este RUC/C.I.');
        return;
    }

    const clientToAdd = {
        id,
        nombreComercial,
        nombrePersonal,
        tlf,
        direccion,
        zona,
        sector,
        tipoCliente,
        observaciones,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        await db.collection('clients').doc(id).set(clientToAdd);
        clients.push(clientToAdd); // Añadir al array local
        showMessageModal('Cliente añadido exitosamente.');
        // Limpiar formulario y ocultarlo
        newClient = {
            id: '',
            nombreComercial: '',
            nombrePersonal: '',
            tlf: '',
            direccion: '',
            zona: '',
            sector: '',
            tipoCliente: 'Persona Natural',
            observaciones: ''
        };
        document.getElementById('newClientId').value = '';
        document.getElementById('newClientNombreComercial').value = '';
        document.getElementById('newClientNombrePersonal').value = '';
        document.getElementById('newClientTlf').value = '';
        document.getElementById('newClientDireccion').value = '';
        document.getElementById('newClientZona').value = '';
        document.getElementById('newClientSector').value = '';
        document.getElementById('newClientTipoCliente').value = 'Persona Natural';
        document.getElementById('newClientObservaciones').value = '';

        showAddClientForm = false;
        render(); // Re-renderizar para actualizar la tabla
    } catch (error) {
        console.error('Error al añadir cliente:', error);
        showMessageModal('Error al añadir cliente. Por favor, revisa tu conexión y las reglas de seguridad.');
    }
};

// --- FUNCIONES PARA EDITAR CLIENTE ---
const openEditClientModal = (clientId) => {
    if (!isAdmin()) {
        showMessageModal('Acceso denegado: Solo los administradores pueden editar clientes.');
        return;
    }
    editingClient = JSON.parse(JSON.stringify(clients.find(c => c.id === clientId))); // Copia profunda
    originalEditingClientId = clientId; // Guardar el ID original
    showEditClientModal = true;
    render();
};

const closeEditClientModal = () => {
    showEditClientModal = false;
    editingClient = null;
    originalEditingClientId = null;
    render();
};

const handleEditClientChange = (field, value) => {
    if (editingClient) {
        editingClient[field] = value;
    }
};

const saveEditedClient = async () => {
    if (!isAdmin()) {
        showMessageModal('Acceso denegado: Solo los administradores pueden guardar cambios en clientes.');
        return;
    }
    if (!editingClient) return;

    const clientToSave = editingClient;
    // Captura el valor actual de originalEditingClientId en una constante local
    const currentOriginalId = originalEditingClientId; // <-- ¡Este es el cambio clave!

    // Validación básica
    if (!clientToSave.id || !clientToSave.nombreComercial || !clientToSave.nombrePersonal || !clientToSave.tlf) {
        showMessageModal('Error: RUC/C.I., Nombre Comercial, Nombre Personal y Teléfono son obligatorios.');
        return;
    }

    // La lógica de "cambiar" el ID en Firestore implica crear uno nuevo y borrar el viejo.
    const isIdChanged = clientToSave.id !== currentOriginalId;

    if (isIdChanged) {
        showConfirmationModal(
            `El ID del cliente ha cambiado de "${currentOriginalId}" a "${clientToSave.id}". ` +
            `Esto creará un nuevo cliente y eliminará el antiguo. ` +
            `Las ventas históricas asociadas al ID antiguo NO se actualizarán automáticamente. ` +
            `¿Deseas continuar?`,
            async () => { // ESTE ES EL CALLBACK
                // Usar el valor capturado, NO la variable global directamente
                if (!currentOriginalId || currentOriginalId.trim() === '') {
                    showMessageModal('Error interno: El ID del cliente original es inválido. No se puede realizar el cambio de ID.');
                    console.error('Error: currentOriginalId es nulo o vacío al intentar cambiar el ID. No se puede eliminar el cliente antiguo.');
                    return; // Detener la ejecución del callback
                }

                // Verificar si el nuevo ID ya existe
                if (clients.some(c => c.id === clientToSave.id && c.id !== currentOriginalId)) {
                    showMessageModal('Error: El nuevo RUC/C.I. ya está en uso por otro cliente.');
                    return;
                }

                try {
                    const batch = db.batch();

                    // 1. Crear un nuevo documento de cliente con el nuevo ID
                    const newClientRef = db.collection('clients').doc(clientToSave.id);
                    batch.set(newClientRef, clientToSave);

                    // 2. Eliminar el documento de cliente antiguo usando el ID original
                    const oldClientRef = db.collection('clients').doc(currentOriginalId);
                    batch.delete(oldClientRef);

                    await batch.commit();

                    // Actualizar el array local de clientes
                    clients = clients.filter(c => c.id !== currentOriginalId); // Eliminar el cliente antiguo usando el ID capturado
                    clients.push(clientToSave); // Añadir el nuevo cliente
                    showMessageModal('Cliente actualizado exitosamente (ID cambiado). Las ventas históricas no se actualizaron.');
                    closeEditClientModal();
                    setScreenAndRender('clientes'); // Re-renderizar la pantalla de clientes para mostrar las actualizaciones
                } catch (error) {
                    console.error('Error al actualizar cliente (cambio de ID) en Firestore:', error);
                    showMessageModal('Error al actualizar cliente (cambio de ID). Por favor, revisa tu conexión y las reglas de seguridad.');
                }
            }
        );
    } else {
        try {
            // Si el ID no cambió, simplemente actualiza el documento existente
            await db.collection('clients').doc(clientToSave.id).set(clientToSave);
            // Actualizar el array local de clientes
            clients = clients.map(c => c.id === clientToSave.id ? clientToSave : c);
            showMessageModal('Cliente actualizado exitosamente.');
            closeEditClientModal();
            setScreenAndRender('clientes'); // Re-renderizar la pantalla de clientes para mostrar las actualizaciones
        } catch (error) {
            console.error('Error al actualizar cliente en Firestore:', error);
            showMessageModal('Error al actualizar cliente. Por favor, revisa tu conexión y las reglas de seguridad.');
        }
    }
};


const renderEditClientModal = () => {
    if (!showEditClientModal || !editingClient) return;

    const modalDiv = document.createElement('div');
    modalDiv.id = 'edit-client-modal';
    modalDiv.className = 'modal';
    modalDiv.innerHTML = `
        <div class="modal-content">
            <h3 class="text-2xl font-bold mb-4 text-center text-indigo-700">Editar Cliente</h3>
            <input type="text" id="editClientId" class="h-12 border border-gray-300 rounded-lg px-4 mb-3 text-base w-full bg-white" placeholder="RUC o C.I." value="${editingClient.id}" onchange="handleEditClientChange('id', this.value)">
            <input type="text" id="editClientNombreComercial" class="h-12 border border-gray-300 rounded-lg px-4 mb-3 text-base w-full bg-white" placeholder="Nombre Comercial" value="${editingClient.nombreComercial}" onchange="handleEditClientChange('nombreComercial', this.value)">
            <input type="text" id="editClientNombrePersonal" class="h-12 border border-gray-300 rounded-lg px-4 mb-3 text-base w-full bg-white" placeholder="Nombre Personal" value="${editingClient.nombrePersonal}" onchange="handleEditClientChange('nombrePersonal', this.value)">
            <input type="tel" id="editClientTlf" class="h-12 border border-gray-300 rounded-lg px-4 mb-3 text-base w-full bg-white" placeholder="Teléfono" value="${editingClient.tlf}" onchange="handleEditClientChange('tlf', this.value)">
            <input type="text" id="editClientDireccion" class="h-12 border border-gray-300 rounded-lg px-4 mb-3 text-base w-full bg-white" placeholder="Dirección" value="${editingClient.direccion}" onchange="handleEditClientChange('direccion', this.value)">
            <select id="editClientZona" class="h-12 border border-gray-300 rounded-lg px-4 mb-3 text-base w-full bg-white" onchange="handleEditClientChange('zona', this.value)">
                <option value="">Seleccionar Zona</option>
                ${zonesData.map(zone => `<option value="${zone.name}" ${editingClient.zona === zone.name ? 'selected' : ''}>${zone.name}</option>`).join('')}
            </select>
            <select id="editClientSector" class="h-12 border border-gray-300 rounded-lg px-4 mb-3 text-base w-full bg-white" onchange="handleEditClientChange('sector', this.value)">
                <option value="">Seleccionar Sector</option>
                ${sectorsData.map(sector => `<option value="${sector.name}" ${editingClient.sector === sector.name ? 'selected' : ''}>${sector.name}</option>`).join('')}
            </select>
            <select id="editClientTipoCliente" class="h-12 border border-gray-300 rounded-lg px-4 mb-3 text-base w-full bg-white" onchange="handleEditClientChange('tipoCliente', this.value)">
                <option value="Persona Natural" ${editingClient.tipoCliente === 'Persona Natural' ? 'selected' : ''}>Persona Natural</option>
                <option value="Empresa" ${editingClient.tipoCliente === 'Empresa' ? 'selected' : ''}>Empresa</option>
            </select>
            <textarea id="editClientObservaciones" class="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline mb-3" rows="3" placeholder="Observaciones" onchange="handleEditClientChange('observaciones', this.value)">${editingClient.observaciones}</textarea>
            <div class="flex justify-around gap-4 mt-5">
                <button class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-5 rounded-lg flex-1 shadow-md transition duration-300 ease-in-out transform hover:scale-105" onclick="saveEditedClient()">Guardar Cambios</button>
                <button class="bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-5 rounded-lg flex-1 shadow-md transition duration-300 ease-in-out transform hover:scale-105" onclick="closeEditClientModal()">Cancelar</button>
            </div>
        </div>
    `;
    appRoot.appendChild(modalDiv);
};

// --- FUNCIONES PARA ELIMINAR CLIENTE ---
const showDeleteClientConfirmation = (clientId) => {
    if (!isAdmin()) {
        showMessageModal('Acceso denegado: Solo los administradores pueden eliminar clientes.');
        return;
    }
    showConfirmationModal(`¿Estás seguro de que quieres eliminar al cliente con RUC/C.I. ${clientId}? Esta acción es irreversible.`, () => deleteClient(clientId));
};

const deleteClient = async (clientId) => {
    if (!isAdmin()) {
        showMessageModal('Acceso denegado: Solo los administradores pueden eliminar clientes.');
        return;
    }
    try {
        await db.collection('clients').doc(clientId).delete();
        clients = clients.filter(c => c.id !== clientId); // Eliminar del array local
        showMessageModal('Cliente eliminado exitosamente.');
        render(); // Re-renderizar para actualizar la tabla
    } catch (error) {
        console.error('Error al eliminar cliente:', error);
        showMessageModal('Error al eliminar cliente. Por favor, revisa tu conexión y las reglas de seguridad.');
    }
};

// --- FUNCIONES PARA GESTIONAR ZONAS Y SECTORES ---
const openManageZonesSectorsModal = () => {
    if (!isAdmin()) {
        showMessageModal('Acceso denegado: Solo los administradores pueden gestionar zonas y sectores.');
        return;
    }
    showManageZonesSectorsModalState = true;
    editingZone = null; // Resetear edición de zona
    editingSector = null; // Resetear edición de sector
    render();
};

const closeManageZonesSectorsModal = () => {
    showManageZonesSectorsModalState = false;
    editingZone = null;
    editingSector = null;
    render();
};

const renderManageZonesSectorsModal = () => {
    if (!showManageZonesSectorsModalState) return;

    const modalDiv = document.createElement('div');
    modalDiv.id = 'manage-zones-sectors-modal';
    modalDiv.className = 'modal';
    modalDiv.innerHTML = `
        <div class="modal-content text-left">
            <h3 class="text-2xl font-bold mb-4 text-center text-indigo-700">Gestionar Zonas y Sectores</h3>

            <div class="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-300">
                <h4 class="text-xl font-bold mb-3 text-blue-700">Gestión de Zonas</h4>
                <div class="flex mb-3">
                    <input type="text" id="zoneNameInput" class="h-12 border border-gray-300 rounded-l-lg px-4 text-base flex-grow bg-white" placeholder="Nombre de la nueva zona" value="${editingZone ? editingZone.name : ''}">
                    ${editingZone ? `
                        <button class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-none transition duration-300 ease-in-out transform hover:scale-105" onclick="saveEditedZone()">Guardar</button>
                        <button class="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-r-lg transition duration-300 ease-in-out transform hover:scale-105" onclick="cancelEditZone()">Cancelar</button>
                    ` : `
                        <button class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-r-lg transition duration-300 ease-in-out transform hover:scale-105" onclick="addZone()">Añadir Zona</button>
                    `}
                </div>
                <div id="zones-list" class="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2"></div>
            </div>

            <div class="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-300">
                <h4 class="text-xl font-bold mb-3 text-blue-700">Gestión de Sectores</h4>
                <div class="flex mb-3">
                    <input type="text" id="sectorNameInput" class="h-12 border border-gray-300 rounded-l-lg px-4 text-base flex-grow bg-white" placeholder="Nombre del nuevo sector" value="${editingSector ? editingSector.name : ''}">
                    ${editingSector ? `
                        <button class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-none transition duration-300 ease-in-out transform hover:scale-105" onclick="saveEditedSector()">Guardar</button>
                        <button class="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-r-lg transition duration-300 ease-in-out transform hover:scale-105" onclick="cancelEditSector()">Cancelar</button>
                    ` : `
                        <button class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-r-lg transition duration-300 ease-in-out transform hover:scale-105" onclick="addSector()">Añadir Sector</button>
                    `}
                </div>
                <div id="sectors-list" class="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2"></div>
            </div>

            <button class="bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-5 rounded-lg mt-5 w-full shadow-md transition duration-300 ease-in-out transform hover:scale-105" onclick="closeManageZonesSectorsModal()">Cerrar</button>
        </div>
    `;
    appRoot.appendChild(modalDiv);

    updateZonesList();
    updateSectorsList();
};

const updateZonesList = () => {
    const zonesListDiv = document.getElementById('zones-list');
    if (!zonesListDiv) return;
    zonesListDiv.innerHTML = '';
    if (zonesData.length === 0) {
        zonesListDiv.innerHTML = '<p class="text-gray-500">No hay zonas registradas.</p>';
        return;
    }
    zonesData.forEach(zone => {
        const zoneItem = document.createElement('div');
        zoneItem.className = 'flex justify-between items-center bg-gray-50 p-2 rounded-md mb-1 border border-gray-200';
        zoneItem.innerHTML = `
            <span class="text-gray-800">${zone.name}</span>
            <div>
                <button class="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-1 px-2 rounded-md text-sm mr-2" onclick="editZone('${zone.name}')">Editar</button>
                <button class="bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-2 rounded-md text-sm" onclick="showDeleteZoneConfirmation('${zone.name}')">Eliminar</button>
            </div>
        `;
        zonesListDiv.appendChild(zoneItem);
    });
};

const updateSectorsList = () => {
    const sectorsListDiv = document.getElementById('sectors-list');
    if (!sectorsListDiv) return;
    sectorsListDiv.innerHTML = '';
    if (sectorsData.length === 0) {
        sectorsListDiv.innerHTML = '<p class="text-gray-500">No hay sectores registrados.</p>';
        return;
    }
    sectorsData.forEach(sector => {
        const sectorItem = document.createElement('div');
        sectorItem.className = 'flex justify-between items-center bg-gray-50 p-2 rounded-md mb-1 border border-gray-200';
        sectorItem.innerHTML = `
            <span class="text-gray-800">${sector.name}</span>
            <div>
                <button class="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-1 px-2 rounded-md text-sm mr-2" onclick="editSector('${sector.name}')">Editar</button>
                <button class="bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-2 rounded-md text-sm" onclick="showDeleteSectorConfirmation('${sector.name}')">Eliminar</button>
            </div>
        `;
        sectorsListDiv.appendChild(sectorItem);
    });
};

// --- CRUD ZONAS ---
const addZone = async () => {
    if (!isAdmin()) {
        showMessageModal('Acceso denegado: Solo los administradores pueden añadir zonas.');
        return;
    }
    const zoneName = document.getElementById('zoneNameInput').value.trim();
    if (!zoneName) {
        showMessageModal('Por favor, ingresa un nombre para la zona.');
        return;
    }
    if (zonesData.some(z => z.name.toLowerCase() === zoneName.toLowerCase())) {
        showMessageModal('Esta zona ya existe.');
        return;
    }
    try {
        await db.collection('zones').doc(zoneName).set({ name: zoneName });
        zonesData.push({ name: zoneName });
        zonesData.sort((a, b) => a.name.localeCompare(b.name)); // Mantener ordenado
        showMessageModal('Zona añadida exitosamente.');
        document.getElementById('zoneNameInput').value = ''; // Limpiar input
        render(); // Re-render para actualizar modal y selectores de cliente
    } catch (error) {
        console.error('Error al añadir zona:', error);
        showMessageModal('Error al añadir zona. Revisa tu conexión y reglas de seguridad.');
    }
};

const editZone = (zoneName) => {
    if (!isAdmin()) {
        showMessageModal('Acceso denegado: Solo los administradores pueden editar zonas.');
        return;
    }
    editingZone = { name: zoneName };
    render(); // Re-render para actualizar el input con el nombre a editar
};

const cancelEditZone = () => {
    editingZone = null;
    render(); // Re-render para limpiar el input y volver al modo añadir
};

const saveEditedZone = async () => {
    if (!isAdmin()) {
        showMessageModal('Acceso denegado: Solo los administradores pueden guardar zonas.');
        return;
    }
    if (!editingZone) return;

    const oldName = editingZone.name;
    const newName = document.getElementById('zoneNameInput').value.trim();

    if (!newName) {
        showMessageModal('El nombre de la zona no puede estar vacío.');
        return;
    }
    if (newName.toLowerCase() === oldName.toLowerCase()) {
        showMessageModal('No se realizaron cambios en el nombre de la zona.');
        cancelEditZone();
        return;
    }
    if (zonesData.some(z => z.name.toLowerCase() === newName.toLowerCase() && z.name.toLowerCase() !== oldName.toLowerCase())) {
        showMessageModal('Ya existe otra zona con este nuevo nombre.');
        return;
    }

    try {
        const batch = db.batch();

        // 1. Crear el nuevo documento de zona
        const newZoneRef = db.collection('zones').doc(newName);
        batch.set(newZoneRef, { name: newName });

        // 2. Eliminar el documento de zona antiguo
        const oldZoneRef = db.collection('zones').doc(oldName);
        batch.delete(oldZoneRef);

        // 3. Actualizar los clientes que tenían la zona antigua
        const clientsToUpdateSnapshot = await db.collection('clients').where('zona', '==', oldName).get();
        clientsToUpdateSnapshot.docs.forEach(doc => {
            const clientRef = db.collection('clients').doc(doc.id);
            batch.update(clientRef, { zona: newName });
        });

        await batch.commit();

        // Actualizar el estado local
        zonesData = zonesData.filter(z => z.name !== oldName);
        zonesData.push({ name: newName });
        zonesData.sort((a, b) => a.name.localeCompare(b.name));

        // Actualizar el array local de clientes para reflejar el cambio de zona
        clients = clients.map(c => c.zona === oldName ? { ...c, zona: newName } : c);

        showMessageModal('Zona actualizada exitosamente y clientes relacionados actualizados.');
        cancelEditZone(); // Limpiar el formulario de edición
        render(); // Re-render para actualizar modal y tabla de clientes
    } catch (error) {
        console.error('Error al guardar zona editada:', error);
        showMessageModal('Error al guardar zona. Revisa tu conexión y reglas de seguridad.');
    }
};

const showDeleteZoneConfirmation = (zoneName) => {
    if (!isAdmin()) {
        showMessageModal('Acceso denegado: Solo los administradores pueden eliminar zonas.');
        return;
    }
    showConfirmationModal(`¿Estás seguro de que quieres eliminar la zona "${zoneName}"? Los clientes asociados a esta zona perderán su asignación de zona.`, () => deleteZone(zoneName));
};

const deleteZone = async (zoneName) => {
    if (!isAdmin()) {
        showMessageModal('Acceso denegado: Solo los administradores pueden eliminar zonas.');
        return;
    }
    try {
        const batch = db.batch();

        // Eliminar el documento de zona
        const zoneRef = db.collection('zones').doc(zoneName);
        batch.delete(zoneRef);

        // Actualizar los clientes que tenían esta zona a un valor vacío
        const clientsToUpdateSnapshot = await db.collection('clients').where('zona', '==', zoneName).get();
        clientsToUpdateSnapshot.docs.forEach(doc => {
            const clientRef = db.collection('clients').doc(doc.id);
            batch.update(clientRef, { zona: '' }); // O null, dependiendo de cómo quieras manejarlo
        });

        await batch.commit();

        // Actualizar el estado local
        zonesData = zonesData.filter(z => z.name !== zoneName);
        clients = clients.map(c => c.zona === zoneName ? { ...c, zona: '' } : c); // Actualizar clientes locales

        showMessageModal('Zona eliminada exitosamente y clientes relacionados actualizados.');
        render(); // Re-render para actualizar modal y selectores de cliente
    } catch (error) {
        console.error('Error al eliminar zona:', error);
        showMessageModal('Error al eliminar zona. Revisa tu conexión y reglas de seguridad.');
    }
};

// --- CRUD SECTORES ---
const addSector = async () => {
    if (!isAdmin()) {
        showMessageModal('Acceso denegado: Solo los administradores pueden añadir sectores.');
        return;
    }
    const sectorName = document.getElementById('sectorNameInput').value.trim();
    if (!sectorName) {
        showMessageModal('Por favor, ingresa un nombre para el sector.');
        return;
    }
    if (sectorsData.some(s => s.name.toLowerCase() === sectorName.toLowerCase())) {
        showMessageModal('Este sector ya existe.');
        return;
    }
    try {
        await db.collection('sectors').doc(sectorName).set({ name: sectorName });
        sectorsData.push({ name: sectorName });
        sectorsData.sort((a, b) => a.name.localeCompare(b.name)); // Mantener ordenado
        showMessageModal('Sector añadido exitosamente.');
        document.getElementById('sectorNameInput').value = ''; // Limpiar input
        render(); // Re-render para actualizar modal y selectores de cliente
    } catch (error) {
        console.error('Error al añadir sector:', error);
        showMessageModal('Error al añadir sector. Revisa tu conexión y reglas de seguridad.');
    }
};

const editSector = (sectorName) => {
    if (!isAdmin()) {
        showMessageModal('Acceso denegado: Solo los administradores pueden editar sectores.');
        return;
    }
    editingSector = { name: sectorName };
    render(); // Re-render para actualizar el input con el nombre a editar
};

const cancelEditSector = () => {
    editingSector = null;
    render(); // Re-render para limpiar el input y volver al modo añadir
};

const saveEditedSector = async () => {
    if (!isAdmin()) {
        showMessageModal('Acceso denegado: Solo los administradores pueden guardar sectores.');
        return;
    }
    if (!editingSector) return;

    const oldName = editingSector.name;
    const newName = document.getElementById('sectorNameInput').value.trim();

    if (!newName) {
        showMessageModal('El nombre del sector no puede estar vacío.');
        return;
    }
    if (newName.toLowerCase() === oldName.toLowerCase()) {
        showMessageModal('No se realizaron cambios en el nombre del sector.');
        cancelEditSector();
        return;
    }
    if (sectorsData.some(s => s.name.toLowerCase() === newName.toLowerCase() && s.name.toLowerCase() !== oldName.toLowerCase())) {
        showMessageModal('Ya existe otro sector con este nuevo nombre.');
        return;
    }

    try {
        const batch = db.batch();

        // 1. Crear el nuevo documento de sector
        const newSectorRef = db.collection('sectors').doc(newName);
        batch.set(newSectorRef, { name: newName });

        // 2. Eliminar el documento de sector antiguo
        const oldSectorRef = db.collection('sectors').doc(oldName);
        batch.delete(oldSectorRef);

        // 3. Actualizar los clientes que tenían el sector antiguo
        const clientsToUpdateSnapshot = await db.collection('clients').where('sector', '==', oldName).get();
        clientsToUpdateSnapshot.docs.forEach(doc => {
            const clientRef = db.collection('clients').doc(doc.id);
            batch.update(clientRef, { sector: newName });
        });

        await batch.commit();

        // Actualizar el estado local
        sectorsData = sectorsData.filter(s => s.name !== oldName);
        sectorsData.push({ name: newName });
        sectorsData.sort((a, b) => a.name.localeCompare(b.name));

        // Actualizar el array local de clientes para reflejar el cambio de sector
        clients = clients.map(c => c.sector === oldName ? { ...c, sector: newName } : c);

        showMessageModal('Sector actualizado exitosamente y clientes relacionados actualizados.');
        cancelEditSector(); // Limpiar el formulario de edición
        render(); // Re-render para actualizar modal y tabla de clientes
    } catch (error) {
        console.error('Error al guardar sector editado:', error);
        showMessageModal('Error al guardar sector. Revisa tu conexión y reglas de seguridad.');
    }
};

const showDeleteSectorConfirmation = (sectorName) => {
    if (!isAdmin()) {
        showMessageModal('Acceso denegado: Solo los administradores pueden eliminar sectores.');
        return;
    }
    showConfirmationModal(`¿Estás seguro de que quieres eliminar el sector "${sectorName}"? Los clientes asociados a este sector perderán su asignación de sector.`, () => deleteSector(sectorName));
};

const deleteSector = async (sectorName) => {
    if (!isAdmin()) {
        showMessageModal('Acceso denegado: Solo los administradores pueden eliminar sectores.');
        return;
    }
    try {
        const batch = db.batch();

        // Eliminar el documento de sector
        const sectorRef = db.collection('sectors').doc(sectorName);
        batch.delete(sectorRef);

        // Actualizar los clientes que tenían este sector a un valor vacío
        const clientsToUpdateSnapshot = await db.collection('clients').where('sector', '==', sectorName).get();
        clientsToUpdateSnapshot.docs.forEach(doc => {
            const clientRef = db.collection('clients').doc(doc.id);
            batch.update(clientRef, { sector: '' }); // O null, dependiendo de cómo quieras manejarlo
        });

        await batch.commit();

        // Actualizar el estado local
        sectorsData = sectorsData.filter(s => s.name !== sectorName);
        clients = clients.map(c => c.sector === sectorName ? { ...c, sector: '' } : c); // Actualizar clientes locales

        showMessageModal('Sector eliminado exitosamente y clientes relacionados actualizados.');
        render(); // Re-render para actualizar modal y selectores de cliente
    } catch (error) {
        console.error('Error al eliminar sector:', error);
        showMessageModal('Error al eliminar sector. Revisa tu conexión y reglas de seguridad.');
    }
};

// --- Funciones de Carga/Descarga de Clientes CSV ---
const handleClientFileUpload = async (event, type) => {
    if (!isAdmin()) {
        showMessageModal('Acceso denegado: Solo los administradores pueden cargar archivos CSV de clientes.');
        return;
    }
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        const csvContent = e.target.result;
        const parsedData = parseCSV(csvContent); // parseCSV es global desde index.html

        try {
            if (type === 'clients') {
                const existingClientsSnapshot = await db.collection('clients').get();
                // Eliminar clientes existentes
                for (const doc of existingClientsSnapshot.docs) {
                    await db.collection('clients').doc(doc.id).delete();
                }

                const newClients = parsedData.map(row => ({
                    id: row['RUC/CI'] || row.id,
                    nombreComercial: row['Nombre Comercial'] || row.nombreComercial,
                    nombrePersonal: row['Nombre Personal'] || row.nombrePersonal,
                    tlf: row['Teléfono'] || row.tlf,
                    direccion: row['Dirección'] || row.direccion || '',
                    zona: row['Zona'] || row.zona || '',
                    sector: row['Sector'] || row.sector || '',
                    tipoCliente: row['Tipo'] || row.tipoCliente || 'Persona Natural',
                    observaciones: row['Observaciones'] || row.observaciones || '',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp() // Añadir timestamp de creación
                }));

                // Añadir nuevos clientes
                for (const client of newClients) {
                    await db.collection('clients').doc(client.id).set(client);
                }
                clients = newClients; // Actualizar el array global de clientes
                showMessageModal('clientes.csv cargado y guardado exitosamente en Firestore.');
            }
            render(); // Re-renderizar la UI
        } catch (error) {
            console.error('Error al cargar archivo CSV de clientes a Firestore:', error);
            showMessageModal('Error al cargar archivo de clientes. Por favor, revisa tu conexión y las reglas de seguridad de Firestore.');
        }
    };
    reader.readAsText(file);
};

const downloadClientData = (dataType) => {
    if (!isAdmin()) {
        showMessageModal('Acceso denegado: Solo los administradores pueden descargar archivos CSV de clientes.');
        return;
    }
    let dataToDownload = [];
    let filename = '';
    let headers = [];

    if (dataType === 'clients') {
        dataToDownload = clients.map(c => ({
            'RUC/CI': c.id,
            'Nombre Comercial': c.nombreComercial,
            'Nombre Personal': c.nombrePersonal,
            'Teléfono': c.tlf,
            'Dirección': c.direccion,
            'Zona': c.zona,
            'Sector': c.sector,
            'Tipo': c.tipoCliente,
            'Observaciones': c.observaciones
        }));
        filename = 'clientes.csv';
        headers = ['RUC/CI', 'Nombre Comercial', 'Nombre Personal', 'Teléfono', 'Dirección', 'Zona', 'Sector', 'Tipo', 'Observaciones'];
    }

    if (dataToDownload.length > 0) {
        const csvContent = toCSV(dataToDownload, headers); // toCSV es global desde index.html
        downloadCSV(filename); // downloadCSV es global desde index.html
    } else {
        showMessageModal(`No hay datos para descargar en ${dataType}.`);
    }
};

// Se asegura de que las funciones necesarias sean globales para que index.html pueda llamarlas.
// Esto es importante porque clients.js se carga como un script normal, no un módulo.
window.renderClientsScreenExternal = renderClientsScreenExternal;
window.filterClientsForClientesScreen = filterClientsForClientesScreen;
window.updateClientTableForClientesScreen = updateClientTableForClientesScreen;
window.toggleAddClientForm = toggleAddClientForm;
window.handleAddClient = handleAddClient;
window.openEditClientModal = openEditClientModal;
window.closeEditClientModal = closeEditClientModal;
window.handleEditClientChange = handleEditClientChange;
window.saveEditedClient = saveEditedClient;
window.renderEditClientModal = renderEditClientModal;
window.showDeleteClientConfirmation = showDeleteClientConfirmation;
window.deleteClient = deleteClient;
window.openManageZonesSectorsModal = openManageZonesSectorsModal;
window.closeManageZonesSectorsModal = closeManageZonesSectorsModal;
window.renderManageZonesSectorsModal = renderManageZonesSectorsModal;
window.updateZonesList = updateZonesList;
window.updateSectorsList = updateSectorsList;
window.addZone = addZone;
window.editZone = editZone;
window.cancelEditZone = cancelEditZone;
window.saveEditedZone = saveEditedZone;
window.showDeleteZoneConfirmation = showDeleteZoneConfirmation;
window.deleteZone = deleteZone;
window.addSector = addSector;
window.editSector = editSector;
window.cancelEditSector = cancelEditSector;
window.saveEditedSector = saveEditedSector;
window.showDeleteSectorConfirmation = showDeleteSectorConfirmation;
window.deleteSector = deleteSector;
window.handleClientFileUpload = handleClientFileUpload;
window.downloadClientData = downloadClientData;

// Opcional: Si necesitas que las variables de estado sean accesibles directamente desde index.html
// para depuración o interacciones complejas, puedes exponerlas, pero generalmente no es necesario
// si las funciones se encargan de la interacción.
// window.newClient = newClient;
// window.clientSearchTermClientes = clientSearchTermClientes;
// ... y así sucesivamente para otras variables de estado si fuera estrictamente necesario.
