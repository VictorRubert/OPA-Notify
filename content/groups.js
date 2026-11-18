// Label ordering and unread groups are inspired by Opa!Alert (see LICENSE).
(() => {
  if (globalThis.OpaNotifyGroups) return;
  const css = `
    .opa-groups-native { display:flex!important; flex-direction:column!important; gap:0!important }
    .opa-groups-item { order:var(--opa-group-order)!important }
    .opa-groups-hidden { display:none!important }
    .opa-groups-head,.opa-groups-toggle { box-sizing:border-box;width:100%;text-align:start;font-family:inherit;cursor:pointer;border:0;border-radius:0;flex:none }
    .opa-groups-head { display:flex;align-items:center;gap:7px;min-height:35px;padding:6px 10px;border-block-end:1px solid #4a4140;background:#302c2d;color:#ffae38;font-size:11px;font-weight:700;line-height:1.25;letter-spacing:.035em;text-transform:uppercase }
    .opa-groups-head[data-subgroup] { padding-inline-start:21px;background:#252933;color:#a4b4c9;border-color:#3a414d }
    .opa-groups-head:hover { filter:brightness(1.12) }
    .opa-groups-head:focus-visible,.opa-groups-toggle:focus-visible { outline:2px solid currentColor;outline-offset:-2px }
    .opa-groups-arrow { width:6px;height:6px;flex:none;box-sizing:border-box;border:solid currentColor;border-width:0 1.5px 1.5px 0;transform:rotate(-45deg) }
    [aria-expanded=true] > .opa-groups-arrow { transform:translateY(-1px) rotate(45deg) }
    .opa-groups-name { flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap }
    .opa-groups-count { flex:none;min-width:17px;text-align:center;padding:1px 5px;border-radius:4px;background:#5b432b;font-size:10px;font-variant-numeric:tabular-nums }
    [data-subgroup] > .opa-groups-count { background:#343e4b }
    .opa-groups-dot { color:#ffba4e;font-size:10px }
    .opa-groups-toggle { display:block;padding:6px 10px;line-height:18px;color:inherit;background:color-mix(in srgb,currentColor 8%,transparent);font-size:12px;font-weight:600 }
    .opa-groups-frame { display:flex;flex-direction:column;min-height:0 }
    .opa-groups-viewport { overflow-y:auto!important;overflow-anchor:none;min-height:0 }
    .opa-groups-clip { height:var(--opa-layout-height,auto)!important;overflow:clip!important;flex:none!important }
    .opa-groups-expanded { flex:none!important;height:var(--opa-native-height)!important;max-height:none!important;overflow:visible!important }
    .opa-groups-virtual { height:auto!important;min-height:0!important;position:relative }
    .opa-groups-virtual > .opa-groups-item { position:relative!important;inset:auto!important;transform:none!important;flex:none!important }
    /* Keep collapsed wrappers measurable for the Opa variable-height virtualizer. */
    .opa-groups-virtual > .opa-groups-hidden { display:block!important;visibility:hidden!important;pointer-events:none!important;position:absolute!important;inset:0 0 auto!important }
  `;
  const fold = name => name.trim().toLocaleLowerCase();
  function element(tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function removeOrder(node) {
    node.classList.remove('opa-groups-item', 'opa-groups-hidden');
    node.style.removeProperty('--opa-group-order');
  }

  class Groups {
    constructor() {
      this.collapsed = new Set();
      this.headers = [];
      this.items = [];
      this.paths = new Map();
      this.grouped = true;
    }

    clearLayout() {
      this.resize?.disconnect();
      this.extent?.disconnect();
      for (const node of this.headers) node.remove();
      for (const item of this.items) removeOrder(item.node);
      this.headers = [];
      this.paths.clear();
      this.root?.classList.remove('opa-groups-native', 'opa-groups-virtual');
      this.viewport?.classList.remove('opa-groups-viewport');
      this.clip?.classList.remove('opa-groups-clip');
      this.clip?.style.removeProperty('--opa-layout-height');
      this.scroller?.classList.remove('opa-groups-expanded');
      this.scroller?.style.removeProperty('--opa-native-height');
      if (this.viewport) {
        this.viewport.scrollTop = this.previousViewportTop;
        this.scroller.scrollTop = this.previousNativeTop;
      }
      this.resize = this.extent = this.viewport = this.clip = null;
    }

    clear() {
      if (!this.root) return;
      this.clearLayout();
      this.toggle?.remove();
      this.frame?.classList.remove('opa-groups-frame');
      this.toggle = this.root = this.frame = this.scroller = this.signature = null;
      this.items = [];
    }

    reveal(id) {
      const path = this.paths.get(id);
      if (path?.some(key => this.collapsed.has(key))) {
        for (const key of path) this.collapsed.delete(key);
        this.render();
      }
    }

    update(list, rows, settings, modern) {
      const root = modern ? list.querySelector('[itemid]')?.closest('ul') || list.querySelector('ul') : list;
      if (!root) { this.clear(); return; }
      if (!document.getElementById('opa-groups-style')) {
        const style = element('style', '', css);
        style.id = 'opa-groups-style';
        document.head.append(style);
      }
      if (root !== this.root || (modern && !this.toggle?.isConnected)) {
        this.clear();
        this.root = root;
        if (modern) {
          this.scroller = root.closest('.sidebar-scroll, .overflow-auto') || root;
          this.frame = this.scroller.parentElement;
          this.frame.classList.add('opa-groups-frame');
          this.toggle = element('button', 'opa-groups-toggle');
          this.toggle.type = 'button';
          this.toggle.onclick = () => {
            this.grouped = !this.grouped;
            this.render();
          };
          this.scroller.before(this.toggle);
        }
      }
      const signature = JSON.stringify([settings.tagMode, settings.groupTags, settings.priorityTags,
        rows.map(({ id, tags, pinned, unread }) => [id, tags, pinned, unread])]);
      const sameRows = this.signature === signature && this.items.every((item,i) => item.node === rows[i].node);
      if (sameRows && this.headers.every(header => header.parentElement === root)) {
        if (this.toggle && this.grouped) this.groupVirtualRows();
        return;
      }
      const present = new Set(rows.map(row => row.node));
      for (const item of this.items) if (!present.has(item.node)) removeOrder(item.node);
      this.items = rows;
      this.settings = settings;
      this.signature = signature;
      this.render();
    }

    groupVirtualRows() {
      // Opa mounts only the rows inside its scroll viewport. Give that viewport
      // the native virtual extent so Opa mounts its own interactive cards. Its
      // parent clips the unused space; the enclosing column scrolls the groups.
      if (this.resize || !this.scroller || this.scroller === this.root || !this.root.style.height) return;
      this.clip = this.scroller.parentElement;
      this.viewport = this.clip.parentElement;
      this.previousViewportTop = this.viewport.scrollTop;
      this.previousNativeTop = this.scroller.scrollTop;
      this.viewport.classList.add('opa-groups-viewport');
      this.clip.classList.add('opa-groups-clip');
      this.root.classList.add('opa-groups-virtual');
      this.scroller.classList.add('opa-groups-expanded');
      const syncExtent = () => {
        const height = this.root.style.height;
        this.scroller.style.setProperty('--opa-native-height', height || 'auto');
      };
      const syncLayout = () => {
        if (!this.clip) return;
        const height = this.root.offsetHeight + this.toggle.offsetHeight;
        this.clip.style.setProperty('--opa-layout-height', height + 'px');
      };
      syncExtent();
      this.scroller.scrollTop = 0;
      this.extent = new MutationObserver(syncExtent);
      this.extent.observe(this.root, { attributes:true, attributeFilter:['style'] });
      this.resize = new ResizeObserver(syncLayout);
      this.resize.observe(this.root);
      this.resize.observe(this.toggle);
      syncLayout();
    }

    render() {
      for (const node of this.headers) node.remove();
      this.headers = [];
      this.paths.clear();
      if (this.toggle) {
        this.toggle.textContent = this.grouped ? 'Voltar à lista do Opa' : 'Por etiquetas';
        this.toggle.setAttribute('aria-expanded', String(this.grouped));
        if (!this.grouped) { this.clearLayout(); return; }
        this.groupVirtualRows();
      }
      this.root.classList.add('opa-groups-native');
      const priorities = new Map(this.settings.priorityTags.map((name, i) => [fold(name), i]));
      const selection = new Set(this.settings.groupTags.map(fold));
      const tree = { groups:new Map(), items:[] };
      for (const item of this.items) {
        const names = new Map();
        for (const tag of item.tags) {
          const key = fold(tag);
          if (key && selection.has(key) === (this.settings.tagMode === 'include')) names.set(key, tag);
        }
        // Keep the native order for equally ranked labels. Remaining labels
        // are still visible on the card without adding further heading levels.
        const labels = [...names].sort(([a], [b]) => (priorities.get(a) ?? Infinity) - (priorities.get(b) ?? Infinity));
        if (item.pinned) labels.unshift([':pinned', 'Fixados']);
        if (!labels.length) labels.push([':none', 'Sem grupo']);
        let branch = tree;
        const path = [];
        const ancestors = [];
        for (const [key, label] of labels.slice(0, 2)) {
          path.push(key);
          const groupPath = JSON.stringify(path);
          ancestors.push(groupPath);
          if (!branch.groups.has(key)) branch.groups.set(key, { key, label, path:groupPath, groups:new Map(), items:[], count:0, unread:false });
          branch = branch.groups.get(key);
          branch.count++;
          branch.unread ||= item.unread;
        }
        branch.items.push(item);
        this.paths.set(item.id, ancestors);
      }

      let order = 0;
      const rank = key => key === ':pinned' ? -1 : key === ':none' ? Infinity : priorities.get(key) ?? 100000;
      const draw = (branch, depth, visible) => {
        for (const item of branch.items) {
          item.node.classList.add('opa-groups-item');
          item.node.style.setProperty('--opa-group-order', ++order);
          item.node.classList.toggle('opa-groups-hidden', !visible);
        }
        const groups = [...branch.groups.values()].sort((a,b) => rank(a.key) - rank(b.key) || a.label.localeCompare(b.label));
        for (const group of groups) {
          const expanded = !this.collapsed.has(group.path);
          if (visible) {
            const head = element('button', 'opa-groups-head');
            head.type = 'button';
            head.style.order = ++order;
            head.toggleAttribute('data-subgroup', depth > 0);
            head.setAttribute('aria-expanded', String(expanded));
            head.setAttribute('aria-label', group.label + ' (' + group.count + ')' + (group.unread ? ', mensagem não lida' : ''));
            head.append(element('span', 'opa-groups-arrow'), element('span', 'opa-groups-name', group.label));
            if (group.unread) head.append(element('span', 'opa-groups-dot', '●'));
            head.append(element('span', 'opa-groups-count', group.count));
            head.onclick = () => {
              if (expanded) this.collapsed.add(group.path); else this.collapsed.delete(group.path);
              this.render();
              this.headers.find(h => h.dataset.path === group.path)?.focus({preventScroll:true});
            };
            head.dataset.path = group.path;
            this.headers.push(head);
            this.root.append(head);
          }
          draw(group, depth + 1, visible && expanded);
        }
      };
      draw(tree, 0, true);
    }
  }
  globalThis.OpaNotifyGroups = Groups;
})();
