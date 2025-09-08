import { collection, onSnapshot, query, addDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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
                                <th class="py-3 px-6 text-left">Nombre</th>
                                <th class="py-3 px-6 text-left">Precio</th>
                                <th class="py-3 px-6 text-left">Stock</th>
                            </tr>
                        </thead>
                        <tbody class="text-gray-600 text-sm font-light">
            `;
            querySnapshot.forEach((doc) => {
                const product = doc.data();
                productListHtml += `
                    <tr class="border-b border-gray-200 hover:bg-gray-100">
                        <td class="py-3 px-6 text-left whitespace-nowrap">${product.nombre}</td>
                        <td class="py-3 px-6 text-left">${product.precio.toFixed(2)}</td>
                        <td class="py-3 px-6 text-left">${product.stock}</td>
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
 * Muestra el formulario para agregar un nuevo producto.
 * @param {object} mainContent El contenedor principal donde se mostrará el contenido.
 * @param {function} showModal Función para mostrar mensajes modales.
 * @param {object} db La instancia de Firestore.
 * @param {string} userId El ID del usuario actual.
 */
function showAgregarProducto(mainContent, showModal, db, userId) {
    mainContent.innerHTML = `
        <h2 class="text-2xl font-semibold text-gray-700 mb-4">Agregar Nuevo Producto</h2>
        <form id="add-product-form" class="bg-gray-50 p-6 rounded-lg shadow-inner w-full max-w-md mx-auto">
            <div class="mb-4">
                <label for="product-name" class="block text-gray-700 font-semibold mb-2">Nombre del Producto</label>
                <input type="text" id="product-name" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:ring-blue-500" required>
            </div>
            <div class="mb-4">
                <label for="product-price" class="block text-gray-700 font-semibold mb-2">Precio</label>
                <input type="number" step="0.01" id="product-price" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:ring-blue-500" required>
            </div>
            <div class="mb-4">
                <label for="product-stock" class="block text-gray-700 font-semibold mb-2">Stock</label>
                <input type="number" id="product-stock" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:ring-blue-500" required>
            </div>
            <div class="flex justify-end space-x-4">
                <button type="button" id="back-button" class="py-2 px-4 bg-gray-300 text-gray-800 font-semibold rounded-md hover:bg-gray-400 transition duration-200">Cancelar</button>
                <button type="submit" class="py-2 px-4 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition duration-200">Agregar Producto</button>
            </div>
        </form>
    `;

    document.getElementById('add-product-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const productName = document.getElementById('product-name').value;
        const productPrice = parseFloat(document.getElementById('product-price').value);
        const productStock = parseInt(document.getElementById('product-stock').value, 10);

        try {
            const productsCollectionRef = collection(db, `users/${userId}/productos`);
            await addDoc(productsCollectionRef, {
                nombre: productName,
                precio: productPrice,
                stock: productStock
            });
            showModal('Éxito', 'Producto agregado correctamente.');
            // Volver al menú de inventario
            showInventarioSubMenu(mainContent, showModal, db, userId);
        } catch (error) {
            console.error("Error al agregar producto:", error);
            showModal('Error', 'No se pudo agregar el producto.');
        }
    });

    document.getElementById('back-button').addEventListener('click', () => {
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
