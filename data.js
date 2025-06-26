// data.js - Data processing and state management

// Data module
const DataModule = {
    // State variables
    state: {
        allClusters: [],
        currentPage: 0,
        clustersPerPage: 30,
        selectedClusterId: null,
        selectedClusterIndex: -1,
        isFilteringClusters: false,
        filteredClusters: [],
        verifiedClusters: new Set(),
        nextVerifiedClusterId: 10000,
        originalToVerifiedMap: new Map(),
        imageVerificationStatus: new Map(),
        clusterDuplicateGroups: new Map(),
        duplicateGroupColors: [
            '#4CAF50', // Green
            '#9C27B0', // Purple
            '#FFC107', // Yellow
            '#1565C0', // Dark Blue
            '#FF5722', // Deep Orange
            '#00BCD4', // Cyan
            '#8BC34A', // Light Green
            '#E91E63'  // Pink
        ],
        availableColumns: [],
        currentQuery: null,
        currentImageIndex: -1,
        currentClusterImages: []
    },

    // Initialize the data module
    init() {
        // Nothing to initialize for now
        console.log('Data module initialized');
    },

    // Handle file upload
    handleFileUpload() {
        const file = document.getElementById('csvFile').files[0];
        if (!file) {
            alert('Please select a CSV file');
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            const csvData = e.target.result;
            const pathPrefix = document.getElementById('pathPrefix').value.trim();
            console.log("Using path prefix:", pathPrefix || "None");
            DataModule.processCSVData(csvData, pathPrefix);
        };
        reader.readAsText(file);
    },

    // Process CSV data
    processCSVData(csvData, pathPrefix = '') {
        // Parse CSV
        const lines = csvData.split('\n');
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

        // Store available columns
        this.state.availableColumns = headers;

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
            let fields = this.parseCSVLine(line);

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
                name: nameIndex !== -1 ? fields[nameIndex].trim() : this.extractFilename(path),
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
        this.state.allClusters = Array.from(clusterMap.entries())
            .map(([id, paths]) => ({ id, paths }))
            .filter(cluster => cluster.paths.length > 1) // Filter out clusters with only 1 member
            .sort((a, b) => b.paths.length - a.paths.length);

        // Check for clusters where all images are verified
        if (isVerifiedIndex !== -1) {
            this.state.allClusters.forEach(cluster => {
                // Check if all images in this cluster are verified
                const allVerified = cluster.paths.every(image => image.isVerified === true);
                if (allVerified) {
                    // Mark this cluster as verified
                    this.state.verifiedClusters.add(cluster.id);
                    console.log(`Cluster ${cluster.id} marked as verified because all images are verified`);
                }
            });
        }

        // Update stats
        document.getElementById('totalClusters').textContent = `Total clusters: ${this.state.allClusters.length}`;
        document.getElementById('totalImages').textContent = `Total images: ${totalImages}`;

        // Show stats and controls
        document.getElementById('statsSection').style.display = 'block';
        document.getElementById('controlsSection').style.display = 'flex';

        // Reset to first page and display
        this.state.currentPage = 0;

        // Call UI module to display the current page
        UIModule.displayCurrentPage();
    },

    // Parse a CSV line handling quoted fields
    parseCSVLine(line) {
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
    },

    // Helper function to extract filename from path
    extractFilename(path) {
        // Extract just the filename from the path
        const parts = path.split('/');
        return parts[parts.length - 1];
    },

    // Get clusters for current page
    getClustersForCurrentPage() {
        const clustersToDisplay = this.state.isFilteringClusters ?
            this.state.filteredClusters : this.state.allClusters;

        const startIdx = this.state.currentPage * this.state.clustersPerPage;
        const endIdx = Math.min(startIdx + this.state.clustersPerPage, clustersToDisplay.length);

        return clustersToDisplay.slice(startIdx, endIdx);
    },

    // Get selected cluster
    getSelectedCluster() {
        if (this.state.selectedClusterId === null) return null;

        const clustersToDisplay = this.state.isFilteringClusters ?
            this.state.filteredClusters : this.state.allClusters;

        return clustersToDisplay.find(cluster => cluster.id === this.state.selectedClusterId);
    },

    // Get all clusters (filtered or not)
    getAllClusters() {
        return this.state.isFilteringClusters ? this.state.filteredClusters : this.state.allClusters;
    },

    // Get total number of pages
    getTotalPages() {
        const clustersToDisplay = this.state.isFilteringClusters ?
            this.state.filteredClusters : this.state.allClusters;
        return Math.ceil(clustersToDisplay.length / this.state.clustersPerPage);
    },

    // Get selected cluster index
    getSelectedClusterIndex() {
        if (this.state.selectedClusterId === null) return -1;

        const clustersToDisplay = this.state.isFilteringClusters ?
            this.state.filteredClusters : this.state.allClusters;

        return clustersToDisplay.findIndex(cluster => cluster.id === this.state.selectedClusterId);
    },

    // Check if a cluster is verified
    isClusterVerified(clusterId) {
        return this.state.verifiedClusters.has(clusterId);
    },

    // Get duplicate groups for a cluster
    getDuplicateGroups(clusterId) {
        return this.state.clusterDuplicateGroups.get(clusterId) || [];
    },

    // Check if an image is in a duplicate group
    getImageDuplicateGroup(clusterId, imagePath) {
        const duplicateGroups = this.state.clusterDuplicateGroups.get(clusterId) || [];

        for (const group of duplicateGroups) {
            if (group.imagePaths.includes(imagePath)) {
                return group;
            }
        }

        return null;
    }
};

// Export the module
window.DataModule = DataModule;