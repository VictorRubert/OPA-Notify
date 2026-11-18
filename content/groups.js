// Label ordering and unread groups are inspired by Opa!Alert (see LICENSE).
(() => {
  if (globalThis.OpaNotifyGroups) return;
  const css = `
    .opa-groups-native { display:flex!important; flex-direction:column!important }
    .opa-groups-item { order:var(--opa-group-order)!important }
    .opa-groups-hidden { display:none!important }
    .opa-groups-head,.opa-groups-toggle,.opa-groups-row { display:block;width:100%;text-align:start;box-sizing:border-box;color:inherit;font:inherit;cursor:pointer;padding:7px 10px;border:0;border-bottom:1px solid #8885 }
    .opa-groups-head,.opa-groups-toggle { font-weight:600;background:color-mix(in srgb, currentColor 10%, transparent) }
    .opa-groups-row { background:transparent }
    .opa-groups-row:hover,.opa-groups-row:focus { background:#8883 }
    .opa-groups-frame { position:relative;display:flex;flex-direction:column;min-height:0 }
    .opa-groups-frame > .opa-groups-scroll { flex:1 1 auto;min-height:0 }
    .opa-groups-panel { position:absolute;inset:0;overflow:auto;z-index:2;background:var(--color-background-secondary, Canvas);color:inherit;color-scheme:inherit }
    .opa-groups-toggle { flex:none }
    .opa-groups-panel[hidden] { display:none }
    .opa-groups-new { border-inline-start:4px solid #965af0 }
  `;
  const fold = name => name.trim().toLocaleLowerCase();
  const button = (className, text) => {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = className;
    element.textContent = text;
    return element;
  };

  class Groups {
    constructor(open) {
      this.open = open;
      this.collapsed = new Set();
      this.decorated = [];
      this.headers = [];
      this.rows = new Map();
      this.grouped = true;
    }

    clear() {
      if (!this.root) return;
      for (const node of this.decorated) {
        node.classList.remove('opa-groups-item', 'opa-groups-hidden');
        node.style.removeProperty('--opa-group-order');
      }
      for (const node of this.headers) node.remove();
      this.root?.classList.remove('opa-groups-native');
      this.frame?.classList.remove('opa-groups-frame');
      this.scroller?.classList.remove('opa-groups-scroll');
      this.toggle?.remove();
      this.panel?.remove();
      this.frame = this.scroller = this.toggle = this.panel = this.root = null;
      this.signature = null;
      this.rows.clear();
      this.decorated = [];
      this.headers = [];
    }

    reveal(id) {
      const path = this.rows.get(id);
      if (path?.some(key => this.collapsed.has(key))) {
        for (const key of path) this.collapsed.delete(key);
        this.render();
      }
    }

    update(root, rows, settings, modern) {
      const anchor = modern ? root.querySelector('ul') : root;
      if (!anchor) { this.clear(); return; }
      const signature = JSON.stringify([settings.tagMode, settings.groupTags, settings.priorityTags,
        rows.map(({ id, protocol, company, tags, pinned, unread, highlighted }) => [id, protocol, company, tags, pinned, unread, highlighted])]);
      if (this.root === anchor && this.signature === signature &&
          (modern ? this.toggle?.isConnected : this.decorated.every((node,i) => node === rows[i]?.node && node.isConnected))) return;
      const scroll = this.panel?.scrollTop || 0;
      this.clear();
      this.root = anchor;
      this.signature = signature;
      this.items = rows;
      this.settings = settings;
      this.modern = modern;
      if (!document.getElementById('opa-groups-style')) {
        const style = document.createElement('style');
        style.id = 'opa-groups-style';
        style.textContent = css;
        document.head.append(style);
      }
      if (modern) {
        this.scroller = anchor.closest('.sidebar-scroll, .overflow-auto') || anchor;
        this.frame = this.scroller.parentElement;
        this.frame.classList.add('opa-groups-frame');
        this.scroller.classList.add('opa-groups-scroll');
        this.toggle = button('opa-groups-toggle', '');
        this.toggle.onclick = () => { this.grouped = !this.grouped; this.render(); };
        this.scroller.before(this.toggle);
        this.panel = document.createElement('div');
        this.panel.className = 'opa-groups-panel';
        this.frame.append(this.panel);
      } else {
        anchor.classList.add('opa-groups-native');
        this.decorated = rows.map(row => row.node);
      }
      this.render();
      if (this.panel) this.panel.scrollTop = scroll;
    }

    render() {
      const scroll = this.panel?.scrollTop || 0;
      this.panel?.replaceChildren();
      for (const header of this.headers) header.remove();
      this.headers = [];
      this.rows.clear();
      if (this.modern) {
        this.toggle.textContent = this.grouped ? 'Voltar à lista do Opa' : 'Por etiquetas';
        this.toggle.setAttribute('aria-expanded', String(this.grouped));
        this.panel.hidden = !this.grouped;
        this.panel.style.top = this.toggle.offsetHeight + 'px';
        if (!this.grouped) return;
      }
      const priorities = new Map(this.settings.priorityTags.map((name, i) => [fold(name), i]));
      const selection = new Set(this.settings.groupTags.map(fold));
      const tree = { groups: new Map(), items: [] };
      for (const item of this.items) {
        const names = new Map();
        for (const tag of item.tags) {
          const key = fold(tag);
          if (key && (selection.has(key) === (this.settings.tagMode === 'include'))) names.set(key, tag);
        }
        const labels = [...names].sort(([a], [b]) => (priorities.get(a) ?? Infinity) - (priorities.get(b) ?? Infinity) || a.localeCompare(b));
        if (!labels.length) labels.push([':none', 'Sem grupo']);
        if (item.pinned) labels.unshift([':pinned', 'Fixados']);
        let branch = tree;
        const path = [];
        for (const [key, label] of labels.slice(0, 6)) {
          path.push(key);
          if (!branch.groups.has(key)) branch.groups.set(key, { key, label, path: JSON.stringify(path), groups: new Map(), items: [], count: 0, unread: false });
          branch = branch.groups.get(key);
          branch.count++;
          branch.unread ||= item.unread;
        }
        branch.items.push(item);
        this.rows.set(item.id, path.map((_, i) => JSON.stringify(path.slice(0, i + 1))));
      }
      let order = 0;
      const rank = key => key === ':pinned' ? -1 : key === ':none' ? Number.MAX_VALUE : priorities.get(key) ?? 100000;
      const draw = (branch, depth, visible) => {
        for (const item of branch.items) {
          if (this.modern) {
            if (!visible) continue;
            const row = button('opa-groups-row', [item.company, item.protocol].filter(Boolean).join(' · '));
            row.classList.toggle('opa-groups-new', item.highlighted);
            row.onclick = () => this.open(item);
            this.panel.append(row);
          } else {
            item.node.classList.add('opa-groups-item');
            item.node.style.setProperty('--opa-group-order', ++order);
            item.node.classList.toggle('opa-groups-hidden', !visible);
          }
        }
        const groups = [...branch.groups.values()].sort((a,b) => rank(a.key) - rank(b.key) || a.label.localeCompare(b.label));
        for (const group of groups) {
          const expanded = !this.collapsed.has(group.path);
          if (visible) {
            const head = button('opa-groups-head', (expanded ? '▾ ' : '▸ ') + group.label + ' (' + group.count + ')' + (group.unread ? ' ●' : ''));
            head.setAttribute('aria-expanded', String(expanded));
            head.style.paddingInlineStart = (10 + 12 * depth) + 'px';
            head.onclick = () => {
              if (expanded) this.collapsed.add(group.path); else this.collapsed.delete(group.path);
              this.render();
            };
            if (!this.modern) { head.style.order = ++order; this.headers.push(head); }
            (this.panel || this.root).append(head);
          }
          draw(group, depth + 1, visible && expanded);
        }
      };
      draw(tree, 0, true);
      if (this.panel) this.panel.scrollTop = scroll;
    }
  }
  globalThis.OpaNotifyGroups = Groups;
})();
