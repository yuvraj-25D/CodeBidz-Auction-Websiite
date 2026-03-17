export function startTimer(endTime, elementId, onExpiry) {
    let interval;

    const tick = () => {
        const timerEl = document.getElementById(elementId);
        // Clean up the interval if the element was removed from the DOM
        if (!timerEl) {
            if (interval) clearInterval(interval);
            return;
        }

        const now = Date.now();
        const distance = endTime - now;

        if (distance <= 0) {
            if (interval) clearInterval(interval);
            timerEl.innerHTML = "EXPIRED";

            if (onExpiry) onExpiry();
            return;
        }

        const minutes = Math.floor(distance / 60000);
        const seconds = Math.floor((distance % 60000) / 1000);

        timerEl.innerHTML = `${minutes}m ${seconds}s`;
    };

    tick(); // Show time immediately without waiting 1 sec
    interval = setInterval(tick, 1000);
}