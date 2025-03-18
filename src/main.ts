import './style.css';
import { DateTime } from 'luxon';

// Define the base URL for fetching event data
const EVENTS_DATA_URL = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/data/events.json`;

// Interface for an orienteering event
interface OrienteeringEvent {
  uuid: string;
  startDateTime: number;
  endDateTime: number;
  name: string;
  organizerName: string;
  locationDescription: string;
  locationCoordinates: { lat: number; lon: number };
}

// Interface for filter settings
interface FilterSettings {
  dateFilter?: 'all' | 'past' | 'future';
  nameFilter?: string;
  organizerFilter?: Set<string>;
}

// Custom Element: EventRow
class EventRow extends HTMLElement {
  constructor(event: OrienteeringEvent, previousStartDateTime?: number, isOdd: boolean = false) {
    super();
    this.attachShadow({ mode: 'open' });
    this.render(event, previousStartDateTime, isOdd);
  }

  // Render the event row based on the template
  render(event: OrienteeringEvent, previousStartDateTime?: number, isOdd: boolean = false) {
    const template = document.getElementById('event-row-template') as HTMLTemplateElement;
    const clone = template.content.cloneNode(true) as DocumentFragment;

    const dayOfWeek = new Date(event.startDateTime)
      .toLocaleDateString('en-US', { weekday: 'long' })
      .toLowerCase();
    this.classList.add('event-row', dayOfWeek);
    this.classList.add(isOdd ? 'odd' : 'even');

    const dateCell = clone.querySelector('.date') as HTMLTableCellElement;
    dateCell.textContent = formatDateAndTime(event.startDateTime, previousStartDateTime);

    const eventCell = clone.querySelector('.event') as HTMLTableCellElement;
    eventCell.textContent = event.name.replace(/\s/g, ' ');

    const organizerCell = clone.querySelector('.organizer') as HTMLTableCellElement;
    organizerCell.textContent = event.organizerName;

    this.shadowRoot!.appendChild(clone);
    this.addEventListener('click', () => this.showModal(event));
  }

  // Show the event modal when the row is clicked
  showModal(event: OrienteeringEvent) {
    const modal = document.createElement('event-modal') as EventModal;
    modal.setEvent(event);
    document.body.appendChild(modal);
  }
}

// Custom Element: EventModal
class EventModal extends HTMLElement {
  private event!: OrienteeringEvent;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  setEvent(event: OrienteeringEvent) {
    this.event = event;
    this.render();
  }

  render() {
    const template = document.getElementById('event-modal-template') as HTMLTemplateElement;
    const clone = template.content.cloneNode(true) as DocumentFragment;

    const modalDetails = clone.querySelector('#modal-details') as HTMLDivElement;
    this.populateEventDetails(modalDetails);

    const closeModal = clone.querySelector('.close-modal') as HTMLSpanElement;
    closeModal.onclick = () => this.remove();

    this.shadowRoot!.appendChild(clone);
    this.style.display = 'block';

    window.onclick = e => {
      if (e.target === this) this.remove();
    };
  }

  private populateEventDetails(modalDetails: HTMLDivElement) {
    const eventTitle = modalDetails.querySelector('#event-title') as HTMLDivElement;
    const organizerText = modalDetails.querySelector('#organizer-text') as HTMLSpanElement;
    const locationSection = modalDetails.querySelector('.location-section') as HTMLDivElement;
    const locationText = modalDetails.querySelector('#location-text') as HTMLSpanElement;
    const mapLink = modalDetails.querySelector('#map-link') as HTMLAnchorElement;
    const durationText = modalDetails.querySelector('#duration-text') as HTMLDivElement;
    const eventLink = modalDetails.querySelector('#event-link') as HTMLAnchorElement;

    // Populate event title
    eventTitle.textContent = this.event.name;

    // Populate duration
    durationText.textContent = `${
      formatDateAndTime(this.event.startDateTime, undefined, true) //
    }–${
      formatDateAndTime(this.event.endDateTime, this.event.startDateTime, true) //
    }`;

    // Populate organizer
    organizerText.textContent = this.event.organizerName;

    // Populate location section
    if (this.event.locationDescription || this.event.locationCoordinates) {
      locationText.textContent = this.event.locationDescription || '';
      if (this.event.locationCoordinates) {
        const { northing, easting } = wgs84ToTm35fin(
          this.event.locationCoordinates.lat,
          this.event.locationCoordinates.lon,
        );
        mapLink.href = `https://asiointi.maanmittauslaitos.fi/karttapaikka/?lang=fi&share=customMarker&n=${northing.toFixed(2)}&e=${easting.toFixed(2)}&title=${encodeURIComponent(this.event.name)}&zoom=6&layers=W3siaWQiOjIsIm9wYWNpdHkiOjEwMH1d-z`;
      }
    } else {
      locationSection.style.display = 'none'; // Hide if no location data
    }

    // Populate event link
    eventLink.href = `https://www.rastilippu.fi/kuntorastit/tapahtuma/${this.event.uuid}`;
  }
}

// Register custom elements
customElements.define('event-row', EventRow);
customElements.define('event-modal', EventModal);

// Save filter settings to localStorage
function saveFilterSettings(filters: FilterSettings) {
  localStorage.setItem(
    'orienteeringEventFilters',
    JSON.stringify(filters, (key, value) =>
      key === 'organizerFilter' && value instanceof Set
        ? !value.has('kaikki')
          ? [...value]
          : undefined
        : value,
    ),
  );
}

// Load filter settings from localStorage
function loadFilterSettings(): FilterSettings {
  const stored = localStorage.getItem('orienteeringEventFilters');
  return stored
    ? JSON.parse(stored, (key, value) =>
        key === 'organizerFilter' && Array.isArray(value) ? new Set(value) : value,
      )
    : {};
}

// Generator function to manage filter settings and UI updates
async function* manageFilterSettings(): AsyncGenerator<FilterSettings> {
  const filters: FilterSettings = loadFilterSettings();

  // Initialize filter UI with stored values
  filters.dateFilter ??= 'future';
  const dateFilterElement = document.getElementById('date-filter') as HTMLSelectElement;
  dateFilterElement.value = filters.dateFilter;
  dateFilterElement.querySelector('option[value="unset"]')?.remove();

  if (filters.nameFilter) {
    (document.getElementById('name-filter') as HTMLInputElement).value = filters.nameFilter;
  }

  const organizerFilterElement = document.getElementById('organizer-filter') as HTMLSelectElement;
  if (filters.organizerFilter) {
    Array.from(organizerFilterElement.options).forEach(option => {
      option.selected = filters.organizerFilter!.has(option.value);
    });
    organizerFilterElement.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // Event handlers for filter changes
  let resolveFilterChange: (filters: FilterSettings) => void;
  dateFilterElement.onchange = e => {
    filters.dateFilter = (e.target as HTMLSelectElement).value as FilterSettings['dateFilter'];
    resolveFilterChange?.(filters);
  };
  document.getElementById('name-filter')!.oninput = e => {
    filters.nameFilter = (e.target as HTMLInputElement).value.toLowerCase().trim() || undefined;
    resolveFilterChange?.(filters);
  };
  organizerFilterElement.onchange = e => {
    const selectedOrganizers = new Set(
      Array.from((e.target as HTMLSelectElement).selectedOptions).map(opt => opt.value),
    );
    filters.organizerFilter =
      selectedOrganizers.size > 0 && !selectedOrganizers.has('kaikki')
        ? selectedOrganizers
        : undefined;
    resolveFilterChange?.(filters);
  };

  yield filters;

  // Continuously yield updated filters on change
  while (true) {
    yield new Promise<FilterSettings>(resolve => (resolveFilterChange = resolve)).then(
      updatedFilters => {
        saveFilterSettings(updatedFilters);
        return updatedFilters;
      },
    );
  }
}

// Load and display event data
async function loadAndDisplayEvents() {
  const contentDiv = document.getElementById('content')!;
  try {
    const response = await fetch(EVENTS_DATA_URL);
    if (!response.ok) throw new Error('Failed to fetch events data');
    let { events }: { events: { event: OrienteeringEvent }[] } = await response.json();

    // Filter events by known organizers if provided
    if ('knownOrganizers' in window) {
      const { knownOrganizers } = window as any;
      if (Array.isArray(knownOrganizers) && knownOrganizers.length > 0) {
        events = events.filter(({ event }) => knownOrganizers.includes(event.organizerName));
      } else {
        console.error('knownOrganizers should be a non-empty array of strings');
      }
    }

    populateOrganizerFilter(events);
    setupOrganizerMultiSelect();

    for await (const filters of manageFilterSettings()) {
      renderEvents(events, filters);
    }
  } catch (error) {
    console.error('Error loading events:', error);
    contentDiv.textContent = 'Failed to load event data.';
  }
}

// Position the organizer filter dropdown
function positionOrganizerFilter() {
  const placeholder = document.getElementById('organizer-placeholder') as HTMLSelectElement;
  const container = document.getElementById('organizer-filter-container') as HTMLDivElement;
  const rect = placeholder.getBoundingClientRect();
  container.style.top = `${rect.bottom + window.scrollY}px`;
  container.style.right = `${document.documentElement.clientWidth - rect.right + window.scrollX}px`;
}

// Device detection utilities
const isTouchDevice = () => 'ontouchstart' in window || navigator.maxTouchPoints > 0;
const isMobileUserAgent = () =>
  /mobile|android|iphone|ipad|tablet/i.test(navigator.userAgent.toLowerCase());
const prefersCoarsePointer = () => window.matchMedia('(pointer: coarse)').matches;
const useDesktopBehavior = () => {
  const isWideScreen = window.innerWidth >= 768;
  const isFinePointer = window.matchMedia('(pointer: fine)').matches;
  const isNotTouch = !isTouchDevice();
  const isNotMobile = !isMobileUserAgent();
  return (
    (isWideScreen && isFinePointer) ||
    (isWideScreen && isNotTouch) ||
    (isFinePointer && isNotMobile && !prefersCoarsePointer())
  );
};

// Setup the organizer multi-select dropdown behavior
function setupOrganizerMultiSelect() {
  const placeholder = document.getElementById('organizer-placeholder') as HTMLSelectElement;
  const container = document.getElementById('organizer-filter-container') as HTMLDivElement;
  const filter = document.getElementById('organizer-filter') as HTMLSelectElement;
  const allOption = document.getElementById('organizer-option-all') as HTMLOptionElement;

  const updatePlaceholderText = () => {
    const selectedCount = filter.selectedOptions.length;
    placeholder.options[0].textContent =
      selectedCount === 0
        ? 'kaikki'
        : selectedCount === 1
          ? filter.selectedOptions[0].value
          : `${selectedCount} järjestäjää`;
  };

  const adjustBehavior = () => {
    placeholder.style.display = 'inline-block';
    if (useDesktopBehavior()) {
      container.classList.add('hidden');
      filter.setAttribute('size', '20');
      placeholder.addEventListener('mousedown', showDropdown);
      filter.addEventListener('mousedown', handleDesktopToggle);
      filter.addEventListener('change', updatePlaceholderText);
      document.addEventListener('click', closeDropdownOutside);
    } else {
      container.classList.remove('hidden');
      container.style.position = 'static';
      filter.setAttribute('size', '1');
      filter.classList.add('mobile');
      allOption.remove();
      placeholder.addEventListener('click', triggerNativeSelect);
      filter.addEventListener('change', updatePlaceholderText);
    }
    positionOrganizerFilter();
    updatePlaceholderText();
  };

  const showDropdown = (e: Event) => {
    e.preventDefault();
    container.classList.remove('hidden');
    container.style.position = 'fixed';
    positionOrganizerFilter();
  };

  const closeDropdownOutside = (e: Event) => {
    if (!container.contains(e.target as Node) && e.target !== placeholder) {
      container.classList.add('hidden');
    }
  };

  const handleDesktopToggle = (e: Event) => {
    const option = e.target as HTMLOptionElement;
    if (option.tagName !== 'OPTION') return;
    e.preventDefault();
    if (option === allOption) {
      Array.from(filter.selectedOptions).forEach(opt => (opt.selected = false));
      allOption.selected = true;
    } else {
      option.selected = !option.selected;
      allOption.selected = false;
    }
    filter.dispatchEvent(new Event('change', { bubbles: true }));
    filter.focus();
    container.classList.add('hidden');
  };

  const triggerNativeSelect = (e: Event) => {
    e.preventDefault();
    filter.focus();
    filter.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }));
  };

  adjustBehavior();
  window.addEventListener('resize', adjustBehavior);
  window.addEventListener('orientationchange', adjustBehavior);
}

// Populate the organizer filter with unique organizers
function populateOrganizerFilter(events: { event: OrienteeringEvent }[]) {
  const filterElement = document.getElementById('organizer-filter') as HTMLSelectElement;
  const organizerCounts = new Map<string, number>();
  events.forEach(({ event }) =>
    organizerCounts.set(event.organizerName, (organizerCounts.get(event.organizerName) || 0) + 1),
  );

  const sortedOrganizers = Array.from(organizerCounts.keys()).sort((a, b) =>
    a.localeCompare(b, 'fi-FI'),
  );
  const isDesktop = useDesktopBehavior();

  sortedOrganizers.forEach(org => {
    const option = document.createElement('option');
    option.value = org;
    const count = organizerCounts.get(org) || 0;
    option.textContent = `${org} (${count}${isDesktop ? ' tapahtumaa' : ''})`;
    filterElement.appendChild(option);
  });
}

function formatDateAndTime(
  currentTimestamp: number,
  previousTimestamp?: number,
  modalQuirk = false,
): string {
  const currentDate = DateTime.fromMillis(currentTimestamp, { zone: 'UTC' });

  // If previousTimestamp matches currentTimestamp, return empty string
  if (currentTimestamp === previousTimestamp) return '';

  // Get date without time for comparison
  const getDateOnly = (timestamp: number) =>
    DateTime.fromMillis(timestamp, { zone: 'Europe/Helsinki' }).startOf('day').toMillis();

  // Determine if the date part should be shown (only if different from previous)
  const datePart =
    previousTimestamp === undefined ||
    getDateOnly(previousTimestamp) !== getDateOnly(currentTimestamp)
      ? `${currentDate.toFormat(`EEE${modalQuirk ? 'E' : ''} d.M.`, { locale: 'fi-FI' })} `
      : '';

  // Format the time part
  const timePart = currentDate.toFormat('H:mm').replace(/\s/g, '\u00A0');

  return `${datePart}${modalQuirk ? '' : 'klo\u00A0'}${timePart}`;
}

// Convert WGS84 coordinates to TM35FIN
function wgs84ToTm35fin(lat: number, lon: number): { northing: number; easting: number } {
  const a = 6378137.0; // WGS84 semi-major axis
  const f = 1 / 298.257222101; // WGS84 flattening
  const k0 = 0.9996; // TM35FIN scale factor
  const lon0 = 27; // Central meridian
  const falseEasting = 500000;
  const falseNorthing = 0;

  const e = Math.sqrt(2 * f - f * f);
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const phi = toRad(lat);
  const lambda = toRad(lon);
  const lambda0 = toRad(lon0);

  const N = a / Math.sqrt(1 - e * e * Math.sin(phi) * Math.sin(phi));
  const T = Math.tan(phi) * Math.tan(phi);
  const C = ((e * e) / (1 - e * e)) * Math.cos(phi) * Math.cos(phi);
  const A = Math.cos(phi) * (lambda - lambda0);

  const M =
    a *
    ((1 - (e * e) / 4 - (3 * e ** 4) / 64 - (5 * e ** 6) / 256) * phi -
      ((3 * e ** 2) / 8 + (3 * e ** 4) / 32 + (45 * e ** 6) / 1024) * Math.sin(2 * phi) +
      ((15 * e ** 4) / 256 + (45 * e ** 6) / 1024) * Math.sin(4 * phi) -
      ((35 * e ** 6) / 3072) * Math.sin(6 * phi));

  const easting =
    falseEasting +
    k0 *
      N *
      (A +
        ((1 - T + C) * Math.pow(A, 3)) / 6 +
        ((5 - 18 * T + T * T + 72 * C - (58 * (e * e)) / (1 - e * e)) * Math.pow(A, 5)) / 120);

  const northing =
    falseNorthing +
    k0 *
      (M +
        N *
          Math.tan(phi) *
          ((A * A) / 2 +
            ((5 - T + 9 * C + 4 * C * C) * Math.pow(A, 4)) / 24 +
            ((61 - 58 * T + T * T + 600 * C - (330 * (e * e)) / (1 - e * e)) * Math.pow(A, 6)) /
              720));

  return { northing, easting };
}

// Render filtered events into the table
function renderEvents(events: { event: OrienteeringEvent }[], filters: FilterSettings) {
  const tbody = document.querySelector('.event-table tbody') as HTMLTableSectionElement;
  tbody.innerHTML = ''; // Clear existing rows

  const currentYear = new Date().getFullYear();
  const yearStart = new Date(currentYear, 0).getTime();
  const nextYearStart = new Date(currentYear + 1, 0).getTime();

  let previousStartDateTime: number | undefined;

  const eventRows = events
    .filter(
      ({ event }) =>
        event.startDateTime >= yearStart &&
        event.endDateTime <= nextYearStart &&
        (filters.dateFilter === 'all' ||
          (filters.dateFilter === 'past' && event.startDateTime < Date.now()) ||
          (filters.dateFilter === 'future' &&
            event.startDateTime > Date.now() - 24 * 60 * 60 * 1000)) &&
        (!filters.nameFilter || event.name.toLowerCase().includes(filters.nameFilter)) &&
        (!filters.organizerFilter || filters.organizerFilter.has(event.organizerName)),
    )
    .map(({ event }, rowIndex) => {
      const isOdd = rowIndex % 2 === 0;
      const row = new EventRow(event, previousStartDateTime, isOdd);
      previousStartDateTime = event.startDateTime; // Update after creating the row
      return row;
    });

  // Append all rows to the tbody
  eventRows.forEach(row => tbody.appendChild(row));
}

// Initialize the application
async function initializeApp() {
  try {
    new MutationObserver(positionOrganizerFilter).observe(
      document.querySelector('.event-table tbody')!,
      { childList: true, subtree: true },
    );
    await loadAndDisplayEvents();
  } catch (error) {
    console.error('Initialization error:', error);
    document.getElementById('content')!.textContent = 'Failed to initialize application.';
  }
}

document.addEventListener('DOMContentLoaded', initializeApp);
