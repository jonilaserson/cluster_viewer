// features.js - Application features and functionality

// Features module
const FeaturesModule = {
    // Initialize features
    init() {
        // Set up keyboard event listeners
        this.setupKeyboardNavigation();
        console.log('Features module initialized');
    },

    // Set up keyboard navigation
    setupKeyboardNavigation() {
        // Modal navigation
        document.addEventListener('keydown', (event) => {
            if (UIModule.elements.modal.style.display === 'block') {
                switch(event.key) {
                    case 'ArrowLeft':
                        this.navigateModalImage(-1);
                        event.preventDefault();
                        event.stopPropagation();
                        return false;
                    case 'ArrowRight':
                        this.navigateModalImage(1);
                        event.preventDefault();
                        event.stopPropagation();
                        return false;
                    case 'Escape':
                        UIModule.elements.modal.style.display = 'none';
                        event.preventDefault();
                        event.stopPropagation();
                        return false;
                }
            }
        }, true);

        // Cluster navigation
        document.addEventListener('keydown', (event) => {
            // Only handle keyboard navigation when in zoom-in mode AND modal is not open
            if (DataModule.state.selectedClusterId !== null && UIModule.elements.modal.style.display !== 'block') {
                switch(event.key) {
                    case 'ArrowLeft':
                        // Navigate to previous cluster
                        this.navigateToAdjacentCluster(-1);
                        event.preventDefault();
                        break;
                    case 'ArrowRight':
                        // Navigate to next cluster
                        this.navigateToAdjacentCluster(1);
                        event.preventDefault();
                        break;
                    case 'Escape':
                        // Exit zoom-in mode
                        DataModule.state.selectedClusterId = null;
                        DataModule.state.selectedClusterIndex = -1;
                        UIModule.displayCurrentPage();
                        // Remove keyboard hint if it exists
                        const hint = document.querySelector('.keyboard-hint');
                        if (hint) hint.remove();
                        event.preventDefault();
                        break;
                }
            }
        });
    },

    // Navigation functions
    showPreviousPage() {
        if (DataModule.state.currentPage > 0) {
            DataModule.state.currentPage--;
            UIModule.displayCurrentPage();
        }
    },

    showNextPage() {
        const totalPages = DataModule.getTotalPages();
        if (DataModule.state.currentPage < totalPages - 1) {
            DataModule.state.currentPage++;
            UIModule.displayCurrentPage();
        }
    },

    // Navigate to adjacent cluster (prev/next)
    navigateToAdjacentCluster(direction) {
        // Determine which clusters to display (filtered or all)
        const clustersToDisplay = DataModule.getAllClusters();

        // Calculate new index
        const newIndex = DataModule.getSelectedClusterIndex() + direction;

        // Check if the new index is valid
        if (newIndex >= 0 && newIndex < clustersToDisplay.length) {
            // Update selected cluster
            DataModule.state.selectedClusterId = clustersToDisplay[newIndex].id;
            DataModule.state.selectedClusterIndex = newIndex;
            UIModule.displayCurrentPage();
        }
    },

    // Navigate between images in the modal
    navigateModalImage(direction) {
        if (DataModule.state.currentClusterImages.length === 0) return;

        DataModule.state.currentImageIndex = (DataModule.state.currentImageIndex + direction + DataModule.state.currentClusterImages.length) % DataModule.state.currentClusterImages.length;
        const newImage = DataModule.state.currentClusterImages[DataModule.state.currentImageIndex];

        UIModule.elements.modalImg.src = newImage.src;
        UIModule.elements.modalCaption.textContent = newImage.dataset.fullPath;
    },

    // Function to apply query and highlight matching images
    applyQuery() {
        const queryString = UIModule.elements.queryInput.value.trim();
        if (!queryString) {
            this.clearQuery();
            return;
        }

        DataModule.state.currentQuery = queryString;

        // Clear previous highlights
        UIModule.clearQueryHighlights();

        try {
            // Apply query to ALL images in all clusters, not just visible ones
            let totalMatchCount = 0;

            // Process each cluster's images
            DataModule.state.allClusters.forEach(cluster => {
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
            UIModule.elements.queryMatchCountElement.textContent = `${totalMatchCount} matches`;
            UIModule.elements.queryMatchCountElement.style.display = totalMatchCount > 0 ? 'inline-block' : 'none';

            // Redisplay the current page to apply the highlighting
            UIModule.displayCurrentPage();

        } catch (error) {
            console.error('Query error:', error);
            UIModule.elements.queryMatchCountElement.textContent = `Error: ${error.message}`;
            UIModule.elements.queryMatchCountElement.style.display = 'inline-block';
        }
    },

    // Function to clear query
    clearQuery() {
        DataModule.state.currentQuery = null;
        UIModule.elements.queryInput.value = '';
        UIModule.clearQueryHighlights();

        // Remove match counts from cluster headers
        const matchCountElements = document.querySelectorAll('.query-match-count');
        matchCountElements.forEach(el => el.remove());

        // Hide the match count label
        UIModule.elements.queryMatchCountElement.style.display = 'none';
        UIModule.elements.queryMatchCountElement.textContent = '';

        // Clear the matchesQuery flag from all images
        DataModule.state.allClusters.forEach(cluster => {
            cluster.paths.forEach(imageObj => {
                imageObj.matchesQuery = false;
            });
        });

        // Reset filtering if active
        if (DataModule.state.isFilteringClusters) {
            DataModule.state.isFilteringClusters = false;
            DataModule.state.currentPage = 0;
            UIModule.displayCurrentPage();
        }
    },

    // Function to filter clusters based on query matches
    filterClusters() {
        const queryString = UIModule.elements.queryInput.value.trim();
        if (!queryString) {
            alert('Please enter a query first');
            return;
        }

        // Make sure the query is applied first
        if (!DataModule.state.currentQuery || DataModule.state.currentQuery !== queryString) {
            this.applyQuery();
        }

        // Filter clusters that have at least one image matching the query
        DataModule.state.filteredClusters = DataModule.state.allClusters.filter(cluster => {
            return cluster.paths.some(imageObj => imageObj.matchesQuery === true);
        });

        if (DataModule.state.filteredClusters.length === 0) {
            alert('No clusters match the query');
            return;
        }

        // Set filtering mode
        DataModule.state.isFilteringClusters = true;

        // Reset to first page and display filtered clusters
        DataModule.state.currentPage = 0;
        UIModule.displayCurrentPage();

        // Update button appearance to show active state
        UIModule.elements.filterClustersBtn.style.backgroundColor = '#4CAF50';
        UIModule.elements.filterClustersBtn.textContent = 'Filtering Active';

        // Add a clear filter button next to the filter button if it doesn't exist
        if (!document.getElementById('clearFilterBtn')) {
            const clearFilterBtn = document.createElement('button');
            clearFilterBtn.id = 'clearFilterBtn';
            clearFilterBtn.textContent = 'Clear Filter';
            clearFilterBtn.style.marginLeft = '5px';
            clearFilterBtn.addEventListener('click', () => {
                DataModule.state.isFilteringClusters = false;
                UIModule.elements.filterClustersBtn.style.backgroundColor = '';
                UIModule.elements.filterClustersBtn.textContent = 'Filter Clusters';
                clearFilterBtn.remove();
                DataModule.state.currentPage = 0;
                UIModule.displayCurrentPage();
            });
            UIModule.elements.filterClustersBtn.parentNode.insertBefore(clearFilterBtn, UIModule.elements.filterClustersBtn.nextSibling);
        }
    },

    // Function to update the button states based on checkbox selection
    updateButtonStates() {
        const selectedCheckboxes = document.querySelectorAll('.image-checkbox:checked');
        const verifyBtn = document.getElementById('verifySelectedBtn');
        const markDuplicatesBtn = document.getElementById('markDuplicatesBtn');
        const clearDuplicatesBtn = document.getElementById('clearDuplicatesBtn');

        if (verifyBtn) {
            // Get the current cluster ID
            const currentClusterId = DataModule.state.selectedClusterId;

            // Check if the current cluster is already verified
            const isClusterVerified = currentClusterId !== null && DataModule.state.verifiedClusters.has(currentClusterId);

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
                const currentClusterId = DataModule.state.selectedClusterId;
                const duplicateGroups = DataModule.state.clusterDuplicateGroups.get(currentClusterId) || [];

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
            const currentClusterId = DataModule.state.selectedClusterId;
            const hasDuplicateGroups = DataModule.state.clusterDuplicateGroups.has(currentClusterId) &&
                                      DataModule.state.clusterDuplicateGroups.get(currentClusterId).length > 0;
            clearDuplicatesBtn.disabled = !hasDuplicateGroups;
        }
    },

    // Function to verify selected images
    verifySelectedImages(cluster) {
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
        const originalClusterIndex = DataModule.state.allClusters.findIndex(c => c.id === cluster.id);

        if (originalClusterIndex !== -1) {
            // Separate selected and non-selected images
            const selectedImages = [];
            const nonSelectedImages = [];

            cluster.paths.forEach(image => {
                if (selectedImagePaths.has(image.path)) {
                    // Add to selected images
                    selectedImages.push(image);
                    // Mark as verified
                    DataModule.state.imageVerificationStatus.set(image.path, true);
                } else {
                    // Add to non-selected images
                    nonSelectedImages.push(image);
                }
            });

            // Mark the original cluster as verified
            DataModule.state.verifiedClusters.add(cluster.id);

            // Update the original cluster with selected images
            DataModule.state.allClusters[originalClusterIndex].paths = selectedImages;

            // Only create a new cluster if there are non-selected images
            if (nonSelectedImages.length > 0) {
                // Create a new cluster with a new ID for the remaining images
                const newClusterId = `${DataModule.state.nextVerifiedClusterId++}`;

                const newCluster = {
                    id: newClusterId,
                    paths: nonSelectedImages,
                    parentClusterId: cluster.id // Track the relationship
                };

                // Insert the new cluster right after the original one
                DataModule.state.allClusters.splice(originalClusterIndex + 1, 0, newCluster);

                // If we're filtering clusters, check if we need to update the filtered list
                if (DataModule.state.isFilteringClusters) {
                    // If the original cluster is in the filtered list, add the new cluster too
                    const originalInFiltered = DataModule.state.filteredClusters.findIndex(c => c.id === cluster.id);
                    if (originalInFiltered !== -1) {
                        // Insert the new cluster right after the original one in the filtered list
                        DataModule.state.filteredClusters.splice(originalInFiltered + 1, 0, newCluster);
                    }
                }
            }
        }

        // Update UI
        UIModule.displayCurrentPage();

        // Automatically navigate to the next cluster if there is one
        this.navigateToAdjacentCluster(1);
    },

    // Function to unverify a cluster
    unverifyCluster(cluster) {
        // Remove the cluster from the verified clusters set
        DataModule.state.verifiedClusters.delete(cluster.id);

        // Update the UI
        UIModule.displayCurrentPage();
    },

    // Function to mark selected images as duplicates
    markSelectedAsDuplicates(cluster) {
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
        const duplicateGroups = DataModule.state.clusterDuplicateGroups.get(clusterId) || [];

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
        const colorIndex = (newGroupIndex - 1) % DataModule.state.duplicateGroupColors.length;
        const color = DataModule.state.duplicateGroupColors[colorIndex];

        const newGroup = {
            index: newGroupIndex,
            color: color,
            imagePaths: selectedImagePaths
        };

        // Add the new group to the cluster's duplicate groups
        duplicateGroups.push(newGroup);
        DataModule.state.clusterDuplicateGroups.set(clusterId, duplicateGroups);

        // Update the UI to show the duplicate tags
        UIModule.displayCurrentPage();
    },

    // Function to clear duplication marks
    clearDuplicationMarks(cluster) {
        const clusterId = cluster.id;

        // Remove all duplicate groups for this cluster
        DataModule.state.clusterDuplicateGroups.delete(clusterId);

        // Update the UI
        UIModule.displayCurrentPage();
    },

    // Function to export verified CSV
    handleExportCsv() {
        // Create CSV content with updated cluster assignments, verification status, and duplicate groups
        let csvContent = 'local_path,component,is_verified,duplicate_group,name,hashed_case_id,bucket,condition,image_source\n';

        // Process all images
        DataModule.state.allClusters.forEach(cluster => {
            const isClusterVerified = DataModule.state.verifiedClusters.has(cluster.id);
            const duplicateGroups = DataModule.state.clusterDuplicateGroups.get(cluster.id) || [];

            cluster.paths.forEach(image => {
                const originalPath = image.path;
                const component = cluster.id;
                // An image is verified if it's in a verified cluster
                const isVerified = isClusterVerified || DataModule.state.imageVerificationStatus.get(originalPath) ? 'true' : 'false';

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
        this.downloadCsv(csvContent, 'verified_clusters.csv');
    },

    // Helper function to download CSV
    downloadCsv(content, filename) {
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
};

// Export the module
window.FeaturesModule = FeaturesModule;