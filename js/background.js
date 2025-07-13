chrome.runtime.onInstalled.addListener(function() {
    console.log('Uber Eats Data Extractor installed');
});

// Handle messages from content script
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "updateProgress") {
        // Forward progress updates to popup if it's open
        chrome.runtime.sendMessage({
            action: "updateProgress",
            count: request.count,
            scrollAttempts: request.scrollAttempts
        }).catch(() => {
            // Popup might be closed, ignore error
        });
    } else if (request.action === "calculatingBayescore") {
        // Forward Bayescore calculation message to popup
        chrome.runtime.sendMessage({
            action: "calculatingBayescore"
        }).catch(() => {});
    } else if (request.action === "extractionComplete") {
        // Store the extracted data
        chrome.storage.local.set({
            extractedData: request.data,
            timestamp: new Date().toISOString()
        });
        
        // Notify popup if it's open
        chrome.runtime.sendMessage({
            action: "extractionComplete",
            data: request.data
        }).catch(() => {});
    } else if (request.action === "extractionError") {
        // Forward error to popup
        chrome.runtime.sendMessage({
            action: "extractionError",
            error: request.error
        }).catch(() => {});
    } else if (request.action === "openResultsPage") {
        // Open the results page in a new tab
        chrome.tabs.create({
            url: chrome.runtime.getURL('results.html')
        });
    }
});

// Create context menu for quick extraction
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "extractUberEats",
        title: "Extract Uber Eats Data",
        contexts: ["page"],
        documentUrlPatterns: ["https://www.ubereats.com/*"]
    });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "extractUberEats") {
        chrome.tabs.sendMessage(tab.id, {action: "extractData"}, (response) => {
            if (response && response.success && response.data.length > 0) {
                // Store data temporarily
                chrome.storage.local.set({
                    extractedData: response.data,
                    timestamp: new Date().toISOString()
                }, () => {
                    // Open popup to show results
                    chrome.action.openPopup();
                });
            }
        });
    }
});