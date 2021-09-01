const fs = require('fs');
const path = require('path');
const walkSync = require('walk-sync');
const stew = require('broccoli-stew');
const funnel = require('broccoli-funnel');
const mergeTrees = require('broccoli-merge-trees');
const EmberApp = require('ember-cli/lib/broccoli/ember-app');
const defaultsDeep = require('ember-cli-lodash-subset').defaultsDeep;
const WatchedTree = require('./watched-tree');
const { getTargetPath, existSources, resolve, uniq, isEmptyDir, excludeTrim } = require('./util');
const debug = require('debug')('erebor-cli-mix-build:debug');

const EMBER_ENV = process.env.EMBER_ENV;
const EmbeddedPublicPath = 'public';
const SubAppBuildScriptFile = 'build.js';

class EmberCombinedApp extends EmberApp {
  constructor(defaults, options) {
    options = initMixOptions(defaults, options);
    super(defaults, options);
  }

  initializeAddons() {
    super.initializeAddons();
    const extraOptions = this._loadSubProjectCli(this.options);
    if (extraOptions) {
      this.options = defaultsDeep(this.options, extraOptions);
    }
    remapOutputPaths(this.options);
  }

  _loadSubProjectCli(options) {
    const projectBuildScript = resolve(`app-${options.mixBuild.projectName}/${SubAppBuildScriptFile}`);
    if (fs.existsSync(projectBuildScript)) {
      return require(projectBuildScript)(this, options);
    }
  }

  addWatchDirs(nodes = []) {
    // only dev mode
    if (EMBER_ENV === 'development') {
      const watched = new WatchedTree(nodes);
      this.addTree([watched]);
    }
  }

  addTree(trees) {
    if (Array.isArray(trees)) {
      if (!this.extraTrees) this.extraTrees = [];
      this.extraTrees.push(...trees);
    }
  }

  addExcludeDirs(dir) {
    dir = Array.isArray(dir) ? dir: [dir];
    if (!this.excludes) this.excludes = [];
    this.excludes.push(...dir);
  }

  toTree(additionalTrees = []) {
    if (Array.isArray(this.extraTrees)) {
      const extraTrees = mergeTrees(this.extraTrees, { overwrite: true, annotation: 'mix-extra-trees' });
      additionalTrees.push(extraTrees);
    }
    let tree = super.toTree(additionalTrees);
    if (this.excludes.length) {
      tree = new funnel(tree, {
        exclude: this.excludes
      });
    }
    return tree;
  }
}


module.exports = EmberCombinedApp;


function initMixOptions(defaults, defaultOptions) {
  const brandName = getBuildParam('APP_BRAND');
  const projectName = getBuildParam('APP_PROJECT', true);
  const options = { mixBuild: { brandName, projectName } };
  debug(`APP_BRAND: ${brandName}; APP_PROJECT: ${projectName}`);
  if (typeof defaultOptions.hinting === 'undefined') {
    options.hinting = EMBER_ENV === 'development';
  }
  if (typeof defaultOptions.tests === 'undefined') {
    options.tests = EMBER_ENV === 'test';
  }
  if (brandName) {
    options.outputPaths = initOutputPaths(brandName, defaults);
  }
  options.trees = initBuildTrees(projectName, brandName);

  return Object.assign(defaultOptions, options);
}

function initBuildTrees(projectName, brandName) {
  let allApps = existSources(mapAllApps(projectName));
  let appSources = [...allApps];
  let styleSources = existSources(allApps.map(app => `${app}/styles`));
  let templateSources = existSources(allApps.map(app => `${app}/templates`));
  let publicSources = existSources(['public']);
  let embeddedPublicSources = existSources(allApps.map(app => `${app}/${EmbeddedPublicPath}`));

  debug(`trees.app: ${appSources}`);
  debug(`trees.styles: ${styleSources}`);
  debug(`trees.templates: ${templateSources}`);
  debug(`trees.public: ${publicSources} + ${embeddedPublicSources}`);

  appSources = filteredTrees(appSources, { exclude: [EmbeddedPublicPath, SubAppBuildScriptFile] });
  publicSources = publicSourcesMergeTrees([...publicSources, ...embeddedPublicSources], brandName);

  return {
    app: mergeTrees(appSources, { overwrite: true, annotation: 'mix-app' }),
    templates: mergeTrees(templateSources, { overwrite: true, annotation: 'mix-templates' }),
    styles: mergeTrees(styleSources, { overwrite: true, annotation: 'mix-styles' }),
    public: mergeTrees(publicSources, { overwrite: true, annotation: 'mix-public' }),
  };
}

function initOutputPaths(brandName, defaults) {
  const config = defaults.project.config(process.env.EMBER_ENV);
  return {
    app: {
      css: {
        [`app.${brandName}`]: `/assets/${config.modulePrefix}.css`
      },
      js: `/assets/${config.modulePrefix}.js`
    },
  };
}

function remapOutputPaths(options) {
  // remap outputPaths for styles
  const { outputPaths } = options;
  const cssPaths = outputPaths.app.css;
  if (Object.keys(cssPaths).find(k => k.startsWith('app')).length > 1) {
    delete cssPaths['app'];
  }
  debug(`outputPaths.app.css: ${Object.keys(outputPaths.app.css)}`);
}

function mapAllApps(projectName) {
  let fullName = `app-${projectName}`;
  return fullName.split('-').reduce((apps, _, i, arr) => {
    let app = arr.slice(0, i + 1).join('-');
    apps.push(app);
    return apps;
  }, []);
}


function getBuildParam(param, required) {
  let v = process.env[param];
  if (!v && required) {
    throw new Error(`missing required process environment parameter "${param}"`);
  }
  return v && v.toLowerCase();
}

function filteredTrees(sources, options = {}) {
  return sources.map((node) => {
    return funnel(node, {
      annotation: `Filter (${node})`,
      ...options,
    })
  });
}

// resolve [-dir]
function filteredDirReplacedTrees(sources, publicPlaceholder) {
  let filteredDirs = [];
  for (let i = sources.length - 1; i >= 0; i--) {
    const input = resolve(sources[i]);
    let overwritten = walkSync(input, { ignore: [publicPlaceholder], globs: ['**/-*'] })
      .reduce((list, dir) => {
        if (!list.find(({ source: path }) => dir.startsWith(path))) {
          let target = getTargetPath(dir);
          if (isEmptyDir(path.resolve(input, dir))) {
            list.push({ source: dir, match: target });
          } else {
            list.push({ source: dir, target, match: target });
          }
        }
        return list;
      }, [])
      .filter(({ source: dir }) => fs.statSync(resolve(input, dir)).isDirectory());
    filteredDirs.unshift({
      input: sources[i],
      overwritten
    });
  }
  return filteredDirs.map(({ input, overwritten }, index, dirs) => {
    let exclude = dirs.slice(index + 1)
      .reduce((a, d) => a.concat(d.overwritten ? d.overwritten.map(o => o.match) : []), [])
      .filter(Boolean);
    let move = overwritten.filter(o => !exclude.find(e => e === o.source));
    exclude = uniq([publicPlaceholder, ...exclude], p => excludeTrim(p))
    debug(`public tree (${input}) exclude: ${exclude}`);
    debug(`public tree (${input}) move:    ${JSON.stringify(move)}`);

    let tree = funnel(input, { exclude });
    tree = move.reduce((tree, { source, target }) => {
      if (target) return stew.mv(tree, source, target);
      else return stew.rm(tree, excludeTrim(source));
    }, tree);
    return tree;
  });
}

function publicSourcesMergeTrees(publicSources, brandName) {
  let publicPlaceholder = '__ext__';
  return publicSources.reduce((trees, source) => {
    let mergedSources = [source];
    if (brandName) {
      let extPublicSource = `${source}/${publicPlaceholder}/${brandName}`;
      if (fs.existsSync(resolve(extPublicSource))) {
        debug(`extra public tree: ${extPublicSource}`);
        mergedSources.push(extPublicSource);
      }
    }
    trees.push(mergeTrees(
      filteredDirReplacedTrees(mergedSources, publicPlaceholder),
      { overwrite: true, annotation: 'merged public tree' }
    ));
    return trees;
  }, []);
}
