(() => {
  const statuses = Object.freeze(['AJUDA', 'FINALIZADO', 'AJUDANDO', 'PAUSADO', 'ASSUMIDO']);
  const normalize = name => name.trim().toLocaleUpperCase('pt-BR');
  const defaults = Object.freeze({
    groupByTag: true, tagMode: 'include', groupTags: statuses, priorityTags: statuses
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

  globalThis.OpaTagSettings = Object.freeze({ defaults, tagRank, isStatus: name => statuses.includes(normalize(name)) });
})();
