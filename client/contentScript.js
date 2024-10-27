// contentScript.js

// Function to extract live captions
function getCaptions() {
    const captions = document.querySelector('.caption-window');
    return captions ? captions.innerText.trim() : '';
}

// Keep track of the last sent caption and current query
let accumulatedCaptions = '';
let pendingCaptions = '';  // Store new captions while waiting for fact check
let lastRequestTime = 0;
let isFactCheckPending = false;
const MIN_REQUEST_INTERVAL = 2000; // 5 seconds
const MAX_WORD_COUNT = 30;
const POPUP_DURATION = 8000; // 8 seconds for popup display

// Helper function to count words
function countWords(text) {
    return text.split(/\s+/).filter(word => word.length > 0).length;
}

// Function to trim excess words to maintain max word count
function trimToMaxWords(text) {
    const words = text.split(/\s+/).filter(word => word.length > 0);
    if (words.length <= MAX_WORD_COUNT) {
        return text;
    }
    return words.slice(-(MAX_WORD_COUNT)).join(' ');
}

// Function to perform fact check
function performFactCheck(text) {
    isFactCheckPending = true;
    chrome.runtime.sendMessage({ type: 'FACT_CHECK', text: text }, (response) => {
        if (chrome.runtime.lastError) {
            console.error('Error sending message:', chrome.runtime.lastError);
            isFactCheckPending = false;
        }
    });
}

// Add rainbow animation styles to the document
function injectStyles() {
    const styleSheet = document.createElement("style");
    styleSheet.textContent = `
        @keyframes rainbow-border {
            0% { border-color: #ff0000; }
            17% { border-color: #ff8000; }
            33% { border-color: #ffff00; }
            50% { border-color: #00ff00; }
            67% { border-color: #0000ff; }
            83% { border-color: #8000ff; }
            100% { border-color: #ff0000; }
        }
        
        @keyframes rainbow-text {
            0% { color: #ff0000; }
            17% { color: #ff8000; }
            33% { color: #ffff00; }
            50% { color: #00ff00; }
            67% { color: #0000ff; }
            83% { color: #8000ff; }
            100% { color: #ff0000; }
        }

        .fact-check-popup {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background-color: rgba(255, 255, 255, 0.95);
            border: 3px solid #ff0000;
            border-radius: 12px;
            padding: 15px;
            z-index: 9999;
            max-width: 350px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            font-family: Arial, sans-serif;
            font-size: 14px;
            line-height: 1.4;
            animation: rainbow-border 5s linear infinite;
            backdrop-filter: blur(5px);
        }

        .fact-check-title {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 10px;
            animation: rainbow-text 5s linear infinite;
        }

        .fact-check-claim {
            font-style: italic;
            margin-bottom: 12px;
            padding: 8px;
            background-color: rgba(0,0,0,0.05);
            border-radius: 6px;
        }

        .fact-check-source {
            margin-bottom: 8px;
            font-weight: 500;
        }

        .fact-check-rating {
            margin-bottom: 10px;
            padding: 5px 10px;
            border-radius: 15px;
            display: inline-block;
            font-weight: bold;
            animation: rainbow-text 5s linear infinite;
        }

        .fact-check-link {
            display: inline-block;
            margin-top: 8px;
            color: #1a73e8;
            text-decoration: none;
            transition: color 0.3s;
        }

        .fact-check-link:hover {
            text-decoration: underline;
            animation: rainbow-text 5s linear infinite;
        }
    `;
    document.head.appendChild(styleSheet);
}

// Inject styles when script loads
injectStyles();

// Set an interval to capture and accumulate captions
setInterval(() => {
    const newCaption = getCaptions();
    const currentTime = Date.now();
    
    // Store new captions while waiting
    if (newCaption) {
        pendingCaptions += ' ' + newCaption;
        pendingCaptions = pendingCaptions.trim();
        console.log('📝 New caption captured:', {
            caption: newCaption,
            pendingCaptions: pendingCaptions
        });
    }
    
    // Only process if enough time has passed since last request
    if (currentTime - lastRequestTime >= MIN_REQUEST_INTERVAL) {
        lastRequestTime = currentTime;
        
        // If we have pending captions, append them to accumulated captions
        if (pendingCaptions) {
            if (accumulatedCaptions) {
                accumulatedCaptions += ' ' + pendingCaptions;
            } else {
                accumulatedCaptions = pendingCaptions;
            }
            console.log('📚 Accumulated captions updated:', {
                previous: accumulatedCaptions,
                new: pendingCaptions,
                combined: accumulatedCaptions + ' ' + pendingCaptions
            });
            pendingCaptions = ''; // Reset pending captions
        }

        // Ensure we don't exceed MAX_WORD_COUNT words
        if (countWords(accumulatedCaptions) > MAX_WORD_COUNT) {
            const beforeTrim = accumulatedCaptions;
            accumulatedCaptions = trimToMaxWords(accumulatedCaptions);
            console.log('✂️ Trimmed accumulated captions:', {
                before: beforeTrim,
                after: accumulatedCaptions,
                wordCount: countWords(accumulatedCaptions)
            });
        }

        // Perform fact check if we have content and no pending check
        if (!isFactCheckPending && accumulatedCaptions) {
            performFactCheck(accumulatedCaptions);
        }
    }
}, 1000);

// Listen for fact-check results from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'FACT_CHECK_RESULT') {
        console.log('✅ Fact check result received:', {
            timestamp: new Date().toISOString(),
            data: message.data,
            wasSuccessful: message.data.status === 'success',
            hadClaims: message.data.claimReview && message.data.claimReview.length > 0
        });
        
        isFactCheckPending = false;

        // Only reset accumulated captions if a fact was found
        if (message.data.status === 'success' && message.data.claimReview && message.data.claimReview.length > 0) {
            console.log('🎯 Match found - showing popup and resetting captions');
            showFactCheckPopup(message.data);
            accumulatedCaptions = ''; // Reset only when a fact is found
            pendingCaptions = ''; // Clear any pending captions
        } else {
            console.log('🔄 No match found - continuing to accumulate captions');
        }
    }
});

// Function to show fact-check results in a popup on the page
function showFactCheckPopup(result) {
    // Remove any existing popups
    const existingPopup = document.querySelector('.fact-check-popup');
    if (existingPopup) {
        existingPopup.remove();
    }

    const popup = document.createElement('div');
    popup.className = 'fact-check-popup';

    // Display fact-check information
    if (result.status === 'success' && result.claimReview && result.claimReview.length > 0) {
        const claimReview = result.claimReview[0];
        popup.innerHTML = `
            <div class="fact-check-title">Fact Check Result</div>
            <div class="fact-check-claim">"${result.text}"</div>
            <div class="fact-check-source"><strong>Source:</strong> ${result.claimant || 'Unknown'}</div>
            <div><strong>Verified by:</strong> ${claimReview.publisher.name}</div>
            <div class="fact-check-rating"><strong>Rating:</strong> ${claimReview.textualRating}</div>
            <a href="${claimReview.url}" target="_blank" class="fact-check-link">Read Full Review</a>
        `;
    } else if (result.status === 'not_found') {
        popup.innerHTML = `
            <div class="fact-check-title">No Results Found</div>
            <div class="fact-check-claim">
                No fact-check found for this statement.
            </div>
        `;
    } else {
        popup.innerHTML = `
            <div class="fact-check-title">Error</div>
            <div class="fact-check-claim">
                ${result.message || 'An unknown error occurred'}
            </div>
        `;
    }

    document.body.appendChild(popup);

    // Remove the popup after POPUP_DURATION milliseconds
    setTimeout(() => {
        if (popup && popup.parentElement) {
            popup.remove();
        }
    }, POPUP_DURATION);
}