'use strict';

module.exports = {
  name: require('./package').name,

  isDevelopingAddon() {
    return false;
  },

  included(parent) {
    this._super.included.apply(this, arguments);
    this.app = this._findHost();
    this.lintTreeInjection();
  },

  lintTreeInjection() {
    let lintCli = 'ember-cli-lint';
    let parent = this.parent;
    let addon, pkgInfo;
    if (!parent.addonPackages[lintCli] && this.addonPackages[lintCli]) {
      let pkg = parent.addonPackages[lintCli] = this.addonPackages[lintCli];
      delete this.addonPackages[lintCli];
      if (pkgInfo = parent.packageInfoCache.getEntry(pkg.path)) {
        let index = this.addons.findIndex((_) => _.constructor === pkgInfo.getAddonConstructor());
        if (index > -1) {
          parent.addons.push(addon = this.addons[index]);
          this.addons.splice(index, 1);
        }
      }
    }
    if (addon && addon.included) {
      addon.included(parent);
    }
  },

  postBuild(results) {
    if (process.argv.indexOf('--show-slowest') > -1) {
      require('broccoli-slow-trees')(results.graph.__heimdall__);
    }
  }

};
