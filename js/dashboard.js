import { db, auth } from './config.js';
import { collection, addDoc, onSnapshot, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { logout } from './auth.js?v=2.0';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { initLiveAuctions, initMyAuctions } from './auctions.js?v=2.0';
import { initNotifications } from './notifications.js?v=2.0';

let userListener = null;
let currentUserRole = 'user';

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        if (userListener) {
            userListener();
            userListener = null;
        }
        window.location.href = "auth.html";
        return;
    }

    try {
        // Fetch user details to get role and username
        const userDoc = await getDoc(doc(db, "users", user.uid));
        let userData = { role: 'user', username: user.email.split('@')[0], credits: 0 };
        if (userDoc.exists()) {
            userData = userDoc.data();
        }
        currentUserRole = userData.role || 'user';

        console.log(`Logged in as ${currentUserRole}:`, user.email);
        
        // Update UI
        document.getElementById('user-display-name').innerText = userData.username || user.email.split('@')[0];
        document.getElementById('role-badge').innerText = currentUserRole === 'admin' ? 'Admin' : 'User';
        
        if (currentUserRole === 'admin') {
            document.getElementById('role-badge').classList.add('admin-badge');
            // Admins don't need credits, let's show N/A
            document.getElementById('user-credits').innerText = 'N/A';
            // Hide Create Auction tab for admins
            const tabAuctioneer = document.getElementById('tab-auctioneer');
            if (tabAuctioneer) tabAuctioneer.style.display = 'none';
        }

        initLiveAuctions(currentUserRole, user.uid);     // Start the auction feed with role info
        if (currentUserRole !== 'admin') {
            initMyAuctions(user.uid);                    // Start My Auctions view for standard users
        }
        initNotifications();    // Start the "Outbid" listener
        
        // Listen to user credits (if standard user)
        if (currentUserRole === 'user' && !userListener) {
            const userRef = doc(db, "users", user.uid);
            userListener = onSnapshot(userRef, (docSnap) => {
                if(docSnap.exists()) {
                    const credits = docSnap.data().credits;
                    if (typeof credits === 'number' && !isNaN(credits)) {
                        document.getElementById('user-credits').innerText = credits;
                    } else {
                        document.getElementById('user-credits').innerText = '0';
                    }
                }
            });
        }
    } catch (err) {
        console.error("Dashboard init error:", err);
    }
});

// --- Tab Navigation ---
const tabMarketplace = document.getElementById('tab-marketplace');
const tabAuctioneer = document.getElementById('tab-auctioneer');
const tabMyAuctions = document.getElementById('tab-my-auctions');

const panelMarketplace = document.getElementById('marketplace-panel');
const panelAuctioneer = document.getElementById('auctioneer-panel');
const panelMyAuctions = document.getElementById('my-auctions-panel');

function switchTab(activeTab, activePanel) {
    // Reset tabs
    [tabMarketplace, tabAuctioneer, tabMyAuctions].forEach(t => {
        if(t) t.classList.remove('active');
    });
    // Reset panels
    [panelMarketplace, panelAuctioneer, panelMyAuctions].forEach(p => {
        if(p) {
            p.classList.remove('active-panel');
            p.style.display = 'none';
        }
    });

    if(activeTab) activeTab.classList.add('active');
    if(activePanel) {
        activePanel.classList.add('active-panel');
        activePanel.style.display = 'block';
    }
}

if(tabMarketplace) tabMarketplace.onclick = () => switchTab(tabMarketplace, panelMarketplace);
if(tabAuctioneer) tabAuctioneer.onclick = () => switchTab(tabAuctioneer, panelAuctioneer);
if(tabMyAuctions) tabMyAuctions.onclick = () => switchTab(tabMyAuctions, panelMyAuctions);

// --- Create Auction ---
const auctionForm = document.getElementById('create-auction-form');
if(auctionForm) {
    auctionForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (currentUserRole !== 'user') {
            window.showToast("Only users can create auctions.", "error");
            return;
        }

        const title = document.getElementById('auc-title').value;
        const imageUrl = document.getElementById('auc-image').value;
        const minBid = Number(document.getElementById('auc-min-bid').value);
        const desc = document.getElementById('auc-desc').value;
        const duration = Number(document.getElementById('auc-duration').value);
        const endTime = Date.now() + (duration * 60000);

        try {
            await addDoc(collection(db, "auctions"), {
                title,
                imageUrl: imageUrl || '', // Save image URL if provided
                description: desc,
                currentBid: minBid,
                minBid,
                endTime,
                status: 'active',
                highestBidder: '',
                highestBidderId: null,
                lastBidderId: null,
                creatorId: auth.currentUser.uid // Save who created it
            });
            window.showToast("Auction launched successfully!", "success");
            auctionForm.reset();
            // Switch back to marketplace
            tabMarketplace.click();
        } catch (err) {
            window.showToast("Error: " + err.message, "error");
        }
    });
}

// Global toast system
window.showToast = function(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast-alert toast-${type}`;
    toast.innerHTML = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 500);
    }, 4000);
};

document.getElementById('logout-btn').onclick = logout;
