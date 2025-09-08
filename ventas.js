import { collection, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

let db;
let userId;

/**
 * @param {object} firestoreDB
 * @param {string} currentUserId
 */
export function setupVentas(firestoreDB, currentUserId) {
  db = firestoreDB;
  userId = currentUserId;
}

/**
 * Renderiza la vista de ventas.
 */
export function showVentasView() {
  const mainContent = document.getElementById('mainContent');
  mainContent.innerHTML = `
    <div class="p-6 bg-gray-100 min-h-screen">
      <div class="container mx-auto">
        <div class="bg-white p-8 rounded-lg shadow-xl text-center">
          <h2 class="text-2xl font-bold text-gray-800 mb-6">Vista de Ventas</h2>
          <p class="text-gray-600">Esta sección está en construcción. ¡Pronto podrás gestionar tus ventas aquí!</p>
        </div>
      </div>
    </div>
  `;
}
