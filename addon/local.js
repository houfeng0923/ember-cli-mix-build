// base from https://github.com/ciena-blueplanet/ember-local-resolver

import Resolver from 'ember-resolver';
import { warn } from '@ember/debug';

Resolver.reopen({
  expandLocalLookup: function (targetFullName, sourceFullName) { // eslint-disable-line complexity
    const modulePrefix = this.namespace.modulePrefix;
    const parsedTarget = this.parseName(targetFullName);
    const parsedSource = this.parseName(sourceFullName);

    let sourceName = parsedSource.fullNameWithoutType;
    let targetName = parsedTarget.fullNameWithoutType;
    const targetType = parsedTarget.type;

    if (parsedSource.type !== 'template') {
      warn(`
        Local lookup is currently not implemented outside of templates.
        If you have an additional use case, please open an issue on
        https://github.com/ciena-blueplanet/ember-local-resolver/issues
        to discuss.
      `);
      return `${parsedTarget.type}:${sourceName}/${targetName}`;
    }

    // Remove the prefix and extension from the source module name
    const prefixLength = `${modulePrefix}/`.length;
    const extensionLength = '/template/hbs'.length;

    sourceName = sourceName.slice(prefixLength, -extensionLength);

    // In a pods structure local components/helpers are nested In
    // -components or -helpers directories to align with the module unification RFC
    // https://github.com/dgeb/rfcs/blob/module-unification/text/0000-module-unification.md#private-collections
    switch (targetType) {
      case 'component':
      case 'template':
        sourceName = `${sourceName}/-components`;
        break;
      case 'helper':
        sourceName = `${sourceName}/-helpers`;
        break;
    }

    // Remove the prefix from the target module name
    if (parsedTarget.type === 'template' && targetName.indexOf('components') === 0) {
      const prefixLength = 'components/'.length;
      targetName = targetName.slice(prefixLength);
    }

    return `${parsedTarget.type}:${sourceName}/${targetName}`;
  }
});

export default Resolver;
