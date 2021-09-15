// Dependencies
var path = require('path'); // URI and local file paths

// Custom Modules
const customModulePath = __dirname;
var spotifyClient = require(path.join(customModulePath, 'spotifyClient.js'));
var login = require(path.join(customModulePath, 'login.js'));
var logger = require(path.join(customModulePath, 'logger.js'));

// Home Logic
exports.getLandingPage = async function(req, res, next)
{
    try
    {
        // Try to get the home page if the user is already logged in or can authenticate
        await login.isUserLoggedIn(req, res); // Rejects promise if user is not logged in
        var homePageData = await getHomePageData(req, res);
        renderHomePage(res, homePageData);
    }
    catch (homePageError)
    {
        try
        {
            // If authentication fails or the user has not logged in yet, try to send them to the landing page
            var landingPageData = {
                isAwaitingLogin: true
            };

            res.location('/');
            res.render('landing', landingPageData);
        }
        catch (landingPageError)
        {
            logger.logError('Failed to get home page from landing page: ' + homePageError.message);
            logger.logError('Failed to get landing page: ' + landingPageError.message);
            next(landingPageError);
            return;
        }
    }
}

exports.getHomePage = async function(req, res, next)
{
    try
    {
        var homePageData = await getHomePageData(req, res);
        renderHomePage(res, homePageData);
    }
    catch (error)
    {
        logger.logError('Failed to get home page: ' + error.message);
        next(error);
        return;
    }
};

// Local Helper Functions
getHomePageData = async function(req, res)
{
    // We want a broad overlook of data for the home page, showing users all of their data at a glance
    try
    {
        var spotifyResponse = await spotifyClient.getUserData(req, res);
    }
    catch (error)
    {
        logger.logError('Failed to get home page data: ' + error.message);
        return Promise.reject(error);
    }

    var homePageData = {
        numberOfPlaylists: spotifyResponse.numberOfPlaylists,
        samplePlaylistData: spotifyResponse.samplePlaylistData,
        numberOfArtists: spotifyResponse.numberOfArtists,
        sampleArtistData: spotifyResponse.sampleArtistData,
        numberOfTracks: spotifyResponse.numberOfTracks,
        sampleTrackData: spotifyResponse.sampleTrackData
    };

    return Promise.resolve(homePageData);
}

renderHomePage = function(res, homePageData)
{
    // Shove the playlist response data onto the home page for the user to interact with
    res.location('/home');
    res.render('home', homePageData);
}
