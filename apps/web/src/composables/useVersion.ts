import { ref } from 'vue';

import { api } from '../lib/http';

import { useRouter } from 'vue-router';

const enumToMonaco = (lang?: string) => {
    switch(lang) {
        case 'JAVASCRIPT':  return 'javascript'
        case 'PYTHON':      return 'python'
        case 'JAVA':        return 'java'
        default:            return 'plaintext'
    }
}

export function useVersion(projectId: number, versionId: number) {
    const router = useRouter();
    const code = ref('');
    const language = ref('plaintext');
    const createdAt = ref<string | null>(null);
    const updatedAt = ref<string | null>(null);
    const isLoading = ref(false);
    const errorMsg = ref('');


    // now to try and make it real-time

    
    async function refresh() {
        errorMsg.value = '';
        isLoading.value = true;

        console.log('refreshing with useVersion composable - ', projectId, versionId);
        try {
            const { data } = await api.get(`/projects/${projectId}/v/${versionId}`);
            code.value = data.code;
            language.value = enumToMonaco(data.language);
            createdAt.value = data.createdAt;
            updatedAt.value = data.updatedAt;
        } catch (error) {
            errorMsg.value = error?.response?.data?.error || "failed to load file";
        } finally {
            isLoading.value = false;
        }
    }

    async function save(newContent?: string) {
        errorMsg.value = '';
        isLoading.value = true;
        const payload = { code: newContent ?? code.value };
        console.log('saving with useVersion composable - ', projectId, versionId, payload);
        try {
            const { data } = await api.post(`/projects/${projectId}/v`, payload);
            code.value = data.code;
            language.value = enumToMonaco(data.language);
            updatedAt.value = data.updatedAt;
            createdAt.value = data.createdAt;

            router.push(`/projects/${projectId}/v/${data.id}`);
        } catch (error) {            
        errorMsg.value = error?.response?.data?.error || "failed to save file";
        } finally {
            isLoading.value = false;
        }
    }

    return { code, language, createdAt, updatedAt, isLoading, errorMsg, refresh, save }
}