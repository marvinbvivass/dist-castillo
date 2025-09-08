import { collection, onSnapshot, query, addDoc, doc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Referencias a la base de datos y al usuario, pasadas desde index.html
let db;
let userId;
let firebaseAppId;

/**
 * @param {object} firestoreDB
 * @param {string} currentUserId
 * @param {string} appId
 */
export function setupInventario(firestoreDB, currentUserId, appId) {
  db = firestoreDB;
  userId = currentUserId;
  firebaseAppId = appId;
}

const mainContent = document.getElementById('mainContent');

/**
 * Renderiza el menú principal de inventario.
 */
export function showInventarioSubMenu() {
  mainContent.innerHTML = `
    <div class="p-6 bg-gray-100 min-h-screen">
      <div class="container mx-auto">
        <div class="bg-white p-8 rounded-lg shadow-xl text-center">
          <h1 class="text-3xl font-bold text-gray-800 mb-6">Gestión de Inventario</h1>
          <div class="space-y-4">
            <button id="verInventarioBtn" class="w-full px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg shadow-md hover:bg-blue-600 transition duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50">
              Ver Inventario
            </button>
            <button id="agregarProductoBtn" class="w-full px-6 py-3 bg-green-500 text-white font-semibold rounded-lg shadow-md hover:bg-green-600 transition duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50">
              Agregar Nuevo Producto
            </button>
            <button id="modificarEliminarBtn" class="w-full px-6 py-3 bg-yellow-500 text-white font-semibold rounded-lg shadow-md hover:bg-yellow-600 transition duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-opacity-50">
              Modificar o Eliminar Producto
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.getElementById('verInventarioBtn').addEventListener('click', showVerInventario);
  document.getElementById('agregarProductoBtn').addEventListener('click', showAgregarProducto);
  document.getElementById('modificarEliminarBtn').addEventListener('click', showModifyDeleteView);
}

/**
 * Renderiza la vista para ver el inventario.
 */
export function showVerInventario() {
  mainContent.innerHTML = `
    <div class="p-6 bg-gray-100 min-h-screen">
      <div class="container mx-auto">
        <div class="bg-white p-8 rounded-lg shadow-xl">
          <h2 class="text-2xl font-bold text-gray-800 mb-6">Inventario de Productos</h2>
          <div id="loadingIndicator" class="text-center text-gray-500">Cargando productos...</div>
          <div id="productosTableContainer" class="overflow-x-auto">
            <table class="min-w-full bg-white rounded-lg shadow-md">
              <thead class="bg-gray-200">
                <tr>
                  <th class="py-2 px-4 text-left text-sm font-semibold text-gray-600">Rubro</th>
                  <th class="py-2 px-4 text-left text-sm font-semibold text-gray-600">Segmento</th>
                  <th class="py-2 px-4 text-left text-sm font-semibold text-gray-600">Marca</th>
                  <th class="py-2 px-4 text-left text-sm font-semibold text-gray-600">Presentación</th>
                  <th class="py-2 px-4 text-left text-sm font-semibold text-gray-600">Precio</th>
                  <th class="py-2 px-4 text-left text-sm font-semibold text-gray-600">Cantidad</th>
                </tr>
              </thead>
              <tbody id="productosTableBody">
                <!-- Data will be populated here -->
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `;

  // Listener en tiempo real para la colección de productos del usuario
  onSnapshot(collection(db, `users/${userId}/inventario`), (snapshot) => {
    const productos = [];
    snapshot.forEach((doc) => {
      productos.push(doc.data());
    });
    renderProductosTable(productos);
  });
}

/**
 * Renderiza la tabla de productos.
 * @param {Array<object>} productos
 */
function renderProductosTable(productos) {
  const tableBody = document.getElementById('productosTableBody');
  if (!tableBody) return; // Salir si no se encuentra el elemento

  tableBody.innerHTML = '';
  if (productos.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-gray-500">No hay productos en el inventario.</td></tr>`;
  } else {
    productos.forEach(producto => {
      const row = document.createElement('tr');
      row.className = 'border-b hover:bg-gray-50 transition duration-150';
      row.innerHTML = `
        <td class="py-3 px-4 text-gray-700">${producto.rubro}</td>
        <td class="py-3 px-4 text-gray-700">${producto.segmento}</td>
        <td class="py-3 px-4 text-gray-700">${producto.marca}</td>
        <td class="py-3 px-4 text-gray-700">${producto.presentacion}</td>
        <td class="py-3 px-4 text-gray-700">$${producto.precio.toFixed(2)}</td>
        <td class="py-3 px-4 text-gray-700">${producto.cantidad}</td>
      `;
      tableBody.appendChild(row);
    });
  }
}

/**
 * Renderiza la vista para agregar un nuevo producto.
 */
export async function showAgregarProducto() {
  mainContent.innerHTML = `
    <div class="p-6 bg-gray-100 min-h-screen">
      <div class="container mx-auto">
        <div class="bg-white p-8 rounded-lg shadow-xl">
          <h2 class="text-2xl font-bold text-gray-800 mb-6">Agregar Nuevo Producto</h2>
          <form id="productoForm" class="space-y-4">
            <div>
              <label class="block text-gray-700 font-medium">Rubro:</label>
              <div class="flex items-center space-x-2">
                <select id="rubroSelect" class="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"></select>
                <input type="text" id="rubroInput" class="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 hidden" placeholder="Nuevo Rubro">
                <button type="button" id="toggleRubroBtn" class="p-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition duration-300">Agregar</button>
              </div>
            </div>

            <div>
              <label class="block text-gray-700 font-medium">Segmento:</label>
              <div class="flex items-center space-x-2">
                <select id="segmentoSelect" class="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"></select>
                <input type="text" id="segmentoInput" class="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 hidden" placeholder="Nuevo Segmento">
                <button type="button" id="toggleSegmentoBtn" class="p-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition duration-300">Agregar</button>
              </div>
            </div>

            <div>
              <label class="block text-gray-700 font-medium">Marca:</label>
              <div class="flex items-center space-x-2">
                <select id="marcaSelect" class="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"></select>
                <input type="text" id="marcaInput" class="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 hidden" placeholder="Nueva Marca">
                <button type="button" id="toggleMarcaBtn" class="p-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition duration-300">Agregar</button>
              </div>
            </div>

            <div>
              <label for="presentacion" class="block text-gray-700 font-medium">Presentación:</label>
              <input type="text" id="presentacion" name="presentacion" required class="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            </div>
            <div>
              <label for="precio" class="block text-gray-700 font-medium">Precio:</label>
              <input type="number" id="precio" name="precio" required class="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            </div>
            <div>
              <label for="cantidad" class="block text-gray-700 font-medium">Cantidad:</label>
              <input type="number" id="cantidad" name="cantidad" required class="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            </div>
            <button type="submit" class="w-full py-3 bg-green-500 text-white font-semibold rounded-lg shadow-md hover:bg-green-600 transition duration-300 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50">Guardar Producto</button>
          </form>
        </div>
      </div>
    </div>
  `;

  // Se configura el formulario y los listeners una vez que el HTML está en el DOM
  setupFormListeners();
  await populateSelects();
}

/**
 * Configura los listeners del formulario para agregar un producto.
 */
function setupFormListeners() {
  const productoForm = document.getElementById('productoForm');
  if (productoForm) {
    productoForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await addProducto();
      showVerInventario(); // Redirige a la vista de inventario después de guardar
    });
  }

  const toggleRubroBtn = document.getElementById('toggleRubroBtn');
  const rubroSelect = document.getElementById('rubroSelect');
  const rubroInput = document.getElementById('rubroInput');

  if (toggleRubroBtn && rubroSelect && rubroInput) {
    toggleRubroBtn.addEventListener('click', () => {
      const isInputVisible = rubroInput.classList.toggle('hidden');
      rubroSelect.classList.toggle('hidden', !isInputVisible);
      rubroInput.focus();
    });
  }

  const toggleSegmentoBtn = document.getElementById('toggleSegmentoBtn');
  const segmentoSelect = document.getElementById('segmentoSelect');
  const segmentoInput = document.getElementById('segmentoInput');
  if (toggleSegmentoBtn && segmentoSelect && segmentoInput) {
    toggleSegmentoBtn.addEventListener('click', () => {
      const isInputVisible = segmentoInput.classList.toggle('hidden');
      segmentoSelect.classList.toggle('hidden', !isInputVisible);
      segmentoInput.focus();
    });
  }

  const toggleMarcaBtn = document.getElementById('toggleMarcaBtn');
  const marcaSelect = document.getElementById('marcaSelect');
  const marcaInput = document.getElementById('marcaInput');
  if (toggleMarcaBtn && marcaSelect && marcaInput) {
    toggleMarcaBtn.addEventListener('click', () => {
      const isInputVisible = marcaInput.classList.toggle('hidden');
      marcaSelect.classList.toggle('hidden', !isInputVisible);
      marcaInput.focus();
    });
  }
}

/**
 * Agrega un nuevo producto a la base de datos de Firebase.
 */
async function addProducto() {
  const rubro = document.getElementById('rubroSelect').value || document.getElementById('rubroInput').value;
  const segmento = document.getElementById('segmentoSelect').value || document.getElementById('segmentoInput').value;
  const marca = document.getElementById('marcaSelect').value || document.getElementById('marcaInput').value;
  const presentacion = document.getElementById('presentacion').value;
  const precio = parseFloat(document.getElementById('precio').value);
  const cantidad = parseInt(document.getElementById('cantidad').value, 10);

  // Validación básica
  if (!rubro || !segmento || !marca || !presentacion || isNaN(precio) || isNaN(cantidad)) {
    console.error("Todos los campos deben estar llenos y ser válidos.");
    return;
  }

  try {
    const inventarioRef = collection(db, `users/${userId}/inventario`);
    await addDoc(inventarioRef, {
      rubro,
      segmento,
      marca,
      presentacion,
      precio,
      cantidad,
    });
    console.log("Producto agregado exitosamente.");
  } catch (e) {
    console.error("Error al agregar el producto: ", e);
  }
}

/**
 * Llena los menús desplegables con datos de Firestore.
 */
async function populateSelects() {
  const rubroSelect = document.getElementById('rubroSelect');
  const segmentoSelect = document.getElementById('segmentoSelect');
  const marcaSelect = document.getElementById('marcaSelect');

  // Limpia las opciones existentes
  rubroSelect.innerHTML = '';
  segmentoSelect.innerHTML = '';
  marcaSelect.innerHTML = '';

  const addOption = (selectElement, value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    selectElement.appendChild(option);
  };

  try {
    // Escucha en tiempo real para la colección de Rubros
    onSnapshot(collection(db, `artifacts/${firebaseAppId}/public/data/rubros`), (snapshot) => {
      rubroSelect.innerHTML = '';
      snapshot.forEach(doc => addOption(rubroSelect, doc.data().nombre));
    });

    // Escucha en tiempo real para la colección de Segmentos
    onSnapshot(collection(db, `artifacts/${firebaseAppId}/public/data/segmentos`), (snapshot) => {
      segmentoSelect.innerHTML = '';
      snapshot.forEach(doc => addOption(segmentoSelect, doc.data().nombre));
    });

    // Escucha en tiempo real para la colección de Marcas
    onSnapshot(collection(db, `artifacts/${firebaseAppId}/public/data/marcas`), (snapshot) => {
      marcaSelect.innerHTML = '';
      snapshot.forEach(doc => addOption(marcaSelect, doc.data().nombre));
    });

  } catch (e) {
    console.error("Error al poblar los selectores: ", e);
  }

  // Manejar el agregar nuevo elemento a la base de datos
  const toggleRubroBtn = document.getElementById('toggleRubroBtn');
  const rubroInput = document.getElementById('rubroInput');

  if (toggleRubroBtn && rubroInput) {
    toggleRubroBtn.onclick = async () => {
      const isInputVisible = rubroInput.classList.contains('hidden');
      if (!isInputVisible && rubroInput.value) {
        try {
          const nombre = rubroInput.value;
          await addDoc(collection(db, `artifacts/${firebaseAppId}/public/data/rubros`), { nombre });
          rubroInput.value = '';
          rubroInput.classList.add('hidden');
          rubroSelect.classList.remove('hidden');
        } catch (e) {
          console.error("Error al agregar nuevo rubro:", e);
        }
      } else {
        rubroSelect.classList.add('hidden');
        rubroInput.classList.remove('hidden');
        rubroInput.focus();
      }
    };
  }

  const toggleSegmentoBtn = document.getElementById('toggleSegmentoBtn');
  const segmentoInput = document.getElementById('segmentoInput');
  if (toggleSegmentoBtn && segmentoInput) {
    toggleSegmentoBtn.onclick = async () => {
      const isInputVisible = segmentoInput.classList.contains('hidden');
      if (!isInputVisible && segmentoInput.value) {
        try {
          const nombre = segmentoInput.value;
          await addDoc(collection(db, `artifacts/${firebaseAppId}/public/data/segmentos`), { nombre });
          segmentoInput.value = '';
          segmentoInput.classList.add('hidden');
          segmentoSelect.classList.remove('hidden');
        } catch (e) {
          console.error("Error al agregar nuevo segmento:", e);
        }
      } else {
        segmentoSelect.classList.add('hidden');
        segmentoInput.classList.remove('hidden');
        segmentoInput.focus();
      }
    };
  }

  const toggleMarcaBtn = document.getElementById('toggleMarcaBtn');
  const marcaInput = document.getElementById('marcaInput');
  if (toggleMarcaBtn && marcaInput) {
    toggleMarcaBtn.onclick = async () => {
      const isInputVisible = marcaInput.classList.contains('hidden');
      if (!isInputVisible && marcaInput.value) {
        try {
          const nombre = marcaInput.value;
          await addDoc(collection(db, `artifacts/${firebaseAppId}/public/data/marcas`), { nombre });
          marcaInput.value = '';
          marcaInput.classList.add('hidden');
          marcaSelect.classList.remove('hidden');
        } catch (e) {
          console.error("Error al agregar nueva marca:", e);
        }
      } else {
        marcaSelect.classList.add('hidden');
        marcaInput.classList.remove('hidden');
        marcaInput.focus();
      }
    };
  }
}

/**
 * Muestra la vista de modificar o eliminar productos.
 */
export function showModifyDeleteView() {
  mainContent.innerHTML = `
    <div class="p-6 bg-gray-100 min-h-screen">
      <div class="container mx-auto">
        <div class="bg-white p-8 rounded-lg shadow-xl">
          <h2 class="text-2xl font-bold text-gray-800 mb-6">Modificar o Eliminar Producto</h2>
          <div id="loadingIndicator" class="text-center text-gray-500">Cargando productos...</div>
          <div id="productosModifyContainer" class="overflow-x-auto">
            <table class="min-w-full bg-white rounded-lg shadow-md">
              <thead class="bg-gray-200">
                <tr>
                  <th class="py-2 px-4 text-left text-sm font-semibold text-gray-600">Presentación</th>
                  <th class="py-2 px-4 text-left text-sm font-semibold text-gray-600">Precio</th>
                  <th class="py-2 px-4 text-left text-sm font-semibold text-gray-600">Cantidad</th>
                  <th class="py-2 px-4 text-center text-sm font-semibold text-gray-600">Acciones</th>
                </tr>
              </thead>
              <tbody id="productosModifyBody">
                <!-- Data will be populated here -->
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `;

  // Listener en tiempo real para la colección de productos
  onSnapshot(collection(db, `users/${userId}/inventario`), (snapshot) => {
    const productos = [];
    snapshot.forEach((doc) => {
      productos.push({ id: doc.id, ...doc.data() });
    });
    renderModifyDeleteTable(productos);
  });
}

/**
 * Renderiza la tabla para modificar y eliminar productos.
 * @param {Array<object>} productos
 */
function renderModifyDeleteTable(productos) {
  const tableBody = document.getElementById('productosModifyBody');
  if (!tableBody) return;

  tableBody.innerHTML = '';
  if (productos.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-gray-500">No hay productos para modificar.</td></tr>`;
  } else {
    productos.forEach(producto => {
      const row = document.createElement('tr');
      row.className = 'border-b hover:bg-gray-50 transition duration-150';
      row.innerHTML = `
        <td class="py-3 px-4 text-gray-700">${producto.presentacion}</td>
        <td class="py-3 px-4 text-gray-700">$${producto.precio.toFixed(2)}</td>
        <td class="py-3 px-4 text-gray-700">${producto.cantidad}</td>
        <td class="py-3 px-4 text-center space-x-2">
          <button class="bg-yellow-500 text-white p-2 rounded-lg hover:bg-yellow-600 transition duration-300 transform hover:scale-105" data-id="${producto.id}" onclick="editProducto('${producto.id}', '${producto.presentacion}', ${producto.precio}, ${producto.cantidad})">Modificar</button>
          <button class="bg-red-500 text-white p-2 rounded-lg hover:bg-red-600 transition duration-300 transform hover:scale-105" data-id="${producto.id}" onclick="deleteProducto('${producto.id}')">Eliminar</button>
        </td>
      `;
      tableBody.appendChild(row);
    });
  }
}

/**
 * Elimina un producto de la base de datos.
 * @param {string} productId
 */
window.deleteProducto = async function(productId) {
  try {
    const confirmDelete = window.confirm("¿Estás seguro de que quieres eliminar este producto?");
    if (confirmDelete) {
      await deleteDoc(doc(db, `users/${userId}/inventario`, productId));
      console.log("Producto eliminado exitosamente.");
    }
  } catch (e) {
    console.error("Error al eliminar el producto: ", e);
  }
};

/**
 * Muestra el formulario para modificar un producto.
 * @param {string} productId
 * @param {string} presentacion
 * @param {number} precio
 * @param {number} cantidad
 */
window.editProducto = async function(productId, presentacion, precio, cantidad) {
  // Aquí se podría mostrar un modal o un formulario en línea para editar
  // Para simplificar, llenaremos el formulario de agregar producto
  showAgregarProducto();
  setTimeout(() => {
    document.getElementById('presentacion').value = presentacion;
    document.getElementById('precio').value = precio;
    document.getElementById('cantidad').value = cantidad;
    const form = document.getElementById('productoForm');
    form.onsubmit = async (e) => {
      e.preventDefault();
      try {
        await setDoc(doc(db, `users/${userId}/inventario`, productId), {
          presentacion: document.getElementById('presentacion').value,
          precio: parseFloat(document.getElementById('precio').value),
          cantidad: parseInt(document.getElementById('cantidad').value, 10)
        }, { merge: true });
        console.log("Producto modificado exitosamente.");
        showModifyDeleteView();
      } catch (e) {
        console.error("Error al modificar el producto: ", e);
      }
    };
  }, 100);
};
