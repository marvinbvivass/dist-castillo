(function() {
    let _db, _userId, _appId, _mainContent, _showMainMenu, _collection, _getDocs, _floatingControls;
    let _catalogoTasaCOP = 0;
    let _catalogoMonedaActual = 'USD';
    let _currentRubros = [];
    let _currentBgImage = '';
    let _segmentoOrderCacheCatalogo = null;
    let _inventarioCache = [];
    let _marcasCache = [];
    let _productosAgrupadosCache = {};

    window.initCatalogo = function(dependencies) {
        _db = dependencies.db;
        _userId = dependencies.userId;
        _appId = dependencies.appId;
        _mainContent = dependencies.mainContent;
        _showMainMenu = dependencies.showMainMenu;
        _collection = dependencies.collection;
        _getDocs = dependencies.getDocs;
        _floatingControls = dependencies.floatingControls;
        if (!_floatingControls) {
            console.warn("Catalogo Init Warning: floatingControls element was not provided or found.");
        }
    };

    async function getSegmentoOrderMapCatalogo() {
        if (_segmentoOrderCacheCatalogo) return _segmentoOrderCacheCatalogo;
        if (window.inventarioModule?.getSegmentoOrderMap) {
            try {
                _segmentoOrderCacheCatalogo = await window.inventarioModule.getSegmentoOrderMap();
                if (_segmentoOrderCacheCatalogo) return _segmentoOrderCacheCatalogo;
            } catch (e) {
                console.warn("Error getting segment order map from inventarioModule:", e);
            }
        }
        const map = {};
        const segmentosRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/segmentos`);
        try {
            const snapshot = await _getDocs(segmentosRef);
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                map[data.name] = (data.orden !== undefined && data.orden !== null) ? data.orden : 9999;
            });
            _segmentoOrderCacheCatalogo = map;
            return map;
        } catch (e) {
            console.warn("No se pudo obtener el orden de los segmentos en catalogo.js (fallback failed):", e);
            return {};
        }
    }

    window.showCatalogoSubMenu = function() {
        if (_floatingControls) {
            _floatingControls.classList.add('hidden');
        }
        document.body.classList.remove('catalogo-active');
        document.body.style.removeProperty('--catalogo-bg-image');
        _mainContent.innerHTML = `
            <div class="p-4 pt-8">
                <div class="container mx-auto max-w-lg">
                    <div class="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-xl text-center">
                        <h1 class="text-3xl font-bold text-gray-800 mb-6">Catálogo de Productos</h1>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                     _currentRubros = JSON.parse(e.target.dataset.rubros || '[]');
                 } catch (parseError) {
                      console.error("Error parsing rubros data:", parseError, e.target.dataset.rubros);
                      _currentRubros = [];
                 }
                const title = e.target.textContent.trim();
                const bgImage = e.target.dataset.bg || '';
                showCatalogoView(title, bgImage);
            });
        });
        document.getElementById('backToMenuBtn').addEventListener('click', _showMainMenu);
    }

    function showCatalogoView(title, bgImage) {
        _currentBgImage = bgImage;
        if (bgImage) {
            document.body.style.setProperty('--catalogo-bg-image', `url('${bgImage}')`);
             document.body.classList.add('catalogo-active');
        } else {
             document.body.classList.remove('catalogo-active');
             document.body.style.removeProperty('--catalogo-bg-image');
        }
        _catalogoMonedaActual = 'USD';

        if (_floatingControls) {
            _floatingControls.classList.add('hidden');
        }
         if (!_mainContent) {
             console.error("CRITICAL: Main content area not available in showCatalogoView");
             alert("Error crítico: No se encuentra el área de contenido principal.");
             return;
         }

        _mainContent.innerHTML = `
            <div class="p-4 pt-6 md:pt-8">
                <div class="container mx-auto">
                    <div id="catalogo-container-wrapper" class="bg-white/95 backdrop-blur-sm p-4 sm:p-6 md:p-8 rounded-lg shadow-xl max-h-[calc(100vh-6rem)] overflow-y-auto">
                        <div id="catalogo-para-imagen">
                            <h2 class="text-3xl md:text-4xl font-bold text-black mb-2 text-center">${title}</h2>
                            <p class="text-center text-gray-800 mb-1 text-sm md:text-base">DISTRIBUIDORA CASTILLO YAÑEZ C.A</p>
                            <p class="text-center text-gray-700 mb-4 text-xs md:text-base italic">(Todos los precios incluyen IVA)</p>
                            <div class="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4">
                                <div id="tasa-input-container" class="flex-grow w-full sm:w-auto">
                                    <label for="catalogoTasaCopInput" class="block text-sm font-medium mb-1">Tasa (USD a COP):</label>
                                    <input type="number" id="catalogoTasaCopInput" placeholder="Ej: 4000" class="w-full px-3 py-1.5 border rounded-lg text-sm">
                                </div>
                            </div>
                            <div id="catalogo-content" class="space-y-6"><p class="text-center text-gray-500 p-4">Cargando...</p></div>
                        </div>
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
            const savedTasa = localStorage.getItem('tasaCOP');
            if (savedTasa) {
                _catalogoTasaCOP = parseFloat(savedTasa);
                tasaInput.value = _catalogoTasaCOP;
            }
            tasaInput.addEventListener('input', (e) => {
                _catalogoTasaCOP = parseFloat(e.target.value) || 0;
                localStorage.setItem('tasaCOP', _catalogoTasaCOP);
                if (_catalogoMonedaActual === 'COP') {
                    renderCatalogo();
                }
            });
        }

        document.getElementById('backToCatalogoMenuBtn').addEventListener('click', showCatalogoSubMenu);
        document.getElementById('generateCatalogoImageBtn').addEventListener('click', handleGenerateCatalogoImage);
        loadAndRenderCatalogo();
    }

    window.toggleCatalogoMoneda = function() {
        if (_catalogoTasaCOP <= 0) {
             window.showModal('Aviso', 'Ingresa una tasa de cambio (USD a COP) válida para ver precios en COP.');
            return;
        }
        _catalogoMonedaActual = _catalogoMonedaActual === 'USD' ? 'COP' : 'USD';
        renderCatalogo();
    };

    async function loadAndRenderCatalogo() {
        const container = document.getElementById('catalogo-content');
        if (!container) return;
        container.innerHTML = `<p class="text-center text-gray-500 p-4">Cargando inventario...</p>`;
        try {
             const inventarioRef = _collection(_db, `artifacts/${_appId}/users/${_userId}/inventario`);
             const snapshot = await _getDocs(inventarioRef);
             _inventarioCache = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
            await renderCatalogo();
        } catch (error) {
            console.error("Error al cargar el inventario para el catálogo:", error);
            container.innerHTML = `<p class="text-center text-red-500 p-4">Error al cargar el inventario.</p>`;
        }
    }

    async function renderCatalogo() {
        const container = document.getElementById('catalogo-content');
        if (!container) { console.error("Catalogo content container not found."); return; }
        container.innerHTML = `<p class="text-center text-gray-500 p-4">Ordenando productos...</p>`;
        try {
            let productos = [..._inventarioCache];
            if (_currentRubros?.length > 0) {
                productos = productos.filter(p => p.rubro && _currentRubros.includes(p.rubro));
            }
            const segmentoOrderMap = await getSegmentoOrderMapCatalogo();
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
                _marcasCache = [];
                _productosAgrupadosCache = {};
                return;
            }

            const productosAgrupados = productos.reduce((acc, p) => {
                const marca = p.marca || 'Sin Marca';
                if (!acc[marca]) acc[marca] = [];
                acc[marca].push(p);
                return acc;
            }, {});
             const marcasOrdenadas = [...new Set(productos.map(p => p.marca || 'Sin Marca'))].sort((a, b) => a.localeCompare(b));

            _marcasCache = marcasOrdenadas;
            _productosAgrupadosCache = productosAgrupados;

            let html = '<div class="space-y-4">';
            const monedaLabel = _catalogoMonedaActual === 'COP' ? 'PRECIO (COP)' : 'PRECIO (USD)';

            marcasOrdenadas.forEach(marca => {
                html += `<table class="min-w-full bg-transparent text-sm md:text-lg print:text-sm">
                            <thead class="text-black">
                                <tr><th colspan="2" class="py-2 px-2 md:px-4 bg-gray-100 font-bold text-left text-base md:text-xl rounded-t-lg">${marca}</th></tr>
                                <tr>
                                    <th class="py-1 md:py-2 px-2 md:px-4 text-left font-semibold text-xs md:text-base border-b border-gray-300">PRESENTACIÓN (Segmento)</th>
                                    <th class="py-1 md:py-2 px-2 md:px-4 text-right font-semibold text-xs md:text-base border-b border-gray-300 price-toggle" onclick="window.toggleCatalogoMoneda()" title="Clic para cambiar moneda">${monedaLabel} <span class="text-gray-500 text-xs">⇆</span></th>
                                </tr>
                            </thead>
                            <tbody>`;
                const productosDeMarca = productosAgrupados[marca];
                productosDeMarca.forEach(p => {
                    const ventaPor = p.ventaPor || { und: true };
                    const precios = p.precios || { und: p.precioPorUnidad || 0 };
                    let precioBaseUSD = 0;
                    let displayPresentacion = `${p.presentacion || 'N/A'}`;
                    let unitInfo = '';
                    if (ventaPor.cj && precios.cj > 0) { precioBaseUSD = precios.cj; unitInfo = `(Cj/${p.unidadesPorCaja || 1} und)`; }
                    else if (ventaPor.paq && precios.paq > 0) { precioBaseUSD = precios.paq; unitInfo = `(Paq/${p.unidadesPorPaquete || 1} und)`; }
                    else { precioBaseUSD = precios.und || 0; unitInfo = `(Und)`; }

                    let precioMostrado;
                    if (_catalogoMonedaActual === 'COP' && _catalogoTasaCOP > 0) {
                         precioMostrado = `COP ${(Math.ceil((precioBaseUSD * _catalogoTasaCOP) / 100) * 100).toLocaleString('es-CO')}`;
                    } else {
                        precioMostrado = `$${precioBaseUSD.toFixed(2)}`;
                    }
                    const segmentoDisplay = p.segmento ? `<span class="text-xs text-gray-500 ml-1">(${p.segmento})</span>` : '';
                    html += `
                        <tr class="border-b border-gray-200 last:border-b-0">
                            <td class="py-1.5 md:py-2 px-2 md:px-4 text-gray-900 align-top">
                                ${displayPresentacion} ${segmentoDisplay}
                                ${unitInfo ? `<span class="block text-xs text-gray-500">${unitInfo}</span>` : ''}
                            </td>
                            <td class="py-1.5 md:py-2 px-2 md:px-4 text-right font-semibold align-top">${precioMostrado}</td>
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

    async function handleGenerateCatalogoImage() {
        const MAX_BRANDS_PER_PAGE = 5;
        const shareButton = document.getElementById('generateCatalogoImageBtn');
        const tasaInputContainer = document.getElementById('tasa-input-container');
        const buttonsContainer = document.getElementById('catalogo-buttons-container');

        if (!_marcasCache || _marcasCache.length === 0) {
             window.showModal('Aviso', 'No hay productos en el catálogo actual para generar imagen.');
             return;
        }

        const pagesOfBrands = [];
        for (let i = 0; i < _marcasCache.length; i += MAX_BRANDS_PER_PAGE) {
            pagesOfBrands.push(_marcasCache.slice(i, i + MAX_BRANDS_PER_PAGE));
        }
        const totalPages = pagesOfBrands.length;

        if (shareButton) {
            shareButton.textContent = `Generando ${totalPages} imagen(es)...`;
            shareButton.disabled = true;
        }
        if (tasaInputContainer) tasaInputContainer.classList.add('hidden');
        if (buttonsContainer) buttonsContainer.classList.add('hidden');
        window.showModal('Progreso', `Generando ${totalPages} página(s) del catálogo como imagen...`);

        try {
            const imageFiles = await Promise.all(pagesOfBrands.map(async (brandsInPage, index) => {
                const pageNum = index + 1;
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

                const titleElement = document.querySelector('#catalogo-para-imagen h2');
                const title = titleElement ? titleElement.textContent.trim() : 'Catálogo';
                const fullPageHtml = `
                    <div class="bg-white p-8" style="width: 800px; box-shadow: none; border: 1px solid #eee;">
                        <h2 class="text-4xl font-bold text-black mb-2 text-center">${title}</h2>
                        <p class="text-center text-gray-800 mb-1 text-base">DISTRIBUIDORA CASTILLO YAÑEZ C.A</p>
                        <p class="text-center text-gray-700 mb-4 text-base italic">(Todos los precios incluyen IVA)</p>
                        ${contentHtml}
                        <p class="text-center text-gray-600 mt-4 text-sm">Página ${pageNum} de ${totalPages}</p>
                    </div>`;

                const tempDiv = document.createElement('div');
                tempDiv.style.position = 'absolute'; tempDiv.style.left = '-9999px'; tempDiv.style.top = '0';
                tempDiv.innerHTML = fullPageHtml;
                document.body.appendChild(tempDiv);
                const pageWrapper = tempDiv.firstElementChild;

                if (_currentBgImage) {
                    pageWrapper.style.backgroundImage = `linear-gradient(rgba(255, 255, 255, 0.85), rgba(255, 255, 255, 0.85)), url('${_currentBgImage}')`;
                    pageWrapper.style.backgroundSize = 'cover';
                    pageWrapper.style.backgroundPosition = 'center';
                }

                const canvasOptions = { scale: 3, useCORS: true, allowTaint: true, backgroundColor: _currentBgImage ? null : '#FFFFFF' };
                const canvas = await html2canvas(pageWrapper, canvasOptions);
                const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png', 0.9));
                document.body.removeChild(tempDiv);
                const safeTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
                return new File([blob], `catalogo_${safeTitle}_p${pageNum}.png`, { type: "image/png" });
            }));

            const modalContainer = document.getElementById('modalContainer');
            if(modalContainer) modalContainer.classList.add('hidden');

            if (navigator.share && imageFiles.length > 0 && navigator.canShare?.({ files: imageFiles })) {
                 try {
                     await navigator.share({
                         files: imageFiles,
                         title: `Catálogo: ${title}`,
                         text: `Catálogo de productos (${title}) - ${totalPages > 1 ? `${totalPages} páginas` : ''}`
                     });
                 } catch (shareError) {
                      console.warn("Sharing failed or was cancelled:", shareError);
                      if (shareError.name !== 'AbortError') {
                          window.showModal('Error al Compartir', 'No se pudieron compartir las imágenes.');
                      }
                 }
            } else if (imageFiles.length > 0) {
                 window.showModal('Imágenes Generadas', 'Imágenes generadas, pero tu navegador no soporta compartir archivos.');
                 try {
                     const firstImage = imageFiles[0];
                     const url = URL.createObjectURL(firstImage);
                     const a = document.createElement('a');
                     a.href = url; a.download = firstImage.name;
                     document.body.appendChild(a); a.click(); document.body.removeChild(a);
                     URL.revokeObjectURL(url);
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
            if (shareButton) { shareButton.textContent = 'Generar Imagen'; shareButton.disabled = false; }
            if (tasaInputContainer) tasaInputContainer.classList.remove('hidden');
            if (buttonsContainer) buttonsContainer.classList.remove('hidden');
             const modalContainer = document.getElementById('modalContainer');
             const modalTitle = modalContainer?.querySelector('h3')?.textContent;
             if(modalContainer && modalTitle?.startsWith('Progreso')) { modalContainer.classList.add('hidden'); }
        }
    }

    window.catalogoModule = {
        invalidateCache: () => { _segmentoOrderCacheCatalogo = null; }
    };

})();
