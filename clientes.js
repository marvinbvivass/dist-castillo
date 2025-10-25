// --- Lógica del módulo de Clientes ---

(function() {
    // Variables locales del módulo que se inicializarán desde index.html
    let _db, _userId, _userRole, _appId, _mainContent, _floatingControls, _activeListeners;
    let _showMainMenu, _showModal, _showAddItemModal, _populateDropdown;
    let _collection, _onSnapshot, _doc, _addDoc, _setDoc, _deleteDoc, _getDoc, _getDocs, _query, _where, _writeBatch, _runTransaction;

    let _clientesCache = []; // Caché local para búsquedas y ediciones rápidas
    let _clientesParaImportar = []; // Caché para la data del Excel a importar

    // --- CORRECCIÓN: Usar _appId dinámicamente ---
    let CLIENTES_COLLECTION_PATH = ''; // Se inicializará en initClientes
    let SECTORES_COLLECTION_PATH = ''; // Se inicializará en initClientes
    // --- FIN CORRECCIÓN ---

    // Tipos de Vacío (asegurar consistencia con otros módulos)
    const TIPOS_VACIO = ["1/4 - 1/3", "ret 350 ml", "ret 1.25 Lts"];

    /**
     * Inicializa el módulo con las dependencias necesarias desde la app principal.
     */
    window.initClientes = function(dependencies) {
        // Validar dependencias esenciales
        if (!dependencies.db || !dependencies.appId || !dependencies.mainContent) {
            console.error("Clientes Init Error: Missing critical dependencies (db, appId, mainContent)");
            throw new Error("El módulo de Clientes no pudo inicializarse correctamente por falta de dependencias.");
        }
        _db = dependencies.db;
        _userId = dependencies.userId;
        _userRole = dependencies.userRole;
        _appId = dependencies.appId; // Guardar appId
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

        // --- CORRECCIÓN: Inicializar rutas con _appId ---
        CLIENTES_COLLECTION_PATH = `artifacts/${_appId}/public/data/clientes`;
        SECTORES_COLLECTION_PATH = `artifacts/${_appId}/public/data/sectores`;
        // --- FIN CORRECCIÓN ---

        console.log("Clientes module initialized. Public paths set with appId:", _appId);
    };

    /**
     * Renderiza el menú de subopciones de clientes.
     */
    window.showClientesSubMenu = function() {
        if (!_appId) { // Verificar si la inicialización ocurrió correctamente
             console.error("showClientesSubMenu Error: _appId is not set. Module might not be initialized.");
             _showModal("Error Interno", "El módulo de clientes no se inicializó correctamente (falta appId).");
             return;
        }
         _floatingControls?.classList.add('hidden'); // Use optional chaining
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto max-w-lg"> {/* Consistent width */}
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl text-center">
                        <h1 class="text-3xl font-bold text-gray-800 mb-6">Gestión de Clientes</h1>
                        <div class="space-y-4">
                            <button id="verClientesBtn" class="w-full px-6 py-3 bg-indigo-500 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-600">Ver Clientes</button>
                            <button id="agregarClienteBtn" class="w-full px-6 py-3 bg-indigo-500 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-600">Agregar Cliente</button>
                            <button id="saldosVaciosBtn" class="w-full px-6 py-3 bg-cyan-500 text-white font-semibold rounded-lg shadow-md hover:bg-cyan-600">Consultar Saldos de Vacíos</button>
                            ${_userRole === 'admin' ? `
                            <button id="funcionesAvanzadasBtn" class="w-full px-6 py-3 bg-gray-700 text-white font-semibold rounded-lg shadow-md hover:bg-gray-800">Funciones Avanzadas</button>
                            ` : ''}
                            <button id="backToMenuBtn" class="w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver al Menú Principal</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('verClientesBtn').addEventListener('click', showVerClientesView);
        document.getElementById('agregarClienteBtn').addEventListener('click', showAgregarClienteView);
        document.getElementById('saldosVaciosBtn').addEventListener('click', showSaldosVaciosView);
        if (_userRole === 'admin') {
            document.getElementById('funcionesAvanzadasBtn')?.addEventListener('click', showFuncionesAvanzadasView); // Use optional chaining
        }
        document.getElementById('backToMenuBtn').addEventListener('click', _showMainMenu);
    }

    /**
     * Muestra la vista de funciones avanzadas (solo admin).
     */
    function showFuncionesAvanzadasView() {
        if (_userRole !== 'admin') {
             _showModal("Acceso Denegado", "Esta sección es solo para administradores.");
             showClientesSubMenu(); // Volver al menú de clientes
             return;
        }
        _floatingControls?.classList.add('hidden');
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto max-w-lg"> {/* Consistent width */}
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
     * Muestra la vista para importar clientes desde un archivo Excel (solo admin).
     */
    function showImportarClientesView() {
         if (_userRole !== 'admin') {
             _showModal("Acceso Denegado", "Solo administradores pueden importar clientes.");
             showFuncionesAvanzadasView();
             return;
         }
        _floatingControls?.classList.add('hidden');
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto max-w-4xl"> {/* Wider for preview table */}
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl">
                        <h2 class="text-2xl font-bold text-gray-800 mb-4 text-center">Importar Clientes desde Excel</h2>
                        <p class="text-center text-gray-600 mb-6 text-sm">Selecciona un archivo .xlsx o .xls. La primera fila debe contener los encabezados: Sector, Nombre Comercial, Nombre Personal, telefono, CEP, y opcionalmente: Coordenadas (o X, Y).</p>
                        <input type="file" id="excel-uploader" accept=".xlsx, .xls" class="w-full p-4 border-2 border-dashed rounded-lg cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"> {/* Improved styling */}
                        <div id="preview-container" class="mt-6 overflow-auto max-h-96 border rounded-lg"></div> {/* Added border */}
                        <div id="import-actions" class="mt-6 flex flex-col sm:flex-row gap-4 hidden">
                             <button id="confirmImportBtn" class="w-full px-6 py-3 bg-green-500 text-white font-semibold rounded-lg shadow-md hover:bg-green-600 disabled:opacity-50" disabled>Confirmar e Importar</button> {/* Start disabled */}
                             <button id="cancelImportBtn" class="w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Cancelar</button>
                        </div>
                         <button id="backToAdvancedFunctionsBtn" class="mt-6 w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver</button>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('excel-uploader').addEventListener('change', handleFileUpload);
        document.getElementById('backToAdvancedFunctionsBtn').addEventListener('click', showFuncionesAvanzadasView);
        // Confirm/Cancel buttons listeners are added in renderPreviewTable
    }

    /**
     * Maneja la carga y parseo del archivo Excel.
     */
    function handleFileUpload(event) {
        const file = event.target.files?.[0]; // Use optional chaining
        const previewContainer = document.getElementById('preview-container');
        const confirmBtn = document.getElementById('confirmImportBtn');
        const cancelBtn = document.getElementById('cancelImportBtn');
        const actionsContainer = document.getElementById('import-actions');
        const backButton = document.getElementById('backToAdvancedFunctionsBtn');

        // Reset state on new file selection
        _clientesParaImportar = [];
        if (previewContainer) previewContainer.innerHTML = '';
        if (confirmBtn) confirmBtn.disabled = true;
        if (actionsContainer) actionsContainer.classList.add('hidden');
        if (backButton) backButton.classList.remove('hidden');

        if (!file) return;

        // Check if SheetJS library is loaded
        if (typeof XLSX === 'undefined') {
            _showModal('Error', 'La librería para leer archivos Excel (SheetJS) no está cargada. Revisa la conexión o el script en index.html.');
            event.target.value = ''; // Clear file input
            return;
        }

        if (previewContainer) previewContainer.innerHTML = '<p class="text-center text-gray-500 p-4">Procesando archivo...</p>';

        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = e.target.result;
                // Use {type: 'array'} for better compatibility
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                if (!firstSheetName) throw new Error("El archivo Excel no contiene hojas.");

                const worksheet = workbook.Sheets[firstSheetName];
                // header: 1 reads first row as headers array, defval: '' treats empty cells as empty strings
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

                if (jsonData.length < 2) { // Need at least header + 1 data row
                    throw new Error('El archivo está vacío o no tiene datos después de la fila de encabezado.');
                }

                // --- Robust Header Mapping ---
                const headers = jsonData[0].map(h => h.toString().toLowerCase().trim().replace(/\s+/g, ' ')); // Normalize headers
                const requiredHeaders = ['sector', 'nombre comercial', 'nombre personal', 'telefono', 'cep'];
                const optionalHeaders = ['coordenadas', 'x', 'y'];
                const headerMap = {};
                const missingHeaders = [];

                requiredHeaders.forEach(rh => {
                    const foundIndex = headers.findIndex(h => h === rh);
                    if (foundIndex !== -1) {
                        headerMap[rh] = foundIndex;
                    } else {
                        missingHeaders.push(rh);
                    }
                });

                if (missingHeaders.length > 0) {
                    throw new Error(`Faltan las columnas requeridas: ${missingHeaders.join(', ')}`);
                }

                optionalHeaders.forEach(oh => {
                    const foundIndex = headers.findIndex(h => h === oh);
                    if (foundIndex !== -1) {
                        headerMap[oh] = foundIndex;
                    }
                });
                // --- End Header Mapping ---

                _clientesParaImportar = jsonData.slice(1).map((row, rowIndex) => {
                    let coordenadas = '';
                    // Prioritize 'coordenadas' column
                    if (headerMap['coordenadas'] !== undefined && row[headerMap['coordenadas']]) {
                        coordenadas = row[headerMap['coordenadas']].toString().trim();
                    } else if (headerMap['x'] !== undefined && headerMap['y'] !== undefined) {
                        // Use X, Y only if 'coordenadas' is missing or empty
                        const yLat = row[headerMap['y']]?.toString().trim(); // Latitude first
                        const xLon = row[headerMap['x']]?.toString().trim(); // Longitude second
                        if (yLat && xLon) {
                            coordenadas = `${yLat}, ${xLon}`; // Standard Lat, Lon format
                        }
                    }

                    // Validate coordinates format (simple check)
                    if (coordenadas && !/^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/.test(coordenadas)) {
                         console.warn(`Formato de coordenadas inválido en fila ${rowIndex + 2}: "${coordenadas}". Se guardará como está pero podría no funcionar en mapas.`);
                         // Keep the potentially invalid string for now
                    }

                    const saldoVaciosInicial = {};
                    TIPOS_VACIO.forEach(tipo => saldoVaciosInicial[tipo] = 0); // Initialize all types to 0

                    const codigoCEPValue = (row[headerMap['cep']] || '').toString().trim() || 'N/A'; // Default to N/A if empty

                    const cliente = {
                        // Get values safely using headerMap indices, trim and uppercase
                        sector: (row[headerMap['sector']] || '').toString().trim().toUpperCase(),
                        nombreComercial: (row[headerMap['nombre comercial']] || '').toString().trim().toUpperCase(),
                        nombrePersonal: (row[headerMap['nombre personal']] || '').toString().trim().toUpperCase(),
                        telefono: (row[headerMap['telefono']] || '').toString().trim(),
                        codigoCEP: codigoCEPValue,
                        coordenadas: coordenadas,
                        saldoVacios: saldoVaciosInicial // Initialize saldoVacios
                    };

                    // Basic validation: require at least nombreComercial or nombrePersonal
                    if (!cliente.nombreComercial && !cliente.nombrePersonal) {
                         console.warn(`Cliente en fila ${rowIndex + 2} omitido por faltar Nombre Comercial y Personal.`);
                         return null; // Mark for filtering
                    }
                    return cliente;

                }).filter(c => c !== null); // Filter out invalid rows

                renderPreviewTable(_clientesParaImportar);

            } catch (error) {
                console.error("Error processing Excel file:", error);
                _showModal('Error al Leer Archivo', `No se pudo procesar el archivo Excel: ${error.message}`);
                event.target.value = ''; // Clear file input on error
                if (previewContainer) previewContainer.innerHTML = `<p class="text-center text-red-500 p-4">Error al procesar el archivo.</p>`;
            }
        };
        reader.onerror = function(e) {
             _showModal('Error', 'No se pudo leer el archivo seleccionado.');
             event.target.value = ''; // Clear file input
             if (previewContainer) previewContainer.innerHTML = '';
        };
        // Use readAsArrayBuffer for better compatibility
        reader.readAsArrayBuffer(file);
    }


    /**
     * Muestra una tabla de vista previa con los datos del Excel.
     */
    function renderPreviewTable(clientes) {
        const container = document.getElementById('preview-container');
        const actionsContainer = document.getElementById('import-actions');
        const backButton = document.getElementById('backToAdvancedFunctionsBtn');
        const confirmBtn = document.getElementById('confirmImportBtn');

        if (!container || !actionsContainer || !backButton || !confirmBtn) {
             console.error("renderPreviewTable: Missing required container elements.");
             return;
        }

        if (!Array.isArray(clientes)) { // Basic type check
             console.error("renderPreviewTable: Invalid data provided (not an array).");
             container.innerHTML = `<p class="text-center text-red-500 p-4">Error: Datos de vista previa inválidos.</p>`;
             actionsContainer.classList.add('hidden');
             confirmBtn.disabled = true;
             backButton.classList.remove('hidden');
             return;
        }

        if (clientes.length === 0) {
            container.innerHTML = `<p class="text-center text-gray-500 p-4">No se encontraron clientes válidos para importar en el archivo.</p>`;
            actionsContainer.classList.add('hidden');
            confirmBtn.disabled = true;
            backButton.classList.remove('hidden'); // Show back button if preview is empty
            return;
        }

        let tableHTML = `<h3 class="font-bold text-lg mb-2 px-4 py-2">Vista Previa (${clientes.length} clientes a importar)</h3>
            <div class="overflow-auto"> {/* Wrapper for horizontal scroll if needed */}
            <table class="min-w-full bg-white text-xs"> {/* Smaller text */}
                <thead class="bg-gray-200 sticky top-0 z-10"><tr>
                    <th class="py-2 px-3 text-left whitespace-nowrap">Sector</th>
                    <th class="py-2 px-3 text-left whitespace-nowrap">N. Comercial</th>
                    <th class="py-2 px-3 text-left whitespace-nowrap">N. Personal</th>
                    <th class="py-2 px-3 text-left whitespace-nowrap">Teléfono</th>
                    <th class="py-2 px-3 text-left whitespace-nowrap">CEP</th>
                    <th class="py-2 px-3 text-left whitespace-nowrap">Coordenadas</th>
                </tr></thead><tbody>`;

        clientes.forEach(c => {
            // Basic HTML escaping for display (replace < and >)
            const escape = (str) => str ? str.replace(/</g, "&lt;").replace(/>/g, "&gt;") : '';
            tableHTML += `<tr class="border-b">
                <td class="py-1 px-3 whitespace-nowrap">${escape(c.sector)}</td>
                <td class="py-1 px-3 whitespace-nowrap">${escape(c.nombreComercial)}</td>
                <td class="py-1 px-3 whitespace-nowrap">${escape(c.nombrePersonal)}</td>
                <td class="py-1 px-3 whitespace-nowrap">${escape(c.telefono)}</td>
                <td class="py-1 px-3 whitespace-nowrap">${escape(c.codigoCEP)}</td>
                <td class="py-1 px-3 whitespace-nowrap">${escape(c.coordenadas) || 'N/A'}</td>
            </tr>`;
        });
        tableHTML += '</tbody></table></div>';
        container.innerHTML = tableHTML;

        // Show action buttons, hide back button
        actionsContainer.classList.remove('hidden');
        confirmBtn.disabled = false; // Enable confirm button
        backButton.classList.add('hidden');

        // Ensure listeners are attached (or re-attached)
        confirmBtn.onclick = handleConfirmImport; // Assign function directly
        document.getElementById('cancelImportBtn').onclick = () => { // Assign function directly
             _clientesParaImportar = [];
             renderPreviewTable([]); // Clear preview
             const uploader = document.getElementById('excel-uploader');
             if(uploader) uploader.value = ''; // Clear file input
             actionsContainer.classList.add('hidden');
             confirmBtn.disabled = true;
             backButton.classList.remove('hidden');
             container.innerHTML = ''; // Clear preview container
        };
    }


    /**
     * Confirma y guarda los clientes y sectores importados en Firestore.
     */
    async function handleConfirmImport() {
        if (!Array.isArray(_clientesParaImportar) || _clientesParaImportar.length === 0) {
            _showModal('Error', 'No hay clientes válidos en la vista previa para importar.');
            return;
        }

        // Disable button immediately
        const confirmBtn = document.getElementById('confirmImportBtn');
        if (confirmBtn) confirmBtn.disabled = true;

        _showModal('Progreso', `Importando ${_clientesParaImportar.length} clientes... Verificando sectores.`);

        try {
            // --- Sector Handling ---
            const sectoresRef = _collection(_db, SECTORES_COLLECTION_PATH);
            const sectoresSnapshot = await _getDocs(sectoresRef);
            // Use a Map for efficient lookup of existing sectors (case-insensitive)
            const existingSectoresMap = new Map(sectoresSnapshot.docs.map(doc => [doc.data().name.toUpperCase(), true]));

            const newSectoresToCreate = new Set();
            _clientesParaImportar.forEach(c => {
                if (c.sector && !existingSectoresMap.has(c.sector)) { // Check against the map
                    newSectoresToCreate.add(c.sector); // Add the original case version
                }
            });

            // --- Batch Operations ---
            const MAX_OPS = 490; // Firestore batch limit safety margin
            let batch = _writeBatch(_db);
            let operations = 0;

            // Add new sectors first
            if (newSectoresToCreate.size > 0) {
                 _showModal('Progreso', `Creando ${newSectoresToCreate.size} nuevos sectores...`);
                 newSectoresToCreate.forEach(sectorName => {
                    if (operations >= MAX_OPS) {
                        await batch.commit();
                        batch = _writeBatch(_db);
                        operations = 0;
                    }
                    const newSectorRef = _doc(sectoresRef); // Let Firestore generate ID
                    batch.set(newSectorRef, { name: sectorName }); // Store with original casing
                    operations++;
                });
                await batch.commit(); // Commit remaining sector operations
                batch = _writeBatch(_db); // Start new batch for clients
                operations = 0;
                console.log(`${newSectoresToCreate.size} new sectors created.`);
            } else {
                 _showModal('Progreso', `Importando ${_clientesParaImportar.length} clientes... (No hay sectores nuevos)`);
            }

            // Add clients
            const clientesRef = _collection(_db, CLIENTES_COLLECTION_PATH);
            _clientesParaImportar.forEach(cliente => {
                if (operations >= MAX_OPS) {
                    await batch.commit();
                    batch = _writeBatch(_db);
                    operations = 0;
                }
                const newClienteRef = _doc(clientesRef); // Let Firestore generate ID
                // Ensure saldoVacios is initialized correctly
                const saldoVaciosInicial = {};
                TIPOS_VACIO.forEach(tipo => saldoVaciosInicial[tipo] = 0);
                cliente.saldoVacios = cliente.saldoVacios || saldoVaciosInicial; // Ensure it exists
                batch.set(newClienteRef, cliente);
                operations++;
            });

            // Commit remaining client operations
            if (operations > 0) {
                await batch.commit();
            }

            _showModal('Éxito', `Se han importado ${_clientesParaImportar.length} clientes y ${newSectoresToCreate.size} nuevos sectores correctamente.`);
            showFuncionesAvanzadasView(); // Go back after success

        } catch (error) {
            console.error("Error during Firestore import:", error);
            _showModal('Error de Importación', `Ocurrió un error al guardar en la base de datos: ${error.message}`);
            // Re-enable button on error
            if (confirmBtn) confirmBtn.disabled = false;
        } finally {
            _clientesParaImportar = []; // Clear cache regardless of outcome
        }
    }

    /**
     * Obtiene las coordenadas actuales usando Geolocation API.
     * @param {string} inputId - ID del input donde mostrar las coordenadas.
     */
    function getCurrentCoordinates(inputId) {
        const coordsInput = document.getElementById(inputId);
        if (!coordsInput) {
            console.error("getCurrentCoordinates: Input element not found:", inputId);
            return;
        }

        if (navigator.geolocation) {
            const originalPlaceholder = coordsInput.placeholder;
            coordsInput.placeholder = 'Obteniendo GPS...';
            coordsInput.disabled = true;

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const lat = position.coords.latitude;
                    const lon = position.coords.longitude;
                    // Format consistently with 6 decimal places
                    coordsInput.value = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
                    coordsInput.placeholder = originalPlaceholder;
                    coordsInput.disabled = false;
                },
                (error) => {
                    // Provide user-friendly error messages
                    let errorMsg = 'No se pudo obtener la ubicación.';
                    switch(error.code) {
                        case error.PERMISSION_DENIED:
                            errorMsg = "Permiso de ubicación denegado.";
                            break;
                        case error.POSITION_UNAVAILABLE:
                            errorMsg = "Información de ubicación no disponible.";
                            break;
                        case error.TIMEOUT:
                            errorMsg = "Se agotó el tiempo para obtener la ubicación.";
                            break;
                        default:
                            errorMsg = `Error desconocido (${error.code}): ${error.message}`;
                            break;
                    }
                    console.error("Geolocation error:", error);
                    _showModal('Error de Geolocalización', errorMsg);
                    coordsInput.placeholder = originalPlaceholder; // Restore placeholder
                    coordsInput.disabled = false;
                },
                { // Geolocation options
                    enableHighAccuracy: true, // Request more accurate position
                    timeout: 10000, // Wait up to 10 seconds
                    maximumAge: 0 // Don't use a cached position
                }
            );
        } else {
            _showModal('Geolocalización No Soportada', 'Tu navegador no soporta la obtención de ubicación GPS.');
            coordsInput.disabled = false; // Ensure input is enabled
        }
    }

    /**
     * Muestra la vista de agregar cliente.
     */
    function showAgregarClienteView() {
         _floatingControls?.classList.add('hidden');
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto max-w-lg"> {/* Consistent width */}
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl text-center">
                        <h2 class="text-2xl font-bold text-gray-800 mb-6">Agregar Cliente</h2>
                        <form id="clienteForm" class="space-y-4 text-left">
                            {/* Sector Dropdown with Add Button */}
                            <div>
                                <label for="sector" class="block text-gray-700 font-medium mb-1">Sector:</label> {/* Label size consistency */}
                                <div class="flex items-center space-x-2">
                                    <select id="sector" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required></select>
                                    {/* Updated: Button calls generic modal */}
                                    <button type="button" onclick="window.clientesModule.showValidatedAddItemModal('${SECTORES_COLLECTION_PATH}', 'Sector')" class="flex-shrink-0 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-xs" title="Agregar Sector">+</button>
                                </div>
                            </div>
                            {/* Nombre Comercial */}
                            <div>
                                <label for="nombreComercial" class="block text-gray-700 font-medium mb-1">Nombre Comercial:</label>
                                <input type="text" id="nombreComercial" class="w-full px-4 py-2 border rounded-lg" required>
                            </div>
                            {/* Nombre Personal */}
                            <div>
                                <label for="nombrePersonal" class="block text-gray-700 font-medium mb-1">Nombre Personal:</label>
                                <input type="text" id="nombrePersonal" class="w-full px-4 py-2 border rounded-lg" required>
                            </div>
                            {/* Teléfono */}
                            <div>
                                <label for="telefono" class="block text-gray-700 font-medium mb-1">Teléfono:</label>
                                <input type="tel" id="telefono" class="w-full px-4 py-2 border rounded-lg"> {/* Make optional? Check requirements */}
                            </div>
                            {/* Código CEP with N/A option */}
                            <div>
                                <label for="codigoCEP" class="block text-gray-700 font-medium mb-1">Código CEP:</label>
                                <div class="flex items-center">
                                    <input type="text" id="codigoCEP" class="w-full px-4 py-2 border rounded-lg" placeholder="Opcional">
                                    <input type="checkbox" id="cepNA" class="ml-4 h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500">
                                    <label for="cepNA" class="ml-2 text-sm text-gray-700">No Aplica</label> {/* Smaller label */}
                                </div>
                            </div>
                            {/* Coordenadas with GPS button */}
                            <div>
                                <label for="coordenadas" class="block text-gray-700 font-medium mb-1">Coordenadas (Lat, Lon):</label>
                                <div class="flex items-center space-x-2">
                                    <input type="text" id="coordenadas" class="w-full px-4 py-2 border rounded-lg" placeholder="Ej: 7.7639, -72.2250">
                                    <button type="button" id="getCoordsBtn" class="flex-shrink-0 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm">GPS</button>
                                </div>
                            </div>
                            {/* Submit and Back Buttons */}
                            <button type="submit" class="w-full px-6 py-3 bg-green-500 text-white font-semibold rounded-lg shadow-md hover:bg-green-600">Guardar Cliente</button>
                        </form>
                        <button id="backToClientesBtn" class="mt-4 w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver</button>
                    </div>
                </div>
            </div>
        `;
        // Populate sector dropdown using the dynamic path
        _populateDropdown(SECTORES_COLLECTION_PATH, 'sector', 'Sector');

        // CEP N/A Checkbox Logic
        const cepInput = document.getElementById('codigoCEP');
        const cepNACheckbox = document.getElementById('cepNA');
        if (cepInput && cepNACheckbox) {
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
            // Initial sync in case input starts with N/A (unlikely here, but good practice)
            if (cepInput.value.toUpperCase() === 'N/A') {
                cepNACheckbox.checked = true;
                cepInput.disabled = true;
            }
        }

        // Attach event listeners
        document.getElementById('clienteForm')?.addEventListener('submit', agregarCliente);
        document.getElementById('backToClientesBtn')?.addEventListener('click', showClientesSubMenu);
        // The Add Sector button now uses onclick in the HTML to call the shared modal function
        document.getElementById('getCoordsBtn')?.addEventListener('click', () => getCurrentCoordinates('coordenadas'));
    }

    /**
     * Handles adding a new client with duplicate checks.
     */
    async function agregarCliente(e) {
        e.preventDefault();
        const form = e.target;

        // Get and normalize form data
        const nombreComercial = form.nombreComercial.value.trim().toUpperCase();
        const nombrePersonal = form.nombrePersonal.value.trim().toUpperCase();
        const sector = form.sector.value.toUpperCase(); // Ensure sector is selected
        const telefono = form.telefono.value.trim();
        let codigoCEP = form.codigoCEP.value.trim().toUpperCase(); // Normalize CEP
        const coordenadas = form.coordenadas.value.trim();

        // Basic Validations
        if (!sector) {
            _showModal('Error', 'Debe seleccionar un sector.');
            form.sector.focus();
            return;
        }
        if (!nombreComercial && !nombrePersonal) {
             _showModal('Error', 'Debe ingresar al menos un Nombre (Comercial o Personal).');
             form.nombreComercial.focus();
             return;
        }
        // Default CEP to N/A if empty and checkbox isn't checked
        if (!codigoCEP && !form.cepNA.checked) {
            codigoCEP = 'N/A';
        }

        // Disable submit button during processing
        const submitButton = form.querySelector('button[type="submit"]');
        if (submitButton) submitButton.disabled = true;

        // --- Duplicate Check (More efficient) ---
        let duplicateFound = false;
        let duplicateReason = "";
        try {
            _showModal('Progreso', 'Verificando duplicados...'); // Show progress

            const clientesRef = _collection(_db, CLIENTES_COLLECTION_PATH);
            const checks = []; // Array to hold query promises

            // Check Nombre Comercial (only if provided)
            if (nombreComercial) {
                checks.push(getDocs(query(clientesRef, where("nombreComercial", "==", nombreComercial), limit(1))));
            }
            // Check Nombre Personal (only if provided)
            if (nombrePersonal) {
                 checks.push(getDocs(query(clientesRef, where("nombrePersonal", "==", nombrePersonal), limit(1))));
            }
            // Check Teléfono (only if provided)
            if (telefono) {
                checks.push(getDocs(query(clientesRef, where("telefono", "==", telefono), limit(1))));
            }
            // Check CEP (only if provided and not N/A)
            if (codigoCEP && codigoCEP !== 'N/A') {
                checks.push(getDocs(query(clientesRef, where("codigoCEP", "==", codigoCEP), limit(1))));
            }

            const results = await Promise.all(checks);
            const reasons = ['nombre comercial', 'nombre personal', 'teléfono', 'código CEP'].filter((_, i) => checks[i]); // Match reasons to actual checks performed

            for (let i = 0; i < results.length; i++) {
                if (!results[i].empty) {
                    duplicateFound = true;
                    duplicateReason = reasons[i];
                    break; // Stop checking on first duplicate found
                }
            }

        } catch (checkError) {
             console.error("Error checking for duplicates:", checkError);
             _showModal('Error', 'No se pudo verificar si el cliente ya existe. Intenta de nuevo.');
             if (submitButton) submitButton.disabled = false; // Re-enable button
             return; // Stop execution
        }
        // --- End Duplicate Check ---

        const guardar = async () => {
            const saldoVaciosInicial = {};
            TIPOS_VACIO.forEach(tipo => saldoVaciosInicial[tipo] = 0);

            const clienteData = {
                sector: sector,
                nombreComercial: nombreComercial,
                nombrePersonal: nombrePersonal,
                telefono: telefono,
                codigoCEP: codigoCEP, // Use normalized CEP
                coordenadas: coordenadas,
                saldoVacios: saldoVaciosInicial,
                // Add creation timestamp?
                // createdAt: Timestamp.fromDate(new Date())
            };
            try {
                _showModal('Progreso', 'Guardando cliente...'); // Update progress
                await _addDoc(_collection(_db, CLIENTES_COLLECTION_PATH), clienteData);
                _showModal('Éxito', 'Cliente agregado correctamente.');
                form.reset(); // Reset form fields
                // Manually reset CEP checkbox and input state
                const cepNACheckbox = document.getElementById('cepNA');
                if (cepNACheckbox) cepNACheckbox.checked = false;
                const cepInput = document.getElementById('codigoCEP');
                if (cepInput) cepInput.disabled = false;
                // Optionally navigate back or stay to add another
                // showClientesSubMenu();
            } catch (error) {
                console.error("Error al agregar cliente:", error);
                _showModal('Error', 'Hubo un error al guardar el cliente.');
            } finally {
                 // Ensure button is re-enabled even if modal flow is interrupted
                 if (submitButton) submitButton.disabled = false;
            }
        };

        // Handle duplicate found or proceed to save
        if (duplicateFound) {
            // Close the "Verificando..." modal before showing the confirmation
            const progressModal = document.getElementById('modalContainer');
            if (progressModal && progressModal.querySelector('h3')?.textContent.includes('Verificando')) {
                 progressModal.classList.add('hidden');
            }

            _showModal(
                'Posible Duplicado Encontrado',
                `Ya existe un cliente registrado con el mismo ${duplicateReason}. ¿Deseas agregarlo de todas formas?`,
                guardar, // Pass the save function
                'Sí, Agregar Igualmente',
                 () => { if (submitButton) submitButton.disabled = false; } // Re-enable button on cancel
            );
        } else {
            await guardar(); // No duplicate, proceed to save directly
        }
    }

    /**
     * Muestra la vista para ver/buscar clientes.
     */
    function showVerClientesView() {
         _floatingControls?.classList.add('hidden');
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto"> {/* Removed max-w-lg for potentially wider table */}
                    <div class="bg-white/90 backdrop-blur-sm p-6 md:p-8 rounded-lg shadow-xl"> {/* Adjusted padding */}
                        <h2 class="text-2xl font-bold text-gray-800 mb-6 text-center">Lista de Clientes</h2>
                        ${getFiltrosHTML()} {/* Reusable filters */}
                        <div class="text-xs text-gray-600 mb-2 p-2 bg-yellow-100 border border-yellow-300 rounded-lg"> {/* Smaller text */}
                            <span class="font-bold">Nota:</span> Las filas resaltadas (<span class="bg-yellow-200 px-1">amarillo</span>) y marcadas con '⚠️' indican datos incompletos (nombre, teléfono o coordenadas).
                        </div>
                        {/* Container for the table with horizontal scroll */}
                        <div id="clientesListContainer" class="overflow-x-auto max-h-[60vh] border rounded-lg"> {/* Adjusted max-h */}
                            <p class="text-gray-500 text-center p-4">Cargando clientes...</p>
                        </div>
                        <button id="backToClientesBtn" class="mt-6 w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver</button>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('backToClientesBtn').addEventListener('click', showClientesSubMenu);
        setupFiltros('clientesListContainer'); // Setup filters for this view

        const container = document.getElementById('clientesListContainer');
        const clientesRef = _collection(_db, CLIENTES_COLLECTION_PATH);

        // Clear previous listener if any before attaching a new one
        cleanupListeners(); // Make sure only one listener is active

        const unsubscribe = _onSnapshot(clientesRef, (snapshot) => {
            _clientesCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderClientesList('clientesListContainer', false); // Render the list (readOnly=false)
        }, (error) => {
            // Handle listener errors, ignoring permission denied during logout
            if (window.isLoggingOut && error.code === 'permission-denied') {
                console.log("Listener de clientes detenido por cierre de sesión.");
                return; // Suppress error during logout
            }
            console.error("Error en listener de clientes:", error);
            if (container) container.innerHTML = `<p class="text-red-500 text-center p-4">Error al cargar la lista de clientes en tiempo real.</p>`;
        });

        _activeListeners.push(unsubscribe); // Register the new listener
    }

    /**
     * Genera el HTML para los filtros de la lista de clientes.
     */
    function getFiltrosHTML() {
        // Assume _lastFilters holds the last used filter values if needed, otherwise start fresh
        return `
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 border rounded-lg bg-gray-50 items-end"> {/* Use items-end */}
                {/* Search Input spanning 2 cols on md */}
                <div class="md:col-span-2">
                    <label for="search-input" class="block text-xs font-medium text-gray-600 mb-1">Buscar (Nombre, CEP):</label>
                    <input type="text" id="search-input" placeholder="Buscar cliente..." class="w-full px-4 py-2 border rounded-lg text-sm">
                </div>
                {/* Sector Filter */}
                <div>
                    <label for="filter-sector" class="block text-xs font-medium text-gray-600 mb-1">Sector:</label>
                    <select id="filter-sector" class="w-full px-2 py-2 border rounded-lg text-sm bg-white"> {/* py-2 matches input */}
                        <option value="">Todos</option>
                        {/* Options populated by setupFiltros */}
                    </select>
                </div>
                 {/* Incomplete Filter Checkbox spanning 2 cols */}
                 <div class="md:col-span-2 flex items-center pt-2"> {/* Added pt-2 */}
                    <input type="checkbox" id="filter-incompletos" class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500">
                    <label for="filter-incompletos" class="ml-2 block text-sm text-gray-900">Mostrar solo incompletos (⚠️)</label>
                </div>
                {/* Clear Button */}
                <div>
                     {/* Button now aligned with bottom of inputs */}
                    <button id="clear-filters-btn" class="w-full bg-gray-300 text-sm font-semibold rounded-lg py-2 px-4 hover:bg-gray-400">Limpiar Filtros</button>
                </div>
            </div>
        `;
    }

    /**
     * Configura los listeners y la lógica para los filtros de la lista de clientes.
     */
    function setupFiltros(containerId) {
        // Populate Sector dropdown using the correct public path
        _populateDropdown(SECTORES_COLLECTION_PATH, 'filter-sector', 'Sector');

        // Get filter elements
        const searchInput = document.getElementById('search-input');
        const sectorFilter = document.getElementById('filter-sector');
        const incompletosFilter = document.getElementById('filter-incompletos');
        const clearBtn = document.getElementById('clear-filters-btn');

        // Function to apply filters and re-render the list
        const applyFilters = () => renderClientesList(containerId, false); // Assuming readOnly is false here

        // Attach listeners
        searchInput?.addEventListener('input', applyFilters);
        sectorFilter?.addEventListener('change', applyFilters);
        incompletosFilter?.addEventListener('change', applyFilters);

        // Clear button listener
        clearBtn?.addEventListener('click', () => {
            if(searchInput) searchInput.value = '';
            if(sectorFilter) sectorFilter.value = '';
            if(incompletosFilter) incompletosFilter.checked = false;
            applyFilters(); // Re-render with cleared filters
        });
    }

    /**
     * Renderiza la tabla de clientes filtrada.
     * @param {string} elementId - ID del contenedor de la tabla.
     * @param {boolean} [readOnly=false] - Si es true, oculta los botones de acción.
     * @param {string|null} [externalSearchTerm=null] - Término de búsqueda opcional pasado externamente.
     */
    function renderClientesList(elementId, readOnly = false, externalSearchTerm = null) {
        const container = document.getElementById(elementId);
        if (!container) {
            console.error("renderClientesList: Container not found:", elementId);
            return;
        }

        // Get filter values safely
        const searchInput = document.getElementById('search-input');
        const sectorFilter = document.getElementById('filter-sector');
        const incompletosFilter = document.getElementById('filter-incompletos');

        const searchTerm = externalSearchTerm !== null ? externalSearchTerm.toLowerCase() : (searchInput?.value.toLowerCase() || '');
        const selectedSector = sectorFilter?.value || '';
        const showIncompleteOnly = incompletosFilter?.checked || false;

        const filteredClients = _clientesCache.filter(cliente => {
            // Basic check for essential data presence
            if (!cliente || !cliente.nombreComercial) return false;

            const searchMatch = !searchTerm ||
                cliente.nombreComercial.toLowerCase().includes(searchTerm) ||
                (cliente.nombrePersonal && cliente.nombrePersonal.toLowerCase().includes(searchTerm)) || // Check if exists
                (cliente.codigoCEP && cliente.codigoCEP.toLowerCase().includes(searchTerm)); // Check if exists

            const sectorMatch = !selectedSector || cliente.sector === selectedSector;

            // Check for completeness (require name, phone, coords)
            const isComplete = cliente.nombreComercial && // Already checked but good practice
                               cliente.nombrePersonal &&
                               cliente.telefono &&
                               cliente.coordenadas; // Check specifically for coordinates
            const incompletosMatch = !showIncompleteOnly || (showIncompleteOnly && !isComplete);

            return searchMatch && sectorMatch && incompletosMatch;
        });

        // Sort results alphabetically by Nombre Comercial
        filteredClients.sort((a, b) => a.nombreComercial.localeCompare(b.nombreComercial));

        if (filteredClients.length === 0) {
            container.innerHTML = `<p class="text-gray-500 text-center p-4">No se encontraron clientes que coincidan con los filtros.</p>`;
            return;
        }

        // Build table header
        let tableHTML = `
            <table class="min-w-full bg-white text-xs border-collapse"> {/* Smaller text, border-collapse */}
                <thead class="bg-gray-200 sticky top-0 z-10">
                    <tr>
                        <th class="py-2 px-3 border-b text-left whitespace-nowrap">N. Comercial</th>
                        <th class="py-2 px-3 border-b text-left whitespace-nowrap">N. Personal</th>
                        <th class="py-2 px-3 border-b text-left whitespace-nowrap">Teléfono</th>
                        <th class="py-2 px-3 border-b text-left whitespace-nowrap">Sector</th> {/* Added Sector */}
                        <th class="py-2 px-3 border-b text-left whitespace-nowrap">CEP</th> {/* Added CEP */}
                        ${!readOnly ? `<th class="py-2 px-3 border-b text-center whitespace-nowrap">Acciones</th>` : ''}
                    </tr>
                </thead>
                <tbody>
        `;

        // Build table body
        filteredClients.forEach(cliente => {
            // Re-check completeness for styling
            const isComplete = cliente.nombrePersonal && cliente.telefono && cliente.coordenadas;
            const rowClass = isComplete ? 'hover:bg-gray-50' : 'bg-yellow-100 hover:bg-yellow-200';
            const completenessIcon = isComplete
                ? ''
                : '<span title="Datos incompletos (Falta N. Personal, Teléfono o Coordenadas)" class="text-yellow-600 ml-1">⚠️</span>'; // Adjusted color

            // Map button (only if coordinates exist)
            let mapButtonHTML = '';
            if (cliente.coordenadas && /^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/.test(cliente.coordenadas)) { // Validate format before creating link
                 const urlCoords = encodeURIComponent(cliente.coordenadas);
                 // Smaller map button
                 mapButtonHTML = `<a href="https://www.google.com/maps?q=${urlCoords}" target="_blank" class="px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600" title="Ver en Mapa">🗺️</a>`;
            }

            tableHTML += `
                <tr class="${rowClass}">
                    <td class="py-1 px-3 border-b whitespace-nowrap font-medium">${cliente.nombreComercial}${completenessIcon}</td>
                    <td class="py-1 px-3 border-b whitespace-nowrap">${cliente.nombrePersonal || '<span class="text-gray-400">N/A</span>'}</td>
                    <td class="py-1 px-3 border-b whitespace-nowrap">${cliente.telefono || '<span class="text-gray-400">N/A</span>'}</td>
                    <td class="py-1 px-3 border-b whitespace-nowrap">${cliente.sector || '<span class="text-gray-400">N/A</span>'}</td>
                    <td class="py-1 px-3 border-b whitespace-nowrap">${cliente.codigoCEP || '<span class="text-gray-400">N/A</span>'}</td>
                    ${!readOnly ? `
                    <td class="py-1 px-3 border-b text-center whitespace-nowrap">
                        <div class="flex items-center justify-center space-x-1"> {/* Flex container for buttons */}
                            ${mapButtonHTML}
                            <button onclick="window.clientesModule.editCliente('${cliente.id}')" class="px-2 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600" title="Editar">✏️</button>
                            <button onclick="window.clientesModule.deleteCliente('${cliente.id}')" class="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600" title="Eliminar">🗑️</button>
                        </div>
                    </td>` : ''}
                </tr>
            `;
        });
        tableHTML += `</tbody></table>`;
        container.innerHTML = tableHTML;
    }

    /**
     * Muestra el formulario para editar un cliente existente.
     */
    function editCliente(clienteId) {
        _floatingControls?.classList.add('hidden');
        const cliente = _clientesCache.find(c => c.id === clienteId);
        if (!cliente) {
            _showModal('Error', 'Cliente no encontrado en la caché local.');
            return;
        }

        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto max-w-lg"> {/* Consistent width */}
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl text-center">
                        <h2 class="text-2xl font-bold text-gray-800 mb-6">Editar Cliente</h2>
                        <form id="editClienteForm" class="space-y-4 text-left">
                            {/* Sector */}
                            <div>
                                <label for="editSector" class="block text-gray-700 font-medium mb-1">Sector:</label>
                                <select id="editSector" class="w-full px-4 py-2 border rounded-lg" required></select>
                            </div>
                            {/* Nombre Comercial */}
                            <div>
                                <label for="editNombreComercial" class="block text-gray-700 font-medium mb-1">Nombre Comercial:</label>
                                <input type="text" id="editNombreComercial" value="${cliente.nombreComercial || ''}" class="w-full px-4 py-2 border rounded-lg" required>
                            </div>
                            {/* Nombre Personal */}
                            <div>
                                <label for="editNombrePersonal" class="block text-gray-700 font-medium mb-1">Nombre Personal:</label>
                                <input type="text" id="editNombrePersonal" value="${cliente.nombrePersonal || ''}" class="w-full px-4 py-2 border rounded-lg" required>
                            </div>
                            {/* Teléfono */}
                            <div>
                                <label for="editTelefono" class="block text-gray-700 font-medium mb-1">Teléfono:</label>
                                <input type="tel" id="editTelefono" value="${cliente.telefono || ''}" class="w-full px-4 py-2 border rounded-lg"> {/* Optional? */}
                            </div>
                            {/* Código CEP */}
                            <div>
                                <label for="editCodigoCEP" class="block text-gray-700 font-medium mb-1">Código CEP:</label>
                                <div class="flex items-center">
                                    <input type="text" id="editCodigoCEP" value="${cliente.codigoCEP || ''}" class="w-full px-4 py-2 border rounded-lg">
                                    <input type="checkbox" id="editCepNA" class="ml-4 h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500">
                                    <label for="editCepNA" class="ml-2 text-sm text-gray-700">No Aplica</label>
                                </div>
                            </div>
                            {/* Coordenadas */}
                            <div>
                                <label for="editCoordenadas" class="block text-gray-700 font-medium mb-1">Coordenadas (Lat, Lon):</label>
                                <div class="flex items-center space-x-2">
                                    <input type="text" id="editCoordenadas" value="${cliente.coordenadas || ''}" class="w-full px-4 py-2 border rounded-lg" placeholder="Ej: 7.7639, -72.2250">
                                    <button type="button" id="getEditCoordsBtn" class="flex-shrink-0 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm">GPS</button>
                                </div>
                            </div>
                            {/* Buttons */}
                            <button type="submit" class="w-full px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg shadow-md hover:bg-blue-600">Guardar Cambios</button>
                        </form>
                        <button id="backToVerClientesBtn" class="mt-4 w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver a la Lista</button>
                    </div>
                </div>
            </div>
        `;
        // Populate sector dropdown, pre-selecting the client's current sector
        _populateDropdown(SECTORES_COLLECTION_PATH, 'editSector', 'Sector', cliente.sector);

        // CEP N/A Logic (similar to add view)
        const editCepInput = document.getElementById('editCodigoCEP');
        const editCepNACheckbox = document.getElementById('editCepNA');
        const syncEditCepState = () => { // Encapsulate logic
            if (editCepInput && editCepNACheckbox) { // Check elements exist
                const isNA = editCepInput.value.toUpperCase() === 'N/A';
                editCepNACheckbox.checked = isNA;
                editCepInput.disabled = isNA;
            }
        };
        editCepNACheckbox?.addEventListener('change', () => {
             if (!editCepInput) return;
            if (editCepNACheckbox.checked) {
                editCepInput.value = 'N/A';
                editCepInput.disabled = true;
            } else {
                // Only clear if it was N/A, otherwise keep existing value
                if (editCepInput.value.toUpperCase() === 'N/A') {
                    editCepInput.value = '';
                }
                editCepInput.disabled = false;
                editCepInput.focus();
            }
        });
        syncEditCepState(); // Initial sync

        // GPS Button
        document.getElementById('getEditCoordsBtn')?.addEventListener('click', () => getCurrentCoordinates('editCoordenadas'));

        // Form Submission
        document.getElementById('editClienteForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitButton = e.target.querySelector('button[type="submit"]');
            if(submitButton) submitButton.disabled = true; // Disable on submit

            let codigoCEPValue = document.getElementById('editCodigoCEP').value.trim().toUpperCase();
            if (!codigoCEPValue && !document.getElementById('editCepNA').checked) {
                codigoCEPValue = 'N/A'; // Default to N/A if empty and not explicitly N/A
            }

            // Ensure saldoVacios is preserved
            const saldoVaciosActual = cliente.saldoVacios || {};
            TIPOS_VACIO.forEach(tipo => { // Ensure all defined types exist
                if (saldoVaciosActual[tipo] === undefined) saldoVaciosActual[tipo] = 0;
            });


            const updatedData = {
                // Get updated values, trim and uppercase where needed
                sector: document.getElementById('editSector').value.toUpperCase(),
                nombreComercial: document.getElementById('editNombreComercial').value.trim().toUpperCase(),
                nombrePersonal: document.getElementById('editNombrePersonal').value.trim().toUpperCase(),
                telefono: document.getElementById('editTelefono').value.trim(),
                codigoCEP: codigoCEPValue,
                coordenadas: document.getElementById('editCoordenadas').value.trim(),
                saldoVacios: saldoVaciosActual // Preserve existing saldoVacios object
            };

            // Basic Validation
            if (!updatedData.sector) {
                 _showModal('Error', 'Debe seleccionar un sector.');
                 document.getElementById('editSector').focus();
                 if(submitButton) submitButton.disabled = false;
                 return;
            }
            if (!updatedData.nombreComercial && !updatedData.nombrePersonal) {
                 _showModal('Error', 'Debe ingresar al menos un Nombre.');
                 document.getElementById('editNombreComercial').focus();
                 if(submitButton) submitButton.disabled = false;
                 return;
            }


            try {
                _showModal('Progreso', 'Guardando cambios...');
                // Use setDoc with merge: true to update only provided fields + preserve others
                await _setDoc(_doc(_db, CLIENTES_COLLECTION_PATH, clienteId), updatedData, { merge: true });
                _showModal('Éxito', 'Cliente modificado exitosamente.');
                showVerClientesView(); // Go back to the list view
            } catch (error) {
                console.error("Error al modificar el cliente:", error);
                _showModal('Error', `Hubo un error al modificar el cliente: ${error.message}`);
                 if(submitButton) submitButton.disabled = false; // Re-enable on error
            }
        });
        document.getElementById('backToVerClientesBtn')?.addEventListener('click', showVerClientesView);
    };

    /**
     * Handles deleting a client after confirmation.
     */
    function deleteCliente(clienteId) {
        const cliente = _clientesCache.find(c => c.id === clienteId);
        const clienteName = cliente ? cliente.nombreComercial : `ID ${clienteId}`; // Use name if available

        _showModal(
            'Confirmar Eliminación',
            `¿Estás seguro de que deseas eliminar al cliente "${clienteName}" permanentemente? Esta acción no se puede deshacer.`,
            async () => { // onConfirm logic
                _showModal('Progreso', 'Eliminando cliente...');
                try {
                    await _deleteDoc(_doc(_db, CLIENTES_COLLECTION_PATH, clienteId));
                    _showModal('Éxito', `Cliente "${clienteName}" eliminado correctamente.`);
                    // The list will refresh automatically due to the onSnapshot listener in showVerClientesView
                    // No need to manually call showVerClientesView() here unless the listener fails
                } catch (error) {
                    console.error("Error al eliminar el cliente:", error);
                    _showModal('Error', `Hubo un error al eliminar el cliente: ${error.message}`);
                }
            },
            'Sí, Eliminar' // Confirm button text
        );
    };

    /**
     * Shows a modal for adding a new item (e.g., Sector) with validation against existing items.
     * Specific to collections with just a 'name' field.
     * @param {string} collectionPath - Firestore path (e.g., SECTORES_COLLECTION_PATH).
     * @param {string} itemName - Singular name (e.g., 'Sector').
     */
    function showValidatedAddItemModal(collectionPath, itemName) {
        // Use the global showModal for structure
        showModal(
            `Agregar Nuevo ${itemName}`,
            `<form id="validatedAddItemForm" class="space-y-4">
                <input type="text" id="validatedNewItemInput" placeholder="Nombre del ${itemName}" class="w-full px-4 py-2 border rounded-lg" required>
                <p id="validatedAddItemMessage" class="text-sm text-red-600 h-4"></p> {/* Message area */}
            </form>`,
            async () => { // onConfirm logic
                const input = document.getElementById('validatedNewItemInput');
                const messageP = document.getElementById('validatedAddItemMessage');
                const newName = input.value.trim();
                messageP.textContent = ''; // Clear message

                if (!newName) {
                    messageP.textContent = 'El nombre no puede estar vacío.';
                    input.focus();
                    return false; // Don't close
                }
                const newNameUpper = newName.toUpperCase(); // Normalize for comparison and storage

                try {
                    const collectionRef = _collection(_db, collectionPath);
                    // Check for duplicates (case-insensitive via normalized check)
                    const q = query(collectionRef, where("name", "==", newNameUpper)); // Query normalized name
                    const snapshot = await getDocs(q);

                    if (!snapshot.empty) {
                        messageP.textContent = `"${newName}" ya existe.`;
                        input.select();
                        return false; // Don't close
                    }

                    // Add the new item
                    await _addDoc(collectionRef, { name: newNameUpper }); // Save normalized name

                    // Success: show message, clear input, keep modal open
                    messageP.textContent = `¡"${newNameUpper}" agregado! Puedes agregar otro.`;
                    messageP.className = 'text-sm text-green-600 h-4'; // Success color
                    input.value = '';
                    input.focus();
                    setTimeout(() => { messageP.textContent = ''; messageP.className = 'text-sm text-red-600 h-4'; }, 3000); // Clear after delay

                    return false; // Keep modal open

                } catch (err) {
                    console.error(`Error adding ${itemName}:`, err);
                    messageP.textContent = `Error al guardar o verificar. Intenta de nuevo.`;
                    messageP.className = 'text-sm text-red-600 h-4';
                    return false; // Don't close
                }
            },
            'Agregar', // Confirm button text
             null, // No specific onCancel
             true // Use triggerConfirmLogic
        );
        // Focus input after modal renders
        setTimeout(() => document.getElementById('validatedNewItemInput')?.focus(), 50);
    }


    /**
     * Muestra la vista para gestionar los Sectores (añadir, editar, eliminar). (Admin only)
     */
    function showDatosMaestrosSectoresView() {
         if (_userRole !== 'admin') {
             _showModal("Acceso Denegado", "Solo administradores pueden gestionar sectores.");
             showFuncionesAvanzadasView();
             return;
         }
        _floatingControls?.classList.add('hidden');
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto max-w-2xl"> {/* Wider */}
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl">
                        <h2 class="text-2xl font-bold text-gray-800 mb-6 text-center">Gestionar Sectores</h2>
                        <p class="text-sm text-center text-gray-600 mb-4">Añade, edita o elimina sectores. Los cambios se aplicarán a los desplegables. Solo se pueden eliminar sectores que no estén asignados a ningún cliente.</p>
                        {/* Container for the list */}
                        <div id="sectores-list" class="space-y-2 max-h-96 overflow-y-auto border p-4 rounded-lg bg-gray-50 mb-6">
                             <p class="text-gray-500 text-center">Cargando sectores...</p>
                        </div>
                        {/* Buttons */}
                        <div class="flex flex-col sm:flex-row gap-4">
                             {/* Button calls generic validated modal */}
                            <button onclick="window.clientesModule.showValidatedAddItemModal('${SECTORES_COLLECTION_PATH}', 'Sector')" class="w-full px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg shadow-md hover:bg-blue-600">Agregar Nuevo Sector</button>
                            <button id="backToAdvancedFunctionsBtn" class="w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('backToAdvancedFunctionsBtn').addEventListener('click', showFuncionesAvanzadasView);
        renderSectoresParaGestion(); // Load and display the list
    }

    /**
     * Renderiza la lista de Sectores con botones de edición/eliminación.
     */
    function renderSectoresParaGestion() {
        const container = document.getElementById('sectores-list');
        if (!container) return;
        container.innerHTML = `<p class="text-gray-500 text-center text-sm p-2">Cargando...</p>`; // Loading state

        const collectionRef = _collection(_db, SECTORES_COLLECTION_PATH);

        // Clear previous listener before attaching a new one
        cleanupListeners(); // Assuming cleanupListeners handles this specific type or all

        const unsubscribe = _onSnapshot(collectionRef, (snapshot) => {
            // Sort sectors alphabetically by name
            const items = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

            if (items.length === 0) {
                container.innerHTML = `<p class="text-gray-500 text-center text-sm p-2">No hay sectores definidos.</p>`;
                return;
            }
            // Render list items with buttons
            container.innerHTML = items.map(item => `
                <div class="flex justify-between items-center bg-white p-2 rounded shadow-sm border border-gray-200">
                    <span class="text-gray-800 text-sm flex-grow mr-2">${item.name}</span>
                    <div class="flex-shrink-0 space-x-1"> {/* Button container */}
                        <button onclick="window.clientesModule.editSector('${item.id}', '${item.name}')" class="px-2 py-1 bg-yellow-500 text-white text-xs rounded hover:bg-yellow-600" title="Editar">✏️</button>
                        <button onclick="window.clientesModule.deleteSector('${item.id}', '${item.name}')" class="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600" title="Eliminar">🗑️</button>
                    </div>
                </div>
            `).join('');
        }, (error) => {
             // Handle listener errors
             if (!window.isLoggingOut || error.code !== 'permission-denied') {
                  console.error("Error en listener de sectores:", error);
                  container.innerHTML = `<p class="text-red-500 text-center text-sm p-2">Error al cargar sectores.</p>`;
             }
        });
        _activeListeners.push(unsubscribe); // Register the listener for cleanup
    }

    /**
     * Edita el nombre de un sector y actualiza los clientes asociados.
     */
    async function editSector(sectorId, currentName) {
        if (_userRole !== 'admin') return; // Admin check

        // Use prompt for simplicity, consider a modal for better UX
        const newNameRaw = prompt('Introduce el nuevo nombre para el sector:', currentName);
        if (!newNameRaw) return; // User cancelled

        const newName = newNameRaw.trim();
        if (!newName || newName.toUpperCase() === currentName.toUpperCase()) {
            _showModal('Aviso', 'No se ingresó un nombre nuevo o es igual al actual.');
            return; // No change needed
        }

        const nuevoNombreMayus = newName.toUpperCase(); // Normalize for comparison and storage

        _showModal('Progreso', 'Verificando y renombrando sector...');

        try {
            // Check if new name already exists
            const q = query(_collection(_db, SECTORES_COLLECTION_PATH), where("name", "==", nuevoNombreMayus));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty && querySnapshot.docs[0].id !== sectorId) { // Check if it's not the same doc
                _showModal('Error', `El sector "${nuevoNombreMayus}" ya existe.`);
                return;
            }

            // Update the sector document itself
            await _setDoc(_doc(_db, SECTORES_COLLECTION_PATH, sectorId), { name: nuevoNombreMayus });

            // Find clients using the old name and update them in batches
            _showModal('Progreso', 'Actualizando clientes asociados...');
            const clientesRef = _collection(_db, CLIENTES_COLLECTION_PATH);
            const clientesQuery = query(clientesRef, where("sector", "==", currentName)); // Find clients with the OLD name
            const clientesSnapshot = await getDocs(clientesQuery);

            let updatedClientCount = 0;
            if (!clientesSnapshot.empty) {
                const MAX_OPS = 490;
                let batch = _writeBatch(_db);
                let operations = 0;
                updatedClientCount = clientesSnapshot.size;

                clientesSnapshot.docs.forEach(doc => {
                    if (operations >= MAX_OPS) {
                        await batch.commit();
                        batch = _writeBatch(_db);
                        operations = 0;
                    }
                    batch.update(doc.ref, { sector: nuevoNombreMayus }); // Update client's sector field
                    operations++;
                });
                if (operations > 0) {
                    await batch.commit();
                }
            }

            _showModal('Éxito', `Sector renombrado a "${nuevoNombreMayus}". Se actualizaron ${updatedClientCount} cliente(s).`);
            // The list will update automatically via the onSnapshot listener

        } catch (error) {
            console.error("Error al renombrar sector:", error);
            _showModal('Error', `Ocurrió un error al renombrar el sector: ${error.message}`);
        }
    }


    /**
     * Elimina un sector si no está en uso por ningún cliente.
     */
    async function deleteSector(sectorId, sectorName) {
        if (_userRole !== 'admin') return; // Admin check

        _showModal('Progreso', `Verificando si el sector "${sectorName}" está en uso...`);

        try {
            // Check usage in clients collection
            const clientesRef = _collection(_db, CLIENTES_COLLECTION_PATH);
            const q = query(clientesRef, where("sector", "==", sectorName), limit(1)); // Limit 1 is enough to check usage
            const usageSnapshot = await getDocs(q);

            if (!usageSnapshot.empty) {
                // If used, show error and stop
                _showModal('Error al Eliminar', `No se puede eliminar el sector "${sectorName}" porque está asignado a ${usageSnapshot.size > 1 ? 'varios clientes' : 'al menos un cliente'}. Reasigna esos clientes a otro sector primero.`);
                return;
            }

            // Not in use, proceed with confirmation
            _showModal(
                'Confirmar Eliminación',
                `¿Estás seguro de que deseas eliminar el sector "${sectorName}"? Esta acción no se puede deshacer.`,
                async () => { // onConfirm logic
                    _showModal('Progreso', `Eliminando sector "${sectorName}"...`);
                    try {
                        await _deleteDoc(_doc(_db, SECTORES_COLLECTION_PATH, sectorId));
                        _showModal('Éxito', `El sector "${sectorName}" ha sido eliminado.`);
                        // List will update via listener
                    } catch (deleteError) {
                        console.error("Error deleting sector:", deleteError);
                        _showModal('Error', `Hubo un error al eliminar el sector: ${deleteError.message}`);
                    }
                },
                'Sí, Eliminar' // Confirm button text
            );

        } catch (error) {
            console.error("Error checking sector usage:", error);
            _showModal('Error', `Ocurrió un error al verificar el uso del sector: ${error.message}`);
        }
    }


    /**
     * Maneja la eliminación de TODOS los clientes (Admin only).
     */
    async function handleDeleteAllClientes() {
        if (_userRole !== 'admin') {
             _showModal("Acceso Denegado", "Solo administradores pueden eliminar todos los clientes.");
             return;
        }

        _showModal(
            'Confirmación Extrema - Eliminar Clientes',
            `<p class="text-red-600 font-bold">¡ADVERTENCIA MAYOR!</p>
             <p>¿Estás ABSOLUTAMENTE SEGURO de que quieres eliminar TODOS los clientes de la base de datos pública?</p>
             <p class="mt-2">Esta acción es irreversible y afectará a todos los usuarios.</p>`,
            async () => { // onConfirm logic
                _showModal('Progreso', 'Eliminando todos los clientes... (Puede tardar)');
                try {
                    const collectionRef = _collection(_db, CLIENTES_COLLECTION_PATH);
                    const snapshot = await _getDocs(collectionRef);

                    if (snapshot.empty) {
                        _showModal('Aviso', 'No hay clientes para eliminar.');
                        return true; // Indicate success as there's nothing to do
                    }

                    // Delete in batches
                    const MAX_OPS = 490;
                    let batch = _writeBatch(_db);
                    let operations = 0;
                    let deletedCount = 0;

                    snapshot.docs.forEach(doc => {
                        if (operations >= MAX_OPS) {
                            await batch.commit();
                            batch = _writeBatch(_db);
                            operations = 0;
                        }
                        batch.delete(doc.ref);
                        operations++;
                        deletedCount++;
                    });

                    // Commit the final batch
                    if (operations > 0) {
                        await batch.commit();
                    }

                    _showModal('Éxito', `Se han eliminado ${deletedCount} clientes.`);
                    return true; // Indicate success

                } catch (error) {
                    console.error("Error al eliminar todos los clientes:", error);
                    _showModal('Error', `Hubo un error al eliminar los clientes: ${error.message}`);
                    return false; // Indicate failure
                }
            },
            'Sí, Eliminar TODOS los Clientes', // Confirm text
            null, // No specific onCancel
            true // Use triggerConfirmLogic
        );
    }


    // --- Lógica de Saldos de Vacíos ---

    /**
     * Muestra la vista para consultar saldos de vacíos.
     */
    function showSaldosVaciosView() {
        _floatingControls?.classList.add('hidden');
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto max-w-3xl"> {/* Wider for more columns */}
                    <div class="bg-white/90 backdrop-blur-sm p-6 md:p-8 rounded-lg shadow-xl">
                        <h2 class="text-2xl font-bold text-gray-800 mb-6 text-center">Saldos de Envases Retornables (Vacíos)</h2>
                        <input type="text" id="saldo-search-input" placeholder="Buscar cliente por Nombre Comercial..." class="w-full px-4 py-2 border rounded-lg mb-4 text-sm">
                        {/* Table container */}
                        <div id="saldosListContainer" class="overflow-x-auto max-h-[60vh] border rounded-lg">
                            <p class="text-gray-500 text-center p-4">Cargando saldos...</p>
                        </div>
                        <button id="backToClientesBtn" class="mt-6 w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver</button>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('backToClientesBtn').addEventListener('click', showClientesSubMenu);
        document.getElementById('saldo-search-input')?.addEventListener('input', renderSaldosList); // Add listener

        const container = document.getElementById('saldosListContainer');
        const clientesRef = _collection(_db, CLIENTES_COLLECTION_PATH);

        // Clear previous listener
        cleanupListeners();

        const unsubscribe = _onSnapshot(clientesRef, (snapshot) => {
            _clientesCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderSaldosList(); // Initial render or update on change
        }, (error) => {
            // Handle listener errors
            if (!window.isLoggingOut || error.code !== 'permission-denied') {
                console.error("Error en listener de saldos (clientes):", error);
                if (container) container.innerHTML = `<p class="text-red-500 text-center p-4">Error al cargar saldos.</p>`;
            }
        });
        _activeListeners.push(unsubscribe); // Register listener
    }

    /**
     * Renderiza la tabla de saldos de vacíos.
     */
    function renderSaldosList() {
        const container = document.getElementById('saldosListContainer');
        const searchInput = document.getElementById('saldo-search-input');

        if (!container) return; // Exit if container doesn't exist

        const searchTerm = searchInput?.value.toLowerCase() || ''; // Get search term safely

        // Filter clients based on search term (Nombre Comercial)
        const filteredClients = _clientesCache.filter(c =>
            c.nombreComercial && c.nombreComercial.toLowerCase().includes(searchTerm)
        );

        // Sort by Nombre Comercial
        filteredClients.sort((a,b)=> (a.nombreComercial || '').localeCompare(b.nombreComercial || ''));

        if (filteredClients.length === 0) {
            container.innerHTML = `<p class="text-center text-gray-500 p-4">No se encontraron clientes${searchTerm ? ' que coincidan con la búsqueda' : ''}.</p>`;
            return;
        }

        // Build Table Header Dynamically based on TIPOS_VACIO
        let headerHTML = `<tr><th class="py-2 px-3 border-b text-left sticky left-0 bg-gray-200 z-10">Cliente</th>`; // Sticky client name
        TIPOS_VACIO.forEach(tipo => {
            headerHTML += `<th class="py-2 px-3 border-b text-center whitespace-nowrap">${tipo}</th>`;
        });
        headerHTML += `<th class="py-2 px-3 border-b text-center sticky right-0 bg-gray-200 z-10">Acciones</th></tr>`; // Sticky actions

        // Build Table Body
        let bodyHTML = '';
        filteredClients.forEach(cliente => {
            const saldoVacios = cliente.saldoVacios || {};
            // Highlight row if any saldo is not zero
            const hasSaldo = TIPOS_VACIO.some(tipo => (saldoVacios[tipo] || 0) !== 0);
            const rowClass = hasSaldo ? 'bg-orange-50 hover:bg-orange-100' : 'hover:bg-gray-50'; // Highlight non-zero balances

            bodyHTML += `<tr class="${rowClass}">`;
            bodyHTML += `<td class="py-1 px-3 border-b sticky left-0 ${hasSaldo ? 'bg-orange-50' : 'bg-white'} z-[9]">${cliente.nombreComercial}</td>`; // Sticky client name with background match

            TIPOS_VACIO.forEach(tipo => {
                const saldoTipo = saldoVacios[tipo] || 0;
                // Add color based on saldo value
                const saldoClass = saldoTipo > 0 ? 'text-red-600 font-bold' : (saldoTipo < 0 ? 'text-green-600 font-bold' : 'text-gray-500');
                bodyHTML += `<td class="py-1 px-3 border-b text-center ${saldoClass}">${saldoTipo}</td>`;
            });

            bodyHTML += `<td class="py-1 px-3 border-b text-center sticky right-0 ${hasSaldo ? 'bg-orange-50' : 'bg-white'} z-[9]"> {/* Sticky actions with background match */}
                            <button onclick="window.clientesModule.showSaldoDetalleModal('${cliente.id}')" class="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600">Ajustar</button>
                        </td>`;
            bodyHTML += `</tr>`;
        });

        // Combine and render
        container.innerHTML = `<table class="min-w-full bg-white text-xs border-collapse">
            <thead class="bg-gray-200 sticky top-0 z-20">${headerHTML}</thead>
            <tbody>${bodyHTML}</tbody>
        </table>`;
    }

    /**
     * Muestra el modal de detalle y ajuste de saldo para un cliente.
     */
    async function showSaldoDetalleModal(clienteId) {
        // Find client in cache first for speed
        const cliente = _clientesCache.find(c => c.id === clienteId);
        if (!cliente) {
             // Fallback: try fetching directly if not in cache (e.g., cache cleared)
             try {
                 const clienteDoc = await _getDoc(_doc(_db, CLIENTES_COLLECTION_PATH, clienteId));
                 if (!clienteDoc.exists()) {
                     _showModal('Error', 'No se encontró el cliente.');
                     return;
                 }
                 cliente = { id: clienteDoc.id, ...clienteDoc.data() }; // Use fetched data
             } catch (fetchError) {
                  _showModal('Error', 'No se pudo cargar la información del cliente.');
                  return;
             }
        }

        const saldoVacios = cliente.saldoVacios || {};
        let detalleHTML = '<p class="text-center text-gray-500 text-sm">Este cliente no tiene registro de saldos pendientes.</p>';

        // Check if there are any balances (even 0) recorded for defined types
        const tieneSaldosRegistrados = TIPOS_VACIO.some(tipo => saldoVacios[tipo] !== undefined);

        if (tieneSaldosRegistrados) {
            detalleHTML = '<ul class="space-y-1 text-sm">'; // Smaller text
            TIPOS_VACIO.forEach(tipo => {
                 const saldoTipo = saldoVacios[tipo] || 0; // Default to 0 if undefined
                 // Add color based on value
                 const saldoClass = saldoTipo > 0 ? 'text-red-600 font-bold' : (saldoTipo < 0 ? 'text-green-600 font-bold' : 'text-gray-700');
                 detalleHTML += `<li class="flex justify-between items-center py-1 border-b last:border-b-0">
                                    <span>${tipo}:</span>
                                    <span class="${saldoClass}">${saldoTipo}</span>
                                 </li>`;
            });
            detalleHTML += '</ul>';
        }

        // Options for adjustment dropdown
        let optionsHTML = '<option value="">Seleccione tipo...</option>';
        TIPOS_VACIO.forEach(tipo => {
            optionsHTML += `<option value="${tipo}">${tipo}</option>`;
        });

        const modalContent = `
            <h3 class="text-lg font-bold text-gray-800 mb-3">Saldo de Vacíos: ${cliente.nombreComercial}</h3>
            <div class="mb-5 border rounded-lg p-3 bg-gray-50">${detalleHTML}</div>
            <h4 class="text-md font-semibold mb-2 text-gray-700">Ajuste Manual de Saldo</h4>
            <div class="space-y-3 text-sm"> {/* Smaller text */}
                <div>
                    <label for="ajusteTipoVacio" class="block text-xs font-medium mb-1 text-gray-600">Tipo de Vacío:</label>
                    <select id="ajusteTipoVacio" class="w-full px-2 py-1.5 border rounded-lg">${optionsHTML}</select> {/* Adjusted padding */}
                </div>
                <div>
                    <label for="ajusteCantidad" class="block text-xs font-medium mb-1 text-gray-600">Cantidad de Cajas:</label>
                    <input type="number" id="ajusteCantidad" min="1" step="1" class="w-full px-2 py-1.5 border rounded-lg" placeholder="Ingrese número positivo"> {/* Added step */}
                </div>
                <div class="flex gap-3 pt-2"> {/* Adjusted gap and padding */}
                    <button id="ajusteDevolucionBtn" class="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs font-semibold disabled:opacity-50">Registrar Devolución (-)</button>
                    <button id="ajustePrestamoBtn" class="flex-1 px-4 py-2 bg-yellow-500 text-gray-800 rounded-lg hover:bg-yellow-600 text-xs font-semibold disabled:opacity-50">Registrar Préstamo (+)</button>
                </div>
                <p id="ajusteErrorMessage" class="text-xs text-red-600 h-3"></p> {/* Error message area */}
            </div>
        `;
        // Show modal without default confirm button
        _showModal('Detalle/Ajuste de Saldo', modalContent, null, '');

        // Add listeners to adjustment buttons
        document.getElementById('ajusteDevolucionBtn')?.addEventListener('click', () => {
             handleAjusteManualVacios(clienteId, 'devolucion');
        });
        document.getElementById('ajustePrestamoBtn')?.addEventListener('click', () => {
             handleAjusteManualVacios(clienteId, 'prestamo');
        });
    }

    /**
     * Handles the logic for manual adjustment of vacíos saldo.
     */
    async function handleAjusteManualVacios(clienteId, tipoAjuste) {
        const tipoVacioSelect = document.getElementById('ajusteTipoVacio');
        const cantidadInput = document.getElementById('ajusteCantidad');
        const errorMsgP = document.getElementById('ajusteErrorMessage');
        const devolucionBtn = document.getElementById('ajusteDevolucionBtn');
        const prestamoBtn = document.getElementById('ajustePrestamoBtn');

        if (!tipoVacioSelect || !cantidadInput || !errorMsgP || !devolucionBtn || !prestamoBtn) {
             console.error("handleAjusteManualVacios: Missing elements in modal.");
             return;
        }

        const tipoVacio = tipoVacioSelect.value;
        const cantidadStr = cantidadInput.value.trim();
        const cantidad = parseInt(cantidadStr, 10);
        errorMsgP.textContent = ''; // Clear previous error

        // --- Input Validation ---
        if (!tipoVacio) {
            errorMsgP.textContent = 'Seleccione un tipo de vacío.';
            tipoVacioSelect.focus();
            return;
        }
        if (cantidadStr === '' || isNaN(cantidad) || !Number.isInteger(cantidad) || cantidad <= 0) {
            errorMsgP.textContent = 'Ingrese una cantidad válida (número entero positivo).';
            cantidadInput.focus();
            return;
        }
        // --- End Validation ---

        // Disable buttons during operation
        devolucionBtn.disabled = true;
        prestamoBtn.disabled = true;

        const clienteRef = _doc(_db, CLIENTES_COLLECTION_PATH, clienteId);
        _showModal('Progreso', 'Actualizando saldo...'); // Use progress modal

        try {
            await _runTransaction(_db, async (transaction) => {
                const clienteDoc = await transaction.get(clienteRef);
                if (!clienteDoc.exists()) {
                    throw new Error("El cliente ya no existe."); // Use Error object
                }

                const data = clienteDoc.data();
                // Initialize saldoVacios if it doesn't exist
                const saldoVacios = data.saldoVacios || {};
                // Initialize balance for the specific type if it doesn't exist
                const saldoActualTipo = saldoVacios[tipoVacio] || 0;

                let nuevoSaldo = saldoActualTipo;
                if (tipoAjuste === 'devolucion') {
                    nuevoSaldo -= cantidad; // Subtract for devolution
                } else { // prestamo
                    nuevoSaldo += cantidad; // Add for loan
                }

                saldoVacios[tipoVacio] = nuevoSaldo; // Update the balance for the specific type

                // Update the document in the transaction
                transaction.update(clienteRef, { saldoVacios: saldoVacios });
            });

            // Success: Close progress modal, show success, and refresh detail modal
            const progressModal = document.getElementById('modalContainer');
             if (progressModal && progressModal.querySelector('h3')?.textContent === 'Progreso') {
                 progressModal.classList.add('hidden');
             }
            _showModal('Éxito', 'El saldo de vacíos se ha actualizado correctamente.');
            // Refresh the detail modal to show the new balance
            showSaldoDetalleModal(clienteId);

        } catch (error) {
            console.error("Error en el ajuste manual de vacíos:", error);
             // Close progress modal before showing error
             const progressModal = document.getElementById('modalContainer');
             if (progressModal && progressModal.querySelector('h3')?.textContent === 'Progreso') {
                  progressModal.classList.add('hidden');
             }
            _showModal('Error', `No se pudo actualizar el saldo: ${error.message}`);
            // Re-enable buttons ONLY if the detail modal is still potentially open
            // (might have been closed by error modal)
            const currentModalTitle = document.querySelector('#modalContainer:not(.hidden) h3')?.textContent;
             if (currentModalTitle?.includes('Detalle/Ajuste de Saldo')) {
                devolucionBtn.disabled = false;
                prestamoBtn.disabled = false;
             }
        }
    }


    // Exponer funciones públicas al objeto window
    window.clientesModule = {
        editCliente,
        deleteCliente,
        editSector,     // Make sure these are needed globally
        deleteSector,   // Make sure these are needed globally
        showSaldoDetalleModal,
        showValidatedAddItemModal // Expose the generic add item modal
    };

})();
