<template>
    <q-page padding>
        <div class="row items-center q-mb-md">
            <div class="text-h5">{{  project?.name || "Loading.."}}</div>
            <q-space/>
            <q-btn color="primary" dense label="Refresh" :loading="isLoading" @click="refresh"/>
            <q-btn color="primary" dense label="Save" @click="save()"/>
        </div>

        <div class="text-caption text-grey-7 q-mb-md">
            Created: {{ createdAt ? new Date(createdAt).toLocaleDateString() : "--" }}  -  Updated: {{ updatedAt ? new Date(updatedAt).toLocaleString() : "--" }}
        </div>

        <q-banner v-if="errorMsg" class="bg-red-1 text-red q-mb-md">{{ errorMsg }}</q-banner>
        <MonacoEditor 
            :language="language"
            theme="vs-dark"
            v-model:value="code"
            
            height="600px"
            width="100%"
            :options="{ automaticLayout: true }"
            @mount="onMonacoMount"
        />

        <div class="text-caption text-grey-7 g-mt-md">
            Websocket: {{ status }}  --  Room: {{ `project-${projectId}-v-${ versionId ?? 'latest' }`}}
        </div>

        <!-- <div class="editor-content q-mb-md">
            <q-input v-model="form.title" label="Title" dense />
            <q-select v-model="form.language" :options="languageOptions" label="language" dense/>
            <q-input v-model="form.code" label="Code" dense type="textarea" class="q-mb-md"/>
            <div class="action-buttons">
                <q-btn color="primary" label="Submit" @click="showEditor = true"/>
                <q-btn color="primary" label="Submit All" @click="submitAll"/>
                <q-btn color="primary" label="Refresh" @click="refreshBtn"/>
            </div>

        </div>
        <div class="q-mt-md">
            <q-btn color="primary" label="Submit Code" @click="createSubmission"/>
            <q-btn color="negative" label="Cancel" @click="showEditor = false"/>
        </div> -->
        <!-- <q-separator class="q-my-md"/>
        <div v-if="submissions.length===0">No submissions yet - add one above!</div>

        <q-card v-for="s in submissions" :key="s.id" class="cursor-point q-md-md" @click="openSubmission(s.id)">
            <q-card-section>
                <div class="text-subtitle1">{{ s.title }}</div>
                <div class="text-caption">{{ s.language }}</div>
            </q-card-section>
        </q-card> -->
    </q-page>
</template>

<script setup>
    import MonacoEditor from '@guolao/vue-monaco-editor';
    import { ref, onMounted, onBeforeUnmount } from 'vue';
    import { api } from '../lib/http';
    import { useRoute, useRouter } from 'vue-router';
    import { useVersion } from '../composables/useVersion'; 
    import { useYDoc } from 'src/composables/useYDocs';

   
    // const router = useRouter();
    const route = useRoute();
    const router = useRouter();
    const projectId = Number(route.params.projectId);


    const project = ref(null);
    const versionId = Number(route.params.versionId);

    

    const { code, language, createdAt, updatedAt, isLoading, errorMsg, refresh, save } = useVersion(projectId, versionId || 0);
    


    async function loadProject() {
        console.log('submissions hi');
        try {
            const { data } = await api.get('/projects');
            project.value = data.find(p => p.id === projectId);
            console.log(project);
        } catch (error) {
            console.log(error);
            errorMsg.value = 'Failed to load project';
            return;
        }

        // try {
        //     const subRes = await api.get(`/projects/${projectId}/submissions`);
        //     submissions.value = subRes.data;
        //     console.log(submissions.value);
        // } catch (error) {
        //     console.warn('Could not load submissions', error);
        //     submissions.value = [];
        // }
    }

    onMounted(async () => {
        console.log('on ProjectPage mount project, projectId = ', projectId, 'versionId = ', versionId);
        await loadProject();

        if(!Number.isFinite(versionId)) {
            try {
                const { data: versions } = await api.get(`projects/${projectId}`);
                if(Array.isArray(versions) && versions.length > 0) {
                    // if there are versions in existence (of the project with projectId specified) display the latest one (order 'desc'ending)
                    return router.replace(`projects/${projectId}/v/${versions[0].id}`);
                } else {
                    // if there aren't post request a new version with the payload and reroute to new file
                    // we are doing no rewrites or updates just appending new versions for now
                    const { data: created } = await api.post(`project/${projectId}/v/`, { code: '' });
                    return router.replace(`projects/${projectId}/v/${created.id}`);
                }
            } catch (error) {
                errorMsg.value = 'could not replace version';
                console.log(error)
                return;
            }
        }
        await refresh();
    });


    const room = `project-${projectId}-v-${versionId ?? 'latest'}`;
    const { doc, status } = useYDoc(room);
    const ytext = doc.getText('code');

    function onMonacoMount(editor) {
        const model = editor.getModel();
        model.setValue(ytext.toString());

        const disposeLocal = editor.onDidChangeModelContent(() => {
            const next = model.getValue();
            doc.transact(() => {
                ytext.delete(0, ytext.length);
                ytext.insert(0, next);
            })
        })

        const yObserver = () => {
            const next = ytext.toString();
            if(model.getValue() !== next)model.setValue(next)
        }
        ytext.observe(yObserver);

        onBeforeUnmount(() => {
            disposeLocal.dispose();
            ytext.unobserve(yObserver);
        });
    }
</script>

<style>



</style>