<template>
    <q-page padding>
         <div class="row items-center q-mb-md">
            <div class="text-h5">{{  project?.name || "Loading.."}}</div>
            <q-space/>
         </div>
        <div class="container" style="height: 800px; width: 100%">
            <MonacoEditor 
                v-model:value="code"
                :language="language"
                theme="vs-dark"
                @mount="onMonacoMount"
                :options="{ automaticLayout: true }"
            />
        </div>
        <q-banner v-if="errorMsg" class="bg-red-1 text-red q-mb-md">{{ errorMsg }}</q-banner>

        <div class="editor-content q-mb-md">
            <q-input v-model="form.title" label="Title" dense />
            <q-select v-model="form.language" :options="languageOptions" label="language" dense/>
            <q-input v-model="form.code" label="Code" dense type="textarea" filled autogrow class="q-mb-md"/>
            <div class="action-buttons">
                <q-btn color="primary" label="Submit" @click="showEditor = true"/>
                <q-btn color="primary" label="Submit All" @click="submitAll"/>
                <q-btn color="primary" label="Refresh" @click="refreshBtn"/>
            </div>

        </div>
        <div class="q-mt-md">
            <q-btn color="primary" label="Submit Code" @click="createSubmission"/>
            <q-btn color="negative" label="Cancel" @click="showEditor = false"/>
        </div>
        <q-separator class="q-my-md"/>
        <div v-if="submissions.length===0">No submissions yet - add one above!</div>

        <q-card v-for="s in submissions" :key="s.id" class="cursor-point q-md-md" @click="openSubmission(s.id)">
            <q-card-section>
                <div class="text-subtitle1">{{ s.title }}</div>
                <div class="text-caption">{{ s.language }}</div>
            </q-card-section>
        </q-card>
    </q-page>
</template>

<script setup>
    import { ref, onMounted } from 'vue';
    import { api } from '../lib/http';
    import { useRoute } from 'vue-router';
    import MonacoEditor from '@guolao/vue-monaco-editor';
   
    // const router = useRouter();
    const route = useRoute();
    const projectId = Number(route.params.projectId);

    const project = ref(null);
    const submissions = ref([]);
    const showEditor = ref(false);
    const errorMsg = ref('');
    const form = ref({ title: '', language: 'JavaScript', code: ''});
    const languageOptions = ref(['JavaScript', 'Python', 'Java']);
    
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

        try {
            const subRes = await api.get(`/projects/${projectId}/submissions`);
            submissions.value = subRes.data;
            console.log(submissions.value);
        } catch (error) {
            console.warn('Could not load submissions', error);
            submissions.value = [];
        }
    }

    onMounted(loadProject)
</script>

<style>



</style>