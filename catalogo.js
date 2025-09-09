// --- Lógica del módulo de Catálogo ---

(function() {
    let _db;
    let _userId;
    let _appId;
    let _mainContent;
    let _showMainMenu;
    let _collection;
    let _getDocs;

    // Variables para el catálogo
    let catalogoTasaCOP = 0;
    let catalogoMonedaActual = 'USD';
    let catalogoProductos = [];

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
                            <button data-rubros='["Cerveceria", "Vinos"]' data-bg="cervezayvinos.png" class="catalogo-btn w-full px-6 py-3 bg-yellow-500 text-white font-semibold rounded-lg shadow-md hover:bg-yellow-600 transition">
                                Cerveza y Vinos
                            </button>
                            <button data-rubros='["Maltin", "Pepsicola"]' data-bg="maltinypepsi.png" class="catalogo-btn w-full px-6 py-3 bg-blue-700 text-white font-semibold rounded-lg shadow-md hover:bg-blue-800 transition">
                                Maltin y Pepsicola
                            </button>
                            <button data-rubros='["Alimentos"]' data-bg="alimentospolar.png" class="catalogo-btn w-full px-6 py-3 bg-red-500 text-white font-semibold rounded-lg shadow-md hover:bg-red-600 transition">
                                Alimentos Polar
                            </button>
                            <button data-rubros='["P&G"]' data-bg="p&g.png" class="catalogo-btn w-full px-6 py-3 bg-sky-500 text-white font-semibold rounded-lg shadow-md hover:bg-sky-600 transition">
                                Procter & Gamble
                            </button>
                            <button data-rubros='[]' data-bg="" class="catalogo-btn md:col-span-2 w-full px-6 py-3 bg-gray-700 text-white font-semibold rounded-lg shadow-md hover:bg-gray-800 transition">
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
                const bgImage = e.target.dataset.bg;
                showCatalogoView(title, rubros, bgImage);
            });
        });
        document.getElementById('backToMenuBtn').addEventListener('click', _showMainMenu);
    };

    /**
     * Muestra la vista del catálogo filtrado por rubros.
     * @param {string} title Título del catálogo.
     * @param {Array<string>} rubros Array de rubros a filtrar.
     * @param {string} bgImage Nombre del archivo de imagen de fondo.
     */
    function showCatalogoView(title, rubros, bgImage) {
        document.body.style.setProperty('--catalogo-bg-image', `url('images/${bgImage}')`);
        document.body.classList.add('catalogo-active');

        catalogoMonedaActual = 'USD'; // Reset currency on new view
        _mainContent.innerHTML = `
            <div class="p-4">
                <div class="container mx-auto">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl">
                        <div id="catalogo-para-imagen">
                            <h2 class="text-2xl font-bold text-gray-800 mb-2 text-center">${title}</h2>
                            <p class="text-center text-gray-600 mb-4 text-xs">DISTRIBUIDORA CASTILLO YAÑEZ C.A</p>
                            <div class="mb-4">
                                <label for="catalogoTasaCopInput" class="block text-gray-700 text-sm font-medium mb-1">Tasa de Cambio (USD a COP):</label>
                                <input type="number" id="catalogoTasaCopInput" placeholder="Ej: 4000" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
                            </div>
                            <div id="catalogo-container" class="space-y-6">
                                <p class="text-center text-gray-500">Cargando catálogo...</p>
                            </div>
                        </div>
                        <div class="mt-6 text-center space-y-4">
                            <button id="generateCatalogoImageBtn" class="w-full px-6 py-3 bg-green-500 text-white font-semibold rounded-lg shadow-md hover:bg-green-600">Generar Imagen y Compartir</button>
                            <button id="backToCatalogoMenuBtn" class="w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">
                                Volver
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        const savedTasa = localStorage.getItem('tasaCOP');
        if (savedTasa) {
            catalogoTasaCOP = parseFloat(savedTasa);
            document.getElementById('catalogoTasaCopInput').value = catalogoTasaCOP;
        }

        document.getElementById('catalogoTasaCopInput').addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            catalogoTasaCOP = isNaN(value) ? 0 : value;
            localStorage.setItem('tasaCOP', catalogoTasaCOP);
            if (catalogoMonedaActual === 'COP') {
                renderCatalogo(document.getElementById('catalogo-container'), rubros);
            }
        });

        renderCatalogo(document.getElementById('catalogo-container'), rubros);
        document.getElementById('backToCatalogoMenuBtn').addEventListener('click', () => {
            document.body.classList.remove('catalogo-active');
            document.body.style.removeProperty('--catalogo-bg-image');
            window.showCatalogoSubMenu();
        });
        document.getElementById('generateCatalogoImageBtn').addEventListener('click', handleGenerateCatalogoImage);
    }

    /**
     * Cambia la moneda en la vista del catálogo.
     */
    window.toggleCatalogoMoneda = function() {
        if (catalogoTasaCOP <= 0) {
            alert('Por favor, ingresa una tasa de cambio válida para COP.');
            return;
        }
        catalogoMonedaActual = catalogoMonedaActual === 'USD' ? 'COP' : 'USD';
        const activeRubros = JSON.parse(document.querySelector('.catalogo-btn:focus')?.dataset.rubros || '[]');
        renderCatalogo(document.getElementById('catalogo-container'), activeRubros);
    };

    /**
     * Renderiza el catálogo de productos agrupados por rubro y marca.
     * @param {HTMLElement} container El elemento donde se renderizará el catálogo.
     * @param {Array<string>} rubrosFiltro Array de rubros para el filtro.
     */
    async function renderCatalogo(container, rubrosFiltro) {
        try {
            const inventarioRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`);
            const snapshot = await _getDocs(inventarioRef);
            let productos = snapshot.docs.map(doc => doc.data());

            if (rubrosFiltro && rubrosFiltro.length > 0) {
                productos = productos.filter(p => rubrosFiltro.some(filtro => p.rubro.toLowerCase().includes(filtro.toLowerCase())));
            }
            
            catalogoProductos = productos; // Guardar productos filtrados para la imagen

            if (productos.length === 0) {
                container.innerHTML = `<p class="text-center text-gray-600">No hay productos en esta categoría.</p>`;
                return;
            }

            const productosAgrupados = productos.reduce((acc, p) => {
                const rubro = p.rubro || 'Sin Rubro';
                const marca = p.marca || 'Sin Marca';
                if (!acc[rubro]) acc[rubro] = {};
                if (!acc[rubro][marca]) acc[rubro][marca] = [];
                acc[rubro][marca].push(p);
                return acc;
            }, {});

            let catalogoHTML = '';
            for (const rubro in productosAgrupados) {
                catalogoHTML += `<h3 class="text-xl font-bold text-gray-800 mt-6 pb-2 border-b-2 border-gray-300">${rubro}</h3>`;
                for (const marca in productosAgrupados[rubro]) {
                    catalogoHTML += `
                        <div class="mt-4">
                            <h4 class="text-lg font-semibold text-gray-700">${marca}</h4>
                            <table class="min-w-full bg-transparent text-sm">
                                <thead class="text-gray-600">
                                    <tr>
                                        <th class="py-2 px-2 text-left font-semibold">PRODUCTO</th>
                                        <th class="py-2 px-2 text-right font-semibold price-toggle" onclick="toggleCatalogoMoneda()">PRECIO SIN IVA</th>
                                        <th class="py-2 px-2 text-right font-semibold price-toggle" onclick="toggleCatalogoMoneda()">PRECIO CON IVA</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${productosAgrupados[rubro][marca].map(p => {
                                        const precioBase = p.iva === 16 ? p.precio / 1.16 : p.precio;
                                        const precioFinal = p.precio;
                                        let precioSinIvaMostrado, precioConIvaMostrado;

                                        if (catalogoMonedaActual === 'COP') {
                                            precioSinIvaMostrado = `COP ${ (Math.ceil((precioBase * catalogoTasaCOP) / 100) * 100).toLocaleString('es-CO')}`;
                                            precioConIvaMostrado = `COP ${ (Math.ceil((precioFinal * catalogoTasaCOP) / 100) * 100).toLocaleString('es-CO')}`;
                                        } else {
                                            precioSinIvaMostrado = `$${precioBase.toFixed(2)}`;
                                            precioConIvaMostrado = `$${precioFinal.toFixed(2)}`;
                                        }

                                        return `
                                            <tr class="border-b border-gray-200">
                                                <td class="py-2 px-2">${p.presentacion}</td>
                                                <td class="py-2 px-2 text-right">${precioSinIvaMostrado}</td>
                                                <td class="py-2 px-2 text-right font-bold">${precioConIvaMostrado}</td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    `;
                }
            }
            container.innerHTML = catalogoHTML;

        } catch (error) {
            console.error("Error al renderizar el catálogo:", error);
            container.innerHTML = `<p class="text-center text-red-500">Error al cargar el catálogo.</p>`;
        }
    }

    /**
     * Maneja la generación de la imagen del catálogo.
     */
    async function handleGenerateCatalogoImage() {
        const reportElement = document.getElementById('catalogo-para-imagen');
        if (!reportElement) {
            alert('No se encontró el contenido del catálogo para generar la imagen.');
            return;
        }

        const shareButton = document.getElementById('generateCatalogoImageBtn');
        shareButton.textContent = 'Generando...';
        shareButton.disabled = true;

        try {
            await new Promise(resolve => setTimeout(resolve, 300));
            const canvas = await html2canvas(reportElement, { scale: 3, useCORS: true });
            canvas.toBlob(async (blob) => {
                if (navigator.share && blob) {
                    try {
                        await navigator.share({
                            files: [new File([blob], "catalogo.png", { type: "image/png" })],
                            title: "Catálogo de Productos",
                        });
                    } catch (err) {
                        if (err.name !== 'AbortError') alert('No se pudo compartir la imagen del catálogo.');
                    }
                } else {
                    alert('La función para compartir no está disponible en este navegador.');
                }
            }, 'image/png');
        } catch (error) {
            console.error("Error al generar la imagen del catálogo: ", error);
            alert(`Ocurrió un error al generar la imagen: ${error.message}`);
        } finally {
            shareButton.textContent = 'Generar Imagen y Compartir';
            shareButton.disabled = false;
        }
    }

})();
