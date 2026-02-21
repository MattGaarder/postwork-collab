<template>
  <q-page padding class="account-page">
    <div class="row justify-center">
      <div class="col-12 col-md-8 col-lg-6">
        <q-card bordered class="my-card bg-grey-10 text-white q-mt-lg">
          <q-card-section>
            <div class="text-h4 q-mb-md">Account Summary</div>
          </q-card-section>
          <q-separator dark inset />

          <q-card-section>
            <div v-if="loading" class="flex flex-center q-pa-md">
              <q-spinner-dots color="primary" size="40px" />
            </div>

            <div v-else-if="error" class="text-negative text-center q-pa-md">
              {{ error }}
            </div>

            <div v-else-if="loaded">
              <div class="row q-col-gutter-md">
                <div class="col-12 col-sm-6 text-center">
                  <q-icon name="account_circle" size="100px" color="grey-5" />
                  <div class="text-h5 q-mt-sm">{{ user.name || 'User' }}</div>
                  <div class="text-subtitle1 text-grey-4">{{ user.email }}</div>
                </div>

                <div class="col-12 col-sm-6 flex flex-center">
                  <q-card flat bordered class="points-card bg-primary text-white full-width text-center q-pa-md">
                    <div class="text-overline">Total Score</div>
                    <div class="text-h2 text-weight-bolder">{{ user.points }}</div>
                    <div class="text-subtitle2"><q-icon name="star" /> Points</div>
                  </q-card>
                </div>
              </div>

              <div class="q-mt-xl" v-if="invitations.length > 0">
                <div class="text-h6 q-mb-md">Project Invitations</div>
                <q-list bordered separator dark class="bg-grey-9 rounded-borders">
                  <q-item v-for="inv in invitations" :key="inv.id">
                    <q-item-section avatar>
                      <q-icon name="mail_outline" color="primary" />
                    </q-item-section>
                    <q-item-section>
                      <q-item-label>Invite to: <strong>{{ inv.project.name }}</strong></q-item-label>
                      <q-item-label caption class="text-grey-5">
                        Invited by {{ inv.project.owner.name || inv.project.owner.email }}
                      </q-item-label>
                    </q-item-section>
                    <q-item-section side>
                      <div class="row q-gutter-sm">
                        <q-btn flat round dense color="positive" icon="check" @click="acceptInvitation(inv)">
                          <q-tooltip>Accept</q-tooltip>
                        </q-btn>
                        <q-btn flat round dense color="negative" icon="close" @click="declineInvitation(inv)">
                          <q-tooltip>Decline</q-tooltip>
                        </q-btn>
                      </div>
                    </q-item-section>
                  </q-item>
                </q-list>
              </div>

              <div class="q-mt-xl" v-if="user.transactions && user.transactions.length > 0">
                <div class="text-h6 q-mb-md">Recent Activity</div>
                <q-list bordered separator dark class="bg-grey-9 rounded-borders">
                  <q-item v-for="tx in user.transactions" :key="tx.id" clickable @click="navigateToActivity(tx)">
                    <q-item-section avatar>
                      <q-icon :name="getActivityIcon(tx.actionType)" :color="getActivityColor(tx.actionType)" />
                    </q-item-section>

                    <q-item-section>
                      <q-item-label>{{ formatActionType(tx.actionType) }}</q-item-label>
                      <q-item-label caption v-if="tx.project" class="text-primary text-weight-bold">
                        Project: {{ tx.project.name }}
                      </q-item-label>
                      <q-item-label caption class="text-grey-5" v-if="tx.performer">
                        By: {{ tx.performer.name || tx.performer.email }}
                      </q-item-label>
                      <q-item-label caption class="text-grey-6">{{ formatDate(tx.createdAt) }}</q-item-label>
                    </q-item-section>

                    <q-item-section side>
                      <div class="text-weight-bold"
                        :class="tx.points > 0 ? 'text-positive' : (tx.points < 0 ? 'text-negative' : 'text-grey')">
                        {{ tx.points > 0 ? '+' : '' }}{{ tx.points }}
                      </div>
                      <q-icon name="chevron_right" color="grey-7" size="sm" />
                    </q-item-section>
                  </q-item>
                </q-list>
              </div>
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue';
import { api } from '../lib/http';
import { useQuasar } from 'quasar';
import { useRouter } from 'vue-router';

const router = useRouter();

const user = reactive({
  name: '',
  email: '',
  points: 0,
  transactions: []
});

const invitations = ref([]);
const loaded = ref(false);
const loading = ref(true);
const error = ref(null);
const $q = useQuasar();

onMounted(async () => {
  try {
    // 1. Fetch user profile and points from our backend API
    const response = await api.get('/users/me/points');
    const data = response.data;
    console.log("here is data in the account page: ", data);

    // 2. Set the data directly to our reactive user object
    user.name = data.name || 'Anonymous User';
    user.email = data.email || 'No email provided';
    user.points = data.points || 0;
    user.transactions = data.transactions || [];

    loaded.value = true;
    console.log("AccountPage: Successfully set user reactive object to:", user);

    // 3. Fetch invitations
    const invResponse = await api.get('/invitations');
    invitations.value = invResponse.data;

    // Notify user if there are pending invitations
    if (invitations.value.length > 0) {
      $q.notify({
        message: `You have ${invitations.value.length} pending project invitation(s).`,
        color: 'primary',
        icon: 'mail',
        position: 'top-right',
        timeout: 5000,
        actions: [{ label: 'View', color: 'white', handler: () => { /* section is already visible */ } }]
      });
    }

  } catch (err) {
    console.error('Failed to load user account data:', err);
    error.value = 'Failed to fetch account info from the server. Are you logged in?';
  } finally {
    // 4. Stop the loading spinner regardless of success or failure
    loading.value = false;
  }
});

async function acceptInvitation(inv) {
  try {
    await api.put(`/invitations/${inv.projectId}/accept`);
    invitations.value = invitations.value.filter(i => i.id !== inv.id);
    $q.notify({
      type: 'positive',
      message: `You have successfully joined ${inv.project.name}!`,
      icon: 'check_circle'
    });
    // Refresh points since joining might affect things later (optional)
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: 'Failed to accept invitation'
    });
  }
}

async function declineInvitation(inv) {
  try {
    await api.delete(`/invitations/${inv.projectId}/decline`);
    invitations.value = invitations.value.filter(i => i.id !== inv.id);
    $q.notify({
      type: 'info',
      message: `Decline invitation for ${inv.project.name}`
    });
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: 'Failed to decline invitation'
    });
  }
}

const formatActionType = (type) => {
  switch (type) {
    case 'COMMENT_CREATED': return 'New Comment Added';
    case 'COMMENT_RESOLVED': return 'Comment Resolved';
    case 'INVITATION_SENT': return 'Invitation Received';
    case 'INVITATION_ACCEPTED': return 'Invitation Accepted';
    case 'INVITATION_DECLINED': return 'Invitation Declined';
    default: return type.replace(/_/g, ' ');
  }
};

const getActivityIcon = (type) => {
  switch (type) {
    case 'COMMENT_CREATED': return 'chat_bubble';
    case 'COMMENT_RESOLVED': return 'check_circle';
    case 'INVITATION_SENT': return 'mail';
    case 'INVITATION_ACCEPTED': return 'person_add';
    case 'INVITATION_DECLINED': return 'person_off';
    default: return 'history';
  }
};

const getActivityColor = (type) => {
  switch (type) {
    case 'COMMENT_CREATED': return 'info';
    case 'COMMENT_RESOLVED': return 'positive';
    case 'INVITATION_SENT': return 'primary';
    case 'INVITATION_ACCEPTED': return 'positive';
    case 'INVITATION_DECLINED': return 'negative';
    default: return 'grey';
  }
};

function navigateToActivity(tx) {
  if (!tx.projectId) return;

  const query = tx.line ? `?line=${tx.line}` : '';

  if (tx.actionType.startsWith('COMMENT')) {
    if (tx.versionId) {
      router.push(`/projects/${tx.projectId}/v/${tx.versionId}${query}`);
    } else {
      router.push(`/projects/${tx.projectId}${query}`);
    }
  } else {
    router.push(`/projects/${tx.projectId}`);
  }
}

const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};
</script>

<style scoped>
.account-page {
  min-height: calc(100vh - 50px);
}

.points-card {
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
}
</style>
