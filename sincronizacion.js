// --- Lógica del módulo de Sincronización ---

(function() {
    // Variables locales del módulo
    let _db, _userId, _appId, _mainContent;
    let _showMainMenu, _showModal;
    let _collection, _getDocs, _writeBatch, _doc, _setDoc;

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
        _writeBatch = dependencies.writeBatch;
        _doc = dependencies.doc;
        _setDoc = dependencies.setDoc; // Usaremos setDoc para mantener los mismos IDs si es posible
    };

    /**
     * Muestra la vista principal de sincronización.
     */
    window.showSincronizacionView = function() {
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl text-center">
                        <h1 class="text-3xl font-bold text-gray-800 mb-6">Sincronización de Datos</h1>
                        <div class="text-left space-y-4 max-w-lg mx-auto">
                            <div>
                                <label for="sourceUserId" class="block text-gray-700 font-medium mb-2">ID de Usuario Origen:</label>
                                <input type="text" id="sourceUserId" placeholder="Pegue aquí el ID del usuario del que desea copiar los datos" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500">
                                <p class="text-xs text-gray-500 mt-1">Tu ID actual es: <span class="font-mono">${_userId}</span></p>
                            </div>
                            <div>
                                <p class="block text-gray-700 font-medium mb-2">Datos a Sincronizar:</p>
                                <div class="space-y-2">
                                    <label class="flex items-center"><input type="checkbox" id="syncInventario" value="inventario" class="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500" checked><span class="ml-2 text-gray-700">Inventario (Productos, Rubros, Marcas, etc.)</span></label>
                                    <label class="flex items-center"><input type="checkbox" id="syncClientes" value="clientes" class="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500" checked><span class="ml-2 text-gray-700">Clientes y Sectores</span></label>
                                </div>
                            </div>
                            <div class="pt-4">
                                <button id="startSyncBtn" class="w-full px-6 py-3 bg-orange-500 text-white font-semibold rounded-lg shadow-md hover:bg-orange-600 transition">
                                    Iniciar Sincronización
                                </button>
                            </div>
                        </div>
                         <button id="backToMenuBtn" class="mt-6 w-full max-w-lg mx-auto px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500 transition">
                            Volver al Menú Principal
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('startSyncBtn').addEventListener('click', handleSincronizacion);
        document.getElementById('backToMenuBtn').addEventListener('click', _showMainMenu);
    };

    /**
     * Maneja la lógica de la sincronización.
     */
    async function handleSincronizacion() {
        const sourceUserId = document.getElementById('sourceUserId').value.trim();
        const syncInventario = document.getElementById('syncInventario').checked;
        const syncClientes = document.getElementById('syncClientes').checked;

        if (!sourceUserId) {
            _showModal('Error', 'Debes ingresar un ID de Usuario de Origen.');
            return;
        }
        if (sourceUserId === _userId) {
            _showModal('Error', 'No puedes sincronizar datos desde tu propio usuario.');
            return;
        }
        if (!syncInventario && !syncClientes) {
            _showModal('Error', 'Debes seleccionar al menos un tipo de dato para sincronizar.');
            return;
        }

        _showModal('Confirmar Sincronización', `
            <p>Estás a punto de copiar datos desde el usuario <strong class="font-mono">${sourceUserId}</strong>.</p>
            <p class="mt-2 font-bold text-red-600">¡Atención! Esta acción puede sobrescribir tus datos actuales. ¿Estás seguro de que deseas continuar?</p>
        `, async () => {
            _showModal('Progreso', 'Sincronizando datos... Por favor, no cierres la aplicación.');

            try {
                if (syncInventario) {
                    await copyCollection('inventario', sourceUserId);
                    await copyCollection('rubros', sourceUserId);
                    await copyCollection('segmentos', sourceUserId);
                    await copyCollection('marcas', sourceUserId);
                }
                if (syncClientes) {
                    await copyCollection('clientes', sourceUserId);
                    await copyCollection('sectores', sourceUserId);
                }
                _showModal('Éxito', 'La sincronización se completó correctamente.');
            } catch (error) {
                console.error("Error durante la sincronización: ", error);
                _showModal('Error', `Ocurrió un error durante la sincronización: ${error.message}`);
            }
        });
    }

    /**
     * Copia todos los documentos de una colección de un usuario a otro.
     * @param {string} collectionName - El nombre de la colección a copiar.
     * @param {string} sourceUserId - El ID del usuario de origen.
     */
    async function copyCollection(collectionName, sourceUserId) {
        const sourcePath = `artifacts/${_appId}/users/${sourceUserId}/${collectionName}`;
        const targetPath = `artifacts/${_appId}/users/${_userId}/${collectionName}`;

        const sourceColRef = _collection(_db, sourcePath);
        const snapshot = await _getDocs(sourceColRef);

        if (snapshot.empty) {
            console.log(`No hay documentos en la colección de origen: ${collectionName}`);
            return; // No hay nada que copiar
        }

        const batch = _writeBatch(_db);
        snapshot.docs.forEach(sourceDoc => {
            const targetDocRef = _doc(_db, targetPath, sourceDoc.id); // Usa el mismo ID del documento
            batch.set(targetDocRef, sourceDoc.data());
        });

        await batch.commit();
        console.log(`Colección '${collectionName}' copiada exitosamente.`);
    }

})();
