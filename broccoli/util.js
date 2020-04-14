const fs = require('fs');
const path = require('path');
const walkSync = require('walk-sync');



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

function isEmptyDir(dir, options = { ignore: ['.gitkeep'] }) {
  let list = walkSync(path.resolve(dir), options );
  return list.length === 0;
}

function excludeTrim(pathname) {
  return pathname.replace(/(.*)\/$/, '$1');
}

module.exports = {
  resolve,
  getTargetPath,
  existSources,
  uniq,
  isEmptyDir,
  excludeTrim
};
