const DATA_URL = `./data/events.json`;

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
    dateFilter?: 'all' | 'past' | 'future';
    nameFilter?: string;
    organizerFilter?: Set<string>;
};

function saveFilterSettings(filters: OrienteeringEventFilterSettings) {
    localStorage.setItem("orienteeringEventFilters",
        JSON.stringify(filters, (k, v) => k === 'organizerFilter' && v instanceof Set ? !v.has('kaikki') ? [...v] : undefined : v));
}

function loadFilterSettings(): OrienteeringEventFilterSettings {
    const stored = localStorage.getItem("orienteeringEventFilters");
    return stored ? JSON.parse(stored, (k, v) => k === 'organizerFilter' && Array.isArray(v) ? new Set(v) : v) : {};
}

async function* filterSettings() {
    const filters: OrienteeringEventFilterSettings = loadFilterSettings();

    // First we restore the filter UI

    if (!filters.dateFilter)
        filters.dateFilter = 'future';
    const dateFilterElement = document.getElementById("date-filter") as HTMLSelectElement;
    const dateUnsetOption = dateFilterElement.selectedOptions[0] as HTMLOptionElement;
    dateFilterElement.value = filters.dateFilter;
    dateUnsetOption.remove();

    if (filters.nameFilter)
        (document.getElementById("name-filter") as HTMLInputElement).value = filters.nameFilter;

    if (filters.organizerFilter) {
        const select = document.getElementById("organizer-filter") as HTMLSelectElement;
        Array.from(select.options).forEach(option => {
            option.selected = filters.organizerFilter!.has(option.value);
        });
        // Trigger update of placeholder after restoring selections
        const changeEvent = new Event("change", { bubbles: true });
        select.dispatchEvent(changeEvent);
    }

    // Next we bind to settings changes

    let resolve: (f: OrienteeringEventFilterSettings) => void;
    document.getElementById("date-filter")!.onchange = (e) => {
        filters.dateFilter = ((e.target as HTMLSelectElement)?.value as any) || undefined;
        resolve?.(filters);
    };
    document.getElementById("name-filter")!.oninput = (e) => {
        filters.nameFilter = (e.target as HTMLInputElement)?.value.toLowerCase().trim() || undefined;
        resolve?.(filters);
    };
    document.getElementById("organizer-filter")!.onchange = (e) => {
        const select = e.target as HTMLSelectElement;
        const selectedOrganizers = new Set(Array.from(select.selectedOptions).map(option => option.value));
        filters.organizerFilter = selectedOrganizers.size > 0 && !selectedOrganizers.has('kaikki') ? selectedOrganizers : undefined;
        resolve?.(filters);
    };
    yield filters;

    // Then we start yielding the settings changes
    for (; ;)
        yield new Promise<OrienteeringEventFilterSettings>(_resolve => resolve = _resolve)
            .then((filters) => {
                saveFilterSettings(filters);
                return filters;
            });
}

let activeFilters: OrienteeringEventFilterSettings;

async function loadData() {
    const contentDiv = document.getElementById("content")!;
    try {
        const response = await fetch(DATA_URL);
        if (!response.ok) throw new Error("Failed to fetch data");
        const data = await response.json();

        populateFilters(data);
        setupMultiSelectToggle();

        for await (const filters of filterSettings()) {
            activeFilters = filters;
            renderData(data, filters);
        }
    } catch (error) {
        console.error("Error loading data:", error);
        contentDiv.innerText = "Failed to load data.";
    }
}

function positionFilterContainer() {
    const organizerPlaceholder = document.getElementById("organizer-placeholder") as HTMLSelectElement;
    const organizerFilterContainer = document.getElementById("organizer-filter-container") as HTMLDivElement;

    const rect = organizerPlaceholder.getBoundingClientRect();
    organizerFilterContainer.style.top = `${rect.bottom + window.scrollY}px`;
    organizerFilterContainer.style.right = `${document.documentElement.clientWidth - rect.right + window.scrollX}px`;
}

// Robust device detection (unchanged)
const isTouchDevice = () => {
    return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
};

const isMobileUserAgent = () => {
    const ua = navigator.userAgent.toLowerCase();
    return /mobile|android|iphone|ipad|tablet/i.test(ua);
};

const prefersCoarsePointer = () => {
    return window.matchMedia("(pointer: coarse)").matches;
};

const useDesktopBehavior = () => {
    const isWideScreen = window.innerWidth >= 768;
    const isFinePointer = window.matchMedia("(pointer: fine)").matches;
    const isNotTouch = !isTouchDevice();
    const isNotMobile = !isMobileUserAgent();
    return (isWideScreen && isFinePointer) ||
        (isWideScreen && isNotTouch) ||
        (isFinePointer && isNotMobile && !prefersCoarsePointer());
};

function setupMultiSelectToggle() {
    const organizerPlaceholder = document.getElementById("organizer-placeholder") as HTMLSelectElement;
    const organizerFilterContainer = document.getElementById("organizer-filter-container") as HTMLDivElement;
    const organizerFilter = document.getElementById("organizer-filter") as HTMLSelectElement;
    const organizerOptionAll = document.getElementById("organizer-option-all") as HTMLOptionElement;

    // Function to update placeholder text based on selected organizers
    function updatePlaceholder() {
        const selectedCount = organizerFilter.selectedOptions.length;
        organizerPlaceholder.options[0].textContent = selectedCount === 0
            ? 'kaikki'
            : selectedCount === 1
                ? organizerFilter.selectedOptions.item(0)?.value ?? ''
                : `${String(selectedCount)} järjestäjää`;
    }

    function adjustDropdownBehavior() {
        // Always show the placeholder
        organizerPlaceholder.style.display = "inline-block";

        if (useDesktopBehavior()) {
            organizerFilterContainer.classList.add("hidden");
            organizerFilter.setAttribute('size', '20');

            organizerPlaceholder.removeEventListener("mousedown", showDropdown);
            organizerPlaceholder.addEventListener("mousedown", showDropdown);

            organizerFilter.removeEventListener("mousedown", handleDesktopToggle);
            organizerFilter.addEventListener("mousedown", handleDesktopToggle);

            organizerFilter.removeEventListener("change", updatePlaceholder);
            organizerFilter.addEventListener("change", updatePlaceholder);

            document.removeEventListener("click", closeDropdownOutside);
            document.addEventListener("click", closeDropdownOutside);
        } else {
            organizerFilterContainer.classList.remove("hidden");
            organizerFilterContainer.style.position = "static";
            organizerFilter.setAttribute('size', '1');
            organizerFilter.classList.add('mobile');

            // The all option can be implemented only on desktop
            organizerOptionAll.remove();

            // Remove desktop-specific event listeners
            organizerPlaceholder.removeEventListener("mousedown", showDropdown);
            organizerFilter.removeEventListener("mousedown", handleDesktopToggle);
            document.removeEventListener("click", closeDropdownOutside);

            // Use click to trigger native select behavior
            organizerPlaceholder.removeEventListener("click", triggerNativeSelect);
            organizerPlaceholder.addEventListener("click", triggerNativeSelect);

            organizerFilter.removeEventListener("change", updatePlaceholder);
            organizerFilter.addEventListener("change", updatePlaceholder);
        }
        positionFilterContainer();
        updatePlaceholder(); // Initial update
    }

    function showDropdown(event: Event) {
        event.preventDefault();
        organizerFilterContainer.classList.remove("hidden"); // Fade in
        organizerFilterContainer.style.position = "fixed";
        positionFilterContainer();
    }

    function closeDropdownOutside(event: Event) {
        if (!organizerFilterContainer.contains(event.target as Node) && event.target !== organizerPlaceholder) {
            organizerFilterContainer.classList.add("hidden"); // Fade out
        }
    }

    function handleDesktopToggle(event: Event) {
        const organizerOption = event.target as HTMLOptionElement;
        if (organizerOption.tagName !== 'OPTION') return;

        event.preventDefault();

        if (organizerOption === organizerOptionAll) {
            for (const selectedOption of Array.from(organizerFilter.selectedOptions))
                selectedOption.selected = false;
            organizerOptionAll.selected = true;
        } else {
            organizerOption.selected = !activeFilters?.organizerFilter?.has(organizerOption.value);
            organizerOptionAll.selected = false;
        }

        organizerFilter.dispatchEvent(new Event("change", { bubbles: true }));
        organizerFilter.focus();

        organizerFilterContainer.classList.add("hidden");
    }

    function triggerNativeSelect(event: Event) {
        event.preventDefault();
        organizerFilter.focus();
        const clickEvent = new Event("click", { bubbles: true, cancelable: true });
        organizerFilter.dispatchEvent(clickEvent);
    }

    // Initial setup
    adjustDropdownBehavior();

    // Re-evaluate on resize or orientation change
    window.addEventListener("resize", adjustDropdownBehavior);
    window.addEventListener("orientationchange", adjustDropdownBehavior);

    // Optional: Detect native dialog behavior
    let initialHeight = organizerFilter.offsetHeight;
    organizerFilter.addEventListener("click", () => {
        requestAnimationFrame(() => {
            const newHeight = organizerFilter.offsetHeight;
            if (newHeight !== initialHeight && !useDesktopBehavior()) {
                organizerFilter.setAttribute('size', '1');
                organizerFilterContainer.style.position = "static";
            }
        });
    });
}

function populateFilters(events: { event: OrienteeringEvent }[]) {
    const organizerFilterSelectElement = document.getElementById("organizer-filter") as HTMLSelectElement;

    // Create a map to count events per organizer
    const organizerEventCount = new Map<string, number>();
    events.forEach(({ event }) => {
        organizerEventCount.set(
            event.organizerName,
            (organizerEventCount.get(event.organizerName) || 0) + 1
        );
    });

    // Get unique organizers and sort them alphabetically
    const organizers = Array.from(organizerEventCount.keys()).sort((a, b) =>
        a.localeCompare(b, 'fi-FI') // Use Finnish locale for sorting
    );

    const desktop = useDesktopBehavior();
    // Populate the select element with sorted organizers and event counts
    organizers.forEach(org => {
        const option = document.createElement("option");
        option.value = org;
        const eventCount = organizerEventCount.get(org) || 0;
        option.textContent = `${org} (${eventCount ? (eventCount + (desktop ? ' tapahtumaa' : '')) : 'ei tapahtumia'})`;
        organizerFilterSelectElement.appendChild(option);
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
    const modal = document.getElementById("event-modal") as HTMLElement;
    const modalDetails = document.getElementById("modal-details") as HTMLElement;
    const closeModal = document.querySelector(".close-modal") as HTMLElement;

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
            (filters.dateFilter === 'all' ||
                (filters.dateFilter === 'past' && event.startDateTime < Date.now()) ||
                (filters.dateFilter === 'future' && event.startDateTime > Date.now() - 24 * 60 * 60 * 1000)
            ) &&
            (!filters.nameFilter || event.name.toLowerCase().includes(filters.nameFilter)) &&
            (!filters.organizerFilter || filters.organizerFilter.has(event.organizerName))
        );
    }).forEach(({ event }) => {
        const dayOfWeek = new Date(event.startDateTime)
            .toLocaleDateString('en-US', { weekday: 'long' })
            .toLowerCase();

        const row = document.createElement("tr");
        row.classList.add("event-row");
        row.classList.add(dayOfWeek);

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

        // Add click event to show modal
        row.addEventListener("click", () => {
            // Clear previous modal content
            modalDetails.innerHTML = '';

            // Create event details content
            const expandedContent = document.createElement("div");

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

            modalDetails.appendChild(expandedContent);

            // Show the modal
            modal.style.display = "block";
        });

        previousStartDateTime = event.startDateTime;
    });

    // Close modal when clicking the close button
    closeModal.onclick = () => {
        modal.style.display = "none";
    };

    // Close modal when clicking outside of it
    window.onclick = (event) => {
        if (event.target === modal) {
            modal.style.display = "none";
        }
    };
}

function observeTableChanges() {
    const tbody = document.querySelector(".event-table tbody")!;
    const observer = new MutationObserver(() => {
        positionFilterContainer();
    });
    observer.observe(tbody, { childList: true, subtree: true });
}

async function registerServiceWorker(): Promise<void> {
    if ('serviceWorker' in navigator) {
        try {
            // Cache name with UUID placeholder (replaced at build time)
            const registration = await navigator.serviceWorker.register(`service-worker.js`, {
                scope: `./`
            });
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                if (newWorker) {
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            newWorker.postMessage({ action: 'skipWaiting' });
                        }
                    });
                }
            });
            console.log('Service Worker registered with scope:', registration.scope);
        } catch (error) {
            console.error('Service Worker registration failed:', error);
        }
    } else {
        console.warn('Service Workers not supported in this browser');
    }
}

// Initialize the application
async function initialize(): Promise<void> {
    try {
        await registerServiceWorker();
        observeTableChanges();
        await loadData();
    } catch (error) {
        console.error("Error initializing:", error);
        const contentDiv = document.getElementById("content")!;
        contentDiv.innerText = "Failed to initialize application.";
    }
}

document.addEventListener("DOMContentLoaded", initialize);