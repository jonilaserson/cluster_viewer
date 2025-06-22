// Global variables
let allClusters = [];
let currentPage = 0;
const clustersPerPage = 30; // Increased from 10 to 30 clusters per page
let selectedClusterId = null; // Track the currently selected cluster

// DOM elements
const csvFileInput = document.getElementById('csvFile');
const loadBtn = document.getElementById('loadBtn');
const clustersContainer = document.getElementById('clustersContainer');
const statsSection = document.getElementById('statsSection');
const controlsSection = document.getElementById('controlsSection');
const totalClustersElement = document.getElementById('totalClusters');
const totalImagesElement = document.getElementById('totalImages');
const pageInfoElement = document.getElementById('pageInfo');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const thumbnailSizeSlider = document.getElementById('thumbnailSize');
const sizeValueDisplay = document.getElementById('sizeValue');
const queryInput = document.getElementById('queryInput');
const applyQueryBtn = document.getElementById('applyQueryBtn');
const clearQueryBtn = document.getElementById('clearQueryBtn');
const queryMatchCountElement = document.getElementById('queryMatchCount');

// Store all available columns from CSV
let availableColumns = [];
let currentQuery = null;

// Event listeners
loadBtn.addEventListener('click', handleFileUpload);
prevBtn.addEventListener('click', showPreviousPage);
nextBtn.addEventListener('click', showNextPage);
thumbnailSizeSlider.addEventListener('input', updateThumbnailSize);
applyQueryBtn.addEventListener('click', applyQuery);
clearQueryBtn.addEventListener('click', clearQuery);
queryInput.addEventListener('keyup', function(event) {
    if (event.key === 'Enter') {
        applyQuery();
    }
});

// Create modal elements for image preview
const modal = document.createElement('div');
modal.className = 'modal';
const modalImg = document.createElement('img');
modalImg.className = 'modal-content';
const modalCaption = document.createElement('div');
modalCaption.className = 'modal-caption';
const closeBtn = document.createElement('span');
closeBtn.className = 'close';
closeBtn.innerHTML = '&times;';
closeBtn.onclick = () => modal.style.display = 'none';

modal.appendChild(closeBtn);
modal.appendChild(modalImg);
modal.appendChild(modalCaption);
document.body.appendChild(modal);

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
        processCSVData(csvData);
    };
    reader.readAsText(file);
}

// Process CSV data
function processCSVData(csvData) {
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

        const path = fields[pathIndex].trim();
        const component = fields[componentIndex].trim();

        // Skip component with ID -1
        if (component === '-1') continue;

        // Create image object with all available info
        const imageObj = {
            path: path,
            name: nameIndex !== -1 ? fields[nameIndex].trim() : extractFilename(path),
            condition: conditionIndex !== -1 ? fields[conditionIndex].trim() : null,
            hashedCaseId: hashedCaseIdIndex !== -1 ? fields[hashedCaseIdIndex].trim().substring(0, 5) : null
        };

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

    // Convert to array and sort by cluster size (descending)
    allClusters = Array.from(clusterMap.entries())
        .map(([id, paths]) => ({ id, paths }))
        .sort((a, b) => b.paths.length - a.paths.length);

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
    // Clear container
    clustersContainer.innerHTML = '';

    // If a cluster is selected, only show that cluster
    if (selectedClusterId !== null) {
        const selectedCluster = allClusters.find(cluster => cluster.id === selectedClusterId);
        if (selectedCluster) {
            // Add a back button
            const backButton = document.createElement('button');
            backButton.textContent = '← Back to All Clusters';
            backButton.className = 'back-button';
            backButton.style.marginBottom = '20px';
            backButton.addEventListener('click', () => {
                selectedClusterId = null;
                displayCurrentPage();
            });
            clustersContainer.appendChild(backButton);

            // Display the selected cluster
            displayCluster(selectedCluster, true);

            // Update page info
            pageInfoElement.textContent = `Viewing Cluster ${selectedClusterId}`;

            // Disable navigation buttons when viewing a single cluster
            prevBtn.disabled = true;
            nextBtn.disabled = true;

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
    const endIdx = Math.min(startIdx + clustersPerPage, allClusters.length);

    // Update page info
    const totalPages = Math.ceil(allClusters.length / clustersPerPage);
    pageInfoElement.textContent = `Page ${currentPage + 1} of ${totalPages}`;

    // Enable/disable navigation buttons
    prevBtn.disabled = currentPage === 0;
    nextBtn.disabled = currentPage >= totalPages - 1;

    // Display clusters
    for (let i = startIdx; i < endIdx; i++) {
        const cluster = allClusters[i];
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

    // Create cluster header
    const headerElement = document.createElement('div');
    headerElement.className = 'cluster-header';

    if (!isZoomedIn) {
        // Make the header clickable to zoom in
        headerElement.style.cursor = 'pointer';
        headerElement.addEventListener('click', () => {
            selectedClusterId = cluster.id;
            displayCurrentPage();
        });
    }

    headerElement.innerHTML = `
        <h3>Cluster ${cluster.id} <span style="font-size: 0.8em; font-weight: normal;">[${cluster.paths.length} images]</span></h3>
    `;
    clusterElement.appendChild(headerElement);

    // Create images grid
    const imagesGrid = document.createElement('div');
    imagesGrid.className = 'images-grid custom-thumbnail-size';

    // Add images to grid (already sorted by hashed_case_id during CSV processing)
    cluster.paths.forEach(imageObj => {
        const imageContainer = document.createElement('div');
        imageContainer.className = 'image-container';

        // Store image data in the DOM element's dataset for query filtering
        imageContainer.dataset.imageData = JSON.stringify(imageObj);

        // Create image element
        const img = document.createElement('img');
        // Use local path but extract just the filename for src
        const filename = extractFilename(imageObj.path);
        img.setAttribute('data-full-path', imageObj.path);
        img.src = `/images/${filename}`;
        img.alt = `Image from cluster ${cluster.id}`;
        img.onerror = function() {
            this.src = 'data:image/svg+xml;charset=utf-8,%3Csvg xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22 viewBox%3D%220 0 100 100%22%3E%3Ctext x%3D%2250%25%22 y%3D%2250%25%22 dominant-baseline%3D%22middle%22 text-anchor%3D%22middle%22%3EImage Not Found%3C%2Ftext%3E%3C%2Fsvg%3E';
            this.style.background = '#f0f0f0';
        };

        // Add click event for image preview
        img.addEventListener('click', function() {
            modalImg.src = this.src;
            modalCaption.textContent = imageObj.path;
            modal.style.display = 'block';
        });

        // Create path label
        const pathLabel = document.createElement('div');
        pathLabel.className = 'image-path';
        pathLabel.textContent = imageObj.name; // Show name

        // Create info container for additional details
        const infoContainer = document.createElement('div');
        infoContainer.className = 'image-info';
        infoContainer.style.fontSize = '10px';
        infoContainer.style.color = '#666';

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
            idSpan.textContent = `ID: ${imageObj.hashedCaseId}`;
            idSpan.style.fontWeight = 'bold';
            infoContainer.appendChild(idSpan);
        }

        imageContainer.appendChild(infoContainer);

        // Create checkbox for future feature
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'image-checkbox';

        // Add elements to container
        imageContainer.appendChild(img);
        imageContainer.appendChild(pathLabel);
        imageContainer.appendChild(checkbox);
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