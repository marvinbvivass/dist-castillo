// --- Lógica del módulo de Catálogo ---

(function() {
    let _db;
    let _userId;
    let _appId;
    let _mainContent;
    let _showMainMenu;
    let _collection;
    let _getDocs;


    /**
     * Inicializa el módulo de catálogo con las dependencias necesarias.
     */
    window.initCatalogo = function(db, userId, appId, mainContentElement, showMainMenuCallback, firestoreCollection, firestoreGetDocs) {
        _db = db;
        _userId = userId;
        _appId = appId;
        _mainContent = mainContentElement;
        _showMainMenu = showMainMenuCallback;
        _collection = firestoreCollection;
        _getDocs = firestoreGetDocs;
    };

    /**
     * Muestra el submenú de opciones del catálogo.
     */
    window.showCatalogoSubMenu = function() {
        _mainContent.innerHTML = `
            <div class="p-4">
                <div class="container mx-auto">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl text-center">
                        <h1 class="text-3xl font-bold text-gray-800 mb-6">Catálogo de Productos</h1>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <button data-rubros='["Cerveceria", "Vinos"]' class="catalogo-btn w-full px-6 py-3 bg-yellow-500 text-white font-semibold rounded-lg shadow-md hover:bg-yellow-600 transition">
                                Cerveza y Vinos
                            </button>
                            <button data-rubros='["Maltin", "Pepsicola"]' class="catalogo-btn w-full px-6 py-3 bg-blue-700 text-white font-semibold rounded-lg shadow-md hover:bg-blue-800 transition">
                                Maltin y Pepsicola
                            </button>
                            <button data-rubros='["Alimentos"]' class="catalogo-btn w-full px-6 py-3 bg-red-500 text-white font-semibold rounded-lg shadow-md hover:bg-red-600 transition">
                                Alimentos Polar
                            </button>
                            <button data-rubros='["P&G"]' class="catalogo-btn w-full px-6 py-3 bg-sky-500 text-white font-semibold rounded-lg shadow-md hover:bg-sky-600 transition">
                                Procter & Gamble
                            </button>
                            <button data-rubros='[]' class="catalogo-btn md:col-span-2 w-full px-6 py-3 bg-gray-700 text-white font-semibold rounded-lg shadow-md hover:bg-gray-800 transition">
                                Unificado (Todos)
                            </button>
                        </div>
                        <button id="backToMenuBtn" class="mt-6 w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500 transition">
                            Volver al Menú Principal
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.querySelectorAll('.catalogo-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const rubros = JSON.parse(e.target.dataset.rubros);
                const title = e.target.textContent.trim();
                showCatalogoView(title, rubros);
            });
        });
        document.getElementById('backToMenuBtn').addEventListener('click', _showMainMenu);
    };

    /**
     * Muestra la vista del catálogo filtrado por rubros.
     * @param {string} title Título del catálogo.
     * @param {Array<string>} rubros Array de rubros a filtrar.
     */
    function showCatalogoView(title, rubros) {
        _mainContent.innerHTML = `
            <div class="p-4">
                <div class="container mx-auto">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl">
                        <h2 class="text-2xl font-bold text-gray-800 mb-6 text-center">${title}</h2>
                        <div id="catalogo-container" class="space-y-6">
                            <p class="text-center text-gray-500">Cargando catálogo...</p>
                        </div>
                        <button id="backToCatalogoMenuBtn" class="mt-6 w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500 transition">
                            Volver
                        </button>
                    </div>
                </div>
            </div>
        `;
        renderCatalogo(document.getElementById('catalogo-container'), rubros);
        document.getElementById('backToCatalogoMenuBtn').addEventListener('click', window.showCatalogoSubMenu);
    }

    /**
     * Renderiza el catálogo de productos agrupados por marca.
     * @param {HTMLElement} container El elemento donde se renderizará el catálogo.
     * @param {Array<string>} rubrosFiltro Array de rubros para el filtro.
     */
    async function renderCatalogo(container, rubrosFiltro) {
        try {
            const inventarioRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`);
            const snapshot = await _getDocs(inventarioRef);
            let productos = snapshot.docs.map(doc => doc.data());

            // Filtrar por rubros si es necesario
            if (rubrosFiltro && rubrosFiltro.length > 0) {
                productos = productos.filter(p => rubrosFiltro.some(filtro => p.rubro.toLowerCase().includes(filtro.toLowerCase())));
            }
            
            if (productos.length === 0) {
                container.innerHTML = `<p class="text-center text-gray-600">No hay productos en esta categoría.</p>`;
                return;
            }

            // Agrupar productos por marca
            const productosPorMarca = productos.reduce((acc, p) => {
                (acc[p.marca] = acc[p.marca] || []).push(p);
                return acc;
            }, {});

            let catalogoHTML = '';
            for (const marca in productosPorMarca) {
                catalogoHTML += `
                    <div>
                        <h3 class="text-xl font-bold text-gray-800 mb-2 pb-2 border-b-2 border-gray-300">${marca}</h3>
                        <table class="min-w-full bg-transparent">
                            <thead class="text-gray-700">
                                <tr>
                                    <th class="py-2 px-2 text-left font-semibold">PRODUCTO</th>
                                    <th class="py-2 px-2 text-right font-semibold">PRECIO SIN IVA</th>
                                    <th class="py-2 px-2 text-right font-semibold">PRECIO CON IVA</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${productosPorMarca[marca].map(p => {
                                    const precioSinIva = p.iva === 16 ? p.precio / 1.16 : p.precio;
                                    const precioConIva = p.precio;
                                    return `
                                        <tr class="border-b border-gray-200">
                                            <td class="py-2 px-2">${p.presentacion}</td>
                                            <td class="py-2 px-2 text-right">$${precioSinIva.toFixed(2)}</td>
                                            <td class="py-2 px-2 text-right font-bold">$${precioConIva.toFixed(2)}</td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
            }
            container.innerHTML = catalogoHTML;

        } catch (error) {
            console.error("Error al renderizar el catálogo:", error);
            container.innerHTML = `<p class="text-center text-red-500">Error al cargar el catálogo.</p>`;
        }
    }
})();

