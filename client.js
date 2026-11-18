/**
 * Global AGENTS.md editor — browser half.
 *
 * Registers one settings section that edits the `global-agents` settings
 * namespace. The Host half owns the file; this page only stages text and
 * writes it through the shared configuration-form transport
 * (`ctx.configForms`), so it needs no wire namespace of its own.
 */
window.__ModuleLoader__.load({
  id: 'dsh-windows-agents',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    /** Host plugin entry id — also the settings namespace. */
    const ENTRY_ID = 'global-agents'
    /** Locale namespace owned by this plugin. */
    const NS = 'globalAgents'
    /** `maxBytes` the agent-instructions row uses for each instruction chain. */
    const BUDGET = 65536

    const EN = {
      'nav': 'Personalization',
      'page.title': 'Personalization',
      'page.intro': 'Edits the user-global AGENTS.md that every session loads before any project instructions.',
      'page.path': 'File: $DSH_HOME/AGENTS.md (default ~/.dsh/AGENTS.md). An existing file wins on startup; saving here rewrites it.',
      'page.placeholder': 'Write the instructions that apply to all work, for example:\n\n- Answer in Simplified Chinese.\n- Read a file before editing it.',
      'page.count': 'bytes',
      'page.save': 'Save',
      'page.saving': 'Saving…',
      'page.saved': 'Saved. New sessions and resumed sessions pick it up.',
      'page.failed': 'The Host refused the write. Check the profile configuration, then try again.',
      'page.reset': 'Clear',
      'page.idle': 'Changes apply to new sessions. Existing sessions keep the instructions they loaded.',
      'page.note': 'The harness injects this file itself; this page adds no prompt text of its own.',
      'page.loading': 'Reading configuration…',
      'page.unavailable': 'This profile does not serve the global-agents namespace, so there is nothing to edit.',
      'page.readonly': 'The Host settings document is read-only in this deployment.',
    }

    const ZH = {
      'nav': '个性化',
      'page.title': '个性化',
      'page.intro': '编辑用户全局 AGENTS.md：每个会话都会在项目指令之前加载它。',
      'page.path': '文件：$DSH_HOME/AGENTS.md（默认 ~/.dsh/AGENTS.md）。启动时以文件为准；在这里保存会重写该文件。',
      'page.placeholder': '写下适用于所有工作的指令，例如：\n\n- 回答使用简体中文。\n- 改动前先读文件。',
      'page.count': '字节',
      'page.save': '保存',
      'page.saving': '保存中…',
      'page.saved': '已保存。新会话与恢复的会话会加载它。',
      'page.failed': 'Host 拒绝了这次写入。检查 profile 配置后重试。',
      'page.reset': '清空',
      'page.idle': '改动对新会话生效；已打开的会话仍保留它加载时的指令。',
      'page.note': '注入由 harness 自身完成，本页不额外添加任何提示词。',
      'page.loading': '正在读取配置…',
      'page.unavailable': '当前 profile 未提供 global-agents 命名空间，没有可编辑的内容。',
      'page.readonly': '该部署的 Host 设置文档为只读。',
    }

    const CSS = `
.ga-root { display: flex; flex-direction: column; gap: 12px; max-width: 720px; color: var(--dsw-alias-label-primary); }
.ga-title { margin: 0; font-size: 16px; line-height: 24px; font-weight: 500; }
.ga-intro { margin: 0; font-size: 14px; line-height: 22px; color: var(--dsw-alias-label-tertiary); }
.ga-path { margin: 0; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary); word-break: break-all; }
.ga-editor {
  box-sizing: border-box; width: 100%; min-height: 320px; resize: vertical;
  padding: 10px 12px; border: 1px solid var(--dsw-alias-border-l2); border-radius: var(--dsw-radius-md);
  background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 13px; line-height: 20px;
}
.ga-editor:focus-visible { outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary)); outline-offset: 1px; }
.ga-editor:disabled { opacity: 0.6; cursor: not-allowed; }
.ga-footer { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.ga-count { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary); font-variant-numeric: tabular-nums; }
.ga-status { flex: 1 1 200px; min-width: 0; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary); }
.ga-status[data-state='saved'] { color: var(--dsw-alias-state-success-primary); }
.ga-status[data-state='failed'] { color: var(--dsw-alias-state-warn-label); }
.ga-button {
  height: 30px; padding: 0 12px; border-radius: var(--dsw-radius-md);
  border: 0.5px solid var(--dsw-alias-settings-card-stroke);
  background: var(--dsw-alias-button-elevated-fill); color: var(--dsw-alias-label-primary);
  font-family: inherit; font-size: 13px; line-height: 1; cursor: pointer;
}
.ga-button:disabled { cursor: default; opacity: 0.45; }
@media (hover: hover) { .ga-button:hover:enabled { background: var(--dsw-alias-interactive-bg-hover); } }
.ga-button.ga-primary { border-color: transparent; background: var(--dsw-alias-button-primary-fill); color: var(--dsw-alias-label-primary-foreground); }
@media (hover: hover) { .ga-button.ga-primary:hover:enabled { background: var(--dsw-alias-button-primary-hover); } }
.ga-note { margin: 0; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary); }
`

    /**
     * @param value - the text to measure.
     * @returns its UTF-8 byte length.
     */
    function byteLength(value) {
      try {
        return new TextEncoder().encode(value).length
      } catch (_noEncoder) {
        return value.length
      }
    }

    /**
     * Settings page for the user-global instruction file.
     * @param props - slot props: framework `t` seat plus the injected form.
     * @returns the section element tree.
     */
    function GlobalAgentsPage(props) {
      const form = props.form
      const seat = props.t
      const tr = React.useMemo(
        () => (typeof seat === 'function' ? seat : key => EN[key] ?? key),
        [seat],
      )
      const [snapshot, setSnapshot] = React.useState(() => form.getSnapshot())
      const [draft, setDraft] = React.useState(null)
      const [state, setState] = React.useState('idle')
      React.useEffect(() => form.subscribe(() => { setSnapshot(form.getSnapshot()) }), [form])

      const saved = snapshot.value?.content ?? ''
      const text = draft === null ? saved : draft
      const ready = snapshot.status === 'ready' && snapshot.writable
      const dirty = text !== saved
      const busy = state === 'saving'

      const changed = (event) => {
        setDraft(event.target.value)
        setState('idle')
      }

      const save = async () => {
        if (!ready || !dirty || busy) return
        setState('saving')
        try {
          if (await form.set('content', text)) {
            setDraft(null)
            setState('saved')
          } else {
            setState('failed')
          }
        } catch (_transport) {
          setState('failed')
        }
      }

      const clear = async () => {
        if (!ready || busy || (saved === '' && text === '')) return
        setState('saving')
        try {
          if (await form.unset('content')) {
            setDraft(null)
            setState('saved')
          } else {
            setState('failed')
          }
        } catch (_transport) {
          setState('failed')
        }
      }

      const status = snapshot.status === 'unavailable'
        ? tr('page.unavailable')
        : !snapshot.writable && snapshot.status === 'ready'
          ? tr('page.readonly')
          : state === 'saving'
            ? tr('page.saving')
            : state === 'saved'
              ? tr('page.saved')
              : state === 'failed'
                ? tr('page.failed')
                : snapshot.status === 'loading'
                  ? tr('page.loading')
                  : tr('page.idle')

      return h('div', { className: 'ga-root' },
        h('style', null, CSS),
        h('h2', { className: 'ga-title' }, tr('page.title')),
        h('p', { className: 'ga-intro' }, tr('page.intro')),
        h('p', { className: 'ga-path' }, tr('page.path')),
        h('textarea', {
          className: 'ga-editor',
          value: text,
          placeholder: tr('page.placeholder'),
          spellCheck: false,
          disabled: !ready || busy,
          onChange: changed,
          'aria-label': tr('page.title'),
        }),
        h('div', { className: 'ga-footer' },
          h('span', { className: 'ga-count' }, `${byteLength(text)} / ${BUDGET} ${tr('page.count')}`),
          h('span', { className: 'ga-status', 'data-state': state, role: 'status' }, status),
          h('button', {
            type: 'button',
            className: 'ga-button ga-primary',
            disabled: !ready || busy || !dirty,
            onClick: () => { void save() },
          }, tr('page.save')),
          h('button', {
            type: 'button',
            className: 'ga-button',
            disabled: !ready || busy || (saved === '' && text === ''),
            onClick: () => { void clear() },
          }, tr('page.reset')),
        ),
        h('p', { className: 'ga-note' }, tr('page.note')),
      )
    }

    /**
     * Section navigation glyph; inherits the nav cell's color.
     * @param props - `size` in pixels and whether the section is active.
     * @returns an inline SVG element.
     */
    function GlobalAgentsGlyph(props) {
      const size = props.size ?? 16
      return h('svg', {
        width: size,
        height: size,
        viewBox: '0 0 16 16',
        fill: 'none',
        'aria-hidden': true,
        focusable: false,
      },
      h('path', { d: 'M3.75 1.75h5l3.5 3.5v9h-8.5z', stroke: 'currentColor', strokeWidth: 1.2, strokeLinejoin: 'round' }),
      h('path', { d: 'M8.75 1.75v3.5h3.5', stroke: 'currentColor', strokeWidth: 1.2, strokeLinejoin: 'round' }),
      h('path', { d: 'M5.75 8.25h4.5M5.75 10.75h4.5', stroke: 'currentColor', strokeWidth: 1.2, strokeLinecap: 'round' }))
    }

    return {
      inject: ['slots', 'locale', 'configForms'],
      apply(ctx) {
        const t = ctx.locale.bind(NS)
        ctx.effect(() => ctx.locale.register(NS, { en: EN, zh: ZH }), 'global-agents: dictionaries')
        ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section',
          id: ENTRY_ID,
          order: 55,
          label: () => t('nav'),
          locale: NS,
          inject: () => ({ form: ctx.configForms.get(ENTRY_ID) }),
        }, GlobalAgentsPage))
        ctx.slots.inject('settings.section.icon', () => ctx.slots.register({
          name: 'settings.section.icon',
          id: ENTRY_ID,
          locale: NS,
        }, GlobalAgentsGlyph))
      },
    }
  },
})
