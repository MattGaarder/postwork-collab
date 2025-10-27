<template>
    <q-page padding>
        <div class="row items-center q-mb-md">
            <div class="text-h5">p{{ projectId }}.v{{ versionId ?? "latest" }} - {{ project?.name || "Loading.." }}</div>
            <q-space />
            <q-btn color="primary" dense label="Refresh" :loading="isLoadingComments" @click="fetchComments" />
            <q-btn color="primary" class="q-ml-xs" dense label="Save" :loading="isLoading" @click="saveCurrent" />
        </div>

        <!-- <div class="text-caption text-grey-7 q-mb-md">
            Created: {{ createdAt ? new Date(createdAt).toLocaleDateString() : "--" }}  -  Updated: {{ updatedAt ? new Date(updatedAt).toLocaleString() : "--" }}
        </div> -->



        <MonacoEditor :language="language" theme="vs-dark" height="600px" width="100%"
            :options="{ automaticLayout: true, glyphMargin: true }" @mount="onMonacoMount" />
        <q-banner v-if="errorMsg" class="bg-red-1 text-red q-mb-md">{{ errorMsg }}</q-banner>
        <div class="text-caption text-grey-7 g-mt-md">
            Websocket: {{ status }} -- Room: {{ `project-${projectId}-v-${versionId ?? 'latest'}` }}
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
        <div class="m-mt-md">
            <div class="text-subtitle2">Comments:</div>
            <q-list bordered dense v-if="sortedComments.length">
                <q-item v-for="c in sortedComments" :key="c.id">
                    <q-item-section>
                        <div class="text-caption text-grey">Line {{ c.line }}</div>
                        <div class="text-body2">{{ c.content }}</div>
                        <div class="text-caption text-grey">
                            by {{ c.author?.name || c.author?.email || "Anonymous" }}
                            - {{ new Date(c.createdAt).toLocaleDateString() }}
                        </div>
                    </q-item-section>
                </q-item>

            </q-list>
            <q-item v-else>
                <q-item-section>No comments</q-item-section>
            </q-item>
        </div>

    </q-page>
</template>

<script setup lang="ts">
    import { ref, onMounted, computed, onBeforeUnmount } from 'vue';
    import { useRoute, useRouter } from 'vue-router';
    import { api } from '../lib/http';
    import MonacoEditor from '@guolao/vue-monaco-editor';

    import { useVersion } from '../composables/useVersion';
    import { useYDoc } from '../composables/useYDocs';

    import { watchEffect } from 'vue';

    const route = useRoute();
    const router = useRouter();

    const INLINE_WIDGET_ID = "INLINE_WIDGET_ID";
    const projectId = Number(route.params.projectId);
    const versionId = Number(route.params.versionId);

    const room = `project-${projectId}-v-${versionId ?? 'latest'}`;
    const { doc, status } = useYDoc(room);
    const ytext = doc.getText('code');

    const language = ref<'javascript' | 'python' | 'java'>('javascript');

    type UIComment = {
        id: number;
        versionId: number;
        line: number;
        content: string;
        createdAt: string;
        author?: { id: number; name?: string | null; email?: string | null };
    }

    const allComents = ref<UIComment[]>([]);
    const isLoadingComments = ref(false);
    const isPosting = ref(false);

    let newLine = ref<number | null>(null);
    const newBody = ref('');

    let project = ref(null);
    let editorRef: any = null;

    let lineDecorationIds: string[] = [];

    let disposeCursorListener: (() => void) | null = null;
    let disposeLocalToY: (() => void) | null = null;
    let disposeYToLocal: (() => void) | null = null;

    const { isLoading, errorMsg, refresh, save, code } = useVersion(projectId, Number(versionId) || 0);

    let monacoRef: any = null;
    let inlineWidget: any | null = null
    let inlineLine: number | null = null;
    let inlineDom: HTMLElement | null = null;


    function setYText(text: string) {
        doc.transact(() => {
            // get length of text from beginning to end
            ytext.delete(0, ytext.length);
            // insert next = model.getValue(); whenever the model changes
            ytext.insert(0, text);
            // do it all in one chunk so there's no flickering (transact)
        })
    }


    function onMonacoMount(editor: any, monaco: any) {
        editorRef = editor;
        monacoRef = monaco;
        const model = editorRef.getModel();
        const yHasText = ytext.length > 0;
        if (yHasText) {
            model.setValue(ytext.toString());
        } else {
            const initial = model.getValue() ?? "";
            setYText(initial);
        }

        const localSub = editor.onDidChangeModelContent(() => {
            const next = model.getValue();
            if (next !== ytext.toString()) setYText(next)
        });
        disposeLocalToY = () => localSub.dispose();

        const YObserver = () => {
            const next = ytext.toString();
            if (model.getValue() !== next) {
                const pos = editorRef.getPosition?.();
                model.setValue(next);
                if (pos) editorRef.setPosition(pos);
            }
        };

        if (editorRef && code.value) {
            const model = editorRef.getModel?.();
            if (model && model.getValue() !== code.value) {
                model.setValue(code.value);
                setYText(code.value);
            }
        }
        ytext.observe(YObserver);
        disposeYToLocal = () => ytext.unobserve(YObserver);


        const disposable = editorRef.onDidChangeCursorPosition((e: any) => {
            newLine.value = e.position?.lineNumber ?? null;
        });

        disposeCursorListener = () => disposable.dispose();

        function updateLineUI(lineNumber: number | null) {
            newLine.value = lineNumber ?? null;
            lineDecorationIds = editorRef.deltaDecorations(lineDecorationIds, lineNumber ?
                [{
                    range: new monaco.Range(lineNumber, 1, lineNumber, 1),
                    options: {
                        isWholeLine: true,
                        glyphMarginClassName: 'cmt-plus',
                        glyphMarginHoverMessage: { value: 'add comment' },
                    },
                }] : []
            );
        }
        const pos = editorRef.getPosition?.();
        updateLineUI(pos?.lineNumber ?? 1);

        const cursorP = editorRef.onDidChangeCursorPosition((e: any) => {
            updateLineUI(e.position?.lineNumber ?? null);
        });

        disposeCursorListener = () => cursorP.dispose();

        editorRef.onMouseDown((e: any) => {
            const p = e.target?.position;
            if (!p?.lineNumber) return;

            const t = e.target?.type;
            const isLineClick =
                t === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN ||
                t === monaco.editor.MouseTargetType.GUTTER_LINE_DECORATIONS;
            if (!isLineClick) return;

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

    function showWidgetAtLine(line: number) {
        inlineLine = line;
        inlineDom = makeDom(inlineLine);
        const widget = {
            getId: () => INLINE_WIDGET_ID,
            getDomNode: () => inlineDom!,
            getPosition: () => ({
                position: { lineNumber: line, column: 1 },
                preference: [
                    monacoRef.editor.ContentWidgetPositionPreference.EXACT,
                    monacoRef.editor.ContentWidgetPositionPreference.BELOW,
                ]
            }),
            allowEditorOverflow: true,
            suppressMouseDown: true,
        };
        if (!inlineWidget) {
            inlineWidget = widget;

            editorRef.addContentWidget(inlineWidget);
        } else {
            inlineWidget.getPosition = widget.getPosition;
            inlineWidget.getDomNode = widget.getDomNode;
            editorRef.layoutContentWidget(inlineWidget);
        }
    }




    function makeDom(line: number) {
        const el = document.createElement('div');
        el.className = "mw-inline";

        el.innerHTML = `
            <div class="mw-head">Comment line: ${line}</div>
            <textarea class="mw-input" rows="3"></textarea>
            <div class="mw-actions">
                <button class="mw-btn mw-cancel" type="button">Cancel</button>
                <button class="mw-btn mw-add" type="button">Add</button>
            </div>
            `

        const ta = el.querySelector<HTMLTextAreaElement>('.mw-input')!
        const cancelBtn = el.querySelector('.mw-cancel');
        const addBtn = el.querySelector('.mw-add');

        setTimeout(() => ta?.focus(), 0);

        cancelBtn.addEventListener('click', () => closeInlineWidget());

        addBtn.addEventListener('click', async () => {
            const body = ta.value.trim();
            if (!body) return;
            try {
                await api.post(`projects/${projectId}/v/${versionId}/comments`, {
                    line,
                    body
                });
                await fetchComments();
                editorRef?.revealLineInCenter(inlineLine);
                closeInlineWidget()
            } catch (error) {
                console.error(error);
                errorMsg.value = 'failed to add comment'
            }
        })
        return el;
    }

    const canSubmit = computed(() =>
        Boolean(versionId && newLine.value && newLine.value > 0 && newBody.value.trim().length)
    );

    const sortedComments = computed(() =>
        [...allComents.value].sort((a, b) =>
            a.line === b.line ? new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() : a.line - b.line
        )
    );


    async function fetchComments() {
        if (!versionId) return;
        errorMsg.value = "";
        isLoadingComments.value = true;

        try {
            const { data } = await api.get(`/projects/${projectId}/v/${versionId}/comments`);
            allComents.value = data;
        } catch (error) {
            errorMsg.value = 'failed to fetch'
        } finally {
            isLoadingComments.value = false;
        }
    }

    async function submitComment() {
        if (!canSubmit.value) return;
        isPosting.value = true;
        errorMsg.value = "";
        try {
            const payload = { line: newLine.value, body: newBody.value.trim() }; // body gets mapped to content in the route for reference
            await api.post(`/projects/${projectId}/v/${versionId}/comments`, payload);
            newBody.value = "";
            await fetchComments();

        } catch (error) {
            errorMsg.value = "failed to post comment";
        } finally {
            isPosting.value = false;
        }
    }

    function saveCurrent() {
        const code = editorRef?.getModel()?.getValue() ?? "";
        save(code);
    }

    async function loadProject() {
        try {
            const { data } = await api.get('/projects');
            project.value = data.find(p => p.id === projectId);
            console.log('hello', project);
        } catch (error) {
            console.log(error);
            errorMsg.value = 'Failed to load project';
            return;
        }
    }

    onMounted(async () => {
        console.log('on ProjectPage mount project, projectId = ', projectId, 'versionId = ', versionId);
        // await loadProject();

        if (!Number.isFinite(versionId)) {
            try {
                const { data: versions } = await api.get(`/projects/${projectId}`);
                if (Array.isArray(versions) && versions.length > 0) {
                    // if there are versions in existence (of the project with projectId specified) display the latest one (order 'desc'ending)
                    return router.replace(`/projects/${projectId}/v/${versions[0].id}`);
                } else {
                    // if there aren't post request a new version with the payload and reroute to new file
                    // we are doing no rewrites or updates just appending new versions for now
                    const { data: created } = await api.post(`/projects/${projectId}/v/`, { code: '' });
                    return router.replace(`/projects/${projectId}/v/${created.id}`);
                }
            } catch (error) {
                errorMsg.value = 'could not replace version';
                console.log(error)
                return;
            }
        }
        await refresh();
        await fetchComments();
        await loadProject();
    });

    onBeforeUnmount(() => {
        closeInlineWidget();
        disposeCursorListener?.();
        disposeLocalToY?.();
        disposeYToLocal?.();
    });

    watchEffect(() => {
        if (editorRef && code.value) {
            const model = editorRef.getModel?.();
            if (model && model.getValue() !== code.value) {
                model.setValue(code.value);
                setYText(code.value);
            }
        }
    });

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
  background: #1e1e1e; /* matches Monaco dark theme */
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
  border-color: #007acc; /* Monaco blue */
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
</style>