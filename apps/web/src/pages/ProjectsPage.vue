<template>
  <q-page class="q-pa-md bg-grey-2">
    <div class="row justify-between items-center q-mb-lg">
      <div class="text-h4 text-weight-bold text-primary">My Projects</div>
      <q-btn flat color="grey-8" icon="logout" label="Logout" @click="logout" :loading="isLoading" />
    </div>

    <q-banner v-if="errorMsg" class="bg-red-1 text-red-9 q-mb-md rounded-borders border-red">
      <template v-slot:avatar>
        <q-icon name="error" color="red" />
      </template>
      {{ errorMsg }}
    </q-banner>

    <q-card class="q-mb-xl shadow-2 rounded-borders">
      <q-card-section>
        <div class="text-h6 q-mb-md text-grey-9">Create New Project</div>
        <div class="row q-col-gutter-md">
          <div class="col-12 col-md-4">
            <q-input outlined v-model="form.name" label="Project Name" dense bg-color="white" />
          </div>
          <div class="col-12 col-md-4">
            <q-input outlined v-model="form.description" label="Description (Optional)" dense bg-color="white" />
          </div>
          <div class="col-12 col-md-2">
            <q-select outlined v-model="form.language" :options="languageOptions" label="Language" dense emit-value
              map-options bg-color="white" />
          </div>
          <div class="col-12 col-md-2 flex items-center">
            <q-btn unelevated color="primary" icon="add" label="Create" :disable="!form.name" :loading="isCreating"
              @click="createProject" class="full-width" />
          </div>
        </div>
      </q-card-section>
    </q-card>

    <div v-if="projects.length === 0 && !isLoading" class="text-center text-grey-7 q-mt-xl">
      <q-icon name="folder_open" size="4rem" color="grey-4" />
      <div class="text-h6 q-mt-sm">No projects yet</div>
      <div class="text-body2">Create your first project above to get started.</div>
    </div>

    <div class="row q-col-gutter-md">
      <div class="col-12 col-md-6 col-lg-4" v-for="p in projects" :key="p.id">
        <q-card class="cursor-pointer shadow-1 hover-shadow transition-all" @click="openProject(p.id)">
          <q-card-section>
            <div class="row justify-between items-start no-wrap">
              <div>
                <div class="text-h6 text-weight-medium text-primary ellipsis">{{ p.name }}</div>
                <div class="text-caption text-grey-6 q-mt-xs">
                  <q-badge color="secondary" outline class="q-mr-sm">{{ p.language || 'JavaScript'
                  }}</q-badge>
                  <q-badge v-if="p.ownerId !== auth.user.id" color="orange" flat class="q-mr-sm">
                    Collaborator (Owner: {{ p.owner?.name || p.owner?.email }})
                  </q-badge>
                  Updated {{ new Date(p.updatedAt || p.createdAt).toLocaleDateString() }}
                </div>
              </div>
              <q-btn flat round dense color="grey-5" icon="more_vert" @click.stop>
                <q-menu>
                  <q-list style="min-width: 100px">
                    <q-item v-if="p.ownerId === auth.user.id" clickable v-close-popup @click="openInviteDialog(p)">
                      <q-item-section avatar><q-icon name="person_add" /></q-item-section>
                      <q-item-section>Invite</q-item-section>
                    </q-item>
                    <q-item v-if="p.ownerId === auth.user.id" clickable v-close-popup @click="deleteProject(p.id)"
                      class="text-negative">
                      <q-item-section avatar><q-icon name="delete" /></q-item-section>
                      <q-item-section>Delete</q-item-section>
                    </q-item>
                  </q-list>
                </q-menu>
              </q-btn>
            </div>
            <div class="text-body2 text-grey-8 q-mt-md ellipsis-2-lines" style="min-height: 40px;">
              {{ p.description || 'No description provided.' }}
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <!-- Invitation Dialog -->
    <q-dialog v-model="inviteDialog.show">
      <q-card style="min-width: 350px">
        <q-card-section>
          <div class="text-h6">Invite Collaborator to {{ inviteDialog.project?.name }}</div>
        </q-card-section>

        <q-card-section class="q-pt-none">
          <q-input dense v-model="inviteDialog.email" autofocus @keyup.enter="inviteMember"
            placeholder="Email or Account Name" label="User Identifier" />
        </q-card-section>

        <q-card-actions align="right" class="text-primary">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn flat label="Invite" :loading="inviteDialog.loading" @click="inviteMember" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { api } from '../lib/http';
import { useRouter } from 'vue-router';
import { useAuth } from 'src/stores/auth';
import { useQuasar } from 'quasar';


const router = useRouter();
const auth = useAuth();
const $q = useQuasar();

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
  try {
    const { data: versions } = await api.get(`projects/${id}/v`);

    if (Array.isArray(versions) && versions.length > 0) {
      const latest = versions[0];
      return router.push(`/projects/${id}/v/${latest.id}`);
    }

    const { data: created } = await api.post(`/projects/${id}/v`, { code: '' });
    return router.push(`/projects/${id}/v/${created.id}`);
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: 'Failed to open project: ' + humanizeError(error)
    });
    // Fallback to project root if version creation fails
    return router.push(`/projects/${id}`);
  }
}

async function getProjects() {
  errorMsg.value = '';
  isLoading.value = true;
  try {
    const { data } = await api.get('/projects');
    projects.value = data;
  } catch (error) {
    const msg = humanizeError(error);
    errorMsg.value = msg; // Keep banner for page load error
    $q.notify({
      type: 'negative',
      message: 'Failed to load projects: ' + msg
    });
  } finally {
    isLoading.value = false;
  }
}

async function logout() {
  try {
    auth.token = null;
    auth.user = null;
    localStorage.removeItem('jwt');
    delete api.defaults.headers.Authorization;
    router.push('/login');
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: 'Logout failed: ' + humanizeError(error)
    });
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
    form.value.description = '';
    $q.notify({
      type: 'positive',
      message: 'Project created successfully'
    });
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: 'Failed to create project: ' + humanizeError(error)
    });
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
    $q.notify({
      type: 'positive',
      message: 'Project deleted'
    });
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: 'Failed to delete project: ' + humanizeError(error)
    });
  }
}

const inviteDialog = ref({
  show: false,
  project: null,
  email: '',
  loading: false
});

function openInviteDialog(project) {
  inviteDialog.value.project = project;
  inviteDialog.value.email = '';
  inviteDialog.value.show = true;
}

async function inviteMember() {
  if (!inviteDialog.value.email.trim()) return;

  inviteDialog.value.loading = true;
  try {
    await api.post(`/projects/${inviteDialog.value.project.id}/members`, {
      emailOrName: inviteDialog.value.email.trim()
    });

    $q.notify({
      type: 'positive',
      message: `User invited to ${inviteDialog.value.project.name}`
    });
    inviteDialog.value.show = false;
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: 'Failed to invite member: ' + humanizeError(error)
    });
  } finally {
    inviteDialog.value.loading = false;
  }
}

function humanizeError(err) {
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
