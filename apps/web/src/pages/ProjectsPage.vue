<template>
    <q-page padding>
        <div class="q-mb-md row space-between nav-header">
            <div class="text-h5">My Projects</div>
            <div class="nav-buttons flex">
                <q-btn color="primary" label="Logout" @click="logout" :loading="isLoading" class="float-right"></q-btn>

            </div>
        </div>

        <q-banner v-if="errorMsg" class="bg-red-2 text-red q-mb-md">{{ errorMsg }}</q-banner>


        <q-card class="q-mb-md">
            <q-card-section class="row q-col-gutter-d">
                <div class="col-12 col-md-4">
                    <q-input v-model="form.name" label="Project Name" dense />
                </div>
                <div class="col-12 col-md-4">
                    <q-input v-model="form.description" type="textarea" label="Project Description" dense />
                </div>
                <div class="col-12 col-md-4">
                    <q-select
                        v-model="form.language"
                        :options="languageOptions"
                        label="Language"
                        dense
                        emit-value
                        map-options
                    />
                </div>
                <div class="col-12 col-md-2 flex items-end">
                    <q-btn color="primary" label="Create" :disable="!form.name" :loading="isCreating" @click="createProject"/>
                </div>
            </q-card-section>
        </q-card>
        <div v-if="projects.length === 0 && !isLoading" class="text-grey q-mt-md">No projects yet</div>



        <q-card v-for="p in projects" :key="p.id" class="q-mb-md cursor-pointer" @click="openProject(p.id)" >
            <q-card-section class="row project-row">
                <div class="project">
                    <div class="text-subtitle1">
                        {{ p.name }}
                    </div>
                    <div class="text-caption">
                        {{ p.description ?? '-' }}
                    </div>
                </div>
                <q-card-actions align="right">
                    <q-btn flat color="negative" label="Delete" @click.stop="deleteProject(p.id)" />
                </q-card-actions>
            </q-card-section>
        </q-card>

    
    </q-page>
</template>

<script setup>
    import { ref, onMounted } from 'vue';
    import { api } from '../lib/http';
    // import { useAuth } from 'src/stores/auth';
    import { useRouter } from 'vue-router';
    import { useAuth } from 'src/stores/auth';


    const router = useRouter();
    const auth = useAuth();

    const projects = ref([]);
    const errorMsg = ref('');
    const isLoading = ref(false);
    const isCreating = ref(false);

    const languageOptions = [
        { label: 'JavaScript', value: 'JAVASCRIPT' },
        { label: 'Python', value: 'PYTHON' },
        { label: 'Java', value: 'JAVA' },
    ]


    const form = ref({
        name: '',
        description: '',
        language: 'JAVASCRIPT',
    });

    
    async function openProject(id) {
        console.log('opening project: ', {id});
        try {
            const { data: versions } = await api.get(`projects/${id}/v`);
            
            if (Array.isArray(versions) && versions.length > 0) {
                const latest = versions[0];
                return router.push(`/projects/${id}/v/${latest.id}`);
            }
            
            const { data: created } = await api.post(`/projects/${id}/v`, { code: '' });
            return router.push(`/projects/${id}/v/${created.id}`);
        } catch (error) {
            console.log("error creating new / opening project - ", error);
            return router.push(`/projects/${id}`);
        }
    }
    
    async function getProjects() {
        console.log('is being run - getting projects');
        errorMsg.value = '';
        isLoading.value = true;
        try {
            const { data } = await api.get('/projects');
            console.log(data);
            projects.value = data;
        } catch (error) {
            console.log(error);
            errorMsg.value = humanizeError(error);
        } finally {
            isLoading.value = false;
        }
    }

    async function logout () {
        try {
            auth.token = null;
            auth.user = null;
            localStorage.removeItem('jwt');
            delete api.defaults.headers.Authorization;
        } catch (error) {
            console.log('logout error: ', error)
            errorMsg.value = humanizeError(error);
        }
    }

    async function createProject() {
        errorMsg.value = '';
        isCreating.value = true;
        try {
            const payload = {
                name: form.value.name,
                description: form.value.description,
                language: form.value.language,
            };

            const { data } = await api.post('/projects', payload);

            projects.value.unshift(data);
            form.value.name = '';
            form.value.description = ''
        } catch (error) {
            errorMsg.value = humanizeError(error);
        } finally {
            isCreating.value = false;
            isLoading.value = false;
        }
    }

    async function deleteProject(id) {
        errorMsg.value = '';
        try {
            await api.delete(`/projects/${id}`);
            projects.value = projects.value.filter(p => p.id != id);
        } catch (error) {
            errorMsg.value = humanizeError(error)
        }
    }

    function humanizeError (err) {
        const status = err?.response?.status;
        const msg = err?.response?.data.error;
        if (status === 401) return 'please login';
        return msg || 'something went wrong'
    }
    
    onMounted(getProjects)
</script>

<style>
    .nav-header {
        display: flex;
        flex-direction: row;
        justify-content: space-between;
    }
    
</style>