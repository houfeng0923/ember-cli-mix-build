import Mixin from '@ember/object/mixin';
import { computed, get } from '@ember/object';

export const ExtendedResolverMixin = Mixin.create({

  routesPodsEnabled: true,
  routesPodsDirectory: 'routes',
  routesPodsTypes: computed(() => ['controller', 'route', 'template']),

  routesPodsBasedLookup(parsedName) {
    const { type } = parsedName;
    if (get(this, 'routesPodsTypes').includes(type)) {
      const directory = `${this.namespace.modulePrefix}/${get(this, 'routesPodsDirectory')}`;
      return this.podBasedLookupWithPrefix(directory, parsedName);
    }
  },

  moduleNameLookupPatterns: computed(function() {
    const defaultModulePatters = [...this._super(...arguments)];
    if (get(this, 'routesPodsEnabled')) {
      const routesPodsBasedLookupPattern = get(this, 'routesPodsBasedLookup');
      defaultModulePatters.unshift(routesPodsBasedLookupPattern);
    }
    return defaultModulePatters;
  }),
});

