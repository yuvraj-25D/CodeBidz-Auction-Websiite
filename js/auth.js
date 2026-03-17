import { auth, db } from './config.js';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export const login = async (email, password, roleAttempt = 'user') => {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Fetch user document to check role
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            const actualRole = userData.role || 'user';
            
            if (actualRole !== roleAttempt) {
                // Roles do not match. e.g trying to login as admin but user is a regular user.
                await signOut(auth); // Sign them back out
                throw new Error(`Access denied. Incorrect portal for ${actualRole} account.`);
            }
            window.location.href = 'index.html';
        } else {
            // No document, assume regular user profile but we should probably error out in a real app
            window.location.href = 'index.html'; 
        }
    } catch (error) {
        console.error("Login Error:", error);
        throw error;
    }
};

export const register = async (email, password, username) => {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        await setDoc(doc(db, "users", user.uid), {
            email,
            username: username || email.split('@')[0],
            role: 'user', // Always user on signup!
            credits: 5000 // Default bidding credits
        });
        
        window.location.href = 'index.html';
    } catch (error) {
        console.error("Registration Error:", error);
        throw error;
    }
};

export const logout = () => signOut(auth).then(() => window.location.href = 'auth.html');