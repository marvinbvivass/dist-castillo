// --- Lógica del módulo de Catálogo ---

(function() {
    // Variables privadas del módulo que se inicializarán desde index.html
    let _db;
    let _userId;
    let _appId;
    let _mainContent;
    let _showMainMenu;
    let _collection;
    let _getDocs;

    // Estado interno del catálogo
    let catalogoTasaCOP = 0;
    let catalogoMonedaActual = 'USD';

    /**
     * Inicializa el módulo de catálogo con las dependencias necesarias.
     * Esta función es llamada desde index.html cuando el usuario inicia sesión.
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
        // Limpia listeners anteriores para evitar duplicados
        if (window.cleanupListeners) window.cleanupListeners();
        document.body.classList.remove('catalogo-active');

        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
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
     */
    function showCatalogoView(title, rubros, bgImage) {
        // Aplica el fondo dinámico si se especifica una imagen
        if (bgImage) {
            document.body.style.setProperty('--catalogo-bg-image', `url('images/${bgImage}')`);
            document.body.classList.add('catalogo-active');
        }

        catalogoMonedaActual = 'USD'; // Reinicia la moneda a USD cada vez que se abre un catálogo
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl">
                        <div id="catalogo-para-imagen">
                            <h2 class="text-2xl font-bold text-gray-800 mb-2 text-center">${title}</h2>
                            <p class="text-center text-gray-600 mb-4 text-xs">DISTRIBUIDORA CASTILLO YAÑEZ C.A</p>
                            <div class="mb-4" id="tasa-input-container">
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
        
        // Recupera y establece la tasa de cambio guardada
        const savedTasa = localStorage.getItem('tasaCOP');
        if (savedTasa) {
            catalogoTasaCOP = parseFloat(savedTasa);
            document.getElementById('catalogoTasaCopInput').value = catalogoTasaCOP;
        }

        // Guarda la tasa en localStorage y actualiza la vista si la moneda es COP
        document.getElementById('catalogoTasaCopInput').addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            catalogoTasaCOP = isNaN(value) ? 0 : value;
            localStorage.setItem('tasaCOP', catalogoTasaCOP);
            if (catalogoMonedaActual === 'COP') {
                renderCatalogo(document.getElementById('catalogo-container'), rubros);
            }
        });

        // Eventos de los botones
        document.getElementById('backToCatalogoMenuBtn').addEventListener('click', window.showCatalogoSubMenu);
        document.getElementById('generateCatalogoImageBtn').addEventListener('click', handleGenerateCatalogoImage);
        
        // Renderiza el catálogo inicial
        renderCatalogo(document.getElementById('catalogo-container'), rubros);
    }

    /**
     * Cambia la moneda en la vista del catálogo (USD <-> COP).
     */
    window.toggleCatalogoMoneda = function() {
        if (catalogoTasaCOP <= 0) {
            alert('Por favor, ingresa una tasa de cambio válida para convertir a COP.');
            return;
        }
        catalogoMonedaActual = catalogoMonedaActual === 'USD' ? 'COP' : 'USD';
        
        const titleElement = _mainContent.querySelector('h2');
        const title = titleElement ? titleElement.textContent.trim() : '';
        
        // Determina los rubros actuales para poder re-renderizar
        let rubros = [];
        const btn = Array.from(document.querySelectorAll('.catalogo-btn')).find(b => b.textContent.trim() === title);
        if (btn) {
            rubros = JSON.parse(btn.dataset.rubros);
        }
        
        renderCatalogo(document.getElementById('catalogo-container'), rubros);
    };

    /**
     * Obtiene los productos y los renderiza en una tabla.
     */
    async function renderCatalogo(container, rubrosFiltro) {
        try {
            const inventarioRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`);
            const snapshot = await _getDocs(inventarioRef);
            let productos = snapshot.docs.map(doc => doc.data());

            // Filtra por rubros si se ha seleccionado una categoría
            if (rubrosFiltro && rubrosFiltro.length > 0) {
                productos = productos.filter(p => rubrosFiltro.includes(p.rubro));
            }

            if (productos.length === 0) {
                container.innerHTML = `<p class="text-center text-gray-600">No hay productos en esta categoría.</p>`;
                return;
            }

            // Agrupa productos por segmento para una mejor visualización
            const productosAgrupados = productos.reduce((acc, p) => {
                const segmento = p.segmento || 'General';
                if (!acc[segmento]) acc[segmento] = [];
                acc[segmento].push(p);
                return acc;
            }, {});

            let catalogoHTML = '';
            for (const segmento in productosAgrupados) {
                catalogoHTML += `<h3 class="text-xl font-bold text-gray-800 mt-6 pb-2 border-b-2 border-gray-300">${segmento}</h3>`;
                catalogoHTML += `
                    <table class="min-w-full bg-transparent text-sm mt-2">
                        <thead class="text-gray-700">
                            <tr>
                                <th class="py-2 px-2 text-left font-semibold">MARCA</th>
                                <th class="py-2 px-2 text-left font-semibold">PRESENTACIÓN</th>
                                <th class="py-2 px-2 text-right font-semibold price-toggle" onclick="toggleCatalogoMoneda()">PRECIO SIN IVA</th>
                                <th class="py-2 px-2 text-right font-semibold price-toggle" onclick="toggleCatalogoMoneda()">PRECIO CON IVA</th>
                            </tr>
                        </thead>
                        <tbody>
                `;

                productosAgrupados[segmento].forEach(p => {
                    const precioSinIva = p.iva === 16 ? p.precio / 1.16 : p.precio;
                    const precioConIva = p.precio;
                    let precioSinIvaMostrado, precioConIvaMostrado;

                    if (catalogoMonedaActual === 'COP' && catalogoTasaCOP > 0) {
                        precioSinIvaMostrado = `COP ${ (Math.ceil((precioSinIva * catalogoTasaCOP) / 100) * 100).toLocaleString('es-CO')}`;
                        precioConIvaMostrado = `COP ${ (Math.ceil((precioConIva * catalogoTasaCOP) / 100) * 100).toLocaleString('es-CO')}`;
                    } else {
                        precioSinIvaMostrado = `$${precioSinIva.toFixed(2)}`;
                        precioConIvaMostrado = `$${precioConIva.toFixed(2)}`;
                    }

                    catalogoHTML += `
                        <tr class="border-b border-gray-200">
                            <td class="py-2 px-2 font-bold">${p.marca}</td>
                            <td class="py-2 px-2">${p.presentacion}</td>
                            <td class="py-2 px-2 text-right">${precioSinIvaMostrado}</td>
                            <td class="py-2 px-2 text-right font-bold">${precioConIvaMostrado}</td>
                        </tr>
                    `;
                });
                 catalogoHTML += `</tbody></table>`;
            }
            container.innerHTML = catalogoHTML;

        } catch (error) {
            console.error("Error al renderizar el catálogo:", error);
            container.innerHTML = `<p class="text-center text-red-500">Error al cargar el catálogo.</p>`;
        }
    }

    /**
     * Utiliza html2canvas para generar una imagen del catálogo y la comparte usando la Web Share API.
     */
    async function handleGenerateCatalogoImage() {
        const reportElement = document.getElementById('catalogo-para-imagen');
        if (!reportElement) return;

        const shareButton = document.getElementById('generateCatalogoImageBtn');
        const tasaInputContainer = document.getElementById('tasa-input-container');

        shareButton.textContent = 'Generando...';
        shareButton.disabled = true;
        tasaInputContainer.classList.add('hidden'); // Ocultar el input para una imagen más limpia

        try {
            await new Promise(resolve => setTimeout(resolve, 100)); // Pequeña pausa para que el DOM se actualice
            const canvas = await html2canvas(reportElement, { scale: 2, useCORS: true });
            canvas.toBlob(async (blob) => {
                if (navigator.share && blob) {
                    try {
                        await navigator.share({
                            files: [new File([blob], "catalogo.png", { type: "image/png" })],
                            title: "Catálogo de Productos",
                        });
                    } catch (err) {
                        if (err.name !== 'AbortError') console.error('Error al compartir:', err);
                    }
                } else {
                    alert('La función para compartir no está disponible en este navegador.');
                }
            }, 'image/png');
        } catch (error) {
            console.error("Error al generar la imagen del catálogo: ", error);
        } finally {
            // Restaura el estado original del botón y el input
            shareButton.textContent = 'Generar Imagen y Compartir';
            shareButton.disabled = false;
            tasaInputContainer.classList.remove('hidden');
        }
    }

})();
