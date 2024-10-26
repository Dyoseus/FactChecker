// background.js

// Store API key securely


require('dotenv').config();
const FACT_CHECK_API_KEY = process.env.FACT_CHECK_API_KEY;


// Use chrome.identity API for OAuth
async function getAccessToken() {
    return new Promise((resolve, reject) => {
        chrome.identity.getAuthToken(
            { 
                interactive: true, 
                scopes: ['https://www.googleapis.com/auth/factchecktools']
            },
            (token) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else if (!token) {
                    reject(new Error('No token received'));
                } else {
                    resolve(token);
                }
            }
        );
    });
}

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'FACT_CHECK') {
        const statement = request.text;
        console.log('Received fact-check request for:', statement);
        
        performFactCheck(statement).then(result => {
            if (chrome.runtime.lastError) {
                console.error('Runtime error:', chrome.runtime.lastError);
                return;
            }
            try {
                chrome.tabs.sendMessage(sender.tab.id, { 
                    type: 'FACT_CHECK_RESULT', 
                    data: result 
                });
            } catch (error) {
                console.error('Error sending message:', error);
            }
        });
        return true;
    }
});

// Updated function to perform fact-checking using API key
async function performFactCheck(statement) {
    try {
        const url = 'https://factchecktools.googleapis.com/v1alpha1/claims:search';
        
        const queryParams = new URLSearchParams({
            key: FACT_CHECK_API_KEY,  // Add API key as query parameter
            query: statement,
            languageCode: 'en'
        });

        const response = await fetch(`${url}?${queryParams}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log('Fact check response:', data);
        
        return parseFactCheck(data);
    } catch (error) {
        console.error('Error performing fact check:', error);
        return { 
            status: 'error', 
            message: error.message || 'An unknown error occurred'
        };
    }
}

// Function to parse the Fact Check Tools API response
function parseFactCheck(data) {
    if (!data) {
        return { status: 'error', message: 'No data received from API' };
    }

    if (data.claims && data.claims.length > 0) {
        const claim = data.claims[0];
        return {
            status: 'success',
            claimant: claim.claimant || 'Unknown',
            claimDate: claim.claimDate || 'Unknown date',
            text: claim.text || '',
            claimReview: claim.claimReview || []
        };
    }
    return { status: 'not_found', message: 'No fact check found for this statement.' };
}