/**
 * [USER PANEL] Dedicated Firebase Configuration & Initialization
 */
export const firebaseConfig = {
  apiKey: "AIzaSyApKoVSQAkZ58aV1NKrtldwQSMCRT3Itpk",
  authDomain: "clone-e0981.firebaseapp.com",
  databaseURL: "https://clone-e0981-default-rtdb.firebaseio.com",
  projectId: "clone-e0981",
  storageBucket: "clone-e0981.firebasestorage.app",
  messagingSenderId: "835279141417",
  appId: "1:835279141417:web:7ed9e1008d7ec2d1c23a38",
  measurementId: "G-CNYZKG2PDG"
};

// Initialize Firebase for User App
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

export const auth = firebase.auth();
export const db = firebase.database();
