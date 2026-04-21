<script lang="ts">
  import { parsePath } from './parse';
  import { serializePath } from './serialize';
  import { PRESETS } from './presets';
  import type { Path, Point } from './types';

  const VB_WIDTH = 240;
  const VB_HEIGHT = 200;

  let dText = $state(PRESETS[0].d);
  let parseError = $state<string | null>(null);

  // Parsed path derived from textarea; when textarea is valid we keep it in
  // sync with `path`. When user drags a node we update `path` directly and
  // write the new string back into `dText` so both views stay coherent.
  let path = $state<Path>(parsePath(PRESETS[0].d));

  let selected = $state<number | null>(null);
  let svgEl: SVGSVGElement | null = $state(null);

  // Current drag target; null when nothing is being dragged.
  type DragTarget =
    | { kind: 'anchor'; i: number }
    | { kind: 'c1'; i: number }
    | { kind: 'c2'; i: number }
    | { kind: 'qc'; i: number };
  let dragging: DragTarget | null = null;

  // Textarea → path (debounced by event, not time — every keystroke parses).
  function applyText() {
    try {
      path = parsePath(dText);
      parseError = null;
    } catch (e) {
      parseError = e instanceof Error ? e.message : String(e);
    }
  }

  // Path → textarea. Always done after a node mutation so the user sees the
  // generated `d` update live.
  function syncText() {
    dText = serializePath(path);
    parseError = null;
  }

  function loadPreset(d: string) {
    dText = d;
    applyText();
    selected = null;
  }

  // SVG coordinate conversion: read the CTM once per drag to convert client
  // → viewBox space. getScreenCTM gives the combined page-to-element
  // transform; inverting it maps a page coord to an SVG coord.
  function clientToSvg(clientX: number, clientY: number): Point {
    if (!svgEl) return { x: 0, y: 0 };
    const ctm = svgEl.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const inv = ctm.inverse();
    const pt = new DOMPoint(clientX, clientY).matrixTransform(inv);
    return { x: pt.x, y: pt.y };
  }

  function startDrag(e: PointerEvent, t: DragTarget) {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    dragging = t;
    if (t.kind === 'anchor') selected = t.i;
  }

  function onMove(e: PointerEvent) {
    if (!dragging) return;
    const p = clientToSvg(e.clientX, e.clientY);
    const n = path[dragging.i];
    if (!n) return;
    if (dragging.kind === 'anchor' && n.kind !== 'Z') {
      // Moving the anchor: bring the cubic c2 / quad c along so the handle
      // keeps its shape relative to the point (standard vector-editor feel).
      const old = n.p;
      const dx = p.x - old.x;
      const dy = p.y - old.y;
      if (n.kind === 'C') {
        n.c2 = { x: n.c2.x + dx, y: n.c2.y + dy };
      }
      if (n.kind === 'Q') {
        n.c = { x: n.c.x + dx, y: n.c.y + dy };
      }
      n.p = p;
    } else if (dragging.kind === 'c1' && n.kind === 'C') {
      n.c1 = p;
    } else if (dragging.kind === 'c2' && n.kind === 'C') {
      n.c2 = p;
    } else if (dragging.kind === 'qc' && n.kind === 'Q') {
      n.c = p;
    }
    path = [...path]; // trigger reactivity
    syncText();
  }

  function endDrag(e: PointerEvent) {
    if (!dragging) return;
    (e.target as Element).releasePointerCapture(e.pointerId);
    dragging = null;
  }

  // Adds a new node 20px right of the last anchor, or at the canvas center
  // if the path is empty.
  function appendNode(kind: 'L' | 'C' | 'Q' | 'Z') {
    const last = lastAnchor(path) ?? { x: VB_WIDTH / 2, y: VB_HEIGHT / 2 };
    const next = { x: Math.min(last.x + 30, VB_WIDTH - 10), y: last.y };
    if (path.length === 0 && kind !== 'Z') {
      path = [{ kind: 'M', p: next }];
    } else if (kind === 'L') {
      path = [...path, { kind: 'L', p: next }];
    } else if (kind === 'C') {
      const c1 = { x: last.x + 10, y: last.y - 30 };
      const c2 = { x: next.x - 10, y: next.y - 30 };
      path = [...path, { kind: 'C', c1, c2, p: next }];
    } else if (kind === 'Q') {
      const c = { x: (last.x + next.x) / 2, y: last.y - 40 };
      path = [...path, { kind: 'Q', c, p: next }];
    } else if (kind === 'Z') {
      path = [...path, { kind: 'Z' }];
    }
    syncText();
    selected = path.length - 1;
  }

  function deleteNode(i: number) {
    path = path.filter((_, idx) => idx !== i);
    if (selected === i) selected = null;
    else if (selected !== null && selected > i) selected = selected - 1;
    syncText();
  }

  function copyD() {
    navigator.clipboard?.writeText(dText);
  }

  function lastAnchor(p: Path): Point | null {
    for (let i = p.length - 1; i >= 0; i--) {
      const n = p[i];
      if (n.kind !== 'Z') return n.p;
    }
    return null;
  }

  function nodeDescription(i: number): string {
    const n = path[i];
    if (n.kind === 'Z') return `${i + 1}. Z  (close)`;
    if (n.kind === 'M') return `${i + 1}. M  ${round(n.p.x)} ${round(n.p.y)}`;
    if (n.kind === 'L') return `${i + 1}. L  ${round(n.p.x)} ${round(n.p.y)}`;
    if (n.kind === 'C')
      return `${i + 1}. C  ${round(n.c1.x)},${round(n.c1.y)} · ${round(n.c2.x)},${round(n.c2.y)} · ${round(n.p.x)},${round(n.p.y)}`;
    return `${i + 1}. Q  ${round(n.c.x)},${round(n.c.y)} · ${round(n.p.x)},${round(n.p.y)}`;
  }

  function round(n: number): string {
    return (Math.round(n * 10) / 10).toString();
  }

  // Walks back through the path to find the most recent anchor before
  // index `i`. Used to draw handle lines from a curve's starting point.
  function lastAnchorBefore(p: Path, i: number): Point | null {
    for (let k = i - 1; k >= 0; k--) {
      const n = p[k];
      if (n.kind !== 'Z') return n.p;
    }
    return null;
  }
</script>

<header>
  <h1>SVG Path Editor</h1>
  <p>
    <code>d</code> 属性をドラッグで編集。Bezier の制御点もそのまま。コピペで
    そのまま使えます。<em>(M / L / C / Q / Z のみ。A は非対応)</em>
  </p>
</header>

<main>
  <div class="canvas-pane">
    <div class="toolbar">
      <span class="group-label">Presets:</span>
      {#each PRESETS as preset}
        <button type="button" onclick={() => loadPreset(preset.d)}>
          {preset.name}
        </button>
      {/each}
      <span class="spacer"></span>
      <span class="group-label">Add:</span>
      <button type="button" onclick={() => appendNode('L')}>+ L</button>
      <button type="button" onclick={() => appendNode('C')}>+ C</button>
      <button type="button" onclick={() => appendNode('Q')}>+ Q</button>
      <button type="button" onclick={() => appendNode('Z')}>+ Z</button>
    </div>

    <div class="canvas-wrap">
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <svg
        bind:this={svgEl}
        class="canvas-svg"
        viewBox="0 0 {VB_WIDTH} {VB_HEIGHT}"
        preserveAspectRatio="xMidYMid meet"
        onpointermove={onMove}
        onpointerup={endDrag}
        onpointercancel={endDrag}
      >
        <path class="path-fill" d={dText} />
        <path class="path-stroke" d={dText} />

        {#each path as node, i}
          {#if node.kind === 'C'}
            {@const prev = lastAnchorBefore(path, i)}
            {#if prev}
              <line
                class="handle-line"
                x1={prev.x}
                y1={prev.y}
                x2={node.c1.x}
                y2={node.c1.y}
              />
            {/if}
            <line
              class="handle-line"
              x1={node.c2.x}
              y1={node.c2.y}
              x2={node.p.x}
              y2={node.p.y}
            />
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <circle
              class="node-control"
              cx={node.c1.x}
              cy={node.c1.y}
              r="4"
              onpointerdown={(e) => startDrag(e, { kind: 'c1', i })}
            />
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <circle
              class="node-control"
              cx={node.c2.x}
              cy={node.c2.y}
              r="4"
              onpointerdown={(e) => startDrag(e, { kind: 'c2', i })}
            />
          {:else if node.kind === 'Q'}
            {@const prev = lastAnchorBefore(path, i)}
            {#if prev}
              <line
                class="handle-line"
                x1={prev.x}
                y1={prev.y}
                x2={node.c.x}
                y2={node.c.y}
              />
              <line
                class="handle-line"
                x1={node.c.x}
                y1={node.c.y}
                x2={node.p.x}
                y2={node.p.y}
              />
            {/if}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <circle
              class="node-control"
              cx={node.c.x}
              cy={node.c.y}
              r="4"
              onpointerdown={(e) => startDrag(e, { kind: 'qc', i })}
            />
          {/if}
        {/each}

        {#each path as node, i}
          {#if node.kind !== 'Z'}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <circle
              class="node-anchor {selected === i ? 'selected' : ''}"
              cx={node.p.x}
              cy={node.p.y}
              r="5"
              onpointerdown={(e) => startDrag(e, { kind: 'anchor', i })}
            />
          {/if}
        {/each}
      </svg>
    </div>
  </div>

  <aside class="side-pane">
    <section>
      <h2><code>d</code> attribute</h2>
      <textarea
        class="d-output {parseError ? 'error' : ''}"
        spellcheck="false"
        bind:value={dText}
        oninput={applyText}
      ></textarea>
      {#if parseError}
        <div class="parse-error">{parseError}</div>
      {/if}
      <div style="margin-top: 8px; display: flex; gap: 6px;">
        <button type="button" class="primary" onclick={copyD}>Copy d</button>
        <button type="button" onclick={() => loadPreset('')}>Clear</button>
      </div>
    </section>

    <section>
      <h2>Nodes ({path.length})</h2>
      <div class="node-list">
        {#each path as _, i}
          <div
            class="row {selected === i ? 'selected' : ''}"
            onclick={() => (selected = i)}
            role="button"
            tabindex="0"
            onkeydown={(e) => e.key === 'Enter' && (selected = i)}
          >
            <span class="kind">{path[i].kind}</span>
            <span>{nodeDescription(i)}</span>
            <button type="button" onclick={(e) => { e.stopPropagation(); deleteNode(i); }}>
              ×
            </button>
          </div>
        {/each}
      </div>
    </section>
  </aside>
</main>

<footer>
  <span class="legend">
    <span><span class="dot anchor"></span>anchor</span>
    <span><span class="dot control"></span>control</span>
  </span>
  <span style="margin-left:auto">
    <a href="https://sen.ltd/" target="_blank" rel="noopener">SEN 合同会社</a>
  </span>
</footer>

