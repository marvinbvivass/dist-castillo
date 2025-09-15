// --- Lógica del módulo de Catálogo ---

(function() {
    // Variables locales para almacenar las dependencias de la app principal
    let _db, _userId, _appId, _mainContent, _showMainMenu, _collection, _getDocs;
    
    // Estado específico del catálogo gestionado dentro de este módulo
    let _catalogoTasaCOP = 0;
    let _catalogoMonedaActual = 'USD';
    let _currentRubros = []; // Almacena los rubros del catálogo que se está viendo

    /**
     * Inicializa el módulo de catálogo. 
     * Esta función es llamada desde index.html para pasar las dependencias necesarias.
     */
    window.initCatalogo = function(dependencies) {
        _db = dependencies.db;
        _userId = dependencies.userId;
        _appId = dependencies.appId;
        _mainContent = dependencies.mainContent;
        _showMainMenu = dependencies.showMainMenu;
        _collection = dependencies.collection;
        _getDocs = dependencies.getDocs;
    };

    /**
     * Muestra el submenú de opciones del catálogo.
     */
    window.showCatalogoSubMenu = function() {
        document.body.classList.remove('catalogo-active');
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl text-center">
                        <h1 class="text-3xl font-bold text-gray-800 mb-6">Catálogo de Productos</h1>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <button data-rubros='["Cerveceria", "Vinos"]' data-bg="images/cervezayvinos.png" class="catalogo-btn w-full px-6 py-3 bg-yellow-500 text-white font-semibold rounded-lg shadow-md hover:bg-yellow-600">Cerveza y Vinos</button>
                            <button data-rubros='["Maltin", "Pepsicola"]' data-bg="images/maltinypepsi.png" class="catalogo-btn w-full px-6 py-3 bg-blue-700 text-white font-semibold rounded-lg shadow-md hover:bg-blue-800">Maltin y Pepsicola</button>
                            <button data-rubros='["Alimentos"]' data-bg="images/alimentospolar.png" class="catalogo-btn w-full px-6 py-3 bg-red-500 text-white font-semibold rounded-lg shadow-md hover:bg-red-600">Alimentos Polar</button>
                            <button data-rubros='["P&G"]' data-bg="images/p&g.png" class="catalogo-btn w-full px-6 py-3 bg-sky-500 text-white font-semibold rounded-lg shadow-md hover:bg-sky-600">Procter & Gamble</button>
                            <button data-rubros='[]' data-bg="" class="catalogo-btn md:col-span-2 w-full px-6 py-3 bg-gray-700 text-white font-semibold rounded-lg shadow-md hover:bg-gray-800">Unificado (Todos)</button>
                        </div>
                        <button id="backToMenuBtn" class="mt-6 w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500">Volver al Menú</button>
                    </div>
                </div>
            </div>
        `;
        document.querySelectorAll('.catalogo-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                _currentRubros = JSON.parse(e.target.dataset.rubros); // Guardar rubros actuales
                const title = e.target.textContent.trim();
                const bgImage = e.target.dataset.bg;
                showCatalogoView(title, bgImage);
            });
        });
        document.getElementById('backToMenuBtn').addEventListener('click', _showMainMenu);
    }

    /**
     * Muestra la vista detallada de un catálogo filtrado.
     */
    function showCatalogoView(title, bgImage) {
        if (bgImage) {
            document.body.style.setProperty('--catalogo-bg-image', `url('${bgImage}')`);
        }
        document.body.classList.add('catalogo-active');
        _catalogoMonedaActual = 'USD';

        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl">
                        <div id="catalogo-para-imagen">
                            <h2 class="text-2xl font-bold text-gray-800 mb-2 text-center">${title}</h2>
                            <p class="text-center text-gray-600 mb-4 text-xs">DISTRIBUIDORA CASTILLO YAÑEZ C.A</p>
                            <div id="tasa-input-container" class="mb-4">
                                <label for="catalogoTasaCopInput" class="block text-sm font-medium mb-1">Tasa (USD a COP):</label>
                                <input type="number" id="catalogoTasaCopInput" placeholder="Ej: 4000" class="w-full px-4 py-2 border rounded-lg">
                            </div>
                            <div id="catalogo-container" class="space-y-6"><p class="text-center text-gray-500">Cargando...</p></div>
                        </div>
                        <div class="mt-6 text-center space-y-4">
                            <button id="generateCatalogoImageBtn" class="w-full px-6 py-3 bg-green-500 text-white rounded-lg shadow-md hover:bg-green-600">Generar Imagen</button>
                            <button id="backToCatalogoMenuBtn" class="w-full px-6 py-3 bg-gray-400 text-white rounded-lg shadow-md hover:bg-gray-500">Volver</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        const savedTasa = localStorage.getItem('tasaCOP');
        if (savedTasa) {
            _catalogoTasaCOP = parseFloat(savedTasa);
            document.getElementById('catalogoTasaCopInput').value = _catalogoTasaCOP;
        }

        document.getElementById('catalogoTasaCopInput').addEventListener('input', (e) => {
            _catalogoTasaCOP = parseFloat(e.target.value) || 0;
            localStorage.setItem('tasaCOP', _catalogoTasaCOP);
            if (_catalogoMonedaActual === 'COP') {
                renderCatalogo();
            }
        });

        document.getElementById('backToCatalogoMenuBtn').addEventListener('click', showCatalogoSubMenu);
        document.getElementById('generateCatalogoImageBtn').addEventListener('click', handleGenerateCatalogoImage);
        renderCatalogo();
    }

    /**
     * Alterna la moneda del catálogo y re-renderiza la vista.
     */
    window.toggleCatalogoMoneda = function() {
        if (_catalogoTasaCOP <= 0) {
            alert('Por favor, ingresa una tasa de cambio válida para convertir a COP.');
            return;
        }
        _catalogoMonedaActual = _catalogoMonedaActual === 'USD' ? 'COP' : 'USD';
        renderCatalogo(); // Re-renderiza con los rubros guardados en _currentRubros
    };
    
    /**
     * Renderiza la tabla de productos del catálogo.
     */
    async function renderCatalogo() {
        const container = document.getElementById('catalogo-container');
        if (!container) return;

        try {
            const inventarioRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`);
            const snapshot = await _getDocs(inventarioRef);
            let productos = snapshot.docs.map(doc => doc.data());

            if (_currentRubros && _currentRubros.length > 0) {
                productos = productos.filter(p => _currentRubros.includes(p.rubro));
            }

            if (productos.length === 0) {
                container.innerHTML = `<p class="text-center text-gray-500">No hay productos en esta categoría.</p>`;
                return;
            }
            
            // Agrupar productos por marca
            const productosAgrupados = productos.reduce((acc, p) => {
                const marca = p.marca || 'Sin Marca';
                if (!acc[marca]) acc[marca] = [];
                acc[marca].push(p);
                return acc;
            }, {});

            // Ordenar las marcas alfabéticamente
            const marcasOrdenadas = Object.keys(productosAgrupados).sort((a, b) => a.localeCompare(b));

            let html = '<div class="space-y-4">';
            marcasOrdenadas.forEach(marca => {
                html += `<table class="min-w-full bg-transparent text-sm">
                            <thead class="text-gray-700">
                                <tr><th colspan="3" class="py-2 px-4 bg-gray-100 font-bold text-gray-600 text-left">${marca}</th></tr>
                                <tr>
                                    <th class="py-2 px-2 text-left font-semibold">PRESENTACIÓN</th>
                                    <th class="py-2 px-2 text-right font-semibold price-toggle" onclick="toggleCatalogoMoneda()">PRECIO S/IVA</th>
                                    <th class="py-2 px-2 text-right font-semibold price-toggle" onclick="toggleCatalogoMoneda()">PRECIO C/IVA</th>
                                </tr>
                            </thead>
                            <tbody>`;
                
                // Ordenar productos dentro de cada marca por presentación
                const productosOrdenados = productosAgrupados[marca].sort((a, b) => a.presentacion.localeCompare(b.presentacion));

                productosOrdenados.forEach(p => {
                    const precioSinIva = p.iva === 16 ? p.precio / 1.16 : p.precio;
                    let precioSinIvaMostrado, precioConIvaMostrado;

                    if (_catalogoMonedaActual === 'COP' && _catalogoTasaCOP > 0) {
                        precioSinIvaMostrado = `COP ${(Math.ceil((precioSinIva * _catalogoTasaCOP) / 100) * 100).toLocaleString('es-CO')}`;
                        precioConIvaMostrado = `COP ${(Math.ceil((p.precio * _catalogoTasaCOP) / 100) * 100).toLocaleString('es-CO')}`;
                    } else {
                        precioSinIvaMostrado = `$${precioSinIva.toFixed(2)}`;
                        precioConIvaMostrado = `$${p.precio.toFixed(2)}`;
                    }

                    html += `
                        <tr class="border-b border-gray-200">
                            <td class="py-2 px-2">${p.presentacion} <span class="text-xs text-gray-500">(${p.unidadTipo || 'und.'})</span> (${p.segmento})</td>
                            <td class="py-2 px-2 text-right">${precioSinIvaMostrado}</td>
                            <td class="py-2 px-2 text-right font-bold">${precioConIvaMostrado}</td>
                        </tr>
                    `;
                });
                html += `</tbody></table>`;
            });
            html += '</div>';
            container.innerHTML = html;
        } catch (error) {
            console.error("Error al renderizar el catálogo:", error);
            container.innerHTML = `<p class="text-center text-red-500">Error al cargar el catálogo.</p>`;
        }
    }

    /**
     * Genera una imagen del catálogo y la comparte.
     */
    async function handleGenerateCatalogoImage() {
        const reportElement = document.getElementById('catalogo-para-imagen');
        const shareButton = document.getElementById('generateCatalogoImageBtn');
        const tasaInputContainer = document.getElementById('tasa-input-container');

        if (!reportElement) return;

        shareButton.textContent = 'Generando...';
        shareButton.disabled = true;
        tasaInputContainer.classList.add('hidden');

        try {
            await new Promise(resolve => setTimeout(resolve, 100));
            const canvas = await html2canvas(reportElement, { scale: 2, useCORS: true });
            canvas.toBlob(async (blob) => {
                if (navigator.share && blob) {
                    try {
                        await navigator.share({
                            files: [new File([blob], "catalogo.png", { type: "image/png" })],
                            title: "Catálogo de Productos"
                        });
                    } catch (err) {
                        if (err.name !== 'AbortError') {
                            alert('No se pudo compartir la imagen.');
                        }
                    }
                } else {
                    alert('La función para compartir no está disponible en este navegador.');
                }
            }, 'image/png');
        } catch (error) {
            console.error("Error al generar imagen del catálogo: ", error);
        } finally {
            shareButton.textContent = 'Generar Imagen';
            shareButton.disabled = false;
            tasaInputContainer.classList.remove('hidden');
        }
    }

})();
