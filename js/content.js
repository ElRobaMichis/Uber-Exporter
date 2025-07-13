console.log('Uber Eats Data Extractor - Content script loaded');

// Function to calculate Bayesian scores
function calculateBayesianScores(restaurants) {
    console.log('=== STARTING BAYESIAN SCORE CALCULATION ===');
    console.log(`Total restaurants to process: ${restaurants.length}`);
    
    // Show first 5 restaurants as examples
    console.log('\nFirst 5 restaurants in dataset:');
    restaurants.slice(0, 5).forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.name} - ${r.stars} stars, ${r.reviews} reviews`);
    });
    
    // Filter out restaurants with valid ratings and reviews
    const validRestaurants = restaurants.filter(r => {
        const hasValidStars = r.stars !== 'N/A' && r.stars !== '' && !isNaN(parseFloat(r.stars));
        const hasValidReviews = r.reviews !== 'N/A' && r.reviews !== '' && !isNaN(parseInt(r.reviews));
        return hasValidStars && hasValidReviews && parseFloat(r.stars) > 0 && parseInt(r.reviews) > 0;
    });
    
    console.log(`\nValid restaurants for calculation: ${validRestaurants.length} out of ${restaurants.length}`);
    
    if (validRestaurants.length === 0) {
        console.log('No valid restaurants for Bayesian score calculation');
        return restaurants.map(r => ({ ...r, bayescore: 'N/A' }));
    }
    
    // Calculate m: WEIGHTED average of ALL ratings
    console.log('\n=== CALCULATING WEIGHTED AVERAGE RATING (m) ===');
    let weightedSum = 0;
    let totalReviews = 0;
    
    console.log('Restaurant contributions to weighted average:');
    validRestaurants.forEach((r, i) => {
        const rating = parseFloat(r.stars);
        const reviews = parseInt(r.reviews);
        const contribution = rating * reviews;
        weightedSum += contribution;
        totalReviews += reviews;
        
        if (i < 10 || i >= validRestaurants.length - 5) {
            console.log(`  ${i + 1}. ${r.name}: ${rating} × ${reviews} = ${contribution.toFixed(0)}`);
        } else if (i === 10) {
            console.log(`  ... (showing first 10 and last 5 restaurants)`);
        }
    });
    
    const m = weightedSum / totalReviews;
    console.log(`\nSum of (rating × reviews): ${weightedSum.toFixed(2)}`);
    console.log(`Total number of reviews: ${totalReviews}`);
    console.log(`Weighted average rating (m) = ${weightedSum.toFixed(2)} / ${totalReviews} = ${m.toFixed(4)}`);
    
    // Get all review counts and sort them
    console.log('\n=== CALCULATING 25TH PERCENTILE (C) ===');
    const reviewCounts = validRestaurants
        .map(r => parseInt(r.reviews))
        .sort((a, b) => a - b);
    
    console.log('Sorted review counts (first 15):');
    reviewCounts.slice(0, 15).forEach((count, i) => {
        console.log(`  Position ${i + 1}: ${count} reviews`);
    });
    
    // Calculate C: 25th percentile of review counts
    const percentileIndex = Math.floor(reviewCounts.length * 0.25);
    const C = reviewCounts[percentileIndex] || 1;
    
    console.log(`\n25th percentile calculation:`);
    console.log(`  Total restaurants: ${reviewCounts.length}`);
    console.log(`  25% of ${reviewCounts.length} = ${reviewCounts.length * 0.25}`);
    console.log(`  25th percentile index: ${percentileIndex}`);
    console.log(`  25th percentile value (C) = ${C} reviews`);
    
    console.log('\n=== FINAL PARAMETERS ===');
    console.log(`m (average rating) = ${m.toFixed(4)}`);
    console.log(`C (25th percentile reviews) = ${C}`);
    
    // Calculate Bayesian score for each restaurant
    console.log('\n=== CALCULATING BAYESIAN SCORES ===');
    console.log('Showing first 10 restaurants:');
    
    return restaurants.map((restaurant, index) => {
        if (restaurant.stars === 'N/A' || restaurant.reviews === 'N/A' || 
            restaurant.stars === '' || restaurant.reviews === '') {
            return { ...restaurant, bayescore: 'N/A' };
        }
        
        const R = parseFloat(restaurant.stars);
        const v = parseInt(restaurant.reviews);
        
        if (isNaN(R) || isNaN(v)) {
            return { ...restaurant, bayescore: 'N/A' };
        }
        
        // Bayesian score formula: (v * R + C * m) / (v + C)
        const numerator = (v * R) + (C * m);
        const denominator = v + C;
        const bayescore = numerator / denominator;
        
        if (index < 10) {
            console.log(`  ${restaurant.name}:`);
            console.log(`    Rating (R) = ${R}, Reviews (v) = ${v}`);
            console.log(`    Bayescore = (${v} × ${R} + ${C} × ${m.toFixed(4)}) / (${v} + ${C})`);
            console.log(`    Bayescore = (${(v * R).toFixed(2)} + ${(C * m).toFixed(2)}) / ${denominator}`);
            console.log(`    Bayescore = ${numerator.toFixed(2)} / ${denominator} = ${bayescore.toFixed(4)}`);
        }
        
        return {
            ...restaurant,
            bayescore: Number(bayescore.toFixed(4)) // Keep 4 decimals for better differentiation
        };
    });
}

function extractRestaurantData() {
    const restaurants = [];
    const processedNames = new Set(); // Track processed restaurant names to avoid duplicates
    
    // Select all restaurant cards - multiple possible structures
    const restaurantElements = document.querySelectorAll('[data-testid*="store-card"], [data-test*="store-card"], a[href*="/store/"], div[role="link"]');
    
    restaurantElements.forEach(element => {
        try {
            let name = '';
            let rating = '';
            let reviews = '';
            
            // Extract all text content and look for patterns
            const allText = element.textContent || '';
            
            // Find restaurant name - usually the largest text or in an h3/h2
            const headings = element.querySelectorAll('h1, h2, h3, h4');
            if (headings.length > 0) {
                name = headings[0].textContent.trim();
            } else {
                // Look for the first substantial text that's not a number or special offer
                const textNodes = [];
                const walker = document.createTreeWalker(
                    element,
                    NodeFilter.SHOW_TEXT,
                    null,
                    false
                );
                
                let node;
                while (node = walker.nextNode()) {
                    const text = node.textContent.trim();
                    if (text.length > 3 && !text.match(/^\d+$/) && !text.includes('Fee') && !text.includes('min')) {
                        textNodes.push(text);
                    }
                }
                
                // The name is usually one of the first meaningful text nodes
                for (const text of textNodes) {
                    if (text.length > 5 && !text.match(/save|select|items|fee|delivery/i)) {
                        name = text;
                        break;
                    }
                }
            }
            
            // Extract rating and reviews using regex patterns
            // Look for patterns like "4.7" followed by "(50,000+)"
            const ratingPattern = /(\d+\.?\d*)\s*(?:★|⭐|$)/;
            const ratingMatch = allText.match(ratingPattern);
            
            if (ratingMatch) {
                const potentialRating = parseFloat(ratingMatch[1]);
                if (potentialRating <= 5.0 && potentialRating >= 0) {
                    rating = ratingMatch[1];
                    
                    // Look for reviews immediately after rating
                    const afterRating = allText.substring(allText.indexOf(ratingMatch[0]));
                    const reviewPattern = /\(([0-9,]+)\+?\)/;
                    const reviewMatch = afterRating.match(reviewPattern);
                    if (reviewMatch) {
                        reviews = reviewMatch[1].replace(/,/g, '');
                    }
                }
            }
            
            // Alternative approach: Look for spans with title attribute (often used for ratings)
            if (!rating) {
                const ratingElements = element.querySelectorAll('span[title]');
                ratingElements.forEach(span => {
                    const title = span.getAttribute('title');
                    if (title && title.match(/^\d+\.?\d*$/) && parseFloat(title) <= 5) {
                        rating = title;
                        // Look for reviews in nearby elements
                        const parent = span.parentElement;
                        if (parent) {
                            const parentText = parent.textContent;
                            const reviewMatch = parentText.match(/\(([0-9,]+)\+?\)/);
                            if (reviewMatch) {
                                reviews = reviewMatch[1].replace(/,/g, '');
                            }
                        }
                    }
                });
            }
            
            // Yet another approach: Look for SVG stars followed by text
            if (!rating) {
                const svgElements = element.querySelectorAll('svg');
                svgElements.forEach(svg => {
                    const nextSibling = svg.nextElementSibling;
                    if (nextSibling && nextSibling.textContent) {
                        const text = nextSibling.textContent.trim();
                        if (text.match(/^\d+\.?\d*$/) && parseFloat(text) <= 5) {
                            rating = text;
                        }
                    }
                    // Also check previous sibling
                    const prevSibling = svg.previousElementSibling;
                    if (prevSibling && prevSibling.textContent) {
                        const text = prevSibling.textContent.trim();
                        if (text.match(/^\d+\.?\d*$/) && parseFloat(text) <= 5) {
                            rating = text;
                        }
                    }
                });
            }
            
            // Only add if we have at least a name and we haven't processed it yet
            if (name && name.length > 2 && !processedNames.has(name)) {
                // Check if the element is visible
                const rect = element.getBoundingClientRect();
                const isVisible = rect.height > 0 && rect.width > 0;
                
                // Check if the element is actually rendered on screen (not just in DOM)
                // Elements that are pre-loaded but hidden usually have top position way off screen
                const isInViewport = rect.top < window.innerHeight * 2 && rect.bottom > -window.innerHeight;
                
                // Check if the element contains typical restaurant card elements
                const hasImage = element.querySelector('img[src*="uber"], img[src*="eats"], picture img, img[alt]');
                const hasDeliveryInfo = allText.includes('min') || allText.includes('Fee') || allText.includes('Delivery');
                
                // A restaurant card is considered valid if:
                // 1. It's visible AND
                // 2. It's reasonably positioned on screen AND
                // 3. It has either an image OR delivery information (indicating it's a real restaurant card)
                if (isVisible && isInViewport && (hasImage || hasDeliveryInfo)) {
                    restaurants.push({
                        name: name,
                        stars: rating || 'N/A',
                        reviews: reviews || 'N/A'
                    });
                    
                    processedNames.add(name); // Mark this restaurant as processed
                    console.log(`Extracted: ${name} - ${rating} stars - ${reviews} reviews`);
                }
            }
        } catch (error) {
            console.error('Error extracting restaurant data:', error);
        }
    });
    
    // Remove duplicates based on name
    const uniqueRestaurants = restaurants.filter((restaurant, index, self) =>
        index === self.findIndex(r => r.name === restaurant.name)
    );
    
    console.log(`Extracted ${uniqueRestaurants.length} unique restaurants`);
    return uniqueRestaurants;
}

// Store extraction state
let extractionInProgress = false;
let extractedData = [];
let bayesianCalculationInProgress = false;

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "ping") {
        // Respond to ping to confirm content script is loaded
        sendResponse({ success: true });
    } else if (request.action === "extractData") {
        console.log('Starting data extraction...');
        const data = extractRestaurantData();
        sendResponse({ success: true, data: data });
    } else if (request.action === "scrollAndExtract") {
        if (extractionInProgress) {
            sendResponse({ success: false, error: "Extraction already in progress" });
            return;
        }
        
        console.log('Starting scroll and extract...');
        extractionInProgress = true;
        extractedData = [];
        
        // Jump to top of page instantly when starting extraction
        window.scrollTo(0, 0);
        
        // Start extraction asynchronously
        scrollAndExtractAll().then(data => {
            console.log(`Extraction and Bayesian calculation completed with ${data.length} restaurants`);
            extractedData = data;
            extractionInProgress = false;
            bayesianCalculationInProgress = false;
            
            // Send completion message to background script
            chrome.runtime.sendMessage({
                action: "extractionComplete",
                data: data
            }).catch(() => {
                console.log('Could not send completion message to background');
            });
        }).catch(error => {
            console.error('Extraction error:', error);
            
            // If there's partial data, calculate Bayesian scores for it
            if (extractedData && extractedData.length > 0) {
                console.log('Error occurred, but calculating Bayesian scores for partial data...');
                chrome.runtime.sendMessage({
                    action: "calculatingBayescore"
                }).catch(() => {});
                
                const resultsWithBayescore = calculateBayesianScores(extractedData);
                extractedData = resultsWithBayescore;
            }
            
            extractionInProgress = false;
            
            chrome.runtime.sendMessage({
                action: "extractionError",
                error: error.message
            }).catch(() => {});
        });
        
        // Respond immediately to avoid timeout
        sendResponse({ success: true, message: "Extraction started" });
    } else if (request.action === "getExtractedData") {
        // Return the extracted data
        console.log(`getExtractedData called - inProgress: ${extractionInProgress}, data length: ${extractedData.length}`);
        
        // Check if we have data and if it has Bayesian scores
        const hasBayesianScores = extractedData.length > 0 && extractedData[0].hasOwnProperty('bayescore');
        
        sendResponse({ 
            success: true, 
            data: extractedData,
            inProgress: extractionInProgress || bayesianCalculationInProgress || (extractedData.length > 0 && !hasBayesianScores)
        });
    }
});

// Function to click "Show more" button if it exists
async function clickShowMoreButton() {
    console.log('Looking for "Show more" button...');
    
    // Try multiple possible selectors for the "Show more" button
    const showMoreSelectors = [
        'button.n9.br.bo.dr.dj.no.e7.al.bc.d3.af.np.nq.jo.nr.ns.nt.nu.nv.nw', // Specific classes provided
        'button[aria-label*="more"]',
        'button[aria-label*="Show"]',
        'button:not([disabled])', // Non-disabled buttons
        'button',
        'div[role="button"]',
        '[role="button"]'
    ];
    
    // Wait a bit for dynamic content to load
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    for (const selector of showMoreSelectors) {
        try {
            const buttons = document.querySelectorAll(selector);
            console.log(`Checking ${buttons.length} elements with selector: ${selector}`);
            
            for (const button of buttons) {
                const buttonText = button.textContent.toLowerCase().trim();
                const ariaLabel = button.getAttribute('aria-label')?.toLowerCase() || '';
                
                // More comprehensive text matching - but avoid false positives
                const exactMatch = buttonText === 'show more' || buttonText === 'ver más' || 
                                 buttonText === 'mostrar más' || buttonText === 'show more restaurants';
                
                const containsShowMore = (buttonText.includes('show more') || buttonText.includes('ver más') || 
                                        buttonText.includes('mostrar más')) && 
                                        !buttonText.includes('fee') && !buttonText.includes('delivery');
                
                if (exactMatch || containsShowMore || 
                    (ariaLabel && (ariaLabel.includes('show more') || ariaLabel.includes('ver más')))) {
                    
                    // Check if button is visible and clickable
                    const rect = button.getBoundingClientRect();
                    const isVisible = rect.width > 0 && rect.height > 0 && 
                                    window.getComputedStyle(button).display !== 'none' &&
                                    window.getComputedStyle(button).visibility !== 'hidden';
                    
                    if (isVisible && !button.disabled) {
                        console.log(`Found "Show more" button with text: "${buttonText}" and aria-label: "${ariaLabel}"`);
                        console.log('Button classes:', button.className);
                        
                        // Try different click methods
                        try {
                            button.click();
                        } catch (e) {
                            console.log('Regular click failed, trying dispatchEvent...');
                            const clickEvent = new MouseEvent('click', {
                                bubbles: true,
                                cancelable: true,
                                view: window
                            });
                            button.dispatchEvent(clickEvent);
                        }
                        
                        // Wait for content to load after click
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        return true;
                    }
                }
            }
        } catch (e) {
            console.log('Error with selector:', selector, e);
        }
    }
    
    console.log('No "Show more" button found');
    return false;
}

// Function to perform smooth scrolling
async function smoothScrollDown(distance = 500) {
    return new Promise((resolve) => {
        let scrolled = 0;
        const interval = setInterval(() => {
            window.scrollBy(0, 50); // Scroll 50px at a time
            scrolled += 50;
            
            if (scrolled >= distance) {
                clearInterval(interval);
                resolve();
            }
        }, 20); // Every 20ms for smooth scrolling
    });
}

// Function to scroll and extract all restaurants
async function scrollAndExtractAll() {
    const allRestaurants = new Map();
    let previousCount = 0;
    let noNewDataAttempts = 0;
    const maxNoNewDataAttempts = 5; // Increased tolerance
    let totalScrolls = 0;
    const maxTotalScrolls = 100; // Increased max scrolls
    let lastScrollPosition = 0;
    let showMoreClickAttempts = 0;
    const maxShowMoreAttempts = 20; // Significantly increased to keep clicking Show More
    
    // Initial extraction
    const initialBatch = extractRestaurantData();
    initialBatch.forEach(restaurant => {
        const key = restaurant.name; // Use only name as key to avoid duplicates
        allRestaurants.set(key, restaurant);
    });
    
    console.log(`Initial extraction: ${allRestaurants.size} restaurants`);
    
    while (totalScrolls < maxTotalScrolls) {
        const currentScrollPosition = window.pageYOffset;
        const maxScrollPosition = document.documentElement.scrollHeight - window.innerHeight;
        
        // Check if we're at the bottom of the page
        const isAtBottom = currentScrollPosition >= maxScrollPosition - 100;
        
        // Perform smooth scrolling
        await smoothScrollDown(window.innerHeight * 0.8); // Scroll 80% of viewport height
        
        // Wait for content to load
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Extract newly visible restaurants
        const currentBatch = extractRestaurantData();
        let newRestaurantsFound = 0;
        
        currentBatch.forEach(restaurant => {
            const key = restaurant.name; // Use only name as key
            if (!allRestaurants.has(key)) {
                newRestaurantsFound++;
                allRestaurants.set(key, restaurant);
            }
        });
        
        const currentCount = allRestaurants.size;
        console.log(`Scroll ${totalScrolls + 1}: Found ${newRestaurantsFound} new restaurants. Total: ${currentCount}`);
        
        // DON'T update extractedData during scrolling - only update the count
        // This prevents premature display of results
        
        // Update progress
        chrome.runtime.sendMessage({
            action: "updateProgress",
            count: currentCount,
            scrollAttempts: totalScrolls + 1
        }).catch(() => {});
        
        // Check if we got new data
        if (currentCount === previousCount) {
            noNewDataAttempts++;
            
            // Try clicking "Show more" regardless of position if we have attempts left
            if (showMoreClickAttempts < maxShowMoreAttempts) {
                const clickedShowMore = await clickShowMoreButton();
                if (clickedShowMore) {
                    showMoreClickAttempts++;
                    console.log(`Clicked "Show more" button (attempt ${showMoreClickAttempts}/${maxShowMoreAttempts})`);
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    
                    // Reset no-new-data counter when we click show more
                    noNewDataAttempts = 0;
                } else if (isAtBottom) {
                    // No more "Show more" button found at bottom
                    console.log('No "Show more" button found at bottom of page');
                    // Don't break immediately - keep trying
                }
            }
            
            // Stop if we've tried enough times without new data
            if (noNewDataAttempts >= maxNoNewDataAttempts) {
                console.log('No new restaurants found after multiple attempts, finishing extraction');
                break;
            }
        } else {
            noNewDataAttempts = 0; // Reset counter when we find new data
        }
        
        // Check if scroll position hasn't changed significantly (might be stuck)
        if (Math.abs(currentScrollPosition - lastScrollPosition) < 50 && isAtBottom) {
            console.log('At bottom of page with minimal scroll change');
            noNewDataAttempts++;
        }
        
        previousCount = currentCount;
        lastScrollPosition = currentScrollPosition;
        totalScrolls++;
    }
    
    // Final extraction to catch any last items
    const finalBatch = extractRestaurantData();
    finalBatch.forEach(restaurant => {
        const key = restaurant.name;
        allRestaurants.set(key, restaurant);
    });
    
    const finalResults = Array.from(allRestaurants.values());
    console.log(`Extraction complete. Total unique restaurants: ${finalResults.length}`);
    
    // Jump to top of page instantly
    window.scrollTo(0, 0);
    
    // DON'T update extractedData yet - keep it empty until Bayesian scores are calculated
    // This prevents the popup from showing results prematurely
    
    // Mark that we're still processing (calculating Bayesian scores)
    extractionInProgress = true; // Keep this true during Bayesian calculation
    bayesianCalculationInProgress = true;
    
    // Send message that we're now calculating Bayesian scores
    chrome.runtime.sendMessage({
        action: "calculatingBayescore"
    }).catch(() => {});
    
    // Small delay to ensure the message is sent
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Calculate Bayesian scores
    const resultsWithBayescore = calculateBayesianScores(finalResults);
    
    // NOW update with final results including Bayesian scores
    extractedData = resultsWithBayescore;
    extractionInProgress = false;
    bayesianCalculationInProgress = false;
    
    // Store results in chrome.storage for the results page
    chrome.storage.local.set({ extractionResults: resultsWithBayescore }, function() {
        console.log('Results saved to storage');
    });
    
    // Notify that extraction is truly complete
    chrome.runtime.sendMessage({
        action: "bayesianCalculationComplete",
        data: resultsWithBayescore
    }).catch(() => {});
    
    // Open results page in a new tab
    chrome.runtime.sendMessage({
        action: "openResultsPage"
    }).catch(() => {});
    
    return resultsWithBayescore;
}