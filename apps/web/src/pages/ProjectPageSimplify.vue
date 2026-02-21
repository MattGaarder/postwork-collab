<template>
  <q-page padding>
    <div class="row items-center q-mb-md">
      <div class="text-h5">
        p{{ projectId }}.v{{ isFinite(currentVersionId) ? currentVersionId : "latest" }} -
        {{ project?.name || `Project #${projectId}` }}
        <q-spinner-dots v-if="!project" color="white" size="xs" class="q-ml-sm" />
      </div>
      <q-space />
      <q-chip v-if="!isLatestVersion" color="orange" text-color="white" icon="history" dense class="q-mr-sm">
        Read-Only (History)
      </q-chip>
      <q-btn-group>
        <q-btn dense icon="navigate_before" :disable="!hasPreviousVersion" @click="navigateToPreviousVersion">
          <q-tooltip>Previous Version</q-tooltip>
        </q-btn>
        <q-btn dense icon="navigate_next" :disable="!hasNextVersion" @click="navigateToNextVersion">
          <q-tooltip>Next Version</q-tooltip>
        </q-btn>
      </q-btn-group>
      <q-btn color="primary" dense label="Refresh" class="q-ml-xs" :loading="isLoadingComments"
        @click="fetchComments" />
      <q-btn color="primary" class="q-ml-xs" dense label="Save" :loading="isLoading" :disable="!isLatestVersion"
        @click="saveCurrent" />
    </div>

    <!-- <div class="text-caption text-grey-7 q-mb-md">
            Created: {{ createdAt ? new Date(createdAt).toLocaleDateString() : "--" }}  -  Updated: {{ updatedAt ? new Date(updatedAt).toLocaleString() : "--" }}
        </div> -->



    <MonacoEditor :language="language" theme="vs-light" height="600px" width="100%"
      :options="{ automaticLayout: true, glyphMargin: true, minimap: { enabled: false }, readOnly: !isLatestVersion }"
      @mount="onMonacoMount" />
    <q-banner v-if="errorMsg" class="bg-red-1 text-red q-mb-md">{{ errorMsg }}</q-banner>
    <div class="text-caption text-grey-7 g-mt-md">
      Websocket: {{ status }} -- Room: {{ room }}
    </div>
    <div class="q-mt-md">
      <div class="text-subtitle2">Add Comment</div>
      <div class="row q-col-gutter-sm item-start q-mt-sm">
        <div class="col-12 col-sm-3">
          <q-input v-model.number="newLine" type="number" label="Line Number" :min="1" dense />
        </div>
        <div class="col-12 col-sm-7">
          <q-input v-model="newBody" type="textarea" autogrow label="Comment" />
        </div>
        <div class="col-12 col-sm-2 flex item-start">
          <q-btn color="primary" class="q-mt-sm fill-width" label="Add comment" :disable="!canSubmit"
            :loading="isPosting" @click="submitComment" />
        </div>
      </div>
    </div>
    <div class="text-caption text-grey-7 q-mt-md">
      Line - {{ newLine || '--' }}
    </div>
    <ProjectCommentsList :comments="sortedAllComments" :currentVersionId="currentVersionId" @view="navigateToComment"
      @resolve="resolveComment" @apply="applyCommentChange" />

  </q-page>
</template>

<script setup lang="ts">
/**
 *
 * This component is the heart of the collaboration platform. It combines:
 * 1. Monaco Editor: A powerful code editor (same as VS Code).
 * 2. Yjs: A CRDT library for real-time collaboration (Google Docs style).
 * 3. Quasar: For the UI components (buttons, inputs, layout).
 *
 * The goal is to allow users to edit code together and leave comments on specific lines.
 */
import { ref, onMounted, computed, onBeforeUnmount, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../lib/http';
import MonacoEditor from '@guolao/vue-monaco-editor';
import * as Y from 'yjs';

import { useVersion } from '../composables/useVersion';
import { useYDoc } from '../composables/useYDocs';
import ProjectCommentsList from '../components/ProjectCommentsList.vue';
import { useQuasar } from 'quasar';

const route = useRoute();
const router = useRouter();
const $q = useQuasar();

const INLINE_WIDGET_ID = "INLINE_WIDGET_ID";
const projectId = computed(() => Number(route.params.projectId));
const currentVersionId = ref<number>(Number(route.params.versionId));

// Sync currentVersionId when route changes
watch(() => route.params.versionId, (newId) => {
  currentVersionId.value = Number(newId);
});

// Version navigation state
const allVersions = ref<any[]>([]);
const currentVersionIndex = computed(() => {
  return allVersions.value.findIndex(v => v.id === currentVersionId.value);
});
const hasPreviousVersion = computed(() => currentVersionIndex.value < allVersions.value.length - 1);
const hasNextVersion = computed(() => currentVersionIndex.value > 0);

// Whether the user is viewing the latest (active) version.
// Defaults to TRUE while allVersions is still loading (index === -1 means not found yet).
// Once versions load, index 0 = latest, index > 0 = historical.
const isLatestVersion = computed(() => {
  const idx = currentVersionIndex.value;
  return idx === 0 || idx === -1; // -1 = versions not loaded yet, treat as latest
});

// --- REAL-TIME COLLABORATION SETUP ---
// All users collaborate on a single stable room per project: "project-{id}-main".
// This means everyone stays connected even after a save creates a new version.
// Old versions are shown in read-only mode (no YJS sync needed for history).
const room = computed(() => `project-${projectId.value}-main`);

// useYDoc is a custom composable that connects to the WebSocket server.
// 'doc' is the shared document, 'status' tells us if we are connected.
const { doc, status, provider } = useYDoc(room);

// Yjs uses shared data types. 'ytext' is a shared string that represents the code.
// When one user types, ytext updates, and that update is broadcast to everyone.
const ytext = doc.getText('code');

const language = ref<'javascript' | 'python' | 'java'>('javascript');

type UIComment = {
  id: number;
  projectId: number;
  versionId?: number | null;
  resolvedVersionId?: number | null;
  line: number;
  endLine?: number | null;
  content: string;
  originalCode?: string | null;
  yAnchor?: string | null;
  createdAt: string;
  author?: { id: number; name?: string | null; email?: string | null };
}

const allComents = ref<UIComment[]>([]); // Current version comments (for inline widgets)
const allProjectComments = ref<UIComment[]>([]); // All comments across all versions (for bottom list)
const isLoadingComments = ref(false);
const isPosting = ref(false);

let newLine = ref<number | null>(null);
let newEndLine = ref<number | null>(null);
const newBody = ref('');

let project = ref(null);
let editorRef: any = null;

let lineDecorationIds: string[] = [];

let disposeCursorListener: (() => void) | null = null;
let disposeLocalToY: (() => void) | null = null;
let disposeYToLocal: (() => void) | null = null;

const { isLoading, errorMsg, refresh, save, code } = useVersion(projectId, currentVersionId);

let monacoRef: any = null;
let inlineWidget: any | null = null
let inlineLine: number | null = null;
let inlineDom: HTMLElement | null = null;

// Track active widgets and zones for cleanup
let viewZoneIds: string[] = [];

// 4. REACTIVE SQL SEEDING:
// If the code arrives from the database AFTER mount, make sure it gets into the editor.
watch(code, (newVal) => {
  if (newVal && editorRef) {
    const model = editorRef.getModel();
    if (model && model.getValue() === '') {
      console.log('Watcher: applying code to empty editor');
      model.setValue(newVal);
      // Also seed Yjs if this is the latest version and Yjs is still empty
      if (isLatestVersion.value && ytext.length === 0) {
        setYText(newVal);
      }
    }
  }
}, { immediate: true });


/**
 * Helper function to update the Yjs document.
 * We use a 'transact' to bundle changes into a single update, preventing flickering.
 * This is called when we load the initial code from the database.
 */
function setYText(text: string) {
  doc.transact(() => {
    // Delete everything and insert the new text
    ytext.delete(0, ytext.length);
    ytext.insert(0, text);
  })
}


/**
 * MAIN EDITOR INITIALIZATION
 * This function is called when the Monaco Editor component is ready.
 * It's where we set up all the bindings between the editor and our logic.
 */
function onMonacoMount(editor: any, monaco: any) {
  editorRef = editor;
  monacoRef = monaco;
  const model = editorRef.getModel();

  // 1. INITIAL SYNC: Load from SQL (source of truth for the displayed version)
  // For the latest version: also seed Yjs if it's empty (first user to open)
  // For old versions: just display the code, no Yjs sync needed (read-only)
  if (code.value) {
    model.setValue(code.value);
    // Only seed Yjs if on the latest version AND Yjs is empty
    // (don't overwrite active collaboration with stale SQL snapshot)
    if (isLatestVersion.value && ytext.length === 0) {
      setYText(code.value);
    }
  }

  if (isLatestVersion.value) {
    // 2. LOCAL -> REMOTE SYNC (only for latest/active version)
    const localSub = editor.onDidChangeModelContent(() => {
      const next = model.getValue();
      if (next !== ytext.toString()) setYText(next)
    });
    disposeLocalToY = () => localSub.dispose();

    // 3. REMOTE -> LOCAL SYNC (only for latest/active version)
    // IMPORTANT: Ignore empty Yjs updates — these happen when the server's
    // in-memory doc is empty (e.g. after a server restart or page refresh
    // when no other users are connected). In that case, the SQL code is
    // the source of truth and we should NOT overwrite the editor with empty text.
    const YObserver = () => {
      const next = ytext.toString();
      if (next.length === 0) return; // Ignore empty sync from server
      if (model.getValue() !== next) {
        const pos = editorRef.getPosition?.();
        model.setValue(next);
        if (pos) editorRef.setPosition(pos);
      }
    };

    ytext.observe(YObserver);
    disposeYToLocal = () => ytext.unobserve(YObserver);

    // Seed Yjs after the WebSocket connects (so we don't race with the server sync).
    // If the server already has content (other users are active), their content wins.
    // If the server is empty (no one else is connected), we seed from SQL.
    const seedFromSQL = () => {
      if (ytext.length === 0 && code.value) {
        console.log('Seeding Yjs from SQL:', code.value.substring(0, 50));
        setYText(code.value);
      }
      // Even if Yjs has content, if the editor is empty, show the Yjs content
      if (model.getValue() === '' && ytext.length > 0) {
        model.setValue(ytext.toString());
      } else if (model.getValue() === '' && code.value) {
        // Or show SQL content if Yjs is still empty
        model.setValue(code.value);
      }
    };

    if (provider?.wsconnected) {
      seedFromSQL();
    } else {
      provider?.once('sync', seedFromSQL);
    }
  }


  const disposable = editorRef.onDidChangeCursorPosition((e: any) => {
    newLine.value = e.position?.lineNumber ?? null;
  });

  disposeCursorListener = () => disposable.dispose();


  // 4. UI DECORATIONS (The "+" icon in the gutter)
  // We want to show a "+" icon next to the line where the cursor is active.
  function updateLineUI(lineNumber: number | null) {
    newLine.value = lineNumber ?? null;

    // deltaDecorations is Monaco's way of adding/removing visual elements.
    // We remove old decorations (lineDecorationIds) and add a new one.
    lineDecorationIds = editorRef.deltaDecorations(lineDecorationIds, lineNumber ?
      [{
        range: new monaco.Range(lineNumber, 1, lineNumber, 1),
        options: {
          isWholeLine: true,
          glyphMarginClassName: 'cmt-plus', // CSS class defined in <style>
          glyphMarginHoverMessage: { value: 'add comment' },
        },
      }] : []
    );
  }
  const pos = editorRef.getPosition?.();
  updateLineUI(pos?.lineNumber ?? 1);

  // Listen for selection changes to track multi-line selections
  const selectionListener = editorRef.onDidChangeCursorSelection((e: any) => {
    const selection = e.selection;
    if (selection.startLineNumber !== selection.endLineNumber) {
      // Multi-line selection
      newLine.value = selection.startLineNumber;
      newEndLine.value = selection.endLineNumber;
    } else {
      // Single line
      newLine.value = selection.startLineNumber;
      newEndLine.value = null;
    }
    updateLineUI(selection.startLineNumber);
  });

  disposeCursorListener = () => selectionListener.dispose();

  // 5. CLICK LISTENER
  // Detect clicks on the gutter (the margin where line numbers and our "+" icon are).
  editorRef.onMouseDown((e: any) => {
    const p = e.target?.position;
    if (!p?.lineNumber) return;

    const t = e.target?.type;
    // Check if the click was on the Glyph Margin (where our icon is)
    const isLineClick =
      t === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN ||
      t === monaco.editor.MouseTargetType.GUTTER_LINE_DECORATIONS;
    if (!isLineClick) return;

    // If clicked, show the inline comment widget
    showWidgetAtLine(p.lineNumber)
  });
}



function closeInlineWidget() {
  if (editorRef && inlineWidget) {
    editorRef.removeContentWidget(inlineWidget);
  }
  inlineWidget = null;
  inlineDom = null;
  inlineLine = null;
}

/**
 * INLINE WIDGET LOGIC
 * Monaco allows "Content Widgets" which are DOM elements overlaid on the editor text.
 * We use this to show the comment input box right below the code line.
 */
function showWidgetAtLine(line: number) {
  inlineLine = line;
  // Create the DOM element for the widget (see makeDom below)
  inlineDom = makeDom(inlineLine);

  const widget = {
    getId: () => INLINE_WIDGET_ID,
    getDomNode: () => inlineDom!,
    getPosition: () => ({
      position: { lineNumber: line, column: 1 },
      preference: [
        // Try to place it exactly at the line, or below it
        monacoRef.editor.ContentWidgetPositionPreference.EXACT,
        monacoRef.editor.ContentWidgetPositionPreference.BELOW,
      ]
    }),
    allowEditorOverflow: true,
    suppressMouseDown: true,
  };

  // Add or update the widget in the editor
  if (!inlineWidget) {
    inlineWidget = widget;
    editorRef.addContentWidget(inlineWidget);
  } else {
    inlineWidget.getPosition = widget.getPosition;
    inlineWidget.getDomNode = widget.getDomNode;
    editorRef.layoutContentWidget(inlineWidget);
  }
}




/**
 * DOM CREATION FOR WIDGET
 * Since we are manually creating a DOM element for Monaco, we use vanilla JS here.
 * This creates the HTML structure for the comment input and buttons.
 */
function makeDom(line: number) {
  const el = document.createElement('div');
  el.className = "mw-inline"; // Styled in <style> block

  const lineRange = newLine.value && newEndLine.value && newEndLine.value > newLine.value
    ? `Lines ${newLine.value}-${newEndLine.value}`
    : `Line ${line}`;

  el.innerHTML = `
            <div class="mw-head">Comment ${lineRange}</div>
            <textarea class="mw-input" rows="3"></textarea>
            <div class="mw-actions">
                <button class="mw-btn mw-cancel" type="button">Cancel</button>
                <button class="mw-btn mw-add" type="button">Add</button>
            </div>
            `

  // Attach event listeners to the buttons
  const ta = el.querySelector<HTMLTextAreaElement>('.mw-input')!
  const cancelBtn = el.querySelector('.mw-cancel');
  const addBtn = el.querySelector('.mw-add');

  setTimeout(() => ta?.focus(), 0);

  cancelBtn.addEventListener('click', () => closeInlineWidget());

  addBtn.addEventListener('click', async () => {
    const body = ta.value.trim();
    if (!body) return;
    try {
      const lineToAnchor = newLine.value || line;
      const model = editorRef.getModel();
      const offset = model.getOffsetAt({ lineNumber: lineToAnchor, column: 1 });
      const relPos = Y.createRelativePositionFromTypeIndex(ytext, offset);

      // Submit comment to API
      const payload: any = {
        line: lineToAnchor,
        body,
        yAnchor: JSON.stringify(relPos)
      };
      if (newEndLine.value && newEndLine.value > lineToAnchor) {
        payload.endLine = newEndLine.value;
      }
      await api.post(`projects/${projectId.value}/v/${currentVersionId.value}/comments`, payload);
      await fetchComments();
      editorRef?.revealLineInCenter(inlineLine);
      closeInlineWidget();
      $q.notify({ type: 'positive', message: 'Comment created! +5 Points', icon: 'star' });
    } catch (error) {
      console.error(error);
      $q.notify({ type: 'negative', message: 'Failed to add comment' });
    }
  })
  return el;
}

const sortedAllComments = computed(() =>
  [...allProjectComments.value].sort((a, b) => {
    // Sort by version (desc) then line then createdAt
    if (a.versionId !== b.versionId) return b.versionId - a.versionId;
    if (a.line !== b.line) return a.line - b.line;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  })
);

// Track range decoration IDs for the red stripes
let rangeDecorationIds: string[] = [];


const canSubmit = computed(() =>
  Boolean(currentVersionId.value && newLine.value && newLine.value > 0 && newBody.value.trim().length)
);

/**
 * Resolves a comment's Yjs relative position to a current line number.
 * If no yAnchor exists, it falls back to the static line number.
 */
function resolveCommentLine(comment: UIComment): number {
  if (!comment.yAnchor || !isLatestVersion.value) return comment.line;

  try {
    const relPos = JSON.parse(comment.yAnchor);
    const absPos = Y.createAbsolutePositionFromRelativePosition(relPos, doc);

    if (absPos && editorRef) {
      const pos = editorRef.getModel()?.getPositionAt(absPos.index);
      if (pos) return pos.lineNumber;
    }
  } catch (err) {
    console.error('Failed to resolve Yjs anchor:', err);
  }
  return comment.line;
}


async function fetchComments() {
  if (!currentVersionId.value) return;
  errorMsg.value = "";
  isLoadingComments.value = true;

  try {
    // Fetch current version comments (for inline widgets and red stripes)
    const { data: versionComments } = await api.get(`/projects/${projectId.value}/v/${currentVersionId.value}/comments`);

    // Update the editor widgets whenever comments change
    const resolvedComments = versionComments.map((c: any) => ({
      ...c,
      line: resolveCommentLine(c)
    }));
    allComents.value = resolvedComments;

    // Fetch ALL project comments relevant to the CURRENT version (persistent)
    const { data: projectComments } = await api.get(`/projects/${projectId.value}/comments`, {
      params: { versionId: currentVersionId.value }
    });
    const resolvedProjectComments = projectComments.map((c: any) => ({
      ...c,
      line: resolveCommentLine(c)
    }));
    allProjectComments.value = resolvedProjectComments;

    // Update the editor widgets whenever comments change
    updateCommentWidgets();
    renderRangeDecorations();
  } catch (error) {
    $q.notify({ type: 'negative', message: 'Failed to fetch comments' });
  } finally {
    isLoadingComments.value = false;
  }
}

/**
 * Render red stripe decorations for commented line ranges
 */
function renderRangeDecorations() {
  if (!editorRef || !monacoRef) return;
  const decos: any[] = [];

  // One decoration PER line inside each comment's range
  for (const c of allComents.value) {
    const start = Math.max(1, c.line);
    const end = Math.max(start, c.endLine || c.line);
    for (let ln = start; ln <= end; ln++) {
      decos.push({
        range: new monacoRef.Range(ln, 1, ln, 1),
        options: {
          isWholeLine: true,
          linesDecorationsClassName: 'cmt-range',
          hoverMessage: {
            value: `Comment #${c.id}: lines ${c.line}${c.endLine && c.endLine > c.line ? '–' + c.endLine : ''}`
          },
          description: `comment-${c.id}`,
        },
      });
    }
  }

  rangeDecorationIds = editorRef.deltaDecorations(rangeDecorationIds, decos);
}

/**
 * Renders comments directly in the editor using ViewZones.
 */
function updateCommentWidgets() {
  if (!editorRef || !monacoRef) return;

  editorRef.changeViewZones((accessor: any) => {
    // Cleanup
    viewZoneIds.forEach(id => accessor.removeZone(id));
    viewZoneIds = [];

    // Group comments by their effective endLine (or line if single-line)
    const byEndLine = new Map<number, UIComment[]>();
    allComents.value.forEach(c => {
      const effectiveEnd = c.endLine || c.line;
      if (!byEndLine.has(effectiveEnd)) byEndLine.set(effectiveEnd, []);
      byEndLine.get(effectiveEnd)?.push(c);
    });

    byEndLine.forEach((comments, endLine) => {
      const container = document.createElement('div');
      container.className = 'inline-thread-zone';

      comments.forEach(c => {
        const el = document.createElement('div');
        const isResolvedNow = c.resolvedVersionId === currentVersionId.value;
        el.className = 'thread-comment' + (isResolvedNow ? ' is-resolved-now' : '');

        const lineRange = c.endLine && c.endLine > c.line
          ? `Lines ${c.line}-${c.endLine}`
          : `Line ${c.line}`;

        const resolvedBadge = isResolvedNow
          ? '<span class="tc-resolved-badge">RESOLVED</span>'
          : '';

        el.innerHTML = `
                        <div class="tc-meta">
                            <strong>${c.author?.name || c.author?.email || 'Anonymous'}</strong>
                            <span class="tc-line">${lineRange}</span>
                            ${resolvedBadge}
                            <span class="tc-date">${new Date(c.createdAt).toLocaleDateString()}</span>
                        </div>
                        <div class="tc-body">${c.content}</div>
                    `;
        container.appendChild(el);
      });

      const pxPerComment = 80;
      const heightInPx = comments.length * pxPerComment;
      const lineHeight = editorRef.getOption(monacoRef.editor.EditorOption.lineHeight);
      const heightInLines = Math.ceil(heightInPx / lineHeight);

      const zoneId = accessor.addZone({
        afterLineNumber: endLine,
        heightInLines: heightInLines,
        domNode: container
      });
      viewZoneIds.push(zoneId);
    });
  });

  // Add decorations for multi-line comment ranges
  const rangeDecorations: any[] = [];
  allComents.value.forEach(c => {
    if (c.endLine && c.endLine > c.line) {
      rangeDecorations.push({
        range: new monacoRef.Range(c.line, 1, c.endLine, 1),
        options: {
          isWholeLine: true,
          className: 'comment-range-highlight',
          marginClassName: 'comment-range-margin'
        }
      });
    }
  });
  editorRef.deltaDecorations([], rangeDecorations);
}

async function submitComment() {
  if (!canSubmit.value) return;
  isPosting.value = true;
  errorMsg.value = "";
  try {
    const model = editorRef.getModel();
    const offset = model.getOffsetAt({ lineNumber: newLine.value!, column: 1 });
    const relPos = Y.createRelativePositionFromTypeIndex(ytext, offset);

    const payload: any = {
      line: newLine.value,
      body: newBody.value.trim(),
      yAnchor: JSON.stringify(relPos)
    };
    if (newEndLine.value && newEndLine.value > newLine.value!) {
      payload.endLine = newEndLine.value;
    }
    await api.post(`/projects/${projectId.value}/v/${currentVersionId.value}/comments`, payload);
    newBody.value = "";
    await fetchComments();
    $q.notify({ type: 'positive', message: 'Comment created! +5 Points', icon: 'star' });

  } catch (error) {
    $q.notify({ type: 'negative', message: 'Failed to post comment' });
  } finally {
    isPosting.value = false;
  }
}

function scrollToLineFromQuery() {
  const line = Number(route.query.line);
  if (line && editorRef) {
    console.log('Scrolling to line from query:', line);
    setTimeout(() => {
      editorRef.revealLineInCenter(line);
      editorRef.setPosition({ lineNumber: line, column: 1 });
      editorRef.focus();
    }, 800); // Give extra time for Yjs and Monaco to stabilize
  }
}

/**
 * Navigate to a comment's version and scroll to its line
 */
function navigateToComment(comment: UIComment) {
  // If already on this version, just scroll
  if (comment.versionId === currentVersionId.value) {
    if (editorRef) {
      editorRef.revealLineInCenter(comment.line);
      editorRef.setPosition({ lineNumber: comment.line, column: 1 });
      editorRef.focus();
    }
  } else {
    // Navigate to the version, then scroll (will happen after route loads)
    router.push(`/projects/${projectId.value}/v/${comment.versionId}?line=${comment.line}`);
    // The scroll will be handled by the route watcher
  }
}

/**
 * Resolve (delete) a comment
 */
async function resolveComment(commentId: number) {
  try {
    await api.delete(`/projects/${projectId.value}/v/${currentVersionId.value}/comments/${commentId}`);
    // Refresh both comment lists
    await fetchComments();
    $q.notify({ type: 'positive', message: 'Comment resolved! +10 Points', icon: 'star' });
  } catch (error) {
    console.error('Failed to resolve comment:', error);
    $q.notify({ type: 'negative', message: 'Failed to resolve comment' });
  }
}

/**
 * Apply code changes from comment (placeholder for future implementation)
 */
function applyCommentChange(comment: UIComment) {
  console.log('Apply change for comment:', comment);
  // TODO: Implement code application logic
  // This will parse the comment for code suggestions and apply them
}

async function saveCurrent() {
  // Use Yjs content, not editor API, to ensure we save the synced version
  const code = ytext.toString();
  console.log('Saving current code from Yjs:', code.substring(0, 100));
  const newVersion = await save(code);
  if (newVersion && newVersion.id) {
    currentVersionId.value = newVersion.id;
    await loadVersionList();
    await fetchComments();
  }
}

async function loadProject() {
  try {
    const { data } = await api.get(`/projects/${projectId.value}`);
    project.value = data;
    console.log('Project loaded:', project.value?.name);
  } catch (error) {
    console.log(error);
    project.value = { name: `Project #${projectId.value}` };
    $q.notify({ type: 'negative', message: 'Failed to load project details' });
  }
}

/**
 * COMPONENT MOUNT LIFECYCLE
 * 1. Check if we have a valid versionId.
 * 2. If not, fetch the latest version or create a new one.
 * 3. Load project details and comments.
 */
async function loadVersionList() {
  if (!projectId.value) return;
  try {
    const { data } = await api.get(`/projects/${projectId.value}/v`);
    allVersions.value = data;
  } catch (error) {
    console.error('Failed to load versions:', error);
  }
}

function navigateToPreviousVersion() {
  if (!hasPreviousVersion.value) return;
  const prevVersion = allVersions.value[currentVersionIndex.value + 1];
  router.push(`/projects/${projectId.value}/v/${prevVersion.id}`);
}

function navigateToNextVersion() {
  if (!hasNextVersion.value) return;
  const nextVersion = allVersions.value[currentVersionIndex.value - 1];
  router.push(`/projects/${projectId.value}/v/${nextVersion.id}`);
}

onMounted(async () => {
  console.log('on ProjectPage mount project, projectId = ', projectId.value, 'versionId = ', currentVersionId.value);
  await initComponent();
});

// Watch for project changes
watch(projectId, async (newId) => {
  if (newId) {
    console.log('Project ID changed, full reload:', newId);
    await initComponent();
  }
});

// Watch for route changes and reload the version from SQL
watch(currentVersionId, async (newVersionId) => {
  if (newVersionId) {
    console.log('Version changed, refreshing data:', newVersionId);
    if (!project.value) await loadProject();
    // Reload version data from SQL for the NEW version
    await refresh();
    await fetchComments();
    scrollToLineFromQuery();

    // Update the editor to display the version's code if it changed
    if (editorRef && code.value !== undefined) {
      const model = editorRef.getModel?.();
      if (model && model.getValue() !== code.value) {
        model.setValue(code.value || '');
        // Only update Yjs if this is the latest version
        if (isLatestVersion.value) {
          setYText(code.value || '');
        }
      }
    }
  }
});

async function initComponent() {
  // Always load project first so we have the name immediately
  await loadProject();
  await loadVersionList();

  if (!Number.isFinite(currentVersionId.value)) {
    try {
      const { data: versions } = await api.get(`/projects/${projectId.value}/v`);
      if (Array.isArray(versions) && versions.length > 0) {
        return router.replace(`/projects/${projectId.value}/v/${versions[0].id}`);
      } else {
        const { data: created } = await api.post(`/projects/${projectId.value}/v/`, { code: '' });
        return router.replace(`/projects/${projectId.value}/v/${created.id}`);
      }
    } catch (err) {
      console.error(err);
    }
  }

  await refresh();
  await fetchComments();
  scrollToLineFromQuery();
}

onBeforeUnmount(() => {
  closeInlineWidget();
  disposeCursorListener?.();
  disposeLocalToY?.();
  disposeYToLocal?.();
});

// NOTE: We intentionally do NOT have a watchEffect that syncs SQL -> Yjs
// because that would overwrite live collaborative edits with stale database content.
// The Yjs document is the source of truth for the CURRENT session.
// SQL is only used to seed Yjs on first load (when ytext is empty).

// to do list:
// make a click line to add comment function / element
// make version switching functionality not done through url
// make comments next to line - or some sort of correspondance
// invitations and bring back membership validation
// use parentId property and relationship on schema for comment threads
// gamification things
</script>

<style>
/* ────────────────
   INLINE COMMENT WIDGET
   ──────────────── */
.mw-inline {
  background: #1e1e1e;
  /* matches Monaco dark theme */
  color: #eee;
  border: 1px solid #3c3c3c;
  border-radius: 6px;
  padding: 10px;
  width: 320px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
  font-family: 'Inter', 'Segoe UI', sans-serif;
  z-index: 1000;
}

.mw-inline .mw-head {
  font-size: 13px;
  color: #ccc;
  margin-bottom: 6px;
  border-bottom: 1px solid #333;
  padding-bottom: 4px;
}

.mw-inline .mw-input {
  width: 100%;
  resize: vertical;
  background: #252526;
  color: #eee;
  border: 1px solid #444;
  border-radius: 4px;
  font-size: 13px;
  padding: 6px 8px;
  box-sizing: border-box;
  outline: none;
  transition: border-color 0.15s ease;
}

.mw-inline .mw-input:focus {
  border-color: #007acc;
  /* Monaco blue */
}

.mw-inline .mw-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}

.mw-inline .mw-btn {
  border: none;
  border-radius: 4px;
  padding: 4px 10px;
  font-size: 13px;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.mw-inline .mw-add {
  background: #007acc;
  color: #fff;
}

.mw-inline .mw-add:hover {
  background: #0a84d6;
}

.mw-inline .mw-cancel {
  background: #2c2c2c;
  color: #ccc;
}

.mw-inline .mw-cancel:hover {
  background: #3a3a3a;
  color: #fff;
}

/* ────────────────
   MONACO GUTTER GLYPH (+ icon)
   ──────────────── */
.cmt-plus {
  background-color: transparent;
  background-image: url('data:image/svg+xml;utf8,<svg fill="%23ccc" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M7 1h2v6h6v2H9v6H7V9H1V7h6V1z"/></svg>');
  background-repeat: no-repeat;
  background-position: center;
  background-size: 12px;
  cursor: pointer;
  transition: filter 0.15s ease;
}

.cmt-plus:hover {
  filter: brightness(1.4);
}

/* ────────────────
   INLINE THREAD (ViewZone)
   ──────────────── */
.inline-thread-zone {
  background: #1e1e1e;
  border-left: 3px solid #007acc;
  padding: 4px 0 4px 20px;
  box-sizing: border-box;
  overflow: hidden;
}

.thread-comment {
  background: #252526;
  border: 1px solid #3c3c3c;
  border-radius: 4px;
  margin-bottom: 8px;
  padding: 8px;
  color: #eee;
  font-family: 'Inter', sans-serif;
  font-size: 13px;
}

.thread-comment:last-child {
  margin-bottom: 0;
}

.tc-meta {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
  color: #aaa;
  font-size: 11px;
}

.tc-meta strong {
  color: #4fc1ff;
}

.tc-body {
  line-height: 1.4;
}

.tc-line {
  color: #888;
  margin: 0 8px;
}

.is-resolved-now {
  opacity: 0.5;
  filter: grayscale(0.8);
}

.is-resolved-now .tc-body {
  text-decoration: line-through;
  color: #888;
}

.tc-resolved-badge {
  background: #2e7d32;
  color: white;
  padding: 1px 4px;
  border-radius: 3px;
  font-size: 9px;
  font-weight: bold;
  vertical-align: middle;
}

/* ────────────────
   MULTI-LINE COMMENT RANGE HIGHLIGHT
   ──────────────── */
.comment-range-highlight {
  background: rgba(0, 122, 204, 0.08);
  border-left: 2px solid rgba(0, 122, 204, 0.4);
}

.comment-range-margin {
  background: rgba(0, 122, 204, 0.15);
}

/* ────────────────
   RED STRIPE FOR COMMENTED LINES
   ──────────────── */
.monaco-editor .cmt-range {
  border-left: 3px solid #ef4444;
  margin-left: 2px;
}
</style>
