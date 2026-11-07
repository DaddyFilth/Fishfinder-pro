'use strict';

const upstream = require('minimatch-v11');

function minimatchCompat(p, pattern, options) {
  return upstream.minimatch(p, pattern, options);
}

Object.assign(minimatchCompat, upstream, upstream.minimatch);
minimatchCompat.minimatch = upstream.minimatch;
minimatchCompat.default = minimatchCompat;

module.exports = minimatchCompat;
