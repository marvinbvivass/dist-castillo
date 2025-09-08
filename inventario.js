import { collection, onSnapshot, query, addDoc, getDocs, doc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Variable global para el ID de la aplicación, esencial para los datos públicos
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

/**
 * Muestra la tabla del inventario de productos.
 * @param {object} mainContent El contenedor principal donde se mostrará el contenido.
 * @param {object} db La instancia de Firestore.
 * @param {string} userId El ID del usuario actual.
 */
function showVerInventario(mainContent, db, userId) {
    mainContent.innerHTML = `
        <h2 class="text-2xl font-semibold text-gray-700 mb-4">Inventario de Productos</h2>
        <div id="product-list" class="bg-gray-50 p-4 rounded-lg shadow-inner">
            <p class="text-center text-gray-500">Cargando productos...</p>
        </div>
    `;

    // Ruta de la colección de productos para el usuario actual
    const productsCollectionRef = collection(db, `users/${userId}/productos`);
    const q = query(productsCollectionRef);

    // Escuchar cambios en la colección en tiempo real
    onSnapshot(q, (querySnapshot) => {
        let productListHtml = '';
        if (querySnapshot.empty) {
            productListHtml = '<p class="text-center text-gray-500">No hay productos en el inventario.</p>';
        } else {
            productListHtml = `
                <div class="overflow-x-auto rounded-lg shadow-md">
                    <table class="min-w-full bg-white rounded-lg">
                        <thead>
                            <tr class="w-full bg-gray-200 text-gray-600 uppercase text-sm leading-normal">
                                <th class="py-3 px-6 text-left">Rubro</th>
                                <th class="py-3 px-6 text-left">Segmento</th>
                                <th class="py-3 px-6 text-left">Marca</th>
                                <th class="py-3 px-6 text-left">Presentación</th>
                                <th class="py-3 px-6 text-left">Precio</th>
                                <th class="py-3 px-6 text-left">Cantidad</th>
                            </tr>
                        </thead>
                        <tbody class="text-gray-600 text-sm font-light">
            `;
            querySnapshot.forEach((doc) => {
                const product = doc.data();
                productListHtml += `
                    <tr class="border-b border-gray-200 hover:bg-gray-100">
                        <td class="py-3 px-6 text-left whitespace-nowrap">${product.rubro}</td>
                        <td class="py-3 px-6 text-left">${product.segmento}</td>
                        <td class="py-3 px-6 text-left">${product.marca}</td>
                        <td class="py-3 px-6 text-left">${product.presentacion}</td>
                        <td class="py-3 px-6 text-left">$${product.precio.toFixed(2)}</td>
                        <td class="py-3 px-6 text-left">${product.cantidad}</td>
                    </tr>
                `;
            });
            productListHtml += `
                        </tbody>
                    </table>
                </div>
            `;
        }
        document.getElementById('product-list').innerHTML = productListHtml;
    });
}

/**
 * Obtiene los datos de una colección pública de Firestore.
 * @param {object} db La instancia de Firestore.
 * @param {string} collectionName El nombre de la colección a buscar.
 * @returns {Promise<Array<string>>} Una promesa que se resuelve con un array de nombres.
 */
async function getPublicOptions(db, collectionName) {
    const publicDataRef = collection(db, `artifacts/${appId}/public/data/${collectionName}`);
    const querySnapshot = await getDocs(publicDataRef);
    return querySnapshot.docs.map(doc => doc.data().nombre);
}

/**
 * Agrega un nuevo elemento a una colección pública de Firestore.
 * @param {object} db La instancia de Firestore.
 * @param {string} collectionName El nombre de la colección.
 * @param {string} newName El nombre del nuevo elemento a agregar.
 * @returns {Promise<void>}
 */
async function addPublicOption(db, collectionName, newName) {
    const publicDataRef = collection(db, `artifacts/${appId}/public/data/${collectionName}`);
    await addDoc(publicDataRef, { nombre: newName });
}

/**
 * Muestra el formulario para agregar un nuevo producto.
 * @param {object} mainContent El contenedor principal donde se mostrará el contenido.
 * @param {function} showModal Función para mostrar mensajes modales.
 * @param {object} db La instancia de Firestore.
 * @param {string} userId El ID del usuario actual.
 */
function showAgregarProducto(mainContent, showModal, db, userId) {
    mainContent.innerHTML = `
        <h2 class="text-2xl font-semibold text-gray-700 mb-4">Agregar Nuevo Producto</h2>
        <form id="add-product-form" class="bg-gray-50 p-6 rounded-lg shadow-inner w-full max-w-lg mx-auto">
            
            <!-- Rubro -->
            <div class="mb-4">
                <label for="product-rubro" class="block text-gray-700 font-semibold mb-2">Rubro</label>
                <div class="flex items-center space-x-2">
                    <select id="product-rubro" class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:ring-blue-500" required></select>
                    <input type="text" id="new-rubro-input" placeholder="Nuevo Rubro" class="hidden flex-1 px-3 py-2 border border-gray-300 rounded-md">
                    <button type="button" id="add-rubro-btn" class="py-2 px-4 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition duration-200">
                        <span id="add-rubro-text">Agregar</span>
                    </button>
                </div>
            </div>

            <!-- Segmento -->
            <div class="mb-4">
                <label for="product-segmento" class="block text-gray-700 font-semibold mb-2">Segmento</label>
                <div class="flex items-center space-x-2">
                    <select id="product-segmento" class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:ring-blue-500" required></select>
                    <input type="text" id="new-segmento-input" placeholder="Nuevo Segmento" class="hidden flex-1 px-3 py-2 border border-gray-300 rounded-md">
                    <button type="button" id="add-segmento-btn" class="py-2 px-4 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition duration-200">
                        <span id="add-segmento-text">Agregar</span>
                    </button>
                </div>
            </div>

            <!-- Marca -->
            <div class="mb-4">
                <label for="product-marca" class="block text-gray-700 font-semibold mb-2">Marca</label>
                <div class="flex items-center space-x-2">
                    <select id="product-marca" class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:ring-blue-500" required></select>
                    <input type="text" id="new-marca-input" placeholder="Nueva Marca" class="hidden flex-1 px-3 py-2 border border-gray-300 rounded-md">
                    <button type="button" id="add-marca-btn" class="py-2 px-4 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition duration-200">
                        <span id="add-marca-text">Agregar</span>
                    </button>
                </div>
            </div>

            <!-- Presentación -->
            <div class="mb-4">
                <label for="product-presentacion" class="block text-gray-700 font-semibold mb-2">Presentación</label>
                <input type="text" id="product-presentacion" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:ring-blue-500" required>
            </div>
            
            <!-- Precio -->
            <div class="mb-4">
                <label for="product-precio" class="block text-gray-700 font-semibold mb-2">Precio</label>
                <input type="number" step="0.01" id="product-precio" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:ring-blue-500" required>
            </div>
            
            <!-- Cantidad -->
            <div class="mb-4">
                <label for="product-cantidad" class="block text-gray-700 font-semibold mb-2">Cantidad</label>
                <input type="number" id="product-cantidad" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:ring-blue-500" required>
            </div>
            
            <div class="flex justify-end space-x-4">
                <button type="button" id="back-button" class="py-2 px-4 bg-gray-300 text-gray-800 font-semibold rounded-md hover:bg-gray-400 transition duration-200">Cancelar</button>
                <button type="submit" class="py-2 px-4 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition duration-200">Agregar Producto</button>
            </div>
        </form>
    `;

    const addProductForm = document.getElementById('add-product-form');
    const backButton = document.getElementById('back-button');

    const rubroSelect = document.getElementById('product-rubro');
    const newRubroInput = document.getElementById('new-rubro-input');
    const addRubroBtn = document.getElementById('add-rubro-btn');
    const addRubroText = document.getElementById('add-rubro-text');

    const segmentoSelect = document.getElementById('product-segmento');
    const newSegmentoInput = document.getElementById('new-segmento-input');
    const addSegmentoBtn = document.getElementById('add-segmento-btn');
    const addSegmentoText = document.getElementById('add-segmento-text');

    const marcaSelect = document.getElementById('product-marca');
    const newMarcaInput = document.getElementById('new-marca-input');
    const addMarcaBtn = document.getElementById('add-marca-btn');
    const addMarcaText = document.getElementById('add-marca-text');

    async function populateDropdowns() {
        const rubros = await getPublicOptions(db, 'rubros');
        const segmentos = await getPublicOptions(db, 'segmentos');
        const marcas = await getPublicOptions(db, 'marcas');
        
        rubroSelect.innerHTML = rubros.map(r => `<option>${r}</option>`).join('');
        segmentoSelect.innerHTML = segmentos.map(s => `<option>${s}</option>`).join('');
        marcaSelect.innerHTML = marcas.map(m => `<option>${m}</option>`).join('');
    }

    populateDropdowns();
    
    // Lógica para alternar entre select e input de texto
    function toggleInputAndButton(select, input, textElement) {
        if (input.classList.contains('hidden')) {
            select.classList.add('hidden');
            input.classList.remove('hidden');
            input.focus();
            textElement.textContent = 'Guardar';
        } else {
            input.classList.add('hidden');
            select.classList.remove('hidden');
            textElement.textContent = 'Agregar';
        }
    }

    addRubroBtn.addEventListener('click', async () => {
        console.log("Click en el botón de Rubro");
        if (addRubroText.textContent === 'Guardar') {
            const newRubroName = newRubroInput.value.trim();
            if (newRubroName) {
                await addPublicOption(db, 'rubros', newRubroName);
                newRubroInput.value = '';
                toggleInputAndButton(rubroSelect, newRubroInput, addRubroText);
                populateDropdowns();
            } else {
                showModal('Error', 'Por favor, ingrese un nombre para el nuevo Rubro.');
            }
        } else {
            toggleInputAndButton(rubroSelect, newRubroInput, addRubroText);
        }
    });

    addSegmentoBtn.addEventListener('click', async () => {
        console.log("Click en el botón de Segmento");
        if (addSegmentoText.textContent === 'Guardar') {
            const newSegmentoName = newSegmentoInput.value.trim();
            if (newSegmentoName) {
                await addPublicOption(db, 'segmentos', newSegmentoName);
                newSegmentoInput.value = '';
                toggleInputAndButton(segmentoSelect, newSegmentoInput, addSegmentoText);
                populateDropdowns();
            } else {
                showModal('Error', 'Por favor, ingrese un nombre para el nuevo Segmento.');
            }
        } else {
            toggleInputAndButton(segmentoSelect, newSegmentoInput, addSegmentoText);
        }
    });

    addMarcaBtn.addEventListener('click', async () => {
        console.log("Click en el botón de Marca");
        if (addMarcaText.textContent === 'Guardar') {
            const newMarcaName = newMarcaInput.value.trim();
            if (newMarcaName) {
                await addPublicOption(db, 'marcas', newMarcaName);
                newMarcaInput.value = '';
                toggleInputAndButton(marcaSelect, newMarcaInput, addMarcaText);
                populateDropdowns();
            } else {
                showModal('Error', 'Por favor, ingrese un nombre para la nueva Marca.');
            }
        } else {
            toggleInputAndButton(marcaSelect, newMarcaInput, addMarcaText);
        }
    });

    addProductForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const rubro = rubroSelect.value;
        const segmento = segmentoSelect.value;
        const marca = marcaSelect.value;
        const presentacion = document.getElementById('product-presentacion').value;
        const precio = parseFloat(document.getElementById('product-precio').value);
        const cantidad = parseInt(document.getElementById('product-cantidad').value, 10);

        if (!rubro || !segmento || !marca || !presentacion || isNaN(precio) || isNaN(cantidad)) {
            showModal('Error', 'Por favor, complete todos los campos.');
            return;
        }

        try {
            const productsCollectionRef = collection(db, `users/${userId}/productos`);
            await addDoc(productsCollectionRef, {
                rubro,
                segmento,
                marca,
                presentacion,
                precio,
                cantidad,
            });
            showModal('Éxito', 'Producto agregado correctamente.');
            addProductForm.reset();
        } catch (error) {
            console.error("Error al agregar producto:", error);
            showModal('Error', 'No se pudo agregar el producto.');
        }
    });

    backButton.addEventListener('click', () => {
        showInventarioSubMenu(mainContent, showModal, db, userId);
    });
}

/**
 * Muestra el sub-menú principal de inventario.
 * @param {object} mainContent El contenedor principal donde se mostrará el contenido.
 * @param {function} showModal Función para mostrar mensajes modales.
 * @param {object} db La instancia de Firestore.
 * @param {string} userId El ID del usuario actual.
 */
export function showInventarioSubMenu(mainContent, showModal, db, userId) {
    mainContent.innerHTML = `
        <div class="flex flex-col items-center gap-4">
            <h2 class="text-2xl font-semibold text-gray-700 mb-2">Menú de Inventario</h2>
            <button id="view-inventory-button" class="w-full py-3 px-4 bg-gray-200 text-gray-800 font-semibold rounded-lg shadow-md hover:bg-gray-300 transition duration-200">
                Ver Inventario
            </button>
            <button id="add-product-button" class="w-full py-3 px-4 bg-gray-200 text-gray-800 font-semibold rounded-lg shadow-md hover:bg-gray-300 transition duration-200">
                Agregar Nuevo Producto
            </button>
            <button id="modify-delete-button" class="w-full py-3 px-4 bg-gray-200 text-gray-800 font-semibold rounded-lg shadow-md hover:bg-gray-300 transition duration-200">
                Modificar o Eliminar Producto
            </button>
        </div>
    `;

    document.getElementById('view-inventory-button').addEventListener('click', () => {
        showVerInventario(mainContent, db, userId);
    });

    document.getElementById('add-product-button').addEventListener('click', () => {
        showAgregarProducto(mainContent, showModal, db, userId);
    });

    document.getElementById('modify-delete-button').addEventListener('click', () => {
        showModal('Función en desarrollo', 'La lista para modificar y eliminar productos se mostrará aquí.');
    });
}
