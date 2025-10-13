// --- Lógica del módulo de Clientes ---

(function() {
    // Variables locales del módulo que se inicializarán desde index.html
    let _db, _userId, _appId, _mainContent, _floatingControls, _activeListeners;
    let _showMainMenu, _showModal, _showAddItemModal, _populateDropdown;
    let _collection, _onSnapshot, _doc, _addDoc, _setDoc, _deleteDoc, _getDoc, _getDocs, _query, _where, _writeBatch, _runTransaction;
    
    let _clientesCache = []; // Caché local para búsquedas y ediciones rápidas
    let _clientesParaImportar = []; // Caché para la data del Excel a importar

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
        _runTransaction = dependencies.runTransaction;
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
                            <button id="saldosVaciosBtn" class="w-full px-6 py-3 bg-cyan-500 text-white font-semibold rounded-lg shadow-md hover:bg-cyan-600">Consultar Saldos de Vacíos</button>
                            <button id="funcionesAvanzadasBtn" class="w-full px-6 py-3 bg-gray-700 text-white font-semibold rounded-lg shadow-md hover:bg-gray-800">Funciones Avanzadas</button>
                            <button id="backToMenuBtn" class="w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver al Menú Principal</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('verClientesBtn').addEventListener('click', showVerClientesView);
        document.getElementById('agregarClienteBtn').addEventListener('click', showAgregarClienteView);
        document.getElementById('saldosVaciosBtn').addEventListener('click', showSaldosVaciosView);
        document.getElementById('funcionesAvanzadasBtn').addEventListener('click', showFuncionesAvanzadasView);
        document.getElementById('backToMenuBtn').addEventListener('click', _showMainMenu);
    }

    /**
     * Muestra la vista de funciones avanzadas.
     */
    function showFuncionesAvanzadasView() {
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl text-center">
                        <h1 class="text-3xl font-bold text-gray-800 mb-6">Funciones Avanzadas de Clientes</h1>
                        <div class="space-y-4">
                            <button id="importarClientesBtn" class="w-full px-6 py-3 bg-teal-500 text-white font-semibold rounded-lg shadow-md hover:bg-teal-600">Importar Clientes desde Excel</button>
                            <button id="datosMaestrosSectoresBtn" class="w-full px-6 py-3 bg-yellow-500 text-gray-800 font-semibold rounded-lg shadow-md hover:bg-yellow-600">Gestionar Sectores</button>
                            <button id="deleteAllClientesBtn" class="w-full px-6 py-3 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700">Eliminar Todos los Clientes</button>
                            <button id="backToClientesMenuBtn" class="w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver a Clientes</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('importarClientesBtn').addEventListener('click', showImportarClientesView);
        document.getElementById('datosMaestrosSectoresBtn').addEventListener('click', showDatosMaestrosSectoresView);
        document.getElementById('deleteAllClientesBtn').addEventListener('click', handleDeleteAllClientes);
        document.getElementById('backToClientesMenuBtn').addEventListener('click', showClientesSubMenu);
    }

    /**
     * Muestra la vista para importar clientes desde un archivo Excel.
     */
    function showImportarClientesView() {
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto max-w-4xl">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl">
                        <h2 class="text-2xl font-bold text-gray-800 mb-4 text-center">Importar Clientes desde Excel</h2>
                        <p class="text-center text-gray-600 mb-6">Selecciona un archivo .xlsx o .csv. La primera fila debe contener los encabezados: Sector, Nombre Comercial, Nombre Personal, telefono, CEP, y opcionalmente: Coordenadas.</p>
                        <input type="file" id="excel-uploader" accept=".xlsx, .xls, .csv" class="w-full p-4 border-2 border-dashed rounded-lg">
                        <div id="preview-container" class="mt-6 overflow-auto max-h-96"></div>
                        <div id="import-actions" class="mt-6 flex flex-col sm:flex-row gap-4 hidden">
                             <button id="confirmImportBtn" class="w-full px-6 py-3 bg-green-500 text-white font-semibold rounded-lg shadow-md hover:bg-green-600">Confirmar e Importar</button>
                             <button id="cancelImportBtn" class="w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Cancelar</button>
                        </div>
                         <button id="backToAdvancedFunctionsBtn" class="mt-6 w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver</button>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('excel-uploader').addEventListener('change', handleFileUpload);
        document.getElementById('backToAdvancedFunctionsBtn').addEventListener('click', showFuncionesAvanzadasView);
    }

    /**
     * Maneja la carga y parseo del archivo Excel.
     */
    function handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            const data = e.target.result;
            const workbook = XLSX.read(data, { type: 'binary' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            if (jsonData.length < 2) {
                _showModal('Error', 'El archivo está vacío o no tiene datos después de la fila de encabezado.');
                return;
            }

            const headers = jsonData[0].map(h => h.toString().toLowerCase().trim());
            const requiredHeaders = ['sector', 'nombre comercial', 'nombre personal', 'telefono', 'cep'];
            const optionalHeaders = ['coordenadas'];
            
            const headerMap = {};
            let missingHeader = false;
            requiredHeaders.forEach(rh => {
                const fileHeader = headers.find(h => h.replace(/\s+/g, '') === rh.replace(/\s+/g, ''));
                if (fileHeader) {
                    headerMap[rh] = headers.indexOf(fileHeader);
                } else {
                     _showModal('Error', `Falta la columna requerida: "${rh}" en el archivo.`);
                     missingHeader = true;
                }
            });
            if (missingHeader) return;

            optionalHeaders.forEach(oh => {
                const fileHeader = headers.find(h => h.replace(/\s+/g, '') === oh.replace(/\s+/g, ''));
                if (fileHeader) {
                    headerMap[oh] = headers.indexOf(fileHeader);
                }
            });

            _clientesParaImportar = jsonData.slice(1).map(row => {
                const cliente = {
                    sector: (row[headerMap['sector']] || '').toString().trim().toUpperCase(),
                    nombreComercial: (row[headerMap['nombre comercial']] || '').toString().trim().toUpperCase(),
                    nombrePersonal: (row[headerMap['nombre personal']] || '').toString().trim().toUpperCase(),
                    telefono: (row[headerMap['telefono']] || '').toString().trim(),
                    codigoCEP: (row[headerMap['cep']] || 'N/A').toString().trim(),
                    coordenadas: headerMap['coordenadas'] !== undefined ? (row[headerMap['coordenadas']] || '').toString().trim() : '',
                    saldoVacios: {} // Initialize empty returns object
                };
                if (!cliente.codigoCEP) cliente.codigoCEP = 'N/A';
                return cliente;
            }).filter(c => c.nombreComercial && c.nombrePersonal);

            renderPreviewTable(_clientesParaImportar);
        };
        reader.readAsBinaryString(file);
    }

    /**
     * Muestra una tabla de vista previa con los datos del Excel.
     */
    function renderPreviewTable(clientes) {
        const container = document.getElementById('preview-container');
        const actionsContainer = document.getElementById('import-actions');
        const backButton = document.getElementById('backToAdvancedFunctionsBtn');
        
        if (clientes.length === 0) {
            container.innerHTML = `<p class="text-center text-red-500">No se encontraron clientes válidos para importar.</p>`;
            actionsContainer.classList.add('hidden');
            return;
        }

        let tableHTML = `<h3 class="font-bold text-lg mb-2">Vista Previa (${clientes.length} clientes a importar)</h3>
            <table class="min-w-full bg-white text-sm">
                <thead class="bg-gray-200"><tr>
                    <th class="py-2 px-3 text-left">Sector</th>
                    <th class="py-2 px-3 text-left">N. Comercial</th>
                    <th class="py-2 px-3 text-left">N. Personal</th>
                    <th class="py-2 px-3 text-left">Teléfono</th>
                    <th class="py-2 px-3 text-left">CEP</th>
                    <th class="py-2 px-3 text-left">Coordenadas</th>
                </tr></thead><tbody>`;
        
        clientes.forEach(c => {
            tableHTML += `<tr class="border-b">
                <td class="py-2 px-3">${c.sector}</td>
                <td class="py-2 px-3">${c.nombreComercial}</td>
                <td class="py-2 px-3">${c.nombrePersonal}</td>
                <td class="py-2 px-3">${c.telefono}</td>
                <td class="py-2 px-3">${c.codigoCEP}</td>
                <td class="py-2 px-3">${c.coordenadas || 'N/A'}</td>
            </tr>`;
        });
        tableHTML += '</tbody></table>';
        container.innerHTML = tableHTML;

        actionsContainer.classList.remove('hidden');
        backButton.classList.add('hidden');
        document.getElementById('confirmImportBtn').onclick = handleConfirmImport;
        document.getElementById('cancelImportBtn').onclick = () => {
             _clientesParaImportar = [];
             renderPreviewTable([]);
             document.getElementById('excel-uploader').value = '';
             actionsContainer.classList.add('hidden');
             backButton.classList.remove('hidden');
             container.innerHTML = '';
        };
    }

    /**
     * Confirma y guarda los clientes y sectores importados en Firestore.
     */
    async function handleConfirmImport() {
        if (_clientesParaImportar.length === 0) {
            _showModal('Error', 'No hay clientes para importar.');
            return;
        }
        
        _showModal('Progreso', `Importando ${_clientesParaImportar.length} clientes...`);

        try {
            const sectoresRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/sectores`);
            const sectoresSnapshot = await _getDocs(sectoresRef);
            const existingSectores = new Set(sectoresSnapshot.docs.map(doc => doc.data().name.toUpperCase()));
            
            const newSectores = new Set(
                _clientesParaImportar
                    .map(c => c.sector)
                    .filter(s => s && !existingSectores.has(s))
            );

            const batch = _writeBatch(_db);

            newSectores.forEach(sectorName => {
                const newSectorRef = _doc(sectoresRef);
                batch.set(newSectorRef, { name: sectorName });
            });
            
            const clientesRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/clientes`);
            _clientesParaImportar.forEach(cliente => {
                const newClienteRef = _doc(clientesRef);
                batch.set(newClienteRef, cliente);
            });

            await batch.commit();

            _showModal('Éxito', `Se han importado ${_clientesParaImportar.length} clientes y ${newSectores.size} nuevos sectores.`);
            showFuncionesAvanzadasView();

        } catch (error) {
            _showModal('Error', `Ocurrió un error durante la importación: ${error.message}`);
        } finally {
            _clientesParaImportar = [];
        }
    }
    
    /**
     * NUEVA FUNCIÓN: Obtiene las coordenadas GPS del navegador y las inserta en un campo de texto.
     * @param {string} inputId - El ID del elemento input donde se insertarán las coordenadas.
     */
    function getCurrentCoordinates(inputId) {
        const coordsInput = document.getElementById(inputId);
        if (!coordsInput) return;

        if (navigator.geolocation) {
            const originalPlaceholder = coordsInput.placeholder;
            coordsInput.placeholder = 'Obteniendo...';
            coordsInput.disabled = true;

            navigator.geolocation.getCurrentPosition(position => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                coordsInput.value = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
                coordsInput.placeholder = originalPlaceholder;
                coordsInput.disabled = false;
            }, error => {
                _showModal('Error de Geolocalización', `No se pudo obtener la ubicación: ${error.message}`);
                coordsInput.placeholder = originalPlaceholder;
                coordsInput.disabled = false;
            });
        } else {
            _showModal('No Soportado', 'La geolocalización no es soportada por este navegador.');
        }
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
                            <!-- CAMBIO: Se añade el campo de coordenadas -->
                            <div>
                                <label for="coordenadas" class="block text-gray-700 font-medium mb-2">Coordenadas:</label>
                                <div class="flex items-center space-x-2">
                                    <input type="text" id="coordenadas" class="w-full px-4 py-2 border rounded-lg" placeholder="Ej: 8.29, -71.98">
                                    <button type="button" id="getCoordsBtn" class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">GPS</button>
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
        // CAMBIO: Se añade el listener para el botón de obtener coordenadas
        document.getElementById('getCoordsBtn').addEventListener('click', () => getCurrentCoordinates('coordenadas'));
    }

    async function agregarCliente(e) {
        e.preventDefault();
        const form = e.target;
        
        const nombreComercial = form.nombreComercial.value.trim().toUpperCase();
        const nombrePersonal = form.nombrePersonal.value.trim().toUpperCase();
        const sector = form.sector.value.toUpperCase();
        const telefono = form.telefono.value.trim();
        const codigoCEP = form.codigoCEP.value.trim();
        // CAMBIO: Se obtiene el valor de las coordenadas
        const coordenadas = form.coordenadas.value.trim();

        const normComercial = nombreComercial.toLowerCase();
        const normPersonal = nombrePersonal.toLowerCase();

        // Carga el caché más recente antes de validar duplicados
        const clientesRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/clientes`);
        const snapshot = await _getDocs(clientesRef);
        _clientesCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

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
                codigoCEP: codigoCEP,
                // CAMBIO: Se añade el campo coordenadas al objeto a guardar
                coordenadas: coordenadas,
                saldoVacios: {} // Initialize empty returns object
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

        const container = document.getElementById('clientesListContainer');
        const clientesRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/clientes`);
        const unsubscribe = _onSnapshot(clientesRef, (snapshot) => {
            _clientesCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderClientesList('clientesListContainer', false); 
        }, (error) => {
            // CORRECCIÓN: Ignorar el error de permisos al cerrar sesión.
            if (window.isLoggingOut && error.code === 'permission-denied') {
                console.log("Listener de clientes detenido por cierre de sesión.");
                return;
            }
            console.error("Error al cargar clientes:", error);
            container.innerHTML = `<p class="text-red-500 text-center">Error al cargar la lista de clientes.</p>`;
        });

        _activeListeners.push(unsubscribe);
    }


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

    function setupFiltros(containerId) {
        _populateDropdown('sectores', 'filter-sector', 'Sector');

        const searchInput = document.getElementById('search-input');
        const sectorFilter = document.getElementById('filter-sector');
        const clearBtn = document.getElementById('clear-filters-btn');

        const applyFilters = () => renderClientesList(containerId, false);

        searchInput.addEventListener('input', applyFilters);
        sectorFilter.addEventListener('change', applyFilters);
        
        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            sectorFilter.value = '';
            applyFilters();
        });
    }

    function renderClientesList(elementId, readOnly = false, externalSearchTerm = null) {
        const container = document.getElementById(elementId);
        if (!container) return;
        
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
            if (_clientesCache.length > 0) {
                container.innerHTML = `<p class="text-gray-500 text-center">No hay clientes que coincidan con la búsqueda.</p>`;
            } else {
                container.innerHTML = `<p class="text-gray-500 text-center">Cargando clientes...</p>`;
            }
            return;
        }

        let tableHTML = `
            <table class="min-w-full bg-white border border-gray-200">
                <thead class="bg-gray-200 sticky top-0">
                    <tr>
                        <th class="py-2 px-4 border-b text-left text-sm">N. Comercial</th>
                        <th class="py-2 px-4 border-b text-left text-sm">N. Personal</th>
                        <th class="py-2 px-4 border-b text-left text-sm">Teléfono</th>
                        ${!readOnly ? `<th class="py-2 px-4 border-b text-center text-sm">Acciones</th>` : ''}
                    </tr>
                </thead>
                <tbody>
        `;
        filteredClients.forEach(cliente => {
            let mapButtonHTML = '';
            if (cliente.coordenadas) {
                 mapButtonHTML = `<a href="https://www.google.com/maps?q=${cliente.coordenadas}" target="_blank" class="px-3 py-1 bg-green-500 text-white text-xs rounded-lg hover:bg-green-600">Mapa</a>`;
            }
            
            tableHTML += `
                <tr class="hover:bg-gray-50">
                    <td class="py-2 px-4 border-b text-sm">${cliente.nombreComercial}</td>
                    <td class="py-2 px-4 border-b text-sm">${cliente.nombrePersonal}</td>
                    <td class="py-2 px-4 border-b text-sm">${cliente.telefono}</td>
                    ${!readOnly ? `
                    <td class="py-2 px-4 border-b text-center space-x-2">
                        ${mapButtonHTML}
                        <button onclick="window.clientesModule.editCliente('${cliente.id}')" class="px-3 py-1 bg-yellow-500 text-white text-xs rounded-lg hover:bg-yellow-600">Editar</button>
                        <button onclick="window.clientesModule.deleteCliente('${cliente.id}')" class="px-3 py-1 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600">Eliminar</button>
                    </td>` : ''}
                </tr>
            `;
        });
        tableHTML += `</tbody></table>`;
        container.innerHTML = tableHTML;
    }
    
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
                             <!-- CAMBIO: Se añade el campo para editar coordenadas -->
                            <div>
                                <label for="editCoordenadas" class="block text-gray-700 font-medium mb-2">Coordenadas:</label>
                                <div class="flex items-center space-x-2">
                                    <input type="text" id="editCoordenadas" value="${cliente.coordenadas || ''}" class="w-full px-4 py-2 border rounded-lg">
                                    <button type="button" id="getEditCoordsBtn" class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">GPS</button>
                                </div>
                            </div>
                            <button type="submit" class="w-full px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg shadow-md hover:bg-blue-600">Guardar Cambios</button>
                        </form>
                        <button id="backToVerClientesBtn" class="mt-4 w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver</button>
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
        
        // CAMBIO: Se añade el listener para el botón de obtener coordenadas en la vista de edición
        document.getElementById('getEditCoordsBtn').addEventListener('click', () => getCurrentCoordinates('editCoordenadas'));

        document.getElementById('editClienteForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const updatedData = {
                sector: document.getElementById('editSector').value.toUpperCase(),
                nombreComercial: document.getElementById('editNombreComercial').value.toUpperCase(),
                nombrePersonal: document.getElementById('editNombrePersonal').value.toUpperCase(),
                telefono: document.getElementById('editTelefono').value,
                codigoCEP: document.getElementById('editCodigoCEP').value,
                // CAMBIO: Se incluye el campo de coordenadas al actualizar
                coordenadas: document.getElementById('editCoordenadas').value.trim(),
                saldoVacios: cliente.saldoVacios || {} // Preserve existing returns data
            };
            try {
                await _setDoc(_doc(_db, `artifacts/${_appId}/users/${_userId}/clientes`, clienteId), updatedData, { merge: true });
                _showModal('Éxito', 'Cliente modificado exitosamente.');
                showVerClientesView();
            } catch (error) {
                console.error("Error al modificar el cliente:", error);
                _showModal('Error', 'Hubo un error al modificar el cliente.');
            }
        });
        document.getElementById('backToVerClientesBtn').addEventListener('click', showVerClientesView);
    };

    function deleteCliente(clienteId) {
        _showModal('Confirmar Eliminación', '¿Estás seguro de que deseas eliminar este cliente?', async () => {
            try {
                await _deleteDoc(_doc(_db, `artifacts/${_appId}/users/${_userId}/clientes`, clienteId));
                _showModal('Éxito', 'Cliente eliminado correctamente.');
                showVerClientesView();
            } catch (error) {
                console.error("Error al eliminar el cliente:", error);
                _showModal('Error', 'Hubo un error al eliminar el cliente.');
            }
        });
    };

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
        document.getElementById('backToClientesBtn').addEventListener('click', showFuncionesAvanzadasView);
        renderSectoresParaGestion();
    }
    
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
    
    async function editSector(sectorId, currentName) {
        const newName = prompt('Introduce el nuevo nombre para el sector:', currentName);
        if (newName && newName.trim() !== '' && newName.trim().toUpperCase() !== currentName.toUpperCase()) {
            const nuevoNombreMayus = newName.trim().toUpperCase();
            const q = _query(_collection(_db, `artifacts/${_appId}/users/${_userId}/sectores`), _where("name", "==", nuevoNombreMayus));
            const querySnapshot = await _getDocs(q);
            if (!querySnapshot.empty) {
                _showModal('Error', `El sector "${nuevoNombreMayus}" ya existe.`);
                return;
            }

            try {
                await _setDoc(_doc(_db, `artifacts/${_appId}/users/${_userId}/sectores`, sectorId), { name: nuevoNombreMayus });

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

    // --- Lógica de Saldos de Vacíos ---

    function showSaldosVaciosView() {
        _floatingControls.classList.add('hidden');
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl">
                        <h2 class="text-2xl font-bold text-gray-800 mb-6 text-center">Saldos de Envases Retornables (Vacíos)</h2>
                        <input type="text" id="saldo-search-input" placeholder="Buscar cliente..." class="w-full px-4 py-2 border rounded-lg mb-4">
                        <div id="saldosListContainer" class="overflow-x-auto max-h-96">
                            <p class="text-gray-500 text-center">Cargando saldos de clientes...</p>
                        </div>
                        <button id="backToClientesBtn" class="mt-6 w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver</button>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('backToClientesBtn').addEventListener('click', showClientesSubMenu);
        document.getElementById('saldo-search-input').addEventListener('input', renderSaldosList);
        
        const clientesRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/clientes`);
        const unsubscribe = _onSnapshot(clientesRef, (snapshot) => {
            _clientesCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderSaldosList();
        }, (error) => {
            if (window.isLoggingOut && error.code === 'permission-denied') {
                console.log("Listener de saldos detenido por cierre de sesión.");
                return;
            }
            console.error("Error al cargar saldos:", error);
        });
        _activeListeners.push(unsubscribe);
    }

    function renderSaldosList() {
        const container = document.getElementById('saldosListContainer');
        const searchInput = document.getElementById('saldo-search-input');
        
        if (!container || !searchInput) return;

        const searchTerm = searchInput.value.toLowerCase();

        const filteredClients = _clientesCache.filter(c => c.nombreComercial.toLowerCase().includes(searchTerm));

        if (filteredClients.length === 0) {
            container.innerHTML = `<p class="text-center text-gray-500">No se encontraron clientes.</p>`;
            return;
        }

        let tableHTML = `<table class="min-w-full bg-white text-sm">
            <thead class="bg-gray-200 sticky top-0"><tr>
                <th class="py-2 px-4 border-b text-left">Cliente</th>
                <th class="py-2 px-4 border-b text-center">Total Vacíos Pendientes</th>
                <th class="py-2 px-4 border-b text-center">Acciones</th>
            </tr></thead><tbody>`;

        filteredClients.forEach(cliente => {
            const saldoVacios = cliente.saldoVacios || {};
            const totalVacios = Object.values(saldoVacios).reduce((sum, count) => sum + count, 0);
            tableHTML += `<tr class="hover:bg-gray-50">
                <td class="py-2 px-4 border-b">${cliente.nombreComercial}</td>
                <td class="py-2 px-4 border-b text-center font-bold">${totalVacios}</td>
                <td class="py-2 px-4 border-b text-center">
                    <button onclick="window.clientesModule.showSaldoDetalleModal('${cliente.id}')" class="px-3 py-1 bg-blue-500 text-white text-xs rounded-lg hover:bg-blue-600">Ver Detalle / Ajustar</button>
                </td>
            </tr>`;
        });
        tableHTML += `</tbody></table>`;
        container.innerHTML = tableHTML;
    }

    async function showSaldoDetalleModal(clienteId) {
        const cliente = _clientesCache.find(c => c.id === clienteId);
        if (!cliente) return;

        const inventarioRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`);
        const q = _query(inventarioRef, _where("manejaVacios", "==", true));
        const inventarioSnapshot = await _getDocs(q);
        const productosConVacios = inventarioSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        let optionsHTML = '<option value="">Seleccione un producto...</option>';
        productosConVacios.sort((a,b) => `${a.marca} ${a.segmento} ${a.presentacion}`.localeCompare(`${b.marca} ${b.segmento} ${b.presentacion}`)).forEach(p => {
            optionsHTML += `<option value="${p.id}">${p.marca} - ${p.segmento} - ${p.presentacion}</option>`;
        });

        const saldoVacios = cliente.saldoVacios || {};
        let detalleHTML = '<p class="text-center text-gray-500">Este cliente no tiene saldos pendientes.</p>';
        if (Object.keys(saldoVacios).some(key => saldoVacios[key] !== 0)) {
            detalleHTML = '<ul class="space-y-2">';
            for (const productoId in saldoVacios) {
                if (saldoVacios[productoId] !== 0) {
                    const producto = productosConVacios.find(p => p.id === productoId) || { presentacion: 'Producto Desconocido', marca: 'N/A', segmento: 'N/A' };
                    detalleHTML += `<li class="flex justify-between"><span>${producto.marca} - ${producto.segmento} - ${producto.presentacion}:</span><span class="font-bold">${saldoVacios[productoId]}</span></li>`;
                }
            }
            detalleHTML += '</ul>';
        }

        const modalContent = `
            <h3 class="text-xl font-bold text-gray-800 mb-4">Detalle de Saldo: ${cliente.nombreComercial}</h3>
            <div class="mb-6 border-b pb-4">${detalleHTML}</div>
            <h4 class="text-lg font-semibold mb-2">Ajuste Manual</h4>
            <div class="space-y-4">
                <div>
                    <label for="ajusteProducto" class="block text-sm font-medium mb-1">Producto:</label>
                    <select id="ajusteProducto" class="w-full px-2 py-1 border rounded-lg">${optionsHTML}</select>
                </div>
                <div>
                    <label for="ajusteCantidad" class="block text-sm font-medium mb-1">Cantidad de Cajas:</label>
                    <input type="number" id="ajusteCantidad" min="1" class="w-full px-2 py-1 border rounded-lg">
                </div>
                <div class="flex gap-4">
                    <button id="ajusteDevolucionBtn" class="w-full px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600">Registrar Devolución (-)</button>
                    <button id="ajustePrestamoBtn" class="w-full px-4 py-2 bg-yellow-500 text-gray-800 rounded-lg hover:bg-yellow-600">Registrar Préstamo (+)</button>
                </div>
            </div>
        `;
        _showModal('Detalle de Saldo', modalContent);

        document.getElementById('ajusteDevolucionBtn').addEventListener('click', () => {
            const productoId = document.getElementById('ajusteProducto').value;
            const cantidad = parseInt(document.getElementById('ajusteCantidad').value, 10);
            if(productoId && cantidad > 0) {
                handleAjusteManualVacios(clienteId, productoId, cantidad, 'devolucion');
            } else {
                alert('Por favor, seleccione un producto y una cantidad válida.');
            }
        });
        document.getElementById('ajustePrestamoBtn').addEventListener('click', () => {
            const productoId = document.getElementById('ajusteProducto').value;
            const cantidad = parseInt(document.getElementById('ajusteCantidad').value, 10);
             if(productoId && cantidad > 0) {
                handleAjusteManualVacios(clienteId, productoId, cantidad, 'prestamo');
            } else {
                alert('Por favor, seleccione un producto y una cantidad válida.');
            }
        });
    }

    async function handleAjusteManualVacios(clienteId, productoId, cantidad, tipoAjuste) {
        const clienteRef = _doc(_db, `artifacts/${_appId}/users/${_userId}/clientes`, clienteId);
        _showModal('Progreso', 'Actualizando saldo...');
        try {
            await _runTransaction(_db, async (transaction) => {
                const clienteDoc = await transaction.get(clienteRef);
                if (!clienteDoc.exists()) {
                    throw "El cliente no existe.";
                }

                const data = clienteDoc.data();
                const saldoVacios = data.saldoVacios || {};
                const saldoActual = saldoVacios[productoId] || 0;

                let nuevoSaldo = saldoActual;
                if (tipoAjuste === 'devolucion') {
                    nuevoSaldo -= cantidad;
                } else { // prestamo
                    nuevoSaldo += cantidad;
                }
                
                saldoVacios[productoId] = nuevoSaldo;
                transaction.update(clienteRef, { saldoVacios: saldoVacios });
            });
            _showModal('Éxito', 'El saldo de vacíos se ha actualizado correctamente.');
        } catch (error) {
            console.error("Error en el ajuste manual de vacíos:", error);
            _showModal('Error', `No se pudo actualizar el saldo: ${error}`);
        }
    }


    // Exponer funciones públicas al objeto window
    window.clientesModule = {
        editCliente,
        deleteCliente,
        editSector,
        deleteSector,
        showSaldoDetalleModal
    };

})();
