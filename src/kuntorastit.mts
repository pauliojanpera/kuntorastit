const DATA_URL = "./data/events.json";

type OrienteeringEvent = {
    uuid: string;
    startDateTime: number;
    endDateTime: number;
    name: string;
    organizerName: string;
    locationDescription: string;
    locationCoordinates: {
        lat: number;
        lon: number;
    }
}

type OrienteeringEventFilterSettings = {
    dateFilter?: 'past' | 'future';
    nameFilter?: string;
    organizerFilter?: string[];
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
        const select = e.target as HTMLSelectElement;
        const selectedOrganizers = Array.from(select.selectedOptions).map(option => option.value);
        filters.organizerFilter = selectedOrganizers.length > 0 ? selectedOrganizers : undefined;
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
                            <option value="">aika</option>
                        </select>
                    </th>
                    <th class="event">
                        <input type="text" id="name-filter" placeholder="tapahtuma">
                    </th>
                    <th class="organizer">
                        <select id="organizer-filter" multiple>
                            <option value="">seura</option>
                        </select>
                    </th>
                </tr>
            </thead>
            <tbody></tbody>
        </table>
    `;
}

function populateFilters(events: { event: OrienteeringEvent }[]) {
    const organizers = new Set(events.map(({ event }) => event.organizerName));

    const dateFilter = document.getElementById("date-filter")!;
    [
        ['past', 'menneet'],
        ['future', 'tulevat'],
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
    return `${date.toLocaleDateString('fi-FI', { weekday: 'short' })}\u00A0${date.getDate()}.${date.getMonth() + 1}. klo\u00A0${date.getHours()}.${String(date.getMinutes()).padStart(2, '0')}`;
}

function wgs84ToTm35fin(lat: number, lon: number): { northing: number; easting: number } {
    const a = 6378137.0; // Semi-major axis (WGS84)
    const f = 1 / 298.257222101; // Flattening (WGS84)
    const k0 = 0.9996; // Scale factor for TM35FIN
    const lon0 = 27; // Central meridian for EPSG:3067
    const falseEasting = 500000; // UTM false easting
    const falseNorthing = 0; // TM35FIN has no false northing for the northern hemisphere

    const e = Math.sqrt(2 * f - f * f); // First eccentricity
    const toRad = (deg: number) => deg * Math.PI / 180;
    const toDeg = (rad: number) => rad * 180 / Math.PI;

    const phi = toRad(lat);
    const lambda = toRad(lon);
    const lambda0 = toRad(lon0);

    // Compute N, T, C, A, M for projection
    const N = a / Math.sqrt(1 - e * e * Math.sin(phi) * Math.sin(phi));
    const T = Math.tan(phi) * Math.tan(phi);
    const C = (e * e) / (1 - e * e) * Math.cos(phi) * Math.cos(phi);
    const A = Math.cos(phi) * (lambda - lambda0);

    // Meridional arc
    const M = a * (
        (1 - e * e / 4 - 3 * e ** 4 / 64 - 5 * e ** 6 / 256) * phi
        - (3 * e ** 2 / 8 + 3 * e ** 4 / 32 + 45 * e ** 6 / 1024) * Math.sin(2 * phi)
        + (15 * e ** 4 / 256 + 45 * e ** 6 / 1024) * Math.sin(4 * phi)
        - (35 * e ** 6 / 3072) * Math.sin(6 * phi)
    );

    // Compute Easting (x)
    const easting = falseEasting + k0 * N * (
        A + (1 - T + C) * Math.pow(A, 3) / 6
        + (5 - 18 * T + T * T + 72 * C - 58 * (e * e) / (1 - e * e)) * Math.pow(A, 5) / 120
    );

    // Compute Northing (y)
    const northing = falseNorthing + k0 * (
        M + N * Math.tan(phi) * (
            (A * A) / 2 + (5 - T + 9 * C + 4 * C * C) * Math.pow(A, 4) / 24
            + (61 - 58 * T + T * T + 600 * C - 330 * (e * e) / (1 - e * e)) * Math.pow(A, 6) / 720
        )
    );

    return { northing, easting };
}

function renderData(events: { event: OrienteeringEvent }[], filters: OrienteeringEventFilterSettings) {
    const tbody = document.querySelector(".event-table tbody")!;

    // Clear existing rows
    while (tbody.firstChild) {
        tbody.removeChild(tbody.firstChild);
    }

    const currentYear = new Date().getFullYear();
    const currentYearStart = new Date(currentYear, 0).getTime();
    const nextYearStart = new Date(currentYear + 1, 0).getTime();

    let previousStartDateTime: number | undefined;

    events.filter(({ event }) => {
        return (
            event.startDateTime >= currentYearStart &&
            event.endDateTime <= nextYearStart &&
            (!filters.dateFilter
                || (filters.dateFilter === 'past' && event.startDateTime < Date.now())
                || (filters.dateFilter === 'future' && event.startDateTime > Date.now() - 24 * 60 * 60 * 1000)
            ) &&
            (!filters.nameFilter || event.name.toLowerCase().includes(filters.nameFilter)) &&
            (!filters.organizerFilter || filters.organizerFilter.includes(event.organizerName))
        );
    }).forEach(({ event }) => {
        const dayOfWeek = new Date(event.startDateTime)
            .toLocaleDateString('en-US', { weekday: 'long' })
            .toLowerCase();

        const row = document.createElement("tr");
        row.classList.add("event-row");
        row.classList.add(dayOfWeek); // Assign CSS class based on the day of the week

        const dateCell = document.createElement("td");
        dateCell.classList.add("date");
        if (previousStartDateTime !== event.startDateTime) {
            dateCell.textContent = formatDate(new Date(event.startDateTime));
        }

        const eventCell = document.createElement("td");
        eventCell.classList.add("event");
        eventCell.textContent = event.name.replace(/\s/g, ' ');

        const organizerCell = document.createElement("td");
        organizerCell.classList.add("organizer");
        organizerCell.textContent = event.organizerName;

        row.appendChild(dateCell);
        row.appendChild(eventCell);
        row.appendChild(organizerCell);

        tbody.appendChild(row);

        // Create an expandable row but keep it hidden initially
        const expandedRow = document.createElement("tr");
        expandedRow.classList.add("expanded-row");
        expandedRow.style.display = "none"; // Initially hidden

        const expandedCell = document.createElement("td");
        expandedCell.colSpan = 3; // Spanning all columns

        // Additional information content
        const expandedContent = document.createElement("div");
        expandedContent.classList.add("expanded-content");

        if (event.locationDescription || event.locationCoordinates) {
            const locationInfo = document.createElement("div");
            const locationTitle = document.createElement("div");
            locationTitle.textContent = `Opastuksen alku, lähtöpaikan osoite tai muu sijainti: `;
            const locationDescription = document.createElement("div");
            locationDescription.classList.add('location-description');
            locationDescription.textContent = event.locationDescription;
            locationInfo.appendChild(locationTitle);
            locationInfo.appendChild(locationDescription);
            if (event.locationCoordinates) {
                const { northing, easting } = wgs84ToTm35fin(event.locationCoordinates.lat, event.locationCoordinates.lon);
                const mapLink = document.createElement("a");
                mapLink.href = `https://asiointi.maanmittauslaitos.fi/karttapaikka/?lang=fi&share=customMarker&n=${northing.toFixed(2)}&e=${easting.toFixed(2)}&title=${encodeURIComponent(event.name)}&zoom=6&layers=W3siaWQiOjIsIm9wYWNpdHkiOjEwMH1d-z`;
                mapLink.target = "_blank";
                mapLink.textContent = "🌍\u00A0Näytä\u00A0kartalla";
                mapLink.classList.add("button");
                locationDescription.appendChild(mapLink);
            }
            expandedContent.appendChild(locationInfo);
        }

        const timeInfo = document.createElement("div");
        const startTime = new Date(event.startDateTime);
        const endTime = new Date(event.endDateTime);
        timeInfo.textContent = `Tapahtuma jatkuu ${formatDate(endTime)} saakka.`;
        expandedContent.appendChild(timeInfo);

        const eventPageLinkInfo = document.createElement("div");
        eventPageLinkInfo.classList.add('event-page-link');
        eventPageLinkInfo.appendChild(Object.assign(document.createElement('a'), {
            href: `https://www.rastilippu.fi/kuntorastit/tapahtuma/${event.uuid}`,
            target: '_blank',
            textContent: '📌 Tapahtumanjärjestäjän ilmoitus',
        }));
        expandedContent.appendChild(eventPageLinkInfo);

        expandedCell.appendChild(expandedContent);
        expandedRow.appendChild(expandedCell);
        tbody.appendChild(expandedRow);

        // Toggle expansion on row click
        row.addEventListener("click", () => {
            if (expandedRow.style.display === "none") {
                // Close any other open row first
                document.querySelectorAll(".expanded-row").forEach(el => (el as HTMLElement).style.display = "none");
                expandedRow.style.display = "table-row";
            } else {
                expandedRow.style.display = "none";
            }
        });

        previousStartDateTime = event.startDateTime;
    });
}

document.addEventListener("DOMContentLoaded", loadData);
