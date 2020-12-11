const fs = require('fs');
const path = require('path');
const Plugin = require('broccoli-plugin');

class WatchedTree extends Plugin {
  constructor(inputNodes, options) {
    options = options || {};
    Object.assign(options, {
      persistentOutput: true,
      needsCache: false,
      annotation: options.annotation || ('Watched - ' + inputNodes)
    });
    super(inputNodes, options);
  }

  build() {
    fs.writeFileSync(path.join(this.outputPath, 'empty.js'), '', {
      encoding: 'utf-8'
    });
  }
}

module.exports = WatchedTree;
