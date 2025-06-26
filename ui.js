// ui.js - UI components and rendering

// UI module
const UIModule = {
    // DOM element references
    elements: {
        clustersContainer: null,
        statsSection: null,
        controlsSection: null,
        totalClustersElement: null,
        totalImagesElement: null,
        pageInfoElement: null,
        prevBtn: null,
        nextBtn: null,
        thumbnailSizeSlider: null,
        sizeValueDisplay: null,
        queryMatchCountElement: null,
        modal: null,
        modalImg: null,
        modalCaption: null,
        closeBtn: null,
        modalPrevBtn: null,
        modalNextBtn: null
    },

    // Initialize UI components
    init() {
        // Initialize DOM element references
        this.initDOMElements();

        // Create modal for image preview
        this.createModal();

        console.log('UI module initialized');
    },

    // Initialize DOM element references
    initDOMElements() {
        this.elements.clustersContainer = document.getElementById('clustersContainer');
        this.elements.statsSection = document.getElementById('statsSection');
        this.elements.controlsSection = document.getElementById('controlsSection');
        this.elements.totalClustersElement = document.getElementById('totalClusters');
        this.elements.totalImagesElement = document.getElementById('totalImages');
        this.elements.pageInfoElement = document.getElementById('pageInfo');
        this.elements.prevBtn = document.getElementById('prevBtn');
        this.elements.nextBtn = document.getElementById('nextBtn');
        this.elements.thumbnailSizeSlider = document.getElementById('thumbnailSize');
        this.elements.sizeValueDisplay = document.getElementById('sizeValue');
        this.elements.queryInput = document.getElementById('queryInput');
        this.elements.applyQueryBtn = document.getElementById('applyQueryBtn');
        this.elements.clearQueryBtn = document.getElementById('clearQueryBtn');
        this.elements.filterClustersBtn = document.getElementById('filterClustersBtn');
        this.elements.queryMatchCountElement = document.getElementById('queryMatchCount');
        this.elements.exportCsvBtn = document.getElementById('exportCsvBtn');
    },

    // Create modal for image preview
    createModal() {
        // Create modal elements for image preview
        this.elements.modal = document.createElement('div');
        this.elements.modal.className = 'modal';

        this.elements.modalImg = document.createElement('img');
        this.elements.modalImg.className = 'modal-content';

        this.elements.modalCaption = document.createElement('div');
        this.elements.modalCaption.className = 'modal-caption';

        this.elements.closeBtn = document.createElement('span');
        this.elements.closeBtn.className = 'close';
        this.elements.closeBtn.innerHTML = '&times;';
        this.elements.closeBtn.onclick = () => this.elements.modal.style.display = 'none';

        // Add navigation buttons
        this.elements.modalPrevBtn = document.createElement('span');
        this.elements.modalPrevBtn.className = 'modal-nav prev';
        this.elements.modalPrevBtn.innerHTML = '&#10094;';
        this.elements.modalPrevBtn.onclick = () => FeaturesModule.navigateModalImage(-1);

        this.elements.modalNextBtn = document.createElement('span');
        this.elements.modalNextBtn.className = 'modal-nav next';
        this.elements.modalNextBtn.innerHTML = '&#10095;';
        this.elements.modalNextBtn.onclick = () => FeaturesModule.navigateModalImage(1);

        // Assemble modal
        this.elements.modal.appendChild(this.elements.closeBtn);
        this.elements.modal.appendChild(this.elements.modalPrevBtn);
        this.elements.modal.appendChild(this.elements.modalNextBtn);
        this.elements.modal.appendChild(this.elements.modalImg);
        this.elements.modal.appendChild(this.elements.modalCaption);
        document.body.appendChild(this.elements.modal);
    },

    // Display current page of clusters
    displayCurrentPage() {
        console.log('displayCurrentPage called');
        console.log('selectedClusterId:', DataModule.state.selectedClusterId);
        console.log('selectedClusterIndex:', DataModule.state.selectedClusterIndex);

        // Clear container
        this.elements.clustersContainer.innerHTML = '';

        // If a cluster is selected, only show that cluster
        if (DataModule.state.selectedClusterId !== null) {
            console.log('Cluster is selected, showing zoom view');

            // Find the selected cluster and its index
            const selectedClusterIdx = DataModule.getSelectedClusterIndex();
            console.log('Found selectedClusterIdx:', selectedClusterIdx);

            const selectedCluster = DataModule.getSelectedCluster();
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
                this.displayCluster(selectedCluster, true);

                // Update page info
                const clustersToDisplay = DataModule.getAllClusters();
                this.elements.pageInfoElement.textContent = `Viewing Cluster ${selectedCluster.id} (${selectedClusterIdx + 1} of ${clustersToDisplay.length})`;

                // Repurpose main navigation buttons for cluster navigation when in zoom-in mode
                this.elements.prevBtn.disabled = selectedClusterIdx <= 0;
                this.elements.nextBtn.disabled = selectedClusterIdx >= clustersToDisplay.length - 1;

                // Store original event listeners
                if (!this.elements.prevBtn.hasAttribute('data-cluster-mode')) {
                    // Mark buttons as being in cluster mode
                    this.elements.prevBtn.setAttribute('data-cluster-mode', 'true');
                    this.elements.nextBtn.setAttribute('data-cluster-mode', 'true');

                    // Clone the buttons to remove existing event listeners
                    const newPrevBtn = this.elements.prevBtn.cloneNode(true);
                    const newNextBtn = this.elements.nextBtn.cloneNode(true);

                    // Replace the original buttons with the clones
                    this.elements.prevBtn.parentNode.replaceChild(newPrevBtn, this.elements.prevBtn);
                    this.elements.nextBtn.parentNode.replaceChild(newNextBtn, this.elements.nextBtn);

                    // Update references
                    this.elements.prevBtn = newPrevBtn;
                    this.elements.nextBtn = newNextBtn;

                    // Add cluster navigation event listeners to the new buttons
                    this.elements.prevBtn.addEventListener('click', () => FeaturesModule.navigateToAdjacentCluster(-1));
                    this.elements.nextBtn.addEventListener('click', () => FeaturesModule.navigateToAdjacentCluster(1));
                }

                // Apply the thumbnail size immediately to the zoomed view
                this.updateThumbnailSize();

                // Apply query highlights if there's an active query
                if (DataModule.state.currentQuery) {
                    this.applyHighlightsToVisibleImages();
                }

                return;
            }
        }

        // Calculate page bounds for normal view
        const clustersToDisplay = DataModule.getClustersForCurrentPage();

        // Update page info with total cluster count
        const totalPages = DataModule.getTotalPages();
        const totalClusterCount = DataModule.getAllClusters().length;

        if (DataModule.state.isFilteringClusters) {
            this.elements.pageInfoElement.textContent = `Page ${DataModule.state.currentPage + 1} of ${totalPages} (${totalClusterCount} matching clusters)`;
        } else {
            this.elements.pageInfoElement.textContent = `Page ${DataModule.state.currentPage + 1} of ${totalPages} (${totalClusterCount} clusters)`;
        }

        // Enable/disable navigation buttons and restore original behavior
        this.elements.prevBtn.disabled = DataModule.state.currentPage === 0;
        this.elements.nextBtn.disabled = DataModule.state.currentPage >= totalPages - 1;

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

            // Update references
            this.elements.prevBtn = newPrevBtn;
            this.elements.nextBtn = newNextBtn;

            // Add page navigation event listeners
            this.elements.prevBtn.addEventListener('click', FeaturesModule.showPreviousPage);
            this.elements.nextBtn.addEventListener('click', FeaturesModule.showNextPage);
        }

        // Display clusters
        clustersToDisplay.forEach(cluster => {
            this.displayCluster(cluster, false);
        });

        // Apply query highlights if there's an active query
        if (DataModule.state.currentQuery) {
            this.applyHighlightsToVisibleImages();
        }
    },

    // Display a single cluster
    displayCluster(cluster, isZoomedIn) {
        const clusterElement = document.createElement('div');
        clusterElement.className = isZoomedIn ? 'cluster zoomed-in' : 'cluster';
        clusterElement.dataset.clusterId = cluster.id;

        // Check if this is a verified cluster
        const isVerified = DataModule.isClusterVerified(cluster.id);

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
                DataModule.state.selectedClusterId = cluster.id;
                console.log('Set selectedClusterId to:', DataModule.state.selectedClusterId);

                // Find the index of the selected cluster
                const clustersToDisplay = DataModule.getAllClusters();
                DataModule.state.selectedClusterIndex = clustersToDisplay.findIndex(c => c.id === cluster.id);
                console.log('Set selectedClusterIndex to:', DataModule.state.selectedClusterIndex);

                // Prevent event bubbling
                event.stopPropagation();

                // Redisplay with the selected cluster
                this.displayCurrentPage();
                console.log('After displayCurrentPage, selectedClusterId:', DataModule.state.selectedClusterId);
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
            verifySelectedBtn.addEventListener('click', () => FeaturesModule.verifySelectedImages(cluster));
            actionButtonsGroup.appendChild(verifySelectedBtn);

            // Add mark as duplicates button
            const markDuplicatesBtn = document.createElement('button');
            markDuplicatesBtn.innerHTML = '<i>⊕</i> Mark as Duplicates';
            markDuplicatesBtn.className = 'btn mark-duplicates-btn';
            markDuplicatesBtn.id = 'markDuplicatesBtn';
            markDuplicatesBtn.disabled = true; // Initially disabled
            markDuplicatesBtn.addEventListener('click', () => FeaturesModule.markSelectedAsDuplicates(cluster));
            actionButtonsGroup.appendChild(markDuplicatesBtn);

            // Add reset duplicates button (renamed from "Clear Duplication Marks")
            const clearDuplicatesBtn = document.createElement('button');
            clearDuplicatesBtn.innerHTML = '<i>↺</i> Reset Duplicates';
            clearDuplicatesBtn.className = 'btn clear-duplicates-btn';
            clearDuplicatesBtn.id = 'clearDuplicatesBtn';
            // Only enable if there are duplicate groups in this cluster
            const hasDuplicateGroups = DataModule.getDuplicateGroups(cluster.id).length > 0;
            clearDuplicatesBtn.disabled = !hasDuplicateGroups;
            clearDuplicatesBtn.addEventListener('click', () => FeaturesModule.clearDuplicationMarks(cluster));
            actionButtonsGroup.appendChild(clearDuplicatesBtn);

            // Add unverify button if the cluster is verified
            if (isVerified) {
                const unverifyBtn = document.createElement('button');
                unverifyBtn.innerHTML = '<i>↺</i> Unverify';
                unverifyBtn.className = 'btn unverify-btn';
                unverifyBtn.addEventListener('click', () => FeaturesModule.unverifyCluster(cluster));
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
                FeaturesModule.updateButtonStates();
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
                DataModule.state.selectedClusterId = null;
                DataModule.state.selectedClusterIndex = -1;
                this.displayCurrentPage();
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
        const size = this.elements.thumbnailSizeSlider.value;

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
            const duplicateGroup = DataModule.getImageDuplicateGroup(cluster.id, imageObj.path);

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
            const filename = DataModule.extractFilename(imageObj.path);
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
            img.addEventListener('click', () => {
                // Set the current image and cluster for navigation
                DataModule.state.currentClusterImages = Array.from(
                    document.querySelectorAll(`.cluster[data-cluster-id="${cluster.id}"] img`)
                );
                DataModule.state.currentImageIndex = DataModule.state.currentClusterImages.indexOf(img);

                // Set the modal content
                this.elements.modalImg.src = img.src;
                this.elements.modalCaption.textContent = imageObj.path;
                this.elements.modal.style.display = 'block';
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
                    const duplicateGroup = DataModule.getImageDuplicateGroup(cluster.id, imagePath);

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
                    FeaturesModule.updateButtonStates();
                });
            }

            imagesGrid.appendChild(imageContainer);
        });

        clusterElement.appendChild(imagesGrid);
        this.elements.clustersContainer.appendChild(clusterElement);
    },

    // Update thumbnail size based on slider value
    updateThumbnailSize() {
        const size = this.elements.thumbnailSizeSlider.value;
        this.elements.sizeValueDisplay.textContent = `${size}px`;

        // Check if we're in zoomed-in view
        const isZoomedIn = DataModule.state.selectedClusterId !== null;

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
    },

    // Apply highlights to visible images
    applyHighlightsToVisibleImages() {
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
        this.updateClusterMatchCounts();
    },

    // Clear query highlights
    clearQueryHighlights() {
        const highlightedElements = document.querySelectorAll('.query-match');
        highlightedElements.forEach(el => {
            el.classList.remove('query-match');
        });
    },

    // Update cluster headers with match counts
    updateClusterMatchCounts() {
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
    },

    // Show modal for image preview
    showModal(imageSrc, caption) {
        this.elements.modalImg.src = imageSrc;
        this.elements.modalCaption.textContent = caption;
        this.elements.modal.style.display = 'block';
    }
};

// Export the module
window.UIModule = UIModule;