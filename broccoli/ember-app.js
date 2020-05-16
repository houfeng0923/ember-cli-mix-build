const fs = require('fs');
const path = require('path');
const walkSync = require('walk-sync');
const stew = require('broccoli-stew');
const funnel = require('broccoli-funnel');
const mergeTrees = require('broccoli-merge-trees');
const EmberApp = require('ember-cli/lib/broccoli/ember-app');
const { getTargetPath, existSources, resolve, uniq, isEmptyDir, excludeTrim } = require('./util');
const debug = require('debug')('erebor-cli-mix-build:debug');

const EmbeddedPublicPath = 'public';
const SubAppBuildScriptFile = 'build.js';

class EmberCombinedApp extends EmberApp {
  constructor(defaults, options) {
    const config = defaults.project.config(process.env.EMBER_ENV);
    const [brandName] = getBuildParams(['APP_BRAND']);
    const [projectName] = getBuildParams(['APP_PROJECT'], true);
    config.brandName = brandName;
    config.projectName = projectName;
    options = initHybridOptions(config, options);
    super(defaults, options);
    this.config = config;
    this.remapStyleOutput();
    this.addonProjectExtraTrees();
  }

  remapStyleOutput() {
    // remap outputPaths for styles
    const { outputPaths } = this.options;
    const cssPaths = outputPaths.app.css;
    if (Object.keys(cssPaths).find(k => k.startsWith('app')).length > 1) {
      delete cssPaths['app'];
    }
    debug(`outputPaths.app.css: ${Object.keys(outputPaths.app.css)}`);
  }

  addonProjectExtraTrees() {
    this.projectExtraTrees = [];
    const projectName = this.config.projectName;
    const projectBuildScript = resolve(`${projectName}/${SubAppBuildScriptFile}`);
    if (fs.existsSync(projectBuildScript)) {
      let trees = require(projectBuildScript)(this);
      if (trees) {
        this.projectExtraTrees.push(...trees);
      }
    }
  }

  toTree(additionalTrees = []) {
    additionalTrees.push(...this.projectExtraTrees||[]);
    return super.toTree(additionalTrees);
  }
}


module.exports = EmberCombinedApp;


function initHybridOptions(config, defaultOptions) {
  const EMBER_ENV = process.env.EMBER_ENV;
  const options = {};
  const [brandName] = getBuildParams(['APP_BRAND']);
  const [projectName] = getBuildParams(['APP_PROJECT'], true);
  debug(`APP_BRAND: ${brandName}; APP_PROJECT: ${projectName}`);

  if (typeof defaultOptions.hinting === 'undefined') {
    options.hinting = EMBER_ENV === 'development';
  }
  if (typeof defaultOptions.tests === 'undefined') {
    options.tests = EMBER_ENV === 'test';
  }
  if (brandName) {
    options.outputPaths = initOutputPaths(brandName, config);
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

function initOutputPaths(brandName, config) {
  return {
    app: {
      css: {
        [`app.${brandName}`]: `/assets/${config.modulePrefix}.css`
      },
      js: `/assets/${config.modulePrefix}.js`
    },
  };
}

function mapAllApps(projectName) {
  return projectName.split('-').reduce((apps, _, i, arr) => {
    let app = arr.slice(0, i + 1).join('-');
    apps.push(app);
    return apps;
  }, []);
}


function getBuildParams(params, required) {
  return params.map(key => {
    let v = process.env[key];
    if (!v && required) {
      throw new Error(`missing required process environment parameter "${key}"`);
    }
    return v && v.toLowerCase();
  });
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
