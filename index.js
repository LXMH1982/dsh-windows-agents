/**
 * Global AGENTS.md editor — Host half.
 *
 * The harness already injects instructions: `@deepseek-ai/dsh-agent-instructions`
 * reads `$DSH_HOME/AGENTS.md`, then `<agentsHome>/AGENTS.md`, then the project
 * chain. This plugin adds nothing to the prompt; it gives that user-global file
 * an editor. The settings form owns the text (a volatile Config field, so a save
 * updates this plugin in place), and this half keeps the file in step with it:
 *
 * - at activation the file wins: its bytes are imported into the form, so a
 *   hand-edited AGENTS.md is never overwritten by a stale form value;
 * - after a form save the text is written back atomically, and an empty text
 *   removes the file, which is the state the loader reads as "no global chain".
 */
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import z from '@deepseek-ai/schemastery'

/** Editable body plus the resolved location; only `content` reaches the form. */
export const Config = z.object({
  content: z.string().default('').volatile(),
  file: z.string().default(''),
})

/**
 * Resolve the user-global instruction file.
 * @param configured - `file` from the row config; empty keeps the harness home.
 * @returns the absolute path of the file this plugin maintains.
 */
function resolveFile(configured) {
  if (configured !== '') return configured
  const home = process.env.DSH_HOME ?? join(homedir(), '.dsh')
  return join(home, 'AGENTS.md')
}

/**
 * Keep `$DSH_HOME/AGENTS.md` in step with the settings form.
 * @param ctx - this plugin's context.
 * @param config - resolved row config; `content` is a volatile reference.
 */
export function apply(ctx, config) {
  const file = resolveFile(config.file)
  /** Last text this plugin wrote, so a no-op save does not rewrite the file. */
  let written
  /** Set while the activation import runs, so its own change is not written back. */
  let importing = false

  /**
   * @returns the file's bytes, or undefined when it does not exist.
   */
  async function readText() {
    try {
      return await readFile(file, 'utf8')
    } catch (error) {
      if (error?.code === 'ENOENT') return undefined
      throw error
    }
  }

  /**
   * Replace the file with `text`, or remove it when `text` is empty.
   * @param text - the complete desired body.
   */
  async function writeText(text) {
    if (written === text) return
    try {
      if (text === '') {
        await unlink(file)
      } else {
        await mkdir(dirname(file), { recursive: true })
        const temporary = `${file}.${process.pid}.tmp`
        await writeFile(temporary, text, 'utf8')
        await rename(temporary, file)
      }
      written = text
    } catch (error) {
      if (text === '' && error?.code === 'ENOENT') {
        written = text
        return
      }
      throw error
    }
  }

  // The file is authoritative at activation: copy it into the form when the two
  // disagree, so external edits survive and the next save starts from them.
  ctx.effect(() => {
    let live = true
    void (async () => {
      const disk = await readText()
      if (!live || disk === undefined) return
      if (disk === (config.content.get() ?? '')) return
      const editor = ctx.get('configEditor')
      const entry = ctx.fiber.entry
      if (editor === undefined || entry === undefined) return
      importing = true
      try {
        await editor.edit(entry, current => ({ ...current, content: disk }))
        written = disk
      } finally {
        importing = false
      }
    })().catch((error) => {
      ctx.logger.warn('global-agents: importing %s failed', file)
      ctx.logger.warn(error)
    })
    return () => {
      live = false
    }
  }, 'global-agents: import existing AGENTS.md')

  // A form save (volatile write) reaches this event without restarting the plugin.
  ctx.on('loader/volatile-update', () => {
    if (importing) return
    void writeText(config.content.get() ?? '').catch((error) => {
      ctx.logger.warn('global-agents: writing %s failed', file)
      ctx.logger.warn(error)
    })
  })

  // Mark the page as custom so a schema-generated form never competes with it.
  // `owner` must be this plugin instance's fiber, not the inject child's.
  const owner = ctx.fiber
  ctx.inject(['settings'], (child) => {
    child.effect(() => child.settings.configure({ auto: false }, owner), 'global-agents: page policy')
  })
}
