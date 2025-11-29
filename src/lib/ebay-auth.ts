import https from 'https';
import { URL } from 'url';

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
}

interface EbayCredentials {
  appId: string;
  clientSecret: string;
  certId: string;
  refreshToken?: string;
}

/**
 * Get OAuth access token using refresh token
 * This is the recommended approach for server applications
 */
export async function refreshEbayToken(refreshToken: string): Promise<TokenResponse> {
  return new Promise((resolve, reject) => {
    const credentials = {
      appId: process.env.EBAY_APP_ID || '',
      clientSecret: process.env.EBAY_CLIENT_SECRET || '',
    };

    if (!credentials.appId || !credentials.clientSecret) {
      reject(new Error('EBAY_APP_ID and EBAY_CLIENT_SECRET are required'));
      return;
    }

    // Create Basic Auth header
    const authString = Buffer.from(`${credentials.appId}:${credentials.clientSecret}`).toString('base64');

    const postData = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      scope: 'https://api.ebay.com/oauth/api_scope',
    }).toString();

    const options = {
      hostname: 'api.ebay.com',
      port: 443,
      path: '/identity/v1/oauth2/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        'Authorization': `Basic ${authString}`,
      },
    };

    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`Token refresh failed: ${res.statusCode} - ${responseData}`));
          return;
        }

        try {
          const tokenData = JSON.parse(responseData) as TokenResponse;
          resolve(tokenData);
        } catch (error) {
          reject(new Error(`Failed to parse token response: ${responseData}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Get OAuth access token using client credentials (for server-to-server)
 * Note: This only works for certain scopes and may not work for Trading API
 */
export async function getEbayTokenWithClientCredentials(): Promise<TokenResponse> {
  return new Promise((resolve, reject) => {
    const credentials = {
      appId: process.env.EBAY_APP_ID || '',
      clientSecret: process.env.EBAY_CLIENT_SECRET || '',
    };

    if (!credentials.appId || !credentials.clientSecret) {
      reject(new Error('EBAY_APP_ID and EBAY_CLIENT_SECRET are required'));
      return;
    }

    // Create Basic Auth header
    const authString = Buffer.from(`${credentials.appId}:${credentials.clientSecret}`).toString('base64');

    const postData = new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'https://api.ebay.com/oauth/api_scope',
    }).toString();

    const options = {
      hostname: 'api.ebay.com',
      port: 443,
      path: '/identity/v1/oauth2/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        'Authorization': `Basic ${authString}`,
      },
    };

    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`Token request failed: ${res.statusCode} - ${responseData}`));
          return;
        }

        try {
          const tokenData = JSON.parse(responseData) as TokenResponse;
          resolve(tokenData);
        } catch (error) {
          reject(new Error(`Failed to parse token response: ${responseData}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Get eBay Auth'n'Auth token (2-year expiry token)
 * This is the simplest method - just use the token directly
 */
export async function getEbayAccessToken(): Promise<string> {
  // Priority 1: Auth'n'Auth token (2-year expiry, simplest method)
  const authnAuthToken = process.env.EBAY_AUTHN_AUTH_TOKEN || process.env.OAUTH_TOKEN || process.env.EBAY_USER_TOKEN;
  if (authnAuthToken) {
    console.log('✅ Using eBay Auth\'n\'Auth token (2-year expiry)');
    return authnAuthToken;
  }

  // Priority 2: Try refresh token if available (OAuth method)
  const refreshToken = process.env.EBAY_REFRESH_TOKEN;
  if (refreshToken) {
    try {
      console.log('🔄 Refreshing eBay OAuth token using refresh token...');
      const tokenData = await refreshEbayToken(refreshToken);
      console.log('✅ eBay token refreshed successfully');
      
      if (tokenData.refresh_token) {
        console.log('💾 New refresh token received (save to EBAY_REFRESH_TOKEN env var)');
      }
      
      return tokenData.access_token;
    } catch (error: any) {
      console.warn('⚠️  Token refresh failed, trying client credentials:', error.message);
    }
  }

  // Priority 3: Try client credentials (Application Token)
  // Note: This may not work for Trading API which requires User Token
  try {
    console.log('🔑 Getting eBay token using client credentials...');
    const tokenData = await getEbayTokenWithClientCredentials();
    console.log('✅ eBay Application token obtained successfully');
    console.log('⚠️  Note: Application tokens may not work for Trading API. You may need a User Token.');
    return tokenData.access_token;
  } catch (error: any) {
    console.warn('⚠️  Client credentials failed:', error.message);
  }
  
  throw new Error('No valid eBay token available. Set EBAY_AUTHN_AUTH_TOKEN, OAUTH_TOKEN, EBAY_REFRESH_TOKEN, or EBAY_APP_ID + EBAY_CLIENT_SECRET');
}

/**
 * Cache for token to avoid refreshing too frequently
 */
let tokenCache: {
  token: string;
  expiresAt: number;
  isAuthnAuth: boolean; // Track if this is an Auth'n'Auth token (doesn't expire)
} | null = null;

/**
 * Clear token cache (useful when token is invalid)
 */
export function clearEbayTokenCache(): void {
  tokenCache = null;
}

/**
 * Get cached token or fetch new one
 */
export async function getCachedEbayToken(): Promise<string> {
  // Check if we have an Auth'n'Auth token (doesn't expire, can cache indefinitely)
  const authnAuthToken = process.env.EBAY_AUTHN_AUTH_TOKEN || process.env.OAUTH_TOKEN || process.env.EBAY_USER_TOKEN;
  
  if (authnAuthToken) {
    // For Auth'n'Auth tokens, check cache first
    if (tokenCache && tokenCache.isAuthnAuth && tokenCache.token === authnAuthToken) {
      return tokenCache.token;
    }
    
    // Cache Auth'n'Auth token (doesn't expire, but cache for 24 hours to allow updates)
    tokenCache = {
      token: authnAuthToken,
      expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
      isAuthnAuth: true,
    };
    
    return authnAuthToken;
  }

  // For OAuth tokens, check cache (tokens typically expire in 2 hours, cache for 1.5 hours)
  if (tokenCache && !tokenCache.isAuthnAuth && tokenCache.expiresAt > Date.now()) {
    return tokenCache.token;
  }

  // Get new token
  const token = await getEbayAccessToken();
  
  // Cache for 1.5 hours (5400 seconds) for OAuth tokens
  tokenCache = {
    token,
    expiresAt: Date.now() + (5400 * 1000),
    isAuthnAuth: false,
  };

  return token;
}

