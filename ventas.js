import { collection, addDoc, updateDoc, doc, onSnapshot, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Variables globales para la lógica de la aplicación
let userId = null;
let appId = null;
let db = null;
let productsMap = {}; // Caché de productos
let clients = [];
let currentSaleItems = [];

// Función de inicialización del módulo de ventas, llamada desde index.html
export function initVentasApp(_userId, _appId, _db) {
    userId = _userId;
    appId = _appId;
    db = _db;

    // Cargar todos los datos al iniciar
    loadAllData();

    // Exportar funciones de UI para que el HTML pueda acceder a ellas
    window.updateQuantity = updateQuantity;
    window.addProductToSale = addProductToSale;
    window.saveSale = saveSale;
    window.showConfirmationModal = showConfirmationModal;
}

// Módulo de Navegación
function hideAllViews() {
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
}

export function showView(viewId) {
    hideAllViews();
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById(viewId).classList.remove('hidden');
}

export function showMainMenu() {
    hideAllViews();
    document.getElementById('main-menu').classList.remove('hidden');
}

// Módulo de Inventario y Clientes
async function loadAllData() {
    // Escuchar cambios en el inventario en tiempo real
    onSnapshot(collection(db, `artifacts/${appId}/users/${userId}/inventory`), (snapshot) => {
        const products = [];
        productsMap = {};
        snapshot.forEach(doc => {
            const productData = { id: doc.id, ...doc.data() };
            products.push(productData);
            productsMap[doc.id] = productData;
        });
        renderProducts(products);
        renderProductSelect(products);
    }, (error) => {
        console.error("Error al escuchar el inventario:", error);
    });

    // Escuchar cambios en los clientes en tiempo real
    onSnapshot(collection(db, `artifacts/${appId}/users/${userId}/clients`), (snapshot) => {
        clients = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderClientSelect(clients);
    }, (error) => {
        console.error("Error al cargar los clientes:", error);
    });
}

function renderProducts(products) {
    const listContainer = document.getElementById('inventory-list');
    const quantityContainer = document.getElementById('quantity-list');
    listContainer.innerHTML = '';
    quantityContainer.innerHTML = '';

    products.forEach(product => {
        const listItem = document.createElement('div');
        listItem.className = 'p-4 bg-gray-50 rounded-lg shadow-sm flex items-center space-x-4';
        listItem.innerHTML = `
            <p class="font-bold">${product.producto} (${product.presentacion})</p>
            <p class="text-sm text-gray-600">Cantidad: ${product.cantidad}</p>
        `;
        listContainer.appendChild(listItem);

        const quantityItem = document.createElement('div');
        quantityItem.className = 'p-4 bg-gray-50 rounded-lg shadow-sm flex items-center justify-between space-x-4';
        quantityItem.innerHTML = `
            <p class="font-bold">${product.producto} (${product.presentacion})</p>
            <div class="flex items-center space-x-2">
                <input type="number" id="quantity-${product.id}" value="${product.cantidad}" class="w-20 p-2 border rounded-lg">
                <button onclick="updateQuantity('${product.id}')" class="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700">Actualizar</button>
            </div>
        `;
        quantityContainer.appendChild(quantityItem);
    });
}

function renderProductSelect(products) {
    const productSelect = document.getElementById('sale-product-select');
    productSelect.innerHTML = '<option value="">Selecciona un Producto</option>';
    products.forEach(product => {
        const option = document.createElement('option');
        option.value = product.id;
        option.textContent = `${product.producto} (${product.presentacion}) - ${product.cantidad} en stock`;
        productSelect.appendChild(option);
    });
}

function renderClientSelect(clients) {
    const clientSelect = document.getElementById('client-select');
    clientSelect.innerHTML = '<option value="">Selecciona un Cliente</option>';
    clients.forEach(client => {
        const option = document.createElement('option');
        option.value = client.id;
        option.textContent = client.name;
        clientSelect.appendChild(option);
    });
}

async function updateQuantity(productId) {
    const newQuantity = parseInt(document.getElementById(`quantity-${productId}`).value, 10);
    if (isNaN(newQuantity) || newQuantity < 0) {
        showMessage("La cantidad debe ser un número válido.", 'error');
        return;
    }
    showConfirmationModal("¿Estás seguro de que quieres actualizar la cantidad?", async () => {
        const productRef = doc(db, `artifacts/${appId}/users/${userId}/inventory`, productId);
        try {
            await updateDoc(productRef, { cantidad: newQuantity });
            showMessage("Cantidad actualizada exitosamente.", 'success');
        } catch (e) {
            console.error("Error al actualizar la cantidad:", e);
            showMessage("Error al actualizar la cantidad.", 'error');
        }
    });
}

// Módulo de Ventas
function addProductToSale() {
    const selectedProduct = document.getElementById('sale-product-select').value;
    const quantity = parseInt(document.getElementById('sale-quantity').value, 10);

    if (!selectedProduct || isNaN(quantity) || quantity <= 0) {
        showMessage("Selecciona un producto y una cantidad válida.", 'error');
        return;
    }

    const product = productsMap[selectedProduct];
    if (!product) {
        showMessage("Producto no encontrado.", 'error');
        return;
    }

    const existingItem = currentSaleItems.find(item => item.id === product.id);
    if (existingItem) {
        existingItem.quantity += quantity;
    } else {
        currentSaleItems.push({
            id: product.id,
            name: product.producto,
            presentacion: product.presentacion,
            price: product.precio,
            quantity: quantity
        });
    }
    renderCurrentSaleItems();
}

function renderCurrentSaleItems() {
    const saleItemsList = document.getElementById('sale-items-list');
    saleItemsList.innerHTML = '';
    let total = 0;
    if (currentSaleItems.length === 0) {
        saleItemsList.innerHTML = '<p class="text-center text-gray-500">No hay productos en esta venta.</p>';
    } else {
        currentSaleItems.forEach(item => {
            const itemTotal = item.price * item.quantity;
            total += itemTotal;
            saleItemsList.innerHTML += `
                <div class="flex justify-between items-center p-2 bg-gray-50 rounded-lg">
                    <span>${item.name} (${item.presentacion}) x ${item.quantity}</span>
                    <span class="font-bold">$${itemTotal.toFixed(2)}</span>
                </div>
            `;
        });
    }
    document.getElementById('sale-total').textContent = `Total: $${total.toFixed(2)}`;
}

async function saveSale() {
    const clientId = document.getElementById('client-select').value;
    if (!clientId || currentSaleItems.length === 0) {
        showMessage("Selecciona un cliente y agrega productos.", 'error');
        return;
    }
    showConfirmationModal("¿Estás seguro de que quieres guardar esta venta?", async () => {
        if (!userId) return;
        const salesCollection = collection(db, `artifacts/${appId}/users/${userId}/sales`);
        const saleData = {
            clientId,
            date: new Date(),
            items: currentSaleItems
        };
        try {
            await addDoc(salesCollection, saleData);
            for (const item of currentSaleItems) {
                const productRef = doc(db, `artifacts/${appId}/users/${userId}/inventory`, item.id);
                const productSnap = await getDoc(productRef);
                if (productSnap.exists()) {
                    const currentQuantity = productSnap.data().cantidad;
                    const newQuantity = currentQuantity - item.quantity;
                    await updateDoc(productRef, { cantidad: newQuantity });
                }
            }
            showMessage("Venta guardada exitosamente.", 'success');
            currentSaleItems = [];
            renderCurrentSaleItems();
            document.getElementById('client-select').value = '';
        } catch (e) {
            console.error("Error al guardar la venta:", e);
            showMessage("Error al guardar la venta.", 'error');
        }
    });
}

// Módulo de UI/Utilidades
export function showMessage(message, type = 'info') {
    const messageBox = document.getElementById('message-box');
    const messageText = document.getElementById('message-text');
    messageText.textContent = message;
    messageBox.className = 'fixed top-5 right-5 p-4 rounded-lg shadow-lg transition-transform transform translate-x-full z-50';
    if (type === 'success') {
        messageBox.classList.add('bg-green-500', 'text-white');
    } else if (type === 'error') {
        messageBox.classList.add('bg-red-500', 'text-white');
    } else {
        messageBox.classList.add('bg-blue-500', 'text-white');
    }
    setTimeout(() => { messageBox.classList.remove('translate-x-full'); }, 10);
    setTimeout(() => { messageBox.classList.add('translate-x-full'); }, 5000);
}

export function showConfirmationModal(message, callback) {
    const modal = document.getElementById('confirmation-modal');
    const modalMessage = document.getElementById('modal-message');
    const confirmBtn = document.getElementById('confirm-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    modalMessage.textContent = message;
    modal.classList.remove('hidden');
    const onConfirm = () => { callback(); modal.classList.add('hidden'); };
    const onCancel = () => { modal.classList.add('hidden'); };
    confirmBtn.onclick = onConfirm;
    cancelBtn.onclick = onCancel;
}
