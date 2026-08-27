import { initializeApp, getApps } from 'firebase/app';
import { 
  initializeFirestore, 
  persistentLocalCache,
  persistentMultipleTabManager,
  setLogLevel,
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  addDoc, 
  deleteDoc, 
  getDocs, 
  where, 
  writeBatch, 
  onSnapshot, 
  query, 
  orderBy, 
  limit, 
  serverTimestamp, 
  increment 
} from 'firebase/firestore';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInAnonymously, 
  updateProfile,
  onAuthStateChanged,
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

// Suppress non-critical retry diagnostic logs
setLogLevel('error');

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];

// Initialize Firestore with specific database ID if configured and enable multi-tab persistent cache
export const db = initializeFirestore(
  app, 
  {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    experimentalAutoDetectLongPolling: true,
    ignoreUndefinedProperties: true,
  }, 
  firebaseConfig.firestoreDatabaseId || '(default)'
);

// Initialize Firebase Auth
export const auth = getAuth(app);

export {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  getDocs,
  where,
  writeBatch,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
  increment,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  updateProfile,
  onAuthStateChanged,
  signOut,
};

export type { FirebaseUser };
