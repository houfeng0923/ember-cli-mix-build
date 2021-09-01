'use strict';

module.exports = {
  name: require('./package').name,

  isDevelopingAddon() {
    return false;
  },

  included() {
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
      pkgInfo = parent.packageInfoCache.getEntry(pkg.path);
      if (pkgInfo) {
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
    if (process.env.SHOW_SLOWEST) {
      require('broccoli-slow-trees')(results.graph.__heimdall__);
    }
  }

};
