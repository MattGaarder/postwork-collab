<template>
    <div class="q-pa-md q-gutter-md">
        <q-input v-model="email" label="Email *" />
        <q-input v-model="password" label="Password *"/>
        <q-input v-model="name" label="Name (Optional)"/>
        <div class="row action-buttons q-gutter-md">
            <q-btn label="Register" color="primary" @click="registerUser"></q-btn>
            <q-btn label="Login" color="primary" @click="userLogin"></q-btn>
        </div>
    </div>
</template>
<script setup>
    import { ref } from 'vue';
    import { api } from '../lib/http';
    import { useAuth } from 'src/stores/auth';
    import { useRouter } from 'vue-router';
    import axios from 'axios';

    const email = ref('');
    const password = ref('');
    const name = ref('');
    const errorMsg = ref('');
    const auth = useAuth();
    const router = useRouter();

    async function registerUser() {
        console.log('registering');
        errorMsg.value = '';
        try {
            const { data } = await api.post('/auth/register', {
                email: email.value,
                password: password.value,
                name: name.value || null,
            });

            console.log(data.user);
            console.log('registered')
            auth.setAuth(data.token, data.user);
            router.push('/projects');
        } catch (err) {
            if (axios.isAxiosError(err)) {
                console.error('Register error:', err.response?.data || err.message);
                errorMsg.value = JSON.stringify(err.response?.data ?? { message: err.message }, null, 2);
            } else {
                errorMsg.value = String(err);
            }
        }
    }

    async function userLogin() {
        errorMsg.value = '';
        try {
            const { data } = await api.post('/auth/login', {
                email: email.value,
                password: password.value
            });
            auth.setAuth(data.token, data.user);
            router.push('/projects');
        } catch (err) {
            if (axios.isAxiosError(err)) {
                console.error('Register error:', err.response?.data || err.message);
                errorMsg.value = JSON.stringify(err.response?.data ?? { message: err.message }, null, 2);
            } else {
                errorMsg.value = String(err);
            }
        }
    }
</script>