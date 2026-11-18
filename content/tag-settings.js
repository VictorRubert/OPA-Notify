(() => {
  const statuses = Object.freeze(['AJUDA', 'FINALIZADO', 'AJUDANDO', 'PAUSADO', 'ASSUMIDO']);
  const normalize = name => name.trim().toLocaleUpperCase('pt-BR');
  const defaults = Object.freeze({
    groupByTag: false,
    tagMode: 'include',
    groupTags: Object.freeze(['ASSUMIDO AGENTE SMITH', 'AJUDA AGENTE SMITH', 'PAUSA AGENTE SMITH', 'FINALIZADO AGENTE SMITH', 'AJUDANDO AGENTE SMITH']),
    priorityTags: Object.freeze(['AJUDA AGENTE SMITH', 'FINALIZADO AGENTE SMITH', 'AJUDANDO AGENTE SMITH', 'PAUSA AGENTE SMITH', 'ASSUMIDO AGENTE SMITH'])
  });

  // Built-in status names match a whole leading word. User-defined names
  // (including a particular agent's full label) continue to match exactly.
  function tagRank(name, rules) {
    const fullName = normalize(name);
    const status = fullName.split(/[\s:–—-]+/, 1)[0];
    const index = rules.findIndex(rule => {
      const value = normalize(rule);
      return value === fullName || (statuses.includes(value) && value === status);
    });
    return index < 0 ? Infinity : index;
  }

  function migrateDefaults(stored) {
    if (stored.tagDefaultsVersion >= 2) return {};
    const patch = { tagDefaultsVersion: 2 };
    const previousList = list => Array.isArray(list) && list.length === statuses.length &&
      list.every((tag, i) => tag === statuses[i]);
    const oldPreset = stored.tagMode === 'include' && previousList(stored.groupTags) && previousList(stored.priorityTags);
    const oldEmpty = !stored.tagDefaultsVersion && stored.tagMode === 'exclude' &&
      stored.groupTags?.length === 0 && stored.priorityTags?.length === 0;
    if (oldPreset || oldEmpty) {
      Object.assign(patch, { tagMode: defaults.tagMode, groupTags: defaults.groupTags, priorityTags: defaults.priorityTags });
      // 1.6.2 enabled its stock preset on install. Restore opt-in for that preset.
      if (oldPreset) patch.groupByTag = false;
    }
    return patch;
  }

  const isStatus = name => statuses.includes(normalize(name)) || defaults.groupTags.includes(normalize(name));
  globalThis.OpaTagSettings = Object.freeze({ defaults, tagRank, isStatus, migrateDefaults });
})();
