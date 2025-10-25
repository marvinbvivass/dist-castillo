(function() {
    let _db, _userId, _userRole, _appId, _mainContent, _floatingControls, _showMainMenu, _showModal;
    let _collection, _getDocs, _doc, _setDoc, _getDoc, _writeBatch, _query, _where, _deleteDoc;
    let _obsequioProductId = null;

    window.initAdmin = function(dependencies) {
        if (!dependencies.db || !dependencies.mainContent || !dependencies.showMainMenu || !dependencies.showModal) {
            console.error("Admin Init Error: Missing critical dependencies (db, mainContent, showMainMenu, showModal)");
            return;
        }

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
        _query = dependencies.query;
        _where = dependencies.where;
        _deleteDoc = dependencies.deleteDoc;

        if (!_floatingControls) {
            console.warn("Admin Init Warning: floatingControls element was not provided or found. Floating buttons might not function correctly.");
        }
    };

    window.showAdminOrProfileView = function() {
        if (_floatingControls) {
            _floatingControls.classList.add('hidden');
        } else {
            console.warn("showAdminOrProfileView: floatingControls not available.");
        }
        if (_userRole === 'admin') {
            showAdminSubMenuView();
        } else {
            showUserProfileView();
        }
    };

    function showAdminSubMenuView() {
        if (_floatingControls) {
            _floatingControls.classList.add('hidden');
        }
         _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto max-w-md">
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
         document.getElementById('syncDataBtn').addEventListener('click', showSyncDataView);
         document.getElementById('backToMenuBtn').addEventListener('click', _showMainMenu);
    }

    function showUserManagementView() {
         if (_floatingControls) {
            _floatingControls.classList.add('hidden');
        }
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
         if (_floatingControls) {
            _floatingControls.classList.add('hidden');
        }
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
                 await _setDoc(userDocRef, { email: auth.currentUser.email, role: 'user', createdAt: new Date() });
                 console.log("Documento de perfil de usuario creado.");
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
         if (_floatingControls) {
            _floatingControls.classList.add('hidden');
        }
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto max-w-lg">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl">
                        <div class="flex justify-between items-center mb-6">
                             <h1 class="text-2xl font-bold text-gray-800 text-center flex-grow">Configurar Producto Obsequio</h1>
                             <button id="backToAdminMenuBtn" class="px-4 py-2 bg-gray-400 text-white text-sm font-semibold rounded-lg shadow-md hover:bg-gray-500 ml-4 flex-shrink-0">Volver</button>
                        </div>
                        <p class="text-gray-600 mb-4 text-center text-sm">Selecciona el producto que se utilizará como obsequio. Debe manejar vacíos y venderse por caja.</p>
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

    async function loadAndPopulateObsequioSelect() {
        const selectElement = document.getElementById('obsequioProductSelect');
        if (!selectElement) return;

        try {
            const inventarioRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`);
            const snapshot = await _getDocs(inventarioRef);
            const productosValidos = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(p => p.manejaVacios && p.ventaPor?.cj)
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
             const saveBtn = document.getElementById('saveObsequioConfigBtn');
             if (saveBtn) saveBtn.disabled = true;
        }
    }

    async function handleSaveObsequioConfig() {
        const selectedProductId = document.getElementById('obsequioProductSelect').value;
        if (!selectedProductId) {
            _showModal('Error', 'Debes seleccionar un producto de la lista.');
            return;
        }
        _showModal('Progreso', 'Guardando configuración...');
        try {
            const configRef = _doc(_db, `artifacts/${_appId}/users/${_userId}/config/obsequio`);
            await _setDoc(configRef, { productoId: selectedProductId });
            _obsequioProductId = selectedProductId;
            _showModal('Éxito', 'Producto de obsequio configurado correctamente.');
            showAdminSubMenuView();
        } catch (error) {
            console.error("Error guardando configuración de obsequio:", error);
            _showModal('Error', 'Hubo un error al guardar la configuración.');
        }
    }

    async function showSyncDataView() {
         if (_floatingControls) {
            _floatingControls.classList.add('hidden');
        }
         _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl">
                         <div class="flex justify-between items-center mb-6">
                             <h1 class="text-2xl font-bold text-gray-800 text-center flex-grow">Sincronizar Inventario Manualmente</h1>
                             <button id="backToAdminMenuBtn" class="px-4 py-2 bg-gray-400 text-white text-sm font-semibold rounded-lg shadow-md hover:bg-gray-500 ml-4 flex-shrink-0">Volver</button>
                        </div>
                         <p class="text-sm text-gray-600 mb-4 text-center">Copia la <strong>estructura del inventario</strong> (productos y categorías) desde un origen a uno o más destinos. <strong>Conserva cantidades de stock</strong> de los destinos.</p>
                         <p class="text-sm text-orange-600 mb-4 text-center font-semibold">Nota: Cambios del admin se propagan automáticamente. Usa esto solo para forzar una sincronización completa desde otra cuenta.</p>
                        <div id="sync-form-container" class="text-left space-y-4">Cargando usuarios...</div>
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
                .sort((a, b) => (a.email || '').localeCompare(b.email || ''));

             let sourceUserOptionsHTML = users.map(user => `<option value="${user.id}">${user.email || 'N/A'} ${user.id === _userId ? '(Yo - Admin)' : ''}</option>`).join('');
             let targetUserCheckboxesHTML = users.map(user => `<label class="flex items-center text-sm"><input type="checkbox" name="targetUsers" value="${user.id}" class="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"><span class="ml-2 text-gray-700">${user.email || 'N/A'}</span></label>`).join('');

             const formContainer = document.getElementById('sync-form-container');
             formContainer.innerHTML = `
                 <div>
                     <label for="sourceUserSelect" class="block text-gray-700 font-medium mb-2">1. Seleccione cuenta origen:</label>
                     <select id="sourceUserSelect" class="w-full p-2 border rounded-lg bg-gray-50 text-sm">${sourceUserOptionsHTML}</select>
                 </div>
                 <div>
                     <label class="block text-gray-700 font-medium mb-2">2. Seleccione usuarios destino:</label>
                     <div id="targetUsersContainer" class="space-y-2 max-h-40 overflow-y-auto border p-2 rounded-lg">${targetUserCheckboxesHTML}</div>
                 </div>
                 <button id="executeSyncBtn" class="w-full px-6 py-3 bg-orange-500 text-white font-semibold rounded-lg shadow-md hover:bg-orange-600 mt-4">Sincronizar Ahora</button>
             `;
             document.getElementById('executeSyncBtn').addEventListener('click', handleAdminSync);
             const sourceSelect = document.getElementById('sourceUserSelect');
             const targetContainer = document.getElementById('targetUsersContainer');
             const updateTargetUsers = () => {
                 const selectedSourceId = sourceSelect.value;
                 const targetCheckboxes = targetContainer.querySelectorAll('input[name="targetUsers"]');
                 targetCheckboxes.forEach(checkbox => { checkbox.disabled = checkbox.value === selectedSourceId; if (checkbox.disabled) checkbox.checked = false; });
             };
             sourceSelect.addEventListener('change', updateTargetUsers);
             sourceSelect.value = _userId;
             updateTargetUsers();
        } catch (error) {
             console.error("Error cargando usuarios para sincronización:", error);
             const formContainer = document.getElementById('sync-form-container');
             if(formContainer) formContainer.innerHTML = '<p class="text-red-500 text-center">Error al cargar la lista de usuarios.</p>';
        }
    }

    async function handleAdminSync() {
        const sourceUserId = document.getElementById('sourceUserSelect')?.value;
        const targetUsersCheckboxes = document.querySelectorAll('input[name="targetUsers"]:checked');
        const targetUserIds = Array.from(targetUsersCheckboxes).map(cb => cb.value);

        if (!sourceUserId) { _showModal('Error', 'No se pudo determinar el usuario de origen.'); return; }
        if (targetUserIds.length === 0) { _showModal('Error', 'Debe seleccionar al menos un usuario de destino.'); return; }

        const sourceUserOption = document.getElementById('sourceUserSelect').options[document.getElementById('sourceUserSelect').selectedIndex];
        const sourceUserEmail = sourceUserOption ? sourceUserOption.text : 'Desconocido';
        const confirmationMessage = `<p>Sobrescribir estructura de inventario en ${targetUserIds.length} usuario(s) destino, usando datos de <strong>${sourceUserEmail}</strong>.</p><p class="mt-2">Se conservarán cantidades de stock destino.</p><p class="mt-4 font-bold text-red-600">¡Acción intensiva y puede tardar! ¿Continuar?</p>`;

        _showModal('Confirmar Sincronización Manual', confirmationMessage, async () => {
            _showModal('Progreso', `Sincronizando desde ${sourceUserEmail}...`);
            let errorsOccurred = false;
            try {
                _showModal('Progreso', `1/3: Obteniendo datos de ${sourceUserEmail}...`);
                const sourceData = {};
                const collectionsToSync = ['inventario', 'rubros', 'segmentos', 'marcas'];
                for (const col of collectionsToSync) {
                    const sourcePath = `artifacts/${_appId}/users/${sourceUserId}/${col}`;
                    const snapshot = await _getDocs(_collection(_db, sourcePath));
                    sourceData[col] = !snapshot.empty ? snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) : [];
                }
                _showModal('Progreso', `2/3: Aplicando datos a ${targetUserIds.length} usuario(s)...`);
                let count = 0;
                for (const targetId of targetUserIds) {
                     count++;
                     _showModal('Progreso', `2/3: Aplicando a usuario ${count}/${targetUserIds.length}...`);
                     console.log(`Sincronizando para: ${targetId}`);
                     try {
                         for(const cat of ['rubros', 'segmentos', 'marcas']) { await copyDataToUser(targetId, cat, sourceData[cat]); }
                         await mergeDataForUser(targetId, 'inventario', sourceData['inventario'], 'cantidadUnidades');
                     } catch (userSyncError) { console.error(`Error sincronizando para usuario ${targetId}:`, userSyncError); errorsOccurred = true; }
                }
                 _showModal('Progreso', `3/3: Finalizando...`);
                 _showModal(errorsOccurred ? 'Advertencia' : 'Éxito', `Sincronización manual completada.${errorsOccurred ? ' Ocurrieron errores.' : ''}`);
                showAdminSubMenuView();
            } catch (error) {
                console.error("Error durante la sincronización de admin:", error);
                _showModal('Error', `Error durante sincronización: ${error.message}`);
            }
        }, 'Sí, Sincronizar');
    }

    async function mergeDataForUser(targetUserId, collectionName, sourceItems, fieldToPreserve) {
        if (!sourceItems || sourceItems.length === 0) { console.log(` - No hay ${collectionName} fuente para ${targetUserId}.`); return; }
        const targetPath = `artifacts/${_appId}/users/${targetUserId}/${collectionName}`;
        const targetRef = _collection(_db, targetPath);
        let targetMap = new Map();
        try {
            const targetSnapshot = await _getDocs(targetRef);
            targetMap = new Map(targetSnapshot.docs.map(doc => [doc.id, doc.data()]));
        } catch (readError) { console.warn(`No se pudo leer ${collectionName} existente para ${targetUserId}.`, readError); }
        const batch = _writeBatch(_db);
        let operations = 0;
        const MAX_OPS_PER_BATCH = 490;
        for (const item of sourceItems) {
            const itemId = item.id;
            if (!itemId) { console.warn("Item fuente sin ID:", item); continue; }
            const { id, ...data } = item;
            const targetDocRef = _doc(_db, targetPath, itemId);
            let preservedValue = (fieldToPreserve === 'saldoVacios' ? {} : 0);
            if (targetMap.has(itemId)) {
                 const existingData = targetMap.get(itemId);
                 preservedValue = existingData?.[fieldToPreserve] ?? preservedValue;
                 targetMap.delete(itemId);
            }
            data[fieldToPreserve] = preservedValue;
            batch.set(targetDocRef, data);
            operations++;
             if (operations >= MAX_OPS_PER_BATCH) { await batch.commit(); batch = _writeBatch(_db); operations = 0; }
        }
        const deleteOrphans = true;
         if (deleteOrphans && targetMap.size > 0) {
             console.log(` - Eliminando ${targetMap.size} items huérfanos de ${collectionName} para ${targetUserId}`);
             for (const orphanId of targetMap.keys()) {
                 batch.delete(_doc(_db, targetPath, orphanId));
                 operations++;
                 if (operations >= MAX_OPS_PER_BATCH) { await batch.commit(); batch = _writeBatch(_db); operations = 0; }
             }
         }
        if (operations > 0) await batch.commit();
         console.log(` - Merge de ${collectionName} completado para ${targetUserId}`);
    }

    async function copyDataToUser(targetUserId, collectionName, sourceItems) {
         const targetPath = `artifacts/${_appId}/users/${targetUserId}/${collectionName}`;
         const targetCollectionRef = _collection(_db, targetPath);
         console.log(` - Limpiando ${collectionName} anterior para ${targetUserId}...`);
         try {
             const oldSnapshot = await _getDocs(targetCollectionRef);
             if (!oldSnapshot.empty) {
                 const deleteBatch = _writeBatch(_db);
                 oldSnapshot.docs.forEach(doc => deleteBatch.delete(doc.ref));
                  await deleteBatch.commit();
                  console.log(`   - ${oldSnapshot.size} items eliminados.`);
             }
         } catch (deleteError) { console.error(`Error limpiando ${collectionName} for ${targetUserId}:`, deleteError); throw new Error(`Fallo al limpiar ${collectionName}: ${deleteError.message}`); }
        if (!sourceItems || sourceItems.length === 0) { console.log(` - No hay ${collectionName} fuente.`); return; }
         console.log(` - Copiando ${sourceItems.length} items de ${collectionName} a ${targetUserId}...`);
        const writeBatch = _writeBatch(_db);
        let writeOps = 0;
        const MAX_OPS_PER_BATCH = 490;
        sourceItems.forEach(item => {
             const itemId = item.id;
             const { id, ...data } = item;
             const targetDocRef = (itemId && typeof itemId === 'string' && itemId.trim() !== '') ? _doc(_db, targetPath, itemId) : _doc(targetCollectionRef);
             writeBatch.set(targetDocRef, data);
             writeOps++;
        });
         await writeBatch.commit();
         console.log(` - Copia de ${collectionName} completada.`);
    }

    async function _getAllOtherUserIds() {
        try {
            const usersRef = _collection(_db, "users");
            const snapshot = await _getDocs(usersRef);
            const userIds = snapshot.docs.map(doc => doc.id).filter(id => id !== _userId);
            console.log("Other user IDs for propagation:", userIds);
            return userIds;
        } catch (error) {
            console.error("Error obteniendo IDs de usuario para propagación:", error);
            _showModal('Error Interno', 'No se pudo obtener la lista de usuarios para actualizar.');
            return [];
        }
    }

    async function propagateProductChange(productId, productData) {
        if (!productId) { console.error("propagateProductChange: productId is missing."); return; }
        const otherUserIds = await _getAllOtherUserIds();
        if (otherUserIds.length === 0) { console.log("propagateProductChange: No other users."); return; }
        console.log(`Propagating product ${productId} change to users:`, otherUserIds);
        const BATCH_LIMIT = 490;
        let batch = _writeBatch(_db);
        let operations = 0;
        let errorsOccurred = false;
        try {
            for (const targetUserId of otherUserIds) {
                const targetProductRef = _doc(_db, `artifacts/${_appId}/users/${targetUserId}/inventario`, productId);
                if (productData === null) {
                    console.log(` - Deleting product ${productId} for user ${targetUserId}`);
                    batch.delete(targetProductRef);
                } else {
                    const { cantidadUnidades, ...definitionData } = productData;
                    console.log(` - Setting/Merging product definition ${productId} for user ${targetUserId}`);
                    batch.set(targetProductRef, definitionData, { merge: true });
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
             const modalContainer = document.getElementById('modalContainer');
             const modalTitle = modalContainer?.querySelector('h3')?.textContent;
             if(modalContainer && modalTitle?.startsWith('Progreso')) {
                  modalContainer.classList.add('hidden');
             }
             console.log(`Propagation complete for product ${productId}.`);
        } catch (error) {
            errorsOccurred = true;
            console.error("Error propagando cambio de producto:", error);
            _showModal('Error', `Error al propagar cambio de producto: ${error.message}.`);
        }
    }

     async function propagateCategoryChange(collectionName, itemId, itemData) {
         if (!collectionName || !itemId) { console.error("propagateCategoryChange: collectionName or itemId missing."); return; }
         const otherUserIds = await _getAllOtherUserIds();
         if (otherUserIds.length === 0) { console.log("propagateCategoryChange: No other users."); return; }
         console.log(`Propagating category ${collectionName} (${itemId}) change to ${otherUserIds.length} users...`);
         const BATCH_LIMIT = 490;
         let batch = _writeBatch(_db);
         let operations = 0;
         let errorsOccurred = false;
         try {
             for (const targetUserId of otherUserIds) {
                 const targetItemRef = _doc(_db, `artifacts/${_appId}/users/${targetUserId}/${collectionName}`, itemId);
                 if (itemData === null) {
                     batch.delete(targetItemRef);
                     console.log(` - Deleting ${collectionName}/${itemId} for ${targetUserId}`);
                 } else {
                     batch.set(targetItemRef, itemData);
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
             _showModal('Error Propagación', `Error al actualizar categoría '${itemData?.name || itemId}'.`);
         }
     }

     async function propagateCategoryOrderChange(collectionName, orderedIds) {
          if (!collectionName || !Array.isArray(orderedIds)) { console.error("propagateCategoryOrderChange: collectionName or orderedIds (array) missing."); return; }
          const otherUserIds = await _getAllOtherUserIds();
          if (otherUserIds.length === 0) { console.log("propagateCategoryOrderChange: No other users."); return; }
          console.log(`Propagating order for ${collectionName} to users:`, otherUserIds);
          const BATCH_LIMIT = 490;
          let errorsOccurred = false;
          try {
              const orderMap = new Map(orderedIds.map((id, index) => [id, index]));
              let maxOrderInAdminList = orderedIds.length - 1;
              for (const targetUserId of otherUserIds) {
                  let batch = _writeBatch(_db);
                  let operations = 0;
                  console.log(` - Updating order of ${collectionName} for ${targetUserId}`);
                  const targetCollectionRef = _collection(_db, `artifacts/${_appId}/users/${targetUserId}/${collectionName}`);
                  const snapshot = await _getDocs(targetCollectionRef);
                  let userSpecificMaxOrder = maxOrderInAdminList;
                  for (const docSnap of snapshot.docs) {
                      const itemId = docSnap.id;
                      const currentData = docSnap.data();
                      const currentOrder = currentData.orden;
                      let newOrder;
                      if (orderMap.has(itemId)) { newOrder = orderMap.get(itemId); }
                      else { userSpecificMaxOrder++; newOrder = userSpecificMaxOrder; console.warn(`   - Item ${itemId} (${currentData.name}) not in admin's ordered list. Assigning order ${newOrder} for ${targetUserId}.`); }
                      if (currentOrder !== newOrder) {
                          const targetItemRef = docSnap.ref;
                          batch.update(targetItemRef, { orden: newOrder });
                          operations++;
                          console.log(`   - Updating order for ${itemId} (${currentData.name}) to ${newOrder} for ${targetUserId}`);
                          if (operations >= BATCH_LIMIT) { console.log(`   - Committing partial order batch for ${targetUserId} (${operations} ops)...`); await batch.commit(); batch = _writeBatch(_db); operations = 0; }
                      }
                  }
                  if (operations > 0) { console.log(`   - Committing final order batch for ${targetUserId} (${operations} ops)...`); await batch.commit(); }
              }
               const modalContainer = document.getElementById('modalContainer');
               const modalTitle = modalContainer?.querySelector('h3')?.textContent;
               if(modalContainer && modalTitle?.startsWith('Progreso')) { modalContainer.classList.add('hidden'); }
               console.log(`Order propagation complete for ${collectionName}.`);
          } catch (error) {
              errorsOccurred = true;
              console.error(`Error propagando orden de ${collectionName}:`, error);
              _showModal('Error Propagación', `Error al actualizar orden de categoría: ${error.message}`);
          }
     }

    window.adminModule = {
        handleRoleChange,
        propagateProductChange,
        propagateCategoryChange,
        propagateCategoryOrderChange
    };

})();
