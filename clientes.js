// --- Lógica del módulo de Clientes ---

(function() {
    // Variables locales del módulo que se inicializarán desde index.html
    let _db, _userId, _appId, _mainContent, _floatingControls, _activeListeners;
    let _showMainMenu, _showModal, _showAddItemModal, _populateDropdown;
    let _collection, _onSnapshot, _doc, _addDoc, _setDoc, _deleteDoc, _getDocs;
    
    let _clientesCache = []; // Caché local para búsquedas y ediciones rápidas

    /**
     * Inicializa el módulo con las dependencias necesarias desde la app principal.
     */
    window.initClientes = function(dependencies) {
        _db = dependencies.db;
        _userId = dependencies.userId;
        _appId = dependencies.appId;
        _mainContent = dependencies.mainContent;
        _floatingControls = dependencies.floatingControls;
        _activeListeners = dependencies.activeListeners;
        _showMainMenu = dependencies.showMainMenu;
        _showModal = dependencies.showModal;
        _showAddItemModal = dependencies.showAddItemModal;
        _populateDropdown = dependencies.populateDropdown;
        _collection = dependencies.collection;
        _onSnapshot = dependencies.onSnapshot;
        _doc = dependencies.doc;
        _getDoc = dependencies.getDoc;
        _addDoc = dependencies.addDoc;
        _setDoc = dependencies.setDoc;
        _deleteDoc = dependencies.deleteDoc;
    };

    /**
     * Renderiza el menú de subopciones de clientes.
     */
    window.showClientesSubMenu = function() {
         _floatingControls.classList.add('hidden');
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl text-center">
                        <h1 class="text-3xl font-bold text-gray-800 mb-6">Gestión de Clientes</h1>
                        <div class="space-y-4">
                            <button id="verClientesBtn" class="w-full px-6 py-3 bg-indigo-500 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-600 transition duration-300 transform hover:scale-105">
                                Ver Clientes
                            </button>
                            <button id="agregarClienteBtn" class="w-full px-6 py-3 bg-indigo-500 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-600 transition duration-300 transform hover:scale-105">
                                Agregar Cliente
                            </button>
                            <button id="modifyDeleteClienteBtn" class="w-full px-6 py-3 bg-indigo-500 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-600 transition duration-300 transform hover:scale-105">
                                Modificar / Eliminar Cliente
                            </button>
                            <button id="backToMenuBtn" class="w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500 transition duration-300 transform hover:scale-105">
                                Volver al Menú Principal
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('verClientesBtn').addEventListener('click', showVerClientesView);
        document.getElementById('agregarClienteBtn').addEventListener('click', showAgregarClienteView);
        document.getElementById('modifyDeleteClienteBtn').addEventListener('click', showModifyDeleteClienteView);
        document.getElementById('backToMenuBtn').addEventListener('click', _showMainMenu);
    }

    /**
     * Muestra la vista de agregar cliente.
     */
    function showAgregarClienteView() {
         _floatingControls.classList.add('hidden');
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl text-center">
                        <h2 class="text-2xl font-bold text-gray-800 mb-6">Agregar Cliente</h2>
                        <form id="clienteForm" class="space-y-4 text-left">
                            <div>
                                <label for="sector" class="block text-gray-700 font-medium mb-2">Sector:</label>
                                <div class="flex items-center space-x-2">
                                    <select id="sector" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required></select>
                                    <button type="button" id="addSectorBtn" class="px-4 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500">Agregar</button>
                                </div>
                            </div>
                            <div>
                                <label for="nombreComercial" class="block text-gray-700 font-medium mb-2">Nombre Comercial:</label>
                                <input type="text" id="nombreComercial" class="w-full px-4 py-2 border rounded-lg" required>
                            </div>
                            <div>
                                <label for="nombrePersonal" class="block text-gray-700 font-medium mb-2">Nombre Personal:</label>
                                <input type="text" id="nombrePersonal" class="w-full px-4 py-2 border rounded-lg" required>
                            </div>
                            <div>
                                <label for="telefono" class="block text-gray-700 font-medium mb-2">Teléfono:</label>
                                <input type="tel" id="telefono" class="w-full px-4 py-2 border rounded-lg" required>
                            </div>
                            <div>
                                <label for="codigoCEP" class="block text-gray-700 font-medium mb-2">Código CEP:</label>
                                <input type="text" id="codigoCEP" class="w-full px-4 py-2 border rounded-lg" required>
                            </div>
                            <button type="submit" class="w-full px-6 py-3 bg-green-500 text-white font-semibold rounded-lg shadow-md hover:bg-green-600">Guardar Cliente</button>
                        </form>
                        <button id="backToClientesBtn" class="mt-4 w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver</button>
                    </div>
                </div>
            </div>
        `;
        _populateDropdown('sectores', 'sector', 'sector');
        document.getElementById('clienteForm').addEventListener('submit', agregarCliente);
        document.getElementById('backToClientesBtn').addEventListener('click', showClientesSubMenu);
        document.getElementById('addSectorBtn').addEventListener('click', () => _showAddItemModal('sectores', 'Sector'));
    }

    /**
     * Agrega un nuevo cliente a la base de datos.
     */
    async function agregarCliente(e) {
        e.preventDefault();
        const clienteData = {
            sector: document.getElementById('sector').value,
            nombreComercial: document.getElementById('nombreComercial').value,
            nombrePersonal: document.getElementById('nombrePersonal').value,
            telefono: document.getElementById('telefono').value,
            codigoCEP: document.getElementById('codigoCEP').value
        };
        try {
            await _addDoc(_collection(_db, `artifacts/${_appId}/users/${_userId}/clientes`), clienteData);
            _showModal('Éxito', 'Cliente agregado correctamente.');
            e.target.reset();
        } catch (error) {
            console.error("Error al agregar cliente:", error);
            _showModal('Error', 'Hubo un error al guardar el cliente.');
        }
    }

    /**
     * Muestra la vista de "Ver Clientes".
     */
    function showVerClientesView() {
         _floatingControls.classList.add('hidden');
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl">
                        <h2 class="text-2xl font-bold text-gray-800 mb-6 text-center">Ver Clientes</h2>
                        <div id="clientesListContainer" class="overflow-x-auto">
                            <p class="text-gray-500 text-center">Cargando clientes...</p>
                        </div>
                        <button id="backToClientesBtn" class="mt-6 w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver</button>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('backToClientesBtn').addEventListener('click', showClientesSubMenu);
        renderClientesList('clientesListContainer', true);
    }

    /**
     * Muestra la vista para modificar o eliminar un cliente.
     */
    function showModifyDeleteClienteView() {
         _floatingControls.classList.add('hidden');
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl">
                        <h2 class="text-2xl font-bold text-gray-800 mb-6 text-center">Modificar / Eliminar Cliente</h2>
                        <p class="text-gray-600 mb-4 text-center">Selecciona un cliente de la lista para modificarlo o eliminarlo.</p>
                        <div id="clientesListContainer" class="overflow-x-auto">
                            <p class="text-gray-500 text-center">Cargando clientes...</p>
                        </div>
                        <button id="backToClientesBtn" class="mt-6 w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver</button>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('backToClientesBtn').addEventListener('click', showClientesSubMenu);
        renderClientesList('clientesListContainer');
    }

    /**
     * Renderiza la lista de clientes en una tabla.
     */
    function renderClientesList(elementId = 'clientesListContainer', readOnly = false) {
        const container = document.getElementById(elementId);
        if (!container) return;

        const clientesRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/clientes`);
        const unsubscribe = _onSnapshot(clientesRef, (snapshot) => {
            _clientesCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            if (_clientesCache.length === 0) {
                container.innerHTML = `<p class="text-gray-500 text-center">No hay clientes registrados.</p>`;
                return;
            }

            let tableHTML = `
                <table class="min-w-full bg-white border border-gray-200">
                    <thead class="bg-gray-200">
                        <tr>
                            <th class="py-2 px-4 border-b text-left text-sm">N. Comercial</th>
                            <th class="py-2 px-4 border-b text-left text-sm">N. Personal</th>
                            <th class="py-2 px-4 border-b text-left text-sm">Sector</th>
                            <th class="py-2 px-4 border-b text-left text-sm">Teléfono</th>
                            <th class="py-2 px-4 border-b text-left text-sm">Código CEP</th>
                            ${!readOnly ? `<th class="py-2 px-4 border-b text-center text-sm">Acciones</th>` : ''}
                        </tr>
                    </thead>
                    <tbody>
            `;
            _clientesCache.forEach(cliente => {
                tableHTML += `
                    <tr class="hover:bg-gray-50">
                        <td class="py-2 px-4 border-b text-sm">${cliente.nombreComercial}</td>
                        <td class="py-2 px-4 border-b text-sm">${cliente.nombrePersonal}</td>
                        <td class="py-2 px-4 border-b text-sm">${cliente.sector}</td>
                        <td class="py-2 px-4 border-b text-sm">${cliente.telefono}</td>
                        <td class="py-2 px-4 border-b text-sm">${cliente.codigoCEP || 'N/A'}</td>
                        ${!readOnly ? `
                        <td class="py-2 px-4 border-b text-center space-x-2">
                            <button onclick="window.clientesModule.editCliente('${cliente.id}')" class="px-3 py-1 bg-yellow-500 text-white text-xs rounded-lg hover:bg-yellow-600">Editar</button>
                            <button onclick="window.clientesModule.deleteCliente('${cliente.id}')" class="px-3 py-1 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600">Eliminar</button>
                        </td>
                        ` : ''}
                    </tr>
                `;
            });
            tableHTML += `</tbody></table>`;
            container.innerHTML = tableHTML;
        });
        _activeListeners.push(unsubscribe);
    }
    
    /**
     * Muestra el formulario para editar un cliente.
     */
    function editCliente(clienteId) {
        _floatingControls.classList.add('hidden');
        const cliente = _clientesCache.find(c => c.id === clienteId);
        if (!cliente) return;

        _mainContent.innerHTML = `
            <div class="p-4">
                <div class="container mx-auto">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl text-center">
                        <h2 class="text-2xl font-bold text-gray-800 mb-6">Editar Cliente</h2>
                        <form id="editClienteForm" class="space-y-4 text-left">
                            <div>
                                <label for="editSector" class="block text-gray-700 font-medium mb-2">Sector:</label>
                                <select id="editSector" class="w-full px-4 py-2 border rounded-lg" required>
                                    <option value="${cliente.sector}">${cliente.sector}</option>
                                </select>
                            </div>
                            <div>
                                <label for="editNombreComercial" class="block text-gray-700 font-medium mb-2">Nombre Comercial:</label>
                                <input type="text" id="editNombreComercial" value="${cliente.nombreComercial}" class="w-full px-4 py-2 border rounded-lg" required>
                            </div>
                            <div>
                                <label for="editNombrePersonal" class="block text-gray-700 font-medium mb-2">Nombre Personal:</label>
                                <input type="text" id="editNombrePersonal" value="${cliente.nombrePersonal}" class="w-full px-4 py-2 border rounded-lg" required>
                            </div>
                            <div>
                                <label for="editTelefono" class="block text-gray-700 font-medium mb-2">Teléfono:</label>
                                <input type="tel" id="editTelefono" value="${cliente.telefono}" class="w-full px-4 py-2 border rounded-lg" required>
                            </div>
                            <div>
                                <label for="editCodigoCEP" class="block text-gray-700 font-medium mb-2">Código CEP:</label>
                                <input type="text" id="editCodigoCEP" value="${cliente.codigoCEP || ''}" class="w-full px-4 py-2 border rounded-lg" required>
                            </div>
                            <button type="submit" class="w-full px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg shadow-md hover:bg-blue-600">Guardar Cambios</button>
                        </form>
                        <button id="backToModifyDeleteClienteBtn" class="mt-4 w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver</button>
                    </div>
                </div>
            </div>
        `;
        _populateDropdown('sectores', 'editSector', 'sector');

        document.getElementById('editClienteForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const updatedData = {
                sector: document.getElementById('editSector').value,
                nombreComercial: document.getElementById('editNombreComercial').value,
                nombrePersonal: document.getElementById('editNombrePersonal').value,
                telefono: document.getElementById('editTelefono').value,
                codigoCEP: document.getElementById('editCodigoCEP').value
            };
            try {
                await _setDoc(_doc(_db, `artifacts/${_appId}/users/${_userId}/clientes`, clienteId), updatedData, { merge: true });
                _showModal('Éxito', 'Cliente modificado exitosamente.');
                showModifyDeleteClienteView();
            } catch (error) {
                console.error("Error al modificar el cliente:", error);
                _showModal('Error', 'Hubo un error al modificar el cliente.');
            }
        });
        document.getElementById('backToModifyDeleteClienteBtn').addEventListener('click', showModifyDeleteClienteView);
    };

    /**
     * Elimina un cliente.
     */
    function deleteCliente(clienteId) {
        _showModal('Confirmar Eliminación', '¿Estás seguro de que deseas eliminar este cliente?', async () => {
            try {
                await _deleteDoc(_doc(_db, `artifacts/${_appId}/users/${_userId}/clientes`, clienteId));
                _showModal('Éxito', 'Cliente eliminado correctamente.');
            } catch (error) {
                console.error("Error al eliminar el cliente:", error);
                _showModal('Error', 'Hubo un error al eliminar el cliente.');
            }
        });
    };

    // Exponer funciones públicas al objeto window
    window.clientesModule = {
        editCliente,
        deleteCliente
    };

})();
