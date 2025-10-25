// --- Lógica del módulo de Administración y Perfil de Usuario ---

(function() {
    // Variables locales del módulo
    // --- Añadir dependencias Firestore ---
    let _db, _userId, _userRole, _appId, _mainContent, _floatingControls, _showMainMenu, _showModal;
    let _collection, _getDocs, _doc, _setDoc, _getDoc, _writeBatch, _query, _where, _deleteDoc;
    // --- Fin Añadir ---
    let _obsequioProductId = null; // Para guardar el ID seleccionado

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
        // --- Añadir dependencias Firestore ---
        _collection = dependencies.collection;
        _getDocs = dependencies.getDocs;
        _doc = dependencies.doc;
        _getDoc = dependencies.getDoc;
        _setDoc = dependencies.setDoc;
        _writeBatch = dependencies.writeBatch;
        _query = dependencies.query;
        _where = dependencies.where;
        _deleteDoc = dependencies.deleteDoc; // Necesario para propagar eliminaciones
        // --- Fin Añadir ---
    };

    /**
     * Función principal que decide qué vista mostrar según el rol del usuario.
     */
    window.showAdminOrProfileView = function() {
        _floatingControls.classList.add('hidden');
        if (_userRole === 'admin') {
            showAdminSubMenuView(); // Mostrar submenú para admin
        } else {
            showUserProfileView();
        }
    };

    // --- NUEVO: Submenú para Admin ---
    function showAdminSubMenuView() {
         _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto max-w-md"> {/* Ajustar ancho */}
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl text-center">
                        <h1 class="text-3xl font-bold text-gray-800 mb-6">Panel de Administrador</h1>
                        <div class="space-y-4">
                            <button id="userManagementBtn" class="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700">Gestión de Usuarios</button>
                            <button id="obsequioConfigBtn" class="w-full px-6 py-3 bg-purple-600 text-white font-semibold rounded-lg shadow-md hover:bg-purple-700">Configurar Obsequio</button>
                            <button id="syncDataBtn" class="w-full px-6 py-3 bg-orange-500 text-white font-semibold rounded-lg shadow-md hover:bg-orange-600">Sincronizar Inventario Manual</button>
                            <button id="backToMenuBtn" class="w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver al Menú Principal</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
         document.getElementById('userManagementBtn').addEventListener('click', showUserManagementView);
         document.getElementById('obsequioConfigBtn').addEventListener('click', showObsequioConfigView);
         document.getElementById('syncDataBtn').addEventListener('click', showSyncDataView); // Mantener sincronización manual
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
                        {/* --- CAMBIO: Botón volver al submenú admin --- */}
                        <div class="flex justify-between items-center mb-6">
                             <h1 class="text-3xl font-bold text-gray-800 text-center flex-grow">Gestión de Usuarios</h1>
                             <button id="backToAdminMenuBtn" class="px-4 py-2 bg-gray-400 text-white text-sm font-semibold rounded-lg shadow-md hover:bg-gray-500 ml-4">Volver</button>
                        </div>
                        {/* --- FIN CAMBIO --- */}
                        <div id="user-list-container" class="overflow-x-auto max-h-96">
                            <p class="text-center text-gray-500">Cargando usuarios...</p>
                        </div>
                        {/* Se quitan botones de Sincronizar y Volver al Menú Principal de aquí */}
                    </div>
                </div>
            </div>
        `;

        document.getElementById('backToAdminMenuBtn').addEventListener('click', showAdminSubMenuView); // Volver al submenú
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
            // Ordenar usuarios alfabéticamente por email para consistencia
            const users = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .sort((a, b) => (a.email || '').localeCompare(b.email || ''));


            if (users.length === 0) {
                container.innerHTML = `<p class="text-center text-gray-500">No se encontraron usuarios.</p>`;
                return;
            }

            let tableHTML = `
                <table class="min-w-full bg-white text-sm">
                    <thead class="bg-gray-200 sticky top-0 z-10"> {/* Hacer cabecera sticky */}
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
                            <select onchange="window.adminModule.handleRoleChange('${user.id}', this.value, '${user.email || 'N/A'}')" class="w-full p-1 border rounded-lg bg-gray-50 text-sm"> {/* Ajustar tamaño texto */}
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
    async function handleRoleChange(userIdToChange, newRole, userEmail) {
        // Evitar que el admin se cambie el rol a sí mismo si es el único admin
        if (userIdToChange === _userId && newRole === 'user') {
            const usersRef = _collection(_db, "users");
            const qAdmin = _query(usersRef, _where("role", "==", "admin"));
            const adminSnapshot = await _getDocs(qAdmin);
            if (adminSnapshot.size <= 1) {
                _showModal('Acción No Permitida', 'No puedes cambiar tu propio rol si eres el único administrador.');
                renderUserList(); // Recargar para revertir cambio visual
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
                     // Opcional: recargar lista para confirmar visualmente
                     renderUserList();
                } catch (error) {
                    console.error("Error al cambiar el rol:", error);
                    _showModal('Error', 'No se pudo actualizar el rol. Asegúrate de tener permisos de administrador.');
                    renderUserList(); // Recargar la lista para revertir el cambio visual
                }
            },
            'Sí, Cambiar Rol',
             () => { renderUserList(); } // Callback para cancelar y recargar
        );
    }

    /**
     * Muestra la vista del perfil del usuario (para roles 'user').
     */
    async function showUserProfileView() {
        // ... (código sin cambios) ...
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
            } else {
                 // Si el documento no existe (caso raro), intentar crearlo
                 await _setDoc(userDocRef, { email: auth.currentUser.email, role: 'user', createdAt: new Date() });
                 console.log("Documento de perfil de usuario creado.");
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
        // ... (código sin cambios) ...
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
            // Usar merge: true para no sobrescribir email, role, etc.
            await _setDoc(userDocRef, profileData, { merge: true });
            _showModal('Éxito', 'Tu perfil ha sido actualizado correctamente.');
        } catch (error) {
            console.error("Error al guardar el perfil:", error);
            _showModal('Error', 'Hubo un error al guardar tu perfil.');
        }
    }


    // --- [INICIO] Lógica Configuración Obsequio ---
    /**
     * Muestra la vista para configurar el producto de obsequio.
     */
    async function showObsequioConfigView() {
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto max-w-lg">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl">
                        <div class="flex justify-between items-center mb-6">
                             <h1 class="text-2xl font-bold text-gray-800 text-center flex-grow">Configurar Producto Obsequio</h1>
                             <button id="backToAdminMenuBtn" class="px-4 py-2 bg-gray-400 text-white text-sm font-semibold rounded-lg shadow-md hover:bg-gray-500 ml-4">Volver</button>
                        </div>
                        <p class="text-gray-600 mb-4 text-center">Selecciona el producto que se utilizará como obsequio. Debe ser un producto que maneje vacíos y se venda por caja.</p>
                        <div class="space-y-4 text-left">
                            <div>
                                <label for="obsequioProductSelect" class="block text-gray-700 font-medium mb-1">Producto de Obsequio:</label>
                                <select id="obsequioProductSelect" class="w-full px-4 py-2 border rounded-lg">
                                    <option value="">Cargando productos...</option>
                                </select>
                            </div>
                            <button id="saveObsequioConfigBtn" class="w-full px-6 py-3 bg-purple-500 text-white font-semibold rounded-lg shadow-md hover:bg-purple-600">Guardar Configuración</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('backToAdminMenuBtn').addEventListener('click', showAdminSubMenuView);
        document.getElementById('saveObsequioConfigBtn').addEventListener('click', handleSaveObsequioConfig);

        await loadAndPopulateObsequioSelect();
    }

    /**
     * Carga el inventario del admin y popula el select de producto obsequio.
     */
    async function loadAndPopulateObsequioSelect() {
        const selectElement = document.getElementById('obsequioProductSelect');
        if (!selectElement) return;

        try {
            const inventarioRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`);
            // Filtrar directamente en Firestore si es posible, o filtrar en cliente
            // Aquí filtramos en cliente después de obtener todos
            const snapshot = await _getDocs(inventarioRef);
            const productosValidos = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(p => p.manejaVacios && p.ventaPor?.cj) // Solo los que manejan vacíos Y se venden por caja
                .sort((a, b) => `${a.marca} ${a.segmento} ${a.presentacion}`.localeCompare(`${b.marca} ${b.segmento} ${b.presentacion}`));

            selectElement.innerHTML = '<option value="">-- Seleccione un Producto --</option>'; // Opción por defecto
            if (productosValidos.length === 0) {
                 selectElement.innerHTML = '<option value="">No hay productos válidos (Maneja vacío y venta por caja)</option>';
                 selectElement.disabled = true;
                 document.getElementById('saveObsequioConfigBtn').disabled = true;
            } else {
                 productosValidos.forEach(p => {
                     selectElement.innerHTML += `<option value="${p.id}">${p.marca} - ${p.segmento} - ${p.presentacion}</option>`;
                 });
                 selectElement.disabled = false;
                 document.getElementById('saveObsequioConfigBtn').disabled = false;

                 // Cargar la configuración actual y seleccionarla
                 const configRef = _doc(_db, `artifacts/${_appId}/users/${_userId}/config/obsequio`);
                 const configSnap = await _getDoc(configRef);
                 if (configSnap.exists()) {
                     _obsequioProductId = configSnap.data().productoId;
                     if (_obsequioProductId) {
                         selectElement.value = _obsequioProductId;
                     }
                 }
            }

        } catch (error) {
            console.error("Error cargando productos para obsequio:", error);
            selectElement.innerHTML = '<option value="">Error al cargar productos</option>';
            selectElement.disabled = true;
            document.getElementById('saveObsequioConfigBtn').disabled = true;
        }
    }

    /**
     * Guarda la configuración del producto obsequio.
     */
    async function handleSaveObsequioConfig() {
        const selectedProductId = document.getElementById('obsequioProductSelect').value;
        if (!selectedProductId) {
            _showModal('Error', 'Debes seleccionar un producto de la lista.');
            return;
        }

        _showModal('Progreso', 'Guardando configuración...');
        try {
            const configRef = _doc(_db, `artifacts/${_appId}/users/${_userId}/config/obsequio`);
            // Usamos setDoc con merge:false para asegurarnos de que solo exista este campo
            await _setDoc(configRef, { productoId: selectedProductId });
            _obsequioProductId = selectedProductId; // Actualizar variable local
            _showModal('Éxito', 'Producto de obsequio configurado correctamente.');
            showAdminSubMenuView(); // Volver al submenú
        } catch (error) {
            console.error("Error guardando configuración de obsequio:", error);
            _showModal('Error', 'Hubo un error al guardar la configuración.');
        }
    }
    // --- [FIN] Lógica Configuración Obsequio ---


    // --- [INICIO] Lógica de Sincronización Manual de Admin ---

    /**
     * Muestra la vista para que el admin sincronice datos con otros usuarios (MANUALMENTE).
     */
    async function showSyncDataView() {
         _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl">
                         <div class="flex justify-between items-center mb-6">
                             <h1 class="text-2xl font-bold text-gray-800 text-center flex-grow">Sincronizar Inventario Manualmente</h1>
                             <button id="backToAdminMenuBtn" class="px-4 py-2 bg-gray-400 text-white text-sm font-semibold rounded-lg shadow-md hover:bg-gray-500 ml-4">Volver</button>
                        </div>
                         <p class="text-sm text-gray-600 mb-4 text-center">Esta herramienta copia la <strong>estructura del inventario</strong> (productos y categorías) desde una cuenta de origen a una o más cuentas de destino. <strong>Conserva las cantidades de stock</strong> de los usuarios de destino.</p>
                         <p class="text-sm text-orange-600 mb-4 text-center font-semibold">Nota: Los cambios hechos por el admin en el inventario ahora se propagan automáticamente. Usa esta herramienta solo si necesitas forzar una sincronización completa desde otra cuenta.</p>

                        <div id="sync-form-container" class="text-left space-y-4">
                            Cargando usuarios...
                        </div>

                    </div>
                </div>
            </div>
         `;
         document.getElementById('backToAdminMenuBtn').addEventListener('click', showAdminSubMenuView);

        try {
             const usersRef = _collection(_db, "users");
             const snapshot = await _getDocs(usersRef);
             const users = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .sort((a, b) => (a.email || '').localeCompare(b.email || '')); // Ordenar por email

             let sourceUserOptionsHTML = users.map(user =>
                 `<option value="${user.id}">${user.email || 'N/A'} ${user.id === _userId ? '(Yo - Admin)' : ''}</option>`
             ).join('');

             let targetUserCheckboxesHTML = users.map(user => `
                 <label class="flex items-center text-sm"> {/* Ajustar tamaño */}
                     <input type="checkbox" name="targetUsers" value="${user.id}" class="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500">
                     <span class="ml-2 text-gray-700">${user.email || 'N/A'}</span>
                 </label>
             `).join('');

             const formContainer = document.getElementById('sync-form-container');
             formContainer.innerHTML = `
                 <div>
                     <label for="sourceUserSelect" class="block text-gray-700 font-medium mb-2">1. Seleccione la cuenta de origen:</label>
                     <select id="sourceUserSelect" class="w-full p-2 border rounded-lg bg-gray-50 text-sm"> {/* Ajustar tamaño */}
                         ${sourceUserOptionsHTML}
                     </select>
                 </div>
                 <div>
                     <label class="block text-gray-700 font-medium mb-2">2. Seleccione los usuarios de destino:</label>
                     <div id="targetUsersContainer" class="space-y-2 max-h-40 overflow-y-auto border p-2 rounded-lg">
                         ${targetUserCheckboxesHTML}
                     </div>
                 </div>
                 <button id="executeSyncBtn" class="w-full px-6 py-3 bg-orange-500 text-white font-semibold rounded-lg shadow-md hover:bg-orange-600 mt-4">Sincronizar Ahora</button>
             `;

             document.getElementById('executeSyncBtn').addEventListener('click', handleAdminSync);

             // Lógica para deshabilitar el usuario de origen en la lista de destino
             const sourceSelect = document.getElementById('sourceUserSelect');
             const targetContainer = document.getElementById('targetUsersContainer');

             const updateTargetUsers = () => {
                 const selectedSourceId = sourceSelect.value;
                 const targetCheckboxes = targetContainer.querySelectorAll('input[name="targetUsers"]');
                 targetCheckboxes.forEach(checkbox => {
                     checkbox.disabled = checkbox.value === selectedSourceId;
                     if (checkbox.disabled) checkbox.checked = false; // Desmarcar si se deshabilita
                 });
             };

             sourceSelect.addEventListener('change', updateTargetUsers);
             sourceSelect.value = _userId; // Seleccionar al admin actual por defecto
             updateTargetUsers(); // Ejecutar al inicio
        } catch (error) {
             console.error("Error cargando usuarios para sincronización:", error);
             const formContainer = document.getElementById('sync-form-container');
             if(formContainer) formContainer.innerHTML = '<p class="text-red-500 text-center">Error al cargar la lista de usuarios.</p>';
        }
    }


    /**
     * Ejecuta la lógica de sincronización del admin.
     */
    async function handleAdminSync() {
        const sourceUserId = document.getElementById('sourceUserSelect')?.value;
        const targetUsersCheckboxes = document.querySelectorAll('input[name="targetUsers"]:checked');
        const targetUserIds = Array.from(targetUsersCheckboxes).map(cb => cb.value);

        if (!sourceUserId) {
             _showModal('Error', 'No se pudo determinar el usuario de origen.');
             return;
        }
        if (targetUserIds.length === 0) {
            _showModal('Error', 'Debe seleccionar al menos un usuario de destino.');
            return;
        }

        const sourceUserEmail = document.getElementById('sourceUserSelect').options[document.getElementById('sourceUserSelect').selectedIndex].text;
        const confirmationMessage = `
            <p>Estás a punto de <strong>sobrescribir la estructura del inventario</strong> (productos, rubros, segmentos, marcas) en ${targetUserIds.length} usuario(s) destino, usando los datos de <strong>${sourceUserEmail}</strong>.</p>
            <p class="mt-2">Se intentará conservar las cantidades de stock existentes en las cuentas de destino.</p>
            <p class="mt-4 font-bold text-red-600">¡Esta acción es intensiva y puede tardar! ¿Estás seguro de que quieres continuar?</p>
        `;

        _showModal('Confirmar Sincronización Manual', confirmationMessage, async () => {
            _showModal('Progreso', `Sincronizando desde ${sourceUserEmail}...`);

            try {
                // 1. Obtener los datos fuente del usuario seleccionado
                _showModal('Progreso', `1/3: Obteniendo datos de ${sourceUserEmail}...`);
                const sourceData = {};
                const collectionsToSync = ['inventario', 'rubros', 'segmentos', 'marcas'];
                for (const col of collectionsToSync) {
                    const sourcePath = `artifacts/${_appId}/users/${sourceUserId}/${col}`;
                    const snapshot = await _getDocs(_collection(_db, sourcePath));
                    // Guardar ID junto con los datos
                    if (!snapshot.empty) sourceData[col] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    else sourceData[col] = []; // Asegurar que sea un array vacío si no hay datos
                }

                // 2. Iterar sobre cada usuario de destino y aplicar la sincronización
                _showModal('Progreso', `2/3: Aplicando datos a ${targetUserIds.length} usuario(s)... (Puede tardar)`);
                let count = 0;
                for (const targetId of targetUserIds) {
                     count++;
                     _showModal('Progreso', `2/3: Aplicando a usuario ${count}/${targetUserIds.length}...`);
                     console.log(`Sincronizando para: ${targetId}`);
                    // Copiar categorías primero (sobrescribir)
                    for(const cat of ['rubros', 'segmentos', 'marcas']) {
                        await copyDataToUser(targetId, cat, sourceData[cat]);
                    }
                    // Luego, fusionar inventario conservando cantidades
                    await mergeDataForUser(targetId, 'inventario', sourceData['inventario'], 'cantidadUnidades');
                }

                 _showModal('Progreso', `3/3: Finalizando...`);
                _showModal('Éxito', 'La sincronización manual se ha completado correctamente para todos los usuarios seleccionados.');
                showAdminSubMenuView(); // Volver al submenú

            } catch (error) {
                console.error("Error durante la sincronización de admin:", error);
                _showModal('Error', `Ocurrió un error durante la sincronización: ${error.message}`);
            }
        }, 'Sí, Sincronizar');
    }


    async function mergeDataForUser(targetUserId, collectionName, sourceItems, fieldToPreserve) {
        if (!sourceItems || sourceItems.length === 0) {
             console.log(` - No hay ${collectionName} fuente para ${targetUserId}, omitiendo merge.`);
             // Opcionalmente, borrar datos existentes si no hay fuente? Depende del requisito.
             // Por ahora, solo no hacemos nada.
             return;
        }

        const targetPath = `artifacts/${_appId}/users/${targetUserId}/${collectionName}`;
        const targetRef = _collection(_db, targetPath);
        const targetSnapshot = await _getDocs(targetRef);
        // Crear un Map de los datos existentes en el destino, usando el ID del documento como clave
        const targetMap = new Map(targetSnapshot.docs.map(doc => [doc.id, doc.data()]));

        const batch = _writeBatch(_db);
        let operations = 0;
        const MAX_OPS_PER_BATCH = 490; // Límite seguro por batch

        // CAMBIO: Iterar sobre los items fuente para añadirlos o actualizarlos
        for (const item of sourceItems) {
            // Asegurarse de que el item tenga un ID (podría venir de Excel sin él)
             // Si el ID no existe en el item fuente (p.ej. importación Excel sin ID),
             // necesitamos una forma de identificarlo o generar uno nuevo.
             // Para la sincronización user-to-user, el ID siempre existirá.
            const itemId = item.id;
            if (!itemId) {
                 console.warn("Item en fuente sin ID, omitiendo:", item);
                 continue; // Omitir items sin ID claro
            }

            const { id, ...data } = item; // Separar ID del resto de los datos
            const targetDocRef = _doc(_db, targetPath, itemId); // Referencia al documento destino con el MISMO ID

            // Preservar el campo especificado si el documento ya existe en el destino
            if (targetMap.has(itemId)) {
                 const existingData = targetMap.get(itemId);
                 // Asegurarse de que el campo a preservar existe y tiene un valor, si no, usar 0 o {}
                 const preservedValue = existingData?.[fieldToPreserve] ?? (fieldToPreserve === 'saldoVacios' ? {} : 0);
                 data[fieldToPreserve] = preservedValue;
                 // Eliminar el ID del mapa para rastrear los que no se tocaron
                 targetMap.delete(itemId);
            } else {
                 // Si es un producto nuevo para este usuario, inicializar cantidad a 0
                 data[fieldToPreserve] = (fieldToPreserve === 'saldoVacios' ? {} : 0);
            }

            batch.set(targetDocRef, data); // Usar set para añadir o sobrescribir
            operations++;

             if (operations >= MAX_OPS_PER_BATCH) {
                 await batch.commit();
                 batch = _writeBatch(_db); // Nuevo batch
                 operations = 0;
             }
        }

        // CAMBIO: Decidir qué hacer con los items que SÓLO existen en el destino
        // Opción 1: Dejarlos (comportamiento actual implícito)
        // Opción 2: Eliminarlos (para que el destino sea un reflejo exacto de la fuente, excepto por 'fieldToPreserve')
         const deleteOrphans = true; // Cambiar a true si se quieren eliminar
         if (deleteOrphans) {
             for (const orphanId of targetMap.keys()) {
                 batch.delete(_doc(_db, targetPath, orphanId));
                 operations++;
                 if (operations >= MAX_OPS_PER_BATCH) {
                     await batch.commit();
                     batch = _writeBatch(_db);
                     operations = 0;
                 }
             }
         }


        // Commit final si quedan operaciones pendientes
        if (operations > 0) {
            await batch.commit();
        }
         console.log(` - Merge de ${collectionName} completado para ${targetUserId}`);
    }


    async function copyDataToUser(targetUserId, collectionName, sourceItems) {
         const targetPath = `artifacts/${_appId}/users/${targetUserId}/${collectionName}`;
         const targetCollectionRef = _collection(_db, targetPath); // Referencia a la colección destino

        // 1. Borrar datos antiguos en el destino
         _showModal('Progreso', `Limpiando ${collectionName} anterior para ${targetUserId}...`); // Mostrar progreso más detallado
         const oldSnapshot = await _getDocs(targetCollectionRef);
         if (!oldSnapshot.empty) {
             const deleteBatch = _writeBatch(_db);
             let deleteOps = 0;
             const MAX_OPS_PER_BATCH = 490;
             oldSnapshot.docs.forEach(doc => {
                 deleteBatch.delete(doc.ref);
                 deleteOps++;
                 if (deleteOps >= MAX_OPS_PER_BATCH) {
                     // Commit parcial si se alcanza el límite (improbable para categorías, pero buena práctica)
                     // await deleteBatch.commit();
                     // deleteBatch = _writeBatch(_db); // No necesario si no esperamos tantos elementos
                     // deleteOps = 0;
                 }
             });
              await deleteBatch.commit(); // Commit final de borrado
         }


        // 2. Escribir nuevos datos si existen en la fuente
         if (!sourceItems || sourceItems.length === 0) {
             console.log(` - No hay ${collectionName} fuente para ${targetUserId}, colección quedó vacía.`);
             return; // No hay nada que copiar
         }

         _showModal('Progreso', `Copiando ${collectionName} (${sourceItems.length} items) a ${targetUserId}...`);

        const writeBatch = _writeBatch(_db);
        let writeOps = 0;
        const MAX_OPS_PER_BATCH = 490;

        sourceItems.forEach(item => {
             // Asegurarse de que el item tenga un ID
             const itemId = item.id;
             if (!itemId) {
                 console.warn("Item en fuente sin ID, generando uno nuevo para copia:", item);
                 // Si no hay ID (p.ej. Excel), Firestore generará uno automáticamente con _doc(targetCollectionRef)
                 const targetDocRef = _doc(targetCollectionRef); // Genera ID automático
                 const { id, ...data } = item; // Tomar todos los datos excepto el 'id' nulo/undefined
                 writeBatch.set(targetDocRef, data);
             } else {
                 const { id, ...data } = item; // Separar ID del resto
                 const targetDocRef = _doc(_db, targetPath, itemId); // Usar ID original
                 writeBatch.set(targetDocRef, data); // Sobrescribir con los datos fuente
             }

            writeOps++;
             if (writeOps >= MAX_OPS_PER_BATCH) {
                 // Commit parcial si se alcanza el límite
                 // await writeBatch.commit();
                 // writeBatch = _writeBatch(_db); // No necesario si no esperamos tantos elementos
                 // writeOps = 0;
             }
        });

         await writeBatch.commit(); // Commit final de escritura
         console.log(` - Copia de ${collectionName} completada para ${targetUserId}`);
    }


    // --- [INICIO] Funciones de Propagación Automática ---

    /** Obtiene todos los IDs de usuarios (excluyendo al admin actual) */
    async function _getAllOtherUserIds() {
        try {
            const usersRef = _collection(_db, "users");
            const snapshot = await _getDocs(usersRef);
            // Filtrar para excluir al admin actual (_userId)
            const userIds = snapshot.docs
                .map(doc => doc.id)
                .filter(id => id !== _userId);
            return userIds;
        } catch (error) {
            console.error("Error obteniendo IDs de usuario para propagación:", error);
            _showModal('Error Interno', 'No se pudo obtener la lista de usuarios para actualizar.');
            return []; // Devolver array vacío en caso de error
        }
    }


    /**
     * Propaga un cambio (añadir/actualizar/eliminar) de un producto a todos los demás usuarios.
     * @param {string} productId - El ID del documento del producto.
     * @param {object|null} productData - Los datos completos del producto para añadir/actualizar, o null para eliminar.
     */
    async function propagateProductChange(productId, productData) {
        if (!productId) return; // Necesario ID

        const otherUserIds = await _getAllOtherUserIds();
        if (otherUserIds.length === 0) return; // No hay otros usuarios

        _showModal('Progreso', `Propagando cambios del producto a ${otherUserIds.length} usuario(s)...`);

        const BATCH_LIMIT = 490; // Límite seguro
        let batch = _writeBatch(_db);
        let operations = 0;

        try {
            for (const targetUserId of otherUserIds) {
                const targetProductRef = _doc(_db, `artifacts/${_appId}/users/${targetUserId}/inventario`, productId);

                if (productData === null) { // --- Eliminación ---
                    batch.delete(targetProductRef);
                } else { // --- Añadir / Actualizar ---
                    // 1. Obtener la cantidad actual del usuario destino (si existe)
                    let currentQuantity = 0;
                    try {
                        const targetDocSnap = await _getDoc(targetProductRef); // Leer individualmente
                        if (targetDocSnap.exists()) {
                            currentQuantity = targetDocSnap.data().cantidadUnidades || 0;
                        }
                    } catch (readError) {
                         console.warn(`No se pudo leer producto ${productId} para usuario ${targetUserId} antes de actualizar:`, readError);
                         // Continuar asumiendo cantidad 0 si no se pudo leer
                    }

                    // 2. Crear los datos a guardar, asegurando conservar la cantidad
                    const dataToSet = {
                        ...productData, // Todos los datos nuevos/actualizados
                        cantidadUnidades: currentQuantity // Sobrescribir con la cantidad existente
                    };
                    batch.set(targetProductRef, dataToSet); // set sobrescribe completamente
                }

                operations++;
                if (operations >= BATCH_LIMIT) {
                    await batch.commit();
                    batch = _writeBatch(_db); // Nuevo batch
                    operations = 0;
                }
            } // Fin del bucle for

            // Commit final si quedan operaciones
            if (operations > 0) {
                await batch.commit();
            }

             _showModal('Éxito', 'Cambios del producto propagados correctamente.'); // O solo cerrar el modal de progreso

        } catch (error) {
            console.error("Error propagando cambio de producto:", error);
            _showModal('Error', `Error al propagar cambio de producto: ${error.message}`);
        }
    }


     /**
     * Propaga un cambio (añadir/actualizar/eliminar) de una categoría a todos los demás usuarios.
     * @param {string} collectionName - Nombre de la colección ('rubros', 'segmentos', 'marcas').
     * @param {string} itemId - El ID del documento del item.
     * @param {object|null} itemData - Los datos completos del item para añadir/actualizar, o null para eliminar.
     */
     async function propagateCategoryChange(collectionName, itemId, itemData) {
         if (!collectionName || !itemId) return;

         const otherUserIds = await _getAllOtherUserIds();
         if (otherUserIds.length === 0) return;

         _showModal('Progreso', `Propagando cambio de categoría '${collectionName}' a ${otherUserIds.length} usuario(s)...`);

         const BATCH_LIMIT = 490;
         let batch = _writeBatch(_db);
         let operations = 0;

         try {
             for (const targetUserId of otherUserIds) {
                 const targetItemRef = _doc(_db, `artifacts/${_appId}/users/${targetUserId}/${collectionName}`, itemId);

                 if (itemData === null) { // --- Eliminación ---
                     batch.delete(targetItemRef);
                 } else { // --- Añadir / Actualizar ---
                     // Para categorías, simplemente sobrescribimos con los datos del admin
                     batch.set(targetItemRef, itemData);
                 }

                 operations++;
                 if (operations >= BATCH_LIMIT) {
                     await batch.commit();
                     batch = _writeBatch(_db);
                     operations = 0;
                 }
             } // Fin del bucle for

             if (operations > 0) {
                 await batch.commit();
             }
              // Cerrar modal de progreso o mostrar éxito brevemente
              const modalContainer = document.getElementById('modalContainer');
              if(modalContainer) modalContainer.classList.add('hidden');
              console.log(`Cambio de categoría ${collectionName} propagado.`);


         } catch (error) {
             console.error(`Error propagando cambio de categoría ${collectionName}:`, error);
             _showModal('Error', `Error al propagar cambio de categoría: ${error.message}`);
         }
     }

     /**
      * Propaga el orden de una categoría a todos los demás usuarios.
      * @param {string} collectionName - 'rubros', 'segmentos', 'marcas'.
      * @param {string[]} orderedIds - Array de IDs en el nuevo orden.
      */
     async function propagateCategoryOrderChange(collectionName, orderedIds) {
          if (!collectionName || !orderedIds || orderedIds.length === 0) return;

          const otherUserIds = await _getAllOtherUserIds();
          if (otherUserIds.length === 0) return;

          _showModal('Progreso', `Propagando orden de '${collectionName}' a ${otherUserIds.length} usuario(s)...`);

          const BATCH_LIMIT = 490; // Firestore limit per batch

          try {
              for (const targetUserId of otherUserIds) {
                  let batch = _writeBatch(_db);
                  let operations = 0;
                  console.log(`Actualizando orden de ${collectionName} para ${targetUserId}`);

                  // Crear un mapa de ID a índice para la búsqueda rápida
                  const orderMap = new Map(orderedIds.map((id, index) => [id, index]));

                  // Obtener TODOS los documentos de la categoría para este usuario
                  // Esto es necesario porque algunos podrían no estar en orderedIds si fueron filtrados
                  const targetCollectionRef = _collection(_db, `artifacts/${_appId}/users/${targetUserId}/${collectionName}`);
                  const snapshot = await _getDocs(targetCollectionRef);

                  let maxOrder = orderedIds.length -1; // Para items no presentes en la lista ordenada

                  for (const docSnap of snapshot.docs) {
                      const itemId = docSnap.id;
                      const currentData = docSnap.data();
                      const currentOrder = currentData.orden;
                      let newOrder;

                      if (orderMap.has(itemId)) {
                          newOrder = orderMap.get(itemId);
                      } else {
                           // Si el item existe en el usuario pero no en la lista ordenada del admin
                           // (pudo ser filtrado por rubro), le asignamos un orden alto para ponerlo al final.
                           // O podríamos simplemente no tocar su orden actual. Decidimos ponerlo al final.
                           maxOrder++;
                           newOrder = maxOrder;
                           console.warn(`Item ${itemId} (${currentData.name}) de ${collectionName} no encontrado en la lista ordenada del admin para ${targetUserId}. Asignando orden ${newOrder}.`);
                      }


                      // Solo actualizar si el orden es diferente
                      if (currentOrder !== newOrder) {
                          const targetItemRef = _doc(_db, `artifacts/${_appId}/users/${targetUserId}/${collectionName}`, itemId);
                          batch.update(targetItemRef, { orden: newOrder });
                          operations++;

                          if (operations >= BATCH_LIMIT) {
                              console.log(`Commit parcial de orden para ${targetUserId} (${operations} ops)`);
                              await batch.commit();
                              batch = _writeBatch(_db); // Nuevo batch
                              operations = 0;
                          }
                      }
                  } // Fin bucle documentos del usuario

                  // Commit final para este usuario si quedan operaciones
                  if (operations > 0) {
                      console.log(`Commit final de orden para ${targetUserId} (${operations} ops)`);
                      await batch.commit();
                  }
              } // Fin bucle usuarios

               // Cerrar modal de progreso o mostrar éxito brevemente
               const modalContainer = document.getElementById('modalContainer');
               if(modalContainer) modalContainer.classList.add('hidden');
               console.log(`Orden de ${collectionName} propagado.`);


          } catch (error) {
              console.error(`Error propagando orden de ${collectionName}:`, error);
              _showModal('Error', `Error al propagar orden de categoría: ${error.message}`);
          }
     }


    // --- [FIN] Funciones de Propagación Automática ---


    // Exponer funciones públicas al objeto window
    window.adminModule = {
        handleRoleChange,
        // --- NUEVO: Exponer funciones de propagación ---
        propagateProductChange,
        propagateCategoryChange,
        propagateCategoryOrderChange
        // --- FIN NUEVO ---
    };

})();

