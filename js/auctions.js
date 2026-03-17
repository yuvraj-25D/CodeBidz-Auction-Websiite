import { db, auth } from './config.js';
import { collection, onSnapshot, doc, updateDoc, getDoc, query, where, increment } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { startTimer } from './utils.js';

let dbLiveListener = null;
let dbMyListener = null;

export function initLiveAuctions(userRole, currentUserId) {
    const container = document.getElementById("auction-container");
    if (!container) return;

    if (dbLiveListener) {
        dbLiveListener();
        dbLiveListener = null;
    }
    
    // Clear the container so fresh SPA loads do not duplicate cached DOM nodes
    container.innerHTML = '';

    console.log("Initializing live auctions listener...");

    const auctionsRef = query(
        collection(db, "auctions"),
        where("status", "==", "active")
    );

    dbLiveListener = onSnapshot(auctionsRef, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            const auction = change.doc.data();
            const auctionId = change.doc.id;

            if (change.type === "added") {
                // If it already exists for some reason, don't recreate
                if (document.getElementById(`auction-card-${auctionId}`)) return;
                
                const card = document.createElement("div");
                card.className = "auction-card";
                card.id = `auction-card-${auctionId}`;

                card.innerHTML = `
                    <div class="card-header">
                        <h3>${auction.title}</h3>
                        <span class="status-badge live"><i class="fas fa-circle live-dot"></i> Live</span>
                    </div>
                    
                    ${auction.imageUrl ? `<img src="${auction.imageUrl}" alt="Auction Item" class="auction-image">` : `<div class="auction-image-placeholder"><i class="fas fa-image"></i></div>`}
                    
                    <p class="auction-desc">${auction.description || 'No description provided.'}</p>
                    
                    <div class="bid-info">
                        <div class="current-bid">
                            <span class="label">Current Bid</span>
                            <span class="amount" id="bid-${auctionId}">${auction.currentBid} <i class="fas fa-coins text-warning"></i></span>
                        </div>
                        <div class="highest-bidder">
                            <span class="label">Highest Bidder</span>
                            <span class="bidder-name" id="bidder-${auctionId}"><i class="fas fa-user-circle"></i> ${auction.highestBidder || 'None'}</span>
                        </div>
                    </div>

                    <div class="timer-box">
                        <i class="far fa-clock"></i> <span id="timer-${auctionId}"></span> left
                    </div>

                    <div class="card-actions">
                        ${(userRole === 'admin' || currentUserId === auction.creatorId) ? 
                            `<button class="btn-danger btn-small" onclick="removeAuction('${auctionId}')"><i class="fas fa-trash"></i> Remove</button>` 
                        : ''}
                        ${userRole === 'user' ? 
                            `<button class="btn-primary" onclick="placeBid('${auctionId}')"><i class="fas fa-gavel"></i> Bid +10</button>` 
                        : ''}
                    </div>
                `;

                container.appendChild(card);

                const timerId = `timer-${auctionId}`;
                // Start auction countdown timer ONLY when added and if valid
                if (auction.endTime && typeof auction.endTime === 'number' && !isNaN(auction.endTime)) {
                    startTimer(
                        auction.endTime,
                        timerId,
                        () => closeAuction(auctionId)
                    );
                } else {
                    const timerEl = document.getElementById(timerId);
                    if (timerEl) timerEl.innerHTML = "No end time set";
                }
            }
            if (change.type === "modified") {
                // Update specific elements instead of re-rendering the whole card
                const bidEl = document.getElementById(`bid-${auctionId}`);
                if (bidEl) {
                    bidEl.innerHTML = `${auction.currentBid} <i class="fas fa-coins text-warning"></i>`;
                    // Optional: pulse animation
                    bidEl.classList.remove('pulse-update');
                    void bidEl.offsetWidth; // reset animation
                    bidEl.classList.add('pulse-update');
                }
                
                const bidderEl = document.getElementById(`bidder-${auctionId}`);
                if (bidderEl) bidderEl.innerHTML = `<i class="fas fa-user-circle"></i> ${auction.highestBidder || 'None'}`;
            }
            if (change.type === "removed") {
                console.log("Auction closed, scheduling removal in 5 mins:", auctionId);
                const card = document.getElementById(`auction-card-${auctionId}`);
                if (card) {
                    // Update visual state to show it's expired
                    card.style.opacity = '0.6';
                    card.style.position = 'relative';
                    
                    const timerEl = document.getElementById(`timer-${auctionId}`);
                    if (timerEl) timerEl.innerHTML = "<span style='color:red; font-weight:bold;'>EXPIRED</span>";
                    
                    // Remove the bid button to prevent further interactions
                    const btn = card.querySelector('button');
                    if (btn) btn.remove();

                    // Optional: Add a small overlay indicating it will be removed soon
                    const overlay = document.createElement('div');
                    overlay.style.cssText = 'position:absolute; top:5px; right:5px; background:rgba(0,0,0,0.5); color:white; padding:2px 5px; font-size:10px; border-radius:3px;';
                    overlay.innerText = 'Closing soon...';
                    card.appendChild(overlay);

                    // Delay actual DOM destruction by 5 minutes (300,000 ms)
                    setTimeout(() => {
                        console.log("5 mins passed. Removing auction card from DOM:", auctionId);
                        const cardToRemove = document.getElementById(`auction-card-${auctionId}`);
                        if (cardToRemove) cardToRemove.remove();
                    }, 300000);
                }
            }
        });
    }, (error) => {
        console.error("Auctions onSnapshot error:", error);
        // Reset initialization so it can be retried if needed
        auctionsInitialized = false;
    });

}

//////////////////////////////////////////////////
// MY AUCTIONS FUNCTION (USER SPECIFIC)
//////////////////////////////////////////////////
export function initMyAuctions(currentUserId) {
    const myContainer = document.getElementById("my-auction-container");
    if (!myContainer) return;

    if (dbMyListener) {
        dbMyListener();
        dbMyListener = null;
    }

    const myAuctionsRef = query(
        collection(db, "auctions"),
        where("creatorId", "==", currentUserId)
    );

    dbMyListener = onSnapshot(myAuctionsRef, (snapshot) => {
        // Clear container to easily handle statuses (active vs closed) for "My Auctions"
        // In a real app we'd do smart DOM diffing like above, but for a user's local list, simple is fine.
        myContainer.innerHTML = '';
        
        if (snapshot.empty) {
            myContainer.innerHTML = '<p class="text-muted" style="grid-column: 1/-1; text-align: center; padding: 2rem;">You have not created any auctions yet.</p>';
            return;
        }

        snapshot.forEach((docSnap) => {
            const auction = docSnap.data();
            const auctionId = docSnap.id;
            
            const card = document.createElement("div");
            card.className = "auction-card";
            if(auction.status !== 'active') card.style.opacity = '0.7';

            card.innerHTML = `
                <div class="card-header">
                    <h3>${auction.title}</h3>
                    <span class="status-badge ${auction.status === 'active' ? 'live' : ''}">${auction.status.toUpperCase()}</span>
                </div>
                ${auction.imageUrl ? `<img src="${auction.imageUrl}" alt="Auction Item" class="auction-image">` : `<div class="auction-image-placeholder"><i class="fas fa-image"></i></div>`}
                <div class="bid-info" style="margin-top: 1rem;">
                    <div class="current-bid">
                        <span class="label">Current Bid</span>
                        <span class="amount">${auction.currentBid}</span>
                    </div>
                    <div class="highest-bidder">
                        <span class="label">Highest Bidder</span>
                        <span class="bidder-name">${auction.highestBidder || 'None'}</span>
                    </div>
                </div>
                <div class="card-actions">
                    <button class="btn-danger btn-small" onclick="removeAuction('${auctionId}')"><i class="fas fa-trash"></i> Delete Listing</button>
                </div>
            `;
            myContainer.appendChild(card);
        });
    }, (error) => {
        console.error("My Auctions error:", error);
        myAuctionsInitialized = false;
    });
}

//////////////////////////////////////////////////
// REMOVE AUCTION FUNCTION (MODERATION/CREATOR)
//////////////////////////////////////////////////
import { deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

window.removeAuction = async function(auctionId) {
    if (!confirm("Are you sure you want to remove this auction permanently?")) return;
    try {
        await deleteDoc(doc(db, "auctions", auctionId));
        if (window.showToast) window.showToast("Auction removed successfully.", "success");
    } catch (err) {
        console.error("Removal error:", err);
        if (window.showToast) window.showToast("Error removing auction: " + err.message, "error");
    }
}

//////////////////////////////////////////////////
// BID FUNCTION
//////////////////////////////////////////////////

window.placeBid = async function(auctionId) {
    try {
        const user = auth.currentUser;
        if (!user) {
            alert("Please login first");
            return;
        }

        if (!auctionId) {
            if (window.showToast) window.showToast("Invalid auction ID.");
            return;
        }

        const auctionRef = doc(db, "auctions", auctionId);
        const auctionSnap = await getDoc(auctionRef);

        if (!auctionSnap.exists()) {
            if (window.showToast) window.showToast("Auction no longer exists.");
            return;
        }

        const auction = auctionSnap.data();

        if (auction.status !== "active") {
            if (window.showToast) window.showToast("Auction is closed.", "error");
            return;
        }

        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.data();

        const newBid = auction.currentBid + 10;

        if (auction.highestBidderId === user.uid) {
            alert("You already have the highest bid!");
            return;
        }

        if (userData.credits < newBid) {
            alert("Not enough credits!");
            return;
        }

        // Refund previous bidder
        if (auction.highestBidderId) {
            const prevBidderRef = doc(db, "users", auction.highestBidderId);
            await updateDoc(prevBidderRef, {
                credits: increment(auction.currentBid)
            });
        }

        // Deduct new bid from current user
        await updateDoc(userRef, {
            credits: increment(-newBid)
        });
        
        // Use Username for display if available, else fallback to email
        const displayName = userData.username || userData.email.split('@')[0];

        await updateDoc(auctionRef, {
            currentBid: newBid,
            highestBidder: displayName,
            highestBidderId: user.uid,
            lastBidderId: auction.highestBidderId || null
        });

        if (window.showToast) window.showToast("Bid placed successfully!", "success");
    } catch (err) {
        console.error("Bid error:", err);
        if (window.showToast) window.showToast("Bid Error: " + err.message, "error");
    }
}
//////////////////////////////////////////////////
// CLOSE AUCTION WHEN TIMER EXPIRES
//////////////////////////////////////////////////

const failedCloseAttempts = new Set();

async function closeAuction(auctionId) {
    if (failedCloseAttempts.has(auctionId)) return;

    try {
        const auctionRef = doc(db, "auctions", auctionId);
        const snap = await getDoc(auctionRef);
        if (!snap.exists()) return;
        
        const data = snap.data();

        if (data.status === "active") {
            await updateDoc(auctionRef, {
                status: "closed"
            });
            alert(`Auction ended! Winner: ${data.highestBidder || 'None'}`);
        }
    } catch (err) {
        console.error("Error closing auction (likely permission denied):", err);
        failedCloseAttempts.add(auctionId);
    }
}