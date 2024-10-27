// oauth.js

// Function to initiate OAuth flow
export function initiateOAuth() {
    return new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive: true }, (token) => {
            if (chrome.runtime.lastError || !token) {
                reject(new Error('OAuth failed.'));
            } else {
                resolve(token);
            }
        });
    });
}

// Function to obtain OAuth 2.0 access token with the updated scope
export async function getAccessToken() {
    return new Promise((resolve, reject) => {
        chrome.identity.getAuthToken(
            { interactive: true, scopes: ['https://www.googleapis.com/auth/factchecktools'] },
            (token) => {
                if (chrome.runtime.lastError || !token) {
                    reject(new Error('Failed to obtain access token with factchecktools scope.'));
                } else {
                    resolve(token);
                }
            }
        );
    });
}
