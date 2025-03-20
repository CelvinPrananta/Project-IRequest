// Impor fungsi yang Anda butuhkan dari SDK yang Anda butuhkan
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, GoogleAuthProvider, OAuthProvider } from "firebase/auth";
import { getFirestore, collection, getDocs, addDoc, updateDoc, doc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { getDatabase, ref, onValue } from "firebase/database";
import { getStorage } from 'firebase/storage';

// Firebase Configuration (gunakan data dari Firebase Console)
// const firebaseConfig = {
//   apiKey: "AIzaSyDZsf6i21RAwWx8UXTo-QtEzrFnY5c1pMs",
//   authDomain: "ms-today-event.firebaseapp.com",
//   databaseURL: "https://ms-today-event-default-rtdb.asia-southeast1.firebasedatabase.app",
//   projectId: "ms-today-event",
//   storageBucket: "ms-today-event.firebasestorage.app",
//   messagingSenderId: "55917945135",
//   appId: "1:55917945135:web:96f02a7d47ec86aad881da"
// };

/*-- Apabila menggunakan .env */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);

// Dapatkan instance Auth dan Firestore dan Database
const db = getFirestore(app);
const auth = getAuth(app);

// Instance untuk Realtime Database
const storage = getStorage(app);
const database = getDatabase(app);

// Dapatkan instance Analitik
const analytics = getAnalytics(app);

// Mendapatkan data Google Auth Provider
const provider = new GoogleAuthProvider();

// Mendapatkan data Microsoft Auth Provider
const microsoftProvider = new OAuthProvider("microsoft.com");

// Mengekspor instance yang digunakan di file lain
export { db, auth, storage, database, analytics, provider, microsoftProvider, ref, onValue, collection, getDocs, addDoc, updateDoc, doc, deleteDoc, serverTimestamp };

export default app;