const DATA_URL = "./data/events.json";
async function* filterSettings() {
    const filters = {};
    let resolve;
    document.getElementById("date-filter").onchange = (e) => {
        filters.dateFilter = e.target?.value || undefined;
        resolve(filters);
    };
    document.getElementById("name-filter").oninput = (e) => {
        filters.nameFilter = e.target?.value.toLowerCase().trim() || undefined;
        resolve(filters);
    };
    document.getElementById("organizer-filter").onchange = (e) => {
        filters.organizerFilter = e.target?.value || undefined;
        resolve(filters);
    };
    yield filters;
    for (;;)
        yield new Promise(_resolve => resolve = _resolve);
}
async function loadData() {
    const contentDiv = document.getElementById("content");
    try {
        const response = await fetch(DATA_URL);
        if (!response.ok)
            throw new Error("Failed to fetch data");
        const data = await response.json();
        contentDiv.innerHTML = createTableSkeleton();
        populateFilters(data);
        for await (const filters of filterSettings()) {
            renderData(data, filters);
        }
    }
    catch (error) {
        console.error("Error loading data:", error);
        contentDiv.innerText = "Failed to load data.";
    }
}
function createTableSkeleton() {
    return `
        <table class="event-table">
            <thead>
                <tr>
                    <th class="date">
                        <select id="date-filter">
                            <option value="">aika</option>
                        </select>
                    </th>
                    <th class="event">
                        <input type="text" id="name-filter" placeholder="tapahtuma">
                    </th>
                    <th class="organizer">
                        <select id="organizer-filter">
                            <option value="">seura</option>
                        </select>
                    </th>
                </tr>
            </thead>
            <tbody></tbody>
        </table>
    `;
}
function populateFilters(events) {
    const organizers = new Set(events.map(({ event }) => event.organizerName));
    const dateFilter = document.getElementById("date-filter");
    [
        ['past', 'menneet'],
        ['future', 'tulevat'],
    ].forEach(([value, textContent]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = textContent;
        dateFilter.appendChild(option);
    });
    const organizerFilter = document.getElementById("organizer-filter");
    organizers.forEach(org => {
        const option = document.createElement("option");
        option.value = org;
        option.textContent = org;
        organizerFilter.appendChild(option);
    });
}
function formatDate(date) {
    return `${date.toLocaleDateString('fi-FI', { weekday: 'short' })}&nbsp;${date.getDate()}.${date.getMonth() + 1}. klo&nbsp;${date.getHours()}.${String(date.getMinutes()).padStart(2, '0')}`;
}
function renderData(events, filters) {
    const tbody = document.querySelector(".event-table tbody");
    tbody.innerHTML = "";
    const currentYear = new Date(Date.now()).getFullYear();
    const currentYearStart = new Date(currentYear, 0).getTime();
    const nextYearStart = new Date(currentYear + 1, 0).getTime();
    let previousStartDateTime;
    events.filter(({ event }) => {
        return ((event.startDateTime >= currentYearStart && event.endDateTime <= nextYearStart) &&
            (!filters.dateFilter
                || (filters.dateFilter === 'past' && (event.startDateTime < Date.now()))
                || (filters.dateFilter === 'future' && (event.startDateTime > Date.now() - 24 * 60 * 60 * 1000))) &&
            (!filters.nameFilter || event.name.toLowerCase().includes(filters.nameFilter)) &&
            (!filters.organizerFilter || event.organizerName === filters.organizerFilter));
    }).forEach(({ event }) => {
        const dayOfWeek = new Date(event.startDateTime)
            .toLocaleDateString('en-US', { weekday: 'long' })
            .toLowerCase();
        const row = document.createElement("tr");
        row.classList.add(`${dayOfWeek}`); // Assign CSS class based on the day of the week
        row.innerHTML = `
            <td class="date">${previousStartDateTime === event.startDateTime ? '' : formatDate(new Date(event.startDateTime))}</td>
            <td class="event">${event.name.replaceAll(/\s/g, ' ')}</td>
            <td class="organizer">${event.organizerName}</td>
        `;
        tbody.appendChild(row);
        previousStartDateTime = event.startDateTime;
    });
}
document.addEventListener("DOMContentLoaded", loadData);
export {};
