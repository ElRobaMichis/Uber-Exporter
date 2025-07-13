let extractedData = [];

document.addEventListener('DOMContentLoaded', function() {
    const extractVisibleBtn = document.getElementById('extractVisible');
    const extractAllBtn = document.getElementById('extractAll');
    const downloadBtn = document.getElementById('downloadExcel');
    const statusDiv = document.getElementById('status');
    const resultsDiv = document.getElementById('results');
    const countSpan = document.getElementById('count');

    // Check if on Uber Eats page
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        const currentUrl = tabs[0].url;
        if (!currentUrl.includes('ubereats.com')) {
            showStatus('Please navigate to an Uber Eats page first.', 'warning');
            extractVisibleBtn.disabled = true;
            extractAllBtn.disabled = true;
        }
    });

    extractVisibleBtn.addEventListener('click', function() {
        extractData('extractData');
    });

    extractAllBtn.addEventListener('click', function() {
        extractData('scrollAndExtract');
    });

    downloadBtn.addEventListener('click', function() {
        if (extractedData.length > 0) {
            exportToExcel(extractedData);
        }
    });

    function extractData(action) {
        // Disable buttons during extraction
        extractVisibleBtn.disabled = true;
        extractAllBtn.disabled = true;
        resultsDiv.style.display = 'none';
        
        if (action === 'scrollAndExtract') {
            showStatus('Extracting data... This may take a minute as we scroll through the page.', 'info');
        } else {
            showStatus('Extracting visible restaurants...', 'info');
        }

        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            const tabId = tabs[0].id;
            
            // First, try to send a message to see if content script is loaded
            chrome.tabs.sendMessage(tabId, {action: "ping"}, function(response) {
                if (chrome.runtime.lastError) {
                    // Content script not loaded, inject it
                    showStatus('Initializing... Please wait.', 'info');
                    
                    chrome.scripting.executeScript({
                        target: { tabId: tabId },
                        files: ['js/content.js']
                    }, function() {
                        if (chrome.runtime.lastError) {
                            showStatus('Error: ' + chrome.runtime.lastError.message, 'error');
                            extractVisibleBtn.disabled = false;
                            extractAllBtn.disabled = false;
                        } else {
                            // Wait a bit for the script to initialize
                            setTimeout(() => {
                                performExtraction(tabId, action);
                            }, 500);
                        }
                    });
                } else {
                    // Content script already loaded, proceed with extraction
                    performExtraction(tabId, action);
                }
            });
        });
    }
    
    function performExtraction(tabId, action) {
        if (action === 'extractData') {
            // Simple extraction - works synchronously
            chrome.tabs.sendMessage(tabId, {action: action}, function(response) {
                if (chrome.runtime.lastError) {
                    showStatus('Error: ' + chrome.runtime.lastError.message, 'error');
                    extractVisibleBtn.disabled = false;
                    extractAllBtn.disabled = false;
                } else if (response && response.success) {
                    extractedData = response.data;
                    showResults(extractedData.length);
                } else {
                    showStatus('Failed to extract data. Make sure you\'re on an Uber Eats page.', 'error');
                    extractVisibleBtn.disabled = false;
                    extractAllBtn.disabled = false;
                }
            });
        } else if (action === 'scrollAndExtract') {
            // Start the extraction process
            chrome.tabs.sendMessage(tabId, {action: action}, function(response) {
                if (chrome.runtime.lastError) {
                    showStatus('Error: ' + chrome.runtime.lastError.message, 'error');
                    extractVisibleBtn.disabled = false;
                    extractAllBtn.disabled = false;
                } else if (response && response.success) {
                    // Extraction started, now poll for results
                    pollForExtractionResults(tabId);
                } else {
                    showStatus(response.error || 'Failed to start extraction', 'error');
                    extractVisibleBtn.disabled = false;
                    extractAllBtn.disabled = false;
                }
            });
        }
    }
    
    function pollForExtractionResults(tabId) {
        let lastCount = 0;
        let sameCountAttempts = 0;
        
        const pollInterval = setInterval(() => {
            chrome.tabs.sendMessage(tabId, {action: "getExtractedData"}, function(response) {
                if (chrome.runtime.lastError) {
                    clearInterval(pollInterval);
                    showStatus('Connection lost. Please try again.', 'error');
                    extractVisibleBtn.disabled = false;
                    extractAllBtn.disabled = false;
                    return;
                }
                
                if (response && response.success) {
                    console.log(`Poll response - inProgress: ${response.inProgress}, data length: ${response.data ? response.data.length : 0}`);
                    
                    // Always check if we have data first
                    if (response.data && response.data.length > 0) {
                        const currentCount = response.data.length;
                        
                        // If extraction is complete OR count has stabilized
                        if (!response.inProgress) {
                            clearInterval(pollInterval);
                            extractedData = response.data;
                            showResults(extractedData.length);
                        } else {
                            // Still in progress, check if count has stabilized
                            if (currentCount === lastCount && currentCount > 0) {
                                sameCountAttempts++;
                                // If count hasn't changed for 10 seconds, assume it's done
                                if (sameCountAttempts >= 10) {
                                    clearInterval(pollInterval);
                                    extractedData = response.data;
                                    showResults(extractedData.length);
                                }
                            } else {
                                sameCountAttempts = 0;
                            }
                            lastCount = currentCount;
                        }
                    } else if (!response.inProgress) {
                        // Only show "no restaurants" if extraction is complete and no data
                        clearInterval(pollInterval);
                        console.log('Extraction complete but no data found');
                        showStatus('No restaurants found. Try refreshing the page.', 'warning');
                        extractVisibleBtn.disabled = false;
                        extractAllBtn.disabled = false;
                    }
                }
            });
        }, 1000); // Check every second
        
        // Stop polling after 5 minutes
        setTimeout(() => {
            clearInterval(pollInterval);
            // Get final results even if still marked as in progress
            chrome.tabs.sendMessage(tabId, {action: "getExtractedData"}, function(response) {
                if (response && response.success && response.data && response.data.length > 0) {
                    extractedData = response.data;
                    showResults(extractedData.length);
                } else {
                    showStatus('Extraction timed out. Please try again.', 'error');
                    extractVisibleBtn.disabled = false;
                    extractAllBtn.disabled = false;
                }
            });
        }, 300000);
    }

    function showStatus(message, type) {
        statusDiv.textContent = message;
        statusDiv.className = 'status ' + type;
    }

    function showResults(count) {
        extractVisibleBtn.disabled = false;
        extractAllBtn.disabled = false;
        
        if (count > 0) {
            countSpan.textContent = count;
            resultsDiv.style.display = 'block';
            showStatus(`Successfully extracted ${count} restaurants!`, 'success');
        } else {
            showStatus('No restaurants found. Try scrolling or refreshing the page.', 'warning');
        }
    }

    function exportToExcel(data) {
        try {
            // Create a new workbook
            const wb = XLSX.utils.book_new();
            
            // Prepare data with Bayescore column and sort by Bayescore (descending) with rating as tiebreaker
            const wsData = data
                .sort((a, b) => {
                    // First compare by Bayescore
                    const bayescoreA = parseFloat(a.bayescore) || 0;
                    const bayescoreB = parseFloat(b.bayescore) || 0;
                    
                    if (bayescoreA !== bayescoreB) {
                        return bayescoreB - bayescoreA; // Higher Bayescore first
                    }
                    
                    // If Bayescores are equal, use original rating as tiebreaker
                    const ratingA = parseFloat(a.stars) || 0;
                    const ratingB = parseFloat(b.stars) || 0;
                    
                    return ratingB - ratingA; // Higher rating first
                })
                .map(item => ({
                    name: item.name,
                    stars: item.stars,
                    reviews: item.reviews,
                    bayescore: item.bayescore || 'N/A'
                }));
            
            // Convert data to worksheet
            const ws = XLSX.utils.json_to_sheet(wsData, {
                header: ['name', 'stars', 'reviews', 'bayescore'],
                skipHeader: false
            });
            
            // Set column headers
            XLSX.utils.sheet_add_aoa(ws, [['Name', 'Stars', 'Reviews', 'Bayescore']], {origin: 'A1'});
            
            // Add worksheet to workbook
            XLSX.utils.book_append_sheet(wb, ws, 'Restaurants');
            
            // Generate filename with current date
            const date = new Date().toISOString().split('T')[0];
            const filename = `uber_eats_restaurants_bayescore_${date}.xlsx`;
            
            // Write the file
            XLSX.writeFile(wb, filename);
            
            showStatus('Excel file with Bayesian scores downloaded successfully!', 'success');
        } catch (error) {
            console.error('Error exporting to Excel:', error);
            showStatus('Error creating Excel file: ' + error.message, 'error');
        }
    }
});

// Listen for progress updates from content script
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "updateProgress") {
        const statusDiv = document.getElementById('status');
        if (statusDiv) {
            statusDiv.textContent = `Extracting... Found ${request.count} restaurants (Scroll ${request.scrollAttempts})`;
        }
    } else if (request.action === "calculatingBayescore") {
        const statusDiv = document.getElementById('status');
        if (statusDiv) {
            statusDiv.innerHTML = 'Extraction completed!<br>Calculating Bayesian scores...';
            statusDiv.className = 'status info';
        }
    }
});