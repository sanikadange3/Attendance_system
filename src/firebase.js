// Firebase Configuration
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBk_EhL6xdLVldIR4CkaoHKl1Dy7x7Fg08",
  authDomain: "attendance-a9526.firebaseapp.com",
  projectId: "attendance-a9526",
  storageBucket: "attendance-a9526.firebasestorage.app",
  messagingSenderId: "615496591861",
  appId: "1:615496591861:web:99935d147bd19b16dc18bc",
  measurementId: "G-7QT1G4W8J8"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;