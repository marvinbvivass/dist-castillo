// --- Lógica del módulo de Administración y Perfil de Usuario ---

(function() {
    // Variables locales del módulo
    // --- NUEVO: Añadir _populateDropdown ---
    let _db, _userId, _userRole, _appId, _mainContent, _floatingControls, _showMainMenu, _showModal, _collection, _getDocs, _doc, _setDoc, _getDoc, _writeBatch, _populateDropdown;
    // --- FIN NUEVO ---

    /**
     * Inicializa el módulo con las dependencias necesarias.
     */
    window.initAdmin = function(dependencies) {
        _db = dependencies.db;
        _userId = dependencies.userId;
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
        // --- NUEVO ---
        _populateDropdown = dependencies.populateDropdown;
        // --- FIN NUEVO ---
    };

    /**
     * Función principal que decide qué vista mostrar según el rol del usuario.
     */
    window.showAdminOrProfileView = function() {
        _floatingControls.classList.add('hidden');
        if (_userRole === 'admin') {
            showAdminMenuView(); // Mostrar menú admin en lugar de directo a usuarios
        } else {
            showUserProfileView();
        }
    };

    // --- NUEVO: Menú de Administración ---
    /**
     * Muestra el menú principal de administración.
     */
    function showAdminMenuView() {
         _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto max-w-lg">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl text-center">
                        <h1 class="text-3xl font-bold text-gray-800 mb-6">Administración</h1>
                        <div class="space-y-4">
                            <button id="userManagementBtn" class="w-full px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg shadow-md hover:bg-blue-600">Gestión de Usuarios</button>
                            <button id="syncDataBtn" class="w-full px-6 py-3 bg-orange-500 text-white font-semibold rounded-lg shadow-md hover:bg-orange-600">Sincronizar Datos de Inventario</button>
                            <button id="obsequioConfigBtn" class="w-full px-6 py-3 bg-teal-500 text-white font-semibold rounded-lg shadow-md hover:bg-teal-600">Configurar Producto de Obsequio</button>
                            <button id="backToMenuBtn" class="w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver al Menú Principal</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('userManagementBtn').addEventListener('click', showUserManagementView);
        document.getElementById('syncDataBtn').addEventListener('click', showSyncDataView);
        document.getElementById('obsequioConfigBtn').addEventListener('click', showObsequioConfigView);
        document.getElementById('backToMenuBtn').addEventListener('click', _showMainMenu);
    }
    // --- FIN NUEVO ---

    /**
     * Muestra la vista de gestión de usuarios (solo para administradores).
     */
    function showUserManagementView() {
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl">
                        <h1 class="text-3xl font-bold text-gray-800 mb-6 text-center">Gestión de Usuarios</h1>
                        <div id="user-list-container" class="overflow-x-auto max-h-96">
                            <p class="text-center text-gray-500">Cargando usuarios...</p>
                        </div>
                        <div class="mt-6 flex flex-col sm:flex-row gap-4">
                            <!-- CAMBIO: Volver al menú admin -->
                            <button id="backToAdminMenuBtn" class="w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver</button>
                            <!-- FIN CAMBIO -->
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('backToAdminMenuBtn').addEventListener('click', showAdminMenuView); // <-- CAMBIO
        renderUserList();
    };

    /**
     * Obtiene los usuarios de la colección 'users' y los renderiza en una tabla.
     */
    async function renderUserList() {
        const container = document.getElementById('user-list-container');
        if (!container) return;

        try {
            const usersRef = _collection(_db, "users");
            const snapshot = await _getDocs(usersRef);
            const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            if (users.length === 0) {
                container.innerHTML = `<p class="text-center text-gray-500">No se encontraron usuarios.</p>`;
                return;
            }

            let tableHTML = `
                <table class="min-w-full bg-white text-sm">
                    <thead class="bg-gray-200">
                        <tr>
                            <th class="py-2 px-4 border-b text-left">Email</th>
                            <th class="py-2 px-4 border-b text-left">Rol</th>
                        </tr>
                    </thead>
                    <tbody>`;
            
            users.forEach(user => {
                tableHTML += `
                    <tr class="hover:bg-gray-50">
                        <td class="py-2 px-4 border-b">${user.email}</td>
                        <td class="py-2 px-4 border-b">
                            <select onchange="window.adminModule.handleRoleChange('${user.id}', this.value, '${user.email}')" class="w-full p-1 border rounded-lg bg-gray-50">
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

    /**
     * Maneja el cambio de rol de un usuario.
     */
    async function handleRoleChange(userId, newRole, userEmail) {
        _showModal(
            'Confirmar Cambio de Rol',
            `¿Estás seguro de que quieres cambiar el rol de <strong>${userEmail}</strong> a <strong>${newRole}</strong>?`,
            async () => {
                _showModal('Progreso', 'Actualizando rol...');
                try {
                    const userDocRef = _doc(_db, "users", userId);
                    await _setDoc(userDocRef, { role: newRole }, { merge: true });
                    _showModal('Éxito', 'El rol del usuario ha sido actualizado.');
                } catch (error) {
                    console.error("Error al cambiar el rol:", error);
                    _showModal('Error', 'No se pudo actualizar el rol. Asegúrate de tener permisos de administrador.');
                    renderUserList(); // Recargar la lista para revertir el cambio visual
                }
            },
            'Sí, Cambiar Rol'
        );
    }

    /**
     * Muestra la vista del perfil del usuario (para roles 'user').
     */
    async function showUserProfileView() {
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

        // Cargar y mostrar los datos del perfil actual
        try {
            const userDocRef = _doc(_db, "users", _userId);
            const userDoc = await _getDoc(userDocRef);
            if (userDoc.exists()) {
                const data = userDoc.data();
                document.getElementById('profileNombre').value = data.nombre || '';
                document.getElementById('profileApellido').value = data.apellido || '';
                document.getElementById('profileCamion').value = data.camion || '';
            }
        } catch (error) {
            console.error("Error al cargar el perfil del usuario:", error);
            _showModal('Error', 'No se pudo cargar la información de tu perfil.');
        }
    }

    /**
     * Guarda los datos del perfil del usuario.
     */
    async function handleSaveProfile(e) {
        e.preventDefault();
        const nombre = document.getElementById('profileNombre').value.trim();
        const apellido = document.getElementById('profileApellido').value.trim();
        const camion = document.getElementById('profileCamion').value.trim();

        if (!nombre || !apellido) {
            _showModal('Error', 'El nombre y el apellido son obligatorios.');
            return;
        }

        const profileData = {
            nombre,
            apellido,
            camion
        };

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

    // --- Lógica de Sincronización de Admin ---

    /**
     * Muestra la vista para que el admin sincronice datos con otros usuarios.
     */
    async function showSyncDataView() {
        // --- CAMBIO: Volver al menú admin ---
        const usersRef = _collection(_db, "users");
        const snapshot = await _getDocs(usersRef);
        const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        let sourceUserOptionsHTML = users.map(user =>
            `<option value="${user.id}">${user.email} ${user.id === _userId ? '(Yo)' : ''}</option>`
        ).join('');

        let targetUserCheckboxesHTML = users.map(user => `
            <label class="flex items-center">
                <input type="checkbox" name="targetUsers" value="${user.id}" class="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500">
                <span class="ml-2 text-gray-700">${user.email}</span>
            </label>
        `).join('');

        _mainContent.innerHTML = `
             <div class="p-4 pt-8">
                 <div class="container mx-auto max-w-lg">
                     <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl">
                         <h3 class="text-2xl font-bold text-gray-800 mb-4 text-center">Sincronizar Datos de Inventario</h3>
                         <div class="text-left space-y-4">
                              <div>
                                 <p class="text-sm text-gray-600">Esta herramienta copiará el <strong>inventario y sus categorías (rubros, segmentos, marcas)</strong> desde una cuenta de origen a una o más cuentas de destino. Las cantidades de stock de los usuarios de destino se conservarán.</p>
                             </div>
                             <div>
                                 <label for="sourceUserSelect" class="block text-gray-700 font-medium mb-2">1. Seleccione la cuenta de origen:</label>
                                 <select id="sourceUserSelect" class="w-full p-2 border rounded-lg bg-gray-50">
                                     ${sourceUserOptionsHTML}
                                 </select>
                             </div>
                             <div>
                                 <label class="block text-gray-700 font-medium mb-2">2. Seleccione los usuarios de destino:</label>
                                 <div id="targetUsersContainer" class="space-y-2 max-h-40 overflow-y-auto border p-2 rounded-lg">
                                     ${targetUserCheckboxesHTML}
                                 </div>
                             </div>
                             <div class="mt-6 flex flex-col sm:flex-row gap-4">
                                <button id="backToAdminMenuBtn" class="w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver</button>
                                <button id="confirmSyncBtn" class="w-full px-6 py-3 bg-orange-500 text-white font-semibold rounded-lg shadow-md hover:bg-orange-600">Sincronizar Ahora</button>
                             </div>
                         </div>
                    </div>
                </div>
            </div>
        `;
        // --- FIN CAMBIO ---

        document.getElementById('backToAdminMenuBtn').addEventListener('click', showAdminMenuView); // <-- CAMBIO
        document.getElementById('confirmSyncBtn').addEventListener('click', handleAdminSync); // <-- CAMBIO

        // Lógica para deshabilitar el usuario de origen en la lista de destino
        const sourceSelect = document.getElementById('sourceUserSelect');
        const targetContainer = document.getElementById('targetUsersContainer');
        
        const updateTargetUsers = () => {
            const selectedSourceId = sourceSelect.value;
            const targetCheckboxes = targetContainer.querySelectorAll('input[name="targetUsers"]');
            targetCheckboxes.forEach(checkbox => {
                checkbox.disabled = checkbox.value === selectedSourceId;
                if (checkbox.disabled) checkbox.checked = false;
            });
        };

        sourceSelect.addEventListener('change', updateTargetUsers);
        sourceSelect.value = _userId; // Seleccionar al admin actual por defecto
        updateTargetUsers(); // Ejecutar al inicio
    }


    /**
     * Ejecuta la lógica de sincronización del admin.
     */
    async function handleAdminSync() {
        const sourceUserId = document.getElementById('sourceUserSelect').value;
        const targetUsersCheckboxes = document.querySelectorAll('input[name="targetUsers"]:checked');
        const targetUserIds = Array.from(targetUsersCheckboxes).map(cb => cb.value);

        if (targetUserIds.length === 0) {
            _showModal('Error', 'Debe seleccionar al menos un usuario de destino.');
            return;
        }

        const sourceUserOption = document.getElementById('sourceUserSelect').selectedOptions[0];
        const sourceUserEmail = sourceUserOption ? sourceUserOption.text.split(' ')[0] : 'desconocido'; // Extraer email
        const confirmationMessage = `
            <p>Estás a punto de sincronizar el inventario desde <strong>${sourceUserEmail}</strong> con <strong>${targetUserIds.length}</strong> usuario(s).</p>
            <p class="mt-2 font-bold text-red-600">¡Atención! Esto sobreescribirá la estructura del inventario en las cuentas de destino, pero se conservarán las cantidades de stock existentes.</p>
            <p class="mt-4 font-bold">¿Estás seguro de que quieres continuar?</p>
        `;

        _showModal('Confirmar Sincronización', confirmationMessage, async () => {
            _showModal('Progreso', `Sincronizando...`);
            
            try {
                // 1. Obtener los datos fuente del usuario seleccionado
                const sourceData = {};
                const collections = ['inventario', 'rubros', 'segmentos', 'marcas'];
                for (const col of collections) {
                    const sourcePath = `artifacts/${_appId}/users/${sourceUserId}/${col}`;
                    const snapshot = await _getDocs(_collection(_db, sourcePath));
                    sourceData[col] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); // Guardar siempre, incluso si está vacío
                }
                
                // 2. Iterar sobre cada usuario de destino y aplicar la sincronización
                for (const targetId of targetUserIds) {
                    // Copiar categorías primero (sobrescribir)
                    for(const cat of ['rubros', 'segmentos', 'marcas']) {
                        await copyDataToUser(targetId, cat, sourceData[cat]);
                    }
                    // Luego, fusionar inventario conservando cantidades
                    await mergeDataForUser(targetId, 'inventario', sourceData['inventario'], 'cantidadUnidades');
                }

                _showModal('Éxito', 'La sincronización se ha completado correctamente para todos los usuarios seleccionados.');
                showAdminMenuView(); // Volver al menú admin después del éxito

            } catch (error) {
                console.error("Error durante la sincronización de admin:", error);
                _showModal('Error', `Ocurrió un error: ${error.message}`);
            }
        }, 'Sí, Sincronizar'); // Texto del botón de confirmación
    }

    // --- NUEVO: Función para poblar dropdown de inventario ---
    /**
     * Popula un dropdown con los productos del inventario del admin.
     * @param {string} elementId - ID del elemento select.
     * @param {string} selectedValue - ID del producto a seleccionar por defecto.
     */
    async function populateInventarioDropdown(elementId, selectedValue = null) {
        const selectElement = document.getElementById(elementId);
        if (!selectElement) return;
        selectElement.innerHTML = '<option value="">Cargando inventario...</option>';

        try {
            const inventarioRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`); // Siempre usa el inventario del admin
            const snapshot = await _getDocs(inventarioRef);
            const productos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
                                         .sort((a,b) => `${a.marca} ${a.segmento} ${a.presentacion}`.localeCompare(`${b.marca} ${b.segmento} ${b.presentacion}`));

            selectElement.innerHTML = '<option value="">-- Seleccione un producto --</option>';
            productos.forEach(p => {
                const selected = p.id === selectedValue ? ' selected' : '';
                selectElement.innerHTML += `<option value="${p.id}"${selected}>${p.marca} - ${p.segmento} - ${p.presentacion}</option>`;
            });
        } catch (error) {
            console.error("Error al cargar inventario para dropdown:", error);
            selectElement.innerHTML = '<option value="">Error al cargar</option>';
        }
    }
    // --- FIN NUEVO ---


    // --- NUEVO: Lógica para Configurar Obsequio ---
    /**
     * Muestra la vista para configurar el producto de obsequio.
     */
    async function showObsequioConfigView() {
         _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto max-w-lg">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl">
                        <h1 class="text-3xl font-bold text-gray-800 mb-6 text-center">Configurar Producto de Obsequio</h1>
                        <p class="text-center text-gray-600 mb-6">Selecciona el producto que se utilizará como obsequio en la gestión correspondiente.</p>
                        <div class="space-y-4 text-left">
                            <div>
                                <label for="obsequioProductoSelect" class="block text-gray-700 font-medium mb-2">Producto de Obsequio:</label>
                                <select id="obsequioProductoSelect" class="w-full px-4 py-2 border rounded-lg bg-gray-50">
                                    <option value="">Cargando...</option>
                                </select>
                            </div>
                            <button id="saveObsequioConfigBtn" class="w-full px-6 py-3 bg-teal-500 text-white font-semibold rounded-lg shadow-md hover:bg-teal-600">Guardar Configuración</button>
                        </div>
                        <button id="backToAdminMenuBtn" class="mt-6 w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver</button>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('backToAdminMenuBtn').addEventListener('click', showAdminMenuView);
        document.getElementById('saveObsequioConfigBtn').addEventListener('click', handleSaveObsequioConfig);

        // Cargar configuración actual y poblar dropdown
        try {
            const configRef = _doc(_db, `artifacts/${_appId}/users/${_userId}/config/obsequio`);
            const configSnap = await _getDoc(configRef);
            const currentProductId = configSnap.exists() ? configSnap.data().productoId : null;
            await populateInventarioDropdown('obsequioProductoSelect', currentProductId);
        } catch (error) {
            console.error("Error al cargar configuración de obsequio:", error);
            document.getElementById('obsequioProductoSelect').innerHTML = '<option value="">Error al cargar</option>';
        }
    }

    /**
     * Guarda la configuración del producto de obsequio.
     */
    async function handleSaveObsequioConfig() {
        const selectedProductId = document.getElementById('obsequioProductoSelect').value;

        if (!selectedProductId) {
            _showModal('Aviso', 'Por favor, seleccione un producto para guardar la configuración.');
            return;
        }

        _showModal('Progreso', 'Guardando configuración...');
        try {
            const configRef = _doc(_db, `artifacts/${_appId}/users/${_userId}/config/obsequio`);
            await _setDoc(configRef, { productoId: selectedProductId });
            _showModal('Éxito', 'Producto de obsequio configurado correctamente.');
            showAdminMenuView(); // Volver al menú admin
        } catch (error) {
            console.error("Error al guardar configuración de obsequio:", error);
            _showModal('Error', 'No se pudo guardar la configuración.');
        }
    }
    // --- FIN NUEVO ---


    async function mergeDataForUser(targetUserId, collectionName, sourceItems, fieldToPreserve) {
        if (!sourceItems) return; // Permitir sourceItems vacío o nulo

        const targetPath = `artifacts/${_appId}/users/${targetUserId}/${collectionName}`;
        const targetRef = _collection(_db, targetPath);
        const targetSnapshot = await _getDocs(targetRef);
        const targetMap = new Map(targetSnapshot.docs.map(doc => [doc.id, doc.data()]));

        const batch = _writeBatch(_db);

        sourceItems.forEach(item => {
            const { id, ...data } = item;
            if (!id) {
                console.warn(`Item en ${collectionName} sin ID, omitiendo:`, data);
                return; // Omitir items sin ID
            }
            const targetDocRef = _doc(_db, targetPath, id); // Usar ID existente

            const preservedValue = targetMap.get(id)?.[fieldToPreserve];
            // Si el campo a preservar existe en el destino, usarlo. Si no, usar 0 o {}
            data[fieldToPreserve] = preservedValue !== undefined ? preservedValue : (fieldToPreserve === 'saldoVacios' ? {} : 0);

            batch.set(targetDocRef, data);
        });

        // Opcional: Eliminar documentos en destino que no están en origen (si se desea una sincronización completa)
        /*
        targetSnapshot.docs.forEach(doc => {
            if (!sourceItems.some(item => item.id === doc.id)) {
                batch.delete(doc.ref);
            }
        });
        */

        await batch.commit();
    }


    async function copyDataToUser(targetUserId, collectionName, sourceItems) {
        const targetPath = `artifacts/${_appId}/users/${targetUserId}/${collectionName}`;
        const batch = _writeBatch(_db);

        // Borrar datos antiguos para asegurar una copia limpia
        const oldSnapshot = await _getDocs(_collection(_db, targetPath));
        oldSnapshot.docs.forEach(doc => batch.delete(doc.ref));

        // Escribir nuevos datos si existen
        if (sourceItems && sourceItems.length > 0) {
            sourceItems.forEach(item => {
                const { id, ...data } = item;
                 if (!id) {
                    console.warn(`Item en ${collectionName} sin ID durante copia, omitiendo:`, data);
                    return; // Omitir items sin ID
                }
                const targetDocRef = _doc(_db, targetPath, id); // Usar ID existente
                batch.set(targetDocRef, data);
            });
        }

        await batch.commit();
    }


    // Exponer funciones públicas al objeto window
    window.adminModule = {
        handleRoleChange
    };

})();
