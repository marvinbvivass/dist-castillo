// --- Lógica del módulo de Catálogo ---

(function() {
    // Variables locales del módulo
    let _db, _userId, _appId, _mainContent, _showMainMenu, _collection, _getDocs, _floatingControls;

    // Estado específico del catálogo
    let _catalogoTasaCOP = 0;
    let _catalogoMonedaActual = 'USD';
    let _currentRubros = [];
    let _currentBgImage = '';
    let _segmentoOrderCacheCatalogo = null;
    let _inventarioCache = []; // Caché de inventario para tener todos los datos

    // Caché de datos para la generación de imágenes paginadas
    let _marcasCache = [];
    let _productosAgrupadosCache = {};

    /**
     * Inicializa el módulo de catálogo.
     */
    window.initCatalogo = function(dependencies) {
        _db = dependencies.db;
        _userId = dependencies.userId;
        _appId = dependencies.appId;
        _mainContent = dependencies.mainContent;
        _showMainMenu = dependencies.showMainMenu;
        _collection = dependencies.collection;
        _getDocs = dependencies.getDocs;
        _floatingControls = dependencies.floatingControls; // Guardar referencia

        // Verificar si floatingControls se pasó correctamente
        if (!_floatingControls) {
            console.warn("Catalogo Init Warning: floatingControls element was not provided or found.");
        }
        console.log("Catalogo module initialized.");
    };

    /**
     * Obtiene y cachea el mapa de orden de los segmentos.
     */
    async function getSegmentoOrderMapCatalogo() {
        if (_segmentoOrderCacheCatalogo) return _segmentoOrderCacheCatalogo;

        // Intentar obtener del módulo de inventario si está disponible
        if (window.inventarioModule && typeof window.inventarioModule.getSegmentoOrderMap === 'function') {
            try {
                _segmentoOrderCacheCatalogo = await window.inventarioModule.getSegmentoOrderMap();
                if (_segmentoOrderCacheCatalogo) {
                    console.log("Segment order map obtained from inventarioModule.");
                    return _segmentoOrderCacheCatalogo; // Usar si se obtuvo
                }
            } catch (e) {
                console.warn("Error getting segment order map from inventarioModule:", e);
            }
        }

        // Fallback: Leer directamente si falla lo anterior
        console.log("Falling back to direct segment order read in catalogo.js");
        const map = {};
        // CORRECCIÓN: Usar la ruta del usuario actual para leer SU orden de segmentos
        const segmentosRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/segmentos`);
        try {
            const snapshot = await _getDocs(segmentosRef);
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                map[data.name] = (data.orden !== undefined && data.orden !== null) ? data.orden : 9999;
            });
            _segmentoOrderCacheCatalogo = map;
            console.log("Segment order map loaded/cached via fallback:", _segmentoOrderCacheCatalogo);
            return map;
        } catch (e) {
            console.warn("No se pudo obtener el orden de los segmentos en catalogo.js (fallback failed):", e);
            return {}; // Devolver vacío si todo falla
        }
    }

    /**
     * Muestra el submenú de opciones del catálogo.
     */
    window.showCatalogoSubMenu = function() {
        // --- INICIO CORRECCIÓN ---
        if (_floatingControls) {
            _floatingControls.classList.add('hidden');
        } else {
            console.warn("showCatalogoSubMenu: floatingControls not available.");
        }
        // --- FIN CORRECCIÓN ---
        document.body.classList.remove('catalogo-active');
        document.body.style.removeProperty('--catalogo-bg-image');
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto max-w-lg"> {/* Consistent width */}
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl text-center">
                        <h1 class="text-3xl font-bold text-gray-800 mb-6">Catálogo de Productos</h1>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Simplified buttons */}
                            <button data-rubros='["CERVECERIA Y VINOS"]' data-bg="images/cervezayvinos.png" class="catalogo-btn w-full px-6 py-3 bg-yellow-500 text-white font-semibold rounded-lg shadow-md hover:bg-yellow-600 transition duration-200">Cerveza y Vinos</button>
                            <button data-rubros='["MALTIN & PEPSI"]' data-bg="images/maltinypepsi.png" class="catalogo-btn w-full px-6 py-3 bg-blue-700 text-white font-semibold rounded-lg shadow-md hover:bg-blue-800 transition duration-200">Maltin y Pepsicola</button>
                            <button data-rubros='["ALIMENTOS"]' data-bg="images/alimentospolar.png" class="catalogo-btn w-full px-6 py-3 bg-red-500 text-white font-semibold rounded-lg shadow-md hover:bg-red-600 transition duration-200">Alimentos Polar</button>
                            <button data-rubros='["P&G"]' data-bg="images/p&g.png" class="catalogo-btn w-full px-6 py-3 bg-sky-500 text-white font-semibold rounded-lg shadow-md hover:bg-sky-600 transition duration-200">Procter & Gamble</button>
                            <button data-rubros='[]' data-bg="" class="catalogo-btn md:col-span-2 w-full px-6 py-3 bg-gray-700 text-white font-semibold rounded-lg shadow-md hover:bg-gray-800 transition duration-200">Unificado (Todos)</button>
                        </div>
                        <button id="backToMenuBtn" class="mt-6 w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500 transition duration-200">Volver al Menú</button>
                    </div>
                </div>
            </div>
        `;
        document.querySelectorAll('.catalogo-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                 try {
                     _currentRubros = JSON.parse(e.target.dataset.rubros || '[]'); // Default to empty array
                 } catch (parseError) {
                      console.error("Error parsing rubros data:", parseError, e.target.dataset.rubros);
                      _currentRubros = []; // Fallback to empty
                 }
                const title = e.target.textContent.trim();
                const bgImage = e.target.dataset.bg || ''; // Default to empty string
                showCatalogoView(title, bgImage);
            });
        });
        document.getElementById('backToMenuBtn').addEventListener('click', _showMainMenu);
    }

    /**
     * Muestra la vista detallada de un catálogo filtrado.
     */
    function showCatalogoView(title, bgImage) {
        _currentBgImage = bgImage;
        if (bgImage) {
            document.body.style.setProperty('--catalogo-bg-image', `url('${bgImage}')`);
             document.body.classList.add('catalogo-active');
        } else {
             document.body.classList.remove('catalogo-active');
             document.body.style.removeProperty('--catalogo-bg-image');
        }
        _catalogoMonedaActual = 'USD'; // Reset currency on view change

        // --- INICIO CORRECCIÓN ---
        if (_floatingControls) {
            _floatingControls.classList.add('hidden'); // Ocultar controles flotantes en el catálogo
        } else {
            console.warn("showCatalogoView: floatingControls not available.");
        }
         // Asegurarse de que _mainContent esté definido
         if (!_mainContent) {
             console.error("CRITICAL: Main content area not available in showCatalogoView");
             alert("Error crítico: No se encuentra el área de contenido principal.");
             return; // Salir si no se encuentra
         }
        // --- FIN CORRECCIÓN ---

        _mainContent.innerHTML = `
            <div class="p-4 pt-6 md:pt-8"> {/* Less padding top on mobile */}
                <div class="container mx-auto">
                    {/* Wrapper con overflow auto para scrolling interno si es necesario */}
                    <div id="catalogo-container-wrapper" class="bg-white/95 backdrop-blur-sm p-4 sm:p-6 md:p-8 rounded-lg shadow-xl max-h-[calc(100vh-6rem)] overflow-y-auto">
                        {/* Contenido que se convertirá en imagen */}
                        <div id="catalogo-para-imagen">
                            <h2 class="text-3xl md:text-4xl font-bold text-black mb-2 text-center">${title}</h2>
                            <p class="text-center text-gray-800 mb-1 text-sm md:text-base">DISTRIBUIDORA CASTILLO YAÑEZ C.A</p>
                            <p class="text-center text-gray-700 mb-4 text-xs md:text-base italic">(Todos los precios incluyen IVA)</p>

                            <div class="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4">
                                <div id="tasa-input-container" class="flex-grow w-full sm:w-auto">
                                    <label for="catalogoTasaCopInput" class="block text-sm font-medium mb-1">Tasa (USD a COP):</label>
                                    <input type="number" id="catalogoTasaCopInput" placeholder="Ej: 4000" class="w-full px-3 py-1.5 border rounded-lg text-sm"> {/* Ajustar padding/size */}
                                </div>
                                {/* El botón de moneda ahora está en la cabecera de la tabla */}
                            </div>

                            <div id="catalogo-content" class="space-y-6"><p class="text-center text-gray-500 p-4">Cargando...</p></div>
                        </div>
                        {/* Botones fuera del área de imagen */}
                         <div id="catalogo-buttons-container" class="mt-6 text-center space-y-3 sm:space-y-4">
                             <button id="generateCatalogoImageBtn" class="w-full px-6 py-2.5 bg-green-500 text-white font-semibold rounded-lg shadow-md hover:bg-green-600 transition duration-200">Generar Imagen</button>
                             <button id="backToCatalogoMenuBtn" class="w-full px-6 py-2.5 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500 transition duration-200">Volver</button>
                         </div>
                    </div>
                </div>
            </div>
        `;

        const tasaInput = document.getElementById('catalogoTasaCopInput');
        if (tasaInput) {
            // Mejora Potencial: Leer/Escribir tasa desde/hacia Firestore config en lugar de localStorage
            const savedTasa = localStorage.getItem('tasaCOP');
            if (savedTasa) {
                _catalogoTasaCOP = parseFloat(savedTasa);
                tasaInput.value = _catalogoTasaCOP;
            }
            tasaInput.addEventListener('input', (e) => {
                _catalogoTasaCOP = parseFloat(e.target.value) || 0;
                localStorage.setItem('tasaCOP', _catalogoTasaCOP);
                if (_catalogoMonedaActual === 'COP') {
                    renderCatalogo(); // Re-renderizar si la moneda actual es COP
                }
            });
        }

        document.getElementById('backToCatalogoMenuBtn').addEventListener('click', showCatalogoSubMenu);
        document.getElementById('generateCatalogoImageBtn').addEventListener('click', handleGenerateCatalogoImage);

        loadAndRenderCatalogo(); // Carga el inventario antes de renderizar
    }

    /**
     * Alterna la moneda del catálogo y re-renderiza la vista.
     */
    window.toggleCatalogoMoneda = function() {
        if (_catalogoTasaCOP <= 0) {
             window.showModal('Aviso', 'Ingresa una tasa de cambio (USD a COP) válida para ver precios en COP.'); // Usar showModal global
            return;
        }
        _catalogoMonedaActual = _catalogoMonedaActual === 'USD' ? 'COP' : 'USD';
        renderCatalogo(); // Re-renderizar con la nueva moneda
    };

    /**
     * Carga los datos del inventario del usuario actual y luego renderiza el catálogo.
     */
    async function loadAndRenderCatalogo() {
        const container = document.getElementById('catalogo-content');
        if (!container) return;
        container.innerHTML = `<p class="text-center text-gray-500 p-4">Cargando inventario...</p>`;

        try {
            // Obtener datos frescos del inventario del usuario actual para el catálogo
             console.log("Fetching fresh inventory for catalog...");
             const inventarioRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`);
             const snapshot = await _getDocs(inventarioRef);
             _inventarioCache = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
             console.log(`Inventory fetched for catalog: ${_inventarioCache.length} items.`);

            await renderCatalogo(); // Renderizar con los datos cargados
        } catch (error) {
            console.error("Error al cargar el inventario para el catálogo:", error);
            container.innerHTML = `<p class="text-center text-red-500 p-4">Error al cargar el inventario.</p>`;
        }
    }

    /**
     * Renderiza la tabla de productos del catálogo.
     */
    async function renderCatalogo() {
        const container = document.getElementById('catalogo-content');
        if (!container) { console.error("Catalogo content container not found."); return; }
        container.innerHTML = `<p class="text-center text-gray-500 p-4">Ordenando productos...</p>`;

        try {
            let productos = [..._inventarioCache]; // Trabajar con copia de la caché

            // Filtrar por rubros seleccionados (si los hay)
            if (_currentRubros && _currentRubros.length > 0) {
                productos = productos.filter(p => p.rubro && _currentRubros.includes(p.rubro));
            }

            // Ordenar productos
            const segmentoOrderMap = await getSegmentoOrderMapCatalogo(); // Obtener mapa de orden
            productos.sort((a, b) => {
                 const orderA = segmentoOrderMap[a.segmento] ?? 9999;
                 const orderB = segmentoOrderMap[b.segmento] ?? 9999;
                 if (orderA !== orderB) return orderA - orderB;
                 const marcaComp = (a.marca || '').localeCompare(b.marca || '');
                 if (marcaComp !== 0) return marcaComp;
                 return (a.presentacion || '').localeCompare(b.presentacion || '');
            });

            if (productos.length === 0) {
                container.innerHTML = `<p class="text-center text-gray-500 p-4">No hay productos ${ _currentRubros.length > 0 ? 'en esta categoría' : 'definidos'}.</p>`;
                _marcasCache = []; // Limpiar caché de marcas
                _productosAgrupadosCache = {}; // Limpiar caché de productos agrupados
                return;
            }

            // Agrupar productos por marca para la visualización
            const productosAgrupados = productos.reduce((acc, p) => {
                const marca = p.marca || 'Sin Marca';
                if (!acc[marca]) acc[marca] = [];
                acc[marca].push(p);
                return acc;
            }, {});

             // Obtener lista ordenada de marcas presentes en los productos filtrados
             const marcasOrdenadas = [...new Set(productos.map(p => p.marca || 'Sin Marca'))]
                .sort((a, b) => a.localeCompare(b)); // Ordenar marcas alfabéticamente


            // Guardar en caché para generación de imagen
            _marcasCache = marcasOrdenadas;
            _productosAgrupadosCache = productosAgrupados;

            // Construir HTML
            let html = '<div class="space-y-4">'; // Espacio entre tablas de marca
            const monedaLabel = _catalogoMonedaActual === 'COP' ? 'PRECIO (COP)' : 'PRECIO (USD)';

            marcasOrdenadas.forEach(marca => {
                html += `<table class="min-w-full bg-transparent text-sm md:text-lg print:text-sm"> {/* Ajustar tamaño fuente */}
                            <thead class="text-black">
                                <tr><th colspan="2" class="py-2 px-2 md:px-4 bg-gray-100 font-bold text-left text-base md:text-xl rounded-t-lg">${marca}</th></tr>
                                <tr>
                                    <th class="py-1 md:py-2 px-2 md:px-4 text-left font-semibold text-xs md:text-base border-b border-gray-300">PRESENTACIÓN (Segmento)</th>
                                    {/* Botón para cambiar moneda */}
                                    <th class="py-1 md:py-2 px-2 md:px-4 text-right font-semibold text-xs md:text-base border-b border-gray-300 price-toggle" onclick="window.toggleCatalogoMoneda()" title="Clic para cambiar moneda">${monedaLabel} <span class="text-gray-500 text-xs">⇆</span></th> {/* Añadido ícono */}
                                </tr>
                            </thead>
                            <tbody>`;

                const productosDeMarca = productosAgrupados[marca]; // Ya están ordenados por segmento/presentación

                productosDeMarca.forEach(p => {
                    const ventaPor = p.ventaPor || { und: true };
                    const precios = p.precios || { und: p.precioPorUnidad || 0 };

                    let precioBaseUSD = 0;
                    let displayPresentacion = `${p.presentacion || 'N/A'}`; // Incluir segmento en descripción
                    let unitInfo = ''; // Información de unidades por empaque

                    // Determinar precio base y descripción según forma de venta principal
                    // Priorizar Caja, luego Paquete, luego Unidad
                    if (ventaPor.cj && precios.cj > 0) { // Usar > 0 para asegurar que hay precio definido
                        precioBaseUSD = precios.cj;
                        unitInfo = `(Cj/${p.unidadesPorCaja || 1} und)`;
                    } else if (ventaPor.paq && precios.paq > 0) {
                        precioBaseUSD = precios.paq;
                        unitInfo = `(Paq/${p.unidadesPorPaquete || 1} und)`;
                    } else { // Fallback a Und (o si solo se vende por Und)
                        precioBaseUSD = precios.und || 0;
                         unitInfo = `(Und)`;
                    }

                    // Formato del precio según moneda actual
                    let precioMostrado;
                    if (_catalogoMonedaActual === 'COP' && _catalogoTasaCOP > 0) {
                         // Redondear al múltiplo de 100 más cercano hacia arriba
                        precioMostrado = `COP ${(Math.ceil((precioBaseUSD * _catalogoTasaCOP) / 100) * 100).toLocaleString('es-CO')}`;
                    } else {
                        // Asegurar formato USD incluso si precioBaseUSD es 0
                        precioMostrado = `$${precioBaseUSD.toFixed(2)}`;
                    }

                     // Segmento como texto más pequeño
                    const segmentoDisplay = p.segmento ? `<span class="text-xs text-gray-500 ml-1">(${p.segmento})</span>` : '';

                    html += `
                        <tr class="border-b border-gray-200 last:border-b-0">
                            <td class="py-1.5 md:py-2 px-2 md:px-4 text-gray-900 align-top"> {/* Align top */}
                                ${displayPresentacion} ${segmentoDisplay}
                                ${unitInfo ? `<span class="block text-xs text-gray-500">${unitInfo}</span>` : ''} {/* Info unidades */}
                            </td>
                            <td class="py-1.5 md:py-2 px-2 md:px-4 text-right font-semibold align-top">${precioMostrado}</td> {/* Align top */}
                        </tr>
                    `;
                });
                html += `</tbody></table>`;
            });
            html += '</div>';
            container.innerHTML = html;
        } catch (error) {
            console.error("Error al renderizar el catálogo:", error);
            container.innerHTML = `<p class="text-center text-red-500 p-4">Error al mostrar el catálogo.</p>`;
        }
    }


    /**
     * Genera una o varias imágenes del catálogo (dividido por páginas) y las comparte.
     * Mejora Potencial: Considerar usar una librería diferente a html2canvas si el rendimiento es un problema,
     * o generar PDF en el lado del servidor (Cloud Function) si la complejidad aumenta.
     */
    async function handleGenerateCatalogoImage() {
        const MAX_BRANDS_PER_PAGE = 5; // Ajustable según necesidad

        const shareButton = document.getElementById('generateCatalogoImageBtn');
        const tasaInputContainer = document.getElementById('tasa-input-container');
        const buttonsContainer = document.getElementById('catalogo-buttons-container');

        if (!_marcasCache || _marcasCache.length === 0) {
             window.showModal('Aviso', 'No hay productos en el catálogo actual para generar imagen.');
             return;
        }

        // Dividir marcas en páginas
        const pagesOfBrands = [];
        for (let i = 0; i < _marcasCache.length; i += MAX_BRANDS_PER_PAGE) {
            pagesOfBrands.push(_marcasCache.slice(i, i + MAX_BRANDS_PER_PAGE));
        }
        const totalPages = pagesOfBrands.length;

        // Ocultar UI y mostrar progreso
        if (shareButton) {
            shareButton.textContent = `Generando ${totalPages} imagen(es)... (Puede tardar)`;
            shareButton.disabled = true;
        }
        if (tasaInputContainer) tasaInputContainer.classList.add('hidden');
        if (buttonsContainer) buttonsContainer.classList.add('hidden');
        window.showModal('Progreso', `Generando ${totalPages} página(s) del catálogo como imagen...`); // Usar modal de progreso


        try {
            const imageFiles = await Promise.all(pagesOfBrands.map(async (brandsInPage, index) => {
                const pageNum = index + 1;
                console.log(`Generating image for page ${pageNum}/${totalPages}`);

                // Construir HTML solo para las marcas de esta página
                let contentHtml = '<div class="space-y-4">';
                const monedaLabel = _catalogoMonedaActual === 'COP' ? 'PRECIO (COP)' : 'PRECIO (USD)';
                brandsInPage.forEach(marca => {
                    contentHtml += `<table class="min-w-full bg-transparent text-lg print:text-sm">
                                <thead class="text-black">
                                    <tr><th colspan="2" class="py-2 px-4 bg-gray-100 font-bold text-left text-xl rounded-t-lg">${marca}</th></tr>
                                    <tr><th class="py-2 px-4 text-left font-semibold text-base border-b border-gray-300">PRESENTACIÓN (Segmento)</th><th class="py-2 px-4 text-right font-semibold text-base border-b border-gray-300">${monedaLabel}</th></tr>
                                </thead><tbody>`;
                    const productosDeMarca = _productosAgrupadosCache[marca] || [];
                    productosDeMarca.forEach(p => {
                        // (Misma lógica de cálculo de precio y descripción que en renderCatalogo)
                        const ventaPor = p.ventaPor || { und: true };
                        const precios = p.precios || { und: p.precioPorUnidad || 0 };
                        let precioBaseUSD = 0;
                        let displayPresentacion = `${p.presentacion || 'N/A'}`;
                        let unitInfo = '';

                        if (ventaPor.cj && precios.cj > 0) { precioBaseUSD = precios.cj; unitInfo = `(Cj/${p.unidadesPorCaja || 1} und)`; }
                        else if (ventaPor.paq && precios.paq > 0) { precioBaseUSD = precios.paq; unitInfo = `(Paq/${p.unidadesPorPaquete || 1} und)`; }
                        else { precioBaseUSD = precios.und || 0; unitInfo = `(Und)`; }

                        let precioMostrado = _catalogoMonedaActual === 'COP' && _catalogoTasaCOP > 0
                            ? `COP ${(Math.ceil((precioBaseUSD * _catalogoTasaCOP) / 100) * 100).toLocaleString('es-CO')}`
                            : `$${precioBaseUSD.toFixed(2)}`;

                        const segmentoDisplay = p.segmento ? `<span class="text-xs text-gray-500 ml-1">(${p.segmento})</span>` : '';

                        contentHtml += `<tr class="border-b border-gray-200 last:border-b-0"><td class="py-2 px-4 text-gray-900 align-top">${displayPresentacion} ${segmentoDisplay} ${unitInfo ? `<span class="block text-xs text-gray-500">${unitInfo}</span>` : ''}</td><td class="py-2 px-4 text-right font-semibold align-top">${precioMostrado}</td></tr>`;
                    });
                    contentHtml += `</tbody></table>`;
                });
                contentHtml += '</div>';

                // Crear HTML completo para la página actual
                const titleElement = document.querySelector('#catalogo-para-imagen h2');
                const title = titleElement ? titleElement.textContent.trim() : 'Catálogo'; // Obtener título dinámicamente
                const fullPageHtml = `
                    <div class="bg-white p-8" style="width: 800px; /* Ancho fijo para consistencia */ box-shadow: none; border: 1px solid #eee;"> {/* Estilo base para imagen */}
                        <h2 class="text-4xl font-bold text-black mb-2 text-center">${title}</h2>
                        <p class="text-center text-gray-800 mb-1 text-base">DISTRIBUIDORA CASTILLO YAÑEZ C.A</p>
                        <p class="text-center text-gray-700 mb-4 text-base italic">(Todos los precios incluyen IVA)</p>
                        ${contentHtml}
                        <p class="text-center text-gray-600 mt-4 text-sm">Página ${pageNum} de ${totalPages}</p>
                    </div>`;

                // Crear elemento temporal para renderizar
                const tempDiv = document.createElement('div');
                tempDiv.style.position = 'absolute';
                tempDiv.style.left = '-9999px'; // Fuera de pantalla
                tempDiv.style.top = '0';
                tempDiv.innerHTML = fullPageHtml;
                document.body.appendChild(tempDiv);

                const pageWrapper = tempDiv.firstElementChild;

                // Aplicar fondo si existe
                if (_currentBgImage) {
                    // Usar gradiente más opaco para mejor legibilidad del texto
                    pageWrapper.style.backgroundImage = `linear-gradient(rgba(255, 255, 255, 0.85), rgba(255, 255, 255, 0.85)), url('${_currentBgImage}')`;
                    pageWrapper.style.backgroundSize = 'cover';
                    pageWrapper.style.backgroundPosition = 'center';
                }

                // Generar canvas y blob
                 console.log(` - Rendering page ${pageNum} with html2canvas...`);
                 // Aumentar escala para mejor calidad, usar fondo blanco explícito si no hay imagen
                const canvasOptions = { scale: 3, useCORS: true, allowTaint: true, backgroundColor: _currentBgImage ? null : '#FFFFFF' };
                const canvas = await html2canvas(pageWrapper, canvasOptions);
                const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png', 0.9)); // Calidad 0.9
                console.log(` - Blob created for page ${pageNum}, size: ${blob.size} bytes`);

                document.body.removeChild(tempDiv); // Limpiar DOM
                // Crear nombre de archivo más descriptivo
                const safeTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
                return new File([blob], `catalogo_${safeTitle}_p${pageNum}.png`, { type: "image/png" });
            }));

            // Cerrar modal de progreso
            const modalContainer = document.getElementById('modalContainer');
            if(modalContainer) modalContainer.classList.add('hidden');


            // Compartir archivos generados
            if (navigator.share && imageFiles.length > 0 && navigator.canShare && navigator.canShare({ files: imageFiles })) { // Verificar si se pueden compartir archivos
                 console.log(`Sharing ${imageFiles.length} catalog image(s)...`);
                 try {
                     await navigator.share({
                         files: imageFiles,
                         title: `Catálogo: ${title}`,
                         text: `Catálogo de productos (${title}) - ${totalPages > 1 ? `${totalPages} páginas` : ''}`
                     });
                     console.log("Catalog shared successfully.");
                 } catch (shareError) {
                      // Manejar error si el usuario cancela o falla el share
                      console.warn("Sharing failed or was cancelled:", shareError);
                      // No mostrar error si el usuario canceló
                      if (shareError.name !== 'AbortError') { // AbortError es común al cancelar
                          window.showModal('Error al Compartir', 'No se pudieron compartir las imágenes.');
                      }
                 }
            } else if (imageFiles.length > 0) {
                 window.showModal('Imágenes Generadas', 'Las imágenes del catálogo se generaron, pero tu navegador no soporta compartir archivos directamente. Intenta descargar o buscar las imágenes.');
                 // Opcional: Intentar descargar la primera imagen como fallback
                 try {
                     const firstImage = imageFiles[0];
                     const url = URL.createObjectURL(firstImage);
                     const a = document.createElement('a');
                     a.href = url;
                     a.download = firstImage.name;
                     document.body.appendChild(a);
                     a.click();
                     document.body.removeChild(a);
                     URL.revokeObjectURL(url);
                     console.log("Attempted to download the first image as fallback.");
                 } catch (downloadError) {
                     console.error("Failed to download image fallback:", downloadError);
                 }
            } else {
                 window.showModal('Error', 'No se pudieron generar las imágenes del catálogo.');
            }
        } catch (error) {
            console.error("Error grave al generar imagen(es) del catálogo: ", error);
             window.showModal('Error Grave', `No se pudo generar la imagen: ${error.message || error}`);
        } finally {
            // Restaurar UI
            if (shareButton) {
                shareButton.textContent = 'Generar Imagen';
                shareButton.disabled = false;
            }
            if (tasaInputContainer) tasaInputContainer.classList.remove('hidden');
            if (buttonsContainer) buttonsContainer.classList.remove('hidden');
            // Asegurarse de cerrar modal de progreso si aún está abierto
             const modalContainer = document.getElementById('modalContainer');
             const modalTitle = modalContainer?.querySelector('h3')?.textContent;
             if(modalContainer && modalTitle?.startsWith('Progreso')) {
                  modalContainer.classList.add('hidden');
             }
        }
    }


    // Exponer función para invalidar la caché (si otros módulos necesitan hacerlo)
    window.catalogoModule = {
        invalidateCache: () => { _segmentoOrderCacheCatalogo = null; }
    };

})();
