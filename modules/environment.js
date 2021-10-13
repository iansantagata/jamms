"use strict";

// Dependencies
const path = require("path"); // URI and local file paths

// Custom Modules
const customModulePath = __dirname;
const logger = require(path.join(customModulePath, "logger.js"));

// Environment Logic

// Sync Functions

// Note - Parts of this file avoid using promises to access environment variables and insteads returns default values generally on failure.
// Note - It avoids promises because access can occur on the top level and handling promises and errors there is non-trivial.
// Note - Instead, errors are thrown directly if they occur when functions are indicated as sync.

exports.isDevelopmentEnvironmentSync = function()
{
    try
    {
        checkEnvironmentVariablesExist();

        const environment = process.env.NODE_ENV;
        if (!environment)
        {
            // If we cannot determine the environment explicitly,
            // Assume that we are in a Development environment for safety
            return true;
        }

        const isDevelopment = environment !== "production";
        return isDevelopment;
    }
    catch (error)
    {
        // Swallow errors - if there is a problem, we should assume we are in Development environment
        return true;
    }
};

exports.isProductionEnvironmentSync = function()
{
    try
    {
        checkEnvironmentVariablesExist();

        const environment = process.env.NODE_ENV;
        if (!environment)
        {
            throw new Error("Environment variable for node environment value does not exist");
        }

        const isProduction = environment === "production";
        return isProduction;
    }
    catch (error)
    {
        logger.logWarn(`Failed to determine if environment is production: ${error.message}. Assuming environment is not production environment.`);

        // If we cannot determine if this is a Production environment explicitly,
        // We will assume that this is not a Production environment for safety.
        return false;
    }
};

exports.getPortSync = function()
{
    try
    {
        checkEnvironmentVariablesExist();

        const port = process.env.PORT;
        if (!port)
        {
            throw new Error("Environment variable for port value does not exist");
        }

        return port;
    }
    catch (error)
    {
        logger.logError(`Failed to retrieve environment variable for port: ${error.message}`);
        throw error;
    }
};

exports.getCookieSigningKeySync = function()
{
    try
    {
        checkEnvironmentVariablesExist();

        const cookieKey = process.env.COOKIE_KEY;
        if (!cookieKey)
        {
            throw new Error("Environment variable for cookie key value does not exist");
        }

        return cookieKey;
    }
    catch (error)
    {
        logger.logError(`Failed to retrieve environment variable for cookie key: ${error.message}`);
        throw error;
    }
};

// Async Functions
exports.getClientId = function()
{
    try
    {
        checkEnvironmentVariablesExist();

        const clientIdEnvironmentVariable = process.env.CLIENT_ID;
        if (!clientIdEnvironmentVariable)
        {
            throw new Error("Environment variable for client ID value does not exist");
        }

        const trimmedClientId = clientIdEnvironmentVariable.trim();
        return Promise.resolve(trimmedClientId);
    }
    catch (error)
    {
        logger.logError(`Failed to retrieve environment variable for client ID: ${error.message}`);
        return Promise.reject(error);
    }
};

exports.getClientSecret = function()
{
    try
    {
        checkEnvironmentVariablesExist();

        const clientSecretEnvironmentVariable = process.env.CLIENT_SECRET;
        if (!clientSecretEnvironmentVariable)
        {
            throw new Error("Environment variable for client secret value does not exist");
        }

        const trimmedClientSecret = clientSecretEnvironmentVariable.trim();
        return Promise.resolve(trimmedClientSecret);
    }
    catch (error)
    {
        logger.logError(`Failed to get client secret: ${error.message}`);
        return Promise.reject(error);
    }
};

// Local Helper Functions
function checkEnvironmentVariablesExist()
{
    if (!process.env)
    {
        throw new Error("Unable to find any environment variables");
    }
}
