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

              <div class="q-mt-xl" v-if="user.transactions && user.transactions.length > 0">
                <div class="text-h6 q-mb-md">Recent Activity</div>
                <q-list bordered separator dark class="bg-grey-9 rounded-borders">
                  <q-item v-for="tx in user.transactions" :key="tx.id">
                    <q-item-section avatar>
                      <q-icon :name="tx.actionType === 'COMMENT_CREATED' ? 'chat_bubble' : 'check_circle'"
                        :color="tx.actionType === 'COMMENT_CREATED' ? 'info' : 'positive'" />
                    </q-item-section>

                    <q-item-section>
                      <q-item-label>{{ formatActionType(tx.actionType) }}</q-item-label>
                      <q-item-label caption class="text-grey-5">{{ formatDate(tx.createdAt)
                      }}</q-item-label>
                    </q-item-section>

                    <q-item-section side>
                      <div class="text-weight-bold" :class="tx.points > 0 ? 'text-positive' : 'text-negative'">
                        {{ tx.points > 0 ? '+' : '' }}{{ tx.points }}
                      </div>
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

const user = reactive({
  name: '',
  email: '',
  points: 0,
  transactions: []
});

const loaded = ref(false);
const loading = ref(true);
const error = ref(null);

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

  } catch (err) {
    console.error('Failed to load user account data:', err);
    error.value = 'Failed to fetch account info from the server. Are you logged in?';
  } finally {
    // 3. Stop the loading spinner regardless of success or failure
    loading.value = false;
  }
});

const formatActionType = (type) => {
  switch (type) {
    case 'COMMENT_CREATED': return 'New Comment Added';
    case 'COMMENT_RESOLVED': return 'Comment Resolved';
    default: return type;
  }
};

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
