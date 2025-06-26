// script.js - Main entry point for the cluster viewer application

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', init);

// Initialize the application
function init() {
    console.log('Initializing application');

    // Initialize modules
    DataModule.init();
    UIModule.init();
    FeaturesModule.init();

    // Set up event listeners
    setupEventListeners();

    console.log('Initialization complete');
}

// Set up event listeners
function setupEventListeners() {
    // File upload
    document.getElementById('csvFile').addEventListener('change', DataModule.handleFileUpload);

    // Navigation
    document.getElementById('prevBtn').addEventListener('click', FeaturesModule.showPreviousPage);
    document.getElementById('nextBtn').addEventListener('click', FeaturesModule.showNextPage);

    // Thumbnail size adjustment
    document.getElementById('thumbnailSize').addEventListener('input', UIModule.updateThumbnailSize.bind(UIModule));

    // Query controls
    document.getElementById('applyQueryBtn').addEventListener('click', FeaturesModule.applyQuery);
    document.getElementById('clearQueryBtn').addEventListener('click', FeaturesModule.clearQuery);
    document.getElementById('filterClustersBtn').addEventListener('click', FeaturesModule.filterClusters);

    // Export
    document.getElementById('exportCsvBtn').addEventListener('click', FeaturesModule.handleExportCsv);

    // Enter key for query
    document.getElementById('queryInput').addEventListener('keyup', function(event) {
        if (event.key === 'Enter') {
            FeaturesModule.applyQuery();
        }
    });
}