<template>
    <q-page padding>
        <div class="q-mb-md row space-between nav-header">
            <div class="text-h5">My Projects</div>
            <!-- <div class="nav-buttons">
                <q-btn color="primary" label="Logout" @click="userLogout"></q-btn>
            </div> -->
        </div>
        <q-card class="q-mb-md">
            <q-card-section class="row q-col-gutter-d">
                <div class="col-12 col-md-4">
                    <q-input v-model="form.name" label="Project Name" dense />
                </div>
                <div class="col-12 col-md-4">
                    <q-input v-model="form.description" type="textarea" label="Project Description" dense />
                </div>
                <div class="col-12 col-md-2 flex items-end">
                    <q-btn color="primary" label="Create" :disable="!form.name" @click="createProject"/>
                </div>
            </q-card-section>
        </q-card>

        <q-card v-for="p in projects" :key="p.id" class="q-mb-md">
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
                    <q-btn flat color="negative" label="Delete" @click="deleteProject(p.id)" />
                </q-card-actions>
            </q-card-section>
        </q-card>

    
    </q-page>
</template>

<script setup>
    import { ref, onMounted } from 'vue';
    import { api } from '../lib/http';
    // import { useAuth } from 'src/stores/auth';
    // import { useRouter } from 'vue-router';
    // import axios from 'axios';

    // const router = useRouter();
    // const auth = useAuth();

    const projects = ref([]);
    // const errorMsg = ('');

    const form = ref({
        name: '',
        description: '',
    });

    async function getProjects() {
        console.log('is being run');
        try {
            const { data } = await api.get('/projects');
            console.log(data);
            projects.value = data;
        } catch (error) {
            console.log(error);
        }
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