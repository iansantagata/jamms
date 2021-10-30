"use strict";

// Dependencies
const path = require("path"); // URI and local file paths
const querystring = require("querystring"); // URI query string manipulation

// Utility Modules
const utilityModulesPath = path.join(__dirname, "utilityModules");
const logger = require(path.join(utilityModulesPath, "logger.js"));
const environment = require(path.join(utilityModulesPath, "environment.js"));
const loginUtils = require(path.join(utilityModulesPath, "loginUtils.js"));
const authorize = require(path.join(utilityModulesPath, "authorize.js"));
const state = require(path.join(utilityModulesPath, "state.js"));

// Default Constant Values
const spotifyAuthorizeUri = "https://accounts.spotify.com/authorize";

const scopes = "playlist-read-private playlist-read-collaborative user-top-read user-library-read user-follow-read playlist-modify-public playlist-modify-private";

// Login Logic
exports.getLoginPage = async function(req, res, next)
{
    try
    {
        // Set state token locally for logging in to be validated against Spotify returned state token
        const stateToken = await state.generateStateToken();
        await state.setStateToken(req, res, stateToken);

        const clientId = await environment.getClientId();
        const redirectUri = await loginUtils.getValidateLoginRedirectUri(req);

        const requestParameters = {
            client_id: clientId,
            redirect_uri: redirectUri,
            response_type: "code",
            scope: scopes,
            show_dialog: true,
            state: stateToken
        };

        // Request authorization for this application via a Spotify login page
        const spotifyAuthorizeFullUri = `${spotifyAuthorizeUri}?${querystring.stringify(requestParameters)}`;
        res.redirect(spotifyAuthorizeFullUri);
    }
    catch (error)
    {
        logger.logError(`Failed to get login page: ${error.message}`);
        next(error);
    }
};

exports.validateLogin = async function(req, res)
{
    try
    {
        // Check for errors after the response page from Spotify
        const validationError = req.query.error;
        if (validationError)
        {
            throw new Error(validationError);
        }

        // Validate state token from Spotify callback request is the same from the request made locally
        await state.validateStateTokenMatch(req);

        // State validated successfully, can clear the state cookie
        await state.clearStateToken(res);

        // Redirect to authorization handling
        const authorizationResponse = await authorize.getAuthorizationTokens(req);

        // Use the access token and refresh token to validate access to Spotify's API
        await authorize.setAuthorizationCookies(req, res, authorizationResponse);

        // Once we have our tokens, redirect to the home page
        res.redirect("/home");
    }
    catch (error)
    {
        // Clean up any potentially set login cookies if login has failed
        // This is to be sure that a user is not stuck in a half logged in state
        await state.clearStateToken(res);
        await authorize.deleteAuthorizationCookies(res);

        logger.logError(`Failed to authorize user with Spotify: ${error.message}`);
        res.redirect("/accessDenied");
    }
};
