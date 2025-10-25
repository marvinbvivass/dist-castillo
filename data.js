// --- Lógica del módulo de Data (solo para Admins) ---

(function() {
    // Variables locales del módulo
    let _db, _appId, _userId, _mainContent, _floatingControls, _showMainMenu, _showModal;
    // --- NUEVO: Añadir writeBatch y doc ---
    let _collection, _getDocs, _query, _where, _orderBy, _populateDropdown, _writeBatch, _doc, _deleteDoc;
    // --- FIN NUEVO ---

    let _lastStatsData = []; // Caché para los datos de la última estadística generada
    let _lastNumWeeks = 1;   // Caché para el número de semanas del último cálculo
    let _consolidatedClientsCache = []; // Caché para la lista de clientes consolidados
    let _filteredClientsCache = []; // Caché para la lista filtrada de clientes a descargar

    // Se duplican estas funciones para mantener el módulo independiente
    let _segmentoOrderCacheData = null;
    let _rubroOrderCacheData = null;

    // Variables para el mapa
    let mapInstance = null;
    let mapMarkers = new Map();

    const TIPOS_VACIO = ["1/4 - 1/3", "ret 350 ml", "ret 1.25 Lts"];


    /**
     * Inicializa el módulo con las dependencias necesarias.
     */
    window.initData = function(dependencies) {
        _db = dependencies.db;
        _appId = dependencies.appId;
        _userId = dependencies.userId; // El ID del admin actual
        _mainContent = dependencies.mainContent;
        _floatingControls = dependencies.floatingControls;
        _showMainMenu = dependencies.showMainMenu;
        _showModal = dependencies.showModal;
        _collection = dependencies.collection;
        _getDocs = dependencies.getDocs;
        _query = dependencies.query;
        _where = dependencies.where;
        _orderBy = dependencies.orderBy;
        _populateDropdown = dependencies.populateDropdown;
        // --- NUEVO ---
        _writeBatch = dependencies.writeBatch;
        _doc = dependencies.doc;
        _deleteDoc = dependencies.deleteDoc; // Asegúrate de que deleteDoc esté disponible
        // --- FIN NUEVO ---
    };
    
    /**
     * Muestra el submenú de opciones del módulo de Data.
     */
    window.showDataView = function() {
        if (mapInstance) {
            mapInstance.remove();
            mapInstance = null;
        }
        _floatingControls.classList.add('hidden');
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl text-center">
                        <h1 class="text-3xl font-bold text-gray-800 mb-6">Módulo de Datos</h1>
                        <div class="space-y-4">
                            <button id="closingDataBtn" class="w-full px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700">Datos de Cierres de Ventas</button>
                            <button id="productStatsBtn" class="w-full px-6 py-3 bg-teal-600 text-white font-semibold rounded-lg shadow-md hover:bg-teal-700">Estadística de Productos</button>
                            <button id="consolidatedClientsBtn" class="w-full px-6 py-3 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700">Clientes Consolidados</button>
                            <button id="clientMapBtn" class="w-full px-6 py-3 bg-cyan-600 text-white font-semibold rounded-lg shadow-md hover:bg-cyan-700">Mapa de Clientes</button>
                            <!-- NUEVO BOTÓN -->
                            <button id="dataManagementBtn" class="w-full px-6 py-3 bg-orange-600 text-white font-semibold rounded-lg shadow-md hover:bg-orange-700">Limpieza y Gestión de Datos</button>
                            <!-- FIN NUEVO BOTÓN -->
                            <button id="backToMenuBtn" class="w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver al Menú Principal</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('closingDataBtn').addEventListener('click', showClosingDataView);
        document.getElementById('productStatsBtn').addEventListener('click', showProductStatsView);
        document.getElementById('consolidatedClientsBtn').addEventListener('click', showConsolidatedClientsView);
        document.getElementById('clientMapBtn').addEventListener('click', showClientMapView);
        document.getElementById('dataManagementBtn').addEventListener('click', showDataManagementView); // <-- NUEVO EVENT LISTENER
        document.getElementById('backToMenuBtn').addEventListener('click', _showMainMenu);
    };

    // --- [INICIO] Nueva sección: Limpieza y Gestión de Datos ---

    /**
     * Muestra la vista para la gestión avanzada de datos (borrado, importación).
     */
    function showDataManagementView() {
        _floatingControls.classList.add('hidden');
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto max-w-2xl">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl">
                        <h1 class="text-3xl font-bold text-gray-800 mb-6 text-center">Limpieza y Gestión de Datos</h1>

                        <div class="space-y-6">
                            <!-- Sección Borrar Ventas -->
                            <div class="p-4 border rounded-lg bg-red-50 border-red-200">
                                <h2 class="text-xl font-semibold text-red-800 mb-2">Borrar Datos de Ventas</h2>
                                <p class="text-sm text-red-700 mb-4">Esta acción exportará todos los cierres de ventas (públicos y del admin) a archivos Excel separados y luego los eliminará permanentemente de la base de datos. <strong class="font-bold">¡Esta acción es irreversible!</strong></p>
                                <button id="deleteExportSalesBtn" class="w-full px-6 py-2 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700">Borrar y Exportar Datos de Ventas</button>
                            </div>

                            <!-- Sección Borrar Inventario -->
                            <div class="p-4 border rounded-lg bg-yellow-50 border-yellow-200">
                                <h2 class="text-xl font-semibold text-yellow-800 mb-2">Borrar Datos de Inventario</h2>
                                <p class="text-sm text-yellow-700 mb-4">Esta acción exportará el inventario actual del admin (incluyendo rubros, segmentos, marcas) a un archivo Excel y luego eliminará estos datos de <strong class="font-bold">TODOS los usuarios</strong>. <strong class="font-bold">¡Esta acción es irreversible!</strong></p>
                                <button id="deleteExportInventoryBtn" class="w-full px-6 py-2 bg-yellow-600 text-white font-semibold rounded-lg shadow-md hover:bg-yellow-700">Borrar y Exportar Datos de Inventario</button>
                            </div>

                            <!-- Sección Importar Inventario -->
                            <div class="p-4 border rounded-lg bg-green-50 border-green-200">
                                <h2 class="text-xl font-semibold text-green-800 mb-2">Importar Inventario desde Excel</h2>
                                <p class="text-sm text-green-700 mb-4">Selecciona un archivo Excel (.xlsx) con hojas separadas llamadas 'Inventario', 'Rubros', 'Segmentos', 'Marcas'. Los datos existentes en <strong class="font-bold">TODOS los usuarios</strong> serán <strong class="font-bold">reemplazados</strong> por los del archivo.</p>
                                <input type="file" id="inventory-import-uploader" accept=".xlsx" class="w-full p-2 border rounded-lg mb-2">
                                <div id="inventory-import-preview" class="text-sm text-gray-600 mb-4"></div>
                                <button id="importInventoryBtn" class="w-full px-6 py-2 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700" disabled>Importar Inventario</button>
                            </div>
                        </div>

                        <button id="backToDataMenuBtn" class="mt-8 w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver al Menú de Datos</button>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('backToDataMenuBtn').addEventListener('click', showDataView);
        document.getElementById('deleteExportSalesBtn').addEventListener('click', handleDeleteAndExportSales);
        document.getElementById('deleteExportInventoryBtn').addEventListener('click', handleDeleteAndExportInventory);
        document.getElementById('inventory-import-uploader').addEventListener('change', handleInventoryFileSelect);
        document.getElementById('importInventoryBtn').addEventListener('click', handleImportInventory);
    }

    /**
     * Obtiene todos los IDs de usuario.
     */
    async function getAllUserIds() {
        const usersRef = _collection(_db, "users");
        const snapshot = await _getDocs(usersRef);
        return snapshot.docs.map(doc => doc.id);
    }

    /**
     * Exporta y elimina los datos de cierres de ventas.
     */
    async function handleDeleteAndExportSales() {
        _showModal('Confirmación Crítica (Ventas)',
        `<p class="text-red-700 font-bold">Estás a punto de ELIMINAR PERMANENTEMENTE todos los datos de cierres de ventas (públicos y del admin).</p>
         <p>Primero se intentará descargar dos archivos Excel como respaldo.</p>
         <p class="mt-4">¿Estás absolutamente seguro?</p>`,
        async () => {
            _showModal('Progreso', 'Exportando y eliminando datos de ventas...');
            try {
                // 1. Exportar Cierres Públicos
                const publicClosingsRef = _collection(_db, `public_data/${_appId}/user_closings`);
                const publicSnapshot = await _getDocs(publicClosingsRef);
                const publicClosings = publicSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                if (publicClosings.length > 0) {
                    exportClosingsToExcel(publicClosings, `Cierres_Publicos_${new Date().toISOString().slice(0,10)}`);
                } else {
                    console.log("No hay cierres públicos para exportar.");
                }

                // 2. Exportar Cierres del Admin (si existen)
                const adminClosingsRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/cierres`);
                const adminSnapshot = await _getDocs(adminClosingsRef);
                const adminClosings = adminSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                 if (adminClosings.length > 0) {
                    exportClosingsToExcel(adminClosings, `Cierres_Admin_${_userId}_${new Date().toISOString().slice(0,10)}`);
                } else {
                    console.log("No hay cierres de admin para exportar.");
                }

                // 3. Eliminar Cierres (Doble Confirmación Implícita por el modal anterior)
                const batch = _writeBatch(_db);
                publicSnapshot.docs.forEach(doc => batch.delete(doc.ref));
                adminSnapshot.docs.forEach(doc => batch.delete(doc.ref));

                await batch.commit();

                _showModal('Éxito', 'Los datos de cierres de ventas han sido exportados y eliminados.');
            } catch (error) {
                console.error("Error al borrar/exportar ventas:", error);
                _showModal('Error', `Ocurrió un error: ${error.message}`);
            }
        }, 'Sí, Borrar TODO');
    }

     /**
     * Función auxiliar para exportar cierres a Excel.
     * @param {Array} closings - Array de objetos de cierre.
     * @param {string} filename - Nombre del archivo sin extensión.
     */
    function exportClosingsToExcel(closings, filename) {
        if (typeof XLSX === 'undefined') {
            _showModal('Error', 'Librería XLSX no cargada.');
            return;
        }
        if (!closings || closings.length === 0) return;

        // Simplificar datos para exportar
        const dataToExport = closings.map(c => ({
            ID_Cierre: c.id,
            Fecha: c.fecha.toDate ? c.fecha.toDate().toLocaleString('es-ES') : c.fecha,
            Total: c.total,
            Vendedor_ID: c.vendedorInfo?.userId || 'N/A',
            Vendedor_Nombre: `${c.vendedorInfo?.nombre || ''} ${c.vendedorInfo?.apellido || ''}`.trim(),
            Vendedor_Camion: c.vendedorInfo?.camion || 'N/A',
            // Opcional: Serializar 'ventas' si es necesario, pero puede hacer el archivo muy grande
            // Ventas_JSON: JSON.stringify(c.ventas)
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Cierres');
        XLSX.writeFile(wb, `${filename}.xlsx`);
    }


    /**
     * Exporta y elimina los datos de inventario de todos los usuarios.
     */
    async function handleDeleteAndExportInventory() {
         _showModal('Confirmación Crítica (Inventario)',
        `<p class="text-yellow-700 font-bold">Estás a punto de ELIMINAR PERMANENTEMENTE los datos de inventario (productos, rubros, segmentos, marcas) de TODOS LOS USUARIOS.</p>
         <p>Primero se intentará descargar un archivo Excel con los datos del inventario del administrador actual como respaldo.</p>
         <p class="mt-4">¿Estás absolutamente seguro?</p>`,
        async () => {
            _showModal('Progreso', 'Exportando inventario del admin y preparando borrado...');
            try {
                // 1. Exportar Inventario del Admin
                const adminData = {};
                const collectionsToExport = ['inventario', 'rubros', 'segmentos', 'marcas'];
                for (const col of collectionsToExport) {
                    const adminPath = `artifacts/${_appId}/users/${_userId}/${col}`;
                    const snapshot = await _getDocs(_collection(_db, adminPath));
                    adminData[col] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                }
                exportInventoryToExcel(adminData, `Inventario_Admin_Backup_${new Date().toISOString().slice(0,10)}`);

                // 2. Obtener todos los IDs de usuario
                const allUserIds = await getAllUserIds();

                // 3. Eliminar datos de inventario de TODOS los usuarios
                 _showModal('Progreso', `Borrando datos de inventario para ${allUserIds.length} usuarios...`);
                 const batch = _writeBatch(_db);
                 for(const targetId of allUserIds) {
                     for(const col of collectionsToExport) {
                         const targetPath = `artifacts/${_appId}/users/${targetId}/${col}`;
                         const targetSnapshot = await _getDocs(_collection(_db, targetPath));
                         targetSnapshot.docs.forEach(doc => batch.delete(doc.ref));
                     }
                 }
                 await batch.commit();

                _showModal('Éxito', 'Los datos de inventario de todos los usuarios han sido exportados (backup admin) y eliminados.');
            } catch (error) {
                console.error("Error al borrar/exportar inventario:", error);
                _showModal('Error', `Ocurrió un error: ${error.message}`);
            }
        }, 'Sí, Borrar TODO');
    }

    /**
     * Función auxiliar para exportar inventario a Excel.
     * @param {Object} inventoryData - Objeto con arrays para 'inventario', 'rubros', etc.
     * @param {string} filename - Nombre del archivo sin extensión.
     */
    function exportInventoryToExcel(inventoryData, filename) {
        if (typeof XLSX === 'undefined') {
            _showModal('Error', 'Librería XLSX no cargada.');
            return;
        }
        const wb = XLSX.utils.book_new();

        // Hoja de Inventario
        if (inventoryData.inventario && inventoryData.inventario.length > 0) {
            const inventarioSheetData = inventoryData.inventario.map(p => ({
                ID: p.id,
                Rubro: p.rubro,
                Segmento: p.segmento,
                Marca: p.marca,
                Presentacion: p.presentacion,
                UnidadesPorPaquete: p.unidadesPorPaquete,
                UnidadesPorCaja: p.unidadesPorCaja,
                VentaPorUnd: p.ventaPor?.und,
                VentaPorPaq: p.ventaPor?.paq,
                VentaPorCj: p.ventaPor?.cj,
                ManejaVacios: p.manejaVacios,
                TipoVacio: p.tipoVacio, // <-- Incluir tipo vacío
                PrecioUnd: p.precios?.und,
                PrecioPaq: p.precios?.paq,
                PrecioCj: p.precios?.cj,
                PrecioPorUnidadCalculado: p.precioPorUnidad,
                CantidadUnidades: p.cantidadUnidades, // <-- Se exporta, pero no se importa directamente
                IVA: p.iva
            }));
            const wsInv = XLSX.utils.json_to_sheet(inventarioSheetData);
            XLSX.utils.book_append_sheet(wb, wsInv, 'Inventario');
        }

        // Hojas de Categorías
        ['rubros', 'segmentos', 'marcas'].forEach(cat => {
            if (inventoryData[cat] && inventoryData[cat].length > 0) {
                const sheetData = inventoryData[cat].map(item => ({ ID: item.id, Nombre: item.name, Orden: item.orden }));
                // Capitalizar nombre de la hoja
                const sheetName = cat.charAt(0).toUpperCase() + cat.slice(1);
                const ws = XLSX.utils.json_to_sheet(sheetData);
                 XLSX.utils.book_append_sheet(wb, ws, sheetName);
            }
        });

        if (wb.SheetNames.length > 0) {
            XLSX.writeFile(wb, `${filename}.xlsx`);
        } else {
            console.warn("No hay datos de inventario para exportar.");
            _showModal("Aviso", "No se encontraron datos de inventario para exportar.");
        }
    }


    let inventoryImportData = null; // Variable para guardar los datos parseados del Excel
    /**
     * Maneja la selección del archivo Excel para importar inventario.
     */
    function handleInventoryFileSelect(event) {
        const file = event.target.files[0];
        const previewEl = document.getElementById('inventory-import-preview');
        const importBtn = document.getElementById('importInventoryBtn');
        inventoryImportData = null; // Resetear datos previos
        importBtn.disabled = true;
        previewEl.textContent = '';

        if (!file) return;

        previewEl.textContent = `Leyendo archivo: ${file.name}...`;

        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = e.target.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const requiredSheets = ['Inventario', 'Rubros', 'Segmentos', 'Marcas'];
                const foundSheets = requiredSheets.filter(sheetName => workbook.SheetNames.includes(sheetName));

                if (foundSheets.length !== requiredSheets.length) {
                    previewEl.textContent = `Error: Faltan hojas requeridas en el archivo Excel. Se necesitan: ${requiredSheets.join(', ')}`;
                    return;
                }

                inventoryImportData = {};
                foundSheets.forEach(sheetName => {
                    const worksheet = workbook.Sheets[sheetName];
                    // Usar {header: 1} para obtener arrays, luego procesar encabezados manualmente
                    const jsonDataRaw = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                    if(jsonDataRaw.length < 2) { // Debe tener encabezado y al menos una fila de datos
                        inventoryImportData[sheetName.toLowerCase()] = [];
                        return;
                    }
                    const headers = jsonDataRaw[0].map(h => h.toString().toLowerCase().trim());
                    const dataRows = jsonDataRaw.slice(1);
                    
                    inventoryImportData[sheetName.toLowerCase()] = dataRows.map(row => {
                         const obj = {};
                         headers.forEach((header, index) => {
                             obj[header] = row[index];
                         });
                         return obj;
                    });
                });

                previewEl.textContent = `Archivo '${file.name}' leído. Se encontraron datos para: ${foundSheets.join(', ')}. Listo para importar.`;
                importBtn.disabled = false;

            } catch (error) {
                console.error("Error al leer archivo Excel:", error);
                previewEl.textContent = `Error al leer el archivo: ${error.message}`;
            }
        };
        reader.onerror = function() {
             previewEl.textContent = 'Error al leer el archivo.';
        };
        reader.readAsBinaryString(file);
    }

    /**
     * Importa los datos de inventario desde el archivo Excel seleccionado.
     */
    async function handleImportInventory() {
         if (!inventoryImportData) {
            _showModal('Error', 'No hay datos de inventario cargados desde el archivo Excel.');
            return;
        }

        _showModal('Confirmación Crítica (Importar Inventario)',
        `<p class="text-green-700 font-bold">Estás a punto de REEMPLAZAR PERMANENTEMENTE los datos de inventario (productos, rubros, segmentos, marcas) de TODOS LOS USUARIOS con los datos del archivo Excel.</p>
         <p class="mt-4">¿Estás absolutamente seguro?</p>`,
        async () => {
            _showModal('Progreso', 'Importando y distribuyendo datos de inventario...');
            try {
                const allUserIds = await getAllUserIds();
                 _showModal('Progreso', `Aplicando datos a ${allUserIds.length} usuarios...`);

                for (const targetId of allUserIds) {
                    // Borrar datos existentes
                    const batchDelete = _writeBatch(_db);
                    const collectionsToDelete = ['inventario', 'rubros', 'segmentos', 'marcas'];
                     for(const col of collectionsToDelete) {
                         const targetPath = `artifacts/${_appId}/users/${targetId}/${col}`;
                         const targetSnapshot = await _getDocs(_collection(_db, targetPath));
                         targetSnapshot.docs.forEach(doc => batchDelete.delete(doc.ref));
                     }
                     await batchDelete.commit();

                     // Escribir nuevos datos
                     const batchWrite = _writeBatch(_db);
                     // Categorías
                     ['rubros', 'segmentos', 'marcas'].forEach(cat => {
                         if (inventoryImportData[cat]) {
                            const targetPath = `artifacts/${_appId}/users/${targetId}/${cat}`;
                            inventoryImportData[cat].forEach(item => {
                                const docRef = item.id ? _doc(_db, targetPath, item.id) : _doc(_collection(_db, targetPath)); // Usar ID si existe, o generar nuevo
                                const dataToSave = {
                                    name: item.nombre,
                                    orden: item.orden !== undefined ? parseInt(item.orden) : 9999 // Incluir orden
                                };
                                batchWrite.set(docRef, dataToSave);
                            });
                         }
                     });
                     // Inventario
                      if (inventoryImportData['inventario']) {
                          const targetPath = `artifacts/${_appId}/users/${targetId}/inventario`;
                          inventoryImportData['inventario'].forEach(p => {
                              const docRef = p.id ? _doc(_db, targetPath, p.id) : _doc(_collection(_db, targetPath)); // Usar ID si existe
                              const dataToSave = {
                                  rubro: p.rubro,
                                  segmento: p.segmento,
                                  marca: p.marca,
                                  presentacion: p.presentacion,
                                  unidadesPorPaquete: p['unidadesporpaquete'] ? parseInt(p['unidadesporpaquete']) : 1,
                                  unidadesPorCaja: p['unidadesporcaja'] ? parseInt(p['unidadesporcaja']) : 1,
                                  ventaPor: {
                                      und: p['ventaporund'] === true || p['ventaporund'] === 'TRUE',
                                      paq: p['ventaporpaq'] === true || p['ventaporpaq'] === 'TRUE',
                                      cj: p['ventaporcj'] === true || p['ventaporcj'] === 'TRUE',
                                  },
                                  manejaVacios: p['manejavacios'] === true || p['manejavacios'] === 'TRUE',
                                  tipoVacio: p['tipovacio'] || null, // <-- Incluir tipo vacío
                                  precios: {
                                      und: p['preciound'] ? parseFloat(p['preciound']) : 0,
                                      paq: p['preciopaq'] ? parseFloat(p['preciopaq']) : 0,
                                      cj: p['preciocj'] ? parseFloat(p['preciocj']) : 0,
                                  },
                                  precioPorUnidad: p['precioporunidadcalculado'] ? parseFloat(p['precioporunidadcalculado']) : 0,
                                  cantidadUnidades: 0, // Importar siempre con 0 stock inicial
                                  iva: p.iva !== undefined ? parseInt(p.iva) : 16
                              };
                              batchWrite.set(docRef, dataToSave);
                          });
                      }
                      await batchWrite.commit();
                }

                _showModal('Éxito', 'El inventario ha sido importado y distribuido a todos los usuarios.');
                // Limpiar después de importar
                inventoryImportData = null;
                document.getElementById('inventory-import-uploader').value = '';
                document.getElementById('inventory-import-preview').textContent = '';
                document.getElementById('importInventoryBtn').disabled = true;

            } catch (error) {
                 console.error("Error al importar inventario:", error);
                _showModal('Error', `Ocurrió un error durante la importación: ${error.message}`);
            }

        }, 'Sí, Importar y Reemplazar');
    }

    // --- [FIN] Nueva sección ---

    // ... (resto del código de data.js sin cambios: showClosingDataView, populateUserFilter, etc.) ...
    // ... (Copiar el resto del código desde la versión anterior de data.js aquí) ...
    // ... (Incluyendo showProductStatsView, handleSearchStats, renderStatsList, handleDownloadStats) ...
    // ... (Incluyendo showConsolidatedClientsView, loadAndRenderConsolidatedClients, renderConsolidatedClientsList, handleDownloadFilteredClients) ...
    // ... (Incluyendo showClientMapView, loadAndDisplayMap, setupMapSearch) ...
     // ... (Incluyendo processSalesDataForReport, showClosingDetail, exportSingleClosingToExcel, handleDownloadSingleClosing) ...
     
    // --- Lógica de Reporte (duplicada de ventas.js para independencia) ---
    // (Asegúrate de que estas funciones estén aquí y usen las variables locales _db, _collection, etc.)
     async function getRubroOrderMapData(userIdForData) {
        if (_rubroOrderCacheData) return _rubroOrderCacheData;
        const map = {};
        const rubrosRef = _collection(_db, `artifacts/${_appId}/users/${userIdForData}/rubros`);
        try {
            const snapshot = await _getDocs(rubrosRef);
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                map[data.name] = (data.orden !== undefined) ? data.orden : 9999;
            });
            _rubroOrderCacheData = map;
            return map;
        } catch (e) { console.warn("No se pudo obtener el orden de los rubros en data.js", e); return null; }
    }

    async function getSegmentoOrderMapData(userIdForData) {
        if (_segmentoOrderCacheData) return _segmentoOrderCacheData;
        const map = {};
        const segmentosRef = _collection(_db, `artifacts/${_appId}/users/${userIdForData}/segmentos`);
        try {
            const snapshot = await _getDocs(segmentosRef);
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                map[data.name] = (data.orden !== undefined) ? data.orden : 9999;
            });
            _segmentoOrderCacheData = map;
            return map;
        } catch (e) { console.warn("No se pudo obtener el orden de los segmentos en data.js", e); return null; }
    }

    async function processSalesDataForReport(ventas, userIdForInventario) {
        const clientData = {};
        let grandTotalValue = 0;
        const allProductsMap = new Map();
        const vaciosMovementsPorTipo = {};
        
        const inventarioRef = _collection(_db, `artifacts/${_appId}/users/${userIdForInventario}/inventario`);
        const inventarioSnapshot = await _getDocs(inventarioRef);
        const inventarioMap = new Map(inventarioSnapshot.docs.map(doc => [doc.id, doc.data()]));

        ventas.forEach(venta => {
            const clientName = venta.clienteNombre;
            if (!clientData[clientName]) {
                clientData[clientName] = { products: {}, totalValue: 0 };
            }
             if(!vaciosMovementsPorTipo[clientName]) {
                vaciosMovementsPorTipo[clientName] = {};
                TIPOS_VACIO.forEach(tipo => vaciosMovementsPorTipo[clientName][tipo] = { entregados: 0, devueltos: 0 });
            }
            clientData[clientName].totalValue += venta.total;
            grandTotalValue += venta.total;
            
            const vaciosDevueltosEnVenta = venta.vaciosDevueltosPorTipo || {};
            for (const tipoVacio in vaciosDevueltosEnVenta) {
                if (vaciosMovementsPorTipo[clientName][tipoVacio]) {
                    vaciosMovementsPorTipo[clientName][tipoVacio].devueltos += vaciosDevueltosEnVenta[tipoVacio];
                }
            }

            (venta.productos || []).forEach(p => {
                if (p.manejaVacios && p.tipoVacio) {
                     const tipoVacio = p.tipoVacio;
                    if (vaciosMovementsPorTipo[clientName][tipoVacio]) {
                        vaciosMovementsPorTipo[clientName][tipoVacio].entregados += p.cantidadVendida?.cj || 0;
                    }
                }

                const productoCompleto = inventarioMap.get(p.id) || p;
                const rubro = productoCompleto.rubro || 'Sin Rubro';
                const segmento = productoCompleto.segmento || 'Sin Segmento';
                const marca = productoCompleto.marca || 'Sin Marca';
                
                if (!allProductsMap.has(p.id)) {
                    allProductsMap.set(p.id, {
                        ...productoCompleto,
                        id: p.id,
                        rubro: rubro,
                        segmento: segmento,
                        marca: marca,
                        presentacion: p.presentacion
                    });
                }

                if (!clientData[clientName].products[p.id]) {
                    clientData[clientName].products[p.id] = 0;
                }
                clientData[clientName].products[p.id] += p.totalUnidadesVendidas;
            });
        });

        const sortedClients = Object.keys(clientData).sort();

        const groupedProducts = {};
        for (const product of allProductsMap.values()) {
             if (!product.rubro) product.rubro = 'Sin Rubro'; // Asegurar rubro
             if (!product.segmento) product.segmento = 'Sin Segmento'; // Asegurar segmento
             if (!product.marca) product.marca = 'Sin Marca'; // Asegurar marca

            if (!groupedProducts[product.rubro]) groupedProducts[product.rubro] = {};
            if (!groupedProducts[product.rubro][product.segmento]) groupedProducts[product.rubro][product.segmento] = {};
            if (!groupedProducts[product.rubro][product.segmento][product.marca]) groupedProducts[product.rubro][product.segmento][product.marca] = [];
            groupedProducts[product.rubro][product.segmento][product.marca].push(product);
        }

        const rubroOrderMap = await getRubroOrderMapData(userIdForInventario);
        const segmentoOrderMap = await getSegmentoOrderMapData(userIdForInventario);

        const sortedRubros = Object.keys(groupedProducts).sort((a, b) => (rubroOrderMap[a] ?? 999) - (rubroOrderMap[b] ?? 999));

        const finalProductOrder = [];
        sortedRubros.forEach(rubro => {
            const sortedSegmentos = Object.keys(groupedProducts[rubro]).sort((a, b) => (segmentoOrderMap[a] ?? 999) - (segmentoOrderMap[b] ?? 999));
            sortedSegmentos.forEach(segmento => {
                const sortedMarcas = Object.keys(groupedProducts[rubro][segmento]).sort();
                sortedMarcas.forEach(marca => {
                    const sortedPresentaciones = groupedProducts[rubro][segmento][marca].sort((a,b) => a.presentacion.localeCompare(b.presentacion));
                    finalProductOrder.push(...sortedPresentaciones);
                });
            });
        });

        return { clientData, grandTotalValue, sortedClients, groupedProducts, finalProductOrder, sortedRubros, segmentoOrderMap, vaciosMovementsPorTipo, allProductsMap };
    }
     async function showClosingDetail(closingId) {
        const closingData = window.tempClosingsData.find(c => c.id === closingId);
        if (!closingData) {
            _showModal('Error', 'No se pudieron cargar los detalles del cierre.');
            return;
        }
        
        _showModal('Progreso', 'Generando reporte detallado...');
        
        const { clientData, grandTotalValue, sortedClients, groupedProducts, finalProductOrder, sortedRubros, segmentoOrderMap, vaciosMovementsPorTipo, allProductsMap } = await processSalesDataForReport(closingData.ventas, closingData.vendedorInfo.userId);
        
        let headerRow1 = `<tr class="sticky top-0 z-20"><th rowspan="4" class="p-1 border bg-gray-200 sticky left-0 z-30">Cliente</th>`;
        let headerRow2 = `<tr class="sticky z-20" style="top: 25px;">`;
        let headerRow3 = `<tr class="sticky z-20" style="top: 50px;">`;
        let headerRow4 = `<tr class="sticky z-20" style="top: 75px;">`;

        sortedRubros.forEach(rubro => {
            let rubroColspan = 0;
            const sortedSegmentos = Object.keys(groupedProducts[rubro]).sort((a, b) => (segmentoOrderMap[a] ?? 999) - (segmentoOrderMap[b] ?? 999));
            sortedSegmentos.forEach(segmento => {
                const sortedMarcas = Object.keys(groupedProducts[rubro][segmento]).sort();
                sortedMarcas.forEach(marca => {
                    rubroColspan += groupedProducts[rubro][segmento][marca].length;
                });
            });
            headerRow1 += `<th colspan="${rubroColspan}" class="p-1 border bg-gray-300">${rubro}</th>`;

            sortedSegmentos.forEach(segmento => {
                let segmentoColspan = 0;
                const sortedMarcas = Object.keys(groupedProducts[rubro][segmento]).sort();
                sortedMarcas.forEach(marca => {
                    segmentoColspan += groupedProducts[rubro][segmento][marca].length;
                });
                headerRow2 += `<th colspan="${segmentoColspan}" class="p-1 border bg-gray-200">${segmento}</th>`;

                sortedMarcas.forEach(marca => {
                    const marcaColspan = groupedProducts[rubro][segmento][marca].length;
                    headerRow3 += `<th colspan="${marcaColspan}" class="p-1 border bg-gray-100">${marca}</th>`;
                    
                    const sortedPresentaciones = groupedProducts[rubro][segmento][marca].sort((a,b) => a.presentacion.localeCompare(b.presentacion));
                    sortedPresentaciones.forEach(producto => {
                        headerRow4 += `<th class="p-1 border bg-gray-50 whitespace-nowrap">${producto.presentacion}</th>`;
                    });
                });
            });
        });
        headerRow1 += `<th rowspan="4" class="p-1 border bg-gray-200 sticky right-0 z-30">Total Cliente</th></tr>`;
        headerRow2 += `</tr>`;
        headerRow3 += `</tr>`;
        headerRow4 += `</tr>`;

        let bodyHTML = '';
        sortedClients.forEach(clientName => {
            bodyHTML += `<tr class="hover:bg-blue-50"><td class="p-1 border font-medium bg-white sticky left-0 z-10">${clientName}</td>`;
            const currentClient = clientData[clientName];
            finalProductOrder.forEach(product => {
                const quantityInUnits = currentClient.products[product.id] || 0;
                let displayQuantity = '';

                if (quantityInUnits > 0) {
                    displayQuantity = `${quantityInUnits} Unds`;
                    const ventaPor = product.ventaPor || {};
                    const unidadesPorCaja = product.unidadesPorCaja || 1;
                    const unidadesPorPaquete = product.unidadesPorPaquete || 1;
                    const isExclusiveCj = ventaPor.cj && !ventaPor.paq && !ventaPor.und;
                    const isExclusivePaq = ventaPor.paq && !ventaPor.cj && !ventaPor.und;
                    if (isExclusiveCj && unidadesPorCaja > 0) {
                        const totalBoxes = quantityInUnits / unidadesPorCaja;
                        displayQuantity = `${Number.isInteger(totalBoxes) ? totalBoxes : totalBoxes.toFixed(1)} Cj`;
                    } else if (isExclusivePaq && unidadesPorPaquete > 0) {
                        const totalPackages = quantityInUnits / unidadesPorPaquete;
                        displayQuantity = `${Number.isInteger(totalPackages) ? totalPackages : totalPackages.toFixed(1)} Paq`;
                    }
                }
                bodyHTML += `<td class="p-1 border text-center">${displayQuantity}</td>`;
            });
            bodyHTML += `<td class="p-1 border text-right font-semibold bg-white sticky right-0 z-10">$${currentClient.totalValue.toFixed(2)}</td></tr>`;
        });
        
        let footerHTML = '<tr class="bg-gray-200 font-bold"><td class="p-1 border sticky left-0 z-10">TOTALES</td>';
        finalProductOrder.forEach(product => {
            let totalQty = 0;
            sortedClients.forEach(clientName => {
                totalQty += clientData[clientName].products[product.id] || 0;
            });
            
            let displayTotal = '';
            if (totalQty > 0) {
                displayTotal = `${totalQty} Unds`;
                const ventaPor = product.ventaPor || {};
                const unidadesPorCaja = product.unidadesPorCaja || 1;
                const unidadesPorPaquete = product.unidadesPorPaquete || 1;
                const isExclusiveCj = ventaPor.cj && !ventaPor.paq && !ventaPor.und;
                const isExclusivePaq = ventaPor.paq && !ventaPor.cj && !ventaPor.und;

                if (isExclusiveCj && unidadesPorCaja > 0) {
                    const totalBoxes = totalQty / unidadesPorCaja;
                    displayTotal = `${Number.isInteger(totalBoxes) ? totalBoxes : totalBoxes.toFixed(1)} Cj`;
                } else if (isExclusivePaq && unidadesPorPaquete > 0) {
                    const totalPackages = totalQty / unidadesPorPaquete;
                    displayTotal = `${Number.isInteger(totalPackages) ? totalPackages : totalPackages.toFixed(1)} Paq`;
                }
            }
            footerHTML += `<td class="p-1 border text-center">${displayTotal}</td>`;
        });
        footerHTML += `<td class="p-1 border text-right sticky right-0 z-10">$${grandTotalValue.toFixed(2)}</td></tr>`;
        
        let vaciosReportHTML = '';
        const clientesConMovimientoVacios = Object.keys(vaciosMovementsPorTipo).filter(cliente => 
            TIPOS_VACIO.some(tipo => (vaciosMovementsPorTipo[cliente][tipo]?.entregados || 0) > 0 || (vaciosMovementsPorTipo[cliente][tipo]?.devueltos || 0) > 0)
        ).sort();
        
        if (clientesConMovimientoVacios.length > 0) {
            vaciosReportHTML = `
                <h3 class="text-xl font-bold text-gray-800 my-6">Reporte de Envases Retornables (Vacíos)</h3>
                <div class="overflow-auto border">
                    <table class="min-w-full bg-white text-xs">
                        <thead class="bg-gray-200">
                            <tr>
                                <th class="p-1 border text-left">Cliente</th>
                                <th class="p-1 border text-left">Tipo Vacío</th>
                                <th class="p-1 border text-center">Entregados (Cajas)</th>
                                <th class="p-1 border text-center">Devueltos (Cajas)</th>
                                <th class="p-1 border text-center">Neto</th>
                            </tr>
                        </thead>
                        <tbody>`;

            clientesConMovimientoVacios.forEach(cliente => {
                const movimientos = vaciosMovementsPorTipo[cliente];
                TIPOS_VACIO.forEach(tipoVacio => {
                    const mov = movimientos[tipoVacio] || { entregados: 0, devueltos: 0 };
                    if (mov.entregados > 0 || mov.devueltos > 0) {
                        const neto = mov.entregados - mov.devueltos;
                        vaciosReportHTML += `
                            <tr class="hover:bg-blue-50">
                                <td class="p-1 border">${cliente}</td>
                                <td class="p-1 border">${tipoVacio}</td>
                                <td class="p-1 border text-center">${mov.entregados}</td>
                                <td class="p-1 border text-center">${mov.devueltos}</td>
                                <td class="p-1 border text-center font-bold">${neto > 0 ? `+${neto}` : neto}</td>
                            </tr>
                        `;
                    }
                });
            });
            vaciosReportHTML += '</tbody></table></div>';
        }

        const vendedor = closingData.vendedorInfo || {};
        const reporteHTML = `
            <div class="text-left max-h-[80vh] overflow-auto">
                <div class="mb-4">
                    <p><strong>Vendedor:</strong> ${vendedor.nombre || ''} ${vendedor.apellido || ''}</p>
                    <p><strong>Camión:</strong> ${vendedor.camion || 'N/A'}</p>
                    <p><strong>Fecha:</strong> ${closingData.fecha.toDate().toLocaleString('es-ES')}</p>
                </div>
                <h3 class="text-xl font-bold text-gray-800 mb-4">Reporte de Cierre de Ventas</h3>
                <div class="overflow-auto border">
                    <table class="min-w-full bg-white text-xs">
                        <thead class="bg-gray-200">${headerRow1}${headerRow2}${headerRow3}${headerRow4}</thead>
                        <tbody>${bodyHTML}</tbody>
                        <tfoot>${footerHTML}</tfoot>
                    </table>
                </div>
                ${vaciosReportHTML}
            </div>`;
        _showModal(`Detalle del Cierre`, reporteHTML);
    }

     async function exportSingleClosingToExcel(closingData) {
        if (typeof XLSX === 'undefined') {
            _showModal('Error', 'La librería para exportar a Excel no está cargada.');
            return;
        }

        const { clientData, grandTotalValue, sortedClients, groupedProducts, finalProductOrder, sortedRubros, segmentoOrderMap, vaciosMovementsPorTipo, allProductsMap } = await processSalesDataForReport(closingData.ventas, closingData.vendedorInfo.userId);

        const dataForSheet1 = [];
        const merges1 = [];
        const headerRow1 = [""]; const headerRow2 = [""]; const headerRow3 = [""]; const headerRow4 = ["Cliente"];
        
        let currentColumn = 1;
        sortedRubros.forEach(rubro => {
            const rubroStartCol = currentColumn;
            let rubroColspan = 0;
            const sortedSegmentos = Object.keys(groupedProducts[rubro]).sort((a, b) => (segmentoOrderMap[a] ?? 999) - (segmentoOrderMap[b] ?? 999));
            sortedSegmentos.forEach(segmento => {
                const segmentoStartCol = currentColumn;
                let segmentoColspan = 0;
                const sortedMarcas = Object.keys(groupedProducts[rubro][segmento]).sort();
                sortedMarcas.forEach(marca => {
                    const marcaStartCol = currentColumn;
                    const presentaciones = groupedProducts[rubro][segmento][marca].sort((a,b) => a.presentacion.localeCompare(b.presentacion));
                    rubroColspan += presentaciones.length;
                    segmentoColspan += presentaciones.length;
                    headerRow3.push(marca);
                    for (let i = 1; i < presentaciones.length; i++) headerRow3.push("");
                    if (presentaciones.length > 1) merges1.push({ s: { r: 2, c: marcaStartCol }, e: { r: 2, c: marcaStartCol + presentaciones.length - 1 } });
                    presentaciones.forEach(p => headerRow4.push(p.presentacion));
                    currentColumn += presentaciones.length;
                });
                headerRow2.push(segmento);
                for (let i = 1; i < segmentoColspan; i++) headerRow2.push("");
                if (segmentoColspan > 1) merges1.push({ s: { r: 1, c: segmentoStartCol }, e: { r: 1, c: segmentoStartCol + segmentoColspan - 1 } });
            });
            headerRow1.push(rubro);
            for (let i = 1; i < rubroColspan; i++) headerRow1.push("");
            if (rubroColspan > 1) merges1.push({ s: { r: 0, c: rubroStartCol }, e: { r: 0, c: rubroStartCol + rubroColspan - 1 } });
        });
        
        headerRow1.push(""); headerRow2.push(""); headerRow3.push(""); headerRow4.push("Total Cliente");
        dataForSheet1.push(headerRow1, headerRow2, headerRow3, headerRow4);
        merges1.push({ s: { r: 0, c: 0 }, e: { r: 3, c: 0 } });
        merges1.push({ s: { r: 0, c: finalProductOrder.length + 1 }, e: { r: 3, c: finalProductOrder.length + 1 } });

        sortedClients.forEach(clientName => {
            const row = [clientName];
            const currentClient = clientData[clientName];
            finalProductOrder.forEach(product => {
                const quantityInUnits = currentClient.products[product.id] || 0;
                let displayQuantity = '';
    
                if (quantityInUnits > 0) {
                    displayQuantity = `${quantityInUnits} Unds`;
                    const ventaPor = product.ventaPor || {};
                    const unidadesPorCaja = product.unidadesPorCaja || 1;
                    const unidadesPorPaquete = product.unidadesPorPaquete || 1;
                    const isExclusiveCj = ventaPor.cj && !ventaPor.paq && !ventaPor.und;
                    const isExclusivePaq = ventaPor.paq && !ventaPor.cj && !ventaPor.und;
                    if (isExclusiveCj && unidadesPorCaja > 0) {
                        const totalBoxes = quantityInUnits / unidadesPorCaja;
                        displayQuantity = `${Number.isInteger(totalBoxes) ? totalBoxes : totalBoxes.toFixed(1)} Cj`;
                    } else if (isExclusivePaq && unidadesPorPaquete > 0) {
                        const totalPackages = quantityInUnits / unidadesPorPaquete;
                        displayQuantity = `${Number.isInteger(totalPackages) ? totalPackages : totalPackages.toFixed(1)} Paq`;
                    }
                }
                row.push(displayQuantity);
            });
            row.push(currentClient.totalValue);
            dataForSheet1.push(row);
        });

        const footerRow = ["TOTALES"];
        finalProductOrder.forEach(product => {
            let totalQty = 0;
            sortedClients.forEach(clientName => totalQty += clientData[clientName].products[product.id] || 0);
            
            let displayTotal = '';
            if (totalQty > 0) {
                displayTotal = `${totalQty} Unds`;
                const ventaPor = product.ventaPor || {};
                const unidadesPorCaja = product.unidadesPorCaja || 1;
                const unidadesPorPaquete = product.unidadesPorPaquete || 1;
                const isExclusiveCj = ventaPor.cj && !ventaPor.paq && !ventaPor.und;
                const isExclusivePaq = ventaPor.paq && !ventaPor.cj && !ventaPor.und;
                if (isExclusiveCj && unidadesPorCaja > 0) {
                    const totalBoxes = totalQty / unidadesPorCaja;
                    displayTotal = `${Number.isInteger(totalBoxes) ? totalBoxes : totalBoxes.toFixed(1)} Cj`;
                } else if (isExclusivePaq && unidadesPorPaquete > 0) {
                    const totalPackages = totalQty / unidadesPorPaquete;
                    displayTotal = `${Number.isInteger(totalPackages) ? totalPackages : totalPackages.toFixed(1)} Paq`;
                }
            }
            footerRow.push(displayTotal);
        });
        footerRow.push(grandTotalValue);
        dataForSheet1.push(footerRow);

        const ws1 = XLSX.utils.aoa_to_sheet(dataForSheet1);
        ws1['!merges'] = merges1;
        
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws1, 'Reporte de Cierre');

        const clientesConMovimientoVacios = Object.keys(vaciosMovementsPorTipo).filter(cliente => 
            TIPOS_VACIO.some(tipo => (vaciosMovementsPorTipo[cliente][tipo]?.entregados || 0) > 0 || (vaciosMovementsPorTipo[cliente][tipo]?.devueltos || 0) > 0)
        ).sort();
        
        if (clientesConMovimientoVacios.length > 0) {
            const dataForSheet2 = [['Cliente', 'Tipo Vacío', 'Entregados (Cajas)', 'Devueltos (Cajas)', 'Neto']];
            clientesConMovimientoVacios.forEach(cliente => {
                 const movimientos = vaciosMovementsPorTipo[cliente];
                TIPOS_VACIO.forEach(tipoVacio => {
                    const mov = movimientos[tipoVacio] || { entregados: 0, devueltos: 0 };
                     if(mov.entregados > 0 || mov.devueltos > 0) {
                        const neto = mov.entregados - mov.devueltos;
                        dataForSheet2.push([
                            cliente,
                            tipoVacio,
                            mov.entregados,
                            mov.devueltos,
                            neto
                        ]);
                    }
                });
            });
            const ws2 = XLSX.utils.aoa_to_sheet(dataForSheet2);
            XLSX.utils.book_append_sheet(wb, ws2, 'Reporte de Vacíos');
        }
        
        const vendedor = closingData.vendedorInfo || {};
        const fecha = closingData.fecha.toDate().toISOString().slice(0, 10);
        const vendedorNombre = (vendedor.nombre || 'Vendedor').replace(/\s/g, '_');
        XLSX.writeFile(wb, `Cierre_${vendedorNombre}_${fecha}.xlsx`);
    }

     async function handleDownloadSingleClosing(closingId) {
        const closingData = window.tempClosingsData.find(c => c.id === closingId);
        if (!closingData) {
            _showModal('Error', 'No se pudieron encontrar los datos del cierre para descargar.');
            return;
        }

        _showModal('Progreso', 'Generando archivo Excel...');

        try {
            await exportSingleClosingToExcel(closingData);
            const modalContainer = document.getElementById('modalContainer');
            if(modalContainer) modalContainer.classList.add('hidden');
        } catch (error) {
            console.error("Error al exportar cierre individual:", error);
            _showModal('Error', `Ocurrió un error al generar el archivo: ${error.message}`);
        }
    }

     function showProductStatsView() {
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl">
                        <h1 class="text-3xl font-bold text-gray-800 mb-6 text-center">Estadística de Productos Vendidos</h1>
                        
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 border rounded-lg items-end">
                            <div>
                                <label for="stats-type" class="block text-sm font-medium text-gray-700">Tipo de Estadística:</label>
                                <select id="stats-type" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md">
                                    <option value="semanal">Semanal</option>
                                    <option value="mensual">Mensual</option>
                                    <option value="general">General (Promedio Semanal)</option>
                                </select>
                            </div>
                            <div>
                                <label for="stats-rubro-filter" class="block text-sm font-medium text-gray-700">Rubro:</label>
                                <select id="stats-rubro-filter" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"></select>
                            </div>
                            <button id="searchStatsBtn" class="w-full px-6 py-2 bg-teal-600 text-white font-semibold rounded-lg shadow-md hover:bg-teal-700">Mostrar Estadísticas</button>
                        </div>

                        <div id="stats-list-container" class="overflow-x-auto max-h-96">
                            <p class="text-center text-gray-500">Seleccione las opciones y genere la estadística.</p>
                        </div>
                        <button id="backToDataMenuBtn" class="mt-6 w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver</button>
                    </div>
                </div>
            </div>
        `;
        
        _populateDropdown(`artifacts/${_appId}/users/${_userId}/rubros`, 'stats-rubro-filter', 'Rubro'); // Usar ruta completa del admin
        document.getElementById('backToDataMenuBtn').addEventListener('click', showDataView);
        document.getElementById('searchStatsBtn').addEventListener('click', handleSearchStats);
    }

     async function handleSearchStats() {
        const container = document.getElementById('stats-list-container');
        container.innerHTML = `<p class="text-center text-gray-500">Calculando estadísticas...</p>`;
        
        const statsType = document.getElementById('stats-type').value;
        const rubroFilter = document.getElementById('stats-rubro-filter').value;
        
        if (!rubroFilter) {
            _showModal('Error', 'Por favor, seleccione un rubro.');
            container.innerHTML = `<p class="text-center text-gray-500">Seleccione un rubro para continuar.</p>`;
            return;
        }

        const now = new Date();
        let fechaDesde;
        let fechaHasta = new Date();

        if (statsType === 'semanal') {
            const dayOfWeek = now.getDay();
            fechaDesde = new Date(now);
            const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
            fechaDesde.setDate(diff);
            fechaDesde.setHours(0, 0, 0, 0);
        } else if (statsType === 'mensual') {
            fechaDesde = new Date(now.getFullYear(), now.getMonth(), 1);
            fechaDesde.setHours(0, 0, 0, 0);
        } else {
            fechaDesde = new Date(0);
        }

        try {
            const publicClosingsRef = _collection(_db, `public_data/${_appId}/user_closings`);
            const adminClosingsRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/cierres`);

            const publicQuery = _query(publicClosingsRef, _where("fecha", ">=", fechaDesde), _where("fecha", "<=", fechaHasta));
            const adminQuery = _query(adminClosingsRef, _where("fecha", ">=", fechaDesde), _where("fecha", "<=", fechaHasta));

            const [publicSnapshot, adminSnapshot] = await Promise.all([_getDocs(publicQuery), _getDocs(adminQuery)]);
            
            const publicClosings = publicSnapshot.docs.map(doc => doc.data());
            const adminClosings = adminSnapshot.docs.map(doc => doc.data());
            const allClosings = [...publicClosings, ...adminClosings];
            
            if (allClosings.length === 0) {
                container.innerHTML = `<p class="text-center text-gray-500">No hay datos de ventas en el período seleccionado.</p>`;
                return;
            }

            const productSales = {};
            const adminInventarioRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`);
            const inventarioSnapshot = await _getDocs(adminInventarioRef);
            const adminInventarioMap = new Map(inventarioSnapshot.docs.map(doc => [doc.id, doc.data()]));
            
            allClosings.forEach(cierre => {
                cierre.ventas.forEach(venta => {
                    venta.productos.forEach(p => {
                        const adminProductInfo = adminInventarioMap.get(p.id) || p;
                         // Asegurarse de que adminProductInfo y rubro existan antes de comparar
                         if (adminProductInfo && adminProductInfo.rubro === rubroFilter) {
                            if (!productSales[p.id]) {
                                productSales[p.id] = {
                                    presentacion: p.presentacion,
                                    totalUnidades: 0,
                                    ventaPor: adminProductInfo.ventaPor,
                                    unidadesPorCaja: adminProductInfo.unidadesPorCaja || 1,
                                    unidadesPorPaquete: adminProductInfo.unidadesPorPaquete || 1
                                };
                            }
                            productSales[p.id].totalUnidades += p.totalUnidadesVendidas || 0; // Asegurarse de sumar números
                        }
                    });
                });
            });

            const productArray = Object.values(productSales);
            
            let numWeeks = 1;
            if (statsType === 'general') {
                const oneDay = 24 * 60 * 60 * 1000;
                const firstDate = allClosings.reduce((min, c) => (c.fecha.toDate ? c.fecha.toDate() : new Date(c.fecha)) < min ? (c.fecha.toDate ? c.fecha.toDate() : new Date(c.fecha)) : min, new Date());
                numWeeks = Math.max(1, Math.ceil(Math.abs((now - firstDate) / (oneDay * 7)))); // Asegurar al menos 1 semana
            }
            
            _lastStatsData = productArray;
            _lastNumWeeks = numWeeks;

            renderStatsList(productArray, statsType, numWeeks);

        } catch (error) {
            console.error("Error al calcular estadísticas:", error);
            container.innerHTML = `<p class="text-center text-red-500">Ocurrió un error al calcular las estadísticas.</p>`;
        }
    }

     function renderStatsList(productArray, statsType, numWeeks = 1) {
        const container = document.getElementById('stats-list-container');
        if (productArray.length === 0) {
            container.innerHTML = `<p class="text-center text-gray-500">No se encontraron ventas para este rubro en el período seleccionado.</p>`;
            return;
        }

        const headerTitle = statsType === 'general' ? 'Promedio Semanal' : 'Total Vendido';

        let tableHTML = `
            <table class="min-w-full bg-white text-sm">
                <thead class="bg-gray-200">
                    <tr>
                        <th class="py-2 px-3 border-b text-left">Producto</th>
                        <th class="py-2 px-3 border-b text-center">${headerTitle}</th>
                    </tr>
                </thead>
                <tbody>`;
        
        productArray.sort((a, b) => a.presentacion.localeCompare(b.presentacion));
        
        productArray.forEach(p => {
            let displayQuantity = 0;
            let displayUnit = 'Unds';
            const total = (p.totalUnidades || 0) / numWeeks; // Asegurar que totalUnidades es un número

             const unidadesPorCaja = p.unidadesPorCaja || 1;
             const unidadesPorPaquete = p.unidadesPorPaquete || 1;

            if (p.ventaPor?.cj) {
                displayQuantity = (total / unidadesPorCaja).toFixed(1);
                displayUnit = 'Cajas';
            } else if (p.ventaPor?.paq) {
                displayQuantity = (total / unidadesPorPaquete).toFixed(1);
                displayUnit = 'Paq.';
            } else {
                displayQuantity = total.toFixed(0);
            }
            if (displayQuantity.endsWith('.0')) {
                displayQuantity = displayQuantity.slice(0, -2);
            }
            
            tableHTML += `
                <tr class="hover:bg-gray-50">
                    <td class="py-2 px-3 border-b">${p.presentacion}</td>
                    <td class="py-2 px-3 border-b text-center font-bold">${displayQuantity} <span class="font-normal text-xs">${displayUnit}</span></td>
                </tr>
            `;
        });
        
        tableHTML += `</tbody></table>`;
        container.innerHTML = `
            ${tableHTML}
            <div class="mt-6 text-center">
                <button id="downloadStatsBtn" class="px-6 py-2 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700">Descargar como Excel</button>
            </div>
        `;

        document.getElementById('downloadStatsBtn').addEventListener('click', handleDownloadStats);
    }

     function handleDownloadStats() {
        if (_lastStatsData.length === 0) {
            _showModal('Aviso', 'No hay datos de estadísticas para descargar.');
            return;
        }
    
        if (typeof XLSX === 'undefined') {
            _showModal('Error', 'La librería para exportar a Excel no está cargada.');
            return;
        }
    
        const statsType = document.getElementById('stats-type').value;
        const headerTitle = statsType === 'general' ? 'Promedio Semanal' : 'Total Vendido';
        
        const dataToExport = _lastStatsData.map(p => {
            let displayQuantity = 0;
            let displayUnit = 'Unds';
            const total = (p.totalUnidades || 0) / _lastNumWeeks; // Asegurar número
            const unidadesPorCaja = p.unidadesPorCaja || 1;
            const unidadesPorPaquete = p.unidadesPorPaquete || 1;
    
            if (p.ventaPor?.cj) {
                displayQuantity = (total / unidadesPorCaja).toFixed(1);
                displayUnit = 'Cajas';
            } else if (p.ventaPor?.paq) {
                displayQuantity = (total / unidadesPorPaquete).toFixed(1);
                displayUnit = 'Paq.';
            } else {
                displayQuantity = total.toFixed(0);
            }
            if (displayQuantity.endsWith('.0')) {
                displayQuantity = displayQuantity.slice(0, -2);
            }
    
            return {
                'Producto': p.presentacion,
                [headerTitle]: `${displayQuantity} ${displayUnit}`
            };
        });
    
        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Estadisticas');
        
        const rubro = document.getElementById('stats-rubro-filter').value;
        const today = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(wb, `Estadisticas_${rubro}_${statsType}_${today}.xlsx`);
    }

     async function showConsolidatedClientsView() {
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl">
                        <h1 class="text-3xl font-bold text-gray-800 mb-6 text-center">Clientes Consolidados</h1>
                        <div id="consolidated-clients-filters"></div>
                        <div id="consolidated-clients-container" class="overflow-x-auto max-h-96">
                             <p class="text-center text-gray-500">Cargando clientes...</p>
                        </div>
                        <div class="mt-6 flex flex-col sm:flex-row gap-4">
                            <button id="backToDataMenuBtn" class="w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver</button>
                            <button id="downloadClientsBtn" class="w-full px-6 py-3 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 hidden">Descargar Lista Actual</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('backToDataMenuBtn').addEventListener('click', showDataView);
        document.getElementById('downloadClientsBtn').addEventListener('click', handleDownloadFilteredClients);

        await loadAndRenderConsolidatedClients();
    }
    
     async function loadAndRenderConsolidatedClients() {
        const container = document.getElementById('consolidated-clients-container');
        try {
            const clientesRef = _collection(_db, `artifacts/ventas-9a210/public/data/clientes`);
            const allClientSnapshots = await _getDocs(clientesRef);

            _consolidatedClientsCache = allClientSnapshots.docs.map(doc => doc.data());
            
            const filtersContainer = document.getElementById('consolidated-clients-filters');
            filtersContainer.innerHTML = `
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 border rounded-lg">
                    <input type="text" id="client-search-input" placeholder="Buscar por Nombre..." class="md:col-span-2 w-full px-4 py-2 border rounded-lg">
                    <div>
                        <label for="client-filter-sector" class="text-sm font-medium">Sector</label>
                        <select id="client-filter-sector" class="w-full px-2 py-1 border rounded-lg text-sm"><option value="">Todos</option></select>
                    </div>
                </div>
            `;

            const uniqueSectors = [...new Set(_consolidatedClientsCache.map(c => c.sector))].filter(Boolean).sort(); // Filtrar nulos/vacíos
            const sectorFilter = document.getElementById('client-filter-sector');
            uniqueSectors.forEach(sector => {
                sectorFilter.innerHTML += `<option value="${sector}">${sector}</option>`;
            });
            
            document.getElementById('client-search-input').addEventListener('input', renderConsolidatedClientsList);
            sectorFilter.addEventListener('change', renderConsolidatedClientsList);

            renderConsolidatedClientsList();
            document.getElementById('downloadClientsBtn').classList.remove('hidden');

        } catch (error) {
            console.error("Error al cargar clientes consolidados:", error);
            container.innerHTML = `<p class="text-center text-red-500">Ocurrió un error: ${error.message}</p>`;
        }
    }

     function renderConsolidatedClientsList() {
        const container = document.getElementById('consolidated-clients-container');
        const searchInput = document.getElementById('client-search-input');
        const sectorFilter = document.getElementById('client-filter-sector');

        if (!container || !searchInput || !sectorFilter) return;

        const searchTerm = searchInput.value.toLowerCase();
        const selectedSector = sectorFilter.value;

        _filteredClientsCache = _consolidatedClientsCache.filter(client => {
             const nombreComercial = client.nombreComercial || ''; // Evitar errores si falta
             const nombrePersonal = client.nombrePersonal || '';
            const searchMatch = !searchTerm || nombreComercial.toLowerCase().includes(searchTerm) || nombrePersonal.toLowerCase().includes(searchTerm);
            const sectorMatch = !selectedSector || client.sector === selectedSector;
            return searchMatch && sectorMatch;
        });

        if (_filteredClientsCache.length === 0) {
            container.innerHTML = `<p class="text-center text-gray-500">No se encontraron clientes que coincidan con los filtros.</p>`;
            return;
        }

        let tableHTML = `
            <table class="min-w-full bg-white text-sm">
                <thead class="bg-gray-200">
                    <tr>
                        <th class="py-2 px-3 border-b text-left">Sector</th>
                        <th class="py-2 px-3 border-b text-left">Nombre Comercial</th>
                        <th class="py-2 px-3 border-b text-left">Nombre Personal</th>
                        <th class="py-2 px-3 border-b text-left">Teléfono</th>
                    </tr>
                </thead>
                <tbody>`;
        _filteredClientsCache.sort((a,b) => (a.nombreComercial || '').localeCompare(b.nombreComercial || '')).forEach(c => { // Ordenar y manejar nulos
            tableHTML += `
                <tr class="hover:bg-gray-50">
                    <td class="py-2 px-3 border-b">${c.sector || 'N/A'}</td>
                    <td class="py-2 px-3 border-b font-semibold">${c.nombreComercial || 'N/A'}</td>
                    <td class="py-2 px-3 border-b">${c.nombrePersonal || 'N/A'}</td>
                    <td class="py-2 px-3 border-b">${c.telefono || 'N/A'}</td>
                </tr>
            `;
        });
        tableHTML += '</tbody></table>';
        container.innerHTML = tableHTML;
    }

     function handleDownloadFilteredClients() {
         if (typeof XLSX === 'undefined') {
            _showModal('Error', 'La librería para exportar a Excel no está cargada.');
            return;
        }
        if (_filteredClientsCache.length === 0) {
            _showModal('Aviso', 'No hay clientes en la lista actual para descargar.');
            return;
        }
        
        const dataToExport = _filteredClientsCache.map(c => ({
            'Sector': c.sector || '', // Usar '' si es nulo
            'Nombre Comercial': c.nombreComercial || '',
            'Nombre Personal': c.nombrePersonal || '',
            'telefono': c.telefono || '',
            'CEP': c.codigoCEP || ''
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Clientes Consolidados');
        
        const today = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(wb, `Clientes_Consolidados_${today}.xlsx`);
    }

     function showClientMapView() {
        if (mapInstance) {
            mapInstance.remove();
            mapInstance = null;
        }
        _floatingControls.classList.add('hidden');
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl">
                        <h1 class="text-3xl font-bold text-gray-800 mb-4 text-center">Mapa de Clientes Consolidados</h1>
                        <div class="relative mb-4">
                            <input type="text" id="map-search-input" placeholder="Buscar cliente por nombre o CEP..." class="w-full px-4 py-2 border rounded-lg">
                            <div id="map-search-results" class="absolute z-[1000] w-full bg-white border rounded-lg mt-1 max-h-60 overflow-y-auto hidden"></div>
                        </div>
                        <div class="mb-4 p-2 bg-gray-100 border rounded-lg text-sm flex justify-center items-center gap-4">
                           <span><img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png" style="height: 25px; display: inline;"> Cliente Regular</span>
                           <span><img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png" style="height: 25px; display: inline;"> Cliente con CEP</span>
                        </div>
                        <div id="client-map" class="w-full rounded-lg shadow-inner" style="height: 65vh; border: 1px solid #ccc;">
                            <p class="text-center text-gray-500 pt-10">Cargando mapa...</p>
                        </div>
                        <button id="backToDataMenuBtn" class="mt-6 w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver</button>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('backToDataMenuBtn').addEventListener('click', showDataView);
        loadAndDisplayMap();
    }

     async function loadAndDisplayMap() {
        const mapContainer = document.getElementById('client-map');
        if (!mapContainer || typeof L === 'undefined') {
            mapContainer.innerHTML = '<p class="text-center text-red-500 pt-10">Error: La librería de mapas (Leaflet) no está cargada.</p>';
            return;
        }

        try {
            const clientesRef = _collection(_db, `artifacts/ventas-9a210/public/data/clientes`);
            const allClientSnapshots = await _getDocs(clientesRef);
            const allClients = allClientSnapshots.docs.map(doc => doc.data());

            const clientsWithCoords = allClients.filter(c => {
                if (!c.coordenadas) return false;
                // Validar formato Lat, Lon y que sean números
                const parts = c.coordenadas.split(',');
                if (parts.length !== 2) return false;
                const lat = parseFloat(parts[0].trim());
                const lon = parseFloat(parts[1].trim());
                // Validar rangos razonables para Venezuela
                return !isNaN(lat) && !isNaN(lon) && lat >= 0 && lat <= 13 && lon >= -74 && lon <= -60;
            });


            if (clientsWithCoords.length === 0) {
                mapContainer.innerHTML = '<p class="text-center text-gray-500 pt-10">No se encontraron clientes con coordenadas válidas.</p>';
                return;
            }
            
            mapInstance = L.map('client-map').setView([7.77, -72.22], 13);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(mapInstance);

            const redIcon = new L.Icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
            });

            const blueIcon = new L.Icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
            });
            
            mapMarkers.clear();
            const markerGroup = [];
            clientsWithCoords.forEach(client => {
                const coords = client.coordenadas.split(',').map(p => parseFloat(p.trim()));
                const hasCEP = client.codigoCEP && client.codigoCEP.toLowerCase() !== 'n/a';
                const icon = hasCEP ? blueIcon : redIcon;

                 const nombreComercial = client.nombreComercial || 'Sin Nombre Comercial'; // Manejar nulos
                const nombrePersonal = client.nombrePersonal || '';
                const popupContent = `
                    <b>${nombreComercial}</b><br>
                    ${nombrePersonal}<br>
                    Tel: ${client.telefono || 'N/A'}<br>
                    Sector: ${client.sector || 'N/A'}
                    ${hasCEP ? `<br><b>CEP: ${client.codigoCEP}</b>` : ''}
                `;

                const marker = L.marker(coords, {icon: icon}).addTo(mapInstance).bindPopup(popupContent);
                mapMarkers.set(nombreComercial, marker); // Usar nombre comercial como clave
                markerGroup.push(marker);
            });

            if(markerGroup.length > 0) {
                const group = new L.featureGroup(markerGroup);
                mapInstance.fitBounds(group.getBounds().pad(0.1));
            }

            setupMapSearch(clientsWithCoords);

        } catch (error) {
            console.error("Error al cargar el mapa de clientes:", error);
            mapContainer.innerHTML = `<p class="text-center text-red-500 pt-10">Ocurrió un error al cargar los datos de los clientes.</p>`;
        }
    }
    
     function setupMapSearch(clients) {
        const searchInput = document.getElementById('map-search-input');
        const resultsContainer = document.getElementById('map-search-results');
        if (!searchInput || !resultsContainer) return;

        searchInput.addEventListener('input', () => {
            const searchTerm = searchInput.value.toLowerCase();
            if (searchTerm.length < 2) {
                resultsContainer.innerHTML = '';
                resultsContainer.classList.add('hidden');
                return;
            }

            const filteredClients = clients.filter(client => {
                 const nombreComercial = client.nombreComercial || ''; // Manejar nulos
                 const nombrePersonal = client.nombrePersonal || '';
                 const codigoCEP = client.codigoCEP || '';
                return nombreComercial.toLowerCase().includes(searchTerm) ||
                       nombrePersonal.toLowerCase().includes(searchTerm) ||
                       (codigoCEP && codigoCEP.toLowerCase().includes(searchTerm));
            });


            if (filteredClients.length === 0) {
                resultsContainer.innerHTML = '<div class="p-2 text-gray-500">No se encontraron clientes.</div>';
                resultsContainer.classList.remove('hidden');
                return;
            }

            resultsContainer.innerHTML = filteredClients.map(client => `
                <div class="p-2 hover:bg-gray-100 cursor-pointer" data-client-name="${client.nombreComercial || ''}">
                    <p class="font-semibold">${client.nombreComercial || 'Sin Nombre'}</p>
                    <p class="text-sm text-gray-600">${client.nombrePersonal || ''}</p>
                </div>
            `).join('');
            resultsContainer.classList.remove('hidden');
        });

        resultsContainer.addEventListener('click', (e) => {
            const target = e.target.closest('[data-client-name]');
            if (target && mapInstance) {
                const clientName = target.dataset.clientName;
                if (!clientName) return; // No hacer nada si el nombre está vacío
                const marker = mapMarkers.get(clientName);
                if (marker) {
                    mapInstance.flyTo(marker.getLatLng(), 17);
                    marker.openPopup();
                }
                searchInput.value = '';
                resultsContainer.innerHTML = '';
                resultsContainer.classList.add('hidden');
            }
        });

        document.addEventListener('click', function(event) {
            if (!resultsContainer.contains(event.target) && event.target !== searchInput) {
                resultsContainer.classList.add('hidden');
            }
        });
    }


    window.dataModule = {
        showClosingDetail,
        handleDownloadSingleClosing
    };

})();

