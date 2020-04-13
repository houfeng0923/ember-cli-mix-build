const fs = require('fs');
const path = require('path');



function resolve(relative) {
  return path.resolve(process.cwd(), relative);
}

function getTargetPath(source) {
  let flag = '-';
  let i = source.lastIndexOf(flag);
  return source.substring(0, i) + source.substr(i + flag.length);
}


function existSources(sources) {
  return sources.filter(source => fs.existsSync(resolve(source)));
}

function uniq(arr, map = o => o) {
  let set = new Set(arr.map(map));
  return [...set];
}

module.exports = {
  resolve,
  getTargetPath,
  existSources,
  uniq,
};
