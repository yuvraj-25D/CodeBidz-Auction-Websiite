import { db, auth } from './config.js';
import { collection, query, where, onSnapshot } 
from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let notificationsInitialized = false;

export function initNotifications() {
    if (notificationsInitialized) return;
    notificationsInitialized = true;

    const user = auth.currentUser;
    if (!user) {
        notificationsInitialized = false;
        return;
    }

    // Listen for auctions where this user WAS the leader but is no longer
    const q = query(
        collection(db, "auctions"), 
        where("status", "==", "active")
    );

    onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === "modified") {
                const data = change.doc.data();
                // Check if the current user just got outbid
                if (data.lastBidderId === user.uid && data.highestBidderId !== user.uid) {
                    showToast(`🚨 Outbid! Someone just bid ${data.currentBid} on ${data.title}`);
                }
            }
        });
    }, (error) => {
        console.error("Notifications snapshot error:", error);
        notificationsInitialized = false;
    });
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast-alert';
    toast.innerText = message;
    document.body.appendChild(toast);

    // Remove after 5 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 500);
    }, 5000);
}