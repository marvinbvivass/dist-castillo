// --- Lógica del módulo de Sincronización (Versión Mejorada) ---

(function() {
    // Variables locales del módulo
    let _db, _userId, _appId, _mainContent;
    let _showMainMenu, _showModal;
    let _collection, _getDocs, _writeBatch, _doc, _setDoc, _getDoc;

    /**
     * Inicializa el módulo con las dependencias de la app principal.
     */
    window.initSincronizacion = function(dependencies) {
        _db = dependencies.db;
        _userId = dependencies.userId;
        _appId = dependencies.appId;
        _mainContent = dependencies.mainContent;
        _showMainMenu = dependencies.showMainMenu;
        _showModal = dependencies.showModal;
        _collection = dependencies.collection;
        _getDocs = dependencies.getDocs;
        _getDoc = dependencies.getDoc;
        _writeBatch = dependencies.writeBatch;
        _doc = dependencies.doc;
        _setDoc = dependencies.setDoc;
    };

    /**
     * Muestra la vista principal de sincronización con opciones para Importar y Compartir.
     */
    window.showSincronizacionView = function() {
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl text-center">
                        <h1 class="text-3xl font-bold text-gray-800 mb-6">Sincronización de Datos</h1>
                        
                        <!-- SECCIÓN PARA IMPORTAR DATOS -->
                        <div class="text-left space-y-4 max-w-lg mx-auto border border-gray-200 p-6 rounded-lg mb-8">
                            <h2 class="text-xl font-semibold text-gray-700 mb-4 text-center">1. Importar Datos de Otro Usuario</h2>
                            <div>
                                <label for="sourceUserId" class="block text-gray-700 font-medium mb-2">ID de Usuario Origen:</label>
                                <input type="text" id="sourceUserId" placeholder="Pegue el ID del usuario a importar" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500">
                            </div>
                            <div>
                                <p class="block text-gray-700 font-medium mb-2">Datos a Importar:</p>
                                <div class="space-y-2">
                                    <label class="flex items-center"><input type="checkbox" id="syncInventario" value="inventario" class="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500" checked><span class="ml-2 text-gray-700">Inventario (Productos, Rubros, Segmentos, Marcas y sus Órdenes)</span></label>
                                    <label class="flex items-center"><input type="checkbox" id="syncClientes" value="clientes" class="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500" checked><span class="ml-2 text-gray-700">Clientes y Sectores</span></label>
                                </div>
                            </div>
                            <div class="pt-4">
                                <button id="startImportBtn" class="w-full px-6 py-3 bg-orange-500 text-white font-semibold rounded-lg shadow-md hover:bg-orange-600 transition">
                                    Iniciar Importación
                                </button>
                            </div>
                        </div>

                        <!-- SECCIÓN PARA COMPARTIR DATOS -->
                        <div class="text-left space-y-4 max-w-lg mx-auto border border-gray-200 p-6 rounded-lg">
                             <h2 class="text-xl font-semibold text-gray-700 mb-4 text-center">2. Compartir Mis Datos</h2>
                             <p class="text-sm text-gray-600 text-center">Para que otro usuario pueda importar tus datos, primero debes compartirlos. Tu ID de usuario es el código que debes darle.</p>
                             <div class="bg-gray-100 p-3 rounded-lg text-center">
                                <p class="text-xs text-gray-500">Tu ID de Usuario (para compartir)</p>
                                <span class="font-mono text-gray-800 break-words">${_userId}</span>
                             </div>
                             <button id="startShareBtn" class="w-full px-6 py-3 bg-teal-500 text-white font-semibold rounded-lg shadow-md hover:bg-teal-600 transition">
                                Compartir Mis Datos Ahora
                            </button>
                        </div>
                        
                         <button id="backToMenuBtn" class="mt-8 w-full max-w-lg mx-auto px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500 transition">
                            Volver al Menú Principal
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('startImportBtn').addEventListener('click', handleImportacion);
        document.getElementById('startShareBtn').addEventListener('click', handleExportacion);
        document.getElementById('backToMenuBtn').addEventListener('click', _showMainMenu);
    };

    /**
     * Maneja la lógica para COMPARTIR (exportar) los datos del usuario actual a un lugar público.
     */
    async function handleExportacion() {
        _showModal('Confirmar Compartir', `
            <p>Estás a punto de compartir tus datos de Inventario y Clientes para que otro usuario pueda importarlos.</p>
            <p class="mt-2">Esta acción no afectará tus datos actuales. ¿Deseas continuar?</p>
        `, async () => {
            _showModal('Progreso', 'Preparando tus datos para compartir... Esto puede tardar un momento.');

            try {
                const collectionsToExport = {
                    inventario: ['inventario', 'rubros', 'segmentos', 'marcas'],
                    clientes: ['clientes', 'sectores']
                };

                const dataToExport = {};

                for (const group in collectionsToExport) {
                    for (const collectionName of collectionsToExport[group]) {
                        const sourcePath = `artifacts/${_appId}/users/${_userId}/${collectionName}`;
                        const sourceColRef = _collection(_db, sourcePath);
                        const snapshot = await _getDocs(sourceColRef);
                        if (!snapshot.empty) {
                            dataToExport[collectionName] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                        }
                    }
                }
                
                // Guardar los datos compilados en una ubicación pública, usando el ID del usuario como clave.
                const publicExportRef = _doc(_db, `artifacts/${_appId}/public/data/sync_exports`, _userId);
                await _setDoc(publicExportRef, {
                    data: dataToExport,
                    sharedAt: new Date()
                });

                _showModal('Éxito', 'Tus datos han sido compartidos. Ahora puedes darle tu ID de usuario a la otra persona para que los importe.');

            } catch (error) {
                console.error("Error durante la exportación de datos: ", error);
                _showModal('Error', `Ocurrió un error al compartir tus datos: ${error.message}`);
            }
        });
    }

    /**
     * Maneja la lógica para IMPORTAR (sincronizar) datos desde un lugar público.
     */
    async function handleImportacion() {
        const sourceUserId = document.getElementById('sourceUserId').value.trim();
        const syncInventario = document.getElementById('syncInventario').checked;
        const syncClientes = document.getElementById('syncClientes').checked;

        if (!sourceUserId) {
            _showModal('Error', 'Debes ingresar un ID de Usuario de Origen.');
            return;
        }
        if (sourceUserId === _userId) {
            _showModal('Error', 'No puedes importar datos desde tu propio usuario.');
            return;
        }
        if (!syncInventario && !syncClientes) {
            _showModal('Error', 'Debes seleccionar al menos un tipo de dato para importar.');
            return;
        }

        const confirmationMessage = `
            <p>Estás a punto de importar datos desde el usuario <strong class="font-mono">${sourceUserId}</strong>.</p>
            <p class="mt-2 font-bold text-red-600">¡Atención! Esta acción tendrá los siguientes efectos:</p>
            <ul class="list-disc list-inside text-left text-sm mt-2">
                ${syncInventario ? `<li>Tu <strong>catálogo de productos y categorías</strong> será reemplazado por el del otro usuario, pero <strong>se conservarán tus cantidades de stock actuales</strong>.</li>` : ''}
                ${syncClientes ? `<li>Tu <strong>lista de clientes y sectores</strong> será completamente reemplazada.</li>` : ''}
                <li>Tu historial de ventas no será modificado.</li>
            </ul>
             <p class="mt-2 font-bold">¿Estás seguro de que deseas continuar?</p>
        `;

        _showModal('Confirmar Importación', confirmationMessage, async () => {
            _showModal('Progreso', 'Importando datos... Por favor, no cierres la aplicación.');

            try {
                // Leer el documento público compartido por el usuario de origen.
                const publicExportRef = _doc(_db, `artifacts/${_appId}/public/data/sync_exports`, sourceUserId);
                const docSnap = await _getDoc(publicExportRef);

                if (!docSnap.exists()) {
                    throw new Error("ID de usuario no encontrado o el usuario no ha compartido sus datos.");
                }

                const importedDataContainer = docSnap.data().data;

                if (syncInventario) {
                    await mergeInventarioData(importedDataContainer); // <-- Lógica de fusión
                    await copyDataToLocal('rubros', importedDataContainer);
                    await copyDataToLocal('segmentos', importedDataContainer);
                    await copyDataToLocal('marcas', importedDataContainer);
                }
                if (syncClientes) {
                    await copyDataToLocal('clientes', importedDataContainer);
                    await copyDataToLocal('sectores', importedDataContainer);
                }

                // Invalidar cachés de otros módulos para que reflejen los nuevos datos de ordenamiento
                if (window.inventarioModule && typeof window.inventarioModule.invalidateSegmentOrderCache === 'function') {
                    window.inventarioModule.invalidateSegmentOrderCache();
                    console.log("Caché de orden de inventario invalidada.");
                }
                if (window.ventasModule && typeof window.ventasModule.invalidateCache === 'function') {
                    window.ventasModule.invalidateCache();
                    console.log("Caché de orden de ventas invalidada.");
                }
                if (window.catalogoModule && typeof window.catalogoModule.invalidateCache === 'function') {
                    window.catalogoModule.invalidateCache();
                    console.log("Caché de orden de catálogo invalidada.");
                }

                _showModal('Éxito', 'La importación de datos se completó correctamente.');

            } catch (error) {
                console.error("Error durante la importación: ", error);
                _showModal('Error', `Ocurrió un error durante la importación: ${error.message}`);
            }
        });
    }
    
    /**
     * Fusiona el inventario importado, conservando las cantidades de stock locales.
     * @param {object} importedData - El objeto completo con todos los datos importados.
     */
    async function mergeInventarioData(importedData) {
        const importedInventario = importedData['inventario'];
        if (!importedInventario || importedInventario.length === 0) {
            console.log("No hay datos de inventario para importar.");
            return;
        }

        // 1. Obtener el inventario actual del usuario local para consultar las cantidades.
        const localInventarioRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`);
        const localInventarioSnapshot = await _getDocs(localInventarioRef);
        const localInventarioMap = new Map(localInventarioSnapshot.docs.map(doc => [doc.id, doc.data()]));

        const batch = _writeBatch(_db);

        // 2. Iterar sobre el inventario importado.
        importedInventario.forEach(item => {
            const { id, ...data } = item;
            const targetDocRef = _doc(_db, `artifacts/${_appId}/users/${_userId}/inventario`, id);

            if (localInventarioMap.has(id)) {
                // 3. Si el producto existe, conservar la cantidad de stock local.
                const currentStock = localInventarioMap.get(id).cantidadUnidades || 0;
                data.cantidadUnidades = currentStock;
            } else {
                // 4. Si el producto es nuevo, establecer su stock en 0.
                data.cantidadUnidades = 0;
            }
            batch.set(targetDocRef, data);
        });

        await batch.commit();
        console.log("El inventario se ha fusionado exitosamente.");
    }


    /**
     * Escribe los datos importados en las colecciones locales del usuario actual (sobrescritura total).
     * @param {string} collectionName - El nombre de la colección a escribir.
     * @param {object} importedData - El objeto completo con todos los datos importados.
     */
    async function copyDataToLocal(collectionName, importedData) {
        const dataToCopy = importedData[collectionName];
        if (!dataToCopy || dataToCopy.length === 0) {
            console.log(`No hay datos para importar en la colección: ${collectionName}`);
            return;
        }

        const targetPath = `artifacts/${_appId}/users/${_userId}/${collectionName}`;
        const batch = _writeBatch(_db);

        dataToCopy.forEach(item => {
            const { id, ...data } = item;
            const targetDocRef = _doc(_db, targetPath, id); // Usa el mismo ID del documento
            batch.set(targetDocRef, data);
        });

        await batch.commit();
        console.log(`Colección '${collectionName}' importada exitosamente.`);
    }

})();
