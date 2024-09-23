const missingTypesExtractor = require('./extractors/missing-types-extractor');

/**
 * NOTE: order of execution bound to position in the array
 */
module.exports = [
    missingTypesExtractor
]