"use strict";

// Dependencies
const path = require("path"); // URI and local file paths

// Custom Modules
const customModulePath = path.join(__dirname, "..");
const logger = require(path.join(customModulePath, "logger.js"));

// Smart Playlist Modules
const smartPlaylistModulesPath = __dirname;
const helperFunctions = require(path.join(smartPlaylistModulesPath, "helperFunctions.js"));
const enrichment = require(path.join(smartPlaylistModulesPath, "enrichment.js"));
const specialRules = require(path.join(smartPlaylistModulesPath, "specialRules.js"));
const dataRetrieval = require(path.join(smartPlaylistModulesPath, "dataRetrieval.js"));
const comparisons = require(path.join(smartPlaylistModulesPath, "comparisons.js"));
const limits = require(path.join(smartPlaylistModulesPath, "limits.js"));
const operators = require(path.join(smartPlaylistModulesPath, "operators.js"));
const ordering = require(path.join(smartPlaylistModulesPath, "ordering.js"));
const rules = require(path.join(smartPlaylistModulesPath, "rules.js"));

// Ordering Logic
exports.getPlaylistOrdering = function(req)
{
    // Default object to return if playlist ordering is disabled or errors arise
    const defaultPlaylistOrderData = {
        comparisonFunction: null,
        direction: null,
        enabled: false,
        field: null
    };

    // Create a new object to build and return (cannot use same object because of shallow references)
    const playlistOrderData = {
        ...defaultPlaylistOrderData
    };

    playlistOrderData.enabled = Boolean(req.body.playlistOrderEnabled);
    if (!playlistOrderData)
    {
        return defaultPlaylistOrderData;
    }

    playlistOrderData.field = req.body.playlistOrderField;
    switch (playlistOrderData.field)
    {
        case "artist":
        case "album":
        case "release date":
        case "duration":
        case "library add date":
        case "popularity":
        case "song":
            break;

        // If order field is not provided or value is unknown, disable ordering
        default:
            return defaultPlaylistOrderData;
    }

    playlistOrderData.direction = req.body.playlistOrderDirection;
    switch (playlistOrderData.direction)
    {
        case "descending":
        case "ascending":
            break;

        // If order direction is not provided or value is unknown, disable ordering
        default:
            return defaultPlaylistOrderData;
    }

    // After parsing all the inputs to ensure they are valid, now we can get a valid ordering function
    playlistOrderData.comparisonFunction = getOrderingFunction(playlistOrderData.field, playlistOrderData.direction);
    if (!playlistOrderData.comparisonFunction)
    {
        return defaultPlaylistOrderData;
    }

    return playlistOrderData;
}

exports.getOrderForTracks = function(targetTrackIndex, tracks, orderOfTracks, orderComparisonFunction)
{
    if (!Array.isArray(orderOfTracks))
    {
        return [];
    }

    if (typeof targetTrackIndex !== "number" || isNaN(targetTrackIndex))
    {
        return orderOfTracks;
    }

    if (!Array.isArray(tracks) || tracks.length <= 0)
    {
        return orderOfTracks;
    }

    if (typeof orderComparisonFunction !== "function")
    {
        return orderOfTracks;
    }

    // Figure out where this track goes in the existing ordering
    let targetOrderIndex = 0;
    let lowerBoundInclusive = 0;
    let upperBoundExclusive = orderOfTracks.length;
    const trackToInsert = tracks[targetTrackIndex];

    // Converge on the location to insert by moving the bounds until they are equal
    while (lowerBoundInclusive !== upperBoundExclusive)
    {
        // Grab the closest approximation to the middle index in the remaining bounded range
        // This is done in order to shrink the search space and use O(log(n)) instead of O(n)
        targetOrderIndex = upperBoundExclusive - 1 - Math.floor((upperBoundExclusive - lowerBoundInclusive) / 2);

        // Use the order index to retrieve the target track
        const targetTrack = tracks[orderOfTracks[targetOrderIndex]];

        // Compare the track to be inserted against the track at the current index
        const comparisonResult = orderComparisonFunction(trackToInsert, targetTrack);

        // Track to insert should come in order before the target track
        if (comparisonResult < 0)
        {
            upperBoundExclusive = targetOrderIndex;
        }

        // Track to insert should come in order after the target track
        else if (comparisonResult > 0)
        {
            lowerBoundInclusive = targetOrderIndex + 1;
        }

        // Track to insert is equivalent in order to the target track
        else
        {
            lowerBoundInclusive = targetOrderIndex;
            upperBoundExclusive = targetOrderIndex;
        }
    }

    // Insert into the order array, pushing everything at the index (inclusive) back
    targetOrderIndex = lowerBoundInclusive;
    orderOfTracks.splice(targetOrderIndex, 0, targetTrackIndex);
    return orderOfTracks;
}

// Local Helper Functions
function getOrderingFunction(orderField, orderDirection)
{
    let orderingFunction = () => {};

    switch (orderField)
    {
        case "artist":
            orderingFunction = getOrderingFunctionByDirection(
                comparisons.compareByArtistAscending,
                comparisons.compareByArtistDescending,
                orderDirection);
            break;

        case "album":
            orderingFunction = getOrderingFunctionByDirection(
                comparisons.compareByAlbumAscending,
                comparisons.compareByAlbumDescending,
                orderDirection);
            break;

        case "release date":
            orderingFunction = getOrderingFunctionByDirection(
                comparisons.compareByReleaseAscending,
                comparisons.compareByReleaseDescending,
                orderDirection);
            break;

        case "duration":
            orderingFunction = getOrderingFunctionByDirection(
                comparisons.compareByDurationAscending,
                comparisons.compareByDurationDescending,
                orderDirection);
            break;

        case "library add date":
            orderingFunction = getOrderingFunctionByDirection(
                comparisons.compareByLibraryAscending,
                comparisons.compareByLibraryDescending,
                orderDirection);
            break;

        case "popularity":
            orderingFunction = getOrderingFunctionByDirection(
                comparisons.compareByPopularityAscending,
                comparisons.compareByPopularityDescending,
                orderDirection);
            break;

        case "song":
        default:
            orderingFunction = getOrderingFunctionByDirection(
                comparisons.compareBySongAscending,
                comparisons.compareBySongDescending,
                orderDirection);
            break;
    }

    return orderingFunction;
}

function getOrderingFunctionByDirection(ascendingFunction, descendingFunction, direction)
{
    let orderingFunctionByDirection = () => {};

    switch (direction)
    {
        case "descending":
            orderingFunctionByDirection = descendingFunction;
            break;

        case "ascending":
        default:
            orderingFunctionByDirection = ascendingFunction;
            break;
    }

    return orderingFunctionByDirection;
}
