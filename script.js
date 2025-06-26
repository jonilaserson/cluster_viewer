// script.js - Main entry point for the cluster viewer application

// Global variables
let allClusters = [];
let currentPage = 0;
const clustersPerPage = 30; // Increased from 10 to 30 clusters per page
let selectedClusterId = null; // Track the currently selected cluster
let selectedClusterIndex = -1; // Track the index of the selected cluster
let isFilteringClusters = false; // Track whether we're filtering clusters
let filteredClusters = []; // Store filtered clusters

// Variables for verified clusters
let verifiedClusters = new Set(); // Set of verified cluster IDs
let nextVerifiedClusterId = 10000; // Start verified cluster IDs from a high number to avoid conflicts
let originalToVerifiedMap = new Map(); // Map from image path to verified cluster ID
let imageVerificationStatus = new Map(); // Map from image path to verification status

// Variables for duplicate groups
let clusterDuplicateGroups = new Map(); // Map from cluster ID to array of duplicate groups
let duplicateGroupColors = [
    '#4CAF50', // Green
    '#9C27B0', // Purple
    '#FFC107', // Yellow
    '#1565C0', // Dark Blue
    '#FF5722', // Deep Orange
    '#00BCD4', // Cyan
    '#8BC34A', // Light Green
    '#E91E63'  // Pink
]; // Colors for duplicate groups

// Store all available columns from CSV
let availableColumns = [];
let currentQuery = null;

// Variables for modal image navigation
let currentImageIndex = -1;
let currentClusterImages = [];

// DOM elements
let csvFileInput;
let pathPrefixInput;
let clustersContainer;
let statsSection;
let controlsSection;
let totalClustersElement;
let totalImagesElement;
let pageInfoElement;
let prevBtn;
let nextBtn;
let thumbnailSizeSlider;
let sizeValueDisplay;
let queryInput;
let applyQueryBtn;
let clearQueryBtn;
let filterClustersBtn;
let queryMatchCountElement;
let exportCsvBtn;
let modal;
let modalImg;
let modalCaption;
let closeBtn;
let modalPrevBtn;
let modalNextBtn;

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', init);

// Initialize the application
function init() {
    console.log('Initializing application');

    // Initialize DOM elements
    csvFileInput = document.getElementById('csvFile');
    pathPrefixInput = document.getElementById('pathPrefix');
    clustersContainer = document.getElementById('clustersContainer');
    statsSection = document.getElementById('statsSection');
    controlsSection = document.getElementById('controlsSection');
    totalClustersElement = document.getElementById('totalClusters');
    totalImagesElement = document.getElementById('totalImages');
    pageInfoElement = document.getElementById('pageInfo');
    prevBtn = document.getElementById('prevBtn');
    nextBtn = document.getElementById('nextBtn');
    thumbnailSizeSlider = document.getElementById('thumbnailSize');
    sizeValueDisplay = document.getElementById('sizeValue');
    queryInput = document.getElementById('queryInput');
    applyQueryBtn = document.getElementById('applyQueryBtn');
    clearQueryBtn = document.getElementById('clearQueryBtn');
    filterClustersBtn = document.getElementById('filterClustersBtn');
    queryMatchCountElement = document.getElementById('queryMatchCount');
    exportCsvBtn = document.getElementById('exportCsvBtn');

    // Create modal elements for image preview
    modal = document.createElement('div');
    modal.className = 'modal';

    modalImg = document.createElement('img');
    modalImg.className = 'modal-content';

    modalCaption = document.createElement('div');
    modalCaption.className = 'modal-caption';

    closeBtn = document.createElement('span');
    closeBtn.className = 'close';
    closeBtn.innerHTML = '&times;';
    closeBtn.onclick = () => modal.style.display = 'none';

    // Add navigation buttons
    modalPrevBtn = document.createElement('span');
    modalPrevBtn.className = 'modal-nav prev';
    modalPrevBtn.innerHTML = '&#10094;';
    modalPrevBtn.onclick = () => navigateModalImage(-1);

    modalNextBtn = document.createElement('span');
    modalNextBtn.className = 'modal-nav next';
    modalNextBtn.innerHTML = '&#10095;';
    modalNextBtn.onclick = () => navigateModalImage(1);

    // Assemble modal
    modal.appendChild(closeBtn);
    modal.appendChild(modalPrevBtn);
    modal.appendChild(modalNextBtn);
    modal.appendChild(modalImg);
    modal.appendChild(modalCaption);
    document.body.appendChild(modal);

    // Set up event listeners
    csvFileInput.addEventListener('change', handleFileUpload);
    prevBtn.addEventListener('click', showPreviousPage);
    nextBtn.addEventListener('click', showNextPage);
    thumbnailSizeSlider.addEventListener('input', updateThumbnailSize);
    applyQueryBtn.addEventListener('click', applyQuery);
    clearQueryBtn.addEventListener('click', clearQuery);
    filterClustersBtn.addEventListener('click', filterClusters);
    exportCsvBtn.addEventListener('click', handleExportCsv);
    queryInput.addEventListener('keyup', function(event) {
        if (event.key === 'Enter') {
            applyQuery();
        }
    });

    // Add keyboard event listener for modal navigation
    document.addEventListener('keydown', function(event) {
        if (modal.style.display === 'block') {
            switch(event.key) {
                case 'ArrowLeft':
                    navigateModalImage(-1);
                    event.preventDefault();
                    event.stopPropagation();
                    return false;
                case 'ArrowRight':
                    navigateModalImage(1);
                    event.preventDefault();
                    event.stopPropagation();
                    return false;
                case 'Escape':
                    modal.style.display = 'none';
                    event.preventDefault();
                    event.stopPropagation();
                    return false;
            }
        }
    }, true);

    // Add keyboard navigation for cluster browsing
    document.addEventListener('keydown', function(event) {
        // Only handle keyboard navigation when in zoom-in mode AND modal is not open
        if (selectedClusterId !== null && modal.style.display !== 'block') {
            switch(event.key) {
                case 'ArrowLeft':
                    // Navigate to previous cluster
                    navigateToAdjacentCluster(-1);
                    event.preventDefault();
                    break;
                case 'ArrowRight':
                    // Navigate to next cluster
                    navigateToAdjacentCluster(1);
                    event.preventDefault();
                    break;
                case 'Escape':
                    // Exit zoom-in mode
                    selectedClusterId = null;
                    selectedClusterIndex = -1;
                    displayCurrentPage();
                    // Remove keyboard hint if it exists
                    const hint = document.querySelector('.keyboard-hint');
                    if (hint) hint.remove();
                    event.preventDefault();
                    break;
            }
        }
    });

    console.log('Initialization complete');
}

// Handle file upload
function handleFileUpload() {
    const file = csvFileInput.files[0];
    if (!file) {
        alert('Please select a CSV file');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const csvData = e.target.result;
        const pathPrefix = pathPrefixInput.value.trim();
        console.log("Using path prefix:", pathPrefix || "None");
        processCSVData(csvData, pathPrefix);
    };
    reader.readAsText(file);
}

// Process CSV data
function processCSVData(csvData, pathPrefix = '') {
    // Parse CSV
    const lines = csvData.split('\n');
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

    // Store available columns
    availableColumns = headers;

    // Find column indices
    const pathIndex = headers.indexOf('local_path');
    const componentIndex = headers.indexOf('component');
    const conditionIndex = headers.indexOf('condition');
    const nameIndex = headers.indexOf('name');
    const hashedCaseIdIndex = headers.indexOf('hashed_case_id');
    const isVerifiedIndex = headers.indexOf('is_verified');

    if (pathIndex === -1 || componentIndex === -1) {
        alert('CSV must contain "local_path" and "component" columns');
        return;
    }

    // Group by component
    const clusterMap = new Map();
    let totalImages = 0;

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Handle CSV parsing with potential quoted fields
        let fields = parseCSVLine(line);

        if (fields.length <= Math.max(pathIndex, componentIndex)) continue;

        let path = fields[pathIndex].trim();
        const component = fields[componentIndex].trim();

        // Skip component with ID -1
        if (component === '-1') continue;

        // If a path prefix is provided, add it to the path
        // regardless of whether the path is absolute or not
        if (pathPrefix) {
            // Remove any trailing slash from prefix and leading slash from path to avoid double slashes
            const cleanPrefix = pathPrefix.endsWith('/') ? pathPrefix.slice(0, -1) : pathPrefix;
            const cleanPath = path.startsWith('/') ? path.slice(1) : path;
            path = `${cleanPrefix}/${cleanPath}`;
        }

        // Create image object with all available info
        const imageObj = {
            path: path, // This now includes the prefix if one was provided
            name: nameIndex !== -1 ? fields[nameIndex].trim() : extractFilename(path),
            condition: conditionIndex !== -1 ? fields[conditionIndex].trim() : null,
            hashedCaseId: hashedCaseIdIndex !== -1 ? fields[hashedCaseIdIndex].trim().substring(0, 5) : null
        };

        // Check if this image is verified
        if (isVerifiedIndex !== -1) {
            const isVerified = fields[isVerifiedIndex].trim().toLowerCase();
            imageObj.isVerified = (isVerified === 'true' || isVerified === '1' || isVerified === 'yes');
        }

        // Store all columns from CSV for query filtering
        headers.forEach((header, index) => {
            if (index < fields.length) {
                // Try to convert numeric values
                const value = fields[index].trim();
                if (!isNaN(value) && value !== '') {
                    imageObj[header] = parseFloat(value);
                } else {
                    imageObj[header] = value;
                }
            }
        });

        // Check if image.source exists but image_source doesn't
        if (!imageObj.hasOwnProperty('image_source') && imageObj.hasOwnProperty('image.source')) {
            // Use image.source as a fallback
            imageObj.image_source = imageObj['image.source'];
        }

        if (!clusterMap.has(component)) {
            clusterMap.set(component, []);
        }

        clusterMap.get(component).push(imageObj);
        totalImages++;
    }

    // Sort images within each cluster by hashed_case_id
    clusterMap.forEach((images, component) => {
        images.sort((a, b) => {
            if (a.hashedCaseId && b.hashedCaseId) {
                return a.hashedCaseId.localeCompare(b.hashedCaseId);
            } else if (a.hashedCaseId) {
                return -1; // a has ID, b doesn't
            } else if (b.hashedCaseId) {
                return 1;  // b has ID, a doesn't
            }
            return 0;      // neither has ID
        });
    });

    // Convert to array, filter out clusters with only 1 member, and sort by cluster size (descending)
    allClusters = Array.from(clusterMap.entries())
        .map(([id, paths]) => ({ id, paths }))
        .filter(cluster => cluster.paths.length > 1) // Filter out clusters with only 1 member
        .sort((a, b) => b.paths.length - a.paths.length);

    // Check for clusters where all images are verified
    if (isVerifiedIndex !== -1) {
        allClusters.forEach(cluster => {
            // Check if all images in this cluster are verified
            const allVerified = cluster.paths.every(image => image.isVerified === true);
            if (allVerified) {
                // Mark this cluster as verified
                verifiedClusters.add(cluster.id);
                console.log(`Cluster ${cluster.id} marked as verified because all images are verified`);
            }
        });
    }

    // Update stats
    totalClustersElement.textContent = `Total clusters: ${allClusters.length}`;
    totalImagesElement.textContent = `Total images: ${totalImages}`;

    // Show stats and controls
    statsSection.style.display = 'block';
    controlsSection.style.display = 'flex';

    // Reset to first page and display
    currentPage = 0;
    displayCurrentPage();
}

// Parse a CSV line handling quoted fields
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"' && (i === 0 || line[i-1] !== '\\')) {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }

    result.push(current);
    return result;
}

// Display current page of clusters
function displayCurrentPage() {
    console.log('displayCurrentPage called');
    console.log('selectedClusterId:', selectedClusterId);
    console.log('selectedClusterIndex:', selectedClusterIndex);

    // Clear container
    clustersContainer.innerHTML = '';

    // Get the current set of clusters
    const clustersToDisplay = isFilteringClusters ? filteredClusters : allClusters;
    console.log('clustersToDisplay length:', clustersToDisplay.length);

    // If a cluster is selected, only show that cluster
    if (selectedClusterId !== null) {
        console.log('Cluster is selected, showing zoom view');

        // Find the selected cluster and its index
        const selectedClusterIdx = clustersToDisplay.findIndex(cluster => cluster.id === selectedClusterId);
        console.log('Found selectedClusterIdx:', selectedClusterIdx);

        const selectedCluster = selectedClusterIdx >= 0 ? clustersToDisplay[selectedClusterIdx] : null;
        console.log('selectedCluster:', selectedCluster ? `ID: ${selectedCluster.id}` : 'null');

        if (selectedCluster) {
            // Add keyboard shortcut hint
            const keyboardHint = document.createElement('div');
            keyboardHint.className = 'keyboard-hint';
            keyboardHint.textContent = 'Keyboard shortcuts: ← Previous Cluster | → Next Cluster | ESC Back to All (Use page navigation buttons to navigate between clusters)';
            keyboardHint.style.opacity = '1';
            document.body.appendChild(keyboardHint);

            // Fade out the hint after 5 seconds
            setTimeout(() => {
                keyboardHint.style.transition = 'opacity 1s';
                keyboardHint.style.opacity = '0';
                setTimeout(() => {
                    keyboardHint.remove();
                }, 1000);
            }, 5000);

            // Display the selected cluster
            displayCluster(selectedCluster, true);

            // Update page info
            pageInfoElement.textContent = `Viewing Cluster ${selectedClusterId} (${selectedClusterIdx + 1} of ${clustersToDisplay.length})`;

            // Repurpose main navigation buttons for cluster navigation when in zoom-in mode
            prevBtn.disabled = selectedClusterIdx <= 0;
            nextBtn.disabled = selectedClusterIdx >= clustersToDisplay.length - 1;

            // Store original event listeners
            if (!prevBtn.hasAttribute('data-cluster-mode')) {
                // Mark buttons as being in cluster mode
                prevBtn.setAttribute('data-cluster-mode', 'true');
                nextBtn.setAttribute('data-cluster-mode', 'true');

                // Clone the buttons to remove existing event listeners
                const newPrevBtn = prevBtn.cloneNode(true);
                const newNextBtn = nextBtn.cloneNode(true);

                // Replace the original buttons with the clones
                prevBtn.parentNode.replaceChild(newPrevBtn, prevBtn);
                nextBtn.parentNode.replaceChild(newNextBtn, nextBtn);

                // Add cluster navigation event listeners to the new buttons
                document.querySelector('.nav-btn:first-child').addEventListener('click', () => navigateToAdjacentCluster(-1));
                document.querySelector('.nav-btn:last-child').addEventListener('click', () => navigateToAdjacentCluster(1));
            }

            // Apply the thumbnail size immediately to the zoomed view
            updateThumbnailSize();

            // Apply query highlights if there's an active query
            if (currentQuery) {
                applyHighlightsToVisibleImages();
            }

            return;
        }
    }

    // Calculate page bounds for normal view
    const startIdx = currentPage * clustersPerPage;
    const endIdx = Math.min(startIdx + clustersPerPage, clustersToDisplay.length);

    // Update page info with total cluster count
    const totalPages = Math.ceil(clustersToDisplay.length / clustersPerPage);
    const totalClusterCount = clustersToDisplay.length;

    if (isFilteringClusters) {
        pageInfoElement.textContent = `Page ${currentPage + 1} of ${totalPages} (${totalClusterCount} matching clusters)`;
    } else {
        pageInfoElement.textContent = `Page ${currentPage + 1} of ${totalPages} (${totalClusterCount} clusters)`;
    }

    // Enable/disable navigation buttons and restore original behavior
    prevBtn.disabled = currentPage === 0;
    nextBtn.disabled = currentPage >= totalPages - 1;

    // If we were in cluster mode before, restore original page navigation
    const navButtons = document.querySelectorAll('.nav-btn');
    if (navButtons.length > 0 && navButtons[0].hasAttribute('data-cluster-mode')) {
        // Clone the buttons to remove existing event listeners
        const newPrevBtn = navButtons[0].cloneNode(true);
        const newNextBtn = navButtons[1].cloneNode(true);

        // Remove cluster mode flag
        newPrevBtn.removeAttribute('data-cluster-mode');
        newNextBtn.removeAttribute('data-cluster-mode');

        // Replace the buttons
        navButtons[0].parentNode.replaceChild(newPrevBtn, navButtons[0]);
        navButtons[1].parentNode.replaceChild(newNextBtn, navButtons[1]);

        // Add page navigation event listeners
        newPrevBtn.addEventListener('click', showPreviousPage);
        newNextBtn.addEventListener('click', showNextPage);
    }

    // Display clusters
    for (let i = startIdx; i < endIdx; i++) {
        const cluster = clustersToDisplay[i];
        displayCluster(cluster, false);
    }

    // Apply query highlights if there's an active query
    if (currentQuery) {
        applyHighlightsToVisibleImages();
    }
}

// Display a single cluster
function displayCluster(cluster, isZoomedIn) {
    const clusterElement = document.createElement('div');
    clusterElement.className = isZoomedIn ? 'cluster zoomed-in' : 'cluster';
    clusterElement.dataset.clusterId = cluster.id;

    // Check if this is a verified cluster
    const isVerified = verifiedClusters.has(cluster.id);

    // Create cluster header
    const headerElement = document.createElement('div');
    headerElement.className = 'cluster-header';
    headerElement.style.display = 'flex';
    headerElement.style.justifyContent = 'space-between';
    headerElement.style.alignItems = 'center';

    // Apply verified styling if needed
    if (isVerified) {
        // Add verified-cluster class which applies the styling
        headerElement.classList.add('verified-cluster');

        // Add white text color for better contrast with the red background
        headerElement.style.color = 'white';
    }

    // Create title element
    const titleElement = document.createElement('h3');

    // Check if this is a remainder cluster
    const parentId = cluster.parentClusterId;

    // Create the title with appropriate indicators
    let titleHTML = `Cluster ${cluster.id} <span style="font-size: 0.8em; font-weight: normal;">[${cluster.paths.length} images]`;

    // Add remainder label if applicable
    if (parentId) {
        titleHTML += ` <span class="remainder-label">Remainder of Cluster ${parentId}</span>`;
    }

    // Close the span
    titleHTML += '</span>';

    titleElement.innerHTML = titleHTML;

    // Create a flex container for the title and controls
    const headerFlexContainer = document.createElement('div');
    headerFlexContainer.style.display = 'flex';
    headerFlexContainer.style.alignItems = 'center';
    headerFlexContainer.style.width = '100%';

    // Add title to the flex container
    headerFlexContainer.appendChild(titleElement);

    // Add the flex container to the header
    headerElement.appendChild(headerFlexContainer);

    if (!isZoomedIn) {
        // Make the entire header clickable to zoom in
        headerElement.style.cursor = 'pointer';
        headerElement.addEventListener('click', (event) => {
            console.log('Cluster header clicked:', cluster.id);

            // Update selectedClusterId
            selectedClusterId = cluster.id;
            console.log('Set selectedClusterId to:', selectedClusterId);

            // Find the index of the selected cluster
            const clustersToDisplay = isFilteringClusters ? filteredClusters : allClusters;
            selectedClusterIndex = clustersToDisplay.findIndex(c => c.id === cluster.id);
            console.log('Set selectedClusterIndex to:', selectedClusterIndex);

            // Prevent event bubbling
            event.stopPropagation();

            // Redisplay with the selected cluster
            displayCurrentPage();
            console.log('After displayCurrentPage, selectedClusterId:', selectedClusterId);
        });
    } else {
        // Create a container for all controls
        const controlsContainer = document.createElement('div');
        controlsContainer.className = 'cluster-controls-container';

        // Create action buttons group - FIRST (rightmost)
        const actionButtonsGroup = document.createElement('div');
        actionButtonsGroup.className = 'action-buttons-group';

        // Add mark as verified cluster button
        const verifySelectedBtn = document.createElement('button');
        verifySelectedBtn.innerHTML = '<i>✓</i> Mark as Verified';
        verifySelectedBtn.className = 'btn verify-selected-btn';
        verifySelectedBtn.id = 'verifySelectedBtn';
        verifySelectedBtn.disabled = true; // Initially disabled
        verifySelectedBtn.addEventListener('click', () => verifySelectedImages(cluster));
        actionButtonsGroup.appendChild(verifySelectedBtn);

        // Add mark as duplicates button
        const markDuplicatesBtn = document.createElement('button');
        markDuplicatesBtn.innerHTML = '<i>⊕</i> Mark as Duplicates';
        markDuplicatesBtn.className = 'btn mark-duplicates-btn';
        markDuplicatesBtn.id = 'markDuplicatesBtn';
        markDuplicatesBtn.disabled = true; // Initially disabled
        markDuplicatesBtn.addEventListener('click', () => markSelectedAsDuplicates(cluster));
        actionButtonsGroup.appendChild(markDuplicatesBtn);

        // Add reset duplicates button (renamed from "Clear Duplication Marks")
        const clearDuplicatesBtn = document.createElement('button');
        clearDuplicatesBtn.innerHTML = '<i>↺</i> Reset Duplicates';
        clearDuplicatesBtn.className = 'btn clear-duplicates-btn';
        clearDuplicatesBtn.id = 'clearDuplicatesBtn';
        // Only enable if there are duplicate groups in this cluster
        const hasDuplicateGroups = clusterDuplicateGroups.has(cluster.id) &&
                                   clusterDuplicateGroups.get(cluster.id).length > 0;
        clearDuplicatesBtn.disabled = !hasDuplicateGroups;
        clearDuplicatesBtn.addEventListener('click', () => clearDuplicationMarks(cluster));
        actionButtonsGroup.appendChild(clearDuplicatesBtn);

        // Add unverify button if the cluster is verified
        if (isVerified) {
            const unverifyBtn = document.createElement('button');
            unverifyBtn.innerHTML = '<i>↺</i> Unverify';
            unverifyBtn.className = 'btn unverify-btn';
            unverifyBtn.addEventListener('click', () => unverifyCluster(cluster));
            actionButtonsGroup.appendChild(unverifyBtn);
        }

        // Create selection controls group - SECOND from right to left
        const selectionGroup = document.createElement('div');
        selectionGroup.className = 'selection-controls-group';

        // Add select all checkbox
        const selectAllContainer = document.createElement('div');
        selectAllContainer.className = 'select-all-container';

        const selectAllCheckbox = document.createElement('input');
        selectAllCheckbox.type = 'checkbox';
        selectAllCheckbox.id = `select-all-${cluster.id}`;
        selectAllCheckbox.className = 'select-all-checkbox';

        const selectAllLabel = document.createElement('label');
        selectAllLabel.htmlFor = `select-all-${cluster.id}`;
        selectAllLabel.textContent = 'Select All';
        selectAllLabel.className = 'select-all-label';

        selectAllCheckbox.addEventListener('change', function() {
            const checkboxes = document.querySelectorAll('.image-checkbox');
            checkboxes.forEach(checkbox => {
                checkbox.checked = this.checked;
            });
            updateButtonStates();
        });

        selectAllContainer.appendChild(selectAllCheckbox);
        selectAllContainer.appendChild(selectAllLabel);
        selectionGroup.appendChild(selectAllContainer);

        // Create navigation group (back button) - THIRD (leftmost)
        const navigationGroup = document.createElement('div');
        navigationGroup.className = 'navigation-group';

        // Add back button with icon
        const backButton = document.createElement('button');
        backButton.innerHTML = '<i>←</i> Back to All Clusters';
        backButton.className = 'btn back-button';
        backButton.addEventListener('click', () => {
            selectedClusterId = null;
            selectedClusterIndex = -1;
            displayCurrentPage();
        });
        navigationGroup.appendChild(backButton);

        // Add elements to controls container in the correct order (from LEFT to RIGHT)
        controlsContainer.appendChild(actionButtonsGroup); // Reset duplicates, Mark as duplicates, Mark as verified (leftmost)
        controlsContainer.appendChild(selectionGroup);     // Select all (middle)
        controlsContainer.appendChild(navigationGroup);    // Back to all clusters (rightmost)

        // Add controls container to the flex container instead of directly to the header
        headerFlexContainer.appendChild(controlsContainer);
    }

    clusterElement.appendChild(headerElement);

    // Create images grid
    const imagesGrid = document.createElement('div');
    imagesGrid.className = 'images-grid custom-thumbnail-size';

    // Get current thumbnail size from slider
    const size = thumbnailSizeSlider.value;

    // Apply grid template columns directly
    if (!isZoomedIn) {
        imagesGrid.style.gridTemplateColumns = `repeat(auto-fill, minmax(${size}px, 1fr))`;
    } else {
        imagesGrid.style.display = 'flex';
        imagesGrid.style.flexWrap = 'wrap';
        imagesGrid.style.justifyContent = 'flex-start';
        imagesGrid.style.gap = '20px';
    }

    // Add images to grid (already sorted by hashed_case_id during CSV processing)
    cluster.paths.forEach(imageObj => {
        const imageContainer = document.createElement('div');
        imageContainer.className = 'image-container';

        // Store image data in the DOM element's dataset for query filtering
        imageContainer.dataset.imageData = JSON.stringify(imageObj);

        // Check if this image is part of a duplicate group
        const clusterId = cluster.id;
        const duplicateGroups = clusterDuplicateGroups.get(clusterId) || [];
        let duplicateGroup = null;

        for (const group of duplicateGroups) {
            if (group.imagePaths.includes(imageObj.path)) {
                duplicateGroup = group;
                break;
            }
        }

        // Create path label container to hold the image name, duplicate tag, and checkbox
        const pathLabelContainer = document.createElement('div');
        pathLabelContainer.className = 'image-path-container';
        pathLabelContainer.style.display = 'flex';
        pathLabelContainer.style.alignItems = 'center';
        pathLabelContainer.style.justifyContent = 'space-between'; // Space elements evenly
        pathLabelContainer.style.width = '100%';
        pathLabelContainer.style.marginBottom = isZoomedIn ? '5px' : '2px'; // Reduce spacing in main view

        // Create left section for image name
        const leftSection = document.createElement('div');
        leftSection.style.display = 'flex';
        leftSection.style.alignItems = 'center';
        leftSection.style.flexGrow = '1'; // Allow it to take available space

        // Create path label
        const pathLabel = document.createElement('div');
        pathLabel.className = 'image-path';
        pathLabel.textContent = imageObj.name; // Show name
        leftSection.appendChild(pathLabel);

        // In non-zoomed view, add duplicate tag right after the image name if applicable
        if (!isZoomedIn && duplicateGroup) {
            // Create duplicate tag
            const duplicateTag = document.createElement('div');
            duplicateTag.className = 'duplicate-tag';

            // For non-zoomed view, make the tag smaller but still visible
            duplicateTag.style.width = '10px';
            duplicateTag.style.height = '10px';
            duplicateTag.style.borderRadius = '50%'; // Make it a circle
            duplicateTag.style.display = 'inline-block';
            duplicateTag.style.marginLeft = '5px';
            duplicateTag.style.position = 'static';
            duplicateTag.style.backgroundColor = duplicateGroup.color;

            leftSection.appendChild(duplicateTag);

            // Store duplicate group info in the container's dataset
            imageContainer.dataset.duplicateGroup = duplicateGroup.index;
            imageContainer.dataset.duplicateGroupColor = duplicateGroup.color;
        }

        // Create right section for duplicate tag and checkbox
        const rightSection = document.createElement('div');
        rightSection.style.display = 'flex';
        rightSection.style.alignItems = 'center';
        rightSection.style.gap = '10px'; // Space between duplicate tag and checkbox

        // Add duplicate tag if applicable (only in zoomed-in view now)
        if (isZoomedIn && duplicateGroup) {
            // Create duplicate tag
            const duplicateTag = document.createElement('div');
            duplicateTag.className = 'duplicate-tag';
            duplicateTag.textContent = `duplicate ${duplicateGroup.index}`;
            duplicateTag.style.backgroundColor = duplicateGroup.color;

            // Override the absolute positioning from CSS
            duplicateTag.style.position = 'static';
            duplicateTag.style.top = 'auto';
            duplicateTag.style.right = 'auto';
            duplicateTag.style.margin = '0'; // Remove any margin
            rightSection.appendChild(duplicateTag);

            // Store duplicate group info in the container's dataset
            imageContainer.dataset.duplicateGroup = duplicateGroup.index;
            imageContainer.dataset.duplicateGroupColor = duplicateGroup.color;
        }

        // Create image element
        const img = document.createElement('img');
        // Use local path but extract just the filename for src
        const filename = extractFilename(imageObj.path);
        img.setAttribute('data-full-path', imageObj.path);
        // Don't encode the slashes in the path to preserve absolute paths
        // Replace encodeURIComponent with a custom encoding that preserves slashes
        const encodedPath = imageObj.path.split('/').map(segment => encodeURIComponent(segment)).join('/');
        img.src = `/images/${encodedPath}`;
        img.alt = `Image from cluster ${cluster.id}`;
        img.onerror = function() {
            this.src = 'data:image/svg+xml;charset=utf-8,%3Csvg xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22 viewBox%3D%220 0 100 100%22%3E%3Ctext x%3D%2250%25%22 y%3D%2250%25%22 dominant-baseline%3D%22middle%22 text-anchor%3D%22middle%22%3EImage Not Found%3C%2Ftext%3E%3C%2Fsvg%3E';
            this.style.background = '#f0f0f0';
        };

        // Apply size directly based on zoom state
        if (isZoomedIn) {
            const zoomedSize = 420;
            img.style.width = `${zoomedSize}px`;
            img.style.height = 'auto';
            img.style.maxWidth = '100%';
            img.style.objectFit = 'contain';
            imageContainer.style.width = `${zoomedSize}px`;
            imageContainer.style.maxWidth = `${zoomedSize}px`;
        } else {
            img.style.width = `${size}px`;
            img.style.height = `${size}px`;
            img.style.objectFit = 'cover';
        }

        // Add click event for image preview
        img.addEventListener('click', function() {
            // Set the current image and cluster for navigation
            currentClusterImages = Array.from(
                document.querySelectorAll(`.cluster[data-cluster-id="${cluster.id}"] img`)
            );
            currentImageIndex = currentClusterImages.indexOf(this);

            // Set the modal content
            modalImg.src = this.src;
            modalCaption.textContent = imageObj.path;
            modal.style.display = 'block';
        });

        // Store the full path for navigation
        img.dataset.fullPath = imageObj.path;

        // Create info container for additional details
        const infoContainer = document.createElement('div');
        infoContainer.className = 'image-info';
        infoContainer.style.fontSize = '10px';
        infoContainer.style.color = '#666';
        infoContainer.style.marginTop = isZoomedIn ? '3px' : '1px'; // Reduce spacing in main view

        // Add condition if available
        if (imageObj.condition) {
            const conditionSpan = document.createElement('span');
            conditionSpan.textContent = imageObj.condition;
            infoContainer.appendChild(conditionSpan);
        }

        // Add hashed case ID if available
        if (imageObj.hashedCaseId) {
            if (imageObj.condition) {
                infoContainer.appendChild(document.createTextNode(' | '));
            }
            const idSpan = document.createElement('span');

            idSpan.textContent = imageObj.hashedCaseId;
            idSpan.style.fontWeight = 'bold';
            infoContainer.appendChild(idSpan);
        }

        // Add image source if available
        if (imageObj.image_source) {
            // Add separator if there's previous content
            if (imageObj.condition || imageObj.hashedCaseId) {
                infoContainer.appendChild(document.createTextNode(' | '));
            }
            const sourceSpan = document.createElement('span');
            sourceSpan.textContent = imageObj.image_source;
            sourceSpan.style.fontStyle = 'italic';
            infoContainer.appendChild(sourceSpan);
        }

        imageContainer.appendChild(pathLabelContainer);
        imageContainer.appendChild(infoContainer);
        imageContainer.appendChild(img);

        // Create checkbox for image selection
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'image-checkbox';
        checkbox.dataset.imagePath = imageObj.path;

        // Make checkbox visible in zoom-in mode
        if (isZoomedIn) {
            checkbox.style.display = 'inline-block';
            checkbox.style.position = 'static'; // Override absolute positioning
            checkbox.style.width = '20px';
            checkbox.style.height = '20px';
            checkbox.style.zIndex = '10';
        }

        // Add checkbox to right section
        rightSection.appendChild(checkbox);

        // Assemble the layout
        pathLabelContainer.appendChild(leftSection);
        pathLabelContainer.appendChild(rightSection);

        // Add event listener to update the verify button state when checkboxes are clicked
        if (isZoomedIn) {
            checkbox.addEventListener('change', function(event) {
                const imagePath = this.dataset.imagePath;
                const isChecked = this.checked;

                // Find if this image is part of a duplicate group
                const clusterId = cluster.id;
                const duplicateGroups = clusterDuplicateGroups.get(clusterId) || [];
                let duplicateGroup = null;

                for (const group of duplicateGroups) {
                    if (group.imagePaths.includes(imagePath)) {
                        duplicateGroup = group;
                        break;
                    }
                }

                // If it's part of a duplicate group, select/deselect all images in that group
                if (duplicateGroup) {
                    // Find all checkboxes for images in this duplicate group
                    const allCheckboxes = document.querySelectorAll('.image-checkbox');
                    allCheckboxes.forEach(cb => {
                        if (duplicateGroup.imagePaths.includes(cb.dataset.imagePath)) {
                            cb.checked = isChecked;
                        }
                    });
                }

                // Update the verify and mark as duplicates buttons state
                updateButtonStates();
            });
        }

        // Note: We've already added the pathLabelContainer, infoContainer, and img to the imageContainer
        // The checkbox has already been added to the rightSection
        imagesGrid.appendChild(imageContainer);
    });

    clusterElement.appendChild(imagesGrid);
    clustersContainer.appendChild(clusterElement);
}

// Navigation functions
function showPreviousPage() {
    if (currentPage > 0) {
        currentPage--;
        displayCurrentPage();
    }
}

function showNextPage() {
    const totalPages = Math.ceil(allClusters.length / clustersPerPage);
    if (currentPage < totalPages - 1) {
        currentPage++;
        displayCurrentPage();
    }
}

// Helper function to extract filename from path
function extractFilename(path) {
    // Extract just the filename from the path
    const parts = path.split('/');
    return parts[parts.length - 1];
}

// Function to apply query and highlight matching images
function applyQuery() {
    const queryString = queryInput.value.trim();
    if (!queryString) {
        clearQuery();
        return;
    }

    currentQuery = queryString;

    // Clear previous highlights
    clearQueryHighlights();

    try {
        // Apply query to ALL images in all clusters, not just visible ones
        let totalMatchCount = 0;

        // Process each cluster's images
        allClusters.forEach(cluster => {
            cluster.paths.forEach(imageObj => {
                try {
                    // Use Function Constructor to evaluate the query
                    // Replace column names with imageData.column_name
                    let processedQuery = queryString;

                    // Get all column names from the image data
                    const columnNames = Object.keys(imageObj);

                    // Replace column names with d.column_name
                    columnNames.forEach(column => {
                        const regex = new RegExp(`\\b${column}\\b`, 'g');
                        processedQuery = processedQuery.replace(regex, `d.${column}`);
                    });

                    // Create and execute the function
                    const evalFunction = new Function('d', `return ${processedQuery}`);

                    // Store the match result in the image object for later use
                    imageObj.matchesQuery = evalFunction(imageObj);

                    if (imageObj.matchesQuery) {
                        totalMatchCount++;
                    }
                } catch (error) {
                    console.error('Error evaluating query for image:', error);
                }
            });
        });

        // Update the match count display
        queryMatchCountElement.textContent = `${totalMatchCount} matches`;
        queryMatchCountElement.style.display = totalMatchCount > 0 ? 'inline-block' : 'none';

        // Redisplay the current page to apply the highlighting
        // This is more reliable than trying to update the existing DOM elements
        displayCurrentPage();

    } catch (error) {
        console.error('Query error:', error);
        queryMatchCountElement.textContent = `Error: ${error.message}`;
        queryMatchCountElement.style.display = 'inline-block';
    }
}

// Function to apply highlights to currently visible images
function applyHighlightsToVisibleImages() {
    // Apply highlights to currently visible images
    const allImageContainers = document.querySelectorAll('.image-container');

    allImageContainers.forEach(container => {
        if (container.dataset.imageData) {
            const imageData = JSON.parse(container.dataset.imageData);

            if (imageData.matchesQuery) {
                container.classList.add('query-match');
            } else {
                container.classList.remove('query-match');
            }
        }
    });

    // Update cluster headers with match count
    updateClusterMatchCounts();
}

// Function to clear query highlights
function clearQuery() {
    currentQuery = null;
    queryInput.value = '';
    clearQueryHighlights();

    // Remove match counts from cluster headers
    const matchCountElements = document.querySelectorAll('.query-match-count');
    matchCountElements.forEach(el => el.remove());

    // Hide the match count label
    queryMatchCountElement.style.display = 'none';
    queryMatchCountElement.textContent = '';

    // Clear the matchesQuery flag from all images
    allClusters.forEach(cluster => {
        cluster.paths.forEach(imageObj => {
            imageObj.matchesQuery = false;
        });
    });

    // Reset filtering if active
    if (isFilteringClusters) {
        isFilteringClusters = false;
        currentPage = 0;
        displayCurrentPage();
    }
}

// Helper function to clear query highlights
function clearQueryHighlights() {
    const highlightedElements = document.querySelectorAll('.query-match');
    highlightedElements.forEach(el => {
        el.classList.remove('query-match');
    });
}

// Function to update cluster headers with match counts
function updateClusterMatchCounts() {
    const clusters = document.querySelectorAll('.cluster');

    clusters.forEach(cluster => {
        const matches = cluster.querySelectorAll('.query-match');
        if (matches.length > 0) {
            const headerElement = cluster.querySelector('.cluster-header h3');

            // Remove existing match count if any
            const existingCount = headerElement.querySelector('.query-match-count');
            if (existingCount) {
                existingCount.remove();
            }

            // Add new match count
            const matchCountElement = document.createElement('span');
            matchCountElement.className = 'query-match-count';
            matchCountElement.textContent = `${matches.length} matches`;
            headerElement.appendChild(matchCountElement);
        }
    });
}

// Function to update thumbnail size based on slider value
function updateThumbnailSize() {
    const size = thumbnailSizeSlider.value;
    sizeValueDisplay.textContent = `${size}px`;

    // Check if we're in zoomed-in view
    const isZoomedIn = selectedClusterId !== null;

    if (isZoomedIn) {
        // For zoomed-in view, use a larger size (420px)
        const zoomedSize = 420;

        // Update image sizes in zoomed-in view
        const zoomedImages = document.querySelectorAll('.zoomed-in .image-container img');
        zoomedImages.forEach(img => {
            img.style.width = `${zoomedSize}px`;
            img.style.height = 'auto';
            img.style.maxWidth = '100%';
            img.style.objectFit = 'contain';
        });

        // Update container sizes
        const zoomedContainers = document.querySelectorAll('.zoomed-in .image-container');
        zoomedContainers.forEach(container => {
            container.style.width = `${zoomedSize}px`;
            container.style.maxWidth = `${zoomedSize}px`;
        });

        // Update grid layout for zoomed-in view
        const zoomedGrids = document.querySelectorAll('.zoomed-in .images-grid');
        zoomedGrids.forEach(grid => {
            grid.style.display = 'flex';
            grid.style.flexWrap = 'wrap';
            grid.style.justifyContent = 'flex-start';
            grid.style.gap = '20px';
        });
    } else {
        // Update CSS for all image grids in normal view
        const imageGrids = document.querySelectorAll('.images-grid');
        imageGrids.forEach(grid => {
            grid.style.gridTemplateColumns = `repeat(auto-fill, minmax(${size}px, 1fr))`;
        });

        // Update image sizes in normal view
        const images = document.querySelectorAll('.image-container img');
        images.forEach(img => {
            img.style.width = `${size}px`;
            img.style.height = `${size}px`;
            img.style.objectFit = 'cover';
        });
    }
}

// Function to navigate to adjacent cluster (prev/next)
function navigateToAdjacentCluster(direction) {
    // Determine which clusters to display (filtered or all)
    const clustersToDisplay = isFilteringClusters ? filteredClusters : allClusters;

    // Calculate new index
    const newIndex = selectedClusterIndex + direction;

    // Check if the new index is valid
    if (newIndex >= 0 && newIndex < clustersToDisplay.length) {
        // Update selected cluster
        selectedClusterId = clustersToDisplay[newIndex].id;
        selectedClusterIndex = newIndex;
        displayCurrentPage();
    }
}

// Function to navigate between images in the modal
function navigateModalImage(direction) {
    if (currentClusterImages.length === 0) return;

    currentImageIndex = (currentImageIndex + direction + currentClusterImages.length) % currentClusterImages.length;
    const newImage = currentClusterImages[currentImageIndex];

    modalImg.src = newImage.src;
    modalCaption.textContent = newImage.dataset.fullPath;
}

// Function to update the button states based on checkbox selection
function updateButtonStates() {
    const selectedCheckboxes = document.querySelectorAll('.image-checkbox:checked');
    const verifyBtn = document.getElementById('verifySelectedBtn');
    const markDuplicatesBtn = document.getElementById('markDuplicatesBtn');
    const clearDuplicatesBtn = document.getElementById('clearDuplicatesBtn');

    if (verifyBtn) {
        // Get the current cluster ID
        const currentClusterId = selectedClusterId;

        // Check if the current cluster is already verified
        const isClusterVerified = currentClusterId !== null && verifiedClusters.has(currentClusterId);

        // Disable the verify button if the cluster is already verified, regardless of selection
        // Otherwise, disable it if fewer than 2 images are selected
        if (isClusterVerified) {
            verifyBtn.disabled = true;
        } else {
            verifyBtn.disabled = selectedCheckboxes.length < 2;
        }
    }

    if (markDuplicatesBtn) {
        // Enable the mark as duplicates button only if 2 or more images are selected
        // AND none of them are already in a duplicate group
        markDuplicatesBtn.disabled = selectedCheckboxes.length < 2;

        if (selectedCheckboxes.length >= 2) {
            // Check if any selected image is already in a duplicate group
            const currentClusterId = selectedClusterId;
            const duplicateGroups = clusterDuplicateGroups.get(currentClusterId) || [];

            for (const checkbox of selectedCheckboxes) {
                const imagePath = checkbox.dataset.imagePath;
                for (const group of duplicateGroups) {
                    if (group.imagePaths.includes(imagePath)) {
                        markDuplicatesBtn.disabled = true;
                        break;
                    }
                }
                if (markDuplicatesBtn.disabled) break;
            }
        }
    }

    if (clearDuplicatesBtn) {
        // Enable the clear duplicates button only if there are duplicate groups in this cluster
        const currentClusterId = selectedClusterId;
        const hasDuplicateGroups = clusterDuplicateGroups.has(currentClusterId) &&
                                   clusterDuplicateGroups.get(currentClusterId).length > 0;
        clearDuplicatesBtn.disabled = !hasDuplicateGroups;
    }
}

// For backward compatibility
function updateVerifyButtonState() {
    updateButtonStates();
}

// Function to verify selected images
function verifySelectedImages(cluster) {
    // Get all selected images in the current cluster
    const selectedCheckboxes = document.querySelectorAll('.image-checkbox:checked');

    if (selectedCheckboxes.length < 2) {
        return; // Button should be disabled anyway, but just in case
    }

    // Get the selected image paths
    const selectedImagePaths = new Set();
    selectedCheckboxes.forEach(checkbox => {
        const imagePath = checkbox.dataset.imagePath;
        selectedImagePaths.add(imagePath);
    });

    // Find the original cluster index
    const originalClusterIndex = allClusters.findIndex(c => c.id === cluster.id);

    if (originalClusterIndex !== -1) {
        // Separate selected and non-selected images
        const selectedImages = [];
        const nonSelectedImages = [];

        cluster.paths.forEach(image => {
            if (selectedImagePaths.has(image.path)) {
                // Add to selected images
                selectedImages.push(image);
                // Mark as verified
                imageVerificationStatus.set(image.path, true);
            } else {
                // Add to non-selected images
                nonSelectedImages.push(image);
            }
        });

        // Mark the original cluster as verified
        verifiedClusters.add(cluster.id);

        // Update the original cluster with selected images
        allClusters[originalClusterIndex].paths = selectedImages;

        // Only create a new cluster if there are non-selected images
        if (nonSelectedImages.length > 0) {
            // Create a new cluster with a new ID for the remaining images
            const newClusterId = `${nextVerifiedClusterId++}`;

            const newCluster = {
                id: newClusterId,
                paths: nonSelectedImages,
                parentClusterId: cluster.id // Track the relationship
            };

            // Insert the new cluster right after the original one
            allClusters.splice(originalClusterIndex + 1, 0, newCluster);

            // If we're filtering clusters, check if we need to update the filtered list
            if (isFilteringClusters) {
                // If the original cluster is in the filtered list, add the new cluster too
                const originalInFiltered = filteredClusters.findIndex(c => c.id === cluster.id);
                if (originalInFiltered !== -1) {
                    // Insert the new cluster right after the original one in the filtered list
                    filteredClusters.splice(originalInFiltered + 1, 0, newCluster);
                }
            }
        }
    }

    // Update UI
    displayCurrentPage();

    // Automatically navigate to the next cluster if there is one
    navigateToAdjacentCluster(1);
}

// Function to unverify a cluster
function unverifyCluster(cluster) {
    // Remove the cluster from the verified clusters set
    verifiedClusters.delete(cluster.id);

    // Update the UI
    displayCurrentPage();
}

// Function to mark selected images as duplicates
function markSelectedAsDuplicates(cluster) {
    // Get all selected images in the current cluster
    const selectedCheckboxes = document.querySelectorAll('.image-checkbox:checked');

    if (selectedCheckboxes.length < 2) {
        return; // Need at least 2 images to mark as duplicates
    }

    // Get the selected image paths
    const selectedImagePaths = [];
    selectedCheckboxes.forEach(checkbox => {
        const imagePath = checkbox.dataset.imagePath;
        selectedImagePaths.push(imagePath);
    });

    // Check if any of the selected images are already in a duplicate group
    const clusterId = cluster.id;
    const duplicateGroups = clusterDuplicateGroups.get(clusterId) || [];

    for (const path of selectedImagePaths) {
        for (const group of duplicateGroups) {
            if (group.imagePaths.includes(path)) {
                alert('One or more selected images are already in a duplicate group');
                return;
            }
        }
    }

    // Create a new duplicate group
    const newGroupIndex = duplicateGroups.length + 1;
    const colorIndex = (newGroupIndex - 1) % duplicateGroupColors.length;
    const color = duplicateGroupColors[colorIndex];

    const newGroup = {
        index: newGroupIndex,
        color: color,
        imagePaths: selectedImagePaths
    };

    // Add the new group to the cluster's duplicate groups
    duplicateGroups.push(newGroup);
    clusterDuplicateGroups.set(clusterId, duplicateGroups);

    // Update the UI to show the duplicate tags
    displayCurrentPage();
}

// Function to clear duplication marks
function clearDuplicationMarks(cluster) {
    const clusterId = cluster.id;

    // Remove all duplicate groups for this cluster
    clusterDuplicateGroups.delete(clusterId);

    // Update the UI
    displayCurrentPage();
}

// Function to export verified CSV
function handleExportCsv() {
    // Create CSV content with updated cluster assignments, verification status, and duplicate groups
    let csvContent = 'local_path,component,is_verified,duplicate_group,name,hashed_case_id,bucket,condition,image_source\n';

    // Process all images
    allClusters.forEach(cluster => {
        const isClusterVerified = verifiedClusters.has(cluster.id);
        const duplicateGroups = clusterDuplicateGroups.get(cluster.id) || [];

        cluster.paths.forEach(image => {
            const originalPath = image.path;
            const component = cluster.id;
            // An image is verified if it's in a verified cluster
            const isVerified = isClusterVerified || imageVerificationStatus.get(originalPath) ? 'true' : 'false';

            // Check if this image is part of a duplicate group
            let duplicateGroup = '';
            for (const group of duplicateGroups) {
                if (group.imagePaths.includes(originalPath)) {
                    duplicateGroup = `${cluster.id}_${group.index}`;
                    break;
                }
            }

            // Add the additional columns
            const name = image.name || '';
            const hashedCaseId = image.hashedCaseId || '';
            const bucket = image.bucket || '';
            const condition = image.condition || '';
            const imageSource = image.image_source || '';

            csvContent += `${originalPath},${component},${isVerified},${duplicateGroup},${name},${hashedCaseId},${bucket},${condition},${imageSource}\n`;
        });
    });

    // Create and download the CSV file
    downloadCsv(csvContent, 'verified_clusters.csv');
}

// Helper function to download CSV
function downloadCsv(content, filename) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Function to filter clusters based on query matches
function filterClusters() {
    const queryString = queryInput.value.trim();
    if (!queryString) {
        alert('Please enter a query first');
        return;
    }

    // Make sure the query is applied first
    if (!currentQuery || currentQuery !== queryString) {
        applyQuery();
    }

    // Filter clusters that have at least one image matching the query
    filteredClusters = allClusters.filter(cluster => {
        return cluster.paths.some(imageObj => imageObj.matchesQuery === true);
    });

    if (filteredClusters.length === 0) {
        alert('No clusters match the query');
        return;
    }

    // Set filtering mode
    isFilteringClusters = true;

    // Reset to first page and display filtered clusters
    currentPage = 0;
    displayCurrentPage();

    // Update button appearance to show active state
    filterClustersBtn.style.backgroundColor = '#4CAF50';
    filterClustersBtn.textContent = 'Filtering Active';

    // Add a clear filter button next to the filter button if it doesn't exist
    if (!document.getElementById('clearFilterBtn')) {
        const clearFilterBtn = document.createElement('button');
        clearFilterBtn.id = 'clearFilterBtn';
        clearFilterBtn.textContent = 'Clear Filter';
        clearFilterBtn.style.marginLeft = '5px';
        clearFilterBtn.addEventListener('click', () => {
            isFilteringClusters = false;
            filterClustersBtn.style.backgroundColor = '';
            filterClustersBtn.textContent = 'Filter Clusters';
            clearFilterBtn.remove();
            currentPage = 0;
            displayCurrentPage();
        });
        filterClustersBtn.parentNode.insertBefore(clearFilterBtn, filterClustersBtn.nextSibling);
    }
}