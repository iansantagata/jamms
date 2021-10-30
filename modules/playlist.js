"use strict";

// Dependencies
const path = require("path"); // URI and local file paths
const probe = require("probe-image-size"); // Image dimensional details

// Utility Modules
const utilityModulesPath = path.join(__dirname, "utilityModules");
const logger = require(path.join(utilityModulesPath, "logger.js"));
const spotifyClient = require(path.join(utilityModulesPath, "spotifyClient.js"));

// Playlist Logic
exports.getPlaylistPage = async function(req, res, next)
{
    // Grab single playlist data that the user has requested
    try
    {
        const spotifyResponse = await spotifyClient.getSinglePlaylist(req, res);

        const images = await getMissingImageDimensions(spotifyResponse.images);

        const playlistData = {
            deleted: false,
            followersCount: spotifyResponse.followers.total,
            images: images,
            isCollaborative: spotifyResponse.collaborative,
            isPublic: spotifyResponse.public,
            playlistDescription: spotifyResponse.description,
            playlistId: spotifyResponse.id,
            playlistName: spotifyResponse.name,
            trackCount: spotifyResponse.tracks.total
        };

        // Shove the playlist response data onto the playlist page for the user to interact with
        res.location("/playlist");
        res.render("viewPlaylist", playlistData);
    }
    catch (error)
    {
        logger.logError(`Failed to get playlist page: ${error.message}`);
        next(error);
    }
};

exports.getAllPlaylistPage = async function(req, res, next)
{
    // Grab all playlist data from the user to show them on the home page in case they want to edit their playlists
    try
    {
        const spotifyResponse = await spotifyClient.getAllPlaylists(req, res);

        const numberOfPages = Math.ceil(spotifyResponse.total / spotifyResponse.limit);
        const currentPage = Math.floor((spotifyResponse.offset + spotifyResponse.limit) / spotifyResponse.limit);

        const playlists = await getMissingImageDimensionsForPlaylists(spotifyResponse.items);

        const playlistsPageData = {
            currentPage: currentPage,
            numberOfPages: numberOfPages,
            numberOfPlaylistsPerPage: spotifyResponse.limit,
            playlists: playlists,
            totalNumberOfPlaylists: spotifyResponse.total
        };

        // Shove the playlist response data onto the playlists page for the user to interact with
        res.render("viewPlaylists", playlistsPageData);
    }
    catch (error)
    {
        logger.logError(`Failed to get all playlists page: ${error.message}`);
        next(error);
    }
};

exports.deletePlaylistPage = async function(req, res, next)
{
    // Grab single playlist data that the user has requested, then delete the playlist
    try
    {
        const spotifyResponse = await spotifyClient.getSinglePlaylist(req, res);
        await spotifyClient.deleteSinglePlaylist(req, res);

        const playlistData = {
            deleted: true,
            followersCount: spotifyResponse.followers.total,
            images: spotifyResponse.images,
            isCollaborative: spotifyResponse.collaborative,
            isPublic: spotifyResponse.public,
            playlistDescription: spotifyResponse.description,
            playlistId: spotifyResponse.id,
            playlistName: spotifyResponse.name,
            trackCount: spotifyResponse.tracks.total
        };

        // Shove the playlist response data onto the home page for the user to interact with
        res.location("/playlist");
        res.render("viewPlaylist", playlistData);
    }
    catch (error)
    {
        logger.logError(`Failed to get delete playlist page: ${error.message}`);
        next(error);
    }
};

exports.restorePlaylistPage = async function(req, res, next)
{
    // Restore the playlist that was previously deleted, then grab that single playlist data
    try
    {
        await spotifyClient.restoreSinglePlaylist(req, res);
        const spotifyResponse = await spotifyClient.getSinglePlaylist(req, res);

        const playlistData = {
            deleted: false,
            followersCount: spotifyResponse.followers.total,
            images: spotifyResponse.images,
            isCollaborative: spotifyResponse.collaborative,
            isPublic: spotifyResponse.public,
            playlistDescription: spotifyResponse.description,
            playlistId: spotifyResponse.id,
            playlistName: spotifyResponse.name,
            trackCount: spotifyResponse.tracks.total
        };

        // Shove the playlist response data onto the playlist page for the user to interact with
        res.location("/playlist");
        res.render("viewPlaylist", playlistData);
    }
    catch (error)
    {
        logger.logError(`Failed to get restore playlist page: ${error.message}`);
        next(error);
    }
};

// Helper Functions
async function getMissingImageDimensionsForPlaylists(playlists)
{
    if (!playlists)
    {
        return Promise.resolve(playlists);
    }

    for (const playlist of playlists)
    {
        if (!playlist)
        {
            continue;
        }

        const images = playlist.images;
        playlist.images = await getMissingImageDimensions(images);
    }

    return Promise.resolve(playlists);
}

async function getMissingImageDimensions(images)
{
    if (!images)
    {
        return Promise.resolve(images);
    }

    for (const image of images)
    {
        if (!image)
        {
            continue;
        }

        // With an image url but no dimensions, make sure dimensions are populated
        if (image.url && (!image.width || !image.height))
        {
            try
            {
                const probeResult = await probe(image.url);

                // If probe was successful, set the dimension fields on the image
                image.width = probeResult.width;
                image.height = probeResult.height;
            }
            catch (error)
            {
                // Do not want to throw an error here because we have a fallback default image already
                logger.logWarn(`Failed to probe image dimensions: ${error.message}`);
                continue;
            }
        }
    }

    return Promise.resolve(images);
}
