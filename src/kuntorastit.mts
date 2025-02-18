const DATA_URL = "./data/events.json";

async function loadData() {
    try {
        const response = await fetch(DATA_URL);
        if (!response.ok) throw new Error("Failed to fetch data");
        const data = await response.json();
        renderData(data);
    } catch (error) {
        console.error("Error loading data:", error);
        document.getElementById("content")!.innerText = "Failed to load data.";
    }
}

type OrienteeringEvent = {
    startDateTime: number;
    name: string;
    organizerName: string;
}

function renderData(events: { event: OrienteeringEvent }[]) {
    const content = document.getElementById("content")!;
    content.innerHTML = "";

    const table = document.createElement("table");
    table.classList.add("event-table");
    table.innerHTML = `
        <thead>
            <tr>
                <th>Start Date</th>
                <th>Name</th>
                <th>Organizer</th>
            </tr>
        </thead>
        <tbody>
            ${events.map(({ event }) => `
                <tr>
                    <td>${new Date(event.startDateTime).toLocaleDateString()}</td>
                    <td>${event.name}</td>
                    <td>${event.organizerName}</td>
                </tr>
            `).join("")}
        </tbody>
    `;

    content.appendChild(table);
}

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js')
        .then(() => console.log("Service Worker registered"))
        .catch(console.error);
}

document.addEventListener("DOMContentLoaded", loadData);
