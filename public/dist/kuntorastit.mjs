const DATA_URL = "/data/events.json";
async function loadData() {
    try {
        const response = await fetch(DATA_URL);
        if (!response.ok)
            throw new Error("Failed to fetch data");
        const data = await response.json();
        renderData(data);
    }
    catch (error) {
        console.error("Error loading data:", error);
        document.getElementById("content").innerText = "Failed to load data.";
    }
}
function renderData(data) {
    const content = document.getElementById("content");
    content.innerHTML = `<pre>${JSON.stringify(data, null, 2)}</pre>`;
}
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js')
        .then(() => console.log("Service Worker registered"))
        .catch(console.error);
}
document.addEventListener("DOMContentLoaded", loadData);
export {};
