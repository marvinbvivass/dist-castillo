(function() {
    let _db, _userId, _userRole, _appId, _mainContent, _floatingControls, _showMainMenu, _showModal;
    let _collection, _getDocs, _doc, _setDoc, _getDoc, _writeBatch, _query, _where, _deleteDoc;
    let _obsequioProductId = null;

    // Definir ruta pública para la configuración de obsequio
    // Usar el ID de proyecto hardcoded 'ventas-9a210' para datos públicos
    const OBSEQUIO_CONFIG_PATH = `artifacts/${'ventas-9a210'}/public/data/config/obsequio`;

    window.initAdmin = function(dependencies) {
        if (!dependencies.db || !dependencies.mainContent || !dependencies.showMainMenu || !dependencies.showModal) {
            console.error("Admin Init Error: Missing critical dependencies (db, mainContent, showMainMenu, showModal)");
            return;
        }
        _db = dependencies.db;
        _userId = dependencies.userId;
        _userRole = dependencies.userRole;
        _appId = dependencies.appId; // AppId del entorno actual (puede ser diferente de 'ventas-9a210')
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
                            <button id="backToMenuBtn" class="w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver al Menú Principal</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
         document.getElementById('userManagementBtn').addEventListener('click', showUserManagementView);
         document.getElementById('obsequioConfigBtn').addEventListener('click', showObsequioConfigView);
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
                 // Si el documento no existe, crearlo con datos básicos
                 const auth = getAuth(); // Asegúrate de tener acceso a 'auth'
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
            // Cargar productos desde el inventario del ADMIN actual (_userId)
            const inventarioRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`);
            const snapshot = await _getDocs(inventarioRef);
            const productosValidos = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(p => p.manejaVacios && p.ventaPor?.cj) // Filtrar por manejo de vacíos y venta por caja
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
                 // Leer la configuración actual DESDE LA RUTA PÚBLICA
                 const configRef = _doc(_db, OBSEQUIO_CONFIG_PATH);
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
            // Guardar la configuración EN LA RUTA PÚBLICA
            const configRef = _doc(_db, OBSEQUIO_CONFIG_PATH);
            await _setDoc(configRef, { productoId: selectedProductId });
            _obsequioProductId = selectedProductId;
            _showModal('Éxito', 'Producto de obsequio configurado correctamente (en ruta pública).');
            showAdminSubMenuView();
        } catch (error) {
            console.error("Error guardando configuración de obsequio:", error);
            _showModal('Error', 'Hubo un error al guardar la configuración.');
        }
    }

    // --- Funciones de Propagación (sin cambios) ---

    async function _getAllOtherUserIds() {
        // ... (código sin cambios)
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
        // ... (código sin cambios)
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
         // ... (código sin cambios)
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
          // ... (código sin cambios)
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
