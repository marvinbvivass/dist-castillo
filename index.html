<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Gestión de Ventas</title>
    <!-- Tailwind CSS -->
    <script src="https://cdn.tailwindcss.com"></script>
    <!-- Firebase SDKs -->
    <script type="module">
        import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
        import { setLogLevel } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
        
        // Importar las funciones de las otras vistas
        import { showInventarioSubMenu } from './inventario.js';
        import { showVentasView } from './ventas.js';

        // Configuración de Firebase proporcionada por el usuario
        const firebaseConfig = {
            apiKey: "AIzaSyAiitXEEekD-7FD7kDxDIcRbxlClsF5gHU",
            authDomain: "ventas-9a210.firebaseapp.com",
            projectId: "ventas-9a210",
            storageBucket: "ventas-9a210.firebasestorage.app",
            messagingSenderId: "815890981146",
            appId: "1:815890981146:web:938fe5e09babe511e98ca3",
            measurementId: "G-N0QXG70WM1"
        };

        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const db = getFirestore(app);
        setLogLevel('debug');

        // Referencias a elementos de la UI
        const authView = document.getElementById('auth-view');
        const appView = document.getElementById('app-view');
        const emailInput = document.getElementById('email-input');
        const passwordInput = document.getElementById('password-input');
        const loginButton = document.getElementById('login-button');
        const registerButton = document.getElementById('register-button');
        const messageModal = document.getElementById('message-modal');
        const modalOkButton = document.getElementById('modal-ok-button');
        const salesButton = document.getElementById('sales-button');
        const inventoryButton = document.getElementById('inventory-button');
        const mainContent = document.getElementById('main-content');
        const logoutButton = document.getElementById('logout-button');
        
        // Funciones para la UI
        function showModal(title, content) {
            document.getElementById('modal-title').textContent = title;
            document.getElementById('modal-content').textContent = content;
            messageModal.classList.remove('hidden');
        }

        modalOkButton.addEventListener('click', () => {
            messageModal.classList.add('hidden');
        });

        function toggleButtonStyles(activeButton) {
            if (activeButton === 'inventory') {
                inventoryButton.classList.remove('bg-gray-300', 'text-gray-800', 'hover:bg-gray-400');
                inventoryButton.classList.add('bg-blue-600', 'text-white', 'hover:bg-blue-700');
                salesButton.classList.add('bg-gray-300', 'text-gray-800', 'hover:bg-gray-400');
                salesButton.classList.remove('bg-blue-600', 'text-white', 'hover:bg-blue-700');
            } else {
                salesButton.classList.remove('bg-gray-300', 'text-gray-800', 'hover:bg-gray-400');
                salesButton.classList.add('bg-blue-600', 'text-white', 'hover:bg-blue-700');
                inventoryButton.classList.add('bg-gray-300', 'text-gray-800', 'hover:bg-gray-400');
                inventoryButton.classList.remove('bg-blue-600', 'text-white', 'hover:bg-blue-700');
            }
        }
        
        // Manejar el estado de autenticación
        onAuthStateChanged(auth, (user) => {
            if (user) {
                // El usuario ha iniciado sesión
                authView.classList.add('hidden');
                appView.classList.remove('hidden');
                const userId = user.uid;
                document.getElementById('user-id').textContent = `ID de Usuario: ${userId}`;
                
                // Configurar los botones principales de navegación
                inventoryButton.addEventListener('click', () => {
                    toggleButtonStyles('inventory');
                    showInventarioSubMenu(mainContent, showModal, db, userId);
                });
                salesButton.addEventListener('click', () => {
                    toggleButtonStyles('sales');
                    showVentasView(mainContent);
                });
                logoutButton.addEventListener('click', async () => {
                    await signOut(auth);
                });
            } else {
                // No hay usuario logeado
                appView.classList.add('hidden');
                authView.classList.remove('hidden');
            }
        });

        // Manejar el inicio de sesión
        loginButton.addEventListener('click', async (e) => {
            e.preventDefault();
            const email = emailInput.value;
            const password = passwordInput.value;
            try {
                await signInWithEmailAndPassword(auth, email, password);
                showModal('Éxito', 'Inicio de sesión exitoso.');
            } catch (error) {
                console.error("Error al iniciar sesión:", error);
                showModal('Error', 'No se pudo iniciar sesión. Verifique sus credenciales.');
            }
        });

        // Manejar el registro
        registerButton.addEventListener('click', async (e) => {
            e.preventDefault();
            const email = emailInput.value;
            const password = passwordInput.value;
            try {
                await createUserWithEmailAndPassword(auth, email, password);
                showModal('Éxito', 'Registro exitoso.');
            } catch (error) {
                console.error("Error al registrarse:", error);
                showModal('Error', 'No se pudo registrar. Intente de nuevo o verifique el formato del email y la contraseña.');
            }
        });
    </script>
</head>
<body class="bg-gray-100 font-sans p-4 flex flex-col items-center">
    
    <!-- Authentication View -->
    <div id="auth-view" class="w-full max-w-sm mt-20 p-8 bg-white rounded-lg shadow-md">
        <h2 class="text-2xl font-bold text-center text-gray-800 mb-6">Iniciar Sesión / Registrarse</h2>
        <form class="space-y-4">
            <div>
                <label for="email-input" class="block text-sm font-medium text-gray-700">Email</label>
                <input type="email" id="email-input" placeholder="tu_email@ejemplo.com" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500">
            </div>
            <div>
                <label for="password-input" class="block text-sm font-medium text-gray-700">Contraseña</label>
                <input type="password" id="password-input" placeholder="••••••••" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
            </div>
            <div class="flex flex-col space-y-3">
                <button type="button" id="login-button" class="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                    Iniciar Sesión
                </button>
                <button type="button" id="register-button" class="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-blue-600 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                    Registrarse
                </button>
            </div>
        </form>
    </div>

    <!-- Main Application View (Hidden by default) -->
    <div id="app-view" class="hidden w-full max-w-4xl p-4 flex flex-col items-center">
        <!-- Header -->
        <header class="w-full text-center mb-6">
            <h1 class="text-3xl md:text-4xl font-bold text-gray-800 mb-2">Gestión de Ventas</h1>
            <p id="user-id" class="text-sm text-gray-500"></p>
            <button id="logout-button" class="mt-2 py-1 px-3 bg-red-500 text-white text-xs font-semibold rounded-md shadow-sm hover:bg-red-600 transition duration-200">Cerrar Sesión</button>
        </header>
        
        <!-- Main Navigation Menu -->
        <div class="flex justify-center gap-4 mb-6 w-full max-w-4xl">
            <button id="sales-button" class="py-2 px-6 bg-gray-300 text-gray-800 font-semibold rounded-full shadow-md hover:bg-gray-400 transition duration-200">Ventas</button>
            <button id="inventory-button" class="py-2 px-6 bg-blue-600 text-white font-semibold rounded-full shadow-md hover:bg-blue-700 transition duration-200">Inventario</button>
        </div>
        
        <!-- Main Content Container -->
        <main id="main-content" class="w-full max-w-4xl bg-white p-6 rounded-lg shadow-md">
            <p class="text-gray-500 text-center">Seleccione una opción para comenzar.</p>
        </main>
    </div>

    <!-- Modal for messages -->
    <div id="message-modal" class="hidden fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
        <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div class="mt-3 text-center">
                <h3 class="text-lg leading-6 font-medium text-gray-900" id="modal-title"></h3>
                <div class="mt-2 px-7 py-3">
                    <p class="text-sm text-gray-500" id="modal-content"></p>
                </div>
                <div class="items-center px-4 py-3">
                    <button id="modal-ok-button" class="px-4 py-2 bg-blue-500 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                        OK
                    </button>
                </div>
            </div>
        </div>
    </div>
</body>
</html>
