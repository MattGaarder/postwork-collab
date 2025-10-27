<template>
    <q-page padding>
        <div class="row items-center q-mb-md">
            <div class="text-h5">p{{ projectId }}.v{{ versionId ?? "latest" }} - {{  project?.name || "Loading.."}}</div>
            <q-space/>
            <q-btn color="primary" dense label="Refresh" :loading="isLoadingComments" @click="fetchComments"/>
            <q-btn color="primary" class="q-ml-xs" dense label="Save" :loading="isLoading" @click="saveCurrent"/>
        </div>

        <!-- <div class="text-caption text-grey-7 q-mb-md">
            Created: {{ createdAt ? new Date(createdAt).toLocaleDateString() : "--" }}  -  Updated: {{ updatedAt ? new Date(updatedAt).toLocaleString() : "--" }}
        </div> -->



        <MonacoEditor 
            :language="language"
            theme="vs-dark"
            height="600px"
            width="100%"
            :options="{ automaticLayout: true }"
            @mount="onMonacoMount"
        />
        <q-banner v-if="errorMsg" class="bg-red-1 text-red q-mb-md">{{ errorMsg }}</q-banner>
        <div class="text-caption text-grey-7 g-mt-md">
            Websocket: {{ status }}  --  Room: {{ `project-${projectId}-v-${ versionId ?? 'latest' }` }}
        </div>
        <div class="q-mt-md">
            <div class="text-subtitle2">Add Comment</div>
            <div class="row q-col-gutter-sm item-start q-mt-sm">
                <div class="col-12 col-sm-3">
                    <q-input
                    v-model.number="newLine"
                    type="number"
                    label="Line Number"
                    :min="1"
                    dense
                    />
                </div>
                <div class="col-12 col-sm-7">
                    <q-input 
                        v-model="newBody"
                        type="textarea"
                        autogrow
                        label="Comment"
                    />
                </div>
                <div class="col-12 col-sm-2 flex item-start">
                    <q-btn
                        color="primary"
                        class="q-mt-sm fill-width"
                        label="Add comment"
                        :disable="!canSubmit"
                        :loading="isPosting"
                        @click="submitComment"
                    />
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

//    import { watchEffect } from 'vue';

    // const router = useRouter();
    const route = useRoute();
    const router = useRouter();

    const projectId = Number(route.params.projectId);
    const versionId = Number(route.params.versionId);
 
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
    let disposeCursorListener: (() => void) | null = null;
    let disposeLocalToY: (() => void) | null = null;
    let disposeYToLocal: (() => void) | null = null;
    
    const room = `project-${projectId}-v-${versionId ?? 'latest'}`;
    const { doc, status } = useYDoc(room);
    const ytext = doc.getText('code');

    function setYText(text: string) {
        doc.transact(() => {
            // get length of text from beginning to end
            ytext.delete(0, ytext.length);
            // insert next = model.getValue(); whenever the model changes
            ytext.insert(0, text);
            // do it all in one chunk so there's no flickering (transact)
        })
    }

    function onMonacoMount(editor: any) {
        editorRef = editor;
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
            if(next !== ytext.toString()) setYText(next)
        });
        disposeLocalToY = () => localSub.dispose();

        const YObserver = () => {
            const next = ytext.toString();
            if(model.getValue() !== next) {
                const pos = editorRef.getPosition?.();
                model.setValue(next);
                if(pos) editorRef.setPosition(pos);
            }
        };

        if(editorRef && code.value) {
            const model = editorRef.getModel?.();
            if (model && model.getValue() !== code.value) {
                model.setValue(code.value);
                setYText(code.value);
            }
        } 
        ytext.observe(YObserver);
        disposeYToLocal = () => ytext.unobserve(YObserver);


        const pos = editorRef.getPosition?.();
        newLine.value = pos?.lineNumber ?? 1;

        const disposable = editorRef.onDidChangeCursorPosition((e: any) => { 
            newLine.value = e.position?.lineNumber ?? null;
        });

        disposeCursorListener = () => disposable.dispose();
    }



    const canSubmit = computed(() => 
        Boolean(versionId && newLine.value && newLine.value > 0 && newBody.value.trim().length)
    );

    const sortedComments = computed(() =>
        [...allComents.value].sort((a, b) => 
            a.line === b.line ? new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() : a.line - b.line
        )
    );
    
    const { isLoading, errorMsg, refresh, save, code } = useVersion(projectId, Number(versionId) || 0);
    
    async function fetchComments() {
        if(!versionId) return;
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
        if(!canSubmit.value) return;
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

        if(!Number.isFinite(versionId)) {
            try {
                const { data: versions } = await api.get(`/projects/${projectId}`);
                if(Array.isArray(versions) && versions.length > 0) {
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
        disposeCursorListener?.();
        disposeLocalToY?.();
        disposeYToLocal?.();
    });
    watchEffect(() => {
        if(editorRef && code.value) {
            const model = editorRef.getModel?.();
            if(model && model.getValue() !== code.value) {
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



</style>