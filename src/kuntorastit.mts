const DATA_URL = "./data/events.json";

type OrienteeringEventFilterSettings = {
    dateFilter?: 'past' | 'future';
    nameFilter?: string;
    organizerFilter?: string;
};

async function* filterSettings() {
    const filters: OrienteeringEventFilterSettings = {};

    let resolve: (f: OrienteeringEventFilterSettings) => void;
    document.getElementById("date-filter")!.onchange = (e) => {
        filters.dateFilter = ((e.target as HTMLSelectElement)?.value as any) || undefined;
        resolve(filters);
    };
    document.getElementById("name-filter")!.oninput = (e) => {
        filters.nameFilter = (e.target as HTMLInputElement)?.value.toLowerCase().trim() || undefined;
        resolve(filters);
    };
    document.getElementById("organizer-filter")!.onchange = (e) => {
        filters.organizerFilter = (e.target as HTMLSelectElement)?.value || undefined;
        resolve(filters);
    };
    yield filters;
    for (; ;)
        yield new Promise<OrienteeringEventFilterSettings>(_resolve => resolve = _resolve);
}

async function loadData() {
    const contentDiv = document.getElementById("content")!;
    try {
        const response = await fetch(DATA_URL);
        if (!response.ok) throw new Error("Failed to fetch data");
        const data = await response.json();


        contentDiv.innerHTML = createTableSkeleton();
        populateFilters(data);

        for await (const filters of filterSettings()) {
            renderData(data, filters);
        }
    } catch (error) {
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
                            <option value="">ajankohta</option>
                        </select>
                    </th>
                    <th class="event">
                        <input type="text" id="name-filter" placeholder="tapahtuma">
                    </th>
                    <th class="organizer">
                        <select id="organizer-filter">
                            <option value="">järjestäjä</option>
                        </select>
                    </th>
                </tr>
                <!--tr>
                    <th class="date">alkaa</th>
                    <th class="event">tapahtuma</th>
                    <th class="organizer">seura</th>
                </tr-->
            </thead>
            <tbody></tbody>
        </table>
    `;
}

type OrienteeringEvent = {
    uuid: string;
    startDateTime: number;
    endDateTime: number;
    name: string;
    organizerName: string;
}

function populateFilters(events: { event: OrienteeringEvent }[]) {
    const organizers = new Set(events.map(({ event }) => event.organizerName));

    const dateFilter = document.getElementById("date-filter")!;
    [
        ['future', 'tulevat'],
        ['past', 'menneet']
    ].forEach(([value, textContent]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = textContent;
        dateFilter.appendChild(option);
    });

    const organizerFilter = document.getElementById("organizer-filter")!;
    organizers.forEach(org => {
        const option = document.createElement("option");
        option.value = org;
        option.textContent = org;
        organizerFilter.appendChild(option);
    });
}

function formatDate(date: Date) {
    return `${date.toLocaleDateString('fi-FI', { weekday: 'short' })}&nbsp;${date.getDate()}.${date.getMonth() + 1}. klo&nbsp;${date.getHours()}.${String(date.getMinutes()).padStart(2, '0')}`;
}

function renderData(events: { event: OrienteeringEvent }[], filters: OrienteeringEventFilterSettings) {
    const tbody = document.querySelector(".event-table tbody")!;
    tbody.innerHTML = "";
    const currentYear = new Date(Date.now()).getFullYear();
    const currentYearStart = new Date(currentYear, 0).getTime();
    const nextYearStart = new Date(currentYear + 1, 0).getTime();
    let previousStartDateTime: number;
    events.filter(({ event }) => {
        return (
            (event.startDateTime >= currentYearStart && event.endDateTime <= nextYearStart) &&
            (!filters.dateFilter
                || (filters.dateFilter === 'past' && (event.startDateTime < Date.now()))
                || (filters.dateFilter === 'future' && (event.startDateTime > Date.now()-24*60*60*1000))
            ) &&
            (!filters.nameFilter || event.name.toLowerCase().includes(filters.nameFilter)) &&
            (!filters.organizerFilter || event.organizerName === filters.organizerFilter)
        );
    }).forEach(({ event }) => {
        const dayOfWeek = new Date(event.startDateTime)
            .toLocaleDateString('en-US', { weekday: 'long' })
            .toLowerCase();
        const row = document.createElement("tr");
        row.classList.add(`${dayOfWeek}`); // Assign CSS class based on the day of the week
        row.innerHTML = `
            <td class="start">${previousStartDateTime === event.startDateTime ? '' : formatDate(new Date(event.startDateTime))}</td>
            <td class="event">${event.name.replaceAll(/\s/g, ' ')}</td>
            <td class="organizer">${event.organizerName}</td>
        `;
        tbody.appendChild(row);
        previousStartDateTime = event.startDateTime;
    });
}

document.addEventListener("DOMContentLoaded", loadData);
