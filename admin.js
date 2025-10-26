(function() {
    let _db, _userId, _userRole, _appId, _mainContent, _floatingControls, _showMainMenu, _showModal;
    let _collection, _getDocs, _doc, _setDoc, _getDoc, _writeBatch, _query, _where, _deleteDoc;
    // Import necessary Firestore functions for deletion helper
    let limit, startAfter;
    let _obsequioProductId = null;
    let _inventarioParaImportar = []; // Cache for inventory import data

    // Duplicated order map functions for independence within this module
    let _segmentoOrderCacheAdmin = null;
    let _rubroOrderCacheAdmin = null;

    window.initAdmin = function(dependencies) {
        if (!dependencies.db || !dependencies.mainContent || !dependencies.showMainMenu || !dependencies.showModal) {
            console.error("Admin Init Error: Missing critical dependencies (db, mainContent, showMainMenu, showModal)");
            return;
        }
        _db = dependencies.db;
        _userId = dependencies.userId; // Admin's user ID
        _userRole = dependencies.userRole;
        _appId = dependencies.appId;
        _mainContent = dependencies.mainContent;
        _floatingControls = dependencies.floatingControls;
        _showMainMenu = dependencies.showMainMenu;
        _showModal = dependencies.showModal;
        _collection = dependencies.collection;
        _getDocs = dependencies.getDocs;
        _doc = dependencies.doc;
        _getDoc = dependencies.getDoc;
        _setDoc = dependencies.setDoc;
        _writeBatch = dependencies.writeBatch;
        _query = dependencies.query;
        _where = dependencies.where;
        _deleteDoc = dependencies.deleteDoc;
        // Assign imported functions needed for deleteCollection
        limit = dependencies.limit;
        startAfter = dependencies.startAfter;
        if (!_floatingControls) {
            console.warn("Admin Init Warning: floatingControls element was not provided or found. Floating buttons might not function correctly.");
        }
        // Check if limit and startAfter are available
        if (typeof limit !== 'function' || typeof startAfter !== 'function') {
            console.error("CRITICAL Admin Init Error: Firestore 'limit' or 'startAfter' function not provided in dependencies.");
            // Optionally disable deep clean if dependencies are missing
            // You might want to hide the button or show an error if clicked
        }
    };

    window.showAdminOrProfileView = function() {
        if (_floatingControls) _floatingControls.classList.add('hidden');
        if (_userRole === 'admin') {
            showAdminSubMenuView();
        } else {
            showUserProfileView();
        }
    };

    function showAdminSubMenuView() {
        _floatingControls?.classList.add('hidden');
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto max-w-md">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl text-center">
                        <h1 class="text-3xl font-bold text-gray-800 mb-6">Panel de Administrador</h1>
                        <div class="space-y-4">
                            <button id="userManagementBtn" class="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700">Gestión de Usuarios</button>
                            <button id="obsequioConfigBtn" class="w-full px-6 py-3 bg-purple-600 text-white font-semibold rounded-lg shadow-md hover:bg-purple-700">Configurar Obsequio</button>
                            <button id="importExportInventarioBtn" class="w-full px-6 py-3 bg-teal-600 text-white font-semibold rounded-lg shadow-md hover:bg-teal-700">Importar/Exportar Inventario</button>
                            <button id="deepCleanBtn" class="w-full px-6 py-3 bg-red-700 text-white font-semibold rounded-lg shadow-md hover:bg-red-800">Limpieza Profunda</button> <!-- New Button -->
                            <button id="backToMenuBtn" class="w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver al Menú Principal</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('userManagementBtn').addEventListener('click', showUserManagementView);
        document.getElementById('obsequioConfigBtn').addEventListener('click', showObsequioConfigView);
        document.getElementById('importExportInventarioBtn').addEventListener('click', showImportExportInventarioView);
        document.getElementById('deepCleanBtn').addEventListener('click', showDeepCleanView); // New Listener
        document.getElementById('backToMenuBtn').addEventListener('click', _showMainMenu);
    }

    // --- Funciones para Limpieza Profunda ---

    function showDeepCleanView() {
        _floatingControls?.classList.add('hidden');
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto max-w-lg">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl">
                        <h1 class="text-3xl font-bold text-red-600 mb-4 text-center">⚠️ Limpieza Profunda ⚠️</h1>
                        <p class="text-center text-red-700 mb-6 font-semibold">
                            ¡ADVERTENCIA! Esta acción eliminará permanentemente los datos seleccionados de la base de datos.
                            Esto incluye datos privados y públicos. NO SE PUEDE DESHACER. Se recomienda descargar un respaldo.
                        </p>
                        <div class="space-y-4 text-left mb-6 border p-4 rounded-lg bg-gray-50">
                            <label class="flex items-center space-x-3">
                                <input type="checkbox" id="cleanInventario" class="h-5 w-5 rounded border-gray-300 text-red-600 focus:ring-red-500">
                                <span>Inventario y Categorías (Rubros, Segmentos, Marcas) del Admin</span>
                            </label>
                            <label class="flex items-center space-x-3">
                                <input type="checkbox" id="cleanClientes" class="h-5 w-5 rounded border-gray-300 text-red-600 focus:ring-red-500">
                                <span>Clientes y Sectores (Público)</span>
                            </label>
                            <label class="flex items-center space-x-3">
                                <input type="checkbox" id="cleanVentas" class="h-5 w-5 rounded border-gray-300 text-red-600 focus:ring-red-500">
                                <span>Ventas y Cierres (Privados del Admin y Públicos de Vendedores)</span>
                            </label>
                             <label class="flex items-center space-x-3">
                                <input type="checkbox" id="cleanObsequios" class="h-5 w-5 rounded border-gray-300 text-red-600 focus:ring-red-500">
                                <span>Config. y Registros de Obsequios (Privados y Públicos)</span>
                            </label>
                        </div>
                        <div class="mb-6">
                            <label for="confirmCleanText" class="block text-sm font-medium text-gray-700 mb-1">Para confirmar, escribe "BORRAR DATOS":</label>
                            <input type="text" id="confirmCleanText" class="w-full px-4 py-2 border border-red-300 rounded-lg focus:ring-red-500 focus:border-red-500" placeholder="BORRAR DATOS">
                        </div>
                        <div class="space-y-4">
                            <button id="executeCleanBtn" class="w-full px-6 py-3 bg-red-700 text-white font-semibold rounded-lg shadow-md hover:bg-red-800 disabled:opacity-50" disabled>Iniciar Limpieza...</button>
                            <button id="backToAdminMenuBtn" class="w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Cancelar y Volver</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const confirmInput = document.getElementById('confirmCleanText');
        const executeBtn = document.getElementById('executeCleanBtn');

        confirmInput.addEventListener('input', () => {
            executeBtn.disabled = confirmInput.value !== 'BORRAR DATOS';
        });

        // Modificado: Ahora llama a la función intermedia con respaldo
        document.getElementById('executeCleanBtn').addEventListener('click', handleBackupPromptBeforeClean);
        document.getElementById('backToAdminMenuBtn').addEventListener('click', showAdminSubMenuView);
    }

    // Nueva función intermedia para preguntar por respaldo
    function handleBackupPromptBeforeClean() {
        const confirmInput = document.getElementById('confirmCleanText');
        if (confirmInput.value !== 'BORRAR DATOS') {
            _showModal('Error', 'Debes escribir "BORRAR DATOS" para confirmar.');
            return;
        }

        const cleanInventario = document.getElementById('cleanInventario').checked;
        const cleanClientes = document.getElementById('cleanClientes').checked;
        const cleanVentas = document.getElementById('cleanVentas').checked;
        const cleanObsequios = document.getElementById('cleanObsequios').checked;

        if (!cleanInventario && !cleanClientes && !cleanVentas && !cleanObsequios) {
            _showModal('Aviso', 'No has seleccionado ninguna sección para limpiar.');
            return;
        }

        // Crear botones personalizados para el modal de respaldo
        const modalBackupContent = `
            <div class="text-center">
                <h3 class="text-xl font-bold text-gray-800 mb-4">Descargar Respaldo (Opcional)</h3>
                <p class="text-gray-600 mb-6">Antes de eliminar los datos seleccionados, ¿deseas descargar un archivo Excel de respaldo?</p>
                <div class="flex flex-col sm:flex-row justify-center gap-3 mt-6">
                    <button id="backupAndContinueBtn" class="w-full sm:w-auto px-5 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition duration-200">Descargar Respaldo y Continuar</button>
                    <button id="continueWithoutBackupBtn" class="w-full sm:w-auto px-5 py-2.5 bg-yellow-500 text-gray-800 rounded-lg hover:bg-yellow-600 transition duration-200">Continuar SIN Respaldo</button>
                    <button id="cancelCleanBtnModal" class="w-full sm:w-auto px-5 py-2.5 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition duration-200">Cancelar Limpieza</button>
                </div>
            </div>
        `;

        // Mostrar el modal sin los botones por defecto
        _showModal('Respaldo Opcional', modalBackupContent, null, '');

        // Añadir listeners a los botones personalizados del modal
        document.getElementById('backupAndContinueBtn').addEventListener('click', async () => {
            await handleBackupBeforeClean(); // Descarga el respaldo
            handleDeepCleanConfirmation(); // Luego muestra la confirmación final
        });

        document.getElementById('continueWithoutBackupBtn').addEventListener('click', () => {
            handleDeepCleanConfirmation(); // Muestra directamente la confirmación final
        });

        document.getElementById('cancelCleanBtnModal').addEventListener('click', () => {
            document.getElementById('modalContainer').classList.add('hidden'); // Cierra el modal
        });
    }

    // Nueva función para generar y descargar el respaldo
    async function handleBackupBeforeClean() {
        if (typeof XLSX === 'undefined') {
            _showModal('Error', 'La librería para exportar a Excel no está cargada.');
            return false; // Indica fallo
        }
        _showModal('Progreso', 'Generando archivo(s) de respaldo...');

        const cleanInventario = document.getElementById('cleanInventario').checked;
        const cleanClientes = document.getElementById('cleanClientes').checked;
        const cleanVentas = document.getElementById('cleanVentas').checked;
        const cleanObsequios = document.getElementById('cleanObsequios').checked;
        const publicProjectId = 'ventas-9a210';
        const today = new Date().toISOString().slice(0, 10);
        const wb = XLSX.utils.book_new();
        let sheetsAdded = 0;

        try {
            // Helper para obtener datos de una colección
            const fetchCollectionData = async (path) => {
                try {
                    const snapshot = await _getDocs(_collection(_db, path));
                    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                } catch (fetchError) {
                    console.error(`Error fetching backup data for ${path}:`, fetchError);
                    return []; // Devuelve array vacío si falla
                }
            };

            // Backup Inventario y Categorías
            if (cleanInventario) {
                const inventario = await fetchCollectionData(`artifacts/${_appId}/users/${_userId}/inventario`);
                const rubros = await fetchCollectionData(`artifacts/${_appId}/users/${_userId}/rubros`);
                const segmentos = await fetchCollectionData(`artifacts/${_appId}/users/${_userId}/segmentos`);
                const marcas = await fetchCollectionData(`artifacts/${_appId}/users/${_userId}/marcas`);
                if (inventario.length > 0) { XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(inventario), 'Inventario'); sheetsAdded++; }
                if (rubros.length > 0) { XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rubros), 'Rubros'); sheetsAdded++; }
                if (segmentos.length > 0) { XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(segmentos), 'Segmentos'); sheetsAdded++; }
                if (marcas.length > 0) { XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(marcas), 'Marcas'); sheetsAdded++; }
            }

            // Backup Clientes y Sectores
            if (cleanClientes) {
                const clientes = await fetchCollectionData(`artifacts/${publicProjectId}/public/data/clientes`);
                const sectores = await fetchCollectionData(`artifacts/${publicProjectId}/public/data/sectores`);
                if (clientes.length > 0) { XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(clientes), 'Clientes'); sheetsAdded++; }
                if (sectores.length > 0) { XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sectores), 'Sectores'); sheetsAdded++; }
            }

            // Backup Ventas y Cierres
            if (cleanVentas) {
                const ventasAdmin = await fetchCollectionData(`artifacts/${_appId}/users/${_userId}/ventas`);
                const cierresAdmin = await fetchCollectionData(`artifacts/${_appId}/users/${_userId}/cierres`);
                const cierresPublicos = await fetchCollectionData(`public_data/${_appId}/user_closings`);
                if (ventasAdmin.length > 0) { XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ventasAdmin), 'Ventas_Admin'); sheetsAdded++; }
                if (cierresAdmin.length > 0) { XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cierresAdmin), 'Cierres_Admin'); sheetsAdded++; }
                if (cierresPublicos.length > 0) { XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cierresPublicos), 'Cierres_Vendedores'); sheetsAdded++; }
            }

            // Backup Obsequios
            if (cleanObsequios) {
                const obsequiosAdmin = await fetchCollectionData(`artifacts/${_appId}/users/${_userId}/obsequios_entregados`);
                 // Backup config (son documentos únicos, leemos individualmente)
                 const adminObsequioConfigRef = _doc(_db, `artifacts/${_appId}/users/${_userId}/config/obsequio`);
                 const publicObsequioConfigRef = _doc(_db, `artifacts/${publicProjectId}/public/data/config/obsequio`);
                 const [adminConfigSnap, publicConfigSnap] = await Promise.allSettled([_getDoc(adminObsequioConfigRef), _getDoc(publicObsequioConfigRef)]);
                 const configs = [];
                 if(adminConfigSnap.status === 'fulfilled' && adminConfigSnap.value.exists()) configs.push({origen: 'admin', ...adminConfigSnap.value.data()});
                 if(publicConfigSnap.status === 'fulfilled' && publicConfigSnap.value.exists()) configs.push({origen: 'public', ...publicConfigSnap.value.data()});

                if (obsequiosAdmin.length > 0) { XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(obsequiosAdmin), 'Obsequios_Admin'); sheetsAdded++; }
                if (configs.length > 0) { XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(configs), 'Config_Obsequio'); sheetsAdded++; }
            }

            if (sheetsAdded > 0) {
                XLSX.writeFile(wb, `Respaldo_Limpieza_${today}.xlsx`);
                _showModal('Respaldo Descargado', `Se ha generado el archivo Excel "Respaldo_Limpieza_${today}.xlsx". Ahora puedes continuar con la limpieza.`, null, 'OK');
                 await new Promise(resolve => setTimeout(resolve, 1500)); // Pequeña pausa
                 return true; // Indica éxito
            } else {
                 _showModal('Aviso', 'No se encontraron datos en las secciones seleccionadas para respaldar.', null, 'OK');
                  await new Promise(resolve => setTimeout(resolve, 1500));
                 return true; // Considera éxito ya que no había nada que respaldar
            }

        } catch (error) {
            console.error("Error al generar respaldo:", error);
            _showModal('Error de Respaldo', `Ocurrió un error al generar el archivo: ${error.message}. No se procederá con la limpieza.`);
             await new Promise(resolve => setTimeout(resolve, 1500));
            return false; // Indica fallo
        } finally {
            // Cierra el modal de "Progreso" si aún está abierto
             const modalContainer = document.getElementById('modalContainer');
             const modalTitle = modalContainer?.querySelector('h3')?.textContent;
             if(modalContainer && !modalContainer.classList.contains('hidden') && modalTitle?.startsWith('Progreso')) {
                  modalContainer.classList.add('hidden');
             }
        }
    }

    // Muestra la confirmación final antes de borrar
    function handleDeepCleanConfirmation() {
         _showModal('Confirmación Final Extrema', `<p class="text-red-600 font-bold">¡ÚLTIMA ADVERTENCIA!</p> Vas a borrar permanentemente las secciones seleccionadas. ¿Estás absolutamente seguro?`, executeDeepClean, 'Sí, BORRAR DATOS');
    }

    // La lógica de borrado real
    async function executeDeepClean() {
        // (La lógica existente de handleDeepClean se mueve aquí)
        _showModal('Progreso', 'Iniciando limpieza profunda...');

        const cleanInventario = document.getElementById('cleanInventario').checked;
        const cleanClientes = document.getElementById('cleanClientes').checked;
        const cleanVentas = document.getElementById('cleanVentas').checked;
        const cleanObsequios = document.getElementById('cleanObsequios').checked;

        const collectionsToDelete = [];
        const publicProjectId = 'ventas-9a210'; // Hardcoded public ID

        // Admin private collections
        if (cleanInventario) {
            collectionsToDelete.push({ path: `artifacts/${_appId}/users/${_userId}/inventario`, name: 'Inventario Admin' });
            collectionsToDelete.push({ path: `artifacts/${_appId}/users/${_userId}/rubros`, name: 'Rubros Admin' });
            collectionsToDelete.push({ path: `artifacts/${_appId}/users/${_userId}/segmentos`, name: 'Segmentos Admin' });
            collectionsToDelete.push({ path: `artifacts/${_appId}/users/${_userId}/marcas`, name: 'Marcas Admin' });
        }
        if (cleanVentas) {
            collectionsToDelete.push({ path: `artifacts/${_appId}/users/${_userId}/ventas`, name: 'Ventas Admin' });
            collectionsToDelete.push({ path: `artifacts/${_appId}/users/${_userId}/cierres`, name: 'Cierres Admin' });
        }
         if (cleanObsequios) {
            collectionsToDelete.push({ path: `artifacts/${_appId}/users/${_userId}/obsequios_entregados`, name: 'Obsequios Admin' });
            // Also delete the specific config doc if it exists
            const adminObsequioConfigRef = _doc(_db, `artifacts/${_appId}/users/${_userId}/config/obsequio`);
            try { await _deleteDoc(adminObsequioConfigRef); console.log("Deleted admin obsequio config doc."); } catch(e) { console.warn("Could not delete admin obsequio config doc (might not exist):", e.code); }
         }

        // Public collections
         if (cleanClientes) {
            collectionsToDelete.push({ path: `artifacts/${publicProjectId}/public/data/clientes`, name: 'Clientes Públicos' });
            collectionsToDelete.push({ path: `artifacts/${publicProjectId}/public/data/sectores`, name: 'Sectores Públicos' });
        }
         if (cleanVentas) {
             collectionsToDelete.push({ path: `public_data/${_appId}/user_closings`, name: 'Cierres Vendedores Públicos' });
         }
         if (cleanObsequios) {
             // Delete the specific public config doc if it exists
            const publicObsequioConfigRef = _doc(_db, `artifacts/${publicProjectId}/public/data/config/obsequio`);
            try { await _deleteDoc(publicObsequioConfigRef); console.log("Deleted public obsequio config doc."); } catch(e) { console.warn("Could not delete public obsequio config doc (might not exist):", e.code); }
         }

        let errorsOccurred = false;
        let deletedCount = 0;

        for (const colInfo of collectionsToDelete) {
            _showModal('Progreso', `Eliminando ${colInfo.name}...`);
            try {
                // Check if dependencies for deleteCollection are available
                if (typeof limit !== 'function' || typeof startAfter !== 'function') {
                    throw new Error("Funciones 'limit' o 'startAfter' no disponibles para deleteCollection.");
                }
                const count = await deleteCollection(colInfo.path);
                console.log(`Deleted ${count} documents from ${colInfo.name} (${colInfo.path})`);
                deletedCount += count;
            } catch (error) {
                console.error(`Error deleting collection ${colInfo.name} (${colInfo.path}):`, error);
                errorsOccurred = true;
                 // Modify modal to not call showAdminSubMenuView on error, just close itself
                _showModal('Error Parcial', `Error al eliminar ${colInfo.name}: ${error.message}. Continuando...`, null, 'OK');
                await new Promise(resolve => setTimeout(resolve, 2000)); // Pause to show error
            }
        }

         // Invalidate local caches after deletion
         _rubroOrderCacheAdmin = null;
         _segmentoOrderCacheAdmin = null;
         if (window.inventarioModule) window.inventarioModule.invalidateSegmentOrderCache();
         if (window.catalogoModule) window.catalogoModule.invalidateCache();
         if (window.ventasModule) window.ventasModule.invalidateCache();
         // Client cache will repopulate on next load

        if (errorsOccurred) {
            _showModal('Limpieza Completada (con errores)', 'Se completó la limpieza, pero ocurrieron errores al eliminar algunas colecciones. Revisa la consola.', showAdminSubMenuView, 'OK');
        } else {
            _showModal('Limpieza Completada', `Se eliminaron ${deletedCount} documentos de las colecciones seleccionadas.`, showAdminSubMenuView, 'OK');
        }
    }


    /**
     * Helper function to delete all documents in a collection using batched writes.
     * Returns the number of documents deleted.
     */
    async function deleteCollection(collectionPath) {
        // Check again for dependencies just in case
        if (typeof limit !== 'function' || typeof startAfter !== 'function') {
            throw new Error("Funciones 'limit' o 'startAfter' no disponibles para deleteCollection.");
        }
        const batchSize = 400; // Firestore batch limit is 500 operations
        const collectionRef = _collection(_db, collectionPath);
        let queryCursor = _query(collectionRef, limit(batchSize));
        let deletedCount = 0;
        let lastVisible = null; // Initialize lastVisible

        while (true) {
            const snapshot = await _getDocs(queryCursor);
            if (snapshot.size === 0) {
                break; // No more documents to delete
            }

            const batch = _writeBatch(_db);
            snapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });

            await batch.commit();
            deletedCount += snapshot.size;

            // Get the last document *from the current snapshot* for the next query's startAfter
            lastVisible = snapshot.docs[snapshot.docs.length - 1];
            // Create the query for the next batch
            queryCursor = _query(collectionRef, startAfter(lastVisible), limit(batchSize));
        }
        console.log(`Finished deleting ${deletedCount} documents from ${collectionPath}`);
        return deletedCount;
    }


    // --- Funciones para Importar/Exportar Inventario (continuación) ---

    async function getRubroOrderMapAdmin() {
        if (_rubroOrderCacheAdmin) return _rubroOrderCacheAdmin;
        const map = {};
        const rubrosRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/rubros`); // Using admin's userId
        try {
            const snapshot = await _getDocs(rubrosRef);
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                map[data.name] = (data.orden !== undefined) ? data.orden : 9999;
            });
            _rubroOrderCacheAdmin = map;
            return map;
        } catch (e) { console.warn("No se pudo obtener el orden de los rubros en admin.js", e); return {}; }
    }

    async function getSegmentoOrderMapAdmin() {
        if (_segmentoOrderCacheAdmin) return _segmentoOrderCacheAdmin;
        const map = {};
        const segmentosRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/segmentos`); // Using admin's userId
        try {
            const snapshot = await _getDocs(segmentosRef);
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                map[data.name] = (data.orden !== undefined) ? data.orden : 9999;
            });
            _segmentoOrderCacheAdmin = map;
            return map;
        } catch (e) { console.warn("No se pudo obtener el orden de los segmentos en admin.js", e); return {}; }
    }

    function showImportExportInventarioView() {
        _floatingControls?.classList.add('hidden');
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto max-w-lg">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl">
                        <h1 class="text-3xl font-bold text-gray-800 mb-6 text-center">Importar / Exportar Inventario</h1>
                        <p class="text-center text-gray-600 mb-6 text-sm">
                            Exporta el inventario actual a Excel o importa un archivo para actualizar cantidades.
                            La importación solo actualizará la columna 'CantidadActualUnidades' de productos existentes.
                        </p>
                        <div class="space-y-4">
                            <button id="exportInventarioBtn" class="w-full px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg shadow-md hover:bg-blue-600">Exportar Inventario a Excel</button>
                            <button id="importInventarioBtn" class="w-full px-6 py-3 bg-green-500 text-white font-semibold rounded-lg shadow-md hover:bg-green-600">Importar Inventario desde Excel</button>
                            <button id="backToAdminMenuBtn" class="w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver al Panel Admin</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('exportInventarioBtn').addEventListener('click', handleExportInventario);
        document.getElementById('importInventarioBtn').addEventListener('click', showImportInventarioView);
        document.getElementById('backToAdminMenuBtn').addEventListener('click', showAdminSubMenuView);
    }

    async function handleExportInventario() {
        if (typeof XLSX === 'undefined') {
            _showModal('Error', 'La librería para exportar a Excel no está cargada.');
            return;
        }
        _showModal('Progreso', 'Generando archivo Excel del inventario...');

        try {
            const inventarioRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`); // Admin's inventory
            const snapshot = await _getDocs(inventarioRef);
            let inventario = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            const rubroOrderMap = await getRubroOrderMapAdmin();
            const segmentoOrderMap = await getSegmentoOrderMapAdmin();

            inventario.sort((a, b) => {
                const rubroOrderA = rubroOrderMap[a.rubro] ?? 9999;
                const rubroOrderB = rubroOrderMap[b.rubro] ?? 9999;
                if (rubroOrderA !== rubroOrderB) return rubroOrderA - rubroOrderB;

                const segmentoOrderA = segmentoOrderMap[a.segmento] ?? 9999;
                const segmentoOrderB = segmentoOrderMap[b.segmento] ?? 9999;
                if (segmentoOrderA !== segmentoOrderB) return segmentoOrderA - segmentoOrderB;

                const marcaComp = (a.marca || '').localeCompare(b.marca || '');
                if (marcaComp !== 0) return marcaComp;

                return (a.presentacion || '').localeCompare(b.presentacion || '');
            });

            const dataToExport = inventario.map(p => ({
                'Rubro': p.rubro || '',
                'Segmento': p.segmento || '',
                'Marca': p.marca || '',
                'Presentacion': p.presentacion || '',
                'CantidadActualUnidades': p.cantidadUnidades || 0,
                'VentaPorUnd': p.ventaPor?.und ? 'SI' : 'NO',
                'VentaPorPaq': p.ventaPor?.paq ? 'SI' : 'NO',
                'VentaPorCj': p.ventaPor?.cj ? 'SI' : 'NO',
                'UnidadesPorPaquete': p.unidadesPorPaquete || '',
                'UnidadesPorCaja': p.unidadesPorCaja || '',
                'PrecioUnd': p.precios?.und || '',
                'PrecioPaq': p.precios?.paq || '',
                'PrecioCj': p.precios?.cj || '',
                'ManejaVacios': p.manejaVacios ? 'SI' : 'NO',
                'TipoVacio': p.tipoVacio || '',
                'IVA': p.iva !== undefined ? `${p.iva}%` : '',
                // 'ID_Interno': p.id // Opcional: incluir ID para referencia
            }));

            const ws = XLSX.utils.json_to_sheet(dataToExport);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Inventario');

            const today = new Date().toISOString().slice(0, 10);
            XLSX.writeFile(wb, `Inventario_${today}.xlsx`);

            // Cerrar el modal de progreso
            const modalContainer = document.getElementById('modalContainer');
            if(modalContainer) modalContainer.classList.add('hidden');

        } catch (error) {
            console.error("Error al exportar inventario:", error);
            _showModal('Error', `Ocurrió un error al generar el archivo: ${error.message}`);
        }
    }

    function showImportInventarioView() {
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto max-w-4xl">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl">
                        <h2 class="text-2xl font-bold text-gray-800 mb-4 text-center">Importar Inventario desde Excel</h2>
                        <p class="text-center text-gray-600 mb-6 text-sm">
                            Selecciona un archivo .xlsx o .csv. Debe contener las columnas:
                            <strong>Rubro, Segmento, Marca, Presentacion, CantidadActualUnidades</strong>.
                            Solo se actualizarán las cantidades de productos que ya existen.
                        </p>
                        <input type="file" id="inventario-excel-uploader" accept=".xlsx, .xls, .csv" class="w-full p-4 border-2 border-dashed rounded-lg mb-6">
                        <div id="inventario-preview-container" class="overflow-auto max-h-72 border rounded-lg"></div>
                        <div id="inventario-import-actions" class="mt-6 flex flex-col sm:flex-row gap-4 hidden">
                             <button id="confirmInventarioImportBtn" class="w-full px-6 py-3 bg-green-500 text-white font-semibold rounded-lg shadow-md hover:bg-green-600">Confirmar e Importar Cantidades</button>
                             <button id="cancelInventarioImportBtn" class="w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Cancelar</button>
                        </div>
                         <button id="backToImportExportBtn" class="mt-6 w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver</button>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('inventario-excel-uploader').addEventListener('change', handleFileUploadInventario);
        document.getElementById('backToImportExportBtn').addEventListener('click', showImportExportInventarioView); // Corrected back button target
    }

    function handleFileUploadInventario(event) {
        const file = event.target.files[0];
        if (!file) return;
        _inventarioParaImportar = []; // Reset cache

        const reader = new FileReader();
        reader.onload = function(e) {
            const data = e.target.result;
            let jsonData = [];
            try {
                const workbook = XLSX.read(data, { type: 'binary' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            } catch (readError) {
                 _showModal('Error de Lectura', `No se pudo leer el archivo Excel: ${readError.message}`);
                 return;
            }


            if (jsonData.length < 2) {
                _showModal('Error', 'El archivo está vacío o no tiene datos después de la fila de encabezado.');
                renderPreviewTableInventario([]);
                return;
            }

            const headers = jsonData[0].map(h => (h ? h.toString().toLowerCase().trim().replace(/\s+/g, '') : ''));
            // Corrected header name to match export
            const requiredHeaders = ['rubro', 'segmento', 'marca', 'presentacion', 'cantidadactualunidades'];
            const headerMap = {};
            let missingHeader = false;

            requiredHeaders.forEach(rh => {
                const index = headers.indexOf(rh);
                if (index !== -1) {
                    headerMap[rh] = index;
                } else {
                     // Corrected variable name in error message
                     _showModal('Error', `Falta la columna requerida: "${rh}" (sin espacios) en el archivo.`);
                     missingHeader = true;
                }
            });
            if (missingHeader) {
                 renderPreviewTableInventario([]);
                 return;
            }

            _inventarioParaImportar = jsonData.slice(1).map((row, rowIndex) => {
                 // Corrected header name access
                const cantidadStr = (row[headerMap['cantidadactualunidades']] || '0').toString().trim();
                const cantidad = parseInt(cantidadStr, 10);
                if (isNaN(cantidad) || !Number.isInteger(cantidad) || cantidad < 0) {
                     console.warn(`Fila ${rowIndex + 2}: Cantidad inválida ('${cantidadStr}'). Se usará 0.`);
                     return {
                        rubro: (row[headerMap['rubro']] || '').toString().trim().toUpperCase(),
                        segmento: (row[headerMap['segmento']] || '').toString().trim().toUpperCase(),
                        marca: (row[headerMap['marca']] || '').toString().trim().toUpperCase(),
                        presentacion: (row[headerMap['presentacion']] || '').toString().trim(),
                        cantidad: 0, // Default to 0 if invalid
                        originalRow: row, // Keep original for preview
                        isValid: false,
                        error: 'Cantidad inválida'
                     };
                }
                return {
                    rubro: (row[headerMap['rubro']] || '').toString().trim().toUpperCase(),
                    segmento: (row[headerMap['segmento']] || '').toString().trim().toUpperCase(),
                    marca: (row[headerMap['marca']] || '').toString().trim().toUpperCase(),
                    presentacion: (row[headerMap['presentacion']] || '').toString().trim(),
                    cantidad: cantidad,
                    originalRow: row,
                    isValid: true
                };
            }).filter(item => item.rubro && item.segmento && item.marca && item.presentacion); // Filter out rows missing key identifiers

            renderPreviewTableInventario(_inventarioParaImportar);
        };
        reader.onerror = function(e) {
             _showModal('Error de Archivo', 'No se pudo leer el archivo seleccionado.');
             renderPreviewTableInventario([]);
        };
        reader.readAsBinaryString(file);
    }

    function renderPreviewTableInventario(items) {
        const container = document.getElementById('inventario-preview-container');
        const actionsContainer = document.getElementById('inventario-import-actions');
        const backButton = document.getElementById('backToImportExportBtn');
        const uploadInput = document.getElementById('inventario-excel-uploader');

        if (!container || !actionsContainer || !backButton || !uploadInput) return;

        if (items.length === 0) {
            container.innerHTML = `<p class="text-center text-gray-500 p-4">No se encontraron productos válidos para importar o el archivo está vacío.</p>`;
            actionsContainer.classList.add('hidden');
             backButton.classList.remove('hidden'); // Show back button if preview fails
            return;
        }

        const validItemsCount = items.filter(item => item.isValid).length;
        const invalidItemsCount = items.length - validItemsCount;

        let tableHTML = `<div class="p-4">
                            <h3 class="font-bold text-lg mb-2">Vista Previa (${validItemsCount} válidos, ${invalidItemsCount} inválidos)</h3>
                            ${invalidItemsCount > 0 ? '<p class="text-sm text-red-600 mb-2">Las filas marcadas en rojo tienen cantidades inválidas y se importarán como 0.</p>' : ''}
                            <table class="min-w-full bg-white text-xs">
                                <thead class="bg-gray-200 sticky top-0"><tr>
                                    <th class="py-1 px-2 text-left">Rubro</th>
                                    <th class="py-1 px-2 text-left">Segmento</th>
                                    <th class="py-1 px-2 text-left">Marca</th>
                                    <th class="py-1 px-2 text-left">Presentación</th>
                                    <th class="py-1 px-2 text-right">Nueva Cantidad (Und)</th>
                                </tr></thead><tbody>`;

        items.forEach(item => {
             const rowClass = item.isValid ? '' : 'bg-red-100 text-red-700';
            tableHTML += `<tr class="border-b ${rowClass}">
                <td class="py-1 px-2">${item.rubro}</td>
                <td class="py-1 px-2">${item.segmento}</td>
                <td class="py-1 px-2">${item.marca}</td>
                <td class="py-1 px-2">${item.presentacion}</td>
                <td class="py-1 px-2 text-right">${item.cantidad}${item.isValid ? '' : ' (Inválido)'}</td>
            </tr>`;
        });
        tableHTML += '</tbody></table></div>';
        container.innerHTML = tableHTML;

        actionsContainer.classList.remove('hidden');
        backButton.classList.add('hidden'); // Hide back button when preview is shown
        document.getElementById('confirmInventarioImportBtn').onclick = handleConfirmInventarioImport;
        document.getElementById('cancelInventarioImportBtn').onclick = () => {
             _inventarioParaImportar = [];
             uploadInput.value = ''; // Reset file input
             container.innerHTML = '';
             actionsContainer.classList.add('hidden');
             backButton.classList.remove('hidden');
        };
    }

    async function handleConfirmInventarioImport() {
        // Filter only valid items for processing
        const itemsToProcess = _inventarioParaImportar.filter(item => item.isValid);

        if (itemsToProcess.length === 0) {
            _showModal('Aviso', 'No hay productos con cantidades válidas para importar.');
            return;
        }

        _showModal('Progreso', `Buscando ${itemsToProcess.length} productos en el inventario actual...`);

        try {
            const inventarioRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`);
            const snapshot = await _getDocs(inventarioRef);
            const currentInventoryMap = new Map();
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                // Create a unique key for matching (ensure case-insensitivity and handle missing fields)
                const key = `${data.rubro || ''}|${data.segmento || ''}|${data.marca || ''}|${data.presentacion || ''}`.toUpperCase();
                currentInventoryMap.set(key, { id: doc.id, currentQty: data.cantidadUnidades || 0 });
            });

            _showModal('Progreso', 'Preparando actualizaciones...');

            const batch = _writeBatch(_db);
            let updatesCount = 0;
            let notFoundCount = 0;
            const notFoundProducts = [];

            itemsToProcess.forEach(item => {
                // Ensure key creation is consistent
                const key = `${item.rubro || ''}|${item.segmento || ''}|${item.marca || ''}|${item.presentacion || ''}`.toUpperCase();
                const existingProduct = currentInventoryMap.get(key);

                if (existingProduct) {
                    // Only update if the quantity is actually different
                    if (existingProduct.currentQty !== item.cantidad) {
                        const docRef = _doc(inventarioRef, existingProduct.id);
                        batch.update(docRef, { cantidadUnidades: item.cantidad });
                        updatesCount++;
                        console.log(`Updating ${item.presentacion} (ID: ${existingProduct.id}) to ${item.cantidad}`);
                    }
                } else {
                    notFoundCount++;
                    notFoundProducts.push(`${item.marca} ${item.presentacion}`);
                     console.warn(`Product not found in current inventory: ${key}`);
                }
            });

            if (updatesCount === 0) {
                 _showModal('Aviso', `No se encontraron productos coincidentes o no hubo cambios en las cantidades.${notFoundCount > 0 ? ` (${notFoundCount} productos del archivo no existen en el inventario y fueron ignorados)` : ''}`);
                 showImportExportInventarioView(); // Go back
                 return;
            }

            _showModal('Confirmar Importación', `Se actualizarán las cantidades de ${updatesCount} producto(s). ${notFoundCount > 0 ? `${notFoundCount} producto(s) del archivo no se encontraron y serán ignorados.` : ''} ¿Continuar? ${notFoundCount > 0 ? `<br><small>No encontrados: ${notFoundProducts.slice(0, 5).join(', ')}${notFoundCount > 5 ? '...' : ''}</small>` : ''}`, async () => {
                _showModal('Progreso', `Aplicando ${updatesCount} actualizaciones...`);
                try {
                    await batch.commit();
                    _showModal('Éxito', `Se actualizaron las cantidades de ${updatesCount} producto(s).`, showImportExportInventarioView);
                } catch (commitError) {
                    console.error("Error committing inventory updates:", commitError);
                    _showModal('Error', `Ocurrió un error al guardar las actualizaciones: ${commitError.message}`);
                }
            }, 'Sí, Actualizar', () => { /* No action on cancel */ });

        } catch (error) {
            console.error("Error during inventory import process:", error);
            _showModal('Error', `Ocurrió un error durante la importación: ${error.message}`);
        } finally {
            _inventarioParaImportar = []; // Clear cache after processing attempt
        }
    }


    // --- Funciones de Gestión de Usuarios, Perfil, Config Obsequio, Propagación (sin cambios previos) ---
    function showUserManagementView() {
         _floatingControls?.classList.add('hidden');
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl">
                        <div class="flex justify-between items-center mb-6">
                             <h1 class="text-3xl font-bold text-gray-800 text-center flex-grow">Gestión de Usuarios</h1>
                             <button id="backToAdminMenuBtn" class="px-4 py-2 bg-gray-400 text-white text-sm font-semibold rounded-lg shadow-md hover:bg-gray-500 ml-4 flex-shrink-0">Volver</button>
                        </div>
                        <div id="user-list-container" class="overflow-x-auto max-h-96">
                            <p class="text-center text-gray-500">Cargando usuarios...</p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('backToAdminMenuBtn').addEventListener('click', showAdminSubMenuView);
        renderUserList();
    };

    async function renderUserList() {
        const container = document.getElementById('user-list-container');
        if (!container) return;

        try {
            const usersRef = _collection(_db, "users");
            const snapshot = await _getDocs(usersRef);
            const users = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .sort((a, b) => (a.email || '').localeCompare(b.email || ''));

            if (users.length === 0) {
                container.innerHTML = `<p class="text-center text-gray-500">No se encontraron usuarios.</p>`;
                return;
            }

            let tableHTML = `
                <table class="min-w-full bg-white text-sm">
                    <thead class="bg-gray-200 sticky top-0 z-10">
                        <tr>
                            <th class="py-2 px-4 border-b text-left">Email</th>
                            <th class="py-2 px-4 border-b text-left">Rol</th>
                        </tr>
                    </thead>
                    <tbody>`;

            users.forEach(user => {
                tableHTML += `
                    <tr class="hover:bg-gray-50">
                        <td class="py-2 px-4 border-b">${user.email || 'N/A'}</td>
                        <td class="py-2 px-4 border-b">
                            <select onchange="window.adminModule.handleRoleChange('${user.id}', this.value, '${user.email || 'N/A'}')" class="w-full p-1 border rounded-lg bg-gray-50 text-sm">
                                <option value="user" ${user.role === 'user' ? 'selected' : ''}>User</option>
                                <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                            </select>
                        </td>
                    </tr>
                `;
            });

            tableHTML += `</tbody></table>`;
            container.innerHTML = tableHTML;

        } catch (error) {
            console.error("Error al cargar la lista de usuarios:", error);
            container.innerHTML = `<p class="text-center text-red-500">Error al cargar los usuarios. Verifica los permisos.</p>`;
        }
    }

    async function handleRoleChange(userIdToChange, newRole, userEmail) {
        if (userIdToChange === _userId && newRole === 'user') {
            const usersRef = _collection(_db, "users");
            const qAdmin = _query(usersRef, _where("role", "==", "admin"));
            const adminSnapshot = await _getDocs(qAdmin);
            if (adminSnapshot.size <= 1) {
                _showModal('Acción No Permitida', 'No puedes cambiar tu propio rol si eres el único administrador.');
                renderUserList();
                return;
            }
        }

        _showModal(
            'Confirmar Cambio de Rol',
            `¿Estás seguro de que quieres cambiar el rol de <strong>${userEmail}</strong> a <strong>${newRole}</strong>?`,
            async () => {
                _showModal('Progreso', 'Actualizando rol...');
                try {
                    const userDocRef = _doc(_db, "users", userIdToChange);
                    await _setDoc(userDocRef, { role: newRole }, { merge: true });
                    _showModal('Éxito', 'El rol del usuario ha sido actualizado.');
                     renderUserList();
                } catch (error) {
                    console.error("Error al cambiar el rol:", error);
                    _showModal('Error', 'No se pudo actualizar el rol. Asegúrate de tener permisos de administrador.');
                    renderUserList();
                }
            },
            'Sí, Cambiar Rol',
             () => { renderUserList(); }
        );
    }

    async function showUserProfileView() {
         _floatingControls?.classList.add('hidden');
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto max-w-lg">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl">
                        <h1 class="text-3xl font-bold text-gray-800 mb-6 text-center">Mi Perfil</h1>
                        <form id="userProfileForm" class="space-y-4 text-left">
                            <div>
                                <label for="profileNombre" class="block text-gray-700 font-medium mb-1">Nombre:</label>
                                <input type="text" id="profileNombre" class="w-full px-4 py-2 border rounded-lg" required>
                            </div>
                            <div>
                                <label for="profileApellido" class="block text-gray-700 font-medium mb-1">Apellido:</label>
                                <input type="text" id="profileApellido" class="w-full px-4 py-2 border rounded-lg" required>
                            </div>
                            <div>
                                <label for="profileCamion" class="block text-gray-700 font-medium mb-1">Datos del Camión:</label>
                                <input type="text" id="profileCamion" class="w-full px-4 py-2 border rounded-lg" placeholder="Ej: Placa ABC-123, NPR Blanco">
                            </div>
                            <button type="submit" class="w-full px-6 py-3 bg-green-500 text-white font-semibold rounded-lg shadow-md hover:bg-green-600">Guardar Cambios</button>
                        </form>
                        <button id="backToMenuBtn" class="mt-4 w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver al Menú Principal</button>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('backToMenuBtn').addEventListener('click', _showMainMenu);
        document.getElementById('userProfileForm').addEventListener('submit', handleSaveProfile);

        try {
            const userDocRef = _doc(_db, "users", _userId);
            const userDoc = await _getDoc(userDocRef);
            if (userDoc.exists()) {
                const data = userDoc.data();
                document.getElementById('profileNombre').value = data.nombre || '';
                document.getElementById('profileApellido').value = data.apellido || '';
                document.getElementById('profileCamion').value = data.camion || '';
            } else {
                 // If user doc doesn't exist, create it with email and default role
                 const currentUser = auth.currentUser; // Get current auth user
                 if(currentUser){
                     await _setDoc(userDocRef, { email: currentUser.email, role: 'user', createdAt: new Date() });
                     console.log("Documento de perfil de usuario creado.");
                 } else {
                     console.error("Cannot create profile, user not authenticated.");
                     _showModal('Error', 'No se pudo crear el perfil porque no estás autenticado.');
                 }
            }
        } catch (error) {
            console.error("Error al cargar el perfil del usuario:", error);
            _showModal('Error', 'No se pudo cargar la información de tu perfil.');
        }
    }

    async function handleSaveProfile(e) {
        e.preventDefault();
        const nombre = document.getElementById('profileNombre').value.trim();
        const apellido = document.getElementById('profileApellido').value.trim();
        const camion = document.getElementById('profileCamion').value.trim();

        if (!nombre || !apellido) {
            _showModal('Error', 'El nombre y el apellido son obligatorios.');
            return;
        }
        const profileData = { nombre, apellido, camion };
        _showModal('Progreso', 'Guardando tu información...');
        try {
            const userDocRef = _doc(_db, "users", _userId);
            await _setDoc(userDocRef, profileData, { merge: true });
            _showModal('Éxito', 'Tu perfil ha sido actualizado correctamente.');
        } catch (error) {
            console.error("Error al guardar el perfil:", error);
            _showModal('Error', 'Hubo un error al guardar tu perfil.');
        }
    }

    async function showObsequioConfigView() {
         _floatingControls?.classList.add('hidden');
         const publicConfigPath = `artifacts/ventas-9a210/public/data/config/obsequio`; // Ruta pública
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto max-w-lg">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl">
                        <div class="flex justify-between items-center mb-6">
                             <h1 class="text-2xl font-bold text-gray-800 text-center flex-grow">Configurar Producto Obsequio</h1>
                             <button id="backToAdminMenuBtn" class="px-4 py-2 bg-gray-400 text-white text-sm font-semibold rounded-lg shadow-md hover:bg-gray-500 ml-4 flex-shrink-0">Volver</button>
                        </div>
                        <p class="text-gray-600 mb-4 text-center text-sm">Selecciona el producto que se utilizará como obsequio. Debe manejar vacíos y venderse por caja. Esta configuración es pública.</p>
                        <div class="space-y-4 text-left">
                            <div>
                                <label for="obsequioProductSelect" class="block text-gray-700 font-medium mb-1">Producto de Obsequio:</label>
                                <select id="obsequioProductSelect" class="w-full px-4 py-2 border rounded-lg">
                                    <option value="">Cargando productos...</option>
                                </select>
                            </div>
                            <button id="saveObsequioConfigBtn" class="w-full px-6 py-3 bg-purple-500 text-white font-semibold rounded-lg shadow-md hover:bg-purple-600">Guardar Configuración Pública</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('backToAdminMenuBtn').addEventListener('click', showAdminSubMenuView);
        document.getElementById('saveObsequioConfigBtn').addEventListener('click', handleSaveObsequioConfig);
        await loadAndPopulateObsequioSelect();
    }

    async function loadAndPopulateObsequioSelect() {
        const selectElement = document.getElementById('obsequioProductSelect');
        if (!selectElement) return;
        const publicConfigPath = `artifacts/ventas-9a210/public/data/config/obsequio`; // Ruta pública

        try {
            // Cargar productos del inventario del ADMIN (para seleccionar)
            const inventarioRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`);
            const snapshot = await _getDocs(inventarioRef);
            const productosValidos = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(p => p.manejaVacios && p.ventaPor?.cj) // Filtro: maneja vacío y se vende por caja
                .sort((a, b) => `${a.marca} ${a.segmento} ${a.presentacion}`.localeCompare(`${b.marca} ${b.segmento} ${b.presentacion}`));

            selectElement.innerHTML = '<option value="">-- Seleccione un Producto --</option>';
            if (productosValidos.length === 0) {
                 selectElement.innerHTML = '<option value="">No hay productos válidos (Maneja vacío y venta por caja)</option>';
                 selectElement.disabled = true;
                  const saveBtn = document.getElementById('saveObsequioConfigBtn');
                  if (saveBtn) saveBtn.disabled = true;
            } else {
                 productosValidos.forEach(p => {
                     selectElement.innerHTML += `<option value="${p.id}">${p.marca} - ${p.segmento} - ${p.presentacion}</option>`;
                 });
                 selectElement.disabled = false;
                  const saveBtn = document.getElementById('saveObsequioConfigBtn');
                  if (saveBtn) saveBtn.disabled = false;

                 // Cargar la configuración PÚBLICA actual para preseleccionar
                 const configRef = _doc(_db, publicConfigPath);
                 const configSnap = await _getDoc(configRef);
                 if (configSnap.exists()) {
                     _obsequioProductId = configSnap.data().productoId;
                     if (_obsequioProductId && productosValidos.some(p => p.id === _obsequioProductId)) {
                         selectElement.value = _obsequioProductId;
                     } else if (_obsequioProductId) {
                         console.warn("El ID de obsequio guardado no corresponde a un producto válido actual.");
                         _obsequioProductId = null; // Reset if invalid
                     }
                 }
            }
        } catch (error) {
            console.error("Error cargando productos/config para obsequio:", error);
            selectElement.innerHTML = '<option value="">Error al cargar datos</option>';
            selectElement.disabled = true;
             const saveBtn = document.getElementById('saveObsequioConfigBtn');
             if (saveBtn) saveBtn.disabled = true;
        }
    }

    async function handleSaveObsequioConfig() {
        const selectedProductId = document.getElementById('obsequioProductSelect').value;
        const publicConfigPath = `artifacts/ventas-9a210/public/data/config/obsequio`; // Ruta pública
        if (!selectedProductId) {
            _showModal('Error', 'Debes seleccionar un producto de la lista.');
            return;
        }
        _showModal('Progreso', 'Guardando configuración pública...');
        try {
            const configRef = _doc(_db, publicConfigPath);
            await _setDoc(configRef, { productoId: selectedProductId });
            _obsequioProductId = selectedProductId; // Update local cache
            _showModal('Éxito', 'Producto de obsequio configurado públicamente.');
            showAdminSubMenuView();
        } catch (error) {
            console.error("Error guardando configuración pública de obsequio:", error);
            _showModal('Error', 'Hubo un error al guardar la configuración.');
        }
    }

    async function _getAllOtherUserIds() {
        try {
            const usersRef = _collection(_db, "users");
            const snapshot = await _getDocs(usersRef);
            // Include admin's ID for propagation as well
            const userIds = snapshot.docs.map(doc => doc.id);
            console.log("All user IDs for propagation:", userIds);
            return userIds;
        } catch (error) {
            console.error("Error obteniendo IDs de usuario para propagación:", error);
            _showModal('Error Interno', 'No se pudo obtener la lista de usuarios para actualizar.');
            return [];
        }
    }

    async function propagateProductChange(productId, productData) {
        if (!productId) { console.error("propagateProductChange: productId is missing."); return; }
        const allUserIds = await _getAllOtherUserIds(); // Propagate to all users including admin
        if (allUserIds.length === 0) { console.log("propagateProductChange: No users found."); return; }
        console.log(`Propagating product ${productId} change to users:`, allUserIds);
        const BATCH_LIMIT = 490;
        let batch = _writeBatch(_db);
        let operations = 0;
        let errorsOccurred = false;
        try {
            for (const targetUserId of allUserIds) {
                const targetProductRef = _doc(_db, `artifacts/${_appId}/users/${targetUserId}/inventario`, productId);
                if (productData === null) { // Deletion
                    console.log(` - Deleting product ${productId} for user ${targetUserId}`);
                    batch.delete(targetProductRef);
                } else { // Creation or Update
                    const { cantidadUnidades, ...definitionData } = productData; // Separate quantity
                    console.log(` - Setting/Merging product definition ${productId} for user ${targetUserId}`);
                    // Check if document exists for the target user before deciding set/update
                    const targetDocSnap = await _getDoc(targetProductRef);
                    if (targetDocSnap.exists()) {
                        // Document exists, update definition, keep existing quantity
                         batch.set(targetProductRef, definitionData, { merge: true }); // Use merge:true to update existing doc
                    } else {
                        // Document doesn't exist, create it with quantity 0
                        const initialData = { ...definitionData, cantidadUnidades: 0 };
                         batch.set(targetProductRef, initialData); // Use set without merge to create
                    }
                }
                operations++;
                if (operations >= BATCH_LIMIT) {
                    console.log(` - Committing partial batch (${operations} ops)...`);
                    await batch.commit();
                    batch = _writeBatch(_db);
                    operations = 0;
                }
            }
            if (operations > 0) {
                 console.log(` - Committing final batch (${operations} ops)...`);
                 await batch.commit();
            }
             // Close progress modal only if still visible
             const modalContainer = document.getElementById('modalContainer');
             const modalTitle = modalContainer?.querySelector('h3')?.textContent;
             if(modalContainer && !modalContainer.classList.contains('hidden') && modalTitle?.startsWith('Progreso')) {
                  modalContainer.classList.add('hidden');
             }
             console.log(`Propagation complete for product ${productId}.`);
        } catch (error) {
            errorsOccurred = true;
            console.error("Error propagando cambio de producto:", error);
            // Use window.showModal as _showModal might be affected
            window.showModal('Error', `Error al propagar cambio de producto: ${error.message}.`);
        }
    }

     async function propagateCategoryChange(collectionName, itemId, itemData) {
         if (!collectionName || !itemId) { console.error("propagateCategoryChange: collectionName or itemId missing."); return; }
         const allUserIds = await _getAllOtherUserIds(); // Propagate to all users including admin
         if (allUserIds.length === 0) { console.log("propagateCategoryChange: No users found."); return; }
         console.log(`Propagating category ${collectionName} (${itemId}) change to ${allUserIds.length} users...`);
         const BATCH_LIMIT = 490;
         let batch = _writeBatch(_db);
         let operations = 0;
         let errorsOccurred = false;
         try {
             for (const targetUserId of allUserIds) {
                 const targetItemRef = _doc(_db, `artifacts/${_appId}/users/${targetUserId}/${collectionName}`, itemId);
                 if (itemData === null) { // Deletion
                     batch.delete(targetItemRef);
                     console.log(` - Deleting ${collectionName}/${itemId} for ${targetUserId}`);
                 } else { // Creation or Update
                     batch.set(targetItemRef, itemData); // set handles both create and overwrite
                      console.log(` - Setting ${collectionName}/${itemId} for ${targetUserId}`);
                 }
                 operations++;
                 if (operations >= BATCH_LIMIT) { await batch.commit(); batch = _writeBatch(_db); operations = 0; }
             }
             if (operations > 0) await batch.commit();
             console.log(`Propagation complete for category ${collectionName} (${itemId}).`);
         } catch (error) {
             errorsOccurred = true;
             console.error(`Error propagando cambio de categoría ${collectionName} (${itemId}):`, error);
              window.showModal('Error Propagación', `Error al actualizar categoría '${itemData?.name || itemId}'.`);
         }
     }

     async function propagateCategoryOrderChange(collectionName, orderedIds) {
          if (!collectionName || !Array.isArray(orderedIds)) { console.error("propagateCategoryOrderChange: collectionName or orderedIds (array) missing."); return; }
          const allUserIds = await _getAllOtherUserIds(); // Propagate to all users including admin
          if (allUserIds.length === 0) { console.log("propagateCategoryOrderChange: No users found."); return; }
          console.log(`Propagating order for ${collectionName} to users:`, allUserIds);
          const BATCH_LIMIT = 490;
          let errorsOccurred = false;
          try {
              const orderMap = new Map(orderedIds.map((id, index) => [id, index]));
              let maxOrderInAdminList = orderedIds.length - 1;

              for (const targetUserId of allUserIds) {
                  let batch = _writeBatch(_db);
                  let operations = 0;
                  console.log(` - Updating order of ${collectionName} for ${targetUserId}`);
                  const targetCollectionRef = _collection(_db, `artifacts/${_appId}/users/${targetUserId}/${collectionName}`);
                  const snapshot = await _getDocs(targetCollectionRef);

                  // Keep track of max order found *within this user's current items* to place unknowns after
                  let userSpecificMaxOrder = maxOrderInAdminList;
                  const itemsInUserList = snapshot.docs.map(d => ({ id: d.id, data: d.data() }));

                  // First pass: update items present in the admin's ordered list
                  for (const item of itemsInUserList) {
                      const currentOrder = item.data.orden;
                      let newOrder;
                      if (orderMap.has(item.id)) {
                          newOrder = orderMap.get(item.id);
                          if (currentOrder !== newOrder) {
                              const targetItemRef = _doc(targetCollectionRef, item.id);
                              batch.update(targetItemRef, { orden: newOrder });
                              operations++;
                              console.log(`   - Updating order for ${item.id} (${item.data.name}) to ${newOrder} for ${targetUserId}`);
                          }
                          // Track the max order assigned from the admin list
                          userSpecificMaxOrder = Math.max(userSpecificMaxOrder, newOrder);
                      }
                      if (operations >= BATCH_LIMIT) { console.log(`   - Committing partial order batch (known items) for ${targetUserId} (${operations} ops)...`); await batch.commit(); batch = _writeBatch(_db); operations = 0; }
                  }

                  // Second pass: handle items *not* in the admin's ordered list (assign sequential order after the max known)
                  itemsInUserList.sort((a,b)=> (a.data.name || '').localeCompare(b.data.name || '')); // Sort unknowns alphabetically
                  for (const item of itemsInUserList) {
                      if (!orderMap.has(item.id)) {
                          userSpecificMaxOrder++; // Increment for the next unknown item
                          const newOrder = userSpecificMaxOrder;
                          const currentOrder = item.data.orden;
                          // Update only if order needs changing or was undefined
                          if (currentOrder !== newOrder) {
                              const targetItemRef = _doc(targetCollectionRef, item.id);
                              batch.update(targetItemRef, { orden: newOrder });
                              operations++;
                              console.warn(`   - Item ${item.id} (${item.data.name}) not in admin's ordered list. Assigning order ${newOrder} for ${targetUserId}.`);
                          }
                      }
                       if (operations >= BATCH_LIMIT) { console.log(`   - Committing partial order batch (unknown items) for ${targetUserId} (${operations} ops)...`); await batch.commit(); batch = _writeBatch(_db); operations = 0; }
                  }


                  if (operations > 0) { console.log(`   - Committing final order batch for ${targetUserId} (${operations} ops)...`); await batch.commit(); }
              }
               // Close progress modal only if still visible
               const modalContainer = document.getElementById('modalContainer');
               const modalTitle = modalContainer?.querySelector('h3')?.textContent;
               if(modalContainer && !modalContainer.classList.contains('hidden') && modalTitle?.startsWith('Progreso')) { modalContainer.classList.add('hidden'); }
               console.log(`Order propagation complete for ${collectionName}.`);
          } catch (error) {
              errorsOccurred = true;
              console.error(`Error propagando orden de ${collectionName}:`, error);
              window.showModal('Error Propagación', `Error al actualizar orden de categoría: ${error.message}`);
          }
     }


    window.adminModule = {
        handleRoleChange,
        propagateProductChange,
        propagateCategoryChange,
        propagateCategoryOrderChange
        // Deep clean functions are kept internal to the module
    };

})();
