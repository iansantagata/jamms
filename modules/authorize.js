// Dependencies
var axios = require('axios'); // Make HTTP requests
var path = require('path'); // URI and local file paths
var querystring = require('querystring'); // URI query string manipulation

// Custom Modules
const customModulePath = __dirname;
var home = require(path.join(customModulePath, 'home.js'));
var redirect = require(path.join(customModulePath, 'redirect.js'));
var secrets = require(path.join(customModulePath, 'secrets.js'));
var cookie = require(path.join(customModulePath, 'cookie.js'));

// Authorize Logic
const spotifyAccessTokenUri = 'https://accounts.spotify.com/api/token';

const accessKey = 'accessToken';
const refreshKey = 'refreshToken';

exports.getAuthorizationTokens = async function(req, res)
{
    // Make the request to get access and refresh tokens
    var requestData = {
        code: req.query.code || null,
        redirect_uri: redirect.getValidateLoginRedirectUri(req),
        grant_type: 'authorization_code'
    };

    var requestOptions = {
        headers: {
            'Authorization': 'Basic ' + secrets.getBase64EncodedAuthorizationToken(),
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    };

    // Trigger the authorization request
    try
    {
        var response = await axios.post(spotifyAccessTokenUri, querystring.stringify(requestData), requestOptions);
    }
    catch (error)
    {
        // Handle if there was an error for any reason
        console.error('Failed to authorize: ' + error.message);
        return Promise.reject(error);
    }

    // Extract only the data from the successful response that is needed
    var authorizationResponse = {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        scopes: response.data.scope,
        tokenExpirationInMsec: response.data.expires_in * 1000,
        tokenType: response.data.token_type
    };

    // Return authorization data to the caller
    return Promise.resolve(authorizationResponse);
};

exports.getAuthorizationTokensViaRefresh = async function(req, res)
{
    // Get the refresh token from cookies
    // TODO - Access token is the only one that should be a cookie, figure out how to handle this more securely
    var refreshToken = cookie.getCookie(req, refreshKey);

    if (refreshToken === undefined || refreshToken === null) {
        // This is specifically a warning because the user may legitimately never have logged in before at this point
        var warning = new Error('Refresh token not found, unable to get new access token to authorize Spotify usage.');
        console.warn('Failed to refresh authorization: ' + warning.message);
        return Promise.reject(warning);
    }

    // Request the access token from the refresh token
    var requestData = {
        grant_type: 'refresh_token',
        refresh_token: refreshToken
    };

    var requestOptions = {
        headers: {
            'Authorization': 'Basic ' + secrets.getBase64EncodedAuthorizationToken()
        }
    };

    // Make the request to Spotify to get a new access token
    try
    {
        var response = await axios.post(spotifyAccessTokenUri, querystring.stringify(requestData), requestOptions);
    }
    catch (error)
    {
        // Failed to re-authorize, return failure
        console.error('Failed to refresh authorization: ' + error.message);
        return Promise.reject(error);
    }

    // Got a new access token successfully
    var refreshAuthorizationResponse = {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        scopes: response.data.scope,
        tokenExpirationInMsec: response.data.expires_in * 1000,
        tokenType: response.data.token_type
    };

    // Throw the new token back into a cookie for the user to use
    cookie.setCookie(res, accessKey, refreshAuthorizationResponse.tokenType + ' ' + refreshAuthorizationResponse.accessToken, refreshAuthorizationResponse.tokenExpirationInMsec);

    // If the request did return a new refresh token, make sure we overwrite the old token
    if (refreshAuthorizationResponse.refreshToken !== undefined && refreshAuthorizationResponse.refreshToken !== null)
    {
        cookie.setCookie(res, refreshKey, refreshAuthorizationResponse.refreshToken); // Session cookie (no explicit expiration)
    }

    // Return success when re-authorization occurred
    return Promise.resolve(refreshAuthorizationResponse);
};

exports.getAccessTokenFromCookies = async function(req, res)
{
    var accessToken = cookie.getCookie(req, accessKey);

    // Make sure we actually have the access token, but if it expired and we can refresh it, then try to refresh it
    if (accessToken === undefined || accessToken === null)
    {
        try
        {
            var response = await exports.getAuthorizationTokensViaRefresh(req, res);

            // Since we are refreshing the cookie on this call, use the refreshed response data instead
            accessToken = response.tokenType + ' ' + response.accessToken;
        }
        catch (error)
        {
            // Did not successfully set cookie
            console.error('Failed to get access token: ' + error.message);
            return Promise.reject(error);
        }
    }

    return Promise.resolve(accessToken);
}

exports.setAuthorizationCookies = function(req, res, auth)
{
    // Make sure that we have all the needed authorization data to set the cookies
    if (auth === undefined || auth === null)
    {
        var error = new Error("Unable to set authorization cookies: Authorization data not provided");
        console.error(error.message);
        return Promise.reject(error);
    }

    if (auth.tokenExpirationInMsec === undefined || auth.tokenExpirationInMsec === null)
    {
        var error = new Error("Unable to set authorization cookies: Expiration time not found");
        console.error(error.message);
        return Promise.reject(error);
    }

    if (auth.tokenType === undefined || auth.tokenType === null)
    {
        var error = new Error("Unable to set authorization cookies: Token type not found");
        console.error(error.message);
        return Promise.reject(error);
    }

    if (auth.accessToken === undefined || auth.accessToken === null)
    {
        var error = new Error("Unable to set authorization cookies: Access token not found");
        console.error(error.message);
        return Promise.reject(error);
    }

    if (auth.refreshToken === undefined || auth.refreshToken === null)
    {
        var error = new Error("Unable to set authorization cookies: Refresh token not found");
        console.error(error.message);
        return Promise.reject(error);
    }

    // TODO - Figure out a better way to store this information than browser cookies (which is insecure, at least for refresh token)
    // TODO - Look into signed cookies (see cookie-parser docs) to still use client cookies, but ensure tampering is accounted for (interception still an issue however)
    cookie.setCookie(res, accessKey, auth.tokenType + ' ' + auth.accessToken, auth.tokenExpirationInMsec);
    cookie.setCookie(res, refreshKey, auth.refreshToken); // Session cookie (no explicit expiration);

    return Promise.resolve();
}
