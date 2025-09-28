// --- Lógica del módulo de Clientes ---

(function() {
    // Variables locales del módulo que se inicializarán desde index.html
    let _db, _userId, _appId, _mainContent, _floatingControls, _activeListeners;
    let _showMainMenu, _showModal, _showAddItemModal, _populateDropdown;
    let _collection, _onSnapshot, _doc, _addDoc, _setDoc, _deleteDoc, _getDoc, _getDocs, _query, _where, _writeBatch;
    
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
        _getDocs = dependencies.getDocs;
        _query = dependencies.query;
        _where = dependencies.where;
        _writeBatch = dependencies.writeBatch;
        
        const clientesRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/clientes`);
        _onSnapshot(clientesRef, (snapshot) => {
            _clientesCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        });
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
                            <button id="verClientesBtn" class="w-full px-6 py-3 bg-indigo-500 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-600">Ver Clientes</button>
                            <button id="agregarClienteBtn" class="w-full px-6 py-3 bg-indigo-500 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-600">Agregar Cliente</button>
                            <button id="modifyDeleteClienteBtn" class="w-full px-6 py-3 bg-indigo-500 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-600">Modificar / Eliminar Cliente</button>
                            <button id="datosMaestrosSectoresBtn" class="w-full px-6 py-3 bg-yellow-500 text-gray-800 font-semibold rounded-lg shadow-md hover:bg-yellow-600">Datos Maestros (Sectores)</button>
                            <button id="deleteAllClientesBtn" class="w-full px-6 py-3 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700">Eliminar Todos los Clientes</button>
                            <button id="backToMenuBtn" class="w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver al Menú Principal</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('verClientesBtn').addEventListener('click', showVerClientesView);
        document.getElementById('agregarClienteBtn').addEventListener('click', showAgregarClienteView);
        document.getElementById('modifyDeleteClienteBtn').addEventListener('click', showModifyDeleteSearchView);
        document.getElementById('datosMaestrosSectoresBtn').addEventListener('click', showDatosMaestrosSectoresView);
        document.getElementById('deleteAllClientesBtn').addEventListener('click', handleDeleteAllClientes);
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
                                <div class="flex items-center">
                                    <input type="text" id="codigoCEP" class="w-full px-4 py-2 border rounded-lg">
                                    <input type="checkbox" id="cepNA" class="ml-4 h-5 w-5">
                                    <label for="cepNA" class="ml-2 text-gray-700">No Aplica</label>
                                </div>
                            </div>
                            <button type="submit" class="w-full px-6 py-3 bg-green-500 text-white font-semibold rounded-lg shadow-md hover:bg-green-600">Guardar Cliente</button>
                        </form>
                        <button id="backToClientesBtn" class="mt-4 w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver</button>
                    </div>
                </div>
            </div>
        `;
        _populateDropdown('sectores', 'sector', 'sector');

        const cepInput = document.getElementById('codigoCEP');
        const cepNACheckbox = document.getElementById('cepNA');
        cepNACheckbox.addEventListener('change', () => {
            if (cepNACheckbox.checked) {
                cepInput.value = 'N/A';
                cepInput.disabled = true;
            } else {
                cepInput.value = '';
                cepInput.disabled = false;
                cepInput.focus();
            }
        });

        document.getElementById('clienteForm').addEventListener('submit', agregarCliente);
        document.getElementById('backToClientesBtn').addEventListener('click', showClientesSubMenu);
        document.getElementById('addSectorBtn').addEventListener('click', () => showValidatedAddItemModal('sectores', 'Sector'));
    }

    /**
     * Agrega un nuevo cliente a la base de datos, con validación de duplicados y convirtiendo a mayúsculas.
     */
    async function agregarCliente(e) {
        e.preventDefault();
        const form = e.target;
        
        const nombreComercial = form.nombreComercial.value.trim().toUpperCase();
        const nombrePersonal = form.nombrePersonal.value.trim().toUpperCase();
        const sector = form.sector.value.toUpperCase();
        const telefono = form.telefono.value.trim();
        const codigoCEP = form.codigoCEP.value.trim();

        const normComercial = nombreComercial.toLowerCase();
        const normPersonal = nombrePersonal.toLowerCase();

        let duplicado = null;
        let motivo = "";

        for (const c of _clientesCache) {
            if (c.nombreComercial.toLowerCase() === normComercial) {
                duplicado = c;
                motivo = "nombre comercial";
                break;
            }
            if (c.nombrePersonal.toLowerCase() === normPersonal) {
                duplicado = c;
                motivo = "nombre personal";
                break;
            }
            if (c.telefono === telefono) {
                duplicado = c;
                motivo = "teléfono";
                break;
            }
            if (codigoCEP && codigoCEP.toLowerCase() !== 'n/a' && c.codigoCEP === codigoCEP) {
                duplicado = c;
                motivo = "código CEP";
                break;
            }
        }

        const guardar = async () => {
            const clienteData = {
                sector: sector,
                nombreComercial: nombreComercial,
                nombrePersonal: nombrePersonal,
                telefono: telefono,
                codigoCEP: codigoCEP
            };
            try {
                await _addDoc(_collection(_db, `artifacts/${_appId}/users/${_userId}/clientes`), clienteData);
                _showModal('Éxito', 'Cliente agregado correctamente.');
                form.reset();
                const cepNACheckbox = document.getElementById('cepNA');
                if (cepNACheckbox) {
                    cepNACheckbox.checked = false;
                    document.getElementById('codigoCEP').disabled = false;
                }
            } catch (error) {
                console.error("Error al agregar cliente:", error);
                _showModal('Error', 'Hubo un error al guardar el cliente.');
            }
        };

        if (duplicado) {
            _showModal(
                'Posible Duplicado',
                `Ya existe un cliente con el mismo ${motivo}: "${duplicado.nombreComercial}". ¿Deseas agregarlo de todas formas?`,
                guardar,
                'Sí, agregar'
            );
        } else {
            await guardar();
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
                        <h2 class="text-2xl font-bold text-gray-800 mb-6 text-center">Lista de Clientes</h2>
                        ${getFiltrosHTML()}
                        <div id="clientesListContainer" class="overflow-x-auto max-h-96">
                            <p class="text-gray-500 text-center">Cargando clientes...</p>
                        </div>
                        <button id="backToClientesBtn" class="mt-6 w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver</button>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('backToClientesBtn').addEventListener('click', showClientesSubMenu);
        setupFiltros('clientesListContainer');
        renderClientesList('clientesListContainer');
    }

    /**
     * Muestra la interfaz de búsqueda para modificar o eliminar un cliente.
     */
    function showModifyDeleteSearchView() {
        _floatingControls.classList.add('hidden');
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl">
                        <h2 class="text-2xl font-bold text-gray-800 mb-6 text-center">Modificar / Eliminar Cliente</h2>
                        <div class="mb-6">
                            <input type="text" id="search-modify-input" placeholder="Buscar cliente por Nombre o Código..." class="w-full px-4 py-2 border rounded-lg">
                        </div>
                        <div id="clientes-results-container" class="overflow-x-auto max-h-96">
                            <p class="text-gray-500 text-center">Escribe en el campo superior para buscar un cliente.</p>
                        </div>
                        <button id="backToClientesBtn" class="mt-6 w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver</button>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('backToClientesBtn').addEventListener('click', showClientesSubMenu);
        document.getElementById('search-modify-input').addEventListener('input', (e) => {
            const searchTerm = e.target.value;
            if (searchTerm.length > 1) {
                renderClientesList('clientes-results-container', false, searchTerm);
            } else {
                document.getElementById('clientes-results-container').innerHTML = '<p class="text-gray-500 text-center">Escribe al menos 2 caracteres para buscar.</p>';
            }
        });
    }

    /**
     * Genera el HTML para los controles de filtro y búsqueda.
     */
    function getFiltrosHTML() {
        return `
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 border rounded-lg">
                <input type="text" id="search-input" placeholder="Buscar por Nombre o Código..." class="md:col-span-3 w-full px-4 py-2 border rounded-lg">
                <div>
                    <label for="filter-sector" class="text-sm font-medium">Sector</label>
                    <select id="filter-sector" class="w-full px-2 py-1 border rounded-lg text-sm"><option value="">Todos</option></select>
                </div>
                <div class="md:col-start-3">
                    <button id="clear-filters-btn" class="w-full bg-gray-300 text-sm font-semibold rounded-lg self-end py-2 px-4 mt-5">Limpiar Filtros</button>
                </div>
            </div>
        `;
    }

    /**
     * Configura los event listeners para los filtros.
     */
    function setupFiltros(containerId) {
        _populateDropdown('sectores', 'filter-sector', 'Sector');

        const searchInput = document.getElementById('search-input');
        const sectorFilter = document.getElementById('filter-sector');
        const clearBtn = document.getElementById('clear-filters-btn');

        const applyFilters = () => renderClientesList(containerId);

        searchInput.addEventListener('input', applyFilters);
        sectorFilter.addEventListener('change', applyFilters);
        
        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            sectorFilter.value = '';
            applyFilters();
        });
    }

    /**
     * Renderiza la lista de clientes en una tabla.
     */
    function renderClientesList(elementId, readOnly = false, externalSearchTerm = null) {
        const container = document.getElementById(elementId);
        if (!container) return;

        if (_clientesCache.length === 0) {
            container.innerHTML = `<p class="text-gray-500 text-center">Cargando clientes...</p>`;
            return;
        }

        const searchTerm = externalSearchTerm !== null ? externalSearchTerm.toLowerCase() : (document.getElementById('search-input')?.value.toLowerCase() || '');
        const sectorFilter = document.getElementById('filter-sector')?.value || '';

        const filteredClients = _clientesCache.filter(cliente => {
            const searchMatch = !searchTerm ||
                cliente.nombreComercial.toLowerCase().includes(searchTerm) ||
                cliente.nombrePersonal.toLowerCase().includes(searchTerm) ||
                (cliente.codigoCEP && cliente.codigoCEP.toLowerCase().includes(searchTerm));
            
            const sectorMatch = !sectorFilter || cliente.sector === sectorFilter;
            
            return searchMatch && sectorMatch;
        });
        
        if (filteredClients.length === 0) {
            container.innerHTML = `<p class="text-gray-500 text-center">No hay clientes que coincidan con la búsqueda.</p>`;
            return;
        }

        let tableHTML = `
            <table class="min-w-full bg-white border border-gray-200">
                <thead class="bg-gray-200 sticky top-0">
                    <tr>
                        <th class="py-2 px-4 border-b text-left text-sm">N. Comercial</th>
                        <th class="py-2 px-4 border-b text-left text-sm">N. Personal</th>
                        ${readOnly ? '<th class="py-2 px-4 border-b text-left text-sm">Sector</th>' : ''}
                        <th class="py-2 px-4 border-b text-left text-sm">Teléfono</th>
                        ${readOnly ? '<th class="py-2 px-4 border-b text-left text-sm">Código CEP</th>' : ''}
                        ${!readOnly ? `<th class="py-2 px-4 border-b text-center text-sm">Acciones</th>` : ''}
                    </tr>
                </thead>
                <tbody>
        `;
        filteredClients.forEach(cliente => {
            tableHTML += `
                <tr class="hover:bg-gray-50">
                    <td class="py-2 px-4 border-b text-sm">${cliente.nombreComercial}</td>
                    <td class="py-2 px-4 border-b text-sm">${cliente.nombrePersonal}</td>
                    ${readOnly ? `<td class="py-2 px-4 border-b text-sm">${cliente.sector}</td>` : ''}
                    <td class="py-2 px-4 border-b text-sm">${cliente.telefono}</td>
                    ${readOnly ? `<td class="py-2 px-4 border-b text-sm">${cliente.codigoCEP || 'N/A'}</td>` : ''}
                    ${!readOnly ? `
                    <td class="py-2 px-4 border-b text-center space-x-2">
                        <button onclick="window.clientesModule.editCliente('${cliente.id}')" class="px-3 py-1 bg-yellow-500 text-white text-xs rounded-lg hover:bg-yellow-600">Editar</button>
                        <button onclick="window.clientesModule.deleteCliente('${cliente.id}')" class="px-3 py-1 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600">Eliminar</button>
                    </td>` : ''}
                </tr>
            `;
        });
        tableHTML += `</tbody></table>`;
        container.innerHTML = tableHTML;
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
                                <div class="flex items-center">
                                    <input type="text" id="editCodigoCEP" value="${cliente.codigoCEP || ''}" class="w-full px-4 py-2 border rounded-lg">
                                    <input type="checkbox" id="editCepNA" class="ml-4 h-5 w-5">
                                    <label for="editCepNA" class="ml-2 text-gray-700">No Aplica</label>
                                </div>
                            </div>
                            <button type="submit" class="w-full px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg shadow-md hover:bg-blue-600">Guardar Cambios</button>
                        </form>
                        <button id="backToModifyDeleteClienteBtn" class="mt-4 w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver</button>
                    </div>
                </div>
            </div>
        `;
        _populateDropdown('sectores', 'editSector', 'sector', cliente.sector);

        const editCepInput = document.getElementById('editCodigoCEP');
        const editCepNACheckbox = document.getElementById('editCepNA');
        
        const syncEditCepState = () => {
            if (editCepInput.value.toLowerCase() === 'n/a') {
                editCepNACheckbox.checked = true;
                editCepInput.disabled = true;
            } else {
                editCepNACheckbox.checked = false;
                editCepInput.disabled = false;
            }
        };

        editCepNACheckbox.addEventListener('change', () => {
            if (editCepNACheckbox.checked) {
                editCepInput.value = 'N/A';
                editCepInput.disabled = true;
            } else {
                editCepInput.value = '';
                editCepInput.disabled = false;
                editCepInput.focus();
            }
        });
        syncEditCepState();

        document.getElementById('editClienteForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const updatedData = {
                sector: document.getElementById('editSector').value.toUpperCase(),
                nombreComercial: document.getElementById('editNombreComercial').value.toUpperCase(),
                nombrePersonal: document.getElementById('editNombrePersonal').value.toUpperCase(),
                telefono: document.getElementById('editTelefono').value,
                codigoCEP: document.getElementById('editCodigoCEP').value
            };
            try {
                await _setDoc(_doc(_db, `artifacts/${_appId}/users/${_userId}/clientes`, clienteId), updatedData, { merge: true });
                _showModal('Éxito', 'Cliente modificado exitosamente.');
                showModifyDeleteSearchView();
            } catch (error) {
                console.error("Error al modificar el cliente:", error);
                _showModal('Error', 'Hubo un error al modificar el cliente.');
            }
        });
        document.getElementById('backToModifyDeleteClienteBtn').addEventListener('click', showModifyDeleteSearchView);
    };

    /**
     * Elimina un cliente.
     */
    function deleteCliente(clienteId) {
        _showModal('Confirmar Eliminación', '¿Estás seguro de que deseas eliminar este cliente?', async () => {
            try {
                await _deleteDoc(_doc(_db, `artifacts/${_appId}/users/${_userId}/clientes`, clienteId));
                _showModal('Éxito', 'Cliente eliminado correctamente.');
                const searchInput = document.getElementById('search-modify-input');
                if (searchInput) {
                    searchInput.dispatchEvent(new Event('input'));
                }
            } catch (error) {
                console.error("Error al eliminar el cliente:", error);
                _showModal('Error', 'Hubo un error al eliminar el cliente.');
            }
        });
    };

    /**
     * Muestra un modal validado para agregar un nuevo item de datos maestros.
     */
    function showValidatedAddItemModal(collectionName, itemName) {
        const modalContainer = document.getElementById('modalContainer');
        const modalContent = document.getElementById('modalContent');
        
        modalContent.innerHTML = `
            <div class="text-center">
                <h3 class="text-xl font-bold text-gray-800 mb-4">Agregar Nuevo ${itemName}</h3>
                <form id="addItemForm" class="space-y-4">
                    <input type="text" id="newItemInput" placeholder="Nombre del ${itemName}" class="w-full px-4 py-2 border rounded-lg" required>
                    <button type="submit" class="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">Agregar</button>
                </form>
                <p id="addItemMessage" class="text-sm mt-2 h-4"></p>
                <div class="mt-4">
                     <button id="closeItemBtn" class="px-4 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500">Cerrar</button>
                </div>
            </div>
        `;
        modalContainer.classList.remove('hidden');

        const newItemInput = document.getElementById('newItemInput');
        const addItemMessage = document.getElementById('addItemMessage');

        document.getElementById('closeItemBtn').addEventListener('click', () => modalContainer.classList.add('hidden'));

        document.getElementById('addItemForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const newItemName = newItemInput.value.trim().toUpperCase();
            if (!newItemName) return;
            
            addItemMessage.textContent = '';
            addItemMessage.classList.remove('text-green-600', 'text-red-600');

            try {
                const collectionRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/${collectionName}`);
                const snapshot = await _getDocs(collectionRef);
                const existingItems = snapshot.docs.map(doc => doc.data().name.toLowerCase());
                
                if (existingItems.includes(newItemName.toLowerCase())) {
                    addItemMessage.classList.add('text-red-600');
                    addItemMessage.textContent = `"${newItemName}" ya existe.`;
                    return;
                }
                
                await _addDoc(collectionRef, { name: newItemName });
                addItemMessage.classList.add('text-green-600');
                addItemMessage.textContent = `¡"${newItemName}" agregado!`;
                newItemInput.value = '';
                newItemInput.focus();
                setTimeout(() => { addItemMessage.textContent = ''; }, 2000);
            } catch (err) {
                addItemMessage.classList.add('text-red-600');
                addItemMessage.textContent = `Error al guardar o validar.`;
            }
        });
    }

    /**
     * Muestra la vista para gestionar los datos maestros de sectores.
     */
    function showDatosMaestrosSectoresView() {
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto max-w-2xl">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl">
                        <h2 class="text-2xl font-bold text-gray-800 mb-6 text-center">Gestionar Sectores</h2>
                        <div id="sectores-list" class="space-y-2 max-h-96 overflow-y-auto border p-4 rounded-lg"></div>
                        <div class="mt-6 flex flex-col sm:flex-row gap-4">
                            <button id="addSectorMaestroBtn" class="w-full px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg shadow-md hover:bg-blue-600">Agregar Nuevo Sector</button>
                            <button id="backToClientesBtn" class="w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('addSectorMaestroBtn').addEventListener('click', () => showValidatedAddItemModal('sectores', 'Sector'));
        document.getElementById('backToClientesBtn').addEventListener('click', showClientesSubMenu);
        renderSectoresParaGestion();
    }
    
    /**
     * Renderiza la lista de sectores para su gestión.
     */
    function renderSectoresParaGestion() {
        const container = document.getElementById('sectores-list');
        if (!container) return;

        const collectionRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/sectores`);
        const unsubscribe = _onSnapshot(collectionRef, (snapshot) => {
            const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => a.name.localeCompare(b.name));
            if (items.length === 0) {
                container.innerHTML = `<p class="text-gray-500 text-center">No hay sectores definidos.</p>`;
                return;
            }
            container.innerHTML = items.map(item => `
                <div class="flex justify-between items-center bg-gray-50 p-2 rounded">
                    <span class="text-gray-800 flex-grow">${item.name}</span>
                    <button onclick="window.clientesModule.editSector('${item.id}', '${item.name}')" class="px-3 py-1 bg-yellow-500 text-white text-xs rounded-lg hover:bg-yellow-600 mr-2">Editar</button>
                    <button onclick="window.clientesModule.deleteSector('${item.id}', '${item.name}')" class="px-3 py-1 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600">Eliminar</button>
                </div>
            `).join('');
        });
        _activeListeners.push(unsubscribe);
    }
    
    /**
     * Permite editar el nombre de un sector.
     */
    async function editSector(sectorId, currentName) {
        const newName = prompt('Introduce el nuevo nombre para el sector:', currentName);
        if (newName && newName.trim() !== '' && newName.trim().toUpperCase() !== currentName.toUpperCase()) {
            const nuevoNombreMayus = newName.trim().toUpperCase();
            // Validar si el nuevo nombre ya existe
            const q = _query(_collection(_db, `artifacts/${_appId}/users/${_userId}/sectores`), _where("name", "==", nuevoNombreMayus));
            const querySnapshot = await _getDocs(q);
            if (!querySnapshot.empty) {
                _showModal('Error', `El sector "${nuevoNombreMayus}" ya existe.`);
                return;
            }

            try {
                // Actualizar el sector
                await _setDoc(_doc(_db, `artifacts/${_appId}/users/${_userId}/sectores`, sectorId), { name: nuevoNombreMayus });

                // Actualizar todos los clientes que usaban el nombre antiguo
                const clientesRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/clientes`);
                const clientesQuery = _query(clientesRef, _where("sector", "==", currentName));
                const clientesSnapshot = await _getDocs(clientesQuery);

                if (!clientesSnapshot.empty) {
                    const batch = _writeBatch(_db);
                    clientesSnapshot.docs.forEach(doc => {
                        batch.update(doc.ref, { sector: nuevoNombreMayus });
                    });
                    await batch.commit();
                }

                _showModal('Éxito', `Sector renombrado a "${nuevoNombreMayus}" y actualizado en ${clientesSnapshot.size} cliente(s).`);
            } catch (error) {
                _showModal('Error', `Ocurrió un error al renombrar el sector: ${error.message}`);
            }
        }
    }

    /**
     * Elimina un sector, con validación de uso.
     */
    async function deleteSector(sectorId, sectorName) {
        const clientesRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/clientes`);
        const q = _query(clientesRef, _where("sector", "==", sectorName));
        
        try {
            const usageSnapshot = await _getDocs(q);
            if (!usageSnapshot.empty) {
                _showModal('Error al Eliminar', `No se puede eliminar el sector "${sectorName}" porque está siendo utilizado por ${usageSnapshot.size} cliente(s).`);
                return;
            }
            _showModal('Confirmar Eliminación', `¿Estás seguro de que deseas eliminar el sector "${sectorName}"?`, async () => {
                await _deleteDoc(_doc(_db, `artifacts/${_appId}/users/${_userId}/sectores`, sectorId));
                _showModal('Éxito', `El sector "${sectorName}" ha sido eliminado.`);
            });
        } catch (error) {
            _showModal('Error', `Ocurrió un error al intentar eliminar el sector: ${error.message}`);
        }
    }

    /**
     * Maneja la eliminación de TODOS los clientes.
     */
    async function handleDeleteAllClientes() {
        _showModal('Confirmación Extrema', '¿Estás SEGURO de que quieres eliminar TODOS los clientes? Esta acción es irreversible.', async () => {
            _showModal('Progreso', 'Eliminando todos los clientes...');
            try {
                const collectionRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/clientes`);
                const snapshot = await _getDocs(collectionRef);
                if (snapshot.empty) {
                    _showModal('Aviso', 'No hay clientes para eliminar.');
                    return;
                }
                const batch = _writeBatch(_db);
                snapshot.docs.forEach(doc => {
                    batch.delete(doc.ref);
                });
                await batch.commit();
                _showModal('Éxito', 'Todos los clientes han sido eliminados.');
            } catch (error) {
                console.error("Error al eliminar todos los clientes:", error);
                _showModal('Error', 'Hubo un error al eliminar los clientes.');
            }
        });
    }


    // Exponer funciones públicas al objeto window
    window.clientesModule = {
        editCliente,
        deleteCliente,
        editSector,
        deleteSector
    };

})();
